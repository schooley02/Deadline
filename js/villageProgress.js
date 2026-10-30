/**
 * VillageProgress -- the achievement village's tier model, pure core (built 2026-10-30, Build 1;
 * decisions in docs/DECISIONS.md "Village tiers", plan in docs/WORLD_FEEDBACK_PLAN.md
 * "Village tiers + building cards").
 *
 * Tier = progress in the CURRENT run: it only ever goes up and every new run starts at T1. Each
 * building reads ONE per-run counter against [T2, T3, T4, T5] thresholds (CONFIG.VILLAGE_TIER_THRESHOLDS):
 *
 *   nights       Radio tower   nights survived this run
 *   slain        Armory        tasks + sub-tasks + habits completed this run
 *   punctuality  Clock tower   items completed on time (done minus late; closed days + the open day)
 *   habits       Hospital      habit check-ins this run
 *   lurkers      Boxing gym    days with no slips (at least one bad habit resolved, none slipped)
 *   defense      Jailhouse     nights the church ended at >= 75% health
 *   heroes       High school   perfect-attendance days (every active routine fully done; late counts)
 *   bestdays     Windmill      heavy days handled (more due than this run's recent average, nothing missed)
 *
 * Same pattern as runStats.js / dailyRecord.js: pure functions, no DOM, no State or CONFIG reads
 * (the caller passes everything in), so it is unit-tested directly. Day-based counters use this
 * run's CLOSED daily records (a day only counts once it can no longer change); `punctuality` also
 * adds the open day. Days recorded before a field existed simply do not count.
 *
 * ctx for counters / compute / extras:
 *   { runStats,        currentRunStats (tasksCompleted, subtasksCompleted, habitsCompleted)
 *     nightsSurvived,  Damage.computeDaysSurvived()
 *     days,            closed daily records: an array, or the `deadline.days` store / its `.days` map
 *     today,           the open day's record (save.today) or null
 *     runNumber,       the current run (runHistory.length + 1); only days with rec.run === runNumber count
 *     maxHp,           CONFIG.MAX_BASE_HEALTH
 *     thresholds?,     defaults to DEFAULT_THRESHOLDS (a test checks it matches CONFIG)
 *     defenseFrac?, heavyWindow?, heavyMinDays? }   defaults mirror CONFIG
 */
const VillageProgress = (() => {
    const KINDS = ['punctuality', 'defense', 'slain', 'nights', 'lurkers', 'heroes', 'habits', 'bestdays'];

    // Mirrors CONFIG.VILLAGE_TIER_THRESHOLDS (test/villageProgress.test.js checks they match).
    const DEFAULT_THRESHOLDS = {
        nights: [4, 18, 50, 100],
        slain: [30, 150, 450, 1000],
        punctuality: [25, 120, 350, 750],
        habits: [20, 80, 250, 500],
        lurkers: [3, 14, 40, 80],
        defense: [3, 14, 40, 80],
        heroes: [3, 10, 30, 60],
        bestdays: [2, 5, 15, 30],
    };
    const DEFAULT_DEFENSE_FRAC = 0.75;
    const DEFAULT_HEAVY_WINDOW = 14;
    const DEFAULT_HEAVY_MIN_DAYS = 3;
    const MAX_TIER = 5;

    function num(v) { return Number.isFinite(v) && v > 0 ? v : 0; }

    /**
     * Where a counter value sits on a [T2..T5] ladder. tier 1..5; `prevAt` = the value that reached the current
     * tier (0 at T1); `nextAt` = the value that reaches the next tier (null at T5); `toNext` = how many are left;
     * `fraction` = 0..1 progress within the current tier (1 at T5).
     */
    function tierFor(value, thresholds) {
        const v = num(value);
        const ladder = Array.isArray(thresholds) ? thresholds : [];
        let tier = 1;
        for (let i = 0; i < ladder.length && tier < MAX_TIER; i++) {
            if (v >= ladder[i]) tier = i + 2; else break;
        }
        const maxed = tier >= MAX_TIER || tier - 1 >= ladder.length;
        const prevAt = tier === 1 ? 0 : ladder[tier - 2];
        const nextAt = maxed ? null : ladder[tier - 1];
        const toNext = maxed ? 0 : Math.max(0, nextAt - v);
        const fraction = maxed ? 1 : (nextAt > prevAt ? Math.min(1, Math.max(0, (v - prevAt) / (nextAt - prevAt))) : 0);
        return { tier, value: v, prevAt, nextAt, toNext, maxed, fraction };
    }

    /** This run's closed daily records, oldest first. `days` = array | store | its days map. */
    function runDays(days, runNumber) {
        let list;
        if (Array.isArray(days)) list = days;
        else if (days && typeof days === 'object') {
            const map = (days.days && typeof days.days === 'object') ? days.days : days;
            list = Object.keys(map).map((k) => map[k]);
        } else list = [];
        return list
            .filter((r) => r && typeof r === 'object' && r.date && r.run === runNumber)
            .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    }

    function dueTotal(r) { return num(r && r.due && r.due.task) + num(r && r.due && r.due.habit); }
    function missedTotal(r) { return num(r && r.missed && r.missed.task) + num(r && r.missed && r.missed.habit); }
    function doneTotal(r) {
        const d = (r && r.done) || {};
        return num(d.task) + num(d.subtask) + num(d.habit);
    }
    function onTimeTotal(r) { return Math.max(0, doneTotal(r) - num(r && r.done && r.done.late)); }

    function dayIndex(dateStr) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
        if (!m) return NaN;
        return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
    }
    function consecutive(a, b) { return dayIndex(b.date) - dayIndex(a.date) === 1; }

    function isPerfectAttendance(r) {
        const a = r && r.att;
        return !!(a && a.active >= 1 && a.perfect === a.active);
    }

    /** Boxing gym: a day with at least one bad habit resolved and none slipped. */
    function isNoSlipDay(r) {
        const l = (r && r.lurk) || {};
        return num(l.avoided) > 0 && num(l.slipped) === 0;
    }

    /** Jailhouse: the church ended the day at >= frac of max health. */
    function churchHeld(r, maxHp, frac) {
        const hp = r && r.base && r.base.endHp;
        if (hp == null || !Number.isFinite(hp) || !(maxHp > 0)) return false;
        return hp >= maxHp * frac;
    }

    /**
     * Windmill: a day is HEAVY when more was due than the average of this run's previous `window` closed days
     * (needs >= `minDays` of history), and HANDLED when nothing was missed.
     */
    function heavyDays(days, window, minDays) {
        let heavy = 0, handled = 0;
        for (let i = 0; i < days.length; i++) {
            const prior = days.slice(Math.max(0, i - window), i);
            if (prior.length < minDays) continue;
            const avg = prior.reduce((s, r) => s + dueTotal(r), 0) / prior.length;
            if (dueTotal(days[i]) > avg) {
                heavy += 1;
                if (missedTotal(days[i]) === 0) handled += 1;
            }
        }
        return { heavy, handled };
    }

    /** Windmill flavour line: a clean day (something due, nothing missed) right after a rough one (misses or damage). */
    function comebackDays(days) {
        let n = 0;
        for (let i = 1; i < days.length; i++) {
            const prev = days[i - 1], cur = days[i];
            if (!consecutive(prev, cur)) continue;
            const rough = missedTotal(prev) > 0 || num(prev.dmg && prev.dmg.taken) > 0;
            const clean = dueTotal(cur) > 0 && missedTotal(cur) === 0;
            if (rough && clean) n += 1;
        }
        return n;
    }

    /** High school flavour line: consecutive perfect-attendance days ending at the latest closed day. */
    function attendanceStreak(days) {
        let n = 0;
        for (let i = days.length - 1; i >= 0; i--) {
            if (!isPerfectAttendance(days[i])) break;
            if (i < days.length - 1 && !consecutive(days[i], days[i + 1])) break;
            n += 1;
        }
        return n;
    }

    function opts(ctx) {
        const c = ctx || {};
        return {
            thresholds: c.thresholds || DEFAULT_THRESHOLDS,
            defenseFrac: c.defenseFrac != null ? c.defenseFrac : DEFAULT_DEFENSE_FRAC,
            heavyWindow: c.heavyWindow != null ? c.heavyWindow : DEFAULT_HEAVY_WINDOW,
            heavyMinDays: c.heavyMinDays != null ? c.heavyMinDays : DEFAULT_HEAVY_MIN_DAYS,
        };
    }

    /** The eight per-run counter values, keyed by building kind. */
    function counters(ctx) {
        const c = ctx || {};
        const o = opts(c);
        const days = runDays(c.days, c.runNumber);
        const rs = c.runStats || {};
        const today = c.today && c.today.run === c.runNumber ? c.today : null;
        return {
            nights: num(c.nightsSurvived),
            slain: num(rs.tasksCompleted) + num(rs.subtasksCompleted) + num(rs.habitsCompleted),
            punctuality: days.reduce((s, r) => s + onTimeTotal(r), 0) + (today ? onTimeTotal(today) : 0),
            habits: num(rs.habitsCompleted),
            lurkers: days.filter(isNoSlipDay).length,
            defense: days.filter((r) => churchHeld(r, c.maxHp, o.defenseFrac)).length,
            heroes: days.filter(isPerfectAttendance).length,
            bestdays: heavyDays(days, o.heavyWindow, o.heavyMinDays).handled,
        };
    }

    /** Tier progress for every building: { kind: { tier, value, prevAt, nextAt, toNext, maxed, fraction } }. */
    function compute(ctx) {
        const o = opts(ctx);
        const values = counters(ctx);
        const out = {};
        KINDS.forEach((k) => { out[k] = tierFor(values[k], o.thresholds[k]); });
        return out;
    }

    /** Card flavour lines that never drive a tier. */
    function extras(ctx) {
        const c = ctx || {};
        const o = opts(c);
        const days = runDays(c.days, c.runNumber);
        return {
            attendanceStreak: attendanceStreak(days),
            comebackDays: comebackDays(days),
            heavyDays: heavyDays(days, o.heavyWindow, o.heavyMinDays).heavy,
        };
    }

    return {
        KINDS,
        DEFAULT_THRESHOLDS,
        MAX_TIER,
        tierFor,
        runDays,
        counters,
        compute,
        extras,
        heavyDays,
        comebackDays,
        attendanceStreak,
        isPerfectAttendance,
        isNoSlipDay,
        churchHeld,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VillageProgress;
}

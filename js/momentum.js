/**
 * Momentum -- what makes a night COUNT (2026-11-11, Jeremy + Claude; docs/MOMENTUM_PLAN.md, DECISIONS 2026-11-11 (momentum)).
 *
 * Build A (this file): the defended-night rule and the Nights Survived count built on it. Nothing here touches the DOM, State or
 * CONFIG (callers pass what they know); zero module dependencies, unit-tested in test/momentum.test.js.
 *
 * A local day is DEFENDED when the player showed up on it:
 *   - finished at least 1 PRIORITY task that was old enough to count (DailyRecord v14 `pri.q`: the task was at least
 *     CONFIG.MOMENTUM.MIN_PRIORITY_AGE_MS old when finished, so create-and-finish spam does not defend a night), or
 *   - fully completed at least 1 ROUTINE (`att.perfect` on a closed day, the open-day tally `rt` on today).
 * Late finishes count (the sky judges punctuality; this only judges showing up). Days before DailyRecord v14 have no `pri.q`, so
 * they read `pri.d` (every priority finish) instead.
 *
 * A Sick Day EXCUSES a night: not defended, not missed (`tokens.sick` on that day's record, written when the Sick Day is used).
 * momentum() (Build B) skips excused nights; the Nights Survived count simply does not add one for them.
 *
 * NIGHTS SURVIVED = the nights the run defended. A night counts at its midnight, when its day CLOSES (the open day is never
 * counted, so the number only ever ticks at a rollover and an undo can only touch the open day). Days with no record (the app
 * was never opened) are not defended, so time away adds nothing.
 *
 * GRANDFATHERING (decided 2026-11-11): a save that already had a run in progress keeps the nights it had. `fromDay` ("YYYY-MM-DD",
 * State.momentumFromDay, set the first day the new rule loads on a save) splits the run: calendar midnights BEFORE that day count as
 * before, defended days FROM it on are judged. A run that starts on or after `fromDay` is judged from its first day.
 */
const Momentum = (() => {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const DEFAULT_MIN_PRIORITY_AGE_MS = 10 * 60 * 1000;
    const PRI_Q_SINCE_VERSION = 14;

    function whole(n) {
        return (typeof n === 'number' && isFinite(n) && n > 0) ? Math.floor(n) : 0;
    }

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    /** The local "YYYY-MM-DD" key of an instant (same as DailyRecord.dateKey), or null for a bad input. */
    function keyOf(ms) {
        if (typeof ms !== 'number' || !isFinite(ms)) return null;
        const d = new Date(ms);
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function validKey(key) {
        return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key);
    }

    /** A DST-free day number for a date key (NaN for a bad key). */
    function dayIndex(key) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key));
        if (!m) return NaN;
        return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / MS_PER_DAY);
    }

    // Mirrors DailyRecord.attendanceFromTally's "perfect" test (test/momentum.test.js checks they agree): a routine is active when it
    // had any activity that day and perfect when every item that went overdue was finished anyway.
    function perfectFromTally(rt) {
        let perfect = 0;
        Object.keys(rt || {}).forEach((k) => {
            const t = rt[k] || [0, 0, 0];
            if ((t[0] || 0) + (t[1] || 0) <= 0) return;
            if (Math.max(0, (t[1] || 0) - (t[2] || 0)) === 0) perfect += 1;
        });
        return perfect;
    }

    /** Routines fully completed that day: from the open day's tally while it exists, else the closed day's `att.perfect`. */
    function perfectRoutines(rec) {
        if (!rec || typeof rec !== 'object') return 0;
        const rt = rec.rt;
        if (rt && typeof rt === 'object' && Object.keys(rt).length) return perfectFromTally(rt);
        return whole(rec.att && rec.att.perfect);
    }

    /** Priority finishes that count toward defending the day (see the header: `pri.q` from v14, `pri.d` before). */
    function priorityDefends(rec) {
        if (!rec || typeof rec !== 'object') return 0;
        const pri = rec.pri || {};
        return Number(rec.v) >= PRI_Q_SINCE_VERSION ? whole(pri.q) : whole(pri.d);
    }

    /** True when the day (a closed record, or the open one) was defended. */
    function isDefended(rec) {
        return priorityDefends(rec) >= 1 || perfectRoutines(rec) >= 1;
    }

    /** True when a Sick Day excused the day (and nothing defended it anyway). */
    function isExcused(rec) {
        return !!rec && typeof rec === 'object' && whole(rec.tokens && rec.tokens.sick) >= 1 && !isDefended(rec);
    }

    /**
     * Does this closed day add to a count that was grandfathered at `fromDay`? Days before `fromDay` pass (they were already counted
     * the old way); days from it on must be defended. No `fromDay` = every day is judged.
     */
    function countsAsNight(rec, fromDay) {
        if (!rec || typeof rec !== 'object') return false;
        if (validKey(fromDay) && validKey(rec.date) && rec.date < fromDay) return true;
        return isDefended(rec);
    }

    /** Calendar midnights between two instants (the pre-Momentum count; 0 for bad input or a start after now). */
    function calendarNights(startMs, nowMs) {
        const a = keyOf(startMs);
        const b = keyOf(nowMs);
        if (!a || !b) return 0;
        return Math.max(0, dayIndex(b) - dayIndex(a));
    }

    /** A list of daily records from an array, a store ({ days }) or a days map. */
    function recordList(days) {
        if (Array.isArray(days)) return days;
        if (days && typeof days === 'object') {
            const map = (days.days && typeof days.days === 'object') ? days.days : days;
            return Object.keys(map).map((k) => map[k]);
        }
        return [];
    }

    /**
     * Nights the run has survived, the Momentum way.
     *   ctx = { runStartMs, nowMs, days (array | store | days map of CLOSED records), runNumber, fromDay? }
     * Days of other runs, the open day and any day after `nowMs` are ignored.
     */
    function nights(ctx) {
        const c = ctx || {};
        const startKey = keyOf(c.runStartMs);
        const todayKey = keyOf(c.nowMs);
        if (!startKey || !todayKey) return 0;
        let ruleStart = startKey;
        let base = 0;
        if (validKey(c.fromDay) && dayIndex(c.fromDay) > dayIndex(startKey)) {
            const upTo = c.fromDay < todayKey ? c.fromDay : todayKey;
            base = Math.max(0, dayIndex(upTo) - dayIndex(startKey));
            ruleStart = c.fromDay;
        }
        let defended = 0;
        recordList(c.days).forEach((r) => {
            if (!r || typeof r !== 'object' || !validKey(r.date) || r.run !== c.runNumber) return;
            if (r.date < ruleStart || r.date >= todayKey) return;
            if (isDefended(r)) defended += 1;
        });
        return base + defended;
    }

    /**
     * Whether a priority finish is old enough to defend a night: the task was at least `minAgeMs` old when it was finished. A task with
     * no creation time (an older save) counts: there is nothing to measure.
     */
    function priorityQualifies(createdAt, finishedAtMs, minAgeMs) {
        if (createdAt == null) return true;
        const created = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
        if (!isFinite(created) || typeof finishedAtMs !== 'number' || !isFinite(finishedAtMs)) return true;
        const min = (typeof minAgeMs === 'number' && minAgeMs >= 0) ? minAgeMs : DEFAULT_MIN_PRIORITY_AGE_MS;
        return finishedAtMs - created >= min;
    }

    /** The barricade state for a momentum count: the first row (best first) whose `min` the count reaches. */
    function barricadeState(count, states) {
        const rows = (Array.isArray(states) && states.length) ? states : [
            { id: 'reinforced', name: 'Reinforced', min: 7 }, { id: 'solid', name: 'Solid', min: 5 },
            { id: 'partial', name: 'Partial', min: 3 }, { id: 'none', name: 'None', min: 0 },
        ];
        const n = whole(count);
        const hit = rows.slice().sort((a, b) => b.min - a.min).find((r) => n >= r.min);
        return hit ? { id: hit.id, name: hit.name, min: hit.min } : { id: 'none', name: 'None', min: 0 };
    }

    function dateKeyFromIndex(idx) {
        const d = new Date(idx * MS_PER_DAY);
        return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }

    /**
     * MOMENTUM (Build B, 2026-11-11): defended nights among the last `windowNights` (default 7) of this run.
     *   ctx = { nowMs, runStartMs, runNumber, days (CLOSED records: array | store | map), todayRec (the open day's record),
     *           windowNights?, maxLookbackDays?, states? }
     * - Today counts the moment it is SECURED (defended). While it is still PENDING it never lowers momentum: the window is then the
     *   last N closed nights. At midnight a pending day becomes a missed night.
     * - A Sick Day night is EXCUSED: skipped, not counted and not missed, and the window looks one night further back.
     * - A closed day with no record of this run (the app was not opened) is MISSED. Days before the run began are not nights.
     * Returns { count, max, state: {id,name,min}, today: 'secured'|'pending'|'excused', todayKey, nights: [{ date, status }] (oldest first; the
     * nights the window looked at, excused ones included) }.
     */
    function momentum(ctx) {
        const c = ctx || {};
        const max = whole(c.windowNights) || 7;
        const cap = whole(c.maxLookbackDays) || 21;
        const todayKey = keyOf(c.nowMs);
        const startKey = keyOf(c.runStartMs);
        const empty = { count: 0, max, state: barricadeState(0, c.states), today: 'pending', todayKey: todayKey || null, nights: [] };
        if (!todayKey) return empty;
        const byDate = {};
        recordList(c.days).forEach((r) => {
            if (r && typeof r === 'object' && validKey(r.date) && r.run === c.runNumber) byDate[r.date] = r;
        });
        const todayRec = c.todayRec && typeof c.todayRec === 'object' ? c.todayRec : null;
        const today = todayRec && isDefended(todayRec) ? 'secured' : (isExcused(todayRec) ? 'excused' : 'pending');
        const todayIdx = dayIndex(todayKey);
        const startIdx = startKey ? dayIndex(startKey) : -Infinity;
        const seen = [];
        let counted = 0;
        let defended = 0;
        const consider = (date, status) => {
            seen.push({ date, status });
            if (status === 'excused') return;
            counted += 1;
            if (status === 'defended') defended += 1;
        };
        if (today === 'secured') consider(todayKey, 'defended');
        else if (today === 'excused') seen.push({ date: todayKey, status: 'excused' });
        for (let back = 1; back <= cap && counted < max; back++) {
            const idx = todayIdx - back;
            if (idx < startIdx) break;
            const date = dateKeyFromIndex(idx);
            const rec = byDate[date];
            let status = 'missed';
            if (rec) status = isDefended(rec) ? 'defended' : (isExcused(rec) ? 'excused' : 'missed');
            consider(date, status);
        }
        seen.reverse();
        return { count: defended, max, state: barricadeState(defended, c.states), today, todayKey, nights: seen };
    }

    return {
        DEFAULT_MIN_PRIORITY_AGE_MS,
        keyOf,
        validKey,
        dayIndex,
        perfectRoutines,
        priorityDefends,
        isDefended,
        isExcused,
        countsAsNight,
        calendarNights,
        nights,
        priorityQualifies,
        barricadeState,
        momentum,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Momentum;
}

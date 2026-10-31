/**
 * DailyRecord — per-day numeric summary, pure core (D2, built 2026-10-27;
 * design + rationale in docs/DAILY_RECORD_PLAN.md, DECISIONS 2026-10-27
 * "Daily record").
 *
 * Why it exists: a future in-game AI ("what has worked for you, when") and
 * best/worst day per run in Stats. NOT for paging the canvas back to a past
 * day. Numbers and category keys only -- never item names or free text.
 *
 * Same pattern as runStats.js: pure functions, no DOM, no State reads. The
 * live accumulator (`save.today`) is owned by State; closed days live in the
 * separate `deadline.days` store, written ONCE per day at rollover. This
 * module only computes: fresh(), bump(), close(), plus the store helpers
 * (emptyStore, addDay, mergeStores, rollUp).
 *
 * THE RULE (also in CLAUDE.md guardrails): any mechanic that changes what can
 * happen in a day adds its counter here in the SAME session and bumps `V`.
 * Fields are additive only; readers treat a missing field as 0 / empty, so old
 * days never need migrating.
 *
 * bump(rec, event, p) events (p = payload; `hour` 0-23, or `at` in ms from
 * which the local hour is derived):
 *   complete    {kind:'task'|'subtask'|'habit'|'lurker', category, hour|at, late?, points?, routineId?}
 *               ('lurker' = a negative habit successfully avoided: counts in
 *               lurk.avoided, NOT done.*; hours / category / points as usual)
 *   uncomplete  same payload -- exact reverse of complete (floors at 0)
 *   overdue     {kind:'task'|'habit', category, hour|at, routineId?}
 *   lurk        {outcome:'avoided'|'slipped', routineId?}   (routineId only matters for 'slipped')
 *   damage      {amount, category, hour|at, hp?}     hp = base HP AFTER the hit
 *   offline     {amount, hp?}                        back-charged on load (kept apart
 *               from live damage: no hour / category, the hit time is unknown)
 *   spend       {points}
 *   token       {kind:'cheat'|'sick'|'skip'|'pushback'|'kit'}
 *   reschedule  {}
 *   ko / revive {}
 *   timer       {kind:'work'|'limit', minutes}
 *   touch       {hour|at}                            any UI interaction
 */
const DailyRecord = (() => {
    // v2 (2026-10-30, village High school): `rt` (open-day per-routine tally) + `att` (closed-day routine attendance).
    // v3 (2026-10-31, High school v2): `stars` = { "<routineId>": 0..5 }, the hero star rating each routine banked when the day closed.
    const V = 3;

    // Mirrors CONFIG.HERO_CATEGORIES (test/dailyRecord.test.js checks they
    // match). Kept local so this module has no global dependencies.
    const CATEGORIES = ['other', 'career', 'creativity', 'financial', 'health', 'lifestyle', 'relationships', 'spirituality'];
    const TOKEN_KINDS = ['cheat', 'sick', 'skip', 'pushback', 'kit'];

    // Days older than this many months collapse into months["YYYY-MM"].
    const RETAIN_MONTHS = 18;

    function zeros(n) {
        const a = new Array(n);
        for (let i = 0; i < n; i++) a[i] = 0;
        return a;
    }

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

    /** Local calendar day key "YYYY-MM-DD" for a timestamp (ms) or Date. */
    function dateKey(ms) {
        const d = ms instanceof Date ? ms : new Date(ms);
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    function monthKey(key) { return String(key).slice(0, 7); }

    function catKey(category) {
        return CATEGORIES.indexOf(category) >= 0 ? category : 'other';
    }

    function hourOf(p) {
        if (p && Number.isInteger(p.hour) && p.hour >= 0 && p.hour <= 23) return p.hour;
        if (p && p.at != null) {
            const h = new Date(p.at).getHours();
            if (h >= 0 && h <= 23) return h;
        }
        return null;
    }

    function freshByCat() {
        const o = {};
        CATEGORIES.forEach((c) => { o[c] = [0, 0, 0]; });
        return o;
    }

    /**
     * A new, empty record for a local day. `ctx` (all optional):
     *   { date, tz, run, night, lvl }
     * `date` is "YYYY-MM-DD"; `tz` minutes offset from UTC (defaults from
     * the local clock).
     */
    function fresh(ctx) {
        const c = ctx || {};
        const now = new Date();
        return {
            v: V,
            date: c.date || dateKey(now),
            tz: c.tz != null ? c.tz : -now.getTimezoneOffset(),
            run: c.run != null ? c.run : 0,
            night: c.night != null ? c.night : 0,
            lvl: c.lvl != null ? c.lvl : 0,
            load: { habits: 0, routines: 0, tasksDue: 0 },
            due: { task: 0, habit: 0 },
            done: { task: 0, subtask: 0, habit: 0, late: 0 },
            missed: { task: 0, habit: 0 },
            lurk: { avoided: 0, slipped: 0 },
            byCat: freshByCat(),
            hoursDone: zeros(24),
            hoursMissed: zeros(24),
            hoursDmg: zeros(24),
            active: { first: null, last: null, touches: 0 },
            dmg: { taken: 0, hits: 0, offline: 0 },
            base: { endHp: null, minHp: null },
            pts: { earned: 0, spent: 0, end: 0 },
            tokens: { cheat: 0, sick: 0, skip: 0, pushback: 0, kit: 0 },
            resched: 0,
            ko: 0,
            revived: 0,
            timer: { workMin: 0, limitMin: 0 },
            streak: { best: 0 },
            // Routine attendance (v2). `rt` is the OPEN day's tally, { "<routineId>": [done, missed, lateDone] } (opaque numeric ids,
            // no names); close() folds it into `att` and clears it. att.active = routines with activity that day, att.perfect = how
            // many of those had every item finished (late counts). A day is "perfect attendance" when active >= 1 and perfect === active.
            att: { active: 0, perfect: 0 },
            rt: {},
            // v3: banked hero stars per routine, written ONCE at close (opaque ids, no names). Missing on older days (reads as none).
            stars: {},
        };
    }

    function sanitizeStars(src) {
        const out = {};
        if (!src || typeof src !== 'object') return out;
        Object.keys(src).forEach((k) => {
            const n = Number(src[k]);
            if (Number.isFinite(n)) out[k] = Math.max(0, Math.min(5, Math.round(n)));
        });
        return out;
    }

    /** Sum of the stars a CLOSED day banked (the High school counter adds this over the run's days). */
    function starsTotal(rec) {
        const st = rec && rec.stars;
        if (!st || typeof st !== 'object') return 0;
        return Object.keys(st).reduce((sum, k) => sum + (Number.isFinite(st[k]) && st[k] > 0 ? st[k] : 0), 0);
    }

    // ---- Routine attendance (v2) ----
    function sanitizeRt(src) {
        const out = {};
        if (!src || typeof src !== 'object') return out;
        Object.keys(src).forEach((k) => {
            const t = src[k];
            if (!Array.isArray(t)) return;
            out[k] = [0, 1, 2].map((i) => (Number.isFinite(t[i]) && t[i] > 0 ? t[i] : 0));
        });
        return out;
    }

    // idx 0 = done, 1 = missed, 2 = completed late. Undo (dir < 0) floors at 0.
    function tally(rec, routineId, idx, dir) {
        if (routineId == null || !Number.isFinite(Number(routineId))) return;
        if (!rec.rt || typeof rec.rt !== 'object') rec.rt = {};
        const key = String(routineId);
        const t = rec.rt[key] || (rec.rt[key] = [0, 0, 0]);
        t[idx] = dir > 0 ? t[idx] + 1 : (t[idx] > 0 ? t[idx] - 1 : 0);
    }

    // A routine counts that day when it had any activity; it is perfect when every item that went overdue was
    // finished anyway (misses minus late completions is <= 0).
    function attendanceFromTally(rt) {
        const out = { active: 0, perfect: 0 };
        Object.keys(rt || {}).forEach((k) => {
            const t = rt[k] || [0, 0, 0];
            if ((t[0] || 0) + (t[1] || 0) <= 0) return;
            out.active += 1;
            if (Math.max(0, (t[1] || 0) - (t[2] || 0)) === 0) out.perfect += 1;
        });
        return out;
    }

    /** True when a CLOSED day had at least one active routine and every one of them was fully attended. */
    function isPerfectAttendance(rec) {
        const a = rec && rec.att;
        return !!(a && a.active >= 1 && a.perfect === a.active);
    }

    // Repair a record read from storage so every field a bump touches exists
    // (additive-only rule: older records simply lack newer fields).
    function normalize(rec) {
        if (!rec || typeof rec !== 'object') return fresh();
        const f = fresh({ date: rec.date, tz: rec.tz });
        function fill(dst, src) {
            Object.keys(dst).forEach((k) => {
                const dv = dst[k];
                const sv = src ? src[k] : undefined;
                if (sv === undefined || sv === null) return;
                if (Array.isArray(dv)) {
                    if (Array.isArray(sv)) {
                        for (let i = 0; i < dv.length; i++) {
                            dv[i] = Number.isFinite(sv[i]) ? sv[i] : dv[i];
                        }
                    }
                } else if (dv && typeof dv === 'object') {
                    fill(dv, sv);
                } else {
                    dst[k] = sv;
                }
            });
        }
        fill(f, rec);
        f.rt = sanitizeRt(rec.rt);
        f.stars = sanitizeStars(rec.stars);
        // `fill` skips null/undefined sources, but null IS a legal value for
        // active.first/last and base.*; copy those straight across.
        if (rec.active) { f.active.first = rec.active.first != null ? rec.active.first : null; f.active.last = rec.active.last != null ? rec.active.last : null; }
        if (rec.base) { f.base.endHp = rec.base.endHp != null ? rec.base.endHp : null; f.base.minHp = rec.base.minHp != null ? rec.base.minHp : null; }
        f.v = rec.v != null ? rec.v : V;
        return f;
    }

    function dec(n) { return n > 0 ? n - 1 : 0; }

    function bumpComplete(rec, p, dir) {
        const isLurker = p.kind === 'lurker';
        tally(rec, p.routineId, 0, dir);
        if (p.late) tally(rec, p.routineId, 2, dir);
        const kind = p.kind === 'subtask' || p.kind === 'habit' ? p.kind : 'task';
        const h = hourOf(p);
        const cat = rec.byCat[catKey(p.category)];
        if (isLurker) {
            // An avoided lurker is a win but not a "done" item: keep done.*
            // (the positive-completion denominators) clean.
            rec.lurk.avoided = dir > 0 ? rec.lurk.avoided + 1 : dec(rec.lurk.avoided);
            if (dir > 0) {
                if (h != null) rec.hoursDone[h] += 1;
                cat[0] += 1;
                if (p.points > 0) rec.pts.earned += p.points;
            } else {
                if (h != null) rec.hoursDone[h] = dec(rec.hoursDone[h]);
                cat[0] = dec(cat[0]);
                if (p.points > 0) rec.pts.earned = Math.max(0, rec.pts.earned - p.points);
            }
            return;
        }
        if (dir > 0) {
            rec.done[kind] += 1;
            if (p.late) rec.done.late += 1;
            if (h != null) rec.hoursDone[h] += 1;
            cat[0] += 1;
            if (p.points > 0) rec.pts.earned += p.points;
        } else {
            rec.done[kind] = dec(rec.done[kind]);
            if (p.late) rec.done.late = dec(rec.done.late);
            if (h != null) rec.hoursDone[h] = dec(rec.hoursDone[h]);
            cat[0] = dec(cat[0]);
            if (p.points > 0) rec.pts.earned = Math.max(0, rec.pts.earned - p.points);
        }
    }

    /**
     * Apply one event to a record. Mutates and returns `rec` (the
     * accumulator is owned by State and persisted as-is -- same
     * mutate-in-place convention as RunStats). Unknown events are ignored so
     * a stale seam can never throw inside a game tick.
     */
    function bump(rec, event, payload) {
        if (!rec) return rec;
        const p = payload || {};
        switch (event) {
            case 'complete':
                bumpComplete(rec, p, +1);
                break;
            case 'uncomplete':
                bumpComplete(rec, p, -1);
                break;
            case 'overdue': {
                const kind = p.kind === 'habit' ? 'habit' : 'task';
                const h = hourOf(p);
                rec.missed[kind] += 1;
                tally(rec, p.routineId, 1, +1);
                if (h != null) rec.hoursMissed[h] += 1;
                rec.byCat[catKey(p.category)][1] += 1;
                break;
            }
            case 'lurk':
                if (p.outcome === 'slipped') { rec.lurk.slipped += 1; tally(rec, p.routineId, 1, +1); }
                else if (p.outcome === 'avoided') rec.lurk.avoided += 1;
                break;
            case 'damage': {
                const amt = Number(p.amount);
                if (!(amt > 0)) break;
                const h = hourOf(p);
                rec.dmg.taken += amt;
                rec.dmg.hits += 1;
                if (h != null) rec.hoursDmg[h] += amt;
                rec.byCat[catKey(p.category)][2] += amt;
                if (Number.isFinite(p.hp)) {
                    rec.base.minHp = rec.base.minHp == null ? p.hp : Math.min(rec.base.minHp, p.hp);
                }
                break;
            }
            case 'offline': {
                const amt = Number(p.amount);
                if (!(amt > 0)) break;
                rec.dmg.offline += amt;
                if (Number.isFinite(p.hp)) {
                    rec.base.minHp = rec.base.minHp == null ? p.hp : Math.min(rec.base.minHp, p.hp);
                }
                break;
            }
            case 'spend':
                if (p.points > 0) rec.pts.spent += p.points;
                break;
            case 'token':
                if (TOKEN_KINDS.indexOf(p.kind) >= 0) rec.tokens[p.kind] += 1;
                break;
            case 'reschedule':
                rec.resched += 1;
                break;
            case 'ko':
                rec.ko += 1;
                break;
            case 'revive':
                rec.revived += 1;
                break;
            case 'timer': {
                const m = Number(p.minutes);
                if (!(m > 0)) break;
                if (p.kind === 'limit') rec.timer.limitMin += m;
                else if (p.kind === 'work') rec.timer.workMin += m;
                break;
            }
            case 'touch': {
                const h = hourOf(p);
                rec.active.touches += 1;
                if (h != null) {
                    if (rec.active.first == null || h < rec.active.first) rec.active.first = h;
                    if (rec.active.last == null || h > rec.active.last) rec.active.last = h;
                }
                break;
            }
            default:
                break;
        }
        return rec;
    }

    /**
     * Stamp the end-of-day snapshot onto a record and return it. `ctx`
     * (all optional): { lvl, load:{habits,routines,tasksDue}, due:{task,habit},
     * endHp, ptsEnd, bestStreak, run, night }. Returns a normalized copy; the
     * caller writes it into the store and seeds a fresh accumulator.
     */
    function close(rec, ctx) {
        const r = normalize(rec);
        const c = ctx || {};
        if (c.lvl != null) r.lvl = c.lvl;
        if (c.run != null) r.run = c.run;
        if (c.night != null) r.night = c.night;
        if (c.load) {
            r.load.habits = c.load.habits || 0;
            r.load.routines = c.load.routines || 0;
            r.load.tasksDue = c.load.tasksDue || 0;
        }
        if (c.due) {
            r.due.task = c.due.task || 0;
            r.due.habit = c.due.habit || 0;
        }
        if (c.endHp != null) {
            r.base.endHp = c.endHp;
            if (r.base.minHp == null || c.endHp < r.base.minHp) r.base.minHp = c.endHp;
        }
        if (c.ptsEnd != null) r.pts.end = c.ptsEnd;
        if (c.bestStreak != null) r.streak.best = c.bestStreak;
        // v3: bank the routines' stars. Only when the caller supplied them (a second close keeps what the day already banked).
        if (c.stars) r.stars = sanitizeStars(c.stars);
        // v2: fold the open-day routine tally into att and drop it (a second close of an already-closed record keeps its att).
        if (Object.keys(r.rt).length) {
            const a = attendanceFromTally(r.rt);
            r.att.active = a.active;
            r.att.perfect = a.perfect;
        }
        r.rt = {};
        return r;
    }

    /** Totals used by Stats (best/worst day) and tests. */
    function totals(rec) {
        const r = rec || {};
        const d = r.done || {}, m = r.missed || {}, g = r.dmg || {};
        return {
            done: (d.task || 0) + (d.subtask || 0) + (d.habit || 0),
            missed: (m.task || 0) + (m.habit || 0),
            damage: g.taken || 0,
        };
    }

    const DEFAULT_SCORE_WEIGHTS = { done: 1, missed: 1, damage: 1 };

    /**
     * Day score for Stats best/worst day (D2 step 5, 2026-10-27):
     * done*w.done - missed*w.missed - damage*w.damage. Weights come from
     * CONFIG.DAILY_SCORE_WEIGHTS (passed in; this module never reads CONFIG).
     */
    function dayScore(rec, weights) {
        const t = totals(rec);
        const w = Object.assign({}, DEFAULT_SCORE_WEIGHTS, weights || {});
        return t.done * w.done - t.missed * w.missed - t.damage * w.damage;
    }

    function dayEntry(rec, weights) {
        const t = totals(rec);
        return {
            date: rec.date,
            night: rec.night || 0,
            score: dayScore(rec, weights),
            done: t.done,
            missed: t.missed,
            damage: t.damage,
        };
    }

    /**
     * Best and worst day of one run. Candidates = closed days in the store
     * whose `run` matches, plus `opts.extra` records (the open `save.today`
     * for the live run; the caller only passes it for the current run).
     * Days with no done / missed / damage are skipped (an idle day is not a
     * "worst" day). Ties go to the earlier date. Returns null when fewer than
     * 2 scored days exist or every score is equal (best and worst would be
     * the same day). Result: { best, worst } of { date, night, score, done,
     * missed, damage }.
     */
    function bestWorstByRun(store, runNumber, opts) {
        const o = opts || {};
        const s = normalizeStore(store);
        const byDate = {};
        Object.keys(s.days).forEach(key => {
            const r = s.days[key];
            if (r && r.run === runNumber) byDate[r.date || key] = r;
        });
        (o.extra || []).forEach(r => { if (r && r.date) byDate[r.date] = r; });

        const entries = Object.keys(byDate).sort()
            .map(k => dayEntry(byDate[k], o.weights))
            .filter(e => e.done + e.missed + e.damage > 0);
        if (entries.length < 2) return null;

        let best = entries[0], worst = entries[0];
        entries.forEach(e => {
            if (e.score > best.score) best = e;
            if (e.score < worst.score) worst = e;
        });
        if (best.score === worst.score) return null;
        return { best, worst };
    }

    // ---- store ({ v, days:{date:rec}, months:{ym:rec-shaped totals} }) ----

    function emptyStore() {
        return { v: V, days: {}, months: {} };
    }

    function normalizeStore(store) {
        const s = store && typeof store === 'object' ? store : {};
        return {
            v: s.v != null ? s.v : V,
            days: s.days && typeof s.days === 'object' ? s.days : {},
            months: s.months && typeof s.months === 'object' ? s.months : {},
        };
    }

    /**
     * Write a closed day into the store (replacing any record for that
     * date -- rollover is the only writer, once per day). Returns the store.
     */
    function addDay(store, rec) {
        const s = normalizeStore(store);
        if (rec && rec.date) s.days[rec.date] = rec;
        return s;
    }

    // Sum `src` into `dst` (both record-shaped). Counters add, hour arrays
    // add; `active` / `base` / `tz` are handled by the caller.
    function sumInto(dst, src) {
        ['done', 'missed', 'lurk', 'dmg', 'tokens', 'timer', 'due'].forEach((grp) => {
            Object.keys(dst[grp]).forEach((k) => { dst[grp][k] += (src[grp] && src[grp][k]) || 0; });
        });
        ['hoursDone', 'hoursMissed', 'hoursDmg'].forEach((a) => {
            for (let i = 0; i < 24; i++) dst[a][i] += (src[a] && src[a][i]) || 0;
        });
        CATEGORIES.forEach((c) => {
            for (let i = 0; i < 3; i++) dst.byCat[c][i] += (src.byCat && src.byCat[c] && src.byCat[c][i]) || 0;
        });
        dst.pts.earned += (src.pts && src.pts.earned) || 0;
        dst.pts.spent += (src.pts && src.pts.spent) || 0;
        dst.att.active += (src.att && src.att.active) || 0;
        dst.att.perfect += (src.att && src.att.perfect) || 0;
        dst.resched += src.resched || 0;
        dst.ko += src.ko || 0;
        dst.revived += src.revived || 0;
        dst.active.touches += (src.active && src.active.touches) || 0;
    }

    /**
     * Collapse every day older than RETAIN_MONTHS (relative to `now`) into
     * months["YYYY-MM"]. A month record is record-shaped: counters and hour
     * arrays summed; `active.first/last` = earliest/latest across the month;
     * `base.endHp/minHp` averaged, `lvl`/`pts.end` = last day folded in;
     * `tz` dropped; plus `days` (how many days were summed). Existing month
     * records are merged into. Returns the store.
     */
    function rollUp(store, now) {
        const s = normalizeStore(store);
        const nd = now instanceof Date ? now : new Date(now != null ? now : Date.now());
        const cutoff = new Date(nd.getFullYear(), nd.getMonth() - RETAIN_MONTHS, nd.getDate());
        const cutKey = dateKey(cutoff);
        Object.keys(s.days).sort().forEach((key) => {
            if (key >= cutKey) return;
            const day = normalize(s.days[key]);
            const ym = monthKey(key);
            let m = s.months[ym];
            if (!m) {
                m = fresh({ date: ym });
                m.days = 0;
                m.lvl = day.lvl;
                m.base = { endHp: 0, minHp: 0 };
            } else {
                const prevDays = m.days || 0;
                m = normalize(m);
                m.date = ym;
                m.days = prevDays;
                if (!m.base || m.base.endHp == null) m.base = { endHp: 0, minHp: 0 };
            }
            delete m.tz;
            const n = m.days;
            sumInto(m, day);
            if (day.active.first != null) m.active.first = m.active.first == null ? day.active.first : Math.min(m.active.first, day.active.first);
            if (day.active.last != null) m.active.last = m.active.last == null ? day.active.last : Math.max(m.active.last, day.active.last);
            // Running averages for base HP over the days folded in so far.
            if (day.base.endHp != null) m.base.endHp = (m.base.endHp * n + day.base.endHp) / (n + 1);
            if (day.base.minHp != null) m.base.minHp = (m.base.minHp * n + day.base.minHp) / (n + 1);
            m.lvl = day.lvl;
            m.pts.end = day.pts.end;
            m.streak.best = Math.max(m.streak.best, day.streak.best);
            m.days = n + 1;
            s.months[ym] = m;
            delete s.days[key];
        });
        return s;
    }

    /**
     * Import merge: add days from `incoming` that this device doesn't have.
     * NEVER overwrites a day that already has data here. Months merge the
     * same way (an existing month is kept as-is). Returns
     * { store, added } where `added` counts new days + months.
     */
    function mergeStores(local, incoming) {
        const s = normalizeStore(local);
        const inc = normalizeStore(incoming);
        let added = 0;
        Object.keys(inc.days).forEach((k) => {
            if (!s.days[k] && inc.days[k] && typeof inc.days[k] === 'object') {
                s.days[k] = inc.days[k];
                added += 1;
            }
        });
        Object.keys(inc.months).forEach((k) => {
            if (!s.months[k] && inc.months[k] && typeof inc.months[k] === 'object') {
                s.months[k] = inc.months[k];
                added += 1;
            }
        });
        return { store: s, added };
    }

    return {
        V,
        CATEGORIES,
        RETAIN_MONTHS,
        dateKey,
        fresh,
        normalize,
        bump,
        close,
        totals,
        attendanceFromTally,
        starsTotal,
        sanitizeStars,
        isPerfectAttendance,
        dayScore,
        bestWorstByRun,
        emptyStore,
        normalizeStore,
        addDay,
        rollUp,
        mergeStores,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DailyRecord;
}

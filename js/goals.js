/**
 * Goals -- the pure rules of the Goals feature (Build A, 2026-11-05; docs/GOALS_PLAN.md; DECISIONS 2026-11-04 (goals)).
 *
 * A goal sits in a SLOT. Two kinds:
 *   - milestone: one-time, optional deadline; its stage only follows progress (floor(progress * 5), 5 = complete).
 *   - recurring: a day / week / month period; one stage UP per period met, one stage DOWN per period missed (never to zero in one step).
 * Targets (what a goal measures): number (a range), bool (yes / no), linked (tasks, habits, routines, counted by events), aggregate
 * (a daily-record number over the period, see js/goalMetrics.js).
 *
 * Slots unlock by player level and are kept as a high-water mark, so a lost run never takes one back (the `bestRoutineSlots` precedent).
 * Goals themselves carry across runs: nothing here is run state.
 *
 * Baseline rule (CLAUDE.md): this module speaks engine words only -- goal, slot, stage, period, target, pace. Every player-facing theme word
 * and sprite path comes from js/theme.js; test/wording-rule.test.js fails this file on a theme noun.
 *
 * Pure functions, no DOM, no State, no CONFIG reads (the caller passes tables and the clock in), so test/goals.test.js drives them
 * directly. State owns the saved copy (js/state.js `goals`); script.js and Items call it through State.
 */
const Goals = (() => {
    const KINDS = ['milestone', 'recurring'];
    const PERIODS = ['day', 'week', 'month'];
    const TARGET_TYPES = ['number', 'bool', 'linked', 'aggregate'];
    const MAX_STAGE = 5;
    const EPS = 1e-9;
    // A recurring goal that was closed for a very long time closes at most this many periods one by one, then jumps to the current one.
    const MAX_CLOSE_STEPS = 400;
    const NAME_MAX = 80;
    const LABEL_MAX = 80;
    const HISTORY_SANE_MAX = 100;

    // ---------------------------------------------------------------- small helpers

    const isInt = (n) => typeof n === 'number' && Number.isFinite(n) && Math.floor(n) === n;
    const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
    const clamp01 = (n) => (isNum(n) ? clamp(n, 0, 1) : 0);
    const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
    const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);

    function sanitizeBestSlots(n) {
        return (isNum(n) && n > 0) ? Math.floor(n) : 0;
    }

    /** Slots for a player level: the table's value, never below the best ever held, never below 1. */
    function slotsAtLevel(level, table, best) {
        const fromTable = (table && isNum(table[level]) && table[level] > 0) ? Math.floor(table[level]) : 1;
        return Math.max(fromTable, sanitizeBestSlots(best));
    }

    // ---------------------------------------------------------------- dates and period keys

    function toDate(v) {
        const d = (v instanceof Date) ? v : new Date(v);
        return isNaN(d.getTime()) ? null : d;
    }

    /** 'YYYY-MM-DD' in the local time zone. */
    function dateKey(v) {
        const d = toDate(v);
        if (!d) return null;
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
    const MONTH_KEY = /^(\d{4})-(\d{2})$/;

    function parseDayKey(key) {
        const m = typeof key === 'string' ? DAY_KEY.exec(key) : null;
        if (!m) return null;
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
        return isNaN(d.getTime()) ? null : d;
    }

    function validKey(period, key) {
        if (period === 'month') return typeof key === 'string' && MONTH_KEY.test(key);
        if (period === 'day' || period === 'week') return parseDayKey(key) !== null;
        return false;
    }

    /**
     * The key of the period `v` falls in. day = 'YYYY-MM-DD'; week = the 'YYYY-MM-DD' of the week's FIRST day (weekStartsOn: 0 = Sunday,
     * 1 = Monday), so it sorts and reads on its own; month = 'YYYY-MM'. null for an unknown period or a bad date.
     */
    function periodKeyFor(period, v, weekStartsOn) {
        const d = toDate(v);
        if (!d) return null;
        if (period === 'day') return dateKey(d);
        if (period === 'month') return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
        if (period === 'week') {
            const start = isInt(weekStartsOn) && weekStartsOn >= 0 && weekStartsOn <= 6 ? weekStartsOn : 1;
            const back = (d.getDay() - start + 7) % 7;
            return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back));
        }
        return null;
    }

    /** First local midnight of the period (a Date), or null for a bad key. */
    function periodStart(period, key) {
        if (!validKey(period, key)) return null;
        if (period === 'month') {
            const m = MONTH_KEY.exec(key);
            return new Date(Number(m[1]), Number(m[2]) - 1, 1, 0, 0, 0, 0);
        }
        return parseDayKey(key);
    }

    /** The local midnight AFTER the period (exclusive end), or null. */
    function periodEnd(period, key) {
        const s = periodStart(period, key);
        if (!s) return null;
        if (period === 'month') return new Date(s.getFullYear(), s.getMonth() + 1, 1, 0, 0, 0, 0);
        const days = period === 'week' ? 7 : 1;
        return new Date(s.getFullYear(), s.getMonth(), s.getDate() + days, 0, 0, 0, 0);
    }

    function nextPeriodKey(period, key) {
        const e = periodEnd(period, key);
        if (!e) return null;
        return period === 'month' ? e.getFullYear() + '-' + pad2(e.getMonth() + 1) : dateKey(e);
    }

    /** Every local day key inside the period, in order ([] for a bad key). */
    function periodDayKeys(period, key) {
        const s = periodStart(period, key);
        const e = periodEnd(period, key);
        if (!s || !e) return [];
        const out = [];
        for (let d = new Date(s.getTime()); d.getTime() < e.getTime(); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
            out.push(dateKey(d));
            if (out.length > 400) break; // a sane bound: a month is at most 31 days
        }
        return out;
    }

    // ---------------------------------------------------------------- targets

    function nextTargetId(targets) {
        return targets.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    }

    function idList(v) {
        if (!Array.isArray(v)) return [];
        const out = [];
        v.forEach((x) => {
            if ((typeof x === 'string' && x !== '') || isNum(x)) {
                if (!out.some(y => sameId(y, x))) out.push(x);
            }
        });
        return out;
    }

    /** One target in its saved shape, or null when it is not a known type. `id` comes from the caller (unique within the goal). */
    function normalizeTarget(raw, id) {
        if (!raw || typeof raw !== 'object' || TARGET_TYPES.indexOf(raw.type) === -1) return null;
        const base = { id, type: raw.type, label: str(raw.label, LABEL_MAX) };
        if (raw.type === 'number') {
            const start = isNum(raw.start) ? raw.start : 0;
            const end = isNum(raw.end) ? raw.end : 1;
            return Object.assign(base, {
                start, end,
                current: isNum(raw.current) ? raw.current : start,
                unit: str(raw.unit, 24),
            });
        }
        if (raw.type === 'bool') {
            return Object.assign(base, { done: raw.done === true });
        }
        if (raw.type === 'linked') {
            const itemTotal = isInt(raw.itemTotal) && raw.itemTotal > 0 ? raw.itemTotal : 0;
            const itemDone = isInt(raw.itemDone) && raw.itemDone > 0 ? Math.min(raw.itemDone, itemTotal) : 0;
            return Object.assign(base, {
                itemTotal, itemDone,
                habitDefIds: idList(raw.habitDefIds),
                routineIds: idList(raw.routineIds),
                count: isInt(raw.count) && raw.count >= 1 ? raw.count : 1,
                occ: isInt(raw.occ) && raw.occ > 0 ? raw.occ : 0,
            });
        }
        // aggregate
        return Object.assign(base, {
            metric: str(raw.metric, 40),
            op: raw.op === 'days' ? 'days' : 'sum',
            threshold: isNum(raw.threshold) && raw.threshold >= 0 ? raw.threshold : 1,
            compare: raw.compare === 'lte' ? 'lte' : 'gte',
            count: isInt(raw.count) && raw.count >= 1 ? raw.count : 1,
        });
    }

    function normalizeTargets(rawList) {
        const out = [];
        if (!Array.isArray(rawList)) return out;
        const used = new Set();
        const pending = [];
        rawList.forEach((raw) => {
            if (!raw || typeof raw !== 'object' || TARGET_TYPES.indexOf(raw.type) === -1) return;
            const want = isInt(raw.id) && raw.id > 0 && !used.has(raw.id) ? raw.id : null;
            if (want !== null) used.add(want);
            pending.push({ raw, want });
        });
        let next = 1;
        pending.forEach(({ raw, want }) => {
            let id = want;
            if (id === null) {
                while (used.has(next)) next++;
                id = next;
                used.add(id);
            }
            const t = normalizeTarget(raw, id);
            if (t) out.push(t);
        });
        return out;
    }

    function hasHabitSources(t) {
        return t.habitDefIds.length + t.routineIds.length > 0;
    }

    function compareOk(value, threshold, compare) {
        return compare === 'lte' ? value <= threshold : value >= threshold;
    }

    /**
     * 0..1 progress of one target. ctx: { kind: 'milestone' | 'recurring' (default milestone), records: DailyRecord[], openKey: 'YYYY-MM-DD'|null,
     * metricValue(rec, metricId) }. `records` are the daily records inside the goal's window (the period for a recurring goal, createdAt..today
     * for a milestone); `openKey` is the still-open day among them.
     */
    function targetProgress(target, ctx) {
        if (!target || typeof target !== 'object') return 0;
        const c = ctx || {};
        switch (target.type) {
            case 'number': {
                const span = target.end - target.start;
                if (!isNum(span) || !isNum(target.current)) return 0;
                if (span === 0) return target.current === target.end ? 1 : 0;
                return clamp01((target.current - target.start) / span);
            }
            case 'bool':
                return target.done === true ? 1 : 0;
            case 'linked': {
                const count = isInt(target.count) && target.count >= 1 ? target.count : 1;
                const occ = isNum(target.occ) && target.occ > 0 ? target.occ : 0;
                if (c.kind === 'recurring') return clamp01(occ / count);
                const sources = hasHabitSources(target);
                const needed = (target.itemTotal || 0) + (sources ? count : 0);
                if (needed <= 0) return 0;
                const done = (target.itemDone || 0) + (sources ? Math.min(occ, count) : 0);
                return clamp01(done / needed);
            }
            case 'aggregate': {
                const records = Array.isArray(c.records) ? c.records : [];
                const val = (rec) => (typeof c.metricValue === 'function' ? Number(c.metricValue(rec, target.metric)) || 0 : 0);
                const threshold = isNum(target.threshold) ? target.threshold : 0;
                if (target.op === 'days') {
                    const need = isInt(target.count) && target.count >= 1 ? target.count : 1;
                    let n = 0;
                    records.forEach((rec) => {
                        // A day that is not over cannot count as "kept it under" yet (damage can still come); progress made today counts.
                        if (target.compare === 'lte' && c.openKey && rec && rec.date === c.openKey) return;
                        if (compareOk(val(rec), threshold, target.compare)) n++;
                    });
                    return clamp01(n / need);
                }
                const total = records.reduce((s, rec) => s + val(rec), 0);
                if (target.compare === 'lte') return total <= threshold ? 1 : 0;
                if (threshold <= 0) return 1;
                return clamp01(total / threshold);
            }
            default:
                return 0;
        }
    }

    /** Mean of the targets' progress (0 for a goal with no targets). */
    function goalProgress(goal, ctx) {
        if (!goal || !Array.isArray(goal.targets) || goal.targets.length === 0) return 0;
        const c = Object.assign({}, ctx, { kind: goal.kind });
        const sum = goal.targets.reduce((s, t) => s + targetProgress(t, c), 0);
        return clamp01(sum / goal.targets.length);
    }

    /** The sprite stage (0..5) a goal shows. A milestone follows progress (open = at most 4); a recurring goal shows its stored ladder. */
    function stageFor(goal, progress) {
        if (!goal) return 0;
        if (goal.kind === 'milestone') {
            if (goal.completedAt) return MAX_STAGE;
            return clamp(Math.floor(clamp01(progress) * MAX_STAGE + EPS), 0, MAX_STAGE - 1);
        }
        return isNum(goal.stage) ? clamp(Math.floor(goal.stage), 0, MAX_STAGE) : 0;
    }

    // ---------------------------------------------------------------- pace

    function deadlineEndMs(goal) {
        const s = goal && goal.deadline ? parseDayKey(goal.deadline) : null;
        if (!s) return null;
        return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1, 0, 0, 0, 0).getTime();
    }

    /** Share (0..1) of the goal's time that has passed: the current period, or createdAt..end of the deadline day. null = no clock. */
    function elapsedFraction(goal, nowMs, weekStartsOn) {
        if (!goal) return null;
        if (goal.kind === 'recurring') {
            const key = periodKeyFor(goal.period, nowMs, weekStartsOn);
            const s = periodStart(goal.period, key);
            const e = periodEnd(goal.period, key);
            if (!s || !e) return null;
            return clamp01((nowMs - s.getTime()) / (e.getTime() - s.getTime()));
        }
        const end = deadlineEndMs(goal);
        if (end === null) return null;
        const start = isNum(goal.createdAt) ? goal.createdAt : 0;
        if (end <= start) return 1;
        return clamp01((nowMs - start) / (end - start));
    }

    /** 'done' | 'none' | 'ahead' | 'behind' | 'overdue'. slack = how far under the line still counts as ahead (CONFIG.GOAL_PACE_SLACK). */
    function paceFor(goal, progress, nowMs, slack, weekStartsOn) {
        if (!goal) return 'none';
        if (goal.completedAt) return 'done';
        const p = clamp01(progress);
        if (goal.kind === 'milestone') {
            const end = deadlineEndMs(goal);
            if (end === null) return 'none';
            if (nowMs >= end && p < 1 - EPS) return 'overdue';
        }
        const frac = elapsedFraction(goal, nowMs, weekStartsOn);
        if (frac === null) return 'none';
        const s = isNum(slack) && slack > 0 ? slack : 0;
        return p + EPS >= frac - s ? 'ahead' : 'behind';
    }

    // ---------------------------------------------------------------- goal objects

    function nextGoalId(goals) {
        return goals.nextId;
    }

    /**
     * One goal in its saved shape, or null when it cannot be one. `raw` carries the player's fields (and, when sanitizing a save, the
     * saved ones). ctx: { id (fallback), nowMs, weekStartsOn }.
     */
    function normalizeGoal(raw, ctx) {
        if (!raw || typeof raw !== 'object') return null;
        const c = ctx || {};
        if (KINDS.indexOf(raw.kind) === -1) return null;
        const kind = raw.kind;
        const period = kind === 'recurring' ? raw.period : null;
        if (kind === 'recurring' && PERIODS.indexOf(period) === -1) return null;
        const id = isInt(raw.id) && raw.id > 0 ? raw.id : (isInt(c.id) && c.id > 0 ? c.id : null);
        if (id === null) return null;
        const targets = normalizeTargets(raw.targets);
        if (targets.length === 0) return null;

        const nowMs = isNum(c.nowMs) ? c.nowMs : null;
        let periodKey = null;
        if (kind === 'recurring') {
            if (validKey(period, raw.periodKey)) periodKey = raw.periodKey;
            else if (nowMs !== null) periodKey = periodKeyFor(period, nowMs, c.weekStartsOn);
        }
        const streak = isInt(raw.streak) && raw.streak > 0 ? raw.streak : 0;
        const history = [];
        if (kind === 'recurring' && Array.isArray(raw.history)) {
            raw.history.slice(-HISTORY_SANE_MAX).forEach((h) => {
                if (h && typeof h === 'object' && typeof h.key === 'string') history.push({ key: h.key, met: h.met === true, progress: clamp01(h.progress) });
            });
        }
        const goal = {
            id,
            name: str(raw.name, NAME_MAX) || 'Goal',
            createdAt: isNum(raw.createdAt) && raw.createdAt >= 0 ? raw.createdAt : (nowMs !== null ? nowMs : 0),
            kind,
            period,
            deadline: kind === 'milestone' && parseDayKey(raw.deadline) ? raw.deadline : null,
            targets,
            stage: isNum(raw.stage) ? clamp(Math.floor(raw.stage), 0, MAX_STAGE) : 0,
            streak,
            bestStreak: Math.max(streak, isInt(raw.bestStreak) && raw.bestStreak > 0 ? raw.bestStreak : 0),
            periodsMet: isInt(raw.periodsMet) && raw.periodsMet > 0 ? raw.periodsMet : 0,
            periodKey,
            history,
            completedAt: isNum(raw.completedAt) ? raw.completedAt : null,
        };
        if (raw.suggested === true) goal.suggested = true;
        return goal;
    }

    /** A new goal from the player's fields (name, kind, period, deadline, targets). `id` is used unless fields.id is a valid id. */
    function newGoal(fields, nowMs, weekStartsOn, id) {
        return normalizeGoal(fields, { id, nowMs, weekStartsOn });
    }

    function freshGoals() {
        return { bestSlots: 0, active: [], done: [], nextId: 1, seeded: false };
    }

    function normalizeRecord(raw) {
        if (!raw || typeof raw !== 'object' || !isInt(raw.id) || raw.id <= 0) return null;
        const kind = KINDS.indexOf(raw.kind) !== -1 ? raw.kind : 'milestone';
        return {
            id: raw.id,
            name: str(raw.name, NAME_MAX) || 'Goal',
            kind,
            period: kind === 'recurring' && PERIODS.indexOf(raw.period) !== -1 ? raw.period : null,
            targets: Array.isArray(raw.targets) ? raw.targets.filter(x => typeof x === 'string').map(x => x.slice(0, LABEL_MAX)).slice(0, 20) : [],
            startedAt: isNum(raw.startedAt) ? raw.startedAt : 0,
            finishedAt: isNum(raw.finishedAt) ? raw.finishedAt : 0,
            periodsMet: isInt(raw.periodsMet) && raw.periodsMet > 0 ? raw.periodsMet : 0,
            bestStreak: isInt(raw.bestStreak) && raw.bestStreak > 0 ? raw.bestStreak : 0,
            runNights: isInt(raw.runNights) && raw.runNights > 0 ? raw.runNights : 0,
        };
    }

    /** Repairs whatever came out of a save (or an import) into a valid goals object. Idempotent; never throws. */
    function sanitizeGoals(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return freshGoals();
        const seen = new Set();
        const active = [];
        (Array.isArray(obj.active) ? obj.active : []).forEach((raw) => {
            const g = normalizeGoal(raw, {});
            if (!g || seen.has(g.id)) return;
            seen.add(g.id);
            active.push(g);
        });
        const done = [];
        (Array.isArray(obj.done) ? obj.done : []).forEach((raw) => {
            const r = normalizeRecord(raw);
            if (r) done.push(r);
        });
        const maxId = Math.max(0, ...active.map(g => g.id), ...done.map(r => r.id));
        return {
            bestSlots: sanitizeBestSlots(obj.bestSlots),
            active,
            done,
            nextId: Math.max(isInt(obj.nextId) && obj.nextId >= 1 ? obj.nextId : 1, maxId + 1),
            seeded: !!obj.seeded,
        };
    }

    /**
     * Puts a new goal in the next free slot. `slots` = how many the player has. Returns { ok, goals, reason }:
     * reason 'invalid' (no name, no targets, a bad kind or period) or 'full' (every slot used).
     */
    function addGoal(goals, fields, slots, nowMs, weekStartsOn) {
        const list = goals || freshGoals();
        if (!fields || typeof fields !== 'object' || !str(fields.name, NAME_MAX)) return { ok: false, goals: list, reason: 'invalid' };
        const goal = newGoal(Object.assign({}, fields, { id: list.nextId }), nowMs, weekStartsOn, list.nextId);
        if (!goal) return { ok: false, goals: list, reason: 'invalid' };
        if (list.active.length >= slots) return { ok: false, goals: list, reason: 'full' };
        return {
            ok: true,
            goal,
            goals: Object.assign({}, list, { active: list.active.concat([goal]), nextId: Math.max(list.nextId, goal.id) + 1 }),
        };
    }

    function removeGoal(goals, id) {
        if (!goals || !goals.active.some(g => g.id === id)) return goals;
        return Object.assign({}, goals, { active: goals.active.filter(g => g.id !== id) });
    }

    /**
     * The suggested goals a fresh save starts with. Fills only FREE slots (`slots`, default 2) and only once: `seeded` stays true after,
     * so a player who removed them never gets them back.
     */
    function seed(goals, starters, nowMs, weekStartsOn, slots) {
        const list = goals || freshGoals();
        if (list.seeded) return list;
        const room = Math.max(0, (isInt(slots) ? slots : 2) - list.active.length);
        let out = list;
        (Array.isArray(starters) ? starters : []).slice(0, room).forEach((s) => {
            const r = addGoal(out, Object.assign({}, s, { suggested: true }), Infinity, nowMs, weekStartsOn);
            if (r.ok) out = r.goals;
        });
        return Object.assign({}, out, { seeded: true });
    }

    // ---------------------------------------------------------------- linked-item counters

    /**
     * A task / habit was completed (dir +1) or un-completed (dir -1). info: { goalId, goalTargetId, type, definitionId, routineId } straight
     * off the item. A linked one-off moves its target's itemDone; an instance of a linked habit definition, or inside a linked routine, adds
     * an occurrence. Returns { goals, changed } and never mutates its input (an unchanged call returns the same object).
     */
    function applyCompletion(goals, info, dir) {
        if (!goals || !info || !dir) return { goals, changed: false };
        const step = dir > 0 ? 1 : -1;
        let any = false;
        const active = goals.active.map((goal) => {
            let goalChanged = false;
            const targets = goal.targets.map((t) => {
                if (t.type !== 'linked') return t;
                if (sameId(info.goalId, goal.id) && sameId(info.goalTargetId, t.id)) {
                    const next = clamp(t.itemDone + step, 0, t.itemTotal);
                    if (next === t.itemDone) return t;
                    goalChanged = true;
                    return Object.assign({}, t, { itemDone: next });
                }
                const viaHabit = info.type === 'habit' && t.habitDefIds.some(id => sameId(id, info.definitionId));
                const viaRoutine = info.routineId != null && t.routineIds.some(id => sameId(id, info.routineId));
                if (!viaHabit && !viaRoutine) return t;
                const next = Math.max(0, t.occ + step);
                if (next === t.occ) return t;
                goalChanged = true;
                return Object.assign({}, t, { occ: next });
            });
            if (!goalChanged) return goal;
            any = true;
            return Object.assign({}, goal, { targets });
        });
        if (!any) return { goals, changed: false };
        return { goals: Object.assign({}, goals, { active }), changed: true };
    }

    // ---------------------------------------------------------------- the period close (recurring goals)

    /** The targets as a fresh period starts: counters back to their start, flags cleared. */
    function resetTargets(targets) {
        return targets.map((t) => {
            if (t.type === 'number') return Object.assign({}, t, { current: t.start });
            if (t.type === 'bool') return Object.assign({}, t, { done: false });
            if (t.type === 'linked') return Object.assign({}, t, { occ: 0 });
            return t;
        });
    }

    /**
     * Settles every recurring-goal period that ended before `nowMs`, oldest first (an app closed for weeks closes each missed period in
     * order). Met = progress reached 1: stage +1 (max 5), streak +1. Missed: stage -1 (min 0), streak 0. The first closed period reads the
     * target counters the player built up; every later one starts from reset counters, so it can only be met by its daily records.
     * ctx: { nowMs, weekStartsOn, historyKeep, recordsFor(periodKey) -> { records, openKey }, metricValue }.
     * Returns { goal, outcomes: [{ key, met, progress, stageBefore, stageAfter, streakAfter }] }; the input is not mutated.
     */
    function closePeriods(goal, ctx) {
        const c = ctx || {};
        if (!goal || goal.kind !== 'recurring' || PERIODS.indexOf(goal.period) === -1) return { goal, outcomes: [] };
        const current = periodKeyFor(goal.period, c.nowMs, c.weekStartsOn);
        if (!current) return { goal, outcomes: [] };
        if (!validKey(goal.period, goal.periodKey)) {
            return { goal: Object.assign({}, goal, { periodKey: current }), outcomes: [] };
        }
        if (goal.periodKey >= current) return { goal, outcomes: [] };

        const keep = isInt(c.historyKeep) && c.historyKeep > 0 ? c.historyKeep : 26;
        let g = goal;
        let key = goal.periodKey;
        const outcomes = [];
        let steps = 0;
        while (key !== null && key < current && steps < MAX_CLOSE_STEPS) {
            const rc = (typeof c.recordsFor === 'function' ? c.recordsFor(key) : null) || { records: [], openKey: null };
            const progress = goalProgress(g, { records: rc.records, openKey: rc.openKey, metricValue: c.metricValue });
            const met = g.targets.length > 0 && progress >= 1 - EPS;
            const stageBefore = g.stage;
            const stageAfter = met ? Math.min(MAX_STAGE, stageBefore + 1) : Math.max(0, stageBefore - 1);
            const streak = met ? g.streak + 1 : 0;
            g = Object.assign({}, g, {
                stage: stageAfter,
                streak,
                bestStreak: Math.max(g.bestStreak, streak),
                periodsMet: g.periodsMet + (met ? 1 : 0),
                history: g.history.concat([{ key, met, progress }]).slice(-keep),
                targets: resetTargets(g.targets),
            });
            outcomes.push({ key, met, progress, stageBefore, stageAfter, streakAfter: streak });
            key = nextPeriodKey(g.period, key);
            steps++;
        }
        return { goal: Object.assign({}, g, { periodKey: current }), outcomes };
    }

    // ---------------------------------------------------------------- milestones: completion and the roster

    /** The roster card for a finished (or retired) goal. */
    function recordFor(goal, nowMs, runNights) {
        return {
            id: goal.id,
            name: goal.name,
            kind: goal.kind,
            period: goal.kind === 'recurring' ? goal.period : null,
            targets: goal.targets.map(t => t.label),
            startedAt: goal.createdAt,
            finishedAt: nowMs,
            periodsMet: goal.periodsMet,
            bestStreak: goal.bestStreak,
            runNights: isInt(runNights) && runNights > 0 ? runNights : 0,
        };
    }

    function pushRoster(done, record, keep) {
        const n = isInt(keep) && keep > 0 ? keep : 500;
        return [record].concat(done).slice(0, n);
    }

    /**
     * Brings every open milestone up to date: its stage follows progress (both ways), and when every target has reached 1 it completes
     * (stage 5, a roster record, the slot empties). Recurring goals are left to closePeriods. A late milestone still completes: a missed
     * deadline costs nothing. ctx: { recordsFor(goal) -> { records, openKey }, metricValue, nowMs, runNights, rosterKeep }.
     * Returns { goals, completed: GoalRecord[], changed }.
     */
    function settleMilestones(goals, ctx) {
        const c = ctx || {};
        if (!goals || !Array.isArray(goals.active)) return { goals, completed: [], changed: false };
        const completed = [];
        let done = goals.done;
        let changed = false;
        const active = [];
        goals.active.forEach((goal) => {
            if (goal.kind !== 'milestone' || goal.completedAt) { active.push(goal); return; }
            const rc = (typeof c.recordsFor === 'function' ? c.recordsFor(goal) : null) || { records: [], openKey: null };
            const progress = goalProgress(goal, { records: rc.records, openKey: rc.openKey, metricValue: c.metricValue });
            if (goal.targets.length > 0 && progress >= 1 - EPS) {
                const record = recordFor(goal, c.nowMs, c.runNights);
                completed.push(record);
                done = pushRoster(done, record, c.rosterKeep);
                changed = true;
                return;
            }
            const stage = stageFor(goal, progress);
            if (stage !== goal.stage) {
                changed = true;
                active.push(Object.assign({}, goal, { stage }));
            } else {
                active.push(goal);
            }
        });
        if (!changed) return { goals, completed: [], changed: false };
        return { goals: Object.assign({}, goals, { active, done }), completed, changed: true };
    }

    /** The player retires a goal (a recurring one, usually): it moves to the roster. Returns { goals, record }. */
    function retireGoal(goals, id, nowMs, runNights, rosterKeep) {
        const goal = goals && goals.active.find(g => g.id === id);
        if (!goal) return { goals, record: null };
        const record = recordFor(goal, nowMs, runNights);
        return {
            goals: Object.assign({}, goals, { active: goals.active.filter(g => g.id !== id), done: pushRoster(goals.done, record, rosterKeep) }),
            record,
        };
    }

    return {
        KINDS, PERIODS, TARGET_TYPES, MAX_STAGE,
        sanitizeBestSlots, slotsAtLevel,
        dateKey, periodKeyFor, periodStart, periodEnd, nextPeriodKey, periodDayKeys, validKey,
        targetProgress, goalProgress, stageFor, elapsedFraction, paceFor,
        freshGoals, newGoal, sanitizeGoals, addGoal, removeGoal, seed, nextGoalId,
        applyCompletion, closePeriods, settleMilestones, retireGoal, recordFor,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Goals;
}

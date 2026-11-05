/**
 * Goals, Build A (2026-11-05, Jeremy; docs/GOALS_PLAN.md; DECISIONS 2026-11-04 (goals)): the pure rules in js/goals.js.
 * Slots that never regress, period keys, target progress, stages, pace, linked-item counters, the period close
 * (one stage up per period met, one down per period missed), milestone completion, the roster, the starters.
 */
const Goals = require('../js/goals.js');

const at = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi, 0, 0);
const MS = (date) => date.getTime();
const NOW = at(2026, 11, 5); // Thursday 2026-11-05
const SLOT_TABLE = { 1: 2, 2: 3, 3: 3, 4: 4, 5: 4, 6: 5, 7: 5, 8: 6, 9: 6 };

// The metric lookup the caller injects (js/goalMetrics.js owns the real one).
const metricValue = (rec, metricId) => {
    if (!rec) return 0;
    const v = rec.m && rec.m[metricId];
    return typeof v === 'number' ? v : 0;
};
const day = (date, m) => ({ date, m });

function numberTarget(over) {
    return Object.assign({ id: 1, type: 'number', label: 'Steps', start: 0, end: 10, current: 0, unit: 'steps' }, over);
}
function aggTarget(over) {
    return Object.assign({ id: 1, type: 'aggregate', label: 'agg', metric: 'tasksDone', op: 'sum', threshold: 3, compare: 'gte', count: 1 }, over);
}
function linkedTarget(over) {
    return Object.assign({ id: 1, type: 'linked', label: 'linked', itemTotal: 0, itemDone: 0, habitDefIds: [], routineIds: [], count: 1, occ: 0 }, over);
}
function milestone(targets, over) {
    return Goals.newGoal(Object.assign({ name: 'Big', kind: 'milestone', targets }, over), MS(at(2026, 11, 1)), 1, 1);
}
function recurring(targets, over) {
    return Goals.newGoal(Object.assign({ name: 'Weekly', kind: 'recurring', period: 'week', targets }, over), MS(at(2026, 11, 2)), 1, 1);
}

describe('slots', () => {
    test('slotsAtLevel is the table value, never below the best ever held', () => {
        expect(Goals.slotsAtLevel(1, SLOT_TABLE, 0)).toBe(2);
        expect(Goals.slotsAtLevel(4, SLOT_TABLE, 0)).toBe(4);
        expect(Goals.slotsAtLevel(8, SLOT_TABLE, 0)).toBe(6);
        // a lost run drops the level back to 1, but the best stays
        expect(Goals.slotsAtLevel(1, SLOT_TABLE, 6)).toBe(6);
        expect(Goals.slotsAtLevel(5, SLOT_TABLE, 3)).toBe(4);
    });
    test('an unknown level or a junk table falls back to at least 1 slot', () => {
        expect(Goals.slotsAtLevel(99, SLOT_TABLE, 0)).toBe(1);
        expect(Goals.slotsAtLevel(3, null, 0)).toBe(1);
        expect(Goals.slotsAtLevel(3, null, 'x')).toBe(1);
    });
    test('sanitizeBestSlots keeps a positive whole number, everything else is 0', () => {
        expect(Goals.sanitizeBestSlots(4.9)).toBe(4);
        expect(Goals.sanitizeBestSlots(-1)).toBe(0);
        expect(Goals.sanitizeBestSlots('3')).toBe(0);
        expect(Goals.sanitizeBestSlots(NaN)).toBe(0);
        expect(Goals.sanitizeBestSlots(undefined)).toBe(0);
    });
    test('the ladder in CONFIG has an entry for every level and never decreases', () => {
        const CONFIG = require('../js/config.js');
        const t = CONFIG.GOAL_SLOTS_PER_LEVEL;
        let prev = 0;
        for (let lvl = 1; lvl <= CONFIG.LEVEL_XP_THRESHOLDS.length; lvl++) {
            expect(typeof t[lvl]).toBe('number');
            expect(t[lvl]).toBeGreaterThanOrEqual(prev);
            prev = t[lvl];
        }
        expect(t[1]).toBe(2);
        expect(t[8]).toBe(6);
    });
    test('a goal slot never shares a level-up with a routine slot (even levels vs odd)', () => {
        const CONFIG = require('../js/config.js');
        for (let lvl = 2; lvl <= CONFIG.LEVEL_XP_THRESHOLDS.length; lvl++) {
            const goalUp = CONFIG.GOAL_SLOTS_PER_LEVEL[lvl] > CONFIG.GOAL_SLOTS_PER_LEVEL[lvl - 1];
            const routineUp = CONFIG.ROUTINE_SLOTS_PER_LEVEL[lvl] > CONFIG.ROUTINE_SLOTS_PER_LEVEL[lvl - 1];
            expect(goalUp && routineUp).toBe(false);
        }
    });
});

describe('period keys', () => {
    test('day, month and week keys (week = the week-start day, Monday)', () => {
        expect(Goals.periodKeyFor('day', at(2026, 11, 5), 1)).toBe('2026-11-05');
        expect(Goals.periodKeyFor('month', at(2026, 11, 5), 1)).toBe('2026-11');
        expect(Goals.periodKeyFor('week', at(2026, 11, 5), 1)).toBe('2026-11-02'); // Thu -> Mon
        expect(Goals.periodKeyFor('week', at(2026, 11, 2), 1)).toBe('2026-11-02'); // Monday itself
        expect(Goals.periodKeyFor('week', at(2026, 11, 8), 1)).toBe('2026-11-02'); // Sunday still that week
        expect(Goals.periodKeyFor('week', at(2026, 11, 9), 1)).toBe('2026-11-09');
    });
    test('a Sunday week start moves the boundary', () => {
        expect(Goals.periodKeyFor('week', at(2026, 11, 5), 0)).toBe('2026-11-01');
        expect(Goals.periodKeyFor('week', at(2026, 11, 1), 0)).toBe('2026-11-01');
    });
    test('week keys cross month and year boundaries', () => {
        expect(Goals.periodKeyFor('week', at(2026, 1, 1), 1)).toBe('2025-12-29');
        expect(Goals.periodKeyFor('week', at(2026, 3, 1), 1)).toBe('2026-02-23');
    });
    test('nextPeriodKey', () => {
        expect(Goals.nextPeriodKey('day', '2026-11-30')).toBe('2026-12-01');
        expect(Goals.nextPeriodKey('day', '2026-12-31')).toBe('2027-01-01');
        expect(Goals.nextPeriodKey('week', '2026-11-02')).toBe('2026-11-09');
        expect(Goals.nextPeriodKey('week', '2026-12-28')).toBe('2027-01-04');
        expect(Goals.nextPeriodKey('month', '2026-12')).toBe('2027-01');
        expect(Goals.nextPeriodKey('month', '2026-11')).toBe('2026-12');
    });
    test('periodDayKeys lists every local day of the period', () => {
        expect(Goals.periodDayKeys('day', '2026-11-05')).toEqual(['2026-11-05']);
        expect(Goals.periodDayKeys('week', '2026-11-02')).toEqual(
            ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
        expect(Goals.periodDayKeys('month', '2026-02')).toHaveLength(28);
        expect(Goals.periodDayKeys('month', '2026-11')[29]).toBe('2026-11-30');
        expect(Goals.periodDayKeys('month', '2026-11')).toHaveLength(30);
    });
    test('periodStart / periodEnd are local midnights (end is exclusive)', () => {
        const s = Goals.periodStart('week', '2026-11-02');
        const e = Goals.periodEnd('week', '2026-11-02');
        expect(s.getDate()).toBe(2);
        expect(s.getHours()).toBe(0);
        expect(e.getDate()).toBe(9);
        expect(e.getMonth()).toBe(10);
    });
    test('junk input does not throw', () => {
        expect(Goals.periodKeyFor('decade', NOW, 1)).toBe(null);
        expect(Goals.periodDayKeys('week', 'nonsense')).toEqual([]);
        expect(Goals.nextPeriodKey('week', 'nonsense')).toBe(null);
    });
});

describe('target progress', () => {
    const ctx = { records: [], openKey: null, metricValue };

    test('number counts up and down through its range, clamped', () => {
        expect(Goals.targetProgress(numberTarget({ current: 0 }), ctx)).toBe(0);
        expect(Goals.targetProgress(numberTarget({ current: 5 }), ctx)).toBe(0.5);
        expect(Goals.targetProgress(numberTarget({ current: 12 }), ctx)).toBe(1);
        expect(Goals.targetProgress(numberTarget({ current: -3 }), ctx)).toBe(0);
        // counting down: 200 -> 180
        const down = numberTarget({ start: 200, end: 180, current: 190 });
        expect(Goals.targetProgress(down, ctx)).toBe(0.5);
        expect(Goals.targetProgress(Object.assign({}, down, { current: 180 }), ctx)).toBe(1);
        expect(Goals.targetProgress(Object.assign({}, down, { current: 210 }), ctx)).toBe(0);
    });
    test('a number target with start === end is met only at the value', () => {
        expect(Goals.targetProgress(numberTarget({ start: 5, end: 5, current: 5 }), ctx)).toBe(1);
        expect(Goals.targetProgress(numberTarget({ start: 5, end: 5, current: 4 }), ctx)).toBe(0);
    });
    test('bool is 0 or 1', () => {
        expect(Goals.targetProgress({ id: 1, type: 'bool', label: 'x', done: false }, ctx)).toBe(0);
        expect(Goals.targetProgress({ id: 1, type: 'bool', label: 'x', done: true }, ctx)).toBe(1);
    });
    test('an unknown target type counts for nothing', () => {
        expect(Goals.targetProgress({ id: 1, type: 'wat' }, ctx)).toBe(0);
        expect(Goals.targetProgress(null, ctx)).toBe(0);
    });

    describe('linked', () => {
        test('milestone: linked one-offs done over linked one-offs', () => {
            const g = milestone([linkedTarget({ itemTotal: 4, itemDone: 1 })]);
            expect(Goals.targetProgress(g.targets[0], Object.assign({ kind: 'milestone' }, ctx))).toBe(0.25);
        });
        test('milestone: habit / routine occurrences count toward `count`', () => {
            const t = linkedTarget({ habitDefIds: ['h1'], count: 10, occ: 4 });
            expect(Goals.targetProgress(t, { kind: 'milestone', metricValue })).toBe(0.4);
        });
        test('milestone: one-offs and occurrences combine', () => {
            const t = linkedTarget({ itemTotal: 2, itemDone: 2, routineIds: ['r1'], count: 8, occ: 2 });
            // done = 2 + min(2, 8) = 4 of needed = 2 + 8 = 10
            expect(Goals.targetProgress(t, { kind: 'milestone', metricValue })).toBeCloseTo(0.4, 9);
        });
        test('milestone: occurrences beyond `count` are capped, progress never exceeds 1', () => {
            const t = linkedTarget({ habitDefIds: ['h1'], count: 3, occ: 9 });
            expect(Goals.targetProgress(t, { kind: 'milestone', metricValue })).toBe(1);
        });
        test('milestone: nothing linked is 0, never NaN', () => {
            expect(Goals.targetProgress(linkedTarget({}), { kind: 'milestone', metricValue })).toBe(0);
        });
        test('recurring: occurrences this period over `count`; one-offs are ignored', () => {
            const t = linkedTarget({ itemTotal: 5, itemDone: 5, habitDefIds: ['h1'], count: 4, occ: 3 });
            expect(Goals.targetProgress(t, { kind: 'recurring', metricValue })).toBe(0.75);
        });
    });

    describe('aggregate', () => {
        const recs = [day('2026-11-02', { tasksDone: 3 }), day('2026-11-03', { tasksDone: 1 }), day('2026-11-04', { tasksDone: 4 })];
        test('sum gte: total over threshold, capped at 1', () => {
            expect(Goals.targetProgress(aggTarget({ op: 'sum', threshold: 16 }), { records: recs, metricValue })).toBe(0.5);
            expect(Goals.targetProgress(aggTarget({ op: 'sum', threshold: 4 }), { records: recs, metricValue })).toBe(1);
        });
        test('sum lte: stay at or under the threshold (binary)', () => {
            const t = aggTarget({ metric: 'damage', op: 'sum', compare: 'lte', threshold: 2 });
            expect(Goals.targetProgress(t, { records: [day('a', { damage: 1 }), day('b', { damage: 1 })], metricValue })).toBe(1);
            expect(Goals.targetProgress(t, { records: [day('a', { damage: 2 }), day('b', { damage: 1 })], metricValue })).toBe(0);
        });
        test('sum lte with threshold 0 is "no damage this period"', () => {
            const t = aggTarget({ metric: 'damage', op: 'sum', compare: 'lte', threshold: 0 });
            expect(Goals.targetProgress(t, { records: [day('a', { damage: 0 })], metricValue })).toBe(1);
            expect(Goals.targetProgress(t, { records: [day('a', { damage: 1 })], metricValue })).toBe(0);
            expect(Goals.targetProgress(t, { records: [], metricValue })).toBe(1);
        });
        test('days gte: days where the metric reaches the threshold, over `count` days', () => {
            // "finish 3 tasks on 2 days": only 11-02 (3) and 11-04 (4) reach 3
            const t = aggTarget({ op: 'days', threshold: 3, compare: 'gte', count: 2 });
            expect(Goals.targetProgress(t, { records: recs, metricValue })).toBe(1);
            const t3 = aggTarget({ op: 'days', threshold: 3, compare: 'gte', count: 4 });
            expect(Goals.targetProgress(t3, { records: recs, metricValue })).toBe(0.5);
        });
        test('days lte skips the OPEN day (a day that is not over cannot count as damage-free yet)', () => {
            const t = aggTarget({ metric: 'damage', op: 'days', threshold: 0, compare: 'lte', count: 3 });
            const rs = [day('2026-11-02', { damage: 0 }), day('2026-11-03', { damage: 5 }), day('2026-11-04', { damage: 0 })];
            expect(Goals.targetProgress(t, { records: rs, openKey: '2026-11-04', metricValue })).toBeCloseTo(1 / 3, 9);
            expect(Goals.targetProgress(t, { records: rs, openKey: null, metricValue })).toBeCloseTo(2 / 3, 9);
        });
        test('days gte DOES count the open day (progress made today is real)', () => {
            const t = aggTarget({ op: 'days', threshold: 3, compare: 'gte', count: 1 });
            expect(Goals.targetProgress(t, { records: [day('2026-11-05', { tasksDone: 3 })], openKey: '2026-11-05', metricValue })).toBe(1);
        });
        test('a missing metricValue function counts as 0, not a crash', () => {
            expect(Goals.targetProgress(aggTarget({ op: 'sum', threshold: 3 }), { records: recs })).toBe(0);
        });
        test('gte with a zero threshold is trivially met', () => {
            expect(Goals.targetProgress(aggTarget({ op: 'sum', threshold: 0 }), { records: [], metricValue })).toBe(1);
        });
    });
});

describe('goalProgress / stageFor', () => {
    test('progress is the mean of the targets', () => {
        const g = milestone([numberTarget({ id: 1, current: 10 }), numberTarget({ id: 2, current: 0 })]);
        expect(Goals.goalProgress(g, { metricValue })).toBe(0.5);
    });
    test('a goal with no targets has progress 0', () => {
        expect(Goals.goalProgress(milestone([]), { metricValue })).toBe(0);
    });
    test('milestone stage = floor(progress * 5), capped at 4 while open', () => {
        const g = milestone([numberTarget()]);
        expect(Goals.stageFor(g, 0)).toBe(0);
        expect(Goals.stageFor(g, 0.19)).toBe(0);
        expect(Goals.stageFor(g, 0.2)).toBe(1);
        expect(Goals.stageFor(g, 0.6)).toBe(3);
        expect(Goals.stageFor(g, 0.99)).toBe(4);
        expect(Goals.stageFor(g, 1)).toBe(4); // complete is the settle step, not a progress number
    });
    test('a completed milestone is stage 5', () => {
        const g = Object.assign(milestone([numberTarget()]), { completedAt: 123 });
        expect(Goals.stageFor(g, 1)).toBe(5);
    });
    test('a recurring goal shows its stored ladder, clamped 0..5', () => {
        expect(Goals.stageFor(recurring([numberTarget()], { stage: 3 }), 0)).toBe(3);
        expect(Goals.stageFor(recurring([numberTarget()], { stage: 9 }), 0)).toBe(5);
        expect(Goals.stageFor(recurring([numberTarget()], { stage: -2 }), 0)).toBe(0);
    });
});

describe('pace', () => {
    test('a recurring goal is ahead when progress keeps up with the elapsed share of the period', () => {
        const g = recurring([numberTarget()]); // week of 11-02; Thursday noon = 3.5 of 7 days
        expect(Goals.elapsedFraction(g, MS(at(2026, 11, 5, 12)), 1)).toBeCloseTo(3.5 / 7, 6);
        expect(Goals.paceFor(g, 0.6, MS(at(2026, 11, 5, 12)), 0.1, 1)).toBe('ahead');
        expect(Goals.paceFor(g, 0.45, MS(at(2026, 11, 5, 12)), 0.1, 1)).toBe('ahead'); // inside the slack
        expect(Goals.paceFor(g, 0.3, MS(at(2026, 11, 5, 12)), 0.1, 1)).toBe('behind');
    });
    test('a milestone with a deadline: line from createdAt to the end of the deadline day', () => {
        const g = milestone([numberTarget()], { deadline: '2026-11-11' }); // created 11-01 noon, ends 11-12 00:00
        const f = Goals.elapsedFraction(g, MS(at(2026, 11, 6, 12)), 1);
        expect(f).toBeGreaterThan(0.4);
        expect(f).toBeLessThan(0.6);
        expect(Goals.paceFor(g, 0.9, MS(at(2026, 11, 6, 12)), 0.1, 1)).toBe('ahead');
        expect(Goals.paceFor(g, 0.1, MS(at(2026, 11, 6, 12)), 0.1, 1)).toBe('behind');
    });
    test('a milestone with no deadline has no pace', () => {
        const g = milestone([numberTarget()]);
        expect(Goals.elapsedFraction(g, NOW.getTime(), 1)).toBe(null);
        expect(Goals.paceFor(g, 0.5, NOW.getTime(), 0.1, 1)).toBe('none');
    });
    test('a milestone past its deadline and not done is overdue; a done one is done', () => {
        const g = milestone([numberTarget()], { deadline: '2026-11-03' });
        expect(Goals.paceFor(g, 0.5, NOW.getTime(), 0.1, 1)).toBe('overdue');
        const done = Object.assign({}, g, { completedAt: 5 });
        expect(Goals.paceFor(done, 1, NOW.getTime(), 0.1, 1)).toBe('done');
    });
});

describe('goal lists', () => {
    test('freshGoals shape', () => {
        expect(Goals.freshGoals()).toEqual({ bestSlots: 0, active: [], done: [], nextId: 1, seeded: false });
    });
    test('newGoal fills the defaults and assigns target ids', () => {
        const g = Goals.newGoal({
            name: '  Read  ', kind: 'recurring', period: 'day',
            targets: [{ type: 'bool', label: 'Read today' }, { type: 'number', label: 'Pages', start: 0, end: 20 }],
        }, MS(at(2026, 11, 5, 8)), 1, 7);
        expect(g.id).toBe(7);
        expect(g.name).toBe('Read');
        expect(g.kind).toBe('recurring');
        expect(g.period).toBe('day');
        expect(g.deadline).toBe(null);
        expect(g.stage).toBe(0);
        expect(g.streak).toBe(0);
        expect(g.periodKey).toBe('2026-11-05');
        expect(g.history).toEqual([]);
        expect(g.completedAt).toBe(null);
        expect(g.targets.map(t => t.id)).toEqual([1, 2]);
        expect(g.targets[0]).toMatchObject({ type: 'bool', done: false });
        expect(g.targets[1]).toMatchObject({ type: 'number', start: 0, end: 20, current: 0 });
    });
    test('a milestone has no period and no periodKey', () => {
        const g = milestone([numberTarget()]);
        expect(g.period).toBe(null);
        expect(g.periodKey).toBe(null);
    });
    test('addGoal fills the next slot, refuses when full or invalid', () => {
        let goals = Object.assign(Goals.freshGoals(), { bestSlots: 2 });
        const g1 = { name: 'A', kind: 'milestone', targets: [{ type: 'bool', label: 'x' }] };
        let r = Goals.addGoal(goals, g1, 2, MS(NOW), 1);
        expect(r.ok).toBe(true);
        expect(r.goals.active).toHaveLength(1);
        expect(r.goals.nextId).toBe(2);
        expect(r.goals.active[0].id).toBe(1);
        r = Goals.addGoal(r.goals, g1, 2, MS(NOW), 1);
        expect(r.ok).toBe(true);
        expect(r.goals.active.map(g => g.id)).toEqual([1, 2]);
        r = Goals.addGoal(r.goals, g1, 2, MS(NOW), 1);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('full');
        // invalid: no name, no target, bad kind
        expect(Goals.addGoal(goals, { name: '', kind: 'milestone', targets: [{ type: 'bool', label: 'x' }] }, 2, MS(NOW), 1).reason).toBe('invalid');
        expect(Goals.addGoal(goals, { name: 'A', kind: 'milestone', targets: [] }, 2, MS(NOW), 1).reason).toBe('invalid');
        expect(Goals.addGoal(goals, { name: 'A', kind: 'nope', targets: [{ type: 'bool', label: 'x' }] }, 2, MS(NOW), 1).reason).toBe('invalid');
        expect(Goals.addGoal(goals, { name: 'A', kind: 'recurring', period: null, targets: [{ type: 'bool', label: 'x' }] }, 2, MS(NOW), 1).reason).toBe('invalid');
    });
    test('removeGoal drops one by id and leaves the rest in slot order', () => {
        let goals = Goals.freshGoals();
        const t = [{ type: 'bool', label: 'x' }];
        goals = Goals.addGoal(goals, { name: 'A', kind: 'milestone', targets: t }, 6, MS(NOW), 1).goals;
        goals = Goals.addGoal(goals, { name: 'B', kind: 'milestone', targets: t }, 6, MS(NOW), 1).goals;
        goals = Goals.addGoal(goals, { name: 'C', kind: 'milestone', targets: t }, 6, MS(NOW), 1).goals;
        const out = Goals.removeGoal(goals, 2);
        expect(out.active.map(g => g.name)).toEqual(['A', 'C']);
        expect(Goals.removeGoal(goals, 99).active).toHaveLength(3);
    });
    test('sanitizeGoals repairs junk and keeps good data', () => {
        expect(Goals.sanitizeGoals(null)).toEqual(Goals.freshGoals());
        expect(Goals.sanitizeGoals('x')).toEqual(Goals.freshGoals());
        const s = Goals.sanitizeGoals({ bestSlots: 3.7, nextId: 'no', seeded: 1, active: [null, 5, { id: 2, name: 'Keep', kind: 'milestone', targets: [{ type: 'bool', label: 'x', done: true }] }], done: 'no' });
        expect(s.bestSlots).toBe(3);
        expect(s.nextId).toBeGreaterThan(2); // above every id in use
        expect(s.seeded).toBe(true);
        expect(s.active).toHaveLength(1);
        expect(s.active[0].name).toBe('Keep');
        expect(s.active[0].targets[0].done).toBe(true);
        expect(s.done).toEqual([]);
    });
    test('sanitizeGoals drops goals with a bad kind or no targets, and clamps stage / streak', () => {
        const s = Goals.sanitizeGoals({
            active: [
                { id: 1, name: 'x', kind: 'wat', targets: [{ type: 'bool', label: 'x' }] },
                { id: 2, name: 'y', kind: 'milestone', targets: [] },
                { id: 3, name: 'z', kind: 'recurring', period: 'week', stage: 99, streak: -4, targets: [{ type: 'bool', label: 'x' }] },
            ],
        });
        expect(s.active.map(g => g.id)).toEqual([3]);
        expect(s.active[0].stage).toBe(5);
        expect(s.active[0].streak).toBe(0);
    });
    test('sanitizeGoals ignores duplicate ids and unknown target types', () => {
        const s = Goals.sanitizeGoals({
            active: [
                { id: 1, name: 'a', kind: 'milestone', targets: [{ type: 'bool', label: 'x' }, { type: 'zzz' }] },
                { id: 1, name: 'dup', kind: 'milestone', targets: [{ type: 'bool', label: 'x' }] },
            ],
        });
        expect(s.active).toHaveLength(1);
        expect(s.active[0].targets).toHaveLength(1);
    });
    test('sanitizeGoals is idempotent', () => {
        let goals = Goals.freshGoals();
        goals = Goals.addGoal(goals, { name: 'A', kind: 'recurring', period: 'week', targets: [{ type: 'number', label: 'n', start: 0, end: 5 }] }, 6, MS(NOW), 1).goals;
        const once = Goals.sanitizeGoals(JSON.parse(JSON.stringify(goals)));
        expect(Goals.sanitizeGoals(once)).toEqual(once);
        expect(once).toEqual(goals);
    });
});

describe('linked-item counters (applyCompletion)', () => {
    function withGoals(...gs) {
        return Object.assign(Goals.freshGoals(), { active: gs, nextId: 99 });
    }
    test('a linked one-off done / undone moves itemDone, never below 0 or above the total', () => {
        const g = milestone([linkedTarget({ itemTotal: 2, itemDone: 0 })], { id: 5 });
        const goals = withGoals(g);
        let r = Goals.applyCompletion(goals, { goalId: 5, goalTargetId: 1, type: 'task' }, 1);
        expect(r.changed).toBe(true);
        expect(r.goals.active[0].targets[0].itemDone).toBe(1);
        r = Goals.applyCompletion(r.goals, { goalId: 5, goalTargetId: 1, type: 'task' }, 1);
        r = Goals.applyCompletion(r.goals, { goalId: 5, goalTargetId: 1, type: 'task' }, 1);
        expect(r.goals.active[0].targets[0].itemDone).toBe(2);
        r = Goals.applyCompletion(r.goals, { goalId: 5, goalTargetId: 1, type: 'task' }, -1);
        expect(r.goals.active[0].targets[0].itemDone).toBe(1);
        const z = Goals.applyCompletion(withGoals(g), { goalId: 5, goalTargetId: 1, type: 'task' }, -1);
        expect(z.goals.active[0].targets[0].itemDone).toBe(0);
    });
    test('it does not mutate the goals it was given', () => {
        const g = milestone([linkedTarget({ itemTotal: 2 })], { id: 5 });
        const goals = withGoals(g);
        const snapshot = JSON.stringify(goals);
        Goals.applyCompletion(goals, { goalId: 5, goalTargetId: 1, type: 'task' }, 1);
        expect(JSON.stringify(goals)).toBe(snapshot);
    });
    test('a habit instance of a linked habit definition adds an occurrence', () => {
        const g = recurring([linkedTarget({ habitDefIds: ['h1'], count: 3 })], { id: 5 });
        let r = Goals.applyCompletion(withGoals(g), { type: 'habit', definitionId: 'h1' }, 1);
        expect(r.changed).toBe(true);
        expect(r.goals.active[0].targets[0].occ).toBe(1);
        r = Goals.applyCompletion(r.goals, { type: 'habit', definitionId: 'h1' }, -1);
        expect(r.goals.active[0].targets[0].occ).toBe(0);
        r = Goals.applyCompletion(r.goals, { type: 'habit', definitionId: 'h1' }, -1);
        expect(r.goals.active[0].targets[0].occ).toBe(0); // never negative
    });
    test('an item inside a linked routine adds an occurrence', () => {
        const g = recurring([linkedTarget({ routineIds: ['routine_0_1'], count: 5 })], { id: 5 });
        const r = Goals.applyCompletion(withGoals(g), { type: 'task', definitionId: 't1', routineId: 'routine_0_1' }, 1);
        expect(r.goals.active[0].targets[0].occ).toBe(1);
    });
    test('an unrelated completion changes nothing', () => {
        const g = recurring([linkedTarget({ habitDefIds: ['h1'], count: 3 })], { id: 5 });
        const goals = withGoals(g);
        const r = Goals.applyCompletion(goals, { type: 'habit', definitionId: 'other' }, 1);
        expect(r.changed).toBe(false);
        expect(r.goals).toBe(goals);
    });
    test('one completion can count toward two goals', () => {
        const a = recurring([linkedTarget({ habitDefIds: ['h1'], count: 3 })], { id: 5 });
        const b = milestone([linkedTarget({ habitDefIds: ['h1'], count: 10 })], { id: 6 });
        const r = Goals.applyCompletion(withGoals(a, b), { type: 'habit', definitionId: 'h1' }, 1);
        expect(r.goals.active.map(g => g.targets[0].occ)).toEqual([1, 1]);
    });
    test('a one-off link does not also count as an occurrence on the same target', () => {
        const g = milestone([linkedTarget({ itemTotal: 1, habitDefIds: ['h1'], count: 5 })], { id: 5 });
        const r = Goals.applyCompletion(withGoals(g), { goalId: 5, goalTargetId: 1, type: 'task', definitionId: undefined }, 1);
        expect(r.goals.active[0].targets[0]).toMatchObject({ itemDone: 1, occ: 0 });
    });
    test('a bool / number / aggregate target is never touched by a completion', () => {
        const g = milestone([numberTarget({ current: 3 })], { id: 5 });
        const r = Goals.applyCompletion(withGoals(g), { goalId: 5, goalTargetId: 1, type: 'task' }, 1);
        expect(r.changed).toBe(false);
    });
});

describe('closePeriods (the ladder: one up per period met, one down per period missed)', () => {
    const noRecords = () => ({ records: [], openKey: null });
    const base = (over) => Object.assign({ nowMs: MS(at(2026, 11, 9, 8)), weekStartsOn: 1, historyKeep: 26, recordsFor: noRecords, metricValue }, over);

    test('a period still open does nothing', () => {
        const g = recurring([numberTarget({ current: 10 })], { stage: 2, streak: 1 });
        const r = Goals.closePeriods(g, base({ nowMs: MS(at(2026, 11, 5)) }));
        expect(r.goal).toBe(g);
        expect(r.outcomes).toEqual([]);
    });
    test('a met period climbs one stage, extends the streak, records history, resets the counters', () => {
        const g = recurring([numberTarget({ current: 10 })], { stage: 2, streak: 1 });
        const r = Goals.closePeriods(g, base());
        expect(r.outcomes).toHaveLength(1);
        expect(r.outcomes[0]).toMatchObject({ key: '2026-11-02', met: true, stageBefore: 2, stageAfter: 3 });
        expect(r.goal.stage).toBe(3);
        expect(r.goal.streak).toBe(2);
        expect(r.goal.bestStreak).toBe(2);
        expect(r.goal.periodsMet).toBe(1);
        expect(r.goal.periodKey).toBe('2026-11-09');
        expect(r.goal.history).toEqual([{ key: '2026-11-02', met: true, progress: 1 }]);
        expect(r.goal.targets[0].current).toBe(0); // the counter starts the new period at its start
    });
    test('a missed period drops ONE stage (never to zero) and ends the streak', () => {
        const g = recurring([numberTarget({ current: 4 })], { stage: 4, streak: 6, bestStreak: 6 });
        const r = Goals.closePeriods(g, base());
        expect(r.outcomes[0]).toMatchObject({ met: false, stageBefore: 4, stageAfter: 3 });
        expect(r.goal.stage).toBe(3);
        expect(r.goal.streak).toBe(0);
        expect(r.goal.bestStreak).toBe(6);
        expect(r.goal.history[0]).toMatchObject({ met: false });
        expect(r.goal.history[0].progress).toBeCloseTo(0.4, 9);
    });
    test('the stage stays inside 0..5', () => {
        const top = Goals.closePeriods(recurring([numberTarget({ current: 10 })], { stage: 5 }), base());
        expect(top.goal.stage).toBe(5);
        const bottom = Goals.closePeriods(recurring([numberTarget({ current: 0 })], { stage: 0 }), base());
        expect(bottom.goal.stage).toBe(0);
    });
    test('offline: every missed period closes in order, the first from the stored counters, the rest from records', () => {
        // Last worked week was 11-02 (met). The app was closed through weeks 11-09 and 11-16; now is 11-24 (week 11-23 open).
        const g = recurring([aggTarget({ metric: 'tasksDone', op: 'sum', threshold: 3, compare: 'gte', count: 1 })], { stage: 2, periodKey: '2026-11-02' });
        const recordsFor = (key) => {
            if (key === '2026-11-02') return { records: [day('2026-11-03', { tasksDone: 5 })], openKey: null };
            if (key === '2026-11-09') return { records: [], openKey: null };
            if (key === '2026-11-16') return { records: [day('2026-11-17', { tasksDone: 3 })], openKey: null };
            return { records: [], openKey: null };
        };
        const r = Goals.closePeriods(g, base({ nowMs: MS(at(2026, 11, 24, 9)), recordsFor }));
        expect(r.outcomes.map(o => [o.key, o.met])).toEqual([['2026-11-02', true], ['2026-11-09', false], ['2026-11-16', true]]);
        expect(r.goal.stage).toBe(3); // 2 -> 3 -> 2 -> 3
        expect(r.goal.streak).toBe(1);
        expect(r.goal.bestStreak).toBe(1);
        expect(r.goal.periodKey).toBe('2026-11-23');
    });
    test('a number target reset applies to the new period; later missed periods have nothing carried over', () => {
        const g = recurring([numberTarget({ current: 10 })], { stage: 1, periodKey: '2026-11-02' });
        const r = Goals.closePeriods(g, base({ nowMs: MS(at(2026, 11, 17)) })); // closes 11-02 (met) and 11-09 (empty -> missed)
        expect(r.outcomes.map(o => o.met)).toEqual([true, false]);
        expect(r.goal.stage).toBe(1); // up then down
    });
    test('linked occurrences count the closing period, then restart at zero', () => {
        const g = recurring([linkedTarget({ habitDefIds: ['h1'], count: 3, occ: 3 })], { stage: 0 });
        const r = Goals.closePeriods(g, base());
        expect(r.outcomes[0].met).toBe(true);
        expect(r.goal.targets[0].occ).toBe(0);
    });
    test('a bool target resets to not done', () => {
        const g = recurring([{ id: 1, type: 'bool', label: 'x', done: true }], { stage: 0 });
        const r = Goals.closePeriods(g, base());
        expect(r.outcomes[0].met).toBe(true);
        expect(r.goal.targets[0].done).toBe(false);
    });
    test('a day goal closes every midnight', () => {
        const g = recurring([aggTarget({ metric: 'tasksDone', op: 'sum', threshold: 1, compare: 'gte', count: 1 })], { period: 'day', stage: 0, periodKey: '2026-11-05' });
        const recordsFor = (key) => ({ records: key === '2026-11-05' ? [day('2026-11-05', { tasksDone: 2 })] : [], openKey: null });
        const r = Goals.closePeriods(g, base({ nowMs: MS(at(2026, 11, 6, 0, 5)), recordsFor }));
        expect(r.outcomes).toHaveLength(1);
        expect(r.goal.periodKey).toBe('2026-11-06');
        expect(r.goal.stage).toBe(1);
    });
    test('a monthly goal closes on the first of the next month', () => {
        const g = recurring([numberTarget({ current: 10 })], { period: 'month', stage: 0, periodKey: '2026-10' });
        expect(Goals.closePeriods(g, base({ nowMs: MS(at(2026, 10, 31, 23)) })).outcomes).toHaveLength(0);
        expect(Goals.closePeriods(g, base({ nowMs: MS(at(2026, 11, 1, 0, 1)) })).outcomes).toHaveLength(1);
    });
    test('history keeps only the last N periods', () => {
        let g = recurring([numberTarget({ current: 10 })], { period: 'day', stage: 0, periodKey: '2026-11-01' });
        const r = Goals.closePeriods(g, base({ nowMs: MS(at(2026, 11, 20)), historyKeep: 5 }));
        expect(r.outcomes).toHaveLength(19);
        expect(r.goal.history).toHaveLength(5);
        expect(r.goal.history[4].key).toBe('2026-11-19');
    });
    test('a milestone is never closed by a period', () => {
        const g = milestone([numberTarget({ current: 10 })]);
        expect(Goals.closePeriods(g, base()).goal).toBe(g);
    });
    test('a garbage periodKey does not hang or throw', () => {
        const g = recurring([numberTarget()], { periodKey: 'nonsense' });
        const r = Goals.closePeriods(g, base());
        expect(r.goal.periodKey).toBe('2026-11-09');
    });
    test('a very old periodKey is bounded (no runaway loop)', () => {
        const g = recurring([numberTarget()], { period: 'day', periodKey: '2000-01-01' });
        const r = Goals.closePeriods(g, base());
        expect(r.outcomes.length).toBeLessThanOrEqual(400);
        expect(r.goal.periodKey).toBe('2026-11-09');
    });
    test('closePeriods does not mutate its input', () => {
        const g = recurring([numberTarget({ current: 10 })], { stage: 2 });
        const snap = JSON.stringify(g);
        Goals.closePeriods(g, base());
        expect(JSON.stringify(g)).toBe(snap);
    });
});

describe('milestones: completion, roster, retire', () => {
    const settleCtx = (over) => Object.assign({ recordsFor: () => ({ records: [], openKey: null }), metricValue, nowMs: MS(NOW), runNights: 4, rosterKeep: 500 }, over);
    function listOf(...gs) { return Object.assign(Goals.freshGoals(), { active: gs, nextId: 50 }); }

    test('an open milestone follows progress both ways', () => {
        const g = milestone([numberTarget({ current: 6 })], { id: 1 });
        let r = Goals.settleMilestones(listOf(g), settleCtx());
        expect(r.goals.active[0].stage).toBe(3);
        expect(r.completed).toEqual([]);
        const lower = Goals.settleMilestones(listOf(Object.assign({}, r.goals.active[0], { targets: [numberTarget({ current: 2 })] })), settleCtx());
        expect(lower.goals.active[0].stage).toBe(1);
    });
    test('every target reaching 1 completes the goal: stage 5, a roster record, the slot empties', () => {
        const g = milestone([numberTarget({ id: 1, current: 10 }), { id: 2, type: 'bool', label: 'Done?', done: true }], { id: 1, name: 'Ship it', deadline: '2026-12-31' });
        const r = Goals.settleMilestones(listOf(g), settleCtx());
        expect(r.completed).toHaveLength(1);
        expect(r.goals.active).toHaveLength(0);
        expect(r.goals.done).toHaveLength(1);
        const rec = r.goals.done[0];
        expect(rec).toMatchObject({ id: 1, name: 'Ship it', kind: 'milestone', startedAt: g.createdAt, finishedAt: MS(NOW), runNights: 4 });
        expect(rec.targets).toEqual(['Steps', 'Done?']);
    });
    test('one target short of 1 does not complete it', () => {
        const g = milestone([numberTarget({ id: 1, current: 10 }), { id: 2, type: 'bool', label: 'Done?', done: false }], { id: 1 });
        const r = Goals.settleMilestones(listOf(g), settleCtx());
        expect(r.completed).toEqual([]);
        expect(r.goals.active).toHaveLength(1);
        expect(r.goals.active[0].stage).toBe(2); // mean 0.5
    });
    test('a goal with no targets is never completed', () => {
        const g = Object.assign(milestone([numberTarget()], { id: 1 }), { targets: [] });
        expect(Goals.settleMilestones(listOf(g), settleCtx()).completed).toEqual([]);
    });
    test('a late milestone still completes (a missed deadline costs nothing)', () => {
        const g = milestone([numberTarget({ current: 10 })], { id: 1, deadline: '2026-11-02' });
        expect(Goals.settleMilestones(listOf(g), settleCtx()).completed).toHaveLength(1);
    });
    test('recurring goals are left to the period close', () => {
        const g = recurring([numberTarget({ current: 10 })], { id: 1, stage: 1 });
        const r = Goals.settleMilestones(listOf(g), settleCtx());
        expect(r.completed).toEqual([]);
        expect(r.goals.active[0].stage).toBe(1);
    });
    test('the roster is newest first and capped', () => {
        const mk = (id) => milestone([numberTarget({ current: 10 })], { id, name: 'G' + id });
        let goals = listOf(mk(1));
        goals = Goals.settleMilestones(goals, settleCtx({ nowMs: 1000 })).goals;
        goals = Object.assign({}, goals, { active: [mk(2)] });
        goals = Goals.settleMilestones(goals, settleCtx({ nowMs: 2000 })).goals;
        expect(goals.done.map(d => d.name)).toEqual(['G2', 'G1']);
        goals = Object.assign({}, goals, { active: [mk(3)] });
        goals = Goals.settleMilestones(goals, settleCtx({ nowMs: 3000, rosterKeep: 2 })).goals;
        expect(goals.done.map(d => d.name)).toEqual(['G3', 'G2']);
    });
    test('an aggregate target on a milestone reads the records the caller gives it', () => {
        const g = milestone([aggTarget({ metric: 'tasksDone', op: 'sum', threshold: 5, compare: 'gte' })], { id: 1 });
        const recordsFor = () => ({ records: [day('2026-11-02', { tasksDone: 2 }), day('2026-11-03', { tasksDone: 3 })], openKey: null });
        expect(Goals.settleMilestones(listOf(g), settleCtx({ recordsFor })).completed).toHaveLength(1);
    });
    test('retireGoal moves a recurring goal to the roster with its streak numbers', () => {
        const g = recurring([numberTarget()], { id: 1, name: 'Walk', periodsMet: 8, bestStreak: 5 });
        const r = Goals.retireGoal(listOf(g), 1, MS(NOW), 3);
        expect(r.goals.active).toHaveLength(0);
        expect(r.goals.done[0]).toMatchObject({ name: 'Walk', kind: 'recurring', period: 'week', periodsMet: 8, bestStreak: 5, runNights: 3 });
        expect(Goals.retireGoal(listOf(g), 99, MS(NOW), 3).goals.active).toHaveLength(1);
    });
});

describe('starters', () => {
    const CONFIG = require('../js/config.js');
    test('seed places the suggested goals once and marks the list seeded', () => {
        const goals = Goals.seed(Goals.freshGoals(), CONFIG.GOAL_STARTERS, MS(NOW), 1);
        expect(goals.seeded).toBe(true);
        expect(goals.active).toHaveLength(2);
        expect(goals.active.every(g => g.suggested === true)).toBe(true);
        expect(goals.active.map(g => g.kind).sort()).toEqual(['milestone', 'recurring']);
        expect(goals.nextId).toBe(3);
        const again = Goals.seed(goals, CONFIG.GOAL_STARTERS, MS(NOW), 1);
        expect(again).toBe(goals); // already seeded: nothing happens
    });
    test('a player who removed the starters does not get them back', () => {
        let goals = Goals.seed(Goals.freshGoals(), CONFIG.GOAL_STARTERS, MS(NOW), 1);
        goals = Goals.removeGoal(Goals.removeGoal(goals, 1), 2);
        expect(Goals.seed(goals, CONFIG.GOAL_STARTERS, MS(NOW), 1).active).toHaveLength(0);
    });
    test('the starters are valid goals that survive sanitize unchanged', () => {
        const goals = Goals.seed(Goals.freshGoals(), CONFIG.GOAL_STARTERS, MS(NOW), 1);
        expect(Goals.sanitizeGoals(JSON.parse(JSON.stringify(goals)))).toEqual(goals);
    });
    test('the starters use only allowed metrics', () => {
        const ids = CONFIG.GOAL_METRICS.map(m => m.id);
        CONFIG.GOAL_STARTERS.forEach(s => s.targets.filter(t => t.type === 'aggregate').forEach(t => expect(ids).toContain(t.metric)));
    });
    test('seed only fills FREE slots: a player who already has goals keeps them and gets no more than fit', () => {
        const own = Goals.addGoal(Goals.freshGoals(), { name: 'Mine', kind: 'milestone', targets: [{ type: 'bool', label: 'x' }] }, 6, MS(NOW), 1).goals;
        const seeded = Goals.seed(own, CONFIG.GOAL_STARTERS, MS(NOW), 1, 2);
        expect(seeded.active).toHaveLength(2);
        expect(seeded.active[0].name).toBe('Mine');
        expect(seeded.active[0].suggested).toBeUndefined();
        expect(seeded.seeded).toBe(true);
        const none = Goals.seed(own, CONFIG.GOAL_STARTERS, MS(NOW), 1, 1);
        expect(none.active).toHaveLength(1);
        expect(none.seeded).toBe(true);
    });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Build B1 (2026-11-05): what the pane and the card show.
// ---------------------------------------------------------------------------------------------------------------------------
describe('targetDetail', () => {
    test('number, yes/no and linked targets', () => {
        expect(Goals.targetDetail(numberTarget({ current: 4 }), {})).toMatchObject({ kind: 'number', have: 4, need: 10, noun: 'steps', start: 0 });
        expect(Goals.targetDetail({ id: 1, type: 'bool', label: 'x', done: true }, {})).toMatchObject({ kind: 'bool', have: 1, need: 1 });
        // A milestone's linked one-offs plus the habit / routine occurrences.
        expect(Goals.targetDetail(linkedTarget({ itemTotal: 3, itemDone: 1, habitDefIds: ['h'], count: 5, occ: 2 }), { kind: 'milestone' }))
            .toMatchObject({ kind: 'linked', have: 3, need: 8 });
        // A recurring goal counts occurrences against `count`, capped.
        expect(Goals.targetDetail(linkedTarget({ habitDefIds: ['h'], count: 3, occ: 9 }), { kind: 'recurring' })).toMatchObject({ have: 3, need: 3 });
    });
    test('aggregate "days" counts the days that pass; an open day does not pass a "keep it under" target', () => {
        const t = aggTarget({ op: 'days', threshold: 2, compare: 'lte', count: 3 });
        const records = [day('2026-11-03', { tasksDone: 1 }), day('2026-11-04', { tasksDone: 5 }), day('2026-11-05', { tasksDone: 0 })];
        const d = Goals.targetDetail(t, { records, openKey: '2026-11-05', metricValue, metricInfo: () => ({ label: 'Tasks done', unit: 'tasks' }) });
        expect(d).toMatchObject({ kind: 'aggregate', have: 1, need: 3, noun: 'days' });
    });
    test('aggregate sum reports the total, and flags a "keep it under" target as a limit', () => {
        const records = [day('2026-11-03', { tasksDone: 2 }), day('2026-11-04', { tasksDone: 3 })];
        const info = () => ({ label: 'Tasks done', unit: 'tasks' });
        expect(Goals.targetDetail(aggTarget({ threshold: 20 }), { records, metricValue, metricInfo: info })).toMatchObject({ have: 5, need: 20, noun: 'tasks', mode: 'goal' });
        expect(Goals.targetDetail(aggTarget({ threshold: 20, compare: 'lte' }), { records, metricValue, metricInfo: info })).toMatchObject({ have: 5, need: 20, mode: 'limit' });
    });
});

describe('viewFor', () => {
    const ctx = (over) => Object.assign({
        nowMs: MS(NOW), weekStartsOn: 1, slack: 0.1, metricValue, metricInfo: () => ({ label: 'Tasks', unit: 'tasks' }),
        recordsFor: () => ({ records: [], openKey: null }),
    }, over);

    test('a milestone view carries progress, the stage it shows, its pace and each target', () => {
        const g = Goals.newGoal({ name: 'Big', kind: 'milestone', deadline: '2026-11-30', targets: [numberTarget({ current: 6 })] }, MS(at(2026, 11, 1)), 1, 1);
        const v = Goals.viewFor(g, ctx());
        expect(v).toMatchObject({ id: 1, progress: 0.6, stage: 3, recent: null });
        expect(['ahead', 'behind']).toContain(v.pace);
        expect(v.targets).toHaveLength(1);
        expect(v.targets[0]).toMatchObject({ progress: 0.6, detail: { kind: 'number', have: 6, need: 10 } });
    });
    test('a milestone with no deadline has no pace', () => {
        const g = Goals.newGoal({ name: 'Open', kind: 'milestone', targets: [numberTarget({ current: 1 })] }, MS(at(2026, 11, 1)), 1, 1);
        expect(Goals.viewFor(g, ctx()).pace).toBe('none');
    });
    test('a recurring view shows its stored stage and reads the records recordsFor hands it', () => {
        const g = Goals.newGoal({ name: 'Week', kind: 'recurring', period: 'week', stage: 2, targets: [aggTarget({ threshold: 4 })] }, MS(at(2026, 11, 2)), 1, 1);
        const records = [day('2026-11-03', { tasksDone: 2 })];
        const v = Goals.viewFor(g, ctx({ recordsFor: () => ({ records, openKey: null }) }));
        expect(v.stage).toBe(2);
        expect(v.progress).toBe(0.5);
        expect(v.targets[0].detail).toMatchObject({ have: 2, need: 4 });
    });
    test("'recent' marks the first day after a closed period: met or slipped, and only that day", () => {
        const base = { name: 'Week', kind: 'recurring', period: 'week', targets: [aggTarget()] };
        const slipped = Goals.newGoal(Object.assign({}, base, { history: [{ key: '2026-11-02', met: false, progress: 0.2 }] }), MS(at(2026, 11, 2)), 1, 1);
        const met = Goals.newGoal(Object.assign({}, base, { history: [{ key: '2026-11-02', met: true, progress: 1 }] }), MS(at(2026, 11, 2)), 1, 1);
        const monday = MS(at(2026, 11, 9, 9));
        const tuesday = MS(at(2026, 11, 10, 9));
        expect(Goals.viewFor(slipped, ctx({ nowMs: monday })).recent).toBe('slipped');
        expect(Goals.viewFor(met, ctx({ nowMs: monday })).recent).toBe('met');
        expect(Goals.viewFor(slipped, ctx({ nowMs: tuesday })).recent).toBeNull();
        // A history entry that is not the period just before this one does not count.
        const old = Goals.newGoal(Object.assign({}, base, { history: [{ key: '2026-10-19', met: false, progress: 0 }] }), MS(at(2026, 11, 2)), 1, 1);
        expect(Goals.viewFor(old, ctx({ nowMs: monday })).recent).toBeNull();
    });
});

describe('updateTarget', () => {
    const list = (g) => Object.assign(Goals.freshGoals(), { active: [g], nextId: 50 });
    test('a number target moves, clamped between its start and end, and never mutates the input', () => {
        const g = milestone([numberTarget({ current: 2 })], { id: 1 });
        const input = list(g);
        let r = Goals.updateTarget(input, 1, 1, { current: 7 });
        expect(r.changed).toBe(true);
        expect(r.goals.active[0].targets[0].current).toBe(7);
        expect(input.active[0].targets[0].current).toBe(2);
        expect(Goals.updateTarget(r.goals, 1, 1, { current: 99 }).goals.active[0].targets[0].current).toBe(10);
        expect(Goals.updateTarget(r.goals, 1, 1, { current: -5 }).goals.active[0].targets[0].current).toBe(0);
    });
    test('a target that counts down (end below start) clamps the same way', () => {
        const g = milestone([numberTarget({ start: 200, end: 180, current: 200, unit: 'lb' })], { id: 1 });
        const r = Goals.updateTarget(list(g), 1, 1, { current: 150 });
        expect(r.goals.active[0].targets[0].current).toBe(180);
    });
    test('a yes/no target flips; the same value is not a change', () => {
        const g = milestone([{ id: 1, type: 'bool', label: 'Done?', done: false }], { id: 1 });
        const r = Goals.updateTarget(list(g), 1, 1, { done: true });
        expect(r.goals.active[0].targets[0].done).toBe(true);
        expect(Goals.updateTarget(r.goals, 1, 1, { done: true }).changed).toBe(false);
    });
    test('an unknown goal or target, junk, or the wrong patch for the type changes nothing', () => {
        const g = milestone([numberTarget({ current: 2 })], { id: 1 });
        const input = list(g);
        expect(Goals.updateTarget(input, 9, 1, { current: 5 }).changed).toBe(false);
        expect(Goals.updateTarget(input, 1, 9, { current: 5 }).changed).toBe(false);
        expect(Goals.updateTarget(input, 1, 1, { current: NaN }).changed).toBe(false);
        expect(Goals.updateTarget(input, 1, 1, { done: true }).changed).toBe(false);
        expect(Goals.updateTarget(input, 1, 1, null).changed).toBe(false);
        expect(Goals.updateTarget(input, 1, 1, { current: 2 }).goals).toBe(input);
    });
});

describe('nextUnlockLevel', () => {
    test('finds the next level that adds a slot', () => {
        expect(Goals.nextUnlockLevel(1, 2, SLOT_TABLE)).toEqual({ level: 2, slots: 3 });
        expect(Goals.nextUnlockLevel(2, 3, SLOT_TABLE)).toEqual({ level: 4, slots: 4 });
        expect(Goals.nextUnlockLevel(5, 4, SLOT_TABLE)).toEqual({ level: 6, slots: 5 });
    });
    test('a slot already held beyond the level (a lost run) skips the levels that add nothing new', () => {
        expect(Goals.nextUnlockLevel(1, 6, SLOT_TABLE)).toBeNull(); // best mark is the table maximum
        expect(Goals.nextUnlockLevel(1, 4, SLOT_TABLE)).toEqual({ level: 6, slots: 5 });
    });
    test('nothing left at the top, or with no table', () => {
        expect(Goals.nextUnlockLevel(9, 6, SLOT_TABLE)).toBeNull();
        expect(Goals.nextUnlockLevel(1, 2, null)).toBeNull();
    });
});

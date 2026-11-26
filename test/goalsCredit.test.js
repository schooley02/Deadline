/**
 * @jest-environment jsdom
 *
 * Lab credit (Build A, 2026-11-26; docs/LAB_PLAN.md): "people cured" in tenths. The pure rules in js/goals.js (payRecurringCredit,
 * payOneTimeCredit, the daily cap, the saved markers), their wiring in State (one-time pay at the stage moment, recurring pay at the day
 * close), the Lab's counter and ladder, and the Memorial's saved stage mark.
 */
global.CONFIG = require('../js/config.js');
global.Goals = require('../js/goals.js');
global.GoalMetrics = require('../js/goalMetrics.js');
global.DailyRecord = require('../js/dailyRecord.js');
global.DayRollover = require('../js/dayRollover.js');
global.RunStats = require('../js/runStats.js');
global.RunCarryover = require('../js/runCarryover.js');
global.PrioritySlots = require('../js/prioritySlots.js');
global.Memorial = require('../js/memorial.js');
const VillageProgress = require('../js/villageProgress.js');
const State = require('../js/state.js');

const RATES = CONFIG.GOAL_CREDIT;
const DAY = 86400000;
const NOON = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0, 0);
const dayRec = (date, over) => Object.assign(DailyRecord.fresh({ date }), over || {});
const oneTime = (over) => Goals.newGoal(Object.assign({
    name: 'Big one', kind: 'milestone',
    targets: [{ type: 'bool', label: 'Do it' }],
}, over), 0, 1, 1);
const recurring = (period, over) => Goals.newGoal(Object.assign({
    name: 'Habit', kind: 'recurring', period,
    targets: [{ type: 'bool', label: 'Do it' }],
}, over), NOON(2026, 11, 4).getTime(), 1, 1);

describe('config', () => {
    test('GOAL_CREDIT, GOAL_DAILY_MAX and the Lab ladder are the approved theory numbers', () => {
        expect(RATES).toEqual({ day: 1, week: 10, month: 50, oneTimePerWeek: 12, perPerson: 10 });
        expect(CONFIG.GOAL_DAILY_MAX).toBe(2);
        expect(CONFIG.VILLAGE_TIER_THRESHOLDS.goals).toEqual([10, 60, 180, 400]); // 1 / 6 / 18 / 40 people
        expect(CONFIG.VILLAGE_TIER_THRESHOLDS.goals.map(c => c / RATES.perPerson)).toEqual([1, 6, 18, 40]);
    });
});

describe('payRecurringCredit', () => {
    test('a met period pays its shape once: day 1, week 10, month 50 (tenths)', () => {
        expect(Goals.payRecurringCredit(recurring('day'), '2026-11-04', true, RATES).credit).toBe(1);
        expect(Goals.payRecurringCredit(recurring('week'), '2026-11-02', true, RATES).credit).toBe(10);
        expect(Goals.payRecurringCredit(recurring('month'), '2026-11', true, RATES).credit).toBe(50);
    });
    test('the same period (or an earlier one) never pays twice', () => {
        const first = Goals.payRecurringCredit(recurring('week'), '2026-11-02', true, RATES);
        expect(first.goal.creditKey).toBe('2026-11-02');
        expect(Goals.payRecurringCredit(first.goal, '2026-11-02', true, RATES).credit).toBe(0);
        expect(Goals.payRecurringCredit(first.goal, '2026-10-26', true, RATES).credit).toBe(0);
        expect(Goals.payRecurringCredit(first.goal, '2026-11-09', true, RATES).credit).toBe(10); // the next week pays
    });
    test('a missed period pays nothing and leaves the goal untouched; the input is never mutated', () => {
        const g = recurring('week');
        const r = Goals.payRecurringCredit(g, '2026-11-02', false, RATES);
        expect(r.credit).toBe(0);
        expect(r.goal).toBe(g);
        Goals.payRecurringCredit(g, '2026-11-02', true, RATES);
        expect(g.creditKey).toBeUndefined();
    });
    test('a one-time goal, a bad key and missing rates pay nothing', () => {
        expect(Goals.payRecurringCredit(oneTime(), '2026-11-02', true, RATES).credit).toBe(0);
        expect(Goals.payRecurringCredit(recurring('week'), 'nope', true, RATES).credit).toBe(0);
        expect(Goals.payRecurringCredit(recurring('week'), '2026-11-02', true, null).credit).toBe(0);
    });
});

describe('payOneTimeCredit', () => {
    const created = NOON(2026, 11, 1).getTime();
    test('a stage pays 12 tenths per week open: two weeks open pays 24 (2.4 people)', () => {
        const g = oneTime({ createdAt: created });
        const r = Goals.payOneTimeCredit(g, 1, created + 14 * DAY, null, RATES);
        expect(r.credit).toBe(24);
        expect(r.goal).toMatchObject({ creditStage: 1, creditAt: created + 14 * DAY });
    });
    test('made and ticked in one sitting pays about nothing', () => {
        const g = oneTime({ createdAt: created });
        expect(Goals.payOneTimeCredit(g, 2, created + 60 * 1000, null, RATES).credit).toBe(0);
    });
    test('each stage pays once (high-water): going down and up again does not pay again', () => {
        const g = oneTime({ createdAt: created });
        const a = Goals.payOneTimeCredit(g, 2, created + 7 * DAY, null, RATES);
        expect(a.credit).toBe(12);
        expect(Goals.payOneTimeCredit(a.goal, 2, created + 14 * DAY, null, RATES).credit).toBe(0);
        expect(Goals.payOneTimeCredit(a.goal, 1, created + 14 * DAY, null, RATES).credit).toBe(0);
        const b = Goals.payOneTimeCredit(a.goal, 3, created + 14 * DAY, null, RATES);
        expect(b.credit).toBe(12); // only the week since the last paid stage
    });
    test('several stages jumped at once pay only the time that passed (no multiplying)', () => {
        const g = oneTime({ createdAt: created });
        const r = Goals.payOneTimeCredit(g, 5, created + 7 * DAY, null, RATES);
        expect(r.credit).toBe(12);
        expect(r.goal.creditStage).toBe(5);
    });
    test('a six-month goal cures about 30 people across its stages', () => {
        let g = oneTime({ createdAt: created });
        let total = 0;
        [1, 2, 3, 4, 5].forEach((s, i) => {
            const r = Goals.payOneTimeCredit(g, s, created + Math.round(182 * DAY * (i + 1) / 5), null, RATES);
            g = r.goal; total += r.credit;
        });
        expect(total / RATES.perPerson).toBeGreaterThan(29);
        expect(total / RATES.perPerson).toBeLessThan(32);
    });
    test('this run only: time before the run started is not paid', () => {
        const g = oneTime({ createdAt: created });
        const runStart = created + 10 * DAY;
        expect(Goals.payOneTimeCredit(g, 1, runStart + 7 * DAY, runStart, RATES).credit).toBe(12);
        const stale = Goals.payOneTimeCredit(Object.assign({}, g, { creditAt: created + 3 * DAY, creditStage: 1 }), 2, runStart + 7 * DAY, runStart, RATES);
        expect(stale.credit).toBe(12); // the last paid stage was in an earlier run: the run start is the later anchor
    });
    test('a recurring goal pays nothing here; the input is never mutated', () => {
        expect(Goals.payOneTimeCredit(recurring('week'), 1, created + 7 * DAY, null, RATES).credit).toBe(0);
        const g = oneTime({ createdAt: created });
        Goals.payOneTimeCredit(g, 1, created + 7 * DAY, null, RATES);
        expect(g.creditStage).toBeUndefined();
    });
});

describe('saved markers', () => {
    test('creditKey / creditStage / creditAt survive sanitizeGoals; junk is dropped', () => {
        const w = Object.assign({}, recurring('week'), { creditKey: '2026-11-02' });
        const m = Object.assign({}, oneTime(), { creditStage: 3, creditAt: 12345 });
        const out = Goals.sanitizeGoals({ active: [w, Object.assign({}, m, { id: 2 })], done: [], nextId: 3, seeded: true });
        expect(out.active[0].creditKey).toBe('2026-11-02');
        expect(out.active[1]).toMatchObject({ creditStage: 3, creditAt: 12345 });
        const bad = Goals.sanitizeGoals({ active: [Object.assign({}, w, { creditKey: 'junk' }), Object.assign({}, m, { id: 2, creditStage: 99, creditAt: 'x' })], nextId: 3 });
        expect(bad.active[0].creditKey).toBeUndefined();
        expect(bad.active[1].creditStage).toBe(5);
        expect(bad.active[1].creditAt).toBeUndefined();
    });
});

describe('the daily cap (addGoal)', () => {
    const daily = (n) => ({ name: 'Daily ' + n, kind: 'recurring', period: 'day', targets: [{ type: 'bool', label: 'x' }] });
    test('a third daily goal is refused with reason dailyFull; weekly, monthly and one-time goals are not', () => {
        let goals = Goals.freshGoals();
        for (let i = 1; i <= 2; i++) {
            const r = Goals.addGoal(goals, daily(i), 6, 0, 1, 2);
            expect(r.ok).toBe(true); goals = r.goals;
        }
        expect(Goals.dailyGoalCount(goals)).toBe(2);
        expect(Goals.addGoal(goals, daily(3), 6, 0, 1, 2)).toMatchObject({ ok: false, reason: 'dailyFull' });
        expect(Goals.addGoal(goals, { name: 'W', kind: 'recurring', period: 'week', targets: [{ type: 'bool', label: 'x' }] }, 6, 0, 1, 2).ok).toBe(true);
        expect(Goals.addGoal(goals, { name: 'M', kind: 'milestone', targets: [{ type: 'bool', label: 'x' }] }, 6, 0, 1, 2).ok).toBe(true);
    });
    test('a full roster still says full first; no cap given means no cap; dailies already above the cap stay', () => {
        let goals = Goals.freshGoals();
        for (let i = 1; i <= 3; i++) goals = Goals.addGoal(goals, daily(i), 6, 0, 1).goals; // no cap argument
        expect(Goals.dailyGoalCount(goals)).toBe(3);
        expect(Goals.addGoal(goals, daily(4), 3, 0, 1, 2).reason).toBe('full');
        expect(goals.active).toHaveLength(3);
    });
    test('State.addGoal passes CONFIG.GOAL_DAILY_MAX', () => {
        global.Persistence = { loadDays: () => ({ v: DailyRecord.V, days: {}, months: {} }), saveDays: () => true, requestSave: jest.fn() };
        State.setGoals(Object.assign(Goals.freshGoals(), { seeded: true }));
        State.setPlayerLevel(9);
        const now = NOON(2026, 11, 5);
        expect(State.addGoal(daily(1), [], now).ok).toBe(true);
        expect(State.addGoal(daily(2), [], now).ok).toBe(true);
        expect(State.addGoal(daily(3), [], now)).toEqual({ ok: false, reason: 'dailyFull' });
        delete global.Persistence;
    });
});

describe('State pays the credit', () => {
    function fakePersistence(days) {
        global.Persistence = { loadDays: () => ({ v: DailyRecord.V, days: days || {}, months: {} }), saveDays: () => true, requestSave: jest.fn() };
    }
    beforeEach(() => {
        fakePersistence({});
        State.setGoals(null);
        State.setToday(null);
        State.setPlayerLevel(1);
        State.setDaysSurvived(0);
        State.setRunStartedAtMs(null);
    });
    afterAll(() => { delete global.Persistence; });

    function linkedGoal(createdMs) {
        const r = Goals.addGoal(Goals.freshGoals(), {
            name: 'Read it', kind: 'milestone',
            targets: [{ type: 'linked', label: 'Chapters', itemTotal: 2, habitDefIds: [], routineIds: [] }],
        }, 6, createdMs, 1);
        State.setGoals(Object.assign(r.goals, { seeded: true }));
        return r.goal;
    }
    const info = (g) => ({ goalId: g.id, goalTargetId: g.targets[0].id, type: 'task', definitionId: null, routineId: null });

    test('a new stage of a one-time goal pays at that moment, by the time it was open; the day record counts it', () => {
        const created = NOON(2026, 11, 5).getTime();
        const goal = linkedGoal(created);
        State.setToday(dayRec('2026-11-19'));
        State.applyGoalCompletion(info(goal), +1, new Date(created + 14 * DAY)); // 0 -> stage 2 after two weeks: 24 tenths
        expect(State.getToday().pg.credit).toBe(24);
        expect(State.getGoals().active[0]).toMatchObject({ stage: 2, creditStage: 2 });
        State.applyGoalCompletion(info(goal), -1, new Date(created + 14 * DAY)); // taking progress back refunds nothing...
        State.applyGoalCompletion(info(goal), +1, new Date(created + 14 * DAY)); // ...and the same stage cannot pay twice
        expect(State.getToday().pg.credit).toBe(24);
    });
    test('finishing the goal pays the last stages for the time since the last paid one, then the goal leaves its slot', () => {
        const created = NOON(2026, 11, 5).getTime();
        const goal = linkedGoal(created);
        State.setToday(dayRec('2026-11-19'));
        State.applyGoalCompletion(info(goal), +1, new Date(created + 7 * DAY)); // stage 2: 12
        State.applyGoalCompletion(info(goal), +1, new Date(created + 14 * DAY)); // complete: one more week since the last paid stage: 12
        expect(State.getGoals().active).toEqual([]);
        expect(State.getToday().pg.credit).toBe(24);
    });
    test('this run only: a goal made before the run started pays only the time since the run began', () => {
        const created = NOON(2026, 11, 5).getTime();
        const goal = linkedGoal(created);
        State.setRunStartedAtMs(created + 7 * DAY);
        State.setToday(dayRec('2026-11-19'));
        State.applyGoalCompletion(info(goal), +1, new Date(created + 14 * DAY)); // one week of this run: 12
        expect(State.getToday().pg.credit).toBe(12);
    });

    function weekly(createdMs) {
        const r = Goals.addGoal(Goals.freshGoals(), {
            name: 'Finish tasks', kind: 'recurring', period: 'week',
            targets: [{ type: 'aggregate', label: 'Tasks', metric: 'tasksDone', op: 'sum', threshold: 3, compare: 'gte' }],
        }, 6, createdMs, 1);
        State.setGoals(Object.assign(r.goals, { seeded: true }));
        return r.goal;
    }
    const done = (n) => Object.assign(DailyRecord.fresh().done, { task: n });

    test('a weekly goal pays 1.0 on the night its target is reached, not at the end of the week, and only once', () => {
        weekly(NOON(2026, 11, 2).getTime());
        fakePersistence({ '2026-11-03': dayRec('2026-11-03', { done: done(5) }) }); // met by Tuesday
        State.setToday(dayRec('2026-11-04'));
        State.closeGoalPeriods(NOON(2026, 11, 4)); // Tuesday night closed: mid-week
        expect(State.getToday().pg.credit).toBe(10);
        expect(State.getGoals().active[0].creditKey).toBe('2026-11-02');
        State.closeGoalPeriods(NOON(2026, 11, 5)); // the next nights add nothing for the same week
        expect(State.getToday().pg.credit).toBe(10);
        State.setToday(dayRec('2026-11-09'));
        State.closeGoalPeriods(NOON(2026, 11, 9)); // the week ends (met, already paid): still 0 new
        expect(State.getToday().pg.credit).toBe(0);
        expect(State.getGoals().active[0].periodsMet).toBe(1);
    });
    test('a week that is not met pays nothing', () => {
        weekly(NOON(2026, 11, 2).getTime());
        fakePersistence({ '2026-11-03': dayRec('2026-11-03', { done: done(1) }) });
        State.setToday(dayRec('2026-11-09'));
        State.closeGoalPeriods(NOON(2026, 11, 9));
        expect(State.getToday().pg.credit).toBe(0);
        expect(State.getGoals().active[0].creditKey).toBeUndefined();
    });
    test('a daily goal pays 0.1 for each day it was met', () => {
        const r = Goals.addGoal(Goals.freshGoals(), {
            name: 'Daily', kind: 'recurring', period: 'day',
            targets: [{ type: 'aggregate', label: 'Tasks', metric: 'tasksDone', op: 'sum', threshold: 1, compare: 'gte' }],
        }, 6, NOON(2026, 11, 3).getTime(), 1);
        State.setGoals(Object.assign(r.goals, { seeded: true }));
        fakePersistence({ '2026-11-03': dayRec('2026-11-03', { done: done(2) }) });
        State.setToday(dayRec('2026-11-04'));
        State.closeGoalPeriods(NOON(2026, 11, 4));
        expect(State.getToday().pg.credit).toBe(1);
    });
});

describe('the Lab counter', () => {
    const ctx = (days, today) => ({ days, today, runNumber: 1, nightsSurvived: 0, runStats: {}, maxHp: 100 });
    const day = (date, credit) => Object.assign(DailyRecord.fresh({ date }), { run: 1, pg: { climb: 0, drop: 0, met: 0, done: 0, pts: 0, items: 0, credit } });
    test('counts this run closed days plus the open day, and nothing from an older run or a pre-v19 day', () => {
        const days = [day('2026-11-03', 10), day('2026-11-04', 4), Object.assign(day('2026-11-02', 99), { run: 0 })];
        const old = DailyRecord.fresh({ date: '2026-11-01' }); old.run = 1; delete old.pg;
        const v = VillageProgress.counters(ctx(days.concat([old]), Object.assign(day('2026-11-05', 6), { run: 1 })));
        expect(v.goals).toBe(20);
    });
    test('the ladder: star 2 at 1 person, 3 at 6, 4 at 18, 5 at 40 (credit 10 / 60 / 180 / 400)', () => {
        const tier = (credit) => VillageProgress.compute(Object.assign(ctx([day('2026-11-03', credit)], null), { thresholds: CONFIG.VILLAGE_TIER_THRESHOLDS })).goals.tier;
        expect([0, 9, 10, 59, 60, 179, 180, 399, 400].map(tier)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
    });
    test('nothing earned is star 1', () => {
        expect(VillageProgress.compute(ctx([], null)).goals.tier).toBe(1);
    });
});

describe('the Memorial stage mark in State', () => {
    test('a Lab star counts toward the average, and the mark rides in the save, raise-only', () => {
        jest.isolateModules(() => {
            const S = require('../js/state.js');
            expect(S.getBestMemorialStage()).toBe(0);
            const all2 = Object.fromEntries(Memorial.KINDS.map(k => [k, 2]));
            expect(S.setBestVillageTiers(all2)).toBe(true);
            expect(S.getBestMemorialStage()).toBe(2);
            expect(S.setBestVillageTiers({ slain: 1 })).toBe(false); // never lowers
            expect(S.raiseBestMemorialStage(1)).toBe(false);
            expect(S.raiseBestMemorialStage(3)).toBe(true);
            expect(S.raiseBestMemorialStage(9)).toBe(false);
            expect(S.getPersistableState({}).bestMemorialStage).toBe(3);
            S.resetBestVillageTiers(); // the dev Reset Game is the one way down
            expect(S.getBestMemorialStage()).toBe(0);
        });
    });
});

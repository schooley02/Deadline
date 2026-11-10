/**
 * @jest-environment jsdom
 *
 * Goals Build A wiring (2026-11-05; docs/GOALS_PLAN.md): the saved `goals` in State, schema 17 -> 18, DailyRecord v10 `pg`, the
 * period close in performDayRollover, the Items -> State completion hook, and the run carryover (goals survive a new run).
 * The pure rules are in test/goals.test.js and test/goalMetrics.test.js; this file only proves the seams are connected.
 */
global.CONFIG = require('../js/config.js');
global.Goals = require('../js/goals.js');
global.GoalMetrics = require('../js/goalMetrics.js');
global.DailyRecord = require('../js/dailyRecord.js');
global.DayRollover = require('../js/dayRollover.js');
global.RunStats = require('../js/runStats.js');
global.RunCarryover = require('../js/runCarryover.js');
global.PrioritySlots = require('../js/prioritySlots.js');
const Persistence = require('../js/persistence.js');
const State = require('../js/state.js');
const Items = require('../js/items.js');

const NOON = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0, 0);
const dayRec = (date, over) => Object.assign(DailyRecord.fresh({ date }), over || {});

/** A stand-in for Persistence: the days store and the save spy, set per test. */
function fakePersistence(days) {
    global.Persistence = {
        loadDays: () => ({ v: DailyRecord.V, days: days || {}, months: {} }),
        saveDays: () => true,
        requestSave: jest.fn(),
    };
}

beforeEach(() => {
    fakePersistence({});
    State.setGoals(null);
    State.setToday(null);
    State.setPlayerLevel(1);
    State.setDaysSurvived(0);
});
afterAll(() => { delete global.Persistence; });

describe('DailyRecord v10 / v11: pg', () => {
    test('version 11 and a fresh record starts with an all-zero pg', () => {
        expect(DailyRecord.V).toBe(12);
        expect(DailyRecord.fresh().pg).toEqual({ climb: 0, drop: 0, met: 0, done: 0, pts: 0, items: 0 });
    });
    test("the 'pgoal' event adds whole counts and ignores junk", () => {
        const rec = DailyRecord.fresh();
        DailyRecord.bump(rec, 'pgoal', { climb: 2, met: 1 });
        DailyRecord.bump(rec, 'pgoal', { climb: 1, drop: 1, done: 1 });
        DailyRecord.bump(rec, 'pgoal', { climb: -3, drop: 'x', met: NaN, done: 0.4 });
        DailyRecord.bump(rec, 'pgoal');
        expect(rec.pg).toEqual({ climb: 3, drop: 1, met: 1, done: 1, pts: 0, items: 0 });
    });
    test('an old record (no pg) is repaired by normalize, and a stored pg survives it', () => {
        const old = DailyRecord.fresh({ date: '2026-11-01' });
        delete old.pg;
        expect(DailyRecord.normalize(old).pg).toEqual({ climb: 0, drop: 0, met: 0, done: 0, pts: 0, items: 0 });
        const kept = DailyRecord.fresh({ date: '2026-11-01' });
        kept.pg = { climb: 4, drop: 2, met: 1, done: 3 };
        expect(DailyRecord.normalize(kept).pg).toMatchObject({ climb: 4, drop: 2, met: 1, done: 3 });
    });
    test('the month roll-up sums pg', () => {
        const a = dayRec('2024-01-03'); a.pg = { climb: 2, drop: 0, met: 1, done: 0 };
        const b = dayRec('2024-01-09'); b.pg = { climb: 1, drop: 1, met: 0, done: 1 };
        let store = DailyRecord.addDay(DailyRecord.addDay(null, a), b);
        store = DailyRecord.rollUp(store, new Date(2026, 10, 5));
        expect(store.days['2024-01-03']).toBeUndefined();
        expect(store.months['2024-01'].pg).toEqual({ climb: 3, drop: 1, met: 1, done: 1, pts: 0, items: 0 });
    });
});

describe('Persistence schema 18', () => {
    test('the version is at least 18 (19 added skyPick, 2026-11-09)', () => {
        expect(Persistence.SCHEMA_VERSION).toBeGreaterThanOrEqual(18);
    });
    test('v17 -> v18 seeds an empty, UNSEEDED goals object', () => {
        const save = Persistence.migrate({ schemaVersion: 17 });
        expect(save.schemaVersion).toBe(Persistence.SCHEMA_VERSION);
        expect(save.goals).toEqual({ bestSlots: 0, active: [], done: [], nextId: 1, seeded: false });
    });
    test('v17 -> v18 keeps goals that are already there, and repairs junk', () => {
        const keep = { bestSlots: 3, active: [], done: [], nextId: 7, seeded: true };
        expect(Persistence.migrate({ schemaVersion: 17, goals: keep }).goals).toBe(keep);
        expect(Persistence.migrate({ schemaVersion: 17, goals: [] }).goals.seeded).toBe(false);
        expect(Persistence.migrate({ schemaVersion: 17, goals: 'x' }).goals.active).toEqual([]);
    });
    test('an older save walks every step up to the current version', () => {
        expect(Persistence.migrate({ schemaVersion: 16 }).schemaVersion).toBe(Persistence.SCHEMA_VERSION);
    });
});

describe('State: the saved goals', () => {
    test('a fresh State has empty goals, and setGoals repairs junk', () => {
        expect(State.getGoals()).toEqual({ bestSlots: 0, active: [], done: [], nextId: 1, seeded: false, owed: 0, itemPaidAt: [] });
        State.setGoals({ active: 'nope', bestSlots: -4, nextId: 'x' });
        expect(State.getGoals()).toEqual({ bestSlots: 0, active: [], done: [], nextId: 1, seeded: false, owed: 0, itemPaidAt: [] });
    });
    test('goals are part of the persistable state', () => {
        State.ensureGoalsSeeded(NOON(2026, 11, 5));
        expect(State.getPersistableState({}).goals).toBe(State.getGoals());
    });
    test('the slot count follows the level and the mark is a high-water mark', () => {
        expect(State.goalSlotCount(1)).toBe(2);
        expect(State.goalSlotCount(4)).toBe(4);
        expect(State.syncGoalSlots(4)).toBe(4);
        expect(State.getGoals().bestSlots).toBe(4);
        expect(State.syncGoalSlots(1)).toBe(4); // a lower level never lowers it
        expect(State.getGoals().bestSlots).toBe(4);
        State.setPlayerLevel(8);
        expect(State.syncGoalSlots()).toBe(6); // default level = the current one
    });
    test('the suggested starters are added once, into free slots only', () => {
        expect(State.ensureGoalsSeeded(NOON(2026, 11, 5))).toBe(true);
        const g = State.getGoals();
        expect(g.seeded).toBe(true);
        expect(g.active).toHaveLength(2);
        expect(g.active.every(x => x.suggested === true)).toBe(true);
        expect(g.active.map(x => x.kind).sort()).toEqual(['milestone', 'recurring']);
        expect(State.ensureGoalsSeeded(NOON(2026, 11, 5))).toBe(false);
        State.setGoals(Object.assign({}, g, { active: [] })); // the player removed them
        expect(State.ensureGoalsSeeded(NOON(2026, 11, 5))).toBe(false);
        expect(State.getGoals().active).toEqual([]);
    });
    test('a dev Reset (setGoals(null)) forgets everything and the starters come back', () => {
        State.ensureGoalsSeeded(NOON(2026, 11, 5));
        State.syncGoalSlots(8);
        State.setGoals(null);
        expect(State.getGoals().bestSlots).toBe(0);
        expect(State.ensureGoalsSeeded(NOON(2026, 11, 5))).toBe(true);
    });
});

describe('goals carry across runs (initGame leaves them alone)', () => {
    function runInitGame() {
        jest.useFakeTimers();
        const el = () => ({ classList: { add() {}, remove() {} }, style: {}, textContent: '', offsetWidth: 100, innerHTML: '' });
        const deps = {
            gameCanvas: el(), baseElement: el(), baseHealthDisplay: el(), gameOverMessage: el(), levelUpMessage: el(), restartButton: el(),
            activeItemsListUL: el(), attackButton: el(),
            setGameScreenWidth() {}, setBaseWidth() {}, setEnemyWidth() {}, setHabitEnemyWidth() {}, updatePlayerDisplays() {},
            setAttackMode() {}, generateDailyHabitInstances() {}, generateDailyRoutineTaskInstances() {}, updateTaskCountDisplay() {},
            updateRoutineDisplay() {}, getGameLoopInterval: () => null, setGameLoopInterval() {}, updateGame() {},
        };
        State.initGame(deps);
        jest.useRealTimers();
    }
    test('a new run keeps the goals, the streaks and the slot mark', () => {
        State.setPlayerLevel(8);
        State.syncGoalSlots();
        State.ensureGoalsSeeded(NOON(2026, 11, 5));
        const before = State.getGoals().active.map(g => g.id);
        runInitGame();
        expect(State.getPlayerLevel()).toBe(1); // the run itself reset
        expect(State.getGoals().active.map(g => g.id)).toEqual(before);
        expect(State.getGoals().bestSlots).toBe(6);
        expect(State.goalSlotCount(1)).toBe(6); // level 1 of the new run still has every slot ever earned
    });
    test('the very first boot (nothing saved) gets the starters from initGame', () => {
        runInitGame();
        expect(State.getGoals().active).toHaveLength(2);
        expect(State.getGoals().seeded).toBe(true);
    });
    test('RunCarryover.summary counts the goals that ride along', () => {
        expect(RunCarryover.summary({ goals: [{}, {}, {}] }).goals).toBe(3);
        expect(RunCarryover.summary({}).goals).toBe(0);
    });
});

describe('linked targets: the Items -> State hook', () => {
    function withLinkedGoal() {
        const r = Goals.addGoal(Goals.freshGoals(), {
            name: 'Read it', kind: 'milestone',
            targets: [{ type: 'linked', label: 'Chapters', itemTotal: 2, habitDefIds: [], routineIds: [] }],
        }, 6, NOON(2026, 11, 5).getTime(), 1);
        State.setGoals(Object.assign(r.goals, { seeded: true }));
        return r.goal;
    }
    test('applyGoalCompletion moves a linked one-off target and completes the goal at 1', () => {
        const goal = withLinkedGoal();
        const info = { goalId: goal.id, goalTargetId: goal.targets[0].id, type: 'task', definitionId: null, routineId: null };
        let r = State.applyGoalCompletion(info, +1, NOON(2026, 11, 5));
        expect(r.changed).toBe(true);
        expect(r.completed).toEqual([]);
        expect(State.getGoals().active[0].targets[0].itemDone).toBe(1);
        expect(State.getGoals().active[0].stage).toBe(2); // 0.5 of the way: floor(0.5 * 5)
        r = State.applyGoalCompletion(info, -1, NOON(2026, 11, 5)); // un-checking lowers it again, honestly
        expect(State.getGoals().active[0].targets[0].itemDone).toBe(0);
        State.applyGoalCompletion(info, +1, NOON(2026, 11, 5));
        r = State.applyGoalCompletion(info, +1, NOON(2026, 11, 5));
        expect(r.completed).toHaveLength(1);
        expect(State.getGoals().active).toEqual([]);
        expect(State.getGoals().done[0]).toMatchObject({ id: goal.id, name: 'Read it', kind: 'milestone' });
    });
    test('an item that no goal links to changes nothing and does not save', () => {
        withLinkedGoal();
        global.Persistence.requestSave.mockClear();
        const r = State.applyGoalCompletion({ goalId: null, goalTargetId: null, type: 'task', definitionId: null, routineId: null }, +1, NOON(2026, 11, 5));
        expect(r).toEqual({ changed: false, completed: [] });
        expect(global.Persistence.requestSave).not.toHaveBeenCalled();
    });
    test("completing a goal bumps today's pg (climb counts the stages gained, done counts the goal)", () => {
        const goal = withLinkedGoal();
        State.setToday(dayRec('2026-11-05'));
        const info = { goalId: goal.id, goalTargetId: goal.targets[0].id, type: 'task', definitionId: null, routineId: null };
        State.applyGoalCompletion(info, +1, NOON(2026, 11, 5)); // 0 -> 2
        State.applyGoalCompletion(info, +1, NOON(2026, 11, 5)); // 2 -> done (5): +3
        expect(State.getToday().pg).toEqual({ climb: 5, drop: 0, met: 0, done: 1, pts: 0, items: 0 });
    });

    // Items.completeItem / uncompleteItem need a full DOM to run, so the hook is pinned at source level here (the behaviour behind it is
    // covered above through State) and exercised for real by the browser tests.
    test('Items tells the optional deps.onGoalProgress after a complete (+1) and an uncomplete (-1), with the item and routine ids', () => {
        const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'items.js'), 'utf8');
        expect(src).toMatch(/goalProgress\(item, deps, \+1\);\s*\n\s*deps\.saveGame\(\);/);
        expect(src).toMatch(/goalProgress\(item, deps, -1\);/);
        expect(src).toMatch(/typeof deps\.onGoalProgress !== 'function'\) return;/);
        expect(src).toMatch(/goalTargetId: item\.goalTargetId != null \? item\.goalTargetId : null/);
        expect(src).toMatch(/routineId: dailyRoutineId\(item, deps\),\s*\n\s*\}, dir\)/);
        expect(typeof Items.completeItem).toBe('function');
    });
    test('script.js hands Items the State hook, and a level-up raises the goal-slot mark', () => {
        const script = require('fs').readFileSync(require('path').join(__dirname, '..', 'script.js'), 'utf8').replace(/\r\n/g, '\n');
        expect(script).toContain('onGoalProgress: (info, dir) => { State.applyGoalCompletion(info, dir); renderGoals(); },');
        expect(script).toContain('State.setPlayerLevel(result.level);\n        // Goals (Build A): the goal-slot high-water mark catches up with the new level');
        expect(script).toContain('State.syncGoalSlots();');
        expect(script).toContain('State.setGoals(null);');
    });
});

describe('the period close inside performDayRollover', () => {
    function weeklyGoal(over) {
        const r = Goals.addGoal(Goals.freshGoals(), Object.assign({
            name: 'Finish tasks', kind: 'recurring', period: 'week',
            targets: [{ type: 'aggregate', label: 'Tasks', metric: 'tasksDone', op: 'sum', threshold: 3, compare: 'gte' }],
        }, over), 6, NOON(2026, 11, 2).getTime(), 1); // created Monday 2026-11-02, so its period is the week of 2026-11-02
        State.setGoals(Object.assign(r.goals, { seeded: true }));
        return r.goal;
    }
    const noopDeps = (now) => ({
        getCurrentGameDate: () => new Date(2026, 10, 8, 0, 0, 0, 0),
        getActiveItems: () => [],
        setCurrentGameDate() {},
        isCheatDayExcusedForItem: () => false, settleExcusedCheatDay() {}, markPendingCheckIn() {}, settleStaleRecurringInstance() {},
    });

    test('a met week climbs a stage and a missed week drops one, reading the days store', () => {
        weeklyGoal();
        // The week of 2026-11-02 had 4 tasks done: met. (Closed days live in the days store.)
        const days = {
            '2026-11-03': dayRec('2026-11-03', { done: Object.assign(DailyRecord.fresh().done, { task: 3 }) }),
            '2026-11-05': dayRec('2026-11-05', { done: Object.assign(DailyRecord.fresh().done, { task: 1 }) }),
        };
        fakePersistence(days);
        State.setToday(dayRec('2026-11-08'));
        const out = State.closeGoalPeriods(NOON(2026, 11, 9)); // Monday: the week of 11-02 just ended
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ key: '2026-11-02', met: true, stageBefore: 0, stageAfter: 1, streakAfter: 1 });
        const g = State.getGoals().active[0];
        expect(g).toMatchObject({ stage: 1, streak: 1, periodsMet: 1, periodKey: '2026-11-09' });
        expect(g.history).toEqual([{ key: '2026-11-02', met: true, progress: 1 }]);
        // Next week nothing happened: missed.
        fakePersistence({});
        const out2 = State.closeGoalPeriods(NOON(2026, 11, 16));
        expect(out2[0]).toMatchObject({ key: '2026-11-09', met: false, stageBefore: 1, stageAfter: 0, streakAfter: 0 });
        expect(State.getGoals().active[0]).toMatchObject({ stage: 0, streak: 0, bestStreak: 1 });
    });
    test('a period closes once: a second call in the same period changes nothing', () => {
        weeklyGoal();
        fakePersistence({});
        State.setToday(dayRec('2026-11-08'));
        State.closeGoalPeriods(NOON(2026, 11, 9));
        const before = State.getGoals();
        expect(State.closeGoalPeriods(NOON(2026, 11, 9))).toEqual([]);
        expect(State.getGoals()).toBe(before);
    });
    test("the close bumps the new day's pg (met + climb, or drop)", () => {
        weeklyGoal();
        fakePersistence({ '2026-11-03': dayRec('2026-11-03', { done: Object.assign(DailyRecord.fresh().done, { task: 5 }) }) });
        State.setToday(dayRec('2026-11-09'));
        State.closeGoalPeriods(NOON(2026, 11, 9));
        expect(State.getToday().pg).toEqual({ climb: 1, drop: 0, met: 1, done: 0, pts: 0, items: 0 });
    });
    test('an app closed for weeks closes each missed period in order', () => {
        weeklyGoal();
        fakePersistence({});
        State.setToday(dayRec('2026-11-30'));
        const out = State.closeGoalPeriods(NOON(2026, 11, 30)); // weeks of 11-02, 11-09, 11-16, 11-23 all ended
        expect(out.map(o => o.key)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
        expect(out.every(o => o.met === false)).toBe(true);
        expect(State.getGoals().active[0].periodKey).toBe('2026-11-30');
    });
    test('performDayRollover runs the close when the day rolls over, and survives a failure inside it', () => {
        weeklyGoal();
        fakePersistence({});
        State.setToday(dayRec('2026-11-08'));
        State.setCurrentGameDate(new Date(2026, 10, 8, 0, 0, 0, 0));
        const deps = noopDeps();
        const now = NOON(2026, 11, 9);
        expect(State.performDayRollover(deps, now)).toBe(true);
        expect(State.getGoals().active[0].periodKey).toBe('2026-11-09');
        // A broken days store must never break the rollover.
        const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
        global.Persistence.loadDays = () => { throw new Error('boom'); };
        State.setCurrentGameDate(new Date(2026, 10, 15, 0, 0, 0, 0));
        deps.getCurrentGameDate = () => new Date(2026, 10, 15, 0, 0, 0, 0);
        expect(() => State.performDayRollover(deps, NOON(2026, 11, 16))).not.toThrow();
        quiet.mockRestore();
    });
    test('a milestone that watches a daily number completes at the rollover once the day is in the store', () => {
        const r = Goals.addGoal(Goals.freshGoals(), {
            name: 'Do 3 tasks', kind: 'milestone',
            targets: [{ type: 'aggregate', label: 'Tasks', metric: 'tasksDone', op: 'sum', threshold: 3, compare: 'gte' }],
        }, 6, NOON(2026, 11, 2).getTime(), 1);
        State.setGoals(Object.assign(r.goals, { seeded: true }));
        fakePersistence({ '2026-11-04': dayRec('2026-11-04', { done: Object.assign(DailyRecord.fresh().done, { task: 3 }) }) });
        State.setToday(dayRec('2026-11-05'));
        const done = State.settleGoals(NOON(2026, 11, 5));
        expect(done).toHaveLength(1);
        expect(State.getGoals().done[0].name).toBe('Do 3 tasks');
        expect(State.getGoals().active).toEqual([]);
    });
});

describe('Build B1: views, target edits, retire / delete, events', () => {
    function oneNumberGoal(over) {
        const r = Goals.addGoal(Goals.freshGoals(), Object.assign({
            name: 'Ten steps', kind: 'milestone', deadline: '2026-11-30',
            targets: [{ type: 'number', label: 'Steps', start: 0, end: 10, current: 0, unit: 'steps' }],
        }, over), 6, NOON(2026, 11, 1).getTime(), 1);
        State.setGoals(Object.assign(r.goals, { seeded: true }));
        return r.goal;
    }

    test('getGoalViews returns one view per active goal with its stage, pace and target details', () => {
        oneNumberGoal();
        State.updateGoalTarget(1, 1, { current: 6 }, NOON(2026, 11, 5));
        const views = State.getGoalViews(NOON(2026, 11, 5));
        expect(views).toHaveLength(1);
        expect(views[0]).toMatchObject({ id: 1, progress: 0.6, stage: 3 });
        expect(views[0].targets[0].detail).toMatchObject({ kind: 'number', have: 6, need: 10, noun: 'steps' });
    });
    test('an aggregate goal reads the open day and the closed days (and the closed days are read once per open day)', () => {
        const r = Goals.addGoal(Goals.freshGoals(), {
            name: 'A productive week', kind: 'recurring', period: 'week',
            targets: [{ type: 'aggregate', label: 'Tasks', metric: 'tasksDone', op: 'sum', threshold: 4, compare: 'gte' }],
        }, 6, NOON(2026, 11, 2).getTime(), 1);
        State.setGoals(Object.assign(r.goals, { seeded: true }));
        fakePersistence({ '2026-11-03': dayRec('2026-11-03', { done: Object.assign(DailyRecord.fresh().done, { task: 1 }) }) });
        const open = dayRec('2026-11-05', { done: Object.assign(DailyRecord.fresh().done, { task: 1 }) });
        State.setToday(open);
        const spy = jest.spyOn(global.Persistence, 'loadDays');
        const first = State.getGoalViews(NOON(2026, 11, 5));
        State.getGoalViews(NOON(2026, 11, 5));
        State.getGoalViews(NOON(2026, 11, 5));
        expect(first[0].progress).toBe(0.5); // 1 closed + 1 open = 2 of 4
        expect(first[0].targets[0].detail).toMatchObject({ have: 2, need: 4 });
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });
    test('getGoalViews is empty with no goals, and getGoalSlotInfo reports slots, used and the next unlock', () => {
        expect(State.getGoalViews(NOON(2026, 11, 5))).toEqual([]);
        oneNumberGoal();
        expect(State.getGoalSlotInfo()).toEqual({ slots: 2, used: 1, next: { level: 2, slots: 3 } });
        State.setPlayerLevel(9);
        State.syncGoalSlots();
        expect(State.getGoalSlotInfo()).toEqual({ slots: 6, used: 1, next: null });
    });
    test('updateGoalTarget completes a milestone at the end of its range, tells the event queue once, and saves', () => {
        oneNumberGoal();
        State.takeGoalEvents();
        global.Persistence.requestSave.mockClear();
        let r = State.updateGoalTarget(1, 1, { current: 4 }, NOON(2026, 11, 5));
        expect(r).toMatchObject({ changed: true, completed: [] });
        expect(State.takeGoalEvents()).toEqual([]);
        r = State.updateGoalTarget(1, 1, { current: 10 }, NOON(2026, 11, 5));
        expect(r.completed).toHaveLength(1);
        expect(State.getGoals().active).toEqual([]);
        const events = State.takeGoalEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: 'complete', record: { id: 1, name: 'Ten steps' } });
        expect(State.takeGoalEvents()).toEqual([]); // drained
        expect(global.Persistence.requestSave).toHaveBeenCalled();
        expect(State.updateGoalTarget(1, 1, { current: 3 }, NOON(2026, 11, 5))).toEqual({ changed: false, completed: [] }); // gone
    });
    test('a period close queues a period event with the stage change', () => {
        const r = Goals.addGoal(Goals.freshGoals(), {
            name: 'Week', kind: 'recurring', period: 'week', stage: 2,
            targets: [{ type: 'aggregate', label: 'Tasks', metric: 'tasksDone', op: 'sum', threshold: 3, compare: 'gte' }],
        }, 6, NOON(2026, 11, 2).getTime(), 1);
        State.setGoals(Object.assign(r.goals, { seeded: true }));
        State.takeGoalEvents();
        fakePersistence({});
        State.setToday(dayRec('2026-11-09'));
        State.closeGoalPeriods(NOON(2026, 11, 9));
        expect(State.takeGoalEvents()).toEqual([
            { type: 'period', goalId: 1, name: 'Week', period: 'week', key: '2026-11-02', met: false, stageBefore: 2, stageAfter: 1, streak: 0, pts: 0, item: null, itemStatus: null, reward: '' },
        ]);
    });
    test('retireGoal moves a goal to the roster; deleteGoal drops it with no roster entry', () => {
        oneNumberGoal();
        const rec = State.retireGoal(1, NOON(2026, 11, 5));
        expect(rec).toMatchObject({ id: 1, name: 'Ten steps' });
        expect(State.getGoals().active).toEqual([]);
        expect(State.getGoals().done).toHaveLength(1);
        expect(State.retireGoal(1, NOON(2026, 11, 5))).toBeNull();
        oneNumberGoal();
        expect(State.deleteGoal(1)).toBe(true);
        expect(State.getGoals().active).toEqual([]);
        expect(State.getGoals().done).toEqual([]);
        expect(State.deleteGoal(1)).toBe(false);
    });
});

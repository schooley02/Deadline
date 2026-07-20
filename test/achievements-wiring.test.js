/**
 * Achievements live-wiring tests (Milestone 4 achievements sub-session 2,
 * 2026-07-20 session 65 — docs/ACHIEVEMENTS_PLAN.md).
 *
 * The pure catalog math has its own suite (test/achievements.test.js); this
 * file tests the SEAMS — the optional `recordLifetime(event, value)`
 * collaborator items.js dispatches through, and the `recordLifetimeRunEnd`
 * collaborator damage.js's gameOver fires on a real (non-alreadyOver) death.
 * script.js owns the actual lifetimeStats mutation + evaluate + toast; here
 * we capture the dispatch calls, which is the whole contract items.js and
 * damage.js carry.
 *
 * Key invariants under test:
 *  - taskCompleted/habitCompleted mirror the currentRunStats seams exactly
 *    (incl. sub-tasks-count-as-tasks) but ALSO reverse on uncompletion
 *    (plan scope guard: symmetric decrement, no badge-progress farming).
 *  - streakReached fires at both LIVE streak-update sites (completeItem,
 *    check-in 'avoided') and BEFORE habitCompleted in the same turn (the
 *    toast queue relies on same-turn batching; streak notice paints first).
 *  - pointsRecovered fires only on a genuine negative→≥0 crossing.
 *  - recordLifetimeRunEnd fires only on a real death, never on an
 *    alreadyOver restore (the session-55 duplicate-finalize trap).
 *  - Every collaborator is optional (older/partial deps never throw).
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.RunStats = require('../js/runStats.js');
const Items = require('../js/items.js');
const Damage = require('../js/damage.js');

function fakeEl() {
    return {
        style: {},
        dataset: {},
        textContent: '',
        classList: { add: () => {}, remove: () => {} },
        addEventListener: () => {},
        appendChild: () => {},
        remove: () => {},
    };
}

beforeAll(() => { global.document = { createElement: () => fakeEl() }; });
afterAll(() => { delete global.document; });

function tomorrowNoon() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return d;
}

function taskItem(overrides = {}) {
    return {
        id: 1, type: 'task', definitionId: null, name: 'Task', category: 'other',
        isHighPriority: false, dueDateTime: tomorrowNoon(), isOverdue: false,
        lastDamageTickTime: null, parentId: null, subTasks: [],
        completedSubTasks: 0, totalSubTasks: 0, element: fakeEl(), listItemElement: null,
        ...overrides,
    };
}
function habitItem(overrides = {}) {
    return {
        id: 2, type: 'habit', definitionId: 'h1', name: 'Habit', category: 'health',
        isNegative: false, dueDateTime: tomorrowNoon(), originalDueDate: new Date(),
        isOverdue: false, lastDamageTickTime: null, parentId: null, streak: 0,
        element: fakeEl(), listItemElement: null,
        ...overrides,
    };
}
function positiveHabitDef(overrides = {}) {
    return { id: 'h1', name: 'Habit', isNegative: false, routineId: null,
             streak: 0, lastCompletionDate: null, occurrenceHistory: [], ...overrides };
}

// Same deps-bag shape as test/items-run-stats.test.js, plus a `calls`
// capture array for the recordLifetime dispatches and a settable starting
// points balance (for the Back in Black crossing cases).
function makeDeps(overrides = {}) {
    let xp = 0;
    let points = ('points' in overrides) ? overrides.points : 100;
    const calls = [];
    const activeItems = overrides.activeItems || [];
    const definedHabits = overrides.definedHabits || [];
    const definedRoutines = overrides.definedRoutines || [];
    const completedItems = overrides.completedItems || [];
    const currentRunStats = overrides.currentRunStats || RunStats.freshRunStats();
    const {
        activeItems: _a, definedHabits: _d, definedRoutines: _r,
        completedItems: _c, currentRunStats: _s, points: _p, ...rest
    } = overrides;
    return {
        _calls: calls,
        isGameOver: () => false,
        activeItems,
        definedHabits: () => definedHabits,
        definedRoutines: () => definedRoutines,
        completedItems: () => completedItems,
        getCurrentRunStats: () => currentRunStats,
        recordLifetime: (event, value) => { calls.push([event, value]); },
        xpPerTaskDefeat: CONFIG.XP_PER_TASK_DEFEAT,
        xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
        pointsPerTask: CONFIG.POINTS_PER_TASK,
        pointsPerHabit: CONFIG.POINTS_PER_HABIT,
        habitStreakBonusThreshold: CONFIG.HABIT_STREAK_BONUS_THRESHOLD,
        getPlayerXP: () => xp,
        setPlayerXP: (n) => { xp = n; },
        getPlayerPoints: () => points,
        setPlayerPoints: (n) => { points = n; },
        updatePlayerDisplays: () => {},
        checkPlayerLevelUp: () => {},
        createListItem: () => {},
        sortAndRenderActiveList: () => {},
        renderCompletedItems: () => {},
        updateTaskCountDisplay: () => {},
        resetAllSubTaskCheckboxes: () => {},
        saveGame: () => {},
        baseWidth: 120,
        enemyWidth: CONFIG.ENEMY_WIDTH,
        habitEnemyWidth: CONFIG.HABIT_ENEMY_WIDTH,
        gameCanvas: fakeEl(),
        calculateTimelineXWithClustering: () => 0,
        getSubTaskClusterOffset: () => 0,
        getItemTopPosition: () => 0,
        handleEnemyClick: () => {},
        ...rest,
    };
}

function eventsOf(deps) { return deps._calls.map(([e]) => e); }

describe('completeItem dispatches lifetime counter bumps', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('a standalone task completion dispatches taskCompleted +1', () => {
        const deps = makeDeps({ activeItems: [taskItem()] });
        Items.completeItem(1, deps);
        expect(deps._calls).toEqual([['taskCompleted', 1]]);
    });

    test('a sub-task completion still dispatches taskCompleted +1 (sub-tasks count as tasks)', () => {
        const parent = taskItem({ id: 9, subTasks: [1], totalSubTasks: 1 });
        const sub = taskItem({ id: 1, parentId: 9 });
        const deps = makeDeps({ activeItems: [parent, sub] });
        Items.completeItem(1, deps);
        expect(deps._calls).toEqual([['taskCompleted', 1]]);
    });

    test('a habit completion dispatches streakReached (new streak) THEN habitCompleted +1', () => {
        const deps = makeDeps({ activeItems: [habitItem()], definedHabits: [positiveHabitDef()] });
        Items.completeItem(2, deps);
        expect(deps._calls).toEqual([['streakReached', 1], ['habitCompleted', 1]]);
    });

    test('streakReached carries the post-completion streak value', () => {
        const deps = makeDeps({
            activeItems: [habitItem()],
            definedHabits: [positiveHabitDef({ streak: 6, lastCompletionDate: Habits.toOccurrenceDate(new Date(Date.now() - 24 * 60 * 60 * 1000)) })],
        });
        Items.completeItem(2, deps);
        const streakCall = deps._calls.find(([e]) => e === 'streakReached');
        expect(streakCall[1]).toBe(7);
    });

    test('no dispatch when recordLifetime is not provided (older/partial deps)', () => {
        const deps = makeDeps({ activeItems: [taskItem()] });
        delete deps.recordLifetime;
        expect(() => Items.completeItem(1, deps)).not.toThrow();
    });
});

describe('Back in Black crossing (pointsRecovered)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('a completion award lifting the balance from negative to ≥0 dispatches pointsRecovered', () => {
        const deps = makeDeps({ activeItems: [taskItem()], points: -1 });
        Items.completeItem(1, deps);
        expect(eventsOf(deps)).toContain('pointsRecovered');
    });

    test('no dispatch when the balance was already non-negative', () => {
        const deps = makeDeps({ activeItems: [taskItem()], points: 100 });
        Items.completeItem(1, deps);
        expect(eventsOf(deps)).not.toContain('pointsRecovered');
    });

    test('no dispatch when the award leaves the balance still negative', () => {
        const deps = makeDeps({ activeItems: [taskItem()], points: -100000 });
        Items.completeItem(1, deps);
        expect(eventsOf(deps)).not.toContain('pointsRecovered');
    });
});

describe('uncompleteItem dispatches symmetric decrements', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('complete → uncomplete a task nets taskCompleted +1 then −1', () => {
        const item = taskItem();
        const deps = makeDeps({ activeItems: [item] });
        Items.completeItem(1, deps);
        jest.runOnlyPendingTimers(); // let the fade-out removeItem run
        Items.uncompleteItem(1, deps);
        expect(deps._calls).toEqual([['taskCompleted', 1], ['taskCompleted', -1]]);
    });

    test('complete → uncomplete a habit nets habitCompleted +1 then −1 (streakReached untouched — high-water mark)', () => {
        const item = habitItem();
        const deps = makeDeps({ activeItems: [item], definedHabits: [positiveHabitDef()] });
        Items.completeItem(2, deps);
        jest.runOnlyPendingTimers();
        Items.uncompleteItem(2, deps);
        const events = eventsOf(deps);
        expect(events.filter(e => e === 'habitCompleted').length).toBe(2);
        expect(deps._calls.filter(([e]) => e === 'habitCompleted').map(([, v]) => v)).toEqual([1, -1]);
        // exactly one streakReached — the completion's; uncompletion never
        // dispatches a streak rollback (bestHabitStreak is a high-water mark)
        expect(events.filter(e => e === 'streakReached').length).toBe(1);
    });

    test('no-ops safely without recordLifetime', () => {
        const item = taskItem();
        const deps = makeDeps({ activeItems: [item] });
        delete deps.recordLifetime;
        Items.completeItem(1, deps);
        jest.runOnlyPendingTimers();
        expect(() => Items.uncompleteItem(1, deps)).not.toThrow();
    });
});

describe("check-in 'avoided' dispatches streakReached but NOT habitCompleted", () => {
    function negativeHabitDef(overrides = {}) {
        return positiveHabitDef({
            isNegative: true,
            pendingCheckIn: { originalDueDate: new Date() },
            ...overrides,
        });
    }

    test("'avoided' fires streakReached with the new streak, no habit-count bump (mirrors currentRunStats)", () => {
        const habitDef = negativeHabitDef();
        const deps = makeDeps({ definedHabits: [habitDef] });
        Items.resolvePendingCheckIn('h1', 'avoided', deps);
        expect(deps._calls.filter(([e]) => e === 'streakReached')).toEqual([['streakReached', habitDef.streak]]);
        expect(eventsOf(deps)).not.toContain('habitCompleted');
    });

    test("'avoided' award can also fire the Back in Black crossing", () => {
        const habitDef = negativeHabitDef();
        const deps = makeDeps({ definedHabits: [habitDef], points: -1 });
        Items.resolvePendingCheckIn('h1', 'avoided', deps);
        expect(eventsOf(deps)).toContain('pointsRecovered');
    });

    test("'indulged' dispatches nothing (a debit can only sink the balance)", () => {
        const habitDef = negativeHabitDef();
        const deps = makeDeps({ definedHabits: [habitDef] });
        Items.resolvePendingCheckIn('h1', 'indulged', deps);
        expect(deps._calls).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
describe('gameOver dispatches recordLifetimeRunEnd only on a REAL death', () => {
    // Same deps-bag approach as test/damage.test.js's run-history describes.
    function damageDeps(overrides = {}) {
        let history = overrides.runHistory || [];
        const stats = overrides.currentRunStats || RunStats.freshRunStats();
        const state = { formControls: [], daysSurvived: 0 };
        const runEndCalls = [];
        return {
            _state: state,
            _runEndCalls: runEndCalls,
            getBaseHealth: () => 0,
            setBaseHealth: () => {},
            isGameOver: () => false,
            setGameOver: () => {},
            getActiveItems: () => [],
            getRunStartedAtMs: () => Date.now() - 5 * CONFIG.MS_PER_REAL_DAY,
            getDaysSurvived: () => state.daysSurvived,
            setDaysSurvived: (n) => { state.daysSurvived = n; },
            getGameLoopInterval: () => null,
            baseElement: fakeEl(),
            gameOverMessage: fakeEl(),
            restartButton: fakeEl(),
            enableFormControls: () => {},
            saveGame: () => {},
            getCurrentRunStats: () => stats,
            getRunHistory: () => history,
            setRunHistory: (arr) => { history = arr; },
            getDefinedRoutines: () => overrides.definedRoutines || [],
            getDefinedHabits: () => [],
            heroesCompletionRate: overrides.heroesCompletionRate || (() => null),
            heroesStarRating: () => null,
            recordLifetimeRunEnd: (record, days) => { runEndCalls.push({ record, days }); },
            ...overrides.extraDeps,
        };
    }

    test('a real death passes the freshly finalized record + frozen daysSurvived', () => {
        const deps = damageDeps();
        Damage.gameOver(deps);
        expect(deps._runEndCalls).toHaveLength(1);
        expect(deps._runEndCalls[0].days).toBe(5);
        expect(deps._runEndCalls[0].record).toBe(deps.getRunHistory()[0]);
    });

    test('an alreadyOver restore NEVER dispatches (session-55 duplicate-finalize trap)', () => {
        const record = { runNumber: 1, daysSurvived: 5, routines: [] };
        const deps = damageDeps({ runHistory: [record] });
        deps._state.daysSurvived = 5;
        Damage.gameOver(deps, true);
        expect(deps._runEndCalls).toHaveLength(0);
    });

    test('no-ops safely when recordLifetimeRunEnd is not provided', () => {
        const deps = damageDeps();
        delete deps.recordLifetimeRunEnd;
        expect(() => Damage.gameOver(deps)).not.toThrow();
    });
});

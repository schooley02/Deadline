/**
 * Run-history counter/attribution wiring tests (Run history sub-session 2,
 * 2026-07-19 session 53) — the items.js layer that calls into js/runStats.js
 * (which has its own pure-math suite in test/run-stats.test.js) from
 * completeItem/markAsOverdue/recordRunDamageForItem.
 *
 * Key invariant under test: counters are "what occurred", not a net ledger
 * (docs/RUN_HISTORY_PLAN.md fork 2 + js/runStats.js header) — a habit that
 * goes overdue (miss recorded) and is later completed anyway shows BOTH the
 * miss and the completion, deliberately not corrected. Same reasoning
 * recordPointsEarned already used for not reversing on uncompletion.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.RunStats = require('../js/runStats.js');
const Items = require('../js/items.js');

function fakeEl() {
    return {
        style: {},
        dataset: {},
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
function yesterdayNoon() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
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

function makeDeps(overrides = {}) {
    let xp = 0, points = 100;
    const activeItems = overrides.activeItems || [];
    const definedHabits = overrides.definedHabits || [];
    const definedRoutines = overrides.definedRoutines || [];
    const completedItems = overrides.completedItems || [];
    const currentRunStats = overrides.currentRunStats || RunStats.freshRunStats();
    const {
        activeItems: _a, definedHabits: _d, definedRoutines: _r,
        completedItems: _c, currentRunStats: _s, ...rest
    } = overrides;
    return {
        isGameOver: () => false,
        activeItems,
        definedHabits: () => definedHabits,
        definedRoutines: () => definedRoutines,
        completedItems: () => completedItems,
        getCurrentRunStats: () => currentRunStats,
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

describe('completeItem records run-stats counters', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('a standalone task completion increments tasksCompleted + pointsEarned', () => {
        const item = taskItem();
        const stats = RunStats.freshRunStats();
        const deps = makeDeps({ activeItems: [item], currentRunStats: stats });

        Items.completeItem(1, deps);

        expect(stats.tasksCompleted).toBe(1);
        expect(stats.habitsCompleted).toBe(0);
        expect(stats.pointsEarned).toBe(Economy.taskPoints(false, CONFIG.POINTS_PER_TASK));
    });

    test('a sub-task completion still counts as a task (half value)', () => {
        const parent = taskItem({ id: 9, subTasks: [1], totalSubTasks: 1 });
        const sub = taskItem({ id: 1, parentId: 9 });
        const stats = RunStats.freshRunStats();
        const deps = makeDeps({ activeItems: [parent, sub], currentRunStats: stats });

        Items.completeItem(1, deps);

        expect(stats.tasksCompleted).toBe(1);
        expect(stats.pointsEarned).toBe(CONFIG.SUBTASK_POINTS);
    });

    test('a habit completion increments habitsCompleted, not tasksCompleted', () => {
        const item = habitItem();
        const habitDef = positiveHabitDef();
        const stats = RunStats.freshRunStats();
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef], currentRunStats: stats });

        Items.completeItem(2, deps);

        expect(stats.habitsCompleted).toBe(1);
        expect(stats.tasksCompleted).toBe(0);
        expect(stats.pointsEarned).toBeGreaterThan(0);
    });

    test('a habit completed late (after going overdue) counts BOTH the earlier miss and this completion — no correction', () => {
        const item = habitItem({ isOverdue: true, dueDateTime: yesterdayNoon() });
        const habitDef = positiveHabitDef();
        const stats = RunStats.freshRunStats();
        stats.habitsMissed = 1; // as markAsOverdue would have already recorded
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef], currentRunStats: stats });

        Items.completeItem(2, deps);

        expect(stats.habitsCompleted).toBe(1);
        expect(stats.habitsMissed).toBe(1); // untouched — see header comment
    });

    test('no-ops safely when getCurrentRunStats is not provided (older/partial deps)', () => {
        const item = taskItem();
        const deps = makeDeps({ activeItems: [item] });
        delete deps.getCurrentRunStats;

        expect(() => Items.completeItem(1, deps)).not.toThrow();
    });
});

describe('markAsOverdue records a habit miss', () => {
    test('a positive habit going overdue increments habitsMissed', () => {
        const item = habitItem();
        const habitDef = positiveHabitDef();
        const stats = RunStats.freshRunStats();
        const deps = makeDeps({ definedHabits: [habitDef], currentRunStats: stats, saveGame: () => {} });

        Items.markAsOverdue(item, new Date(), deps);

        expect(stats.habitsMissed).toBe(1);
    });

    test('a negative habit never reaches this branch (isNonThreatening guard) — no miss recorded', () => {
        const item = habitItem({ isNegative: true });
        const habitDef = positiveHabitDef({ isNegative: true });
        const stats = RunStats.freshRunStats();
        const deps = makeDeps({ definedHabits: [habitDef], currentRunStats: stats, saveGame: () => {} });

        Items.markAsOverdue(item, new Date(), deps);

        expect(stats.habitsMissed).toBe(0);
        expect(item.isOverdue).toBe(false); // untouched — isNonThreatening returns early before the set
    });

    test('a task going overdue does not touch habitsMissed (tasks have no miss counter)', () => {
        const item = taskItem();
        const stats = RunStats.freshRunStats();
        const deps = makeDeps({ currentRunStats: stats, saveGame: () => {} });

        Items.markAsOverdue(item, new Date(), deps);

        expect(stats.habitsMissed).toBe(0);
    });

    test('no-ops safely when getCurrentRunStats is not provided', () => {
        const item = habitItem();
        const habitDef = positiveHabitDef();
        const deps = makeDeps({ definedHabits: [habitDef], saveGame: () => {} });
        delete deps.getCurrentRunStats;

        expect(() => Items.markAsOverdue(item, new Date(), deps)).not.toThrow();
    });
});

describe('recordRunDamageForItem attributes damage with the correct routineId', () => {
    test('a routine-owned habit resolves its routine via findRoutineForItem', () => {
        const routine = { id: 'r1', name: 'Morning', habitDefinitionIds: ['h1'], taskDefinitionIds: [] };
        const habitDef = positiveHabitDef({ routineId: 'r1' });
        const item = habitItem();
        const stats = RunStats.freshRunStats();
        const deps = makeDeps({ definedHabits: [habitDef], definedRoutines: [routine], currentRunStats: stats });

        Items.recordRunDamageForItem(item, 1, 1750000000000, deps);

        const row = Object.values(stats.blame)[0];
        expect(row.routineId).toBe('r1');
        expect(row.totalDamage).toBe(1);
    });

    test('a standalone task attributes with routineId null', () => {
        const item = taskItem();
        const stats = RunStats.freshRunStats();
        const deps = makeDeps({ currentRunStats: stats });

        Items.recordRunDamageForItem(item, 5, 1750000000000, deps);

        expect(Object.values(stats.blame)[0].routineId).toBeNull();
    });

    test('no-ops safely when getCurrentRunStats is not provided', () => {
        const item = taskItem();
        const deps = makeDeps({});
        delete deps.getCurrentRunStats;

        expect(() => Items.recordRunDamageForItem(item, 5, Date.now(), deps)).not.toThrow();
    });
});

/**
 * Pushback charges Build B (2026-11-02): an item pushed back inside its last 4 hours carries `pushedLate`, and
 * completing it records the daily `done.late` so the Clock tower (punctuality = done minus late) skips it.
 * Grace and calm moves never set the flag, so those items still count. Undo reverses the same bucket.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.DailyRecord = require('../js/dailyRecord.js');
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

function recorded() {
    const rec = DailyRecord.fresh({ date: '2026-11-02', tz: 0 });
    return { rec, recordDaily: (ev, p) => DailyRecord.bump(rec, ev, p) };
}

describe('pushedLate feeds the daily record late bucket', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('a normal on-time completion is not late', () => {
        const { rec, recordDaily } = recorded();
        const deps = makeDeps({ activeItems: [taskItem()], recordDaily });
        Items.completeItem(1, deps);
        expect(rec.done.task).toBe(1);
        expect(rec.done.late).toBe(0);
    });

    test('a pushedLate item that is NOT overdue is recorded late', () => {
        const { rec, recordDaily } = recorded();
        const deps = makeDeps({ activeItems: [taskItem({ pushedLate: true })], recordDaily });
        Items.completeItem(1, deps);
        expect(rec.done.task).toBe(1);
        expect(rec.done.late).toBe(1);
    });

    test('a pushedLate habit is recorded late too', () => {
        const { rec, recordDaily } = recorded();
        const deps = makeDeps({ activeItems: [habitItem({ pushedLate: true })], definedHabits: [positiveHabitDef()], recordDaily });
        Items.completeItem(2, deps);
        expect(rec.done.habit).toBe(1);
        expect(rec.done.late).toBe(1);
    });

    test('an overdue item is still late (unchanged)', () => {
        const { rec, recordDaily } = recorded();
        const deps = makeDeps({ activeItems: [taskItem({ isOverdue: true, dueDateTime: yesterdayNoon() })], recordDaily });
        Items.completeItem(1, deps);
        expect(rec.done.late).toBe(1);
    });

    test('undo of a pushedLate completion reverses the late bucket', () => {
        const { rec, recordDaily } = recorded();
        const completed = [];
        const deps = makeDeps({ activeItems: [taskItem({ pushedLate: true })], completedItems: completed, recordDaily });
        Items.completeItem(1, deps);
        expect(rec.done.late).toBe(1);
        Items.uncompleteItem(1, deps);
        expect(rec.done.task).toBe(0);
        expect(rec.done.late).toBe(0);
    });
});

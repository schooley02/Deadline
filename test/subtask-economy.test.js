/**
 * Sub-task economy ([P1-DATA-004] sub-session 3, 2026-07-19 session 49) —
 * half-value sub-tasks through the existing Economy.taskPoints seam.
 * CONFIG.SUBTASK_XP/SUBTASK_POINTS (5/5) replace the standalone
 * xpPerTaskDefeat/pointsPerTask (10/10) base whenever item.parentId is set;
 * the high-priority ×2 rule still applies on top via Economy.taskPoints, so
 * a high-priority sub tops out at 10 (parity with, never exceeding, a
 * standalone task). Parents and standalone tasks are unaffected. Award
 * (completeItem) and refund (uncompleteItem) must be exactly symmetric.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
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

beforeAll(() => {
    global.document = { createElement: () => fakeEl() };
});
afterAll(() => {
    delete global.document;
});

function tomorrowNoon() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return d;
}

function taskItem(overrides = {}) {
    return {
        id: 1, type: 'task', name: 'Task', category: 'other',
        isHighPriority: false, dueDateTime: tomorrowNoon(),
        isOverdue: false, lastDamageTickTime: null, parentId: null,
        subTasks: [], completedSubTasks: 0, totalSubTasks: 0,
        element: fakeEl(), listItemElement: fakeEl(),
        ...overrides,
    };
}

function makeDeps(overrides = {}) {
    let xp = 0, points = 100;
    const activeItems = overrides.activeItems || [];
    const definedHabits = overrides.definedHabits || [];
    const definedRoutines = overrides.definedRoutines || [];
    const completedItems = overrides.completedItems || [];
    const {
        activeItems: _a, definedHabits: _d, definedRoutines: _r, completedItems: _c, ...rest
    } = overrides;
    return {
        isGameOver: () => false,
        activeItems,
        definedHabits: () => definedHabits,
        definedRoutines: () => definedRoutines,
        completedItems: () => completedItems,
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

describe('completeItem: sub-task economy award', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('a standalone task awards the full base 10 XP / 10 pts', () => {
        const task = taskItem({ id: 1, isHighPriority: false });
        const deps = makeDeps({ activeItems: [task] });

        Items.completeItem(1, deps);

        expect(deps.getPlayerXP()).toBe(10);
        expect(deps.getPlayerPoints()).toBe(110); // 100 starting + 10
    });

    test('a sub-task (parentId set) awards half: 5 XP / 5 pts', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1, isHighPriority: false });
        const deps = makeDeps({ activeItems: [parent, sub] });

        Items.completeItem(2, deps);

        expect(deps.getPlayerXP()).toBe(5);
        expect(deps.getPlayerPoints()).toBe(105);
    });

    test('a HIGH-PRIORITY sub-task still gets the ×2 rule on the halved base: 5 XP / 10 pts', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1, isHighPriority: true });
        const deps = makeDeps({ activeItems: [parent, sub] });

        Items.completeItem(2, deps);

        // XP has no priority multiplier anywhere in this codebase — stays 5.
        expect(deps.getPlayerXP()).toBe(5);
        // Points: SUBTASK_POINTS (5) × 2 = 10 — parity with, not exceeding, a
        // standalone high-priority task's own ×2 (10 × 2 = 20 would be the
        // standalone case, confirmed in the next test).
        expect(deps.getPlayerPoints()).toBe(110);
    });

    test('a HIGH-PRIORITY standalone task still pays the full ×2: 10 XP / 20 pts', () => {
        const task = taskItem({ id: 1, isHighPriority: true });
        const deps = makeDeps({ activeItems: [task] });

        Items.completeItem(1, deps);

        expect(deps.getPlayerXP()).toBe(10);
        expect(deps.getPlayerPoints()).toBe(120);
    });

    test('a parent with subs is unaffected by the sub rate once it completes (still full 10/10)', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1 });
        const deps = makeDeps({ activeItems: [parent, sub] });

        Items.completeItem(2, deps); // clears parent.subTasks first
        expect(parent.subTasks).toHaveLength(0);

        const beforeXp = deps.getPlayerXP();
        const beforePts = deps.getPlayerPoints();
        Items.completeItem(1, deps);

        expect(deps.getPlayerXP()).toBe(beforeXp + 10);
        expect(deps.getPlayerPoints()).toBe(beforePts + 10);
    });

    test('multiple subs each independently pay the half rate', () => {
        const parent = taskItem({ id: 1, subTasks: [2, 3], totalSubTasks: 2 });
        const sub1 = taskItem({ id: 2, parentId: 1 });
        const sub2 = taskItem({ id: 3, parentId: 1 });
        const deps = makeDeps({ activeItems: [parent, sub1, sub2] });

        Items.completeItem(2, deps);
        Items.completeItem(3, deps);

        expect(deps.getPlayerXP()).toBe(10); // 5 + 5
        expect(deps.getPlayerPoints()).toBe(110); // 100 + 5 + 5
    });
});

describe('uncompleteItem: sub-task economy refund symmetry', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('completing then uncompleting a sub-task nets exactly 0 XP/points change', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1, isHighPriority: false });
        const deps = makeDeps({ activeItems: [parent, sub], completedItems: [] });

        const startXp = deps.getPlayerXP();
        const startPts = deps.getPlayerPoints();

        Items.completeItem(2, deps);
        expect(deps.getPlayerXP()).toBe(startXp + 5);
        expect(deps.getPlayerPoints()).toBe(startPts + 5);

        // completeItem's removeItem runs on a 500ms fade-out setTimeout — run
        // it so the item actually leaves activeItems before uncompleteItem
        // pushes it back (otherwise it'd be double-pushed under fake timers).
        jest.advanceTimersByTime(500);

        Items.uncompleteItem(2, deps);
        expect(deps.getPlayerXP()).toBe(startXp);
        expect(deps.getPlayerPoints()).toBe(startPts);
    });

    test('a high-priority sub round-trips symmetrically too (award 5/10, refund 5/10)', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1, isHighPriority: true });
        const deps = makeDeps({ activeItems: [parent, sub], completedItems: [] });

        const startXp = deps.getPlayerXP();
        const startPts = deps.getPlayerPoints();

        Items.completeItem(2, deps);
        expect(deps.getPlayerXP()).toBe(startXp + 5);
        expect(deps.getPlayerPoints()).toBe(startPts + 10);

        jest.advanceTimersByTime(500);

        Items.uncompleteItem(2, deps);
        expect(deps.getPlayerXP()).toBe(startXp);
        expect(deps.getPlayerPoints()).toBe(startPts);
    });

    test('a standalone task still round-trips at the full 10/10 rate (regression guard)', () => {
        const task = taskItem({ id: 1 });
        const deps = makeDeps({ activeItems: [task], completedItems: [] });

        const startXp = deps.getPlayerXP();
        const startPts = deps.getPlayerPoints();

        Items.completeItem(1, deps);
        jest.advanceTimersByTime(500);
        Items.uncompleteItem(1, deps);

        expect(deps.getPlayerXP()).toBe(startXp);
        expect(deps.getPlayerPoints()).toBe(startPts);
    });
});

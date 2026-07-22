/**
 * Sub-task economy ([P1-DATA-004] sub-session 3, 2026-07-19 session 49;
 * points RE-TUNED 2026-07-21, Jeremy's call — see DECISIONS.md).
 * CONFIG.SUBTASK_XP/SUBTASK_POINTS (5/1) replace the standalone
 * xpPerTaskDefeat/pointsPerTask (10/1) base whenever item.parentId is set;
 * the high-priority ×2 rule still applies on top via Economy.taskPoints.
 * A parent that EVER had a sub-task (completedSubTasks > 0) now pays 0
 * POINTS of its own on final completion — all the points for a sub-tasked
 * task come from its subs, not from checking off the parent — but still
 * earns its own full XP either way (XP is untouched by this rule). A
 * standalone task that never had subs is unaffected. Award (completeItem)
 * and refund (uncompleteItem) must be exactly symmetric.
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

    test('a standalone task awards the full base 10 XP / 1 pt', () => {
        const task = taskItem({ id: 1, isHighPriority: false });
        const deps = makeDeps({ activeItems: [task] });

        Items.completeItem(1, deps);

        expect(deps.getPlayerXP()).toBe(10);
        expect(deps.getPlayerPoints()).toBe(101); // 100 starting + 1
    });

    test('a sub-task (parentId set) awards its own base: 5 XP / 1 pt', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1, isHighPriority: false });
        const deps = makeDeps({ activeItems: [parent, sub] });

        Items.completeItem(2, deps);

        expect(deps.getPlayerXP()).toBe(5);
        expect(deps.getPlayerPoints()).toBe(101);
    });

    test('a HIGH-PRIORITY sub-task still gets the ×2 rule on its base: 5 XP / 2 pts', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1, isHighPriority: true });
        const deps = makeDeps({ activeItems: [parent, sub] });

        Items.completeItem(2, deps);

        // XP has no priority multiplier anywhere in this codebase — stays 5.
        expect(deps.getPlayerXP()).toBe(5);
        // Points: SUBTASK_POINTS (1) × 2 = 2 — same ceiling logic as a
        // standalone high-priority task's own ×2 (1 × 2 = 2, confirmed in
        // the next test).
        expect(deps.getPlayerPoints()).toBe(102);
    });

    test('a HIGH-PRIORITY standalone task still pays the full ×2: 10 XP / 2 pts', () => {
        const task = taskItem({ id: 1, isHighPriority: true });
        const deps = makeDeps({ activeItems: [task] });

        Items.completeItem(1, deps);

        expect(deps.getPlayerXP()).toBe(10);
        expect(deps.getPlayerPoints()).toBe(102);
    });

    test('a parent that HAD subs earns 0 points of its own on final completion (still full 10 XP)', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1 });
        const deps = makeDeps({ activeItems: [parent, sub] });

        Items.completeItem(2, deps); // clears parent.subTasks first, bumps completedSubTasks
        expect(parent.subTasks).toHaveLength(0);
        expect(parent.completedSubTasks).toBe(1);

        const beforeXp = deps.getPlayerXP();
        const beforePts = deps.getPlayerPoints();
        Items.completeItem(1, deps);

        expect(deps.getPlayerXP()).toBe(beforeXp + 10); // XP untouched by this rule
        expect(deps.getPlayerPoints()).toBe(beforePts); // 0 points — all pts already came from the sub
    });

    test('multiple subs each independently pay their own base, parent still pays 0', () => {
        const parent = taskItem({ id: 1, subTasks: [2, 3], totalSubTasks: 2 });
        const sub1 = taskItem({ id: 2, parentId: 1 });
        const sub2 = taskItem({ id: 3, parentId: 1 });
        const deps = makeDeps({ activeItems: [parent, sub1, sub2] });

        Items.completeItem(2, deps);
        Items.completeItem(3, deps);

        expect(deps.getPlayerXP()).toBe(10); // 5 + 5
        expect(deps.getPlayerPoints()).toBe(102); // 100 + 1 + 1

        Items.completeItem(1, deps); // parent, now with completedSubTasks: 2
        expect(deps.getPlayerXP()).toBe(20); // + parent's own 10 XP
        expect(deps.getPlayerPoints()).toBe(102); // + 0 points
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
        expect(deps.getPlayerPoints()).toBe(startPts + 1);

        // completeItem's removeItem runs on a 500ms fade-out setTimeout — run
        // it so the item actually leaves activeItems before uncompleteItem
        // pushes it back (otherwise it'd be double-pushed under fake timers).
        jest.advanceTimersByTime(500);

        Items.uncompleteItem(2, deps);
        expect(deps.getPlayerXP()).toBe(startXp);
        expect(deps.getPlayerPoints()).toBe(startPts);
    });

    test('a high-priority sub round-trips symmetrically too (award 5/2, refund 5/2)', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1, isHighPriority: true });
        const deps = makeDeps({ activeItems: [parent, sub], completedItems: [] });

        const startXp = deps.getPlayerXP();
        const startPts = deps.getPlayerPoints();

        Items.completeItem(2, deps);
        expect(deps.getPlayerXP()).toBe(startXp + 5);
        expect(deps.getPlayerPoints()).toBe(startPts + 2);

        jest.advanceTimersByTime(500);

        Items.uncompleteItem(2, deps);
        expect(deps.getPlayerXP()).toBe(startXp);
        expect(deps.getPlayerPoints()).toBe(startPts);
    });

    test('a standalone task still round-trips at the full 10/1 rate (regression guard)', () => {
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

    test('a parent that HAD subs round-trips at 10 XP / 0 pts (uncompleting refunds nothing extra)', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1 });
        const deps = makeDeps({ activeItems: [parent, sub], completedItems: [] });

        Items.completeItem(2, deps); // sub pays 5 XP / 1 pt, parent.completedSubTasks -> 1
        jest.advanceTimersByTime(500);

        const beforeXp = deps.getPlayerXP();
        const beforePts = deps.getPlayerPoints();

        Items.completeItem(1, deps); // parent pays 10 XP / 0 pts
        expect(deps.getPlayerXP()).toBe(beforeXp + 10);
        expect(deps.getPlayerPoints()).toBe(beforePts);

        jest.advanceTimersByTime(500);
        Items.uncompleteItem(1, deps); // refund mirrors: -10 XP / -0 pts
        expect(deps.getPlayerXP()).toBe(beforeXp);
        expect(deps.getPlayerPoints()).toBe(beforePts);
    });
});

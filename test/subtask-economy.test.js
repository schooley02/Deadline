/**
 * Sub-task economy ([P1-DATA-004] sub-session 3, 2026-07-19; REWORKED 2026-11-11, Jeremy; DECISIONS 2026-11-11 (sub-task credit)).
 * A task is worth the same however it is split: a sub-task pays up to CONFIG.SUBTASK_XP (5) but all the subs of one parent together
 * stop at CONFIG.SUBTASK_XP_FAMILY_CAP (10), and sub-tasks pay CONFIG.SUBTASK_POINTS (0). The PARENT pays its normal points (1, x2 when
 * priority) plus its own 10 XP when it is finished. Award (completeItem) and refund (uncompleteItem) must be exactly symmetric:
 * the XP and points actually paid are stamped on the item (`subXpAwarded`, `taskPointsAwarded`) and the parent tallies the family's
 * sub-task XP in `subXpEarned`. Items completed before the stamps existed are refunded under the rule that paid them.
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

    test('a sub-task pays 5 XP and NO points', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1, isHighPriority: false });
        const deps = makeDeps({ activeItems: [parent, sub] });

        Items.completeItem(2, deps);

        expect(deps.getPlayerXP()).toBe(5);
        expect(deps.getPlayerPoints()).toBe(100);
        expect(sub.subXpAwarded).toBe(5);
        expect(parent.subXpEarned).toBe(5);
    });

    test('a HIGH-PRIORITY sub-task still pays no points (the x2 doubles 0)', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1, isHighPriority: true });
        const sub = taskItem({ id: 2, parentId: 1, isHighPriority: true, priorityInherited: true });
        const deps = makeDeps({ activeItems: [parent, sub] });

        Items.completeItem(2, deps);

        expect(deps.getPlayerXP()).toBe(5);
        expect(deps.getPlayerPoints()).toBe(100);
    });

    test('a HIGH-PRIORITY standalone task still pays the full x2: 10 XP / 2 pts', () => {
        const task = taskItem({ id: 1, isHighPriority: true });
        const deps = makeDeps({ activeItems: [task] });

        Items.completeItem(1, deps);

        expect(deps.getPlayerXP()).toBe(10);
        expect(deps.getPlayerPoints()).toBe(102);
    });

    test('a parent that HAD subs now pays its normal 1 pt and 10 XP on final completion', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1 });
        const deps = makeDeps({ activeItems: [parent, sub] });

        Items.completeItem(2, deps); // clears parent.subTasks first, bumps completedSubTasks
        expect(parent.subTasks).toHaveLength(0);
        expect(parent.completedSubTasks).toBe(1);

        const beforeXp = deps.getPlayerXP();
        const beforePts = deps.getPlayerPoints();
        Items.completeItem(1, deps);

        expect(deps.getPlayerXP()).toBe(beforeXp + 10);
        expect(deps.getPlayerPoints()).toBe(beforePts + 1);
    });

    test('a priority parent that had subs pays x2 (2 pts), not 0', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1, isHighPriority: true });
        const sub = taskItem({ id: 2, parentId: 1, isHighPriority: true, priorityInherited: true });
        const deps = makeDeps({ activeItems: [parent, sub] });

        Items.completeItem(2, deps);
        const beforePts = deps.getPlayerPoints();
        Items.completeItem(1, deps);

        expect(deps.getPlayerPoints()).toBe(beforePts + 2);
    });

    test('the family XP cap: three subs pay 5 + 5 + 0 (all of one parent\'s subs together stop at 10)', () => {
        const parent = taskItem({ id: 1, subTasks: [2, 3, 4], totalSubTasks: 3 });
        const subs = [2, 3, 4].map(id => taskItem({ id, parentId: 1 }));
        const lifetime = jest.fn();
        const deps = makeDeps({ activeItems: [parent, ...subs], recordLifetime: lifetime });

        Items.completeItem(2, deps);
        expect(deps.getPlayerXP()).toBe(5);
        Items.completeItem(3, deps);
        expect(deps.getPlayerXP()).toBe(10);
        Items.completeItem(4, deps);
        expect(deps.getPlayerXP()).toBe(10); // the third sub pays nothing more
        expect(subs[2].subXpAwarded).toBe(0);
        expect(parent.subXpEarned).toBe(10);
        // ...but it is still a real completion for the counters.
        expect(lifetime.mock.calls.filter(c => c[0] === 'subtaskCompleted' && c[1] === 1)).toHaveLength(3);
        expect(deps.getPlayerPoints()).toBe(100); // subs pay no points
    });

    test('splitting a priority task in 5 pays 2 pts and 20 XP in all, not 10 pts', () => {
        const parent = taskItem({ id: 1, isHighPriority: true, subTasks: [2, 3, 4, 5, 6], totalSubTasks: 5 });
        const subs = [2, 3, 4, 5, 6].map(id => taskItem({ id, parentId: 1, isHighPriority: true, priorityInherited: true }));
        const deps = makeDeps({ activeItems: [parent, ...subs] });

        [2, 3, 4, 5, 6].forEach(id => Items.completeItem(id, deps));
        Items.completeItem(1, deps);

        expect(deps.getPlayerXP()).toBe(20); // 10 from the subs (capped) + the parent's own 10
        expect(deps.getPlayerPoints()).toBe(102); // the parent's x2, nothing from the subs
    });

    test('a family part-way through before the cap existed counts its finished subs at the base', () => {
        // Two subs were finished under the old rule (no subXpEarned): 10 XP already paid, so the next sub pays 0.
        const parent = taskItem({ id: 1, subTasks: [4], totalSubTasks: 1, completedSubTasks: 2 });
        const sub = taskItem({ id: 4, parentId: 1 });
        const deps = makeDeps({ activeItems: [parent, sub] });

        Items.completeItem(4, deps);

        expect(deps.getPlayerXP()).toBe(0);
        expect(sub.subXpAwarded).toBe(0);
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
        expect(deps.getPlayerPoints()).toBe(startPts);

        // completeItem's removeItem runs on a 500ms fade-out setTimeout — run
        // it so the item actually leaves activeItems before uncompleteItem
        // pushes it back (otherwise it'd be double-pushed under fake timers).
        jest.advanceTimersByTime(500);

        Items.uncompleteItem(2, deps);
        expect(deps.getPlayerXP()).toBe(startXp);
        expect(deps.getPlayerPoints()).toBe(startPts);
        expect(parent.subXpEarned).toBe(0);
        expect(sub.subXpAwarded).toBeUndefined();
        expect(sub.taskPointsAwarded).toBeUndefined();
    });

    test('a cap-limited sub (paid 0 XP) refunds 0 and leaves the family tally alone', () => {
        const parent = taskItem({ id: 1, subTasks: [2, 3, 4], totalSubTasks: 3 });
        const subs = [2, 3, 4].map(id => taskItem({ id, parentId: 1 }));
        const deps = makeDeps({ activeItems: [parent, ...subs], completedItems: [] });

        [2, 3, 4].forEach(id => Items.completeItem(id, deps));
        jest.advanceTimersByTime(500);
        expect(deps.getPlayerXP()).toBe(10);

        Items.uncompleteItem(4, deps); // the one that paid 0
        expect(deps.getPlayerXP()).toBe(10);
        expect(parent.subXpEarned).toBe(10);
    });

    test('uncompleting a sub that DID pay gives its XP back and reopens room under the cap', () => {
        const parent = taskItem({ id: 1, subTasks: [2, 3, 4], totalSubTasks: 3 });
        const subs = [2, 3, 4].map(id => taskItem({ id, parentId: 1 }));
        const deps = makeDeps({ activeItems: [parent, ...subs], completedItems: [] });

        [2, 3, 4].forEach(id => Items.completeItem(id, deps));
        jest.advanceTimersByTime(500);

        Items.uncompleteItem(2, deps);
        expect(deps.getPlayerXP()).toBe(5);
        expect(parent.subXpEarned).toBe(5);

        // Room under the cap again: finishing it pays its 5 once more.
        Items.completeItem(2, deps);
        expect(deps.getPlayerXP()).toBe(10);
        expect(parent.subXpEarned).toBe(10);
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

    test('a parent that had subs round-trips at 10 XP / 1 pt, and a priority one at 10 XP / 2 pts', () => {
        [false, true].forEach((priority, i) => {
            const parent = taskItem({ id: 10 + i, subTasks: [20 + i], totalSubTasks: 1, isHighPriority: priority });
            const sub = taskItem({ id: 20 + i, parentId: 10 + i, isHighPriority: priority, priorityInherited: priority });
            const deps = makeDeps({ activeItems: [parent, sub], completedItems: [] });

            Items.completeItem(20 + i, deps);
            jest.advanceTimersByTime(500);
            const beforeXp = deps.getPlayerXP();
            const beforePts = deps.getPlayerPoints();

            Items.completeItem(10 + i, deps);
            expect(deps.getPlayerXP()).toBe(beforeXp + 10);
            expect(deps.getPlayerPoints()).toBe(beforePts + (priority ? 2 : 1));

            jest.advanceTimersByTime(500);
            Items.uncompleteItem(10 + i, deps);
            expect(deps.getPlayerXP()).toBe(beforeXp);
            expect(deps.getPlayerPoints()).toBe(beforePts);
        });
    });

    test('an item completed BEFORE the stamps existed is refunded under the rule that paid it', () => {
        // A sub finished under the old rule paid 5 XP / 1 pt; a parent that had subs paid 10 XP / 0 pts.
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1 });
        const deps = makeDeps({ activeItems: [parent, sub], completedItems: [] });
        Items.completeItem(2, deps);
        jest.advanceTimersByTime(500);
        delete sub.subXpAwarded; delete sub.taskPointsAwarded; // as if completed before this build
        const xpAfterComplete = deps.getPlayerXP();
        const ptsAfterComplete = deps.getPlayerPoints();
        Items.uncompleteItem(2, deps);
        expect(deps.getPlayerXP()).toBe(xpAfterComplete - 5);
        expect(deps.getPlayerPoints()).toBe(ptsAfterComplete - 1);

        const legacyParent = taskItem({ id: 5, subTasks: [], totalSubTasks: 0, completedSubTasks: 2 });
        const deps2 = makeDeps({ activeItems: [legacyParent], completedItems: [] });
        Items.completeItem(5, deps2);
        jest.advanceTimersByTime(500);
        delete legacyParent.subXpAwarded; delete legacyParent.taskPointsAwarded;
        const xp2 = deps2.getPlayerXP();
        const pts2 = deps2.getPlayerPoints();
        Items.uncompleteItem(5, deps2);
        expect(deps2.getPlayerXP()).toBe(xp2 - 10);
        expect(deps2.getPlayerPoints()).toBe(pts2); // it paid 0 points under the old rule, so nothing comes back
    });
});

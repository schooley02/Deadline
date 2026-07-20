/**
 * Sub-task lifecycle rules ([P1-DATA-004] sub-session 1, 2026-07-19 session
 * 47) — closes the "orphan hole" found by a live playtest in session 46
 * (SUBTASKS_PLAN.md/DECISIONS.md): completing or deleting a parent with open
 * sub-tasks used to strand the children as agenda-invisible, base-damaging
 * zombies. Covers Items.completeItem's new block, Items.removeItem's new
 * cascade, and State.sanitizeOrphanedSubTasks's restore-time repair.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
const Items = require('../js/items.js');
const State = require('../js/state.js');

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

describe('completeItem: block/allow matrix for parents with sub-tasks', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('a standalone task (0 subs) completes normally', () => {
        const parent = taskItem({ id: 1, subTasks: [] });
        const deps = makeDeps({ activeItems: [parent] });

        const result = Items.completeItem(1, deps);

        expect(result).toBeUndefined();
        expect(deps.completedItems()).toContain(parent);
    });

    test('a parent with open sub-tasks is refused with a result object, and NOT completed', () => {
        const parent = taskItem({ id: 1, subTasks: [2, 3], totalSubTasks: 2 });
        const sub1 = taskItem({ id: 2, parentId: 1 });
        const sub2 = taskItem({ id: 3, parentId: 1 });
        const deps = makeDeps({ activeItems: [parent, sub1, sub2] });

        const result = Items.completeItem(1, deps);

        expect(result).toEqual({ ok: false, reason: 'subtasks_remaining', remaining: 2 });
        expect(deps.completedItems()).toHaveLength(0);
        expect(deps.activeItems).toContain(parent);
    });

    test('once all subs are completed (parent.subTasks empties), the parent completes normally', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1 });
        const deps = makeDeps({ activeItems: [parent, sub] });

        // Complete the last sub-task — completeItem's existing relink logic
        // pops it from parent.subTasks synchronously (before the fade-out
        // setTimeout even fires).
        Items.completeItem(2, deps);
        expect(parent.subTasks).toHaveLength(0);
        expect(parent.completedSubTasks).toBe(1);

        const result = Items.completeItem(1, deps);
        expect(result).toBeUndefined();
        expect(deps.completedItems()).toContain(parent);
    });

    test('a sub-task itself (no children of its own) always completes normally', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1, subTasks: [] });
        const deps = makeDeps({ activeItems: [parent, sub] });

        const result = Items.completeItem(2, deps);

        expect(result).toBeUndefined();
        expect(deps.completedItems()).toContain(sub);
    });
});

describe('removeItem: deletion cascade', () => {
    test('deleting a parent sweeps every child with it', () => {
        const parent = taskItem({ id: 1, subTasks: [2, 3], totalSubTasks: 2 });
        const sub1 = taskItem({ id: 2, parentId: 1 });
        const sub2 = taskItem({ id: 3, parentId: 1 });
        const deps = makeDeps({ activeItems: [parent, sub1, sub2] });

        Items.removeItem(1, deps);

        expect(deps.activeItems).toHaveLength(0);
    });

    test('deleting a parent with a grandchild-shaped chain (defensive depth) still sweeps everyone', () => {
        // Depth is UI-limited to 1 (SUBTASKS_PLAN.md scope guard), but the
        // cascade itself is recursive by construction — verify it doesn't
        // stop at one level if the schema is ever pushed further.
        const grandparent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const parent = taskItem({ id: 2, parentId: 1, subTasks: [3], totalSubTasks: 1 });
        const child = taskItem({ id: 3, parentId: 2 });
        const deps = makeDeps({ activeItems: [grandparent, parent, child] });

        Items.removeItem(1, deps);

        expect(deps.activeItems).toHaveLength(0);
    });

    test('deleting ONE sub updates the parent counters without marking it completed', () => {
        const parent = taskItem({ id: 1, subTasks: [2, 3], totalSubTasks: 2, completedSubTasks: 0 });
        const sub1 = taskItem({ id: 2, parentId: 1 });
        const sub2 = taskItem({ id: 3, parentId: 1 });
        const deps = makeDeps({ activeItems: [parent, sub1, sub2] });

        Items.removeItem(2, deps);

        expect(deps.activeItems).toEqual([parent, sub2]);
        expect(parent.subTasks).toEqual([3]);
        expect(parent.totalSubTasks).toBe(1);
        // Deletion is not completion — this counter must stay untouched.
        expect(parent.completedSubTasks).toBe(0);
    });

    test('deleting a sub refreshes the parent list item when createListItem/sortAndRenderActiveList are available', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1 });
        const createListItem = jest.fn();
        const sortAndRenderActiveList = jest.fn();
        const deps = makeDeps({ activeItems: [parent, sub], createListItem, sortAndRenderActiveList });

        Items.removeItem(2, deps);

        expect(createListItem).toHaveBeenCalledWith(parent);
        expect(sortAndRenderActiveList).toHaveBeenCalled();
    });

    test('deleting a sub is safe when the smaller (older-caller) deps shape omits createListItem', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1 });
        const deps = {
            activeItems: [parent, sub],
            updateTaskCountDisplay: () => {},
            saveGame: () => {},
        };

        expect(() => Items.removeItem(2, deps)).not.toThrow();
        expect(deps.activeItems).toEqual([parent]);
        expect(parent.totalSubTasks).toBe(0);
    });

    test('deleting a standalone item with no parent and no children is unaffected', () => {
        const item = taskItem({ id: 1 });
        const deps = makeDeps({ activeItems: [item] });

        Items.removeItem(1, deps);

        expect(deps.activeItems).toHaveLength(0);
    });

    test('removing a non-existent id is a no-op', () => {
        const item = taskItem({ id: 1 });
        const deps = makeDeps({ activeItems: [item] });

        expect(() => Items.removeItem(999, deps)).not.toThrow();
        expect(deps.activeItems).toEqual([item]);
    });
});

describe('State.sanitizeOrphanedSubTasks: restore-time repair', () => {
    test('promotes an item whose parentId does not resolve to a live parent', () => {
        const orphan = taskItem({ id: 2, parentId: 1 }); // parent 1 doesn't exist
        const activeItems = [orphan];

        const promoted = State.sanitizeOrphanedSubTasks(activeItems);

        expect(orphan.parentId).toBeNull();
        expect(promoted).toEqual([orphan]);
    });

    test('leaves a sub-task alone when its parent IS present', () => {
        const parent = taskItem({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1 });
        const activeItems = [parent, sub];

        const promoted = State.sanitizeOrphanedSubTasks(activeItems);

        expect(sub.parentId).toBe(1);
        expect(promoted).toEqual([]);
    });

    test('a parentId pointing at a non-task item (defensive) is treated as unresolved', () => {
        const notATask = { id: 1, type: 'habit' };
        const orphan = taskItem({ id: 2, parentId: 1 });
        const activeItems = [notATask, orphan];

        const promoted = State.sanitizeOrphanedSubTasks(activeItems);

        expect(orphan.parentId).toBeNull();
        expect(promoted).toEqual([orphan]);
    });

    test('is idempotent — a second pass over already-promoted items changes nothing', () => {
        const orphan = taskItem({ id: 2, parentId: 1 });
        const activeItems = [orphan];

        State.sanitizeOrphanedSubTasks(activeItems);
        const secondPass = State.sanitizeOrphanedSubTasks(activeItems);

        expect(orphan.parentId).toBeNull();
        expect(secondPass).toEqual([]);
    });

    test('items with no parentId at all are untouched', () => {
        const standalone = taskItem({ id: 1, parentId: null });
        const activeItems = [standalone];

        const promoted = State.sanitizeOrphanedSubTasks(activeItems);

        expect(standalone.parentId).toBeNull();
        expect(promoted).toEqual([]);
    });
});

describe('uncompleteItem: parent relink is unchanged by this session (regression check)', () => {
    test('un-completing a sub-task re-adds it to the parent and decrements completedSubTasks', () => {
        const parent = taskItem({ id: 1, subTasks: [], totalSubTasks: 1, completedSubTasks: 1 });
        const sub = taskItem({ id: 2, parentId: 1 });
        const deps = makeDeps({ activeItems: [parent], completedItems: [sub] });

        Items.uncompleteItem(2, deps);

        expect(deps.activeItems).toContain(sub);
        expect(parent.subTasks).toContain(2);
        expect(parent.completedSubTasks).toBe(0);
    });
});

// Session 58: the "stale checkbox" bug (found session 7 live playtest,
// ROADMAP known bugs) — uncompleteItem reused whatever DOM node
// item.listItemElement pointed at instead of rebuilding it. That node's
// "Mark as Complete" checkbox reads checked because the ORIGINAL completion
// was a native browser click (nothing in code ever sets checked = true), and
// the node was never discarded when the item moved to completedItems. Fix:
// a top-level item (no parentId) now gets its own row rebuilt via
// createListItem, exactly like the pre-existing parent-rebuild branch for
// sub-tasks.
describe('uncompleteItem: stale-checkbox fix (session 58)', () => {
    test('un-completing a TOP-LEVEL item discards the old row and rebuilds a fresh one', () => {
        const staleElement = { ...fakeEl(), remove: jest.fn() };
        const task = taskItem({ id: 1, listItemElement: staleElement });
        const createListItem = jest.fn();
        const deps = makeDeps({ activeItems: [], completedItems: [task], createListItem });

        Items.uncompleteItem(1, deps);

        expect(staleElement.remove).toHaveBeenCalledTimes(1);
        expect(createListItem).toHaveBeenCalledWith(task);
    });

    test('un-completing a SUB-TASK does not rebuild its own row (no top-level list item exists for it)', () => {
        const parent = taskItem({ id: 1, subTasks: [], totalSubTasks: 1, completedSubTasks: 1 });
        const subStaleElement = { ...fakeEl(), remove: jest.fn() };
        const sub = taskItem({ id: 2, parentId: 1, listItemElement: subStaleElement });
        const createListItem = jest.fn();
        const deps = makeDeps({ activeItems: [parent], completedItems: [sub], createListItem });

        Items.uncompleteItem(2, deps);

        // The parent's row IS rebuilt (pre-existing behavior); the sub's own
        // stale element is left alone — subs are rendered inline inside the
        // parent's row, not as their own top-level <li>.
        expect(createListItem).toHaveBeenCalledWith(parent);
        expect(createListItem).not.toHaveBeenCalledWith(sub);
        expect(subStaleElement.remove).not.toHaveBeenCalled();
    });

    test('a top-level item with no listItemElement yet (defensive) does not throw and still calls createListItem', () => {
        const task = taskItem({ id: 1, listItemElement: null });
        const createListItem = jest.fn();
        const deps = makeDeps({ activeItems: [], completedItems: [task], createListItem });

        expect(() => Items.uncompleteItem(1, deps)).not.toThrow();
        expect(createListItem).toHaveBeenCalledWith(task);
    });
});

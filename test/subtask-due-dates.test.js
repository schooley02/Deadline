/**
 * Dependent due dates ([P1-DATA-004] sub-session 2, 2026-07-19) — Jeremy's
 * clamp model (SUBTASKS_PLAN.md fork 3): a sub-task's due date defaults to
 * AND may never exceed its parent's deadline; earlier is always allowed.
 * Pulling a parent's deadline EARLIER re-clamps any later children (routed
 * through recomputeOverdueStateAfterEdit per child); pushing it LATER leaves
 * children untouched. NOT the delta-shift model.
 *
 * Covers: the pure clamp rule (Items.clampedSubTaskDueDate), the creation-
 * time data-layer backstop (Items.createTaskItemData), and the parent-edit
 * re-clamp (Items.clampSubTasksToParentDeadline). The FORM-level loud
 * rejections live in js/ui/popups.js and are live-verified in Chrome instead
 * (established convention for DOM paths).
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

function hoursFromNow(h) {
    return new Date(Date.now() + h * 60 * 60 * 1000);
}

function taskItem(overrides = {}) {
    return {
        id: 1, type: 'task', name: 'Task', category: 'other',
        isHighPriority: false, dueDateTime: hoursFromNow(24),
        isOverdue: false, lastDamageTickTime: null, parentId: null,
        subTasks: [], completedSubTasks: 0, totalSubTasks: 0,
        element: fakeEl(), listItemElement: fakeEl(),
        ...overrides,
    };
}

function makeDeps(overrides = {}) {
    const activeItems = overrides.activeItems || [];
    const definedHabits = overrides.definedHabits || [];
    const { activeItems: _a, definedHabits: _d, ...rest } = overrides;
    let nextId = 100;
    return {
        getNextId: () => nextId++,
        activeItems,
        definedHabits: () => definedHabits,
        definedRoutines: () => [],
        completedItems: () => [],
        gameScreenWidth: 800,
        enemyWidth: CONFIG.ENEMY_WIDTH,
        habitEnemyWidth: CONFIG.HABIT_ENEMY_WIDTH,
        baseWidth: 120,
        calculateTimelineXWithClustering: () => 400,
        getSubTaskClusterOffset: () => 0,
        getItemTopPosition: () => 0,
        createListItem: () => {},
        sortAndRenderActiveList: () => {},
        saveGame: () => {},
        gameCanvas: fakeEl(),
        handleEnemyClick: () => {},
        ...rest,
    };
}

// Format helpers to feed createTaskItemData's string inputs.
function dateStr(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function timeStr(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

describe('clampedSubTaskDueDate (pure rule)', () => {
    test('a date later than the parent deadline clamps to a NEW Date equal to it', () => {
        const parent = taskItem({ id: 1, dueDateTime: hoursFromNow(10) });
        const later = hoursFromNow(20);
        const result = Items.clampedSubTaskDueDate(later, parent);
        expect(result.getTime()).toBe(parent.dueDateTime.getTime());
        expect(result).not.toBe(parent.dueDateTime); // defensive copy
    });

    test('a date earlier than the parent deadline is returned unchanged', () => {
        const parent = taskItem({ id: 1, dueDateTime: hoursFromNow(10) });
        const earlier = hoursFromNow(5);
        expect(Items.clampedSubTaskDueDate(earlier, parent)).toBe(earlier);
    });

    test('a date exactly AT the parent deadline is allowed unchanged', () => {
        const parent = taskItem({ id: 1, dueDateTime: hoursFromNow(10) });
        const same = new Date(parent.dueDateTime);
        expect(Items.clampedSubTaskDueDate(same, parent)).toBe(same);
    });

    test('missing/invalid parent returns the input untouched', () => {
        const d = hoursFromNow(20);
        expect(Items.clampedSubTaskDueDate(d, null)).toBe(d);
        expect(Items.clampedSubTaskDueDate(d, { dueDateTime: 'not-a-date' })).toBe(d);
    });
});

describe('createTaskItemData: creation-time clamp backstop', () => {
    test('a sub created with a due date LATER than its parent clamps to the parent deadline', () => {
        const parent = taskItem({ id: 1, dueDateTime: hoursFromNow(10) });
        const deps = makeDeps({ activeItems: [parent] });
        const laterDate = hoursFromNow(30);

        const sub = Items.createTaskItemData(
            'Sub', 'other', false, dateStr(laterDate), timeStr(laterDate), 1, deps
        );

        expect(sub.dueDateTime.getTime()).toBe(parent.dueDateTime.getTime());
    });

    test('a sub created with an EARLIER due date keeps it', () => {
        const parent = taskItem({ id: 1, dueDateTime: hoursFromNow(10) });
        const deps = makeDeps({ activeItems: [parent] });
        const earlier = hoursFromNow(5);

        const sub = Items.createTaskItemData(
            'Sub', 'other', false, dateStr(earlier), timeStr(earlier), 1, deps
        );

        // Compare to the minute (timeStr drops seconds).
        expect(dateStr(sub.dueDateTime)).toBe(dateStr(earlier));
        expect(timeStr(sub.dueDateTime)).toBe(timeStr(earlier));
    });

    test('a STANDALONE task with a far-future due date is never clamped', () => {
        const deps = makeDeps({ activeItems: [] });
        const later = hoursFromNow(100);

        const task = Items.createTaskItemData(
            'Solo', 'other', false, dateStr(later), timeStr(later), null, deps
        );

        expect(dateStr(task.dueDateTime)).toBe(dateStr(later));
    });

    test('a sub whose parentId resolves to nothing is left unclamped (sanitizer territory, not ours)', () => {
        const deps = makeDeps({ activeItems: [] });
        const later = hoursFromNow(30);

        const sub = Items.createTaskItemData(
            'Sub', 'other', false, dateStr(later), timeStr(later), 999, deps
        );

        expect(dateStr(sub.dueDateTime)).toBe(dateStr(later));
    });
});

describe('clampSubTasksToParentDeadline: parent-edit re-clamp', () => {
    test('parent pulled EARLIER: a child due later re-clamps to the new deadline', () => {
        const parent = taskItem({ id: 1, dueDateTime: hoursFromNow(5), subTasks: [2], totalSubTasks: 1 });
        const child = taskItem({ id: 2, parentId: 1, dueDateTime: hoursFromNow(20) });
        const deps = makeDeps({ activeItems: [parent, child] });

        const clamped = Items.clampSubTasksToParentDeadline(parent, deps);

        expect(clamped).toEqual([child]);
        expect(child.dueDateTime.getTime()).toBe(parent.dueDateTime.getTime());
    });

    test('a child already EARLIER than the new deadline is untouched', () => {
        const parent = taskItem({ id: 1, dueDateTime: hoursFromNow(10), subTasks: [2], totalSubTasks: 1 });
        const childDue = hoursFromNow(3);
        const child = taskItem({ id: 2, parentId: 1, dueDateTime: childDue });
        const deps = makeDeps({ activeItems: [parent, child] });

        const clamped = Items.clampSubTasksToParentDeadline(parent, deps);

        expect(clamped).toEqual([]);
        expect(child.dueDateTime).toBe(childDue);
    });

    test('parent pushed LATER: no child is touched (no delta-shift)', () => {
        // Parent deadline is later than every child — clamp finds nothing.
        const parent = taskItem({ id: 1, dueDateTime: hoursFromNow(50), subTasks: [2, 3], totalSubTasks: 2 });
        const d2 = hoursFromNow(10), d3 = hoursFromNow(20);
        const c2 = taskItem({ id: 2, parentId: 1, dueDateTime: d2 });
        const c3 = taskItem({ id: 3, parentId: 1, dueDateTime: d3 });
        const deps = makeDeps({ activeItems: [parent, c2, c3] });

        expect(Items.clampSubTasksToParentDeadline(parent, deps)).toEqual([]);
        expect(c2.dueDateTime).toBe(d2);
        expect(c3.dueDateTime).toBe(d3);
    });

    test('only THIS parent\'s children are considered', () => {
        const parent = taskItem({ id: 1, dueDateTime: hoursFromNow(5), subTasks: [2], totalSubTasks: 1 });
        const otherChildDue = hoursFromNow(30);
        const otherChild = taskItem({ id: 4, parentId: 9, dueDateTime: otherChildDue });
        const deps = makeDeps({ activeItems: [parent, otherChild] });

        expect(Items.clampSubTasksToParentDeadline(parent, deps)).toEqual([]);
        expect(otherChild.dueDateTime).toBe(otherChildDue);
    });

    test('clamping a future child to a PAST parent deadline marks it overdue (recompute routed)', () => {
        const pastDue = hoursFromNow(-2);
        const parent = taskItem({ id: 1, dueDateTime: pastDue, isOverdue: true, subTasks: [2], totalSubTasks: 1 });
        const child = taskItem({ id: 2, parentId: 1, dueDateTime: hoursFromNow(20), isOverdue: false });
        const deps = makeDeps({ activeItems: [parent, child] });

        const clamped = Items.clampSubTasksToParentDeadline(parent, deps);

        expect(clamped).toEqual([child]);
        expect(child.dueDateTime.getTime()).toBe(pastDue.getTime());
        expect(child.isOverdue).toBe(true);
        expect(child.lastDamageTickTime).not.toBeNull();
    });

    test('an ALREADY-overdue child clamped to a still-past deadline stays overdue without error', () => {
        const olderPast = hoursFromNow(-5);
        const newerPast = hoursFromNow(-1);
        const parent = taskItem({ id: 1, dueDateTime: olderPast, isOverdue: true, subTasks: [2], totalSubTasks: 1 });
        const child = taskItem({
            id: 2, parentId: 1, dueDateTime: newerPast, isOverdue: true,
            lastDamageTickTime: newerPast.getTime(),
        });
        const deps = makeDeps({ activeItems: [parent, child] });

        // child (-1h) is later than parent (-5h) → clamps, stays overdue.
        const clamped = Items.clampSubTasksToParentDeadline(parent, deps);

        expect(clamped).toEqual([child]);
        expect(child.dueDateTime.getTime()).toBe(olderPast.getTime());
        expect(child.isOverdue).toBe(true);
    });

    test('non-parent inputs are inert: a sub-task, a habit, null', () => {
        const sub = taskItem({ id: 2, parentId: 1 });
        const habit = taskItem({ id: 3, type: 'habit' });
        const deps = makeDeps({ activeItems: [sub, habit] });

        expect(Items.clampSubTasksToParentDeadline(sub, deps)).toEqual([]);
        expect(Items.clampSubTasksToParentDeadline(habit, deps)).toEqual([]);
        expect(Items.clampSubTasksToParentDeadline(null, deps)).toEqual([]);
    });
});

/**
 * Items.planNotNeeded / deleteTask / markNotNeeded -- "Not needed" passes Build A (2026-11-13, Jeremy + Opus 5.5;
 * DECISIONS 2026-11-13 (Delete Task and Not needed today: design)). Same global-binding approach as items-skipday-sickday.test.js.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.NotNeeded = require('../js/notNeeded.js');
global.PrioritySlots = require('../js/prioritySlots.js');
const Items = require('../js/items.js');

const HOUR = 60 * 60 * 1000;

function fakeEl() { return { style: {}, remove: jest.fn(), classList: { add() {}, remove() {}, toggle() {} } }; }

function key(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function inHours(h) { return new Date(Date.now() + h * HOUR); }

function task(id, extra = {}) {
    return { id, type: 'task', name: `Task ${id}`, dueDateTime: inHours(5), isOverdue: false, subTasks: [], totalSubTasks: 0,
        element: fakeEl(), listItemElement: fakeEl(), ...extra };
}

function makeDeps(opts = {}) {
    let uses = opts.uses || [];
    const activeItems = opts.activeItems || [];
    const calls = { saved: 0, listed: 0, sorted: 0, counted: 0 };
    return {
        activeItems,
        definedHabits: () => opts.definedHabits || [],
        definedTasks: () => opts.definedTasks || [],
        getNotNeededUses: () => uses,
        setNotNeededUses: (u) => { uses = u; },
        notNeededCap: 3,
        weekStartsOn: 1,
        isGameOver: () => !!opts.gameOver,
        updateTaskCountDisplay: () => { calls.counted++; },
        saveGame: () => { calls.saved++; },
        createListItem: () => { calls.listed++; },
        sortAndRenderActiveList: () => { calls.sorted++; },
        calculateTimelineXWithClustering: () => 0,
        baseWidth: 0,
        getSubTaskClusterOffset: () => 0,
        getUses: () => uses,
        calls,
    };
}

describe('Items.deleteTask', () => {
    test('a one-off task that is not due: removed for free, no pass used, saved', () => {
        const t = task(1);
        const deps = makeDeps({ activeItems: [t] });
        const res = Items.deleteTask(1, deps);
        expect(res).toMatchObject({ ok: true, usesPass: false });
        expect(deps.activeItems).toHaveLength(0);
        expect(deps.getUses()).toEqual([]);
        expect(deps.calls.saved).toBeGreaterThan(0);
        expect(t.element.remove).toHaveBeenCalled();
    });

    test('an overdue task: removed, and one pass is stamped now', () => {
        const t = task(1, { isOverdue: true, dueDateTime: inHours(-1) });
        const deps = makeDeps({ activeItems: [t] });
        const before = Date.now();
        const res = Items.deleteTask(1, deps);
        expect(res).toMatchObject({ ok: true, usesPass: true, left: 2 });
        expect(deps.activeItems).toHaveLength(0);
        expect(deps.getUses()).toHaveLength(1);
        expect(deps.getUses()[0]).toBeGreaterThanOrEqual(before);
    });

    test('an overdue task with no pass left: refused, nothing changes', () => {
        const t = task(1, { isOverdue: true, dueDateTime: inHours(-1) });
        const now = Date.now();
        const deps = makeDeps({ activeItems: [t], uses: [now - 3, now - 2, now - 1] });
        const res = Items.deleteTask(1, deps);
        expect(res).toMatchObject({ ok: false, reason: 'no-passes' });
        expect(deps.activeItems).toHaveLength(1);
        expect(deps.getUses()).toHaveLength(3);
        expect(deps.calls.saved).toBe(0);
    });

    test('deleting a parent takes its sub-tasks with it', () => {
        const parent = task(1, { subTasks: [2, 3], totalSubTasks: 2 });
        const a = task(2, { parentId: 1 });
        const b = task(3, { parentId: 1 });
        const other = task(9);
        const deps = makeDeps({ activeItems: [parent, a, b, other] });
        const plan = Items.planNotNeeded(1, 'delete', deps);
        expect(plan.subTaskCount).toBe(2);
        Items.deleteTask(1, deps);
        expect(deps.activeItems.map(i => i.id)).toEqual([9]);
    });

    test('a not-yet-due parent whose sub-task is already overdue costs a pass', () => {
        const parent = task(1, { subTasks: [2], totalSubTasks: 1 });
        const kid = task(2, { parentId: 1, isOverdue: true, dueDateTime: inHours(-2) });
        const deps = makeDeps({ activeItems: [parent, kid] });
        const res = Items.deleteTask(1, deps);
        expect(res).toMatchObject({ ok: true, usesPass: true });
        expect(deps.getUses()).toHaveLength(1);
        expect(deps.activeItems).toHaveLength(0);
    });

    test('deleting a sub-task fixes the parent counters', () => {
        const parent = task(1, { subTasks: [2, 3], totalSubTasks: 2 });
        const a = task(2, { parentId: 1 });
        const b = task(3, { parentId: 1 });
        const deps = makeDeps({ activeItems: [parent, a, b] });
        Items.deleteTask(2, deps);
        expect(parent.subTasks).toEqual([3]);
        expect(parent.totalSubTasks).toBe(1);
        expect(deps.activeItems.map(i => i.id)).toEqual([1, 3]);
    });

    test('habits and routine tasks are refused', () => {
        const habit = { id: 1, type: 'habit', definitionId: 'h', isNegative: false, dueDateTime: inHours(5), element: fakeEl() };
        const routineTask = task(2, { definitionId: 't1' });
        const deps = makeDeps({ activeItems: [habit, routineTask] });
        expect(Items.deleteTask(1, deps).reason).toBe('not-deletable');
        expect(Items.deleteTask(2, deps).reason).toBe('not-deletable');
        expect(deps.activeItems).toHaveLength(2);
    });

    test('an unknown id, or a game-over board, changes nothing', () => {
        const t = task(1);
        const deps = makeDeps({ activeItems: [t], gameOver: true });
        expect(Items.deleteTask(99, deps).ok).toBe(false);
        expect(Items.deleteTask(1, deps).reason).toBe('unavailable');
        expect(deps.activeItems).toHaveLength(1);
    });

    test('a deleted priority does not hand its slot back (the marks map is never touched)', () => {
        const t = task(1, { isHighPriority: true });
        const deps = makeDeps({ activeItems: [t] });
        const setMarks = jest.fn();
        deps.getPriorityMarks = () => ({ [key(t.dueDateTime)]: 1 });
        deps.setPriorityMarks = setMarks;
        Items.deleteTask(1, deps);
        expect(setMarks).not.toHaveBeenCalled();
    });
});

describe('Items.markNotNeeded: habits and routine tasks', () => {
    test('a Build habit: skipDayDate is set, the instance leaves, a pass is spent, nothing is recorded', () => {
        const due = inHours(5);
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: false, originalDueDate: due, dueDateTime: due, element: fakeEl() };
        const def = { id: 'd1', isNegative: false, streak: 6, occurrenceHistory: [], skipDayDate: null };
        const deps = makeDeps({ activeItems: [item], definedHabits: [def] });
        const res = Items.markNotNeeded(1, deps);
        expect(res).toMatchObject({ ok: true, effect: 'skip-day', usesPass: true, left: 2 });
        expect(def.skipDayDate).toBe(key(due));
        expect(def.streak).toBe(6);
        expect(def.occurrenceHistory).toHaveLength(0);
        expect(deps.activeItems).toHaveLength(0);
        expect(deps.getUses()).toHaveLength(1);
        expect(deps.calls.saved).toBeGreaterThan(0);
    });

    test('a routine task: the task definition gets skipDayDate and the instance leaves', () => {
        const due = inHours(5);
        const item = task(1, { definitionId: 'tdef', originalDueDate: due, dueDateTime: due });
        const def = { id: 'tdef', name: 'Stretch', occurrenceHistory: [] };
        const deps = makeDeps({ activeItems: [item], definedTasks: [def] });
        const res = Items.markNotNeeded(1, deps);
        expect(res).toMatchObject({ ok: true, effect: 'skip-day' });
        expect(def.skipDayDate).toBe(key(due));
        expect(def.occurrenceHistory).toHaveLength(0);
        expect(deps.activeItems).toHaveLength(0);
        expect(deps.getUses()).toHaveLength(1);
    });

    test('a habit that is already due is refused and nothing is spent', () => {
        const due = inHours(-1);
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: false, isOverdue: true, originalDueDate: due, dueDateTime: due, element: fakeEl() };
        const def = { id: 'd1', skipDayDate: null, occurrenceHistory: [] };
        const deps = makeDeps({ activeItems: [item], definedHabits: [def] });
        expect(Items.markNotNeeded(1, deps).reason).toBe('due');
        expect(def.skipDayDate).toBeNull();
        expect(deps.activeItems).toHaveLength(1);
        expect(deps.getUses()).toEqual([]);
    });

    test('a Break habit is refused', () => {
        const due = inHours(5);
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: true, originalDueDate: due, dueDateTime: due, element: fakeEl() };
        const deps = makeDeps({ activeItems: [item], definedHabits: [{ id: 'd1', isNegative: true }] });
        expect(Items.markNotNeeded(1, deps).reason).toBe('not-available');
        expect(deps.activeItems).toHaveLength(1);
    });

    test('a missing definition still removes the instance and spends the pass (no crash)', () => {
        const due = inHours(5);
        const item = { id: 1, type: 'habit', definitionId: 'gone', isNegative: false, originalDueDate: due, dueDateTime: due, element: fakeEl() };
        const deps = makeDeps({ activeItems: [item], definedHabits: [] });
        expect(() => Items.markNotNeeded(1, deps)).not.toThrow();
        expect(deps.activeItems).toHaveLength(0);
    });

    test('the weekly cap: a fourth use in the same week is refused', () => {
        const items = [1, 2, 3, 4].map(n => {
            const due = inHours(5);
            return { id: n, type: 'habit', definitionId: 'd' + n, isNegative: false, originalDueDate: due, dueDateTime: due, element: fakeEl() };
        });
        const defs = items.map(i => ({ id: i.definitionId, skipDayDate: null, occurrenceHistory: [] }));
        const deps = makeDeps({ activeItems: items.slice(), definedHabits: defs });
        expect(Items.markNotNeeded(1, deps).ok).toBe(true);
        expect(Items.markNotNeeded(2, deps).ok).toBe(true);
        expect(Items.markNotNeeded(3, deps).ok).toBe(true);
        const fourth = Items.markNotNeeded(4, deps);
        expect(fourth).toMatchObject({ ok: false, reason: 'no-passes' });
        expect(deps.activeItems.map(i => i.id)).toEqual([4]);
        expect(deps.getUses()).toHaveLength(3);
    });
});

describe('Items.markNotNeeded: a one-off task moves a day later', () => {
    test('due and start move +1 day (same time of day), the flag is set, a pass is spent, the row is rebuilt', () => {
        const due = inHours(5);
        const start = inHours(2);
        const t = task(1, { dueDateTime: due, startDateTime: start });
        const deps = makeDeps({ activeItems: [t] });
        const res = Items.markNotNeeded(1, deps);
        expect(res).toMatchObject({ ok: true, effect: 'move-tomorrow', usesPass: true });
        const expectedDue = new Date(due.getTime()); expectedDue.setDate(expectedDue.getDate() + 1);
        const expectedStart = new Date(start.getTime()); expectedStart.setDate(expectedStart.getDate() + 1);
        expect(t.dueDateTime.getTime()).toBe(expectedDue.getTime());
        expect(t.startDateTime.getTime()).toBe(expectedStart.getTime());
        expect(t.notNeededMoved).toBe(true);
        expect(deps.activeItems).toHaveLength(1); // still on the board
        expect(deps.getUses()).toHaveLength(1);
        expect(deps.calls.listed).toBe(1);
        expect(deps.calls.sorted).toBe(1);
        expect(deps.calls.counted).toBeGreaterThan(0);
        expect(deps.calls.saved).toBeGreaterThan(0);
    });

    test('it works without a start time', () => {
        const t = task(1, { startDateTime: null });
        const deps = makeDeps({ activeItems: [t] });
        expect(Items.markNotNeeded(1, deps).ok).toBe(true);
        expect(t.startDateTime).toBeNull();
    });

    test('only once per task: the second try is refused and spends nothing', () => {
        const t = task(1);
        const deps = makeDeps({ activeItems: [t] });
        expect(Items.markNotNeeded(1, deps).ok).toBe(true);
        const due = t.dueDateTime.getTime();
        const second = Items.markNotNeeded(1, deps);
        expect(second).toMatchObject({ ok: false, reason: 'already-moved' });
        expect(t.dueDateTime.getTime()).toBe(due);
        expect(deps.getUses()).toHaveLength(1);
    });

    test('a priority does not carry over to another day', () => {
        const t = task(1, { isHighPriority: true, dueDateTime: inHours(5) });
        const deps = makeDeps({ activeItems: [t] });
        Items.markNotNeeded(1, deps);
        expect(t.isHighPriority).toBe(false);
    });

    test('an overdue one-off task cannot use it (that is Delete with a pass, or pushback)', () => {
        const t = task(1, { isOverdue: true, dueDateTime: inHours(-1) });
        const deps = makeDeps({ activeItems: [t] });
        expect(Items.markNotNeeded(1, deps).reason).toBe('due');
        expect(deps.getUses()).toEqual([]);
    });

    test('a sub-task cannot use it', () => {
        const parent = task(1, { subTasks: [2], totalSubTasks: 1 });
        const kid = task(2, { parentId: 1 });
        const deps = makeDeps({ activeItems: [parent, kid] });
        expect(Items.markNotNeeded(2, deps).reason).toBe('not-available');
    });
});

describe('Items.planNotNeeded', () => {
    test('is read-only: it changes nothing and reports the same plan the action would use', () => {
        const t = task(1);
        const deps = makeDeps({ activeItems: [t] });
        const del = Items.planNotNeeded(1, 'delete', deps);
        const nn = Items.planNotNeeded(1, 'notNeeded', deps);
        expect(del).toMatchObject({ ok: true, usesPass: false, left: 3 });
        expect(nn).toMatchObject({ ok: true, effect: 'move-tomorrow', usesPass: true, left: 2 });
        expect(deps.getUses()).toEqual([]);
        expect(deps.activeItems).toHaveLength(1);
        expect(deps.calls.saved).toBe(0);
    });

    test('reports the passes left for the button text', () => {
        const now = Date.now();
        const deps = makeDeps({ activeItems: [task(1)], uses: [now - 2, now - 1] });
        expect(Items.planNotNeeded(1, 'notNeeded', deps).left).toBe(0);
    });
});

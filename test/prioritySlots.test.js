/**
 * Priority slots, Build A (2026-11-04, Jeremy; DECISIONS 2026-11-04 (priority slots); docs/PRIORITY_SLOTS_PLAN.md):
 * the pure rules in js/prioritySlots.js, Items.setPriority / syncPriorityOnMove, routine task definitions that are never
 * priority, the State marks map, the schema 16 -> 17 migration and DailyRecord v9 `pri`.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.DayRollover = require('../js/dayRollover.js');
global.DailyRecord = require('../js/dailyRecord.js');
global.Persistence = require('../js/persistence.js');
global.PrioritySlots = require('../js/prioritySlots.js');
const PS = global.PrioritySlots;
const Items = require('../js/items.js');
const Routines = require('../js/routines.js');
const State = require('../js/state.js');

const at = (d, h = 12, m = 0) => new Date(2026, 10, d, h, m, 0, 0); // Nov <d> 2026, local
const KEY5 = '2026-11-05';
const KEY6 = '2026-11-06';

function fakeEl() {
    const set = new Set();
    return {
        style: {}, dataset: {}, addEventListener: () => {}, appendChild: () => {}, remove: () => {},
        classList: {
            add: (c) => set.add(c), remove: (c) => set.delete(c),
            toggle: (c, on) => { if (on === undefined ? !set.has(c) : on) set.add(c); else set.delete(c); },
            contains: (c) => set.has(c),
        },
    };
}

function task(o) {
    return Object.assign({
        id: 1, type: 'task', name: 'T', category: 'other', isHighPriority: false, dueDateTime: at(5),
        isOverdue: false, parentId: null, subTasks: [], completedSubTasks: 0, totalSubTasks: 0,
        element: fakeEl(), listItemElement: fakeEl(),
    }, o);
}

// A deps object with a real marks map and recordDaily spy.
function makeDeps(active, completed, marks) {
    let m = marks || {};
    const events = [];
    const deps = {
        activeItems: active,
        completedItems: () => completed || [],
        getPriorityMarks: () => m,
        setPriorityMarks: (next) => { m = next; },
        recordDaily: (event, payload) => events.push({ event, payload }),
        saveGame: jest.fn(),
    };
    deps.events = events;
    deps.marks = () => m;
    return deps;
}

describe('PrioritySlots: the slot maths', () => {
    test('three free on a fresh day; each mark spends one', () => {
        expect(PS.available(0, 0, 3)).toBe(3);
        expect(PS.available(1, 0, 3)).toBe(2);
        expect(PS.available(3, 0, 3)).toBe(0);
        expect(PS.canMark(3, 0, 3)).toBe(false);
        expect(PS.canMark(2, 0, 3)).toBe(true);
    });
    test('finishing a full set of three opens three more; finishing fewer does not', () => {
        expect(PS.available(3, 2, 3)).toBe(0);
        expect(PS.available(3, 3, 3)).toBe(3);
        expect(PS.available(4, 3, 3)).toBe(2);
        expect(PS.available(6, 6, 3)).toBe(3);
        expect(PS.setsCompleted(2, 3)).toBe(0);
        expect(PS.setsCompleted(3, 3)).toBe(1);
        expect(PS.setsCompleted(7, 3)).toBe(2);
    });
    test('unmarking never refunds: 3 marks, 1 unmarked and the other 2 finished is still 0 left (no reset)', () => {
        // marks stays 3 (spent), done = 2 -> no set finished
        expect(PS.remaining(3, 2, 3)).toBe(0);
    });
    test('an undone completion after a reset can go below 0, but the player never sees a negative', () => {
        expect(PS.available(3, 2, 3)).toBe(0);
        expect(PS.available(6, 2, 3)).toBe(-3);
        expect(PS.remaining(6, 2, 3)).toBe(0);
        expect(PS.canMark(6, 2, 3)).toBe(false);
    });
    test('perDayOf reads CONFIG.PRIORITY_SLOTS_PER_DAY (3) and falls back to 3', () => {
        expect(CONFIG.PRIORITY_SLOTS_PER_DAY).toBe(3);
        expect(PS.perDayOf(CONFIG)).toBe(3);
        expect(PS.perDayOf(null)).toBe(3);
        expect(PS.perDayOf({ PRIORITY_SLOTS_PER_DAY: 5 })).toBe(5);
        expect(PS.perDayOf({ PRIORITY_SLOTS_PER_DAY: 0 })).toBe(3);
    });
    test('dayKey is the local YYYY-MM-DD and null for junk', () => {
        expect(PS.dayKey(at(5, 23, 59))).toBe(KEY5);
        expect(PS.dayKey(at(5, 0, 1).getTime())).toBe(KEY5);
        expect(PS.dayKey(null)).toBe(null);
        expect(PS.dayKey('nope')).toBe(null);
    });
});

describe('PrioritySlots: who takes a slot and who counts as done', () => {
    test('a priority standalone task takes one; a normal task does not', () => {
        expect(PS.takesSlot(task({ isHighPriority: true }), null)).toBe(true);
        expect(PS.takesSlot(task({ isHighPriority: false }), null)).toBe(false);
        expect(PS.takesSlot({ type: 'habit', isHighPriority: true }, null)).toBe(false);
    });
    test('a priority sub-task takes a slot only when its parent is NOT priority', () => {
        const sub = task({ id: 2, parentId: 1, isHighPriority: true });
        expect(PS.takesSlot(sub, task({ id: 1, isHighPriority: false }))).toBe(true);
        expect(PS.takesSlot(sub, task({ id: 1, isHighPriority: true }))).toBe(false);
    });
    test('countDone: a priority parent counts once, its inherited sub-tasks never, a lone priority sub counts', () => {
        const parent = task({ id: 1, isHighPriority: true, dueDateTime: at(5) });
        const subs = [
            task({ id: 2, parentId: 1, isHighPriority: true, priorityInherited: true }),
            task({ id: 3, parentId: 1, isHighPriority: true, priorityInherited: true }),
        ];
        const other = task({ id: 4, isHighPriority: false });
        expect(PS.countDone([parent].concat(subs, [other]), [], KEY5)).toBe(1);
        const normalParent = task({ id: 10, isHighPriority: false });
        const loneSub = task({ id: 11, parentId: 10, isHighPriority: true });
        expect(PS.countDone([loneSub, normalParent], [], KEY5)).toBe(1);
    });
    test('countDone only counts the asked due day, and finds a parent in the other list', () => {
        const done5 = task({ id: 1, isHighPriority: true, dueDateTime: at(5) });
        const done6 = task({ id: 2, isHighPriority: true, dueDateTime: at(6) });
        expect(PS.countDone([done5, done6], [], KEY5)).toBe(1);
        expect(PS.countDone([done5, done6], [], KEY6)).toBe(1);
        const sub = task({ id: 3, parentId: 9, isHighPriority: true });
        const activeParent = task({ id: 9, isHighPriority: true });
        expect(PS.countDone([sub], [activeParent], KEY5)).toBe(0);
    });
    test('stripsOnMove only when the local day changes', () => {
        expect(PS.stripsOnMove(at(5, 9), at(5, 23, 59))).toBe(false);
        expect(PS.stripsOnMove(at(5, 23, 59), at(6, 0, 1))).toBe(true);
        expect(PS.stripsOnMove(null, at(6))).toBe(false);
    });
});

describe('PrioritySlots: planChange', () => {
    const ctx = (o) => Object.assign({ item: task({}), parent: null, on: true, marks: 0, done: 0, perDay: 3 }, o);
    test('marking with a free slot spends one', () => {
        expect(PS.planChange(ctx({}))).toEqual({ ok: true, action: 'mark', left: 2 });
    });
    test('marking with none left is refused as full', () => {
        expect(PS.planChange(ctx({ marks: 3 }))).toEqual({ ok: false, action: 'noop', left: 0, reason: 'full' });
    });
    test('marking an already-priority task is a no-op that costs nothing', () => {
        const r = PS.planChange(ctx({ item: task({ isHighPriority: true }), marks: 3 }));
        expect(r.ok).toBe(true);
        expect(r.action).toBe('noop');
    });
    test('unmarking is allowed and leaves left unchanged (no refund)', () => {
        const r = PS.planChange(ctx({ item: task({ isHighPriority: true }), on: false, marks: 3, done: 0 }));
        expect(r).toEqual({ ok: true, action: 'unmark', left: 0 });
    });
    test('a sub-task under a priority parent is covered: nothing to mark or unmark', () => {
        const sub = task({ id: 2, parentId: 1, isHighPriority: true, priorityInherited: true });
        const parent = task({ id: 1, isHighPriority: true });
        expect(PS.planChange(ctx({ item: sub, parent, on: true })).reason).toBe('covered');
        expect(PS.planChange(ctx({ item: sub, parent, on: false })).reason).toBe('covered');
    });
    test('a sub-task of a normal parent can be marked alone', () => {
        const sub = task({ id: 2, parentId: 1 });
        const parent = task({ id: 1, isHighPriority: false });
        expect(PS.planChange(ctx({ item: sub, parent })).action).toBe('mark');
    });
});

describe('PrioritySlots: the marks map', () => {
    test('sanitizeMarks keeps only day keys with a whole number above 0', () => {
        expect(PS.sanitizeMarks({ [KEY5]: 2, '2026-11-06': 0, bad: 3, '2026-11-07': 'x', '2026-11-08': 2.9 }))
            .toEqual({ [KEY5]: 2, '2026-11-08': 2 });
        expect(PS.sanitizeMarks(null)).toEqual({});
        expect(PS.sanitizeMarks([1, 2])).toEqual({});
    });
    test('addMark returns a new map and never mutates the input', () => {
        const before = { [KEY5]: 1 };
        const next = PS.addMark(before, KEY5);
        expect(next).toEqual({ [KEY5]: 2 });
        expect(before).toEqual({ [KEY5]: 1 });
        expect(PS.addMark({}, 'not-a-day')).toEqual({});
    });
    test('prune drops days before yesterday and keeps yesterday, today and the future', () => {
        const marks = { '2026-11-02': 3, '2026-11-03': 1, '2026-11-04': 2, [KEY5]: 1, '2026-11-09': 3 };
        expect(PS.prune(marks, at(5, 9))).toEqual({ '2026-11-04': 2, [KEY5]: 1, '2026-11-09': 3 });
    });
});

describe('Items.setPriority', () => {
    test('marking spends a slot of the task\'s DUE day, sets the flag and the look, records the mark', () => {
        const t = task({ id: 1 });
        const deps = makeDeps([t], []);
        const r = Items.setPriority(1, true, deps);
        expect(r).toMatchObject({ ok: true, changed: true, action: 'mark', left: 2 });
        expect(t.isHighPriority).toBe(true);
        expect(t.element.classList.contains('high-priority')).toBe(true);
        expect(t.listItemElement.classList.contains('high-priority-list-item')).toBe(true);
        expect(deps.marks()).toEqual({ [KEY5]: 1 });
        expect(deps.events).toEqual([{ event: 'pri', payload: { mark: 1 } }]);
        expect(deps.saveGame).toHaveBeenCalled();
    });
    test('a later day has its own three slots', () => {
        const today = task({ id: 1, dueDateTime: at(5) });
        const tomorrow = task({ id: 2, dueDateTime: at(6) });
        const deps = makeDeps([today, tomorrow], [], { [KEY5]: 3 });
        expect(Items.setPriority(1, true, deps).reason).toBe('full');
        expect(Items.setPriority(2, true, deps).ok).toBe(true);
        expect(deps.marks()).toEqual({ [KEY5]: 3, [KEY6]: 1 });
    });
    test('the fourth mark on a day is refused and changes nothing', () => {
        const items = [1, 2, 3, 4].map(id => task({ id }));
        const deps = makeDeps(items, []);
        [1, 2, 3].forEach(id => expect(Items.setPriority(id, true, deps).ok).toBe(true));
        const r = Items.setPriority(4, true, deps);
        expect(r).toMatchObject({ ok: false, changed: false, reason: 'full', left: 0 });
        expect(items[3].isHighPriority).toBe(false);
        expect(deps.marks()).toEqual({ [KEY5]: 3 });
    });
    test('unmarking takes the flag off but never gives the slot back', () => {
        const items = [1, 2, 3, 4].map(id => task({ id }));
        const deps = makeDeps(items, []);
        [1, 2, 3].forEach(id => Items.setPriority(id, true, deps));
        const r = Items.setPriority(1, false, deps);
        expect(r).toMatchObject({ ok: true, changed: true, action: 'unmark', left: 0 });
        expect(items[0].isHighPriority).toBe(false);
        expect(items[0].element.classList.contains('high-priority')).toBe(false);
        expect(deps.marks()).toEqual({ [KEY5]: 3 });
        expect(Items.setPriority(4, true, deps).reason).toBe('full'); // the freed slot is spent
    });
    test('finishing all three opens three fresh slots (completed priorities count by due day)', () => {
        const open = task({ id: 4 });
        const doneItems = [1, 2, 3].map(id => task({ id, isHighPriority: true, completedAt: new Date() }));
        const deps = makeDeps([open], doneItems, { [KEY5]: 3 });
        expect(Items.prioritySlotsFor(at(5), deps)).toMatchObject({ marks: 3, done: 3, left: 3 });
        expect(Items.setPriority(4, true, deps).ok).toBe(true);
        expect(deps.marks()).toEqual({ [KEY5]: 4 });
    });
    test('two of three finished is not a reset', () => {
        const doneItems = [1, 2].map(id => task({ id, isHighPriority: true }));
        const deps = makeDeps([task({ id: 4 })], doneItems, { [KEY5]: 3 });
        expect(Items.setPriority(4, true, deps).reason).toBe('full');
    });
    test('marking a parent covers its sub-tasks (flag + inherited tag) and costs ONE slot', () => {
        const parent = task({ id: 1, subTasks: [2, 3], totalSubTasks: 2 });
        const s1 = task({ id: 2, parentId: 1 });
        const s2 = task({ id: 3, parentId: 1 });
        const deps = makeDeps([parent, s1, s2], []);
        const r = Items.setPriority(1, true, deps);
        expect(r.left).toBe(2);
        expect(deps.marks()).toEqual({ [KEY5]: 1 });
        expect([s1.isHighPriority, s2.isHighPriority]).toEqual([true, true]);
        expect([s1.priorityInherited, s2.priorityInherited]).toEqual([true, true]);
        expect(s1.element.classList.contains('high-priority')).toBe(true);
        // a covered sub-task has no mark of its own to spend or remove
        expect(Items.setPriority(2, true, deps)).toMatchObject({ ok: true, changed: false, reason: 'covered' });
        expect(Items.setPriority(2, false, deps)).toMatchObject({ ok: true, changed: false, reason: 'covered' });
        expect(deps.marks()).toEqual({ [KEY5]: 1 });
    });
    test('unmarking the parent takes back exactly what its sub-tasks inherited', () => {
        const parent = task({ id: 1, subTasks: [2, 3], totalSubTasks: 2 });
        const own = task({ id: 2, parentId: 1 });
        const inherited = task({ id: 3, parentId: 1 });
        const deps = makeDeps([parent, own, inherited], []);
        Items.setPriority(2, true, deps); // the sub-task marked ALONE first (its own slot)
        Items.setPriority(1, true, deps); // then the parent
        expect(deps.marks()).toEqual({ [KEY5]: 2 });
        expect(inherited.priorityInherited).toBe(true);
        expect(own.priorityInherited).toBeUndefined(); // it already had its own mark
        Items.setPriority(1, false, deps);
        expect(parent.isHighPriority).toBe(false);
        expect(inherited.isHighPriority).toBe(false);
        expect(inherited.priorityInherited).toBeUndefined();
        expect(own.isHighPriority).toBe(true); // its own slot stands
    });
    test('a sub-task can be marked alone without touching its parent', () => {
        const parent = task({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = task({ id: 2, parentId: 1 });
        const deps = makeDeps([parent, sub], []);
        expect(Items.setPriority(2, true, deps)).toMatchObject({ ok: true, action: 'mark' });
        expect(sub.isHighPriority).toBe(true);
        expect(parent.isHighPriority).toBe(false);
        expect(deps.marks()).toEqual({ [KEY5]: 1 });
    });
    test('a missing or non-task id is reported, not thrown', () => {
        const deps = makeDeps([{ id: 9, type: 'habit' }], []);
        expect(Items.setPriority(9, true, deps).reason).toBe('missing');
        expect(Items.setPriority(404, true, deps).reason).toBe('missing');
    });
});

describe('Items.syncPriorityOnMove', () => {
    test('a move onto another day strips priority and the sub-tasks\' inherited flag; the slot stays spent', () => {
        const parent = task({ id: 1, subTasks: [2], totalSubTasks: 1 });
        const sub = task({ id: 2, parentId: 1 });
        const deps = makeDeps([parent, sub], []);
        Items.setPriority(1, true, deps);
        const old = parent.dueDateTime;
        parent.dueDateTime = at(6, 9);
        expect(Items.syncPriorityOnMove(parent, old, deps)).toBe(true);
        expect(parent.isHighPriority).toBe(false);
        expect(sub.isHighPriority).toBe(false);
        expect(parent.element.classList.contains('high-priority')).toBe(false);
        expect(deps.marks()).toEqual({ [KEY5]: 1 });
    });
    test('a move inside the same day keeps priority', () => {
        const t = task({ id: 1, dueDateTime: at(5, 9) });
        const deps = makeDeps([t], []);
        Items.setPriority(1, true, deps);
        const old = t.dueDateTime;
        t.dueDateTime = at(5, 23, 59);
        expect(Items.syncPriorityOnMove(t, old, deps)).toBe(false);
        expect(t.isHighPriority).toBe(true);
    });
    test('a normal task, a habit and an inherited sub-task are left alone', () => {
        const deps = makeDeps([], []);
        const n = task({ id: 1 });
        const old = n.dueDateTime;
        n.dueDateTime = at(7);
        expect(Items.syncPriorityOnMove(n, old, deps)).toBe(false);
        const inh = task({ id: 2, parentId: 9, isHighPriority: true, priorityInherited: true, dueDateTime: at(7) });
        expect(Items.syncPriorityOnMove(inh, at(5), deps)).toBe(false);
        expect(inh.isHighPriority).toBe(true);
        expect(Items.syncPriorityOnMove({ type: 'habit', isHighPriority: true }, at(5), deps)).toBe(false);
    });
    test('pulling a priority sub-task onto its parent\'s earlier day strips its own priority', () => {
        const parent = task({ id: 1, dueDateTime: at(5, 18), subTasks: [2], totalSubTasks: 1 });
        const sub = task({ id: 2, parentId: 1, dueDateTime: at(6, 9), isHighPriority: true });
        const deps = makeDeps([parent, sub], [], {});
        deps.recomputeOverdueStateAfterEdit = () => {};
        Items.clampSubTasksToParentDeadline(parent, Object.assign(deps, {
            gameScreenWidth: 800, enemyWidth: 64, calculateTimelineXWithClustering: () => 0,
            // The fixed Nov 2026 dates are in the past once the real clock passes them, which sends the clamp through the
            // overdue branch (needs these). Same result at any date.
            baseWidth: 0, getSubTaskClusterOffset: () => 0,
        }));
        expect(sub.dueDateTime.getTime()).toBe(parent.dueDateTime.getTime());
        expect(sub.isHighPriority).toBe(false);
    });
});

describe('Items.createTaskItemData: a sub-task under a priority parent', () => {
    const baseDeps = (active) => ({
        getNextId: () => 77, activeItems: active, gameScreenWidth: 800, enemyWidth: 64,
        calculateTimelineXWithClustering: () => 0,
    });
    test('is covered by it (flag + inherited tag), whatever the form passed', () => {
        const parent = task({ id: 1, isHighPriority: true });
        const sub = Items.createTaskItemData('s', 'other', false, '2026-11-05', '18:00', 1, baseDeps([parent]));
        expect(sub.isHighPriority).toBe(true);
        expect(sub.priorityInherited).toBe(true);
    });
    test('under a normal parent it keeps what the form passed', () => {
        const parent = task({ id: 1, isHighPriority: false });
        const sub = Items.createTaskItemData('s', 'other', false, '2026-11-05', '18:00', 1, baseDeps([parent]));
        expect(sub.isHighPriority).toBe(false);
        expect(sub.priorityInherited).toBeUndefined();
    });
});

describe('Items.completeItem / uncompleteItem: the daily record `pri` flag', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    function completeDeps(active, completed) {
        let xp = 0, points = 0;
        const events = [];
        return {
            isGameOver: () => false, activeItems: active, definedHabits: () => [], definedRoutines: () => [],
            completedItems: () => completed, xpPerTaskDefeat: CONFIG.XP_PER_TASK_DEFEAT,
            xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE, pointsPerTask: CONFIG.POINTS_PER_TASK,
            pointsPerHabit: CONFIG.POINTS_PER_HABIT, habitStreakBonusThreshold: CONFIG.HABIT_STREAK_BONUS_THRESHOLD,
            getPlayerXP: () => xp, setPlayerXP: (n) => { xp = n; }, getPlayerPoints: () => points,
            setPlayerPoints: (n) => { points = n; }, updatePlayerDisplays: () => {}, checkPlayerLevelUp: () => {},
            createListItem: () => {}, sortAndRenderActiveList: () => {}, renderCompletedItems: () => {},
            updateTaskCountDisplay: () => {}, resetAllSubTaskCheckboxes: () => {}, saveGame: () => {},
            baseWidth: 120, enemyWidth: CONFIG.ENEMY_WIDTH, habitEnemyWidth: CONFIG.HABIT_ENEMY_WIDTH,
            gameCanvas: fakeEl(), calculateTimelineXWithClustering: () => 0, getSubTaskClusterOffset: () => 0,
            getItemTopPosition: () => 0, handleEnemyClick: () => {},
            recordDaily: (event, payload) => events.push({ event, payload }), events,
        };
    }
    beforeAll(() => { global.document = { createElement: () => fakeEl() }; });
    afterAll(() => { delete global.document; });

    test('a priority task that spent a slot completes with pri:true; a normal task with pri:false', () => {
        const p = task({ id: 1, isHighPriority: true });
        const n = task({ id: 2 });
        const deps = completeDeps([p, n], []);
        Items.completeItem(1, deps);
        Items.completeItem(2, deps);
        const completes = deps.events.filter(e => e.event === 'complete');
        expect(completes[0].payload.pri).toBe(true);
        expect(completes[1].payload.pri).toBe(false);
    });
    test('a sub-task of a priority parent completes with pri:false (the parent owns the slot)', () => {
        const parent = task({ id: 1, isHighPriority: true, subTasks: [2], totalSubTasks: 1 });
        const sub = task({ id: 2, parentId: 1, isHighPriority: true, priorityInherited: true });
        const deps = completeDeps([parent, sub], []);
        Items.completeItem(2, deps);
        expect(deps.events.find(e => e.event === 'complete').payload.pri).toBe(false);
    });
});

describe('DailyRecord v9: pri', () => {
    test('the version is 11 (v10 adds pg, v11 adds pg.pts / items) and a fresh record carries pri { m, d, s }', () => {
        expect(DailyRecord.V).toBe(13);
        expect(DailyRecord.fresh().pri).toEqual({ m: 0, d: 0, s: 0 });
    });
    test('a mark bumps m; a priority completion bumps d and an undo takes it back (floor 0)', () => {
        const rec = DailyRecord.fresh();
        DailyRecord.bump(rec, 'pri', { mark: 1 });
        DailyRecord.bump(rec, 'pri', { mark: 1 });
        expect(rec.pri.m).toBe(2);
        const done = { kind: 'task', category: 'other', at: Date.now(), pri: true };
        DailyRecord.bump(rec, 'complete', done);
        DailyRecord.bump(rec, 'complete', done);
        expect(rec.pri.d).toBe(2);
        DailyRecord.bump(rec, 'uncomplete', done);
        expect(rec.pri.d).toBe(1);
        DailyRecord.bump(rec, 'uncomplete', done);
        DailyRecord.bump(rec, 'uncomplete', done);
        expect(rec.pri.d).toBe(0);
    });
    test('a completion without pri leaves d alone, and a bad mark payload is ignored', () => {
        const rec = DailyRecord.fresh();
        DailyRecord.bump(rec, 'complete', { kind: 'task', category: 'other', at: Date.now() });
        DailyRecord.bump(rec, 'pri', { mark: 0 });
        DailyRecord.bump(rec, 'pri', {});
        expect(rec.pri).toEqual({ m: 0, d: 0, s: 0 });
    });
    test('close writes s = full sets of three; older records without pri normalise to zeros', () => {
        const rec = DailyRecord.fresh();
        rec.pri = { m: 7, d: 7, s: 0 };
        expect(DailyRecord.close(rec, {}).pri).toEqual({ m: 7, d: 7, s: 2 });
        const old = DailyRecord.fresh();
        delete old.pri;
        expect(DailyRecord.normalize(old).pri).toEqual({ m: 0, d: 0, s: 0 });
    });
    test('the month roll-up sums pri', () => {
        const a = DailyRecord.fresh({ date: '2026-10-01' });
        const b = DailyRecord.fresh({ date: '2026-10-02' });
        a.pri = { m: 3, d: 3, s: 1 };
        b.pri = { m: 2, d: 1, s: 0 };
        let store = DailyRecord.normalizeStore({ v: DailyRecord.V, days: {}, months: {} });
        store = DailyRecord.addDay(store, DailyRecord.close(a, {}));
        store = DailyRecord.addDay(store, DailyRecord.close(b, {}));
        const rolled = DailyRecord.rollUp(store, new Date(2028, 5, 1)); // far enough on that October is a month
        const month = rolled.months['2026-10'];
        expect(month).toBeTruthy();
        expect(month.pri).toEqual({ m: 5, d: 4, s: 1 });
    });
});

describe('Persistence v16 -> v17', () => {
    test('seeds priorityMarks {} and makes every saved routine task definition non-priority', () => {
        const save = Persistence.migrate({
            schemaVersion: 16,
            definedTasks: [{ id: 't1', isHighPriority: true }, { id: 't2', isHighPriority: false }, null],
            activeItems: [{ id: 1, type: 'task', isHighPriority: true }],
        });
        expect(save.schemaVersion).toBe(Persistence.SCHEMA_VERSION); // 16 -> 17 -> ... -> current
        expect(save.priorityMarks).toEqual({});
        expect(save.definedTasks[0].isHighPriority).toBe(false);
        expect(save.definedTasks[1].isHighPriority).toBe(false);
        expect(save.activeItems[0].isHighPriority).toBe(true); // instances already on the board keep their flag
    });
    test('a save with no definedTasks, and one that already has marks, both migrate', () => {
        expect(Persistence.migrate({ schemaVersion: 16 }).priorityMarks).toEqual({});
        const kept = { [KEY5]: 2 };
        expect(Persistence.migrate({ schemaVersion: 16, priorityMarks: kept }).priorityMarks).toBe(kept);
    });
    test('SCHEMA_VERSION is at least 18 (19 added skyPick, 2026-11-09)', () => {
        expect(Persistence.SCHEMA_VERSION).toBeGreaterThanOrEqual(18);
    });
});

describe('Routine task definitions are never priority', () => {
    test('an instance spawns normal even from an old priority definition', () => {
        const def = { id: 't1', name: 'T', category: 'other', isHighPriority: true, defaultDueTime: '17:00' };
        const inst = Routines.createRoutineTaskInstanceData(def, at(5), {
            getNextId: () => 5, gameScreenWidth: 800, enemyWidth: 64, calculateTimelineXWithClustering: () => 0,
        });
        expect(inst.isHighPriority).toBe(false);
    });
    test('createNewTaskInRoutine and editTaskInRoutine ignore a priority flag', () => {
        const routines = [{ id: 'r1', taskDefinitionIds: [] }];
        const defs = [];
        const made = Routines.createNewTaskInRoutine('r1', { name: 'N', category: 'other', isHighPriority: true, defaultDueTime: '09:00' }, routines, defs);
        expect(made.isHighPriority).toBe(false);
        Routines.editTaskInRoutine(made.id, { name: 'N2', category: 'other', isHighPriority: true, defaultDueTime: '10:00' }, defs);
        expect(defs[0].isHighPriority).toBe(false);
        expect(defs[0].name).toBe('N2');
    });
});

describe('State: priorityMarks', () => {
    beforeAll(() => { global.window = { definedTasks: [] }; });
    afterAll(() => { delete global.window; });
    beforeEach(() => State.setPriorityMarks(null));

    test('starts empty; the setter keeps only valid day keys with a count above 0', () => {
        expect(State.getPriorityMarks()).toEqual({});
        State.setPriorityMarks({ [KEY5]: 2, junk: 4, '2026-11-06': -1 });
        expect(State.getPriorityMarks()).toEqual({ [KEY5]: 2 });
        State.setPriorityMarks(42);
        expect(State.getPriorityMarks()).toEqual({});
    });
    test('it rides in getPersistableState as priorityMarks', () => {
        State.setPriorityMarks({ [KEY5]: 3 });
        expect(State.getPersistableState({}).priorityMarks).toEqual({ [KEY5]: 3 });
    });
});

describe('wiring pins', () => {
    const fs = require('fs');
    const path = require('path');
    const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
    test('index.html loads prioritySlots.js before items.js, and sw.js caches it', () => {
        const html = read('index.html');
        expect(html).toContain('js/prioritySlots.js');
        expect(html.indexOf('js/prioritySlots.js')).toBeLessThan(html.indexOf('js/items.js'));
        expect(read('sw.js')).toContain("'js/prioritySlots.js'");
    });
    test('script.js hands the marks to Items and strips priority on the three move paths', () => {
        const js = read('script.js');
        expect(js).toContain('getPriorityMarks: () => State.getPriorityMarks()');
        expect(js).toContain('setPriorityMarks: (m) => State.setPriorityMarks(m)');
        expect((js.match(/Items\.syncPriorityOnMove\(/g) || []).length).toBeGreaterThanOrEqual(3);
    });
});

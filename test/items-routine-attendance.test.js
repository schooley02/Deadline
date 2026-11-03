/**
 * Routine attendance wiring (village High school, Build 1, 2026-10-30): Items sends the owning routine's id
 * with the daily-record events (complete / uncomplete / overdue), and the real DailyRecord turns those into
 * a perfect-attendance day. Harness mirrors test/items-death-anim.test.js.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.RunStats = require('../js/runStats.js');
global.SpriteAnim = require('../js/spriteAnim.js');
const DailyRecord = require('../js/dailyRecord.js');
const Items = require('../js/items.js');

function fakeEl() {
    const classes = new Set();
    return {
        style: {}, dataset: {}, textContent: '',
        classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
        addEventListener: () => {}, appendChild: () => {}, remove: () => {},
        querySelector: () => null, querySelectorAll: () => [], setAttribute: () => {}, removeAttribute: () => {},
        insertBefore: () => {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    };
}
beforeAll(() => { global.document = { createElement: () => fakeEl(), body: { classList: { contains: () => false } } }; });
afterAll(() => { delete global.document; });
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

function dueAt(offsetMs) { return new Date(Date.now() + offsetMs); }
function task(id, definitionId, due) {
    return { id, type: 'task', definitionId, name: 'T', category: 'other', isHighPriority: false,
        dueDateTime: due, isOverdue: false, lastDamageTickTime: null, parentId: null, subTasks: [],
        completedSubTasks: 0, totalSubTasks: 0, element: fakeEl(), listItemElement: null };
}
const ROUTINE = { id: 42, name: 'Bedtime', taskDefinitionIds: [900], habitDefinitionIds: [] };

function makeDeps(activeItems, rec, completed, routines) {
    let xp = 0, points = 100;
    const done = completed || [];
    return {
        isGameOver: () => false, activeItems, definedHabits: () => [], definedRoutines: () => routines || [ROUTINE],
        completedItems: () => done, getCurrentRunStats: () => RunStats.freshRunStats(), recordLifetime: () => {},
        recordDaily: (event, payload) => DailyRecord.bump(rec, event, payload),
        xpPerTaskDefeat: CONFIG.XP_PER_TASK_DEFEAT, xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
        pointsPerTask: CONFIG.POINTS_PER_TASK, pointsPerHabit: CONFIG.POINTS_PER_HABIT,
        habitStreakBonusThreshold: CONFIG.HABIT_STREAK_BONUS_THRESHOLD,
        getPlayerXP: () => xp, setPlayerXP: (n) => { xp = n; }, getPlayerPoints: () => points, setPlayerPoints: (n) => { points = n; },
        updatePlayerDisplays: () => {}, checkPlayerLevelUp: () => {}, createListItem: () => {}, sortAndRenderActiveList: () => {},
        renderCompletedItems: () => {}, updateTaskCountDisplay: () => {}, resetAllSubTaskCheckboxes: () => {}, saveGame: () => {},
        baseWidth: 120, enemyWidth: CONFIG.ENEMY_WIDTH, habitEnemyWidth: CONFIG.HABIT_ENEMY_WIDTH, gameCanvas: fakeEl(),
        calculateTimelineXWithClustering: () => 0, getSubTaskClusterOffset: () => 0, getItemTopPosition: () => 0, handleEnemyClick: () => {},
    };
}
function fresh() { return DailyRecord.fresh({ date: '2026-11-01', run: 1 }); }

test('completing a routine-owned task tallies it under the routine; a standalone task tallies nothing', () => {
    const rec = fresh();
    const items = [task(1, 900, dueAt(3600e3)), task(2, null, dueAt(3600e3))];
    const deps = makeDeps(items, rec);
    Items.completeItem(1, deps);
    expect(rec.rt).toEqual({ '42': [1, 0, 0] });
    Items.completeItem(2, deps);
    expect(rec.rt).toEqual({ '42': [1, 0, 0] });
    expect(rec.done.task).toBe(2);
});

test('going overdue then finishing late keeps a routine perfect; never finishing does not', () => {
    const rec = fresh();
    const a = task(1, 900, dueAt(-60e3)), b = task(3, 900, dueAt(-60e3));
    const deps = makeDeps([a, b], rec);
    Items.markAsOverdue(a, Date.now(), deps);
    Items.markAsOverdue(b, Date.now(), deps);
    expect(rec.rt['42']).toEqual([0, 2, 0]);
    Items.completeItem(1, deps);
    expect(rec.rt['42']).toEqual([1, 2, 1]);
    // one miss was never finished
    expect(DailyRecord.attendanceFromTally(rec.rt)).toEqual({ active: 1, perfect: 0 });
    Items.completeItem(3, deps);
    expect(DailyRecord.attendanceFromTally(rec.rt)).toEqual({ active: 1, perfect: 1 });
});

test('undoing a completion reverses the routine tally', () => {
    const rec = fresh();
    const completed = [];
    const items = [task(1, 900, dueAt(3600e3))];
    const deps = makeDeps(items, rec, completed);
    Items.completeItem(1, deps);
    expect(rec.rt['42']).toEqual([1, 0, 0]);
    Items.uncompleteItem(1, deps);
    expect(rec.rt['42']).toEqual([0, 0, 0]);
});

test('a routine that finished everything makes a perfect-attendance day once the record closes', () => {
    const rec = fresh();
    const items = [task(1, 900, dueAt(3600e3)), task(2, 900, dueAt(7200e3))];
    const deps = makeDeps(items, rec);
    Items.completeItem(1, deps);
    Items.completeItem(2, deps);
    expect(DailyRecord.isPerfectAttendance(DailyRecord.close(rec, {}))).toBe(true);
});

test('missing routine lookups never break a completion (deps without definedRoutines)', () => {
    const rec = fresh();
    const deps = makeDeps([task(1, 900, dueAt(3600e3))], rec);
    delete deps.definedRoutines;
    expect(() => Items.completeItem(1, deps)).not.toThrow();
    expect(rec.rt).toEqual({});
    expect(rec.done.task).toBe(1);
});

// --- Real routine ids are STRINGS ("routine_<n>_<timestamp>"); the tally used to drop them (fixed 2026-11-02) ---
const STRING_ROUTINE = { id: 'routine_0_1730000000000', name: 'Evening', taskDefinitionIds: [900], habitDefinitionIds: [] };

test('a real-shaped (string) routine id is tallied: completion, late finish, undo', () => {
    const rec = fresh();
    const completed = [];
    const items = [task(1, 900, dueAt(3600e3)), task(2, 900, dueAt(-60e3))];
    const deps = makeDeps(items, rec, completed, [STRING_ROUTINE]);
    Items.completeItem(1, deps);
    expect(rec.rt).toEqual({ 'routine_0_1730000000000': [1, 0, 0] });
    Items.markAsOverdue(items[1], Date.now(), deps);
    expect(rec.rt['routine_0_1730000000000']).toEqual([1, 1, 0]);
    Items.completeItem(2, deps);
    expect(rec.rt['routine_0_1730000000000']).toEqual([2, 1, 1]);
    Items.uncompleteItem(1, deps);
    expect(rec.rt['routine_0_1730000000000']).toEqual([1, 1, 1]);
});

test('a string-id routine that finished everything banks perfect attendance when the day closes', () => {
    const rec = fresh();
    const items = [task(1, 900, dueAt(3600e3)), task(2, 900, dueAt(7200e3))];
    const deps = makeDeps(items, rec, [], [STRING_ROUTINE]);
    Items.completeItem(1, deps);
    Items.completeItem(2, deps);
    const closed = DailyRecord.close(rec, {});
    expect(closed.att).toEqual({ active: 1, perfect: 1 });
    expect(DailyRecord.isPerfectAttendance(closed)).toBe(true);
    expect(closed.rt).toEqual({});
});

test('a string-id routine with a miss it never finished is active but not perfect', () => {
    const rec = fresh();
    const a = task(1, 900, dueAt(-60e3));
    const deps = makeDeps([a], rec, [], [STRING_ROUTINE]);
    Items.markAsOverdue(a, Date.now(), deps);
    const closed = DailyRecord.close(rec, {});
    expect(closed.att).toEqual({ active: 1, perfect: 0 });
});

describe('DailyRecord routine ids are opaque', () => {
    const bumpDone = (id) => {
        const rec = fresh();
        DailyRecord.bump(rec, 'complete', { kind: 'habit', category: 'other', at: Date.now(), routineId: id });
        return rec.rt;
    };
    test.each([['routine_1_1730000000000'], [42], ['7'], ['routine_0_1']])('%p is tallied', (id) => {
        expect(bumpDone(id)).toEqual({ [String(id)]: [1, 0, 0] });
    });
    test.each([[null], [undefined], [''], [NaN], [Infinity], [{}], [true]])('%p is a standalone item and tallies nothing', (id) => {
        expect(bumpDone(id)).toEqual({});
    });
    test('a slipped Break habit tallies a miss under a string id', () => {
        const rec = fresh();
        DailyRecord.bump(rec, 'lurk', { outcome: 'slipped', routineId: 'routine_2_99' });
        expect(rec.rt).toEqual({ 'routine_2_99': [0, 1, 0] });
    });
});

/**
 * High school v2 step 0 (2026-10-31): routine TASKS keep an occurrenceHistory on their definition and count
 * toward the routine's hero star rate (Heroes.completionRate). Harness mirrors
 * test/items-routine-attendance.test.js.
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
    return { id, type: 'task', definitionId, originalDueDate: new Date(due), name: 'T', category: 'other', isHighPriority: false,
        dueDateTime: due, isOverdue: false, lastDamageTickTime: null, parentId: null, subTasks: [],
        completedSubTasks: 0, totalSubTasks: 0, element: fakeEl(), listItemElement: null };
}
const ROUTINE = { id: 42, name: 'Bedtime', taskDefinitionIds: [900], habitDefinitionIds: [] };

function makeDepsBase(activeItems, rec, completed) {
    let xp = 0, points = 100;
    const done = completed || [];
    return {
        isGameOver: () => false, activeItems, definedHabits: () => [], definedRoutines: () => [ROUTINE],
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

function makeDeps(activeItems, defs, completed) {
    const rec = DailyRecord.fresh({ date: '2026-11-01', run: 1 });
    return Object.assign(makeDepsBase(activeItems, rec, completed), { definedTasks: () => defs });
}
function taskDef(id) { return { id, name: 'T' + id, category: 'other' }; }
const dateOf = (d) => Habits.toOccurrenceDate(d);

describe('Items: routine task occurrence history', () => {
    test('completing a routine task records a success for its due day; standalone tasks record nothing', () => {
        const def = taskDef(900);
        const a = task(1, 900, dueAt(3600e3)), b = task(2, null, dueAt(3600e3));
        const deps = makeDeps([a, b], [def]);
        Items.completeItem(1, deps);
        Items.completeItem(2, deps);
        expect(def.occurrenceHistory).toEqual([{ date: dateOf(a.originalDueDate), success: true }]);
    });

    test('going overdue records a miss; finishing late overwrites it with a success (the habit rule)', () => {
        const def = taskDef(900);
        const a = task(1, 900, dueAt(-60e3));
        const deps = makeDeps([a], [def]);
        Items.markAsOverdue(a, Date.now(), deps);
        expect(def.occurrenceHistory).toEqual([{ date: dateOf(a.originalDueDate), success: false }]);
        Items.completeItem(1, deps);
        expect(def.occurrenceHistory).toEqual([{ date: dateOf(a.originalDueDate), success: true }]);
    });

    test('an edit into the past (skipHabitMiss) is a correction, not a miss', () => {
        const def = taskDef(900);
        const a = task(1, 900, dueAt(-60e3));
        const deps = Object.assign(makeDeps([a], [def]), { skipHabitMiss: true });
        Items.markAsOverdue(a, Date.now(), deps);
        expect(def.occurrenceHistory).toBeUndefined();
    });

    test('undoing a completion before the due time removes the day; after it, the day is a miss again', () => {
        const early = taskDef(900);
        const a = task(1, 900, dueAt(3600e3));
        const done = [];
        const deps = makeDeps([a], [early], done);
        Items.completeItem(1, deps);
        jest.runOnlyPendingTimers();
        expect(done.map(i => i.id)).toContain(1);
        Items.uncompleteItem(1, deps);
        expect(early.occurrenceHistory).toEqual([]);

        const late = taskDef(901);
        const b = task(2, 901, dueAt(-60e3));
        const done2 = [];
        const deps2 = makeDeps([b], [late], done2);
        Items.completeItem(2, deps2);
        jest.runOnlyPendingTimers();
        Items.uncompleteItem(2, deps2);
        expect(late.occurrenceHistory).toEqual([{ date: dateOf(b.originalDueDate), success: false }]);
    });

    test('rollover: an undone instance with no entry yet records ONE miss; an existing entry is left alone', () => {
        const def = taskDef(900);
        const a = task(1, 900, dueAt(-26 * 3600e3));
        const deps = makeDeps([a], [def]);
        Items.settleStaleRecurringInstance(a, deps);
        expect(def.occurrenceHistory).toEqual([{ date: dateOf(a.originalDueDate), success: false }]);

        const def2 = taskDef(901);
        const b = task(2, 901, dueAt(-26 * 3600e3));
        const deps2 = makeDeps([b], [def2]);
        Items.markAsOverdue(b, Date.now(), deps2);
        Items.settleStaleRecurringInstance(b, deps2);
        expect(def2.occurrenceHistory).toHaveLength(1);
        expect(deps2.activeItems).toHaveLength(0);
    });

    test('rollover: a KO ghost records nothing', () => {
        const def = taskDef(900);
        const a = Object.assign(task(1, 900, dueAt(-26 * 3600e3)), { koGhost: true });
        const deps = makeDeps([a], [def]);
        Items.settleStaleRecurringInstance(a, deps);
        expect(def.occurrenceHistory).toBeUndefined();
    });

    test('no definedTasks getter (older callers) is a safe no-op', () => {
        const a = task(1, 900, dueAt(-60e3));
        const rec = DailyRecord.fresh({ date: '2026-11-01', run: 1 });
        const deps = makeDepsBase([a], rec);
        expect(() => Items.markAsOverdue(a, Date.now(), deps)).not.toThrow();
        expect(() => Items.completeItem(1, deps)).not.toThrow();
    });

    test('history is trimmed to HERO_STAR_RATE_WINDOW entries', () => {
        const old = [];
        for (let i = 0; i < CONFIG.HERO_STAR_RATE_WINDOW; i++) old.push({ date: '2020-01-' + String(i + 1).padStart(2, '0'), success: true });
        const def = Object.assign(taskDef(900), { occurrenceHistory: old.slice(0, 28) });
        const a = task(1, 900, dueAt(-60e3));
        Items.markAsOverdue(a, Date.now(), makeDeps([a], [def]));
        expect(def.occurrenceHistory).toHaveLength(CONFIG.HERO_STAR_RATE_WINDOW);
        expect(def.occurrenceHistory[def.occurrenceHistory.length - 1].success).toBe(false);
    });
});

describe('Heroes.completionRate: habits + routine tasks', () => {
    const START = new Date(2026, 9, 1).getTime();
    const routine = { id: 'r1', habitDefinitionIds: ['h1'], taskDefinitionIds: ['t1'] };
    const habits = [{ id: 'h1', routineId: 'r1', occurrenceHistory: [
        { date: '2026-10-01', success: true }, { date: '2026-10-02', success: true }] }];
    const tasks = [
        { id: 't1', occurrenceHistory: [{ date: '2026-10-02', success: false }, { date: '2026-10-03', success: true }] },
        { id: 't9', occurrenceHistory: [{ date: '2026-10-05', success: false }] }, // not in this routine
    ];
    afterEach(() => Heroes.setTaskDefsSource(null));

    test('one habit + one task: rate and tenure merge both, other routines\' tasks ignored', () => {
        const r = Heroes.completionRate(routine, habits, START, 28, tasks);
        expect(r).toEqual({ rate: 3 / 4, samples: 4, distinctDays: 3 });
    });

    test('a task-only routine is rated', () => {
        const r = Heroes.completionRate({ id: 'r2', taskDefinitionIds: ['t1'] }, [], START, 28, tasks);
        expect(r).toEqual({ rate: 1 / 2, samples: 2, distinctDays: 2 });
    });

    test('omitted task list falls back to the registered source; an explicit [] wins over it', () => {
        expect(Heroes.completionRate(routine, habits, START, 28).samples).toBe(2);
        Heroes.setTaskDefsSource(() => tasks);
        expect(Heroes.completionRate(routine, habits, START, 28).samples).toBe(4);
        expect(Heroes.completionRate(routine, habits, START, 28, []).samples).toBe(2);
    });

    test('task entries before the window start are ignored', () => {
        const r = Heroes.completionRate(routine, [], new Date(2026, 9, 3).getTime(), 28, tasks);
        expect(r).toEqual({ rate: 1, samples: 1, distinctDays: 1 });
    });
});

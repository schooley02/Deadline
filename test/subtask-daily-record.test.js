/**
 * Sub-task credit, daily-record side (DailyRecord v13, 2026-11-11; DECISIONS 2026-11-11 (sub-task credit)).
 * Items sends a sub-task's events with kind 'subtask': an overdue one lands in missed.subtask (never missed.task), a late
 * completion stays out of done.late, and the day totals the Clock tower / best-worst day read count tasks + habits only.
 * Harness mirrors test/items-routine-attendance.test.js.
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
function task(id, due, over) {
    return Object.assign({ id, type: 'task', definitionId: null, name: 'T', category: 'other', isHighPriority: false,
        dueDateTime: due, isOverdue: false, lastDamageTickTime: null, parentId: null, subTasks: [],
        completedSubTasks: 0, totalSubTasks: 0, element: fakeEl(), listItemElement: null }, over || {});
}
function makeDeps(activeItems, rec, completed) {
    let xp = 0, points = 100;
    const done = completed || [];
    return {
        isGameOver: () => false, activeItems, definedHabits: () => [], definedRoutines: () => [],
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
function fresh() { return DailyRecord.fresh({ date: '2026-11-11', run: 1 }); }

test('an overdue sub-task is a missed.subtask; an overdue task is still a missed.task', () => {
    const rec = fresh();
    const parent = task(1, dueAt(3600e3), { subTasks: [2], totalSubTasks: 1 });
    const sub = task(2, dueAt(-60e3), { parentId: 1 });
    const lone = task(3, dueAt(-60e3));
    const deps = makeDeps([parent, sub, lone], rec);
    Items.markAsOverdue(sub, Date.now(), deps);
    Items.markAsOverdue(lone, Date.now(), deps);
    expect(rec.missed).toEqual({ task: 1, habit: 0, subtask: 1 });
});

test('a sub-task finished late counts in done.subtask but not done.late; the day totals ignore it', () => {
    const rec = fresh();
    const parent = task(1, dueAt(3600e3), { subTasks: [2], totalSubTasks: 1 });
    const sub = task(2, dueAt(-60e3), { parentId: 1 });
    const deps = makeDeps([parent, sub], rec);
    Items.markAsOverdue(sub, Date.now(), deps);
    Items.completeItem(2, deps);
    expect(rec.done.subtask).toBe(1);
    expect(rec.done.late).toBe(0);
    expect(DailyRecord.totals(rec)).toEqual({ done: 0, missed: 0, damage: 0 });
});

test('finishing then undoing a sub-task leaves the record where it started', () => {
    const rec = fresh();
    const parent = task(1, dueAt(3600e3), { subTasks: [2], totalSubTasks: 1 });
    const sub = task(2, dueAt(-60e3), { parentId: 1 });
    const completed = [];
    const deps = makeDeps([parent, sub], rec, completed);
    Items.markAsOverdue(sub, Date.now(), deps);
    Items.completeItem(2, deps);
    jest.advanceTimersByTime(500);
    Items.uncompleteItem(2, deps);
    expect(rec.done.subtask).toBe(0);
    expect(rec.done.late).toBe(0);
});

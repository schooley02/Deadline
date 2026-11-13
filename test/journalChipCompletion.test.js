/**
 * Journal Build C: completing a task with a running timer reports the run to deps.onTimedCompletion (the completion chip's trigger).
 * Harness mirrors test/subtask-daily-record.test.js.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.RunStats = require('../js/runStats.js');
global.SpriteAnim = require('../js/spriteAnim.js');
global.Timer = require('../js/timer.js');
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

function makeDeps(activeItems, extra) {
    let xp = 0, points = 100; const done = []; const rec = DailyRecord.fresh({ date: '2026-11-11', run: 1 });
    return Object.assign({
        isGameOver: () => false, activeItems, definedHabits: () => [], definedRoutines: () => [],
        completedItems: () => done, getCurrentRunStats: () => RunStats.freshRunStats(), recordLifetime: () => {},
        recordDaily: (event, payload) => { DailyRecord.bump(rec, event, payload) },
        xpPerTaskDefeat: CONFIG.XP_PER_TASK_DEFEAT, xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
        pointsPerTask: CONFIG.POINTS_PER_TASK, pointsPerHabit: CONFIG.POINTS_PER_HABIT,
        habitStreakBonusThreshold: CONFIG.HABIT_STREAK_BONUS_THRESHOLD,
        getPlayerXP: () => xp, setPlayerXP: (n) => { xp = n; }, getPlayerPoints: () => points, setPlayerPoints: (n) => { points = n; },
        updatePlayerDisplays: () => {}, checkPlayerLevelUp: () => {}, createListItem: () => {}, sortAndRenderActiveList: () => {},
        renderCompletedItems: () => {}, updateTaskCountDisplay: () => {}, resetAllSubTaskCheckboxes: () => {}, saveGame: () => {},
        baseWidth: 120, enemyWidth: CONFIG.ENEMY_WIDTH, habitEnemyWidth: CONFIG.HABIT_ENEMY_WIDTH, gameCanvas: fakeEl(),
        calculateTimelineXWithClustering: () => 0, getSubTaskClusterOffset: () => 0, getItemTopPosition: () => 0, handleEnemyClick: () => {},
    }, extra || {});
}
function task() {
    return { id: 7, type: 'task', definitionId: null, name: 'T', category: 'other', isHighPriority: false,
        dueDateTime: new Date(Date.now() + 3600000), isOverdue: false, lastDamageTickTime: null, parentId: null, subTasks: [],
        completedSubTasks: 0, totalSubTasks: 0, element: fakeEl(), listItemElement: null };
}

test('a task finished with its timer running reports the run length', () => {
    const t = task(); const spy = jest.fn();
    Timer.start(t, Date.now());
    jest.advanceTimersByTime(125000);
    Items.completeItem(7, makeDeps([t], { onTimedCompletion: spy }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe(t);
    expect(spy.mock.calls[0][1]).toBeGreaterThanOrEqual(125000);
});

test('no timer running: no report', () => {
    const t = task(); const spy = jest.fn();
    Items.completeItem(7, makeDeps([t], { onTimedCompletion: spy }));
    expect(spy).not.toHaveBeenCalled();
});

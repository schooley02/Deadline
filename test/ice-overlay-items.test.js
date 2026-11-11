/**
 * Completing an iced zombie (docs/ICE_PLAN.md "Art", Jeremy 2026-11-10): the ice burst plays in the SAME instant as the death
 * animation. Items.completeItem calls IceOverlay.burstOnDefeat right after SpriteAnim.playDeath, never later and never instead.
 * Harness copied from test/items-death-anim.test.js.
 */
const fs = require('fs');
const path = require('path');
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.RunStats = require('../js/runStats.js');
global.SpriteAnim = require('../js/spriteAnim.js');
const Items = require('../js/items.js');

function fakeEl(animated) {
    const classes = new Set(animated ? ['has-anim-sprite'] : []);
    return {
        style: {}, dataset: {}, textContent: '',
        classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
        _classes: classes,
        addEventListener: () => {}, appendChild: () => {}, remove: () => {},
    };
}
beforeAll(() => { global.document = { createElement: () => fakeEl(), body: { classList: { contains: () => false } } }; });
afterAll(() => { delete global.document; });

function tomorrowNoon() { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d; }
function task(el) {
    return { id: 1, type: 'task', definitionId: null, name: 'T', category: 'other', isHighPriority: false,
        dueDateTime: tomorrowNoon(), isOverdue: false, lastDamageTickTime: null, parentId: null, subTasks: [],
        completedSubTasks: 0, totalSubTasks: 0, element: el, listItemElement: null };
}
function makeDeps(activeItems) {
    let xp = 0, points = 100;
    return {
        isGameOver: () => false, activeItems, definedHabits: () => [], definedRoutines: () => [],
        completedItems: () => [], getCurrentRunStats: () => RunStats.freshRunStats(), recordLifetime: () => {},
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

describe('completing an iced / thawing zombie', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); delete global.IceOverlay; });

    test('the burst starts in the same call as the death animation: .enemy-dying is already on, nothing is deferred', () => {
        const el = fakeEl(true);
        const seen = [];
        global.IceOverlay = { burstOnDefeat: jest.fn((e) => { seen.push({ el: e, dying: el._classes.has('enemy-dying') }); return 740; }) };
        const deps = makeDeps([task(el)]);
        Items.completeItem(1, deps);
        expect(IceOverlay.burstOnDefeat).toHaveBeenCalledTimes(1);
        expect(seen[0]).toEqual({ el, dying: true });
    });
    test('it does not change the death timing: still 750 ms, fade in the last 200 ms, then removed', () => {
        const el = fakeEl(true);
        global.IceOverlay = { burstOnDefeat: jest.fn(() => 740) };
        const deps = makeDeps([task(el)]);
        Items.completeItem(1, deps);
        expect(el.style.transition).toBe('opacity 200ms ease 550ms');
        jest.advanceTimersByTime(749);
        expect(deps.activeItems.length).toBe(1);
        jest.advanceTimersByTime(1);
        expect(deps.activeItems.length).toBe(0);
    });
    test('also called on the plain-fade path (no animated sprite): the module itself decides what motion allows', () => {
        const el = fakeEl(false);
        global.IceOverlay = { burstOnDefeat: jest.fn(() => 0) };
        Items.completeItem(1, makeDeps([task(el)]));
        expect(IceOverlay.burstOnDefeat).toHaveBeenCalledWith(el);
    });
    test('IceOverlay is optional: completion works without it (old tests, partial pages)', () => {
        delete global.IceOverlay;
        const el = fakeEl(true);
        const deps = makeDeps([task(el)]);
        expect(() => Items.completeItem(1, deps)).not.toThrow();
        expect(el._classes.has('enemy-dying')).toBe(true);
    });
});

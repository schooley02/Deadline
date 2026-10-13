/**
 * Undo of a past-due completion ([DECISIONS.md 2026-10-12], Jeremy's call):
 * uncompleteItemWithDuePrompt asks for a new due time BEFORE any damage clock
 * is set; uncompleteItem itself now starts a clean-slate clock (no back-charge).
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.RunStats = require('../js/runStats.js');
const Items = require('../js/items.js');

function fakeEl() {
    const classes = new Set();
    return {
        style: {}, dataset: {}, textContent: '',
        classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
        addEventListener: () => {}, appendChild: () => {}, insertBefore: () => {}, querySelector: () => null,
        firstChild: null, remove: () => {},
    };
}
beforeAll(() => { global.document = { createElement: () => fakeEl(), body: { classList: { contains: () => false } } }; });
afterAll(() => { delete global.document; });

const HOUR = 3600 * 1000;
function completedTask(overrides = {}) {
    return {
        id: 1, type: 'task', name: 'T', category: 'other', isHighPriority: false,
        dueDateTime: new Date(Date.now() - 13 * HOUR), isOverdue: true,
        lastDamageTickTime: 123, parentId: null, subTasks: [], completedSubTasks: 0, totalSubTasks: 0,
        completedAt: new Date(), element: null, listItemElement: null, ...overrides,
    };
}
function makeDeps(completed, extra = {}) {
    let xp = 50, points = 50;
    const activeItems = [];
    return {
        isGameOver: () => false, activeItems,
        completedItems: () => completed,
        definedHabits: () => [], definedRoutines: () => [],
        getCurrentRunStats: () => RunStats.freshRunStats(), recordLifetime: () => {},
        xpPerTaskDefeat: CONFIG.XP_PER_TASK_DEFEAT, xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
        pointsPerTask: CONFIG.POINTS_PER_TASK, pointsPerHabit: CONFIG.POINTS_PER_HABIT,
        getPlayerXP: () => xp, setPlayerXP: (n) => { xp = n; },
        getPlayerPoints: () => points, setPlayerPoints: (n) => { points = n; },
        updatePlayerDisplays: () => {}, createListItem: () => {}, sortAndRenderActiveList: () => {},
        renderCompletedItems: jest.fn(), updateTaskCountDisplay: () => {}, saveGame: () => {},
        baseWidth: 120, enemyWidth: CONFIG.ENEMY_WIDTH, habitEnemyWidth: CONFIG.HABIT_ENEMY_WIDTH,
        gameCanvas: fakeEl(), calculateTimelineXWithClustering: () => 500,
        getSubTaskClusterOffset: () => 0, getItemTopPosition: () => 0, handleEnemyClick: () => {},
        ...extra,
    };
}

describe('uncompleteItem clean-slate clock', () => {
    test('a past-due undo starts the damage clock now, not at the old due time', () => {
        const item = completedTask();
        const deps = makeDeps([item]);
        const before = Date.now();
        Items.uncompleteItem(1, deps);
        expect(item.isOverdue).toBe(true);
        expect(item.lastDamageTickTime).toBeGreaterThanOrEqual(before);
        expect(item.lastDamageTickTime).toBeGreaterThan(item.dueDateTime.getTime() + 12 * HOUR);
        expect(deps.activeItems.length + 0).toBeGreaterThanOrEqual(0);
    });
});

describe('uncompleteItem overdue visuals', () => {
    test('an undone past-due item\'s NEW element gets enemy-at-base (attack animation)', () => {
        const item = completedTask();
        Items.uncompleteItem(1, makeDeps([item]));
        expect(item.element.classList.contains('enemy-at-base')).toBe(true);
    });
    test('an undone future item\'s element does not', () => {
        const item = completedTask({ dueDateTime: new Date(Date.now() + 5 * HOUR), isOverdue: false, lastDamageTickTime: null });
        Items.uncompleteItem(1, makeDeps([item]));
        expect(item.element.classList.contains('enemy-at-base')).toBe(false);
    });
});

describe('uncompleteItemWithDuePrompt', () => {
    test('a future new time: returns not overdue with that due time', () => {
        const item = completedTask();
        const next = new Date(Date.now() + 2 * HOUR);
        const deps = makeDeps([item], { promptNewDueTime: (it, cb) => cb({ dueDateTime: next }) });
        Items.uncompleteItemWithDuePrompt(1, deps);
        expect(item.dueDateTime).toBe(next);
        expect(item.isOverdue).toBe(false);
        expect(item.lastDamageTickTime).toBe(null);
    });

    test('keep original: returns overdue with a clean-slate clock', () => {
        const item = completedTask();
        const orig = item.dueDateTime;
        const deps = makeDeps([item], { promptNewDueTime: (it, cb) => cb({ dueDateTime: null }) });
        Items.uncompleteItemWithDuePrompt(1, deps);
        expect(item.dueDateTime).toBe(orig);
        expect(item.isOverdue).toBe(true);
        expect(Date.now() - item.lastDamageTickTime).toBeLessThan(1000);
    });

    test('cancel: nothing changes, item stays completed, points untouched', () => {
        const item = completedTask();
        const completed = [item];
        const deps = makeDeps(completed, { promptNewDueTime: (it, cb) => cb({ cancel: true }) });
        Items.uncompleteItemWithDuePrompt(1, deps);
        expect(completed).toHaveLength(1);
        expect(item.isOverdue).toBe(true);
        expect(item.lastDamageTickTime).toBe(123);
        expect(deps.getPlayerPoints()).toBe(50);
        expect(deps.renderCompletedItems).toHaveBeenCalled(); // checkbox re-checked
    });

    test('dismissed prompt (callback never fires): item stays completed', () => {
        const item = completedTask();
        const completed = [item];
        const deps = makeDeps(completed, { promptNewDueTime: () => {} });
        Items.uncompleteItemWithDuePrompt(1, deps);
        expect(completed).toHaveLength(1);
    });

    test('a past "new" time is ignored (treated as keep original)', () => {
        const item = completedTask();
        const orig = item.dueDateTime;
        const deps = makeDeps([item], { promptNewDueTime: (it, cb) => cb({ dueDateTime: new Date(Date.now() - HOUR) }) });
        Items.uncompleteItemWithDuePrompt(1, deps);
        expect(item.dueDateTime).toBe(orig);
    });

    test('not past due: no prompt, plain undo', () => {
        const item = completedTask({ dueDateTime: new Date(Date.now() + 5 * HOUR), isOverdue: false, lastDamageTickTime: null });
        const prompt = jest.fn();
        const completed = [item];
        const deps = makeDeps(completed, { promptNewDueTime: prompt });
        Items.uncompleteItemWithDuePrompt(1, deps);
        expect(prompt).not.toHaveBeenCalled();
        expect(completed).toHaveLength(0);
    });

    test('habits never prompt', () => {
        const habit = completedTask({ id: 2, type: 'habit', definitionId: 'h', name: 'H' });
        const prompt = jest.fn();
        const deps = makeDeps([habit], { promptNewDueTime: prompt });
        Items.uncompleteItemWithDuePrompt(2, deps);
        expect(prompt).not.toHaveBeenCalled();
    });

    test('without a prompt dep it is exactly uncompleteItem', () => {
        const item = completedTask();
        const completed = [item];
        Items.uncompleteItemWithDuePrompt(1, makeDeps(completed));
        expect(completed).toHaveLength(0);
    });
});

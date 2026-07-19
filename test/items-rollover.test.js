/**
 * Items.settleStaleRecurringInstance — closes out ONE prior-day recurring
 * instance at day rollover (day-advance mechanism, 2026-07-19). Same
 * global-binding approach as items-lurker/items-indulge tests.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.CONFIG = require('../js/config.js');
const Items = require('../js/items.js');

function fakeEl() {
    return { style: {}, remove: () => {} };
}

function yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(12, 0, 0, 0);
    return d;
}

function makeDeps(overrides = {}) {
    let xp = 0, points = 0, leveled = 0;
    const activeItems = overrides.activeItems || [];
    const definedHabits = overrides.definedHabits || [];
    const { activeItems: _a, definedHabits: _d, ...rest } = overrides;
    return {
        isGameOver: () => false,
        activeItems,
        definedHabits: () => definedHabits,
        xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
        pointsPerHabit: CONFIG.POINTS_PER_HABIT,
        getPlayerXP: () => xp,
        setPlayerXP: (n) => { xp = n; },
        getPlayerPoints: () => points,
        setPlayerPoints: (n) => { points = n; },
        updatePlayerDisplays: () => {},
        checkPlayerLevelUp: () => { leveled++; },
        updateTaskCountDisplay: () => {},
        saveGame: () => {},
        ...rest,
        getXP: () => xp,
        getPoints: () => points,
        getLeveled: () => leveled,
    };
}

describe('Items.settleStaleRecurringInstance', () => {
    test('negative-habit lurker → auto-avoided: awards points, records a success occurrence, removes it', () => {
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: true,
            originalDueDate: yesterday(), element: fakeEl() };
        const habitDef = { id: 'd1', isNegative: true, streak: 2, occurrenceHistory: [] };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });

        Items.settleStaleRecurringInstance(item, deps);

        expect(deps.getPoints()).toBeGreaterThan(0);      // avoided earns points
        expect(habitDef.occurrenceHistory.length).toBe(1); // a success occurrence recorded
        expect(deps.activeItems.length).toBe(0);           // removed from the board
    });

    test('auto-avoid keys lastCompletionDate to the instance day (yesterday), NOT today — so today can still spawn', () => {
        const y = yesterday();
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: true,
            originalDueDate: y, element: fakeEl() };
        const habitDef = { id: 'd1', isNegative: true, streak: 0, occurrenceHistory: [] };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });

        Items.settleStaleRecurringInstance(item, deps);

        const todayStr = new Date().toDateString();
        expect(new Date(habitDef.lastCompletionDate).toDateString()).not.toBe(todayStr);
        expect(new Date(habitDef.lastCompletionDate).toDateString()).toBe(y.toDateString());
    });

    test('positive habit → just removed, no points awarded (its miss was recorded earlier on re-add)', () => {
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: false,
            originalDueDate: yesterday(), element: fakeEl() };
        const habitDef = { id: 'd1', isNegative: false, streak: 0, occurrenceHistory: [] };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });

        Items.settleStaleRecurringInstance(item, deps);

        expect(deps.getPoints()).toBe(0);
        expect(deps.getXP()).toBe(0);
        expect(deps.activeItems.length).toBe(0);
        expect(habitDef.occurrenceHistory.length).toBe(0); // settlement itself records nothing for a positive
    });

    test('routine task → just removed, no habit math', () => {
        const item = { id: 1, type: 'task', definitionId: 'td1',
            originalDueDate: yesterday(), element: fakeEl() };
        const deps = makeDeps({ activeItems: [item], definedHabits: [] });

        Items.settleStaleRecurringInstance(item, deps);

        expect(deps.getPoints()).toBe(0);
        expect(deps.activeItems.length).toBe(0);
    });
});

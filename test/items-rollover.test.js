/**
 * Items.settleStaleRecurringInstance — closes out ONE prior-day recurring
 * instance at day rollover (day-advance mechanism, 2026-07-19). Same
 * global-binding approach as items-lurker/items-indulge tests.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
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
    test('unanswered Break (negative) habit → NEUTRAL: no points/xp, no occurrence, streak untouched, removed (2026-10-31)', () => {
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: true,
            originalDueDate: yesterday(), element: fakeEl() };
        const habitDef = { id: 'd1', isNegative: true, streak: 2, occurrenceHistory: [], lastCompletionDate: null };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });

        Items.settleStaleRecurringInstance(item, deps);

        expect(deps.getPoints()).toBe(0);
        expect(deps.getXP()).toBe(0);
        expect(habitDef.occurrenceHistory).toEqual([]);
        expect(habitDef.streak).toBe(2);
        expect(habitDef.lastCompletionDate).toBeNull();
        expect(deps.activeItems.length).toBe(0);
    });

    test('unanswered Break habit puts nothing in the daily record (no Boxing gym clean day)', () => {
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: true,
            originalDueDate: yesterday(), element: fakeEl() };
        const habitDef = { id: 'd1', isNegative: true, streak: 0, occurrenceHistory: [] };
        const daily = [];
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef], recordDaily: (...a) => daily.push(a) });

        Items.settleStaleRecurringInstance(item, deps);

        expect(daily).toEqual([]);
    });

    test('positive habit → removed, no points; its miss was recorded earlier on re-add, so no second entry', () => {
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: false,
            originalDueDate: yesterday(), element: fakeEl() };
        const day = Habits.toOccurrenceDate(item.originalDueDate);
        const habitDef = { id: 'd1', isNegative: false, streak: 0, occurrenceHistory: [{ date: day, success: false }] };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });

        Items.settleStaleRecurringInstance(item, deps);

        expect(deps.getPoints()).toBe(0);
        expect(deps.getXP()).toBe(0);
        expect(deps.activeItems.length).toBe(0);
        expect(habitDef.occurrenceHistory).toEqual([{ date: day, success: false }]);
    });

    test('positive habit with NO entry for its day → safety-net miss, streak reset, no points (2026-10-31)', () => {
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: false,
            originalDueDate: yesterday(), element: fakeEl() };
        const day = Habits.toOccurrenceDate(item.originalDueDate);
        const habitDef = { id: 'd1', isNegative: false, streak: 4, occurrenceHistory: [] };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });

        Items.settleStaleRecurringInstance(item, deps);

        expect(habitDef.occurrenceHistory).toEqual([{ date: day, success: false }]);
        expect(habitDef.streak).toBe(0);
        expect(deps.getPoints()).toBe(0);
        expect(deps.getXP()).toBe(0);
        expect(deps.activeItems.length).toBe(0);
    });

    test('KO ghost positive habit → removed, nothing recorded', () => {
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: false, koGhost: true,
            originalDueDate: yesterday(), element: fakeEl() };
        const habitDef = { id: 'd1', isNegative: false, streak: 2, occurrenceHistory: [] };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });

        Items.settleStaleRecurringInstance(item, deps);

        expect(habitDef.occurrenceHistory).toEqual([]);
        expect(habitDef.streak).toBe(2);
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

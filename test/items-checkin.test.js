/**
 * Items.markPendingCheckIn / Items.resolvePendingCheckIn — sub-session 4
 * ([P1-DATA-005], check-in prompt, 2026-07-19). Same global-binding approach
 * as items-rollover/items-indulge tests.
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
    let xp = 0, points = 0, leveled = 0, saved = 0;
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
        saveGame: () => { saved++; },
        ...rest,
        getXP: () => xp,
        getPoints: () => points,
        getLeveled: () => leveled,
        getSaved: () => saved,
    };
}

describe('Items.markPendingCheckIn', () => {
    test('records a pendingCheckIn marker on the habit def and removes the lurker, with no points/xp change', () => {
        const y = yesterday();
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: true,
            originalDueDate: y, element: fakeEl() };
        const habitDef = { id: 'd1', isNegative: true, streak: 2, occurrenceHistory: [] };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });

        Items.markPendingCheckIn(item, deps);

        expect(habitDef.pendingCheckIn).toEqual({ originalDueDate: y });
        expect(deps.activeItems.length).toBe(0);
        expect(deps.getPoints()).toBe(0);
        expect(deps.getXP()).toBe(0);
        expect(habitDef.streak).toBe(2); // untouched until resolved
    });

    test('no-ops safely (still removes) if the habitDef somehow cannot be found', () => {
        const item = { id: 1, type: 'habit', definitionId: 'missing', isNegative: true,
            originalDueDate: yesterday(), element: fakeEl() };
        const deps = makeDeps({ activeItems: [item], definedHabits: [] });

        expect(() => Items.markPendingCheckIn(item, deps)).not.toThrow();
        expect(deps.activeItems.length).toBe(0);
    });
});

describe('Items.resolvePendingCheckIn', () => {
    test("'avoided' outcome: awards points, records a success occurrence, bumps streak, clears the marker", () => {
        const y = yesterday();
        const habitDef = { id: 'd1', isNegative: true, streak: 2, occurrenceHistory: [],
            pendingCheckIn: { originalDueDate: y } };
        const deps = makeDeps({ definedHabits: [habitDef] });

        Items.resolvePendingCheckIn('d1', 'avoided', deps);

        expect(deps.getPoints()).toBeGreaterThan(0);
        expect(deps.getXP()).toBeGreaterThan(0);
        expect(habitDef.streak).toBe(3);
        expect(habitDef.occurrenceHistory.length).toBe(1);
        expect(habitDef.occurrenceHistory[0].success).toBe(true);
        expect(habitDef.pendingCheckIn).toBeUndefined();
        expect(deps.getSaved()).toBe(1);
    });

    test("'indulged' outcome: debits points (non-clamping), zeroes streak, records a miss occurrence, clears the marker", () => {
        const y = yesterday();
        const habitDef = { id: 'd1', isNegative: true, streak: 3, occurrenceHistory: [],
            pendingCheckIn: { originalDueDate: y } };
        const deps = makeDeps({ definedHabits: [habitDef] });
        deps.setPlayerPoints(5);

        Items.resolvePendingCheckIn('d1', 'indulged', deps);

        expect(deps.getPoints()).toBeLessThan(5); // debited, can cross below 0
        expect(habitDef.streak).toBe(0);
        expect(habitDef.occurrenceHistory.length).toBe(1);
        expect(habitDef.occurrenceHistory[0].success).toBe(false);
        expect(habitDef.pendingCheckIn).toBeUndefined();
    });

    test('no-op if the habit has no pendingCheckIn (e.g. a stale double-click)', () => {
        const habitDef = { id: 'd1', isNegative: true, streak: 3, occurrenceHistory: [] };
        const deps = makeDeps({ definedHabits: [habitDef] });

        Items.resolvePendingCheckIn('d1', 'avoided', deps);

        expect(deps.getPoints()).toBe(0);
        expect(habitDef.streak).toBe(3);
        expect(deps.getSaved()).toBe(0);
    });

    test('no-op if the habitDef cannot be found', () => {
        const deps = makeDeps({ definedHabits: [] });
        expect(() => Items.resolvePendingCheckIn('missing', 'avoided', deps)).not.toThrow();
        expect(deps.getSaved()).toBe(0);
    });
});

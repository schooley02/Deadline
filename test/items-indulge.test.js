/**
 * Items.indulgeHabit — the "I indulged" player action for a negative-habit
 * lurker (sub-session 2b, [P1-DATA-005], 2026-07-19).
 *
 * Same global-binding approach as items-lurker.test.js: js/items.js
 * references CONFIG, Habits, and Economy as bare globals (loaded via
 * <script> tags in the browser), so Node binds them from the real modules
 * before requiring items.js.
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

function makeNegativeHabitInstance(overrides = {}) {
    return {
        id: 1,
        type: 'habit',
        definitionId: 'def1',
        isNegative: true,
        originalDueDate: new Date('2026-07-19T12:00:00'),
        element: fakeEl(),
        ...overrides,
    };
}

function makeDeps(overrides = {}) {
    let points = 100;
    const activeItems = overrides.activeItems || [];
    const definedHabits = overrides.definedHabits || [];
    const { activeItems: _a, definedHabits: _d, ...rest } = overrides;
    return {
        isGameOver: () => false,
        activeItems,
        definedHabits: () => definedHabits,
        pointsPerHabit: CONFIG.POINTS_PER_HABIT,
        getPlayerPoints: () => points,
        setPlayerPoints: (n) => { points = n; },
        updatePlayerDisplays: () => {},
        updateTaskCountDisplay: () => {},
        saveGame: () => {},
        ...rest,
        getPoints: () => points, // test-only escape hatch
    };
}

describe('Items.indulgeHabit', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });


    test('debits points, zeroes streak, and does not throw for a valid negative-habit lurker', () => {
        const item = makeNegativeHabitInstance();
        const habitDef = { id: 'def1', isNegative: true, streak: 5, occurrenceHistory: [] };
        const deps = makeDeps({
            activeItems: [item],
            definedHabits: [habitDef],
        });

        Items.indulgeHabit(1, deps);

        expect(habitDef.streak).toBe(0);
        expect(deps.getPoints()).toBeLessThan(100);
    });

    test('debits via the NON-clamping path — a balance that cannot cover the cost goes negative (sub-session 3)', () => {
        const item = makeNegativeHabitInstance();
        const habitDef = { id: 'def1', isNegative: true, streak: 3, occurrenceHistory: [] };
        // Start near zero so even a 1x-multiplier debit (pointsPerHabit) pushes it negative.
        const deps = makeDeps({
            activeItems: [item],
            definedHabits: [habitDef],
            getPlayerPoints: () => 1,
        });

        Items.indulgeHabit(1, deps);

        expect(deps.getPoints()).toBeLessThan(0);
    });

    test('is a no-op when the game is over', () => {
        const item = makeNegativeHabitInstance();
        const habitDef = { id: 'def1', isNegative: true, streak: 5, occurrenceHistory: [] };
        const deps = makeDeps({
            isGameOver: () => true,
            activeItems: [item],
            definedHabits: [habitDef],
        });

        Items.indulgeHabit(1, deps);

        expect(habitDef.streak).toBe(5);
        expect(deps.getPoints()).toBe(100);
    });

    test('is a no-op for an unknown item id', () => {
        const habitDef = { id: 'def1', isNegative: true, streak: 5, occurrenceHistory: [] };
        const deps = makeDeps({
            activeItems: [],
            definedHabits: [habitDef],
        });

        Items.indulgeHabit(999, deps);

        expect(habitDef.streak).toBe(5);
        expect(deps.getPoints()).toBe(100);
    });

    test('is a no-op for a task (not a habit)', () => {
        const item = { id: 1, type: 'task' };
        const deps = makeDeps({ activeItems: [item] });

        Items.indulgeHabit(1, deps);

        expect(deps.getPoints()).toBe(100);
    });

    test('is a no-op for a POSITIVE habit instance (misrouted call, matches applyHabitIndulgence guard)', () => {
        const item = makeNegativeHabitInstance({ isNegative: false });
        const habitDef = { id: 'def1', isNegative: false, streak: 5, occurrenceHistory: [] };
        const deps = makeDeps({
            activeItems: [item],
            definedHabits: [habitDef],
        });

        Items.indulgeHabit(1, deps);

        expect(habitDef.streak).toBe(5);
        expect(deps.getPoints()).toBe(100);
    });

    test('is a no-op when no matching habit definition exists', () => {
        const item = makeNegativeHabitInstance({ definitionId: 'ghost' });
        const deps = makeDeps({
            activeItems: [item],
            definedHabits: [],
        });

        Items.indulgeHabit(1, deps);

        expect(deps.getPoints()).toBe(100);
    });
});

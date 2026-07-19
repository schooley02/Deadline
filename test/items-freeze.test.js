/**
 * Frozen routine slots wiring ("Frozen routine slots + recovery" ticket,
 * sub-session 1, 2026-07-19) — the freeze trigger (Items.indulgeHabit /
 * Items.resolvePendingCheckIn's indulged branch) and recovery path 2
 * (Items.completeItem / Items.settleStaleRecurringInstance /
 * Items.resolvePendingCheckIn's avoided branch), all routed through
 * js/frozenSlots.js. Same global-binding approach as the other items-*.test.js
 * files: js/items.js references CONFIG, Habits, Economy, and FrozenSlots as
 * bare globals (loaded via <script> tags in the browser), so Node binds them
 * from the real modules before requiring items.js.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
const Items = require('../js/items.js');

function fakeEl() {
    return { style: {}, remove: () => {} };
}

function negativeHabitDef(overrides = {}) {
    return {
        id: 'def1',
        isNegative: true,
        routineId: 'r1',
        streak: 0,
        occurrenceHistory: [],
        ...overrides,
    };
}

function frozenRoutine(overrides = {}) {
    return { id: 'r1', frozenState: null, ...overrides };
}

function yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(12, 0, 0, 0);
    return d;
}

function makeDeps(overrides = {}) {
    let xp = 0, points = 100;
    const activeItems = overrides.activeItems || [];
    const definedHabits = overrides.definedHabits || [];
    const definedRoutines = overrides.definedRoutines || [];
    const completedItems = overrides.completedItems || [];
    const {
        activeItems: _a, definedHabits: _d, definedRoutines: _r, completedItems: _c, ...rest
    } = overrides;
    return {
        isGameOver: () => false,
        activeItems,
        definedHabits: () => definedHabits,
        definedRoutines: () => definedRoutines,
        completedItems: () => completedItems,
        xpPerTaskDefeat: CONFIG.XP_PER_TASK_DEFEAT,
        xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
        pointsPerTask: CONFIG.POINTS_PER_TASK,
        pointsPerHabit: CONFIG.POINTS_PER_HABIT,
        habitStreakBonusThreshold: CONFIG.HABIT_STREAK_BONUS_THRESHOLD,
        getPlayerXP: () => xp,
        setPlayerXP: (n) => { xp = n; },
        getPlayerPoints: () => points,
        setPlayerPoints: (n) => { points = n; },
        updatePlayerDisplays: () => {},
        checkPlayerLevelUp: () => {},
        createListItem: () => {},
        sortAndRenderActiveList: () => {},
        renderCompletedItems: () => {},
        updateTaskCountDisplay: () => {},
        saveGame: () => {},
        ...rest,
        getPoints: () => points,
    };
}

describe('freeze trigger via Items.indulgeHabit', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('3 consecutive indulges freeze the owning routine', () => {
        const habitDef = negativeHabitDef();
        const routine = frozenRoutine();
        const deps = makeDeps({ definedHabits: [habitDef], definedRoutines: [routine] });

        // Three separate lurker instances (one per day), each indulged.
        [1, 2, 3].forEach((id) => {
            const item = { id, type: 'habit', definitionId: 'def1', isNegative: true,
                originalDueDate: new Date(`2026-07-1${6 + id}T12:00:00`), element: fakeEl() };
            deps.activeItems.push(item);
            Items.indulgeHabit(id, deps);
        });

        expect(routine.frozenState).not.toBeNull();
        expect(routine.frozenState.frozenBy).toBe('def1');
    });

    test('2 consecutive indulges do NOT freeze', () => {
        const habitDef = negativeHabitDef();
        const routine = frozenRoutine();
        const deps = makeDeps({ definedHabits: [habitDef], definedRoutines: [routine] });

        [1, 2].forEach((id) => {
            const item = { id, type: 'habit', definitionId: 'def1', isNegative: true,
                originalDueDate: new Date(`2026-07-1${6 + id}T12:00:00`), element: fakeEl() };
            deps.activeItems.push(item);
            Items.indulgeHabit(id, deps);
        });

        expect(routine.frozenState).toBeNull();
    });

    test('a STANDALONE negative habit (no routine) never freezes anything', () => {
        const habitDef = negativeHabitDef({ routineId: null });
        const deps = makeDeps({ definedHabits: [habitDef], definedRoutines: [] });

        [1, 2, 3].forEach((id) => {
            const item = { id, type: 'habit', definitionId: 'def1', isNegative: true,
                originalDueDate: new Date(`2026-07-1${6 + id}T12:00:00`), element: fakeEl() };
            deps.activeItems.push(item);
            Items.indulgeHabit(id, deps);
        });

        // No routine exists to check — just proving no throw / no side effect.
        expect(deps.getPoints()).toBeLessThan(100);
    });

    test('freezing does not reset frozenAt if already frozen by the same habit', () => {
        const habitDef = negativeHabitDef();
        const routine = frozenRoutine({ frozenState: { frozenBy: 'def1', frozenAt: 'ORIGINAL' } });
        const deps = makeDeps({ definedHabits: [habitDef], definedRoutines: [routine] });

        const item = { id: 1, type: 'habit', definitionId: 'def1', isNegative: true,
            originalDueDate: new Date('2026-07-19T12:00:00'), element: fakeEl() };
        deps.activeItems.push(item);
        Items.indulgeHabit(1, deps);

        expect(routine.frozenState.frozenAt).toBe('ORIGINAL');
    });
});

describe('freeze trigger via Items.resolvePendingCheckIn (indulged outcome)', () => {
    test('3 consecutive indulged check-ins freeze the owning routine', () => {
        const habitDef = negativeHabitDef({
            occurrenceHistory: [
                { date: 'd0', success: false },
                { date: 'd1', success: false },
            ],
            pendingCheckIn: { originalDueDate: new Date('2026-07-19T12:00:00') },
        });
        const routine = frozenRoutine();
        const deps = makeDeps({ definedHabits: [habitDef], definedRoutines: [routine] });

        Items.resolvePendingCheckIn('def1', 'indulged', deps);

        expect(routine.frozenState).not.toBeNull();
        expect(routine.frozenState.frozenBy).toBe('def1');
    });
});

describe('recovery path 2 via Items.completeItem ("Successfully avoided")', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('3 consecutive avoided days clear a freeze caused by this habit', () => {
        const habitDef = negativeHabitDef({
            occurrenceHistory: [
                { date: 'd0', success: true },
                { date: 'd1', success: true },
            ],
        });
        const routine = frozenRoutine({ frozenState: { frozenBy: 'def1', frozenAt: 'X' } });
        const item = { id: 1, type: 'habit', definitionId: 'def1', isNegative: true,
            originalDueDate: new Date('2026-07-19T12:00:00'), element: fakeEl() };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef], definedRoutines: [routine] });

        Items.completeItem(1, deps);

        expect(routine.frozenState).toBeNull();
    });

    test('a freeze caused by a DIFFERENT habit in the same routine is not cleared', () => {
        const habitDef = negativeHabitDef({
            id: 'def1',
            occurrenceHistory: [
                { date: 'd0', success: true },
                { date: 'd1', success: true },
            ],
        });
        const routine = frozenRoutine({ frozenState: { frozenBy: 'def_other', frozenAt: 'X' } });
        const item = { id: 1, type: 'habit', definitionId: 'def1', isNegative: true,
            originalDueDate: new Date('2026-07-19T12:00:00'), element: fakeEl() };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef], definedRoutines: [routine] });

        Items.completeItem(1, deps);

        expect(routine.frozenState).not.toBeNull();
        expect(routine.frozenState.frozenBy).toBe('def_other');
    });

    test('a positive habit never touches frozenState (recovery only applies to negative habits)', () => {
        const habitDef = { id: 'def1', isNegative: false, routineId: 'r1', streak: 0, occurrenceHistory: [] };
        const routine = frozenRoutine({ frozenState: { frozenBy: 'def_other', frozenAt: 'X' } });
        const item = { id: 1, type: 'habit', definitionId: 'def1', isNegative: false,
            originalDueDate: new Date('2026-07-19T12:00:00'), element: fakeEl() };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef], definedRoutines: [routine] });

        Items.completeItem(1, deps);

        expect(routine.frozenState.frozenBy).toBe('def_other'); // untouched
    });
});

describe('recovery path 2 via Items.settleStaleRecurringInstance (auto-avoid)', () => {
    test('3 consecutive auto-avoided days clear a freeze caused by this habit', () => {
        const habitDef = negativeHabitDef({
            occurrenceHistory: [
                { date: 'd0', success: true },
                { date: 'd1', success: true },
            ],
        });
        const routine = frozenRoutine({ frozenState: { frozenBy: 'def1', frozenAt: 'X' } });
        const item = { id: 1, type: 'habit', definitionId: 'def1', isNegative: true,
            originalDueDate: yesterday(), element: fakeEl() };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef], definedRoutines: [routine] });

        Items.settleStaleRecurringInstance(item, deps);

        expect(routine.frozenState).toBeNull();
    });
});

describe('recovery path 2 via Items.resolvePendingCheckIn (avoided outcome)', () => {
    test('3 consecutive avoided check-ins clear a freeze caused by this habit', () => {
        const habitDef = negativeHabitDef({
            occurrenceHistory: [
                { date: 'd0', success: true },
                { date: 'd1', success: true },
            ],
            pendingCheckIn: { originalDueDate: new Date('2026-07-19T12:00:00') },
        });
        const routine = frozenRoutine({ frozenState: { frozenBy: 'def1', frozenAt: 'X' } });
        const deps = makeDeps({ definedHabits: [habitDef], definedRoutines: [routine] });

        Items.resolvePendingCheckIn('def1', 'avoided', deps);

        expect(routine.frozenState).toBeNull();
    });
});

describe('deps.definedRoutines is optional (backward compatibility)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('Items.indulgeHabit does not throw when deps has no definedRoutines collaborator', () => {
        const habitDef = negativeHabitDef();
        const item = { id: 1, type: 'habit', definitionId: 'def1', isNegative: true,
            originalDueDate: new Date('2026-07-19T12:00:00'), element: fakeEl() };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });
        delete deps.definedRoutines;

        expect(() => Items.indulgeHabit(1, deps)).not.toThrow();
    });
});

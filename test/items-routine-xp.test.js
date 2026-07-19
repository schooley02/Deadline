/**
 * Hero/routine XP wiring tests ([P1-UI-006] sub-session 1, 2026-07-19
 * session 41) — the items.js award/refund/gating layer over js/heroes.js's
 * pure math (which has its own suite in test/heroes.test.js).
 *
 * Key invariant under test: refunds mirror awards EXACTLY via the
 * `item.routineXpAwarded` stamp, even if the routine's frozen/active state
 * changed in between — the same asymmetry class as the old streak-bonus
 * refund bug (DECISIONS.md 2026-07-18), prevented by construction here.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
const Items = require('../js/items.js');

function fakeEl() {
    return {
        style: {},
        dataset: {},
        classList: { add: () => {}, remove: () => {} },
        addEventListener: () => {},
        appendChild: () => {},
        remove: () => {},
    };
}

// uncompleteItem rebuilds the enemy sprite via document.createElement — stub
// the minimum DOM surface (testEnvironment is node).
beforeAll(() => {
    global.document = { createElement: () => fakeEl() };
});
afterAll(() => {
    delete global.document;
});

function activeRoutine(overrides = {}) {
    return {
        id: 'r1', name: 'Routine', isActive: true, frozenState: null,
        habitDefinitionIds: [], taskDefinitionIds: [],
        xp: 0, level: 1, health: 100, createdAt: Date.now(), koState: null,
        ...overrides,
    };
}

function tomorrowNoon() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return d;
}

function routineTaskItem(overrides = {}) {
    return {
        id: 1, type: 'task', definitionId: 'td1', name: 'Routine Task',
        category: 'other', isHighPriority: false, dueDateTime: tomorrowNoon(),
        isOverdue: false, lastDamageTickTime: null, parentId: null,
        subTasks: [], completedSubTasks: 0, totalSubTasks: 0,
        element: fakeEl(), listItemElement: null,
        ...overrides,
    };
}

function habitItem(overrides = {}) {
    return {
        id: 2, type: 'habit', definitionId: 'h1', name: 'Habit',
        category: 'health', isNegative: false, dueDateTime: tomorrowNoon(),
        originalDueDate: new Date(), isOverdue: false, lastDamageTickTime: null,
        parentId: null, streak: 0, element: fakeEl(), listItemElement: null,
        ...overrides,
    };
}

function positiveHabitDef(overrides = {}) {
    return {
        id: 'h1', name: 'Habit', isNegative: false, routineId: 'r1', streak: 0,
        lastCompletionDate: null, occurrenceHistory: [],
        ...overrides,
    };
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
        resetAllSubTaskCheckboxes: () => {},
        saveGame: () => {},
        // uncompleteItem's sprite-rebuild collaborators:
        baseWidth: 120,
        enemyWidth: CONFIG.ENEMY_WIDTH,
        habitEnemyWidth: CONFIG.HABIT_ENEMY_WIDTH,
        gameCanvas: fakeEl(),
        calculateTimelineXWithClustering: () => 0,
        getSubTaskClusterOffset: () => 0,
        getItemTopPosition: () => 0,
        handleEnemyClick: () => {},
        ...rest,
    };
}

describe('completeItem awards routine XP to the owning routine', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('a routine-owned TASK pays ROUTINE_XP_PER_TASK and stamps the item', () => {
        const routine = activeRoutine({ taskDefinitionIds: ['td1'] });
        const item = routineTaskItem();
        const deps = makeDeps({ activeItems: [item], definedRoutines: [routine] });

        Items.completeItem(1, deps);

        expect(routine.xp).toBe(CONFIG.ROUTINE_XP_PER_TASK);
        expect(item.routineXpAwarded).toBe(CONFIG.ROUTINE_XP_PER_TASK);
    });

    test('a routine-owned HABIT pays ROUTINE_XP_PER_HABIT', () => {
        const routine = activeRoutine({ habitDefinitionIds: ['h1'] });
        const habitDef = positiveHabitDef();
        const item = habitItem();
        const deps = makeDeps({
            activeItems: [item], definedHabits: [habitDef], definedRoutines: [routine],
        });

        Items.completeItem(2, deps);

        expect(routine.xp).toBe(CONFIG.ROUTINE_XP_PER_HABIT);
        expect(item.routineXpAwarded).toBe(CONFIG.ROUTINE_XP_PER_HABIT);
    });

    test('a STANDALONE task (no definitionId) awards nothing and stamps nothing', () => {
        const routine = activeRoutine();
        const item = routineTaskItem({ definitionId: undefined });
        const deps = makeDeps({ activeItems: [item], definedRoutines: [routine] });

        Items.completeItem(1, deps);

        expect(routine.xp).toBe(0);
        expect(item.routineXpAwarded).toBeUndefined();
    });

    test('a STANDALONE habit (routineId null) awards nothing', () => {
        const routine = activeRoutine();
        const habitDef = positiveHabitDef({ routineId: null });
        const item = habitItem();
        const deps = makeDeps({
            activeItems: [item], definedHabits: [habitDef], definedRoutines: [routine],
        });

        Items.completeItem(2, deps);

        expect(routine.xp).toBe(0);
        expect(item.routineXpAwarded).toBeUndefined();
    });

    test('a FROZEN routine earns nothing (the "no XP while frozen" rule, finally real)', () => {
        const routine = activeRoutine({
            taskDefinitionIds: ['td1'],
            frozenState: { frozenBy: 'someHabit', frozenAt: new Date() },
        });
        const item = routineTaskItem();
        const deps = makeDeps({ activeItems: [item], definedRoutines: [routine] });

        Items.completeItem(1, deps);

        expect(routine.xp).toBe(0);
        expect(item.routineXpAwarded).toBeUndefined();
    });

    test('an INACTIVE routine earns nothing', () => {
        const routine = activeRoutine({ taskDefinitionIds: ['td1'], isActive: false });
        const item = routineTaskItem();
        const deps = makeDeps({ activeItems: [item], definedRoutines: [routine] });

        Items.completeItem(1, deps);

        expect(routine.xp).toBe(0);
    });

    test('an award crossing a threshold levels the routine (derived level)', () => {
        const startXp = CONFIG.ROUTINE_LEVEL_XP_THRESHOLDS[1] - 5;
        const routine = activeRoutine({ taskDefinitionIds: ['td1'], xp: startXp });
        const item = routineTaskItem();
        const deps = makeDeps({ activeItems: [item], definedRoutines: [routine] });

        Items.completeItem(1, deps);

        expect(routine.level).toBe(2);
    });
});

describe('uncompleteItem refunds routine XP off the stamp', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    function completeThenUncomplete(routine, mutateBetween) {
        const item = routineTaskItem();
        const deps = makeDeps({ activeItems: [item], definedRoutines: [routine] });
        Items.completeItem(1, deps);
        jest.runOnlyPendingTimers(); // flush the 500ms removeItem
        if (mutateBetween) mutateBetween();
        Items.uncompleteItem(1, deps);
        return item;
    }

    test('complete → uncomplete round-trips routine xp and level exactly', () => {
        const startXp = CONFIG.ROUTINE_LEVEL_XP_THRESHOLDS[1] - 5;
        const routine = activeRoutine({ taskDefinitionIds: ['td1'], xp: startXp });

        const item = completeThenUncomplete(routine);

        expect(routine.xp).toBe(startXp);
        expect(routine.level).toBe(1);
        expect(item.routineXpAwarded).toBeUndefined();
    });

    test('the refund still lands if the routine FROZE between complete and uncomplete (stamp beats re-checking conditions)', () => {
        const routine = activeRoutine({ taskDefinitionIds: ['td1'] });

        completeThenUncomplete(routine, () => {
            routine.frozenState = { frozenBy: 'someHabit', frozenAt: new Date() };
        });

        expect(routine.xp).toBe(0);
    });

    test('no stamp (completed while frozen) → no refund deducted', () => {
        const routine = activeRoutine({
            taskDefinitionIds: ['td1'],
            frozenState: { frozenBy: 'someHabit', frozenAt: new Date() },
            xp: 40,
        });

        completeThenUncomplete(routine);

        expect(routine.xp).toBe(40); // untouched in both directions
    });
});

describe('habit-def-only completion sites award routine XP (no stamp — nothing to undo)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    function yesterdayNoon() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        d.setHours(12, 0, 0, 0);
        return d;
    }

    test("resolvePendingCheckIn 'avoided' awards the owning routine", () => {
        const routine = activeRoutine({ habitDefinitionIds: ['h1'] });
        const habitDef = positiveHabitDef({
            isNegative: true,
            pendingCheckIn: { originalDueDate: yesterdayNoon() },
        });
        const deps = makeDeps({ definedHabits: [habitDef], definedRoutines: [routine] });

        Items.resolvePendingCheckIn('h1', 'avoided', deps);

        expect(routine.xp).toBe(CONFIG.ROUTINE_XP_PER_HABIT);
    });

    test('settleStaleRecurringInstance (auto-avoid) awards the owning routine', () => {
        const routine = activeRoutine({ habitDefinitionIds: ['h1'] });
        const habitDef = positiveHabitDef({ isNegative: true });
        const item = habitItem({ isNegative: true, originalDueDate: yesterdayNoon() });
        const deps = makeDeps({
            activeItems: [item], definedHabits: [habitDef], definedRoutines: [routine],
        });

        Items.settleStaleRecurringInstance(item, deps);

        expect(routine.xp).toBe(CONFIG.ROUTINE_XP_PER_HABIT);
    });

    test("a frozen routine's avoided check-in earns nothing UNLESS it just recovered on this very avoid (recovery-first ordering)", () => {
        // 2 avoided days already recorded; this third avoid completes recovery
        // path 2, clears frozenState via maybeRecoverRoutine, and THEN the XP
        // award runs — so the unfreezing completion itself earns.
        const routine = activeRoutine({
            habitDefinitionIds: ['h1'],
            frozenState: { frozenBy: 'h1', frozenAt: new Date() },
        });
        const twoDaysAgo = new Date(); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const habitDef = positiveHabitDef({
            isNegative: true,
            occurrenceHistory: [
                { date: Habits.toOccurrenceDate(threeDaysAgo), success: true },
                { date: Habits.toOccurrenceDate(twoDaysAgo), success: true },
            ],
            pendingCheckIn: { originalDueDate: yesterdayNoon() },
        });
        const deps = makeDeps({ definedHabits: [habitDef], definedRoutines: [routine] });

        Items.resolvePendingCheckIn('h1', 'avoided', deps);

        expect(routine.frozenState).toBeNull();
        expect(routine.xp).toBe(CONFIG.ROUTINE_XP_PER_HABIT);
    });
});

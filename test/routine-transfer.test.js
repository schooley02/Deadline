/**
 * Routine transfer tests ([P2-UI-013], 2026-07-19 session 62).
 *
 * Covers the pure core in js/routines.js (transferHabitBetweenRoutines,
 * transferTaskBetweenRoutines, selectActiveInstanceIdsForDefinition) plus
 * the refund-attribution stamp in js/items.js (`item.routineXpRoutineId`):
 * uncompleting AFTER a transfer must refund the routine that EARNED the XP,
 * not the definition's new owner — the same stamp-beats-re-resolution
 * philosophy as `routineXpAwarded` (see items-routine-xp.test.js).
 *
 * The script.js wrappers (recall-if-dest-unusable + immediate spawn) are
 * DOM-orchestration and live-playtest-verified per ARCHITECTURE.md's
 * convention, but their selection half (selectActiveInstanceIdsForDefinition)
 * is pure and tested here.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.DayRollover = require('../js/dayRollover.js');
const Routines = require('../js/routines.js');
const Items = require('../js/items.js');

function routine(id, overrides = {}) {
    return {
        id, name: `Routine ${id}`, habitDefinitionIds: [], taskDefinitionIds: [],
        isActive: true, frozenState: null, koState: null,
        xp: 0, level: 1, health: 100, createdAt: Date.now(),
        ...overrides,
    };
}

function habitDef(id, overrides = {}) {
    return {
        id, name: `Habit ${id}`, category: 'other', timeOfDay: 'morning',
        isNegative: false, routineId: null, streak: 3, lastCompletionDate: null,
        occurrenceHistory: [], modificationHistory: [],
        ...overrides,
    };
}

// --- transferHabitBetweenRoutines ------------------------------------------

describe('transferHabitBetweenRoutines', () => {
    test('moves membership, reassigns ownership, keeps streak, logs modificationHistory', () => {
        const source = routine('rA', { habitDefinitionIds: ['h1', 'h2'] });
        const dest = routine('rB');
        const habit = habitDef('h1', { routineId: 'rA', streak: 7 });
        const routines = [source, dest];
        const habits = [habit, habitDef('h2', { routineId: 'rA' })];

        const result = Routines.transferHabitBetweenRoutines('rA', 'rB', 'h1', routines, habits);

        expect(result).toEqual({ ok: true });
        expect(source.habitDefinitionIds).toEqual(['h2']);
        expect(dest.habitDefinitionIds).toEqual(['h1']);
        expect(habit.routineId).toBe('rB');
        expect(habit.streak).toBe(7); // untouched — transfer is not a reset
        expect(habit.modificationHistory).toHaveLength(1);
        expect(habit.modificationHistory[0].changedFields).toEqual(['routineId']);
        expect(habit.modificationHistory[0].timestamp).toEqual(expect.any(String));
    });

    test('seeds modificationHistory when absent (pre-schemaVersion-6 shape)', () => {
        const source = routine('rA', { habitDefinitionIds: ['h1'] });
        const dest = routine('rB');
        const habit = habitDef('h1', { routineId: 'rA' });
        delete habit.modificationHistory;

        const result = Routines.transferHabitBetweenRoutines('rA', 'rB', 'h1', [source, dest], [habit]);

        expect(result.ok).toBe(true);
        expect(habit.modificationHistory).toHaveLength(1);
    });

    test('blocks the frozen-offender habit (no mutation)', () => {
        const source = routine('rA', {
            habitDefinitionIds: ['h1'],
            frozenState: { frozenBy: 'h1', frozenAt: new Date().toISOString() },
        });
        const dest = routine('rB');
        const habit = habitDef('h1', { routineId: 'rA', isNegative: true });

        const result = Routines.transferHabitBetweenRoutines('rA', 'rB', 'h1', [source, dest], [habit]);

        expect(result).toEqual({ ok: false, reason: 'frozen-offender' });
        expect(source.habitDefinitionIds).toEqual(['h1']);
        expect(dest.habitDefinitionIds).toEqual([]);
        expect(habit.routineId).toBe('rA');
        expect(habit.modificationHistory).toHaveLength(0);
    });

    test('a NON-offender habit transfers freely out of a frozen routine, without clearing the freeze', () => {
        const source = routine('rA', {
            habitDefinitionIds: ['bad', 'h1'],
            frozenState: { frozenBy: 'bad', frozenAt: new Date().toISOString() },
        });
        const dest = routine('rB');
        const habit = habitDef('h1', { routineId: 'rA' });
        const offender = habitDef('bad', { routineId: 'rA', isNegative: true });

        const result = Routines.transferHabitBetweenRoutines('rA', 'rB', 'h1', [source, dest], [habit, offender]);

        expect(result.ok).toBe(true);
        // Transfer is NOT recovery path 1 — the freeze stays until a real
        // edit of the offender or 3 avoided days.
        expect(source.frozenState).toEqual({ frozenBy: 'bad', frozenAt: expect.any(String) });
    });

    test('same-routine is rejected', () => {
        const source = routine('rA', { habitDefinitionIds: ['h1'] });
        const habit = habitDef('h1', { routineId: 'rA' });

        const result = Routines.transferHabitBetweenRoutines('rA', 'rA', 'h1', [source], [habit]);

        expect(result).toEqual({ ok: false, reason: 'same-routine' });
        expect(source.habitDefinitionIds).toEqual(['h1']);
    });

    test.each([
        ['missing source', 'rX', 'rB', 'h1'],
        ['missing dest', 'rA', 'rX', 'h1'],
        ['missing habit def', 'rA', 'rB', 'hX'],
    ])('not-found: %s', (_label, src, dst, hid) => {
        const source = routine('rA', { habitDefinitionIds: ['h1'] });
        const dest = routine('rB');
        const habit = habitDef('h1', { routineId: 'rA' });

        const result = Routines.transferHabitBetweenRoutines(src, dst, hid, [source, dest], [habit]);

        expect(result).toEqual({ ok: false, reason: 'not-found' });
    });

    test('habit not a member of source → not-found', () => {
        const source = routine('rA');
        const dest = routine('rB');
        const habit = habitDef('h1', { routineId: null });

        const result = Routines.transferHabitBetweenRoutines('rA', 'rB', 'h1', [source, dest], [habit]);

        expect(result).toEqual({ ok: false, reason: 'not-found' });
    });

    test('dest already contains the habit → already-in-routine (no mutation)', () => {
        const source = routine('rA', { habitDefinitionIds: ['h1'] });
        const dest = routine('rB', { habitDefinitionIds: ['h1'] });
        const habit = habitDef('h1', { routineId: 'rA' });

        const result = Routines.transferHabitBetweenRoutines('rA', 'rB', 'h1', [source, dest], [habit]);

        expect(result).toEqual({ ok: false, reason: 'already-in-routine' });
        expect(source.habitDefinitionIds).toEqual(['h1']);
        expect(dest.habitDefinitionIds).toEqual(['h1']);
    });
});

// --- transferTaskBetweenRoutines -------------------------------------------

describe('transferTaskBetweenRoutines', () => {
    test('moves membership between taskDefinitionIds arrays', () => {
        const source = routine('rA', { taskDefinitionIds: ['t1', 't2'] });
        const dest = routine('rB', { taskDefinitionIds: ['t9'] });

        const result = Routines.transferTaskBetweenRoutines('rA', 'rB', 't1', [source, dest]);

        expect(result).toEqual({ ok: true });
        expect(source.taskDefinitionIds).toEqual(['t2']);
        expect(dest.taskDefinitionIds).toEqual(['t9', 't1']);
    });

    test('seeds a missing dest taskDefinitionIds array', () => {
        const source = routine('rA', { taskDefinitionIds: ['t1'] });
        const dest = routine('rB');
        delete dest.taskDefinitionIds;

        const result = Routines.transferTaskBetweenRoutines('rA', 'rB', 't1', [source, dest]);

        expect(result.ok).toBe(true);
        expect(dest.taskDefinitionIds).toEqual(['t1']);
    });

    test('a frozen source does NOT block task transfer (tasks are never offenders)', () => {
        const source = routine('rA', {
            taskDefinitionIds: ['t1'],
            frozenState: { frozenBy: 'someHabit', frozenAt: new Date().toISOString() },
        });
        const dest = routine('rB');

        const result = Routines.transferTaskBetweenRoutines('rA', 'rB', 't1', [source, dest]);

        expect(result.ok).toBe(true);
    });

    test('same-routine rejected', () => {
        const source = routine('rA', { taskDefinitionIds: ['t1'] });
        expect(Routines.transferTaskBetweenRoutines('rA', 'rA', 't1', [source]))
            .toEqual({ ok: false, reason: 'same-routine' });
    });

    test('task not in source → not-found', () => {
        const source = routine('rA');
        const dest = routine('rB');
        expect(Routines.transferTaskBetweenRoutines('rA', 'rB', 'tX', [source, dest]))
            .toEqual({ ok: false, reason: 'not-found' });
    });

    test('dest already contains the task → already-in-routine', () => {
        const source = routine('rA', { taskDefinitionIds: ['t1'] });
        const dest = routine('rB', { taskDefinitionIds: ['t1'] });
        expect(Routines.transferTaskBetweenRoutines('rA', 'rB', 't1', [source, dest]))
            .toEqual({ ok: false, reason: 'already-in-routine' });
        expect(source.taskDefinitionIds).toEqual(['t1']);
    });
});

// --- selectActiveInstanceIdsForDefinition ----------------------------------

describe('selectActiveInstanceIdsForDefinition', () => {
    const items = [
        { id: 1, type: 'habit', definitionId: 'h1' },
        { id: 2, type: 'habit', definitionId: 'h2' },
        { id: 3, type: 'task', definitionId: 't1' },
        { id: 4, type: 'task', definitionId: 't1' }, // stale duplicate day
        { id: 5, type: 'task', parentId: 3 },        // sub-task of 3
        { id: 6, type: 'task', parentId: 99 },       // sub-task of something else
    ];

    test('selects only the matching definition instances', () => {
        expect(Routines.selectActiveInstanceIdsForDefinition(items, 'h1', 'habit')).toEqual([1]);
    });

    test('type mismatch excludes (a habit id never matches type task)', () => {
        expect(Routines.selectActiveInstanceIdsForDefinition(items, 'h1', 'task')).toEqual([]);
    });

    test('cascades sub-tasks AHEAD of their parent, unrelated sub-tasks untouched', () => {
        expect(Routines.selectActiveInstanceIdsForDefinition(items, 't1', 'task')).toEqual([5, 3, 4]);
    });

    test('empty board → empty selection', () => {
        expect(Routines.selectActiveInstanceIdsForDefinition([], 'h1', 'habit')).toEqual([]);
    });
});

// --- refund attribution after a transfer (items.js stamp) ------------------

describe('routineXpRoutineId stamp — refund follows the EARNING routine across a transfer', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    function fakeEl() {
        return {
            style: {}, dataset: {},
            classList: { add: () => {}, remove: () => {} },
            addEventListener: () => {}, appendChild: () => {}, remove: () => {},
        };
    }

    beforeAll(() => { global.document = { createElement: () => fakeEl() }; });
    afterAll(() => { delete global.document; });

    function tomorrowNoon() {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(12, 0, 0, 0);
        return d;
    }

    function routineTaskItem(overrides = {}) {
        return {
            id: 1, type: 'task', definitionId: 't1', name: 'Routine Task',
            category: 'other', isHighPriority: false, dueDateTime: tomorrowNoon(),
            isOverdue: false, lastDamageTickTime: null, parentId: null,
            subTasks: [], completedSubTasks: 0, totalSubTasks: 0,
            element: fakeEl(), listItemElement: null,
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

    test('complete under A → transfer to B → uncomplete: A is refunded, B untouched', () => {
        const a = routine('rA', { taskDefinitionIds: ['t1'], xp: 0 });
        const b = routine('rB', { xp: 50 });
        const item = routineTaskItem();
        const deps = makeDeps({ activeItems: [item], definedRoutines: [a, b] });

        Items.completeItem(1, deps);
        jest.runOnlyPendingTimers(); // flush the 500ms removeItem
        const awarded = a.xp;
        expect(awarded).toBeGreaterThan(0);
        expect(item.routineXpRoutineId).toBe('rA');

        // The transfer between complete and uncomplete.
        expect(Routines.transferTaskBetweenRoutines('rA', 'rB', 't1', [a, b]).ok).toBe(true);

        Items.uncompleteItem(1, deps);

        expect(a.xp).toBe(0);   // earner refunded exactly
        expect(b.xp).toBe(50);  // new owner never touched
        expect(item.routineXpAwarded).toBeUndefined();
        expect(item.routineXpRoutineId).toBeUndefined();
    });

    test('pre-stamp save shape (no routineXpRoutineId) falls back to re-resolving ownership', () => {
        const a = routine('rA', { taskDefinitionIds: ['t1'], xp: 0 });
        const item = routineTaskItem();
        const deps = makeDeps({ activeItems: [item], definedRoutines: [a] });

        Items.completeItem(1, deps);
        jest.runOnlyPendingTimers();
        delete item.routineXpRoutineId; // simulate an old save's stamp

        Items.uncompleteItem(1, deps);

        expect(a.xp).toBe(0); // fallback still refunds the current owner
    });
});

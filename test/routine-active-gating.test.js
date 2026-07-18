/**
 * Routine isActive gating + deactivation recall tests (2026-07-18).
 *
 * Covers the ROADMAP item found the same day as the routine-tasks fix:
 * isActive was inert. generateDailyHabitInstances iterated every habit
 * regardless of routine membership or active state, and toggleRoutineActive
 * only flipped the flag (no spawn gating, no recall, no save).
 *
 * This file covers two pieces:
 *   1. The habit-side spawn selection. Originally a hand-maintained mirror
 *      of script.js's private selection logic; as of the habits.js
 *      extraction (2026-07-18) that logic is real, exported code
 *      (Habits.selectHabitDefsToSpawn), so this now requires it directly
 *      instead of keeping a second copy that could drift.
 *   2. selectActiveItemIdsToClearForRoutine — the pure selection half of
 *      clearActiveInstancesForRoutine, which recalls a deactivated routine's
 *      active enemies (decided with Jeremy: deactivating clears active
 *      enemies immediately, not just gates future spawns). The DOM/removal
 *      half goes through the existing removeItem(), verified by playtest —
 *      same split as Spawning.addItemToGame (see ARCHITECTURE.md). As of the
 *      routines.js extraction (2026-07-18) this is real, exported code
 *      (Routines.selectActiveItemIdsToClearForRoutine), so this now requires
 *      it directly instead of keeping a second copy that could drift.
 */

const Habits = require('../js/habits.js');
const selectHabitDefsToSpawn = Habits.selectHabitDefsToSpawn;

const Routines = require('../js/routines.js');
const selectActiveItemIdsToClearForRoutine = Routines.selectActiveItemIdsToClearForRoutine;

// --- fixtures --------------------------------------------------------------

const DAY = new Date(2026, 6, 18); // Sat Jul 18 2026, local
const OTHER_DAY = new Date(2026, 6, 19);

function habitDef(id, overrides = {}) {
    return { id, name: `Habit ${id}`, category: 'other', frequency: 'daily', timeOfDay: 'anytime', streak: 0, isNegative: false, ...overrides };
}

function routine(id, habitDefinitionIds, isActive = true, taskDefinitionIds = []) {
    return { id, name: `Routine ${id}`, habitDefinitionIds, taskDefinitionIds, isActive };
}

function habitInstance(id, definitionId, dueDate, overrides = {}) {
    return { id, type: 'habit', definitionId, originalDueDate: new Date(dueDate), ...overrides };
}

function taskInstance(id, definitionId, overrides = {}) {
    return { id, type: 'task', definitionId, ...overrides };
}

// --- selectHabitDefsToSpawn -------------------------------------------------

describe('selectHabitDefsToSpawn — isActive gating', () => {
    test('a habit in an ACTIVE routine spawns', () => {
        const defs = [habitDef('h1')];
        const routines = [routine('r1', ['h1'], true)];
        expect(selectHabitDefsToSpawn(defs, routines, [], DAY).map(d => d.id)).toEqual(['h1']);
    });

    test('a habit in an INACTIVE routine does not spawn', () => {
        const defs = [habitDef('h1')];
        const routines = [routine('r1', ['h1'], false)];
        expect(selectHabitDefsToSpawn(defs, routines, [], DAY)).toHaveLength(0);
    });

    // REVISED 2026-07-18: this previously asserted that a habit attached to no
    // routine is inert. That rule was aimed at orphaned definitions but also
    // silently blocked every STANDALONE (FAB-created) habit — the bug Jeremy
    // hit live. Standalone and orphaned habits now both spawn on their own.
    // See DECISIONS.md.
    test('a habit attached to no routine (standalone) DOES spawn', () => {
        const defs = [habitDef('h1', { routineId: 'r1' }), habitDef('standalone', { routineId: null })];
        const routines = [routine('r1', ['h1'], true)];
        expect(selectHabitDefsToSpawn(defs, routines, [], DAY).map(d => d.id))
            .toEqual(['h1', 'standalone']);
    });

    test('a standalone habit spawns even when every routine is INACTIVE', () => {
        const defs = [habitDef('standalone', { routineId: null })];
        const routines = [routine('r1', ['h1'], false)];
        expect(selectHabitDefsToSpawn(defs, routines, [], DAY).map(d => d.id)).toEqual(['standalone']);
    });

    test('a standalone habit spawns when there are no routines at all', () => {
        const defs = [habitDef('standalone', { routineId: null })];
        expect(selectHabitDefsToSpawn(defs, [], [], DAY).map(d => d.id)).toEqual(['standalone']);
    });

    test('a habit with no routineId field at all (legacy shape) spawns as standalone', () => {
        const defs = [habitDef('legacy')]; // fixture omits routineId entirely
        expect(selectHabitDefsToSpawn(defs, [], [], DAY).map(d => d.id)).toEqual(['legacy']);
    });

    test('an ORPHANED habit (routineId nulled, no longer listed) spawns as standalone', () => {
        const defs = [habitDef('h1', { routineId: null })];
        const routines = [routine('r1', [], false)]; // routine no longer lists it
        expect(selectHabitDefsToSpawn(defs, routines, [], DAY).map(d => d.id)).toEqual(['h1']);
    });

    test('a DANGLING routineId (its routine was deleted) spawns as standalone', () => {
        const defs = [habitDef('h1', { routineId: 'deletedRoutine' })];
        const routines = [routine('r1', [], false)];
        expect(selectHabitDefsToSpawn(defs, routines, [], DAY).map(d => d.id)).toEqual(['h1']);
    });

    test('routine membership still gates even if routineId is missing (legacy save)', () => {
        const defs = [habitDef('h1')]; // no routineId, but listed by an inactive routine
        const routines = [routine('r1', ['h1'], false)];
        expect(selectHabitDefsToSpawn(defs, routines, [], DAY)).toHaveLength(0);
    });

    test('routineId alone gates even if the routine does not list it', () => {
        const defs = [habitDef('h1', { routineId: 'r1' })];
        const routines = [routine('r1', [], false)];
        expect(selectHabitDefsToSpawn(defs, routines, [], DAY)).toHaveLength(0);
    });

    test('shared by an active AND inactive routine still spawns (active wins)', () => {
        const defs = [habitDef('h1')];
        const routines = [routine('r1', ['h1'], false), routine('r2', ['h1'], true)];
        expect(selectHabitDefsToSpawn(defs, routines, [], DAY)).toHaveLength(1);
    });

    test('does not double-spawn when already completed for this game day', () => {
        const defs = [habitDef('h1', { lastCompletionDate: DAY })];
        const routines = [routine('r1', ['h1'], true)];
        expect(selectHabitDefsToSpawn(defs, routines, [], DAY)).toHaveLength(0);
    });

    test('DOES spawn again on a new day after being completed yesterday', () => {
        const defs = [habitDef('h1', { lastCompletionDate: DAY })];
        const routines = [routine('r1', ['h1'], true)];
        expect(selectHabitDefsToSpawn(defs, routines, [], OTHER_DAY).map(d => d.id)).toEqual(['h1']);
    });

    test('does not double-spawn when an instance for that day is already active', () => {
        const defs = [habitDef('h1')];
        const routines = [routine('r1', ['h1'], true)];
        const active = [habitInstance(1, 'h1', DAY)];
        expect(selectHabitDefsToSpawn(defs, routines, active, DAY)).toHaveLength(0);
    });

    test('non-daily frequency does not spawn (dormant safety net — form only offers daily today)', () => {
        const defs = [habitDef('h1', { frequency: 'weekly' })];
        const routines = [routine('r1', ['h1'], true)];
        expect(selectHabitDefsToSpawn(defs, routines, [], DAY)).toHaveLength(0);
    });
});

// --- selectActiveItemIdsToClearForRoutine -----------------------------------

describe('selectActiveItemIdsToClearForRoutine — deactivation recall', () => {
    test('recalls an active habit instance belonging to the routine', () => {
        const active = [habitInstance(1, 'h1', DAY)];
        const r = routine('r1', ['h1']);
        expect(selectActiveItemIdsToClearForRoutine(active, r)).toEqual([1]);
    });

    test('recalls an active task instance belonging to the routine', () => {
        const active = [taskInstance(2, 't1')];
        const r = routine('r1', [], true, ['t1']);
        expect(selectActiveItemIdsToClearForRoutine(active, r)).toEqual([2]);
    });

    test('leaves items belonging to OTHER routines alone', () => {
        const active = [habitInstance(1, 'h1', DAY), habitInstance(2, 'h2', DAY)];
        const r = routine('r1', ['h1']);
        expect(selectActiveItemIdsToClearForRoutine(active, r)).toEqual([1]);
    });

    test('leaves manually-created items (no definitionId) alone', () => {
        const active = [{ id: 3, type: 'task', originalDueDate: new Date(DAY) }];
        const r = routine('r1', [], true, ['t1']);
        expect(selectActiveItemIdsToClearForRoutine(active, r)).toEqual([]);
    });

    test('cascades sub-tasks of a recalled routine task, ordered before their parent', () => {
        const active = [
            taskInstance(10, 't1'),
            { id: 11, type: 'task', parentId: 10 },
            { id: 12, type: 'task', parentId: 10 },
        ];
        const r = routine('r1', [], true, ['t1']);
        expect(selectActiveItemIdsToClearForRoutine(active, r)).toEqual([11, 12, 10]);
    });

    test('does not cascade sub-tasks of an unrelated parent', () => {
        const active = [
            taskInstance(10, 't1'),
            { id: 11, type: 'task', parentId: 99 }, // belongs to some other, non-routine task
        ];
        const r = routine('r1', [], true, ['t1']);
        expect(selectActiveItemIdsToClearForRoutine(active, r)).toEqual([10]);
    });

    test('a routine with no habitDefinitionIds/taskDefinitionIds does not throw', () => {
        const active = [habitInstance(1, 'h1', DAY)];
        const r = { id: 'r1', name: 'legacy' };
        expect(() => selectActiveItemIdsToClearForRoutine(active, r)).not.toThrow();
        expect(selectActiveItemIdsToClearForRoutine(active, r)).toEqual([]);
    });

    test('empty activeItems returns empty', () => {
        const r = routine('r1', ['h1'], true, ['t1']);
        expect(selectActiveItemIdsToClearForRoutine([], r)).toEqual([]);
    });
});

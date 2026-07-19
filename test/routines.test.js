/**
 * Routines tests (Milestone 2 extraction #6, 2026-07-18).
 *
 * js/routines.js is required directly (no CONFIG global, no DOM).
 * getRoutineTaskInstanceDueTime and selectTaskDefsToSpawn are covered by
 * test/routine-task-instances.test.js; selectActiveItemIdsToClearForRoutine
 * is covered by test/routine-active-gating.test.js. This file covers
 * instance creation/orchestration, definition CRUD, and
 * activation/deactivation (toggleRoutineActive + clearActiveInstancesForRoutine).
 */
// routines.js reads the Schedule global in selectTaskDefsToSpawn (schemaVersion
// 3 recurrence gate) — bind it before requiring, as the browser's <script>
// order does.
global.Schedule = require('../js/schedule.js');
global.FrozenSlots = require('../js/frozenSlots.js');
const Routines = require('../js/routines.js');

const DAY = new Date(2026, 6, 18); // Sat Jul 18 2026, local

function routine(id, overrides = {}) {
    return { id, name: `Routine ${id}`, habitDefinitionIds: [], taskDefinitionIds: [], isActive: false, ...overrides };
}

function taskDef(id, overrides = {}) {
    return { id, name: `Task ${id}`, category: 'other', isHighPriority: false, defaultDueTime: '09:00', ...overrides };
}

function habitDef(id, overrides = {}) {
    return { id, name: `Habit ${id}`, category: 'other', frequency: 'daily', timeOfDay: 'morning', streak: 0, isNegative: false, ...overrides };
}

// --- createRoutineTaskInstanceData / generateDailyRoutineTaskInstances -----

describe('createRoutineTaskInstanceData', () => {
    function deps(overrides = {}) {
        return {
            getNextId: () => 42,
            gameScreenWidth: 800,
            enemyWidth: 64,
            calculateTimelineXWithClustering: (item) => 100,
            ...overrides
        };
    }

    test('builds a type:task instance carrying the definitionId', () => {
        const instance = Routines.createRoutineTaskInstanceData(taskDef('t1'), DAY, deps());
        expect(instance.type).toBe('task');
        expect(instance.definitionId).toBe('t1');
        expect(instance.id).toBe(42);
        expect(instance.x).toBe(100);
    });

    test('due time is derived from defaultDueTime via getRoutineTaskInstanceDueTime', () => {
        const instance = Routines.createRoutineTaskInstanceData(taskDef('t1', { defaultDueTime: '14:30' }), DAY, deps());
        expect(instance.dueDateTime.getHours()).toBe(14);
        expect(instance.dueDateTime.getMinutes()).toBe(30);
    });

    test('is a top-level task that can take sub-tasks (parentId undefined, subTasks empty)', () => {
        const instance = Routines.createRoutineTaskInstanceData(taskDef('t1'), DAY, deps());
        expect(instance.parentId).toBeUndefined();
        expect(instance.subTasks).toEqual([]);
    });
});

describe('generateDailyRoutineTaskInstances', () => {
    function makeDeps(overrides = {}) {
        const added = [];
        return {
            deps: {
                getNextId: (() => { let n = 1; return () => n++; })(),
                gameScreenWidth: 800,
                enemyWidth: 64,
                calculateTimelineXWithClustering: () => 100,
                definedTasks: [taskDef('t1')],
                definedRoutines: [routine('r1', { taskDefinitionIds: ['t1'], isActive: true })],
                activeItems: [],
                completedItems: [],
                addItemToGame: (item) => added.push(item),
                sortAndRenderActiveList: () => {},
                ...overrides
            },
            added
        };
    }

    test('spawns and admits a due, active-routine task', () => {
        const { deps, added } = makeDeps();
        Routines.generateDailyRoutineTaskInstances(DAY, deps);
        expect(added).toHaveLength(1);
        expect(added[0].definitionId).toBe('t1');
    });

    test('does not spawn a task belonging to an inactive routine', () => {
        const { deps, added } = makeDeps({
            definedRoutines: [routine('r1', { taskDefinitionIds: ['t1'], isActive: false })]
        });
        Routines.generateDailyRoutineTaskInstances(DAY, deps);
        expect(added).toHaveLength(0);
    });

    test('does not spawn a task belonging to a FROZEN routine (sub-session 2 — tasks have no offending-def exception)', () => {
        const { deps, added } = makeDeps({
            definedRoutines: [routine('r1', {
                taskDefinitionIds: ['t1'], isActive: true,
                frozenState: { frozenBy: 'someHabit', frozenAt: 'X' }
            })]
        });
        Routines.generateDailyRoutineTaskInstances(DAY, deps);
        expect(added).toHaveLength(0);
    });

    test('calls sortAndRenderActiveList exactly once regardless of spawn count', () => {
        let calls = 0;
        const { deps } = makeDeps({ sortAndRenderActiveList: () => calls++ });
        Routines.generateDailyRoutineTaskInstances(DAY, deps);
        expect(calls).toBe(1);
    });
});

// --- createRoutineDefinition / deleteRoutine --------------------------------

describe('createRoutineDefinition', () => {
    test('rejects an empty/whitespace name', () => {
        expect(Routines.createRoutineDefinition('   ', [])).toEqual({ ok: false, reason: 'empty' });
    });

    test('rejects a case-insensitive duplicate name', () => {
        const existing = [routine('r1', { name: 'Morning Routine' })];
        expect(Routines.createRoutineDefinition('morning routine', existing)).toEqual({ ok: false, reason: 'duplicate' });
    });

    test('builds a new routine with empty slots and isActive:false', () => {
        const result = Routines.createRoutineDefinition('Evening Wind-down', []);
        expect(result.ok).toBe(true);
        expect(result.routine.name).toBe('Evening Wind-down');
        expect(result.routine.habitDefinitionIds).toEqual([]);
        expect(result.routine.taskDefinitionIds).toEqual([]);
        expect(result.routine.isActive).toBe(false);
        // Frozen routine slots (schemaVersion 6, 2026-07-19): new routines
        // start unfrozen.
        expect(result.routine.frozenState).toBeNull();
    });

    test('trims the name before storing', () => {
        const result = Routines.createRoutineDefinition('  Padded  ', []);
        expect(result.routine.name).toBe('Padded');
    });
});

describe('deleteRoutine', () => {
    function makeDeps(routines, activeItems = []) {
        const removed = [];
        return {
            deps: { definedRoutines: routines, activeItems, removeItem: (id) => removed.push(id) },
            removed
        };
    }

    test('removes the matching routine and returns it', () => {
        const routines = [routine('r1'), routine('r2')];
        const { deps } = makeDeps(routines);
        const removedRoutine = Routines.deleteRoutine('r1', deps);
        expect(removedRoutine.id).toBe('r1');
        expect(routines).toHaveLength(1);
        expect(routines[0].id).toBe('r2');
    });

    test('returns null and does not throw for an unknown id', () => {
        const routines = [routine('r1')];
        const { deps } = makeDeps(routines);
        expect(Routines.deleteRoutine('nope', deps)).toBeNull();
        expect(routines).toHaveLength(1);
    });

    test('BUGFIX: recalls the routine\'s active habit/task instances before removing it', () => {
        const routines = [routine('r1', { habitDefinitionIds: ['h1'], taskDefinitionIds: ['t1'] })];
        const activeItems = [
            { id: 1, type: 'habit', definitionId: 'h1' },
            { id: 2, type: 'task', definitionId: 't1' },
        ];
        const { deps, removed } = makeDeps(routines, activeItems);
        Routines.deleteRoutine('r1', deps);
        expect(removed.sort()).toEqual([1, 2]);
    });

    test('does not recall instances belonging to OTHER routines', () => {
        const routines = [routine('r1', { habitDefinitionIds: ['h1'] }), routine('r2', { habitDefinitionIds: ['h2'] })];
        const activeItems = [{ id: 1, type: 'habit', definitionId: 'h1' }, { id: 2, type: 'habit', definitionId: 'h2' }];
        const { deps, removed } = makeDeps(routines, activeItems);
        Routines.deleteRoutine('r1', deps);
        expect(removed).toEqual([1]);
    });
});

// --- membership: add/remove habit/task ------------------------------------

describe('removeHabitFromRoutine / removeTaskFromRoutine', () => {
    test('removeHabitFromRoutine splices the id and returns true', () => {
        const routines = [routine('r1', { habitDefinitionIds: ['h1', 'h2'] })];
        expect(Routines.removeHabitFromRoutine('r1', 'h1', routines)).toBe(true);
        expect(routines[0].habitDefinitionIds).toEqual(['h2']);
    });

    test('removeHabitFromRoutine returns false when the habit is not in the routine', () => {
        const routines = [routine('r1', { habitDefinitionIds: ['h2'] })];
        expect(Routines.removeHabitFromRoutine('r1', 'h1', routines)).toBe(false);
    });

    // 2026-07-18: removal releases the habit to STANDALONE (Jeremy's call) so
    // it keeps its streak and resumes spawning on its own. See DECISIONS.md.
    test('removeHabitFromRoutine nulls the habit routineId (released to standalone)', () => {
        const routines = [routine('r1', { habitDefinitionIds: ['h1'] })];
        const habits = [habitDef('h1', { routineId: 'r1', streak: 4 })];
        expect(Routines.removeHabitFromRoutine('r1', 'h1', routines, habits)).toBe(true);
        expect(habits[0].routineId).toBeNull();
    });

    test('removeHabitFromRoutine preserves the streak when releasing to standalone', () => {
        const routines = [routine('r1', { habitDefinitionIds: ['h1'] })];
        const habits = [habitDef('h1', { routineId: 'r1', streak: 4 })];
        Routines.removeHabitFromRoutine('r1', 'h1', routines, habits);
        expect(habits[0].streak).toBe(4);
    });

    test('removeHabitFromRoutine does not throw when definedHabits is omitted', () => {
        const routines = [routine('r1', { habitDefinitionIds: ['h1'] })];
        expect(() => Routines.removeHabitFromRoutine('r1', 'h1', routines)).not.toThrow();
    });

    test('removeHabitFromRoutine leaves other habits routineId untouched', () => {
        const routines = [routine('r1', { habitDefinitionIds: ['h1', 'h2'] })];
        const habits = [habitDef('h1', { routineId: 'r1' }), habitDef('h2', { routineId: 'r1' })];
        Routines.removeHabitFromRoutine('r1', 'h1', routines, habits);
        expect(habits[1].routineId).toBe('r1');
    });

    test('removeTaskFromRoutine splices the id and returns true', () => {
        const routines = [routine('r1', { taskDefinitionIds: ['t1', 't2'] })];
        expect(Routines.removeTaskFromRoutine('r1', 't1', routines)).toBe(true);
        expect(routines[0].taskDefinitionIds).toEqual(['t2']);
    });

    test('removeTaskFromRoutine on a legacy routine with no taskDefinitionIds does not throw', () => {
        const routines = [{ id: 'r1', name: 'legacy' }];
        expect(() => Routines.removeTaskFromRoutine('r1', 't1', routines)).not.toThrow();
        expect(Routines.removeTaskFromRoutine('r1', 't1', routines)).toBe(false);
    });
});

describe('addHabitToRoutine', () => {
    test('attaches an existing habit definition', () => {
        const routines = [routine('r1')];
        const habits = [habitDef('h1')];
        expect(Routines.addHabitToRoutine('r1', 'h1', routines, habits)).toEqual({ ok: true });
        expect(routines[0].habitDefinitionIds).toEqual(['h1']);
    });

    // Adopting a standalone habit transfers ownership, so it becomes gated on
    // the routine's isActive instead of spawning unconditionally.
    test('adopting a standalone habit sets its routineId', () => {
        const routines = [routine('r1')];
        const habits = [habitDef('h1', { routineId: null })];
        Routines.addHabitToRoutine('r1', 'h1', routines, habits);
        expect(habits[0].routineId).toBe('r1');
    });

    test('rejects when routine or habit is missing', () => {
        expect(Routines.addHabitToRoutine('nope', 'h1', [], [habitDef('h1')])).toEqual({ ok: false, reason: 'not-found' });
    });

    test('rejects a habit already attached to the routine', () => {
        const routines = [routine('r1', { habitDefinitionIds: ['h1'] })];
        const habits = [habitDef('h1')];
        expect(Routines.addHabitToRoutine('r1', 'h1', routines, habits)).toEqual({ ok: false, reason: 'already-in-routine' });
    });
});

// --- create/edit habit+task definitions in a routine ------------------------

describe('createNewHabitInRoutine', () => {
    test('registers the new habit in definedHabits and the routine', () => {
        const routines = [routine('r1')];
        const habits = [];
        const newHabit = Routines.createNewHabitInRoutine('r1', { name: 'Meditate', category: 'wellness', frequency: 'daily', timeOfDay: 'morning' }, routines, habits);
        expect(newHabit.name).toBe('Meditate');
        expect(newHabit.streak).toBe(0);
        expect(habits).toContain(newHabit);
        expect(routines[0].habitDefinitionIds).toContain(newHabit.id);
    });

    test('returns null for an unknown routine and touches nothing', () => {
        const habits = [];
        expect(Routines.createNewHabitInRoutine('nope', { name: 'X' }, [], habits)).toBeNull();
        expect(habits).toHaveLength(0);
    });

    // Habits born inside a routine are owned by it from the start, so they're
    // gated on its isActive rather than spawning standalone.
    test('stamps the owning routineId on the new habit', () => {
        const routines = [routine('r1')];
        const newHabit = Routines.createNewHabitInRoutine('r1', { name: 'Meditate', category: 'wellness', frequency: 'daily', timeOfDay: 'morning' }, routines, []);
        expect(newHabit.routineId).toBe('r1');
    });

    // Session 15 (2026-07-18): scheduling UI passes a full schedule object.
    test('a legacy bare frequency string still converts to a daily schedule', () => {
        const routines = [routine('r1')];
        const newHabit = Routines.createNewHabitInRoutine('r1', { name: 'Meditate', category: 'wellness', frequency: 'daily', timeOfDay: 'morning' }, routines, []);
        expect(newHabit.schedule).toEqual({ frequency: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], dayOfMonth: null });
        expect(newHabit.occurrenceHistory).toEqual([]);
        // Frozen routine slots (schemaVersion 6, 2026-07-19): new habit defs
        // start with no modification history.
        expect(newHabit.modificationHistory).toEqual([]);
    });

    test('a full schedule object from the scheduling UI is preferred over frequency', () => {
        const routines = [routine('r1')];
        const weekly = { frequency: 'weekly', daysOfWeek: [1, 3, 5], dayOfMonth: null };
        const newHabit = Routines.createNewHabitInRoutine('r1', { name: 'Meditate', category: 'wellness', schedule: weekly, timeOfDay: 'morning' }, routines, []);
        expect(newHabit.schedule).toEqual(weekly);
    });

    test('a monthly schedule is preserved as-is', () => {
        const routines = [routine('r1')];
        const monthly = { frequency: 'monthly', daysOfWeek: [], dayOfMonth: 15 };
        const newHabit = Routines.createNewHabitInRoutine('r1', { name: 'Pay rent', category: 'financial', schedule: monthly, timeOfDay: 'morning' }, routines, []);
        expect(newHabit.schedule).toEqual(monthly);
    });
});

describe('createNewTaskInRoutine', () => {
    test('registers the new task definition and defaults defaultDueTime to 17:00', () => {
        const routines = [routine('r1')];
        const tasks = [];
        const newTask = Routines.createNewTaskInRoutine('r1', { name: 'Water plants', category: 'chores', isHighPriority: false }, routines, tasks);
        expect(newTask.defaultDueTime).toBe('17:00');
        expect(tasks).toContain(newTask);
        expect(routines[0].taskDefinitionIds).toContain(newTask.id);
    });

    test('initializes taskDefinitionIds on a legacy routine missing the array', () => {
        const routines = [{ id: 'r1', name: 'legacy', habitDefinitionIds: [] }];
        const tasks = [];
        const newTask = Routines.createNewTaskInRoutine('r1', { name: 'X', category: 'other' }, routines, tasks);
        expect(routines[0].taskDefinitionIds).toEqual([newTask.id]);
    });

    // Session 15 (2026-07-18): routine tasks gained a schedule too.
    test('defaults to a daily schedule when the form provides none', () => {
        const routines = [routine('r1')];
        const newTask = Routines.createNewTaskInRoutine('r1', { name: 'X', category: 'other' }, routines, []);
        expect(newTask.schedule).toEqual({ frequency: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], dayOfMonth: null });
    });

    test('honors a schedule passed from the scheduling UI', () => {
        const routines = [routine('r1')];
        const monthly = { frequency: 'monthly', daysOfWeek: [], dayOfMonth: 1 };
        const newTask = Routines.createNewTaskInRoutine('r1', { name: 'Pay rent', category: 'financial', schedule: monthly }, routines, []);
        expect(newTask.schedule).toEqual(monthly);
    });
});

describe('editHabitInRoutine / editTaskInRoutine', () => {
    test('editHabitInRoutine updates fields in place and returns true', () => {
        const habits = [habitDef('h1', { name: 'Old' })];
        expect(Routines.editHabitInRoutine('h1', { name: 'New', category: 'other', frequency: 'daily', timeOfDay: 'evening', isNegative: true }, habits)).toBe(true);
        expect(habits[0].name).toBe('New');
        expect(habits[0].timeOfDay).toBe('evening');
        expect(habits[0].isNegative).toBe(true);
    });

    test('editHabitInRoutine returns false for an unknown id', () => {
        expect(Routines.editHabitInRoutine('nope', {}, [])).toBe(false);
    });

    // Session 15 (2026-07-18): editHabitInRoutine prefers a full schedule
    // object over the legacy frequency fallback.
    test('editHabitInRoutine prefers a full schedule object when provided', () => {
        const habits = [habitDef('h1')];
        const weekly = { frequency: 'weekly', daysOfWeek: [2, 4], dayOfMonth: null };
        Routines.editHabitInRoutine('h1', { name: 'X', category: 'other', schedule: weekly, timeOfDay: 'morning', isNegative: false }, habits);
        expect(habits[0].schedule).toEqual(weekly);
    });

    // Session 15: editTaskInRoutine gains schedule support.
    test('editTaskInRoutine writes a provided schedule', () => {
        const tasks = [taskDef('t1', { schedule: { frequency: 'daily', daysOfWeek: [0,1,2,3,4,5,6], dayOfMonth: null } })];
        const weekly = { frequency: 'weekly', daysOfWeek: [1, 3, 5], dayOfMonth: null };
        expect(Routines.editTaskInRoutine('t1', { name: 'X', category: 'other', isHighPriority: false, defaultDueTime: '09:00', schedule: weekly }, tasks)).toBe(true);
        expect(tasks[0].schedule).toEqual(weekly);
    });

    test('editTaskInRoutine preserves the existing schedule when none is provided', () => {
        const existing = { frequency: 'monthly', daysOfWeek: [], dayOfMonth: 5 };
        const tasks = [taskDef('t1', { schedule: existing })];
        Routines.editTaskInRoutine('t1', { name: 'X', category: 'other', isHighPriority: false, defaultDueTime: '09:00' }, tasks);
        expect(tasks[0].schedule).toEqual(existing);
    });

    test('editTaskInRoutine defaults to daily when the task never had a schedule and none is provided', () => {
        const tasks = [taskDef('t1')];
        delete tasks[0].schedule;
        Routines.editTaskInRoutine('t1', { name: 'X', category: 'other', isHighPriority: false, defaultDueTime: '09:00' }, tasks);
        expect(tasks[0].schedule).toEqual({ frequency: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], dayOfMonth: null });
    });

    test('editTaskInRoutine updates fields in place and returns true', () => {
        const tasks = [taskDef('t1', { name: 'Old' })];
        expect(Routines.editTaskInRoutine('t1', { name: 'New', category: 'other', isHighPriority: true, defaultDueTime: '08:00' }, tasks)).toBe(true);
        expect(tasks[0].name).toBe('New');
        expect(tasks[0].defaultDueTime).toBe('08:00');
    });

    test('editTaskInRoutine returns false when definedTasks is falsy (matches original guard)', () => {
        expect(Routines.editTaskInRoutine('t1', {}, undefined)).toBe(false);
    });
});

// --- Frozen slots recovery path 1: edit-to-unfreeze + modificationHistory --
// (sub-session 4, 2026-07-19, docs/FROZEN_SLOTS_PLAN.md)

describe('editHabitInRoutine — modificationHistory + edit-to-unfreeze (sub-session 4)', () => {
    function fullEdit(overrides = {}) {
        return { name: 'Meditate', category: 'health', frequency: 'daily', timeOfDay: 'morning', isNegative: false, ...overrides };
    }

    test('a real change appends { timestamp, changedFields } to modificationHistory', () => {
        const habits = [habitDef('h1', { name: 'Old', category: 'other', timeOfDay: 'evening', isNegative: false, modificationHistory: [] })];
        Routines.editHabitInRoutine('h1', fullEdit(), habits);
        expect(habits[0].modificationHistory).toHaveLength(1);
        const entry = habits[0].modificationHistory[0];
        expect(typeof entry.timestamp).toBe('string');
        expect(entry.changedFields.sort()).toEqual(['category', 'name', 'schedule', 'timeOfDay'].sort());
    });

    test('a no-op save (identical values) appends nothing', () => {
        const schedule = { frequency: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], dayOfMonth: null };
        const habits = [habitDef('h1', { name: 'Meditate', category: 'health', timeOfDay: 'morning', isNegative: false, schedule, modificationHistory: [] })];
        Routines.editHabitInRoutine('h1', fullEdit(), habits);
        expect(habits[0].modificationHistory).toEqual([]);
    });

    test('modificationHistory is lazily initialized when absent (pre-existing habit defs)', () => {
        const habits = [habitDef('h1', { name: 'Old' })];
        delete habits[0].modificationHistory;
        Routines.editHabitInRoutine('h1', fullEdit(), habits);
        expect(habits[0].modificationHistory).toHaveLength(1);
    });

    test('a real edit to the habit that froze its routine clears frozenState and notifies once', () => {
        const habits = [habitDef('h1', { name: 'Old', routineId: 'r1' })];
        const routines = [routine('r1', { frozenState: { frozenBy: 'h1', frozenAt: '2026-07-19T00:00:00.000Z' } })];
        let notified = null;
        Routines.editHabitInRoutine('h1', fullEdit(), habits, routines, {
            onRoutineUnfrozen: (routine, habit) => { notified = { routineId: routine.id, habitId: habit.id }; }
        });
        expect(routines[0].frozenState).toBeNull();
        expect(notified).toEqual({ routineId: 'r1', habitId: 'h1' });
    });

    test('a no-op save on a frozen routine does NOT unfreeze it', () => {
        const schedule = { frequency: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], dayOfMonth: null };
        const habits = [habitDef('h1', { name: 'Meditate', category: 'health', timeOfDay: 'morning', isNegative: false, schedule, routineId: 'r1' })];
        const routines = [routine('r1', { frozenState: { frozenBy: 'h1', frozenAt: '2026-07-19T00:00:00.000Z' } })];
        let notified = false;
        Routines.editHabitInRoutine('h1', fullEdit(), habits, routines, { onRoutineUnfrozen: () => { notified = true; } });
        expect(routines[0].frozenState).not.toBeNull();
        expect(notified).toBe(false);
    });

    test('a real edit to a DIFFERENT habit than the one that froze the routine leaves frozenState alone', () => {
        const habits = [
            habitDef('h1', { name: 'Old', routineId: 'r1' }),
            habitDef('h2', { name: 'Other', routineId: 'r1' }),
        ];
        const routines = [routine('r1', { frozenState: { frozenBy: 'h2', frozenAt: '2026-07-19T00:00:00.000Z' } })];
        Routines.editHabitInRoutine('h1', fullEdit(), habits, routines, { onRoutineUnfrozen: () => { throw new Error('should not fire'); } });
        expect(routines[0].frozenState).toEqual({ frozenBy: 'h2', frozenAt: '2026-07-19T00:00:00.000Z' });
    });

    test('a real edit on an unfrozen routine is a no-op for frozenState (no crash without onRoutineUnfrozen)', () => {
        const habits = [habitDef('h1', { name: 'Old', routineId: 'r1' })];
        const routines = [routine('r1', { frozenState: null })];
        expect(() => Routines.editHabitInRoutine('h1', fullEdit(), habits, routines)).not.toThrow();
        expect(routines[0].frozenState).toBeNull();
    });

    test('omitting definedRoutines entirely still records modificationHistory (back-compat, no unfreeze check)', () => {
        const habits = [habitDef('h1', { name: 'Old' })];
        expect(Routines.editHabitInRoutine('h1', fullEdit(), habits)).toBe(true);
        expect(habits[0].modificationHistory).toHaveLength(1);
    });
});

// --- activation / deactivation ----------------------------------------------

describe('clearActiveInstancesForRoutine', () => {
    test('removes only the routine\'s own active instances via removeItem', () => {
        const removed = [];
        const r1 = routine('r1', { habitDefinitionIds: ['h1'] });
        const deps = {
            definedRoutines: [r1, routine('r2', { habitDefinitionIds: ['h2'] })],
            activeItems: [
                { id: 1, type: 'habit', definitionId: 'h1' },
                { id: 2, type: 'habit', definitionId: 'h2' },
            ],
            removeItem: (id) => removed.push(id)
        };
        Routines.clearActiveInstancesForRoutine('r1', deps);
        expect(removed).toEqual([1]);
    });

    test('does nothing for an unknown routineId', () => {
        const removed = [];
        const deps = { definedRoutines: [], activeItems: [{ id: 1, type: 'habit', definitionId: 'h1' }], removeItem: (id) => removed.push(id) };
        Routines.clearActiveInstancesForRoutine('nope', deps);
        expect(removed).toEqual([]);
    });
});

describe('toggleRoutineActive', () => {
    function makeDeps(routines, overrides = {}) {
        const calls = { removed: [], habitsGenerated: 0, tasksGenerated: 0, saved: 0, alerts: [] };
        return {
            calls,
            deps: {
                definedRoutines: routines,
                routineSlots: 3,
                activeItems: [],
                removeItem: (id) => calls.removed.push(id),
                alert: (msg) => calls.alerts.push(msg),
                generateDailyHabitInstances: () => calls.habitsGenerated++,
                generateDailyRoutineTaskInstances: () => calls.tasksGenerated++,
                currentGameDate: DAY,
                saveGame: () => calls.saved++,
                ...overrides
            }
        };
    }

    test('activating an inactive routine spawns both daily generators and saves', () => {
        const routines = [routine('r1', { isActive: false })];
        const { deps, calls } = makeDeps(routines);
        Routines.toggleRoutineActive('r1', deps);
        expect(routines[0].isActive).toBe(true);
        expect(calls.habitsGenerated).toBe(1);
        expect(calls.tasksGenerated).toBe(1);
        expect(calls.saved).toBe(1);
    });

    test('deactivating an active routine recalls its active instances and saves', () => {
        const routines = [routine('r1', { isActive: true, habitDefinitionIds: ['h1'] })];
        const { deps, calls } = makeDeps(routines, { activeItems: [{ id: 5, type: 'habit', definitionId: 'h1' }] });
        Routines.toggleRoutineActive('r1', deps);
        expect(routines[0].isActive).toBe(false);
        expect(calls.removed).toEqual([5]);
        expect(calls.habitsGenerated).toBe(0);
        expect(calls.saved).toBe(1);
    });

    test('blocks activation at the routine slot cap and does not toggle or save', () => {
        const routines = [routine('r1', { isActive: true }), routine('r2', { isActive: true }), routine('r3', { isActive: true }), routine('r4', { isActive: false })];
        const { deps, calls } = makeDeps(routines, { routineSlots: 3 });
        Routines.toggleRoutineActive('r4', deps);
        expect(routines[3].isActive).toBe(false);
        expect(calls.alerts).toHaveLength(1);
        expect(calls.saved).toBe(0);
    });

    test('does nothing for an unknown routineId', () => {
        const { deps, calls } = makeDeps([]);
        Routines.toggleRoutineActive('nope', deps);
        expect(calls.saved).toBe(0);
    });
});

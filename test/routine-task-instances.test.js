/**
 * Routine task instance tests (2026-07-18).
 *
 * Covers the bug where a task created inside a routine never appeared on the
 * board or in the agenda: createNewTaskInRoutine stored a DEFINITION in
 * definedTasks and nothing ever instantiated it. There was no task equivalent
 * of createHabitInstanceData/generateDailyHabitInstances.
 *
 * Also covers the same-day follow-up fix: routine.isActive now gates
 * spawning (see test/routine-active-gating.test.js for the habit-side mirror
 * and the recall-on-deactivate selection logic).
 *
 * These functions live in script.js, which has no module.exports, so this is a
 * hand-maintained mirror matching the convention of test/subtask-creation.test.js
 * and test/create-list-item-branching.test.js. Keep in sync with script.js's
 * getRoutineTaskInstanceDueTime / generateDailyRoutineTaskInstances.
 */

// --- mirrors of script.js -------------------------------------------------

function getRoutineTaskInstanceDueTime(defaultDueTime, referenceDate) {
    const due = new Date(referenceDate);
    due.setSeconds(0, 0);

    const [hours, minutes] = String(defaultDueTime || '17:00').split(':').map(Number);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        due.setHours(hours, minutes);
    } else {
        due.setHours(17, 0);
    }

    return due;
}

// The selection half of generateDailyRoutineTaskInstances — which definitions
// spawn for a given day. The DOM half (addItemToGame) is verified by playtest,
// matching how Spawning.addItemToGame is treated (see ARCHITECTURE.md).
function selectTaskDefsToSpawn(definedTasks, definedRoutines, activeItems, completedItems, forWhichGameDay) {
    const forWhichGameDayString = forWhichGameDay.toDateString();

    // Only definitions attached to a currently-ACTIVE routine spawn
    // (2026-07-18 isActive-gating fix).
    const routineTaskIds = new Set();
    definedRoutines.forEach(routine => {
        if (!routine.isActive) return;
        (routine.taskDefinitionIds || []).forEach(id => routineTaskIds.add(id));
    });

    return definedTasks.filter(taskDef => {
        if (!routineTaskIds.has(taskDef.id)) return false;

        const existingActiveInstance = activeItems.find(item =>
            item.type === 'task' &&
            item.definitionId === taskDef.id &&
            item.originalDueDate &&
            new Date(item.originalDueDate).toDateString() === forWhichGameDayString
        );

        const alreadyCompletedForThisGameDay = completedItems.some(item =>
            item.type === 'task' &&
            item.definitionId === taskDef.id &&
            item.originalDueDate &&
            new Date(item.originalDueDate).toDateString() === forWhichGameDayString
        );

        return !existingActiveInstance && !alreadyCompletedForThisGameDay;
    });
}

// --- fixtures --------------------------------------------------------------

const DAY = new Date(2026, 6, 18); // Sat Jul 18 2026, local
const OTHER_DAY = new Date(2026, 6, 19);

function taskDef(id, overrides = {}) {
    return { id, name: `Task ${id}`, category: 'other', isHighPriority: false, defaultDueTime: '17:00', ...overrides };
}

// Defaults to isActive: true so the pre-existing dedupe/matching tests below
// (written before the isActive-gating fix) don't all need updating — the
// gating behavior itself gets its own describe block.
function routine(id, taskDefinitionIds, isActive = true) {
    return { id, name: `Routine ${id}`, habitDefinitionIds: [], taskDefinitionIds, isActive };
}

function instance(definitionId, dueDate) {
    return { type: 'task', definitionId, originalDueDate: new Date(dueDate) };
}

// --- tests -----------------------------------------------------------------

describe('getRoutineTaskInstanceDueTime', () => {
    test('parses an HH:MM defaultDueTime onto the given day', () => {
        const due = getRoutineTaskInstanceDueTime('09:30', DAY);
        expect(due.getHours()).toBe(9);
        expect(due.getMinutes()).toBe(30);
        expect(due.toDateString()).toBe(DAY.toDateString());
    });

    test('zeroes seconds and ms so instances of the same day compare cleanly', () => {
        const messy = new Date(2026, 6, 18, 3, 4, 45, 678);
        const due = getRoutineTaskInstanceDueTime('17:00', messy);
        expect(due.getSeconds()).toBe(0);
        expect(due.getMilliseconds()).toBe(0);
    });

    test('missing defaultDueTime falls back to 17:00 (the form default)', () => {
        const due = getRoutineTaskInstanceDueTime(undefined, DAY);
        expect(due.getHours()).toBe(17);
        expect(due.getMinutes()).toBe(0);
    });

    test('garbage defaultDueTime falls back to 17:00 rather than an Invalid Date', () => {
        const due = getRoutineTaskInstanceDueTime('not-a-time', DAY);
        expect(isNaN(due.getTime())).toBe(false);
        expect(due.getHours()).toBe(17);
    });

    test('handles midnight without falling back', () => {
        const due = getRoutineTaskInstanceDueTime('00:00', DAY);
        expect(due.getHours()).toBe(0);
        expect(due.getMinutes()).toBe(0);
    });
});

describe('selectTaskDefsToSpawn', () => {
    test('THE BUG: a task attached to a routine does get selected to spawn', () => {
        const defs = [taskDef('t1')];
        const routines = [routine('r1', ['t1'])];
        const result = selectTaskDefsToSpawn(defs, routines, [], [], DAY);
        expect(result.map(d => d.id)).toEqual(['t1']);
    });

    test('a definition not attached to any routine is inert', () => {
        const defs = [taskDef('t1'), taskDef('orphan')];
        const routines = [routine('r1', ['t1'])];
        const result = selectTaskDefsToSpawn(defs, routines, [], [], DAY);
        expect(result.map(d => d.id)).toEqual(['t1']);
    });

    test('does not double-spawn when an instance for that day is already active', () => {
        const defs = [taskDef('t1')];
        const routines = [routine('r1', ['t1'])];
        const active = [instance('t1', DAY)];
        expect(selectTaskDefsToSpawn(defs, routines, active, [], DAY)).toHaveLength(0);
    });

    test('does not respawn a task already completed for that day', () => {
        const defs = [taskDef('t1')];
        const routines = [routine('r1', ['t1'])];
        const completed = [instance('t1', DAY)];
        expect(selectTaskDefsToSpawn(defs, routines, [], completed, DAY)).toHaveLength(0);
    });

    test('DOES spawn again on a new day after being completed yesterday', () => {
        const defs = [taskDef('t1')];
        const routines = [routine('r1', ['t1'])];
        const completed = [instance('t1', DAY)];
        const result = selectTaskDefsToSpawn(defs, routines, [], completed, OTHER_DAY);
        expect(result.map(d => d.id)).toEqual(['t1']);
    });

    test('an active instance from a DIFFERENT day does not block today', () => {
        const defs = [taskDef('t1')];
        const routines = [routine('r1', ['t1'])];
        const active = [instance('t1', OTHER_DAY)];
        const result = selectTaskDefsToSpawn(defs, routines, active, [], DAY);
        expect(result.map(d => d.id)).toEqual(['t1']);
    });

    test('a manually-created task (no definitionId) never blocks a routine task', () => {
        const defs = [taskDef('t1')];
        const routines = [routine('r1', ['t1'])];
        const active = [{ type: 'task', originalDueDate: new Date(DAY) }];
        expect(selectTaskDefsToSpawn(defs, routines, active, [], DAY)).toHaveLength(1);
    });

    test('a routine with no taskDefinitionIds array does not throw', () => {
        const defs = [taskDef('t1')];
        const routines = [{ id: 'r1', name: 'legacy', habitDefinitionIds: [] }];
        expect(() => selectTaskDefsToSpawn(defs, routines, [], [], DAY)).not.toThrow();
    });

    test('the same definition shared by two routines spawns only once', () => {
        const defs = [taskDef('t1')];
        const routines = [routine('r1', ['t1']), routine('r2', ['t1'])];
        expect(selectTaskDefsToSpawn(defs, routines, [], [], DAY)).toHaveLength(1);
    });
});

describe('selectTaskDefsToSpawn — isActive gating (2026-07-18 fix)', () => {
    test('a task attached to an INACTIVE routine does not spawn', () => {
        const defs = [taskDef('t1')];
        const routines = [routine('r1', ['t1'], false)];
        expect(selectTaskDefsToSpawn(defs, routines, [], [], DAY)).toHaveLength(0);
    });

    test('a task attached to an ACTIVE routine spawns', () => {
        const defs = [taskDef('t1')];
        const routines = [routine('r1', ['t1'], true)];
        expect(selectTaskDefsToSpawn(defs, routines, [], [], DAY).map(d => d.id)).toEqual(['t1']);
    });

    test('shared by an active AND an inactive routine still spawns (active wins)', () => {
        const defs = [taskDef('t1')];
        const routines = [routine('r1', ['t1'], false), routine('r2', ['t1'], true)];
        expect(selectTaskDefsToSpawn(defs, routines, [], [], DAY)).toHaveLength(1);
    });

    test('a routine missing isActive entirely is treated as inactive, not throwing', () => {
        const defs = [taskDef('t1')];
        const routines = [{ id: 'r1', name: 'legacy', taskDefinitionIds: ['t1'] }];
        expect(() => selectTaskDefsToSpawn(defs, routines, [], [], DAY)).not.toThrow();
        expect(selectTaskDefsToSpawn(defs, routines, [], [], DAY)).toHaveLength(0);
    });
});

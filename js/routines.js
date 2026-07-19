/**
 * Routines — heroes/slots data layer: definition CRUD, routine-task spawn
 * selection, activation/deactivation, and deactivation recall selection
 * (Milestone 2 extraction #6, 2026-07-18).
 *
 * Extracted from script.js. Follows the clock.js/spawning.js/damage.js/
 * habits.js pattern: no closures over script.js state, collaborators and
 * config values arrive as explicit arguments, and script.js keeps thin
 * wrappers so every original call site is unchanged.
 *
 * SCOPE NOTE (see docs/ARCHITECTURE.md / DECISIONS.md 2026-07-18): this
 * module owns "heroes, slots" DATA logic only — routine definition CRUD,
 * routine-task spawn selection, and activation/recall. It deliberately does
 * NOT include the DOM-rendering functions (renderDefinedRoutines,
 * populateRoutinesWindow, showRoutineManagement, populateRoutineHabits,
 * populateRoutineTasks, createRoutineFormHtml, attachRoutineManagementListeners,
 * showAddItemToRoutineModal, updateRoutineDisplay) — those are pure DOM
 * construction with no reusable logic and belong to the future "Extract UI"
 * Milestone 2 item instead. "Frozen recovery" (also named in
 * ARCHITECTURE.md's target layout) isn't built yet at all (Milestone 3 item)
 * so there's nothing to extract for it yet.
 *
 * selectTaskDefsToSpawn matches the hand-maintained mirror
 * test/routine-task-instances.test.js had of this same logic; that file now
 * requires this module instead of keeping its own copy (same dedup habits.js
 * did for test/routine-active-gating.test.js's selectHabitDefsToSpawn mirror).
 * selectActiveItemIdsToClearForRoutine likewise replaces the mirror in
 * test/routine-active-gating.test.js.
 *
 * Behavior-identical extraction — no balance numbers or mechanics changed.
 */
const Routines = (() => {

    // ---------------------------------------------------------------------
    // Pure cores — routine task spawn selection
    // ---------------------------------------------------------------------

    // Task definitions carry a "HH:MM" defaultDueTime rather than the habit
    // system's coarse timeOfDay buckets (see Habits.getHabitInstanceDueTime),
    // so they get their own due-time helper.
    function getRoutineTaskInstanceDueTime(defaultDueTime, referenceDate) {
        const due = new Date(referenceDate);
        due.setSeconds(0, 0);

        const [hours, minutes] = String(defaultDueTime || '17:00').split(':').map(Number);
        if (Number.isFinite(hours) && Number.isFinite(minutes)) {
            due.setHours(hours, minutes);
        } else {
            due.setHours(17, 0); // same fallback the task-definition form defaults to
        }

        return due;
    }

    // Which task definitions should spawn an instance for forWhichGameDay.
    // Only definitions attached to a currently-isActive routine spawn (an
    // orphaned definition, or one whose routine is deactivated, is inert —
    // 2026-07-18 fix, see DECISIONS.md). Dedupes against both "already has a
    // live instance for today" (activeItems scan) and "already completed
    // today" — task definitions have no lastCompletionDate field like habits,
    // so completion is read from completedItems by definitionId + day.
    function selectTaskDefsToSpawn(definedTasks, definedRoutines, activeItems, completedItems, forWhichGameDay) {
        const forWhichGameDayString = forWhichGameDay.toDateString();

        const activeRoutineTaskIds = new Set();
        definedRoutines.forEach(routine => {
            if (!routine.isActive) return;
            (routine.taskDefinitionIds || []).forEach(id => activeRoutineTaskIds.add(id));
        });

        return definedTasks.filter(taskDef => {
            if (!activeRoutineTaskIds.has(taskDef.id)) return false;

            // Recurrence gate (schemaVersion 3, 2026-07-18): routine tasks now
            // carry a schedule. A missing schedule (in-memory def created before
            // this session, or a not-yet-migrated one) normalizes to daily, so
            // the prior "spawns every active day" behavior is preserved.
            if (!Schedule.isScheduledForDay(taskDef.schedule, forWhichGameDay)) return false;

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

    // ---------------------------------------------------------------------
    // Instance creation (id + timeline position arrive via deps, matching
    // the accessor-dep pattern damage.js/spawning.js/habits.js use for
    // script.js-owned state — itemIdCounter is a script.js `let`, not owned
    // here).
    // ---------------------------------------------------------------------

    // deps = {
    //   getNextId,                       // () -> number (itemIdCounter++ in script.js)
    //   gameScreenWidth,                  // GAME_SCREEN_WIDTH
    //   enemyWidth,                       // CONFIG.ENEMY_WIDTH
    //   calculateTimelineXWithClustering, // (item, now) -> px
    // }
    function createRoutineTaskInstanceData(taskDef, forDate, deps) {
        const instanceCreationTime = new Date();
        const dueDateTime = getRoutineTaskInstanceDueTime(taskDef.defaultDueTime, forDate);

        const taskInstanceData = {
            id: deps.getNextId(),
            type: 'task',
            definitionId: taskDef.id,
            name: taskDef.name,
            category: taskDef.category || 'other',
            isHighPriority: taskDef.isHighPriority || false,
            dueDateTime: dueDateTime,
            creationTime: instanceCreationTime,
            timeToDueAtCreationMs: Math.max(0, dueDateTime.getTime() - instanceCreationTime.getTime()),
            x: deps.gameScreenWidth - deps.enemyWidth, // recalculated below
            isOverdue: false,
            lastDamageTickTime: null,
            element: null,
            listItemElement: null,
            // Sub-task hierarchy fields — a routine task is a top-level task and
            // can take sub-tasks like any other.
            parentId: undefined,
            subTasks: [],
            completedSubTasks: 0,
            totalSubTasks: 0,
            originalDueDate: new Date(dueDateTime),
            offlineDamageCharged: 0
        };

        taskInstanceData.x = deps.calculateTimelineXWithClustering(taskInstanceData, instanceCreationTime);

        return taskInstanceData;
    }

    // Orchestrates selection + instantiation + admission for one day, mirroring
    // Habits.generateDailyHabitInstances. DOM admission (addItemToGame) and the
    // id/position collaborators are injected via deps.
    // deps extends createRoutineTaskInstanceData's deps with:
    //   definedTasks, definedRoutines, activeItems, completedItems,
    //   addItemToGame, sortAndRenderActiveList
    function generateDailyRoutineTaskInstances(forWhichGameDay, deps) {
        const toSpawn = selectTaskDefsToSpawn(
            deps.definedTasks, deps.definedRoutines, deps.activeItems, deps.completedItems, forWhichGameDay
        );

        toSpawn.forEach(taskDef => {
            const taskInstanceData = createRoutineTaskInstanceData(taskDef, forWhichGameDay, deps);
            deps.addItemToGame(taskInstanceData);
        });

        deps.sortAndRenderActiveList();
    }

    // ---------------------------------------------------------------------
    // Routine definition CRUD
    // ---------------------------------------------------------------------

    // Validates + builds a new routine object. Returns { ok: false, reason }
    // ('empty'|'duplicate') on failure so callers can alert appropriately, or
    // { ok: true, routine } on success. Does NOT push — callers own that so
    // they control save/render/close ordering around it (matches the two
    // existing call sites, which differ in what they do after creating).
    function createRoutineDefinition(name, definedRoutines) {
        const trimmedName = (name || '').trim();
        if (!trimmedName) {
            return { ok: false, reason: 'empty' };
        }

        if (definedRoutines.some(r => r.name.toLowerCase() === trimmedName.toLowerCase())) {
            return { ok: false, reason: 'duplicate' };
        }

        const routine = {
            id: `routine_${definedRoutines.length}_${Date.now()}`,
            name: trimmedName,
            habitDefinitionIds: [],
            taskDefinitionIds: [],
            isActive: false,
            // Frozen routine slots (schemaVersion 6, 2026-07-19): null = not
            // frozen. See js/frozenSlots.js.
            frozenState: null
        };

        return { ok: true, routine };
    }

    // Removes a routine by id (mutates definedRoutines in place). FIRST
    // recalls any of its currently-active habit/task instances from the
    // board (the same clearActiveInstancesForRoutine path deactivation uses
    // — bugfix found live 2026-07-18: deleting a routine used to leave its
    // sprites/agenda rows stranded, pointing at a routine that no longer
    // existed. A delete is a superset of a deactivation, so it gets the same
    // recall. See DECISIONS.md.). Returns the removed routine, or null if
    // not found. Caller owns the confirm() dialog before calling and
    // save/render after.
    // deps = { definedRoutines, activeItems, removeItem }
    function deleteRoutine(routineId, deps) {
        const routineIndex = deps.definedRoutines.findIndex(r => r.id === routineId);
        if (routineIndex === -1) return null;

        clearActiveInstancesForRoutine(routineId, deps);

        const [removed] = deps.definedRoutines.splice(routineIndex, 1);
        return removed;
    }

    // Mutates routine.habitDefinitionIds in place. Returns true if removed.
    // definedHabits is optional only for backward compatibility with older
    // callers; pass it so the habit is correctly released to standalone.
    function removeHabitFromRoutine(routineId, habitDefId, definedRoutines, definedHabits) {
        const routine = definedRoutines.find(r => r.id === routineId);
        if (!routine) return false;

        const habitIndex = routine.habitDefinitionIds.indexOf(habitDefId);
        if (habitIndex === -1) return false;

        routine.habitDefinitionIds.splice(habitIndex, 1);

        // Removing a habit from a routine makes it STANDALONE (Jeremy's call,
        // 2026-07-18 — see DECISIONS.md), so it keeps its streak and resumes
        // spawning daily on its own. This deliberately supersedes the earlier
        // same-day "orphaned definitions stay inert" decision, which predates
        // standalone habits being distinguishable from orphaned ones at all.
        if (definedHabits) {
            const habitDef = definedHabits.find(h => h.id === habitDefId);
            if (habitDef) habitDef.routineId = null;
        }

        return true;
    }

    // Mutates routine.taskDefinitionIds in place. Returns true if removed.
    function removeTaskFromRoutine(routineId, taskId, definedRoutines) {
        const routine = definedRoutines.find(r => r.id === routineId);
        if (!routine || !routine.taskDefinitionIds) return false;

        const taskIndex = routine.taskDefinitionIds.indexOf(taskId);
        if (taskIndex === -1) return false;

        routine.taskDefinitionIds.splice(taskIndex, 1);
        return true;
    }

    // Builds + registers a new habit definition under a routine (mutates
    // definedHabits and routine.habitDefinitionIds in place). Returns the new
    // habit def, or null if the routine doesn't exist.
    function createNewHabitInRoutine(routineId, habitData, definedRoutines, definedHabits) {
        const routine = definedRoutines.find(r => r.id === routineId);
        if (!routine) return null;

        const newHabit = {
            id: `habitDef_${definedHabits.length}_${Date.now()}`,
            name: habitData.name,
            category: habitData.category,
            // schemaVersion 3 (2026-07-18): recurrence is a `schedule` object.
            // Prefers a full schedule from the scheduling UI (session 15);
            // falls back to converting a legacy bare frequency string for any
            // older caller.
            schedule: habitData.schedule ? Schedule.normalize(habitData.schedule) : Schedule.fromLegacyFrequency(habitData.frequency),
            timeOfDay: habitData.timeOfDay,
            isNegative: habitData.isNegative || false,
            // Owned by this routine — only spawns while the routine isActive.
            routineId: routineId,
            streak: 0,
            lastCompletionDate: null,
            occurrenceHistory: [],
            // Frozen routine slots (schemaVersion 6, 2026-07-19): recovery
            // path 1 (edit-to-unfreeze) appends to this. See js/frozenSlots.js.
            modificationHistory: []
        };

        definedHabits.push(newHabit);
        routine.habitDefinitionIds.push(newHabit.id);

        return newHabit;
    }

    // Builds + registers a new task definition under a routine (mutates
    // definedTasks and routine.taskDefinitionIds in place). Returns the new
    // task def, or null if the routine doesn't exist.
    function createNewTaskInRoutine(routineId, taskData, definedRoutines, definedTasks) {
        const routine = definedRoutines.find(r => r.id === routineId);
        if (!routine) return null;

        if (!routine.taskDefinitionIds) routine.taskDefinitionIds = [];

        const newTaskDef = {
            id: `taskDef_${Date.now()}`,
            name: taskData.name,
            category: taskData.category,
            isHighPriority: taskData.isHighPriority,
            defaultDueTime: taskData.defaultDueTime || '17:00',
            // schemaVersion 3 (2026-07-18): routine tasks gained recurrence.
            // Default daily (all 7 days) preserves the prior "spawns every day
            // the routine is active" behavior. taskData carries no schedule
            // until the scheduling UI lands.
            schedule: Schedule.normalize(taskData.schedule)
        };

        definedTasks.push(newTaskDef);
        routine.taskDefinitionIds.push(newTaskDef.id);

        return newTaskDef;
    }

    // Mutates the matching habit definition in place. Returns true if found.
    function editHabitInRoutine(habitId, updatedData, definedHabits) {
        const habit = definedHabits.find(h => h.id === habitId);
        if (!habit) return false;

        habit.name = updatedData.name;
        habit.category = updatedData.category;
        // schemaVersion 3: store recurrence as a schedule. If the edit form
        // passed a full schedule (future UI), use it; otherwise convert its
        // legacy frequency string.
        habit.schedule = updatedData.schedule
            ? Schedule.normalize(updatedData.schedule)
            : Schedule.fromLegacyFrequency(updatedData.frequency);
        habit.timeOfDay = updatedData.timeOfDay;
        habit.isNegative = updatedData.isNegative;

        return true;
    }

    // Mutates the matching task definition in place. Returns true if found.
    function editTaskInRoutine(taskId, updatedData, definedTasks) {
        if (!definedTasks) return false;
        const task = definedTasks.find(t => t.id === taskId);
        if (!task) return false;

        task.name = updatedData.name;
        task.category = updatedData.category;
        task.isHighPriority = updatedData.isHighPriority;
        task.defaultDueTime = updatedData.defaultDueTime;
        // schemaVersion 3 (2026-07-18, session 15): routine tasks gained a
        // schedule. Preserves the existing schedule if the caller doesn't
        // provide one (rather than silently resetting a custom weekly/monthly
        // pick to daily on every edit) — mirrors editHabitInRoutine's
        // schedule-preferred, frequency-fallback pattern, but with no
        // frequency fallback to fall back TO here (routine tasks never had a
        // bare frequency field), so an absent schedule keeps whatever the
        // task already had.
        if (updatedData.schedule) {
            task.schedule = Schedule.normalize(updatedData.schedule);
        } else if (!task.schedule) {
            task.schedule = Schedule.defaultSchedule();
        }

        return true;
    }

    // Attaches an EXISTING habit definition to a routine. Returns
    // { ok: false, reason } ('not-found'|'already-in-routine') or
    // { ok: true }.
    function addHabitToRoutine(routineId, habitDefId, definedRoutines, definedHabits) {
        const routine = definedRoutines.find(r => r.id === routineId);
        const habitDef = definedHabits.find(h => h.id === habitDefId);

        if (!routine || !habitDef) {
            return { ok: false, reason: 'not-found' };
        }

        if (routine.habitDefinitionIds.includes(habitDefId)) {
            return { ok: false, reason: 'already-in-routine' };
        }

        routine.habitDefinitionIds.push(habitDefId);
        // Adopting an existing (standalone) habit into a routine transfers
        // ownership, so it's now gated on this routine's isActive.
        habitDef.routineId = routineId;
        return { ok: true };
    }

    // ---------------------------------------------------------------------
    // Activation / deactivation + deactivation recall
    // ---------------------------------------------------------------------

    // The selection half of clearActiveInstancesForRoutine below — which
    // active items get recalled when a routine is deactivated, and in what
    // order. Kept separate from removeItem's DOM/state work so it's testable
    // without a DOM (matches the Spawning.addItemToGame precedent — see
    // ARCHITECTURE.md).
    // Sub-tasks are cascaded ahead of their parent so nothing is left
    // pointing at a parent that no longer exists.
    function selectActiveItemIdsToClearForRoutine(activeItemsList, routine) {
        const habitDefIds = new Set(routine.habitDefinitionIds || []);
        const taskDefIds = new Set(routine.taskDefinitionIds || []);

        const rootIds = activeItemsList
            .filter(item =>
                (item.type === 'habit' && habitDefIds.has(item.definitionId)) ||
                (item.type === 'task' && taskDefIds.has(item.definitionId))
            )
            .map(item => item.id);

        const rootIdSet = new Set(rootIds);
        const subTaskIds = activeItemsList
            .filter(item => item.parentId !== undefined && rootIdSet.has(item.parentId))
            .map(item => item.id);

        return [...subTaskIds, ...rootIds];
    }

    // Deactivating a routine (2026-07-18 fix, decided with Jeremy) recalls its
    // currently-active habit/task instances from the board immediately, on top
    // of the isActive spawn-gating above. Recalled items are NOT completed and
    // NOT counted — no XP/points/streak change, no damage penalty. This is a
    // pure removal ("the routine went on vacation"), not "the player finished
    // them." Uses the existing removeItem() (injected via deps) so DOM
    // cleanup, activeItems bookkeeping, and persistence all go through the one
    // path every other removal uses.
    // deps = { definedRoutines, activeItems, removeItem }
    function clearActiveInstancesForRoutine(routineId, deps) {
        const routine = deps.definedRoutines.find(r => r.id === routineId);
        if (!routine) return;

        selectActiveItemIdsToClearForRoutine(deps.activeItems, routine).forEach(id => deps.removeItem(id));
    }

    // deps = {
    //   definedRoutines, routineSlots, activeItems, removeItem, alert,
    //   generateDailyHabitInstances, generateDailyRoutineTaskInstances,
    //   currentGameDate, saveGame
    // }
    function toggleRoutineActive(routineId, deps) {
        const routine = deps.definedRoutines.find(r => r.id === routineId);
        if (!routine) return;

        const activeRoutines = deps.definedRoutines.filter(r => r.isActive).length;

        if (!routine.isActive && activeRoutines >= deps.routineSlots) {
            deps.alert(`You can only have ${deps.routineSlots} active routine${deps.routineSlots !== 1 ? 's' : ''} at your current level.`);
            return;
        }

        const wasActive = routine.isActive;
        routine.isActive = !routine.isActive;

        if (wasActive && !routine.isActive) {
            clearActiveInstancesForRoutine(routineId, deps);
        } else if (!wasActive && routine.isActive) {
            // Spawning today's due instances immediately on activation is the
            // symmetric counterpart to the immediate recall above (2026-07-18
            // fix — see DECISIONS.md).
            deps.generateDailyHabitInstances(deps.currentGameDate);
            deps.generateDailyRoutineTaskInstances(deps.currentGameDate);
        }

        deps.saveGame();
    }

    return {
        getRoutineTaskInstanceDueTime,
        selectTaskDefsToSpawn,
        createRoutineTaskInstanceData,
        generateDailyRoutineTaskInstances,
        createRoutineDefinition,
        deleteRoutine,
        removeHabitFromRoutine,
        removeTaskFromRoutine,
        createNewHabitInRoutine,
        createNewTaskInRoutine,
        editHabitInRoutine,
        editTaskInRoutine,
        addHabitToRoutine,
        selectActiveItemIdsToClearForRoutine,
        clearActiveInstancesForRoutine,
        toggleRoutineActive,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Routines;
}

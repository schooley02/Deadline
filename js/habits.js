/**
 * Habits — habit instance creation, daily spawn selection, and streak math
 * (Milestone 2 extraction #5, 2026-07-18).
 *
 * Extracted from script.js. Follows the clock.js/spawning.js/damage.js
 * pattern: no closures over script.js state, collaborators and config values
 * arrive as explicit arguments, and script.js keeps thin wrappers so every
 * call site (createHabitDefinition, generateDailyHabitInstances,
 * completeItem, uncompleteItem, markAsOverdue) is unchanged.
 *
 * Behavior-identical extraction — no balance numbers changed. ONE KNOWN
 * PRE-EXISTING BUG IS DELIBERATELY PRESERVED, not fixed here (see
 * DECISIONS.md 2026-07-18 "streak-bonus asymmetry"): applyHabitCompletion
 * increments the streak THEN computes the bonus from the NEW streak;
 * applyHabitUncompletion decrements THEN computes the refund from the
 * LOWERED streak. Crossing the bonus threshold and then uncompleting nets
 * the player +bonus points they shouldn't keep. Flagged as its own ROADMAP
 * bugfix item rather than bundled into this extraction.
 *
 * selectHabitDefsToSpawn matches the hand-maintained mirror that
 * test/routine-active-gating.test.js had of this same logic (written the
 * session isActive-gating was added, before this extraction existed) —
 * that test file now requires this module instead of keeping its own copy.
 */
const Habits = (() => {

    // ---------------------------------------------------------------------
    // Pure cores
    // ---------------------------------------------------------------------

    // Habit instances use coarse timeOfDay buckets (unlike routine tasks,
    // which parse an HH:MM defaultDueTime — see getRoutineTaskInstanceDueTime
    // in script.js).
    function getHabitInstanceDueTime(timeOfDayString, referenceDate) {
        const due = new Date(referenceDate);
        due.setSeconds(0, 0);

        switch (timeOfDayString) {
            case 'morning':
                due.setHours(12, 0);
                break;
            case 'afternoon':
                due.setHours(17, 0);
                break;
            case 'evening':
                due.setHours(22, 0);
                break;
            default:
                due.setHours(23, 59);
                break;
        }

        return due;
    }

    // Which habit definitions should spawn an instance for forWhichGameDay.
    //
    // Routine membership is carried by habitDef.routineId (null = standalone),
    // matching docs/DATA_SCHEMA.md's Habit shape. Gating (2026-07-18, revised
    // same day — see DECISIONS.md):
    //   - STANDALONE habits (routineId null/undefined) always spawn. These are
    //     the FAB-created ones; they have no routine to gate on.
    //   - ROUTINE habits spawn only while their routine is isActive, so
    //     deactivating a routine stops future spawns.
    //   - A DANGLING routineId (routine was deleted) resolves to standalone,
    //     rather than leaving a habit that's listed in the Habits window but
    //     can never spawn.
    // The original 2026-07-18 rule was "only spawn habits in an active
    // routine", which was aimed at orphaned definitions but also silently
    // blocked every standalone habit — the bug this replaces.
    //
    // Dedupes against both "already completed today"
    // (habitDef.lastCompletionDate) and "already has a live instance for
    // today" (activeItems scan).
    function selectHabitDefsToSpawn(definedHabits, definedRoutines, activeItems, forWhichGameDay) {
        const forWhichGameDayString = forWhichGameDay.toDateString();

        return definedHabits.filter(habitDef => {
            // A habit is owned by a routine if that routine lists it OR the
            // habit points at it. Both are checked so the two representations
            // can't disagree, and so a habit shared by several routines still
            // works (membership is many-to-many today even though routineId
            // names a single owner).
            const owningRoutines = definedRoutines.filter(r =>
                (r.habitDefinitionIds || []).includes(habitDef.id) ||
                (habitDef.routineId != null && r.id === habitDef.routineId)
            );

            // No owner at all => standalone (or orphaned, or its routine was
            // deleted) => spawns on its own. Otherwise at least one owning
            // routine must be active — so "shared by an active and an inactive
            // routine" still spawns.
            if (owningRoutines.length > 0 && !owningRoutines.some(r => r.isActive)) return false;

            if (habitDef.frequency !== 'daily') return false;

            const lastCompletionDayString = habitDef.lastCompletionDate
                ? new Date(habitDef.lastCompletionDate).toDateString()
                : null;
            const alreadyCompletedForThisGameDay = lastCompletionDayString === forWhichGameDayString;

            const existingActiveInstance = activeItems.find(item =>
                item.type === 'habit' &&
                item.definitionId === habitDef.id &&
                item.originalDueDate &&
                new Date(item.originalDueDate).toDateString() === forWhichGameDayString
            );

            return !alreadyCompletedForThisGameDay && !existingActiveInstance;
        });
    }

    // Streak/points math for completing a habit instance. Takes the CURRENT
    // streak (not the definition object) and returns the new streak plus
    // rewards; script.js applies the result to habitDef and playerXP/Points.
    // config = { xpPerHabitComplete, pointsPerHabit, streakBonusThreshold, streakBonusPoints }
    function applyHabitCompletion(currentStreak, originalDueDate, config) {
        const streak = currentStreak + 1;
        const pointsGained = config.pointsPerHabit +
            (streak >= config.streakBonusThreshold ? config.streakBonusPoints : 0);

        return {
            streak,
            lastCompletionDate: new Date(originalDueDate),
            xpGained: config.xpPerHabitComplete,
            pointsGained,
        };
    }

    // Reverse of applyHabitCompletion (uncompleting a habit). Preserves the
    // original code's asymmetry on purpose — see file header/DECISIONS.md.
    function applyHabitUncompletion(currentStreak, config) {
        const streak = Math.max(0, currentStreak - 1);
        const pointsLost = config.pointsPerHabit +
            (streak >= config.streakBonusThreshold ? config.streakBonusPoints : 0);

        return {
            streak,
            lastCompletionDate: null,
            xpLost: config.xpPerHabitComplete,
            pointsLost,
        };
    }

    // An overdue habit instance zeroes its definition's streak. Pure: just
    // decides the new streak and whether anything actually changed (so
    // script.js only touches the DOM — streak badge text, high-streak class
    // — when a reset actually happened, matching the original's guard).
    function resetStreakOnOverdue(currentStreak) {
        const wasReset = currentStreak > 0;
        return { streak: 0, wasReset };
    }

    // ---------------------------------------------------------------------
    // Instance creation (id + timeline position arrive via deps, matching
    // the accessor-dep pattern damage.js/spawning.js use for script.js-owned
    // state — itemIdCounter is a script.js `let`, not owned here).
    // ---------------------------------------------------------------------

    // deps = {
    //   getNextId,                // () -> number   (itemIdCounter++ in script.js)
    //   calculateTimelinePosition,// (item, now) -> px  (script.js's Clock wrapper)
    //   gameScreenWidth,          // GAME_SCREEN_WIDTH
    //   habitEnemyWidth,          // CONFIG.HABIT_ENEMY_WIDTH
    // }
    function createHabitInstanceData(habitDef, forDate, deps) {
        const instanceCreationTime = new Date();
        const targetInstanceDate = new Date(forDate);
        const dueDateTime = getHabitInstanceDueTime(habitDef.timeOfDay, targetInstanceDate);

        const habitInstanceData = {
            id: deps.getNextId(),
            type: 'habit',
            definitionId: habitDef.id,
            name: habitDef.name,
            category: habitDef.category,
            isHighPriority: false,
            dueDateTime: dueDateTime,
            creationTime: instanceCreationTime,
            timeToDueAtCreationMs: Math.max(0, dueDateTime.getTime() - instanceCreationTime.getTime()),
            x: deps.gameScreenWidth - deps.habitEnemyWidth, // Will be recalculated below
            isOverdue: false,
            lastDamageTickTime: null,
            streak: habitDef.streak,
            isNegative: habitDef.isNegative,
            element: null,
            listItemElement: null,
            originalDueDate: new Date(dueDateTime),
            // Cumulative offline overdue damage ever charged — see createTaskItemData.
            offlineDamageCharged: 0
        };

        habitInstanceData.x = deps.calculateTimelinePosition(habitInstanceData, instanceCreationTime);

        return habitInstanceData;
    }

    // Orchestrates selection + instantiation + admission for one day. DOM
    // admission (addItemToGame) and the id/position collaborators are
    // injected via deps so this stays behavior-identical to the original
    // generateDailyHabitInstances.
    // deps extends createHabitInstanceData's deps with:
    //   definedHabits, definedRoutines, activeItems, addItemToGame, sortAndRenderActiveList
    function generateDailyHabitInstances(forWhichGameDay, deps) {
        const forWhichGameDayString = forWhichGameDay.toDateString();
        const toSpawn = selectHabitDefsToSpawn(deps.definedHabits, deps.definedRoutines, deps.activeItems, forWhichGameDay);

        toSpawn.forEach(habitDef => {
            const habitInstanceData = createHabitInstanceData(habitDef, forWhichGameDay, deps);
            if (habitInstanceData && habitInstanceData.originalDueDate.toDateString() === forWhichGameDayString) {
                deps.addItemToGame(habitInstanceData);
            }
        });

        deps.sortAndRenderActiveList();
    }

    return {
        getHabitInstanceDueTime,
        selectHabitDefsToSpawn,
        applyHabitCompletion,
        applyHabitUncompletion,
        resetStreakOnOverdue,
        createHabitInstanceData,
        generateDailyHabitInstances,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Habits;
}

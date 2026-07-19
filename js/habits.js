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
 * RATE-BASED POINTS BONUS (session 16, 2026-07-18 — decided session 13,
 * see DECISIONS.md + docs/MECHANICS.md). The old flat streak-threshold bonus
 * is GONE: streak is now purely visual (on-fire sprite/badge), and a habit's
 * points award is instead multiplied by a factor derived from its rolling
 * success rate over its last HABIT_RATE_WINDOW scheduled occurrences
 * (occurrenceHistory on the habit definition). Points only, never XP. This
 * also structurally dissolves the old streak-bonus refund-asymmetry bug —
 * uncompletion computes its refund from the SAME history state completion
 * awarded from (recompute-then-pop), so refunds mirror awards by construction.
 *
 * POLARITY-READY (Jeremy's call, session 16): occurrence success is routed
 * through the single `occurrenceSuccess(isNegative, event)` helper. Today both
 * polarities map completed→success / overdue→miss (for a negative habit,
 * "completed" means "I avoided it today"). The genuinely-inverted negative
 * path — an explicit "indulged" action that costs points, the daily check-in
 * prompt, frozen-slot ties — is [P1-DATA-005] (Milestone 3), unbuilt; when it
 * lands it only has to add an 'indulged' event to this one helper, no rework
 * of the rate math. See DECISIONS.md 2026-07-18 (session 16).
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

            // Recurrence gate (schemaVersion 3, 2026-07-18): the habit must be
            // scheduled for this day. Schedule.normalize tolerates a legacy
            // bare `frequency` string too, so an unmigrated in-memory def can't
            // slip through. Replaces the old `frequency !== 'daily'` check.
            if (!Schedule.isScheduledForDay(habitDef.schedule || habitDef.frequency, forWhichGameDay)) return false;

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

    // -------------------------------------------------------------------------
    // Rate-based points bonus (session 16). All pure — no DOM, no globals.
    // -------------------------------------------------------------------------

    // Local YYYY-MM-DD key for an occurrence. Uses local calendar fields (not
    // toISOString) so a habit's "day" matches the player's wall clock, same
    // reasoning as the popups.js/forms.js UTC pre-fill fixes (DECISIONS.md).
    function toOccurrenceDate(date) {
        const d = new Date(date);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    // The single polarity-aware routing point (see file header). event is
    // 'completed' | 'overdue'. Today isNegative doesn't change the outcome —
    // it's the explicit extension seam for [P1-DATA-005]'s future 'indulged'
    // event, so that feature never has to touch the rate math.
    function occurrenceSuccess(isNegative, event) {
        switch (event) {
            case 'completed': return true;  // positive: did it; negative: avoided it
            case 'overdue':   return false; // positive: missed; negative: lapsed
            default:          return false;
        }
    }

    // Upsert an occurrence by date (a late completion overwrites that day's
    // earlier overdue miss — "completed late still counts as done"), then keep
    // only the most recent windowSize entries. Pure: returns a new array.
    function recordOccurrence(history, dateStr, success, windowSize) {
        const base = Array.isArray(history) ? history.slice() : [];
        const idx = base.findIndex(o => o.date === dateStr);
        if (idx >= 0) {
            base[idx] = { date: dateStr, success };
        } else {
            base.push({ date: dateStr, success });
        }
        return windowSize > 0 ? base.slice(-windowSize) : base;
    }

    // Remove any occurrence for the given date (reverses recordOccurrence for
    // that day). Pure: returns a new array.
    function removeOccurrence(history, dateStr) {
        return (Array.isArray(history) ? history : []).filter(o => o.date !== dateStr);
    }

    // Fraction of recorded occurrences that were successes, or null if empty.
    function successRate(history) {
        const h = Array.isArray(history) ? history : [];
        if (h.length === 0) return null;
        return h.filter(o => o.success).length / h.length;
    }

    // The points multiplier for the current history. 1× until minSample
    // occurrences exist; otherwise the first tier (checked high-to-low) whose
    // minRate the success rate meets, else 1×. config = { minSample, tiers }.
    function pointsMultiplier(history, config) {
        const h = Array.isArray(history) ? history : [];
        if (h.length < config.minSample) return 1;
        const rate = successRate(h);
        for (const tier of config.tiers) {
            if (rate >= tier.minRate) return tier.multiplier;
        }
        return 1;
    }

    // -------------------------------------------------------------------------
    // Completion / uncompletion / overdue — streak (visual) + rate-based points.
    // Each takes the CURRENT streak and occurrenceHistory and returns the new
    // values (plus the applied multiplier, for display/tests); items.js applies
    // them to the habitDef and playerXP/Points.
    // config = { xpPerHabitComplete, pointsPerHabit, rateWindow, rateMinSample, rateTiers }
    // -------------------------------------------------------------------------
    function applyHabitCompletion(currentStreak, occurrenceHistory, isNegative, originalDueDate, config) {
        const dateStr = toOccurrenceDate(originalDueDate);
        const history = recordOccurrence(
            occurrenceHistory, dateStr, occurrenceSuccess(isNegative, 'completed'), config.rateWindow
        );
        const multiplier = pointsMultiplier(history, { minSample: config.rateMinSample, tiers: config.rateTiers });
        const pointsGained = Math.round(config.pointsPerHabit * multiplier);

        return {
            streak: currentStreak + 1,
            lastCompletionDate: new Date(originalDueDate),
            occurrenceHistory: history,
            xpGained: config.xpPerHabitComplete,
            pointsGained,
            multiplier,
        };
    }

    // Reverse of applyHabitCompletion. Symmetric by construction: the multiplier
    // is computed from the CURRENT history (which still contains today's success
    // entry that completion added), so the refund equals the award, THEN today's
    // entry is popped. This is why the old refund-asymmetry bug can't recur.
    function applyHabitUncompletion(currentStreak, occurrenceHistory, isNegative, originalDueDate, config) {
        const multiplier = pointsMultiplier(occurrenceHistory, { minSample: config.rateMinSample, tiers: config.rateTiers });
        const pointsLost = Math.round(config.pointsPerHabit * multiplier);
        const dateStr = toOccurrenceDate(originalDueDate);
        const history = removeOccurrence(occurrenceHistory, dateStr);

        return {
            streak: Math.max(0, currentStreak - 1),
            lastCompletionDate: null,
            occurrenceHistory: history,
            xpLost: config.xpPerHabitComplete,
            pointsLost,
            multiplier,
        };
    }

    // An overdue habit instance zeroes its definition's streak (visual) AND
    // records a miss occurrence for the rate bonus. Pure: returns the new streak,
    // whether the streak actually changed (so items.js only touches the DOM when
    // it did, matching the original guard), and the new occurrenceHistory.
    function applyHabitOverdue(currentStreak, occurrenceHistory, isNegative, originalDueDate, windowSize) {
        const dateStr = toOccurrenceDate(originalDueDate);
        const history = recordOccurrence(
            occurrenceHistory, dateStr, occurrenceSuccess(isNegative, 'overdue'), windowSize
        );
        return { streak: 0, wasReset: currentStreak > 0, occurrenceHistory: history };
    }

    // Streak-only reset (no occurrence recording). Retained for callers/tests
    // that only need the visual streak decision; applyHabitOverdue wraps this
    // conceptually but records the occurrence too.
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
        // rate-based bonus (session 16)
        toOccurrenceDate,
        occurrenceSuccess,
        recordOccurrence,
        removeOccurrence,
        successRate,
        pointsMultiplier,
        applyHabitCompletion,
        applyHabitUncompletion,
        applyHabitOverdue,
        resetStreakOnOverdue,
        createHabitInstanceData,
        generateDailyHabitInstances,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Habits;
}

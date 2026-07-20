/**
 * Items — task/habit completion lifecycle (Milestone 2 extraction, session 10,
 * 2026-07-18).
 *
 * RESCOPED SESSION: this was never part of the 11-session UI extraction plan
 * (docs/UI_EXTRACTION_PLAN.md covers DOM-rendering clusters A-G only). A fresh
 * Grep during session 10's planning found ~700-800 lines of core game logic
 * still sitting directly in script.js that no prior session had touched —
 * this is `items.js`/`state.js` scope from docs/ARCHITECTURE.md's target
 * layout. Jeremy's call: extract now rather than defer, split across three
 * sessions (see ROADMAP.md) to keep the one-system-per-session rule. This is
 * session 10's slice — the most self-contained of the three (touches
 * activeItems/completedItems/player stats only, no game-loop timing).
 *
 * Extracted: `createTaskItemData`, `completeItem`, `removeItem`,
 * `uncompleteItem`, `markAsOverdue`, `recomputeOverdueStateAfterEdit`.
 * These six call each other directly (module-internal) where the original
 * code did — e.g. `completeItem`'s fade-out setTimeout calls `removeItem`,
 * `uncompleteItem` and `recomputeOverdueStateAfterEdit` both call
 * `markAsOverdue`.
 *
 * DEPENDENCY NOTES:
 * - `activeItems` is a plain reference — matches agendaListDeps()'s
 *   established "stable binding" precedent (session 6-7), even though it's
 *   reassigned on new-game reset.
 * - `completedItems`/`definedHabits` are GETTERS — both are REASSIGNED
 *   elsewhere in script.js (new-game reset, restoreGameState), matching the
 *   precedent from agendaList.js part 2 / routineViews.js.
 * - `gameIsOver` is a GETTER (`isGameOver: () => gameIsOver`) for the same
 *   reason js/spawning.js and js/ui/agendaList.js use one: this module's
 *   effects (e.g. completeItem bailing out) must see live state, not a
 *   snapshot from when the deps object was built.
 * - `playerXP`/`playerPoints` get accessor pairs (getPlayerXP/setPlayerXP,
 *   getPlayerPoints/setPlayerPoints) rather than plain values, following
 *   js/damage.js's precedent for script.js-owned state that a module needs
 *   to WRITE (baseHealth/gameIsOver there; playerXP/playerPoints here) —
 *   ownership stays in script.js, this module just gets read/write access.
 * - `gameScreenWidth`/`baseWidth`/`enemyWidth`/`habitEnemyWidth` are plain
 *   values rebuilt fresh in script.js's itemsDeps() on every call, matching
 *   js/damage.js's damageDeps() comment: these aren't resolved until
 *   initGame() runs, so a deps object built once at module-load time would
 *   be stale.
 * - `Habits` (applyHabitCompletion/applyHabitUncompletion/applyHabitOverdue)
 *   and `CONFIG` (HABIT_RATE_WINDOW/MIN_SAMPLE/TIERS — the rate-based bonus,
 *   session 16) are called as bare stable globals — both are fully-extracted
 *   modules guaranteed loaded first, matching the CONFIG/Clock/Modal/Routines
 *   convention elsewhere in js/. `habitStreakBonusThreshold` still arrives via
 *   deps but is now VISUAL-only (the high-streak/on-fire class), not points.
 * - Everything else (handleEnemyClick, createListItem, sortAndRenderActiveList,
 *   resetAllSubTaskCheckboxes, updateTaskCountDisplay, renderCompletedItems,
 *   updatePlayerDisplays, checkPlayerLevelUp, saveGame,
 *   calculateTimelineXWithClustering, getSubTaskClusterOffset,
 *   getItemTopPosition) arrives as plain function-reference deps — all are
 *   still script.js-scoped (many are themselves thin wrappers over other
 *   already-extracted modules).
 *
 * FLAGGED, NOT FIXED: `uncompleteItem` hand-builds the enemy sprite DOM
 * element (classes, dimensions, click handler) instead of reusing
 * `Spawning.addItemToGame`/`resolveEnemyVisual`, which already do this
 * correctly and are the only other place this construction happens. This is
 * pre-existing duplication, extracted verbatim — consolidating it is a
 * separate, real refactor (behavior-risk: `addItemToGame` pushes into
 * activeItems itself, which `uncompleteItem` also does manually, so
 * reconciling the two needs its own careful session), not bundled into this
 * code-motion extraction. See docs/DECISIONS.md.
 */
const Items = (() => {

    // [P1-DATA-005] session 27/28 — the single canonical definition of "this
    // item is a negative-habit lurker": never advances, never goes overdue,
    // never damages the base (see docs/NEGATIVE_HABITS_PLAN.md sub-session 2a,
    // DECISIONS.md session 26's A2 model). markAsOverdue below uses it
    // directly (same file, no cross-module reference needed); js/loop.js and
    // js/damage.js — which load BEFORE this file and can't reference `Items`
    // as a bare global at definition time, plus have their own pure-function/
    // deps-only conventions — receive it as an injected `isNonThreatening`
    // collaborator (see loopDeps()/damageDeps() in script.js) rather than
    // duplicating the check, so there is still exactly one implementation.
    function isNonThreatening(item) {
        return item.type === 'habit' && item.isNegative === true;
    }

    // --- Frozen routine slots ("Frozen routine slots + recovery" ticket,
    // sub-session 1, 2026-07-19; see js/frozenSlots.js + docs/ROUTINES.md).
    //
    // Both helpers are no-ops for a standalone negative habit
    // (habitDef.routineId == null) — there's no routine to freeze, and debt
    // + streak already punish a standalone lapse. `deps.definedRoutines` is
    // OPTIONAL — existing deps objects (and every pre-existing test) that
    // don't build one simply see no routine and no-op, matching the
    // "collaborator omitted -> inline equivalent" precedent js/damage.js set
    // in session 28 rather than requiring every call site to be touched.
    function findOwningRoutine(habitDef, deps) {
        if (!habitDef || habitDef.routineId == null) return null;
        const definedRoutines = typeof deps.definedRoutines === 'function' ? deps.definedRoutines() : [];
        return (definedRoutines || []).find(r => r.id === habitDef.routineId) || null;
    }

    // Call after recording a FAILURE (indulged) occurrence for a negative
    // habit — checks whether it just hit the freeze threshold and, if so,
    // sets the owning routine's frozenState. A routine that's already frozen
    // (by this habit or another) is left alone — freezing doesn't "stack" or
    // reset frozenAt, and (per the guard below) never re-fires the notice.
    //
    // Sub-session 3 (2026-07-19): `deps.onRoutineFrozen(routine, habitDef)` is
    // an OPTIONAL notification collaborator, called exactly once on the
    // unfrozen -> frozen transition (never while already frozen, since the
    // guard above returns before this point on every subsequent call). Same
    // "no-op if the deps collaborator is omitted" precedent as
    // `deps.definedRoutines` itself — existing tests that don't pass it are
    // unaffected.
    function maybeFreezeRoutine(habitDef, deps) {
        if (!habitDef.isNegative) return;
        const routine = findOwningRoutine(habitDef, deps);
        if (!routine || routine.frozenState) return;
        if (FrozenSlots.shouldFreeze(habitDef.occurrenceHistory, CONFIG.FREEZE_THRESHOLD_DAYS)) {
            routine.frozenState = FrozenSlots.buildFrozenState(habitDef.id, new Date());
            if (typeof deps.onRoutineFrozen === 'function') {
                deps.onRoutineFrozen(routine, habitDef);
            }
        }
    }

    // Call after recording a SUCCESS (avoided) occurrence for a negative
    // habit — recovery path 2 (docs/ROUTINES.md): checks whether it just hit
    // the avoidance-recovery threshold and, if so, clears frozenState. Only
    // clears a freeze that THIS habit caused — a routine frozen by a
    // DIFFERENT negative habit it owns is untouched (that habit has its own
    // recovery to earn).
    function maybeRecoverRoutine(habitDef, deps) {
        if (!habitDef.isNegative) return;
        const routine = findOwningRoutine(habitDef, deps);
        if (!routine || !routine.frozenState || routine.frozenState.frozenBy !== habitDef.id) return;
        if (FrozenSlots.shouldRecoverByAvoidance(habitDef.occurrenceHistory, CONFIG.RECOVERY_AVOIDED_DAYS)) {
            routine.frozenState = null;
        }
    }

    // --- Hero/routine XP ([P1-UI-006] sub-session 1, 2026-07-19 session 41;
    // js/heroes.js + docs/HEROES_PLAN.md). A routine earns XP when a member
    // item completes; frozen/inactive routines earn nothing
    // (FrozenSlots.isRoutineSuspended — the session-36 "no XP while frozen"
    // no-op finally has something to suspend). Heroes + FrozenSlots called as
    // bare stable globals, `deps.definedRoutines` optional (no-op when
    // omitted), matching this module's existing conventions.

    // The routine that owns an ITEM (not just a habit def): habit instances
    // via habitDef.routineId (findOwningRoutine), routine-task instances via
    // taskDefinitionIds membership. Standalone items -> null.
    function findRoutineForItem(item, deps) {
        if (item.type === 'habit') {
            const habitDef = deps.definedHabits().find(def => def.id === item.definitionId);
            return habitDef ? findOwningRoutine(habitDef, deps) : null;
        }
        if (item.type === 'task' && item.definitionId != null) {
            const definedRoutines = typeof deps.definedRoutines === 'function' ? deps.definedRoutines() : [];
            return (definedRoutines || []).find(r => (r.taskDefinitionIds || []).includes(item.definitionId)) || null;
        }
        return null;
    }

    // Award routine XP for a routine-owned completion, STAMPING the awarded
    // amount on the item (`item.routineXpAwarded` — persists wholesale like
    // every other item field) so refundRoutineXpForItem can mirror it
    // EXACTLY. The stamp, not a re-check of current conditions, is what the
    // refund trusts — otherwise a freeze/deactivation between complete and
    // uncomplete would break refund symmetry, the same asymmetry class as
    // the old streak-bonus refund bug (see DECISIONS.md 2026-07-18).
    function awardRoutineXpForItem(item, deps) {
        const routine = findRoutineForItem(item, deps);
        if (!routine || FrozenSlots.isRoutineSuspended(routine)) return;
        const amount = Heroes.xpAmountFor(item.type, CONFIG);
        const result = Heroes.applyXpDelta(routine.xp || 0, amount, CONFIG.ROUTINE_LEVEL_XP_THRESHOLDS);
        routine.xp = result.xp;
        routine.level = result.level;
        item.routineXpAwarded = amount;
        // Celebrate FX ([P1-UI-006] sub-session 5): optional, DOM-free —
        // script.js stamps an ephemeral timestamp HeroesView reads at render
        // time. Same optional-collaborator pattern as onRoutineKo below.
        if (typeof deps.onRoutineCelebrate === 'function') deps.onRoutineCelebrate(routine);
    }

    // Reverse a prior award off the stamp — unconditional (no suspension
    // check; see awardRoutineXpForItem). No stamp = nothing was awarded
    // (standalone item, or completed while frozen) = nothing to refund.
    function refundRoutineXpForItem(item, deps) {
        const amount = item.routineXpAwarded;
        if (!amount) return;
        delete item.routineXpAwarded;
        const routine = findRoutineForItem(item, deps);
        if (!routine) return;
        const result = Heroes.applyXpDelta(routine.xp || 0, -amount, CONFIG.ROUTINE_LEVEL_XP_THRESHOLDS);
        routine.xp = result.xp;
        routine.level = result.level;
    }

    // Award for the two habit-def-only completion sites (check-in 'avoided',
    // rollover auto-avoid) — no item survives those paths and neither can
    // ever be un-done, so there's nothing to stamp.
    function awardRoutineXpForHabitDef(habitDef, deps) {
        const routine = findOwningRoutine(habitDef, deps);
        if (!routine || FrozenSlots.isRoutineSuspended(routine)) return;
        const result = Heroes.applyXpDelta(routine.xp || 0, Heroes.xpAmountFor('habit', CONFIG), CONFIG.ROUTINE_LEVEL_XP_THRESHOLDS);
        routine.xp = result.xp;
        routine.level = result.level;
        // Celebrate FX (sub-session 5) — see awardRoutineXpForItem.
        if (typeof deps.onRoutineCelebrate === 'function') deps.onRoutineCelebrate(routine);
    }

    // --- Routine health damage + KO ([P1-UI-006] sub-session 2, 2026-07-19;
    // see docs/HEROES_PLAN.md fork 2). The base-damage tick path (live loop +
    // both catch-up paths in js/damage.js/js/loop.js) also damages the
    // breaching item's owning routine — same findRoutineForItem lookup the
    // XP wiring above uses, so standalone items (no owning routine) are
    // unaffected. Damage.js/Loop.js load BEFORE this file and can't
    // reference Items as a bare global, so THEY receive this as an injected
    // `damageRoutineForItem` collaborator (isNonThreatening precedent);
    // js/loop.js itself loads AFTER items.js and calls it directly.
    //
    // At 0 health the routine is knocked out: `koState` is set, it's
    // auto-deactivated (decided in-session: reuse `clearActiveInstancesForRoutine`
    // directly rather than `Routines.toggleRoutineActive` — the toggle
    // wrapper's slot-limit alert/spawn-generation concerns don't apply to an
    // automatic KO, and the recall is the actual "existing machinery" the
    // plan asks to reuse), and a one-time notice fires
    // (`deps.onRoutineKo`, optional, `onRoutineFrozen` precedent). The
    // `routine.koState` guard makes this idempotent — a routine already KO'd
    // can't be damaged or re-KO'd again (its members were just recalled, so
    // in practice nothing should fire again same-tick, but belt-and-suspenders
    // matches the frozen-routine "don't re-notify" guard).
    //
    // Decided in-session (see DECISIONS.md): offline/live-gap catch-up damage
    // CAN KO a routine, same as it can damage the base — the per-item
    // lifetime cap already bounds how much any single item can contribute,
    // so there's no unbounded-punishment risk from being away a long time.
    function damageRoutineForItem(item, amount, deps) {
        const routine = findRoutineForItem(item, deps);
        if (!routine || routine.koState) return;

        const currentHealth = (typeof routine.health === 'number') ? routine.health : CONFIG.ROUTINE_MAX_HEALTH;
        routine.health = Heroes.applyRoutineDamage(currentHealth, amount);

        // Flinch FX ([P1-UI-006] sub-session 5): optional, DOM-free — fires
        // on every real damage tick, including the one that KOs. Same
        // optional-collaborator pattern as onRoutineKo below.
        if (typeof deps.onRoutineDamaged === 'function') deps.onRoutineDamaged(routine);

        if (Heroes.shouldKo(routine.health)) {
            routine.koState = { koAt: Date.now() };
            routine.isActive = false;
            if (typeof deps.clearActiveInstancesForRoutine === 'function') {
                deps.clearActiveInstancesForRoutine(routine.id);
            }
            if (typeof deps.onRoutineKo === 'function') {
                deps.onRoutineKo(routine);
            }
        }
    }

    // --- Run-history damage attribution (Run history sub-session 2,
    // 2026-07-19 session 53; docs/RUN_HISTORY_PLAN.md). Same shape as
    // damageRoutineForItem immediately above (this precedent), reusing the
    // same findRoutineForItem lookup so blame rows carry the correct
    // routineId. Damage.js/loop.js receive this as an injected
    // `recordRunDamage` collaborator (optional -> no-op, matching every
    // other collaborator in this file); loop.js itself loads AFTER items.js
    // and can call it directly.
    function recordRunDamageForItem(item, amount, nowMs, deps) {
        if (typeof deps.getCurrentRunStats !== 'function') return;
        const routine = findRoutineForItem(item, deps);
        RunStats.recordDamage(
            deps.getCurrentRunStats(), item, amount, nowMs, routine ? routine.id : null
        );
    }

    /**
     * deps: { getNextId, activeItems, gameScreenWidth, enemyWidth,
     *         calculateTimelineXWithClustering }
     */
    function createTaskItemData(name, category, isHighPriority, dueDateStr, dueTimeStr, parentId, deps) {
        const creationTime = new Date();
        let dueDateTime;

        if (dueDateStr && dueTimeStr) {
            dueDateTime = new Date(`${dueDateStr}T${dueTimeStr}`);
        } else if (dueDateStr) {
            dueDateTime = new Date(dueDateStr);
            dueDateTime.setHours(23, 59, 59, 999);
        } else {
            dueDateTime = new Date(creationTime.getTime() + 10 * 60 * 1000); // 10 minutes from now
        }

        // If this is a sub-task and no due date was provided, inherit from parent
        if (parentId && !dueDateStr && !dueTimeStr) {
            const parentTask = deps.activeItems.find(item => item.id === parentId && item.type === 'task');
            if (parentTask) {
                dueDateTime = new Date(parentTask.dueDateTime);
            }
        }

        // Validate due date but allow past time today
        if (isNaN(dueDateTime.getTime()) || (dueDateTime < creationTime && dueDateStr !== creationTime.toISOString().split('T')[0])) {
            dueDateTime = new Date(creationTime.getTime() + 5 * 60 * 1000);
        }

        // Dependent due dates ([P1-DATA-004] sub-session 2): a sub-task can
        // never be due LATER than its parent — default AND latest = parent's
        // deadline; earlier is allowed. The creation/edit FORMS reject later
        // values loudly (js/ui/popups.js); this is the silent data-layer
        // backstop for programmatic callers (and the fallback branches above,
        // which can otherwise land past an already-near/overdue parent's
        // deadline). Runs LAST so it wins over the validation fallback.
        if (parentId) {
            const clampParent = deps.activeItems.find(item => item.id === parentId && item.type === 'task');
            if (clampParent) {
                dueDateTime = clampedSubTaskDueDate(dueDateTime, clampParent);
            }
        }

        const taskData = {
            id: deps.getNextId(),
            type: 'task',
            name: name || "Unnamed Task",
            category: category || "other",
            isHighPriority: isHighPriority,
            dueDateTime: dueDateTime,
            creationTime: creationTime,
            timeToDueAtCreationMs: Math.max(0, dueDateTime.getTime() - creationTime.getTime()),
            x: deps.gameScreenWidth - deps.enemyWidth, // Will be recalculated below
            isOverdue: false,
            lastDamageTickTime: null,
            element: null,
            listItemElement: null,
            // Sub-task hierarchy fields
            parentId: parentId,
            subTasks: [],
            completedSubTasks: 0,
            totalSubTasks: 0,
            // Cumulative offline overdue damage ever charged to this item —
            // lifetime cap (CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM), not per-restore.
            // See computeOfflineOverdueDamage / DECISIONS.md 2026-07-17.
            offlineDamageCharged: 0
        };

        // Calculate initial position based on new timeline system
        taskData.x = deps.calculateTimelineXWithClustering(taskData, creationTime);

        return taskData;
    }

    /**
     * deps: { isGameOver, activeItems, definedHabits (getter),
     *         xpPerTaskDefeat, pointsPerTask, xpPerHabitComplete,
     *         pointsPerHabit, habitStreakBonusThreshold,
     *         getPlayerXP, setPlayerXP, getPlayerPoints, setPlayerPoints,
     *         updatePlayerDisplays, checkPlayerLevelUp, createListItem,
     *         sortAndRenderActiveList, completedItems (getter), saveGame,
     *         renderCompletedItems }
     * Habits (applyHabitCompletion) called as a bare stable global.
     */
    function completeItem(itemId, deps) {
        if (deps.isGameOver()) return;

        const itemIndex = deps.activeItems.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;

        const item = deps.activeItems[itemIndex];

        // [P1-DATA-004] sub-session 1 (2026-07-19): a parent task with open
        // sub-tasks cannot be completed. Previously this paid the full
        // reward and stranded every child as an agenda-invisible,
        // base-damaging zombie (nested-only rendering means no row exists
        // without a parent to nest under) — the "orphan hole," found via a
        // live playtest and closed at the source rather than by cascading a
        // completion/reward onto the children (rejected forks — see
        // SUBTASKS_PLAN.md/DECISIONS.md session 46). Result-object return
        // (shop.js pattern) lets UI callers render "N sub-tasks remaining"
        // without string-matching; UI already disables the checkbox
        // proactively (agendaList.js/popups.js), this is the backstop.
        // Callers that don't check the return value (existing tests, the
        // day-rollover settle* paths that never touch sub-tasked items) are
        // unaffected — nothing below this point runs when blocked, same as
        // the pre-existing isGameOver/not-found early returns.
        if (item.type === 'task' && item.subTasks && item.subTasks.length > 0) {
            return { ok: false, reason: 'subtasks_remaining', remaining: item.subTasks.length };
        }

        let xpGained = 0;
        let pointsGained = 0;

        if (item.type === 'task') {
            // Sub-task economy ([P1-DATA-004] sub-session 3, 2026-07-19):
            // a sub-task pays HALF a standalone task's base XP/points
            // (CONFIG.SUBTASK_XP/SUBTASK_POINTS); the parent (parentId
            // falsy) is unaffected. The high-priority ×2 rule still applies
            // to a sub's OWN priority flag on top of the halved base, via
            // the same Economy.taskPoints seam — a high-priority sub tops
            // out at POINTS_PER_TASK, never exceeding a standalone task.
            const isSub = !!item.parentId;
            xpGained = isSub ? CONFIG.SUBTASK_XP : deps.xpPerTaskDefeat;
            const basePoints = isSub ? CONFIG.SUBTASK_POINTS : deps.pointsPerTask;
            pointsGained = Economy.taskPoints(item.isHighPriority, basePoints);
        } else if (item.type === 'habit') {
            const habitDef = deps.definedHabits().find(def => def.id === item.definitionId);
            if (habitDef) {
                const result = Habits.applyHabitCompletion(
                    habitDef.streak, habitDef.occurrenceHistory, habitDef.isNegative, item.originalDueDate, {
                        xpPerHabitComplete: deps.xpPerHabitComplete,
                        pointsPerHabit: deps.pointsPerHabit,
                        rateWindow: CONFIG.HABIT_RATE_WINDOW,
                        rateMinSample: CONFIG.HABIT_RATE_MIN_SAMPLE,
                        rateTiers: CONFIG.HABIT_RATE_TIERS
                    });
                habitDef.streak = result.streak;
                habitDef.lastCompletionDate = result.lastCompletionDate;
                habitDef.occurrenceHistory = result.occurrenceHistory;
                xpGained = result.xpGained;
                pointsGained = result.pointsGained;
                // Frozen routine slots: for a negative habit this is the
                // "Successfully avoided" path — check recovery path 2.
                maybeRecoverRoutine(habitDef, deps);
            }
        }

        if (xpGained > 0) {
            deps.setPlayerXP(deps.getPlayerXP() + xpGained);
            deps.setPlayerPoints(Economy.addPoints(deps.getPlayerPoints(), pointsGained));
            deps.updatePlayerDisplays();
            deps.checkPlayerLevelUp();
            // Hero/routine XP ([P1-UI-006]): the owning routine levels too.
            // AFTER maybeRecoverRoutine above, so an avoid that just
            // unfroze its routine earns XP for the unfreezing completion.
            awardRoutineXpForItem(item, deps);

            // Run history counters (sub-session 2, 2026-07-19 session 53).
            // Counts every task-type completion incl. sub-tasks (a real
            // productivity event, same "task" bucket the plan describes).
            // NOT corrected for a late completion after markAsOverdue already
            // recorded a miss (item.isOverdue true here) — deliberately
            // consistent with js/runStats.js's own documented philosophy
            // ("counters describe what occurred, not the net ledger", the
            // same reasoning recordPointsEarned uses for not reversing on
            // uncompletion). Both the miss and the late completion occurred;
            // the run record showing both is more informative for routine
            // comparison than silently erasing the miss.
            if (typeof deps.getCurrentRunStats === 'function') {
                const stats = deps.getCurrentRunStats();
                if (item.type === 'task') {
                    RunStats.recordTaskCompleted(stats);
                } else if (item.type === 'habit') {
                    RunStats.recordHabitCompleted(stats);
                }
                RunStats.recordPointsEarned(stats, pointsGained);
            }
        }

        // If this is a sub-task, remove it from parent's sub-task list
        if (item.parentId) {
            const parentTask = deps.activeItems.find(parent => parent.id === item.parentId);
            if (parentTask) {
                const subTaskIndex = parentTask.subTasks.indexOf(itemId);
                if (subTaskIndex > -1) {
                    parentTask.subTasks.splice(subTaskIndex, 1);
                    parentTask.completedSubTasks++;

                    // Refresh parent task's list item to update sub-task display
                    if (parentTask.listItemElement) {
                        parentTask.listItemElement.remove();
                        deps.createListItem(parentTask);
                        deps.sortAndRenderActiveList();
                    }
                }
            }
        }

        // Move item to completed list
        item.completedAt = new Date();
        deps.completedItems().push(item);
        deps.saveGame();

        // Show completed tasks section and render completed items
        deps.renderCompletedItems();

        // Fade out animation
        if (item.element) {
            item.element.style.transition = 'opacity 0.5s ease';
            item.element.style.opacity = '0';
        }

        // Remove item after fade animation
        setTimeout(() => {
            removeItem(itemId, deps);
        }, 500);
    }

    /**
     * deps: { activeItems, updateTaskCountDisplay, saveGame,
     *         createListItem?, sortAndRenderActiveList? }
     *
     * [P1-DATA-004] sub-session 1 (2026-07-19): cascades in both directions
     * — a ticket acceptance criterion, and the other half of closing the
     * orphan hole (completeItem's new block above covers the completion
     * path; this covers every OTHER path that can remove a parent, e.g.
     * routine-clearing, day-token settlement, rollover). Deleting a PARENT
     * sweeps every child with it (children are looked up live via
     * `parentId`, not just the parent's own `subTasks` array, so a
     * desynced array can't leave a dangling sprite). Deleting a SUB updates
     * the parent's counters (`subTasks`/`totalSubTasks`) WITHOUT touching
     * `completedSubTasks` — this is a removal, not a completion — and
     * refreshes the parent's list item so the sub-tasks section reflects
     * the new count immediately. `createListItem`/`sortAndRenderActiveList`
     * are OPTIONAL: older callers in this file (settleStaleRecurringInstance,
     * settleExcusedCheatDay, useSkipDayOnItem, useSickDayGlobally,
     * indulgeHabit) pass the smaller deps shape documented above and never
     * touch sub-tasked items in practice, so the refresh is skippable there.
     */
    function removeItem(itemId, deps) {
        const itemIndex = deps.activeItems.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;

        const item = deps.activeItems[itemIndex];

        if (item.element) item.element.remove();
        if (item.listItemElement) item.listItemElement.remove();

        deps.activeItems.splice(itemIndex, 1);

        // Cascade to children. Snapshot ids before recursing — removeItem
        // splices deps.activeItems in place, which would otherwise skip
        // entries while iterating it live (same hazard as
        // useSickDayGlobally's snapshot-then-forEach above).
        const childIds = deps.activeItems
            .filter(i => i.parentId === itemId)
            .map(i => i.id);
        childIds.forEach(childId => removeItem(childId, deps));

        // Sync the parent's counters if THIS was a sub-task.
        if (item.parentId) {
            const parentTask = deps.activeItems.find(parent => parent.id === item.parentId);
            if (parentTask) {
                const subTaskIndex = parentTask.subTasks.indexOf(itemId);
                if (subTaskIndex > -1) parentTask.subTasks.splice(subTaskIndex, 1);
                parentTask.totalSubTasks = parentTask.subTasks.length;

                if (parentTask.listItemElement && deps.createListItem) {
                    parentTask.listItemElement.remove();
                    deps.createListItem(parentTask);
                    if (deps.sortAndRenderActiveList) deps.sortAndRenderActiveList();
                }
            }
        }

        deps.updateTaskCountDisplay();
        deps.saveGame();
    }

    /**
     * deps: superset of completeItem's + removeItem's:
     *   { isGameOver, activeItems, definedHabits (getter), xpPerHabitComplete,
     *     pointsPerHabit, getPlayerXP, setPlayerXP, getPlayerPoints,
     *     setPlayerPoints, updatePlayerDisplays, checkPlayerLevelUp,
     *     updateTaskCountDisplay, saveGame }
     * Habits (applyHabitCompletion) + Economy (addPoints) called as bare globals.
     *
     * Day-advance mechanism (2026-07-19): closes out ONE prior-day recurring
     * instance at day rollover (called from state.js's restoreGameState for each
     * item DayRollover.selectStaleRecurringInstances returned). Two cases:
     *
     *   - NEGATIVE habit lurker → auto-resolve as AVOIDED (session-26's generous
     *     default for prior days): the full avoid reward via applyHabitCompletion
     *     — success occurrence keyed to the instance's originalDueDate (yesterday),
     *     streak++, XP + rate-multiplied points, level check — exactly the manual
     *     "Successfully avoided" economics. Because lastCompletionDate is keyed to
     *     originalDueDate (yesterday), NOT today, today's generator still spawns a
     *     fresh lurker — the temptation returns each day. Deliberately does NOT
     *     push into completedItems (it happened yesterday, not today; surfacing
     *     past auto-resolutions is the sub-session-4 check-in's job, not this).
     *
     *   - Everything else (POSITIVE habit, routine TASK) → just remove. A positive
     *     habit's miss was already recorded by markAsOverdue when addItemToGame
     *     re-added it on restore (before this runs); a routine task has no rate
     *     history to record. Removing before runOfflineCatchUp means a closed-out
     *     recurring instance charges NO offline base damage — recurring-habit
     *     consequences are behavioral (points/rate), base HP is for one-off
     *     deadline failures. See DECISIONS.md session 32.
     *
     * Synchronous (no fade/setTimeout) so the board is settled before the
     * generators + offline catch-up run in the same restore pass.
     */
    /**
     * [P1-DATA-005] sub-session 5 (Cheat Day token, 2026-07-19): true when
     * `habitDef.cheatDayDate` (set by useCheatDay) matches the occurrence
     * date of `originalDueDate` — i.e. a Cheat Day token is active for THIS
     * specific negative-habit lurker's day. Decided session 26 (Fable):
     * while active, indulging is excused — no points debit, no occurrence
     * recorded (not a success, not a miss), streak preserved untouched.
     * Habits.toOccurrenceDate called as a bare global (same as everywhere
     * else in this module).
     */
    function isCheatDayExcused(habitDef, originalDueDate) {
        return !!habitDef.cheatDayDate &&
            habitDef.cheatDayDate === Habits.toOccurrenceDate(originalDueDate);
    }

    function settleStaleRecurringInstance(item, deps) {
        if (item.type === 'habit' && item.isNegative === true) {
            const habitDef = deps.definedHabits().find(def => def.id === item.definitionId);
            if (habitDef) {
                const result = Habits.applyHabitCompletion(
                    habitDef.streak, habitDef.occurrenceHistory, habitDef.isNegative, item.originalDueDate, {
                        xpPerHabitComplete: deps.xpPerHabitComplete,
                        pointsPerHabit: deps.pointsPerHabit,
                        rateWindow: CONFIG.HABIT_RATE_WINDOW,
                        rateMinSample: CONFIG.HABIT_RATE_MIN_SAMPLE,
                        rateTiers: CONFIG.HABIT_RATE_TIERS
                    });
                habitDef.streak = result.streak;
                habitDef.lastCompletionDate = result.lastCompletionDate;
                habitDef.occurrenceHistory = result.occurrenceHistory;
                deps.setPlayerXP(deps.getPlayerXP() + result.xpGained);
                deps.setPlayerPoints(Economy.addPoints(deps.getPlayerPoints(), result.pointsGained));
                deps.updatePlayerDisplays();
                deps.checkPlayerLevelUp();
                // Frozen routine slots: auto-avoided is a success occurrence
                // for a negative habit — check recovery path 2.
                maybeRecoverRoutine(habitDef, deps);
                // Hero/routine XP ([P1-UI-006]): after the recovery check,
                // same ordering rationale as completeItem.
                awardRoutineXpForHabitDef(habitDef, deps);
            }
        }
        removeItem(item.id, deps);
    }

    /**
     * deps: { definedHabits (getter), activeItems, updateTaskCountDisplay, saveGame }
     *
     * Sub-session 5 (Cheat Day token, 2026-07-19): the EXCUSED counterpart to
     * settleStaleRecurringInstance above, checked FIRST by state.js's
     * rollover fork (ahead of the check-in-eligible / auto-avoid split) — a
     * stale negative-habit lurker whose day has an active Cheat Day
     * (isCheatDayExcused) never becomes a pendingCheckIn and never
     * auto-avoids; it's simply excused. No points/xp/streak/occurrence
     * change (not a success, not a miss — session 26, Fable) — just clears
     * the `cheatDayDate` marker (one use per token) and removes the lurker
     * so today's fresh one spawns clean.
     */
    function settleExcusedCheatDay(item, deps) {
        const habitDef = deps.definedHabits().find(def => def.id === item.definitionId);
        if (habitDef) {
            habitDef.cheatDayDate = null;
        }
        removeItem(item.id, deps);
    }

    /**
     * deps: { definedHabits (getter), activeItems, updateTaskCountDisplay, saveGame }
     *
     * Frozen-slots sub-session 5 (Skip Day token, 2026-07-19): applies a Skip
     * Day to ONE targeted, already-spawned habit instance (any type — Skip
     * Day isn't negative-only, unlike Cheat Day). "Clear immediately" model
     * (Jeremy's call, 2026-07-19): sets `habitDef.skipDayDate` to this
     * instance's occurrence date and removes it from the board right away —
     * no occurrence recorded, streak/points/xp untouched (not a success, not
     * a miss, same transparency principle as Cheat Day/fork 2). Unlike Cheat
     * Day, there's no later "excused" branch to wire into indulge/complete/
     * rollover — the instance is gone the moment the token is used, so
     * there's nothing left to reach those paths. `skipDayDate` still matters
     * afterward purely as a same-day spawn-gate (Habits.selectHabitDefsToSpawn)
     * so a same-day reload can't respawn a fresh instance (same hazard class
     * as the documented indulge same-day-respawn bug — see ROADMAP.md).
     */
    function useSkipDayOnItem(item, deps) {
        const habitDef = deps.definedHabits().find(def => def.id === item.definitionId);
        if (habitDef) {
            habitDef.skipDayDate = Habits.toOccurrenceDate(item.originalDueDate);
        }
        removeItem(item.id, deps);
    }

    /**
     * deps: { definedHabits (getter), activeItems, updateTaskCountDisplay, saveGame }
     *
     * Frozen-slots sub-session 5 (Sick Day token, 2026-07-19): the GLOBAL,
     * untargeted counterpart to useSkipDayOnItem — applied from the Sick Day
     * shop card directly (js/ui/shopView.js), not tapped onto one instance.
     * `deps.setSickDayDate` is expected to persist the marker at the
     * script.js level (mirrors deps.setPlayerInventory's pattern). Sweeps
     * EVERY currently active HABIT instance (positive or negative) whose
     * occurrence date is `forDate` off the board — routine TASKS are
     * untouched (fork 4, docs/FROZEN_SLOTS_PLAN.md: Sick Day only pauses
     * habits). Same "clear immediately" semantics as useSkipDayOnItem: no
     * occurrence recorded, streak/points/xp untouched for any of them.
     */
    function useSickDayGlobally(forDate, deps) {
        const forDateString = Habits.toOccurrenceDate(forDate);
        deps.setSickDayDate(forDateString);

        deps.activeItems
            .filter(item =>
                item.type === 'habit' &&
                item.originalDueDate &&
                Habits.toOccurrenceDate(item.originalDueDate) === forDateString
            )
            // Snapshot ids before removing — removeItem splices deps.activeItems
            // in place, which would otherwise skip entries while iterating it live.
            .map(item => item.id)
            .forEach(itemId => removeItem(itemId, deps));
    }

    /**
     * deps: { definedHabits (getter), activeItems, updateTaskCountDisplay, saveGame }
     *
     * Sub-session 4 ([P1-DATA-005], check-in prompt, 2026-07-19): the
     * check-in-eligible counterpart to settleStaleRecurringInstance above.
     * The SINGLE most-recent prior day's negative-habit lurker (state.js
     * decides eligibility via DayRollover.isFromPreviousDay) is NOT
     * auto-resolved — instead the habit definition records a `pendingCheckIn`
     * marker ({ originalDueDate }, additive field, no schema bump needed —
     * absent on every pre-existing save/habit, same precedent as
     * definedTasks in state.js's getPersistableState) and the lurker itself
     * is removed so today's fresh lurker can spawn without a duplicate
     * (mirrors the double-spawn reasoning in settleStaleRecurringInstance's
     * header). No points/xp/streak change here — that's
     * resolvePendingCheckIn's job once the player answers the check-in card
     * (js/ui/checkIn.js).
     */
    function markPendingCheckIn(item, deps) {
        const habitDef = deps.definedHabits().find(def => def.id === item.definitionId);
        if (habitDef) {
            habitDef.pendingCheckIn = { originalDueDate: item.originalDueDate };
        }
        removeItem(item.id, deps);
    }

    /**
     * deps: { definedHabits (getter), xpPerHabitComplete, pointsPerHabit,
     *         getPlayerXP, setPlayerXP, getPlayerPoints, setPlayerPoints,
     *         updatePlayerDisplays, checkPlayerLevelUp, saveGame }
     * Habits (applyHabitCompletion/applyHabitIndulgence) + Economy
     * (addPoints/applyIndulgenceCost) called as bare globals.
     *
     * Sub-session 4 ([P1-DATA-005], 2026-07-19): resolves one pending
     * check-in card. outcome is 'avoided' | 'indulged' — mirrors
     * settleStaleRecurringInstance's avoid branch / indulgeHabit's debit
     * branch respectively, but keyed off the persisted
     * `pendingCheckIn.originalDueDate` marker since the lurker itself is
     * long gone (removed at rollover by markPendingCheckIn). No-ops
     * (defensively) if the habit has no pending check-in — e.g. a stale
     * double-click on an already-resolved card.
     *
     * Sub-session 5 (Cheat Day token, 2026-07-19): a stale lurker with an
     * ACTIVE Cheat Day for its day never reaches this function in practice
     * — state.js's rollover fork excuses it directly (settleExcusedCheatDay)
     * before it can become a pendingCheckIn. This 'indulged' branch still
     * checks isCheatDayExcused defensively (belt-and-suspenders, matching
     * indulgeHabit's live equivalent) in case a token was somehow applied
     * after the marker was already set.
     */
    function resolvePendingCheckIn(habitDefId, outcome, deps) {
        const habitDef = deps.definedHabits().find(def => def.id === habitDefId);
        if (!habitDef || !habitDef.pendingCheckIn) return;

        const originalDueDate = habitDef.pendingCheckIn.originalDueDate;
        const config = {
            xpPerHabitComplete: deps.xpPerHabitComplete,
            pointsPerHabit: deps.pointsPerHabit,
            rateWindow: CONFIG.HABIT_RATE_WINDOW,
            rateMinSample: CONFIG.HABIT_RATE_MIN_SAMPLE,
            rateTiers: CONFIG.HABIT_RATE_TIERS
        };

        if (outcome === 'avoided') {
            const result = Habits.applyHabitCompletion(
                habitDef.streak, habitDef.occurrenceHistory, habitDef.isNegative, originalDueDate, config
            );
            habitDef.streak = result.streak;
            habitDef.lastCompletionDate = result.lastCompletionDate;
            habitDef.occurrenceHistory = result.occurrenceHistory;
            deps.setPlayerXP(deps.getPlayerXP() + result.xpGained);
            deps.setPlayerPoints(Economy.addPoints(deps.getPlayerPoints(), result.pointsGained));
            deps.checkPlayerLevelUp();
            // Frozen routine slots: 'avoided' is a success occurrence for a
            // negative habit — check recovery path 2.
            maybeRecoverRoutine(habitDef, deps);
            // Hero/routine XP ([P1-UI-006]): after the recovery check, same
            // ordering rationale as completeItem.
            awardRoutineXpForHabitDef(habitDef, deps);
        } else if (outcome === 'indulged') {
            if (isCheatDayExcused(habitDef, originalDueDate)) {
                habitDef.cheatDayDate = null;
            } else {
                const result = Habits.applyHabitIndulgence(
                    habitDef.streak, habitDef.occurrenceHistory, habitDef.isNegative, originalDueDate, config
                );
                if (!result.noOp) {
                    habitDef.streak = result.streak;
                    habitDef.occurrenceHistory = result.occurrenceHistory;
                    deps.setPlayerPoints(Economy.applyIndulgenceCost(deps.getPlayerPoints(), result.pointsLost));
                    // Frozen routine slots: 'indulged' is a failure occurrence
                    // for a negative habit — check the freeze trigger.
                    maybeFreezeRoutine(habitDef, deps);
                }
            }
        }

        delete habitDef.pendingCheckIn;
        deps.updatePlayerDisplays();
        deps.saveGame();
    }

    /**
     * deps: { isGameOver, activeItems, definedHabits (getter), pointsPerHabit,
     *         getPlayerPoints, setPlayerPoints, updatePlayerDisplays,
     *         updateTaskCountDisplay, saveGame }
     * Habits (applyHabitIndulgence) called as a bare stable global.
     *
     * Sub-session 2b ([P1-DATA-005], NEGATIVE_HABITS_PLAN.md): the "I
     * indulged" player action for a negative-habit lurker. Mirrors
     * completeItem's habit branch but DEBITS points instead of awarding
     * them, zeroes the streak, and never touches XP — points only, per the
     * plan (a lapse isn't a defeat). No-op if the item isn't an active
     * negative-habit instance (applyHabitIndulgence's own no-op guard also
     * covers a misrouted positive habit, belt-and-suspenders).
     *
     * Deliberately does NOT push into completedItems / call
     * renderCompletedItems: indulging is a lapse, not an accomplishment, so
     * it shouldn't appear in the completed list. The fade-and-remove exit
     * mirrors completeItem's animation (no separate "got you" asset exists
     * yet — same visual treatment, different bookkeeping).
     *
     * Debits via Economy.applyIndulgenceCost (sub-session 3, 2026-07-19) —
     * NON-clamping, so the balance can go negative (debt), per
     * docs/ECONOMY.md. Uncompletion refunds elsewhere still use the
     * 0-floored Economy.subtractPoints — only indulgence goes negative.
     *
     * Sub-session 5 (Cheat Day token, 2026-07-19): if a Cheat Day is active
     * for THIS lurker's day (isCheatDayExcused), the debit is skipped
     * entirely and no occurrence is recorded — the day is EXCUSED, not a
     * success or a miss, so streak/occurrenceHistory are left untouched
     * (session 26, Fable). The marker is deliberately NOT cleared here
     * (changed 2026-07-19 session 57): since an excused indulge records no
     * occurrence, the marker is the ONLY state that tells the spawn dedupe
     * (Habits.selectHabitDefsToSpawn) the day is resolved — nulling it let a
     * same-day reload respawn the lurker with its cheat cover gone, so a
     * second indulge debited for real (the session-56 bug's excused-branch
     * variant). The marker is date-scoped, so it self-expires next calendar
     * day by comparison; "one use per token" is enforced structurally by the
     * spawn gate (at most one instance per day = at most one excused indulge
     * per token). Rollover (settleExcusedCheatDay) and check-in
     * (resolvePendingCheckIn) still clear it — by then the day is over.
     * Still exits with the same fade animation either path.
     */
    function indulgeHabit(itemId, deps) {
        if (deps.isGameOver()) return;

        const item = deps.activeItems.find(i => i.id === itemId);
        if (!item || item.type !== 'habit') return;

        const habitDef = deps.definedHabits().find(def => def.id === item.definitionId);
        if (!habitDef || !habitDef.isNegative) return;

        if (isCheatDayExcused(habitDef, item.originalDueDate)) {
            // Marker intentionally kept — see the header comment (session 57).
            deps.updatePlayerDisplays();
            deps.saveGame();
        } else {
            const result = Habits.applyHabitIndulgence(
                habitDef.streak, habitDef.occurrenceHistory, habitDef.isNegative, item.originalDueDate, {
                    pointsPerHabit: deps.pointsPerHabit,
                    rateWindow: CONFIG.HABIT_RATE_WINDOW,
                    rateMinSample: CONFIG.HABIT_RATE_MIN_SAMPLE,
                    rateTiers: CONFIG.HABIT_RATE_TIERS
                });

            if (result.noOp) return;

            habitDef.streak = result.streak;
            habitDef.occurrenceHistory = result.occurrenceHistory;

            deps.setPlayerPoints(Economy.applyIndulgenceCost(deps.getPlayerPoints(), result.pointsLost));
            // Frozen routine slots: this indulge is a failure occurrence for
            // a negative habit — check the freeze trigger.
            maybeFreezeRoutine(habitDef, deps);
            deps.updatePlayerDisplays();
            deps.saveGame();
        }

        // Fade out animation (same treatment as completeItem's exit).
        if (item.element) {
            item.element.style.transition = 'opacity 0.5s ease';
            item.element.style.opacity = '0';
        }

        // Remove item after fade animation
        setTimeout(() => {
            removeItem(itemId, deps);
        }, 500);
    }

    /**
     * deps: { completedItems (getter), baseWidth, gameCanvas, enemyWidth,
     *         habitEnemyWidth, habitStreakBonusThreshold, handleEnemyClick,
     *         activeItems, createListItem, sortAndRenderActiveList,
     *         resetAllSubTaskCheckboxes, updateTaskCountDisplay,
     *         renderCompletedItems, xpPerTaskDefeat, pointsPerTask,
     *         xpPerHabitComplete, pointsPerHabit, definedHabits (getter),
     *         getPlayerXP, setPlayerXP, getPlayerPoints, setPlayerPoints,
     *         updatePlayerDisplays, saveGame, calculateTimelineXWithClustering,
     *         getSubTaskClusterOffset, getItemTopPosition }
     * Habits (applyHabitUncompletion) called as a bare stable global.
     * markAsOverdue is a module-internal call.
     */
    function uncompleteItem(itemId, deps) {
        const completedIndex = deps.completedItems().findIndex(i => i.id === itemId);
        if (completedIndex === -1) return;

        const item = deps.completedItems()[completedIndex];

        // Remove from completed items
        deps.completedItems().splice(completedIndex, 1);

        // Remove completion timestamp
        delete item.completedAt;

        // Reset overdue status (they can start fresh)
        item.isOverdue = false;
        item.lastDamageTickTime = null;

        // Recalculate position based on current time
        const currentTime = new Date();
        item.x = deps.calculateTimelineXWithClustering(item, currentTime);

        // Check if it should be marked as overdue
        if (item.dueDateTime <= currentTime) {
            markAsOverdue(item, currentTime, deps);
            item.x = deps.baseWidth + deps.getSubTaskClusterOffset(item);
        }

        // Recreate enemy element
        const itemElement = document.createElement('div');
        itemElement.classList.add('enemy');
        itemElement.classList.add(`category-${item.category}`);
        itemElement.classList.add('zombie-sprite');
        itemElement.classList.add(`zombie-${item.category}`);

        const itemSpriteWidth = (item.type === 'habit') ? deps.habitEnemyWidth : deps.enemyWidth;
        const itemSpriteHeight = (item.type === 'habit') ? 70 : 128;

        itemElement.style.width = `${itemSpriteWidth}px`;
        itemElement.style.height = `${itemSpriteHeight}px`;

        if (item.type === 'task' && item.isHighPriority) {
            itemElement.classList.add('high-priority');
        } else if (item.type === 'habit') {
            itemElement.classList.add('habit-enemy');
            itemElement.classList.add('zombie-small');
            if (item.isNegative) {
                itemElement.classList.add('negative-habit');
            }
            if (item.streak >= deps.habitStreakBonusThreshold) {
                itemElement.classList.add('high-streak');
            }
        }

        // Position the enemy
        itemElement.style.left = item.x + 'px';
        itemElement.style.top = deps.getItemTopPosition(item, itemSpriteHeight) + 'px';

        // Set up click handler
        itemElement.dataset.itemId = item.id;
        itemElement.addEventListener('click', () => deps.handleEnemyClick(item.id));

        // Add to game canvas
        deps.gameCanvas.appendChild(itemElement);
        item.element = itemElement;

        // Add back to active items first
        deps.activeItems.push(item);

        // If this is a sub-task, re-add it to parent's sub-task list
        if (item.parentId) {
            const parentTask = deps.activeItems.find(parent => parent.id === item.parentId);
            if (parentTask) {
                // Add back to parent's subTasks array if not already there
                if (!parentTask.subTasks.includes(item.id)) {
                    parentTask.subTasks.push(item.id);
                    parentTask.totalSubTasks = parentTask.subTasks.length;

                    // Decrement the completed sub-tasks count since we're restoring this one
                    if (parentTask.completedSubTasks > 0) {
                        parentTask.completedSubTasks--;
                    }

                    // Refresh parent task's list item to show the restored sub-task
                    if (parentTask.listItemElement) {
                        parentTask.listItemElement.remove();
                        deps.createListItem(parentTask);
                        // Re-render the active list to show the updated parent task
                        deps.sortAndRenderActiveList();

                        // Force comprehensive checkbox reset after DOM update
                        setTimeout(() => {
                            deps.resetAllSubTaskCheckboxes();
                        }, 10);

                        // Also do an immediate reset
                        deps.resetAllSubTaskCheckboxes();
                    }
                }
            }
        }
        // Note: Sub-tasks should never get their own main list item,
        // they are only displayed within their parent's list item

        // Update displays
        deps.updateTaskCountDisplay();
        deps.sortAndRenderActiveList();
        deps.renderCompletedItems();

        // Reverse the XP and points gained (if any)
        if (item.type === 'task') {
            // Sub-task economy refund ([P1-DATA-004] sub-session 3): mirrors
            // completeItem's award exactly — a sub's parentId can't change
            // between complete and uncomplete, so the same isSub branch is
            // symmetric by construction (no stamp-and-reuse pattern needed,
            // unlike routine XP's award/refund below which spans a level-up).
            const isSub = !!item.parentId;
            const xpLost = isSub ? CONFIG.SUBTASK_XP : deps.xpPerTaskDefeat;
            const basePointsLost = isSub ? CONFIG.SUBTASK_POINTS : deps.pointsPerTask;
            const pointsLost = Economy.taskPoints(item.isHighPriority, basePointsLost);

            deps.setPlayerXP(Math.max(0, deps.getPlayerXP() - xpLost));
            deps.setPlayerPoints(Economy.subtractPoints(deps.getPlayerPoints(), pointsLost));
        } else if (item.type === 'habit') {
            const habitDef = deps.definedHabits().find(def => def.id === item.definitionId);
            if (habitDef) {
                const result = Habits.applyHabitUncompletion(
                    habitDef.streak, habitDef.occurrenceHistory, habitDef.isNegative, item.originalDueDate, {
                        xpPerHabitComplete: deps.xpPerHabitComplete,
                        pointsPerHabit: deps.pointsPerHabit,
                        rateWindow: CONFIG.HABIT_RATE_WINDOW,
                        rateMinSample: CONFIG.HABIT_RATE_MIN_SAMPLE,
                        rateTiers: CONFIG.HABIT_RATE_TIERS
                    });
                habitDef.streak = result.streak;
                habitDef.lastCompletionDate = result.lastCompletionDate;
                habitDef.occurrenceHistory = result.occurrenceHistory;

                deps.setPlayerXP(Math.max(0, deps.getPlayerXP() - result.xpLost));
                deps.setPlayerPoints(Economy.subtractPoints(deps.getPlayerPoints(), result.pointsLost));
            }
        }

        // Hero/routine XP ([P1-UI-006]): mirror the award exactly, off the
        // stamp completeItem left on the item (see refundRoutineXpForItem).
        refundRoutineXpForItem(item, deps);

        deps.updatePlayerDisplays();
        deps.saveGame();
    }

    /**
     * deps: { definedHabits (getter), saveGame, getCurrentRunStats? }
     * Habits (resetStreakOnOverdue) called as a bare stable global.
     */
    function markAsOverdue(item, currentTime, deps) {
        if (item.isOverdue) return;
        // Defensive guard (session 27): a negative-habit lurker must never go
        // overdue. The primary exclusions live in loop.js/damage.js (the
        // three damage-tick paths never call this for a lurker in the first
        // place), but this belt-and-suspenders check also protects
        // recomputeOverdueStateAfterEdit's "pulled into the past" branch,
        // which calls markAsOverdue directly.
        if (isNonThreatening(item)) return;

        item.isOverdue = true;
        item.lastDamageTickTime = item.dueDateTime.getTime();

        if (item.element) item.element.classList.add('enemy-at-base');
        if (item.listItemElement) item.listItemElement.classList.add('overdue-list-item');

        // Reset habit streak (visual) AND record a miss occurrence for the
        // rate-based bonus (session 16). occurrenceHistory keys off the
        // instance's originalDueDate — the scheduled day this miss belongs to.
        if (item.type === 'habit') {
            const habitDef = deps.definedHabits().find(def => def.id === item.definitionId);
            if (habitDef) {
                const result = Habits.applyHabitOverdue(
                    habitDef.streak, habitDef.occurrenceHistory, habitDef.isNegative,
                    item.originalDueDate, CONFIG.HABIT_RATE_WINDOW
                );
                habitDef.streak = result.streak;
                habitDef.occurrenceHistory = result.occurrenceHistory;

                // Run history (sub-session 2, session 53): record the miss
                // here, mirroring the occurrenceHistory write immediately
                // above — this is the app's existing "a habit instance
                // became overdue" recording point. Negative habits never
                // reach this branch (isNonThreatening excludes them from
                // ever going overdue), so this only fires for positive
                // habits. NOT corrected if the instance is later completed
                // anyway — see completeItem's own comment on why (counters
                // describe what occurred, not a net ledger).
                if (typeof deps.getCurrentRunStats === 'function') {
                    RunStats.recordHabitMissed(deps.getCurrentRunStats());
                }

                if (result.wasReset) {
                    // Update streak display in list
                    if (item.listItemElement) {
                        const streakSpan = item.listItemElement.querySelector('.item-streak');
                        if (streakSpan) streakSpan.textContent = 'Streak: 0';
                    }

                    // Remove high-streak visual effects
                    if (item.element) item.element.classList.remove('high-streak');
                }
            }
        }
        deps.saveGame();
    }

    // Re-derives isOverdue from the item's CURRENT dueDateTime — call after any
    // edit that changes an item's due date, since isOverdue is otherwise only
    // ever set forward by markAsOverdue/updateActiveItems and never re-checked.
    // Without this, editing an overdue task's deadline into the future left it
    // camped at the base still taking damage (see showEditTaskModal save
    // handler, DECISIONS.md 2026-07-17).
    /**
     * deps: { baseWidth, calculateTimelineXWithClustering, getSubTaskClusterOffset }
     * plus everything markAsOverdue needs, since this may call it.
     */
    function recomputeOverdueStateAfterEdit(item, deps) {
        // A negative-habit lurker has no overdue state to recompute (session
        // 27) — without this guard, an edit-triggered call would overwrite
        // its fixed lurk x with a timeline/base position.
        if (isNonThreatening(item)) return;

        const now = new Date();
        const shouldBeOverdue = item.dueDateTime <= now;

        if (item.isOverdue && !shouldBeOverdue) {
            // Pushed back into the future: un-overdue it.
            item.isOverdue = false;
            item.lastDamageTickTime = null;
            if (item.element) item.element.classList.remove('enemy-at-base');
            if (item.listItemElement) item.listItemElement.classList.remove('overdue-list-item');
            item.x = deps.calculateTimelineXWithClustering(item, now);
            if (item.element) item.element.style.left = Math.max(deps.baseWidth, item.x) + 'px';
        } else if (!item.isOverdue && shouldBeOverdue) {
            // Pulled into the past: it's overdue starting now.
            markAsOverdue(item, now, deps);
            item.x = deps.baseWidth + deps.getSubTaskClusterOffset(item);
            if (item.element) item.element.style.left = item.x + 'px';
        }
    }

    // Pure clamp rule for the dependent-due-dates model ([P1-DATA-004]
    // sub-session 2, Jeremy's fork verdict 2026-07-19): a sub-task's due date
    // may be EARLIER than its parent's deadline, never later. Returns a NEW
    // Date when clamping (never mutates), the original value otherwise.
    function clampedSubTaskDueDate(dueDateTime, parentTask) {
        if (!parentTask || !(parentTask.dueDateTime instanceof Date)) return dueDateTime;
        return dueDateTime > parentTask.dueDateTime ? new Date(parentTask.dueDateTime) : dueDateTime;
    }

    // Parent-deadline-edit half of the clamp model: when a parent's deadline
    // is pulled EARLIER, every child now due later than it re-clamps DOWN to
    // the new deadline, routed through recomputeOverdueStateAfterEdit per
    // child so overdue flags/damage-tick state/positions stay correct for
    // free (a clamp can pull a child into the past → child goes overdue via
    // markAsOverdue, exactly like a manual edit would). Pushing the parent
    // LATER is a no-op here by construction — children are then simply
    // "earlier", which is legal (NOT the delta-shift model; see
    // SUBTASKS_PLAN.md fork 3). Returns the clamped children so callers can
    // refresh UI. deps: same shape as recomputeOverdueStateAfterEdit's.
    function clampSubTasksToParentDeadline(parentTask, deps) {
        if (!parentTask || parentTask.type !== 'task' || parentTask.parentId) return [];
        const clamped = [];
        deps.activeItems.forEach(child => {
            if (child.parentId !== parentTask.id || child.type !== 'task') return;
            if (child.dueDateTime > parentTask.dueDateTime) {
                child.dueDateTime = new Date(parentTask.dueDateTime);
                recomputeOverdueStateAfterEdit(child, deps);
                clamped.push(child);
            }
        });
        return clamped;
    }

    return {
        isNonThreatening,
        createTaskItemData,
        clampedSubTaskDueDate,
        clampSubTasksToParentDeadline,
        completeItem,
        indulgeHabit,
        removeItem,
        settleStaleRecurringInstance,
        markPendingCheckIn,
        resolvePendingCheckIn,
        isCheatDayExcused,
        settleExcusedCheatDay,
        useSkipDayOnItem,
        useSickDayGlobally,
        uncompleteItem,
        markAsOverdue,
        recomputeOverdueStateAfterEdit,
        findRoutineForItem,
        damageRoutineForItem,
        recordRunDamageForItem
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Items;
}

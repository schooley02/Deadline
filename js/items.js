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
        let xpGained = 0;
        let pointsGained = 0;

        if (item.type === 'task') {
            xpGained = deps.xpPerTaskDefeat;
            pointsGained = Economy.taskPoints(item.isHighPriority, deps.pointsPerTask);
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
            }
        }

        if (xpGained > 0) {
            deps.setPlayerXP(deps.getPlayerXP() + xpGained);
            deps.setPlayerPoints(Economy.addPoints(deps.getPlayerPoints(), pointsGained));
            deps.updatePlayerDisplays();
            deps.checkPlayerLevelUp();
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
     * deps: { activeItems, updateTaskCountDisplay, saveGame }
     */
    function removeItem(itemId, deps) {
        const itemIndex = deps.activeItems.findIndex(i => i.id === itemId);
        if (itemIndex > -1) {
            const item = deps.activeItems[itemIndex];

            if (item.element) item.element.remove();
            if (item.listItemElement) item.listItemElement.remove();

            deps.activeItems.splice(itemIndex, 1);
            deps.updateTaskCountDisplay();
            deps.saveGame();
        }
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
     * (session 26, Fable). The marker is cleared either way (one use per
     * token). Still exits with the same fade animation either path.
     */
    function indulgeHabit(itemId, deps) {
        if (deps.isGameOver()) return;

        const item = deps.activeItems.find(i => i.id === itemId);
        if (!item || item.type !== 'habit') return;

        const habitDef = deps.definedHabits().find(def => def.id === item.definitionId);
        if (!habitDef || !habitDef.isNegative) return;

        if (isCheatDayExcused(habitDef, item.originalDueDate)) {
            habitDef.cheatDayDate = null;
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
            const xpLost = deps.xpPerTaskDefeat;
            const pointsLost = Economy.taskPoints(item.isHighPriority, deps.pointsPerTask);

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

        deps.updatePlayerDisplays();
        deps.saveGame();
    }

    /**
     * deps: { definedHabits (getter), saveGame }
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

    return {
        isNonThreatening,
        createTaskItemData,
        completeItem,
        indulgeHabit,
        removeItem,
        settleStaleRecurringInstance,
        markPendingCheckIn,
        resolvePendingCheckIn,
        isCheatDayExcused,
        settleExcusedCheatDay,
        uncompleteItem,
        markAsOverdue,
        recomputeOverdueStateAfterEdit
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Items;
}

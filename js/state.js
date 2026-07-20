/**
 * State — game lifecycle + persistence orchestration (Milestone 2 extraction,
 * session 11, 2026-07-18).
 *
 * Extracted: `initGame`, `restoreGameState`, `getPersistableState`, `saveGame`,
 * `buildDamageDeps` (the function script.js's `damageDeps()` wrapper now
 * delegates to). These are the highest-risk functions moved so far — every
 * other module's data ultimately flows from what this one initializes or
 * restores, and `restoreGameState` is what protects a real player's save.
 *
 * ARCHITECTURE NOTE (see docs/ARCHITECTURE.md, docs/DECISIONS.md 2026-07-18):
 * the target layout describes state.js as "central state + mutation
 * functions (only place state changes)" — i.e. this module OWNING the state
 * variables, not just the functions that mutate them. This extraction
 * deliberately does NOT move ownership yet. `baseHealth`, `playerXP`,
 * `activeItems`, and friends all stay as `let`s in script.js, reached here
 * through an explicit `deps` object — the same accessor pattern
 * js/damage.js and js/items.js already established for script.js-owned
 * state a module needs to read or write. Combining "extract the functions"
 * with "migrate where the state physically lives" in one session would
 * stack two risky changes on the one module guarding persistence; DECISIONS.md
 * logs the deferred migration and why it's actually script.js-only (every
 * other module already receives accessor *functions*, never the raw `let`
 * bindings, so relocating the storage later won't touch damage.js, items.js,
 * spawning.js, etc. — only script.js's own reads/writes and its deps
 * builders). CONFIG stays a bare global here, matching every prior module.
 *
 * deps = {
 *   // --- DOM ---
 *   gameCanvas, baseElement, baseHealthDisplay, gameOverMessage,
 *   levelUpMessage, restartButton, activeItemsListUL, attackButton,
 *
 *   // --- state getters ---
 *   getBaseHealth, getPlayerXP, getPlayerPoints, getRoutineSlots,
 *   getItemIdCounter, getDaysSurvived, getRunStartedAtMs, getCurrentGameDate,
 *   getActiveItems, getCompletedItems, getDefinedHabits, getDefinedRoutines,
 *   getPlayerLevel, getGameLoopInterval, isGameOver, getPlayerInventory,
 *   getSickDayDate, // frozen-slots sub-session 5, 2026-07-19 — global Sick Day marker
 *
 *   // --- state setters ---
 *   setGameScreenWidth, setBaseWidth, setEnemyWidth, setHabitEnemyWidth,
 *   setPlayerXP, setPlayerLevel, setPlayerPoints, setRoutineSlots,
 *   setBaseHealth, setActiveItems, setCompletedItems, setDefinedHabits,
 *   setDefinedRoutines, setItemIdCounter, setGameIsOver, setDaysSurvived,
 *   setRunStartedAtMs, setLastLoopTickMs, setAttackMode, setCurrentGameDate,
 *   setGameLoopInterval, setPlayerInventory, setSickDayDate,
 *
 *   // --- collaborators (functions already living elsewhere) ---
 *   updatePlayerDisplays, updateTaskCountDisplay, updateRoutineDisplay,
 *   updateBaseVisuals, generateDailyHabitInstances,
 *   generateDailyRoutineTaskInstances, addItemToGame, createListItem,
 *   renderDefinedRoutines, renderCompletedItems, sortAndRenderActiveList,
 *   gameOver, runOfflineCatchUp, updateGame,
 *
 *   // --- damage-deps passthrough (see buildDamageDeps) ---
 *   markAsOverdue, getSubTaskClusterOffset, calculateTimelineXWithClustering,
 *   enableFormControls, saveGame, getLastRegenTickMs, setLastRegenTickMs,
 *   isNonThreatening, // [P1-DATA-005] session 27 — Items.isNonThreatening
 * }
 */
const State = (() => {

    function initGame(deps) {
        // Calculate dimensions
        deps.setGameScreenWidth(deps.gameCanvas.offsetWidth);
        deps.setBaseWidth(deps.baseElement.offsetWidth);
        deps.setEnemyWidth(CONFIG.ENEMY_WIDTH);
        deps.setHabitEnemyWidth(CONFIG.HABIT_ENEMY_WIDTH);

        // Initialize player stats
        deps.setPlayerXP(0);
        deps.setPlayerLevel(1);
        deps.setPlayerPoints(0);
        deps.setPlayerInventory({}); // shop inventory — fresh run starts empty
        deps.setSickDayDate(null); // frozen-slots sub-session 5 — fresh run has no active Sick Day
        // Run stats reset with the run; runHistory is deliberately NOT
        // touched here — it must survive restart (session 52, RUN_HISTORY_PLAN).
        deps.setCurrentRunStats(RunStats.freshRunStats());
        deps.setRoutineSlots(CONFIG.ROUTINE_SLOTS_PER_LEVEL[1] || 1);

        deps.updatePlayerDisplays();

        // Initialize base
        deps.setBaseHealth(CONFIG.MAX_BASE_HEALTH);
        deps.baseHealthDisplay.textContent = CONFIG.MAX_BASE_HEALTH;
        deps.baseElement.style.backgroundImage = "url('base_100.png')";
        deps.baseElement.classList.remove('base-hit-flash');

        // Reset UI state
        if (deps.gameOverMessage) deps.gameOverMessage.classList.add('hidden');
        if (deps.levelUpMessage) deps.levelUpMessage.classList.add('hidden');
        if (deps.restartButton) deps.restartButton.classList.add('hidden');

        // Clear active items
        deps.getActiveItems().forEach(item => {
            if (item.element) item.element.remove();
            if (item.listItemElement) item.listItemElement.remove();
        });
        deps.setActiveItems([]);
        deps.setCompletedItems([]);
        if (deps.activeItemsListUL) deps.activeItemsListUL.innerHTML = '';

        // Hide completed tasks section at game start
        const completedTasksSection = document.getElementById('completedTasksSection');
        if (completedTasksSection) completedTasksSection.classList.add('hidden');

        // Reset game state
        deps.setItemIdCounter(1); // never 0 — many parentId checks use truthy tests (`if (item.parentId)`), and 0 is falsy
        deps.setGameIsOver(false);
        deps.setDaysSurvived(0);
        deps.setRunStartedAtMs(Date.now());
        deps.setLastLoopTickMs(null); // first tick after init establishes the baseline
        deps.setAttackMode(false);
        if (deps.attackButton) deps.attackButton.classList.remove('active');

        // Initialize game date
        const newGameDate = new Date();
        newGameDate.setHours(0, 0, 0, 0);
        deps.setCurrentGameDate(newGameDate);

        deps.generateDailyHabitInstances(newGameDate);
        deps.generateDailyRoutineTaskInstances(newGameDate);
        deps.updateTaskCountDisplay();
        deps.updateRoutineDisplay();

        // Start game loop
        if (deps.getGameLoopInterval()) clearInterval(deps.getGameLoopInterval());
        deps.setGameLoopInterval(setInterval(deps.updateGame, CONFIG.GAME_TICK_MS));

        // No day timer: daysSurvived is derived from real elapsed time via
        // computeDaysSurvived(), so it stays correct across sleep/suspension
        // (a timer only advances while the tab is awake). See DECISIONS.md.
    }

    // --- Persistence (js/persistence.js) ---
    // schemaVersion 1 persists the CURRENT in-memory shapes as-is; see
    // docs/DATA_SCHEMA.md + DECISIONS.md (2026-07-17). Call saveGame() after
    // every state mutation — Persistence debounces the actual write.

    function getPersistableState(deps) {
        return {
            baseHealth: deps.getBaseHealth(),
            playerXP: deps.getPlayerXP(),
            playerLevel: deps.getPlayerLevel(),
            playerPoints: deps.getPlayerPoints(),
            inventory: deps.getPlayerInventory(),
            sickDayDate: deps.getSickDayDate(),
            runHistory: deps.getRunHistory(),
            currentRunStats: deps.getCurrentRunStats(),
            routineSlots: deps.getRoutineSlots(),
            itemIdCounter: deps.getItemIdCounter(),
            gameIsOver: deps.isGameOver(),
            daysSurvived: deps.getDaysSurvived(),
            runStartedAtMs: deps.getRunStartedAtMs(),
            currentGameDate: deps.getCurrentGameDate(),
            activeItems: deps.getActiveItems(),
            completedItems: deps.getCompletedItems(),
            definedHabits: deps.getDefinedHabits(),
            definedRoutines: deps.getDefinedRoutines(),
            // Routine TASK definitions. Previously omitted while
            // routine.taskDefinitionIds WAS saved, so a refresh left those ids
            // dangling against nothing. Additive — no schemaVersion bump needed;
            // older saves simply restore an empty array. See DECISIONS.md.
            definedTasks: window.definedTasks || []
        };
    }

    function saveGame(deps) {
        if (typeof Persistence !== 'undefined') {
            Persistence.requestSave(() => getPersistableState(deps));
        }
    }

    // --- Damage / base health deps (js/damage.js) ---
    // Milestone 2 extraction #3 (2026-07-18) established this shape in
    // script.js's damageDeps(); moved here session 11 since it's part of the
    // same state-orchestration surface. js/damage.js is the only OTHER module
    // that writes script.js-owned state (baseHealth, gameIsOver), so it gets
    // accessor deps rather than raw values — see that module's header for why
    // ownership didn't move. Rebuilt per call because BASE_WIDTH and the DOM
    // handles aren't resolved until initGame() runs.
    function buildDamageDeps(deps) {
        return {
            getBaseHealth: deps.getBaseHealth,
            setBaseHealth: deps.setBaseHealth,
            isGameOver: deps.isGameOver,
            setGameOver: deps.setGameOver,
            getActiveItems: deps.getActiveItems,
            getRunStartedAtMs: deps.getRunStartedAtMs,
            setDaysSurvived: deps.setDaysSurvived,
            setOfflineCatchUpActive: deps.setOfflineCatchUpActive,
            getGameLoopInterval: deps.getGameLoopInterval,
            baseWidth: deps.baseWidth,
            // [P1-DATA-005] session 29 — the negative-habit lurker's fixed x
            // anchors to the far right of the canvas, not the base.
            gameScreenWidth: deps.gameScreenWidth,
            baseElement: deps.baseElement,
            baseHealthDisplay: deps.baseHealthDisplay,
            gameOverMessage: deps.gameOverMessage,
            restartButton: deps.restartButton,
            markAsOverdue: deps.markAsOverdue,
            getSubTaskClusterOffset: deps.getSubTaskClusterOffset,
            calculateTimelineXWithClustering: deps.calculateTimelineXWithClustering,
            enableFormControls: deps.enableFormControls,
            saveGame: deps.saveGame,
            // [P1-DATA-005] session 27 — negative-habit lurkers are excluded
            // from both catch-up paths' damage/positioning; see damage.js's
            // header comment.
            isNonThreatening: deps.isNonThreatening,
            // [P1-UI-006] sub-session 2, 2026-07-19 — routine health damage/KO
            // for both catch-up paths (they share js/damage.js's applyOfflineDamage).
            damageRoutineForItem: deps.damageRoutineForItem,
            // Regen clock passthrough ([P2-GAME-012], 2026-07-18) — lets
            // runOfflineCatchUp/runLiveGapCatchUp apply offline/suspended-gap
            // regen and reset the live loop's regen clock afterward.
            getLastRegenTickMs: deps.getLastRegenTickMs,
            setLastRegenTickMs: deps.setLastRegenTickMs,
        };
    }

    // Runs ONCE on boot, right after initGame() has reset to a fresh state.
    // Returns true if a save was restored.
    /**
     * [P1-DATA-004] sub-session 1 (2026-07-19): heals a save where a task's
     * `parentId` doesn't resolve to a live parent task in `activeItems`
     * (parent deleted before items.js's deletion cascade existed, or any
     * other stale-parentId edge case). MECHANICS.md's nested-only agenda
     * rendering means such an item would otherwise be invisible forever —
     * reachable only by clicking its battlefield sprite — while still
     * counting toward base damage (the "orphan hole," see
     * SUBTASKS_PLAN.md/DECISIONS.md session 46). Promotes it to standalone
     * (`parentId = null`) so it regains a normal agenda row. Pure (mutates
     * only the items it's given, no DOM/deps reads), idempotent (a second
     * pass over already-promoted items is a no-op — they have no parentId
     * left to fail resolution), no schema change (parentId already exists
     * on every task). Returns the promoted items so the caller can build
     * their list items — `Spawning.addItemToGame` skipped `createListItem`
     * for them while `parentId` was still set (it only builds a row for
     * top-level items).
     */
    function sanitizeOrphanedSubTasks(activeItems) {
        const promoted = [];
        activeItems.forEach(item => {
            if (item.parentId) {
                const parent = activeItems.find(p => p.id === item.parentId && p.type === 'task');
                if (!parent) {
                    item.parentId = null;
                    promoted.push(item);
                }
            }
        });
        return promoted;
    }

    function restoreGameState(deps) {
        if (typeof Persistence === 'undefined') return false;
        const save = Persistence.load();
        if (!save) return false;

        // Offline window: elapsed time since the save was written, capped at
        // the spec's 3-day max offline progression (CONFIG.OFFLINE_MAX_MS).
        const restoreNowMs = Date.now();
        const savedAtMs = (save.savedAt instanceof Date) ? save.savedAt.getTime() : null;
        const offlineMs = (savedAtMs !== null)
            ? Math.min(Math.max(0, restoreNowMs - savedAtMs), CONFIG.OFFLINE_MAX_MS)
            : 0;
        const restoredEntries = []; // { item, savedX } for the catch-up animation

        // Scalars (initGame just set the fresh-game defaults; overwrite them)
        const restoredLevel = save.playerLevel || 1;
        deps.setPlayerXP(save.playerXP || 0);
        deps.setPlayerLevel(restoredLevel);
        deps.setPlayerPoints(save.playerPoints || 0);
        // Shop inventory. The v3→v4 migration seeds {} on older saves, but guard
        // here too (non-object / absent) so a malformed save can never crash boot.
        deps.setPlayerInventory((save.inventory && typeof save.inventory === 'object') ? save.inventory : {});
        // Sick Day (frozen-slots sub-session 5, 2026-07-19). The v6→v7
        // migration seeds null on older saves, but guard here too (any
        // non-string, e.g. malformed data) so a bad save can never crash boot.
        deps.setSickDayDate((typeof save.sickDayDate === 'string') ? save.sickDayDate : null);
        // Run history (session 52, docs/RUN_HISTORY_PLAN.md). The v9→v10
        // migration seeds both, but guard here too so a malformed save can
        // never crash boot. currentRunStats keeps accruing across a mid-run
        // reload; runHistory survives everything (including restart — see
        // the restart button in script.js).
        deps.setRunHistory(Array.isArray(save.runHistory) ? save.runHistory : []);
        deps.setCurrentRunStats(
            (save.currentRunStats && typeof save.currentRunStats === 'object')
                ? save.currentRunStats
                : RunStats.freshRunStats()
        );
        deps.setRoutineSlots(CONFIG.ROUTINE_SLOTS_PER_LEVEL[restoredLevel] || 1);
        deps.setBaseHealth((typeof save.baseHealth === 'number') ? save.baseHealth : CONFIG.MAX_BASE_HEALTH);
        deps.setItemIdCounter(save.itemIdCounter || 1);
        deps.setDaysSurvived(save.daysSurvived || 0);
        // Saves written before 2026-07-18 have no runStartedAtMs (days were
        // counted by the old accelerated timer). Fall back to the save's own
        // timestamp so a restored run doesn't report a bogus day count.
        deps.setRunStartedAtMs(
            (typeof save.runStartedAtMs === 'number')
                ? save.runStartedAtMs
                : ((save.savedAt instanceof Date && !isNaN(save.savedAt.getTime()))
                    ? save.savedAt.getTime()
                    : Date.now())
        );
        if (save.currentGameDate instanceof Date && !isNaN(save.currentGameDate.getTime())) {
            deps.setCurrentGameDate(save.currentGameDate);
        }

        // Plain-data collections (no DOM refs to rebuild)
        deps.setDefinedHabits(save.definedHabits || []);
        deps.setDefinedRoutines(save.definedRoutines || []);
        // Orphaned-habit sweep (2026-07-19, see DECISIONS.md + ROADMAP.md
        // Known bugs): deleteRoutine now releases its own habits to
        // standalone at delete time, but this heals any save written before
        // that fix existed (or any other edge case that produced a dangling
        // routineId) — runs on every load, no schema bump needed (data
        // shape unchanged, just a stale value corrected).
        Routines.releaseOrphanedHabits(save.definedHabits || [], save.definedRoutines || []);
        // Saves written before 2026-07-18 have no definedTasks — restore empty
        // rather than leaving whatever the previous page load put on window.
        window.definedTasks = save.definedTasks || [];
        deps.setCompletedItems((save.completedItems || []).map(item => {
            item.element = null;
            item.listItemElement = null;
            return item;
        }));

        // Active items: rebuild DOM via addItemToGame (it pushes into activeItems,
        // which initGame just emptied). Saved order preserves parents-before-subtasks.
        (save.activeItems || []).forEach(item => {
            item.element = null;
            item.listItemElement = null;
            const savedX = (typeof item.x === 'number') ? item.x : null;
            deps.addItemToGame(item);
            restoredEntries.push({ item, savedX });
            // item.isOverdue here covers BOTH items saved as overdue (markAsOverdue
            // early-returned; re-apply its visual state) and items whose due date
            // passed while offline (addItemToGame just marked them — but with
            // lastDamageTickTime = dueDateTime, which would make the live loop
            // hammer one tick per game tick until "caught up"). Either way:
            // reset the live damage clock to now. The offline window's damage is
            // back-charged separately — capped per item — by runOfflineCatchUp
            // (policy decided 2026-07-17, see DECISIONS.md).
            if (item.isOverdue) {
                if (item.element) item.element.classList.add('enemy-at-base');
                if (item.listItemElement) item.listItemElement.classList.add('overdue-list-item');
                item.lastDamageTickTime = Date.now();
            }
        });

        // Orphan sanitizer ([P1-DATA-004] sub-session 1) — runs after every
        // saved item is back in activeItems (so parent lookups see everyone)
        // and before the parent list-item rebuild below, so a promoted item
        // is treated as an ordinary top-level task from here on: it needs a
        // list item built now (addItemToGame skipped it while parentId was
        // still set), same as any other top-level item that just entered
        // the game.
        sanitizeOrphanedSubTasks(deps.getActiveItems()).forEach(item => {
            deps.createListItem(item);
        });

        // Parents' list items were built before their sub-tasks existed in
        // activeItems — rebuild those list items now that everything is loaded.
        deps.getActiveItems().forEach(item => {
            if (!item.parentId && item.subTasks && item.subTasks.length > 0 && item.listItemElement) {
                item.listItemElement.remove();
                deps.createListItem(item);
            }
        });

        // Day rollover (restore path) — day-advance mechanism, 2026-07-19.
        // If real time has crossed into a later calendar day than the save's
        // currentGameDate, close out the PRIOR day's recurring instances BEFORE
        // spawning today's, then advance currentGameDate so the generators below
        // use today. Without this, currentGameDate stayed frozen at the save's
        // value and today's habit/routine-task instances never spawned (the
        // whole bug this fixes). Runs AFTER the re-add loop (so a positive
        // habit's miss is recorded by markAsOverdue) and BEFORE the generators.
        // Skipped for a game-over save (no settling a dead run). Base HP / offline
        // damage / regen / days-survived are unaffected — all derive from real
        // elapsed time, not the game day. LIVE mid-session crossing is a later
        // version; a running tab rolls over on its next reload. See DECISIONS.md.
        //
        // Sub-session 4 ([P1-DATA-005], check-in prompt, 2026-07-19): a stale
        // negative-habit lurker no longer always auto-avoids. The SINGLE most
        // recent prior day (DayRollover.isFromPreviousDay) routes through
        // Items.markPendingCheckIn instead — the player answers it via the
        // check-in surface (js/ui/checkIn.js) rather than a silent
        // auto-resolve. Everything else — negative lurkers from OLDER days
        // (session 26's generous default), positive habits (already
        // miss-recorded above), routine tasks — still goes through
        // Items.settleStaleRecurringInstance exactly as before.
        //
        // Sub-session 5 (Cheat Day token, 2026-07-19): now a THREE-way fork,
        // checked in this order. A stale negative-habit lurker whose day has
        // an ACTIVE Cheat Day (deps.isCheatDayExcusedForItem) is EXCUSED
        // first — ahead of both the check-in-eligible and auto-avoid checks
        // — via Items.settleExcusedCheatDay, per NEGATIVE_HABITS_PLAN.md's
        // "the check-in card for that day auto-resolves as excused."
        if (!save.gameIsOver) {
            const rolloverNow = new Date();
            if (DayRollover.hasDayRolledOver(deps.getCurrentGameDate(), rolloverNow)) {
                DayRollover.selectStaleRecurringInstances(deps.getActiveItems(), rolloverNow)
                    .forEach(item => {
                        const isExcusedCheatDay = item.type === 'habit' && item.isNegative === true &&
                            deps.isCheatDayExcusedForItem(item);
                        const isCheckInEligible = !isExcusedCheatDay && item.type === 'habit' && item.isNegative === true &&
                            DayRollover.isFromPreviousDay(item.originalDueDate, rolloverNow);
                        if (isExcusedCheatDay) {
                            deps.settleExcusedCheatDay(item);
                        } else if (isCheckInEligible) {
                            deps.markPendingCheckIn(item);
                        } else {
                            deps.settleStaleRecurringInstance(item);
                        }
                    });
                deps.setCurrentGameDate(DayRollover.startOfDay(rolloverNow));
                // Drop settled (now-removed) items from the catch-up entry set so
                // runOfflineCatchUp below doesn't animate/position ghosts whose DOM
                // elements were just detached. Damage already reads live
                // activeItems, so this is purely to keep the animation clean.
                const liveItems = deps.getActiveItems();
                for (let i = restoredEntries.length - 1; i >= 0; i--) {
                    if (!liveItems.includes(restoredEntries[i].item)) restoredEntries.splice(i, 1);
                }
            }
        }

        // Spawn today's habit + routine-task instances the save doesn't already
        // contain (both generators dedupe against activeItems/completedItems)
        deps.generateDailyHabitInstances(deps.getCurrentGameDate());
        deps.generateDailyRoutineTaskInstances(deps.getCurrentGameDate());

        // Refresh every display touched above
        deps.updatePlayerDisplays();
        if (deps.baseHealthDisplay) deps.baseHealthDisplay.textContent = deps.getBaseHealth();
        deps.updateBaseVisuals();
        deps.updateTaskCountDisplay();
        deps.updateRoutineDisplay();
        deps.renderDefinedRoutines();
        deps.renderCompletedItems();
        deps.sortAndRenderActiveList();

        if (save.gameIsOver) deps.gameOver();

        // Offline catch-up: animate zombies from their saved positions to now,
        // then back-charge capped offline overdue damage (see DECISIONS.md).
        if (!deps.isGameOver()) deps.runOfflineCatchUp(restoredEntries, offlineMs);
        return true;
    }

    return {
        initGame,
        getPersistableState,
        saveGame,
        buildDamageDeps,
        restoreGameState,
        sanitizeOrphanedSubTasks,
    };
})();

// [P1-DATA-004] sub-session 1 (2026-07-19): state.js had no module.exports
// before this session — nothing in it was unit-testable from test/. Adding
// it here (matching every other js/*.js module's guarded-export footer) is
// safe for Node `require`: the only DOM/window reference in the whole file
// (`window.definedTasks = ...`) lives inside restoreGameState's function
// body, not at module-load time, so requiring this file in a node
// testEnvironment never touches it unless restoreGameState is actually
// called (which no current test does — only the pure sanitizeOrphanedSubTasks
// is exercised).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = State;
}

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const gameCanvas = document.getElementById('gameCanvas');
    const baseElement = document.getElementById('base');
    const baseHealthDisplay = document.getElementById('baseHealthDisplay');
    const playerXpDisplay = document.getElementById('playerXpDisplay');
    const playerLevelDisplay = document.getElementById('playerLevelDisplay');
    const playerPointsDisplay = document.getElementById('playerPointsDisplay');
    // [P1-DATA-005] sub-session 3, 2026-07-19 — negative-balance red styling + nudge.
    const playerPointsStat = document.getElementById('playerPointsStat');
    const playerPointsNudge = document.getElementById('playerPointsNudge');
    const gameOverMessage = document.getElementById('gameOverMessage');
    const levelUpMessage = document.getElementById('levelUpMessage');
    const activeItemsListUL = document.getElementById('activeItemsList');
    const taskCountDisplay = document.getElementById('taskCountDisplay');
    
    // Routine elements
    const routineNameInput = document.getElementById('routineName');
    const createRoutineButton = document.getElementById('createRoutineButton');
    const definedRoutinesListUL = document.getElementById('definedRoutinesList');
    const activeRoutineCountDisplay = document.getElementById('activeRoutineCountDisplay');
    const totalRoutineSlotsDisplay = document.getElementById('totalRoutineSlotsDisplay');
    
    // Control buttons
    const attackButton = document.getElementById('attackButton');
    const restartButton = document.getElementById('restartButton');

    // Category styling configuration
    const categoryStyles = {
        "other": { bgColor: "#90ee90", textColorClass: "category-other-text" },
        "career": { bgColor: "#4a90e2" },
        "creativity": { bgColor: "#f5a623" },
        "financial": { bgColor: "#50e3c2" },
        "health": { bgColor: "#e91e63" },
        "lifestyle": { bgColor: "#bd10e0" },
        "relationships": { bgColor: "#f8e71c", textColorClass: "category-relationships-text" },
        "spirituality": { bgColor: "#7ed321" }
    };

    // (The old SUBTASK CREATION CALL CHAIN MAP comment lived here 2025-07 →
    // 2026-07-18. Every line number and location in it was stale — the code it
    // described now lives in js/items.js, js/spawning.js, and js/ui/popups.js.
    // See docs/ARCHITECTURE.md for the current module map.)

    let baseHealth, playerXP, playerLevel, playerPoints, routineSlots;
    // Shop inventory ([P1-UI-008], 2026-07-18): plain object, item id -> held
    // count (absent key = 0). Owned in script.js like the other scalars; reached
    // via getPlayerInventory/setPlayerInventory accessor deps. See js/shop.js.
    let playerInventory = {};
    // Sick Day (frozen-slots sub-session 5, 2026-07-19): GLOBAL marker — the
    // one occurrence date ('YYYY-MM-DD') a Sick Day token is currently
    // excusing for EVERY habit, or null. Mirrors playerInventory's ownership
    // pattern (owned here, reached via getSickDayDate/setSickDayDate deps).
    // See js/items.js's useSickDayGlobally.
    let sickDayDate = null;
    let activeItems = [];
    let completedItems = [];
    let definedHabits = [];
    let definedRoutines = [];
    let itemIdCounter, gameLoopInterval, gameIsOver, daysSurvived, currentGameDate;
    // Wall-clock ms when the current run started — "days survived" is derived
    // from this rather than counted by a timer (see computeDaysSurvived).
    let runStartedAtMs = null;
    // Wall-clock ms of the previous game-loop tick, used to detect a suspended
    // loop (laptop sleep / throttled tab). See runLiveGapCatchUp.
    let lastLoopTickMs = null;
    // Wall-clock ms of the last base-regen tick ([P2-GAME-012], 2026-07-18).
    // null until the loop's first tick after a fresh game/restore plants it;
    // see js/loop.js's updateActiveItems and js/damage.js's applyElapsedRegen.
    let lastRegenTickMs = null;
    let attackMode = false;


    // --- Game Settings ---
    // Values live in js/config.js (CONFIG) — never hardcode a balance number here.
    const XP_PER_TASK_DEFEAT = CONFIG.XP_PER_TASK_DEFEAT;
    const XP_PER_HABIT_COMPLETE = CONFIG.XP_PER_HABIT_COMPLETE;
    const POINTS_PER_TASK = CONFIG.POINTS_PER_TASK;
    const POINTS_PER_HABIT = CONFIG.POINTS_PER_HABIT;
    const HABIT_STREAK_BONUS_THRESHOLD = CONFIG.HABIT_STREAK_BONUS_THRESHOLD;
    const LEVEL_XP_THRESHOLDS = CONFIG.LEVEL_XP_THRESHOLDS;
    const ROUTINE_SLOTS_PER_LEVEL = CONFIG.ROUTINE_SLOTS_PER_LEVEL;
    const MAX_PLAYER_LEVEL = LEVEL_XP_THRESHOLDS.length;

    let GAME_SCREEN_WIDTH, BASE_WIDTH, ENEMY_WIDTH, HABIT_ENEMY_WIDTH;

    // Real implementation lives in js/state.js (Milestone 2 extraction,
    // session 11, 2026-07-18) — thin wrapper so this call site is unchanged.
    // Storage for the state it touches stays in script.js (see stateDeps()
    // and js/state.js's header for why ownership didn't move this session).
    function initGame() {
        State.initGame(stateDeps());
    }

    // Real calendar days elapsed since the run started. Math lives in
    // js/damage.js (Milestone 2 extraction #3, 2026-07-18) — thin wrapper so
    // the call sites are unchanged.
    function computeDaysSurvived() {
        return Damage.computeDaysSurvived(runStartedAtMs, Date.now(), CONFIG.MS_PER_REAL_DAY);
    }

    // Thin wrappers — real implementations live in js/ui/hud.js
    // (Milestone 2 UI extraction session 2, 2026-07-18). Call sites unchanged.
    function updatePlayerDisplays() {
        Hud.updatePlayerDisplays({
            playerXP, playerLevel, playerPoints, routineSlots,
            pointsPerTask: POINTS_PER_TASK,
            playerXpDisplay, playerLevelDisplay, playerPointsDisplay, totalRoutineSlotsDisplay,
            playerPointsStat, playerPointsNudge
        });
    }

    function updateTaskCountDisplay() {
        Hud.updateTaskCountDisplay({ activeItems, taskCountDisplay });
    }

    // --- Persistence (js/persistence.js) ---
    // schemaVersion 1 persists the CURRENT in-memory shapes as-is; see
    // docs/DATA_SCHEMA.md + DECISIONS.md (2026-07-17). Call saveGame() after
    // every state mutation — Persistence debounces the actual write.

    function getPersistableState() {
        return State.getPersistableState(stateDeps());
    }

    function saveGame() {
        State.saveGame(stateDeps());
    }

    // Safety net: some edit paths (routine editors, task edit modal) don't call
    // saveGame() directly yet — a periodic save bounds any loss to a few seconds.
    let lastAutosaveMs = 0;

    // True while the offline catch-up animation owns enemy positions;
    // updateActiveItems() skips position/damage work until it finishes.
    let offlineCatchUpActive = false;

    // --- Damage / base health (js/damage.js) ---
    // Milestone 2 extraction #3 (2026-07-18). js/damage.js is the only module so
    // far that WRITES script.js-owned state (baseHealth, gameIsOver), so it gets
    // accessors rather than raw values; see the header comment in js/damage.js
    // for why ownership didn't move. Rebuilt per call because BASE_WIDTH and the
    // DOM handles aren't resolved until initGame() runs.
    function damageDeps() {
        return State.buildDamageDeps(stateDeps());
    }

    // Runs ONCE on boot, right after initGame() has reset to a fresh state.
    // Returns true if a save was restored.
    function restoreGameState() {
        return State.restoreGameState(stateDeps());
    }

    // Builds the deps object for js/state.js's initGame/restoreGameState/
    // getPersistableState/saveGame/buildDamageDeps (Milestone 2 extraction,
    // session 11, 2026-07-18). Rebuilt per call, same reasoning as
    // itemsDeps()/damageDeps(): BASE_WIDTH/GAME_SCREEN_WIDTH aren't resolved
    // until initGame() runs, and several fields (completedItems,
    // definedHabits, currentGameDate, etc.) are REASSIGNED elsewhere
    // (new-game reset, restoreGameState itself), so they're threaded through
    // as get/set accessor pairs rather than plain values — extending the
    // js/damage.js precedent for script.js-owned state a module needs to
    // both read and write.
    function stateDeps() {
        return {
            // DOM
            gameCanvas, baseElement, baseHealthDisplay, gameOverMessage,
            levelUpMessage, restartButton, activeItemsListUL, attackButton,

            // state getters
            getBaseHealth: () => baseHealth,
            getPlayerXP: () => playerXP,
            getPlayerLevel: () => playerLevel,
            getPlayerPoints: () => playerPoints,
            getRoutineSlots: () => routineSlots,
            getPlayerInventory: () => playerInventory,
            getSickDayDate: () => sickDayDate,
            getItemIdCounter: () => itemIdCounter,
            getDaysSurvived: () => daysSurvived,
            getRunStartedAtMs: () => runStartedAtMs,
            getCurrentGameDate: () => currentGameDate,
            getActiveItems: () => activeItems,
            getCompletedItems: () => completedItems,
            getDefinedHabits: () => definedHabits,
            getDefinedRoutines: () => definedRoutines,
            getGameLoopInterval: () => gameLoopInterval,
            isGameOver: () => gameIsOver,
            baseWidth: BASE_WIDTH,
            gameScreenWidth: GAME_SCREEN_WIDTH,

            // state setters
            setGameScreenWidth: (n) => { GAME_SCREEN_WIDTH = n; },
            setBaseWidth: (n) => { BASE_WIDTH = n; },
            setEnemyWidth: (n) => { ENEMY_WIDTH = n; },
            setHabitEnemyWidth: (n) => { HABIT_ENEMY_WIDTH = n; },
            setPlayerXP: (n) => { playerXP = n; },
            setPlayerLevel: (n) => { playerLevel = n; },
            setPlayerPoints: (n) => { playerPoints = n; },
            setRoutineSlots: (n) => { routineSlots = n; },
            setPlayerInventory: (obj) => { playerInventory = obj; },
            setSickDayDate: (d) => { sickDayDate = d; },
            setBaseHealth: (n) => { baseHealth = n; },
            setActiveItems: (arr) => { activeItems = arr; },
            setCompletedItems: (arr) => { completedItems = arr; },
            setDefinedHabits: (arr) => { definedHabits = arr; },
            setDefinedRoutines: (arr) => { definedRoutines = arr; },
            setItemIdCounter: (n) => { itemIdCounter = n; },
            setGameIsOver: (v) => { gameIsOver = v; },
            setGameOver: () => { gameIsOver = true; },
            setDaysSurvived: (n) => { daysSurvived = n; },
            setRunStartedAtMs: (n) => { runStartedAtMs = n; },
            setLastLoopTickMs: (n) => { lastLoopTickMs = n; },
            getLastRegenTickMs: () => lastRegenTickMs,
            setLastRegenTickMs: (n) => { lastRegenTickMs = n; },
            setAttackMode: (v) => { attackMode = v; },
            setCurrentGameDate: (d) => { currentGameDate = d; },
            setGameLoopInterval: (id) => { gameLoopInterval = id; },
            setOfflineCatchUpActive: (v) => { offlineCatchUpActive = v; },

            // collaborators
            updatePlayerDisplays,
            updateTaskCountDisplay,
            updateRoutineDisplay,
            updateBaseVisuals,
            generateDailyHabitInstances,
            generateDailyRoutineTaskInstances,
            // Day-advance mechanism (2026-07-19): restore-path day rollover.
            settleStaleRecurringInstance,
            // Sub-session 4 ([P1-DATA-005], check-in prompt, 2026-07-19): the
            // check-in-eligible counterpart, called instead for the single
            // most-recent prior day's negative-habit lurker.
            markPendingCheckIn,
            // Sub-session 5 (Cheat Day token, 2026-07-19): checked FIRST,
            // ahead of the check-in-eligible fork above.
            isCheatDayExcusedForItem,
            settleExcusedCheatDay,
            addItemToGame,
            createListItem,
            renderDefinedRoutines,
            renderCompletedItems,
            sortAndRenderActiveList,
            gameOver,
            runOfflineCatchUp,
            updateGame,

            // damage-deps passthrough
            markAsOverdue,
            getSubTaskClusterOffset,
            calculateTimelineXWithClustering,
            enableFormControls,
            saveGame,
            // [P1-DATA-005] session 27 — negative-habit lurker exclusion
            isNonThreatening: Items.isNonThreatening,
        };
    }

    // Offline catch-up math + animation live in js/damage.js (Milestone 2
    // extraction #3, 2026-07-18 — this is the code deliberately deferred from
    // the clock.js extraction). Thin wrappers so all call sites are unchanged.
    function computeOfflineOverdueDamage(dueMs, nowMs, offlineMs, alreadyCharged) {
        return Damage.computeOfflineOverdueDamage(dueMs, nowMs, offlineMs, alreadyCharged);
    }

    function applyOfflineDamage(hits) {
        Damage.applyOfflineDamage(hits, damageDeps());
    }

    // Offline catch-up animation lives in js/damage.js (Milestone 2 extraction
    // #3, 2026-07-18) — thin wrapper so the call site is unchanged.
    function runOfflineCatchUp(entries, offlineMs) {
        Damage.runOfflineCatchUp(entries, offlineMs, damageDeps());
    }

    // Level-up math lives in js/progression.js (Milestone 2 extraction,
    // 2026-07-18) — thin wrapper so this call site is unchanged. A single
    // completion can cross more than one threshold; Progression.checkLevelUp
    // walks all of them in one call instead of the old recursive self-call.
    // No-op since the 2026-07-18 legacy-inline-form deletion (see DECISIONS.md)
    // removed the only elements this ever disabled — a hidden, unreachable
    // form div, never the live FAB/modal buttons. Kept only because
    // js/damage.js's gameOver() still calls deps.enableFormControls(false)
    // unconditionally; real behavior (disabling creation on game over, if
    // wanted at all) belongs to the future UI extraction, not this cleanup.
    function enableFormControls(enabled) {}

    function checkPlayerLevelUp() {
        const result = Progression.checkLevelUp(
            { level: playerLevel, xp: playerXP, slots: routineSlots },
            LEVEL_XP_THRESHOLDS, ROUTINE_SLOTS_PER_LEVEL, MAX_PLAYER_LEVEL
        );

        if (!result.leveledUp) return false;

        playerLevel = result.level;
        updatePlayerDisplays();
        showLevelUpMessage();

        if (result.slotsUnlocked) {
            routineSlots = result.slots;
            updatePlayerDisplays();
            updateRoutineDisplay();
        }

        return true;
    }

    // Thin wrapper — real implementation lives in js/ui/hud.js
    // (Milestone 2 UI extraction session 2, 2026-07-18). Call site unchanged.
    function showLevelUpMessage() {
        Hud.showLevelUpMessage({ playerLevel, levelUpMessage });
    }

    // --- Items (js/items.js) ---
    // Milestone 2 extraction session 10, 2026-07-18 — see js/items.js's header
    // comment for the full rationale (this was never part of the UI extraction
    // plan; found during session 10's scoping, see docs/DECISIONS.md/ROADMAP.md).
    //
    // activeItems is a plain reference (agendaListDeps() precedent).
    // completedItems/definedHabits are GETTERS (reassigned elsewhere — new-game
    // reset, restoreGameState). gameIsOver is a GETTER for the same reason
    // js/spawning.js uses one (handlers can outlive the call). playerXP/
    // playerPoints get get/set accessor pairs, matching js/damage.js's
    // baseHealth/gameIsOver precedent for script.js-owned state a module needs
    // to WRITE. gameScreenWidth/baseWidth/enemyWidth/habitEnemyWidth are plain
    // values rebuilt fresh on every call (not resolved until initGame() runs —
    // same reasoning as damageDeps()). Habits/CONFIG are called as bare stable
    // globals inside js/items.js itself, not threaded through here.
    // definedRoutines is a GETTER too (added "Frozen routine slots" sub-session
    // 1, 2026-07-19) — same reassignment reason as definedHabits. FrozenSlots
    // is called as a bare stable global inside js/items.js, same as Habits/CONFIG.
    function itemsDeps() {
        return {
            activeItems,
            completedItems: () => completedItems,
            definedHabits: () => definedHabits,
            // Frozen routine slots ("Frozen routine slots + recovery" ticket,
            // sub-session 1, 2026-07-19): items.js looks up a negative
            // habit's owning routine to check/clear frozenState. GETTER for
            // the same reassignment reason as definedHabits above.
            definedRoutines: () => definedRoutines,
            // Sub-session 3 (2026-07-19): notifies the player exactly once
            // when a routine freezes. FrozenNotice is a small dedicated UI
            // module (js/ui/frozenNotice.js), same "module called as a bare
            // stable global from inside a script.js wrapper" pattern as
            // CheckIn.showCheckInModal above.
            onRoutineFrozen: (routine, habitDef) => {
                FrozenNotice.showFrozenRoutineNotice(routine.name, habitDef.name);
            },
            isGameOver: () => gameIsOver,
            getPlayerXP: () => playerXP,
            setPlayerXP: (n) => { playerXP = n; },
            getPlayerPoints: () => playerPoints,
            setPlayerPoints: (n) => { playerPoints = n; },
            // Frozen-slots sub-session 5 (2026-07-19): Items.useSickDayGlobally
            // writes the global Sick Day marker through this setter.
            setSickDayDate: (d) => { sickDayDate = d; },
            gameScreenWidth: GAME_SCREEN_WIDTH,
            baseWidth: BASE_WIDTH,
            enemyWidth: ENEMY_WIDTH,
            habitEnemyWidth: HABIT_ENEMY_WIDTH,
            habitStreakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD,
            xpPerTaskDefeat: XP_PER_TASK_DEFEAT,
            xpPerHabitComplete: XP_PER_HABIT_COMPLETE,
            pointsPerTask: POINTS_PER_TASK,
            pointsPerHabit: POINTS_PER_HABIT,
            getNextId: () => itemIdCounter++,
            gameCanvas,
            handleEnemyClick, createListItem, sortAndRenderActiveList,
            resetAllSubTaskCheckboxes, updateTaskCountDisplay, renderCompletedItems,
            updatePlayerDisplays, checkPlayerLevelUp, saveGame,
            calculateTimelineXWithClustering, getSubTaskClusterOffset, getItemTopPosition
        };
    }

    // Thin wrapper — real implementation lives in js/items.js (Milestone 2
    // extraction session 10, 2026-07-18). Call site unchanged.
    function createTaskItemData(name, category, isHighPriority, dueDateStr, dueTimeStr, parentId) {
        return Items.createTaskItemData(name, category, isHighPriority, dueDateStr, dueTimeStr, parentId, itemsDeps());
    }

    // Enemy admission (sprite build, positioning, overdue-on-spawn) lives in
    // js/spawning.js (Milestone 2 extraction, 2026-07-17). Thin wrapper passes
    // script.js's collaborators + dims via deps; every call site is unchanged.
    function addItemToGame(itemData) {
        return Spawning.addItemToGame(itemData, {
            gameCanvas,
            activeItems,
            baseWidth: BASE_WIDTH,
            dims: {
                enemyWidth: ENEMY_WIDTH,
                habitEnemyWidth: HABIT_ENEMY_WIDTH,
                subtaskEnemyWidth: CONFIG.SUBTASK_ENEMY_WIDTH,
                habitStreakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD
            },
            getItemTopPosition,
            getSubTaskClusterOffset,
            handleEnemyClick,
            createListItem,
            markAsOverdue,
            updateTaskCountDisplay,
            sortAndRenderActiveList,
            saveGame,
            isGameOver: () => gameIsOver
        });
    }

    // Thin wrappers — real implementations live in js/ui/agendaList.js
    // (Milestone 2 UI extraction sessions 6-7, 2026-07-18). Call sites
    // unchanged.
    //
    // isGameOver is passed as a GETTER, not a boolean: createListItem attaches
    // click handlers that outlive this call (the "+ Sub-task" button reads the
    // flag when clicked), so a snapshotted value would go stale after game
    // over. Same reason js/spawning.js passes `isGameOver: () => gameIsOver`.
    // activeItems and categoryStyles are stable bindings, so plain references
    // are correct for those. completedItems and definedHabits are GETTERS
    // (session 7) because both are REASSIGNED elsewhere (new-game reset,
    // restoreGameState) rather than only mutated in place.
    function agendaListDeps() {
        return {
            activeItems, categoryStyles, completeItem,
            isGameOver: () => gameIsOver,
            showEditTaskModal, showEditHabitInstanceModal, createSubTaskPrompt,
            activeItemsListUL,
            completedItems: () => completedItems,
            uncompleteItem,
            definedHabits: () => definedHabits,
            showEditHabitForm
        };
    }

    function createListItem(itemData) {
        return AgendaList.createListItem(itemData, agendaListDeps());
    }

    function showEditHabitInstanceModal(itemData) {
        AgendaList.showEditHabitInstanceModal(itemData, agendaListDeps());
    }

    // Thin wrappers — real implementations live in js/ui/popups.js
    // (Milestone 2 UI extraction session 5, 2026-07-18). Call sites
    // unchanged. Two dead local `today` variables (computed, never used)
    // were dropped during the move — zero behavior effect, verified by
    // Grep before removing.
    function popupsDeps() {
        return {
            gameIsOver, activeItems, completeItem, indulgeHabit, createListItem,
            sortAndRenderActiveList, saveGame, recomputeOverdueStateAfterEdit,
            createTaskItemData, addItemToGame,
            // Pushback ([P1-UI-008] session 4): the pushback tiers, a live
            // points getter (popup re-checks affordability after each buy),
            // and the handler that pays + shifts the target's due date.
            pushbackCatalog: CONFIG.SHOP_ITEMS.filter(i => i.category === 'pushback'),
            getPlayerPoints: () => playerPoints,
            onPushback: handlePushback,
            // Cheat Day targeting ([P1-DATA-005] sub-session 5, 2026-07-19):
            // held count for the popup's "Use Cheat Day (N held)" button,
            // whether THIS lurker's day already has one active (shows the
            // "active" note instead), and the handler that consumes a token
            // + sets the target habit definition's cheatDayDate.
            getCheatDayHeldCount: () => Shop.heldCount(playerInventory, 'cheat_day'),
            isCheatDayActiveForItem: (item) => {
                const habitDef = definedHabits.find(def => def.id === item.definitionId);
                return !!habitDef && Items.isCheatDayExcused(habitDef, item.originalDueDate);
            },
            onUseCheatDay: handleUseCheatDay,
            // Skip Day targeting (frozen-slots sub-session 5, 2026-07-19):
            // held count for the popup's "Use Skip Day (N held)" button
            // (shown for ANY habit type, not just negative — see popups.js's
            // buildSkipDaySectionHtml) and the handler that consumes a token
            // + excuses + removes the targeted instance.
            getSkipDayHeldCount: () => Shop.heldCount(playerInventory, 'skip_day'),
            onUseSkipDay: handleUseSkipDay
        };
    }

    function handleEnemyClick(itemId) {
        Popups.handleEnemyClick(itemId, popupsDeps());
    }

    function showTaskDetailsPopup(item) {
        Popups.showTaskDetailsPopup(item, popupsDeps());
    }

    function showEditTaskModal(item) {
        Popups.showEditTaskModal(item, popupsDeps());
    }

    // Thin wrappers — real implementations live in js/items.js (Milestone 2
    // extraction session 10, 2026-07-18). Call sites unchanged.
    function completeItem(itemId) {
        Items.completeItem(itemId, itemsDeps());
    }

    // Thin wrapper — real implementation lives in js/items.js (sub-session
    // 2b, 2026-07-19, [P1-DATA-005]). Call site wired from popupsDeps().
    function indulgeHabit(itemId) {
        Items.indulgeHabit(itemId, itemsDeps());
    }

    function removeItem(itemId) {
        Items.removeItem(itemId, itemsDeps());
    }

    // Thin wrapper — real implementation lives in js/items.js (day-advance
    // mechanism, 2026-07-19). Called by state.js's restoreGameState for each
    // prior-day recurring instance at day rollover. Call site: stateDeps().
    function settleStaleRecurringInstance(item) {
        Items.settleStaleRecurringInstance(item, itemsDeps());
    }

    // Thin wrappers — real implementations live in js/items.js (sub-session 4,
    // [P1-DATA-005], 2026-07-19, check-in prompt). markPendingCheckIn is
    // called by state.js's restoreGameState (stateDeps()); resolvePendingCheckIn
    // is called by js/ui/checkIn.js when the player answers a check-in card
    // (checkInDeps()).
    function markPendingCheckIn(item) {
        Items.markPendingCheckIn(item, itemsDeps());
    }

    function resolvePendingCheckIn(habitDefId, outcome) {
        Items.resolvePendingCheckIn(habitDefId, outcome, itemsDeps());
    }

    // Thin wrappers — real implementations live in js/items.js (sub-session 5,
    // [P1-DATA-005], 2026-07-19, Cheat Day token). Called by state.js's
    // restoreGameState (stateDeps()) ahead of the check-in-eligible fork.
    function isCheatDayExcusedForItem(item) {
        const habitDef = definedHabits.find(def => def.id === item.definitionId);
        return !!habitDef && Items.isCheatDayExcused(habitDef, item.originalDueDate);
    }

    function settleExcusedCheatDay(item) {
        Items.settleExcusedCheatDay(item, itemsDeps());
    }

    // Builds the deps object for js/ui/checkIn.js's showCheckInModal
    // (sub-session 4, [P1-DATA-005], 2026-07-19). definedHabits is a GETTER
    // (reassigned on new-game reset / restoreGameState), matching the
    // itemsDeps() precedent.
    function checkInDeps() {
        return {
            getDefinedHabits: () => definedHabits,
            resolvePendingCheckIn,
        };
    }

    // Shows the check-in modal if restoring the save left any pendingCheckIn
    // markers (state.js's rollover routing). Safe to call unconditionally —
    // CheckIn.showCheckInModal no-ops when nothing is pending.
    function showCheckInIfPending() {
        if (typeof CheckIn !== 'undefined') {
            CheckIn.showCheckInModal(checkInDeps());
        }
    }

    function createSubTaskPrompt(parentId) {
        Popups.createSubTaskPrompt(parentId, popupsDeps());
    }

    function showCreateSubTaskModal(parentId) {
        Popups.showCreateSubTaskModal(parentId, popupsDeps());
    }

    // Thin wrapper — real implementation lives in js/items.js (Milestone 2
    // extraction session 10, 2026-07-18). Call site unchanged.
    function uncompleteItem(itemId) {
        Items.uncompleteItem(itemId, itemsDeps());
    }

    function sortAndRenderActiveList() {
        AgendaList.sortAndRenderActiveList(agendaListDeps());
    }

    function resetAllSubTaskCheckboxes() {
        AgendaList.resetAllSubTaskCheckboxes();
    }

    function renderCompletedItems() {
        AgendaList.renderCompletedItems(agendaListDeps());
    }

    // Thin wrappers — real implementations live in js/items.js (Milestone 2
    // extraction session 10, 2026-07-18). Call sites unchanged.
    function markAsOverdue(item, currentTime) {
        Items.markAsOverdue(item, currentTime, itemsDeps());
    }

    // Re-derives isOverdue from the item's CURRENT dueDateTime — call after any
    // edit that changes an item's due date, since isOverdue is otherwise only
    // ever set forward by markAsOverdue/updateActiveItems and never re-checked.
    // Without this, editing an overdue task's deadline into the future left it
    // camped at the base still taking damage (see showEditTaskModal save
    // handler, DECISIONS.md 2026-07-17).
    function recomputeOverdueStateAfterEdit(item) {
        Items.recomputeOverdueStateAfterEdit(item, itemsDeps());
    }

    // Sub-task cluster offset + visible-edge math live in js/movement.js
    // (Milestone 2 extraction, 2026-07-17). Thin wrapper — call site unchanged.
    function getSubTaskClusterOffset(item) {
        return Movement.getSubTaskClusterOffset(item, {
            activeItems,
            enemyWidth: ENEMY_WIDTH
        });
    }

    // Sub-task clustering vs own-urgency logic lives in js/movement.js
    // (Milestone 2 extraction, 2026-07-17). Thin wrapper — call site unchanged.
    function calculateTimelineXWithClustering(item, currentTime) {
        return Movement.calculateTimelineXWithClustering(item, currentTime, {
            activeItems,
            dims: {
                gameScreenWidth: GAME_SCREEN_WIDTH,
                baseWidth: BASE_WIDTH,
                enemyWidth: ENEMY_WIDTH,
                habitEnemyWidth: HABIT_ENEMY_WIDTH
            }
        });
    }

    // Sub-task-vs-parent vertical alignment lives in js/movement.js (Milestone 2
    // extraction, 2026-07-17). Wrapper reads the live canvas height (DOM) here;
    // call site unchanged.
    function getItemTopPosition(item, itemHeight) {
        return Movement.getItemTopPosition(item, itemHeight, {
            activeItems,
            canvasHeight: gameCanvas.offsetHeight
        });
    }

    // Timeline position math lives in js/clock.js (Milestone 2 extraction,
    // 2026-07-17) — thin wrapper so every existing call site is unchanged.
    function calculateTimelinePosition(item, currentTime) {
        return Clock.calculateTimelinePosition(item, currentTime, {
            gameScreenWidth: GAME_SCREEN_WIDTH,
            baseWidth: BASE_WIDTH,
            enemyWidth: ENEMY_WIDTH,
            habitEnemyWidth: HABIT_ENEMY_WIDTH
        });
    }

    // --- Game loop (js/loop.js) ---
    // Milestone 2 extraction session 12, 2026-07-18 — the per-tick loop
    // (updateGame/updateActiveItems) was the last real game logic in this
    // file. Thin wrappers so all call sites (setInterval in state.js's
    // initGame via stateDeps().updateGame, offline catch-up) are unchanged.
    function loopDeps() {
        return {
            isGameOver: () => gameIsOver,
            isOfflineCatchUpActive: () => offlineCatchUpActive,
            activeItems,
            baseWidth: BASE_WIDTH,
            gameScreenWidth: GAME_SCREEN_WIDTH,
            getLastLoopTickMs: () => lastLoopTickMs,
            setLastLoopTickMs: (n) => { lastLoopTickMs = n; },
            getLastRegenTickMs: () => lastRegenTickMs,
            setLastRegenTickMs: (n) => { lastRegenTickMs = n; },
            getLastAutosaveMs: () => lastAutosaveMs,
            setLastAutosaveMs: (n) => { lastAutosaveMs = n; },
            markAsOverdue,
            getSubTaskClusterOffset,
            calculateTimelineXWithClustering,
            damageBase,
            healBase,
            updateMidnightLine,
            runLiveGapCatchUp,
            saveGame,
            // [P1-DATA-005] session 27 — negative-habit lurker exclusion
            isNonThreatening: Items.isNonThreatening,
        };
    }

    function updateActiveItems() {
        Loop.updateActiveItems(loopDeps());
    }
    // Midnight-line math lives in js/clock.js (Milestone 2 extraction,
    // 2026-07-17) — thin wrapper so the call site is unchanged.
    function updateMidnightLine(currentTime) {
        Clock.updateMidnightLine(currentTime, {
            gameScreenWidth: GAME_SCREEN_WIDTH,
            baseWidth: BASE_WIDTH
        });
    }

    // Base sprite / damage / game-over all live in js/damage.js (Milestone 2
    // extraction #3, 2026-07-18) — thin wrappers so all call sites are unchanged.
    function updateBaseVisuals() {
        Damage.updateBaseVisuals(damageDeps());
    }

    function damageBase(amount) {
        Damage.damageBase(amount, damageDeps());
    }

    // Gradual base regen ([P2-GAME-012], 2026-07-18) — thin wrapper, call
    // site unchanged pattern (js/loop.js's updateActiveItems).
    function healBase(amount) {
        Damage.healBase(amount, damageDeps());
    }

    function gameOver() {
        Damage.gameOver(damageDeps());
    }

    // Suspended-loop (sleep / throttled tab) catch-up lives in js/damage.js
    // (Milestone 2 extraction #3, 2026-07-18) — thin wrapper, call site unchanged.
    function runLiveGapCatchUp() {
        Damage.runLiveGapCatchUp(damageDeps());
    }

    function updateGame() {
        Loop.updateGame(loopDeps());
    }

    // Habit system functions
    function createHabitDefinition(name, category, scheduleOrFrequency, timeOfDay, isNegative = false) {
        const newHabitDef = {
            id: `habitDef_${definedHabits.length}_${Date.now()}`,
            name,
            category,
            // Recurrence is a `schedule` object as of schemaVersion 3 (2026-07-18).
            // Schedule.normalize accepts either a full schedule object (the
            // scheduling UI, session 15) or a legacy bare frequency string
            // (any older caller), so this one call handles both.
            schedule: Schedule.normalize(scheduleOrFrequency),
            timeOfDay,
            isNegative,
            // null = standalone (not owned by any routine), so it spawns daily
            // regardless of routine state. See docs/DATA_SCHEMA.md's Habit shape
            // and Habits.selectHabitDefsToSpawn.
            routineId: null,
            streak: 0,
            lastCompletionDate: null,
            // Seeded empty; the rate-based points bonus (future session) records
            // into this. See DECISIONS.md 2026-07-18.
            occurrenceHistory: [],
            // [P1-DATA-005] sub-session 5 (Cheat Day token, 2026-07-19,
            // schemaVersion 5): null = no active excused day. Only meaningful
            // for negative habits, but seeded on every habit for shape
            // consistency with the persisted/migrated form.
            cheatDayDate: null,
            // Frozen routine slots (schemaVersion 6, 2026-07-19): recovery
            // path 1 (edit-to-unfreeze) appends to this. See js/frozenSlots.js.
            // Only meaningful for routine-owned negative habits, seeded on
            // every habit for shape consistency (same reasoning as cheatDayDate).
            modificationHistory: [],
            // Frozen-slots sub-session 5 (Sick/Skip Day tokens, 2026-07-19,
            // schemaVersion 7): null = no active excused day for THIS habit.
            // Seeded on every habit (not just negative ones — Skip Day
            // applies to any habit type). See js/items.js's useSkipDayOnItem.
            skipDayDate: null
        };

        definedHabits.push(newHabitDef);
        generateDailyHabitInstances(currentGameDate);
        saveGame();
    }

    // Habit instance creation, daily spawn selection, and streak math live in
    // js/habits.js (Milestone 2 extraction, 2026-07-18) — the functions below
    // are thin wrappers so every existing call site is unchanged. See
    // js/habits.js's header comment for the deps shape and the one
    // deliberately-preserved pre-existing bug (streak-bonus asymmetry).
    function habitInstanceDeps() {
        return {
            getNextId: () => itemIdCounter++,
            calculateTimelinePosition,
            gameScreenWidth: GAME_SCREEN_WIDTH,
            habitEnemyWidth: HABIT_ENEMY_WIDTH,
            // [P1-DATA-005] session 27, repositioned session 29 — a negative
            // habit's fixed lurk x anchors to the far right of the canvas
            // (gameScreenWidth above), not the base.
            negativeLurkRightMarginPx: CONFIG.NEGATIVE_LURK_RIGHT_MARGIN_PX,
            definedHabits,
            definedRoutines,
            activeItems,
            addItemToGame,
            sortAndRenderActiveList,
            // Frozen-slots sub-session 5 (2026-07-19): the global Sick Day
            // spawn gate — see Habits.selectHabitDefsToSpawn.
            sickDayDate
        };
    }

    function getHabitInstanceDueTime(timeOfDayString, referenceDate) {
        return Habits.getHabitInstanceDueTime(timeOfDayString, referenceDate);
    }

    function createHabitInstanceData(habitDef, forDate) {
        return Habits.createHabitInstanceData(habitDef, forDate, habitInstanceDeps());
    }

    function generateDailyHabitInstances(forWhichGameDay) {
        Habits.generateDailyHabitInstances(forWhichGameDay, habitInstanceDeps());
    }

    // --- Routine task instances (2026-07-18) ---
    // Routine TASKS previously had no spawn path at all: createNewTaskInRoutine
    // stored a definition in definedTasks and nothing ever turned it into a live
    // item, so a task added through a routine could never appear on the board or
    // in the agenda (see docs/DECISIONS.md). Routine tasks recur DAILY, the same
    // as routine habits — decided with Jeremy 2026-07-18.

    // Routine task instance helpers now live in js/routines.js (Milestone 2
    // extraction #6, 2026-07-18) — thin wrappers so every call site is
    // unchanged. See docs/ARCHITECTURE.md / DECISIONS.md.
    function routineTaskInstanceDeps() {
        return {
            getNextId: () => itemIdCounter++,
            gameScreenWidth: GAME_SCREEN_WIDTH,
            enemyWidth: ENEMY_WIDTH,
            calculateTimelineXWithClustering,
            definedTasks: window.definedTasks || (window.definedTasks = []),
            definedRoutines,
            activeItems,
            completedItems,
            addItemToGame,
            sortAndRenderActiveList
        };
    }

    function getRoutineTaskInstanceDueTime(defaultDueTime, referenceDate) {
        return Routines.getRoutineTaskInstanceDueTime(defaultDueTime, referenceDate);
    }

    function createRoutineTaskInstanceData(taskDef, forDate) {
        return Routines.createRoutineTaskInstanceData(taskDef, forDate, routineTaskInstanceDeps());
    }

    // Daily spawn pass for routine tasks, mirroring generateDailyHabitInstances.
    function generateDailyRoutineTaskInstances(forWhichGameDay) {
        Routines.generateDailyRoutineTaskInstances(forWhichGameDay, routineTaskInstanceDeps());
    }

    // Routine management functions
    function createRoutineDefinition() {
        const result = Routines.createRoutineDefinition(routineNameInput.value, definedRoutines);
        if (!result.ok) {
            alert(result.reason === 'empty' ? "Please enter a routine name." : "Routine name already exists.");
            return;
        }

        definedRoutines.push(result.routine);
        routineNameInput.value = '';
        renderDefinedRoutines();
        saveGame();
    }

    function deleteRoutine(routineId) {
        const routine = definedRoutines.find(r => r.id === routineId);
        if (!routine) return;

        if (confirm(`Are you sure you want to delete the routine "${routine.name}"?`)) {
            // Recalls active habit/task instances before removing the routine
            // — see js/routines.js's deleteRoutine for the bugfix rationale
            // and DECISIONS.md.
            Routines.deleteRoutine(routineId, { definedRoutines, activeItems, removeItem });
            saveGame();

            // Update routines window if open
            setTimeout(() => {
                if (managementWindows.routines && !managementWindows.routines.classList.contains('hidden')) {
                    populateRoutinesWindow();
                }
            }, 100);
        }
    }
    // Pre-existing bug (found live 2026-07-18, right after the routines
    // extraction): showRoutineManagement's Delete Routine button uses an
    // inline onclick="deleteRoutine(...)" string, which runs in GLOBAL scope
    // — but deleteRoutine was only ever a closure-scoped function inside this
    // DOMContentLoaded wrapper, never attached to window like its siblings
    // (window.closeModal, window.saveNewHabit, window.saveNewTask,
    // window.saveEditedHabit, window.saveEditedTask). The click silently
    // failed to find the function. Not introduced by the routines.js
    // extraction — the function body moved, but its scope didn't change.
    window.deleteRoutine = deleteRoutine;
    
    // Thin wrapper — real implementation lives in js/ui/routineViews.js
    // (Milestone 2 UI extraction session 9, 2026-07-18). Call site unchanged.
    function attachRoutineManagementListeners(routineId) {
        RoutineViews.attachRoutineManagementListeners(routineId, routineViewsDeps());
    }

    function removeHabitFromRoutine(routineId, habitDefId) {
        if (Routines.removeHabitFromRoutine(routineId, habitDefId, definedRoutines, definedHabits)) {
            renderDefinedRoutines();
            saveGame();
        }
    }

    function createNewHabitInRoutine(routineId, habitData) {
        const newHabit = Routines.createNewHabitInRoutine(routineId, habitData, definedRoutines, definedHabits);
        if (!newHabit) return;

        generateDailyHabitInstances(currentGameDate);
        renderDefinedRoutines();
        saveGame();
    }

    function createNewTaskInRoutine(routineId, taskData) {
        if (!window.definedTasks) window.definedTasks = [];
        const newTaskDef = Routines.createNewTaskInRoutine(routineId, taskData, definedRoutines, definedTasks);
        if (!newTaskDef) return;

        // Spawn today's instance immediately, matching createNewHabitInRoutine.
        // Without this the definition existed but never became a live enemy —
        // the task appeared in the routine window only. See DECISIONS.md.
        generateDailyRoutineTaskInstances(currentGameDate);
        renderDefinedRoutines();
        saveGame();
    }

    // Sub-session 4 (2026-07-19): passes definedRoutines + an
    // onRoutineUnfrozen notifier so a real edit to the habit that froze its
    // routine clears frozenState and shows the one-time unfreeze notice
    // (recovery path 1, docs/FROZEN_SLOTS_PLAN.md). Same
    // "module called as bare stable global" pattern as itemsDeps()'s
    // onRoutineFrozen.
    function editHabitInRoutine(habitId, updatedData) {
        if (Routines.editHabitInRoutine(habitId, updatedData, definedHabits, definedRoutines, {
            onRoutineUnfrozen: (routine, habitDef) => {
                FrozenNotice.showRoutineUnfrozenNotice(routine.name, habitDef.name);
            }
        })) {
            renderDefinedRoutines();

            // Update the FAB->Routines popup if open — same staleness fix as
            // deleteRoutine (it's a separate windowing system from Modal's
            // overlays, so renderDefinedRoutines() alone doesn't touch it).
            // See docs/ROADMAP.md Known bugs / DECISIONS.md session 38/40.
            setTimeout(() => {
                if (managementWindows.routines && !managementWindows.routines.classList.contains('hidden')) {
                    populateRoutinesWindow();
                }
            }, 100);
        }
    }

    function editTaskInRoutine(taskId, updatedData) {
        if (Routines.editTaskInRoutine(taskId, updatedData, definedTasks)) {
            renderDefinedRoutines();
        }
    }

    function removeTaskFromRoutine(routineId, taskId) {
        Routines.removeTaskFromRoutine(routineId, taskId, definedRoutines);
    }

    // Thin wrappers — real implementations live in js/ui/routineViews.js
    // (Milestone 2 UI extraction sessions 8-9, 2026-07-18). Call sites
    // unchanged.
    //
    // definedRoutines/definedHabits cross in as GETTERS (reassigned
    // elsewhere in script.js — new-game reset, restoreGameState), matching
    // agendaList.js part 2's precedent (session 7). definedTasks has no
    // local declaration at all (always `window.definedTasks`), so the
    // module reads it as a bare global directly — no dep needed. activeItems
    // is a plain reference, matching agendaListDeps()'s established
    // precedent (see that function's comment above).
    // definedRoutinesListUL/activeRoutineCountDisplay/managementWindows are
    // stable const DOM refs.
    //
    // Session 9 moved cluster F's form half into the module — the six
    // formerly-passed function refs (showEditHabitForm,
    // populateHabitSelectDropdown, showCreateHabitForm, showEditTaskForm,
    // showCreateTaskForm, attachRoutineManagementListeners) are now
    // module-internal calls and no longer appear here. Added instead:
    // managementWindows/populateRoutinesWindow (routine-status-toggle
    // refresh), saveGame, createNewHabitInRoutine/createNewTaskInRoutine/
    // editHabitInRoutine/editTaskInRoutine (the four save* handlers),
    // activeItems/createListItem/sortAndRenderActiveList (saveEditedHabit's
    // live-instance sync).
    function routineViewsDeps() {
        return {
            definedRoutinesListUL, activeRoutineCountDisplay, managementWindows,
            definedRoutines: () => definedRoutines,
            definedHabits: () => definedHabits,
            toggleRoutineActive, deleteRoutine, removeHabitFromRoutine, removeTaskFromRoutine,
            addHabitToRoutine, populateRoutinesWindow, saveGame,
            createNewHabitInRoutine, createNewTaskInRoutine, editHabitInRoutine, editTaskInRoutine,
            activeItems, createListItem, sortAndRenderActiveList
        };
    }

    function renderDefinedRoutines() {
        RoutineViews.renderDefinedRoutines(routineViewsDeps());
    }

    // Thin wrapper — real implementation lives in js/ui/routineViews.js
    // (Milestone 2 UI extraction session 9, 2026-07-18). Call site unchanged.
    function populateHabitSelectDropdown(selectElement) {
        RoutineViews.populateHabitSelectDropdown(selectElement, routineViewsDeps());
    }

    function addHabitToRoutine(routineId, habitDefId) {
        const result = Routines.addHabitToRoutine(routineId, habitDefId, definedRoutines, definedHabits);
        if (!result.ok) {
            alert(result.reason === 'not-found' ? 'Error finding routine or habit.' : 'Habit already in routine.');
            return;
        }

        renderDefinedRoutines();
    }

    // selectActiveItemIdsToClearForRoutine/clearActiveInstancesForRoutine/
    // toggleRoutineActive now live in js/routines.js (Milestone 2 extraction
    // #6, 2026-07-18) — thin wrappers so every call site is unchanged. See
    // docs/ARCHITECTURE.md / DECISIONS.md.
    function selectActiveItemIdsToClearForRoutine(activeItemsList, routine) {
        return Routines.selectActiveItemIdsToClearForRoutine(activeItemsList, routine);
    }

    function clearActiveInstancesForRoutine(routineId) {
        Routines.clearActiveInstancesForRoutine(routineId, { definedRoutines, activeItems, removeItem });
    }

    function toggleRoutineActive(routineId) {
        Routines.toggleRoutineActive(routineId, {
            definedRoutines,
            routineSlots,
            activeItems,
            removeItem,
            alert,
            generateDailyHabitInstances,
            generateDailyRoutineTaskInstances,
            currentGameDate,
            saveGame
        });
    }
    
    // Thin wrapper — real implementation lives in js/ui/routineViews.js
    // (Milestone 2 UI extraction session 9, 2026-07-18). Call site unchanged.
    function showAddItemToRoutineModal(routineId, itemType) {
        RoutineViews.showAddItemToRoutineModal(routineId, itemType, routineViewsDeps());
    }

    function updateRoutineDisplay() {
        RoutineViews.updateRoutineDisplay(routineViewsDeps());
    }

    // Thin wrappers — real implementations live in js/ui/routineViews.js
    // (Milestone 2 UI extraction session 9, 2026-07-18). Call sites
    // unchanged. These four take no deps (pure HTML-string builders).
    function showCreateHabitForm(routineId) {
        RoutineViews.showCreateHabitForm(routineId);
    }

    function showCreateTaskForm(routineId) {
        RoutineViews.showCreateTaskForm(routineId);
    }

    function showEditHabitForm(routineId, habitDef) {
        RoutineViews.showEditHabitForm(routineId, habitDef);
    }

    function showEditTaskForm(routineId, taskDef) {
        RoutineViews.showEditTaskForm(routineId, taskDef);
    }

    // Global functions for modal interactions — thin wrappers, real
    // implementations live in js/ui/routineViews.js (session 9, 2026-07-18).
    // Kept as window.* (not plain functions) because the create/edit form
    // HTML's inline onclick="saveNewHabit(...)" etc. needs the window-level
    // name, same reasoning as window.closeModal/window.deleteRoutine above.
    window.saveNewHabit = function(routineId) {
        RoutineViews.saveNewHabit(routineId, routineViewsDeps());
    };

    window.saveNewTask = function(routineId) {
        RoutineViews.saveNewTask(routineId, routineViewsDeps());
    };

    window.saveEditedHabit = function(habitId) {
        RoutineViews.saveEditedHabit(habitId, routineViewsDeps());
    };

    window.saveEditedTask = function(taskId) {
        RoutineViews.saveEditedTask(taskId, routineViewsDeps());
    };

    // Thin wrapper — real implementation lives in js/ui/modal.js
    // (Milestone 2 UI extraction session 1, 2026-07-18). Call site unchanged.
    window.closeModal = Modal.closeModal;
    
    // Add escape key listener for closing modals and windows
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close any open modals first
            const modals = document.querySelectorAll('.modal-overlay');
            if (modals.length > 0) {
                closeModal();
                return;
            }
            
            // Close any open management windows
            closeAllManagementWindows();
            
            // Close FAB menu
            closeFabMenu();
        }
    });

    // Floating Action Button and Window Management
    const fabButton = document.getElementById('fabButton');
    const fabMenu = document.getElementById('fabMenu');
    console.log('FAB Button found:', fabButton);
    console.log('FAB Menu found:', fabMenu);
    const managementWindows = {
        tasks: document.getElementById('tasksWindow'),
        habits: document.getElementById('habitsWindow'),
        routines: document.getElementById('routinesWindow'),
        shop: document.getElementById('shopWindow')
    };
    
    // Thin wrappers — real implementations live in js/ui/fabMenu.js and
    // js/ui/managementWindows.js (Milestone 2 UI extraction session 3,
    // 2026-07-18). Call sites unchanged. toggleFabMenu's 6 debug console.log
    // lines were removed as pure noise during the move — see fabMenu.js header.
    function toggleFabMenu() {
        FabMenu.toggleFabMenu({ fabMenu, fabButton });
    }

    function closeFabMenu() {
        FabMenu.closeFabMenu({ fabMenu, fabButton });
    }

    function openManagementWindow(type) {
        ManagementWindows.openManagementWindow(type, {
            managementWindows, closeFabMenu, activeItems, definedHabits,
            definedRoutines, routineSlots, showRoutineManagement, toggleRoutineActive,
            shopCatalog: CONFIG.SHOP_ITEMS, playerInventory, playerPoints, baseHealth,
            onShopBuy: handleShopPurchase, onShopUse: handleShopUse
        });
    }

    function closeAllManagementWindows() {
        ManagementWindows.closeAllManagementWindows({ managementWindows });
    }

    function closeManagementWindow(windowId) {
        ManagementWindows.closeManagementWindow(windowId, { managementWindows });
    }

    function populateTasksWindow() {
        ManagementWindows.populateTasksWindow({ activeItems });
    }

    function populateHabitsWindow() {
        ManagementWindows.populateHabitsWindow({ definedHabits });
    }

    function populateRoutinesWindow() {
        ManagementWindows.populateRoutinesWindow({
            definedRoutines, routineSlots, showRoutineManagement, toggleRoutineActive
        });
    }

    // Shop ([P1-UI-008] SHOP_PLAN.md session 2, 2026-07-18). populateShopWindow
    // mirrors the populateTasksWindow/populateHabitsWindow wrappers above, but
    // calls ShopView (a different module) directly rather than routing back
    // through ManagementWindows, since ShopView owns no per-type dispatch logic
    // of its own to reuse.
    function populateShopWindow() {
        ShopView.renderShopWindow({
            catalog: CONFIG.SHOP_ITEMS, inventory: playerInventory, playerPoints, baseHealth,
            onBuy: handleShopPurchase, onUse: handleShopUse
        });
    }

    // Buy-one-unit handler wired to every catalog card's Buy button (session 2).
    // Shop.purchase is pure — this applies its result to state, persists, and
    // re-renders both the shop grid (new price/held count) and the points HUD.
    // Pushback targeting is session 4 — buying only fills playerInventory
    // today; repair-kit USE (below) closes the loop for repair kits.
    function handleShopPurchase(itemId) {
        const result = Shop.purchase(itemId, CONFIG.SHOP_ITEMS, playerInventory, playerPoints);
        if (!result.ok) {
            // Buy button is disabled whenever unaffordable, so this is a
            // defensive no-op guard (e.g. a stale render) rather than the
            // expected path — still give feedback if it happens.
            ShopView.showShopMessage('Not enough points for that.');
            return;
        }

        playerPoints = result.newPoints;
        playerInventory = result.newInventory;
        updatePlayerDisplays();
        saveGame();

        // Deferred, not synchronous: populateShopWindow() replaces
        // #shopWindowList's innerHTML, which DETACHES the very Buy button
        // that's still bubbling this click event up to document's "click
        // outside closes windows" listener (script.js, ~line 1086). That
        // listener does `e.target.closest('.management-window')` — on a
        // button already removed from the DOM this returns null, so it reads
        // as an outside click and closes the window immediately after every
        // purchase. Found live-testing this session (see DECISIONS.md).
        // setTimeout(0) lets the click finish bubbling before the rebuild.
        setTimeout(populateShopWindow, 0);
    }

    // Use-one-held-unit handler wired to each repair-kit card's Use button
    // (session 3, SHOP_PLAN.md, 2026-07-19; extended sub-session 5, 2026-07-19
    // to Sick Day — same card-Use shape, different category branch). Shop.consume
    // is pure — decrements the held count (never below zero); the actual effect
    // branches on category:
    //   - repair (healAmount): existing healBase(amount) wrapper (script.js,
    //     ~line 569 — built for base regen [P2-GAME-012]), which clamps at
    //     CONFIG.MAX_BASE_HEALTH, updates the health display/sprite, and
    //     calls saveGame() internally.
    //   - sickDay: handleUseSickDay() (global excuse-and-sweep, see its own
    //     comment) — no per-item effect payload, just the category check.
    // playerInventory is updated BEFORE calling either effect so its internal
    // save (repair) or the explicit saveGame() (sick day) already captures the
    // decremented count.
    function handleShopUse(itemId) {
        const item = Shop.getItem(itemId, CONFIG.SHOP_ITEMS);
        if (!item || !item.consumable) return;
        const isRepairKit = item.effect && typeof item.effect.healAmount === 'number';
        const isSickDay = item.category === 'sickDay';
        if (!isRepairKit && !isSickDay) return;

        const result = Shop.consume(itemId, playerInventory);
        if (!result.ok) {
            // Use button is only rendered when held > 0, so this is a
            // defensive no-op guard rather than the expected path.
            ShopView.showShopMessage("You don't have one of those to use.");
            return;
        }

        playerInventory = result.newInventory;
        if (isRepairKit) {
            healBase(item.effect.healAmount);
        } else {
            handleUseSickDay();
        }

        // Same event-bubbling hazard as handleShopPurchase (see its comment
        // above, and SHOP_PLAN.md's hazards list) — defer the rebuild so the
        // click finishes bubbling with its target still attached.
        setTimeout(populateShopWindow, 0);
    }

    // Pushback handler wired to each enemy popup's tier buttons (session 4,
    // SHOP_PLAN.md). Called with the shop item id + the TARGET enemy the popup
    // is about. Pays via Shop.purchase (pushback is non-consumable, so
    // inventory is returned unchanged — it just does the affordability check +
    // point math in one place), then shifts the target's due date later by the
    // tier's amount (pure Shop.pushedBackDueDate), re-derives overdue state
    // (un-camps + repositions the zombie if it crossed into the future), and
    // re-renders the agenda row. Pricing is flat this session (Jeremy's call
    // 2026-07-19) — no per-run inflation; that's a session-5 balance decision.
    // Returns { ok } so the popup can refresh its UI in place. Stacking is
    // allowed (ECONOMY.md) — repeated calls just push the same item further.
    function handlePushback(itemId, targetItem) {
        const item = Shop.getItem(itemId, CONFIG.SHOP_ITEMS);
        if (!item || item.category !== 'pushback' || !item.effect || typeof item.effect.pushbackMs !== 'number') {
            return { ok: false };
        }
        if (!targetItem) return { ok: false };

        const result = Shop.purchase(itemId, CONFIG.SHOP_ITEMS, playerInventory, playerPoints);
        if (!result.ok) {
            // Tier buttons are disabled when unaffordable, so this is a
            // defensive guard rather than the expected path.
            return { ok: false };
        }

        playerPoints = result.newPoints;
        targetItem.dueDateTime = Shop.pushedBackDueDate(targetItem.dueDateTime, item.effect.pushbackMs);

        // Re-derive overdue state from the NEW due date — same reasoning as the
        // Edit Task save path (js/ui/popups.js showEditTaskModal): without this
        // a pushed-back overdue zombie stays camped at the base ticking damage.
        // A non-overdue item pushed further out just gets repositioned by the
        // next 50ms game-loop tick (Loop.updateActiveItems).
        recomputeOverdueStateAfterEdit(targetItem);

        // Refresh the target's agenda row (its due time changed) + re-sort.
        if (targetItem.listItemElement) {
            targetItem.listItemElement.remove();
            if (!targetItem.parentId) createListItem(targetItem);
        }
        sortAndRenderActiveList();
        updatePlayerDisplays();
        saveGame();

        return { ok: true, newPoints: playerPoints };
    }

    // Cheat Day targeting handler ([P1-DATA-005] sub-session 5, 2026-07-19),
    // wired to a negative-habit lurker popup's "Use Cheat Day" button
    // (js/ui/popups.js). Mirrors handlePushback's shape (called with the shop
    // item id + the TARGET instance), but Cheat Day is a HELD consumable —
    // the button only renders once you already hold one, so this goes
    // through Shop.consume (decrement), not Shop.purchase (buy). Sets the
    // target habit definition's `cheatDayDate` to the lurker's occurrence
    // date (Habits.toOccurrenceDate) — items.js's indulgeHabit/
    // resolvePendingCheckIn check this to excuse that day's indulgence for
    // free (no debit, no occurrence, streak untouched — session 26, Fable).
    // Returns { ok } so the popup can rebuild itself (deferred via
    // setTimeout(0) — see popups.js's comment on why in-place isn't safe here).
    function handleUseCheatDay(cheatDayItemId, targetItem) {
        const item = Shop.getItem(cheatDayItemId, CONFIG.SHOP_ITEMS);
        if (!item || item.category !== 'cheatDay') return { ok: false };
        if (!targetItem || targetItem.type !== 'habit' || !targetItem.isNegative) return { ok: false };

        const habitDef = definedHabits.find(def => def.id === targetItem.definitionId);
        if (!habitDef) return { ok: false };

        const result = Shop.consume(cheatDayItemId, playerInventory);
        if (!result.ok) {
            // Button is only rendered when held > 0, so this is a defensive
            // guard rather than the expected path.
            return { ok: false };
        }

        playerInventory = result.newInventory;
        habitDef.cheatDayDate = Habits.toOccurrenceDate(targetItem.originalDueDate);

        updatePlayerDisplays();
        saveGame();

        return { ok: true };
    }

    // Skip Day targeting handler (frozen-slots sub-session 5, 2026-07-19),
    // wired to ANY habit instance's popup "Use Skip Day" button (js/ui/
    // popups.js) — not restricted to negative lurkers, unlike Cheat Day.
    // Same held-consumable shape as handleUseCheatDay (Shop.consume, not
    // Shop.purchase), but the actual excuse-and-remove logic lives in
    // Items.useSkipDayOnItem ("clear immediately" model, Jeremy's call,
    // 2026-07-19) since — unlike Cheat Day — there's no later indulge/
    // complete/rollover branch to also wire; the instance is gone the
    // moment the token lands.
    function handleUseSkipDay(skipDayItemId, targetItem) {
        const item = Shop.getItem(skipDayItemId, CONFIG.SHOP_ITEMS);
        if (!item || item.category !== 'skipDay') return { ok: false };
        if (!targetItem || targetItem.type !== 'habit') return { ok: false };

        const result = Shop.consume(skipDayItemId, playerInventory);
        if (!result.ok) {
            // Button is only rendered when held > 0, so this is a defensive
            // guard rather than the expected path.
            return { ok: false };
        }

        playerInventory = result.newInventory;
        Items.useSkipDayOnItem(targetItem, itemsDeps());

        updatePlayerDisplays();
        saveGame();

        return { ok: true };
    }

    // Sick Day GLOBAL apply handler (frozen-slots sub-session 5, 2026-07-19),
    // wired to the Sick Day shop card's own "Use" button (js/ui/shopView.js's
    // handleShopUse sick-day branch) — untargeted, unlike Cheat/Skip Day.
    // Sets the global sickDayDate marker + sweeps every currently active
    // habit instance for today off the board (Items.useSickDayGlobally,
    // "clear immediately" model). Routine tasks are untouched (fork 4,
    // docs/FROZEN_SLOTS_PLAN.md — Sick Day is habits-only).
    function handleUseSickDay() {
        Items.useSickDayGlobally(currentGameDate, itemsDeps());
        updatePlayerDisplays();
        saveGame();
    }

    function showRoutineManagement(routineId) {
        RoutineViews.showRoutineManagement(routineId, routineViewsDeps());
    }

    function populateRoutineHabits(routine) {
        RoutineViews.populateRoutineHabits(routine, routineViewsDeps());
    }

    function populateRoutineTasks(routine) {
        RoutineViews.populateRoutineTasks(routine);
    }

    // Thin wrappers — real implementations live in js/ui/forms.js
    // (Milestone 2 UI extraction session 4, 2026-07-18). Call sites
    // unchanged. The routine-creation branch was reconciled to call
    // Routines.createRoutineDefinition (adds a previously-missing
    // saveGame() call) — see js/ui/forms.js header and DECISIONS.md.
    function formsDeps() {
        return {
            createTaskItemData, addItemToGame, sortAndRenderActiveList,
            managementWindows, populateTasksWindow,
            createHabitDefinition, populateHabitsWindow,
            definedRoutines, saveGame, populateRoutinesWindow, openManagementWindow
        };
    }

    function showFormModal(formType) {
        Forms.showFormModal(formType, formsDeps());
    }

    // Note: createTaskFormHtml/createHabitFormHtml/createRoutineFormHtml had
    // no callers outside showFormModal's old switch statement (verified by
    // Grep before removing them here) — Forms.showFormModal now calls its
    // own module-scoped copies internally, so no script.js wrapper is
    // needed for them.
    function attachModalEventListeners(formType) {
        Forms.attachModalEventListeners(formType, formsDeps());
    }

    // Forms are now handled through dedicated modal functions above
    
    // Event Listeners
    if (fabButton) {
        fabButton.addEventListener('click', toggleFabMenu);
    } else {
        console.error('FAB button not found — creation UI unavailable');
    }
    
    // FAB menu item listeners
    document.querySelectorAll('.fab-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.type;
            openManagementWindow(type);
        });
    });
    
    // Close window listeners
    document.querySelectorAll('.close-window').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const windowId = e.target.dataset.window;
            closeManagementWindow(windowId);
        });
    });
    
    // Close windows when clicking outside
    document.addEventListener('click', (e) => {
        // Handle clicking outside management windows
        const anyWindowOpen = Object.values(managementWindows).some(w => 
            w && !w.classList.contains('hidden')
        );
        
        if (anyWindowOpen && !e.target.closest('.management-window') && !e.target.closest('.fab-container')) {
            // Don't close if clicking on a modal
            if (!e.target.closest('.modal-overlay')) {
                closeAllManagementWindows();
            }
        }
        
        // Close modals when clicking outside
        const modal = e.target.closest('.modal-overlay');
        if (e.target.classList.contains('modal-overlay')) {
            closeModal();
        }
    });
    
    // Add new item button listeners
    const addNewTaskButton = document.getElementById('addNewTaskButton');
    const addNewHabitButton = document.getElementById('addNewHabitButton');
    const addNewRoutineButton = document.getElementById('addNewRoutineButton');
    
    if (addNewTaskButton) {
        addNewTaskButton.addEventListener('click', () => {
            closeManagementWindow('tasksWindow');
            showFormModal('task');
        });
    }
    
    if (addNewHabitButton) {
        addNewHabitButton.addEventListener('click', () => {
            closeManagementWindow('habitsWindow');
            showFormModal('habit');
        });
    }
    
    if (addNewRoutineButton) {
        addNewRoutineButton.addEventListener('click', () => {
            closeManagementWindow('routinesWindow');
            showFormModal('routine');
        });
    }
    
    // Close FAB menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.fab-container')) {
            closeFabMenu();
        }
    });

    if (createRoutineButton) {
        createRoutineButton.addEventListener('click', createRoutineDefinition);
    }

    if (attackButton) {
        attackButton.addEventListener('click', () => {
            attackMode = !attackMode;
            attackButton.classList.toggle('active', attackMode);
            gameCanvas.style.cursor = attackMode ? 'crosshair' : 'default';
        });
    }

    if (restartButton) {
        restartButton.addEventListener('click', () => {
            // A restart abandons the dead run — clear its save so a reload
            // before the first new mutation doesn't resurrect it.
            if (typeof Persistence !== 'undefined') Persistence.clear();
            initGame();
            saveGame();
        });
    }

    // Dev/testing only: full reset to a fresh, empty game. Unlike the restart
    // button (which keeps habit/routine DEFINITIONS and re-seeds today's habit
    // instances via initGame), this also wipes definedHabits/definedRoutines so
    // the next generateDailyHabitInstances() has nothing to re-create. Clears
    // the save and persists the empty state, so no reload or flush-guard needed.
    const resetTestButton = document.getElementById('resetTestButton');
    if (resetTestButton) {
        resetTestButton.addEventListener('click', () => {
            if (!confirm('Reset the game to a fresh state? This clears all tasks, habits, routines, and progress.')) return;
            definedHabits = [];
            definedRoutines = [];
            window.definedTasks = [];
            if (typeof Persistence !== 'undefined') Persistence.clear();
            initGame();
            saveGame();
        });
    }

    // Initialize definedTasks array
    if (!window.definedTasks) window.definedTasks = [];
    
    // Thin wrapper — real implementation lives in js/ui/hud.js
    // (Milestone 2 UI extraction session 2, 2026-07-18). Call site unchanged.
    // NOTE: unreferenced anywhere in script.js — dead code, extracted as-is
    // per the plan's cluster boundary, not removed. See js/ui/hud.js header.
    function showDebugInfo(functionName, data) {
        Hud.showDebugInfo(functionName, data);
    }
    
    // Initialize the game
    initGame();
    restoreGameState();
    // Sub-session 4 ([P1-DATA-005], check-in prompt, 2026-07-19): if the
    // rollover just ran (above) and left any negative-habit pendingCheckIn
    // markers, prompt for them now.
    showCheckInIfPending();

    // Flush any pending debounced save when the page hides or closes.
    // visibilitychange covers mobile Chrome, where beforeunload is unreliable.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && typeof Persistence !== 'undefined') {
            Persistence.flush();
        }
    });
    window.addEventListener('beforeunload', () => {
        if (typeof Persistence !== 'undefined') Persistence.flush();
    });
});

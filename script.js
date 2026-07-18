document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const gameCanvas = document.getElementById('gameCanvas');
    const baseElement = document.getElementById('base');
    const baseHealthDisplay = document.getElementById('baseHealthDisplay');
    const playerXpDisplay = document.getElementById('playerXpDisplay');
    const playerLevelDisplay = document.getElementById('playerLevelDisplay');
    const playerPointsDisplay = document.getElementById('playerPointsDisplay');
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

    /*
    ============================================================================
    SUBTASK CREATION CALL CHAIN MAP
    ============================================================================
    
    UI EVENT LISTENERS & CALL FLOW:
    
    1. "+ Sub-task" Button Click (Line ~525)
       └── addSubTaskButton.addEventListener('click', () => {
           └── createSubTaskPrompt(itemData.id)  [Line 527]
    
    2. createSubTaskPrompt(parentId)  [Line 895]
       └── showCreateSubTaskModal(parentId)  [Line 896]
    
    3. showCreateSubTaskModal(parentId)  [Line 899]
       ├── Creates modal HTML with form inputs
       ├── Finds parent task from activeItems array
       └── Sets up "Create Sub-task" button event listener
           └── createButton.addEventListener('click', (event) => {  [Line 964]
    
    4. "Create Sub-task" Button Click Handler  [Line 964]
       ├── Validates form inputs (name, dueDate required)
       ├── Calls: createTaskItemData(name, category, isHighPriority, dueDate, dueTime, parentId)  [Line 991]
       ├── Updates parent task: parentTask.subTasks.push(subTaskData.id)  [Line 1001]
       ├── Calls: addItemToGame(subTaskData)  [Line 1005]
       ├── Refreshes parent's list item display  [Line 1008-1011]
       └── Calls: closeModal()  [Line 1017]
    
    5. createTaskItemData(name, category, isHighPriority, dueDateStr, dueTimeStr, parentId)  [Line 266]
       ├── Creates task data object with parentId field
       ├── Handles due date inheritance from parent if none provided
       ├── Sets up subtask hierarchy fields (parentId, subTasks[], etc.)
       └── Returns: taskData object with all properties
    
    6. addItemToGame(itemData)  [Line 336]
       ├── Creates DOM enemy element (smaller size for subtasks)
       ├── Adds subtask-specific CSS classes ('subtask-enemy', 'zombie-subtask')
       ├── Does NOT create list item for subtasks (only for top-level tasks)
       ├── Positions element on game canvas
       └── Adds to activeItems array
    
    TASK OBJECT CONSTRUCTION:
    - Task objects are constructed in createTaskItemData() [Line 266]
    - Key subtask properties: parentId, subTasks[], completedSubTasks, totalSubTasks
    - Subtasks inherit due date from parent if not specified
    
    UI RENDERING:
    - Subtasks are rendered within their parent's list item in createListItem() [Line 422]
    - Parent tasks show subtask list with individual controls [Line 537-620]
    - Subtasks get their own game canvas sprites but no separate list items
    
    ============================================================================
    */

    let baseHealth, playerXP, playerLevel, playerPoints, routineSlots;
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
    let attackMode = false;


    // --- Game Settings ---
    // Values live in js/config.js (CONFIG) — never hardcode a balance number here.
    const GAME_TICK_MS = CONFIG.GAME_TICK_MS;
    const OVERDUE_DAMAGE = CONFIG.OVERDUE_DAMAGE;
    const DAMAGE_INTERVAL_MS = CONFIG.DAMAGE_INTERVAL_MS;
    const XP_PER_TASK_DEFEAT = CONFIG.XP_PER_TASK_DEFEAT;
    const XP_PER_HABIT_COMPLETE = CONFIG.XP_PER_HABIT_COMPLETE;
    const POINTS_PER_TASK = CONFIG.POINTS_PER_TASK;
    const POINTS_PER_HABIT = CONFIG.POINTS_PER_HABIT;
    const HABIT_STREAK_BONUS_THRESHOLD = CONFIG.HABIT_STREAK_BONUS_THRESHOLD;
    const LEVEL_XP_THRESHOLDS = CONFIG.LEVEL_XP_THRESHOLDS;
    const ROUTINE_SLOTS_PER_LEVEL = CONFIG.ROUTINE_SLOTS_PER_LEVEL;
    const MAX_PLAYER_LEVEL = LEVEL_XP_THRESHOLDS.length;

    let GAME_SCREEN_WIDTH, BASE_WIDTH, ENEMY_WIDTH, HABIT_ENEMY_WIDTH;

    function initGame() {
        // Calculate dimensions
        GAME_SCREEN_WIDTH = gameCanvas.offsetWidth;
        BASE_WIDTH = baseElement.offsetWidth;
        ENEMY_WIDTH = CONFIG.ENEMY_WIDTH;
        HABIT_ENEMY_WIDTH = CONFIG.HABIT_ENEMY_WIDTH;

        // Initialize player stats
        playerXP = 0;
        playerLevel = 1;
        playerPoints = 0;
        routineSlots = ROUTINE_SLOTS_PER_LEVEL[playerLevel] || 1;
        
        updatePlayerDisplays();

        // Initialize base
        baseHealth = CONFIG.MAX_BASE_HEALTH;
        baseHealthDisplay.textContent = baseHealth;
        baseElement.style.backgroundImage = "url('base_100.png')";
        baseElement.classList.remove('base-hit-flash');
        
        // Reset UI state
        if (gameOverMessage) gameOverMessage.classList.add('hidden');
        if (levelUpMessage) levelUpMessage.classList.add('hidden');
        if (restartButton) restartButton.classList.add('hidden');

        // Clear active items
        activeItems.forEach(item => {
            if (item.element) item.element.remove();
            if (item.listItemElement) item.listItemElement.remove();
        });
        activeItems = [];
        completedItems = [];
        if (activeItemsListUL) activeItemsListUL.innerHTML = '';
        
        // Hide completed tasks section at game start
        const completedTasksSection = document.getElementById('completedTasksSection');
        if (completedTasksSection) completedTasksSection.classList.add('hidden');
        
        // Reset game state
        itemIdCounter = 1; // never 0 — many parentId checks use truthy tests (`if (item.parentId)`), and 0 is falsy
        gameIsOver = false;
        daysSurvived = 0;
        runStartedAtMs = Date.now();
        lastLoopTickMs = null; // first tick after init establishes the baseline
        attackMode = false;
        if (attackButton) attackButton.classList.remove('active');
        
        // Initialize game date
        currentGameDate = new Date();
        currentGameDate.setHours(0, 0, 0, 0);

        generateDailyHabitInstances(currentGameDate);
        generateDailyRoutineTaskInstances(currentGameDate);
        updateTaskCountDisplay();
        updateRoutineDisplay();

        // Start game loop
        if (gameLoopInterval) clearInterval(gameLoopInterval);
        gameLoopInterval = setInterval(updateGame, GAME_TICK_MS);

        // No day timer: daysSurvived is derived from real elapsed time via
        // computeDaysSurvived(), so it stays correct across sleep/suspension
        // (a timer only advances while the tab is awake). See DECISIONS.md.
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
            playerXpDisplay, playerLevelDisplay, playerPointsDisplay, totalRoutineSlotsDisplay
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
        return {
            baseHealth, playerXP, playerLevel, playerPoints, routineSlots,
            itemIdCounter, gameIsOver, daysSurvived, runStartedAtMs, currentGameDate,
            activeItems, completedItems, definedHabits, definedRoutines,
            // Routine TASK definitions. Previously omitted while
            // routine.taskDefinitionIds WAS saved, so a refresh left those ids
            // dangling against nothing. Additive — no schemaVersion bump needed;
            // older saves simply restore an empty array. See DECISIONS.md.
            definedTasks: window.definedTasks || []
        };
    }

    function saveGame() {
        if (typeof Persistence !== 'undefined') {
            Persistence.requestSave(getPersistableState);
        }
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
        return {
            getBaseHealth: () => baseHealth,
            setBaseHealth: (n) => { baseHealth = n; },
            isGameOver: () => gameIsOver,
            setGameOver: () => { gameIsOver = true; },
            getActiveItems: () => activeItems,
            getRunStartedAtMs: () => runStartedAtMs,
            setDaysSurvived: (n) => { daysSurvived = n; },
            setOfflineCatchUpActive: (v) => { offlineCatchUpActive = v; },
            getGameLoopInterval: () => gameLoopInterval,
            baseWidth: BASE_WIDTH,
            baseElement,
            baseHealthDisplay,
            gameOverMessage,
            restartButton,
            markAsOverdue,
            getSubTaskClusterOffset,
            calculateTimelineXWithClustering,
            enableFormControls,
            saveGame,
        };
    }

    // Runs ONCE on boot, right after initGame() has reset to a fresh state.
    // Returns true if a save was restored.
    function restoreGameState() {
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
        playerXP = save.playerXP || 0;
        playerLevel = save.playerLevel || 1;
        playerPoints = save.playerPoints || 0;
        routineSlots = ROUTINE_SLOTS_PER_LEVEL[playerLevel] || 1;
        baseHealth = (typeof save.baseHealth === 'number') ? save.baseHealth : CONFIG.MAX_BASE_HEALTH;
        itemIdCounter = save.itemIdCounter || 1;
        daysSurvived = save.daysSurvived || 0;
        // Saves written before 2026-07-18 have no runStartedAtMs (days were
        // counted by the old accelerated timer). Fall back to the save's own
        // timestamp so a restored run doesn't report a bogus day count.
        runStartedAtMs = (typeof save.runStartedAtMs === 'number')
            ? save.runStartedAtMs
            : ((save.savedAt instanceof Date && !isNaN(save.savedAt.getTime()))
                ? save.savedAt.getTime()
                : Date.now());
        if (save.currentGameDate instanceof Date && !isNaN(save.currentGameDate.getTime())) {
            currentGameDate = save.currentGameDate;
        }

        // Plain-data collections (no DOM refs to rebuild)
        definedHabits = save.definedHabits || [];
        definedRoutines = save.definedRoutines || [];
        // Saves written before 2026-07-18 have no definedTasks — restore empty
        // rather than leaving whatever the previous page load put on window.
        window.definedTasks = save.definedTasks || [];
        completedItems = (save.completedItems || []).map(item => {
            item.element = null;
            item.listItemElement = null;
            return item;
        });

        // Active items: rebuild DOM via addItemToGame (it pushes into activeItems,
        // which initGame just emptied). Saved order preserves parents-before-subtasks.
        (save.activeItems || []).forEach(item => {
            item.element = null;
            item.listItemElement = null;
            const savedX = (typeof item.x === 'number') ? item.x : null;
            addItemToGame(item);
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

        // Parents' list items were built before their sub-tasks existed in
        // activeItems — rebuild those list items now that everything is loaded.
        activeItems.forEach(item => {
            if (!item.parentId && item.subTasks && item.subTasks.length > 0 && item.listItemElement) {
                item.listItemElement.remove();
                createListItem(item);
            }
        });

        // Spawn today's habit + routine-task instances the save doesn't already
        // contain (both generators dedupe against activeItems/completedItems)
        generateDailyHabitInstances(currentGameDate);
        generateDailyRoutineTaskInstances(currentGameDate);

        // Refresh every display touched above
        updatePlayerDisplays();
        if (baseHealthDisplay) baseHealthDisplay.textContent = baseHealth;
        updateBaseVisuals();
        updateTaskCountDisplay();
        updateRoutineDisplay();
        renderDefinedRoutines();
        renderCompletedItems();
        sortAndRenderActiveList();

        if (save.gameIsOver) gameOver();

        // Offline catch-up: animate zombies from their saved positions to now,
        // then back-charge capped offline overdue damage (see DECISIONS.md).
        if (!gameIsOver) runOfflineCatchUp(restoredEntries, offlineMs);
        return true;
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

    // Task creation and management
    function createTaskItemData(name, category, isHighPriority, dueDateStr, dueTimeStr, parentId) {
        // (Removed 2026-07-18: a parentId debug log added while chasing the
        // sub-task duplication bug. That bug was fixed 2026-07-17 and the log
        // fired hundreds of times per test run, burying real output.)
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
            const parentTask = activeItems.find(item => item.id === parentId && item.type === 'task');
            if (parentTask) {
                dueDateTime = new Date(parentTask.dueDateTime);
            }
        }
        
        // Validate due date but allow past time today
        if (isNaN(dueDateTime.getTime()) || (dueDateTime < creationTime && dueDateStr !== creationTime.toISOString().split('T')[0])) {
            dueDateTime = new Date(creationTime.getTime() + 5 * 60 * 1000);
        }
        
        const taskData = {
            id: itemIdCounter++,
            type: 'task',
            name: name || "Unnamed Task",
            category: category || "other",
            isHighPriority: isHighPriority,
            dueDateTime: dueDateTime,
            creationTime: creationTime,
            timeToDueAtCreationMs: Math.max(0, dueDateTime.getTime() - creationTime.getTime()),
            x: GAME_SCREEN_WIDTH - ENEMY_WIDTH, // Will be recalculated below
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
        taskData.x = calculateTimelineXWithClustering(taskData, creationTime);
        
        return taskData;
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
            gameIsOver, activeItems, completeItem, createListItem,
            sortAndRenderActiveList, saveGame, recomputeOverdueStateAfterEdit,
            createTaskItemData, addItemToGame
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

    function completeItem(itemId) {
        if (gameIsOver) return;

        const itemIndex = activeItems.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;
        
        const item = activeItems[itemIndex];
        let xpGained = 0;
        let pointsGained = 0;
        
        if (item.type === 'task') {
            xpGained = XP_PER_TASK_DEFEAT;
            pointsGained = item.isHighPriority ? POINTS_PER_TASK * 2 : POINTS_PER_TASK;
        } else if (item.type === 'habit') {
            const habitDef = definedHabits.find(def => def.id === item.definitionId);
            if (habitDef) {
                const result = Habits.applyHabitCompletion(habitDef.streak, item.originalDueDate, {
                    xpPerHabitComplete: XP_PER_HABIT_COMPLETE,
                    pointsPerHabit: POINTS_PER_HABIT,
                    streakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD,
                    streakBonusPoints: CONFIG.HABIT_STREAK_BONUS_POINTS
                });
                habitDef.streak = result.streak;
                habitDef.lastCompletionDate = result.lastCompletionDate;
                xpGained = result.xpGained;
                pointsGained = result.pointsGained;
            }
        }
        
        if (xpGained > 0) {
            playerXP += xpGained;
            playerPoints += pointsGained;
            updatePlayerDisplays();
            checkPlayerLevelUp();
        }

        // If this is a sub-task, remove it from parent's sub-task list
        if (item.parentId) {
            const parentTask = activeItems.find(parent => parent.id === item.parentId);
            if (parentTask) {
                const subTaskIndex = parentTask.subTasks.indexOf(itemId);
                if (subTaskIndex > -1) {
                    parentTask.subTasks.splice(subTaskIndex, 1);
                    parentTask.completedSubTasks++;
                    
                    // Refresh parent task's list item to update sub-task display
                    if (parentTask.listItemElement) {
                        parentTask.listItemElement.remove();
                        createListItem(parentTask);
                        sortAndRenderActiveList();
                    }
                }
            }
        }

        // Move item to completed list
        item.completedAt = new Date();
        completedItems.push(item);
        saveGame();
        
        // Show completed tasks section and render completed items
        renderCompletedItems();

        // Fade out animation
        if (item.element) {
            item.element.style.transition = 'opacity 0.5s ease';
            item.element.style.opacity = '0';
        }

        // Remove item after fade animation
        setTimeout(() => {
            removeItem(itemId);
        }, 500);
    }

    function removeItem(itemId) {
        const itemIndex = activeItems.findIndex(i => i.id === itemId);
        if (itemIndex > -1) {
            const item = activeItems[itemIndex];
            
            if (item.element) item.element.remove();
            if (item.listItemElement) item.listItemElement.remove();
            
            activeItems.splice(itemIndex, 1);
            updateTaskCountDisplay();
            saveGame();
        }
    }
    function createSubTaskPrompt(parentId) {
        Popups.createSubTaskPrompt(parentId, popupsDeps());
    }

    function showCreateSubTaskModal(parentId) {
        Popups.showCreateSubTaskModal(parentId, popupsDeps());
    }

    function uncompleteItem(itemId) {
        const completedIndex = completedItems.findIndex(i => i.id === itemId);
        if (completedIndex === -1) return;
        
        const item = completedItems[completedIndex];
        
        
        // Remove from completed items
        completedItems.splice(completedIndex, 1);
        
        // Remove completion timestamp
        delete item.completedAt;
        
        // Reset overdue status (they can start fresh)
        item.isOverdue = false;
        item.lastDamageTickTime = null;
        
        // Recalculate position based on current time
        const currentTime = new Date();
        item.x = calculateTimelineXWithClustering(item, currentTime);

        // Check if it should be marked as overdue
        if (item.dueDateTime <= currentTime) {
            markAsOverdue(item, currentTime);
            item.x = BASE_WIDTH + getSubTaskClusterOffset(item);
        }
        
        // Recreate enemy element
        const itemElement = document.createElement('div');
        itemElement.classList.add('enemy');
        itemElement.classList.add(`category-${item.category}`);
        itemElement.classList.add('zombie-sprite');
        itemElement.classList.add(`zombie-${item.category}`);
        
        const itemSpriteWidth = (item.type === 'habit') ? HABIT_ENEMY_WIDTH : ENEMY_WIDTH;
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
            if (item.streak >= HABIT_STREAK_BONUS_THRESHOLD) {
                itemElement.classList.add('high-streak');
            }
        }
        
        // Position the enemy
        itemElement.style.left = item.x + 'px';
        itemElement.style.top = getItemTopPosition(item, itemSpriteHeight) + 'px';
        
        // Set up click handler
        itemElement.dataset.itemId = item.id;
        itemElement.addEventListener('click', () => handleEnemyClick(item.id));
        
        // Add to game canvas
        gameCanvas.appendChild(itemElement);
        item.element = itemElement;
        
        // Add back to active items first
        activeItems.push(item);
        
        // If this is a sub-task, re-add it to parent's sub-task list
        if (item.parentId) {
            const parentTask = activeItems.find(parent => parent.id === item.parentId);
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
                        createListItem(parentTask);
        // Re-render the active list to show the updated parent task
                        sortAndRenderActiveList();
                        
                        // Force comprehensive checkbox reset after DOM update
                        setTimeout(() => {
                            resetAllSubTaskCheckboxes();
                        }, 10);
                        
                        // Also do an immediate reset
                        resetAllSubTaskCheckboxes();
                    }
                }
            }
        }
        // Note: Sub-tasks should never get their own main list item,
        // they are only displayed within their parent's list item
        
        // Update displays
        updateTaskCountDisplay();
        sortAndRenderActiveList();
        renderCompletedItems();
        
        // Reverse the XP and points gained (if any)
        if (item.type === 'task') {
            const xpLost = XP_PER_TASK_DEFEAT;
            const pointsLost = item.isHighPriority ? POINTS_PER_TASK * 2 : POINTS_PER_TASK;
            
            playerXP = Math.max(0, playerXP - xpLost);
            playerPoints = Math.max(0, playerPoints - pointsLost);
        } else if (item.type === 'habit') {
            const habitDef = definedHabits.find(def => def.id === item.definitionId);
            if (habitDef) {
                const result = Habits.applyHabitUncompletion(habitDef.streak, {
                    xpPerHabitComplete: XP_PER_HABIT_COMPLETE,
                    pointsPerHabit: POINTS_PER_HABIT,
                    streakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD,
                    streakBonusPoints: CONFIG.HABIT_STREAK_BONUS_POINTS
                });
                habitDef.streak = result.streak;
                habitDef.lastCompletionDate = result.lastCompletionDate;

                playerXP = Math.max(0, playerXP - result.xpLost);
                playerPoints = Math.max(0, playerPoints - result.pointsLost);
            }
        }

        updatePlayerDisplays();
        saveGame();
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

    function markAsOverdue(item, currentTime) {
        if (item.isOverdue) return;
        
        item.isOverdue = true;
        item.lastDamageTickTime = item.dueDateTime.getTime();
        
        if (item.element) item.element.classList.add('enemy-at-base');
        if (item.listItemElement) item.listItemElement.classList.add('overdue-list-item');
        
        
        // Reset habit streak if it's a habit
        if (item.type === 'habit') {
            const habitDef = definedHabits.find(def => def.id === item.definitionId);
            if (habitDef) {
                const result = Habits.resetStreakOnOverdue(habitDef.streak);
                habitDef.streak = result.streak;

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
        saveGame();
    }

    // Re-derives isOverdue from the item's CURRENT dueDateTime — call after any
    // edit that changes an item's due date, since isOverdue is otherwise only
    // ever set forward by markAsOverdue/updateActiveItems and never re-checked.
    // Without this, editing an overdue task's deadline into the future left it
    // camped at the base still taking damage (see showEditTaskModal save
    // handler, DECISIONS.md 2026-07-17).
    function recomputeOverdueStateAfterEdit(item) {
        const now = new Date();
        const shouldBeOverdue = item.dueDateTime <= now;

        if (item.isOverdue && !shouldBeOverdue) {
            // Pushed back into the future: un-overdue it.
            item.isOverdue = false;
            item.lastDamageTickTime = null;
            if (item.element) item.element.classList.remove('enemy-at-base');
            if (item.listItemElement) item.listItemElement.classList.remove('overdue-list-item');
            item.x = calculateTimelineXWithClustering(item, now);
            if (item.element) item.element.style.left = Math.max(BASE_WIDTH, item.x) + 'px';
        } else if (!item.isOverdue && shouldBeOverdue) {
            // Pulled into the past: it's overdue starting now.
            markAsOverdue(item, now);
            item.x = BASE_WIDTH + getSubTaskClusterOffset(item);
            if (item.element) item.element.style.left = item.x + 'px';
        }
    }

    // Helper function to get today's 5pm
    function getTodayAt5PM() {
        const today = new Date();
        const fivePM = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0, 0);
        return fivePM;
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

function updateActiveItems() {
    if (gameIsOver) return;
    if (offlineCatchUpActive) return; // catch-up animation owns positions/damage until it completes

    const currentTime = new Date();
    const currentTimeMs = currentTime.getTime();

    for (let i = activeItems.length - 1; i >= 0; i--) {
        const item = activeItems[i];
        
        if (!item.isOverdue) {
            if (item.dueDateTime <= currentTime) {
                // Item just became overdue
                item.x = BASE_WIDTH + getSubTaskClusterOffset(item);
                markAsOverdue(item, currentTime);
            } else {
                // Calculate position based on timeline
                item.x = calculateTimelineXWithClustering(item, currentTime);
            }

            // Update visual position
            if (item.element) {
                item.element.style.left = Math.max(BASE_WIDTH, item.x) + 'px';
            }
        }
        
        // Handle damage from overdue items
        if (item.isOverdue) {
            if (currentTimeMs >= item.lastDamageTickTime + DAMAGE_INTERVAL_MS) {
                damageBase(OVERDUE_DAMAGE);
                item.lastDamageTickTime += DAMAGE_INTERVAL_MS;
                
                if (gameIsOver) break;
            }
        }
    }

    updateMidnightLine(currentTime);
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

    function gameOver() {
        Damage.gameOver(damageDeps());
    }

    // Suspended-loop (sleep / throttled tab) catch-up lives in js/damage.js
    // (Milestone 2 extraction #3, 2026-07-18) — thin wrapper, call site unchanged.
    function runLiveGapCatchUp() {
        Damage.runLiveGapCatchUp(damageDeps());
    }

    function updateGame() {
        if (!gameIsOver) {
            const nowMs = Date.now();

            // Detect a suspended loop before ticking, so the damage catch-up is
            // capped rather than replayed one interval per frame.
            if (lastLoopTickMs !== null && (nowMs - lastLoopTickMs) >= CONFIG.LIVE_GAP_THRESHOLD_MS) {
                runLiveGapCatchUp();
            }
            lastLoopTickMs = nowMs;

            if (gameIsOver) return; // catch-up may have ended the run

            updateActiveItems();

            if (nowMs - lastAutosaveMs >= CONFIG.PERSISTENCE_AUTOSAVE_MS) {
                lastAutosaveMs = nowMs;
                saveGame();
            }
        }
    }

    // Habit system functions
    function createHabitDefinition(name, category, frequency, timeOfDay, isNegative = false) {
        const newHabitDef = {
            id: `habitDef_${definedHabits.length}_${Date.now()}`,
            name,
            category,
            frequency,
            timeOfDay,
            isNegative,
            // null = standalone (not owned by any routine), so it spawns daily
            // regardless of routine state. See docs/DATA_SCHEMA.md's Habit shape
            // and Habits.selectHabitDefsToSpawn.
            routineId: null,
            streak: 0,
            lastCompletionDate: null
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
            definedHabits,
            definedRoutines,
            activeItems,
            addItemToGame,
            sortAndRenderActiveList
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

    function editHabitInRoutine(habitId, updatedData) {
        if (Routines.editHabitInRoutine(habitId, updatedData, definedHabits)) {
            renderDefinedRoutines();
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
        routines: document.getElementById('routinesWindow')
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
            definedRoutines, routineSlots, showRoutineManagement, toggleRoutineActive
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
        console.log('💥 SETTING UP FAB BUTTON EVENT LISTENER');
        fabButton.addEventListener('click', (e) => {
            console.log('💥 FAB BUTTON CLICKED!', e);
            toggleFabMenu();
        });
        
        // Test if the button is accessible
        fabButton.addEventListener('mouseenter', () => {
            console.log('💥 FAB BUTTON MOUSE ENTER');
        });
        
        // Log button properties
        console.log('FAB Button style display:', fabButton.style.display);
        console.log('FAB Button computed style:', window.getComputedStyle(fabButton));
        console.log('FAB Button offsetParent:', fabButton.offsetParent);
        console.log('FAB Button bounding rect:', fabButton.getBoundingClientRect());
    } else {
        console.error('❌ FAB BUTTON NOT FOUND!');
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

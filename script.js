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

    // Habit-specific: resolve an active habit instance back to its definition
    // and open the definition editor. Habits have no per-instance editor today
    // (only the routine-context habitDef editor), so this is the closest
    // correct "edit" action; saveEditedHabit() keeps active instances in sync.
    function showEditHabitInstanceModal(itemData) {
        const habitDef = definedHabits.find(d => d.id === itemData.definitionId);
        if (!habitDef) {
            console.error('Edit habit: no definedHabits entry for definitionId', itemData.definitionId);
            return;
        }
        showEditHabitForm(null, habitDef);
    }

    // Thin wrapper — real implementation lives in js/ui/agendaList.js
    // (Milestone 2 UI extraction session 6, 2026-07-18). Call sites unchanged.
    //
    // isGameOver is passed as a GETTER, not a boolean: createListItem attaches
    // click handlers that outlive this call (the "+ Sub-task" button reads the
    // flag when clicked), so a snapshotted value would go stale after game
    // over. Same reason js/spawning.js passes `isGameOver: () => gameIsOver`.
    // activeItems and categoryStyles are stable bindings, so plain references
    // are correct for those.
    function agendaListDeps() {
        return {
            activeItems, categoryStyles, completeItem,
            isGameOver: () => gameIsOver,
            showEditTaskModal, showEditHabitInstanceModal, createSubTaskPrompt
        };
    }

    function createListItem(itemData) {
        return AgendaList.createListItem(itemData, agendaListDeps());
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
        // Sort by due date (most urgent first)
        activeItems.sort((a, b) => a.dueDateTime - b.dueDateTime);
        
        if (activeItemsListUL) {
            activeItemsListUL.innerHTML = '';
            
            activeItems.forEach(item => {
                // Only show top-level items (not sub-tasks) in the main list
                if (item.listItemElement && !item.parentId) {
                    activeItemsListUL.appendChild(item.listItemElement);
                }
            });
            
            // After rendering, ensure all sub-task checkboxes are properly reset
            setTimeout(() => {
                resetAllSubTaskCheckboxes();
            }, 0);
        }
    }
    
    // Utility function to comprehensively reset all sub-task checkboxes
    function resetAllSubTaskCheckboxes() {
        const allSubTaskCheckboxes = document.querySelectorAll('.sub-task-checkbox');
        console.log(`DEBUG: resetAllSubTaskCheckboxes found ${allSubTaskCheckboxes.length} checkboxes`);
        
        allSubTaskCheckboxes.forEach((checkbox, index) => {
            const wasChecked = checkbox.checked;
            const subTaskId = checkbox.getAttribute('data-sub-task-id');
            
            // Multiple methods to ensure unchecked state
            checkbox.checked = false;
            checkbox.defaultChecked = false;
            checkbox.removeAttribute('checked');
            
            // Force property update
            Object.defineProperty(checkbox, 'checked', {
                value: false,
                writable: true,
                configurable: true
            });
            
            // Re-enable normal property behavior
            delete checkbox.checked;
            checkbox.checked = false;
            
            if (wasChecked) {
                console.log(`DEBUG: Reset checkbox for sub-task ${subTaskId}, was checked: ${wasChecked}, now checked: ${checkbox.checked}`);
            }
        });
    }

    function renderCompletedItems() {
        const completedTasksSection = document.getElementById('completedTasksSection');
        const completedItemsList = document.getElementById('completedItemsList');
        
        if (!completedTasksSection || !completedItemsList) return;
        
        // Show the completed tasks section if there are completed items
        if (completedItems.length > 0) {
            completedTasksSection.classList.remove('hidden');
            
            // Clear existing list
            completedItemsList.innerHTML = '';
            
            // Sort by completion time (most recent first)
            const sortedCompletedItems = [...completedItems].sort((a, b) => b.completedAt - a.completedAt);
            
            sortedCompletedItems.forEach(item => {
                // Only show top-level completed items (not sub-tasks) in the completed list
                if (item.parentId) return;
                
                const li = document.createElement('li');
                li.classList.add('completed-item');
                li.classList.add(`category-${item.category}`);
                
                // Create sprite column
                const itemSpriteDiv = document.createElement('div');
                itemSpriteDiv.classList.add('item-sprite');
                
                // Create item info div
                const itemInfoDiv = document.createElement('div');
                itemInfoDiv.classList.add('item-info');
                
                const itemNameSpan = document.createElement('span');
                itemNameSpan.classList.add('item-name');
                itemNameSpan.textContent = item.name;
                
                const itemCompletedSpan = document.createElement('span');
                itemCompletedSpan.classList.add('item-completed');
                itemCompletedSpan.textContent = `Completed: ${item.completedAt.toLocaleString([], { 
                    dateStyle: 'short', 
                    timeStyle: 'short' 
                })}`;
                
                itemInfoDiv.appendChild(itemNameSpan);
                itemInfoDiv.appendChild(itemCompletedSpan);
                
                // Add category badge
                const itemCategorySpan = document.createElement('span');
                itemCategorySpan.classList.add('item-category');
                itemCategorySpan.textContent = item.category.charAt(0).toUpperCase() + item.category.slice(1);
                
                const currentCategoryStyle = categoryStyles[item.category] || categoryStyles["other"];
                itemCategorySpan.style.backgroundColor = currentCategoryStyle.bgColor;
                if (currentCategoryStyle.textColorClass) {
                    itemCategorySpan.classList.add(currentCategoryStyle.textColorClass);
                }
                itemInfoDiv.appendChild(itemCategorySpan);
                
                // Add completion controls (edit icon and checkbox)
                const itemStatusDiv = document.createElement('div');
                itemStatusDiv.classList.add('item-status');
                itemStatusDiv.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px; align-items: center; height: 100%;';
                
                // Edit icon button
                const editIconButton = document.createElement('button');
                editIconButton.classList.add('edit-icon-btn');
                editIconButton.title = 'Edit Task';
                editIconButton.textContent = '✏️';
                editIconButton.addEventListener('click', () => showEditTaskModal(item));
                itemStatusDiv.appendChild(editIconButton);
                
                // Completion checkbox (pre-checked for completed items)
                const completeCheckboxLabel = document.createElement('label');
                completeCheckboxLabel.classList.add('completion-checkbox');
                
                const completeCheckbox = document.createElement('input');
                completeCheckbox.type = 'checkbox';
                completeCheckbox.classList.add('completion-checkbox-input');
                completeCheckbox.checked = true; // Pre-checked for completed items
                completeCheckbox.addEventListener('change', () => {
                    if (!completeCheckbox.checked) {
                        uncompleteItem(item.id);
                    }
                });
                completeCheckboxLabel.appendChild(completeCheckbox);
                completeCheckboxLabel.appendChild(document.createTextNode(' Completed'));
                
                itemStatusDiv.appendChild(completeCheckboxLabel);
                
                li.appendChild(itemSpriteDiv);
                li.appendChild(itemInfoDiv);
                li.appendChild(itemStatusDiv);
                
                completedItemsList.appendChild(li);
            });
        } else {
            completedTasksSection.classList.add('hidden');
        }
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
    
    function attachRoutineManagementListeners(routineId) {
        const routine = definedRoutines.find(r => r.id === routineId);
        if (!routine) return;
        
        // Toggle routine status
        const toggleBtn = document.getElementById('toggleRoutineStatus');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                toggleRoutineActive(routineId);
                closeModal();
                // Refresh routines window
                setTimeout(() => {
                    if (managementWindows.routines && !managementWindows.routines.classList.contains('hidden')) {
                        populateRoutinesWindow();
                    }
                }, 100);
            });
        }
        
        // Add habit button
        const addHabitBtn = document.getElementById('addHabitToRoutine');
        if (addHabitBtn) {
            addHabitBtn.addEventListener('click', () => {
                showAddItemToRoutineModal(routineId, 'habit');
            });
        }
        
        // Add task button
        const addTaskBtn = document.getElementById('addTaskToRoutine');
        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => {
                showAddItemToRoutineModal(routineId, 'task');
            });
        }
        
        // Remove habit buttons
        document.querySelectorAll('.remove-habit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const habitId = e.target.dataset.habitId;
                removeHabitFromRoutine(routineId, habitId);
                populateRoutineHabits(routine);
            });
        });
        
        // Remove task buttons
        document.querySelectorAll('.remove-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.dataset.taskId;
                removeTaskFromRoutine(routineId, taskId);
                populateRoutineTasks(routine);
            });
        });
        
        // Edit habit buttons
        document.querySelectorAll('.edit-habit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const habitId = e.target.dataset.habitId;
                const habit = definedHabits.find(h => h.id === habitId);
                if (habit) {
                    showEditHabitForm(routineId, habit);
                }
            });
        });
        
        // Edit task buttons
        document.querySelectorAll('.edit-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.dataset.taskId;
                const task = definedTasks.find(t => t.id === taskId);
                if (task) {
                    showEditTaskForm(routineId, task);
                }
            });
        });
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

    function renderDefinedRoutines() {
        if (!definedRoutinesListUL) return;
        
        definedRoutinesListUL.innerHTML = '';
        
        if (definedRoutines.length === 0) {
            definedRoutinesListUL.innerHTML = '<li>No routines created.</li>';
            return;
        }
        
        definedRoutines.forEach(routine => {
            const li = document.createElement('li');
            li.dataset.routineId = routine.id;
            
            // Routine header with name and controls
            const header = document.createElement('div');
            header.classList.add('routine-header');
            
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('routine-name-display');
            nameSpan.textContent = routine.name;
            
            const buttonGroup = document.createElement('div');
            buttonGroup.classList.add('routine-button-group');
            
            const activateBtn = document.createElement('button');
            activateBtn.classList.add('activate-routine-button');
            activateBtn.textContent = routine.isActive ? "Deactivate" : "Activate";
            activateBtn.dataset.routineId = routine.id;
            
            if (routine.isActive) {
                activateBtn.classList.add('active');
            }
            
            activateBtn.addEventListener('click', () => toggleRoutineActive(routine.id));
            
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-routine-button');
            deleteBtn.textContent = "Delete";
            deleteBtn.addEventListener('click', () => deleteRoutine(routine.id));
            
            buttonGroup.appendChild(activateBtn);
            buttonGroup.appendChild(deleteBtn);
            
            header.appendChild(nameSpan);
            header.appendChild(buttonGroup);
            li.appendChild(header);
            
            // Habits section
            const habitsSection = document.createElement('div');
            habitsSection.classList.add('routine-section');
            
            const habitsTitle = document.createElement('h5');
            habitsTitle.textContent = 'Habits:';
            habitsSection.appendChild(habitsTitle);
            
            const habitsUl = document.createElement('ul');
            habitsUl.classList.add('routine-habits-list');
            
            if (routine.habitDefinitionIds && routine.habitDefinitionIds.length > 0) {
                routine.habitDefinitionIds.forEach(habitId => {
                    const habitDef = definedHabits.find(h => h.id === habitId);
                    if (habitDef) {
                        const habitLi = document.createElement('li');
                        habitLi.classList.add('routine-item');
                        
                        const habitInfo = document.createElement('span');
                        const habitTypeIcon = habitDef.isNegative ? ' 🚫' : ' ✅';
                        habitInfo.textContent = `${habitDef.name} (${habitDef.category})${habitTypeIcon}`;
                        
                        const buttonGroup = document.createElement('div');
                        buttonGroup.classList.add('item-button-group');
                        
                        const editHabitBtn = document.createElement('button');
                        editHabitBtn.classList.add('edit-item-button');
                        editHabitBtn.textContent = '✏️';
                        editHabitBtn.title = 'Edit habit';
                        editHabitBtn.addEventListener('click', () => showEditHabitForm(routine.id, habitDef));
                        
                        const removeHabitBtn = document.createElement('button');
                        removeHabitBtn.classList.add('remove-item-button');
                        removeHabitBtn.textContent = '×';
                        removeHabitBtn.title = 'Remove habit from routine';
                        removeHabitBtn.addEventListener('click', () => removeHabitFromRoutine(routine.id, habitId));
                        
                        buttonGroup.appendChild(editHabitBtn);
                        buttonGroup.appendChild(removeHabitBtn);
                        
                        habitLi.appendChild(habitInfo);
                        habitLi.appendChild(buttonGroup);
                        habitsUl.appendChild(habitLi);
                    }
                });
            } else {
                const noHabits = document.createElement('li');
                noHabits.textContent = 'No habits in routine';
                noHabits.style.fontStyle = 'italic';
                habitsUl.appendChild(noHabits);
            }
            
            habitsSection.appendChild(habitsUl);
            
            // Add habit control
            const addHabitDiv = document.createElement('div');
            addHabitDiv.classList.add('add-item-control');
            
            const habitSelect = document.createElement('select');
            habitSelect.classList.add('habit-select');
            populateHabitSelectDropdown(habitSelect);
            
            const addHabitBtn = document.createElement('button');
            addHabitBtn.classList.add('add-item-button');
            addHabitBtn.textContent = 'Add Habit';
            addHabitBtn.addEventListener('click', () => {
                const selectedHabitId = habitSelect.value;
                if (selectedHabitId) {
                    addHabitToRoutine(routine.id, selectedHabitId);
                    habitSelect.value = '';
                } else {
                    alert('Please select a habit to add.');
                }
            });
            
            addHabitDiv.appendChild(habitSelect);
            addHabitDiv.appendChild(addHabitBtn);
            
            // Add new habit button
            const addNewHabitBtn = document.createElement('button');
            addNewHabitBtn.classList.add('add-item-button');
            addNewHabitBtn.textContent = '+ Create New Habit';
            addNewHabitBtn.addEventListener('click', () => showCreateHabitForm(routine.id));
            
            habitsSection.appendChild(addHabitDiv);
            habitsSection.appendChild(addNewHabitBtn);
            
            li.appendChild(habitsSection);
            
            // Tasks section
            const tasksSection = document.createElement('div');
            tasksSection.classList.add('routine-section');
            
            const tasksTitle = document.createElement('h5');
            tasksTitle.textContent = 'Tasks:';
            tasksSection.appendChild(tasksTitle);
            
            const tasksUl = document.createElement('ul');
            tasksUl.classList.add('routine-tasks-list');
            
            if (!definedTasks) window.definedTasks = [];
            
            if (routine.taskDefinitionIds && routine.taskDefinitionIds.length > 0) {
                routine.taskDefinitionIds.forEach(taskId => {
                    const taskDef = definedTasks.find(t => t.id === taskId);
                    if (taskDef) {
                        const taskLi = document.createElement('li');
                        taskLi.classList.add('routine-item');
                        
                        const taskInfo = document.createElement('span');
                        taskInfo.textContent = `${taskDef.name} (${taskDef.category})${taskDef.isHighPriority ? ' ⭐' : ''}`;
                        
                        const buttonGroup = document.createElement('div');
                        buttonGroup.classList.add('item-button-group');
                        
                        const editTaskBtn = document.createElement('button');
                        editTaskBtn.classList.add('edit-item-button');
                        editTaskBtn.textContent = '✏️';
                        editTaskBtn.title = 'Edit task';
                        editTaskBtn.addEventListener('click', () => showEditTaskForm(routine.id, taskDef));
                        
                        const removeTaskBtn = document.createElement('button');
                        removeTaskBtn.classList.add('remove-item-button');
                        removeTaskBtn.textContent = '×';
                        removeTaskBtn.title = 'Remove task from routine';
                        removeTaskBtn.addEventListener('click', () => removeTaskFromRoutine(routine.id, taskId));
                        
                        buttonGroup.appendChild(editTaskBtn);
                        buttonGroup.appendChild(removeTaskBtn);
                        
                        taskLi.appendChild(taskInfo);
                        taskLi.appendChild(buttonGroup);
                        tasksUl.appendChild(taskLi);
                    }
                });
            } else {
                const noTasks = document.createElement('li');
                noTasks.textContent = 'No tasks in routine';
                noTasks.style.fontStyle = 'italic';
                tasksUl.appendChild(noTasks);
            }
            
            tasksSection.appendChild(tasksUl);
            
            // Add new task control
            const addNewTaskBtn = document.createElement('button');
            addNewTaskBtn.classList.add('add-item-button');
            addNewTaskBtn.textContent = '+ Create New Task';
            addNewTaskBtn.addEventListener('click', () => showCreateTaskForm(routine.id));
            
            tasksSection.appendChild(addNewTaskBtn);
            li.appendChild(tasksSection);
            definedRoutinesListUL.appendChild(li);
        });
        
        updateRoutineDisplay();
    }
    
    function populateHabitSelectDropdown(selectElement) {
        selectElement.innerHTML = '<option value="">-- Select Habit --</option>';
        
        if (definedHabits.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No habits defined';
            option.disabled = true;
            selectElement.appendChild(option);
            return;
        }
        
        definedHabits.forEach(habit => {
            const option = document.createElement('option');
            option.value = habit.id;
            option.textContent = `${habit.name} (${habit.category})`;
            selectElement.appendChild(option);
        });
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
    
    function showAddItemToRoutineModal(routineId, itemType) {
        const routine = definedRoutines.find(r => r.id === routineId);
        if (!routine) return;
        
        let optionsHtml = '';
        let existingIds = [];
        
        if (itemType === 'habit') {
            existingIds = routine.habitDefinitionIds || [];
            optionsHtml = definedHabits
                .filter(habit => !existingIds.includes(habit.id))
                .map(habit => {
                    const icon = habit.isNegative ? '🚫' : '✅';
                    return `<option value="${habit.id}">${habit.name} (${habit.category}) ${icon}</option>`;
                })
                .join('');
        } else if (itemType === 'task') {
            if (!definedTasks) window.definedTasks = [];
            existingIds = routine.taskDefinitionIds || [];
            optionsHtml = definedTasks
                .filter(task => !existingIds.includes(task.id))
                .map(task => {
                    const priority = task.isHighPriority ? '⭐' : '';
                    return `<option value="${task.id}">${task.name} (${task.category}) ${priority}</option>`;
                })
                .join('');
        }
        
        const modalHtml = `
            <div class="modal-overlay" id="addItemModal">
                <div class="modal-content">
                    <h3>Add ${itemType === 'habit' ? 'Habit' : 'Task'} to Routine</h3>
                    <div class="form-row">
                        <label>Select existing ${itemType}:</label>
                        <select id="existingItemSelect">
                            <option value="">-- Select ${itemType} --</option>
                            ${optionsHtml}
                        </select>
                    </div>
                    <div style="text-align: center; margin: 20px 0; color: var(--color-neutral);">OR</div>
                    <div class="form-row">
                        <button id="createNewItemBtn" class="secondary-button" style="width: 100%;">Create New ${itemType === 'habit' ? 'Habit' : 'Task'}</button>
                    </div>
                    <div class="modal-buttons">
                        <button id="addSelectedItemBtn" class="primary-button">Add Selected</button>
                        <button class="secondary-button" onclick="closeModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Attach event listeners
        const addBtn = document.getElementById('addSelectedItemBtn');
        const createBtn = document.getElementById('createNewItemBtn');
        const selectEl = document.getElementById('existingItemSelect');
        
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const selectedId = selectEl.value;
                if (selectedId) {
                    if (itemType === 'habit') {
                        if (!routine.habitDefinitionIds) routine.habitDefinitionIds = [];
                        routine.habitDefinitionIds.push(selectedId);
                        // Transfer ownership so the habit is gated on this
                        // routine's isActive rather than spawning standalone.
                        // (This modal duplicates Routines.addHabitToRoutine
                        // rather than calling it — flagged for the session-4
                        // UI extraction, which reconciles these duplicates.)
                        const adoptedHabit = definedHabits.find(h => h.id === selectedId);
                        if (adoptedHabit) adoptedHabit.routineId = routine.id;
                    } else {
                        if (!routine.taskDefinitionIds) routine.taskDefinitionIds = [];
                        routine.taskDefinitionIds.push(selectedId);
                    }
                    saveGame();
                    closeModal();
                    // Refresh the routine management modal
                    setTimeout(() => {
                        showRoutineManagement(routineId);
                    }, 100);
                } else {
                    alert(`Please select a ${itemType} to add.`);
                }
            });
        }
        
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                closeModal();
                setTimeout(() => {
                    if (itemType === 'habit') {
                        showCreateHabitForm(routineId);
                    } else {
                        showCreateTaskForm(routineId);
                    }
                }, 100);
            });
        }
    }

    function updateRoutineDisplay() {
        const activeRoutines = definedRoutines.filter(r => r.isActive).length;
        if (activeRoutineCountDisplay) {
            activeRoutineCountDisplay.textContent = activeRoutines;
        }
    }
    
    function showCreateHabitForm(routineId) {
        const formHtml = `
            <div class="modal-overlay" id="habitFormModal">
                <div class="modal-content">
                    <h3>Create New Habit</h3>
                    <div class="form-row">
                        <label>Habit Type:</label>
                        <div class="habit-type-toggle">
                            <input type="radio" id="positiveHabit" name="habitType" value="positive" checked>
                            <label for="positiveHabit" class="habit-type-label positive">
                                <span class="habit-icon">✅</span>
                                <span class="habit-label">Positive</span>
                                <span class="habit-description">Complete to earn points</span>
                            </label>
                            <input type="radio" id="negativeHabit" name="habitType" value="negative">
                            <label for="negativeHabit" class="habit-type-label negative">
                                <span class="habit-icon">🚫</span>
                                <span class="habit-label">Negative</span>
                                <span class="habit-description">Avoid to earn points</span>
                            </label>
                        </div>
                    </div>
                    <div class="form-row">
                        <label>Habit Name:</label>
                        <input type="text" id="newHabitName" placeholder="e.g., Exercise, Drink Water">
                    </div>
                    <div class="form-row">
                        <label>Category:</label>
                        <select id="newHabitCategory">
                            <option value="health">Health</option>
                            <option value="other">Other</option>
                            <option value="career">Career</option>
                            <option value="creativity">Creativity</option>
                            <option value="financial">Financial</option>
                            <option value="lifestyle">Lifestyle</option>
                            <option value="relationships">Relationships</option>
                            <option value="spirituality">Spirituality</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <label>Frequency:</label>
                        <select id="newHabitFrequency">
                            <option value="daily">Daily</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <label>Time of Day:</label>
                        <select id="newHabitTimeOfDay">
                            <option value="anytime">Anytime Today</option>
                            <option value="morning">Morning (by 12 PM)</option>
                            <option value="afternoon">Afternoon (by 5 PM)</option>
                            <option value="evening">Evening (by 10 PM)</option>
                        </select>
                    </div>
                    <div class="modal-buttons">
                        <button class="primary-button" onclick="saveNewHabit('${routineId}')">Create Habit</button>
                        <button class="secondary-button" onclick="closeModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', formHtml);
    }
    
    function showCreateTaskForm(routineId) {
        const formHtml = `
            <div class="modal-overlay" id="taskFormModal">
                <div class="modal-content">
                    <h3>Create New Task</h3>
                    <div class="form-row">
                        <label>Task Name:</label>
                        <input type="text" id="newTaskName" placeholder="Enter task name">
                    </div>
                    <div class="form-row">
                        <label>Category:</label>
                        <select id="newTaskCategory">
                            <option value="other">Other</option>
                            <option value="career">Career</option>
                            <option value="creativity">Creativity</option>
                            <option value="financial">Financial</option>
                            <option value="health">Health</option>
                            <option value="lifestyle">Lifestyle</option>
                            <option value="relationships">Relationships</option>
                            <option value="spirituality">Spirituality</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <label>Default Due Time:</label>
                        <input type="time" id="newTaskDueTime" value="17:00">
                    </div>
                    <div class="form-row priority-row">
                        <input type="checkbox" id="newTaskHighPriority">
                        <label for="newTaskHighPriority">High Priority</label>
                    </div>
                    <div class="modal-buttons">
                        <button class="primary-button" onclick="saveNewTask('${routineId}')">Create Task</button>
                        <button class="secondary-button" onclick="closeModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', formHtml);
    }
    
    function showEditHabitForm(routineId, habitDef) {
        const formHtml = `
            <div class="modal-overlay" id="editHabitFormModal">
                <div class="modal-content">
                    <h3>Edit Habit</h3>
                    <div class="form-row">
                        <label>Habit Type:</label>
                        <div class="habit-type-toggle">
                            <input type="radio" id="editPositiveHabit" name="editHabitType" value="positive" ${!habitDef.isNegative ? 'checked' : ''}>
                            <label for="editPositiveHabit" class="habit-type-label positive">
                                <span class="habit-icon">✅</span>
                                <span class="habit-label">Positive</span>
                                <span class="habit-description">Complete to earn points</span>
                            </label>
                            <input type="radio" id="editNegativeHabit" name="editHabitType" value="negative" ${habitDef.isNegative ? 'checked' : ''}>
                            <label for="editNegativeHabit" class="habit-type-label negative">
                                <span class="habit-icon">🚫</span>
                                <span class="habit-label">Negative</span>
                                <span class="habit-description">Avoid to earn points</span>
                            </label>
                        </div>
                    </div>
                    <div class="form-row">
                        <label>Habit Name:</label>
                        <input type="text" id="editHabitName" value="${habitDef.name}">
                    </div>
                    <div class="form-row">
                        <label>Category:</label>
                        <select id="editHabitCategory">
                            <option value="health" ${habitDef.category === 'health' ? 'selected' : ''}>Health</option>
                            <option value="other" ${habitDef.category === 'other' ? 'selected' : ''}>Other</option>
                            <option value="career" ${habitDef.category === 'career' ? 'selected' : ''}>Career</option>
                            <option value="creativity" ${habitDef.category === 'creativity' ? 'selected' : ''}>Creativity</option>
                            <option value="financial" ${habitDef.category === 'financial' ? 'selected' : ''}>Financial</option>
                            <option value="lifestyle" ${habitDef.category === 'lifestyle' ? 'selected' : ''}>Lifestyle</option>
                            <option value="relationships" ${habitDef.category === 'relationships' ? 'selected' : ''}>Relationships</option>
                            <option value="spirituality" ${habitDef.category === 'spirituality' ? 'selected' : ''}>Spirituality</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <label>Frequency:</label>
                        <select id="editHabitFrequency">
                            <option value="daily" ${habitDef.frequency === 'daily' ? 'selected' : ''}>Daily</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <label>Time of Day:</label>
                        <select id="editHabitTimeOfDay">
                            <option value="anytime" ${habitDef.timeOfDay === 'anytime' ? 'selected' : ''}>Anytime Today</option>
                            <option value="morning" ${habitDef.timeOfDay === 'morning' ? 'selected' : ''}>Morning (by 12 PM)</option>
                            <option value="afternoon" ${habitDef.timeOfDay === 'afternoon' ? 'selected' : ''}>Afternoon (by 5 PM)</option>
                            <option value="evening" ${habitDef.timeOfDay === 'evening' ? 'selected' : ''}>Evening (by 10 PM)</option>
                        </select>
                    </div>
                    <div class="modal-buttons">
                        <button class="primary-button" onclick="saveEditedHabit('${habitDef.id}')">Save Changes</button>
                        <button class="secondary-button" onclick="closeModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', formHtml);
    }
    
    function showEditTaskForm(routineId, taskDef) {
        const formHtml = `
            <div class="modal-overlay" id="editTaskFormModal">
                <div class="modal-content">
                    <h3>Edit Task</h3>
                    <div class="form-row">
                        <label>Task Name:</label>
                        <input type="text" id="editTaskName" value="${taskDef.name}">
                    </div>
                    <div class="form-row">
                        <label>Category:</label>
                        <select id="editTaskCategory">
                            <option value="other" ${taskDef.category === 'other' ? 'selected' : ''}>Other</option>
                            <option value="career" ${taskDef.category === 'career' ? 'selected' : ''}>Career</option>
                            <option value="creativity" ${taskDef.category === 'creativity' ? 'selected' : ''}>Creativity</option>
                            <option value="financial" ${taskDef.category === 'financial' ? 'selected' : ''}>Financial</option>
                            <option value="health" ${taskDef.category === 'health' ? 'selected' : ''}>Health</option>
                            <option value="lifestyle" ${taskDef.category === 'lifestyle' ? 'selected' : ''}>Lifestyle</option>
                            <option value="relationships" ${taskDef.category === 'relationships' ? 'selected' : ''}>Relationships</option>
                            <option value="spirituality" ${taskDef.category === 'spirituality' ? 'selected' : ''}>Spirituality</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <label>Default Due Time:</label>
                        <input type="time" id="editTaskDueTime" value="${taskDef.defaultDueTime || '17:00'}">
                    </div>
                    <div class="form-row priority-row">
                        <input type="checkbox" id="editTaskHighPriority" ${taskDef.isHighPriority ? 'checked' : ''}>
                        <label for="editTaskHighPriority">High Priority</label>
                    </div>
                    <div class="modal-buttons">
                        <button class="primary-button" onclick="saveEditedTask('${taskDef.id}')">Save Changes</button>
                        <button class="secondary-button" onclick="closeModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', formHtml);
    }
    
    // Global functions for modal interactions
    window.saveNewHabit = function(routineId) {
        const name = document.getElementById('newHabitName').value.trim();
        const category = document.getElementById('newHabitCategory').value;
        const frequency = document.getElementById('newHabitFrequency').value;
        const timeOfDay = document.getElementById('newHabitTimeOfDay').value;
        const isNegative = document.querySelector('input[name="habitType"]:checked').value === 'negative';
        
        if (!name) {
            alert('Please enter a habit name.');
            return;
        }
        
        createNewHabitInRoutine(routineId, { name, category, frequency, timeOfDay, isNegative });
        closeModal();
    };
    
    window.saveNewTask = function(routineId) {
        const name = document.getElementById('newTaskName').value.trim();
        const category = document.getElementById('newTaskCategory').value;
        const defaultDueTime = document.getElementById('newTaskDueTime').value;
        const isHighPriority = document.getElementById('newTaskHighPriority').checked;
        
        if (!name) {
            alert('Please enter a task name.');
            return;
        }
        
        createNewTaskInRoutine(routineId, { name, category, defaultDueTime, isHighPriority });
        closeModal();
    };
    
    window.saveEditedHabit = function(habitId) {
        const name = document.getElementById('editHabitName').value.trim();
        const category = document.getElementById('editHabitCategory').value;
        const frequency = document.getElementById('editHabitFrequency').value;
        const timeOfDay = document.getElementById('editHabitTimeOfDay').value;
        const isNegative = document.querySelector('input[name="editHabitType"]:checked').value === 'negative';
        
        if (!name) {
            alert('Please enter a habit name.');
            return;
        }
        
        editHabitInRoutine(habitId, { name, category, frequency, timeOfDay, isNegative });

        // Keep any already-spawned instance of this habit in sync, so editing
        // from today's agenda row (or anywhere else) doesn't go stale until
        // the next day's instance regenerates. Deliberately does NOT touch
        // frequency/timeOfDay for an already-spawned instance — recomputing
        // today's due time retroactively is a separate, more involved
        // follow-up (see docs/DECISIONS.md).
        activeItems.forEach(item => {
            if (item.type === 'habit' && item.definitionId === habitId) {
                const oldCategory = item.category;
                item.name = name;
                item.category = category;
                item.isNegative = isNegative;

                if (item.element) {
                    item.element.classList.remove(`category-${oldCategory}`, `zombie-${oldCategory}`);
                    item.element.classList.add(`category-${category}`, `zombie-${category}`);
                    item.element.classList.toggle('negative-habit', isNegative);
                }

                if (item.listItemElement) {
                    item.listItemElement.remove();
                    createListItem(item);
                }
            }
        });
        sortAndRenderActiveList();
        saveGame();

        closeModal();
    };
    
    window.saveEditedTask = function(taskId) {
        const name = document.getElementById('editTaskName').value.trim();
        const category = document.getElementById('editTaskCategory').value;
        const defaultDueTime = document.getElementById('editTaskDueTime').value;
        const isHighPriority = document.getElementById('editTaskHighPriority').checked;
        
        if (!name) {
            alert('Please enter a task name.');
            return;
        }
        
        editTaskInRoutine(taskId, { name, category, defaultDueTime, isHighPriority });
        closeModal();
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
        const routine = definedRoutines.find(r => r.id === routineId);
        if (!routine) return;
        
        const modalHtml = `
            <div class="modal-overlay" id="routineManagementModal">
                <div class="modal-content" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
                    <h3>Manage Routine: ${routine.name}</h3>
                    
                    <!-- Routine Status -->
                    <div style="margin-bottom: 20px; padding: 12px; background: var(--color-bg-light); border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>Status: ${routine.isActive ? '🟢 Active' : '⚪ Inactive'}</span>
                            <button id="toggleRoutineStatus" class="secondary-button" style="padding: 6px 12px;">
                                ${routine.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                        </div>
                    </div>
                    
                    <!-- Habits Section -->
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h4>Habits</h4>
                            <button id="addHabitToRoutine" class="secondary-button" style="padding: 6px 12px;">+ Add Habit</button>
                        </div>
                        <div id="routineHabitsList"></div>
                    </div>
                    
                    <!-- Tasks Section -->
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h4>Tasks</h4>
                            <button id="addTaskToRoutine" class="secondary-button" style="padding: 6px 12px;">+ Add Task</button>
                        </div>
                        <div id="routineTasksList"></div>
                    </div>
                    
                    <div class="modal-buttons">
                        <button class="primary-button" onclick="closeModal()">Done</button>
                        <button class="secondary-button" onclick="deleteRoutine('${routine.id}'); closeModal();">Delete Routine</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Populate the routine content
        populateRoutineHabits(routine);
        populateRoutineTasks(routine);
        
        // Attach event listeners
        attachRoutineManagementListeners(routine.id);
    }
    
    function populateRoutineHabits(routine) {
        const container = document.getElementById('routineHabitsList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!routine.habitDefinitionIds || routine.habitDefinitionIds.length === 0) {
            container.innerHTML = '<div style="padding: 12px; background: var(--color-bg-light); border-radius: 6px; color: var(--color-neutral); font-style: italic;">No habits in this routine</div>';
            return;
        }
        
        routine.habitDefinitionIds.forEach(habitId => {
            const habit = definedHabits.find(h => h.id === habitId);
            if (habit) {
                const habitDiv = document.createElement('div');
                habitDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--color-bg-light); border-radius: 6px; margin-bottom: 6px;';
                
                const habitTypeIcon = habit.isNegative ? ' 🚫' : ' ✅';
                habitDiv.innerHTML = `
                    <span>${habit.name} (${habit.category})${habitTypeIcon}</span>
                    <div style="display: flex; gap: 6px;">
                        <button class="edit-habit-btn" data-habit-id="${habit.id}" style="padding: 4px 8px; font-size: 11px; background: var(--color-accent-teal); color: white; border: none; border-radius: 3px; cursor: pointer;">Edit</button>
                        <button class="remove-habit-btn" data-habit-id="${habit.id}" style="padding: 4px 8px; font-size: 11px; background: var(--color-error); color: white; border: none; border-radius: 3px; cursor: pointer;">Remove</button>
                    </div>
                `;
                
                container.appendChild(habitDiv);
            }
        });
    }
    
    function populateRoutineTasks(routine) {
        const container = document.getElementById('routineTasksList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!definedTasks) window.definedTasks = [];
        
        if (!routine.taskDefinitionIds || routine.taskDefinitionIds.length === 0) {
            container.innerHTML = '<div style="padding: 12px; background: var(--color-bg-light); border-radius: 6px; color: var(--color-neutral); font-style: italic;">No tasks in this routine</div>';
            return;
        }
        
        routine.taskDefinitionIds.forEach(taskId => {
            const task = definedTasks.find(t => t.id === taskId);
            if (task) {
                const taskDiv = document.createElement('div');
                taskDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--color-bg-light); border-radius: 6px; margin-bottom: 6px;';
                
                taskDiv.innerHTML = `
                    <span>${task.name} (${task.category})${task.isHighPriority ? ' ⭐' : ''}</span>
                    <div style="display: flex; gap: 6px;">
                        <button class="edit-task-btn" data-task-id="${task.id}" style="padding: 4px 8px; font-size: 11px; background: var(--color-accent-teal); color: white; border: none; border-radius: 3px; cursor: pointer;">Edit</button>
                        <button class="remove-task-btn" data-task-id="${task.id}" style="padding: 4px 8px; font-size: 11px; background: var(--color-error); color: white; border: none; border-radius: 3px; cursor: pointer;">Remove</button>
                    </div>
                `;
                
                container.appendChild(taskDiv);
            }
        });
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

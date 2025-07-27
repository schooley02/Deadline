document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const gameScreen = document.getElementById('gameScreen');
    const baseElement = document.getElementById('base');
    const baseHealthDisplay = document.getElementById('baseHealthDisplay');
    const playerXpDisplay = document.getElementById('playerXpDisplay');
    const gameOverMessage = document.getElementById('gameOverMessage');
    const activeItemsListUL = document.getElementById('activeItemsList');
    const showTaskFormButton = document.getElementById('showTaskFormButton');
    const showHabitFormButton = document.getElementById('showHabitFormButton');
    const taskForm = document.getElementById('taskForm');
    const habitForm = document.getElementById('habitForm');
    const taskNameInput = document.getElementById('taskName');
    const taskCategoryInput = document.getElementById('taskCategory');
    const taskHighPriorityInput = document.getElementById('taskHighPriority');
    const dueDateInput = document.getElementById('dueDate');
    const dueTimeInput = document.getElementById('dueTime');
    const addTaskButton = document.getElementById('addTaskButton');
    const habitNameInput = document.getElementById('habitName');
    const habitCategoryInput = document.getElementById('habitCategory');
    const habitFrequencyInput = document.getElementById('habitFrequency');
    const habitTimeOfDayInput = document.getElementById('habitTimeOfDay');
    const addHabitButton = document.getElementById('addHabitButton');
    const restartButton = document.getElementById('restartButton');
    const playerLevelDisplay = document.getElementById('playerLevelDisplay');
    const routineSlotsDisplay = document.getElementById('routineSlotsDisplay');
    const levelUpMessage = document.getElementById('levelUpMessage');
    const showRoutineFormButton = document.getElementById('showRoutineFormButton');
    const routineForm = document.getElementById('routineForm');
    const routineNameInput = document.getElementById('routineName');
    const createRoutineButton = document.getElementById('createRoutineButton');
    const definedRoutinesListUL = document.getElementById('definedRoutinesList');
    const activeRoutineCountDisplay = document.getElementById('activeRoutineCountDisplay');
    const totalRoutineSlotsDisplay = document.getElementById('totalRoutineSlotsDisplay');

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

    // --- Game State ---
    let baseHealth, playerXP, playerLevel, routineSlots;
    let activeItems = [];
    let definedHabits = [];
    let definedRoutines = [];
    let itemIdCounter, gameLoopInterval, gameIsOver, daysSurvived, dayTimerInterval, currentGameDate;

    // --- Game Settings ---
    const GAME_TICK_MS = 50;
    const DAY_DURATION_MS = 60000;
    const OVERDUE_DAMAGE = 1;
    const DAMAGE_INTERVAL_MS = 5 * 60 * 1000;
    const XP_PER_TASK_DEFEAT = 10;
    const XP_PER_HABIT_COMPLETE = 5;
    const HABIT_STREAK_BONUS_THRESHOLD = 1;
    const LEVEL_XP_THRESHOLDS = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000];
    const ROUTINE_SLOTS_PER_LEVEL = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8:4 };
    const MAX_PLAYER_LEVEL = LEVEL_XP_THRESHOLDS.length;

    let GAME_SCREEN_WIDTH, BASE_WIDTH, ENEMY_WIDTH, HABIT_ENEMY_WIDTH;

    function initGame() {
        GAME_SCREEN_WIDTH = gameScreen.offsetWidth;
        BASE_WIDTH = baseElement.offsetWidth;
        const tempEnemy = document.createElement('div');
        tempEnemy.classList.add('enemy');
        tempEnemy.style.visibility = 'hidden';
        gameScreen.appendChild(tempEnemy);
        ENEMY_WIDTH = tempEnemy.offsetWidth || 60;
        gameScreen.removeChild(tempEnemy);
        HABIT_ENEMY_WIDTH = ENEMY_WIDTH * 0.8;

        playerXP = 0; updatePlayerXpDisplay();
        playerLevel = 1;
        routineSlots = ROUTINE_SLOTS_PER_LEVEL[playerLevel] || 1;
        updatePlayerLevelDisplay();
        updateRoutineSlotsDisplay();
        updateRoutineDisplay();

        baseHealth = 100; baseHealthDisplay.textContent = baseHealth;
        baseElement.style.backgroundImage = "url('base_100.png')";
        baseElement.classList.remove('base-shaking');
        if(gameOverMessage) gameOverMessage.classList.add('hidden');

        // Initial form state
        if(taskForm) taskForm.classList.add('active-form');
        if(habitForm) habitForm.classList.remove('active-form');
        if (routineForm) routineForm.classList.remove('active-form');

        if(showTaskFormButton) showTaskFormButton.classList.add('active');
        if(showHabitFormButton) showHabitFormButton.classList.remove('active');
        if (showRoutineFormButton) showRoutineFormButton.classList.remove('active');


        [taskNameInput, taskCategoryInput, taskHighPriorityInput, dueDateInput, dueTimeInput, addTaskButton,
         habitNameInput, habitCategoryInput, habitFrequencyInput, habitTimeOfDayInput, addHabitButton,
         routineNameInput, createRoutineButton
        ].forEach(el => { if(el) el.disabled = false; });
        if(restartButton) restartButton.classList.add('hidden');

        activeItems.forEach(item => {
            if (item.element) item.element.remove();
            if (item.listItemElement) item.listItemElement.remove();
        });
        activeItems = [];
        if(activeItemsListUL) activeItemsListUL.innerHTML = '';
        itemIdCounter = 0;
        gameIsOver = false;
        daysSurvived = 0;
        currentGameDate = new Date();
        currentGameDate.setHours(0,0,0,0);

        clearFormInputs();
        generateDailyHabitInstances(currentGameDate);

        if (gameLoopInterval) clearInterval(gameLoopInterval);
        gameLoopInterval = setInterval(updateGame, GAME_TICK_MS);

        if (dayTimerInterval) clearInterval(dayTimerInterval);
        dayTimerInterval = setInterval(() => {
            if (!gameIsOver) daysSurvived++;
        }, DAY_DURATION_MS);
        console.log("Game Initialized. Game Day:", currentGameDate.toDateString(), "Defined Habits:", definedHabits.length, "Defined Routines:", definedRoutines.length);
    }

    function clearFormInputs() {
        if(taskNameInput) taskNameInput.value = '';
        if(taskCategoryInput) taskCategoryInput.value = 'other';
        if(taskHighPriorityInput) taskHighPriorityInput.checked = false;
        if(dueDateInput) dueDateInput.value = '';
        if(dueTimeInput) dueTimeInput.value = '';
        if(habitNameInput) habitNameInput.value = '';
        if(habitCategoryInput) habitCategoryInput.value = 'health';
        if(habitFrequencyInput) habitFrequencyInput.value = 'daily';
        if(habitTimeOfDayInput) habitTimeOfDayInput.value = 'anytime';
        if(routineNameInput) routineNameInput.value = '';
    }

    function updatePlayerXpDisplay() { if(playerXpDisplay) playerXpDisplay.textContent = playerXP; }
    function updatePlayerLevelDisplay() { if(playerLevelDisplay) playerLevelDisplay.textContent = playerLevel; }
    function updateRoutineSlotsDisplay() { if(routineSlotsDisplay) routineSlotsDisplay.textContent = routineSlots; }
    function showLevelUpMessage() {
        if(!levelUpMessage) return;
        levelUpMessage.textContent = `LEVEL ${playerLevel}!`;
        levelUpMessage.classList.remove('hidden');
        setTimeout(() => { levelUpMessage.classList.add('hidden'); }, 2500);
    }
    function checkPlayerLevelUp() {
        if (playerLevel >= MAX_PLAYER_LEVEL || !LEVEL_XP_THRESHOLDS[playerLevel]) return false;
        if (playerXP >= LEVEL_XP_THRESHOLDS[playerLevel]) {
            playerLevel++;
            updatePlayerLevelDisplay();
            showLevelUpMessage();
            if (ROUTINE_SLOTS_PER_LEVEL[playerLevel] && ROUTINE_SLOTS_PER_LEVEL[playerLevel] > routineSlots) {
                routineSlots = ROUTINE_SLOTS_PER_LEVEL[playerLevel];
                updateRoutineSlotsDisplay();
                updateRoutineDisplay();
            }
            checkPlayerLevelUp(); return true;
        } return false;
    }
    function createTaskItemData(name, category, isHighPriority, dueDateStr, dueTimeStr) {
        const creationTime = new Date(); let dueDateTime;
        if (dueDateStr && dueTimeStr) { dueDateTime = new Date(`${dueDateStr}T${dueTimeStr}`);}
        else if (dueDateStr) { dueDateTime = new Date(dueDateStr); dueDateTime.setHours(23, 59, 59, 999); }
        else { dueDateTime = new Date(creationTime.getTime() + 10 * 60 * 1000); }
        if (isNaN(dueDateTime.getTime()) || (dueDateTime < creationTime && !(dueDateStr && dueDateTime.getFullYear() === creationTime.getFullYear() && dueDateTime.getMonth() === creationTime.getMonth() && dueDateTime.getDate() === creationTime.getDate() && dueDateTime.getHours() === 23 && dueDateTime.getMinutes() === 59))) {
            if (isNaN(dueDateTime.getTime()) || dueDateTime < creationTime) {
                dueDateTime = new Date(creationTime.getTime() + 5 * 60 * 1000);
            }
        } return { id: itemIdCounter++, type: 'task', name: name || "Task", category: category || "other", isHighPriority: isHighPriority, dueDateTime: dueDateTime, creationTime: creationTime, timeToDueAtCreationMs: Math.max(0, dueDateTime.getTime() - creationTime.getTime()), x: GAME_SCREEN_WIDTH - ENEMY_WIDTH, isOverdue: false, lastDamageTickTime: null, element: null, listItemElement: null };
    }
    function createHabitDefinition(name, category, frequency, timeOfDay) {
        const newHabitDef = { id: `habitDef_${definedHabits.length}_${Date.now()}`, name, category, frequency, timeOfDay, streak: 0, lastCompletionDate: null };
        definedHabits.push(newHabitDef);
        generateDailyHabitInstances(currentGameDate);
    }
    function getHabitInstanceDueTime(timeOfDayString, referenceDate) {
        const due = new Date(referenceDate); due.setSeconds(0,0);
        switch (timeOfDayString) { case 'morning': due.setHours(12, 0); break; case 'afternoon': due.setHours(17, 0); break; case 'evening': due.setHours(22, 0); break; default: due.setHours(23, 59); break; }
        return due;
    }
    function createHabitInstanceData(habitDef, forDate) {
        const instanceActualCreationTime = new Date();
        let targetInstanceDate = new Date(forDate);
        let dueDateTime = getHabitInstanceDueTime(habitDef.timeOfDay, targetInstanceDate);
        if (dueDateTime < instanceActualCreationTime) {
            targetInstanceDate.setDate(targetInstanceDate.getDate() + 1);
            dueDateTime = getHabitInstanceDueTime(habitDef.timeOfDay, targetInstanceDate);
        }
        return { id: itemIdCounter++, type: 'habit', definitionId: habitDef.id, name: habitDef.name, category: habitDef.category, isHighPriority: false, dueDateTime: dueDateTime, creationTime: instanceActualCreationTime, timeToDueAtCreationMs: Math.max(0, dueDateTime.getTime() - instanceActualCreationTime.getTime()), x: GAME_SCREEN_WIDTH - HABIT_ENEMY_WIDTH, isOverdue: false, lastDamageTickTime: null, streak: habitDef.streak, element: null, listItemElement: null, originalDueDate: new Date(dueDateTime) };
    }
    function generateDailyHabitInstances(forWhichGameDay) {
        const forWhichGameDayString = forWhichGameDay.toDateString();
        definedHabits.forEach(habitDef => {
            if (habitDef.frequency === 'daily') {
                const lastCompletionDayString = habitDef.lastCompletionDate ? new Date(habitDef.lastCompletionDate).toDateString() : null;
                const alreadyCompletedForThisGameDay = lastCompletionDayString === forWhichGameDayString;
                const existingActiveInstance = activeItems.find(item => item.type === 'habit' && item.definitionId === habitDef.id && item.originalDueDate && item.originalDueDate.toDateString() === forWhichGameDayString);
                if (!alreadyCompletedForThisGameDay && !existingActiveInstance) {
                    const habitInstanceData = createHabitInstanceData(habitDef, forWhichGameDay);
                    if (habitInstanceData && habitInstanceData.originalDueDate.toDateString() === forWhichGameDayString) {
                        addItemToGame(habitInstanceData);
                    }
                }
            }
        }); sortAndRenderActiveList();
    }
    function addItemToGame(itemData) {
        if (gameIsOver) return; const itemElement = document.createElement('div'); itemElement.classList.add('enemy'); itemElement.classList.add(`category-${itemData.category}`); const itemSpriteWidth = (itemData.type === 'habit') ? HABIT_ENEMY_WIDTH : ENEMY_WIDTH; const itemSpriteHeight = (itemData.type === 'habit') ? 60 : 70; itemElement.style.width = `${itemSpriteWidth}px`; itemElement.style.height = `${itemSpriteHeight}px`;
        if (itemData.type === 'task' && itemData.isHighPriority) { itemElement.classList.add('high-priority'); } else if (itemData.type === 'habit') { itemElement.classList.add('habit-enemy'); if (itemData.streak >= HABIT_STREAK_BONUS_THRESHOLD) { itemElement.classList.add('high-streak'); } }
        itemElement.style.left = itemData.x + 'px'; const randomTop = Math.random() * (gameScreen.offsetHeight - itemSpriteHeight); itemElement.style.top = Math.max(0, Math.min(randomTop, gameScreen.offsetHeight - itemSpriteHeight)) + 'px'; itemElement.dataset.itemId = itemData.id; itemElement.addEventListener('click', () => !gameIsOver && completeItem(itemData.id)); gameScreen.appendChild(itemElement); itemData.element = itemElement;
        const listItem = document.createElement('li'); listItem.dataset.itemId = itemData.id; if (itemData.type === 'task' && itemData.isHighPriority) listItem.classList.add('high-priority-list-item');
        const itemInfoDiv = document.createElement('div'); itemInfoDiv.classList.add('item-info'); const itemNameSpan = document.createElement('span'); itemNameSpan.classList.add('item-name'); itemNameSpan.textContent = itemData.name; const itemDueSpan = document.createElement('span'); itemDueSpan.classList.add('item-due'); itemDueSpan.textContent = `Due: ${itemData.dueDateTime.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`; itemInfoDiv.appendChild(itemNameSpan); itemInfoDiv.appendChild(itemDueSpan);
        const itemCategorySpan = document.createElement('span'); itemCategorySpan.classList.add('item-category'); itemCategorySpan.textContent = itemData.category.charAt(0).toUpperCase() + itemData.category.slice(1); const currentCategoryStyle = categoryStyles[itemData.category] || categoryStyles["other"]; itemCategorySpan.style.backgroundColor = currentCategoryStyle.bgColor; if (currentCategoryStyle.textColorClass) itemCategorySpan.classList.add(currentCategoryStyle.textColorClass); else { itemCategorySpan.classList.remove("category-relationships-text", "category-other-text"); } itemInfoDiv.appendChild(itemCategorySpan);
        if (itemData.type === 'habit') { const streakSpan = document.createElement('span'); streakSpan.classList.add('item-streak'); streakSpan.textContent = `Streak: ${itemData.streak}`; itemInfoDiv.appendChild(streakSpan); }
        const itemActionsDiv = document.createElement('div'); itemActionsDiv.classList.add('item-actions'); const completeButton = document.createElement('button'); completeButton.textContent = itemData.type === 'habit' ? "Complete" : "Defeat"; completeButton.addEventListener('click', () => !gameIsOver && completeItem(itemData.id)); itemActionsDiv.appendChild(completeButton); listItem.appendChild(itemInfoDiv); listItem.appendChild(itemActionsDiv); itemData.listItemElement = listItem;
        if (itemData.dueDateTime < new Date()) { markAsOverdue(itemData, new Date()); itemData.x = BASE_WIDTH; if(itemData.element) itemData.element.style.left = itemData.x + 'px'; } activeItems.push(itemData);
    }
    function sortAndRenderActiveList() { activeItems.sort((a, b) => a.dueDateTime - b.dueDateTime); if (activeItemsListUL) activeItemsListUL.innerHTML = ''; activeItems.forEach(item => { if (activeItemsListUL && item.listItemElement) { activeItemsListUL.appendChild(item.listItemElement) } }); }
    function markAsOverdue(item, currentTime) { if(item.isOverdue) return; item.isOverdue = true; item.lastDamageTickTime = item.dueDateTime.getTime(); if (item.element) item.element.classList.add('enemy-at-base'); if (item.listItemElement) item.listItemElement.classList.add('overdue-list-item'); console.log(`Item "${item.name}" (${item.type}) is NOW overdue.`); if (item.type === 'habit') { const habitDef = definedHabits.find(def => def.id === item.definitionId); if (habitDef && habitDef.streak > 0) { habitDef.streak = 0; if(item.listItemElement) { const streakSpan = item.listItemElement.querySelector('.item-streak'); if (streakSpan) streakSpan.textContent = `Streak: 0`; } if (item.element) item.element.classList.remove('high-streak'); } } }
    function updateActiveItems() { if (gameIsOver) return; const actualCurrentTime = new Date(); const actualCurrentTimeMs = actualCurrentTime.getTime(); for (let i = activeItems.length - 1; i >= 0; i--) { const item = activeItems[i]; const currentItemWidth = (item.type === 'habit') ? HABIT_ENEMY_WIDTH : ENEMY_WIDTH; if (!item.isOverdue) { if (item.dueDateTime <= actualCurrentTime) { item.x = BASE_WIDTH; markAsOverdue(item, actualCurrentTime); } else if (item.timeToDueAtCreationMs > 0) { const timeElapsedSinceInstanceCreationMs = actualCurrentTimeMs - item.creationTime.getTime(); const progress = Math.min(1, timeElapsedSinceInstanceCreationMs / item.timeToDueAtCreationMs); const travelDistance = GAME_SCREEN_WIDTH - BASE_WIDTH - currentItemWidth; item.x = (GAME_SCREEN_WIDTH - currentItemWidth) - (progress * travelDistance); } else { item.x = BASE_WIDTH; markAsOverdue(item, actualCurrentTime); } if (item.element) item.element.style.left = Math.max(BASE_WIDTH, item.x) + 'px'; } if (item.isOverdue) { if (actualCurrentTimeMs >= item.lastDamageTickTime + DAMAGE_INTERVAL_MS) { damageBase(OVERDUE_DAMAGE); item.lastDamageTickTime += DAMAGE_INTERVAL_MS; if (gameIsOver) break; } } } }
    function updateBaseVisuals() { let newBaseImage = ''; if (baseHealth > 75) { newBaseImage = 'base_100.png'; } else if (baseHealth > 50) { newBaseImage = 'base_075.png'; } else if (baseHealth > 25) { newBaseImage = 'base_050.png'; } else if (baseHealth > 0) { newBaseImage = 'base_025.png'; } else { newBaseImage = 'base_000.png'; } const currentBgImage = baseElement.style.backgroundImage; const targetBgImage = `url("${newBaseImage}")`; if (newBaseImage && currentBgImage !== targetBgImage) { baseElement.style.backgroundImage = targetBgImage; } }
    function damageBase(amount) { if (gameIsOver) return; baseHealth -= amount; if (baseHealth < 0) baseHealth = 0; baseHealthDisplay.textContent = baseHealth; baseElement.classList.add('base-hit-flash'); setTimeout(() => { baseElement.classList.remove('base-hit-flash'); }, 300); updateBaseVisuals(); if (baseHealth <= 0) gameOver(); }
    function completeItem(itemId) { if (gameIsOver) return; const itemIndex = activeItems.findIndex(i => i.id === itemId); if (itemIndex === -1) return; const item = activeItems[itemIndex]; let xpGained = 0; if (item.type === 'task') { xpGained = XP_PER_TASK_DEFEAT; } else if (item.type === 'habit') { const habitDef = definedHabits.find(def => def.id === item.definitionId); if (habitDef) { habitDef.streak++; habitDef.lastCompletionDate = new Date(item.originalDueDate); xpGained = XP_PER_HABIT_COMPLETE; } } if (xpGained > 0) { playerXP += xpGained; updatePlayerXpDisplay(); checkPlayerLevelUp(); } removeItem(itemId); }
    function removeItem(itemId) { const itemIndex = activeItems.findIndex(i => i.id === itemId); if (itemIndex > -1) { const item = activeItems[itemIndex]; if (item.element) item.element.remove(); if (item.listItemElement) item.listItemElement.remove(); activeItems.splice(itemIndex, 1); } }
    function createRoutineDefinition() { const name = routineNameInput.value.trim(); if (!name) { alert("Please enter a routine name."); return; } if (definedRoutines.some(r => r.name.toLowerCase() === name.toLowerCase())) { alert("Routine name already exists."); return; } const newRoutine = { id: `routine_${definedRoutines.length}_${Date.now()}`, name: name, habitDefinitionIds: [], isActive: false }; definedRoutines.push(newRoutine); routineNameInput.value = ''; renderDefinedRoutines(); }
    function addHabitToRoutine(routineId, habitDefId) { const routine = definedRoutines.find(r => r.id === routineId); const habitDef = definedHabits.find(hd => hd.id === habitDefId); if (!routine || !habitDef) { alert("Error finding routine or habit."); return; } if (routine.habitDefinitionIds.includes(habitDefId)) { alert("Habit already in routine."); return; } routine.habitDefinitionIds.push(habitDefId); renderDefinedRoutines(); }
    function populateHabitSelectDropdown(selectElement) { selectElement.innerHTML = '<option value="">-- Select Habit --</option>'; if (definedHabits.length === 0) { const opt = document.createElement('option'); opt.textContent = "No habits defined"; opt.disabled = true; selectElement.appendChild(opt); return; } definedHabits.forEach(hd => { const opt = document.createElement('option'); opt.value = hd.id; opt.textContent = `${hd.name} (${hd.category})`; selectElement.appendChild(opt); }); }
    function renderDefinedRoutines() { if (!definedRoutinesListUL) return; definedRoutinesListUL.innerHTML = ''; if (definedRoutines.length === 0) { definedRoutinesListUL.innerHTML = '<li>No routines created.</li>'; return; } definedRoutines.forEach(r => { const li = document.createElement('li'); li.dataset.routineId = r.id; const head = document.createElement('div'); head.classList.add('routine-header'); const name = document.createElement('span'); name.classList.add('routine-name-display'); name.textContent = r.name; const actBtn = document.createElement('button'); actBtn.classList.add('activate-routine-button'); actBtn.textContent = r.isActive ? "Deactivate" : "Activate"; actBtn.dataset.routineId = r.id; head.appendChild(name); head.appendChild(actBtn); li.appendChild(head); const habUl = document.createElement('ul'); habUl.classList.add('routine-habits-list'); if (r.habitDefinitionIds.length > 0) { r.habitDefinitionIds.forEach(hId => { const hDef = definedHabits.find(hd => hd.id === hId); if (hDef) { const hLi = document.createElement('li'); hLi.textContent = `${hDef.name} (${hDef.category})`; habUl.appendChild(hLi); } }); } else { const noH = document.createElement('li'); noH.textContent = "No habits in routine."; noH.style.fontStyle = "italic"; habUl.appendChild(noH); } li.appendChild(habUl); const addHSec = document.createElement('div'); addHSec.classList.add('add-habit-to-routine-section'); const hSel = document.createElement('select'); hSel.classList.add('select-habit-for-routine'); populateHabitSelectDropdown(hSel); const addHBtn = document.createElement('button'); addHBtn.classList.add('add-selected-habit-button'); addHBtn.textContent = "Add Habit"; addHBtn.addEventListener('click', () => { const selHId = hSel.value; if (selHId) addHabitToRoutine(r.id, selHId); else alert("Select a habit."); }); addHSec.appendChild(hSel); addHSec.appendChild(addHBtn); li.appendChild(addHSec); definedRoutinesListUL.appendChild(li); }); updateRoutineDisplay(); }
    function updateRoutineDisplay() { const activeRoutines = definedRoutines.filter(r => r.isActive).length; if (activeRoutineCountDisplay) activeRoutineCountDisplay.textContent = activeRoutines; if (totalRoutineSlotsDisplay) totalRoutineSlotsDisplay.textContent = routineSlots; }
    function gameOver() { gameIsOver = true; clearInterval(gameLoopInterval); clearInterval(dayTimerInterval); if(gameOverMessage) {gameOverMessage.textContent = `GAME OVER! Your Base Survived ${daysSurvived} Days.`; gameOverMessage.classList.remove('hidden');} if(restartButton) restartButton.classList.remove('hidden'); if(baseElement) baseElement.style.backgroundImage = "url('base_000.png')"; [taskNameInput, taskCategoryInput, taskHighPriorityInput, dueDateInput, dueTimeInput, addTaskButton, habitNameInput, habitCategoryInput, habitFrequencyInput, habitTimeOfDayInput, addHabitButton, routineNameInput, createRoutineButton].forEach(el => { if(el) el.disabled = true; }); }
    function updateGame() { if (!gameIsOver) updateActiveItems(); }

    // --- EVENT LISTENERS ---
    if(showTaskFormButton) showTaskFormButton.addEventListener('click', () => {
        if(taskForm) taskForm.classList.add('active-form');
        if(habitForm) habitForm.classList.remove('active-form');
        if (routineForm) routineForm.classList.remove('active-form');

        showTaskFormButton.classList.add('active');
        if(showHabitFormButton) showHabitFormButton.classList.remove('active');
        if (showRoutineFormButton) showRoutineFormButton.classList.remove('active');
    });

    if(showHabitFormButton) showHabitFormButton.addEventListener('click', () => {
        if(habitForm) habitForm.classList.add('active-form');
        if(taskForm) taskForm.classList.remove('active-form');
        if (routineForm) routineForm.classList.remove('active-form');

        showHabitFormButton.classList.add('active');
        if(showTaskFormButton) showTaskFormButton.classList.remove('active');
        if (showRoutineFormButton) showRoutineFormButton.classList.remove('active');
    });

    if (showRoutineFormButton) {
        showRoutineFormButton.addEventListener('click', () => {
            if (routineForm) routineForm.classList.add('active-form');
            if(taskForm) taskForm.classList.remove('active-form');
            if(habitForm) habitForm.classList.remove('active-form');

            showRoutineFormButton.classList.add('active');
            if(showTaskFormButton) showTaskFormButton.classList.remove('active');
            if(showHabitFormButton) showHabitFormButton.classList.remove('active');
            renderDefinedRoutines();
        });
    }

    if(addTaskButton) addTaskButton.addEventListener('click', () => {
        if (gameIsOver) return;
        const name = taskNameInput.value.trim(); const category = taskCategoryInput.value;
        const isHighPriority = taskHighPriorityInput.checked; const dueDate = dueDateInput.value; const dueTime = dueTimeInput.value;
        if (!name || !dueDate) { alert("Task Name and Due Date are required."); return; }
        const taskData = createTaskItemData(name, category, isHighPriority, dueDate, dueTime);
        addItemToGame(taskData); sortAndRenderActiveList();
        clearFormInputs();
        taskNameInput.focus();
    });

    if(addHabitButton) addHabitButton.addEventListener('click', () => {
        if (gameIsOver) return;
        const name = habitNameInput.value.trim(); const category = habitCategoryInput.value;
        const frequency = habitFrequencyInput.value; const timeOfDay = habitTimeOfDayInput.value;
        if (!name) { alert("Habit Name is required."); return; }
        createHabitDefinition(name, category, frequency, timeOfDay);
        clearFormInputs();
        habitNameInput.focus();
    });

    if (createRoutineButton) {
        createRoutineButton.addEventListener('click', createRoutineDefinition);
    }

    if(restartButton) restartButton.addEventListener('click', initGame);

    if(taskNameInput) taskNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && taskForm && taskForm.classList.contains('active-form')) {
            if(addTaskButton) addTaskButton.click();
        }
    });
    if(habitNameInput) habitNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && habitForm && habitForm.classList.contains('active-form')) {
            if(addHabitButton) addHabitButton.click();
        }
    });

    const debugAdvanceDayButton = document.getElementById('debugAdvanceDayButton');
    const debugResetHabitStreaksButton = document.getElementById('debugResetHabitStreaksButton');
    const debugDamageBaseButton = document.getElementById('debugDamageBaseButton');

    if (debugAdvanceDayButton) {
        debugAdvanceDayButton.addEventListener('click', () => {
            if (gameIsOver) { console.log("DEBUG: Game is over, cannot advance day."); return; }
            if (!currentGameDate) { console.error("DEBUG ERROR: currentGameDate is not set."); return;}
            console.log("DEBUG: Simulating Next Day for Habits. Current game day:", currentGameDate.toDateString());
            currentGameDate.setDate(currentGameDate.getDate() + 1);
            const itemsToKeep = []; const itemsToRemove = [];
            for (const item of activeItems) {
                if (item.type === 'habit') {
                    if (!item.originalDueDate || item.originalDueDate.toDateString() !== currentGameDate.toDateString()) {
                        itemsToRemove.push(item);
                    } else { itemsToKeep.push(item); }
                } else { itemsToKeep.push(item); }
            }
            itemsToRemove.forEach(item => {
                 if (item.element) item.element.remove();
                 if (item.listItemElement) item.listItemElement.remove();
            });
            activeItems = itemsToKeep;
            console.log("DEBUG: New game day:", currentGameDate.toDateString());
            generateDailyHabitInstances(currentGameDate);
        });
    }
    if (debugResetHabitStreaksButton) {
        debugResetHabitStreaksButton.addEventListener('click', () => {
            console.log("DEBUG: Resetting all habit streaks and last completion dates");
            definedHabits.forEach(def => { def.streak = 0; def.lastCompletionDate = null; });
            activeItems.forEach(item => { if (item.element) item.element.remove(); if (item.listItemElement) item.listItemElement.remove(); });
            activeItems = []; if(activeItemsListUL) activeItemsListUL.innerHTML = '';
            currentGameDate = new Date(); currentGameDate.setHours(0,0,0,0);
            generateDailyHabitInstances(currentGameDate);
            console.log("DEBUG: Streaks reset. Habits regenerated for game day:", currentGameDate.toDateString());
        });
    }
    if (debugDamageBaseButton) {
        debugDamageBaseButton.addEventListener('click', () => {
            if (gameIsOver) { console.log("DEBUG: Game is over, cannot damage base."); return; }
            console.log("DEBUG: Manually damaging base by 10 HP.");
            damageBase(10);
        });
    }

    initGame();
});
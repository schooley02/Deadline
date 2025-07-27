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
    const totalRoutineSlotsDisplay = document.getElementById('totalRoutineSlotsDisplay'); // We'll use this from playerLevel
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
    let baseHealth, playerXP;
    let playerLevel;
    let definedRoutines = []; // New: Array to store routine definitions
    let routineSlots;
    let activeItems = [];
    let definedHabits = [];
    let itemIdCounter;
    let gameLoopInterval;
    let gameIsOver;
    let daysSurvived;
    let dayTimerInterval;
    let currentGameDate; // Date object representing the game's current day

    // --- Game Settings ---
    const GAME_TICK_MS = 50;
    const DAY_DURATION_MS = 60000;
    const OVERDUE_DAMAGE = 1;
    const DAMAGE_INTERVAL_MS = 5 * 60 * 1000;
    // const DAMAGE_INTERVAL_MS = 10 * 1000; // For testing
    const XP_PER_TASK_DEFEAT = 10;
    const XP_PER_HABIT_COMPLETE = 5;
    const HABIT_STREAK_BONUS_THRESHOLD = 2; // Set low for easy testing of "on fire"
    const LEVEL_XP_THRESHOLDS = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000]; // XP needed for level (index = level - 1)
    const ROUTINE_SLOTS_PER_LEVEL = { // Key: Level, Value: Total Slots at that level
        1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8:4 // Example progression
    };
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
        routineSlots = ROUTINE_SLOTS_PER_LEVEL[playerLevel] || 1; // Get initial slots for level 1
        updatePlayerLevelDisplay();
        updateRoutineSlotsDisplay();
        baseHealth = 100; baseHealthDisplay.textContent = baseHealth;
        baseElement.style.backgroundImage = "url('base_100.png')"; // Reset to pristine
        baseElement.classList.remove('base-shaking'); // If we add a shaking class
        gameOverMessage.classList.add('hidden');

        taskForm.classList.add('active-form');
        habitForm.classList.remove('active-form');
        routineForm.classList.remove('active-form');
        showTaskFormButton.classList.add('active');
        showHabitFormButton.classList.remove('active');
        if(showRoutineFormButton) showRoutineFormButton.classList.remove('active');

        [taskNameInput, taskCategoryInput, taskHighPriorityInput, dueDateInput, dueTimeInput, addTaskButton,
         habitNameInput, habitCategoryInput, habitFrequencyInput, habitTimeOfDayInput, addHabitButton]
        .forEach(el => el.disabled = false);
        restartButton.classList.add('hidden');

        activeItems.forEach(item => {
            if (item.element) item.element.remove();
            if (item.listItemElement) item.listItemElement.remove();
        });
        activeItems = [];
        activeItemsListUL.innerHTML = '';
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
            if (!gameIsOver) {
                daysSurvived++;
                // Note: Real-time day change for habits is complex.
                // For this MPE, rely on restarting or the debug button for day advancement.
            }
        }, DAY_DURATION_MS);
        console.log("Game Initialized. Game Day:", currentGameDate.toDateString(), "Defined Habits:", definedHabits.length);
        console.log("Game Initialized. Defined Routines:", definedRoutines.length);
    }

    function clearFormInputs() {
        taskNameInput.value = ''; taskCategoryInput.value = 'other'; taskHighPriorityInput.checked = false;
        dueDateInput.value = ''; dueTimeInput.value = '';
        habitNameInput.value = ''; habitCategoryInput.value = 'health';
        habitFrequencyInput.value = 'daily'; habitTimeOfDayInput.value = 'anytime';
    }

    function updatePlayerXpDisplay() { playerXpDisplay.textContent = playerXP; }
    function updatePlayerLevelDisplay() { playerLevelDisplay.textContent = playerLevel; }
    function updateRoutineSlotsDisplay() { routineSlotsDisplay.textContent = routineSlots; }

function showLevelUpMessage() {
        levelUpMessage.textContent = `LEVEL ${playerLevel}!`;
        levelUpMessage.classList.remove('hidden');
        // The animation will hide it. If no animation, use setTimeout:
        setTimeout(() => {
            levelUpMessage.classList.add('hidden');
        }, 2500); // Match CSS animation duration
    }

    function checkPlayerLevelUp() {
        if (playerLevel >= MAX_PLAYER_LEVEL) return false; // Already max level

        // Find the XP threshold for the *next* level
        // LEVEL_XP_THRESHOLDS[playerLevel] is the XP needed for playerLevel + 1
        if (playerXP >= LEVEL_XP_THRESHOLDS[playerLevel]) { // playerLevel is 1-based, array is 0-based
            playerLevel++;
            console.log("LEVEL UP! Reached Level:", playerLevel);
            updatePlayerLevelDisplay();
            showLevelUpMessage();

            // Check if this new level grants more routine slots
            if (ROUTINE_SLOTS_PER_LEVEL[playerLevel] && ROUTINE_SLOTS_PER_LEVEL[playerLevel] > routineSlots) {
                routineSlots = ROUTINE_SLOTS_PER_LEVEL[playerLevel];
                updateRoutineSlotsDisplay();
                console.log("Routine Slots increased to:", routineSlots);
                // Could add another message for slot increase if desired
            }
            // Recursively check if enough XP for multiple levels (unlikely with current XP gain)
            checkPlayerLevelUp();
            return true;
        }
        return false;
    }

    function createTaskItemData(name, category, isHighPriority, dueDateStr, dueTimeStr) {
        const creationTime = new Date();
        let dueDateTime;
        if (dueDateStr && dueTimeStr) { dueDateTime = new Date(`${dueDateStr}T${dueTimeStr}`);}
        else if (dueDateStr) { dueDateTime = new Date(dueDateStr); dueDateTime.setHours(23, 59, 59, 999); }
        else { dueDateTime = new Date(creationTime.getTime() + 10 * 60 * 1000); }

        if (isNaN(dueDateTime.getTime()) || (dueDateTime < creationTime &&
            !(dueDateStr && dueDateTime.getFullYear() === creationTime.getFullYear() &&
              dueDateTime.getMonth() === creationTime.getMonth() &&
              dueDateTime.getDate() === creationTime.getDate() &&
              dueDateTime.getHours() === 23 && dueDateTime.getMinutes() === 59)
            )) {
            if (isNaN(dueDateTime.getTime()) || dueDateTime < creationTime) {
                console.warn("Task: Invalid or past due. Setting due in 5 minutes.", dueDateTime, creationTime);
                dueDateTime = new Date(creationTime.getTime() + 5 * 60 * 1000);
            }
        }
        return {
            id: itemIdCounter++, type: 'task', name: name || "Task", category: category || "other",
            isHighPriority: isHighPriority, dueDateTime: dueDateTime, creationTime: creationTime,
            timeToDueAtCreationMs: Math.max(0, dueDateTime.getTime() - creationTime.getTime()),
            x: GAME_SCREEN_WIDTH - ENEMY_WIDTH, isOverdue: false, lastDamageTickTime: null,
            element: null, listItemElement: null
        };
    }

    function createHabitDefinition(name, category, frequency, timeOfDay) {
        const newHabitDef = {
            id: `habitDef_${definedHabits.length}_${Date.now()}`, name, category, frequency,
            timeOfDay, streak: 0, lastCompletionDate: null
        };
        definedHabits.push(newHabitDef);
        console.log("Habit Definition Added:", newHabitDef);
        generateDailyHabitInstances(currentGameDate);
    }

    function getHabitInstanceDueTime(timeOfDayString, referenceDate) {
        const due = new Date(referenceDate);
        due.setSeconds(0,0);
        switch (timeOfDayString) {
            case 'morning': due.setHours(12, 0); break;
            case 'afternoon': due.setHours(17, 0); break;
            case 'evening': due.setHours(22, 0); break;
            default: due.setHours(23, 59); break;
        }
        return due;
    }

    function createHabitInstanceData(habitDef, forDate) {
        const instanceCreationTime = new Date();
        const dueDateTime = getHabitInstanceDueTime(habitDef.timeOfDay, forDate);

        if (dueDateTime < instanceCreationTime && dueDateTime.toDateString() === instanceCreationTime.toDateString()) {
            console.log(`Skipping habit instance for "${habitDef.name}" for ${forDate.toDateString()} as its window has passed based on current time.`);
            return null;
        }
        return {
            id: itemIdCounter++, type: 'habit', definitionId: habitDef.id, name: habitDef.name,
            category: habitDef.category, isHighPriority: false, dueDateTime: dueDateTime,
            creationTime: instanceCreationTime,
            timeToDueAtCreationMs: Math.max(0, dueDateTime.getTime() - instanceCreationTime.getTime()),
            x: GAME_SCREEN_WIDTH - HABIT_ENEMY_WIDTH, isOverdue: false, lastDamageTickTime: null,
            streak: habitDef.streak, element: null, listItemElement: null,
            originalDueDate: new Date(dueDateTime)
        };
    }

    function generateDailyHabitInstances(forWhichGameDay) {
        const forWhichGameDayString = forWhichGameDay.toDateString();
        console.log("Generating habit instances for game day:", forWhichGameDayString);

        definedHabits.forEach(habitDef => {
            if (habitDef.frequency === 'daily') {
                const lastCompletionDayString = habitDef.lastCompletionDate ? new Date(habitDef.lastCompletionDate).toDateString() : null;
                const alreadyCompletedForThisGameDay = lastCompletionDayString === forWhichGameDayString;

                const existingActiveInstance = activeItems.find(item =>
                    item.type === 'habit' &&
                    item.definitionId === habitDef.id &&
                    item.originalDueDate &&
                    item.originalDueDate.toDateString() === forWhichGameDayString
                );

                if (!alreadyCompletedForThisGameDay && !existingActiveInstance) {
                    const habitInstanceData = createHabitInstanceData(habitDef, forWhichGameDay);
                    if (habitInstanceData) {
                        addItemToGame(habitInstanceData);
                    }
                } else {
                     console.log(`Skipping generation for ${habitDef.name} on ${forWhichGameDayString}: Completed=${alreadyCompletedForThisGameDay}, ExistingActive=${!!existingActiveInstance}`);
                }
            }
        });
        sortAndRenderActiveList();
    }

    function addItemToGame(itemData) {
        if (gameIsOver) return;
        const itemElement = document.createElement('div');
        itemElement.classList.add('enemy');
        itemElement.classList.add(`category-${itemData.category}`);
        const itemSpriteWidth = (itemData.type === 'habit') ? HABIT_ENEMY_WIDTH : ENEMY_WIDTH;
        const itemSpriteHeight = (itemData.type === 'habit') ? 60 : 70;
        itemElement.style.width = `${itemSpriteWidth}px`;
        itemElement.style.height = `${itemSpriteHeight}px`;

        if (itemData.type === 'task' && itemData.isHighPriority) { itemElement.classList.add('high-priority'); }
        else if (itemData.type === 'habit') {
            itemElement.classList.add('habit-enemy');
            if (itemData.streak >= HABIT_STREAK_BONUS_THRESHOLD) { itemElement.classList.add('high-streak'); }
        }

        itemElement.style.left = itemData.x + 'px';
        const randomTop = Math.random() * (gameScreen.offsetHeight - itemSpriteHeight);
        itemElement.style.top = Math.max(0, Math.min(randomTop, gameScreen.offsetHeight - itemSpriteHeight)) + 'px';
        itemElement.dataset.itemId = itemData.id;
        itemElement.addEventListener('click', () => !gameIsOver && completeItem(itemData.id));
        gameScreen.appendChild(itemElement);
        itemData.element = itemElement;

        const listItem = document.createElement('li');
        listItem.dataset.itemId = itemData.id;
        if (itemData.type === 'task' && itemData.isHighPriority) listItem.classList.add('high-priority-list-item');

        const itemInfoDiv = document.createElement('div'); itemInfoDiv.classList.add('item-info');
        const itemNameSpan = document.createElement('span'); itemNameSpan.classList.add('item-name'); itemNameSpan.textContent = itemData.name;
        const itemDueSpan = document.createElement('span'); itemDueSpan.classList.add('item-due'); itemDueSpan.textContent = `Due: ${itemData.dueDateTime.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`;
        itemInfoDiv.appendChild(itemNameSpan); itemInfoDiv.appendChild(itemDueSpan);

        const itemCategorySpan = document.createElement('span'); itemCategorySpan.classList.add('item-category');
        itemCategorySpan.textContent = itemData.category.charAt(0).toUpperCase() + itemData.category.slice(1);
        const currentCategoryStyle = categoryStyles[itemData.category] || categoryStyles["other"];
        itemCategorySpan.style.backgroundColor = currentCategoryStyle.bgColor;
        if (currentCategoryStyle.textColorClass) itemCategorySpan.classList.add(currentCategoryStyle.textColorClass);
        else { itemCategorySpan.classList.remove("category-relationships-text", "category-other-text"); }
        itemInfoDiv.appendChild(itemCategorySpan);

        if (itemData.type === 'habit') {
            const streakSpan = document.createElement('span'); streakSpan.classList.add('item-streak');
            streakSpan.textContent = `Streak: ${itemData.streak}`;
            itemInfoDiv.appendChild(streakSpan);
        }

        const itemActionsDiv = document.createElement('div'); itemActionsDiv.classList.add('item-actions');
        const completeButton = document.createElement('button');
        completeButton.textContent = itemData.type === 'habit' ? "Complete" : "Defeat";
        completeButton.addEventListener('click', () => !gameIsOver && completeItem(itemData.id));
        itemActionsDiv.appendChild(completeButton);
        listItem.appendChild(itemInfoDiv); listItem.appendChild(itemActionsDiv);
        itemData.listItemElement = listItem;

        if (itemData.dueDateTime < new Date()) {
             markAsOverdue(itemData, new Date());
             itemData.x = BASE_WIDTH;
             if(itemData.element) itemData.element.style.left = itemData.x + 'px';
        }
        activeItems.push(itemData);
    }

    function sortAndRenderActiveList() {
        activeItems.sort((a, b) => a.dueDateTime - b.dueDateTime);
        if (activeItemsListUL) activeItemsListUL.innerHTML = ''; // Check if UL exists
        activeItems.forEach(item => {
            if (activeItemsListUL && item.listItemElement) { // Check both
                 activeItemsListUL.appendChild(item.listItemElement)
            }
        });
    }

    function markAsOverdue(item, currentTime) {
        if(item.isOverdue) return;
        item.isOverdue = true;
        item.lastDamageTickTime = item.dueDateTime.getTime();
        if (item.element) item.element.classList.add('enemy-at-base');
        if (item.listItemElement) item.listItemElement.classList.add('overdue-list-item');
        console.log(`Item "${item.name}" (${item.type}) is NOW overdue.`);

        if (item.type === 'habit') {
            const habitDef = definedHabits.find(def => def.id === item.definitionId);
            if (habitDef && habitDef.streak > 0) {
                habitDef.streak = 0;
                console.log(`Streak for habit "${habitDef.name}" broken due to overdue.`);
                if(item.listItemElement) {
                    const streakSpan = item.listItemElement.querySelector('.item-streak');
                    if (streakSpan) streakSpan.textContent = `Streak: 0`;
                }
                if (item.element) item.element.classList.remove('high-streak');
            }
        }
    }

    function updateActiveItems() {
        if (gameIsOver) return;
        const actualCurrentTime = new Date();
        const actualCurrentTimeMs = actualCurrentTime.getTime();

        for (let i = activeItems.length - 1; i >= 0; i--) {
            const item = activeItems[i];
            const currentItemWidth = (item.type === 'habit') ? HABIT_ENEMY_WIDTH : ENEMY_WIDTH;

            if (!item.isOverdue) {
                if (item.dueDateTime <= actualCurrentTime) {
                    item.x = BASE_WIDTH;
                    markAsOverdue(item, actualCurrentTime);
                } else if (item.timeToDueAtCreationMs > 0) {
                    const timeElapsedSinceInstanceCreationMs = actualCurrentTimeMs - item.creationTime.getTime();
                    const progress = Math.min(1, timeElapsedSinceInstanceCreationMs / item.timeToDueAtCreationMs);
                    const travelDistance = GAME_SCREEN_WIDTH - BASE_WIDTH - currentItemWidth;
                    item.x = (GAME_SCREEN_WIDTH - currentItemWidth) - (progress * travelDistance);
                } else {
                    item.x = BASE_WIDTH;
                    markAsOverdue(item, actualCurrentTime);
                }
                if (item.element) item.element.style.left = Math.max(BASE_WIDTH, item.x) + 'px';
            }

            if (item.isOverdue) {
                if (actualCurrentTimeMs >= item.lastDamageTickTime + DAMAGE_INTERVAL_MS) {
                    damageBase(OVERDUE_DAMAGE);
                    item.lastDamageTickTime += DAMAGE_INTERVAL_MS;
                    if (gameIsOver) break;
                }
            }
        }
    }

    function updateBaseVisuals() {
        let newBaseImage = '';
        baseElement.classList.remove('base-shaking'); // Remove any continuous effects first

        if (baseHealth > 75) {
            newBaseImage = 'base_100.png';
        } else if (baseHealth > 50) {
            newBaseImage = 'base_075.png';
        } else if (baseHealth > 25) {
            newBaseImage = 'base_050.png'; // Might start showing smoke
            // Optionally add a class for continuous smoke animation if not part of sprite
            // baseElement.classList.add('base-smoking');
        } else if (baseHealth > 0) {
            newBaseImage = 'base_025.png'; // Heavily damaged, flames/more smoke
            baseElement.classList.add('base-shaking'); // Example: start shaking when very low
        } else { // baseHealth <= 0
            newBaseImage = 'base_000.png'; // Destroyed
            baseElement.classList.add('base-shaking'); // Keep shaking or more intense effect
        }

        // Check current background image to avoid unnecessary re-application
        const currentBgImage = baseElement.style.backgroundImage;
        const targetBgImage = `url("${newBaseImage}")`; // Note the quotes around newBaseImage

        if (newBaseImage && currentBgImage !== targetBgImage) {
            baseElement.style.backgroundImage = targetBgImage;
            console.log("Base image updated to:", newBaseImage);
        }
    }

    function damageBase(amount) {
        if (gameIsOver) return;
        baseHealth -= amount;
        if (baseHealth < 0) baseHealth = 0;
        baseHealthDisplay.textContent = baseHealth;
        baseElement.classList.add('base-hit-flash');
        setTimeout(() => baseElement.classList.remove('base-hit-flash'), 300);
        updateBaseVisuals(); // Call to update the base's appearance
        console.log("Base damaged. Health:", baseHealth);
        if (baseHealth <= 0) gameOver();
    }

    function completeItem(itemId) {
        if (gameIsOver) return;
        const itemIndex = activeItems.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;
        const item = activeItems[itemIndex];

        let xpGained = 0;
        if (item.type === 'task') {
            xpGained = XP_PER_TASK_DEFEAT;
            console.log(`Task "${item.name}" defeated.`);
        } else if (item.type === 'habit') {
            const habitDef = definedHabits.find(def => def.id === item.definitionId);
            if (habitDef) {
                habitDef.streak++;
                habitDef.lastCompletionDate = new Date(item.originalDueDate);
                xpGained = XP_PER_HABIT_COMPLETE;
                console.log(`Habit "${habitDef.name}" completed for ${item.originalDueDate.toDateString()}. Streak: ${habitDef.streak}`);
            }
        }

        if (xpGained > 0) {
            playerXP += xpGained;
            updatePlayerXpDisplay();
            checkPlayerLevelUp(); // Check for level up after gaining XP
        }
        removeItem(itemId);
    }
    function removeItem(itemId) {
        const itemIndex = activeItems.findIndex(i => i.id === itemId);
        if (itemIndex > -1) {
            const item = activeItems[itemIndex];
            if (item.element) item.element.remove();
            if (item.listItemElement) item.listItemElement.remove();
            activeItems.splice(itemIndex, 1);
            console.log(`Item ID ${itemId} (${item.type}) removed.`);
        }
    }

    function createRoutineDefinition() {
        const name = routineNameInput.value.trim();
        if (!name) {
            alert("Please enter a name for the new routine.");
            return;
        }
        // Check for duplicate routine names (optional but good practice)
        if (definedRoutines.some(routine => routine.name.toLowerCase() === name.toLowerCase())) {
            alert("A routine with this name already exists.");
            return;
        }

        const newRoutine = {
            id: `routine_${definedRoutines.length}_${Date.now()}`,
            name: name,
            habitDefinitionIds: [], // Array to store IDs of habits in this routine
            isActive: false // Routines are not active by default
        };
        definedRoutines.push(newRoutine);
        routineNameInput.value = ''; // Clear input
        console.log("Routine Created:", newRoutine);
        renderDefinedRoutines(); // Re-render the list of routines
    }

    function addHabitToRoutine(routineId, habitDefId) {
        const routine = definedRoutines.find(r => r.id === routineId);
        const habitDef = definedHabits.find(hd => hd.id === habitDefId);

        if (!routine) {
            console.error("Routine not found:", routineId);
            alert("Error: Could not find the specified routine.");
            return;
        }
        if (!habitDef) {
            console.error("Habit definition not found:", habitDefId);
            alert("Error: Could not find the selected habit definition.");
            return;
        }

        // Check if habit is already in this routine
        if (routine.habitDefinitionIds.includes(habitDefId)) {
            alert(`Habit "${habitDef.name}" is already in routine "${routine.name}".`);
            return;
        }

        routine.habitDefinitionIds.push(habitDefId);
        console.log(`Habit "${habitDef.name}" added to routine "${routine.name}".`);
        renderDefinedRoutines(); // Re-render to show updated habit list in routine
    }

    function populateHabitSelectDropdown(selectElement) {
        selectElement.innerHTML = '<option value="">-- Select Habit to Add --</option>'; // Clear existing and add placeholder
        if (definedHabits.length === 0) {
            const option = document.createElement('option');
            option.textContent = "No habits defined yet";
            option.disabled = true;
            selectElement.appendChild(option);
            return;
        }
        definedHabits.forEach(habitDef => {
            const option = document.createElement('option');
            option.value = habitDef.id;
            option.textContent = `${habitDef.name} (${habitDef.category})`;
            selectElement.appendChild(option);
        });
    }

    function renderDefinedRoutines() {
        if (!definedRoutinesListUL) return;
        definedRoutinesListUL.innerHTML = ''; // Clear existing list

        if (definedRoutines.length === 0) {
            definedRoutinesListUL.innerHTML = '<li>No routines created yet.</li>';
            return;
        }

        definedRoutines.forEach(routine => {
            const listItem = document.createElement('li');
            listItem.dataset.routineId = routine.id;

            // Header: Name and Activate/Deactivate Button
            const headerDiv = document.createElement('div');
            headerDiv.classList.add('routine-header');
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('routine-name-display');
            nameSpan.textContent = routine.name;
            // Activate/Deactivate button (functionality to be added later)
            const activateButton = document.createElement('button');
            activateButton.classList.add('activate-routine-button');
            activateButton.textContent = routine.isActive ? "Deactivate" : "Activate";
            activateButton.dataset.routineId = routine.id;
            // activateButton.addEventListener('click', () => toggleRoutineActiveState(routine.id)); // Will add this later

            headerDiv.appendChild(nameSpan);
            headerDiv.appendChild(activateButton);
            listItem.appendChild(headerDiv);

            // List of Habits in this Routine
            const habitsUl = document.createElement('ul');
            habitsUl.classList.add('routine-habits-list');
            if (routine.habitDefinitionIds.length > 0) {
                routine.habitDefinitionIds.forEach(habitDefId => {
                    const habitDef = definedHabits.find(hd => hd.id === habitDefId);
                    if (habitDef) {
                        const habitLi = document.createElement('li');
                        habitLi.textContent = `${habitDef.name} (${habitDef.category})`;
                        // Remove habit button (functionality to be added later)
                        // const removeHabitBtn = document.createElement('button'); /* ... */
                        // habitLi.appendChild(removeHabitBtn);
                        habitsUl.appendChild(habitLi);
                    }
                });
            } else {
                const noHabitsLi = document.createElement('li');
                noHabitsLi.textContent = "No habits added to this routine yet.";
                noHabitsLi.style.fontStyle = "italic";
                habitsUl.appendChild(noHabitsLi);
            }
            listItem.appendChild(habitsUl);

            // Section to Add Habits to this Routine
            const addHabitSectionDiv = document.createElement('div');
            addHabitSectionDiv.classList.add('add-habit-to-routine-section');
            const habitSelect = document.createElement('select');
            habitSelect.classList.add('select-habit-for-routine');
            populateHabitSelectDropdown(habitSelect); // Populate with defined habits
            const addSelectedHabitBtn = document.createElement('button');
            addSelectedHabitBtn.classList.add('add-selected-habit-button');
            addSelectedHabitBtn.textContent = "Add Habit to Routine";
            addSelectedHabitBtn.addEventListener('click', () => {
                const selectedHabitDefId = habitSelect.value;
                if (selectedHabitDefId) {
                    addHabitToRoutine(routine.id, selectedHabitDefId);
                } else {
                    alert("Please select a habit to add.");
                }
            });

            addHabitSectionDiv.appendChild(habitSelect);
            addHabitSectionDiv.appendChild(addSelectedHabitBtn);
            listItem.appendChild(addHabitSectionDiv);

            definedRoutinesListUL.appendChild(listItem);
        });
        updateRoutineDisplay(); // Update active/total slots display
    }

    function updateRoutineDisplay() { // Updates the "Active Routines: X/Y" display
        const activeRoutines = definedRoutines.filter(r => r.isActive).length;
        if (activeRoutineCountDisplay) activeRoutineCountDisplay.textContent = activeRoutines;
        if (totalRoutineSlotsDisplay) totalRoutineSlotsDisplay.textContent = routineSlots; // routineSlots is from player leveling
    }

    function gameOver() {
        console.log("GAME OVER"); gameIsOver = true;
        clearInterval(gameLoopInterval); clearInterval(dayTimerInterval);
        gameOverMessage.textContent = `GAME OVER! Your Base Survived ${daysSurvived} Days.`;
        gameOverMessage.classList.remove('hidden');
        restartButton.classList.remove('hidden');
        baseElement.style.backgroundImage = "url('base_000.png')";
        [taskNameInput, taskCategoryInput, taskHighPriorityInput, dueDateInput, dueTimeInput, addTaskButton,
         habitNameInput, habitCategoryInput, habitFrequencyInput, habitTimeOfDayInput, addHabitButton]
        .forEach(el => el.disabled = true);
        if (baseElement.style.backgroundImage !== `url("base_000.png")`) {
            baseElement.style.backgroundImage = "url('base_000.png')";
        }
    }

    function updateGame() { if (!gameIsOver) updateActiveItems(); }

    // --- SETUP EVENT LISTENERS ---
 // Form Toggles
    showTaskFormButton.addEventListener('click', () => {
        taskForm.classList.add('active-form'); habitForm.classList.remove('active-form'); routineForm.classList.remove('active-form');
        showTaskFormButton.classList.add('active'); showHabitFormButton.classList.remove('active'); if(showRoutineFormButton) showRoutineFormButton.classList.remove('active');
    });
    showHabitFormButton.addEventListener('click', () => {
        habitForm.classList.add('active-form'); taskForm.classList.remove('active-form'); routineForm.classList.remove('active-form');
        showHabitFormButton.classList.add('active'); showTaskFormButton.classList.remove('active'); if(showRoutineFormButton) showRoutineFormButton.classList.remove('active');
    });
    if (showRoutineFormButton) { // Check if element exists before adding listener
        showRoutineFormButton.addEventListener('click', () => {
            routineForm.classList.add('active-form'); taskForm.classList.remove('active-form'); habitForm.classList.remove('active-form');
            if(showRoutineFormButton) showRoutineFormButton.classList.add('active'); showTaskFormButton.classList.remove('active'); showHabitFormButton.classList.remove('active');
            renderDefinedRoutines(); // Re-render routine list when this tab is opened
        });
    }    

addTaskButton.addEventListener('click', () => {
        if (gameIsOver) return;
        const name = taskNameInput.value.trim(); const category = taskCategoryInput.value;
        const isHighPriority = taskHighPriorityInput.checked; const dueDate = dueDateInput.value; const dueTime = dueTimeInput.value;
        if (!name || !dueDate) { alert("Task Name and Due Date are required."); return; }
        const taskData = createTaskItemData(name, category, isHighPriority, dueDate, dueTime);
        addItemToGame(taskData); sortAndRenderActiveList(); // Ensure list is updated after adding
        clearFormInputs(); // Clear all forms
        taskNameInput.focus();
    });

    addHabitButton.addEventListener('click', () => {
        if (gameIsOver) return;
        const name = habitNameInput.value.trim(); const category = habitCategoryInput.value;
        const frequency = habitFrequencyInput.value; const timeOfDay = habitTimeOfDayInput.value;
        if (!name) { alert("Habit Name is required."); return; }
        createHabitDefinition(name, category, frequency, timeOfDay); // This calls generateDailyHabitInstances
        clearFormInputs(); // Clear all forms
        habitNameInput.focus();
    });

    // Create Routine Button
    if (createRoutineButton) { // Check if element exists
        createRoutineButton.addEventListener('click', createRoutineDefinition);
    }

    restartButton.addEventListener('click', initGame);

    taskNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && taskForm.classList.contains('active-form')) {
            addTaskButton.click();
        }
    });
    // Optional: Add similar for habitNameInput if desired
    habitNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && habitForm.classList.contains('active-form')) {
            addHabitButton.click();
        }
    });


    showTaskFormButton.addEventListener('click', () => {
        taskForm.classList.add('active-form');
        habitForm.classList.remove('active-form');
        showTaskFormButton.classList.add('active');
        showHabitFormButton.classList.remove('active');
    });

    showHabitFormButton.addEventListener('click', () => {
        habitForm.classList.add('active-form');
        taskForm.classList.remove('active-form');
        showHabitFormButton.classList.add('active');
        showTaskFormButton.classList.remove('active');
    });

    // Debug Button Event Listeners
    const debugAdvanceDayButton = document.getElementById('debugAdvanceDayButton');
    const debugResetHabitStreaksButton = document.getElementById('debugResetHabitStreaksButton');
    const debugDamageBaseButton = document.getElementById('debugDamageBaseButton'); // Get the new button

    if (debugAdvanceDayButton) {
        debugAdvanceDayButton.addEventListener('click', () => {
            if (gameIsOver) { console.log("DEBUG: Game is over, cannot advance day."); return; }
            if (!currentGameDate) { console.error("DEBUG ERROR: currentGameDate is not set."); return;}
            console.log("DEBUG: Simulating Next Day for Habits. Current game day:", currentGameDate.toDateString());

            currentGameDate.setDate(currentGameDate.getDate() + 1);

            // Clear only active habit instances. Tasks remain.
            // We need to be careful not to modify activeItems while iterating if we used forEach + splice.
            // Filtering is safer.
            const itemsToKeep = [];
            const itemsToRemove = [];

            for (const item of activeItems) {
                if (item.type === 'habit') {
                    // If a habit instance's originalDueDate is not for the new currentGameDate, mark for removal
                    if (!item.originalDueDate || item.originalDueDate.toDateString() !== currentGameDate.toDateString()) {
                        itemsToRemove.push(item);
                    } else {
                        itemsToKeep.push(item); // Habit for the new current day, keep it (shouldn't happen if gen logic is right)
                    }
                } else {
                    itemsToKeep.push(item); // Keep all tasks
                }
            }
            itemsToRemove.forEach(item => {
                 if (item.element) item.element.remove();
                 if (item.listItemElement) item.listItemElement.remove();
            });
            activeItems = itemsToKeep;


            console.log("DEBUG: New game day:", currentGameDate.toDateString());
            generateDailyHabitInstances(currentGameDate); // This will add new habits for the new day
            // sortAndRenderActiveList(); // generateDailyHabitInstances calls this
        });
    }

    if (debugResetHabitStreaksButton) {
        debugResetHabitStreaksButton.addEventListener('click', () => {
            console.log("DEBUG: Resetting all habit streaks and last completion dates");
            definedHabits.forEach(def => {
                def.streak = 0;
                def.lastCompletionDate = null;
            });
            activeItems.forEach(item => {
                if (item.element) item.element.remove();
                if (item.listItemElement) item.listItemElement.remove();
            });
            activeItems = [];
            activeItemsListUL.innerHTML = '';
            currentGameDate = new Date(); // Reset game day to actual today
            currentGameDate.setHours(0,0,0,0);
            generateDailyHabitInstances(currentGameDate);
            console.log("DEBUG: Streaks reset. Habits regenerated for game day:", currentGameDate.toDateString());
        });
    }

    if (debugDamageBaseButton) { // Add listener for the new button
        debugDamageBaseButton.addEventListener('click', () => {
            if (gameIsOver) {
                console.log("DEBUG: Game is over, cannot damage base.");
                return;
            }
            console.log("DEBUG: Manually damaging base by 10 HP.");
            damageBase(10); // Call your existing damageBase function
        });
    }

    // --- START THE GAME ---
    initGame();
});
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
    
    // Form elements
    const showTaskFormButton = document.getElementById('showTaskFormButton');
    const showHabitFormButton = document.getElementById('showHabitFormButton');
    const showRoutineFormButton = document.getElementById('showRoutineFormButton');
    const taskForm = document.getElementById('taskForm');
    const habitForm = document.getElementById('habitForm');
    const routineForm = document.getElementById('routineForm');
    
    // Task form inputs
    const taskNameInput = document.getElementById('taskName');
    const taskCategoryInput = document.getElementById('taskCategory');
    const taskHighPriorityInput = document.getElementById('taskHighPriority');
    const dueDateInput = document.getElementById('dueDate');
    const dueTimeInput = document.getElementById('dueTime');
    const addTaskButton = document.getElementById('addTaskButton');
    
    // Habit form inputs
    const habitNameInput = document.getElementById('habitName');
    const habitCategoryInput = document.getElementById('habitCategory');
    const habitFrequencyInput = document.getElementById('habitFrequency');
    const habitTimeOfDayInput = document.getElementById('habitTimeOfDay');
    const addHabitButton = document.getElementById('addHabitButton');
    
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

    // --- Game State ---
    let baseHealth, playerXP, playerLevel, playerPoints, routineSlots;
    let activeItems = [];
    let completedItems = [];
    let definedHabits = [];
    let definedRoutines = [];
    let itemIdCounter, gameLoopInterval, gameIsOver, daysSurvived, dayTimerInterval, currentGameDate;
    let attackMode = false;


    // --- Game Settings ---
    const GAME_TICK_MS = 50;
    const DAY_DURATION_MS = 60000;
    const OVERDUE_DAMAGE = 1;
    const DAMAGE_INTERVAL_MS = 5 * 60 * 1000;
    const XP_PER_TASK_DEFEAT = 10;
    const XP_PER_HABIT_COMPLETE = 5;
    const POINTS_PER_TASK = 10;
    const POINTS_PER_HABIT = 5;
    const HABIT_STREAK_BONUS_THRESHOLD = 3;
    const LEVEL_XP_THRESHOLDS = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000];
    const ROUTINE_SLOTS_PER_LEVEL = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4 };
    const MAX_PLAYER_LEVEL = LEVEL_XP_THRESHOLDS.length;

    let GAME_SCREEN_WIDTH, BASE_WIDTH, ENEMY_WIDTH, HABIT_ENEMY_WIDTH;

    function initGame() {
        // Calculate dimensions
        GAME_SCREEN_WIDTH = gameCanvas.offsetWidth;
        BASE_WIDTH = baseElement.offsetWidth;
        ENEMY_WIDTH = 128;
        HABIT_ENEMY_WIDTH = 70;

        // Initialize player stats
        playerXP = 0;
        playerLevel = 1;
        playerPoints = 0;
        routineSlots = ROUTINE_SLOTS_PER_LEVEL[playerLevel] || 1;
        
        updatePlayerDisplays();

        // Initialize base
        baseHealth = 100;
        baseHealthDisplay.textContent = baseHealth;
        baseElement.style.backgroundImage = "url('base_100.png')";
        baseElement.classList.remove('base-hit-flash');
        
        // Reset UI state
        if (gameOverMessage) gameOverMessage.classList.add('hidden');
        if (levelUpMessage) levelUpMessage.classList.add('hidden');
        
        // Set initial form state
        showForm('task');
        
        // Enable all form controls
        enableFormControls(true);
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
        itemIdCounter = 0;
        gameIsOver = false;
        daysSurvived = 0;
        attackMode = false;
        if (attackButton) attackButton.classList.remove('active');
        
        // Initialize game date
        currentGameDate = new Date();
        currentGameDate.setHours(0, 0, 0, 0);

        clearFormInputs();
        generateDailyHabitInstances(currentGameDate);
        updateTaskCountDisplay();
        updateRoutineDisplay();

        // Start game loop
        if (gameLoopInterval) clearInterval(gameLoopInterval);
        gameLoopInterval = setInterval(updateGame, GAME_TICK_MS);

        // Start day timer
        if (dayTimerInterval) clearInterval(dayTimerInterval);
        dayTimerInterval = setInterval(() => {
            if (!gameIsOver) daysSurvived++;
        }, DAY_DURATION_MS);

    }

    function updatePlayerDisplays() {
        if (playerXpDisplay) playerXpDisplay.textContent = playerXP;
        if (playerLevelDisplay) playerLevelDisplay.textContent = playerLevel;
        if (playerPointsDisplay) playerPointsDisplay.textContent = playerPoints;
        if (totalRoutineSlotsDisplay) totalRoutineSlotsDisplay.textContent = routineSlots;
    }

    function updateTaskCountDisplay() {
        // Only count top-level tasks (not sub-tasks) in the display
        const taskCount = activeItems.filter(item => !item.parentId).length;
        if (taskCountDisplay) {
            taskCountDisplay.textContent = `${taskCount} task${taskCount !== 1 ? 's' : ''}`;
        }
    }

    function showForm(formType) {
        // Hide all forms
        [taskForm, habitForm, routineForm].forEach(form => {
            if (form) form.classList.remove('active-form');
        });
        
        // Remove active state from all buttons
        [showTaskFormButton, showHabitFormButton, showRoutineFormButton].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });

        // Show selected form and activate button
        switch (formType) {
            case 'task':
                if (taskForm) taskForm.classList.add('active-form');
                if (showTaskFormButton) showTaskFormButton.classList.add('active');
                break;
            case 'habit':
                if (habitForm) habitForm.classList.add('active-form');
                if (showHabitFormButton) showHabitFormButton.classList.add('active');
                break;
            case 'routine':
                if (routineForm) routineForm.classList.add('active-form');
                if (showRoutineFormButton) showRoutineFormButton.classList.add('active');
                renderDefinedRoutines();
                break;
        }
    }

    function clearFormInputs() {
        if (taskNameInput) taskNameInput.value = '';
        if (taskCategoryInput) taskCategoryInput.value = 'other';
        if (taskHighPriorityInput) taskHighPriorityInput.checked = false;
        if (dueDateInput) dueDateInput.value = '';
        if (dueTimeInput) dueTimeInput.value = '17:00';
        
        if (habitNameInput) habitNameInput.value = '';
        if (habitCategoryInput) habitCategoryInput.value = 'health';
        if (habitFrequencyInput) habitFrequencyInput.value = 'daily';
        if (habitTimeOfDayInput) habitTimeOfDayInput.value = 'anytime';
        
        // Reset main habit type to positive
        const mainPositiveRadio = document.getElementById('mainPositiveHabit');
        if (mainPositiveRadio) mainPositiveRadio.checked = true;
        
        if (routineNameInput) routineNameInput.value = '';
    }

    function enableFormControls(enabled) {
        const controls = [
            taskNameInput, taskCategoryInput, taskHighPriorityInput, dueDateInput, dueTimeInput, addTaskButton,
            habitNameInput, habitCategoryInput, habitFrequencyInput, habitTimeOfDayInput, addHabitButton,
            routineNameInput, createRoutineButton
        ];
        
        controls.forEach(control => {
            if (control) control.disabled = !enabled;
        });
    }

    function checkPlayerLevelUp() {
        if (playerLevel >= MAX_PLAYER_LEVEL || !LEVEL_XP_THRESHOLDS[playerLevel]) return false;
        
        if (playerXP >= LEVEL_XP_THRESHOLDS[playerLevel]) {
            playerLevel++;
            updatePlayerDisplays();
            showLevelUpMessage();
            
            // Check for routine slot unlock
            if (ROUTINE_SLOTS_PER_LEVEL[playerLevel] && ROUTINE_SLOTS_PER_LEVEL[playerLevel] > routineSlots) {
                routineSlots = ROUTINE_SLOTS_PER_LEVEL[playerLevel];
                updatePlayerDisplays();
                updateRoutineDisplay();
            }
            
            // Check for additional level ups
            checkPlayerLevelUp();
            return true;
        }
        return false;
    }

    function showLevelUpMessage() {
        if (!levelUpMessage) return;
        levelUpMessage.textContent = `LEVEL ${playerLevel}!`;
        levelUpMessage.classList.remove('hidden');
        setTimeout(() => {
            levelUpMessage.classList.add('hidden');
        }, 2500);
    }

    // Task creation and management
    function createTaskItemData(name, category, isHighPriority, dueDateStr, dueTimeStr, parentId = null) {
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
        
        // Validate due date
        if (isNaN(dueDateTime.getTime()) || dueDateTime < creationTime) {
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
            totalSubTasks: 0
        };
        
        // Calculate initial position based on new timeline system
        taskData.x = calculateTimelinePosition(taskData, creationTime);
        
        return taskData;
    }

    function addItemToGame(itemData) {
        if (gameIsOver) return;
        
        // Create enemy element
        const itemElement = document.createElement('div');
        itemElement.classList.add('enemy');
        itemElement.classList.add(`category-${itemData.category}`);
        
        // Add new zombie sprite classes
        itemElement.classList.add('zombie-sprite');
        itemElement.classList.add(`zombie-${itemData.category}`);
        
        const itemSpriteWidth = (itemData.type === 'habit') ? HABIT_ENEMY_WIDTH : ENEMY_WIDTH;
        const itemSpriteHeight = (itemData.type === 'habit') ? 70 : 128;
        
        itemElement.style.width = `${itemSpriteWidth}px`;
        itemElement.style.height = `${itemSpriteHeight}px`;
        
        if (itemData.type === 'task' && itemData.isHighPriority) {
            itemElement.classList.add('high-priority');
        } else if (itemData.type === 'habit') {
            itemElement.classList.add('habit-enemy');
            itemElement.classList.add('zombie-small'); // Add small size class for habits
            if (itemData.isNegative) {
                itemElement.classList.add('negative-habit');
            }
            if (itemData.streak >= HABIT_STREAK_BONUS_THRESHOLD) {
                itemElement.classList.add('high-streak');
            }
        }
        
        // Position enemy
        itemElement.style.left = itemData.x + 'px';
        const randomTop = Math.random() * (gameCanvas.offsetHeight - itemSpriteHeight);
        itemElement.style.top = Math.max(0, Math.min(randomTop, gameCanvas.offsetHeight - itemSpriteHeight)) + 'px';
        
        // Set up click handler
        itemElement.dataset.itemId = itemData.id;
        itemElement.addEventListener('click', () => handleEnemyClick(itemData.id));
        
        // Never write emoji textContent - always use sprite classes
        itemElement.textContent = '';
        
        // Add to game canvas
        gameCanvas.appendChild(itemElement);
        itemData.element = itemElement;
        
        // Debug: Log element classes and background image
        console.log('Created enemy element:', {
            id: itemData.id,
            name: itemData.name,
            category: itemData.category,
            type: itemData.type,
            classes: itemElement.className,
            width: itemElement.style.width,
            height: itemElement.style.height,
            backgroundImage: getComputedStyle(itemElement).backgroundImage
        });
        
        // Create list item only if it's a top-level task
        if (!itemData.parentId) {
            createListItem(itemData);
        }
        
        // Check if already overdue
        if (itemData.dueDateTime < new Date()) {
            markAsOverdue(itemData, new Date());
            itemData.x = BASE_WIDTH;
            if (itemData.element) itemData.element.style.left = itemData.x + 'px';
        }
        
        activeItems.push(itemData);
        updateTaskCountDisplay();
        sortAndRenderActiveList();
    }

    function createListItem(itemData) {
        const listItem = document.createElement('li');
        listItem.dataset.itemId = itemData.id;
        
        // Add category class for sprite styling
        listItem.classList.add(`category-${itemData.category}`);
        
        if (itemData.type === 'task' && itemData.isHighPriority) {
            listItem.classList.add('high-priority-list-item');
        }
        
        // Create sprite column
        const itemSpriteDiv = document.createElement('div');
        itemSpriteDiv.classList.add('item-sprite');
        
        // Create item info div
        const itemInfoDiv = document.createElement('div');
        itemInfoDiv.classList.add('item-info');
        
        const itemNameSpan = document.createElement('span');
        itemNameSpan.classList.add('item-name');
        itemNameSpan.textContent = itemData.name;
        
        const itemDueSpan = document.createElement('span');
        itemDueSpan.classList.add('item-due');
        itemDueSpan.textContent = `Due: ${itemData.dueDateTime.toLocaleString([], { 
            dateStyle: 'short', 
            timeStyle: 'short' 
        })}`;
        
        itemInfoDiv.appendChild(itemNameSpan);
        itemInfoDiv.appendChild(itemDueSpan);

        // Add edit icon and checkbox to the task item (aligned to the right)
        const itemActionsDiv = document.createElement('div');
        itemActionsDiv.classList.add('task-actions');
        itemActionsDiv.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px; align-items: center; margin-top: 8px;';
        
        // Make the parent item-info a flex container for better vertical alignment
        itemInfoDiv.style.cssText = 'display: flex; flex-direction: column; justify-content: center; flex-grow: 1;';

        const editIconButton = document.createElement('button');
        editIconButton.classList.add('edit-icon-btn');
        editIconButton.title = 'Edit Task';
        editIconButton.textContent = '✏️';
        editIconButton.addEventListener('click', () => showEditTaskModal(itemData));
        itemActionsDiv.appendChild(editIconButton);

        // Add sub-task button for tasks only
        if (itemData.type === 'task') {
            const addSubTaskButton = document.createElement('button');
            addSubTaskButton.classList.add('add-subtask-button');
            addSubTaskButton.textContent = '+ Sub-task';
            addSubTaskButton.title = 'Add Sub-task';
            addSubTaskButton.addEventListener('click', () => {
                if (!gameIsOver) {
                    createSubTaskPrompt(itemData.id);
                }
            });
            itemActionsDiv.appendChild(addSubTaskButton);
        }

        const completeCheckboxLabel = document.createElement('label');
        completeCheckboxLabel.classList.add('completion-checkbox');

        const completeCheckbox = document.createElement('input');
        completeCheckbox.type = 'checkbox';
        completeCheckbox.classList.add('completion-checkbox-input');
        completeCheckbox.addEventListener('change', () => {
            if (completeCheckbox.checked) {
                completeItem(itemData.id);
            }
        });
        completeCheckboxLabel.appendChild(completeCheckbox);
        completeCheckboxLabel.appendChild(document.createTextNode(' Mark as Complete'));

        itemActionsDiv.appendChild(completeCheckboxLabel);
        // Create sub-tasks container
        const subTasksContainer = document.createElement('ul');
        subTasksContainer.classList.add('sub-tasks-container');
        
        // Add existing sub-tasks
        itemData.subTasks.forEach(subTaskId => {
            const subTaskData = activeItems.find(subItem => subItem.id === subTaskId);
            if (subTaskData) {
                const subTaskItem = document.createElement('li');
                subTaskItem.classList.add('sub-task-item');
                
                // Create checkbox for sub-task completion
                const subTaskCheckboxLabel = document.createElement('label');
                subTaskCheckboxLabel.classList.add('sub-task-completion');
                subTaskCheckboxLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer;';
                
                const subTaskCheckbox = document.createElement('input');
                subTaskCheckbox.type = 'checkbox';
                subTaskCheckbox.classList.add('sub-task-checkbox');
                subTaskCheckbox.addEventListener('change', () => {
                    if (subTaskCheckbox.checked) {
                        completeItem(subTaskData.id);
                    }
                });
                
                const subTaskInfo = document.createElement('span');
                subTaskInfo.classList.add('sub-task-info');
                subTaskInfo.textContent = `${subTaskData.name} - Due: ${subTaskData.dueDateTime.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`;
                
                subTaskCheckboxLabel.appendChild(subTaskCheckbox);
                subTaskCheckboxLabel.appendChild(subTaskInfo);
                subTaskItem.appendChild(subTaskCheckboxLabel);
                
                subTasksContainer.appendChild(subTaskItem);
            }
        });

        itemInfoDiv.appendChild(itemActionsDiv);
        itemInfoDiv.appendChild(subTasksContainer);
        
        // Add category badge
        const itemCategorySpan = document.createElement('span');
        itemCategorySpan.classList.add('item-category');
        itemCategorySpan.textContent = itemData.category.charAt(0).toUpperCase() + itemData.category.slice(1);
        
        const currentCategoryStyle = categoryStyles[itemData.category] || categoryStyles["other"];
        itemCategorySpan.style.backgroundColor = currentCategoryStyle.bgColor;
        if (currentCategoryStyle.textColorClass) {
            itemCategorySpan.classList.add(currentCategoryStyle.textColorClass);
        }
        itemInfoDiv.appendChild(itemCategorySpan);
        
        // Add streak info for habits
        if (itemData.type === 'habit') {
            const streakSpan = document.createElement('span');
            streakSpan.classList.add('item-streak');
            const streakType = itemData.isNegative ? 'Avoided' : 'Streak';
            streakSpan.textContent = `${streakType}: ${itemData.streak}`;
            itemInfoDiv.appendChild(streakSpan);
        }
        
        // Remove the defeat/complete button - controls are now in item-info section
        
        listItem.appendChild(itemSpriteDiv);
        listItem.appendChild(itemInfoDiv);
        
        itemData.listItemElement = listItem;
    }

function handleEnemyClick(itemId) {
        if (gameIsOver) return;
        const itemData = activeItems.find(i => i.id === itemId);
        if (!itemData) return;
        showTaskDetailsPopup(itemData);
    }

function showTaskDetailsPopup(item) {
        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content task-details-modal">
                    <button class="close-modal-x" onclick="closeModal()">&times;</button>
                    <h3>${item.name}</h3>
                    <div class="task-details">
                        <p><strong>Category:</strong> ${item.category}</p>
                        <p><strong>Due:</strong> ${item.dueDateTime.toLocaleString()}</p>
                        <p><strong>Priority:</strong> ${item.isHighPriority ? 'High' : 'Normal'}</p>
                        ${item.type === 'habit' ? `<p><strong>Streak:</strong> ${item.streak}</p>` : ''}
                        <div class="task-actions" style="display: flex; justify-content: flex-end; gap: 10px; align-items: center;">
                            <button id="editTaskBtn" class="edit-icon-btn" title="Edit Task">✏️</button>
                            <label class="completion-checkbox">
                                <input type="checkbox" id="completeTaskCheck" class="completion-checkbox-input" />
                                Mark as Complete
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add event listeners
        const completeCheckbox = document.getElementById('completeTaskCheck');
        const editButton = document.getElementById('editTaskBtn');

        if (completeCheckbox) {
            completeCheckbox.addEventListener('change', () => {
                if (completeCheckbox.checked) {
                    completeItem(item.id);
                    closeModal();
                }
            });
        }

        if (editButton) {
            editButton.addEventListener('click', () => {
                closeModal();
                showEditTaskModal(item);
            });
        }

        // Close modal when clicking overlay
        document.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) closeModal();
        });
    }

    function showEditTaskModal(item) {
        const today = new Date().toISOString().split('T')[0];
        const dueDate = item.dueDateTime.toISOString().split('T')[0];
        const dueTime = item.dueDateTime.toISOString().split('T')[1].substring(0, 5);

        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>Edit Task</h3>
                    <div class="form-row">
                        <label for="editTaskName">Task Name:</label>
                        <input type="text" id="editTaskName" value="${item.name}" required>
                    </div>
                    <div class="form-row">
                        <label for="editTaskCategory">Category:</label>
                        <select id="editTaskCategory">
                            <option value="other" ${item.category === 'other' ? 'selected' : ''}>Other (Generic)</option>
                            <option value="career" ${item.category === 'career' ? 'selected' : ''}>Career</option>
                            <option value="creativity" ${item.category === 'creativity' ? 'selected' : ''}>Creativity</option>
                            <option value="financial" ${item.category === 'financial' ? 'selected' : ''}>Financial</option>
                            <option value="health" ${item.category === 'health' ? 'selected' : ''}>Health</option>
                            <option value="lifestyle" ${item.category === 'lifestyle' ? 'selected' : ''}>Lifestyle</option>
                            <option value="relationships" ${item.category === 'relationships' ? 'selected' : ''}>Relationships</option>
                            <option value="spirituality" ${item.category === 'spirituality' ? 'selected' : ''}>Spirituality</option>
                        </select>
                    </div>
                    <div class="form-row priority-row">
                        <input type="checkbox" id="editTaskHighPriority" ${item.isHighPriority ? 'checked' : ''}>
                        <label for="editTaskHighPriority">High Priority</label>
                    </div>
                    <div class="form-row-group">
                        <div class="form-row">
                            <label for="editDueDate">Due Date:</label>
                            <input type="date" id="editDueDate" value="${dueDate}" required>
                        </div>
                        <div class="form-row">
                            <label for="editDueTime">Due Time:</label>
                            <input type="time" id="editDueTime" value="${dueTime}">
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button id="saveTaskChanges" class="primary-button">Save Changes</button>
                        <button class="secondary-button" onclick="closeModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add save functionality
        const saveButton = document.getElementById('saveTaskChanges');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                const name = document.getElementById('editTaskName').value.trim();
                const category = document.getElementById('editTaskCategory').value;
                const isHighPriority = document.getElementById('editTaskHighPriority').checked;
                const dueDate = document.getElementById('editDueDate').value;
                const dueTime = document.getElementById('editDueTime').value;

                if (!name || !dueDate) {
                    alert('Task Name and Due Date are required.');
                    return;
                }

                // Update the item data
                item.name = name;
                item.category = category;
                item.isHighPriority = isHighPriority;
                item.dueDateTime = new Date(`${dueDate}T${dueTime}`);

                // Update visual elements
                if (item.element) {
                    item.element.classList.toggle('high-priority', isHighPriority);
                    item.element.className = item.element.className.replace(/category-\w+/g, '');
                    item.element.classList.add(`category-${category}`);
                    item.element.classList.add(`zombie-${category}`);
                }

                // Recreate list item with updated data
                if (item.listItemElement) {
                    item.listItemElement.remove();
                    // Only create list item if it's a top-level task (not a sub-task)
                    if (!item.parentId) {
                        createListItem(item);
                    }
                }

                sortAndRenderActiveList();
                closeModal();
            });
        }

        // Close modal when clicking overlay
        document.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) closeModal();
        });
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
                habitDef.streak++;
                habitDef.lastCompletionDate = new Date(item.originalDueDate);
                xpGained = XP_PER_HABIT_COMPLETE;
                pointsGained = POINTS_PER_HABIT + (habitDef.streak >= HABIT_STREAK_BONUS_THRESHOLD ? 5 : 0);
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
        }
    }
    function createSubTaskPrompt(parentId) {
        const parentTask = activeItems.find(item => item.id === parentId && item.type === 'task');
        if (!parentTask) {
            alert('Parent task not found.');
            return;
        }
        
        const subTaskName = prompt(`Create sub-task for "${parentTask.name}":\n\nEnter sub-task name:`);
        if (!subTaskName || !subTaskName.trim()) {
            return; // User cancelled or entered empty name
        }
        
        // Create sub-task with same category and priority as parent, inheriting due date
        const subTaskData = createTaskItemData(
            subTaskName.trim(),
            parentTask.category,
            parentTask.isHighPriority,
            null, // No specific due date - will inherit from parent
            null, // No specific due time - will inherit from parent
            parentId
        );
        
        // Add to parent's subTasks array
        parentTask.subTasks.push(subTaskData.id);
        parentTask.totalSubTasks = parentTask.subTasks.length;
        
        // Add to game canvas
        const itemElement = document.createElement('div');
        itemElement.classList.add('enemy');
        itemElement.classList.add(`category-${subTaskData.category}`);
        itemElement.classList.add('zombie-sprite');
        itemElement.classList.add(`zombie-${subTaskData.category}`);
        
        itemElement.style.width = `${ENEMY_WIDTH}px`;
        itemElement.style.height = `128px`;
        
        if (subTaskData.isHighPriority) {
            itemElement.classList.add('high-priority');
        }
        
        // Position enemy
        itemElement.style.left = subTaskData.x + 'px';
        const randomTop = Math.random() * (gameCanvas.offsetHeight - 128);
        itemElement.style.top = Math.max(0, Math.min(randomTop, gameCanvas.offsetHeight - 128)) + 'px';
        
        // Set up click handler
        itemElement.dataset.itemId = subTaskData.id;
        itemElement.addEventListener('click', () => handleEnemyClick(subTaskData.id));
        
        // Add to game canvas
        gameCanvas.appendChild(itemElement);
        subTaskData.element = itemElement;
        
        // Check if already overdue
        if (subTaskData.dueDateTime < new Date()) {
            markAsOverdue(subTaskData, new Date());
            subTaskData.x = BASE_WIDTH;
            if (subTaskData.element) subTaskData.element.style.left = subTaskData.x + 'px';
        }
        
        // Add sub-task to activeItems Array
        activeItems.push(subTaskData);
        updateTaskCountDisplay();

        // Refresh the parent task's list item to show the new sub-task
        if (parentTask.listItemElement) {
            parentTask.listItemElement.remove();
            createListItem(parentTask);
        }

        // Update active items list
        sortAndRenderActiveList();

        console.log(`Created sub-task "${subTaskName}" for parent task "${parentTask.name}"`);
    }

    function uncompleteItem(itemId) {
        const completedIndex = completedItems.findIndex(i => i.id === itemId);
        if (completedIndex === -1) return;
        
        const item = completedItems[completedIndex];
        
        // Debug logging
        console.log('Uncompleting item:', {
            id: item.id,
            name: item.name,
            parentId: item.parentId,
            isSubTask: !!item.parentId
        });
        
        // Remove from completed items
        completedItems.splice(completedIndex, 1);
        
        // Remove completion timestamp
        delete item.completedAt;
        
        // Reset overdue status (they can start fresh)
        item.isOverdue = false;
        item.lastDamageTickTime = null;
        
        // Recalculate position based on current time
        const currentTime = new Date();
        item.x = calculateTimelinePosition(item, currentTime);
        
        // Check if it should be marked as overdue
        if (item.dueDateTime <= currentTime) {
            markAsOverdue(item, currentTime);
            item.x = BASE_WIDTH;
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
        const randomTop = Math.random() * (gameCanvas.offsetHeight - itemSpriteHeight);
        itemElement.style.top = Math.max(0, Math.min(randomTop, gameCanvas.offsetHeight - itemSpriteHeight)) + 'px';
        
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
            console.log('Parent task found:', parentTask ? parentTask.name : 'NOT FOUND');
            
            if (parentTask) {
                // Add back to parent's subTasks array if not already there
                if (!parentTask.subTasks.includes(item.id)) {
                    console.log('Adding sub-task back to parent:', {
                        subTaskId: item.id,
                        subTaskName: item.name,
                        parentId: parentTask.id,
                        parentName: parentTask.name,
                        beforeSubTasks: [...parentTask.subTasks],
                        beforeCompletedSubTasks: parentTask.completedSubTasks
                    });
                    
                    parentTask.subTasks.push(item.id);
                    parentTask.totalSubTasks = parentTask.subTasks.length;
                    
                    // Decrement the completed sub-tasks count since we're restoring this one
                    if (parentTask.completedSubTasks > 0) {
                        parentTask.completedSubTasks--;
                    }
                    
                    console.log('After restoration:', {
                        afterSubTasks: [...parentTask.subTasks],
                        afterCompletedSubTasks: parentTask.completedSubTasks,
                        totalSubTasks: parentTask.totalSubTasks
                    });
                    
                    // Refresh parent task's list item to show the restored sub-task
                    if (parentTask.listItemElement) {
                        parentTask.listItemElement.remove();
                        createListItem(parentTask);
                        console.log('Parent task list item recreated');
                    }
                }
            } else {
                console.error('Parent task not found for sub-task:', {
                    subTaskId: item.id,
                    subTaskName: item.name,
                    parentId: item.parentId,
                    activeItemsCount: activeItems.length
                });
            }
        } else {
            // Only create list item if it's a top-level task (not a sub-task)
            createListItem(item);
            console.log('Created list item for top-level task:', item.name);
        }
        
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
                // Reverse the streak increment
                habitDef.streak = Math.max(0, habitDef.streak - 1);
                habitDef.lastCompletionDate = null;
                
                const xpLost = XP_PER_HABIT_COMPLETE;
                const pointsLost = POINTS_PER_HABIT + (habitDef.streak >= HABIT_STREAK_BONUS_THRESHOLD ? 5 : 0);
                
                playerXP = Math.max(0, playerXP - xpLost);
                playerPoints = Math.max(0, playerPoints - pointsLost);
            }
        }
        
        updatePlayerDisplays();
    }

    function sortAndRenderActiveList() {
        const debugInfo = {
            totalActiveItems: activeItems.length,
            itemsWithListElement: activeItems.filter(item => item.listItemElement).length,
            topLevelItems: activeItems.filter(item => !item.parentId).length,
            subTasks: activeItems.filter(item => item.parentId).length
        };
        
        showDebugInfo('sortAndRenderActiveList', debugInfo);
        
        console.log('=== sortAndRenderActiveList START ===');
        console.log('Total activeItems before sort:', activeItems.length);
        console.log('ActiveItems details:', activeItems.map(item => ({
            id: item.id,
            name: item.name,
            parentId: item.parentId,
            hasListItemElement: !!item.listItemElement
        })));
        
        // Sort by due date (most urgent first)
        activeItems.sort((a, b) => a.dueDateTime - b.dueDateTime);
        
        if (activeItemsListUL) {
            const beforeClear = activeItemsListUL.children.length;
            console.log('Clearing activeItemsListUL, had', beforeClear, 'children');
            activeItemsListUL.innerHTML = '';
            
            let addedCount = 0;
            activeItems.forEach(item => {
                // Only show top-level items (not sub-tasks) in the main list
                if (item.listItemElement && !item.parentId) {
                    console.log('Adding top-level item to list:', {
                        id: item.id,
                        name: item.name,
                        hasElement: !!item.listItemElement
                    });
                    activeItemsListUL.appendChild(item.listItemElement);
                    addedCount++;
                }
            });
            
            console.log('Added', addedCount, 'items to activeItemsListUL');
            console.log('Final activeItemsListUL children count:', activeItemsListUL.children.length);
        }
        
        console.log('=== sortAndRenderActiveList END ===');
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
        
        console.log(`Item "${item.name}" (${item.type}) is now overdue.`);
        
        // Reset habit streak if it's a habit
        if (item.type === 'habit') {
            const habitDef = definedHabits.find(def => def.id === item.definitionId);
            if (habitDef && habitDef.streak > 0) {
                habitDef.streak = 0;
                
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

    // Helper function to get today's 5pm
    function getTodayAt5PM() {
        const today = new Date();
        const fivePM = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0, 0);
        return fivePM;
    }
    
    // Calculate position based on timeline system with 2-hour and 4-hour marks
function calculateTimelinePosition(item, currentTime) {
    const currentItemWidth = (item.type === 'habit') ? HABIT_ENEMY_WIDTH : ENEMY_WIDTH;
    const currentTimeMs = currentTime.getTime();
    const midnight = new Date(currentTime);
    midnight.setHours(24, 0, 0, 0);
    const taskDueMs = item.dueDateTime.getTime();
    
    // Available screen width for positioning (from base to right edge)
    const totalWidth = GAME_SCREEN_WIDTH - BASE_WIDTH - currentItemWidth;

    if (taskDueMs <= currentTimeMs) {
        // Task is overdue - position at base
        return BASE_WIDTH;
    } else if (taskDueMs > midnight.getTime()) {
        // Task is due next day - initial position off-screen right
        return GAME_SCREEN_WIDTH;
    } else {
        // Calculate position based on time remaining until due
        const timeToDue = taskDueMs - currentTimeMs;
        const twoHoursMs = 2 * 60 * 60 * 1000;
        const fourHoursMs = 4 * 60 * 60 * 1000;
        const timeUntilMidnight = midnight.getTime() - currentTimeMs;

        if (timeToDue <= twoHoursMs) {
            // Within 2 hours: Position linearly from base (0%) to 50% of screen
            const progress = timeToDue / twoHoursMs; // 1 = due in 2 hours, 0 = due now
            return BASE_WIDTH + (totalWidth * 0.5 * progress);
        } else if (timeToDue <= fourHoursMs) {
            // Between 2-4 hours: Position linearly from 50% to 75% of screen
            const progress = (timeToDue - twoHoursMs) / twoHoursMs; // 0 = due in 2 hours, 1 = due in 4 hours
            return BASE_WIDTH + (totalWidth * 0.5) + (totalWidth * 0.25 * progress);
        } else {
            // More than 4 hours: Position linearly from 75% to 100% of screen
            const remainingTime = timeUntilMidnight - fourHoursMs;
            const progress = remainingTime > 0 ? (timeToDue - fourHoursMs) / remainingTime : 0;
            return BASE_WIDTH + (totalWidth * 0.75) + (totalWidth * 0.25 * progress);
        }
    }
}

function updateActiveItems() {
    if (gameIsOver) return;

    const currentTime = new Date();
    const currentTimeMs = currentTime.getTime();

    for (let i = activeItems.length - 1; i >= 0; i--) {
        const item = activeItems[i];
        
        if (!item.isOverdue) {
            if (item.dueDateTime <= currentTime) {
                // Item just became overdue
                item.x = BASE_WIDTH;
                markAsOverdue(item, currentTime);
            } else {
                // Calculate position based on timeline
                item.x = calculateTimelinePosition(item, currentTime);

                // Check for next day's enemy visibility
                if (item.dueDateTime.getDate() !== currentTime.getDate() && currentTime.getHours() >= 20) {
                    item.element.style.visibility = "visible";
                }
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

function updateMidnightLine(currentTime) {
    const midnightLine = document.getElementById('midnightLine');
    if (!midnightLine) return;
    
    if (currentTime.getHours() >= 20) {
        midnightLine.style.display = 'block';
        
        // Calculate midnight line position
        const midnight = new Date(currentTime);
        midnight.setHours(24, 0, 0, 0);
        const timeLeftToMidnight = midnight.getTime() - currentTime.getTime();
        const distanceToBase = GAME_SCREEN_WIDTH - BASE_WIDTH;
        const progress = timeLeftToMidnight / (4 * 60 * 60 * 1000); // 4 hours
        midnightLine.style.left = BASE_WIDTH + distanceToBase * (1 - progress) + 'px';
    } else {
        midnightLine.style.display = 'none';
    }
}

    function updateBaseVisuals() {
        let newBaseImage = '';
        
        if (baseHealth > 75) {
            newBaseImage = 'base_100.png';
        } else if (baseHealth > 50) {
            newBaseImage = 'base_075.png';
        } else if (baseHealth > 25) {
            newBaseImage = 'base_050.png';
        } else if (baseHealth > 0) {
            newBaseImage = 'base_025.png';
        } else {
            newBaseImage = 'base_000.png';
        }
        
        const currentBgImage = baseElement.style.backgroundImage;
        const targetBgImage = `url("${newBaseImage}")`;
        
        if (newBaseImage && currentBgImage !== targetBgImage) {
            baseElement.style.backgroundImage = targetBgImage;
        }
    }

    function damageBase(amount) {
        if (gameIsOver) return;
        
        baseHealth -= amount;
        if (baseHealth < 0) baseHealth = 0;
        
        baseHealthDisplay.textContent = baseHealth;
        
        // Visual feedback
        baseElement.classList.add('base-hit-flash');
        setTimeout(() => {
            baseElement.classList.remove('base-hit-flash');
        }, 300);
        
        updateBaseVisuals();
        
        if (baseHealth <= 0) {
            gameOver();
        }
    }

    function gameOver() {
        gameIsOver = true;
        
        clearInterval(gameLoopInterval);
        clearInterval(dayTimerInterval);
        
        if (gameOverMessage) {
            gameOverMessage.textContent = `GAME OVER! Your Base Survived ${daysSurvived} Days.`;
            gameOverMessage.classList.remove('hidden');
        }
        
        if (restartButton) restartButton.classList.remove('hidden');
        if (baseElement) baseElement.style.backgroundImage = "url('base_000.png')";
        
        enableFormControls(false);
    }

    function updateGame() {
        if (!gameIsOver) {
            updateActiveItems();
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
            streak: 0,
            lastCompletionDate: null
        };
        
        definedHabits.push(newHabitDef);
        generateDailyHabitInstances(currentGameDate);
    }

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

    function createHabitInstanceData(habitDef, forDate) {
        const instanceCreationTime = new Date();
        let targetInstanceDate = new Date(forDate);
        let dueDateTime = getHabitInstanceDueTime(habitDef.timeOfDay, targetInstanceDate);
        
        // If due time has passed today, schedule for tomorrow
        if (dueDateTime < instanceCreationTime) {
            targetInstanceDate.setDate(targetInstanceDate.getDate() + 1);
            dueDateTime = getHabitInstanceDueTime(habitDef.timeOfDay, targetInstanceDate);
        }
        
        const habitInstanceData = {
            id: itemIdCounter++,
            type: 'habit',
            definitionId: habitDef.id,
            name: habitDef.name,
            category: habitDef.category,
            isHighPriority: false,
            dueDateTime: dueDateTime,
            creationTime: instanceCreationTime,
            timeToDueAtCreationMs: Math.max(0, dueDateTime.getTime() - instanceCreationTime.getTime()),
            x: GAME_SCREEN_WIDTH - HABIT_ENEMY_WIDTH, // Will be recalculated below
            isOverdue: false,
            lastDamageTickTime: null,
            streak: habitDef.streak,
            isNegative: habitDef.isNegative,
            element: null,
            listItemElement: null,
            originalDueDate: new Date(dueDateTime)
        };
        
        // Calculate initial position based on new timeline system
        habitInstanceData.x = calculateTimelinePosition(habitInstanceData, instanceCreationTime);
        
        return habitInstanceData;
    }

    function generateDailyHabitInstances(forWhichGameDay) {
        const forWhichGameDayString = forWhichGameDay.toDateString();
        
        definedHabits.forEach(habitDef => {
            if (habitDef.frequency === 'daily') {
                const lastCompletionDayString = habitDef.lastCompletionDate ? 
                    new Date(habitDef.lastCompletionDate).toDateString() : null;
                const alreadyCompletedForThisGameDay = lastCompletionDayString === forWhichGameDayString;
                
                const existingActiveInstance = activeItems.find(item => 
                    item.type === 'habit' && 
                    item.definitionId === habitDef.id && 
                    item.originalDueDate && 
                    item.originalDueDate.toDateString() === forWhichGameDayString
                );
                
                if (!alreadyCompletedForThisGameDay && !existingActiveInstance) {
                    const habitInstanceData = createHabitInstanceData(habitDef, forWhichGameDay);
                    if (habitInstanceData && habitInstanceData.originalDueDate.toDateString() === forWhichGameDayString) {
                        addItemToGame(habitInstanceData);
                    }
                }
            }
        });
        
        sortAndRenderActiveList();
    }

    // Routine management functions
    function createRoutineDefinition() {
        const name = routineNameInput.value.trim();
        if (!name) {
            alert("Please enter a routine name.");
            return;
        }
        
        if (definedRoutines.some(r => r.name.toLowerCase() === name.toLowerCase())) {
            alert("Routine name already exists.");
            return;
        }
        
        const newRoutine = {
            id: `routine_${definedRoutines.length}_${Date.now()}`,
            name: name,
            habitDefinitionIds: [],
            taskDefinitionIds: [],
            isActive: false
        };
        
        definedRoutines.push(newRoutine);
        routineNameInput.value = '';
        renderDefinedRoutines();
    }
    
    function deleteRoutine(routineId) {
        const routineIndex = definedRoutines.findIndex(r => r.id === routineId);
        if (routineIndex === -1) return;
        
        const routine = definedRoutines[routineIndex];
        if (confirm(`Are you sure you want to delete the routine "${routine.name}"?`)) {
            definedRoutines.splice(routineIndex, 1);
            
            // Update routines window if open
            setTimeout(() => {
                if (managementWindows.routines && !managementWindows.routines.classList.contains('hidden')) {
                    populateRoutinesWindow();
                }
            }, 100);
        }
    }
    
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
        const routine = definedRoutines.find(r => r.id === routineId);
        if (!routine) return;
        
        const habitIndex = routine.habitDefinitionIds.indexOf(habitDefId);
        if (habitIndex > -1) {
            routine.habitDefinitionIds.splice(habitIndex, 1);
            renderDefinedRoutines();
        }
    }
    
    function createNewHabitInRoutine(routineId, habitData) {
        const routine = definedRoutines.find(r => r.id === routineId);
        if (!routine) return;
        
        const newHabit = {
            id: `habitDef_${definedHabits.length}_${Date.now()}`,
            name: habitData.name,
            category: habitData.category,
            frequency: habitData.frequency,
            timeOfDay: habitData.timeOfDay,
            isNegative: habitData.isNegative || false,
            streak: 0,
            lastCompletionDate: null
        };
        
        definedHabits.push(newHabit);
        routine.habitDefinitionIds.push(newHabit.id);
        generateDailyHabitInstances(currentGameDate);
        renderDefinedRoutines();
    }
    
    function createNewTaskInRoutine(routineId, taskData) {
        const routine = definedRoutines.find(r => r.id === routineId);
        if (!routine) return;
        
        if (!routine.taskDefinitionIds) routine.taskDefinitionIds = [];
        
        const newTaskDef = {
            id: `taskDef_${Date.now()}`,
            name: taskData.name,
            category: taskData.category,
            isHighPriority: taskData.isHighPriority,
            defaultDueTime: taskData.defaultDueTime || '17:00'
        };
        
        if (!definedTasks) window.definedTasks = [];
        definedTasks.push(newTaskDef);
        routine.taskDefinitionIds.push(newTaskDef.id);
        renderDefinedRoutines();
    }
    
    function editHabitInRoutine(habitId, updatedData) {
        const habit = definedHabits.find(h => h.id === habitId);
        if (!habit) return;
        
        habit.name = updatedData.name;
        habit.category = updatedData.category;
        habit.frequency = updatedData.frequency;
        habit.timeOfDay = updatedData.timeOfDay;
        habit.isNegative = updatedData.isNegative;
        
        renderDefinedRoutines();
    }
    
    function editTaskInRoutine(taskId, updatedData) {
        if (!definedTasks) return;
        const task = definedTasks.find(t => t.id === taskId);
        if (!task) return;
        
        task.name = updatedData.name;
        task.category = updatedData.category;
        task.isHighPriority = updatedData.isHighPriority;
        task.defaultDueTime = updatedData.defaultDueTime;
        
        renderDefinedRoutines();
    }
    
    function removeTaskFromRoutine(routineId, taskId) {
        const routine = definedRoutines.find(r => r.id === routineId);
        if (!routine || !routine.taskDefinitionIds) return;
        
        const taskIndex = routine.taskDefinitionIds.indexOf(taskId);
        if (taskIndex > -1) {
            routine.taskDefinitionIds.splice(taskIndex, 1);
        }
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
        const routine = definedRoutines.find(r => r.id === routineId);
        const habitDef = definedHabits.find(h => h.id === habitDefId);
        
        if (!routine || !habitDef) {
            alert('Error finding routine or habit.');
            return;
        }
        
        if (routine.habitDefinitionIds.includes(habitDefId)) {
            alert('Habit already in routine.');
            return;
        }
        
        routine.habitDefinitionIds.push(habitDefId);
        renderDefinedRoutines();
    }

    function toggleRoutineActive(routineId) {
        const routine = definedRoutines.find(r => r.id === routineId);
        if (!routine) return;
        
        const activeRoutines = definedRoutines.filter(r => r.isActive).length;
        
        if (!routine.isActive && activeRoutines >= routineSlots) {
            alert(`You can only have ${routineSlots} active routine${routineSlots !== 1 ? 's' : ''} at your current level.`);
            return;
        }
        
        routine.isActive = !routine.isActive;
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
                    } else {
                        if (!routine.taskDefinitionIds) routine.taskDefinitionIds = [];
                        routine.taskDefinitionIds.push(selectedId);
                    }
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
    
    window.closeModal = function() {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => modal.remove());
    };
    
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
    
    function toggleFabMenu() {
        console.log('toggleFabMenu called');
        console.log('fabMenu:', fabMenu);
        console.log('fabButton:', fabButton);
        const isHidden = fabMenu.classList.contains('hidden');
        console.log('isHidden:', isHidden);
        fabMenu.classList.toggle('hidden', !isHidden);
        fabButton.classList.toggle('active', isHidden);
        console.log('After toggle - fabMenu classes:', fabMenu.className);
        console.log('After toggle - fabButton classes:', fabButton.className);
    }
    
    function closeFabMenu() {
        fabMenu.classList.add('hidden');
        fabButton.classList.remove('active');
    }
    
    function openManagementWindow(type) {
        // Close all windows first
        Object.values(managementWindows).forEach(window => {
            if (window) window.classList.add('hidden');
        });
        
        // Close FAB menu
        closeFabMenu();
        
        // Add or show backdrop
        let backdrop = document.querySelector('.window-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'window-backdrop';
            backdrop.addEventListener('click', () => {
                closeAllManagementWindows();
            });
            document.body.appendChild(backdrop);
        }
        backdrop.classList.add('show');
        
        // Open requested window
        const window = managementWindows[type];
        if (window) {
            window.classList.remove('hidden');
            
            // Populate the window with current data
            if (type === 'tasks') {
                populateTasksWindow();
            } else if (type === 'habits') {
                populateHabitsWindow();
            } else if (type === 'routines') {
                populateRoutinesWindow();
            }
        }
    }
    
    function closeAllManagementWindows() {
        Object.values(managementWindows).forEach(window => {
            if (window) window.classList.add('hidden');
        });
        
        const backdrop = document.querySelector('.window-backdrop');
        if (backdrop) {
            backdrop.classList.remove('show');
        }
    }
    
    function closeManagementWindow(windowId) {
        const window = document.getElementById(windowId);
        if (window) {
            window.classList.add('hidden');
        }
        
        // Check if all windows are closed, then hide backdrop
        const anyWindowOpen = Object.values(managementWindows).some(w => 
            w && !w.classList.contains('hidden')
        );
        
        if (!anyWindowOpen) {
            const backdrop = document.querySelector('.window-backdrop');
            if (backdrop) {
                backdrop.classList.remove('show');
            }
        }
    }
    
    function populateTasksWindow() {
        const tasksList = document.getElementById('tasksWindowList');
        if (!tasksList) return;
        
        tasksList.innerHTML = '';
        
        const topLevelTasks = activeItems.filter(item => item.type === 'task' && !item.parentId);
        if (topLevelTasks.length === 0) {
            tasksList.innerHTML = '<li>No active tasks</li>';
            return;
        }
        
        topLevelTasks.forEach(task => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${task.name} (${task.category})${task.isHighPriority ? ' ⭐' : ''}</span>
                <span style="font-size: 12px; color: var(--color-neutral);">Due: ${task.dueDateTime.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
            `;
            tasksList.appendChild(li);
        });
    }
    
    function populateHabitsWindow() {
        const habitsList = document.getElementById('habitsWindowList');
        if (!habitsList) return;
        
        habitsList.innerHTML = '';
        
        if (definedHabits.length === 0) {
            habitsList.innerHTML = '<li>No habits defined</li>';
            return;
        }
        
        definedHabits.forEach(habit => {
            const li = document.createElement('li');
            const habitTypeIcon = habit.isNegative ? ' 🚫' : ' ✅';
            li.innerHTML = `
                <span>${habit.name} (${habit.category})${habitTypeIcon}</span>
                <span style="font-size: 12px; color: var(--color-neutral);">Streak: ${habit.streak}</span>
            `;
            habitsList.appendChild(li);
        });
    }
    
    function populateRoutinesWindow() {
        const routinesList = document.getElementById('routinesWindowList');
        const activeCountDisplay = document.getElementById('windowActiveRoutineCountDisplay');
        const totalSlotsDisplay = document.getElementById('windowTotalRoutineSlotsDisplay');
        
        if (!routinesList) return;
        
        // Update counts
        const activeRoutines = definedRoutines.filter(r => r.isActive).length;
        if (activeCountDisplay) activeCountDisplay.textContent = activeRoutines;
        if (totalSlotsDisplay) totalSlotsDisplay.textContent = routineSlots;
        
        routinesList.innerHTML = '';
        
        if (definedRoutines.length === 0) {
            routinesList.innerHTML = '<li>No routines created</li>';
            return;
        }
        
        definedRoutines.forEach(routine => {
            const li = document.createElement('li');
            const statusIcon = routine.isActive ? '🟢' : '⚪';
            const habitCount = routine.habitDefinitionIds ? routine.habitDefinitionIds.length : 0;
            const taskCount = routine.taskDefinitionIds ? routine.taskDefinitionIds.length : 0;
            
            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div>
                        <div>${statusIcon} ${routine.name}</div>
                        <div style="font-size: 12px; color: var(--color-neutral);">${habitCount} habits, ${taskCount} tasks</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="edit-routine-btn" data-routine-id="${routine.id}" style="padding: 4px 8px; font-size: 12px; background: var(--color-accent-teal); color: white; border: none; border-radius: 4px; cursor: pointer;">Manage</button>
                        <button class="toggle-routine-btn" data-routine-id="${routine.id}" style="padding: 4px 8px; font-size: 12px; background: ${routine.isActive ? 'var(--color-error)' : 'var(--color-success)'}; color: white; border: none; border-radius: 4px; cursor: pointer;">${routine.isActive ? 'Deactivate' : 'Activate'}</button>
                    </div>
                </div>
            `;
            
            // Add event listeners for buttons
            const manageBtn = li.querySelector('.edit-routine-btn');
            const toggleBtn = li.querySelector('.toggle-routine-btn');
            
            if (manageBtn) {
                manageBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showRoutineManagement(routine.id);
                });
            }
            
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleRoutineActive(routine.id);
                    populateRoutinesWindow(); // Refresh the list
                });
            }
            
            routinesList.appendChild(li);
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
    
    function showFormModal(formType) {
        // Close any existing modals first
        closeModal();
        
        console.log('Creating modal for:', formType);
        
        let formHtml;
        
        switch (formType) {
            case 'task':
                formHtml = createTaskFormHtml();
                break;
            case 'habit':
                formHtml = createHabitFormHtml();
                break;
            case 'routine':
                formHtml = createRoutineFormHtml();
                break;
        }
        
        console.log('Generated form HTML:', formHtml ? 'SUCCESS' : 'FAILED');
        
        if (!formHtml) {
            console.error('Failed to generate form HTML for type:', formType);
            return;
        }
        
        const modalElement = document.createElement('div');
        modalElement.className = 'modal-overlay';
        modalElement.id = `${formType}FormModal`;
        modalElement.innerHTML = `
            <div class="modal-content">
                ${formHtml}
            </div>
        `;
        
        console.log('Creating modal element:', modalElement);
        
        document.body.appendChild(modalElement);
        
        // Small delay to ensure DOM is updated
        setTimeout(() => {
            attachModalEventListeners(formType);
        }, 50);
    }
    
    function createTaskFormHtml() {
        const today = new Date().toISOString().split('T')[0];
        return `
            <h3>Add New Task</h3>
            <div class="form-row">
                <label for="modalTaskName">Task Name:</label>
                <input type="text" id="modalTaskName" placeholder="Enter task name..." required>
            </div>
            <div class="form-row">
                <label for="modalTaskCategory">Category:</label>
                <select id="modalTaskCategory">
                    <option value="other">Other (Generic)</option>
                    <option value="career">Career</option>
                    <option value="creativity">Creativity</option>
                    <option value="financial">Financial</option>
                    <option value="health">Health</option>
                    <option value="lifestyle">Lifestyle</option>
                    <option value="relationships">Relationships</option>
                    <option value="spirituality">Spirituality</option>
                </select>
            </div>
            <div class="form-row priority-row">
                <input type="checkbox" id="modalTaskHighPriority">
                <label for="modalTaskHighPriority">High Priority</label>
            </div>
            <div class="form-row-group">
                <div class="form-row">
                    <label for="modalDueDate">Due Date:</label>
                    <input type="date" id="modalDueDate" value="${today}" required>
                </div>
                <div class="form-row">
                    <label for="modalDueTime">Due Time:</label>
                    <input type="time" id="modalDueTime" value="17:00">
                </div>
            </div>
            <div class="modal-buttons">
                <button id="modalAddTaskButton" class="primary-button">Add Task</button>
                <button class="secondary-button" onclick="closeModal()">Cancel</button>
            </div>
        `;
    }
    
    function createHabitFormHtml() {
        return `
            <h3>Add New Habit</h3>
            <div class="form-row">
                <label>Habit Type:</label>
                <div class="habit-type-toggle">
                    <input type="radio" id="modalPositiveHabit" name="modalHabitType" value="positive" checked>
                    <label for="modalPositiveHabit" class="habit-type-label positive">
                        <span class="habit-icon">✅</span>
                        <span class="habit-label">Positive</span>
                        <span class="habit-description">Complete to earn points</span>
                    </label>
                    <input type="radio" id="modalNegativeHabit" name="modalHabitType" value="negative">
                    <label for="modalNegativeHabit" class="habit-type-label negative">
                        <span class="habit-icon">🚫</span>
                        <span class="habit-label">Negative</span>
                        <span class="habit-description">Avoid to earn points</span>
                    </label>
                </div>
            </div>
            <div class="form-row">
                <label for="modalHabitName">Habit Name:</label>
                <input type="text" id="modalHabitName" placeholder="e.g., Exercise, Drink Water" required>
            </div>
            <div class="form-row">
                <label for="modalHabitCategory">Category:</label>
                <select id="modalHabitCategory">
                    <option value="health">Health</option>
                    <option value="other">Other (Generic)</option>
                    <option value="career">Career</option>
                    <option value="creativity">Creativity</option>
                    <option value="financial">Financial</option>
                    <option value="lifestyle">Lifestyle</option>
                    <option value="relationships">Relationships</option>
                    <option value="spirituality">Spirituality</option>
                </select>
            </div>
            <div class="form-row">
                <label for="modalHabitFrequency">Frequency:</label>
                <select id="modalHabitFrequency">
                    <option value="daily">Daily</option>
                </select>
            </div>
            <div class="form-row">
                <label for="modalHabitTimeOfDay">Completion Window:</label>
                <select id="modalHabitTimeOfDay">
                    <option value="anytime">Anytime Today</option>
                    <option value="morning">Morning (by 12 PM)</option>
                    <option value="afternoon">Afternoon (by 5 PM)</option>
                    <option value="evening">Evening (by 10 PM)</option>
                </select>
            </div>
            <div class="modal-buttons">
                <button id="modalAddHabitButton" class="primary-button">Add Habit</button>
                <button class="secondary-button" onclick="closeModal()">Cancel</button>
            </div>
        `;
    }
    
    function createRoutineFormHtml() {
        return `
            <h3>Create New Routine</h3>
            <div class="form-row">
                <label for="modalRoutineName">Routine Name:</label>
                <input type="text" id="modalRoutineName" placeholder="e.g., Morning Ritual" required>
            </div>
            <div class="modal-buttons">
                <button id="modalCreateRoutineButton" class="primary-button">Create Routine</button>
                <button class="secondary-button" onclick="closeModal()">Cancel</button>
            </div>
        `;
    }
    
    function attachModalEventListeners(formType) {
        const modal = document.querySelector(`#${formType}FormModal`);
        console.log('Attaching listeners to modal:', modal);
        
        if (!modal) {
            console.error('Modal not found:', `#${formType}FormModal`);
            return;
        }
        
        switch (formType) {
            case 'task':
                const addTaskBtn = modal.querySelector('#modalAddTaskButton');
                console.log('Found task button:', addTaskBtn);
                
                if (addTaskBtn) {
                    addTaskBtn.addEventListener('click', () => {
                        console.log('Task button clicked');
                        
                        const nameInput = modal.querySelector('#modalTaskName');
                        const categoryInput = modal.querySelector('#modalTaskCategory');
                        const priorityInput = modal.querySelector('#modalTaskHighPriority');
                        const dateInput = modal.querySelector('#modalDueDate');
                        const timeInput = modal.querySelector('#modalDueTime');
                        
                        console.log('Form inputs:', { nameInput, categoryInput, priorityInput, dateInput, timeInput });
                        
                        const name = nameInput ? nameInput.value.trim() : '';
                        const category = categoryInput ? categoryInput.value : 'other';
                        const isHighPriority = priorityInput ? priorityInput.checked : false;
                        const dueDate = dateInput ? dateInput.value : '';
                        const dueTime = timeInput ? timeInput.value : '17:00';
                        
                        console.log('Form values:', { name, category, isHighPriority, dueDate, dueTime });
                        
                        if (!name || !dueDate) {
                            alert('Task Name and Due Date are required.');
                            return;
                        }
                        
                        const taskData = createTaskItemData(name, category, isHighPriority, dueDate, dueTime);
                        addItemToGame(taskData);
                        sortAndRenderActiveList();
                        closeModal();
                        
                        // Update tasks window if open
                        setTimeout(() => {
                            if (managementWindows.tasks && !managementWindows.tasks.classList.contains('hidden')) {
                                populateTasksWindow();
                            }
                        }, 100);
                    });
                } else {
                    console.error('Task button not found in modal');
                }
                break;
                
            case 'habit':
                const addHabitBtn = modal.querySelector('#modalAddHabitButton');
                console.log('Found habit button:', addHabitBtn);
                
                if (addHabitBtn) {
                    addHabitBtn.addEventListener('click', () => {
                        console.log('Habit button clicked');
                        
                        const nameInput = modal.querySelector('#modalHabitName');
                        const categoryInput = modal.querySelector('#modalHabitCategory');
                        const frequencyInput = modal.querySelector('#modalHabitFrequency');
                        const timeOfDayInput = modal.querySelector('#modalHabitTimeOfDay');
                        const typeRadio = modal.querySelector('input[name="modalHabitType"]:checked');
                        
                        const name = nameInput ? nameInput.value.trim() : '';
                        const category = categoryInput ? categoryInput.value : 'health';
                        const frequency = frequencyInput ? frequencyInput.value : 'daily';
                        const timeOfDay = timeOfDayInput ? timeOfDayInput.value : 'anytime';
                        const isNegative = typeRadio ? typeRadio.value === 'negative' : false;
                        
                        console.log('Habit form values:', { name, category, frequency, timeOfDay, isNegative });
                        
                        if (!name) {
                            alert('Habit Name is required.');
                            return;
                        }
                        
                        createHabitDefinition(name, category, frequency, timeOfDay, isNegative);
                        closeModal();
                        
                        // Update habits window if open
                        setTimeout(() => {
                            if (managementWindows.habits && !managementWindows.habits.classList.contains('hidden')) {
                                populateHabitsWindow();
                            }
                        }, 100);
                    });
                } else {
                    console.error('Habit button not found in modal');
                }
                break;
                
            case 'routine':
                const createRoutineBtn = modal.querySelector('#modalCreateRoutineButton');
                console.log('Found routine button:', createRoutineBtn);
                
                if (createRoutineBtn) {
                    createRoutineBtn.addEventListener('click', () => {
                        console.log('Routine button clicked');
                        
                        const nameInput = modal.querySelector('#modalRoutineName');
                        const name = nameInput ? nameInput.value.trim() : '';
                        
                        console.log('Routine form values:', { name });
                        
                        if (!name) {
                            alert('Please enter a routine name.');
                            return;
                        }
                        
                        if (definedRoutines.some(r => r.name.toLowerCase() === name.toLowerCase())) {
                            alert('Routine name already exists.');
                            return;
                        }
                        
                        const newRoutine = {
                            id: `routine_${definedRoutines.length}_${Date.now()}`,
                            name: name,
                            habitDefinitionIds: [],
                            taskDefinitionIds: [],
                            isActive: false
                        };
                        
                        definedRoutines.push(newRoutine);
                        closeModal();
                        
                        // Update routines window if open
                        setTimeout(() => {
                            if (managementWindows.routines && !managementWindows.routines.classList.contains('hidden')) {
                                populateRoutinesWindow();
                            } else {
                                // Open routine management for the new routine if window was closed
                                openManagementWindow('routines');
                            }
                        }, 100);
                    });
                } else {
                    console.error('Routine button not found in modal');
                }
                break;
        }
    }
    
    // Forms are now handled through dedicated modal functions above
    
    // Event Listeners
    if (fabButton) {
        fabButton.addEventListener('click', toggleFabMenu);
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

    if (addTaskButton) {
        addTaskButton.addEventListener('click', () => {
            if (gameIsOver) return;
            
            const name = taskNameInput.value.trim();
            const category = taskCategoryInput.value;
            const isHighPriority = taskHighPriorityInput.checked;
            const dueDate = dueDateInput.value;
            const dueTime = dueTimeInput.value;
            
            if (!name || !dueDate) {
                alert("Task Name and Due Date are required.");
                return;
            }
            
            const taskData = createTaskItemData(name, category, isHighPriority, dueDate, dueTime);
            addItemToGame(taskData);
            
            clearFormInputs();
            taskNameInput.focus();
        });
    }

    if (addHabitButton) {
        addHabitButton.addEventListener('click', () => {
            if (gameIsOver) return;
            
            const name = habitNameInput.value.trim();
            const category = habitCategoryInput.value;
            const frequency = habitFrequencyInput.value;
            const timeOfDay = habitTimeOfDayInput.value;
            const isNegative = document.querySelector('input[name="mainHabitType"]:checked').value === 'negative';
            
            if (!name) {
                alert("Habit Name is required.");
                return;
            }
            
            createHabitDefinition(name, category, frequency, timeOfDay, isNegative);
            
            clearFormInputs();
            habitNameInput.focus();
        });
    }

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
        restartButton.addEventListener('click', initGame);
    }

    // Keyboard shortcuts
    if (taskNameInput) {
        taskNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && taskForm && taskForm.classList.contains('active-form')) {
                if (addTaskButton) addTaskButton.click();
            }
        });
    }

    if (habitNameInput) {
        habitNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && habitForm && habitForm.classList.contains('active-form')) {
                if (addHabitButton) addHabitButton.click();
            }
        });
    }

    // Set default due date to today
    if (dueDateInput) {
        const today = new Date();
        dueDateInput.value = today.toISOString().split('T')[0];
    }
    
    // Legacy form function for routine management
    function showForm(formType) {
        if (formType === 'routine') {
            openManagementWindow('routines');
        }
    }

    // Initialize definedTasks array
    if (!window.definedTasks) window.definedTasks = [];
    
    // Debug display function
    function showDebugInfo(functionName, data) {
        let debugDisplay = document.getElementById('debugDisplay');
        if (!debugDisplay) {
            debugDisplay = document.createElement('div');
            debugDisplay.id = 'debugDisplay';
            debugDisplay.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 12px;
                max-width: 300px;
                z-index: 10000;
                max-height: 200px;
                overflow-y: auto;
            `;
            document.body.appendChild(debugDisplay);
        }
        
        const timestamp = new Date().toLocaleTimeString();
        const debugEntry = document.createElement('div');
        debugEntry.style.cssText = 'margin-bottom: 5px; padding: 2px; border-bottom: 1px solid #333;';
        debugEntry.innerHTML = `
            <strong>[${timestamp}] ${functionName}</strong><br>
            ${Object.entries(data).map(([key, value]) => `${key}: ${value}`).join('<br>')}
        `;
        
        debugDisplay.appendChild(debugEntry);
        
        // Keep only last 10 entries
        while (debugDisplay.children.length > 10) {
            debugDisplay.removeChild(debugDisplay.firstChild);
        }
    }
    
    // Initialize the game
    initGame();
});

/**
 * TaskManager - Clean implementation for task and subtask management
 * Handles all task creation, subtask relationships, and UI rendering
 */
class TaskManager {
    constructor(gameCanvas, activeItemsList, itemIdCounter) {
        this.gameCanvas = gameCanvas;
        this.activeItemsList = activeItemsList;
        this.itemIdCounter = itemIdCounter;
        this.tasks = new Map(); // Use Map for better performance
        this.completedTasks = new Map();
        
        // Game constants
        this.ENEMY_WIDTH = 128;
        this.SUBTASK_WIDTH = 64;
        this.ENEMY_HEIGHT = 128;
        this.SUBTASK_HEIGHT = 64;
        
        // Category configuration
        this.categoryStyles = {
            "other": { bgColor: "#90ee90", textColorClass: "category-other-text" },
            "career": { bgColor: "#4a90e2" },
            "creativity": { bgColor: "#f5a623" },
            "financial": { bgColor: "#50e3c2" },
            "health": { bgColor: "#e91e63" },
            "lifestyle": { bgColor: "#bd10e0" },
            "relationships": { bgColor: "#f8e71c", textColorClass: "category-relationships-text" },
            "spirituality": { bgColor: "#7ed321" }
        };
    }

    /**
     * Create a new task with proper validation and structure
     */
    createTask(taskData) {
        const { name, category = 'other', isHighPriority = false, dueDate, dueTime, parentId = null } = taskData;
        
        if (!name || !name.trim()) {
            throw new Error('Task name is required');
        }

        const now = new Date();
        let dueDateTime;

        // Handle due date/time
        if (dueDate && dueTime) {
            dueDateTime = new Date(`${dueDate}T${dueTime}`);
        } else if (dueDate) {
            dueDateTime = new Date(dueDate);
            dueDateTime.setHours(23, 59, 59, 999);
        } else {
            // Default to 10 minutes from now if no due date provided
            dueDateTime = new Date(now.getTime() + 10 * 60 * 1000);
        }

        // If this is a subtask and no due date was provided, inherit from parent
        if (parentId && !dueDate && !dueTime) {
            const parentTask = this.tasks.get(parentId);
            if (parentTask) {
                dueDateTime = new Date(parentTask.dueDateTime);
            }
        }

        // Validate parent exists if parentId is provided
        if (parentId !== null) {
            const parentTask = this.tasks.get(parentId);
            if (!parentTask) {
                throw new Error(`Parent task with ID ${parentId} not found`);
            }
            if (parentTask.parentId !== null) {
                throw new Error('Cannot create subtask of a subtask (only 2 levels supported)');
            }
        }

        const task = {
            id: this.itemIdCounter.get(),
            type: 'task',
            name: name.trim(),
            category,
            isHighPriority,
            dueDateTime,
            createdAt: now,
            parentId,
            subtasks: [], // Array of subtask IDs
            completedSubtasks: 0,
            isOverdue: false,
            lastDamageTime: null,
            x: this.calculateInitialPosition(dueDateTime, now),
            element: null, // Game canvas element
            listElement: null // Task list element
        };

        // Add to tasks map
        this.tasks.set(task.id, task);

        // If this is a subtask, add to parent's subtasks array
        if (parentId !== null) {
            const parentTask = this.tasks.get(parentId);
            parentTask.subtasks.push(task.id);
        }

        return task;
    }

    /**
     * Add task to the game (both canvas and UI list)
     */
    addTaskToGame(task) {
        this.createGameElement(task);
        
        // Only create list element for parent tasks
        if (task.parentId === null) {
            this.createListElement(task);
        }

        this.updateTaskCount();
        this.refreshTaskList();
    }

    /**
     * Create the game canvas element for a task
     */
    createGameElement(task) {
        const element = document.createElement('div');
        element.classList.add('enemy', 'zombie-sprite', `zombie-${task.category}`, `category-${task.category}`);
        element.dataset.taskId = task.id;

        // Set size based on whether it's a subtask
        const width = task.parentId !== null ? this.SUBTASK_WIDTH : this.ENEMY_WIDTH;
        const height = task.parentId !== null ? this.SUBTASK_HEIGHT : this.ENEMY_HEIGHT;
        
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;

        // Add special classes for subtasks
        if (task.parentId !== null) {
            element.classList.add('subtask-enemy', 'zombie-subtask');
        }

        // Add priority class
        if (task.isHighPriority) {
            element.classList.add('high-priority');
        }

        // Position element
        element.style.left = `${task.x}px`;
        element.style.top = `${Math.random() * (this.gameCanvas.offsetHeight - height)}px`;

        // Add click handler
        element.addEventListener('click', () => this.handleTaskClick(task.id));

        // Add to canvas
        this.gameCanvas.appendChild(element);
        task.element = element;
    }

    /**
     * Create the task list element (only for parent tasks)
     */
    createListElement(task) {
        if (task.parentId !== null) {
            return; // Subtasks don't get their own list elements
        }

        const listItem = document.createElement('li');
        listItem.classList.add('task-item', `category-${task.category}`);
        listItem.dataset.taskId = task.id;

        listItem.innerHTML = this.generateTaskListHTML(task);
        
        // Add event listeners
        this.attachTaskListEventListeners(listItem, task);

        // Add to list
        this.activeItemsList.appendChild(listItem);
        task.listElement = listItem;
    }

    /**
     * Generate HTML for task list item
     */
    generateTaskListHTML(task) {
        const subtasksHTML = this.generateSubtasksHTML(task);
        
        return `
            <div class="task-header">
                <div class="task-info">
                    <span class="task-name">${this.escapeHtml(task.name)}</span>
                    <div class="task-details">
                        <span class="due-date">Due: ${task.dueDateTime.toLocaleString([], { 
                            dateStyle: 'short', 
                            timeStyle: 'short' 
                        })}</span>
                        <span class="category">${task.category}</span>
                        ${task.isHighPriority ? '<span class="priority-badge">High Priority</span>' : ''}
                    </div>
                </div>
                <div class="task-controls">
                    <button class="edit-btn" data-action="edit" title="Edit Task">✏️</button>
                    <button class="subtask-btn" data-action="add-subtask" title="Add Subtask">+ Sub-task</button>
                    <label class="complete-checkbox">
                        <input type="checkbox" data-action="complete">
                        <span>Complete</span>
                    </label>
                </div>
            </div>
            ${subtasksHTML}
        `;
    }

    /**
     * Generate HTML for subtasks section
     */
    generateSubtasksHTML(parentTask) {
        if (parentTask.subtasks.length === 0) {
            return '';
        }

        const subtasksHtml = parentTask.subtasks.map(subtaskId => {
            const subtask = this.tasks.get(subtaskId);
            if (!subtask) return '';

            return `
                <li class="subtask-item" data-subtask-id="${subtask.id}">
                    <div class="subtask-sprite zombie-subtask category-${subtask.category}"></div>
                    <div class="subtask-info">
                        <span class="subtask-name">${this.escapeHtml(subtask.name)}</span>
                        <div class="subtask-details">
                            <span class="due-date">${subtask.dueDateTime.toLocaleString([], { 
                                dateStyle: 'short', 
                                timeStyle: 'short' 
                            })}</span>
                            <span class="category">${subtask.category}</span>
                            ${subtask.isHighPriority ? '<span class="priority-badge">High Priority</span>' : ''}
                        </div>
                    </div>
                    <div class="subtask-controls">
                        <button class="edit-btn" data-action="edit-subtask" data-subtask-id="${subtask.id}" title="Edit Subtask">✏️</button>
                        <label class="complete-checkbox">
                            <input type="checkbox" data-action="complete-subtask" data-subtask-id="${subtask.id}">
                            <span>Complete</span>
                        </label>
                    </div>
                </li>
            `;
        }).join('');

        return `
            <div class="subtasks-section">
                <h4>Subtasks (${parentTask.subtasks.length})</h4>
                <ul class="subtasks-list">
                    ${subtasksHtml}
                </ul>
            </div>
        `;
    }

    /**
     * Attach event listeners to task list elements
     */
    attachTaskListEventListeners(listElement, task) {
        listElement.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const subtaskId = e.target.dataset.subtaskId;

            switch (action) {
                case 'edit':
                    this.showEditTaskModal(task.id);
                    break;
                case 'add-subtask':
                    this.showAddSubtaskModal(task.id);
                    break;
                case 'complete':
                    if (e.target.checked) {
                        this.completeTask(task.id);
                    }
                    break;
                case 'edit-subtask':
                    this.showEditTaskModal(parseInt(subtaskId));
                    break;
                case 'complete-subtask':
                    if (e.target.checked) {
                        this.completeTask(parseInt(subtaskId));
                    }
                    break;
            }
        });
    }

    /**
     * Show modal for adding subtask
     */
    showAddSubtaskModal(parentId) {
        const parentTask = this.tasks.get(parentId);
        if (!parentTask) {
            console.error('Parent task not found:', parentId);
            return;
        }

        const modal = this.createSubtaskModal(parentTask);
        document.body.appendChild(modal);

        // Focus on name input
        const nameInput = modal.querySelector('#subtask-name');
        if (nameInput) {
            nameInput.focus();
        }
    }

    /**
     * Create subtask modal DOM element
     */
    createSubtaskModal(parentTask) {
        const modal = document.createElement('div');
        modal.classList.add('modal-overlay');
        
        const parentDueDate = parentTask.dueDateTime.toISOString().split('T')[0];
        const parentDueTime = parentTask.dueDateTime.toISOString().split('T')[1].substring(0, 5);

        modal.innerHTML = `
            <div class="modal-content">
                <h3>Create Subtask for "${this.escapeHtml(parentTask.name)}"</h3>
                <form id="subtask-form">
                    <div class="form-group">
                        <label for="subtask-name">Subtask Name *</label>
                        <input type="text" id="subtask-name" required>
                    </div>
                    <div class="form-group">
                        <label for="subtask-category">Category</label>
                        <select id="subtask-category">
                            <option value="other" ${parentTask.category === 'other' ? 'selected' : ''}>Other</option>
                            <option value="career" ${parentTask.category === 'career' ? 'selected' : ''}>Career</option>
                            <option value="creativity" ${parentTask.category === 'creativity' ? 'selected' : ''}>Creativity</option>
                            <option value="financial" ${parentTask.category === 'financial' ? 'selected' : ''}>Financial</option>
                            <option value="health" ${parentTask.category === 'health' ? 'selected' : ''}>Health</option>
                            <option value="lifestyle" ${parentTask.category === 'lifestyle' ? 'selected' : ''}>Lifestyle</option>
                            <option value="relationships" ${parentTask.category === 'relationships' ? 'selected' : ''}>Relationships</option>
                            <option value="spirituality" ${parentTask.category === 'spirituality' ? 'selected' : ''}>Spirituality</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="subtask-priority" ${parentTask.isHighPriority ? 'checked' : ''}>
                            High Priority
                        </label>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="subtask-due-date">Due Date *</label>
                            <input type="date" id="subtask-due-date" value="${parentDueDate}" required>
                        </div>
                        <div class="form-group">
                            <label for="subtask-due-time">Due Time</label>
                            <input type="time" id="subtask-due-time" value="${parentDueTime}">
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button type="submit" class="primary-btn">Create Subtask</button>
                        <button type="button" class="secondary-btn" data-action="cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;

        // Add event listeners
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') || e.target.dataset.action === 'cancel') {
                modal.remove();
            }
        });

        modal.querySelector('#subtask-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubtaskSubmit(modal, parentTask.id);
        });

        return modal;
    }

    /**
     * Handle subtask form submission
     */
    handleSubtaskSubmit(modal, parentId) {
        const formData = {
            name: modal.querySelector('#subtask-name').value.trim(),
            category: modal.querySelector('#subtask-category').value,
            isHighPriority: modal.querySelector('#subtask-priority').checked,
            dueDate: modal.querySelector('#subtask-due-date').value,
            dueTime: modal.querySelector('#subtask-due-time').value,
            parentId: parentId
        };

        try {
            const subtask = this.createTask(formData);
            this.addTaskToGame(subtask);
            
            // Refresh parent task's list item to show new subtask
            this.refreshParentTaskDisplay(parentId);
            
            modal.remove();
            
            console.log('Subtask created successfully:', subtask);
        } catch (error) {
            alert('Error creating subtask: ' + error.message);
            console.error('Subtask creation error:', error);
        }
    }

    /**
     * Complete a task or subtask
     */
    completeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            console.error('Task not found:', taskId);
            return;
        }

        // Move to completed tasks
        this.completedTasks.set(taskId, { ...task, completedAt: new Date() });
        this.tasks.delete(taskId);

        // Remove game element
        if (task.element) {
            task.element.remove();
        }

        // If this is a subtask, remove from parent and update parent display
        if (task.parentId !== null) {
            const parentTask = this.tasks.get(task.parentId);
            if (parentTask) {
                const subtaskIndex = parentTask.subtasks.indexOf(taskId);
                if (subtaskIndex > -1) {
                    parentTask.subtasks.splice(subtaskIndex, 1);
                    parentTask.completedSubtasks++;
                }
                this.refreshParentTaskDisplay(task.parentId);
            }
        } else {
            // If this is a parent task, complete all subtasks too
            task.subtasks.forEach(subtaskId => {
                this.completeTask(subtaskId);
            });
            
            // Remove list element
            if (task.listElement) {
                task.listElement.remove();
            }
        }

        this.updateTaskCount();
        
        // TODO: Award XP and points
        console.log('Task completed:', task.name);
    }

    /**
     * Refresh the display of a parent task (when subtasks change)
     */
    refreshParentTaskDisplay(parentId) {
        const parentTask = this.tasks.get(parentId);
        if (!parentTask || parentTask.parentId !== null) {
            return; // Not a parent task
        }

        if (parentTask.listElement) {
            parentTask.listElement.innerHTML = this.generateTaskListHTML(parentTask);
            this.attachTaskListEventListeners(parentTask.listElement, parentTask);
        }
    }

    /**
     * Calculate initial position for task on timeline
     */
    calculateInitialPosition(dueDateTime, currentTime) {
        const gameWidth = this.gameCanvas.offsetWidth;
        const baseWidth = 100; // Assume base width
        
        const timeToDeadline = dueDateTime.getTime() - currentTime.getTime();
        const maxTimespan = 24 * 60 * 60 * 1000; // 24 hours in ms
        
        const positionRatio = Math.max(0, Math.min(1, timeToDeadline / maxTimespan));
        return Math.floor(gameWidth * positionRatio);
    }

    /**
     * Handle click on task game element
     */
    handleTaskClick(taskId) {
        // TODO: Implement task attack/interaction logic
        console.log('Task clicked:', taskId);
    }

    /**
     * Show edit task modal
     */
    showEditTaskModal(taskId) {
        // TODO: Implement edit functionality
        console.log('Edit task:', taskId);
    }

    /**
     * Update task count display
     */
    updateTaskCount() {
        const taskCountElement = document.getElementById('taskCountDisplay');
        if (taskCountElement) {
            const count = Array.from(this.tasks.values()).filter(task => task.parentId === null).length;
            taskCountElement.textContent = count;
        }
    }

    /**
     * Refresh the entire task list
     */
    refreshTaskList() {
        // Remove all existing list elements
        this.activeItemsList.innerHTML = '';

        // Re-create list elements for all parent tasks
        const parentTasks = Array.from(this.tasks.values())
            .filter(task => task.parentId === null)
            .sort((a, b) => a.dueDateTime - b.dueDateTime);

        parentTasks.forEach(task => {
            this.createListElement(task);
        });
    }

    /**
     * Get all tasks (for external access)
     */
    getAllTasks() {
        return Array.from(this.tasks.values());
    }

    /**
     * Get task by ID
     */
    getTask(taskId) {
        return this.tasks.get(taskId);
    }

    /**
     * Clear all tasks
     */
    clearAllTasks() {
        // Remove all game elements
        this.tasks.forEach(task => {
            if (task.element) {
                task.element.remove();
            }
            if (task.listElement) {
                task.listElement.remove();
            }
        });

        this.tasks.clear();
        this.completedTasks.clear();
        this.activeItemsList.innerHTML = '';
        this.updateTaskCount();
    }

    /**
     * Utility: Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in main script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskManager;
}

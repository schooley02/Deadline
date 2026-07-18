/**
 * Routine views — part 1 of 2 (Milestone 2 UI extraction, session 8,
 * 2026-07-18).
 *
 * Extracted from script.js per docs/UI_EXTRACTION_PLAN.md cluster F,
 * rendering half: `renderDefinedRoutines`, `showRoutineManagement`,
 * `populateRoutineHabits`, `populateRoutineTasks`, `updateRoutineDisplay`.
 *
 * PLAN CORRECTION: the plan's session-8 row also lists `populateRoutinesWindow`,
 * but that function was already extracted into js/ui/managementWindows.js
 * during session 3 (cluster E) — script.js's `populateRoutinesWindow` is
 * already a thin wrapper over `ManagementWindows.populateRoutinesWindow`.
 * There was nothing left to move for it here; the plan's function inventory
 * (written before session 3 ran) was never updated. See DECISIONS.md.
 *
 * Part 2 (session 9, form half) — showCreateHabitForm/showCreateTaskForm/
 * showEditHabitForm/showEditTaskForm, showAddItemToRoutineModal,
 * attachRoutineManagementListeners, populateHabitSelectDropdown, and the
 * four window.save* handlers — is NOT extracted yet and still lives in
 * script.js. Every one of those is called BY the functions in this file
 * (edit/create/add buttons inside a rendered routine), so they arrive here
 * as plain function-reference deps, same as any other not-yet-extracted
 * script.js function this project's modules depend on (e.g. popups.js
 * depending on createTaskItemData).
 *
 * DEPENDENCY NOTE — getters vs plain/bare references:
 * `definedRoutines` and `definedHabits` are script.js `let` closure
 * variables REASSIGNED elsewhere (new-game reset, restoreGameState) —
 * getters, following the precedent from agendaList.js part 2 (session 7).
 * `definedTasks`, by contrast, has NO local declaration in script.js at
 * all — every read/write goes through the bare global `window.definedTasks`
 * (script.js's own code does `if (!definedTasks) window.definedTasks = []`,
 * relying on the bare identifier resolving to the global). This module reads
 * `window.definedTasks` directly for the same reason CONFIG/Clock/Modal/
 * Routines are read as bare globals elsewhere in js/ui/ — no dep needed,
 * and no staleness risk since it's read fresh off `window` on every call.
 * `definedRoutinesListUL` and `activeRoutineCountDisplay` are stable `const`
 * DOM refs in script.js (queried once, never reassigned) — plain references.
 */
const RoutineViews = (() => {

    /**
     * deps: { definedRoutines (getter), activeRoutineCountDisplay }
     */
    function updateRoutineDisplay(deps) {
        const activeRoutines = deps.definedRoutines().filter(r => r.isActive).length;
        if (deps.activeRoutineCountDisplay) {
            deps.activeRoutineCountDisplay.textContent = activeRoutines;
        }
    }

    /**
     * deps: { definedHabits (getter) }
     */
    function populateRoutineHabits(routine, deps) {
        const container = document.getElementById('routineHabitsList');
        if (!container) return;

        container.innerHTML = '';

        if (!routine.habitDefinitionIds || routine.habitDefinitionIds.length === 0) {
            container.innerHTML = '<div style="padding: 12px; background: var(--color-bg-light); border-radius: 6px; color: var(--color-neutral); font-style: italic;">No habits in this routine</div>';
            return;
        }

        routine.habitDefinitionIds.forEach(habitId => {
            const habit = deps.definedHabits().find(h => h.id === habitId);
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

    // No deps — definedTasks is always read as the bare window global
    // (see header note), matching script.js's own original code exactly.
    function populateRoutineTasks(routine) {
        const container = document.getElementById('routineTasksList');
        if (!container) return;

        container.innerHTML = '';

        if (!window.definedTasks) window.definedTasks = [];

        if (!routine.taskDefinitionIds || routine.taskDefinitionIds.length === 0) {
            container.innerHTML = '<div style="padding: 12px; background: var(--color-bg-light); border-radius: 6px; color: var(--color-neutral); font-style: italic;">No tasks in this routine</div>';
            return;
        }

        routine.taskDefinitionIds.forEach(taskId => {
            const task = window.definedTasks.find(t => t.id === taskId);
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

    /**
     * deps: { definedRoutinesListUL, definedRoutines (getter),
     *         definedHabits (getter), activeRoutineCountDisplay,
     *         toggleRoutineActive, deleteRoutine, showEditHabitForm,
     *         removeHabitFromRoutine, populateHabitSelectDropdown,
     *         addHabitToRoutine, showCreateHabitForm, showEditTaskForm,
     *         removeTaskFromRoutine, showCreateTaskForm }
     */
    function renderDefinedRoutines(deps) {
        if (!deps.definedRoutinesListUL) return;

        deps.definedRoutinesListUL.innerHTML = '';

        const definedRoutines = deps.definedRoutines();

        if (definedRoutines.length === 0) {
            deps.definedRoutinesListUL.innerHTML = '<li>No routines created.</li>';
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

            activateBtn.addEventListener('click', () => deps.toggleRoutineActive(routine.id));

            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-routine-button');
            deleteBtn.textContent = "Delete";
            deleteBtn.addEventListener('click', () => deps.deleteRoutine(routine.id));

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
                    const habitDef = deps.definedHabits().find(h => h.id === habitId);
                    if (habitDef) {
                        const habitLi = document.createElement('li');
                        habitLi.classList.add('routine-item');

                        const habitInfo = document.createElement('span');
                        const habitTypeIcon = habitDef.isNegative ? ' 🚫' : ' ✅';
                        habitInfo.textContent = `${habitDef.name} (${habitDef.category})${habitTypeIcon}`;

                        const itemButtonGroup = document.createElement('div');
                        itemButtonGroup.classList.add('item-button-group');

                        const editHabitBtn = document.createElement('button');
                        editHabitBtn.classList.add('edit-item-button');
                        editHabitBtn.textContent = '✏️';
                        editHabitBtn.title = 'Edit habit';
                        editHabitBtn.addEventListener('click', () => deps.showEditHabitForm(routine.id, habitDef));

                        const removeHabitBtn = document.createElement('button');
                        removeHabitBtn.classList.add('remove-item-button');
                        removeHabitBtn.textContent = '×';
                        removeHabitBtn.title = 'Remove habit from routine';
                        removeHabitBtn.addEventListener('click', () => deps.removeHabitFromRoutine(routine.id, habitId));

                        itemButtonGroup.appendChild(editHabitBtn);
                        itemButtonGroup.appendChild(removeHabitBtn);

                        habitLi.appendChild(habitInfo);
                        habitLi.appendChild(itemButtonGroup);
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
            deps.populateHabitSelectDropdown(habitSelect);

            const addHabitBtn = document.createElement('button');
            addHabitBtn.classList.add('add-item-button');
            addHabitBtn.textContent = 'Add Habit';
            addHabitBtn.addEventListener('click', () => {
                const selectedHabitId = habitSelect.value;
                if (selectedHabitId) {
                    deps.addHabitToRoutine(routine.id, selectedHabitId);
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
            addNewHabitBtn.addEventListener('click', () => deps.showCreateHabitForm(routine.id));

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

            if (!window.definedTasks) window.definedTasks = [];

            if (routine.taskDefinitionIds && routine.taskDefinitionIds.length > 0) {
                routine.taskDefinitionIds.forEach(taskId => {
                    const taskDef = window.definedTasks.find(t => t.id === taskId);
                    if (taskDef) {
                        const taskLi = document.createElement('li');
                        taskLi.classList.add('routine-item');

                        const taskInfo = document.createElement('span');
                        taskInfo.textContent = `${taskDef.name} (${taskDef.category})${taskDef.isHighPriority ? ' ⭐' : ''}`;

                        const itemButtonGroup = document.createElement('div');
                        itemButtonGroup.classList.add('item-button-group');

                        const editTaskBtn = document.createElement('button');
                        editTaskBtn.classList.add('edit-item-button');
                        editTaskBtn.textContent = '✏️';
                        editTaskBtn.title = 'Edit task';
                        editTaskBtn.addEventListener('click', () => deps.showEditTaskForm(routine.id, taskDef));

                        const removeTaskBtn = document.createElement('button');
                        removeTaskBtn.classList.add('remove-item-button');
                        removeTaskBtn.textContent = '×';
                        removeTaskBtn.title = 'Remove task from routine';
                        removeTaskBtn.addEventListener('click', () => deps.removeTaskFromRoutine(routine.id, taskId));

                        itemButtonGroup.appendChild(editTaskBtn);
                        itemButtonGroup.appendChild(removeTaskBtn);

                        taskLi.appendChild(taskInfo);
                        taskLi.appendChild(itemButtonGroup);
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
            addNewTaskBtn.addEventListener('click', () => deps.showCreateTaskForm(routine.id));

            tasksSection.appendChild(addNewTaskBtn);
            li.appendChild(tasksSection);
            deps.definedRoutinesListUL.appendChild(li);
        });

        updateRoutineDisplay({
            definedRoutines: deps.definedRoutines,
            activeRoutineCountDisplay: deps.activeRoutineCountDisplay
        });
    }

    /**
     * deps: { definedRoutines (getter), definedHabits (getter),
     *         attachRoutineManagementListeners, deleteRoutine }
     */
    function showRoutineManagement(routineId, deps) {
        const routine = deps.definedRoutines().find(r => r.id === routineId);
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

        // Populate the routine content (module-internal calls, same file)
        populateRoutineHabits(routine, { definedHabits: deps.definedHabits });
        populateRoutineTasks(routine);

        // Attach event listeners — still script.js-scoped (session 9, form half)
        deps.attachRoutineManagementListeners(routine.id);
    }

    return {
        updateRoutineDisplay,
        populateRoutineHabits,
        populateRoutineTasks,
        renderDefinedRoutines,
        showRoutineManagement
    };
})();

// Node/Jest interop — the browser gets the bare global above.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutineViews;
}

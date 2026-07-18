/**
 * Forms — the FAB's modal creation forms for tasks, habits, and routines
 * (Milestone 2 UI extraction, session 4, 2026-07-18).
 *
 * Extracted from script.js per docs/UI_EXTRACTION_PLAN.md cluster A:
 * showFormModal, createTaskFormHtml, createHabitFormHtml,
 * createRoutineFormHtml, attachModalEventListeners. Real scope was ~311
 * lines (2789-3099 at extraction time), smaller than the plan's stale ~529
 * estimate — attachModalEventListeners itself is ~148 lines, not 366; that
 * number apparently included the FAB/window event-listener wiring below it,
 * which is NOT part of this cluster (stays in script.js's init block).
 *
 * Dependency approach, consistent with sessions 1-3:
 *   - Modal (js/ui/modal.js) and Routines (js/routines.js) are called as
 *     bare globals, NOT threaded through deps — both are stable, fully
 *     extracted modules guaranteed loaded first by index.html's script
 *     order, the same category as CONFIG/Clock in movement.js. This is
 *     different from session 3's treatment of closeFabMenu/
 *     showRoutineManagement/toggleRoutineActive, which are script.js
 *     CLOSURE functions (not globals) and genuinely need deps.
 *   - Everything else this file touches (createTaskItemData, addItemToGame,
 *     sortAndRenderActiveList, createHabitDefinition, saveGame,
 *     definedRoutines, managementWindows, populateTasksWindow/
 *     populateHabitsWindow/populateRoutinesWindow, openManagementWindow) is
 *     a script.js closure value/wrapper and arrives via deps.
 *
 * RECONCILIATION (this session's second piece, flagged 2026-07-18 in
 * DECISIONS.md): the routine-creation branch of attachModalEventListeners
 * used to build the new routine object inline, duplicating
 * Routines.createRoutineDefinition's id-format/validation logic AND missing
 * its own saveGame() call (relying on the 5s autosave net instead). Now
 * calls Routines.createRoutineDefinition(name, definedRoutines) directly —
 * same empty/duplicate validation and alert messages, byte-identical
 * routine shape — and calls deps.saveGame() before closing the modal. This
 * is a real (if minor) behavior change: routine creation via the modal is
 * now saved immediately instead of waiting up to 5s for the autosave timer.
 * See DECISIONS.md for full reasoning.
 *
 * Debug console.log tracing (added while chasing the original FAB-not-
 * working bug, since fixed) removed throughout as pure noise, same
 * precedent as fabMenu.js's cleanup last session. console.error calls on
 * genuine failure paths (form HTML generation failed, modal/button not
 * found) were KEPT — those indicate a real defect, not tracing.
 */
const Forms = (() => {

    // ---------------------------------------------------------------------
    // Form HTML builders — pure, no script.js state
    // ---------------------------------------------------------------------

    function createTaskFormHtml() {
        // Local getters, not toISOString(): UTC formatting shows YESTERDAY's
        // date in positive-offset timezones (latent for CDT; same bug family
        // as the popups.js UTC pre-fill fix — see DECISIONS.md 2026-07-18).
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const todayString = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
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
                    <input type="date" id="modalDueDate" value="${todayString}" required>
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

    // ---------------------------------------------------------------------
    // Modal open + wiring
    // ---------------------------------------------------------------------

    // deps: see attachModalEventListeners below — showFormModal just
    // threads the same deps object through to it.
    function showFormModal(formType, deps) {
        // Close any existing modals first
        Modal.closeModal();

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

        document.body.appendChild(modalElement);

        // Small delay to ensure DOM is updated
        setTimeout(() => {
            attachModalEventListeners(formType, deps);
        }, 50);
    }

    // deps: {
    //   createTaskItemData, addItemToGame, sortAndRenderActiveList,
    //   managementWindows, populateTasksWindow,
    //   createHabitDefinition, populateHabitsWindow,
    //   definedRoutines, saveGame, populateRoutinesWindow, openManagementWindow
    // }
    function attachModalEventListeners(formType, deps) {
        const modal = document.querySelector(`#${formType}FormModal`);

        if (!modal) {
            console.error('Modal not found:', `#${formType}FormModal`);
            return;
        }

        switch (formType) {
            case 'task': {
                const addTaskBtn = modal.querySelector('#modalAddTaskButton');

                if (addTaskBtn) {
                    addTaskBtn.addEventListener('click', () => {
                        const nameInput = modal.querySelector('#modalTaskName');
                        const categoryInput = modal.querySelector('#modalTaskCategory');
                        const priorityInput = modal.querySelector('#modalTaskHighPriority');
                        const dateInput = modal.querySelector('#modalDueDate');
                        const timeInput = modal.querySelector('#modalDueTime');

                        const name = nameInput ? nameInput.value.trim() : '';
                        const category = categoryInput ? categoryInput.value : 'other';
                        const isHighPriority = priorityInput ? priorityInput.checked : false;
                        const dueDate = dateInput ? dateInput.value : '';
                        const dueTime = timeInput ? timeInput.value : '17:00';

                        if (!name || !dueDate) {
                            alert('Task Name and Due Date are required.');
                            return;
                        }

                        const taskData = deps.createTaskItemData(name, category, isHighPriority, dueDate, dueTime);
                        deps.addItemToGame(taskData);
                        deps.sortAndRenderActiveList();
                        Modal.closeModal();

                        // Update tasks window if open
                        setTimeout(() => {
                            if (deps.managementWindows.tasks && !deps.managementWindows.tasks.classList.contains('hidden')) {
                                deps.populateTasksWindow();
                            }
                        }, 100);
                    });
                } else {
                    console.error('Task button not found in modal');
                }
                break;
            }

            case 'habit': {
                const addHabitBtn = modal.querySelector('#modalAddHabitButton');

                if (addHabitBtn) {
                    addHabitBtn.addEventListener('click', () => {
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

                        if (!name) {
                            alert('Habit Name is required.');
                            return;
                        }

                        deps.createHabitDefinition(name, category, frequency, timeOfDay, isNegative);
                        Modal.closeModal();

                        // Update habits window if open
                        setTimeout(() => {
                            if (deps.managementWindows.habits && !deps.managementWindows.habits.classList.contains('hidden')) {
                                deps.populateHabitsWindow();
                            }
                        }, 100);
                    });
                } else {
                    console.error('Habit button not found in modal');
                }
                break;
            }

            case 'routine': {
                const createRoutineBtn = modal.querySelector('#modalCreateRoutineButton');

                if (createRoutineBtn) {
                    createRoutineBtn.addEventListener('click', () => {
                        const nameInput = modal.querySelector('#modalRoutineName');
                        const name = nameInput ? nameInput.value.trim() : '';

                        // Reconciled 2026-07-18 (session 4) to call the canonical
                        // Routines.createRoutineDefinition instead of duplicating
                        // its validation/construction inline — see file header
                        // and DECISIONS.md. Same messages, same routine shape.
                        const result = Routines.createRoutineDefinition(name, deps.definedRoutines);
                        if (!result.ok) {
                            alert(result.reason === 'empty' ? 'Please enter a routine name.' : 'Routine name already exists.');
                            return;
                        }

                        deps.definedRoutines.push(result.routine);
                        deps.saveGame(); // was missing before this session's reconciliation
                        Modal.closeModal();

                        // Update routines window if open
                        setTimeout(() => {
                            if (deps.managementWindows.routines && !deps.managementWindows.routines.classList.contains('hidden')) {
                                deps.populateRoutinesWindow();
                            } else {
                                // Open routine management for the new routine if window was closed
                                deps.openManagementWindow('routines');
                            }
                        }, 100);
                    });
                } else {
                    console.error('Routine button not found in modal');
                }
                break;
            }
        }
    }

    return {
        createTaskFormHtml,
        createHabitFormHtml,
        createRoutineFormHtml,
        showFormModal,
        attachModalEventListeners,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Forms;
}

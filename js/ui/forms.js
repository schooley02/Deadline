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
    // Schedule fields — day-of-week / day-of-month widget shared by every
    // recurring-definition form (session 15, 2026-07-18, see DECISIONS.md).
    // routineViews.js keeps its own copy of these three helpers rather than
    // sharing across files — same "each cluster inlines its own markup"
    // convention the rest of js/ui/ already follows (see this file's header
    // and popups.js/routineViews.js's precedent). Schedule itself stays a
    // pure, DOM-free global (js/schedule.js); these helpers are the DOM glue
    // around it.
    //
    // UI/data-model reconciliation: "Daily" and "Weekly" are cosmetic labels
    // over the SAME daysOfWeek filter (see js/schedule.js header) — the
    // frequency dropdown only meaningfully branches behavior for "Monthly".
    // Selecting Daily auto-checks all 7 boxes (editable, not locked — the
    // user can still hand-pick a subset while "Daily" stays selected, which
    // is functionally identical to Weekly with that subset). Selecting
    // Weekly clears the boxes ONLY if they were all still checked (the
    // untouched "Daily" state) — an explicit pick already in progress is
    // never wiped by a frequency change.
    // ---------------------------------------------------------------------
    const SCHEDULE_DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    function scheduleFieldsHtml(prefix, schedule) {
        const s = schedule || Schedule.defaultSchedule();
        const daysHtml = SCHEDULE_DAY_LABELS.map((label, i) => `
            <label class="day-checkbox">
                <input type="checkbox" id="${prefix}Day${i}" value="${i}" ${s.daysOfWeek.includes(i) ? 'checked' : ''}>
                <span>${label}</span>
            </label>
        `).join('');

        return `
            <div class="form-row">
                <label for="${prefix}Frequency">Frequency:</label>
                <select id="${prefix}Frequency">
                    <option value="daily" ${s.frequency === 'daily' ? 'selected' : ''}>Daily</option>
                    <option value="weekly" ${s.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                    <option value="monthly" ${s.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                </select>
            </div>
            <div class="form-row schedule-days-row" id="${prefix}DaysOfWeekRow" style="${s.frequency === 'monthly' ? 'display:none;' : ''}">
                <label>Repeat on:</label>
                <div class="days-of-week-checkboxes">${daysHtml}</div>
            </div>
            <div class="form-row schedule-month-row" id="${prefix}DayOfMonthRow" style="${s.frequency === 'monthly' ? '' : 'display:none;'}">
                <label for="${prefix}DayOfMonth">Day of Month:</label>
                <input type="number" id="${prefix}DayOfMonth" min="1" max="31" value="${s.dayOfMonth || 1}">
            </div>
        `;
    }

    // Wires the frequency dropdown's show/hide + auto-check behavior. Call
    // once after the form HTML is in the DOM.
    function wireScheduleFieldsToggle(prefix) {
        const freqSelect = document.getElementById(`${prefix}Frequency`);
        const daysRow = document.getElementById(`${prefix}DaysOfWeekRow`);
        const monthRow = document.getElementById(`${prefix}DayOfMonthRow`);
        if (!freqSelect) return;

        freqSelect.addEventListener('change', () => {
            const freq = freqSelect.value;
            if (daysRow) daysRow.style.display = freq === 'monthly' ? 'none' : '';
            if (monthRow) monthRow.style.display = freq === 'monthly' ? '' : 'none';

            if (freq === 'daily') {
                Schedule.ALL_DAYS.forEach(d => {
                    const cb = document.getElementById(`${prefix}Day${d}`);
                    if (cb) cb.checked = true;
                });
            } else if (freq === 'weekly') {
                const allChecked = Schedule.ALL_DAYS.every(d => {
                    const cb = document.getElementById(`${prefix}Day${d}`);
                    return cb && cb.checked;
                });
                if (allChecked) {
                    Schedule.ALL_DAYS.forEach(d => {
                        const cb = document.getElementById(`${prefix}Day${d}`);
                        if (cb) cb.checked = false;
                    });
                }
            }
        });
    }

    // Reads the widget back into a normalized Schedule object on submit.
    function readScheduleFromFields(prefix) {
        const freqSelect = document.getElementById(`${prefix}Frequency`);
        const frequency = freqSelect ? freqSelect.value : 'daily';

        if (frequency === 'monthly') {
            const dayInput = document.getElementById(`${prefix}DayOfMonth`);
            const dayOfMonth = dayInput ? parseInt(dayInput.value, 10) : 1;
            return Schedule.normalize({ frequency: 'monthly', daysOfWeek: [], dayOfMonth });
        }

        const daysOfWeek = Schedule.ALL_DAYS.filter(d => {
            const cb = document.getElementById(`${prefix}Day${d}`);
            return cb && cb.checked;
        });
        return Schedule.normalize({ frequency, daysOfWeek, dayOfMonth: null });
    }

    // ---------------------------------------------------------------------
    // Form HTML builders — pure, no script.js state
    // ---------------------------------------------------------------------

    // Default due time (2026-10-27, Jeremy): the time picker opens on the CURRENT
    // time, so scrolling starts from "now". Supersedes the 2026-07-20 rule
    // (max(5 PM, now + 1h rounded to :30)). Because "now" is already past by the
    // time Add is tapped, resolveSubmittedDueTime() below nudges an untouched or
    // just-passed time NOW_BUMP_MINUTES ahead, so the zombie walks in instead of
    // spawning at the church already attacking (the original 2026-07-20 bug).
    const NOW_BUMP_MINUTES = 5;
    const pad2 = (n) => String(n).padStart(2, '0');
    const localDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const localTimeStr = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

    function computeDefaultDueTime(now) {
        return localTimeStr(now);
    }

    // Pure. Returns { dueDate, dueTime } to hand to createTaskItemData. A due time
    // at or before `now` is bumped to now + NOW_BUMP_MINUTES when the time field
    // was left at its prefilled value OR is less than NOW_BUMP_MINUTES in the past
    // (i.e. "now-ish"). An older past time the user picked on purpose is kept.
    function resolveSubmittedDueTime(dueDate, dueTime, prefilledTime, now) {
        if (!dueDate || !dueTime) return { dueDate, dueTime };
        const due = new Date(`${dueDate}T${dueTime}`);
        if (isNaN(due.getTime())) return { dueDate, dueTime };
        const nowMs = now.getTime();
        const untouched = prefilledTime != null && dueTime === prefilledTime;
        const nowish = due.getTime() > nowMs - NOW_BUMP_MINUTES * 60 * 1000;
        if (due.getTime() <= nowMs && (untouched || nowish)) {
            const bumped = new Date(nowMs + NOW_BUMP_MINUTES * 60 * 1000);
            return { dueDate: localDateStr(bumped), dueTime: localTimeStr(bumped) };
        }
        return { dueDate, dueTime };
    }

    function createTaskFormHtml() {
        // Local getters, not toISOString(): UTC formatting shows YESTERDAY's
        // date in positive-offset timezones (latent for CDT; same bug family
        // as the popups.js UTC pre-fill fix — see DECISIONS.md 2026-07-18).
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const todayString = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const defaultDueTime = computeDefaultDueTime(now);
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
                    <input type="time" id="modalDueTime" value="${defaultDueTime}" data-prefilled="${defaultDueTime}">
                </div>
            </div>
            <div class="form-row">
                <label for="modalTimerMinutes">Timer target (min, optional):</label>
                <input type="number" id="modalTimerMinutes" min="1" max="600" step="1" inputmode="numeric" placeholder="e.g. 30">
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
            ${scheduleFieldsHtml('modalHabit', Schedule.defaultSchedule())}
            <div class="form-row">
                <label for="modalHabitTimeOfDay">Completion Window:</label>
                <select id="modalHabitTimeOfDay">
                    <option value="anytime">Anytime Today</option>
                    <option value="morning">Morning (by 12 PM)</option>
                    <option value="afternoon">Afternoon (by 5 PM)</option>
                    <option value="evening">Evening (by 10 PM)</option>
                </select>
            </div>
            <div class="form-row">
                <label for="modalHabitTimerMinutes">Timer (minutes, optional):</label>
                <input type="number" id="modalHabitTimerMinutes" min="1" max="600" step="1" inputmode="numeric" placeholder="e.g. 30">
                <small class="form-hint">Negative habit: a limit &mdash; start the timer and stop before it runs out to count as avoided. Positive habit: a work goal that completes it.</small>
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
            <div class="form-row">
                <label for="modalRoutineHeroCategory">Hero type:</label>
                <select id="modalRoutineHeroCategory">${HeroesView.heroCategoryOptionsHtml('other', CONFIG)}</select>
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

        const html = `
            <div class="modal-overlay" id="${formType}FormModal">
                <div class="modal-content">
                    ${formHtml}
                </div>
            </div>
        `;

        // [P2-UI-011] Stage 2 sub-session 4: migrated onto Modal.open() and
        // dropped the setTimeout(50) defer. Fork 3 in docs/MODAL_STAGE2_PLAN.md
        // found no technical reason for the delay (createElement/appendChild
        // is synchronous, same as insertAdjacentHTML; modalSlideIn is pure CSS
        // with no JS coordination requirement) — live-verified synchronous
        // wiring works identically. See DECISIONS.md.
        Modal.open(html);

        attachModalEventListeners(formType, deps);
        if (formType === 'habit') {
            wireScheduleFieldsToggle('modalHabit');
            Modal.wireHabitTimeLabels('modalHabitType', 'modalHabitTimeOfDay');
        }
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

                        const resolved = resolveSubmittedDueTime(dueDate, dueTime,
                            timeInput ? timeInput.getAttribute('data-prefilled') : null, new Date());
                        const taskData = deps.createTaskItemData(name, category, isHighPriority, resolved.dueDate, resolved.dueTime);
                        const targetInput = modal.querySelector('#modalTimerMinutes');
                        const targetMin = targetInput ? Math.floor(Number(targetInput.value)) : NaN;
                        taskData.timerMinutes = (targetMin >= 1 && targetMin <= 600) ? targetMin : null;
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
                        const timeOfDayInput = modal.querySelector('#modalHabitTimeOfDay');
                        const typeRadio = modal.querySelector('input[name="modalHabitType"]:checked');

                        const name = nameInput ? nameInput.value.trim() : '';
                        const category = categoryInput ? categoryInput.value : 'health';
                        const schedule = readScheduleFromFields('modalHabit');
                        const timeOfDay = timeOfDayInput ? timeOfDayInput.value : 'anytime';
                        const isNegative = typeRadio ? typeRadio.value === 'negative' : false;

                        if (!name) {
                            alert('Habit Name is required.');
                            return;
                        }
                        if (schedule.frequency !== 'monthly' && schedule.daysOfWeek.length === 0) {
                            alert('Please select at least one day.');
                            return;
                        }

                        const habitTimerInput = modal.querySelector('#modalHabitTimerMinutes');
                        const habitTimerMinutes = habitTimerInput ? Timer.normalizeTarget(habitTimerInput.value) : null;
                        deps.createHabitDefinition(name, category, schedule, timeOfDay, isNegative, habitTimerMinutes);
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
                        const heroSelect = modal.querySelector('#modalRoutineHeroCategory');
                        const result = Routines.createRoutineDefinition(name, deps.definedRoutines, heroSelect ? heroSelect.value : 'other');
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
        computeDefaultDueTime,
        resolveSubmittedDueTime,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Forms;
}

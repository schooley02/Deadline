/**
 * Routine views — cluster F, both parts (Milestone 2 UI extraction,
 * sessions 8-9, 2026-07-18).
 *
 * Part 1 (session 8, rendering half): `renderDefinedRoutines`,
 * `showRoutineManagement`, `populateRoutineHabits`, `populateRoutineTasks`,
 * `updateRoutineDisplay`.
 *
 * PLAN CORRECTION: the plan's session-8 row also lists `populateRoutinesWindow`,
 * but that function was already extracted into js/ui/managementWindows.js
 * during session 3 (cluster E) — script.js's `populateRoutinesWindow` is
 * already a thin wrapper over `ManagementWindows.populateRoutinesWindow`.
 * There was nothing left to move for it here; the plan's function inventory
 * (written before session 3 ran) was never updated. See DECISIONS.md.
 *
 * Part 2 (session 9, form half): `showCreateHabitForm`, `showCreateTaskForm`,
 * `showEditHabitForm`, `showEditTaskForm`, `showAddItemToRoutineModal`,
 * `attachRoutineManagementListeners`, `populateHabitSelectDropdown`, and
 * `saveNewHabit`/`saveNewTask`/`saveEditedHabit`/`saveEditedTask` (script.js
 * keeps the `window.save*` global names as thin wrappers, since inline
 * `onclick="saveNewHabit(...)"` strings in the create/edit form HTML need
 * the window-level names — see js/ui/modal.js's `window.*` exposure note).
 * These were part 1's plain-function-reference deps (`showEditHabitForm`,
 * `showCreateHabitForm`, `showEditTaskForm`, `showCreateTaskForm`,
 * `populateHabitSelectDropdown`, `attachRoutineManagementListeners`) — now
 * module-internal calls instead, so `routineViewsDeps()` in script.js drops
 * them.
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
 * `activeItems` (needed by `saveEditedHabit`, part 2) is likewise a plain
 * reference, not a getter — matching agendaListDeps()'s established
 * precedent that `activeItems` is a "stable binding" despite being
 * reassigned on new-game reset (see script.js comment above
 * `agendaListDeps()`). `Modal.closeModal()` is called as a bare stable
 * global throughout part 2, matching popups.js/forms.js convention (Modal
 * is a fully-extracted module guaranteed loaded first) — no dep needed.
 */
const RoutineViews = (() => {

    // ---------------------------------------------------------------------
    // Schedule fields — day-of-week / day-of-month widget shared by all four
    // recurring-definition forms below (session 15, 2026-07-18, see
    // DECISIONS.md). Duplicates js/ui/forms.js's copy of the same three
    // helpers rather than sharing across files — the established convention
    // for this codebase's js/ui/ clusters (see forms.js's header). Schedule
    // itself (js/schedule.js) stays a pure, DOM-free global; these are the
    // DOM glue around it.
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
     *         toggleRoutineActive, deleteRoutine,
     *         removeHabitFromRoutine, addHabitToRoutine,
     *         removeTaskFromRoutine }
     * showEditHabitForm/showCreateHabitForm/showEditTaskForm/
     * showCreateTaskForm/populateHabitSelectDropdown are module-internal
     * calls as of session 9 (part 2) — no longer deps.
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
                        editHabitBtn.addEventListener('click', () => showEditHabitForm(routine.id, habitDef));

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
            populateHabitSelectDropdown(habitSelect, { definedHabits: deps.definedHabits });

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
                        editTaskBtn.addEventListener('click', () => showEditTaskForm(routine.id, taskDef));

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
            addNewTaskBtn.addEventListener('click', () => showCreateTaskForm(routine.id));

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
     * deps: { definedRoutines (getter), definedHabits (getter), deleteRoutine }
     * plus everything attachRoutineManagementListeners needs (session 9,
     * part 2) — this function forwards the whole deps object along, since
     * it doesn't itself need to distinguish which keys belong to which
     * downstream call.
     */
    // Sub-session 3 ("Frozen routine slots" UI, 2026-07-19). Returns '' when
    // the routine isn't frozen (nothing to render). When frozen, looks up the
    // offending habit by routine.frozenState.frozenBy — it's expected to
    // exist (only a live, defined negative habit can freeze a routine), but
    // this defensively falls back to a generic message if it's somehow gone
    // (e.g. deleted after freezing it — not currently possible via any UI
    // path, but cheap to guard). FrozenSlots/CONFIG read as bare globals,
    // same convention as Modal/Routines elsewhere in this file.
    function buildFrozenBannerHtml(routine, definedHabits) {
        if (!routine.frozenState) return '';

        const offendingHabit = (definedHabits || []).find(h => h.id === routine.frozenState.frozenBy);
        if (!offendingHabit) {
            return `
                <div class="routine-frozen-banner">
                    <p>🥶 <strong>This routine is frozen.</strong> Its other habits and tasks won't
                       spawn until it recovers.</p>
                </div>
            `;
        }

        const progress = FrozenSlots.avoidanceProgress(offendingHabit.occurrenceHistory, CONFIG.RECOVERY_AVOIDED_DAYS);

        return `
            <div class="routine-frozen-banner">
                <p>🥶 <strong>This routine is frozen</strong> — "${offendingHabit.name}" has been
                   indulged 3 days in a row. Its other habits and tasks won't spawn until it
                   recovers. This isn't a punishment, just a signal something about this habit
                   might be worth adjusting.</p>
                <p class="routine-frozen-progress">Recovery progress: ${progress}/${CONFIG.RECOVERY_AVOIDED_DAYS} days
                   successfully avoided (resets on a lapse) — or edit "${offendingHabit.name}"'s
                   details below to unfreeze it right away.</p>
            </div>
        `;
    }

    // KO gating explanation for the Manage modal's status row ([P1-UI-006]
    // sub-session 4, 2026-07-19) — extends the plain Active/Inactive status
    // sub-session 1-3 left unchanged with the same KO vocabulary
    // managementWindows.js's compact card already uses (revivable computed
    // the same way: DayRollover.hasDayRolledOver against routine.koState.koAt).
    // Frozen status is explained in detail by the banner above this row
    // (buildFrozenBannerHtml); this row just needs to not silently say
    // "Inactive" for a frozen or KO'd routine. The toggle button itself
    // always calls deps.toggleRoutineActive, which already enforces the KO
    // gate server-side (Routines.toggleRoutineActive) — this only makes the
    // button's label/disabled state agree with what clicking it would do,
    // same precedent as managementWindows.js's toggleDisabled.
    function buildStatusRowHtml(routine) {
        const isKod = !!routine.koState;
        const isFrozen = !!routine.frozenState;
        const revivable = isKod && DayRollover.hasDayRolledOver(new Date(routine.koState.koAt), new Date());
        const statusLabel = isKod
            ? (revivable ? '💤 Knocked out — ready to revive' : '💤 Knocked out — revives tomorrow')
            : (isFrozen ? '🥶 Frozen (see below)' : (routine.isActive ? '🟢 Active' : '⚪ Inactive'));
        const toggleLabel = isKod ? 'Revive' : (routine.isActive ? 'Deactivate' : 'Activate');
        const toggleDisabled = isKod && !revivable;

        return `
            <div style="margin-bottom: 20px; padding: 12px; background: var(--color-bg-light); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>Status: ${statusLabel}</span>
                    <button id="toggleRoutineStatus" class="secondary-button" ${toggleDisabled ? 'disabled title="Revives tomorrow"' : ''} style="padding: 6px 12px; ${toggleDisabled ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                        ${toggleLabel}
                    </button>
                </div>
            </div>
        `;
    }

    // Hero stats block ([P1-UI-006] sub-session 4, 2026-07-19) — level, XP
    // progress, star rating, health, and current slot usage (capacity +
    // banked points). Reuses HeroesView.buildChipViewModel (the same pure
    // view model the base chip renders from, js/ui/heroes.js) rather than
    // recomputing xp/star/health math here, and Heroes.slotCapacity/
    // availableSlotPoints for the slot line (js/heroes.js sub-session 4
    // core). `runStartedAtMs` may be omitted by older callers/tests — treated
    // as 0 (matches HeroesView.buildChipViewModel's own default handling).
    function buildHeroStatsHtml(routine, definedHabits, runStartedAtMs) {
        const vm = HeroesView.buildChipViewModel(routine, definedHabits, CONFIG, runStartedAtMs);
        const xpLabel = vm.xpForNext === null
            ? `${vm.xp} XP (max level)`
            : `${vm.xp} / ${vm.xpForNext} XP to Lv${vm.level + 1}`;

        const habitCapacity = Heroes.slotCapacity(routine, 'habit', CONFIG);
        const taskCapacity = Heroes.slotCapacity(routine, 'task', CONFIG);
        const habitUsed = (routine.habitDefinitionIds || []).length;
        const taskUsed = (routine.taskDefinitionIds || []).length;
        const availablePoints = Heroes.availableSlotPoints(routine, CONFIG);
        const pointsNote = availablePoints > 0
            ? ` · ${availablePoints} slot point${availablePoints === 1 ? '' : 's'} available`
            : '';

        return `
            <div style="margin-bottom: 20px; padding: 12px; background: var(--color-bg-light); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong>Lv${vm.level} Hero</strong>
                    <span title="Completion rate over recorded habit occurrences">${HeroesView.starsHtml(vm.stars)}</span>
                </div>
                <div style="font-size: 12px; color: var(--color-neutral); margin-bottom: 6px;">${xpLabel}</div>
                <div style="height: 8px; border-radius: 4px; background: var(--color-bg); overflow: hidden; margin-bottom: 10px;">
                    <div style="height: 100%; width: ${Math.round(vm.healthPct * 100)}%; background: ${HeroesView.healthColorVar(vm.healthPct)};"></div>
                </div>
                <div style="font-size: 12px; color: var(--color-neutral);">
                    ❤ ${vm.health}/${CONFIG.ROUTINE_MAX_HEALTH} &nbsp;·&nbsp; Habit slots: ${habitUsed}/${habitCapacity} &nbsp;·&nbsp; Task slots: ${taskUsed}/${taskCapacity}${pointsNote}
                </div>
            </div>
        `;
    }

    /**
     * deps: { definedRoutines (getter), definedHabits (getter),
     *         runStartedAtMs } plus everything attachRoutineManagementListeners
     *         needs (see that function's own deps note).
     */
    function showRoutineManagement(routineId, deps) {
        const routine = deps.definedRoutines().find(r => r.id === routineId);
        if (!routine) return;

        // Sub-session 3 ("Frozen routine slots" UI, 2026-07-19): the detailed
        // frozen explanation lives here (not the compact card in
        // managementWindows.js) — it needs the offending habit's name +
        // live avoidance progress, and this modal already receives
        // deps.definedHabits(). Non-judgmental tone per PROJECT_SPEC ~2696;
        // both recovery paths (ROUTINES.md) are spelled out. `avoidanceProgress`
        // recomputes from occurrenceHistory on demand — nothing new is stored.
        const frozenBannerHtml = buildFrozenBannerHtml(routine, deps.definedHabits());

        const modalHtml = `
            <div class="modal-overlay" id="routineManagementModal">
                <div class="modal-content" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
                    <h3>Manage Routine: ${routine.name}</h3>

                    ${frozenBannerHtml}

                    ${buildStatusRowHtml(routine)}

                    ${buildHeroStatsHtml(routine, deps.definedHabits(), deps.runStartedAtMs)}

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

        // Attach event listeners — module-internal as of session 9 (part 2)
        attachRoutineManagementListeners(routine.id, deps);
    }

    // -------------------------------------------------------------------
    // Part 2 (session 9, form half of cluster F)
    // -------------------------------------------------------------------

    /**
     * deps: { definedRoutines (getter), definedHabits (getter),
     *         toggleRoutineActive, managementWindows, populateRoutinesWindow,
     *         removeHabitFromRoutine, removeTaskFromRoutine }
     * definedTasks read as bare window global. Modal.closeModal() called as
     * a bare stable global. showAddItemToRoutineModal/showEditHabitForm/
     * showEditTaskForm are module-internal calls.
     */
    function attachRoutineManagementListeners(routineId, deps) {
        const routine = deps.definedRoutines().find(r => r.id === routineId);
        if (!routine) return;

        // Toggle routine status
        const toggleBtn = document.getElementById('toggleRoutineStatus');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                deps.toggleRoutineActive(routineId);
                Modal.closeModal();
                // Refresh routines window
                setTimeout(() => {
                    if (deps.managementWindows.routines && !deps.managementWindows.routines.classList.contains('hidden')) {
                        deps.populateRoutinesWindow();
                    }
                }, 100);
            });
        }

        // Add habit button
        const addHabitBtn = document.getElementById('addHabitToRoutine');
        if (addHabitBtn) {
            addHabitBtn.addEventListener('click', () => {
                showAddItemToRoutineModal(routineId, 'habit', deps);
            });
        }

        // Add task button
        const addTaskBtn = document.getElementById('addTaskToRoutine');
        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => {
                showAddItemToRoutineModal(routineId, 'task', deps);
            });
        }

        // Remove habit buttons
        document.querySelectorAll('.remove-habit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const habitId = e.target.dataset.habitId;
                deps.removeHabitFromRoutine(routineId, habitId);
                populateRoutineHabits(routine, { definedHabits: deps.definedHabits });
            });
        });

        // Remove task buttons
        document.querySelectorAll('.remove-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.dataset.taskId;
                deps.removeTaskFromRoutine(routineId, taskId);
                populateRoutineTasks(routine);
            });
        });

        // Edit habit buttons
        document.querySelectorAll('.edit-habit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const habitId = e.target.dataset.habitId;
                const habit = deps.definedHabits().find(h => h.id === habitId);
                if (habit) {
                    showEditHabitForm(routineId, habit);
                }
            });
        });

        // Edit task buttons
        document.querySelectorAll('.edit-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.dataset.taskId;
                if (!window.definedTasks) window.definedTasks = [];
                const task = window.definedTasks.find(t => t.id === taskId);
                if (task) {
                    showEditTaskForm(routineId, task);
                }
            });
        });
    }

    /**
     * deps: { definedHabits (getter) }
     */
    function populateHabitSelectDropdown(selectElement, deps) {
        selectElement.innerHTML = '<option value="">-- Select Habit --</option>';

        const definedHabits = deps.definedHabits();

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

    // ---------------------------------------------------------------------
    // Slot enforcement — BANKED SLOT POINTS ([P1-UI-006] sub-session 4,
    // 2026-07-19; forks resolved post-session-43, see DECISIONS.md/
    // HEROES_PLAN.md). Shared by all three add-to-routine flows below
    // (existing-item "Add Selected", Create New Habit, Create New Task).
    //
    // Returns true if the caller should proceed with the add. When the
    // routine is at capacity and the player has a banked point, a confirm()
    // prompt offers to spend one to unlock another slot (matching this
    // codebase's existing confirm()/alert() convention — e.g.
    // Routines.toggleRoutineActive's slot-limit alert) — accepting spends
    // the point (mutates the routine + saves) and returns true; declining,
    // or having zero points available, returns false without mutating
    // anything. CONFIG/Heroes read as bare stable globals, matching this
    // file's existing convention (buildFrozenBannerHtml's FrozenSlots/CONFIG
    // usage).
    // deps: { saveGame }
    function ensureRoutineSlotAvailable(routine, itemType, deps) {
        const label = itemType === 'task' ? 'task' : 'habit';
        const used = itemType === 'task'
            ? (routine.taskDefinitionIds || []).length
            : (routine.habitDefinitionIds || []).length;
        const capacity = Heroes.slotCapacity(routine, itemType, CONFIG);

        if (used < capacity) return true;

        const available = Heroes.availableSlotPoints(routine, CONFIG);
        if (available <= 0) {
            alert(`"${routine.name}" is at its ${label} slot limit (${capacity}). Level up this routine to earn a slot point.`);
            return false;
        }

        const wantsToSpend = confirm(
            `"${routine.name}" is at its ${label} slot limit (${capacity}). Spend 1 slot point to unlock another ${label} slot? (${available} available)`
        );
        if (!wantsToSpend) return false;

        const result = Heroes.spendSlotPoint(routine, itemType, CONFIG);
        if (!result.ok) return false; // shouldn't happen — availableSlotPoints just confirmed > 0

        routine.boughtHabitSlots = result.boughtHabitSlots;
        routine.boughtTaskSlots = result.boughtTaskSlots;
        deps.saveGame();
        return true;
    }

    /**
     * deps: { definedRoutines (getter), definedHabits (getter), saveGame }
     * plus everything showRoutineManagement needs, since the "Add Selected"
     * handler re-opens it. definedTasks read as bare window global.
     * Modal.closeModal() called as a bare stable global.
     * showRoutineManagement/showCreateHabitForm/showCreateTaskForm are
     * module-internal calls.
     */
    function showAddItemToRoutineModal(routineId, itemType, deps) {
        const routine = deps.definedRoutines().find(r => r.id === routineId);
        if (!routine) return;

        let optionsHtml = '';
        let existingIds = [];

        if (itemType === 'habit') {
            existingIds = routine.habitDefinitionIds || [];
            optionsHtml = deps.definedHabits()
                .filter(habit => !existingIds.includes(habit.id))
                .map(habit => {
                    const icon = habit.isNegative ? '🚫' : '✅';
                    return `<option value="${habit.id}">${habit.name} (${habit.category}) ${icon}</option>`;
                })
                .join('');
        } else if (itemType === 'task') {
            if (!window.definedTasks) window.definedTasks = [];
            existingIds = routine.taskDefinitionIds || [];
            optionsHtml = window.definedTasks
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
                    if (!ensureRoutineSlotAvailable(routine, itemType, deps)) return;

                    if (itemType === 'habit') {
                        if (!routine.habitDefinitionIds) routine.habitDefinitionIds = [];
                        routine.habitDefinitionIds.push(selectedId);
                        // Transfer ownership so the habit is gated on this
                        // routine's isActive rather than spawning standalone.
                        // (This modal duplicates Routines.addHabitToRoutine
                        // rather than calling it — flagged for the session-4
                        // UI extraction, which reconciles these duplicates.)
                        const adoptedHabit = deps.definedHabits().find(h => h.id === selectedId);
                        if (adoptedHabit) adoptedHabit.routineId = routine.id;
                    } else {
                        if (!routine.taskDefinitionIds) routine.taskDefinitionIds = [];
                        routine.taskDefinitionIds.push(selectedId);
                    }
                    deps.saveGame();
                    Modal.closeModal();
                    // Refresh the routine management modal
                    setTimeout(() => {
                        showRoutineManagement(routineId, deps);
                    }, 100);
                } else {
                    alert(`Please select a ${itemType} to add.`);
                }
            });
        }

        if (createBtn) {
            createBtn.addEventListener('click', () => {
                Modal.closeModal();
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

    // No deps — pure HTML-string builder; the inline
    // onclick="saveNewHabit(...)" reaches the window-level global (script.js
    // thin wrapper), same as every other inline onclick in this project.
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
                    ${scheduleFieldsHtml('newHabit', Schedule.defaultSchedule())}
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
        wireScheduleFieldsToggle('newHabit');
    }

    // No deps — pure HTML-string builder (see showCreateHabitForm note).
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
                    ${scheduleFieldsHtml('newTask', Schedule.defaultSchedule())}
                    <div class="modal-buttons">
                        <button class="primary-button" onclick="saveNewTask('${routineId}')">Create Task</button>
                        <button class="secondary-button" onclick="closeModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', formHtml);
        wireScheduleFieldsToggle('newTask');
    }

    // No deps — pure HTML-string builder (see showCreateHabitForm note).
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
                    ${scheduleFieldsHtml('editHabit', habitDef.schedule ? Schedule.normalize(habitDef.schedule) : Schedule.fromLegacyFrequency(habitDef.frequency))}
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
        wireScheduleFieldsToggle('editHabit');
    }

    // No deps — pure HTML-string builder (see showCreateHabitForm note).
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
                    ${scheduleFieldsHtml('editTask', taskDef.schedule ? Schedule.normalize(taskDef.schedule) : Schedule.defaultSchedule())}
                    <div class="modal-buttons">
                        <button class="primary-button" onclick="saveEditedTask('${taskDef.id}')">Save Changes</button>
                        <button class="secondary-button" onclick="closeModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', formHtml);
        wireScheduleFieldsToggle('editTask');
    }

    /**
     * deps: { definedRoutines (getter), createNewHabitInRoutine, saveGame }
     * Called by script.js's window.saveNewHabit thin wrapper (inline
     * onclick="saveNewHabit(...)" needs the window-level name).
     */
    function saveNewHabit(routineId, deps) {
        const name = document.getElementById('newHabitName').value.trim();
        const category = document.getElementById('newHabitCategory').value;
        const schedule = readScheduleFromFields('newHabit');
        const timeOfDay = document.getElementById('newHabitTimeOfDay').value;
        const isNegative = document.querySelector('input[name="habitType"]:checked').value === 'negative';

        if (!name) {
            alert('Please enter a habit name.');
            return;
        }
        if (schedule.frequency !== 'monthly' && schedule.daysOfWeek.length === 0) {
            alert('Please select at least one day.');
            return;
        }

        const routine = deps.definedRoutines().find(r => r.id === routineId);
        if (routine && !ensureRoutineSlotAvailable(routine, 'habit', deps)) return;

        deps.createNewHabitInRoutine(routineId, { name, category, schedule, timeOfDay, isNegative });
        Modal.closeModal();
    }

    /**
     * deps: { definedRoutines (getter), createNewTaskInRoutine, saveGame }
     */
    function saveNewTask(routineId, deps) {
        const name = document.getElementById('newTaskName').value.trim();
        const category = document.getElementById('newTaskCategory').value;
        const defaultDueTime = document.getElementById('newTaskDueTime').value;
        const isHighPriority = document.getElementById('newTaskHighPriority').checked;
        const schedule = readScheduleFromFields('newTask');

        if (!name) {
            alert('Please enter a task name.');
            return;
        }
        if (schedule.frequency !== 'monthly' && schedule.daysOfWeek.length === 0) {
            alert('Please select at least one day.');
            return;
        }

        const routine = deps.definedRoutines().find(r => r.id === routineId);
        if (routine && !ensureRoutineSlotAvailable(routine, 'task', deps)) return;

        deps.createNewTaskInRoutine(routineId, { name, category, defaultDueTime, isHighPriority, schedule });
        Modal.closeModal();
    }

    /**
     * deps: { editHabitInRoutine, activeItems (plain reference — see header
     *         note), createListItem, sortAndRenderActiveList, saveGame }
     */
    function saveEditedHabit(habitId, deps) {
        const name = document.getElementById('editHabitName').value.trim();
        const category = document.getElementById('editHabitCategory').value;
        const schedule = readScheduleFromFields('editHabit');
        const timeOfDay = document.getElementById('editHabitTimeOfDay').value;
        const isNegative = document.querySelector('input[name="editHabitType"]:checked').value === 'negative';

        if (!name) {
            alert('Please enter a habit name.');
            return;
        }
        if (schedule.frequency !== 'monthly' && schedule.daysOfWeek.length === 0) {
            alert('Please select at least one day.');
            return;
        }

        deps.editHabitInRoutine(habitId, { name, category, schedule, timeOfDay, isNegative });

        // Keep any already-spawned instance of this habit in sync, so editing
        // from today's agenda row (or anywhere else) doesn't go stale until
        // the next day's instance regenerates. Deliberately does NOT touch
        // frequency/timeOfDay for an already-spawned instance — recomputing
        // today's due time retroactively is a separate, more involved
        // follow-up (see docs/DECISIONS.md).
        deps.activeItems.forEach(item => {
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
                    deps.createListItem(item);
                }
            }
        });
        deps.sortAndRenderActiveList();
        deps.saveGame();

        Modal.closeModal();
    }

    /**
     * deps: { editTaskInRoutine }
     */
    function saveEditedTask(taskId, deps) {
        const name = document.getElementById('editTaskName').value.trim();
        const category = document.getElementById('editTaskCategory').value;
        const defaultDueTime = document.getElementById('editTaskDueTime').value;
        const isHighPriority = document.getElementById('editTaskHighPriority').checked;
        const schedule = readScheduleFromFields('editTask');

        if (!name) {
            alert('Please enter a task name.');
            return;
        }
        if (schedule.frequency !== 'monthly' && schedule.daysOfWeek.length === 0) {
            alert('Please select at least one day.');
            return;
        }

        deps.editTaskInRoutine(taskId, { name, category, defaultDueTime, isHighPriority, schedule });
        Modal.closeModal();
    }

    return {
        updateRoutineDisplay,
        populateRoutineHabits,
        populateRoutineTasks,
        renderDefinedRoutines,
        buildFrozenBannerHtml,
        buildStatusRowHtml,
        buildHeroStatsHtml,
        ensureRoutineSlotAvailable,
        showRoutineManagement,
        attachRoutineManagementListeners,
        populateHabitSelectDropdown,
        showAddItemToRoutineModal,
        showCreateHabitForm,
        showCreateTaskForm,
        showEditHabitForm,
        showEditTaskForm,
        saveNewHabit,
        saveNewTask,
        saveEditedHabit,
        saveEditedTask
    };
})();

// Node/Jest interop — the browser gets the bare global above.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutineViews;
}

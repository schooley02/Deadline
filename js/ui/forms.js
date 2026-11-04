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
    // time + 5 minutes, so scrolling starts from "now". Supersedes the 2026-07-20 rule
    // (max(5 PM, now + 1h rounded to :30)). Because "now" is already past by the
    // time Add is tapped, resolveSubmittedDueTime() below nudges an untouched or
    // just-passed time NOW_BUMP_MINUTES ahead, so the zombie walks in instead of
    // spawning at the church already attacking (the original 2026-07-20 bug).
    const NOW_BUMP_MINUTES = 5;
    const pad2 = (n) => String(n).padStart(2, '0');
    const localDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const localTimeStr = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

    // Default window (2026-11-01, Jeremy): a new Task / Build habit opens with Start = the
    // CURRENT time and Due = one hour later. Due is capped at 23:59 today so the window never
    // spills into tomorrow; if that leaves no room (start >= due) Start is left blank.
    // This supersedes the 2026-10-27 "due = now + 5 min" default (NOW_BUMP_MINUTES still backs
    // resolveSubmittedDueTime for a due time that is untouched or just passed).
    const DEFAULT_WINDOW_MINUTES = 60;
    function computeDefaultWindow(now) {
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0);
        const plus = new Date(now.getTime() + DEFAULT_WINDOW_MINUTES * 60 * 1000);
        const due = plus.getTime() > endOfDay.getTime() ? endOfDay : plus;
        const startStr = localTimeStr(now);
        const dueStr = localTimeStr(due);
        return { date: localDateStr(now), start: startStr < dueStr ? startStr : '', due: dueStr };
    }
    function computeDefaultDueTime(now) {
        return computeDefaultWindow(now).due;
    }
    function computeDefaultDueDate(now) {
        return computeDefaultWindow(now).date;
    }

    // Optional START time (2026-11-01, Jeremy): a "Start | Due" pair of time boxes. Start sits to
    // the LEFT of Due, is optional (blank = none), and is a time of day on the due date. Shared by
    // the Add / Edit / Add Sub-task / routine-task forms. o = { startId, dueId, startValue,
    // dueValue, dueAttrs, startAttrs, startLabel, dueLabel }.
    function startDueTimeGroupHtml(o) {
        return `<div class="form-row-group time-pair${o.groupClass ? ' ' + o.groupClass : ''}"${o.groupAttrs ? ' ' + o.groupAttrs : ''}>
                <div class="form-row">
                    <label for="${o.startId}">${o.startLabel || 'Start Time (optional):'}</label>
                    <input type="time" id="${o.startId}" value="${o.startValue || ''}"${o.startAttrs ? ' ' + o.startAttrs : ''}>
                </div>
                <div class="form-row">
                    <label for="${o.dueId}">${o.dueLabel || 'Due Time:'}</label>
                    <input type="time" id="${o.dueId}" value="${o.dueValue || ''}"${o.dueAttrs ? ' ' + o.dueAttrs : ''}>
                </div>
            </div>`;
    }

    // Start moves Due with it (2026-11-01, Jeremy): when the player changes a Start time that already had a value,
    // the Due time moves by the same number of minutes. Due stays an ordinary editable box, so the player can
    // still override it before saving. No shift when Start was blank before (adding one) or is cleared, or when Due
    // is blank. A time of day cannot cross midnight, so the result is held to 00:00..23:59. Returns the new "HH:MM"
    // Due, or null for "leave Due alone".
    function shiftDueForStart(prevStart, newStart, due) {
        const toMin = (t) => {
            const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
            return m ? Number(m[1]) * 60 + Number(m[2]) : null;
        };
        const p = toMin(prevStart), n = toMin(newStart), d = toMin(due);
        if (p === null || n === null || d === null || p === n) return null;
        const moved = Math.min(23 * 60 + 59, Math.max(0, d + (n - p)));
        const pad = (x) => String(x).padStart(2, '0');
        return `${pad(Math.floor(moved / 60))}:${pad(moved % 60)}`;
    }

    // Start input id -> its Due input id, for every Start | Due pair (task forms, sub-task, routine task, habit custom times).
    const START_DUE_PAIRS = {
        modalStartTime: 'modalDueTime', editStartTime: 'editDueTime', subTaskStartTime: 'subTaskDueTime',
        newTaskStartTime: 'newTaskDueTime', editTaskStartTime: 'editTaskDueTime',
        modalHabitStartTime: 'modalHabitEndTime', newHabitStartTime: 'newHabitEndTime', editHabitStartTime: 'editHabitEndTime',
    };
    // Adding a Start to a SUB-TASK sets its Due to one hour later (2026-11-04, Jeremy). Only for the Start boxes listed
    // here; the other forms keep "no shift when a Start is first added". The result is held to 23:59 and, when the
    // sub-task's Due Date is its parent's date, to the parent's due time (a sub-task can't be due after its parent; the
    // Start input carries `data-cap-date` / `data-cap-time` and `dateId` names the Due Date box). If the cap leaves
    // Due at or before Start, Due is left alone. Due stays an ordinary box, so the player overrides it by typing.
    const AUTO_DUE_ON_ADD_MINUTES = 60;
    const AUTO_DUE_ON_ADD = { subTaskStartTime: { dateId: 'subTaskDueDate' } };
    function autoDueForNewStart(prevStart, newStart, capTime) {
        const toMin = (t) => {
            const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
            return m ? Number(m[1]) * 60 + Number(m[2]) : null;
        };
        if (toMin(prevStart) !== null) return null;          // only the first time a Start is added
        const s = toMin(newStart);
        if (s === null) return null;                          // cleared
        let due = Math.min(23 * 60 + 59, s + AUTO_DUE_ON_ADD_MINUTES);
        const cap = toMin(capTime);
        if (cap !== null) due = Math.min(due, cap);
        if (due <= s) return null;
        const pad = (x) => String(x).padStart(2, '0');
        return `${pad(Math.floor(due / 60))}:${pad(due % 60)}`;
    }

    // One document-level listener covers every form, however and whenever its modal is built. `defaultValue` is the
    // value the form opened with; after each change `data-prev-start` holds the last value.
    function onStartTimeChange(e) {
        const el = e.target;
        // A Due box the player edited himself (sub-task form) is never auto-set when a Start is added afterwards.
        if (el && el.id && Object.keys(AUTO_DUE_ON_ADD).some((startId) => START_DUE_PAIRS[startId] === el.id)) {
            el.dataset.userSet = '1';
            return;
        }
        const dueId = el && START_DUE_PAIRS[el.id];
        if (!dueId) return;
        const due = document.getElementById(dueId);
        const prev = el.dataset.prevStart !== undefined ? el.dataset.prevStart : el.defaultValue;
        el.dataset.prevStart = el.value;
        if (!due) return;
        const auto = AUTO_DUE_ON_ADD[el.id];
        if (auto && !/^\d{1,2}:\d{2}$/.test(prev || '')) {
            if (due.dataset.userSet === '1') return;
            const dateEl = document.getElementById(auto.dateId);
            const capped = el.dataset.capTime && (!dateEl || dateEl.value === el.dataset.capDate);
            const nextAuto = autoDueForNewStart(prev, el.value, capped ? el.dataset.capTime : null);
            if (nextAuto !== null) due.value = nextAuto;
            return;
        }
        const next = shiftDueForStart(prev, el.value, due.value);
        if (next !== null) due.value = next;
    }
    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('change', onStartTimeChange);
    }

    // "Anytime" checkbox (2026-11-02, Jeremy; DECISIONS 2026-11-02 night): a task due by 11:59 PM on its date. Shared by
    // Add Task and Edit Task (never sub-tasks or routine tasks). Checked: the Due Time box shows 23:59 and is greyed
    // out, the Start box is hidden and emptied. Unchecked: Due Time is editable again (it keeps 23:59; no memory of an
    // older time) and Start comes back. Ids: checkbox -> { due, start } input ids.
    const ANYTIME_DUE_TIME = '23:59';
    const ANYTIME_TOGGLES = {
        modalTaskAnytime: { due: 'modalDueTime', start: 'modalStartTime' },
        editTaskAnytime: { due: 'editDueTime', start: 'editStartTime' },
    };
    function anytimeRowHtml(o) {
        return `<div class="form-row priority-row anytime-row">
                <input type="checkbox" id="${o.id}"${o.checked ? ' checked' : ''}>
                <label for="${o.id}">Anytime today</label>
            </div>`;
    }
    // Applies the checkbox's state to its Due / Start boxes. Safe to call when any element is missing.
    function applyAnytimeToggle(checkboxId) {
        const map = ANYTIME_TOGGLES[checkboxId];
        const box = typeof document !== 'undefined' ? document.getElementById(checkboxId) : null;
        if (!map || !box) return;
        const due = document.getElementById(map.due);
        const start = document.getElementById(map.start);
        const startRow = start && start.closest ? start.closest('.form-row') : null;
        if (box.checked) {
            if (due) { due.value = ANYTIME_DUE_TIME; due.disabled = true; }
            if (start) start.value = '';
            if (startRow) startRow.hidden = true;
        } else {
            if (due) due.disabled = false;
            if (startRow) startRow.hidden = false;
        }
    }
    function onAnytimeChange(e) {
        const el = e.target;
        if (el && ANYTIME_TOGGLES[el.id]) applyAnytimeToggle(el.id);
    }
    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('change', onAnytimeChange);
    }

    // Custom-window times for a BUILD habit (Build B, 2026-11-01): the same Start | End pair, shown only while the
    // Completion Window select is "Custom times...". `selectId` is that select's id; the group's id is
    // `${selectId}Custom` (Modal.wireHabitTimeLabels toggles it). End is the due time and is required once custom
    // is chosen; Start is optional. o = { selectId, startId, endId, startValue, endValue, visible }.
    function customHabitTimesHtml(o) {
        return startDueTimeGroupHtml({
            startId: o.startId, dueId: o.endId, startValue: o.startValue, dueValue: o.endValue,
            startLabel: 'Start Time (optional):', dueLabel: 'End Time (due):',
            groupClass: 'custom-habit-times',
            groupAttrs: `id="${o.selectId}Custom"${o.visible ? '' : ' hidden'}`,
        });
    }

    // Window-mode toggle (2026-11-01, Jeremy): two checkboxes -- "Completion window" / "Custom times" -- that behave
    // like a pair (checking one unchecks the other, one is always on). The matching control shows, the other hides, which
    // frees form space. The <select> stays the data model ('custom' = Custom times). Wired by Modal.wireHabitTimeLabels.
    function habitWindowModeHtml(selectId, custom) {
        return `<div class="form-row habit-window-mode" id="${selectId}Mode">
                <label class="habit-window-mode-opt"><input type="checkbox" data-window-mode="window"${custom ? '' : ' checked'}> Completion window</label>
                <label class="habit-window-mode-opt"><input type="checkbox" data-window-mode="custom"${custom ? ' checked' : ''}> Custom times</label>
            </div>`;
    }

    // ---------------------------------------------------------------------
    // Habit Goal section (2026-11-01, Jeremy; plan docs/HABIT_GOALS_PLAN.md): replaces the old "Timer (minutes)" box on
    // the three habit forms. A type select (none / time / amount / note) reveals its fields; the label flips
    // at-least / at-most with the Build / Break toggle and a tap-to-show (i) lists examples (hover tooltips do not
    // exist on phones). `prefix` namespaces the ids (modalHabit / newHabit / editHabit); Modal.wireHabitGoal wires it.
    // ---------------------------------------------------------------------
    const escAttr = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

    function habitGoalHtml(prefix, goal, isNegative) {
        const g = (goal && typeof goal === 'object') ? goal : { type: 'none' };
        const type = ['time', 'amount', 'note'].includes(g.type) ? g.type : 'none';
        const asHours = type === 'time' && g.amount >= 60 && g.amount % 60 === 0;
        const timeValue = type === 'time' ? (asHours ? g.amount / 60 : g.amount) : '';
        const sel = (v) => (type === v ? ' selected' : '');
        const units = (typeof Habits !== 'undefined' && Habits.GOAL_UNIT_SUGGESTIONS) ? Habits.GOAL_UNIT_SUGGESTIONS : [];
        return `<div class="habit-goal" id="${prefix}Goal">
                <div class="form-row">
                    <label for="${prefix}GoalType"><span data-goal-label>${isNegative ? 'Daily limit (optional):' : 'Habit goal (optional):'}</span>
                        <button type="button" class="form-hint-btn" data-hint-for="${prefix}GoalHint" aria-label="Goal examples" aria-expanded="false">&#9432;</button></label>
                    <select id="${prefix}GoalType">
                        <option value="none"${sel('none')}>No numeric goal</option>
                        <option value="time"${sel('time')}>Time (minutes / hours)</option>
                        <option value="amount"${sel('amount')}>Amount (number + unit)</option>
                        <option value="note"${sel('note')}>Custom note</option>
                    </select>
                    <div class="form-hint-pop" id="${prefix}GoalHint" hidden></div>
                </div>
                <div class="form-row-group time-pair goal-fields" id="${prefix}GoalTimeFields"${type === 'time' ? '' : ' hidden'}>
                    <div class="form-row">
                        <label for="${prefix}GoalTimeValue">Time:</label>
                        <input type="number" id="${prefix}GoalTimeValue" min="1" step="1" inputmode="numeric" placeholder="e.g. 30" value="${escAttr(timeValue)}">
                    </div>
                    <div class="form-row">
                        <label for="${prefix}GoalTimeUnit">Unit:</label>
                        <select id="${prefix}GoalTimeUnit"><option value="min"${asHours ? '' : ' selected'}>minutes</option><option value="hr"${asHours ? ' selected' : ''}>hours</option></select>
                    </div>
                </div>
                <div class="form-row-group time-pair goal-fields" id="${prefix}GoalAmountFields"${type === 'amount' ? '' : ' hidden'}>
                    <div class="form-row">
                        <label for="${prefix}GoalAmountValue">Amount:</label>
                        <input type="number" id="${prefix}GoalAmountValue" min="0" step="any" inputmode="decimal" placeholder="e.g. 8" value="${type === 'amount' ? escAttr(g.amount) : ''}">
                    </div>
                    <div class="form-row">
                        <label for="${prefix}GoalAmountUnit">Unit:</label>
                        <input type="text" id="${prefix}GoalAmountUnit" list="${prefix}GoalUnits" maxlength="24" placeholder="e.g. glasses" value="${type === 'amount' ? escAttr(g.unit) : ''}">
                        <datalist id="${prefix}GoalUnits">${units.map(u => `<option value="${escAttr(u)}"></option>`).join('')}</datalist>
                    </div>
                </div>
                <div class="form-row goal-fields" id="${prefix}GoalNoteFields"${type === 'note' ? '' : ' hidden'}>
                    <label for="${prefix}GoalNote">Goal note:</label>
                    <input type="text" id="${prefix}GoalNote" maxlength="80" placeholder="e.g. Call Mom" value="${type === 'note' ? escAttr(g.note) : ''}">
                </div>
            </div>`;
    }

    // Pure. Raw field values -> a goal object for Habits.normalizeGoal. A Time goal is converted to minutes.
    function goalFromFields(f) {
        if (!f) return { type: 'none' };
        if (f.type === 'time') {
            const v = Number(f.timeValue);
            return { type: 'time', amount: (f.timeUnit === 'hr' ? v * 60 : v) };
        }
        if (f.type === 'amount') return { type: 'amount', amount: Number(f.amountValue), unit: f.amountUnit || '' };
        if (f.type === 'note') return { type: 'note', note: f.note || '' };
        return { type: 'none' };
    }

    // Pure. Error string when a chosen goal type has no usable value, else null (none is always fine).
    function habitGoalError(f) {
        if (!f || !f.type || f.type === 'none') return null;
        const g = goalFromFields(f);
        if (f.type === 'time') {
            return (g.amount >= 1 && g.amount <= 1440) ? null : 'Enter a time goal between 1 minute and 24 hours.';
        }
        if (f.type === 'amount') return (g.amount > 0) ? null : 'Enter an amount for the goal.';
        if (f.type === 'note') return String(g.note).trim() ? null : 'Type a note for the goal.';
        return null;
    }

    // Reads the section's current field values from the document.
    function readHabitGoalFields(prefix, root) {
        const doc = root || document;
        const val = (id) => { const el = doc.querySelector('#' + id); return el ? el.value : ''; };
        const typeEl = doc.querySelector('#' + prefix + 'GoalType');
        if (!typeEl) return null;
        return {
            type: typeEl.value,
            timeValue: val(prefix + 'GoalTimeValue'), timeUnit: val(prefix + 'GoalTimeUnit'),
            amountValue: val(prefix + 'GoalAmountValue'), amountUnit: val(prefix + 'GoalAmountUnit'),
            note: val(prefix + 'GoalNote'),
        };
    }

    // Pure. Returns an error string for a custom habit window, else null: "custom" needs an End time, and Start
    // (when given) must be earlier than End. Not custom, or a Break habit, is always fine (Break habits cannot be custom).
    function customHabitTimesError(timeOfDay, isNegative, startTime, endTime) {
        if (timeOfDay !== 'custom' || isNegative) return null;
        if (!endTime) return 'Pick an end time for the custom window.';
        if (startTime && startTime >= endTime) return 'Start time must be earlier than the end time.';
        return null;
    }

    // Pure. Returns an error string when a Start time is given and is not strictly earlier than the
    // due time (same day, "HH:MM" strings), else null. Blank start is always fine.
    function startBeforeDueError(startTime, dueTime) {
        if (!startTime) return null;
        if (!dueTime) return null;
        if (startTime >= dueTime) return 'Start time must be earlier than the due time.';
        return null;
    }

    // Pure. The Start box is a time of day ON THE DUE DATE (2026-11-04, Jeremy): returns a Date built from the due date being
    // saved plus the "HH:MM" in the Start box, or null when either is blank or unreadable. Edit Task used to keep an
    // untouched Start box as its stored Date, which carries its own calendar date; a task pushed a day and moved back then
    // failed "Start time must be earlier than the due time" with both boxes reading fine.
    function startDateTimeFor(dueDate, startValue) {
        if (!dueDate || !startValue) return null;
        const d = new Date(`${dueDate}T${startValue}`);
        return isNaN(d.getTime()) ? null : d;
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
        const win = computeDefaultWindow(now);
        const todayString = win.date;
        const defaultDueTime = win.due;
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
            <div class="form-row">
                <label for="modalDueDate">Due Date:</label>
                <input type="date" id="modalDueDate" value="${todayString}" required>
            </div>
            ${anytimeRowHtml({ id: 'modalTaskAnytime' })}
            ${startDueTimeGroupHtml({ startId: 'modalStartTime', dueId: 'modalDueTime', startValue: '', dueValue: defaultDueTime, dueAttrs: `data-prefilled="${defaultDueTime}"` })}
            <div class="modal-buttons">
                <button id="modalAddTaskButton" class="primary-button">Add Task</button>
                <button class="secondary-button" onclick="closeModal()">Cancel</button>
            </div>
        `;
    }

    // Habit-type icons (2026-11-04, Jeremy: option A): Build = hammer, Break = broken chain. Drawn like the pencil and
    // stopwatch (24 viewBox, 2.3 round stroke, currentColor) so they take the button's text colour. No emoji.
    const HABIT_ICON_PATHS = {
        build: '<path d="M11.414 10l-7.383 7.418a2.091 2.091 0 0 0 0 2.967a2.11 2.11 0 0 0 2.976 0l7.407 -7.385"/>' +
            '<path d="M18.121 15.293l2.586 -2.586a1 1 0 0 0 0 -1.414l-7.586 -7.586a1 1 0 0 0 -1.414 0l-2.586 2.586a1 1 0 0 0 0 1.414l7.586 7.586a1 1 0 0 0 1.414 0z"/>',
        break: '<path d="M9 15l3 -3m2 -2l1 -1"/><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464"/>' +
            '<path d="M3 3l18 18"/><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463"/>',
    };
    // size defaults to 22 for the picker; pass 16 for inline list rows.
    function habitTypeIconHtml(isNegative, size) {
        const px = size || 22;
        return `<svg class="habit-type-icon" viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="currentColor" ` +
            `stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">` +
            `${isNegative ? HABIT_ICON_PATHS.break : HABIT_ICON_PATHS.build}</svg>`;
    }
    // The Build / Break picker shared by Add Habit and the routine Create / Edit Habit forms.
    // o = { name (radio group name), positiveId, negativeId, isNegative }. Two buttons on ONE row at every width; the
    // chosen one is coloured and ticked, the other is greyed (css/modal.css). Radios stay in the page (visually hidden)
    // so the keyboard still works; every reader keeps using `input[name=<name>]:checked`.
    function habitTypeToggleHtml(o) {
        const neg = !!o.isNegative;
        const row = (id, value, checked, cls, isNeg, title, desc) =>
            `<input type="radio" id="${id}" name="${o.name}" value="${value}"${checked ? ' checked' : ''}>
                    <label for="${id}" class="habit-type-label ${cls}">
                        <span class="habit-title-row">${habitTypeIconHtml(isNeg)}<span class="habit-label">${title}</span></span>
                        <span class="habit-description">${desc}</span>
                    </label>`;
        return `<div class="habit-type-toggle">
                    ${row(o.positiveId, 'positive', !neg, 'positive', false, 'Build', 'Do it to earn points')}
                    ${row(o.negativeId, 'negative', neg, 'negative', true, 'Break', 'Resist it to earn points')}
                </div>`;
    }

    // opts.isNegative (2026-11-04): open with Break Habit already picked (the Boxing gym card's "Break Habit" link).
    function createHabitFormHtml(now = new Date(), opts) {
        const win = computeDefaultWindow(now);
        const startNegative = !!(opts && opts.isNegative);
        return `
            <h3>Add New Habit</h3>
            <div class="form-row">
                <label>Habit Type:</label>
                ${habitTypeToggleHtml({ name: 'modalHabitType', positiveId: 'modalPositiveHabit', negativeId: 'modalNegativeHabit', isNegative: startNegative })}
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
            ${habitWindowModeHtml('modalHabitTimeOfDay', false)}
            <div class="form-row">
                <label for="modalHabitTimeOfDay">Completion Window:</label>
                <select id="modalHabitTimeOfDay">
                    <option value="anytime">Anytime Today</option>
                    <option value="morning">Morning (by 12 PM)</option>
                    <option value="afternoon">Afternoon (by 5 PM)</option>
                    <option value="evening">Evening (by 10 PM)</option>
                    <option value="custom">Custom times...</option>
                </select>
            </div>
            ${customHabitTimesHtml({ selectId: 'modalHabitTimeOfDay', startId: 'modalHabitStartTime', endId: 'modalHabitEndTime', startValue: win.start, endValue: win.due, visible: false })}
            ${habitGoalHtml('modalHabit', null, false)}
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
    // opts (habit only): { isNegative } opens the Add Habit form with Break Habit picked; the wiring below reads the
    // checked radio when it starts, so the time labels and the goal box match from the first frame.
    function showFormModal(formType, deps, opts) {
        // Close any existing modals first
        Modal.closeModal();

        let formHtml;

        switch (formType) {
            case 'task':
                formHtml = createTaskFormHtml();
                break;
            case 'habit':
                formHtml = createHabitFormHtml(new Date(), opts);
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
            Modal.wireHabitGoal('modalHabitType', 'modalHabit');
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
                        const anytimeInput = modal.querySelector('#modalTaskAnytime');
                        const isAnytime = !!(anytimeInput && anytimeInput.checked);

                        if (!name || !dueDate) {
                            showFormError('Task Name and Due Date are required.', !name ? nameInput : dateInput);
                            return;
                        }

                        // Anytime: due 23:59 on the chosen date, no Start, and no "just passed" nudge (23:59 is never "now-ish").
                        const resolved = isAnytime
                            ? { dueDate, dueTime: ANYTIME_DUE_TIME }
                            : resolveSubmittedDueTime(dueDate, dueTime,
                                timeInput ? timeInput.getAttribute('data-prefilled') : null, new Date());
                        const startInput = modal.querySelector('#modalStartTime');
                        const startTime = isAnytime ? '' : (startInput ? startInput.value : '');
                        const startError = startBeforeDueError(startTime, resolved.dueTime);
                        if (startError) {
                            showFormError(startError, startInput);
                            return;
                        }
                        const taskData = deps.createTaskItemData(name, category, isHighPriority, resolved.dueDate, resolved.dueTime, undefined, startTime || undefined, isAnytime ? true : undefined);
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
                            showFormError('Habit Name is required.', nameInput);
                            return;
                        }
                        const habitStartInput = modal.querySelector('#modalHabitStartTime');
                        const habitEndInput = modal.querySelector('#modalHabitEndTime');
                        const habitStartTime = habitStartInput ? habitStartInput.value : '';
                        const habitEndTime = habitEndInput ? habitEndInput.value : '';
                        const customError = customHabitTimesError(timeOfDay, isNegative, habitStartTime, habitEndTime);
                        if (customError) {
                            showFormError(customError, habitStartInput);
                            return;
                        }
                        if (schedule.frequency !== 'monthly' && schedule.daysOfWeek.length === 0) {
                            showFormError('Please select at least one day.');
                            return;
                        }

                        const goalFields = readHabitGoalFields('modalHabit', modal);
                        const goalError = habitGoalError(goalFields);
                        if (goalError) {
                            showFormError(goalError);
                            return;
                        }
                        deps.createHabitDefinition(name, category, schedule, timeOfDay, isNegative, null, habitStartTime || null, habitEndTime || null, goalFromFields(goalFields));
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
                            showFormError(result.reason === 'empty' ? 'Please enter a routine name.' : 'Routine name already exists.', nameInput);
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

    // ---- Logged time (Habit Goals Build 2c, 2026-11-01) -------------------------------------------------------------
    // An hours + minutes field for a timer's logged total. Whole minutes: the field shows the logged time rounded to the
    // minute, and `readLoggedTime` reports `changed` only when the player typed a different number of minutes, so saving
    // an untouched form never rewrites a precise value (e.g. 1 h 5 min 20 s) or counts a fake edit.
    function loggedTimeMinutes(ms) {
        return (typeof ms === 'number' && ms > 0) ? Math.round(ms / 60000) : 0;
    }
    // opts: { idPrefix, ms, disabled?, note? } -> inputs `${idPrefix}Hours` / `${idPrefix}Minutes` inside `#${idPrefix}Group`.
    function loggedTimeHtml(opts) {
        const o = opts || {};
        const p = o.idPrefix || 'loggedTime';
        const total = loggedTimeMinutes(o.ms);
        const dis = o.disabled ? ' disabled' : '';
        return `<div class="form-row logged-time-row" id="${p}Group" data-initial-min="${total}">` +
            `<label for="${p}Hours">Time Logged:</label>` +
            `<div class="logged-time-inputs">` +
            `<input type="number" id="${p}Hours" class="logged-time-input" min="0" max="24" step="1" inputmode="numeric" value="${Math.floor(total / 60)}" aria-label="Logged hours"${dis}> <span>hr</span> ` +
            `<input type="number" id="${p}Minutes" class="logged-time-input" min="0" max="59" step="1" inputmode="numeric" value="${total % 60}" aria-label="Logged minutes"${dis}> <span>min</span>` +
            `</div>` +
            (o.note ? `<p class="logged-time-note" id="${p}Note">${o.note}</p>` : '') +
            `</div>`;
    }
    // Reads the field. Returns { ms, changed } or { error }. Blank counts as 0; hours 0..24, minutes 0..59, total <= 24 h.
    // `changed` compares against the minutes the field was drawn with. Missing field -> { absent: true }.
    function readLoggedTime(idPrefix) {
        const p = idPrefix || 'loggedTime';
        const group = document.getElementById(`${p}Group`);
        const hEl = document.getElementById(`${p}Hours`);
        const mEl = document.getElementById(`${p}Minutes`);
        if (!group || !hEl || !mEl) return { absent: true };
        const h = hEl.value.trim() === '' ? 0 : Number(hEl.value);
        const m = mEl.value.trim() === '' ? 0 : Number(mEl.value);
        if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0) return { error: 'Time Logged must be whole hours and minutes.' };
        if (m > 59) return { error: 'Minutes must be 0 to 59.' };
        const total = h * 60 + m;
        if (total > 24 * 60) return { error: 'Time Logged can\u2019t be more than 24 hours.' };
        const initial = Number(group.getAttribute('data-initial-min'));
        return { ms: total * 60000, changed: total !== initial };
    }

    // ---------------------------------------------------------------------
    // Inline form errors (Dialog Build 2, 2026-11-01, docs/DIALOG_PLAN.md): a failed Save writes ONE red line in the form
    // (under the bad field, else above its button row) and focuses the field, instead of the browser's alert(). It clears on the next edit.
    // showFormError(message, field?, opts?)
    //   field: the offending input (element or id) -- focused, marked aria-invalid, and used to find the form.
    //   opts.before / opts.after: place the line next to that element instead (default: under the field's `.form-row`, else above `.modal-buttons`).
    // ---------------------------------------------------------------------
    const FORM_ERROR_CLASS = 'form-error';

    function resolveField(field) {
        if (!field) return null;
        return typeof field === 'string' ? document.getElementById(field) : field;
    }

    function formRoot(fieldEl) {
        if (fieldEl && fieldEl.closest) {
            const overlay = fieldEl.closest('.modal-overlay, .management-window');
            if (overlay) return overlay;
        }
        const overlays = document.querySelectorAll('.modal-overlay');
        return overlays.length ? overlays[overlays.length - 1] : document.body;
    }

    function clearFormError(root) {
        const scope = root || document;
        scope.querySelectorAll('.' + FORM_ERROR_CLASS + '[data-inline-error]').forEach(el => el.remove());
        scope.querySelectorAll('[aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid'));
    }

    function showFormError(message, field, opts) {
        const fieldEl = resolveField(field);
        const root = formRoot(fieldEl);
        clearFormError(root);

        const el = document.createElement('div');
        el.className = FORM_ERROR_CLASS;
        el.setAttribute('data-inline-error', '');
        el.setAttribute('role', 'alert');
        el.textContent = message;

        const before = opts && opts.before;
        const after = opts && opts.after;
        const buttons = root.querySelector ? root.querySelector('.modal-buttons') : null;
        if (before && before.parentNode) before.parentNode.insertBefore(el, before);
        else if (after && after.parentNode) after.parentNode.insertBefore(el, after.nextSibling);
        else if (fieldEl && fieldEl.closest && fieldEl.closest('.form-row') && root.contains(fieldEl.closest('.form-row'))) {
            // Long forms scroll on a phone: put the line under the bad field so it is on screen with the focus.
            const row = fieldEl.closest('.form-row');
            row.parentNode.insertBefore(el, row.nextSibling);
        }
        else if (buttons && buttons.parentNode) buttons.parentNode.insertBefore(el, buttons);
        else root.appendChild(el);

        if (fieldEl) {
            fieldEl.setAttribute('aria-invalid', 'true');
            if (typeof fieldEl.focus === 'function') fieldEl.focus();
        } else if (typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ block: 'nearest' });   // no single field to focus: bring the line itself on screen
        }
        // Clear on the next edit anywhere in the same form (once).
        const clear = () => { clearFormError(root); root.removeEventListener('input', clear); root.removeEventListener('change', clear); };
        root.addEventListener('input', clear);
        root.addEventListener('change', clear);
        return el;
    }

    return {
        showFormError,
        clearFormError,
        createTaskFormHtml,
        createHabitFormHtml,
        createRoutineFormHtml,
        showFormModal,
        attachModalEventListeners,
        computeDefaultWindow,
        computeDefaultDueTime,
        computeDefaultDueDate,
        resolveSubmittedDueTime,
        startDueTimeGroupHtml,
        anytimeRowHtml,
        applyAnytimeToggle,
        ANYTIME_DUE_TIME,
        shiftDueForStart,
        autoDueForNewStart,
        onStartTimeChange,
        startBeforeDueError,
        startDateTimeFor,
        customHabitTimesHtml,
        habitGoalHtml,
        goalFromFields,
        habitGoalError,
        readHabitGoalFields,
        habitWindowModeHtml,
        habitTypeIconHtml,
        habitTypeToggleHtml,
        customHabitTimesError,
        loggedTimeMinutes,
        loggedTimeHtml,
        readLoggedTime,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Forms;
}

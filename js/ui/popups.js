/**
 * Popups — enemy click, task details, edit task, and sub-task creation
 * modals (Milestone 2 UI extraction, session 5, 2026-07-18).
 *
 * Extracted from script.js per docs/UI_EXTRACTION_PLAN.md cluster D:
 * handleEnemyClick, showTaskDetailsPopup, showEditTaskModal,
 * createSubTaskPrompt, showCreateSubTaskModal.
 *
 * Same dependency approach as forms.js (session 4): Modal is called as a
 * bare stable global (fully extracted module, guaranteed loaded first). The
 * pushback section (session 4) also calls Shop as a bare global — it loads
 * at index.html line ~202, well before this module (~213), same as Modal.
 * Everything else — script.js closure state/functions (activeItems,
 * gameIsOver, completeItem, createListItem, sortAndRenderActiveList,
 * saveGame, recomputeOverdueStateAfterEdit, createTaskItemData,
 * addItemToGame) plus the pushback deps (pushbackCatalog, getPlayerPoints,
 * onPushback) — arrives via an explicit deps object. The functions in this
 * cluster call each other directly (module-internal), not through deps,
 * since they're all defined in this same file.
 *
 * DELIBERATE CARVE-OUT: showCreateSubTaskModal's debug console.log lines
 * (🎯/❌/✅/🔥-prefixed) are LEFT AS-IS, unlike the debug-log cleanup done in
 * fabMenu.js (session 3) and forms.js (session 4). This exact function is
 * the one at the center of the historic sub-task duplication bug
 * (root-caused and fixed in an earlier session — see
 * SUBTASK_BUG_REPRODUCTION_REPORT.md, which this session did not open per
 * the project's guardrail against opening that file). Second-guessing
 * diagnostic logging left behind from that bug hunt is a separate decision
 * from moving the code, not made here.
 */
const Popups = (() => {

    // -----------------------------------------------------------------------
    // Local-time formatters for <input type="date"> / <input type="time">
    // pre-fill. These MUST use local getters, never toISOString(): the save
    // path parses `${date}T${time}` as LOCAL time (no Z suffix), so pre-filling
    // from UTC meant opening Edit Task and pressing Save without touching
    // anything shifted the due time forward by the UTC offset (and rolled the
    // DATE for evening tasks). Found during session 6 live verification; see
    // DECISIONS.md 2026-07-18.
    // -----------------------------------------------------------------------

    function formatDateInputValue(date) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function formatTimeInputValue(date) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    // deps: { gameIsOver, activeItems }
    function handleEnemyClick(itemId, deps) {
        if (deps.gameIsOver) return;
        const itemData = deps.activeItems.find(i => i.id === itemId);
        if (!itemData) return;
        showTaskDetailsPopup(itemData, deps);
    }

    // Builds the "Push back this deadline" section HTML for the enemy popup
    // (session 4). Empty string when pushback isn't wired (no deps.onPushback
    // or no catalog) so the popup degrades cleanly. Prices are live via
    // Shop.price (bare global, loaded before this module — same as Modal);
    // a tier is disabled when the player can't afford it. Pushback applies to
    // ANY enemy (task/sub-task/habit), Jeremy's call 2026-07-19.
    function buildPushbackSectionHtml(deps) {
        if (!deps.onPushback || !Array.isArray(deps.pushbackCatalog) || deps.pushbackCatalog.length === 0) {
            return '';
        }
        const points = typeof deps.getPlayerPoints === 'function' ? deps.getPlayerPoints() : 0;

        const buttons = deps.pushbackCatalog.map(p => {
            const price = Shop.price(p, {});
            const affordable = points >= price;
            // Short label from the catalog name: "Enemy Pushback (1 hr)" -> "1 hr".
            const m = /\(([^)]+)\)/.exec(p.name);
            const label = m ? m[1] : p.name;
            return `<button type="button" class="pushback-btn" data-item-id="${p.id}"${affordable ? '' : ' disabled'}>
                        ${label} — ${price} pts
                    </button>`;
        }).join('');

        // Affordability feedback (parity with the shop's "Not enough points"
        // Buy-button text): a disabled tier with no explanation reads as
        // broken, and a title= tooltip is invisible on mobile (this app's
        // primary target). Showing the live balance makes the disabled state
        // self-explanatory; refreshPushbackUI keeps it current after a buy.
        const anyUnaffordable = deps.pushbackCatalog.some(p => points < Shop.price(p, {}));
        const balanceNote = anyUnaffordable
            ? ` <span class="pushback-balance-note">(you have ${points} pts)</span>`
            : ` <span class="pushback-balance-note"></span>`;

        return `
            <div class="pushback-section">
                <p class="pushback-label"><strong>Push back this deadline:</strong>${balanceNote}</p>
                <div class="pushback-options">${buttons}</div>
            </div>
        `;
    }

    // A negative-habit lurker (session 29) gets the indulge/avoid binary
    // instead of the ordinary complete checkbox — see buildActionsHtml.
    function isNegativeHabitInstance(item) {
        return item.type === 'habit' && item.isNegative === true;
    }

    // deps: { completeItem, indulgeHabit, pushbackCatalog?, getPlayerPoints?,
    //         onPushback?, getCheatDayHeldCount?, isCheatDayActiveForItem?, onUseCheatDay?,
    //         getSkipDayHeldCount?, onUseSkipDay? }
    //
    // Sub-session 2b ([P1-DATA-005], NEGATIVE_HABITS_PLAN.md): for a
    // negative-habit lurker, the "Mark as Complete" checkbox + pushback
    // section are REPLACED with the spec's binary — "Successfully avoided"
    // (routes through the normal completeItem/applyHabitCompletion path:
    // success occurrence + points + defeat exit) and "I indulged" (routes
    // through the new indulgeHabit/applyHabitIndulgence path: points debit +
    // streak zero + exit, no occurrence success). Pushback doesn't apply to
    // a lurker — it never advances, so there's no deadline to push back.
    //
    // Sub-session 5 (Cheat Day token, 2026-07-19): a third row targets THIS
    // lurker with a held Cheat Day token (reuses pushback's tap-a-zombie
    // targeting shape). Three states: an ACTIVE cheat day for this lurker's
    // day shows a note (indulging is free — items.js's indulgeHabit already
    // enforces this); zero held shows nothing (nothing to use); one-or-more
    // held shows the "Use Cheat Day" button.
    // Skip Day (frozen-slots sub-session 5, 2026-07-19): targets ANY habit
    // instance — positive or negative, unlike Cheat Day's negative-only
    // reach — via its popup, reusing the tap-a-zombie targeting shape.
    // "Clear immediately" model (Jeremy's call, 2026-07-19): using it
    // removes THIS instance from the board right away, so unlike Cheat Day
    // there's no "active" note state to render — the button either offers
    // itself (held > 0) or the row is simply empty. Tasks never show it
    // (fork 4, docs/FROZEN_SLOTS_PLAN.md: Skip Day is habits-only).
    function buildSkipDaySectionHtml(item, deps) {
        if (item.type !== 'habit') return '';
        const heldSkipDays = typeof deps.getSkipDayHeldCount === 'function' ? deps.getSkipDayHeldCount() : 0;
        if (heldSkipDays <= 0) return '';
        return `<button type="button" id="useSkipDayBtn" class="negative-habit-button skipday-btn">Use Skip Day (${heldSkipDays} held)</button>`;
    }

    function buildActionsHtml(item, deps) {
        if (isNegativeHabitInstance(item)) {
            const cheatDayActive = typeof deps.isCheatDayActiveForItem === 'function' && deps.isCheatDayActiveForItem(item);
            const heldCheatDays = typeof deps.getCheatDayHeldCount === 'function' ? deps.getCheatDayHeldCount() : 0;
            const cheatDayRow = cheatDayActive
                ? `<p class="cheat-day-active-note">🎟️ Cheat Day active — indulging today is free.</p>`
                : (heldCheatDays > 0
                    ? `<button type="button" id="useCheatDayBtn" class="negative-habit-button cheatday-btn">Use Cheat Day (${heldCheatDays} held)</button>`
                    : '');
            return `
                <div class="task-actions negative-habit-actions" style="display: flex; justify-content: flex-end; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <button id="editTaskBtn" class="edit-icon-btn" title="Edit Task">✏️</button>
                    <button type="button" id="avoidHabitBtn" class="negative-habit-button avoid-btn">Successfully avoided</button>
                    <button type="button" id="indulgeHabitBtn" class="negative-habit-button indulge-btn">I indulged</button>
                </div>
                ${cheatDayRow}
                ${buildSkipDaySectionHtml(item, deps)}
            `;
        }
        // [P1-DATA-004] sub-session 1 (2026-07-19): mirrors agendaList.js's
        // disabled-checkbox treatment — see its comment for the rationale
        // (Items.completeItem is the real backstop; this is the proactive
        // half + a visible reason).
        const openSubTaskCount = (item.type === 'task' && item.subTasks) ? item.subTasks.length : 0;
        const hasOpenSubTasks = openSubTaskCount > 0;
        const remainingSuffix = openSubTaskCount === 1 ? '' : 's';
        return `
            <div class="task-actions" style="display: flex; justify-content: flex-end; gap: 10px; align-items: center;">
                <button id="editTaskBtn" class="edit-icon-btn" title="Edit Task">✏️</button>
                <label class="completion-checkbox"${hasOpenSubTasks ? ` title="${openSubTaskCount} sub-task${remainingSuffix} remaining" style="cursor: not-allowed; opacity: 0.6;"` : ''}>
                    <input type="checkbox" id="completeTaskCheck" class="completion-checkbox-input"${hasOpenSubTasks ? ' disabled' : ''} />
                    Mark as Complete${hasOpenSubTasks ? ` (${openSubTaskCount} remaining)` : ''}
                </label>
            </div>
            ${buildPushbackSectionHtml(deps)}
            ${buildSkipDaySectionHtml(item, deps)}
        `;
    }

    function showTaskDetailsPopup(item, deps) {
        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content task-details-modal">
                    <button class="close-modal-x" onclick="closeModal()">&times;</button>
                    <h3>${item.name}</h3>
                    <div class="task-details">
                        <p><strong>Category:</strong> ${item.category}</p>
                        <p><strong>Due:</strong> <span class="task-due-display">${item.dueDateTime.toLocaleString()}</span></p>
                        <p><strong>Priority:</strong> ${item.isHighPriority ? 'High' : 'Normal'}</p>
                        ${item.type === 'habit' ? `<p><strong>Streak:</strong> ${item.streak}</p>` : ''}
                        ${buildActionsHtml(item, deps)}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add event listeners
        const completeCheckbox = document.getElementById('completeTaskCheck');
        const editButton = document.getElementById('editTaskBtn');
        const avoidButton = document.getElementById('avoidHabitBtn');
        const indulgeButton = document.getElementById('indulgeHabitBtn');

        if (completeCheckbox) {
            completeCheckbox.addEventListener('change', () => {
                if (completeCheckbox.checked) {
                    deps.completeItem(item.id);
                    Modal.closeModal();
                }
            });
        }

        if (avoidButton) {
            avoidButton.addEventListener('click', () => {
                deps.completeItem(item.id);
                Modal.closeModal();
            });
        }

        if (indulgeButton) {
            indulgeButton.addEventListener('click', () => {
                deps.indulgeHabit(item.id);
                Modal.closeModal();
            });
        }

        // Use Cheat Day button (sub-session 5, 2026-07-19). Unlike pushback's
        // in-place refresh, this REPLACES the button with an "active" note —
        // rebuilding the popup while its own click is still bubbling is
        // exactly the hazard that bit the shop's Buy/Use buttons (session 21,
        // see SHOP_PLAN.md hazards / DECISIONS.md), so the rebuild is
        // deferred via setTimeout(0). Simplest correct rebuild: close and
        // reopen the SAME popup, which re-evaluates cheatDayActive/held
        // fresh from deps.
        const useCheatDayButton = document.getElementById('useCheatDayBtn');
        if (useCheatDayButton) {
            useCheatDayButton.addEventListener('click', () => {
                const result = deps.onUseCheatDay ? deps.onUseCheatDay('cheat_day', item) : { ok: false };
                if (result && result.ok) {
                    setTimeout(() => {
                        Modal.closeModal();
                        showTaskDetailsPopup(item, deps);
                    }, 0);
                }
            });
        }

        // Use Skip Day button (frozen-slots sub-session 5, 2026-07-19).
        // Unlike Cheat Day's rebuild-in-place, using Skip Day removes THIS
        // item from the board immediately ("clear immediately" model), so
        // there's nothing left for the popup to show — just close it. No
        // setTimeout(0) needed: closeModal() alone (no rebuild racing it) is
        // the same safe shape as the avoid/indulge buttons above.
        const useSkipDayButton = document.getElementById('useSkipDayBtn');
        if (useSkipDayButton) {
            useSkipDayButton.addEventListener('click', () => {
                const result = deps.onUseSkipDay ? deps.onUseSkipDay('skip_day', item) : { ok: false };
                if (result && result.ok) {
                    Modal.closeModal();
                }
            });
        }

        if (editButton) {
            editButton.addEventListener('click', () => {
                Modal.closeModal();
                showEditTaskModal(item, deps);
            });
        }

        // Pushback tier buttons (session 4). Each applies its tier to THIS
        // item via deps.onPushback, which pays + shifts the due date + saves
        // and returns { ok }. On success we refresh the popup IN PLACE — update
        // the shown due time and re-evaluate every tier's affordability against
        // the now-lower points — rather than rebuilding the section's innerHTML.
        // In-place updates never detach the just-clicked button, so this
        // sidesteps the click-event-bubbling hazard that bit the shop Buy/Use
        // buttons (see SHOP_PLAN.md hazards / DECISIONS.md session 21); no
        // setTimeout(0) needed here. Stacking multiple pushbacks in one popup
        // session is supported (ECONOMY.md "stacking allowed").
        const overlay = document.querySelector('.modal-overlay');

        function refreshPushbackUI() {
            const dueDisplay = overlay.querySelector('.task-due-display');
            if (dueDisplay) dueDisplay.textContent = item.dueDateTime.toLocaleString();

            const points = typeof deps.getPlayerPoints === 'function' ? deps.getPlayerPoints() : 0;
            let anyUnaffordable = false;
            overlay.querySelectorAll('.pushback-btn').forEach(btn => {
                const p = deps.pushbackCatalog.find(i => i.id === btn.dataset.itemId);
                if (p) {
                    btn.disabled = points < Shop.price(p, {});
                    if (btn.disabled) anyUnaffordable = true;
                }
            });

            // Keep the balance note in sync (appears once a tier becomes
            // unaffordable, updates as points drop across stacked pushes).
            const note = overlay.querySelector('.pushback-balance-note');
            if (note) note.textContent = anyUnaffordable ? `(you have ${points} pts)` : '';
        }

        overlay.querySelectorAll('.pushback-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const result = deps.onPushback(btn.dataset.itemId, item);
                if (result && result.ok) refreshPushbackUI();
            });
        });

        // Close modal when clicking overlay
        overlay.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) Modal.closeModal();
        });
    }

    // deps: { recomputeOverdueStateAfterEdit, createListItem, sortAndRenderActiveList, saveGame }
    function showEditTaskModal(item, deps) {
        const dueDate = formatDateInputValue(item.dueDateTime);
        const dueTime = formatTimeInputValue(item.dueDateTime);

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
                const newDueDate = document.getElementById('editDueDate').value;
                const newDueTime = document.getElementById('editDueTime').value;

                if (!name || !newDueDate) {
                    alert('Task Name and Due Date are required.');
                    return;
                }

                // Update the item data
                item.name = name;
                item.category = category;
                item.isHighPriority = isHighPriority;
                item.dueDateTime = new Date(`${newDueDate}T${newDueTime}`);

                // Re-derive overdue state from the NEW due date. Without this,
                // pushing an overdue task's deadline into the future left
                // isOverdue: true (it's only ever set by markAsOverdue/
                // updateActiveItems, never re-checked against dueDateTime), so
                // the zombie stayed camped at the base still ticking damage
                // every DAMAGE_INTERVAL_MS even though it was no longer due.
                // That defeated the whole point of letting someone fix an
                // overly-aggressive deadline. See DECISIONS.md 2026-07-17.
                deps.recomputeOverdueStateAfterEdit(item);

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
                        deps.createListItem(item);
                    }
                }

                deps.sortAndRenderActiveList();
                deps.saveGame();
                Modal.closeModal();
            });
        }

        // Close modal when clicking overlay
        document.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) Modal.closeModal();
        });
    }

    // deps: passed straight through to showCreateSubTaskModal
    function createSubTaskPrompt(parentId, deps) {
        showCreateSubTaskModal(parentId, deps);
    }

    // deps: { activeItems, createTaskItemData, addItemToGame, createListItem, sortAndRenderActiveList }
    //
    // Debug console.log lines below are DELIBERATELY UNCHANGED — see file
    // header. This function is the historic sub-task-duplication bug site.
    function showCreateSubTaskModal(parentId, deps) {
        console.log('🎯 showCreateSubTaskModal called with parentId:', parentId, 'type:', typeof parentId);

        const parentTask = deps.activeItems.find(item => item.id === parentId && item.type === 'task');
        if (!parentTask) {
            console.log('❌ Parent task not found for parentId:', parentId);
            console.log('Available active items:', deps.activeItems.map(item => ({ id: item.id, name: item.name, type: item.type })));
            alert('Parent task not found.');
            return;
        }

        console.log('✅ Found parent task:', { id: parentTask.id, name: parentTask.name, type: parentTask.type });

        const parentDueDate = formatDateInputValue(parentTask.dueDateTime);
        const parentDueTime = formatTimeInputValue(parentTask.dueDateTime);

        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>Create Sub-task for "${parentTask.name}"</h3>
                    <div class="form-row">
                        <label for="subTaskName">Sub-task Name:</label>
                        <input type="text" id="subTaskName" required>
                    </div>
                    <div class="form-row">
                        <label for="subTaskCategory">Category:</label>
                        <select id="subTaskCategory">
                            <option value="other" ${parentTask.category === 'other' ? 'selected' : ''}>Other (Generic)</option>
                            <option value="career" ${parentTask.category === 'career' ? 'selected' : ''}>Career</option>
                            <option value="creativity" ${parentTask.category === 'creativity' ? 'selected' : ''}>Creativity</option>
                            <option value="financial" ${parentTask.category === 'financial' ? 'selected' : ''}>Financial</option>
                            <option value="health" ${parentTask.category === 'health' ? 'selected' : ''}>Health</option>
                            <option value="lifestyle" ${parentTask.category === 'lifestyle' ? 'selected' : ''}>Lifestyle</option>
                            <option value="relationships" ${parentTask.category === 'relationships' ? 'selected' : ''}>Relationships</option>
                            <option value="spirituality" ${parentTask.category === 'spirituality' ? 'selected' : ''}>Spirituality</option>
                        </select>
                    </div>
                    <div class="form-row priority-row">
                        <input type="checkbox" id="subTaskHighPriority" ${parentTask.isHighPriority ? 'checked' : ''}>
                        <label for="subTaskHighPriority">High Priority</label>
                    </div>
                    <div class="form-row-group">
                        <div class="form-row">
                            <label for="subTaskDueDate">Due Date:</label>
                            <input type="date" id="subTaskDueDate" value="${parentDueDate}" required>
                        </div>
                        <div class="form-row">
                            <label for="subTaskDueTime">Due Time:</label>
                            <input type="time" id="subTaskDueTime" value="${parentDueTime}">
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button id="createSubTaskBtn" class="primary-button">Create Sub-task</button>
                        <button class="secondary-button" onclick="closeModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add create functionality
        const createButton = document.getElementById('createSubTaskBtn');
        if (createButton) {
            createButton.addEventListener('click', (event) => {
                console.log('🔥 SUBTASK CREATE BUTTON CLICKED - DEBUG INFO:');
                console.log('Event object:', event);
                console.log('Modal open:', document.querySelector('.modal-overlay') !== null);
                console.log('Preventing default and stopping propagation');

                // Prevent any event bubbling or default actions
                event.preventDefault();
                event.stopPropagation();

                const name = document.getElementById('subTaskName').value.trim();
                const category = document.getElementById('subTaskCategory').value;
                const isHighPriority = document.getElementById('subTaskHighPriority').checked;
                const dueDate = document.getElementById('subTaskDueDate').value;
                const dueTime = document.getElementById('subTaskDueTime').value;

                console.log('Subtask form values:', { name, category, isHighPriority, dueDate, dueTime });

                if (!name || !dueDate) {
                    console.log('⚠️ Subtask creation stopped - missing name or date');
                    alert('Sub-task Name and Due Date are required.');
                    return;
                }

                console.log('✅ Creating SUBTASK:', { name, category, isHighPriority, dueDate, dueTime, parentId });

                // Create sub-task with specified fields
                const subTaskData = deps.createTaskItemData(
                    name,
                    category,
                    isHighPriority,
                    dueDate,
                    dueTime,
                    parentId
                );

                // Add to parent's subTasks array
                parentTask.subTasks.push(subTaskData.id);
                parentTask.totalSubTasks = parentTask.subTasks.length;

                // Use centralized addItemToGame function which handles subtask logic
                deps.addItemToGame(subTaskData);

                // Refresh the parent task's list item to show the new sub-task
                if (parentTask.listItemElement) {
                    parentTask.listItemElement.remove();
                    deps.createListItem(parentTask);
                    deps.sortAndRenderActiveList();
                }

                console.log('🏁 Subtask creation complete, closing modal');
                Modal.closeModal();
            });
        }

        // Close modal when clicking overlay
        document.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) Modal.closeModal();
        });
    }

    return {
        handleEnemyClick,
        showTaskDetailsPopup,
        showEditTaskModal,
        createSubTaskPrompt,
        showCreateSubTaskModal,
        // Exposed for tests (test/popups-prefill.test.js)
        formatDateInputValue,
        formatTimeInputValue,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Popups;
}

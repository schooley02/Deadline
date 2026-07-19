/**
 * Agenda list — parts 1 + 2 (Milestone 2 UI extraction, sessions 6-7,
 * 2026-07-18).
 *
 * Part 1 (session 6): createListItem — the task/habit branching shell and
 * row construction.
 * Part 2 (session 7): sortAndRenderActiveList, renderCompletedItems,
 * resetAllSubTaskCheckboxes, showEditHabitInstanceModal.
 *
 * PART 2 DEPENDENCY NOTE — getters vs plain references for script.js state:
 * `activeItems` and `categoryStyles` stay plain references (established in
 * part 1 — stable bindings, captured fresh on each call via agendaListDeps()
 * in script.js). `completedItems` and `definedHabits`, by contrast, arrive
 * as GETTERS (`deps.completedItems()`, `deps.definedHabits()`) because both
 * are REASSIGNED elsewhere in script.js (on new-game reset and on
 * restoreGameState) rather than only mutated in place — a plain reference
 * captured before a reset/restore would go stale. Matches the isGameOver
 * getter precedent from part 1 and js/spawning.js.
 *
 * `showEditHabitForm` and `uncompleteItem` are passed through as function
 * references — both still live in script.js (showEditHabitForm is cluster F,
 * routines UI, not yet extracted; uncompleteItem is a large standalone
 * function out of this session's scope) and are called, not read, so a
 * plain reference is correct.
 *
 * DEPENDENCY NOTE — why gameIsOver arrives as a getter, not a boolean:
 * every prior UI module in this sequence (fabMenu, managementWindows, forms,
 * popups) reads its deps immediately, inside the same tick as the call, so a
 * snapshotted value is correct. createListItem is the first UI extraction
 * that ATTACHES HANDLERS WHICH OUTLIVE THE CALL — the "+ Sub-task" button
 * reads the game-over flag when the user clicks it, potentially long after
 * the row was built. A flat `deps.gameIsOver` boolean would freeze the value
 * at render time, so rows built before game-over would keep accepting
 * sub-tasks afterward. `deps.isGameOver()` re-reads script.js's live closure
 * variable at click time, preserving the original inline behavior exactly.
 * This is NOT a new convention: js/spawning.js already passes
 * `isGameOver: () => gameIsOver` for the same reason.
 *
 * `activeItems` and `categoryStyles` are passed as plain references rather
 * than getters on purpose — both are stable bindings in script.js (the array
 * is mutated in place, never reassigned; categoryStyles is a const object),
 * so a captured reference always sees current data.
 *
 * DELIBERATE CARVE-OUT: the `DEBUG:` console.log on each sub-task checkbox is
 * LEFT AS-IS, unlike the debug-log cleanup done in fabMenu.js (session 3) and
 * forms.js (session 4). It dates from the historic sub-task duplication bug
 * hunt, the same reasoning that kept popups.js's logs in session 5. Removing
 * diagnostics left behind by that investigation is a separate decision from
 * moving the code, and is not made here.
 */
const AgendaList = (() => {

    /**
     * Build the <li> row for an active item and store it on
     * itemData.listItemElement. Does NOT insert it into the DOM — callers
     * (sortAndRenderActiveList, restoreGameState, addItemToGame) handle
     * placement. Return value is unused; the original had none.
     *
     * deps: {
     *   activeItems, categoryStyles, completeItem, isGameOver,
     *   showEditTaskModal, showEditHabitInstanceModal, createSubTaskPrompt
     * }
     */
    function createListItem(itemData, deps) {
        const listItem = document.createElement('li');
        listItem.dataset.itemId = itemData.id;

        // Add category class for sprite styling
        listItem.classList.add(`category-${itemData.category}`);

        if (itemData.type === 'task' && itemData.isHighPriority) {
            listItem.classList.add('high-priority-list-item');
        }

        // Overdue styling is DERIVED from state here, not just applied by
        // markAsOverdue (2026-07-18). markAsOverdue early-returns when an item
        // is already overdue, so it only ever styles the row on the TRANSITION
        // into overdue. Every path that REBUILDS a list item for an item that
        // was already overdue therefore produced an un-highlighted row while
        // the sprite kept its red box: editing an overdue task's due date
        // (showEditTaskModal), adding a sub-task to one, and restoring a save
        // whose parent has sub-tasks (restoreGameState re-applies the class,
        // then rebuilds the element right after). Deriving it here fixes all of
        // them at once and keeps rebuilds idempotent. See DECISIONS.md.
        if (itemData.isOverdue) {
            listItem.classList.add('overdue-list-item');
        }

        // Adjust main task container to align properly
        listItem.style.display = 'flex';
        listItem.style.justifyContent = 'space-between';
        listItem.style.alignItems = 'flex-start';

        // Create sprite column
        const itemSpriteDiv = document.createElement('div');
        itemSpriteDiv.classList.add('item-sprite');

        // Create item info div - this will contain the main task content
        const itemInfoDiv = document.createElement('div');
        itemInfoDiv.classList.add('item-info');
        itemInfoDiv.style.cssText = 'flex-grow: 1; padding: 8px 0; display: flex; flex-direction: column; gap: 4px;';

        // Top row: Task title and controls on same horizontal line
        const titleAndControlsRow = document.createElement('div');
        titleAndControlsRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

        const itemNameSpan = document.createElement('span');
        itemNameSpan.classList.add('item-name');
        itemNameSpan.style.cssText = 'font-weight: 500; flex-grow: 1;';
        itemNameSpan.textContent = itemData.name;

        // Controls container aligned to the right on same line as title
        const itemActionsContainer = document.createElement('div');
        itemActionsContainer.classList.add('task-controls');
        itemActionsContainer.style.cssText = 'display: flex; align-items: center; gap: 12px; flex-shrink: 0;';

        // Edit pencil: behavior and target editor are type-specific (a task
        // and a habit instance have different shapes and different editors).
        const editIconButton = document.createElement('button');
        editIconButton.classList.add('edit-icon-btn');
        editIconButton.textContent = '✏️';
        editIconButton.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px;';
        if (itemData.type === 'habit') {
            editIconButton.title = 'Edit Habit';
            editIconButton.addEventListener('click', () => deps.showEditHabitInstanceModal(itemData));
        } else {
            // Tasks (and anything else, defensively) get the task editor.
            editIconButton.title = 'Edit Task';
            editIconButton.addEventListener('click', () => deps.showEditTaskModal(itemData));
        }

        // [P1-DATA-004] sub-session 1 (2026-07-19): a parent task with open
        // sub-tasks can't be completed (Items.completeItem enforces this —
        // see its header comment for why). Disabling the checkbox here is
        // the proactive half; completeItem's own guard is the backstop for
        // any path that bypasses this row (e.g. a stale rebuild).
        const openSubTaskCount = (itemData.type === 'task' && itemData.subTasks) ? itemData.subTasks.length : 0;
        const hasOpenSubTasks = openSubTaskCount > 0;

        const completeCheckboxLabel = document.createElement('label');
        completeCheckboxLabel.classList.add('completion-checkbox');
        completeCheckboxLabel.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 12px;' +
            (hasOpenSubTasks ? ' cursor: not-allowed; opacity: 0.6;' : ' cursor: pointer;');
        if (hasOpenSubTasks) {
            completeCheckboxLabel.title = `${openSubTaskCount} sub-task${openSubTaskCount === 1 ? '' : 's'} remaining`;
        }

        const completeCheckbox = document.createElement('input');
        completeCheckbox.type = 'checkbox';
        completeCheckbox.classList.add('completion-checkbox-input');
        completeCheckbox.disabled = hasOpenSubTasks;
        completeCheckbox.addEventListener('change', () => {
            if (completeCheckbox.checked) {
                deps.completeItem(itemData.id);
            }
        });

        const checkboxLabel = document.createTextNode(
            hasOpenSubTasks ? `Mark as Complete (${openSubTaskCount} remaining)` : 'Mark as Complete'
        );
        completeCheckboxLabel.appendChild(completeCheckbox);
        completeCheckboxLabel.appendChild(checkboxLabel);

        itemActionsContainer.appendChild(editIconButton);
        itemActionsContainer.appendChild(completeCheckboxLabel);

        titleAndControlsRow.appendChild(itemNameSpan);
        titleAndControlsRow.appendChild(itemActionsContainer);

        // Second row: Due date, category, and sub-task button
        const detailsAndSubTaskRow = document.createElement('div');
        detailsAndSubTaskRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

        // Container for due date and category on left side
        const itemDetailsContainer = document.createElement('div');
        itemDetailsContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        const itemDetailsSpan = document.createElement('span');
        itemDetailsSpan.classList.add('item-details');
        itemDetailsSpan.style.cssText = 'font-size: 12px; color: var(--color-neutral);';
        itemDetailsSpan.textContent = `Due: ${itemData.dueDateTime.toLocaleString([], {
            dateStyle: 'short',
            timeStyle: 'short'
        })}`;

        itemDetailsContainer.appendChild(itemDetailsSpan);
        detailsAndSubTaskRow.appendChild(itemDetailsContainer);

        itemInfoDiv.appendChild(titleAndControlsRow);
        itemInfoDiv.appendChild(detailsAndSubTaskRow);

        // Sub-tasks are a task-only concept (habits/other types never have
        // subTasks or the "+ Sub-task" affordance) — build this whole section
        // only for tasks, rather than relying on empty-but-present containers.
        let subTasksSectionDiv = null;
        if (itemData.type === 'task') {
            subTasksSectionDiv = document.createElement('div');
            subTasksSectionDiv.classList.add('sub-tasks-section');
            subTasksSectionDiv.style.cssText = 'width: 100%; margin-top: 8px;';

            // Add sub-task button - place it on the right side of details row
            const addSubTaskButton = document.createElement('button');
            addSubTaskButton.classList.add('add-subtask-button');
            addSubTaskButton.textContent = '+ Sub-task';
            addSubTaskButton.title = 'Add Sub-task';
            addSubTaskButton.style.cssText = 'font-size: 12px; padding: 4px 8px; flex-shrink: 0;';
            addSubTaskButton.addEventListener('click', () => {
                // Getter, not a captured boolean — see the header note.
                if (!deps.isGameOver()) {
                    deps.createSubTaskPrompt(itemData.id);
                }
            });
            // Add the sub-task button to the right side of the details row
            detailsAndSubTaskRow.appendChild(addSubTaskButton);

            // Create sub-tasks container
            const subTasksContainer = document.createElement('ul');
            subTasksContainer.classList.add('sub-tasks-container');

            // Add existing sub-tasks
            (itemData.subTasks || []).forEach(subTaskId => {
                const subTaskData = deps.activeItems.find(subItem => subItem.id === subTaskId);
                if (subTaskData) {
                    const subTaskItem = document.createElement('li');
                    subTaskItem.classList.add('sub-task-item');
                    subTaskItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--color-bg-light);';
                    subTaskItem.classList.add(`category-${subTaskData.category}`);

                    // Left side: Sub-task sprite and info
                    const subTaskSpriteDiv = document.createElement('div');
                    subTaskSpriteDiv.classList.add('item-sprite');
                    if (subTaskData.parentId) {
                        subTaskSpriteDiv.classList.add('zombie-subtask');
                        subTaskSpriteDiv.style.width = '32px';
                        subTaskSpriteDiv.style.height = '32px';
                    }

                    const subTaskInfo = document.createElement('div');
                    subTaskInfo.classList.add('sub-task-info');
                    subTaskInfo.style.cssText = 'flex-grow: 1; margin-left: 8px;';

                    const subTaskName = document.createElement('div');
                    subTaskName.style.cssText = 'font-weight: 500; margin-bottom: 4px;';
                    subTaskName.textContent = subTaskData.name;

                    const subTaskDetails = document.createElement('div');
                    subTaskDetails.style.cssText = 'font-size: 12px; color: var(--color-neutral);';
                    subTaskDetails.textContent = `Due: ${subTaskData.dueDateTime.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} | ${subTaskData.category}`;

                    subTaskInfo.appendChild(subTaskName);
                    subTaskInfo.appendChild(subTaskDetails);

                    // Right side: Controls (edit icon and checkbox)
                    const subTaskControls = document.createElement('div');
                    subTaskControls.classList.add('sub-task-controls');
                    subTaskControls.style.cssText = 'display: flex; align-items: center; gap: 12px;';

                    // Edit icon button
                    const subTaskEditIconButton = document.createElement('button');
                    subTaskEditIconButton.classList.add('edit-icon-btn');
                    subTaskEditIconButton.title = 'Edit Sub-task';
                    subTaskEditIconButton.textContent = '✏️';
                    subTaskEditIconButton.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px;';
                    subTaskEditIconButton.addEventListener('click', () => deps.showEditTaskModal(subTaskData));

                    // Completion checkbox with label
                    const subTaskCheckboxLabel = document.createElement('label');
                    subTaskCheckboxLabel.classList.add('completion-checkbox');
                    subTaskCheckboxLabel.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; padding-right: 8px;';

                    const subTaskCheckbox = document.createElement('input');
                    subTaskCheckbox.type = 'checkbox';
                    subTaskCheckbox.classList.add('sub-task-checkbox', 'completion-checkbox-input');
                    // Force the checkbox to be unchecked - comprehensive reset
                    subTaskCheckbox.checked = false;
                    subTaskCheckbox.defaultChecked = false;
                    subTaskCheckbox.removeAttribute('checked');
                    subTaskCheckbox.setAttribute('data-sub-task-id', subTaskData.id);

                    console.log(`DEBUG: Created sub-task checkbox for ${subTaskData.name}, checked: ${subTaskCheckbox.checked}`);

                    subTaskCheckbox.addEventListener('change', () => {
                        if (subTaskCheckbox.checked) {
                            deps.completeItem(subTaskData.id);
                        }
                    });

                    const subTaskCheckboxText = document.createTextNode('Mark as Complete');
                    subTaskCheckboxLabel.appendChild(subTaskCheckbox);
                    subTaskCheckboxLabel.appendChild(subTaskCheckboxText);

                    // Add controls to container
                    subTaskControls.appendChild(subTaskEditIconButton);
                    subTaskControls.appendChild(subTaskCheckboxLabel);

                    // Assemble the sub-task item
                    subTaskItem.appendChild(subTaskSpriteDiv);
                    subTaskItem.appendChild(subTaskInfo);
                    subTaskItem.appendChild(subTaskControls);

                    subTasksContainer.appendChild(subTaskItem);
                }
            });

            subTasksSectionDiv.appendChild(subTasksContainer);
        }

        // Add category badge next to due date
        const itemCategorySpan = document.createElement('span');
        itemCategorySpan.classList.add('item-category');
        itemCategorySpan.textContent = itemData.category.charAt(0).toUpperCase() + itemData.category.slice(1);

        const currentCategoryStyle = deps.categoryStyles[itemData.category] || deps.categoryStyles["other"];
        itemCategorySpan.style.backgroundColor = currentCategoryStyle.bgColor;
        if (currentCategoryStyle.textColorClass) {
            itemCategorySpan.classList.add(currentCategoryStyle.textColorClass);
        }
        itemDetailsContainer.appendChild(itemCategorySpan);

        // Sub-task progress label ([P1-DATA-004] sub-session 5, 2026-07-19):
        // "N/M sub-tasks" for any task that has EVER had a sub-task, live —
        // completed count comes from `completedSubTasks` (persists across
        // completions), open count from the live `subTasks` array; M is their
        // sum so a sub deleted rather than completed still counts toward the
        // total it once had. No new hook needed: every path that changes
        // either number (completeItem, removeItem, popups.js's sub-task
        // creation, the uncomplete re-link path) already rebuilds the
        // parent's listItemElement via createListItem, same pattern as the
        // sub-session-4 growing/shrinking box.
        if (itemData.type === 'task') {
            const completedSubTasks = itemData.completedSubTasks || 0;
            const openSubTasks = (itemData.subTasks || []).length;
            const totalSubTasksEver = completedSubTasks + openSubTasks;
            if (totalSubTasksEver > 0) {
                const subTaskProgressSpan = document.createElement('span');
                subTaskProgressSpan.classList.add('sub-task-progress');
                subTaskProgressSpan.style.cssText = 'font-size: 12px; color: var(--color-neutral);';
                subTaskProgressSpan.textContent = `${completedSubTasks}/${totalSubTasksEver} sub-tasks`;
                itemDetailsContainer.appendChild(subTaskProgressSpan);
            }
        }

        // Add streak info for habits
        if (itemData.type === 'habit') {
            const streakSpan = document.createElement('span');
            streakSpan.classList.add('item-streak');
            const streakType = itemData.isNegative ? 'Avoided' : 'Streak';
            streakSpan.textContent = `${streakType}: ${itemData.streak}`;
            itemDetailsContainer.appendChild(streakSpan);
        } else if (itemData.type !== 'task') {
            // Defensive: any future item type falls through to the shared
            // shell only, rather than silently breaking like habits used to.
            console.warn('createListItem: unrecognized item type', itemData.type, '- rendering shared shell only.');
        }

        // Create a wrapper div for the whole task content
        const taskContentDiv = document.createElement('div');
        taskContentDiv.style.cssText = 'display: flex; flex-direction: column; width: 100%;';

        taskContentDiv.appendChild(itemInfoDiv);
        if (subTasksSectionDiv) {
            taskContentDiv.appendChild(subTasksSectionDiv);
        }

        listItem.appendChild(itemSpriteDiv);
        listItem.appendChild(taskContentDiv);

        itemData.listItemElement = listItem;
    }

    /**
     * Sort activeItems by due date and re-render the top-level rows into the
     * active-items list. Sub-tasks are never appended here — they render
     * nested inside their parent's row (see createListItem).
     *
     * deps: { activeItems, activeItemsListUL }
     */
    function sortAndRenderActiveList(deps) {
        // Sort by due date (most urgent first)
        deps.activeItems.sort((a, b) => a.dueDateTime - b.dueDateTime);

        if (deps.activeItemsListUL) {
            deps.activeItemsListUL.innerHTML = '';

            deps.activeItems.forEach(item => {
                // Only show top-level items (not sub-tasks) in the main list
                if (item.listItemElement && !item.parentId) {
                    deps.activeItemsListUL.appendChild(item.listItemElement);
                }
            });

            // After rendering, ensure all sub-task checkboxes are properly reset
            setTimeout(() => {
                resetAllSubTaskCheckboxes();
            }, 0);
        }
    }

    // Utility function to comprehensively reset all sub-task checkboxes.
    // No script.js state — queries the live DOM directly, so it takes no deps.
    function resetAllSubTaskCheckboxes() {
        const allSubTaskCheckboxes = document.querySelectorAll('.sub-task-checkbox');
        console.log(`DEBUG: resetAllSubTaskCheckboxes found ${allSubTaskCheckboxes.length} checkboxes`);

        allSubTaskCheckboxes.forEach((checkbox, index) => {
            const wasChecked = checkbox.checked;
            const subTaskId = checkbox.getAttribute('data-sub-task-id');

            // Multiple methods to ensure unchecked state
            checkbox.checked = false;
            checkbox.defaultChecked = false;
            checkbox.removeAttribute('checked');

            // Force property update
            Object.defineProperty(checkbox, 'checked', {
                value: false,
                writable: true,
                configurable: true
            });

            // Re-enable normal property behavior
            delete checkbox.checked;
            checkbox.checked = false;

            if (wasChecked) {
                console.log(`DEBUG: Reset checkbox for sub-task ${subTaskId}, was checked: ${wasChecked}, now checked: ${checkbox.checked}`);
            }
        });
    }

    /**
     * Build one nested, greyed row for a completed sub-task under its
     * parent's Completed Today entry ([P1-DATA-004] sub-session 5,
     * 2026-07-19). DISPLAY-ONLY — no edit button, no uncomplete checkbox.
     * This wasn't the original design (an interactive checkbox mirroring the
     * top-level builder was tried first) but live-Chrome testing surfaced a
     * real orphan-hole variant: Items.uncompleteItem only re-links a sub to
     * its parent's subTasks/completedSubTasks counters by looking the parent
     * up in the live `activeItems` array — but a parent whose own
     * completion is what put this sub in Completed Today has ALREADY been
     * removed from activeItems, so that lookup fails silently, the sub gets
     * pushed back into activeItems as a live zombie with a dangling
     * parentId, and (since nested-only rendering excludes any item with a
     * parentId from the top-level list) it becomes agenda-invisible while
     * still damaging the base — the same class of bug sub-session 1 closed
     * for completion/deletion, just reached through a NEW path this
     * session's nesting UI is what made reachable at all (no prior surface
     * ever showed a completed sub to un-check). Fixing uncompleteItem itself
     * is a mechanics change outside this session's UI-only scope, so the
     * chosen fix is narrower: don't render the affordance that reaches the
     * bug. A sub-task's completion is final from this view; only the
     * top-level item's "Completed" checkbox remains interactive. See
     * DECISIONS.md.
     */
    function buildCompletedSubTaskRow(subItem, deps) {
        const li = document.createElement('li');
        li.classList.add('completed-item', 'completed-sub-item');
        li.classList.add(`category-${subItem.category}`);

        const itemSpriteDiv = document.createElement('div');
        itemSpriteDiv.classList.add('item-sprite');

        const itemInfoDiv = document.createElement('div');
        itemInfoDiv.classList.add('item-info');

        const itemNameSpan = document.createElement('span');
        itemNameSpan.classList.add('item-name');
        itemNameSpan.textContent = subItem.name;

        const itemCompletedSpan = document.createElement('span');
        itemCompletedSpan.classList.add('item-completed');
        itemCompletedSpan.textContent = `Completed: ${subItem.completedAt.toLocaleString([], {
            dateStyle: 'short',
            timeStyle: 'short'
        })}`;

        itemInfoDiv.appendChild(itemNameSpan);
        itemInfoDiv.appendChild(itemCompletedSpan);

        const itemCategorySpan = document.createElement('span');
        itemCategorySpan.classList.add('item-category');
        itemCategorySpan.textContent = subItem.category.charAt(0).toUpperCase() + subItem.category.slice(1);

        const currentCategoryStyle = deps.categoryStyles[subItem.category] || deps.categoryStyles["other"];
        itemCategorySpan.style.backgroundColor = currentCategoryStyle.bgColor;
        if (currentCategoryStyle.textColorClass) {
            itemCategorySpan.classList.add(currentCategoryStyle.textColorClass);
        }
        itemInfoDiv.appendChild(itemCategorySpan);

        // Static "Completed" badge — NOT an interactive checkbox. See the
        // function header comment for why this row deliberately offers no
        // way to uncomplete a nested sub from this view.
        const itemStatusDiv = document.createElement('div');
        itemStatusDiv.classList.add('item-status');
        itemStatusDiv.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px; align-items: center; height: 100%;';

        const completedBadge = document.createElement('span');
        completedBadge.classList.add('completed-sub-badge');
        completedBadge.textContent = '✓ Completed';
        itemStatusDiv.appendChild(completedBadge);

        li.appendChild(itemSpriteDiv);
        li.appendChild(itemInfoDiv);
        li.appendChild(itemStatusDiv);

        return li;
    }

    /**
     * Render the completed-items list (below the active agenda). Completed
     * sub-tasks render nested/greyed directly under their parent's entry
     * ([P1-DATA-004] sub-session 5, 2026-07-19 — via buildCompletedSubTaskRow)
     * rather than as their own top-level rows.
     *
     * deps: { completedItems (getter), categoryStyles, showEditTaskModal,
     *         uncompleteItem }
     */
    function renderCompletedItems(deps) {
        const completedTasksSection = document.getElementById('completedTasksSection');
        const completedItemsList = document.getElementById('completedItemsList');

        if (!completedTasksSection || !completedItemsList) return;

        const completedItems = deps.completedItems();

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

                const currentCategoryStyle = deps.categoryStyles[item.category] || deps.categoryStyles["other"];
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
                editIconButton.addEventListener('click', () => deps.showEditTaskModal(item));
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
                        deps.uncompleteItem(item.id);
                    }
                });
                completeCheckboxLabel.appendChild(completeCheckbox);
                completeCheckboxLabel.appendChild(document.createTextNode(' Completed'));

                itemStatusDiv.appendChild(completeCheckboxLabel);

                li.appendChild(itemSpriteDiv);
                li.appendChild(itemInfoDiv);
                li.appendChild(itemStatusDiv);

                completedItemsList.appendChild(li);

                // Nested completed sub-tasks ([P1-DATA-004] sub-session 5):
                // pulled from the SAME completedItems list (subs land there
                // via their own completeItem call, same as any top-level
                // item — only the top-level render skip at the top of this
                // forEach kept them from ever being drawn before this
                // session), matched by parentId, most-recently-completed
                // first to match the parent list's own sort.
                sortedCompletedItems
                    .filter(sub => sub.parentId === item.id)
                    .forEach(sub => {
                        completedItemsList.appendChild(buildCompletedSubTaskRow(sub, deps));
                    });
            });
        } else {
            completedTasksSection.classList.add('hidden');
        }
    }

    /**
     * Habit-specific: resolve an active habit instance back to its
     * definition and open the definition editor. Habits have no per-instance
     * editor today (only the routine-context habitDef editor), so this is
     * the closest correct "edit" action; saveEditedHabit() keeps active
     * instances in sync.
     *
     * deps: { definedHabits (getter), showEditHabitForm }
     */
    function showEditHabitInstanceModal(itemData, deps) {
        const habitDef = deps.definedHabits().find(d => d.id === itemData.definitionId);
        if (!habitDef) {
            console.error('Edit habit: no definedHabits entry for definitionId', itemData.definitionId);
            return;
        }
        deps.showEditHabitForm(null, habitDef);
    }

    return {
        createListItem,
        sortAndRenderActiveList,
        resetAllSubTaskCheckboxes,
        renderCompletedItems,
        buildCompletedSubTaskRow,
        showEditHabitInstanceModal
    };
})();

// Node/Jest interop — the browser gets the bare global above.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgendaList;
}

/**
 * Agenda list — part 1 (Milestone 2 UI extraction, session 6, 2026-07-18).
 *
 * Extracted from script.js per docs/UI_EXTRACTION_PLAN.md session 6:
 * createListItem only — the task/habit branching shell and row construction.
 * Part 2 (sortAndRenderActiveList, renderCompletedItems,
 * resetAllSubTaskCheckboxes, showEditHabitInstanceModal) is session 7.
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

        const completeCheckboxLabel = document.createElement('label');
        completeCheckboxLabel.classList.add('completion-checkbox');
        completeCheckboxLabel.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;';

        const completeCheckbox = document.createElement('input');
        completeCheckbox.type = 'checkbox';
        completeCheckbox.classList.add('completion-checkbox-input');
        completeCheckbox.addEventListener('change', () => {
            if (completeCheckbox.checked) {
                deps.completeItem(itemData.id);
            }
        });

        const checkboxLabel = document.createTextNode('Mark as Complete');
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

    return { createListItem };
})();

// Node/Jest interop — the browser gets the bare global above.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgendaList;
}

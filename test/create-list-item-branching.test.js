/**
 * Regression tests for createListItem's type branching.
 *
 * Context: the "habit modal doesn't close" bug (2026-07-17) was actually two
 * habit-unsafe references inside createListItem (an unconditional
 * `itemData.subTasks.forEach`, and a phantom `itemNameContainer` var) that
 * threw for every habit and silently aborted the caller before it could
 * close the modal. createListItem was refactored into an explicit shared
 * shell + type branches (task / habit / unknown-default) specifically to
 * make that class of bug impossible to reintroduce.
 *
 * script.js has no module.exports (everything lives inside a single
 * DOMContentLoaded closure — see docs/ARCHITECTURE.md, Milestone 2 will fix
 * this), so — matching the existing convention in
 * test/subtask-creation.test.js — this is a hand-maintained MIRROR of
 * createListItem's branching structure, not a `require` of the real
 * function. It catches regressions to the branch structure itself (e.g. a
 * future edit accidentally moving a task-only reference back into the
 * shared shell). It does NOT prove script.js's actual implementation is
 * bug-free — that was verified live in a real browser (Cowork's Chrome
 * control against `node server.js`) when the bug was fixed, and should be
 * re-verified live after any further changes to createListItem.
 */

function makeElement() {
    return {
        classList: {
            add: jest.fn(),
            remove: jest.fn(),
            toggle: jest.fn(),
            contains: jest.fn()
        },
        style: {},
        dataset: {},
        addEventListener: jest.fn(),
        textContent: '',
        appendChild: jest.fn(),
        remove: jest.fn()
    };
}

global.document = { createElement: jest.fn(() => makeElement()) };

const categoryStyles = { other: { bgColor: '#ccc' } };

/**
 * Mirror of createListItem's branch structure post-refactor. Delegates the
 * editor choice and type-specific sections exactly like script.js does.
 */
function createListItem(itemData, { onEditTask, onEditHabit, warn }) {
    const listItem = document.createElement('li');

    listItem.classList.add(`category-${itemData.category}`);
    if (itemData.type === 'task' && itemData.isHighPriority) {
        listItem.classList.add('high-priority-list-item');
    }
    // Derived from state, so REBUILDS of an already-overdue item's row keep the
    // highlight (markAsOverdue early-returns once isOverdue is already true).
    if (itemData.isOverdue) {
        listItem.classList.add('overdue-list-item');
    }

    const itemSpriteDiv = document.createElement('div');
    const itemInfoDiv = document.createElement('div');
    const titleAndControlsRow = document.createElement('div');
    const itemNameSpan = document.createElement('span');
    const itemActionsContainer = document.createElement('div');

    const editIconButton = document.createElement('button');
    if (itemData.type === 'habit') {
        editIconButton.title = 'Edit Habit';
        editIconButton.addEventListener('click', () => onEditHabit(itemData));
    } else {
        editIconButton.title = 'Edit Task';
        editIconButton.addEventListener('click', () => onEditTask(itemData));
    }

    const detailsAndSubTaskRow = document.createElement('div');
    const itemDetailsContainer = document.createElement('div');
    const itemCategorySpan = document.createElement('span');
    itemDetailsContainer.appendChild(itemCategorySpan);

    let subTasksSectionDiv = null;
    if (itemData.type === 'task') {
        subTasksSectionDiv = document.createElement('div');
        const addSubTaskButton = document.createElement('button');
        detailsAndSubTaskRow.appendChild(addSubTaskButton);
        // Real code guards with (itemData.subTasks || []) — mirrored here.
        (itemData.subTasks || []).forEach(() => {});
    }

    let streakBadgeAdded = false;
    if (itemData.type === 'habit') {
        const streakSpan = document.createElement('span');
        itemDetailsContainer.appendChild(streakSpan);
        streakBadgeAdded = true;
    } else if (itemData.type !== 'task') {
        warn('createListItem: unrecognized item type', itemData.type);
    }

    const taskContentDiv = document.createElement('div');
    taskContentDiv.appendChild(itemInfoDiv);
    if (subTasksSectionDiv) {
        taskContentDiv.appendChild(subTasksSectionDiv);
    }
    listItem.appendChild(itemSpriteDiv);
    listItem.appendChild(taskContentDiv);

    itemData.listItemElement = listItem;

    return { editIconButton, hasSubTaskSection: !!subTasksSectionDiv, streakBadgeAdded, listItem };
}

// Convenience: the class names passed to listItem.classList.add.
function classesOf(listItem) {
    return listItem.classList.add.mock.calls.map(c => c[0]);
}

describe('createListItem type branching', () => {
    let onEditTask, onEditHabit, warn;

    beforeEach(() => {
        jest.clearAllMocks();
        onEditTask = jest.fn();
        onEditHabit = jest.fn();
        warn = jest.fn();
    });

    test('renders a task without throwing, wires the task editor, includes sub-tasks', () => {
        const task = { id: 1, type: 'task', name: 'Write report', category: 'other', subTasks: [] };

        expect(() => createListItem(task, { onEditTask, onEditHabit, warn })).not.toThrow();
        const result = createListItem(task, { onEditTask, onEditHabit, warn });

        expect(result.editIconButton.title).toBe('Edit Task');
        expect(result.hasSubTaskSection).toBe(true);
        expect(result.streakBadgeAdded).toBe(false);

        // Simulate the click the real button would receive.
        const clickHandler = result.editIconButton.addEventListener.mock.calls[0][1];
        clickHandler();
        expect(onEditTask).toHaveBeenCalledWith(task);
        expect(onEditHabit).not.toHaveBeenCalled();
    });

    test('renders a habit without throwing (no subTasks field), wires the habit editor, shows streak badge', () => {
        // Deliberately omit `subTasks` — habit instances never set it. This is
        // exactly the field whose unconditional .forEach() used to throw.
        const habit = { id: 2, type: 'habit', name: 'Exercise', category: 'health', streak: 3, isNegative: false, definitionId: 'habitDef_0_1' };

        expect(() => createListItem(habit, { onEditTask, onEditHabit, warn })).not.toThrow();
        const result = createListItem(habit, { onEditTask, onEditHabit, warn });

        expect(result.editIconButton.title).toBe('Edit Habit');
        expect(result.hasSubTaskSection).toBe(false);
        expect(result.streakBadgeAdded).toBe(true);

        const clickHandler = result.editIconButton.addEventListener.mock.calls[0][1];
        clickHandler();
        expect(onEditHabit).toHaveBeenCalledWith(habit);
        expect(onEditTask).not.toHaveBeenCalled();
    });

    test('renders an unrecognized item type without throwing, warns, and skips type-specific sections', () => {
        const mystery = { id: 3, type: 'mystery-future-type', name: '???', category: 'other' };

        expect(() => createListItem(mystery, { onEditTask, onEditHabit, warn })).not.toThrow();
        const result = createListItem(mystery, { onEditTask, onEditHabit, warn });

        expect(result.hasSubTaskSection).toBe(false);
        expect(result.streakBadgeAdded).toBe(false);
        expect(warn).toHaveBeenCalledWith('createListItem: unrecognized item type', 'mystery-future-type');
        // Unknown types default to the task editor (defensive fallback), never throw.
        expect(result.editIconButton.title).toBe('Edit Task');
    });
});

/**
 * Regression: overdue styling must be DERIVED from itemData.isOverdue.
 *
 * Bug (found live 2026-07-18): an overdue task whose row got rebuilt — by
 * editing its due date, by adding a sub-task, or by restoring a save whose
 * parent has sub-tasks — rendered WITHOUT the red highlight, while its sprite
 * kept the red box. markAsOverdue is the only other place that adds the class,
 * and it early-returns when isOverdue is already true, so it styles the row
 * only on the TRANSITION into overdue and never on a rebuild.
 */
describe('createListItem overdue styling', () => {
    let onEditTask, onEditHabit, warn;

    beforeEach(() => {
        jest.clearAllMocks();
        onEditTask = jest.fn();
        onEditHabit = jest.fn();
        warn = jest.fn();
    });

    const deps = () => ({ onEditTask, onEditHabit, warn });

    test('an overdue task gets the overdue class', () => {
        const task = { id: 1, type: 'task', name: 'Late', category: 'other', subTasks: [], isOverdue: true };
        const { listItem } = createListItem(task, deps());
        expect(classesOf(listItem)).toContain('overdue-list-item');
    });

    test('a not-yet-overdue task does not', () => {
        const task = { id: 2, type: 'task', name: 'Later', category: 'other', subTasks: [], isOverdue: false };
        const { listItem } = createListItem(task, deps());
        expect(classesOf(listItem)).not.toContain('overdue-list-item');
    });

    test('an item with no isOverdue field at all does not', () => {
        const task = { id: 3, type: 'task', name: 'Fresh', category: 'other', subTasks: [] };
        const { listItem } = createListItem(task, deps());
        expect(classesOf(listItem)).not.toContain('overdue-list-item');
    });

    test('REBUILDING an already-overdue row keeps the highlight (the actual bug)', () => {
        const task = { id: 4, type: 'task', name: 'Edited', category: 'other', subTasks: [], isOverdue: true };
        createListItem(task, deps());          // original row
        jest.clearAllMocks();
        const { listItem } = createListItem(task, deps()); // rebuild after an edit
        expect(classesOf(listItem)).toContain('overdue-list-item');
    });

    test('overdue habits are highlighted too, not just tasks', () => {
        const habit = { id: 5, type: 'habit', name: 'Missed', category: 'other', streak: 0, isOverdue: true };
        const { listItem } = createListItem(habit, deps());
        expect(classesOf(listItem)).toContain('overdue-list-item');
    });

    test('overdue and high-priority coexist', () => {
        const task = {
            id: 6, type: 'task', name: 'Urgent+Late', category: 'other',
            subTasks: [], isHighPriority: true, isOverdue: true
        };
        const { listItem } = createListItem(task, deps());
        const classes = classesOf(listItem);
        expect(classes).toContain('high-priority-list-item');
        expect(classes).toContain('overdue-list-item');
        expect(classes).toContain('category-other');
    });
});

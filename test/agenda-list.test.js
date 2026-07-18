/**
 * Tests for the REAL js/ui/agendaList.js module (Milestone 2 UI extraction,
 * session 6, 2026-07-18).
 *
 * How this differs from test/create-list-item-branching.test.js: that file is
 * a hand-maintained MIRROR of createListItem's branch structure, written when
 * the function still lived inside script.js's DOMContentLoaded closure with
 * no module.exports. It documents that limitation in its own header. Now that
 * createListItem has been extracted into a real CommonJS module, the function
 * can finally be require()'d and executed directly — so this file exercises
 * the actual shipped code rather than a copy of its shape.
 *
 * The mirror file is deliberately left in place for now: retiring it is a
 * separate decision (it still guards the branch structure, and deleting a
 * regression test for the project's most bug-prone function shouldn't be a
 * side effect of an extraction session). Flagged in HANDOFF for session 7.
 *
 * Primary focus here is the ONE behavioral decision made during the
 * extraction: gameIsOver is passed as a getter (deps.isGameOver()) rather
 * than a captured boolean, because the "+ Sub-task" click handler outlives
 * the createListItem call. A snapshotted boolean would let rows built before
 * game-over keep spawning sub-tasks afterward. That is exactly what the
 * "captured-at-build-time" test below pins down.
 */

const AgendaList = require('../js/ui/agendaList.js');

// Minimal DOM stand-in. testEnvironment is 'node' (see jest.config.js), so
// there is no real document; these fakes record enough to assert on classes,
// text, and — critically — to fire the registered click/change listeners.
function makeElement(tag) {
    const el = {
        tagName: tag,
        classList: {
            _set: new Set(),
            add(...names) { names.forEach(n => el.classList._set.add(n)); },
            remove(n) { el.classList._set.delete(n); },
            contains(n) { return el.classList._set.has(n); }
        },
        style: { cssText: '' },
        dataset: {},
        children: [],
        listeners: {},
        textContent: '',
        title: '',
        type: '',
        checked: false,
        defaultChecked: false,
        addEventListener(evt, fn) { (el.listeners[evt] = el.listeners[evt] || []).push(fn); },
        removeAttribute() {},
        setAttribute(k, v) { el.dataset[k] = v; },
        appendChild(child) { el.children.push(child); return child; },
        fire(evt) { (el.listeners[evt] || []).forEach(fn => fn()); }
    };
    return el;
}

/** Depth-first walk of everything appended under a root element. */
function walk(el, out = []) {
    out.push(el);
    (el.children || []).forEach(c => { if (c && c.children) walk(c, out); });
    return out;
}

function findByClass(root, className) {
    return walk(root).filter(e => e.classList && e.classList.contains(className));
}

function findByText(root, text) {
    return walk(root).filter(e => e.textContent === text);
}

beforeEach(() => {
    global.document = {
        createElement: jest.fn(tag => makeElement(tag)),
        createTextNode: jest.fn(text => ({ textContent: text, nodeType: 3 }))
    };
    global.console.log = jest.fn();   // silence the retained DEBUG: sub-task log
    global.console.warn = jest.fn();
});

const categoryStyles = {
    work: { bgColor: '#123456', textColorClass: 'text-light' },
    other: { bgColor: '#cccccc' }
};

function makeDeps(overrides = {}) {
    return {
        activeItems: [],
        categoryStyles,
        completeItem: jest.fn(),
        isGameOver: () => false,
        showEditTaskModal: jest.fn(),
        showEditHabitInstanceModal: jest.fn(),
        createSubTaskPrompt: jest.fn(),
        ...overrides
    };
}

function makeTask(over = {}) {
    return {
        id: 't1',
        type: 'task',
        name: 'Write the thing',
        category: 'work',
        dueDateTime: new Date('2026-07-18T12:00:00Z'),
        subTasks: [],
        ...over
    };
}

function makeHabit(over = {}) {
    return {
        id: 'h1',
        type: 'habit',
        name: 'Stretch',
        category: 'other',
        dueDateTime: new Date('2026-07-18T12:00:00Z'),
        streak: 4,
        ...over
    };
}

describe('AgendaList.createListItem — game-over gating (the getter decision)', () => {
    test('sub-task prompt is blocked when the game is over at CLICK time, even though the row was built while the game was live', () => {
        // This is the regression the getter exists to prevent. Under the old
        // flat-boolean deps pattern used by sessions 3-5, this row would have
        // captured `gameIsOver === false` at build time and kept honouring
        // clicks forever.
        let gameIsOver = false;
        const deps = makeDeps({ isGameOver: () => gameIsOver });
        const task = makeTask();

        AgendaList.createListItem(task, deps);

        const addBtn = findByText(task.listItemElement, '+ Sub-task')[0];
        expect(addBtn).toBeDefined();

        addBtn.fire('click');
        expect(deps.createSubTaskPrompt).toHaveBeenCalledTimes(1);

        gameIsOver = true;            // game ends AFTER the row was rendered
        addBtn.fire('click');
        expect(deps.createSubTaskPrompt).toHaveBeenCalledTimes(1);  // still 1

        gameIsOver = false;           // and it recovers if the flag clears
        addBtn.fire('click');
        expect(deps.createSubTaskPrompt).toHaveBeenCalledTimes(2);
    });

    test('passes the parent task id to createSubTaskPrompt', () => {
        const deps = makeDeps();
        const task = makeTask({ id: 'parent-42' });

        AgendaList.createListItem(task, deps);
        findByText(task.listItemElement, '+ Sub-task')[0].fire('click');

        expect(deps.createSubTaskPrompt).toHaveBeenCalledWith('parent-42');
    });
});

describe('AgendaList.createListItem — type branching', () => {
    test('a task gets the sub-tasks section and the task editor', () => {
        const deps = makeDeps();
        const task = makeTask();

        AgendaList.createListItem(task, deps);
        const root = task.listItemElement;

        expect(findByClass(root, 'sub-tasks-section')).toHaveLength(1);
        expect(findByText(root, '+ Sub-task')).toHaveLength(1);

        const pencil = findByClass(root, 'edit-icon-btn')[0];
        expect(pencil.title).toBe('Edit Task');
        pencil.fire('click');
        expect(deps.showEditTaskModal).toHaveBeenCalledWith(task);
        expect(deps.showEditHabitInstanceModal).not.toHaveBeenCalled();
    });

    test('a habit gets NO sub-tasks section, a streak badge, and the habit editor', () => {
        const deps = makeDeps();
        const habit = makeHabit();

        AgendaList.createListItem(habit, deps);
        const root = habit.listItemElement;

        // The 2026-07-17 "habit modal doesn't close" bug was an unconditional
        // subTasks.forEach in the shared shell — habits must never build this.
        expect(findByClass(root, 'sub-tasks-section')).toHaveLength(0);
        expect(findByText(root, '+ Sub-task')).toHaveLength(0);

        expect(findByClass(root, 'item-streak')[0].textContent).toBe('Streak: 4');

        const pencil = findByClass(root, 'edit-icon-btn')[0];
        expect(pencil.title).toBe('Edit Habit');
        pencil.fire('click');
        expect(deps.showEditHabitInstanceModal).toHaveBeenCalledWith(habit);
        expect(deps.showEditTaskModal).not.toHaveBeenCalled();
    });

    test('a negative habit reads "Avoided" instead of "Streak"', () => {
        const habit = makeHabit({ isNegative: true, streak: 9 });
        AgendaList.createListItem(habit, makeDeps());
        expect(findByClass(habit.listItemElement, 'item-streak')[0].textContent).toBe('Avoided: 9');
    });

    test('an unrecognized type renders the shared shell and warns rather than throwing', () => {
        const odd = { id: 'x1', type: 'quest', name: 'Mystery', category: 'other', dueDateTime: new Date() };

        expect(() => AgendaList.createListItem(odd, makeDeps())).not.toThrow();
        expect(console.warn).toHaveBeenCalled();
        expect(findByClass(odd.listItemElement, 'sub-tasks-section')).toHaveLength(0);
        expect(findByClass(odd.listItemElement, 'item-streak')).toHaveLength(0);
    });
});

describe('AgendaList.createListItem — row state derived from item data', () => {
    test('an already-overdue item gets the overdue class on REBUILD', () => {
        // Rebuild-idempotency: markAsOverdue early-returns once isOverdue is
        // true, so the class has to be derived here or rebuilt rows lose it.
        const task = makeTask({ isOverdue: true });
        AgendaList.createListItem(task, makeDeps());
        expect(task.listItemElement.classList.contains('overdue-list-item')).toBe(true);
    });

    test('high priority applies only to tasks', () => {
        const task = makeTask({ isHighPriority: true });
        AgendaList.createListItem(task, makeDeps());
        expect(task.listItemElement.classList.contains('high-priority-list-item')).toBe(true);

        const habit = makeHabit({ isHighPriority: true });
        AgendaList.createListItem(habit, makeDeps());
        expect(habit.listItemElement.classList.contains('high-priority-list-item')).toBe(false);
    });

    test('unknown categories fall back to the "other" style rather than throwing', () => {
        const task = makeTask({ category: 'nonexistent' });
        expect(() => AgendaList.createListItem(task, makeDeps())).not.toThrow();
        expect(findByClass(task.listItemElement, 'item-category')[0].style.backgroundColor)
            .toBe(categoryStyles.other.bgColor);
    });

    test('the completion checkbox only completes when it becomes checked', () => {
        const deps = makeDeps();
        const task = makeTask();
        AgendaList.createListItem(task, deps);

        const box = findByClass(task.listItemElement, 'completion-checkbox-input')[0];
        box.fire('change');                       // unchecked -> no-op
        expect(deps.completeItem).not.toHaveBeenCalled();

        box.checked = true;
        box.fire('change');
        expect(deps.completeItem).toHaveBeenCalledWith('t1');
    });
});

describe('AgendaList.createListItem — sub-task rendering', () => {
    const subTask = {
        id: 's1',
        type: 'task',
        name: 'Sub one',
        category: 'work',
        parentId: 't1',
        dueDateTime: new Date('2026-07-18T15:00:00Z')
    };

    test('renders one row per resolvable sub-task id', () => {
        const deps = makeDeps({ activeItems: [subTask] });
        const task = makeTask({ subTasks: ['s1'] });

        AgendaList.createListItem(task, deps);
        expect(findByClass(task.listItemElement, 'sub-task-item')).toHaveLength(1);
    });

    test('silently skips sub-task ids that are not in activeItems', () => {
        // e.g. a completed sub-task still listed on the parent.
        const deps = makeDeps({ activeItems: [] });
        const task = makeTask({ subTasks: ['ghost'] });

        expect(() => AgendaList.createListItem(task, deps)).not.toThrow();
        expect(findByClass(task.listItemElement, 'sub-task-item')).toHaveLength(0);
    });

    test('sub-task checkboxes always start unchecked (guards the historic duplication/stale-state bug)', () => {
        const deps = makeDeps({ activeItems: [subTask] });
        const task = makeTask({ subTasks: ['s1'] });

        AgendaList.createListItem(task, deps);
        const box = findByClass(task.listItemElement, 'sub-task-checkbox')[0];
        expect(box.checked).toBe(false);
        expect(box.defaultChecked).toBe(false);
    });

    test('a sub-task completes itself, not its parent', () => {
        const deps = makeDeps({ activeItems: [subTask] });
        const task = makeTask({ subTasks: ['s1'] });

        AgendaList.createListItem(task, deps);
        const box = findByClass(task.listItemElement, 'sub-task-checkbox')[0];
        box.checked = true;
        box.fire('change');

        expect(deps.completeItem).toHaveBeenCalledWith('s1');
        expect(deps.completeItem).not.toHaveBeenCalledWith('t1');
    });

    test("a sub-task's pencil edits the sub-task, not its parent", () => {
        const deps = makeDeps({ activeItems: [subTask] });
        const task = makeTask({ subTasks: ['s1'] });

        AgendaList.createListItem(task, deps);
        const subRow = findByClass(task.listItemElement, 'sub-task-item')[0];
        const pencil = findByClass(subRow, 'edit-icon-btn')[0];

        expect(pencil.title).toBe('Edit Sub-task');
        pencil.fire('click');
        expect(deps.showEditTaskModal).toHaveBeenCalledWith(subTask);
    });

    test('a task with no subTasks array still renders (no unconditional forEach)', () => {
        const task = makeTask();
        delete task.subTasks;
        expect(() => AgendaList.createListItem(task, makeDeps())).not.toThrow();
    });
});

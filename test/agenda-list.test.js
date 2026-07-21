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
            contains(n) { return el.classList._set.has(n); },
            toggle(n, force) {
                const shouldHave = force === undefined ? !el.classList._set.has(n) : !!force;
                if (shouldHave) el.classList._set.add(n); else el.classList._set.delete(n);
                return shouldHave;
            }
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
        // A minimal fake event (stopPropagation/preventDefault no-ops) is
        // passed to every handler — harmless for the many existing handlers
        // that never read their event arg, and needed by the onboarding CTA
        // handler below, which calls e.stopPropagation() for real (see
        // js/ui/agendaList.js's Milestone 5 first-run/onboarding pass).
        fire(evt) {
            const fakeEvent = { stopPropagation() {}, preventDefault() {} };
            (el.listeners[evt] || []).forEach(fn => fn(fakeEvent));
        }
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
        createTextNode: jest.fn(text => ({ textContent: text, nodeType: 3 })),
        // sortAndRenderActiveList's setTimeout(0) always calls
        // resetAllSubTaskCheckboxes, which queries document.querySelectorAll
        // directly (no deps) — needed by ANY test that exercises
        // sortAndRenderActiveList, not just the onboarding suite below,
        // since the callback fires asynchronously after the test body
        // returns. Empty by default; individual tests never need real
        // checkbox nodes here (sub-task checkbox behavior has its own
        // dedicated coverage elsewhere).
        querySelectorAll: jest.fn(() => [])
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

describe('AgendaList.createListItem — sub-task progress label ([P1-DATA-004] sub-session 5)', () => {
    test('a task that never had a sub-task shows no progress label', () => {
        const task = makeTask(); // subTasks: [], no completedSubTasks field
        AgendaList.createListItem(task, makeDeps());
        expect(findByClass(task.listItemElement, 'sub-task-progress')).toHaveLength(0);
    });

    test('shows "N/M sub-tasks" combining completed + still-open counts', () => {
        const task = makeTask({ subTasks: ['s1', 's2'], completedSubTasks: 1 });
        AgendaList.createListItem(task, makeDeps({ activeItems: [] }));
        const label = findByClass(task.listItemElement, 'sub-task-progress')[0];
        expect(label.textContent).toBe('1/3 sub-tasks'); // 1 done + 2 still open = 3 ever
    });

    test('all subs completed and none open still shows the full count, not blank', () => {
        const task = makeTask({ subTasks: [], completedSubTasks: 3 });
        AgendaList.createListItem(task, makeDeps());
        const label = findByClass(task.listItemElement, 'sub-task-progress')[0];
        expect(label.textContent).toBe('3/3 sub-tasks');
    });

    test('a habit never renders the progress label even if the field is somehow present', () => {
        const habit = makeHabit({ completedSubTasks: 2, subTasks: ['x'] });
        AgendaList.createListItem(habit, makeDeps());
        expect(findByClass(habit.listItemElement, 'sub-task-progress')).toHaveLength(0);
    });
});

describe('AgendaList.renderCompletedItems — nested completed sub-tasks ([P1-DATA-004] sub-session 5)', () => {
    let completedTasksSection, completedItemsList;

    beforeEach(() => {
        completedTasksSection = makeElement('div');
        completedItemsList = makeElement('ul');
        const elementsById = {
            completedTasksSection,
            completedItemsList
        };
        global.document.getElementById = jest.fn(id => elementsById[id]);
    });

    const categoryStyles = { work: { bgColor: '#123456' }, other: { bgColor: '#ccc' } };

    function makeCompletedDeps(items) {
        return {
            completedItems: () => items,
            categoryStyles,
            showEditTaskModal: jest.fn(),
            uncompleteItem: jest.fn()
        };
    }

    test('a top-level completed item with no completed subs renders just its own row', () => {
        const parent = { id: 'p1', name: 'Parent', category: 'work', completedAt: new Date('2026-07-19T10:00:00Z') };
        AgendaList.renderCompletedItems(makeCompletedDeps([parent]));

        expect(completedItemsList.children).toHaveLength(1);
        expect(findByClass(completedItemsList.children[0], 'completed-sub-item')).toHaveLength(0);
    });

    test('a completed sub-task renders immediately after its parent, marked completed-sub-item', () => {
        const parent = { id: 'p1', name: 'Parent', category: 'work', completedAt: new Date('2026-07-19T10:00:00Z') };
        const sub = { id: 's1', name: 'Sub one', category: 'work', parentId: 'p1', completedAt: new Date('2026-07-19T09:00:00Z') };
        AgendaList.renderCompletedItems(makeCompletedDeps([parent, sub]));

        expect(completedItemsList.children).toHaveLength(2);
        expect(completedItemsList.children[0].classList.contains('completed-sub-item')).toBe(false);
        expect(completedItemsList.children[1].classList.contains('completed-sub-item')).toBe(true);
        expect(findByText(completedItemsList.children[1], 'Sub one')).toHaveLength(1);
    });

    test('a completed sub-task never renders as its own top-level row', () => {
        const parent = { id: 'p1', name: 'Parent', category: 'work', completedAt: new Date('2026-07-19T10:00:00Z') };
        const sub = { id: 's1', name: 'Sub one', category: 'work', parentId: 'p1', completedAt: new Date('2026-07-19T09:00:00Z') };
        AgendaList.renderCompletedItems(makeCompletedDeps([parent, sub]));

        // Only ONE row should carry the plain top-level 'completed-item' class
        // without 'completed-sub-item' — i.e. the sub never gets its own
        // peer entry alongside the parent.
        const topLevelOnly = completedItemsList.children.filter(
            li => li.classList.contains('completed-item') && !li.classList.contains('completed-sub-item')
        );
        expect(topLevelOnly).toHaveLength(1);
    });

    test('multiple completed subs under one parent all nest, most-recent first', () => {
        const parent = { id: 'p1', name: 'Parent', category: 'work', completedAt: new Date('2026-07-19T12:00:00Z') };
        const subA = { id: 's1', name: 'Sub A', category: 'work', parentId: 'p1', completedAt: new Date('2026-07-19T10:00:00Z') };
        const subB = { id: 's2', name: 'Sub B', category: 'work', parentId: 'p1', completedAt: new Date('2026-07-19T11:00:00Z') };
        AgendaList.renderCompletedItems(makeCompletedDeps([parent, subA, subB]));

        expect(completedItemsList.children).toHaveLength(3);
        expect(findByText(completedItemsList.children[1], 'Sub B')).toHaveLength(1); // later completion first
        expect(findByText(completedItemsList.children[2], 'Sub A')).toHaveLength(1);
    });

    test('a nested sub row is display-only — no uncomplete checkbox, unlike its top-level parent', () => {
        // Regression guard for a real orphan-hole bug found live in Chrome
        // (2026-07-19): Items.uncompleteItem re-links a sub to its parent by
        // looking the parent up in the live activeItems array, but a parent
        // that has ITSELF already completed is no longer in that array — the
        // lookup silently fails, and the sub comes back as an
        // agenda-invisible, base-damaging orphan (nested-only rendering
        // excludes anything with a parentId from the top-level list). The
        // fix is not rendering the affordance that reaches it.
        const parent = { id: 'p1', name: 'Parent', category: 'work', completedAt: new Date('2026-07-19T10:00:00Z') };
        const sub = { id: 's1', name: 'Sub one', category: 'work', parentId: 'p1', completedAt: new Date('2026-07-19T09:00:00Z') };
        const deps = makeCompletedDeps([parent, sub]);
        AgendaList.renderCompletedItems(deps);

        const parentRow = completedItemsList.children[0];
        const subRow = completedItemsList.children[1];

        expect(findByClass(parentRow, 'completion-checkbox-input')).toHaveLength(1); // parent keeps its checkbox
        expect(findByClass(subRow, 'completion-checkbox-input')).toHaveLength(0);     // sub does not
        expect(findByText(subRow, '✓ Completed')).toHaveLength(1);                   // static badge instead

        expect(deps.uncompleteItem).not.toHaveBeenCalled();
    });
});

describe('AgendaList.isFirstRunEmpty — Milestone 5 first-run/onboarding pass (2026-07-20)', () => {
    const allEmpty = { activeItems: [], completedItems: [], definedHabits: [], definedRoutines: [] };

    test('true when the player has never engaged with the app at all', () => {
        expect(AgendaList.isFirstRunEmpty(allEmpty)).toBe(true);
    });

    test('false with any active item', () => {
        expect(AgendaList.isFirstRunEmpty({ ...allEmpty, activeItems: [{ id: 't1' }] })).toBe(false);
    });

    test('false with any past completion, even if the board is currently empty', () => {
        expect(AgendaList.isFirstRunEmpty({ ...allEmpty, completedItems: [{ id: 't1' }] })).toBe(false);
    });

    test('false with any habit ever defined, even standalone with nothing active today', () => {
        expect(AgendaList.isFirstRunEmpty({ ...allEmpty, definedHabits: [{ id: 'h1' }] })).toBe(false);
    });

    test('false with any routine ever defined', () => {
        expect(AgendaList.isFirstRunEmpty({ ...allEmpty, definedRoutines: [{ id: 'r1' }] })).toBe(false);
    });
});

describe('AgendaList.sortAndRenderActiveList — first-run onboarding empty state (2026-07-20)', () => {
    let activeItemsListUL, fabButton, onboardingBtn;

    beforeEach(() => {
        activeItemsListUL = makeElement('ul');
        fabButton = makeElement('button');
        fabButton.classList.add('fab'); // real markup starts as class="fab"
        onboardingBtn = makeElement('button');
        const elementsById = { fabButton, onboardingAddTaskBtn: onboardingBtn };
        global.document.getElementById = jest.fn(id => elementsById[id]);
    });

    function makeOnboardingDeps(overrides = {}) {
        return {
            activeItems: [],
            activeItemsListUL,
            completedItems: () => [],
            definedHabits: () => [],
            definedRoutines: () => [],
            openManagementWindow: jest.fn(),
            ...overrides
        };
    }

    test('true first-run emptiness renders the onboarding block and hints the FAB', () => {
        AgendaList.sortAndRenderActiveList(makeOnboardingDeps());

        expect(activeItemsListUL.innerHTML).toContain('Welcome to Deadline!');
        expect(activeItemsListUL.innerHTML).toContain('onboardingAddTaskBtn');
        expect(fabButton.classList.contains('onboarding-hint')).toBe(true);
    });

    test('the onboarding CTA opens the Tasks management window', () => {
        const deps = makeOnboardingDeps();
        AgendaList.sortAndRenderActiveList(deps);

        onboardingBtn.fire('click');

        expect(deps.openManagementWindow).toHaveBeenCalledWith('tasks');
    });

    test('a habit ever defined suppresses onboarding even with an empty board today', () => {
        AgendaList.sortAndRenderActiveList(makeOnboardingDeps({ definedHabits: () => [{ id: 'h1' }] }));

        expect(activeItemsListUL.innerHTML).not.toContain('Welcome to Deadline!');
        expect(activeItemsListUL.innerHTML).toBe('');
        expect(fabButton.classList.contains('onboarding-hint')).toBe(false);
    });

    test('any active item suppresses onboarding and renders the real row instead', () => {
        const task = { id: 't1', dueDateTime: new Date('2026-07-20T17:00:00Z'), parentId: null, listItemElement: makeElement('li') };
        AgendaList.sortAndRenderActiveList(makeOnboardingDeps({ activeItems: [task] }));

        expect(activeItemsListUL.innerHTML).toBe('');
        expect(activeItemsListUL.children).toContain(task.listItemElement);
        expect(fabButton.classList.contains('onboarding-hint')).toBe(false);
    });

    test('the FAB hint clears once onboarding is no longer true (was hinted, now has a real task)', () => {
        AgendaList.sortAndRenderActiveList(makeOnboardingDeps());
        expect(fabButton.classList.contains('onboarding-hint')).toBe(true);

        const task = { id: 't1', dueDateTime: new Date('2026-07-20T17:00:00Z'), parentId: null, listItemElement: makeElement('li') };
        AgendaList.sortAndRenderActiveList(makeOnboardingDeps({ activeItems: [task] }));
        expect(fabButton.classList.contains('onboarding-hint')).toBe(false);
    });
});

/**
 * @jest-environment jsdom
 */
/**
 * Timers on sub-tasks + "+ Sub-task" in the zombie window (2026-11-09, Jeremy).
 *  - A sub-task's nested row gets the same timer button + Pause / Play / Stop icons as a top-level row.
 *  - Every timer control carries data-item-id, so script.js updateTimerButtons can scope to ONE item's controls
 *    (a parent's row also contains its sub-tasks' controls).
 *  - The task popup shows "+ Sub-task" only where the list row does, and it opens the Create Sub-task form.
 */
global.Modal = require('../js/ui/modal.js');
global.Forms = require('../js/ui/forms.js');
global.Timer = require('../js/timer.js');
global.Habits = require('../js/habits.js');
global.Clock = require('../js/clock.js');
global.SpriteAnim = { setEnemyCategory: () => {} };
const Popups = require('../js/ui/popups.js');
const AgendaList = require('../js/ui/agendaList.js');

const categoryStyles = { career: { bgColor: '#123456' }, other: { bgColor: '#ccc' } };
const task = (o) => Object.assign({
    id: 3, type: 'task', name: 'Write report', category: 'career', isHighPriority: false, isOverdue: false,
    dueDateTime: new Date(2026, 10, 20, 20, 0), timer: null, timerMsBanked: 0, subTasks: [],
}, o);

function agendaDeps(items, over) {
    return Object.assign({
        activeItems: items, categoryStyles, completeItem: jest.fn(), isGameOver: () => false,
        showEditTaskModal: jest.fn(), showEditHabitInstanceModal: jest.fn(), createSubTaskPrompt: jest.fn(),
        toggleWorkTimer: jest.fn(),
    }, over);
}
function popupDeps(over) {
    return Object.assign({
        activeItems: [], completeItem: jest.fn(), toggleWorkTimer: jest.fn(() => ({ ok: true, running: true })),
        setLoggedTime: jest.fn(), sortAndRenderActiveList: jest.fn(), createListItem: jest.fn(), saveGame: jest.fn(),
        pushbackOptionsFor: () => [], gameIsOver: false,
    }, over);
}
beforeEach(() => { document.body.innerHTML = ''; jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

describe('timer on a sub-task row', () => {
    function build() {
        const sub = task({ id: 8, name: 'Outline', parentId: 3 });
        const parent = task({ subTasks: [8] });
        const deps = agendaDeps([parent, sub]);
        AgendaList.createListItem(parent, deps);
        return { parent, sub, deps, row: parent.listItemElement };
    }

    test('the nested sub-task row has a timer button and Pause / Play / Stop icons, all tagged with the sub-task id', () => {
        const { row } = build();
        const subRow = row.querySelector('.sub-task-item');
        const btn = subRow.querySelector('.work-timer-btn');
        expect(btn).not.toBeNull();
        expect(btn.dataset.itemId).toBe('8');
        const ctls = subRow.querySelectorAll('.timer-ctl-btn');
        expect(ctls).toHaveLength(3);
        ctls.forEach(c => expect(c.dataset.itemId).toBe('8'));
    });

    test('tapping the sub-task timer starts THAT sub-task, not the parent', () => {
        const { row, deps } = build();
        row.querySelector('.sub-task-item .work-timer-btn').click();
        expect(deps.toggleWorkTimer).toHaveBeenCalledWith(8);
        row.querySelector('.sub-task-item .timer-ctl-stop').click();
        expect(deps.toggleWorkTimer).toHaveBeenLastCalledWith(8, 'stop');
    });

    test('an id-scoped lookup (what updateTimerButtons does) separates the parent\'s controls from the sub-task\'s', () => {
        const { row } = build();
        const mine = row.querySelector('.work-timer-btn[data-item-id="3"]');
        const subs = row.querySelector('.work-timer-btn[data-item-id="8"]');
        expect(mine).not.toBeNull();
        expect(subs).not.toBeNull();
        expect(mine).not.toBe(subs);
        expect(row.querySelectorAll('.timer-ctl-btn[data-item-id="3"]')).toHaveLength(3);
        expect(row.querySelectorAll('.timer-ctl-btn[data-item-id="8"]')).toHaveLength(3);
    });

    test('a running sub-task shows its running state on its own button only', () => {
        const sub = task({ id: 8, name: 'Outline', parentId: 3 });
        Timer.start(sub, Date.now());
        const parent = task({ subTasks: [8] });
        AgendaList.createListItem(parent, agendaDeps([parent, sub]));
        const row = parent.listItemElement;
        expect(row.querySelector('.work-timer-btn[data-item-id="8"]').classList.contains('running')).toBe(true);
        expect(row.querySelector('.work-timer-btn[data-item-id="3"]').classList.contains('running')).toBe(false);
    });

    test('no timer controls when toggleWorkTimer is not wired (old callers) — the row still builds', () => {
        const sub = task({ id: 8, parentId: 3 });
        const parent = task({ subTasks: [8] });
        const deps = agendaDeps([parent, sub]);
        delete deps.toggleWorkTimer;
        AgendaList.createListItem(parent, deps);
        expect(parent.listItemElement.querySelector('.sub-task-item')).not.toBeNull();
        expect(parent.listItemElement.querySelector('.work-timer-btn')).toBeNull();
    });
});

describe('"+ Sub-task" in the zombie window', () => {
    const present = () => !!document.getElementById('addSubTaskBtn');

    test('shown on a top-level task', () => {
        Popups.showTaskDetailsPopup(task(), popupDeps());
        expect(present()).toBe(true);
    });
    test('not on a sub-task (one level deep), a habit, a KO ghost, or after game over', () => {
        Popups.showTaskDetailsPopup(task({ id: 8, parentId: 3 }), popupDeps());
        expect(present()).toBe(false);
        document.body.innerHTML = '';
        Popups.showTaskDetailsPopup(task({ id: 9, type: 'habit', streak: 1, isNegative: false }), popupDeps());
        expect(present()).toBe(false);
        document.body.innerHTML = '';
        Popups.showTaskDetailsPopup(task({ koGhost: true }), popupDeps());
        expect(present()).toBe(false);
        document.body.innerHTML = '';
        Popups.showTaskDetailsPopup(task(), popupDeps({ gameIsOver: true }));
        expect(present()).toBe(false);
    });
    test('tapping it closes the window and opens the Create Sub-task form for that task', () => {
        jest.useFakeTimers();
        const parent = task({ name: 'Quarterly taxes' });
        Popups.showTaskDetailsPopup(parent, popupDeps({ activeItems: [parent] }));
        document.getElementById('addSubTaskBtn').click();
        jest.runAllTimers();
        expect(document.querySelector('.task-details-modal')).toBeNull();
        expect(document.body.textContent).toContain('Create Sub-task for "Quarterly taxes"');
        expect(document.getElementById('subTaskName')).not.toBeNull();
    });
});

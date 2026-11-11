/**
 * @jest-environment jsdom
 */
/**
 * Sub-task list in a parent's zombie window + "Part of" link in a sub-task's window (2026-11-11, Jeremy:
 * "clicking the parent on the canvas should have the window show the subtasks in it so the user can navigate to it").
 */
global.Modal = require('../js/ui/modal.js');
global.Forms = require('../js/ui/forms.js');
global.Timer = require('../js/timer.js');
global.Habits = require('../js/habits.js');
global.Clock = require('../js/clock.js');
global.SpriteAnim = { setEnemyCategory: () => {} };
const Popups = require('../js/ui/popups.js');

const task = (o) => Object.assign({
    id: 1, type: 'task', name: 'Write report', category: 'career', isHighPriority: false, isOverdue: false,
    dueDateTime: new Date(Date.now() + 3 * 3600000), timer: null, timerMsBanked: 0, subTasks: [],
    completedSubTasks: 0, totalSubTasks: 0,
}, o);

function family(subCount = 2) {
    const parent = task({ id: 1, name: 'Parent job' });
    const subs = [];
    for (let n = 0; n < subCount; n++) {
        subs.push(task({ id: 10 + n, name: `Sub ${n + 1}`, parentId: 1 }));
        parent.subTasks.push(10 + n);
    }
    parent.totalSubTasks = subCount;
    return { parent, subs };
}

function deps(over) {
    return Object.assign({
        activeItems: [], completedItems: () => [], completeItem: jest.fn(),
        toggleWorkTimer: jest.fn(() => ({ ok: true, running: true })), setLoggedTime: jest.fn(),
        recomputeOverdueStateAfterEdit: jest.fn(), sortAndRenderActiveList: jest.fn(), createListItem: jest.fn(),
        saveGame: jest.fn(), pushbackOptionsFor: () => [],
    }, over);
}

beforeEach(() => { document.body.innerHTML = ''; jest.useRealTimers(); });

describe('sub-task list in the parent window', () => {
    test('lists each open sub-task as a tappable row, above the + Sub-task button', () => {
        const { parent, subs } = family(2);
        Popups.showTaskDetailsPopup(parent, deps({ activeItems: [parent, ...subs] }));
        const rows = document.querySelectorAll('.popup-subtask-row[data-sub-id]');
        expect(rows).toHaveLength(2);
        expect(rows[0].textContent).toContain('Sub 1');
        const list = document.getElementById('popupSubTasks');
        const addBtn = document.getElementById('addSubTaskBtn');
        expect(list.compareDocumentPosition(addBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(document.querySelector('.popup-subtasks-count').textContent).toBe('0 of 2 done');
    });

    test('finished sub-tasks show greyed with a check and are not tappable; the count follows', () => {
        const { parent, subs } = family(2);
        const finished = task({ id: 20, name: 'Done one', parentId: 1 });
        parent.completedSubTasks = 1;
        Popups.showTaskDetailsPopup(parent, deps({ activeItems: [parent, ...subs], completedItems: () => [finished] }));
        expect(document.querySelectorAll('.popup-subtask-row[data-sub-id]')).toHaveLength(2);
        const done = document.querySelector('.popup-subtask-row--done');
        expect(done.textContent).toContain('Done one');
        expect(done.tagName).toBe('LI');
        expect(document.querySelector('.popup-subtasks-count').textContent).toBe('1 of 3 done');
    });

    test('the count still works when a finished sub-task has no record left', () => {
        const { parent, subs } = family(1);
        parent.completedSubTasks = 2;
        Popups.showTaskDetailsPopup(parent, deps({ activeItems: [parent, ...subs] }));
        expect(document.querySelector('.popup-subtasks-count').textContent).toBe('2 of 3 done');
        expect(document.querySelectorAll('.popup-subtask-row--done')).toHaveLength(0);
    });

    test('no section for a task without sub-tasks, a sub-task, or a habit', () => {
        const lone = task({ id: 5 });
        Popups.showTaskDetailsPopup(lone, deps({ activeItems: [lone] }));
        expect(document.getElementById('popupSubTasks')).toBeNull();
        document.body.innerHTML = '';
        const { parent, subs } = family(1);
        Popups.showTaskDetailsPopup(subs[0], deps({ activeItems: [parent, ...subs] }));
        expect(document.getElementById('popupSubTasks')).toBeNull();
    });

    test('an overdue sub-task is tagged as attacking; names are escaped', () => {
        const { parent, subs } = family(1);
        subs[0].isOverdue = true;
        subs[0].name = 'Fix <b>roof</b>';
        Popups.showTaskDetailsPopup(parent, deps({ activeItems: [parent, ...subs] }));
        expect(document.querySelector('.popup-subtask-tag--overdue').textContent).toBe('attacking');
        expect(document.querySelector('.popup-subtask-row b')).toBeNull();
        expect(document.querySelector('.popup-subtask-name').textContent).toBe('Fix <b>roof</b>');
    });

    test('tapping a sub-task row opens that sub-task\'s own window', () => {
        jest.useFakeTimers();
        const { parent, subs } = family(2);
        Popups.showTaskDetailsPopup(parent, deps({ activeItems: [parent, ...subs] }));
        document.querySelectorAll('.popup-subtask-row[data-sub-id]')[1].click();
        jest.runAllTimers();
        expect(document.querySelector('.task-details-modal h3').textContent).toBe('Sub 2');
        expect(document.querySelectorAll('.task-details-modal')).toHaveLength(1);
    });

    test('a knocked-out parent still lists its sub-tasks', () => {
        const { parent, subs } = family(1);
        parent.koGhost = true;
        Popups.showTaskDetailsPopup(parent, deps({ activeItems: [parent, ...subs] }));
        expect(document.querySelectorAll('.popup-subtask-row[data-sub-id]')).toHaveLength(1);
    });
});

describe('"Part of" link in a sub-task window', () => {
    test('shows the parent name and opens the parent window', () => {
        jest.useFakeTimers();
        const { parent, subs } = family(1);
        Popups.showTaskDetailsPopup(subs[0], deps({ activeItems: [parent, ...subs] }));
        const link = document.getElementById('openParentBtn');
        expect(link.textContent).toBe('Parent job');
        link.click();
        jest.runAllTimers();
        expect(document.querySelector('.task-details-modal h3').textContent).toBe('Parent job');
    });

    test('no link on a top-level task', () => {
        const { parent, subs } = family(1);
        Popups.showTaskDetailsPopup(parent, deps({ activeItems: [parent, ...subs] }));
        expect(document.getElementById('openParentBtn')).toBeNull();
    });
});

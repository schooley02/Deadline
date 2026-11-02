/**
 * @jest-environment jsdom
 */
/**
 * Dialog Build 3 (2026-11-01, docs/DIALOG_PLAN.md): the four "should not happen" errors (category D) are in-game notices,
 * never the browser's alert(). Each test stubs Dialog.notice and fails if a native alert() is used.
 */
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.HeroesView = require('../js/ui/heroes.js');
global.DayRollover = require('../js/dayRollover.js');
global.Modal = require('../js/ui/modal.js');
global.Forms = require('../js/ui/forms.js');
global.Timer = require('../js/timer.js');
global.Habits = require('../js/habits.js');
global.Clock = require('../js/clock.js');
global.SpriteAnim = { setEnemyCategory: () => {} };
const Popups = require('../js/ui/popups.js');
const RoutineViews = require('../js/ui/routineViews.js');
const TaskManager = require('../js/TaskManager.js');

let noticeSpy;
beforeEach(() => {
    document.body.innerHTML = '';
    noticeSpy = jest.fn(() => Promise.resolve());
    global.Dialog = { notice: noticeSpy, confirm: jest.fn(() => Promise.resolve(true)) };
    global.alert = jest.fn();
});
afterEach(() => { delete global.Dialog; });

const tick = () => new Promise(r => setTimeout(r, 0));

describe('category D errors are in-game notices', () => {
    test('create sub-task: parent task not found', () => {
        Popups.showCreateSubTaskModal(999, { activeItems: [] });
        expect(noticeSpy).toHaveBeenCalledTimes(1);
        expect(noticeSpy.mock.calls[0][0]).toBe('Parent task not found.');
        expect(global.alert).not.toHaveBeenCalled();
        expect(document.querySelector('.modal-overlay')).toBeNull();
    });

    test('TaskManager: error creating a sub-task shows the message', () => {
        const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const tm = new TaskManager(document.createElement('div'), [], 1);
        tm.createTask = () => { throw new Error('boom'); };
        const modal = document.createElement('div');
        modal.innerHTML = '<input id="subtask-name" value="x"><select id="subtask-category"><option value="other">o</option></select>' +
            '<input id="subtask-priority" type="checkbox"><input id="subtask-due-date" value="2026-11-02"><input id="subtask-due-time" value="10:00">';
        tm.handleSubtaskSubmit(modal, 1);
        expect(noticeSpy).toHaveBeenCalledTimes(1);
        expect(noticeSpy.mock.calls[0][0]).toBe('Error creating subtask: boom');
        expect(global.alert).not.toHaveBeenCalled();
        errSpy.mockRestore();
    });

    test('move to another routine: a failed move shows its reason', async () => {
        const src = { id: 'r1', name: 'Morning', habitDefinitionIds: ['h1'], taskDefinitionIds: [], isActive: true, frozenState: null, koState: null, level: 1 };
        const dest = { id: 'r2', name: 'Evening', habitDefinitionIds: [], taskDefinitionIds: [], isActive: true, frozenState: null, koState: null, level: 1 };
        const deps = {
            definedRoutines: () => [src, dest],
            definedHabits: () => [{ id: 'h1', name: 'Stretch' }],
            transferHabitBetweenRoutines: jest.fn(() => ({ ok: false, reason: 'already-in-routine' })),
            saveGame: jest.fn(),
        };
        RoutineViews.showTransferItemModal('r1', 'habit', 'h1', deps);
        document.getElementById('transferDestSelect').value = 'r2';
        document.getElementById('confirmTransferBtn').click();
        await tick();
        expect(deps.transferHabitBetweenRoutines).toHaveBeenCalledWith('r1', 'r2', 'h1');
        expect(noticeSpy).toHaveBeenCalledTimes(1);
        expect(noticeSpy.mock.calls[0][0]).toBe('"Evening" already contains this habit.');
        expect(global.alert).not.toHaveBeenCalled();
        expect(document.getElementById('transferItemModal')).not.toBeNull(); // picker stays open so the player can choose again
    });
});

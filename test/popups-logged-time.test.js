/**
 * @jest-environment jsdom
 */
/**
 * Logged-time field in the item popup and the Edit Task modal (Habit Goals Build 2c, 2026-11-01).
 */
global.Modal = require('../js/ui/modal.js');
global.Forms = require('../js/ui/forms.js');
global.Timer = require('../js/timer.js');
global.Habits = require('../js/habits.js');
global.Clock = require('../js/clock.js');
global.SpriteAnim = { setEnemyCategory: () => {} };
const Popups = require('../js/ui/popups.js');

const MIN = 60000;
const breakHabit = (o) => Object.assign({
    id: 7, type: 'habit', definitionId: 'd1', isNegative: true, name: 'Social media', category: 'lifestyle', streak: 2,
    isHighPriority: false, dueDateTime: new Date(2026, 10, 1, 20, 0), originalDueDate: new Date(2026, 10, 1, 20, 0),
    timerMinutes: 60, timer: null, timerMsBanked: 25 * MIN, goal: { type: 'time', amount: 60, unit: 'min' },
}, o);
const task = (o) => Object.assign({
    id: 3, type: 'task', name: 'Write report', category: 'career', isHighPriority: false,
    dueDateTime: new Date(2026, 10, 1, 20, 0), timer: null, timerMsBanked: 50 * MIN, subTasks: [],
}, o);

function deps(over) {
    return Object.assign({
        activeItems: [], completeItem: jest.fn(), indulgeHabit: jest.fn(), toggleWorkTimer: jest.fn(() => ({ ok: true, running: false })),
        setLoggedTime: jest.fn(() => ({ ok: true, deltaMin: 5, completed: false })),
        recomputeOverdueStateAfterEdit: jest.fn(), sortAndRenderActiveList: jest.fn(), createListItem: jest.fn(), saveGame: jest.fn(),
        pushbackOptionsFor: () => [],
    }, over);
}
beforeEach(() => { document.body.innerHTML = ''; global.alert = jest.fn(); });

describe('item popup: Logged time field', () => {
    test('shown for a Break habit with a Time limit, filled from the banked time, with its own Save', () => {
        Popups.showTaskDetailsPopup(breakHabit(), deps());
        expect(document.getElementById('popupLoggedHours').value).toBe('0');
        expect(document.getElementById('popupLoggedMinutes').value).toBe('25');
        expect(document.getElementById('popupLoggedSave')).not.toBeNull();
    });

    test('shown for a task (it has a stopwatch); not for a Build habit with no timer and no time', () => {
        Popups.showTaskDetailsPopup(task(), deps());
        expect(document.getElementById('popupLoggedMinutes').value).toBe('50');
        document.body.innerHTML = '';
        Popups.showTaskDetailsPopup({ id: 9, type: 'habit', isNegative: false, name: 'Floss', category: 'health', streak: 1, dueDateTime: new Date(), timerMsBanked: 0 }, deps());
        expect(document.getElementById('popupLoggedSave')).toBeNull();
    });

    test('hidden when the deps cannot save a logged time (older callers)', () => {
        Popups.showTaskDetailsPopup(task(), deps({ setLoggedTime: undefined }));
        expect(document.getElementById('popupLoggedSave')).toBeNull();
    });

    test('locked while the timer runs, with the pause-first note', () => {
        Popups.showTaskDetailsPopup(breakHabit({ timer: { startedAt: Date.now(), checkedAt: Date.now(), promptedAt: null } }), deps());
        expect(document.getElementById('popupLoggedHours').disabled).toBe(true);
        expect(document.getElementById('popupLoggedMinutes').disabled).toBe(true);
        expect(document.getElementById('popupLoggedSave').disabled).toBe(true);
        expect(document.getElementById('popupLoggedNote').textContent).toMatch(/Pause the timer/);
    });

    test('Save time sends the new milliseconds for that item and says Saved', () => {
        const d = deps();
        Popups.showTaskDetailsPopup(breakHabit(), d);
        document.getElementById('popupLoggedHours').value = '1';
        document.getElementById('popupLoggedMinutes').value = '10';
        document.getElementById('popupLoggedSave').click();
        expect(d.setLoggedTime).toHaveBeenCalledWith(7, 70 * MIN);
        expect(document.getElementById('popupLoggedMsg').textContent).toBe('Saved.');
        // saving again with nothing new changes nothing
        document.getElementById('popupLoggedSave').click();
        expect(d.setLoggedTime).toHaveBeenCalledTimes(1);
        expect(document.getElementById('popupLoggedMsg').textContent).toBe('No change.');
    });

    test('an invalid time shows the error and saves nothing', () => {
        const d = deps();
        Popups.showTaskDetailsPopup(breakHabit(), d);
        document.getElementById('popupLoggedMinutes').value = '99';
        document.getElementById('popupLoggedSave').click();
        expect(d.setLoggedTime).not.toHaveBeenCalled();
        expect(document.getElementById('popupLoggedMsg').textContent).toMatch(/0 to 59/);
    });

    test('a refused save (timer started elsewhere) explains why', () => {
        const d = deps({ setLoggedTime: jest.fn(() => ({ ok: false, reason: 'running' })) });
        Popups.showTaskDetailsPopup(breakHabit(), d);
        document.getElementById('popupLoggedMinutes').value = '30';
        document.getElementById('popupLoggedSave').click();
        expect(document.getElementById('popupLoggedMsg').textContent).toMatch(/Pause the timer/);
    });
});

describe('Edit Task modal: Logged time field', () => {
    test('present for a timed task; saving with it untouched never calls setLoggedTime', () => {
        const d = deps();
        Popups.showEditTaskModal(task(), d);
        expect(document.getElementById('editLoggedMinutes').value).toBe('50');
        document.getElementById('saveTaskChanges').click();
        expect(d.setLoggedTime).not.toHaveBeenCalled();
        expect(d.saveGame).toHaveBeenCalled();
    });

    test('a changed value is applied once, after the other fields save', () => {
        const d = deps();
        const t = task();
        Popups.showEditTaskModal(t, d);
        document.getElementById('editTaskName').value = 'Write the report';
        document.getElementById('editLoggedHours').value = '2';
        document.getElementById('editLoggedMinutes').value = '0';
        document.getElementById('saveTaskChanges').click();
        expect(t.name).toBe('Write the report');
        expect(d.setLoggedTime).toHaveBeenCalledTimes(1);
        expect(d.setLoggedTime).toHaveBeenCalledWith(3, 120 * MIN);
    });

    test('a bad time blocks the whole save: nothing changes, an inline error says why', () => {
        const d = deps();
        const t = task();
        Popups.showEditTaskModal(t, d);
        document.getElementById('editTaskName').value = 'Renamed';
        document.getElementById('editLoggedMinutes').value = '75';
        document.getElementById('saveTaskChanges').click();
        expect(t.name).toBe('Write report');
        expect(d.setLoggedTime).not.toHaveBeenCalled();
        expect(global.alert).not.toHaveBeenCalled();
        const err = document.querySelector('.form-error');
        expect(err).not.toBeNull();
        expect(err.textContent).toMatch(/Minutes must be 0 to 59/);
    });
});


// 2026-11-04 (Jeremy): "Time Logged" wording, and in the Edit Task form the running-timer note's "Time Logged" words
// are a text link that opens the task's card (the popup), where the timer can be paused and the time edited.
describe('Time Logged wording + the Edit Task note link', () => {
    const running = () => ({ startedAt: Date.now(), checkedAt: Date.now(), promptedAt: null });

    test('the field label says "Time Logged:"', () => {
        Popups.showEditTaskModal(task(), deps());
        expect(document.querySelector('label[for="editLoggedHours"]').textContent).toBe('Time Logged:');
    });

    test('Edit Task with a running timer: the note links "Time Logged"; a tap closes the form and opens the card', () => {
        jest.useFakeTimers();
        const t = task({ timer: running() });
        const d = deps({ activeItems: [t] });
        Popups.showEditTaskModal(t, d);
        const note = document.getElementById('editLoggedNote');
        expect(note.textContent).toBe('Pause the timer to edit the Time Logged.');
        const link = document.getElementById('editLoggedOpenCard');
        expect(link.tagName).toBe('BUTTON');
        const outside = jest.fn();
        document.addEventListener('click', outside);
        link.click();
        document.removeEventListener('click', outside);
        expect(outside).not.toHaveBeenCalled();
        expect(document.getElementById('saveTaskChanges')).toBeNull(); // the form is gone
        jest.runAllTimers();
        expect(document.getElementById('popupLoggedHours')).not.toBeNull(); // the task's card is open
        jest.useRealTimers();
    });

    test('the card itself keeps the plain note (it already holds the field)', () => {
        Popups.showTaskDetailsPopup(task({ timer: running() }), deps());
        const note = document.getElementById('popupLoggedNote');
        expect(note.textContent).toBe('Pause the timer to edit the Time Logged.');
        expect(note.querySelector('button')).toBeNull();
    });

    test('no running timer: no note and no link', () => {
        Popups.showEditTaskModal(task(), deps());
        expect(document.getElementById('editLoggedNote')).toBeNull();
        expect(document.getElementById('editLoggedOpenCard')).toBeNull();
    });
});

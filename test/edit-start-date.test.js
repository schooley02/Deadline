/**
 * @jest-environment jsdom
 */
/**
 * Edit Task: the Start time is a time of day ON THE DUE DATE (2026-11-04, Jeremy). Saving used to keep a Start box that was
 * "unchanged" as its stored Date, which carries its own calendar date. A task that had been pushed a day (start stored on
 * 11/05) and then moved back to 11/04 kept the 11/05 start, so Save refused with "Start time must be earlier than the due
 * time" while both boxes read 08:30 / 10:00. Now a filled Start box is always read on the date being saved.
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
global.Schedule = require('../js/schedule.js');
global.Modal = require('../js/ui/modal.js');
global.Forms = require('../js/ui/forms.js');
global.Timer = require('../js/timer.js');
global.Habits = require('../js/habits.js');
global.SpriteAnim = { setEnemyCategory: () => {} };
global.PushbackHelp = require('../js/ui/pushbackHelp.js');
const Popups = require('../js/ui/popups.js');

describe('Forms.startDateTimeFor', () => {
    test('puts the time of day on the given due date', () => {
        const d = Forms.startDateTimeFor('2099-03-04', '08:30');
        expect(d).toEqual(new Date(2099, 2, 4, 8, 30));
    });
    test('blank start, blank date or garbage gives null', () => {
        expect(Forms.startDateTimeFor('2099-03-04', '')).toBeNull();
        expect(Forms.startDateTimeFor('', '08:30')).toBeNull();
        expect(Forms.startDateTimeFor('2099-03-04', undefined)).toBeNull();
        expect(Forms.startDateTimeFor('nope', '08:30')).toBeNull();
    });
});

describe('Edit Task save: Start follows the due date', () => {
    const $ = (id) => document.getElementById(id);
    const task = (o) => Object.assign({
        id: 3, type: 'task', name: 'Venue reporting', category: 'other', isHighPriority: false,
        dueDateTime: new Date(2099, 2, 5, 10, 0), startDateTime: new Date(2099, 2, 5, 8, 30),
        timer: null, timerMsBanked: 0, subTasks: [],
    }, o);
    const deps = () => ({
        activeItems: [], recomputeOverdueStateAfterEdit: jest.fn(), sortAndRenderActiveList: jest.fn(),
        createListItem: jest.fn(), saveGame: jest.fn(), updateTaskCountDisplay: jest.fn(), getPlayerPoints: () => 40,
    });
    beforeEach(() => { document.body.innerHTML = ''; });

    test('start stored on the 5th, due moved back to the 4th, Start box untouched: saves with start on the 4th', () => {
        const item = task();
        Popups.showEditTaskModal(item, deps());
        expect($('editStartTime').value).toBe('08:30');
        $('editDueDate').value = '2099-03-04';
        $('saveTaskChanges').click();
        expect(item.dueDateTime).toEqual(new Date(2099, 2, 4, 10, 0));
        expect(item.startDateTime).toEqual(new Date(2099, 2, 4, 8, 30));
        expect(document.querySelector('.form-error, #formError')).toBeNull();
    });

    test('moving the due date later carries an untouched Start with it', () => {
        const item = task({ dueDateTime: new Date(2099, 2, 4, 10, 0), startDateTime: new Date(2099, 2, 4, 8, 30) });
        Popups.showEditTaskModal(item, deps());
        $('editDueDate').value = '2099-03-06';
        $('saveTaskChanges').click();
        expect(item.startDateTime).toEqual(new Date(2099, 2, 6, 8, 30));
        expect(item.dueDateTime).toEqual(new Date(2099, 2, 6, 10, 0));
    });

    test('an untouched Start on an unchanged date stays exactly as it was', () => {
        const item = task({ dueDateTime: new Date(2099, 2, 4, 10, 0), startDateTime: new Date(2099, 2, 4, 8, 30) });
        Popups.showEditTaskModal(item, deps());
        $('saveTaskChanges').click();
        expect(item.startDateTime).toEqual(new Date(2099, 2, 4, 8, 30));
    });

    test('a Start at or after the due time on the same day is still refused', () => {
        const item = task({ dueDateTime: new Date(2099, 2, 4, 10, 0), startDateTime: new Date(2099, 2, 4, 8, 30) });
        Popups.showEditTaskModal(item, deps());
        $('editStartTime').value = '10:00';
        $('saveTaskChanges').click();
        expect(item.startDateTime).toEqual(new Date(2099, 2, 4, 8, 30));
        expect(document.body.textContent).toContain('Start time must be earlier than the due time.');
    });

    test('clearing the Start box clears the start', () => {
        const item = task({ dueDateTime: new Date(2099, 2, 4, 10, 0), startDateTime: new Date(2099, 2, 4, 8, 30) });
        Popups.showEditTaskModal(item, deps());
        $('editStartTime').value = '';
        $('saveTaskChanges').click();
        expect(item.startDateTime).toBeNull();
    });
});

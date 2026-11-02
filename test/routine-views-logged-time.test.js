/**
 * @jest-environment jsdom
 */
/**
 * Edit Habit from the Completed list carries the entry's Logged time (Habit Goals Build 2c, 2026-11-01): an
 * entry-level change, applied for "just this entry" and "this entry + all following", never for "all following only".
 */
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.HeroesView = require('../js/ui/heroes.js');
global.DayRollover = require('../js/dayRollover.js');
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Modal = require('../js/ui/modal.js');
global.Forms = require('../js/ui/forms.js');
global.Timer = require('../js/timer.js');
global.SpriteAnim = { setEnemyCategory: () => {} };
const RoutineViews = require('../js/ui/routineViews.js');

const MIN = 60000;
const habitDef = {
    id: 'd1', name: 'Social media', category: 'lifestyle', isNegative: true, timeOfDay: 'anytime',
    schedule: Schedule.fromLegacyFrequency('daily'), goal: { type: 'time', amount: 60, unit: 'min' }, timerMinutes: 60,
};

function open(opts) {
    document.body.innerHTML = '';
    RoutineViews.showEditHabitForm(null, habitDef, opts);
}

describe('Edit Habit form: Logged time (completed entries only)', () => {
    test('a completed entry with timer time shows the field, filled in', () => {
        open({ fromCompleted: true, completedItemId: 'e1', loggedMs: 75 * MIN });
        expect(document.getElementById('editHabitLoggedHours').value).toBe('1');
        expect(document.getElementById('editHabitLoggedMinutes').value).toBe('15');
        expect(document.getElementById('editHabitLoggedNote').textContent).toMatch(/never changes whether you resisted or slipped/);
    });

    test('no field when the entry could never have had timer time, or when editing the habit itself', () => {
        open({ fromCompleted: true, completedItemId: 'e1' });
        expect(document.getElementById('editHabitLoggedGroup')).toBeNull();
        open();
        expect(document.getElementById('editHabitLoggedGroup')).toBeNull();
    });
});

describe('Edit Habit save from a completed entry', () => {
    function setup(loggedMs) {
        open({ fromCompleted: true, completedItemId: 'e1', loggedMs });
        const entry = { id: 'e1', type: 'habit', definitionId: 'd1', name: 'Social media', timerMsBanked: loggedMs, outcome: 'indulged' };
        const deps = {
            completedItems: () => [entry], activeItems: [], renderCompletedItems: jest.fn(), saveGame: jest.fn(),
            editHabitInRoutine: jest.fn(), sortAndRenderActiveList: jest.fn(), createListItem: jest.fn(),
            setLoggedTime: jest.fn(() => ({ ok: true })),
        };
        return { entry, deps };
    }
    const save = (deps) => RoutineViews.saveEditedHabit('d1', deps, 'e1');
    beforeEach(() => { global.alert = jest.fn(); });

    test('"Just this entry" applies the new logged time to the entry and never touches the habit', () => {
        const { deps } = setup(75 * MIN);
        document.getElementById('editHabitLoggedMinutes').value = '45';
        save(deps);
        document.getElementById('editScopeEntry').click();
        expect(deps.setLoggedTime).toHaveBeenCalledWith('e1', 105 * MIN);
        expect(deps.editHabitInRoutine).not.toHaveBeenCalled();
    });

    test('"This entry and all following" applies the time AND the habit edit', () => {
        const { deps } = setup(75 * MIN);
        document.getElementById('editHabitLoggedHours').value = '0';
        document.getElementById('editHabitLoggedMinutes').value = '20';
        save(deps);
        document.getElementById('editScopeBoth').click();
        expect(deps.setLoggedTime).toHaveBeenCalledWith('e1', 20 * MIN);
        expect(deps.editHabitInRoutine).toHaveBeenCalled();
    });

    test('"All following only" leaves this entry\'s time alone', () => {
        const { deps } = setup(75 * MIN);
        document.getElementById('editHabitLoggedMinutes').value = '5';
        save(deps);
        document.getElementById('editScopeFollowing').click();
        expect(deps.setLoggedTime).not.toHaveBeenCalled();
        expect(deps.editHabitInRoutine).toHaveBeenCalled();
    });

    test('an untouched time is never re-saved', () => {
        const { deps } = setup(75 * MIN + 20000);
        save(deps);
        document.getElementById('editScopeEntry').click();
        expect(deps.setLoggedTime).not.toHaveBeenCalled();
    });

    test('a bad time stops the save before the scope question', () => {
        const { deps } = setup(75 * MIN);
        document.getElementById('editHabitLoggedMinutes').value = '75';
        save(deps);
        expect(global.alert).toHaveBeenCalled();
        expect(document.getElementById('editScopeModal')).toBeNull();
        expect(deps.setLoggedTime).not.toHaveBeenCalled();
    });
});

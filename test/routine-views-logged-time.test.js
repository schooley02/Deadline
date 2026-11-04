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
        expect(global.alert).not.toHaveBeenCalled();
        expect(document.querySelector('.form-error').textContent).toMatch(/Minutes must be 0 to 59/);
        expect(document.getElementById('editScopeModal')).toBeNull();
        expect(deps.setLoggedTime).not.toHaveBeenCalled();
    });
});

// Timer sessions Build B (2026-11-04): the completed entry's Sessions list sits under its Time Logged field.
describe('Edit Habit form: Sessions list (completed entries)', () => {
    global.TimerSessions = require('../js/timerSessions.js');
    global.SessionsView = require('../js/ui/sessionsView.js');
    const at = (d, h, m) => new Date(2026, 10, d, h, m || 0).getTime();
    const entry = () => ({
        id: 'e1', type: 'habit', definitionId: 'd1', name: 'Social media', outcome: 'avoided', timer: null,
        timerSessions: [{ start: at(3, 20), end: at(3, 20, 40), attack: [] }], timerUntimedMs: 10 * MIN, timerMsBanked: 50 * MIN,
    });

    test('shown when the Completed list passes the session deps; absent without them', () => {
        const e = entry();
        open({ fromCompleted: true, completedItemId: 'e1', loggedMs: e.timerMsBanked, sessions: { item: e, changeSession: jest.fn() } });
        expect(document.getElementById('editHabitSesSessions')).not.toBeNull();
        expect(document.querySelectorAll('#editHabitSesSessions .sessions-row')).toHaveLength(2);
        open({ fromCompleted: true, completedItemId: 'e1', loggedMs: e.timerMsBanked });
        expect(document.getElementById('editHabitSesSessions')).toBeNull();
    });

    test('a session change keeps the hours / minutes boxes in step', () => {
        const e = entry();
        const changeSession = jest.fn(() => { e.timerSessions[0].end = at(3, 20, 20); e.timerMsBanked = 30 * MIN; return { ok: true, chargedHp: 0 }; });
        open({ fromCompleted: true, completedItemId: 'e1', loggedMs: e.timerMsBanked, sessions: { item: e, changeSession } });
        document.querySelector('#editHabitSesSessions [data-act="edit"]').click();
        const stop = document.getElementById('editHabitSesSesStop');
        stop.value = '20:20'; stop.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('#editHabitSesSessions [data-act="save"]').click();
        expect(document.getElementById('editHabitLoggedMinutes').value).toBe('30');
        expect(document.getElementById('editHabitLoggedGroup').getAttribute('data-initial-min')).toBe('30');
    });

    test('saving a total below the entry\'s sessions is blocked with the way out', () => {
        const e = entry();
        open({ fromCompleted: true, completedItemId: 'e1', loggedMs: e.timerMsBanked, sessions: { item: e, changeSession: jest.fn() } });
        const deps = { completedItems: () => [e], activeItems: [], renderCompletedItems: jest.fn(), saveGame: jest.fn(), editHabitInRoutine: jest.fn(), setLoggedTime: jest.fn() };
        document.getElementById('editHabitLoggedMinutes').value = '20';
        RoutineViews.saveEditedHabit('d1', deps, 'e1');
        expect(document.querySelector('.form-error').textContent).toBe('To remove timed time, edit its session below.');
        expect(document.getElementById('editScopeModal')).toBeNull();
        expect(deps.setLoggedTime).not.toHaveBeenCalled();
    });
});

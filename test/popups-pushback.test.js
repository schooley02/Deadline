/**
 * @jest-environment jsdom
 */
/**
 * Pushback charges Build B (2026-11-02): the zombie popup's size buttons and the edit form's live note.
 * The rules themselves are tested in test/pushback.test.js; this checks the popup draws and routes them.
 */
global.Modal = require('../js/ui/modal.js');
global.Forms = require('../js/ui/forms.js');
global.Timer = require('../js/timer.js');
global.Habits = require('../js/habits.js');
global.Clock = require('../js/clock.js');
global.SpriteAnim = { setEnemyCategory: () => {} };
const Popups = require('../js/ui/popups.js');

const task = (o) => Object.assign({
    id: 3, type: 'task', name: 'Write report', category: 'career', isHighPriority: false,
    dueDateTime: new Date(2026, 10, 2, 20, 0), timer: null, timerMsBanked: 0, subTasks: [],
}, o);
const opt = (sizeId, label, kind, extra) => Object.assign({ sizeId, label, kind, left: 0, cost: 0 }, extra);

function deps(over) {
    return Object.assign({
        activeItems: [], completeItem: jest.fn(), indulgeHabit: jest.fn(),
        recomputeOverdueStateAfterEdit: jest.fn(), sortAndRenderActiveList: jest.fn(), createListItem: jest.fn(), saveGame: jest.fn(),
        getPlayerPoints: () => 40,
    }, over);
}
beforeEach(() => { document.body.innerHTML = ''; });

describe('pushbackButtonText', () => {
    test('each kind says how the push is paid', () => {
        expect(Popups.pushbackButtonText(opt('short', '+30 min', 'free'))).toBe('+30 min — free');
        expect(Popups.pushbackButtonText(opt('short', '+30 min', 'charge', { left: 3 }))).toBe('+30 min — free (3 left)');
        expect(Popups.pushbackButtonText(opt('medium', '+2 hr', 'token'))).toBe('+2 hr — uses a token');
        expect(Popups.pushbackButtonText(opt('long', '+1 day', 'points', { cost: 30 }))).toBe('+1 day — 30 pts');
        expect(Popups.pushbackButtonText(opt('long', '+1 day', 'blocked', { cost: 30 }))).toBe('+1 day — 30 pts');
    });
});

describe('zombie popup pushback buttons', () => {
    const three = () => [
        opt('short', '+30 min', 'charge', { left: 3 }),
        opt('medium', '+2 hr', 'token'),
        opt('long', '+1 day', 'blocked', { cost: 30 }),
    ];

    test('one button per option, a blocked one is disabled and the balance shows', () => {
        Popups.showTaskDetailsPopup(task(), deps({ pushbackOptionsFor: three, onPushback: jest.fn() }));
        const btns = [...document.querySelectorAll('.pushback-btn')];
        expect(btns.map(b => b.dataset.sizeId)).toEqual(['short', 'medium', 'long']);
        expect(btns.map(b => b.disabled)).toEqual([false, false, true]);
        expect(btns[0].textContent.trim()).toBe('+30 min — free (3 left)');
        expect(document.querySelector('.pushback-balance-note').textContent).toBe('(you have 40 pts)');
    });

    test('no section when pushback is not wired or has no options', () => {
        Popups.showTaskDetailsPopup(task(), deps({ pushbackOptionsFor: () => [], onPushback: jest.fn() }));
        expect(document.querySelector('.pushback-section')).toBeNull();
        document.body.innerHTML = '';
        Popups.showTaskDetailsPopup(task(), deps());
        expect(document.querySelector('.pushback-section')).toBeNull();
    });

    test('a tap sends the size id and the item, then redraws the buttons from fresh options', () => {
        let options = three();
        const onPushback = jest.fn(() => { options = [opt('short', '+30 min', 'charge', { left: 2 }), opt('medium', '+2 hr', 'token'), opt('long', '+1 day', 'points', { cost: 30 })]; return { ok: true }; });
        const item = task();
        Popups.showTaskDetailsPopup(item, deps({ pushbackOptionsFor: () => options, onPushback }));
        document.querySelector('.pushback-btn[data-size-id="short"]').click();
        expect(onPushback).toHaveBeenCalledWith('short', item);
        const btns = [...document.querySelectorAll('.pushback-btn')];
        expect(btns[0].textContent.trim()).toBe('+30 min — free (2 left)');
        expect(btns[2].disabled).toBe(false);
        expect(document.querySelector('.pushback-balance-note').textContent).toBe('');
    });

    test('a failed push changes nothing', () => {
        const onPushback = jest.fn(() => ({ ok: false }));
        Popups.showTaskDetailsPopup(task(), deps({ pushbackOptionsFor: three, onPushback }));
        document.querySelector('.pushback-btn[data-size-id="medium"]').click();
        expect(onPushback).toHaveBeenCalledTimes(1);
        expect(document.querySelector('.pushback-btn[data-size-id="short"]').textContent.trim()).toBe('+30 min — free (3 left)');
    });

    test('a Break habit (lurker) never gets the section', () => {
        const lurker = { id: 7, type: 'habit', isNegative: true, name: 'Social', category: 'lifestyle', streak: 0, dueDateTime: new Date(2026, 10, 2, 20, 0), timerMsBanked: 0 };
        Popups.showTaskDetailsPopup(lurker, deps({ pushbackOptionsFor: three, onPushback: jest.fn() }));
        expect(document.querySelector('.pushback-section')).toBeNull();
    });
});

describe('edit form note text', () => {
    const q = (o) => Object.assign({
        later: true, free: false, reason: 'paid', size: 'medium', count: 1, kind: 'charge', ok: true,
        charges: 1, tokens: 0, pointUnits: 0, cost: 0, left: { short: 3, medium: 2, long: 2 },
    }, o);

    test('nothing for an earlier move', () => {
        expect(Popups.pushbackNoteText({ later: false, kind: 'free', reason: 'not-later' }, 10)).toEqual({ text: '', blocked: false });
        expect(Popups.pushbackNoteText(null, 10)).toEqual({ text: '', blocked: false });
    });
    test('free moves say why', () => {
        expect(Popups.pushbackNoteText(q({ kind: 'free', free: true, reason: 'calm' }), 0).text).toBe('Free: more than 4 hours away');
        expect(Popups.pushbackNoteText(q({ kind: 'free', free: true, reason: 'grace' }), 0).text).toBe('Free: just created');
    });
    test('a single charge names the size and what is left', () => {
        expect(Popups.pushbackNoteText(q(), 0).text).toBe('Uses 1 Medium pushback (1 left today)');
        expect(Popups.pushbackNoteText(q({ size: 'long', left: { long: 2 } }), 0).text).toBe('Uses 1 Long pushback (1 left this week)');
    });
    test('a token and points', () => {
        expect(Popups.pushbackNoteText(q({ kind: 'token', charges: 0, tokens: 1 }), 0).text).toBe('Uses a held Medium token');
        expect(Popups.pushbackNoteText(q({ kind: 'points', charges: 0, pointUnits: 1, cost: 10 }), 50).text).toBe('Costs 10 pts');
    });
    test('blocked says what is needed and blocks Save', () => {
        expect(Popups.pushbackNoteText(q({ kind: 'blocked', ok: false, charges: 0, pointUnits: 1, cost: 10 }), 4)).toEqual({ text: 'Costs 10 pts — you have 4', blocked: true });
    });
    test('a multi-unit move lists how each is paid', () => {
        const r = q({ size: 'long', count: 3, kind: 'points', charges: 1, pointUnits: 2, cost: 60 });
        expect(Popups.pushbackNoteText(r, 100).text).toBe('Uses 3 Long pushbacks: 1 free + 2 for 60 pts');
    });
});

describe('edit form live line', () => {
    test('shows the note from reschedulePricingFor and blocks Save when it cannot be paid', () => {
        const item = task();
        const pricing = jest.fn(() => ({ later: true, free: false, reason: 'paid', size: 'short', count: 1, kind: 'blocked', ok: false, canAfford: false, charges: 0, tokens: 0, pointUnits: 1, cost: 5, left: { short: 0 } }));
        Popups.showEditTaskModal(item, deps({ reschedulePricingFor: pricing, commitReschedule: jest.fn() }));
        expect(document.getElementById('editRescheduleNote').textContent).toBe('Costs 5 pts — you have 40');
        expect(document.getElementById('saveTaskChanges').disabled).toBe(true);
    });
    test('a paid move commits through commitReschedule with the quote', () => {
        const item = task();
        const quote = { later: true, free: false, reason: 'paid', size: 'short', count: 1, kind: 'charge', ok: true, canAfford: true, charges: 1, tokens: 0, pointUnits: 0, cost: 0, left: { short: 3 } };
        const commit = jest.fn();
        Popups.showEditTaskModal(item, deps({ reschedulePricingFor: () => quote, commitReschedule: commit }));
        expect(document.getElementById('editRescheduleNote').textContent).toBe('Uses 1 Short pushback (2 left today)');
        document.getElementById('saveTaskChanges').click();
        expect(commit).toHaveBeenCalledWith(item, quote);
    });
});

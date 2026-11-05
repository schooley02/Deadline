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
global.PushbackHelp = require('../js/ui/pushbackHelp.js');
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

    test('a priority task gets the "a push to another day drops priority" note; a normal task, a sub-task of a priority parent and the Priority line do not', () => {
        const d = () => deps({ pushbackOptionsFor: three, onPushback: jest.fn() });
        Popups.showTaskDetailsPopup(task({ isHighPriority: true }), d());
        expect(document.querySelector('.pushback-priority-note').textContent)
            .toBe("A push to another day drops this task's priority. Mark it again on the new day.");
        expect(document.body.textContent).toMatch(/Priority:\s*Yes/);
        document.body.innerHTML = '';
        Popups.showTaskDetailsPopup(task(), d());
        expect(document.querySelector('.pushback-priority-note')).toBeNull();
        expect(document.body.textContent).toMatch(/Priority:\s*No/);
        document.body.innerHTML = '';
        Popups.showTaskDetailsPopup(task({ isHighPriority: true, priorityInherited: true, parentId: 9 }), d());
        expect(document.querySelector('.pushback-priority-note')).toBeNull();
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

describe('charge dots and the (i) help (Build C)', () => {
    const withTotals = () => [
        opt('short', '+30 min', 'charge', { left: 2, total: 3 }),
        opt('medium', '+2 hr', 'token', { left: 0, total: 2 }),
        opt('long', '+1 day', 'free', { total: 2 }),
    ];
    const ctx = () => ({ star: 1, allowance: { short: 3, medium: 2, long: 2 }, left: { short: 2, medium: 2, long: 2 }, held: { short: 0, medium: 1, long: 0 } });

    test('dots: filled = free charges left, all hollow once a token/points will be used, none for a calm free move', () => {
        Popups.showTaskDetailsPopup(task(), deps({ pushbackOptionsFor: withTotals, onPushback: jest.fn(), pushbackHelpCtx: ctx }));
        const btns = [...document.querySelectorAll('.pushback-btn')];
        expect(btns[0].querySelectorAll('.pb-dot').length).toBe(3);
        expect(btns[0].querySelectorAll('.pb-dot--on').length).toBe(2);
        expect(btns[1].querySelectorAll('.pb-dot').length).toBe(2);
        expect(btns[1].querySelectorAll('.pb-dot--on').length).toBe(0);
        expect(btns[2].querySelectorAll('.pb-dot').length).toBe(0);
        expect(btns[0].textContent.replace(/\s+/g, ' ').trim()).toBe('+30 min — free (2 left)');
    });

    test('the (i) opens a panel with live numbers; tapping it does not press a pushback button', () => {
        const onPushback = jest.fn();
        Popups.showTaskDetailsPopup(task(), deps({ pushbackOptionsFor: withTotals, onPushback, pushbackHelpCtx: ctx }));
        const btn = document.querySelector('.pushback-label .form-hint-btn');
        const pop = document.getElementById('popupPushbackHint');
        expect(pop.hidden).toBe(true);
        btn.click();
        expect(pop.hidden).toBe(false);
        expect(pop.textContent).toContain('Short 2 of 3 left today');
        expect(pop.textContent).toContain('Tokens held: 1 Medium');
        expect(onPushback).not.toHaveBeenCalled();
    });

    test('no (i) without the help ctx dep; buttons still work', () => {
        Popups.showTaskDetailsPopup(task(), deps({ pushbackOptionsFor: withTotals, onPushback: jest.fn() }));
        expect(document.querySelector('.pushback-label .form-hint-btn')).toBeNull();
        expect(document.querySelectorAll('.pushback-btn').length).toBe(3);
    });

    test('after a push the dots and the panel numbers follow the new state', () => {
        let left = 2;
        const opts = () => [opt('short', '+30 min', 'charge', { left, total: 3 })];
        const c = () => ({ star: 1, allowance: { short: 3, medium: 2, long: 2 }, left: { short: left, medium: 2, long: 2 }, held: {} });
        const onPushback = jest.fn(() => { left -= 1; return { ok: true }; });
        Popups.showTaskDetailsPopup(task(), deps({ pushbackOptionsFor: opts, onPushback, pushbackHelpCtx: c }));
        document.querySelector('.pushback-btn').click();
        expect(document.querySelectorAll('.pushback-btn .pb-dot--on').length).toBe(1);
        expect(document.getElementById('popupPushbackHint').textContent).toContain('Short 1 of 3 left today');
    });
});

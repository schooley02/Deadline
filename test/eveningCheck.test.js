/**
 * @jest-environment jsdom
 */
/*
 * Habit Goals Build 3 (2026-11-01): the evening check modal, the How much? box on the next-morning card, and the popup's
 * Amount How much?. DOM only; the economics are in test/habitGoalsBuild3.test.js.
 */
global.CONFIG = require('../js/config.js');
global.Habits = require('../js/habits.js');
global.Timer = require('../js/timer.js');
global.GoalCheck = require('../js/goalCheck.js');
global.Modal = require('../js/ui/modal.js');
const CheckIn = require('../js/ui/checkIn.js');

const flush = () => new Promise((r) => setTimeout(r, 0)); // MutationObserver callbacks are microtasks

const AMOUNT = { type: 'amount', amount: 2, unit: 'drinks', note: null };
const TIME = { type: 'time', amount: 60, unit: 'min', note: null };
const NOTE = { type: 'note', amount: null, unit: null, note: 'No coffee after 2 PM' };
const NONE = { type: 'none', amount: null, unit: null, note: null };
const item = (id, name, goal, extra) => Object.assign({
    id, name, type: 'habit', isNegative: true, goal, definitionId: 'd' + id, timerMsBanked: 0,
}, extra);

function makeDeps(items) {
    const calls = [];
    return {
        calls,
        getCandidates: () => items,
        completeItem: (id, opts) => calls.push(['avoid', id, opts]),
        indulgeHabit: (id, opts) => calls.push(['slip', id, opts]),
        setLoggedMinutes: (id, m) => calls.push(['minutes', id, m]),
        onDismiss: jest.fn(),
    };
}
const card = (id) => document.querySelector(`.evening-card[data-item-id="${id}"]`);
const click = (id, outcome) => card(id).querySelector(`[data-outcome="${outcome}"]`).click();
const type = (id, value) => { const el = card(id).querySelector('.how-much-input'); el.value = value; };

beforeEach(() => { document.body.innerHTML = ''; });

describe('showEveningModal: what it shows', () => {
    test('nothing to ask -> no modal, returns null', () => {
        expect(CheckIn.showEveningModal(makeDeps([]))).toBeNull();
        expect(document.querySelector('.evening-overlay')).toBeNull();
    });

    test('one card per habit with an escaped name, the goal line, and Resisted / Slipped / Later', () => {
        CheckIn.showEveningModal(makeDeps([item(1, 'Drinks <i>', AMOUNT), item(2, 'Social media', TIME), item(3, 'Coffee', NOTE), item(4, 'Soda', NONE)]));
        expect(document.querySelectorAll('.evening-card')).toHaveLength(4);
        expect(card(1).textContent).toContain('Drinks <i>');
        expect(card(1).querySelector('i')).toBeNull(); // escaped
        expect(card(1).querySelector('.check-in-goal').textContent).toBe('Limit: 2 drinks');
        expect(card(2).querySelector('.check-in-goal').textContent).toBe('Limit: 1 hr');
        expect(card(3).querySelector('.check-in-goal').textContent).toBe('No coffee after 2 PM');
        expect(card(4).querySelector('.check-in-goal')).toBeNull();
        ['avoided', 'indulged', 'later'].forEach((o) => expect(card(1).querySelector(`[data-outcome="${o}"]`)).not.toBeNull());
    });

    test('How much? box: a number for Amount, minutes for Time, nothing for Note / none', () => {
        CheckIn.showEveningModal(makeDeps([item(1, 'A', AMOUNT), item(2, 'B', TIME), item(3, 'C', NOTE), item(4, 'D', NONE)]));
        expect(card(1).querySelector('.how-much-input').getAttribute('data-kind')).toBe('amount');
        expect(card(1).querySelector('.how-much-label').textContent).toContain('drinks');
        expect(card(2).querySelector('.how-much-input').getAttribute('data-kind')).toBe('time');
        expect(card(3).querySelector('.how-much-input')).toBeNull();
        expect(card(4).querySelector('.how-much-input')).toBeNull();
    });

    test('a Time card is prefilled with the logged minutes and shows the timer hint; with none logged it is blank', () => {
        CheckIn.showEveningModal(makeDeps([item(1, 'A', TIME, { timerMsBanked: 18 * 60000 }), item(2, 'B', TIME)]));
        expect(card(1).querySelector('.how-much-input').value).toBe('18');
        expect(card(1).querySelector('.check-in-hint').textContent).toBe('Timer logged 18 min');
        expect(card(2).querySelector('.how-much-input').value).toBe('');
        expect(card(2).querySelector('.check-in-hint')).toBeNull();
    });

    test('a second call while one is open does not stack', () => {
        const d = makeDeps([item(1, 'A', AMOUNT)]);
        expect(CheckIn.showEveningModal(d)).not.toBeNull();
        expect(CheckIn.showEveningModal(d)).toBeNull();
        expect(document.querySelectorAll('.evening-overlay')).toHaveLength(1);
    });
});

describe('showEveningModal: answering', () => {
    test('Resisted / Slipped call the right action with the typed Amount as { actual }', () => {
        const d = makeDeps([item(1, 'A', AMOUNT), item(2, 'B', AMOUNT)]);
        CheckIn.showEveningModal(d);
        type(1, '1');
        click(1, 'avoided');
        type(2, '5.5');
        click(2, 'indulged');
        expect(d.calls).toEqual([['avoid', 1, { actual: 1 }], ['slip', 2, { actual: 5.5 }]]);
        expect(document.querySelector('.evening-overlay')).toBeNull(); // closed after the last card
    });

    test('a blank or invalid How much? passes no opts (the answer alone still counts)', () => {
        const d = makeDeps([item(1, 'A', AMOUNT), item(2, 'B', AMOUNT), item(3, 'C', NOTE)]);
        CheckIn.showEveningModal(d);
        click(1, 'avoided');
        type(2, 'lots');
        click(2, 'indulged');
        click(3, 'avoided');
        expect(d.calls).toEqual([['avoid', 1, undefined], ['slip', 2, undefined], ['avoid', 3, undefined]]);
    });

    test('Time goal: changed minutes are applied AFTER the answer; untouched minutes are not re-applied', () => {
        const d = makeDeps([item(1, 'A', TIME, { timerMsBanked: 18 * 60000 }), item(2, 'B', TIME, { timerMsBanked: 30 * 60000 })]);
        CheckIn.showEveningModal(d);
        type(1, '25');
        click(1, 'avoided');
        click(2, 'indulged'); // left at its prefilled 30
        expect(d.calls).toEqual([['avoid', 1, undefined], ['minutes', 1, 25], ['slip', 2, undefined]]);
    });

    test('Time goal with nothing logged and nothing typed applies nothing; typing minutes records them', () => {
        const d = makeDeps([item(1, 'A', TIME), item(2, 'B', TIME)]);
        CheckIn.showEveningModal(d);
        click(1, 'avoided');
        type(2, '12');
        click(2, 'indulged');
        expect(d.calls).toEqual([['avoid', 1, undefined], ['slip', 2, undefined], ['minutes', 2, 12]]);
    });

    test('0 is a real answer for an Amount goal ("none today")', () => {
        const d = makeDeps([item(1, 'A', AMOUNT)]);
        CheckIn.showEveningModal(d);
        type(1, '0');
        click(1, 'avoided');
        expect(d.calls).toEqual([['avoid', 1, { actual: 0 }]]);
    });
});

describe('showEveningModal: Later and dismissal', () => {
    test('Later leaves that habit unanswered, answers nothing, and reports a dismissal when the modal closes', async () => {
        const d = makeDeps([item(1, 'A', AMOUNT), item(2, 'B', AMOUNT)]);
        CheckIn.showEveningModal(d);
        click(1, 'later');
        expect(d.calls).toEqual([]);
        expect(card(1)).toBeNull();
        click(2, 'avoided');
        await flush();
        expect(document.querySelector('.evening-overlay')).toBeNull();
        expect(d.onDismiss).toHaveBeenCalledTimes(1);
    });

    test('answering everything is NOT a dismissal', async () => {
        const d = makeDeps([item(1, 'A', AMOUNT), item(2, 'B', NOTE)]);
        CheckIn.showEveningModal(d);
        click(1, 'avoided');
        click(2, 'indulged');
        await flush();
        expect(d.onDismiss).not.toHaveBeenCalled();
    });

    test('the "I\'ll check this later" link closes with cards left and reports a dismissal', async () => {
        const d = makeDeps([item(1, 'A', AMOUNT), item(2, 'B', AMOUNT)]);
        CheckIn.showEveningModal(d);
        click(1, 'avoided');
        document.querySelector('.evening-later-link').click();
        await flush();
        expect(document.querySelector('.evening-overlay')).toBeNull();
        expect(card(2)).toBeNull();
        expect(d.onDismiss).toHaveBeenCalledTimes(1);
    });

    test('an outside tap / Esc (the overlay just disappears) with cards left reports a dismissal too', async () => {
        const d = makeDeps([item(1, 'A', AMOUNT)]);
        const overlay = CheckIn.showEveningModal(d);
        overlay.remove();
        await flush();
        expect(d.onDismiss).toHaveBeenCalledTimes(1);
    });

    test('works without an onDismiss dep', () => {
        const d = makeDeps([item(1, 'A', AMOUNT)]);
        delete d.onDismiss;
        expect(() => { CheckIn.showEveningModal(d); click(1, 'later'); }).not.toThrow();
    });
});

describe('next-morning check-in card gets the goal line + How much?', () => {
    function pendingDef(goal, banked) {
        return { id: 'd9', name: 'Drinks', isNegative: true, goal, pendingCheckIn: { originalDueDate: new Date('2026-10-31T12:00:00'), entry: { name: 'Drinks', goal, timerMsBanked: banked || 0 } } };
    }
    function open(def) {
        const calls = [];
        CheckIn.showCheckInModal({ getDefinedHabits: () => [def], resolvePendingCheckIn: (id, outcome, opts) => calls.push([id, outcome, opts]) });
        return calls;
    }

    test('an Amount goal shows its line and box; the typed number rides along as { actual }', () => {
        const calls = open(pendingDef(AMOUNT));
        const c = document.querySelector('.check-in-card');
        expect(c.querySelector('.check-in-goal').textContent).toBe('Limit: 2 drinks');
        c.querySelector('.how-much-input').value = '3';
        c.querySelector('[data-outcome="indulged"]').click();
        expect(calls).toEqual([['d9', 'indulged', { actual: 3 }]]);
    });

    test('a Time goal prefills from the snapshot; changed minutes ride along as { loggedMinutes }', () => {
        const calls = open(pendingDef(TIME, 40 * 60000));
        const c = document.querySelector('.check-in-card');
        expect(c.querySelector('.how-much-input').value).toBe('40');
        expect(c.querySelector('.check-in-hint').textContent).toBe('Timer logged 40 min');
        c.querySelector('.how-much-input').value = '55';
        c.querySelector('[data-outcome="avoided"]').click();
        expect(calls).toEqual([['d9', 'avoided', { loggedMinutes: 55 }]]);
    });

    test('a habit with no goal looks exactly as before (no goal line, no box) and passes empty opts', () => {
        const calls = open(pendingDef(NONE));
        const c = document.querySelector('.check-in-card');
        expect(c.querySelector('.check-in-goal')).toBeNull();
        expect(c.querySelector('.how-much-input')).toBeNull();
        c.querySelector('[data-outcome="avoided"]').click();
        expect(calls).toEqual([['d9', 'avoided', {}]]);
    });

    test('a marker with no snapshot falls back to the definition\'s goal', () => {
        const def = { id: 'd9', name: 'Drinks', isNegative: true, goal: AMOUNT, pendingCheckIn: { originalDueDate: new Date('2026-10-31T12:00:00') } };
        open(def);
        expect(document.querySelector('.check-in-card .check-in-goal').textContent).toBe('Limit: 2 drinks');
    });
});

describe('howMuchHtml / readHowMuch', () => {
    test('escapes the unit and returns nothing for goals without a box', () => {
        expect(CheckIn.howMuchHtml(NOTE, {})).toBe('');
        expect(CheckIn.howMuchHtml(NONE, {})).toBe('');
        expect(CheckIn.howMuchHtml(null, {})).toBe('');
        const html = CheckIn.howMuchHtml({ type: 'amount', amount: 1, unit: '<b>x</b>' }, {});
        expect(html).not.toContain('<b>x</b>');
        expect(html).toContain('&lt;b&gt;');
    });

    test('readHowMuch is empty with no box, no value, a bad value, or an out-of-range value', () => {
        document.body.innerHTML = `<div id="c">${CheckIn.howMuchHtml(AMOUNT, {})}</div>`;
        const c = document.getElementById('c');
        expect(CheckIn.readHowMuch(c)).toEqual({});
        c.querySelector('input').value = '-4';
        expect(CheckIn.readHowMuch(c)).toEqual({});
        c.querySelector('input').value = '7';
        expect(CheckIn.readHowMuch(c)).toEqual({ actual: 7 });
        expect(CheckIn.readHowMuch(null)).toEqual({});
        expect(CheckIn.readHowMuch(document.createElement('div'))).toEqual({});
    });
});

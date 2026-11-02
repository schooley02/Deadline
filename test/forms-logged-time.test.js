/**
 * @jest-environment jsdom
 */
/**
 * Forms.loggedTimeHtml / readLoggedTime (Habit Goals Build 2c): the hours + minutes field for a timer's logged total.
 */
const Forms = require('../js/ui/forms.js');
const MIN = 60000;

function mount(opts) { document.body.innerHTML = Forms.loggedTimeHtml(opts); }
const set = (id, v) => { document.getElementById(id).value = v; };

describe('loggedTimeHtml', () => {
    test('shows the logged time as hours + minutes, rounded to the minute', () => {
        mount({ idPrefix: 'lt', ms: 65 * MIN + 20000 });
        expect(document.getElementById('ltHours').value).toBe('1');
        expect(document.getElementById('ltMinutes').value).toBe('5');
    });
    test('no time logged shows 0 hr 0 min', () => {
        mount({ idPrefix: 'lt', ms: 0 });
        expect(document.getElementById('ltHours').value).toBe('0');
        expect(document.getElementById('ltMinutes').value).toBe('0');
        mount({ idPrefix: 'lt' });
        expect(document.getElementById('ltMinutes').value).toBe('0');
    });
    test('disabled while a timer runs, with a note', () => {
        mount({ idPrefix: 'lt', ms: MIN, disabled: true, note: 'Pause the timer to edit.' });
        expect(document.getElementById('ltHours').disabled).toBe(true);
        expect(document.getElementById('ltMinutes').disabled).toBe(true);
        expect(document.getElementById('ltNote').textContent).toBe('Pause the timer to edit.');
    });
});

describe('readLoggedTime', () => {
    test('untouched: ms matches and changed is false (a precise value is never rewritten)', () => {
        mount({ idPrefix: 'lt', ms: 65 * MIN + 20000 });
        expect(Forms.readLoggedTime('lt')).toEqual({ ms: 65 * MIN, changed: false });
    });
    test('typed value: ms and changed', () => {
        mount({ idPrefix: 'lt', ms: 10 * MIN });
        set('ltHours', '2'); set('ltMinutes', '30');
        expect(Forms.readLoggedTime('lt')).toEqual({ ms: 150 * MIN, changed: true });
    });
    test('blank fields count as 0', () => {
        mount({ idPrefix: 'lt', ms: 10 * MIN });
        set('ltHours', ''); set('ltMinutes', '');
        expect(Forms.readLoggedTime('lt')).toEqual({ ms: 0, changed: true });
    });
    test('rejects fractions, negatives, minutes over 59 and more than 24 hours', () => {
        mount({ idPrefix: 'lt', ms: 0 });
        set('ltMinutes', '1.5'); expect(Forms.readLoggedTime('lt').error).toBeTruthy();
        set('ltMinutes', '-1'); expect(Forms.readLoggedTime('lt').error).toBeTruthy();
        set('ltMinutes', '75'); expect(Forms.readLoggedTime('lt').error).toBeTruthy();
        set('ltMinutes', '0'); set('ltHours', '24'); expect(Forms.readLoggedTime('lt').ms).toBe(24 * 60 * MIN);
        set('ltMinutes', '1'); expect(Forms.readLoggedTime('lt').error).toBeTruthy();
    });
    test('no field on the page: absent', () => {
        document.body.innerHTML = '';
        expect(Forms.readLoggedTime('lt')).toEqual({ absent: true });
    });
});

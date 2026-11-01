/**
 * Start moves Due with it (2026-11-01, Jeremy): editing a Start time shifts the Due time by the same minutes;
 * Due stays editable. Pure helper + the document-level listener (jsdom).
 * @jest-environment jsdom
 */
const Forms = require('../js/ui/forms.js');

describe('shiftDueForStart', () => {
    test('moves due by the same amount, later or earlier', () => {
        expect(Forms.shiftDueForStart('09:00', '09:30', '10:00')).toBe('10:30');
        expect(Forms.shiftDueForStart('09:00', '08:15', '10:00')).toBe('09:15');
        expect(Forms.shiftDueForStart('09:00', '12:00', '17:00')).toBe('20:00');
    });
    test('no shift when start was blank, is cleared, due is blank, or nothing moved', () => {
        expect(Forms.shiftDueForStart('', '09:30', '10:00')).toBeNull();
        expect(Forms.shiftDueForStart('09:00', '', '10:00')).toBeNull();
        expect(Forms.shiftDueForStart('09:00', '09:30', '')).toBeNull();
        expect(Forms.shiftDueForStart('09:00', '09:00', '10:00')).toBeNull();
    });
    test('holds the result inside the day (no crossing midnight)', () => {
        expect(Forms.shiftDueForStart('09:00', '12:00', '22:30')).toBe('23:59');
        expect(Forms.shiftDueForStart('12:00', '01:00', '02:00')).toBe('00:00');
    });
});

describe('Start input listener', () => {
    function build(startVal, dueVal) {
        document.body.innerHTML = Forms.startDueTimeGroupHtml({ startId: 'editStartTime', dueId: 'editDueTime', startValue: startVal, dueValue: dueVal });
        return { start: document.getElementById('editStartTime'), due: document.getElementById('editDueTime') };
    }
    const change = (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };

    test('changing Start moves Due; a second change keeps tracking the last value', () => {
        const { start, due } = build('09:00', '10:00');
        change(start, '09:30');
        expect(due.value).toBe('10:30');
        change(start, '10:30'); // +60 more
        expect(due.value).toBe('11:30');
    });
    test('the player can override Due after the shift', () => {
        const { start, due } = build('09:00', '10:00');
        change(start, '09:30');
        due.value = '12:00';
        expect(due.value).toBe('12:00');
    });
    test('adding a Start to an empty box leaves Due alone', () => {
        const { start, due } = build('', '17:00');
        change(start, '09:00');
        expect(due.value).toBe('17:00');
    });
});

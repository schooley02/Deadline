/**
 * @jest-environment jsdom
 */
/**
 * Add Sub-task: adding a Start time sets Due one hour later (2026-11-04, Jeremy), held to 23:59 and to the parent's
 * due time, left alone when the player typed his own Due, and still overridable. Other forms keep "no shift when a Start
 * is first added" (test/startTime.test.js family).
 */
const Forms = require('../js/ui/forms.js');

describe('Forms.autoDueForNewStart', () => {
    test('first Start added: Due is one hour later', () => {
        expect(Forms.autoDueForNewStart('', '09:30', null)).toBe('10:30');
        expect(Forms.autoDueForNewStart(undefined, '00:00', null)).toBe('01:00');
    });
    test('held to 23:59 (a time of day cannot cross midnight)', () => {
        expect(Forms.autoDueForNewStart('', '23:30', null)).toBe('23:59');
        expect(Forms.autoDueForNewStart('', '22:59', null)).toBe('23:59');
    });
    test('held to the parent due time when given', () => {
        expect(Forms.autoDueForNewStart('', '16:30', '17:00')).toBe('17:00');
        expect(Forms.autoDueForNewStart('', '10:00', '17:00')).toBe('11:00');
    });
    test('a cap at or before the Start leaves Due alone (null)', () => {
        expect(Forms.autoDueForNewStart('', '17:00', '17:00')).toBeNull();
        expect(Forms.autoDueForNewStart('', '18:00', '17:00')).toBeNull();
        expect(Forms.autoDueForNewStart('', '23:59', null)).toBeNull();
    });
    test('only when a Start is ADDED: changing or clearing one is not this rule', () => {
        expect(Forms.autoDueForNewStart('09:00', '10:00', null)).toBeNull();
        expect(Forms.autoDueForNewStart('', '', null)).toBeNull();
        expect(Forms.autoDueForNewStart('09:00', '', null)).toBeNull();
    });
});

describe('Add Sub-task form: Start box moves Due', () => {
    function mount({ parentDate = '2026-11-05', parentTime = '17:00', dueDate = parentDate, due = parentTime } = {}) {
        document.body.innerHTML =
            `<input type="date" id="subTaskDueDate" value="${dueDate}" max="${parentDate}">` +
            Forms.startDueTimeGroupHtml({
                startId: 'subTaskStartTime', dueId: 'subTaskDueTime', startValue: '', dueValue: due,
                startAttrs: `data-cap-date="${parentDate}" data-cap-time="${parentTime}"`,
            });
        return { start: document.getElementById('subTaskStartTime'), due: document.getElementById('subTaskDueTime') };
    }
    const typeStart = (start, v) => { start.value = v; Forms.onStartTimeChange({ target: start }); };
    const typeDue = (due, v) => { due.value = v; Forms.onStartTimeChange({ target: due }); };

    test('adding a Start sets Due to an hour later', () => {
        const { start, due } = mount();
        typeStart(start, '09:00');
        expect(due.value).toBe('10:00');
    });
    test('the player can override the new Due', () => {
        const { start, due } = mount();
        typeStart(start, '09:00');
        typeDue(due, '12:15');
        expect(due.value).toBe('12:15');
    });
    test('after the first add, moving Start keeps moving Due by the same amount (existing rule)', () => {
        const { start, due } = mount();
        typeStart(start, '09:00');   // Due 10:00
        typeStart(start, '09:30');   // +30 min
        expect(due.value).toBe('10:30');
    });
    test('a Due the player typed BEFORE adding a Start is not overwritten', () => {
        const { start, due } = mount();
        typeDue(due, '15:00');
        typeStart(start, '14:00');
        expect(due.value).toBe('15:00');
    });
    test('held to the parent due time on the parent date', () => {
        const { start, due } = mount({ parentTime: '17:00' });
        typeStart(start, '16:30');
        expect(due.value).toBe('17:00');
    });
    test('on an earlier date the parent time does not cap it', () => {
        const { start, due } = mount({ parentDate: '2026-11-05', dueDate: '2026-11-04', parentTime: '17:00', due: '17:00' });
        typeStart(start, '16:30');
        expect(due.value).toBe('17:30');
    });
    test('clearing the Start leaves Due where it is', () => {
        const { start, due } = mount();
        typeStart(start, '09:00');
        typeStart(start, '');
        expect(due.value).toBe('10:00');
    });
    test('removing and re-adding a Start sets Due again (the player never touched Due)', () => {
        const { start, due } = mount();
        typeStart(start, '09:00');
        typeStart(start, '');
        typeStart(start, '13:00');
        expect(due.value).toBe('14:00');
    });
});

describe('other forms keep the old rule: adding a first Start does not move Due', () => {
    test('Add Task', () => {
        document.body.innerHTML = Forms.startDueTimeGroupHtml({ startId: 'modalStartTime', dueId: 'modalDueTime', startValue: '', dueValue: '17:00' });
        const start = document.getElementById('modalStartTime');
        start.value = '09:00';
        Forms.onStartTimeChange({ target: start });
        expect(document.getElementById('modalDueTime').value).toBe('17:00');
    });
});

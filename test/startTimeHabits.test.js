/**
 * @jest-environment jsdom
 *
 * Start time, Build B (2026-11-01, Jeremy): a BUILD habit's Completion Window can be "Custom times..." -- an
 * optional Start and a required End (= the due time). Each day's instance walks to the start time, waits at the
 * church until the end, then attacks. Break habits keep their tempting-time buckets (no custom option).
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
global.Schedule = require('../js/schedule.js');
global.FrozenSlots = require('../js/frozenSlots.js');
const Habits = global.Habits = require('../js/habits.js');
const Routines = require('../js/routines.js');
const Modal = require('../js/ui/modal.js');
const Forms = require('../js/ui/forms.js');

const DAY = new Date(2026, 5, 15, 0, 0, 0, 0);
const hm = (d) => d && [d.getHours(), d.getMinutes()];

describe('Habits custom times (pure)', () => {
    test('normalizeCustomTimes: only Build habits with an End may be custom', () => {
        expect(Habits.normalizeCustomTimes('custom', false, '15:00', '17:00'))
            .toEqual({ timeOfDay: 'custom', startTime: '15:00', endTime: '17:00' });
        expect(Habits.normalizeCustomTimes('custom', false, '', '17:00'))
            .toEqual({ timeOfDay: 'custom', startTime: null, endTime: '17:00' });
        expect(Habits.normalizeCustomTimes('custom', false, '18:00', '17:00').startTime).toBeNull();
        expect(Habits.normalizeCustomTimes('custom', true, '15:00', '17:00').timeOfDay).toBe('anytime');
        expect(Habits.normalizeCustomTimes('custom', false, '15:00', '').timeOfDay).toBe('anytime');
        expect(Habits.normalizeCustomTimes('morning', false, '15:00', '17:00'))
            .toEqual({ timeOfDay: 'morning', startTime: null, endTime: null });
    });

    test('getHabitInstanceDueTime: custom uses End; buckets are unchanged', () => {
        expect(hm(Habits.getHabitInstanceDueTime('custom', DAY, '16:45'))).toEqual([16, 45]);
        expect(hm(Habits.getHabitInstanceDueTime('custom', DAY, 'bad'))).toEqual([23, 59]);
        expect(hm(Habits.getHabitInstanceDueTime('morning', DAY))).toEqual([12, 0]);
        expect(hm(Habits.getHabitInstanceDueTime('afternoon', DAY, '09:00'))).toEqual([17, 0]);
        expect(hm(Habits.getHabitInstanceDueTime('evening', DAY))).toEqual([22, 0]);
    });

    test('getHabitInstanceStartTime: a Date for a valid custom Build habit, else null', () => {
        const ok = { timeOfDay: 'custom', isNegative: false, startTime: '15:00', endTime: '17:00' };
        expect(hm(Habits.getHabitInstanceStartTime(ok, DAY))).toEqual([15, 0]);
        expect(Habits.getHabitInstanceStartTime({ ...ok, startTime: null }, DAY)).toBeNull();
        expect(Habits.getHabitInstanceStartTime({ ...ok, startTime: '17:00' }, DAY)).toBeNull();
        expect(Habits.getHabitInstanceStartTime({ ...ok, isNegative: true }, DAY)).toBeNull();
        expect(Habits.getHabitInstanceStartTime({ ...ok, timeOfDay: 'morning' }, DAY)).toBeNull();
        expect(Habits.getHabitInstanceStartTime({ timeOfDay: 'morning' }, DAY)).toBeNull();
    });

    test('createHabitInstanceData builds the window (due = End, start = Start)', () => {
        const def = { id: 'h1', name: 'Read', category: 'lifestyle', timeOfDay: 'custom', startTime: '15:00', endTime: '17:00', streak: 0, isNegative: false };
        const inst = Habits.createHabitInstanceData(def, DAY, {
            getNextId: () => 1, gameScreenWidth: 800, habitEnemyWidth: 60, negativeLurkRightMarginPx: 20,
            calculateTimelinePosition: () => 42,
        });
        expect(hm(inst.dueDateTime)).toEqual([17, 0]);
        expect(hm(inst.startDateTime)).toEqual([15, 0]);
        expect(Clock.hasWorkWindow(inst)).toBe(true);
        const plain = Habits.createHabitInstanceData({ ...def, timeOfDay: 'evening', startTime: null, endTime: null }, DAY, {
            getNextId: () => 2, gameScreenWidth: 800, habitEnemyWidth: 60, negativeLurkRightMarginPx: 20,
            calculateTimelinePosition: () => 42,
        });
        expect(plain.startDateTime).toBeNull();
    });

    test('retimeHabitInstance: sets start + due for custom, clears start for a bucket', () => {
        const item = { type: 'habit', isNegative: false, dueDateTime: new Date(2026, 5, 15, 12, 0), startDateTime: null };
        expect(Habits.retimeHabitInstance(item, 'custom', { startTime: '14:00', endTime: '16:30' })).toBe(true);
        expect(hm(item.dueDateTime)).toEqual([16, 30]);
        expect(hm(item.startDateTime)).toEqual([14, 0]);
        // start-only change: due unchanged -> false, start moves
        expect(Habits.retimeHabitInstance(item, 'custom', { startTime: '13:00', endTime: '16:30' })).toBe(false);
        expect(hm(item.startDateTime)).toEqual([13, 0]);
        // back to a bucket: start cleared
        expect(Habits.retimeHabitInstance(item, 'evening')).toBe(true);
        expect(item.startDateTime).toBeNull();
        expect(hm(item.dueDateTime)).toEqual([22, 0]);
    });
});

describe('Routines habit definitions', () => {
    const routine = () => ({ id: 'r1', habitDefinitionIds: [] });

    test('create stores a custom window on the definition', () => {
        const defs = [];
        const h = Routines.createNewHabitInRoutine('r1', { name: 'H', category: 'health', timeOfDay: 'custom', startTime: '15:00', endTime: '17:00', isNegative: false }, [routine()], defs);
        expect(h.timeOfDay).toBe('custom');
        expect(h.startTime).toBe('15:00');
        expect(h.endTime).toBe('17:00');
    });

    test('a Break habit can never be custom; no custom window leaves nulls', () => {
        const defs = [];
        const neg = Routines.createNewHabitInRoutine('r1', { name: 'N', category: 'health', timeOfDay: 'custom', startTime: '15:00', endTime: '17:00', isNegative: true }, [routine()], defs);
        expect(neg.timeOfDay).toBe('anytime');
        expect(neg.startTime).toBeNull();
        const plain = Routines.createNewHabitInRoutine('r1', { name: 'P', category: 'health', timeOfDay: 'morning', isNegative: false }, [routine()], defs);
        expect(plain.startTime).toBeNull();
        expect(plain.endTime).toBeNull();
    });

    test('edit updates the window and records a timeOfDay change when only the start moves', () => {
        const defs = [];
        const h = Routines.createNewHabitInRoutine('r1', { name: 'H', category: 'health', timeOfDay: 'custom', startTime: '15:00', endTime: '17:00', isNegative: false }, [routine()], defs);
        Routines.editHabitInRoutine(h.id, { name: 'H', category: 'health', schedule: h.schedule, timeOfDay: 'custom', startTime: '14:00', endTime: '17:00', isNegative: false }, defs, null);
        expect(h.startTime).toBe('14:00');
        expect(h.modificationHistory[h.modificationHistory.length - 1].changedFields).toContain('timeOfDay');
        Routines.editHabitInRoutine(h.id, { name: 'H', category: 'health', schedule: h.schedule, timeOfDay: 'morning', isNegative: false }, defs, null);
        expect(h.timeOfDay).toBe('morning');
        expect(h.startTime).toBeNull();
        expect(h.endTime).toBeNull();
    });
});

describe('Form helpers and wiring', () => {
    test('customHabitTimesError', () => {
        expect(Forms.customHabitTimesError('morning', false, '', '')).toBeNull();
        expect(Forms.customHabitTimesError('custom', true, '', '')).toBeNull();
        expect(Forms.customHabitTimesError('custom', false, '', '')).toMatch(/end time/);
        expect(Forms.customHabitTimesError('custom', false, '17:00', '17:00')).toMatch(/earlier/);
        expect(Forms.customHabitTimesError('custom', false, '', '17:00')).toBeNull();
        expect(Forms.customHabitTimesError('custom', false, '15:00', '17:00')).toBeNull();
    });

    test('the custom pair: Start LEFT of End, id = select id + Custom, hidden until chosen', () => {
        const hidden = Forms.customHabitTimesHtml({ selectId: 'sel', startId: 'st', endId: 'en', startValue: '', endValue: '', visible: false });
        expect(hidden).toContain('id="selCustom"');
        expect(hidden).toContain('custom-habit-times');
        expect(hidden).toContain(' hidden');
        expect(hidden.indexOf('id="st"')).toBeLessThan(hidden.indexOf('id="en"'));
        const shown = Forms.customHabitTimesHtml({ selectId: 'sel', startId: 'st', endId: 'en', startValue: '15:00', endValue: '17:00', visible: true });
        expect(shown).not.toContain(' hidden');
        expect(shown).toContain('value="15:00"');
        expect(shown).toContain('value="17:00"');
    });

    function mount(typeValue, selected) {
        document.body.innerHTML = `
            <input type="radio" name="t" id="tp" value="positive" ${typeValue === 'positive' ? 'checked' : ''}>
            <input type="radio" name="t" id="tn" value="negative" ${typeValue === 'negative' ? 'checked' : ''}>
            <div class="form-row"><label>Time of Day:</label>
              <select id="sel">
                <option value="anytime">Anytime Today</option><option value="morning">Morning</option>
                <option value="custom" ${selected === 'custom' ? 'selected' : ''}>Custom times...</option>
              </select></div>
            ${Forms.customHabitTimesHtml({ selectId: 'sel', startId: 'st', endId: 'en', startValue: '', endValue: '', visible: selected === 'custom' })}`;
        Modal.wireHabitTimeLabels('t', 'sel');
    }
    const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));

    test('choosing Custom shows the pair; choosing another bucket hides it', () => {
        mount('positive', 'anytime');
        const group = document.getElementById('selCustom');
        expect(group.hidden).toBe(true);
        const sel = document.getElementById('sel');
        sel.value = 'custom'; fire(sel, 'change');
        expect(group.hidden).toBe(false);
        sel.value = 'morning'; fire(sel, 'change');
        expect(group.hidden).toBe(true);
    });

    test('switching to a Break habit hides the Custom option and falls back to Anytime', () => {
        mount('positive', 'custom');
        const sel = document.getElementById('sel');
        const group = document.getElementById('selCustom');
        expect(group.hidden).toBe(false);
        const neg = document.getElementById('tn');
        neg.checked = true; fire(neg, 'change');
        const customOpt = Array.from(sel.options).find(o => o.value === 'custom');
        expect(customOpt.hidden).toBe(true);
        expect(customOpt.disabled).toBe(true);
        expect(sel.value).toBe('anytime');
        expect(group.hidden).toBe(true);
        const pos = document.getElementById('tp');
        pos.checked = true; fire(pos, 'change');
        expect(customOpt.hidden).toBe(false);
    });
});

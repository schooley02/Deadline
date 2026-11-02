/**
 * @jest-environment jsdom
 *
 * TimerView goal-reached popup (Habit Goals Build 2, 2026-11-01): nothing auto-completes; the
 * player picks Mark done / Keep going / Pause / Started by mistake.
 */
global.Modal = require('../js/ui/modal.js');
const TimerView = require('../js/ui/timerView.js');

const item = { id: 'h1', name: 'Meditate <b>' };
function handlers() {
    return { onMarkDone: jest.fn(), onKeepGoing: jest.fn(), onPause: jest.fn(), onMistake: jest.fn() };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('TimerView.formatMinutes', () => {
    test('minutes under an hour, hours and minutes after', () => {
        expect(TimerView.formatMinutes(30)).toBe('30 min');
        expect(TimerView.formatMinutes(59.9)).toBe('59 min');
        expect(TimerView.formatMinutes(60)).toBe('1 hr');
        expect(TimerView.formatMinutes(125)).toBe('2 hr 5 min');
        expect(TimerView.formatMinutes(-3)).toBe('0 min');
    });
});

describe('TimerView.showGoalReached', () => {
    test('says what was logged against the goal, with the item name escaped', () => {
        TimerView.showGoalReached(item, { goalMinutes: 30, loggedMinutes: 30 }, handlers());
        const o = document.getElementById('goalReachedOverlay');
        expect(o.querySelector('h3').textContent).toContain('Meditate <b>');
        expect(o.querySelector('h3 b')).toBeNull();
        expect(o.querySelector('p').textContent).toBe('30 min logged — your goal.');
    });

    test('every button explains what it does when tapped', () => {
        TimerView.showGoalReached(item, { goalMinutes: 30, loggedMinutes: 30 }, handlers());
        const desc = id => document.querySelector('#' + id + ' .goal-opt-desc').textContent;
        expect(desc('goalMarkDone')).toBe('Completes it and stops the timer.');
        expect(desc('goalKeepGoing')).toContain('keeps running');
        expect(desc('goalPause')).toContain('keeps the time logged');
        expect(desc('goalPause')).toContain('resume');
        expect(desc('goalMistake')).toContain('throws away');
        expect(document.querySelector('#goalMistake .goal-opt-label').textContent).toBe('Started by mistake');
    });

    test('Mark done says open sub-tasks keep a task from completing', () => {
        TimerView.showGoalReached(item, { goalMinutes: 30, loggedMinutes: 30, hasOpenSubTasks: true }, handlers());
        expect(document.querySelector('#goalMarkDone .goal-opt-desc').textContent).toContain('sub-tasks');
    });

    test('past the goal (app was closed) names both numbers', () => {
        TimerView.showGoalReached(item, { goalMinutes: 30, loggedMinutes: 95 }, handlers());
        expect(document.querySelector('#goalReachedOverlay p').textContent)
            .toBe('1 hr 35 min logged — your goal was 30 min.');
    });

    test.each([
        ['goalMarkDone', 'onMarkDone'],
        ['goalKeepGoing', 'onKeepGoing'],
        ['goalPause', 'onPause'],
        ['goalMistake', 'onMistake'],
    ])('%s closes the popup and calls only %s', (id, fn) => {
        const h = handlers();
        TimerView.showGoalReached(item, { goalMinutes: 30, loggedMinutes: 30 }, h);
        document.getElementById(id).click();
        expect(document.getElementById('goalReachedOverlay')).toBeNull();
        Object.keys(h).forEach(k => expect(h[k]).toHaveBeenCalledTimes(k === fn ? 1 : 0));
    });

    test('never opens a second popup on top of one already showing', () => {
        const h = handlers();
        TimerView.showGoalReached(item, { goalMinutes: 30, loggedMinutes: 30 }, h);
        expect(TimerView.showGoalReached(item, { goalMinutes: 30, loggedMinutes: 31 }, h)).toBeNull();
        expect(document.querySelectorAll('#goalReachedOverlay')).toHaveLength(1);
    });
});

describe('TimerView.showLoggedTimeEditor (Habit Goals Build 2c)', () => {
    beforeEach(() => { global.Forms = require('../js/ui/forms.js'); });
    afterEach(() => { delete global.Forms; });
    const mins = (m) => m * 60000;

    test('asks how much time was really spent, prefilled with the given value, naming the logged total', () => {
        TimerView.showLoggedTimeEditor(item, { loggedMinutes: 95, prefillMs: mins(60) }, {});
        const o = document.getElementById('loggedTimeOverlay');
        expect(o.querySelector('p').textContent).toContain('1 hr 35 min');
        expect(o.querySelector('p').textContent).toContain('actually spend');
        expect(document.getElementById('editorLoggedHours').value).toBe('1');
        expect(document.getElementById('editorLoggedMinutes').value).toBe('0');
        expect(document.getElementById('loggedTimeSkip').textContent).toBe('Keep 1 hr 35 min logged');
    });

    test('Save time hands back the typed milliseconds (even if unchanged from the prefill) and closes', () => {
        const h = { onSave: jest.fn(), onSkip: jest.fn() };
        TimerView.showLoggedTimeEditor(item, { loggedMinutes: 95, prefillMs: mins(60) }, h);
        document.getElementById('editorLoggedMinutes').value = '20';
        document.getElementById('loggedTimeSave').click();
        expect(h.onSave).toHaveBeenCalledWith(mins(80));
        expect(h.onSkip).not.toHaveBeenCalled();
        expect(document.getElementById('loggedTimeOverlay')).toBeNull();
    });

    test('an invalid entry shows the error and keeps the prompt open', () => {
        const h = { onSave: jest.fn() };
        TimerView.showLoggedTimeEditor(item, { loggedMinutes: 10, prefillMs: mins(10) }, h);
        document.getElementById('editorLoggedMinutes').value = '75';
        document.getElementById('loggedTimeSave').click();
        expect(h.onSave).not.toHaveBeenCalled();
        expect(document.getElementById('editorLoggedError').textContent).toMatch(/0 to 59/);
        expect(document.getElementById('loggedTimeOverlay')).not.toBeNull();
    });

    test('Keep ... logged leaves the timer total alone', () => {
        const h = { onSave: jest.fn(), onSkip: jest.fn() };
        TimerView.showLoggedTimeEditor(item, { loggedMinutes: 95, prefillMs: mins(60) }, h);
        document.getElementById('loggedTimeSkip').click();
        expect(h.onSkip).toHaveBeenCalled();
        expect(h.onSave).not.toHaveBeenCalled();
    });

    test('never opens two at once; the item name is escaped', () => {
        TimerView.showLoggedTimeEditor(item, { loggedMinutes: 5, prefillMs: 0 }, {});
        expect(TimerView.showLoggedTimeEditor(item, { loggedMinutes: 5, prefillMs: 0 }, {})).toBeNull();
        expect(document.querySelectorAll('#loggedTimeOverlay')).toHaveLength(1);
        expect(document.querySelector('#loggedTimeOverlay h3 b')).toBeNull();
    });
});

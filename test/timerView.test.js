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

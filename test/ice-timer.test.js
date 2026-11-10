/**
 * Ice x Timer (docs/ICE_PLAN.md): pausing an iced zombie keeps the ice for the grace; stop / resume / discard / end-paused end it;
 * and the one-timer-at-a-time rule (Jeremy, 2026-11-10: "make sure you can only start a timer on one task/habit at a time") now
 * lives in Timer.startExclusive, so it is tested (it used to be only an inline step in script.js toggleWorkTimer).
 */
const Timer = require('../js/timer.js');
const Ice = require('../js/ice.js');
const MIN = 60000;
const GRACE = 5 * MIN;

const task = (o) => Object.assign({ id: 1, type: 'task', isOverdue: true, timer: null, timerPaused: false, timerMsBanked: 0 }, o);

describe('pause grace through Timer', () => {
    test('pausing an iced zombie at the base leaves it iced for ICE_GRACE_MS', () => {
        const t = task();
        Timer.start(t, 0);
        expect(Ice.state(t, 1000).iced).toBe(true);
        Timer.pause(t, 10 * MIN);
        expect(t.timerPaused).toBe(true);
        expect(t.icePausedAt).toBe(10 * MIN);
        expect(Ice.state(t, 10 * MIN + MIN)).toMatchObject({ iced: true, thawing: true });
        expect(Ice.state(t, 10 * MIN + GRACE).iced).toBe(false);
    });
    test('pausing a zombie that is still walking gives no grace', () => {
        const t = task({ isOverdue: false });
        Timer.start(t, 0);
        Timer.pause(t, MIN);
        expect(t.icePausedAt == null).toBe(true);
        expect(Ice.state(t, MIN + 1).iced).toBe(false);
    });
    test('resume (start) within the grace clears it and the running timer ices again', () => {
        const t = task();
        Timer.start(t, 0);
        Timer.pause(t, MIN);
        Timer.start(t, 2 * MIN);
        expect(t.icePausedAt == null).toBe(true);
        expect(Ice.state(t, 2 * MIN + 1).iced).toBe(true);
    });
    test('Stop thaws at once: a stop is not a pause', () => {
        const t = task();
        Timer.start(t, 0);
        Timer.stop(t, MIN);
        expect(t.icePausedAt == null).toBe(true);
        expect(Ice.state(t, MIN + 1).iced).toBe(false);
    });
    test('Stop on a PAUSED timer (endPaused) ends the grace', () => {
        const t = task();
        Timer.start(t, 0);
        Timer.pause(t, MIN);
        expect(Timer.endPaused(t)).toBe(true);
        expect(Ice.state(t, MIN + 1000).iced).toBe(false);
    });
    test('discarding the running span ("started by mistake") leaves no grace', () => {
        const t = task();
        Timer.start(t, 0);
        Timer.discardSession(t, MIN);
        expect(Ice.state(t, MIN + 1).iced).toBe(false);
    });
    test('the auto-stop is a stop: no grace', () => {
        const t = task();
        Timer.start(t, 0);
        Timer.autoStop(t, 70 * MIN);
        expect(Ice.state(t, 70 * MIN + 1).iced).toBe(false);
    });
    test('editing the logged time to 0 (nothing left to resume) clears timerPaused, which ends the grace', () => {
        const t = task();
        Timer.start(t, 0);
        Timer.pause(t, MIN);
        t.timerPaused = false; // what Items.setLoggedTime does when the banked time reaches 0
        expect(Ice.state(t, MIN + 1000).iced).toBe(false);
    });
});

describe('one timer at a time: Timer.startExclusive', () => {
    test('starting B stops a running A (A\'s time is kept) and only B runs', () => {
        const a = task({ id: 1 }); const b = task({ id: 2 });
        Timer.start(a, 0);
        expect(Timer.startExclusive([a, b], b, 10 * MIN)).toBe(true);
        expect(Timer.isRunning(a)).toBe(false);
        expect(Timer.isRunning(b)).toBe(true);
        expect(a.timerMsBanked).toBe(10 * MIN);
        expect([a, b].filter(Timer.isRunning).length).toBe(1);
    });
    test('works across tasks and Build habits with a Time goal', () => {
        const a = task({ id: 1 });
        const h = { id: 2, type: 'habit', isNegative: false, goal: { type: 'time', amount: 30 }, timer: null, timerMsBanked: 0 };
        Timer.start(a, 0);
        Timer.startExclusive([a, h], h, MIN);
        expect([a, h].filter(Timer.isRunning)).toEqual([h]);
    });
    test('a Break Habit limit timer is also one-at-a-time with a work timer', () => {
        const a = task({ id: 1 });
        const lim = { id: 2, type: 'habit', isNegative: true, timerMinutes: 20, timer: null, timerMsBanked: 0 };
        Timer.start(a, 0);
        expect(Timer.startExclusive([a, lim], lim, MIN)).toBe(true);
        expect([a, lim].filter(Timer.isRunning)).toEqual([lim]);
    });
    test('an item that cannot be timed changes nothing: A keeps running', () => {
        const a = task({ id: 1 }); const ghost = task({ id: 2, koGhost: true });
        Timer.start(a, 0);
        expect(Timer.startExclusive([a, ghost], ghost, MIN)).toBe(false);
        expect(Timer.isRunning(a)).toBe(true);
    });
    test('starting the item that already runs is a no-op', () => {
        const a = task();
        Timer.start(a, 0);
        expect(Timer.startExclusive([a], a, MIN)).toBe(false);
        expect(a.timer.startedAt).toBe(0);
    });
    test('A paused in its grace thaws the moment a timer starts on B: never two iced at once', () => {
        const a = task({ id: 1 }); const b = task({ id: 2 });
        Timer.start(a, 0);
        Timer.pause(a, MIN);
        expect(Ice.state(a, MIN + 1000).iced).toBe(true);
        Timer.startExclusive([a, b], b, MIN + 2000);
        expect(Ice.state(a, MIN + 3000).iced).toBe(false);
        expect(Ice.state(b, MIN + 3000).iced).toBe(true);
        expect([a, b].filter(i => Ice.state(i, MIN + 3000).iced).length).toBe(1);
    });
    test('A running while B starts: A stops (no grace, a stop is not a pause) and thaws', () => {
        const a = task({ id: 1 }); const b = task({ id: 2 });
        Timer.start(a, 0);
        Timer.startExclusive([a, b], b, MIN);
        expect(Ice.state(a, MIN + 1).iced).toBe(false);
    });
});

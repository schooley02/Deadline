const Timer = require('../js/timer.js');
const MIN = 60000;

const task = (o) => Object.assign({ type: 'task', timer: null, timerMsBanked: 0 }, o);

describe('Timer eligibility', () => {
    test('tasks and positive habits yes; negative habits and ghosts no', () => {
        expect(Timer.canWorkTimer(task())).toBe(true);
        expect(Timer.canWorkTimer({ type: 'habit', isNegative: false })).toBe(true);
        expect(Timer.canWorkTimer({ type: 'habit', isNegative: true })).toBe(false);
        expect(Timer.canWorkTimer(task({ koGhost: true }))).toBe(false);
    });
});

describe('start / stop / elapsed', () => {
    test('start sets timestamps; second start is a no-op', () => {
        const t = task();
        expect(Timer.start(t, 1000)).toBe(true);
        expect(Timer.isRunning(t)).toBe(true);
        expect(Timer.start(t, 5000)).toBe(false);
        expect(t.timer.startedAt).toBe(1000);
    });
    test('elapsed = banked + live; stop banks and clears', () => {
        const t = task({ timerMsBanked: 5 * MIN });
        Timer.start(t, 0);
        expect(Timer.elapsedMs(t, 10 * MIN)).toBe(15 * MIN);
        expect(Timer.stop(t, 10 * MIN)).toBe(10 * MIN);
        expect(t.timer).toBeNull();
        expect(t.timerMsBanked).toBe(15 * MIN);
        expect(Timer.elapsedMs(t, 99 * MIN)).toBe(15 * MIN);
    });
    test('ineligible items never start', () => {
        const t = task({ koGhost: true });
        expect(Timer.start(t, 0)).toBe(false);
    });
    test('findRunning', () => {
        const a = task(), b = task();
        Timer.start(b, 0);
        expect(Timer.findRunning([a, b])).toBe(b);
        expect(Timer.findRunning([a])).toBeNull();
    });
});

describe('pendingAction', () => {
    test('nothing until 60 min, then prompt', () => {
        const t = task(); Timer.start(t, 0);
        expect(Timer.pendingAction(t, 59 * MIN)).toBeNull();
        expect(Timer.pendingAction(t, 60 * MIN)).toBe('prompt');
    });
    test('unanswered prompt autostops after 10 min and banks only up to the prompt', () => {
        const t = task(); Timer.start(t, 0);
        Timer.markPrompted(t, 60 * MIN);
        expect(Timer.pendingAction(t, 69 * MIN)).toBeNull();
        expect(Timer.pendingAction(t, 70 * MIN)).toBe('autostop');
        Timer.autoStop(t, 70 * MIN);
        expect(t.timerMsBanked).toBe(60 * MIN);
        expect(t.timer).toBeNull();
    });
    test('confirming restarts the 60 min window', () => {
        const t = task(); Timer.start(t, 0);
        Timer.markPrompted(t, 60 * MIN);
        Timer.confirmStillWorking(t, 62 * MIN);
        expect(Timer.pendingAction(t, 121 * MIN)).toBeNull();
        expect(Timer.pendingAction(t, 122 * MIN)).toBe('prompt');
        expect(Timer.elapsedMs(t, 122 * MIN)).toBe(122 * MIN);
    });
    test('target reached wins and counts banked time', () => {
        const t = task({ timerMinutes: 30, timerMsBanked: 20 * MIN }); Timer.start(t, 0);
        expect(Timer.pendingAction(t, 9 * MIN)).toBeNull();
        expect(Timer.pendingAction(t, 10 * MIN)).toBe('target');
    });
    test('not running -> null', () => {
        expect(Timer.pendingAction(task(), 1e9)).toBeNull();
    });
});

describe('promptDueAt', () => {
    test('prompt stamped at its due time banks only up to then (app was closed)', () => {
        const t = task(); Timer.start(t, 0);
        expect(Timer.promptDueAt(t)).toBe(60 * MIN);
        Timer.markPrompted(t, Timer.promptDueAt(t));
        expect(Timer.pendingAction(t, 300 * MIN)).toBe('autostop');
        Timer.autoStop(t, 300 * MIN);
        expect(t.timerMsBanked).toBe(60 * MIN);
    });
});

describe('damageIntervalMs', () => {
    test('unchanged when idle, doubled while running (factor 0.5)', () => {
        const t = task();
        expect(Timer.damageIntervalMs(t, 300000)).toBe(300000);
        Timer.start(t, 0);
        expect(Timer.damageIntervalMs(t, 300000)).toBe(600000);
    });
    test('a factor of 0 or 1+ never zeroes/changes damage', () => {
        const t = task(); Timer.start(t, 0);
        expect(Timer.damageIntervalMs(t, 300000, { WORK_TIMER_DAMAGE_FACTOR: 0 })).toBe(300000);
        expect(Timer.damageIntervalMs(t, 300000, { WORK_TIMER_DAMAGE_FACTOR: 1 })).toBe(300000);
    });
});

describe('formatElapsed', () => {
    test('formats', () => {
        expect(Timer.formatElapsed(5000)).toBe('0:05');
        expect(Timer.formatElapsed(65 * 1000)).toBe('1:05');
        expect(Timer.formatElapsed(3725 * 1000)).toBe('1:02:05');
    });
});

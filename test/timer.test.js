const Timer = require('../js/timer.js');
const MIN = 60000;

const task = (o) => Object.assign({ type: 'task', timer: null, timerMsBanked: 0 }, o);

describe('Timer eligibility', () => {
    test('tasks and positive habits yes; negative habits and ghosts no', () => {
        expect(Timer.canWorkTimer(task())).toBe(true);
        // Habit Goals (2026-11-01): a Build habit gets the stopwatch only with a Time goal.
        expect(Timer.canWorkTimer({ type: 'habit', isNegative: false, goal: { type: 'time', amount: 30 } })).toBe(true);
        expect(Timer.canWorkTimer({ type: 'habit', isNegative: false })).toBe(false);
        expect(Timer.canWorkTimer({ type: 'habit', isNegative: false, goal: { type: 'amount', amount: 8, unit: 'glasses' } })).toBe(false);
        expect(Timer.canWorkTimer({ type: 'habit', isNegative: false, timerMinutes: 20 })).toBe(true); // pre-goal save
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
    test('goal reached wins and counts banked time', () => {
        const t = task({ timerMinutes: 30, timerMsBanked: 20 * MIN }); Timer.start(t, 0);
        expect(Timer.pendingAction(t, 9 * MIN)).toBeNull();
        expect(Timer.pendingAction(t, 10 * MIN)).toBe('goal-reached');
    });
    test('goal popup is one-shot per answer: Keep going / Stop-not-done set goalAcked', () => {
        const t = task({ timerMinutes: 30 }); Timer.start(t, 0);
        expect(Timer.pendingAction(t, 30 * MIN)).toBe('goal-reached');
        Timer.acknowledgeGoal(t);
        expect(Timer.pendingAction(t, 31 * MIN)).toBeNull();
        expect(Timer.pendingAction(t, 60 * MIN)).toBe('prompt'); // normal hourly check resumes
        // a later start on the same item does not re-ask while the goal is acknowledged
        Timer.stop(t, 61 * MIN);
        Timer.start(t, 62 * MIN);
        expect(Timer.pendingAction(t, 63 * MIN)).toBeNull();
    });
    test('goal reached while the app was closed is still pending on the next look', () => {
        const t = task({ timerMinutes: 30 }); Timer.start(t, 0);
        expect(Timer.pendingAction(t, 8 * 60 * MIN)).toBe('goal-reached');
    });
    test('Started by mistake: drops only the running span, never banks or reports it', () => {
        const t = task({ timerMinutes: 30, timerMsBanked: 5 * MIN, goalAcked: true }); Timer.start(t, 0);
        const seen = []; Timer.onSpan((i, ms) => seen.push(ms));
        expect(Timer.discardSession(t, 40 * MIN)).toBe(40 * MIN);
        Timer.onSpan(null);
        expect(seen).toEqual([]);
        expect(t.timer).toBeNull();
        expect(t.timerMsBanked).toBe(5 * MIN);
        expect(t.goalAcked).toBe(false); // back under the goal (5 < 30): it may ask again later
        expect(Timer.discardSession(t, 41 * MIN)).toBe(0); // not running
    });
    test('discard keeps the acknowledgement when banked time alone still meets the goal', () => {
        const t = task({ timerMinutes: 30, timerMsBanked: 35 * MIN, goalAcked: true }); Timer.start(t, 0);
        Timer.discardSession(t, 5 * MIN);
        expect(t.goalAcked).toBe(true);
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

describe('limit timer (Build 4)', () => {
    const lurker = (o) => Object.assign({ type: 'habit', isNegative: true, timer: null, timerMsBanked: 0, timerMinutes: 30 }, o);

    test('eligibility: negative habit WITH a budget only', () => {
        expect(Timer.canLimitTimer(lurker())).toBe(true);
        expect(Timer.canLimitTimer(lurker({ timerMinutes: null }))).toBe(false);
        expect(Timer.canLimitTimer(lurker({ koGhost: true }))).toBe(false);
        expect(Timer.canWorkTimer(lurker())).toBe(false);
        expect(Timer.canTimer(lurker())).toBe(true);
        expect(Timer.canTimer(lurker({ timerMinutes: null }))).toBe(false);
    });
    test('start works; a limit helper never has a pending action (no limit-expired popup)', () => {
        const h = lurker();
        expect(Timer.start(h, 0)).toBe(true);
        expect(Timer.pendingAction(h, 29 * MIN)).toBeNull();
        expect(Timer.pendingAction(h, 30 * MIN)).toBeNull();
        expect(Timer.pendingAction(h, 90 * MIN)).toBeNull(); // over the limit and even closed: still nothing
    });
    test('no "Still working?" prompt for limits (budget <= 600 min can still pass 60)', () => {
        const h = lurker({ timerMinutes: 120 });
        Timer.start(h, 0);
        expect(Timer.pendingAction(h, 61 * MIN)).toBeNull();
    });
    test('counts UP across sessions: logged minutes and the "18 / 60 min" readout', () => {
        const h = lurker({ timerMinutes: 60 });
        Timer.start(h, 0);
        Timer.stop(h, 10 * MIN);
        Timer.start(h, 100 * MIN);
        expect(Timer.loggedMinutes(h, 108 * MIN)).toBe(18);
        expect(Timer.limitReadout(h, 108 * MIN)).toBe('18 / 60 min');
        expect(Timer.isOverLimit(h, 108 * MIN)).toBe(false);
    });
    test('over the limit once logged time passes it (exactly at the limit is not over)', () => {
        const h = lurker({ timerMinutes: 30 });
        Timer.start(h, 0);
        expect(Timer.isOverLimit(h, 30 * MIN)).toBe(false);
        expect(Timer.isOverLimit(h, 30 * MIN + 1000)).toBe(true);
        expect(Timer.isOverLimit(lurker({ timerMinutes: 30 }), 1e12)).toBe(false); // not a start: nothing logged
    });
    test('Stop only banks the time (the caller does not complete the habit)', () => {
        const h = lurker();
        Timer.start(h, 0);
        expect(Timer.stop(h, 12 * MIN)).toBe(12 * MIN);
        expect(h.timerMsBanked).toBe(12 * MIN);
        expect(h.timer).toBeNull();
    });
    test('labels', () => {
        const h = lurker();
        expect(Timer.buttonLabel(h, 0)).toBe('\u23F1');
        expect(Timer.popupLabel(h)).toBe('\u23F1 Start timer');
        Timer.start(h, 0);
        expect(Timer.buttonLabel(h, 5 * MIN)).toBe('\u23F9 5 / 30 min');
        expect(Timer.popupLabel(h)).toBe('\u23F9 Stop timer');
    });
});

describe('definition target helpers', () => {
    test('normalizeTarget / modeFor', () => {
        expect(Timer.normalizeTarget('30')).toBe(30);
        expect(Timer.normalizeTarget('')).toBeNull();
        expect(Timer.normalizeTarget('0')).toBeNull();
        expect(Timer.normalizeTarget('601')).toBeNull();
        expect(Timer.normalizeTarget('12.7')).toBe(12);
        expect(Timer.modeFor(true, 30)).toBe('limit');
        expect(Timer.modeFor(false, 30)).toBe('work');
        expect(Timer.modeFor(true, null)).toBeNull();
    });
});

describe('attacking nudge + stopwatch icon (2026-10-31)', () => {
    test('shouldNudge: overdue work item with no timer running', () => {
        expect(Timer.shouldNudge(task({ isOverdue: true }))).toBe(true);
        expect(Timer.shouldNudge({ type: 'habit', isNegative: false, goal: { type: 'time', amount: 30 }, isOverdue: true })).toBe(true);
        expect(Timer.shouldNudge({ type: 'habit', isNegative: false, isOverdue: true })).toBe(false); // no Time goal, no stopwatch
    });
    test('shouldNudge: not when on time, already running, a KO ghost, or a break-habit', () => {
        expect(Timer.shouldNudge(task({ isOverdue: false }))).toBe(false);
        expect(Timer.shouldNudge(task())).toBe(false);
        const running = task({ isOverdue: true });
        Timer.start(running, 0);
        expect(Timer.shouldNudge(running)).toBe(false);
        expect(Timer.shouldNudge(task({ isOverdue: true, koGhost: true }))).toBe(false);
        expect(Timer.shouldNudge({ type: 'habit', isNegative: true, timerMinutes: 30, isOverdue: true, timer: null })).toBe(false);
        expect(Timer.shouldNudge(null)).toBe(false);
    });
    test('stopping the timer on a still-overdue item brings the nudge back', () => {
        const t = task({ isOverdue: true });
        Timer.start(t, 0);
        Timer.stop(t, MIN);
        expect(Timer.shouldNudge(t)).toBe(true);
    });
    test('work buttons use the SVG stopwatch; running adds the elapsed time', () => {
        const t = task();
        expect(Timer.buttonHtml(t, 0)).toBe(Timer.ICON_SVG);
        expect(Timer.ICON_SVG).toContain('<svg');
        expect(Timer.popupHtml(t)).toContain('Start timer');
        Timer.start(t, 0);
        expect(Timer.buttonHtml(t, 5 * MIN)).toContain('5:00');
        expect(Timer.buttonHtml(t, 5 * MIN)).toContain('<svg');
        expect(Timer.popupHtml(t)).toContain('Stop timer');
    });
    test('limit helper row button: icon alone until time is logged, then "N / M min", red once over', () => {
        const h = { type: 'habit', isNegative: true, timerMinutes: 30, timer: null, timerMsBanked: 0 };
        expect(Timer.buttonHtml(h, 0)).toBe(Timer.ICON_SVG);
        Timer.start(h, 0);
        expect(Timer.buttonHtml(h, 5 * MIN)).toContain('5 / 30 min');
        expect(Timer.buttonHtml(h, 5 * MIN)).not.toContain(' over');
        expect(Timer.buttonHtml(h, 31 * MIN)).toContain('timer-elapsed over');
        Timer.stop(h, 31 * MIN);
        expect(Timer.buttonHtml(h, 40 * MIN)).toContain('31 / 30 min'); // stays visible after Stop
        expect(Timer.popupHtml(h, 40 * MIN)).toContain('Start timer');
        expect(Timer.popupHtml(h, 40 * MIN)).toContain('31 / 30 min');
    });
});

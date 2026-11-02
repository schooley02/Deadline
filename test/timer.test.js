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
    test('start works; a running limit timer asks "limit-passed" once over the limit, never before, never after an answer', () => {
        const h = lurker();
        expect(Timer.start(h, 0)).toBe(true);
        expect(Timer.pendingAction(h, 29 * MIN)).toBeNull();
        expect(Timer.pendingAction(h, 30 * MIN)).toBeNull(); // exactly at the limit is not over
        expect(Timer.pendingAction(h, 31 * MIN)).toBe('limit-passed');
        Timer.acknowledgeGoal(h); // Keep going
        expect(Timer.pendingAction(h, 90 * MIN)).toBeNull();
    });
    test('limit-passed needs a RUNNING timer: time banked over the limit and stopped never opens it', () => {
        const h = lurker({ timerMsBanked: 45 * MIN });
        expect(Timer.pendingAction(h, 60 * MIN)).toBeNull();
    });
    test('Started by mistake under the limit re-arms the popup (goalAcked cleared)', () => {
        const h = lurker();
        Timer.start(h, 0);
        Timer.acknowledgeGoal(h);
        Timer.discardSession(h, 40 * MIN);
        expect(h.goalAcked).toBe(false);
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
        expect(Timer.limitReadout(h, 108 * MIN)).toBe('18:00 / 60 min');
        expect(Timer.limitReadout(h, 108 * MIN + 20000)).toBe('18:20 / 60 min'); // ticks each second
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
        expect(Timer.buttonLabel(h, 5 * MIN)).toBe('\u23F9 5:00 / 30 min');
        expect(Timer.popupLabel(h)).toBe('\u23F8 Pause timer');
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
        expect(Timer.popupHtml(t)).toContain('Pause timer');
    });
    test('pause / resume (2026-11-01): Pause holds the timer, the same button resumes it', () => {
        const t = task();
        expect(Timer.isPaused(t)).toBe(false);
        expect(Timer.buttonTitle(t)).toBe('Start timer');
        Timer.start(t, 0);
        expect(Timer.buttonTitle(t)).toBe('Pause timer');
        expect(Timer.isPaused(t)).toBe(false); // running is not paused
        expect(Timer.pause(t, 12 * MIN)).toBe(12 * MIN);
        expect(t.timerMsBanked).toBe(12 * MIN);
        expect(Timer.isPaused(t)).toBe(true);
        expect(Timer.buttonTitle(t)).toBe('Resume timer');
        expect(Timer.popupLabel(t)).toBe('\u25B6 Resume timer');
        expect(Timer.popupHtml(t)).toContain('Resume timer');
        // a paused button shows the held time, dimmed
        expect(Timer.buttonHtml(t, 20 * MIN)).toContain('timer-elapsed paused');
        expect(Timer.buttonHtml(t, 20 * MIN)).toContain('12:00');
        // resuming keeps logging on top of the banked time and clears the paused flag
        expect(Timer.start(t, 30 * MIN)).toBe(true);
        expect(t.timerPaused).toBe(false);
        expect(Timer.elapsedMs(t, 35 * MIN)).toBe(17 * MIN);
        expect(Timer.buttonHtml(t, 35 * MIN)).not.toContain('paused');
    });
    test('Stop ends the session but keeps the time: back to Start, with the logged total still shown', () => {
        const t = task();
        Timer.start(t, 0);
        expect(Timer.stop(t, 12 * MIN)).toBe(12 * MIN);
        expect(t.timerMsBanked).toBe(12 * MIN); // nothing lost
        expect(Timer.isPaused(t)).toBe(false);
        expect(Timer.buttonTitle(t)).toBe('Start timer');
        expect(Timer.buttonHtml(t, 20 * MIN)).toContain('12:00'); // the logged total stays visible after Stop (Build 2b)
        expect(Timer.buttonHtml(t, 20 * MIN)).toContain('timer-elapsed stopped');
        expect(Timer.popupHtml(t)).toContain('12:00');
        // Start again after a Stop still adds to the logged time
        Timer.start(t, 30 * MIN);
        expect(Timer.elapsedMs(t, 35 * MIN)).toBe(17 * MIN);
    });
    test('Stop after Pause (via a fresh run) ends it; auto-stop and discard are ended sessions, not pauses', () => {
        const a = task(); Timer.start(a, 0); Timer.pause(a, MIN);
        expect(Timer.isPaused(a)).toBe(true);
        Timer.start(a, 2 * MIN); Timer.stop(a, 3 * MIN);
        expect(Timer.isPaused(a)).toBe(false);
        const b = task({ timerMinutes: 30 }); Timer.start(b, 0); Timer.markPrompted(b, 60 * MIN); Timer.autoStop(b, 70 * MIN);
        expect(Timer.isPaused(b)).toBe(false);
        const c = task({ timerMsBanked: 5 * MIN }); Timer.start(c, 0); Timer.discardSession(c, MIN);
        expect(Timer.isPaused(c)).toBe(false);
    });
    test('control icons: Pause while running, Play while paused, Stop while running or paused (2026-11-01)', () => {
        const t = task();
        expect(Timer.controlState(t)).toEqual({ pause: false, play: false, stop: false });
        Timer.start(t, 0);
        expect(Timer.controlState(t)).toEqual({ pause: true, play: false, stop: true });
        Timer.pause(t, MIN);
        expect(Timer.controlState(t)).toEqual({ pause: false, play: true, stop: true });
        Timer.start(t, 2 * MIN); Timer.stop(t, 3 * MIN);
        expect(Timer.controlState(t)).toEqual({ pause: false, play: false, stop: false });
    });
    test('a paused popup button leads with the Play glyph and Resume wording; the Stop button stays shown', () => {
        expect(Timer.PLAY_ICON_SVG).toContain('<svg');
        const t = task();
        Timer.start(t, 0); Timer.pause(t, MIN);
        const html = Timer.popupHtml(t);
        expect(html).toContain(Timer.PLAY_ICON_SVG);
        expect(html).not.toContain(Timer.ICON_SVG);
        expect(html).toContain('Resume timer');
        expect(Timer.stopButtonHtml(t, 'x')).not.toContain(' hidden');
    });
    test('Stop while paused ends the session without touching the banked time', () => {
        const t = task();
        Timer.start(t, 0); Timer.pause(t, 5 * MIN);
        expect(Timer.endPaused(t)).toBe(true);
        expect(t.timerMsBanked).toBe(5 * MIN);
        expect(Timer.isPaused(t)).toBe(false);
        expect(Timer.buttonTitle(t)).toBe('Start timer');
        expect(Timer.controlState(t)).toEqual({ pause: false, play: false, stop: false });
        expect(Timer.endPaused(t)).toBe(false); // nothing paused any more
        expect(Timer.endPaused(task())).toBe(false);
    });
    test('pause on an idle timer does nothing', () => {
        const t = task();
        expect(Timer.pause(t, 5 * MIN)).toBe(0);
        expect(Timer.isPaused(t)).toBe(false);
    });
    test('control glyphs and the popup Stop button (hidden until running)', () => {
        expect(Timer.PAUSE_ICON_SVG).toContain('<svg');
        expect(Timer.STOP_ICON_SVG).toContain('<svg');
        const t = task();
        expect(Timer.stopButtonHtml(t, 'x')).toContain(' hidden');
        Timer.start(t, 0);
        const html = Timer.stopButtonHtml(t, 'workTimerStopBtn');
        expect(html).not.toContain(' hidden');
        expect(html).toContain('id="workTimerStopBtn"');
        expect(html).toContain('aria-label="Stop timer"');
    });
    test('stopButtonHtml carries over-limit only once a Break limit is passed', () => {
        const under = { type: 'habit', isNegative: true, timerMinutes: 30, timer: null, timerMsBanked: 5 * MIN, timerPaused: true };
        const over = { ...under, timerMsBanked: 31 * MIN };
        expect(Timer.stopButtonHtml(under, 'x')).not.toContain('over-limit');
        expect(Timer.stopButtonHtml(over, 'x')).toContain('over-limit');
        expect(Timer.isOverLimit({ type: 'task', timerMinutes: 1, timerMsBanked: 5 * MIN }, 0)).toBe(false); // work timers never go "over"
    });

    test('limit helper row button: icon alone until time is logged, then the time logged (limit sits in the caption), red once over', () => {
        const h = { type: 'habit', isNegative: true, timerMinutes: 30, timer: null, timerMsBanked: 0 };
        expect(Timer.buttonHtml(h, 0)).toBe(Timer.ICON_SVG);
        Timer.start(h, 0);
        expect(Timer.buttonHtml(h, 5 * MIN + 7000)).toContain('5:07');
        expect(Timer.buttonHtml(h, 5 * MIN + 7000)).not.toContain('30 min');
        expect(Timer.buttonHtml(h, 5 * MIN)).not.toContain(' over');
        expect(Timer.buttonHtml(h, 31 * MIN)).toContain('timer-elapsed over');
        Timer.stop(h, 31 * MIN);
        expect(Timer.buttonHtml(h, 40 * MIN)).toContain('31:00'); // stays visible after Stop
        expect(Timer.popupHtml(h, 40 * MIN)).toContain('Start timer'); // Stop ended the session
        expect(Timer.popupHtml(h, 40 * MIN)).toContain('31:00');
        Timer.start(h, 50 * MIN); Timer.pause(h, 51 * MIN);
        expect(Timer.popupHtml(h, 60 * MIN)).toContain('Resume timer'); // Pause holds it
        expect(Timer.popupHtml(h, 60 * MIN)).toContain('32:00');
    });

    test('limit caption: always shown under the timer, "Limit: N min", red once over', () => {
        const h = { type: 'habit', isNegative: true, timerMinutes: 30, timer: null, timerMsBanked: 0 };
        expect(Timer.limitCaptionHtml(h, 0)).toContain('Limit: 30 min');
        expect(Timer.limitCaptionHtml(h, 0)).not.toContain(' over');
        expect(Timer.limitText({ timerMinutes: 60 })).toBe('Limit: 1 hr');
        expect(Timer.limitText({ timerMinutes: 90 })).toBe('Limit: 1 hr 30 min');
        h.timerMsBanked = 31 * MIN;
        expect(Timer.limitCaptionHtml(h, 0, 'cap')).toContain('timer-limit-caption over');
        expect(Timer.limitCaptionHtml(h, 0, 'cap')).toContain('id="cap"');
    });
});

describe('logged time text (Build 2b)', () => {
    test('loggedText: empty when nothing logged, minutes, hours', () => {
        expect(Timer.loggedText({ timerMsBanked: 0 })).toBe('');
        expect(Timer.loggedText({})).toBe('');
        expect(Timer.loggedText({ timerMsBanked: 20000 })).toBe('Logged: 1 min');
        expect(Timer.loggedText({ timerMsBanked: 45 * MIN })).toBe('Logged: 45 min');
        expect(Timer.loggedText({ timerMsBanked: 60 * MIN })).toBe('Logged: 1 hr');
        expect(Timer.loggedText({ timerMsBanked: 65 * MIN })).toBe('Logged: 1 hr 5 min');
    });
    test('a task with no time logged keeps the bare stopwatch', () => {
        expect(Timer.buttonHtml({ type: 'task', timer: null, timerMsBanked: 0 }, 0)).toBe(Timer.ICON_SVG);
    });
});

describe('setLogged (Build 2c)', () => {
    const habit = (o) => Object.assign({ type: 'habit', isNegative: true, timerMinutes: 30, timer: null, timerMsBanked: 20 * MIN }, o);

    test('sets the logged total and returns the signed change in ms', () => {
        const h = habit();
        expect(Timer.setLogged(h, 35 * MIN)).toBe(15 * MIN);
        expect(h.timerMsBanked).toBe(35 * MIN);
        expect(Timer.setLogged(h, 10 * MIN)).toBe(-25 * MIN);
        expect(h.timerMsBanked).toBe(10 * MIN);
    });

    test('works on a task that never had time, and on a completed item (no timer running)', () => {
        const t = { type: 'task', completedAt: new Date() };
        expect(Timer.setLogged(t, 45 * MIN)).toBe(45 * MIN);
        expect(t.timerMsBanked).toBe(45 * MIN);
    });

    test('refuses while the timer is running: null, nothing changes', () => {
        const h = habit({ timer: { startedAt: 1000, checkedAt: 1000, promptedAt: null } });
        expect(Timer.setLogged(h, 5 * MIN)).toBeNull();
        expect(h.timerMsBanked).toBe(20 * MIN);
    });

    test('clamps to 0..24 h and rejects non-numbers', () => {
        const h = habit();
        expect(Timer.setLogged(h, -5 * MIN)).toBe(-20 * MIN);
        expect(h.timerMsBanked).toBe(0);
        expect(Timer.setLogged(h, 99 * 60 * MIN)).toBe(24 * 60 * MIN);
        expect(h.timerMsBanked).toBe(24 * 60 * MIN);
        expect(Timer.setLogged(h, 'abc')).toBeNull();
        expect(Timer.setLogged(null, MIN)).toBeNull();
    });

    test('setting 0 clears a paused hold; it never touches goalAcked or the answer', () => {
        const h = habit({ timerPaused: true, goalAcked: true, outcome: 'indulged' });
        Timer.setLogged(h, 0);
        expect(h.timerPaused).toBe(false);
        expect(h.goalAcked).toBe(true);
        expect(h.outcome).toBe('indulged');
    });

    test('recordKind: Break habits are "limit", everything else "work"', () => {
        expect(Timer.recordKind(habit())).toBe('limit');
        expect(Timer.recordKind({ type: 'habit', isNegative: false })).toBe('work');
        expect(Timer.recordKind({ type: 'task' })).toBe('work');
    });
});

describe('Timer.nudgeNote (words behind the red pulse, 2026-11-02)', () => {
    const over = (o) => task(Object.assign({ id: 1, name: 'Write report', isOverdue: true }, o));

    test('nothing unless the item is an overdue timer item', () => {
        expect(Timer.nudgeNote(task({ id: 1, isOverdue: false }), [])).toBeNull();
        expect(Timer.nudgeNote(over({ koGhost: true }), [])).toBeNull();
        expect(Timer.nudgeNote({ type: 'habit', isNegative: true, isOverdue: true }, [])).toBeNull();
    });

    test('attacking, no timer anywhere: says to start the timer to halve the damage', () => {
        const n = Timer.nudgeNote(over(), []);
        expect(n.kind).toBe('attack');
        expect(n.text).toMatch(/Start the timer/);
        expect(n.text).toMatch(/half/);
    });

    test('this item is running: reassurance', () => {
        const t = over();
        Timer.start(t, 0);
        const n = Timer.nudgeNote(t, [t]);
        expect(n.kind).toBe('running');
        expect(n.text).toMatch(/halved/);
    });

    test('another item is running: names it and says its time is kept', () => {
        const a = over({ id: 1, name: 'Fix the roof' });
        const b = task({ id: 2, name: 'Write report', isOverdue: false });
        Timer.start(b, 0);
        const n = Timer.nudgeNote(a, [a, b]);
        expect(n.kind).toBe('switch');
        expect(n.otherName).toBe('Write report');
        expect(n.text).toContain('Your timer is running on Write report.');
        expect(n.text).toContain('Your time on Write report is kept.');
    });

    test('a paused timer on another item does not count as running', () => {
        const a = over({ id: 1 });
        const b = task({ id: 2, name: 'Other' });
        Timer.start(b, 0);
        Timer.pause(b, 1000);
        expect(Timer.nudgeNote(a, [a, b]).kind).toBe('attack');
    });
});

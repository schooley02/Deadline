/**
 * Work timer core (Build 3, 2026-10-25; docs/DESIGN_QUESTIONS_KO_EDIT_TIMER.md Q3).
 *
 * PURE: no DOM, no globals except an optional CONFIG fallback. A running timer is
 * `item.timer = { startedAt, checkedAt, promptedAt }` (all ms epoch) -- a START
 * TIMESTAMP, never counted ticks (wall-clock rule, DECISIONS 2026-07-18) -- and
 * earlier stop/starts accumulate in `item.timerMsBanked`. Both persist as plain
 * item fields (schema 14), so a reload mid-timer just keeps running.
 *
 * Only ONE timer runs at a time; that rule is enforced by the caller via
 * findRunning (starting a second stops the first).
 */
const Timer = (() => {
    const DEFAULTS = {
        WORK_TIMER_DAMAGE_FACTOR: 0.5,
        WORK_TIMER_CHECK_MS: 60 * 60 * 1000,
        WORK_TIMER_AUTO_STOP_MS: 10 * 60 * 1000,
    };
    function cfg(key, c) {
        const src = c || (typeof CONFIG !== 'undefined' ? CONFIG : DEFAULTS);
        return typeof src[key] === 'number' ? src[key] : DEFAULTS[key];
    }

    // Definition-level target (habit editors): minutes 1..600 or null. A NEGATIVE habit's
    // value is a LIMIT budget ('limit'); a positive habit's is a work goal ('work').
    function normalizeTarget(value) {
        const n = Math.floor(Number(value));
        return (isFinite(n) && n >= 1 && n <= 600) ? n : null;
    }
    function modeFor(isNegative, minutes) {
        if (normalizeTarget(minutes) === null) return null;
        return isNegative ? 'limit' : 'work';
    }

    function isRunning(item) {
        return !!(item && item.timer && typeof item.timer.startedAt === 'number');
    }

    // Work timers run on tasks (incl. sub-tasks) and POSITIVE habits. Negative
    // habits get the limit timer (Build 4); KO ghosts are inert.
    function hasTimeGoal(item) {
        if (item && item.goal && typeof item.goal === 'object') return item.goal.type === 'time';
        return !!item && typeof item.timerMinutes === 'number' && item.timerMinutes > 0; // pre-goal save
    }
    function canWorkTimer(item) {
        if (!item || item.koGhost === true) return false;
        if (item.type === 'task') return true;
        // Habit Goals (2026-11-01): a Build habit gets the stopwatch only when its goal is a Time goal.
        return item.type === 'habit' && item.isNegative !== true && hasTimeGoal(item);
    }

    // Limit timer (Habit Goals Build 2, 2026-11-01): a Break (negative) habit with a Time goal
    // (item.timerMinutes = the limit) is a count-UP "logged so far" helper across the day's sessions.
    // It never decides anything: Stop only banks the time (no Resisted), going over opens no popup,
    // and the player answers Resisted / Slipped themselves. No "Still working?" prompt, no damage change.
    function isLimit(item) {
        return !!item && item.type === 'habit' && item.isNegative === true;
    }
    function canLimitTimer(item) {
        return isLimit(item) && item.koGhost !== true && typeof item.timerMinutes === 'number' && item.timerMinutes > 0;
    }
    function canTimer(item) {
        return canWorkTimer(item) || canLimitTimer(item);
    }
    // Whole minutes logged so far (banked + the live span) and the live "18:20 / 60 min" readout.
    function loggedMinutes(item, nowMs) {
        return Math.floor(elapsedMs(item, nowMs) / 60000);
    }
    function isOverLimit(item, nowMs) {
        const budget = (item && typeof item.timerMinutes === 'number') ? item.timerMinutes * 60000 : 0;
        return isLimit(item) && budget > 0 && elapsedMs(item, nowMs) > budget;
    }
    // Live "m:ss / N min" (h:mm:ss past an hour): it ticks every second while the timer runs.
    function limitReadout(item, nowMs) {
        return `${formatElapsed(elapsedMs(item, nowMs))} / ${item.timerMinutes} min`;
    }
    // Limit helper readout span for the buttons: shown while running or once any time is banked.
    function limitReadoutHtml(item, nowMs) {
        if (!isRunning(item) && !(typeof item.timerMsBanked === 'number' && item.timerMsBanked > 0)) return '';
        return `<span class="timer-elapsed${isOverLimit(item, nowMs) ? ' over' : ''}">${limitReadout(item, nowMs)}</span>`;
    }
    // Row button text and popup button text.
    function buttonLabel(item, nowMs) {
        if (!isRunning(item)) return '\u23F1';
        return isLimit(item)
            ? `\u23F9 ${limitReadout(item, nowMs)}`
            : `\u23F9 ${formatElapsed(elapsedMs(item, nowMs))}`;
    }
    // Stopwatch icon (2026-10-31, Jeremy: coach's stopwatch like ClickUp's track-time icon). Inline SVG so it
    // takes the button's text colour; the emoji labels above stay for tests and text-only callers.
    const ICON_SVG = '<svg class="timer-icon" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" ' +
        'stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        '<path d="M10 2h4"/><path d="M12 2v3"/><path d="M19.2 6.3l1.4-1.4"/><circle cx="12" cy="14" r="8"/>' +
        '<path d="M12 14V9.5"/><circle cx="12" cy="14" r="0.6" fill="currentColor"/></svg>';
    // Pause / Stop glyphs for the controls shown beside a running timer (same drawing language as ICON_SVG).
    const PAUSE_ICON_SVG = '<svg class="timer-ctl-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" ' +
        'aria-hidden="true" focusable="false"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>';
    const STOP_ICON_SVG = '<svg class="timer-ctl-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" ' +
        'aria-hidden="true" focusable="false"><rect x="6" y="6" width="12" height="12" rx="1.6"/></svg>';
    // Row button: stopwatch alone when idle; stopwatch + elapsed while a work timer runs. A limit timer
    // shows "18 / 60 min" (turns red once over) whenever time is logged; it never reduces damage.
    function buttonHtml(item, nowMs) {
        if (isLimit(item)) return ICON_SVG + limitReadoutHtml(item, nowMs);
        // Paused: keep the logged time on the button (dimmed) so it is clear the time is held, not lost.
        if (!isRunning(item)) return isPaused(item)
            ? `${ICON_SVG}<span class="timer-elapsed paused">${formatElapsed(item.timerMsBanked)}</span>`
            : ICON_SVG;
        return `${ICON_SVG}<span class="timer-elapsed">${formatElapsed(elapsedMs(item, nowMs))}</span>`;
    }
    // Pause vs Stop (2026-11-01, Jeremy): both bank the time and lose nothing. PAUSE holds the timer
    // (`item.timerPaused = true`): the button reads Resume and keeps the logged time on it, dimmed. STOP ends the
    // session: the button goes back to Start. Start / Resume clears the flag; any other stop (completion,
    // auto-stop, "Still working?" Stop) is an ended session.
    function isPaused(item) {
        return !isRunning(item) && !!item && item.timerPaused === true
            && typeof item.timerMsBanked === 'number' && item.timerMsBanked > 0;
    }
    function buttonTitle(item) {
        return isRunning(item) ? 'Pause timer' : isPaused(item) ? 'Resume timer' : 'Start timer';
    }
    // Popup: the Stop control beside the Pause button; only visible while running.
    function stopButtonHtml(item, id) {
        return `<button type="button" id="${id}" class="timer-ctl-btn timer-ctl-stop" title="Stop timer" ` +
            `aria-label="Stop timer"${isRunning(item) ? '' : ' hidden'}>${STOP_ICON_SVG}</button>`;
    }
    // Popup button: stopwatch + the same words as buttonTitle (a limit helper adds its readout).
    function popupHtml(item, nowMs) {
        const now = nowMs === undefined ? Date.now() : nowMs;
        const readout = isLimit(item) ? limitReadoutHtml(item, now) : '';
        return `${ICON_SVG}<span>${buttonTitle(item)}</span>${readout}`;
    }
    // "A zombie is attacking and starting this timer would help" (2026-10-31): overdue, still a threat
    // (canWorkTimer rules out KO ghosts and break-habits), and no timer running on it yet. The UI pulses
    // the timer button on this. Running a timer already halves the damage (damageIntervalMs); this only
    // makes that visible.
    function shouldNudge(item) {
        return canWorkTimer(item) && !isRunning(item) && item.isOverdue === true;
    }
    const NUDGE_TITLE = 'Zombie attacking: start the timer to halve the damage';
    // "Planned work time" prompt (2026-11-01): the item has a Start time, now is inside [start, due),
    // and no timer runs on it. Only a running stopwatch proves the player is working, so the button
    // glows amber (softer than the red attack pulse) and invites a start. Clock is the optional global.
    function shouldPrompt(item, nowMs) {
        if (!canWorkTimer(item) || isRunning(item) || item.isOverdue === true) return false;
        if (typeof Clock === 'undefined' || typeof Clock.isInWorkWindow !== 'function') return false;
        return Clock.isInWorkWindow(item, nowMs === undefined ? Date.now() : nowMs);
    }
    const PROMPT_TITLE = 'Planned work time: start the timer';
    function popupLabel(item) {
        return isRunning(item) ? '\u23F8 Pause timer' : isPaused(item) ? '\u25B6 Resume timer' : '\u23F1 Start timer';
    }

    function elapsedMs(item, nowMs) {
        const banked = (item && typeof item.timerMsBanked === 'number') ? item.timerMsBanked : 0;
        const live = isRunning(item) ? Math.max(0, nowMs - item.timer.startedAt) : 0;
        return banked + live;
    }

    // Daily record seam (D2, 2026-10-27): script.js registers ONE listener at boot;
    // every stop (item completed/indulged/removed, manual stop, auto-stop) reports
    // the span it just banked, so timer minutes are counted in exactly one place.
    // Listener errors are swallowed -- a stats bug must never break a stop.
    let spanListener = null;
    function onSpan(fn) { spanListener = typeof fn === 'function' ? fn : null; }

    function start(item, nowMs) {
        if (!canTimer(item) || isRunning(item)) return false;
        item.timer = { startedAt: nowMs, checkedAt: nowMs, promptedAt: null };
        item.timerPaused = false;
        if (typeof item.timerMsBanked !== 'number') item.timerMsBanked = 0;
        return true;
    }

    // Stops and banks the running time. `bankUntilMs` (optional) caps the banked
    // span -- an auto-stop banks only up to the "Still working?" prompt.
    function stop(item, nowMs, bankUntilMs) {
        if (!isRunning(item)) return 0;
        const end = (typeof bankUntilMs === 'number') ? Math.min(nowMs, bankUntilMs) : nowMs;
        const span = Math.max(0, end - item.timer.startedAt);
        item.timerMsBanked = (typeof item.timerMsBanked === 'number' ? item.timerMsBanked : 0) + span;
        item.timer = null;
        item.timerPaused = false;
        if (span > 0 && spanListener) {
            try { spanListener(item, span); } catch (e) { /* never break a stop */ }
        }
        return span;
    }

    // Pause: bank the running time exactly like stop, then mark the item paused (resumable).
    function pause(item, nowMs) {
        if (!isRunning(item)) return 0;
        const span = stop(item, nowMs);
        item.timerPaused = true;
        return span;
    }

    function findRunning(items) {
        return (items || []).find(isRunning) || null;
    }

    // Goal popup answers. "Keep going" / "Pause" stop the popup from firing again.
    function acknowledgeGoal(item) {
        if (item) item.goalAcked = true;
    }
    // "Started by mistake": drop the RUNNING span without banking it (earlier banked sessions stay).
    // Returns the discarded ms. The daily-record span listener is never told, so it is not counted.
    // If the logged time is back under the goal the popup may fire again later.
    function discardSession(item, nowMs) {
        if (!isRunning(item)) return 0;
        const span = Math.max(0, nowMs - item.timer.startedAt);
        item.timer = null;
        item.timerPaused = false;
        if (typeof item.timerMinutes === 'number' && elapsedMs(item, nowMs) < item.timerMinutes * 60000) {
            item.goalAcked = false;
        }
        return span;
    }

    // What the game should do for a running timer right now:
    // 'goal-reached' (Time goal / old task target reached and not yet answered: the caller opens the
    // 4-button popup, nothing auto-completes) > 'autostop' (prompt unanswered) > 'prompt' (continuous
    // run reached the check interval) > null. A limit helper (Break habit) never has a pending action.
    function pendingAction(item, nowMs, c) {
        if (!isRunning(item)) return null;
        const t = item.timer;
        if (isLimit(item)) return null;
        if (typeof item.timerMinutes === 'number' && item.timerMinutes > 0 && item.goalAcked !== true
            && elapsedMs(item, nowMs) >= item.timerMinutes * 60000) return 'goal-reached';
        if (typeof t.promptedAt === 'number') {
            return nowMs - t.promptedAt >= cfg('WORK_TIMER_AUTO_STOP_MS', c) ? 'autostop' : null;
        }
        return nowMs - (typeof t.checkedAt === 'number' ? t.checkedAt : t.startedAt) >= cfg('WORK_TIMER_CHECK_MS', c)
            ? 'prompt' : null;
    }

    // When the "Still working?" prompt became DUE (checkedAt + check interval). The
    // caller stamps THIS as promptedAt, not "now": if the app was closed through the
    // whole window the prompt is already overdue and the auto-stop banks only up to
    // the moment it was due -- time while the app was shut is never credited.
    function promptDueAt(item, c) {
        if (!isRunning(item)) return null;
        const base = typeof item.timer.checkedAt === 'number' ? item.timer.checkedAt : item.timer.startedAt;
        return base + cfg('WORK_TIMER_CHECK_MS', c);
    }
    function markPrompted(item, nowMs) {
        if (isRunning(item)) item.timer.promptedAt = nowMs;
    }
    // "Yes, still working": restart the continuous-run window.
    function confirmStillWorking(item, nowMs) {
        if (!isRunning(item)) return;
        item.timer.checkedAt = nowMs;
        item.timer.promptedAt = null;
    }
    // Auto-stop banks up to the prompt time.
    function autoStop(item, nowMs) {
        if (!isRunning(item)) return 0;
        const cap = typeof item.timer.promptedAt === 'number' ? item.timer.promptedAt : nowMs;
        return stop(item, nowMs, cap);
    }

    // Overdue damage is HALVED while a timer runs (never zero). Damage is whole
    // points per tick, so the rate is halved by stretching the interval:
    // same average damage x factor, no fractional HP.
    function damageIntervalMs(item, baseIntervalMs, c) {
        if (!isRunning(item)) return baseIntervalMs;
        const f = cfg('WORK_TIMER_DAMAGE_FACTOR', c);
        return f > 0 && f < 1 ? Math.round(baseIntervalMs / f) : baseIntervalMs;
    }

    // "m:ss" under an hour, "h:mm:ss" after.
    function formatElapsed(ms) {
        const total = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const pad = n => String(n).padStart(2, '0');
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    }

    return {
        normalizeTarget, modeFor, isRunning, canWorkTimer, isLimit, canLimitTimer, canTimer,
        isPaused, buttonTitle, pause, stopButtonHtml, PAUSE_ICON_SVG, STOP_ICON_SVG, loggedMinutes, isOverLimit, limitReadout, acknowledgeGoal, discardSession, buttonLabel, popupLabel, ICON_SVG, buttonHtml, popupHtml, shouldNudge, NUDGE_TITLE, shouldPrompt, PROMPT_TITLE, elapsedMs, onSpan, start, stop, findRunning,
        pendingAction, promptDueAt, markPrompted, confirmStillWorking, autoStop,
        damageIntervalMs, formatElapsed,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Timer;
}

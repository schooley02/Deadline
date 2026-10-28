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
    function canWorkTimer(item) {
        if (!item || item.koGhost === true) return false;
        if (item.type === 'task') return true;
        return item.type === 'habit' && item.isNegative !== true;
    }

    // Limit timer (Build 4): a NEGATIVE habit with a budget (item.timerMinutes) counts DOWN.
    // Stopping inside the budget = Avoided (caller completes the item); running out opens the
    // "Time's up" arrival popup. Limit timers have no "Still working?" prompt and no damage.
    function isLimit(item) {
        return !!item && item.type === 'habit' && item.isNegative === true;
    }
    function canLimitTimer(item) {
        return isLimit(item) && item.koGhost !== true && typeof item.timerMinutes === 'number' && item.timerMinutes > 0;
    }
    function canTimer(item) {
        return canWorkTimer(item) || canLimitTimer(item);
    }
    function remainingMs(item, nowMs) {
        const budget = (item && typeof item.timerMinutes === 'number') ? item.timerMinutes * 60000 : 0;
        return Math.max(0, budget - elapsedMs(item, nowMs));
    }
    // Row button text and popup button text.
    function buttonLabel(item, nowMs) {
        if (!isRunning(item)) return '\u23F1';
        return isLimit(item)
            ? `\u23F3 ${formatElapsed(remainingMs(item, nowMs))}`
            : `\u23F9 ${formatElapsed(elapsedMs(item, nowMs))}`;
    }
    function popupLabel(item) {
        if (isLimit(item)) {
            return isRunning(item) ? '\u23F9 Stop \u2014 I stayed within my limit' : `\u23F3 Start ${item.timerMinutes}-min limit`;
        }
        return isRunning(item) ? '\u23F9 Stop timer' : '\u23F1 Start timer';
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
        if (span > 0 && spanListener) {
            try { spanListener(item, span); } catch (e) { /* never break a stop */ }
        }
        return span;
    }

    function findRunning(items) {
        return (items || []).find(isRunning) || null;
    }

    // What the game should do for a running timer right now:
    // 'target' (optional timerMinutes reached) > 'autostop' (prompt unanswered)
    // > 'prompt' (continuous run reached the check interval) > null.
    function pendingAction(item, nowMs, c) {
        if (!isRunning(item)) return null;
        const t = item.timer;
        if (isLimit(item)) return remainingMs(item, nowMs) <= 0 ? 'limit-expired' : null;
        if (typeof item.timerMinutes === 'number' && item.timerMinutes > 0
            && elapsedMs(item, nowMs) >= item.timerMinutes * 60000) return 'target';
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
        remainingMs, buttonLabel, popupLabel, elapsedMs, onSpan, start, stop, findRunning,
        pendingAction, promptDueAt, markPrompted, confirmStillWorking, autoStop,
        damageIntervalMs, formatElapsed,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Timer;
}

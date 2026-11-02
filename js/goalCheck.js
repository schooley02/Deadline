/**
 * GoalCheck -- pure helpers for Habit Goals Build 3 (2026-11-01; plan docs/HABIT_GOALS_PLAN.md Decisions 7-8, 14).
 * No DOM, no State, no globals read at call time except the optional Habits for unit lookups (passed in, never required).
 *
 *  - the EVENING CHECK time (a "HH:MM" Settings value, default 21:00) and whether it has arrived;
 *  - WHO the evening check asks about: every Break habit still unanswered today whose time has already arrived
 *    (`dueDateTime <= now`; a habit whose tempting window has not started yet keeps its own arrival prompt and the
 *    next-morning backstop, so nobody answers "Resisted" before the temptation could have happened);
 *  - the optional "How much?" value: an Amount goal stores a number on `item.goalActual`; a Time goal's How much? IS the
 *    logged time (Decision 14), so it never touches goalActual;
 *  - the daily-record goal entry ({ type, amount, unit, met, actual }) for an answered habit.
 */
const GoalCheck = (() => {
    const DEFAULT_EVENING_TIME = '21:00';
    const MAX_AMOUNT = 1000000;
    const MAX_MINUTES = 1440;

    /** "HH:MM" (24 h) -> minutes since midnight, or null when it is not a valid time. */
    function parseTimeOfDay(str) {
        if (typeof str !== 'string') return null;
        const m = /^(\d{1,2}):(\d{2})$/.exec(str.trim());
        if (!m) return null;
        const h = Number(m[1]), min = Number(m[2]);
        if (h < 0 || h > 23 || min < 0 || min > 59) return null;
        return h * 60 + min;
    }

    /** A clean "HH:MM" string, or `fallback` (default 21:00) when the input is not a valid time. */
    function normalizeEveningTime(str, fallback) {
        const min = parseTimeOfDay(str);
        if (min === null) return fallback !== undefined ? fallback : DEFAULT_EVENING_TIME;
        const h = Math.floor(min / 60), mm = min % 60;
        return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
    }

    /** True when `now` (Date or ms) is at or after the evening check time on its own calendar day. */
    function isEveningTime(now, timeStr) {
        const d = now instanceof Date ? now : new Date(now);
        const target = parseTimeOfDay(normalizeEveningTime(timeStr));
        return d.getHours() * 60 + d.getMinutes() >= target;
    }

    /**
     * The active Break-habit instances the evening check should ask about right now, in the order given.
     * Skips archived habit definitions, KO ghosts (inert while the routine is down) and anything whose time has
     * not arrived yet. An answered habit is no longer in `activeItems`, so "unanswered today" needs no extra test.
     */
    function eveningCandidates(activeItems, definedHabits, nowMs) {
        const now = typeof nowMs === 'number' ? nowMs : Date.now();
        const defs = Array.isArray(definedHabits) ? definedHabits : [];
        return (Array.isArray(activeItems) ? activeItems : []).filter((item) => {
            if (!item || item.type !== 'habit' || item.isNegative !== true || item.koGhost) return false;
            const def = defs.find((d) => d.id === item.definitionId);
            if (!def || def.archivedAt) return false;
            const due = item.dueDateTime ? new Date(item.dueDateTime).getTime() : NaN;
            return Number.isFinite(due) && due <= now;
        });
    }

    /** Which How much? box a goal gets: 'amount' (a number), 'time' (minutes = the logged time) or null (none / note). */
    function howMuchKind(goal) {
        if (!goal) return null;
        if (goal.type === 'amount') return 'amount';
        if (goal.type === 'time') return 'time';
        return null;
    }

    /**
     * Typed How much? text -> a number, or null when blank / invalid. 'amount' keeps up to 2 decimals (0..1,000,000);
     * 'time' is whole minutes (0..1440).
     */
    function parseHowMuch(text, kind) {
        if (text === null || text === undefined) return null;
        const s = String(text).trim();
        if (s === '') return null;
        const n = Number(s);
        if (!Number.isFinite(n) || n < 0) return null;
        if (kind === 'time') return n > MAX_MINUTES ? null : Math.round(n);
        if (kind === 'amount') return n > MAX_AMOUNT ? null : Math.round(n * 100) / 100;
        return null;
    }

    /** Whole minutes logged on an item (`timerMsBanked`), or null when nothing is logged. */
    function loggedMinutes(item) {
        const ms = item && typeof item.timerMsBanked === 'number' ? item.timerMsBanked : 0;
        return ms > 0 ? Math.round(ms / 60000) : null;
    }

    /** The "actual" for the daily record: an Amount goal's typed number, a Time goal's logged minutes, nothing for others. */
    function actualFor(item, goal) {
        if (!goal) return null;
        if (goal.type === 'amount') {
            return item && typeof item.goalActual === 'number' && Number.isFinite(item.goalActual) ? item.goalActual : null;
        }
        if (goal.type === 'time') return loggedMinutes(item);
        return null;
    }

    /** The daily-record goal entry for an answered habit, or null when its goal type is none. `met` = the player's own answer. */
    function goalRecord(goal, met, actual) {
        if (!goal || (goal.type !== 'time' && goal.type !== 'amount' && goal.type !== 'note')) return null;
        return {
            type: goal.type,
            amount: goal.type === 'note' ? null : (typeof goal.amount === 'number' ? goal.amount : null),
            unit: goal.type === 'note' ? null : (typeof goal.unit === 'string' ? goal.unit : null),
            met: met === true,
            // A Note goal has no measure, so it never carries an actual.
            actual: goal.type !== 'note' && typeof actual === 'number' && Number.isFinite(actual) ? actual : null,
        };
    }

    return {
        DEFAULT_EVENING_TIME,
        parseTimeOfDay,
        normalizeEveningTime,
        isEveningTime,
        eveningCandidates,
        howMuchKind,
        parseHowMuch,
        loggedMinutes,
        actualFor,
        goalRecord,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoalCheck;
}

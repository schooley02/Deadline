/**
 * DayRollover — pure detection of "the real calendar day has advanced past the
 * game's currentGameDate," plus selection of the prior-day recurring instances
 * that need settling ([P1-DATA-005] / day-advance mechanism, 2026-07-19).
 *
 * WHY THIS EXISTS: `currentGameDate` is set once at initGame() (midnight today)
 * and restored from the save as-is; nothing ever advanced it. So a session that
 * spanned midnight (close overnight, reopen next day) left the game thinking it
 * was still the old day — the daily generators ran with a stale date and today's
 * habit/routine-task instances never spawned. Base HP / offline damage / regen /
 * days-survived all derive from REAL elapsed time and were never affected; only
 * the game-DAY concept was broken. See DECISIONS.md 2026-07-19 (session 32).
 *
 * SCOPE (this session): restore-path detection only. The orchestration lives in
 * state.js's restoreGameState (advance the date, settle prior-day instances,
 * then spawn today's). LIVE mid-session midnight crossing is deliberately a
 * later version — a session left running past midnight rolls over on its next
 * reload (stale but self-correcting, never corrupt). See DECISIONS.md.
 *
 * Pure — no DOM, no globals, no state. Same shape as clock.js / schedule.js.
 * The "how to settle one stale instance" decision (avoid vs drop) lives in
 * items.js's settleStaleRecurringInstance, next to the other item lifecycle
 * code; this module only answers "did we roll over, and which instances are
 * from a prior day."
 */
const DayRollover = (() => {

    // Local midnight for a date's calendar day. Uses local fields (not UTC), so
    // "the player's day" matches their wall clock — same reasoning as
    // habits.js's toOccurrenceDate and the popups/forms UTC pre-fill fixes.
    function startOfDay(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    // True when `now` falls on a strictly later calendar day than the saved
    // game date. A missing/invalid saved date returns false (treat as "no
    // rollover" — a fresh boot's initGame already set today, and a corrupt
    // value shouldn't trigger destructive settlement).
    function hasDayRolledOver(savedGameDate, now) {
        if (!(savedGameDate instanceof Date) || isNaN(savedGameDate.getTime())) return false;
        return startOfDay(now).getTime() > startOfDay(savedGameDate).getTime();
    }

    // The recurring instances that belong to a day BEFORE today and therefore
    // need closing out at rollover. Recurring instances (habits + routine tasks)
    // are exactly those carrying a `definitionId`; one-off tasks and sub-tasks
    // have none, so they're left alone — a missed one-off deadline stays an
    // overdue threat, it isn't a per-day concept. Keyed off `originalDueDate`
    // (the scheduled day the instance belongs to), not dueDateTime, which a
    // pushback could have shifted.
    function selectStaleRecurringInstances(activeItems, now) {
        const todayStartMs = startOfDay(now).getTime();
        return activeItems.filter(item =>
            item.definitionId != null &&
            item.originalDueDate &&
            startOfDay(item.originalDueDate).getTime() < todayStartMs
        );
    }

    // True when `date` falls on the calendar day immediately BEFORE `now`'s
    // day — the single "yesterday" the check-in surface prompts for
    // (sub-session 4, [P1-DATA-005], 2026-07-19). Days older than that are
    // NOT "the previous day" — the caller (state.js) routes those through
    // the existing auto-avoid path instead (session 26's generous default),
    // matching NEGATIVE_HABITS_PLAN.md's "days older than the previous day
    // auto-resolve as avoided."
    function isFromPreviousDay(date, now) {
        const previousDayStart = startOfDay(now);
        previousDayStart.setDate(previousDayStart.getDate() - 1);
        return startOfDay(date).getTime() === previousDayStart.getTime();
    }

    return {
        startOfDay,
        hasDayRolledOver,
        selectStaleRecurringInstances,
        isFromPreviousDay,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DayRollover;
}

/**
 * Frozen Routine Slots — pure core (Milestone 3, "Frozen routine slots +
 * recovery" ticket, sub-session 1, 2026-07-19). See docs/ROUTINES.md's
 * "Frozen Routine Slots" section (canonical spec) and
 * docs/FROZEN_SLOTS_PLAN.md (session 35, Fable — the four forks this file
 * implements).
 *
 * SCOPE: routine-owned NEGATIVE habits only. A standalone negative habit
 * (habitDef.routineId === null) has no routine to freeze — debt + streak
 * already punish it. Tasks never freeze anything. This module doesn't
 * enforce that scoping itself (it's a pure function over an occurrence
 * history); callers (js/items.js) check routineId before calling.
 *
 * THE COUNTING RULE (forks 1 + 2, docs/FROZEN_SLOTS_PLAN.md): both the
 * freeze trigger (3+ consecutive indulged days) and the avoidance-recovery
 * path (3+ consecutive avoided days) are read directly off
 * habitDef.occurrenceHistory — the SAME array Habits.recordOccurrence
 * already upserts chronologically for every completion/overdue/indulged
 * event. A Cheat/Sick/Skip-Day-excused day records NO occurrence at all
 * (session 34), so it's simply ABSENT from the array — invisible to a
 * trailing run rather than breaking it. Fork 2 (Jeremy, session 35):
 * excused days are transparent to both counts. This falls out of counting
 * trailing array entries for free; no special-casing needed here.
 *
 * Frozen state lives on the ROUTINE (not the habit): `routine.frozenState =
 * { frozenBy: habitDefId, frozenAt: isoString } | null`. Avoidance recovery
 * PROGRESS ("2/3 days avoided") is deliberately DERIVED from
 * occurrenceHistory on demand (avoidanceProgress below), not persisted
 * separately — one less place for it to drift out of sync with the history
 * it's computed from.
 */
const FrozenSlots = (() => {
    // Length of the trailing run of occurrences whose `success` matches
    // wantSuccess, counted from the END of history (most recent entry
    // first), stopping at the first non-matching entry. occurrenceHistory
    // is upsert-ordered chronologically by Habits.recordOccurrence, so
    // "trailing" means "most recent calendar days". Pure; does not mutate.
    function trailingRun(occurrenceHistory, wantSuccess) {
        if (!Array.isArray(occurrenceHistory)) return 0;
        let count = 0;
        for (let i = occurrenceHistory.length - 1; i >= 0; i--) {
            if (occurrenceHistory[i].success === wantSuccess) {
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    // The freeze trigger: true once thresholdDays consecutive INDULGED
    // (success: false) days are recorded. Callers check habitDef.isNegative
    // and habitDef.routineId themselves — this is a pure count.
    function shouldFreeze(occurrenceHistory, thresholdDays) {
        return trailingRun(occurrenceHistory, false) >= thresholdDays;
    }

    // Recovery path 2 (ROUTINES.md): true once thresholdDays consecutive
    // AVOIDED (success: true) days are recorded while the habit stays
    // active. Callers are responsible for only clearing frozenState when
    // the recovering habit is the one that caused the freeze
    // (routine.frozenState.frozenBy === habitDef.id).
    function shouldRecoverByAvoidance(occurrenceHistory, thresholdDays) {
        return trailingRun(occurrenceHistory, true) >= thresholdDays;
    }

    // Progress toward avoidance recovery, for UI (sub-session 3): how many
    // of the last thresholdDays were successfully avoided, capped at
    // thresholdDays. Derived from the same trailing run shouldRecoverByAvoidance
    // reads — always in sync with the history by construction.
    function avoidanceProgress(occurrenceHistory, thresholdDays) {
        return Math.min(trailingRun(occurrenceHistory, true), thresholdDays);
    }

    // Builds the persisted frozen-state marker to assign to
    // routine.frozenState. `now` may be a Date or anything `new Date()`
    // accepts; stored as an ISO string (same convention as other
    // timestamped fields in this codebase).
    function buildFrozenState(habitDefId, now) {
        const at = now instanceof Date ? now : new Date(now);
        return {
            frozenBy: habitDefId,
            frozenAt: at.toISOString(),
        };
    }

    return {
        trailingRun,
        shouldFreeze,
        shouldRecoverByAvoidance,
        avoidanceProgress,
        buildFrozenState,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FrozenSlots;
}

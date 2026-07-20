/**
 * RunStats — run history + run review pure core (Milestone 3 "Run history +
 * run review screen", sub-session 1, 2026-07-19 session 52; sequenced in
 * docs/RUN_HISTORY_PLAN.md, forks in DECISIONS.md session 52).
 *
 * Same pattern as economy.js/heroes.js: pure functions, no DOM, no closures
 * over script.js state. Ownership of `currentRunStats` and `runHistory`
 * stays in script.js (accessor-deps pattern); this module only computes.
 *
 * Two shapes (canonical copies in docs/DATA_SCHEMA.md):
 *
 * currentRunStats — live, run-scoped accumulator. Persisted (a mid-run
 * reload keeps accruing), RESET by initGame. Blame is an aggregate map,
 * ONE row per offending item identity, upserted per damage tick — bounded
 * no matter how long something camps (fork 4: NO per-tick event log).
 *
 * runRecord — frozen at gameOver() by finalizeRun(), appended to
 * runHistory. runHistory is persisted and must SURVIVE initGame/restart
 * (the whole feature); capped at CONFIG.RUN_HISTORY_MAX via
 * appendToHistory.
 *
 * Blame identity: instances of the same recurring definition aggregate into
 * one row ("Gym" missed across 3 days = one row, not three), keyed by
 * definitionId; one-off tasks key by instance id. `routineId` on a blame
 * row is resolved by the CALLER (wiring sub-session 2 — item→routine
 * lookup lives in items.js's world, not here) and defaults to null.
 *
 * Per-routine rollup (fork 2): frozen/KO capture is END-STATE flags in v1
 * (`wasFrozenAtEnd`/`wasKOdAtEnd`), not day counts — day-accrual would need
 * its own per-run tracking nobody consumes yet.
 */
const RunStats = (() => {
    function freshRunStats() {
        return {
            tasksCompleted: 0,
            habitsCompleted: 0,
            habitsMissed: 0,
            pointsEarned: 0,
            blame: {},
        };
    }

    // Stable blame identity — see header. Recurring instances (habit OR
    // routine-owned task) carry a definitionId; one-off tasks don't.
    function blameKeyFor(item) {
        if (item.definitionId != null) {
            return item.type + ':' + item.definitionId;
        }
        return 'item:' + item.id;
    }

    /**
     * Upsert one damage hit into stats.blame. Mutates `stats` (the
     * accumulator is owned by script.js and persisted as-is — same
     * mutate-in-place convention as every other state shape).
     * `routineId`: owning routine resolved by the caller, or null.
     */
    function recordDamage(stats, item, dmg, nowMs, routineId) {
        if (!stats || !item || !(dmg > 0)) return;
        const key = blameKeyFor(item);
        const row = stats.blame[key];
        if (row) {
            row.totalDamage += dmg;
            row.lastDamageAt = nowMs;
        } else {
            stats.blame[key] = {
                name: item.name,
                category: item.category || null,
                isHabit: item.type === 'habit',
                routineId: routineId != null ? routineId : null,
                totalDamage: dmg,
                firstDamageAt: nowMs,
                lastDamageAt: nowMs,
            };
        }
    }

    function recordTaskCompleted(stats) { if (stats) stats.tasksCompleted += 1; }
    function recordHabitCompleted(stats) { if (stats) stats.habitsCompleted += 1; }
    function recordHabitMissed(stats) { if (stats) stats.habitsMissed += 1; }

    // Gross earnings only — spending isn't a run-performance signal.
    // Uncompletion refunds are NOT subtracted (same "completion happened"
    // philosophy as occurrenceHistory: the counters describe what occurred,
    // not the net ledger). Callers pass the awarded amount.
    function recordPointsEarned(stats, amount) {
        if (stats && amount > 0) stats.pointsEarned += amount;
    }

    // Blame map → array sorted by damage desc (ties: earlier first offender
    // first). Used by finalizeRun and by the live Stats panel (sub-session 3).
    function sortedBlame(blame) {
        return Object.values(blame || {})
            .slice()
            .sort((a, b) => (b.totalDamage - a.totalDamage) ||
                            (a.firstDamageAt - b.firstDamageAt));
    }

    /**
     * Freeze the ending run into a runRecord (fork 2 shape: lean totals +
     * per-routine rollup). Pure — heroes math arrives via ctx.
     *
     * ctx: {
     *   runNumber, startedAtMs, endedAtMs, daysSurvived,
     *   endReason,                       // 'base_destroyed' (enum-ready)
     *   definedRoutines, definedHabits,  // live defs at death
     *   completionRate(routine, definedHabits, windowStartMs),  // Heroes.*
     *   starRating(rate),                // tiers pre-bound by the caller
     * }
     */
    function finalizeRun(stats, ctx) {
        const blameRows = sortedBlame(stats && stats.blame);
        const windowStartMs = ctx.startedAtMs;

        const routines = (ctx.definedRoutines || []).map(routine => {
            // `cr` is Heroes.completionRate's raw { rate, samples } object (or
            // null when no collaborator is injected — old damage tests). The
            // record deliberately stores that whole object as `completionRate`
            // (persistence.js's 10→11 sweep + the Steady Hands live path read
            // `.rate` off it). starRating, however, takes the NUMERIC rate —
            // must unwrap `cr.rate`, matching HeroesView.buildChipViewModel.
            // The old code passed the object straight in, so `object >= minRate`
            // was always NaN → every finalized routine stored stars: 0.
            const cr = ctx.completionRate
                ? ctx.completionRate(routine, ctx.definedHabits || [], windowStartMs)
                : null;
            return {
                routineId: routine.id,
                name: routine.name,
                level: typeof routine.level === 'number' ? routine.level : 1,
                stars: (cr != null && cr.rate != null && ctx.starRating) ? ctx.starRating(cr.rate) : null,
                completionRate: cr,
                memberDamage: blameRows
                    .filter(row => row.routineId === routine.id)
                    .reduce((sum, row) => sum + row.totalDamage, 0),
                wasFrozenAtEnd: !!routine.frozenState,
                wasKOdAtEnd: !!routine.koState,
            };
        });

        const totals = stats ? {
            tasksCompleted: stats.tasksCompleted,
            habitsCompleted: stats.habitsCompleted,
            habitsMissed: stats.habitsMissed,
            pointsEarned: stats.pointsEarned,
        } : freshRunStats();

        return {
            runNumber: ctx.runNumber,
            startedAtMs: ctx.startedAtMs,
            endedAtMs: ctx.endedAtMs,
            daysSurvived: ctx.daysSurvived,
            endReason: ctx.endReason || 'base_destroyed',
            totals,
            blame: blameRows,
            routines,
        };
    }

    // Append newest-first, capped (oldest dropped). Returns a NEW array —
    // history is replaced, not mutated, so a failed finalize can't leave a
    // half-appended list.
    function appendToHistory(history, record, max) {
        const next = [record].concat(history || []);
        return (max > 0 && next.length > max) ? next.slice(0, max) : next;
    }

    /**
     * Per-routine rollup ACROSS RUNS (sub-session 4, RUN_HISTORY_PLAN.md —
     * the A/B comparison surface fork 2 anticipated). `runHistory` is
     * already newest-first (appendToHistory); this groups each run's frozen
     * `record.routines[]` rows by routineId, preserving that newest-first
     * order both across routines (a routine's group appears where it was
     * FIRST encountered scanning newest-to-oldest, i.e. by recency) and
     * within a routine's own entries. `maxRunsPerRoutine` caps entries per
     * routine (CONFIG.ROUTINE_ROLLUP_MAX_RUNS) — a long-lived routine could
     * otherwise carry up to CONFIG.RUN_HISTORY_MAX (50) rows into the UI.
     * `name` uses the routine's most-recently-seen name (routine names are
     * frozen per-record at finalizeRun time, same as every other routine
     * field here — a later rename doesn't rewrite old records).
     *
     * Pure — no DOM, no mutation of runHistory. Returns a NEW array of
     * { routineId, name, entries: [{runNumber, endedAtMs, level, stars,
     * completionRate, memberDamage, wasFrozenAtEnd, wasKOdAtEnd}, ...] }.
     */
    function rollupRoutinePerformance(runHistory, maxRunsPerRoutine) {
        const cap = maxRunsPerRoutine > 0 ? maxRunsPerRoutine : Infinity;
        const byRoutine = new Map();

        (runHistory || []).forEach(record => {
            (record.routines || []).forEach(r => {
                let group = byRoutine.get(r.routineId);
                if (!group) {
                    group = { routineId: r.routineId, name: r.name, entries: [] };
                    byRoutine.set(r.routineId, group);
                }
                if (group.entries.length < cap) {
                    group.entries.push({
                        runNumber: record.runNumber,
                        endedAtMs: record.endedAtMs,
                        level: r.level,
                        stars: r.stars,
                        completionRate: r.completionRate,
                        memberDamage: r.memberDamage,
                        wasFrozenAtEnd: r.wasFrozenAtEnd,
                        wasKOdAtEnd: r.wasKOdAtEnd,
                    });
                }
            });
        });

        return Array.from(byRoutine.values());
    }

    return {
        freshRunStats,
        blameKeyFor,
        recordDamage,
        recordTaskCompleted,
        recordHabitCompleted,
        recordHabitMissed,
        recordPointsEarned,
        sortedBlame,
        finalizeRun,
        appendToHistory,
        rollupRoutinePerformance,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RunStats;
}

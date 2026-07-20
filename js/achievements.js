/**
 * Achievements — badge catalog evaluation pure core (Milestone 4
 * "Achievements & badges", sub-session 1, 2026-07-20 session 64; see
 * docs/ACHIEVEMENTS_PLAN.md, forks in DECISIONS.md session 64).
 *
 * Same pattern as runStats.js/heroes.js: pure functions, no DOM, catalog
 * passed in explicitly (never read from a global CONFIG inside this
 * module) so it stays independently testable. Ownership of `lifetimeStats`
 * and `achievements` (the unlocked-tier map) stays in script.js
 * (accessor-deps pattern, mirroring currentRunStats/runHistory).
 *
 * Two shapes (canonical copies land in docs/DATA_SCHEMA.md):
 *
 * lifetimeStats — persisted, NEVER reset by initGame (survives restart,
 * same lifecycle as runHistory — these describe the player's whole history
 * across runs, not one run). Wiped only by the dev-Reset button.
 *
 * achievements — persisted unlocked-tier map, `{ [tierId]: unlockedAtISO }`.
 * Unlocks are never revoked (fork: a later symmetric decrement to
 * lifetimeStats, e.g. an uncompletion, can't un-unlock a badge already
 * shown). Same never-reset/dev-Reset-only-wipe lifecycle as lifetimeStats.
 *
 * v1 is badge-only (fork 1) — no point payouts, so evaluation has no
 * interaction with economy.js. Sub-session 1 ships this pure core +
 * the schema 10→11 migration + a one-time retro sweep (state.js); it is
 * NOT wired to live completion/streak/economy events yet (sub-session 2).
 */
const Achievements = (() => {
    function freshLifetimeStats() {
        return {
            tasksCompleted: 0,
            habitsCompleted: 0,
            bestRunDaysSurvived: 0,
            bestHabitStreak: 0,
            steadyRoutineRuns: 0,
            pointsRecoveries: 0,
        };
    }

    function freshUnlocked() {
        return {};
    }

    // One family's tiers newly crossed by `value`, excluding tiers already
    // present in `unlocked`. Pure — caller stamps timestamps + persists.
    function evaluateFamily(family, value, unlocked) {
        if (!family || !Array.isArray(family.tiers) || typeof value !== 'number') return [];
        const seen = unlocked || {};
        return family.tiers.filter(tier => value >= tier.threshold && !seen[tier.id]);
    }

    // Every family in `catalog` against a `lifetimeStats` snapshot. Returns
    // a flat array of newly-crossed tier defs (family id/name attached).
    // Idempotent — re-running against an unchanged lifetimeStats/unlocked
    // pair always returns [], so callers can safely re-check on every
    // restore rather than needing a "have I swept already" flag.
    function evaluateAll(catalog, lifetimeStats, unlocked) {
        const stats = lifetimeStats || {};
        const newly = [];
        (catalog || []).forEach(family => {
            evaluateFamily(family, stats[family.metric], unlocked).forEach(tier => {
                newly.push({
                    tierId: tier.id,
                    threshold: tier.threshold,
                    label: tier.label,
                    familyId: family.id,
                    familyName: family.name,
                });
            });
        });
        return newly;
    }

    // Record newly-crossed tiers into a NEW unlocked-map (replace, don't
    // mutate — same convention as RunStats.appendToHistory) so a
    // half-applied evaluate can't corrupt persisted state.
    function recordUnlocks(unlocked, newlyCrossed, nowIso) {
        if (!newlyCrossed || !newlyCrossed.length) return unlocked || {};
        const next = Object.assign({}, unlocked);
        newlyCrossed.forEach(tier => { next[tier.tierId] = nowIso; });
        return next;
    }

    return {
        freshLifetimeStats,
        freshUnlocked,
        evaluateFamily,
        evaluateAll,
        recordUnlocks,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Achievements;
}

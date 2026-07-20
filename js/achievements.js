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

    // The first tier in a family NOT yet in `unlocked` (tiers are authored
    // ascending in the catalog — see config.js's ACHIEVEMENTS comment).
    // null if every tier in the family is already unlocked.
    function nextLockedTier(family, unlocked) {
        const seen = unlocked || {};
        return (family && Array.isArray(family.tiers))
            ? (family.tiers.find(tier => !seen[tier.id]) || null)
            : null;
    }

    // Sub-session 4 polish (ACHIEVEMENTS_PLAN.md, session 68): "N to go"
    // nudges for the Stats current-run panel. For each family, looks only
    // at its NEXT locked tier (not every qualifying tier — one nudge per
    // family, matching the badge grid's "next milestone" framing) and
    // includes it once progress crosses `thresholdPct` (default 0.8, see
    // CONFIG.NEAR_MISS_THRESHOLD_PCT — a UI constant, not passed
    // implicitly: this module never reads CONFIG itself, matching the rest
    // of the file). Pure — no DOM, no catalog/lifetimeStats mutation.
    function nearMissNudges(catalog, lifetimeStats, unlocked, thresholdPct) {
        const pct = (typeof thresholdPct === 'number') ? thresholdPct : 0.8;
        const stats = lifetimeStats || {};
        const nudges = [];
        (catalog || []).forEach(family => {
            const tier = nextLockedTier(family, unlocked);
            if (!tier) return;
            const value = (typeof stats[family.metric] === 'number') ? stats[family.metric] : 0;
            const threshold = tier.threshold || 1;
            const progress = value / threshold;
            // Tiny epsilon guards against float-division edge cases at the
            // exact boundary (e.g. 4/5 vs. the literal 0.8) rounding to
            // opposite sides of `pct` — cosmetic-only nudge, so a hair of
            // slack costs nothing.
            if (progress >= pct - 1e-9 && progress < 1) {
                nudges.push({
                    familyId: family.id,
                    familyName: family.name,
                    tierLabel: tier.label,
                    unit: family.nearMissUnit || null,
                    value,
                    threshold,
                    remaining: Math.max(0, threshold - value),
                });
            }
        });
        return nudges;
    }

    return {
        freshLifetimeStats,
        freshUnlocked,
        evaluateFamily,
        evaluateAll,
        recordUnlocks,
        nextLockedTier,
        nearMissNudges,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Achievements;
}

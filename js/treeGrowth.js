/**
 * TreeGrowth -- the graveyard's growing tree, pure core (built 2026-11-08; rule decided with Jeremy the same day,
 * docs/DECISIONS.md "Growing tree").
 *
 * The tree grows with the player's LIFETIME nights survived: sapling (stage 1) -> young (2) -> twisted giant (3). Thresholds are
 * CONFIG.TREE_STAGE_NIGHTS = [young at, giant at] (first values, 30 / 100; callers pass them in, nothing here reads CONFIG).
 *
 * Lifetime nights = BANKED nights + the live run's nights:
 *   banked   `lifetimeStats.nightsSurvived`, raised by each finished run's nights at game over (script.js recordLifetimeRunEnd).
 *            Run history is capped (CONFIG.RUN_HISTORY_MAX), so it cannot give an all-time total on its own; it only SEEDS the
 *            bank for a save from before this field existed (seedBanked, called once from State's restore).
 *   current  the run in progress, counted like the moon's number (NightsSurvivedView.countMidnights). It counts for 0 once the
 *            game is over, because that run is already in the bank: that is what keeps the total from jumping at game over and
 *            from ever going down at Restart.
 * Only Reset Game (lifetimeStats back to fresh) takes the tree back to a sapling.
 *
 * Pure functions, no DOM, no State or CONFIG reads; unit-tested in test/treeGrowth.test.js.
 */
const TreeGrowth = (() => {
    const STAGES = 3;

    function whole(n) {
        return (typeof n === 'number' && isFinite(n) && n > 0) ? Math.floor(n) : 0;
    }

    /** Lifetime nights: the banked total plus the live run's nights (0 while the game is over). Bad input counts as 0. */
    function total(banked, currentRunNights, gameOver) {
        return whole(banked) + (gameOver ? 0 : whole(currentRunNights));
    }

    /** The stage 1..3 for a night total. `thresholds` = [young at, giant at]; a missing or bad pair falls back to 30 / 100. */
    function stage(totalNights, thresholds) {
        const t = Array.isArray(thresholds) ? thresholds : [];
        const young = whole(t[0]) || 30;
        const giant = Math.max(young + 1, whole(t[1]) || 100);
        const n = whole(totalNights);
        return n >= giant ? 3 : (n >= young ? 2 : 1);
    }

    /** The nights the NEXT stage needs from here (null at the giant): for a future "how it grows" line. */
    function nightsToNext(totalNights, thresholds) {
        const s = stage(totalNights, thresholds);
        if (s >= STAGES) return null;
        const t = Array.isArray(thresholds) ? thresholds : [];
        const young = whole(t[0]) || 30;
        const giant = Math.max(young + 1, whole(t[1]) || 100);
        return (s === 1 ? young : giant) - whole(totalNights);
    }

    /** The bank for a save that has none yet: the nights of every run still in history (newest-first records with `daysSurvived`). */
    function seedBanked(history) {
        const list = Array.isArray(history) ? history : [];
        return list.reduce((sum, r) => sum + whole(r && typeof r === 'object' ? r.daysSurvived : 0), 0);
    }

    /**
     * Dev override, the same shape as the buildings' `?xTier=`: `?treeStage=1..3` pins the stage, `?treeStage=off` hides the tree,
     * anything else (or nothing) keeps the real stage. Returns 1..3 or null (hidden).
     */
    function resolve(search, realStage) {
        const m = /(?:^|[?&])treeStage=([^&]*)/.exec(search || '');
        if (m) {
            const v = decodeURIComponent(m[1]).trim().toLowerCase();
            if (v === 'off' || v === 'none') return null;
            const n = Math.round(Number(v));
            if (v !== '' && isFinite(n) && n >= 1) return Math.min(n, STAGES);
        }
        return (realStage >= 1 && realStage <= STAGES) ? realStage : null;
    }

    return { STAGES, total, stage, nightsToNext, seedBanked, resolve };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TreeGrowth;
}

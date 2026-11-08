/**
 * Memorial -- the graveyard Memorial obelisk's stage, pure core (built 2026-11-08; rule decided with Jeremy the same day,
 * docs/DECISIONS.md "Memorial obelisk art").
 *
 * Stage = the AVERAGE of the eight buildings' ALL-TIME best tiers, rounded down. No conditions, and it never goes down:
 * the village tiers are per-run (a new run starts every building at T1), so the all-time best of each building is kept as a
 * high-water mark in the save (`bestVillageTiers`, a root field like `bestRoutineSlots`), and the stage is derived from it.
 * It cannot be recomputed from run history alone because history is capped (CONFIG.RUN_HISTORY_MAX), so the mark is the truth;
 * history only SEEDS it (a save from before this feature gets its past runs' peaks the first time it loads).
 *
 * Same pattern as villageProgress.js: pure functions, no DOM, no State or CONFIG reads (callers pass everything in), unit-tested
 * directly in test/memorial.test.js.
 *
 *   best        { [kind]: tier 1..5 }, any subset of the eight kinds; a missing kind counts as T1.
 *   history     newest-first run records; a record's `peakVillageTiers` is its { kind: tier } peak (absent on older records).
 */
const Memorial = (() => {
    // Same eight kinds as VillageProgress.KINDS (a test checks they match; this file loads without it so the two stay independent).
    const KINDS = ['punctuality', 'defense', 'slain', 'nights', 'lurkers', 'heroes', 'habits', 'bestdays'];
    const MIN_TIER = 1;
    const MAX_TIER = 5;

    function validTier(t) { return Number.isInteger(t) && t >= MIN_TIER && t <= MAX_TIER; }

    /** A clean { kind: tier } of only the known kinds with whole tiers 1..5 (anything else is dropped). Never throws. */
    function sanitize(best) {
        const out = {};
        if (!best || typeof best !== 'object' || Array.isArray(best)) return out;
        KINDS.forEach((k) => { if (validTier(best[k])) out[k] = best[k]; });
        return out;
    }

    /** The per-kind maximum of any number of { kind: tier } maps (bad input is ignored). The high-water step. */
    function merge(...maps) {
        const out = {};
        maps.forEach((m) => {
            const c = sanitize(m);
            KINDS.forEach((k) => { if (c[k] != null && (out[k] == null || c[k] > out[k])) out[k] = c[k]; });
        });
        return out;
    }

    /** The best tier per kind over a run history (newest-first array of run records). Records without peak tiers add nothing. */
    function fromHistory(history) {
        const list = Array.isArray(history) ? history : [];
        return merge(...list.map((r) => (r && typeof r === 'object') ? r.peakVillageTiers : null));
    }

    /** Sum of the eight best tiers; a kind with no mark counts as T1, so a brand-new game is 8. */
    function tierSum(best) {
        const c = sanitize(best);
        return KINDS.reduce((s, k) => s + (c[k] != null ? c[k] : MIN_TIER), 0);
    }

    /** The Memorial's stage 1..5: floor(average of the eight best tiers). */
    function stage(best) {
        const s = Math.floor(tierSum(best) / KINDS.length);
        return Math.min(MAX_TIER, Math.max(MIN_TIER, s));
    }

    /**
     * Where the player stands for the (later) Memorial card: the stage, the tier sum, how many whole tier-ups across any
     * buildings reach the next stage (null at stage 5), and the per-kind best tiers with missing kinds filled in as T1.
     */
    function progress(best) {
        const c = sanitize(best);
        const sum = tierSum(c);
        const st = stage(c);
        const maxed = st >= MAX_TIER;
        return {
            stage: st,
            sum,
            toNextStage: maxed ? null : (st + 1) * KINDS.length - sum,
            maxed,
            kinds: KINDS.map((k) => ({ kind: k, best: c[k] != null ? c[k] : MIN_TIER })),
        };
    }

    return { KINDS, MIN_TIER, MAX_TIER, sanitize, merge, fromHistory, tierSum, stage, progress };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Memorial;
}

/**
 * Memorial -- the graveyard Memorial obelisk's stage, pure core (built 2026-11-08; rule decided with Jeremy the same day,
 * docs/DECISIONS.md "Memorial obelisk art").
 *
 * Stage = the AVERAGE of the nine buildings' ALL-TIME best tiers, rounded down (and never below the saved stage mark, `bestMemorialStage`). No conditions, and it never goes down:
 * the village tiers are per-run (a new run starts every building at T1), so the all-time best of each building is kept as a
 * high-water mark in the save (`bestVillageTiers`, a root field like `bestRoutineSlots`), and the stage is derived from it.
 * It cannot be recomputed from run history alone because history is capped (CONFIG.RUN_HISTORY_MAX), so the mark is the truth;
 * history only SEEDS it (a save from before this feature gets its past runs' peaks the first time it loads).
 *
 * Same pattern as villageProgress.js: pure functions, no DOM, no State or CONFIG reads (callers pass everything in), unit-tested
 * directly in test/memorial.test.js.
 *
 *   best        { [kind]: tier 1..5 }, any subset of the nine kinds; a missing kind counts as T1.
 *   history     newest-first run records; a record's `peakVillageTiers` is its { kind: tier } peak (absent on older records).
 */
const Memorial = (() => {
    // Same nine kinds as VillageProgress.KINDS (a test checks they match; this file loads without it so the two stay independent).
    const KINDS = ['punctuality', 'defense', 'slain', 'nights', 'lurkers', 'heroes', 'habits', 'bestdays', 'goals'];
    // The eight buildings before the Lab (2026-11-26): the stage a save had earned before the ninth joined is seeded from these.
    const LEGACY_KINDS = KINDS.slice(0, 8);
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

    /** Sum of the nine best tiers; a kind with no mark counts as T1, so a brand-new game is 9. */
    function tierSum(best) {
        const c = sanitize(best);
        return KINDS.reduce((s, k) => s + (c[k] != null ? c[k] : MIN_TIER), 0);
    }

    /**
     * The Memorial's stage 1..5: the larger of the SAVED stage (a high-water mark: the Lab joined as a ninth building at star 1, which would
     * lower the average, and a stage never drops) and floor(average of the nine best tiers). `saved` is optional (absent = the average alone).
     */
    function stage(best, saved) {
        const s = Math.floor(tierSum(best) / KINDS.length);
        const floor = validTier(saved) ? saved : MIN_TIER;
        return Math.min(MAX_TIER, Math.max(MIN_TIER, s, floor));
    }

    /** The stage the EIGHT pre-Lab buildings gave: seeds the saved stage for a save from before the Lab. */
    function legacyStage(best) {
        const c = sanitize(best);
        const sum = LEGACY_KINDS.reduce((n, k) => n + (c[k] != null ? c[k] : MIN_TIER), 0);
        return Math.min(MAX_TIER, Math.max(MIN_TIER, Math.floor(sum / LEGACY_KINDS.length)));
    }

    /**
     * Where the player stands for the Memorial card: the stage (see `stage`; `saved` = the saved high-water stage), the tier sum, how many
     * whole tier-ups across any buildings reach the next stage (null at stage 5; 0 when the saved stage is ahead of the average), and the
     * per-kind best tiers with missing kinds filled in as T1.
     */
    function progress(best, saved) {
        const c = sanitize(best);
        const sum = tierSum(c);
        const st = stage(c, saved);
        const maxed = st >= MAX_TIER;
        return {
            stage: st,
            sum,
            toNextStage: maxed ? null : Math.max(0, (st + 1) * KINDS.length - sum),
            maxed,
            kinds: KINDS.map((k) => ({ kind: k, best: c[k] != null ? c[k] : MIN_TIER })),
        };
    }

    return { KINDS, LEGACY_KINDS, MIN_TIER, MAX_TIER, sanitize, merge, fromHistory, tierSum, stage, legacyStage, progress };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Memorial;
}

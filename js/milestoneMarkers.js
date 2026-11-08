/**
 * MilestoneMarkers -- the small markers on the graveyard hill that show the player's all-time achievements (built 2026-11-08; decided with
 * Jeremy the same day: DECISIONS "Milestone markers"; art: docs/ART_STYLE "Milestone markers"). Pure core, zero module dependencies.
 *
 * Seven all-time achievement families each get ONE marker (CONFIG.MARKER_FAMILIES, in slot order: Task Slayer, Habit Hero, Survivor,
 * Clean Sweep, On Fire, Iron Will, Honor Roll). The same five-picture set is reused for every family, and a marker only ever gets nicer:
 *
 *     stage 0  no badge yet  (plain wooden cross)
 *     stage 1  first tier    (Bronze)
 *     stage 2  second tier   (Silver)
 *     stage 3  third tier    (Gold)
 *     stage 4  fourth tier   (Platinum)
 *
 * The stage is the highest tier of the family that is in the unlocked-tier map (`State.getAchievements()`: `{ [tierId]: unlockedAtISO }`).
 * Unlocks are never revoked (docs/ACHIEVEMENTS_PLAN.md), so a marker never goes back; only Reset Game wipes them. NOTHING is saved here:
 * no new save field, no schema bump. A family with fewer tiers than five tops out early (On Fire has three, so its marker stops at stage 3).
 *
 * Catalog, family ids and the unlocked map are passed in (the rest of the achievements code does the same), so this file never reads
 * CONFIG, State or the DOM.
 */
const MilestoneMarkers = (() => {
    const MAX_STAGE = 4;

    function whole(n) {
        return (typeof n === 'number' && isFinite(n) && n > 0) ? Math.floor(n) : 0;
    }

    /** Highest tier of `family` present in `unlocked`, as a stage 1..MAX_STAGE; 0 when none is. Tiers are authored ascending. */
    function stageOf(family, unlocked) {
        if (!family || !Array.isArray(family.tiers)) return 0;
        const seen = unlocked || {};
        let stage = 0;
        family.tiers.forEach((tier, i) => {
            if (tier && seen[tier.id]) stage = i + 1;
        });
        return Math.min(stage, MAX_STAGE);
    }

    /** The families named by `ids`, in `ids` order, taken from `catalog`. An id the catalog does not know is skipped. */
    function families(catalog, ids) {
        const list = Array.isArray(catalog) ? catalog : [];
        return (Array.isArray(ids) ? ids : [])
            .map((id) => list.find((f) => f && f.id === id))
            .filter(Boolean);
    }

    /**
     * One model per family, in slot order.
     * ctx = { catalog, ids, unlocked, stats (lifetimeStats), forced }
     *   forced: undefined = the real stages; a whole number 0..MAX_STAGE = every marker drawn at that stage (DEV preview, art checks only).
     * Each marker: { id, name, stage, maxStage, maxed, tierLabel, nextLabel, value, threshold, remaining, unit, fraction }
     *   tierLabel   the label of the tier reached ('Bronze' ...), or null at stage 0
     *   nextLabel   the label of the next tier, or null when the family is maxed
     *   fraction    progress across the CURRENT stage (previous threshold -> next threshold), 1 when maxed
     */
    function build(ctx) {
        const c = ctx || {};
        const stats = c.stats || {};
        const forced = (typeof c.forced === 'number' && isFinite(c.forced)) ? Math.max(0, Math.min(MAX_STAGE, Math.floor(c.forced))) : null;
        return families(c.catalog, c.ids).map((family) => {
            const tiers = family.tiers || [];
            const maxStage = Math.min(tiers.length, MAX_STAGE);
            const real = stageOf(family, c.unlocked);
            const stage = forced == null ? real : Math.min(forced, MAX_STAGE);
            const reached = stage >= 1 ? tiers[stage - 1] : null;
            const next = stage < maxStage ? tiers[stage] : null;
            const value = whole(stats[family.metric]);
            const threshold = next ? whole(next.threshold) : 0;
            const from = reached ? whole(reached.threshold) : 0;
            const span = Math.max(1, threshold - from);
            return {
                id: family.id,
                name: family.name,
                stage,
                maxStage,
                maxed: !next,
                tierLabel: reached ? (reached.label || null) : null,
                nextLabel: next ? (next.label || null) : null,
                value,
                threshold,
                remaining: next ? Math.max(0, threshold - value) : 0,
                unit: family.nearMissUnit || null,
                fraction: next ? Math.max(0, Math.min(1, (value - from) / span)) : 1,
            };
        });
    }

    /**
     * Where each marker stands on the hill. slots = [{ x, feet }] (x = the marker's centre column, px in from the zone's left edge;
     * feet = the bottom row of its picture, px above the canvas bottom). opts = { artPx, hitPx, zBase }.
     * The picture is artPx x artPx; the tap box is hitPx x hitPx (>= 44) centred on it. z-index: the marker nearest the viewer (lowest feet)
     * is drawn in front, starting at zBase (above the Memorial's 20, so a marker standing over the obelisk's base takes its own tap).
     */
    function placements(slots, opts) {
        const o = opts || {};
        const art = Math.max(1, o.artPx || 32);
        const hit = Math.max(44, o.hitPx || 44);
        const zBase = typeof o.zBase === 'number' ? o.zBase : 21;
        const list = Array.isArray(slots) ? slots : [];
        const backToFront = list.map((s, i) => i).sort((a, b) => (list[b].feet - list[a].feet) || (a - b));
        const z = {};
        backToFront.forEach((slotIndex, rank) => { z[slotIndex] = zBase + rank; });
        const pad = (hit - art) / 2;
        return list.map((s, i) => ({
            index: i,
            x: s.x,
            feet: s.feet,
            artLeft: pad,
            artBottom: pad,
            hitLeft: s.x - hit / 2,
            hitBottom: s.feet - pad,
            hit,
            art,
            z: z[i],
        }));
    }

    /**
     * The dev URL override `?markers=`: undefined = not given (use the real stages), 'off' = hide every marker, or a whole number
     * 0..MAX_STAGE = every marker at that stage (anything above is clamped). Mirrors TreeGrowth.resolve's `?treeStage=`.
     */
    function override(search) {
        const m = /(?:^|[?&])markers=([^&]*)/.exec(search || '');
        if (!m) return undefined;
        const v = decodeURIComponent(m[1]).trim().toLowerCase();
        if (v === 'off' || v === 'none') return 'off';
        const n = Math.round(Number(v));
        if (v !== '' && isFinite(n) && n >= 0) return Math.min(n, MAX_STAGE);
        return undefined;
    }

    return { MAX_STAGE, stageOf, families, build, placements, override };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MilestoneMarkers;
}

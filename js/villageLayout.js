/**
 * VillageLayout -- pure placement maths for the achievement VILLAGE on the horizon hill
 * (V7 W2, first slice 2026-10-29; docs/ART_STYLE.md "Achievement village art",
 * docs/WORLD_FEEDBACK_PLAN.md W2). No DOM, no State.
 *
 * This slice draws ONE building, the Clock tower (kind `punctuality`), at one tier. The other
 * kinds, the tier-from-achievements wiring and the close-up view are later W2 steps.
 *
 *   SPRITE   authored on a 128px-wide canvas (Clock tower 128x224, bottom-anchored, tower art
 *            bottom-aligned inside it) and shown 1:1, the same pixel scale as the animated
 *            zombies and heroes. Never scaled, never rotated.
 *   FEET     on the horizon: just above the floor band's top edge (CONFIG.GROUND_FLOOR_HEIGHT),
 *            i.e. behind all three zombie lanes.
 *   X        a fraction of the walking field (church edge -> graveyard hill edge).
 *   HIDDEN   in the portrait strip (no hill => hillWidth 0) and when the field is too narrow.
 *
 * Every function takes an `opts` object whose defaults mirror CONFIG, so tests can pass explicit
 * numbers and the view passes CONFIG.
 */
const VillageLayout = (() => {
    const DEFAULTS = {
        spriteWidthPx: 128,
        spriteHeightPx: 224,
        floorHeightPx: 72,
        feetAboveFloorPx: 4,
        clockXFrac: 0.55,
        minFieldPx: 220,
        tiers: 5,
        devClockTier: 3,
    };

    function fromConfig(cfg) {
        if (!cfg) return { ...DEFAULTS };
        const pick = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
        return {
            spriteWidthPx: pick(cfg.VILLAGE_SPRITE_W_PX, DEFAULTS.spriteWidthPx),
            spriteHeightPx: pick(cfg.VILLAGE_SPRITE_H_PX, DEFAULTS.spriteHeightPx),
            floorHeightPx: pick(cfg.GROUND_FLOOR_HEIGHT, DEFAULTS.floorHeightPx),
            feetAboveFloorPx: pick(cfg.VILLAGE_FEET_ABOVE_FLOOR_PX, DEFAULTS.feetAboveFloorPx),
            clockXFrac: pick(cfg.VILLAGE_CLOCK_X_FRAC, DEFAULTS.clockXFrac),
            minFieldPx: pick(cfg.VILLAGE_MIN_FIELD_PX, DEFAULTS.minFieldPx),
            tiers: pick(cfg.VILLAGE_TIERS, DEFAULTS.tiers),
            devClockTier: (cfg.VILLAGE_DEV_CLOCK_TIER === null) ? null : pick(cfg.VILLAGE_DEV_CLOCK_TIER, DEFAULTS.devClockTier),
        };
    }

    // A tier is a whole number 1..tiers; anything else (undefined, NaN, '', 0, 9) is "no tier".
    function clampTier(tier, tiers) {
        const max = tiers || DEFAULTS.tiers;
        if (tier === null || tier === undefined || tier === '') return null;
        const n = Math.round(Number(tier));
        if (!isFinite(n) || n < 1) return null;
        return Math.min(n, max);
    }

    // DEV ONLY (no punctuality tier data exists yet): `?villageTier=1..5` in the URL picks the tier,
    // `?villageTier=off` hides the village, otherwise CONFIG.VILLAGE_DEV_CLOCK_TIER (null = hidden).
    function resolveDevTier(search, opts) {
        const o = opts || DEFAULTS;
        const m = /(?:^|[?&])villageTier=([^&]*)/.exec(search || '');
        if (m) {
            const v = decodeURIComponent(m[1]).trim().toLowerCase();
            if (v === 'off' || v === 'none') return null;
            const t = clampTier(v, o.tiers);
            if (t !== null) return t;
        }
        return clampTier(o.devClockTier, o.tiers);
    }

    function fieldWidth(canvasW, baseW, hillW) {
        return Math.max(0, (canvasW || 0) - (hillW || 0) - (baseW || 0));
    }

    function spriteUrl(kind, tier) {
        return `Assets/Village/${kind}_t${tier}.png`;
    }

    // Where the Clock tower sprite goes inside #gameCanvas, or null when it must not show.
    function clockTowerSlot(canvasW, canvasH, baseW, hillW, tier, opts) {
        const o = opts || DEFAULTS;
        const t = clampTier(tier, o.tiers);
        if (t === null) return null;
        if (!(hillW > 0)) return null; // portrait strip: landscape/desktop only
        const field = fieldWidth(canvasW, baseW, hillW);
        if (field < o.minFieldPx) return null;
        const frac = Math.min(1, Math.max(0, o.clockXFrac));
        const centreX = (baseW || 0) + frac * field;
        const feetY = canvasH - o.floorHeightPx - o.feetAboveFloorPx;
        return {
            kind: 'punctuality',
            tier: t,
            url: spriteUrl('punctuality', t),
            left: Math.round(centreX - o.spriteWidthPx / 2),
            top: Math.round(feetY - o.spriteHeightPx),
            width: o.spriteWidthPx,
            height: o.spriteHeightPx,
            feetY: Math.round(feetY),
        };
    }

    return { DEFAULTS, fromConfig, clampTier, resolveDevTier, fieldWidth, spriteUrl, clockTowerSlot };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VillageLayout;
}

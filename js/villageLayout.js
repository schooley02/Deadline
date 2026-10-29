/**
 * VillageLayout -- pure placement maths for the achievement VILLAGE on the horizon hill
 * (V7 W2, first slice 2026-10-29; docs/ART_STYLE.md "Achievement village art",
 * docs/WORLD_FEEDBACK_PLAN.md W2). No DOM, no State.
 *
 * This slice draws TWO buildings: the Clock tower (kind `punctuality`, 128x224) and the Jailhouse
 * (kind `lurkers`, 128x128; added 2026-10-29). The other kinds, the tier-from-achievements wiring
 * and the close-up view are later W2 steps. Each building is placed at a fraction of the walking
 * field; a building that would overlap the church or another building is dropped, not moved.
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
        jailWidthPx: 128,
        jailHeightPx: 128,
        jailXFrac: 0.2,
        devJailTier: 3,
        minGapPx: 8,
        clockScale: 1.3,
        clockArtHeightPx: 196,
        feetMaxDropPx: 24,
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
            jailWidthPx: pick(cfg.VILLAGE_JAIL_W_PX, DEFAULTS.jailWidthPx),
            jailHeightPx: pick(cfg.VILLAGE_JAIL_H_PX, DEFAULTS.jailHeightPx),
            jailXFrac: pick(cfg.VILLAGE_JAIL_X_FRAC, DEFAULTS.jailXFrac),
            devJailTier: (cfg.VILLAGE_DEV_JAIL_TIER === null) ? null : pick(cfg.VILLAGE_DEV_JAIL_TIER, DEFAULTS.devJailTier),
            minGapPx: pick(cfg.VILLAGE_MIN_GAP_PX, DEFAULTS.minGapPx),
            clockScale: pick(cfg.VILLAGE_CLOCK_SCALE, DEFAULTS.clockScale),
            clockArtHeightPx: pick(cfg.VILLAGE_CLOCK_ART_H_PX, DEFAULTS.clockArtHeightPx),
            feetMaxDropPx: pick(cfg.VILLAGE_FEET_MAX_DROP_PX, DEFAULTS.feetMaxDropPx),
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

    // DEV ONLY (no tier data exists yet): `?<param>=1..5` in the URL picks the tier, `?<param>=off`
    // hides that building, otherwise the CONFIG default (null = hidden).
    function resolveTierParam(search, param, def, tiers) {
        const m = new RegExp('(?:^|[?&])' + param + '=([^&]*)').exec(search || '');
        if (m) {
            const v = decodeURIComponent(m[1]).trim().toLowerCase();
            if (v === 'off' || v === 'none') return null;
            const t = clampTier(v, tiers);
            if (t !== null) return t;
        }
        return clampTier(def, tiers);
    }

    // Clock tower: `?villageTier=`
    function resolveDevTier(search, opts) {
        const o = opts || DEFAULTS;
        return resolveTierParam(search, 'villageTier', o.devClockTier, o.tiers);
    }

    // Jailhouse: `?jailTier=`
    function resolveDevJailTier(search, opts) {
        const o = opts || DEFAULTS;
        return resolveTierParam(search, 'jailTier', o.devJailTier, o.tiers);
    }

    function fieldWidth(canvasW, baseW, hillW) {
        return Math.max(0, (canvasW || 0) - (hillW || 0) - (baseW || 0));
    }

    function spriteUrl(kind, tier) {
        return `Assets/Village/${kind}_t${tier}.png`;
    }

    // Where one building's sprite goes inside #gameCanvas, or null when it must not show.
    // `scale` stretches the authored canvas (STOPGAP for the Clock tower, see CONFIG.VILLAGE_CLOCK_SCALE;
    // 1 = the clean 1:1 pixels every other building uses). `feetY` overrides the horizon row.
    function slotFor(kind, spriteW, spriteH, xFrac, canvasW, canvasH, baseW, hillW, tier, o, scale, feetOverride) {
        const t = clampTier(tier, o.tiers);
        if (t === null) return null;
        if (!(hillW > 0)) return null; // portrait strip: landscape/desktop only
        const field = fieldWidth(canvasW, baseW, hillW);
        if (field < o.minFieldPx) return null;
        const frac = Math.min(1, Math.max(0, xFrac));
        const centreX = (baseW || 0) + frac * field;
        const feetY = (typeof feetOverride === 'number') ? feetOverride : horizonFeetY(canvasH, o);
        const k = (typeof scale === 'number' && scale > 0) ? scale : 1;
        const w = Math.round(spriteW * k);
        const h = Math.round(spriteH * k);
        return {
            kind,
            tier: t,
            url: spriteUrl(kind, t),
            left: Math.round(centreX - w / 2),
            top: Math.round(feetY - h),
            width: w,
            height: h,
            feetY: Math.round(feetY),
        };
    }

    function horizonFeetY(canvasH, o) {
        return canvasH - o.floorHeightPx - o.feetAboveFloorPx;
    }

    // The stretched tower is taller than a short canvas has room for (desktop 1280x720: 298px). Lower
    // its feet into the top of the floor band, up to feetMaxDropPx (still behind the back zombie lane,
    // which stands 24px below the floor's top edge); anything beyond that clips the spire tip.
    function clockFeetY(canvasH, o) {
        const base = horizonFeetY(canvasH, o);
        const need = Math.ceil(o.clockArtHeightPx * o.clockScale);
        if (base >= need) return base;
        return Math.min(need, base + Math.max(0, o.feetMaxDropPx));
    }

    function clockTowerSlot(canvasW, canvasH, baseW, hillW, tier, opts) {
        const o = opts || DEFAULTS;
        return slotFor('punctuality', o.spriteWidthPx, o.spriteHeightPx, o.clockXFrac, canvasW, canvasH, baseW, hillW, tier, o,
            o.clockScale, clockFeetY(canvasH, o));
    }

    // `feetOverride` lets villageSlots put the jail on the same row as the (possibly lowered) tower.
    function jailSlot(canvasW, canvasH, baseW, hillW, tier, opts, feetOverride) {
        const o = opts || DEFAULTS;
        return slotFor('lurkers', o.jailWidthPx, o.jailHeightPx, o.jailXFrac, canvasW, canvasH, baseW, hillW, tier, o, 1, feetOverride);
    }

    // Every building to draw, in paint order. `tiers` = { punctuality, lurkers } (null/undefined = none).
    // The Jailhouse is DROPPED (never nudged) when it would cover the church or touch the Clock tower,
    // so a narrow window shows a clean tower instead of a pile-up.
    function villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts) {
        const o = opts || DEFAULTS;
        const t = tiers || {};
        const clock = clockTowerSlot(canvasW, canvasH, baseW, hillW, t.punctuality, o);
        let jail = jailSlot(canvasW, canvasH, baseW, hillW, t.lurkers, o, clock ? clock.feetY : undefined);
        if (jail) {
            if (jail.left < (baseW || 0)) jail = null;
            else if (clock && jail.left + jail.width + o.minGapPx > clock.left) jail = null;
        }
        return [jail, clock].filter(Boolean); // jail first: the tower paints over any shared pixels
    }

    return { DEFAULTS, fromConfig, clampTier, resolveDevTier, resolveDevJailTier, fieldWidth, spriteUrl, clockTowerSlot, clockFeetY, jailSlot, villageSlots };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VillageLayout;
}

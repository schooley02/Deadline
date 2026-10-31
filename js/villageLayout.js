/**
 * VillageLayout -- pure placement maths for the achievement VILLAGE on the horizon hill
 * (V7 W2, first slice 2026-10-29; docs/ART_STYLE.md "Achievement village art",
 * docs/WORLD_FEEDBACK_PLAN.md W2). No DOM, no State.
 *
 * Eight buildings in three rows (front / back / far), placed by villageSlots from the PLACEMENT
 * MODEL (CONFIG.VILLAGE_PLACEMENT, 2026-10-30 night; see its doc comment below). A building whose
 * VISIBLE ART would reach over the church or past the hill is dropped, never moved. (The old
 * per-kind slot helpers and x-fraction keys were removed 2026-10-30.)
 *
 *   ART BOXES  a sprite is a 128px canvas but most of it is empty air. Edge rules use the kind's
 *            visible-art extent (CONFIG.VILLAGE_ART_X, the union over its five tiers), carried on
 *            each slot as artLeft / artRight.
 *
 *   ROWS     back and far rows stand higher (backRowRaisePx, farRowRaisePx), darker
 *            (backRowBrightness, farRowBrightness) and are painted first.
 *
 *   SPRITE   authored on a 128px-wide canvas (Clock tower 128x256, bottom-anchored, tower art
 *            bottom-aligned inside it) and shown 1:1, the same pixel scale as the animated
 *            zombies and heroes. Never scaled, never rotated.
 *   FEET     on the horizon: just above the floor band's top edge (CONFIG.GROUND_FLOOR_HEIGHT),
 *            i.e. behind all three zombie lanes.
 *   X        anchored to the graveyard hill (VILLAGE_PLACEMENT), centred on wide screens.
 *   HIDDEN   in the portrait strip (no hill => hillWidth 0) and when the field is too narrow.
 *
 * Every function takes an `opts` object whose defaults mirror CONFIG, so tests can pass explicit
 * numbers and the view passes CONFIG.
 */
const VillageLayout = (() => {
    const DEFAULTS = {
        spriteWidthPx: 128,
        spriteHeightPx: 256,
        floorHeightPx: 72,
        feetAboveFloorPx: 4,
        minFieldPx: 220,
        tiers: 5,
        devClockTier: 3,
        jailWidthPx: 128,
        jailHeightPx: 128,
        devJailTier: 3,
        armoryWidthPx: 128,
        armoryHeightPx: 128,
        devArmoryTier: 3,
        radioWidthPx: 128,
        radioHeightPx: 160,
        devRadioTier: 3,
        gymWidthPx: 128,
        gymHeightPx: 128,
        devGymTier: 3,
        schoolWidthPx: 128,
        schoolHeightPx: 128,
        devSchoolTier: 3,
        hospitalWidthPx: 128,
        hospitalHeightPx: 160,
        windmillWidthPx: 128,
        windmillHeightPx: 160,
        devWindmillTier: 3,
        farRowRaisePx: 30,
        farRowBrightness: 0.65,
        devHospitalTier: 3,
        art: { punctuality: [20, 113], defense: [14, 122], slain: [5, 125], nights: [12, 115], lurkers: [11, 122], heroes: [6, 125], habits: [9, 119], bestdays: [13, 116] },
        backRowRaisePx: 30,
        backRowBrightness: 0.8,
        clockScale: 1,
        clockArtHeightPx: 246,
        feetMaxDropPx: 24,
        // Placement model (2026-10-30 night): mirrors CONFIG.VILLAGE_PLACEMENT / VILLAGE_DESIGN_FIELD_PX.
        designFieldPx: 517,
        placement: {
            lurkers: { row: 'front', right: -401 },
            punctuality: { row: 'front', right: -224 },
            defense: { row: 'front', right: -24 },
            habits: { row: 'back', right: -305 },
            heroes: { row: 'back', right: -118 },
            slain: { row: 'back', right: 66 },
            bestdays: { row: 'far', right: -406, flip: true },
            nights: { row: 'far', right: -119, flip: true },
        },
    };

    function fromConfig(cfg) {
        if (!cfg) return { ...DEFAULTS };
        const pick = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
        return {
            spriteWidthPx: pick(cfg.VILLAGE_SPRITE_W_PX, DEFAULTS.spriteWidthPx),
            spriteHeightPx: pick(cfg.VILLAGE_SPRITE_H_PX, DEFAULTS.spriteHeightPx),
            floorHeightPx: pick(cfg.GROUND_FLOOR_HEIGHT, DEFAULTS.floorHeightPx),
            feetAboveFloorPx: pick(cfg.VILLAGE_FEET_ABOVE_FLOOR_PX, DEFAULTS.feetAboveFloorPx),
            minFieldPx: pick(cfg.VILLAGE_MIN_FIELD_PX, DEFAULTS.minFieldPx),
            tiers: pick(cfg.VILLAGE_TIERS, DEFAULTS.tiers),
            devClockTier: (cfg.VILLAGE_DEV_CLOCK_TIER === null) ? null : pick(cfg.VILLAGE_DEV_CLOCK_TIER, DEFAULTS.devClockTier),
            jailWidthPx: pick(cfg.VILLAGE_JAIL_W_PX, DEFAULTS.jailWidthPx),
            jailHeightPx: pick(cfg.VILLAGE_JAIL_H_PX, DEFAULTS.jailHeightPx),
            devJailTier: (cfg.VILLAGE_DEV_JAIL_TIER === null) ? null : pick(cfg.VILLAGE_DEV_JAIL_TIER, DEFAULTS.devJailTier),
            armoryWidthPx: pick(cfg.VILLAGE_ARMORY_W_PX, DEFAULTS.armoryWidthPx),
            armoryHeightPx: pick(cfg.VILLAGE_ARMORY_H_PX, DEFAULTS.armoryHeightPx),
            devArmoryTier: (cfg.VILLAGE_DEV_ARMORY_TIER === null) ? null : pick(cfg.VILLAGE_DEV_ARMORY_TIER, DEFAULTS.devArmoryTier),
            radioWidthPx: pick(cfg.VILLAGE_RADIO_W_PX, DEFAULTS.radioWidthPx),
            radioHeightPx: pick(cfg.VILLAGE_RADIO_H_PX, DEFAULTS.radioHeightPx),
            devRadioTier: (cfg.VILLAGE_DEV_RADIO_TIER === null) ? null : pick(cfg.VILLAGE_DEV_RADIO_TIER, DEFAULTS.devRadioTier),
            backRowRaisePx: pick(cfg.VILLAGE_BACK_ROW_RAISE_PX, DEFAULTS.backRowRaisePx),
            backRowBrightness: pick(cfg.VILLAGE_BACK_ROW_BRIGHTNESS, DEFAULTS.backRowBrightness),
            gymWidthPx: pick(cfg.VILLAGE_GYM_W_PX, DEFAULTS.gymWidthPx),
            gymHeightPx: pick(cfg.VILLAGE_GYM_H_PX, DEFAULTS.gymHeightPx),
            devGymTier: (cfg.VILLAGE_DEV_GYM_TIER === null) ? null : pick(cfg.VILLAGE_DEV_GYM_TIER, DEFAULTS.devGymTier),
            schoolWidthPx: pick(cfg.VILLAGE_SCHOOL_W_PX, DEFAULTS.schoolWidthPx),
            schoolHeightPx: pick(cfg.VILLAGE_SCHOOL_H_PX, DEFAULTS.schoolHeightPx),
            devSchoolTier: (cfg.VILLAGE_DEV_SCHOOL_TIER === null) ? null : pick(cfg.VILLAGE_DEV_SCHOOL_TIER, DEFAULTS.devSchoolTier),
            hospitalWidthPx: pick(cfg.VILLAGE_HOSPITAL_W_PX, DEFAULTS.hospitalWidthPx),
            hospitalHeightPx: pick(cfg.VILLAGE_HOSPITAL_H_PX, DEFAULTS.hospitalHeightPx),
            windmillWidthPx: pick(cfg.VILLAGE_WINDMILL_W_PX, DEFAULTS.windmillWidthPx),
            windmillHeightPx: pick(cfg.VILLAGE_WINDMILL_H_PX, DEFAULTS.windmillHeightPx),
            devWindmillTier: (cfg.VILLAGE_DEV_WINDMILL_TIER === null) ? null : pick(cfg.VILLAGE_DEV_WINDMILL_TIER, DEFAULTS.devWindmillTier),
            farRowRaisePx: pick(cfg.VILLAGE_FAR_ROW_RAISE_PX, DEFAULTS.farRowRaisePx),
            farRowBrightness: pick(cfg.VILLAGE_FAR_ROW_BRIGHTNESS, DEFAULTS.farRowBrightness),
            devHospitalTier: (cfg.VILLAGE_DEV_HOSPITAL_TIER === null) ? null : pick(cfg.VILLAGE_DEV_HOSPITAL_TIER, DEFAULTS.devHospitalTier),
            art: (cfg.VILLAGE_ART_X && typeof cfg.VILLAGE_ART_X === 'object') ? cfg.VILLAGE_ART_X : DEFAULTS.art,
            clockScale: pick(cfg.VILLAGE_CLOCK_SCALE, DEFAULTS.clockScale),
            clockArtHeightPx: pick(cfg.VILLAGE_CLOCK_ART_H_PX, DEFAULTS.clockArtHeightPx),
            feetMaxDropPx: pick(cfg.VILLAGE_FEET_MAX_DROP_PX, DEFAULTS.feetMaxDropPx),
            designFieldPx: pick(cfg.VILLAGE_DESIGN_FIELD_PX, DEFAULTS.designFieldPx),
            placement: (cfg.VILLAGE_PLACEMENT && typeof cfg.VILLAGE_PLACEMENT === 'object') ? cfg.VILLAGE_PLACEMENT : DEFAULTS.placement,
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

    // Build 2 (2026-10-30): the REAL tier unless the URL overrides it. `?<param>=1..5` pins the tier (art checks),
    // `?<param>=off` hides the building; with no param the real tier (1..tiers) is used. CONFIG's VILLAGE_DEV_*
    // defaults no longer apply, so a new game shows a T1 village. A null/invalid real tier = hidden.
    function resolveTier(search, param, realTier, tiers) {
        const m = new RegExp('(?:^|[?&])' + param + '=([^&]*)').exec(search || '');
        if (m) {
            const v = decodeURIComponent(m[1]).trim().toLowerCase();
            if (v === 'off' || v === 'none') return null;
            const t = clampTier(v, tiers);
            if (t !== null) return t;
        }
        return clampTier(realTier, tiers);
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

    // Armory: `?armoryTier=`
    function resolveDevArmoryTier(search, opts) {
        const o = opts || DEFAULTS;
        return resolveTierParam(search, 'armoryTier', o.devArmoryTier, o.tiers);
    }

    // Radio tower: `?radioTier=`
    function resolveDevRadioTier(search, opts) {
        const o = opts || DEFAULTS;
        return resolveTierParam(search, 'radioTier', o.devRadioTier, o.tiers);
    }

    // Boxing gym: `?gymTier=`
    function resolveDevGymTier(search, opts) {
        const o = opts || DEFAULTS;
        return resolveTierParam(search, 'gymTier', o.devGymTier, o.tiers);
    }

    // High school: `?schoolTier=`
    function resolveDevSchoolTier(search, opts) {
        const o = opts || DEFAULTS;
        return resolveTierParam(search, 'schoolTier', o.devSchoolTier, o.tiers);
    }

    // Hospital: `?hospitalTier=`
    function resolveDevHospitalTier(search, opts) {
        const o = opts || DEFAULTS;
        return resolveTierParam(search, 'hospitalTier', o.devHospitalTier, o.tiers);
    }

    // Windmill: `?windmillTier=`
    function resolveDevWindmillTier(search, opts) {
        const o = opts || DEFAULTS;
        return resolveTierParam(search, 'windmillTier', o.devWindmillTier, o.tiers);
    }

    function fieldWidth(canvasW, baseW, hillW) {
        return Math.max(0, (canvasW || 0) - (hillW || 0) - (baseW || 0));
    }

    function spriteUrl(kind, tier) {
        return `Assets/Village/${kind}_t${tier}.png`;
    }

    function horizonFeetY(canvasH, o) {
        return canvasH - o.floorHeightPx - o.feetAboveFloorPx;
    }

    // The stretched tower is taller than a short canvas has room for. Two levers, in order:
    //  1. lower its feet into the top of the floor band, up to feetMaxDropPx (still behind the back zombie
    //     lane, which stands 24px below the floor's top edge);
    //  2. if it still would not fit, shrink the stretch (never below 1) to the biggest scale that does.
    // So CONFIG.VILLAGE_CLOCK_SCALE is a MAXIMUM: roomy screens get it in full, short ones a little less.
    function clockScaleFor(canvasH, o) {
        const room = horizonFeetY(canvasH, o) + Math.max(0, o.feetMaxDropPx);
        const fit = Math.floor((room / o.clockArtHeightPx) * 100) / 100;
        return Math.max(1, Math.min(o.clockScale, fit));
    }

    function clockFeetY(canvasH, o) {
        const base = horizonFeetY(canvasH, o);
        const need = Math.ceil(o.clockArtHeightPx * clockScaleFor(canvasH, o));
        if (base >= need) return base;
        return Math.min(need, base + Math.max(0, o.feetMaxDropPx));
    }

    // Canvas size of each kind, from opts.
    function sizeOf(kind, o) {
        switch (kind) {
            case 'punctuality': return [o.spriteWidthPx, o.spriteHeightPx];
            case 'defense': return [o.jailWidthPx, o.jailHeightPx];
            case 'slain': return [o.armoryWidthPx, o.armoryHeightPx];
            case 'nights': return [o.radioWidthPx, o.radioHeightPx];
            case 'lurkers': return [o.gymWidthPx, o.gymHeightPx];
            case 'heroes': return [o.schoolWidthPx, o.schoolHeightPx];
            case 'habits': return [o.hospitalWidthPx, o.hospitalHeightPx];
            case 'bestdays': return [o.windmillWidthPx, o.windmillHeightPx];
            default: return [128, 128];
        }
    }

    const ROW_ORDER = { far: 0, back: 1, front: 2 };

    /**
     * PLACEMENT MODEL (2026-10-30 night, Jeremy + Claude; DECISIONS "Village arrangement"). The village is designed for a
     * landscape PHONE (817px wide, a 517px walking field) and anchored to the graveyard hill: each building's VISIBLE-ART
     * right edge sits `placement[kind].right` px from the field's right edge (the hill's left edge; > 0 = tucked behind the
     * hill). Wider screens keep the exact phone arrangement, CENTRED in the field (extra width = open field on both sides); narrower ones
     * pull every art-left offset in proportionally (field / designFieldPx). Rows set depth: `front` stands on the tower's row (feet
     * = the Clock tower's feet when it shows, else the horizon), `back` is backRowRaisePx higher and darker, `far` another
     * farRowRaisePx higher and darker still. `flip: true` mirrors the sprite (the view sets scaleX(-1); artLeft/artRight
     * are mirrored here). Rows are ordered by DOOR SIZE (front doors ~26-31px, back ~16-21, far ~17-18) so doors shrink with
     * depth; the strip under the moon + "NIGHTS SURVIVED" label (about 90px left of the hill) only holds short buildings.
     * A building is dropped (never moved) if its art would reach over the church or past the hill.
     * Paint order: far row, back row, front row; left to right within a row.
     */
    function villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts) {
        const o = opts || DEFAULTS;
        const t = tiers || {};
        if (!(hillW > 0)) return [];
        const field = fieldWidth(canvasW, baseW, hillW);
        if (field < o.minFieldPx) return [];
        const fieldLeft = baseW || 0;
        const fieldRight = fieldLeft + field;
        const k = (o.designFieldPx > 0) ? Math.min(1, field / o.designFieldPx) : 1;
        // Wider than the phone: slide the whole (unchanged) cluster to the middle of the field (Jeremy 2026-10-30).
        const centreShift = (o.designFieldPx > 0) ? Math.max(0, (field - o.designFieldPx) / 2) : 0;
        const clockTier = clampTier(t.punctuality, o.tiers);
        const frontFeet = clockTier !== null ? clockFeetY(canvasH, o) : horizonFeetY(canvasH, o);
        const feet = {
            front: frontFeet,
            back: frontFeet - Math.max(0, o.backRowRaisePx),
            far: frontFeet - Math.max(0, o.backRowRaisePx) - Math.max(0, o.farRowRaisePx),
        };
        const bright = { front: 1, back: o.backRowBrightness, far: o.farRowBrightness };
        const out = [];
        Object.keys(o.placement || {}).forEach((kind) => {
            const p = o.placement[kind] || {};
            const tier = clampTier(t[kind], o.tiers);
            if (tier === null) return;
            const row = (p.row === 'back' || p.row === 'far') ? p.row : 'front';
            const [w0, h0] = sizeOf(kind, o);
            const scale = (kind === 'punctuality') ? clockScaleFor(canvasH, o) : 1;
            const w = Math.round(w0 * scale);
            const h = Math.round(h0 * scale);
            const art = (o.art && o.art[kind]) || [0, w0];
            const flip = !!p.flip;
            const a0 = Math.round((flip ? w0 - art[1] : art[0]) * scale);
            const a1 = Math.round((flip ? w0 - art[0] : art[1]) * scale);
            // `right` is authored at the design width; narrower fields scale the art's LEFT-edge offset (so a building that
            // cleared the church at the design width still clears it), keeping the sprite's width.
            const designLeft = (Number(p.right) || 0) - (a1 - a0);
            const artLeft = Math.round(fieldRight - centreShift + designLeft * k);
            const left = artLeft - a0;
            const artRight = left + a1;
            if (artLeft < fieldLeft || artRight > fieldRight + hillW) return;
            const feetY = Math.round(feet[row]);
            const slot = { kind, tier, url: spriteUrl(kind, tier), left, top: feetY - h, width: w, height: h, feetY, artLeft, artRight, row, flip };
            if (row !== 'front') { slot.back = true; slot.brightness = bright[row]; }
            if (row === 'far') slot.far = true;
            out.push(slot);
        });
        out.sort((x, y) => (ROW_ORDER[x.row] - ROW_ORDER[y.row]) || (x.artLeft - y.artLeft));
        return out;
    }

    return { DEFAULTS, fromConfig, clampTier, resolveTier, sizeOf, resolveDevTier, resolveDevJailTier, resolveDevArmoryTier, resolveDevRadioTier, resolveDevGymTier, resolveDevSchoolTier, resolveDevHospitalTier, resolveDevWindmillTier, fieldWidth, spriteUrl, clockScaleFor, clockFeetY, villageSlots };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VillageLayout;
}

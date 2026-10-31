/**
 * VillageLayout -- pure placement maths for the achievement VILLAGE on the horizon hill
 * (V7 W2, first slice 2026-10-29; docs/ART_STYLE.md "Achievement village art",
 * docs/WORLD_FEEDBACK_PLAN.md W2). No DOM, no State.
 *
 * This slice draws SIX buildings: the Clock tower (kind `punctuality`, 128x256), the Jailhouse /
 * sheriff's office (kind `defense` = Church Defense, 128x128, left of the tower; re-keyed from
 * `lurkers` 2026-10-29), the boxing gym (kind `lurkers` = willpower, 128x128, between the tower and
 * the Armory; 2026-10-30), the Armory (kind `slain`, 128x128, right of the gym) and the Radio tower
 * (kind `nights`, 128x160, a BACK-ROW building between the Jailhouse and the tower) and the high
 * school (kind `heroes`, 128x128, a BACK-ROW building between the tower and the gym; 2026-10-30) and the hospital
 * (kind `habits`, 128x160, a BACK-ROW building between the gym and the Armory; 2026-10-30, placeholder art). The other
 * kinds, the tier-from-achievements wiring and the close-up view are later W2 steps. Each building
 * is placed at a fraction of the walking field; a building whose VISIBLE ART would overlap the
 * church, the hill or another building is dropped, not moved.
 *
 *   ART BOXES  (2026-10-30) a sprite is a 128px canvas but most of it is empty air. Every collision
 *            rule (gaps, church/hill edges, back-row overlap) uses the kind's visible-art extent
 *            (CONFIG.VILLAGE_ART_X, the union over its five tiers) carried on each slot as
 *            artLeft / artRight, so the front row holds four buildings at 844 wide.
 *
 *   BACK ROW  the Radio tower stands on the ridge BEHIND the front row: feet raised by
 *            backRowRaisePx, drawn darker (backRowBrightness) and painted first, so the front
 *            buildings cover it. It may overlap a front building's box by at most
 *            backMaxOverlapPx (the sprites are mostly empty air there); more than that and it is
 *            dropped, like every other building (never nudged).
 *
 *   SPRITE   authored on a 128px-wide canvas (Clock tower 128x256, bottom-anchored, tower art
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
        spriteHeightPx: 256,
        floorHeightPx: 72,
        feetAboveFloorPx: 4,
        clockXFrac: 0.36,
        minFieldPx: 220,
        tiers: 5,
        devClockTier: 3,
        jailWidthPx: 128,
        jailHeightPx: 128,
        jailXFrac: 0.13,
        devJailTier: 3,
        armoryWidthPx: 128,
        armoryHeightPx: 128,
        armoryXFrac: 0.85,
        devArmoryTier: 3,
        radioWidthPx: 128,
        radioHeightPx: 160,
        radioXFrac: 0.26,
        devRadioTier: 3,
        gymWidthPx: 128,
        gymHeightPx: 128,
        gymXFrac: 0.59,
        devGymTier: 3,
        schoolWidthPx: 128,
        schoolHeightPx: 128,
        schoolXFrac: 0.468,
        devSchoolTier: 3,
        hospitalWidthPx: 128,
        hospitalHeightPx: 160,
        hospitalXFrac: 0.719,
        windmillWidthPx: 128,
        windmillHeightPx: 160,
        windmillXFrac: 0.57,
        devWindmillTier: 3,
        farRowRaisePx: 30,
        farRowBrightness: 0.65,
        devHospitalTier: 3,
        art: { punctuality: [20, 113], defense: [14, 122], slain: [5, 125], nights: [12, 115], lurkers: [11, 122], heroes: [6, 125], habits: [9, 119], bestdays: [13, 116] },
        backRowRaisePx: 30,
        backRowBrightness: 0.8,
        backMaxOverlapPx: 48,
        minGapPx: 8,
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
            clockXFrac: pick(cfg.VILLAGE_CLOCK_X_FRAC, DEFAULTS.clockXFrac),
            minFieldPx: pick(cfg.VILLAGE_MIN_FIELD_PX, DEFAULTS.minFieldPx),
            tiers: pick(cfg.VILLAGE_TIERS, DEFAULTS.tiers),
            devClockTier: (cfg.VILLAGE_DEV_CLOCK_TIER === null) ? null : pick(cfg.VILLAGE_DEV_CLOCK_TIER, DEFAULTS.devClockTier),
            jailWidthPx: pick(cfg.VILLAGE_JAIL_W_PX, DEFAULTS.jailWidthPx),
            jailHeightPx: pick(cfg.VILLAGE_JAIL_H_PX, DEFAULTS.jailHeightPx),
            jailXFrac: pick(cfg.VILLAGE_JAIL_X_FRAC, DEFAULTS.jailXFrac),
            devJailTier: (cfg.VILLAGE_DEV_JAIL_TIER === null) ? null : pick(cfg.VILLAGE_DEV_JAIL_TIER, DEFAULTS.devJailTier),
            armoryWidthPx: pick(cfg.VILLAGE_ARMORY_W_PX, DEFAULTS.armoryWidthPx),
            armoryHeightPx: pick(cfg.VILLAGE_ARMORY_H_PX, DEFAULTS.armoryHeightPx),
            armoryXFrac: pick(cfg.VILLAGE_ARMORY_X_FRAC, DEFAULTS.armoryXFrac),
            devArmoryTier: (cfg.VILLAGE_DEV_ARMORY_TIER === null) ? null : pick(cfg.VILLAGE_DEV_ARMORY_TIER, DEFAULTS.devArmoryTier),
            radioWidthPx: pick(cfg.VILLAGE_RADIO_W_PX, DEFAULTS.radioWidthPx),
            radioHeightPx: pick(cfg.VILLAGE_RADIO_H_PX, DEFAULTS.radioHeightPx),
            radioXFrac: pick(cfg.VILLAGE_RADIO_X_FRAC, DEFAULTS.radioXFrac),
            devRadioTier: (cfg.VILLAGE_DEV_RADIO_TIER === null) ? null : pick(cfg.VILLAGE_DEV_RADIO_TIER, DEFAULTS.devRadioTier),
            backRowRaisePx: pick(cfg.VILLAGE_BACK_ROW_RAISE_PX, DEFAULTS.backRowRaisePx),
            backRowBrightness: pick(cfg.VILLAGE_BACK_ROW_BRIGHTNESS, DEFAULTS.backRowBrightness),
            gymWidthPx: pick(cfg.VILLAGE_GYM_W_PX, DEFAULTS.gymWidthPx),
            gymHeightPx: pick(cfg.VILLAGE_GYM_H_PX, DEFAULTS.gymHeightPx),
            gymXFrac: pick(cfg.VILLAGE_GYM_X_FRAC, DEFAULTS.gymXFrac),
            devGymTier: (cfg.VILLAGE_DEV_GYM_TIER === null) ? null : pick(cfg.VILLAGE_DEV_GYM_TIER, DEFAULTS.devGymTier),
            schoolWidthPx: pick(cfg.VILLAGE_SCHOOL_W_PX, DEFAULTS.schoolWidthPx),
            schoolHeightPx: pick(cfg.VILLAGE_SCHOOL_H_PX, DEFAULTS.schoolHeightPx),
            schoolXFrac: pick(cfg.VILLAGE_SCHOOL_X_FRAC, DEFAULTS.schoolXFrac),
            devSchoolTier: (cfg.VILLAGE_DEV_SCHOOL_TIER === null) ? null : pick(cfg.VILLAGE_DEV_SCHOOL_TIER, DEFAULTS.devSchoolTier),
            hospitalWidthPx: pick(cfg.VILLAGE_HOSPITAL_W_PX, DEFAULTS.hospitalWidthPx),
            hospitalHeightPx: pick(cfg.VILLAGE_HOSPITAL_H_PX, DEFAULTS.hospitalHeightPx),
            hospitalXFrac: pick(cfg.VILLAGE_HOSPITAL_X_FRAC, DEFAULTS.hospitalXFrac),
            windmillWidthPx: pick(cfg.VILLAGE_WINDMILL_W_PX, DEFAULTS.windmillWidthPx),
            windmillHeightPx: pick(cfg.VILLAGE_WINDMILL_H_PX, DEFAULTS.windmillHeightPx),
            windmillXFrac: pick(cfg.VILLAGE_WINDMILL_X_FRAC, DEFAULTS.windmillXFrac),
            devWindmillTier: (cfg.VILLAGE_DEV_WINDMILL_TIER === null) ? null : pick(cfg.VILLAGE_DEV_WINDMILL_TIER, DEFAULTS.devWindmillTier),
            farRowRaisePx: pick(cfg.VILLAGE_FAR_ROW_RAISE_PX, DEFAULTS.farRowRaisePx),
            farRowBrightness: pick(cfg.VILLAGE_FAR_ROW_BRIGHTNESS, DEFAULTS.farRowBrightness),
            devHospitalTier: (cfg.VILLAGE_DEV_HOSPITAL_TIER === null) ? null : pick(cfg.VILLAGE_DEV_HOSPITAL_TIER, DEFAULTS.devHospitalTier),
            art: (cfg.VILLAGE_ART_X && typeof cfg.VILLAGE_ART_X === 'object') ? cfg.VILLAGE_ART_X : DEFAULTS.art,
            backMaxOverlapPx: pick(cfg.VILLAGE_BACK_MAX_OVERLAP_PX, DEFAULTS.backMaxOverlapPx),
            minGapPx: pick(cfg.VILLAGE_MIN_GAP_PX, DEFAULTS.minGapPx),
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
        const left = Math.round(centreX - w / 2);
        // visible-art extent inside the canvas (whole canvas when the kind has no entry)
        const art = (o.art && o.art[kind]) || [0, spriteW];
        return {
            kind,
            tier: t,
            url: spriteUrl(kind, t),
            left,
            top: Math.round(feetY - h),
            width: w,
            height: h,
            feetY: Math.round(feetY),
            artLeft: left + Math.round(art[0] * k),
            artRight: left + Math.round(art[1] * k),
        };
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

    function clockTowerSlot(canvasW, canvasH, baseW, hillW, tier, opts) {
        const o = opts || DEFAULTS;
        return slotFor('punctuality', o.spriteWidthPx, o.spriteHeightPx, o.clockXFrac, canvasW, canvasH, baseW, hillW, tier, o,
            clockScaleFor(canvasH, o), clockFeetY(canvasH, o));
    }

    // `feetOverride` lets villageSlots put the jail on the same row as the (possibly lowered) tower.
    function jailSlot(canvasW, canvasH, baseW, hillW, tier, opts, feetOverride) {
        const o = opts || DEFAULTS;
        return slotFor('defense', o.jailWidthPx, o.jailHeightPx, o.jailXFrac, canvasW, canvasH, baseW, hillW, tier, o, 1, feetOverride);
    }

    // Same row rule as the jail: villageSlots passes the tower's feetY.
    function armorySlot(canvasW, canvasH, baseW, hillW, tier, opts, feetOverride) {
        const o = opts || DEFAULTS;
        return slotFor('slain', o.armoryWidthPx, o.armoryHeightPx, o.armoryXFrac, canvasW, canvasH, baseW, hillW, tier, o, 1, feetOverride);
    }

    // Boxing gym (kind `lurkers`): front row between the tower and the Armory; same row rule as the jail.
    function gymSlot(canvasW, canvasH, baseW, hillW, tier, opts, feetOverride) {
        const o = opts || DEFAULTS;
        return slotFor('lurkers', o.gymWidthPx, o.gymHeightPx, o.gymXFrac, canvasW, canvasH, baseW, hillW, tier, o, 1, feetOverride);
    }

    // Back-row Radio tower: its feet are `backRowRaisePx` above the front row's feet (`frontFeetY` = the tower's
    // row when there is one, else the plain horizon), and the slot carries `back: true` + `brightness` so the
    // view can darken it. Its box may overlap the front row (see villageSlots), so it is painted first.
    function radioSlot(canvasW, canvasH, baseW, hillW, tier, opts, frontFeetY) {
        const o = opts || DEFAULTS;
        const front = (typeof frontFeetY === 'number') ? frontFeetY : horizonFeetY(canvasH, o);
        const slot = slotFor('nights', o.radioWidthPx, o.radioHeightPx, o.radioXFrac, canvasW, canvasH, baseW, hillW, tier, o, 1,
            front - Math.max(0, o.backRowRaisePx));
        return slot ? { ...slot, back: true, brightness: o.backRowBrightness } : null;
    }

    // Back-row high school (kind `heroes`): same rules as the Radio tower (raised, darker, painted first).
    function schoolSlot(canvasW, canvasH, baseW, hillW, tier, opts, frontFeetY) {
        const o = opts || DEFAULTS;
        const front = (typeof frontFeetY === 'number') ? frontFeetY : horizonFeetY(canvasH, o);
        const slot = slotFor('heroes', o.schoolWidthPx, o.schoolHeightPx, o.schoolXFrac, canvasW, canvasH, baseW, hillW, tier, o, 1,
            front - Math.max(0, o.backRowRaisePx));
        return slot ? { ...slot, back: true, brightness: o.backRowBrightness } : null;
    }

    // FAR-ROW windmill (kind `bestdays`, 128x160, 2026-10-30): one ridge behind the back row (feet farRowRaisePx above the
    // back row's), darker (farRowBrightness), painted first. `back: true` keeps the `.village-back` class + filter in the view.
    function windmillSlot(canvasW, canvasH, baseW, hillW, tier, opts, frontFeetY) {
        const o = opts || DEFAULTS;
        const front = (typeof frontFeetY === 'number') ? frontFeetY : horizonFeetY(canvasH, o);
        const slot = slotFor('bestdays', o.windmillWidthPx, o.windmillHeightPx, o.windmillXFrac, canvasW, canvasH, baseW, hillW, tier, o, 1,
            front - Math.max(0, o.backRowRaisePx) - Math.max(0, o.farRowRaisePx));
        return slot ? { ...slot, back: true, far: true, brightness: o.farRowBrightness } : null;
    }

    // Back-row hospital (kind `habits`, 128x160): same rules as the Radio tower and the school.
    function hospitalSlot(canvasW, canvasH, baseW, hillW, tier, opts, frontFeetY) {
        const o = opts || DEFAULTS;
        const front = (typeof frontFeetY === 'number') ? frontFeetY : horizonFeetY(canvasH, o);
        const slot = slotFor('habits', o.hospitalWidthPx, o.hospitalHeightPx, o.hospitalXFrac, canvasW, canvasH, baseW, hillW, tier, o, 1,
            front - Math.max(0, o.backRowRaisePx));
        return slot ? { ...slot, back: true, brightness: o.backRowBrightness } : null;
    }

    // Horizontal overlap in px between two slots' VISIBLE ART (0 when they only touch or are apart).
    function overlapPx(a, b) {
        return Math.max(0, Math.min(a.artRight, b.artRight) - Math.max(a.artLeft, b.artLeft));
    }

    // True when two buildings' visible art is at least `gap` px apart.
    function apart(a, b, gap) {
        return a.artRight + gap <= b.artLeft || b.artRight + gap <= a.artLeft;
    }

    // Every building to draw, in paint order. `tiers` = { punctuality, defense, lurkers, slain, nights, heroes, habits } (null/undefined = none).
    // Collision uses each building's VISIBLE ART (artLeft / artRight), not its 128px box. A front building is DROPPED
    // (never nudged) when its art would reach the church or the graveyard hill, or sit closer than minGapPx to a
    // building already placed. Evaluation order = tower, jail, armory, gym, so a later building can never displace an
    // earlier one (adding the gym never moves or drops the armory). The back-row Radio tower is dropped when it would
    // reach the church or the hill or sink behind a front building's art by more than backMaxOverlapPx. The back-row
    // school follows the same rules and is evaluated LAST, so it is also dropped when its art would overlap the Radio
    // tower's (back-row buildings may stand close, minGapPx is a front-row rule); adding it never moves or drops anything.
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

    return { DEFAULTS, fromConfig, clampTier, resolveTier, sizeOf, resolveDevTier, resolveDevJailTier, resolveDevArmoryTier, resolveDevRadioTier, resolveDevGymTier, resolveDevSchoolTier, resolveDevHospitalTier, resolveDevWindmillTier, fieldWidth, spriteUrl, clockTowerSlot, clockScaleFor, clockFeetY, jailSlot, armorySlot, gymSlot, radioSlot, schoolSlot, hospitalSlot, windmillSlot, villageSlots };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VillageLayout;
}

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
        devHospitalTier: 3,
        art: { punctuality: [20, 113], defense: [14, 122], slain: [5, 125], nights: [12, 115], lurkers: [11, 122], heroes: [6, 125], habits: [9, 119] },
        backRowRaisePx: 30,
        backRowBrightness: 0.8,
        backMaxOverlapPx: 48,
        minGapPx: 8,
        clockScale: 1,
        clockArtHeightPx: 246,
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
            devHospitalTier: (cfg.VILLAGE_DEV_HOSPITAL_TIER === null) ? null : pick(cfg.VILLAGE_DEV_HOSPITAL_TIER, DEFAULTS.devHospitalTier),
            art: (cfg.VILLAGE_ART_X && typeof cfg.VILLAGE_ART_X === 'object') ? cfg.VILLAGE_ART_X : DEFAULTS.art,
            backMaxOverlapPx: pick(cfg.VILLAGE_BACK_MAX_OVERLAP_PX, DEFAULTS.backMaxOverlapPx),
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
    function villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts) {
        const o = opts || DEFAULTS;
        const t = tiers || {};
        const fieldLeft = baseW || 0;
        const fieldRight = fieldLeft + fieldWidth(canvasW, baseW, hillW);
        const gap = o.minGapPx;
        const clock = clockTowerSlot(canvasW, canvasH, baseW, hillW, t.punctuality, o);
        const feet = clock ? clock.feetY : undefined;
        let jail = jailSlot(canvasW, canvasH, baseW, hillW, t.defense, o, feet);
        if (jail && (jail.artLeft < fieldLeft || (clock && !apart(jail, clock, gap)))) jail = null;
        let armory = armorySlot(canvasW, canvasH, baseW, hillW, t.slain, o, feet);
        if (armory && (armory.artRight > fieldRight || [clock, jail].some(f => f && !apart(armory, f, gap)))) armory = null;
        let gym = gymSlot(canvasW, canvasH, baseW, hillW, t.lurkers, o, feet);
        if (gym && (gym.artLeft < fieldLeft || gym.artRight > fieldRight || [clock, jail, armory].some(f => f && !apart(gym, f, gap)))) gym = null;
        let radio = radioSlot(canvasW, canvasH, baseW, hillW, t.nights, o, feet);
        if (radio && (radio.artLeft < fieldLeft || radio.artRight > fieldRight
            || [jail, gym, armory, clock].some(f => f && overlapPx(radio, f) > o.backMaxOverlapPx))) radio = null;
        let school = schoolSlot(canvasW, canvasH, baseW, hillW, t.heroes, o, feet);
        if (school && (school.artLeft < fieldLeft || school.artRight > fieldRight
            || [jail, gym, armory, clock].some(f => f && overlapPx(school, f) > o.backMaxOverlapPx)
            || (radio && overlapPx(school, radio) > 0))) school = null;
        // hospital: evaluated after the school, so it never moves or drops anything placed before it
        let hospital = hospitalSlot(canvasW, canvasH, baseW, hillW, t.habits, o, feet);
        if (hospital && (hospital.artLeft < fieldLeft || hospital.artRight > fieldRight
            || [jail, gym, armory, clock].some(f => f && overlapPx(hospital, f) > o.backMaxOverlapPx)
            || [radio, school].some(b => b && overlapPx(hospital, b) > 0))) hospital = null;
        // back row first, the tower last (over any shared pixels)
        return [radio, school, hospital, jail, gym, armory, clock].filter(Boolean);
    }

    return { DEFAULTS, fromConfig, clampTier, resolveDevTier, resolveDevJailTier, resolveDevArmoryTier, resolveDevRadioTier, resolveDevGymTier, resolveDevSchoolTier, resolveDevHospitalTier, fieldWidth, spriteUrl, clockTowerSlot, clockScaleFor, clockFeetY, jailSlot, armorySlot, gymSlot, radioSlot, schoolSlot, hospitalSlot, villageSlots };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VillageLayout;
}

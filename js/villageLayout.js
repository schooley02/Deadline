/**
 * VillageLayout -- pure placement maths for the achievement VILLAGE on the horizon hill
 * (V7 W2, first slice 2026-10-29; docs/ART_STYLE.md "Achievement village art",
 * docs/WORLD_FEEDBACK_PLAN.md W2). No DOM, no State.
 *
 * Nine buildings in three rows (front / back / far), placed by villageSlots from the PLACEMENT
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
 *   SPRITE   authored on its shape-class canvas (Clock tower 112x208 since 2026-11-24, bottom-anchored)
 *            and shown 1:1, the same pixel scale as the animated zombies and heroes. Never scaled,
 *            never rotated.
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
        spriteWidthPx: 112,
        spriteHeightPx: 208,
        floorHeightPx: 72,
        feetAboveFloorPx: 4,
        minFieldPx: 220,
        tiers: 5,
        devClockTier: 3,
        jailWidthPx: 160,
        jailHeightPx: 160,
        devJailTier: 3,
        armoryWidthPx: 160,
        armoryHeightPx: 160,
        devArmoryTier: 3,
        radioWidthPx: 144,
        radioHeightPx: 208,
        devRadioTier: 3,
        gymWidthPx: 192,
        gymHeightPx: 160,
        devGymTier: 3,
        schoolWidthPx: 176,
        schoolHeightPx: 144,
        devSchoolTier: 3,
        hospitalWidthPx: 176,
        hospitalHeightPx: 144,
        waterTowerWidthPx: 128,
        waterTowerHeightPx: 208,
        devWaterTowerTier: 3,
        labWidthPx: 160,
        labHeightPx: 160,
        devLabTier: 1,
        farRowRaisePx: 35,
        farRowBrightness: 0.65,
        devHospitalTier: 3,
        art: { punctuality: [16, 105], defense: [3, 160], slain: [1, 160], nights: [2, 142], lurkers: [3, 191], heroes: [0, 174], habits: [1, 174], bestdays: [4, 127], goals: [2, 159] },
        backRowRaisePx: 60,
        backRowBrightness: 0.8,
        baseTuckPx: 24,
        // Placement model (2026-10-30 night; spots redone 2026-11-24): mirrors CONFIG.VILLAGE_PLACEMENT / VILLAGE_DESIGN_FIELD_PX.
        designFieldPx: 492,
        placement: {
            lurkers: { row: 'front', right: -324 },
            defense: { row: 'front', right: -125, raise: 12 },
            slain: { row: 'front', right: 34 },
            habits: { row: 'back', right: -317 },
            punctuality: { row: 'back', right: -240, drop: 26, sink: 34, overTop: 12 },
            heroes: { row: 'back', right: 20 },
            bestdays: { row: 'far', right: -120, sink: 95, dropWide: 40 },
            goals: { row: 'front', right: 118, raise: 10, behind: true },
            nights: { row: 'far', right: 34, sink: 95, dropWide: 40 },
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
            waterTowerWidthPx: pick(cfg.VILLAGE_WATERTOWER_W_PX, DEFAULTS.waterTowerWidthPx),
            waterTowerHeightPx: pick(cfg.VILLAGE_WATERTOWER_H_PX, DEFAULTS.waterTowerHeightPx),
            devWaterTowerTier: (cfg.VILLAGE_DEV_WATERTOWER_TIER === null) ? null : pick(cfg.VILLAGE_DEV_WATERTOWER_TIER, DEFAULTS.devWaterTowerTier),
            labWidthPx: pick(cfg.VILLAGE_LAB_W_PX, DEFAULTS.labWidthPx),
            labHeightPx: pick(cfg.VILLAGE_LAB_H_PX, DEFAULTS.labHeightPx),
            devLabTier: (cfg.VILLAGE_DEV_LAB_TIER === null) ? null : pick(cfg.VILLAGE_DEV_LAB_TIER, DEFAULTS.devLabTier),
            farRowRaisePx: pick(cfg.VILLAGE_FAR_ROW_RAISE_PX, DEFAULTS.farRowRaisePx),
            farRowBrightness: pick(cfg.VILLAGE_FAR_ROW_BRIGHTNESS, DEFAULTS.farRowBrightness),
            devHospitalTier: (cfg.VILLAGE_DEV_HOSPITAL_TIER === null) ? null : pick(cfg.VILLAGE_DEV_HOSPITAL_TIER, DEFAULTS.devHospitalTier),
            art: (cfg.VILLAGE_ART_X && typeof cfg.VILLAGE_ART_X === 'object') ? cfg.VILLAGE_ART_X : DEFAULTS.art,
            baseTuckPx: pick(cfg.VILLAGE_BASE_TUCK_PX, DEFAULTS.baseTuckPx),
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

    // Police station (was the Jailhouse): `?jailTier=`
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

    // Gym: `?gymTier=`
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

    // Water tower (kind `bestdays`): `?waterTowerTier=`
    function resolveDevWaterTowerTier(search, opts) {
        const o = opts || DEFAULTS;
        return resolveTierParam(search, 'waterTowerTier', o.devWaterTowerTier, o.tiers);
    }

    // Lab (kind `goals`): `?labTier=`
    function resolveDevLabTier(search, opts) {
        const o = opts || DEFAULTS;
        return resolveTierParam(search, 'labTier', o.devLabTier, o.tiers);
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
            case 'bestdays': return [o.waterTowerWidthPx, o.waterTowerHeightPx];
            case 'goals': return [o.labWidthPx, o.labHeightPx];
            default: return [128, 128];
        }
    }

    const ROW_ORDER = { far: 0, back: 1, front: 2 };

    /**
     * PLACEMENT MODEL (2026-10-30 night, Jeremy + Claude; DECISIONS "Village arrangement"; spots redone 2026-11-24, DECISIONS "Village
     * re-arrangement"). The village is designed for the SMALLEST screen, the 800x360 landscape phone (a 492px walking field: 800 - the 120px
     * plot - the 188px church box) and anchored to the graveyard plot: each building's VISIBLE-ART right edge sits `placement[kind].right` px
     * from the field's right edge (the plot's left edge; > 0 = tucked behind the plot). Wider screens keep the exact phone arrangement,
     * CENTRED in the field (extra width = open field on both sides); narrower ones pull every art-left offset in proportionally
     * (field / designFieldPx). Rows set depth: `front` stands on the horizon, `back` is backRowRaisePx higher and darker, `far` another
     * farRowRaisePx higher and darker still. `flip: true` mirrors the sprite (the view sets scaleX(-1); artLeft/artRight are mirrored
     * here; banned for three-quarter art). Per-building options:
     *   raise  px (>= 0) further back (up) than the row's feet.
     *   drop   px (>= 0) the building ALWAYS stands lower than its row, on every screen, never below the front row's feet (Clock tower
     *          26: on the 60px back row that puts its feet 34px above the front row's, 22px above the raised Police station's, which
     *          is where the approved mock-up "option 3" has it; before this it only stood there on a short phone canvas, by sinking).
     *   sink   px (>= 0) the building may stand LOWER than its row when its canvas would otherwise run off the top of the scene: it drops
     *          only as far as needed, never more than `sink`, and never below the front row's feet (Clock tower, 2026-11-24: for
     *          canvases shorter than the 800x360 phone's). `feetY` stays the row's horizon either way.
     *   behind true: painted BEFORE the other buildings of its row (under them) instead of in left-to-right order (Lab, 2026-11-26: it stands right
     *          of the Command Post and the Command Post covers its left end wall). `slot.behind` carries it.
     *   dropWide px (>= 0): lower still, but only with free sky above the building (laptop / desktop heights); slot.wideDrop carries it (the far-row towers, 40, 2026-11-26).
     *   overTop px (>= 0) of the canvas's top rows that may run off the top of the scene before `sink` starts: the building sinks only
     *          until that much is cut (Clock tower 12: on the 800x360 phone its roof tip is cut exactly 12px, as in the mock-up).
     * The church draws OVER the village, so a building's art may start up to baseTuckPx inside the church's box (the Gym, beside the
     * lantern). A building is dropped (never moved) if its art would reach further over the church than that, or past the plot.
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
        const frontFeet = horizonFeetY(canvasH, o);
        const feet = {
            front: frontFeet,
            back: frontFeet - Math.max(0, o.backRowRaisePx),
            far: frontFeet - Math.max(0, o.backRowRaisePx) - Math.max(0, o.farRowRaisePx),
        };
        const bright = { front: 1, back: o.backRowBrightness, far: o.farRowBrightness };
        const tuck = Math.max(0, Number(o.baseTuckPx) || 0);
        const out = [];
        Object.keys(o.placement || {}).forEach((kind) => {
            const p = o.placement[kind] || {};
            const tier = clampTier(t[kind], o.tiers);
            if (tier === null) return;
            const row = (p.row === 'back' || p.row === 'far') ? p.row : 'front';
            const [w, h] = sizeOf(kind, o);
            const art = (o.art && o.art[kind]) || [0, w];
            const flip = !!p.flip;
            const a0 = flip ? w - art[1] : art[0];
            const a1 = flip ? w - art[0] : art[1];
            // `right` is authored at the design width; narrower fields scale the art's LEFT-edge offset (so a building that
            // cleared the church at the design width still clears it), keeping the sprite's width.
            const designLeft = (Number(p.right) || 0) - (a1 - a0);
            const artLeft = Math.round(fieldRight - centreShift + designLeft * k);
            const left = artLeft - a0;
            const artRight = left + a1;
            if (artLeft < fieldLeft - tuck || artRight > fieldRight + hillW) return;
            const feetY = Math.round(feet[row]);
            // Optional per-building `raise` (px, >= 0): stands the sprite further back than its row without touching `feetY` (the row's
            // horizon, which the haze plan reads).
            const raise = Math.max(0, Math.round(Number(p.raise) || 0));
            // Optional per-building `sink` (px, >= 0): see the doc comment above.
            const maxSink = Math.max(0, Math.round(Number(p.sink) || 0));
            // Optional per-building `drop` (px, >= 0): always stands this much lower than its row, never below the front row's feet.
            const room = Math.max(0, Math.round(frontFeet) - (feetY - raise));
            const drop = Math.max(0, Math.min(Math.round(Number(p.drop) || 0), room));
            const topNoWide = feetY - h - raise + drop;
            // Optional per-building `dropWide` (px, >= 0): lower still, but only with free sky above the building (a laptop / desktop height): it eases in from the canvas
            // height where the top just touches the top of the scene, at most `dropWide`, never below the front row's feet. A short canvas (top <= 0) gets none, so
            // phones are unchanged and `sink` below still decides everything there.
            const wide = Math.max(0, Math.min(Math.round(Number(p.dropWide) || 0), Math.max(0, topNoWide), room - drop));
            const rawTop = topNoWide + wide;
            const overTop = Math.max(0, Math.round(Number(p.overTop) || 0));
            const sink = (maxSink > 0 && rawTop < -overTop) ? Math.max(0, Math.min(maxSink, -rawTop - overTop, room - drop)) : 0;
            const slot = { kind, tier, url: spriteUrl(kind, tier), left, top: rawTop + sink, width: w, height: h, feetY, artLeft, artRight, row, flip };
            if (raise > 0) slot.raise = raise;
            if (drop > 0) slot.drop = drop;
            if (wide > 0) slot.wideDrop = wide;
            if (sink > 0) slot.sink = sink;
            if (row !== 'front') { slot.back = true; slot.brightness = bright[row]; }
            if (row === 'far') slot.far = true;
            if (p.behind) slot.behind = true;
            out.push(slot);
        });
        out.sort((x, y) => (ROW_ORDER[x.row] - ROW_ORDER[y.row]) || ((x.behind ? 0 : 1) - (y.behind ? 0 : 1)) || (x.artLeft - y.artLeft));
        return out;
    }

    return { DEFAULTS, fromConfig, clampTier, resolveTier, sizeOf, resolveDevTier, resolveDevJailTier, resolveDevArmoryTier, resolveDevRadioTier, resolveDevGymTier, resolveDevSchoolTier, resolveDevHospitalTier, resolveDevWaterTowerTier, resolveDevLabTier, fieldWidth, spriteUrl, horizonFeetY, villageSlots };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VillageLayout;
}

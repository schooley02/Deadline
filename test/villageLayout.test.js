/**
 * VillageLayout (V7 W2 first slice, 2026-10-29; re-arranged 2026-11-24): pure placement maths for the village buildings.
 * No DOM. The DOM half is covered in villageView.test.js, shell/wiring in villageWiring.test.js.
 */
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');
const VillageLayout = require('../js/villageLayout.js');

const OPTS = VillageLayout.fromConfig(CONFIG);

describe('fromConfig', () => {
    test('mirrors CONFIG', () => {
        expect(OPTS.spriteWidthPx).toBe(CONFIG.VILLAGE_SPRITE_W_PX);
        expect(OPTS.spriteHeightPx).toBe(CONFIG.VILLAGE_SPRITE_H_PX);
        expect(OPTS.floorHeightPx).toBe(CONFIG.GROUND_FLOOR_HEIGHT);
        expect(OPTS.feetAboveFloorPx).toBe(CONFIG.VILLAGE_FEET_ABOVE_FLOOR_PX);
        expect(OPTS.minFieldPx).toBe(CONFIG.VILLAGE_MIN_FIELD_PX);
        expect(OPTS.tiers).toBe(CONFIG.VILLAGE_TIERS);
    });

    test('DEFAULTS agree with CONFIG so a missing config still places the tower the same way', () => {
        const d = VillageLayout.DEFAULTS;
        expect(d.spriteWidthPx).toBe(CONFIG.VILLAGE_SPRITE_W_PX);
        expect(d.spriteHeightPx).toBe(CONFIG.VILLAGE_SPRITE_H_PX);
        expect(d.floorHeightPx).toBe(CONFIG.GROUND_FLOOR_HEIGHT);
        expect(d.feetAboveFloorPx).toBe(CONFIG.VILLAGE_FEET_ABOVE_FLOOR_PX);
        expect(d.minFieldPx).toBe(CONFIG.VILLAGE_MIN_FIELD_PX);
        expect(d.tiers).toBe(CONFIG.VILLAGE_TIERS);
    });

    test('falls back to the defaults for a missing or junk config', () => {
        expect(VillageLayout.fromConfig(null)).toEqual(VillageLayout.DEFAULTS);
        expect(VillageLayout.fromConfig({ VILLAGE_SPRITE_W_PX: 'x' }).spriteWidthPx).toBe(VillageLayout.DEFAULTS.spriteWidthPx);
    });

    test('a null dev tier means "hidden", not "use the default"', () => {
        expect(VillageLayout.fromConfig({ VILLAGE_DEV_CLOCK_TIER: null }).devClockTier).toBeNull();
    });
});

describe('clampTier', () => {
    test.each([[1, 1], [3, 3], [5, 5], [2.4, 2], [9, 5], ['4', 4]])('%p -> %p', (input, want) => {
        expect(VillageLayout.clampTier(input, 5)).toBe(want);
    });
    test.each([[undefined], [null], [''], [0], [-2], ['abc'], [NaN]])('%p -> null', input => {
        expect(VillageLayout.clampTier(input, 5)).toBeNull();
    });
});

describe('resolveDevTier (dev only: ?villageTier=)', () => {
    test('uses CONFIG.VILLAGE_DEV_CLOCK_TIER when there is no query', () => {
        expect(VillageLayout.resolveDevTier('', OPTS)).toBe(CONFIG.VILLAGE_DEV_CLOCK_TIER);
        expect(VillageLayout.resolveDevTier(undefined, OPTS)).toBe(CONFIG.VILLAGE_DEV_CLOCK_TIER);
    });
    test('the query overrides it, with other params around it', () => {
        expect(VillageLayout.resolveDevTier('?villageTier=5', OPTS)).toBe(5);
        expect(VillageLayout.resolveDevTier('?a=1&villageTier=1&b=2', OPTS)).toBe(1);
    });
    test('out-of-range values clamp; "off" hides', () => {
        expect(VillageLayout.resolveDevTier('?villageTier=9', OPTS)).toBe(5);
        expect(VillageLayout.resolveDevTier('?villageTier=off', OPTS)).toBeNull();
        expect(VillageLayout.resolveDevTier('?villageTier=NONE', OPTS)).toBeNull();
    });
    test('a junk value falls back to the config default; a null config default stays hidden', () => {
        expect(VillageLayout.resolveDevTier('?villageTier=banana', OPTS)).toBe(CONFIG.VILLAGE_DEV_CLOCK_TIER);
        expect(VillageLayout.resolveDevTier('', { ...OPTS, devClockTier: null })).toBeNull();
    });
});

describe('fieldWidth', () => {
    test('walking field = canvas - hill - church', () => {
        expect(VillageLayout.fieldWidth(844, 160, 140)).toBe(544);
    });
    test('never negative', () => {
        expect(VillageLayout.fieldWidth(200, 160, 140)).toBe(0);
    });
});

describe('spriteUrl', () => {
    test('Assets/Village/<kind>_t<tier>.png', () => {
        expect(VillageLayout.spriteUrl('punctuality', 3)).toBe('Assets/Village/punctuality_t3.png');
    });
});

describe('the old tower levers are gone (2026-11-24: the tower is a back-row building)', () => {
    test('no stretch / feet-drop config and no clock-only layout helpers', () => {
        ['VILLAGE_CLOCK_SCALE', 'VILLAGE_CLOCK_ART_H_PX', 'VILLAGE_FEET_MAX_DROP_PX'].forEach(k => expect(CONFIG[k]).toBeUndefined());
        ['clockScale', 'clockArtHeightPx', 'feetMaxDropPx'].forEach(k => expect(OPTS[k]).toBeUndefined());
        expect(VillageLayout.clockScaleFor).toBeUndefined();
        expect(VillageLayout.clockFeetY).toBeUndefined();
    });

    test('the tower is drawn 1:1 at its canvas size on every screen', () => {
        [[800, 306], [844, 334], [1265, 298], [1440, 400]].forEach(([w, h]) => {
            const t = VillageLayout.villageSlots(w, h, 188, 120, { punctuality: 5 }, OPTS)[0];
            expect([t.width, t.height]).toEqual([CONFIG.VILLAGE_SPRITE_W_PX, CONFIG.VILLAGE_SPRITE_H_PX]);
        });
    });
});

describe('shipped sprites', () => {
    function pngSize(file) {
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    }

    test.each([1, 2, 3, 4, 5])('tier %i exists and is the authored 112x208 canvas (three-quarter stone tower, 2026-11-24)', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('punctuality', tier));
        expect(fs.existsSync(file)).toBe(true);
        const { w, h } = pngSize(file);
        expect(w).toBe(CONFIG.VILLAGE_SPRITE_W_PX);
        expect(h).toBe(CONFIG.VILLAGE_SPRITE_H_PX);
    });
});

// ---- Police station (kind `defense`, was the Jailhouse and before that `lurkers`), added 2026-10-29; redrawn 160x160 three-quarter 2026-11-14 ----
describe('Police station config', () => {
    test('fromConfig mirrors the jail CONFIG and DEFAULTS agree with it', () => {
        expect(OPTS.jailWidthPx).toBe(CONFIG.VILLAGE_JAIL_W_PX);
        expect(OPTS.jailHeightPx).toBe(CONFIG.VILLAGE_JAIL_H_PX);
        expect(OPTS.devJailTier).toBe(CONFIG.VILLAGE_DEV_JAIL_TIER);
        const d = VillageLayout.DEFAULTS;
        expect(d.jailWidthPx).toBe(CONFIG.VILLAGE_JAIL_W_PX);
        expect(d.jailHeightPx).toBe(CONFIG.VILLAGE_JAIL_H_PX);
        expect(d.devJailTier).toBe(CONFIG.VILLAGE_DEV_JAIL_TIER);
    });

    test('a null dev jail tier means "hidden"', () => {
        expect(VillageLayout.fromConfig({ VILLAGE_DEV_JAIL_TIER: null }).devJailTier).toBeNull();
    });

    test('the Police station is the Village 2.0 Square class (160x160) and shorter than the tower (the tower stays the landmark)', () => {
        expect(CONFIG.VILLAGE_JAIL_W_PX).toBe(160);
        expect(CONFIG.VILLAGE_JAIL_H_PX).toBe(160);
        expect(CONFIG.VILLAGE_JAIL_H_PX).toBeLessThan(CONFIG.VILLAGE_SPRITE_H_PX);
        expect([CONFIG.VILLAGE_SPRITE_W_PX, CONFIG.VILLAGE_SPRITE_H_PX]).toEqual([112, 208]); // back-row Narrow tall class
    });
});

describe('resolveDevJailTier (dev only: ?jailTier=)', () => {
    test('uses CONFIG.VILLAGE_DEV_JAIL_TIER with no query; the query overrides it', () => {
        expect(VillageLayout.resolveDevJailTier('', OPTS)).toBe(CONFIG.VILLAGE_DEV_JAIL_TIER);
        expect(VillageLayout.resolveDevJailTier('?jailTier=5', OPTS)).toBe(5);
        expect(VillageLayout.resolveDevJailTier('?a=1&jailTier=2&b=2', OPTS)).toBe(2);
    });
    test('clamps, "off" hides, junk falls back', () => {
        expect(VillageLayout.resolveDevJailTier('?jailTier=9', OPTS)).toBe(5);
        expect(VillageLayout.resolveDevJailTier('?jailTier=off', OPTS)).toBeNull();
        expect(VillageLayout.resolveDevJailTier('?jailTier=banana', OPTS)).toBe(CONFIG.VILLAGE_DEV_JAIL_TIER);
        expect(VillageLayout.resolveDevJailTier('', { ...OPTS, devJailTier: null })).toBeNull();
    });
    test('the two dev params are independent', () => {
        expect(VillageLayout.resolveDevTier('?jailTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_CLOCK_TIER);
        expect(VillageLayout.resolveDevJailTier('?villageTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_JAIL_TIER);
    });
});


describe('villageSlots', () => {
    const slots = (canvasW, canvasH, tiers, baseW = 160, hillW = 120) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, OPTS);


    test('either building can be shown alone; no tiers or portrait strip = nothing', () => {
        expect(slots(844, 334, { defense: 2 }).map(x => x.kind)).toEqual(['defense']);
        expect(slots(844, 334, { punctuality: 2 }).map(x => x.kind)).toEqual(['punctuality']);
        expect(slots(844, 334, {})).toEqual([]);
        expect(slots(844, 334, undefined)).toEqual([]);
        expect(slots(844, 334, { punctuality: 3, defense: 3 }, 160, 0)).toEqual([]);
    });

});

describe('shipped jail sprites', () => {
    test.each([1, 2, 3, 4, 5])('defense (Police station) tier %i exists and is the authored 160x160 canvas', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('defense', tier));
        expect(fs.existsSync(file)).toBe(true);
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        expect(b.readUInt32BE(16)).toBe(CONFIG.VILLAGE_JAIL_W_PX);
        expect(b.readUInt32BE(20)).toBe(CONFIG.VILLAGE_JAIL_H_PX);
    });
});

describe('Clock tower `drop` and `sink` (2026-11-24): the tower stands beside the Police station on every screen, and lower still only on a canvas too short for it', () => {
    const base = h => h - CONFIG.GROUND_FLOOR_HEIGHT - CONFIG.VILLAGE_FEET_ABOVE_FLOOR_PX;
    const H = CONFIG.VILLAGE_SPRITE_H_PX;
    const RAISE = CONFIG.VILLAGE_BACK_ROW_RAISE_PX;
    const DROP = CONFIG.VILLAGE_PLACEMENT.punctuality.drop; // 26: the tower always stands this far below the back row's line
    const STATION_UP = CONFIG.VILLAGE_PLACEMENT.defense.raise; // 12
    const tower = (h, opts = OPTS, tiers = { punctuality: 5 }, w = 800, baseW = 188) => VillageLayout.villageSlots(w, h, baseW, 120, tiers, opts).find(x => x.kind === 'punctuality');
    const withP = extra => ({ ...OPTS, placement: { ...OPTS.placement, punctuality: { ...OPTS.placement.punctuality, ...extra } } });
    const withSink = sink => withP({ sink });

    test('the tower is a back-row building that always stands 26px lower than its row', () => {
        expect(CONFIG.VILLAGE_PLACEMENT.punctuality).toEqual({ row: 'back', right: -240, drop: 26, sink: 34, overTop: 12 });
        expect(DROP + CONFIG.VILLAGE_PLACEMENT.punctuality.sink).toBeLessThanOrEqual(RAISE);
    });

    test('800x360 phone (canvas 306), mock-up "option 3": feet 196, roof tip cut 12px, no sink needed', () => {
        const t = tower(306);
        expect(t.row).toBe('back');
        expect(t.drop).toBe(26);
        expect(t.raise).toBeUndefined();
        expect(t.sink).toBeUndefined();
        expect(t.top).toBe(-12);
        expect(t.top + H).toBe(196);
        expect(t.feetY).toBe(base(306) - RAISE); // feetY stays the row's horizon (the haze plan reads it)
    });

    test('Jeremy 2026-11-24 ("closer to the station"): on EVERY screen from the phone up, the tower\'s feet are 22px above the raised Police station\'s (34 above the front row\'s)', () => {
        [[800, 306, 188], [1024, 398, 300], [1280, 344, 368], [1440, 420, 368], [1920, 700, 368]].forEach(([w, h, baseW]) => {
            const s = VillageLayout.villageSlots(w, h, baseW, 120, { punctuality: 5, defense: 5 }, OPTS);
            const t = s.find(x => x.kind === 'punctuality');
            const d = s.find(x => x.kind === 'defense');
            expect(t.sink).toBeUndefined();
            expect((d.top + d.height) - (t.top + t.height)).toBe(RAISE - DROP - STATION_UP);
            expect(RAISE - DROP - STATION_UP).toBe(22);
            expect(base(h) - (t.top + t.height)).toBe(34);
        });
    });

    test('`drop` never puts a building below the front row\'s feet; missing, negative or junk means none', () => {
        const deep = tower(400, withP({ drop: 500 }));
        expect(deep.drop).toBe(RAISE);
        expect(deep.top + H).toBe(base(400));
        [undefined, -5, 'x', NaN, 0].forEach((v) => {
            const t = tower(400, withP({ drop: v }));
            expect(t.drop).toBeUndefined();
            expect(t.top).toBe(t.feetY - H);
        });
    });

    test('a canvas shorter than the phone\'s: at most the 12px roof tip is cut, and the tower sinks no further than it must', () => {
        [280, 296, 298, 304, 306, 320, 356].forEach((h) => {
            const t = tower(h);
            expect(t.top).toBe(Math.max(-12, base(h) - RAISE + DROP - H));
        });
        expect(tower(306).sink).toBeUndefined(); // exactly the allowance
        expect(tower(305).sink).toBe(1);
        expect(tower(296).sink).toBe(10);
    });

    test('`overTop` 0 (or junk) means the whole canvas must fit: the tower sinks until its roof touches the top', () => {
        [0, undefined, -4, 'x'].forEach((v) => {
            const t = tower(306, withP({ overTop: v }));
            expect(t.sink).toBe(12);
            expect(t.top).toBe(0);
        });
    });

    test('it never sinks more than its `sink`, and never below the front row\'s feet', () => {
        expect(tower(290, withSink(10)).top).toBe(-18); // 16 wanted, 10 allowed: the top 18px run off the screen
        const short = tower(240, withSink(200)); // 164px of sky: even on the front row's line the roof is cut
        expect(short.sink).toBe(RAISE - DROP);
        expect(short.top + H).toBe(base(240)); // its lowest row is on the front row's feet, not below them
    });

    test('a missing, negative or junk `sink` means no sink', () => {
        [undefined, -5, 'x', NaN, 0].forEach((v) => {
            const t = tower(290, withSink(v));
            expect(t.sink).toBeUndefined();
            expect(t.top).toBe(t.feetY - H + DROP);
        });
    });

    test('only the tower drops or sinks; its neighbours keep their row, with or without it', () => {
        const ALL = { punctuality: 3, defense: 3, slain: 3, lurkers: 3, heroes: 3, habits: 3 };
        const s = VillageLayout.villageSlots(800, 306, 188, 120, ALL, OPTS);
        s.filter(x => x.kind !== 'punctuality').forEach((x) => {
            expect(x.sink).toBeUndefined();
            expect(x.drop).toBeUndefined();
            expect(x.top).toBe(x.feetY - x.height - (x.raise || 0));
        });
        const without = VillageLayout.villageSlots(800, 306, 188, 120, { ...ALL, punctuality: null }, OPTS);
        expect(s.filter(x => x.kind !== 'punctuality')).toEqual(without);
    });

    test('the front row stands on the plain horizon, tower or not', () => {
        const s = VillageLayout.villageSlots(1265, 298, 160, 120, { punctuality: 3, defense: 3 }, OPTS);
        expect(s.find(x => x.kind === 'defense').feetY).toBe(base(298));
        expect(VillageLayout.villageSlots(1265, 298, 160, 120, { defense: 3 }, OPTS)[0].feetY).toBe(base(298));
    });
});

// ---- Armory (kind `slain`), added 2026-10-29: survivor army camp, right of the tower ----
describe('Armory', () => {
    const slots = (canvasW, canvasH, tiers, baseW = 160, hillW = 120) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, OPTS);
    const ALL = { punctuality: 3, defense: 3, slain: 3 };

    test('fromConfig mirrors the armory CONFIG and DEFAULTS agree with it', () => {
        const d = VillageLayout.DEFAULTS;
        expect(OPTS.armoryWidthPx).toBe(CONFIG.VILLAGE_ARMORY_W_PX);
        expect(OPTS.armoryHeightPx).toBe(CONFIG.VILLAGE_ARMORY_H_PX);
        expect(OPTS.devArmoryTier).toBe(CONFIG.VILLAGE_DEV_ARMORY_TIER);
        expect(d.armoryWidthPx).toBe(CONFIG.VILLAGE_ARMORY_W_PX);
        expect(d.armoryHeightPx).toBe(CONFIG.VILLAGE_ARMORY_H_PX);
        expect(d.devArmoryTier).toBe(CONFIG.VILLAGE_DEV_ARMORY_TIER);
        expect(VillageLayout.fromConfig({ VILLAGE_DEV_ARMORY_TIER: null }).devArmoryTier).toBeNull();
    });


    test('resolveDevArmoryTier reads only ?armoryTier=', () => {
        expect(VillageLayout.resolveDevArmoryTier('', OPTS)).toBe(CONFIG.VILLAGE_DEV_ARMORY_TIER);
        expect(VillageLayout.resolveDevArmoryTier('?armoryTier=5', OPTS)).toBe(5);
        expect(VillageLayout.resolveDevArmoryTier('?a=1&armoryTier=1', OPTS)).toBe(1);
        expect(VillageLayout.resolveDevArmoryTier('?armoryTier=9', OPTS)).toBe(5);
        expect(VillageLayout.resolveDevArmoryTier('?armoryTier=off', OPTS)).toBeNull();
        expect(VillageLayout.resolveDevArmoryTier('?jailTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_ARMORY_TIER);
        expect(VillageLayout.resolveDevJailTier('?armoryTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_JAIL_TIER);
        expect(VillageLayout.resolveDevArmoryTier('', { ...OPTS, devArmoryTier: null })).toBeNull();
    });


    test('adding the armory never moves another building', () => {
        const without = slots(844, 334, { punctuality: 4, defense: 4 });
        const withArmory = slots(844, 334, { punctuality: 4, defense: 4, slain: 4 }).filter(x => x.kind !== 'slain');
        expect(withArmory).toEqual(without);
    });

    test('the armory can show alone', () => {
        expect(slots(844, 334, { slain: 2 }).map(x => x.kind)).toEqual(['slain']);
    });

    test.each([1, 2, 3, 4, 5])('shipped slain tier %i exists and is the authored 160x160 canvas (3/4 Command Post art, 2026-11-15)', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('slain', tier));
        expect(fs.existsSync(file)).toBe(true);
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        expect(b.readUInt32BE(16)).toBe(CONFIG.VILLAGE_ARMORY_W_PX);
        expect(b.readUInt32BE(20)).toBe(CONFIG.VILLAGE_ARMORY_H_PX);
    });
});

// ---- Radio tower (kind `nights`, a BACK-ROW building), added 2026-10-29 ----
describe('Radio tower (back row)', () => {
    const slots = (canvasW, canvasH, tiers, baseW = 160, hillW = 120, opts = OPTS) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts);
    const FRONT = { punctuality: 3, defense: 3, slain: 3 };
    const ALL = { ...FRONT, nights: 3 };
    const SIZES = [[844, 334], [915, 356], [1265, 298], [1100, 320]];

    test('fromConfig mirrors the radio + back-row CONFIG and DEFAULTS agree with it', () => {
        const d = VillageLayout.DEFAULTS;
        expect(OPTS.radioWidthPx).toBe(CONFIG.VILLAGE_RADIO_W_PX);
        expect(OPTS.radioHeightPx).toBe(CONFIG.VILLAGE_RADIO_H_PX);
        expect(OPTS.devRadioTier).toBe(CONFIG.VILLAGE_DEV_RADIO_TIER);
        expect(OPTS.backRowRaisePx).toBe(CONFIG.VILLAGE_BACK_ROW_RAISE_PX);
        expect(OPTS.backRowBrightness).toBe(CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS);
        expect(d.radioWidthPx).toBe(CONFIG.VILLAGE_RADIO_W_PX);
        expect(d.radioHeightPx).toBe(CONFIG.VILLAGE_RADIO_H_PX);
        expect(d.devRadioTier).toBe(CONFIG.VILLAGE_DEV_RADIO_TIER);
        expect(d.backRowRaisePx).toBe(CONFIG.VILLAGE_BACK_ROW_RAISE_PX);
        expect(d.backRowBrightness).toBe(CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS);
        expect(VillageLayout.fromConfig({ VILLAGE_DEV_RADIO_TIER: null }).devRadioTier).toBeNull();
    });


    test('resolveDevRadioTier reads only ?radioTier=', () => {
        expect(VillageLayout.resolveDevRadioTier('', OPTS)).toBe(CONFIG.VILLAGE_DEV_RADIO_TIER);
        expect(VillageLayout.resolveDevRadioTier('?radioTier=5', OPTS)).toBe(5);
        expect(VillageLayout.resolveDevRadioTier('?a=1&radioTier=1', OPTS)).toBe(1);
        expect(VillageLayout.resolveDevRadioTier('?radioTier=9', OPTS)).toBe(5);
        expect(VillageLayout.resolveDevRadioTier('?radioTier=off', OPTS)).toBeNull();
        expect(VillageLayout.resolveDevRadioTier('?armoryTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_RADIO_TIER);
        expect(VillageLayout.resolveDevArmoryTier('?radioTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_ARMORY_TIER);
        expect(VillageLayout.resolveDevRadioTier('', { ...OPTS, devRadioTier: null })).toBeNull();
    });



    test('adding the radio never moves another building', () => {
        const without = slots(844, 334, FRONT);
        const withRadio = slots(844, 334, ALL).filter(x => x.kind !== 'nights');
        expect(withRadio).toEqual(without);
    });

    test('the radio can show alone; portrait strip or no tier = nothing; an unknown kind key places nothing', () => {
        expect(slots(844, 334, { nights: 2 }).map(x => x.kind)).toEqual(['nights']);
        expect(slots(844, 334, { nights: 3 }, 160, 0)).toEqual([]);
        expect(slots(844, 334, { barn: 3 })).toEqual([]);
    });

    test.each([1, 2, 3, 4, 5])('shipped nights tier %i exists and is the authored 144x208 canvas (Broadcast tower, 2026-11-24)', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('nights', tier));
        expect(fs.existsSync(file)).toBe(true);
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        expect(b.readUInt32BE(16)).toBe(CONFIG.VILLAGE_RADIO_W_PX);
        expect(b.readUInt32BE(20)).toBe(CONFIG.VILLAGE_RADIO_H_PX);
    });
});

// ---- Gym (kind `lurkers` = willpower, a FRONT-row building), added 2026-10-30 ----
describe('Gym (front row) + art-box collision', () => {
    const slots = (canvasW, canvasH, tiers, baseW = 160, hillW = 120, opts = OPTS) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts);
    const FOUR = { punctuality: 3, defense: 3, slain: 3, lurkers: 3 };
    const ALL = { ...FOUR, nights: 3 };
    const SIZES = [[844, 334], [915, 356], [1265, 298], [1100, 320], [800, 334], [1440, 400]];
    const art = slots => slots.map(s => [s.artLeft, s.artRight]);

    test('fromConfig mirrors the gym + art-extent CONFIG and DEFAULTS agree with it', () => {
        const d = VillageLayout.DEFAULTS;
        expect(OPTS.gymWidthPx).toBe(CONFIG.VILLAGE_GYM_W_PX);
        expect(OPTS.gymHeightPx).toBe(CONFIG.VILLAGE_GYM_H_PX);
        expect(OPTS.devGymTier).toBe(CONFIG.VILLAGE_DEV_GYM_TIER);
        expect(OPTS.art).toEqual(CONFIG.VILLAGE_ART_X);
        expect(d.gymWidthPx).toBe(CONFIG.VILLAGE_GYM_W_PX);
        expect(d.gymHeightPx).toBe(CONFIG.VILLAGE_GYM_H_PX);
        expect(d.devGymTier).toBe(CONFIG.VILLAGE_DEV_GYM_TIER);
        expect(d.art).toEqual(CONFIG.VILLAGE_ART_X);
        expect(VillageLayout.fromConfig({ VILLAGE_DEV_GYM_TIER: null }).devGymTier).toBeNull();
        expect(VillageLayout.fromConfig({ VILLAGE_ART_X: 'junk' }).art).toEqual(d.art);
    });

    test('every kind has an art extent inside its canvas', () => {
        ['punctuality', 'defense', 'slain', 'nights', 'lurkers', 'heroes', 'habits', 'bestdays', 'goals'].forEach(k => {
            const [l, r] = CONFIG.VILLAGE_ART_X[k];
            expect(l).toBeGreaterThanOrEqual(0);
            expect(r).toBeGreaterThan(l);
            expect(r).toBeLessThanOrEqual(VillageLayout.sizeOf(k, OPTS)[0]); // canvas width of THAT kind (the Gym is 192 wide since 2026-11-14)
        });
    });


    test('Police station (2026-11-14): art extent is the union of the five 160x160 tiers, measured from the PNGs', () => {
        expect(CONFIG.VILLAGE_ART_X.defense).toEqual([3, 160]); // [first opaque column, last opaque column + 1); T4/T5 reach x 159, so 0 px margin on the right (approved by Jeremy)
    });

    test('Police station `raise`: stands the sprite 12px further back than the front row, feet / haze line unchanged (kept in the 2026-11-24 re-arrangement, Jeremy)', () => {
        expect(CONFIG.VILLAGE_PLACEMENT.defense.raise).toBe(12);
        const s = Object.fromEntries(VillageLayout.villageSlots(817, 296, 160, 120, { punctuality: 3, defense: 3, lurkers: 3 }, OPTS).map(x => [x.kind, x]));
        expect(s.defense.feetY).toBe(s.lurkers.feetY); // feetY stays the row's horizon (the haze plan reads it)
        expect(s.defense.top).toBe(s.defense.feetY - s.defense.height - 12);
        expect(s.defense.raise).toBe(12);
        expect(s.lurkers.raise).toBeUndefined(); // other buildings are untouched
        expect(s.lurkers.top).toBe(s.lurkers.feetY - s.lurkers.height);
    });

    test('a missing, negative or junk `raise` means no raise', () => {
        [undefined, -5, 'x', NaN].forEach(r => {
            const o = { ...OPTS, placement: { defense: { row: 'front', right: -24, raise: r } } };
            const [d] = VillageLayout.villageSlots(817, 296, 160, 120, { defense: 3 }, o);
            expect(d.top).toBe(d.feetY - d.height);
            expect(d.raise).toBeUndefined();
        });
    });

    test('the Gym and the Police station leave a gap that shows the Clock tower (800, 817, 844 wide)', () => {
        [800, 817, 844].forEach(w => {
            const s = Object.fromEntries(VillageLayout.villageSlots(w, 306, 188, 120, { punctuality: 3, defense: 3, lurkers: 3 }, OPTS).map(x => [x.kind, x]));
            expect(s.defense).toBeDefined(); // never dropped
            expect(s.defense.artLeft - s.lurkers.artRight).toBeGreaterThanOrEqual(40);
            // the tower's art spans the gap (its door is in it; its sides pass behind the two front buildings)
            expect(s.punctuality.artLeft).toBeLessThanOrEqual(s.lurkers.artRight);
            expect(s.punctuality.artRight).toBeGreaterThanOrEqual(s.defense.artLeft);
        });
    });

    test('resolveDevGymTier reads only ?gymTier=', () => {
        expect(VillageLayout.resolveDevGymTier('', OPTS)).toBe(CONFIG.VILLAGE_DEV_GYM_TIER);
        expect(VillageLayout.resolveDevGymTier('?gymTier=5', OPTS)).toBe(5);
        expect(VillageLayout.resolveDevGymTier('?a=1&gymTier=1', OPTS)).toBe(1);
        expect(VillageLayout.resolveDevGymTier('?gymTier=9', OPTS)).toBe(5);
        expect(VillageLayout.resolveDevGymTier('?gymTier=off', OPTS)).toBeNull();
        expect(VillageLayout.resolveDevGymTier('?radioTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_GYM_TIER);
        expect(VillageLayout.resolveDevRadioTier('?gymTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_RADIO_TIER);
        expect(VillageLayout.resolveDevGymTier('', { ...OPTS, devGymTier: null })).toBeNull();
    });


    test('the gym stands on the horizon, the front row\'s line, on every canvas', () => {
        const desk = slots(1265, 298, ALL);
        expect(desk.find(x => x.kind === 'lurkers').feetY).toBe(298 - CONFIG.GROUND_FLOOR_HEIGHT - CONFIG.VILLAGE_FEET_ABOVE_FLOOR_PX);
        expect(slots(844, 334, { lurkers: 2 })[0].feetY).toBe(334 - CONFIG.GROUND_FLOOR_HEIGHT - CONFIG.VILLAGE_FEET_ABOVE_FLOOR_PX);
    });

    test('adding the gym never moves or drops another building (every width)', () => {
        [[640, 334], [700, 334], [760, 334], [800, 334], ...SIZES].forEach(([w, h]) => {
            const without = slots(w, h, { ...ALL, lurkers: null });
            const withGym = slots(w, h, ALL).filter(x => x.kind !== 'lurkers');
            expect(withGym).toEqual(without);
        });
    });

    test('the gym can show alone; portrait strip or no tier = nothing', () => {
        expect(slots(844, 334, { lurkers: 2 }).map(x => x.kind)).toEqual(['lurkers']);
        expect(slots(844, 334, { lurkers: 3 }, 160, 0)).toEqual([]);
        expect(slots(844, 334, {})).toEqual([]);
    });

    test.each([1, 2, 3, 4, 5])('shipped lurkers tier %i exists and is the authored 128x128 canvas', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('lurkers', tier));
        expect(fs.existsSync(file)).toBe(true);
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        expect(b.readUInt32BE(16)).toBe(CONFIG.VILLAGE_GYM_W_PX);
        expect(b.readUInt32BE(20)).toBe(CONFIG.VILLAGE_GYM_H_PX);
    });

    // CONFIG.VILLAGE_ART_X must match the real sprites: the union over the five tiers of each kind's visible columns.
    let PNG = null;
    try { PNG = require('pngjs').PNG; } catch (e) { PNG = null; }
    (PNG ? test : test.skip).each(['punctuality', 'defense', 'slain', 'nights', 'lurkers', 'heroes', 'habits', 'bestdays', 'goals'])(
        'CONFIG.VILLAGE_ART_X.%s equals the union of its five tiers\' visible columns (measured from the PNGs)', kind => {
            let lo = Infinity, hi = -Infinity;
            [1, 2, 3, 4, 5].forEach(t => {
                const png = PNG.sync.read(fs.readFileSync(path.join(__dirname, '..', VillageLayout.spriteUrl(kind, t))));
                for (let y = 0; y < png.height; y++) {
                    for (let x = 0; x < png.width; x++) {
                        if (png.data[(y * png.width + x) * 4 + 3] > 0) { lo = Math.min(lo, x); hi = Math.max(hi, x + 1); }
                    }
                }
            });
            expect(CONFIG.VILLAGE_ART_X[kind]).toEqual([lo, hi]);
        });
});

// ---- High school (kind `heroes`, a BACK-ROW building between the tower and the gym), added 2026-10-30 ----
describe('High school (back row)', () => {
    const slots = (canvasW, canvasH, tiers, baseW = 160, hillW = 120, opts = OPTS) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts);
    const FIVE = { punctuality: 3, defense: 3, slain: 3, lurkers: 3, nights: 3 };
    const ALL = { ...FIVE, heroes: 3 };
    const SIZES = [[844, 334], [915, 356], [1265, 298], [1100, 320], [1440, 400]];
    const ov = (a, b) => Math.max(0, Math.min(a.artRight, b.artRight) - Math.max(a.artLeft, b.artLeft));

    test('fromConfig mirrors the school CONFIG and DEFAULTS agree with it', () => {
        const d = VillageLayout.DEFAULTS;
        ['schoolWidthPx', 'schoolHeightPx', 'devSchoolTier'].forEach(k => expect(OPTS[k]).toBe(d[k]));
        expect(OPTS.schoolWidthPx).toBe(CONFIG.VILLAGE_SCHOOL_W_PX);
        expect(OPTS.schoolHeightPx).toBe(CONFIG.VILLAGE_SCHOOL_H_PX);
        expect(OPTS.devSchoolTier).toBe(CONFIG.VILLAGE_DEV_SCHOOL_TIER);
        expect(d.backRowRaisePx).toBe(CONFIG.VILLAGE_BACK_ROW_RAISE_PX);
        expect(VillageLayout.fromConfig({ VILLAGE_DEV_SCHOOL_TIER: null }).devSchoolTier).toBeNull();
    });

    test('resolveDevSchoolTier reads only ?schoolTier=', () => {
        expect(VillageLayout.resolveDevSchoolTier('', OPTS)).toBe(CONFIG.VILLAGE_DEV_SCHOOL_TIER);
        expect(VillageLayout.resolveDevSchoolTier('?schoolTier=1', OPTS)).toBe(1);
        expect(VillageLayout.resolveDevSchoolTier('?a=2&schoolTier=5', OPTS)).toBe(5);
        expect(VillageLayout.resolveDevSchoolTier('?schoolTier=off', OPTS)).toBeNull();
        expect(VillageLayout.resolveDevSchoolTier('?gymTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_SCHOOL_TIER);
        expect(VillageLayout.resolveDevGymTier('?schoolTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_GYM_TIER);
    });


    test('the 3/4 High school is the 176x144 canvas with 174px of visible art [0,174], authored for the back row (2026-11-18 redraw; was 160x128 [2,158])', () => {
        expect(CONFIG.VILLAGE_SCHOOL_W_PX).toBe(176);
        expect(CONFIG.VILLAGE_SCHOOL_H_PX).toBe(144);
        expect(CONFIG.VILLAGE_ART_X.heroes).toEqual([0, 174]);
        expect(VillageLayout.DEFAULTS.art.heroes).toEqual([0, 174]);
        expect(CONFIG.VILLAGE_PLACEMENT.heroes).toEqual({ row: 'back', right: 20 }); // 2026-11-24 re-arrangement: right end of the back row, 12px short of the moon at 800
        const s = slots(844, 334, { heroes: 3 }).find(x => x.kind === 'heroes');
        expect([s.width, s.height]).toEqual([176, 144]);
        expect(s.artRight - s.artLeft).toBe(174);
    });

    test('adding the school never moves or drops another building (every width)', () => {
        [[640, 334], [700, 334], [760, 334], [800, 334], ...SIZES].forEach(([w, h]) => {
            const without = slots(w, h, FIVE);
            const withSchool = slots(w, h, ALL).filter(x => x.kind !== 'heroes');
            expect(withSchool).toEqual(without);
        });
    });

    test('it can show alone; portrait strip or no tier = nothing', () => {
        expect(slots(844, 334, { heroes: 2 }).map(x => x.kind)).toEqual(['heroes']);
        expect(slots(844, 334, { heroes: 3 }, 160, 0)).toEqual([]);
    });

    test('every back-row building fits under the canvas top on the short canvases (back row 60px up since 2026-11-24)', () => {
        // The FAR row (Water tower + Broadcast tower, 95px up) is sunk by `sink` on short canvases (own tests below); it is not checked here.
        [[1265, 298], [1280, 298], [844, 334], [800, 306], [800, 296]].forEach(([w, h]) => {
            slots(w, h, ALL).filter(x => x.row === 'back').forEach(b => expect(b.top).toBeGreaterThanOrEqual(b.kind === 'punctuality' ? -CONFIG.VILLAGE_PLACEMENT.punctuality.overTop : 0));
        });
    });

    test.each([1, 2, 3, 4, 5])('shipped heroes tier %i exists and is the authored 176x144 canvas', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('heroes', tier));
        expect(fs.existsSync(file)).toBe(true);
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        expect(b.readUInt32BE(16)).toBe(CONFIG.VILLAGE_SCHOOL_W_PX);
        expect(b.readUInt32BE(20)).toBe(CONFIG.VILLAGE_SCHOOL_H_PX);
    });
});

// ---- Hospital (kind `habits`, a BACK-ROW building between the gym and the Armory), added 2026-10-30 (placeholder art) ----
describe('Hospital (back row)', () => {
    const slots = (canvasW, canvasH, tiers, baseW = 160, hillW = 120, opts = OPTS) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts);
    const SIX = { punctuality: 3, defense: 3, slain: 3, lurkers: 3, nights: 3, heroes: 3 };
    const ALL = { ...SIX, habits: 3 };
    const SIZES = [[844, 334], [915, 356], [1265, 298], [1100, 320], [1440, 400]];
    const ov = (a, b) => Math.max(0, Math.min(a.artRight, b.artRight) - Math.max(a.artLeft, b.artLeft));

    test('fromConfig mirrors the hospital CONFIG and DEFAULTS agree with it', () => {
        const d = VillageLayout.DEFAULTS;
        ['hospitalWidthPx', 'hospitalHeightPx', 'devHospitalTier'].forEach(k => expect(OPTS[k]).toBe(d[k]));
        expect(OPTS.hospitalWidthPx).toBe(CONFIG.VILLAGE_HOSPITAL_W_PX);
        expect(OPTS.hospitalHeightPx).toBe(CONFIG.VILLAGE_HOSPITAL_H_PX);
        expect(OPTS.devHospitalTier).toBe(CONFIG.VILLAGE_DEV_HOSPITAL_TIER);
        expect(VillageLayout.fromConfig({ VILLAGE_DEV_HOSPITAL_TIER: null }).devHospitalTier).toBeNull();
    });

    test('resolveDevHospitalTier reads only ?hospitalTier=', () => {
        expect(VillageLayout.resolveDevHospitalTier('', OPTS)).toBe(CONFIG.VILLAGE_DEV_HOSPITAL_TIER);
        expect(VillageLayout.resolveDevHospitalTier('?hospitalTier=1', OPTS)).toBe(1);
        expect(VillageLayout.resolveDevHospitalTier('?a=2&hospitalTier=5', OPTS)).toBe(5);
        expect(VillageLayout.resolveDevHospitalTier('?hospitalTier=off', OPTS)).toBeNull();
        expect(VillageLayout.resolveDevHospitalTier('?schoolTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_HOSPITAL_TIER);
    });


    test('adding the hospital never moves or drops another building (every width)', () => {
        [[640, 334], [700, 334], [760, 334], [800, 334], ...SIZES].forEach(([w, h]) => {
            const without = slots(w, h, SIX);
            const withIt = slots(w, h, ALL).filter(x => x.kind !== 'habits');
            expect(withIt).toEqual(without);
        });
    });

    test.each([1, 2, 3, 4, 5])('shipped habits tier %i exists and is the authored 176x144 canvas (3/4 Hospital, 2026-11-19 redraw)', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('habits', tier));
        expect(fs.existsSync(file)).toBe(true);
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        expect(b.readUInt32BE(16)).toBe(CONFIG.VILLAGE_HOSPITAL_W_PX);
        expect(b.readUInt32BE(20)).toBe(CONFIG.VILLAGE_HOSPITAL_H_PX);
    });

    // 3/4 Hospital (2026-11-15): Wide 160x128 canvas, art x [6,159]. 2026-11-19: redrawn at 176x144 (Jeremy's PixelLab-cleaned finals), art x [1,174]
    // (union of the five tiers, also pinned by the ART_X test above); the art right edge stays put (`right` -320), so it grows 20px to the left.
    test('the Hospital canvas is 176x144 and its art extent is [1, 174]', () => {
        expect([CONFIG.VILLAGE_HOSPITAL_W_PX, CONFIG.VILLAGE_HOSPITAL_H_PX]).toEqual([176, 144]);
        expect(CONFIG.VILLAGE_ART_X.habits).toEqual([1, 174]);
        expect(VillageLayout.DEFAULTS.art.habits).toEqual([1, 174]);
    });

    // 2026-11-24 re-arrangement: the Hospital is the LEFT end of the back row (behind the Gym) and the High school the right end, with the Clock tower
    // between them, so the two never meet.
    test('the Hospital and the High school are never dropped and never overlap (640 wide up)', () => {
        [[640, 334], [700, 334], [760, 334], [800, 334], ...SIZES].forEach(([w, h]) => {
            const s = slots(w, h, ALL);
            const hospital = s.find(x => x.kind === 'habits'), school = s.find(x => x.kind === 'heroes');
            expect(hospital).toBeDefined();
            expect(hospital.row).toBe('back');
            expect(hospital.artRight - hospital.artLeft).toBe(173);
            expect(hospital.artRight).toBeLessThanOrEqual(school.artLeft);
        });
    });

    test('800 wide: the Hospital\'s ER end (the ambulance) shows right of the Gym, and the tower covers at most its last 12px', () => {
        const s = Object.fromEntries(VillageLayout.villageSlots(800, 306, 188, 120, ALL, OPTS).map(x => [x.kind, x]));
        expect(s.habits.artRight - s.lurkers.artRight).toBeGreaterThanOrEqual(7); // with the Gym's T5 extras; 22px below T5
        expect(s.habits.artRight - s.punctuality.artLeft).toBeLessThanOrEqual(12); // the tower's art box includes T1's bent lamp; T2-T5 start 10px further right
    });
});

// ---- Water tower (kind `bestdays`), the first FAR-ROW building (windmill placeholder 2026-10-30; Water tower wired 2026-11-25) ----
describe('Water tower (far row)', () => {
    const slots = (canvasW, canvasH, tiers, baseW = 160, hillW = 120, opts = OPTS) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts);
    const SEVEN = { punctuality: 3, defense: 3, slain: 3, lurkers: 3, nights: 3, heroes: 3, habits: 3 };
    const ALL = { ...SEVEN, bestdays: 3 };
    const SIZES = [[844, 334], [915, 356], [1265, 298], [1100, 320], [1440, 400]];
    const ov = (a, b) => Math.max(0, Math.min(a.artRight, b.artRight) - Math.max(a.artLeft, b.artLeft));

    test('fromConfig mirrors the Water tower + far-row CONFIG and DEFAULTS agree with it', () => {
        const d = VillageLayout.DEFAULTS;
        ['waterTowerWidthPx', 'waterTowerHeightPx', 'devWaterTowerTier', 'farRowRaisePx', 'farRowBrightness'].forEach(k => expect(OPTS[k]).toBe(d[k]));
        expect(OPTS.waterTowerWidthPx).toBe(CONFIG.VILLAGE_WATERTOWER_W_PX);
        expect(OPTS.waterTowerHeightPx).toBe(CONFIG.VILLAGE_WATERTOWER_H_PX);
        expect(OPTS.devWaterTowerTier).toBe(CONFIG.VILLAGE_DEV_WATERTOWER_TIER);
        expect(OPTS.farRowRaisePx).toBe(CONFIG.VILLAGE_FAR_ROW_RAISE_PX);
        expect(OPTS.farRowBrightness).toBe(CONFIG.VILLAGE_FAR_ROW_BRIGHTNESS);
        expect(CONFIG.VILLAGE_FAR_ROW_BRIGHTNESS).toBeLessThan(CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS);
        expect(VillageLayout.fromConfig({ VILLAGE_DEV_WATERTOWER_TIER: null }).devWaterTowerTier).toBeNull();
    });

    test('resolveDevWaterTowerTier reads only ?waterTowerTier=', () => {
        expect(VillageLayout.resolveDevWaterTowerTier('', OPTS)).toBe(CONFIG.VILLAGE_DEV_WATERTOWER_TIER);
        expect(VillageLayout.resolveDevWaterTowerTier('?waterTowerTier=1', OPTS)).toBe(1);
        expect(VillageLayout.resolveDevWaterTowerTier('?a=2&waterTowerTier=5', OPTS)).toBe(5);
        expect(VillageLayout.resolveDevWaterTowerTier('?waterTowerTier=off', OPTS)).toBeNull();
        expect(VillageLayout.resolveDevWaterTowerTier('?hospitalTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_WATERTOWER_TIER);
        expect(VillageLayout.resolveDevHospitalTier('?waterTowerTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_HOSPITAL_TIER);
    });


    test('adding the Water tower never moves or drops another building (every width)', () => {
        [[640, 334], [700, 334], [760, 334], [800, 334], ...SIZES].forEach(([w, h]) => {
            const without = slots(w, h, SEVEN);
            const withMill = slots(w, h, ALL).filter(x => x.kind !== 'bestdays');
            expect(withMill).toEqual(without);
        });
    });

    test.each([1, 2, 3, 4, 5])('shipped bestdays tier %i exists and is the authored 128x208 canvas', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('bestdays', tier));
        expect(fs.existsSync(file)).toBe(true);
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        expect(b.readUInt32BE(16)).toBe(CONFIG.VILLAGE_WATERTOWER_W_PX);
        expect(b.readUInt32BE(20)).toBe(CONFIG.VILLAGE_WATERTOWER_H_PX);
    });
});

describe('resolveTier (Build 2, 2026-10-30): the REAL tier unless the URL overrides it', () => {
    const o = VillageLayout.fromConfig(CONFIG);
    test('no param: the real tier is used (CONFIG dev defaults no longer apply)', () => {
        expect(VillageLayout.resolveTier('', 'gymTier', 1, o.tiers)).toBe(1);
        expect(VillageLayout.resolveTier('?x=1', 'gymTier', 4, o.tiers)).toBe(4);
    });
    test('?param=1..5 pins the tier, off hides, a bad value falls back to the real tier', () => {
        expect(VillageLayout.resolveTier('?gymTier=5', 'gymTier', 1, o.tiers)).toBe(5);
        expect(VillageLayout.resolveTier('?a=1&gymTier=2', 'gymTier', 4, o.tiers)).toBe(2);
        expect(VillageLayout.resolveTier('?gymTier=off', 'gymTier', 4, o.tiers)).toBeNull();
        expect(VillageLayout.resolveTier('?gymTier=banana', 'gymTier', 3, o.tiers)).toBe(3);
        expect(VillageLayout.resolveTier('?gymTier=9', 'gymTier', 3, o.tiers)).toBe(5);
    });
    test('a missing/invalid real tier hides the building; a real tier above the ladder clamps', () => {
        expect(VillageLayout.resolveTier('', 'gymTier', null, o.tiers)).toBeNull();
        expect(VillageLayout.resolveTier('', 'gymTier', 99, o.tiers)).toBe(5);
    });
});


describe('arrangement / placement model (2026-10-30 night; spots redone 2026-11-24): designed for the 800x360 phone, anchored to the graveyard plot', () => {
    const ALL8 = { punctuality: 3, defense: 3, slain: 3, nights: 3, lurkers: 3, heroes: 3, habits: 3, bestdays: 3 };
    const P = CONFIG.VILLAGE_PLACEMENT;
    const BASE = 188; // the church box on phones (css/gameCanvas.css --base-w)
    const at = (w, h = 306, tiers = ALL8, hill = 120, base = BASE, opts = OPTS) => VillageLayout.villageSlots(w, h, base, hill, tiers, opts);
    const byKind = s => Object.fromEntries(s.map(x => [x.kind, x]));
    const horizon = h => h - CONFIG.GROUND_FLOOR_HEIGHT - CONFIG.VILLAGE_FEET_ABOVE_FLOOR_PX;

    test('CONFIG and the module defaults agree; every kind has a row', () => {
        expect(VillageLayout.DEFAULTS.placement).toEqual(P);
        expect(VillageLayout.DEFAULTS.designFieldPx).toBe(CONFIG.VILLAGE_DESIGN_FIELD_PX);
        expect(VillageLayout.DEFAULTS.baseTuckPx).toBe(CONFIG.VILLAGE_BASE_TUCK_PX);
        expect(OPTS.baseTuckPx).toBe(CONFIG.VILLAGE_BASE_TUCK_PX);
        expect(VillageLayout.DEFAULTS.backRowRaisePx).toBe(CONFIG.VILLAGE_BACK_ROW_RAISE_PX);
        expect(VillageLayout.DEFAULTS.farRowRaisePx).toBe(CONFIG.VILLAGE_FAR_ROW_RAISE_PX);
        Object.keys(ALL8).forEach(k => expect(['front', 'back', 'far']).toContain(P[k].row));
    });

    test('the design field is the 800x360 phone: 800 - the 120px plot - the 188px church box', () => {
        expect(CONFIG.VILLAGE_DESIGN_FIELD_PX).toBe(800 - CONFIG.GRAVEYARD_HILL_WIDTH_PX - BASE);
    });

    test('rows (Village 2.0 rule 3): front = Gym, Police station, Command Post; back = Hospital, Clock tower, High school; far = Water tower, Broadcast tower', () => {
        const rows = r => Object.keys(P).filter(k => P[k].row === r).sort();
        expect(rows('front')).toEqual(['defense', 'goals', 'lurkers', 'slain']); // + the Lab (kind `goals`, wired 2026-11-26, painted behind the Command Post)
        expect(rows('back')).toEqual(['habits', 'heroes', 'punctuality']);
        expect(rows('far')).toEqual(['bestdays', 'nights']);
        const left = r => at(800).filter(x => x.row === r).map(x => x.kind);
        expect(left('front')).toEqual(['lurkers', 'defense', 'slain']);
        expect(left('back')).toEqual(['habits', 'punctuality', 'heroes']);
        expect(left('far')).toEqual(['bestdays', 'nights']);
    });

    test('row heights: back 60px above the front, far 95px above the front', () => {
        expect(CONFIG.VILLAGE_BACK_ROW_RAISE_PX).toBe(60);
        expect(CONFIG.VILLAGE_BACK_ROW_RAISE_PX + CONFIG.VILLAGE_FAR_ROW_RAISE_PX).toBe(95);
    });

    test('at the design width (800 = a 492px field) every art right edge sits exactly `right` px from the plot', () => {
        const s = at(800);
        expect(s).toHaveLength(8);
        const fieldRight = 800 - 120;
        s.forEach(x => expect(x.artRight).toBe(fieldRight + P[x.kind].right));
    });

    test('the approved layout (mock "D", 2026-11-24) at 800x360: every building\'s art box and top', () => {
        const s = byKind(at(800, 306));
        const box = k => [s[k].artLeft, s[k].artRight, s[k].top];
        expect(box('lurkers')).toEqual([168, 356, 70]);
        expect(box('defense')).toEqual([398, 555, 58]); // 12px further back than the row line (`raise`)
        expect(box('slain')).toEqual([555, 714, 70]);
        expect(box('habits')).toEqual([190, 363, 26]);
        expect(box('punctuality')).toEqual([351, 440, -12]); // mock-up "option 3": feet 196, 22px above the Police station's; 12px of roof tip off the top
        expect(box('heroes')).toEqual([526, 700, 26]);
    });

    test('wider screens keep the phone arrangement pixel-for-pixel, CENTRED in the field', () => {
        const phone = byKind(at(800));
        [1100, 1366, 1827, 1920].forEach((w) => {
            const s = byKind(at(w));
            const shift = (w - 800) / 2; // half the extra width on each side
            Object.keys(ALL8).forEach((k) => {
                expect(Math.abs(s[k].artLeft - (phone[k].artLeft + shift))).toBeLessThanOrEqual(0.5);
                expect(s[k].artRight - s[k].artLeft).toBe(phone[k].artRight - phone[k].artLeft);
                expect(s[k].feetY).toBe(phone[k].feetY);
            });
        });
    });

    test('a bigger church box (tablet / desktop) centres the same cluster in what is left of the field', () => {
        const phone = byKind(at(800));
        [[1100, 300], [1366, 368]].forEach(([w, base]) => {
            const s = byKind(at(w, 306, ALL8, 120, base));
            const shift = ((w - 120 - base) - CONFIG.VILLAGE_DESIGN_FIELD_PX) / 2;
            Object.keys(ALL8).forEach(k => expect(Math.abs((w - 120 - s[k].artRight) - (680 - phone[k].artRight + shift))).toBeLessThanOrEqual(0.5));
        });
    });

    test('the Gym may start inside the church\'s box (the church draws over it), but only up to VILLAGE_BASE_TUCK_PX', () => {
        const s = byKind(at(800));
        expect(BASE - s.lurkers.artLeft).toBe(20); // beside the lantern (Jeremy 2026-11-24: there is room there)
        expect(BASE - s.lurkers.artLeft).toBeLessThanOrEqual(CONFIG.VILLAGE_BASE_TUCK_PX);
        Object.values(s).filter(x => x.kind !== 'lurkers').forEach(x => expect(x.artLeft).toBeGreaterThanOrEqual(BASE));
        // without the allowance it would be dropped (the old rule: nothing over the church)
        expect(at(800, 306, ALL8, 120, BASE, { ...OPTS, baseTuckPx: 0 }).some(x => x.kind === 'lurkers')).toBe(false);
        expect(at(800, 306, ALL8, 120, BASE, { ...OPTS, baseTuckPx: 19 }).some(x => x.kind === 'lurkers')).toBe(false);
        expect(at(800, 306, ALL8, 120, BASE, { ...OPTS, baseTuckPx: 20 }).some(x => x.kind === 'lurkers')).toBe(true);
    });

    test('narrower screens pull the buildings in but keep all eight, none further over the church than the tuck or past the canvas', () => {
        [800, 760, 740, 700, 667, 640].forEach((w) => {
            const s = at(w);
            expect(s).toHaveLength(8);
            s.forEach((x) => {
                expect(x.artLeft).toBeGreaterThanOrEqual(BASE - CONFIG.VILLAGE_BASE_TUCK_PX);
                expect(x.artRight).toBeLessThanOrEqual(w);
            });
        });
    });

    test('a field too narrow shows nothing below VILLAGE_MIN_FIELD_PX; the portrait strip (no plot) shows nothing', () => {
        expect(at(BASE + 120 + CONFIG.VILLAGE_MIN_FIELD_PX - 1)).toEqual([]);
        expect(at(800, 306, ALL8, 0)).toEqual([]); // portrait strip
    });

    test('rows: the front stands on the horizon, back backRowRaisePx above it, far farRowRaisePx above the back', () => {
        const s = byKind(at(800, 296));
        const front = horizon(296);
        ['lurkers', 'defense', 'slain'].forEach(k => expect(s[k].feetY).toBe(front));
        ['habits', 'punctuality', 'heroes'].forEach(k => expect(s[k].feetY).toBe(front - CONFIG.VILLAGE_BACK_ROW_RAISE_PX));
        expect(s.nights.feetY).toBe(front - CONFIG.VILLAGE_BACK_ROW_RAISE_PX - CONFIG.VILLAGE_FAR_ROW_RAISE_PX);
        expect(s.habits.brightness).toBe(CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS);
        expect(s.punctuality.brightness).toBe(CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS);
        expect(s.nights.brightness).toBe(CONFIG.VILLAGE_FAR_ROW_BRIGHTNESS);
        expect(s.lurkers.back).toBeUndefined();
        expect(s.punctuality.back).toBe(true);
        expect(s.nights.far).toBe(true);
    });

    test('paint order: far row, back row, front row; left to right inside a row', () => {
        const s = at(800);
        const rank = { far: 0, back: 1, front: 2 };
        for (let i = 1; i < s.length; i++) {
            const a = s[i - 1], b = s[i];
            expect(rank[a.row] < rank[b.row] || (a.row === b.row && a.artLeft <= b.artLeft)).toBe(true);
        }
    });

    test('800 wide and up: front-row buildings never overlap; in the back row only the tower\'s lamp side reaches over the Hospital\'s end (<= 12px)', () => {
        [800, 817, 844, 1366].forEach((w) => {
            const s = at(w);
            ['front', 'back'].forEach((row) => {
                const r = s.filter(x => x.row === row).sort((a, b) => a.artLeft - b.artLeft);
                for (let i = 1; i < r.length; i++) {
                    const over = r[i - 1].artRight - r[i].artLeft;
                    if (r[i - 1].kind === 'habits' && r[i].kind === 'punctuality') expect(over).toBeLessThanOrEqual(12);
                    else expect(over).toBeLessThanOrEqual(0);
                }
            });
        });
    });

    // Below 800 wide (not a supported size: ART_STYLE "Village 2.0" rule 4) the model scales every art-left offset toward the plot, so buildings start
    // to overlap and the right end slides further behind the plot. Pinned so it cannot get worse; a better narrow-screen rule is an open item.
    test('below 800 wide the overlaps are never worse than pinned (760 / 700 / 640)', () => {
        const over = (w) => {
            const f = byKind(at(w));
            return {
                gymPolice: f.lurkers.artRight - f.defense.artLeft,
                policeCommand: f.defense.artRight - f.slain.artLeft,
                hospitalTower: f.habits.artRight - f.punctuality.artLeft,
                towerSchool: f.punctuality.artRight - f.heroes.artLeft,
                commandBehindPlot: f.slain.artRight - (w - 120),
            };
        };
        const le = (got, max) => Object.keys(max).forEach(k => expect(got[k]).toBeLessThanOrEqual(max[k]));
        le(over(760), { gymPolice: 0, policeCommand: 13, hospitalTower: 25, towerSchool: 0, commandBehindPlot: 44 });
        le(over(700), { gymPolice: 5, policeCommand: 32, hospitalTower: 45, towerSchool: 0, commandBehindPlot: 59 });
        le(over(640), { gymPolice: 33, policeCommand: 51, hospitalTower: 64, towerSchool: 0, commandBehindPlot: 75 });
    });

    test('the Command Post\'s right end sits behind the plot\'s back fence but stops short of the Memorial (800 wide and up)', () => {
        const memorialLeft = CONFIG.GRAVEYARD_MEMORIAL_CENTER_X_PX - CONFIG.GRAVEYARD_MEMORIAL_HIT_W_PX / 2; // px into the plot
        [800, 817, 844, 1366].forEach((w) => {
            const s = byKind(at(w));
            expect(s.slain.artRight - (w - 120)).toBeLessThanOrEqual(memorialLeft);
        });
        expect(byKind(at(800)).slain.artRight - 680).toBe(34);
    });

    test('the High school stops short of the moon (the moon box is 58px wide, 30px from the right edge; buildings draw over it) at 800 and up', () => {
        [800, 817, 844, 1366].forEach((w) => {
            expect(byKind(at(w)).heroes.artRight).toBeLessThanOrEqual(w - 30 - 58);
        });
        expect(800 - 30 - 58 - byKind(at(800)).heroes.artRight).toBe(12);
    });

    test('nothing stands under the moon box except nothing: no building reaches past the Memorial\'s left edge at 800 and up', () => {
        [800, 844, 1366].forEach((w) => {
            at(w).forEach(x => expect(x.artRight).toBeLessThanOrEqual(w - 120 + 39));
        });
    });

    test('no building is mirrored: all art is three-quarter (the Broadcast tower left the flipped list 2026-11-24, the Water tower 2026-11-25)', () => {
        const s = byKind(at(800));
        Object.keys(ALL8).forEach(k => expect(s[k].flip).toBe(false)); // three-quarter art is never mirrored (ART_STYLE Village 2.0 rule 1)
    });

    test('`flip` still mirrors the art columns for any placement that sets it (the maths is kept even though nothing ships mirrored)', () => {
        const o = { ...OPTS, placement: { bestdays: { row: 'far', right: -120, flip: true } } };
        const f = VillageLayout.villageSlots(800, 306, BASE, 120, { bestdays: 3 }, o)[0];
        const art = CONFIG.VILLAGE_ART_X.bestdays;
        expect(f.flip).toBe(true);
        expect(f.artLeft - f.left).toBe(128 - art[1]);
        expect(f.artRight - f.left).toBe(128 - art[0]);
    });

    test('the Water tower (2026-11-25): 128x208, far row, three-quarter art, behind the Police station and clear of the Broadcast tower', () => {
        expect(CONFIG.VILLAGE_PLACEMENT.bestdays).toEqual({ row: 'far', right: -120, sink: 95 });
        expect([CONFIG.VILLAGE_WATERTOWER_W_PX, CONFIG.VILLAGE_WATERTOWER_H_PX]).toEqual([128, 208]);
        expect(CONFIG.VILLAGE_ART_X.bestdays).toEqual([4, 127]);
        const s = byKind(at(800));
        expect(s.bestdays.row).toBe('far');
        expect(s.bestdays.far).toBe(true);
        expect(s.bestdays.flip).toBe(false);
        expect(s.bestdays.left).toBe(s.defense.left + 38);                  // the phone mock: canvas left = the Police station's canvas left + 38
        expect([s.bestdays.artLeft, s.bestdays.artRight]).toEqual([437, 560]);
        expect(s.bestdays.top).toBe(0);                                     // sunk like the Broadcast tower, so it starts at the top of the 800x360 phone
        expect(s.bestdays.artLeft).toBeGreaterThan(s.defense.artLeft);      // it stands behind the Police station (art 398-555)...
        expect(s.bestdays.artRight).toBeLessThan(s.slain.artRight);         // ...and does not reach the Command Post's right end
        expect(s.bestdays.artRight).toBeLessThan(s.nights.artLeft);         // clear of the Broadcast tower (art starts at 574)
        expect(s.bestdays.artRight).toBeLessThanOrEqual(800 - 120 + 39);    // nothing reaches past the Memorial
    });

    test('the Water tower stands lower than the far row only on a canvas too short for it, like the Broadcast tower', () => {
        const tower = (h) => byKind(at(800, h)).bestdays;
        const farFeet = (h) => VillageLayout.horizonFeetY(h, OPTS) - CONFIG.VILLAGE_BACK_ROW_RAISE_PX - CONFIG.VILLAGE_FAR_ROW_RAISE_PX;
        const phone = tower(306);                                           // the 800x360 phone
        expect(phone.top).toBe(0);
        expect(phone.sink).toBe(208 - farFeet(306));
        expect(phone.feetY).toBe(farFeet(306));                             // `feetY` stays the row's horizon
        expect(tower(379).sink).toBeUndefined();
        expect(tower(379).top).toBe(0);
        expect(tower(500).top).toBe(farFeet(500) - 208);
        expect(tower(250).sink).toBe(CONFIG.VILLAGE_BACK_ROW_RAISE_PX + CONFIG.VILLAGE_FAR_ROW_RAISE_PX); // never below the front row's feet
    });

    test('the Broadcast tower (2026-11-24): 144x208, far row, behind the High school\'s right wing, its mast right of the phone HUD and its art left of the moon', () => {
        expect(CONFIG.VILLAGE_PLACEMENT.nights).toEqual({ row: 'far', right: 34, sink: 95 });
        expect([CONFIG.VILLAGE_RADIO_W_PX, CONFIG.VILLAGE_RADIO_H_PX]).toEqual([144, 208]);
        const s = byKind(at(800));
        expect([s.nights.artLeft, s.nights.artRight]).toEqual([574, 714]);                 // 698-714 is only the T4 / T5 floodlight beam
        const body = s.nights.left + 126;                                  // where the tower itself ends (the dish's feed horn)
        expect(body).toBe(698);
        expect(s.nights.left + 90).toBe(662);                              // the mast's centre line (canvas x 90)
        expect(s.nights.left + 90 - 17).toBeGreaterThan(580);              // the crew platform's front edge clears the HUD (x 16-580 on the phone)
        expect(body).toBeLessThan(800 - 30 - 58);                          // the tower is left of the moon box; the beam's faint tail may cross its edge
        expect(s.nights.artRight).toBeLessThanOrEqual(800 - 120 + 39);     // nothing reaches past the Memorial
        expect(s.nights.left + 90).toBeGreaterThan(s.heroes.artLeft);      // it stands behind the High school...
        expect(body).toBeLessThanOrEqual(s.heroes.artRight);               // ...and the tower does not reach past its right end
    });

    test('the Broadcast tower stands lower than the far row only on a canvas too short for it, so its beacon stays on screen', () => {
        const tower = (h) => byKind(at(800, h)).nights;
        const farFeet = (h) => VillageLayout.horizonFeetY(h, OPTS) - CONFIG.VILLAGE_BACK_ROW_RAISE_PX - CONFIG.VILLAGE_FAR_ROW_RAISE_PX;
        const phone = tower(306);                                          // the 800x360 phone
        expect(phone.top).toBe(0);
        expect(phone.sink).toBe(208 - farFeet(306));                       // 73
        expect(phone.feetY).toBe(farFeet(306));                            // `feetY` stays the row's horizon
        const tall = tower(379);                                           // the first canvas with 208px of sky above the far row
        expect(tall.sink).toBeUndefined();
        expect(tall.top).toBe(0);
        expect(tower(500).top).toBe(farFeet(500) - 208);
        expect(tower(500).sink).toBeUndefined();
        const tiny = tower(250);                                           // never below the front row's feet
        expect(tiny.sink).toBe(CONFIG.VILLAGE_BACK_ROW_RAISE_PX + CONFIG.VILLAGE_FAR_ROW_RAISE_PX);
    });

    test('a building shows on its own; changing one tier never moves another', () => {
        expect(at(800, 306, { defense: 2 }).map(x => x.kind)).toEqual(['defense']);
        const a = byKind(at(800, 306, { ...ALL8, heroes: 1 }));
        const b = byKind(at(800, 306, { ...ALL8, heroes: 5 }));
        Object.keys(ALL8).filter(k => k !== 'heroes').forEach(k => expect(a[k]).toEqual(b[k]));
    });
});

// ---- Lab (kind `goals`), the ninth building, WIRED 2026-11-26 (Jeremy: show it for everyone now, overlap with the graveyard plot accepted) ----
describe('Lab (front row, painted behind the Command Post)', () => {
    const slots = (canvasW, canvasH, tiers, baseW = 188, hillW = 120, opts = OPTS) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts);
    const EIGHT = { punctuality: 3, defense: 3, slain: 3, lurkers: 3, nights: 3, heroes: 3, habits: 3, bestdays: 3 };
    const ALL = { ...EIGHT, goals: 1 };
    const kindOf = (list, k) => list.find(s => s.kind === k);

    test('fromConfig mirrors the Lab CONFIG and DEFAULTS agree with it', () => {
        const d = VillageLayout.DEFAULTS;
        ['labWidthPx', 'labHeightPx', 'devLabTier'].forEach(k => expect(OPTS[k]).toBe(d[k]));
        expect(OPTS.labWidthPx).toBe(CONFIG.VILLAGE_LAB_W_PX);
        expect(OPTS.labHeightPx).toBe(CONFIG.VILLAGE_LAB_H_PX);
        expect(OPTS.devLabTier).toBe(CONFIG.VILLAGE_DEV_LAB_TIER);
        expect(d.placement.goals).toEqual(CONFIG.VILLAGE_PLACEMENT.goals);
        expect(VillageLayout.fromConfig({ VILLAGE_DEV_LAB_TIER: null }).devLabTier).toBeNull();
        expect(VillageLayout.sizeOf('goals', OPTS)).toEqual([160, 160]);
    });

    test('resolveDevLabTier reads only ?labTier=', () => {
        expect(VillageLayout.resolveDevLabTier('', OPTS)).toBe(CONFIG.VILLAGE_DEV_LAB_TIER);
        expect(VillageLayout.resolveDevLabTier('?labTier=4', OPTS)).toBe(4);
        expect(VillageLayout.resolveDevLabTier('?labTier=off', OPTS)).toBeNull();
        expect(VillageLayout.resolveDevLabTier('?waterTowerTier=2', OPTS)).toBe(CONFIG.VILLAGE_DEV_LAB_TIER);
        expect(VillageLayout.resolveDevWaterTowerTier('?labTier=2', OPTS)).toBe(CONFIG.VILLAGE_DEV_WATERTOWER_TIER);
    });

    test('on the 800x360 phone the Lab\'s art ends 2px inside the screen, 10px further back than the front row', () => {
        const lab = kindOf(slots(800, 360, ALL), 'goals');
        expect(lab).toBeDefined();
        expect(lab.row).toBe('front');
        expect(lab.artRight).toBe(798);
        expect(lab.artLeft).toBe(641);
        expect(lab.raise).toBe(10);
        expect(lab.behind).toBe(true);
        expect(lab.url).toBe('Assets/Village/goals_t1.png');
        expect([lab.width, lab.height]).toEqual([160, 160]);
        expect(lab.top).toBe(lab.feetY - lab.height - 10);
    });

    test('it is painted BEFORE every other front-row building (behind the Command Post)', () => {
        const front = slots(800, 360, ALL).filter(s => s.row === 'front').map(s => s.kind);
        expect(front[0]).toBe('goals');
        expect(front.slice(1)).toEqual(['lurkers', 'defense', 'slain']);
        expect(kindOf(slots(800, 360, ALL), 'goals').artLeft).toBeGreaterThan(kindOf(slots(800, 360, ALL), 'slain').artLeft);
    });

    test('adding the Lab never moves or drops another building (every width)', () => {
        [[640, 334], [700, 334], [760, 334], [800, 360], [844, 334], [1100, 320], [1440, 400]].forEach(([w, h]) => {
            const without = slots(w, h, EIGHT, w >= 800 ? 188 : 160);
            const withLab = slots(w, h, ALL, w >= 800 ? 188 : 160).filter(s => s.kind !== 'goals');
            expect(withLab).toEqual(without);
        });
    });

    test('no tier = no Lab; it hides with the village when the plot is gone', () => {
        expect(kindOf(slots(800, 360, EIGHT), 'goals')).toBeUndefined();
        expect(slots(800, 360, ALL, 188, 0)).toEqual([]);
    });

    test.each([1, 2, 3, 4, 5])('shipped goals tier %i exists and is the authored 160x160 canvas', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('goals', tier));
        expect(fs.existsSync(file)).toBe(true);
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        expect(b.readUInt32BE(16)).toBe(CONFIG.VILLAGE_LAB_W_PX);
        expect(b.readUInt32BE(20)).toBe(CONFIG.VILLAGE_LAB_H_PX);
    });
});

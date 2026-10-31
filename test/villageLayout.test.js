/**
 * VillageLayout (V7 W2 first slice, 2026-10-29): pure placement maths for the Clock tower.
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
        expect(OPTS.clockXFrac).toBe(CONFIG.VILLAGE_CLOCK_X_FRAC);
        expect(OPTS.minFieldPx).toBe(CONFIG.VILLAGE_MIN_FIELD_PX);
        expect(OPTS.tiers).toBe(CONFIG.VILLAGE_TIERS);
    });

    test('DEFAULTS agree with CONFIG so a missing config still places the tower the same way', () => {
        const d = VillageLayout.DEFAULTS;
        expect(d.spriteWidthPx).toBe(CONFIG.VILLAGE_SPRITE_W_PX);
        expect(d.spriteHeightPx).toBe(CONFIG.VILLAGE_SPRITE_H_PX);
        expect(d.floorHeightPx).toBe(CONFIG.GROUND_FLOOR_HEIGHT);
        expect(d.feetAboveFloorPx).toBe(CONFIG.VILLAGE_FEET_ABOVE_FLOOR_PX);
        expect(d.clockXFrac).toBe(CONFIG.VILLAGE_CLOCK_X_FRAC);
        expect(d.minFieldPx).toBe(CONFIG.VILLAGE_MIN_FIELD_PX);
        expect(d.tiers).toBe(CONFIG.VILLAGE_TIERS);
    });

    test('falls back to the defaults for a missing or junk config', () => {
        expect(VillageLayout.fromConfig(null)).toEqual(VillageLayout.DEFAULTS);
        expect(VillageLayout.fromConfig({ VILLAGE_CLOCK_X_FRAC: 'x' }).clockXFrac).toBe(VillageLayout.DEFAULTS.clockXFrac);
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

describe('clockTowerSlot', () => {
    const slot = (over = {}) => {
        const a = { canvasW: 844, canvasH: 334, baseW: 160, hillW: 140, tier: 3, ...over };
        return VillageLayout.clockTowerSlot(a.canvasW, a.canvasH, a.baseW, a.hillW, a.tier, OPTS);
    };

    test('844x390 landscape: feet on the horizon just above the floor band, centred in the field', () => {
        const s = slot();
        // field 544 wide from x=160; centre = 160 + CONFIG.VILLAGE_CLOCK_X_FRAC * 544; horizon = 334 - 72 - 4 = 258
        // 2026-10-29: the stretch stopgap is gone, the regenerated 128x256 art is drawn 1:1
        const k = VillageLayout.clockScaleFor(334, OPTS);
        expect(k).toBe(1);
        expect(s.width).toBe(128);
        expect(s.left).toBe(Math.round(160 + CONFIG.VILLAGE_CLOCK_X_FRAC * 544 - s.width / 2));
        expect(s.feetY).toBe(VillageLayout.clockFeetY(334, OPTS));
        expect(s.top).toBe(s.feetY - s.height);
        expect(s.url).toBe('Assets/Village/punctuality_t3.png');
        expect(s.kind).toBe('punctuality');
    });

    test('the Clock tower is the authored 128x256 canvas drawn 1:1 (clean pixels, no stretch)', () => {
        const s = slot();
        expect(s.width).toBe(CONFIG.VILLAGE_SPRITE_W_PX);
        expect(s.height).toBe(CONFIG.VILLAGE_SPRITE_H_PX);
        expect(s.width).toBe(128);
        expect(s.height).toBe(256);
    });

    test('CONFIG.VILLAGE_CLOCK_SCALE is 1: the 1.3x stopgap stretch was removed when the art was regenerated', () => {
        expect(CONFIG.VILLAGE_CLOCK_SCALE).toBe(1);
        [356, 334, 298, 100].forEach(h => expect(VillageLayout.clockScaleFor(h, OPTS)).toBe(1));
    });

    test('the scale lever still works as a MAXIMUM if it is ever raised again (never below 1)', () => {
        const o = { ...OPTS, clockScale: 1.5 };
        expect(VillageLayout.clockScaleFor(500, o)).toBe(1.5);
        expect(VillageLayout.clockScaleFor(298, o)).toBeLessThan(1.5);
        expect(VillageLayout.clockScaleFor(100, o)).toBe(1);
    });

    test('every number is a whole pixel', () => {
        [{ canvasW: 915, canvasH: 356 }, { canvasW: 1265, canvasH: 298 }, { canvasW: 853, canvasH: 301 }].forEach(c => {
            const s = slot(c);
            [s.left, s.top, s.width, s.height, s.feetY].forEach(n => expect(Number.isInteger(n)).toBe(true));
        });
    });

    test('feet stay behind the back zombie lane (they may sink into the top of the floor band, never past the lane)', () => {
        [334, 356, 298].forEach(h => {
            const s = slot({ canvasH: h });
            const backLaneFeet = h - CONFIG.GROUND_FLOOR_HEIGHT + CONFIG.GROUND_FLOOR_FEET_TOP_PAD;
            expect(s.feetY).toBeLessThanOrEqual(backLaneFeet);
        });
    });

    test('the tower stays inside the walking field (centre between the church and the hill)', () => {
        [{ canvasW: 844 }, { canvasW: 1265 }, { canvasW: 640 }].forEach(c => {
            const s = slot(c);
            if (!s) return;
            const centre = s.left + s.width / 2;
            expect(centre).toBeGreaterThan(160);
            expect(centre).toBeLessThan(c.canvasW - 140);
        });
    });

    test('portrait strip (no hill): hidden', () => {
        expect(slot({ hillW: 0 })).toBeNull();
    });

    test('a walking field narrower than minFieldPx: hidden', () => {
        expect(slot({ canvasW: 160 + 140 + CONFIG.VILLAGE_MIN_FIELD_PX - 1 })).toBeNull();
        expect(slot({ canvasW: 160 + 140 + CONFIG.VILLAGE_MIN_FIELD_PX })).not.toBeNull();
    });

    test('no tier (null / junk): hidden', () => {
        expect(slot({ tier: null })).toBeNull();
        expect(slot({ tier: 'x' })).toBeNull();
    });

    test('each tier picks its own sprite; tiers above the max clamp', () => {
        const urls = [1, 2, 3, 4, 5].map(t => slot({ tier: t }).url);
        expect(new Set(urls).size).toBe(5);
        expect(slot({ tier: 99 }).url).toBe('Assets/Village/punctuality_t5.png');
    });

    test('the same canvas always gives the same slot (no randomness)', () => {
        expect(slot()).toEqual(slot());
    });
});

describe('shipped sprites', () => {
    function pngSize(file) {
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    }

    test.each([1, 2, 3, 4, 5])('tier %i exists and is the authored 128x256 canvas', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('punctuality', tier));
        expect(fs.existsSync(file)).toBe(true);
        const { w, h } = pngSize(file);
        expect(w).toBe(CONFIG.VILLAGE_SPRITE_W_PX);
        expect(h).toBe(CONFIG.VILLAGE_SPRITE_H_PX);
    });
});

// ---- Jailhouse (kind `defense`, was `lurkers`), added 2026-10-29 ----
describe('Jailhouse config', () => {
    test('fromConfig mirrors the jail CONFIG and DEFAULTS agree with it', () => {
        expect(OPTS.jailWidthPx).toBe(CONFIG.VILLAGE_JAIL_W_PX);
        expect(OPTS.jailHeightPx).toBe(CONFIG.VILLAGE_JAIL_H_PX);
        expect(OPTS.jailXFrac).toBe(CONFIG.VILLAGE_JAIL_X_FRAC);
        expect(OPTS.devJailTier).toBe(CONFIG.VILLAGE_DEV_JAIL_TIER);
        expect(OPTS.minGapPx).toBe(CONFIG.VILLAGE_MIN_GAP_PX);
        const d = VillageLayout.DEFAULTS;
        expect(d.jailWidthPx).toBe(CONFIG.VILLAGE_JAIL_W_PX);
        expect(d.jailHeightPx).toBe(CONFIG.VILLAGE_JAIL_H_PX);
        expect(d.jailXFrac).toBe(CONFIG.VILLAGE_JAIL_X_FRAC);
        expect(d.devJailTier).toBe(CONFIG.VILLAGE_DEV_JAIL_TIER);
        expect(d.minGapPx).toBe(CONFIG.VILLAGE_MIN_GAP_PX);
    });

    test('a null dev jail tier means "hidden"', () => {
        expect(VillageLayout.fromConfig({ VILLAGE_DEV_JAIL_TIER: null }).devJailTier).toBeNull();
    });

    test('the jail is shorter than the tower (the tower stays the landmark)', () => {
        expect(CONFIG.VILLAGE_JAIL_H_PX).toBeLessThan(CONFIG.VILLAGE_SPRITE_H_PX);
        expect(CONFIG.VILLAGE_JAIL_W_PX).toBe(CONFIG.VILLAGE_SPRITE_W_PX);
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

describe('jailSlot', () => {
    const jail = (over = {}) => {
        const a = { canvasW: 844, canvasH: 334, baseW: 160, hillW: 140, tier: 3, ...over };
        return VillageLayout.jailSlot(a.canvasW, a.canvasH, a.baseW, a.hillW, a.tier, OPTS);
    };

    test('844x390: same horizon as the tower, 128x128 at 1:1, centred at its field fraction', () => {
        const s = jail();
        // field 544 from x=160; centre = 160 + CONFIG.VILLAGE_JAIL_X_FRAC * 544; feet = 334 - 72 - 4 = 258
        expect(s.kind).toBe('defense');
        expect(s.url).toBe('Assets/Village/defense_t3.png');
        expect(s.left).toBe(Math.round(160 + CONFIG.VILLAGE_JAIL_X_FRAC * 544 - 64));
        expect(s.feetY).toBe(258);
        expect(s.top).toBe(258 - 128);
        expect(s.width).toBe(128);
        expect(s.height).toBe(128);
    });

    test('on its own the jail stands on the plain horizon; villageSlots puts it on the tower\'s row', () => {
        expect(jail().feetY).toBe(334 - CONFIG.GROUND_FLOOR_HEIGHT - CONFIG.VILLAGE_FEET_ABOVE_FLOOR_PX);
        const both = VillageLayout.villageSlots(844, 334, 160, 140, { punctuality: 3, defense: 3 }, OPTS);
        expect(both[0].feetY).toBe(both[1].feetY);
    });

    test('hidden in the portrait strip, in a narrow field, and with no tier', () => {
        expect(jail({ hillW: 0 })).toBeNull();
        expect(jail({ canvasW: 160 + 140 + CONFIG.VILLAGE_MIN_FIELD_PX - 1 })).toBeNull();
        expect(jail({ tier: null })).toBeNull();
    });

    test('each tier picks its own sprite; whole pixels only', () => {
        expect(new Set([1, 2, 3, 4, 5].map(t => jail({ tier: t }).url)).size).toBe(5);
        const s = jail({ canvasW: 915, canvasH: 356 });
        [s.left, s.top, s.width, s.height, s.feetY].forEach(n => expect(Number.isInteger(n)).toBe(true));
    });
});

describe('villageSlots', () => {
    const slots = (canvasW, canvasH, tiers, baseW = 160, hillW = 140) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, OPTS);

    test('they never overlap and keep the minimum gap, at common landscape sizes', () => {
        [[844, 334], [915, 356], [1265, 298], [1100, 320]].forEach(([w, h]) => {
            const s = slots(w, h, { punctuality: 3, defense: 3 });
            expect(s).toHaveLength(2);
            const [jail, clock] = s;
            // 2026-10-30: gaps are measured between the VISIBLE ART (artLeft/artRight), not the 128px boxes
            expect(jail.artRight + CONFIG.VILLAGE_MIN_GAP_PX).toBeLessThanOrEqual(clock.artLeft);
            expect(jail.artLeft).toBeGreaterThanOrEqual(160); // art never over the church
        });
    });

    test('either building can be shown alone; no tiers or portrait strip = nothing', () => {
        expect(slots(844, 334, { defense: 2 }).map(x => x.kind)).toEqual(['defense']);
        expect(slots(844, 334, { punctuality: 2 }).map(x => x.kind)).toEqual(['punctuality']);
        expect(slots(844, 334, {})).toEqual([]);
        expect(slots(844, 334, undefined)).toEqual([]);
        expect(slots(844, 334, { punctuality: 3, defense: 3 }, 160, 0)).toEqual([]);
    });

});

describe('shipped jail sprites', () => {
    test.each([1, 2, 3, 4, 5])('defense (Jailhouse) tier %i exists and is the authored 128x128 canvas', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('defense', tier));
        expect(fs.existsSync(file)).toBe(true);
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        expect(b.readUInt32BE(16)).toBe(CONFIG.VILLAGE_JAIL_W_PX);
        expect(b.readUInt32BE(20)).toBe(CONFIG.VILLAGE_JAIL_H_PX);
    });
});

describe('clock tower fit on short canvases (the tower is 246px of art, so short canvases lower its feet)', () => {
    const feet = h => VillageLayout.clockFeetY(h, OPTS);
    const artTop = h => feet(h) - Math.ceil(CONFIG.VILLAGE_CLOCK_ART_H_PX * VillageLayout.clockScaleFor(h, OPTS));
    const base = h => h - CONFIG.GROUND_FLOOR_HEIGHT - CONFIG.VILLAGE_FEET_ABOVE_FLOOR_PX;

    test('the tallest tier never pokes out of the top at the common landscape heights', () => {
        [334, 356, 298].forEach(h => expect(artTop(h)).toBeGreaterThanOrEqual(0));
    });

    test('feet never sink more than the max drop below the horizon', () => {
        [334, 356, 298, 260].forEach(h => {
            expect(feet(h) - base(h)).toBeLessThanOrEqual(CONFIG.VILLAGE_FEET_MAX_DROP_PX);
            expect(feet(h)).toBeGreaterThanOrEqual(base(h));
        });
    });

    test('the tower is as big as it can be: the next 0.05 of scale would not fit', () => {
        [334, 298].forEach(h => {
            const k = VillageLayout.clockScaleFor(h, OPTS);
            if (k >= CONFIG.VILLAGE_CLOCK_SCALE) return;
            expect(Math.ceil(CONFIG.VILLAGE_CLOCK_ART_H_PX * (k + 0.05))).toBeGreaterThan(base(h) + CONFIG.VILLAGE_FEET_MAX_DROP_PX);
        });
    });

    test('a zero max drop means no lowering (and a smaller stretch to fit, if the stretch lever is raised)', () => {
        const big = { ...OPTS, clockScale: 1.5 };
        const o = { ...big, feetMaxDropPx: 0 };
        expect(VillageLayout.clockFeetY(298, o)).toBe(base(298));
        expect(VillageLayout.clockScaleFor(334, o)).toBeLessThan(VillageLayout.clockScaleFor(334, big));
    });

    test('1:1 at 1280x720 (canvas 298): T5 is the tallest tier and fits exactly with the feet lowered the full 24px', () => {
        expect(feet(298)).toBe(base(298) + CONFIG.VILLAGE_FEET_MAX_DROP_PX);
        expect(artTop(298)).toBeGreaterThanOrEqual(0);
    });

    test('1:1 on the common phone canvases (334, 356): the tower fits with room above, feet on the horizon', () => {
        [334, 356].forEach(h => {
            expect(feet(h)).toBe(base(h));
            expect(artTop(h)).toBeGreaterThanOrEqual(0);
        });
    });

    test('the tower feet stay behind the back zombie lane', () => {
        const back = 298 - CONFIG.GROUND_FLOOR_HEIGHT + CONFIG.GROUND_FLOOR_FEET_TOP_PAD;
        expect(feet(298)).toBeLessThanOrEqual(back);
    });

    test('a zero max drop means no lowering', () => {
        expect(VillageLayout.clockFeetY(298, { ...OPTS, feetMaxDropPx: 0 })).toBe(base(298));
    });

    test('the jail stands on the same row as the tower when both show (even when lowered)', () => {
        const s = VillageLayout.villageSlots(1265, 298, 160, 140, { punctuality: 3, defense: 3 }, OPTS);
        expect(s).toHaveLength(2);
        expect(s[0].feetY).toBe(s[1].feetY);
        expect(s[0].feetY).toBe(feet(298));
    });

    test('with no tower the jail uses the plain horizon', () => {
        const s = VillageLayout.villageSlots(1265, 298, 160, 140, { defense: 3 }, OPTS);
        expect(s[0].feetY).toBe(base(298));
    });

    test('a tier-1..5 tower never leaves the canvas more than a few px at the top, at any common size', () => {
        [334, 356, 298].forEach(h => expect(artTop(h)).toBeGreaterThanOrEqual(-12));
    });
});

// ---- Armory (kind `slain`), added 2026-10-29: survivor army camp, right of the tower ----
describe('Armory', () => {
    const slots = (canvasW, canvasH, tiers, baseW = 160, hillW = 140) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, OPTS);
    const ALL = { punctuality: 3, defense: 3, slain: 3 };

    test('fromConfig mirrors the armory CONFIG and DEFAULTS agree with it', () => {
        const d = VillageLayout.DEFAULTS;
        expect(OPTS.armoryWidthPx).toBe(CONFIG.VILLAGE_ARMORY_W_PX);
        expect(OPTS.armoryHeightPx).toBe(CONFIG.VILLAGE_ARMORY_H_PX);
        expect(OPTS.armoryXFrac).toBe(CONFIG.VILLAGE_ARMORY_X_FRAC);
        expect(OPTS.devArmoryTier).toBe(CONFIG.VILLAGE_DEV_ARMORY_TIER);
        expect(d.armoryWidthPx).toBe(CONFIG.VILLAGE_ARMORY_W_PX);
        expect(d.armoryHeightPx).toBe(CONFIG.VILLAGE_ARMORY_H_PX);
        expect(d.armoryXFrac).toBe(CONFIG.VILLAGE_ARMORY_X_FRAC);
        expect(d.devArmoryTier).toBe(CONFIG.VILLAGE_DEV_ARMORY_TIER);
        expect(VillageLayout.fromConfig({ VILLAGE_DEV_ARMORY_TIER: null }).devArmoryTier).toBeNull();
    });

    test('stands right of the tower', () => {
        expect(CONFIG.VILLAGE_ARMORY_X_FRAC).toBeGreaterThan(CONFIG.VILLAGE_CLOCK_X_FRAC);
        expect(CONFIG.VILLAGE_ARMORY_X_FRAC).toBeLessThan(1);
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

    test('armorySlot: 128x128 at 1:1, kind slain, one url per tier', () => {
        const s = VillageLayout.armorySlot(844, 334, 160, 140, 3, OPTS);
        expect(s.kind).toBe('slain');
        expect(s.url).toBe('Assets/Village/slain_t3.png');
        expect(s.width).toBe(128);
        expect(s.height).toBe(128);
        expect(new Set([1, 2, 3, 4, 5].map(t => VillageLayout.armorySlot(844, 334, 160, 140, t, OPTS).url)).size).toBe(5);
        expect(VillageLayout.armorySlot(844, 334, 160, 0, 3, OPTS)).toBeNull();
        expect(VillageLayout.armorySlot(844, 334, 160, 140, null, OPTS)).toBeNull();
    });

    test('adding the armory never moves another building', () => {
        const without = slots(844, 334, { punctuality: 4, defense: 4 });
        const withArmory = slots(844, 334, { punctuality: 4, defense: 4, slain: 4 }).filter(x => x.kind !== 'slain');
        expect(withArmory).toEqual(without);
    });

    test('the armory can show alone', () => {
        expect(slots(844, 334, { slain: 2 }).map(x => x.kind)).toEqual(['slain']);
    });

    test.each([1, 2, 3, 4, 5])('shipped slain tier %i exists and is the authored 128x128 canvas', tier => {
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
    const slots = (canvasW, canvasH, tiers, baseW = 160, hillW = 140, opts = OPTS) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts);
    const FRONT = { punctuality: 3, defense: 3, slain: 3 };
    const ALL = { ...FRONT, nights: 3 };
    const SIZES = [[844, 334], [915, 356], [1265, 298], [1100, 320]];

    test('fromConfig mirrors the radio + back-row CONFIG and DEFAULTS agree with it', () => {
        const d = VillageLayout.DEFAULTS;
        expect(OPTS.radioWidthPx).toBe(CONFIG.VILLAGE_RADIO_W_PX);
        expect(OPTS.radioHeightPx).toBe(CONFIG.VILLAGE_RADIO_H_PX);
        expect(OPTS.radioXFrac).toBe(CONFIG.VILLAGE_RADIO_X_FRAC);
        expect(OPTS.devRadioTier).toBe(CONFIG.VILLAGE_DEV_RADIO_TIER);
        expect(OPTS.backRowRaisePx).toBe(CONFIG.VILLAGE_BACK_ROW_RAISE_PX);
        expect(OPTS.backRowBrightness).toBe(CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS);
        expect(OPTS.backMaxOverlapPx).toBe(CONFIG.VILLAGE_BACK_MAX_OVERLAP_PX);
        expect(d.radioWidthPx).toBe(CONFIG.VILLAGE_RADIO_W_PX);
        expect(d.radioHeightPx).toBe(CONFIG.VILLAGE_RADIO_H_PX);
        expect(d.radioXFrac).toBe(CONFIG.VILLAGE_RADIO_X_FRAC);
        expect(d.devRadioTier).toBe(CONFIG.VILLAGE_DEV_RADIO_TIER);
        expect(d.backRowRaisePx).toBe(CONFIG.VILLAGE_BACK_ROW_RAISE_PX);
        expect(d.backRowBrightness).toBe(CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS);
        expect(d.backMaxOverlapPx).toBe(CONFIG.VILLAGE_BACK_MAX_OVERLAP_PX);
        expect(VillageLayout.fromConfig({ VILLAGE_DEV_RADIO_TIER: null }).devRadioTier).toBeNull();
    });

    test('stands between the Jailhouse and the Clock tower, shorter than the tower', () => {
        expect(CONFIG.VILLAGE_RADIO_X_FRAC).toBeGreaterThan(CONFIG.VILLAGE_JAIL_X_FRAC);
        expect(CONFIG.VILLAGE_RADIO_X_FRAC).toBeLessThan(CONFIG.VILLAGE_CLOCK_X_FRAC);
        expect(CONFIG.VILLAGE_RADIO_H_PX).toBeLessThan(CONFIG.VILLAGE_SPRITE_H_PX);
        expect(CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS).toBeGreaterThan(0);
        expect(CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS).toBeLessThan(1);
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

    test('radioSlot: kind nights, 128x160 at 1:1, flagged back row, one url per tier, whole pixels', () => {
        const s = VillageLayout.radioSlot(844, 334, 160, 140, 3, OPTS);
        expect(s.kind).toBe('nights');
        expect(s.url).toBe('Assets/Village/nights_t3.png');
        expect(s.width).toBe(128);
        expect(s.height).toBe(160);
        expect(s.back).toBe(true);
        expect(s.brightness).toBe(CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS);
        // field 544 from x=160; centre = 160 + CONFIG.VILLAGE_RADIO_X_FRAC * 544
        expect(s.left).toBe(Math.round(160 + CONFIG.VILLAGE_RADIO_X_FRAC * 544 - 64));
        [s.left, s.top, s.width, s.height, s.feetY].forEach(n => expect(Number.isInteger(n)).toBe(true));
        expect(new Set([1, 2, 3, 4, 5].map(t => VillageLayout.radioSlot(844, 334, 160, 140, t, OPTS).url)).size).toBe(5);
        expect(VillageLayout.radioSlot(844, 334, 160, 0, 3, OPTS)).toBeNull();
        expect(VillageLayout.radioSlot(844, 334, 160, 140, null, OPTS)).toBeNull();
    });

    test('never over the church or on the graveyard hill, and never sunk further behind a front building than allowed', () => {
        SIZES.forEach(([w, h]) => {
            const s = slots(w, h, ALL);
            const radio = s.find(x => x.kind === 'nights');
            expect(radio).toBeTruthy();
            expect(radio.artLeft).toBeGreaterThanOrEqual(160);
            expect(radio.artRight).toBeLessThanOrEqual(w - 140);
            s.filter(x => x !== radio).forEach(f => {
                // art-to-art overlap (2026-10-30), not the 128px boxes
                const overlap = Math.max(0, Math.min(radio.artRight, f.artRight) - Math.max(radio.artLeft, f.artLeft));
                expect(overlap).toBeLessThanOrEqual(CONFIG.VILLAGE_BACK_MAX_OVERLAP_PX);
            });
        });
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

    test.each([1, 2, 3, 4, 5])('shipped nights tier %i exists and is the authored 128x160 canvas', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('nights', tier));
        expect(fs.existsSync(file)).toBe(true);
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        expect(b.readUInt32BE(16)).toBe(CONFIG.VILLAGE_RADIO_W_PX);
        expect(b.readUInt32BE(20)).toBe(CONFIG.VILLAGE_RADIO_H_PX);
    });
});

// ---- Boxing gym (kind `lurkers` = willpower, a FRONT-row building), added 2026-10-30 ----
describe('Boxing gym (front row) + art-box collision', () => {
    const slots = (canvasW, canvasH, tiers, baseW = 160, hillW = 140, opts = OPTS) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts);
    const FOUR = { punctuality: 3, defense: 3, slain: 3, lurkers: 3 };
    const ALL = { ...FOUR, nights: 3 };
    const SIZES = [[844, 334], [915, 356], [1265, 298], [1100, 320], [800, 334], [1440, 400]];
    const art = slots => slots.map(s => [s.artLeft, s.artRight]);

    test('fromConfig mirrors the gym + art-extent CONFIG and DEFAULTS agree with it', () => {
        const d = VillageLayout.DEFAULTS;
        expect(OPTS.gymWidthPx).toBe(CONFIG.VILLAGE_GYM_W_PX);
        expect(OPTS.gymHeightPx).toBe(CONFIG.VILLAGE_GYM_H_PX);
        expect(OPTS.gymXFrac).toBe(CONFIG.VILLAGE_GYM_X_FRAC);
        expect(OPTS.devGymTier).toBe(CONFIG.VILLAGE_DEV_GYM_TIER);
        expect(OPTS.art).toEqual(CONFIG.VILLAGE_ART_X);
        expect(d.gymWidthPx).toBe(CONFIG.VILLAGE_GYM_W_PX);
        expect(d.gymHeightPx).toBe(CONFIG.VILLAGE_GYM_H_PX);
        expect(d.gymXFrac).toBe(CONFIG.VILLAGE_GYM_X_FRAC);
        expect(d.devGymTier).toBe(CONFIG.VILLAGE_DEV_GYM_TIER);
        expect(d.art).toEqual(CONFIG.VILLAGE_ART_X);
        expect(VillageLayout.fromConfig({ VILLAGE_DEV_GYM_TIER: null }).devGymTier).toBeNull();
        expect(VillageLayout.fromConfig({ VILLAGE_ART_X: 'junk' }).art).toEqual(d.art);
    });

    test('every kind has an art extent inside its canvas', () => {
        ['punctuality', 'defense', 'slain', 'nights', 'lurkers', 'heroes', 'habits', 'bestdays'].forEach(k => {
            const [l, r] = CONFIG.VILLAGE_ART_X[k];
            expect(l).toBeGreaterThanOrEqual(0);
            expect(r).toBeGreaterThan(l);
            expect(r).toBeLessThanOrEqual(128);
        });
    });

    test('the front row reads jail, tower, gym, armory left to right', () => {
        expect(CONFIG.VILLAGE_JAIL_X_FRAC).toBeLessThan(CONFIG.VILLAGE_CLOCK_X_FRAC);
        expect(CONFIG.VILLAGE_GYM_X_FRAC).toBeGreaterThan(CONFIG.VILLAGE_CLOCK_X_FRAC);
        expect(CONFIG.VILLAGE_GYM_X_FRAC).toBeLessThan(CONFIG.VILLAGE_ARMORY_X_FRAC);
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

    test('gymSlot: kind lurkers, 128x128 at 1:1, one url per tier, whole pixels, art box carried on the slot', () => {
        const s = VillageLayout.gymSlot(844, 334, 160, 140, 3, OPTS);
        expect(s.kind).toBe('lurkers');
        expect(s.url).toBe('Assets/Village/lurkers_t3.png');
        expect(s.width).toBe(128);
        expect(s.height).toBe(128);
        expect(s.left).toBe(Math.round(160 + CONFIG.VILLAGE_GYM_X_FRAC * 544 - 64));
        expect(s.artLeft).toBe(s.left + CONFIG.VILLAGE_ART_X.lurkers[0]);
        expect(s.artRight).toBe(s.left + CONFIG.VILLAGE_ART_X.lurkers[1]);
        [s.left, s.top, s.feetY, s.artLeft, s.artRight].forEach(n => expect(Number.isInteger(n)).toBe(true));
        expect(new Set([1, 2, 3, 4, 5].map(t => VillageLayout.gymSlot(844, 334, 160, 140, t, OPTS).url)).size).toBe(5);
        expect(VillageLayout.gymSlot(844, 334, 160, 0, 3, OPTS)).toBeNull();
        expect(VillageLayout.gymSlot(844, 334, 160, 140, null, OPTS)).toBeNull();
    });

    test('the gym stands on the tower\'s row (even when the short desktop canvas lowers it)', () => {
        const desk = slots(1265, 298, ALL);
        expect(desk.find(x => x.kind === 'lurkers').feetY).toBe(desk.find(x => x.kind === 'punctuality').feetY);
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
    (PNG ? test : test.skip).each(['punctuality', 'defense', 'slain', 'nights', 'lurkers', 'heroes', 'habits', 'bestdays'])(
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
    const slots = (canvasW, canvasH, tiers, baseW = 160, hillW = 140, opts = OPTS) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts);
    const FIVE = { punctuality: 3, defense: 3, slain: 3, lurkers: 3, nights: 3 };
    const ALL = { ...FIVE, heroes: 3 };
    const SIZES = [[844, 334], [915, 356], [1265, 298], [1100, 320], [1440, 400]];
    const ov = (a, b) => Math.max(0, Math.min(a.artRight, b.artRight) - Math.max(a.artLeft, b.artLeft));

    test('fromConfig mirrors the school CONFIG and DEFAULTS agree with it', () => {
        const d = VillageLayout.DEFAULTS;
        ['schoolWidthPx', 'schoolHeightPx', 'schoolXFrac', 'devSchoolTier'].forEach(k => expect(OPTS[k]).toBe(d[k]));
        expect(OPTS.schoolWidthPx).toBe(CONFIG.VILLAGE_SCHOOL_W_PX);
        expect(OPTS.schoolHeightPx).toBe(CONFIG.VILLAGE_SCHOOL_H_PX);
        expect(OPTS.schoolXFrac).toBe(CONFIG.VILLAGE_SCHOOL_X_FRAC);
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

    test('schoolSlot: kind heroes, 128x128, back row (raised, darker), art box carried on the slot', () => {
        const s = VillageLayout.schoolSlot(844, 334, 160, 140, 3, OPTS);
        expect(s.kind).toBe('heroes');
        expect(s.url).toBe('Assets/Village/heroes_t3.png');
        expect([s.width, s.height]).toEqual([128, 128]);
        expect(s.back).toBe(true);
        expect(s.brightness).toBe(CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS);
        expect(s.feetY).toBe(334 - CONFIG.GROUND_FLOOR_HEIGHT - CONFIG.VILLAGE_FEET_ABOVE_FLOOR_PX - CONFIG.VILLAGE_BACK_ROW_RAISE_PX);
        expect(s.artLeft).toBe(s.left + CONFIG.VILLAGE_ART_X.heroes[0]);
        expect(s.artRight).toBe(s.left + CONFIG.VILLAGE_ART_X.heroes[1]);
        expect(VillageLayout.schoolSlot(844, 334, 160, 0, 3, OPTS)).toBeNull();
        expect(VillageLayout.schoolSlot(844, 334, 160, 140, null, OPTS)).toBeNull();
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

    test('its whole art fits above the canvas top on the short desktop canvas (raised back row)', () => {
        [[1265, 298], [1280, 298], [844, 334]].forEach(([w, h]) => {
            slots(w, h, ALL).filter(x => x.back).forEach(b => expect(b.top).toBeGreaterThanOrEqual(0));
        });
    });

    test.each([1, 2, 3, 4, 5])('shipped heroes tier %i exists and is the authored 128x128 canvas', tier => {
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
    const slots = (canvasW, canvasH, tiers, baseW = 160, hillW = 140, opts = OPTS) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts);
    const SIX = { punctuality: 3, defense: 3, slain: 3, lurkers: 3, nights: 3, heroes: 3 };
    const ALL = { ...SIX, habits: 3 };
    const SIZES = [[844, 334], [915, 356], [1265, 298], [1100, 320], [1440, 400]];
    const ov = (a, b) => Math.max(0, Math.min(a.artRight, b.artRight) - Math.max(a.artLeft, b.artLeft));

    test('fromConfig mirrors the hospital CONFIG and DEFAULTS agree with it', () => {
        const d = VillageLayout.DEFAULTS;
        ['hospitalWidthPx', 'hospitalHeightPx', 'hospitalXFrac', 'devHospitalTier'].forEach(k => expect(OPTS[k]).toBe(d[k]));
        expect(OPTS.hospitalWidthPx).toBe(CONFIG.VILLAGE_HOSPITAL_W_PX);
        expect(OPTS.hospitalHeightPx).toBe(CONFIG.VILLAGE_HOSPITAL_H_PX);
        expect(OPTS.hospitalXFrac).toBe(CONFIG.VILLAGE_HOSPITAL_X_FRAC);
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

    test('hospitalSlot: kind habits, 128x160, back row (raised, darker), art box carried on the slot', () => {
        const s = VillageLayout.hospitalSlot(844, 334, 160, 140, 3, OPTS);
        expect(s.kind).toBe('habits');
        expect(s.url).toBe('Assets/Village/habits_t3.png');
        expect(s.width).toBe(128);
        expect(s.height).toBe(160);
        expect(s.back).toBe(true);
        expect(s.brightness).toBe(CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS);
        expect(s.artLeft).toBe(s.left + CONFIG.VILLAGE_ART_X.habits[0]);
        expect(s.artRight).toBe(s.left + CONFIG.VILLAGE_ART_X.habits[1]);
        expect(VillageLayout.hospitalSlot(844, 334, 160, 0, 3, OPTS)).toBeNull();
        expect(VillageLayout.hospitalSlot(844, 334, 160, 140, null, OPTS)).toBeNull();
    });

    test('adding the hospital never moves or drops another building (every width)', () => {
        [[640, 334], [700, 334], [760, 334], [800, 334], ...SIZES].forEach(([w, h]) => {
            const without = slots(w, h, SIX);
            const withIt = slots(w, h, ALL).filter(x => x.kind !== 'habits');
            expect(withIt).toEqual(without);
        });
    });

    test.each([1, 2, 3, 4, 5])('shipped habits tier %i exists and is the authored 128x160 canvas', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('habits', tier));
        expect(fs.existsSync(file)).toBe(true);
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        expect(b.readUInt32BE(16)).toBe(CONFIG.VILLAGE_HOSPITAL_W_PX);
        expect(b.readUInt32BE(20)).toBe(CONFIG.VILLAGE_HOSPITAL_H_PX);
    });
});

// ---- Windmill (kind `bestdays`), the first FAR-ROW building, PLACEHOLDER art 2026-10-30 ----
describe('Windmill (far row)', () => {
    const slots = (canvasW, canvasH, tiers, baseW = 160, hillW = 140, opts = OPTS) =>
        VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts);
    const SEVEN = { punctuality: 3, defense: 3, slain: 3, lurkers: 3, nights: 3, heroes: 3, habits: 3 };
    const ALL = { ...SEVEN, bestdays: 3 };
    const SIZES = [[844, 334], [915, 356], [1265, 298], [1100, 320], [1440, 400]];
    const ov = (a, b) => Math.max(0, Math.min(a.artRight, b.artRight) - Math.max(a.artLeft, b.artLeft));

    test('fromConfig mirrors the windmill + far-row CONFIG and DEFAULTS agree with it', () => {
        const d = VillageLayout.DEFAULTS;
        ['windmillWidthPx', 'windmillHeightPx', 'windmillXFrac', 'devWindmillTier', 'farRowRaisePx', 'farRowBrightness'].forEach(k => expect(OPTS[k]).toBe(d[k]));
        expect(OPTS.windmillWidthPx).toBe(CONFIG.VILLAGE_WINDMILL_W_PX);
        expect(OPTS.windmillHeightPx).toBe(CONFIG.VILLAGE_WINDMILL_H_PX);
        expect(OPTS.windmillXFrac).toBe(CONFIG.VILLAGE_WINDMILL_X_FRAC);
        expect(OPTS.devWindmillTier).toBe(CONFIG.VILLAGE_DEV_WINDMILL_TIER);
        expect(OPTS.farRowRaisePx).toBe(CONFIG.VILLAGE_FAR_ROW_RAISE_PX);
        expect(OPTS.farRowBrightness).toBe(CONFIG.VILLAGE_FAR_ROW_BRIGHTNESS);
        expect(CONFIG.VILLAGE_FAR_ROW_BRIGHTNESS).toBeLessThan(CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS);
        expect(VillageLayout.fromConfig({ VILLAGE_DEV_WINDMILL_TIER: null }).devWindmillTier).toBeNull();
    });

    test('resolveDevWindmillTier reads only ?windmillTier=', () => {
        expect(VillageLayout.resolveDevWindmillTier('', OPTS)).toBe(CONFIG.VILLAGE_DEV_WINDMILL_TIER);
        expect(VillageLayout.resolveDevWindmillTier('?windmillTier=1', OPTS)).toBe(1);
        expect(VillageLayout.resolveDevWindmillTier('?a=2&windmillTier=5', OPTS)).toBe(5);
        expect(VillageLayout.resolveDevWindmillTier('?windmillTier=off', OPTS)).toBeNull();
        expect(VillageLayout.resolveDevWindmillTier('?hospitalTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_WINDMILL_TIER);
        expect(VillageLayout.resolveDevHospitalTier('?windmillTier=1', OPTS)).toBe(CONFIG.VILLAGE_DEV_HOSPITAL_TIER);
    });

    test('windmillSlot: kind bestdays, 128x160, FAR row (raised above the back row, darker), art box on the slot', () => {
        const s = VillageLayout.windmillSlot(844, 334, 160, 140, 3, OPTS);
        expect(s.kind).toBe('bestdays');
        expect(s.url).toBe('Assets/Village/bestdays_t3.png');
        expect([s.width, s.height]).toEqual([128, 160]);
        expect(s.back).toBe(true);
        expect(s.far).toBe(true);
        expect(s.brightness).toBe(CONFIG.VILLAGE_FAR_ROW_BRIGHTNESS);
        expect(s.feetY).toBe(334 - CONFIG.GROUND_FLOOR_HEIGHT - CONFIG.VILLAGE_FEET_ABOVE_FLOOR_PX
            - CONFIG.VILLAGE_BACK_ROW_RAISE_PX - CONFIG.VILLAGE_FAR_ROW_RAISE_PX);
        expect(s.artLeft).toBe(s.left + CONFIG.VILLAGE_ART_X.bestdays[0]);
        expect(s.artRight).toBe(s.left + CONFIG.VILLAGE_ART_X.bestdays[1]);
        expect(VillageLayout.windmillSlot(844, 334, 160, 0, 3, OPTS)).toBeNull();
        expect(VillageLayout.windmillSlot(844, 334, 160, 140, null, OPTS)).toBeNull();
    });

    test('adding the windmill never moves or drops another building (every width)', () => {
        [[640, 334], [700, 334], [760, 334], [800, 334], ...SIZES].forEach(([w, h]) => {
            const without = slots(w, h, SEVEN);
            const withMill = slots(w, h, ALL).filter(x => x.kind !== 'bestdays');
            expect(withMill).toEqual(without);
        });
    });

    test.each([1, 2, 3, 4, 5])('shipped bestdays tier %i exists and is the authored 128x160 canvas', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('bestdays', tier));
        expect(fs.existsSync(file)).toBe(true);
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        expect(b.readUInt32BE(16)).toBe(CONFIG.VILLAGE_WINDMILL_W_PX);
        expect(b.readUInt32BE(20)).toBe(CONFIG.VILLAGE_WINDMILL_H_PX);
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


describe('arrangement / placement model (2026-10-30 night): designed for the landscape phone, anchored to the graveyard', () => {
    const ALL8 = { punctuality: 3, defense: 3, slain: 3, nights: 3, lurkers: 3, heroes: 3, habits: 3, bestdays: 3 };
    const P = CONFIG.VILLAGE_PLACEMENT;
    const at = (w, h = 296, tiers = ALL8, hill = 140) => VillageLayout.villageSlots(w, h, 160, hill, tiers, OPTS);
    const byKind = s => Object.fromEntries(s.map(x => [x.kind, x]));

    test('CONFIG and the module defaults agree; every kind has a row', () => {
        expect(VillageLayout.DEFAULTS.placement).toEqual(P);
        expect(VillageLayout.DEFAULTS.designFieldPx).toBe(CONFIG.VILLAGE_DESIGN_FIELD_PX);
        Object.keys(ALL8).forEach(k => expect(['front', 'back', 'far']).toContain(P[k].row));
    });

    test('rows follow door size: front = Gym, Clock tower, Jail; back = Hospital, School, Armory; far = Windmill, Radio', () => {
        const rows = r => Object.keys(P).filter(k => P[k].row === r).sort();
        expect(rows('front')).toEqual(['defense', 'lurkers', 'punctuality']);
        expect(rows('back')).toEqual(['habits', 'heroes', 'slain']);
        expect(rows('far')).toEqual(['bestdays', 'nights']);
    });

    test('at the design width (817 = a 517px field) every art right edge sits exactly `right` px from the hill', () => {
        const s = at(817);
        expect(s).toHaveLength(8);
        const fieldRight = 817 - 140;
        s.forEach(x => expect(x.artRight).toBe(fieldRight + P[x.kind].right));
    });

    test('wider screens keep the phone arrangement pixel-for-pixel, shifted to the hill', () => {
        const phone = byKind(at(817));
        [1100, 1366, 1920].forEach((w) => {
            const s = byKind(at(w));
            const shift = w - 817;
            Object.keys(ALL8).forEach((k) => {
                expect(s[k].artLeft).toBe(phone[k].artLeft + shift);
                expect(s[k].feetY).toBe(phone[k].feetY);
            });
        });
    });

    test('narrower screens pull the buildings in but keep all eight, none over the church or past the hill', () => {
        [800, 740, 700, 640].forEach((w) => {
            const s = at(w);
            expect(s).toHaveLength(8);
            s.forEach((x) => {
                expect(x.artLeft).toBeGreaterThanOrEqual(160);
                expect(x.artRight).toBeLessThanOrEqual(w);
            });
        });
    });

    test('a field too narrow drops buildings (never moves the rest); below VILLAGE_MIN_FIELD_PX nothing shows', () => {
        expect(at(160 + 140 + CONFIG.VILLAGE_MIN_FIELD_PX - 1)).toEqual([]);
        expect(at(817, 296, ALL8, 0)).toEqual([]); // portrait strip
    });

    test('rows: back stands backRowRaisePx above the front, far farRowRaisePx above the back; front = the tower row', () => {
        const s = byKind(at(817));
        const front = VillageLayout.clockFeetY(296, OPTS);
        expect(s.lurkers.feetY).toBe(front);
        expect(s.punctuality.feetY).toBe(front);
        expect(s.habits.feetY).toBe(front - CONFIG.VILLAGE_BACK_ROW_RAISE_PX);
        expect(s.nights.feetY).toBe(front - CONFIG.VILLAGE_BACK_ROW_RAISE_PX - CONFIG.VILLAGE_FAR_ROW_RAISE_PX);
        expect(s.habits.brightness).toBe(CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS);
        expect(s.nights.brightness).toBe(CONFIG.VILLAGE_FAR_ROW_BRIGHTNESS);
        expect(s.lurkers.back).toBeUndefined();
        expect(s.nights.far).toBe(true);
        // without the tower the front row stands on the plain horizon
        const noTower = byKind(at(817, 296, { ...ALL8, punctuality: null }));
        expect(noTower.lurkers.feetY).toBe(296 - CONFIG.GROUND_FLOOR_HEIGHT - CONFIG.VILLAGE_FEET_ABOVE_FLOOR_PX);
    });

    test('paint order: far row, back row, front row; left to right inside a row', () => {
        const s = at(817);
        const rank = { far: 0, back: 1, front: 2 };
        for (let i = 1; i < s.length; i++) {
            const a = s[i - 1], b = s[i];
            expect(rank[a.row] < rank[b.row] || (a.row === b.row && a.artLeft <= b.artLeft)).toBe(true);
        }
    });

    test('front-row buildings never overlap each other, and back-row buildings never overlap each other', () => {
        [817, 1366, 740, 640].forEach((w) => {
            const s = at(w);
            ['front', 'back'].forEach((row) => {
                const r = s.filter(x => x.row === row).sort((a, b) => a.artLeft - b.artLeft);
                for (let i = 1; i < r.length; i++) expect(r[i].artLeft).toBeGreaterThanOrEqual(r[i - 1].artRight);
            });
        });
    });

    test('nothing stands BEHIND the Armory, and on the phone its left side tucks 30px behind the Jail', () => {
        const s = byKind(at(817));
        const behind = Object.values(s).filter(x => x.row === 'far' && x.artRight > s.slain.artLeft && x.artLeft < s.slain.artRight);
        expect(behind).toEqual([]);
        expect(s.defense.artRight - s.slain.artLeft).toBe(30);
    });

    test('only short buildings stand under the moon (the ~90px left of the hill) at the design width and wider', () => {
        const SHORT = ['defense', 'slain', 'heroes', 'lurkers'];
        [817, 1366].forEach((w) => {
            const fieldRight = w - 140;
            at(w).forEach((x) => {
                if (x.artRight > fieldRight - 90 && x.artLeft < fieldRight + 6) expect(SHORT).toContain(x.kind);
            });
        });
    });

    test('flipped buildings mirror their art columns', () => {
        const s = byKind(at(817));
        ['bestdays', 'nights'].forEach((k) => {
            expect(s[k].flip).toBe(true);
            const art = CONFIG.VILLAGE_ART_X[k];
            expect(s[k].artLeft - s[k].left).toBe(128 - art[1]);
            expect(s[k].artRight - s[k].left).toBe(128 - art[0]);
        });
        expect(s.lurkers.flip).toBe(false);
    });

    test('the radio mast stands right of the HUD (its art starts at least 400px into the canvas on the phone)', () => {
        expect(byKind(at(817)).nights.artLeft).toBeGreaterThanOrEqual(400);
    });

    test('a building shows on its own; changing one tier never moves another', () => {
        expect(at(817, 296, { defense: 2 }).map(x => x.kind)).toEqual(['defense']);
        const a = byKind(at(817, 296, { ...ALL8, heroes: 1 }));
        const b = byKind(at(817, 296, { ...ALL8, heroes: 5 }));
        Object.keys(ALL8).filter(k => k !== 'heroes').forEach(k => expect(a[k]).toEqual(b[k]));
    });
});

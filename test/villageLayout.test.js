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
        // field 544 wide from x=160; centre = 160 + 0.55 * 544 = 459.2; feet = 334 - 72 - 4 = 258
        // STOPGAP: the sprite is stretched by VILLAGE_CLOCK_SCALE (1.3): 166 x 291
        expect(s.width).toBe(Math.round(128 * CONFIG.VILLAGE_CLOCK_SCALE));
        expect(s.left).toBe(Math.round(459.2 - s.width / 2));
        expect(s.feetY).toBe(258);
        expect(s.top).toBe(258 - s.height);
        expect(s.url).toBe('Assets/Village/punctuality_t3.png');
        expect(s.kind).toBe('punctuality');
    });

    test('STOPGAP: the Clock tower is the authored canvas x CONFIG.VILLAGE_CLOCK_SCALE (1 = clean 1:1 pixels)', () => {
        const s = slot();
        expect(s.width).toBe(Math.round(CONFIG.VILLAGE_SPRITE_W_PX * CONFIG.VILLAGE_CLOCK_SCALE));
        expect(s.height).toBe(Math.round(CONFIG.VILLAGE_SPRITE_H_PX * CONFIG.VILLAGE_CLOCK_SCALE));
        const unscaled = VillageLayout.clockTowerSlot(844, 334, 160, 140, 3, { ...OPTS, clockScale: 1 });
        expect(unscaled.width).toBe(128);
        expect(unscaled.height).toBe(224);
    });

    test('the tower scale is sane (>= 1, <= 1.5)', () => {
        expect(CONFIG.VILLAGE_CLOCK_SCALE).toBeGreaterThanOrEqual(1);
        expect(CONFIG.VILLAGE_CLOCK_SCALE).toBeLessThanOrEqual(1.5);
    });

    test('every number is a whole pixel', () => {
        [{ canvasW: 915, canvasH: 356 }, { canvasW: 1265, canvasH: 298 }, { canvasW: 853, canvasH: 301 }].forEach(c => {
            const s = slot(c);
            [s.left, s.top, s.width, s.height, s.feetY].forEach(n => expect(Number.isInteger(n)).toBe(true));
        });
    });

    test('feet sit above the floor band, i.e. behind the back zombie lane', () => {
        const s = slot();
        const backLaneFeet = 334 - CONFIG.GROUND_FLOOR_HEIGHT + CONFIG.GROUND_FLOOR_FEET_TOP_PAD;
        expect(s.feetY).toBeLessThan(backLaneFeet);
        expect(s.feetY).toBeLessThanOrEqual(334 - CONFIG.GROUND_FLOOR_HEIGHT);
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

    test.each([1, 2, 3, 4, 5])('tier %i exists and is the authored 128x224 canvas', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('punctuality', tier));
        expect(fs.existsSync(file)).toBe(true);
        const { w, h } = pngSize(file);
        expect(w).toBe(CONFIG.VILLAGE_SPRITE_W_PX);
        expect(h).toBe(CONFIG.VILLAGE_SPRITE_H_PX);
    });
});

// ---- Jailhouse (kind `lurkers`), added 2026-10-29 ----
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
        // field 544 from x=160; centre = 160 + 0.2 * 544 = 268.8; feet = 334 - 72 - 4 = 258
        expect(s.kind).toBe('lurkers');
        expect(s.url).toBe('Assets/Village/lurkers_t3.png');
        expect(s.left).toBe(Math.round(268.8 - 64));
        expect(s.feetY).toBe(258);
        expect(s.top).toBe(258 - 128);
        expect(s.width).toBe(128);
        expect(s.height).toBe(128);
    });

    test('feet line up with the Clock tower (same row)', () => {
        const c = VillageLayout.clockTowerSlot(844, 334, 160, 140, 3, OPTS);
        expect(jail().feetY).toBe(c.feetY);
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

    test('both buildings, jail painted first (the tower paints over it)', () => {
        const s = slots(844, 334, { punctuality: 3, lurkers: 3 });
        expect(s.map(x => x.kind)).toEqual(['lurkers', 'punctuality']);
    });

    test('they never overlap and keep the minimum gap, at common landscape sizes', () => {
        [[844, 334], [915, 356], [1265, 298], [1100, 320]].forEach(([w, h]) => {
            const s = slots(w, h, { punctuality: 3, lurkers: 3 });
            expect(s).toHaveLength(2);
            const [jail, clock] = s;
            expect(jail.left + jail.width + CONFIG.VILLAGE_MIN_GAP_PX).toBeLessThanOrEqual(clock.left);
            expect(jail.left).toBeGreaterThanOrEqual(160); // never over the church
        });
    });

    test('when the field is too narrow for both, the JAIL is dropped (not moved) and the tower stays put', () => {
        const alone = slots(640, 334, { punctuality: 3 });
        const both = slots(640, 334, { punctuality: 3, lurkers: 3 });
        expect(both).toHaveLength(1);
        expect(both[0].kind).toBe('punctuality');
        expect(both[0]).toEqual(alone[0]);
    });

    test('either building can be shown alone; no tiers or portrait strip = nothing', () => {
        expect(slots(844, 334, { lurkers: 2 }).map(x => x.kind)).toEqual(['lurkers']);
        expect(slots(844, 334, { punctuality: 2 }).map(x => x.kind)).toEqual(['punctuality']);
        expect(slots(844, 334, {})).toEqual([]);
        expect(slots(844, 334, undefined)).toEqual([]);
        expect(slots(844, 334, { punctuality: 3, lurkers: 3 }, 160, 0)).toEqual([]);
    });

    test('the Clock tower slot is identical with or without the jail (adding a building never moves another)', () => {
        const withJail = slots(844, 334, { punctuality: 4, lurkers: 4 }).find(x => x.kind === 'punctuality');
        expect(withJail).toEqual(VillageLayout.clockTowerSlot(844, 334, 160, 140, 4, OPTS));
    });
});

describe('shipped jail sprites', () => {
    test.each([1, 2, 3, 4, 5])('lurkers tier %i exists and is the authored 128x128 canvas', tier => {
        const file = path.join(__dirname, '..', VillageLayout.spriteUrl('lurkers', tier));
        expect(fs.existsSync(file)).toBe(true);
        const b = fs.readFileSync(file);
        expect(b.slice(1, 4).toString()).toBe('PNG');
        expect(b.readUInt32BE(16)).toBe(CONFIG.VILLAGE_JAIL_W_PX);
        expect(b.readUInt32BE(20)).toBe(CONFIG.VILLAGE_JAIL_H_PX);
    });
});

describe('clock tower feet on short canvases (the stretched tower is taller)', () => {
    const feet = h => VillageLayout.clockFeetY(h, OPTS);
    const artTop = h => feet(h) - Math.ceil(CONFIG.VILLAGE_CLOCK_ART_H_PX * CONFIG.VILLAGE_CLOCK_SCALE);
    const base = h => h - CONFIG.GROUND_FLOOR_HEIGHT - CONFIG.VILLAGE_FEET_ABOVE_FLOOR_PX;

    test('phone 844x390 (canvas 334) and 915x412 (356): no drop, the whole tower is on screen', () => {
        [334, 356].forEach(h => {
            expect(feet(h)).toBe(base(h));
            expect(artTop(h)).toBeGreaterThanOrEqual(0);
        });
    });

    test('desktop 1280x720 (canvas 298): feet sink, but never more than the max drop', () => {
        expect(feet(298)).toBeGreaterThan(base(298));
        expect(feet(298) - base(298)).toBeLessThanOrEqual(CONFIG.VILLAGE_FEET_MAX_DROP_PX);
        expect(artTop(298)).toBeGreaterThanOrEqual(-12); // at most a few px of spire tip
    });

    test('the tower feet stay behind the back zombie lane', () => {
        const back = 298 - CONFIG.GROUND_FLOOR_HEIGHT + CONFIG.GROUND_FLOOR_FEET_TOP_PAD;
        expect(feet(298)).toBeLessThanOrEqual(back);
    });

    test('a zero max drop means no lowering', () => {
        expect(VillageLayout.clockFeetY(298, { ...OPTS, feetMaxDropPx: 0 })).toBe(base(298));
    });

    test('the jail stands on the same row as the tower when both show (even when lowered)', () => {
        const s = VillageLayout.villageSlots(1265, 298, 160, 140, { punctuality: 3, lurkers: 3 }, OPTS);
        expect(s).toHaveLength(2);
        expect(s[0].feetY).toBe(s[1].feetY);
        expect(s[0].feetY).toBe(feet(298));
    });

    test('with no tower the jail uses the plain horizon', () => {
        const s = VillageLayout.villageSlots(1265, 298, 160, 140, { lurkers: 3 }, OPTS);
        expect(s[0].feetY).toBe(base(298));
    });

    test('a tier-1..5 tower never leaves the canvas more than a few px at the top, at any common size', () => {
        [334, 356, 298].forEach(h => expect(artTop(h)).toBeGreaterThanOrEqual(-12));
    });
});

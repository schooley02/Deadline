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
        expect(s.left).toBe(Math.round(459.2 - 64));
        expect(s.feetY).toBe(258);
        expect(s.top).toBe(258 - 224);
        expect(s.url).toBe('Assets/Village/punctuality_t3.png');
        expect(s.kind).toBe('punctuality');
    });

    test('the sprite is drawn 1:1 (never scaled): width/height are the authored canvas', () => {
        const s = slot();
        expect(s.width).toBe(128);
        expect(s.height).toBe(224);
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

/**
 * GraveyardLayout (V7 W0, 2026-10-28): pure placement maths for the right-hand hill and the
 * past-run graves. See js/graveyardLayout.js and docs/WORLD_FEEDBACK_PLAN.md.
 */
const GraveyardLayout = require('../js/graveyardLayout.js');
const CONFIG = require('../js/config.js');

const OPTS = GraveyardLayout.fromConfig(CONFIG);

describe('fieldRight', () => {
    test('canvas minus zone', () => {
        expect(GraveyardLayout.fieldRight(844, 140)).toBe(704);
    });
    test('no hill (portrait strip) leaves the whole canvas', () => {
        expect(GraveyardLayout.fieldRight(390, 0)).toBe(390);
    });
    test('a hill wider than the canvas never goes negative', () => {
        expect(GraveyardLayout.fieldRight(100, 140)).toBe(0);
    });
    test('garbage input is treated as 0', () => {
        expect(GraveyardLayout.fieldRight(undefined, undefined)).toBe(0);
    });
});

describe('the old stone-slot helpers are gone (2026-11-23)', () => {
    test('the module no longer exports stoneSlots / stoneCapacity, and CONFIG has no stone-slot or tree-trunk numbers', () => {
        expect(GraveyardLayout.stoneSlots).toBeUndefined();
        expect(GraveyardLayout.stoneCapacity).toBeUndefined();
        ['GRAVEYARD_STONE_PITCH_PX', 'GRAVEYARD_STONE_HIT_PX', 'GRAVEYARD_PAD_PX', 'GRAVEYARD_TRUNK_PX'].forEach((k) => expect(CONFIG[k]).toBeUndefined());
    });
});

describe('runGraves', () => {
    const FIELD_RIGHT = 704; // 844 canvas - 140 hill
    const CHURCH = 160;
    const ids = n => Array.from({ length: n }, (_, i) => n - i); // newest first

    test('no runs, no graves', () => {
        expect(GraveyardLayout.runGraves([], FIELD_RIGHT, CHURCH, OPTS)).toEqual([]);
    });

    test('the newest grave is the closest to the hill, older ones step left', () => {
        const g = GraveyardLayout.runGraves(ids(6), FIELD_RIGHT, CHURCH, OPTS);
        expect(g).toHaveLength(6);
        expect(g[0].id).toBe(6);
        // jitter can swap two near neighbours, so compare grave 0 with the oldest and check the trend
        expect(g[0].x).toBeGreaterThan(g[5].x);
        const first3 = Math.min(...g.slice(0, 3).map(x => x.x));
        const last3 = Math.max(...g.slice(3).map(x => x.x));
        expect(first3).toBeGreaterThan(last3);
    });

    test('every grave stays inside the field: right of the church, left of the hill', () => {
        GraveyardLayout.runGraves(ids(40), FIELD_RIGHT, CHURCH, OPTS).forEach(g => {
            expect(g.x).toBeGreaterThanOrEqual(CHURCH + 4);
            expect(g.x).toBeLessThan(FIELD_RIGHT);
        });
    });

    test('a few runs start widely spread, many runs tighten but never below the minimum', () => {
        const wide = GraveyardLayout.runSpacing(3, 500, OPTS);
        const tight = GraveyardLayout.runSpacing(500, 500, OPTS);
        expect(wide).toBe(CONFIG.RUN_GRAVE_MAX_SPACING_PX);
        expect(tight).toBe(CONFIG.RUN_GRAVE_MIN_SPACING_PX);
        expect(GraveyardLayout.runSpacing(10, 500, OPTS)).toBeLessThan(wide);
        expect(GraveyardLayout.runSpacing(10, 500, OPTS)).toBeGreaterThan(tight);
    });

    test('a long-time player does not push graves through the church: the oldest are dropped', () => {
        const g = GraveyardLayout.runGraves(ids(500), FIELD_RIGHT, CHURCH, OPTS);
        expect(g.length).toBeGreaterThan(10);
        expect(g.length).toBeLessThan(500);
        expect(g[g.length - 1].x).toBeGreaterThanOrEqual(CHURCH + 4);
    });

    test('the oldest graves fade near the church; the newest are at the base opacity', () => {
        const g = GraveyardLayout.runGraves(ids(60), FIELD_RIGHT, CHURCH, OPTS);
        expect(g[0].opacity).toBe(CONFIG.RUN_GRAVE_OPACITY);
        expect(g[g.length - 1].opacity).toBeLessThan(CONFIG.RUN_GRAVE_OPACITY);
    });

    test('a grave keeps its look (lane, height, tilt) when newer runs push it left', () => {
        const before = GraveyardLayout.runGraves(ids(5), FIELD_RIGHT, CHURCH, OPTS).find(g => g.id === 3);
        const after = GraveyardLayout.runGraves(ids(9), FIELD_RIGHT, CHURCH, OPTS).find(g => g.id === 3);
        expect(after.lane).toBe(before.lane);
        expect(after.bodyH).toBe(before.bodyH);
        expect(after.tiltDeg).toBe(before.tiltDeg);
        expect(after.x).toBeLessThan(before.x); // ...but it has moved left
    });

    test('same input, same output (deterministic, no Math.random)', () => {
        const a = GraveyardLayout.runGraves(ids(12), FIELD_RIGHT, CHURCH, OPTS);
        const b = GraveyardLayout.runGraves(ids(12), FIELD_RIGHT, CHURCH, OPTS);
        expect(a).toEqual(b);
    });

    test('graves are shorter than a zombie and lean only a little', () => {
        GraveyardLayout.runGraves(ids(30), FIELD_RIGHT, CHURCH, OPTS).forEach(g => {
            expect(g.bodyH).toBeLessThan(CONFIG.ENEMY_WIDTH / 2);
            expect(Math.abs(g.tiltDeg)).toBeLessThanOrEqual(CONFIG.RUN_GRAVE_TILT_DEG);
            expect([0, 1, 2]).toContain(g.lane);
        });
    });

    test('all three zombie lanes get graves given enough runs (staggered, not one row)', () => {
        const lanes = new Set(GraveyardLayout.runGraves(ids(30), FIELD_RIGHT, CHURCH, OPTS).map(g => g.lane));
        expect(lanes.size).toBe(3);
    });
});

/**
 * GraveyardLayout (V7 W0, 2026-10-28): pure placement maths for the right-hand hill and the
 * past-run graves. See js/graveyardLayout.js and docs/WORLD_FEEDBACK_PLAN.md.
 */
const GraveyardLayout = require('../js/graveyardLayout.js');
const CONFIG = require('../js/config.js');

const OPTS = GraveyardLayout.fromConfig(CONFIG);

describe('fieldRight', () => {
    test('canvas minus hill', () => {
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

describe('stoneSlots', () => {
    const slots = GraveyardLayout.stoneSlots(6, CONFIG.GRAVEYARD_HILL_WIDTH_PX, 8, OPTS);

    test('the 140px hill holds all 6 achievement families (the point of the width)', () => {
        expect(CONFIG.ACHIEVEMENTS.length).toBe(6);
        expect(GraveyardLayout.stoneCapacity(CONFIG.GRAVEYARD_HILL_WIDTH_PX, OPTS)).toBeGreaterThanOrEqual(CONFIG.ACHIEVEMENTS.length);
        expect(slots).toHaveLength(6);
    });

    test('front lane stands on the bottom pad; each back lane is LANE_RISE higher', () => {
        const byLane = [0, 1, 2].map(l => slots.find(s => s.lane === l).feetFromBottom);
        expect(byLane).toEqual([8, 8 + CONFIG.GRAVEYARD_LANE_RISE_PX, 8 + 2 * CONFIG.GRAVEYARD_LANE_RISE_PX]);
    });

    test('odd lanes are shifted by half a pitch so they peek between the front stones', () => {
        const half = Math.round(CONFIG.GRAVEYARD_STONE_PITCH_PX / 2);
        const front = slots.filter(s => s.lane === 0).map(s => s.x);
        const mid = slots.filter(s => s.lane === 1).map(s => s.x);
        mid.forEach((x, i) => expect(x - front[i]).toBe(half));
    });

    test('no two stones in one lane overlap their tap boxes', () => {
        [0, 1, 2].forEach(l => {
            const xs = slots.filter(s => s.lane === l).map(s => s.x).sort((a, b) => a - b);
            for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(CONFIG.GRAVEYARD_STONE_HIT_PX);
        });
    });

    test('every stone box stays inside the hill, left of the visible trunk strip', () => {
        slots.forEach(s => {
            expect(s.x).toBeGreaterThanOrEqual(CONFIG.GRAVEYARD_PAD_PX);
            expect(s.x + CONFIG.GRAVEYARD_STONE_HIT_PX).toBeLessThanOrEqual(CONFIG.GRAVEYARD_HILL_WIDTH_PX - CONFIG.GRAVEYARD_TRUNK_PX + CONFIG.GRAVEYARD_STONE_PITCH_PX / 2 + 1);
        });
    });

    test('a hill too narrow for the request drops the extras instead of overflowing', () => {
        const narrow = GraveyardLayout.stoneSlots(6, 100, 8, OPTS);
        expect(narrow.length).toBe(GraveyardLayout.stoneCapacity(100, OPTS));
        expect(narrow.length).toBeLessThan(6);
    });

    test('zero stones, zero slots', () => {
        expect(GraveyardLayout.stoneSlots(0, 140, 8, OPTS)).toEqual([]);
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

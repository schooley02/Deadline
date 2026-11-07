/**
 * RainSim (2026-11-07): the pure rain rules -- layers, wind, splashes, lightning. Seeded, so every check is repeatable.
 * How it LOOKS is checked in a browser (Settings > Developer tools > DEV > Storm).
 */
const RainSim = require('../js/rainSim');

const rng = (seed) => RainSim.mulberry32(seed || 7);

describe('mulberry32', () => {
    test('the same seed gives the same sequence; values are in [0, 1)', () => {
        const a = rng(42);
        const b = rng(42);
        for (let i = 0; i < 50; i++) {
            const v = a();
            expect(v).toBe(b());
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
    test('different seeds differ', () => {
        expect(rng(1)()).not.toBe(rng(2)());
    });
});

describe('intensityFor', () => {
    test('0.8 at the Storm line, 1.5 for a bad run, linear between', () => {
        expect(RainSim.intensityFor(0.4)).toBeCloseTo(0.8, 5);
        expect(RainSim.intensityFor(0.1)).toBeCloseTo(1.5, 5);
        expect(RainSim.intensityFor(0.25)).toBeCloseTo(1.15, 5);
    });
    test('clamped, and 1 for anything that is not a score (a forced dev sky)', () => {
        expect(RainSim.intensityFor(0.9)).toBe(0.8);
        expect(RainSim.intensityFor(-1)).toBe(1.5);
        expect(RainSim.intensityFor(undefined)).toBe(1);
        expect(RainSim.intensityFor(NaN)).toBe(1);
        expect(RainSim.intensityFor('x')).toBe(1);
    });
});

describe('createWind', () => {
    test('the slope stays inside its limits for a long run', () => {
        const w = RainSim.createWind(rng(3));
        for (let i = 0; i < 6000; i++) {
            const s = w.step(0.05);
            expect(s.slope).toBeGreaterThanOrEqual(0.04);
            expect(s.slope).toBeLessThanOrEqual(RainSim.MAX_SLOPE);
            expect(s.speedMul).toBeGreaterThanOrEqual(1);
        }
    });
    test('a gust happens within the first 20 seconds and leans the rain harder than the calm', () => {
        const w = RainSim.createWind(rng(5), { drift: 0 });
        let peak = 0;
        let calm = null;
        for (let t = 0; t < 20; t += 0.05) {
            const s = w.step(0.05);
            if (s.gust === 0 && calm === null) calm = s.slope;
            peak = Math.max(peak, s.gust);
        }
        expect(peak).toBeGreaterThan(0.9);
        expect(calm).toBeCloseTo(0.22, 5);
    });
    test('gusts come and go: the envelope returns to 0 and speedMul to 1', () => {
        const w = RainSim.createWind(rng(9), { drift: 0 });
        let sawGust = false;
        let endedAfter = false;
        for (let t = 0; t < 120; t += 0.05) {
            const s = w.step(0.05);
            if (s.gust > 0.5) sawGust = true;
            if (sawGust && s.gust === 0) { endedAfter = true; expect(s.speedMul).toBe(1); break; }
        }
        expect(endedAfter).toBe(true);
    });
    test('deterministic for a seed', () => {
        const a = RainSim.createWind(rng(11));
        const b = RainSim.createWind(rng(11));
        for (let i = 0; i < 300; i++) expect(a.step(0.1).slope).toBe(b.step(0.1).slope);
    });
});

describe('createLayer', () => {
    test('rejects an unknown role', () => {
        expect(() => RainSim.createLayer('nope', 100, 100, rng())).toThrow();
    });

    test('drop counts follow the area and the intensity, far densest and near2 sparsest', () => {
        const counts = {};
        RainSim.ROLES.forEach((r) => { counts[r] = RainSim.createLayer(r, 195, 150, rng(), { hz: 100 }).drops.length; });
        expect(counts.far).toBeGreaterThan(counts.mid);
        expect(counts.mid).toBeGreaterThan(counts.near1);
        expect(counts.near1).toBeGreaterThan(counts.near2);
        const heavy = RainSim.createLayer('far', 195, 150, rng(), { intensity: 1.5 }).drops.length;
        const light = RainSim.createLayer('far', 195, 150, rng(), { intensity: 0.6 }).drops.length;
        expect(heavy).toBeGreaterThan(light);
    });

    test('far total is a lot sparser than the old sheets (a phone-sized canvas holds well under 100 drops across all layers)', () => {
        let total = 0;
        RainSim.ROLES.forEach((r) => { total += RainSim.createLayer(r, 195, 150, rng(), { hz: 100 }).drops.length; });
        expect(total).toBeLessThan(100);
        expect(total).toBeGreaterThan(20);
    });

    test('drops differ in length and speed (not one uniform pattern)', () => {
        const l = RainSim.createLayer('near1', 400, 300, rng(), { hz: 150 });
        const lens = new Set(l.drops.map((d) => d.len));
        const speeds = new Set(l.drops.map((d) => Math.round(d.vy)));
        expect(lens.size).toBeGreaterThan(1);
        expect(speeds.size).toBeGreaterThan(3);
        l.drops.forEach((d) => {
            expect(d.len).toBeGreaterThanOrEqual(RainSim.LAYERS.near1.len[0]);
            expect(d.len).toBeLessThanOrEqual(RainSim.LAYERS.near1.len[1]);
        });
    });

    test('landing grounds: far / near2 fall off the bottom; mid lands at the horizon; near1 inside the lanes', () => {
        const hz = 100;
        const h = 150;
        ['far', 'near2'].forEach((r) => {
            RainSim.createLayer(r, 195, h, rng(), { hz }).drops.forEach((d) => expect(d.landY).toBeGreaterThan(h));
        });
        RainSim.createLayer('mid', 195, h, rng(), { hz }).drops.forEach((d) => {
            expect(d.landY).toBeGreaterThanOrEqual(hz - 2);
            expect(d.landY).toBeLessThanOrEqual(hz + 3);
        });
        RainSim.createLayer('near1', 195, h, rng(), { hz }).drops.forEach((d) => {
            expect(d.landY).toBeGreaterThanOrEqual(hz + 6);
            expect(d.landY).toBeLessThanOrEqual(h - 4);
        });
    });

    test('a horizon taller than the canvas does not break the lanes', () => {
        const l = RainSim.createLayer('near1', 100, 40, rng(), { hz: 500 });
        l.drops.forEach((d) => { expect(d.landY).toBeLessThanOrEqual(36); expect(Number.isFinite(d.landY)).toBe(true); });
    });

    test('step moves drops down and with the wind, and keeps the count steady', () => {
        const l = RainSim.createLayer('mid', 195, 150, rng(), { hz: 100 });
        const n = l.drops.length;
        const before = l.drops.map((d) => ({ x: d.x, y: d.y }));
        l.step(0.01, { slope: 0.3, speedMul: 1 });
        expect(l.drops.length).toBe(n);
        l.drops.forEach((d, i) => {
            if (d.y > before[i].y) { // not respawned
                expect(d.y).toBeGreaterThan(before[i].y);
                expect(d.x).toBeGreaterThan(before[i].x);
            }
        });
    });

    test('a stronger lean moves the same drop further sideways', () => {
        const a = RainSim.createLayer('far', 195, 150, rng(4), { hz: 100 });
        const b = RainSim.createLayer('far', 195, 150, rng(4), { hz: 100 });
        a.step(0.01, { slope: 0.1, speedMul: 1 });
        b.step(0.01, { slope: 0.5, speedMul: 1 });
        expect(b.drops[0].x - a.drops[0].x).toBeGreaterThan(0);
    });

    test('splash layers make splashes when drops land; the others never do', () => {
        const wind = { slope: 0.2, speedMul: 1 };
        const run = (role) => {
            const l = RainSim.createLayer(role, 195, 150, rng(8), { hz: 100 });
            let seen = 0;
            for (let i = 0; i < 400; i++) { l.step(0.03, wind); seen = Math.max(seen, l.splashes.length); }
            return seen;
        };
        expect(run('mid')).toBeGreaterThan(0);
        expect(run('near1')).toBeGreaterThan(0);
        expect(run('far')).toBe(0);
        expect(run('near2')).toBe(0);
    });

    test('splashes are capped and expire', () => {
        const l = RainSim.createLayer('near1', 400, 300, rng(2), { hz: 100, intensity: 2 });
        for (let i = 0; i < 300; i++) {
            l.step(0.03, { slope: 0.2, speedMul: 1 });
            expect(l.splashes.length).toBeLessThanOrEqual(RainSim.MAX_SPLASHES);
        }
        const w = l.splashes.length;
        expect(w).toBeGreaterThanOrEqual(0);
        l.drops = [];
        l.step(RainSim.SPLASH_LIFE + 0.01, { slope: 0.2, speedMul: 1 });
        expect(l.splashes.length).toBe(0);
    });

    test('drops that leave the canvas are respawned above it', () => {
        const l = RainSim.createLayer('far', 100, 80, rng(6), { hz: 50 });
        for (let i = 0; i < 400; i++) l.step(0.05, { slope: 0.2, speedMul: 1 });
        l.drops.forEach((d) => { expect(d.y).toBeLessThan(80 + 10); expect(d.y).toBeGreaterThan(-30); });
    });

    test('setIntensity adds / trims drops and clamps', () => {
        const l = RainSim.createLayer('far', 195, 150, rng(), { intensity: 1 });
        const n = l.drops.length;
        l.setIntensity(1.5);
        expect(l.drops.length).toBeGreaterThan(n);
        l.setIntensity(0.5);
        expect(l.drops.length).toBeLessThan(n);
        l.setIntensity(99);
        expect(l.intensity).toBe(2);
        l.setIntensity(-5);
        expect(l.intensity).toBe(0.3);
    });

    test('resize rebuilds for the new size', () => {
        const l = RainSim.createLayer('near1', 100, 100, rng(), { hz: 50 });
        l.resize(300, 200, 120);
        expect(l.w).toBe(300);
        expect(l.h).toBe(200);
        l.drops.forEach((d) => expect(d.landY).toBeGreaterThanOrEqual(126));
    });
});

describe('streak', () => {
    test('whole pixels, head first, the tail leaning back up-wind', () => {
        const px = RainSim.streak({ x: 10.4, y: 20.6, len: 5 }, 0.5);
        expect(px).toHaveLength(5);
        px.forEach((p) => { expect(Number.isInteger(p[0])).toBe(true); expect(Number.isInteger(p[1])).toBe(true); });
        expect(px[0][1]).toBe(21);
        expect(px[4][1]).toBe(17);
        expect(px[4][0]).toBeLessThanOrEqual(px[0][0]);
    });
    test('no lean = a straight vertical streak', () => {
        const px = RainSim.streak({ x: 5, y: 9, len: 3 }, 0);
        expect(new Set(px.map((p) => p[0])).size).toBe(1);
    });
});

describe('splashPixels', () => {
    test('a dot, then two dots apart, then two further apart and higher, then nothing', () => {
        const at = (age) => RainSim.splashPixels({ x: 10, y: 20, age });
        expect(at(0)).toEqual([[10, 19]]);
        expect(at(0.08)).toEqual([[9, 19], [11, 19]]);
        expect(at(0.16)).toEqual([[8, 18], [12, 18]]);
        expect(at(RainSim.SPLASH_LIFE + 0.001)).toEqual([]);
    });
});

describe('lightning', () => {
    test('makeBolt: whole, unique pixels from the top down, inside the sky', () => {
        const bolt = RainSim.makeBolt(rng(3), 200, 120, 0.7);
        expect(bolt.length).toBeGreaterThan(20);
        const seen = new Set();
        bolt.forEach((p) => {
            expect(Number.isInteger(p[0]) && Number.isInteger(p[1])).toBe(true);
            expect(p[0]).toBeGreaterThanOrEqual(0);
            expect(p[0]).toBeLessThan(200);
            expect(p[1]).toBeGreaterThanOrEqual(0);
            expect(p[1]).toBeLessThanOrEqual(Math.round(120 * 0.7));
            seen.add(p[0] + ',' + p[1]);
        });
        expect(seen.size).toBe(bolt.length);
        expect(bolt.some((p) => p[1] === 0)).toBe(true);
    });

    test('the first flash comes within 10 seconds; flashes are at least 10 seconds apart; the bolt shows only briefly', () => {
        const lt = RainSim.createLightning(rng(12));
        const firedAt = [];
        let boltFrames = 0;
        for (let t = 0; t < 120; t += 0.02) {
            const s = lt.step(0.02, 200, 120);
            if (s.fired) firedAt.push(t);
            if (s.bolt) boltFrames++;
        }
        expect(firedAt.length).toBeGreaterThanOrEqual(3);
        expect(firedAt[0]).toBeLessThan(10.5);
        for (let i = 1; i < firedAt.length; i++) expect(firedAt[i] - firedAt[i - 1]).toBeGreaterThanOrEqual(10);
        // 0.14 s of bolt per flash = ~7 frames at 0.02 s; allow a frame of slack
        expect(boltFrames).toBeLessThanOrEqual(firedAt.length * 9);
    });

    test('no flash on a canvas too small to draw one', () => {
        const lt = RainSim.createLightning(rng(1), { first: [0.01, 0.02] });
        for (let i = 0; i < 100; i++) expect(lt.step(0.05, 4, 4).fired).toBe(false);
    });
});

/**
 * RainSim -- the pure half of Storm's rain (designed 2026-11-07, Claude app session, Sonnet + Jeremy; docs/WORLD_FEEDBACK_PLAN.md
 * "Storm rain rework"). The CSS gradient sheets it replaces were one regular, tiled stripe pattern per depth, so the rain read as
 * slanted lines. This is a small particle sim in LOGICAL pixels (the caller draws each one as a whole block of CSS pixels):
 *
 *   - four depth layers (far / mid / near1 / near2), each with its own density, length, speed, brightness and landing ground;
 *   - fewer, shorter drops than the old sheets, with a per-drop length / speed / shade so no two streaks match;
 *   - ONE shared wind (a slow drift plus an occasional gust) so every layer leans the same way and the whole sky moves together;
 *   - 3-frame splashes where a drop lands on the ground (mid at the village's feet, near1 anywhere in the zombie lanes);
 *   - an occasional lightning bolt (a jagged line of pixels) with its timing.
 *
 * No DOM, no clock, no Math.random: the caller passes a seeded `rng` (RainSim.mulberry32) and the elapsed seconds, so every rule
 * here is unit-tested directly (test/rainSim.test.js). js/ui/rainFx.js owns the canvases and the animation loop.
 *
 *   layer = RainSim.createLayer(role, w, h, rng, { hz, intensity })
 *   layer.step(dtSeconds, wind)      move every drop, spawn / age the splashes
 *   layer.drops   [{ x, y, len, vy, shade (0|1), landY }]    layer.splashes   [{ x, y, age }]
 *   RainSim.streak(drop, slope)      -> [[x, y], ...] whole pixels, head first, tail leaning back up-wind
 *   RainSim.splashPixels(splash)     -> [[x, y], ...] for the splash's current frame ([] when it is over)
 */
const RainSim = (() => {
    // Per-depth recipe. `area` = logical pixels of canvas per drop at intensity 1 (bigger = sparser). `windMul` = how much of the
    // wind's lean this depth takes (the nearer, the more it slants). `ground` = where its drops land: 'bottom' = fall off the
    // canvas (no splash), 'horizon' = the village's feet, 'lanes' = anywhere in the zombie field below the horizon.
    const LAYERS = {
        far:   { area: 1100,  len: [1, 2], vy: [70, 95],   windMul: 0.6,  alpha: 0.34, ground: 'bottom' },
        mid:   { area: 2050,  len: [2, 3], vy: [110, 150], windMul: 0.8,  alpha: 0.42, ground: 'horizon' },
        near1: { area: 4800,  len: [3, 5], vy: [170, 220], windMul: 1.0,  alpha: 0.55, ground: 'lanes' },
        near2: { area: 13000, len: [5, 8], vy: [260, 330], windMul: 1.15, alpha: 0.7,  ground: 'bottom' },
    };
    const ROLES = Object.keys(LAYERS);

    // 2026-11-09 (Jeremy: the storm "doesn't seem windy at all"): a steeper lean, harder and more frequent gusts. Same direction
    // (the rain blows the way the clouds drift, left to right). Was MAX 0.6, base 0.22, gust +0.3 / x1.35 every 22-45 s.
    // Same day, round 2: gusts start every 8-15 s, lightning every 5-11 s.
    const MAX_SLOPE = 0.85;           // the most a gust can lean the rain (sideways pixels per falling pixel)
    const SHADE_ALPHA = 0.7;          // a "dim" drop is drawn at this share of its layer's alpha
    const SPLASH_FRAMES = [0.07, 0.07, 0.09]; // seconds each of the 3 splash frames lasts
    const SPLASH_LIFE = SPLASH_FRAMES.reduce((a, b) => a + b, 0);
    const MAX_SPLASHES = 28;          // per layer
    const MIN_INTENSITY = 0.3;
    const MAX_INTENSITY = 2;

    /** Small seeded generator (mulberry32): a function returning [0, 1). The same seed always gives the same rain. */
    function mulberry32(seed) {
        let a = (seed >>> 0) || 1;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function between(rng, lo, hi) { return lo + (hi - lo) * rng(); }
    function intBetween(rng, lo, hi) { return Math.floor(between(rng, lo, hi + 1)); }
    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

    /**
     * Pure. How hard the Storm rains, from the run climate score (0..1; Storm is below 0.40 and the worse the run, the lower).
     * 0.8 at the Storm line up to 1.5 when the run is ~0.10. Anything unusable (a forced dev sky has no score) -> 1.
     */
    function intensityFor(score) {
        if (typeof score !== 'number' || !Number.isFinite(score)) return 1;
        return clamp(0.8 + ((0.4 - score) / 0.3) * 0.7, 0.8, 1.5);
    }

    // ------------------------------------------------------------------------------------------------------ wind

    /**
     * One wind shared by every layer. slope = sideways pixels per falling pixel (positive = the rain leans to the right as it
     * falls). A slow sine drift around a base lean, plus a gust now and then: a smooth swell (sine envelope) that leans the rain
     * harder and speeds it up for a few seconds. Returns { step(dt) -> state, state } with state = { slope, speedMul, gust }.
     */
    function createWind(rng, options) {
        const o = Object.assign({
            base: 0.34, drift: 0.1, driftPeriod: 38,
            gustSlope: 0.42, gustSpeed: 0.45,
            // 2026-11-09 (Jeremy): a gust STARTS every 8-15 s (start to start, so the calm between two is that minus the gust).
            firstGust: [4, 8], gustEvery: [8, 15], gustLen: [3, 5],
        }, options || {});
        let t = 0;
        let untilGust = between(rng, o.firstGust[0], o.firstGust[1]);
        let gustAge = -1;
        let gustLen = 0;
        const state = { slope: o.base, speedMul: 1, gust: 0 };

        function step(dt) {
            t += dt;
            if (gustAge >= 0) {
                gustAge += dt;
                if (gustAge >= gustLen) {
                    gustAge = -1;
                    untilGust = Math.max(1, between(rng, o.gustEvery[0], o.gustEvery[1]) - gustLen);
                }
            } else {
                untilGust -= dt;
                if (untilGust <= 0) {
                    gustAge = 0;
                    gustLen = between(rng, o.gustLen[0], o.gustLen[1]);
                }
            }
            const env = gustAge >= 0 ? Math.sin(Math.PI * clamp(gustAge / gustLen, 0, 1)) : 0;
            state.gust = env;
            state.slope = clamp(o.base + o.drift * Math.sin((2 * Math.PI * t) / o.driftPeriod) + o.gustSlope * env, 0.04, MAX_SLOPE);
            state.speedMul = 1 + o.gustSpeed * env;
            return state;
        }
        return { step, state };
    }

    // ----------------------------------------------------------------------------------------------- drops + layer

    /** Where a new drop will land (logical y). Splash layers pick a ground; the others run off the bottom of the canvas. */
    function pickLand(recipe, rng, h, hz, len) {
        const horizon = clamp(hz, 4, Math.max(4, h - 8));
        if (recipe.ground === 'horizon') return horizon + between(rng, -2, 3);
        if (recipe.ground === 'lanes') return between(rng, Math.min(horizon + 6, h - 4), h - 4);
        return h + len + 1;
    }

    function newDrop(layer, scatter) {
        const r = layer.recipe;
        const rng = layer.rng;
        const len = intBetween(rng, r.len[0], r.len[1]);
        const landY = pickLand(r, rng, layer.h, layer.hz, len);
        return {
            x: between(rng, -MAX_SLOPE * layer.h * r.windMul, layer.w),
            // At creation the drops are spread over the whole fall; afterwards they enter just above the top edge.
            y: scatter ? between(rng, -len, landY) : -len - between(rng, 0, 18),
            len,
            vy: between(rng, r.vy[0], r.vy[1]),
            shade: rng() < 0.45 ? 0 : 1,
            landY,
        };
    }

    /** How many drops a layer holds: its canvas area / recipe.area x intensity, widened for the part of the spawn range left of the canvas. */
    function targetCount(layer) {
        const r = layer.recipe;
        const widen = (layer.w + MAX_SLOPE * layer.h * r.windMul) / Math.max(1, layer.w);
        return Math.max(1, Math.round((layer.w * layer.h / r.area) * layer.intensity * widen));
    }

    function fill(layer, scatter) {
        const want = targetCount(layer);
        while (layer.drops.length < want) layer.drops.push(newDrop(layer, scatter));
        if (layer.drops.length > want) layer.drops.length = want;
    }

    function createLayer(role, w, h, rng, options) {
        const recipe = LAYERS[role];
        if (!recipe) throw new Error('RainSim: unknown layer ' + role);
        const o = options || {};
        const layer = {
            role, recipe, rng,
            w: Math.max(1, Math.floor(w)), h: Math.max(1, Math.floor(h)),
            hz: Number.isFinite(o.hz) ? o.hz : 0,
            intensity: clamp(Number.isFinite(o.intensity) ? o.intensity : 1, MIN_INTENSITY, MAX_INTENSITY),
            drops: [], splashes: [],
            step(dt, wind) { stepLayer(layer, dt, wind); },
            resize(nw, nh, hz) {
                layer.w = Math.max(1, Math.floor(nw));
                layer.h = Math.max(1, Math.floor(nh));
                if (Number.isFinite(hz)) layer.hz = hz;
                layer.drops = [];
                layer.splashes = [];
                fill(layer, true);
            },
            setIntensity(i) {
                const next = clamp(Number.isFinite(i) ? i : 1, MIN_INTENSITY, MAX_INTENSITY);
                if (next === layer.intensity) return;
                layer.intensity = next;
                fill(layer, false);
            },
        };
        fill(layer, true);
        return layer;
    }

    function stepLayer(layer, dt, wind) {
        const slope = (wind && Number.isFinite(wind.slope) ? wind.slope : 0.2) * layer.recipe.windMul;
        const speedMul = wind && Number.isFinite(wind.speedMul) ? wind.speedMul : 1;
        const splashes = layer.recipe.ground !== 'bottom';
        for (let i = 0; i < layer.drops.length; i++) {
            const d = layer.drops[i];
            const dy = d.vy * speedMul * dt;
            d.y += dy;
            d.x += dy * slope;
            if (d.y >= d.landY) {
                if (splashes && d.x >= 0 && d.x < layer.w && layer.splashes.length < MAX_SPLASHES) {
                    layer.splashes.push({ x: Math.round(d.x), y: Math.round(d.landY), age: 0 });
                }
                layer.drops[i] = newDrop(layer, false);
            }
        }
        if (layer.splashes.length) {
            for (let i = 0; i < layer.splashes.length; i++) layer.splashes[i].age += dt;
            layer.splashes = layer.splashes.filter((s) => s.age < SPLASH_LIFE);
        }
    }

    /** Pure. The whole pixels of one drop: head at (round x, round y), the tail trailing back up the lean. */
    function streak(drop, slope) {
        const out = [];
        const hy = Math.round(drop.y);
        const hx = drop.x;
        for (let i = 0; i < drop.len; i++) out.push([Math.round(hx - i * slope), hy - i]);
        return out;
    }

    /** Pure. A splash's pixels for its current frame: a dot, then two dots apart, then two further apart and higher. */
    function splashPixels(splash) {
        let frame = 0;
        let t = splash.age;
        while (frame < SPLASH_FRAMES.length && t >= SPLASH_FRAMES[frame]) { t -= SPLASH_FRAMES[frame]; frame++; }
        const x = splash.x;
        const y = splash.y;
        if (frame === 0) return [[x, y - 1]];
        if (frame === 1) return [[x - 1, y - 1], [x + 1, y - 1]];
        if (frame === 2) return [[x - 2, y - 2], [x + 2, y - 2]];
        return [];
    }

    // ------------------------------------------------------------------------------------------------- lightning

    function line(x0, y0, x1, y1, out) {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let i = 0; i <= n; i++) out.push([Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n)]);
    }

    /** Pure. A jagged bolt from the top of a w x h sky down toward `reach` of its height, with one short side branch. */
    function makeBolt(rng, w, h, reach) {
        const px = [];
        let x = Math.round(between(rng, w * 0.15, w * 0.85));
        let y = 0;
        const endY = Math.round(h * clamp(reach, 0.3, 0.95));
        let branched = false;
        while (y < endY) {
            const ny = Math.min(endY, y + intBetween(rng, 3, 6));
            const nx = clamp(x + intBetween(rng, -3, 3), 1, w - 2);
            line(x, y, nx, ny, px);
            if (!branched && y > endY * 0.35 && rng() < 0.4) {
                branched = true;
                const dir = rng() < 0.5 ? -1 : 1;
                line(nx, ny, clamp(nx + dir * intBetween(rng, 5, 9), 1, w - 2), Math.min(endY, ny + intBetween(rng, 4, 8)), px);
            }
            x = nx;
            y = ny;
        }
        const seen = {};
        return px.filter((p) => {
            const k = p[0] + ',' + p[1];
            if (seen[k]) return false;
            seen[k] = true;
            return true;
        });
    }

    /**
     * The lightning schedule. step(dt, w, h) -> { fired, bolt }: `fired` is true on the one call that starts a flash, and `bolt`
     * (the pixel list) stays set for `boltLife` seconds, then null. One flash per cycle, never two in a row (no strobe).
     */
    function createLightning(rng, options) {
        // 2026-11-09 (Jeremy): lightning more often (was first 5-10, every 10-22 s).
        const o = Object.assign({ first: [3, 6], every: [5, 11], boltLife: 0.6, reach: 0.7 }, options || {});
        let untilFlash = between(rng, o.first[0], o.first[1]);
        let age = -1;
        const state = { fired: false, bolt: null };
        function step(dt, w, h) {
            state.fired = false;
            if (age >= 0) {
                age += dt;
                if (age >= o.boltLife) { age = -1; state.bolt = null; }
            } else {
                untilFlash -= dt;
                if (untilFlash <= 0 && w > 8 && h > 8) {
                    age = 0;
                    state.fired = true;
                    state.bolt = makeBolt(rng, w, h, o.reach);
                    untilFlash = between(rng, o.every[0], o.every[1]);
                }
            }
            return state;
        }
        return { step, state };
    }

    return {
        LAYERS, ROLES, MAX_SLOPE, SHADE_ALPHA, SPLASH_LIFE, MAX_SPLASHES,
        mulberry32, intensityFor, createWind, createLayer, streak, splashPixels, makeBolt, createLightning,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RainSim;
}

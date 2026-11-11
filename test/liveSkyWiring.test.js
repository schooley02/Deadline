/**
 * Live sky hook-up (2026-11-11, docs/LIVE_SKY_PLAN.md). Jest never loads script.js, so this pins the wiring by text: the live layer sits
 * on top of the cached closed-day result, is skipped for game over / a forced sky / another run's day, is rebuilt only when a counter
 * changed (identity-stable otherwise), and the sky-change toast keeps following FINISHED days only.
 */
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');
const RunClimate = require('../js/runClimate.js');

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const script = read('script.js');
const sw = read('sw.js');

describe('script.js live sky hook-up', () => {
    const live = script.slice(script.indexOf('function liveClimate('), script.indexOf('function realClimateNow()'));
    const real = script.slice(script.indexOf('function realClimateNow() {'), script.indexOf('const skyCache'));

    test('liveClimate wraps the cached closed result with RunClimate.withToday and CONFIG.CLIMATE', () => {
        expect(live).toContain('RunClimate.withToday(closed, today, CONFIG.CLIMATE)');
        expect(real).toContain('return liveClimate(climateCache.result, runNumber, over);');
    });

    test('it stands down for game over, a forced sky, no open day and another run\'s day', () => {
        expect(live).toContain('if (over || !closed || closed.forced || !today || today.run !== runNumber) return closed;');
    });

    test('it is rebuilt only when a counter it reads changed (same object back otherwise)', () => {
        expect(live).toContain("const sig = [d.task, d.habit, d.late, m.task, m.habit, l.avoided, l.slipped, g.taken, g.offline].join('|');");
        expect(live).toContain('liveClimateCache.closed !== closed || liveClimateCache.sig !== sig');
    });

    test('the sky-change toast and its arming follow the CLOSED band only', () => {
        expect(script).toContain('const next = result.closedBand || SkyPick.realBandOf(result);');
        expect(script).toContain('skyWatch.last = (r && !r.forced) ? (r.closedBand || SkyPick.realBandOf(r)) : null;');
    });

    test('the dev sky and ?climate= still win first', () => {
        expect(real.indexOf('DevDemo.weather()')).toBeLessThan(real.indexOf('climateOverride'));
        expect(real.indexOf('climateOverride')).toBeLessThan(real.indexOf('liveClimate('));
    });
});

describe('live sky dials + shell', () => {
    test('CONFIG.CLIMATE carries liveFullAt (4) and liveWeight (2), mirrored by RunClimate.DEFAULTS', () => {
        expect(CONFIG.CLIMATE.liveFullAt).toBe(4);
        expect(CONFIG.CLIMATE.liveWeight).toBe(2);
        expect(RunClimate.DEFAULTS.liveFullAt).toBe(CONFIG.CLIMATE.liveFullAt);
        expect(RunClimate.DEFAULTS.liveWeight).toBe(CONFIG.CLIMATE.liveWeight);
    });

    test('CACHE_NAME was bumped for the shell change (v327 or later)', () => {
        const n = Number((/deadline-shell-v(\d+)/.exec(sw) || [])[1]);
        expect(n).toBeGreaterThanOrEqual(327);
    });

    test('the dial is a balance number: retuning liveWeight really changes the sky (negative control)', () => {
        const closed = RunClimate.compute([], 1);
        const day = { done: { task: 0, habit: 0, late: 0 }, missed: { task: 4, habit: 0 }, lurk: {}, dmg: { taken: 5 } };
        const loud = RunClimate.withToday(closed, day, CONFIG.CLIMATE);
        const quiet = RunClimate.withToday(closed, day, Object.assign({}, CONFIG.CLIMATE, { liveWeight: 1 }));
        expect(loud.score).toBeLessThan(quiet.score);
    });
});

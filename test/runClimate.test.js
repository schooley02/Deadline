/**
 * RunClimate (the sky's weather, designed 2026-11-03): day score, the 7-day climate with its fading Hazy prior, the five bands with
 * hysteresis, and the trend. Pure maths, no DOM. Numbers in these tests are the THEORY-PASS defaults (CONFIG.CLIMATE).
 */
const RunClimate = require('../js/runClimate.js');
const CONFIG = require('../js/config.js');

const { dayParts, dayScore, scoredDays, climateAfter, rawBandIndex, nextBandIndex, compute, forced, BANDS } = RunClimate;

// A closed daily record: `due` items (habits + tasks), the fraction finished, habits kept, damage.
function rec(i, o = {}) {
    const due = o.due === undefined ? 10 : o.due;
    const habits = o.habits === undefined ? 5 : o.habits;
    const doneFrac = o.doneFrac === undefined ? 0.9 : o.doneFrac;
    const habitFrac = o.habitFrac === undefined ? 0.9 : o.habitFrac;
    const hd = Math.round(habits * habitFrac);
    return {
        date: '2026-11-' + String(i).padStart(2, '0'),
        run: o.run === undefined ? 1 : o.run,
        due: { task: due - habits, habit: habits },
        done: { task: Math.round((due - habits) * doneFrac), habit: hd, subtask: 0, late: o.late || 0 },
        missed: { task: 0, habit: habits - hd },
        lurk: { avoided: o.avoided || 0, slipped: o.slipped || 0 },
        dmg: { taken: o.dmg === undefined ? 2 : o.dmg, hits: 0, offline: o.offline || 0 },
    };
}
const strongDay = i => rec(i);
const perfectDay = i => rec(i, { doneFrac: 1, habitFrac: 1, dmg: 0 });
const badDay = i => rec(i, { doneFrac: 0.2, habitFrac: 0.2, dmg: 25 });

// Replay `gen(i)` for days 1..n and return every day's result.
function series(gen, n, opts) {
    const days = [];
    const out = [];
    for (let i = 1; i <= n; i++) { days.push(gen(i)); out.push(compute(days, 1, opts)); }
    return out;
}
const bands = res => res.map(r => r.band);

describe('defaults', () => {
    test('DEFAULTS mirror CONFIG.CLIMATE exactly', () => {
        expect(RunClimate.DEFAULTS).toEqual(CONFIG.CLIMATE);
    });

    test('five bands, best to worst', () => {
        expect(BANDS).toEqual(['clear', 'hazy', 'overcast', 'fog', 'storm']);
    });
});

describe('dayScore', () => {
    test('a perfect day scores 1', () => {
        expect(dayScore(perfectDay(1))).toBeCloseTo(1, 10);
    });

    test('on time 0.5 + habits 0.25 + church 0.25', () => {
        // 5 tasks + 5 habits due; all tasks and 3 of 5 habits done; 5 HP damage.
        const r = rec(1, { doneFrac: 1, habitFrac: 0.6, dmg: 5 });
        const onTime = (5 + 3) / 10, habits = 3 / 5, church = 1 - 5 / 25;
        expect(dayScore(r)).toBeCloseTo(0.5 * onTime + 0.25 * habits + 0.25 * church, 10);
    });

    test('a late finish earns half credit', () => {
        const onTimeDay = rec(1, { doneFrac: 1, habitFrac: 1, dmg: 0 });
        const lateDay = rec(1, { doneFrac: 1, habitFrac: 1, dmg: 0, late: 4 });
        expect(dayParts(onTimeDay).onTime).toBe(1);
        expect(dayParts(lateDay).onTime).toBeCloseTo((10 - 0.5 * 4) / 10, 10);
    });

    test('damage counts live hits AND the offline back-charge, capped at 25 HP', () => {
        expect(dayParts(rec(1, { dmg: 5, offline: 5 })).church).toBeCloseTo(1 - 10 / 25, 10);
        expect(dayParts(rec(1, { dmg: 40 })).church).toBe(0);
    });

    test('avoided bad habits count as habits kept; slips count against', () => {
        const r = rec(1, { habits: 0, doneFrac: 1, avoided: 3, slipped: 1 });
        expect(dayParts(r).habits).toBeCloseTo(3 / 4, 10);
    });

    test('a day with nothing to measure on a part drops that part and renormalises', () => {
        // No habits at all: only on time (0.5) and church (0.25) count, rescaled to 1.
        const r = rec(1, { habits: 0, doneFrac: 1, dmg: 0 });
        expect(dayParts(r).habits).toBeNull();
        expect(dayScore(r)).toBeCloseTo(1, 10);
        const r2 = rec(1, { habits: 0, doneFrac: 0.5, dmg: 0 });
        expect(dayScore(r2)).toBeCloseTo((0.5 * 0.5 + 0.25 * 1) / 0.75, 10);
    });

    test('an idle day (nothing due, no habit answered) is skipped, not scored', () => {
        expect(dayScore({ date: '2026-11-01', run: 1, due: { task: 0, habit: 0 }, done: {}, missed: {}, lurk: {}, dmg: { taken: 0 } })).toBeNull();
        expect(dayScore({})).toBeNull();
        expect(dayScore(null)).toBeNull();
    });

    test('more completions than due items cannot push a part above 1', () => {
        const r = rec(1, { doneFrac: 1, habitFrac: 1, dmg: 0 });
        r.done.task = 50;
        expect(dayParts(r).onTime).toBe(1);
        expect(dayScore(r)).toBeLessThanOrEqual(1);
    });

    test('older records with missing fields read as zero, never throw', () => {
        expect(() => dayScore({ date: '2026-11-01', run: 1, due: { task: 2 } })).not.toThrow();
        const s = dayScore({ date: '2026-11-01', run: 1, due: { task: 2 } });
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
    });

    test('a worse day never scores higher than a better one', () => {
        expect(dayScore(badDay(1))).toBeLessThan(dayScore(strongDay(1)));
        expect(dayScore(strongDay(1))).toBeLessThan(dayScore(perfectDay(1)));
    });
});

describe('scoredDays', () => {
    test('only THIS run\'s closed days, oldest first, idle days dropped', () => {
        const days = [rec(3), rec(1), rec(2, { run: 2 }), { date: '2026-11-04', run: 1, due: { task: 0, habit: 0 }, done: {}, missed: {}, lurk: {}, dmg: {} }];
        const out = scoredDays(days, 1);
        expect(out.map(d => d.date)).toEqual(['2026-11-01', '2026-11-03']);
    });

    test('accepts the deadline.days store, its .days map, or an array', () => {
        const a = rec(1), b = rec(2);
        const map = { '2026-11-01': a, '2026-11-02': b };
        expect(scoredDays([a, b], 1)).toHaveLength(2);
        expect(scoredDays(map, 1)).toHaveLength(2);
        expect(scoredDays({ v: 7, days: map, months: {} }, 1)).toHaveLength(2);
        expect(scoredDays(null, 1)).toEqual([]);
        expect(scoredDays(undefined, 1)).toEqual([]);
    });

    test('input order does not matter', () => {
        const days = [rec(1, { doneFrac: 0.3 }), rec(2), rec(3, { dmg: 20 }), rec(4)];
        const shuffled = [days[2], days[0], days[3], days[1]];
        expect(compute(shuffled, 1)).toEqual(compute(days, 1));
    });
});

describe('climateAfter: the fading Hazy prior', () => {
    test('with no days it is the starting prior alone (0.75)', () => {
        expect(climateAfter([], 0)).toBeCloseTo(0.75, 10);
    });

    test('the newest day weighs most; each day back weighs x0.85', () => {
        const s = [{ score: 0 }, { score: 1 }];
        // Window of 2 days + a prior worth 6 * (1 - 2/7) days.
        const priorW = 6 * (1 - 2 / 7);
        const expected = (0.85 * 0 + 1 * 1 + priorW * 0.75) / (0.85 + 1 + priorW);
        expect(climateAfter(s, 2)).toBeCloseTo(expected, 10);
    });

    test('after a full window the prior has no say', () => {
        const s = Array.from({ length: 7 }, () => ({ score: 1 }));
        expect(climateAfter(s, 7)).toBeCloseTo(1, 10);
        expect(climateAfter(s, 7, { startScore: 0 })).toBeCloseTo(1, 10);
    });

    test('only the last 7 scored days count', () => {
        const old = Array.from({ length: 5 }, () => ({ score: 0 }));
        const recent = Array.from({ length: 7 }, () => ({ score: 1 }));
        expect(climateAfter(old.concat(recent), 12)).toBeCloseTo(1, 10);
    });
});

describe('bands and hysteresis', () => {
    test('raw bands at the documented lines', () => {
        expect(rawBandIndex(0.85)).toBe(0);
        expect(rawBandIndex(0.8499)).toBe(1);
        expect(rawBandIndex(0.70)).toBe(1);
        expect(rawBandIndex(0.6999)).toBe(2);
        expect(rawBandIndex(0.55)).toBe(2);
        expect(rawBandIndex(0.5499)).toBe(3);
        expect(rawBandIndex(0.40)).toBe(3);
        expect(rawBandIndex(0.3999)).toBe(4);
        expect(rawBandIndex(0)).toBe(4);
    });

    test('improving needs the score to pass the line by the hysteresis (0.03)', () => {
        // Hazy (1) -> Clear (0): the line is 0.85, so 0.87 is not enough, 0.88 is.
        expect(nextBandIndex(1, 0.87)).toBe(1);
        expect(nextBandIndex(1, 0.88)).toBe(0);
    });

    test('getting worse needs the score to fall below the current band\'s line by the hysteresis', () => {
        // Clear (0): lower line 0.85. 0.83 stays Clear; 0.81 drops to Hazy.
        expect(nextBandIndex(0, 0.83)).toBe(0);
        expect(nextBandIndex(0, 0.81)).toBe(1);
        // Storm has no lower line, so it is only ever left by improving.
        expect(nextBandIndex(4, 0.0)).toBe(4);
    });

    test('a big jump skips bands in either direction', () => {
        expect(nextBandIndex(4, 0.95)).toBe(0);
        expect(nextBandIndex(0, 0.1)).toBe(4);
    });

    test('a score wobbling across a line does not flicker the sky', () => {
        let b = 1; // Hazy
        const seen = new Set();
        [0.86, 0.84, 0.87, 0.83, 0.86, 0.84].forEach((sc) => { b = nextBandIndex(b, sc); seen.add(b); });
        expect(seen.size).toBe(1);
        expect(b).toBe(1);
    });
});

describe('compute: the whole sky', () => {
    test('a brand-new run (no days) is Hazy and steady', () => {
        const r = compute([], 1);
        expect(r.band).toBe('hazy');
        expect(r.score).toBeCloseTo(0.75, 10);
        expect(r.trend).toBe('steady');
        expect(r.scoredDays).toBe(0);
        expect(r.usedPrior).toBe(true);
        expect(r.recent).toEqual([]);
    });

    test('a new run does not inherit the last run\'s days', () => {
        const oldRun = Array.from({ length: 8 }, (_, i) => rec(i + 1, { run: 1, doneFrac: 1, habitFrac: 1, dmg: 0 }));
        expect(compute(oldRun, 1).band).toBe('clear');
        expect(compute(oldRun, 2).band).toBe('hazy');
        expect(compute(oldRun, 2).scoredDays).toBe(0);
    });

    test('strong play (90% on time and habits, little damage) clears the sky on day 5, not before', () => {
        const b = bands(series(strongDay, 7));
        expect(b.slice(0, 4)).toEqual(['hazy', 'hazy', 'hazy', 'hazy']);
        expect(b[4]).toBe('clear');
        expect(b[6]).toBe('clear');
    });

    test('perfect play clears it on day 4', () => {
        const b = bands(series(perfectDay, 6));
        expect(b.slice(0, 3)).toEqual(['hazy', 'hazy', 'hazy']);
        expect(b[3]).toBe('clear');
    });

    test('an okay run (70% on time, 60% habits, 10 HP a day) settles at Overcast and never clears', () => {
        const b = bands(series(i => rec(i, { doneFrac: 0.7, habitFrac: 0.6, dmg: 10 }), 12));
        expect(b[11]).toBe('overcast');
        expect(b).not.toContain('clear');
    });

    test('a decent but not strong run (80% / 80% / 5 HP) stays Hazy', () => {
        const b = bands(series(i => rec(i, { doneFrac: 0.8, habitFrac: 0.8, dmg: 5 }), 14));
        expect(new Set(b)).toEqual(new Set(['hazy']));
    });

    test('after a clear streak, one terrible day drops one band and two drop to Overcast', () => {
        const days = [];
        for (let i = 1; i <= 8; i++) days.push(perfectDay(i));
        expect(compute(days, 1).band).toBe('clear');
        days.push(badDay(9));
        expect(compute(days, 1).band).toBe('hazy');
        days.push(badDay(10));
        expect(compute(days, 1).band).toBe('overcast');
        days.push(badDay(11));
        expect(compute(days, 1).band).toBe('fog');
    });

    test('a collapsing run reaches Storm and the trend says worsening on the way down', () => {
        const res = series(i => rec(i, { doneFrac: 0.3, habitFrac: 0.2, dmg: 25 }), 8);
        expect(res[7].band).toBe('storm');
        expect(res.slice(1, 6).some(r => r.trend === 'down')).toBe(true);
    });

    test('a collapsed run recovers: Storm -> ... -> Clear after enough good days, trend improving on the way up', () => {
        const res = series(i => (i <= 6 ? badDay(i) : strongDay(i)), 14);
        expect(res[5].band).toBe('storm');
        expect(res[13].band).toBe('clear');
        expect(res.slice(6, 12).some(r => r.trend === 'up')).toBe(true);
        // never skips backwards on the way up
        const idx = res.slice(5).map(r => r.bandIndex);
        for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeLessThanOrEqual(idx[i - 1] + 0);
    });

    test('a steady stretch reads steady (the climate barely moves in 3 days)', () => {
        const res = series(strongDay, 12);
        expect(res[11].trend).toBe('steady');
    });

    test('the trend compares with 3 closed days ago (needs at least 2 scored days)', () => {
        expect(compute([perfectDay(1)], 1).trend).toBe('steady');
        const rising = series(i => (i === 1 ? badDay(1) : perfectDay(i)), 5);
        expect(rising[4].trend).toBe('up');
    });

    test('`recent` is the last 7 scored days, newest first, with their parts', () => {
        const days = Array.from({ length: 10 }, (_, i) => strongDay(i + 1));
        const r = compute(days, 1);
        expect(r.recent).toHaveLength(7);
        expect(r.recent[0].date).toBe('2026-11-10');
        expect(r.recent[6].date).toBe('2026-11-04');
        expect(r.recent[0]).toEqual(expect.objectContaining({ score: expect.any(Number), onTime: expect.any(Number), church: expect.any(Number) }));
        expect(r.usedPrior).toBe(false);
    });

    test('derived, not stored: the same days always give the same sky', () => {
        const days = Array.from({ length: 9 }, (_, i) => (i % 3 === 2 ? badDay(i + 1) : strongDay(i + 1)));
        expect(compute(days, 1)).toEqual(compute(days.slice(), 1));
    });

    test('options override the defaults (a stricter hysteresis keeps the sky put)', () => {
        const days = [];
        for (let i = 1; i <= 8; i++) days.push(perfectDay(i));
        days.push(badDay(9));
        expect(compute(days, 1).band).toBe('hazy');
        expect(compute(days, 1, { hysteresis: 0.1 }).band).toBe('clear');
    });
});

describe('forced (dev override)', () => {
    test('builds a result from a band and trend', () => {
        const f = forced('fog', 'up');
        expect(f.band).toBe('fog');
        expect(f.bandIndex).toBe(3);
        expect(f.trend).toBe('up');
        expect(f.forced).toBe(true);
    });

    test('unknown band -> null; unknown trend -> steady', () => {
        expect(forced('blizzard', 'up')).toBeNull();
        expect(forced('storm', 'sideways').trend).toBe('steady');
        expect(forced('clear').trend).toBe('steady');
    });
});

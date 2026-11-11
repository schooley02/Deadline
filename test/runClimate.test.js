/**
 * RunClimate (the sky's weather, designed 2026-11-03): day score, the 7-day climate with its fading Hazy prior, the five bands with
 * hysteresis, and the trend. Pure maths, no DOM. Numbers in these tests are the THEORY-PASS defaults (CONFIG.CLIMATE).
 */
const RunClimate = require('../js/runClimate.js');
const CONFIG = require('../js/config.js');

const { dayParts, dayScore, scoredDays, climateAfter, rawBandIndex, nextBandIndex, compute, forced, liveParts, closedWeight, withToday, BANDS } = RunClimate;

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

// ---- Live sky (2026-11-11, docs/LIVE_SKY_PLAN.md) ---------------------------------------------------------------------------
// An OPEN day's record: `due` is only stamped at close, so liveParts derives "due so far" from done + missed.
function openDay(o = {}) {
    return {
        done: { task: o.doneTask || 0, habit: o.doneHabit || 0, subtask: 0, late: o.late || 0 },
        missed: { task: o.missedTask || 0, habit: o.missedHabit || 0, subtask: o.missedSub || 0 },
        lurk: { avoided: o.avoided || 0, slipped: o.slipped || 0 },
        dmg: { taken: o.dmg || 0, hits: 0, offline: o.offline || 0 },
    };
}
const sevenGood = () => compute(Array.from({ length: 7 }, (_, i) => rec(i + 1, { doneFrac: 0.95, habitFrac: 0.95, dmg: 1 })), 1);

describe('liveParts: today so far', () => {
    test('a fresh day has nothing judged: null (today has no say)', () => {
        expect(liveParts(openDay())).toBeNull();
        expect(liveParts(null)).toBeNull();
    });

    test('items due LATER today are in neither done nor missed, so they never count against the player', () => {
        const p = liveParts(openDay({ doneTask: 2 }));
        expect(p.onTime).toBe(1);
        expect(p.resolved).toBe(2);
    });

    test('an overdue item still pending counts as missed; a late finish counts once (half credit), not twice', () => {
        expect(liveParts(openDay({ missedTask: 1 })).onTime).toBe(0);
        // 1 finished late (it was also bumped missed when it went overdue): due so far = 1, credit = 1 - 0.5
        const late = liveParts(openDay({ doneTask: 1, missedTask: 1, late: 1 }));
        expect(late.onTime).toBeCloseTo(0.5, 6);
        expect(late.resolved).toBe(1);
    });

    test('agrees with a closed day: the same counts give the same parts as dayParts on the stamped record', () => {
        const o = openDay({ doneTask: 3, doneHabit: 2, missedTask: 1, missedHabit: 1, dmg: 6 });
        const closed = Object.assign({}, o, { due: { task: 4, habit: 3 } });
        const live = liveParts(o);
        const c = dayParts(closed);
        expect(live.onTime).toBeCloseTo(c.onTime, 9);
        expect(live.habits).toBeCloseTo(c.habits, 9);
        expect(live.score).toBeCloseTo(c.score, 9);
        expect(live.damage).toBe(6);
    });

    test('sub-tasks are not read (v13: tasks + habits only)', () => {
        const o = openDay({ doneTask: 1 });
        o.done.subtask = 5; o.missed.subtask = 5;
        expect(liveParts(o).resolved).toBe(1);
    });

    test('Break-habit answers resolve the day too', () => {
        const p = liveParts(openDay({ avoided: 1, slipped: 1 }));
        expect(p.habits).toBe(0.5);
        expect(p.resolved).toBe(2);
    });
});

describe('withToday: the live sky', () => {
    const closed = sevenGood();

    test('no say yet (nothing judged, or under 1 resolved) -> the SAME closed object comes back', () => {
        expect(withToday(closed, openDay())).toBe(closed);
        expect(withToday(closed, null)).toBe(closed);
    });

    test('a dev-forced sky and a score-less result are left alone', () => {
        const f = forced('storm', 'down');
        expect(withToday(f, openDay({ missedTask: 3 }))).toBe(f);
        expect(withToday(null, openDay({ missedTask: 3 }))).toBeNull();
    });

    test('the ramp: one resolved item moves the sky a quarter as far as four do', () => {
        const bad1 = withToday(closed, openDay({ missedTask: 1 }));
        const bad4 = withToday(closed, openDay({ missedTask: 4 }));
        const full = closed.score - bad4.score;
        expect(full).toBeGreaterThan(0);
        expect((closed.score - bad1.score) / full).toBeCloseTo(0.25, 6);
        const bad9 = withToday(closed, openDay({ missedTask: 9 }));
        expect(bad9.score).toBeCloseTo(bad4.score, 6); // capped at full strength
    });

    test('full strength = liveWeight newest days against the closed weight (a third of the sky, not a fifth)', () => {
        const share = 2 / (2 + 0.85 * closedWeight(7));
        expect(share).toBeGreaterThan(0.3);
        const r = withToday(closed, openDay({ missedTask: 4, dmg: 25 }));
        const today = liveParts(openDay({ missedTask: 4, dmg: 25 })).score;
        expect(r.score).toBeCloseTo(closed.score * (1 - share) + today * share, 9);
    });

    test('liveWeight 1 at full strength lands close to what the day will do once it closes (no big midnight jump)', () => {
        const todayRec = openDay({ doneTask: 6, doneHabit: 2, missedTask: 0, missedHabit: 2, dmg: 3 });
        const live = withToday(closed, todayRec, { liveWeight: 1 });
        const stamped = Object.assign({}, todayRec, { date: '2026-11-08', run: 1, due: { task: 6, habit: 4 } });
        const days = Array.from({ length: 7 }, (_, i) => rec(i + 1, { doneFrac: 0.95, habitFrac: 0.95, dmg: 1 }));
        const after = compute(days.concat([stamped]), 1);
        // not exact: closing also slides the 7-day window (the oldest closed day drops out) and fades the start prior
        expect(Math.abs(live.score - after.score)).toBeLessThan(0.01);
    });

    test('a rough day pulls a mid-Hazy sky down to Overcast; a great day lifts an Overcast sky up (closed band kept for the toast)', () => {
        const hazyMid = { band: 'hazy', bandIndex: 1, score: 0.8, trend: 'steady', scoredDays: 7, usedPrior: false, recent: [] };
        const rough = withToday(hazyMid, openDay({ missedTask: 4, dmg: 5 }));
        expect(rough.band).toBe('overcast');
        expect(rough.closedBand).toBe('hazy');
        expect(rough.closedScore).toBe(0.8);
        expect(rough.live).toBe(true);
        expect(rough.today.resolved).toBe(4);
        const overcast = { band: 'overcast', bandIndex: 2, score: 0.66, trend: 'steady', scoredDays: 7, usedPrior: false, recent: [] };
        const great = withToday(overcast, openDay({ doneTask: 4, doneHabit: 4 }));
        expect(great.band).toBe('hazy');
    });

    test('trend, recent days and scoredDays stay the closed run\'s', () => {
        const r = withToday(closed, openDay({ missedTask: 4, dmg: 25 }));
        expect(r.trend).toBe(closed.trend);
        expect(r.recent).toBe(closed.recent);
        expect(r.scoredDays).toBe(closed.scoredDays);
    });

    test('hysteresis still applies from the CLOSED band: a score just past a line does not flip it', () => {
        const edge = { band: 'hazy', bandIndex: 1, score: 0.72, trend: 'steady', scoredDays: 7, usedPrior: false, recent: [] };
        // a very slightly worse today: the blended score stays within 0.03 of Hazy's 0.70 line
        const r = withToday(edge, openDay({ doneTask: 3, missedTask: 1 }));
        expect(r.band).toBe('hazy');
    });

    test('nothing is stored: the same inputs always give the same sky', () => {
        const a = withToday(closed, openDay({ missedTask: 3 }));
        const b = withToday(closed, openDay({ missedTask: 3 }));
        expect(b.band).toBe(a.band);
        expect(b.score).toBe(a.score);
    });

    test('a brand-new run (prior only) moves less than a full week would (the prior is heavy)', () => {
        const fresh = compute([], 1);
        const g = withToday(fresh, openDay({ missedTask: 4, dmg: 25 }));
        const w = withToday(closed, openDay({ missedTask: 4, dmg: 25 }));
        expect((fresh.score - g.score) / fresh.score).toBeLessThan((closed.score - w.score) / closed.score);
    });
});

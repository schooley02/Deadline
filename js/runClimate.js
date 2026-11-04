/**
 * RunClimate -- the sky's weather: how this RUN has been going over its last ~7 closed days (designed 2026-11-03, Claude app
 * session, Opus + Jeremy; docs/WORLD_FEEDBACK_PLAN.md "W1 Run climate", docs/DECISIONS.md 2026-11-03 "Run climate").
 *
 * Why it exists: today's damage / overdue / missed habits already have visuals (Base Health, red rows, check-ins), and the
 * village shows cumulative progress that only goes up. Nothing showed the run's recent TREND across everything, so the sky does.
 *
 * The rules, all pure here so they are unit-tested directly (no DOM, no State, no CONFIG reads -- the caller passes the closed
 * daily records and the options; DEFAULTS mirrors CONFIG.CLIMATE and a test checks they match, same pattern as villageProgress.js):
 *   - DAY SCORE 0..1 from one CLOSED daily record: on time (weight 0.5; a finished-late item earns half credit), habits kept
 *     (0.25: good habits done + bad habits avoided, over every habit answered or missed), church held (0.25: 1 - damage / 25 HP).
 *     A part with nothing to measure is dropped and the others renormalised; a day with no due items and no habits answered is
 *     SKIPPED (an idle or absent day neither helps nor hurts).
 *   - CLIMATE = weighted average of the last 7 scored days (the newest weighs 1, each day further back x0.85), blended with a
 *     starting prior of 0.75 (= Hazy, worth 6 days at the start) whose weight fades to zero as the run's first week fills in. A new run therefore starts at
 *     Hazy and the player clears the sky by playing well (Jeremy, 2026-11-03).
 *   - BAND from the climate: Clear >= 0.85, Hazy >= 0.70, Overcast >= 0.55, Fog >= 0.40, otherwise Storm. A band change needs
 *     the score to pass the line by HYSTERESIS (0.03) so the sky does not flicker at an edge. Nothing is stored: the band is
 *     DERIVED by replaying the run's closed days from the start (start band = the prior's band), so the same days always give
 *     the same sky.
 *   - TREND = the climate now vs the climate 3 closed days ago: >= +0.05 'up', <= -0.05 'down', else 'steady'.
 *
 * Only closed days of the CURRENT run count (rec.run === runNumber); the open day never does (a day counts once it can no longer
 * change). No new DailyRecord counters: every field read here already exists (due, done, missed, lurk, dmg).
 *
 *   result = { band, bandIndex, score, trend, scoredDays, usedPrior, recent: [ { date, score, onTime, habits, church, damage } ] }
 *   (`recent` = the last window days, NEWEST FIRST, for the future Weather panel.)
 */
const RunClimate = (() => {
    // Best -> worst. The index is the "worse than" order the hysteresis uses.
    const BANDS = ['clear', 'hazy', 'overcast', 'fog', 'storm'];

    // Mirrors CONFIG.CLIMATE (test/runClimate.test.js checks they match).
    const DEFAULTS = {
        windowDays: 7,
        decay: 0.85,
        weights: { onTime: 0.5, habits: 0.25, church: 0.25 },
        lateCredit: 0.5,
        damageCap: 25,
        startScore: 0.75,
        startWeightDays: 6,
        thresholds: { clear: 0.85, hazy: 0.70, overcast: 0.55, fog: 0.40 },
        hysteresis: 0.03,
        trendDays: 3,
        trendDelta: 0.05,
    };

    function num(v) { return Number.isFinite(v) && v > 0 ? v : 0; }
    function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

    function opts(o) {
        const src = o || {};
        return Object.assign({}, DEFAULTS, src, {
            weights: Object.assign({}, DEFAULTS.weights, src.weights || {}),
            thresholds: Object.assign({}, DEFAULTS.thresholds, src.thresholds || {}),
        });
    }

    /**
     * One closed day -> { score, onTime, habits, church } (each 0..1 or null when that part had nothing to measure), or null
     * when the day is skipped (nothing due and no habit answered). Defensive about missing fields (older records).
     */
    function partsWith(rec, o) {
        if (!rec || typeof rec !== 'object') return null;
        const w = o.weights;
        const due = rec.due || {}, done = rec.done || {}, missed = rec.missed || {}, lurk = rec.lurk || {}, dmg = rec.dmg || {};

        const dueN = num(due.task) + num(due.habit);
        const onTime = dueN > 0
            ? clamp01((num(done.task) + num(done.habit) - (1 - o.lateCredit) * num(done.late)) / dueN)
            : null;

        const habitDen = num(done.habit) + num(missed.habit) + num(lurk.avoided) + num(lurk.slipped);
        const habits = habitDen > 0 ? clamp01((num(done.habit) + num(lurk.avoided)) / habitDen) : null;

        if (onTime === null && habits === null) return null; // idle day: nothing to judge

        const cap = o.damageCap > 0 ? o.damageCap : 1;
        const church = clamp01(1 - (num(dmg.taken) + num(dmg.offline)) / cap);

        let sum = 0, wsum = 0;
        if (onTime !== null) { sum += w.onTime * onTime; wsum += w.onTime; }
        if (habits !== null) { sum += w.habits * habits; wsum += w.habits; }
        sum += w.church * church; wsum += w.church;
        // `damage` = the HP the church lost that day (shown in the Weather panel; the score uses `church`)
        return { score: wsum > 0 ? clamp01(sum / wsum) : null, onTime, habits, church, damage: num(dmg.taken) + num(dmg.offline) };
    }

    function dayParts(rec, options) { return partsWith(rec, opts(options)); }

    function dayScore(rec, options) {
        const p = partsWith(rec, opts(options));
        return p ? p.score : null;
    }

    // `days` may be an array of records, the `deadline.days` store ({ days: {...} }) or its `.days` map.
    function recordList(days) {
        if (Array.isArray(days)) return days;
        if (days && typeof days === 'object') {
            const map = (days.days && typeof days.days === 'object') ? days.days : days;
            return Object.keys(map).map(k => map[k]);
        }
        return [];
    }

    /** This run's scored closed days, oldest first: [{ date, score, onTime, habits, church }]. */
    function scoredDays(days, runNumber, options) {
        const o = opts(options);
        return recordList(days)
            .filter(r => r && typeof r === 'object' && r.run === runNumber && typeof r.date === 'string')
            .sort((a, b) => (a.date < b.date ? -1 : (a.date > b.date ? 1 : 0)))
            .map(r => { const p = partsWith(r, o); return p ? Object.assign({ date: r.date }, p) : null; })
            .filter(Boolean);
    }

    /** The climate (0..1) after the first `count` scored days of `series` (count 0 = the starting prior alone). */
    function climateAfter(series, count, options) {
        const o = opts(options);
        const n = Math.max(0, Math.min(count, series.length));
        const used = series.slice(Math.max(0, n - o.windowDays), n);
        let sum = 0, wsum = 0;
        for (let i = 0; i < used.length; i++) {
            const age = used.length - 1 - i; // 0 = newest
            const wt = Math.pow(o.decay, age);
            sum += wt * used[i].score;
            wsum += wt;
        }
        // The prior fades as the first window fills; after a full window it has no say.
        const priorW = Math.max(0, o.startWeightDays * (1 - Math.min(n, o.windowDays) / o.windowDays));
        sum += priorW * o.startScore;
        wsum += priorW;
        return wsum > 0 ? sum / wsum : o.startScore;
    }

    /** Raw band index for a score, no hysteresis. */
    function rawBandIndex(score, options) {
        const t = opts(options).thresholds;
        if (score >= t.clear) return 0;
        if (score >= t.hazy) return 1;
        if (score >= t.overcast) return 2;
        if (score >= t.fog) return 3;
        return 4;
    }

    /** The lower edge of band `idx` (the score that keeps it); Storm has none. */
    function lowerEdge(idx, t) {
        return [t.clear, t.hazy, t.overcast, t.fog][idx];
    }

    /**
     * The band after a new score, given the band we were in (index 0..4). Moving to a better band needs the score to pass that
     * band's line by `hysteresis`; moving to a worse band needs it to fall below the current band's line by `hysteresis`.
     */
    function nextBandIndex(prevIdx, score, options) {
        const o = opts(options);
        const raw = rawBandIndex(score, o);
        if (raw === prevIdx) return prevIdx;
        if (raw < prevIdx) {
            // better: take the best band whose line (+ hysteresis) the score clears, never beyond the raw band
            for (let k = raw; k < prevIdx; k++) {
                if (score >= lowerEdge(k, o.thresholds) + o.hysteresis) return k;
            }
            return prevIdx;
        }
        // worse: only once clearly below the band we are in
        return score < lowerEdge(prevIdx, o.thresholds) - o.hysteresis ? raw : prevIdx;
    }

    /**
     * Replay the run's closed days and return the sky.
     *   days       closed daily records (array / store / map)
     *   runNumber  the run to read (runHistory.length + 1 while playing)
     */
    function compute(days, runNumber, options) {
        const o = opts(options);
        const series = scoredDays(days, runNumber, o);
        let band = rawBandIndex(o.startScore, o);
        for (let i = 1; i <= series.length; i++) {
            band = nextBandIndex(band, climateAfter(series, i, o), o);
        }
        const score = climateAfter(series, series.length, o);

        let trend = 'steady';
        if (series.length >= 2) {
            const ref = climateAfter(series, Math.max(0, series.length - o.trendDays), o);
            const d = score - ref;
            if (d >= o.trendDelta) trend = 'up';
            else if (d <= -o.trendDelta) trend = 'down';
        }

        return {
            band: BANDS[band],
            bandIndex: band,
            score,
            trend,
            scoredDays: series.length,
            usedPrior: series.length < o.windowDays,
            recent: series.slice(-o.windowDays).reverse(),
        };
    }

    /** A fake result for the dev override (?climate=fog&trend=up): { band, trend } only. */
    function forced(band, trend) {
        const idx = BANDS.indexOf(band);
        if (idx < 0) return null;
        const t = (trend === 'up' || trend === 'down') ? trend : 'steady';
        return { band: BANDS[idx], bandIndex: idx, score: null, trend: t, scoredDays: 0, usedPrior: false, recent: [], forced: true };
    }

    return { BANDS, DEFAULTS, dayParts, dayScore, scoredDays, climateAfter, rawBandIndex, nextBandIndex, compute, forced };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RunClimate;
}

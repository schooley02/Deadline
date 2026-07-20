/**
 * Run History sub-session 5 polish (RUN_HISTORY_PLAN.md, session 69) —
 * best-run detection, vs-last-run deltas, and the run-card/delta string
 * builders. Requires the REAL modules (stats-routine-performance.test.js
 * precedent). renderStatsWindow's delegation wiring (expand/collapse click
 * + keyboard) is DOM-only and stays live-verified in Chrome.
 */
const RunStats = require('../js/runStats.js');
const StatsView = require('../js/ui/statsView.js');

function record(runNumber, daysSurvived, overrides = {}) {
    return {
        runNumber,
        startedAtMs: 1000,
        endedAtMs: 2000,
        daysSurvived,
        endReason: 'base_destroyed',
        totals: {
            tasksCompleted: 5, habitsCompleted: 3, habitsMissed: 1, pointsEarned: 50,
            ...(overrides.totals || {}),
        },
        blame: overrides.blame || [],
        routines: overrides.routines || [],
    };
}

describe('RunStats.bestRunNumber', () => {
    test('empty/missing history → null', () => {
        expect(RunStats.bestRunNumber([])).toBeNull();
        expect(RunStats.bestRunNumber(null)).toBeNull();
    });

    test('single run is the best run', () => {
        expect(RunStats.bestRunNumber([record(1, 3)])).toBe(1);
    });

    test('most days survived wins', () => {
        const history = [record(3, 2), record(2, 7), record(1, 4)]; // newest-first
        expect(RunStats.bestRunNumber(history)).toBe(2);
    });

    test('days tie → higher pointsEarned wins', () => {
        const history = [
            record(2, 5, { totals: { pointsEarned: 90 } }),
            record(1, 5, { totals: { pointsEarned: 40 } }),
        ];
        expect(RunStats.bestRunNumber(history)).toBe(2);
    });

    test('full tie → EARLIEST run keeps the record (a later tie does not steal the badge)', () => {
        const history = [record(3, 5), record(2, 5), record(1, 5)];
        expect(RunStats.bestRunNumber(history)).toBe(1);
    });

    test('missing totals treated as 0 points, not a crash', () => {
        const bare = { runNumber: 2, daysSurvived: 5 };
        const history = [bare, record(1, 5, { totals: { pointsEarned: 10 } })];
        expect(RunStats.bestRunNumber(history)).toBe(1);
    });
});

describe('RunStats.deltasVsLastRun', () => {
    test('no prior run → null (panel renders no deltas at all)', () => {
        expect(RunStats.deltasVsLastRun(RunStats.freshRunStats(), 0, null)).toBeNull();
        expect(RunStats.deltasVsLastRun(RunStats.freshRunStats(), 0, undefined)).toBeNull();
    });

    test('current − last across all five metrics', () => {
        const stats = { tasksCompleted: 8, habitsCompleted: 2, habitsMissed: 0, pointsEarned: 75, blame: {} };
        const last = record(1, 4, { totals: { tasksCompleted: 5, habitsCompleted: 3, habitsMissed: 1, pointsEarned: 50 } });
        expect(RunStats.deltasVsLastRun(stats, 6, last)).toEqual({
            daysSurvived: 2,
            tasksCompleted: 3,
            habitsCompleted: -1,
            habitsMissed: -1,
            pointsEarned: 25,
        });
    });

    test('null stats falls back to a fresh accumulator (all-negative vs any real last run)', () => {
        const last = record(1, 4);
        const d = RunStats.deltasVsLastRun(null, 0, last);
        expect(d.tasksCompleted).toBe(-5);
        expect(d.daysSurvived).toBe(-4);
    });
});

describe('StatsView.formatDeltaBadge', () => {
    test('positive/negative/zero text', () => {
        expect(StatsView.formatDeltaBadge(3, true)).toContain('+3');
        expect(StatsView.formatDeltaBadge(-2, true)).toContain('−2');
        expect(StatsView.formatDeltaBadge(0, true)).toContain('±0');
    });

    test('improvement direction: up-good gets the green class only when positive', () => {
        expect(StatsView.formatDeltaBadge(3, true)).toContain('stats-delta-up');
        expect(StatsView.formatDeltaBadge(-3, true)).not.toContain('stats-delta-up');
    });

    test('improvement direction: down-good (habitsMissed) inverts', () => {
        expect(StatsView.formatDeltaBadge(-1, false)).toContain('stats-delta-up');
        expect(StatsView.formatDeltaBadge(1, false)).not.toContain('stats-delta-up');
        expect(StatsView.formatDeltaBadge(0, false)).not.toContain('stats-delta-up');
    });

    test('non-number → empty string', () => {
        expect(StatsView.formatDeltaBadge(null, true)).toBe('');
        expect(StatsView.formatDeltaBadge(undefined, true)).toBe('');
    });
});

describe('StatsView.buildRunCard — expandable + best badge', () => {
    test('best run carries the 🏆 badge; others do not', () => {
        expect(StatsView.buildRunCard(record(1, 5), true)).toContain('Best run');
        expect(StatsView.buildRunCard(record(1, 5), false)).not.toContain('Best run');
    });

    test('details section is ALWAYS rendered (expansion is CSS-only, no rebuild)', () => {
        const html = StatsView.buildRunCard(record(2, 5), false);
        expect(html).toContain('stats-run-card-details');
        expect(html).toContain('All offenders');
        expect(html).toContain('aria-expanded="false"');
        expect(html).toContain('data-run-number="2"');
        expect(html).toContain('role="button"');
    });

    test('collapsed summary blame wrapper present alongside details (CSS swaps them)', () => {
        const html = StatsView.buildRunCard(record(1, 5), false);
        expect(html).toContain('stats-run-card-summary-blame');
    });

    test('routines snapshot renders inside details only when the record has routines', () => {
        const withRoutines = StatsView.buildRunCard(record(1, 5, {
            routines: [{
                routineId: 'r1', name: 'Morning', level: 3, stars: 4,
                completionRate: { rate: 0.8, samples: 5 }, memberDamage: 12,
                wasFrozenAtEnd: false, wasKOdAtEnd: false,
            }],
        }), false);
        expect(withRoutines).toContain('Routines this run');
        expect(withRoutines).toContain('Morning');
        expect(withRoutines).toContain('Lv3 4★');
        expect(withRoutines).toContain('80%');

        const without = StatsView.buildRunCard(record(1, 5), false);
        expect(without).not.toContain('Routines this run');
    });

    test('end-reason line renders the friendly base-destroyed label', () => {
        expect(StatsView.buildRunCard(record(1, 5), false)).toContain('Base destroyed');
    });
});

describe('StatsView.buildRunRoutineRow — badges', () => {
    test('KO and frozen badges render from end-state flags', () => {
        const html = StatsView.buildRunRoutineRow({
            name: 'Evening', level: 2, stars: null,
            completionRate: { rate: null, samples: 0 }, memberDamage: 0,
            wasFrozenAtEnd: true, wasKOdAtEnd: true,
        });
        expect(html).toContain('KO\'d');
        expect(html).toContain('Frozen');
        expect(html).toContain('—'); // unrated stars + rate
    });
});

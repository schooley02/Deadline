/**
 * RunStats pure-core tests — run history sub-session 1 (2026-07-19,
 * session 52; docs/RUN_HISTORY_PLAN.md, forks in DECISIONS.md session 52).
 *
 * Covers: fresh shape, blame identity (recurring defs aggregate, one-offs
 * don't), damage upsert math + first/last timestamps, counters, blame
 * sorting, finalizeRun (totals + sorted blame + per-routine rollup), and
 * the newest-first capped history append.
 */
const RunStats = require('../js/runStats.js');

const T0 = 1750000000000;

function makeTask(over = {}) {
    return { id: 7, type: 'task', name: 'Quarterly taxes', category: 'chores',
             definitionId: null, ...over };
}
function makeHabitInstance(over = {}) {
    return { id: 21, type: 'habit', name: 'Gym', category: 'health',
             definitionId: 'h1', ...over };
}

describe('freshRunStats', () => {
    test('zeroed counters and an empty blame map', () => {
        expect(RunStats.freshRunStats()).toEqual({
            tasksCompleted: 0, habitsCompleted: 0, habitsMissed: 0,
            pointsEarned: 0, blame: {},
        });
    });

    test('returns a new object each call (no shared state)', () => {
        const a = RunStats.freshRunStats();
        const b = RunStats.freshRunStats();
        a.tasksCompleted = 5;
        a.blame.x = {};
        expect(b.tasksCompleted).toBe(0);
        expect(b.blame).toEqual({});
    });
});

describe('blameKeyFor — blame identity', () => {
    test('habit instances of the same definition share a key across days', () => {
        const mon = makeHabitInstance({ id: 21 });
        const tue = makeHabitInstance({ id: 40 });
        expect(RunStats.blameKeyFor(mon)).toBe(RunStats.blameKeyFor(tue));
    });

    test('routine-owned task instances (definitionId set) aggregate too', () => {
        const a = makeTask({ id: 3, definitionId: 'td9' });
        const b = makeTask({ id: 8, definitionId: 'td9' });
        expect(RunStats.blameKeyFor(a)).toBe(RunStats.blameKeyFor(b));
    });

    test('a habit def and a task def with the same definitionId do NOT collide', () => {
        expect(RunStats.blameKeyFor(makeHabitInstance({ definitionId: 'x' })))
            .not.toBe(RunStats.blameKeyFor(makeTask({ definitionId: 'x' })));
    });

    test('one-off tasks key by instance id', () => {
        expect(RunStats.blameKeyFor(makeTask({ id: 7 })))
            .not.toBe(RunStats.blameKeyFor(makeTask({ id: 8 })));
    });
});

describe('recordDamage — aggregate upsert', () => {
    test('first hit creates the row with identity, damage, and both timestamps', () => {
        const stats = RunStats.freshRunStats();
        RunStats.recordDamage(stats, makeHabitInstance(), 1, T0, 'r1');
        const row = stats.blame[RunStats.blameKeyFor(makeHabitInstance())];
        expect(row).toEqual({
            name: 'Gym', category: 'health', isHabit: true, routineId: 'r1',
            totalDamage: 1, firstDamageAt: T0, lastDamageAt: T0,
        });
    });

    test('later hits accumulate damage and advance only lastDamageAt', () => {
        const stats = RunStats.freshRunStats();
        const item = makeTask();
        RunStats.recordDamage(stats, item, 1, T0);
        RunStats.recordDamage(stats, item, 1, T0 + 300000);
        RunStats.recordDamage(stats, item, 3, T0 + 600000);
        const row = stats.blame[RunStats.blameKeyFor(item)];
        expect(row.totalDamage).toBe(5);
        expect(row.firstDamageAt).toBe(T0);
        expect(row.lastDamageAt).toBe(T0 + 600000);
    });

    test('same habit definition across different instances lands in one row', () => {
        const stats = RunStats.freshRunStats();
        RunStats.recordDamage(stats, makeHabitInstance({ id: 21 }), 2, T0);
        RunStats.recordDamage(stats, makeHabitInstance({ id: 40 }), 3, T0 + 1);
        expect(Object.keys(stats.blame)).toHaveLength(1);
        expect(Object.values(stats.blame)[0].totalDamage).toBe(5);
    });

    test('routineId defaults to null; missing category stored as null', () => {
        const stats = RunStats.freshRunStats();
        RunStats.recordDamage(stats, makeTask({ category: undefined }), 1, T0);
        const row = Object.values(stats.blame)[0];
        expect(row.routineId).toBeNull();
        expect(row.category).toBeNull();
    });

    test('zero/negative damage and null stats/item are safe no-ops', () => {
        const stats = RunStats.freshRunStats();
        RunStats.recordDamage(stats, makeTask(), 0, T0);
        RunStats.recordDamage(stats, makeTask(), -2, T0);
        RunStats.recordDamage(stats, null, 1, T0);
        RunStats.recordDamage(null, makeTask(), 1, T0);
        expect(stats.blame).toEqual({});
    });
});

describe('counters', () => {
    test('completion/miss counters increment independently', () => {
        const stats = RunStats.freshRunStats();
        RunStats.recordTaskCompleted(stats);
        RunStats.recordTaskCompleted(stats);
        RunStats.recordHabitCompleted(stats);
        RunStats.recordHabitMissed(stats);
        expect(stats).toMatchObject({
            tasksCompleted: 2, habitsCompleted: 1, habitsMissed: 1,
        });
    });

    test('pointsEarned accrues gross earnings; zero/negative ignored', () => {
        const stats = RunStats.freshRunStats();
        RunStats.recordPointsEarned(stats, 10);
        RunStats.recordPointsEarned(stats, 8);
        RunStats.recordPointsEarned(stats, 0);
        RunStats.recordPointsEarned(stats, -5);
        expect(stats.pointsEarned).toBe(18);
    });

    test('all counter fns tolerate null stats', () => {
        expect(() => {
            RunStats.recordTaskCompleted(null);
            RunStats.recordHabitCompleted(null);
            RunStats.recordHabitMissed(null);
            RunStats.recordPointsEarned(null, 5);
        }).not.toThrow();
    });
});

describe('sortedBlame', () => {
    test('sorts by damage desc, ties broken by earlier first offender', () => {
        const blame = {
            a: { name: 'A', totalDamage: 5, firstDamageAt: T0 + 9 },
            b: { name: 'B', totalDamage: 12, firstDamageAt: T0 + 5 },
            c: { name: 'C', totalDamage: 5, firstDamageAt: T0 + 1 },
        };
        expect(RunStats.sortedBlame(blame).map(r => r.name)).toEqual(['B', 'C', 'A']);
    });

    test('empty/absent map gives an empty array', () => {
        expect(RunStats.sortedBlame({})).toEqual([]);
        expect(RunStats.sortedBlame(null)).toEqual([]);
    });
});

describe('finalizeRun', () => {
    function buildStats() {
        const stats = RunStats.freshRunStats();
        RunStats.recordDamage(stats, makeTask({ id: 7, name: 'Taxes' }), 60, T0 + 1000);
        RunStats.recordDamage(stats, makeHabitInstance(), 25, T0 + 2000, 'r1');
        RunStats.recordTaskCompleted(stats);
        RunStats.recordHabitCompleted(stats);
        RunStats.recordHabitMissed(stats);
        RunStats.recordPointsEarned(stats, 30);
        return stats;
    }

    const ctx = {
        runNumber: 3,
        startedAtMs: T0,
        endedAtMs: T0 + 12 * 86400000,
        daysSurvived: 12,
        definedRoutines: [
            { id: 'r1', name: 'Morning', level: 4, frozenState: null, koState: { koAtMs: T0 } },
            { id: 'r2', name: 'Evening', level: 1, frozenState: { frozenBy: 'h9' }, koState: null },
        ],
        definedHabits: [],
        // Faithful to the REAL Heroes.completionRate contract: returns the
        // { rate, samples } object (rate null when unrated), NOT a bare number.
        // The old mock returned a bare number, which is exactly why the
        // "object passed straight to starRating" bug went uncaught (stars was
        // silently 0 on every finalized routine in production).
        completionRate: (routine) => (routine.id === 'r1'
            ? { rate: 0.92, samples: 10 }
            : { rate: null, samples: 0 }),
        starRating: (rate) => (rate >= 0.9 ? 4 : 0),
    };

    test('freezes totals, sorted blame, and run identity; defaults endReason', () => {
        const record = RunStats.finalizeRun(buildStats(), ctx);
        expect(record).toMatchObject({
            runNumber: 3, startedAtMs: T0, daysSurvived: 12,
            endReason: 'base_destroyed',
            totals: { tasksCompleted: 1, habitsCompleted: 1, habitsMissed: 1, pointsEarned: 30 },
        });
        expect(record.blame.map(r => r.name)).toEqual(['Taxes', 'Gym']);
        expect(record.totals.blame).toBeUndefined();
    });

    test('per-routine rollup: rate/stars via injected fns, memberDamage summed by routineId, end-state flags', () => {
        const record = RunStats.finalizeRun(buildStats(), ctx);
        const [r1, r2] = record.routines;
        // starRating receives the unwrapped numeric rate (cr.rate), and the
        // record stores the whole { rate, samples } object as completionRate
        // (persistence.js's 10→11 sweep + Steady Hands read `.rate` off it).
        expect(r1).toEqual({
            routineId: 'r1', name: 'Morning', level: 4, stars: 4,
            completionRate: { rate: 0.92, samples: 10 }, memberDamage: 25,
            wasFrozenAtEnd: false, wasKOdAtEnd: true,
        });
        // Unrated routine (rate null): stars null → "—", not a misleading 0★.
        expect(r2).toMatchObject({
            routineId: 'r2', stars: null, completionRate: { rate: null, samples: 0 },
            memberDamage: 0, wasFrozenAtEnd: true, wasKOdAtEnd: false,
        });
    });

    test('completionRate is windowed to the run start', () => {
        const seen = [];
        RunStats.finalizeRun(buildStats(), {
            ...ctx,
            completionRate: (routine, habits, windowStartMs) => { seen.push(windowStartMs); return null; },
        });
        expect(seen).toEqual([T0, T0]);
    });

    test('tolerates null stats and missing routines (empty run record)', () => {
        const record = RunStats.finalizeRun(null, {
            runNumber: 1, startedAtMs: T0, endedAtMs: T0 + 1, daysSurvived: 0,
        });
        expect(record.blame).toEqual([]);
        expect(record.routines).toEqual([]);
        expect(record.totals.tasksCompleted).toBe(0);
    });
});

describe('appendToHistory', () => {
    test('appends newest-first and returns a NEW array', () => {
        const history = [{ runNumber: 1 }];
        const next = RunStats.appendToHistory(history, { runNumber: 2 }, 50);
        expect(next.map(r => r.runNumber)).toEqual([2, 1]);
        expect(history).toHaveLength(1); // untouched
    });

    test('caps at max, dropping the oldest', () => {
        const history = [{ runNumber: 3 }, { runNumber: 2 }, { runNumber: 1 }];
        const next = RunStats.appendToHistory(history, { runNumber: 4 }, 3);
        expect(next.map(r => r.runNumber)).toEqual([4, 3, 2]);
    });

    test('tolerates null history and a missing cap', () => {
        expect(RunStats.appendToHistory(null, { runNumber: 1 }, 50))
            .toEqual([{ runNumber: 1 }]);
        expect(RunStats.appendToHistory([{ runNumber: 1 }], { runNumber: 2 }, undefined))
            .toHaveLength(2);
    });
});

describe('rollupRoutinePerformance — per-routine rollup across runs (sub-session 4)', () => {
    function routineRow(over = {}) {
        return {
            routineId: 'r1', name: 'Morning', level: 3, stars: 3,
            completionRate: 0.8, memberDamage: 10,
            wasFrozenAtEnd: false, wasKOdAtEnd: false, ...over,
        };
    }
    function record(over = {}) {
        return { runNumber: 1, endedAtMs: T0, routines: [routineRow()], ...over };
    }

    test('empty/missing history -> empty array', () => {
        expect(RunStats.rollupRoutinePerformance([], 5)).toEqual([]);
        expect(RunStats.rollupRoutinePerformance(null, 5)).toEqual([]);
    });

    test('groups by routineId across multiple runs, entries newest-first (input order preserved)', () => {
        const history = [
            record({ runNumber: 3, endedAtMs: T0 + 2, routines: [routineRow({ level: 5 })] }),
            record({ runNumber: 2, endedAtMs: T0 + 1, routines: [routineRow({ level: 4 })] }),
            record({ runNumber: 1, endedAtMs: T0, routines: [routineRow({ level: 3 })] }),
        ];
        const [group] = RunStats.rollupRoutinePerformance(history, 10);
        expect(group.routineId).toBe('r1');
        expect(group.entries.map(e => e.runNumber)).toEqual([3, 2, 1]);
        expect(group.entries.map(e => e.level)).toEqual([5, 4, 3]);
    });

    test('name uses the most-recently-seen record (newest-first input)', () => {
        const history = [
            record({ runNumber: 2, routines: [routineRow({ name: 'Morning Ritual (renamed)' })] }),
            record({ runNumber: 1, routines: [routineRow({ name: 'Morning' })] }),
        ];
        const [group] = RunStats.rollupRoutinePerformance(history, 10);
        expect(group.name).toBe('Morning Ritual (renamed)');
    });

    test('two different routines in the same run produce two groups', () => {
        const history = [record({
            routines: [routineRow({ routineId: 'r1' }), routineRow({ routineId: 'r2', name: 'Evening' })],
        })];
        const groups = RunStats.rollupRoutinePerformance(history, 10);
        expect(groups.map(g => g.routineId)).toEqual(['r1', 'r2']);
    });

    test('caps entries per routine at maxRunsPerRoutine, keeping the newest', () => {
        const history = [3, 2, 1].map(n => record({ runNumber: n, routines: [routineRow()] }));
        const [group] = RunStats.rollupRoutinePerformance(history, 2);
        expect(group.entries.map(e => e.runNumber)).toEqual([3, 2]);
    });

    test('a non-positive/missing cap is treated as unlimited', () => {
        const history = [3, 2, 1].map(n => record({ runNumber: n, routines: [routineRow()] }));
        expect(RunStats.rollupRoutinePerformance(history, 0)[0].entries).toHaveLength(3);
        expect(RunStats.rollupRoutinePerformance(history, undefined)[0].entries).toHaveLength(3);
    });

    test('runs with no routines (older records / no routines defined) contribute nothing', () => {
        const history = [{ runNumber: 1, endedAtMs: T0, routines: [] }, { runNumber: 2, endedAtMs: T0 }];
        expect(RunStats.rollupRoutinePerformance(history, 5)).toEqual([]);
    });

    test('entry shape carries level/stars/completionRate/memberDamage/frozen/KO + run identity', () => {
        const history = [record({
            routines: [routineRow({
                stars: null, completionRate: null, wasFrozenAtEnd: true, wasKOdAtEnd: false,
            })],
        })];
        const [group] = RunStats.rollupRoutinePerformance(history, 5);
        expect(group.entries[0]).toEqual({
            runNumber: 1, endedAtMs: T0, level: 3, stars: null, completionRate: null,
            memberDamage: 10, wasFrozenAtEnd: true, wasKOdAtEnd: false,
        });
    });

    test('does not mutate the input runHistory', () => {
        const history = [record()];
        const snapshot = JSON.stringify(history);
        RunStats.rollupRoutinePerformance(history, 5);
        expect(JSON.stringify(history)).toBe(snapshot);
    });
});

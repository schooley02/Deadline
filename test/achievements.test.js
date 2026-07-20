/**
 * Achievements pure-core tests — achievements & badges sub-session 1
 * (2026-07-20, session 64; docs/ACHIEVEMENTS_PLAN.md, forks in
 * DECISIONS.md session 64).
 *
 * Covers: fresh shapes, per-family tier evaluation, catalog-wide
 * evaluation (idempotent — no re-unlock of an already-recorded tier),
 * and unlock recording (replace, don't mutate).
 */
const Achievements = require('../js/achievements.js');

function family(over = {}) {
    return {
        id: 'survivor', name: 'Survivor', metric: 'bestRunDaysSurvived',
        tiers: [
            { id: 'survivor_1', label: 'Bronze', threshold: 3 },
            { id: 'survivor_2', label: 'Silver', threshold: 7 },
            { id: 'survivor_3', label: 'Gold', threshold: 14 },
        ],
        ...over,
    };
}

describe('freshLifetimeStats', () => {
    test('all counters zeroed', () => {
        expect(Achievements.freshLifetimeStats()).toEqual({
            tasksCompleted: 0,
            habitsCompleted: 0,
            bestRunDaysSurvived: 0,
            bestHabitStreak: 0,
            steadyRoutineRuns: 0,
            pointsRecoveries: 0,
        });
    });

    test('returns a new object each call (no shared state)', () => {
        const a = Achievements.freshLifetimeStats();
        const b = Achievements.freshLifetimeStats();
        a.tasksCompleted = 99;
        expect(b.tasksCompleted).toBe(0);
    });
});

describe('freshUnlocked', () => {
    test('empty map', () => {
        expect(Achievements.freshUnlocked()).toEqual({});
    });

    test('returns a new object each call', () => {
        const a = Achievements.freshUnlocked();
        a.foo = 'bar';
        expect(Achievements.freshUnlocked()).toEqual({});
    });
});

describe('evaluateFamily', () => {
    test('below the lowest tier: nothing crossed', () => {
        expect(Achievements.evaluateFamily(family(), 2, {})).toEqual([]);
    });

    test('crossing the first tier only', () => {
        const result = Achievements.evaluateFamily(family(), 5, {});
        expect(result.map(t => t.id)).toEqual(['survivor_1']);
    });

    test('crossing multiple tiers at once (e.g. retro sweep on an old save)', () => {
        const result = Achievements.evaluateFamily(family(), 20, {});
        expect(result.map(t => t.id)).toEqual(['survivor_1', 'survivor_2', 'survivor_3']);
    });

    test('already-unlocked tiers are excluded even if still qualifying', () => {
        const result = Achievements.evaluateFamily(family(), 20, { survivor_1: '2026-01-01T00:00:00.000Z' });
        expect(result.map(t => t.id)).toEqual(['survivor_2', 'survivor_3']);
    });

    test('non-numeric value: nothing crossed (no throw)', () => {
        expect(Achievements.evaluateFamily(family(), undefined, {})).toEqual([]);
        expect(Achievements.evaluateFamily(family(), null, {})).toEqual([]);
    });

    test('malformed family (no tiers array): nothing crossed', () => {
        expect(Achievements.evaluateFamily({ id: 'x' }, 5, {})).toEqual([]);
        expect(Achievements.evaluateFamily(null, 5, {})).toEqual([]);
    });
});

describe('evaluateAll', () => {
    const catalog = [
        family(),
        {
            id: 'task_slayer', name: 'Task Slayer', metric: 'tasksCompleted',
            tiers: [{ id: 'task_slayer_1', label: 'Bronze', threshold: 10 }],
        },
    ];

    test('evaluates every family against the matching lifetimeStats metric', () => {
        const stats = { bestRunDaysSurvived: 8, tasksCompleted: 12 };
        const result = Achievements.evaluateAll(catalog, stats, {});
        expect(result.map(t => t.tierId).sort()).toEqual(['survivor_1', 'survivor_2', 'task_slayer_1']);
        expect(result[0]).toMatchObject({ familyId: 'survivor', familyName: 'Survivor' });
    });

    test('a metric absent from lifetimeStats is skipped, not thrown', () => {
        const result = Achievements.evaluateAll(catalog, { tasksCompleted: 50 }, {});
        expect(result.map(t => t.tierId)).toEqual(['task_slayer_1']);
    });

    test('idempotent: re-running against the same lifetimeStats + the previous result recorded returns nothing new', () => {
        const stats = { bestRunDaysSurvived: 8, tasksCompleted: 12 };
        const first = Achievements.evaluateAll(catalog, stats, {});
        const unlocked = Achievements.recordUnlocks({}, first, '2026-07-20T00:00:00.000Z');
        const second = Achievements.evaluateAll(catalog, stats, unlocked);
        expect(second).toEqual([]);
    });

    test('empty/missing catalog or stats: returns []', () => {
        expect(Achievements.evaluateAll([], {}, {})).toEqual([]);
        expect(Achievements.evaluateAll(null, null, null)).toEqual([]);
    });
});

describe('recordUnlocks', () => {
    test('stamps every newly-crossed tier with the given timestamp', () => {
        const newly = [{ tierId: 'survivor_1' }, { tierId: 'survivor_2' }];
        const result = Achievements.recordUnlocks({}, newly, '2026-07-20T12:00:00.000Z');
        expect(result).toEqual({
            survivor_1: '2026-07-20T12:00:00.000Z',
            survivor_2: '2026-07-20T12:00:00.000Z',
        });
    });

    test('does not mutate the input map (replace, not mutate)', () => {
        const existing = { survivor_1: '2026-01-01T00:00:00.000Z' };
        const result = Achievements.recordUnlocks(existing, [{ tierId: 'survivor_2' }], '2026-07-20T00:00:00.000Z');
        expect(existing).toEqual({ survivor_1: '2026-01-01T00:00:00.000Z' });
        expect(result).toEqual({
            survivor_1: '2026-01-01T00:00:00.000Z',
            survivor_2: '2026-07-20T00:00:00.000Z',
        });
    });

    test('no newly-crossed tiers: returns the existing map unchanged', () => {
        const existing = { survivor_1: '2026-01-01T00:00:00.000Z' };
        expect(Achievements.recordUnlocks(existing, [], '2026-07-20T00:00:00.000Z')).toBe(existing);
        expect(Achievements.recordUnlocks(existing, null, '2026-07-20T00:00:00.000Z')).toBe(existing);
    });

    test('a missing existing map defaults to {}', () => {
        const result = Achievements.recordUnlocks(undefined, [{ tierId: 'survivor_1' }], '2026-07-20T00:00:00.000Z');
        expect(result).toEqual({ survivor_1: '2026-07-20T00:00:00.000Z' });
    });
});

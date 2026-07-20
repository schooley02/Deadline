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
        id: 'survivor', name: 'Survivor', metric: 'bestRunDaysSurvived', nearMissUnit: 'day',
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

describe('nextLockedTier', () => {
    test('first tier not yet in unlocked', () => {
        expect(Achievements.nextLockedTier(family(), {}).id).toBe('survivor_1');
    });

    test('skips already-unlocked tiers', () => {
        expect(Achievements.nextLockedTier(family(), { survivor_1: '2026-01-01T00:00:00.000Z' }).id).toBe('survivor_2');
    });

    test('every tier unlocked: returns null', () => {
        const unlocked = { survivor_1: 'x', survivor_2: 'x', survivor_3: 'x' };
        expect(Achievements.nextLockedTier(family(), unlocked)).toBeNull();
    });

    test('malformed family: returns null, no throw', () => {
        expect(Achievements.nextLockedTier({ id: 'x' }, {})).toBeNull();
        expect(Achievements.nextLockedTier(null, {})).toBeNull();
    });
});

describe('nearMissNudges (sub-session 4 polish, session 68)', () => {
    const catalog = [
        family(), // survivor: Bronze @3, Silver @7, Gold @14
        {
            id: 'task_slayer', name: 'Task Slayer', metric: 'tasksCompleted', nearMissUnit: 'task',
            tiers: [{ id: 'task_slayer_1', label: 'Bronze', threshold: 10 }],
        },
    ];

    test('default 0.8 threshold: exactly 80% of the next locked tier is included (inclusive boundary)', () => {
        const unlocked = { survivor_1: '2026-01-01T00:00:00.000Z', survivor_2: '2026-01-01T00:00:00.000Z' }; // next locked = Gold@14
        const result = Achievements.nearMissNudges(catalog, { bestRunDaysSurvived: 11.2 }, unlocked); // 11.2/14 = exactly 0.8
        expect(result.find(n => n.familyId === 'survivor')).toBeDefined();
    });

    test('a value that already crossed a tier no one has unlocked yet is NOT a near-miss (progress must stay below 1)', () => {
        // next locked tier is Bronze@3 (nothing recorded unlocked); value 8 already blows past it
        const result = Achievements.nearMissNudges(catalog, { bestRunDaysSurvived: 8 }, {});
        expect(result.find(n => n.familyId === 'survivor')).toBeUndefined();
    });

    test('near-miss: value at or above threshold * pct but below threshold', () => {
        const unlocked = { survivor_1: '2026-01-01T00:00:00.000Z', survivor_2: '2026-01-01T00:00:00.000Z' }; // next locked = Gold@14
        const result = Achievements.nearMissNudges(catalog, { bestRunDaysSurvived: 12 }, unlocked); // 12/14 = 0.857
        const nudge = result.find(n => n.familyId === 'survivor');
        expect(nudge).toMatchObject({ familyName: 'Survivor', tierLabel: 'Gold', unit: 'day', remaining: 2, threshold: 14, value: 12 });
    });

    test('below the threshold pct: excluded', () => {
        const unlocked = { survivor_1: '2026-01-01T00:00:00.000Z', survivor_2: '2026-01-01T00:00:00.000Z' };
        const result = Achievements.nearMissNudges(catalog, { bestRunDaysSurvived: 5 }, unlocked); // 5/14 well below 0.8
        expect(result.find(n => n.familyId === 'survivor')).toBeUndefined();
    });

    test('already crossed but not yet recorded unlocked (progress >= 1): excluded, not a near-miss', () => {
        const unlocked = { survivor_1: '2026-01-01T00:00:00.000Z', survivor_2: '2026-01-01T00:00:00.000Z' };
        const result = Achievements.nearMissNudges(catalog, { bestRunDaysSurvived: 14 }, unlocked);
        expect(result.find(n => n.familyId === 'survivor')).toBeUndefined();
    });

    test('every tier in a family already unlocked: no nudge, no throw', () => {
        const unlocked = { survivor_1: 'x', survivor_2: 'x', survivor_3: 'x' };
        const result = Achievements.nearMissNudges(catalog, { bestRunDaysSurvived: 14 }, unlocked);
        expect(result.find(n => n.familyId === 'survivor')).toBeUndefined();
    });

    test('custom thresholdPct is respected', () => {
        const unlocked = { survivor_1: '2026-01-01T00:00:00.000Z' }; // next locked = Silver@7
        const lenient = Achievements.nearMissNudges(catalog, { bestRunDaysSurvived: 4 }, unlocked, 0.5); // 4/7 = 0.571
        expect(lenient.find(n => n.familyId === 'survivor')).toBeDefined();
        const strict = Achievements.nearMissNudges(catalog, { bestRunDaysSurvived: 4 }, unlocked, 0.9);
        expect(strict.find(n => n.familyId === 'survivor')).toBeUndefined();
    });

    test('family with no nearMissUnit (back_in_black-style): unit is null, no throw', () => {
        const binaryCatalog = [{
            id: 'back_in_black', name: 'Back in Black', metric: 'pointsRecoveries', nearMissUnit: null,
            tiers: [{ id: 'back_in_black_1', label: null, threshold: 1 }],
        }];
        expect(Achievements.nearMissNudges(binaryCatalog, { pointsRecoveries: 0 }, {})).toEqual([]);
    });

    test('empty/missing catalog or stats: returns []', () => {
        expect(Achievements.nearMissNudges([], {}, {})).toEqual([]);
        expect(Achievements.nearMissNudges(null, null, null)).toEqual([]);
    });
});

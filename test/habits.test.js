/**
 * Habits tests (Milestone 2 extraction #5, 2026-07-18).
 *
 * js/habits.js is required directly (no CONFIG global, no DOM). Spawn
 * selection (Habits.selectHabitDefsToSpawn) is already covered by
 * test/routine-active-gating.test.js's isActive-gating suite — this file
 * covers streak math, instance creation, and generateDailyHabitInstances'
 * orchestration (selection + creation + admission wiring).
 */
// habits.js reads the Schedule global inside selectHabitDefsToSpawn (schemaVersion
// 3 recurrence gate) — bind it before requiring the module, same as the browser's
// <script> order does.
global.Schedule = require('../js/schedule.js');
const Habits = require('../js/habits.js');
const CONFIG = require('../js/config.js');

// Rate-based bonus config (session 16). Mirrors what items.js builds from CONFIG.
const RATE_CONFIG = {
    xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
    pointsPerHabit: CONFIG.POINTS_PER_HABIT,
    rateWindow: CONFIG.HABIT_RATE_WINDOW,
    rateMinSample: CONFIG.HABIT_RATE_MIN_SAMPLE,
    rateTiers: CONFIG.HABIT_RATE_TIERS,
};

// Build an occurrenceHistory of n entries with the given number of successes,
// dated backward from a fixed reference so dates are distinct and valid.
function history(nSuccess, nFail) {
    const out = [];
    let day = 1;
    for (let i = 0; i < nSuccess; i++) out.push({ date: `2026-06-${String(day++).padStart(2, '0')}`, success: true });
    for (let i = 0; i < nFail; i++) out.push({ date: `2026-06-${String(day++).padStart(2, '0')}`, success: false });
    return out;
}

describe('getHabitInstanceDueTime', () => {
    const ref = new Date(2026, 6, 18, 9, 30, 15);

    test('morning -> 12:00', () => {
        expect(Habits.getHabitInstanceDueTime('morning', ref).getHours()).toBe(12);
    });
    test('afternoon -> 17:00', () => {
        expect(Habits.getHabitInstanceDueTime('afternoon', ref).getHours()).toBe(17);
    });
    test('evening -> 22:00', () => {
        expect(Habits.getHabitInstanceDueTime('evening', ref).getHours()).toBe(22);
    });
    test('unrecognized/anytime -> 23:59 (end of day default)', () => {
        const due = Habits.getHabitInstanceDueTime('anytime', ref);
        expect(due.getHours()).toBe(23);
        expect(due.getMinutes()).toBe(59);
    });
    test('seconds/ms are zeroed regardless of bucket', () => {
        const due = Habits.getHabitInstanceDueTime('morning', ref);
        expect(due.getSeconds()).toBe(0);
        expect(due.getMilliseconds()).toBe(0);
    });
});

// --- rate-based bonus pure helpers (session 16) ------------------------------

describe('toOccurrenceDate', () => {
    test('formats a Date as local YYYY-MM-DD (not UTC)', () => {
        expect(Habits.toOccurrenceDate(new Date(2026, 6, 18, 23, 30))).toBe('2026-07-18');
    });
    test('zero-pads month and day', () => {
        expect(Habits.toOccurrenceDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
});

describe('occurrenceSuccess (polarity routing seam)', () => {
    test('completed is a success for both polarities today', () => {
        expect(Habits.occurrenceSuccess(false, 'completed')).toBe(true);
        expect(Habits.occurrenceSuccess(true, 'completed')).toBe(true);
    });
    test('overdue is a miss for both polarities today', () => {
        expect(Habits.occurrenceSuccess(false, 'overdue')).toBe(false);
        expect(Habits.occurrenceSuccess(true, 'overdue')).toBe(false);
    });
});

describe('recordOccurrence', () => {
    test('appends a new day', () => {
        const h = Habits.recordOccurrence([], '2026-07-18', true, 14);
        expect(h).toEqual([{ date: '2026-07-18', success: true }]);
    });
    test('upserts (overwrites) an existing day rather than duplicating', () => {
        const h0 = [{ date: '2026-07-18', success: false }];
        const h = Habits.recordOccurrence(h0, '2026-07-18', true, 14);
        expect(h).toEqual([{ date: '2026-07-18', success: true }]);
    });
    test('trims to the most recent windowSize entries', () => {
        let h = [];
        for (let d = 1; d <= 20; d++) h = Habits.recordOccurrence(h, `2026-06-${String(d).padStart(2, '0')}`, true, 14);
        expect(h).toHaveLength(14);
        expect(h[0].date).toBe('2026-06-07'); // oldest 6 dropped
        expect(h[13].date).toBe('2026-06-20');
    });
    test('is pure — does not mutate the input array', () => {
        const h0 = [{ date: '2026-07-17', success: true }];
        Habits.recordOccurrence(h0, '2026-07-18', true, 14);
        expect(h0).toHaveLength(1);
    });
});

describe('removeOccurrence', () => {
    test('removes the entry for the given date', () => {
        const h0 = [{ date: '2026-07-17', success: true }, { date: '2026-07-18', success: true }];
        expect(Habits.removeOccurrence(h0, '2026-07-18')).toEqual([{ date: '2026-07-17', success: true }]);
    });
    test('is a no-op when the date is absent', () => {
        const h0 = [{ date: '2026-07-17', success: true }];
        expect(Habits.removeOccurrence(h0, '2026-07-18')).toEqual(h0);
    });
});

describe('successRate', () => {
    test('null for an empty history', () => {
        expect(Habits.successRate([])).toBeNull();
    });
    test('fraction of successes', () => {
        expect(Habits.successRate(history(9, 1))).toBeCloseTo(0.9);
        expect(Habits.successRate(history(7, 3))).toBeCloseTo(0.7);
    });
});

describe('pointsMultiplier', () => {
    const cfg = { minSample: CONFIG.HABIT_RATE_MIN_SAMPLE, tiers: CONFIG.HABIT_RATE_TIERS };
    test('1x below the minimum sample, even at 100%', () => {
        expect(Habits.pointsMultiplier(history(6, 0), cfg)).toBe(1);
    });
    // Multipliers re-tuned session 24 (2026-07-19): >=90% is task parity (2.0x
    // of the 5-pt habit base = 10 = POINTS_PER_TASK); >=70% is 1.5x. Values
    // pinned here on purpose so a silent config change fails loudly.
    test('2x (task parity) at >= 90% once sample is met', () => {
        expect(Habits.pointsMultiplier(history(9, 1), cfg)).toBe(2.0); // 90%
        expect(Habits.pointsMultiplier(history(10, 0), cfg)).toBe(2.0); // 100%
    });
    test('1.5x at >= 70% but < 90%', () => {
        expect(Habits.pointsMultiplier(history(7, 3), cfg)).toBe(1.5); // 70%
        expect(Habits.pointsMultiplier(history(8, 2), cfg)).toBe(1.5); // 80%
    });
    test('1x below 70%', () => {
        expect(Habits.pointsMultiplier(history(6, 4), cfg)).toBe(1); // 60%
    });
});

describe('applyHabitCompletion (rate-based)', () => {
    test('increments streak and records a success occurrence for the day', () => {
        const result = Habits.applyHabitCompletion(0, [], false, new Date(2026, 6, 18), RATE_CONFIG);
        expect(result.streak).toBe(1);
        expect(result.occurrenceHistory).toEqual([{ date: '2026-07-18', success: true }]);
    });

    test('1x multiplier for a new habit (below min sample): base points only', () => {
        const result = Habits.applyHabitCompletion(0, [], false, new Date(2026, 6, 18), RATE_CONFIG);
        expect(result.multiplier).toBe(1);
        expect(result.pointsGained).toBe(CONFIG.POINTS_PER_HABIT);
    });

    test('high success rate multiplies the points award', () => {
        // 8 prior successes; today's completion makes 9/9 = 100% (>= min sample 7) -> 2x (task parity)
        const result = Habits.applyHabitCompletion(8, history(8, 0), false, new Date(2026, 6, 18), RATE_CONFIG);
        expect(result.multiplier).toBe(2.0);
        expect(result.pointsGained).toBe(Math.round(CONFIG.POINTS_PER_HABIT * 2.0));
    });

    test('xpGained is always the flat per-completion amount (never multiplied)', () => {
        const result = Habits.applyHabitCompletion(8, history(8, 0), false, new Date(2026, 6, 18), RATE_CONFIG);
        expect(result.xpGained).toBe(CONFIG.XP_PER_HABIT_COMPLETE);
    });

    test('lastCompletionDate is a copy of originalDueDate', () => {
        const due = new Date(2026, 6, 18);
        const result = Habits.applyHabitCompletion(0, [], false, due, RATE_CONFIG);
        expect(result.lastCompletionDate.getTime()).toBe(due.getTime());
        expect(result.lastCompletionDate).not.toBe(due);
    });
});

describe('applyHabitUncompletion (rate-based, symmetric)', () => {
    test('decrements streak, clamped at 0, and clears lastCompletionDate', () => {
        expect(Habits.applyHabitUncompletion(3, [], false, new Date(2026, 6, 18), RATE_CONFIG).streak).toBe(2);
        expect(Habits.applyHabitUncompletion(0, [], false, new Date(2026, 6, 18), RATE_CONFIG).streak).toBe(0);
        expect(Habits.applyHabitUncompletion(3, [], false, new Date(2026, 6, 18), RATE_CONFIG).lastCompletionDate).toBeNull();
    });

    test('pops today\'s occurrence entry', () => {
        const h = [{ date: '2026-07-17', success: true }, { date: '2026-07-18', success: true }];
        const result = Habits.applyHabitUncompletion(2, h, false, new Date(2026, 6, 18), RATE_CONFIG);
        expect(result.occurrenceHistory).toEqual([{ date: '2026-07-17', success: true }]);
    });

    test('refund mirrors the award exactly (symmetric) — complete then uncomplete nets 0', () => {
        // Start at 8/8 history. Complete today -> 9/9=100% -> 2x award.
        const due = new Date(2026, 6, 18);
        const start = history(8, 0);
        const comp = Habits.applyHabitCompletion(8, start, false, due, RATE_CONFIG);
        // Uncomplete from the post-completion history: refund must equal comp.pointsGained.
        const unc = Habits.applyHabitUncompletion(comp.streak, comp.occurrenceHistory, false, due, RATE_CONFIG);
        expect(unc.pointsLost).toBe(comp.pointsGained);
        // and the history is back to the pre-completion state
        expect(unc.occurrenceHistory).toEqual(start);
    });
});

describe('applyHabitOverdue', () => {
    test('zeroes the streak, flags wasReset, and records a miss occurrence', () => {
        const result = Habits.applyHabitOverdue(5, [], false, new Date(2026, 6, 18), CONFIG.HABIT_RATE_WINDOW);
        expect(result.streak).toBe(0);
        expect(result.wasReset).toBe(true);
        expect(result.occurrenceHistory).toEqual([{ date: '2026-07-18', success: false }]);
    });

    test('wasReset is false when the streak was already 0 (but the miss is still recorded)', () => {
        const result = Habits.applyHabitOverdue(0, [], false, new Date(2026, 6, 18), CONFIG.HABIT_RATE_WINDOW);
        expect(result.wasReset).toBe(false);
        expect(result.occurrenceHistory).toEqual([{ date: '2026-07-18', success: false }]);
    });

    test('a later same-day completion overwrites the miss (upsert)', () => {
        const due = new Date(2026, 6, 18);
        const missed = Habits.applyHabitOverdue(2, [], false, due, CONFIG.HABIT_RATE_WINDOW);
        const done = Habits.applyHabitCompletion(0, missed.occurrenceHistory, false, due, RATE_CONFIG);
        expect(done.occurrenceHistory).toEqual([{ date: '2026-07-18', success: true }]);
    });
});

describe('resetStreakOnOverdue (streak-only, retained)', () => {
    test('resetting a positive streak returns streak 0 and wasReset: true', () => {
        const result = Habits.resetStreakOnOverdue(5);
        expect(result.streak).toBe(0);
        expect(result.wasReset).toBe(true);
    });

    test('an already-zero streak reports wasReset: false', () => {
        const result = Habits.resetStreakOnOverdue(0);
        expect(result.streak).toBe(0);
        expect(result.wasReset).toBe(false);
    });
});

describe('createHabitInstanceData', () => {
    function deps(overrides = {}) {
        let nextId = 100;
        return {
            getNextId: () => nextId++,
            calculateTimelinePosition: (item) => 42, // stubbed, movement math tested elsewhere
            gameScreenWidth: 800,
            habitEnemyWidth: 60,
            ...overrides,
        };
    }

    const habitDef = { id: 'h1', name: 'Drink water', category: 'health', timeOfDay: 'morning', streak: 2, isNegative: false };

    test('builds a type: habit instance carrying the definitionId', () => {
        const instance = Habits.createHabitInstanceData(habitDef, new Date(2026, 6, 18), deps());
        expect(instance.type).toBe('habit');
        expect(instance.definitionId).toBe('h1');
        expect(instance.name).toBe('Drink water');
    });

    test('id comes from the injected getNextId collaborator', () => {
        const instance = Habits.createHabitInstanceData(habitDef, new Date(2026, 6, 18), deps());
        expect(instance.id).toBe(100);
    });

    test('streak is copied from the definition at creation time', () => {
        const instance = Habits.createHabitInstanceData(habitDef, new Date(2026, 6, 18), deps());
        expect(instance.streak).toBe(2);
    });

    test('x position comes from the injected calculateTimelinePosition collaborator', () => {
        const instance = Habits.createHabitInstanceData(habitDef, new Date(2026, 6, 18), deps());
        expect(instance.x).toBe(42);
    });

    test('due time follows the timeOfDay bucket for the given date', () => {
        const instance = Habits.createHabitInstanceData(habitDef, new Date(2026, 6, 18), deps());
        expect(instance.dueDateTime.toDateString()).toBe(new Date(2026, 6, 18).toDateString());
        expect(instance.dueDateTime.getHours()).toBe(12); // morning
    });

    test('starts not overdue with no damage ticked yet', () => {
        const instance = Habits.createHabitInstanceData(habitDef, new Date(2026, 6, 18), deps());
        expect(instance.isOverdue).toBe(false);
        expect(instance.lastDamageTickTime).toBeNull();
        expect(instance.offlineDamageCharged).toBe(0);
    });
});

describe('generateDailyHabitInstances', () => {
    function makeDeps(overrides = {}) {
        const admitted = [];
        return {
            definedHabits: [],
            definedRoutines: [],
            activeItems: [],
            getNextId: (() => { let n = 1; return () => n++; })(),
            calculateTimelinePosition: () => 0,
            gameScreenWidth: 800,
            habitEnemyWidth: 60,
            addItemToGame: (item) => admitted.push(item),
            sortAndRenderActiveList: () => {},
            _admitted: admitted,
            ...overrides,
        };
    }

    const DAY = new Date(2026, 6, 18);

    test('spawns an instance for an eligible habit in an active routine', () => {
        const deps = makeDeps({
            definedHabits: [{ id: 'h1', name: 'Meditate', category: 'health', frequency: 'daily', timeOfDay: 'morning', streak: 0, isNegative: false }],
            definedRoutines: [{ id: 'r1', habitDefinitionIds: ['h1'], isActive: true }],
        });
        Habits.generateDailyHabitInstances(DAY, deps);
        expect(deps._admitted).toHaveLength(1);
        expect(deps._admitted[0].definitionId).toBe('h1');
    });

    test('does not spawn for a habit in an inactive routine', () => {
        const deps = makeDeps({
            definedHabits: [{ id: 'h1', name: 'Meditate', category: 'health', frequency: 'daily', timeOfDay: 'morning', streak: 0, isNegative: false }],
            definedRoutines: [{ id: 'r1', habitDefinitionIds: ['h1'], isActive: false }],
        });
        Habits.generateDailyHabitInstances(DAY, deps);
        expect(deps._admitted).toHaveLength(0);
    });

    test('does not double-spawn when already completed for this game day', () => {
        const deps = makeDeps({
            definedHabits: [{ id: 'h1', name: 'Meditate', category: 'health', frequency: 'daily', timeOfDay: 'morning', streak: 1, isNegative: false, lastCompletionDate: DAY }],
            definedRoutines: [{ id: 'r1', habitDefinitionIds: ['h1'], isActive: true }],
        });
        Habits.generateDailyHabitInstances(DAY, deps);
        expect(deps._admitted).toHaveLength(0);
    });

    test('multiple eligible habits all spawn in one call', () => {
        const deps = makeDeps({
            definedHabits: [
                { id: 'h1', name: 'Meditate', category: 'health', frequency: 'daily', timeOfDay: 'morning', streak: 0, isNegative: false },
                { id: 'h2', name: 'Read', category: 'growth', frequency: 'daily', timeOfDay: 'evening', streak: 0, isNegative: false },
            ],
            definedRoutines: [{ id: 'r1', habitDefinitionIds: ['h1', 'h2'], isActive: true }],
        });
        Habits.generateDailyHabitInstances(DAY, deps);
        expect(deps._admitted.map(i => i.definitionId).sort()).toEqual(['h1', 'h2']);
    });
});

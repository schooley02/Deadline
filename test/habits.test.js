/**
 * Habits tests (Milestone 2 extraction #5, 2026-07-18).
 *
 * js/habits.js is required directly (no CONFIG global, no DOM). Spawn
 * selection (Habits.selectHabitDefsToSpawn) is already covered by
 * test/routine-active-gating.test.js's isActive-gating suite — this file
 * covers streak math, instance creation, and generateDailyHabitInstances'
 * orchestration (selection + creation + admission wiring).
 */
const Habits = require('../js/habits.js');
const CONFIG = require('../js/config.js');

const STREAK_CONFIG = {
    xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
    pointsPerHabit: CONFIG.POINTS_PER_HABIT,
    streakBonusThreshold: CONFIG.HABIT_STREAK_BONUS_THRESHOLD,
    streakBonusPoints: CONFIG.HABIT_STREAK_BONUS_POINTS,
};

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

describe('applyHabitCompletion', () => {
    test('increments streak by 1', () => {
        const result = Habits.applyHabitCompletion(0, new Date(2026, 6, 18), STREAK_CONFIG);
        expect(result.streak).toBe(1);
    });

    test('below bonus threshold: no bonus points', () => {
        // threshold is 3 in CONFIG; streak 0 -> 1 stays below it
        const result = Habits.applyHabitCompletion(0, new Date(2026, 6, 18), STREAK_CONFIG);
        expect(result.pointsGained).toBe(CONFIG.POINTS_PER_HABIT);
    });

    test('crossing the bonus threshold awards the bonus', () => {
        // streak 2 -> 3 crosses CONFIG.HABIT_STREAK_BONUS_THRESHOLD (3)
        const result = Habits.applyHabitCompletion(2, new Date(2026, 6, 18), STREAK_CONFIG);
        expect(result.streak).toBe(3);
        expect(result.pointsGained).toBe(CONFIG.POINTS_PER_HABIT + CONFIG.HABIT_STREAK_BONUS_POINTS);
    });

    test('xpGained is always the flat per-completion amount', () => {
        const result = Habits.applyHabitCompletion(10, new Date(2026, 6, 18), STREAK_CONFIG);
        expect(result.xpGained).toBe(CONFIG.XP_PER_HABIT_COMPLETE);
    });

    test('lastCompletionDate is set from originalDueDate (as a Date copy)', () => {
        const due = new Date(2026, 6, 18);
        const result = Habits.applyHabitCompletion(0, due, STREAK_CONFIG);
        expect(result.lastCompletionDate.getTime()).toBe(due.getTime());
        expect(result.lastCompletionDate).not.toBe(due); // copy, not same reference
    });
});

describe('applyHabitUncompletion', () => {
    test('decrements streak by 1', () => {
        const result = Habits.applyHabitUncompletion(3, STREAK_CONFIG);
        expect(result.streak).toBe(2);
    });

    test('clamps at 0, never negative', () => {
        const result = Habits.applyHabitUncompletion(0, STREAK_CONFIG);
        expect(result.streak).toBe(0);
    });

    test('clears lastCompletionDate', () => {
        const result = Habits.applyHabitUncompletion(3, STREAK_CONFIG);
        expect(result.lastCompletionDate).toBeNull();
    });

    test('refund is computed from the NEW (post-decrement) streak — ' +
         'this is a known asymmetry with applyHabitCompletion, preserved on ' +
         'purpose this session (see DECISIONS.md "streak-bonus asymmetry"). ' +
         'Uncompleting a habit at streak 3 (which had the bonus applied on ' +
         'the way up) refunds based on streak 2, i.e. WITHOUT the bonus — ' +
         'the player nets +bonus points from a complete+uncomplete round trip.', () => {
        const result = Habits.applyHabitUncompletion(3, STREAK_CONFIG);
        expect(result.streak).toBe(2); // below threshold
        expect(result.pointsLost).toBe(CONFIG.POINTS_PER_HABIT); // no bonus refunded
    });

    test('refund includes the bonus when the post-decrement streak is still >= threshold', () => {
        const result = Habits.applyHabitUncompletion(5, STREAK_CONFIG);
        expect(result.streak).toBe(4);
        expect(result.pointsLost).toBe(CONFIG.POINTS_PER_HABIT + CONFIG.HABIT_STREAK_BONUS_POINTS);
    });
});

describe('resetStreakOnOverdue', () => {
    test('resetting a positive streak returns streak 0 and wasReset: true', () => {
        const result = Habits.resetStreakOnOverdue(5);
        expect(result.streak).toBe(0);
        expect(result.wasReset).toBe(true);
    });

    test('an already-zero streak reports wasReset: false (no-op guard, matches original)', () => {
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

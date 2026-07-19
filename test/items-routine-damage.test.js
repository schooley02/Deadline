/**
 * Routine health damage + KO wiring tests ([P1-UI-006] sub-session 2,
 * 2026-07-19, docs/HEROES_PLAN.md fork 2) — the items.js damage-routing
 * layer over js/heroes.js's pure math (applyRoutineDamage/shouldKo, already
 * covered in test/heroes.test.js).
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
const Items = require('../js/items.js');

function activeRoutine(overrides = {}) {
    return {
        id: 'r1', name: 'Routine', isActive: true, frozenState: null,
        habitDefinitionIds: [], taskDefinitionIds: [],
        xp: 0, level: 1, health: 100, createdAt: Date.now(), koState: null,
        ...overrides,
    };
}

function routineTaskItem(overrides = {}) {
    return { id: 1, type: 'task', definitionId: 'td1', ...overrides };
}

function habitItem(overrides = {}) {
    return { id: 2, type: 'habit', definitionId: 'h1', isNegative: false, ...overrides };
}

function positiveHabitDef(overrides = {}) {
    return { id: 'h1', name: 'Habit', isNegative: false, routineId: 'r1', ...overrides };
}

function makeDeps(overrides = {}) {
    const definedHabits = overrides.definedHabits || [];
    const definedRoutines = overrides.definedRoutines || [];
    const { definedHabits: _d, definedRoutines: _r, ...rest } = overrides;
    return {
        definedHabits: () => definedHabits,
        definedRoutines: () => definedRoutines,
        clearActiveInstancesForRoutine: () => {},
        onRoutineKo: () => {},
        ...rest,
    };
}

describe('Items.damageRoutineForItem', () => {
    test('damages the owning routine (task, via taskDefinitionIds)', () => {
        const routine = activeRoutine({ taskDefinitionIds: ['td1'] });
        const item = routineTaskItem();
        const deps = makeDeps({ definedRoutines: [routine] });

        Items.damageRoutineForItem(item, 10, deps);

        expect(routine.health).toBe(90);
    });

    test('damages the owning routine (habit, via habitDef.routineId)', () => {
        const routine = activeRoutine({ habitDefinitionIds: ['h1'] });
        const habitDef = positiveHabitDef();
        const item = habitItem();
        const deps = makeDeps({ definedHabits: [habitDef], definedRoutines: [routine] });

        Items.damageRoutineForItem(item, 10, deps);

        expect(routine.health).toBe(90);
    });

    test('a STANDALONE item (no owning routine) is a no-op', () => {
        const item = routineTaskItem({ definitionId: undefined });
        const deps = makeDeps();

        expect(() => Items.damageRoutineForItem(item, 10, deps)).not.toThrow();
    });

    test('health floors at 0, never negative', () => {
        const routine = activeRoutine({ taskDefinitionIds: ['td1'], health: 5 });
        const item = routineTaskItem();
        const deps = makeDeps({ definedRoutines: [routine] });

        Items.damageRoutineForItem(item, 10, deps);

        expect(routine.health).toBe(0);
    });

    test('KO exactly at 0: sets koState, deactivates, recalls, and fires the notice once', () => {
        const routine = activeRoutine({ taskDefinitionIds: ['td1'], health: 10 });
        const item = routineTaskItem();
        const cleared = [];
        const notified = [];
        const deps = makeDeps({
            definedRoutines: [routine],
            clearActiveInstancesForRoutine: (id) => cleared.push(id),
            onRoutineKo: (r) => notified.push(r.id),
        });

        Items.damageRoutineForItem(item, 10, deps);

        expect(routine.health).toBe(0);
        expect(routine.koState).not.toBeNull();
        expect(routine.koState.koAt).toEqual(expect.any(Number));
        expect(routine.isActive).toBe(false);
        expect(cleared).toEqual(['r1']);
        expect(notified).toEqual(['r1']);
    });

    test('no double-KO: an already-KO\'d routine is untouched by further damage', () => {
        const routine = activeRoutine({
            taskDefinitionIds: ['td1'], health: 0, isActive: false,
            koState: { koAt: 12345 },
        });
        const item = routineTaskItem();
        const notified = [];
        const deps = makeDeps({ definedRoutines: [routine], onRoutineKo: (r) => notified.push(r.id) });

        Items.damageRoutineForItem(item, 10, deps);

        expect(routine.health).toBe(0); // unchanged, not driven further negative
        expect(routine.koState.koAt).toBe(12345); // untouched, not re-stamped
        expect(notified).toEqual([]); // notice does not re-fire
    });

    test('optional deps.onRoutineKo/deps.clearActiveInstancesForRoutine omitted -> no-op, no throw', () => {
        const routine = activeRoutine({ taskDefinitionIds: ['td1'], health: 5 });
        const item = routineTaskItem();
        const deps = {
            definedHabits: () => [],
            definedRoutines: () => [routine],
        };

        expect(() => Items.damageRoutineForItem(item, 10, deps)).not.toThrow();
        expect(routine.koState).not.toBeNull();
    });
});

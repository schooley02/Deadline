/**
 * Editing a habit's time of day must re-time today's already-spawned zombie
 * (2026-10-21, Jeremy). Before: RoutineViews.saveEditedHabit deliberately left
 * the live instance's due time alone, so moving a habit to an earlier bucket
 * that had already passed ("Morning, by 12 PM" at 3:50 PM) never made it
 * attack. Design (Jeremy, 2026-10-21): the attack starts NOW, nothing is
 * back-charged, and NO missed occurrence / streak reset is recorded -- an edit
 * is a bookkeeping correction (same philosophy as editing a task's due date,
 * test/overdue-edit.test.js). The natural overdue transition still records the
 * miss.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.RunStats = require('../js/runStats.js');
const Items = require('../js/items.js');

function fakeEl() {
    return {
        style: {}, dataset: {},
        classList: { add: () => {}, remove: () => {} },
        addEventListener: () => {}, appendChild: () => {}, remove: () => {},
        querySelector: () => null,
    };
}

function habitInstance(overrides = {}) {
    return {
        id: 7, type: 'habit', definitionId: 'h1', name: 'Stretch', category: 'health',
        isNegative: false, dueDateTime: new Date(2026, 6, 18, 17, 0), // afternoon bucket
        originalDueDate: new Date(2026, 6, 18, 17, 0),
        isOverdue: false, lastDamageTickTime: null, parentId: null,
        subTasks: [], completedSubTasks: 0, totalSubTasks: 0,
        element: fakeEl(), listItemElement: fakeEl(),
        ...overrides,
    };
}

function makeEnv(defOverrides = {}, depOverrides = {}) {
    const def = { id: 'h1', isNegative: false, streak: 4, occurrenceHistory: [], ...defOverrides };
    const missSpy = jest.fn();
    const deps = {
        definedHabits: () => [def],
        baseWidth: 120,
        calculateTimelineXWithClustering: () => 0,
        getSubTaskClusterOffset: () => 0,
        saveGame: () => {},
        getCurrentRunStats: () => ({}),
        ...depOverrides,
    };
    return { def, deps, missSpy };
}

describe('Habits.retimeHabitInstance', () => {
    test.each([
        ['morning', 12, 0],
        ['afternoon', 17, 0],
        ['evening', 22, 0],
        ['anytime', 23, 59],
    ])('%s -> %i:%i on the instance\'s own day', (bucket, h, m) => {
        const item = habitInstance({ dueDateTime: new Date(2026, 6, 18, 23, 59) });
        // 'anytime' is already 23:59 on that day, so it is a no-op there
        const changed = Habits.retimeHabitInstance(item, bucket);
        expect(changed).toBe(bucket !== 'anytime');
        expect(item.dueDateTime.getFullYear()).toBe(2026);
        expect(item.dueDateTime.getMonth()).toBe(6);
        expect(item.dueDateTime.getDate()).toBe(18);
        expect(item.dueDateTime.getHours()).toBe(h);
        expect(item.dueDateTime.getMinutes()).toBe(m);
    });

    test('keeps the instance\'s day even if that is not today', () => {
        const item = habitInstance({ dueDateTime: new Date(2026, 0, 3, 17, 0) });
        Habits.retimeHabitInstance(item, 'morning');
        expect(item.dueDateTime.getDate()).toBe(3);
        expect(item.dueDateTime.getMonth()).toBe(0);
    });

    test('same bucket is a no-op (returns false, due time untouched)', () => {
        const item = habitInstance();
        const before = item.dueDateTime.getTime();
        expect(Habits.retimeHabitInstance(item, 'afternoon')).toBe(false);
        expect(item.dueDateTime.getTime()).toBe(before);
    });

    test('bad input never throws', () => {
        expect(Habits.retimeHabitInstance(null, 'morning')).toBe(false);
        expect(Habits.retimeHabitInstance({}, 'morning')).toBe(false);
        expect(Habits.retimeHabitInstance({ dueDateTime: 'nope' }, 'morning')).toBe(false);
    });
});

describe('edit pulls a habit into the past (retime + recomputeOverdueStateAfterEdit)', () => {
    test('goes overdue and starts attacking NOW, nothing back-charged', () => {
        const { deps } = makeEnv();
        // due 5 PM today-ish in the past, then edited to "morning" (noon) -- both in the past
        const item = habitInstance({ dueDateTime: new Date(Date.now() + 60 * 60 * 1000) }); // 1h from now (not overdue)
        // force the morning bucket to be in the past relative to now by anchoring the instance's day to 3 days ago
        item.dueDateTime = new Date(Date.now() - 3 * 24 * 3600 * 1000);
        item.isOverdue = false;
        Habits.retimeHabitInstance(item, 'morning');
        const before = Date.now();
        Items.recomputeOverdueStateAfterEdit(item, deps);
        const after = Date.now();

        expect(item.isOverdue).toBe(true);
        expect(item.lastDamageTickTime).toBeGreaterThanOrEqual(before);
        expect(item.lastDamageTickTime).toBeLessThanOrEqual(after);
        expect(item.x).toBe(deps.baseWidth);
    });

    test('records NO missed occurrence, NO streak reset, NO run-stat miss', () => {
        const getCurrentRunStats = jest.fn(() => ({}));
        const { def, deps } = makeEnv({}, { getCurrentRunStats });
        const item = habitInstance({ dueDateTime: new Date(Date.now() - 3 * 24 * 3600 * 1000) });
        Habits.retimeHabitInstance(item, 'morning');
        Items.recomputeOverdueStateAfterEdit(item, deps);

        expect(item.isOverdue).toBe(true);
        expect(def.streak).toBe(4);
        expect(def.occurrenceHistory).toEqual([]);
        expect(getCurrentRunStats).not.toHaveBeenCalled();
    });

    test('control: the NATURAL overdue transition still records the miss + resets the streak', () => {
        const { def, deps } = makeEnv();
        const item = habitInstance({ dueDateTime: new Date(Date.now() - 60 * 1000) });
        Items.markAsOverdue(item, new Date(), deps);

        expect(item.isOverdue).toBe(true);
        expect(def.streak).toBe(0);
        expect(def.occurrenceHistory).toHaveLength(1);
        expect(def.occurrenceHistory[0].success).toBe(false);
    });

    test('moving a habit LATER (into the future) clears its overdue state', () => {
        const { deps } = makeEnv();
        const item = habitInstance({ dueDateTime: new Date(Date.now() - 60 * 1000), isOverdue: true, lastDamageTickTime: Date.now() - 1000 });
        item.dueDateTime = new Date(Date.now() + 2 * 3600 * 1000);
        Items.recomputeOverdueStateAfterEdit(item, deps);
        expect(item.isOverdue).toBe(false);
        expect(item.lastDamageTickTime).toBeNull();
    });

    test('a negative-habit lurker is retimed but never goes overdue', () => {
        const { deps } = makeEnv({ isNegative: true });
        const item = habitInstance({ isNegative: true, dueDateTime: new Date(Date.now() - 3 * 24 * 3600 * 1000) });
        expect(Habits.retimeHabitInstance(item, 'morning')).toBe(true);
        Items.recomputeOverdueStateAfterEdit(item, deps);
        expect(item.isOverdue).toBe(false);
    });
});

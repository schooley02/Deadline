/**
 * DayPager yesterday-snapshot tests (`docs/TIME_SLIDER_WEEK_PLAN.md`
 * sub-session 3, 2026-07-20 session 72) — outcome labeling for the static
 * "battlefield aftermath" at offset -1.
 *
 * Requires the REAL modules (day-pager.test.js precedent).
 */
global.Schedule = require('../js/schedule.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.Habits = require('../js/habits.js');
global.Routines = require('../js/routines.js');
global.TimeSlider = require('../js/timeSlider.js');
const DayPager = require('../js/dayPager.js');

const TODAY = new Date(2026, 6, 20); // Mon Jul 20 2026, local
const YESTERDAY = new Date(2026, 6, 19); // Sun Jul 19 2026, local

function occKey(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function habitDef(id, overrides = {}) {
    return { id, name: `Habit ${id}`, category: 'other', frequency: 'daily', timeOfDay: 'morning', streak: 0, isNegative: false, routineId: null, occurrenceHistory: [], ...overrides };
}

function taskDef(id, overrides = {}) {
    return { id, name: `Task ${id}`, category: 'other', defaultDueTime: '17:00', schedule: undefined, ...overrides };
}

function routine(id, overrides = {}) {
    return { id, name: `Routine ${id}`, habitDefinitionIds: [], taskDefinitionIds: [], isActive: true, ...overrides };
}

// --- outcomeForHabitOnDay -----------------------------------------------------

describe('DayPager.outcomeForHabitOnDay', () => {
    test('positive habit, success entry -> completed', () => {
        const def = habitDef('h1', { occurrenceHistory: [{ date: occKey(YESTERDAY), success: true }] });
        expect(DayPager.outcomeForHabitOnDay(def, YESTERDAY)).toBe('completed');
    });

    test('positive habit, failure entry -> missed', () => {
        const def = habitDef('h1', { occurrenceHistory: [{ date: occKey(YESTERDAY), success: false }] });
        expect(DayPager.outcomeForHabitOnDay(def, YESTERDAY)).toBe('missed');
    });

    test('negative habit, success entry -> avoided', () => {
        const def = habitDef('h1', { isNegative: true, occurrenceHistory: [{ date: occKey(YESTERDAY), success: true }] });
        expect(DayPager.outcomeForHabitOnDay(def, YESTERDAY)).toBe('avoided');
    });

    test('negative habit, failure entry -> indulged (collapses lapsed/indulged, known fidelity limit)', () => {
        const def = habitDef('h1', { isNegative: true, occurrenceHistory: [{ date: occKey(YESTERDAY), success: false }] });
        expect(DayPager.outcomeForHabitOnDay(def, YESTERDAY)).toBe('indulged');
    });

    test('no matching occurrenceHistory entry -> unknown', () => {
        const def = habitDef('h1', { occurrenceHistory: [] });
        expect(DayPager.outcomeForHabitOnDay(def, YESTERDAY)).toBe('unknown');
    });

    test('an entry for a DIFFERENT day does not match', () => {
        const def = habitDef('h1', { occurrenceHistory: [{ date: occKey(TODAY), success: true }] });
        expect(DayPager.outcomeForHabitOnDay(def, YESTERDAY)).toBe('unknown');
    });
});

// --- scheduledHabitsForYesterday -----------------------------------------------

describe('DayPager.scheduledHabitsForYesterday', () => {
    test('a standalone habit scheduled for that day is included with its outcome', () => {
        const defs = [habitDef('h1', { occurrenceHistory: [{ date: occKey(YESTERDAY), success: true }] })];
        const rows = DayPager.scheduledHabitsForYesterday(defs, [], YESTERDAY);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ key: 'snapshot:habit:h1', outcome: 'completed' });
    });

    test('a habit NOT scheduled that day (day-of-week schedule) is excluded regardless of outcome data', () => {
        // YESTERDAY (Jul 19 2026) is a Sunday.
        const defs = [habitDef('h1', {
            schedule: { daysOfWeek: [1, 2, 3, 4, 5] }, // Mon-Fri only
            occurrenceHistory: [{ date: occKey(YESTERDAY), success: true }],
        })];
        expect(DayPager.scheduledHabitsForYesterday(defs, [], YESTERDAY)).toHaveLength(0);
    });

    test('resolution does NOT exclude — unlike selectHabitDefsToSpawn, a resolved day is exactly what this shows', () => {
        const defs = [habitDef('h1', {
            lastCompletionDate: YESTERDAY,
            occurrenceHistory: [{ date: occKey(YESTERDAY), success: true }],
        })];
        expect(DayPager.scheduledHabitsForYesterday(defs, [], YESTERDAY)).toHaveLength(1);
    });

    test('a habit in an inactive routine is still excluded (current-state simplification)', () => {
        const defs = [habitDef('h1', { routineId: 'r1' })];
        const routines = [routine('r1', { habitDefinitionIds: ['h1'], isActive: false })];
        expect(DayPager.scheduledHabitsForYesterday(defs, routines, YESTERDAY)).toHaveLength(0);
    });
});

// --- outcomeForTaskOnDay / scheduledTasksForYesterday --------------------------

describe('DayPager.outcomeForTaskOnDay / scheduledTasksForYesterday', () => {
    test('a routine task found in completedItems for that day -> completed', () => {
        const def = taskDef('t1');
        const completedItems = [{ type: 'task', definitionId: 't1', originalDueDate: new Date(2026, 6, 19, 17, 0) }];
        expect(DayPager.outcomeForTaskOnDay(def, completedItems, YESTERDAY)).toBe('completed');
    });

    test('a routine task with no matching completedItems entry -> missed', () => {
        const def = taskDef('t1');
        expect(DayPager.outcomeForTaskOnDay(def, [], YESTERDAY)).toBe('missed');
    });

    test('scheduledTasksForYesterday includes routineId + outcome', () => {
        const defs = [taskDef('t1')];
        const routines = [routine('r1', { taskDefinitionIds: ['t1'] })];
        const completedItems = [{ type: 'task', definitionId: 't1', originalDueDate: new Date(2026, 6, 19, 17, 0) }];
        const rows = DayPager.scheduledTasksForYesterday(defs, routines, completedItems, YESTERDAY);
        expect(rows).toEqual([expect.objectContaining({ key: 'snapshot:task:t1', routineId: 'r1', outcome: 'completed' })]);
    });

    test('a task in a FROZEN routine is excluded', () => {
        const defs = [taskDef('t1')];
        const routines = [routine('r1', { taskDefinitionIds: ['t1'], frozenState: { frozenBy: 'h1' } })];
        expect(DayPager.scheduledTasksForYesterday(defs, routines, [], YESTERDAY)).toHaveLength(0);
    });
});

// --- existingItemOutcomesForDay -----------------------------------------------

describe('DayPager.existingItemOutcomesForDay', () => {
    test('a one-off task still in activeItems past its due day -> missed', () => {
        const activeItems = [{ id: 's1', type: 'task', definitionId: null, name: 'Errand', category: 'other', dueDateTime: new Date(2026, 6, 19, 14, 0) }];
        const rows = DayPager.existingItemOutcomesForDay(activeItems, [], YESTERDAY);
        expect(rows).toEqual([expect.objectContaining({ key: 'existing:s1', outcome: 'missed' })]);
    });

    test('a one-off task found in completedItems for that day -> completed', () => {
        const completedItems = [{ id: 's2', type: 'task', definitionId: null, name: 'Errand', category: 'other', dueDateTime: new Date(2026, 6, 19, 14, 0), completedAt: new Date() }];
        const rows = DayPager.existingItemOutcomesForDay([], completedItems, YESTERDAY);
        expect(rows).toEqual([expect.objectContaining({ key: 'existing:s2', outcome: 'completed' })]);
    });

    test('items due on a different day are excluded from both lists', () => {
        const activeItems = [{ id: 's1', type: 'task', definitionId: null, dueDateTime: new Date(2026, 6, 20, 14, 0) }];
        const completedItems = [{ id: 's2', type: 'task', definitionId: null, dueDateTime: new Date(2026, 6, 20, 14, 0) }];
        expect(DayPager.existingItemOutcomesForDay(activeItems, completedItems, YESTERDAY)).toHaveLength(0);
    });

    test('recurring instances (definitionId set) are excluded — covered by the scheduled* functions instead', () => {
        const activeItems = [{ id: 'h1', type: 'habit', definitionId: 'h1', dueDateTime: new Date(2026, 6, 19, 14, 0) }];
        expect(DayPager.existingItemOutcomesForDay(activeItems, [], YESTERDAY)).toHaveLength(0);
    });
});

// --- conjureYesterdaySnapshot (integration) ------------------------------------

describe('DayPager.conjureYesterdaySnapshot', () => {
    test('combines habits, routine tasks, and existing items, sorted by due time', () => {
        const deps = {
            definedHabits: [habitDef('h1', { timeOfDay: 'evening', occurrenceHistory: [{ date: occKey(YESTERDAY), success: true }] })], // 22:00
            definedRoutines: [routine('r1', { taskDefinitionIds: ['t1'] })],
            definedTasks: [taskDef('t1', { defaultDueTime: '09:00' })],
            activeItems: [{ id: 's1', type: 'task', definitionId: null, name: 'Errand', category: 'other', dueDateTime: new Date(2026, 6, 19, 12, 0) }],
            completedItems: [],
        };
        const snapshot = DayPager.conjureYesterdaySnapshot(deps, TODAY);
        expect(snapshot.map(g => g.key)).toEqual(['snapshot:task:t1', 'existing:s1', 'snapshot:habit:h1']);
        expect(snapshot.map(g => g.outcome)).toEqual(['missed', 'missed', 'completed']);
    });

    test('empty deps produce an empty snapshot, never throw', () => {
        expect(DayPager.conjureYesterdaySnapshot({}, TODAY)).toEqual([]);
    });

    test('always resolves offset -1 regardless of what a caller might pass — anchored via dayBoundsForOffset(referenceTime, MIN_OFFSET)', () => {
        const deps = { definedHabits: [habitDef('h1', { occurrenceHistory: [{ date: occKey(YESTERDAY), success: true }] })] };
        expect(DayPager.conjureYesterdaySnapshot(deps, TODAY)).toHaveLength(1);
    });
});

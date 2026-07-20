/**
 * DayPager tests (`docs/TIME_SLIDER_WEEK_PLAN.md` sub-session 1, 2026-07-20
 * session 71) — pure day-offset clamping, day-bounds math, and ghost
 * conjuring for the Week scope's day pager.
 *
 * Requires the REAL modules (routine-active-gating.test.js precedent) so
 * ghost conjuring can never silently drift from the actual spawn-selection
 * logic it's built on top of.
 */
global.Schedule = require('../js/schedule.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.Habits = require('../js/habits.js');
global.Routines = require('../js/routines.js');
global.TimeSlider = require('../js/timeSlider.js');
const DayPager = require('../js/dayPager.js');

// --- fixtures ---------------------------------------------------------------

const TODAY = new Date(2026, 6, 20); // Mon Jul 20 2026, local (matches session date)

function habitDef(id, overrides = {}) {
    return { id, name: `Habit ${id}`, category: 'other', frequency: 'daily', timeOfDay: 'morning', streak: 0, isNegative: false, routineId: null, ...overrides };
}

function taskDef(id, overrides = {}) {
    return { id, name: `Task ${id}`, category: 'other', defaultDueTime: '17:00', schedule: undefined, ...overrides };
}

function routine(id, overrides = {}) {
    return { id, name: `Routine ${id}`, habitDefinitionIds: [], taskDefinitionIds: [], isActive: true, ...overrides };
}

function standaloneItem(id, dueDateTime, overrides = {}) {
    return { id, type: 'task', definitionId: null, name: `Standalone ${id}`, category: 'other', dueDateTime: new Date(dueDateTime), ...overrides };
}

// --- clampDayOffset ----------------------------------------------------------

describe('DayPager.clampDayOffset', () => {
    test('in-range values pass through unchanged', () => {
        expect(DayPager.clampDayOffset(0)).toBe(0);
        expect(DayPager.clampDayOffset(-1)).toBe(-1);
        expect(DayPager.clampDayOffset(6)).toBe(6);
        expect(DayPager.clampDayOffset(3)).toBe(3);
    });

    test('clamps below MIN_OFFSET', () => {
        expect(DayPager.clampDayOffset(-2)).toBe(-1);
        expect(DayPager.clampDayOffset(-100)).toBe(-1);
    });

    test('clamps above MAX_OFFSET', () => {
        expect(DayPager.clampDayOffset(7)).toBe(6);
        expect(DayPager.clampDayOffset(30)).toBe(6);
    });

    test('rounds fractional offsets', () => {
        expect(DayPager.clampDayOffset(2.6)).toBe(3);
        expect(DayPager.clampDayOffset(2.4)).toBe(2);
    });

    test('non-numeric / NaN input defaults to 0 (today), never throws', () => {
        expect(DayPager.clampDayOffset(NaN)).toBe(0);
        expect(DayPager.clampDayOffset(undefined)).toBe(0);
        expect(DayPager.clampDayOffset(null)).toBe(0);
        expect(DayPager.clampDayOffset('not a number')).toBe(0);
    });

    test('MIN_OFFSET/MAX_OFFSET are exposed and match the plan (-1..+6)', () => {
        expect(DayPager.MIN_OFFSET).toBe(-1);
        expect(DayPager.MAX_OFFSET).toBe(6);
    });
});

// --- dayBoundsForOffset -------------------------------------------------------

describe('DayPager.dayBoundsForOffset', () => {
    test('offset 0 reproduces TimeSlider.getDayBounds exactly', () => {
        const direct = TimeSlider.getDayBounds(TODAY);
        const viaPager = DayPager.dayBoundsForOffset(TODAY, 0);
        expect(viaPager.start.getTime()).toBe(direct.start.getTime());
        expect(viaPager.end.getTime()).toBe(direct.end.getTime());
    });

    test('positive offset shifts forward by whole days', () => {
        const bounds = DayPager.dayBoundsForOffset(TODAY, 3);
        expect(bounds.start.toDateString()).toBe(new Date(2026, 6, 23).toDateString());
        expect(bounds.end.toDateString()).toBe(new Date(2026, 6, 24).toDateString());
    });

    test('negative offset shifts backward one day (yesterday)', () => {
        const bounds = DayPager.dayBoundsForOffset(TODAY, -1);
        expect(bounds.start.toDateString()).toBe(new Date(2026, 6, 19).toDateString());
    });

    test('bounds are always exactly 24 hours apart', () => {
        [-1, 0, 1, 6].forEach(offset => {
            const bounds = DayPager.dayBoundsForOffset(TODAY, offset);
            expect(bounds.end.getTime() - bounds.start.getTime()).toBe(24 * 60 * 60 * 1000);
        });
    });
});

// --- conjureHabitGhosts --------------------------------------------------------

describe('DayPager.conjureHabitGhosts', () => {
    test('a standalone habit conjures a ghost for a future day', () => {
        const defs = [habitDef('h1')];
        const ghosts = DayPager.conjureHabitGhosts(defs, [], [], TODAY, null);
        expect(ghosts).toHaveLength(1);
        expect(ghosts[0]).toMatchObject({ key: 'ghost:habit:h1', definitionId: 'h1', isHabit: true, routineId: null });
        expect(ghosts[0].dueTime).toBeInstanceOf(Date);
    });

    test('a habit in an INACTIVE routine does not conjure a ghost', () => {
        const defs = [habitDef('h1', { routineId: 'r1' })];
        const routines = [routine('r1', { habitDefinitionIds: ['h1'], isActive: false })];
        expect(DayPager.conjureHabitGhosts(defs, routines, [], TODAY, null)).toHaveLength(0);
    });

    test('a FROZEN routine suspends its other habits but the offending habit still lurks (fork: freezes respected for free)', () => {
        const defs = [habitDef('offender', { routineId: 'r1', isNegative: true }), habitDef('other', { routineId: 'r1' })];
        const routines = [routine('r1', {
            habitDefinitionIds: ['offender', 'other'],
            frozenState: { frozenBy: 'offender', frozenAt: new Date(TODAY).toISOString() },
        })];
        const ghosts = DayPager.conjureHabitGhosts(defs, routines, [], TODAY, null);
        expect(ghosts.map(g => g.definitionId)).toEqual(['offender']);
    });

    test('a habit excused by a Sick Day marker for the target day does not conjure a ghost', () => {
        const defs = [habitDef('h1')];
        // Habits.toOccurrenceDate isn't exported; derive the same YYYY-MM-DD
        // shape (local calendar fields) the module uses internally.
        const pad = n => String(n).padStart(2, '0');
        const occ = `${TODAY.getFullYear()}-${pad(TODAY.getMonth() + 1)}-${pad(TODAY.getDate())}`;
        const ghosts = DayPager.conjureHabitGhosts(defs, [], [], TODAY, occ);
        expect(ghosts).toHaveLength(0);
    });

    test('routineId on the ghost is read from the habit def, matching items.js findOwningRoutine precedent', () => {
        const defs = [habitDef('h1', { routineId: 'r9' })];
        const routines = [routine('r9', { habitDefinitionIds: ['h1'] })];
        const ghosts = DayPager.conjureHabitGhosts(defs, routines, [], TODAY, null);
        expect(ghosts[0].routineId).toBe('r9');
    });

    test('isNegative flag carries through to the ghost', () => {
        const defs = [habitDef('h1', { isNegative: true })];
        const ghosts = DayPager.conjureHabitGhosts(defs, [], [], TODAY, null);
        expect(ghosts[0].isNegative).toBe(true);
    });
});

// --- conjureTaskGhosts ----------------------------------------------------------

describe('DayPager.conjureTaskGhosts', () => {
    test('a task in an ACTIVE routine conjures a ghost with routineId resolved', () => {
        const defs = [taskDef('t1')];
        const routines = [routine('r1', { taskDefinitionIds: ['t1'] })];
        const ghosts = DayPager.conjureTaskGhosts(defs, routines, [], [], TODAY);
        expect(ghosts).toHaveLength(1);
        expect(ghosts[0]).toMatchObject({ key: 'ghost:task:t1', definitionId: 't1', isHabit: false, routineId: 'r1' });
    });

    test('a task in a FROZEN routine does not conjure (unlike habits, no offender exception)', () => {
        const defs = [taskDef('t1')];
        const routines = [routine('r1', {
            taskDefinitionIds: ['t1'],
            frozenState: { frozenBy: 'h1', frozenAt: new Date(TODAY).toISOString() },
        })];
        expect(DayPager.conjureTaskGhosts(defs, routines, [], [], TODAY)).toHaveLength(0);
    });

    test('a task orphaned from every routine (dangling id) does not conjure', () => {
        const defs = [taskDef('t1')];
        expect(DayPager.conjureTaskGhosts(defs, [], [], [], TODAY)).toHaveLength(0);
    });
});

// --- existingItemsForDay -----------------------------------------------------

describe('DayPager.existingItemsForDay', () => {
    test('a standalone task due on the target day is included as an existing item, not a ghost', () => {
        const items = [standaloneItem('s1', new Date(2026, 6, 20, 14, 0))];
        const rows = DayPager.existingItemsForDay(items, TODAY);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ key: 'existing:s1', definitionId: null });
    });

    test('a standalone task due on a DIFFERENT day is excluded', () => {
        const items = [standaloneItem('s1', new Date(2026, 6, 21, 14, 0))];
        expect(DayPager.existingItemsForDay(items, TODAY)).toHaveLength(0);
    });

    test('a recurring instance (has definitionId) is excluded — covered by the conjure* functions instead', () => {
        const items = [standaloneItem('s1', new Date(2026, 6, 20, 14, 0), { definitionId: 'h1', type: 'habit' })];
        expect(DayPager.existingItemsForDay(items, TODAY)).toHaveLength(0);
    });

    test('a sub-task (parentId set, no definitionId) is included and carries its parentId', () => {
        const items = [standaloneItem('sub1', new Date(2026, 6, 20, 9, 0), { parentId: 'parent1' })];
        const rows = DayPager.existingItemsForDay(items, TODAY);
        expect(rows[0].parentId).toBe('parent1');
    });
});

// --- conjureGhostsForDay (integration) ---------------------------------------

describe('DayPager.conjureGhostsForDay', () => {
    test('combines habit ghosts, task ghosts, and existing items, sorted by due time', () => {
        const deps = {
            definedHabits: [habitDef('h1', { timeOfDay: 'evening' })], // 22:00
            definedRoutines: [routine('r1', { taskDefinitionIds: ['t1'] })],
            definedTasks: [taskDef('t1', { defaultDueTime: '09:00' })],
            activeItems: [standaloneItem('s1', new Date(2026, 6, 21, 12, 0))], // noon
            completedItems: [],
            sickDayDate: null,
        };
        const ghosts = DayPager.conjureGhostsForDay(deps, TODAY, 1); // tomorrow
        expect(ghosts.map(g => g.key)).toEqual(['ghost:task:t1', 'existing:s1', 'ghost:habit:h1']);
    });

    test('empty deps produce an empty agenda, never throw', () => {
        expect(DayPager.conjureGhostsForDay({}, TODAY, 2)).toEqual([]);
    });

    test('offset 0 (today) still conjures correctly if invoked directly (callers normally skip it per session-63 precedent)', () => {
        const deps = {
            definedHabits: [habitDef('h1')],
            definedRoutines: [],
            definedTasks: [],
            activeItems: [],
            completedItems: [],
            sickDayDate: null,
        };
        expect(DayPager.conjureGhostsForDay(deps, TODAY, 0)).toHaveLength(1);
    });
});

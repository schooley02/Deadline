/**
 * DayPager.weekStripSummary tests (`docs/TIME_SLIDER_WEEK_PLAN.md`
 * sub-session 4, phase 2, 2026-07-20 session 73) — per-day counts,
 * (the priority tally and the "heavy day" flag were removed 2026-11-10).
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

function habitDef(id, overrides = {}) {
    return { id, name: `Habit ${id}`, category: 'other', frequency: 'daily', timeOfDay: 'morning', streak: 0, isNegative: false, routineId: null, ...overrides };
}

function taskDef(id, overrides = {}) {
    return { id, name: `Task ${id}`, category: 'other', defaultDueTime: '17:00', schedule: undefined, isHighPriority: false, ...overrides };
}

function routine(id, overrides = {}) {
    return { id, name: `Routine ${id}`, habitDefinitionIds: [], taskDefinitionIds: [], isActive: true, ...overrides };
}

describe('DayPager.weekStripSummary', () => {
    test('returns exactly 7 entries, offsets 0..MAX_OFFSET in order', () => {
        const entries = DayPager.weekStripSummary({}, TODAY);
        expect(entries).toHaveLength(7);
        expect(entries.map(e => e.offset)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    test('empty deps produce all-zero counts, never throw', () => {
        const entries = DayPager.weekStripSummary({}, TODAY);
        entries.forEach(e => {
            expect(e.totalCount).toBe(0);
        });
    });

    test('entries carry no priority tally or heavy flag (removed 2026-11-10)', () => {
        DayPager.weekStripSummary({}, TODAY).forEach(e => {
            expect(e).not.toHaveProperty('highPriorityCount');
            expect(e).not.toHaveProperty('isHeavy');
        });
    });

    test('a daily standalone habit counts on every day including Today, via the real activeItems path', () => {
        const deps = {
            definedHabits: [habitDef('h1')],
            activeItems: [{ id: 1, type: 'habit', definitionId: 'h1', dueDateTime: new Date(2026, 6, 20, 12, 0) }],
        };
        const entries = DayPager.weekStripSummary(deps, TODAY);
        // Today counts the REAL activeItems entry (1); every future day
        // counts a conjured ghost of the same daily habit (also 1 each).
        entries.forEach(e => expect(e.totalCount).toBe(1));
    });

    test('Today counts real activeItems, NOT a conjured ghost (which would be excluded as "already spawned")', () => {
        // If Today wrongly reused conjureGhostsForDay, this habit would be
        // excluded (selectHabitDefsToSpawn sees the live instance and skips
        // it) and Today's count would wrongly read 0 instead of 1.
        const deps = {
            definedHabits: [habitDef('h1')],
            activeItems: [{ id: 1, type: 'habit', definitionId: 'h1', dueDateTime: new Date(2026, 6, 20, 12, 0) }],
        };
        const today = DayPager.weekStripSummary(deps, TODAY).find(e => e.offset === 0);
        expect(today.totalCount).toBe(1);
    });

    test('sub-tasks (parentId set) do not inflate the count — parent+subs reads as one item', () => {
        const deps = {
            activeItems: [
                { id: 1, type: 'task', definitionId: null, dueDateTime: new Date(2026, 6, 20, 12, 0), parentId: null },
                { id: 2, type: 'task', definitionId: null, dueDateTime: new Date(2026, 6, 20, 13, 0), parentId: 1 },
            ],
        };
        const today = DayPager.weekStripSummary(deps, TODAY).find(e => e.offset === 0);
        expect(today.totalCount).toBe(1);
    });

    // IMPORTANT SEMANTIC NOTE, confirmed while writing these tests: Today's
    // count is "everything currently in activeItems" (Hud.updateTaskCountDisplay's
    // own convention — NO due-date filtering), which is NOT the same rule
    // future days use (existingItemsForDay DOES filter by due-date-in-range).
    // A one-off task due 3 days out is a REAL activeItems entry sitting
    // off-screen today, so it counts toward BOTH Today's total AND its own
    // future day's total — Today isn't "items due today," it's "the whole
    // live board," matching what the real HUD counter has always shown.
    test('Today counts the whole live board; later days count what is due that day', () => {
        const deps = {
            activeItems: [
                { id: 1, type: 'task', definitionId: null, dueDateTime: new Date(2026, 6, 22, 9, 0) }, // offset 2
                { id: 2, type: 'task', definitionId: null, dueDateTime: new Date(2026, 6, 22, 10, 0) },
                { id: 3, type: 'task', definitionId: null, dueDateTime: new Date(2026, 6, 22, 11, 0) },
                { id: 4, type: 'task', definitionId: null, dueDateTime: new Date(2026, 6, 23, 9, 0) }, // offset 3
            ],
        };
        const byOffset = Object.fromEntries(DayPager.weekStripSummary(deps, TODAY).map(e => [e.offset, e]));
        expect(byOffset[0].totalCount).toBe(4);
        expect(byOffset[1].totalCount).toBe(0);
        expect(byOffset[2].totalCount).toBe(3);
        expect(byOffset[3].totalCount).toBe(1);
    });

    test('a recurring habit spawning daily counts one item on every day', () => {
        const deps = {
            definedHabits: [habitDef('h1')],
            activeItems: [{ id: 1, type: 'habit', definitionId: 'h1', dueDateTime: new Date(2026, 6, 20, 12, 0) }],
        };
        DayPager.weekStripSummary(deps, TODAY).forEach(e => expect(e.totalCount).toBe(1));
    });

    test('dayStart advances one calendar day per entry', () => {
        const entries = DayPager.weekStripSummary({}, TODAY);
        expect(entries[0].dayStart.toDateString()).toBe(TODAY.toDateString());
        expect(entries[6].dayStart.toDateString()).toBe(new Date(2026, 6, 26).toDateString());
    });
});

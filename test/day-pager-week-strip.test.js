/**
 * DayPager.weekStripSummary tests (`docs/TIME_SLIDER_WEEK_PLAN.md`
 * sub-session 4, phase 2, 2026-07-20 session 73) — per-day counts,
 * high-priority tallies, and the relative "heavier than this week's own
 * average" flag.
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

    test('empty deps produce all-zero counts and no heavy days, never throw', () => {
        const entries = DayPager.weekStripSummary({}, TODAY);
        entries.forEach(e => {
            expect(e.totalCount).toBe(0);
            expect(e.highPriorityCount).toBe(0);
            expect(e.isHeavy).toBe(false);
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

    test('highPriorityCount tallies only high-priority routine tasks for future days', () => {
        const deps = {
            definedRoutines: [routine('r1', { taskDefinitionIds: ['t1', 't2'] })],
            definedTasks: [
                taskDef('t1', { isHighPriority: true }),
                taskDef('t2', { isHighPriority: false }),
            ],
        };
        const tomorrow = DayPager.weekStripSummary(deps, TODAY).find(e => e.offset === 1);
        expect(tomorrow.totalCount).toBe(2);
        expect(tomorrow.highPriorityCount).toBe(1);
    });

    test('highPriorityCount tallies a high-priority standalone task on Today via activeItems', () => {
        const deps = {
            activeItems: [{ id: 1, type: 'task', definitionId: null, dueDateTime: new Date(2026, 6, 20, 12, 0), isHighPriority: true }],
        };
        const today = DayPager.weekStripSummary(deps, TODAY).find(e => e.offset === 0);
        expect(today.highPriorityCount).toBe(1);
    });

    test('habits never count toward highPriorityCount (no priority concept)', () => {
        const deps = { definedHabits: [habitDef('h1')] };
        const entries = DayPager.weekStripSummary(deps, TODAY);
        entries.forEach(e => expect(e.highPriorityCount).toBe(0));
    });

    // IMPORTANT SEMANTIC NOTE, confirmed while writing these tests: Today's
    // count is "everything currently in activeItems" (Hud.updateTaskCountDisplay's
    // own convention — NO due-date filtering), which is NOT the same rule
    // future days use (existingItemsForDay DOES filter by due-date-in-range).
    // A one-off task due 3 days out is a REAL activeItems entry sitting
    // off-screen today, so it counts toward BOTH Today's total AND its own
    // future day's total — Today isn't "items due today," it's "the whole
    // live board," matching what the real HUD counter has always shown.
    test('isHeavy flags only days STRICTLY above this week\'s own average, not a fixed threshold', () => {
        // Every one-off task below is REAL and sits in activeItems regardless
        // of its own due date (see note above) — so Today's count includes
        // all 4, not just same-day ones.
        const deps = {
            activeItems: [
                { id: 1, type: 'task', definitionId: null, dueDateTime: new Date(2026, 6, 22, 9, 0) }, // offset 2
                { id: 2, type: 'task', definitionId: null, dueDateTime: new Date(2026, 6, 22, 10, 0) },
                { id: 3, type: 'task', definitionId: null, dueDateTime: new Date(2026, 6, 22, 11, 0) },
                { id: 4, type: 'task', definitionId: null, dueDateTime: new Date(2026, 6, 23, 9, 0) }, // offset 3
            ],
        };
        const entries = DayPager.weekStripSummary(deps, TODAY);
        const byOffset = Object.fromEntries(entries.map(e => [e.offset, e]));
        // counts: [4,0,3,1,0,0,0] (offset 0 = "everything active") ->
        // average 8/7 ≈ 1.143
        expect(byOffset[0].totalCount).toBe(4);
        expect(byOffset[0].isHeavy).toBe(true);
        expect(byOffset[2].totalCount).toBe(3);
        expect(byOffset[2].isHeavy).toBe(true);
        expect(byOffset[3].totalCount).toBe(1);
        expect(byOffset[3].isHeavy).toBe(false); // 1 < 1.143 average
        expect(byOffset[1].isHeavy).toBe(false);
    });

    test('a perfectly even week (one recurring habit spawning daily) flags nothing', () => {
        // A daily recurring habit produces exactly ONE item per day
        // EVERYWHERE — Today via its real spawned activeItems entry, every
        // future day via an identical conjured ghost — so this is the
        // fixture that's actually apples-to-apples across all 7 offsets
        // (unlike one-off tasks, which behave asymmetrically — see note
        // above).
        const deps = {
            definedHabits: [habitDef('h1')],
            activeItems: [{ id: 1, type: 'habit', definitionId: 'h1', dueDateTime: new Date(2026, 6, 20, 12, 0) }],
        };
        const entries = DayPager.weekStripSummary(deps, TODAY);
        entries.forEach(e => {
            expect(e.totalCount).toBe(1);
            expect(e.isHeavy).toBe(false);
        });
    });

    test('dayStart advances one calendar day per entry', () => {
        const entries = DayPager.weekStripSummary({}, TODAY);
        expect(entries[0].dayStart.toDateString()).toBe(TODAY.toDateString());
        expect(entries[6].dayStart.toDateString()).toBe(new Date(2026, 6, 26).toDateString());
    });
});

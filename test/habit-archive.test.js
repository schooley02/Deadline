/**
 * Habit archive ("Delete Habit", 2026-10-16, Jeremy's call: archive, not
 * hard-delete). Routines.archiveHabit + every filter that hides an archived
 * def (spawning, yesterday snapshot, routine pickers) + the uncomplete guard.
 */
global.Schedule = require('../js/schedule.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.DayRollover = require('../js/dayRollover.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.Heroes = require('../js/heroes.js');
global.RunStats = require('../js/runStats.js');
global.Routines = require('../js/routines.js');
global.TimeSlider = require('../js/timeSlider.js');
const Routines = global.Routines;
const Habits = global.Habits;
const DayPager = require('../js/dayPager.js');
const Items = require('../js/items.js');

const DAY = new Date(2026, 9, 16); // Fri Oct 16 2026, local

function habitDef(id, overrides = {}) {
    return { id, name: `Habit ${id}`, category: 'other', frequency: 'daily', timeOfDay: 'morning',
        streak: 3, isNegative: false, routineId: null, occurrenceHistory: [{ date: '2026-10-15', success: true }], ...overrides };
}
function routine(id, overrides = {}) {
    return { id, name: `Routine ${id}`, habitDefinitionIds: [], taskDefinitionIds: [], isActive: true, frozenState: null, ...overrides };
}

describe('Routines.archiveHabit', () => {
    function setup() {
        const h1 = habitDef('h1', { routineId: 'r1' });
        const h2 = habitDef('h2');
        const r1 = routine('r1', { habitDefinitionIds: ['h1', 'h2'], frozenState: { frozenBy: 'h1', frozenAt: 'x' } });
        const r2 = routine('r2', { habitDefinitionIds: ['h2'], frozenState: { frozenBy: 'h2', frozenAt: 'x' } });
        const activeItems = [
            { id: 10, type: 'habit', definitionId: 'h1' },
            { id: 11, type: 'task', parentId: 10 },
            { id: 12, type: 'habit', definitionId: 'h2' },
        ];
        const removed = [];
        const deps = {
            definedHabits: [h1, h2], definedRoutines: [r1, r2], activeItems,
            removeItem: (id) => removed.push(id), now: () => new Date('2026-10-16T22:00:00Z'),
        };
        return { h1, h2, r1, r2, removed, deps };
    }

    test('marks the def archived, keeps it (and its history) in definedHabits', () => {
        const { h1, deps } = setup();
        const result = Routines.archiveHabit('h1', deps);
        expect(result).toBe(h1);
        expect(h1.archivedAt).toBe('2026-10-16T22:00:00.000Z');
        expect(deps.definedHabits).toContain(h1);
        expect(h1.occurrenceHistory).toHaveLength(1);
        expect(h1.streak).toBe(3);
    });

    test('recalls only its own live instance, sub-tasks first', () => {
        const { removed, deps } = setup();
        Routines.archiveHabit('h1', deps);
        expect(removed).toEqual([11, 10]);
    });

    test('leaves every routine and clears a freeze it caused (only that one)', () => {
        const { h1, r1, r2, deps } = setup();
        Routines.archiveHabit('h1', deps);
        expect(h1.routineId).toBeNull();
        expect(r1.habitDefinitionIds).toEqual(['h2']);
        expect(r1.frozenState).toBeNull();
        expect(r2.frozenState).toEqual({ frozenBy: 'h2', frozenAt: 'x' });
    });

    test('unknown or already-archived id is a no-op returning null', () => {
        const { h1, removed, deps } = setup();
        expect(Routines.archiveHabit('nope', deps)).toBeNull();
        Routines.archiveHabit('h1', deps);
        const stamp = h1.archivedAt;
        removed.length = 0;
        expect(Routines.archiveHabit('h1', deps)).toBeNull();
        expect(h1.archivedAt).toBe(stamp);
        expect(removed).toEqual([]);
    });

    test('an archived habit cannot be re-added to a routine', () => {
        const { deps } = setup();
        Routines.archiveHabit('h1', deps);
        const r3 = routine('r3');
        expect(Routines.addHabitToRoutine('r3', 'h1', [r3], deps.definedHabits)).toEqual({ ok: false, reason: 'not-found' });
        expect(r3.habitDefinitionIds).toEqual([]);
    });
});

describe('archived habits are filtered out', () => {
    test('never spawn', () => {
        const defs = [habitDef('a'), habitDef('b', { archivedAt: '2026-10-16T00:00:00.000Z' })];
        const ids = Habits.selectHabitDefsToSpawn(defs, [], [], DAY, null).map(d => d.id);
        expect(ids).toEqual(['a']);
    });

    test('do not appear in the yesterday snapshot', () => {
        const defs = [habitDef('a'), habitDef('b', { archivedAt: '2026-10-16T00:00:00.000Z' })];
        const ids = DayPager.scheduledHabitsForYesterday(defs, [], new Date(2026, 9, 15)).map(g => g.definitionId);
        expect(ids).toEqual(['a']);
    });
});

describe('uncompleting a completed row of an archived habit', () => {
    function deps(completed, defs) {
        return {
            isGameOver: () => false, activeItems: [], completedItems: () => completed,
            definedHabits: () => defs, definedRoutines: () => [],
            renderCompletedItems: jest.fn(), saveGame: jest.fn(),
        };
    }

    test('is refused and the completed list re-renders', () => {
        const item = { id: 1, type: 'habit', definitionId: 'h', completedAt: new Date() };
        const completed = [item];
        const d = deps(completed, [habitDef('h', { archivedAt: '2026-10-16T00:00:00.000Z' })]);
        Items.uncompleteItem(1, d);
        expect(completed).toEqual([item]);
        expect(item.completedAt).toBeDefined();
        expect(d.activeItems).toEqual([]);
        expect(d.renderCompletedItems).toHaveBeenCalled();
    });
});

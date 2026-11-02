/**
 * Slipped / Resisted entries in the Completed list (Habit Goals Build 2c, Decision 15, 2026-11-01).
 * A Slipped Break habit is KEPT as a tagged entry (outcome 'indulged'); a Resisted one carries outcome 'avoided'.
 * A Slipped entry is not a completion and has no undo.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.Timer = require('../js/timer.js');
const Items = require('../js/items.js');

const fakeEl = () => ({ style: {}, remove: () => {} });
const breakItem = (o) => Object.assign({
    id: 1, type: 'habit', definitionId: 'def1', isNegative: true, name: 'Social media', category: 'lifestyle',
    originalDueDate: new Date('2026-11-01T12:00:00'), dueDateTime: new Date('2026-11-01T12:00:00'),
    timerMinutes: 60, timerMsBanked: 25 * 60000, element: fakeEl(),
}, o);

function makeDeps(over) {
    let points = 100;
    const completed = [];
    const calls = { rendered: 0, recorded: [] };
    const d = Object.assign({
        isGameOver: () => false,
        activeItems: [],
        completedItems: () => completed,
        definedHabits: () => [],
        pointsPerHabit: CONFIG.POINTS_PER_HABIT,
        xpPerHabitComplete: 5,
        getPlayerPoints: () => points,
        setPlayerPoints: (n) => { points = n; },
        getPlayerXP: () => 0, setPlayerXP: () => {},
        updatePlayerDisplays: () => {}, updateTaskCountDisplay: () => {}, checkPlayerLevelUp: () => {},
        saveGame: () => {}, createListItem: () => {}, sortAndRenderActiveList: () => {},
        renderCompletedItems: () => { calls.rendered += 1; },
        recordDaily: (ev, p) => calls.recorded.push([ev, p]),
        getNextId: (() => { let n = 500; return () => n++; })(),
    }, over);
    d.completed = completed; d.calls = calls; d.getPoints = () => points;
    return d;
}

describe('indulgeHabit keeps a Slipped entry', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('a real slip lands in Completed tagged indulged, with logged time kept, and the list re-renders', () => {
        const item = breakItem();
        const habitDef = { id: 'def1', isNegative: true, streak: 4, occurrenceHistory: [] };
        const deps = makeDeps({ activeItems: [item], definedHabits: () => [habitDef] });
        Items.indulgeHabit(1, deps);
        expect(deps.completed).toHaveLength(1);
        expect(deps.completed[0]).toBe(item);
        expect(item.outcome).toBe('indulged');
        expect(item.completedAt).toBeInstanceOf(Date);
        expect(item.timerMsBanked).toBe(25 * 60000);
        expect(item.cheatDayExcused).toBeUndefined();
        expect(deps.calls.rendered).toBe(1);
        expect(habitDef.streak).toBe(0); // the slip itself is unchanged: streak zeroed, points debited
        expect(deps.getPoints()).toBeLessThan(100);
        jest.runOnlyPendingTimers();
        expect(deps.activeItems).toHaveLength(0); // the zombie still leaves the board
    });

    test('a Cheat Day excused slip is kept too, marked, and nothing is charged', () => {
        const item = breakItem();
        const habitDef = { id: 'def1', isNegative: true, streak: 4, occurrenceHistory: [], cheatDayDate: Habits.toOccurrenceDate(item.originalDueDate) };
        const deps = makeDeps({ activeItems: [item], definedHabits: () => [habitDef] });
        Items.indulgeHabit(1, deps);
        expect(deps.completed).toHaveLength(1);
        expect(item.outcome).toBe('indulged');
        expect(item.cheatDayExcused).toBe(true);
        expect(deps.getPoints()).toBe(100);
        expect(habitDef.streak).toBe(4);
    });

    test('a no-op slip (game over / unknown id) keeps nothing', () => {
        const deps = makeDeps({ isGameOver: () => true, activeItems: [breakItem()], definedHabits: () => [{ id: 'def1', isNegative: true, streak: 1, occurrenceHistory: [] }] });
        Items.indulgeHabit(1, deps);
        expect(deps.completed).toHaveLength(0);
    });

    test('the smaller deps shape (no completedItems) still works', () => {
        const item = breakItem();
        const deps = makeDeps({ activeItems: [item], definedHabits: () => [{ id: 'def1', isNegative: true, streak: 2, occurrenceHistory: [] }] });
        delete deps.completedItems;
        expect(() => Items.indulgeHabit(1, deps)).not.toThrow();
        expect(item.outcome).toBeUndefined();
    });
});

describe('completeItem tags a Resisted Break entry', () => {
    test('outcome avoided on a Break habit; none on a Build habit or a task', () => {
        const habitDef = { id: 'def1', isNegative: true, streak: 1, occurrenceHistory: [] };
        const buildDef = { id: 'def2', isNegative: false, streak: 1, occurrenceHistory: [] };
        const resisted = breakItem({ id: 1 });
        const built = breakItem({ id: 2, definitionId: 'def2', isNegative: false });
        const task = { id: 3, type: 'task', name: 't', category: 'other', dueDateTime: new Date(), element: fakeEl(), subTasks: [] };
        const deps = makeDeps({ activeItems: [resisted, built, task], definedHabits: () => [habitDef, buildDef] });
        jest.useFakeTimers();
        [1, 2, 3].forEach(id => Items.completeItem(id, deps));
        jest.runOnlyPendingTimers(); jest.useRealTimers();
        expect(resisted.outcome).toBe('avoided');
        expect(built.outcome).toBeUndefined();
        expect(task.outcome).toBeUndefined();
    });
});

describe('uncompleteItem and Slipped entries', () => {
    test('a Slipped entry has no undo: it stays, nothing is refunded', () => {
        const slipped = breakItem({ outcome: 'indulged', completedAt: new Date() });
        const deps = makeDeps({ definedHabits: () => [{ id: 'def1', isNegative: true, streak: 0, occurrenceHistory: [] }] });
        deps.completed.push(slipped);
        Items.uncompleteItem(slipped.id, deps);
        expect(deps.completed).toHaveLength(1);
        expect(deps.getPoints()).toBe(100);
        expect(deps.calls.rendered).toBe(1);
    });
});

describe('check-in card: a Slipped answer keeps an entry', () => {
    function pending(over) {
        return Object.assign({
            id: 'def1', name: 'Social media', category: 'lifestyle', isNegative: true, streak: 3, occurrenceHistory: [],
            pendingCheckIn: {
                originalDueDate: new Date('2026-10-31T12:00:00'),
                entry: { name: 'Social media', category: 'lifestyle', goal: { type: 'time', amount: 60, unit: 'min' }, timerMinutes: 60, timerMsBanked: 90 * 60000 },
            },
        }, over);
    }

    test('Slipped: entry rebuilt from the snapshot (yesterday\'s logged time included), tagged indulged, ids unique', () => {
        const def = pending();
        const deps = makeDeps({ definedHabits: () => [def] });
        Items.resolvePendingCheckIn('def1', 'indulged', deps);
        expect(deps.completed).toHaveLength(1);
        const e = deps.completed[0];
        expect(e).toMatchObject({ type: 'habit', definitionId: 'def1', isNegative: true, name: 'Social media', outcome: 'indulged', timerMsBanked: 90 * 60000, timerMinutes: 60 });
        expect(e.id).toBe(500);
        expect(e.completedAt).toBeInstanceOf(Date);
        expect(def.pendingCheckIn).toBeUndefined();
        expect(deps.calls.rendered).toBe(1);
    });

    test('Resisted (Jeremy, 2026-11-01): the answer is listed too, tagged avoided, with the logged time and no undo', () => {
        const def = pending();
        const deps = makeDeps({ definedHabits: () => [def] });
        Items.resolvePendingCheckIn('def1', 'avoided', deps);
        expect(deps.completed).toHaveLength(1);
        expect(deps.completed[0]).toMatchObject({ type: 'habit', definitionId: 'def1', isNegative: true, outcome: 'avoided', fromCheckIn: true, timerMsBanked: 90 * 60000 });
        expect(deps.completed[0].completedAt).toBeInstanceOf(Date);
        expect(def.pendingCheckIn).toBeUndefined();
    });

    test('a Resisted check-in entry has no undo: nothing is refunded and it stays listed', () => {
        const def = pending();
        const deps = makeDeps({ definedHabits: () => [def] });
        Items.resolvePendingCheckIn('def1', 'avoided', deps);
        const pts = deps.getPoints();
        Items.uncompleteItem(deps.completed[0].id, deps);
        expect(deps.completed).toHaveLength(1);
        expect(deps.getPoints()).toBe(pts);
    });

    test('a marker from before this build (no snapshot) still produces a plain Slipped entry from the definition', () => {
        const def = pending({ pendingCheckIn: { originalDueDate: new Date('2026-10-31T12:00:00') } });
        const deps = makeDeps({ definedHabits: () => [def] });
        Items.resolvePendingCheckIn('def1', 'indulged', deps);
        expect(deps.completed[0]).toMatchObject({ name: 'Social media', category: 'lifestyle', outcome: 'indulged', timerMsBanked: 0 });
    });

    test('markPendingCheckIn saves the snapshot', () => {
        const def = { id: 'def1', isNegative: true, name: 'Social media', category: 'lifestyle' };
        const item = breakItem();
        const deps = makeDeps({ activeItems: [item], definedHabits: () => [def] });
        Items.markPendingCheckIn(item, deps);
        expect(def.pendingCheckIn.entry).toMatchObject({ name: 'Social media', category: 'lifestyle', timerMinutes: 60, timerMsBanked: 25 * 60000 });
        expect(JSON.parse(JSON.stringify(def.pendingCheckIn.entry)).timerMsBanked).toBe(25 * 60000); // JSON-safe
    });
});

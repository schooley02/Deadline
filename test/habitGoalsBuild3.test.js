/**
 * Habit Goals Build 3 (2026-11-01): How much? stored on the answered entry, the goal tally sent to the daily record, and
 * its correction when a logged time is edited. Items-level behaviour (the DOM surfaces are in test/eveningCheck.test.js).
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.Timer = require('../js/timer.js');
global.GoalCheck = require('../js/goalCheck.js');
const Items = require('../js/items.js');

const fakeEl = () => ({ style: {}, remove: () => {} });
const goals = {
    amount: { type: 'amount', amount: 2, unit: 'drinks', note: null },
    time: { type: 'time', amount: 60, unit: 'min', note: null },
    note: { type: 'note', amount: null, unit: null, note: 'No coffee after 2 PM' },
};
const habitItem = (o) => Object.assign({
    id: 1, type: 'habit', definitionId: 'def1', isNegative: true, name: 'Drinks', category: 'lifestyle',
    originalDueDate: new Date('2026-11-01T12:00:00'), dueDateTime: new Date('2026-11-01T12:00:00'),
    goal: goals.amount, timerMsBanked: 0, element: fakeEl(),
}, o);
const habitDef = (o) => Object.assign({ id: 'def1', isNegative: true, streak: 3, occurrenceHistory: [], goal: goals.amount }, o);

function makeDeps(over) {
    let points = 100;
    const completed = [];
    const recorded = [];
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
        saveGame: () => {}, createListItem: () => {}, sortAndRenderActiveList: () => {}, renderCompletedItems: () => {},
        recordDaily: (ev, p) => recorded.push([ev, p]),
        getNextId: (() => { let n = 500; return () => n++; })(),
    }, over);
    d.completed = completed; d.recorded = recorded;
    d.goalEvents = () => recorded.filter((r) => r[0] === 'goal').map((r) => r[1]);
    return d;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

describe('Resisted / done (completeItem)', () => {
    test('a Break habit with an Amount goal: How much? lands on the entry and the tally says met', () => {
        const item = habitItem();
        const deps = makeDeps({ activeItems: [item], definedHabits: () => [habitDef()] });
        Items.completeItem(1, deps, { actual: 1 });
        expect(item.goalActual).toBe(1);
        expect(item.outcome).toBe('avoided');
        expect(deps.goalEvents()).toEqual([{ habitId: 'def1', type: 'amount', amount: 2, unit: 'drinks', met: true, actual: 1 }]);
    });

    test('no How much? typed: no goalActual, actual is null, the answer still counts as met', () => {
        const item = habitItem();
        const deps = makeDeps({ activeItems: [item], definedHabits: () => [habitDef()] });
        Items.completeItem(1, deps); // the row checkbox / button path passes nothing
        expect(item.goalActual).toBeUndefined();
        expect(deps.goalEvents()[0]).toMatchObject({ met: true, actual: null });
    });

    test('a Build habit with a Time goal records the logged minutes as the actual (Decision 14), never goalActual', () => {
        const item = habitItem({ isNegative: false, goal: goals.time, timerMsBanked: 35 * 60000 });
        const deps = makeDeps({ activeItems: [item], definedHabits: () => [habitDef({ isNegative: false, goal: goals.time })] });
        Items.completeItem(1, deps, { actual: 99 }); // an actual for a Time goal is ignored: the logged time is the number
        expect(item.goalActual).toBeUndefined();
        expect(deps.goalEvents()[0]).toEqual({ habitId: 'def1', type: 'time', amount: 60, unit: 'min', met: true, actual: 35 });
    });

    test('a Note goal records the answer with no actual', () => {
        const item = habitItem({ goal: goals.note });
        const deps = makeDeps({ activeItems: [item], definedHabits: () => [habitDef({ goal: goals.note })] });
        Items.completeItem(1, deps, { actual: 5 });
        expect(item.goalActual).toBeUndefined();
        expect(deps.goalEvents()[0]).toEqual({ habitId: 'def1', type: 'note', amount: null, unit: null, met: true, actual: null });
    });

    test('a habit with no goal records nothing, and a task never records a goal', () => {
        const item = habitItem({ goal: { type: 'none', amount: null, unit: null, note: null } });
        const deps = makeDeps({ activeItems: [item], definedHabits: () => [habitDef({ goal: { type: 'none' } })] });
        Items.completeItem(1, deps, { actual: 3 });
        expect(deps.goalEvents()).toEqual([]);
        expect(item.goalActual).toBeUndefined();

        const task = { id: 2, type: 'task', name: 'T', category: 'other', dueDateTime: new Date(), originalDueDate: new Date(), element: fakeEl() };
        const d2 = makeDeps({ activeItems: [task] });
        Items.completeItem(2, d2, { actual: 3 });
        expect(d2.goalEvents()).toEqual([]);
    });

    test('invalid actuals are ignored (negative, NaN, a string)', () => {
        [-1, NaN, '4'].forEach((bad) => {
            const item = habitItem();
            const deps = makeDeps({ activeItems: [item], definedHabits: () => [habitDef()] });
            Items.completeItem(1, deps, { actual: bad });
            expect(item.goalActual).toBeUndefined();
            expect(deps.goalEvents()[0].actual).toBeNull();
        });
    });

    test('a decimal How much? is kept to 2 places', () => {
        const item = habitItem();
        const deps = makeDeps({ activeItems: [item], definedHabits: () => [habitDef()] });
        Items.completeItem(1, deps, { actual: 1.2345 });
        expect(item.goalActual).toBe(1.23);
    });

    test('an old instance with no goal copy falls back to the habit definition\'s goal', () => {
        const item = habitItem({ goal: undefined });
        delete item.goal;
        const deps = makeDeps({ activeItems: [item], definedHabits: () => [habitDef()] });
        Items.completeItem(1, deps, { actual: 2 });
        expect(item.goalActual).toBe(2);
        expect(deps.goalEvents()[0]).toMatchObject({ type: 'amount', actual: 2 });
    });
});

describe('Slipped (indulgeHabit)', () => {
    test('a real slip records met = false with the typed amount', () => {
        const item = habitItem();
        const deps = makeDeps({ activeItems: [item], definedHabits: () => [habitDef()] });
        Items.indulgeHabit(1, deps, { actual: 5 });
        expect(item.goalActual).toBe(5);
        expect(item.outcome).toBe('indulged');
        expect(deps.goalEvents()).toEqual([{ habitId: 'def1', type: 'amount', amount: 2, unit: 'drinks', met: false, actual: 5 }]);
    });

    test('a Cheat Day excused slip is still met = false for the goal (nothing is charged)', () => {
        const item = habitItem();
        const def = habitDef({ cheatDayDate: Habits.toOccurrenceDate(item.originalDueDate) });
        const deps = makeDeps({ activeItems: [item], definedHabits: () => [def] });
        Items.indulgeHabit(1, deps, { actual: 3 });
        expect(item.cheatDayExcused).toBe(true);
        expect(deps.goalEvents()[0]).toMatchObject({ met: false, actual: 3 });
        expect(deps.getPlayerPoints()).toBe(100);
    });

    test('a Time-goal slip uses the logged minutes (the timer is stopped first)', () => {
        const item = habitItem({ goal: goals.time, timerMsBanked: 90 * 60000 });
        const deps = makeDeps({ activeItems: [item], definedHabits: () => [habitDef({ goal: goals.time })] });
        Items.indulgeHabit(1, deps);
        expect(deps.goalEvents()[0]).toEqual({ habitId: 'def1', type: 'time', amount: 60, unit: 'min', met: false, actual: 90 });
    });

    test('a no-op (game over / unknown habit) records nothing', () => {
        const d1 = makeDeps({ isGameOver: () => true, activeItems: [habitItem()], definedHabits: () => [habitDef()] });
        Items.indulgeHabit(1, d1, { actual: 1 });
        expect(d1.goalEvents()).toEqual([]);
        const d2 = makeDeps({ activeItems: [habitItem()], definedHabits: () => [] });
        Items.indulgeHabit(1, d2, { actual: 1 });
        expect(d2.goalEvents()).toEqual([]);
    });
});

describe('next-morning check-in (resolvePendingCheckIn)', () => {
    const pending = (goal, banked) => habitDef({
        goal,
        pendingCheckIn: { originalDueDate: new Date('2026-10-31T12:00:00'), entry: { name: 'Drinks', category: 'lifestyle', goal, timerMsBanked: banked || 0 } },
    });

    test('Resisted keeps the entry with the typed amount, records met, and returns the entry id', () => {
        const def = pending(goals.amount);
        const deps = makeDeps({ definedHabits: () => [def] });
        const result = Items.resolvePendingCheckIn('def1', 'avoided', deps, { actual: 2 });
        expect(deps.completed).toHaveLength(1);
        expect(deps.completed[0].goalActual).toBe(2);
        expect(deps.completed[0].outcome).toBe('avoided');
        expect(result).toEqual({ entryId: deps.completed[0].id });
        expect(deps.goalEvents()[0]).toEqual({ habitId: 'def1', type: 'amount', amount: 2, unit: 'drinks', met: true, actual: 2 });
        expect(def.pendingCheckIn).toBeUndefined();
    });

    test('Slipped records met = false and uses the snapshot\'s logged time for a Time goal', () => {
        const def = pending(goals.time, 75 * 60000);
        const deps = makeDeps({ definedHabits: () => [def] });
        Items.resolvePendingCheckIn('def1', 'indulged', deps);
        expect(deps.completed[0].outcome).toBe('indulged');
        expect(deps.goalEvents()[0]).toMatchObject({ type: 'time', met: false, actual: 75 });
    });

    test('works with no opts at all (the old two-argument shape) and with a marker that has no snapshot', () => {
        const def = habitDef({ pendingCheckIn: { originalDueDate: new Date('2026-10-31T12:00:00') } });
        const deps = makeDeps({ definedHabits: () => [def] });
        expect(() => Items.resolvePendingCheckIn('def1', 'avoided', deps)).not.toThrow();
        expect(deps.goalEvents()[0]).toMatchObject({ type: 'amount', met: true, actual: null }); // goal from the definition
    });

    test('a missing marker is a no-op that returns nothing', () => {
        const deps = makeDeps({ definedHabits: () => [habitDef()] });
        expect(Items.resolvePendingCheckIn('def1', 'avoided', deps, { actual: 1 })).toBeUndefined();
        expect(deps.goalEvents()).toEqual([]);
    });
});

describe('uncomplete clears the goal entry', () => {
    const DailyRecord = require('../js/dailyRecord.js');

    // The undo respawns the zombie, which builds DOM nodes: same minimal stub test/items-uncomplete-due.test.js uses.
    const stubEl = () => {
        const classes = new Set();
        return {
            style: {}, dataset: {}, className: '', innerHTML: '', textContent: '', offsetWidth: 0,
            classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
            addEventListener: () => {}, appendChild: () => {}, insertBefore: () => {}, querySelector: () => null,
            firstChild: null, remove: () => {},
        };
    };
    beforeAll(() => { global.document = { createElement: () => stubEl(), body: { classList: { contains: () => false } } }; });
    afterAll(() => { delete global.document; });

    // Real daily record behind the recordDaily seam, so the assertion is on what the record ends up holding.
    function liveSetup() {
        const rec = DailyRecord.fresh({ date: DailyRecord.dateKey(Date.now()) });
        const log = [];
        const future = new Date(Date.now() + 3 * 3600 * 1000); // not overdue, so the undo does not take the overdue branch
        const item = habitItem({ isNegative: false, goal: goals.amount, streak: 0, dueDateTime: future, originalDueDate: future, element: null });
        const def = habitDef({ isNegative: false, streak: 0, occurrenceHistory: [] });
        const deps = makeDeps({
            activeItems: [item], definedHabits: () => [def],
            recordDaily: (ev, p) => { log.push([ev, p]); DailyRecord.bump(rec, ev, p); },
            baseWidth: 100, gameCanvas: stubEl(), enemyWidth: 40, habitEnemyWidth: 40,
            handleEnemyClick: () => {}, resetAllSubTaskCheckboxes: () => {},
            calculateTimelineXWithClustering: () => 0, getSubTaskClusterOffset: () => 0, getItemTopPosition: () => 0,
            habitStreakBonusThreshold: 7, habitStreakStrongThreshold: 14,
        });
        deps.recorded = log;
        return { rec, item, def, deps };
    }

    test('completing a Build habit adds its goal entry, and undoing it removes the entry and goalActual', () => {
        const { rec, item, deps } = liveSetup();
        Items.completeItem(1, deps, { actual: 2 });
        expect(rec.goals.def1).toEqual({ type: 'amount', amount: 2, unit: 'drinks', met: true, actual: 2 });
        expect(item.goalActual).toBe(2);
        Items.uncompleteItem(1, deps);
        expect(rec.goals).toEqual({});
        expect(item.goalActual).toBeUndefined();
    });

    test('an undo whose completion belongs to another day still sends goalClear with that day\'s time (State\'s guard drops it)', () => {
        const { item, deps } = liveSetup();
        Items.completeItem(1, deps, { actual: 2 });
        item.completedAt = new Date('2026-10-20T10:00:00'); // pretend it was completed on an earlier day
        deps.recorded.length = 0;
        Items.uncompleteItem(1, deps);
        const clear = deps.recorded.filter((r) => r[0] === 'goalClear');
        expect(clear).toHaveLength(1);
        expect(clear[0][1]).toEqual({ habitId: 'def1', at: new Date('2026-10-20T10:00:00').getTime() });
    });
});

describe('editing a logged time refreshes the recorded goal', () => {
    function setup(goal, banked) {
        const item = habitItem({ goal, timerMsBanked: banked, timer: null });
        const deps = makeDeps({
            activeItems: [], definedHabits: () => [habitDef({ goal })],
            adjustDayTimer: jest.fn(),
            updateDayGoalActual: jest.fn(),
        });
        item.completedAt = new Date('2026-11-01T20:00:00');
        item.outcome = 'avoided';
        deps.completed.push(item);
        return { item, deps };
    }

    test('a Time-goal habit sends the new logged minutes for the entry\'s own day', () => {
        const { item, deps } = setup(goals.time, 20 * 60000);
        const r = Items.setLoggedTime(1, 50 * 60000, deps);
        expect(r.ok).toBe(true);
        expect(item.timerMsBanked).toBe(50 * 60000);
        expect(deps.updateDayGoalActual).toHaveBeenCalledTimes(1);
        const [when, habitId, actual] = deps.updateDayGoalActual.mock.calls[0];
        expect(when).toEqual(new Date('2026-11-01T20:00:00'));
        expect(habitId).toBe('def1');
        expect(actual).toBe(50);
    });

    test('an Amount-goal habit is not touched by a time edit', () => {
        const { deps } = setup(goals.amount, 20 * 60000);
        Items.setLoggedTime(1, 50 * 60000, deps);
        expect(deps.updateDayGoalActual).not.toHaveBeenCalled();
    });

    test('clearing the time to 0 sends a null actual; an unchanged time sends nothing', () => {
        const { deps } = setup(goals.time, 20 * 60000);
        Items.setLoggedTime(1, 0, deps);
        expect(deps.updateDayGoalActual.mock.calls[0][2]).toBeNull();
        deps.updateDayGoalActual.mockClear();
        Items.setLoggedTime(1, 0, deps); // already 0: delta 0
        expect(deps.updateDayGoalActual).not.toHaveBeenCalled();
    });

    test('a missing dep or a throwing dep never loses the edit', () => {
        const { item, deps } = setup(goals.time, 10 * 60000);
        delete deps.updateDayGoalActual;
        expect(Items.setLoggedTime(1, 30 * 60000, deps).ok).toBe(true);
        const s2 = setup(goals.time, 10 * 60000);
        s2.deps.updateDayGoalActual = () => { throw new Error('boom'); };
        expect(Items.setLoggedTime(1, 30 * 60000, s2.deps).ok).toBe(true);
        expect(s2.item.timerMsBanked).toBe(30 * 60000);
        expect(item.timerMsBanked).toBe(30 * 60000);
    });
});

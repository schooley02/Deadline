/**
 * State.performDayRollover / State.checkLiveDayRollover — day-advance
 * mechanism, LIVE mid-session rollover (deferred from session 32, built
 * 2026-07-20; see ROADMAP.md/DECISIONS.md).
 *
 * performDayRollover is the fork extracted out of restoreGameState (was
 * inline there since 2026-07-19) so the live path (loop.js, via
 * checkLiveDayRollover) can't drift from the restore path's settlement
 * rules. Both are exercised here against the REAL js/state.js module — same
 * "bind bare globals, require the real file" approach as loop.test.js.
 * state.js only touches DayRollover (bare global) inside these two
 * functions, so no other module needs binding for this file.
 */
global.DayRollover = require('../js/dayRollover.js');
const State = require('../js/state.js');

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(12, 0, 0, 0);
    return d;
}

function today() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function makeItem(overrides = {}) {
    return { id: 1, type: 'habit', isNegative: false, definitionId: 'd1', originalDueDate: daysAgo(1), ...overrides };
}

function makeDeps(overrides = {}) {
    const state = {
        currentGameDate: today(),
        activeItems: [],
        settled: [],
        checkedIn: [],
        excused: [],
        gameIsOver: false,
        generatedHabits: 0,
        generatedTasks: 0,
        refreshes: 0,
        saves: 0,
        ...overrides.state,
    };
    return {
        _state: state,
        isGameOver: () => state.gameIsOver,
        getCurrentGameDate: () => state.currentGameDate,
        setCurrentGameDate: (d) => { state.currentGameDate = d; },
        getActiveItems: () => state.activeItems,
        isCheatDayExcusedForItem: () => false,
        settleExcusedCheatDay: (item) => { state.excused.push(item.id); state.activeItems = state.activeItems.filter(i => i.id !== item.id); },
        markPendingCheckIn: (item) => { state.checkedIn.push(item.id); state.activeItems = state.activeItems.filter(i => i.id !== item.id); },
        settleStaleRecurringInstance: (item) => { state.settled.push(item.id); state.activeItems = state.activeItems.filter(i => i.id !== item.id); },
        generateDailyHabitInstances: () => { state.generatedHabits++; },
        generateDailyRoutineTaskInstances: () => { state.generatedTasks++; },
        updateTaskCountDisplay: () => { state.refreshes++; },
        updateRoutineDisplay: () => { state.refreshes++; },
        renderDefinedRoutines: () => { state.refreshes++; },
        renderCompletedItems: () => { state.refreshes++; },
        sortAndRenderActiveList: () => { state.refreshes++; },
        saveGame: () => { state.saves++; },
        ...overrides.deps,
    };
}

describe('State.performDayRollover', () => {
    test('same calendar day as currentGameDate -> false, no settlement', () => {
        const item = makeItem();
        const deps = makeDeps({ state: { currentGameDate: today(), activeItems: [item] } });
        const now = new Date(); // still today
        expect(State.performDayRollover(deps, now)).toBe(false);
        expect(deps._state.activeItems).toEqual([item]);
        expect(deps._state.settled).toEqual([]);
    });

    test('a later calendar day -> true, advances currentGameDate to start-of-day(now)', () => {
        const deps = makeDeps({ state: { currentGameDate: daysAgo(1) } });
        const now = new Date();
        expect(State.performDayRollover(deps, now)).toBe(true);
        expect(deps._state.currentGameDate.getTime()).toBe(today().getTime());
    });

    test('a stale recurring instance (routine task) settles via settleStaleRecurringInstance', () => {
        const task = makeItem({ id: 2, type: 'task', definitionId: 'td1' });
        const deps = makeDeps({ state: { currentGameDate: daysAgo(1), activeItems: [task] } });
        State.performDayRollover(deps, new Date());
        expect(deps._state.settled).toEqual([2]);
        expect(deps._state.activeItems).toEqual([]);
    });

    test('a positive habit settles via settleStaleRecurringInstance (not check-in eligible)', () => {
        const habit = makeItem({ id: 3, isNegative: false });
        const deps = makeDeps({ state: { currentGameDate: daysAgo(1), activeItems: [habit] } });
        State.performDayRollover(deps, new Date());
        expect(deps._state.settled).toEqual([3]);
    });

    test('a negative habit from the single most-recent prior day routes through markPendingCheckIn', () => {
        const lurker = makeItem({ id: 4, isNegative: true, originalDueDate: daysAgo(1) });
        const deps = makeDeps({ state: { currentGameDate: daysAgo(1), activeItems: [lurker] } });
        State.performDayRollover(deps, new Date());
        expect(deps._state.checkedIn).toEqual([4]);
        expect(deps._state.settled).toEqual([]);
    });

    test('a negative habit from an OLDER day (not the single most-recent) auto-avoids via settleStaleRecurringInstance', () => {
        const lurker = makeItem({ id: 5, isNegative: true, originalDueDate: daysAgo(3) });
        const deps = makeDeps({ state: { currentGameDate: daysAgo(3), activeItems: [lurker] } });
        State.performDayRollover(deps, new Date());
        expect(deps._state.settled).toEqual([5]);
        expect(deps._state.checkedIn).toEqual([]);
    });

    test('an excused (active Cheat Day) negative habit settles via settleExcusedCheatDay ahead of the check-in fork', () => {
        const lurker = makeItem({ id: 6, isNegative: true, originalDueDate: daysAgo(1) });
        const deps = makeDeps({
            state: { currentGameDate: daysAgo(1), activeItems: [lurker] },
            deps: { isCheatDayExcusedForItem: () => true },
        });
        State.performDayRollover(deps, new Date());
        expect(deps._state.excused).toEqual([6]);
        expect(deps._state.checkedIn).toEqual([]);
        expect(deps._state.settled).toEqual([]);
    });
});

describe('State.checkLiveDayRollover', () => {
    test('no-op (and no throw) when the game is over', () => {
        const deps = makeDeps({ state: { gameIsOver: true, currentGameDate: daysAgo(1) } });
        expect(() => State.checkLiveDayRollover(deps)).not.toThrow();
        expect(deps._state.currentGameDate.getTime()).toBe(daysAgo(1).getTime()); // untouched
        expect(deps._state.saves).toBe(0);
    });

    test('same calendar day -> no generation, no refresh, no save', () => {
        const deps = makeDeps({ state: { currentGameDate: today() } });
        State.checkLiveDayRollover(deps);
        expect(deps._state.generatedHabits).toBe(0);
        expect(deps._state.refreshes).toBe(0);
        expect(deps._state.saves).toBe(0);
    });

    test('a real rollover settles stale instances, spawns today\'s, refreshes displays, and saves once', () => {
        const task = makeItem({ id: 7, type: 'task', definitionId: 'td1' });
        const deps = makeDeps({ state: { currentGameDate: daysAgo(1), activeItems: [task] } });
        State.checkLiveDayRollover(deps);
        expect(deps._state.settled).toEqual([7]);
        expect(deps._state.currentGameDate.getTime()).toBe(today().getTime());
        expect(deps._state.generatedHabits).toBe(1);
        expect(deps._state.generatedTasks).toBe(1);
        expect(deps._state.refreshes).toBe(5); // the 5 refresh collaborators, each called once
        expect(deps._state.saves).toBe(1);
    });
});

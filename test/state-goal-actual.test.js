/**
 * State.updateDayGoalActual + the closed-day guard for 'goalClear' (Habit Goals Build 3, DailyRecord v5).
 * Mirrors test/state-adjust-day-timer.test.js: the open day's record, or a CLOSED day's record in deadline.days.
 */
global.DailyRecord = require('../js/dailyRecord.js');
global.DayRollover = require('../js/dayRollover.js');
global.Persistence = require('../js/persistence.js');
const State = require('../js/state.js');

beforeAll(() => { global.window = { definedTasks: [] }; });
afterAll(() => { delete global.window; });

let store;
beforeEach(() => {
    store = {};
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
    State.setToday(DailyRecord.fresh({ date: '2026-11-01', tz: -360 }));
});
afterEach(() => { delete global.localStorage; });

const timeGoal = (actual) => ({ habitId: 'h1', type: 'time', amount: 60, unit: 'min', met: true, actual });
function seedClosedDay(date, goals) {
    const rec = DailyRecord.fresh({ date, tz: -360 });
    rec.goals = goals;
    store['deadline.days'] = JSON.stringify(DailyRecord.addDay(DailyRecord.emptyStore(), rec));
}
const closedDays = () => JSON.parse(store['deadline.days']).days;

describe('updateDayGoalActual', () => {
    test("the open day's recorded goal entry is corrected in place", () => {
        State.bumpToday('goal', timeGoal(20));
        expect(State.updateDayGoalActual('2026-11-01', 'h1', 45)).toBe(true);
        expect(State.getToday().goals.h1).toMatchObject({ actual: 45, met: true });
        expect(store['deadline.days']).toBeUndefined();
    });

    test("a closed day's entry is corrected and saved to deadline.days", () => {
        seedClosedDay('2026-10-30', { h1: { type: 'time', amount: 60, unit: null, met: false, actual: 70 } });
        expect(State.updateDayGoalActual('2026-10-30', 'h1', 50)).toBe(true);
        expect(closedDays()['2026-10-30'].goals.h1).toEqual({ type: 'time', amount: 60, unit: null, met: false, actual: 50 });
        expect(State.getToday().goals).toEqual({}); // today untouched
    });

    test('no entry (habit never answered that day), no such day, or bad input: left alone, false', () => {
        expect(State.updateDayGoalActual('2026-11-01', 'h1', 45)).toBe(false);
        expect(State.getToday().goals).toEqual({});
        seedClosedDay('2026-10-30', {});
        const before = store['deadline.days'];
        expect(State.updateDayGoalActual('2026-10-30', 'h1', 45)).toBe(false);
        expect(State.updateDayGoalActual('2026-10-12', 'h1', 45)).toBe(false);
        expect(State.updateDayGoalActual('', 'h1', 45)).toBe(false);
        expect(State.updateDayGoalActual('2026-11-01', null, 45)).toBe(false);
        expect(store['deadline.days']).toBe(before); // nothing rewritten
    });

    test('a correction that changes nothing does not rewrite the closed-days store', () => {
        seedClosedDay('2026-10-30', { h1: { type: 'time', amount: 60, unit: null, met: true, actual: 50 } });
        const before = store['deadline.days'];
        expect(State.updateDayGoalActual('2026-10-30', 'h1', 50)).toBe(false);
        expect(store['deadline.days']).toBe(before);
    });
});

describe("bumpToday guards a 'goalClear' from an earlier day", () => {
    test("a clear whose completion time is on another day does not touch today's goals", () => {
        State.bumpToday('goal', timeGoal(20));
        State.bumpToday('goalClear', { habitId: 'h1', at: new Date('2026-10-20T10:00:00').getTime() });
        expect(State.getToday().goals.h1).toBeDefined();
    });

    test("a clear from today removes today's entry", () => {
        State.bumpToday('goal', timeGoal(20));
        State.bumpToday('goalClear', { habitId: 'h1', at: new Date('2026-11-01T10:00:00').getTime() });
        expect(State.getToday().goals).toEqual({});
    });

    test('a clear with no timestamp (older callers) still applies to today', () => {
        State.bumpToday('goal', timeGoal(20));
        State.bumpToday('goalClear', { habitId: 'h1' });
        expect(State.getToday().goals).toEqual({});
    });
});

/**
 * State.adjustDayTimer (Habit Goals Build 2c, DailyRecord v4): an edited logged time corrects the record of the
 * item's own day -- the open day's working record, or that day's CLOSED record in deadline.days.
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

function seedClosedDay(date, timer) {
    const rec = DailyRecord.fresh({ date, tz: -360 });
    Object.assign(rec.timer, timer);
    store['deadline.days'] = JSON.stringify(DailyRecord.addDay(DailyRecord.emptyStore(), rec));
}
const closedDays = () => JSON.parse(store['deadline.days']).days;

describe('adjustDayTimer', () => {
    test("the open day's working record is corrected in place", () => {
        State.bumpToday('timer', { kind: 'limit', minutes: 30 });
        expect(State.adjustDayTimer('2026-11-01', 'limit', 12)).toBe(true);
        expect(State.getToday().timer).toEqual({ workMin: 0, limitMin: 42, edits: 1, editMin: 12 });
        expect(store['deadline.days']).toBeUndefined(); // nothing written to the closed-days store
    });

    test("a closed day's record in deadline.days is corrected and saved", () => {
        seedClosedDay('2026-10-30', { workMin: 50 });
        expect(State.adjustDayTimer('2026-10-30', 'work', -20)).toBe(true);
        expect(closedDays()['2026-10-30'].timer).toEqual({ workMin: 30, limitMin: 0, edits: 1, editMin: -20 });
        expect(State.getToday().timer.workMin).toBe(0); // today untouched
    });

    test('never below 0 on a closed day', () => {
        seedClosedDay('2026-10-30', { workMin: 5 });
        State.adjustDayTimer('2026-10-30', 'work', -60);
        expect(closedDays()['2026-10-30'].timer.workMin).toBe(0);
        expect(closedDays()['2026-10-30'].timer.editMin).toBe(-5);
    });

    test('a day with no record (never seen / rolled into a month) is left alone: false', () => {
        seedClosedDay('2026-10-30', { workMin: 5 });
        expect(State.adjustDayTimer('2026-10-12', 'work', 10)).toBe(false);
        expect(closedDays()['2026-10-30'].timer.workMin).toBe(5);
        expect(State.adjustDayTimer('', 'work', 10)).toBe(false);
    });

    test('a correction that changes nothing does not rewrite the store', () => {
        seedClosedDay('2026-10-30', { workMin: 0 });
        const before = store['deadline.days'];
        expect(State.adjustDayTimer('2026-10-30', 'work', -5)).toBe(true);
        expect(store['deadline.days']).toBe(before);
    });

    test('a failing store write reports false and never throws', () => {
        seedClosedDay('2026-10-30', { workMin: 5 });
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        global.localStorage.setItem = () => { throw new Error('quota'); };
        expect(() => State.adjustDayTimer('2026-10-30', 'work', 5)).not.toThrow();
        expect(State.adjustDayTimer('2026-10-30', 'work', 5)).toBe(false);
        spy.mockRestore();
    });
});

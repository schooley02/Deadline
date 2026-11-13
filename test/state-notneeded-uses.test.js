/**
 * "Not needed" passes (2026-11-13): State keeps the use stamps (`notNeededUses`, additive root save field) and a new run does
 * NOT clear them (the allowance is per real week, not per run).
 */
global.DailyRecord = require('../js/dailyRecord.js');
global.DayRollover = require('../js/dayRollover.js');
global.Persistence = require('../js/persistence.js');
const State = require('../js/state.js');

beforeAll(() => { global.window = { definedTasks: [] }; });
afterAll(() => { delete global.window; });
beforeEach(() => State.setNotNeededUses(null));

describe('notNeededUses', () => {
    test('starts empty', () => {
        expect(State.getNotNeededUses()).toEqual([]);
    });
    test('the setter keeps only finite numbers', () => {
        State.setNotNeededUses([1, 'x', NaN, 3, null, Infinity]);
        expect(State.getNotNeededUses()).toEqual([1, 3]);
    });
    test('junk input becomes empty', () => {
        State.setNotNeededUses(42);
        expect(State.getNotNeededUses()).toEqual([]);
        State.setNotNeededUses({ a: 1 });
        expect(State.getNotNeededUses()).toEqual([]);
    });
    test('it rides in getPersistableState as notNeededUses', () => {
        State.setNotNeededUses([10, 20]);
        expect(State.getPersistableState({}).notNeededUses).toEqual([10, 20]);
    });
});

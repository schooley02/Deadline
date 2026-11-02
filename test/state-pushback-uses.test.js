/**
 * Pushback charges Build B (2026-11-02): State keeps the free-charge use stamps per size
 * (`pushbackUses`, additive root save field) and the old `rescheduleFreeUses` is gone.
 */
global.DailyRecord = require('../js/dailyRecord.js');
global.DayRollover = require('../js/dayRollover.js');
global.Persistence = require('../js/persistence.js');
const State = require('../js/state.js');

beforeAll(() => { global.window = { definedTasks: [] }; });
afterAll(() => { delete global.window; });
beforeEach(() => State.setPushbackUses(null));

describe('pushbackUses', () => {
    test('starts empty for every size', () => {
        expect(State.getPushbackUses()).toEqual({ short: [], medium: [], long: [] });
    });
    test('the setter keeps only finite numbers for the three sizes', () => {
        State.setPushbackUses({ short: [1, 'x', NaN, 3], medium: 'nope', long: [5], extra: [9] });
        expect(State.getPushbackUses()).toEqual({ short: [1, 3], medium: [], long: [5] });
    });
    test('junk input becomes empty', () => {
        State.setPushbackUses(42);
        expect(State.getPushbackUses()).toEqual({ short: [], medium: [], long: [] });
    });
    test('it rides in getPersistableState as pushbackUses, and the old field is no longer saved', () => {
        State.setPushbackUses({ short: [10, 20], medium: [], long: [30] });
        const saved = State.getPersistableState({});
        expect(saved.pushbackUses).toEqual({ short: [10, 20], medium: [], long: [30] });
        expect('rescheduleFreeUses' in saved).toBe(false);
    });
    test('the old accessors are gone', () => {
        expect(State.getRescheduleFreeUses).toBeUndefined();
        expect(State.setRescheduleFreeUses).toBeUndefined();
    });
});

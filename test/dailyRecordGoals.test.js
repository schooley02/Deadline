/**
 * DailyRecord v5 (Habit Goals Build 3, 2026-11-01): the `goals` tally of answered habits.
 */
const DailyRecord = require('../js/dailyRecord.js');
const Habits = require('../js/habits.js');
const Settings = require('../js/settings.js');

const rec = () => DailyRecord.fresh({ date: '2026-11-01' });
const amountEntry = (o) => Object.assign({ habitId: 'h1', type: 'amount', amount: 2, unit: 'drinks', met: false, actual: 4 }, o);

describe('v5 shape', () => {
    test('version is 8 (v6 adds pb, v7 adds drops, v8 adds tcorr) and a fresh record starts with an empty goals map', () => {
        expect(DailyRecord.V).toBe(8);
        const r = rec();
        expect(r.v).toBe(8);
        expect(r.goals).toEqual({});
    });

    test('the local unit whitelist mirrors Habits.GOAL_UNIT_SUGGESTIONS', () => {
        expect(DailyRecord.GOAL_UNITS).toEqual(Habits.GOAL_UNIT_SUGGESTIONS);
    });

    test('older (v3 / v4) records normalize with an empty goals map and keep their data', () => {
        const old = { v: 4, date: '2026-10-30', done: { task: 2, subtask: 0, habit: 1, late: 0 } };
        const n = DailyRecord.normalize(old);
        expect(n.goals).toEqual({});
        expect(n.done.task).toBe(2);
        expect(n.v).toBe(4); // normalize never rewrites the stored version
    });
});

describe("the 'goal' event", () => {
    test('records one entry per habit, keyed by the opaque habit id, with the player\'s own answer', () => {
        const r = rec();
        DailyRecord.bump(r, 'goal', amountEntry());
        DailyRecord.bump(r, 'goal', { habitId: 7, type: 'time', amount: 30, unit: 'min', met: true, actual: 31 });
        expect(r.goals.h1).toEqual({ type: 'amount', amount: 2, unit: 'drinks', met: false, actual: 4 });
        expect(r.goals['7']).toEqual({ type: 'time', amount: 30, unit: null, met: true, actual: 31 }); // only Amount goals keep a unit
    });

    test('a second answer for the same habit overwrites (undo + answer again)', () => {
        const r = rec();
        DailyRecord.bump(r, 'goal', amountEntry({ met: false, actual: 4 }));
        DailyRecord.bump(r, 'goal', amountEntry({ met: true, actual: 1 }));
        expect(Object.keys(r.goals)).toEqual(['h1']);
        expect(r.goals.h1).toMatchObject({ met: true, actual: 1 });
    });

    test('a Note goal keeps no free text and no numbers', () => {
        const r = rec();
        DailyRecord.bump(r, 'goal', { habitId: 'n', type: 'note', note: 'No coffee after 2 PM', amount: 9, unit: 'cups', met: true, actual: 3 });
        expect(r.goals.n).toEqual({ type: 'note', amount: null, unit: null, met: true, actual: null });
        expect(JSON.stringify(r)).not.toContain('coffee');
    });

    test('an unknown unit is stored as "other" (no free text in the record); a known one is kept', () => {
        const r = rec();
        DailyRecord.bump(r, 'goal', amountEntry({ habitId: 'u1', unit: 'bananas' }));
        DailyRecord.bump(r, 'goal', amountEntry({ habitId: 'u2', unit: '$' }));
        expect(r.goals.u1.unit).toBe('other');
        expect(r.goals.u2.unit).toBe('$');
        expect(JSON.stringify(r)).not.toContain('bananas');
    });

    test('bad payloads change nothing and never throw', () => {
        const r = rec();
        expect(() => DailyRecord.bump(r, 'goal', { type: 'amount', amount: 1 })).not.toThrow(); // no habitId
        DailyRecord.bump(r, 'goal', { habitId: 'x', type: 'bogus' });
        DailyRecord.bump(r, 'goal', { habitId: 'y', type: 'amount', amount: -3, actual: 'lots' });
        expect(r.goals.x).toBeUndefined();
        expect(r.goals.y).toEqual({ type: 'amount', amount: null, unit: null, met: false, actual: null });
        expect(Object.keys(r.goals)).toEqual(['y']);
    });

    test('a record missing the goals map (older open day restored from a save) still accepts goals', () => {
        const r = rec();
        delete r.goals;
        DailyRecord.bump(r, 'goal', amountEntry());
        expect(r.goals.h1).toBeDefined();
    });
});

describe("the 'goalClear' event", () => {
    test('removes that habit\'s entry only', () => {
        const r = rec();
        DailyRecord.bump(r, 'goal', amountEntry({ habitId: 'a' }));
        DailyRecord.bump(r, 'goal', amountEntry({ habitId: 'b' }));
        DailyRecord.bump(r, 'goalClear', { habitId: 'a' });
        expect(Object.keys(r.goals)).toEqual(['b']);
        DailyRecord.bump(r, 'goalClear', { habitId: 'nope' }); // nothing to clear: fine
        expect(Object.keys(r.goals)).toEqual(['b']);
    });
});

describe('setGoalActual', () => {
    test('corrects an existing Time / Amount entry\'s actual and never touches met', () => {
        const r = rec();
        DailyRecord.bump(r, 'goal', { habitId: 't', type: 'time', amount: 30, met: true, actual: 20 });
        expect(DailyRecord.setGoalActual(r, 't', 45)).toBe(true);
        expect(r.goals.t).toMatchObject({ actual: 45, met: true });
        expect(DailyRecord.setGoalActual(r, 't', 45)).toBe(false); // no change
        expect(DailyRecord.setGoalActual(r, 't', null)).toBe(true);
        expect(r.goals.t.actual).toBeNull();
    });

    test('never creates an entry (an unanswered habit has none) and ignores Note goals and bad input', () => {
        const r = rec();
        expect(DailyRecord.setGoalActual(r, 'ghost', 10)).toBe(false);
        expect(r.goals).toEqual({});
        DailyRecord.bump(r, 'goal', { habitId: 'n', type: 'note', met: true });
        expect(DailyRecord.setGoalActual(r, 'n', 5)).toBe(false);
        expect(DailyRecord.setGoalActual(null, 'n', 5)).toBe(false);
        DailyRecord.bump(r, 'goal', { habitId: 'a', type: 'amount', amount: 2, met: true, actual: 1 });
        expect(DailyRecord.setGoalActual(r, 'a', -4)).toBe(true); // a negative is not valid: stored as cleared
        expect(r.goals.a.actual).toBeNull();
    });
});

describe('close + store round trips keep the goals', () => {
    test('close() keeps the day\'s goals and re-sanitizes them', () => {
        const r = rec();
        DailyRecord.bump(r, 'goal', amountEntry());
        const closed = DailyRecord.close(r, { lvl: 3 });
        expect(closed.goals.h1).toEqual({ type: 'amount', amount: 2, unit: 'drinks', met: false, actual: 4 });
        expect(closed.v).toBe(DailyRecord.V);
    });

    test('a closed day written into a store and merged on import keeps its goals', () => {
        const r = DailyRecord.close((() => { const x = rec(); DailyRecord.bump(x, 'goal', amountEntry()); return x; })(), {});
        const store = DailyRecord.addDay(DailyRecord.emptyStore(), r);
        const merged = DailyRecord.mergeStores(DailyRecord.emptyStore(), JSON.parse(JSON.stringify(store)));
        expect(merged.store.days['2026-11-01'].goals.h1.met).toBe(false);
    });
});

describe('settings round trip for the evening time', () => {
    beforeEach(() => {
        const mem = {};
        global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
    });
    afterEach(() => { delete global.localStorage; });

    test('saves and reloads a valid time; an invalid one falls back to the default', () => {
        Settings.save({ eveningCheckTime: '20:15' });
        expect(Settings.load().eveningCheckTime).toBe('20:15');
        global.localStorage.setItem('deadline.settings', JSON.stringify({ effectsIntensity: 'full', eveningCheckTime: '25:99' }));
        expect(Settings.load().eveningCheckTime).toBe('21:00');
    });

    test('saving only the effects intensity keeps the stored evening time (and vice versa)', () => {
        Settings.save({ eveningCheckTime: '19:30' });
        Settings.save({ effectsIntensity: 'off' });
        expect(Settings.load()).toEqual({ effectsIntensity: 'off', eveningCheckTime: '19:30', timerHintSeen: false, devTools: false });
        Settings.save({ eveningCheckTime: '22:00' });
        expect(Settings.load()).toEqual({ effectsIntensity: 'off', eveningCheckTime: '22:00', timerHintSeen: false, devTools: false });
    });

    test('an old save with no evening time loads the default', () => {
        global.localStorage.setItem('deadline.settings', JSON.stringify({ effectsIntensity: 'reduced' }));
        expect(Settings.load()).toEqual({ effectsIntensity: 'reduced', eveningCheckTime: '21:00', timerHintSeen: false, devTools: false });
    });

    test('a single-digit hour is stored padded', () => {
        Settings.save({ eveningCheckTime: '9:05' });
        expect(Settings.load().eveningCheckTime).toBe('09:05');
    });
});

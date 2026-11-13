/**
 * DailyRecord v12 (Iced zombies, 2026-11-10): `ice` = { n, min }, the stretches of ice today. Same guardrail as the other counters:
 * added in the SAME session as the mechanic (docs/DAILY_RECORD_PLAN.md).
 */
const DailyRecord = require('../js/dailyRecord.js');
const MIN = 60000;

const rec = () => DailyRecord.fresh({ date: '2026-11-10', tz: 0 });

describe('v12 ice tally', () => {
    test('a fresh record starts with no ice', () => {
        expect(DailyRecord.V).toBe(17);
        expect(rec().ice).toEqual({ n: 0, min: 0 });
    });
    test('each stretch adds one to n and its minutes to min', () => {
        const r = rec();
        DailyRecord.bump(r, 'ice', { ms: 10 * MIN });
        DailyRecord.bump(r, 'ice', { ms: 30 * 1000 });
        expect(r.ice.n).toBe(2);
        expect(r.ice.min).toBeCloseTo(10.5, 5);
    });
    test('junk or zero-length payloads change nothing', () => {
        const r = rec();
        [undefined, null, {}, { ms: 0 }, { ms: -5 }, { ms: 'x' }, { ms: Infinity }].forEach(p => DailyRecord.bump(r, 'ice', p));
        expect(r.ice).toEqual({ n: 0, min: 0 });
    });
    test('it does not touch the damage counters (ice is the absence of an attack tick)', () => {
        const r = rec();
        DailyRecord.bump(r, 'ice', { ms: 5 * MIN });
        expect(r.dmg).toEqual(rec().dmg);
    });
    test('a bump on an older (v11) record that has no `ice` still works', () => {
        const old = rec();
        delete old.ice;
        old.v = 11;
        DailyRecord.bump(old, 'ice', { ms: 2 * MIN });
        expect(old.ice).toEqual({ n: 1, min: 2 });
    });
    test('normalize gives an older record zeroed ice, keeps its version, and keeps a saved tally', () => {
        const old = rec();
        delete old.ice;
        old.v = 11;
        expect(DailyRecord.normalize(old).ice).toEqual({ n: 0, min: 0 });
        expect(DailyRecord.normalize(old).v).toBe(11);
        const kept = rec();
        DailyRecord.bump(kept, 'ice', { ms: 3 * MIN });
        expect(DailyRecord.normalize(JSON.parse(JSON.stringify(kept))).ice).toEqual({ n: 1, min: 3 });
    });
    test('closing a day keeps it, and rollUp sums it into the month (older days add zero)', () => {
        const a = rec();
        const b = DailyRecord.fresh({ date: '2026-11-11', tz: 0 });
        const c = DailyRecord.fresh({ date: '2026-11-12', tz: 0 });
        DailyRecord.bump(a, 'ice', { ms: 2 * MIN });
        DailyRecord.bump(b, 'ice', { ms: 5 * MIN });
        delete c.ice; c.v = 11;
        expect(DailyRecord.close(a, { lvl: 1 }).ice).toEqual({ n: 1, min: 2 });
        let store = DailyRecord.emptyStore();
        [a, b, c].forEach(d => { store = DailyRecord.addDay(store, DailyRecord.close(d, { lvl: 1 })); });
        const month = DailyRecord.rollUp(store, new Date(2028, 5, 1)).months['2026-11'];
        expect(month.ice).toEqual({ n: 2, min: 7 });
    });
});

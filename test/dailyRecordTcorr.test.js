/**
 * DailyRecord v8 (Timer sessions, 2026-11-04): `tcorr` = { n, hp }, the timer-session corrections that took halved damage
 * back, and the HP actually taken (after the 1 HP floor). Same guardrail as the other counters: added in the SAME session as
 * the mechanic.
 */
const DailyRecord = require('../js/dailyRecord.js');

const rec = () => DailyRecord.fresh({ date: '2026-11-04', tz: 0 });

describe('v8 tcorr tally', () => {
    test('a fresh record starts with no corrections', () => {
        expect(DailyRecord.V).toBe(8);
        expect(rec().tcorr).toEqual({ n: 0, hp: 0 });
    });
    test('each charged correction adds one to n and its HP to hp', () => {
        const r = rec();
        DailyRecord.bump(r, 'tcorr', { hp: 3 });
        DailyRecord.bump(r, 'tcorr', { hp: 2 });
        expect(r.tcorr).toEqual({ n: 2, hp: 5 });
    });
    test('junk or zero-HP payloads change nothing (a correction the floor reduced to 0 is not a charge)', () => {
        const r = rec();
        [undefined, null, {}, { hp: 0 }, { hp: -4 }, { hp: 'x' }].forEach(p => DailyRecord.bump(r, 'tcorr', p));
        expect(r.tcorr).toEqual({ n: 0, hp: 0 });
    });
    test('a bump on an older (v7) record that has no `tcorr` still works', () => {
        const old = rec();
        delete old.tcorr;
        old.v = 7;
        DailyRecord.bump(old, 'tcorr', { hp: 4 });
        expect(old.tcorr).toEqual({ n: 1, hp: 4 });
    });
    test('normalize gives an older record zeroed tcorr and keeps a saved tally', () => {
        const old = rec();
        delete old.tcorr;
        old.v = 7;
        expect(DailyRecord.normalize(old).tcorr).toEqual({ n: 0, hp: 0 });
        expect(DailyRecord.normalize(old).v).toBe(7);
        const kept = rec();
        DailyRecord.bump(kept, 'tcorr', { hp: 6 });
        expect(DailyRecord.normalize(JSON.parse(JSON.stringify(kept))).tcorr).toEqual({ n: 1, hp: 6 });
    });
    test('it does not touch the damage counters (a correction is not an attack tick)', () => {
        const r = rec();
        DailyRecord.bump(r, 'tcorr', { hp: 3 });
        expect(r.dmg).toEqual(rec().dmg);
    });
    test('closing a day keeps it, and rollUp sums it into the month (older days add zero)', () => {
        const a = rec();
        const b = DailyRecord.fresh({ date: '2026-11-05', tz: 0 });
        const c = DailyRecord.fresh({ date: '2026-11-06', tz: 0 });
        DailyRecord.bump(a, 'tcorr', { hp: 2 });
        DailyRecord.bump(b, 'tcorr', { hp: 5 });
        delete c.tcorr; c.v = 7;
        expect(DailyRecord.close(a, { lvl: 1 }).tcorr).toEqual({ n: 1, hp: 2 });
        let store = DailyRecord.emptyStore();
        [rec(), b, c].forEach((d, i) => { if (i === 0) { DailyRecord.bump(d, 'tcorr', { hp: 2 }); } store = DailyRecord.addDay(store, DailyRecord.close(d, { lvl: 1 })); });
        const month = DailyRecord.rollUp(store, new Date(2028, 5, 1)).months['2026-11'];
        expect(month.tcorr).toEqual({ n: 2, hp: 7 });
    });
});

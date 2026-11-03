/**
 * DailyRecord v7 (Village tier drops, 2026-11-03): `drops` = { n, pts }, the free items a village building paid that day.
 * The daily-record guardrail: a mechanic that changes what can happen in a day adds its counter in the SAME session.
 */
const DailyRecord = require('../js/dailyRecord.js');

const rec = () => DailyRecord.fresh({ date: '2026-11-03', tz: 0 });

describe('v7 drops tally', () => {
    test('the version is 7 and a fresh record starts with no drops', () => {
        expect(DailyRecord.V).toBe(7);
        const r = rec();
        expect(r.v).toBe(7);
        expect(r.drops).toEqual({ n: 0, pts: 0 });
    });

    test('a drop event adds the items and their shop value', () => {
        const r = rec();
        DailyRecord.bump(r, 'drop', { count: 2, value: 35 });
        DailyRecord.bump(r, 'drop', { count: 1, value: 50 });
        expect(r.drops).toEqual({ n: 3, pts: 85 });
    });

    test('junk or empty payloads change nothing', () => {
        const r = rec();
        [undefined, null, {}, { count: 0, value: 0 }, { count: -2, value: -5 }, { count: 'x', value: 'y' }].forEach(p => DailyRecord.bump(r, 'drop', p));
        expect(r.drops).toEqual({ n: 0, pts: 0 });
    });

    test('a drop does not touch the spend or token counters (free items are not bought or used)', () => {
        const r = rec();
        DailyRecord.bump(r, 'drop', { count: 1, value: 100 });
        expect(r.pts).toEqual(rec().pts);
        expect(r.tokens).toEqual(rec().tokens);
    });

    test('a bump on an older (v6) record that has no `drops` still works', () => {
        const old = rec();
        delete old.drops;
        old.v = 6;
        DailyRecord.bump(old, 'drop', { count: 1, value: 25 });
        expect(old.drops).toEqual({ n: 1, pts: 25 });
    });

    test('normalize gives an older record zeroed drops and keeps a saved tally', () => {
        const old = rec();
        delete old.drops;
        old.v = 6;
        expect(DailyRecord.normalize(old).drops).toEqual({ n: 0, pts: 0 });
        expect(DailyRecord.normalize(old).v).toBe(6);
        const kept = rec();
        DailyRecord.bump(kept, 'drop', { count: 2, value: 60 });
        expect(DailyRecord.normalize(JSON.parse(JSON.stringify(kept))).drops).toEqual({ n: 2, pts: 60 });
    });

    test('closing a day keeps the tally', () => {
        const r = rec();
        DailyRecord.bump(r, 'drop', { count: 1, value: 10 });
        expect(DailyRecord.close(r, { lvl: 1 }).drops).toEqual({ n: 1, pts: 10 });
    });

    test('rollUp sums drops across days into the month record (older days without the field add zero)', () => {
        const a = rec();
        const b = DailyRecord.fresh({ date: '2026-11-04', tz: 0 });
        const c = DailyRecord.fresh({ date: '2026-11-05', tz: 0 });
        DailyRecord.bump(a, 'drop', { count: 1, value: 10 });
        DailyRecord.bump(b, 'drop', { count: 2, value: 75 });
        delete c.drops; c.v = 6; // a day recorded before v7
        let store = DailyRecord.emptyStore();
        [a, b, c].forEach(d => { store = DailyRecord.addDay(store, DailyRecord.close(d, { lvl: 1 })); });
        const rolled = DailyRecord.rollUp(store, new Date(2028, 5, 1));
        const month = rolled.months['2026-11'];
        expect(month.drops).toEqual({ n: 3, pts: 85 });
    });
});

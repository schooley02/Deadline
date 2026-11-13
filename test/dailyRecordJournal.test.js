/**
 * DailyRecord v16 (Journal Build A, 2026-11-13): `notes` = a COUNT of the journal notes written about a day (the text lives in its own
 * key). Added in the SAME session as the feature (docs/DAILY_RECORD_PLAN.md guardrail).
 */
const DailyRecord = require('../js/dailyRecord.js');

const rec = () => DailyRecord.fresh({ date: '2026-11-13', tz: 0 });

describe('v16 notes count', () => {
    test('the version is 16 and a fresh record has notes 0', () => {
        expect(DailyRecord.V).toBe(16);
        expect(rec().notes).toBe(0);
    });
    test('a note adds one; an undo / delete takes one back; the count never goes below 0', () => {
        const r = rec();
        DailyRecord.bump(r, 'note', { n: 1 });
        DailyRecord.bump(r, 'note', { n: 1 });
        expect(r.notes).toBe(2);
        DailyRecord.bump(r, 'note', { n: -1 });
        expect(r.notes).toBe(1);
        DailyRecord.bump(r, 'note', { n: -5 });
        expect(r.notes).toBe(0);
    });
    test('no payload counts as one note; a junk n is treated as one', () => {
        const r = rec();
        DailyRecord.bump(r, 'note');
        DailyRecord.bump(r, 'note', { n: 'x' });
        expect(r.notes).toBe(2);
    });
    test('an older day (no notes field) normalizes to 0 and keeps its own version', () => {
        const old = DailyRecord.fresh({ date: '2026-11-12', tz: 0 });
        delete old.notes;
        old.v = 15;
        const n = DailyRecord.normalize(old);
        expect(n.notes).toBe(0);
        expect(n.v).toBe(15);
    });
    test('a stored count survives normalize', () => {
        const r = rec();
        DailyRecord.bump(r, 'note', { n: 3 });
        expect(DailyRecord.normalize(JSON.parse(JSON.stringify(r))).notes).toBe(3);
    });
    test('the month roll-up sums the notes of the days folded in', () => {
        const days = {};
        ['2024-01-05', '2024-01-06'].forEach((d, i) => {
            const r = DailyRecord.fresh({ date: d, tz: 0 });
            DailyRecord.bump(r, 'note', { n: i + 1 });
            days[d] = r;
        });
        const store = { v: DailyRecord.V, days, months: {} };
        DailyRecord.rollUp(store, new Date(2026, 10, 13).getTime());
        expect(Object.keys(store.days)).toEqual([]);
        expect(store.months['2024-01'].notes).toBe(3);
    });
});

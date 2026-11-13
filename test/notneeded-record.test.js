/**
 * Daily record v17 `ne` (2026-11-13): "not needed" passes spent per day, summed into months. Stats line.
 */
const DailyRecord = require('../js/dailyRecord.js');
const StatsView = require('../js/ui/statsView.js');

const rec = () => DailyRecord.fresh({ date: '2026-11-13', tz: 0 });

describe('daily record ne', () => {
    test('a fresh day starts at 0 and each notNeeded event adds one', () => {
        const r = rec();
        expect(r.v).toBe(17);
        expect(r.ne).toBe(0);
        DailyRecord.bump(r, 'notNeeded', {});
        DailyRecord.bump(r, 'notNeeded', {});
        expect(r.ne).toBe(2);
    });
    test('an older day without ne normalizes to 0 and keeps its version', () => {
        const old = rec();
        delete old.ne;
        old.v = 16;
        const n = DailyRecord.normalize(old);
        expect(n.v).toBe(16);
        expect(Number(n.ne) || 0).toBe(0);
    });
});

describe('Stats line', () => {
    test('shows the count, and nothing for zero or a missing value', () => {
        expect(StatsView.notNeededLineHtml(2)).toContain('Not needed: 2');
        expect(StatsView.notNeededLineHtml(0)).toBe('');
        expect(StatsView.notNeededLineHtml(undefined)).toBe('');
    });
});

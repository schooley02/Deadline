/**
 * DailyRecord v15 (Mood check-in Build A, 2026-11-13): `mood` = [[hour, level, feelingBits, contextBits], ...] and `moodHist`, the
 * month roll-up histogram. Added in the SAME session as the feature (docs/DAILY_RECORD_PLAN.md guardrail).
 */
const DailyRecord = require('../js/dailyRecord.js');
const Mood = require('../js/mood.js');

const rec = () => DailyRecord.fresh({ date: '2026-11-13', tz: 0 });

describe('v15 mood log', () => {
    test('a fresh record has no mood and a zero histogram; the version is 15', () => {
        expect(DailyRecord.V).toBe(15);
        expect(rec().mood).toEqual([]);
        expect(rec().moodHist).toEqual([0, 0, 0, 0, 0]);
    });
    test('the local mirrors match js/mood.js', () => {
        // A level / bits that are valid for Mood are accepted, the first invalid one is refused.
        const r = rec();
        DailyRecord.bump(r, 'mood', { hour: 1, level: 5, feelings: Mood.FEELING_MASK, context: Mood.CONTEXT_MASK });
        expect(r.mood).toEqual([[1, 5, Mood.FEELING_MASK, Mood.CONTEXT_MASK]]);
        DailyRecord.bump(r, 'mood', { hour: 2, level: 5, feelings: Mood.FEELING_MASK + 1, context: Mood.CONTEXT_MASK + 1 });
        expect(r.mood[1]).toEqual([2, 5, 0, 0]);
        DailyRecord.bump(r, 'mood', { hour: 3, level: Mood.LEVELS.length + 1 });
        expect(r.mood.length).toBe(2);
    });
    test('a check-in is logged with its hour (from `at` or `hour`)', () => {
        const r = rec();
        DailyRecord.bump(r, 'mood', { at: new Date(2026, 10, 13, 9, 30).getTime(), level: 4, feelings: 32, context: 1 });
        DailyRecord.bump(r, 'mood', { hour: 15, level: 2 });
        expect(r.mood).toEqual([[9, 4, 32, 1], [15, 2, 0, 0]]);
    });
    test('the same local hour replaces that hour; entries stay in hour order', () => {
        const r = rec();
        DailyRecord.bump(r, 'mood', { hour: 14, level: 3 });
        DailyRecord.bump(r, 'mood', { hour: 8, level: 5, feelings: 1 });
        DailyRecord.bump(r, 'mood', { hour: 14, level: 1 });
        expect(r.mood).toEqual([[8, 5, 1, 0], [14, 1, 0, 0]]);
    });
    test('junk payloads change nothing', () => {
        const r = rec();
        [undefined, null, {}, { level: 3 }, { hour: 9 }, { hour: 9, level: 0 }, { hour: 9, level: 6 }, { hour: 9, level: 'x' }, { hour: 30, level: 3 }]
            .forEach((p) => DailyRecord.bump(r, 'mood', p));
        expect(r.mood).toEqual([]);
    });
    test('a mood bump on an older record that has no `mood` still works', () => {
        const old = rec();
        delete old.mood;
        old.v = 14;
        DailyRecord.bump(old, 'mood', { hour: 7, level: 4 });
        expect(old.mood).toEqual([[7, 4, 0, 0]]);
    });
    test('the mood event touches nothing else', () => {
        const r = rec();
        const before = JSON.stringify(Object.assign({}, r, { mood: null }));
        DailyRecord.bump(r, 'mood', { hour: 9, level: 5, feelings: 3, context: 2 });
        expect(JSON.stringify(Object.assign({}, r, { mood: null }))).toBe(before);
    });
});

describe('v15 normalize + close', () => {
    test('an older record gets an empty mood, keeps its version', () => {
        const old = rec();
        delete old.mood; delete old.moodHist;
        old.v = 14;
        const n = DailyRecord.normalize(old);
        expect(n.mood).toEqual([]);
        expect(n.moodHist).toEqual([0, 0, 0, 0, 0]);
        expect(n.v).toBe(14);
    });
    test('a saved mood survives normalize and close; bad entries are dropped, one per hour', () => {
        const r = rec();
        r.mood = [[20, 2, 0, 0], [8, 4, 32, 1], [8, 3, 0, 0], 'x', [30, 3, 0, 0], [9, 9, 0, 0]];
        const n = DailyRecord.normalize(r);
        expect(n.mood).toEqual([[8, 3, 0, 0], [20, 2, 0, 0]]);
        expect(DailyRecord.close(n, {}).mood).toEqual([[8, 3, 0, 0], [20, 2, 0, 0]]);
    });
    test('sanitizeMood is exposed and tolerant', () => {
        expect(DailyRecord.sanitizeMood(null)).toEqual([]);
        expect(DailyRecord.sanitizeMood([[5, 3, 0, 0]])).toEqual([[5, 3, 0, 0]]);
    });
});

describe('v15 month roll-up keeps the histogram and drops the entries', () => {
    function dayWith(date, entries) {
        const r = DailyRecord.fresh({ date, tz: 0 });
        entries.forEach(([hour, level]) => DailyRecord.bump(r, 'mood', { hour, level }));
        return r;
    }
    test('days older than the retention fold into a month with a histogram', () => {
        let store = DailyRecord.emptyStore();
        store = DailyRecord.addDay(store, dayWith('2024-01-05', [[8, 5], [20, 2]]));
        store = DailyRecord.addDay(store, dayWith('2024-01-06', [[9, 5]]));
        store = DailyRecord.addDay(store, dayWith('2026-11-12', [[9, 4]]));
        const out = DailyRecord.rollUp(store, new Date(2026, 10, 13));
        const m = out.months['2024-01'];
        expect(m.moodHist).toEqual([0, 1, 0, 0, 2]);
        expect(m.mood).toEqual([]);
        expect(m.days).toBe(2);
        // a recent day is untouched
        expect(out.days['2026-11-12'].mood).toEqual([[9, 4, 0, 0]]);
    });
    test('a later roll-up adds into the month\'s existing histogram', () => {
        let store = DailyRecord.emptyStore();
        store = DailyRecord.addDay(store, dayWith('2024-01-05', [[8, 5]]));
        let out = DailyRecord.rollUp(store, new Date(2026, 10, 13));
        out = DailyRecord.addDay(out, dayWith('2024-01-20', [[8, 1], [9, 1]]));
        out = DailyRecord.rollUp(out, new Date(2026, 10, 13));
        expect(out.months['2024-01'].moodHist).toEqual([2, 0, 0, 0, 1]);
    });
    test('the histogram matches Mood.histogram for the same entries', () => {
        const r = dayWith('2024-03-01', [[7, 3], [12, 3], [18, 5]]);
        const out = DailyRecord.rollUp(DailyRecord.addDay(DailyRecord.emptyStore(), r), new Date(2026, 10, 13));
        expect(out.months['2024-03'].moodHist).toEqual(Mood.histogram(r.mood));
    });
});

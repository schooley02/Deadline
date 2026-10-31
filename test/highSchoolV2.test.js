/**
 * High school v2 (2026-10-31, Jeremy): each closed day banks every routine's hero star rating; the High school counter
 * is the sum over the run; a report card shows stars / % / honor roll / next step. Covers Heroes.bankedStars +
 * reportRows, DailyRecord v3 `stars`, State.closeDailyRecord's collaborator, and the report-card markup.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.DailyRecord = require('../js/dailyRecord.js');
global.DayRollover = require('../js/dayRollover.js');
global.Persistence = require('../js/persistence.js');
const HeroesView = require('../js/ui/heroes.js');
global.HeroesView = HeroesView;
const VillageCard = require('../js/ui/villageCard.js');
const State = require('../js/state.js');

const START = new Date(2026, 9, 1).getTime();

// A habit with `n` consecutive daily check-ins, `fail` of them misses (spread from the front).
function habit(id, routineId, n, fail) {
    const hist = [];
    for (let i = 0; i < n; i++) {
        hist.push({ date: '2026-10-' + String(i + 1).padStart(2, '0'), success: i >= (fail || 0) });
    }
    return { id, routineId, occurrenceHistory: hist };
}
const routine = (id, over) => Object.assign({ id, name: 'R' + id, isActive: true, frozenState: null, koState: null,
    habitDefinitionIds: [], taskDefinitionIds: [], createdAt: START }, over || {});

describe('Heroes.bankedStars', () => {
    test('banks each routine\'s current star rating, keyed by routine id as a string', () => {
        const rs = [routine(1), routine(2)];
        const hs = [habit('a', 1, 21, 0), habit('b', 2, 7, 1)]; // 21 clean days = 5 stars; 7 days at 86% = 3 stars
        expect(Heroes.bankedStars(rs, hs, CONFIG, START)).toEqual({ 1: 5, 2: 3 });
    });

    test('inactive, frozen and KO\'d routines bank 0; a routine with no record banks 0', () => {
        const hs = [habit('a', 1, 21, 0), habit('b', 2, 21, 0), habit('c', 3, 21, 0), habit('d', 4, 21, 0)];
        const rs = [routine(1, { isActive: false }), routine(2, { frozenState: { frozenBy: 'x' } }),
            routine(3, { koState: { koAt: 1 } }), routine(4), routine(5)];
        expect(Heroes.bankedStars(rs, hs, CONFIG, START)).toEqual({ 1: 0, 2: 0, 3: 0, 4: 5, 5: 0 });
    });

    test('routine tasks count (explicit task list)', () => {
        const rs = [routine(1, { taskDefinitionIds: ['t'] })];
        const tasks = [{ id: 't', occurrenceHistory: habit('x', 0, 14, 0).occurrenceHistory }];
        expect(Heroes.bankedStars(rs, [], CONFIG, START, tasks)).toEqual({ 1: 4 });
    });

    test('history before the run start is ignored', () => {
        const rs = [routine(1)];
        const hs = [habit('a', 1, 21, 0)];
        expect(Heroes.bankedStars(rs, hs, CONFIG, new Date(2026, 9, 21).getTime())).toEqual({ 1: 0 });
    });

    test('no routines -> {}', () => {
        expect(Heroes.bankedStars([], [], CONFIG, START)).toEqual({});
        expect(Heroes.bankedStars(null, null, CONFIG, START)).toEqual({});
    });
});

describe('Heroes.reportRows', () => {
    const row = (r, hs, tasks) => Heroes.reportRows([r], hs, CONFIG, START, tasks)[0];

    test('a rated routine: stars, %, samples, days, and the next step', () => {
        const r = row(routine(1), [habit('a', 1, 7, 1)]); // 6/7 = 86%, 7 days = 3 stars
        expect(r).toMatchObject({ id: 1, name: 'R1', stars: 3, ratePct: 86, samples: 7, distinctDays: 7, honorRoll: true, banks: true });
        expect(r.next).toBe('90% and 7 more days for 4 stars');
    });

    test('next step names only what is missing: rate, or days', () => {
        expect(row(routine(1), [habit('a', 1, 14, 3)]).next).toBe('80% for 3 stars'); // 79%, 14 days -> 2 stars; only the rate is missing for 3
        // 100% over 5 days: 2 stars (>=70%, >=4 days); 3 stars needs 7 days only
        const r = row(routine(1), [habit('a', 1, 5, 0)]);
        expect(r.stars).toBe(2);
        expect(r.next).toBe('2 more days for 3 stars');
        expect(row(routine(1), [habit('a', 1, 6, 0)]).next).toBe('1 more day for 3 stars');
    });

    test('honor roll starts at 3 stars (80% with >= 7 days) and not before', () => {
        expect(row(routine(1), [habit('a', 1, 10, 2)]).honorRoll).toBe(true);   // 80%, 10 days -> 3 stars
        expect(row(routine(1), [habit('a', 1, 10, 3)]).honorRoll).toBe(false);  // 70% -> 2 stars
        expect(row(routine(1), [habit('a', 1, 6, 0)]).honorRoll).toBe(false);   // 100% but only 6 days -> 2 stars
    });

    test('top rating has no next step; an unrated routine is told to finish check-ins', () => {
        expect(row(routine(1), [habit('a', 1, 21, 0)])).toMatchObject({ stars: 5, next: null });
        const fresh = row(routine(1), []);
        expect(fresh).toMatchObject({ stars: 0, ratePct: null, samples: 0, next: 'Finish a few check-ins to get rated.' });
    });

    test('a routine that is off / frozen / KO\'d is flagged as not banking', () => {
        expect(row(routine(1, { isActive: false }), []).banks).toBe(false);
        expect(row(routine(1, { frozenState: {} }), []).banks).toBe(false);
        expect(row(routine(1), []).banks).toBe(true);
    });

    test('tasks feed the rows too', () => {
        const rs = routine(1, { taskDefinitionIds: ['t'] });
        const r = row(rs, [], [{ id: 't', occurrenceHistory: habit('x', 0, 7, 0).occurrenceHistory }]);
        expect(r).toMatchObject({ stars: 3, ratePct: 100, samples: 7 });
    });
});

describe('DailyRecord v3 stars', () => {
    test('close() banks the supplied stars (sanitised); a second close keeps them', () => {
        const rec = DailyRecord.fresh({ date: '2026-10-30', run: 1 });
        const closed = DailyRecord.close(rec, { stars: { 7: 3, 8: 9, 9: 'x', 10: -2 } });
        expect(closed.stars).toEqual({ 7: 3, 8: 5, 10: 0 });
        expect(DailyRecord.starsTotal(closed)).toBe(8);
        expect(DailyRecord.close(closed, {}).stars).toEqual({ 7: 3, 8: 5, 10: 0 });
    });

    test('an older record (no stars) normalises to {} and totals 0', () => {
        const old = DailyRecord.fresh({ date: '2026-10-01', run: 1 });
        delete old.stars;
        old.v = 2;
        expect(DailyRecord.normalize(old).stars).toEqual({});
        expect(DailyRecord.starsTotal(old)).toBe(0);
        expect(DailyRecord.starsTotal(null)).toBe(0);
    });

    test('a record with no stars passed in the context closes with none banked', () => {
        const closed = DailyRecord.close(DailyRecord.fresh({ date: '2026-10-30', run: 1 }), {});
        expect(closed.stars).toEqual({});
    });
});

describe('State.closeDailyRecord banks the routines\' stars', () => {
    let store;
    beforeAll(() => { global.window = { definedTasks: [] }; });
    afterAll(() => { delete global.window; });
    beforeEach(() => {
        store = {};
        global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
        State.setRunHistory([]);
        State.setDefinedHabits([]);
        State.setDefinedRoutines([]);
        State.setActiveItems([]);
        State.setCompletedItems([]);
        State.setToday(DailyRecord.fresh({ date: '2026-10-26', tz: -300 }));
    });
    afterEach(() => { delete global.localStorage; });
    const NEXT_DAY = () => new Date(2026, 9, 27, 0, 5);

    test('uses deps.routineStarsNow at close', () => {
        State.closeDailyRecord(NEXT_DAY(), { routineStarsNow: () => ({ 1: 4, 2: 2 }) });
        const day = JSON.parse(store['deadline.days']).days['2026-10-26'];
        expect(day.stars).toEqual({ 1: 4, 2: 2 });
        expect(day.v).toBe(3);
    });

    test('no collaborator (tests, older callers) or a throwing one still closes the day, with nothing banked', () => {
        State.closeDailyRecord(NEXT_DAY());
        expect(JSON.parse(store['deadline.days']).days['2026-10-26'].stars).toEqual({});
        State.setToday(DailyRecord.fresh({ date: '2026-10-27', tz: -300 }));
        const err = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(State.closeDailyRecord(new Date(2026, 9, 28, 0, 5), { routineStarsNow: () => { throw new Error('boom'); } })).toBe(true);
        expect(JSON.parse(store['deadline.days']).days['2026-10-27'].stars).toEqual({});
        err.mockRestore();
    });
});

describe('report card markup', () => {
    const rowA = { id: 1, name: 'Morning <b>', stars: 3, ratePct: 86, samples: 7, distinctDays: 7, honorRoll: true, banks: true, next: '90% for 4 stars' };
    const rowB = { id: 2, name: 'Evening', stars: 5, ratePct: 100, samples: 28, distinctDays: 28, honorRoll: true, banks: true, next: null };
    const rowC = { id: 3, name: 'Walks', stars: 0, ratePct: null, samples: 0, distinctDays: 0, honorRoll: false, banks: false, next: 'Finish a few check-ins to get rated.' };

    test('reportRowHtml: name escaped, honor roll mark, stars, detail, next step', () => {
        const html = HeroesView.reportRowHtml(rowA, false);
        expect(html).toContain('Morning &lt;b&gt;');
        expect(html).not.toContain('<b>');
        expect(html).toContain('Honor roll');
        expect(html).toContain('★★★☆☆');
        expect(html).toContain('86% of your last 7 check-ins · 7 days tracked');
        expect(html).toContain('Next: 90% for 4 stars');
    });

    test('compact drops the name; top rating and not-rated/paused rows read right', () => {
        expect(HeroesView.reportRowHtml(rowA, true)).not.toContain('rc-name');
        expect(HeroesView.reportRowHtml(rowB, false)).toContain('Top rating');
        const c = HeroesView.reportRowHtml(rowC, false);
        expect(c).toContain('Not rated yet');
        expect(c).not.toContain('Honor roll');
        expect(c).toContain('Not earning stars');
    });

    test('reportCardHtml sorts by stars (best first) and is empty with no routines', () => {
        const html = HeroesView.reportCardHtml([rowC, rowA, rowB]);
        expect(html.indexOf('Evening')).toBeLessThan(html.indexOf('Morning'));
        expect(html.indexOf('Morning')).toBeLessThan(html.indexOf('Walks'));
        expect(HeroesView.reportCardHtml([])).toBe('');
        expect(HeroesView.reportCardHtml(null)).toBe('');
    });

    test('the High school card shows the report card; other buildings do not', () => {
        const progress = { tier: 1, value: 0, nextAt: 10, fraction: 0, toNext: 10 };
        const school = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'heroes', progress, hasRoutine: true, reportRows: [rowA, rowB] }));
        expect(school).toContain('Report card');
        expect(school).toContain('Evening');
        expect(school).toContain('Hero stars banked');
        const other = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'nights', progress, reportRows: [rowA] }));
        expect(other).not.toContain('Report card');
    });
});

/**
 * State's daily-record accumulator plumbing (D2, 2026-10-27;
 * docs/DAILY_RECORD_PLAN.md): ensureToday seeds with the REAL local date,
 * bumpToday is the single never-throwing seam entry, and the record rides in
 * getPersistableState() as `today` (schema 15).
 */
global.DailyRecord = require('../js/dailyRecord.js');
global.DayRollover = require('../js/dayRollover.js');
global.Persistence = require('../js/persistence.js');
const State = require('../js/state.js');

// getPersistableState reads window.definedTasks (a browser global).
beforeAll(() => { global.window = { definedTasks: [] }; });
afterAll(() => { delete global.window; });
beforeEach(() => { State.setToday(null); State.setRunHistory([]); });

describe('ensureToday', () => {
    test('seeds a fresh record dated by the real local day, run = history + 1', () => {
        State.setRunHistory([{}, {}]);
        const now = new Date(2026, 9, 27, 22, 15);
        const rec = State.ensureToday(now);
        expect(rec.date).toBe('2026-10-27');
        expect(rec.run).toBe(3);
        expect(State.getToday()).toBe(rec);
    });

    test('returns the same record on later calls (never reseeds)', () => {
        const a = State.ensureToday(new Date(2026, 9, 27));
        const b = State.ensureToday(new Date(2026, 9, 28));
        expect(b).toBe(a);
        expect(b.date).toBe('2026-10-27');
    });
});

describe('bumpToday', () => {
    test('creates the record on demand and applies the event', () => {
        State.bumpToday('complete', { kind: 'task', category: 'health', hour: 9, points: 5 });
        const rec = State.getToday();
        expect(rec.done.task).toBe(1);
        expect(rec.hoursDone[9]).toBe(1);
        expect(rec.pts.earned).toBe(5);
    });

    test('never throws, even on bad input', () => {
        expect(() => State.bumpToday('complete')).not.toThrow();
        expect(() => State.bumpToday(undefined, null)).not.toThrow();
    });
});

describe('persistence of today', () => {
    test('getPersistableState carries `today` (null until first use)', () => {
        expect(State.getPersistableState({}).today).toBeNull();
        State.bumpToday('touch', { hour: 8 });
        expect(State.getPersistableState({}).today.active.touches).toBe(1);
    });
});

describe('bumpToday: undo of a closed day\'s completion', () => {
    test('an uncomplete whose completion was on another day is skipped', () => {
        State.ensureToday(new Date(2026, 9, 27, 12));
        State.bumpToday('complete', { kind: 'task', category: 'health', at: new Date(2026, 9, 27, 9).getTime() });
        // completed yesterday, undone today -> must not decrement today's count
        State.bumpToday('uncomplete', { kind: 'task', category: 'health', at: new Date(2026, 9, 26, 9).getTime() });
        expect(State.getToday().done.task).toBe(1);
        // completed today, undone today -> reverses
        State.bumpToday('uncomplete', { kind: 'task', category: 'health', at: new Date(2026, 9, 27, 9).getTime() });
        expect(State.getToday().done.task).toBe(0);
    });
});


describe('closeDailyRecord (rollover close)', () => {
    let store;
    beforeEach(() => {
        store = {};
        global.localStorage = {
            getItem: k => (k in store ? store[k] : null),
            setItem: () => {},
            removeItem: k => { delete store[k]; },
        };
        global.localStorage.setItem = (k, v) => { store[k] = String(v); };
        State.setPlayerLevel(4);
        State.setPlayerPoints(310);
        State.setBaseHealth(86);
        State.setDefinedHabits([
            { id: 'h1', streak: 3 }, { id: 'h2', streak: 9 }, { id: 'h3', streak: 20, archivedAt: 1 },
        ]);
        State.setDefinedRoutines([{ id: 'r1' }, { id: 'r2' }]);
        State.setActiveItems([]);
        State.setCompletedItems([]);
    });
    afterEach(() => { delete global.localStorage; });

    function openYesterday() {
        const rec = DailyRecord.fresh({ date: '2026-10-26', tz: -300 });
        DailyRecord.bump(rec, 'complete', { kind: 'habit', category: 'health', hour: 7, points: 10 });
        DailyRecord.bump(rec, 'overdue', { kind: 'habit', category: 'health', hour: 20 });
        State.setToday(rec);
        return rec;
    }

    test('writes the closed day once into deadline.days and seeds a fresh record', () => {
        openYesterday();
        const closed = State.closeDailyRecord(new Date(2026, 9, 27, 0, 5));
        expect(closed).toBe(true);
        const saved = JSON.parse(store['deadline.days']);
        const day = saved.days['2026-10-26'];
        expect(day.done.habit).toBe(1);
        expect(day.lvl).toBe(4);
        expect(day.pts.end).toBe(310);
        expect(day.base.endHp).toBe(86);
        expect(day.load).toEqual({ habits: 2, routines: 2, tasksDue: 0 }); // archived habit not counted
        expect(day.due.habit).toBe(2); // done + missed
        expect(day.streak.best).toBe(9); // archived h3 ignored
        const fresh = State.getToday();
        expect(fresh.date).toBe('2026-10-27');
        expect(fresh.done.habit).toBe(0);
    });

    test('counts tasks due on the closing day (not sub-tasks)', () => {
        openYesterday();
        const due = new Date(2026, 9, 26, 15);
        State.setActiveItems([
            { id: 1, type: 'task', dueDateTime: due },
            { id: 2, type: 'task', parentId: 1, dueDateTime: due },
            { id: 3, type: 'task', dueDateTime: new Date(2026, 9, 28, 9) },
        ]);
        State.setCompletedItems([{ id: 4, type: 'task', dueDateTime: due }]);
        State.closeDailyRecord(new Date(2026, 9, 27, 0, 5));
        const day = JSON.parse(store['deadline.days']).days['2026-10-26'];
        expect(day.due.task).toBe(2);
        expect(day.load.tasksDue).toBe(2);
    });

    test('does nothing when the open record is already today', () => {
        State.setToday(DailyRecord.fresh({ date: '2026-10-27' }));
        expect(State.closeDailyRecord(new Date(2026, 9, 27, 8))).toBe(false);
        expect(store['deadline.days']).toBeUndefined();
    });

    test('a multi-day gap closes only the day that was open', () => {
        openYesterday();
        State.closeDailyRecord(new Date(2026, 9, 31, 9));
        const saved = JSON.parse(store['deadline.days']);
        expect(Object.keys(saved.days)).toEqual(['2026-10-26']);
        expect(State.getToday().date).toBe('2026-10-31');
    });

    test('merges into an existing store and keeps earlier days', () => {
        store['deadline.days'] = JSON.stringify({ v: 1, days: { '2026-10-25': { v: 1, date: '2026-10-25' } }, months: {} });
        openYesterday();
        State.closeDailyRecord(new Date(2026, 9, 27, 0, 5));
        expect(Object.keys(JSON.parse(store['deadline.days']).days).sort()).toEqual(['2026-10-25', '2026-10-26']);
    });

    test('keeps the open record when the days store cannot be written', () => {
        const rec = openYesterday();
        global.localStorage.setItem = () => { throw new Error('quota'); };
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(State.closeDailyRecord(new Date(2026, 9, 27, 0, 5))).toBe(false);
        spy.mockRestore();
        expect(State.getToday()).toBe(rec);
    });

    test('performDayRollover closes the day through the shared rollover fork', () => {
        openYesterday();
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        yesterdayDate.setHours(0, 0, 0, 0);
        // pin the record to the real "yesterday" so the real clock rolls it
        State.getToday().date = DailyRecord.dateKey(yesterdayDate);
        let gameDate = yesterdayDate;
        const rolled = State.performDayRollover({
            getCurrentGameDate: () => gameDate,
            setCurrentGameDate: d => { gameDate = d; },
            getActiveItems: () => [],
            isCheatDayExcusedForItem: () => false,
        }, new Date());
        expect(rolled).toBe(true);
        expect(JSON.parse(store['deadline.days']).days[DailyRecord.dateKey(yesterdayDate)]).toBeDefined();
        expect(State.getToday().date).toBe(DailyRecord.dateKey(new Date()));
    });
});

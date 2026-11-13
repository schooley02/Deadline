/**
 * Momentum Build A (2026-11-11; docs/MOMENTUM_PLAN.md, DECISIONS 2026-11-11 (momentum)): the defended-night rule and the Nights Survived
 * count built on it, the grandfathering of a run already in progress, and the DailyRecord v14 `pri.q` that feeds the rule.
 * Pure core only; the seams (Items, State, script.js) are in test/momentumWiring.test.js.
 */
const Momentum = require('../js/momentum.js');
const DailyRecord = require('../js/dailyRecord.js');
const CONFIG = require('../js/config.js');

const NOON = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0, 0).getTime();

/** A closed day: { date, run } plus any overrides. v14 unless `v` is given. */
function day(date, over) {
    return Object.assign(DailyRecord.fresh({ date, run: 1 }), over || {});
}
const withPri = (date, q, over) => day(date, Object.assign({ pri: { m: q, d: q, s: 0, q } }, over || {}));
const withAtt = (date, perfect, active, over) => day(date, Object.assign({ att: { active: active == null ? perfect : active, perfect } }, over || {}));
const store = (...recs) => { const days = {}; recs.forEach((r) => { days[r.date] = r; }); return days; };

describe('the dial', () => {
    test('a priority must be 10 minutes old to defend a night (the same 10 minutes as the pushback grace)', () => {
        expect(CONFIG.MOMENTUM.MIN_PRIORITY_AGE_MS).toBe(10 * 60 * 1000);
        expect(Momentum.DEFAULT_MIN_PRIORITY_AGE_MS).toBe(CONFIG.MOMENTUM.MIN_PRIORITY_AGE_MS);
        expect(CONFIG.MOMENTUM.MIN_PRIORITY_AGE_MS).toBe(CONFIG.RESCHEDULE_GRACE_MS);
    });
});

describe('isDefended', () => {
    test('an empty day is not defended', () => {
        expect(Momentum.isDefended(day('2026-11-02'))).toBe(false);
        expect(Momentum.isDefended(null)).toBe(false);
        expect(Momentum.isDefended(undefined)).toBe(false);
        expect(Momentum.isDefended('x')).toBe(false);
    });
    test('one aged priority finish defends the day (v14: pri.q)', () => {
        expect(Momentum.isDefended(withPri('2026-11-02', 1))).toBe(true);
        expect(Momentum.isDefended(withPri('2026-11-02', 3))).toBe(true);
    });
    test('priorities that finished but were too fresh (pri.d > 0, pri.q = 0) do NOT defend a v14 day', () => {
        const r = day('2026-11-02', { pri: { m: 3, d: 3, s: 1, q: 0 } });
        expect(r.v).toBe(DailyRecord.V);
        expect(Momentum.isDefended(r)).toBe(false);
    });
    test('a day recorded before v14 has no pri.q, so it reads pri.d', () => {
        const old = day('2026-10-20', { v: 13, pri: { m: 1, d: 1, s: 0 } });
        expect(Momentum.isDefended(old)).toBe(true);
        const oldEmpty = day('2026-10-20', { v: 13, pri: { m: 1, d: 0, s: 0 } });
        expect(Momentum.isDefended(oldEmpty)).toBe(false);
    });
    test('one routine fully completed defends the day (closed: att.perfect)', () => {
        expect(Momentum.isDefended(withAtt('2026-11-02', 1))).toBe(true);
    });
    test('a routine with activity that was NOT fully completed does not (active 2, perfect 0)', () => {
        expect(Momentum.isDefended(withAtt('2026-11-02', 0, 2))).toBe(false);
    });
    test('the open day reads the routine tally: [done, missed, lateDone] per routine', () => {
        const perfect = day('2026-11-02', { rt: { a: [2, 0, 0] } });
        expect(Momentum.isDefended(perfect)).toBe(true);
        const lateButDone = day('2026-11-02', { rt: { a: [3, 1, 1] } }); // one went overdue, then was finished: still perfect
        expect(Momentum.isDefended(lateButDone)).toBe(true);
        const missed = day('2026-11-02', { rt: { a: [1, 2, 0] } });
        expect(Momentum.isDefended(missed)).toBe(false);
        const idle = day('2026-11-02', { rt: { a: [0, 0, 0] } });
        expect(Momentum.isDefended(idle)).toBe(false);
    });
    test('either path is enough, and both together are still one defended night', () => {
        expect(Momentum.isDefended(withPri('2026-11-02', 2, { att: { active: 1, perfect: 1 } }))).toBe(true);
    });
    test('habits, sub-tasks and plain tasks alone do not defend a night', () => {
        const r = day('2026-11-02', { done: { task: 6, subtask: 4, habit: 8, late: 0 } });
        expect(Momentum.isDefended(r)).toBe(false);
    });
    test('the tally test agrees with DailyRecord.attendanceFromTally on a spread of shapes', () => {
        const shapes = [
            {}, { a: [0, 0, 0] }, { a: [1, 0, 0] }, { a: [1, 1, 0] }, { a: [1, 1, 1] }, { a: [2, 3, 3] }, { a: [0, 2, 2] },
            { a: [2, 0, 0], b: [1, 1, 0] }, { a: [2, 0, 0], b: [1, 1, 1], c: [0, 0, 0] },
        ];
        shapes.forEach((rt) => {
            const expected = DailyRecord.attendanceFromTally(rt).perfect;
            expect(Momentum.perfectRoutines({ rt })).toBe(rt && Object.keys(rt).length ? expected : 0);
        });
    });
});

describe('isExcused (a Sick Day)', () => {
    test('a Sick Day on a day nothing defended excuses it', () => {
        expect(Momentum.isExcused(day('2026-11-02', { tokens: { cheat: 0, sick: 1, skip: 0, pushback: 0, kit: 0 } }))).toBe(true);
    });
    test('no Sick Day, or a defended day, is not "excused"', () => {
        expect(Momentum.isExcused(day('2026-11-02'))).toBe(false);
        expect(Momentum.isExcused(withPri('2026-11-02', 1, { tokens: { cheat: 0, sick: 1, skip: 0, pushback: 0, kit: 0 } }))).toBe(false);
        expect(Momentum.isExcused(null)).toBe(false);
    });
    test('a Skip Day or a Cheat Day does not excuse the night (they cover one habit, not the day)', () => {
        expect(Momentum.isExcused(day('2026-11-02', { tokens: { cheat: 1, sick: 0, skip: 1, pushback: 0, kit: 0 } }))).toBe(false);
    });
});

describe('priorityQualifies', () => {
    const t0 = NOON(2026, 11, 2);
    const MIN = 10 * 60 * 1000;
    test('old enough counts, too fresh does not', () => {
        expect(Momentum.priorityQualifies(new Date(t0), t0 + MIN, MIN)).toBe(true);
        expect(Momentum.priorityQualifies(new Date(t0), t0 + MIN - 1, MIN)).toBe(false);
        expect(Momentum.priorityQualifies(new Date(t0), t0 + 60 * 1000, MIN)).toBe(false);
        expect(Momentum.priorityQualifies(new Date(t0), t0 + 3 * 60 * 60 * 1000, MIN)).toBe(true);
    });
    test('a creation time may be a Date, an ISO string (a restored save) or ms', () => {
        expect(Momentum.priorityQualifies(new Date(t0).toISOString(), t0 + 1000, MIN)).toBe(false);
        expect(Momentum.priorityQualifies(new Date(t0).toISOString(), t0 + MIN, MIN)).toBe(true);
        expect(Momentum.priorityQualifies(t0, t0 + MIN, MIN)).toBe(true);
    });
    test('no creation time (an older save) or bad input counts: there is nothing to measure', () => {
        expect(Momentum.priorityQualifies(undefined, t0, MIN)).toBe(true);
        expect(Momentum.priorityQualifies(null, t0, MIN)).toBe(true);
        expect(Momentum.priorityQualifies('garbage', t0, MIN)).toBe(true);
        expect(Momentum.priorityQualifies(new Date(t0), NaN, MIN)).toBe(true);
    });
    test('a missing minimum falls back to 10 minutes', () => {
        expect(Momentum.priorityQualifies(new Date(t0), t0 + 9 * 60 * 1000)).toBe(false);
        expect(Momentum.priorityQualifies(new Date(t0), t0 + 10 * 60 * 1000)).toBe(true);
    });
});

describe('calendarNights (the pre-Momentum count)', () => {
    test('one night per local midnight crossed; a run started at 11 PM counts 1 at midnight', () => {
        const start = new Date(2026, 10, 2, 23, 0).getTime();
        expect(Momentum.calendarNights(start, new Date(2026, 10, 2, 23, 59).getTime())).toBe(0);
        expect(Momentum.calendarNights(start, new Date(2026, 10, 3, 0, 1).getTime())).toBe(1);
        expect(Momentum.calendarNights(start, new Date(2026, 10, 12, 8, 0).getTime())).toBe(10);
    });
    test('bad input, or a start after now, is 0', () => {
        expect(Momentum.calendarNights(null, Date.now())).toBe(0);
        expect(Momentum.calendarNights(Date.now(), NaN)).toBe(0);
        expect(Momentum.calendarNights(NOON(2026, 11, 5), NOON(2026, 11, 2))).toBe(0);
    });
    test('matches the moon and Damage.computeDaysSurvived (the three counters used to be one rule)', () => {
        const NightsSurvivedView = require('../js/ui/nightsSurvivedView.js');
        const start = new Date(2026, 2, 7, 22, 30).getTime(); // across the March DST change
        [new Date(2026, 2, 8, 9, 0), new Date(2026, 2, 9, 0, 5), new Date(2026, 5, 1, 12, 0)].forEach((n) => {
            expect(Momentum.calendarNights(start, n.getTime())).toBe(NightsSurvivedView.countMidnights(start, n.getTime()));
        });
    });
});

describe('nights: only defended nights count', () => {
    const start = NOON(2026, 11, 2); // a Monday, run 1
    const now = (d) => NOON(2026, 11, d);
    const ctx = (days, over) => Object.assign({ runStartMs: start, nowMs: now(10), days, runNumber: 1 }, over || {});

    test('a run with no records has survived no nights (an empty or untouched schedule earns nothing)', () => {
        expect(Momentum.nights(ctx({}))).toBe(0);
        expect(Momentum.nights(ctx(null))).toBe(0);
        expect(Momentum.nights(ctx(undefined))).toBe(0);
    });
    test('every defended closed day adds one; an undefended one adds none', () => {
        const days = store(withPri('2026-11-02', 1), day('2026-11-03'), withAtt('2026-11-04', 1), withPri('2026-11-05', 2), day('2026-11-06'));
        expect(Momentum.nights(ctx(days))).toBe(3);
    });
    test('the open day is never counted, even when it is already defended (a night counts at its midnight)', () => {
        const days = store(withPri('2026-11-02', 1), withPri('2026-11-10', 1)); // 2026-11-10 is "today"
        expect(Momentum.nights(ctx(days))).toBe(1);
    });
    test('a record dated after now is ignored (a clock set back)', () => {
        const days = store(withPri('2026-11-02', 1), withPri('2026-11-20', 1));
        expect(Momentum.nights(ctx(days))).toBe(1);
    });
    test('days of another run never count', () => {
        const days = store(withPri('2026-11-02', 1), Object.assign(withPri('2026-11-03', 1), { run: 2 }), Object.assign(withPri('2026-11-04', 1), { run: 0 }));
        expect(Momentum.nights(ctx(days))).toBe(1);
        expect(Momentum.nights(ctx(days, { runNumber: 2 }))).toBe(1);
    });
    test('days away add nothing: a week with no records is a week of no nights', () => {
        const days = store(withPri('2026-11-02', 1), withPri('2026-11-03', 1)); // then nothing until the 10th
        expect(Momentum.nights(ctx(days))).toBe(2);
        expect(Momentum.nights(ctx(days, { nowMs: now(30) }))).toBe(2);
    });
    test('a store, a days map and an array of records all work', () => {
        const map = store(withPri('2026-11-02', 1), withAtt('2026-11-03', 1));
        expect(Momentum.nights(ctx(map))).toBe(2);
        expect(Momentum.nights(ctx({ v: 1, days: map, months: {} }))).toBe(2);
        expect(Momentum.nights(ctx(Object.keys(map).map((k) => map[k])))).toBe(2);
    });
    test('junk records are skipped, never thrown on', () => {
        const days = { a: null, b: 5, c: { date: 'nope', run: 1 }, d: withPri('2026-11-02', 1) };
        expect(Momentum.nights(ctx(days))).toBe(1);
    });
    test('bad run start or now is 0', () => {
        expect(Momentum.nights({ runStartMs: null, nowMs: Date.now(), days: {}, runNumber: 1 })).toBe(0);
        expect(Momentum.nights({ runStartMs: Date.now(), nowMs: NaN, days: {}, runNumber: 1 })).toBe(0);
        expect(Momentum.nights()).toBe(0);
    });
    test('priorities that were too fresh to count (pri.q 0) earn no night', () => {
        const days = store(day('2026-11-02', { pri: { m: 3, d: 3, s: 1, q: 0 } }), withPri('2026-11-03', 1));
        expect(Momentum.nights(ctx(days))).toBe(1);
    });
});

describe('nights: grandfathering a run already in progress (fromDay)', () => {
    // A run started Nov 2. The rule started on this save on Nov 8. Nights before Nov 8 are kept as the calendar counted them.
    const start = NOON(2026, 11, 2);
    const now = (d) => NOON(2026, 11, d);
    const base = (days, nowDay, fromDay, over) => Momentum.nights(Object.assign({ runStartMs: start, nowMs: now(nowDay), days, runNumber: 1, fromDay }, over || {}));

    test('on the day the rule starts the run keeps the nights it had (6 midnights: Nov 3..8)', () => {
        expect(base({}, 8, '2026-11-08')).toBe(6);
    });
    test('the nights before the rule are kept even though those days have no defended records', () => {
        expect(base({}, 20, '2026-11-08')).toBe(6); // nothing defended since: the count stops at what it had
    });
    test('defended days from the start day on are added to what was kept', () => {
        const days = store(withPri('2026-11-08', 1), withPri('2026-11-09', 1), day('2026-11-10'), withAtt('2026-11-11', 1));
        expect(base(days, 12, '2026-11-08')).toBe(6 + 3);
    });
    test('records from before the start day are NOT counted a second time', () => {
        const days = store(withPri('2026-11-03', 1), withPri('2026-11-04', 1), withPri('2026-11-08', 1));
        expect(base(days, 10, '2026-11-08')).toBe(6 + 1);
    });
    test('the start day itself is judged like any other (its night counts at its midnight if defended)', () => {
        expect(base(store(day('2026-11-08')), 9, '2026-11-08')).toBe(6);
        expect(base(store(withPri('2026-11-08', 1)), 9, '2026-11-08')).toBe(7);
    });
    test('the count never goes down when the rule starts, and never jumps (same number just before and just after)', () => {
        const before = Momentum.calendarNights(start, now(8));
        expect(base({}, 8, '2026-11-08')).toBe(before);
    });
    test('a run that starts on or after the start day is judged from its first day (the old nights are not carried in)', () => {
        const newStart = NOON(2026, 11, 9);
        const days = store(Object.assign(withPri('2026-11-09', 1), { run: 2 }), Object.assign(day('2026-11-10'), { run: 2 }));
        expect(Momentum.nights({ runStartMs: newStart, nowMs: NOON(2026, 11, 12), days, runNumber: 2, fromDay: '2026-11-08' })).toBe(1);
        expect(Momentum.nights({ runStartMs: NOON(2026, 11, 8), nowMs: NOON(2026, 11, 12), days: {}, runNumber: 2, fromDay: '2026-11-08' })).toBe(0);
    });
    test('no fromDay (null, a game that started under the rule) judges the whole run', () => {
        const days = store(withPri('2026-11-02', 1), day('2026-11-03'), withPri('2026-11-04', 1));
        expect(base(days, 10, null)).toBe(2);
        expect(base(days, 10, undefined)).toBe(2);
        expect(base(days, 10, 'garbage')).toBe(2);
    });
    test('a start day in the future (the clock went back) keeps only the nights that have really passed', () => {
        expect(base({}, 5, '2026-11-20')).toBe(3);
    });
    test('the lifetime bank stays whole: nights of the run in progress + the old nights simply add up', () => {
        const days = store(withPri('2026-11-08', 1));
        expect(base(days, 9, '2026-11-08')).toBe(7);
    });
});

describe('DailyRecord v14: pri.q', () => {
    const rec = () => DailyRecord.fresh({ date: '2026-11-02', tz: 0 });

    test('the version is 15 and a fresh record carries pri { m, d, s, q }', () => {
        expect(DailyRecord.V).toBe(15);
        expect(rec().v).toBe(15);
        expect(rec().pri).toEqual({ m: 0, d: 0, s: 0, q: 0 });
    });
    test('a priority completion that is old enough bumps d AND q; an undo takes both back', () => {
        const r = rec();
        DailyRecord.bump(r, 'complete', { kind: 'task', category: 'other', hour: 9, pri: true, priQ: true });
        expect(r.pri.d).toBe(1);
        expect(r.pri.q).toBe(1);
        DailyRecord.bump(r, 'uncomplete', { kind: 'task', category: 'other', hour: 9, pri: true, priQ: true });
        expect(r.pri.d).toBe(0);
        expect(r.pri.q).toBe(0);
    });
    test('a priority completion that was too fresh bumps d (the Command Post) but not q', () => {
        const r = rec();
        DailyRecord.bump(r, 'complete', { kind: 'task', category: 'other', hour: 9, pri: true, priQ: false });
        expect(r.pri.d).toBe(1);
        expect(r.pri.q).toBe(0);
        DailyRecord.bump(r, 'uncomplete', { kind: 'task', category: 'other', hour: 9, pri: true, priQ: false });
        expect(r.pri).toMatchObject({ d: 0, q: 0 });
    });
    test('priQ without pri changes nothing, and an undo floors at 0', () => {
        const r = rec();
        DailyRecord.bump(r, 'complete', { kind: 'task', category: 'other', hour: 9, priQ: true });
        expect(r.pri).toMatchObject({ d: 0, q: 0 });
        DailyRecord.bump(r, 'uncomplete', { kind: 'task', category: 'other', hour: 9, pri: true, priQ: true });
        expect(r.pri).toMatchObject({ d: 0, q: 0 });
    });
    test('an older record (no pri.q) normalises to q 0 and keeps its own version', () => {
        const old = rec();
        old.v = 13;
        old.pri = { m: 2, d: 2, s: 0 };
        const n = DailyRecord.normalize(old);
        expect(n.pri).toEqual({ m: 2, d: 2, s: 0, q: 0 });
        expect(n.v).toBe(13);
        expect(Momentum.isDefended(n)).toBe(true); // v13 reads pri.d
    });
    test('close keeps q, and a day closed under v14 with q 0 stays undefended', () => {
        const r = rec();
        r.pri = { m: 3, d: 3, s: 0, q: 2 };
        expect(DailyRecord.close(r, {}).pri).toEqual({ m: 3, d: 3, s: 1, q: 2 });
        const fresh = rec();
        fresh.pri = { m: 3, d: 3, s: 0, q: 0 };
        expect(Momentum.isDefended(DailyRecord.close(fresh, {}))).toBe(false);
    });
    test('the open-day tally closes into att, and the closed day reads as defended', () => {
        const r = rec();
        DailyRecord.bump(r, 'complete', { kind: 'habit', category: 'health', hour: 7, routineId: 'r1' });
        DailyRecord.bump(r, 'complete', { kind: 'task', category: 'health', hour: 8, routineId: 'r1' });
        expect(Momentum.isDefended(r)).toBe(true); // open: from the tally
        const closed = DailyRecord.close(r, {});
        expect(closed.rt).toEqual({});
        expect(Momentum.isDefended(closed)).toBe(true); // closed: from att.perfect
    });
    test('the month roll-up sums pri.q', () => {
        let s = DailyRecord.emptyStore();
        const a = DailyRecord.fresh({ date: '2024-01-03', tz: 0 });
        a.pri = { m: 2, d: 2, s: 0, q: 1 };
        const b = DailyRecord.fresh({ date: '2024-01-04', tz: 0 });
        b.pri = { m: 3, d: 3, s: 1, q: 3 };
        s = DailyRecord.addDay(DailyRecord.addDay(s, DailyRecord.close(a, {})), DailyRecord.close(b, {}));
        const rolled = DailyRecord.rollUp(s, new Date(2026, 10, 2));
        expect(rolled.months['2024-01'].pri.q).toBe(4);
    });
    test('a Sick Day is already on the record (tokens.sick), so no new field is needed to excuse a night', () => {
        const r = rec();
        DailyRecord.bump(r, 'token', { kind: 'sick' });
        expect(r.tokens.sick).toBe(1);
        expect(Momentum.isExcused(r)).toBe(true);
    });
});

describe('momentum(): defended nights among the last 7 (Build B, 2026-11-11)', () => {
    const NOW = NOON(2026, 11, 11);
    const START = NOON(2026, 10, 1);
    const run = (days, todayRec, extra) => Momentum.momentum(Object.assign({ nowMs: NOW, runStartMs: START, runNumber: 1, days, todayRec }, extra || {}));
    const defended = (dates) => store(...dates.map((d) => withPri(d, 1)));
    const pending = () => day('2026-11-11');
    const secured = () => withPri('2026-11-11', 1);

    test('counts the last 7 closed nights while today is pending; a pending today never lowers it', () => {
        const days = defended(['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10']);
        const m = run(days, pending());
        expect(m.count).toBe(7);
        expect(m.state.id).toBe('reinforced');
        expect(m.today).toBe('pending');
        expect(m.nights).toHaveLength(7);
    });
    test('securing today counts immediately and the window slides one night', () => {
        const days = defended(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10']);
        expect(run(days, pending()).count).toBe(6);
        const m = run(days, secured());
        expect(m.today).toBe('secured');
        expect(m.count).toBe(7);
        expect(m.nights[m.nights.length - 1]).toEqual({ date: '2026-11-11', status: 'defended' });
    });
    test('a day with no record (the app was not opened) is missed, so momentum slides while away', () => {
        const m = run(defended(['2026-11-10', '2026-11-09']), pending());
        expect(m.count).toBe(2);
        expect(m.state.id).toBe('none');
        expect(m.nights.filter((n) => n.status === 'missed').length).toBe(5);
    });
    test('a Sick Day night is skipped: not counted, not missed, the window looks one night further back', () => {
        const sick = withPri('2026-11-09', 0, { tokens: { sick: 1 } });
        const days = Object.assign(defended(['2026-11-10', '2026-11-08', '2026-11-07', '2026-11-06', '2026-11-05', '2026-11-04', '2026-11-03']), store(sick));
        const m = run(days, pending());
        expect(m.count).toBe(7);
        expect(m.nights.find((n) => n.date === '2026-11-09').status).toBe('excused');
    });
    test('a Sick Day that was defended anyway counts as defended', () => {
        const d = withPri('2026-11-10', 1, { tokens: { sick: 1 } });
        expect(run(store(d), pending()).nights.find((n) => n.date === '2026-11-10').status).toBe('defended');
    });
    test('today as a Sick Day is excused: it neither counts nor drops anything', () => {
        const days = defended(['2026-11-10', '2026-11-09']);
        const m = run(days, withPri('2026-11-11', 0, { tokens: { sick: 1 } }));
        expect(m.today).toBe('excused');
        expect(m.count).toBe(2);
    });
    test('a routine fully completed secures today, like a priority', () => {
        const rec = day('2026-11-11', { rt: { r1: [2, 0, 0] } });
        expect(run({}, rec).today).toBe('secured');
        expect(run({}, rec).count).toBe(1);
    });
    test('a new run counts only its own days; days before the run began are not nights', () => {
        const m = run(defended(['2026-11-10']), secured(), { runStartMs: NOON(2026, 11, 9) });
        expect(m.count).toBe(2);
        expect(m.nights.map((n) => n.date)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
        const other = store(Object.assign(withPri('2026-11-10', 1), { run: 2 }));
        expect(run(other, pending()).count).toBe(0);
    });
    test('the lookback is capped so a long illness cannot walk back forever', () => {
        const days = {};
        for (let i = 1; i <= 30; i++) {
            const d = new Date(2026, 10, 11 - i, 12);
            const key = Momentum.keyOf(d.getTime());
            days[key] = withPri(key, 0, { tokens: { sick: 1 } });
        }
        const m = run(days, pending());
        expect(m.count).toBe(0);
        expect(m.nights.length).toBeLessThanOrEqual(21);
    });
    test('the state lines come from the table: 0-2 None, 3-4 Partial, 5-6 Solid, 7 Reinforced', () => {
        const ids = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => Momentum.barricadeState(n, CONFIG.MOMENTUM.BARRICADE_STATES).id);
        expect(ids).toEqual(['none', 'none', 'none', 'partial', 'partial', 'solid', 'solid', 'reinforced']);
    });
    test('bad input is a quiet empty result', () => {
        expect(Momentum.momentum({}).count).toBe(0);
        expect(Momentum.momentum().state.id).toBe('none');
    });
    test('the config dials exist', () => {
        expect(CONFIG.MOMENTUM.WINDOW_NIGHTS).toBe(7);
        expect(CONFIG.MOMENTUM.BARRICADE_STATES.map((s) => s.min)).toEqual([7, 5, 3, 0]);
    });
});

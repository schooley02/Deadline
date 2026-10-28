/**
 * DailyRecord pure-core tests (D2, 2026-10-27; docs/DAILY_RECORD_PLAN.md).
 *
 * Covers: fresh shape, category list parity with CONFIG, every bump event,
 * undo (exact reverse, floors at 0), close snapshot, normalize of old/partial
 * records (missing field = 0), store helpers, 18-month roll-up, and the
 * never-overwrite import merge.
 */
const DailyRecord = require('../js/dailyRecord.js');
const CONFIG = require('../js/config.js');

const DAY = '2026-10-27';
function rec(over) { return DailyRecord.fresh(Object.assign({ date: DAY, tz: -300 }, over)); }

describe('fresh', () => {
    test('zeroed numeric shape with all 8 categories and 24-hour arrays', () => {
        const r = rec();
        expect(r.v).toBe(DailyRecord.V);
        expect(r.date).toBe(DAY);
        expect(r.tz).toBe(-300);
        expect(Object.keys(r.byCat)).toHaveLength(8);
        Object.values(r.byCat).forEach((t) => expect(t).toEqual([0, 0, 0]));
        ['hoursDone', 'hoursMissed', 'hoursDmg'].forEach((k) => {
            expect(r[k]).toHaveLength(24);
            expect(r[k].every((n) => n === 0)).toBe(true);
        });
        expect(r.active).toEqual({ first: null, last: null, touches: 0 });
        expect(r.done).toEqual({ task: 0, subtask: 0, habit: 0, late: 0 });
    });

    test('category list matches CONFIG.HERO_CATEGORIES', () => {
        expect(DailyRecord.CATEGORIES.slice().sort()).toEqual(CONFIG.HERO_CATEGORIES.slice().sort());
    });

    test('dateKey is the local calendar day', () => {
        expect(DailyRecord.dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    });

    test('holds no free text: every leaf is a number, null or the date/version', () => {
        const walk = (o, path) => {
            Object.entries(o).forEach(([k, v]) => {
                if (v && typeof v === 'object') return walk(v, path + '.' + k);
                if (path === '' && k === 'date') return;
                expect(['number', 'object']).toContain(typeof v);
            });
        };
        walk(rec(), '');
    });
});

describe('bump', () => {
    test('complete: kind, late, hour, category, points', () => {
        const r = rec();
        DailyRecord.bump(r, 'complete', { kind: 'habit', category: 'health', hour: 7, points: 10 });
        DailyRecord.bump(r, 'complete', { kind: 'task', category: 'career', hour: 14, late: true, points: 5 });
        DailyRecord.bump(r, 'complete', { kind: 'subtask', category: 'nonsense', hour: 14 });
        expect(r.done).toEqual({ task: 1, subtask: 1, habit: 1, late: 1 });
        expect(r.hoursDone[7]).toBe(1);
        expect(r.hoursDone[14]).toBe(2);
        expect(r.byCat.health[0]).toBe(1);
        expect(r.byCat.career[0]).toBe(1);
        expect(r.byCat.other[0]).toBe(1); // unknown category -> other
        expect(r.pts.earned).toBe(15);
    });

    test("a 'lurker' completion counts as avoided, not as a done item", () => {
        const r = rec();
        DailyRecord.bump(r, 'complete', { kind: 'lurker', category: 'health', hour: 6, points: 4 });
        expect(r.lurk.avoided).toBe(1);
        expect(r.done).toEqual({ task: 0, subtask: 0, habit: 0, late: 0 });
        expect(r.hoursDone[6]).toBe(1);
        expect(r.byCat.health[0]).toBe(1);
        expect(r.pts.earned).toBe(4);
        DailyRecord.bump(r, 'uncomplete', { kind: 'lurker', category: 'health', hour: 6, points: 4 });
        expect(JSON.stringify(r)).toBe(JSON.stringify(rec()));
    });

    test('hour can be derived from `at`', () => {
        const r = rec();
        const at = new Date(2026, 9, 27, 21, 30).getTime();
        DailyRecord.bump(r, 'complete', { kind: 'task', category: 'health', at });
        expect(r.hoursDone[21]).toBe(1);
    });

    test('overdue records misses by kind, hour and category', () => {
        const r = rec();
        DailyRecord.bump(r, 'overdue', { kind: 'task', category: 'financial', hour: 9 });
        DailyRecord.bump(r, 'overdue', { kind: 'habit', category: 'health', hour: 20 });
        expect(r.missed).toEqual({ task: 1, habit: 1 });
        expect(r.hoursMissed[9]).toBe(1);
        expect(r.hoursMissed[20]).toBe(1);
        expect(r.byCat.financial[1]).toBe(1);
        expect(r.byCat.health[1]).toBe(1);
    });

    test('lurk avoided / slipped', () => {
        const r = rec();
        DailyRecord.bump(r, 'lurk', { outcome: 'avoided' });
        DailyRecord.bump(r, 'lurk', { outcome: 'avoided' });
        DailyRecord.bump(r, 'lurk', { outcome: 'slipped' });
        DailyRecord.bump(r, 'lurk', { outcome: 'bogus' });
        expect(r.lurk).toEqual({ avoided: 2, slipped: 1 });
    });

    test('damage: totals, hits, hour, category, min HP; ignores non-positive', () => {
        const r = rec();
        DailyRecord.bump(r, 'damage', { amount: 3, category: 'health', hour: 10, hp: 90 });
        DailyRecord.bump(r, 'damage', { amount: 2, category: 'health', hour: 10, hp: 88 });
        DailyRecord.bump(r, 'damage', { amount: 0, hour: 10, hp: 1 });
        DailyRecord.bump(r, 'damage', { amount: -4, hour: 10, hp: 1 });
        expect(r.dmg).toEqual({ taken: 5, hits: 2, offline: 0 });
        expect(r.hoursDmg[10]).toBe(5);
        expect(r.byCat.health[2]).toBe(5);
        expect(r.base.minHp).toBe(88);
    });

    test('offline damage is separate from live damage', () => {
        const r = rec();
        DailyRecord.bump(r, 'offline', { amount: 4 });
        expect(r.dmg.offline).toBe(4);
        expect(r.dmg.taken).toBe(0);
        DailyRecord.bump(r, 'offline', { amount: 6, hp: 55 });
        expect(r.dmg.offline).toBe(10);
        expect(r.base.minHp).toBe(55);
        expect(r.hoursDmg.every((n) => n === 0)).toBe(true);
    });

    test('spend, tokens, reschedule, ko, revive, timer', () => {
        const r = rec();
        DailyRecord.bump(r, 'spend', { points: 40 });
        DailyRecord.bump(r, 'token', { kind: 'pushback' });
        DailyRecord.bump(r, 'token', { kind: 'kit' });
        DailyRecord.bump(r, 'token', { kind: 'unknown' });
        DailyRecord.bump(r, 'reschedule', {});
        DailyRecord.bump(r, 'ko', {});
        DailyRecord.bump(r, 'revive', {});
        DailyRecord.bump(r, 'timer', { kind: 'work', minutes: 45 });
        DailyRecord.bump(r, 'timer', { kind: 'limit', minutes: 20 });
        DailyRecord.bump(r, 'timer', { kind: 'work', minutes: -5 });
        expect(r.pts.spent).toBe(40);
        expect(r.tokens).toEqual({ cheat: 0, sick: 0, skip: 0, pushback: 1, kit: 1 });
        expect([r.resched, r.ko, r.revived]).toEqual([1, 1, 1]);
        expect(r.timer).toEqual({ workMin: 45, limitMin: 20 });
    });

    test('touch tracks first / last hour and count', () => {
        const r = rec();
        DailyRecord.bump(r, 'touch', { hour: 12 });
        DailyRecord.bump(r, 'touch', { hour: 7 });
        DailyRecord.bump(r, 'touch', { hour: 22 });
        DailyRecord.bump(r, 'touch', { hour: 12 });
        expect(r.active).toEqual({ first: 7, last: 22, touches: 4 });
    });

    test('unknown events and a missing record never throw', () => {
        const r = rec();
        expect(() => DailyRecord.bump(r, 'nope', {})).not.toThrow();
        expect(() => DailyRecord.bump(null, 'complete', {})).not.toThrow();
        expect(() => DailyRecord.bump(r, 'complete')).not.toThrow();
    });
});

describe('uncomplete (undo)', () => {
    test('is the exact reverse of complete', () => {
        const r = rec();
        const before = JSON.stringify(r);
        const p = { kind: 'task', category: 'career', hour: 9, late: true, points: 8 };
        DailyRecord.bump(r, 'complete', p);
        DailyRecord.bump(r, 'uncomplete', p);
        expect(JSON.stringify(r)).toBe(before);
    });

    test('floors at zero when there is nothing to undo', () => {
        const r = rec();
        DailyRecord.bump(r, 'uncomplete', { kind: 'habit', category: 'health', hour: 3, late: true, points: 9 });
        expect(r.done.habit).toBe(0);
        expect(r.done.late).toBe(0);
        expect(r.hoursDone[3]).toBe(0);
        expect(r.byCat.health[0]).toBe(0);
        expect(r.pts.earned).toBe(0);
    });
});

describe('close', () => {
    test('stamps the end-of-day snapshot', () => {
        const r = rec();
        DailyRecord.bump(r, 'damage', { amount: 5, category: 'health', hour: 10, hp: 80 });
        const closed = DailyRecord.close(r, {
            lvl: 4, run: 3, night: 12,
            load: { habits: 5, routines: 2, tasksDue: 4 },
            due: { task: 4, habit: 5 },
            endHp: 86, ptsEnd: 310, bestStreak: 9,
        });
        expect(closed.lvl).toBe(4);
        expect(closed.run).toBe(3);
        expect(closed.night).toBe(12);
        expect(closed.load).toEqual({ habits: 5, routines: 2, tasksDue: 4 });
        expect(closed.due).toEqual({ task: 4, habit: 5 });
        expect(closed.base).toEqual({ endHp: 86, minHp: 80 });
        expect(closed.pts.end).toBe(310);
        expect(closed.streak.best).toBe(9);
    });

    test('endHp below the day minimum lowers minHp; no ctx is safe', () => {
        const r = rec();
        DailyRecord.bump(r, 'damage', { amount: 1, hour: 1, hp: 90 });
        expect(DailyRecord.close(r, { endHp: 70 }).base).toEqual({ endHp: 70, minHp: 70 });
        expect(() => DailyRecord.close(rec())).not.toThrow();
    });
});

describe('normalize (additive-only rule)', () => {
    test('a partial / old record gains every missing field as 0 or empty', () => {
        const n = DailyRecord.normalize({ date: '2026-01-02', done: { task: 3 } });
        expect(n.done).toEqual({ task: 3, subtask: 0, habit: 0, late: 0 });
        expect(n.hoursDone).toHaveLength(24);
        expect(n.byCat.health).toEqual([0, 0, 0]);
        expect(n.date).toBe('2026-01-02');
    });

    test('keeps null first/last/minHp as null', () => {
        const n = DailyRecord.normalize({ date: '2026-01-02' });
        expect(n.active.first).toBeNull();
        expect(n.base.minHp).toBeNull();
    });

    test('garbage in gives a fresh record', () => {
        expect(DailyRecord.normalize(null).done.task).toBe(0);
    });
});

describe('totals', () => {
    test('done / missed / damage for best-worst scoring', () => {
        const r = rec();
        DailyRecord.bump(r, 'complete', { kind: 'task', hour: 1 });
        DailyRecord.bump(r, 'complete', { kind: 'subtask', hour: 1 });
        DailyRecord.bump(r, 'complete', { kind: 'habit', hour: 1 });
        DailyRecord.bump(r, 'overdue', { kind: 'habit', hour: 2 });
        DailyRecord.bump(r, 'damage', { amount: 6, hour: 2 });
        expect(DailyRecord.totals(r)).toEqual({ done: 3, missed: 1, damage: 6 });
        expect(DailyRecord.totals(null)).toEqual({ done: 0, missed: 0, damage: 0 });
    });
});

describe('store', () => {
    test('emptyStore / addDay writes by date and replaces', () => {
        let s = DailyRecord.emptyStore();
        expect(s).toEqual({ v: DailyRecord.V, days: {}, months: {} });
        s = DailyRecord.addDay(s, rec());
        expect(Object.keys(s.days)).toEqual([DAY]);
        const second = rec();
        second.lvl = 9;
        s = DailyRecord.addDay(s, second);
        expect(s.days[DAY].lvl).toBe(9);
    });

    test('normalizeStore repairs a missing / malformed store', () => {
        expect(DailyRecord.normalizeStore(null)).toEqual({ v: DailyRecord.V, days: {}, months: {} });
        expect(DailyRecord.normalizeStore({ days: 5 }).days).toEqual({});
    });
});

describe('rollUp (18 months)', () => {
    const NOW = new Date(2026, 9, 27); // 2026-10-27

    function dayRec(date, over) {
        const r = DailyRecord.fresh({ date, tz: -300 });
        DailyRecord.bump(r, 'complete', { kind: 'task', category: 'health', hour: 9, points: 10 });
        DailyRecord.bump(r, 'touch', { hour: 8 });
        DailyRecord.bump(r, 'touch', { hour: 20 });
        const closed = DailyRecord.close(r, { lvl: 3, endHp: 80, ptsEnd: 100, bestStreak: 4 });
        return Object.assign(closed, over || {});
    }

    test('recent days are left alone', () => {
        let s = DailyRecord.addDay(DailyRecord.emptyStore(), dayRec('2026-10-01'));
        s = DailyRecord.rollUp(s, NOW);
        expect(Object.keys(s.days)).toEqual(['2026-10-01']);
        expect(s.months).toEqual({});
    });

    test('days past the cutoff fold into their month and are removed', () => {
        let s = DailyRecord.emptyStore();
        s = DailyRecord.addDay(s, dayRec('2025-01-03'));
        s = DailyRecord.addDay(s, dayRec('2025-01-04'));
        s = DailyRecord.addDay(s, dayRec('2026-10-01'));
        s = DailyRecord.rollUp(s, NOW);
        expect(Object.keys(s.days)).toEqual(['2026-10-01']);
        const m = s.months['2025-01'];
        expect(m.days).toBe(2);
        expect(m.done.task).toBe(2);
        expect(m.hoursDone[9]).toBe(2);
        expect(m.byCat.health[0]).toBe(2);
        expect(m.pts.earned).toBe(20);
        expect(m.active).toEqual({ first: 8, last: 20, touches: 4 });
        expect(m.base.endHp).toBe(80);
        expect(m.tz).toBeUndefined();
    });

    test('running again merges into an existing month and is idempotent', () => {
        let s = DailyRecord.addDay(DailyRecord.emptyStore(), dayRec('2025-01-03'));
        s = DailyRecord.rollUp(s, NOW);
        s = DailyRecord.addDay(s, dayRec('2025-01-09'));
        s = DailyRecord.rollUp(s, NOW);
        expect(s.months['2025-01'].days).toBe(2);
        expect(s.months['2025-01'].done.task).toBe(2);
        const again = DailyRecord.rollUp(JSON.parse(JSON.stringify(s)), NOW);
        expect(again.months['2025-01'].days).toBe(2);
    });
});

describe('mergeStores (import)', () => {
    test('adds missing days and months, never overwrites a day with data', () => {
        const local = DailyRecord.addDay(DailyRecord.emptyStore(), Object.assign(rec(), { lvl: 7 }));
        const incoming = DailyRecord.emptyStore();
        incoming.days[DAY] = Object.assign(rec(), { lvl: 1 });
        incoming.days['2026-10-26'] = rec({ date: '2026-10-26' });
        incoming.months['2025-01'] = { days: 3 };
        const { store, added } = DailyRecord.mergeStores(local, incoming);
        expect(store.days[DAY].lvl).toBe(7);
        expect(store.days['2026-10-26']).toBeDefined();
        expect(store.months['2025-01']).toEqual({ days: 3 });
        expect(added).toBe(2);
    });

    test('tolerates a missing incoming store', () => {
        const local = DailyRecord.addDay(DailyRecord.emptyStore(), rec());
        const { store, added } = DailyRecord.mergeStores(local, null);
        expect(added).toBe(0);
        expect(Object.keys(store.days)).toEqual([DAY]);
    });
});

describe('dayScore / bestWorstByRun (D2 step 5)', () => {
    function day(date, run, night, done, missed, dmg) {
        const r = DailyRecord.fresh({ date, run, night });
        r.run = run; r.night = night;
        r.done.task = done; r.missed.task = missed; r.dmg.taken = dmg;
        return r;
    }
    function storeOf(...recs) {
        let s = DailyRecord.emptyStore();
        recs.forEach(r => { s = DailyRecord.addDay(s, r); });
        return s;
    }

    test('score = done - missed - damage, weights override', () => {
        const r = day('2026-10-01', 1, 1, 5, 2, 3);
        expect(DailyRecord.dayScore(r)).toBe(0);
        expect(DailyRecord.dayScore(r, { damage: 0.5 })).toBe(1.5);
        expect(DailyRecord.dayScore(null)).toBe(0);
    });

    test('CONFIG.DAILY_SCORE_WEIGHTS has all three weights', () => {
        expect(Object.keys(CONFIG.DAILY_SCORE_WEIGHTS).sort()).toEqual(['damage', 'done', 'missed']);
    });

    test('picks best and worst of the matching run only', () => {
        const s = storeOf(
            day('2026-10-01', 1, 1, 4, 0, 0),   // +4
            day('2026-10-02', 1, 2, 1, 3, 5),   // -7
            day('2026-10-03', 1, 3, 2, 1, 0),   // +1
            day('2026-10-04', 2, 1, 9, 0, 0),   // other run
        );
        const bw = DailyRecord.bestWorstByRun(s, 1);
        expect(bw.best).toMatchObject({ date: '2026-10-01', night: 1, score: 4, done: 4 });
        expect(bw.worst).toMatchObject({ date: '2026-10-02', night: 2, score: -7, missed: 3, damage: 5 });
    });

    test('ties go to the earlier date; idle days are skipped', () => {
        const s = storeOf(
            day('2026-10-01', 1, 1, 3, 0, 0),
            day('2026-10-02', 1, 2, 3, 0, 0),
            day('2026-10-03', 1, 3, 0, 0, 0),   // idle
            day('2026-10-04', 1, 4, 0, 2, 0),   // -2
        );
        const bw = DailyRecord.bestWorstByRun(s, 1);
        expect(bw.best.date).toBe('2026-10-01');
        expect(bw.worst.date).toBe('2026-10-04');
    });

    test('null with fewer than 2 scored days or all-equal scores', () => {
        expect(DailyRecord.bestWorstByRun(null, 1)).toBeNull();
        expect(DailyRecord.bestWorstByRun(storeOf(day('2026-10-01', 1, 1, 3, 0, 0)), 1)).toBeNull();
        expect(DailyRecord.bestWorstByRun(storeOf(
            day('2026-10-01', 1, 1, 3, 0, 0), day('2026-10-02', 1, 2, 3, 0, 0)), 1)).toBeNull();
        expect(DailyRecord.bestWorstByRun(storeOf(day('2026-10-01', 1, 1, 3, 0, 0)), 2)).toBeNull();
    });

    test("today's open record counts via opts.extra (and replaces a same-date day)", () => {
        const s = storeOf(day('2026-10-01', 1, 1, 2, 0, 0));
        const today = day('2026-10-02', 1, 2, 0, 4, 0);
        const bw = DailyRecord.bestWorstByRun(s, 1, { extra: [today] });
        expect(bw.worst.date).toBe('2026-10-02');
        expect(bw.best.date).toBe('2026-10-01');
    });
});

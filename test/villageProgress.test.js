/**
 * VillageProgress pure-core tests (Build 1, 2026-10-30; docs/WORLD_FEEDBACK_PLAN.md
 * "Village tiers + building cards", DECISIONS 2026-10-30 night).
 *
 * Covers: threshold parity with CONFIG, tierFor edges, each of the eight per-run counters
 * (including the run filter, the open day, and the "no history" edges), the flavour extras,
 * and the DailyRecord routine-attendance tally that feeds the High school.
 */
const VillageProgress = require('../js/villageProgress.js');
const DailyRecord = require('../js/dailyRecord.js');
const CONFIG = require('../js/config.js');

const RUN = 3;
const MAX_HP = CONFIG.MAX_BASE_HEALTH;

function day(date, over) {
    const r = DailyRecord.fresh({ date, run: RUN, tz: -300 });
    return Object.assign(r, over || {});
}
function dated(n) { // n-th day of a run starting 2026-11-01 (1-based)
    return '2026-11-' + String(n).padStart(2, '0');
}

describe('shell wiring', () => {
    const fs = require('fs');
    const path = require('path');
    const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    test('js/villageProgress.js is in the service worker APP_SHELL and loads after dailyRecord.js', () => {
        expect(read('sw.js')).toContain("'js/villageProgress.js'");
        const html = read('index.html');
        expect(html.indexOf('js/villageProgress.js')).toBeGreaterThan(html.indexOf('js/dailyRecord.js'));
    });
    test('CACHE_NAME was bumped for the new shell file (v144 or later)', () => {
        const m = /CACHE_NAME = 'deadline-shell-v(\d+)'/.exec(read('sw.js'));
        expect(Number(m[1])).toBeGreaterThanOrEqual(144);
    });
});

describe('thresholds', () => {
    test('DEFAULT_THRESHOLDS mirrors CONFIG.VILLAGE_TIER_THRESHOLDS', () => {
        expect(VillageProgress.DEFAULT_THRESHOLDS).toEqual(CONFIG.VILLAGE_TIER_THRESHOLDS);
    });
    test('every building has four strictly ascending thresholds', () => {
        VillageProgress.KINDS.forEach((k) => {
            const t = CONFIG.VILLAGE_TIER_THRESHOLDS[k];
            expect(t).toHaveLength(4);
            for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
            expect(t[0]).toBeGreaterThan(0);
        });
    });
    test('the eight kinds match the village kinds', () => {
        expect(VillageProgress.KINDS.slice().sort()).toEqual(
            ['bestdays', 'defense', 'habits', 'heroes', 'lurkers', 'nights', 'punctuality', 'slain']);
    });
    test('config defaults the module mirrors', () => {
        expect(CONFIG.VILLAGE_DEFENSE_HELD_FRAC).toBe(0.75);
        expect(CONFIG.VILLAGE_HEAVY_DAY_WINDOW).toBe(14);
        expect(CONFIG.VILLAGE_HEAVY_DAY_MIN_DAYS).toBe(3);
    });
});

describe('tierFor', () => {
    const L = [4, 18, 50, 100];
    test('starts at T1 with the whole first rung ahead', () => {
        expect(VillageProgress.tierFor(0, L)).toEqual({ tier: 1, value: 0, prevAt: 0, nextAt: 4, toNext: 4, maxed: false, fraction: 0 });
    });
    test('one short of a threshold stays on the lower tier', () => {
        const p = VillageProgress.tierFor(3, L);
        expect(p.tier).toBe(1);
        expect(p.toNext).toBe(1);
    });
    test('exactly on a threshold reaches that tier', () => {
        const p = VillageProgress.tierFor(4, L);
        expect(p.tier).toBe(2);
        expect(p.prevAt).toBe(4);
        expect(p.nextAt).toBe(18);
        expect(p.toNext).toBe(14);
        expect(p.fraction).toBe(0);
    });
    test('fraction is progress within the current tier', () => {
        expect(VillageProgress.tierFor(11, L).fraction).toBeCloseTo(0.5, 5);
    });
    test('T5 is maxed: no next goal, full bar', () => {
        const p = VillageProgress.tierFor(100, L);
        expect(p).toMatchObject({ tier: 5, maxed: true, nextAt: null, toNext: 0, fraction: 1 });
        expect(VillageProgress.tierFor(5000, L).tier).toBe(5);
    });
    test('garbage values count as zero', () => {
        [undefined, null, NaN, -5, 'x'].forEach(v => expect(VillageProgress.tierFor(v, L).tier).toBe(1));
    });
});

describe('runDays', () => {
    test('keeps only this run, sorted by date, from an array, a store or a map', () => {
        const a = day('2026-11-03'), b = day('2026-11-01'), other = Object.assign(day('2026-11-02'), { run: RUN - 1 });
        const asArray = [a, other, b];
        const asMap = { '2026-11-03': a, '2026-11-02': other, '2026-11-01': b };
        [asArray, asMap, { v: 2, days: asMap, months: {} }].forEach((src) => {
            expect(VillageProgress.runDays(src, RUN).map(r => r.date)).toEqual(['2026-11-01', '2026-11-03']);
        });
    });
    test('nothing / garbage gives an empty list', () => {
        expect(VillageProgress.runDays(null, RUN)).toEqual([]);
        expect(VillageProgress.runDays(undefined, RUN)).toEqual([]);
    });
});

describe('counters', () => {
    function ctx(over) {
        return Object.assign({
            runStats: { tasksCompleted: 0, subtasksCompleted: 0, habitsCompleted: 0 },
            nightsSurvived: 0, days: [], today: null, runNumber: RUN, maxHp: MAX_HP,
        }, over || {});
    }

    test('a brand-new run is all zeros and every building is T1', () => {
        const c = VillageProgress.counters(ctx());
        Object.values(c).forEach(v => expect(v).toBe(0));
        const p = VillageProgress.compute(ctx());
        VillageProgress.KINDS.forEach(k => expect(p[k].tier).toBe(1));
    });

    test('nights = nights survived', () => {
        expect(VillageProgress.counters(ctx({ nightsSurvived: 18 })).nights).toBe(18);
        expect(VillageProgress.compute(ctx({ nightsSurvived: 18 })).nights.tier).toBe(3);
    });

    test('slain = tasks + sub-tasks + habits; habits = habit check-ins only', () => {
        const c = VillageProgress.counters(ctx({ runStats: { tasksCompleted: 10, subtasksCompleted: 5, habitsCompleted: 15 } }));
        expect(c.slain).toBe(30);
        expect(c.habits).toBe(15);
        expect(VillageProgress.compute(ctx({ runStats: { tasksCompleted: 10, subtasksCompleted: 5, habitsCompleted: 15 } })).slain.tier).toBe(2);
    });

    test('punctuality = done minus late, over closed days plus the open day', () => {
        const d1 = day(dated(1), { done: { task: 5, subtask: 2, habit: 3, late: 4 } }); // 6 on time
        const d2 = day(dated(2), { done: { task: 2, subtask: 0, habit: 0, late: 5 } });  // floors at 0
        const open = day(dated(3), { done: { task: 4, subtask: 0, habit: 1, late: 1 } }); // 4
        expect(VillageProgress.counters(ctx({ days: [d1, d2], today: open })).punctuality).toBe(10);
        expect(VillageProgress.counters(ctx({ days: [d1, d2] })).punctuality).toBe(6);
    });

    test('an open day from another run is ignored', () => {
        const open = Object.assign(day(dated(3), { done: { task: 9, subtask: 0, habit: 0, late: 0 } }), { run: RUN - 1 });
        expect(VillageProgress.counters(ctx({ today: open })).punctuality).toBe(0);
    });

    test('days from other runs never count (a new run starts over)', () => {
        const old = Object.assign(day(dated(1), { lurk: { avoided: 2, slipped: 0 }, att: { active: 1, perfect: 1 }, base: { endHp: 100, minHp: 100 } }), { run: RUN - 1 });
        const c = VillageProgress.counters(ctx({ days: [old] }));
        expect(c.lurkers).toBe(0);
        expect(c.heroes).toBe(0);
        expect(c.defense).toBe(0);
    });

    describe('lurkers (Boxing gym): days with no slips', () => {
        test('needs at least one bad habit resolved and none slipped', () => {
            const ok = day(dated(1), { lurk: { avoided: 2, slipped: 0 } });
            const slipped = day(dated(2), { lurk: { avoided: 2, slipped: 1 } });
            const none = day(dated(3), { lurk: { avoided: 0, slipped: 0 } }); // no bad habit due: neither helps nor hurts
            expect(VillageProgress.counters(ctx({ days: [ok, slipped, none] })).lurkers).toBe(1);
        });
        test('a person with no bad habits stays at T1', () => {
            const days = [1, 2, 3, 4, 5].map(n => day(dated(n)));
            expect(VillageProgress.compute(ctx({ days })).lurkers.tier).toBe(1);
        });
    });

    describe('defense (Jailhouse): nights the church held', () => {
        test('counts days that END at >= 75% of max health', () => {
            const held = day(dated(1), { base: { endHp: 75, minHp: 40 } });
            const justShort = day(dated(2), { base: { endHp: 74, minHp: 74 } });
            const full = day(dated(3), { base: { endHp: 100, minHp: 100 } });
            const unknown = day(dated(4), { base: { endHp: null, minHp: null } });
            expect(VillageProgress.counters(ctx({ days: [held, justShort, full, unknown] })).defense).toBe(2);
        });
        test('the fraction is a parameter', () => {
            const d = day(dated(1), { base: { endHp: 60, minHp: 60 } });
            expect(VillageProgress.counters(ctx({ days: [d], defenseFrac: 0.5 })).defense).toBe(1);
            expect(VillageProgress.counters(ctx({ days: [d] })).defense).toBe(0);
        });
    });

    describe('heroes (High school): perfect-attendance days', () => {
        test('needs an active routine and every active routine fully attended', () => {
            const perfect = day(dated(1), { att: { active: 2, perfect: 2 } });
            const oneMissed = day(dated(2), { att: { active: 2, perfect: 1 } });
            const noRoutine = day(dated(3), { att: { active: 0, perfect: 0 } });
            expect(VillageProgress.counters(ctx({ days: [perfect, oneMissed, noRoutine] })).heroes).toBe(1);
        });
    });

    describe('bestdays (Windmill): heavy days handled', () => {
        function due(date, n, missed) {
            return day(date, { due: { task: n, habit: 0 }, missed: { task: missed || 0, habit: 0 } });
        }
        test('no day can be heavy before 3 days of history', () => {
            const days = [due(dated(1), 5), due(dated(2), 5), due(dated(3), 50)];
            expect(VillageProgress.counters(ctx({ days })).bestdays).toBe(0);
        });
        test('the 4th day counts when it is heavier than the average and nothing was missed', () => {
            const days = [due(dated(1), 4), due(dated(2), 4), due(dated(3), 4), due(dated(4), 5)];
            expect(VillageProgress.counters(ctx({ days })).bestdays).toBe(1);
        });
        test('a heavy day with a miss is heavy but not handled', () => {
            const days = [due(dated(1), 4), due(dated(2), 4), due(dated(3), 4), due(dated(4), 9, 1)];
            expect(VillageProgress.counters(ctx({ days })).bestdays).toBe(0);
            expect(VillageProgress.heavyDays(days, 14, 3)).toEqual({ heavy: 1, handled: 0 });
        });
        test('equal to the average is not heavy (strictly above)', () => {
            const days = [due(dated(1), 4), due(dated(2), 4), due(dated(3), 4), due(dated(4), 4)];
            expect(VillageProgress.counters(ctx({ days })).bestdays).toBe(0);
        });
        test('KNOWN BEHAVIOUR: after a permanent step up, every day stays heavy until the window fills with the new level', () => {
            // 3 light days, then 10 a day: the average (< 10 until the whole window is 10s) trails the new level, so each
            // of these days is "heavier than average". Sustained padding therefore keeps scoring for up to the window
            // length per ramp-up. Flagged to Jeremy 2026-10-30 as an open balance question (margin / shorter window);
            // the approved rule is implemented as written.
            const days = [due(dated(1), 4), due(dated(2), 4), due(dated(3), 4)];
            for (let n = 4; n <= 10; n++) days.push(due(dated(n), 10));
            expect(VillageProgress.heavyDays(days, 14, 3).handled).toBe(7);
            // ...but once the window is all 10s the plateau stops scoring.
            const plateau = [due(dated(1), 10), due(dated(2), 10), due(dated(3), 10), due(dated(4), 10)];
            expect(VillageProgress.heavyDays(plateau, 14, 3).handled).toBe(0);
        });
        test('the average only looks at the last N closed days', () => {
            const days = [];
            for (let n = 1; n <= 6; n++) days.push(due(dated(n), 20)); // old heavy stretch
            for (let n = 7; n <= 9; n++) days.push(due(dated(n), 2));  // quiet recent days
            days.push(due(dated(10), 5)); // heavy against the last 3 days (avg 2), not against the whole run
            expect(VillageProgress.heavyDays(days, 3, 3).handled).toBeGreaterThanOrEqual(1);
            expect(VillageProgress.heavyDays(days.slice(6), 3, 3).handled).toBe(1);
        });
    });
});

describe('extras (card flavour lines, never tiers)', () => {
    test('attendanceStreak counts consecutive perfect days ending at the latest closed day', () => {
        const p = n => day(dated(n), { att: { active: 1, perfect: 1 } });
        const miss = day(dated(3), { att: { active: 1, perfect: 0 } });
        expect(VillageProgress.attendanceStreak([p(1), p(2), miss, p(4), p(5)])).toBe(2);
        expect(VillageProgress.attendanceStreak([p(1), p(2), p(3), miss])).toBe(0);
        expect(VillageProgress.attendanceStreak([p(1), p(2), p(4)])).toBe(1); // gap at day 3 breaks it
        expect(VillageProgress.attendanceStreak([])).toBe(0);
    });
    test('comebackDays = a clean day right after a rough one', () => {
        const rough = day(dated(1), { due: { task: 3, habit: 0 }, missed: { task: 1, habit: 0 } });
        const clean = day(dated(2), { due: { task: 3, habit: 0 } });
        const hurt = day(dated(3), { due: { task: 3, habit: 0 }, dmg: { taken: 4, hits: 2, offline: 0 } });
        const clean2 = day(dated(5), { due: { task: 3, habit: 0 } }); // not the next calendar day: no comeback
        expect(VillageProgress.comebackDays([rough, clean, hurt, clean2])).toBe(1);
        expect(VillageProgress.comebackDays([rough, clean, hurt, day(dated(4), { due: { task: 2, habit: 0 } })])).toBe(2);
    });
    test('extras reads the run from ctx', () => {
        const days = [day(dated(1), { att: { active: 1, perfect: 1 } }), day(dated(2), { att: { active: 1, perfect: 1 } })];
        expect(VillageProgress.extras({ days, runNumber: RUN }).attendanceStreak).toBe(2);
    });
});

describe('DailyRecord routine attendance (feeds the High school)', () => {
    function rec() { return DailyRecord.fresh({ date: '2026-11-01', run: RUN }); }

    test('v2 and a zeroed att / empty rt on a fresh record', () => {
        expect(DailyRecord.V).toBe(2);
        const r = rec();
        expect(r.att).toEqual({ active: 0, perfect: 0 });
        expect(r.rt).toEqual({});
    });

    test('items without a routine leave the tally alone', () => {
        const r = rec();
        DailyRecord.bump(r, 'complete', { kind: 'task', category: 'health', hour: 9 });
        DailyRecord.bump(r, 'overdue', { kind: 'task', category: 'health', hour: 9 });
        expect(r.rt).toEqual({});
    });

    test('complete / overdue / late-complete tally per routine', () => {
        const r = rec();
        DailyRecord.bump(r, 'complete', { kind: 'habit', category: 'health', hour: 9, routineId: 7 });
        DailyRecord.bump(r, 'overdue', { kind: 'habit', category: 'health', hour: 10, routineId: 7 });
        DailyRecord.bump(r, 'complete', { kind: 'habit', category: 'health', hour: 11, routineId: 7, late: true });
        expect(r.rt['7']).toEqual([2, 1, 1]);
    });

    test('uncomplete reverses the tally and floors at 0', () => {
        const r = rec();
        DailyRecord.bump(r, 'complete', { kind: 'task', category: 'other', hour: 9, routineId: 2, late: true });
        DailyRecord.bump(r, 'uncomplete', { kind: 'task', category: 'other', hour: 9, routineId: 2, late: true });
        DailyRecord.bump(r, 'uncomplete', { kind: 'task', category: 'other', hour: 9, routineId: 2, late: true });
        expect(r.rt['2']).toEqual([0, 0, 0]);
    });

    test('an avoided bad habit in a routine is a done item; a slip is a miss', () => {
        const r = rec();
        DailyRecord.bump(r, 'complete', { kind: 'lurker', category: 'health', hour: 8, routineId: 4 });
        DailyRecord.bump(r, 'lurk', { outcome: 'slipped', routineId: 4 });
        DailyRecord.bump(r, 'lurk', { outcome: 'slipped' }); // standalone slip: lurk.* only
        expect(r.rt['4']).toEqual([1, 1, 0]);
        expect(r.lurk.slipped).toBe(2);
    });

    test('attendanceFromTally: perfect = every miss was finished late; inactive routines are skipped', () => {
        expect(DailyRecord.attendanceFromTally({
            a: [3, 0, 0],   // clean
            b: [2, 1, 1],   // missed once, finished late: still perfect
            c: [1, 2, 1],   // one miss never finished
            d: [0, 0, 0],   // no activity: not counted
            e: [0, 1, 0],   // did nothing, went overdue
        })).toEqual({ active: 4, perfect: 2 });
        expect(DailyRecord.attendanceFromTally(null)).toEqual({ active: 0, perfect: 0 });
    });

    test('close folds the tally into att and clears rt; a second close keeps att', () => {
        const r = rec();
        DailyRecord.bump(r, 'complete', { kind: 'task', category: 'other', hour: 9, routineId: 1 });
        DailyRecord.bump(r, 'overdue', { kind: 'task', category: 'other', hour: 9, routineId: 2 });
        const closed = DailyRecord.close(r, { run: RUN });
        expect(closed.att).toEqual({ active: 2, perfect: 1 });
        expect(closed.rt).toEqual({});
        expect(DailyRecord.isPerfectAttendance(closed)).toBe(false);
        const again = DailyRecord.close(closed, { run: RUN });
        expect(again.att).toEqual({ active: 2, perfect: 1 });
    });

    test('a day with every routine finished is perfect attendance; no routines is not', () => {
        const r = rec();
        DailyRecord.bump(r, 'complete', { kind: 'habit', category: 'other', hour: 21, routineId: 1 });
        DailyRecord.bump(r, 'complete', { kind: 'habit', category: 'other', hour: 21, routineId: 1 });
        expect(DailyRecord.isPerfectAttendance(DailyRecord.close(r, {}))).toBe(true);
        expect(DailyRecord.isPerfectAttendance(DailyRecord.close(rec(), {}))).toBe(false);
    });

    test('normalize keeps a mid-day tally across a reload and repairs bad data', () => {
        const r = rec();
        DailyRecord.bump(r, 'overdue', { kind: 'habit', category: 'other', hour: 9, routineId: 5 });
        const reloaded = DailyRecord.normalize(JSON.parse(JSON.stringify(r)));
        expect(reloaded.rt['5']).toEqual([0, 1, 0]);
        const bad = DailyRecord.normalize({ date: '2026-11-01', rt: { x: 'nope', y: [1, 'z', -4] } });
        expect(bad.rt).toEqual({ y: [1, 0, 0] });
        expect(DailyRecord.normalize({ date: '2026-11-01' }).att).toEqual({ active: 0, perfect: 0 });
    });

    test('an old v1 record (no att / rt) still normalizes and closes', () => {
        const old = rec(); delete old.att; delete old.rt; old.v = 1;
        const n = DailyRecord.normalize(old);
        expect(n.v).toBe(1);
        expect(n.att).toEqual({ active: 0, perfect: 0 });
        expect(DailyRecord.isPerfectAttendance(old)).toBe(false);
    });

    test('the month roll-up sums attendance', () => {
        const mk = (date, a) => Object.assign(DailyRecord.fresh({ date }), { att: a });
        const store = DailyRecord.addDay(DailyRecord.addDay(DailyRecord.emptyStore(),
            mk('2020-01-05', { active: 2, perfect: 2 })), mk('2020-01-06', { active: 1, perfect: 0 }));
        const rolled = DailyRecord.rollUp(store, new Date(2026, 9, 30));
        expect(rolled.months['2020-01'].att).toEqual({ active: 3, perfect: 2 });
    });
});

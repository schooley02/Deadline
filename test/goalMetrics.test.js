/**
 * Goals, Build A (2026-11-05; docs/GOALS_PLAN.md): js/goalMetrics.js -- the allowlist of daily-record numbers an
 * aggregate target may watch, and picking the records inside a period or window.
 */
const CONFIG = require('../js/config.js');
const GoalMetrics = require('../js/goalMetrics.js');
const DailyRecord = require('../js/dailyRecord.js');

const defs = CONFIG.GOAL_METRICS;
const rec = (date, patch) => Object.assign(DailyRecord.fresh({ date }), patch || {});

describe('the allowlist', () => {
    test('every metric has an id, a label and a unit; ids are unique', () => {
        const ids = defs.map(d => d.id);
        expect(new Set(ids).size).toBe(ids.length);
        defs.forEach((d) => {
            expect(typeof d.id).toBe('string');
            expect(d.label.length).toBeGreaterThan(0);
            expect(d.unit.length).toBeGreaterThan(0);
            expect(typeof d.path === 'string' || typeof d.special === 'string').toBe(true);
        });
    });
    test('every path points at a real number in a fresh DailyRecord', () => {
        const fresh = DailyRecord.fresh({ date: '2026-11-05' });
        defs.filter(d => d.path).forEach((d) => {
            const v = d.path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), fresh);
            expect(typeof v).toBe('number');
        });
    });
    test('the first list from the plan is there', () => {
        ['tasksDone', 'buildHabitsDone', 'breakHabitsResisted', 'timeLoggedMin', 'baseDamageTaken', 'prioritySets', 'perfectDay', 'pointsEarned']
            .forEach(id => expect(defs.map(d => d.id)).toContain(id));
    });
    test('isAllowed / byId', () => {
        expect(GoalMetrics.isAllowed(defs, 'tasksDone')).toBe(true);
        expect(GoalMetrics.isAllowed(defs, 'nope')).toBe(false);
        expect(GoalMetrics.byId(defs, 'tasksDone').label).toBe('Tasks done');
        expect(GoalMetrics.byId(defs, 'nope')).toBe(null);
        expect(GoalMetrics.isAllowed(null, 'tasksDone')).toBe(false);
    });
});

describe('value', () => {
    test('reads a path off the record', () => {
        const r = rec('2026-11-05', { done: { task: 4, subtask: 0, habit: 2, late: 0 } });
        expect(GoalMetrics.value(r, GoalMetrics.byId(defs, 'tasksDone'))).toBe(4);
        expect(GoalMetrics.value(r, GoalMetrics.byId(defs, 'buildHabitsDone'))).toBe(2);
    });
    test('the other path metrics', () => {
        const r = rec('2026-11-05');
        r.lurk.avoided = 3;
        r.timer.workMin = 95;
        r.dmg.taken = 7;
        r.pts.earned = 40;
        expect(GoalMetrics.value(r, GoalMetrics.byId(defs, 'breakHabitsResisted'))).toBe(3);
        expect(GoalMetrics.value(r, GoalMetrics.byId(defs, 'timeLoggedMin'))).toBe(95);
        expect(GoalMetrics.value(r, GoalMetrics.byId(defs, 'baseDamageTaken'))).toBe(7);
        expect(GoalMetrics.value(r, GoalMetrics.byId(defs, 'pointsEarned'))).toBe(40);
    });
    test('prioritySets = full sets of three finished (works on the OPEN day, where `s` is not written yet)', () => {
        const d = GoalMetrics.byId(defs, 'prioritySets');
        const r = rec('2026-11-05');
        r.pri.d = 7;
        r.pri.s = 0;
        expect(GoalMetrics.value(r, d)).toBe(2);
        r.pri.d = 2;
        expect(GoalMetrics.value(r, d)).toBe(0);
    });
    test('perfectDay is 1 only with attendance recorded and every routine perfect', () => {
        const d = GoalMetrics.byId(defs, 'perfectDay');
        const r = rec('2026-11-05');
        expect(GoalMetrics.value(r, d)).toBe(0);
        r.att = { active: 2, perfect: 2 };
        expect(GoalMetrics.value(r, d)).toBe(1);
        r.att = { active: 2, perfect: 1 };
        expect(GoalMetrics.value(r, d)).toBe(0);
    });
    test('junk in, 0 out', () => {
        const d = GoalMetrics.byId(defs, 'tasksDone');
        expect(GoalMetrics.value(null, d)).toBe(0);
        expect(GoalMetrics.value({}, d)).toBe(0);
        expect(GoalMetrics.value({ done: { task: 'x' } }, d)).toBe(0);
        expect(GoalMetrics.value(rec('2026-11-05'), null)).toBe(0);
        expect(GoalMetrics.value(rec('2026-11-05'), { id: 'x', path: 'a.b.c' })).toBe(0);
    });
    test('valueById looks the metric up in the allowlist', () => {
        const r = rec('2026-11-05', { done: { task: 4, subtask: 0, habit: 0, late: 0 } });
        expect(GoalMetrics.valueById(defs, r, 'tasksDone')).toBe(4);
        expect(GoalMetrics.valueById(defs, r, 'not-a-metric')).toBe(0);
    });
});

describe('recordsBetween', () => {
    const days = {
        '2026-11-01': rec('2026-11-01'),
        '2026-11-03': rec('2026-11-03'),
        '2026-11-04': rec('2026-11-04'),
        '2026-11-09': rec('2026-11-09'),
    };
    test('picks the closed days inside the window, oldest first', () => {
        const r = GoalMetrics.recordsBetween(days, null, '2026-11-02', '2026-11-08');
        expect(r.records.map(x => x.date)).toEqual(['2026-11-03', '2026-11-04']);
        expect(r.openKey).toBe(null);
    });
    test('includes the open day when it is inside the window and reports its key', () => {
        const open = rec('2026-11-05');
        const r = GoalMetrics.recordsBetween(days, open, '2026-11-02', '2026-11-08');
        expect(r.records.map(x => x.date)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05']);
        expect(r.openKey).toBe('2026-11-05');
    });
    test('an open day outside the window is left out', () => {
        const r = GoalMetrics.recordsBetween(days, rec('2026-11-20'), '2026-11-02', '2026-11-08');
        expect(r.records).toHaveLength(2);
        expect(r.openKey).toBe(null);
    });
    test('the open day wins over a stale closed copy of the same date', () => {
        const open = rec('2026-11-04', { done: { task: 9, subtask: 0, habit: 0, late: 0 } });
        const r = GoalMetrics.recordsBetween(days, open, '2026-11-03', '2026-11-04');
        expect(r.records).toHaveLength(2);
        expect(r.records[1].done.task).toBe(9);
    });
    test('junk stores are an empty list, not a crash', () => {
        expect(GoalMetrics.recordsBetween(null, null, '2026-11-01', '2026-11-30').records).toEqual([]);
        expect(GoalMetrics.recordsBetween(days, null, 'x', 'y').records).toEqual([]);
    });
});

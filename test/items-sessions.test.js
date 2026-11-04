/**
 * Items.changeSession + the strict total (Timer sessions Build B, 2026-11-04; docs/TIMER_SESSIONS_PLAN.md).
 * Edits, deletes and adds a timer session: day records corrected, the one-way damage charge with the 1 HP floor,
 * the `tcorr` counter, and a typed total that can never go below the recorded sessions.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.Timer = require('../js/timer.js');
global.TimerSessions = require('../js/timerSessions.js');
global.RunStats = require('../js/runStats.js');
const Items = require('../js/items.js');

const MIN = 60000;
const HOUR = 60 * MIN;
const at = (d, h, m) => new Date(2026, 10, d, h, m || 0).getTime();
const NOW = at(5, 18, 0);

function makeDeps(active, completed, hp) {
    const calls = { adjust: [], saved: 0, rendered: 0, damage: [], daily: [], blame: [] };
    const state = { hp: hp === undefined ? 50 : hp };
    return {
        calls, state,
        activeItems: active || [],
        completedItems: () => completed || [],
        adjustDayTimer: (when, kind, deltaMin) => { calls.adjust.push({ key: TimerSessions.dayKey(when.getTime()), kind, deltaMin }); return true; },
        saveGame: () => { calls.saved += 1; },
        renderCompletedItems: () => { calls.rendered += 1; },
        getBaseHealth: () => state.hp,
        damageBase: (n) => { calls.damage.push(n); state.hp = Math.max(0, state.hp - n); },
        recordDaily: (ev, p) => calls.daily.push([ev, p]),
        getCurrentRunStats: () => ({ blame: [] }),
    };
}
const task = (o) => Object.assign({ id: 1, type: 'task', timer: null, timerMsBanked: 0 }, o);
const withSessions = (sessions, untimed, o) => {
    const sum = sessions.reduce((a, s) => a + (s.end - s.start), 0);
    return task(Object.assign({ timerSessions: sessions, timerUntimedMs: untimed || 0, timerMsBanked: sum + (untimed || 0) }, o));
};
const attacked = () => withSessions([{ start: at(5, 14), end: at(5, 15), attack: [[at(5, 14), at(5, 15)]] }]);

describe('Items.changeSession', () => {
    test('shortening an attacked session hits the church, records tcorr, corrects the day and saves', () => {
        const item = attacked();
        const deps = makeDeps([item]);
        const r = Items.changeSession(1, { type: 'edit', index: 0, start: at(5, 14), end: at(5, 14, 30) }, deps, { now: NOW });
        expect(r).toEqual({ ok: true, deltaMin: -30, chargedHp: 3, chargeHp: 3, completed: false });
        expect(deps.calls.damage).toEqual([3]);
        expect(deps.calls.daily).toEqual([['tcorr', { hp: 3 }]]);
        expect(deps.calls.adjust).toEqual([{ key: '2026-11-05', kind: 'work', deltaMin: -30 }]);
        expect(item.timerMsBanked).toBe(30 * MIN);
        expect(deps.calls.saved).toBe(1);
    });
    test('lengthening or adding never hurts the church and never refunds', () => {
        const item = attacked();
        const deps = makeDeps([item]);
        const r1 = Items.changeSession(1, { type: 'edit', index: 0, start: at(5, 13), end: at(5, 16) }, deps, { now: NOW });
        const r2 = Items.changeSession(1, { type: 'add', start: at(5, 9), end: at(5, 10) }, deps, { now: NOW });
        expect([r1.ok, r1.chargedHp, r2.ok, r2.chargedHp]).toEqual([true, 0, true, 0]);
        expect(deps.calls.damage).toEqual([]);
        expect(deps.calls.daily).toEqual([]);
        expect(deps.state.hp).toBe(50);
    });
    test('the church never drops below 1 HP from a correction', () => {
        const item = attacked(); // delete = 6 HP
        const deps = makeDeps([item], [], 4);
        const r = Items.changeSession(1, { type: 'delete', index: 0 }, deps, { now: NOW });
        expect(r.chargeHp).toBe(6);
        expect(r.chargedHp).toBe(3);
        expect(deps.state.hp).toBe(1);
        expect(deps.calls.daily).toEqual([['tcorr', { hp: 3 }]]);
    });
    test('at 1 HP nothing is charged and no tcorr is recorded (the correction still happens)', () => {
        const item = attacked();
        const deps = makeDeps([item], [], 1);
        const r = Items.changeSession(1, { type: 'delete', index: 0 }, deps, { now: NOW });
        expect(r.ok).toBe(true);
        expect(r.chargedHp).toBe(0);
        expect(deps.calls.damage).toEqual([]);
        expect(deps.calls.daily).toEqual([]);
        expect(item.timerSessions).toEqual([]);
    });
    test('no charge once the run is over', () => {
        const item = attacked();
        const deps = makeDeps([item]);
        deps.isGameOver = () => true;
        expect(Items.changeSession(1, { type: 'delete', index: 0 }, deps, { now: NOW }).chargedHp).toBe(0);
        expect(deps.calls.damage).toEqual([]);
    });
    test('refused while the timer runs: nothing changes', () => {
        const item = attacked();
        item.timer = { startedAt: 1, checkedAt: 1, promptedAt: null };
        const deps = makeDeps([item]);
        expect(Items.changeSession(1, { type: 'delete', index: 0 }, deps, { now: NOW })).toEqual({ ok: false, reason: 'running' });
        expect(item.timerSessions).toHaveLength(1);
        expect(deps.calls.saved).toBe(0);
    });
    test('a validation failure passes its reason through and changes nothing', () => {
        const item = attacked();
        const deps = makeDeps([item]);
        const before = JSON.stringify(item);
        expect(Items.changeSession(1, { type: 'add', start: at(5, 14, 30), end: at(5, 16) }, deps, { now: NOW })).toEqual({ ok: false, reason: 'overlap' });
        expect(Items.changeSession(1, { type: 'edit', index: 0, start: at(5, 17), end: at(5, 19) }, deps, { now: NOW })).toEqual({ ok: false, reason: 'future' });
        expect(JSON.stringify(item)).toBe(before);
        expect(deps.calls.saved).toBe(0);
    });
    test('unknown item', () => {
        expect(Items.changeSession(99, { type: 'delete', index: 0 }, makeDeps([attacked()]), { now: NOW })).toEqual({ ok: false, reason: 'missing' });
    });
    test('a completed item: the day of the SESSION is corrected, the Completed list redraws', () => {
        const done = withSessions([{ start: at(3, 9), end: at(3, 10), attack: [] }], 0, { id: 8, completedAt: new Date(2026, 10, 3, 10, 5) });
        const deps = makeDeps([], [done]);
        const r = Items.changeSession(8, { type: 'edit', index: 0, start: at(3, 9), end: at(3, 10, 30) }, deps, { now: NOW });
        expect(r.completed).toBe(true);
        expect(deps.calls.adjust).toEqual([{ key: '2026-11-03', kind: 'work', deltaMin: 30 }]);
        expect(deps.calls.rendered).toBe(1);
    });
    test('a break habit corrects the limit bucket', () => {
        const item = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }], 0, { id: 7, type: 'habit', isNegative: true, timerMinutes: 30 });
        const deps = makeDeps([item]);
        Items.changeSession(7, { type: 'delete', index: 0 }, deps, { now: NOW });
        expect(deps.calls.adjust[0].kind).toBe('limit');
    });
    test('a move across midnight corrects each day', () => {
        const item = withSessions([{ start: at(4, 23), end: at(4, 23, 50), attack: [] }]);
        const deps = makeDeps([item]);
        Items.changeSession(1, { type: 'edit', index: 0, start: at(4, 23), end: at(5, 0, 30) }, deps, { now: NOW });
        expect(deps.calls.adjust).toEqual([
            { key: '2026-11-04', kind: 'work', deltaMin: -50 },
            { key: '2026-11-05', kind: 'work', deltaMin: 90 },
        ]);
    });
    test('a throwing damage / daily dep never loses the correction', () => {
        const item = attacked();
        const deps = makeDeps([item]);
        deps.damageBase = () => { throw new Error('boom'); };
        const r = Items.changeSession(1, { type: 'delete', index: 0 }, deps, { now: NOW });
        expect(r.ok).toBe(true);
        expect(item.timerSessions).toEqual([]);
    });
    test('an old item (no session fields) can have a session added; its old time stays', () => {
        const item = task({ timerMsBanked: 30 * MIN });
        const deps = makeDeps([item]);
        const r = Items.changeSession(1, { type: 'add', start: at(5, 9), end: at(5, 10) }, deps, { now: NOW });
        expect(r.ok).toBe(true);
        expect(item.timerUntimedMs).toBe(30 * MIN);
        expect(item.timerMsBanked).toBe(90 * MIN);
    });
});

describe('Items.setLoggedTime with sessions (the typed total)', () => {
    test('a total below the timed sessions is refused and changes nothing', () => {
        const item = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }], 10 * MIN);
        const deps = makeDeps([item]);
        expect(Items.setLoggedTime(1, 30 * MIN, deps)).toEqual({ ok: false, reason: 'below-timed' });
        expect(item.timerMsBanked).toBe(70 * MIN);
        expect(deps.calls.adjust).toEqual([]);
        expect(deps.calls.saved).toBe(0);
    });
    test('a total above it grows only the untimed entry and corrects today', () => {
        const item = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }], 10 * MIN);
        const deps = makeDeps([item]);
        const r = Items.setLoggedTime(1, 100 * MIN, deps);
        expect(r).toEqual({ ok: true, deltaMin: 30, completed: false });
        expect(item.timerUntimedMs).toBe(40 * MIN);
        expect(item.timerSessions).toHaveLength(1);
    });
    test('opts.collapse keeps the old behaviour for internal callers', () => {
        const item = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }], 10 * MIN);
        const deps = makeDeps([item]);
        expect(Items.setLoggedTime(1, 20 * MIN, deps, { collapse: true }).ok).toBe(true);
        expect(item.timerMsBanked).toBe(20 * MIN);
        expect(item.timerSessions).toEqual([]);
    });
    test('an item with no sessions takes any total (nothing to protect)', () => {
        const item = task({ timerMsBanked: 45 * MIN });
        const deps = makeDeps([item]);
        expect(Items.setLoggedTime(1, 5 * MIN, deps).ok).toBe(true);
        expect(item.timerMsBanked).toBe(5 * MIN);
    });
    test('zero clears a paused flag', () => {
        const item = task({ timerMsBanked: 45 * MIN, timerPaused: true });
        const deps = makeDeps([item]);
        Items.setLoggedTime(1, 0, deps);
        expect(item.timerPaused).toBe(false);
    });
});

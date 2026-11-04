/**
 * Timer sessions, Build A (docs/TIMER_SESSIONS_PLAN.md, 2026-11-04): the pure core.
 * Covers the normaliser, recording on stop / pause / autoStop, attack windows, validation, edit / delete / add,
 * the one-way damage charge (rounding, floor), the total-typing rule and the day deltas.
 */
const TimerSessions = require('../js/timerSessions.js');
const Timer = require('../js/timer.js');

const MIN = 60000;
const HOUR = 60 * MIN;
const at = (d, h, m) => new Date(2026, 10, d, h, m || 0).getTime(); // local time, November 2026
const task = (o) => Object.assign({ type: 'task', timer: null, timerMsBanked: 0 }, o);
// A stopped item with sessions already recorded (the invariant: timerMsBanked = sum of spans + untimed).
const withSessions = (sessions, untimed) => {
    const sum = sessions.reduce((a, s) => a + (s.end - s.start), 0);
    return task({ timerSessions: sessions, timerUntimedMs: untimed || 0, timerMsBanked: sum + (untimed || 0) });
};
const NOW = at(5, 18, 0);
// The live loop ticks every 50 ms-1 s; the tests tick every 10 s. Reports `attacking` for every tick from a to b inclusive.
const tick = (it, a, b, attacking) => { for (let t = a; t <= b; t += 10000) Timer.trackAttack(it, t, attacking); };

describe('ensure (lazy normaliser)', () => {
    test('an old item with banked time and no sessions keeps it as ONE untimed entry', () => {
        const it = task({ timerMsBanked: 45 * MIN });
        TimerSessions.ensure(it);
        expect(it.timerSessions).toEqual([]);
        expect(it.timerUntimedMs).toBe(45 * MIN);
        expect(it.timerMsBanked).toBe(45 * MIN);
    });
    test('an item with nothing logged gets empty fields', () => {
        const it = task();
        TimerSessions.ensure(it);
        expect(it.timerSessions).toEqual([]);
        expect(it.timerUntimedMs).toBe(0);
    });
    test('an item that already has the fields is left alone', () => {
        const it = withSessions([{ start: at(5, 9), end: at(5, 10), attack: [] }], 5 * MIN);
        const before = JSON.stringify(it);
        TimerSessions.ensure(it);
        expect(JSON.stringify(it)).toBe(before);
    });
    test('junk session entries are dropped and the total is rebuilt from what is valid', () => {
        const it = task({ timerSessions: [{ start: 5, end: 3 }, null, { start: at(5, 9), end: at(5, 10) }], timerUntimedMs: 'x', timerMsBanked: 99 });
        TimerSessions.ensure(it);
        expect(it.timerSessions).toHaveLength(1);
        expect(it.timerSessions[0].attack).toEqual([]);
        expect(it.timerUntimedMs).toBe(0);
        expect(it.timerMsBanked).toBe(HOUR);
    });
    test('sessions are kept oldest first', () => {
        const it = task({ timerSessions: [{ start: at(5, 14), end: at(5, 15), attack: [] }, { start: at(5, 9), end: at(5, 10), attack: [] }], timerUntimedMs: 0 });
        TimerSessions.ensure(it);
        expect(it.timerSessions.map(s => s.start)).toEqual([at(5, 9), at(5, 14)]);
    });
    test('null / non-objects are tolerated', () => {
        expect(TimerSessions.ensure(null)).toBeNull();
        expect(() => TimerSessions.ensure(undefined)).not.toThrow();
    });
});

describe('recording on stop / pause / autoStop', () => {
    test('stop appends one session and keeps the invariant', () => {
        const it = task();
        Timer.start(it, at(5, 14));
        Timer.stop(it, at(5, 14, 40));
        expect(it.timerSessions).toEqual([{ start: at(5, 14), end: at(5, 14, 40), attack: [] }]);
        expect(it.timerMsBanked).toBe(40 * MIN);
        expect(it.timerUntimedMs).toBe(0);
    });
    test('the first stop on an OLD item keeps the earlier banked time as untimed', () => {
        const it = task({ timerMsBanked: 30 * MIN });
        Timer.start(it, at(5, 14));
        Timer.stop(it, at(5, 14, 10));
        expect(it.timerUntimedMs).toBe(30 * MIN);
        expect(it.timerSessions).toHaveLength(1);
        expect(it.timerMsBanked).toBe(40 * MIN);
    });
    test('pause records a session too (and marks the item paused)', () => {
        const it = task();
        Timer.start(it, at(5, 9));
        Timer.pause(it, at(5, 9, 20));
        expect(it.timerPaused).toBe(true);
        expect(it.timerSessions).toHaveLength(1);
        Timer.start(it, at(5, 9, 30));
        Timer.stop(it, at(5, 9, 50));
        expect(it.timerSessions.map(s => s.end - s.start)).toEqual([20 * MIN, 20 * MIN]);
        expect(it.timerMsBanked).toBe(40 * MIN);
    });
    test('autoStop records the session up to the prompt, not to now', () => {
        const it = task();
        Timer.start(it, 0);
        Timer.markPrompted(it, 60 * MIN);
        Timer.autoStop(it, 70 * MIN);
        expect(it.timerSessions).toEqual([{ start: 0, end: 60 * MIN, attack: [] }]);
        expect(it.timerMsBanked).toBe(60 * MIN);
    });
    test('discardSession ("Started by mistake") records nothing', () => {
        const it = task();
        Timer.start(it, at(5, 9));
        Timer.discardSession(it, at(5, 9, 10));
        expect(it.timerSessions === undefined || it.timerSessions.length === 0).toBe(true);
        expect(it.timerMsBanked).toBe(0);
    });
    test('a span under one second is banked but goes into the untimed entry (no empty row)', () => {
        const it = task();
        Timer.start(it, 1000);
        Timer.stop(it, 1400);
        expect(it.timerSessions).toEqual([]);
        expect(it.timerUntimedMs).toBe(400);
        expect(it.timerMsBanked).toBe(400);
    });
    test('the span listener still gets the span (daily record seam unchanged)', () => {
        const seen = [];
        Timer.onSpan((i, ms) => seen.push(ms));
        const it = task();
        Timer.start(it, 0);
        Timer.stop(it, 5 * MIN);
        Timer.onSpan(null);
        expect(seen).toEqual([5 * MIN]);
    });
    test('a limit (Break habit) timer records sessions as well', () => {
        const it = { type: 'habit', isNegative: true, timerMinutes: 60, timer: null, timerMsBanked: 0 };
        Timer.start(it, at(5, 20));
        Timer.stop(it, at(5, 20, 25));
        expect(it.timerSessions).toHaveLength(1);
        expect(it.timerMsBanked).toBe(25 * MIN);
    });
});

describe('attack windows (the live loop reports whether the zombie is attacking)', () => {
    test('a window opens on the first attacking tick and closes on the first tick that is not attacking', () => {
        const it = task();
        Timer.start(it, 0);
        tick(it, 0, 10 * MIN - 10000, false);
        expect(it.timer.attackFrom == null).toBe(true);
        tick(it, 10 * MIN, 19 * MIN, true);
        Timer.trackAttack(it, 19 * MIN + 10000, false);
        expect(it.timer.attack).toEqual([[10 * MIN, 19 * MIN + 10000]]);
        Timer.stop(it, 30 * MIN);
        expect(it.timerSessions[0].attack).toEqual([[10 * MIN, 19 * MIN + 10000]]);
    });
    test('a window still open at stop is closed at the banked end', () => {
        const it = task();
        Timer.start(it, 0);
        tick(it, 5 * MIN, 25 * MIN, true);
        Timer.stop(it, 25 * MIN);
        expect(it.timerSessions[0].attack).toEqual([[5 * MIN, 25 * MIN]]);
    });
    test('an auto-stop clips the window to the banked end', () => {
        const it = task();
        Timer.start(it, 0);
        tick(it, 1 * MIN, 60 * MIN, true);
        Timer.markPrompted(it, 60 * MIN);
        Timer.autoStop(it, 70 * MIN);
        expect(it.timerSessions[0].attack).toEqual([[1 * MIN, 60 * MIN]]);
    });
    test('a gap in the ticks (app closed or phone asleep) ends the window where it was last seen', () => {
        const it = task();
        Timer.start(it, 0);
        tick(it, 5 * MIN, 5 * MIN + 20000, true);
        // 2 hours later, the app is open again and the zombie is still attacking
        tick(it, 125 * MIN, 130 * MIN, true);
        Timer.stop(it, 130 * MIN);
        expect(it.timerSessions[0].attack).toEqual([[5 * MIN, 5 * MIN + 20000], [125 * MIN, 130 * MIN]]);
    });
    test('a stop long after the last tick does not credit the unseen time as attack', () => {
        const it = task();
        Timer.start(it, 0);
        tick(it, 5 * MIN, 6 * MIN, true);
        Timer.stop(it, 40 * MIN);
        expect(it.timerSessions[0].attack).toEqual([[5 * MIN, 6 * MIN]]);
    });
    test('tracking does nothing for an item with no running timer', () => {
        const it = task();
        expect(() => Timer.trackAttack(it, 5, true)).not.toThrow();
        expect(it.timer).toBeNull();
    });
    test('windows never start before the session started', () => {
        const it = task();
        Timer.start(it, 10 * MIN);
        Timer.trackAttack(it, 5 * MIN, true); // a stale clock reading
        Timer.stop(it, 20 * MIN);
        expect(it.timerSessions[0].attack.every(w => w[0] >= 10 * MIN)).toBe(true);
    });
});

describe('validate', () => {
    const it = () => withSessions([
        { start: at(5, 9), end: at(5, 10), attack: [] },
        { start: at(5, 14), end: at(5, 15), attack: [] },
    ]);
    test('a good span passes', () => {
        expect(TimerSessions.validate(it(), { start: at(5, 11), end: at(5, 12) }, { now: NOW }).ok).toBe(true);
    });
    test('stop must be after start', () => {
        expect(TimerSessions.validate(it(), { start: at(5, 12), end: at(5, 12) }, { now: NOW })).toEqual({ ok: false, reason: 'order' });
        expect(TimerSessions.validate(it(), { start: at(5, 13), end: at(5, 12) }, { now: NOW }).reason).toBe('order');
    });
    test('not in the future', () => {
        expect(TimerSessions.validate(it(), { start: at(5, 17), end: at(5, 18, 1) }, { now: NOW }).reason).toBe('future');
        expect(TimerSessions.validate(it(), { start: at(5, 17), end: at(5, 18) }, { now: NOW }).ok).toBe(true);
    });
    test('at most 24 hours', () => {
        const long = { start: at(3, 9), end: at(4, 9, 1) };
        expect(TimerSessions.validate(task(), long, { now: NOW }).reason).toBe('too-long');
        expect(TimerSessions.validate(task(), { start: at(3, 9), end: at(4, 9) }, { now: NOW }).ok).toBe(true);
    });
    test('the item total stays within 24 hours', () => {
        const big = withSessions([{ start: at(1, 0), end: at(1, 20), attack: [] }]);
        expect(TimerSessions.validate(big, { start: at(2, 0), end: at(2, 6) }, { now: NOW }).reason).toBe('total-cap');
    });
    test('overlap with ANOTHER session of the same item is refused; touching ends are fine', () => {
        expect(TimerSessions.validate(it(), { start: at(5, 9, 30), end: at(5, 10, 30) }, { now: NOW }).reason).toBe('overlap');
        expect(TimerSessions.validate(it(), { start: at(5, 10), end: at(5, 14) }, { now: NOW }).ok).toBe(true);
    });
    test('editing a session may overlap its own old span', () => {
        expect(TimerSessions.validate(it(), { start: at(5, 8, 30), end: at(5, 10, 30) }, { now: NOW, index: 0 }).ok).toBe(true);
    });
    test('junk numbers are invalid', () => {
        expect(TimerSessions.validate(it(), { start: NaN, end: 5 }, { now: NOW }).reason).toBe('invalid');
        expect(TimerSessions.validate(it(), null, { now: NOW }).reason).toBe('invalid');
    });
    test('an old item is normalised first (its banked time counts toward the total cap)', () => {
        const old = task({ timerMsBanked: 23 * HOUR });
        expect(TimerSessions.validate(old, { start: at(5, 9), end: at(5, 11) }, { now: NOW }).reason).toBe('total-cap');
    });
});

describe('add', () => {
    test('adds a session, keeps the order, recomputes the total, never charges', () => {
        const it = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }], 10 * MIN);
        const r = TimerSessions.apply(it, { type: 'add', start: at(5, 9), end: at(5, 10) }, { now: NOW });
        expect(r.ok).toBe(true);
        expect(r.chargeHp).toBe(0);
        expect(it.timerSessions.map(s => s.start)).toEqual([at(5, 9), at(5, 14)]);
        expect(it.timerMsBanked).toBe(2 * HOUR + 10 * MIN);
        expect(r.deltaMs).toBe(HOUR);
    });
    test('an invalid add changes nothing', () => {
        const it = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }]);
        const before = JSON.stringify(it);
        const r = TimerSessions.apply(it, { type: 'add', start: at(5, 14, 30), end: at(5, 16) }, { now: NOW });
        expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'overlap' }));
        expect(JSON.stringify(it)).toBe(before);
    });
    test('an added session carries no attack windows (it can never be charged later for time that was not attacking)', () => {
        const it = task();
        TimerSessions.apply(it, { type: 'add', start: at(5, 9), end: at(5, 10) }, { now: NOW });
        expect(it.timerSessions[0].attack).toEqual([]);
    });
});

describe('edit', () => {
    const base = () => withSessions([{ start: at(5, 14), end: at(5, 15, 10), attack: [[at(5, 14, 20), at(5, 15, 10)]] }]);
    test('lengthening gives nothing back and charges nothing', () => {
        const it = base();
        const r = TimerSessions.apply(it, { type: 'edit', index: 0, start: at(5, 13, 30), end: at(5, 16) }, { now: NOW });
        expect(r.ok).toBe(true);
        expect(r.chargeHp).toBe(0);
        expect(r.deltaMs).toBe(80 * MIN);
        expect(it.timerMsBanked).toBe(2 * HOUR + 30 * MIN);
        expect(it.timerSessions[0].attack).toEqual([[at(5, 14, 20), at(5, 15, 10)]]); // unchanged
    });
    test('shortening over an attack charges 1 HP per 10 minutes removed, rounded down', () => {
        const it = base(); // attack 14:20-15:10
        // stop cut from 15:10 to 14:47 -> 23 min removed, all in the attack window -> 2 HP
        const r = TimerSessions.apply(it, { type: 'edit', index: 0, start: at(5, 14), end: at(5, 14, 47) }, { now: NOW });
        expect(r.chargeHp).toBe(2);
        expect(r.deltaMs).toBe(-23 * MIN);
        expect(it.timerMsBanked).toBe(47 * MIN);
    });
    test('under ten minutes of removed attack costs nothing', () => {
        const it = base();
        const r = TimerSessions.apply(it, { type: 'edit', index: 0, start: at(5, 14), end: at(5, 15, 1) }, { now: NOW });
        expect(r.chargeHp).toBe(0);
    });
    test('removed time OUTSIDE the attack windows costs nothing', () => {
        const it = base(); // attack starts 14:20, so the first 20 minutes were not attacking
        const r = TimerSessions.apply(it, { type: 'edit', index: 0, start: at(5, 14, 20), end: at(5, 15, 10) }, { now: NOW });
        expect(r.chargeHp).toBe(0);
        expect(r.deltaMs).toBe(-20 * MIN);
    });
    test('moving a session charges for the attack minutes that are no longer covered', () => {
        const it = base();
        const r = TimerSessions.apply(it, { type: 'edit', index: 0, start: at(5, 10), end: at(5, 11, 10) }, { now: NOW });
        // the whole 14:00-15:10 span is removed, 50 attack minutes -> 5 HP; the new span is not attacking
        expect(r.chargeHp).toBe(5);
        expect(it.timerSessions[0].attack).toEqual([]);
    });
    test('the attack windows are clipped to the new span, so a second edit cannot charge the same minutes twice', () => {
        const it = base();
        TimerSessions.apply(it, { type: 'edit', index: 0, start: at(5, 14), end: at(5, 14, 50) }, { now: NOW });
        expect(it.timerSessions[0].attack).toEqual([[at(5, 14, 20), at(5, 14, 50)]]);
        const r2 = TimerSessions.apply(it, { type: 'edit', index: 0, start: at(5, 14), end: at(5, 14, 50) }, { now: NOW });
        expect(r2.chargeHp).toBe(0);
    });
    test('the charge preview matches the applied charge and changes nothing', () => {
        const it = base();
        const before = JSON.stringify(it);
        const p = TimerSessions.preview(it, { type: 'edit', index: 0, start: at(5, 14), end: at(5, 14, 40) }, { now: NOW });
        expect(JSON.stringify(it)).toBe(before);
        const r = TimerSessions.apply(it, { type: 'edit', index: 0, start: at(5, 14), end: at(5, 14, 40) }, { now: NOW });
        expect(p.chargeHp).toBe(r.chargeHp);
        expect(p.deltaMs).toBe(r.deltaMs);
    });
    test('an invalid edit (overlap) changes nothing', () => {
        const it = withSessions([
            { start: at(5, 9), end: at(5, 10), attack: [] },
            { start: at(5, 14), end: at(5, 15), attack: [] },
        ]);
        const before = JSON.stringify(it);
        const r = TimerSessions.apply(it, { type: 'edit', index: 1, start: at(5, 9, 30), end: at(5, 15) }, { now: NOW });
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('overlap');
        expect(JSON.stringify(it)).toBe(before);
    });
    test('a bad index is refused', () => {
        const it = base();
        expect(TimerSessions.apply(it, { type: 'edit', index: 4, start: at(5, 14), end: at(5, 15) }, { now: NOW }).ok).toBe(false);
    });
    test('editing re-sorts when a session moves past another', () => {
        const it = withSessions([
            { start: at(5, 9), end: at(5, 10), attack: [] },
            { start: at(5, 14), end: at(5, 15), attack: [] },
        ]);
        TimerSessions.apply(it, { type: 'edit', index: 0, start: at(5, 16), end: at(5, 17) }, { now: NOW });
        expect(it.timerSessions.map(s => s.start)).toEqual([at(5, 14), at(5, 16)]);
    });
});

describe('delete', () => {
    test('deleting an attacking session charges its attack minutes', () => {
        const it = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [[at(5, 14), at(5, 15)]] }], 15 * MIN);
        const r = TimerSessions.apply(it, { type: 'delete', index: 0 }, { now: NOW });
        expect(r.ok).toBe(true);
        expect(r.chargeHp).toBe(6);
        expect(r.deltaMs).toBe(-HOUR);
        expect(it.timerSessions).toEqual([]);
        expect(it.timerMsBanked).toBe(15 * MIN);
    });
    test('deleting a session that was not attacking is free', () => {
        const it = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }]);
        const r = TimerSessions.apply(it, { type: 'delete', index: 0 }, { now: NOW });
        expect(r.chargeHp).toBe(0);
        expect(it.timerMsBanked).toBe(0);
    });
    test('an old item\'s untimed entry is never touched by deleting a session', () => {
        const it = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }], 30 * MIN);
        TimerSessions.apply(it, { type: 'delete', index: 0 }, { now: NOW });
        expect(it.timerUntimedMs).toBe(30 * MIN);
    });
});

describe('capCharge (the 1 HP floor)', () => {
    test('the church never drops below 1 HP from a correction', () => {
        expect(TimerSessions.capCharge(7, 50)).toBe(7);
        expect(TimerSessions.capCharge(7, 5)).toBe(4);
        expect(TimerSessions.capCharge(7, 1)).toBe(0);
        expect(TimerSessions.capCharge(7, 0)).toBe(0);
        expect(TimerSessions.capCharge(0, 50)).toBe(0);
        expect(TimerSessions.capCharge(-3, 50)).toBe(0);
        expect(TimerSessions.capCharge('x', 50)).toBe(0);
    });
});

describe('setTotal (the typable total)', () => {
    test('typing a total changes only the untimed entry', () => {
        const it = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }], 10 * MIN);
        const r = TimerSessions.setTotal(it, 90 * MIN);
        expect(r.ok).toBe(true);
        expect(it.timerUntimedMs).toBe(30 * MIN);
        expect(it.timerMsBanked).toBe(90 * MIN);
        expect(r.deltaMs).toBe(20 * MIN);
        expect(it.timerSessions).toHaveLength(1);
    });
    test('a total below the timed sessions is refused and changes nothing', () => {
        const it = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }], 10 * MIN);
        const r = TimerSessions.setTotal(it, 30 * MIN);
        expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'below-timed' }));
        expect(it.timerMsBanked).toBe(70 * MIN);
    });
    test('exactly the timed sum is allowed (untimed becomes 0)', () => {
        const it = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }], 10 * MIN);
        expect(TimerSessions.setTotal(it, HOUR).ok).toBe(true);
        expect(it.timerUntimedMs).toBe(0);
    });
    test('an old item (no sessions) takes any total from 0 to 24 h', () => {
        const it = task({ timerMsBanked: 45 * MIN });
        expect(TimerSessions.setTotal(it, 20 * MIN).ok).toBe(true);
        expect(it.timerMsBanked).toBe(20 * MIN);
        expect(it.timerUntimedMs).toBe(20 * MIN);
        expect(TimerSessions.setTotal(it, 0).ok).toBe(true);
        expect(it.timerMsBanked).toBe(0);
    });
    test('over 24 hours or junk is refused', () => {
        const it = task();
        expect(TimerSessions.setTotal(it, 25 * HOUR).reason).toBe('too-long');
        expect(TimerSessions.setTotal(it, NaN).reason).toBe('invalid');
        expect(TimerSessions.setTotal(it, -5).reason).toBe('invalid');
    });
    test('it never charges', () => {
        const it = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [[at(5, 14), at(5, 15)]] }]);
        expect(TimerSessions.setTotal(it, 2 * HOUR).chargeHp).toBe(0);
    });
});

describe('Timer.setLogged (legacy total edit) keeps the invariant', () => {
    test('raising the total grows the untimed entry', () => {
        const it = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }]);
        expect(Timer.setLogged(it, 90 * MIN)).toBe(30 * MIN);
        expect(it.timerUntimedMs).toBe(30 * MIN);
        expect(it.timerMsBanked).toBe(90 * MIN);
    });
    test('lowering it below the timed sessions collapses them into the untimed entry (Build B replaces this with a refusal)', () => {
        const it = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }], 10 * MIN);
        expect(Timer.setLogged(it, 20 * MIN)).toBe(-50 * MIN);
        expect(it.timerSessions).toEqual([]);
        expect(it.timerUntimedMs).toBe(20 * MIN);
        expect(it.timerMsBanked).toBe(20 * MIN);
    });
    test('an item with no session fields behaves exactly as before', () => {
        const it = task({ timerMsBanked: 5 * MIN });
        expect(Timer.setLogged(it, 12 * MIN)).toBe(7 * MIN);
        expect(it.timerMsBanked).toBe(12 * MIN);
    });
});

describe('day deltas (a session counts on the day it ends)', () => {
    const key = TimerSessions.dayKey;
    test('dayKey is the local date', () => {
        expect(key(at(5, 23, 59))).toBe('2026-11-05');
        expect(key(at(6, 0, 0))).toBe('2026-11-06');
    });
    test('an edit that stays on one day nets the length change on that day', () => {
        const it = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }]);
        const r = TimerSessions.apply(it, { type: 'edit', index: 0, start: at(5, 14), end: at(5, 15, 30) }, { now: NOW });
        expect(r.dayDeltas).toEqual({ '2026-11-05': 30 * MIN });
    });
    test('moving the stop across midnight moves the whole session to the new day', () => {
        const it = withSessions([{ start: at(4, 23), end: at(4, 23, 50), attack: [] }]);
        const r = TimerSessions.apply(it, { type: 'edit', index: 0, start: at(4, 23), end: at(5, 0, 30) }, { now: NOW });
        expect(r.dayDeltas).toEqual({ '2026-11-04': -50 * MIN, '2026-11-05': 90 * MIN });
    });
    test('delete takes the minutes off the day it ended on', () => {
        const it = withSessions([{ start: at(3, 9), end: at(3, 10), attack: [] }]);
        const r = TimerSessions.apply(it, { type: 'delete', index: 0 }, { now: NOW });
        expect(r.dayDeltas).toEqual({ '2026-11-03': -HOUR });
    });
    test('add puts the minutes on its end day', () => {
        const it = task();
        const r = TimerSessions.apply(it, { type: 'add', start: at(2, 9), end: at(2, 9, 45) }, { now: NOW });
        expect(r.dayDeltas).toEqual({ '2026-11-02': 45 * MIN });
    });
    test('a zero net change leaves no entry', () => {
        const it = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }]);
        const r = TimerSessions.apply(it, { type: 'edit', index: 0, start: at(5, 13), end: at(5, 14) }, { now: NOW });
        expect(r.dayDeltas).toEqual({});
    });
});

describe('numbers come from CONFIG with sane defaults', () => {
    test('HP charge = the damage a running timer skipped: interval / (1 - factor); 5 min / 0.5 = 10 min per HP', () => {
        expect(TimerSessions.chargeIntervalMs()).toBe(10 * MIN);
        expect(TimerSessions.chargeIntervalMs({ DAMAGE_INTERVAL_MS: 5 * MIN, WORK_TIMER_DAMAGE_FACTOR: 0.25 })).toBe(400000); // 1 HP per 6 min 40 s
        expect(TimerSessions.chargeIntervalMs({ DAMAGE_INTERVAL_MS: 5 * MIN, WORK_TIMER_DAMAGE_FACTOR: 1 })).toBe(Infinity); // no halving, so nothing to take back
    });
});

describe('view (read-only picture for the Sessions list)', () => {
    test('lists sessions oldest first with their apply index, and the untimed entry', () => {
        const it = withSessions([{ start: at(5, 14), end: at(5, 15), attack: [] }, { start: at(5, 9), end: at(5, 10), attack: [] }], 5 * MIN);
        const v = TimerSessions.view(it);
        expect(v.sessions.map(s => [s.index, s.start])).toEqual([[0, at(5, 9)], [1, at(5, 14)]]);
        expect(v.timedMs).toBe(2 * HOUR);
        expect(v.untimedMs).toBe(5 * MIN);
        expect(v.totalMs).toBe(2 * HOUR + 5 * MIN);
    });
    test('an old item shows all its banked time as untimed and is NOT rewritten', () => {
        const it = task({ timerMsBanked: 45 * MIN });
        const v = TimerSessions.view(it);
        expect(v).toEqual({ sessions: [], timedMs: 0, untimedMs: 45 * MIN, totalMs: 45 * MIN });
        expect(it.timerSessions).toBeUndefined();
    });
    test('null is tolerated', () => {
        expect(TimerSessions.view(null).totalMs).toBe(0);
    });
});

/**
 * Ice across a gap the live loop did not tick through (2026-11-27, Jeremy: "if i start a timer before the due date and switch to
 * another tab ... it applies the freeze from that moment even though it should have applied it from the moment they reached the
 * base"). A background tab / sleeping laptop / reload used to spend NO ice for the gap, so the zombie got a full fresh hour from the
 * moment the tab came back, while catch-up charged the whole gap at the full rate. Now catch-up spends the ice the zombie really
 * used (Ice.spendGap), skips that stretch, and charges the rest at the timer's half rate while the timer still counts.
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
global.Timer = require('../js/timer.js');
global.Ice = require('../js/ice.js');
global.Family = require('../js/family.js');
const Damage = require('../js/damage.js');

const MIN = 60000;
const T0 = new Date('2026-11-27T09:00:00').getTime();
const BUDGET = CONFIG.ICE_MAX_MS;            // 60 min
const BASE = CONFIG.DAMAGE_INTERVAL_MS;      // 5 min
const HALF = BASE / CONFIG.WORK_TIMER_DAMAGE_FACTOR; // 10 min

let nextId = 1;
const running = (at) => ({ startedAt: at, checkedAt: at, promptedAt: null });
function mk(overrides = {}) {
    return Object.assign({
        id: nextId++, type: 'task', isOverdue: true, dueDateTime: new Date(T0), lastDamageTickTime: T0, x: 0,
        element: null, timer: null, timerPaused: false, timerMsBanked: 0, iceUsedMs: 0,
    }, overrides);
}
// An item that the live loop saw iced at `atMs` (its last tick before the tab went to the background).
function icedAt(atMs, overrides = {}) {
    const item = mk(Object.assign({ dueDateTime: new Date(atMs), lastDamageTickTime: atMs, timer: running(atMs - MIN) }, overrides));
    expect(Ice.tick(item, atMs).iced).toBe(true);
    return item;
}

describe('Ice.spendGap', () => {
    test('THE BUG: away 20 min while iced -> 20 min of ice is spent, 40 left (not a fresh 60)', () => {
        const item = icedAt(T0);
        const w = Ice.spendGap(item, undefined, T0 + 20 * MIN);
        expect(w).toEqual({ fromMs: T0, untilMs: T0 + 20 * MIN, spentMs: 20 * MIN });
        expect(item.iceUsedMs).toBe(20 * MIN);
        expect(Ice.state(item, T0 + 20 * MIN).leftMs).toBe(40 * MIN);
    });

    test('the zombie reached the base WHILE away: ice counts from its due time, not from the return', () => {
        const due = T0 + 10 * MIN;
        const item = mk({ dueDateTime: new Date(due), timer: running(T0 - 5 * MIN) }); // timer started before the due time
        const w = Ice.spendGap(item, undefined, T0 + 40 * MIN);
        expect(w.fromMs).toBe(due);
        expect(item.iceUsedMs).toBe(30 * MIN);
    });

    test('away longer than the budget: all of it is spent and the next tick reports the thaw at the real moment', () => {
        const item = icedAt(T0);
        const now = T0 + 2 * 60 * MIN;
        const w = Ice.spendGap(item, undefined, now);
        expect(w.untilMs).toBe(T0 + BUDGET);
        expect(item.iceUsedMs).toBe(BUDGET);
        const t = Ice.tick(item, now);
        expect(t.iced).toBe(false);
        expect(t.thawed).toBe(true);
        expect(t.thawAtMs).toBe(T0 + BUDGET);
        expect(t.episodeMs).toBe(BUDGET);
    });

    test('the tick right after spendGap does not spend the gap again', () => {
        const item = icedAt(T0);
        Ice.spendGap(item, undefined, T0 + 20 * MIN);
        Ice.tick(item, T0 + 20 * MIN + 50);
        expect(item.iceUsedMs).toBe(20 * MIN + 50);
    });

    test('a budget already part-used only spends what is left', () => {
        const item = icedAt(T0, { iceUsedMs: 50 * MIN });
        const w = Ice.spendGap(item, undefined, T0 + 30 * MIN);
        expect(w.spentMs).toBe(10 * MIN);
        expect(item.iceUsedMs).toBe(BUDGET);
    });

    test('a paused timer: the ice lasts only the pause grace', () => {
        const item = mk({ timer: null, timerPaused: true, icePausedAt: T0 });
        const w = Ice.spendGap(item, T0, T0 + 30 * MIN);
        expect(w.spentMs).toBe(CONFIG.ICE_GRACE_MS);
    });

    test('no timer, not at the base, or no budget -> nothing spent', () => {
        expect(Ice.spendGap(mk(), undefined, T0 + 10 * MIN)).toBeNull();
        expect(Ice.spendGap(mk({ isOverdue: false, timer: running(T0) }), undefined, T0 + 10 * MIN)).toBeNull();
        expect(Ice.spendGap(mk({ timer: running(T0), iceUsedMs: BUDGET }), undefined, T0 + 10 * MIN)).toBeNull();
    });
});

describe('live-gap catch-up with a timer running', () => {
    test('away 20 min while iced: no damage, clock moves to now, 40 min of ice left', () => {
        const item = icedAt(T0);
        const now = T0 + 20 * MIN;
        const { hits } = Damage.computeGapCatchUpHits([item], now);
        expect(hits).toEqual([]);
        expect(item.lastDamageTickTime).toBe(now);
        expect(Ice.leftMs(item, now)).toBe(40 * MIN);
    });

    test('away 65 min: 60 iced, then 5 min at the half rate (no whole hit yet), clock parked at the thaw', () => {
        const item = icedAt(T0, { timer: running(T0 - MIN) });
        const now = T0 + 65 * MIN;
        const { hits } = Damage.computeGapCatchUpHits([item], now);
        expect(hits).toEqual([]);
        expect(item.lastDamageTickTime).toBe(T0 + BUDGET);
        expect(Ice.state(item, now).iced).toBe(false);
    });

    test('away 90 min, "Still working?" never answered: 60 iced, then full rate after the timer would have auto-stopped', () => {
        // Timer started at T0-1min: the prompt was due at T0+59 and auto-stop banks only up to then, so after the ice (T0+60)
        // there is no half rate left: 30 min at the full 5-min interval = 6 hits.
        const item = icedAt(T0, { timer: running(T0 - MIN) });
        const now = T0 + 90 * MIN;
        const { hits } = Damage.computeGapCatchUpHits([item], now);
        expect(hits.map(h => h.dmg)).toEqual([6 * CONFIG.OVERDUE_DAMAGE]);
        expect(item.lastDamageTickTime).toBe(now);
    });

    test('timer still counting after the ice: the rest is charged at the half rate', () => {
        const item = icedAt(T0, { timer: running(T0 - MIN) });
        item.timer.checkedAt = T0 + 30 * MIN; // answered "Still working?" -> prompt due at T0+90
        const now = T0 + 90 * MIN;
        const { hits } = Damage.computeGapCatchUpHits([item], now);
        expect(hits.map(h => h.dmg)).toEqual([3 * CONFIG.OVERDUE_DAMAGE]); // 30 min / 10 min
    });

    test('no timer: catch-up is unchanged (full rate from the damage clock)', () => {
        const item = mk({ lastDamageTickTime: T0 });
        const { hits } = Damage.computeGapCatchUpHits([item], T0 + 30 * MIN);
        expect(hits.map(h => h.dmg)).toEqual([6 * CONFIG.OVERDUE_DAMAGE]);
    });

    test('the live loop keeps the catch-up clock at the thaw (no reset to "now")', () => {
        const item = icedAt(T0, { timer: running(T0 - MIN) });
        const now = T0 + 65 * MIN;
        Damage.computeGapCatchUpHits([item], now);
        const t = Ice.tick(item, now);
        expect(t.thawed).toBe(true);
        expect(t.thawAtMs).toBe(T0 + BUDGET);
    });
});

describe('reload (offline) catch-up with a timer left running', () => {
    function deps(items, state) {
        return {
            isGameOver: () => false, getActiveItems: () => items, calculateTimelineXWithClustering: () => 500,
            baseWidth: 100, gameScreenWidth: 1200, setOfflineCatchUpActive: () => {},
            getBaseHealth: () => state.hp, setBaseHealth: (n) => { state.hp = n; }, setGameOver: () => {},
            getRunStartedAtMs: () => T0 - 24 * 60 * MIN, setDaysSurvived: () => {}, getGameLoopInterval: () => null,
            baseElement: null, baseHealthDisplay: null, gameOverMessage: null, restartButton: null,
            enableFormControls: () => {}, saveGame: () => {},
        };
    }
    afterEach(() => jest.useRealTimers());

    test('closed for 90 min, zombie due 80 min ago, timer started 100 min ago: iced from the due time, 4 hits after', () => {
        jest.useFakeTimers({ now: T0 });
        const due = T0 - 80 * MIN;
        const item = mk({ dueDateTime: new Date(due), lastDamageTickTime: T0, timer: running(T0 - 100 * MIN) });
        const state = { hp: 100 };
        Damage.runOfflineCatchUp([{ item, savedX: null }], 90 * MIN, deps([item], state));
        // Iced T0-80 .. T0-20 (60 min). The timer's prompt was due at T0-40 and never answered, so it stopped counting at T0-40:
        // the last 20 min hit at the full rate = 4.
        expect(item.iceUsedMs).toBe(BUDGET);
        expect(item.offlineDamageCharged).toBe(4 * CONFIG.OVERDUE_DAMAGE);
        expect(item.lastDamageTickTime).toBe(T0);
    });

    test('closed for 30 min with the zombie iced the whole time: no damage, 30 min of ice left', () => {
        jest.useFakeTimers({ now: T0 });
        const item = mk({ dueDateTime: new Date(T0 - 40 * MIN), lastDamageTickTime: T0, timer: running(T0 - 45 * MIN) });
        Damage.runOfflineCatchUp([{ item, savedX: null, savedTickMs: T0 - 30 * MIN }], 30 * MIN, deps([item], { hp: 100 }));
        expect(item.iceUsedMs).toBe(30 * MIN);
        expect(item.offlineDamageCharged || 0).toBe(0);
        expect(Ice.leftMs(item, T0)).toBe(30 * MIN);
    });
});

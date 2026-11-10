/**
 * Ice x the live loop (docs/ICE_PLAN.md): an iced attacker deals no base or routine damage, its damage clock keeps moving so catch-up
 * never charges the iced time, regen stays paused, and it attacks at the timer's half rate once the ice is spent.
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
global.Timer = require('../js/timer.js');
global.Ice = require('../js/ice.js');
const Loop = require('../js/loop.js');

const MIN = 60000;
const INTERVAL = CONFIG.DAMAGE_INTERVAL_MS;
const DMG = CONFIG.OVERDUE_DAMAGE;
const T0 = new Date('2026-11-10T09:00:00').getTime();

function fakeEl() {
    const classes = new Set();
    return { style: {}, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c), _classes: classes } };
}
function atBase(overrides = {}) {
    return Object.assign({
        id: 1, type: 'task', isOverdue: true, dueDateTime: new Date(T0 - 60 * MIN), lastDamageTickTime: T0, x: 0, element: fakeEl(),
        timer: null, timerPaused: false, timerMsBanked: 0,
    }, overrides);
}
const running = (at) => ({ startedAt: at, checkedAt: at, promptedAt: null });

function makeDeps(items, extra = {}) {
    const state = { damage: 0, heal: 0, routineHits: 0, ice: [], lastRegen: null };
    return {
        _state: state,
        isGameOver: () => false,
        isOfflineCatchUpActive: () => false,
        isTimePreviewActive: () => false,
        activeItems: items,
        baseWidth: 100,
        gameScreenWidth: 1200,
        getLastLoopTickMs: () => null,
        setLastLoopTickMs: () => {},
        getLastRegenTickMs: () => state.lastRegen,
        setLastRegenTickMs: (n) => { state.lastRegen = n; },
        getLastAutosaveMs: () => 0,
        setLastAutosaveMs: () => {},
        markAsOverdue: () => {},
        getSubTaskClusterOffset: () => 0,
        calculateTimelineXWithClustering: () => 500,
        damageBase: (n) => { state.damage += n; },
        damageRoutineForItem: () => { state.routineHits += 1; },
        healBase: (n) => { state.heal += n; },
        updateMidnightLine: () => {},
        runLiveGapCatchUp: () => {},
        saveGame: () => {},
        isNonThreatening: (i) => i.type === 'habit' && i.isNegative === true,
        recordIce: (p) => state.ice.push(p),
        ...extra,
    };
}
// Runs the loop once a second from `from` to `to` (inclusive) on a faked clock.
function run(deps, from, to, each) {
    for (let t = from; t <= to; t += 1000) {
        jest.setSystemTime(t);
        Loop.updateActiveItems(deps);
        if (each) each(t);
    }
}

beforeEach(() => { jest.useFakeTimers({ now: T0 }); });
afterEach(() => { jest.useRealTimers(); });

describe('an iced attacker', () => {
    test('deals no base damage and no routine damage while its timer runs; an idle attacker beside it still hits', () => {
        const worked = atBase({ id: 1, timer: running(T0) });
        const idle = atBase({ id: 2 });
        const deps = makeDeps([worked, idle]);
        run(deps, T0, T0 + 30 * MIN);
        // idle: one hit per 5 min -> 6 hits; worked: none
        expect(deps._state.damage).toBe(6 * DMG);
        expect(deps._state.routineHits).toBe(6);
    });
    test('the damage clock keeps moving while iced, so catch-up never charges the iced time', () => {
        const worked = atBase({ timer: running(T0) });
        const deps = makeDeps([worked]);
        run(deps, T0, T0 + 20 * MIN);
        expect(worked.lastDamageTickTime).toBe(T0 + 20 * MIN);
    });
    test('Stop thaws it: no back-charge, and the next hit is one full interval later', () => {
        const worked = atBase({ timer: running(T0) });
        const deps = makeDeps([worked]);
        run(deps, T0, T0 + 20 * MIN);
        Timer.stop(worked, T0 + 20 * MIN);
        run(deps, T0 + 20 * MIN + 1000, T0 + 20 * MIN + INTERVAL - 1000);
        expect(deps._state.damage).toBe(0);
        run(deps, T0 + 20 * MIN + INTERVAL, T0 + 20 * MIN + INTERVAL + 2000);
        expect(deps._state.damage).toBe(DMG);
    });
    test('the ice is spent after ICE_MAX_MS: then it attacks at the timer\'s HALF rate (one hit per 2 intervals), never zero', () => {
        const worked = atBase({ timer: running(T0) });
        const deps = makeDeps([worked]);
        const cap = T0 + CONFIG.ICE_MAX_MS;
        run(deps, T0, cap);
        expect(deps._state.damage).toBe(0);
        run(deps, cap + 1000, cap + 2 * INTERVAL - 1000);
        expect(deps._state.damage).toBe(0);
        run(deps, cap + 2 * INTERVAL, cap + 2 * INTERVAL + 2000);
        expect(deps._state.damage).toBe(DMG);
    });
    test('the budget is per item: stop and start again does not refill it', () => {
        const worked = atBase({ timer: running(T0) });
        const deps = makeDeps([worked]);
        run(deps, T0, T0 + 40 * MIN);
        Timer.stop(worked, T0 + 40 * MIN);
        run(deps, T0 + 40 * MIN + 1000, T0 + 41 * MIN);
        Timer.start(worked, T0 + 41 * MIN);
        const spentEnd = T0 + 41 * MIN + 20 * MIN; // 20 min of ice left
        run(deps, T0 + 41 * MIN + 1000, spentEnd + 2000);
        expect(worked.iceUsedMs).toBe(CONFIG.ICE_MAX_MS);
        expect(Ice.state(worked, spentEnd + 3000).iced).toBe(false);
    });
    test('regen stays paused: an iced zombie still counts as attacking', () => {
        const worked = atBase({ timer: running(T0) });
        const deps = makeDeps([worked]);
        run(deps, T0, T0 + 20 * MIN);
        expect(deps._state.heal).toBe(0);
    });
    test('a timer on a zombie that is still walking does not ice it, and nothing is recorded', () => {
        const walker = atBase({ isOverdue: false, dueDateTime: new Date(T0 + 3 * 60 * MIN), timer: running(T0) });
        const deps = makeDeps([walker]);
        run(deps, T0, T0 + 5 * MIN);
        expect(walker.element.classList.contains('enemy-iced')).toBe(false);
        expect(deps._state.ice).toEqual([]);
    });
    test('only the timed item is iced: the parent of a timed sub-task keeps attacking', () => {
        const parent = atBase({ id: 1 });
        const sub = atBase({ id: 2, parentId: 1, timer: running(T0) });
        const deps = makeDeps([parent, sub]);
        run(deps, T0, T0 + 10 * MIN);
        expect(deps._state.damage).toBe(2 * DMG);
        expect(parent.element.classList.contains('enemy-iced')).toBe(false);
        expect(sub.element.classList.contains('enemy-iced')).toBe(true);
    });
});

describe('ice look + record hooks', () => {
    test('enemy-iced while iced, enemy-thawing in the last stretch, both gone after the thaw', () => {
        const worked = atBase({ timer: running(T0), iceUsedMs: CONFIG.ICE_MAX_MS - 8 * MIN });
        const deps = makeDeps([worked]);
        run(deps, T0, T0 + 2 * MIN);
        expect(worked.element.classList.contains('enemy-iced')).toBe(true);
        expect(worked.element.classList.contains('enemy-thawing')).toBe(false);
        run(deps, T0 + 2 * MIN + 1000, T0 + 4 * MIN);
        expect(worked.element.classList.contains('enemy-thawing')).toBe(true);
        expect(worked.element.classList.contains('enemy-iced')).toBe(false);
        run(deps, T0 + 4 * MIN + 1000, T0 + 9 * MIN);
        expect(worked.element.classList.contains('enemy-thawing')).toBe(false);
        expect(worked.element.classList.contains('enemy-iced')).toBe(false);
    });
    test('recordIce fires ONCE, at the thaw, with the episode length', () => {
        const worked = atBase({ timer: running(T0) });
        const deps = makeDeps([worked]);
        run(deps, T0, T0 + 10 * MIN);
        expect(deps._state.ice).toEqual([]);
        Timer.stop(worked, T0 + 10 * MIN);
        run(deps, T0 + 10 * MIN + 1000, T0 + 10 * MIN + 3000);
        expect(deps._state.ice).toHaveLength(1);
        expect(deps._state.ice[0].ms).toBe(10 * MIN);
    });
    test('the timer\'s attack windows still open for an iced zombie (a later shortening charges back at the half rate)', () => {
        const worked = atBase({ timer: running(T0) });
        const deps = makeDeps([worked]);
        run(deps, T0, T0 + MIN);
        expect(typeof worked.timer.attackFrom).toBe('number');
    });
    test('recordIce is optional: the loop runs without it', () => {
        const worked = atBase({ timer: running(T0) });
        const deps = makeDeps([worked]);
        delete deps.recordIce;
        Timer.stop(worked, T0 + 5);
        expect(() => run(deps, T0, T0 + 5000)).not.toThrow();
    });
});

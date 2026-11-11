/**
 * @jest-environment jsdom
 */
/**
 * Ice art x the live loop (docs/ICE_PLAN.md "Art", 2026-11-10): the loop moves the overlay on the same phase change that sets
 * .enemy-iced / .enemy-thawing. Real IceOverlay, real Ice, real Timer, jsdom elements.
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
global.Timer = require('../js/timer.js');
global.Ice = require('../js/ice.js');
global.IceOverlay = require('../js/iceOverlay.js');
const Loop = require('../js/loop.js');

const MIN = 60000;
const T0 = new Date('2026-11-10T09:00:00').getTime();

function enemyEl() {
    const el = document.createElement('div');
    el.className = 'enemy';
    const sprite = document.createElement('div');
    sprite.className = 'enemy-sprite';
    el.appendChild(sprite);
    return el;
}
function atBase(overrides = {}) {
    return Object.assign({
        id: 1, type: 'task', isOverdue: true, dueDateTime: new Date(T0 - 60 * MIN), lastDamageTickTime: T0, x: 0, element: enemyEl(),
        timer: null, timerPaused: false, timerMsBanked: 0,
    }, overrides);
}
const running = (at) => ({ startedAt: at, checkedAt: at, promptedAt: null });
function makeDeps(items) {
    return {
        isGameOver: () => false, isOfflineCatchUpActive: () => false, isTimePreviewActive: () => false,
        activeItems: items, baseWidth: 100, gameScreenWidth: 1200,
        getLastLoopTickMs: () => null, setLastLoopTickMs: () => {}, getLastRegenTickMs: () => null, setLastRegenTickMs: () => {},
        getLastAutosaveMs: () => 0, setLastAutosaveMs: () => {}, markAsOverdue: () => {}, getSubTaskClusterOffset: () => 0,
        calculateTimelineXWithClustering: () => 500, damageBase: () => {}, damageRoutineForItem: () => {}, healBase: () => {},
        updateMidnightLine: () => {}, runLiveGapCatchUp: () => {}, saveGame: () => {},
        isNonThreatening: (i) => i.type === 'habit' && i.isNegative === true, recordIce: () => {},
    };
}
function run(deps, from, to) {
    for (let t = from; t <= to; t += 1000) { jest.setSystemTime(t); Loop.updateActiveItems(deps); }
}
const overlay = (it) => it.element.querySelector(':scope > .ice-overlay');

beforeEach(() => { jest.useFakeTimers({ now: T0 }); document.body.className = ''; });
afterEach(() => { jest.useRealTimers(); });

describe('the loop drives the ice overlay', () => {
    test('a timer on a zombie at the church: the overlay forms, then holds; the .enemy-iced class and the overlay move together', () => {
        const it = atBase({ timer: running(T0) });
        const deps = makeDeps([it]);
        run(deps, T0, T0 + 1000);
        expect(it.element.classList.contains('enemy-iced')).toBe(true);
        expect(overlay(it).classList.contains('ice-forming')).toBe(true);
        jest.advanceTimersByTime(IceOverlay.FORM_MS);
        expect(overlay(it).classList.contains('ice-hold')).toBe(true);
    });
    test('ticking on does not touch the overlay (no DOM churn per tick)', () => {
        const it = atBase({ timer: running(T0) });
        const deps = makeDeps([it]);
        run(deps, T0, T0 + 1000);
        const node = overlay(it);
        run(deps, T0 + 2000, T0 + 30000);
        expect(overlay(it)).toBe(node);
        expect(it.element.querySelectorAll('.ice-overlay')).toHaveLength(1);
    });
    test('the last stretch of the budget (.enemy-thawing) shows the cracked frame', () => {
        const it = atBase({ timer: running(T0), iceUsedMs: CONFIG.ICE_MAX_MS - 8 * MIN });
        const deps = makeDeps([it]);
        run(deps, T0, T0 + 2 * MIN);
        jest.advanceTimersByTime(IceOverlay.FORM_MS);
        expect(overlay(it).classList.contains('ice-hold')).toBe(true);
        run(deps, T0 + 2 * MIN + 1000, T0 + 4 * MIN);
        expect(it.element.classList.contains('enemy-thawing')).toBe(true);
        expect(overlay(it).classList.contains('ice-cracked')).toBe(true);
    });
    test('Stop thaws it: the burst plays and the overlay is gone after the puddle fades; the zombie is not left iced', () => {
        const it = atBase({ timer: running(T0) });
        const deps = makeDeps([it]);
        run(deps, T0, T0 + 10 * MIN);
        Timer.stop(it, T0 + 10 * MIN);
        run(deps, T0 + 10 * MIN + 1000, T0 + 10 * MIN + 2000);
        expect(it.element.classList.contains('enemy-iced')).toBe(false);
        expect(overlay(it).classList.contains('ice-burst')).toBe(true);
        jest.advanceTimersByTime(IceOverlay.BURST_TOTAL_MS);
        expect(overlay(it)).toBeNull();
    });
    test('a zombie that was never iced never gets an overlay', () => {
        const idle = atBase({ id: 2 });
        const walker = atBase({ id: 3, isOverdue: false, dueDateTime: new Date(T0 + 180 * MIN), timer: running(T0) });
        const deps = makeDeps([idle, walker]);
        run(deps, T0, T0 + 5 * MIN);
        expect(overlay(idle)).toBeNull();
        expect(overlay(walker)).toBeNull();
    });
    test('only the timed item is iced: a sub-task\'s timer does not put ice on its parent', () => {
        const parent = atBase({ id: 1 });
        const sub = atBase({ id: 2, parentId: 1, timer: running(T0) });
        const deps = makeDeps([parent, sub]);
        run(deps, T0, T0 + 10 * MIN);
        expect(overlay(parent)).toBeNull();
        expect(overlay(sub)).not.toBeNull();
    });
    test('the thaw countdown badge stays on top of the overlay (the badge is appended after / z-indexed above it)', () => {
        const it = atBase({ timer: running(T0) });
        const deps = makeDeps([it]);
        run(deps, T0, T0 + 5000);
        expect(it.element.querySelector('.ice-countdown')).not.toBeNull();
        expect(it.element.querySelector('.ice-overlay')).not.toBeNull();
    });
    test('without IceOverlay (old pages / tests) the loop still sets the classes and does not throw', () => {
        const keep = global.IceOverlay;
        delete global.IceOverlay;
        const it = atBase({ timer: running(T0) });
        const deps = makeDeps([it]);
        expect(() => run(deps, T0, T0 + 3000)).not.toThrow();
        expect(it.element.classList.contains('enemy-iced')).toBe(true);
        global.IceOverlay = keep;
    });
});

/**
 * @jest-environment jsdom
 */
/**
 * Family damage (docs/FAMILY_DAMAGE_PLAN.md, 2026-11-11): a parent and its sub-tasks attack as ONE group.
 * Tier by attackers at the church (1-2 -> x1, 3-4 -> x1.5, 5+ -> x2), a timer on any member halves the family, a parent's timer
 * ices the whole family and a sub-task's timer ices only itself. Same pace in the live loop and in catch-up.
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
global.Timer = require('../js/timer.js');
global.Ice = require('../js/ice.js');
global.Family = require('../js/family.js');
const Loop = require('../js/loop.js');
const Damage = require('../js/damage.js');

const MIN = 60000;
const T0 = new Date('2026-11-11T09:00:00').getTime();
const BASE = CONFIG.DAMAGE_INTERVAL_MS;

let nextId = 1;
function mk(overrides = {}) {
    return Object.assign({
        id: nextId++, type: 'task', isOverdue: true, dueDateTime: new Date(T0 - 60 * MIN), lastDamageTickTime: T0, x: 0,
        element: null, timer: null, timerPaused: false, timerMsBanked: 0,
    }, overrides);
}
const running = (at) => ({ startedAt: at, checkedAt: at, promptedAt: null });
function family(subCount, subOverrides = {}) {
    const parent = mk();
    const subs = [];
    for (let i = 0; i < subCount; i++) subs.push(mk(Object.assign({ parentId: parent.id }, subOverrides)));
    return { parent, subs, all: [parent, ...subs] };
}

describe('Family (pure)', () => {
    test('tier multiplier: 1-2 -> 1, 3-4 -> 1.5, 5+ -> 2', () => {
        [[1, 1], [2, 1], [3, 1.5], [4, 1.5], [5, 2], [9, 2]].forEach(([n, m]) => expect(Family.tierMultiplier(n)).toBe(m));
        expect(Family.tier(2)).toBe(1); expect(Family.tier(3)).toBe(2); expect(Family.tier(5)).toBe(3);
    });
    test('a lone item keeps one zombie\'s interval', () => {
        const a = mk();
        expect(Family.intervalMs(a, [a], BASE)).toBe(BASE);
    });
    test('the parent counts: a parent + 1 sub is two attackers (each swings every 2x, total x1)', () => {
        const f = family(1);
        expect(Family.attackers(f.all, f.parent)).toHaveLength(2);
        expect(Family.intervalMs(f.parent, f.all, BASE)).toBe(2 * BASE);
    });
    test('a parent + 2 subs = 3 attackers: x1.5 total (interval 2x)', () => {
        const f = family(2);
        expect(Family.intervalMs(f.subs[0], f.all, BASE)).toBe(Math.round(BASE * 3 / 1.5));
    });
    test('a parent + 4 subs = 5 attackers: x2 total (interval 2.5x)', () => {
        const f = family(4);
        expect(Family.intervalMs(f.subs[1], f.all, BASE)).toBe(Math.round(BASE * 5 / 2));
    });
    test('sub-tasks not at the church do not count, nor do ghosts, lurkers, completed items or other families', () => {
        const f = family(4);
        f.subs[0].isOverdue = false;
        f.subs[1].koGhost = true;
        f.subs[2].completedAt = T0;
        const other = family(3);
        const all = f.all.concat(other.all);
        expect(Family.attackers(all, f.parent).map(i => i.id).sort()).toEqual([f.parent.id, f.subs[3].id].sort());
        const lurker = mk({ type: 'habit', isNegative: true, parentId: f.parent.id });
        expect(Family.attackers(all.concat(lurker), f.parent)).toHaveLength(2);
    });
    test('a timer on ANY member halves the whole family (interval doubles)', () => {
        const f = family(2);
        f.subs[1].timer = running(T0);
        const opts = { timers: true };
        expect(Family.timerOn(f.all, f.parent)).toBe(true);
        expect(Family.intervalMs(f.parent, f.all, BASE, opts)).toBe(Math.round(BASE * 3 / 1.5 / 0.5));
        expect(Family.intervalMs(f.parent, f.all, BASE)).toBe(Math.round(BASE * 3 / 1.5)); // catch-up style: no timers
    });
    test('iced members do not count as attackers', () => {
        const f = family(2);
        const iced = (m) => m.id === f.subs[0].id;
        expect(Family.attackers(f.all, f.parent, { isIced: iced })).toHaveLength(2);
    });
});

describe('Ice x family', () => {
    test('a timer on the PARENT ices its sub-tasks at the church (holderFor)', () => {
        const f = family(2);
        f.parent.timer = running(T0);
        expect(Ice.holderFor(f.subs[0], f.all)).toBe(f.parent);
        expect(Ice.stateIn(f.subs[0], f.all, T0).iced).toBe(true);
        expect(Ice.stateIn(f.parent, f.all, T0).iced).toBe(true);
    });
    test('a timer on a SUB-TASK ices only that sub-task', () => {
        const f = family(2);
        f.subs[0].timer = running(T0);
        expect(Ice.stateIn(f.subs[0], f.all, T0).iced).toBe(true);
        expect(Ice.stateIn(f.subs[1], f.all, T0).iced).toBe(false);
        expect(Ice.stateIn(f.parent, f.all, T0).iced).toBe(false);
    });
    test('a parent in its pause grace still ices its subs; once the grace ends they thaw', () => {
        const f = family(1);
        f.parent.timerPaused = true; f.parent.icePausedAt = T0;
        expect(Ice.stateIn(f.subs[0], f.all, T0 + MIN).iced).toBe(true);
        expect(Ice.stateIn(f.subs[0], f.all, T0 + CONFIG.ICE_GRACE_MS + 1).iced).toBe(false);
    });
    test('a sub-task that is not at the church is never iced', () => {
        const f = family(1);
        f.parent.timer = running(T0);
        f.subs[0].isOverdue = false;
        expect(Ice.stateIn(f.subs[0], f.all, T0).iced).toBe(false);
    });
});

function makeDeps(items, onHit) {
    return {
        isGameOver: () => false, isOfflineCatchUpActive: () => false, isTimePreviewActive: () => false,
        activeItems: items, baseWidth: 100, gameScreenWidth: 1200,
        getLastLoopTickMs: () => null, setLastLoopTickMs: () => {}, getLastRegenTickMs: () => null, setLastRegenTickMs: () => {},
        getLastAutosaveMs: () => 0, setLastAutosaveMs: () => {}, markAsOverdue: () => {}, getSubTaskClusterOffset: () => 0,
        calculateTimelineXWithClustering: () => 500, damageBase: (d) => onHit(d), damageRoutineForItem: () => {}, healBase: () => {},
        updateMidnightLine: () => {}, runLiveGapCatchUp: () => {}, saveGame: () => {},
        isNonThreatening: (i) => i.type === 'habit' && i.isNegative === true, recordIce: () => {},
    };
}
function hitsOver(items, minutes) {
    let total = 0;
    const deps = makeDeps(items, (d) => { total += d; });
    for (let t = T0; t <= T0 + minutes * MIN; t += 1000) { jest.setSystemTime(t); Loop.updateActiveItems(deps); }
    return total;
}
beforeEach(() => { jest.useFakeTimers({ now: T0 }); });
afterEach(() => { jest.useRealTimers(); });

describe('live loop: damage per hour at the church (one zombie alone = 12)', () => {
    test('one zombie: 12', () => { expect(hitsOver([mk()], 60)).toBe(12); });
    test('a parent + 1 sub (2 attackers): still 12, not 24', () => { expect(hitsOver(family(1).all, 60)).toBe(12); });
    test('a parent + 3 subs (4 attackers): x1.5 (over 2 hours: 36 vs 24; whole hits, so an hour can read a hit or two short)', () => {
        expect(hitsOver(family(3).all, 120)).toBe(36);
    });
    test('a parent + 5 subs (6 attackers): x2 (over 2 hours: 48 vs 24)', () => {
        expect(hitsOver(family(5).all, 120)).toBe(48);
    });
    test('a timer on one sub of a 4-attacker family: that sub is iced (no hits), the other three attack at x1.5 halved', () => {
        const f = family(3);
        f.subs[0].timer = running(T0);
        const d = hitsOver(f.all, 60);
        // 3 attackers, x1.5, halved -> 12 * 0.75 = 9 per hour
        expect(d).toBeGreaterThanOrEqual(7); expect(d).toBeLessThanOrEqual(10);
    });
    test('a timer on the PARENT ices the whole family: no damage while it runs', () => {
        const f = family(3);
        f.parent.timer = running(T0);
        expect(hitsOver(f.all, 50)).toBe(0);
    });
    test('the parent\'s ice runs out (budget 60 min): the family then swings at its halved tier pace', () => {
        const f = family(1);
        f.parent.timer = running(T0);
        const d = hitsOver(f.all, 120);
        // 60 min iced, 60 min at 2 attackers x1 halved = 6 total
        expect(d).toBeGreaterThanOrEqual(5); expect(d).toBeLessThanOrEqual(7);
    });
});

describe('catch-up (offline and live gap) uses the same tiers, never timers or ice', () => {
    function overdueFamily(subCount, minutesAgo) {
        const nowMs = T0;
        const f = family(subCount);
        f.all.forEach(i => { i.dueDateTime = new Date(nowMs - minutesAgo * MIN); i.lastDamageTickTime = nowMs - minutesAgo * MIN; });
        return { f, nowMs };
    }
    test('live-gap: a parent + 1 sub owes the same total as one zombie (12 per hour)', () => {
        const { f, nowMs } = overdueFamily(1, 60);
        const { hits } = Damage.computeGapCatchUpHits(f.all, nowMs);
        expect(hits.reduce((s, h) => s + h.dmg, 0)).toBe(12);
    });
    test('live-gap: a parent + 5 subs owes about x2', () => {
        const { f, nowMs } = overdueFamily(5, 60);
        const { hits } = Damage.computeGapCatchUpHits(f.all, nowMs);
        expect(hits.reduce((s, h) => s + h.dmg, 0)).toBe(24);
    });
    test('live-gap: a timer / ice on the family changes nothing', () => {
        const { f, nowMs } = overdueFamily(3, 80);
        f.parent.timer = running(nowMs - 30 * MIN);
        const { hits } = Damage.computeGapCatchUpHits(f.all, nowMs);
        expect(hits.reduce((s, h) => s + h.dmg, 0)).toBe(24); // 80 min: one zombie owes 16, a x1.5 family owes 24
    });
    test('live-gap: a lone item is unchanged and the damage clock advances by whole member intervals', () => {
        const a = mk({ dueDateTime: new Date(T0 - 17 * MIN), lastDamageTickTime: T0 - 17 * MIN });
        const { hits } = Damage.computeGapCatchUpHits([a], T0);
        expect(hits[0].dmg).toBe(3);
        expect(a.lastDamageTickTime).toBe(T0 - 2 * MIN);
    });
    test('offline ticks take a per-member interval', () => {
        expect(Damage.computeOfflineTicks(T0 - 60 * MIN, T0, 60 * MIN, undefined, 2 * BASE).ticks).toBe(6);
        expect(Damage.computeOfflineTicks(T0 - 60 * MIN, T0, 60 * MIN).ticks).toBe(12);
    });
});

/**
 * Distance-priced rescheduling (Build 2, 2026-10-25) — pure pricing core.
 * See docs/DESIGN_QUESTIONS_KO_EDIT_TIMER.md Q2.
 */
const Economy = require('../js/economy.js');
const CONFIG = require('../js/config.js');
const RunStats = require('../js/runStats.js');

const H = 3600000;
const now = new Date('2026-10-26T12:00:00Z');
const tiers = Economy.reschedulePriceTiers(CONFIG.SHOP_ITEMS);
const base = (over) => Economy.reschedulePrice(Object.assign({
    currentDue: new Date(now.getTime() + 2 * H),
    newDue: new Date(now.getTime() + 3 * H),
    now, createdAt: new Date(now.getTime() - 5 * 3600000),
    zone: 'urgent', tiers, zoneFactors: CONFIG.RESCHEDULE_ZONE_FACTORS,
    graceMs: CONFIG.RESCHEDULE_GRACE_MS, freeUsesLeft: 0, discount: 0,
}, over));

describe('reschedulePriceTiers', () => {
    test('only pushback items, ascending', () => {
        expect(tiers.map(t => t.pushbackMs)).toEqual([1 * H, 2 * H, 24 * H]);
        expect(tiers.map(t => t.baseCost)).toEqual([50, 100, 300]);
    });
});

describe('reschedulePrice', () => {
    test('earlier or equal is free', () => {
        const r = base({ newDue: new Date(now.getTime() + 1 * H) });
        expect(r).toMatchObject({ later: false, cost: 0, free: true, reason: 'not-later' });
    });
    test('urgent, +1h costs the 1hr tier at factor 1', () => {
        expect(base({}).cost).toBe(50);
    });
    test('rounds delta up to next tier', () => {
        const r = base({ newDue: new Date(now.getTime() + 2 * H + 90 * 60000) }); // +1.5h -> 2hr tier
        expect(r.cost).toBe(100);
    });
    test('beyond 1 day = whole multiples of the day price', () => {
        const r = base({ newDue: new Date(now.getTime() + 2 * H + 25 * H) });
        expect(r.cost).toBe(600);
    });
    // 2026-10-26 (Jeremy): distance is measured from the later of the current due and now.
    describe('overdue items are priced from now', () => {
        const overdue = (newDue) => base({ currentDue: new Date(now.getTime() - 3 * H), newDue, zone: 'overdue' });

        test('3 h overdue moved to 1 h from now = the 1hr tier (was the 1day tier)', () => {
            expect(overdue(new Date(now.getTime() + 1 * H)).cost).toBe(50);
        });
        test('moved to 90 min from now = the 2hr tier', () => {
            expect(overdue(new Date(now.getTime() + 90 * 60000)).cost).toBe(100);
        });
        test('moved to 25 h from now = whole multiples of the day price', () => {
            expect(overdue(new Date(now.getTime() + 25 * H)).cost).toBe(600);
        });
        test('moved later but still in the past costs the smallest tier, as before', () => {
            const r = overdue(new Date(now.getTime() - 2 * H));
            expect(r).toMatchObject({ later: true, cost: 50, free: false });
        });
        test('a not-yet-due item is still priced by distance from its due date', () => {
            expect(base({ newDue: new Date(now.getTime() + 2 * H + 90 * 60000) }).cost).toBe(100);
        });
    });
    test('approaching zone halves, overdue is full, calm is free', () => {
        expect(base({ zone: 'approaching' }).cost).toBe(25);
        expect(base({ zone: 'overdue' }).cost).toBe(50);
        expect(base({ zone: 'calm' })).toMatchObject({ cost: 0, free: true, reason: 'calm' });
    });
    test('grace window after creation is free', () => {
        const r = base({ createdAt: new Date(now.getTime() - 5 * 60000) });
        expect(r).toMatchObject({ cost: 0, free: true, reason: 'grace' });
    });
    test('weekly free use consumes and is free', () => {
        const r = base({ freeUsesLeft: 1 });
        expect(r).toMatchObject({ cost: 0, free: true, reason: 'weekly', consumesFreeUse: true });
    });
    test('discount applied once, min 1', () => {
        expect(base({ discount: 0.1 }).cost).toBe(45);
        expect(base({ zone: 'approaching', discount: 0.99 }).cost).toBe(1);
    });
});

describe('free-use helpers', () => {
    test('prune drops entries older than 7 days and junk', () => {
        const n = now.getTime();
        const kept = Economy.pruneRescheduleFreeUses([n - 8 * 86400000, n - 86400000, 'x', null], n);
        expect(kept).toEqual([n - 86400000]);
    });
    test('uses left', () => {
        const n = now.getTime();
        expect(Economy.rescheduleFreeUsesLeft([], n, 1)).toBe(1);
        expect(Economy.rescheduleFreeUsesLeft([n - 1000], n, 1)).toBe(0);
        expect(Economy.rescheduleFreeUsesLeft(undefined, n, 1)).toBe(1);
    });
});

describe('RunStats reschedules', () => {
    test('fresh stats start at 0 and record increments', () => {
        const s = RunStats.freshRunStats();
        expect(s.reschedules).toBe(0);
        RunStats.recordReschedule(s);
        RunStats.recordReschedule(s);
        expect(s.reschedules).toBe(2);
    });
});

/**
 * Shop core tests ([P1-UI-008], SHOP_PLAN.md session 1, 2026-07-18).
 *
 * js/shop.js is pure and depends on Economy (shopPrice/subtractPoints), so both
 * are required directly — same style as economy.test.js. Economy must be a
 * global for shop.js's module-scope reference, matching how the browser loads
 * economy.js before shop.js.
 */
global.Economy = require('../js/economy.js');
const Shop = require('../js/shop.js');
const CONFIG = require('../js/config.js');

const CATALOG = CONFIG.SHOP_ITEMS;
const smallKit = CATALOG.find(i => i.id === 'repair_small');   // baseCost 25, consumable
const pushback1hr = CATALOG.find(i => i.id === 'pushback_1hr'); // baseCost 50, not consumable

describe('catalog integrity', () => {
    test('every item has the required shape', () => {
        CATALOG.forEach(item => {
            expect(typeof item.id).toBe('string');
            expect(typeof item.baseCost).toBe('number');
            expect(['repair', 'pushback']).toContain(item.category);
            expect(typeof item.consumable).toBe('boolean');
        });
    });

    test('item ids are unique', () => {
        const ids = CATALOG.map(i => i.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('heldCount', () => {
    test('absent key is 0', () => {
        expect(Shop.heldCount({}, 'repair_small')).toBe(0);
        expect(Shop.heldCount(undefined, 'repair_small')).toBe(0);
    });
    test('reads the stored count', () => {
        expect(Shop.heldCount({ repair_small: 3 }, 'repair_small')).toBe(3);
    });
});

describe('price', () => {
    test('consumable at 0 held is baseCost', () => {
        expect(Shop.price(smallKit, {})).toBe(25);
    });
    test('consumable price climbs with held count (1.5^held)', () => {
        expect(Shop.price(smallKit, { repair_small: 1 })).toBe(38); // 37.5 → 38
        expect(Shop.price(smallKit, { repair_small: 2 })).toBe(56); // 56.25 → 56
    });
    test('non-consumable ignores inventory (always baseCost today)', () => {
        expect(Shop.price(pushback1hr, {})).toBe(50);
        expect(Shop.price(pushback1hr, { pushback_1hr: 5 })).toBe(50);
    });
});

describe('canAfford', () => {
    test('true when points meet the live price', () => {
        expect(Shop.canAfford(smallKit, {}, 25)).toBe(true);
        expect(Shop.canAfford(smallKit, {}, 24)).toBe(false);
    });
    test('respects the climbed price', () => {
        expect(Shop.canAfford(smallKit, { repair_small: 1 }, 37)).toBe(false);
        expect(Shop.canAfford(smallKit, { repair_small: 1 }, 38)).toBe(true);
    });
});

describe('purchase', () => {
    test('unknown item fails cleanly', () => {
        const r = Shop.purchase('nope', CATALOG, {}, 999);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('unknown_item');
    });

    test('insufficient points fails without mutating', () => {
        const inv = {};
        const r = Shop.purchase('repair_small', CATALOG, inv, 10);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('insufficient_points');
        expect(r.cost).toBe(25);
        expect(inv).toEqual({}); // untouched
    });

    test('consumable purchase deducts points and adds one to inventory', () => {
        const inv = {};
        const r = Shop.purchase('repair_small', CATALOG, inv, 100);
        expect(r.ok).toBe(true);
        expect(r.cost).toBe(25);
        expect(r.newPoints).toBe(75);
        expect(r.newInventory).toEqual({ repair_small: 1 });
        expect(inv).toEqual({}); // original not mutated
    });

    test('second consumable purchase costs more (owned=held) and stacks', () => {
        const r = Shop.purchase('repair_small', CATALOG, { repair_small: 1 }, 100);
        expect(r.cost).toBe(38);
        expect(r.newPoints).toBe(62);
        expect(r.newInventory).toEqual({ repair_small: 2 });
    });

    test('non-consumable purchase deducts points but does NOT add inventory', () => {
        const r = Shop.purchase('pushback_1hr', CATALOG, {}, 100);
        expect(r.ok).toBe(true);
        expect(r.cost).toBe(50);
        expect(r.newPoints).toBe(50);
        expect(r.newInventory).toEqual({}); // instant-consume, nothing held
    });
});

describe('consume', () => {
    test('decrements a held item', () => {
        const r = Shop.consume('repair_small', { repair_small: 2 });
        expect(r.ok).toBe(true);
        expect(r.newInventory).toEqual({ repair_small: 1 });
    });
    test('last unit removes the key entirely', () => {
        const r = Shop.consume('repair_small', { repair_small: 1 });
        expect(r.ok).toBe(true);
        expect(r.newInventory).toEqual({});
    });
    test('consuming with none held fails and does not go negative', () => {
        const r = Shop.consume('repair_small', {});
        expect(r.ok).toBe(false);
        expect(r.newInventory).toEqual({});
    });
    test('does not mutate the input inventory', () => {
        const inv = { repair_small: 2 };
        Shop.consume('repair_small', inv);
        expect(inv).toEqual({ repair_small: 2 });
    });
});

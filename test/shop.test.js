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
const cheatDay = CATALOG.find(i => i.id === 'cheat_day');       // baseCost 200, consumable ([P1-DATA-005] sub-session 5)
const sickDay = CATALOG.find(i => i.id === 'sick_day');         // baseCost 200, consumable (frozen-slots sub-session 5)
const skipDay = CATALOG.find(i => i.id === 'skip_day');         // baseCost 200, consumable (frozen-slots sub-session 5)

describe('catalog integrity', () => {
    test('every item has the required shape', () => {
        CATALOG.forEach(item => {
            expect(typeof item.id).toBe('string');
            expect(typeof item.baseCost).toBe('number');
            expect(['repair', 'pushback', 'cheatDay', 'sickDay', 'skipDay']).toContain(item.category);
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

describe('pushedBackDueDate', () => {
    const ONE_HOUR = 60 * 60 * 1000;

    test('shifts the due date later by pushbackMs', () => {
        const due = new Date('2026-07-19T12:00:00.000Z');
        const shifted = Shop.pushedBackDueDate(due, ONE_HOUR);
        expect(shifted.getTime()).toBe(due.getTime() + ONE_HOUR);
        expect(shifted.toISOString()).toBe('2026-07-19T13:00:00.000Z');
    });

    test('uses the catalog pushback amounts (1hr/2hr/1day)', () => {
        const due = new Date('2026-07-19T12:00:00.000Z');
        const p1hr = CATALOG.find(i => i.id === 'pushback_1hr');
        const p1day = CATALOG.find(i => i.id === 'pushback_1day');
        expect(Shop.pushedBackDueDate(due, p1hr.effect.pushbackMs).getTime())
            .toBe(due.getTime() + ONE_HOUR);
        expect(Shop.pushedBackDueDate(due, p1day.effect.pushbackMs).getTime())
            .toBe(due.getTime() + 24 * ONE_HOUR);
    });

    test('never mutates the input Date', () => {
        const due = new Date('2026-07-19T12:00:00.000Z');
        const before = due.getTime();
        Shop.pushedBackDueDate(due, ONE_HOUR);
        expect(due.getTime()).toBe(before);
    });

    test('missing/zero pushbackMs is a no-op shift (equal-valued new Date)', () => {
        const due = new Date('2026-07-19T12:00:00.000Z');
        expect(Shop.pushedBackDueDate(due, 0).getTime()).toBe(due.getTime());
        expect(Shop.pushedBackDueDate(due, undefined).getTime()).toBe(due.getTime());
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

// [P1-DATA-005] sub-session 5 (Cheat Day token, 2026-07-19): 200 pts is the
// unchanged ECONOMY.md/spec face value (Fable session 26) — protects it from
// silent drift. Cheat Day is Buy-to-hold like a repair kit (held-inventory
// exponential pricing), so Shop's existing generic purchase/consume paths
// need no new code — this just asserts the catalog entry + those generic
// paths compose correctly for the new id.
describe('Cheat Day token catalog entry', () => {
    test('is in the catalog with the spec face-value cost, consumable', () => {
        expect(cheatDay).toBeDefined();
        expect(cheatDay.baseCost).toBe(200);
        expect(cheatDay.consumable).toBe(true);
        expect(cheatDay.category).toBe('cheatDay');
    });

    test('prices like a held-inventory consumable (base × 1.5^held)', () => {
        expect(Shop.price(cheatDay, {})).toBe(200);
        expect(Shop.price(cheatDay, { cheat_day: 1 })).toBe(300);
    });

    test('purchase adds to held inventory (not instant-consume like pushback)', () => {
        const r = Shop.purchase('cheat_day', CATALOG, {}, 200);
        expect(r.ok).toBe(true);
        expect(r.newInventory).toEqual({ cheat_day: 1 });
    });

    test('consume decrements the held count', () => {
        const r = Shop.consume('cheat_day', { cheat_day: 1 });
        expect(r.ok).toBe(true);
        expect(r.newInventory).toEqual({});
    });
});

// Sick Day (global, shop-card applied) + Skip Day (per-habit, popup-targeted)
// — frozen-slots sub-session 5, 2026-07-19. Both are Buy-to-hold consumables
// like Cheat Day (held-inventory exponential pricing); the actual excuse
// logic (Items.useSickDayGlobally / useSkipDayOnItem) needs no new Shop.js
// code, same reasoning as Cheat Day's entry above.
describe('Sick Day / Skip Day token catalog entries', () => {
    test('both are in the catalog with the spec face-value cost, consumable', () => {
        expect(sickDay).toBeDefined();
        expect(sickDay.baseCost).toBe(200);
        expect(sickDay.consumable).toBe(true);
        expect(sickDay.category).toBe('sickDay');

        expect(skipDay).toBeDefined();
        expect(skipDay.baseCost).toBe(200);
        expect(skipDay.consumable).toBe(true);
        expect(skipDay.category).toBe('skipDay');
    });

    test('both price like held-inventory consumables (base × 1.5^held)', () => {
        expect(Shop.price(sickDay, {})).toBe(200);
        expect(Shop.price(sickDay, { sick_day: 1 })).toBe(300);
        expect(Shop.price(skipDay, {})).toBe(200);
        expect(Shop.price(skipDay, { skip_day: 1 })).toBe(300);
    });

    test('purchase adds to held inventory for both', () => {
        expect(Shop.purchase('sick_day', CATALOG, {}, 200).newInventory).toEqual({ sick_day: 1 });
        expect(Shop.purchase('skip_day', CATALOG, {}, 200).newInventory).toEqual({ skip_day: 1 });
    });

    test('consume decrements the held count for both', () => {
        expect(Shop.consume('sick_day', { sick_day: 1 }).newInventory).toEqual({});
        expect(Shop.consume('skip_day', { skip_day: 1 }).newInventory).toEqual({});
    });
});

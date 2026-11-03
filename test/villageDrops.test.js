/**
 * VillageDrops pure-core tests (2026-11-03; DECISIONS "Village tier drops", docs/ECONOMY.md "Village tier drops").
 *
 * Covers: table parity with CONFIG, that every CONFIG row is a real HELD shop item (a bad row would be a silent no-op in play),
 * dropFor / nextDrop, what is owed, and the once-per-star ledger -- including the traps this feature has:
 * undoing a completion lowers a tier (no double pay when it climbs back), and the first check on an existing run pays the stars
 * it already has.
 */
const VillageDrops = require('../js/villageDrops.js');
const VillageProgress = require('../js/villageProgress.js');
const Shop = require('../js/shop.js');
const RunStats = require('../js/runStats.js');
const CONFIG = require('../js/config.js');

const TABLE = CONFIG.VILLAGE_TIER_DROPS;
const CATALOG = CONFIG.SHOP_ITEMS;
const grant = Shop.grant;
const allT1 = () => { const t = {}; VillageDrops.KINDS.forEach(k => { t[k] = 1; }); return t; };
const withTiers = (over) => Object.assign(allT1(), over);
const settle = (o) => VillageDrops.settle(Object.assign({ tiers: allT1(), paid: {}, inventory: {}, catalog: CATALOG, table: TABLE, grant }, o));

describe('table parity + config sanity', () => {
    test('DEFAULT_TABLE mirrors CONFIG.VILLAGE_TIER_DROPS', () => {
        expect(VillageDrops.DEFAULT_TABLE).toEqual(TABLE);
    });

    test('KINDS matches VillageProgress.KINDS (same order, so payouts always list the same way)', () => {
        expect(VillageDrops.KINDS).toEqual(VillageProgress.KINDS);
    });

    test('the shared ladder covers stars 2..5 and never star 1', () => {
        expect(Object.keys(TABLE.default).map(Number).sort()).toEqual([2, 3, 4, 5]);
    });

    test('every row (ladder and themed) is a HELD shop item with a positive whole count', () => {
        Object.keys(TABLE).forEach((key) => {
            Object.keys(TABLE[key]).forEach((star) => {
                const row = TABLE[key][star];
                const item = CATALOG.find(i => i.id === row.itemId);
                expect({ key, star, found: !!item }).toEqual({ key, star, found: true });
                expect({ key, star, held: item.consumable }).toEqual({ key, star, held: true });
                expect(Number.isInteger(row.count) && row.count > 0).toBe(true);
            });
        });
    });

    test('themed rows belong to a real building kind and a star 2..5', () => {
        Object.keys(TABLE).filter(k => k !== 'default').forEach((kind) => {
            expect(VillageDrops.KINDS).toContain(kind);
            Object.keys(TABLE[kind]).forEach(s => { expect(Number(s) >= 2 && Number(s) <= 5).toBe(true); });
        });
    });

    test('the real Shop.grant accepts every row (a bad row would be refused there)', () => {
        VillageDrops.KINDS.forEach((kind) => {
            for (let s = 2; s <= 5; s++) {
                const d = VillageDrops.dropFor(kind, s, TABLE);
                expect(grant(d.itemId, d.count, CATALOG, {}).ok).toBe(true);
            }
        });
    });
});

describe('dropFor', () => {
    test('star 1, out-of-range and junk stars pay nothing', () => {
        [1, 0, -3, 6, 99, NaN, undefined, null, 'x'].forEach(s => expect(VillageDrops.dropFor('nights', s, TABLE)).toBeNull());
    });

    test('the shared ladder', () => {
        expect(VillageDrops.dropFor('slain', 2, TABLE)).toEqual({ itemId: 'pushback_medium', count: 1 });
        expect(VillageDrops.dropFor('slain', 3, TABLE)).toEqual({ itemId: 'repair_small', count: 1 });
        expect(VillageDrops.dropFor('slain', 4, TABLE)).toEqual({ itemId: 'repair_medium', count: 1 });
        expect(VillageDrops.dropFor('slain', 5, TABLE)).toEqual({ itemId: 'repair_large', count: 1 });
    });

    test('the themed star-5 prizes: gym = Cheat Day, hospital = Skip Day, radio tower = Sick Day', () => {
        expect(VillageDrops.dropFor('lurkers', 5, TABLE).itemId).toBe('cheat_day');
        expect(VillageDrops.dropFor('habits', 5, TABLE).itemId).toBe('skip_day');
        expect(VillageDrops.dropFor('nights', 5, TABLE).itemId).toBe('sick_day');
    });

    test('a themed building keeps the ladder for every OTHER star', () => {
        [2, 3, 4].forEach(s => {
            expect(VillageDrops.dropFor('lurkers', s, TABLE)).toEqual(VillageDrops.dropFor('slain', s, TABLE));
        });
    });

    test('the other five buildings pay the Large Repair Kit at star 5', () => {
        ['punctuality', 'defense', 'slain', 'heroes', 'bestdays'].forEach(k => {
            expect(VillageDrops.dropFor(k, 5, TABLE).itemId).toBe('repair_large');
        });
    });

    test('a building row REPLACES the ladder row; a malformed row falls back to the ladder; a hole pays nothing', () => {
        const t = { default: { 2: { itemId: 'a', count: 1 }, 3: { itemId: 'b', count: 2 } }, x: { 2: { itemId: 'own', count: 3 }, 3: { itemId: '', count: 1 } } };
        expect(VillageDrops.dropFor('x', 2, t)).toEqual({ itemId: 'own', count: 3 });
        expect(VillageDrops.dropFor('x', 3, t)).toEqual({ itemId: 'b', count: 2 });
        expect(VillageDrops.dropFor('x', 4, t)).toBeNull();
    });

    test('an omitted table uses the mirrored defaults', () => {
        expect(VillageDrops.dropFor('slain', 3)).toEqual({ itemId: 'repair_small', count: 1 });
    });
});

describe('nextDrop (what the building card shows)', () => {
    test('from star 1 the next drop is star 2', () => {
        expect(VillageDrops.nextDrop('slain', 1, TABLE)).toEqual({ star: 2, itemId: 'pushback_medium', count: 1 });
    });

    test('mid ladder', () => {
        expect(VillageDrops.nextDrop('slain', 3, TABLE)).toEqual({ star: 4, itemId: 'repair_medium', count: 1 });
    });

    test('the themed star 5 shows its themed prize', () => {
        expect(VillageDrops.nextDrop('lurkers', 4, TABLE)).toEqual({ star: 5, itemId: 'cheat_day', count: 1 });
    });

    test('at the top star there is nothing next', () => {
        expect(VillageDrops.nextDrop('slain', 5, TABLE)).toBeNull();
        expect(VillageDrops.nextDrop('slain', 9, TABLE)).toBeNull();
    });

    test('skips a hole to the next star that does pay', () => {
        const t = { default: { 4: { itemId: 'repair_small', count: 1 } } };
        expect(VillageDrops.nextDrop('slain', 1, t)).toEqual({ star: 4, itemId: 'repair_small', count: 1 });
    });

    test('junk tiers read as star 1', () => {
        expect(VillageDrops.nextDrop('slain', undefined, TABLE).star).toBe(2);
        expect(VillageDrops.nextDrop('slain', 'x', TABLE).star).toBe(2);
    });
});

describe('normalizePaid', () => {
    test('keeps known kinds with whole stars 1..5, drops everything else, never mutates', () => {
        const input = { nights: 3, slain: 9, lurkers: 0, habits: 'x', bogus: 4, heroes: 2.9 };
        const copy = JSON.parse(JSON.stringify(input));
        expect(VillageDrops.normalizePaid(input)).toEqual({ nights: 3, slain: 5, heroes: 2 });
        expect(input).toEqual(copy);
    });

    test('non-objects become an empty ledger', () => {
        [null, undefined, 5, 'x', []].forEach(v => expect(VillageDrops.normalizePaid(v)).toEqual({}));
    });
});

describe('owed', () => {
    test('a fresh village (all star 1) owes nothing', () => {
        expect(VillageDrops.owed(allT1(), {}, TABLE)).toEqual([]);
    });

    test('the first check on an existing run pays EVERY star already reached, oldest first', () => {
        const rows = VillageDrops.owed(withTiers({ slain: 3 }), undefined, TABLE);
        expect(rows).toEqual([
            { kind: 'slain', star: 2, itemId: 'pushback_medium', count: 1 },
            { kind: 'slain', star: 3, itemId: 'repair_small', count: 1 },
        ]);
    });

    test('only the stars above the ledger are owed', () => {
        const rows = VillageDrops.owed(withTiers({ slain: 4 }), { slain: 2 }, TABLE);
        expect(rows.map(r => r.star)).toEqual([3, 4]);
    });

    test('a ledger at or above the tier owes nothing', () => {
        expect(VillageDrops.owed(withTiers({ slain: 3 }), { slain: 3 }, TABLE)).toEqual([]);
        expect(VillageDrops.owed(withTiers({ slain: 2 }), { slain: 4 }, TABLE)).toEqual([]);
    });

    test('rows come out in building order, then star order', () => {
        const rows = VillageDrops.owed(withTiers({ bestdays: 2, punctuality: 3, nights: 2 }), {}, TABLE);
        expect(rows.map(r => r.kind + ':' + r.star)).toEqual(['punctuality:2', 'punctuality:3', 'nights:2', 'bestdays:2']);
    });

    test('a fully rebuilt village owes the whole table: 8 buildings x 4 stars', () => {
        const t = {}; VillageDrops.KINDS.forEach(k => { t[k] = 5; });
        expect(VillageDrops.owed(t, {}, TABLE)).toHaveLength(32);
    });

    test('unknown kinds, missing kinds and junk tiers are ignored or clamped', () => {
        expect(VillageDrops.owed({ bogus: 5 }, {}, TABLE)).toEqual([]);
        expect(VillageDrops.owed({ slain: 99 }, {}, TABLE).map(r => r.star)).toEqual([2, 3, 4, 5]);
        expect(VillageDrops.owed({ slain: 'x' }, {}, TABLE)).toEqual([]);
        expect(VillageDrops.owed(null, {}, TABLE)).toEqual([]);
        expect(VillageDrops.owed(undefined, {}, TABLE)).toEqual([]);
    });

    test('a hole in the table pays no row for that star', () => {
        const t = { default: { 3: { itemId: 'repair_small', count: 1 } } };
        expect(VillageDrops.owed(withTiers({ slain: 3 }), {}, t).map(r => r.star)).toEqual([3]);
    });
});

describe('label + valueOf', () => {
    test('label reads like the level perks: name, a multiplication sign, the count', () => {
        expect(VillageDrops.label({ itemId: 'repair_small', count: 1 }, CATALOG)).toBe('Repair Kit (Small) ×1');
        expect(VillageDrops.label({ itemId: 'repair_small', count: 2 }, CATALOG)).toBe('Repair Kit (Small) ×2');
    });

    test('an unknown item falls back to its id', () => {
        expect(VillageDrops.label({ itemId: 'mystery', count: 1 }, CATALOG)).toBe('mystery ×1');
    });

    test('valueOf = shop base cost x count, 0 for an unknown item', () => {
        expect(VillageDrops.valueOf({ itemId: 'repair_medium', count: 1 }, CATALOG)).toBe(50);
        expect(VillageDrops.valueOf({ itemId: 'repair_medium', count: 3 }, CATALOG)).toBe(150);
        expect(VillageDrops.valueOf({ itemId: 'mystery', count: 1 }, CATALOG)).toBe(0);
    });
});

describe('settle -- the payout + once-per-star ledger', () => {
    test('nothing owed = no change, same inventory object back', () => {
        const inventory = { repair_small: 1 };
        const r = settle({ inventory });
        expect(r.changed).toBe(false);
        expect(r.granted).toEqual([]);
        expect(r.newInventory).toBe(inventory);
        expect(r.newPaid).toEqual({});
    });

    test('pays the owed items into the HELD inventory and raises the ledger', () => {
        const r = settle({ tiers: withTiers({ slain: 3 }), inventory: { repair_small: 1 } });
        expect(r.changed).toBe(true);
        expect(r.newInventory).toEqual({ repair_small: 2, pushback_medium: 1 });
        expect(r.newPaid).toEqual({ slain: 3 });
        expect(r.granted.map(g => g.star)).toEqual([2, 3]);
        expect(r.granted[1]).toMatchObject({ kind: 'slain', itemId: 'repair_small', count: 1, label: 'Repair Kit (Small) ×1', value: 25 });
    });

    test('never mutates the inventory or the ledger it was given', () => {
        const inventory = { repair_small: 1 };
        const paid = { slain: 1 };
        settle({ tiers: withTiers({ slain: 3 }), inventory, paid });
        expect(inventory).toEqual({ repair_small: 1 });
        expect(paid).toEqual({ slain: 1 });
    });

    test('settling twice in a row pays once (the second pass finds nothing owed)', () => {
        const first = settle({ tiers: withTiers({ nights: 4 }) });
        const second = settle({ tiers: withTiers({ nights: 4 }), paid: first.newPaid, inventory: first.newInventory });
        expect(first.granted).toHaveLength(3);
        expect(second.changed).toBe(false);
        expect(second.granted).toEqual([]);
        expect(second.newInventory).toEqual(first.newInventory);
    });

    test('TRAP: undo lowers a tier, then it climbs back -- the star is NOT paid twice', () => {
        // Reach star 3 and be paid for stars 2 and 3.
        const a = settle({ tiers: withTiers({ slain: 3 }) });
        expect(a.newPaid.slain).toBe(3);
        // An undo drops the building to star 2: nothing is taken back.
        const b = settle({ tiers: withTiers({ slain: 2 }), paid: a.newPaid, inventory: a.newInventory });
        expect(b.changed).toBe(false);
        expect(b.newInventory).toEqual(a.newInventory);
        expect(b.newPaid.slain).toBe(3);
        // It climbs back to star 3: already paid, so nothing.
        const c = settle({ tiers: withTiers({ slain: 3 }), paid: b.newPaid, inventory: b.newInventory });
        expect(c.changed).toBe(false);
        expect(c.granted).toEqual([]);
        // Star 4 is the first NEW pay.
        const d = settle({ tiers: withTiers({ slain: 4 }), paid: c.newPaid, inventory: c.newInventory });
        expect(d.granted.map(g => g.star)).toEqual([4]);
        expect(d.newInventory.repair_medium).toBe(1);
    });

    test('a jump of several stars at once pays each star on the way (a big catch-up)', () => {
        const r = settle({ tiers: withTiers({ lurkers: 5 }) });
        expect(r.granted.map(g => g.itemId)).toEqual(['pushback_medium', 'repair_small', 'repair_medium', 'cheat_day']);
    });

    test('several buildings in one pass, in building order', () => {
        const r = settle({ tiers: withTiers({ habits: 2, punctuality: 2, slain: 2 }) });
        expect(r.granted.map(g => g.kind)).toEqual(['punctuality', 'slain', 'habits']);
        expect(r.newInventory.pushback_medium).toBe(3);
        expect(r.newPaid).toEqual({ punctuality: 2, slain: 2, habits: 2 });
    });

    test('a ledger entry is only ever raised, never lowered', () => {
        const r = settle({ tiers: withTiers({ slain: 2, nights: 3 }), paid: { slain: 4 } });
        expect(r.newPaid.slain).toBe(4);
        expect(r.newPaid.nights).toBe(3);
    });

    test('an item the shop refuses is reported in `failed`, marked paid anyway (no retry loop), and the rest still pays', () => {
        const bad = { default: { 2: { itemId: 'no_such_item', count: 1 }, 3: { itemId: 'repair_small', count: 1 } } };
        const r = settle({ tiers: withTiers({ slain: 3 }), table: bad });
        expect(r.failed).toEqual([{ kind: 'slain', star: 2, itemId: 'no_such_item', count: 1 }]);
        expect(r.granted.map(g => g.itemId)).toEqual(['repair_small']);
        expect(r.newPaid.slain).toBe(3);
        expect(r.newInventory).toEqual({ repair_small: 1 });
        const again = settle({ tiers: withTiers({ slain: 3 }), table: bad, paid: r.newPaid, inventory: r.newInventory });
        expect(again.changed).toBe(false);
    });

    test('a star with no table row is still marked paid (no re-check forever)', () => {
        const sparse = { default: { 3: { itemId: 'repair_small', count: 1 } } };
        const r = settle({ tiers: withTiers({ slain: 2 }), table: sparse });
        expect(r.granted).toEqual([]);
        expect(r.changed).toBe(true);
        expect(r.newPaid.slain).toBe(2);
    });

    test('missing tiers or grant: a safe no-op that returns the inputs', () => {
        const inventory = { a: 1 };
        [undefined, null, 'x'].forEach((tiers) => {
            const r = VillageDrops.settle({ tiers, paid: {}, inventory, catalog: CATALOG, table: TABLE, grant });
            expect(r.changed).toBe(false);
            expect(r.newInventory).toBe(inventory);
        });
        const r = VillageDrops.settle({ tiers: withTiers({ slain: 3 }), paid: {}, inventory, catalog: CATALOG, table: TABLE });
        expect(r.changed).toBe(false);
        expect(r.newInventory).toBe(inventory);
        expect(VillageDrops.settle().changed).toBe(false);
    });

    test('a malformed inventory is treated as empty', () => {
        const r = settle({ tiers: withTiers({ slain: 2 }), inventory: null });
        expect(r.newInventory).toEqual({ pushback_medium: 1 });
    });
});

describe('the ledger lives in the run stats and resets with the run', () => {
    test('a fresh run starts with an empty ledger', () => {
        expect(RunStats.freshRunStats().villageDropsPaid).toEqual({});
    });

    test('two fresh runs never share the ledger object', () => {
        const a = RunStats.freshRunStats();
        const b = RunStats.freshRunStats();
        a.villageDropsPaid.slain = 3;
        expect(b.villageDropsPaid).toEqual({});
    });

    test('an older run (no ledger field) is paid everything it already has', () => {
        const oldStats = { tasksCompleted: 10 };
        const r = settle({ tiers: withTiers({ nights: 2, slain: 3 }), paid: oldStats.villageDropsPaid });
        expect(r.granted).toHaveLength(3);
    });
});

describe('balance pin (theory pass, 2026-11-03)', () => {
    const value = (kind, star) => VillageDrops.valueOf(VillageDrops.dropFor(kind, star, TABLE), CATALOG);

    test('the ladder is worth 10 / 25 / 50 / 100 shop points per star and the themed prizes 200 at star 5', () => {
        expect([2, 3, 4, 5].map(s => value('slain', s))).toEqual([10, 25, 50, 100]);
        ['lurkers', 'habits', 'nights'].forEach(k => expect(value(k, 5)).toBe(200));
    });

    test('a fully rebuilt village pays 1,780 points of items in total (5 x 185 + 3 x 285)', () => {
        const t = {}; VillageDrops.KINDS.forEach(k => { t[k] = 5; });
        const r = settle({ tiers: t });
        expect(r.granted.reduce((n, g) => n + g.value, 0)).toBe(1780);
    });

    test('the harder the star, the more the item is worth (never a cheaper prize later), for every building', () => {
        VillageDrops.KINDS.forEach((k) => {
            const v = [2, 3, 4, 5].map(s => value(k, s));
            for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThan(v[i - 1]);
        });
    });

    test('red line: nothing worth 200 points before star 5', () => {
        VillageDrops.KINDS.forEach(k => [2, 3, 4].forEach(s => expect(value(k, s)).toBeLessThan(200)));
    });
});

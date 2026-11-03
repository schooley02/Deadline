/**
 * VillageDrops -- the item a village building pays when it reaches a new star (built 2026-11-03; decisions in docs/DECISIONS.md
 * "Village tier drops", numbers in CONFIG.VILLAGE_TIER_DROPS, rules in docs/ECONOMY.md "Village tier drops").
 *
 * The rules, all pure here so they are unit-tested directly:
 *   - Star 1 pays nothing. Reaching star N (2..5) of a building adds ONE fixed item (`{ itemId, count }`) to the HELD inventory.
 *   - Fixed, not random: the building card can show exactly what the next star pays.
 *   - Paid ONCE per star per building per run. A building's tier is computed from counters that can go DOWN (undoing a completion),
 *     so "tier reached" is not enough: a LEDGER, `paid[kind]` = the highest star already paid, only ever rises (it lives in
 *     `currentRunStats.villageDropsPaid`, so it resets with the run exactly like the tiers do). Dropping to star 2 and climbing
 *     back to star 3 pays star 3 once.
 *   - A building with no ledger entry counts as paid up to star 1, so the first time this runs on an existing run it pays every star
 *     already reached (Jeremy, 2026-11-03: "pay out once for stars I've already earned").
 *   - A star can pay nothing (a hole in the table): it is still marked paid, so it never re-checks.
 *   - A row whose item cannot be granted (bad table row; `Shop.grant` refuses unknown and non-held ids) is ALSO marked paid and
 *     reported in `failed`: retrying every second forever would be worse than a visible no-op. test/villageDrops.test.js checks
 *     that every CONFIG row is a held item.
 *
 * No DOM, no State, no CONFIG reads (the caller passes everything in; DEFAULT_TABLE mirrors CONFIG.VILLAGE_TIER_DROPS and a test
 * checks it matches), same pattern as villageProgress.js. `grant` is injected (= Shop.grant) so this file has no dependencies.
 *
 *   tiers      { kind: 1..5 }  the REAL tiers (script.js realVillageTiers(); never a ?xTier= dev override)
 *   paid       { kind: 1..5 }  the ledger (absent / malformed = nothing paid)
 *   table      CONFIG.VILLAGE_TIER_DROPS shape: { default: { star: drop }, <kind>: { star: drop } }
 *   catalog    CONFIG.SHOP_ITEMS
 */
const VillageDrops = (() => {
    // Same order as VillageProgress.KINDS (test checks), so a multi-building payout always lists in the same order.
    const KINDS = ['punctuality', 'defense', 'slain', 'nights', 'lurkers', 'heroes', 'habits', 'bestdays'];
    const MIN_STAR = 2;
    const MAX_STAR = 5;

    // Mirrors CONFIG.VILLAGE_TIER_DROPS (test/villageDrops.test.js checks they match).
    const DEFAULT_TABLE = {
        default: {
            2: { itemId: 'pushback_medium', count: 1 },
            3: { itemId: 'repair_small', count: 1 },
            4: { itemId: 'repair_medium', count: 1 },
            5: { itemId: 'repair_large', count: 1 },
        },
        lurkers: { 5: { itemId: 'cheat_day', count: 1 } },
        habits: { 5: { itemId: 'skip_day', count: 1 } },
        nights: { 5: { itemId: 'sick_day', count: 1 } },
    };

    function star(n) {
        const v = Math.floor(Number(n));
        return Number.isFinite(v) ? Math.min(MAX_STAR, Math.max(1, v)) : 1;
    }

    function validDrop(d) {
        return !!d && typeof d.itemId === 'string' && d.itemId.length > 0 && Math.floor(Number(d.count)) > 0;
    }

    /**
     * The drop for reaching `n` on `kind`, or null (star 1, out of range, or a hole in the table). A building's own row for that
     * star REPLACES the shared ladder's.
     */
    function dropFor(kind, n, table) {
        const t = table || DEFAULT_TABLE;
        const s = Math.floor(Number(n));
        if (!(s >= MIN_STAR && s <= MAX_STAR)) return null;
        const own = t[kind] && t[kind][s];
        const d = validDrop(own) ? own : (t.default && t.default[s]);
        return validDrop(d) ? { itemId: d.itemId, count: Math.floor(Number(d.count)) } : null;
    }

    /**
     * What the NEXT star pays: { star, itemId, count } for the first star above `tier` that has a drop, or null when every
     * remaining star pays nothing (top tier, or a table with no more rows). The building card shows this.
     */
    function nextDrop(kind, tier, table) {
        for (let s = star(tier) + 1; s <= MAX_STAR; s++) {
            const d = dropFor(kind, s, table);
            if (d) return { star: s, itemId: d.itemId, count: d.count };
        }
        return null;
    }

    /** A clean ledger: only known kinds, whole stars 1..5. Anything else is dropped. Never mutates its input. */
    function normalizePaid(paid) {
        const out = {};
        if (!paid || typeof paid !== 'object') return out;
        KINDS.forEach((k) => {
            const v = Math.floor(Number(paid[k]));
            if (Number.isFinite(v) && v >= 1) out[k] = Math.min(MAX_STAR, v);
        });
        return out;
    }

    /**
     * Every drop owed right now: for each building, the stars above its ledger entry up to its real tier, oldest star first.
     * Rows: [{ kind, star, itemId, count }]. Stars with no drop produce no row.
     */
    function owed(tiers, paid, table) {
        const rows = [];
        if (!tiers || typeof tiers !== 'object') return rows;
        const ledger = normalizePaid(paid);
        KINDS.forEach((kind) => {
            if (tiers[kind] == null) return;
            const tier = star(tiers[kind]);
            for (let s = (ledger[kind] || 1) + 1; s <= tier; s++) {
                const d = dropFor(kind, s, table);
                if (d) rows.push({ kind, star: s, itemId: d.itemId, count: d.count });
            }
        });
        return rows;
    }

    function itemOf(itemId, catalog) {
        return (Array.isArray(catalog) ? catalog : []).find(i => i && i.id === itemId) || null;
    }

    /** "Repair Kit (Small) x1" (the same "x" wording as the level perks). Falls back to the id for an unknown item. */
    function label(drop, catalog) {
        const item = itemOf(drop && drop.itemId, catalog);
        const name = item ? item.name : (drop && drop.itemId) || '';
        const n = Math.max(1, Math.floor(Number(drop && drop.count)) || 1);
        return name + ' ×' + n;
    }

    /** The shop value of a drop in points (baseCost x count) -- what the daily record's `drops.pts` sums. 0 for an unknown item. */
    function valueOf(drop, catalog) {
        const item = itemOf(drop && drop.itemId, catalog);
        const n = Math.max(1, Math.floor(Number(drop && drop.count)) || 1);
        return item && Number.isFinite(item.baseCost) ? item.baseCost * n : 0;
    }

    /**
     * Pay everything owed. Pure: returns what to write back, mutates nothing.
     *   { changed, newPaid, newInventory, granted, failed }
     *   changed   true when the ledger rose (the caller saves + records + notifies); false = nothing to do
     *   newPaid   the ledger with every building raised to its real tier
     *   granted   rows that were really added: [{ kind, star, itemId, count, label, value }]
     *   failed    rows whose item could not be granted (still marked paid, see above)
     * `grant(itemId, count, catalog, inventory)` = Shop.grant -> { ok, newInventory }.
     */
    function settle(ctx) {
        const c = ctx || {};
        const inventory = c.inventory && typeof c.inventory === 'object' ? c.inventory : {};
        const result = { changed: false, newPaid: normalizePaid(c.paid), newInventory: inventory, granted: [], failed: [] };
        if (!c.tiers || typeof c.tiers !== 'object' || typeof c.grant !== 'function') return result;

        let inv = inventory;
        owed(c.tiers, c.paid, c.table).forEach((row) => {
            const res = c.grant(row.itemId, row.count, c.catalog, inv);
            if (res && res.ok) {
                inv = res.newInventory;
                result.granted.push(Object.assign({}, row, { label: label(row, c.catalog), value: valueOf(row, c.catalog) }));
            } else {
                result.failed.push(row);
            }
        });
        result.newInventory = inv;

        KINDS.forEach((kind) => {
            if (c.tiers[kind] == null) return;
            const tier = star(c.tiers[kind]);
            if (tier > (result.newPaid[kind] || 1)) {
                result.newPaid[kind] = tier;
                result.changed = true;
            }
        });
        return result;
    }

    return { KINDS, MIN_STAR, MAX_STAR, DEFAULT_TABLE, dropFor, nextDrop, normalizePaid, owed, label, valueOf, settle };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VillageDrops;
}

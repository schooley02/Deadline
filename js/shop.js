/**
 * Shop — pure purchase/pricing core ([P1-UI-008], SHOP_PLAN.md session 1, 2026-07-18).
 *
 * No DOM, no closures over script.js state — same pattern as economy.js /
 * progression.js. The shop UI (js/ui/shopView.js, session 2) and the effect
 * wiring (repair-kit USE → Damage.healBase session 3; pushback session 4) call
 * these. Pricing delegates to Economy.shopPrice so the exponential formula
 * lives in exactly one place.
 *
 * Inventory model (Jeremy's call, session 19): `owned` in the price formula is
 * the CURRENTLY-HELD count, so consuming an item makes the next one cheaper
 * again. Inventory is a plain object keyed by item id -> integer count, e.g.
 * { repair_small: 2 }. Absent keys mean zero held. Pushback items are
 * non-consumable (applied instantly), so they never accumulate a held count —
 * their pricing basis is revisited in session 4 (see SHOP_PLAN.md).
 *
 * Every function is pure: inputs in, new values out. `purchase` returns a NEW
 * inventory object rather than mutating its argument, so callers stay in
 * control of state ownership (script.js owns playerPoints + inventory via
 * accessor deps, consistent with every other module).
 */
const Shop = (() => {

    // Look up a catalog item by id. Returns undefined if not found.
    function getItem(itemId, catalog) {
        return catalog.find(i => i.id === itemId);
    }

    // Currently-held count of an item (0 if never bought / fully used).
    function heldCount(inventory, itemId) {
        const n = inventory ? inventory[itemId] : 0;
        return (typeof n === 'number' && n > 0) ? n : 0;
    }

    // Live price for the next purchase of an item: base × 1.5^held, via Economy.
    // For consumable items `held` is the held count; for instant-consume items
    // (pushback) held is always 0 today, so price == baseCost (session-4 TODO).
    // `discount` (optional, 0..1) is the level-perk shop discount — callers
    // pass Progression.shopDiscount(CONFIG.LEVEL_PERKS, level); omitted = none.
    function price(item, inventory, discount) {
        const held = item.consumable ? heldCount(inventory, item.id) : 0;
        return Economy.shopPrice(item.baseCost, held, discount);
    }

    // Can the player afford the next unit of this item?
    function canAfford(item, inventory, playerPoints, discount) {
        return playerPoints >= price(item, inventory, discount);
    }

    /**
     * Level-perk gift: returns a NEW inventory with `count` more of a HELD
     * (consumable) item. Non-consumables (pushback — instant, can't be held)
     * and unknown ids are refused as { ok: false } with the inventory
     * unchanged, so a bad LEVEL_PERKS row is a visible no-op, never a
     * corrupted inventory.
     */
    function grant(itemId, count, catalog, inventory) {
        const item = getItem(itemId, catalog);
        const n = Math.floor(count);
        if (!item || !item.consumable || !(n > 0)) {
            return { ok: false, newInventory: inventory };
        }
        const newInventory = Object.assign({}, inventory);
        newInventory[item.id] = heldCount(inventory, item.id) + n;
        return { ok: true, item, newInventory };
    }

    /**
     * Attempt to buy one unit. Pure — returns a result object; caller applies it.
     *   { ok: true,  cost, newPoints, newInventory }
     *   { ok: false, reason: 'unknown_item' | 'insufficient_points', cost }
     * Consumable items are added to newInventory (held count +1). Non-consumable
     * items (pushback) are NOT added — they're applied instantly by the caller —
     * so newInventory is returned unchanged for them.
     */
    function purchase(itemId, catalog, inventory, playerPoints, discount) {
        const item = getItem(itemId, catalog);
        if (!item) return { ok: false, reason: 'unknown_item', cost: 0 };

        const cost = price(item, inventory, discount);
        if (playerPoints < cost) {
            return { ok: false, reason: 'insufficient_points', cost };
        }

        const newInventory = Object.assign({}, inventory);
        if (item.consumable) {
            newInventory[item.id] = heldCount(inventory, item.id) + 1;
        }

        return {
            ok: true,
            item,
            cost,
            newPoints: Economy.subtractPoints(playerPoints, cost),
            newInventory,
        };
    }

    /**
     * Pure due-date shift for the pushback action (session 4, SHOP_PLAN.md).
     * Returns a NEW Date shifted later by pushbackMs — never mutates its
     * argument (callers own the item's state). A missing/zero pushbackMs is a
     * no-op shift (returns an equal-valued new Date). The caller is
     * responsible for re-deriving overdue state afterwards
     * (Items.recomputeOverdueStateAfterEdit).
     */
    function pushedBackDueDate(currentDueDate, pushbackMs) {
        return new Date(currentDueDate.getTime() + (pushbackMs || 0));
    }

    /**
     * Consume one held unit of a consumable item (repair-kit USE, session 3).
     * Pure — returns { ok, newInventory } with the held count decremented, or
     * { ok: false } if none are held. Never goes below zero.
     */
    function consume(itemId, inventory) {
        const held = heldCount(inventory, itemId);
        if (held <= 0) return { ok: false, newInventory: Object.assign({}, inventory) };

        const newInventory = Object.assign({}, inventory);
        if (held - 1 <= 0) {
            delete newInventory[itemId];
        } else {
            newInventory[itemId] = held - 1;
        }
        return { ok: true, newInventory };
    }

    return {
        getItem,
        heldCount,
        price,
        canAfford,
        purchase,
        grant,
        consume,
        pushedBackDueDate,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Shop;
}

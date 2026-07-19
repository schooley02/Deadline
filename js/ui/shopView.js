/**
 * ShopView — the Shop catalog grid opened from the FAB menu's 4th item
 * ([P1-UI-008], SHOP_PLAN.md session 2, 2026-07-18).
 *
 * Renders `CONFIG.SHOP_ITEMS` as cards with a LIVE price (via `Shop.price`,
 * js/shop.js), a held-count for consumables, a Buy button wired to
 * `Shop.purchase`, and — for held consumables (repair kits) — a Use button
 * wired to `Shop.consume` + `Damage.healBase` (session 3, SHOP_PLAN.md,
 * 2026-07-19). No DOM state is owned here and no script.js state is closed
 * over — everything arrives via an explicit deps object, same pattern as
 * managementWindows.js / routineViews.js.
 *
 * Pushback items (`consumable: false`) can't be bought-to-hold — they're
 * applied to a specific zombie from the enemy-click popup (js/ui/popups.js,
 * session 4). Their cards show the price but a "tap a zombie" hint in place
 * of a Buy button, so points are never spent into the void. Pricing is flat
 * (base cost every time) for now — `Shop.price` returns baseCost for
 * non-consumables since `held` is always 0; any per-run inflation is a
 * session-5 balance decision (Jeremy, 2026-07-19). No Use button either.
 */
const ShopView = (() => {

    const CATEGORY_ICON = {
        repair: '🔧',
        pushback: '⏩',
        cheatDay: '🎟️',
        sickDay: '🤒',
        skipDay: '⏭️',
    };

    // Builds one catalog card. Pure DOM construction, no mutation of deps.
    // baseHealth/onUse are only meaningful for repair kits (consumable,
    // category 'repair') — pushback items pass them through unused today.
    function buildItemCard(item, inventory, playerPoints, onBuy, baseHealth, onUse) {
        const held = item.consumable ? Shop.heldCount(inventory, item.id) : 0;
        const cost = Shop.price(item, inventory);
        const affordable = Shop.canAfford(item, inventory, playerPoints);

        const card = document.createElement('div');
        card.className = 'shop-item-card';
        card.dataset.itemId = item.id;

        const heldRow = item.consumable
            ? `<div class="shop-item-held">Held: ${held}</div>`
            : '';

        // "Why did the price go up" feedback (ECONOMY.md UI requirement) —
        // only shown once held > 0, since that's the only state where the
        // next price differs from baseCost.
        const priceNote = item.consumable && held > 0
            ? `<div class="shop-item-note">Price rises ×1.5 per one you hold</div>`
            : '';

        // Use button (session 3, repair kits only, extended sub-session 5 to
        // Sick Day): shown once you hold at least one. Repair kits disable
        // once the base is already at full health so a kit can't be wasted
        // for zero effect; Sick Day has no such precondition — it's always
        // usable once held (the handler is a defensive no-op otherwise).
        const isRepairKit = item.effect && typeof item.effect.healAmount === 'number';
        const isSickDay = item.category === 'sickDay';
        const canUse = item.consumable && held > 0 && (isRepairKit || isSickDay);
        const atFullHealth = typeof baseHealth === 'number' && baseHealth >= CONFIG.MAX_BASE_HEALTH;
        const useRow = canUse
            ? (isSickDay
                ? `<button type="button" class="shop-use-button">Use (excuses every habit today)</button>`
                : `<button type="button" class="shop-use-button"${atFullHealth ? ' disabled' : ''}>
                       ${atFullHealth ? 'Base at full health' : `Use (+${item.effect.healAmount} HP)`}
                   </button>`)
            : '';

        // Pushback (non-consumable) can't be bought-to-hold — it's applied to
        // a specific zombie from the enemy-click popup (session 4). So its card
        // shows the price but routes the player to the real action instead of
        // a Buy button that would spend points for nothing.
        const actionRow = item.consumable
            ? `<button type="button" class="shop-buy-button"${affordable ? '' : ' disabled'}>
                   ${affordable ? 'Buy' : 'Not enough points'}
               </button>`
            : `<div class="shop-item-note shop-pushback-hint">Tap a zombie to push it back</div>`;

        // Cheat Day ([P1-DATA-005] sub-session 5, 2026-07-19): consumable
        // (Buy-to-hold, like repair kits) but "used" by tapping a specific
        // negative-habit lurker's popup, not a card button — reuses
        // pushback's targeting pattern. Only shown once you hold at least
        // one; nothing to target with zero held.
        const cheatDayHintRow = (item.category === 'cheatDay' && held > 0)
            ? `<div class="shop-item-note shop-cheatday-hint">Tap a negative habit to use</div>`
            : '';

        // Skip Day (frozen-slots sub-session 5, 2026-07-19): same targeted-
        // consumable shape as Cheat Day — buy-to-hold here, "used" by
        // tapping a specific habit's popup instead of a card button. Unlike
        // Cheat Day the hint says "habit," not "negative habit" — Skip Day
        // reaches any habit type.
        const skipDayHintRow = (item.category === 'skipDay' && held > 0)
            ? `<div class="shop-item-note shop-skipday-hint">Tap a habit to use</div>`
            : '';

        card.innerHTML = `
            <div class="shop-item-header">
                <span class="shop-item-icon">${CATEGORY_ICON[item.category] || '🛒'}</span>
                <span class="shop-item-name">${item.name}</span>
            </div>
            <div class="shop-item-body">
                ${heldRow}
                <div class="shop-item-price">${cost} pts</div>
                ${priceNote}
            </div>
            ${actionRow}
            ${useRow}
            ${cheatDayHintRow}
            ${skipDayHintRow}
        `;

        // Real listeners, not inline onclick — script.js is a DOMContentLoaded
        // closure, so any inline onclick= string would need window.* exposure
        // (see SHOP_PLAN.md hazards). Direct listeners sidestep that.
        const buyButton = card.querySelector('.shop-buy-button');
        if (buyButton) buyButton.addEventListener('click', () => onBuy(item.id));

        if (canUse) {
            const useButton = card.querySelector('.shop-use-button');
            useButton.addEventListener('click', () => onUse(item.id));
        }

        return card;
    }

    // deps: { catalog, inventory, playerPoints, baseHealth, onBuy, onUse }
    function renderShopWindow(deps) {
        const list = document.getElementById('shopWindowList');
        if (!list) return;

        list.innerHTML = '';
        deps.catalog.forEach(item => {
            list.appendChild(buildItemCard(
                item, deps.inventory, deps.playerPoints, deps.onBuy, deps.baseHealth, deps.onUse
            ));
        });
    }

    // Transient feedback line above the grid (e.g. a race where the button's
    // disabled state was stale). Auto-hides after a couple seconds.
    function showShopMessage(text) {
        const el = document.getElementById('shopMessage');
        if (!el) return;
        el.textContent = text;
        el.classList.remove('hidden');
        window.clearTimeout(showShopMessage._t);
        showShopMessage._t = window.setTimeout(() => el.classList.add('hidden'), 2500);
    }

    return {
        renderShopWindow,
        buildItemCard,
        showShopMessage,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShopView;
}

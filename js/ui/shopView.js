/**
 * ShopView — the Shop catalog grid opened from the FAB menu's 4th item
 * ([P1-UI-008], SHOP_PLAN.md session 2, 2026-07-18).
 *
 * Renders `CONFIG.SHOP_ITEMS` as cards with a LIVE price (via `Shop.price`,
 * js/shop.js), a held-count for consumables, and a Buy button wired to
 * `Shop.purchase`. No DOM state is owned here and no script.js state is
 * closed over — everything arrives via an explicit deps object, same pattern
 * as managementWindows.js / routineViews.js.
 *
 * Scope for this session: catalog display + buy-into-inventory only. Repair
 * kits land in `playerInventory` but USE (-> Damage.healBase) is session 3;
 * pushback targeting is session 4. Buying a pushback item today just adds a
 * consumable-looking purchase flow with no held count (see js/shop.js —
 * pushback items have `consumable: false`, so `Shop.price` never inflates
 * them yet; that's the session-4 pricing wrinkle, not a bug here).
 */
const ShopView = (() => {

    const CATEGORY_ICON = {
        repair: '🔧',
        pushback: '⏩',
    };

    // Builds one catalog card. Pure DOM construction, no mutation of deps.
    function buildItemCard(item, inventory, playerPoints, onBuy) {
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
            <button type="button" class="shop-buy-button"${affordable ? '' : ' disabled'}>
                ${affordable ? 'Buy' : 'Not enough points'}
            </button>
        `;

        // Real listener, not inline onclick — script.js is a DOMContentLoaded
        // closure, so any inline onclick= string would need window.* exposure
        // (see SHOP_PLAN.md hazards). A direct listener sidesteps that.
        const buyButton = card.querySelector('.shop-buy-button');
        buyButton.addEventListener('click', () => onBuy(item.id));

        return card;
    }

    // deps: { catalog, inventory, playerPoints, onBuy }
    function renderShopWindow(deps) {
        const list = document.getElementById('shopWindowList');
        if (!list) return;

        list.innerHTML = '';
        deps.catalog.forEach(item => {
            list.appendChild(buildItemCard(item, deps.inventory, deps.playerPoints, deps.onBuy));
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

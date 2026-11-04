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
    function buildItemCard(item, inventory, playerPoints, onBuy, baseHealth, onUse, discount) {
        const held = item.consumable ? Shop.heldCount(inventory, item.id) : 0;
        const cost = Shop.price(item, inventory, discount);
        const affordable = Shop.canAfford(item, inventory, playerPoints, discount);

        const card = document.createElement('div');
        card.className = 'shop-item-card' + (held > 0 ? ' shop-item-card--owned' : '');
        card.dataset.itemId = item.id;

        // Owned count (2026-11-04, Jeremy: the shop must show how many you have). A green "×N" pill in the card
        // header, only when you hold at least one; nothing at zero. Replaces the old grey "Held: N" line, which
        // was easy to miss. The "You have" row at the top of the Shop lists the same counts (ownedSummary).
        const heldPill = held > 0
            ? `<span class="shop-item-owned" aria-label="You have ${held}">×${held}</span>`
            : '';

        // "Why did the price go up" feedback (ECONOMY.md UI requirement) —
        // only shown once held > 0, since that's the only state where the
        // next price differs from baseCost.
        const priceNote = item.consumable && held > 0
            ? `<div class="shop-item-note">Price rises ×1.5 per one you hold</div>`
            : '';

        // Level-perk discount tag (2026-10-23): shown on every card while a
        // discount perk is active, so the lower price is explained, not mysterious.
        const discountNote = (typeof discount === 'number' && discount > 0)
            ? `<div class="shop-item-note shop-discount-note">Level perk: −${Math.round(discount * 100)}%</div>`
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

        // What a repair kit does, shown BEFORE buying (2026-10-26, Jeremy: the
        // heal amount only appeared on the Use button, i.e. after purchase).
        const effectRow = isRepairKit
            ? `<div class="shop-item-effect">Heals +${item.effect.healAmount} HP</div>`
            : '';

        // Every shop item is a consumable you hold (pushback charges, Build C, 2026-11-02: the old "Tap a zombie to push it
        // back" hint is gone; the pushback tokens are held and used automatically, see pushbackSectionHeaderHtml).
        const actionRow = `<button type="button" class="shop-buy-button"${affordable ? '' : ' disabled'}>
                   ${affordable ? 'Buy' : 'Not enough points'}
               </button>`;

        // Cheat Day ([P1-DATA-005] sub-session 5, 2026-07-19): consumable
        // (Buy-to-hold, like repair kits) but "used" by tapping a specific
        // negative-habit lurker's popup, not a card button — reuses
        // pushback's targeting pattern. Only shown once you hold at least
        // one; nothing to target with zero held.
        const cheatDayHintRow = (item.category === 'cheatDay' && held > 0)
            ? `<div class="shop-item-note shop-cheatday-hint">Tap a Break habit to use</div>`
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
                ${heldPill}
            </div>
            <div class="shop-item-body">
                ${effectRow}
                <div class="shop-item-price">${cost} pts</div>
                ${priceNote}
                ${discountNote}
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

    // Pushback tokens section header (Build C): title, the one-line "used automatically" explanation and the shared (i)
    // panel (PushbackHelp, with live numbers when `getCtx` is given). Spans the whole grid row.
    function buildPushbackHeader(getCtx) {
        const head = document.createElement('div');
        head.className = 'shop-section-header';
        const ctx = typeof getCtx === 'function' ? getCtx() : null;
        const has = typeof PushbackHelp !== 'undefined';
        const line = has ? PushbackHelp.SHOP_LINE : 'Used automatically when your free pushbacks run out.';
        head.innerHTML = `<div class="shop-section-title-row"><h4 class="shop-section-title">Pushback tokens</h4>` +
            `${has ? PushbackHelp.hintButtonHtml('shopPushbackHint', 'How pushbacks work') : ''}</div>` +
            `<p class="shop-section-line">${line}</p>` +
            `${has ? PushbackHelp.hintPopHtml('shopPushbackHint', ctx || {}) : ''}`;
        if (typeof PushbackHelp !== 'undefined') PushbackHelp.wireHint(head);
        return head;
    }

    // Everything you hold, in catalog order: [{ id, name, icon, count }]. Pure. Only catalog items with a held count
    // above zero; inventory keys that aren't in the catalog are ignored.
    function ownedSummary(catalog, inventory) {
        return (catalog || [])
            .filter(item => item.consumable)
            .map(item => ({
                id: item.id,
                name: item.name,
                icon: CATEGORY_ICON[item.category] || '🛒',
                count: Shop.heldCount(inventory, item.id),
            }))
            .filter(row => row.count > 0);
    }

    // "You have" row at the top of the grid (2026-11-04). One chip per held item ("🔧 Repair Kit (Small) ×2");
    // tapping a chip scrolls its card into view (handy in phone landscape, where only three cards fit). With
    // nothing held it says so. Spans the whole grid row like the pushback section header.
    function buildOwnedRow(catalog, inventory) {
        const rows = ownedSummary(catalog, inventory);
        const wrap = document.createElement('div');
        wrap.className = 'shop-owned-row';
        const title = document.createElement('span');
        title.className = 'shop-owned-title';
        title.textContent = 'You have';
        wrap.appendChild(title);

        if (rows.length === 0) {
            const none = document.createElement('span');
            none.className = 'shop-owned-none';
            none.textContent = 'Nothing yet';
            wrap.appendChild(none);
            return wrap;
        }

        rows.forEach(row => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'shop-owned-chip';
            chip.dataset.itemId = row.id;
            chip.setAttribute('aria-label', `${row.name}: you have ${row.count}`);
            chip.innerHTML = `<span class="shop-owned-chip-icon" aria-hidden="true">${row.icon}</span>` +
                `<span class="shop-owned-chip-name">${row.name}</span>` +
                `<span class="shop-owned-chip-count">×${row.count}</span>`;
            chip.addEventListener('click', () => {
                const list = wrap.parentElement;
                const target = list && list.querySelector(`.shop-item-card[data-item-id="${row.id}"]`);
                if (target && typeof target.scrollIntoView === 'function') {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' }); // scroll-margin-top in css keeps the badge in view
                }
            });
            wrap.appendChild(chip);
        });
        return wrap;
    }

    // deps: { catalog, inventory, playerPoints, baseHealth, onBuy, onUse, discount?, pushbackHelpCtx? }
    function renderShopWindow(deps) {
        const list = document.getElementById('shopWindowList');
        if (!list) return;

        // Balance next to the title. Both render paths (window open and
        // script.js populateShopWindow) land here, so it stays current after buys.
        const pointsEl = document.getElementById('shopWindowPoints');
        if (pointsEl) {
            pointsEl.textContent = `${deps.playerPoints} pts`;
            pointsEl.classList.toggle('shop-points--debt', deps.playerPoints < 0);
        }

        // "How points work" (i) next to the balance (2026-11-02). Words come from PointsInfo.rulesLines(CONFIG), so the
        // numbers can't drift from the real rules. Same tap-to-show pattern as the pushback (i); wireHint is idempotent.
        const pointsHintBtn = document.getElementById('shopPointsHintBtn');
        const pointsHintPop = document.getElementById('shopPointsHint');
        if (pointsHintBtn && pointsHintPop && typeof PointsInfo !== 'undefined') {
            pointsHintPop.innerHTML = '<ul>' + PointsInfo.rulesLines(CONFIG).map(l => `<li>${l}</li>`).join('') + '</ul>';
            pointsHintBtn.hidden = false;
            if (typeof PushbackHelp !== 'undefined') PushbackHelp.wireHint(document.getElementById('shopWindow'));
        }

        list.innerHTML = '';
        list.appendChild(buildOwnedRow(deps.catalog, deps.inventory));
        let pushbackHeaderDone = false;
        deps.catalog.forEach(item => {
            // Section header + (i) once, above the first pushback token card.
            if (item.category === 'pushback' && !pushbackHeaderDone) {
                pushbackHeaderDone = true;
                list.appendChild(buildPushbackHeader(deps.pushbackHelpCtx));
            }
            list.appendChild(buildItemCard(
                item, deps.inventory, deps.playerPoints, deps.onBuy, deps.baseHealth, deps.onUse, deps.discount
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
        buildOwnedRow,
        ownedSummary,
        showShopMessage,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShopView;
}

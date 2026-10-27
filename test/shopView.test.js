/**
 * @jest-environment jsdom
 *
 * ShopView card tests (2026-10-26). Repair kits must say how much they heal
 * BEFORE purchase (Jeremy: the amount only showed on the Use button, i.e.
 * after buying one).
 */
global.CONFIG = require('../js/config.js');
global.Economy = require('../js/economy.js');
global.Shop = require('../js/shop.js');
const ShopView = require('../js/ui/shopView.js');

const CATALOG = CONFIG.SHOP_ITEMS;
const noop = () => {};

function card(itemId, inventory = {}) {
    const item = CATALOG.find((i) => i.id === itemId);
    return ShopView.buildItemCard(item, inventory, 1000, noop, 50, noop, 0);
}

describe('repair kit heal amount on the shop card', () => {
    test.each(['repair_small', 'repair_medium', 'repair_large'])('%s shows its heal amount with none held', (id) => {
        const heal = CATALOG.find((i) => i.id === id).effect.healAmount;
        const effect = card(id).querySelector('.shop-item-effect');
        expect(effect).not.toBeNull();
        expect(effect.textContent).toBe(`Heals +${heal} HP`);
        expect(card(id).querySelector('.shop-use-button')).toBeNull(); // nothing held yet
    });

    test('still shown once a kit is held (alongside the Use button)', () => {
        const el = card('repair_small', { repair_small: 1 });
        expect(el.querySelector('.shop-item-effect')).not.toBeNull();
        expect(el.querySelector('.shop-use-button')).not.toBeNull();
    });

    test('non-repair items get no heal line', () => {
        expect(card('cheat_day').querySelector('.shop-item-effect')).toBeNull();
        expect(card('pushback_1hr').querySelector('.shop-item-effect')).toBeNull();
    });
});

describe('points balance in the shop window header (2026-10-27)', () => {
    function render(points) {
        document.body.innerHTML = '<span id="shopWindowPoints"></span><div id="shopWindowList"></div>';
        ShopView.renderShopWindow({
            catalog: CATALOG, inventory: {}, playerPoints: points, baseHealth: 50,
            onBuy: noop, onUse: noop, discount: 0,
        });
        return document.getElementById('shopWindowPoints');
    }

    test('shows the balance and refreshes on every render', () => {
        expect(render(120).textContent).toBe('120 pts');
        expect(document.getElementById('shopWindowPoints').classList.contains('shop-points--debt')).toBe(false);
        const el = document.getElementById('shopWindowPoints');
        ShopView.renderShopWindow({ catalog: CATALOG, inventory: {}, playerPoints: 70, baseHealth: 50, onBuy: noop, onUse: noop, discount: 0 });
        expect(el.textContent).toBe('70 pts');
    });

    test('debt gets the debt class', () => {
        const el = render(-15);
        expect(el.textContent).toBe('-15 pts');
        expect(el.classList.contains('shop-points--debt')).toBe(true);
    });

    test('renders fine when the header element is missing', () => {
        document.body.innerHTML = '<div id="shopWindowList"></div>';
        expect(() => ShopView.renderShopWindow({ catalog: CATALOG, inventory: {}, playerPoints: 5, baseHealth: 50, onBuy: noop, onUse: noop, discount: 0 })).not.toThrow();
    });
});

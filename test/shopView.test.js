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

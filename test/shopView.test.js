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
global.PushbackHelp = require('../js/ui/pushbackHelp.js');
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
        expect(card('pushback_short').querySelector('.shop-item-effect')).toBeNull();
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

describe('pushback tokens section (Build C)', () => {
    const render = (extra) => {
        document.body.innerHTML = '<span id="shopWindowPoints"></span><div id="shopWindowList"></div>';
        ShopView.renderShopWindow(Object.assign({
            catalog: CATALOG, inventory: {}, playerPoints: 1000, baseHealth: 50, onBuy: noop, onUse: noop, discount: 0,
        }, extra));
        return document.getElementById('shopWindowList');
    };

    test('one header above the first pushback token, with the one-line explanation and an (i)', () => {
        const list = render({ pushbackHelpCtx: () => ({ star: 2, allowance: { short: 4, medium: 2, long: 2 }, left: { short: 4, medium: 2, long: 2 }, held: {} }) });
        const headers = list.querySelectorAll('.shop-section-header');
        expect(headers.length).toBe(1);
        expect(headers[0].querySelector('.shop-section-title').textContent).toBe('Pushback tokens');
        expect(headers[0].querySelector('.shop-section-line').textContent).toBe('Used automatically when your free pushbacks run out.');
        const kids = [...list.children];
        const idx = kids.indexOf(headers[0]);
        expect(kids[idx + 1].textContent).toContain('Short Pushback');
        const pop = list.querySelector('#shopPushbackHint');
        expect(pop.hidden).toBe(true);
        list.querySelector('.form-hint-btn').click();
        expect(pop.hidden).toBe(false);
        expect(pop.textContent).toContain('Short 4 of 4 left today');
    });

    test('every pushback token has a Buy button and the old "Tap a zombie" hint is gone', () => {
        const list = render();
        expect(list.textContent).not.toContain('Tap a zombie to push it back');
        expect(list.querySelector('.shop-pushback-hint')).toBeNull();
        ['Short', 'Medium', 'Long'].forEach((n) => {
            const card = [...list.querySelectorAll('.shop-item-card')].find(c => c.textContent.includes(n + ' Pushback'));
            expect(card.querySelector('.shop-buy-button')).not.toBeNull();
        });
    });

    test('without the help ctx the header still renders (rules only)', () => {
        const list = render();
        expect(list.querySelector('.shop-section-header')).not.toBeNull();
        expect(list.querySelector('#shopPushbackHint').textContent).toContain('Rescheduling is free when');
    });
});

describe('owned counts (2026-11-04: the shop shows how many of each item you have)', () => {
    const render = (inventory) => {
        document.body.innerHTML = '<span id="shopWindowPoints"></span><div id="shopWindowList"></div>';
        ShopView.renderShopWindow({
            catalog: CATALOG, inventory, playerPoints: 1000, baseHealth: 50, onBuy: noop, onUse: noop, discount: 0,
        });
        return document.getElementById('shopWindowList');
    };
    const cardIn = (list, id) => list.querySelector(`.shop-item-card[data-item-id="${id}"]`);

    test('a held item gets a ×N pill in its header and the owned class', () => {
        const c = card('repair_small', { repair_small: 3 });
        const pill = c.querySelector('.shop-item-header .shop-item-owned');
        expect(pill).not.toBeNull();
        expect(pill.textContent).toBe('×3');
        expect(pill.getAttribute('aria-label')).toBe('You have 3');
        expect(c.classList.contains('shop-item-card--owned')).toBe(true);
    });

    test.each(CATALOG.map(i => i.id))('%s shows no count when none are held', (id) => {
        const c = card(id, {});
        expect(c.querySelector('.shop-item-owned')).toBeNull();
        expect(c.classList.contains('shop-item-card--owned')).toBe(false);
        expect(c.textContent).not.toMatch(/Held:/);
    });

    test('every held item gets its own pill (pushback tokens and day tokens too)', () => {
        const list = render({ pushback_medium: 1, sick_day: 2, cheat_day: 1 });
        expect(cardIn(list, 'pushback_medium').querySelector('.shop-item-owned').textContent).toBe('×1');
        expect(cardIn(list, 'sick_day').querySelector('.shop-item-owned').textContent).toBe('×2');
        expect(cardIn(list, 'cheat_day').querySelector('.shop-item-owned').textContent).toBe('×1');
        expect(cardIn(list, 'skip_day').querySelector('.shop-item-owned')).toBeNull();
    });

    test('ownedSummary lists held items in catalog order and skips unknown or empty keys', () => {
        const rows = ShopView.ownedSummary(CATALOG, { sick_day: 1, repair_small: 2, repair_large: 0, old_item: 5 });
        expect(rows.map(r => [r.id, r.count])).toEqual([['repair_small', 2], ['sick_day', 1]]);
        expect(rows[0].name).toBe('Repair Kit (Small)');
        expect(ShopView.ownedSummary(CATALOG, null)).toEqual([]);
    });

    test('the "You have" row is the first thing in the grid, one chip per held item', () => {
        const list = render({ repair_small: 2, pushback_medium: 1 });
        const row = list.firstElementChild;
        expect(row.classList.contains('shop-owned-row')).toBe(true);
        expect(row.querySelector('.shop-owned-title').textContent).toBe('You have');
        const chips = [...row.querySelectorAll('.shop-owned-chip')];
        expect(chips.map(c => c.dataset.itemId)).toEqual(['repair_small', 'pushback_medium']);
        expect(chips[0].querySelector('.shop-owned-chip-count').textContent).toBe('×2');
        expect(chips[0].textContent).toContain('Repair Kit (Small)');
        expect(row.querySelector('.shop-owned-none')).toBeNull();
    });

    test('with nothing held the row says "Nothing yet"', () => {
        const row = render({}).querySelector('.shop-owned-row');
        expect(row.querySelectorAll('.shop-owned-chip').length).toBe(0);
        expect(row.querySelector('.shop-owned-none').textContent).toBe('Nothing yet');
    });

    test('tapping a chip scrolls its card into view', () => {
        const list = render({ sick_day: 1 });
        const target = cardIn(list, 'sick_day');
        target.scrollIntoView = jest.fn();
        list.querySelector('.shop-owned-chip').click();
        expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    test('the row refreshes on every render (after a buy or use)', () => {
        render({ repair_small: 1 });
        const list = render({ repair_small: 2 });
        expect(list.querySelectorAll('.shop-owned-row').length).toBe(1);
        expect(list.querySelector('.shop-owned-chip-count').textContent).toBe('×2');
        expect(cardIn(list, 'repair_small').querySelector('.shop-item-owned').textContent).toBe('×2');
    });
});

/**
 * The Barricade card in the Base Health window (Momentum Build C, 2026-11-12).
 *
 * @jest-environment jsdom
 */
const CONFIG = require('../js/config.js');
global.BaseModel = require('../js/baseModel.js');
global.Modal = require('../js/ui/modal.js');
const BasePanel = require('../js/ui/basePanel.js');

const NOW = 1_000_000_000_000;
const ctxFor = (extra) => Object.assign({
    health: 100, nowMs: NOW, lastRegenTickMs: NOW, attackers: [],
    inventory: {}, shopItems: CONFIG.SHOP_ITEMS, config: CONFIG, points: 0, pushbackPrice: 50, pushbackLabel: '1 hr',
}, extra);

describe('Barricade card', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    test('no barricade in the context = no card', () => {
        const vm = BasePanel.buildViewModel(ctxFor());
        expect(vm.barricade).toBeUndefined();
        expect(BasePanel.innerHtml(vm)).not.toContain('bp-barricade');
    });
    test('names the state and the damage cut', () => {
        const solid = BasePanel.buildViewModel(ctxFor({ barricade: { name: 'Solid', cut: 0.1 } })).barricade;
        expect(solid.name).toBe('Solid');
        expect(solid.effect).toBe('10% less damage');
        expect(solid.ariaLabel).toContain('Open the Barricade window');
        expect(BasePanel.buildViewModel(ctxFor({ barricade: { name: 'Reinforced', cut: 0.2 } })).barricade.effect).toBe('20% less damage');
    });
    test('a weak barricade says it cuts nothing (never extra damage)', () => {
        expect(BasePanel.buildViewModel(ctxFor({ barricade: { name: 'Partial', cut: 0 } })).barricade.effect).toBe('no damage cut yet');
        expect(BasePanel.buildViewModel(ctxFor({ barricade: { name: 'None', cut: -1 } })).barricade.effect).toBe('no damage cut yet');
    });
    test('the card is a button with the barricade action', () => {
        const html = BasePanel.innerHtml(BasePanel.buildViewModel(ctxFor({ barricade: { name: 'Solid', cut: 0.1 } })));
        expect(html).toContain('data-action="barricade"');
        expect(html).toContain('10% less damage');
    });
    test('tapping it calls onBarricade and leaves the panel open', () => {
        const onBarricade = jest.fn();
        BasePanel.open({ getContext: () => ctxFor({ barricade: { name: 'Solid', cut: 0.1 } }), onBarricade });
        document.querySelector('[data-action="barricade"]').click();
        expect(onBarricade).toHaveBeenCalledTimes(1);
        expect(document.querySelector('.base-panel')).not.toBeNull();
    });
    test('script.js feeds the card from the same momentum read and wires the opener', () => {
        const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'script.js'), 'utf8');
        expect(src).toContain('onBarricade: () => openBarricadeWindow()');
        expect(src).toMatch(/barricade: \(\(\) => \{ const mi = momentumNow\(nowMs\)/);
    });
});

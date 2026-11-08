/**
 * @jest-environment jsdom
 *
 * DevPanel (dev tools, 2026-11-03): the DEV button + demo panel. Pure model / markup, then the DOM behaviour: hidden until the
 * Settings switch is on, opens a no-backdrop card, every choice goes through DevDemo, clicks never bubble out (Modal's
 * outside-click dismiss would close a window underneath), and turning the switch off clears the demo.
 */
const RunClimate = require('../js/runClimate.js');
const DevDemo = require('../js/devDemo.js');
const DevPanel = require('../js/ui/devPanel.js');

const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const btn = () => document.getElementById('devButton');
const panel = () => document.getElementById('devPanel');
const q = (sel) => panel().querySelector(sel);

beforeEach(() => {
    DevDemo.resetForTests();
    document.body.innerHTML = '';
});

describe('panelModel (pure)', () => {
    test('with nothing forced: Real is selected everywhere and the trend chips are disabled', () => {
        const m = DevPanel.panelModel({ enabled: true, band: null, trend: 'steady', tier: null, active: false });
        expect(m.bands.map((b) => b.value)).toEqual(['real', 'clear', 'hazy', 'overcast', 'fog', 'storm']);
        expect(m.bands.filter((b) => b.selected).map((b) => b.value)).toEqual(['real']);
        expect(m.trends.every((t) => t.disabled && !t.selected)).toBe(true);
        expect(m.tiers.map((t) => t.value)).toEqual(['real', '1', '2', '3', '4', '5']);
        expect(m.tiers.filter((t) => t.selected).map((t) => t.value)).toEqual(['real']);
        expect(m.active).toBe(false);
    });

    test('a forced band + trend + star are the selected ones and enable the trend chips', () => {
        const m = DevPanel.panelModel({ enabled: true, band: 'fog', trend: 'up', tier: 4, active: true });
        expect(m.bands.filter((b) => b.selected).map((b) => b.value)).toEqual(['fog']);
        expect(m.trends.filter((t) => t.selected).map((t) => t.value)).toEqual(['up']);
        expect(m.trends.some((t) => t.disabled)).toBe(false);
        expect(m.tiers.filter((t) => t.selected).map((t) => t.value)).toEqual(['4']);
        expect(m.active).toBe(true);
    });

    test('the band list is exactly the five RunClimate bands (no band the sky cannot draw)', () => {
        expect(DevPanel.panelModel({}).bands.slice(1).map((b) => b.value)).toEqual(RunClimate.BANDS);
    });
});

describe('panelHtml (pure)', () => {
    test('every chip says whether it is pressed, and carries its data attribute', () => {
        const html = DevPanel.panelHtml(DevPanel.panelModel({ enabled: true, band: 'storm', trend: 'down', tier: 2, active: true }));
        expect(html).toContain('data-dev-band="storm"');
        expect(html).toMatch(/data-dev-band="storm" aria-pressed="true"/);
        expect(html).toMatch(/data-dev-band="fog" aria-pressed="false"/);
        expect(html).toContain('data-dev-trend="down"');
        expect(html).toContain('data-dev-tier="2"');
        expect(html).toContain('data-dev-reset');
        expect(html).toContain('data-dev-close');
        expect(html).toContain('Nothing here is saved');
    });

    test('Reset is disabled when no demo is active, enabled when one is', () => {
        const off = DevPanel.panelHtml(DevPanel.panelModel({ active: false }));
        const on = DevPanel.panelHtml(DevPanel.panelModel({ active: true, band: 'fog' }));
        expect(off).toMatch(/data-dev-reset disabled/);
        expect(on).not.toMatch(/data-dev-reset disabled/);
    });
});

describe('the button + panel', () => {
    test('init puts a hidden DEV button and a hidden panel on the page; the switch shows the button', () => {
        DevPanel.init({ demo: DevDemo });
        expect(btn()).not.toBeNull();
        expect(btn().hidden).toBe(true);
        expect(panel().hidden).toBe(true);
        DevPanel.setEnabled(true);
        expect(btn().hidden).toBe(false);
        expect(btn().textContent).toContain('DEV');
        expect(panel().hidden).toBe(true);
    });

    test('tapping the button opens the panel, again closes it; the x closes it too', () => {
        DevPanel.init({ demo: DevDemo });
        DevPanel.setEnabled(true);
        click(btn());
        expect(panel().hidden).toBe(false);
        expect(btn().getAttribute('aria-expanded')).toBe('true');
        click(btn());
        expect(panel().hidden).toBe(true);
        click(btn());
        click(q('[data-dev-close]'));
        expect(panel().hidden).toBe(true);
        expect(btn().getAttribute('aria-expanded')).toBe('false');
    });

    test('the panel is not a Modal overlay: no backdrop, nothing dims the scene', () => {
        DevPanel.init({ demo: DevDemo });
        DevPanel.setEnabled(true);
        click(btn());
        expect(document.querySelector('.modal-overlay')).toBeNull();
        expect(panel().parentNode).toBe(document.body);
    });

    test('picking a band, trend and star goes through DevDemo and the panel redraws', () => {
        DevPanel.init({ demo: DevDemo });
        DevPanel.setEnabled(true);
        click(btn());
        click(q('[data-dev-band="fog"]'));
        expect(DevDemo.weather(RunClimate)).toMatchObject({ band: 'fog', trend: 'steady' });
        expect(q('[data-dev-band="fog"]').getAttribute('aria-pressed')).toBe('true');
        click(q('[data-dev-trend="up"]'));
        expect(DevDemo.weather(RunClimate)).toMatchObject({ band: 'fog', trend: 'up' });
        click(q('[data-dev-tier="5"]'));
        expect(DevDemo.villageTier()).toBe(5);
        expect(q('[data-dev-tier="5"]').getAttribute('aria-pressed')).toBe('true');
        click(q('[data-dev-band="real"]'));
        expect(DevDemo.weather(RunClimate)).toBeNull();
        expect(DevDemo.villageTier()).toBe(5);
    });

    test('a disabled trend chip does nothing while the real sky is showing', () => {
        DevPanel.init({ demo: DevDemo });
        DevPanel.setEnabled(true);
        click(btn());
        click(q('[data-dev-trend="down"]'));
        expect(DevDemo.snapshot().trend).toBe('steady');
    });

    test('a demo puts the dot on the button; Reset removes it and the demo', () => {
        DevPanel.init({ demo: DevDemo });
        DevPanel.setEnabled(true);
        expect(btn().classList.contains('dev-button--active')).toBe(false);
        click(btn());
        click(q('[data-dev-band="storm"]'));
        expect(btn().classList.contains('dev-button--active')).toBe(true);
        click(q('[data-dev-tier="3"]'));
        click(q('[data-dev-reset]'));
        expect(btn().classList.contains('dev-button--active')).toBe(false);
        expect(DevDemo.snapshot()).toMatchObject({ band: null, trend: 'steady', tier: null });
        expect(DevDemo.snapshot().enabled).toBe(true);
    });

    test('onDemoChange fires for every change (script.js redraws the sky + village from it)', () => {
        const onDemoChange = jest.fn();
        DevPanel.init({ demo: DevDemo, onDemoChange });
        DevPanel.setEnabled(true);
        onDemoChange.mockClear();
        click(btn());
        click(q('[data-dev-band="hazy"]'));
        click(q('[data-dev-tier="2"]'));
        expect(onDemoChange).toHaveBeenCalledTimes(2);
    });

    test('a refresh that throws is logged, never fatal', () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        DevPanel.init({ demo: DevDemo, onDemoChange: () => { throw new Error('render failed'); } });
        DevPanel.setEnabled(true);
        click(btn());
        expect(() => click(q('[data-dev-band="fog"]'))).not.toThrow();
        expect(DevDemo.snapshot().band).toBe('fog');
        spy.mockRestore();
    });

    test('turning the switch off hides the button, closes the panel and clears the demo', () => {
        DevPanel.init({ demo: DevDemo });
        DevPanel.setEnabled(true);
        click(btn());
        click(q('[data-dev-band="storm"]'));
        click(q('[data-dev-tier="4"]'));
        DevPanel.setEnabled(false);
        expect(btn().hidden).toBe(true);
        expect(panel().hidden).toBe(true);
        expect(DevDemo.snapshot()).toMatchObject({ enabled: false, band: null, tier: null });
        expect(DevPanel.isOpen()).toBe(false);
    });

    test('with the switch off the button cannot open the panel (even if it is clicked)', () => {
        DevPanel.init({ demo: DevDemo });
        click(btn());
        expect(panel().hidden).toBe(true);
    });

    test('a second init replaces the first: one button, one panel, no doubled listeners', () => {
        const first = jest.fn();
        DevPanel.init({ demo: DevDemo, onDemoChange: first });
        DevPanel.init({ demo: DevDemo });
        expect(document.querySelectorAll('#devButton')).toHaveLength(1);
        expect(document.querySelectorAll('#devPanel')).toHaveLength(1);
        DevPanel.setEnabled(true);
        first.mockClear();
        click(btn());
        click(q('[data-dev-band="fog"]'));
        expect(first).not.toHaveBeenCalled();
    });
});

describe('church section', () => {
    test('the model lists Real + the five pictures, with the chosen one selected', () => {
        const none = DevPanel.panelModel({ enabled: true, church: null });
        expect(none.church.map((c) => c.value)).toEqual(['real', '100', '75', '50', '25', '0']);
        expect(none.church[0].selected).toBe(true);
        const half = DevPanel.panelModel({ enabled: true, church: 50 });
        expect(half.church.filter((c) => c.selected).map((c) => c.value)).toEqual(['50']);
        const zero = DevPanel.panelModel({ enabled: true, church: 0 });
        expect(zero.church.filter((c) => c.selected).map((c) => c.value)).toEqual(['0']);
    });

    test('tapping a church chip sets the demo; Real clears it; Reset clears it too', () => {
        DevPanel.init({ demo: DevDemo });
        DevPanel.setEnabled(true);
        click(btn());
        click(q('[data-dev-church="25"]'));
        expect(DevDemo.churchHealth()).toBe(25);
        expect(q('[data-dev-church="25"]').getAttribute('aria-pressed')).toBe('true');
        expect(q('[data-dev-reset]').disabled).toBe(false);
        click(q('[data-dev-church="real"]'));
        expect(DevDemo.churchHealth()).toBeNull();
        click(q('[data-dev-church="0"]'));
        expect(DevDemo.churchHealth()).toBe(0);
        click(q('[data-dev-reset]'));
        expect(DevDemo.churchHealth()).toBeNull();
    });

    test('a church change tells the app (onDemoChange) so the picture redraws', () => {
        const onDemoChange = jest.fn();
        DevPanel.init({ demo: DevDemo, onDemoChange });
        DevPanel.setEnabled(true);
        click(btn());
        onDemoChange.mockClear();
        click(q('[data-dev-church="75"]'));
        expect(onDemoChange).toHaveBeenCalledTimes(1);
    });

    test('Hit calls onHit and changes no demo value', () => {
        const onHit = jest.fn();
        DevPanel.init({ demo: DevDemo, onHit });
        DevPanel.setEnabled(true);
        click(btn());
        click(q('[data-dev-hit]'));
        expect(onHit).toHaveBeenCalledTimes(1);
        expect(DevDemo.snapshot().active).toBe(false);
        expect(q('[data-dev-reset]').disabled).toBe(true);
    });

    test('Hit with no onHit dep, or a throwing one, never throws', () => {
        DevPanel.init({ demo: DevDemo });
        DevPanel.setEnabled(true);
        click(btn());
        expect(() => click(q('[data-dev-hit]'))).not.toThrow();
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        DevPanel.init({ demo: DevDemo, onHit: () => { throw new Error('boom'); } });
        DevPanel.setEnabled(true);
        click(btn());
        expect(() => click(q('[data-dev-hit]'))).not.toThrow();
        spy.mockRestore();
    });

    test('church clicks do not bubble out of the panel', () => {
        DevPanel.init({ demo: DevDemo });
        DevPanel.setEnabled(true);
        click(btn());
        const seen = jest.fn();
        document.addEventListener('click', seen);
        click(q('[data-dev-church="50"]'));
        click(q('[data-dev-hit]'));
        document.removeEventListener('click', seen);
        expect(seen).not.toHaveBeenCalled();
    });
});

describe('clicks never bubble out (Modal dismiss would close a window underneath)', () => {
    test('button, chips, reset and close all stop propagation', () => {
        const seen = jest.fn();
        document.addEventListener('click', seen);
        DevPanel.init({ demo: DevDemo });
        DevPanel.setEnabled(true);
        click(btn());
        click(q('[data-dev-band="fog"]'));
        click(q('[data-dev-trend="up"]'));
        click(q('[data-dev-tier="2"]'));
        click(q('[data-dev-reset]'));
        click(q('.dev-panel-head'));
        click(q('[data-dev-close]'));
        document.removeEventListener('click', seen);
        expect(seen).not.toHaveBeenCalled();
    });
});

describe('graveyard monument + tree sections (2026-11-08)', () => {
    test('the model lists Real + 1..5 (monument) and Real + the three named tree stages, with the chosen one selected', () => {
        const none = DevPanel.panelModel({ enabled: true });
        expect(none.memorial.map((c) => c.value)).toEqual(['real', '1', '2', '3', '4', '5']);
        expect(none.tree.map((c) => c.value)).toEqual(['real', '1', '2', '3']);
        expect(none.tree.map((c) => c.label)).toEqual(['Real', '1 Sapling', '2 Young', '3 Giant']);
        expect(none.memorial[0].selected).toBe(true);
        expect(none.tree[0].selected).toBe(true);
        const m = DevPanel.panelModel({ enabled: true, memorial: 4, tree: 3, active: true });
        expect(m.memorial.filter((c) => c.selected).map((c) => c.value)).toEqual(['4']);
        expect(m.tree.filter((c) => c.selected).map((c) => c.value)).toEqual(['3']);
    });

    test('the panel has a Graveyard monument section and a Graveyard tree section', () => {
        const html = DevPanel.panelHtml(DevPanel.panelModel({ enabled: true }));
        expect(html).toContain('Graveyard monument');
        expect(html).toContain('Graveyard tree');
        expect(html).toContain('data-dev-memorial="5"');
        expect(html).toContain('data-dev-tree="3"');
    });

    test('tapping a chip sets the demo; Real clears it; Reset clears both', () => {
        DevPanel.init({ demo: DevDemo });
        DevPanel.setEnabled(true);
        click(btn());
        click(q('[data-dev-memorial="5"]'));
        click(q('[data-dev-tree="2"]'));
        expect(DevDemo.snapshot()).toMatchObject({ memorial: 5, tree: 2, active: true });
        expect(q('[data-dev-memorial="5"]').getAttribute('aria-pressed')).toBe('true');
        click(q('[data-dev-tree="real"]'));
        expect(DevDemo.snapshot().tree).toBeNull();
        click(q('[data-dev-reset]'));
        expect(DevDemo.snapshot()).toMatchObject({ memorial: null, tree: null, active: false });
    });
});

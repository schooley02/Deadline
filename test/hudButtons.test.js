const HudButtons = require('../js/ui/hudButtons');

describe('HudButtons.openButtons', () => {
    const showing = (...selectors) => (sel) => selectors.includes(sel);

    test('nothing open -> no buttons pressed', () => {
        expect(HudButtons.openButtons(showing())).toEqual([]);
    });

    test('each window maps to the button that opens it', () => {
        expect(HudButtons.openButtons(showing('.base-panel-overlay'))).toEqual(['baseHealthButton']);
        expect(HudButtons.openButtons(showing('.level-panel-overlay'))).toEqual(['levelButton']);
        expect(HudButtons.openButtons(showing('#heroTray.open'))).toEqual(['heroesButton']);
        expect(HudButtons.openButtons(showing('#goalsPane.open'))).toEqual(['goalsButton']);
        expect(HudButtons.openButtons(showing('#shopWindow:not(.hidden)'))).toEqual(['playerPointsStat']);
    });

    test('the village panel and its building cards both keep the village button pressed', () => {
        expect(HudButtons.openButtons(showing(HudButtons.WINDOWS.villageButton))).toEqual(['villageButton']);
    });

    test('every selector in the map is used for exactly one button', () => {
        const sels = Object.values(HudButtons.WINDOWS);
        expect(new Set(sels).size).toBe(sels.length);
        expect(Object.keys(HudButtons.WINDOWS).sort()).toEqual(['baseHealthButton', 'goalsButton', 'heroesButton', 'levelButton', 'playerPointsStat', 'villageButton']);
    });
});

describe('HudButtons collapse toggle (2026-11-25, Jeremy)', () => {
    const fs = require('fs');
    const path = require('path');
    const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
    const Settings = require('../js/settings');

    function fakeDoc(initial) {
        const classes = new Set();
        const attrs = {};
        const listeners = {};
        const panel = { classList: { toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); }, contains: (c) => classes.has(c) } };
        const btn = {
            title: '',
            closest: (sel) => (sel === '.resource-panel' ? panel : null),
            setAttribute: (k, v) => { attrs[k] = v; },
            addEventListener: (ev, fn) => { listeners[ev] = fn; },
        };
        const doc = { getElementById: (id) => (id === 'hudCollapseButton' ? btn : null) };
        return { doc, btn, classes, attrs, click: () => listeners.click(), initial };
    }

    test('collapseModel: label, aria state and the panel class follow the state', () => {
        expect(HudButtons.collapseModel(false)).toEqual({ collapsed: false, expanded: true, label: 'Hide top buttons', panelClass: 'hud-collapsed' });
        expect(HudButtons.collapseModel(true)).toEqual({ collapsed: true, expanded: false, label: 'Show top buttons', panelClass: 'hud-collapsed' });
        expect(HudButtons.collapseModel(undefined).collapsed).toBe(false);
    });

    test('starts from the saved state and each tap flips it and saves it', () => {
        const f = fakeDoc();
        const saved = [];
        HudButtons.initCollapse(f.doc, { get: () => true, set: (v) => saved.push(v) });
        expect(f.classes.has('hud-collapsed')).toBe(true);
        expect(f.attrs['aria-expanded']).toBe('false');
        expect(f.attrs['aria-label']).toBe('Show top buttons');
        f.click();
        expect(f.classes.has('hud-collapsed')).toBe(false);
        expect(f.attrs['aria-expanded']).toBe('true');
        expect(f.btn.title).toBe('Hide top buttons');
        f.click();
        expect(saved).toEqual([false, true]);
    });

    test('a missing button or a throwing store never breaks the HUD', () => {
        expect(HudButtons.initCollapse({ getElementById: () => null }, { get: () => true, set: () => {} })).toBeNull();
        const f = fakeDoc();
        HudButtons.initCollapse(f.doc, { get: () => { throw new Error('x'); }, set: () => { throw new Error('y'); } });
        expect(f.classes.has('hud-collapsed')).toBe(false);
        expect(() => f.click()).not.toThrow();
    });

    test('Settings.hudCollapsed: off by default, saved and read back, junk reads as off', () => {
        // testEnvironment is 'node': bind a tiny in-memory localStorage (the convention in test/settings.test.js)
        const store = new Map();
        global.localStorage = {
            getItem: (k) => (store.has(k) ? store.get(k) : null),
            setItem: (k, v) => store.set(k, String(v)),
            removeItem: (k) => store.delete(k),
        };
        expect(Settings.DEFAULTS.hudCollapsed).toBe(false);
        localStorage.removeItem(Settings.SETTINGS_KEY);
        expect(Settings.load().hudCollapsed).toBe(false);
        Settings.save({ hudCollapsed: true });
        expect(Settings.load().hudCollapsed).toBe(true);
        Settings.save({ effectsIntensity: 'reduced' }); // another field must not drop it
        expect(Settings.load().hudCollapsed).toBe(true);
        localStorage.setItem(Settings.SETTINGS_KEY, JSON.stringify({ hudCollapsed: 'yes' }));
        expect(Settings.load().hudCollapsed).toBe(false);
        localStorage.removeItem(Settings.SETTINGS_KEY);
        delete global.localStorage;
    });

    test('the markup: the toggle is the first thing in the row, before the six buttons, and starts expanded', () => {
        const html = read('index.html');
        const i = html.indexOf('id="hudCollapseButton"');
        expect(i).toBeGreaterThan(html.indexOf('class="resource-panel"'));
        expect(i).toBeLessThan(html.indexOf('id="baseHealthButton"'));
        expect(html).toMatch(/id="hudCollapseButton"[^>]*aria-expanded="true"/);
    });

    test('the CSS hides the six buttons only outside the portrait strip, and hides the toggle inside it', () => {
        const css = read('css/gameCanvas.css');
        expect(css).toContain('body:not(.glance-strip) .resource-panel.hud-collapsed { pointer-events: none; }');
        expect(css).toContain('body:not(.glance-strip) .resource-panel.hud-collapsed > button.stat-item { visibility: hidden; pointer-events: none; }');
        expect(css).toContain('body.glance-strip .hud-collapse-button { display: none; }');
    });

    test('script.js wires the toggle to Settings and keeps the preference out of Backup & Transfer', () => {
        const js = read('script.js');
        expect(js).toContain('HudButtons.initCollapse(document');
        expect(js).toContain('Settings.save({ hudCollapsed: on === true })');
        expect(js).toContain('delete st.hudCollapsed');
        expect(js).toContain('delete importedSettings.hudCollapsed');
    });
});

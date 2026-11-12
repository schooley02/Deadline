/**
 * @jest-environment jsdom
 *
 * The barricade on the canvas (Momentum Build C, 2026-11-11; docs/MOMENTUM_PLAN.md): the picture follows the momentum state, the tap opens
 * the Barricade window, art paths come from the Theme seam, and the pieces are wired (HTML, CSS layer order, service worker, script.js).
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
global.Theme = require('../js/theme.js');
const BarricadeView = require('../js/ui/barricadeView.js');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const STATES = CONFIG.MOMENTUM.BARRICADE_STATES;
const info = (id, name, count) => ({ count, max: 7, state: { id, name, min: count }, today: 'pending', nights: [] });

describe('Theme.barricadeAsset', () => {
    test('one picture per barricade state, under the theme root', () => {
        STATES.forEach((s) => expect(Theme.barricadeAsset(s.id)).toBe('Assets/Barricade/barricade_' + s.id + '.png'));
    });
    test('every state picture exists and is the 40x52 PNG the CSS draws at 2x (80x104)', () => {
        STATES.forEach((s) => {
            const file = path.join(root, Theme.barricadeAsset(s.id));
            expect(fs.existsSync(file)).toBe(true);
            const buf = fs.readFileSync(file);
            expect(buf.readUInt32BE(16)).toBe(40); // IHDR width
            expect(buf.readUInt32BE(20)).toBe(52); // IHDR height
        });
    });
    test('a bad or missing id is empty, and odd characters cannot climb out of the folder', () => {
        expect(Theme.barricadeAsset('')).toBe('');
        expect(Theme.barricadeAsset(null)).toBe('');
        expect(Theme.barricadeAsset('../x')).toBe('Assets/Barricade/barricade_x.png');
    });
});

describe('BarricadeView', () => {
    let el; let taps;
    beforeEach(() => {
        document.body.innerHTML = '<div id="barricade" class="barricade" role="button" tabindex="0" hidden></div>';
        el = document.getElementById('barricade');
        taps = 0;
        BarricadeView.init(el, { onTap: () => { taps += 1; } });
    });
    test('render shows the element with the state picture and a plain label', () => {
        BarricadeView.render(info('solid', 'Solid', 5));
        expect(el.hidden).toBe(false);
        expect(el.getAttribute('data-state')).toBe('solid');
        expect(el.style.backgroundImage).toContain('Assets/Barricade/barricade_solid.png');
        expect(el.getAttribute('aria-label')).toBe('Barricade: Solid, 5 of 7 nights. Open.');
    });
    test('all four states switch the picture', () => {
        STATES.forEach((s) => {
            BarricadeView.render(info(s.id, s.name, s.min));
            expect(el.getAttribute('data-state')).toBe(s.id);
            expect(el.style.backgroundImage).toContain('barricade_' + s.id + '.png');
        });
    });
    test('the picture is only rewritten when the state changes', () => {
        BarricadeView.render(info('partial', 'Partial', 3));
        el.style.backgroundImage = 'url("marker.png")';
        BarricadeView.render(info('partial', 'Partial', 4));
        expect(el.style.backgroundImage).toContain('marker.png');
        BarricadeView.render(info('solid', 'Solid', 5));
        expect(el.style.backgroundImage).toContain('barricade_solid.png');
    });
    test('only a child hit area takes taps, so the rest of the box lets taps through to the church', () => {
        expect(el.querySelectorAll('.barricade-hit')).toHaveLength(1);
        BarricadeView.init(el, { onTap: () => { taps += 1; } });
        expect(el.querySelectorAll('.barricade-hit')).toHaveLength(1); // init twice does not add another
        el.querySelector('.barricade-hit').click();
        expect(taps).toBe(1);
        const css = read('css/barricade.css');
        expect(css).toMatch(/\.barricade \{[^}]*pointer-events:\s*none/);
        expect(css).toMatch(/\.barricade-hit \{[^}]*pointer-events:\s*auto/);
    });
    test('no info = the None picture; no element = a quiet no-op', () => {
        BarricadeView.render(null);
        expect(el.getAttribute('data-state')).toBe('none');
        expect(BarricadeView.labelFor(null)).toBe('Barricade. Open.');
        BarricadeView.init(null);
        expect(() => BarricadeView.render(info('solid', 'Solid', 5))).not.toThrow();
    });
    test('a click or Enter / Space opens the window once each, and the click does not bubble', () => {
        let bubbled = 0;
        document.body.addEventListener('click', () => { bubbled += 1; });
        el.click();
        expect(taps).toBe(1);
        expect(bubbled).toBe(0);
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        expect(taps).toBe(3);
    });
});

describe('wiring', () => {
    test('index.html has #barricade before the midnight line, and loads the view after the window', () => {
        const html = read('index.html');
        const a = html.indexOf('id="barricade"');
        expect(a).toBeGreaterThan(-1);
        expect(a).toBeLessThan(html.indexOf('id="midnightLine"'));
        const tag = (f) => html.indexOf('<script src="' + f + '"></script>');
        expect(tag('js/ui/barricadeWindow.js')).toBeGreaterThan(-1);
        expect(tag('js/ui/barricadeWindow.js')).toBeLessThan(tag('js/ui/barricadeView.js'));
        expect(tag('js/theme.js')).toBeLessThan(tag('js/ui/barricadeView.js'));
    });
    test('the barricade sits above the church and BELOW the hero scrim and the zombies', () => {
        const css = read('css/barricade.css');
        const z = +/\.barricade \{[^}]*z-index:\s*(\d+)/.exec(css)[1];
        const scrim = +/#baseScrim \{[^}]*z-index:\s*(\d+)/.exec(read('css/heroSpotlight.css'))[1];
        expect(z).toBeGreaterThan(1);
        expect(z).toBeLessThan(scrim);
        expect(css).toMatch(/body\.glance-strip \.barricade/);
        expect(css).toMatch(/image-rendering:\s*pixelated/);
    });
    test('the service worker caches the view and every picture', () => {
        const sw = read('sw.js');
        expect(sw).toContain("'js/ui/barricadeView.js'");
        STATES.forEach((s) => expect(sw).toContain("'Assets/Barricade/barricade_" + s.id + ".png'"));
    });
    test('script.js wires the tap to the window, refreshes on the tick, and keeps the preview param visual-only', () => {
        const js = read('script.js');
        expect(js).toMatch(/BarricadeView\.init\(document\.getElementById\('barricade'\), \{ onTap: \(\) => openBarricadeWindow\(\) \}\)/);
        expect(js).toMatch(/Loop\.updateGame\(loopDeps\(\)\);\s*refreshBarricadeView\(false\);/);
        expect(js).toContain("get('barricade')");
        // the damage cut reads momentumNow() directly, never the preview
        const cut = /function barricadeDamageCut\(\) \{[\s\S]*?\n    \}/.exec(js)[0];
        expect(cut).toContain('momentumNow(now)');
        expect(cut).not.toContain("get('barricade')");
    });
});

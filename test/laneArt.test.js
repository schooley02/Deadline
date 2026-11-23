/**
 * Lane art rework (2026-11-22, Jeremy): the two-track gravel lane + dirt churchyard, wired in. Pins that both layers are anchored to the
 * CHURCH (--base-w), not to the screen (so storm puddles stay clear of the barricade), that the dry and storm art line up, and that taps
 * are body-only in landscape.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const gc = read('css/gameCanvas.css');
const strip = read('css/glanceStrip.css');
const sprites = read('css/enemySprites.css');
const CONFIG = require('../js/config.js');

describe('landscape ground', () => {
    const block = /\n\.scene-ground \{([^}]*)\}/.exec(gc)[1];
    test('yard over lane, both pictures at 2x their file size (640x36 / 280x36 art, chunky pixels like the church)', () => {
        expect(block).toMatch(/background-image: url\("\.\.\/Assets\/scene\/lane-yard\.png"\), url\("\.\.\/Assets\/scene\/lane-2track\.png"\);/);
        expect(block).toMatch(/background-size: 560px 72px, 1280px 72px;/);
        expect(block).toMatch(/background-repeat: no-repeat, repeat-x;/);
    });
    test('anchored to the church width, and the ground is the canvas width (offsets are canvas x)', () => {
        expect(block).toMatch(/background-position: calc\(var\(--base-w, 188px\) - 384px\) 100%, calc\(var\(--base-w, 188px\) - 235px\) 100%;/);
        expect(block).toMatch(/width: 100%;/);
        expect(block).toMatch(/left: 0;/);
    });
});

describe('portrait strip ground', () => {
    test('the same yard + lane files at 1:1, anchored to the 92px church window', () => {
        expect(strip).toMatch(/background-image: url\("\.\.\/Assets\/scene\/lane-yard\.png"\), url\("\.\.\/Assets\/scene\/lane-2track\.png"\);/);
        expect(strip).toMatch(/background-position: calc\(var\(--base-w, 92px\) - 192px\) 0, calc\(var\(--base-w, 92px\) - 118px\) 0;/);
        expect(strip).toMatch(/background-size: 280px 36px, 640px 36px;/);
    });
});

describe('body-only taps and ground shadow (landscape)', () => {
    test('the box takes no pointer events; its ::after (the drawn body) does', () => {
        expect(sprites).toMatch(/body:not\(\.glance-strip\) \.enemy \{ pointer-events: none; \}/);
        expect(sprites).toMatch(/body:not\(\.glance-strip\) \.enemy::after \{[^}]*pointer-events: auto;/);
        expect(sprites).toMatch(/\.enemy\.enemy-dying::after \{ pointer-events: none; \}/);
    });
    test('every zombie family\'s tap insets equal its measured visible margins', () => {
        Object.entries(CONFIG.ZOMBIE_VISIBLE_MARGINS).forEach(([cat, m]) => {
            const re = new RegExp('\\.zombie-' + cat + '\\s*\\{ --tap-l: ([0-9.]+); --tap-r: ([0-9.]+); \\}');
            const hit = re.exec(sprites);
            expect(hit).not.toBeNull();
            expect(Number(hit[1])).toBeCloseTo(m.left, 3);
            expect(Number(hit[2])).toBeCloseTo(m.right, 3);
        });
    });
    test('the fallback inset is the config fallback', () => {
        expect(sprites).toMatch(new RegExp('\\.enemy \\{ --tap-l: ' + CONFIG.ZOMBIE_VISIBLE_MARGIN_FALLBACK.left + '; --tap-r: ' + CONFIG.ZOMBIE_VISIBLE_MARGIN_FALLBACK.right + '; \\}'));
    });
});

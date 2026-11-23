/**
 * Graveyard v3 layers (2026-11-23): the flat fenced plot replaced the PixelLab hill and the growing tree. Three CSS-drawn picture layers,
 * each 84px wide art shown at exactly 2x (168px) with crisp pixels: ground (84x40), fence-back (84x52), fence-front (84x24). All share one
 * origin, CONFIG.GRAVEYARD_ART_REACH_PX (48px) left of the zone's left edge. Z order in the zone: ground 0, fence-back 1, stones 2,
 * fence-front 3, and the front fence takes no taps. Zone is 120px wide, flat. Replaces graveyardHillArt.test.js.
 */
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const css = read('css/graveyard.css');
const sw = read('sw.js');
const html = read('index.html');

function pngSize(rel) {
    const b = fs.readFileSync(path.join(root, rel));
    expect(b.slice(1, 4).toString()).toBe('PNG');
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
const block = (sel) => {
    const i = css.indexOf(`\n${sel} {`);
    expect(i).toBeGreaterThanOrEqual(0);
    return css.slice(i, css.indexOf('}', i));
};

const LAYERS = [
    { cls: '.graveyard-ground', file: 'graveyard-ground.png', w: 84, h: 40, z: 0 },
    { cls: '.graveyard-fence-back', file: 'graveyard-fence-back.png', w: 84, h: 52, z: 1 },
    { cls: '.graveyard-fence-front', file: 'graveyard-fence-front.png', w: 84, h: 24, z: 3 },
];

describe('graveyard v3 layers', () => {
    test.each(LAYERS)('$file is $w x $h and cached by the service worker', ({ file, w, h }) => {
        expect(pngSize(`Assets/scene/${file}`)).toEqual({ w, h });
        expect(sw).toContain(`'Assets/scene/${file}'`);
    });

    test.each(LAYERS)('$cls draws its art at exactly 2x, pixelated, from the shared origin, at z $z', ({ cls, file, w, h, z }) => {
        const shared = css.slice(css.indexOf('.graveyard-ground,'), css.indexOf('}', css.indexOf('.graveyard-ground,')));
        expect(shared).toContain(cls);
        expect(shared).toContain(`width: ${w * 2}px`);
        expect(shared).toMatch(/background-size: 100% 100%/);
        expect(shared).toMatch(/image-rendering: pixelated/);
        expect(shared).toContain('left: calc(var(--gy-reach, 48px) * -1)');
        expect(shared).toMatch(/bottom: 0;/);
        // the per-layer rule: its own picture, a height of exactly 2x the art's, and its z
        const own = new RegExp(`\\${cls} \\{ height: (\\d+)px; background-image: url\\("\\.\\./Assets/scene/${file}"\\); z-index: ${z}; \\}`).exec(css);
        expect(own).not.toBeNull();
        expect(Number(own[1])).toBe(h * 2);
    });

    test('the front fence is drawn above the headstones and takes no taps; the stones layer sits between the fences', () => {
        expect(css.slice(css.indexOf('.graveyard-ground,'), css.indexOf('}', css.indexOf('.graveyard-ground,')))).toMatch(/pointer-events: none;/); // the shared rule covers the front fence
        expect(block('.graveyard-stones')).toMatch(/z-index: 2;/);
    });

    test('markup order in index.html: ground, fence-back, stones, fence-front (inside #graveyardZone)', () => {
        const i = html.indexOf('id="graveyardZone"');
        expect(i).toBeGreaterThan(0);
        const zone = html.slice(i, html.indexOf('</div></div>', i) > 0 ? i + 600 : i + 600);
        const order = ['graveyard-ground', 'graveyard-fence-back', 'id="graveyardStones"', 'graveyard-fence-front'].map((k) => zone.indexOf(k));
        expect(order.every((n) => n > 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    test('the zone is a flat 120px (was a 140px hill) and the reach is 48px, in CONFIG and in the CSS fallbacks', () => {
        expect(CONFIG.GRAVEYARD_HILL_WIDTH_PX).toBe(120);
        expect(CONFIG.GRAVEYARD_ART_REACH_PX).toBe(48);
        expect(css).toMatch(/--gy-hill-w:\s*120px/);
        expect(css).toMatch(/--gy-reach:\s*48px/);
        expect(css).toMatch(new RegExp(`--gy-hill-h:\\s*${CONFIG.GRAVEYARD_HILL_HEIGHT_PX}px`));
    });

    test('the hill and tree pictures are gone: not in the CSS, not in APP_SHELL, not in index.html, and the cache moved past v407', () => {
        expect(css).not.toMatch(/graveyard-hill|graveyard-tree/);
        expect(sw).not.toMatch(/graveyard-hill|graveyard-tree|treePanel|treeGrowth/);
        expect(html).not.toMatch(/graveyard-tree|treePanel|treeGrowth/);
        expect(Number(/deadline-shell-v(\d+)/.exec(sw)[1])).toBeGreaterThanOrEqual(408);
    });

    test('the 24x24 headstones are listed in APP_SHELL', () => {
        [0, 1, 2, 3, 4].forEach((n) => expect(sw).toContain(`'Assets/scene/headstone-${n}.png'`));
    });
});

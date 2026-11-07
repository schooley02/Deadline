/**
 * Backdrop (2026-11-07): the PixelLab mountains -> tree line -> field strips that replaced the SVG hill. Pins the asset sizes
 * (CSS background-size must equal them so the art stays 1:1), the back-to-front order, the horizon anchoring, and the cache.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function pngSize(rel) {
    const b = fs.readFileSync(path.join(root, rel));
    expect(b.slice(1, 4).toString()).toBe('PNG');
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
const html = read('index.html');
const css = read('css/gameCanvas.css');
const sw = read('sw.js');
const block = (sel) => {
    const i = css.indexOf('\n' + sel + ' {');
    expect(i).toBeGreaterThanOrEqual(0);
    return css.slice(i, css.indexOf('}', i));
};

const LAYERS = [
    ['.scene-mountains', 'Assets/scene/mountains.png', 640, 240],
    ['.scene-treeline', 'Assets/scene/treeline.png', 404, 168],
    ['.scene-field', 'Assets/scene/village-field.png', 505, 156],
];

describe('backdrop strips', () => {
    test.each(LAYERS)('%s uses %s at its true size (%ix%i), repeating', (sel, file, w, h) => {
        expect(pngSize(file)).toEqual({ w, h });
        const b = block(sel);
        expect(b).toContain(`url("../${file}")`);
        expect(b).toContain(`background-size: ${w}px ${h}px`);
        expect(block('.scene-backdrop')).toMatch(/repeat-x/);
        expect(block('.scene-backdrop')).toMatch(/image-rendering: pixelated/);
    });

    test('mountains, tree line, field in that order inside .scene-silhouettes; the SVG hill is gone', () => {
        const scene = html.slice(html.indexOf('scene-silhouettes'), html.indexOf('climate-haze-far'));
        const at = (c) => scene.indexOf(c);
        expect(at('scene-mountains')).toBeGreaterThan(0);
        expect(at('scene-mountains')).toBeLessThan(at('scene-treeline'));
        expect(at('scene-treeline')).toBeLessThan(at('scene-field'));
        expect(html).not.toContain('scene-hill');
        expect(css).not.toContain('.scene-hill');
    });

    test('every strip is pinned to the horizon (--clm-hz, fallback floor top + 4px) and stays low', () => {
        LAYERS.forEach(([sel]) => expect(block(sel)).toContain('var(--clm-hz, calc(100% - 76px))'));
        expect(block('.scene-backdrop')).toMatch(/bottom: 0/);
    });

    test('the mountains\' widest valley (tile column 270) is lined up under the moon from the right edge', () => {
        expect(block('.scene-mountains')).toContain('background-position: right calc(var(--moon-right, 30px) + 29px - 370px) top 0');
        expect(block('.scene-treeline')).toContain('background-position: right calc(var(--moon-right, 30px) + 29px - 274px) top 0');
        expect(block('.scene-silhouettes')).toMatch(/left: 0;\s*width: 100%;/);
    });

    test('all three are in the service worker APP_SHELL and the cache was bumped past v279', () => {
        LAYERS.forEach(([, file]) => expect(sw).toContain(`'${file}'`));
        expect(Number(/deadline-shell-v(\d+)/.exec(sw)[1])).toBeGreaterThanOrEqual(280);
    });
});

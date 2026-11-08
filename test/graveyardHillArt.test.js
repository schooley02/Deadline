/**
 * Graveyard hill art (2026-11-08): the PixelLab mound (Assets/scene/graveyard-hill.png, 192x128, drawn 1:1) replaced the CSS
 * placeholder hill. Pins the asset size (CSS background-size must equal it so the art stays 1:1), the zone/art width split
 * (zone and tap area stay CONFIG.GRAVEYARD_HILL_WIDTH_PX; the art is wider so its low slope runs out behind the zombies),
 * the hill height (= the art's visible rows), and the cache.
 */
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const FILE = 'Assets/scene/graveyard-hill.png';
const ART_W = 192;
const ART_H = 128;

function pngSize(rel) {
    const b = fs.readFileSync(path.join(root, rel));
    expect(b.slice(1, 4).toString()).toBe('PNG');
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
const css = read('css/graveyard.css');
const sw = read('sw.js');
const hillBlock = () => {
    const i = css.indexOf('\n.graveyard-hill {');
    expect(i).toBeGreaterThanOrEqual(0);
    return css.slice(i, css.indexOf('}', i));
};

describe('graveyard hill art', () => {
    test('the PNG is 192x128', () => {
        expect(pngSize(FILE)).toEqual({ w: ART_W, h: ART_H });
    });

    test('.graveyard-hill draws it 1:1, pixelated, pinned bottom-right', () => {
        const b = hillBlock();
        expect(b).toContain(`url("../${FILE}")`);
        expect(b).toContain(`background-size: ${ART_W}px ${ART_H}px`);
        expect(b).toMatch(/image-rendering: pixelated/);
        expect(b).toMatch(/right: 0;/);
        expect(b).toMatch(/bottom: 0;/);
        expect(b).toContain(`width: ${ART_W}px`);
        expect(b).toContain(`height: ${ART_H}px`);
    });

    test('the art is wider than the zone (the zone and tap area stay at CONFIG.GRAVEYARD_HILL_WIDTH_PX)', () => {
        expect(ART_W).toBeGreaterThan(CONFIG.GRAVEYARD_HILL_WIDTH_PX);
        expect(css).toMatch(new RegExp(`--gy-hill-w:\\s*${CONFIG.GRAVEYARD_HILL_WIDTH_PX}px`));
    });

    test('hill height = CONFIG.GRAVEYARD_HILL_HEIGHT_PX, matching the CSS fallback and fitting the art', () => {
        expect(CONFIG.GRAVEYARD_HILL_HEIGHT_PX).toBeLessThanOrEqual(ART_H);
        expect(css).toMatch(new RegExp(`--gy-hill-h:\\s*${CONFIG.GRAVEYARD_HILL_HEIGHT_PX}px`));
        global.CONFIG = CONFIG;
        global.GraveyardLayout = require('../js/graveyardLayout.js');
        const GraveyardView = require('../js/ui/graveyardView.js');
        expect(GraveyardView.hillHeight(CONFIG)).toBe(CONFIG.GRAVEYARD_HILL_HEIGHT_PX);
    });

    test('the back-lane stones still fit under the flat top', () => {
        const topStoneFeet = CONFIG.GROUND_FLOOR_FEET_BOTTOM_PAD + (CONFIG.GRAVEYARD_LANES - 1) * CONFIG.GRAVEYARD_LANE_RISE_PX;
        expect(topStoneFeet).toBeLessThan(CONFIG.GRAVEYARD_HILL_HEIGHT_PX);
    });

    test('the PNG is in the service worker APP_SHELL and the cache was bumped past v281', () => {
        expect(sw).toContain(`'${FILE}'`);
        expect(Number(/deadline-shell-v(\d+)/.exec(sw)[1])).toBeGreaterThanOrEqual(282);
    });
});

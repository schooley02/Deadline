/**
 * Storm ground (2026-11-07): the puddle version of the ground tile. Pins the asset sizes (a wrong size would scale the pixel art
 * off 1:1), that the swap is scoped to the Storm band only, and that the service worker caches both pictures.
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

const css = read('css/climate.css');
const sw = read('sw.js');

describe('storm ground assets', () => {
    test('the tile is floor-tile.png x4 (508x72, same height) and the strip is strip-floor.png x4 (256x36)', () => {
        expect(pngSize('Assets/scene/storm-floor-tile.png')).toEqual({ w: 508, h: 72 });
        expect(pngSize('Assets/scene/storm-strip-floor.png')).toEqual({ w: 256, h: 36 });
        expect(pngSize('Assets/scene/floor-tile.png')).toEqual({ w: 127, h: 72 });
    });

    test('both are in the service worker APP_SHELL and the cache was bumped past v266', () => {
        expect(sw).toContain("'Assets/scene/storm-floor-tile.png'");
        expect(sw).toContain("'Assets/scene/storm-strip-floor.png'");
        expect(Number(/deadline-shell-v(\d+)/.exec(sw)[1])).toBeGreaterThanOrEqual(267);
    });
});

describe('storm ground css', () => {
    test('the canvas ground swaps its picture only under climate-storm, at the tile\'s real size', () => {
        expect(css).toMatch(/#gameCanvas\.climate-storm \.scene-ground \{\s*background-image: url\("\.\.\/Assets\/scene\/storm-floor-tile\.png"\);\s*background-size: 508px 72px;/);
    });

    test('the phone strip floor swaps only under climate-storm, at the strip tile\'s real size', () => {
        expect(css).toMatch(/body\.glance-strip #gameCanvas\.climate-storm::before \{\s*background-image: url\("\.\.\/Assets\/scene\/storm-strip-floor\.png"\);\s*background-size: 256px 36px;/);
    });

    test('no other band mentions the storm tiles', () => {
        const uses = css.split('url("../Assets/scene/storm-').length - 1;
        expect(uses).toBe(2);
    });
});

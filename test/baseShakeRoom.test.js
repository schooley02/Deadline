/**
 * Church shake room (2026-11-10): the landscape church sits --base-bleed left of the canvas edge so the hit shake never shows the
 * gap behind its left edge. Pins the numbers together; how it LOOKS is checked in a browser.
 */
const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const css = read('css/gameCanvas.css');

describe('church shake room', () => {
    const bleed = parseFloat((css.match(/#gameCanvas \{ --base-bleed: (\d+)px; \}/) || [])[1]);
    const shake = css.slice(css.indexOf('@keyframes base-shake'), css.indexOf('/* Screen thump'));
    const offsets = [...shake.matchAll(/translate:\s*(-?\d+)px/g)].map(m => Math.abs(parseFloat(m[1])));

    test('the bleed is at least the biggest sideways shake offset, and a whole number of art pixels (2px each)', () => {
        expect(offsets.length).toBeGreaterThan(0);
        expect(bleed).toBeGreaterThanOrEqual(Math.max(...offsets));
        expect(bleed % 2).toBe(0);
    });
    test('#base sits that far left, and the portrait strip has none', () => {
        expect(css).toMatch(/#base \{[^}]*left: calc\(0px - var\(--base-bleed, 0px\)\);/);
        expect(css).toMatch(/body\.glance-strip #gameCanvas \{ --base-bleed: 0px; \}/);
    });
    test('the box width is --base-w (BASE_WIDTH comes from it)', () => {
        expect(css).toMatch(/#base \{[^}]*width: var\(--base-w, 188px\);/);
    });
    test('the hero spotlight door-centre follows the church (the door is 108px left of its right edge)', () => {
        expect(read('css/heroSpotlight.css')).toMatch(/\.hero-spotlight \{[^}]*left: calc\(var\(--base-w, 188px\) - 108px - var\(--base-bleed, 0px\)\);/);
        expect(read('css/heroSpotlight.css')).toMatch(/#baseScrim \{[^}]*width: var\(--base-w, 188px\);/);
    });
    // 2026-11-23: hovering a village building made the church jump one screen pixel for a few frames (Chrome lifted #base into its own layer only
    // while the building's hover transition ran). Pinned as layers, like the graveyard zone (test/markerPanel.test.js).
    test('the church and its 25% smoke are pinned compositor layers, so a village hover never re-rasters them', () => {
        expect(css).toMatch(/#base \{ will-change: transform; \}/);
        expect(/#baseSmokeClip \{([^}]*)\}/.exec(css)[1]).toMatch(/will-change: transform;/);
    });
    test('the barricade stands 48px left of the church right edge', () => {
        expect(read('css/barricade.css')).toMatch(/\.barricade \{[^}]*left: calc\(var\(--base-w, 188px\) - 48px - var\(--base-bleed, 0px\)\);/);
    });
});

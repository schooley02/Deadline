/**
 * The slider track must not change width when the Now button appears (2026-11-19, Jeremy: dragging the handle left
 * from 8:53 showed 9:02 and the FORECAST look). The Now button used to be `display: none` while live, so the first
 * drag step that revealed it shrank the track under the finger. Its room is now always kept.
 */
const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('a hidden Now button keeps its room (visibility, never display: none)', () => {
    const css = stripComments(read('css/timeSlider.css'));
    const rule = css.match(/\.time-slider-now\[hidden\]\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/visibility:\s*hidden/);
    expect(rule[1]).toMatch(/pointer-events:\s*none/);
    expect(rule[1]).not.toMatch(/display:\s*none/);
});

test('no other stylesheet collapses the hidden Now button', () => {
    ['css/glanceStrip.css', 'css/responsive.css', 'css/gameCanvas.css'].forEach((f) => {
        const css = stripComments(read(f));
        expect(css).not.toMatch(/\.time-slider-now\[hidden\][^{]*\{[^}]*display:\s*none/);
    });
});

/**
 * Sub-task list must not be height-capped (found 2026-10-13, Jeremy's phone): a fixed
 * `max-height: 200px` + `overflow: hidden` on `.sub-tasks-container` clipped every row past
 * the first ~2, hiding their "Mark as Complete" checkboxes so the parent could never be finished.
 */
const fs = require('fs');
const path = require('path');

describe('.sub-tasks-container is not clipped', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'popups.css'), 'utf8');

    test('the populated container has no pixel max-height', () => {
        const m = css.match(/\.sub-tasks-container:not\(:empty\)\s*\{([^}]*)\}/);
        expect(m).not.toBeNull();
        expect(m[1]).toMatch(/max-height:\s*none/);
        expect(m[1]).not.toMatch(/max-height:\s*\d/);
    });

    test('no other rule re-caps it', () => {
        const caps = css.split('}').filter(b => /\.sub-tasks-container/.test(b) && /max-height:\s*\d+px/.test(b));
        expect(caps).toEqual([]);
    });
});

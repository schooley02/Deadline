/**
 * The church (#base) reacts to hover like the other canvas elements (2026-11-12): grows 5% from its base + the white glow, desktop only.
 * It uses the `scale` property so it never fights the hit shake (`translate`).
 */
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'gameCanvas.css'), 'utf8').replace(/\r\n/g, '\n');

test('hover grows the church 5% from its base and adds the white glow, inside @media (hover: hover)', () => {
    expect(css).toMatch(/@media \(hover: hover\) \{\s*#base:hover \{[^}]*scale: 1\.05;[^}]*drop-shadow\(0 0 3px #fff\)/);
    expect(css).toMatch(/#base \{ transform-origin: 50% 100%;[^}]*transition: scale 120ms/);
});
test('the hover uses `scale`, not transform (the hit shake owns `translate`)', () => {
    const rule = /#base:hover \{[^}]*\}/.exec(css)[0];
    expect(rule).not.toMatch(/transform:/);
});

/** HUD phone fit (2026-11-05): the six top-row buttons must stay on one row at phone widths. Jest has no layout engine, so this pins the
 *  rule's source; the real measurement is the headless check recorded in docs/GOALS_PLAN.md "Build B1 as built". */
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'responsive.css'), 'utf8').replace(/\r\n/g, '\n');
const block = css.slice(css.indexOf('@media (max-width: 430px)'));

test('a phone block tightens the HUD row', () => {
    expect(block).toContain('.resource-panel { gap: 4px; }');
    expect(block).toMatch(/\.resource-panel > button\.stat-item \{[^}]*padding-left: 6px; padding-right: 6px/);
    expect(block).toContain('.bh-chip { display: none; }');
    expect(block).toContain('.goals-button-count { display: none; }');
    expect(block).toContain('.level-xp-bar { width: 22px; }');
});

test('the goals button is last in index.html, so the first five keep their order', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const ids = ['baseHealthButton', 'levelButton', 'villageButton', 'heroesButton', 'playerPointsStat', 'goalsButton'].map(id => html.indexOf(`id="${id}"`));
    expect(ids.every(i => i > -1)).toBe(true);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
});

test('responsive.css is still linked last', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const links = [...html.matchAll(/<link rel="stylesheet" href="css\/([^"]+)">/g)].map(m => m[1]);
    expect(links[links.length - 1]).toBe('responsive.css');
});

/**
 * Feet calibration (2026-10-13, Jeremy: the nurse floated above the floor).
 *
 * css/enemyAnim.css anchors every sprite window as if the 128px character were centred in
 * its cell (planted feet at cell - pad) and then shifts each category/state by --dy-walk /
 * --dy-idle / --dy-attack so the planted foot lands on the enemy box's bottom edge. The dy
 * values were MEASURED from the atlas PNGs; this test re-measures them and fails if a
 * re-exported atlas moves its feet (re-measure, then update the CSS table).
 *
 * Measure: for each frame, the lowest row with alpha > 20 (as a bottom EDGE = row + 1).
 * walk = max over frames (the planted foot), idle / attack = median over frames.
 */
const fs = require('fs');
const path = require('path');

let PNG = null;
try { PNG = require('pngjs').PNG; } catch (e) { /* optional dependency */ }

const ROOT = path.join(__dirname, '..');
const ANIM = path.join(ROOT, 'Assets/Zombies/anim');
const css = fs.readFileSync(path.join(ROOT, 'css/enemyAnim.css'), 'utf8');
const CATS = ['career', 'creativity', 'financial', 'health', 'lifestyle', 'other', 'relationships', 'spirituality'];
const ROW = { walk: 0, idle: 1, attack: 2 };

function cssDy(cat) {
    const m = css.match(new RegExp(`\\.zombie-${cat} \\.enemy-sprite\\s*\\{[^}]*--dy-walk:`));
    if (!m) return { walk: 0, idle: 0, attack: 0 }; // not listed = exact (financial, relationships)
    const block = css.slice(m.index).match(/\{[^}]*\}/)[0];
    const get = (k) => { const x = block.match(new RegExp(`--dy-${k}:\\s*(-?\\d+)px`)); return x ? Number(x[1]) : 0; };
    return { walk: get('walk'), idle: get('idle'), attack: get('attack') };
}

function measure(cat) {
    const meta = JSON.parse(fs.readFileSync(path.join(ANIM, `${cat}.json`), 'utf8'));
    const png = PNG.sync.read(fs.readFileSync(path.join(ANIM, `${cat}.png`)));
    const cell = meta.frameWidth;
    const assumed = cell - (cell - 128) / 2;
    const edgesOf = (state) => {
        const edges = [];
        for (let f = 0; f < meta.animations[state].frames; f++) {
            let low = -1;
            for (let y = ROW[state] * cell + cell - 1; y >= ROW[state] * cell && low < 0; y--) {
                for (let x = f * cell; x < (f + 1) * cell; x++) {
                    if (png.data[(y * png.width + x) * 4 + 3] > 20) { low = y - ROW[state] * cell; break; }
                }
            }
            edges.push(low + 1);
        }
        return edges.sort((a, b) => a - b);
    };
    const walk = edgesOf('walk'), idle = edgesOf('idle'), attack = edgesOf('attack');
    const med = (a) => a[Math.floor(a.length / 2)];
    return {
        walk: assumed - walk[walk.length - 1],
        idle: assumed - med(idle),
        attack: assumed - med(attack),
    };
}

(PNG ? describe : describe.skip)('sprite feet land on the enemy box bottom (--dy-* calibration)', () => {
    test.each(CATS)('%s: css --dy-walk / --dy-idle / --dy-attack match the atlas', (cat) => {
        expect(cssDy(cat)).toEqual(measure(cat));
    });
    test('the --dy rules are wired into the sheet (top offset + state rows)', () => {
        expect(css).toMatch(/top: calc\(var\(--row\) \* var\(--cell\) \* -1 \+ var\(--dy\)\)/);
        expect(css).toMatch(/\.enemy\.enemy-at-base \.enemy-sprite-sheet \{[^}]*--dy: var\(--dy-attack\)/);
        expect(css).toMatch(/\.enemy\.urgency-calm \.enemy-sprite-sheet \{[^}]*--dy: var\(--dy-idle\)/);
        expect(css).toMatch(/\.enemy\.lurker-parked \.enemy-sprite-sheet \{[^}]*--dy: var\(--dy-idle\)/);
    });
});

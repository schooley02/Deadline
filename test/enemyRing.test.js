/**
 * @jest-environment jsdom
 */
/**
 * Enemy highlight Build A (2026-11-06, docs/ENEMY_HIGHLIGHT_PLAN.md): family-on-tap (js/enemyRing.js), the ground-ring
 * child (js/spriteAnim.js) and the CSS / wiring pins (priority outline, ring, started badge scoped to the strip).
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
const EnemyRing = require('../js/enemyRing.js');
const SpriteAnim = require('../js/spriteAnim.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

const mk = (id, o = {}) => Object.assign({ id, type: 'task', parentId: null, element: document.createElement('div') }, o);

describe('EnemyRing.kinOf', () => {
    const parent = mk(1);
    const subA = mk(2, { parentId: 1 });
    const subB = mk(3, { parentId: 1 });
    const loner = mk(4);
    const items = [parent, subA, subB, loner];

    test('a sub-task: its parent and its siblings, never itself', () => {
        expect(EnemyRing.kinOf(items, 2).sort()).toEqual([1, 3]);
    });
    test('a parent: its sub-tasks', () => {
        expect(EnemyRing.kinOf(items, 1).sort()).toEqual([2, 3]);
    });
    test('a standalone zombie has no kin', () => {
        expect(EnemyRing.kinOf(items, 4)).toEqual([]);
    });
    test('routine mates: same routine id, other items only; a null routine matches nothing', () => {
        const a = mk(10, { rid: 'r1' }), b = mk(11, { type: 'habit', rid: 'r1' }), c = mk(12, { rid: 'r2' }), d = mk(13);
        const routineIdOf = (i) => (i.rid == null ? null : i.rid);
        expect(EnemyRing.kinOf([a, b, c, d], 10, routineIdOf)).toEqual([11]);
        expect(EnemyRing.kinOf([a, b, c, d], 13, routineIdOf)).toEqual([]);
    });
    test('union of family and routine; unknown id and bad input are empty', () => {
        const p = mk(20, { rid: 'r1' }), s = mk(21, { parentId: 20, rid: 'r1' }), m = mk(22, { rid: 'r1' });
        expect(EnemyRing.kinOf([p, s, m], 20, (i) => i.rid || null).sort()).toEqual([21, 22]);
        expect(EnemyRing.kinOf(items, 999)).toEqual([]);
        expect(EnemyRing.kinOf(null, 1)).toEqual([]);
    });
});

describe('EnemyRing.show / clear / watch', () => {
    test('show marks the tapped zombie and its kin; a second show replaces the first; clear strips both', () => {
        const parent = mk(1), sub = mk(2, { parentId: 1 }), other = mk(3);
        const items = [parent, sub, other];
        EnemyRing.show(items, 2);
        expect(sub.element.classList.contains('ring-selected')).toBe(true);
        expect(parent.element.classList.contains('ring-kin')).toBe(true);
        expect(other.element.classList.contains('ring-kin')).toBe(false);
        EnemyRing.show(items, 3);
        expect(sub.element.classList.contains('ring-selected')).toBe(false);
        expect(parent.element.classList.contains('ring-kin')).toBe(false);
        expect(other.element.classList.contains('ring-selected')).toBe(true);
        EnemyRing.clear(items);
        items.forEach(i => expect(i.element.className).toBe(''));
    });
    test('items without an element are tolerated', () => {
        expect(() => EnemyRing.show([{ id: 1 }, { id: 2, parentId: 1 }], 2)).not.toThrow();
    });
    test('watch clears the marking once no modal overlay is left', async () => {
        const a = mk(1), b = mk(2, { parentId: 1 });
        const items = [a, b];
        EnemyRing.watch(() => items);
        EnemyRing.show(items, 1);
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        document.body.appendChild(overlay);
        await Promise.resolve();
        expect(a.element.classList.contains('ring-selected')).toBe(true); // card still open
        overlay.remove();
        await new Promise(r => setTimeout(r, 0));
        expect(a.element.classList.contains('ring-selected')).toBe(false);
        expect(b.element.classList.contains('ring-kin')).toBe(false);
    });
});

describe('SpriteAnim.attach adds the ground ring', () => {
    test('one ring after the sprite, idempotent, firstChild stays the sprite', () => {
        const el = document.createElement('div');
        const sprite = SpriteAnim.attach(el, 128);
        SpriteAnim.attach(el, 128);
        expect(el.firstChild).toBe(sprite);
        expect(el.querySelectorAll(':scope > .enemy-ring').length).toBe(1);
        expect(el.lastChild.className).toBe('enemy-ring');
    });
});

describe('CSS + wiring pins', () => {
    const css = read('css/enemyStatus.css');
    test('priority is a zero-blur 1px outline (four drop-shadows), no star badge, no pulse', () => {
        const block = css.slice(css.indexOf('.enemy.high-priority > .enemy-sprite'), css.indexOf('/* Overdue'));
        expect((block.match(/drop-shadow\(/g) || []).length).toBe(4);
        expect(block).toMatch(/1px \/ var\(--sprite-scale, 1\)/);
        expect(block).not.toMatch(/--an-pr/);
        expect(css).not.toMatch(/\.high-priority::after/);
        expect(css).not.toMatch(/glow-priority|--pr-blur/);
    });
    test('the four-entry glow chain and animation lists stay in step', () => {
        expect(css).toMatch(/var\(--g-overdue,\) var\(--g-started,\);/);
        expect(css).toMatch(/var\(--an-pr, none\), var\(--an-od, none\), var\(--an-fl, none\), var\(--an-st, none\);/);
    });
    test('the ring has three intensities and is hidden in the portrait strip and on previews', () => {
        expect(css).toMatch(/\.enemy\.started-marker \.enemy-ring/);
        expect(css).toMatch(/\.enemy\.ring-kin \.enemy-ring/);
        expect(css).toMatch(/\.enemy\.ring-selected \.enemy-ring/);
        expect(css).toMatch(/body:not\(\.glance-strip\) \.enemy \.enemy-ring \{ display: block; \}/);
        expect(css).toMatch(/time-preview-ghost \.enemy-ring/);
    });
    test('ring motion only runs when motion is allowed', () => {
        const motion = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
        ['ring-breathe', 'ring-pulse'].forEach(n => {
            expect(css.split(`animation: ${n}`).length - 1).toBe(1);
            expect(motion.split(`animation: ${n}`).length - 1).toBe(1);
        });
    });
    test('the started glow fragment is gone and the badge shows only in the strip', () => {
        const sm = read('css/startedMarker.css');
        expect(sm).not.toMatch(/--g-started:/);
        expect(sm).toMatch(/body\.glance-strip \.enemy\.started-marker \.started-badge \{\s*display: flex;/);
        expect(sm).not.toMatch(/\n\.enemy\.started-marker \.started-badge \{/);
    });
    test('index.html, sw.js and script.js load / call the module', () => {
        const html = read('index.html');
        expect(html.indexOf('js/enemyRing.js')).toBeGreaterThan(html.indexOf('js/startedMarker.js'));
        expect(read('sw.js')).toContain("'js/enemyRing.js'");
        const script = read('script.js');
        expect(script).toMatch(/function showEnemyRing\(itemId\)/);
        expect(script).toMatch(/Popups\.handleEnemyClick\(itemId, popupsDeps\(\)\);\n\s+showEnemyRing\(itemId\);/);
    });
});

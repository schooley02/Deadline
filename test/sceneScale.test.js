/**
 * SceneScale (DEV spike 2026-11-19): `?sceneScale=` lays #gameCanvas out larger and shrinks it to fit.
 */
const SceneScale = require('../js/sceneScale');
const fs = require('fs');
const path = require('path');

describe('SceneScale.parse', () => {
    test('off without the param or with junk', () => {
        expect(SceneScale.parse('')).toBeNull();
        expect(SceneScale.parse('?gymTier=3')).toBeNull();
        expect(SceneScale.parse('?sceneScale=off')).toBeNull();
        expect(SceneScale.parse('?sceneScale=1')).toBeNull();
        expect(SceneScale.parse('?sceneScale=0')).toBeNull();
        expect(SceneScale.parse('?sceneScale=-2')).toBeNull();
    });
    test('a number, clamped to MIN, rounded to 0.01', () => {
        expect(SceneScale.parse('?sceneScale=0.8')).toBe(0.8);
        expect(SceneScale.parse('?a=1&sceneScale=0.756')).toBe(0.76);
        expect(SceneScale.parse('?sceneScale=0.2')).toBe(SceneScale.MIN);
    });
    test('auto', () => {
        expect(SceneScale.parse('?sceneScale=AUTO')).toBe('auto');
    });
});

describe('SceneScale.scaleFor', () => {
    test('null = 1', () => expect(SceneScale.scaleFor(null, 800)).toBe(1));
    test('fixed number passes through', () => expect(SceneScale.scaleFor(0.8, 1200)).toBe(0.8));
    test('auto: canvas width / 1000, capped at 1, floored at AUTO_MIN', () => {
        expect(SceneScale.scaleFor('auto', 800)).toBe(0.8);
        expect(SceneScale.scaleFor('auto', 915)).toBe(0.91);
        expect(SceneScale.scaleFor('auto', 1067)).toBe(1);
        expect(SceneScale.scaleFor('auto', 500)).toBe(SceneScale.AUTO_MIN);
    });
    test('auto at 800 gives a ~700px walking field (160 church + 140 hill)', () => {
        const s = SceneScale.scaleFor('auto', 800);
        expect(800 / s - 160 - 140).toBeGreaterThanOrEqual(700);
    });
});

describe('SceneScale.stylesFor', () => {
    test('null at scale 1 or with no host box', () => {
        expect(SceneScale.stylesFor(1, 800, 300)).toBeNull();
        expect(SceneScale.stylesFor(0.8, 0, 300)).toBeNull();
    });
    test('layout size = host / s; negative margins keep the host box', () => {
        const st = SceneScale.stylesFor(0.8, 800, 304);
        expect(st.width).toBe('1000px');
        expect(st.height).toBe('380px');
        expect(st.scale).toBe('0.8');
        expect(st.transformOrigin).toBe('0 0');
        expect(st.marginRight).toBe('-200px');
        expect(st.marginBottom).toBe('-76px');
    });
});

describe('SceneScale.apply (fake DOM)', () => {
    function fakeDoc(hostW, hostH) {
        const style = {};
        style.setProperty = (k, v) => { style[k] = v; };
        style.removeProperty = (k) => { delete style[k]; };
        const el = { style, parentElement: { clientWidth: hostW, clientHeight: hostH } };
        return { el, doc: { getElementById: (id) => (id === 'gameCanvas' ? el : null) } };
    }
    test('applies and clears', () => {
        const { el, doc } = fakeDoc(800, 304);
        expect(SceneScale.apply(doc, { location: { search: '?sceneScale=auto' } }, false)).toBe(0.8);
        expect(el.style.width).toBe('1000px');
        expect(el.style['--scene-scale']).toBe('0.8');
        expect(SceneScale.get()).toBe(0.8);
        expect(SceneScale.apply(doc, { location: { search: '' } }, false)).toBe(1);
        expect(el.style.width).toBe('');
        expect(el.style.scale).toBe('');
        expect(el.style['--scene-scale']).toBeUndefined();
    });
    test('never in the portrait glance strip', () => {
        const { el, doc } = fakeDoc(360, 92);
        expect(SceneScale.apply(doc, { location: { search: '?sceneScale=0.8' } }, true)).toBe(1);
        expect(el.style.width).toBe('');
    });
    test('missing canvas = 1', () => {
        expect(SceneScale.apply({ getElementById: () => null }, { location: { search: '?sceneScale=0.8' } }, false)).toBe(1);
    });
});

describe('SceneScale wiring', () => {
    const root = path.join(__dirname, '..');
    test('loaded right after layout.js and in the sw shell', () => {
        const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
        const a = html.indexOf('src="js/layout.js"');
        const b = html.indexOf('src="js/sceneScale.js"');
        expect(a).toBeGreaterThan(-1);
        expect(b).toBeGreaterThan(a);
        expect(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')).toContain("'js/sceneScale.js'");
    });
    test('Layout.applyBodyClass sizes the scene before the canvas is re-measured', () => {
        const src = fs.readFileSync(path.join(root, 'js/layout.js'), 'utf8');
        expect(src).toMatch(/SceneScale\.apply\(doc, win, active\)/);
    });
    test('the hero lane measurement converts on-screen px to layout px', () => {
        const src = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
        expect(src).toMatch(/cr\.height \/ gameCanvas\.offsetHeight/);
    });
});

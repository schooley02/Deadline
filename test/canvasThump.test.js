/**
 * @jest-environment jsdom
 *
 * Screen thump (2026-11-09): the whole canvas jolts a few pixels when a task / habit is completed. Jest checks the rules (when, how
 * often, under which motion settings), the class lifecycle, and that the shell / CSS / wiring agree. How it FEELS is checked on a phone.
 */
const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

global.CONFIG = require('../js/config.js');
const CanvasThump = require('../js/ui/canvasThump.js');

function mount() {
    document.body.className = '';
    document.body.innerHTML = '<div class="game-canvas"><div id="gameCanvas"></div></div>';
    return document.getElementById('gameCanvas');
}

beforeEach(() => {
    jest.useFakeTimers();
    CanvasThump.resetForTests();
    window.matchMedia = undefined;
});
afterEach(() => { jest.useRealTimers(); });

describe('rules', () => {
    test('motionMode: off wins, reduced is soft, otherwise full', () => {
        expect(CanvasThump.motionMode({})).toBe('full');
        expect(CanvasThump.motionMode()).toBe('full');
        expect(CanvasThump.motionMode({ fxReduced: true })).toBe('soft');
        expect(CanvasThump.motionMode({ fxOff: true })).toBe('off');
        expect(CanvasThump.motionMode({ reducedMotion: true })).toBe('off');
        expect(CanvasThump.motionMode({ fxOff: true, fxReduced: true })).toBe('off');
    });
    test('shouldThump honours the cooldown', () => {
        expect(CanvasThump.shouldThump(1000, -Infinity, 500)).toBe(true);
        expect(CanvasThump.shouldThump(1400, 1000, 500)).toBe(false);
        expect(CanvasThump.shouldThump(1500, 1000, 500)).toBe(true);
    });
    test('the config numbers are sane (visual dials, not balance)', () => {
        expect(CONFIG.CANVAS_THUMP_DURATION_MS).toBe(220); // keep in sync with the 0.22s in css/gameCanvas.css
        expect(CONFIG.CANVAS_THUMP_DELAY_MS).toBeGreaterThanOrEqual(0);
        expect(CONFIG.CANVAS_THUMP_DELAY_MS).toBeLessThan(CONFIG.HERO_ONESHOT_FRAMES / CONFIG.HERO_ONESHOT_FPS * 1000); // lands inside the attack
        expect(CONFIG.CANVAS_THUMP_COOLDOWN_MS).toBeGreaterThanOrEqual(CONFIG.CANVAS_THUMP_DURATION_MS);
    });
});

describe('play / onDefeat', () => {
    test('onDefeat waits for the delay, then adds the class to the canvas and its parent, then removes both', () => {
        const el = mount();
        CanvasThump.onDefeat(el);
        expect(el.classList.contains('canvas-thump')).toBe(false);
        jest.advanceTimersByTime(CONFIG.CANVAS_THUMP_DELAY_MS - 1);
        expect(el.classList.contains('canvas-thump')).toBe(false);
        jest.advanceTimersByTime(1);
        expect(el.classList.contains('canvas-thump')).toBe(true);
        expect(el.parentElement.classList.contains('canvas-thumping')).toBe(true);
        jest.advanceTimersByTime(CONFIG.CANVAS_THUMP_DURATION_MS);
        expect(el.classList.contains('canvas-thump')).toBe(false);
        expect(el.parentElement.classList.contains('canvas-thumping')).toBe(false);
    });
    test('a second thump inside the cooldown is skipped; one after it plays', () => {
        const el = mount();
        expect(CanvasThump.play(el, 10000)).toBe(true);
        jest.advanceTimersByTime(CONFIG.CANVAS_THUMP_DURATION_MS);
        expect(CanvasThump.play(el, 10000 + CONFIG.CANVAS_THUMP_COOLDOWN_MS - 1)).toBe(false);
        expect(el.classList.contains('canvas-thump')).toBe(false);
        expect(CanvasThump.play(el, 10000 + CONFIG.CANVAS_THUMP_COOLDOWN_MS)).toBe(true);
        expect(el.classList.contains('canvas-thump')).toBe(true);
    });
    test('a burst of completions becomes one thump (the last one wins the delay)', () => {
        const el = mount();
        CanvasThump.onDefeat(el);
        jest.advanceTimersByTime(100);
        CanvasThump.onDefeat(el);
        jest.advanceTimersByTime(CONFIG.CANVAS_THUMP_DELAY_MS - 1);
        expect(el.classList.contains('canvas-thump')).toBe(false);
        jest.advanceTimersByTime(1);
        expect(el.classList.contains('canvas-thump')).toBe(true);
    });
    test('fx-off: no thump at all', () => {
        const el = mount();
        document.body.classList.add('fx-off');
        expect(CanvasThump.play(el, 1)).toBe(false);
        expect(el.className).toBe('');
        expect(el.parentElement.classList.contains('canvas-thumping')).toBe(false);
    });
    test('prefers-reduced-motion: no thump at all', () => {
        const el = mount();
        window.matchMedia = (q) => ({ matches: /reduce/.test(q) });
        expect(CanvasThump.play(el, 1)).toBe(false);
        expect(el.className).toBe('');
    });
    test('fx-reduced: the soft one', () => {
        const el = mount();
        document.body.classList.add('fx-reduced');
        expect(CanvasThump.play(el, 1)).toBe(true);
        expect(el.classList.contains('canvas-thump-soft')).toBe(true);
        expect(el.classList.contains('canvas-thump')).toBe(false);
    });
    test('a missing element never throws', () => {
        expect(() => CanvasThump.onDefeat(null)).not.toThrow();
        expect(CanvasThump.play(null, 1)).toBe(false);
    });
});

describe('shell, CSS and wiring agree', () => {
    const css = read('css/gameCanvas.css');
    test('the CSS has both animations, vertical only, whole pixels, and the off gates', () => {
        expect(css).toMatch(/\.canvas-thump \{\s*animation: canvas-thump 0\.22s step-end;/);
        expect(css).toMatch(/@keyframes canvas-thump \{[\s\S]*?translate: 0 3px/);
        expect(css).toMatch(/@keyframes canvas-thump-soft/);
        expect(css).toMatch(/body\.fx-off #gameCanvas\.canvas-thump/);
        expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*#gameCanvas\.canvas-thump/);
        const block = css.slice(css.indexOf('@keyframes canvas-thump {'), css.indexOf('/* body.fx-reduced: the same beat'));
        expect(block).not.toMatch(/translate:\s*-?\d+px\s+-?\d/); // never a sideways offset
        expect(block).not.toMatch(/\d\.\d+px/); // never a half pixel
    });
    test('index.html loads it after config.js and before script.js; sw.js caches it', () => {
        const html = read('index.html');
        const at = (s) => html.indexOf(s);
        expect(at('js/ui/canvasThump.js')).toBeGreaterThan(at('js/config.js'));
        expect(at('js/ui/canvasThump.js')).toBeLessThan(at('src="script.js"'));
        expect(read('sw.js')).toContain("'js/ui/canvasThump.js'");
    });
    test('script.js fires it from the completion hook, on every completion', () => {
        const js = read('script.js');
        expect(js).toMatch(/onItemDefeated: \(item\) => \{ heroAttackOnDefeat\(item\); CanvasThump\.onDefeat\(gameCanvas\); \}/);
    });
});

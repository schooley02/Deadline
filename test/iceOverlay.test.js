/**
 * @jest-environment jsdom
 */
/**
 * Ice art overlay (js/iceOverlay.js; docs/ICE_PLAN.md "Art"; wired 2026-11-10): the phase machine on a real DOM element, motion
 * gating, the completion burst, scale mirroring, and the static wiring (CSS durations vs the JS constants, the four PNGs and their
 * frame sizes, service worker + index.html entries).
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
const IceOverlay = require('../js/iceOverlay.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function enemy(scale) {
    const el = document.createElement('div');
    el.className = 'enemy';
    const sprite = document.createElement('div');
    sprite.className = 'enemy-sprite';
    if (scale !== undefined) sprite._spriteScale = scale;
    const ring = document.createElement('span');
    ring.className = 'enemy-ring';
    el.appendChild(sprite);
    el.appendChild(ring);
    return el;
}
const ov = (el) => el.querySelector(':scope > .ice-overlay');
const look = (el) => (ov(el) ? ov(el).className : null);

beforeEach(() => {
    jest.useFakeTimers();
    document.body.className = '';
    delete window.matchMedia;
});
afterEach(() => { jest.useRealTimers(); document.body.className = ''; delete window.matchMedia; });

describe('phase machine', () => {
    test('null -> iced: forming once, then it holds after the form animation', () => {
        const el = enemy();
        IceOverlay.sync(el, 'iced');
        expect(look(el)).toBe('ice-overlay ice-forming');
        jest.advanceTimersByTime(IceOverlay.FORM_MS - 1);
        expect(look(el)).toBe('ice-overlay ice-forming');
        jest.advanceTimersByTime(1);
        expect(look(el)).toBe('ice-overlay ice-hold');
    });
    test('the overlay is the LAST child (above the sprite and ring), aria-hidden, one per enemy', () => {
        const el = enemy();
        IceOverlay.sync(el, 'iced');
        IceOverlay.sync(el, 'iced');
        expect(el.lastElementChild.classList.contains('ice-overlay')).toBe(true);
        expect(el.querySelectorAll('.ice-overlay')).toHaveLength(1);
        expect(ov(el).getAttribute('aria-hidden')).toBe('true');
    });
    test('the same phase again does not touch the overlay (the loop may call every tick)', () => {
        const el = enemy();
        const first = IceOverlay.sync(el, 'iced');
        jest.advanceTimersByTime(IceOverlay.FORM_MS);
        const cls = first.className;
        expect(IceOverlay.sync(el, 'iced')).toBe(first);
        expect(first.className).toBe(cls);
    });
    test('iced -> thawing shows the cracked frame, at once (also mid-form: the form timer is cancelled)', () => {
        const el = enemy();
        IceOverlay.sync(el, 'iced');
        jest.advanceTimersByTime(100);
        IceOverlay.sync(el, 'thawing');
        expect(look(el)).toBe('ice-overlay ice-cracked');
        jest.advanceTimersByTime(IceOverlay.FORM_MS);
        expect(look(el)).toBe('ice-overlay ice-cracked');
    });
    test('thawing -> iced (resumed inside the grace) goes back to the hold frame with NO second forming', () => {
        const el = enemy();
        IceOverlay.sync(el, 'iced');
        jest.advanceTimersByTime(IceOverlay.FORM_MS);
        IceOverlay.sync(el, 'thawing');
        IceOverlay.sync(el, 'iced');
        expect(look(el)).toBe('ice-overlay ice-hold');
    });
    test('a zombie that arrives already thawing (reload in the grace) gets the cracked frame, not a form', () => {
        const el = enemy();
        IceOverlay.sync(el, 'thawing');
        expect(look(el)).toBe('ice-overlay ice-cracked');
    });
    test('thaw (-> null): the burst plays, then the overlay is removed after burst + puddle fade', () => {
        const el = enemy();
        IceOverlay.sync(el, 'iced');
        jest.advanceTimersByTime(IceOverlay.FORM_MS);
        IceOverlay.sync(el, 'thawing');
        IceOverlay.sync(el, null);
        expect(look(el)).toBe('ice-overlay ice-burst');
        jest.advanceTimersByTime(IceOverlay.BURST_TOTAL_MS - 1);
        expect(ov(el)).not.toBeNull();
        jest.advanceTimersByTime(1);
        expect(ov(el)).toBeNull();
    });
    test('burst timing = 7 frames x 70 ms + a 250 ms puddle fade; form = 8 frames x 60 ms', () => {
        expect(IceOverlay.FORM_MS).toBe(480);
        expect(IceOverlay.BURST_MS).toBe(490);
        expect(IceOverlay.PUDDLE_FADE_MS).toBe(250);
        expect(IceOverlay.BURST_TOTAL_MS).toBe(740);
    });
    test('re-icing during the burst starts a fresh form (the old removal timer is cancelled)', () => {
        const el = enemy();
        IceOverlay.sync(el, 'iced');
        jest.advanceTimersByTime(IceOverlay.FORM_MS);
        IceOverlay.sync(el, null);
        jest.advanceTimersByTime(100);
        IceOverlay.sync(el, 'iced');
        expect(look(el)).toBe('ice-overlay ice-forming');
        jest.advanceTimersByTime(IceOverlay.BURST_TOTAL_MS);
        expect(look(el)).toBe('ice-overlay ice-hold');
    });
    test('never iced: sync(null) makes nothing; junk elements are ignored', () => {
        const el = enemy();
        expect(IceOverlay.sync(el, null)).toBeNull();
        expect(ov(el)).toBeNull();
        expect(IceOverlay.sync(null, 'iced')).toBeNull();
        expect(IceOverlay.sync({}, 'iced')).toBeNull();
    });
    test('a dying zombie keeps whatever the overlay shows (the loop cannot swap it)', () => {
        const el = enemy();
        IceOverlay.sync(el, 'iced');
        jest.advanceTimersByTime(IceOverlay.FORM_MS);
        el.classList.add('enemy-dying');
        IceOverlay.sync(el, 'thawing');
        IceOverlay.sync(el, null);
        expect(look(el)).toBe('ice-overlay ice-hold');
    });
});

describe('motion off: no form, no burst', () => {
    test.each([['fx-off'], ['fx-reduced']])('body.%s: iced shows the hold frame at once; the thaw just removes it', (cls) => {
        document.body.classList.add(cls);
        const el = enemy();
        IceOverlay.sync(el, 'iced');
        expect(look(el)).toBe('ice-overlay ice-hold');
        IceOverlay.sync(el, 'thawing');
        expect(look(el)).toBe('ice-overlay ice-cracked');
        IceOverlay.sync(el, null);
        expect(ov(el)).toBeNull();
    });
    test('prefers-reduced-motion behaves the same', () => {
        window.matchMedia = () => ({ matches: true });
        const el = enemy();
        IceOverlay.sync(el, 'iced');
        expect(look(el)).toBe('ice-overlay ice-hold');
        IceOverlay.sync(el, null);
        expect(ov(el)).toBeNull();
    });
    test('motionOk is true by default', () => {
        expect(IceOverlay.motionOk()).toBe(true);
    });
});

describe('completing an iced zombie (burstOnDefeat)', () => {
    test('bursts at once and returns the burst length; no removal timer (the whole enemy is removed by removeItem)', () => {
        const el = enemy();
        IceOverlay.sync(el, 'iced');
        jest.advanceTimersByTime(IceOverlay.FORM_MS);
        expect(IceOverlay.burstOnDefeat(el)).toBe(IceOverlay.BURST_TOTAL_MS);
        expect(look(el)).toBe('ice-overlay ice-burst');
        jest.advanceTimersByTime(IceOverlay.BURST_TOTAL_MS + 1000);
        expect(ov(el)).not.toBeNull();
    });
    test('works from the cracked frame and mid-form too', () => {
        const a = enemy();
        IceOverlay.sync(a, 'thawing');
        expect(IceOverlay.burstOnDefeat(a)).toBe(740);
        expect(look(a)).toBe('ice-overlay ice-burst');
        const b = enemy();
        IceOverlay.sync(b, 'iced');
        jest.advanceTimersByTime(100);
        expect(IceOverlay.burstOnDefeat(b)).toBe(740);
        expect(look(b)).toBe('ice-overlay ice-burst');
    });
    test('the loop cannot swap the final burst back during the death (an iced tick, a thaw tick)', () => {
        const el = enemy();
        IceOverlay.sync(el, 'iced');
        jest.advanceTimersByTime(IceOverlay.FORM_MS);
        IceOverlay.burstOnDefeat(el);
        IceOverlay.sync(el, 'iced');
        IceOverlay.sync(el, 'thawing');
        IceOverlay.sync(el, null);
        expect(look(el)).toBe('ice-overlay ice-burst');
        jest.advanceTimersByTime(5000);
        expect(ov(el)).not.toBeNull();
    });
    test('no ice, no overlay: 0 and nothing is made', () => {
        const el = enemy();
        expect(IceOverlay.burstOnDefeat(el)).toBe(0);
        expect(ov(el)).toBeNull();
        expect(IceOverlay.burstOnDefeat(null)).toBe(0);
    });
    test('motion off: returns 0 and the held ice stays to fade out with the zombie', () => {
        document.body.classList.add('fx-off');
        const el = enemy();
        IceOverlay.sync(el, 'iced');
        expect(IceOverlay.burstOnDefeat(el)).toBe(0);
        expect(look(el)).toBe('ice-overlay ice-hold');
    });
    test('idempotent: a second call does not restart the burst', () => {
        const el = enemy();
        IceOverlay.sync(el, 'iced');
        const first = IceOverlay.burstOnDefeat(el);
        const node = ov(el);
        expect(IceOverlay.burstOnDefeat(el)).toBe(first);
        expect(ov(el)).toBe(node);
    });
});

describe('scale', () => {
    test('a new overlay takes the sprite\'s scale (sub-tasks 0.5, snapped parents 2); default 1', () => {
        const half = enemy(0.5);
        IceOverlay.sync(half, 'iced');
        expect(ov(half).style.getPropertyValue('--ice-scale')).toBe('0.5');
        const plain = enemy();
        IceOverlay.sync(plain, 'iced');
        expect(ov(plain).style.getPropertyValue('--ice-scale')).toBe('1');
    });
    test('syncScale re-scales an existing overlay and is a no-op without one', () => {
        const el = enemy(1);
        expect(() => IceOverlay.syncScale(el, 2)).not.toThrow();
        IceOverlay.sync(el, 'iced');
        IceOverlay.syncScale(el, 2);
        expect(ov(el).style.getPropertyValue('--ice-scale')).toBe('2');
    });
    test('SpriteAnim.syncScale mirrors the scale into the overlay', () => {
        global.IceOverlay = IceOverlay;
        const SpriteAnim = require('../js/spriteAnim.js');
        const el = enemy();
        SpriteAnim.attach(el, 128);
        IceOverlay.sync(el, 'iced');
        SpriteAnim.syncScale(el, 64);
        expect(ov(el).style.getPropertyValue('--ice-scale')).toBe('0.5');
        delete global.IceOverlay;
    });
});

describe('static wiring', () => {
    const css = read('css/enemyIce.css');
    const png = (f) => fs.readFileSync(path.join(ROOT, 'Assets/Effects/ice', f));
    const size = (f) => { const b = png(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

    test('the four PNGs exist with the frame sizes the CSS assumes (128px frames, 8 / 1 / 1 / 7 across)', () => {
        expect(size('ice_form.png')).toEqual({ w: 1024, h: 128 });
        expect(size('ice_hold.png')).toEqual({ w: 128, h: 128 });
        expect(size('ice_hold_cracked.png')).toEqual({ w: 128, h: 128 });
        expect(size('ice_burst.png')).toEqual({ w: 896, h: 128 });
    });
    test('CSS: each look points at its PNG with a matching background-size and step count', () => {
        expect(css).toMatch(/\.ice-overlay\.ice-forming\s*\{[^}]*ice_form\.png[^}]*background-size:\s*1024px 128px[^}]*steps\(8, jump-none\)/s);
        expect(css).toMatch(/\.ice-overlay\.ice-hold\s*\{[^}]*ice_hold\.png[^}]*128px 128px/s);
        expect(css).toMatch(/\.ice-overlay\.ice-cracked\s*\{[^}]*ice_hold_cracked\.png[^}]*128px 128px/s);
        expect(css).toMatch(/\.ice-overlay\.ice-burst\s*\{[^}]*ice_burst\.png[^}]*background-size:\s*896px 128px[^}]*steps\(7, jump-none\)/s);
        expect(css).toMatch(/@keyframes ice-form\s*\{[^@]*?to \{ background-position: -896px 0;/);
        expect(css).toMatch(/@keyframes ice-burst\s*\{[^@]*?to \{ background-position: -768px 0;/);
    });
    test('CSS durations equal the JS constants (form 0.48 s; burst 0.49 s then a 0.25 s fade starting at 0.49 s)', () => {
        expect(css).toMatch(/animation:\s*ice-form 0\.48s/);
        expect(css).toMatch(/animation:\s*ice-burst 0\.49s[^;]*ice-puddle-fade 0\.25s linear 0\.49s/);
        expect(IceOverlay.FORM_MS / 1000).toBe(0.48);
        expect(IceOverlay.BURST_MS / 1000).toBe(0.49);
        expect(IceOverlay.PUDDLE_FADE_MS / 1000).toBe(0.25);
    });
    test('anchor: 128px frame, row 118 on the box bottom (10px below it), scaled about that feet line, above the sprite, under the badge', () => {
        const rule = css.match(/\.enemy > \.ice-overlay\s*\{[^}]*\}/s)[0];
        expect(rule).toMatch(/bottom:\s*-10px/);
        expect(rule).toMatch(/width:\s*128px/);
        expect(rule).toMatch(/height:\s*128px/);
        expect(rule).toMatch(/transform-origin:\s*50% 118px/);
        expect(rule).toMatch(/transform:\s*scale\(var\(--ice-scale\)\)/);
        expect(rule).toMatch(/pointer-events:\s*none/);
        expect(rule).toMatch(/z-index:\s*2/);
        expect(css).toMatch(/\.enemy \.ice-countdown\s*\{[^}]*z-index:\s*5/s);
    });
    test('the zombie wiggles on the SHEET (not the sprite window, whose animation slots are the glows) and the ice itself does not move', () => {
        expect(css).toMatch(/\.enemy\.enemy-thawing \.enemy-sprite-sheet\s*\{[^}]*ice-struggle[^}]*animation-play-state:\s*paused, running/s);
        expect(css).not.toMatch(/\.enemy-thawing > \.enemy-sprite\s*\{[^}]*animation:/s);
        expect(css).not.toMatch(/\.ice-overlay[^{]*\{[^}]*ice-struggle/s);
        expect(css).toMatch(/@keyframes ice-struggle[^{]*\{[^}]*translate:/s);
    });
    test('motion gating in CSS: fx-off / fx-reduced / reduce-motion turn the overlay animations, drips and wiggle off', () => {
        expect(css).toMatch(/\.fx-off \.ice-overlay,\s*\.fx-reduced \.ice-overlay\s*\{\s*animation:\s*none !important/);
        expect(css).toMatch(/\.fx-reduced \.enemy\.enemy-thawing \.enemy-sprite-sheet\s*\{[^}]*animation-name:\s*enemy-sprite-run/s);
        expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\.ice-overlay\s*\{\s*animation:\s*none !important/s);
    });
    test('service worker precaches the module and the four PNGs (never _source), and index.html loads the module', () => {
        const sw = read('sw.js');
        ['js/iceOverlay.js', 'Assets/Effects/ice/ice_form.png', 'Assets/Effects/ice/ice_hold.png',
            'Assets/Effects/ice/ice_hold_cracked.png', 'Assets/Effects/ice/ice_burst.png'].forEach((u) => expect(sw).toContain("'" + u + "'"));
        expect(sw).not.toContain('Effects/ice/_source');
        expect(read('index.html')).toContain('<script src="js/iceOverlay.js"></script>');
    });
});

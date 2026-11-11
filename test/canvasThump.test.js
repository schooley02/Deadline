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

describe('phone buzz', () => {
    afterEach(() => { delete navigator.vibrate; });
    test('a thump vibrates once for CONFIG.CANVAS_THUMP_VIBRATE_MS', () => {
        const el = mount();
        navigator.vibrate = jest.fn(() => true);
        expect(CanvasThump.play(el, 1)).toBe(true);
        expect(navigator.vibrate).toHaveBeenCalledTimes(1);
        expect(navigator.vibrate).toHaveBeenCalledWith(CONFIG.CANVAS_THUMP_VIBRATE_MS);
    });
    test('no buzz inside the cooldown, under fx-off, or under reduce-motion', () => {
        const el = mount();
        navigator.vibrate = jest.fn(() => true);
        CanvasThump.play(el, 1000);
        CanvasThump.play(el, 1100);
        expect(navigator.vibrate).toHaveBeenCalledTimes(1);
        document.body.classList.add('fx-off');
        CanvasThump.play(el, 9000);
        expect(navigator.vibrate).toHaveBeenCalledTimes(1);
    });
    test('a browser without navigator.vibrate (iOS) or one that throws still thumps', () => {
        const el = mount();
        expect(CanvasThump.play(el, 1)).toBe(true);
        CanvasThump.resetForTests();
        navigator.vibrate = () => { throw new Error('blocked'); };
        expect(CanvasThump.play(el, 1)).toBe(true);
    });
    test('the buzz is short and on by default', () => {
        expect(CONFIG.CANVAS_THUMP_VIBRATE_MS).toBeGreaterThan(0);
        expect(CONFIG.CANVAS_THUMP_VIBRATE_MS).toBeLessThanOrEqual(50);
    });
});

describe('Settings switch for the buzz', () => {
    afterEach(() => { delete navigator.vibrate; delete global.Settings; });
    test('switch off: the thump still plays but the phone does not buzz', () => {
        const el = mount();
        navigator.vibrate = jest.fn(() => true);
        global.Settings = { load: () => ({ screenBuzz: false }) };
        expect(CanvasThump.play(el, 1)).toBe(true);
        expect(el.classList.contains('canvas-thump')).toBe(true);
        expect(navigator.vibrate).not.toHaveBeenCalled();
    });
    test('switch on (or never set): it buzzes', () => {
        const el = mount();
        navigator.vibrate = jest.fn(() => true);
        global.Settings = { load: () => ({ screenBuzz: true }) };
        CanvasThump.play(el, 1);
        expect(navigator.vibrate).toHaveBeenCalledTimes(1);
    });
    test('a throwing Settings never stops the thump or the buzz', () => {
        const el = mount();
        navigator.vibrate = jest.fn(() => true);
        global.Settings = { load: () => { throw new Error('storage blocked'); } };
        expect(CanvasThump.play(el, 1)).toBe(true);
        expect(navigator.vibrate).toHaveBeenCalledTimes(1);
    });
    test('sampleBuzz vibrates once, ignoring the cooldown and the motion settings', () => {
        navigator.vibrate = jest.fn(() => true);
        document.body.className = 'fx-off';
        expect(CanvasThump.sampleBuzz()).toBe(true);
        expect(CanvasThump.sampleBuzz()).toBe(true);
        expect(navigator.vibrate).toHaveBeenCalledWith(CONFIG.CANVAS_THUMP_VIBRATE_MS);
        expect(navigator.vibrate).toHaveBeenCalledTimes(2);
    });
});

describe('Settings window + save wiring for the buzz switch', () => {
    const js = read('script.js');
    test('the Settings window has the checkbox, and script.js saves it per device and samples on turn-on', () => {
        const sv = read('js/ui/settingsView.js');
        expect(sv).toContain('id="screenBuzzToggle"');
        expect(sv).toContain('onChangeScreenBuzz');
        expect(js).toMatch(/currentScreenBuzz: Settings\.load\(\)\.screenBuzz !== false/);
        expect(js).toMatch(/function handleScreenBuzzChange\(on\) \{\s*Settings\.save\(\{ screenBuzz: on === true \}\);\s*if \(on === true\) CanvasThump\.sampleBuzz\(\);/);
    });
    test('managementWindows hands both buzz deps through to the Settings window', () => {
        const mw = read('js/ui/managementWindows.js');
        expect(mw).toContain('currentScreenBuzz: deps.currentScreenBuzz,');
        expect(mw).toContain('onChangeScreenBuzz: deps.onChangeScreenBuzz,');
    });
    test('the buzz is per device: left out of an export and not applied by an import', () => {
        expect(js).toMatch(/delete st\.devTools; delete st\.screenBuzz;/);
        expect(js).toMatch(/delete importedSettings\.screenBuzz;/);
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
        expect(js).toMatch(/onItemDefeated: \(item\) => \{ heroAttackOnDefeat\(item\); CanvasThump\.onDefeat\(gameCanvas, item\); \}/);
    });
});

describe('buzz sizes (2026-11-11): normal / heavy / massive', () => {
    afterEach(() => { delete navigator.vibrate; delete global.Timer; });
    const w = (minutes, subs) => ({ minutes, subs: !!subs });

    test('tierFor: massive at 60+ min, heavy with sub-tasks or 30+ min, else normal', () => {
        expect(CONFIG.CANVAS_THUMP_MASSIVE_MIN).toBe(60);
        expect(CanvasThump.tierFor(w(0, false))).toBe('normal');
        expect(CanvasThump.tierFor(w(29, false))).toBe('normal');
        expect(CanvasThump.tierFor(w(30, false))).toBe('heavy');
        expect(CanvasThump.tierFor(w(0, true))).toBe('heavy');
        expect(CanvasThump.tierFor(w(59, true))).toBe('heavy');
        expect(CanvasThump.tierFor(w(60, false))).toBe('massive');
        expect(CanvasThump.tierFor(w(600, true))).toBe('massive');
        expect(CanvasThump.tierFor()).toBe('normal');
    });
    test('weightOf: sub-tasks kept by a completed parent count, logged minutes come from Timer', () => {
        expect(CanvasThump.weightOf(null)).toEqual({ subs: false, minutes: 0 });
        expect(CanvasThump.weightOf({ type: 'task', subTasks: [], totalSubTasks: 0, completedSubTasks: 0 }).subs).toBe(false);
        expect(CanvasThump.weightOf({ type: 'task', subTasks: [], totalSubTasks: 3, completedSubTasks: 3 }).subs).toBe(true);
        expect(CanvasThump.weightOf({ type: 'task', subTasks: [], completedSubTasks: 2 }).subs).toBe(true);
        expect(CanvasThump.weightOf({ timerMsBanked: 75 * 60000 }).minutes).toBe(75);
        global.Timer = { loggedMinutes: jest.fn(() => 42) };
        expect(CanvasThump.weightOf({}, 5000).minutes).toBe(42);
        expect(global.Timer.loggedMinutes).toHaveBeenCalledWith({}, 5000);
        global.Timer = { loggedMinutes: () => { throw new Error('x'); } };
        expect(CanvasThump.weightOf({ timerMsBanked: 1 }).minutes).toBe(0);
    });
    test('the patterns are real vibrate patterns, each bigger than the last', () => {
        const total = (p) => (Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p);
        expect(Array.isArray(CONFIG.CANVAS_THUMP_HEAVY_PATTERN)).toBe(true);
        expect(Array.isArray(CONFIG.CANVAS_THUMP_MASSIVE_PATTERN)).toBe(true);
        expect(CONFIG.CANVAS_THUMP_HEAVY_PATTERN.every((n) => n > 0)).toBe(true);
        expect(CONFIG.CANVAS_THUMP_MASSIVE_PATTERN.every((n) => n > 0)).toBe(true);
        expect(total(CONFIG.CANVAS_THUMP_HEAVY_PATTERN)).toBeGreaterThan(total(CONFIG.CANVAS_THUMP_VIBRATE_MS));
        expect(total(CONFIG.CANVAS_THUMP_MASSIVE_PATTERN)).toBeGreaterThan(total(CONFIG.CANVAS_THUMP_HEAVY_PATTERN));
        expect(CanvasThump.buzzFor('normal')).toBe(CONFIG.CANVAS_THUMP_VIBRATE_MS);
        expect(CanvasThump.buzzFor('heavy')).toBe(CONFIG.CANVAS_THUMP_HEAVY_PATTERN);
        expect(CanvasThump.buzzFor('massive')).toBe(CONFIG.CANVAS_THUMP_MASSIVE_PATTERN);
    });
    test('onDefeat buzzes at the item\'s size (plain number for normal, a pattern for the others)', () => {
        const el = mount();
        navigator.vibrate = jest.fn(() => true);
        CanvasThump.onDefeat(el, { timerMsBanked: 2 * 60000 });
        jest.advanceTimersByTime(CONFIG.CANVAS_THUMP_DELAY_MS + 5);
        expect(navigator.vibrate).toHaveBeenLastCalledWith(CONFIG.CANVAS_THUMP_VIBRATE_MS);
        CanvasThump.resetForTests();
        CanvasThump.onDefeat(el, { completedSubTasks: 2, totalSubTasks: 2, subTasks: [] });
        jest.advanceTimersByTime(CONFIG.CANVAS_THUMP_DELAY_MS + 5);
        expect(navigator.vibrate).toHaveBeenLastCalledWith(CONFIG.CANVAS_THUMP_HEAVY_PATTERN);
        CanvasThump.resetForTests();
        CanvasThump.onDefeat(el, { timerMsBanked: 61 * 60000 });
        jest.advanceTimersByTime(CONFIG.CANVAS_THUMP_DELAY_MS + 5);
        expect(navigator.vibrate).toHaveBeenLastCalledWith(CONFIG.CANVAS_THUMP_MASSIVE_PATTERN);
    });
    test('onDefeat with no item stays a normal tick (old callers keep working)', () => {
        const el = mount();
        navigator.vibrate = jest.fn(() => true);
        CanvasThump.onDefeat(el);
        jest.advanceTimersByTime(CONFIG.CANVAS_THUMP_DELAY_MS + 5);
        expect(navigator.vibrate).toHaveBeenCalledWith(CONFIG.CANVAS_THUMP_VIBRATE_MS);
    });
    test('two completions inside the strike delay share one thump at the bigger size', () => {
        const el = mount();
        navigator.vibrate = jest.fn(() => true);
        CanvasThump.onDefeat(el, { timerMsBanked: 90 * 60000 });
        CanvasThump.onDefeat(el, {});
        jest.advanceTimersByTime(CONFIG.CANVAS_THUMP_DELAY_MS + 5);
        expect(navigator.vibrate).toHaveBeenCalledTimes(1);
        expect(navigator.vibrate).toHaveBeenCalledWith(CONFIG.CANVAS_THUMP_MASSIVE_PATTERN);
        CanvasThump.resetForTests();
        CanvasThump.onDefeat(el, {});
        jest.advanceTimersByTime(CONFIG.CANVAS_THUMP_DELAY_MS + 5);
        expect(navigator.vibrate).toHaveBeenLastCalledWith(CONFIG.CANVAS_THUMP_VIBRATE_MS);
    });
    test('the Settings switch and CANVAS_THUMP_VIBRATE_MS = 0 mute every size', () => {
        const el = mount();
        navigator.vibrate = jest.fn(() => true);
        global.Settings = { load: () => ({ screenBuzz: false }) };
        CanvasThump.play(el, 1, 'massive');
        expect(navigator.vibrate).not.toHaveBeenCalled();
        delete global.Settings;
        const saved = CONFIG.CANVAS_THUMP_VIBRATE_MS;
        CONFIG.CANVAS_THUMP_VIBRATE_MS = 0;
        CanvasThump.play(el, 9999, 'massive');
        CONFIG.CANVAS_THUMP_VIBRATE_MS = saved;
        expect(navigator.vibrate).not.toHaveBeenCalled();
    });
});

describe('dev preview (the dev panel Buzz buttons)', () => {
    afterEach(() => { delete navigator.vibrate; delete global.Settings; });
    test('preview plays the thump and the tier\'s buzz now, ignoring the cooldown and the Settings switch', () => {
        const el = mount();
        navigator.vibrate = jest.fn(() => true);
        global.Settings = { load: () => ({ screenBuzz: false }) };
        expect(CanvasThump.preview(el, 'massive')).toBe('massive');
        expect(CanvasThump.preview(el, 'heavy')).toBe('heavy');
        expect(el.classList.contains('canvas-thump')).toBe(true);
        expect(navigator.vibrate).toHaveBeenNthCalledWith(1, CONFIG.CANVAS_THUMP_MASSIVE_PATTERN);
        expect(navigator.vibrate).toHaveBeenNthCalledWith(2, CONFIG.CANVAS_THUMP_HEAVY_PATTERN);
        jest.advanceTimersByTime(CONFIG.CANVAS_THUMP_DURATION_MS + 5);
        expect(el.classList.contains('canvas-thump')).toBe(false);
    });
    test('an unknown tier is the normal buzz; fx-off keeps the buzz but skips the motion; a missing element never throws', () => {
        const el = mount();
        navigator.vibrate = jest.fn(() => true);
        expect(CanvasThump.preview(el, 'bogus')).toBe('normal');
        expect(navigator.vibrate).toHaveBeenCalledWith(CONFIG.CANVAS_THUMP_VIBRATE_MS);
        document.body.classList.add('fx-off');
        const el2 = document.getElementById('gameCanvas');
        el2.className = '';
        CanvasThump.preview(el2, 'heavy');
        expect(el2.classList.contains('canvas-thump')).toBe(false);
        expect(navigator.vibrate).toHaveBeenLastCalledWith(CONFIG.CANVAS_THUMP_HEAVY_PATTERN);
        expect(() => CanvasThump.preview(null, 'massive')).not.toThrow();
    });
});

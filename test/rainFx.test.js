/**
 * @jest-environment jsdom
 *
 * RainFx (2026-11-07): what Jest can check without a real canvas -- hosts get exactly one <canvas>, it runs only in the Storm band,
 * a host VillageView rebuilds is picked up again, reduced motion draws a still frame and never starts the loop, and the shell /
 * load order / CSS are wired. How it LOOKS is checked in a browser (Settings > Developer tools > DEV > Storm).
 */
const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

function loadFresh() {
    jest.resetModules();
    global.RainSim = require('../js/rainSim');
    return require('../js/ui/rainFx');
}

function sizeHost(el, w, h) {
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: w });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: h });
}

function buildDom(storm) {
    document.body.innerHTML = `
        <div id="gameCanvas" class="${storm ? 'climate-storm' : 'climate-fog'}">
            <div class="scene-layer rain rain--far"></div>
            <div class="scene-layer climate-lightning"></div>
            <div id="climateWxNear"><div class="rain rain--near1"></div><div class="rain rain--near2"></div></div>
            <div class="village-wx village-wx--mid"><div class="rain rain--mid"></div></div>
        </div>`;
    document.querySelectorAll('.rain').forEach((el) => sizeHost(el, 390, 300));
    document.getElementById('gameCanvas').style.setProperty('--clm-hz', '224px');
}

// jsdom has no canvas: hand every <canvas> a counting fake 2d context so drawing can be checked and the "not implemented" noise is gone.
let ctxs;
function fakeCtx() {
    const c = { fillStyle: '', calls: { fillRect: 0, clearRect: 0 }, fillRect() { c.calls.fillRect++; }, clearRect() { c.calls.clearRect++; } };
    ctxs.push(c);
    return c;
}

let RainFx;
let rafCb;
beforeEach(() => {
    jest.useFakeTimers();
    ctxs = [];
    rafCb = null;
    HTMLCanvasElement.prototype.getContext = function () { return this._ctx || (this._ctx = fakeCtx()); };
    window.matchMedia = undefined;
    global.requestAnimationFrame = jest.fn((cb) => { rafCb = cb; return 1; });
    global.cancelAnimationFrame = jest.fn();
    RainFx = loadFresh();
});
afterEach(() => {
    RainFx.destroy();
    jest.useRealTimers();
    document.body.innerHTML = '';
    document.body.className = '';
    delete global.requestAnimationFrame;
    delete global.cancelAnimationFrame;
});

describe('hosts', () => {
    test('in Storm every host gets exactly one canvas, sized at 1/PX of the host, and a layer', () => {
        buildDom(true);
        RainFx.init({});
        const entries = RainFx._entries();
        expect(entries).toHaveLength(4);
        document.querySelectorAll('.rain').forEach((host) => {
            expect(host.querySelectorAll('canvas.rain-canvas')).toHaveLength(1);
        });
        entries.forEach((e) => {
            expect(e.canvas.width).toBe(Math.ceil(390 / RainFx.PX));
            expect(e.canvas.height).toBe(Math.ceil(300 / RainFx.PX));
            expect(e.layer).not.toBeNull();
        });
    });

    test('re-scanning does not stack a second canvas on a host', () => {
        buildDom(true);
        RainFx.init({});
        jest.advanceTimersByTime(2000);
        document.querySelectorAll('.rain').forEach((host) => expect(host.querySelectorAll('canvas')).toHaveLength(1));
    });

    test('a host the village rebuilds is picked up again and the old one is forgotten', () => {
        buildDom(true);
        RainFx.init({});
        const old = document.querySelector('.village-wx--mid');
        old.remove();
        const fresh = document.createElement('div');
        fresh.className = 'village-wx village-wx--mid';
        fresh.innerHTML = '<div class="rain rain--mid"></div>';
        document.getElementById('gameCanvas').appendChild(fresh);
        sizeHost(fresh.querySelector('.rain'), 300, 300);
        jest.advanceTimersByTime(700);
        expect(fresh.querySelectorAll('canvas')).toHaveLength(1);
        expect(RainFx._entries()).toHaveLength(4);
        expect(RainFx._entries().every((e) => e.host.isConnected)).toBe(true);
    });

    test('an unsized host (display: none) gets a canvas but no layer yet', () => {
        buildDom(true);
        sizeHost(document.querySelector('.rain--mid'), 0, 0);
        RainFx.init({});
        const mid = RainFx._entries().find((e) => e.role === 'mid');
        expect(mid.layer).toBeNull();
    });

    test('a host with no depth class is left alone', () => {
        buildDom(true);
        const odd = document.createElement('div');
        odd.className = 'rain';
        sizeHost(odd, 100, 100);
        document.getElementById('gameCanvas').appendChild(odd);
        RainFx.init({});
        expect(odd.querySelector('canvas')).toBeNull();
    });
});

describe('band switching', () => {
    test('outside Storm nothing is created and no loop starts', () => {
        buildDom(false);
        RainFx.init({});
        expect(RainFx._entries()).toHaveLength(0);
        expect(document.querySelector('canvas')).toBeNull();
        expect(global.requestAnimationFrame).not.toHaveBeenCalled();
    });

    test('switching to Storm starts it; switching away stops the loop', async () => {
        buildDom(false);
        RainFx.init({});
        const canvas = document.getElementById('gameCanvas');
        canvas.className = 'climate-storm';
        await Promise.resolve(); // MutationObserver callbacks are microtasks
        await Promise.resolve();
        expect(RainFx._entries().length).toBe(4);
        expect(global.requestAnimationFrame).toHaveBeenCalled();
        canvas.className = 'climate-clear';
        await Promise.resolve();
        await Promise.resolve();
        expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });
});

describe('motion settings', () => {
    test.each(['fx-reduced', 'fx-off'])('%s: a still frame per host and no animation loop', (cls) => {
        document.body.className = cls;
        buildDom(true);
        document.body.className = cls;
        RainFx.init({});
        expect(RainFx.motionMode()).toBe('still');
        expect(global.requestAnimationFrame).not.toHaveBeenCalled();
        expect(RainFx._entries()).toHaveLength(4);
    });

    test('prefers-reduced-motion is honoured', () => {
        window.matchMedia = jest.fn(() => ({ matches: true }));
        buildDom(true);
        RainFx.init({});
        expect(RainFx.motionMode()).toBe('still');
        expect(global.requestAnimationFrame).not.toHaveBeenCalled();
    });

    test('with no setting the rain animates', () => {
        buildDom(true);
        RainFx.init({});
        expect(RainFx.motionMode()).toBe('live');
        expect(global.requestAnimationFrame).toHaveBeenCalled();
    });
});

// 2026-11-09 (Jeremy: the storm "doesn't seem windy at all"): during a gust the far clouds speed up with the rain.
describe('clouds ride the gusts', () => {
    function fakeAnim(rate) {
        return { playbackRate: rate, effect: { getComputedTiming: () => ({ iterations: Infinity, duration: 1000, delay: 0 }) } };
    }
    function addClouds(anims) {
        const scene = document.createElement('div');
        scene.id = 'graveyardScene';
        anims.forEach((a) => {
            const el = document.createElement('div');
            el.className = 'scene-clouds-drift';
            el.getAnimations = () => [a];
            scene.appendChild(el);
        });
        document.getElementById('gameCanvas').appendChild(scene);
    }
    function run(seconds) {
        let ts = 1000;
        let peak = 0;
        for (let i = 0; i < seconds * 25; i++) { ts += 40; if (rafCb) rafCb(ts); peak = Math.max(peak, anims[0].playbackRate); }
        return peak;
    }
    let anims;

    test('cloudRateFor: calm = their own pace, the top of a gust = CLOUD_GUST_RATE', () => {
        expect(RainFx.cloudRateFor(0)).toBe(1);
        expect(RainFx.cloudRateFor(1)).toBe(RainFx.CLOUD_GUST_RATE);
        expect(RainFx.cloudRateFor(0.5)).toBeCloseTo(1 + (RainFx.CLOUD_GUST_RATE - 1) / 2, 5);
        expect(RainFx.cloudRateFor(NaN)).toBe(1);
        expect(RainFx.cloudRateFor(5)).toBe(RainFx.CLOUD_GUST_RATE);
        expect(RainFx.CLOUD_GUST_RATE).toBeGreaterThan(1);
    });

    test('a gust speeds the clouds up, a scrubbed cloud is left alone, and leaving the storm hands them back at rate 1', () => {
        buildDom(true);
        anims = [fakeAnim(1), fakeAnim(0)];
        addClouds(anims);
        RainFx.init({});
        const peak = run(20); // the first gust comes within 14 s
        expect(peak).toBeGreaterThan(1.5);
        expect(anims[1].playbackRate).toBe(0);
        document.getElementById('gameCanvas').className = 'climate-fog';
        RainFx.sync();
        expect(anims[0].playbackRate).toBe(1);
        expect(anims[1].playbackRate).toBe(0);
    });
});

describe('drawing', () => {
    test('still mode paints each host once: clears, then draws drop pixels', () => {
        document.body.className = 'fx-off';
        buildDom(true);
        document.body.className = 'fx-off';
        RainFx.init({});
        expect(ctxs).toHaveLength(4);
        ctxs.forEach((c) => { expect(c.calls.clearRect).toBeGreaterThan(0); expect(c.calls.fillRect).toBeGreaterThan(0); });
    });

    test('live frames keep painting, and a lightning flash re-starts the glow within the first 12 seconds', () => {
        buildDom(true);
        RainFx.init({});
        const glow = document.querySelector('.climate-lightning');
        let ts = 1000;
        let flashed = false;
        for (let i = 0; i < 400 && !flashed; i++) {
            ts += 34;
            const cb = rafCb;
            cb(ts);
            flashed = glow.classList.contains('is-flash');
        }
        expect(flashed).toBe(true);
        ctxs.forEach((c) => expect(c.calls.fillRect).toBeGreaterThan(0));
    });

    test('2026-11-12: while the time slider is away from now the rain draws and steps nothing; it resumes without a jump', () => {
        buildDom(true);
        let frozen = true;
        RainFx.init({ isFrozen: () => frozen });
        let ts = 1000;
        for (let i = 0; i < 30; i++) { ts += 40; rafCb(ts); }
        ctxs.forEach((c) => expect(c.calls.fillRect).toBe(0)); // frozen: no drop was painted
        expect(global.requestAnimationFrame).toHaveBeenCalled(); // the loop stays alive, so Now resumes it at once
        frozen = false;
        for (let i = 0; i < 10; i++) { ts += 40; rafCb(ts); }
        ctxs.forEach((c) => expect(c.calls.fillRect).toBeGreaterThan(0));
    });

    test('a hidden page does not keep the loop going', () => {
        buildDom(true);
        RainFx.init({});
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        const before = global.requestAnimationFrame.mock.calls.length;
        rafCb(5000);
        expect(global.requestAnimationFrame.mock.calls.length).toBe(before);
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    });
});

describe('intensity', () => {
    test('follows the run climate score; a forced sky (no score) uses 1', () => {
        buildDom(true);
        RainFx.init({ getResult: () => ({ score: 0.1 }) });
        expect(RainFx._entries()[0].layer.intensity).toBeCloseTo(1.5, 5);
        RainFx.destroy();
        document.querySelectorAll('canvas').forEach((c) => c.remove());
        RainFx = loadFresh();
        buildDom(true);
        RainFx.init({ getResult: () => ({ band: 'storm', trend: 'steady' }) });
        expect(RainFx._entries()[0].layer.intensity).toBe(1);
    });

    test('a throwing getResult never breaks the rain', () => {
        buildDom(true);
        expect(() => RainFx.init({ getResult: () => { throw new Error('x'); } })).not.toThrow();
        expect(RainFx._entries()[0].layer.intensity).toBe(1);
    });
});

describe('portrait glance strip (2026-11-11)', () => {
    test('the near rain lands on the strip floor (sky 32 + marker 32 - inset 8 = 56px), not the landscape horizon', () => {
        expect(RainFx.stripHorizon()).toBe(56);
        document.body.className = 'glance-strip';
        buildDom(true);
        RainFx.init({ getResult: () => null });
        RainFx._entries().forEach((e) => expect(e.layer.hz).toBe(56 / RainFx.PX));
    });

    test('the strip gets STRIP_RAIN_DENSITY x the drops; landscape stays at 1', () => {
        buildDom(true);
        RainFx.init({ getResult: () => null });
        const far = RainFx._entries().find((e) => e.role === 'far');
        expect(far.layer.density).toBe(1);
        const landscapeDrops = far.layer.drops.length;
        document.body.className = 'glance-strip';
        sizeHost(far.host, 390, 92); // the strip's size
        jest.advanceTimersByTime(700); // the rescan
        expect(far.layer.density).toBe(RainFx.STRIP_RAIN_DENSITY);
        expect(far.layer.hz).toBe(56 / RainFx.PX);
        expect(landscapeDrops).toBeGreaterThan(0);
    });
});

describe('shell + load order + css', () => {
    const html = read('index.html');
    const sw = read('sw.js');
    const css = read('css/climate.css');
    const script = read('script.js');

    test('both files are in the service worker APP_SHELL, on disk, and the cache was bumped past v264', () => {
        ['js/rainSim.js', 'js/ui/rainFx.js'].forEach((f) => {
            expect(sw).toContain(`'${f}'`);
            expect(fs.existsSync(path.join(__dirname, '..', f))).toBe(true);
        });
        expect(Number(/deadline-shell-v(\d+)/.exec(sw)[1])).toBeGreaterThanOrEqual(265);
    });

    test('rainSim loads before rainFx, rainFx after ClimateView, both before script.js', () => {
        const at = (s) => html.indexOf(`"${s}"`);
        expect(at('js/rainSim.js')).toBeGreaterThan(0);
        expect(at('js/rainSim.js')).toBeLessThan(at('js/ui/rainFx.js'));
        expect(at('js/ui/rainFx.js')).toBeGreaterThan(at('js/ui/climateView.js'));
        expect(at('js/ui/rainFx.js')).toBeLessThan(at('script.js'));
    });

    test('script.js starts RainFx right after ClimateView, with the same climate source', () => {
        const i = script.indexOf('ClimateView.init(');
        expect(i).toBeGreaterThan(0);
        expect(script.slice(i, i + 400)).toContain('RainFx.init({ getResult: climateNow, isFrozen:');
    });

    test('the CSS rain is only hosts + a pixelated canvas: no gradient sheets, no tap-taking', () => {
        const block = css.slice(css.indexOf('.rain {\n    pointer-events: none;'), css.indexOf('/* Soft lightning'));
        expect(block).not.toMatch(/gradient/);
        expect(block).not.toMatch(/animation/);
        expect(block).toMatch(/\.rain-canvas \{[^}]*image-rendering: pixelated/);
        expect(block).toMatch(/\.rain-canvas \{[^}]*pointer-events: none/);
        expect(css).not.toContain('climate-rainfall');
    });

    test('the lightning glow is a one-shot swell that peaks at or under 0.4 and is never an infinite loop', () => {
        const kf = /@keyframes climate-lightning-flash \{([\s\S]*?)\n\}/.exec(css)[1];
        const peaks = (kf.match(/opacity: ([0-9.]+)/g) || []).map((m) => Number(m.split(': ')[1]));
        expect(Math.max.apply(null, peaks)).toBeLessThanOrEqual(0.4);
        expect(css).toMatch(/\.climate-lightning\.is-flash \{\s*animation: climate-lightning-flash [0-9.]+s ease-out 1;/);
        expect(css).not.toMatch(/climate-lightning[^;{]*infinite/);
    });
});

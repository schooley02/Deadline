/**
 * Run climate wiring checks (Build 1, 2026-11-03): what Jest can verify about the weather layers without loading script.js --
 * shell list, cache bump, script order, the markup hooks, z-order of the new layers, portrait hiding, the number's own layer,
 * and the script.js hook-up. How it LOOKS is checked in a browser (docs/mockups/run-climate/ is the approved reference).
 */
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');
const RunClimate = require('../js/runClimate.js');

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const html = read('index.html');
const sw = read('sw.js');
const css = read('css/climate.css');
const canvasCss = read('css/gameCanvas.css');
const gyCss = read('css/graveyard.css');
const strip = read('css/glanceStrip.css');
const script = read('script.js');
const villageView = read('js/ui/villageView.js');

const FILES = ['css/climate.css', 'js/runClimate.js', 'js/ui/climateView.js'];

// The text of the first rule whose selector line is exactly `selector {`.
function block(source, selector) {
    const start = source.indexOf(selector + ' {');
    expect(start).toBeGreaterThanOrEqual(0);
    return source.slice(start, source.indexOf('}', start));
}
const z = (source, selector) => {
    const m = /z-index:\s*(-?\d+)/.exec(block(source, selector));
    expect(m).not.toBeNull();
    return Number(m[1]);
};

describe('shell + load order', () => {
    test.each(FILES)('%s is in the service worker APP_SHELL and on disk', f => {
        expect(sw).toContain(`'${f}'`);
        expect(fs.existsSync(path.join(__dirname, '..', f))).toBe(true);
    });

    test('CACHE_NAME was bumped for the shell change (v236 or later)', () => {
        const m = /CACHE_NAME = 'deadline-shell-v(\d+)'/.exec(sw);
        expect(m).not.toBeNull();
        expect(Number(m[1])).toBeGreaterThanOrEqual(236);
    });

    test('the pure logic loads before the view; the view after VillageView; both before script.js', () => {
        const at = s => html.indexOf(`"${s}"`);
        expect(at('js/runClimate.js')).toBeGreaterThan(0);
        expect(at('js/ui/climateView.js')).toBeGreaterThan(at('js/ui/villageView.js'));
        expect(at('js/ui/climateView.js')).toBeLessThan(at('script.js'));
        expect(at('js/runClimate.js')).toBeLessThan(at('script.js'));
    });

    test('climate.css loads before glanceStrip.css (so the portrait hide wins) and after village.css', () => {
        const at = s => html.indexOf(`"${s}"`);
        expect(at('css/climate.css')).toBeGreaterThan(at('css/village.css'));
        expect(at('css/climate.css')).toBeLessThan(at('css/glanceStrip.css'));
    });

    test('CONFIG.CLIMATE mirrors RunClimate.DEFAULTS', () => {
        expect(CONFIG.CLIMATE).toEqual(RunClimate.DEFAULTS);
    });
});

describe('markup hooks', () => {
    const scene = html.slice(html.indexOf('id="graveyardScene"'), html.indexOf('id="villageLayer"'));

    test('five extra sky-cloud layers follow the base clouds; each has a .scene-clouds-drift child (the time slider scrubs it)', () => {
        for (let n = 1; n <= 5; n++) {
            expect(scene).toMatch(new RegExp(`class="scene-layer scene-clouds scene-clouds-extra scene-clouds-x${n}"><div class="scene-clouds-drift"></div></div>`));
        }
        expect(scene.indexOf('scene-clouds-x1')).toBeGreaterThan(scene.indexOf('class="scene-layer scene-clouds"'));
        expect(scene.indexOf('scene-clouds-x5')).toBeLessThan(scene.indexOf('scene-silhouettes'));
    });

    test('far haze sits after the silhouettes (over clouds + hill) and before the ground', () => {
        const hz = scene.indexOf('climate-haze-far');
        expect(hz).toBeGreaterThan(scene.indexOf('scene-silhouettes'));
        expect(hz).toBeLessThan(scene.indexOf('scene-ground'));
        expect(z(css, '.climate-haze-far')).toBe(z(canvasCss, '.scene-silhouettes')); // equal z, later in the DOM => above
        expect(z(css, '.climate-haze-far')).toBeLessThan(z(canvasCss, '.scene-ground'));
    });

    test('#climateNear is a decorative child of #gameCanvas', () => {
        expect(html).toMatch(/id="climateNear"[^>]*aria-hidden="true"/);
        expect(html.indexOf('id="climateNear"')).toBeGreaterThan(html.indexOf('id="gameCanvas"'));
    });

    test('the moon keeps role=img + the aria-label; the number and label moved to the decorative #nightsSurvivedUi', () => {
        const moon = html.slice(html.indexOf('id="nightsSurvived"'), html.indexOf('id="nightsSurvivedUi"'));
        expect(moon).toMatch(/role="img"/);
        expect(moon).toMatch(/aria-label="0 nights survived"/);
        expect(moon).not.toContain('id="nightsSurvivedCount"');
        const ui = html.slice(html.indexOf('id="nightsSurvivedUi"'), html.indexOf('id="nightsSurvivedUi"') + 400);
        expect(ui).toMatch(/id="nightsSurvivedUi" class="nights-ui" aria-hidden="true"/);
        expect(ui).toContain('id="nightsSurvivedCount"');
        expect(ui).toContain('nights-label');
    });
});

describe('z-order', () => {
    test('near haze is over the whole zombie band (80 pile, 85 hover) and under the stats overlay', () => {
        const near = z(css, '.climate-near');
        expect(near).toBeGreaterThan(85);
        expect(near).toBeLessThan(90);
    });

    test('the Nights Survived number sits above the near haze, still inside the canvas (below 90)', () => {
        const ui = z(canvasCss, '.nights-ui');
        expect(ui).toBeGreaterThan(z(css, '.climate-near'));
        expect(ui).toBeLessThan(90);
    });

    test('the moon disc stays under the clouds so weather passes in front of it (space is behind the weather)', () => {
        expect(z(canvasCss, '.nights-survived')).toBeLessThan(z(canvasCss, '.scene-clouds'));
    });

    test('every weather layer ignores pointer events (the village and zombies stay tappable)', () => {
        expect(block(css, '.village-haze')).toMatch(/pointer-events:\s*none/);
        expect(block(css, '.climate-near')).toMatch(/pointer-events:\s*none/);
        expect(block(canvasCss, '.nights-ui')).toMatch(/pointer-events:\s*none/);
        expect(canvasCss).toMatch(/\.graveyard-scene \{[^}]*pointer-events:\s*none/); // far haze + sky clouds live in here
    });

    test('the village haze is built by VillageView and never given pointer-events auto', () => {
        expect(villageView).toContain('village-haze');
        expect(css).not.toMatch(/village-haze[^{]*\{[^}]*pointer-events:\s*auto/);
    });
});

describe('looks key off one class per band', () => {
    test.each(RunClimate.BANDS)('css/climate.css defines #gameCanvas.climate-%s', band => {
        expect(css).toContain(`#gameCanvas.climate-${band} {`);
    });

    test('Clear keeps today\'s look: gameCanvas.css fallbacks are the original colours and glow', () => {
        expect(canvasCss).toContain('var(--clm-s0, #0b0b24)');
        expect(canvasCss).toContain('var(--clm-s3, #3d3a5c)');
        expect(canvasCss).toContain('var(--clm-g1, 36px)');
        expect(canvasCss).toContain('var(--clm-hill, #141426)');
        expect(block(css, '#gameCanvas.climate-clear')).not.toMatch(/--clm-s0/);
    });

    test('haze strengthens with the band: far haze Hazy < Overcast < Fog < Storm', () => {
        const far = b => Number(/--clm-far:\s*([\d.]+)/.exec(block(css, `#gameCanvas.climate-${b}`))[1]);
        expect(far('clear')).toBe(0);
        expect(far('hazy')).toBeLessThan(far('overcast'));
        expect(far('overcast')).toBeLessThan(far('fog'));
        expect(far('fog')).toBeLessThan(far('storm'));
    });

    test('rows get hazier the further back in Fog and Storm (mid < row2 < row1) -- Jeremy 2026-11-03', () => {
        ['fog', 'storm'].forEach(b => {
            const bl = block(css, `#gameCanvas.climate-${b}`);
            const v = k => Number(new RegExp(`--clm-${k}:\\s*([\\d.]+)`).exec(bl)[1]);
            expect(v('mid')).toBeLessThan(v('row2'));
            expect(v('row2')).toBeLessThan(v('row1'));
        });
    });

    test('sky clouds in Overcast / Fog / Storm replace the base layer; only the sky is covered (tops stay near the top)', () => {
        ['overcast', 'fog', 'storm'].forEach(b => {
            expect(css).toContain(`#gameCanvas.climate-${b} .scene-clouds:not(.scene-clouds-extra)`);
        });
        const tops = [...css.matchAll(/--cl-top:\s*(-?\d+)px/g)].map(m => Number(m[1]));
        expect(Math.max(...tops)).toBeLessThanOrEqual(70); // Hazy's low cloud is the lowest; nothing reaches the buildings
    });

    test('the extra cloud drift obeys the motion settings (fx-reduced / fx-off / prefers-reduced-motion)', () => {
        expect(css).toMatch(/\.fx-reduced \.scene-clouds-extra \.scene-clouds-drift,\s*\.fx-off \.scene-clouds-extra \.scene-clouds-drift \{\s*animation: none;/);
        expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.scene-clouds-extra \.scene-clouds-drift \{\s*animation: none;/);
    });

    test('weather clouds move slower the worse it gets: Fog sky clouds and Storm ceiling are slower than the base drift', () => {
        const base = Number(/animation: cloud-idle-drift (\d+)s/.exec(canvasCss)[1]);
        const durs = b => [...css.matchAll(new RegExp(`climate-${b} \\.scene-clouds-x\\d \\{[^}]*--cl-dur:\\s*(\\d+)s`, 'g'))].map(m => Number(m[1]));
        expect(Math.min(...durs('fog'))).toBeGreaterThan(base);
        expect(Math.min(...durs('storm'))).toBeGreaterThan(Math.max(...durs('fog')));
    });

    test('the number is restyled as a lit sign from Overcast on, with a plate behind the label in Fog / Storm only', () => {
        expect(css).toContain(':is(.climate-overcast, .climate-fog, .climate-storm) .nights-ui .nights-count');
        expect(css).toContain(':is(.climate-fog, .climate-storm) .nights-ui .nights-label');
        expect(css).not.toMatch(/climate-(clear|hazy)[^{]*\.nights-ui/);
    });
});

describe('portrait glance strip hides the weather layers', () => {
    test.each(['.nights-ui', '.climate-haze-far', '.climate-near', '.village-haze', '.scene-clouds-extra'])('%s', sel => {
        const m = new RegExp(`body\\.glance-strip ${sel.replace('.', '\\.')}[,\\s{][^{]*\\{\\s*display:\\s*none`).exec(strip);
        expect(m).not.toBeNull();
    });

    test('graveyard.css moves the number layer left of the hill together with the moon', () => {
        expect(gyCss).toMatch(/\.nights-survived,\s*\.nights-ui \{\s*right: calc\(var\(--gy-hill-w\) \+ 12px\)/);
    });
});

describe('script.js hook-up', () => {
    test('ClimateView is initialised with the lazy result and refreshed from the layout hook, the tick and after the restore', () => {
        expect(script).toContain('ClimateView.init({ getResult: climateNow })');
        expect((script.match(/ClimateView\.refresh\(\)/g) || []).length).toBeGreaterThanOrEqual(3);
        expect(script.indexOf('VillageView.render(BASE_WIDTH);\n        ClimateView.refresh();')).toBeGreaterThan(0);
    });

    test('the result is derived from the closed-days store for THIS run, cached per day|run|over, and uses CONFIG.CLIMATE', () => {
        expect(script).toContain('RunClimate.compute(Persistence.loadDays(), runNumber, CONFIG.CLIMATE)');
        expect(script).toMatch(/const runNumber = over \? finished : finished \+ 1;/);
        expect(script).toContain("(over ? 'over' : 'live')");
    });

    test('the ?climate= dev override is honoured, and a failure falls back to the last good value (no crash)', () => {
        expect(script).toContain('ClimateView.parseOverride(window.location.search)');
        expect(script).toContain('RunClimate.forced(climateOverride.band, climateOverride.trend)');
        expect(script).toMatch(/Deadline: run climate failed/);
    });

    test('nothing about the climate is persisted: no new storage key or State field', () => {
        const mine = script.slice(script.indexOf('const climateCache'), script.indexOf('ClimateView.init({ getResult: climateNow })'));
        expect(mine).not.toMatch(/localStorage|saveGame|Persistence\.save/);
    });
});

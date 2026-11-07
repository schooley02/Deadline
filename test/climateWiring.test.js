/**
 * Run climate wiring checks (Build 1, 2026-11-03): what Jest can verify about the weather layers without loading script.js --
 * shell list, cache bump, script order, the markup hooks, z-order of the new layers, portrait hiding, the number's own layer,
 * and the script.js hook-up. How it LOOKS is checked in a browser (docs/mockups/run-climate/ is the approved reference).
 */
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');
const RunClimate = require('../js/runClimate.js');

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n'); // script.js is CRLF on Jeremy's Windows checkout; the multi-line checks below expect \n (2026-11-04)
const html = read('index.html');
const sw = read('sw.js');
const css = read('css/climate.css');
const canvasCss = read('css/gameCanvas.css');
const gyCss = read('css/graveyard.css');
const strip = read('css/glanceStrip.css');
const script = read('script.js');
const villageView = read('js/ui/villageView.js');

const FILES = ['css/climate.css', 'css/weatherPanel.css', 'js/runClimate.js', 'js/ui/climateView.js', 'js/ui/weatherPanel.js', 'Assets/scene/fog-tile.png'];
const wpCss = read('css/weatherPanel.css');

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

    test('CACHE_NAME was bumped for the shell change (v237 or later)', () => {
        const m = /CACHE_NAME = 'deadline-shell-v(\d+)'/.exec(sw);
        expect(m).not.toBeNull();
        expect(Number(m[1])).toBeGreaterThanOrEqual(237);
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

    test('weatherPanel.js loads after climateView.js and before script.js; weatherPanel.css sits with the other climate css before glanceStrip.css', () => {
        const at = s => html.indexOf(`"${s}"`);
        expect(at('js/ui/weatherPanel.js')).toBeGreaterThan(at('js/ui/climateView.js'));
        expect(at('js/ui/weatherPanel.js')).toBeLessThan(at('script.js'));
        expect(at('css/weatherPanel.css')).toBeGreaterThan(at('css/climate.css'));
        expect(at('css/weatherPanel.css')).toBeLessThan(at('css/glanceStrip.css'));
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
    test('the near haze film is behind the church and the village (2026-11-07: full width, z -1, so there is no seam beside the church)', () => {
        expect(z(css, '.climate-near')).toBeLessThan(0);
        expect(z(css, '.climate-near')).toBeGreaterThan(z(canvasCss, '.scene-ground') - 1);
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

// z-index of ANY rule for `selector` (the sheet has a default-off rule and a styling rule per piece)
const zAny = (source, selector) => {
    const esc = selector.replace(/[.]/g, '\\.');
    const m = new RegExp('(?:^|[\\s,}])' + esc + '\\s*\\{[^}]*z-index:\\s*(-?\\d+)', 'm').exec(source);
    expect(m).not.toBeNull();
    return Number(m[1]);
};

describe('Build 2 layers: markup + z-order + input', () => {
    const canvas = html.slice(html.indexOf('id="gameCanvas"'));

    test('scene weather (far rain, lightning) sits in the sky, after the far haze and before the ground', () => {
        const scene = html.slice(html.indexOf('id="graveyardScene"'), html.indexOf('id="villageLayer"'));
        expect(scene.indexOf('rain rain--far')).toBeGreaterThan(scene.indexOf('climate-haze-far'));
        expect(scene.indexOf('climate-lightning')).toBeGreaterThan(scene.indexOf('climate-haze-far'));
        expect(scene.indexOf('climate-lightning')).toBeLessThan(scene.indexOf('scene-ground'));
    });

    test('the near wrapper holds three banks and two rain sheets, is decorative, and comes after #climateNear', () => {
        const wx = canvas.slice(canvas.indexOf('id="climateWxNear"'));
        expect(wx).toMatch(/^id="climateWxNear" class="climate-wx-near" aria-hidden="true"/);
        ['n1', 'n2', 'n3'].forEach(n => expect(wx.slice(0, 600)).toContain(`fog-bank fog-bank--${n}`));
        ['near1', 'near2'].forEach(n => expect(wx.slice(0, 600)).toContain(`rain rain--${n}`));
        expect(canvas.indexOf('id="climateWxNear"')).toBeGreaterThan(canvas.indexOf('id="climateNear"'));
    });

    test('36 fireflies (24 in the air, 12 low over the ground), the moonbeam and the break glow exist and are decorative', () => {
        const flies = canvas.match(/class="firefly[^"]*"/g) || [];
        expect(flies.length).toBe(36);
        expect(flies.filter(f => f.includes('firefly--g')).length).toBe(12);
        (canvas.match(/class="firefly firefly--g[^"]*" style="[^"]*"/g) || []).forEach(f => expect(f).toMatch(/--ff-bot:\d+px/));
        expect(canvas).toMatch(/class="climate-fireflies"[^>]*aria-hidden="true"/);
        expect(canvas).toMatch(/class="climate-beam"[^>]*aria-hidden="true"/);
        expect(html).toMatch(/class="climate-break"[^>]*aria-hidden="true"/);
    });

    test('ground fireflies are placed from the bottom (on the ground art) and the core is bright enough to see', () => {
        expect(css).toMatch(/\.firefly--g \{[^}]*top:\s*auto;[^}]*bottom:\s*var\(--ff-bot/);
        expect(css).toMatch(/@keyframes firefly-glow[\s\S]*?34%\s*\{\s*opacity:\s*1;/);
        expect(css).toMatch(/\.firefly--b \{\s*width:\s*3px/);
    });

    test('8 fireflies glow IN FRONT of the zombies (over the pile 80, under the near weather 87); the other 28 stay behind', () => {
        const m = /<div class="climate-fireflies climate-fireflies--front" aria-hidden="true">([\s\S]*?)<\/div>/.exec(canvas);
        expect(m).not.toBeNull();
        const front = m[1].match(/class="firefly[^"]*"/g) || [];
        expect(front.length).toBe(8);
        expect(front.some(f => f.includes('firefly--g'))).toBe(true);
        expect(front.some(f => !f.includes('firefly--g'))).toBe(true);
        expect(zAny(css, '.climate-fireflies--front')).toBeGreaterThan(80);
        expect(zAny(css, '.climate-fireflies--front')).toBeLessThan(87);
    });

    test('near weather sits over the zombie band (pile 80, hover 85) and under the stats overlay (90)', () => {
        expect(zAny(css, '.climate-wx-near')).toBeGreaterThan(85);
        expect(zAny(css, '.climate-wx-near')).toBeLessThan(90);
    });

    test('fireflies are under the zombies (30+); the beam is not above the village; the lightning and break glow stay in the sky', () => {
        expect(zAny(css, '.climate-fireflies')).toBeLessThan(30);
        expect(zAny(css, '.climate-beam')).toBeLessThanOrEqual(1);
        expect(zAny(css, '.climate-lightning')).toBeLessThan(0);
        expect(zAny(css, '.climate-break')).toBeLessThan(0);
    });

    test.each(['.village-wx', '.fog-bank', '.rain', '.climate-fireflies', '.climate-beam', '.climate-break'])('%s never takes a tap', sel => {
        const re = new RegExp(`(^|[\\s,])${sel.replace('.', '\\.')}[,\\s]*(\\{|[^{]*\\{)[^}]*pointer-events:\\s*none`, 'm');
        expect(css).toMatch(re);
    });
    test('no weather rule ever turns pointer-events on', () => {
        expect(css).not.toMatch(/pointer-events:\s*auto/);
    });

    test('the near wrapper + village wrappers clip themselves (the canvas and village layer are overflow: visible)', () => {
        expect(css).toMatch(/\.village-wx,\s*\.climate-wx-near \{[^}]*overflow:\s*hidden/);
    });

    test('every weather piece is off by default and each is switched on by one band / trend class', () => {
        expect(css).toMatch(/\.fog-bank \{ display: none; \}|\.fog-bank,[^{]*\{\s*display:\s*none/);
        expect(css).toMatch(/climate-fog[^{]*\.fog-bank/);
        expect(css).toMatch(/climate-storm[^{]*\.rain/);
        expect(css).toMatch(/climate-clear[^{]*\.climate-fireflies/);
        expect(css).toMatch(/climate-trend-up[^{]*\.climate-beam/);
        expect(css).toMatch(/climate-trend-up[^{]*\.climate-break/);
    });

    test('motion settings: fog + rain stop, lightning + fireflies vanish (fx-reduced / fx-off / prefers-reduced-motion)', () => {
        expect(css).toMatch(/\.fx-reduced \.fog-bank, \.fx-off \.fog-bank,\s*\.fx-reduced \.rain, \.fx-off \.rain \{ animation: none; \}/);
        expect(css).toMatch(/\.fx-reduced \.climate-lightning, \.fx-off \.climate-lightning,\s*\.fx-reduced \.climate-fireflies, \.fx-off \.climate-fireflies \{ display: none !important; \}/);
        const mq = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('motion settings: static')));
        expect(mq).toContain('.fog-bank');
        expect(mq).toContain('.rain');
        expect(mq).toContain('.climate-lightning');
        expect(mq).toContain('.climate-fireflies');
    });

    test('the fog tile is pre-baked (no per-frame filter on the banks)', () => {
        const bank = css.slice(css.indexOf('.fog-bank {\n    position: absolute'));
        const body = bank.slice(0, bank.indexOf('}'));
        expect(body).toContain('Assets/scene/fog-tile.png');
        expect(body).not.toMatch(/filter:/);
    });

    test('banks and rain are placed from the horizon variable VillageView publishes', () => {
        expect(css).toContain('var(--clm-hz');
        expect(villageView).toContain("'--clm-hz'");
    });
});

describe('weather badge (Build 2)', () => {
    test('#weatherBadge is a hidden-by-default <button> inside #gameCanvas with the icon + trend children', () => {
        const m = /<button[^>]*id="weatherBadge"[^>]*>[\s\S]*?<\/button>/.exec(html);
        expect(m).not.toBeNull();
        expect(m[0]).toMatch(/\bhidden\b/);
        expect(m[0]).toContain('type="button"');
        expect(m[0]).toContain('weather-badge-icon');
        expect(m[0]).toContain('weather-badge-trend');
        expect(html.indexOf('id="weatherBadge"')).toBeGreaterThan(html.indexOf('id="gameCanvas"'));
    });

    test('the badge is above the weather (89, with the number) and below the stats overlay (90), takes taps, has a 44px target', () => {
        const b = block(wpCss, '.weather-badge');
        expect(b).toMatch(/z-index:\s*89/);
        expect(b).toMatch(/pointer-events:\s*auto/);
        expect(b).toMatch(/width:\s*44px/);
        expect(b).toMatch(/height:\s*44px/);
        expect(z(wpCss, '.weather-badge')).toBeGreaterThan(z(css, '.climate-near'));
    });

    test('the badge sits beside the moon: it follows the moon\'s hill offset variable', () => {
        expect(block(wpCss, '.weather-badge')).toContain('var(--gy-hill-w');
    });

    test('the pulse stops under fx-reduced / fx-off / prefers-reduced-motion', () => {
        expect(wpCss).toMatch(/\.fx-reduced \.weather-badge--pulse \.weather-badge-chip,\s*\.fx-off \.weather-badge--pulse \.weather-badge-chip \{\s*animation: none/);
        expect(wpCss).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.weather-badge--pulse \.weather-badge-chip \{ animation: none/);
    });

    test('the portrait strip has no sky, so the badge is hidden there (Stats shows the weather instead)', () => {
        expect(strip).toMatch(/body\.glance-strip \.weather-badge,/);
    });
});

describe('script.js: badge + Stats readout', () => {
    test('WeatherPanel is initialised before ClimateView (so the first refresh reaches the badge) and ClimateView reports changes to it', () => {
        expect(script.indexOf('WeatherPanel.init({ getResult: climateNow });')).toBeGreaterThan(0);
        expect(script.indexOf('WeatherPanel.init({ getResult: climateNow });')).toBeLessThan(script.indexOf('ClimateView.init({ getResult: climateNow, onChange'));
    });

    test('the Stats window gets the sky readout, built from the same lazy result', () => {
        expect(script).toContain('weatherHtml: WeatherPanel.statsHtml(WeatherPanel.buildViewModel(climateNow()))');
        expect(read('js/ui/managementWindows.js')).toContain('weatherHtml: deps.weatherHtml');
        const stats = read('js/ui/statsView.js');
        expect(stats).toContain('${deps.weatherHtml || \'\'}');
        expect(stats).toContain('weatherHtml: deps.weatherHtml');
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

    test('rows get hazier the further back in every hazy band (mid < row2 < row1) -- Jeremy 2026-11-03, Hazy + Overcast 2026-11-07', () => {
        ['hazy', 'overcast', 'fog', 'storm'].forEach(b => {
            const bl = block(css, `#gameCanvas.climate-${b}`);
            const v = k => Number(new RegExp(`--clm-${k}:\\s*([\\d.]+)`).exec(bl)[1]);
            expect(v('mid')).toBeLessThan(v('row2'));
            expect(v('row2')).toBeLessThan(v('row1'));
        });
    });

    test('the stacked haze on the far row grows with the band and stays under Fog (Hazy < Overcast < Fog)', () => {
        const stack = b => {
            const bl = block(css, `#gameCanvas.climate-${b}`);
            const v = k => Number(new RegExp(`--clm-${k}:\\s*([\\d.]+)`).exec(bl)[1]);
            return 1 - (1 - v('row1')) * (1 - v('row2')) * (1 - v('mid'));
        };
        expect(stack('hazy')).toBeGreaterThan(0.25); // the back-to-front step has to be visible, not 8 points
        expect(stack('hazy')).toBeLessThan(stack('overcast'));
        expect(stack('overcast')).toBeLessThan(stack('fog'));
    });

    test('sky clouds in Overcast / Fog / Storm replace the base layer; only the sky is covered (tops stay near the top)', () => {
        ['overcast', 'fog', 'storm'].forEach(b => {
            expect(css).toContain(`#gameCanvas.climate-${b} .scene-clouds:not(.scene-clouds-extra)`);
        });
        const tops = [...css.matchAll(/--cl-top:\s*(-?\d+)px/g)].map(m => Number(m[1]));
        expect(Math.max(...tops)).toBeLessThanOrEqual(70); // Fog's low cloud is the lowest; nothing reaches the buildings
    });

    test('Clear has no sky clouds; Hazy keeps exactly the original cloud layer (no extra cloud) -- Jeremy 2026-11-07', () => {
        expect(css).toContain('#gameCanvas.climate-clear .scene-clouds:not(.scene-clouds-extra) { display: none; }');
        expect(css).not.toMatch(/^#gameCanvas\.climate-hazy[^{\n]*\.scene-clouds/m); // Hazy neither hides the base layer nor adds an extra one
        expect(css).not.toMatch(/^#gameCanvas\.climate-(clear|hazy)[^{\n]*\.scene-clouds-x\d/m);
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
        expect(script).toContain('ClimateView.init({ getResult: climateNow, onChange: (r) => WeatherPanel.updateBadge(r) });');
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
        const mine = script.slice(script.indexOf('const climateCache'), script.indexOf('ClimateView.init({ getResult: climateNow, onChange'));
        expect(mine).not.toMatch(/localStorage|saveGame|Persistence\.save/);
    });
});

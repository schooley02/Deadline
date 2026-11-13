/**
 * Dev tools wiring (2026-11-03): what Jest can check without loading script.js -- shell list + cache bump, load order, the Settings
 * switch, and the script.js hook-up. The important negative rules are pinned here: a demo is read ONLY by the scene's two
 * questions (the sky, the village's drawn tier) and never by anything that pays, records or saves; and the per-device switch never
 * travels in a backup. How it looks is checked in a browser.
 */
const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n'); // script.js is CRLF on Jeremy's Windows checkout; the multi-line checks below expect \n (2026-11-04)
const html = read('index.html');
const sw = read('sw.js');
const script = read('script.js');
const css = read('css/devPanel.css');
const modalCss = read('css/modal.css');
const fabCss = read('css/fabMenu.css');
const settingsView = read('js/ui/settingsView.js');
const mgmt = read('js/ui/managementWindows.js');

// The source of one top-level-ish function in script.js, from its `function name(` to the next 4-space-indented `function `.
function fnBody(name) {
    const start = script.indexOf('function ' + name + '(');
    expect(start).toBeGreaterThanOrEqual(0);
    const next = script.indexOf('\n    function ', start + 10);
    return script.slice(start, next > 0 ? next : start + 4000);
}

describe('shell + load order', () => {
    test.each(['css/devPanel.css', 'js/devDemo.js', 'js/ui/devPanel.js'])('%s is in the service worker APP_SHELL and on disk', (f) => {
        expect(sw).toContain(`'${f}'`);
        expect(fs.existsSync(path.join(__dirname, '..', f))).toBe(true);
    });

    test('CACHE_NAME was bumped for the shell change (v239 or later)', () => {
        const m = /CACHE_NAME = 'deadline-shell-v(\d+)'/.exec(sw);
        expect(Number(m[1])).toBeGreaterThanOrEqual(239);
    });

    test('devDemo.js loads after runClimate.js and settings.js, devPanel.js after devDemo.js, both before script.js', () => {
        const at = (s) => html.indexOf(`"${s}"`);
        expect(at('js/devDemo.js')).toBeGreaterThan(at('js/runClimate.js'));
        expect(at('js/ui/devPanel.js')).toBeGreaterThan(at('js/devDemo.js'));
        expect(at('js/ui/devPanel.js')).toBeLessThan(at('script.js'));
        expect(at('js/devDemo.js')).toBeLessThan(at('script.js'));
    });

    test('devPanel.css is linked before responsive.css (which must stay last)', () => {
        const at = (s) => html.indexOf(`"${s}"`);
        expect(at('css/devPanel.css')).toBeGreaterThan(0);
        expect(at('css/devPanel.css')).toBeLessThan(at('css/responsive.css'));
    });
});

describe('look + position', () => {
    test('the DEV button is bottom-LEFT, and the add-task FAB is still bottom-right (distinct places)', () => {
        const btn = css.slice(css.indexOf('.dev-button {'), css.indexOf('}', css.indexOf('.dev-button {')));
        expect(btn).toMatch(/position:\s*fixed/);
        expect(btn).toMatch(/left:\s*\d+px/);
        expect(btn).toMatch(/bottom:\s*\d+px/);
        expect(btn).not.toMatch(/right:/);
        expect(btn).toMatch(/dashed/);   // amber dashed: never mistaken for the round green "+"
        const fab = fabCss.slice(fabCss.indexOf('.fab-container {'), fabCss.indexOf('}', fabCss.indexOf('.fab-container {')));
        expect(fab).toMatch(/right:/);
        expect(fab).not.toMatch(/left:/);
    });

    test('on a phone in landscape the button sits ABOVE the day pager row (not on its prev button / label), and the panel is right of it', () => {
        const at = css.indexOf('@media (orientation: landscape) and (max-height: 500px) {');
        expect(at).toBeGreaterThan(0);
        const block = css.slice(at, css.indexOf('\n}\n', at));
        const bottom = Number(/\.dev-button \{ bottom: (\d+)px; \}/.exec(block)[1]);
        expect(bottom).toBeGreaterThanOrEqual(48);          // the pager row is ~44px tall + 5px from the bottom edge
        const left = Number(/\.dev-panel \{[^}]*left:\s*(\d+)px/.exec(block)[1]);
        expect(left).toBeGreaterThanOrEqual(198);           // clears the pager's prev / label / next buttons (x 16..196)
    });

    test('portrait says the sky and village show in landscape (the strip draws neither)', () => {
        expect(read('js/ui/devPanel.js')).toContain('The sky and village show in landscape.');
        expect(css).toMatch(/@media \(orientation: portrait\) \{\s*\.dev-portrait-hint \{ display: block; \}/);
    });

    test('button and panel sit above the scene but BELOW modal overlays', () => {
        const zOf = (src, sel) => Number(/z-index:\s*(\d+)/.exec(src.slice(src.indexOf(sel + ' {'), src.indexOf('}', src.indexOf(sel + ' {'))))[1]);
        const overlayZ = Number(/\.modal-overlay[^{]*\{[^}]*z-index:\s*(\d+)/.exec(modalCss)[1]);
        expect(zOf(css, '.dev-button')).toBeGreaterThanOrEqual(1000);
        expect(zOf(css, '.dev-panel')).toBeGreaterThanOrEqual(zOf(css, '.dev-button'));
        expect(zOf(css, '.dev-panel')).toBeLessThan(overlayZ);
    });

    test('the panel has no backdrop (the sky must stay visible while you tap)', () => {
        expect(css).not.toMatch(/\.dev-panel[^{]*\{[^}]*(backdrop-filter|inset:\s*0|width:\s*100(vw|%))/);
    });
});

describe('the Settings switch', () => {
    test('the Settings view draws a Developer tools checkbox from deps.currentDevTools and reports changes', () => {
        expect(settingsView).toContain('id="devToolsToggle"');
        expect(settingsView).toContain('deps.currentDevTools === true');
        expect(settingsView).toContain('deps.onChangeDevTools');
    });

    test('the switch is NOT limited to localhost / ?dev (it must work on the phone on the live Pages build)', () => {
        const section = settingsView.slice(settingsView.indexOf('settings-devtools-section') - 80, settingsView.indexOf('settings-devtools-section') + 40);
        expect(section).not.toMatch(/devMode/);
        expect(settingsView.indexOf('settings-devtools-section')).toBeLessThan(settingsView.indexOf('${devMode ?'));
    });

    test('managementWindows passes both deps through to the Settings view', () => {
        expect(mgmt).toContain('currentDevTools: deps.currentDevTools');
        expect(mgmt).toContain('onChangeDevTools: deps.onChangeDevTools');
    });

    test('script.js reads it fresh when Settings opens and saves it per device, then shows / hides the DEV button', () => {
        expect(script).toContain('currentDevTools: Settings.load().devTools === true');
        expect(script).toContain('onChangeDevTools: handleDevToolsChange');
        const body = fnBody('handleDevToolsChange');
        expect(body).toContain('Settings.save({ devTools: on === true })');
        expect(body).toContain('DevPanel.setEnabled(on === true)');
    });
});

describe('script.js hook-up', () => {
    test('boot: the panel starts from the stored switch, after initGame (the church element is laid out)', () => {
        const initAt = script.indexOf('DevPanel.init({');
        expect(initAt).toBeGreaterThan(0);
        expect(script).toContain('DevPanel.setEnabled(Settings.load().devTools === true);');
        expect(initAt).toBeGreaterThan(script.indexOf('    initGame();\n    State.restoreGameState(stateDeps());'));
        const hook = script.slice(initAt, initAt + 200);
        expect(hook).toContain('VillageView.render(baseElement.offsetWidth)');
        expect(hook).toContain('ClimateView.refresh()');
    });

    test('the sky asks the demo FIRST, then the ?climate= param, then the real climate', () => {
        const body = fnBody('realClimateNow'); // the REAL sky; climateNow() adds the player's Lv 4 pick on top (W1c, 2026-11-09)
        const demoAt = body.indexOf('DevDemo.weather()');
        const urlAt = body.indexOf('if (climateOverride)');
        const realAt = body.indexOf('RunClimate.compute(');
        expect(demoAt).toBeGreaterThanOrEqual(0);
        expect(demoAt).toBeLessThan(urlAt);
        expect(urlAt).toBeLessThan(realAt);
    });

    test('the village tier asks the demo FIRST (before the ?xTier= params), and a demo star is clamped to the tier count', () => {
        const body = fnBody('villageTierDep');
        const demoAt = body.indexOf('DevDemo.villageTier()');
        expect(demoAt).toBeGreaterThanOrEqual(0);
        expect(demoAt).toBeLessThan(body.indexOf('window.location.search'));
        expect(body).toContain("VillageLayout.resolveTier('', param, demoTier,");
    });

    test('NOTHING that pays, records or saves reads the demo: drops, run-record peaks, real tiers, card progress', () => {
        ['payVillageDrops', 'realVillageTiers', 'peakTierWhileOver', 'villageProgressNow', 'villageContext', 'openVillageCard', 'trackBestVillageTiers'].forEach((fn) => {
            expect(fnBody(fn)).not.toMatch(/DevDemo|DevPanel/);
        });
        expect(read('js/state.js')).not.toMatch(/DevDemo|DevPanel/);
        expect(read('js/damage.js')).not.toMatch(/DevDemo|DevPanel/);
        expect(read('js/villageDrops.js')).not.toMatch(/DevDemo|DevPanel/);
        expect(read('js/persistence.js')).not.toMatch(/DevDemo|DevPanel/);
    });

    test('script.js mentions the demo in exactly the expected places (sky, village tier, church preview, boot, switch handler)', () => {
        const code = script.split('\n').filter((l) => !/^\s*\/\//.test(l)); // comments may name it freely
        const hits = code.filter((l) => /DevDemo\./.test(l));
        expect(hits.filter((l) => /DevDemo\.weather\(\)/.test(l)).length).toBe(1);
        // 2 = the eight buildings' tier read (villageTierDep) + the Memorial obelisk's stage (memorialStageNow, 2026-11-08: the DEV star previews it too).
        // The Memorial's SAVED mark (trackBestVillageTiers) never reads it -- see the "NOTHING that pays, records or saves" test above.
        expect(hits.filter((l) => /DevDemo\.villageTier\(\)/.test(l)).length).toBe(2);
        expect(hits.filter((l) => /DevDemo\.churchHealth\(\)/.test(l)).length).toBe(2); // applyChurchPreview + its observer
        // The graveyard's own chips (2026-11-08): the Memorial obelisk stage and the tree stage, each read once, scene-only.
        expect(hits.filter((l) => /DevDemo\.memorialStage\(\)/.test(l)).length).toBe(1);
        expect(hits.filter((l) => /DevDemo\.treeStage\(\)/.test(l)).length).toBe(1);
        expect(hits.filter((l) => /DevDemo\.markerStage\(\)/.test(l)).length).toBe(1); // the Headstones chips (2026-11-08), read once in markersNow
        expect(hits.length).toBe(8); // nothing else reads it; everything else goes through DevPanel
        expect(code.filter((l) => /DevPanel\.(init|setEnabled)/.test(l)).length).toBe(3);
    });
});

describe('church damage preview is ART ONLY', () => {
    const body = () => fnBody('applyChurchPreview');

    test('the stand-in number only ever goes to Damage.applyBaseArt / resolveBase*; never to state, HUD, saves or records', () => {
        const src = body() + fnBody('previewChurchHit') + fnBody('churchPreviewMatches');
        expect(src).toContain('Damage.applyBaseArt(baseElement, standIn)');
        expect(src).not.toMatch(/setBaseHealth|damageBase|healBase|saveGame|Persistence|recordDaily|bumpToday|updateBaseVisuals|updateBaseHealth|baseHealthDisplay|State\.set|Items\.|Economy\.|Shop\./);
    });

    test('the only State call is the READ of the real health, to restore the real picture when the demo clears', () => {
        const calls = body().match(/State\.\w+/g) || [];
        expect(calls).toEqual(['State.getBaseHealth']);
        expect(body()).toContain('Damage.applyBaseArt(baseElement, State.getBaseHealth())');
    });

    test('the observer only rewrites #base when it differs from the demo picture (so it cannot loop), and watches style + data-base-anim only', () => {
        expect(body()).toContain('!churchPreviewMatches(now)');
        expect(body()).toContain("attributeFilter: ['style', 'data-base-anim']");
    });

    test('a demo change and the Hit button are wired through DevPanel.init', () => {
        const hook = script.slice(script.indexOf('DevPanel.init({'), script.indexOf('DevPanel.init({') + 320);
        expect(hook).toContain('applyChurchPreview()');
        expect(hook).toContain('onHit: previewChurchHit');
    });

    test('the hit plays the same classes a real hit does, cleaned up by a timer', () => {
        const src = fnBody('previewChurchHit');
        expect(src).toContain("'base-hit-flash', 'base-hit-shake'");
        expect(src).toContain('setTimeout');
        expect(css).toMatch(/dev-chip--action/);
    });

    test('the panel has a Church section with Real + the five pictures and a Hit button', () => {
        const panel = read('js/ui/devPanel.js');
        expect(panel).toContain('data-dev-church');
        expect(panel).toContain('data-dev-hit');
        expect(panel).toContain('Church (picture only)');
    });

    test('the panel has a Buzz section (Normal / Heavy / Massive) wired to CanvasThump.preview', () => {
        const panel = read('js/ui/devPanel.js');
        ['normal', 'heavy', 'massive'].forEach((t) => expect(panel).toContain('data-dev-buzz="' + t + '"'));
        const js = read('script.js');
        expect(js).toContain('onBuzz: previewBuzz');
        expect(js).toMatch(/function previewBuzz\(tier\) \{ CanvasThump\.preview\(gameCanvas, tier\); \}/);
    });

    test('the game files that own health know nothing about the preview', () => {
        ['js/damage.js', 'js/state.js', 'js/hud.js', 'js/persistence.js', 'js/ui/timeSliderView.js'].forEach((f) => {
            if (fs.existsSync(path.join(__dirname, '..', f))) expect(read(f)).not.toMatch(/DevDemo|DevPanel|churchHealth/);
        });
    });
});

describe('the switch is per device: never in a backup', () => {
    test('export strips devTools from the settings it writes', () => {
        expect(script).toMatch(/getSettings: \(\) => \{ const st = Settings\.load\(\); delete st\.devTools; delete st\.screenBuzz; delete st\.moodCardDay; return st; \}/); // (the buzz switch, 2026-11-10, and the once-a-day mood card stamp, 2026-11-13, are per device too)
    });

    test('import ignores a devTools flag in the file', () => {
        expect(script).toContain('delete importedSettings.devTools;');
        expect(script).toContain('Settings.save(importedSettings);');
        expect(script).not.toContain('Settings.save(envelope.settings || Settings.DEFAULTS);');
    });
});

describe('the Weather panel note is true for both ways of forcing a sky', () => {
    test('the Dev preview note no longer claims the sky came only from ?climate=', () => {
        const wp = read('js/ui/weatherPanel.js');
        expect(wp).toMatch(/Dev preview: this sky was forced/);
        expect(wp).toContain('dev tools');
    });
});

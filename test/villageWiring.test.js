/**
 * V7 W2 first-slice wiring checks (2026-10-29): things Jest can verify about the village layer
 * without loading script.js -- shell list, cache bump, script order, z-order vs the MIDNIGHT line,
 * portrait hiding and script.js hook-up. Live behaviour is checked in a browser.
 */
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const html = read('index.html');
const sw = read('sw.js');
const css = read('css/village.css');
const canvasCss = read('css/gameCanvas.css');
const strip = read('css/glanceStrip.css');
const script = read('script.js');

const FILES = ['css/village.css', 'css/villageCard.css', 'js/villageLayout.js', 'js/villageProgress.js', 'js/ui/villageView.js', 'js/ui/villageCard.js'];
const SPRITES = [
    ...[1, 2, 3, 4, 5].map(t => `Assets/Village/punctuality_t${t}.png`),
    ...[1, 2, 3, 4, 5].map(t => `Assets/Village/defense_t${t}.png`),
    ...[1, 2, 3, 4, 5].map(t => `Assets/Village/slain_t${t}.png`),
    ...[1, 2, 3, 4, 5].map(t => `Assets/Village/nights_t${t}.png`),
    ...[1, 2, 3, 4, 5].map(t => `Assets/Village/lurkers_t${t}.png`), // the boxing gym (2026-10-30)
    ...[1, 2, 3, 4, 5].map(t => `Assets/Village/heroes_t${t}.png`), // the high school (2026-10-30)
    ...[1, 2, 3, 4, 5].map(t => `Assets/Village/habits_t${t}.png`), // the hospital (2026-10-30, placeholder = T3 x5)
    ...[1, 2, 3, 4, 5].map(t => `Assets/Village/bestdays_t${t}.png`), // the windmill, far row (2026-10-30, placeholder art)
];

describe('shell + load order', () => {
    test.each([...FILES, ...SPRITES])('%s is in the service worker APP_SHELL', f => {
        expect(sw).toContain(`'${f}'`);
    });

    test('every village file and sprite exists on disk', () => {
        [...FILES, ...SPRITES].forEach(f => expect(fs.existsSync(path.join(__dirname, '..', f))).toBe(true));
    });

    test('CACHE_NAME was bumped for the shell change (v145 or later: the building card)', () => {
        const m = /CACHE_NAME = 'deadline-shell-v(\d+)'/.exec(sw);
        expect(m).not.toBeNull();
        expect(Number(m[1])).toBeGreaterThanOrEqual(145);
    });

    test('layout loads after config and before the view; the view before script.js', () => {
        const at = s => html.indexOf(`"${s}"`);
        expect(at('js/villageLayout.js')).toBeGreaterThan(at('js/config.js'));
        expect(at('js/villageLayout.js')).toBeLessThan(at('js/ui/villageView.js'));
        expect(at('js/ui/villageView.js')).toBeLessThan(at('script.js'));
    });

    test('village.css loads before glanceStrip.css (so the portrait hide wins)', () => {
        const at = s => html.indexOf(`"${s}"`);
        expect(at('css/village.css')).toBeGreaterThan(0);
        expect(at('css/village.css')).toBeLessThan(at('css/glanceStrip.css'));
    });

    test('#villageLayer is a decorative child of #gameCanvas, before the church', () => {
        const canvas = html.slice(html.indexOf('id="gameCanvas"'), html.indexOf('id="base"') + 30);
        expect(canvas).toContain('id="villageLayer"');
        expect(canvas).toMatch(/id="villageLayer"[^>]*aria-hidden="true"/);
    });
});

describe('z-order: under the MIDNIGHT line, behind the zombies, above the scene', () => {
    const z = (source, selector) => {
        const start = source.indexOf(selector + ' {');
        expect(start).toBeGreaterThanOrEqual(0);
        const block = source.slice(start, source.indexOf('}', start));
        const m = /z-index:\s*(-?\d+)/.exec(block);
        expect(m).not.toBeNull();
        return Number(m[1]);
    };

    test('village z-index sits between the scene layers (negative) and #midnightLine', () => {
        const village = z(css, '.village-layer');
        expect(village).toBeGreaterThan(-1);
        expect(village).toBeLessThan(z(canvasCss, '#midnightLine'));
    });

    test('and far below the zombies (CONFIG.LIST_Z_MIN)', () => {
        expect(z(css, '.village-layer')).toBeLessThan(CONFIG.LIST_Z_MIN);
    });

    test('the layer never takes taps (decorative this slice)', () => {
        const block = css.slice(css.indexOf('.village-layer {'), css.indexOf('}', css.indexOf('.village-layer {')));
        expect(block).toMatch(/pointer-events:\s*none/);
    });

    test('sprites are drawn pixelated', () => {
        expect(css).toMatch(/image-rendering:\s*pixelated/);
    });
});

describe('landscape / desktop only', () => {
    test('the portrait strip hides the village layer', () => {
        expect(strip).toMatch(/body\.glance-strip \.village-layer\s*\{\s*display:\s*none/);
    });

    test('the graveyard hide rule is untouched (graveyardWiring still matches it)', () => {
        expect(strip).toMatch(/body\.glance-strip \.graveyard-zone,\s*body\.glance-strip \.run-graves\s*\{\s*display:\s*none/);
    });
});

describe('script.js hook-up', () => {
    test('VillageView is initialised right after the graveyard and fed the hill width + tier', () => {
        expect(script).toContain('VillageView.init({');
        expect(script.indexOf('VillageView.init({')).toBeGreaterThan(script.indexOf('GraveyardView.init({'));
        expect(script).toContain('GraveyardView.zoneWidth()');
        expect(script).toContain("villageTierDep('punctuality', 'villageTier')"); // real tier, URL param overrides (Build 2)
    });

    test('the Jailhouse tier is fed to the view too (kind defense; dev ?jailTier= until defense tier data exists)', () => {
        expect(script).toContain('getJailTier:');
        expect(script).toContain("villageTierDep('defense', 'jailTier')"); // real tier, URL param overrides (Build 2)
    });

    test('the Armory tier is fed to the view too (dev ?armoryTier= until slain tier data exists)', () => {
        expect(script).toContain('getArmoryTier:');
        expect(script).toContain("villageTierDep('slain', 'armoryTier')"); // real tier, URL param overrides (Build 2)
    });

    test('the Radio tower tier is fed to the view too (dev ?radioTier= until nights tier data exists)', () => {
        expect(script).toContain('getRadioTier:');
        expect(script).toContain("villageTierDep('nights', 'radioTier')"); // real tier, URL param overrides (Build 2)
    });

    test('the boxing gym tier is fed to the view too (dev ?gymTier= until lurkers tier data exists)', () => {
        expect(script).toContain('getGymTier:');
        expect(script).toContain("villageTierDep('lurkers', 'gymTier')"); // real tier, URL param overrides (Build 2)
    });

    test('the high school tier is fed to the view too (dev ?schoolTier= until heroes tier data exists)', () => {
        expect(script).toContain('getSchoolTier:');
        expect(script).toContain("villageTierDep('heroes', 'schoolTier')"); // real tier, URL param overrides (Build 2)
    });

    test('the hospital tier is fed to the view too (dev ?hospitalTier= until habits tier data exists)', () => {
        expect(script).toContain('getHospitalTier:');
        expect(script).toContain("villageTierDep('habits', 'hospitalTier')"); // real tier, URL param overrides (Build 2)
        expect(script).toContain('getWindmillTier:'); // the far-row windmill (2026-10-30)
        expect(script).toContain("villageTierDep('bestdays', 'windmillTier')"); // real tier, URL param overrides (Build 2)
    });

    test('`lurkers_t*` is the boxing gym now (128x128); the Jailhouse stays `defense_t*`', () => {
        [1, 2, 3, 4, 5].forEach(t => {
            ['lurkers', 'defense'].forEach(k => expect(fs.existsSync(path.join(__dirname, '..', `Assets/Village/${k}_t${t}.png`))).toBe(true));
            expect(sw).toContain(`'Assets/Village/lurkers_t${t}.png'`);
            expect(sw).toContain(`'Assets/Village/defense_t${t}.png'`);
        });
    });

    test('rendered after every layout change and every tick', () => {
        const calls = script.split('VillageView.render(BASE_WIDTH);').length - 1;
        expect(calls).toBe(2);
    });
});

describe('CONFIG', () => {
    test('the village is on by default and its numbers are sane', () => {
        expect(CONFIG.VILLAGE_ENABLED).toBe(true);
        expect(CONFIG.VILLAGE_TIERS).toBe(5);
        expect(CONFIG.VILLAGE_CLOCK_X_FRAC).toBeGreaterThan(0);
        expect(CONFIG.VILLAGE_CLOCK_X_FRAC).toBeLessThan(1);
        expect(CONFIG.VILLAGE_DEV_CLOCK_TIER).toBeGreaterThanOrEqual(1);
        expect(CONFIG.VILLAGE_DEV_CLOCK_TIER).toBeLessThanOrEqual(CONFIG.VILLAGE_TIERS);
        expect(CONFIG.VILLAGE_DEV_JAIL_TIER).toBeGreaterThanOrEqual(1);
        expect(CONFIG.VILLAGE_DEV_JAIL_TIER).toBeLessThanOrEqual(CONFIG.VILLAGE_TIERS);
        expect(CONFIG.VILLAGE_JAIL_X_FRAC).toBeLessThan(CONFIG.VILLAGE_CLOCK_X_FRAC); // jail stands left of the tower
        expect(CONFIG.VILLAGE_DEV_RADIO_TIER).toBeGreaterThanOrEqual(1);
        expect(CONFIG.VILLAGE_DEV_RADIO_TIER).toBeLessThanOrEqual(CONFIG.VILLAGE_TIERS);
        expect(CONFIG.VILLAGE_RADIO_X_FRAC).toBeGreaterThan(CONFIG.VILLAGE_JAIL_X_FRAC); // the radio stands between jail and tower
        expect(CONFIG.VILLAGE_RADIO_X_FRAC).toBeLessThan(CONFIG.VILLAGE_CLOCK_X_FRAC);
        expect(CONFIG.VILLAGE_DEV_GYM_TIER).toBeGreaterThanOrEqual(1);
        expect(CONFIG.VILLAGE_DEV_GYM_TIER).toBeLessThanOrEqual(CONFIG.VILLAGE_TIERS);
        expect(CONFIG.VILLAGE_GYM_X_FRAC).toBeGreaterThan(CONFIG.VILLAGE_CLOCK_X_FRAC); // the gym stands between the tower and the armory
        expect(CONFIG.VILLAGE_GYM_X_FRAC).toBeLessThan(CONFIG.VILLAGE_ARMORY_X_FRAC);
        expect(CONFIG.VILLAGE_DEV_SCHOOL_TIER).toBeGreaterThanOrEqual(1);
        expect(CONFIG.VILLAGE_DEV_SCHOOL_TIER).toBeLessThanOrEqual(CONFIG.VILLAGE_TIERS);
        expect(CONFIG.VILLAGE_SCHOOL_X_FRAC).toBeGreaterThan(CONFIG.VILLAGE_CLOCK_X_FRAC); // the school stands behind, between the tower and the gym
        expect(CONFIG.VILLAGE_SCHOOL_X_FRAC).toBeLessThan(CONFIG.VILLAGE_GYM_X_FRAC);
        expect(CONFIG.VILLAGE_DEV_HOSPITAL_TIER).toBeGreaterThanOrEqual(1);
        expect(CONFIG.VILLAGE_DEV_HOSPITAL_TIER).toBeLessThanOrEqual(CONFIG.VILLAGE_TIERS);
        expect(CONFIG.VILLAGE_HOSPITAL_X_FRAC).toBeGreaterThan(CONFIG.VILLAGE_GYM_X_FRAC); // the hospital stands behind, between the gym and the armory
        expect(CONFIG.VILLAGE_HOSPITAL_X_FRAC).toBeLessThan(CONFIG.VILLAGE_ARMORY_X_FRAC);
    });
});

describe('Build 2: real tiers + tappable buildings (2026-10-30)', () => {
    test('the card + progress model load before script.js, after Modal', () => {
        const at = f => html.indexOf(`"${f}"`);
        expect(at('js/villageProgress.js')).toBeGreaterThan(0);
        expect(at('js/villageProgress.js')).toBeLessThan(at('script.js'));
        expect(at('js/ui/villageCard.js')).toBeGreaterThan(at('js/ui/modal.js'));
        expect(at('js/ui/villageCard.js')).toBeLessThan(at('script.js'));
        expect(at('css/villageCard.css')).toBeGreaterThan(0);
    });

    test('the layer stays pointer-events none; only the sprites take taps', () => {
        const sp = css.slice(css.indexOf('.village-sprite {'), css.indexOf('}', css.indexOf('.village-sprite {')));
        expect(sp).toMatch(/pointer-events:\s*auto/);
        expect(sp).toMatch(/cursor:\s*pointer/);
    });

    test('script.js reads VillageProgress, opens the card, and keeps the dev params as overrides', () => {
        expect(script).toContain('VillageProgress.compute(');
        expect(script).toContain('VillageProgress.extras(');
        expect(script).toContain('VillageCard.open(');
        expect(script).toContain('onOpenBuilding: openVillageCard');
        expect(script).toContain('VillageLayout.resolveTier(window.location.search');
        // the closed-days store is read once per day/run change, not every tick
        expect(script).toContain('villageCache.daysKey !== daysKey');
    });
});

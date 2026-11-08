/**
 * Memorial obelisk wiring (2026-11-08): what Jest can verify without loading script.js -- the five PNGs, CSS/CONFIG agreement, the
 * service worker, script order, State's saved high-water mark, and that script.js hooks the stage + tracker up. Live behaviour (how it
 * looks on the hill, the tap) is checked in a browser. Stage maths: test/memorial.test.js. DOM: test/graveyardView.test.js.
 */
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');
const Memorial = require('../js/memorial.js');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const html = read('index.html');
const sw = read('sw.js');
const css = read('css/graveyard.css');
const script = read('script.js');
const FILES = [1, 2, 3, 4, 5].map((t) => `Assets/Village/memorial_t${t}.png`);

function pngSize(rel) {
    const b = fs.readFileSync(path.join(root, rel));
    expect(b.slice(1, 4).toString()).toBe('PNG');
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('the art', () => {
    test.each(FILES)('%s is 128x192 (CSS draws it 1:1)', (f) => {
        expect(pngSize(f)).toEqual({ w: CONFIG.GRAVEYARD_MEMORIAL_ART_W_PX, h: CONFIG.GRAVEYARD_MEMORIAL_ART_H_PX });
        expect(CONFIG.GRAVEYARD_MEMORIAL_ART_W_PX).toBe(128);
        expect(CONFIG.GRAVEYARD_MEMORIAL_ART_H_PX).toBe(192);
    });

    test.each([1, 2, 3, 4, 5])('stage %i has its own CSS rule pointing at its PNG', (t) => {
        expect(css).toContain(`.graveyard-memorial-art[data-stage="${t}"] { background-image: url("../Assets/Village/memorial_t${t}.png"); }`);
    });

    test('.graveyard-memorial-art is pixelated, 128x192, and does not take taps itself', () => {
        const i = css.indexOf('\n.graveyard-memorial-art {');
        expect(i).toBeGreaterThanOrEqual(0);
        const block = css.slice(i, css.indexOf('}', i));
        expect(block).toContain('background-size: 128px 192px');
        expect(block).toMatch(/image-rendering: pixelated/);
        expect(block).toMatch(/pointer-events: none/);
    });
});

describe('placement is the one Jeremy settled on (2026-11-08)', () => {
    test('feet 86px up, centre 92px into the 140px zone, plinth row 181', () => {
        expect(CONFIG.GRAVEYARD_MEMORIAL_FEET_PX).toBe(86);
        expect(CONFIG.GRAVEYARD_MEMORIAL_CENTER_X_PX).toBe(92);
        expect(CONFIG.GRAVEYARD_MEMORIAL_PLINTH_ROW).toBe(181);
        expect(CONFIG.GRAVEYARD_MEMORIAL_CENTER_X_PX).toBeLessThan(CONFIG.GRAVEYARD_HILL_WIDTH_PX);
    });
    test('the feet stand inside the hill\'s top band: below the rim, above the ground', () => {
        expect(CONFIG.GRAVEYARD_MEMORIAL_FEET_PX).toBeLessThan(CONFIG.GRAVEYARD_HILL_HEIGHT_PX);
        expect(CONFIG.GRAVEYARD_HILL_HEIGHT_PX - CONFIG.GRAVEYARD_MEMORIAL_FEET_PX).toBe(15); // ~14px of plinth sits down in the band
    });
    test('the one tap box is at least 44x44', () => {
        expect(CONFIG.GRAVEYARD_MEMORIAL_HIT_W_PX).toBeGreaterThanOrEqual(44);
        expect(CONFIG.GRAVEYARD_MEMORIAL_HIT_H_PX).toBeGreaterThanOrEqual(44);
    });
});

describe('shell + load order', () => {
    test.each([...FILES, 'js/memorial.js'])('%s is in the service worker APP_SHELL', (f) => {
        expect(sw).toContain(`'${f}'`);
    });
    test('memorial.js exists and loads before script.js (and before state.js uses it at restore time)', () => {
        expect(fs.existsSync(path.join(root, 'js/memorial.js'))).toBe(true);
        const at = (s) => html.indexOf(`"${s}"`);
        expect(at('js/memorial.js')).toBeGreaterThan(0);
        expect(at('js/memorial.js')).toBeLessThan(at('script.js'));
    });
    test('the cache name was bumped past v282 for this shell change', () => {
        const v = Number((sw.match(/CACHE_NAME = 'deadline-shell-v(\d+)'/) || [])[1]);
        expect(v).toBeGreaterThanOrEqual(283);
    });
    test('the six-stone layer is gone from the markup but the layer the obelisk lives in is kept', () => {
        expect(html).toContain('id="graveyardStones"');
        expect(css).not.toMatch(/\.graveyard-stone(?!s)/); // `.graveyard-stones` (the layer) stays
    });
});

describe('script.js hooks', () => {
    test('GraveyardView gets the stage and no longer the achievement families', () => {
        const i = script.indexOf('GraveyardView.init({');
        const block = script.slice(i, script.indexOf('});', i));
        expect(block).toContain('getMemorialStage: () => memorialStageNow()');
        expect(block).not.toContain('getAchievementFamilies');
    });
    test('the stage comes from the saved all-time bests, with the ?memorialTier= and DEV-panel overrides', () => {
        const i = script.indexOf('function memorialStageNow()');
        expect(i).toBeGreaterThan(0);
        const body = script.slice(i, script.indexOf('\n    }\n', i));
        expect(body).toContain('Memorial.stage(State.getBestVillageTiers())');
        expect(body).toContain("'memorialTier'");
        expect(body).toContain('DevDemo.villageTier()');
    });
    test('the tracker raises the saved mark from the REAL tiers, is called from the tick, and skips game over / offline catch-up', () => {
        const i = script.indexOf('function trackBestVillageTiers(');
        expect(i).toBeGreaterThan(0);
        const body = script.slice(i, script.indexOf('\n    }\n', i));
        expect(body).toContain('State.isGameOver() || offlineCatchUpActive');
        expect(body).toContain('State.setBestVillageTiers(tiers)');
        expect(body).toContain('saveGame()');
        expect(body).not.toContain('resolveTier'); // never the dev overrides
        expect(script).toContain('trackBestVillageTiers(Date.now());');
    });
});

describe('State: bestVillageTiers high-water mark', () => {
    let State;
    beforeAll(() => {
        global.CONFIG = CONFIG;
        global.Memorial = Memorial;
        global.DailyRecord = require('../js/dailyRecord.js');
        global.DayRollover = require('../js/dayRollover.js');
        global.Persistence = require('../js/persistence.js');
        global.RunStats = require('../js/runStats.js');
        global.window = { definedTasks: [] };
    });
    afterAll(() => { delete global.window; delete global.CONFIG; delete global.Memorial; });
    // The setter only RAISES (that is the point), so each test gets a fresh State module with no marks.
    beforeEach(() => {
        jest.isolateModules(() => { State = require('../js/state.js'); });
    });

    test('a fresh game has no marks (stage 1)', () => {
        expect(Memorial.stage(State.getBestVillageTiers())).toBe(1);
    });

    test('setting raises a kind and reports it changed; the same or a lower tier does neither', () => {
        expect(State.setBestVillageTiers({ slain: 3 })).toBe(true);
        expect(State.setBestVillageTiers({ slain: 3 })).toBe(false);
        expect(State.setBestVillageTiers({ slain: 1 })).toBe(false);
        expect(State.getBestVillageTiers().slain).toBe(3);
    });

    test('a new run (all T1) cannot lower it', () => {
        State.setBestVillageTiers({ slain: 4, nights: 2 });
        State.setBestVillageTiers(Object.fromEntries(Memorial.KINDS.map((k) => [k, 1])));
        expect(State.getBestVillageTiers()).toEqual(expect.objectContaining({ slain: 4, nights: 2 }));
    });

    test('junk input is ignored', () => {
        State.setBestVillageTiers({ slain: 2 });
        expect(State.setBestVillageTiers(null)).toBe(false);
        expect(State.setBestVillageTiers('x')).toBe(false);
        expect(State.setBestVillageTiers({ slain: 9, bogus: 5 })).toBe(false);
        expect(State.getBestVillageTiers()).toEqual({ slain: 2 });
    });

    test('it rides in getPersistableState as bestVillageTiers (additive root field, no schema bump)', () => {
        State.setBestVillageTiers({ heroes: 5, habits: 2 });
        const saved = State.getPersistableState({});
        expect(saved.bestVillageTiers).toEqual({ heroes: 5, habits: 2 });
    });

    test('restore: the saved mark is read, then every run in history is merged in (that seeds an older save)', () => {
        const src = read('js/state.js');
        const saved = src.indexOf('setBestVillageTiers(save.bestVillageTiers);');
        const seeded = src.indexOf('Memorial.fromHistory(getRunHistory())');
        expect(saved).toBeGreaterThan(0);
        expect(seeded).toBeGreaterThan(saved);
        // and the history is restored earlier in the same function, so the seed reads the real runs:
        expect(src.indexOf("setRunHistory(Array.isArray(save.runHistory)")).toBeLessThan(saved);
    });

    test('seeding an old save: the best peak per kind over its history', () => {
        const history = [
            { run: 2, peakVillageTiers: { slain: 2, nights: 3 } },
            { run: 1, peakVillageTiers: { slain: 4 } },
        ];
        State.setBestVillageTiers(Memorial.fromHistory(history));
        expect(State.getBestVillageTiers()).toEqual({ slain: 4, nights: 3 });
    });
});

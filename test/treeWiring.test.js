/**
 * Growing tree wiring (2026-11-08): what Jest can verify without loading script.js -- the three PNGs, CSS / CONFIG agreement, the service worker,
 * script order, the night bank (fresh stats, run-end banking, restore seeding) and that script.js hooks the stage up. How it looks on the hill
 * is checked in a browser. Rule: test/treeGrowth.test.js. DOM: test/graveyardView.test.js.
 */
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');
const Achievements = require('../js/achievements.js');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const html = read('index.html');
const sw = read('sw.js');
const css = read('css/graveyard.css');
const canvasCss = read('css/gameCanvas.css');
const script = read('script.js');
const stateSrc = read('js/state.js');
const FILES = [1, 2, 3].map((s) => `Assets/scene/graveyard-tree-${s}.png`);

function png(rel) {
    const b = fs.readFileSync(path.join(root, rel));
    expect(b.slice(1, 4).toString()).toBe('PNG');
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] };
}

describe('the art', () => {
    test.each(FILES)('%s is 192x128 with an alpha channel (CSS draws it 1:1)', (f) => {
        const p = png(f);
        expect({ w: p.w, h: p.h }).toEqual({ w: CONFIG.GRAVEYARD_TREE_ART_W_PX, h: CONFIG.GRAVEYARD_TREE_ART_H_PX });
        expect(CONFIG.GRAVEYARD_TREE_ART_W_PX).toBe(192);
        expect(CONFIG.GRAVEYARD_TREE_ART_H_PX).toBe(128);
        expect([4, 6]).toContain(p.colorType); // grey+alpha or RGBA: the background is transparent
    });

    test.each([1, 2, 3])('stage %i has its own CSS rule pointing at its PNG', (s) => {
        expect(css).toContain(`.graveyard-tree[data-stage="${s}"] { background-image: url("../Assets/scene/graveyard-tree-${s}.png"); }`);
    });

    test('the tree is a pixelated 192x128 block, and the clipper still cuts it at the zone\'s right edge', () => {
        const rule = css.slice(css.indexOf('.graveyard-tree {'), css.indexOf('}', css.indexOf('.graveyard-tree {')));
        expect(rule).toContain('width: 192px');
        expect(rule).toContain('height: 128px');
        expect(rule).toContain('image-rendering: pixelated');
        const clip = css.slice(css.indexOf('.graveyard-tree-clip {'), css.indexOf('}', css.indexOf('.graveyard-tree-clip {')));
        expect(clip).toContain('overflow: hidden'); // #gameCanvas is overflow:visible: an unclipped overhang would widen the page
        expect(clip).toContain('right: 0');
    });

    test('the CSS fallbacks match CONFIG (view and stylesheet cannot drift)', () => {
        const left = CONFIG.GRAVEYARD_TREE_CLIP_LEFT_PX + CONFIG.GRAVEYARD_TREE_BASE_X_PX - CONFIG.GRAVEYARD_TREE_TRUNK_COL;
        expect(css).toContain(`left: ${left}px; /* = clip reach`);
        expect(css).toContain(`left: -${CONFIG.GRAVEYARD_TREE_CLIP_LEFT_PX}px;`);
        expect(css).toContain(`bottom: calc(var(--gy-hill-h) - ${CONFIG.GRAVEYARD_TREE_SINK_PX}px);`);
    });
});

describe('placement is the one Jeremy settled on (2026-11-08)', () => {
    test('trunk column 146 stands 110px into the zone, the roots sink 15px into the hill', () => {
        expect(CONFIG.GRAVEYARD_TREE_TRUNK_COL).toBe(146);
        expect(CONFIG.GRAVEYARD_TREE_BASE_X_PX).toBe(110);
        expect(CONFIG.GRAVEYARD_TREE_SINK_PX).toBe(15);
        expect(CONFIG.GRAVEYARD_TREE_BASE_X_PX).toBeLessThan(CONFIG.GRAVEYARD_HILL_WIDTH_PX);
    });
    test('the trunk is to the right of the Memorial\'s widest base so it shows beside the obelisk', () => {
        const memorialRight = CONFIG.GRAVEYARD_MEMORIAL_CENTER_X_PX + 97 / 2; // T5 is the widest (~97px)
        expect(CONFIG.GRAVEYARD_TREE_BASE_X_PX).toBeGreaterThan(memorialRight);
    });
    test('the Armory sits 44px left of where it was (right 66 -> 22; 46 would overlap the High school by 2px)', () => {
        expect(CONFIG.VILLAGE_PLACEMENT.slain).toEqual({ row: 'back', right: 22 });
    });
});

describe('the stage rule numbers', () => {
    test('young at 30 nights, giant at 100', () => {
        expect(CONFIG.TREE_STAGE_NIGHTS).toEqual([30, 100]);
    });
});

describe('the Nights Survived label keeps a dark backing so branches never hide it', () => {
    test('always on, not only in Fog / Storm', () => {
        const i = canvasCss.indexOf('.nights-label {');
        const rule = canvasCss.slice(i, canvasCss.indexOf('}', i));
        expect(rule).toContain('background: rgba(11, 11, 36, 0.6)');
        expect(rule).toContain('padding: 3px 5px');
    });
});

describe('shell + load order', () => {
    test.each([...FILES, 'js/treeGrowth.js'])('%s is in the service worker APP_SHELL', (f) => {
        expect(sw).toContain(`'${f}'`);
    });
    test('treeGrowth.js exists and loads before script.js', () => {
        expect(fs.existsSync(path.join(root, 'js/treeGrowth.js'))).toBe(true);
        const at = (s) => html.indexOf(`"${s}"`);
        expect(at('js/treeGrowth.js')).toBeGreaterThan(0);
        expect(at('js/treeGrowth.js')).toBeLessThan(at('script.js'));
    });
    test('the cache name was bumped past v285 for this shell change', () => {
        const v = Number((sw.match(/CACHE_NAME = 'deadline-shell-v(\d+)'/) || [])[1]);
        expect(v).toBeGreaterThanOrEqual(286);
    });
    test('the placeholder SVG tree is gone; the tree span lives in the clipper', () => {
        expect(html).not.toContain('class="graveyard-tree" viewBox');
        const i = html.indexOf('class="graveyard-tree-clip"');
        expect(i).toBeGreaterThan(0);
        expect(html.slice(i, html.indexOf('id="graveyardStones"'))).toContain('id="graveyardTree"');
    });
});

describe('the night bank', () => {
    test('a fresh game starts at 0 banked nights', () => {
        expect(Achievements.freshLifetimeStats().nightsSurvived).toBe(0);
    });
    test('game over banks the run\'s nights on top of the best-run mark', () => {
        const i = script.indexOf('recordLifetimeRunEnd: (record, days) =>');
        expect(i).toBeGreaterThan(0);
        const body = script.slice(i, script.indexOf('}),', i));
        expect(body).toContain('stats.bestRunDaysSurvived');
        expect(body).toContain('stats.nightsSurvived = (stats.nightsSurvived || 0) + Math.max(0, days || 0)');
    });
    test('restore seeds the bank from history ONLY when the save has no number, after history is restored', () => {
        const seed = stateSrc.indexOf('TreeGrowth.seedBanked(getRunHistory())');
        expect(seed).toBeGreaterThan(0);
        expect(stateSrc.slice(seed - 220, seed)).toContain("typeof restoredLifetimeStats.nightsSurvived !== 'number'");
        // the history is restored earlier in the same function, so the seed reads the real runs:
        expect(stateSrc.indexOf('setRunHistory(')).toBeLessThan(seed);
        // a saved number is never re-seeded, and the run in progress is not in the seed (it counts live):
        expect(stateSrc.slice(seed - 220, seed + 80)).not.toMatch(/getCurrentRunStats|daysSurvived\b/);
    });
});

describe('script.js hooks', () => {
    test('GraveyardView gets the tree stage', () => {
        const i = script.indexOf('GraveyardView.init({');
        const block = script.slice(i, script.indexOf('});', i));
        expect(block).toContain('getTreeStage: () => treeStageNow()');
    });
    test('the stage is banked + live nights, the live run counting 0 at game over, with the ?treeStage= override', () => {
        const i = script.indexOf('function treeStageNow()');
        expect(i).toBeGreaterThan(0);
        const body = script.slice(i, script.indexOf('\n    }\n', i));
        expect(body).toContain('stats.nightsSurvived');
        expect(body).toContain('NightsSurvivedView.countMidnights(State.getRunStartedAtMs(), Date.now())');
        expect(body).toContain('TreeGrowth.total(stats.nightsSurvived, current, State.isGameOver())');
        expect(body).toContain('TreeGrowth.stage(nights, CONFIG.TREE_STAGE_NIGHTS)');
        expect(body).toContain('TreeGrowth.resolve(window.location.search');
    });
    test('the tree stage is read-only: nothing in it saves, pays or touches DevDemo', () => {
        const i = script.indexOf('function treeStageNow()');
        const body = script.slice(i, script.indexOf('\n    }\n', i));
        expect(body).not.toMatch(/saveGame|DevDemo|setLifetimeStats|applyLifetimeProgress/);
    });
});

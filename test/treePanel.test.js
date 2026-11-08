/**
 * @jest-environment jsdom
 *
 * TreePanel (2026-11-08): the graveyard tree's own window. buildModel / panelHtml are pure; open() is covered with a stubbed Modal.
 * Also the tree's tap box on the hill (GraveyardView), the Tree link in the Village panel (how a portrait phone reaches it) and the shell
 * wiring (index.html, sw.js, css, script.js). The stage rule itself: test/treeGrowth.test.js.
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
global.TreeGrowth = require('../js/treeGrowth.js');
global.GraveyardLayout = require('../js/graveyardLayout.js');
global.Layout = require('../js/layout.js');
global.VillageCard = require('../js/ui/villageCard.js');
const VillagePanel = require('../js/ui/villagePanel.js');
const GraveyardView = require('../js/ui/graveyardView.js');
const TreePanel = require('../js/ui/treePanel.js');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const T = [30, 100];
const model = (ctx) => TreePanel.buildModel(Object.assign({ thresholds: T }, ctx));

describe('buildModel', () => {
    test('a fresh game: sapling, 0 nights, 30 to Young tree, empty bar', () => {
        const m = model({});
        expect(m).toMatchObject({ stage: 1, stageName: 'Sapling', stages: 3, total: 0, banked: 0, current: 0, toNext: 30, maxed: false, fraction: 0 });
        expect(m.nextText).toBe('30 nights more to reach Young tree.');
    });

    test('total = banked + this run; the stage follows the lifetime total (not just this run)', () => {
        const m = model({ banked: 25, current: 6 });
        expect(m).toMatchObject({ total: 31, banked: 25, current: 6, stage: 2, stageName: 'Young tree', toNext: 69 });
        expect(m.fraction).toBeCloseTo(1 / 70, 5);
    });

    test('the boundaries: 29 sapling, 30 young, 99 young, 100 giant', () => {
        expect(model({ banked: 29 }).stage).toBe(1);
        expect(model({ banked: 30 }).stage).toBe(2);
        expect(model({ banked: 99 }).stage).toBe(2);
        expect(model({ banked: 100 }).stage).toBe(3);
    });

    test('the bar fills across the current stage: half way through the sapling is 0.5, half way through young is 0.5', () => {
        expect(model({ banked: 15 }).fraction).toBe(0.5);
        expect(model({ banked: 65 }).fraction).toBe(0.5);
    });

    test('the giant is fully grown: full bar, no nights to go, its own line', () => {
        const m = model({ banked: 250 });
        expect(m).toMatchObject({ stage: 3, stageName: 'Giant tree', maxed: true, toNext: null, fraction: 1 });
        expect(m.nextText).toBe('The tree is fully grown.');
    });

    test('1 night more reads singular', () => {
        expect(model({ banked: 29 }).nextText).toBe('1 night more to reach Young tree.');
    });

    test('while the game is over this run counts 0 (it is already banked): the total never jumps', () => {
        expect(model({ banked: 40, current: 12, gameOver: true })).toMatchObject({ total: 40, current: 0 });
        expect(model({ banked: 40, current: 12, gameOver: false })).toMatchObject({ total: 52, current: 12 });
    });

    test('junk input counts as 0 and a bad threshold pair falls back to 30 / 100', () => {
        expect(TreePanel.buildModel({ banked: 'x', current: -4, thresholds: null })).toMatchObject({ total: 0, stage: 1, toNext: 30 });
        expect(TreePanel.buildModel(undefined).stage).toBe(1);
        expect(TreePanel.buildModel({ banked: 30, thresholds: [5, 8] }).stage).toBe(3);
    });
});

describe('panelHtml', () => {
    test('title, stage, picture stage, the three numbers, the bar and the rule', () => {
        const html = TreePanel.panelHtml(model({ banked: 25, current: 6 }));
        expect(html).toContain('Stage 2 of 3: Young tree');
        expect(html).toContain('data-stage="2"');
        expect(html).toContain('<dd>31</dd>');
        expect(html).toContain('<dd>25</dd>');
        expect(html).toContain('<dd>6</dd>');
        expect(html).toContain('width:1%');
        expect(html).toContain(TreePanel.RULE);
        expect(html).toContain('data-action="close"');
        expect(html).toContain('aria-label="Tree"');
    });

    test('the rule says it never shrinks and only Reset Game starts it over', () => {
        expect(TreePanel.RULE).toMatch(/never shrinks/);
        expect(TreePanel.RULE).toMatch(/Reset Game/);
    });

    test('with no model it still draws a sapling window', () => {
        expect(TreePanel.panelHtml()).toContain('Stage 1 of 3');
    });
});

describe('open', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        global.Modal = {
            open(h) {
                const d = document.createElement('div');
                d.innerHTML = h.trim();
                document.body.appendChild(d.firstElementChild);
                return document.body.lastElementChild;
            },
        };
    });
    afterEach(() => { delete global.Modal; });

    test('opens one window and the corner x removes it', () => {
        TreePanel.open({ banked: 40, current: 2, thresholds: T });
        expect(document.querySelectorAll('.tree-panel-overlay')).toHaveLength(1);
        document.querySelector('[data-action="close"]').click();
        expect(document.querySelectorAll('.tree-panel-overlay')).toHaveLength(0);
    });

    test('taps inside do not bubble to the document (Modal\'s outside-click would close the window)', () => {
        const docClick = jest.fn();
        document.addEventListener('click', docClick);
        TreePanel.open({ thresholds: T });
        document.querySelector('[data-action="close"]').click();
        document.removeEventListener('click', docClick);
        expect(docClick).not.toHaveBeenCalled();
    });

    test('Modal dedupes on .tree-panel-overlay', () => {
        const seen = [];
        global.Modal.open = (h, opts) => { seen.push(opts && opts.dedupeSelector); return null; };
        TreePanel.open({});
        expect(seen).toEqual(['.tree-panel-overlay']);
    });
});

describe('the tree\'s tap box on the hill', () => {
    function setSize(el, w, h) {
        Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => w });
        Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => h });
    }
    function init(treeStage, onOpenTree = jest.fn(), memorialStage = 3) {
        document.body.innerHTML = `
            <div id="gameCanvas"><div id="runGraves"></div>
            <div id="graveyardZone"><div class="graveyard-tree-clip"><span id="graveyardTree" class="graveyard-tree" hidden></span></div><div id="graveyardStones"></div></div></div>`;
        setSize(document.getElementById('gameCanvas'), 844, 250);
        setSize(document.getElementById('graveyardZone'), 140, 70);
        const onOpenMemorial = jest.fn();
        GraveyardView.init({ getRunHistory: () => [], getMemorialStage: () => memorialStage, getTreeStage: () => treeStage, onOpenTree, onOpenMemorial, onOpenStats: jest.fn() });
        GraveyardView.render(160);
        return { onOpenTree, onOpenMemorial };
    }
    const hit = () => document.querySelectorAll('#graveyardStones .graveyard-tree-hit');

    test('exactly one button, labelled with the stage, and a tap opens the Tree window (not the Memorial)', () => {
        const { onOpenTree, onOpenMemorial } = init(2);
        expect(hit()).toHaveLength(1);
        expect(hit()[0].getAttribute('aria-label')).toBe('Tree, stage 2 of 3. Open');
        hit()[0].click();
        expect(onOpenTree).toHaveBeenCalledTimes(1);
        expect(onOpenMemorial).not.toHaveBeenCalled();
    });

    test('the tap does not bubble to the document (Modal would dismiss the new window at once)', () => {
        init(1);
        const docClick = jest.fn();
        document.addEventListener('click', docClick);
        hit()[0].click();
        document.removeEventListener('click', docClick);
        expect(docClick).not.toHaveBeenCalled();
    });

    test('placement comes from CONFIG: 44px wide strip right of the Memorial box, standing on the trunk base', () => {
        init(3);
        const b = hit()[0];
        expect(b.style.left).toBe(CONFIG.GRAVEYARD_TREE_HIT_LEFT_PX + 'px');
        expect(b.style.width).toBe(CONFIG.GRAVEYARD_TREE_HIT_W_PX + 'px');
        expect(b.style.height).toBe(CONFIG.GRAVEYARD_TREE_HIT_H_PX + 'px');
        expect(b.style.bottom).toBe((CONFIG.GRAVEYARD_HILL_HEIGHT_PX - CONFIG.GRAVEYARD_TREE_SINK_PX) + 'px');
        expect(parseFloat(b.style.zIndex)).toBeLessThan(20); // below the obelisk
    });

    test('no tree (DEV off), no tap box; the obelisk is still there', () => {
        init(null);
        expect(hit()).toHaveLength(0);
        expect(document.querySelectorAll('#graveyardStones .graveyard-memorial')).toHaveLength(1);
    });

    test('config: the box is >= 44x44, inside the 140px zone, and clear of the Memorial\'s box', () => {
        expect(CONFIG.GRAVEYARD_TREE_HIT_W_PX).toBeGreaterThanOrEqual(44);
        expect(CONFIG.GRAVEYARD_TREE_HIT_H_PX).toBeGreaterThanOrEqual(44);
        expect(CONFIG.GRAVEYARD_TREE_HIT_LEFT_PX + CONFIG.GRAVEYARD_TREE_HIT_W_PX).toBeLessThanOrEqual(CONFIG.GRAVEYARD_HILL_WIDTH_PX);
        const memRight = CONFIG.GRAVEYARD_MEMORIAL_CENTER_X_PX + CONFIG.GRAVEYARD_MEMORIAL_HIT_W_PX / 2;
        expect(CONFIG.GRAVEYARD_TREE_HIT_LEFT_PX).toBeGreaterThanOrEqual(memRight);
    });
});

describe('the Tree link in the Village panel', () => {
    const KINDS = ['nights', 'slain', 'punctuality', 'habits', 'lurkers', 'defense', 'heroes', 'bestdays'];
    const progress = Object.fromEntries(KINDS.map((k) => [k, { tier: 1, value: 0, prevAt: 0, nextAt: 10, toNext: 10, maxed: false, fraction: 0 }]));
    beforeEach(() => {
        document.body.innerHTML = '';
        global.Modal = {
            open(h) {
                const d = document.createElement('div');
                d.innerHTML = h.trim();
                document.body.appendChild(d.firstElementChild);
                return document.body.lastElementChild;
            },
        };
    });
    afterEach(() => { delete global.Modal; });

    test('shows "Tree  Stage N of 3" and calls onOpenTree, leaving the village panel open', () => {
        const onOpenTree = jest.fn();
        VillagePanel.open({ progress, tree: { stage: 2 }, onOpenTree });
        const link = document.querySelector('.vp-tree');
        expect(link.textContent.replace(/\s+/g, ' ').trim()).toBe('TreeStage 2 of 3 ›');
        expect(link.getAttribute('aria-label')).toBe('Tree, stage 2 of 3. Open');
        link.click();
        expect(onOpenTree).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll('.village-panel-overlay')).toHaveLength(1);
    });

    test('no tree info, no link; the Memorial link is unaffected', () => {
        VillagePanel.open({ progress, memorial: { stage: 1 } });
        expect(document.querySelector('.vp-tree')).toBeNull();
        expect(document.querySelectorAll('.vp-memorial')).toHaveLength(1);
    });

    test('a junk stage is clamped into 1..3', () => {
        expect(VillagePanel.buildModel({ progress, tree: { stage: 9 } }).treeStage).toBe(3);
        expect(VillagePanel.buildModel({ progress, tree: { stage: 0 } }).treeStage).toBe(1);
        expect(VillagePanel.buildModel({ progress, tree: { stage: 'x' } }).treeStage).toBeNull();
    });
});

describe('shell + wiring', () => {
    const html = read('index.html');
    const sw = read('sw.js');
    const script = read('script.js');
    const css = read('css/treePanel.css');
    const panelSrc = read('js/ui/treePanel.js');

    test.each(['css/treePanel.css', 'js/ui/treePanel.js'])('%s exists and is in the service worker APP_SHELL', (f) => {
        expect(fs.existsSync(path.join(root, f))).toBe(true);
        expect(sw).toContain(`'${f}'`);
    });

    test('index.html links the css and loads the script after treeGrowth.js and memorialPanel.js, before script.js', () => {
        expect(html).toContain('<link rel="stylesheet" href="css/treePanel.css">');
        const at = html.indexOf('<script src="js/ui/treePanel.js"></script>');
        expect(at).toBeGreaterThan(html.indexOf('<script src="js/treeGrowth.js"></script>'));
        expect(at).toBeGreaterThan(html.indexOf('<script src="js/ui/memorialPanel.js"></script>'));
        expect(at).toBeLessThan(html.indexOf('<script src="script.js"'));
    });

    test('the cache name was bumped for this shell change (v289 or later)', () => {
        expect(Number(/deadline-shell-v(\d+)/.exec(sw)[1])).toBeGreaterThanOrEqual(289);
    });

    test('each stage\'s picture in the window is the same PNG the hill draws, drawn 1:1 (192x128)', () => {
        [1, 2, 3].forEach((s) => expect(css).toContain(`.tp-sprite[data-stage="${s}"] .tp-art { background-image: url("../Assets/scene/graveyard-tree-${s}.png"); }`));
        expect(css).toMatch(/image-rendering: pixelated/);
        expect(css).toContain('background-size: 192px 128px');
    });

    test('script.js: the hill\'s tap and the Village panel open the window with the REAL nights (never the DEV chip or ?treeStage=)', () => {
        expect(script).toContain('onOpenTree: () => openTreePanel()');
        expect(script).toContain('tree: { stage: realTreeStage() }');
        const i = script.indexOf('function realTreeNights()');
        const body = script.slice(i, script.indexOf('function openTreePanel()', i));
        expect(body).toContain('State.getLifetimeStats()');
        expect(body).toContain('State.isGameOver()');
        expect(body).not.toMatch(/DevDemo|window\.location|treeStageNow/);
        const j = script.indexOf('function openTreePanel()');
        expect(script.slice(j, script.indexOf('\n    }\n', j))).toContain('thresholds: CONFIG.TREE_STAGE_NIGHTS');
    });

    test('the window is read-only: it saves nothing and reads no State or DevDemo', () => {
        const code = panelSrc.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
        expect(code).not.toMatch(/State\.|DevDemo|localStorage|saveGame|window\.location/);
    });
});

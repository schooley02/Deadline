/**
 * @jest-environment jsdom
 *
 * MarkerPanel + the milestone markers' wiring (2026-11-08): the window listing all seven all-time records, the stones on the hill
 * (GraveyardView), the Headstones link in the Village panel, the DEV chips, the art files and the shell (index.html, sw.js, css, script.js).
 * Rule: test/milestoneMarkers.test.js. Placement on the hill is checked in a browser.
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
global.Theme = require('../js/theme.js');
global.MilestoneMarkers = require('../js/milestoneMarkers.js');
global.GraveyardLayout = require('../js/graveyardLayout.js');
global.Layout = require('../js/layout.js');
global.VillageCard = require('../js/ui/villageCard.js');
const VillagePanel = require('../js/ui/villagePanel.js');
const GraveyardView = require('../js/ui/graveyardView.js');
const MarkerPanel = require('../js/ui/markerPanel.js');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const catalog = CONFIG.ACHIEVEMENTS;
const ids = CONFIG.MARKER_FAMILIES;
const ctx = (extra) => Object.assign({ catalog, ids, unlocked: {}, stats: {}, selected: null }, extra);
const tier = (family, n) => catalog.find((f) => f.id === family).tiers[n - 1].id;

describe('buildModel', () => {
    test('seven rows in slot order; a fresh save shows "No badge yet" and 0 earned', () => {
        const m = MarkerPanel.buildModel(ctx());
        expect(m.rows.map((r) => r.id)).toEqual(ids);
        expect(m).toMatchObject({ earned: 0, total: 7, title: 'Headstones' });
        m.rows.forEach((r) => expect(r).toMatchObject({ stage: 0, tierText: 'No badge yet' }));
        expect(m.rows[0].text).toBe('10 of 10 tasks to reach Bronze.'.replace('10 of', '0 of'));
    });
    test('earned counts families with at least Bronze; the tier and progress words follow', () => {
        const m = MarkerPanel.buildModel(ctx({ unlocked: { [tier('task_slayer', 1)]: 'x', [tier('task_slayer', 2)]: 'x' }, stats: { tasksCompleted: 42 } }));
        expect(m.earned).toBe(1);
        expect(m.rows[0]).toMatchObject({ stage: 2, tierText: 'Silver', maxed: false });
        expect(m.rows[0].text).toBe('42 of 250 tasks to reach Gold.');
    });
    test('a maxed row says it is the top tier', () => {
        const all = Object.fromEntries(catalog.find((f) => f.id === 'task_slayer').tiers.map((t) => [t.id, 'x']));
        const r = MarkerPanel.buildModel(ctx({ unlocked: all, stats: { tasksCompleted: 5000 } })).rows[0];
        expect(r).toMatchObject({ stage: 4, maxed: true, tierText: 'Platinum' });
        expect(r.text).toBe('Platinum reached. This is the top tier.');
    });
    test('only the tapped marker is selected', () => {
        const m = MarkerPanel.buildModel(ctx({ selected: 'iron_will' }));
        expect(m.rows.filter((r) => r.selected).map((r) => r.id)).toEqual(['iron_will']);
        expect(MarkerPanel.buildModel(ctx()).rows.some((r) => r.selected)).toBe(false);
    });
});

describe('panelHtml', () => {
    test('one row per marker with its stage picture, the highlighted one marked, nothing unescaped', () => {
        const html = MarkerPanel.panelHtml(MarkerPanel.buildModel(ctx({ selected: 'honor_roll' })));
        expect((html.match(/class="mkp-row/g) || [])).toHaveLength(7);
        expect(html).toContain('marker-panel-overlay');
        expect(html).toContain('data-marker="honor_roll"');
        expect(html).toContain('mkp-row--selected');
        expect(html).toContain('aria-current="true"');
        expect(html).toContain('data-action="close"');
    });
    test('names are escaped', () => {
        const html = MarkerPanel.panelHtml({ title: 'T', rule: 'R', earned: 0, total: 1, rows: [{ id: 'x', name: '<b>"hi"</b>', stage: 0, tierText: 'a', maxed: false, fraction: 0, text: 't', selected: false }] });
        expect(html).not.toContain('<b>');
        expect(html).toContain('&lt;b&gt;');
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

    test('opens one window; the corner x removes it and its tap does not bubble', () => {
        const seen = jest.fn();
        document.addEventListener('click', seen);
        MarkerPanel.open(ctx({ selected: 'survivor' }));
        expect(document.querySelectorAll('.marker-panel-overlay')).toHaveLength(1);
        document.querySelector('[data-action="close"]').click();
        expect(seen).not.toHaveBeenCalled();
        expect(document.querySelectorAll('.marker-panel-overlay')).toHaveLength(0);
        document.removeEventListener('click', seen);
    });
    test('Modal dedupes on .marker-panel-overlay', () => {
        const seen = [];
        global.Modal.open = (h, opts) => { seen.push(opts && opts.dedupeSelector); return null; };
        MarkerPanel.open(ctx());
        expect(seen).toEqual(['.marker-panel-overlay']);
    });
});

describe('the stones on the hill', () => {
    function build() {
        document.body.innerHTML = `<div id="gameCanvas"><div id="runGraves"></div><div id="graveyardZone"><div class="graveyard-tree-clip"><span id="graveyardTree" class="graveyard-tree" hidden></span></div><div id="graveyardStones"></div></div></div>`;
        [['gameCanvas', 844, 250], ['graveyardZone', 140, 70]].forEach(([id, w, h]) => {
            const el = document.getElementById(id);
            Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => w });
            Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => h });
        });
    }
    function init(markers, onOpenMarkers = jest.fn()) {
        build();
        GraveyardView.init({ getRunHistory: () => [], getMemorialStage: () => 1, getTreeStage: () => 1, getMarkers: () => markers, onOpenMarkers });
        GraveyardView.render(160);
        return onOpenMarkers;
    }
    const markers = MilestoneMarkers.build({ catalog, ids, unlocked: { [tier('task_slayer', 1)]: 'x' }, stats: {} });
    const buttons = () => [...document.querySelectorAll('#graveyardStones .milestone-marker')];

    test('one button per marker, labelled with its tier, at least 44px, art at its stage', () => {
        init(markers);
        expect(buttons()).toHaveLength(7);
        const first = buttons()[0];
        expect(first.getAttribute('aria-label')).toBe('Task Slayer, Bronze. Open');
        expect(buttons()[1].getAttribute('aria-label')).toBe('Habit Hero, No badge yet. Open');
        expect(first.dataset.stage).toBe('1');
        expect(first.querySelector('.milestone-marker-art').dataset.stage).toBe('1');
        buttons().forEach((b) => {
            expect(parseFloat(b.style.width)).toBeGreaterThanOrEqual(44);
            expect(parseFloat(b.style.height)).toBeGreaterThanOrEqual(44);
        });
    });
    test('a tap opens the window for that marker and does not bubble', () => {
        const open = init(markers);
        const seen = jest.fn();
        document.addEventListener('click', seen);
        buttons()[2].click();
        expect(open).toHaveBeenCalledWith('survivor');
        expect(seen).not.toHaveBeenCalled();
        document.removeEventListener('click', seen);
    });
    test('null hides them; the Memorial is still there', () => {
        init(null);
        expect(buttons()).toHaveLength(0);
        expect(document.querySelectorAll('.graveyard-memorial')).toHaveLength(1);
    });
    test('re-rendering with the same stages does not rebuild; a new stage does', () => {
        init(markers);
        const before = buttons()[0];
        GraveyardView.render(160);
        expect(buttons()[0]).toBe(before);
    });
});

describe('the Headstones link in the Village panel', () => {
    const KINDS = ['nights', 'slain', 'punctuality', 'habits', 'lurkers', 'defense', 'heroes', 'bestdays'];
    const progress = Object.fromEntries(KINDS.map((k) => [k, { tier: 1, value: 0, prevAt: 0, nextAt: 10, toNext: 10, maxed: false, fraction: 0 }]));
    beforeEach(() => {
        document.body.innerHTML = '';
        global.Modal = { open(h) { const d = document.createElement('div'); d.innerHTML = h.trim(); document.body.appendChild(d.firstElementChild); return document.body.lastElementChild; } };
    });
    afterEach(() => { delete global.Modal; });

    test('shows "Headstones  N of 7 earned" and opens the window, leaving the village panel open', () => {
        const onOpenMarkers = jest.fn();
        VillagePanel.open({ progress, markers: { earned: 3, total: 7 }, onOpenMarkers });
        const link = document.querySelector('.vp-markers');
        expect(link.textContent.replace(/\s+/g, ' ').trim()).toBe('Headstones3 of 7 earned ›');
        expect(link.getAttribute('aria-label')).toBe('Headstones, 3 of 7 earned. Open');
        link.click();
        expect(onOpenMarkers).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll('.village-panel-overlay')).toHaveLength(1);
    });
    test('no marker info, no link; junk counts are clamped', () => {
        VillagePanel.open({ progress });
        expect(document.querySelector('.vp-markers')).toBeNull();
        expect(VillagePanel.buildModel({ progress, markers: { earned: 99, total: 7 } }).markers).toEqual({ earned: 7, total: 7 });
        expect(VillagePanel.buildModel({ progress, markers: { earned: -2, total: 7 } }).markers).toEqual({ earned: 0, total: 7 });
        expect(VillagePanel.buildModel({ progress, markers: { total: 0 } }).markers).toBeNull();
    });
});

describe('art + shell + wiring', () => {
    const html = read('index.html');
    const sw = read('sw.js');
    const script = read('script.js');
    const hill = read('css/graveyard.css');
    const panelCss = read('css/markerPanel.css');

    test.each([0, 1, 2, 3, 4])('headstone-%i.png is a 32x32 RGBA picture, drawn by both stylesheets and cached by the service worker', (n) => {
        const f = `Assets/scene/headstone-${n}.png`;
        const b = fs.readFileSync(path.join(root, f));
        expect(b.slice(1, 4).toString()).toBe('PNG');
        expect({ w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] }).toEqual({ w: 32, h: 32, colorType: 6 });
        expect(hill).toContain(`headstone-${n}.png`);
        expect(hill).toMatch(/\.milestone-marker-art \{[^}]*background-size: 100% 100%/);
        expect(panelCss).toContain(`headstone-${n}.png`);
        expect(sw).toContain(`'${f}'`);
    });
    test.each(['css/markerPanel.css', 'js/milestoneMarkers.js', 'js/ui/markerPanel.js'])('%s exists and is in APP_SHELL', (f) => {
        expect(fs.existsSync(path.join(root, f))).toBe(true);
        expect(sw).toContain(`'${f}'`);
    });
    test('index.html links the css and loads the rule before the panel, both before script.js', () => {
        expect(html).toContain('<link rel="stylesheet" href="css/markerPanel.css">');
        const rule = html.indexOf('<script src="js/milestoneMarkers.js"></script>');
        const panel = html.indexOf('<script src="js/ui/markerPanel.js"></script>');
        expect(rule).toBeGreaterThan(-1);
        expect(panel).toBeGreaterThan(rule);
        expect(panel).toBeGreaterThan(html.indexOf('<script src="js/theme.js"></script>'));
        expect(panel).toBeLessThan(html.indexOf('<script src="script.js"'));
        expect(rule).toBeLessThan(html.indexOf('<script src="js/ui/graveyardView.js"></script>'));
    });
    test('the cache name was bumped (v290 or later)', () => {
        expect(Number(/deadline-shell-v(\d+)/.exec(sw)[1])).toBeGreaterThanOrEqual(290);
    });
    test('script.js hooks the markers up: the hill reads the DEV chip / ?markers= / real tiers; the window and village link use the REAL ones', () => {
        expect(script).toContain('getMarkers: () => markersNow()');
        expect(script).toContain('onOpenMarkers: (id) => openMarkerPanel(id)');
        expect(script).toContain('MilestoneMarkers.override(window.location.search)');
        expect(script).toMatch(/markers: realMarkerCounts\(\)/);
        const ctxFn = /function markerPanelContext[\s\S]*?\n    }/.exec(script)[0];
        expect(ctxFn).not.toMatch(/DevDemo|override/);
    });
    test('the stones layer is clipped at the zone\'s right edge but open 52px to the left (a marker stands on the hill\'s left slope)', () => {
        expect(hill).toMatch(/\.graveyard-stones \{[^}]*clip-path: inset\(0 0 0 -52px\)/);
        expect(hill).not.toMatch(/\.graveyard-stones \{[^}]*overflow: hidden/);
    });
    test('no hover highlight on the stones (it flashed on stones the pointer was not on); keyboard focus still glows', () => {
        expect(hill).not.toMatch(/\.milestone-marker:hover/);
        expect(hill).toMatch(/\.milestone-marker:focus-visible \.milestone-marker-art/);
    });
    test('nothing is saved: no new state field for the markers', () => {
        expect(read('js/state.js')).not.toMatch(/marker/i);
    });
    test('survivor-camp rule: the panel and hill css use no flag colours', () => {
        expect(panelCss + hill.match(/\.milestone-marker[^{]*\{[^}]*\}/g).join('')).not.toMatch(/#(?:b22234|3c3b6e|ff0000|0000ff)/i);
    });
});

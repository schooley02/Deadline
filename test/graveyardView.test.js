/**
 * @jest-environment jsdom
 *
 * GraveyardView (V7 W0, 2026-10-28): the DOM half. jsdom has no layout, so the zone/canvas
 * sizes are stubbed with defineProperty. Placement maths is covered in graveyardLayout.test.js.
 */
global.CONFIG = require('../js/config.js');
global.GraveyardLayout = require('../js/graveyardLayout.js');
global.Layout = require('../js/layout.js');
const GraveyardView = require('../js/ui/graveyardView.js');

function setSize(el, w, h) {
    Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => w });
    Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => h });
}

function build({ zoneW = 140, canvasW = 844, canvasH = 250 } = {}) {
    document.body.innerHTML = `
        <div id="gameCanvas">
            <div id="runGraves"></div>
            <div id="graveyardZone"><div id="graveyardStones"></div></div>
        </div>`;
    setSize(document.getElementById('gameCanvas'), canvasW, canvasH);
    setSize(document.getElementById('graveyardZone'), zoneW, 70);
}

const FAMILIES = CONFIG.ACHIEVEMENTS.map(a => ({ id: a.id, name: a.name }));
const history = n => Array.from({ length: n }, (_, i) => ({ run: n - i }));

function init(opts = {}, hist = history(5)) {
    build(opts);
    const onOpenStats = jest.fn();
    GraveyardView.init({ getRunHistory: () => hist, getAchievementFamilies: () => FAMILIES, onOpenStats });
    GraveyardView.render(160);
    return onOpenStats;
}

test('one headstone button per achievement family, labelled, in three lanes', () => {
    init();
    const stones = document.querySelectorAll('#graveyardStones .graveyard-stone');
    expect(stones).toHaveLength(6);
    expect(stones[0].getAttribute('aria-label')).toBe('Survivor achievements');
    expect(new Set([...stones].map(s => s.dataset.lane)).size).toBe(3);
});

test('zoneWidth reports the measured width (0 when hidden)', () => {
    init();
    expect(GraveyardView.zoneWidth()).toBe(140);
    setSize(document.getElementById('graveyardZone'), 0, 0);
    expect(GraveyardView.zoneWidth()).toBe(0);
});

test('one grave button per past run, newest first, each tagged with its run number', () => {
    init({}, history(5));
    const graves = [...document.querySelectorAll('#runGraves .run-grave')];
    expect(graves).toHaveLength(5);
    expect(graves[0].dataset.run).toBe('5');
    expect(graves[0].getAttribute('aria-label')).toMatch(/Run 5 grave/);
});

test('each grave z-index sits just under its lane\'s zombie slice', () => {
    init({}, history(20));
    document.querySelectorAll('#runGraves .run-grave').forEach(b => {
        const lane = Number(b.dataset.lane);
        expect(Number(b.style.zIndex)).toBe(CONFIG.LIST_Z_MIN + lane * CONFIG.LIST_Z_LANE_STRIDE - 1);
    });
});

test('tapping a headstone or a grave opens Stats and does not bubble to the document', () => {
    const onOpenStats = init();
    const docClick = jest.fn();
    document.addEventListener('click', docClick);
    document.querySelector('.graveyard-stone').click();
    document.querySelector('.run-grave').click();
    document.removeEventListener('click', docClick);
    expect(onOpenStats).toHaveBeenCalledTimes(2);
    expect(docClick).not.toHaveBeenCalled(); // Modal's document click would close the window at once
});

test('portrait strip (zone hidden): nothing is placed', () => {
    init({ zoneW: 0 });
    expect(document.querySelectorAll('.graveyard-stone')).toHaveLength(0);
    expect(document.querySelectorAll('.run-grave')).toHaveLength(0);
});

test('render is idempotent: an unchanged layout does not rebuild the DOM', () => {
    init();
    const first = document.querySelector('.graveyard-stone');
    GraveyardView.render(160);
    expect(document.querySelector('.graveyard-stone')).toBe(first);
});

test('a new run in history is picked up on the next render', () => {
    const hist = history(3);
    build();
    GraveyardView.init({ getRunHistory: () => hist, getAchievementFamilies: () => FAMILIES, onOpenStats: () => {} });
    GraveyardView.render(160);
    expect(document.querySelectorAll('.run-grave')).toHaveLength(3);
    hist.unshift({ run: 4 });
    GraveyardView.render(160);
    expect(document.querySelectorAll('.run-grave')).toHaveLength(4);
});

test('init without the DOM is a safe no-op', () => {
    document.body.innerHTML = '';
    expect(() => { GraveyardView.init({}); GraveyardView.render(0); }).not.toThrow();
    expect(GraveyardView.zoneWidth()).toBe(0);
});

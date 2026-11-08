/**
 * @jest-environment jsdom
 *
 * GraveyardView (V7 W0, 2026-10-28): the DOM half. jsdom has no layout, so the zone/canvas
 * sizes are stubbed with defineProperty. Run-grave placement maths is covered in graveyardLayout.test.js.
 * 2026-11-08: the six placeholder headstones became ONE Memorial obelisk (stage from getMemorialStage).
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

const history = n => Array.from({ length: n }, (_, i) => ({ run: n - i }));

function init(opts = {}, hist = history(5), stage = 3) {
    build(opts);
    const onOpenStats = jest.fn();
    const onOpenMemorial = jest.fn();
    GraveyardView.init({ getRunHistory: () => hist, getMemorialStage: () => stage, onOpenStats, onOpenMemorial });
    GraveyardView.render(160);
    onOpenStats.memorial = onOpenMemorial; // the Memorial's own window (2026-11-08); run graves still open Stats
    return onOpenStats;
}

describe('the Memorial obelisk', () => {
    const memorial = () => document.querySelectorAll('#graveyardStones .graveyard-memorial');

    test('exactly one button, labelled with its stage, drawing that stage\'s art', () => {
        init({}, history(5), 3);
        expect(memorial()).toHaveLength(1);
        const b = memorial()[0];
        expect(b.getAttribute('aria-label')).toBe('Memorial, stage 3 of 5. Open');
        expect(b.dataset.stage).toBe('3');
        expect(b.querySelector('.graveyard-memorial-art').dataset.stage).toBe('3');
        expect(document.querySelectorAll('.graveyard-stone')).toHaveLength(0); // the six placeholder stones are gone
    });

    test('placement comes from CONFIG: feet 86 up, centre column 92 in, art 128x192 overhanging the tap box', () => {
        init();
        const b = memorial()[0];
        const art = b.querySelector('.graveyard-memorial-art');
        const hitW = CONFIG.GRAVEYARD_MEMORIAL_HIT_W_PX;
        expect(b.style.bottom).toBe(CONFIG.GRAVEYARD_MEMORIAL_FEET_PX + 'px');
        expect(parseFloat(b.style.left) + hitW / 2).toBe(CONFIG.GRAVEYARD_MEMORIAL_CENTER_X_PX); // box centred on the obelisk
        expect(b.style.width).toBe(hitW + 'px');
        expect(b.style.height).toBe(CONFIG.GRAVEYARD_MEMORIAL_HIT_H_PX + 'px');
        expect(art.style.width).toBe('128px');
        expect(art.style.height).toBe('192px');
        // the art's centre column lands on the box's centre, and its transparent bottom rows hang below the plinth:
        expect(parseFloat(art.style.left) + 128 / 2).toBe(hitW / 2);
        expect(art.style.bottom).toBe('-10px'); // 192 - 1 - plinth row 181
    });

    test('the sprite\'s plinth ends up 86px above the canvas bottom and its centre 92px into the zone', () => {
        init();
        const b = memorial()[0];
        const art = b.querySelector('.graveyard-memorial-art');
        const artBottomFromCanvas = parseFloat(b.style.bottom) + parseFloat(art.style.bottom);
        const plinthLowerEdge = artBottomFromCanvas + (192 - 1 - CONFIG.GRAVEYARD_MEMORIAL_PLINTH_ROW);
        expect(plinthLowerEdge).toBe(86);
        expect(parseFloat(b.style.left) + parseFloat(art.style.left) + 128 / 2).toBe(92);
    });

    test('the tap box is at least 44x44 and sits in front of the tree', () => {
        init();
        const b = memorial()[0];
        expect(parseFloat(b.style.width)).toBeGreaterThanOrEqual(44);
        expect(parseFloat(b.style.height)).toBeGreaterThanOrEqual(44);
        expect(Number(b.style.zIndex)).toBeGreaterThan(1); // .graveyard-tree-clip is z 1 in the same stacking context
    });

    test.each([1, 2, 3, 4, 5])('stage %i is drawn', (s) => {
        init({}, history(2), s);
        expect(memorial()[0].dataset.stage).toBe(String(s));
    });

    test.each([null, 0, 6, 'x'])('stage %p draws no obelisk (dev off / unknown)', (s) => {
        init({}, history(2), s);
        expect(memorial()).toHaveLength(0);
    });

    test('no getMemorialStage dep draws no obelisk', () => {
        build();
        GraveyardView.init({ getRunHistory: () => history(2), onOpenStats: () => {} });
        GraveyardView.render(160);
        expect(memorial()).toHaveLength(0);
    });

    test('a stage change on the next render redraws it', () => {
        let stage = 1;
        build();
        GraveyardView.init({ getRunHistory: () => history(2), getMemorialStage: () => stage, onOpenStats: () => {} });
        GraveyardView.render(160);
        expect(memorial()[0].dataset.stage).toBe('1');
        stage = 2;
        GraveyardView.render(160);
        expect(memorial()[0].dataset.stage).toBe('2');
    });

    test('tapping it opens the Memorial window (not Stats), once, and does not bubble to the document', () => {
        const onOpenStats = init();
        const docClick = jest.fn();
        document.addEventListener('click', docClick);
        memorial()[0].click();
        document.removeEventListener('click', docClick);
        expect(onOpenStats.memorial).toHaveBeenCalledTimes(1);
        expect(onOpenStats).not.toHaveBeenCalled();
        expect(docClick).not.toHaveBeenCalled();
    });
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

test('tapping a grave opens Stats and does not bubble to the document', () => {
    const onOpenStats = init();
    const docClick = jest.fn();
    document.addEventListener('click', docClick);
    document.querySelector('.run-grave').click();
    document.removeEventListener('click', docClick);
    expect(onOpenStats).toHaveBeenCalledTimes(1);
    expect(docClick).not.toHaveBeenCalled(); // Modal's document click would close the window at once
});

test('portrait strip (zone hidden): nothing is placed', () => {
    init({ zoneW: 0 });
    expect(document.querySelectorAll('.graveyard-memorial')).toHaveLength(0);
    expect(document.querySelectorAll('.run-grave')).toHaveLength(0);
});

test('render is idempotent: an unchanged layout does not rebuild the DOM', () => {
    init();
    const first = document.querySelector('.graveyard-memorial');
    GraveyardView.render(160);
    expect(document.querySelector('.graveyard-memorial')).toBe(first);
});

test('a new run in history is picked up on the next render', () => {
    const hist = history(3);
    build();
    GraveyardView.init({ getRunHistory: () => hist, getMemorialStage: () => 1, onOpenStats: () => {} });
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

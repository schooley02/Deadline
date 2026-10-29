/**
 * @jest-environment jsdom
 *
 * VillageView (V7 W2 first slice, 2026-10-29): the DOM half. jsdom has no layout, so the canvas
 * size is stubbed with defineProperty. Placement maths is covered in villageLayout.test.js.
 */
global.CONFIG = require('../js/config.js');
global.VillageLayout = require('../js/villageLayout.js');
const VillageView = require('../js/ui/villageView.js');

function setSize(el, w, h) {
    Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => w });
    Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => h });
}

function build({ canvasW = 844, canvasH = 334 } = {}) {
    document.body.innerHTML = '<div id="gameCanvas"><div id="villageLayer"></div></div>';
    setSize(document.getElementById('gameCanvas'), canvasW, canvasH);
}

function init({ hill = 140, tier = 3, ...size } = {}) {
    build(size);
    const state = { hill, tier };
    VillageView.init({ getHillWidth: () => state.hill, getClockTier: () => state.tier });
    VillageView.render(160);
    return state;
}

const sprite = () => document.querySelector('#villageLayer .village-sprite');

afterEach(() => { global.CONFIG.VILLAGE_ENABLED = true; });

test('places one Clock tower sprite at the layout slot', () => {
    init();
    const imgs = document.querySelectorAll('#villageLayer .village-sprite');
    expect(imgs).toHaveLength(1);
    const want = VillageLayout.clockTowerSlot(844, 334, 160, 140, 3, VillageLayout.fromConfig(CONFIG));
    expect(imgs[0].getAttribute('src')).toBe('Assets/Village/punctuality_t3.png');
    expect(imgs[0].style.left).toBe(want.left + 'px');
    expect(imgs[0].style.top).toBe(want.top + 'px');
    expect(imgs[0].style.width).toBe('128px');
    expect(imgs[0].style.height).toBe('224px');
    expect(imgs[0].dataset.kind).toBe('punctuality');
    expect(imgs[0].dataset.tier).toBe('3');
});

test('the sprite is decorative: empty alt, not draggable, no click handler needed', () => {
    init();
    expect(sprite().getAttribute('alt')).toBe('');
    expect(sprite().draggable).toBe(false);
});

test('portrait strip (hill width 0): nothing is placed', () => {
    init({ hill: 0 });
    expect(document.querySelectorAll('.village-sprite')).toHaveLength(0);
});

test('no tier: nothing is placed', () => {
    init({ tier: null });
    expect(document.querySelectorAll('.village-sprite')).toHaveLength(0);
});

test('CONFIG.VILLAGE_ENABLED = false hides the layer', () => {
    init();
    expect(sprite()).not.toBeNull();
    global.CONFIG.VILLAGE_ENABLED = false;
    VillageView.render(161);
    expect(document.querySelectorAll('.village-sprite')).toHaveLength(0);
});

test('render is idempotent: an unchanged layout does not rebuild the DOM', () => {
    init();
    const first = sprite();
    VillageView.render(160);
    expect(sprite()).toBe(first);
});

test('a tier change swaps the image on the same element', () => {
    const state = init({ tier: 1 });
    const first = sprite();
    expect(first.getAttribute('src')).toBe('Assets/Village/punctuality_t1.png');
    state.tier = 5;
    VillageView.render(160);
    expect(sprite()).toBe(first);
    expect(first.getAttribute('src')).toBe('Assets/Village/punctuality_t5.png');
    expect(first.dataset.tier).toBe('5');
});

test('a resize moves the sprite', () => {
    init();
    const before = sprite().style.left;
    setSize(document.getElementById('gameCanvas'), 1265, 298);
    VillageView.render(160);
    expect(sprite().style.left).not.toBe(before);
});

test('going to the portrait strip and back re-places the sprite', () => {
    const state = init();
    state.hill = 0;
    VillageView.render(160);
    expect(sprite()).toBeNull();
    state.hill = 140;
    VillageView.render(160);
    expect(sprite()).not.toBeNull();
});

test('init without the DOM is a safe no-op', () => {
    document.body.innerHTML = '';
    expect(() => { VillageView.init({}); VillageView.render(0); }).not.toThrow();
});

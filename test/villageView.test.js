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
    expect(imgs[0].style.width).toBe(want.width + 'px'); // 128 wide, drawn 1:1 (the 1.3x stretch stopgap is gone)
    expect(imgs[0].style.height).toBe(want.height + 'px');
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

// ---- Jailhouse (kind `lurkers`), added 2026-10-29 ----
function initBoth({ hill = 140, clock = 3, jail = 3, ...size } = {}) {
    build(size);
    const state = { hill, clock, jail };
    VillageView.init({
        getHillWidth: () => state.hill,
        getClockTier: () => state.clock,
        getJailTier: () => state.jail,
    });
    VillageView.render(160);
    return state;
}
const byKind = k => document.querySelector(`#villageLayer .village-sprite[data-kind="${k}"]`);

test('draws the Jailhouse next to the Clock tower, each at its own layout slot', () => {
    initBoth();
    expect(document.querySelectorAll('#villageLayer .village-sprite')).toHaveLength(2);
    const want = VillageLayout.villageSlots(844, 334, 160, 140, { punctuality: 3, lurkers: 3 }, VillageLayout.fromConfig(CONFIG));
    want.forEach(slot => {
        const img = byKind(slot.kind);
        expect(img.getAttribute('src')).toBe(slot.url);
        expect(img.style.left).toBe(slot.left + 'px');
        expect(img.style.top).toBe(slot.top + 'px');
        expect(img.style.width).toBe(slot.width + 'px');
        expect(img.style.height).toBe(slot.height + 'px');
    });
    expect(byKind('lurkers').getAttribute('src')).toBe('Assets/Village/lurkers_t3.png');
    expect(byKind('lurkers').style.height).toBe('128px');
});

test('the jail is decorative like the tower and has its own class', () => {
    initBoth();
    expect(byKind('lurkers').classList.contains('village-lurkers')).toBe(true);
    expect(byKind('lurkers').getAttribute('alt')).toBe('');
    expect(byKind('lurkers').draggable).toBe(false);
});

test('a jail tier change swaps the image on the same element and leaves the tower alone', () => {
    const state = initBoth({ jail: 1 });
    const jail = byKind('lurkers');
    const tower = byKind('punctuality');
    state.jail = 5;
    VillageView.render(160);
    expect(byKind('lurkers')).toBe(jail);
    expect(jail.getAttribute('src')).toBe('Assets/Village/lurkers_t5.png');
    expect(byKind('punctuality')).toBe(tower);
    expect(tower.getAttribute('src')).toBe('Assets/Village/punctuality_t3.png');
});

test('no jail tier: only the tower; no clock tier: only the jail', () => {
    initBoth({ jail: null });
    expect(byKind('lurkers')).toBeNull();
    expect(byKind('punctuality')).not.toBeNull();
    initBoth({ clock: null });
    expect(byKind('punctuality')).toBeNull();
    expect(byKind('lurkers')).not.toBeNull();
});

test('a tier going away removes only that building', () => {
    const state = initBoth();
    state.jail = null;
    VillageView.render(160);
    expect(byKind('lurkers')).toBeNull();
    expect(byKind('punctuality')).not.toBeNull();
});

test('a window too narrow for both drops the jail, keeps the tower; widening brings it back', () => {
    const state = initBoth({ canvasW: 640 });
    expect(byKind('lurkers')).toBeNull();
    expect(byKind('punctuality')).not.toBeNull();
    setSize(document.getElementById('gameCanvas'), 844, 334);
    VillageView.render(160);
    expect(byKind('lurkers')).not.toBeNull();
    expect(state.jail).toBe(3);
});

test('portrait strip and VILLAGE_ENABLED=false hide both', () => {
    const state = initBoth();
    state.hill = 0;
    VillageView.render(160);
    expect(document.querySelectorAll('.village-sprite')).toHaveLength(0);
    state.hill = 140;
    VillageView.render(160);
    expect(document.querySelectorAll('.village-sprite')).toHaveLength(2);
    global.CONFIG.VILLAGE_ENABLED = false;
    VillageView.render(161);
    expect(document.querySelectorAll('.village-sprite')).toHaveLength(0);
});

test('a view that only supplies getClockTier (the first-slice deps) still works, no jail', () => {
    init();
    expect(document.querySelectorAll('#villageLayer .village-sprite')).toHaveLength(1);
    expect(byKind('lurkers')).toBeNull();
});

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
    const want = VillageLayout.villageSlots(844, 334, 160, 140, { punctuality: 3 }, VillageLayout.fromConfig(CONFIG))[0];
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

// ---- Jailhouse (kind `defense`, was `lurkers`), added 2026-10-29 ----
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
    const want = VillageLayout.villageSlots(844, 334, 160, 140, { punctuality: 3, defense: 3 }, VillageLayout.fromConfig(CONFIG));
    want.forEach(slot => {
        const img = byKind(slot.kind);
        expect(img.getAttribute('src')).toBe(slot.url);
        expect(img.style.left).toBe(slot.left + 'px');
        expect(img.style.top).toBe(slot.top + 'px');
        expect(img.style.width).toBe(slot.width + 'px');
        expect(img.style.height).toBe(slot.height + 'px');
    });
    expect(byKind('defense').getAttribute('src')).toBe('Assets/Village/defense_t3.png');
    expect(byKind('defense').style.height).toBe('128px');
});

test('the jail is decorative like the tower and has its own class', () => {
    initBoth();
    expect(byKind('defense').classList.contains('village-defense')).toBe(true);
    expect(byKind('defense').getAttribute('alt')).toBe('');
    expect(byKind('defense').draggable).toBe(false);
});

test('a jail tier change swaps the image on the same element and leaves the tower alone', () => {
    const state = initBoth({ jail: 1 });
    const jail = byKind('defense');
    const tower = byKind('punctuality');
    state.jail = 5;
    VillageView.render(160);
    expect(byKind('defense')).toBe(jail);
    expect(jail.getAttribute('src')).toBe('Assets/Village/defense_t5.png');
    expect(byKind('punctuality')).toBe(tower);
    expect(tower.getAttribute('src')).toBe('Assets/Village/punctuality_t3.png');
});

test('no jail tier: only the tower; no clock tier: only the jail', () => {
    initBoth({ jail: null });
    expect(byKind('defense')).toBeNull();
    expect(byKind('punctuality')).not.toBeNull();
    initBoth({ clock: null });
    expect(byKind('punctuality')).toBeNull();
    expect(byKind('defense')).not.toBeNull();
});

test('a tier going away removes only that building', () => {
    const state = initBoth();
    state.jail = null;
    VillageView.render(160);
    expect(byKind('defense')).toBeNull();
    expect(byKind('punctuality')).not.toBeNull();
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
    expect(byKind('defense')).toBeNull();
});

// ---- Armory (kind `slain`), added 2026-10-29 ----
test('draws the Armory right of the tower at its layout slot, and swaps tiers in place', () => {
    build({});
    const state = { armory: 3 };
    VillageView.init({
        getHillWidth: () => 140,
        getClockTier: () => 3,
        getJailTier: () => 3,
        getArmoryTier: () => state.armory,
    });
    VillageView.render(160);
    const q = k => document.querySelector(`#villageLayer .village-sprite[data-kind="${k}"]`);
    expect(document.querySelectorAll('#villageLayer .village-sprite')).toHaveLength(3);
    const want = VillageLayout.villageSlots(844, 334, 160, 140, { punctuality: 3, defense: 3, slain: 3 }, VillageLayout.fromConfig(CONFIG))
        .find(s => s.kind === 'slain');
    const img = q('slain');
    expect(img.getAttribute('src')).toBe('Assets/Village/slain_t3.png');
    expect(img.classList.contains('village-slain')).toBe(true);
    expect(img.style.left).toBe(want.left + 'px');
    expect(img.style.top).toBe(want.top + 'px');
    state.armory = 5;
    VillageView.render(160);
    expect(q('slain')).toBe(img);
    expect(img.getAttribute('src')).toBe('Assets/Village/slain_t5.png');
    state.armory = null;
    VillageView.render(160);
    expect(q('slain')).toBeNull();
    expect(q('punctuality')).not.toBeNull();
});

// ---- Radio tower (kind `nights`, back row), added 2026-10-29 ----
describe('Radio tower (back row)', () => {
    const q = k => document.querySelector(`#villageLayer .village-sprite[data-kind="${k}"]`);
    function initAll(over = {}) {
        build({});
        const state = { radio: 3, ...over };
        VillageView.init({
            getHillWidth: () => 140,
            getClockTier: () => 3,
            getJailTier: () => 3,
            getArmoryTier: () => 3,
            getRadioTier: () => state.radio,
        });
        VillageView.render(160);
        return state;
    }

    test('a radio that appears AFTER the others still paints behind them (z-index, not DOM order)', () => {
        const state = initAll({ radio: null });
        expect(q('nights')).toBeNull();
        state.radio = 2;
        VillageView.render(160);
        expect(q('nights')).not.toBeNull();
        expect(Number(q('nights').style.zIndex)).toBeLessThan(Number(q('punctuality').style.zIndex));
        expect(Number(q('nights').style.zIndex)).toBeLessThan(Number(q('defense').style.zIndex));
    });

    test('a tier change swaps the image on the same element; clearing the tier removes only the radio', () => {
        const state = initAll({ radio: 1 });
        const img = q('nights');
        state.radio = 5;
        VillageView.render(160);
        expect(q('nights')).toBe(img);
        expect(img.getAttribute('src')).toBe('Assets/Village/nights_t5.png');
        state.radio = null;
        VillageView.render(160);
        expect(q('nights')).toBeNull();
        expect(q('punctuality')).not.toBeNull();
        expect(q('defense')).not.toBeNull();
    });

    test('a view that does not supply getRadioTier (the older deps) still works, no radio', () => {
        build({});
        VillageView.init({ getHillWidth: () => 140, getClockTier: () => 3, getJailTier: () => 3, getArmoryTier: () => 3 });
        VillageView.render(160);
        expect(q('nights')).toBeNull();
        expect(document.querySelectorAll('#villageLayer .village-sprite')).toHaveLength(3);
    });
});

// ---- Boxing gym (kind `lurkers`, front row), added 2026-10-30 ----
describe('Boxing gym (front row)', () => {
    const q = k => document.querySelector(`#villageLayer .village-sprite[data-kind="${k}"]`);
    const ALL = { punctuality: 3, defense: 3, slain: 3, nights: 3, lurkers: 3 };
    function initAll(over = {}, size = {}) {
        build(size);
        const state = { gym: 3, ...over };
        VillageView.init({
            getHillWidth: () => 140,
            getClockTier: () => 3,
            getJailTier: () => 3,
            getArmoryTier: () => 3,
            getRadioTier: () => 3,
            getGymTier: () => state.gym,
        });
        VillageView.render(160);
        return state;
    }

    test('draws the gym at its layout slot: front row (no back class, no filter), 128x128', () => {
        initAll();
        const want = VillageLayout.villageSlots(844, 334, 160, 140, ALL, VillageLayout.fromConfig(CONFIG)).find(s => s.kind === 'lurkers');
        const img = q('lurkers');
        expect(img.getAttribute('src')).toBe('Assets/Village/lurkers_t3.png');
        expect(img.classList.contains('village-lurkers')).toBe(true);
        expect(img.classList.contains('village-back')).toBe(false);
        expect(img.style.filter).toBe('');
        expect(img.style.left).toBe(want.left + 'px');
        expect(img.style.top).toBe(want.top + 'px');
        expect(img.style.width).toBe('128px');
        expect(img.style.height).toBe('128px');
        expect(img.getAttribute('alt')).toBe('');
        expect(img.draggable).toBe(false);
    });

    test('a tier change swaps the image on the same element; clearing the tier removes only the gym', () => {
        const state = initAll({ gym: 1 });
        const img = q('lurkers');
        state.gym = 5;
        VillageView.render(160);
        expect(q('lurkers')).toBe(img);
        expect(img.getAttribute('src')).toBe('Assets/Village/lurkers_t5.png');
        state.gym = null;
        VillageView.render(160);
        expect(q('lurkers')).toBeNull();
        ['punctuality', 'defense', 'slain', 'nights'].forEach(k => expect(q(k)).not.toBeNull());
    });

    test('a view that does not supply getGymTier (the older deps) still works, no gym', () => {
        build({});
        VillageView.init({ getHillWidth: () => 140, getClockTier: () => 3, getJailTier: () => 3, getArmoryTier: () => 3, getRadioTier: () => 3 });
        VillageView.render(160);
        expect(q('lurkers')).toBeNull();
        expect(document.querySelectorAll('#villageLayer .village-sprite')).toHaveLength(4);
    });
});

// ---- High school (kind `heroes`, back row), added 2026-10-30 ----
describe('High school (back row)', () => {
    const q = k => document.querySelector(`#villageLayer .village-sprite[data-kind="${k}"]`);
    const ALL = { punctuality: 3, defense: 3, slain: 3, nights: 3, lurkers: 3, heroes: 3 };
    function initAll(over = {}, size = {}) {
        build(size);
        const state = { school: 3, ...over };
        VillageView.init({
            getHillWidth: () => 140,
            getClockTier: () => 3,
            getJailTier: () => 3,
            getArmoryTier: () => 3,
            getRadioTier: () => 3,
            getGymTier: () => 3,
            getSchoolTier: () => state.school,
        });
        VillageView.render(160);
        return state;
    }

    test('draws the school at its layout slot as a back-row building (class + brightness filter)', () => {
        initAll();
        const want = VillageLayout.villageSlots(844, 334, 160, 140, ALL, VillageLayout.fromConfig(CONFIG)).find(s => s.kind === 'heroes');
        const img = q('heroes');
        expect(img.getAttribute('src')).toBe('Assets/Village/heroes_t3.png');
        expect(img.classList.contains('village-back')).toBe(true);
        expect(img.style.filter).toBe('brightness(' + CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS + ')');
        expect(img.style.left).toBe(want.left + 'px');
        expect(img.style.top).toBe(want.top + 'px');
    });

    test('all six buildings at 844 wide; the school paints under every front building', () => {
        initAll();
        expect(document.querySelectorAll('#villageLayer .village-sprite')).toHaveLength(6);
        const z = k => Number(q(k).style.zIndex);
        ['defense', 'lurkers', 'slain', 'punctuality'].forEach(k => expect(z('heroes')).toBeLessThan(z(k)));
    });

});

// ---- Hospital (kind `habits`, back row), added 2026-10-30 ----
describe('Hospital (back row)', () => {
    const q = k => document.querySelector(`#villageLayer .village-sprite[data-kind="${k}"]`);
    const ALL = { punctuality: 3, defense: 3, slain: 3, nights: 3, lurkers: 3, heroes: 3, habits: 3 };
    function initAll(over = {}, size = {}) {
        build(size);
        const state = { hospital: 3, ...over };
        VillageView.init({
            getHillWidth: () => 140,
            getClockTier: () => 3,
            getJailTier: () => 3,
            getArmoryTier: () => 3,
            getRadioTier: () => 3,
            getGymTier: () => 3,
            getSchoolTier: () => 3,
            getHospitalTier: () => state.hospital,
        });
        VillageView.render(160);
        return state;
    }

    test('draws the hospital at its layout slot as a back-row building (class + brightness filter)', () => {
        initAll();
        const want = VillageLayout.villageSlots(844, 334, 160, 140, ALL, VillageLayout.fromConfig(CONFIG)).find(s => s.kind === 'habits');
        const img = q('habits');
        expect(img.getAttribute('src')).toBe('Assets/Village/habits_t3.png');
        expect(img.classList.contains('village-back')).toBe(true);
        expect(img.style.filter).toBe('brightness(' + CONFIG.VILLAGE_BACK_ROW_BRIGHTNESS + ')');
        expect(img.style.left).toBe(want.left + 'px');
        expect(img.style.top).toBe(want.top + 'px');
    });

    test('all seven buildings at 844 wide; the hospital paints under every front building', () => {
        initAll();
        expect(document.querySelectorAll('#villageLayer .village-sprite')).toHaveLength(7);
        const z = k => Number(q(k).style.zIndex);
        ['defense', 'lurkers', 'slain', 'punctuality'].forEach(k => expect(z('habits')).toBeLessThan(z(k)));
    });

});

// ---- Windmill (kind `bestdays`, FAR row, placeholder art), added 2026-10-30 ----
describe('Windmill (far row)', () => {
    const q = k => document.querySelector(`#villageLayer .village-sprite[data-kind="${k}"]`);
    const ALL = { punctuality: 3, defense: 3, slain: 3, nights: 3, lurkers: 3, heroes: 3, habits: 3, bestdays: 3 };
    function initAll(over = {}, size = {}) {
        build(size);
        const state = { mill: 3, ...over };
        VillageView.init({
            getHillWidth: () => 140,
            getClockTier: () => 3,
            getJailTier: () => 3,
            getArmoryTier: () => 3,
            getRadioTier: () => 3,
            getGymTier: () => 3,
            getSchoolTier: () => 3,
            getHospitalTier: () => 3,
            getWindmillTier: () => state.mill,
        });
        VillageView.render(160);
        return state;
    }

    test('draws the windmill at its layout slot, darker than the back row (class + far-row brightness filter)', () => {
        initAll();
        const want = VillageLayout.villageSlots(844, 334, 160, 140, ALL, VillageLayout.fromConfig(CONFIG)).find(s => s.kind === 'bestdays');
        const img = q('bestdays');
        expect(img.getAttribute('src')).toBe('Assets/Village/bestdays_t3.png');
        expect(img.classList.contains('village-back')).toBe(true);
        expect(img.style.filter).toBe('brightness(' + CONFIG.VILLAGE_FAR_ROW_BRIGHTNESS + ')');
        expect(img.style.left).toBe(want.left + 'px');
        expect(img.style.top).toBe(want.top + 'px');
    });

    test('all eight buildings at 844 wide; the windmill paints under every other building', () => {
        initAll();
        expect(document.querySelectorAll('#villageLayer .village-sprite')).toHaveLength(8);
        const z = k => Number(q(k).style.zIndex);
        ['nights', 'heroes', 'habits', 'defense', 'lurkers', 'slain', 'punctuality'].forEach(k => expect(z('bestdays')).toBeLessThan(z(k)));
    });

    test('a tier change swaps the image; clearing it removes only the windmill', () => {
        const state = initAll({ mill: 1 });
        const img = q('bestdays');
        state.mill = 5;
        VillageView.render(160);
        expect(q('bestdays')).toBe(img);
        expect(img.getAttribute('src')).toBe('Assets/Village/bestdays_t5.png');
        state.mill = null;
        VillageView.render(160);
        expect(q('bestdays')).toBeNull();
        expect(document.querySelectorAll('#villageLayer .village-sprite')).toHaveLength(7);
    });
});

describe('tappable buildings (Build 2, 2026-10-30)', () => {
    test('pickHit returns the topmost candidate that is actually hit, else null', () => {
        const stack = [{ id: 'front' }, { id: 'mid' }, { id: 'back' }];
        expect(VillageView.pickHit(stack, () => true).id).toBe('front');
        expect(VillageView.pickHit(stack, c => c.id !== 'front').id).toBe('mid');   // transparent corner of the front sprite
        expect(VillageView.pickHit(stack, c => c.id === 'back').id).toBe('back');   // back-row building tucked behind
        expect(VillageView.pickHit(stack, () => false)).toBeNull();
        expect(VillageView.pickHit([], () => true)).toBeNull();
        expect(VillageView.pickHit(null, () => true)).toBeNull();
    });

    test('inArtBox uses the visible-art columns, scaled with the sprite', () => {
        const rect = { left: 100, top: 50, right: 228, bottom: 178, width: 128, height: 128 };
        const art = [20, 113];
        expect(VillageView.inArtBox(rect, 128, art, 130, 100)).toBe(true);   // x 30 in canvas px
        expect(VillageView.inArtBox(rect, 128, art, 105, 100)).toBe(false);  // x 5: transparent left margin
        expect(VillageView.inArtBox(rect, 128, art, 225, 100)).toBe(false);  // x 125: transparent right margin
        expect(VillageView.inArtBox(rect, 128, art, 130, 20)).toBe(false);   // above the sprite
        expect(VillageView.inArtBox(rect, 128, null, 105, 100)).toBe(true);  // no art entry = whole canvas
        const scaled = { left: 0, top: 0, right: 256, bottom: 256, width: 256, height: 256 }; // 2x
        expect(VillageView.inArtBox(scaled, 128, art, 30, 100)).toBe(false); // canvas x 15 < 20
        expect(VillageView.inArtBox(scaled, 128, art, 50, 100)).toBe(true);  // canvas x 25
        expect(VillageView.inArtBox({ width: 0, height: 0 }, 128, art, 0, 0)).toBe(false);
    });

    test('a tap on a sprite calls onOpenBuilding with its kind/tier/url and stops propagation', () => {
        build();
        const opened = [];
        VillageView.init({ getHillWidth: () => 140, getClockTier: () => 3, onOpenBuilding: h => opened.push(h) });
        VillageView.render(160);
        const img = sprite();
        // jsdom: no layout, no canvas pixels, no elementsFromPoint -> stub the three it needs
        img.getBoundingClientRect = () => ({ left: 0, top: 0, right: 128, bottom: 128, width: 128, height: 128 });
        Object.defineProperty(img, 'naturalWidth', { configurable: true, get: () => 128 });
        Object.defineProperty(img, 'naturalHeight', { configurable: true, get: () => 128 });
        document.elementsFromPoint = () => [img];
        window.HTMLCanvasElement.prototype.getContext = () => null; // no canvas in jsdom -> exercises the art-box fallback
        let bubbled = false;
        document.body.addEventListener('click', () => { bubbled = true; });
        // inside the clock tower's art columns (CONFIG.VILLAGE_ART_X.punctuality = [20, 113])
        img.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 60, clientY: 60 }));
        expect(opened).toHaveLength(1);
        expect(opened[0]).toMatchObject({ kind: 'punctuality', tier: 3, url: 'Assets/Village/punctuality_t3.png', width: 128, height: 128 });
        expect(bubbled).toBe(false);
        // a tap in the transparent margin opens nothing and is not swallowed
        img.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 4, clientY: 60 }));
        expect(opened).toHaveLength(1);
        expect(bubbled).toBe(true);
        delete document.elementsFromPoint;
    });
});


describe('arrangement (2026-10-30 night): flips + forgiving taps', () => {
    const ALL8 = { punctuality: 3, defense: 3, slain: 3, nights: 3, lurkers: 3, heroes: 3, habits: 3, bestdays: 3 };

    test('mirrored buildings get scaleX(-1) and data-flip; the others do not', () => {
        build({ canvasW: 817, canvasH: 296 });
        VillageView.init({
            getHillWidth: () => 140,
            getClockTier: () => 3, getJailTier: () => 3, getArmoryTier: () => 3, getRadioTier: () => 3,
            getGymTier: () => 3, getSchoolTier: () => 3, getHospitalTier: () => 3, getWindmillTier: () => 3,
        });
        VillageView.render(160);
        const el = k => document.querySelector('.village-' + k);
        Object.keys(ALL8).forEach((k) => {
            const flipped = !!CONFIG.VILLAGE_PLACEMENT[k].flip;
            expect(el(k).dataset.flip).toBe(flipped ? '1' : '0');
            expect(el(k).style.transform).toBe(flipped ? 'scaleX(-1)' : '');
        });
        // z-index follows paint order: far row first, front row last
        const z = k => Number(el(k).style.zIndex);
        expect(z('bestdays')).toBeLessThan(z('habits'));
        expect(z('habits')).toBeLessThan(z('lurkers'));
    });

    test('opaqueNear: a tap within the slop of an opaque pixel counts, farther away does not', () => {
        const w = 10, h = 10, data = new Uint8ClampedArray(w * h * 4);
        data[(5 * w + 5) * 4 + 3] = 255; // one opaque pixel at (5,5)
        expect(VillageView.opaqueNear(data, w, h, 5, 5, 0, 16)).toBe(true);
        expect(VillageView.opaqueNear(data, w, h, 8, 5, 3, 16)).toBe(true);
        expect(VillageView.opaqueNear(data, w, h, 9, 5, 3, 16)).toBe(false);
        expect(VillageView.opaqueNear(data, w, h, 8, 8, 3, 16)).toBe(true);
        expect(VillageView.opaqueNear(data, w, h, 0, 0, 3, 16)).toBe(false);
        expect(VillageView.opaqueNear(data, w, h, 9, 9, 50, 16)).toBe(true); // clamped to the image
    });

    test('inArtBox mirrors the art columns for a flipped sprite', () => {
        const rect = { left: 0, top: 0, right: 128, bottom: 128, width: 128, height: 128 };
        const art = [20, 113]; // mirrored -> [15, 108]
        expect(VillageView.inArtBox(rect, 128, art, 17, 50, false)).toBe(false);
        expect(VillageView.inArtBox(rect, 128, art, 17, 50, true)).toBe(true);
        expect(VillageView.inArtBox(rect, 128, art, 111, 50, false)).toBe(true);
        expect(VillageView.inArtBox(rect, 128, art, 111, 50, true)).toBe(false);
    });
});

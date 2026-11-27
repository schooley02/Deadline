/**
 * @jest-environment jsdom
 *
 * Road into town (2026-11-26, Jeremy: option C, a level road behind the church and the graveyard, through the pad; a stop sign left, a traffic light
 * right). Pure placement (VillageLayout.roadRect), the DOM half (villageView.js syncRoad), and the shell (CSS, the PNGs, service worker).
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
global.VillageLayout = require('../js/villageLayout.js');
const VillageView = require('../js/ui/villageView.js');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const pngSize = (rel) => { const b = fs.readFileSync(path.join(root, rel)); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
const OPTS = VillageLayout.fromConfig(CONFIG);
const KINDS = ['punctuality', 'defense', 'slain', 'nights', 'lurkers', 'heroes', 'habits', 'bestdays', 'goals'];
const ALL = Object.fromEntries(KINDS.map(k => [k, 3]));
const slots = (w, h, base, t = ALL) => VillageLayout.villageSlots(w, h, base, 120, t, OPTS);
const R = VillageLayout.ROAD;

describe('roadRect', () => {
    test('laptop and desktop: a strip 66 px above the front feet, 36 px tall, tiled every 640 px', () => {
        [[1366, 480, 368], [1920, 640, 368], [1280, 560, 368], [1100, 560, 300]].forEach(([w, h, base]) => {
            const r = VillageLayout.roadRect(slots(w, h, base), base);
            const feet = VillageLayout.horizonFeetY(h, OPTS);
            expect(r.url).toBe('Assets/scene/village-road.png');
            expect(r.top).toBe(feet - 66);
            expect(r.height).toBe(36);
            expect(r.tileWidth).toBe(640);
        });
    });

    test('the road lies inside the pad\'s depth (it runs through the pad, never above or below it)', () => {
        const s = slots(1366, 480, 368);
        const r = VillageLayout.roadRect(s, 368);
        const pad = VillageLayout.padRect(s);
        expect(r.top).toBeGreaterThan(pad.top);
        expect(r.top + r.height).toBeLessThan(pad.top + pad.height);
    });

    test('the stop sign stands 19 px left of the Gym, the traffic light 19 px right of the right-most front building; same foot line', () => {
        [[1366, 480, 368], [1920, 640, 368]].forEach(([w, h, base]) => {
            const s = slots(w, h, base);
            const r = VillageLayout.roadRect(s, base);
            const feet = VillageLayout.horizonFeetY(h, OPTS);
            const gym = s.find(x => x.kind === 'lurkers');
            const right = Math.max(...s.filter(x => x.row === 'front').map(x => x.artRight));
            const [stop, light] = r.signs;
            expect(stop.key).toBe('stop');
            expect(light.key).toBe('light');
            expect(stop.left + R.stop.width).toBe(gym.artLeft - 19);
            expect(light.left + R.light.margin).toBe(right + 19); // the PNG has a 4 px margin for the lamp glow
            expect(stop.top + R.stop.foot).toBe(feet - 36);
            expect(light.top + R.light.foot).toBe(feet - 36);
            expect(stop.url).toBe('Assets/scene/village-stop-sign.png');
            expect(light.url).toBe('Assets/scene/village-traffic-light.png');
        });
    });

    test('phones and squeezed screens get no road (no open ground between the church and the Gym)', () => {
        [[800, 306, 188], [844, 390, 188], [667, 306, 188], [1024, 560, 300]].forEach(([w, h, base]) => {
            expect(VillageLayout.roadRect(slots(w, h, base), base)).toBeNull();
        });
    });

    test('when shown, both signs are on screen and clear of the church at every width', () => {
        for (let w = 1030; w <= 2200; w += 10) {
            const base = w >= 1280 ? 368 : 300;
            const r = VillageLayout.roadRect(slots(w, 560, base), base);
            if (!r) continue;
            expect(r.signs[0].left).toBeGreaterThanOrEqual(base);
            expect(r.signs[1].left + r.signs[1].width).toBeLessThanOrEqual(w);
        }
    });

    test('no Gym slot (or no slots) means no road', () => {
        expect(VillageLayout.roadRect([], 368)).toBeNull();
        expect(VillageLayout.roadRect(null, 368)).toBeNull();
        expect(VillageLayout.roadRect(slots(1366, 480, 368, { punctuality: 3 }), 368)).toBeNull();
    });
});

describe('villageView draws the road', () => {
    let tiers;
    const size = (w, h) => {
        const el = document.getElementById('gameCanvas');
        Object.defineProperty(el, 'offsetWidth', { value: w, configurable: true });
        Object.defineProperty(el, 'offsetHeight', { value: h, configurable: true });
    };
    const dep = (k) => () => tiers[k];
    const layer = () => document.getElementById('villageLayer');
    beforeEach(() => {
        document.body.innerHTML = '<div id="gameCanvas"><div id="villageLayer"></div></div>';
        size(1366, 480);
        tiers = Object.assign({}, ALL);
        VillageView.init({
            getHillWidth: () => 120,
            getClockTier: dep('punctuality'), getJailTier: dep('defense'), getArmoryTier: dep('slain'), getRadioTier: dep('nights'), getGymTier: dep('lurkers'),
            getSchoolTier: dep('heroes'), getHospitalTier: dep('habits'), getWaterTowerTier: dep('bestdays'), getLabTier: dep('goals'),
        });
    });

    test('one road strip and two signs, placed by roadRect, none of them a tappable sprite', () => {
        VillageView.render(368);
        const r = VillageLayout.roadRect(slots(1366, 480, 368), 368);
        const road = layer().querySelectorAll('.village-road');
        expect(road).toHaveLength(1);
        expect(road[0].tagName).toBe('DIV');
        expect(road[0].style.top).toBe(r.top + 'px');
        expect(road[0].style.height).toBe('36px');
        expect(road[0].style.backgroundImage).toContain('Assets/scene/village-road.png');
        expect(road[0].style.backgroundSize).toBe('640px 36px');
        const signs = Array.from(layer().querySelectorAll('.village-sign'));
        expect(signs.map(s => s.dataset.sign).sort()).toEqual(['light', 'stop']);
        r.signs.forEach((s) => {
            const el = signs.find(x => x.dataset.sign === s.key);
            expect(el.getAttribute('src')).toBe(s.url);
            expect(el.style.left).toBe(s.left + 'px');
            expect(el.style.top).toBe(s.top + 'px');
            expect(el.getAttribute('alt')).toBe('');
        });
        expect(layer().querySelectorAll('.village-road.village-sprite, .village-sign.village-sprite')).toHaveLength(0);
    });

    test('the pad stays first in the layer; the signs come before every building and take the first front-row z-index', () => {
        VillageView.render(368);
        const kids = Array.from(layer().children);
        expect(kids[0].classList.contains('village-pad')).toBe(true);
        const firstSprite = kids.findIndex(k => k.classList.contains('village-sprite'));
        const lastSign = Math.max(...kids.map((k, i) => (k.classList.contains('village-sign') ? i : -1)));
        expect(lastSign).toBeLessThan(firstSprite);
        const z = slots(1366, 480, 368).findIndex(s => s.row === 'front');
        layer().querySelectorAll('.village-sign').forEach(el => expect(el.style.zIndex).toBe(String(z)));
    });

    test('re-rendering keeps one road and one of each sign; a phone-sized screen removes them; coming back restores them', () => {
        VillageView.render(368);
        VillageView.render(368);
        tiers.lurkers = 4;
        VillageView.render(368);
        expect(layer().querySelectorAll('.village-road')).toHaveLength(1);
        expect(layer().querySelectorAll('.village-sign')).toHaveLength(2);
        size(800, 306);
        VillageView.render(188);
        expect(layer().querySelector('.village-road')).toBeNull();
        expect(layer().querySelectorAll('.village-sign')).toHaveLength(0);
        size(1366, 480);
        VillageView.render(368);
        expect(layer().querySelectorAll('.village-road')).toHaveLength(1);
        expect(layer().querySelectorAll('.village-sign')).toHaveLength(2);
    });
});

describe('shell', () => {
    test('CSS: the road sits under the pad and spans the layer; road and signs are never tapped', () => {
        const css = read('css/village.css');
        const road = css.slice(css.indexOf('.village-road {'), css.indexOf('}', css.indexOf('.village-road {')));
        const pad = css.slice(css.indexOf('.village-pad {'), css.indexOf('}', css.indexOf('.village-pad {')));
        const sign = css.slice(css.indexOf('.village-sign {'), css.indexOf('}', css.indexOf('.village-sign {')));
        const z = (rule) => Number(/z-index:\s*(-?\d+)/.exec(rule)[1]);
        expect(z(road)).toBeLessThan(z(pad));
        expect(road).toMatch(/left:\s*0/);
        expect(road).toMatch(/right:\s*0/);
        expect(road).toMatch(/repeat-x/);
        [road, sign].forEach((rule) => {
            expect(rule).toMatch(/pointer-events:\s*none/);
            expect(rule).toMatch(/image-rendering:\s*pixelated/);
        });
    });

    test('art sizes: the strip is 320x18 (shown 640x36); the sign PNGs match ROAD', () => {
        expect(pngSize('Assets/scene/village-road.png')).toEqual({ w: R.tileWidth / 2, h: R.height / 2 });
        expect(pngSize('Assets/scene/village-stop-sign.png')).toEqual({ w: R.stop.width, h: R.stop.height });
        expect(pngSize('Assets/scene/village-traffic-light.png')).toEqual({ w: R.light.width, h: R.light.height });
        expect(pngSize('Assets/scene/village-pad.png')).toEqual({ w: VillageLayout.PAD.width / 2, h: VillageLayout.PAD.height / 2 });
    });

    test('service worker caches the road and both signs', () => {
        const sw = read('sw.js');
        ['village-road', 'village-stop-sign', 'village-traffic-light'].forEach(f => expect(sw).toContain(`'Assets/scene/${f}.png'`));
    });
});

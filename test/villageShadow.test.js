/**
 * @jest-environment jsdom
 *
 * Contact shadows under the village buildings (2026-11-26, Jeremy: "the moon is on the right so the shadows should fall to the left"). Pure placement
 * (VillageLayout.shadowRect), the DOM half (villageView.js syncShadows), and the shell (CSS, the 45 PNGs, service worker).
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
const slots = (w, h, t = ALL) => VillageLayout.villageSlots(w, h, 368, 120, t, OPTS);
const S = VillageLayout.SHADOW;

describe('shadowRect', () => {
    test('hangs from the sprite\'s bottom edge and reaches left of it (the shadow falls left)', () => {
        [[1366, 480], [1920, 640], [800, 306], [667, 306]].forEach(([w, h]) => {
            slots(w, h).forEach((s) => {
                const r = VillageLayout.shadowRect(s);
                expect(r.url).toBe(`Assets/Village/shadows/${s.kind}_t${s.tier}.png`);
                expect(r.left).toBe(s.left - S.padLeft);
                expect(r.left + r.width).toBe(s.left + s.width);
                expect(r.top + r.height).toBe(s.top + s.height + S.below);
                expect(r.height).toBe(S.height);
                expect(r.flip).toBe(false);
            });
        });
    });

    test('the rear rows\' shadows are fainter', () => {
        const by = Object.fromEntries(slots(1366, 480).map(s => [s.row, VillageLayout.shadowRect(s).opacity]));
        expect(by.front).toBe(1);
        expect(by.back).toBeLessThan(by.front);
        expect(by.far).toBeLessThan(by.back);
    });

    test('a mirrored building keeps its shadow under its base', () => {
        const s = Object.assign({}, slots(1366, 480)[0], { flip: true });
        const r = VillageLayout.shadowRect(s);
        expect(r.flip).toBe(true);
        expect(r.left).toBe(s.left);
        expect(r.width).toBe(s.width + S.padLeft);
    });

    test('no slot means no shadow', () => {
        expect(VillageLayout.shadowRect(null)).toBeNull();
        expect(VillageLayout.shadowRect({})).toBeNull();
    });
});

describe('villageView draws the shadows', () => {
    let canvas, layer, tiers;
    const size = (el, w, h) => {
        Object.defineProperty(el, 'offsetWidth', { value: w, configurable: true });
        Object.defineProperty(el, 'offsetHeight', { value: h, configurable: true });
    };
    const dep = (k) => () => tiers[k];
    beforeEach(() => {
        document.body.innerHTML = '<div id="gameCanvas"><div id="villageLayer"></div></div>';
        canvas = document.getElementById('gameCanvas');
        layer = document.getElementById('villageLayer');
        size(canvas, 1366, 480);
        tiers = Object.assign({}, ALL);
        VillageView.init({
            getHillWidth: () => 120,
            getClockTier: dep('punctuality'), getJailTier: dep('defense'), getArmoryTier: dep('slain'), getRadioTier: dep('nights'), getGymTier: dep('lurkers'),
            getSchoolTier: dep('heroes'), getHospitalTier: dep('habits'), getWaterTowerTier: dep('bestdays'), getLabTier: dep('goals'),
        });
    });

    test('one shadow per building, placed by shadowRect, at the z-index of the first building in its row', () => {
        VillageView.render(368);
        const sl = slots(1366, 480);
        const shadows = Array.from(layer.querySelectorAll('.village-shadow'));
        expect(shadows.length).toBe(sl.length);
        const rowFirst = {};
        sl.forEach((s, i) => { if (rowFirst[s.row] == null) rowFirst[s.row] = i; });
        sl.forEach((s) => {
            const el = shadows.find(x => x.dataset.kind === s.kind);
            const r = VillageLayout.shadowRect(s);
            expect(el.getAttribute('src')).toBe(r.url);
            expect(el.style.left).toBe(r.left + 'px');
            expect(el.style.top).toBe(r.top + 'px');
            expect(el.style.width).toBe(r.width + 'px');
            expect(el.style.zIndex).toBe(String(rowFirst[s.row]));
            expect(el.style.opacity).toBe(String(r.opacity));
            const sprite = layer.querySelector('.village-sprite.village-' + s.kind);
            expect(Number(el.style.zIndex)).toBeLessThanOrEqual(Number(sprite.style.zIndex)); // never above its own building
        });
    });

    test('every shadow comes before every sprite in the layer (so at an equal z-index it paints under the sprite), and is never a sprite', () => {
        VillageView.render(368);
        const kids = Array.from(layer.children);
        const lastShadow = Math.max(...kids.map((k, i) => (k.classList.contains('village-shadow') ? i : -1)));
        const firstSprite = kids.findIndex(k => k.classList.contains('village-sprite'));
        expect(lastShadow).toBeLessThan(firstSprite);
        expect(layer.querySelectorAll('.village-shadow.village-sprite').length).toBe(0);
        expect(kids[0].classList.contains('village-pad')).toBe(true);
    });

    test('a new star swaps the shadow file; a building that goes away takes its shadow with it; no duplicates on re-render', () => {
        VillageView.render(368);
        tiers.lurkers = 5;
        VillageView.render(368);
        expect(layer.querySelector('.village-shadow[data-kind="lurkers"]').getAttribute('src')).toBe('Assets/Village/shadows/lurkers_t5.png');
        expect(layer.querySelectorAll('.village-shadow[data-kind="lurkers"]').length).toBe(1);
        tiers.goals = null;
        VillageView.render(368);
        expect(layer.querySelector('.village-shadow[data-kind="goals"]')).toBeNull();
        expect(layer.querySelectorAll('.village-shadow').length).toBe(layer.querySelectorAll('.village-sprite').length);
    });
});

describe('shell', () => {
    test('CSS: a shadow is never tapped and is drawn pixelated', () => {
        const css = read('css/village.css');
        const rule = css.slice(css.indexOf('.village-shadow {'));
        expect(rule).toMatch(/pointer-events:\s*none/);
        expect(rule).toMatch(/image-rendering:\s*pixelated/);
        expect(rule).toMatch(/position:\s*absolute/);
    });

    test('all 45 shadow PNGs exist at (sprite width + padLeft) x height', () => {
        KINDS.forEach((k) => {
            for (let t = 1; t <= 5; t++) {
                const sprite = pngSize(`Assets/Village/${k}_t${t}.png`);
                const sh = pngSize(`Assets/Village/shadows/${k}_t${t}.png`);
                expect(sh).toEqual({ w: sprite.w + S.padLeft, h: S.height });
            }
        });
    });

    test('service worker caches every shadow', () => {
        const sw = read('sw.js');
        KINDS.forEach((k) => { for (let t = 1; t <= 5; t++) expect(sw).toContain(`'Assets/Village/shadows/${k}_t${t}.png'`); });
    });
});

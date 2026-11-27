/**
 * @jest-environment jsdom
 *
 * Village ground (2026-11-27): the worn-asphalt pad under the whole village and the new option-B grass strip. Pure placement (VillageLayout.padRect),
 * the DOM half (villageView.js syncPad), and the shell (CSS, asset sizes, service worker).
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
const ALL = { punctuality: 3, defense: 3, slain: 3, nights: 3, lurkers: 3, heroes: 3, habits: 3, bestdays: 3, goals: 3 };
const slots = (w, h, t = ALL) => VillageLayout.villageSlots(w, h, 368, 120, t, OPTS);

describe('padRect', () => {
    test('anchored to the Gym\'s left art edge and the front row\'s feet, 672x92 (348x46 art at 2x)', () => {
        [[1366, 480], [1920, 640], [844, 334]].forEach(([w, h]) => {
            const s = slots(w, h);
            const gym = s.find(x => x.kind === 'lurkers');
            const r = VillageLayout.padRect(s);
            const feet = VillageLayout.horizonFeetY(h, OPTS);
            expect(r.left).toBe(gym.artLeft - 21);
            expect(r.top).toBe(feet - 88);
            expect(r.top + r.height).toBe(feet + 4);
            expect(r.width).toBe(696);
            expect(r.url).toBe('Assets/scene/village-pad.png');
        });
    });

    test('follows the village when the screen gets wider (the cluster re-centres)', () => {
        const a = VillageLayout.padRect(slots(1366, 480));
        const b = VillageLayout.padRect(slots(1920, 480));
        expect(b.left).toBeGreaterThan(a.left);
    });

    test('every building stands inside the pad, with room to spare, at every width (the Lab was overhanging its right end)', () => {
        for (let w = 560; w <= 2200; w += 20) {
            const h = w < 900 ? 306 : 480;
            [[160, 140], [368, 120]].forEach(([base, hill]) => {
                const s = VillageLayout.villageSlots(w, h, base, hill, ALL, OPTS);
                const r = VillageLayout.padRect(s);
                if (!r) return;
                s.forEach((x) => {
                    expect(x.artLeft).toBeGreaterThanOrEqual(r.left);
                    expect(x.artRight).toBeLessThanOrEqual(r.left + r.width - 40); // the art's ragged edge is up to ~40px short of the box on its upper rows
                });
            });
        }
    });

    test('no Gym slot (or no slots) means no pad', () => {
        expect(VillageLayout.padRect([])).toBeNull();
        expect(VillageLayout.padRect(null)).toBeNull();
        expect(VillageLayout.padRect(slots(1366, 480, { punctuality: 3 }))).toBeNull();
    });
});

describe('villageView pad', () => {
    function setSize(el, w, h) {
        Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => w });
        Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => h });
    }
    function init(w = 1366, h = 480, tiers = { gym: 3 }) {
        document.body.innerHTML = '<div id="gameCanvas"><div id="villageLayer"></div></div>';
        setSize(document.getElementById('gameCanvas'), w, h);
        VillageView.init({ getHillWidth: () => 120, getClockTier: () => 3, getGymTier: () => tiers.gym });
        VillageView.render(368);
    }
    const pad = () => document.querySelector('#villageLayer .village-pad');

    test('one decorative pad image, first in the layer, never a tappable .village-sprite', () => {
        init();
        expect(document.querySelectorAll('#villageLayer .village-pad')).toHaveLength(1);
        expect(pad().classList.contains('village-sprite')).toBe(false);
        expect(pad().getAttribute('alt')).toBe('');
        expect(pad().draggable).toBe(false);
        expect(document.getElementById('villageLayer').firstChild).toBe(pad());
    });

    test('placed by padRect', () => {
        init();
        const want = VillageLayout.padRect(VillageLayout.villageSlots(1366, 480, 368, 120, { punctuality: 3, lurkers: 3 }, OPTS));
        expect(pad().getAttribute('src')).toBe(want.url);
        expect(pad().style.left).toBe(want.left + 'px');
        expect(pad().style.top).toBe(want.top + 'px');
        expect(pad().style.width).toBe('696px');
        expect(pad().style.height).toBe('92px');
    });

    test('re-rendering keeps the same element; a resize moves it; no Gym removes it', () => {
        init();
        const first = pad();
        const left = first.style.left;
        VillageView.render(368);
        expect(pad()).toBe(first);
        setSize(document.getElementById('gameCanvas'), 1920, 640);
        VillageView.render(368);
        expect(pad()).toBe(first);
        expect(first.style.left).not.toBe(left);
        init(1366, 480, { gym: null });
        expect(pad()).toBeNull();
    });
});

describe('shell', () => {
    test('assets: grass strip 640x78 and pad 348x46', () => {
        expect(pngSize('Assets/scene/village-field.png')).toEqual({ w: 640, h: 78 });
        expect(pngSize('Assets/scene/village-pad.png')).toEqual({ w: 348, h: 46 });
    });

    test('CSS: the pad is behind the sprites, untappable, pixelated', () => {
        const css = read('css/village.css');
        const b = css.slice(css.indexOf('.village-pad {'), css.indexOf('}', css.indexOf('.village-pad {')));
        expect(b).toMatch(/z-index: -1/);
        expect(b).toMatch(/pointer-events: none/);
        expect(b).toMatch(/image-rendering: pixelated/);
    });

    test('service worker caches the pad and the cache is past v436', () => {
        const sw = read('sw.js');
        expect(sw).toContain("'Assets/scene/village-pad.png'");
        expect(Number(/deadline-shell-v(\d+)/.exec(sw)[1])).toBeGreaterThanOrEqual(437);
    });
});

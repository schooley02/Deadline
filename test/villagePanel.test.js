/**
 * @jest-environment jsdom
 *
 * VillagePanel (2026-10-30): the overview the HUD village button opens. buildModel/panelHtml are pure; open() is covered
 * with a stubbed Modal. The HUD button + shell wiring is checked against index.html / sw.js / script.js text.
 */
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');
const VillageCard = require('../js/ui/villageCard.js');
const VillageLayout = require('../js/villageLayout.js');
const VillageProgress = require('../js/villageProgress.js');
const VillagePanel = require('../js/ui/villagePanel.js');

global.VillageCard = VillageCard;

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const ALL_KINDS = ['nights', 'slain', 'punctuality', 'habits', 'lurkers', 'defense', 'heroes', 'bestdays'];
const spriteFor = (kind, tier) => ({ url: `Assets/Village/${kind}_t${tier}.png`, width: 128, height: kind === 'punctuality' ? 256 : 128 });

function progressAt(tierByKind = {}) {
    const out = {};
    ALL_KINDS.forEach((k) => {
        const t = tierByKind[k] || 1;
        out[k] = { tier: t, value: 3, prevAt: 0, nextAt: 10, toNext: 7, maxed: t >= 5, fraction: 0.3 };
    });
    return out;
}

describe('buildModel', () => {
    test('one row per building, in the card\'s order, with the same names', () => {
        const m = VillagePanel.buildModel({ progress: progressAt(), spriteFor });
        expect(m.rows.map(r => r.kind)).toEqual(ALL_KINDS);
        m.rows.forEach(r => expect(r.name).toBe(VillageCard.KINDS[r.kind].name));
    });

    test('tier, bar text and the fully-rebuilt state come from the same model as the card', () => {
        const m = VillagePanel.buildModel({ progress: progressAt({ nights: 5, slain: 2 }), spriteFor });
        const nights = m.rows.find(r => r.kind === 'nights');
        const slain = m.rows.find(r => r.kind === 'slain');
        expect(nights.tier).toBe(5);
        expect(nights.maxed).toBe(true);
        expect(nights.barText).toBe('Fully rebuilt');
        expect(slain.tier).toBe(2);
        expect(slain.barText).toBe('3 / 10 zombies to earn star 3');
    });

    test('the title total adds the tiers: a new game is 8 of 40', () => {
        expect(VillagePanel.buildModel({ progress: progressAt() })).toMatchObject({ tiersTotal: 8, tiersMax: 40 });
        expect(VillagePanel.buildModel({ progress: progressAt({ nights: 3, habits: 5 }) }).tiersTotal).toBe(8 + 2 + 4);
    });

    test('no progress at all (never computed) reads as a T1 village', () => {
        const m = VillagePanel.buildModel({});
        expect(m.rows).toHaveLength(8);
        expect(m.tiersTotal).toBe(8);
    });

    test('the thumbnail is the building\'s CURRENT tier sprite; without spriteFor there is none', () => {
        const m = VillagePanel.buildModel({ progress: progressAt({ habits: 4 }), spriteFor });
        expect(m.rows.find(r => r.kind === 'habits').spriteUrl).toBe('Assets/Village/habits_t4.png');
        expect(VillagePanel.buildModel({ progress: progressAt() }).rows[0].spriteUrl).toBeNull();
    });
});

describe('panelHtml', () => {
    const html = VillagePanel.panelHtml(VillagePanel.buildModel({ progress: progressAt({ nights: 5 }), spriteFor: (k, t) => ({ url: 'Assets/Village/p"x.png', width: 128, height: 128 }) }));

    test('a titled dialog with eight tappable rows and a small corner x (no Close row)', () => {
        expect(html).toContain('village-panel-overlay');
        expect(html).toContain('aria-label="Village"');
        expect((html.match(/data-action="open"/g) || [])).toHaveLength(8);
        ALL_KINDS.forEach(k => expect(html).toContain(`data-kind="${k}"`));
        expect(html).toContain('class="modal-close-x"');
        expect(html).not.toContain('modal-buttons');
        expect(html).not.toContain('primary-button');
        expect(html).toContain('12 / 40 tiers');
    });

    test('escapes the sprite url and marks the maxed row', () => {
        expect(html).not.toContain('p"x.png');
        expect((html.match(/vp-row--maxed/g) || [])).toHaveLength(1);
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

    test('a row calls onOpenBuilding with its kind and leaves the panel open', () => {
        const seen = [];
        VillagePanel.open({ progress: progressAt(), spriteFor, onOpenBuilding: k => seen.push(k) });
        document.querySelector('[data-kind="defense"]').click();
        expect(seen).toEqual(['defense']);
        expect(document.querySelectorAll('.village-panel-overlay')).toHaveLength(1);
    });

    test('the corner x removes the panel', () => {
        VillagePanel.open({ progress: progressAt(), spriteFor });
        document.querySelector('[data-action="close"]').click();
        expect(document.querySelectorAll('.village-panel-overlay')).toHaveLength(0);
    });
});

describe('HUD button + shell wiring', () => {
    const html = read('index.html');

    test('the village button sits right after the level button, before the points button, icon only', () => {
        const lv = html.indexOf('id="levelButton"');
        const vb = html.indexOf('id="villageButton"');
        const pts = html.indexOf('id="playerPointsStat"');
        expect(lv).toBeGreaterThan(-1);
        expect(vb).toBeGreaterThan(lv);
        expect(pts).toBeGreaterThan(vb);
        const btn = html.slice(html.indexOf('>', vb) + 1, html.indexOf('</button>', vb)); // the button's content
        expect(btn).toContain('<svg');
        expect(html.slice(vb, html.indexOf('>', vb))).toContain('aria-label="Village. Open village panel"');
        expect(btn.replace(/<svg[\s\S]*<\/svg>/, '').replace(/<[^>]+>/g, '').trim()).toBe(''); // no text
    });

    test('the panel loads after the card (it reads VillageCard) and before script.js; both files are in the offline shell', () => {
        expect(html.indexOf('js/ui/villagePanel.js')).toBeGreaterThan(html.indexOf('js/ui/villageCard.js'));
        expect(html.indexOf('js/ui/villagePanel.js')).toBeLessThan(html.indexOf('src="script.js"'));
        expect(html).toContain('css/villagePanel.css');
        const sw = read('sw.js');
        expect(sw).toContain("'js/ui/villagePanel.js'");
        expect(sw).toContain("'css/villagePanel.css'");
    });

    test('script.js opens the panel from the button and routes a row to the building card', () => {
        const src = read('script.js');
        expect(src).toContain("getElementById('villageButton')");
        expect(src).toContain('VillagePanel.open(');
        expect(src).toContain("villageButton.addEventListener('click', openVillagePanel)");
    });

    test('every kind has a sprite size the panel can use', () => {
        const opts = VillageLayout.fromConfig(CONFIG);
        ALL_KINDS.forEach((k) => {
            const [w, h] = VillageLayout.sizeOf(k, opts);
            expect(w).toBe(128);
            expect(h).toBeGreaterThanOrEqual(128);
        });
        expect(Object.keys(VillageProgress.compute({}))).toEqual(expect.arrayContaining(ALL_KINDS));
    });
});

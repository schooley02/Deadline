/**
 * @jest-environment jsdom
 *
 * MemorialPanel (2026-11-08): the Memorial's own window. buildModel / panelHtml are pure; open() is covered with a stubbed Modal.
 * Also the Memorial link in the Village panel (how a portrait phone reaches it) and the shell wiring (index.html, sw.js, css).
 */
const fs = require('fs');
const path = require('path');
const Memorial = require('../js/memorial.js');
const VillageCard = require('../js/ui/villageCard.js');
const VillagePanel = require('../js/ui/villagePanel.js');
const MemorialPanel = require('../js/ui/memorialPanel.js');

global.Memorial = Memorial;
global.VillageCard = VillageCard;

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const ALL_KINDS = ['nights', 'slain', 'punctuality', 'habits', 'lurkers', 'defense', 'heroes', 'bestdays'];
const all = (t) => Object.fromEntries(ALL_KINDS.map((k) => [k, t]));

describe('buildModel', () => {
    test('one row per building, in Memorial.KINDS order, with the village card\'s names', () => {
        const m = MemorialPanel.buildModel({ best: {}, current: {} });
        expect(m.rows.map((r) => r.kind)).toEqual(Memorial.KINDS);
        expect([...Memorial.KINDS].sort()).toEqual([...ALL_KINDS].sort());
        m.rows.forEach((r) => expect(r.name).toBe(VillageCard.KINDS[r.kind].name));
    });

    test('a fresh game: stage 1, every building at T1, 8 tier-ups to Stage 2', () => {
        const m = MemorialPanel.buildModel({ best: {}, current: {} });
        expect(m.stage).toBe(1);
        expect(m.sum).toBe(8);
        expect(m.max).toBe(40);
        expect(m.toNextStage).toBe(8);
        expect(m.nextText).toBe('8 more tier-ups, in any buildings, reach Stage 2.');
        m.rows.forEach((r) => { expect(r.best).toBe(1); expect(r.current).toBe(1); });
    });

    test('best comes from the saved map, current from this run, and they are independent', () => {
        const m = MemorialPanel.buildModel({ best: { slain: 4, nights: 3 }, current: { slain: 2, habits: 1 } });
        const slain = m.rows.find((r) => r.kind === 'slain');
        const nights = m.rows.find((r) => r.kind === 'nights');
        expect(slain.best).toBe(4);
        expect(slain.current).toBe(2);
        expect(nights.best).toBe(3);
        expect(nights.current).toBe(1); // missing this-run tier counts as T1
    });

    test('the stage and the tier-ups come from Memorial.progress (same numbers the hill uses)', () => {
        const best = { slain: 4, nights: 3, punctuality: 3, habits: 2, lurkers: 2, defense: 2, heroes: 2, bestdays: 1 }; // sum 19
        const m = MemorialPanel.buildModel({ best, current: {} });
        expect(m.stage).toBe(Memorial.stage(best));
        expect(m.stage).toBe(2);
        expect(m.toNextStage).toBe(5); // 24 - 19
        expect(m.nextText).toBe('5 more tier-ups, in any buildings, reach Stage 3.');
    });

    test('one tier-up away reads in the singular', () => {
        const best = all(2);
        best.slain = 3;
        best.nights = 3; // sum 18... need 23 for one short of stage 3: build it exactly
        const near = { ...all(3), bestdays: 2 }; // sum 23 -> stage 2, 1 more to 24
        const m = MemorialPanel.buildModel({ best: near, current: {} });
        expect(m.stage).toBe(2);
        expect(m.nextText).toBe('1 more tier-up, in any buildings, reaches Stage 3.');
    });

    test('stage 5 is fully restored with nothing left to climb', () => {
        const m = MemorialPanel.buildModel({ best: all(5), current: all(1) });
        expect(m.stage).toBe(5);
        expect(m.maxed).toBe(true);
        expect(m.nextText).toBe('The Memorial is fully restored.');
        m.rows.forEach((r) => { expect(r.best).toBe(5); expect(r.current).toBe(1); }); // the best survives a new run
    });

    test('junk input never throws and reads as a fresh game', () => {
        [undefined, null, {}, { best: 'x', current: 5 }, { best: { slain: 99 }, current: { slain: 0 } }].forEach((ctx) => {
            const m = MemorialPanel.buildModel(ctx);
            expect(m.stage).toBe(1);
            m.rows.forEach((r) => { expect(r.best).toBe(1); expect(r.current).toBe(1); });
        });
    });
});

describe('panelHtml', () => {
    const html = (ctx) => MemorialPanel.panelHtml(MemorialPanel.buildModel(ctx));
    const doc = (ctx) => { const d = document.createElement('div'); d.innerHTML = html(ctx).trim(); return d; };

    test('title, stage, the rule in one line, the sprite tile for the stage', () => {
        const d = doc({ best: all(3), current: {} });
        expect(d.querySelector('.mp-title h3').textContent).toBe('Memorial');
        expect(d.querySelector('.mp-stage').textContent).toBe('Stage 3 of 5');
        expect(d.querySelector('.mp-rule').textContent).toBe(MemorialPanel.RULE);
        expect(MemorialPanel.RULE).toMatch(/average, rounded down/);
        expect(MemorialPanel.RULE).toMatch(/never goes down/);
        expect(d.querySelector('.mp-sprite').dataset.stage).toBe('3');
    });

    test('eight rows, each with five pips: green up to the best, a gold ring on this run\'s tier', () => {
        const d = doc({ best: { slain: 4 }, current: { slain: 2 } });
        const rows = d.querySelectorAll('.mp-row');
        expect(rows).toHaveLength(8);
        const slain = [...rows].find((r) => r.querySelector('.mp-name').textContent === 'Armory');
        const pips = [...slain.querySelectorAll('.mp-pip')];
        expect(pips).toHaveLength(5);
        expect(pips.map((p) => p.classList.contains('mp-best'))).toEqual([true, true, true, true, false]);
        expect(pips.map((p) => p.classList.contains('mp-now'))).toEqual([false, true, false, false, false]);
        expect(slain.getAttribute('aria-label')).toBe('Armory: best tier 4, this run tier 2');
    });

    test('the legend explains both marks and the closing line states what is left', () => {
        const d = doc({ best: {}, current: {} });
        expect(d.querySelector('.mp-legend').textContent.replace(/\s+/g, ' ').trim()).toBe('Best ever This run');
        expect(d.querySelector('.mp-next').textContent).toContain('Stage 2');
    });

    test('it is a modal dialog with the shared corner x', () => {
        const d = doc({});
        expect(d.querySelector('.memorial-panel-overlay.modal-overlay')).not.toBeNull();
        expect(d.querySelector('[role="dialog"][aria-label="Memorial"]')).not.toBeNull();
        expect(d.querySelector('.modal-close-x[data-action="close"]')).not.toBeNull();
    });

    test('building names are escaped', () => {
        const row = MemorialPanel.rowHtml({ kind: 'x', name: '<b>Tower</b>', best: 1, current: 1 });
        expect(row).not.toContain('<b>');
        expect(row).toContain('&lt;b&gt;Tower&lt;/b&gt;');
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

    test('opens one window and the corner x removes it', () => {
        MemorialPanel.open({ best: all(2), current: {} });
        expect(document.querySelectorAll('.memorial-panel-overlay')).toHaveLength(1);
        document.querySelector('[data-action="close"]').click();
        expect(document.querySelectorAll('.memorial-panel-overlay')).toHaveLength(0);
    });

    test('taps inside do not bubble to the document (Modal\'s outside-click would close the window)', () => {
        const docClick = jest.fn();
        document.addEventListener('click', docClick);
        MemorialPanel.open({ best: {}, current: {} });
        document.querySelector('[data-action="close"]').click();
        document.removeEventListener('click', docClick);
        expect(docClick).not.toHaveBeenCalled();
    });

    test('Modal dedupes on .memorial-panel-overlay', () => {
        const seen = [];
        global.Modal.open = (h, opts) => { seen.push(opts && opts.dedupeSelector); return null; };
        MemorialPanel.open({});
        expect(seen).toEqual(['.memorial-panel-overlay']);
    });
});

describe('the Memorial link in the Village panel', () => {
    const progress = Object.fromEntries(ALL_KINDS.map((k) => [k, { tier: 1, value: 0, prevAt: 0, nextAt: 10, toNext: 10, maxed: false, fraction: 0 }]));

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

    test('shows "Memorial  Stage N of 5" and calls onOpenMemorial, leaving the village panel open', () => {
        const onOpenMemorial = jest.fn();
        VillagePanel.open({ progress, memorial: { stage: 3 }, onOpenMemorial });
        const link = document.querySelector('.vp-memorial');
        expect(link.textContent.replace(/\s+/g, ' ').trim()).toBe('MemorialStage 3 of 5 ›');
        expect(link.getAttribute('aria-label')).toBe('Memorial, stage 3 of 5. Open');
        link.click();
        expect(onOpenMemorial).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll('.village-panel-overlay')).toHaveLength(1);
    });

    test('no memorial info, no link (existing callers and tests are unchanged)', () => {
        VillagePanel.open({ progress });
        expect(document.querySelector('.vp-memorial')).toBeNull();
    });

    test('a junk stage is clamped into 1..5', () => {
        expect(VillagePanel.buildModel({ progress, memorial: { stage: 9 } }).memorialStage).toBe(5);
        expect(VillagePanel.buildModel({ progress, memorial: { stage: 0 } }).memorialStage).toBe(1);
        expect(VillagePanel.buildModel({ progress, memorial: { stage: 'x' } }).memorialStage).toBeNull();
    });
});

describe('shell + wiring', () => {
    const html = read('index.html');
    const sw = read('sw.js');
    const script = read('script.js');
    const css = read('css/memorialPanel.css');

    test.each(['css/memorialPanel.css', 'js/ui/memorialPanel.js'])('%s exists and is in the service worker APP_SHELL', (f) => {
        expect(fs.existsSync(path.join(root, f))).toBe(true);
        expect(sw).toContain(`'${f}'`);
    });

    test('the cache name was bumped past v283 for this shell change', () => {
        const v = Number((sw.match(/CACHE_NAME = 'deadline-shell-v(\d+)'/) || [])[1]);
        expect(v).toBeGreaterThanOrEqual(284);
    });

    test('the panel loads after villageCard/villagePanel and before script.js; its CSS loads before responsive.css', () => {
        const at = (s) => html.indexOf(`"${s}"`);
        expect(at('js/ui/memorialPanel.js')).toBeGreaterThan(at('js/ui/villagePanel.js'));
        expect(at('js/ui/memorialPanel.js')).toBeLessThan(at('script.js'));
        expect(at('js/memorial.js')).toBeLessThan(at('js/ui/memorialPanel.js'));
        expect(at('css/memorialPanel.css')).toBeGreaterThan(0);
        expect(at('css/memorialPanel.css')).toBeGreaterThan(at('css/villagePanel.css'));
        expect(at('css/memorialPanel.css')).toBeLessThan(at('css/responsive.css'));
    });

    test.each([1, 2, 3, 4, 5])('stage %i has its own CSS rule pointing at its PNG', (t) => {
        expect(css).toContain(`.mp-sprite[data-stage="${t}"] .mp-art { background-image: url("../Assets/Village/memorial_t${t}.png"); }`);
    });

    test('the obelisk art is drawn 1:1 and pixelated', () => {
        const i = css.indexOf('\n.mp-art {');
        const block = css.slice(i, css.indexOf('}', i));
        expect(block).toContain('background-size: 128px 192px');
        expect(block).toMatch(/image-rendering: pixelated/);
    });

    test('script.js: the obelisk and the Village panel both open the window with the REAL tiers (never the dev overrides)', () => {
        const g = script.indexOf('GraveyardView.init({');
        expect(script.slice(g, script.indexOf('});', g))).toContain('onOpenMemorial: () => openMemorialPanel()');
        const i = script.indexOf('function openMemorialPanel()');
        expect(i).toBeGreaterThan(0);
        const body = script.slice(i, script.indexOf('\n    }\n', i));
        expect(body).toContain('MemorialPanel.open(');
        expect(body).toContain('State.getBestVillageTiers()');
        expect(body).toContain('realVillageTiers()');
        expect(body).not.toMatch(/DevDemo|resolveTier/);
        const v = script.indexOf('VillagePanel.open({');
        expect(script.slice(v, script.indexOf('});', v))).toContain('onOpenMemorial: () => openMemorialPanel()');
    });
});

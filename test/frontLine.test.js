/** @jest-environment jsdom */
// The zombie front line (BASE_WIDTH) = church width + a gap the barricade stands in (Momentum Build C, 2026-11-12).
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const script = read('script.js');
const css = read('css/barricade.css');
const CONFIG = require('../js/config.js');

describe('front line gap', () => {
    test('config: 28px landscape, 14px portrait strip (half size)', () => {
        expect(CONFIG.FRONT_LINE_GAP_PX).toBe(28);
        expect(CONFIG.FRONT_LINE_GAP_STRIP_PX).toBe(14);
        expect(CONFIG.FRONT_LINE_GAP_STRIP_PX * 2).toBe(CONFIG.FRONT_LINE_GAP_PX);
    });
    test('BASE_WIDTH is church width + gap at both measuring points', () => {
        expect(script).toMatch(/function frontLineX\(\) \{ return churchWidth\(\) \+ frontLineGap\(\); \}/);
        expect(script).toContain('BASE_WIDTH = frontLineX();');
        expect(script).toContain('setBaseWidth: (n) => { BASE_WIDTH = n + frontLineGap(); },');
        expect(script).toMatch(/Layout\.isActive\(\) \? CONFIG\.FRONT_LINE_GAP_STRIP_PX : CONFIG\.FRONT_LINE_GAP_PX/);
    });
    test('village and graveyard still sit right of the CHURCH, not the front line', () => {
        expect(script).not.toMatch(/(Village|Graveyard)View\.render\(BASE_WIDTH\)/);
        expect((script.match(/GraveyardView\.render\(churchWidth\(\)\)/g) || []).length).toBe(2);
        expect((script.match(/VillageView\.render\(churchWidth\(\)\)/g) || []).length).toBe(2);
    });
    test('barricade box straddles the gap: starts at the stairs, ends past the front line (160+28)', () => {
        const left = Number(/left: calc\((\d+)px - var\(--base-bleed/.exec(css)[1]);
        const width = Number(/\.barricade \{[^}]*?width: (\d+)px/s.exec(css)[1]);
        expect(left).toBeLessThan(160);
        expect(left + width).toBeGreaterThan(160 + CONFIG.FRONT_LINE_GAP_PX);
    });
});

describe('lane slant', () => {
    const Layout = require('../js/layout.js');
    test('config: back lane stands 30px right of the front lane', () => expect(CONFIG.GROUND_LANE_SLANT_PX).toBe(30));
    test('0 at the front lane, full at the back lane, proportional between', () => {
        const o = { laneSlant: 30, laneCount: 3 };
        expect(Layout.laneSlantPx(2, o)).toBe(0);
        expect(Layout.laneSlantPx(1, o)).toBe(15);
        expect(Layout.laneSlantPx(0, o)).toBe(30);
    });
    test('off when the dial is 0 or there is one lane', () => {
        expect(Layout.laneSlantPx(0, { laneSlant: 0, laneCount: 3 })).toBe(0);
        expect(Layout.laneSlantPx(0, { laneSlant: 30, laneCount: 1 })).toBe(0);
        expect(Layout.laneSlantPx(null, { laneSlant: 30, laneCount: 3 })).toBe(0);
    });
    test('drawn only: applyGroundLanes puts it on --lane-dx and never touches item.x', () => {
        const mk = (id) => { const el = document.createElement('div'); el.style.height = '50px'; return { id, x: 188, element: el, dueMs: 1 }; };
        const items = [mk('a'), mk('b'), mk('c')];
        Layout.applyGroundLanes(items, 400, { laneSlant: 30, noListOrder: true });
        const dx = items.map((i) => parseFloat(i.element.style.getPropertyValue('--lane-dx')) || 0).sort((p, q) => p - q);
        expect(dx).toEqual([0, 15, 30]);
        items.forEach((i) => expect(i.x).toBe(188));
    });
});

describe('feet on the line', () => {
    const Layout = require('../js/layout.js');
    const mk = (id, category, w) => { const el = document.createElement('div'); el.style.height = '50px'; el.style.width = (w || 128) + 'px'; return { id, x: 188, category, element: el, dueMs: 1 }; };
    test('every zombie family has a measured front-foot inset', () => {
        expect(Object.keys(CONFIG.ZOMBIE_FEET_INSET).sort()).toEqual(Object.keys(CONFIG.ZOMBIE_VISIBLE_MARGINS).sort());
    });
    test('slides the box left so the front foot sits the clearance past the line', () => {
        const o = { feetInset: { other: 0.375, relationships: 0.047 }, feetClearance: 4 };
        expect(Layout.feetDxPx(mk(1, 'other'), o)).toBe(4 - 48);
        expect(Layout.feetDxPx(mk(2, 'relationships'), o)).toBe(4 - 6); // the stroller barely moves
        expect(Layout.feetDxPx(mk(3, 'other', 96), o)).toBe(4 - 36);     // scales with the box (sub-task)
    });
    test('no category or switched off: no shift', () => {
        expect(Layout.feetDxPx(mk(1, undefined), {})).toBe(0);
        expect(Layout.feetDxPx(mk(1, 'other'), { feetAlign: false })).toBe(0);
    });
    test('drawn only: adds to --lane-dx with the slant, item.x untouched', () => {
        const items = [mk('a', 'other')];
        Layout.applyGroundLanes(items, 400, { laneSlant: 0, feetInset: { other: 0.375 }, feetClearance: 4, noListOrder: true });
        expect(items[0].element.style.getPropertyValue('--lane-dx')).toBe('-44px');
        expect(items[0].x).toBe(188);
    });
});

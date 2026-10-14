/**
 * Layout tests (V3b-1, 2026-10-13) — portrait glance-strip mode detection,
 * body-class mirroring, "+N" sub-task badge counts, and the Movement rule that
 * zeroes the sub-task fan-out in strip mode (the 390px midnight-line bug).
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
const Movement = require('../js/movement.js');
const Layout = require('../js/layout.js');

function fakeWin(matches) {
    return { matchMedia: jest.fn(() => ({ matches })), addEventListener: jest.fn() };
}
function fakeDoc() {
    const set = new Set();
    return {
        classes: set,
        body: { classList: { toggle: (c, on) => (on ? set.add(c) : set.delete(c)) } },
    };
}

describe('Layout.isGlanceStrip / applyBodyClass', () => {
    test('uses the portrait + max-width 768 media query', () => {
        const win = fakeWin(true);
        expect(Layout.isGlanceStrip(win)).toBe(true);
        expect(win.matchMedia).toHaveBeenCalledWith('(max-width: 768px) and (orientation: portrait)');
    });
    test('false when the query does not match, or matchMedia is missing', () => {
        expect(Layout.isGlanceStrip(fakeWin(false))).toBe(false);
        expect(Layout.isGlanceStrip({})).toBe(false);
    });
    test('applyBodyClass toggles body.glance-strip and caches isActive()', () => {
        const doc = fakeDoc();
        expect(Layout.applyBodyClass(doc, fakeWin(true))).toBe(true);
        expect(doc.classes.has('glance-strip')).toBe(true);
        expect(Layout.isActive()).toBe(true);
        expect(Layout.applyBodyClass(doc, fakeWin(false))).toBe(false);
        expect(doc.classes.has('glance-strip')).toBe(false);
        expect(Layout.isActive()).toBe(false);
    });
    test('init applies once, then onChange reports a mode change on resize', () => {
        const doc = fakeDoc();
        let strip = true;
        const win = {
            matchMedia: () => ({ matches: strip }),
            addEventListener: jest.fn(),
        };
        const onChange = jest.fn();
        const { reapply } = Layout.init({ win, doc, onChange });
        expect(doc.classes.has('glance-strip')).toBe(true);
        expect(win.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
        strip = false; // rotate to landscape
        reapply();
        expect(onChange).toHaveBeenLastCalledWith(false, true);
        reapply(); // plain resize, mode unchanged
        expect(onChange).toHaveBeenLastCalledWith(false, false);
    });
});

describe('Layout.computeSubBadges / applySubBadges', () => {
    const mk = (id, x, parentId) => ({ id, x, parentId, element: { dataset: {} } });

    test('counts only subs sitting on their parent (x equal)', () => {
        const items = [mk(1, 200), mk(2, 200, 1), mk(3, 200, 1), mk(4, 90, 1), mk(5, 300)];
        expect(Layout.computeSubBadges(items)).toEqual({ 1: 2 });
    });
    test('applySubBadges writes data-sub-count on parents and clears it when 0', () => {
        const items = [mk(1, 200), mk(2, 200, 1)];
        Layout.applyBodyClass(fakeDoc(), fakeWin(true));
        Layout.applySubBadges(items);
        expect(items[0].element.dataset.subCount).toBe('1');
        expect(items[1].element.dataset.subCount).toBeUndefined(); // subs never get a badge
        items.pop(); // sub completed
        Layout.applySubBadges(items);
        expect(items[0].element.dataset.subCount).toBeUndefined();
    });
    test('outside strip mode no badges are written (and stale ones are cleared)', () => {
        const items = [mk(1, 200), mk(2, 200, 1)];
        items[0].element.dataset.subCount = '1';
        Layout.applyBodyClass(fakeDoc(), fakeWin(false));
        Layout.applySubBadges(items);
        expect(items[0].element.dataset.subCount).toBeUndefined();
    });
});

describe('Movement: sub-task fan-out in glance-strip mode (390px midnight-line bug)', () => {
    const parent = { id: 1, category: 'career', x: 130 };
    const sub = { id: 2, category: 'career', parentId: 1 };
    const activeItems = [parent, sub];

    test('desktop: first sub fans out to the LEFT of its parent, toward the church (negative)', () => {
        expect(Movement.getSubTaskClusterOffset(sub, { activeItems, enemyWidth: 128 })).toBeLessThan(0);
    });
    test('strip: first sub steps a small gap TOWARD THE CHURCH (never right)', () => {
        expect(Movement.getSubTaskClusterOffset(sub, { activeItems, enemyWidth: 128, glanceStrip: true }))
            .toBe(-CONFIG.STRIP_SUBTASK_GAP_PX);
    });
    test('strip: 2nd sub steps 2 gaps left; 3rd+ stack on the parent (offset 0)', () => {
        const mkSub = id => ({ id, category: 'career', parentId: 1 });
        const subs = [mkSub(2), mkSub(3), mkSub(4)];
        const all = [parent, ...subs];
        const off = s => Movement.getSubTaskClusterOffset(s, { activeItems: all, enemyWidth: 128, glanceStrip: true });
        expect(off(subs[0])).toBe(-CONFIG.STRIP_SUBTASK_GAP_PX);
        expect(off(subs[1])).toBe(-2 * CONFIG.STRIP_SUBTASK_GAP_PX);
        expect(off(subs[2])).toBe(0);
    });
    test('strip: clustered sub lands a small gap left of the parent, never right', () => {
        const dims = { gameScreenWidth: 390, baseWidth: 56, enemyWidth: 24, habitEnemyWidth: 24 };
        const now = new Date(2026, 9, 13, 23, 0, 0);
        parent.type = 'task'; sub.type = 'task';
        parent.dueDateTime = new Date(2026, 9, 13, 23, 55, 0);
        sub.dueDateTime = new Date(2026, 9, 13, 23, 55, 0);
        parent.x = Clock.calculateTimelinePosition(parent, now, dims);
        const x = Movement.calculateTimelineXWithClustering(sub, now, { activeItems, dims, glanceStrip: true });
        expect(x).toBeLessThanOrEqual(parent.x);
        expect(x).toBe(Math.max(parent.x - CONFIG.STRIP_SUBTASK_GAP_PX, dims.baseWidth));
    });
});

// ---------------------------------------------------------------------------
// V3b-2 — vertical lanes, same-lane collision fallback, overdue pile
// ---------------------------------------------------------------------------
describe('Layout.computeStripLayout (V3b-2)', () => {
    const mk = (id, x, extra = {}) => ({ id, x, ...extra });
    const el = (...classes) => ({ classList: { contains: c => classes.includes(c) } });
    const lanes = plan => Object.fromEntries(Object.entries(plan).map(([id, p]) => [id, p.lane]));

    test('deals markers onto 3 lanes in x order; most urgent takes the FRONT lane', () => {
        const items = [mk(1, 100), mk(2, 140), mk(3, 180), mk(4, 220), mk(5, 260)];
        expect(lanes(Layout.computeStripLayout(items))).toEqual({ 1: 2, 2: 1, 3: 0, 4: 2, 5: 1 });
    });

    test('same-lane neighbours end up LANE_COUNT markers apart (the point of lanes)', () => {
        // 8 tasks 12px apart (the live-check density that overlapped before)
        const items = Array.from({ length: 8 }, (_, i) => mk(i + 1, 230 + i * 12));
        const plan = Layout.computeStripLayout(items);
        const byLane = {};
        items.forEach(i => (byLane[plan[i.id].lane] = byLane[plan[i.id].lane] || []).push(i.x));
        Object.values(byLane).forEach(xs => {
            for (let k = 1; k < xs.length; k++) expect(xs[k] - xs[k - 1]).toBeGreaterThanOrEqual(CONFIG.STRIP_MARKER_WIDTH);
        });
        expect(Object.values(plan).every(p => !p.hidden && p.badge === 0)).toBe(true);
    });

    test('order of the input array and tiny x drift do not change lanes (stable while walking)', () => {
        const a = [mk(1, 100), mk(2, 140), mk(3, 180)];
        const first = lanes(Layout.computeStripLayout(a));
        const moved = [mk(3, 170.5), mk(1, 90.5), mk(2, 130.5)]; // everyone walked ~10px, shuffled array
        expect(lanes(Layout.computeStripLayout(moved))).toEqual(first);
    });

    test('a spawn or removal re-packs the markers behind it', () => {
        const before = lanes(Layout.computeStripLayout([mk(1, 100), mk(2, 200), mk(3, 300)]));
        const spawned = lanes(Layout.computeStripLayout([mk(1, 100), mk(4, 150), mk(2, 200), mk(3, 300)]));
        expect(before).toEqual({ 1: 2, 2: 1, 3: 0 });
        expect(spawned).toEqual({ 1: 2, 4: 1, 2: 0, 3: 2 });
        const removed = lanes(Layout.computeStripLayout([mk(2, 200), mk(3, 300)]));
        expect(removed).toEqual({ 2: 2, 3: 1 });
    });

    test('x ties (parked tomorrow items) fan across lanes by id', () => {
        const items = [mk(7, 310), mk(5, 310), mk(6, 310)];
        expect(lanes(Layout.computeStripLayout(items))).toEqual({ 5: 2, 6: 1, 7: 0 });
    });

    test('same-lane markers closer than a marker width collapse into the nearest one\'s badge', () => {
        // 4 parked at the same x: three fill the lanes, the 4th lands in lane 2 on top of #1
        const items = [mk(1, 310), mk(2, 310), mk(3, 310), mk(4, 310)];
        const plan = Layout.computeStripLayout(items);
        expect(plan[1]).toEqual({ lane: 2, hidden: false, badge: 1 });
        expect(plan[4]).toEqual({ lane: 2, hidden: true, badge: 0 });
        expect(plan[2].hidden).toBe(false);
        expect(plan[3].hidden).toBe(false);
    });

    test('a sub stacked on its parent shares its lane and adds to its badge; a broken-away sub gets its own lane', () => {
        const items = [mk(1, 200), mk(2, 200, { parentId: 1 }), mk(3, 120, { parentId: 1 })];
        const plan = Layout.computeStripLayout(items);
        expect(plan[2].lane).toBe(plan[1].lane);
        expect(plan[1].badge).toBe(1);
        expect(plan[3].lane).not.toBeNull(); // own marker
        expect(plan[3].lane).not.toBe(plan[1].lane);
        expect(plan[3].badge).toBe(0);
    });

    test('spread subs (a gap left of the parent) take lanes different from the parent and show no badge', () => {
        const gap = CONFIG.STRIP_SUBTASK_GAP_PX;
        const items = [mk(1, 200), mk(2, 200 - gap, { parentId: 1 }), mk(3, 200 - 2 * gap, { parentId: 1 })];
        const plan = Layout.computeStripLayout(items);
        expect(plan[1]).toEqual({ lane: 2, hidden: false, badge: 0 });
        expect(plan[2].lane).not.toBe(plan[1].lane);
        expect(plan[3].lane).not.toBe(plan[1].lane);
        expect(plan[2].lane).not.toBe(plan[3].lane); // two subs fill the two other lanes
        expect(plan[2].hidden).toBe(false);
        expect(plan[3].hidden).toBe(false);
    });

    test('spread + stacked: 3rd sub stacks on the parent and only it is badged', () => {
        const gap = CONFIG.STRIP_SUBTASK_GAP_PX;
        const items = [mk(1, 200), mk(2, 200 - gap, { parentId: 1 }), mk(3, 200 - 2 * gap, { parentId: 1 }),
            mk(4, 200, { parentId: 1 })];
        const plan = Layout.computeStripLayout(items);
        expect(plan[1].badge).toBe(1);
        expect(plan[4].lane).toBe(plan[1].lane);
        expect(plan[2].lane).not.toBe(plan[1].lane);
    });

    test('a hidden (collapsed) parent hides its spread subs and counts them in the leader badge', () => {
        const gap = CONFIG.STRIP_SUBTASK_GAP_PX;
        // 4 items at one x: #4 collapses under #1 (same lane); #4 has a spread sub
        const items = [mk(1, 310), mk(2, 310), mk(3, 310), mk(4, 310), mk(5, 310 - gap, { parentId: 4 })];
        const plan = Layout.computeStripLayout(items);
        expect(plan[4].hidden).toBe(true);
        expect(plan[5].hidden).toBe(true);
        expect(plan[1].badge).toBe(2); // #4 + its sub
    });

    test('a sub far from its parent (broken away) is NOT a spread sub', () => {
        const items = [mk(1, 300), mk(2, 120, { parentId: 1 })];
        const plan = Layout.computeStripLayout(items);
        expect(plan[2].lane).not.toBeNull();
        expect(plan[1].badge).toBe(0);
    });

    test('overdue items at the base spread over the lanes; only a 4th+ folds into a "+N" badge (2026-10-13)', () => {
        const base = 56;
        const items = [
            mk(1, base, { isOverdue: true, element: el('enemy-at-base') }),
            mk(2, base, { isOverdue: true, element: el('enemy-at-base') }),
            mk(3, base, { isOverdue: true, element: el('enemy-at-base') }),
        ];
        const three = Layout.computeStripLayout(items);
        expect(lanes(three)).toEqual({ 1: 2, 2: 1, 3: 0 });       // each attacker has its own lane, no badge
        expect(Object.values(three).every(p => !p.hidden && p.badge === 0)).toBe(true);

        const more = items.concat([
            mk(4, base, { isOverdue: true, element: el('enemy-at-base') }),
            mk(5, base, { parentId: 4 }), // not overdue itself, stacked on overdue #4
            mk(6, 200),
        ]);
        const plan = Layout.computeStripLayout(more);
        expect(plan[4].hidden).toBe(true);                         // 4th: every lane blocked
        expect(plan[5].hidden).toBe(true);                         // its stacked sub goes with it
        expect(plan[1]).toEqual({ lane: 2, hidden: false, badge: 2 }); // #4 + #4's sub, on the top-of-list leader
        expect(plan[2].hidden).toBe(false);
        expect(plan[3].hidden).toBe(false);
        expect(plan[6]).toEqual({ lane: 1, hidden: false, badge: 0 }); // 200px away: natural lane, no clash
    });

    test('a walker closing in on the base pile moves to a free lane instead of hiding behind it', () => {
        const base = 56;
        const items = [
            mk(1, base, { isOverdue: true, element: el('enemy-at-base') }),
            mk(2, base + 10, { element: el() }), // natural lane is the pile leader's (round-robin idx 1 -> lane 1)
        ];
        const plan = Layout.computeStripLayout(items, { baseWidth: base });
        expect(plan[1].lane).toBe(2);
        expect(plan[2].lane).toBe(1);
        // a walker's x left of the base is clamped to it, so it still clashes with the pile
        const clamped = Layout.computeStripLayout(
            [mk(1, base, { isOverdue: true, element: el('enemy-at-base') }), mk(2, 20, { element: el() }),
                mk(3, 20, { element: el() })], { baseWidth: base, keys: new Map([[1, 0], [2, 1], [3, 2]]) });
        expect(clamped[1].lane).toBe(2);
        expect(new Set([clamped[1].lane, clamped[2].lane, clamped[3].lane]).size).toBe(3);
    });

    test('markers within 60% of a marker width never share a lane; just outside it they may', () => {
        const w = CONFIG.STRIP_MARKER_WIDTH;
        const edge = Math.floor(CONFIG.LANE_CONFLICT_FRAC * w);     // 19px: still a conflict (< 19.2)
        // natural lanes: #1 -> 2, #2 -> 1, #3 -> 0, #4 -> 2 (clashes with #1 at `edge - 1`)
        const near = [mk(1, 300), mk(2, 400), mk(3, 500), mk(4, 300 + edge)];
        const keys = new Map([[1, 0], [2, 1], [3, 2], [4, 3]]);   // list order == id order
        const p = Layout.computeStripLayout(near, { keys });
        expect(p[4].hidden).toBe(false);
        expect(p[4].lane).not.toBe(p[1].lane);
        const far = [mk(1, 300), mk(2, 400), mk(3, 500), mk(4, 300 + edge + 1)];
        expect(Layout.computeStripLayout(far, { keys })[4].lane).toBe(2);     // 20px >= 19.2: same lane is fine
    });

    test('overdue but non-threatening (no enemy-at-base) stays an ordinary lane marker', () => {
        const items = [mk(1, 100, { isOverdue: true, element: el() })];
        expect(Layout.computeStripLayout(items)[1].lane).toBe(2);
    });
});

describe('Layout.applyStripLayout (V3b-2)', () => {
    function domEl() {
        const classes = new Set();
        return { dataset: {}, classList: { contains: c => classes.has(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) }, classes };
    }
    test('writes data-lane / data-sub-count / .strip-hidden in strip mode and clears them outside it', () => {
        Layout.applyBodyClass(fakeDoc(), fakeWin(true));
        const a = { id: 1, x: 100, element: domEl() };
        const b = { id: 2, x: 100, parentId: 1, element: domEl() };
        const c = { id: 3, x: 300, element: domEl() };
        const items = [a, b, c];
        Layout.applyStripLayout(items);
        expect(a.element.dataset).toEqual({ lane: '2', subCount: '1' });
        expect(b.element.dataset).toEqual({ lane: '2' });
        expect(c.element.dataset).toEqual({ lane: '1' });

        Layout.applyBodyClass(fakeDoc(), fakeWin(false));
        Layout.applyStripLayout(items);
        // outside strip mode data-lane belongs to Layout.applyGroundLanes (landscape), so it is left alone
        expect(a.element.dataset.subCount).toBeUndefined();
        expect(c.element.classes.has('strip-hidden')).toBe(false);
    });
});

describe('desktop floor band stays in sync between CONFIG and css/gameCanvas.css', () => {
    const gc = require('fs').readFileSync(require('path').join(__dirname, '../css/gameCanvas.css'), 'utf8');
    test('.scene-ground height == CONFIG.GROUND_FLOOR_HEIGHT and the tile is that tall', () => {
        expect(gc).toMatch(new RegExp(`\\.scene-ground \\{[^}]*height: ${CONFIG.GROUND_FLOOR_HEIGHT}px;`));
        expect(gc).toContain(`/ 127px ${CONFIG.GROUND_FLOOR_HEIGHT}px;`);
    });
});

describe('strip geometry stays in sync between CONFIG and css/glanceStrip.css', () => {
    const css = require('fs').readFileSync(require('path').join(__dirname, '../css/glanceStrip.css'), 'utf8');
    test('sky / marker / icon / pitch / lane count / canvas height match', () => {
        expect(css).toContain(`--strip-sky: ${CONFIG.STRIP_SKY_HEIGHT}px;`);
        expect(css).toContain(`--strip-marker: ${CONFIG.STRIP_MARKER_HEIGHT}px;`);
        expect(css).toContain(`--strip-icon: ${CONFIG.STRIP_ICON_SIZE}px;`);
        expect(css).toContain(`--strip-pitch: ${CONFIG.STRIP_LANE_PITCH}px;`);
        expect(css).toContain(`--strip-lanes: ${CONFIG.STRIP_LANE_COUNT};`);
        expect(css).toContain(`--strip-pad: ${CONFIG.STRIP_FLOOR_PAD_BOTTOM}px;`);
        expect(css).toContain(`--strip-inset: ${CONFIG.STRIP_FLOOR_FEET_INSET}px;`);
        // floor tile (36px) = inset + (lanes-1)*pitch + pad; its top = sky + marker - inset
        const floor = CONFIG.STRIP_FLOOR_FEET_INSET + (CONFIG.STRIP_LANE_COUNT - 1) * CONFIG.STRIP_LANE_PITCH + CONFIG.STRIP_FLOOR_PAD_BOTTOM;
        expect(css).toContain(`/ 64px ${floor}px;`);
        expect(css).toContain('top: calc(var(--strip-sky) + var(--strip-marker) - var(--strip-inset));');
        const h = CONFIG.STRIP_SKY_HEIGHT + CONFIG.STRIP_MARKER_HEIGHT + (CONFIG.STRIP_LANE_COUNT - 1) * CONFIG.STRIP_LANE_PITCH + CONFIG.STRIP_FLOOR_PAD_BOTTOM;
        expect(css).toMatch(new RegExp(`#gameCanvas \\{\\s*height: ${h}px;`));
    });
    test('markers are round (width = height) and the icon fits inside the thickest ring', () => {
        expect(CONFIG.STRIP_MARKER_WIDTH).toBe(CONFIG.STRIP_MARKER_HEIGHT);
        expect(CONFIG.STRIP_ICON_SIZE).toBeLessThanOrEqual(CONFIG.STRIP_MARKER_HEIGHT - 2 * 3); // 3px habit/lurker ring
    });
    test('lanes overlap (pitch < marker height) so back markers stay tappable', () => {
        expect(CONFIG.STRIP_LANE_PITCH).toBeLessThan(CONFIG.STRIP_MARKER_HEIGHT);
    });
    test('lane selectors exist for every lane', () => {
        for (let l = 0; l < CONFIG.STRIP_LANE_COUNT; l++) expect(css).toContain(`[data-lane="${l}"] { --lane: ${l}; }`);
    });
});

// ---------------------------------------------------------------------------
// List-order lanes (2026-10-13) -- lanes are dealt in agenda LIST order and a
// collapsed cluster shows its top-of-list marker (opts.keys = ListOrder keys).
// ---------------------------------------------------------------------------
describe('Layout.computeStripLayout with list-order keys', () => {
    const mk = (id, x, extra = {}) => ({ id, x, ...extra });
    const lanes = plan => Object.fromEntries(Object.entries(plan).map(([id, p]) => [id, p.lane]));

    test('lanes follow the key order, not x: hand-moved row 2 takes the front lane', () => {
        const items = [mk(1, 100), mk(2, 112), mk(3, 124)];
        const keys = new Map([[1, 1], [2, 0], [3, 2]]);          // id 2 is the top row
        expect(lanes(Layout.computeStripLayout(items, { keys }))).toEqual({ 2: 2, 1: 1, 3: 0 });
    });

    test('keys equal to x order reproduce the old dealing', () => {
        const items = [mk(1, 100), mk(2, 140), mk(3, 180), mk(4, 220), mk(5, 260)];
        const keys = new Map(items.map((i, n) => [i.id, n]));
        expect(lanes(Layout.computeStripLayout(items, { keys })))
            .toEqual(lanes(Layout.computeStripLayout(items, { noListOrder: true })));
    });

    test('two overlapping markers: the lower row yields its lane, both stay visible (2026-10-13)', () => {
        // ids 1 and 4 would share a lane (3 lanes) and sit 10px apart; #4 is higher in the list.
        const items = [mk(1, 200), mk(2, 240), mk(3, 280), mk(4, 210)];
        const keys = new Map([[4, 0], [1, 3], [2, 1], [3, 2]]);
        const plan = Layout.computeStripLayout(items, { keys });
        expect(plan[4]).toEqual({ lane: 2, hidden: false, badge: 0 });   // top row keeps the front lane
        expect(plan[1].hidden).toBe(false);
        expect(plan[1].lane).not.toBe(plan[4].lane);                      // #1 moved to a free lane
        expect([plan[1], plan[2], plan[3], plan[4]].every(p => p.badge === 0)).toBe(true);
    });

    test('a cluster of 4 at one spot: top-of-list marker keeps the badge, the 4th hides', () => {
        const items = [mk(1, 200), mk(2, 205), mk(3, 210), mk(4, 215)];
        const keys = new Map([[4, 0], [1, 3], [2, 1], [3, 2]]);
        const plan = Layout.computeStripLayout(items, { keys });
        expect(plan[4]).toEqual({ lane: 2, hidden: false, badge: 1 });
        expect(plan[1].hidden).toBe(true);
    });

    test('a broken-away sub takes its due-time slot among the rows', () => {
        const items = [mk(1, 100), mk(2, 300), mk(9, 200, { parentId: 1 })];
        const keys = new Map([[1, 0], [2, 1], [9, 0.5]]);
        const plan = Layout.computeStripLayout(items, { keys });
        expect(plan[1].lane).toBe(2);
        expect(plan[9].lane).toBe(1);
        expect(plan[2].lane).toBe(0);
    });
});

describe('Layout parked-lurker pile (2026-10-13)', () => {
    const el = (parked) => ({ dataset: {}, classList: { contains: c => parked && c === 'lurker-parked' } });
    const lurker = (id, x) => ({ id, x, isOverdue: false, element: el(true) });
    const task = (id, x) => ({ id, x, isOverdue: false, element: el(false) });

    test('parked lurkers get no lane and do not take lanes from ordinary markers', () => {
        const items = [lurker(1, 50), task(2, 300), task(3, 500)];
        const plan = Layout.computeStripLayout(items, { noListOrder: true });
        expect(plan[1].lane).toBeNull();
        expect(plan[2].lane).toBe(2);
        expect(plan[3].lane).toBe(1);
    });

    test('several parked lurkers fold into the top one with a +N badge', () => {
        const items = [lurker(1, 50), lurker(2, 50), lurker(3, 50)];
        const plan = Layout.computeStripLayout(items, { keys: new Map([[2, 0], [1, 1], [3, 2]]) });
        expect(plan[2].hidden).toBe(false);
        expect(plan[2].badge).toBe(2);
        expect(plan[1].hidden).toBe(true);
        expect(plan[3].hidden).toBe(true);
    });

    test('isParkedLurker reads the lurker-parked class', () => {
        expect(Layout.isParkedLurker(lurker(1, 0))).toBe(true);
        expect(Layout.isParkedLurker(task(2, 0))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Landscape / desktop ground lanes (2026-10-13: "all zombies in the same lane")
// ---------------------------------------------------------------------------
describe('Layout ground lanes (landscape)', () => {
    const mk = (id, x, extra = {}) => ({ id, x, ...extra });
    const withEl = (item, height) => {
        item.element = { style: { height: height + 'px', top: '0px' }, offsetHeight: height };
        return item;
    };
    beforeEach(() => { Layout.applyBodyClass(fakeDoc(), fakeWin(false)); }); // strip OFF

    test('top-level items are dealt onto 3 lanes (front lane first), not one', () => {
        const items = [mk(1, 100), mk(2, 140), mk(3, 180), mk(4, 220)];
        const lanes = Layout.computeGroundLanes(items, { noListOrder: true });
        expect(lanes).toEqual({ 1: 2, 2: 1, 3: 0, 4: 2 });
        expect(new Set(Object.values(lanes)).size).toBe(3);
    });

    test('subs get no lane of their own', () => {
        const lanes = Layout.computeGroundLanes([mk(1, 100), mk(2, 100, { parentId: 1 })], { noListOrder: true });
        expect(lanes[2]).toBeUndefined();
    });

    test('lane feet spread across the band (back lane higher than front lane)', () => {
        const H = 250;
        const back = Layout.groundLaneFeet(0, H), mid = Layout.groundLaneFeet(1, H), front = Layout.groundLaneFeet(2, H);
        expect(back).toBeCloseTo(H - CONFIG.GROUND_FLOOR_HEIGHT + CONFIG.GROUND_FLOOR_FEET_TOP_PAD);
        expect(front).toBeCloseTo(H - CONFIG.GROUND_FLOOR_FEET_BOTTOM_PAD);
        expect(Layout.groundLaneFeet(0, H, { topFrac: 0.72, bottomFrac: 0.99 })).toBeCloseTo(0.72 * H); // explicit fractions still win
        expect(back).toBeLessThan(mid);
        expect(mid).toBeLessThan(front);
        expect(mid - back).toBeGreaterThanOrEqual(18); // distinct lanes: spread = (floor height - top pad - bottom pad) / 2 (2026-10-13: 20px on the 72px floor)
    });

    test('applyGroundLanes writes distinct tops per lane and bottom-aligns subs to their parent', () => {
        const items = [withEl(mk(1, 100), 128), withEl(mk(2, 140), 128), withEl(mk(3, 180), 128),
            withEl(mk(4, 100, { parentId: 1 }), 96)];
        Layout.applyGroundLanes(items, 250, { noListOrder: true });
        const tops = items.slice(0, 3).map(i => parseFloat(i.element.style.top));
        expect(new Set(tops).size).toBe(3);
        // lane 2 (front) is the lowest on screen
        expect(tops[0]).toBeGreaterThan(tops[1]);
        expect(tops[1]).toBeGreaterThan(tops[2]);
        // sub feet == parent feet
        const subFeet = parseFloat(items[3].element.style.top) + 96;
        const parentFeet = parseFloat(items[0].element.style.top) + 128;
        expect(subFeet).toBe(parentFeet);
    });

    test('overlapping zombies switch lanes instead of sharing one (2026-10-13)', () => {
        // 4th item (natural lane 2) stands 30px from #1 (lane 2): inside 60% of 128px -> moves
        const items = [mk(1, 300), mk(2, 600), mk(3, 900), mk(4, 330)];
        const lanes = Layout.computeGroundLanes(items, { noListOrder: true });
        expect(lanes[1]).toBe(2);
        expect(lanes[4]).not.toBe(2);
        // 4 zombies at the same spot (all overdue at the base): 3 lanes, the 4th stacks on its natural lane
        const pile = [mk(1, 56), mk(2, 56), mk(3, 56), mk(4, 56)];
        const pl = Layout.computeGroundLanes(pile, { noListOrder: true, baseWidth: 56 });
        expect([pl[1], pl[2], pl[3]].sort()).toEqual([0, 1, 2]);
        expect(pl[4]).toBe(2);
    });

    test('x left of the base is clamped, so an item at the base still clashes with it', () => {
        const items = [mk(1, 56), mk(2, 10)];
        const lanes = Layout.computeGroundLanes(items, { noListOrder: true, baseWidth: 56 });
        expect(lanes[1]).not.toBe(lanes[2]);
    });

    describe('with list order: lane-first layering', () => {
        const ListOrder = require('../js/listOrder.js');
        beforeAll(() => { global.ListOrder = ListOrder; });
        afterAll(() => { delete global.ListOrder; });
        const item = (id, x, mins) => {
            const z = {};
            const el = { dataset: {}, style: { height: '128px', top: '0px',
                getPropertyValue: k => z[k] || '', setProperty: (k, v) => { z[k] = v; } }, offsetHeight: 128 };
            return { id, x, dueDateTime: new Date(2026, 9, 13, 9, 0).getTime() + mins * 3600000, element: el, z };
        };

        test('front lane draws over middle over back, whatever the list row', () => {
            // rows 1-4 (due 1h apart so no tie group); x far apart -> lanes 2,1,0,2
            const items = [item(1, 300, 0), item(2, 700, 1), item(3, 1100, 2), item(4, 1500, 3)];
            Layout.applyGroundLanes(items, 250, { baseWidth: 56 });
            expect(items.map(i => i.element.dataset.lane)).toEqual(['2', '1', '0', '2']);
            const z = items.map(i => Number(i.z['--list-z']));
            expect(z[3]).toBeGreaterThan(z[1]);   // row 4 in the front lane beats row 2 in the middle lane
            expect(z[1]).toBeGreaterThan(z[2]);   // middle beats back
            expect(z[0]).toBeGreaterThan(z[3]);   // same lane: list order (row 1 over row 4)
        });

        test('the case from the phone: a later item caught up to a front-lane overdue one', () => {
            // #1 overdue at base (lane 2). #2 (middle lane) arrives at the same spot: it must draw over #3 (back lane)
            const items = [item(1, 56, 0), item(2, 56, 1), item(3, 56, 2)];
            Layout.applyGroundLanes(items, 250, { baseWidth: 56 });
            expect(items.map(i => i.element.dataset.lane)).toEqual(['2', '1', '0']);
            const z = items.map(i => Number(i.z['--list-z']));
            expect(z[0]).toBeGreaterThan(z[1]);
            expect(z[1]).toBeGreaterThan(z[2]);
        });
    });

    test('is a no-op in portrait strip mode', () => {
        Layout.applyBodyClass(fakeDoc(), fakeWin(true));
        const items = [withEl(mk(1, 100), 128)];
        Layout.applyGroundLanes(items, 250, { noListOrder: true });
        expect(items[0].element.style.top).toBe('0px');
    });

    test('writes only on change', () => {
        const items = [withEl(mk(1, 100), 128)];
        Layout.applyGroundLanes(items, 250, { noListOrder: true });
        const first = items[0].element.style.top;
        items[0].element.style.top = first; // unchanged
        Layout.applyGroundLanes(items, 250, { noListOrder: true });
        expect(items[0].element.style.top).toBe(first);
    });
});

// ---------------------------------------------------------------------------
// Day pager shares the time-slider row (2026-10-13: free vertical space)
// ---------------------------------------------------------------------------
describe('Day pager lives inside the time-slider row', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const seam = html.slice(html.indexOf('<div class="time-slider-seam">'));
    const seamBody = seam.slice(0, seam.indexOf('<!-- Bottom 40%'));

    test('prev / label / next sit inside .time-slider-seam, BEFORE the time label and slider', () => {
        const iPrev = seamBody.indexOf('id="dayPagerPrev"');
        const iLabel = seamBody.indexOf('id="dayPagerLabel"');
        const iNext = seamBody.indexOf('id="dayPagerNext"');
        const iTime = seamBody.indexOf('id="timeSliderLabel"');
        const iSlider = seamBody.indexOf('id="timeSlider"');
        expect(iPrev).toBeGreaterThan(-1);
        expect(iPrev).toBeLessThan(iLabel);
        expect(iLabel).toBeLessThan(iNext);
        expect(iNext).toBeLessThan(iTime);
        expect(iTime).toBeLessThan(iSlider);
    });

    test('the old standalone .day-pager-row is gone', () => {
        expect(html).not.toMatch(/class="day-pager-row"/);
    });
});

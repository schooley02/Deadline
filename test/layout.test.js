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

    test('desktop: first sub fans out to the right of its parent (non-zero)', () => {
        expect(Movement.getSubTaskClusterOffset(sub, { activeItems, enemyWidth: 128 })).toBeGreaterThan(0);
    });
    test('strip: offset is exactly 0', () => {
        expect(Movement.getSubTaskClusterOffset(sub, { activeItems, enemyWidth: 128, glanceStrip: true })).toBe(0);
    });
    test('strip: clustered sub lands on the parent x, not past it', () => {
        const dims = { gameScreenWidth: 390, baseWidth: 56, enemyWidth: 24, habitEnemyWidth: 24 };
        const now = new Date(2026, 9, 13, 23, 0, 0);
        parent.type = 'task'; sub.type = 'task';
        parent.dueDateTime = new Date(2026, 9, 13, 23, 55, 0);
        sub.dueDateTime = new Date(2026, 9, 13, 23, 55, 0);
        parent.x = Clock.calculateTimelinePosition(parent, now, dims);
        const x = Movement.calculateTimelineXWithClustering(sub, now, { activeItems, dims, glanceStrip: true });
        expect(x).toBe(parent.x);
    });
});

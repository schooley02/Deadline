/**
 * Movement tests (Milestone 2 extraction, 2026-07-17).
 *
 * js/movement.js references the globals CONFIG and Clock (loaded before it via
 * <script> tags in the browser). In Node we bind those globals from the real
 * modules before requiring movement.js, then exercise it directly (it has real
 * module.exports, like clock.js).
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
const Movement = require('../js/movement.js');

const DIMS = {
    gameScreenWidth: 1000,
    baseWidth: 100,
    enemyWidth: 128,
    habitEnemyWidth: 128
};

// 'relationships' has symmetric 0.047 margins → clean numbers.
// parent box 128px: visible left = 128*0.047 = 6.016, right = 128*0.953 = 121.984
// sub box 64px:     visible left = 64*0.047  = 3.008, right = 64*0.953  = 60.992
const GAP = CONFIG.SUBTASK_CLUSTER_GAP_PX; // 8

function overdue(dueOffsetMs = -1000, extra = {}) {
    return { type: 'task', dueDateTime: new Date(Date.now() + dueOffsetMs), ...extra };
}

describe('getSubTaskClusterOffset', () => {
    test('top-level item has no offset', () => {
        expect(Movement.getSubTaskClusterOffset({ id: 1 }, { activeItems: [], enemyWidth: 128 }))
            .toBe(0);
    });

    test('first sub-task sits on the right of the parent (positive offset)', () => {
        const parent = { id: 1, category: 'relationships' };
        const sub1 = { id: 2, parentId: 1, category: 'relationships' };
        const activeItems = [parent, sub1];
        const offset = Movement.getSubTaskClusterOffset(sub1, { activeItems, enemyWidth: 128 });
        // rightFrontier(121.984) + gap(8) - subLeft(3.008) = 126.976
        expect(offset).toBeCloseTo(121.984 + GAP - 3.008, 3);
        expect(offset).toBeGreaterThan(0);
    });

    test('second sub-task alternates to the left of the parent (negative offset)', () => {
        const parent = { id: 1, category: 'relationships' };
        const sub1 = { id: 2, parentId: 1, category: 'relationships' };
        const sub2 = { id: 3, parentId: 1, category: 'relationships' };
        const activeItems = [parent, sub1, sub2];
        const offset = Movement.getSubTaskClusterOffset(sub2, { activeItems, enemyWidth: 128 });
        // leftFrontier(6.016) - gap(8) - subRight(60.992) = -62.976
        expect(offset).toBeCloseTo(6.016 - GAP - 60.992, 3);
        expect(offset).toBeLessThan(0);
    });
});

describe('calculateTimelineXWithClustering', () => {
    test('top-level item returns its own timeline position (== Clock)', () => {
        const now = new Date();
        const item = overdue(-1000); // overdue → Clock returns baseWidth
        const x = Movement.calculateTimelineXWithClustering(item, now, { activeItems: [item], dims: DIMS });
        expect(x).toBe(DIMS.baseWidth);
    });

    test('sub-task whose parent is missing = own position + cluster offset', () => {
        const now = new Date();
        const sub = { id: 2, parentId: 99, category: 'relationships', type: 'task', dueDateTime: new Date(Date.now() - 1000) };
        const activeItems = [sub]; // parent id 99 absent
        const x = Movement.calculateTimelineXWithClustering(sub, now, { activeItems, dims: DIMS });
        // ownTimelineX (baseWidth=100, overdue) + offset(no parent found → parentEdges use 'other')
        const offset = Movement.getSubTaskClusterOffset(sub, { activeItems, enemyWidth: DIMS.enemyWidth });
        expect(x).toBeCloseTo(DIMS.baseWidth + offset, 6);
    });

    test('sub-task due much earlier than parent breaks from the cluster', () => {
        const now = new Date();
        const parent = { id: 1, category: 'relationships', x: 400, type: 'task', dueDateTime: new Date(Date.now() + 3600000) };
        const sub = { id: 2, parentId: 1, category: 'relationships', type: 'task', dueDateTime: new Date(Date.now() - 1000) };
        const activeItems = [parent, sub];
        // ownTimelineX = 100 (overdue); parent.x(400) - 100 = 300 > threshold(150) → returns own
        const x = Movement.calculateTimelineXWithClustering(sub, now, { activeItems, dims: DIMS });
        expect(x).toBe(DIMS.baseWidth);
    });

    test('sub-task within threshold clusters onto parent.x + offset', () => {
        const now = new Date();
        const parent = { id: 1, category: 'relationships', x: 200, type: 'task', dueDateTime: new Date(Date.now() + 3600000) };
        const sub = { id: 2, parentId: 1, category: 'relationships', type: 'task', dueDateTime: new Date(Date.now() - 1000) };
        const activeItems = [parent, sub];
        // parent.x(200) - own(100) = 100, not > 150 → parent.x + offset
        const offset = Movement.getSubTaskClusterOffset(sub, { activeItems, enemyWidth: DIMS.enemyWidth });
        const x = Movement.calculateTimelineXWithClustering(sub, now, { activeItems, dims: DIMS });
        expect(x).toBeCloseTo(200 + offset, 6);
    });
});

describe('getItemTopPosition', () => {
    test('sub-task bottom-aligns with its rendered parent', () => {
        const parent = { id: 1, element: { style: { top: '50px', height: '128px' } } };
        const sub = { id: 2, parentId: 1 };
        const top = Movement.getItemTopPosition(sub, 64, { activeItems: [parent, sub], canvasHeight: 400 });
        // parentTop(50) + (parentHeight(128) - itemHeight(64)) = 114
        expect(top).toBe(114);
    });

    test('top-level item uses injected randomFn within canvas bounds', () => {
        const item = { id: 1 };
        const top = Movement.getItemTopPosition(item, 128, { activeItems: [item], canvasHeight: 400, randomFn: () => 0.5 });
        // 0.5 * (400 - 128) = 136
        expect(top).toBe(136);
        expect(top).toBeGreaterThanOrEqual(0);
        expect(top).toBeLessThanOrEqual(400 - 128);
    });

    test('sub-task with an unrendered parent falls back to random', () => {
        const parent = { id: 1 }; // no element
        const sub = { id: 2, parentId: 1 };
        const top = Movement.getItemTopPosition(sub, 64, { activeItems: [parent, sub], canvasHeight: 400, randomFn: () => 0 });
        expect(top).toBe(0);
    });
});

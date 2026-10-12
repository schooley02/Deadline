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

// These tests pin 'relationships' to SYMMETRIC 0.047 margins so the expected
// numbers stay clean. The real value was re-measured for the animated sprites
// (P2-GAME-010 Stage 2a, 2026-10-12) and is no longer symmetric — the maths
// under test doesn't depend on the specific fractions, only on them being known.
CONFIG.ZOMBIE_VISIBLE_MARGINS.relationships = { left: 0.047, right: 0.047 };

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

    describe('left-fan off-field guard ([P1-DATA-004] sub-session 5)', () => {
        // sub2 (id 3) is the SECOND sibling → left side, negative offset
        // (mirrors the "second sub-task alternates to the left" case above).
        function leftFanSiblings(parentX) {
            const parent = { id: 1, category: 'relationships', x: parentX, type: 'task', dueDateTime: new Date(Date.now() + 3600000) };
            const sub1 = { id: 2, parentId: 1, category: 'relationships', type: 'task', dueDateTime: new Date(Date.now() + 3600000) };
            const sub2 = { id: 3, parentId: 1, category: 'relationships', type: 'task', dueDateTime: new Date(Date.now() + 3600000) };
            return { parent, sub1, sub2, activeItems: [parent, sub1, sub2] };
        }

        test('parent flush against the base: a left-fanned sub would go negative of baseWidth — clamped to baseWidth instead', () => {
            const now = new Date();
            const { sub2, activeItems } = leftFanSiblings(DIMS.baseWidth); // parent.x == baseWidth (fully arrived)
            const offset = Movement.getSubTaskClusterOffset(sub2, { activeItems, enemyWidth: DIMS.enemyWidth });
            expect(DIMS.baseWidth + offset).toBeLessThan(DIMS.baseWidth); // sanity: unclamped math WOULD go behind the base

            const x = Movement.calculateTimelineXWithClustering(sub2, now, { activeItems, dims: DIMS });
            expect(x).toBe(DIMS.baseWidth); // floored, never behind the base
        });

        test('parent well clear of the base: the same left-fanned sub is NOT clamped, offset applies normally', () => {
            const now = new Date();
            const { sub2, activeItems } = leftFanSiblings(400); // far from base — plenty of room to the left
            const offset = Movement.getSubTaskClusterOffset(sub2, { activeItems, enemyWidth: DIMS.enemyWidth });
            const x = Movement.calculateTimelineXWithClustering(sub2, now, { activeItems, dims: DIMS });
            expect(x).toBeCloseTo(400 + offset, 6);
            expect(x).toBeGreaterThan(DIMS.baseWidth);
        });

        test('right-fanned sibling (positive offset) is unaffected by the guard even at the base edge', () => {
            const now = new Date();
            const { sub1, activeItems } = leftFanSiblings(DIMS.baseWidth);
            const offset = Movement.getSubTaskClusterOffset(sub1, { activeItems, enemyWidth: DIMS.enemyWidth });
            const x = Movement.calculateTimelineXWithClustering(sub1, now, { activeItems, dims: DIMS });
            expect(x).toBeCloseTo(DIMS.baseWidth + offset, 6);
            expect(offset).toBeGreaterThan(0);
        });
    });
});

describe('getParentGrowthScale / getParentRenderWidth (growing parent visuals, [P1-DATA-004] sub-session 4)', () => {
    test('no subTasks field → scale 1 (habits, sub-tasks, or plain objects)', () => {
        expect(Movement.getParentGrowthScale({ id: 1 })).toBe(1);
        expect(Movement.getParentGrowthScale(null)).toBe(1);
    });

    test('empty subTasks → scale 1 (freshly spawned parent, no subs yet)', () => {
        expect(Movement.getParentGrowthScale({ id: 1, subTasks: [] })).toBe(1);
    });

    test('scale grows PARENT_GROWTH_PER_SUB per open sub', () => {
        expect(Movement.getParentGrowthScale({ id: 1, subTasks: ['a'] })).toBeCloseTo(1 + 1 * CONFIG.PARENT_GROWTH_PER_SUB, 6);
        expect(Movement.getParentGrowthScale({ id: 1, subTasks: ['a', 'b'] })).toBeCloseTo(1 + 2 * CONFIG.PARENT_GROWTH_PER_SUB, 6);
    });

    test('the max growth stays modest (<= +35%): just enough to read as "the parent of the small ones"', () => {
        const max = 1 + CONFIG.PARENT_GROWTH_MAX_SUBS * CONFIG.PARENT_GROWTH_PER_SUB;
        expect(max).toBeLessThanOrEqual(1.35);
        expect(max).toBeGreaterThan(1);
    });

    test('scale caps at PARENT_GROWTH_MAX_SUBS open subs', () => {
        const atCap = Movement.getParentGrowthScale({ id: 1, subTasks: ['a', 'b', 'c', 'd'] });
        const overCap = Movement.getParentGrowthScale({ id: 1, subTasks: ['a', 'b', 'c', 'd', 'e', 'f'] });
        expect(atCap).toBeCloseTo(1 + CONFIG.PARENT_GROWTH_MAX_SUBS * CONFIG.PARENT_GROWTH_PER_SUB, 6);
        expect(overCap).toBe(atCap); // extra subs beyond the cap don't grow it further
    });

    test('shrinks back down as the open array loses entries (simulates a sub completing)', () => {
        const subTasks = ['a', 'b', 'c'];
        const before = Movement.getParentGrowthScale({ id: 1, subTasks });
        subTasks.pop(); // completeItem/removeItem splice the completed/removed id out
        const after = Movement.getParentGrowthScale({ id: 1, subTasks });
        expect(before).toBeCloseTo(1 + 3 * CONFIG.PARENT_GROWTH_PER_SUB, 6);
        expect(after).toBeCloseTo(1 + 2 * CONFIG.PARENT_GROWTH_PER_SUB, 6);
        expect(after).toBeLessThan(before);
    });

    describe('smooth growth (default)', () => {
        test('getParentSpriteScale equals the raw growth scale', () => {
            const item = { id: 1, subTasks: ['a', 'b'] };
            expect(Movement.getParentSpriteScale(item)).toBe(Movement.getParentGrowthScale(item));
        });

        test('getParentRenderWidth = baseWidth * raw scale', () => {
            const w = (n) => Movement.getParentRenderWidth({ id: 1, subTasks: Array(n).fill('x') }, 128);
            expect(w(0)).toBe(128);
            expect(w(1)).toBeCloseTo(128 * (1 + CONFIG.PARENT_GROWTH_PER_SUB), 6);
            expect(w(4)).toBeCloseTo(128 * (1 + 4 * CONFIG.PARENT_GROWTH_PER_SUB), 6);
            expect(w(4)).toBeLessThanOrEqual(128 * 1.35);
        });
    });

    describe('integer snap ON (opt-in, P2-GAME-010 Stage 2a)', () => {
        let savedPerSub;
        beforeEach(() => {
            CONFIG.PARENT_GROWTH_SNAP_TO_INTEGER = true;
            savedPerSub = CONFIG.PARENT_GROWTH_PER_SUB;
            CONFIG.PARENT_GROWTH_PER_SUB = 0.15; // the old value, so a 2x step is reachable
        });
        afterEach(() => {
            CONFIG.PARENT_GROWTH_SNAP_TO_INTEGER = false;
            CONFIG.PARENT_GROWTH_PER_SUB = savedPerSub;
        });

        test('getParentSpriteScale rounds to a whole number, min 1', () => {
            const scaleFor = (n) => Movement.getParentSpriteScale({ id: 1, subTasks: Array(n).fill('x') });
            expect(scaleFor(0)).toBe(1);
            expect(scaleFor(3)).toBe(1); // 1.45
            expect(scaleFor(4)).toBe(2); // 1.60
            expect(scaleFor(9)).toBe(2); // capped
        });

        test('getParentRenderWidth = baseWidth * snapped scale', () => {
            expect(Movement.getParentRenderWidth({ id: 1, subTasks: ['a'] }, 128)).toBe(128);
            expect(Movement.getParentRenderWidth({ id: 1, subTasks: ['a', 'b', 'c', 'd'] }, 128)).toBe(256);
        });

        test('non-parents and null are scale 1', () => {
            expect(Movement.getParentSpriteScale(null)).toBe(1);
            expect(Movement.getParentSpriteScale({ id: 1 })).toBe(1);
        });
    });
});

describe('getSubTaskClusterOffset accounts for parent growth (sub-session 4)', () => {
    test('parent with 0 open subs matches the pre-growth (128px box) offset exactly', () => {
        const parent = { id: 1, category: 'relationships', subTasks: [] };
        const sub1 = { id: 2, parentId: 1, category: 'relationships' };
        const activeItems = [parent, sub1];
        const offset = Movement.getSubTaskClusterOffset(sub1, { activeItems, enemyWidth: 128 });
        expect(offset).toBeCloseTo(121.984 + GAP - 3.008, 3); // same as the ungrown-parent test above
    });

    test('parent with 2 open subs: fan attaches to the GROWN visible edge, not the fixed 128px one', () => {
        const scale = 1 + 2 * CONFIG.PARENT_GROWTH_PER_SUB;
        const visibleRight = 128 * scale * 0.953; // relationships right margin pinned to 0.047 above
        const parent = { id: 1, category: 'relationships', subTasks: ['x', 'y'] };
        const sub1 = { id: 2, parentId: 1, category: 'relationships' };
        const offset = Movement.getSubTaskClusterOffset(sub1, { activeItems: [parent, sub1], enemyWidth: 128 });
        expect(offset).toBeCloseTo(visibleRight + GAP - 3.008, 3);
        // and it's meaningfully further out than the ungrown case — proves scaling actually applies
        expect(offset).toBeGreaterThan(121.984 + GAP - 3.008);
    });

    test('snap ON (old 0.15/sub): 1-3 open subs leave the offset identical to an ungrown parent', () => {
        CONFIG.PARENT_GROWTH_SNAP_TO_INTEGER = true;
        const saved = CONFIG.PARENT_GROWTH_PER_SUB;
        CONFIG.PARENT_GROWTH_PER_SUB = 0.15;
        try {
            const sub1 = { id: 2, parentId: 1, category: 'relationships' };
            const ungrown = Movement.getSubTaskClusterOffset(sub1, { activeItems: [{ id: 1, category: 'relationships', subTasks: [] }, sub1], enemyWidth: 128 });
            const at3 = Movement.getSubTaskClusterOffset(sub1, { activeItems: [{ id: 1, category: 'relationships', subTasks: ['a', 'b', 'c'] }, sub1], enemyWidth: 128 });
            expect(at3).toBeCloseTo(ungrown, 6);
        } finally {
            CONFIG.PARENT_GROWTH_SNAP_TO_INTEGER = false;
            CONFIG.PARENT_GROWTH_PER_SUB = saved;
        }
    });

    test('growth is capped: 4 and 6 open subs produce the identical offset', () => {
        const sub1 = { id: 2, parentId: 1, category: 'relationships' };
        const parentAt4 = { id: 1, category: 'relationships', subTasks: ['a', 'b', 'c', 'd'] };
        const parentAt6 = { id: 1, category: 'relationships', subTasks: ['a', 'b', 'c', 'd', 'e', 'f'] };
        const offsetAt4 = Movement.getSubTaskClusterOffset(sub1, { activeItems: [parentAt4, sub1], enemyWidth: 128 });
        const offsetAt6 = Movement.getSubTaskClusterOffset(sub1, { activeItems: [parentAt6, sub1], enemyWidth: 128 });
        expect(offsetAt4).toBeCloseTo(offsetAt6, 6);
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

    test('top-level item lands feet in the ground band (mid-jitter)', () => {
        const item = { id: 1 };
        const top = Movement.getItemTopPosition(item, 128, { activeItems: [item], canvasHeight: 400, randomFn: () => 0.5 });
        // feetTop = 0.85*400 = 340, feetBottom = 0.99*400 = 396
        // feet = 340 + 0.5*(396-340) = 368 → top = 368 - 128 = 240
        expect(top).toBe(240);
        expect(top).toBeGreaterThanOrEqual(0);
        expect(top).toBeLessThanOrEqual(400 - 128);
    });

    test('top-level item feet stay within the ground band across the full jitter range', () => {
        const item = { id: 1 };
        const H = 400;
        const itemH = 128;
        const feetTop = CONFIG.GROUND_BAND_FEET_TOP_FRAC * H;      // 340
        const feetBottom = CONFIG.GROUND_BAND_FEET_BOTTOM_FRAC * H; // 396
        // randomFn=0 → feet at the band top (highest); =1 → feet at band bottom (lowest)
        const topAtBandTop = Movement.getItemTopPosition(item, itemH, { activeItems: [item], canvasHeight: H, randomFn: () => 0 });
        const topAtBandBottom = Movement.getItemTopPosition(item, itemH, { activeItems: [item], canvasHeight: H, randomFn: () => 1 });
        expect(topAtBandTop + itemH).toBeCloseTo(feetTop, 6);      // feet at fence line
        expect(topAtBandBottom + itemH).toBeCloseTo(feetBottom, 6); // feet near canvas floor
        // Lower feet (larger random) means a larger top value (further down).
        expect(topAtBandBottom).toBeGreaterThan(topAtBandTop);
    });

    test('sub-task with an unrendered parent falls back to the ground band', () => {
        const parent = { id: 1 }; // no element
        const sub = { id: 2, parentId: 1 };
        const top = Movement.getItemTopPosition(sub, 64, { activeItems: [parent, sub], canvasHeight: 400, randomFn: () => 0 });
        // feetTop = 340 → top = 340 - 64 = 276
        expect(top).toBe(276);
    });
});

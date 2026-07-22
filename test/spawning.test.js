/**
 * Spawning tests (Milestone 2 extraction, 2026-07-17).
 *
 * Covers the pure resolveEnemyVisual (sprite size + CSS-class selection). The
 * DOM-orchestrating addItemToGame is exercised via live playtest, not unit
 * tests, since it's DOM-heavy — see docs/ARCHITECTURE.md.
 */
const Spawning = require('../js/spawning.js');

const DIMS = {
    enemyWidth: 128,
    habitEnemyWidth: 128,
    subtaskEnemyWidth: 64,
    habitStreakBonusThreshold: 3,
    habitStreakStrongThreshold: 7
};

describe('resolveEnemyVisual', () => {
    test('always includes the base sprite classes', () => {
        const { classes } = Spawning.resolveEnemyVisual({ type: 'task', category: 'career' }, DIMS);
        expect(classes).toEqual(expect.arrayContaining(['enemy', 'category-career', 'zombie-sprite', 'zombie-career']));
    });

    test('sub-task uses the subtask size + classes', () => {
        const { width, height, classes } = Spawning.resolveEnemyVisual(
            { type: 'task', category: 'health', parentId: 7, isHighPriority: false }, DIMS);
        expect(width).toBe(64);
        expect(height).toBe(64);
        expect(classes).toEqual(expect.arrayContaining(['subtask-enemy', 'zombie-subtask']));
    });

    test('high-priority is orthogonal to the subtask branch (matches original addItemToGame)', () => {
        // The original code's high-priority block runs independently of the
        // parentId sizing block, so a high-priority sub-task keeps BOTH.
        const { classes } = Spawning.resolveEnemyVisual(
            { type: 'task', category: 'health', parentId: 7, isHighPriority: true }, DIMS);
        expect(classes).toEqual(expect.arrayContaining(['subtask-enemy', 'high-priority']));
    });

    test('normal task is full size with no priority class', () => {
        const { width, height, classes } = Spawning.resolveEnemyVisual(
            { type: 'task', category: 'other', isHighPriority: false }, DIMS);
        expect(width).toBe(128);
        expect(height).toBe(128);
        expect(classes).not.toContain('high-priority');
    });

    // [P1-DATA-004] sub-session 4, 2026-07-19 — growing/shrinking parent
    // visuals: only a top-level task can grow, so only it gets the CSS hook
    // (enemySprites.css's .enemy.parent-scaled) that scales the background
    // sprite with the box instead of the legacy fixed 128px.
    test('a top-level task gets the parent-scaled class', () => {
        const { classes } = Spawning.resolveEnemyVisual(
            { type: 'task', category: 'other', isHighPriority: false }, DIMS);
        expect(classes).toContain('parent-scaled');
    });

    test('a sub-task does NOT get parent-scaled (it never grows)', () => {
        const { classes } = Spawning.resolveEnemyVisual(
            { type: 'task', category: 'health', parentId: 7 }, DIMS);
        expect(classes).not.toContain('parent-scaled');
    });

    test('a habit does NOT get parent-scaled (it never grows)', () => {
        const { classes } = Spawning.resolveEnemyVisual(
            { type: 'habit', category: 'health', streak: 0 }, DIMS);
        expect(classes).not.toContain('parent-scaled');
    });

    test('high-priority task gets the high-priority class', () => {
        const { classes } = Spawning.resolveEnemyVisual(
            { type: 'task', category: 'career', isHighPriority: true }, DIMS);
        expect(classes).toContain('high-priority');
    });

    // 2026-07-21 (docs/DECISIONS.md): habits render at the same regular size
    // as tasks now — 'zombie-small' (the old 70px shrink hook) is retired.
    test('habit gets the habit-enemy class at regular (task) size, no shrink class', () => {
        const { width, height, classes } = Spawning.resolveEnemyVisual(
            { type: 'habit', category: 'health', streak: 0 }, DIMS);
        expect(width).toBe(128);
        expect(height).toBe(128);
        expect(classes).toContain('habit-enemy');
        expect(classes).not.toContain('zombie-small');
        expect(classes).not.toContain('negative-habit');
        expect(classes).not.toContain('high-streak');
    });

    test('negative habit adds negative-habit', () => {
        const { classes } = Spawning.resolveEnemyVisual(
            { type: 'habit', category: 'health', isNegative: true, streak: 0 }, DIMS);
        expect(classes).toContain('negative-habit');
    });

    test('habit at/above the streak threshold adds high-streak', () => {
        const at = Spawning.resolveEnemyVisual({ type: 'habit', category: 'health', streak: 3 }, DIMS);
        expect(at.classes).toContain('high-streak');
        const below = Spawning.resolveEnemyVisual({ type: 'habit', category: 'health', streak: 2 }, DIMS);
        expect(below.classes).not.toContain('high-streak');
    });

    // [P2-UI-009] Milestone 4, session 59 — second, stronger visual tier.
    describe('super-streak (stronger tier)', () => {
        test('below the base threshold: neither class', () => {
            const { classes } = Spawning.resolveEnemyVisual({ type: 'habit', category: 'health', streak: 2 }, DIMS);
            expect(classes).not.toContain('high-streak');
            expect(classes).not.toContain('super-streak');
        });

        test('between the base and strong threshold: high-streak only', () => {
            const { classes } = Spawning.resolveEnemyVisual({ type: 'habit', category: 'health', streak: 5 }, DIMS);
            expect(classes).toContain('high-streak');
            expect(classes).not.toContain('super-streak');
        });

        test('at/above the strong threshold: BOTH classes (additive, not exclusive)', () => {
            const at = Spawning.resolveEnemyVisual({ type: 'habit', category: 'health', streak: 7 }, DIMS);
            expect(at.classes).toContain('high-streak');
            expect(at.classes).toContain('super-streak');

            const above = Spawning.resolveEnemyVisual({ type: 'habit', category: 'health', streak: 12 }, DIMS);
            expect(above.classes).toContain('high-streak');
            expect(above.classes).toContain('super-streak');
        });

        test('a missing habitStreakStrongThreshold in dims never adds super-streak (defensive)', () => {
            const dimsNoStrong = { ...DIMS, habitStreakStrongThreshold: undefined };
            const { classes } = Spawning.resolveEnemyVisual({ type: 'habit', category: 'health', streak: 99 }, dimsNoStrong);
            expect(classes).not.toContain('super-streak');
        });
    });
});

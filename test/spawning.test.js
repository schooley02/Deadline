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
    habitStreakBonusThreshold: 3
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

    test('high-priority task gets the high-priority class', () => {
        const { classes } = Spawning.resolveEnemyVisual(
            { type: 'task', category: 'career', isHighPriority: true }, DIMS);
        expect(classes).toContain('high-priority');
    });

    test('habit gets habit + small classes at habit width', () => {
        const { width, height, classes } = Spawning.resolveEnemyVisual(
            { type: 'habit', category: 'health', streak: 0 }, DIMS);
        expect(width).toBe(128);
        expect(height).toBe(128);
        expect(classes).toEqual(expect.arrayContaining(['habit-enemy', 'zombie-small']));
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
});

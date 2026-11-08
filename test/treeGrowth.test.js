/**
 * TreeGrowth (2026-11-08): the growing tree's pure rule. Lifetime nights = banked + the live run (0 once the game is over);
 * stage = sapling / young / giant at CONFIG.TREE_STAGE_NIGHTS [30, 100]; history only seeds the bank for an older save.
 */
const TreeGrowth = require('../js/treeGrowth.js');
const CONFIG = require('../js/config.js');

const T = CONFIG.TREE_STAGE_NIGHTS;

describe('stage', () => {
    test('the first values are 30 and 100 (Jeremy, 2026-11-08)', () => {
        expect(T).toEqual([30, 100]);
    });
    test.each([[0, 1], [1, 1], [29, 1], [30, 2], [31, 2], [99, 2], [100, 3], [101, 3], [5000, 3]])('%i nights -> stage %i', (n, s) => {
        expect(TreeGrowth.stage(n, T)).toBe(s);
    });
    test('bad input is a sapling, never a throw', () => {
        [undefined, null, NaN, -5, 'x', {}].forEach((v) => expect(TreeGrowth.stage(v, T)).toBe(1));
    });
    test('missing or broken thresholds fall back to 30 / 100; a giant threshold at or under the young one is lifted above it', () => {
        expect(TreeGrowth.stage(30, undefined)).toBe(2);
        expect(TreeGrowth.stage(100, null)).toBe(3);
        expect(TreeGrowth.stage(10, [10, 5])).toBe(2);
        expect(TreeGrowth.stage(11, [10, 5])).toBe(3);
    });
    test('fractions floor (a night is whole)', () => {
        expect(TreeGrowth.stage(29.9, T)).toBe(1);
    });
});

describe('total', () => {
    test('banked + the live run', () => {
        expect(TreeGrowth.total(20, 5, false)).toBe(25);
        expect(TreeGrowth.total(0, 0, false)).toBe(0);
    });
    test('the live run counts for 0 once the game is over (it is already banked)', () => {
        expect(TreeGrowth.total(25, 5, true)).toBe(25);
    });
    test('the total never drops across game over and Restart', () => {
        // run of 12 nights ends: before game over banked 40 + live 12; at game over the bank takes the 12 and the live run stops counting;
        // after Restart the live run is 0
        const before = TreeGrowth.total(40, 12, false);
        const atGameOver = TreeGrowth.total(40 + 12, 12, true);
        const afterRestart = TreeGrowth.total(40 + 12, 0, false);
        expect(atGameOver).toBe(before);
        expect(afterRestart).toBe(before);
    });
    test('bad input counts as 0', () => {
        expect(TreeGrowth.total(undefined, undefined, false)).toBe(0);
        expect(TreeGrowth.total(NaN, -3, false)).toBe(0);
        expect(TreeGrowth.total('7', null, false)).toBe(0);
    });
});

describe('nightsToNext', () => {
    test('counts down to the next stage, null at the giant', () => {
        expect(TreeGrowth.nightsToNext(0, T)).toBe(30);
        expect(TreeGrowth.nightsToNext(29, T)).toBe(1);
        expect(TreeGrowth.nightsToNext(30, T)).toBe(70);
        expect(TreeGrowth.nightsToNext(99, T)).toBe(1);
        expect(TreeGrowth.nightsToNext(100, T)).toBeNull();
    });
});

describe('seedBanked', () => {
    test('sums the nights of every run in history', () => {
        expect(TreeGrowth.seedBanked([{ daysSurvived: 12 }, { daysSurvived: 3 }, { daysSurvived: 0 }])).toBe(15);
    });
    test('records without a night count, bad records and a missing history add nothing', () => {
        expect(TreeGrowth.seedBanked([{ run: 1 }, null, 'x', { daysSurvived: 'many' }, { daysSurvived: -4 }, { daysSurvived: 2 }])).toBe(2);
        expect(TreeGrowth.seedBanked(undefined)).toBe(0);
        expect(TreeGrowth.seedBanked([])).toBe(0);
    });
});

describe('resolve (the ?treeStage= dev override)', () => {
    test('no param keeps the real stage', () => {
        expect(TreeGrowth.resolve('', 2)).toBe(2);
        expect(TreeGrowth.resolve('?x=1', 3)).toBe(3);
        expect(TreeGrowth.resolve(undefined, 1)).toBe(1);
    });
    test('1..3 pins the stage, larger numbers clamp to the giant', () => {
        expect(TreeGrowth.resolve('?treeStage=1', 3)).toBe(1);
        expect(TreeGrowth.resolve('?a=b&treeStage=2', 1)).toBe(2);
        expect(TreeGrowth.resolve('?treeStage=3', 1)).toBe(3);
        expect(TreeGrowth.resolve('?treeStage=9', 1)).toBe(3);
    });
    test('off / none hides the tree', () => {
        expect(TreeGrowth.resolve('?treeStage=off', 2)).toBeNull();
        expect(TreeGrowth.resolve('?treeStage=NONE', 2)).toBeNull();
    });
    test('junk falls back to the real stage; an impossible real stage hides', () => {
        expect(TreeGrowth.resolve('?treeStage=abc', 2)).toBe(2);
        expect(TreeGrowth.resolve('?treeStage=', 2)).toBe(2);
        expect(TreeGrowth.resolve('?treeStage=0', 2)).toBe(2);
        expect(TreeGrowth.resolve('', 7)).toBeNull();
    });
});

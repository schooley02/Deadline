/**
 * Progression tests (Milestone 2 extraction, 2026-07-18).
 *
 * js/progression.js is pure — no CONFIG global, no DOM — so it's required
 * directly and exercised with both the real CONFIG tables and small
 * hand-built tables (to make multi-level-up and clamp scenarios easy to
 * construct without needing huge XP numbers).
 */
const Progression = require('../js/progression.js');
const CONFIG = require('../js/config.js');

describe('checkLevelUp — no threshold crossed', () => {
    test('returns leveledUp: false when xp is below the next threshold', () => {
        const result = Progression.checkLevelUp(
            { level: 1, xp: 50, slots: 1 },
            CONFIG.LEVEL_XP_THRESHOLDS, CONFIG.ROUTINE_SLOTS_PER_LEVEL, CONFIG.LEVEL_XP_THRESHOLDS.length
        );
        expect(result.leveledUp).toBe(false);
        expect(result.levelsGained).toBe(0);
        expect(result.level).toBe(1);
        expect(result.slots).toBe(1);
        expect(result.slotsUnlocked).toBe(false);
    });

    test('exact threshold value DOES level up (>= comparison)', () => {
        // LEVEL_XP_THRESHOLDS[1] === 100
        const result = Progression.checkLevelUp(
            { level: 1, xp: 100, slots: 1 },
            CONFIG.LEVEL_XP_THRESHOLDS, CONFIG.ROUTINE_SLOTS_PER_LEVEL, CONFIG.LEVEL_XP_THRESHOLDS.length
        );
        expect(result.leveledUp).toBe(true);
        expect(result.level).toBe(2);
    });
});

describe('checkLevelUp — single level-up', () => {
    test('advances one level and reports it', () => {
        const result = Progression.checkLevelUp(
            { level: 1, xp: 150, slots: 1 },
            CONFIG.LEVEL_XP_THRESHOLDS, CONFIG.ROUTINE_SLOTS_PER_LEVEL, CONFIG.LEVEL_XP_THRESHOLDS.length
        );
        expect(result.level).toBe(2);
        expect(result.levelsGained).toBe(1);
        expect(result.leveledUp).toBe(true);
    });

    test('does not unlock a slot when the new level grants no MORE slots than currently held', () => {
        // level 1->2: ROUTINE_SLOTS_PER_LEVEL[2] === 1, same as starting slots
        const result = Progression.checkLevelUp(
            { level: 1, xp: 150, slots: 1 },
            CONFIG.LEVEL_XP_THRESHOLDS, CONFIG.ROUTINE_SLOTS_PER_LEVEL, CONFIG.LEVEL_XP_THRESHOLDS.length
        );
        expect(result.slotsUnlocked).toBe(false);
        expect(result.slots).toBe(1);
    });

    test('unlocks a slot when the new level grants more than currently held', () => {
        // level 2->3: ROUTINE_SLOTS_PER_LEVEL[3] === 2, up from 1
        const result = Progression.checkLevelUp(
            { level: 2, xp: 250, slots: 1 },
            CONFIG.LEVEL_XP_THRESHOLDS, CONFIG.ROUTINE_SLOTS_PER_LEVEL, CONFIG.LEVEL_XP_THRESHOLDS.length
        );
        expect(result.level).toBe(3);
        expect(result.slotsUnlocked).toBe(true);
        expect(result.slots).toBe(2);
    });
});

describe('checkLevelUp — multiple level-ups in one call', () => {
    test('walks every crossed threshold, not just the first', () => {
        // A big XP reward can cross several thresholds at once (e.g. a large
        // completion granting more XP than one level requires).
        const thresholds = [0, 100, 200, 300, 400];
        const slotsPerLevel = { 1: 1, 2: 1, 3: 2, 4: 2 };
        const result = Progression.checkLevelUp(
            { level: 1, xp: 350, slots: 1 },
            thresholds, slotsPerLevel, thresholds.length
        );
        expect(result.level).toBe(4);
        expect(result.levelsGained).toBe(3);
        expect(result.leveledUp).toBe(true);
    });

    test('unlocks the HIGHEST slot count crossed, not just the first level gained', () => {
        const thresholds = [0, 100, 200, 300, 400];
        const slotsPerLevel = { 1: 1, 2: 1, 3: 2, 4: 3 };
        const result = Progression.checkLevelUp(
            { level: 1, xp: 350, slots: 1 },
            thresholds, slotsPerLevel, thresholds.length
        );
        expect(result.slots).toBe(3);
        expect(result.slotsUnlocked).toBe(true);
    });
});

describe('checkLevelUp — max level clamp', () => {
    test('does not advance past the last threshold entry', () => {
        const maxLevel = CONFIG.LEVEL_XP_THRESHOLDS.length; // 9
        const result = Progression.checkLevelUp(
            { level: maxLevel, xp: 999999, slots: 4 },
            CONFIG.LEVEL_XP_THRESHOLDS, CONFIG.ROUTINE_SLOTS_PER_LEVEL, maxLevel
        );
        expect(result.leveledUp).toBe(false);
        expect(result.level).toBe(maxLevel);
    });

    test('stops exactly at max level even with huge overflow xp', () => {
        const thresholds = [0, 100, 200];
        const result = Progression.checkLevelUp(
            { level: 1, xp: 999999, slots: 1 },
            thresholds, { 1: 1, 2: 1, 3: 2 }, thresholds.length
        );
        expect(result.level).toBe(thresholds.length);
        expect(result.levelsGained).toBe(thresholds.length - 1);
    });
});

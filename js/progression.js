/**
 * Progression — XP levels + routine-slot unlocks (Milestone 2 extraction, 2026-07-18).
 *
 * Pure level-up math extracted from script.js's checkPlayerLevelUp(). Same
 * pattern as clock.js/damage.js: no DOM, no closures over script.js state —
 * everything comes in as explicit arguments and a plain result object comes
 * back. script.js keeps a thin wrapper that applies the result to its own
 * playerLevel/routineSlots and drives the DOM side effects (updatePlayerDisplays,
 * showLevelUpMessage, updateRoutineDisplay) — those stay in script.js because
 * they touch playerXP/playerPoints display together and playerPoints is
 * economy.js's future scope (Milestone 3, shop not built yet — see
 * docs/DECISIONS.md 2026-07-18), not progression's.
 *
 * A single completeItem() call can cross more than one level threshold at
 * once (e.g. a big XP reward on someone sitting just under two thresholds),
 * so this walks the threshold table in a loop rather than checking once —
 * mirrors the recursive checkPlayerLevelUp() call in the original code.
 *
 * Usage (see script.js):
 *   Progression.checkLevelUp(
 *     { level: playerLevel, xp: playerXP, slots: routineSlots },
 *     LEVEL_XP_THRESHOLDS, ROUTINE_SLOTS_PER_LEVEL, MAX_PLAYER_LEVEL
 *   )
 *   -> { level, slots, leveledUp, levelsGained, slotsUnlocked }
 */
const Progression = (() => {
    // thresholds[level] = XP needed to advance FROM `level` TO `level + 1`.
    // maxLevel = thresholds.length (no threshold exists past the last entry).
    function checkLevelUp(state, thresholds, slotsPerLevel, maxLevel) {
        let { level, xp, slots } = state;
        let levelsGained = 0;
        let slotsUnlocked = false;

        while (level < maxLevel && thresholds[level] !== undefined && xp >= thresholds[level]) {
            level++;
            levelsGained++;

            if (slotsPerLevel[level] && slotsPerLevel[level] > slots) {
                slots = slotsPerLevel[level];
                slotsUnlocked = true;
            }
        }

        return {
            level,
            slots,
            leveledUp: levelsGained > 0,
            levelsGained,
            slotsUnlocked,
        };
    }

    return {
        checkLevelUp,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Progression;
}

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
 *
 * LEVEL PERKS (docs/LEVEL_PERKS_PLAN.md, 2026-10-23): the helpers below read
 * CONFIG.LEVEL_PERKS (passed in as `table`, never read as a global) —
 * perksForLevels (what a level-up just granted), shopDiscount (derived from
 * the CURRENT level every call, never persisted), titleForLevel (cosmetic),
 * xpProgress / nextSlotUnlock (display math for the level panel).
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

    /**
     * Perks granted by crossing from `fromLevel` up to `toLevel` (exclusive of
     * fromLevel, inclusive of toLevel) — a single XP award can jump several
     * levels, and every level crossed pays out. Each returned perk is a copy
     * with `level` added. Unknown levels / non-array entries are skipped.
     */
    function perksForLevels(table, fromLevel, toLevel) {
        const out = [];
        if (!table) return out;
        for (let lv = fromLevel + 1; lv <= toLevel; lv++) {
            const perks = table[lv];
            if (!Array.isArray(perks)) continue;
            perks.forEach(p => out.push(Object.assign({}, p, { level: lv })));
        }
        return out;
    }

    /**
     * Shop price discount (0..1) for a player at `level`: the discount perk at
     * the HIGHEST level reached wins — discounts REPLACE, they don't stack
     * (Lv8's 20% supersedes Lv4's 10%). 0 when no discount perk is reached.
     */
    function shopDiscount(table, level) {
        if (!table) return 0;
        let best = 0;
        let bestLevel = -1;
        Object.keys(table).forEach(k => {
            const lv = Number(k);
            if (lv > level || lv <= bestLevel || !Array.isArray(table[k])) return;
            const d = table[k].find(p => p && p.type === 'discount' && typeof p.value === 'number');
            if (d) { best = Math.min(1, Math.max(0, d.value)); bestLevel = lv; }
        });
        return best;
    }

    /**
     * The cosmetic title perk the player has earned at `level` (highest level
     * at or below it that carries one), or null. Run records store the peak
     * level, so a past run's card can ask "which title did that run earn?".
     */
    function titleForLevel(table, level) {
        if (!table || typeof level !== 'number') return null;
        let found = null;
        let foundLevel = -1;
        Object.keys(table).forEach(k => {
            const lv = Number(k);
            if (lv > level || lv <= foundLevel || !Array.isArray(table[k])) return;
            const t = table[k].find(p => p && p.type === 'title');
            if (t) { found = Object.assign({}, t, { level: lv }); foundLevel = lv; }
        });
        return found;
    }

    /**
     * Progress through the CURRENT level, for an XP bar. thresholds are
     * cumulative XP totals (see checkLevelUp), so level L spans
     * thresholds[L-1] .. thresholds[L]. At max level (no next threshold) the
     * bar is full: { maxed: true, pct: 1, needed: 0 }.
     */
    function xpProgress(xp, thresholds, level) {
        const floor = thresholds[level - 1];
        const next = thresholds[level];
        if (next === undefined || floor === undefined) {
            return { into: 0, needed: 0, pct: 1, maxed: true };
        }
        const needed = next - floor;
        const into = Math.min(needed, Math.max(0, xp - floor));
        return { into, needed, pct: needed > 0 ? into / needed : 1, maxed: false };
    }

    // Routine slots at `level` — the value at the highest table key <= level
    // (1 if the table is empty), so a level with no entry carries the last
    // value forward instead of reading as "no slots".
    function slotsAtLevel(slotsPerLevel, level) {
        let best = 1;
        let bestLevel = -1;
        Object.keys(slotsPerLevel || {}).forEach(k => {
            const lv = Number(k);
            if (lv <= level && lv > bestLevel) { best = slotsPerLevel[k]; bestLevel = lv; }
        });
        return best;
    }

    /**
     * The next level above `level` that adds a routine slot, as
     * { level, slots }, or null if the player already has the most slots the
     * table ever grants.
     */
    function nextSlotUnlock(slotsPerLevel, level) {
        const have = slotsAtLevel(slotsPerLevel, level);
        const levels = Object.keys(slotsPerLevel || {}).map(Number).filter(lv => lv > level).sort((a, b) => a - b);
        for (const lv of levels) {
            if (slotsPerLevel[lv] > have) return { level: lv, slots: slotsPerLevel[lv] };
        }
        return null;
    }

    return {
        checkLevelUp,
        perksForLevels,
        shopDiscount,
        titleForLevel,
        xpProgress,
        slotsAtLevel,
        nextSlotUnlock,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Progression;
}

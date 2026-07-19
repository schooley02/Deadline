/**
 * Heroes — routine XP/level/health/star-rating pure core ([P1-UI-006]
 * sub-session 1, 2026-07-19 session 41; see docs/HEROES_PLAN.md).
 *
 * Routines are "Heroes" living in the Base (docs/ROUTINES.md). This module is
 * the INVISIBLE mechanics layer: per-routine XP + levels (member-slot
 * unlocks), completion-rate star ratings (PROJECT_SPEC ~78-83), and the
 * routine-health math that sub-session 2 wires to the damage paths. Rendering
 * is sub-session 3's `js/ui/heroes.js` — nothing here touches the DOM.
 *
 * Same pattern as progression.js/habits.js: pure functions, explicit args,
 * plain result objects. Callers own all mutation and side effects.
 *
 * Level semantics MIRROR the player's (progression.js): thresholds[level] =
 * XP needed to advance FROM `level` TO `level + 1`; maxLevel =
 * thresholds.length. ONE deliberate divergence: a routine's level is DERIVED
 * from its XP (levelForXp) rather than monotonic like the player's — an XP
 * refund (uncompletion) can de-level a routine. This makes
 * complete→uncomplete a perfect round-trip by construction (the
 * recompute-then-pop discipline habits.js's rate bonus established after the
 * streak-bonus asymmetry bug). Slot enforcement consequences of de-leveling
 * are sub-session 4's grandfathering problem, not this module's.
 *
 * Star ratings (PROJECT_SPEC ~78-83, fixed spec values in
 * CONFIG.HERO_STAR_TIERS): completion rate over the routine's HABIT members'
 * recorded occurrences since max(routine.createdAt, runStartedAtMs). Routine
 * TASKS are deliberately EXCLUDED from the v1 rate: habit occurrenceHistory
 * is the only honest, complete record — routine-task misses are recorded
 * nowhere (rollover drops them without a trace), so any task denominator
 * would be reconstructed guesswork. Logged in DECISIONS.md session 41;
 * revisit when run history lands.
 */
const Heroes = (() => {
    // XP a routine earns when one of its member items is completed.
    function xpAmountFor(itemType, config) {
        return itemType === 'task'
            ? config.ROUTINE_XP_PER_TASK
            : config.ROUTINE_XP_PER_HABIT;
    }

    // Level DERIVED from xp by walking the threshold table (same table
    // semantics as progression.js's checkLevelUp, but stateless).
    function levelForXp(xp, thresholds) {
        let level = 1;
        const maxLevel = thresholds.length;
        while (level < maxLevel && thresholds[level] !== undefined && xp >= thresholds[level]) {
            level++;
        }
        return level;
    }

    // Apply an XP delta (positive award, negative refund) and derive the new
    // level. XP floors at 0. `levelsGained` is negative on a de-level.
    function applyXpDelta(currentXp, delta, thresholds) {
        const levelBefore = levelForXp(currentXp, thresholds);
        const xp = Math.max(0, currentXp + delta);
        const level = levelForXp(xp, thresholds);
        return {
            xp,
            level,
            leveledUp: level > levelBefore,
            levelsGained: level - levelBefore,
        };
    }

    // Member slots unlocked at a routine level (docs/ROUTINES.md: "Routine
    // starts at level 1 with 1 habit slot + 1 task slot; each level unlocks
    // more slots" — spec gives no numbers; +1 of each per level is the
    // cheapest symmetric reading, revisit with play data). Enforcement is
    // sub-session 4; this is just the math.
    function slotsForLevel(level, config) {
        const extraLevels = Math.max(0, level - 1);
        return {
            habitSlots: config.ROUTINE_HABIT_SLOTS_BASE + extraLevels * config.ROUTINE_SLOTS_PER_LEVEL_GAIN,
            taskSlots: config.ROUTINE_TASK_SLOTS_BASE + extraLevels * config.ROUTINE_SLOTS_PER_LEVEL_GAIN,
        };
    }

    // 'YYYY-MM-DD' for a ms timestamp, LOCAL time (matches
    // Habits.toOccurrenceDate's local-date discipline — occurrence entries
    // are local calendar days, so the window boundary must be too).
    function toLocalDateStr(ms) {
        const d = new Date(ms);
        const pad = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    /**
     * Completion rate over the routine's habit members' recorded occurrences
     * on/after windowStartMs (= max(routine.createdAt, runStartedAtMs),
     * computed by the caller). Occurrence dates are 'YYYY-MM-DD' strings, so
     * the comparison is a lexicographic date-string compare (safe for ISO
     * dates). Excused days (cheat/sick/skip) recorded nothing, so they're
     * transparent here too — same principle as the freeze counts.
     *
     * Membership: habitDef.routineId (the canonical owner field) OR presence
     * in routine.habitDefinitionIds — belt and suspenders, matching the
     * spawn-selection gate's tolerance of either linkage.
     *
     * Returns { rate, samples }: rate is null when samples === 0 (a brand-new
     * routine is UNRATED, not 0%).
     */
    function completionRate(routine, definedHabits, windowStartMs) {
        const memberIds = new Set(routine.habitDefinitionIds || []);
        const windowStart = toLocalDateStr(windowStartMs);
        let successes = 0;
        let samples = 0;

        (definedHabits || []).forEach(def => {
            if (def.routineId !== routine.id && !memberIds.has(def.id)) return;
            (def.occurrenceHistory || []).forEach(entry => {
                if (!entry || typeof entry.date !== 'string') return;
                if (entry.date < windowStart) return;
                samples++;
                if (entry.success) successes++;
            });
        });

        return {
            rate: samples === 0 ? null : successes / samples,
            samples,
        };
    }

    // Star rating for a completion rate. Tiers checked high-to-low, first
    // match wins (same shape discipline as CONFIG.HABIT_RATE_TIERS). A null
    // rate (no samples yet) or a rate below the lowest tier is 0 stars.
    function starRating(rate, tiers) {
        if (rate === null || rate === undefined) return 0;
        for (const tier of tiers) {
            if (rate >= tier.minRate) return tier.stars;
        }
        return 0;
    }

    // --- Routine health math (pure only — NOTHING calls these until
    // sub-session 2 wires the damage paths; see docs/HEROES_PLAN.md fork 2:
    // health 0 = KO -> auto-deactivate, next-day revive at
    // CONFIG.HERO_REVIVE_HEALTH). ---
    function applyRoutineDamage(health, amount) {
        return Math.max(0, health - amount);
    }

    function shouldKo(health) {
        return health <= 0;
    }

    return {
        xpAmountFor,
        levelForXp,
        applyXpDelta,
        slotsForLevel,
        completionRate,
        starRating,
        applyRoutineDamage,
        shouldKo,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Heroes;
}

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
 * Star ratings (PROJECT_SPEC ~78-83, fixed rate cutoffs in
 * CONFIG.HERO_STAR_TIERS): a ROLLING window (CONFIG.HERO_STAR_RATE_WINDOW)
 * of the routine's HABIT members' most recent recorded occurrences since
 * max(routine.createdAt, runStartedAtMs), gated by a SEPARATE minDays tenure
 * requirement per tier (2026-07-21 redesign — see docs/DECISIONS.md,
 * docs/ROUTINES.md; fixes the bug where completing one habit once produced
 * a 100% rate that instantly cleared the top tier). Routine TASKS are
 * deliberately EXCLUDED from the v1 rate: habit occurrenceHistory is the
 * only honest, complete record — routine-task misses are recorded nowhere
 * (rollover drops them without a trace), so any task denominator would be
 * reconstructed guesswork. Logged in DECISIONS.md session 41; revisit when
 * run history lands.
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

    // --- Member slots — BANKED SLOT POINTS (sub-session 4, 2026-07-19;
    // forks resolved post-session-43 discussion, see DECISIONS.md/
    // HEROES_PLAN.md). SUPERSEDES the old symmetric +1 habit/+1 task per
    // level (formerly `slotsForLevel`, retired — see DECISIONS.md): baseline
    // at level 1 is 1 habit + 1 task slot; each level-up from 2-9 deposits
    // ONE point into a shared pool, spent on EITHER a habit or a task slot
    // at add-time (js/ui/routineViews.js's ensureRoutineSlotAvailable).
    //
    // DELIBERATE DEVIATION from the plan text's literal schema note ("needs
    // routine.slotPoints (int)"): available points are DERIVED from
    // routine.level, not stored/incremented. The only persisted state is
    // what's actually been SPENT (routine.boughtHabitSlots/boughtTaskSlots)
    // — mirrors this module's existing "level derived from xp" discipline.
    // A stored, incrementally-updated pool would let a player farm points:
    // level up (deposit), spend, uncomplete to de-level (pool clamps at 0,
    // fine), then re-complete back to the SAME level (deposit AGAIN — a
    // second point for a level you already banked one for). Deriving from
    // the current level closes that hole for free: totalSlotPointsEarned
    // only ever reflects the routine's CURRENT level, so revisiting a level
    // never re-mints a point. Spent points are never clawed back on a
    // de-level (nothing evicts an already-unlocked member) — "strand
    // harmlessly", per the plan's recommendation.
    function totalSlotPointsEarned(level, config) {
        return Math.max(0, Math.min(config.ROUTINE_MAX_SLOT_POINTS, (level || 1) - 1));
    }

    function availableSlotPoints(routine, config) {
        const earned = totalSlotPointsEarned(routine.level, config);
        const spent = (routine.boughtHabitSlots || 0) + (routine.boughtTaskSlots || 0);
        return Math.max(0, earned - spent);
    }

    // Current unlocked capacity for one slot type ('habit' | 'task').
    function slotCapacity(routine, itemType, config) {
        return itemType === 'task'
            ? config.ROUTINE_TASK_SLOTS_BASE + (routine.boughtTaskSlots || 0)
            : config.ROUTINE_HABIT_SLOTS_BASE + (routine.boughtHabitSlots || 0);
    }

    // Pure "try to spend one point" — caller applies the mutation from the
    // result (matches shop.js's purchase/consume pattern: pure in, result
    // object out, no argument mutation).
    //   { ok: true, boughtHabitSlots, boughtTaskSlots }
    //   { ok: false, reason: 'no_points' }
    function spendSlotPoint(routine, itemType, config) {
        if (availableSlotPoints(routine, config) <= 0) {
            return { ok: false, reason: 'no_points' };
        }
        const boughtHabitSlots = routine.boughtHabitSlots || 0;
        const boughtTaskSlots = routine.boughtTaskSlots || 0;
        return {
            ok: true,
            boughtHabitSlots: itemType === 'task' ? boughtHabitSlots : boughtHabitSlots + 1,
            boughtTaskSlots: itemType === 'task' ? boughtTaskSlots + 1 : boughtTaskSlots,
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
     * Completion rate + tenure over the routine's habit members' recorded
     * occurrences on/after windowStartMs (= max(routine.createdAt,
     * runStartedAtMs), computed by the caller). Occurrence dates are
     * 'YYYY-MM-DD' strings, so the comparison is a lexicographic date-string
     * compare (safe for ISO dates). Excused days (cheat/sick/skip) recorded
     * nothing, so they're transparent here too — same principle as the
     * freeze counts.
     *
     * Membership: habitDef.routineId (the canonical owner field) OR presence
     * in routine.habitDefinitionIds — belt and suspenders, matching the
     * spawn-selection gate's tolerance of either linkage.
     *
     * 2026-07-21 redesign (docs/DECISIONS.md, docs/ROUTINES.md — fixes the
     * "one habit, one completion, instant 5★" bug): the RATE is now a
     * ROLLING window of at most `rateWindowSize` occurrences (most recent
     * first, merged across every member habit and sorted chronologically —
     * a routine with several habits doesn't get a stale rate just because
     * one habit's history is longer than another's), not an all-time
     * average. `distinctDays` is a SEPARATE tenure count — the number of
     * distinct calendar days (since windowStartMs) with at least one
     * recorded occurrence — deliberately NOT limited to the rolling rate
     * window, since it exists purely to gate how much track record backs
     * the rate (see starRating below). Omitting rateWindowSize (or passing a
     * non-positive number) preserves the old all-time-average behavior.
     *
     * Returns { rate, samples, distinctDays }: rate is null when samples
     * === 0 (a brand-new routine is UNRATED, not 0%); samples is the count
     * actually used for the rate (<= rateWindowSize).
     */
    function completionRate(routine, definedHabits, windowStartMs, rateWindowSize) {
        const memberIds = new Set(routine.habitDefinitionIds || []);
        const windowStart = toLocalDateStr(windowStartMs);
        const entries = [];

        (definedHabits || []).forEach(def => {
            if (def.routineId !== routine.id && !memberIds.has(def.id)) return;
            (def.occurrenceHistory || []).forEach(entry => {
                if (!entry || typeof entry.date !== 'string') return;
                if (entry.date < windowStart) return;
                entries.push(entry);
            });
        });

        const distinctDays = new Set(entries.map(e => e.date)).size;

        const sorted = entries.slice().sort((a, b) => {
            if (a.date < b.date) return -1;
            if (a.date > b.date) return 1;
            return 0;
        });
        const windowSize = (typeof rateWindowSize === 'number' && rateWindowSize > 0)
            ? rateWindowSize
            : Infinity;
        const windowed = windowSize === Infinity ? sorted : sorted.slice(-windowSize);

        const samples = windowed.length;
        const successes = windowed.reduce((sum, e) => sum + (e.success ? 1 : 0), 0);

        return {
            rate: samples === 0 ? null : successes / samples,
            samples,
            distinctDays,
        };
    }

    // Star rating for a completion rate. BOTH minRate (over the caller's
    // rolling window) AND minDays (distinctDays — the tenure gate added
    // 2026-07-21, see completionRate above) must be met; tiers checked
    // high-to-low, first match wins (same shape discipline as
    // CONFIG.HABIT_RATE_TIERS). A null rate (no samples yet) is 0 stars.
    // SIGNATURE CHANGED 2026-07-21 (was `starRating(rate, tiers)`, 2 args) —
    // every in-repo caller/collaborator was updated to the new 3-arg form in
    // the same session (see docs/DECISIONS.md). A non-numeric distinctDays
    // is treated as 0 (never clears any real tier's minDays) rather than
    // throwing, in case anything still passes it loosely.
    function starRating(rate, distinctDays, tiers) {
        if (rate === null || rate === undefined) return 0;
        const days = (typeof distinctDays === 'number') ? distinctDays : 0;
        for (const tier of tiers) {
            if (rate >= tier.minRate && days >= (tier.minDays || 0)) return tier.stars;
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
        totalSlotPointsEarned,
        availableSlotPoints,
        slotCapacity,
        spendSlotPoint,
        completionRate,
        starRating,
        applyRoutineDamage,
        shouldKo,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Heroes;
}

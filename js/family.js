/**
 * Family damage -- a parent and its sub-tasks attack as ONE group (docs/FAMILY_DAMAGE_PLAN.md, DESIGNED + approved 2026-11-11,
 * Jeremy: "three tiers of damage based on how many active subtasks ... match the damage to the visuals of many enemies").
 *
 * PURE: no DOM, no globals except an optional CONFIG fallback. Theme-free (Baseline engine rule): it counts attackers, never art.
 *   - A family = a parent plus every item whose `parentId` is that parent. An item with no sub-tasks is a family of one.
 *   - Tier = how many family members are attacking RIGHT NOW (at the church: overdue, not a lurker / ghost, not completed, not
 *     iced). 1-2 attackers -> x1.0, 3-4 -> x1.5, 5+ -> x2.0 (CONFIG.FAMILY_TIER_*). Sub-tasks that only exist, or are due later,
 *     never count.
 *   - A work timer running on ANY member halves the whole family (CONFIG.WORK_TIMER_DAMAGE_FACTOR), live loop only: offline and
 *     live-gap catch-up ignore timers (and ice) exactly as before.
 *   - Damage is whole points per hit, so the family rate is set by stretching each member's hit interval: with n attackers and a
 *     family multiplier m, every member swings every base * n / m ms. The family then lands m hits per base interval in total, and
 *     its members' own damage clocks (set by their due times) make them take turns.
 */
const Family = (() => {
    const DEFAULTS = {
        FAMILY_TIER_2_AT: 3, FAMILY_TIER_3_AT: 5,
        FAMILY_DAMAGE_TIER_2: 1.5, FAMILY_DAMAGE_TIER_3: 2.0,
        WORK_TIMER_DAMAGE_FACTOR: 0.5,
    };
    function cfg(key, c) {
        const src = c || (typeof CONFIG !== 'undefined' ? CONFIG : DEFAULTS);
        return typeof src[key] === 'number' ? src[key] : DEFAULTS[key];
    }

    function rootId(item) {
        return item && item.parentId ? item.parentId : (item ? item.id : undefined);
    }
    function members(items, item) {
        const root = rootId(item);
        return (items || []).filter(i => i && !i.completedAt && (i.id === root || i.parentId === root));
    }
    function defaultLurker(item) {
        return item.type === 'habit' && item.isNegative === true;
    }
    function timerRunning(item) {
        return !!(item && item.timer && typeof item.timer.startedAt === 'number');
    }

    /** Family members attacking now. opts: { isLurker(item), isIced(item), isAttacking(item) } (all optional; isAttacking defaults to `isOverdue`, catch-up passes a due-time test). */
    function attackers(items, item, opts) {
        const o = opts || {};
        const lurker = o.isLurker || defaultLurker;
        const there = o.isAttacking || (i => i.isOverdue === true);
        return members(items, item).filter(i =>
            there(i) && i.koGhost !== true && !lurker(i) && !(o.isIced && o.isIced(i)));
    }

    /** Damage multiplier for n attackers: 1 / 1.5 / 2 by default. */
    function tierMultiplier(n, c) {
        if (n >= cfg('FAMILY_TIER_3_AT', c)) return cfg('FAMILY_DAMAGE_TIER_3', c);
        if (n >= cfg('FAMILY_TIER_2_AT', c)) return cfg('FAMILY_DAMAGE_TIER_2', c);
        return 1;
    }
    function tier(n, c) {
        if (n >= cfg('FAMILY_TIER_3_AT', c)) return 3;
        if (n >= cfg('FAMILY_TIER_2_AT', c)) return 2;
        return 1;
    }

    /** True when a work timer runs on any family member. */
    function timerOn(items, item) {
        return members(items, item).some(timerRunning);
    }

    /**
     * This member's hit interval (ms).
     * opts: { timers: true to apply the family timer halving (live loop only), isIced, isLurker }.
     */
    function intervalMs(item, items, baseMs, opts, c) {
        const o = opts || {};
        const n = Math.max(1, attackers(items, item, o).length);
        let mult = tierMultiplier(n, c);
        if (o.timers && timerOn(items, item)) {
            const f = cfg('WORK_TIMER_DAMAGE_FACTOR', c);
            if (f > 0 && f < 1) mult *= f;
        }
        return Math.round(baseMs * n / mult);
    }

    return { rootId, members, attackers, tierMultiplier, tier, timerOn, intervalMs };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Family;
}

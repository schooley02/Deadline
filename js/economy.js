/**
 * Economy — points math + shop pricing (Milestone 3, [P1-DATA-007], 2026-07-18).
 *
 * The canonical home for points/currency logic per docs/ARCHITECTURE.md's
 * target layout (progression.js deliberately left playerPoints behind for
 * this module). Same pattern as progression.js/habits.js: pure functions,
 * no DOM, no closures over script.js state. playerPoints OWNERSHIP stays in
 * script.js (accessor-deps pattern) — this module only computes.
 *
 * Scope now: task point awards (the high-priority ×2 rule, previously
 * duplicated inline in items.js's complete + uncomplete paths), the
 * balance-floor rule for refunds, and the shop's exponential pricing
 * formula from docs/ECONOMY.md (price = base × 1.5^owned) so the
 * Milestone 3 shop builds on a tested core.
 *
 * Habit points stay in habits.js (rate-multiplier logic is habit state
 * math); economy just receives the computed amounts.
 *
 * NOTE on the zero floor: subtractPoints clamps at 0 — used for uncompletion
 * refunds, which always keep the floor. Negative-habit indulgence
 * ([P1-DATA-005] sub-session 3, 2026-07-19) uses the dedicated non-clamping
 * applyIndulgenceCost below instead, per docs/ECONOMY.md's "balances CAN go
 * negative" rule — debt is a deliberate consequence of indulgence, not
 * something to floor away.
 */
const Economy = (() => {
    // Points awarded for completing a task. High-priority tasks award double
    // (the only difficulty scaling that exists today; docs/ECONOMY.md's
    // "more points for larger tasks" is future scope with sub-task hierarchy).
    function taskPoints(isHighPriority, pointsPerTask) {
        return isHighPriority ? pointsPerTask * 2 : pointsPerTask;
    }

    // Add earned points to a balance.
    function addPoints(current, amount) {
        return current + amount;
    }

    // Remove points (uncompletion refund), floored at 0 — see NOTE above.
    function subtractPoints(current, amount) {
        return Math.max(0, current - amount);
    }

    // Non-clamping debit for negative-habit indulgence ([P1-DATA-005]
    // sub-session 3) — the balance CAN go negative (debt), per
    // docs/ECONOMY.md. Deliberately a separate function from subtractPoints
    // rather than a flag: refunds (uncompletion) must NEVER go negative, so
    // keeping two named functions makes each call site's floor behavior
    // obvious at the call site instead of depending on a boolean argument.
    function applyIndulgenceCost(current, amount) {
        return current - amount;
    }

    // Shop pricing (docs/ECONOMY.md): price = baseCost × 1.5^quantityOwned,
    // rounded to whole points. Unlimited scaling by design (anti-abuse).
    //
    // Optional `discount` (0..1, LEVEL PERKS 2026-10-23 — Progression.shopDiscount
    // of the current level) multiplies the price by (1 − discount), rounded ONCE
    // at the end, floor of 1 pt so a discounted item is never free. discount 0
    // / omitted is byte-identical to the pre-perk formula.
    function shopPrice(baseCost, quantityOwned, discount) {
        const raw = baseCost * Math.pow(1.5, quantityOwned);
        if (typeof discount === 'number' && discount > 0) {
            return Math.max(1, Math.round(raw * (1 - Math.min(1, discount))));
        }
        return Math.round(raw);
    }

    // ---- Distance-priced rescheduling (Build 2, 2026-10-25; docs/ECONOMY.md
    // "Rescheduling price", docs/DESIGN_QUESTIONS_KO_EDIT_TIMER.md Q2) ----
    // Moving a task's due time LATER costs the pushback tier for the distance moved,
    // measured from the later of its current due and now (rounded UP to the next tier; beyond the largest tier, whole multiples of it)
    // x a factor for the urgency zone of the time left to the CURRENT due at save
    // time. Pure: the caller supplies the zone (Clock.getWalkUrgencyTier, with null
    // = 'overdue'), the tiers, factors and the weekly free-use count.
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    // Pushback tiers ({ pushbackMs, baseCost }, ascending) from the shop catalog.
    function reschedulePriceTiers(shopItems) {
        return (shopItems || [])
            .filter(i => i && i.category === 'pushback' && i.effect && i.effect.pushbackMs > 0)
            .map(i => ({ pushbackMs: i.effect.pushbackMs, baseCost: i.baseCost }))
            .sort((a, b) => a.pushbackMs - b.pushbackMs);
    }

    // Free paid-zone reschedules are a rolling 7-day allowance of timestamps (ms
    // or ISO). Pruned copy / remaining count; never mutate the input.
    function pruneRescheduleFreeUses(uses, nowMs) {
        return (Array.isArray(uses) ? uses : [])
            .map(t => (typeof t === 'number' ? t : Date.parse(t)))
            .filter(ms => isFinite(ms) && nowMs - ms >= 0 && nowMs - ms < WEEK_MS);
    }
    function rescheduleFreeUsesLeft(uses, nowMs, perWeek) {
        return Math.max(0, (perWeek || 0) - pruneRescheduleFreeUses(uses, nowMs).length);
    }

    // opts: { currentDue, newDue, now (Date), createdAt (Date|ms|null),
    //         zone: 'calm'|'approaching'|'urgent'|'overdue', tiers, zoneFactors,
    //         graceMs, freeUsesLeft, discount }
    // -> { later, cost, free, reason, consumesFreeUse }
    //   reason: 'not-later' | 'grace' | 'calm' | 'weekly' | 'paid'
    function reschedulePrice(opts) {
        const currentMs = opts.currentDue.getTime();
        const newMs = opts.newDue.getTime();
        const later = newMs > currentMs;
        if (!later) return { later: false, cost: 0, free: true, reason: 'not-later', consumesFreeUse: false };

        const nowMs = opts.now.getTime();
        const createdMs = opts.createdAt == null ? null
            : (opts.createdAt instanceof Date ? opts.createdAt.getTime() : Number(opts.createdAt));
        if (createdMs !== null && isFinite(createdMs) && nowMs - createdMs <= (opts.graceMs || 0)) {
            return { later: true, cost: 0, free: true, reason: 'grace', consumesFreeUse: false };
        }

        const factors = opts.zoneFactors || {};
        const factor = typeof factors[opts.zone] === 'number' ? factors[opts.zone] : 1;
        if (factor <= 0) return { later: true, cost: 0, free: true, reason: 'calm', consumesFreeUse: false };

        const tiers = opts.tiers || [];
        if (tiers.length === 0) return { later: true, cost: 0, free: true, reason: 'calm', consumesFreeUse: false };
        // Distance is measured from the later of the current due and now
        // (2026-10-26, Jeremy): an overdue item moved to 1 h from now is a 1 hr
        // pushback, not (hours overdue + 1 h). Same rule as the shop pushback.
        const delta = Math.max(0, newMs - Math.max(currentMs, nowMs));
        const fit = tiers.find(t => t.pushbackMs >= delta);
        let tierCost;
        if (fit) {
            tierCost = fit.baseCost;
        } else {
            const top = tiers[tiers.length - 1];
            tierCost = top.baseCost * Math.ceil(delta / top.pushbackMs);
        }
        const discount = typeof opts.discount === 'number' ? Math.min(1, Math.max(0, opts.discount)) : 0;
        const cost = Math.max(1, Math.round(tierCost * factor * (1 - discount)));

        if ((opts.freeUsesLeft || 0) > 0) {
            return { later: true, cost: 0, free: true, reason: 'weekly', consumesFreeUse: true };
        }
        return { later: true, cost, free: false, reason: 'paid', consumesFreeUse: false };
    }

    return {
        taskPoints,
        addPoints,
        subtractPoints,
        applyIndulgenceCost,
        shopPrice,
        reschedulePriceTiers,
        pruneRescheduleFreeUses,
        rescheduleFreeUsesLeft,
        reschedulePrice,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Economy;
}

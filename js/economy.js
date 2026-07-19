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
 * NOTE on the zero floor: subtractPoints clamps at 0 today. docs/ECONOMY.md
 * says balances CAN go negative — but only via negative-habit indulgence,
 * which is unbuilt [P1-DATA-005]. When that lands, indulgence should use a
 * dedicated non-clamping path (or a config flag here); uncompletion refunds
 * keep the floor regardless.
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

    // Shop pricing (docs/ECONOMY.md): price = baseCost × 1.5^quantityOwned,
    // rounded to whole points. Unlimited scaling by design (anti-abuse).
    function shopPrice(baseCost, quantityOwned) {
        return Math.round(baseCost * Math.pow(1.5, quantityOwned));
    }

    return {
        taskPoints,
        addPoints,
        subtractPoints,
        shopPrice,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Economy;
}

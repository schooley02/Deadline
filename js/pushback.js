/**
 * Pushback — free pushback CHARGES, overflow payment and the free-move rules
 * (docs/PUSHBACK_CHARGES_PLAN.md, designed + balanced 2026-11-02; Build A).
 *
 * Pure functions, no DOM, no state: the caller supplies the sizes
 * (CONFIG.PUSHBACK_SIZES), the allowance table (CONFIG.PUSHBACK_ALLOWANCE),
 * use timestamps, balances and prices. NOT wired into the game yet — Build B
 * routes the zombie popup, the edit form and the Base Health panel through it
 * and retires Economy.reschedulePrice.
 *
 * The model: moving a due time LATER while a zombie is close (the current due
 * is 4 h away or less, or overdue) uses a pushback. Free first (a refilling
 * per-size allowance: daily for short/medium, rolling 7 days for long), then a
 * held token of that size, then points. Everything else is free.
 *
 *   isFreeMove  -> is this move free, and why / how far was it?
 *   sizeFor     -> which size (and how many) covers a distance?
 *   chargesLeft -> free charges left per size
 *   allowanceForStar -> the free allowance a Clock tower star level gives
 *   resolvePayment   -> charge | token | points | blocked, with the breakdown
 */
const Pushback = (() => {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    function num(v) {
        const n = typeof v === 'number' ? v : Number(v);
        return isFinite(n) ? n : 0;
    }

    function toMs(t) {
        if (t == null) return null;
        if (t instanceof Date) return t.getTime();
        if (typeof t === 'number') return isFinite(t) ? t : null;
        const ms = Date.parse(t);
        return isFinite(ms) ? ms : null;
    }

    // A copy of the sizes sorted ascending by ms; unusable rows dropped.
    function sortedSizes(sizes) {
        return (Array.isArray(sizes) ? sizes : [])
            .filter(s => s && typeof s.id === 'string' && s.ms > 0)
            .slice()
            .sort((a, b) => a.ms - b.ms);
    }

    // Which size covers a distance (ms the due time moves later, measured from
    // the later of the current due and now), and how many of it.
    //   <= smallest size  -> that size x1 (a later move always costs at least
    //                        the smallest, including a move that stays in the past)
    //   fits a size       -> the SMALLEST size that covers it, x1 (exact = covered)
    //   beyond the largest-> ceil(distance / largest) of the largest
    // Negative, NaN or no sizes -> null.
    function sizeFor(deltaMs, sizes) {
        const list = sortedSizes(sizes);
        if (list.length === 0 || typeof deltaMs !== 'number' || isNaN(deltaMs) || deltaMs < 0) return null;
        const fit = list.find(s => s.ms >= deltaMs);
        if (fit) return { size: fit.id, count: 1 };
        const top = list[list.length - 1];
        return { size: top.id, count: Math.ceil(deltaMs / top.ms) };
    }

    // Is moving a due time free, and why?
    // opts: { currentDue, newDue, now (Date|ms), createdAt (Date|ms|ISO|null),
    //         graceMs, paidZoneMs }
    // -> { later, free, reason, deltaMs, paidZone }
    //   reason: 'not-later' (earlier or equal) | 'grace' (within graceMs of
    //           creating the item) | 'calm' (current due more than paidZoneMs away)
    //           | 'paid' (a pushback is needed)
    //   deltaMs: distance from the later of current due and now (>= 0), when later
    //   paidZone: true only for 'paid'. Build B sets the item's pushedLate flag
    //           from it: grace and calm moves never flag the item.
    function isFreeMove(opts) {
        const o = opts || {};
        const currentMs = toMs(o.currentDue);
        const newMs = toMs(o.newDue);
        const nowMs = toMs(o.now);
        if (currentMs === null || newMs === null || nowMs === null || !(newMs > currentMs)) {
            return { later: false, free: true, reason: 'not-later', deltaMs: 0, paidZone: false };
        }
        const deltaMs = Math.max(0, newMs - Math.max(currentMs, nowMs));
        const createdMs = toMs(o.createdAt);
        if (createdMs !== null && nowMs - createdMs <= num(o.graceMs)) {
            return { later: true, free: true, reason: 'grace', deltaMs, paidZone: false };
        }
        // "4 hours or less" (or overdue) is the paid zone, so exactly the limit is paid.
        if (currentMs - nowMs > num(o.paidZoneMs)) {
            return { later: true, free: true, reason: 'calm', deltaMs, paidZone: false };
        }
        return { later: true, free: false, reason: 'paid', deltaMs, paidZone: true };
    }

    // The free allowance for a Clock tower star level: { short, medium, long }.
    // `table` is CONFIG.PUSHBACK_ALLOWANCE (keyed 1..5). A star below 1 or not a
    // number is treated as 1; above the top key, the top key. Returns a copy.
    function allowanceForStar(star, table) {
        const keys = Object.keys(table || {}).map(Number).filter(k => isFinite(k)).sort((a, b) => a - b);
        if (keys.length === 0) return { short: 0, medium: 0, long: 0 };
        let s = Math.floor(Number(star));
        if (!isFinite(s) || s < keys[0]) s = keys[0];
        if (s > keys[keys.length - 1]) s = keys[keys.length - 1];
        // Missing key in the middle: step down to the nearest defined one.
        while (!table[s] && s > keys[0]) s -= 1;
        return Object.assign({ short: 0, medium: 0, long: 0 }, table[s]);
    }

    // Free charges left per size.
    //   uses      { short: [ts], medium: [ts], long: [ts] } (ms or ISO); absent = none
    //   allowance { short, medium, long } (allowanceForStar)
    //   dayStartMs start of the current day (daily charges count uses at or after it)
    //   sizes     CONFIG.PUSHBACK_SIZES (each size's `window`: 'day' | 'week')
    // Daily uses count from dayStartMs; weekly uses are a rolling 7 days ending at
    // nowMs. A use stamped in the future never counts. Never mutates the input.
    function chargesLeft(uses, nowMs, allowance, dayStartMs, sizes) {
        const out = {};
        sortedSizes(sizes).forEach(s => {
            const stamps = uses && Array.isArray(uses[s.id]) ? uses[s.id] : [];
            const used = stamps.map(toMs).filter(ms => {
                if (ms === null || ms > nowMs) return false;
                return s.window === 'week' ? nowMs - ms < WEEK_MS : ms >= dayStartMs;
            }).length;
            out[s.id] = Math.max(0, num(allowance && allowance[s.id]) - used);
        });
        return out;
    }

    // How one move is paid for: each of `count` units of the size uses, in order,
    // a free charge, then a held token, then points.
    // opts: { size, count, chargesLeft (of this size), held (tokens of this size),
    //         points (balance), price (points per unit, discount already applied) }
    // -> { ok, kind, size, count, charges, tokens, pointUnits, cost }
    //   kind: the LAST source the move reached: 'charge' | 'token' | 'points', or
    //         'blocked' (ok false) when the points cover less than the points part.
    //   A blocked result still shows what the move would need (cost / pointUnits)
    //   but nothing is spent; the caller applies charges/tokens/cost only when ok.
    function resolvePayment(opts) {
        const o = opts || {};
        const count = Math.max(0, Math.floor(num(o.count)));
        const charges = Math.min(count, Math.max(0, Math.floor(num(o.chargesLeft))));
        let remaining = count - charges;
        const tokens = Math.min(remaining, Math.max(0, Math.floor(num(o.held))));
        remaining -= tokens;
        const pointUnits = remaining;
        const price = typeof o.price === 'number' && isFinite(o.price) && o.price >= 0 ? o.price : Infinity;
        const cost = pointUnits > 0 ? pointUnits * price : 0;
        const base = { size: o.size, count, charges, tokens, pointUnits, cost };
        if (pointUnits > 0) {
            if (!isFinite(cost) || cost > num(o.points)) return Object.assign({ ok: false, kind: 'blocked' }, base);
            return Object.assign({ ok: true, kind: 'points' }, base);
        }
        return Object.assign({ ok: true, kind: tokens > 0 ? 'token' : 'charge' }, base);
    }

    return {
        sizeFor,
        isFreeMove,
        allowanceForStar,
        chargesLeft,
        resolvePayment,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Pushback;
}

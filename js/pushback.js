/**
 * Pushback — free pushback CHARGES, overflow payment and the free-move rules
 * (docs/PUSHBACK_CHARGES_PLAN.md, designed + balanced 2026-11-02; Build A).
 *
 * Pure functions, no DOM, no state: the caller supplies the sizes
 * (CONFIG.PUSHBACK_SIZES), the allowance table (CONFIG.PUSHBACK_ALLOWANCE),
 * use timestamps, balances and prices. Build B routes the zombie popup, the
 * edit form and the Base Health panel through quote() / apply() (script.js is
 * the thin adapter that reads live state); Economy.reschedulePrice is retired.
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
 *   quote       -> one call: is this move free, else which size and how it is paid
 *   quoteFixed  -> the same for a popup button ("push back by <size>")
 *   apply       -> what a successful quote changes (new uses, tokens, points, flag)
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

    // "+30 min" / "+2 hr" / "+1 day": the short label of a size's length, for buttons.
    function plusLabel(ms) {
        const m = Math.round(num(ms) / 60000);
        if (m < 60) return `+${m} min`;
        const h = Math.round(m / 6) / 10; // one decimal
        if (h < 24) return `+${h} hr`;
        const d = Math.round(h / 2.4) / 10;
        return `+${d} day${d === 1 ? '' : 's'}`;
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

    // The full answer for a due-time move, in one call (Build B).
    // opts: { currentDue, newDue, now, createdAt, graceMs, paidZoneMs,   (isFreeMove)
    //         sizes, allowance, uses, dayStartMs,                        (chargesLeft)
    //         held: { short, medium, long } tokens held,
    //         points (balance), prices: { short, medium, long } points per unit }
    // -> everything isFreeMove returns, plus
    //    { size, count, left, kind, ok, canAfford, charges, tokens, pointUnits, cost }
    //   A free move (not later, grace, calm): kind 'free', ok, cost 0, size null.
    //   A paid-zone move: size/count from sizeFor(deltaMs) and the payment from
    //   resolvePayment (kind 'charge' | 'token' | 'points' | 'blocked').
    //   `left` = free charges left per size BEFORE this move.
    function quote(opts) {
        const o = opts || {};
        const nowMs = toMs(o.now);
        const move = isFreeMove(o);
        const left = chargesLeft(o.uses, nowMs === null ? 0 : nowMs, o.allowance, num(o.dayStartMs), o.sizes);
        const base = Object.assign({}, move, {
            size: null, count: 0, left, kind: 'free', ok: true, canAfford: true,
            charges: 0, tokens: 0, pointUnits: 0, cost: 0,
        });
        if (move.free) return base;
        const fit = sizeFor(move.deltaMs, o.sizes);
        if (!fit) return base;
        const held = o.held || {};
        const prices = o.prices || {};
        const pay = resolvePayment({
            size: fit.size, count: fit.count,
            chargesLeft: left[fit.size], held: held[fit.size],
            points: o.points, price: prices[fit.size],
        });
        return Object.assign(base, {
            size: pay.size, count: pay.count, kind: pay.kind, ok: pay.ok, canAfford: pay.ok,
            charges: pay.charges, tokens: pay.tokens, pointUnits: pay.pointUnits, cost: pay.cost,
        });
    }

    // A popup button: "push back by one <sizeId>". The new due is the later of the
    // current due and now, plus that size, then quote() decides free vs paid.
    // opts as quote() minus newDue. An unknown size -> null.
    function quoteFixed(sizeId, opts) {
        const o = opts || {};
        const size = sortedSizes(o.sizes).find(s => s.id === sizeId);
        const currentMs = toMs(o.currentDue);
        const nowMs = toMs(o.now);
        if (!size || currentMs === null || nowMs === null) return null;
        const newDue = new Date(Math.max(currentMs, nowMs) + size.ms);
        return quote(Object.assign({}, o, { newDue }));
    }

    // What a successful quote changes. Pure: returns the new use stamps and the
    // amounts to take, the caller writes them to state.
    //   -> { ok, uses, chargesUsed: {size:n}, tokensUsed: {size:n}, pointsSpent, pushedLate }
    //   Use stamps are plain ms numbers, one per free charge spent; stamps older
    //   than 7 days are dropped (neither window can still count them).
    //   pushedLate is true for every paid-zone move (charge, token or points);
    //   grace and calm moves never flag. A not-ok quote -> { ok: false }.
    function apply(q, opts) {
        if (!q || !q.ok) return { ok: false };
        const o = opts || {};
        const nowMs = toMs(o.now);
        const uses = {};
        sortedSizes(o.sizes).forEach(s => {
            const stamps = o.uses && Array.isArray(o.uses[s.id]) ? o.uses[s.id] : [];
            uses[s.id] = stamps.map(toMs).filter(ms => ms !== null && nowMs !== null && ms <= nowMs && nowMs - ms < WEEK_MS);
        });
        const chargesUsed = {};
        const tokensUsed = {};
        if (q.size && q.charges > 0) {
            for (let i = 0; i < q.charges; i++) uses[q.size].push(nowMs);
            chargesUsed[q.size] = q.charges;
        }
        if (q.size && q.tokens > 0) tokensUsed[q.size] = q.tokens;
        return {
            ok: true, uses, chargesUsed, tokensUsed,
            pointsSpent: q.cost > 0 ? q.cost : 0,
            pushedLate: q.paidZone === true,
        };
    }

    return {
        sizeFor,
        plusLabel,
        isFreeMove,
        allowanceForStar,
        chargesLeft,
        resolvePayment,
        quote,
        quoteFixed,
        apply,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Pushback;
}

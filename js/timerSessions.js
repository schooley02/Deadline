/**
 * Timer sessions -- the pure core (Build A, 2026-11-04; docs/TIMER_SESSIONS_PLAN.md).
 *
 * Every Stop / Pause / auto-stop banks one SESSION on the item: `item.timerSessions = [{ start, end, attack }]`
 * (ms epoch, oldest first). `attack` = the windows [from, to] inside the session when the zombie was attacking WHILE the
 * timer ran, i.e. when the timer was halving its damage. Time that has no start / stop (everything banked before sessions
 * existed, a typed total, a span under a second) lives in ONE untimed number, `item.timerUntimedMs`.
 *
 * INVARIANT: `item.timerMsBanked` (the field everything else reads) = sum of (end - start) + `timerUntimedMs`.
 * Old items are normalised lazily (`ensure`): nothing is rewritten at load.
 *
 * Editing is one-way for damage: shortening or deleting a session takes back the halved damage for the removed minutes
 * that overlapped an attack window (`chargeHp`, 1 HP per interval / (1 - factor) = 10 min). Lengthening or adding never
 * refunds. The caller applies the HP charge (capped by `capCharge`, the 1 HP floor) and the per-day record fixes.
 *
 * PURE: no DOM, no state; CONFIG is an optional global (defaults mirror it). Day attribution (Jeremy, 2026-11-04): a session
 * that crosses local midnight is SPLIT across the days it covers (`splitByDay`), for the live record and for every edit.
 */
const TimerSessions = (() => {
    const MIN = 60 * 1000;
    const MAX_TOTAL_MS = 24 * 60 * MIN;     // the same 24 h cap as Timer.MAX_LOGGED_MS
    const MIN_SESSION_MS = 1000;            // a shorter span is banked but kept in the untimed entry (no empty row)
    const DEFAULTS = { DAMAGE_INTERVAL_MS: 5 * MIN, WORK_TIMER_DAMAGE_FACTOR: 0.5, LIVE_GAP_THRESHOLD_MS: 30 * 1000 };
    function cfg(key, c) {
        const src = c || (typeof CONFIG !== 'undefined' ? CONFIG : DEFAULTS);
        return typeof src[key] === 'number' ? src[key] : DEFAULTS[key];
    }

    const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

    // ---- windows ------------------------------------------------------------------------------------------------
    // Keep only well-formed [from, to] pairs, clipped to [lo, hi], in order.
    function clipWindows(windows, lo, hi) {
        const out = [];
        (Array.isArray(windows) ? windows : []).forEach((w) => {
            if (!Array.isArray(w) || !isNum(w[0]) || !isNum(w[1])) return;
            const a = Math.max(lo, w[0]), b = Math.min(hi, w[1]);
            if (b > a) out.push([a, b]);
        });
        return out.sort((x, y) => x[0] - y[0]);
    }
    function overlapMs(a0, a1, b0, b1) {
        return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
    }
    // The parts of [old0, old1] that [new0, new1] no longer covers (0, 1 or 2 intervals).
    function subtract(old0, old1, new0, new1) {
        if (new1 <= old0 || new0 >= old1) return [[old0, old1]];
        const out = [];
        if (new0 > old0) out.push([old0, new0]);
        if (new1 < old1) out.push([new1, old1]);
        return out;
    }

    // ---- numbers ------------------------------------------------------------------------------------------------
    /**
     * Ms of running-timer time that "pays back" one HP: the damage a timer skips is (1 - factor) of the normal rate, so
     * 1 HP per DAMAGE_INTERVAL_MS / (1 - factor) = 10 min with today's CONFIG. Infinity when the timer halves nothing.
     */
    function chargeIntervalMs(c) {
        const base = cfg('DAMAGE_INTERVAL_MS', c);
        const f = cfg('WORK_TIMER_DAMAGE_FACTOR', c);
        return base > 0 && f > 0 && f < 1 ? Math.round(base / (1 - f)) : Infinity;
    }
    /** The 1 HP floor: a correction may take HP off the church but never below 1. */
    function capCharge(hp, churchHp) {
        const h = Math.floor(Number(hp));
        const cur = Number(churchHp);
        if (!(h > 0) || !Number.isFinite(cur)) return 0;
        return Math.min(h, Math.max(0, Math.floor(cur) - 1));
    }
    function chargeFor(attack, removed, c) {
        let ms = 0;
        removed.forEach((r) => (attack || []).forEach((w) => { ms += overlapMs(r[0], r[1], w[0], w[1]); }));
        return Math.floor(ms / chargeIntervalMs(c));
    }
    function pad(n) { return String(n).padStart(2, '0'); }
    /** Local calendar day "YYYY-MM-DD" (the same key DailyRecord.dateKey gives). */
    function dayKey(ms) {
        const d = new Date(ms);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    /** Split [start, end) at local midnights: { "YYYY-MM-DD": ms }. A session inside one day is one entry. */
    function splitByDay(start, end) {
        const out = {};
        if (!isNum(start) || !isNum(end) || !(end > start)) return out;
        let from = start;
        for (let guard = 0; from < end && guard < 400; guard++) {
            const d = new Date(from);
            const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
            const to = Math.min(end, nextMidnight);
            const k = dayKey(from);
            out[k] = (out[k] || 0) + (to - from);
            from = to;
        }
        return out;
    }

    // ---- the item's fields --------------------------------------------------------------------------------------
    function cleanSessions(list) {
        const out = [];
        (Array.isArray(list) ? list : []).forEach((s) => {
            if (!s || typeof s !== 'object' || !isNum(s.start) || !isNum(s.end) || !(s.end > s.start)) return;
            out.push({ start: s.start, end: s.end, attack: clipWindows(s.attack, s.start, s.end) });
        });
        return out.sort((a, b) => a.start - b.start);
    }
    function sumMs(sessions) {
        return sessions.reduce((a, s) => a + (s.end - s.start), 0);
    }
    function recompute(item) {
        item.timerMsBanked = sumMs(item.timerSessions) + item.timerUntimedMs;
    }
    /**
     * Make the session fields exist and agree with each other. An item with banked time and no session list keeps that
     * time as ONE untimed entry. Idempotent; returns the item (null / non-objects are returned as they are).
     */
    function ensure(item) {
        if (!item || typeof item !== 'object') return item;
        if (Array.isArray(item.timerSessions)) {
            item.timerSessions = cleanSessions(item.timerSessions);
            if (!isNum(item.timerUntimedMs) || item.timerUntimedMs < 0) item.timerUntimedMs = 0;
        } else {
            item.timerUntimedMs = isNum(item.timerMsBanked) && item.timerMsBanked > 0 ? item.timerMsBanked : 0;
            item.timerSessions = [];
        }
        recompute(item);
        return item;
    }
    function timedMs(item) {
        return item && Array.isArray(item.timerSessions) ? sumMs(item.timerSessions) : 0;
    }
    function untimedMs(item) {
        return item && isNum(item.timerUntimedMs) ? item.timerUntimedMs : 0;
    }

    /**
     * A read-only picture of an item's time for the Sessions list (nothing is rewritten): { sessions: [{ start, end, attack, index }]
     * oldest first (`index` = the position `apply` expects), timedMs, untimedMs, totalMs }. An item that never had sessions shows
     * all its banked time as the untimed entry.
     */
    function view(item) {
        if (!item || typeof item !== 'object') return { sessions: [], timedMs: 0, untimedMs: 0, totalMs: 0 };
        const list = Array.isArray(item.timerSessions) ? cleanSessions(item.timerSessions) : [];
        const untimed = Array.isArray(item.timerSessions)
            ? (isNum(item.timerUntimedMs) && item.timerUntimedMs >= 0 ? item.timerUntimedMs : 0)
            : (isNum(item.timerMsBanked) && item.timerMsBanked > 0 ? item.timerMsBanked : 0);
        const timed = sumMs(list);
        return { sessions: list.map((x, i) => Object.assign({ index: i }, x)), timedMs: timed, untimedMs: untimed, totalMs: timed + untimed };
    }

    /** Called by Timer.stop: bank one session. A span under a second goes into the untimed entry instead of a row. */
    function recordSession(item, start, end, attack) {
        ensure(item);
        const span = end - start;
        if (span >= MIN_SESSION_MS) {
            item.timerSessions.push({ start, end, attack: clipWindows(attack, start, end) });
            item.timerSessions.sort((a, b) => a.start - b.start);
        } else if (span > 0) {
            item.timerUntimedMs += span;
        }
        recompute(item);
    }

    // ---- validation ---------------------------------------------------------------------------------------------
    /**
     * Is `span` ({ start, end }) allowed as a session of `item`? opts: { now, index } -- `index` is the session being
     * edited (it may overlap its own old span). Reasons: invalid, order, future, too-long, overlap, total-cap.
     * Overlap is checked against THIS item's other sessions only.
     */
    function validate(item, span, opts) {
        const o = opts || {};
        if (!span || !isNum(span.start) || !isNum(span.end)) return { ok: false, reason: 'invalid' };
        if (span.end <= span.start) return { ok: false, reason: 'order' };
        const now = isNum(o.now) ? o.now : Date.now();
        if (span.end > now) return { ok: false, reason: 'future' };
        const len = span.end - span.start;
        if (len > MAX_TOTAL_MS) return { ok: false, reason: 'too-long' };
        ensure(item);
        let others = 0;
        for (let i = 0; i < item.timerSessions.length; i++) {
            if (i === o.index) continue;
            const s = item.timerSessions[i];
            if (span.start < s.end && span.end > s.start) return { ok: false, reason: 'overlap' };
            others += s.end - s.start;
        }
        if (others + len + item.timerUntimedMs > MAX_TOTAL_MS) return { ok: false, reason: 'total-cap' };
        return { ok: true };
    }

    // ---- edit / delete / add ------------------------------------------------------------------------------------
    // Adds `sign` x the session's minutes to each day it covers (split at local midnight).
    function addSpanDays(map, start, end, sign) {
        const parts = splitByDay(start, end);
        Object.keys(parts).forEach((k) => {
            map[k] = (map[k] || 0) + sign * parts[k];
            if (map[k] === 0) delete map[k];
        });
    }
    /**
     * Apply a change to the item's sessions. change: { type: 'edit', index, start, end } | { type: 'delete', index } |
     * { type: 'add', start, end }. Returns { ok: true, deltaMs, chargeHp, dayDeltas } -- `dayDeltas` is the signed ms to
     * add to each local day's timer minutes -- or { ok: false, reason } with the item untouched. It never charges the
     * church itself: the caller caps `chargeHp` with capCharge and deals the damage.
     */
    function apply(item, change, opts) {
        const o = opts || {};
        if (!item || !change) return { ok: false, reason: 'invalid' };
        ensure(item);
        const type = change.type;
        const dayDeltas = {};
        if (type === 'add') {
            const v = validate(item, change, o);
            if (!v.ok) return v;
            item.timerSessions.push({ start: change.start, end: change.end, attack: [] });
            item.timerSessions.sort((a, b) => a.start - b.start);
            recompute(item);
            addSpanDays(dayDeltas, change.start, change.end, 1);
            return { ok: true, deltaMs: change.end - change.start, chargeHp: 0, dayDeltas };
        }
        const idx = change.index;
        if (!Number.isInteger(idx) || idx < 0 || idx >= item.timerSessions.length) return { ok: false, reason: 'missing' };
        const old = item.timerSessions[idx];
        const oldLen = old.end - old.start;
        if (type === 'delete') {
            const chargeHp = chargeFor(old.attack, [[old.start, old.end]], o.config);
            item.timerSessions.splice(idx, 1);
            recompute(item);
            addSpanDays(dayDeltas, old.start, old.end, -1);
            return { ok: true, deltaMs: -oldLen, chargeHp, dayDeltas };
        }
        if (type === 'edit') {
            const v = validate(item, change, Object.assign({}, o, { index: idx }));
            if (!v.ok) return v;
            const removed = subtract(old.start, old.end, change.start, change.end);
            const chargeHp = chargeFor(old.attack, removed, o.config);
            const newLen = change.end - change.start;
            item.timerSessions[idx] = { start: change.start, end: change.end, attack: clipWindows(old.attack, change.start, change.end) };
            item.timerSessions.sort((a, b) => a.start - b.start);
            recompute(item);
            addSpanDays(dayDeltas, old.start, old.end, -1);
            addSpanDays(dayDeltas, change.start, change.end, 1);
            return { ok: true, deltaMs: newLen - oldLen, chargeHp, dayDeltas };
        }
        return { ok: false, reason: 'invalid' };
    }
    /** What `apply` would do, on a copy: for the live "Saving takes back 3 HP" line. The item is not touched. */
    function preview(item, change, opts) {
        if (!item) return { ok: false, reason: 'invalid' };
        const copy = { timerMsBanked: item.timerMsBanked };
        if (Array.isArray(item.timerSessions)) {
            copy.timerSessions = JSON.parse(JSON.stringify(item.timerSessions));
            copy.timerUntimedMs = item.timerUntimedMs;
        }
        return apply(copy, change, opts);
    }

    // ---- the typable total --------------------------------------------------------------------------------------
    /**
     * Type a total (a guesstimate): only the untimed entry changes, so the total always equals the list. A total under
     * the timed sessions is refused ('below-timed': edit the session instead). Never charges. Returns
     * { ok, deltaMs, chargeHp: 0 } or { ok: false, reason: 'invalid' | 'too-long' | 'below-timed' }.
     */
    function setTotal(item, ms) {
        const n = Number(ms);
        if (!item || !Number.isFinite(n) || n < 0) return { ok: false, reason: 'invalid' };
        const total = Math.round(n);
        if (total > MAX_TOTAL_MS) return { ok: false, reason: 'too-long' };
        ensure(item);
        const timed = sumMs(item.timerSessions);
        if (total < timed) return { ok: false, reason: 'below-timed' };
        const before = item.timerMsBanked;
        item.timerUntimedMs = total - timed;
        recompute(item);
        return { ok: true, deltaMs: total - before, chargeHp: 0 };
    }
    /**
     * The interim total edit used by Timer.setLogged until Build B's editors: raising or lowering to anything at or above
     * the timed sessions changes only the untimed entry; lowering BELOW them collapses the sessions into the untimed entry
     * (what the old single number did). Build B replaces the collapse with the 'below-timed' refusal.
     */
    function forceTotal(item, ms) {
        ensure(item);
        const timed = sumMs(item.timerSessions);
        if (ms >= timed) {
            item.timerUntimedMs = ms - timed;
        } else {
            item.timerSessions = [];
            item.timerUntimedMs = ms;
        }
        recompute(item);
    }

    return {
        MAX_TOTAL_MS, MIN_SESSION_MS,
        ensure, view, timedMs, untimedMs, recordSession, validate, apply, preview, setTotal, forceTotal,
        chargeIntervalMs, capCharge, dayKey, splitByDay, clipWindows, overlapMs,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimerSessions;
}

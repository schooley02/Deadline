/**
 * Ice -- a zombie at the church can't attack while the work timer runs on its own task (docs/ICE_PLAN.md, DESIGNED + approved
 * 2026-11-10, Jeremy: "it won't be able to attack while you are working on it, if it takes too long, you didn't plan well enough").
 *
 * PURE: no DOM, no globals except an optional CONFIG fallback (same shape as js/timer.js). Rules:
 *   - Iced = the item is at the base (overdue, a threat) AND a work timer runs on THIS item (never its parent or sub-tasks)
 *     AND the item still has ice left (`item.iceUsedMs < CONFIG.ICE_MAX_MS`).
 *   - The budget is per ITEM across sessions (`item.iceUsedMs`, additive item field, no schema bump), so stop / start can't
 *     refill it. When it is spent the zombie attacks again at the timer's usual half rate (Timer.damageIntervalMs).
 *   - Pausing an iced item leaves it iced (cracking) for `CONFIG.ICE_GRACE_MS` (`item.icePausedAt`); the grace is spent from the
 *     same budget. Stop, resume, or a timer starting on another item (one timer at a time) ends the grace at once.
 *   - Across a gap the loop did not tick (a background tab, a sleeping laptop, a reload) `tick` spends nothing; catch-up calls
 *     `spendGap` instead, which spends the ice the zombie used while away (from the later of its last iced tick, its due time and
 *     the timer's start) and tells catch-up which stretch to skip (2026-11-27, Jeremy: tabbing back used to hand out a full fresh
 *     hour from that moment, "it should have applied it from the moment they reached the base").
 *   - Not a shop item, no charges: running the timer on the task is the price. It never moves the due time or the position.
 * The live loop (js/loop.js) calls `tick` every tick; per-item bookkeeping that is NOT saved (last tick, episode length, phase)
 * lives in a WeakMap here, so only `iceUsedMs` / `icePausedAt` ride on the item.
 */
const Ice = (() => {
    const DEFAULTS = {
        ICE_MAX_MS: 60 * 60 * 1000,
        ICE_GRACE_MS: 5 * 60 * 1000,
        LIVE_GAP_THRESHOLD_MS: 30 * 1000,
    };
    function cfg(key, c) {
        const src = c || (typeof CONFIG !== 'undefined' ? CONFIG : DEFAULTS);
        return typeof src[key] === 'number' ? src[key] : DEFAULTS[key];
    }

    function isRunning(item) {
        return !!(item && item.timer && typeof item.timer.startedAt === 'number');
    }

    // At the base AND a threat: overdue, not a Break (negative) habit lurker, not a KO ghost.
    function atBase(item) {
        if (!item || typeof item !== 'object') return false;
        if (item.isOverdue !== true || item.koGhost === true) return false;
        return !(item.type === 'habit' && item.isNegative === true);
    }

    function used(item) {
        return (item && typeof item.iceUsedMs === 'number' && item.iceUsedMs > 0) ? item.iceUsedMs : 0;
    }
    function budgetLeftMs(item, c) {
        return Math.max(0, cfg('ICE_MAX_MS', c) - used(item));
    }
    function graceLeftMs(item, nowMs, c) {
        // Only a PAUSED item (timerPaused) has a grace: anything that clears the pause (Stop, editing the logged time to 0) ends it.
        if (!item || isRunning(item) || item.timerPaused !== true || typeof item.icePausedAt !== 'number') return 0;
        return Math.max(0, cfg('ICE_GRACE_MS', c) - (nowMs - item.icePausedAt));
    }

    /**
     * What the ice is doing right now -> { iced, leftMs, thawing }. `leftMs` = how long the ice lasts if nothing changes
     * (the budget left while the timer runs; the shorter of grace and budget after a pause). `thawing` = the ice is cracking:
     * in the pause grace, or in the last ICE_GRACE_MS of the budget. Reads only; never spends.
     */
    function state(item, nowMs, c, holder) {
        const none = { iced: false, leftMs: 0, thawing: false };
        if (!atBase(item)) return none;
        const left = budgetLeftMs(item, c);
        if (left <= 0) return none;
        // `holder` = the item whose timer does the icing: the item itself, or (family rule, 2026-11-11) its PARENT.
        const h = holder || item;
        if (isRunning(h)) return { iced: true, leftMs: left, thawing: left <= cfg('ICE_GRACE_MS', c) };
        const g = graceLeftMs(h, nowMs, c);
        if (g > 0) return { iced: true, leftMs: Math.min(left, g), thawing: true };
        return none;
    }

    // When the ice ends if nothing changes (ms epoch), or null when the item is not iced. The Base Health panel's ETA uses it.
    function thawAt(item, nowMs, c, holder) {
        const s = state(item, nowMs, c, holder);
        return s.iced ? nowMs + s.leftMs : null;
    }

    // Timer.pause calls this AFTER banking: an item iced at that moment keeps its ice for the grace.
    function onPause(item, nowMs, c) {
        if (!item || !atBase(item) || budgetLeftMs(item, c) <= 0) return;
        item.icePausedAt = nowMs;
    }
    // Stop, resume, auto-stop, complete: the grace is over.
    function clearGrace(item) {
        if (item && item.icePausedAt !== undefined) item.icePausedAt = null;
    }
    // One timer at a time: a timer starting on `except` ends every OTHER item's pause grace (never two iced at once).
    function clearOthers(items, except) {
        (items || []).forEach(i => { if (i !== except) clearGrace(i); });
    }

    // Unsaved per-item bookkeeping: { at, episodeMs, iced, phase, thawAtMs }.
    const track = new WeakMap();

    /**
     * The live loop calls this once per tick for every item. Spends the budget for the time since the last iced tick (nothing
     * across a gap longer than LIVE_GAP_THRESHOLD_MS: catch-up owns that time) and reports:
     *   iced / leftMs        after this tick's spending
     *   started / thawed     this tick crossed into / out of the ice
     *   thawAtMs             (thawed only) when the ice really ended: now, or earlier when it ran out during a gap (spendGap)
     *   episodeMs            (thawed only) how long this stretch of ice lasted
     *   phase / phaseChanged 'iced' | 'thawing' | null, for the CSS classes (touched only when it moves)
     */
    function tick(item, nowMs, c, holder) {
        const out = { iced: false, leftMs: 0, started: false, thawed: false, thawAtMs: null, episodeMs: 0, phase: null, phaseChanged: false };
        if (!item || typeof item !== 'object') return out;
        let tr = track.get(item);
        const before = state(item, nowMs, c, holder);
        if (!tr && !before.iced) return out;
        if (!tr) { tr = { at: null, episodeMs: 0, iced: false, phase: null }; track.set(item, tr); }
        if (before.iced) {
            if (typeof tr.at === 'number' && nowMs > tr.at && nowMs - tr.at <= cfg('LIVE_GAP_THRESHOLD_MS', c)) {
                const spend = Math.min(nowMs - tr.at, budgetLeftMs(item, c));
                item.iceUsedMs = used(item) + spend;
                tr.episodeMs += spend;
            }
            tr.at = nowMs;
            tr.thawAtMs = null; // still iced now: a thaw time left by spendGap is stale
        }
        const after = state(item, nowMs, c, holder);
        out.iced = after.iced;
        out.leftMs = after.leftMs;
        out.started = after.iced && !tr.iced;
        out.thawed = !after.iced && tr.iced;
        out.phase = after.iced ? (after.thawing ? 'thawing' : 'iced') : null;
        out.phaseChanged = out.phase !== tr.phase;
        if (out.thawed) out.thawAtMs = (typeof tr.thawAtMs === 'number' && tr.thawAtMs <= nowMs) ? tr.thawAtMs : nowMs;
        if (!after.iced) {
            out.episodeMs = tr.episodeMs;
            tr.episodeMs = 0;
            tr.at = null;
            tr.thawAtMs = null;
        }
        tr.iced = after.iced;
        tr.phase = out.phase;
        return out;
    }

    /**
     * Catch-up for a gap the live loop did not tick through (live-gap catch-up and the reload catch-up call this BEFORE their damage
     * math). Spends the ice this item used while away and returns { fromMs, untilMs, spentMs } -- the stretch catch-up must not
     * charge -- or null when no ice was used. The stretch starts at the item's last iced tick when the loop saw it iced; otherwise
     * at the latest of `sinceMs` (start of the absence, optional), its due time and the holder's timer start. It ends at `nowMs`,
     * when the budget runs out, or (paused holder) when the pause grace ends. Leaves the per-item bookkeeping so the next `tick`
     * neither spends the gap again nor misses a thaw that happened while away (that thaw then reports `thawAtMs` = `untilMs`).
     */
    function spendGap(item, sinceMs, nowMs, c, holder) {
        if (!atBase(item) || typeof nowMs !== 'number') return null;
        const left = budgetLeftMs(item, c);
        if (left <= 0) return null;
        const h = holder || item;
        let endMs;
        if (isRunning(h)) endMs = nowMs;
        else if (h.timerPaused === true && typeof h.icePausedAt === 'number') endMs = Math.min(nowMs, h.icePausedAt + cfg('ICE_GRACE_MS', c));
        else return null;
        let tr = track.get(item);
        let fromMs;
        if (tr && tr.iced && typeof tr.at === 'number') {
            fromMs = tr.at;
        } else {
            const due = item.dueDateTime instanceof Date ? item.dueDateTime.getTime()
                : (typeof item.dueDateTime === 'number' ? item.dueDateTime : -Infinity);
            fromMs = Math.max(typeof sinceMs === 'number' ? sinceMs : -Infinity, due);
            if (isRunning(h)) fromMs = Math.max(fromMs, h.timer.startedAt);
        }
        if (!isFinite(fromMs) || !(fromMs < endMs)) return null;
        const spentMs = Math.min(endMs - fromMs, left);
        item.iceUsedMs = used(item) + spentMs;
        if (!tr) { tr = { at: null, episodeMs: 0, iced: false, phase: null }; track.set(item, tr); }
        tr.episodeMs += spentMs;
        tr.iced = true;
        tr.at = nowMs;
        tr.thawAtMs = fromMs + spentMs;
        return { fromMs, untilMs: fromMs + spentMs, spentMs };
    }

    // ms of ice left (0 when not iced): the Base Health panel's ETA and its attacker rows read this.
    function leftMs(item, nowMs, c, holder) {
        const s = state(item, nowMs, c, holder);
        return s.iced ? s.leftMs : 0;
    }

    // Family rule (docs/FAMILY_DAMAGE_PLAN.md, 2026-11-11): a timer on a PARENT ices every one of its sub-tasks that is at the
    // church (each on its own budget, so a late sub can't refill anything); a timer on a SUB-TASK ices only that sub-task, never
    // its parent or siblings. Returns the item whose timer does the icing for `item`.
    function holderFor(item, items) {
        if (!item || !item.parentId) return item;
        const parent = (items || []).find(i => i && i.id === item.parentId);
        if (parent && (isRunning(parent) || (parent.timerPaused === true && typeof parent.icePausedAt === 'number'))) return parent;
        return item;
    }
    // state / leftMs for an item among its siblings (what the panel, the church pulse and the heroes call).
    function stateIn(item, items, nowMs, c) { return state(item, nowMs, c, holderFor(item, items)); }
    function leftMsIn(item, items, nowMs, c) { return leftMs(item, nowMs, c, holderFor(item, items)); }

    return { holderFor, stateIn, leftMsIn, atBase, state, leftMs, thawAt, onPause, clearGrace, clearOthers, tick, spendGap, budgetLeftMs, graceLeftMs };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Ice;
}

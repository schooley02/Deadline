/**
 * CanvasThump -- the whole battlefield (#gameCanvas and everything in it) gives a small downward "thump" when a task or habit is
 * completed, as if the screen took the impact of the hero's attack (2026-11-09, Jeremy: "nothing too big, just a sort of thump").
 *
 * Visual only: no state, no save, no balance. The motion itself is CSS (css/gameCanvas.css `.canvas-thump` / `.canvas-thump-soft`,
 * whole-pixel steps, vertical only so the page never gains width); this file decides WHEN and WHETHER:
 *   - a short delay after the completion, so the thump lands with the hero's strike (CONFIG.CANVAS_THUMP_DELAY_MS);
 *   - at most one thump per CONFIG.CANVAS_THUMP_COOLDOWN_MS, so ticking off a pile of tasks never turns into a rattle;
 *   - fx-off or prefers-reduced-motion: none; fx-reduced: the soft 1px version.
 * The HUD (stats overlay) is a sibling of #gameCanvas, not inside it, so it stays still. While it plays, the parent .game-canvas
 * carries `canvas-thumping` so the 3px strip the jolt uncovers is the scene's own dark colour, never the light fallback gradient.
 *
 * Everything is optional-chained so a missing element or a jsdom page never throws.
 */
const CanvasThump = (() => {
    const FULL = 'canvas-thump';
    const SOFT = 'canvas-thump-soft';
    const HOST = 'canvas-thumping';
    const DEFAULTS = { delayMs: 350, durationMs: 220, cooldownMs: 500 };

    let lastMs = -Infinity;
    let delayTimer = 0;
    let endTimer = 0;

    function cfg() {
        const c = (typeof CONFIG !== 'undefined') ? CONFIG : {};
        return {
            delayMs: (typeof c.CANVAS_THUMP_DELAY_MS === 'number') ? c.CANVAS_THUMP_DELAY_MS : DEFAULTS.delayMs,
            durationMs: (typeof c.CANVAS_THUMP_DURATION_MS === 'number') ? c.CANVAS_THUMP_DURATION_MS : DEFAULTS.durationMs,
            cooldownMs: (typeof c.CANVAS_THUMP_COOLDOWN_MS === 'number') ? c.CANVAS_THUMP_COOLDOWN_MS : DEFAULTS.cooldownMs,
        };
    }

    /** Pure. 'off' (no motion) | 'soft' (1px) | 'full' (3px). Off wins over reduced. */
    function motionMode(state) {
        const s = state || {};
        if (s.fxOff || s.reducedMotion) return 'off';
        if (s.fxReduced) return 'soft';
        return 'full';
    }

    /** Pure. True when enough time has passed since the last thump. */
    function shouldThump(nowMs, lastThumpMs, cooldownMs) {
        return (nowMs - lastThumpMs) >= cooldownMs;
    }

    function readMode() {
        const state = { fxOff: false, fxReduced: false, reducedMotion: false };
        if (typeof document !== 'undefined' && document.body && document.body.classList) {
            state.fxOff = document.body.classList.contains('fx-off');
            state.fxReduced = document.body.classList.contains('fx-reduced');
        }
        try {
            if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) state.reducedMotion = true;
        } catch (e) { /* ignore */ }
        return motionMode(state);
    }

    function clear(el) {
        if (!el || !el.classList) return;
        el.classList.remove(FULL, SOFT);
        if (el.parentElement && el.parentElement.classList) el.parentElement.classList.remove(HOST);
    }

    /** Plays the thump now (cooldown and motion settings permitting). Returns true when it played. */
    function play(el, nowMs) {
        if (!el || !el.classList) return false;
        const mode = readMode();
        if (mode === 'off') return false;
        const c = cfg();
        const now = (typeof nowMs === 'number') ? nowMs : Date.now();
        if (!shouldThump(now, lastMs, c.cooldownMs)) return false;
        lastMs = now;
        clear(el);
        void el.offsetWidth; // restart the CSS animation if a previous one is still on the element
        el.classList.add(mode === 'soft' ? SOFT : FULL);
        if (el.parentElement && el.parentElement.classList) el.parentElement.classList.add(HOST);
        if (endTimer) clearTimeout(endTimer);
        endTimer = setTimeout(() => { endTimer = 0; clear(el); }, c.durationMs);
        return true;
    }

    /** A completion happened: thump after the strike delay. Safe to call for every completion. */
    function onDefeat(el) {
        if (!el) return;
        const c = cfg();
        if (delayTimer) clearTimeout(delayTimer);
        if (c.delayMs <= 0) { delayTimer = 0; play(el); return; }
        delayTimer = setTimeout(() => { delayTimer = 0; play(el); }, c.delayMs);
    }

    function resetForTests() {
        lastMs = -Infinity;
        if (delayTimer) clearTimeout(delayTimer);
        if (endTimer) clearTimeout(endTimer);
        delayTimer = 0;
        endTimer = 0;
    }

    return { FULL, SOFT, HOST, motionMode, shouldThump, play, onDefeat, resetForTests };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasThump;
}

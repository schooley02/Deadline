/**
 * CanvasThump -- the whole battlefield (#gameCanvas and everything in it) gives a small downward "thump" when a task or habit is
 * completed, as if the screen took the impact of the hero's attack (2026-11-09, Jeremy: "nothing too big, just a sort of thump").
 *
 * Visual only: no state, no save, no balance. The motion itself is CSS (css/gameCanvas.css `.canvas-thump` / `.canvas-thump-soft`,
 * whole-pixel steps, vertical only so the page never gains width); this file decides WHEN and WHETHER:
 *   - a short delay after the completion, so the thump lands with the hero's strike (CONFIG.CANVAS_THUMP_DELAY_MS);
 *   - at most one thump per CONFIG.CANVAS_THUMP_COOLDOWN_MS, so ticking off a pile of tasks never turns into a rattle;
 *   - fx-off or prefers-reduced-motion: none; fx-reduced: the soft 1px version;
 *   - the phone gives one short vibration with it (CONFIG.CANVAS_THUMP_VIBRATE_MS, 2026-11-09; Android Chrome only), unless the
 *     Settings "Screen Thump" switch (Settings.screenBuzz, 2026-11-10) is off.
 *   - the buzz has three sizes (2026-11-11, Jeremy: "as if you're landing a big strong hit"): 'normal' (one short tick), 'heavy' (a
 *     thud with an aftershock: the item had sub-tasks, or CONFIG.CANVAS_THUMP_HEAVY_MIN+ minutes logged) and 'massive'
 *     (CONFIG.CANVAS_THUMP_MASSIVE_MIN+ minutes logged). A phone's browser can only set a buzz's length and pattern, not its
 *     strength, so heavy / massive are longer multi-pulse patterns (CONFIG.CANVAS_THUMP_HEAVY_PATTERN / _MASSIVE_PATTERN).
 *     `weightOf` and `tierFor` are pure; the dev panel's Buzz buttons call `preview`.
 * The HUD (stats overlay) is a sibling of #gameCanvas, not inside it, so it stays still. While it plays, the parent .game-canvas
 * carries `canvas-thumping` so the 3px strip the jolt uncovers is the scene's own dark colour, never the light fallback gradient.
 *
 * Everything is optional-chained so a missing element or a jsdom page never throws.
 */
const CanvasThump = (() => {
    const FULL = 'canvas-thump';
    const SOFT = 'canvas-thump-soft';
    const HOST = 'canvas-thumping';
    const TIERS = ['normal', 'heavy', 'massive'];
    const RANK = { normal: 0, heavy: 1, massive: 2 };
    const DEFAULTS = {
        delayMs: 150, durationMs: 220, cooldownMs: 500, vibrateMs: 20,
        heavyMin: 30, massiveMin: 60, heavyPattern: [40, 30, 70], massivePattern: [50, 40, 90, 50, 130],
    };

    let lastMs = -Infinity;
    let delayTimer = 0;
    let endTimer = 0;
    let pendingTier = 'normal';

    function cfg() {
        const c = (typeof CONFIG !== 'undefined') ? CONFIG : {};
        return {
            delayMs: (typeof c.CANVAS_THUMP_DELAY_MS === 'number') ? c.CANVAS_THUMP_DELAY_MS : DEFAULTS.delayMs,
            durationMs: (typeof c.CANVAS_THUMP_DURATION_MS === 'number') ? c.CANVAS_THUMP_DURATION_MS : DEFAULTS.durationMs,
            cooldownMs: (typeof c.CANVAS_THUMP_COOLDOWN_MS === 'number') ? c.CANVAS_THUMP_COOLDOWN_MS : DEFAULTS.cooldownMs,
            vibrateMs: (typeof c.CANVAS_THUMP_VIBRATE_MS === 'number') ? c.CANVAS_THUMP_VIBRATE_MS : DEFAULTS.vibrateMs,
            heavyMin: (typeof c.CANVAS_THUMP_HEAVY_MIN === 'number') ? c.CANVAS_THUMP_HEAVY_MIN : DEFAULTS.heavyMin,
            massiveMin: (typeof c.CANVAS_THUMP_MASSIVE_MIN === 'number') ? c.CANVAS_THUMP_MASSIVE_MIN : DEFAULTS.massiveMin,
            heavyPattern: Array.isArray(c.CANVAS_THUMP_HEAVY_PATTERN) ? c.CANVAS_THUMP_HEAVY_PATTERN : DEFAULTS.heavyPattern,
            massivePattern: Array.isArray(c.CANVAS_THUMP_MASSIVE_PATTERN) ? c.CANVAS_THUMP_MASSIVE_PATTERN : DEFAULTS.massivePattern,
        };
    }

    /**
     * What a completed item "weighs" for the buzz: { subs, minutes }. `subs` = it had sub-tasks (a parent is only completable once
     * they are all done, so the count it kept is `completedSubTasks` / `totalSubTasks`); `minutes` = whole minutes of work-timer time
     * logged (Timer.loggedMinutes: banked + the live span). Pure given its inputs; never throws.
     */
    function weightOf(item, nowMs) {
        if (!item) return { subs: false, minutes: 0 };
        const subs = (item.totalSubTasks > 0) || (item.completedSubTasks > 0) || (Array.isArray(item.subTasks) && item.subTasks.length > 0);
        const now = (typeof nowMs === 'number') ? nowMs : Date.now();
        let minutes = 0;
        try {
            if (typeof Timer !== 'undefined' && Timer && typeof Timer.loggedMinutes === 'function') minutes = Timer.loggedMinutes(item, now);
            else if (typeof item.timerMsBanked === 'number') minutes = Math.floor(item.timerMsBanked / 60000);
        } catch (e) { minutes = 0; }
        return { subs: !!subs, minutes: minutes > 0 ? minutes : 0 };
    }

    /** Pure. 'massive' (massiveMin+ minutes logged) > 'heavy' (had sub-tasks, or heavyMin+ minutes) > 'normal'. */
    function tierFor(weight, config) {
        const w = weight || {};
        const c = config || cfg();
        const minutes = Number(w.minutes) || 0;
        if (minutes >= c.massiveMin) return 'massive';
        if (w.subs || minutes >= c.heavyMin) return 'heavy';
        return 'normal';
    }

    /** What navigator.vibrate gets for a tier: a number (normal) or a pattern array. CANVAS_THUMP_VIBRATE_MS <= 0 mutes every tier. */
    function buzzFor(tier, config) {
        const c = config || cfg();
        if (!(c.vibrateMs > 0)) return 0;
        if (tier === 'massive') return c.massivePattern;
        if (tier === 'heavy') return c.heavyPattern;
        return c.vibrateMs;
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

    // The Settings "Screen Thump" switch (Settings.screenBuzz, per device, ON by default). A missing Settings (jsdom tests) = allowed.
    function buzzAllowed() {
        try {
            if (typeof Settings !== 'undefined' && Settings && typeof Settings.load === 'function') return Settings.load().screenBuzz !== false;
        } catch (e) { /* ignore */ }
        return true;
    }

    // One short buzz with the thump (CONFIG.CANVAS_THUMP_VIBRATE_MS; 0 = off). Android Chrome only; a phone in silent / battery-saver
    // mode, or any browser without navigator.vibrate (iOS), just does nothing.
    function buzz(pattern) {
        const ok = Array.isArray(pattern) ? pattern.some((n) => n > 0) : pattern > 0;
        if (!ok) return false;
        try {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') return navigator.vibrate(pattern) !== false;
        } catch (e) { /* ignore */ }
        return false;
    }

    function clear(el) {
        if (!el || !el.classList) return;
        el.classList.remove(FULL, SOFT);
        if (el.parentElement && el.parentElement.classList) el.parentElement.classList.remove(HOST);
    }

    /** Plays the thump now (cooldown and motion settings permitting). `tier` sizes the buzz. Returns true when it played. */
    function play(el, nowMs, tier) {
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
        if (buzzAllowed()) buzz(buzzFor(tier, c));
        if (endTimer) clearTimeout(endTimer);
        endTimer = setTimeout(() => { endTimer = 0; clear(el); }, c.durationMs);
        return true;
    }

    /**
     * A completion happened: thump after the strike delay. Safe to call for every completion. `item` (optional) sizes the buzz; two
     * completions inside the delay window share one thump, which takes the bigger of the two sizes.
     */
    function onDefeat(el, item) {
        if (!el) return;
        const c = cfg();
        const tier = tierFor(weightOf(item), c);
        if (RANK[tier] > RANK[pendingTier]) pendingTier = tier;
        if (delayTimer) clearTimeout(delayTimer);
        if (c.delayMs <= 0) { delayTimer = 0; const t = pendingTier; pendingTier = 'normal'; play(el, undefined, t); return; }
        delayTimer = setTimeout(() => { delayTimer = 0; const t = pendingTier; pendingTier = 'normal'; play(el, undefined, t); }, c.delayMs);
    }

    /**
     * Dev panel (2026-11-11): play the thump + the buzz for one tier right now, ignoring the cooldown and the Screen Thump switch (the
     * point is to feel it); the thump itself still follows Effects Off / reduced. Returns the tier played ('normal' for an unknown one).
     */
    function preview(el, tier) {
        const t = (RANK[tier] !== undefined) ? tier : 'normal';
        const c = cfg();
        const mode = readMode();
        if (el && el.classList && mode !== 'off') {
            clear(el);
            void el.offsetWidth;
            el.classList.add(mode === 'soft' ? SOFT : FULL);
            if (el.parentElement && el.parentElement.classList) el.parentElement.classList.add(HOST);
            if (endTimer) clearTimeout(endTimer);
            endTimer = setTimeout(() => { endTimer = 0; clear(el); }, c.durationMs);
        }
        buzz(buzzFor(t, c));
        return t;
    }

    /** One buzz right now, whatever the motion settings say: the sample when the player turns the Settings switch on. */
    function sampleBuzz() {
        const c = cfg();
        return buzz(buzzFor('normal', c));
    }

    function resetForTests() {
        lastMs = -Infinity;
        if (delayTimer) clearTimeout(delayTimer);
        if (endTimer) clearTimeout(endTimer);
        delayTimer = 0;
        endTimer = 0;
        pendingTier = 'normal';
    }

    return { FULL, SOFT, HOST, TIERS, motionMode, shouldThump, weightOf, tierFor, buzzFor, play, onDefeat, preview, sampleBuzz, resetForTests };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasThump;
}

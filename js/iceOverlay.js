/**
 * iceOverlay.js -- the ice ART on iced zombies (docs/ICE_PLAN.md "Art", wired 2026-11-10).
 *
 * One shared overlay set for all 8 categories, drawn ON TOP of the zombie sprite (Assets/Effects/ice/):
 *   ice_form.png (8 frames, forming) -> ice_hold.png (iced) -> ice_hold_cracked.png (thawing)
 *   -> ice_burst.png (7 frames, thaw or completion; its last frame is the meltwater puddle, which then fades).
 *
 * Like SpriteAnim, ALL the motion lives in CSS (css/enemyIce.css, keyed off the `ice-*` class on the overlay); this module only
 * owns one child element per enemy and moves it between phases. The phase names come from js/ice.js (`iced` / `thawing` / null),
 * which js/loop.js already feeds into the `.enemy-iced` / `.enemy-thawing` classes on a phase change; the loop calls `sync`
 * at the same moment. Completing an iced zombie calls `burstOnDefeat` from Items.completeItem in the same instant as
 * SpriteAnim.playDeath (Jeremy, 2026-11-10: death animation AND ice burst together, nothing waits for the other).
 *
 * DOM added to an enemy (after the sprite + ring, so the countdown badge at z-index 5 stays on top):
 *   <span class="ice-overlay ice-forming|ice-hold|ice-cracked|ice-burst" style="--ice-scale:1" aria-hidden="true"></span>
 * Anchor: the 128px frame's row 118 sits on the zombie's feet line = the enemy box's bottom edge (css/enemyAnim.css lands every
 * atlas's planted foot there, whatever --dy-* it needs). Scale: the sprite's --sprite-scale, mirrored into --ice-scale
 * (SpriteAnim.syncScale keeps it in step), so sub-tasks (0.5x) and the portrait strip scale the ice with the zombie.
 *
 * Motion off (body.fx-off / fx-reduced, prefers-reduced-motion): no form, burst or wiggle; the hold / cracked frames just
 * appear and disappear. Only the whole-frame art is shown, so nothing here needs a second code path in CSS.
 *
 * Phase timers are plain setTimeouts (a throttled background tab only delays the swap; the CSS animation already holds the
 * right last frame: form ends on the hold frame, burst ends on the faded puddle).
 */
const IceOverlay = (() => {
    const FORM_FRAMES = 8;
    const FORM_FRAME_MS = 60;
    const BURST_FRAMES = 7;
    const BURST_FRAME_MS = 70;
    const PUDDLE_FADE_MS = 250;
    // Keep in sync with the keyframe durations in css/enemyIce.css.
    const FORM_MS = FORM_FRAMES * FORM_FRAME_MS;                    // 480
    const BURST_MS = BURST_FRAMES * BURST_FRAME_MS;                 // 490
    const BURST_TOTAL_MS = BURST_MS + PUDDLE_FADE_MS;               // 740: burst, then the puddle fades

    // Same gating as the zombie's own walk cycle / death animation: Effects Off or Reduced, or the OS reduce-motion setting.
    function motionOk() {
        if (typeof document !== 'undefined' && document.body && document.body.classList
            && (document.body.classList.contains('fx-off') || document.body.classList.contains('fx-reduced'))) return false;
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
        return true;
    }

    function get(enemyEl) {
        if (!enemyEl || typeof enemyEl.querySelector !== 'function') return null;
        return enemyEl.querySelector(':scope > .ice-overlay');
    }

    function scaleOf(enemyEl) {
        const sprite = enemyEl.querySelector(':scope > .enemy-sprite');
        const s = sprite && Number(sprite._spriteScale);
        return s > 0 && isFinite(s) ? s : 1;
    }

    // Idempotent: returns the existing overlay, or makes one and puts it last (above the sprite and the ring).
    function ensure(enemyEl) {
        let ov = get(enemyEl);
        if (ov) return ov;
        if (typeof document === 'undefined' || typeof enemyEl.appendChild !== 'function') return null;
        ov = document.createElement('span');
        ov.className = 'ice-overlay';
        ov.setAttribute('aria-hidden', 'true');
        ov.style.setProperty('--ice-scale', String(scaleOf(enemyEl)));
        enemyEl.appendChild(ov);
        return ov;
    }

    function clearTimer(ov) {
        if (ov._iceTimer) { clearTimeout(ov._iceTimer); ov._iceTimer = null; }
    }

    function phaseOf(ov) {
        return (ov && ov.dataset && ov.dataset.icePhase) || '';
    }

    function remove(ov) {
        if (!ov) return;
        clearTimer(ov);
        if (typeof ov.remove === 'function') ov.remove();
    }

    // Moves the overlay to one named look. `forming` hands over to `hold` and a thaw `burst` removes the overlay, each on a timer.
    function show(ov, name, keep) {
        clearTimer(ov);
        ov.className = 'ice-overlay ice-' + name;
        ov.dataset.icePhase = name;
        if (name === 'forming') {
            ov._iceTimer = setTimeout(() => { ov._iceTimer = null; if (phaseOf(ov) === 'forming') show(ov, 'hold'); }, FORM_MS);
        } else if (name === 'burst' && !keep) {
            ov._iceTimer = setTimeout(() => { ov._iceTimer = null; if (phaseOf(ov) === 'burst') remove(ov); }, BURST_TOTAL_MS);
        }
    }

    /**
     * Called by the loop when an item's ice phase CHANGES (and safe to call every tick: no change = no touch).
     * phase: 'iced' | 'thawing' | null (thawed / never iced).
     *   null -> iced      forming (once), then hold
     *   iced -> thawing   cracked (the zombie wiggles, css)
     *   thawing -> iced   hold again (resumed inside the grace; no second forming)
     *   iced/thawing -> null   burst, then the puddle fades and the overlay goes
     * Returns the overlay element or null.
     */
    function sync(enemyEl, phase) {
        if (!enemyEl || !enemyEl.classList) return null;
        let ov = get(enemyEl);
        // A completion burst owns the overlay until the zombie is gone: the loop must not swap it back.
        if (ov && ov.dataset && ov.dataset.iceFinal === '1') return ov;
        if (enemyEl.classList.contains('enemy-dying')) return ov;
        const prev = phaseOf(ov);
        if (phase === 'iced') {
            if (prev === 'forming' || prev === 'hold') return ov;
            ov = ov || ensure(enemyEl);
            if (!ov) return null;
            if (prev === 'cracked') show(ov, 'hold');
            else if (motionOk()) show(ov, 'forming');
            else show(ov, 'hold');
        } else if (phase === 'thawing') {
            if (prev === 'cracked') return ov;
            ov = ov || ensure(enemyEl);
            if (!ov) return null;
            show(ov, 'cracked');
        } else if (ov) {
            if (prev === 'burst') return ov;
            if (motionOk() && (prev === 'hold' || prev === 'cracked' || prev === 'forming')) show(ov, 'burst');
            else remove(ov);
        }
        return ov;
    }

    /**
     * Completing a zombie that is iced or thawing: burst its ice NOW, in the same instant as the death animation.
     * Returns the burst's length in ms (0 when there is no ice, or motion is off: the held ice then just fades out with the
     * zombie). Marks the overlay final so a loop tick during the death can't swap it. Idempotent.
     */
    function burstOnDefeat(enemyEl) {
        const ov = get(enemyEl);
        if (!ov) return 0;
        ov.dataset.iceFinal = '1';
        if (!motionOk()) return 0;
        if (phaseOf(ov) !== 'burst') show(ov, 'burst', true); // no removal timer: removeItem takes the whole element away
        return BURST_TOTAL_MS;
    }

    // SpriteAnim.syncScale mirrors the sprite's scale here, so a re-scaled zombie (a snapped parent) re-scales its ice.
    function syncScale(enemyEl, scale) {
        const ov = get(enemyEl);
        if (!ov) return;
        const v = String(scale);
        if (ov._iceScale === v) return;
        ov._iceScale = v;
        ov.style.setProperty('--ice-scale', v);
    }

    return { FORM_MS, BURST_MS, BURST_TOTAL_MS, PUDDLE_FADE_MS, motionOk, get, ensure, sync, burstOnDefeat, syncScale };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = IceOverlay;
}

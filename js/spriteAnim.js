/**
 * spriteAnim.js — animated zombie sprite sheets ([P2-GAME-010] Stage 2a,
 * 2026-10-12). Replaces the static 64/128px background image + Stage 1 CSS
 * bob with a looping walk / idle / attack cycle from the per-category atlases
 * in Assets/Zombies/anim/ (layout + frame counts: docs/ART_STYLE.md).
 *
 * Design: ALL animation state lives in CSS (css/enemyAnim.css), derived from
 * classes the game already puts on the enemy — `.enemy-at-base` -> attack,
 * `.lurker-parked` (a negative habit parked at the base) -> idle, otherwise walk, with the
 * `urgency-*` tier classes setting the walk speed and `zombie-<category>`
 * picking the atlas. So the only JS job is to give each enemy one child
 * element and keep its scale in sync with the enemy's box width. Category
 * swaps, overdue transitions and restores need no extra hooks.
 *
 * DOM added to an enemy:
 *   <div class="enemy-sprite" style="--sprite-scale:1">      (fixed-size window)
 *     <div class="enemy-sprite-sheet"></div>                 (atlas, slid by steps())
 *   </div>
 * and the `has-anim-sprite` class on the enemy (hides the static fallback
 * background and the Stage 1 bob).
 *
 * Scale: the character is drawn at 128px in each cell, so scale = boxWidth /
 * 128 (tasks/habits 1, sub-tasks 0.5, snapped parents 2).
 */
const SpriteAnim = (() => {
    const CHARACTER_PX = 128;
    const CATEGORIES = [
        'career', 'creativity', 'financial', 'health',
        'lifestyle', 'relationships', 'spirituality', 'other'
    ];

    function scaleForWidth(boxWidthPx) {
        const w = Number(boxWidthPx);
        if (!isFinite(w) || w <= 0) return 1;
        return w / CHARACTER_PX;
    }

    // Idempotent: a second call on the same element only re-syncs the scale.
    // Returns the sprite window element (or null if there's nothing to attach to).
    function attach(enemyEl, boxWidthPx) {
        if (!enemyEl) return null;
        let sprite = enemyEl.querySelector(':scope > .enemy-sprite');
        if (!sprite) {
            sprite = document.createElement('div');
            sprite.className = 'enemy-sprite';
            const sheet = document.createElement('div');
            sheet.className = 'enemy-sprite-sheet';
            sprite.appendChild(sheet);
            enemyEl.insertBefore(sprite, enemyEl.firstChild);
            enemyEl.classList.add('has-anim-sprite');
        }
        syncScale(enemyEl, boxWidthPx);
        return sprite;
    }

    // Only touches the style when the value actually changed (the loop calls
    // this every 50ms tick for top-level tasks).
    function syncScale(enemyEl, boxWidthPx) {
        if (!enemyEl) return;
        const sprite = enemyEl.querySelector(':scope > .enemy-sprite');
        if (!sprite) return;
        const scale = scaleForWidth(boxWidthPx);
        if (sprite._spriteScale === scale) return;
        sprite._spriteScale = scale;
        sprite.style.setProperty('--sprite-scale', String(scale));
    }

    // Warm the browser cache so a freshly spawned zombie doesn't flash blank
    // while its atlas decodes. No-op outside a browser.
    function preload() {
        if (typeof Image === 'undefined') return;
        CATEGORIES.forEach(c => { const img = new Image(); img.src = `Assets/Zombies/anim/${c}.png`; });
    }

    // Death animation ([P2-GAME-010] Stage 2b, 2026-10-12): 9 frames, played
    // once at DEATH_FPS, holding the final splat frame (css/enemyAnim.css
    // `.enemy-dying`). Keep DEATH_FPS in sync with that rule.
    const DEATH_FRAMES = 9;
    const DEATH_FPS = 12;
    const DEATH_MS = Math.round(DEATH_FRAMES / DEATH_FPS * 1000);

    // True when a death animation would actually play: the enemy has an
    // animated sprite and motion isn't switched off (fx 'off' body class or
    // prefers-reduced-motion, same gating as the walk cycle).
    function canPlayDeath(enemyEl) {
        if (!enemyEl || !enemyEl.classList || !enemyEl.classList.contains('has-anim-sprite')) return false;
        if (typeof document !== 'undefined' && document.body && document.body.classList.contains('fx-off')) return false;
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
        return true;
    }

    // Starts the death animation. Returns its duration in ms, or 0 when it
    // can't play (caller then uses the plain fade). Idempotent.
    function playDeath(enemyEl) {
        if (!canPlayDeath(enemyEl)) return 0;
        enemyEl.classList.add('enemy-dying');
        return DEATH_MS;
    }

    return { CHARACTER_PX, CATEGORIES, DEATH_FRAMES, DEATH_FPS, DEATH_MS, scaleForWidth, attach, syncScale, preload, canPlayDeath, playDeath };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpriteAnim;
}

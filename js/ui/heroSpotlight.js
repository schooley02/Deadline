/**
 * HeroSpotlight — the hero that steps out in front of the church
 * (docs/HERO_SPOTLIGHT_PLAN.md sub-session 2, 2026-10-21).
 *
 * Tapping a routine-owned zombie (canvas) or a list-row hero avatar shows that
 * routine's hero on a layer IN FRONT of the church: a translucent scrim dims
 * the base area (`#baseScrim`) and the hero (`#heroSpotlight`) stands on the
 * front-lane line overlapping the church. Both sit between `#base` and the
 * enemy list-order band (z 30-79), so zombies always draw ABOVE the scrim and a
 * zombie at the door is never dimmed. The hero is a sibling of `#base`, so the
 * church's hit shake / flash never moves it.
 *
 * PURE / DOM split (same discipline as js/ui/heroes.js):
 *   - pure + node-testable: resolveRoutineForItem, heroLookFor, zombieSpriteFor,
 *     createController (injected timers);
 *   - DOM: init / show / dismiss / renderInto.
 * Categories listed in CONFIG.HERO_ART_CATEGORIES draw the PixelLab atlas (kind
 * 'atlas': idle loop; KO plays once, holds its last frame, restarts -- unfaded).
 * Every other category keeps the placeholder category emoji block, where KO has
 * TWO looks behind CONFIG.HERO_KO_LOOK ('faded' | 'zombie') (plan answer 3).
 *
 * Global read at call time: Heroes (js/heroes.js, heroCategoryFor). Hero state
 * is derived locally so there is no load-order dependency on HeroesView.
 */
const HeroSpotlight = (() => {
    // The zombie PNGs predate the category key rename ('spirituality').
    const ZOMBIE_FILE_KEY = { spirituality: 'spiritual' };

    /**
     * Which routine's hero a tapped item stands for. Habits and routine tasks
     * resolve through `findRoutine(item)` (Items.findRoutineForItem bound to
     * its deps); a SUB-TASK uses its parent task's routine (plan answer 4);
     * standalone items / orphaned sub-tasks -> null (no hero, no spotlight).
     */
    function resolveRoutineForItem(item, activeItems, findRoutine) {
        if (!item || typeof findRoutine !== 'function') return null;
        if (item.parentId) {
            const parent = (activeItems || []).find(i => i.id === item.parentId);
            return parent ? (findRoutine(parent) || null) : null;
        }
        return findRoutine(item) || null;
    }

    function deriveState(routine) {
        if (routine.koState) return 'ko';
        if (routine.frozenState) return 'frozen';
        if (!routine.isActive) return 'inactive';
        return 'active';
    }

    function hasHeroArt(category, config) {
        return Array.isArray(config && config.HERO_ART_CATEGORIES)
            && config.HERO_ART_CATEGORIES.indexOf(category) !== -1;
    }

    function zombieSpriteFor(category) {
        return `Assets/Zombies/${ZOMBIE_FILE_KEY[category] || category}-zombie-64.png`;
    }

    /**
     * Pure view model for the hero element. `look` only matters for state 'ko'.
     * kind 'emoji' = placeholder block; kind 'zombie' = grey-tinted category
     * zombie (KO look B -- only ever shown inside the spotlight, never as a
     * live enemy).
     */
    function heroLookFor(routine, config) {
        const category = Heroes.heroCategoryFor(routine, config.HERO_CATEGORIES);
        const state = deriveState(routine);
        const koLook = config.HERO_KO_LOOK === 'zombie' ? 'zombie' : 'faded';
        const hasArt = hasHeroArt(category, config);
        let kind = (state === 'ko' && koLook === 'zombie') ? 'zombie' : 'emoji';
        if (hasArt) kind = 'atlas'; // art heroes never use the faded / grey-zombie stand-ins
        return {
            routineId: routine.id,
            name: routine.name,
            category,
            state,
            kind,
            emoji: (config.CATEGORY_EMOJI && config.CATEGORY_EMOJI[category]) || '⭐',
            sprite: kind === 'zombie' ? zombieSpriteFor(category) : null,
            koLook,
            anim: state === 'ko' ? 'ko' : 'idle', // atlas row; only meaningful for kind 'atlas'
        };
    }

    /**
     * Show / replace / dismiss state machine with an injected clock so it is
     * unit-testable. onChange(state) gets { routineId } or null. A new show()
     * REPLACES the current hero (no stacking) and restarts the timer.
     */
    function createController(opts) {
        const setT = opts.setTimeout || setTimeout;
        const clearT = opts.clearTimeout || clearTimeout;
        const durationMs = opts.durationMs;
        const onChange = opts.onChange || (() => {});
        let current = null;
        let timer = null;

        function clearTimer() {
            if (timer !== null) { clearT(timer); timer = null; }
        }
        function dismiss() {
            clearTimer();
            if (current === null) return false;
            current = null;
            onChange(null);
            return true;
        }
        function show(routineId) {
            if (routineId === null || routineId === undefined) return false;
            clearTimer();
            current = { routineId };
            onChange(current);
            timer = setT(() => { timer = null; dismiss(); }, durationMs);
            return true;
        }
        return { show, dismiss, get: () => current };
    }

    // ---- DOM ----------------------------------------------------------------
    let scrimEl = null;
    let heroEl = null;
    let controller = null;
    let lookup = null; // routineId -> routine (or null), supplied by script.js

    function renderInto(look) {
        heroEl.className = `hero-spotlight hero-spotlight--${look.state} hero-spotlight--${look.kind}`;
        heroEl.dataset.category = look.category;
        heroEl.dataset.routineId = look.routineId;
        heroEl.title = look.name;
        if (look.kind === 'atlas') {
            // Fresh nodes on every show(), so a KO animation always restarts at frame 1.
            heroEl.innerHTML = `<div class="hero-sprite" data-anim="${look.anim}"><div class="hero-sprite-sheet"></div></div>`;
        } else if (look.kind === 'zombie') {
            heroEl.innerHTML = `<img class="hero-spotlight-sprite" src="${look.sprite}" alt="">`;
        } else {
            heroEl.innerHTML = `<span class="hero-spotlight-emoji" aria-hidden="true">${look.emoji}</span>`;
        }
    }

    function applyActive(active) {
        scrimEl.classList.toggle('active', active);
        heroEl.classList.toggle('active', active);
    }

    /**
     * deps: { scrimEl, heroEl, config, getRoutine(routineId) -> routine|null }
     * Returns the controller (also kept internally for show/dismiss).
     */
    function init(deps) {
        scrimEl = deps.scrimEl;
        heroEl = deps.heroEl;
        lookup = deps.getRoutine;
        const config = deps.config;
        scrimEl.style.setProperty('--hero-scrim-opacity', String(config.HERO_SCRIM_OPACITY));
        controller = createController({
            durationMs: config.HERO_SPOTLIGHT_MS,
            onChange: (state) => {
                if (state === null) { applyActive(false); return; }
                const routine = lookup(state.routineId);
                if (!routine) { applyActive(false); return; }
                renderInto(heroLookFor(routine, config));
                applyActive(true);
            },
        });
        const dismissNow = () => controller.dismiss();
        scrimEl.addEventListener('click', dismissNow);
        heroEl.addEventListener('click', dismissNow);
        return controller;
    }

    function show(routineId) { return controller ? controller.show(routineId) : false; }
    function dismiss() { return controller ? controller.dismiss() : false; }
    // Routine id of the hero showing right now, or null (the Heroes tab mirrors it).
    function getCurrentRoutineId() {
        const current = controller ? controller.get() : null;
        return current ? current.routineId : null;
    }

    return {
        resolveRoutineForItem,
        heroLookFor,
        hasHeroArt,
        zombieSpriteFor,
        createController,
        init,
        show,
        dismiss,
        getCurrentRoutineId,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeroSpotlight;
}

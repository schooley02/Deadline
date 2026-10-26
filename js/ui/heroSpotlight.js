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
 *   - pure + node-testable: resolveRoutineForItem, resolveHeroForItem, heroLookFor, zombieSpriteFor,
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

    // Standalone items (no routine) stand for their own CATEGORY's hero (2026-10-26).
    // A pseudo-routine keyed '__cat:<category>' -- never stored, always rebuilt.
    const CATEGORY_HERO_PREFIX = '__cat:';

    function categoryHero(category, categories) {
        const cat = (Array.isArray(categories) && categories.indexOf(category) !== -1) ? category : 'other';
        return {
            id: CATEGORY_HERO_PREFIX + cat,
            name: cat.charAt(0).toUpperCase() + cat.slice(1),
            heroCategory: cat,
            isActive: true,
            frozenState: null,
            koState: null,
        };
    }

    function isCategoryHeroId(id) {
        return typeof id === 'string' && id.indexOf(CATEGORY_HERO_PREFIX) === 0;
    }

    /**
     * The hero for ANY item: its routine's hero when it has one (a sub-task uses its
     * parent's), else the pseudo-hero of the item's own category (a sub-task of a
     * standalone parent uses the parent's category).
     */
    function resolveHeroForItem(item, activeItems, findRoutine, categories) {
        if (!item) return null;
        const routine = resolveRoutineForItem(item, activeItems, findRoutine);
        if (routine) return routine;
        const parent = item.parentId ? (activeItems || []).find(i => i.id === item.parentId) : null;
        return categoryHero((parent || item).category, categories);
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

    // ---- One-shot reactions (hurt / levelup) ---------------------------------
    const ONESHOT_KINDS = ['hurt', 'levelup'];

    function oneShotFrames(kind, category, config) {
        const over = config.HERO_ONESHOT_FRAME_OVERRIDES && config.HERO_ONESHOT_FRAME_OVERRIDES[kind];
        return (over && over[category]) || config.HERO_ONESHOT_FRAMES || 9;
    }

    function oneShotMs(kind, category, config) {
        return Math.round(oneShotFrames(kind, category, config) / (config.HERO_ONESHOT_FPS || 10) * 1000);
    }

    /**
     * Pure decision: what should a hurt / levelup event do right now?
     * ctx: { kind, routine, visibleRoutineId (hero on screen or null), config }
     * -> { action: 'ignore' } | { action: 'play', ms } | { action: 'show', ms }
     * play = that routine's hero is already up; show = open the spotlight first
     * (level-up only, behind CONFIG.HERO_LEVELUP_AUTO_SHOW, only when nothing is showing).
     */
    function planReaction(ctx) {
        const { kind, routine, visibleRoutineId, config } = ctx;
        if (!routine || ONESHOT_KINDS.indexOf(kind) === -1) return { action: 'ignore' };
        const category = Heroes.heroCategoryFor(routine, config.HERO_CATEGORIES);
        if (!hasHeroArt(category, config)) return { action: 'ignore' }; // emoji heroes have no rows
        if (deriveState(routine) === 'ko') return { action: 'ignore' }; // the KO row owns a KO'd hero
        const ms = oneShotMs(kind, category, config);
        if (visibleRoutineId === routine.id) return { action: 'play', ms };
        if (kind === 'levelup' && config.HERO_LEVELUP_AUTO_SHOW && (visibleRoutineId === null || visibleRoutineId === undefined)) {
            return { action: 'show', ms };
        }
        return { action: 'ignore' };
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
    let configRef = null;
    // Work timer (Build 3): the hero stays up, attacking, with NO scrim while a
    // timer runs. `workRoutine` is a routine object (or the pseudo "Other" hero for
    // standalone items); a normal tap-show() temporarily replaces it.
    let workRoutine = null;

    let oneShotTimer = null;
    function clearOneShot() {
        if (oneShotTimer !== null) { clearTimeout(oneShotTimer); oneShotTimer = null; }
    }
    function spriteHtml(anim) {
        return `<div class="hero-sprite" data-anim="${anim}"><div class="hero-sprite-sheet"></div></div>`;
    }

    function renderInto(look) {
        clearOneShot();
        heroEl.className = `hero-spotlight hero-spotlight--${look.state} hero-spotlight--${look.kind}`;
        heroEl.dataset.category = look.category;
        heroEl.dataset.routineId = look.routineId;
        heroEl.title = look.name;
        if (look.kind === 'atlas') {
            // Fresh nodes on every show(), so a KO animation always restarts at frame 1.
            heroEl.innerHTML = spriteHtml(look.anim);
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
        const baseLookup = deps.getRoutine;
        lookup = (id) => (isCategoryHeroId(id)
            ? categoryHero(id.slice(CATEGORY_HERO_PREFIX.length), deps.config.HERO_CATEGORIES)
            : baseLookup(id));
        const config = deps.config;
        configRef = config;
        scrimEl.style.setProperty('--hero-scrim-opacity', String(config.HERO_SCRIM_OPACITY));
        controller = createController({
            durationMs: config.HERO_SPOTLIGHT_MS,
            onChange: (state) => {
                if (state === null) {
                    // Back to the working hero (no scrim) if a timer is running.
                    if (workRoutine) { renderWork(); } else { applyActive(false); }
                    return;
                }
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

    function renderWork() {
        if (!heroEl || !workRoutine) return;
        renderInto(heroLookFor(workRoutine, configRef));
        scrimEl.classList.remove('active');
        heroEl.classList.add('active');
        heroEl.classList.add('hero-spotlight--working');
    }
    // routine: a routine object, or null to stop. Idempotent.
    function setWork(routine) {
        workRoutine = routine || null;
        if (!heroEl) return;
        if (workRoutine) { renderWork(); return; }
        heroEl.classList.remove('hero-spotlight--working');
        if (!controller || controller.get() === null) applyActive(false);
    }
    function isWorking() { return workRoutine !== null; }

    // Routine id of the hero on screen: the tapped spotlight, else the working hero, else null.
    function visibleRoutineId() {
        const current = controller ? controller.get() : null;
        if (current) return current.routineId;
        return workRoutine ? workRoutine.id : null;
    }

    /**
     * Play the hurt / levelup row once on the hero that is on screen, then fall back to the
     * routine's resting look (idle, or KO if the hit was fatal). Level-up may open the spotlight
     * first (see planReaction). Returns true if something played.
     */
    function react(routineId, kind) {
        if (!heroEl || !controller || typeof lookup !== 'function') return false;
        const routine = lookup(routineId);
        const plan = planReaction({ kind, routine, visibleRoutineId: visibleRoutineId(), config: configRef });
        if (plan.action === 'ignore') return false;
        if (plan.action === 'show' && !controller.show(routineId)) return false;
        clearOneShot();
        heroEl.innerHTML = spriteHtml(kind);
        oneShotTimer = setTimeout(() => {
            oneShotTimer = null;
            const fresh = lookup(routineId);
            if (!fresh || heroEl.dataset.routineId !== String(routineId)) return;
            heroEl.innerHTML = spriteHtml(heroLookFor(fresh, configRef).anim);
        }, plan.ms);
        return true;
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
        resolveHeroForItem,
        categoryHero,
        isCategoryHeroId,
        heroLookFor,
        hasHeroArt,
        zombieSpriteFor,
        createController,
        init,
        show,
        dismiss,
        getCurrentRoutineId,
        planReaction,
        oneShotFrames,
        oneShotMs,
        react,
        setWork,
        isWorking,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeroSpotlight;
}

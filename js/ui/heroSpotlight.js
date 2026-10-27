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
    function heroLookFor(routine, config, opts) {
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
            // atlas row; only meaningful for kind 'atlas'. KO beats everything; a hero whose zombie is
            // attacking loops the hurt row (opts.underAttack, 2026-10-26).
            anim: state === 'ko' ? 'ko' : ((opts && opts.underAttack) ? 'hurtloop' : 'idle'),
        };
    }

    /**
     * Ids of the heroes whose zombies are attacking right now: any active item that is overdue and
     * threatening (same rule as the church pulse / base-health panel), resolved to its hero with
     * resolveHeroForItem (routine hero, else category hero).
     */
    function attackedHeroIds(activeItems, findRoutine, categories, isNonThreatening) {
        const seen = new Set();
        (activeItems || []).forEach(item => {
            if (!item || !item.isOverdue) return;
            if (typeof isNonThreatening === 'function' && isNonThreatening(item)) return;
            const hero = resolveHeroForItem(item, activeItems, findRoutine, categories);
            if (hero) seen.add(hero.id);
        });
        return Array.from(seen);
    }

    /**
     * Which of a hero's zombies it stands beside (2026-10-26: the hero takes that zombie's LANE).
     * Candidates = active items that resolve to `heroId`. Order: the explicitly preferred item
     * (the one tapped / the one the work timer runs on) if it is still a candidate, else an
     * attacker (overdue and threatening) before a calm one, then the soonest due, then lowest id.
     * Returns the item or null.
     */
    function pickLaneItem(heroId, activeItems, findRoutine, categories, preferredId, isNonThreatening) {
        const mine = (activeItems || []).filter(it => {
            if (!it) return false;
            const hero = resolveHeroForItem(it, activeItems, findRoutine, categories);
            return !!hero && String(hero.id) === String(heroId);
        });
        if (!mine.length) return null;
        if (preferredId !== null && preferredId !== undefined) {
            const pref = mine.find(it => it.id === preferredId);
            if (pref) return pref;
        }
        const attacking = it => (it.isOverdue && !(typeof isNonThreatening === 'function' && isNonThreatening(it))) ? 0 : 1;
        const dueMs = it => { const t = it.dueDateTime ? new Date(it.dueDateTime).getTime() : NaN; return isNaN(t) ? Infinity : t; };
        return mine.slice().sort((a, b) => (attacking(a) - attacking(b)) || (dueMs(a) - dueMs(b)) || (a.id - b.id))[0];
    }

    // ---- One-shot reactions (hurt / levelup / attack) -------------------------
    // attack (2026-10-26): plays once on the hero of an item the player just completed.
    const ONESHOT_KINDS = ['hurt', 'levelup', 'attack'];

    function oneShotFrames(kind, category, config) {
        const over = config.HERO_ONESHOT_FRAME_OVERRIDES && config.HERO_ONESHOT_FRAME_OVERRIDES[kind];
        return (over && over[category]) || config.HERO_ONESHOT_FRAMES || 9;
    }

    function oneShotMs(kind, category, config) {
        const fps = (kind === 'hurt' ? config.HERO_HURT_FPS : config.HERO_ONESHOT_FPS) || config.HERO_ONESHOT_FPS || 10;
        return Math.round(oneShotFrames(kind, category, config) / fps * 1000);
    }

    /**
     * Pure decision: what should a hurt / levelup / attack event do right now?
     * ctx: { kind, routine, visibleRoutineId (hero on screen or null), config }
     * -> { action: 'ignore' } | { action: 'play', ms } | { action: 'show', ms }
     * play = that routine's hero is already up; show = open the spotlight first
     * (level-up only, behind CONFIG.HERO_LEVELUP_AUTO_SHOW, only when nothing is showing).
     * attack (completion) ALWAYS shows: it opens the hero, or replaces whichever other hero is up,
     * behind CONFIG.HERO_ATTACK_ON_COMPLETE (default on).
     */
    function planReaction(ctx) {
        const { kind, routine, visibleRoutineId, config } = ctx;
        if (!routine || ONESHOT_KINDS.indexOf(kind) === -1) return { action: 'ignore' };
        const category = Heroes.heroCategoryFor(routine, config.HERO_CATEGORIES);
        if (!hasHeroArt(category, config)) return { action: 'ignore' }; // emoji heroes have no rows
        if (deriveState(routine) === 'ko') return { action: 'ignore' }; // the KO row owns a KO'd hero
        const ms = oneShotMs(kind, category, config);
        if (kind === 'attack') {
            if (config.HERO_ATTACK_ON_COMPLETE === false) return { action: 'ignore' };
            return { action: visibleRoutineId === routine.id ? 'play' : 'show', ms };
        }
        if (visibleRoutineId === routine.id) return { action: 'play', ms };
        if (kind === 'levelup' && config.HERO_LEVELUP_AUTO_SHOW && (visibleRoutineId === null || visibleRoutineId === undefined)) {
            return { action: 'show', ms };
        }
        return { action: 'ignore' };
    }

    /**
     * The level-up animation as inline markup for a MODAL (2026-10-26): the routine-level-up notice shows
     * the hero set as the routine's category playing its `levelup` row, looping while the modal is open.
     * '' for a category without hero art (the caller keeps its text-only heading).
     */
    function levelUpArtHtml(category, config) {
        if (!hasHeroArt(category, config)) return '';
        return `<div class="hero-notice-art" data-category="${category}" aria-hidden="true">`
            + '<div class="hero-sprite" data-anim="levelup"><div class="hero-sprite-sheet"></div></div></div>';
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
        // hold = stay up until dismissed (a selected row, 2026-10-26); otherwise auto-dismiss after durationMs.
        function show(routineId, hold) {
            if (routineId === null || routineId === undefined) return false;
            clearTimer();
            current = { routineId };
            onChange(current);
            if (!hold) timer = setT(() => { timer = null; dismiss(); }, durationMs);
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
        const onDismiss = typeof deps.onDismiss === 'function' ? deps.onDismiss : () => {};
        configRef = config;
        scrimEl.style.setProperty('--hero-scrim-opacity', String(config.HERO_SCRIM_OPACITY));
        controller = createController({
            durationMs: config.HERO_SPOTLIGHT_MS,
            onChange: (state) => {
                if (state === null) {
                    onDismiss();
                    // Back to the working hero (no scrim) if a timer is running.
                    if (workRoutine) { renderWork(); } else { applyActive(false); }
                    return;
                }
                const routine = lookup(state.routineId);
                if (!routine) { applyActive(false); return; }
                renderInto(heroLookFor(routine, config, { underAttack: isAttacked(routine.id) }));
                applyActive(true);
            },
        });
        const dismissNow = () => controller.dismiss();
        scrimEl.addEventListener('click', dismissNow);
        heroEl.addEventListener('click', dismissNow);
        return controller;
    }

    // Heroes whose zombies are attacking (set each tick by script.js). The hero on screen loops the
    // hurt row while its id is in here; KO, or a one-shot reaction in progress, wins.
    let attackedIds = new Set();
    let attackedSig = '';
    function isAttacked(id) { return id !== null && id !== undefined && attackedIds.has(String(id)); }
    function setAttackedHeroes(ids) {
        const list = Array.isArray(ids) ? ids.map(String).sort() : [];
        const sig = list.join('|');
        if (sig === attackedSig) return;
        const vid = visibleRoutineId();
        const was = isAttacked(vid);
        attackedIds = new Set(list);
        attackedSig = sig;
        if (!heroEl || typeof lookup !== 'function' || vid === null || vid === undefined || oneShotTimer !== null) return;
        const now = isAttacked(vid);
        if (now === was) return;
        const routine = lookup(vid);
        if (!routine) return;
        const look = heroLookFor(routine, configRef, { underAttack: now });
        if (look.kind !== 'atlas') return;
        heroEl.innerHTML = spriteHtml(look.anim);
    }

    // Lane (2026-10-26): script.js measures the focal zombie's feet line and hands over the distance
    // from the canvas bottom (px), or null for the default front-lane spot. Written only on change.
    let laneBottomPx = null;
    function setLaneBottom(px) {
        const v = (typeof px === 'number' && isFinite(px)) ? px : null;
        if (v === laneBottomPx) return;
        laneBottomPx = v;
        if (!heroEl) return;
        if (v === null) heroEl.style.removeProperty('--hero-lane-bottom');
        else heroEl.style.setProperty('--hero-lane-bottom', v + 'px');
    }

    function renderWork() {
        if (!heroEl || !workRoutine) return;
        renderInto(heroLookFor(workRoutine, configRef, { underAttack: isAttacked(workRoutine.id) }));
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
     * Play the hurt / levelup / attack row once on the hero that is on screen, then fall back to the
     * routine's resting look (idle, or KO if the hit was fatal). Level-up may open the spotlight
     * first (see planReaction). Attack always (re)shows the hero on a normal HERO_SPOTLIGHT_MS timer,
     * which also releases a held (selected-row) hero. Returns true if something played.
     */
    function react(routineId, kind) {
        if (!heroEl || !controller || typeof lookup !== 'function') return false;
        const routine = lookup(routineId);
        const plan = planReaction({ kind, routine, visibleRoutineId: visibleRoutineId(), config: configRef });
        if (plan.action === 'ignore') return false;
        if (kind === 'hurt' && isAttacked(routineId)) return false; // the hurt loop is already showing
        if (kind === 'attack') {
            if (!controller.show(routineId)) return false; // restarts the timer, drops any hold
        } else if (plan.action === 'show' && !controller.show(routineId)) return false;
        clearOneShot();
        heroEl.innerHTML = spriteHtml(kind);
        oneShotTimer = setTimeout(() => {
            oneShotTimer = null;
            const fresh = lookup(routineId);
            if (!fresh || heroEl.dataset.routineId !== String(routineId)) return;
            heroEl.innerHTML = spriteHtml(heroLookFor(fresh, configRef, { underAttack: isAttacked(routineId) }).anim);
        }, plan.ms);
        return true;
    }

    // opts.hold: no auto-dismiss (the caller dismisses it, e.g. when its row is deselected).
    function show(routineId, opts) { return controller ? controller.show(routineId, !!(opts && opts.hold)) : false; }
    function dismiss() { return controller ? controller.dismiss() : false; }
    // Routine id of the hero showing right now, or null (the Heroes tab mirrors it).
    function getCurrentRoutineId() {
        const current = controller ? controller.get() : null;
        return current ? current.routineId : null;
    }

    return {
        resolveRoutineForItem,
        resolveHeroForItem,
        pickLaneItem,
        setLaneBottom,
        getVisibleRoutineId: () => visibleRoutineId(),
        attackedHeroIds,
        setAttackedHeroes,
        isAttacked,
        categoryHero,
        isCategoryHeroId,
        heroLookFor,
        hasHeroArt,
        levelUpArtHtml,
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

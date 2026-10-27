/**
 * TimeSliderView — DOM wiring for the 24h preview slider (Milestone 4, "Time
 * slider (Today, then Week/Month scopes)", Today scope only this session,
 * 2026-07-20).
 *
 * Sits on the canvas/list seam (index.html, between .game-canvas and
 * .task-section — matches UI_UX.md's "sits ON the seam between canvas and
 * list"). Pure math lives in js/timeSlider.js (TimeSlider, read as a bare
 * stable global — clock.js/movement.js precedent); this module only touches
 * the DOM and the scrub/release lifecycle.
 *
 * PREVIEW-ONLY CONTRACT (PROJECT_SPEC.md: "preview only, no actual time
 * manipulation"): while scrubbing, js/loop.js's updateActiveItems returns
 * early (deps.isTimePreviewActive() guard, same "one owner at a time"
 * pattern as offline catch-up) — no damage, no regen, no real position
 * writes happen. This module repositions elements directly, exactly the way
 * offline catch-up's animation does, and strips itself out completely on
 * release so the next live tick (within GAME_TICK_MS) continues exactly
 * where it left off.
 *
 * Deps contract (see script.js's timeSliderDeps()):
 *   - sliderEl, labelEl: DOM handles (both optional collaborators — a
 *     missing element degrades to a silent no-op, same tolerance as
 *     enableFormControls' callers).
 *   - getActiveItems(): () => activeItems (plain reference, itemsDeps()
 *     precedent).
 *   - isNonThreatening: Items.isNonThreatening (bare pass-through, matches
 *     loopDeps()'s injection of the same collaborator).
 *   - calculateTimelineXWithClustering(item, time): script.js's existing
 *     two-arg wrapper — reused as-is, no new signature.
 *   - updateMidnightLine(time): script.js's existing one-arg wrapper —
 *     reused as-is; this is also what makes the midnight line itself
 *     preview-scrub correctly for free.
 *   - dims(): () => ({ gameScreenWidth, baseWidth, habitEnemyWidth }) — a
 *     FUNCTION (not a plain value) because these resolve inside initGame(),
 *     same reasoning as loopDeps()'s baseWidth/gameScreenWidth rebuild.
 *   - setTimePreviewActive(bool): flips script.js's timePreviewActive flag,
 *     read by loopDeps().isTimePreviewActive().
 *
 * Damage/routine-HP projection deps (added 2026-07-20, same session — see
 * js/timeSlider.js's header for the "why" of the math itself). ALL of the
 * below arrive as ONE optional-collaborator group, gated on
 * `typeof deps.getBaseHealth === 'function'` — a deps object that omits them
 * (e.g. every existing test in test/timeSliderView.test.js) just skips
 * damage/HP projection entirely and keeps working unchanged, same tolerance
 * pattern as loop.js's optional collaborators:
 *   - getBaseHealth(): () => number — current REAL base HP (frozen during a
 *     scrub, since loop.js's preview guard stops live damage/regen ticks).
 *   - getLastRegenTickMs(): () => number|null — regen tick anchor, same one
 *     js/loop.js reads/writes.
 *   - baseElement, baseHealthDisplayEl: DOM handles for the base sprite and
 *     the HUD's HP number.
 *   - resolveBaseImage(health): Damage.resolveBaseImage — pure, reused as-is
 *     to pick the right sprite for a PROJECTED (not real) health value.
 *   - getDefinedRoutines(): () => definedRoutines (GETTER — reassigned
 *     elsewhere, itemsDeps()/agendaListDeps() precedent).
 *   - getRoutineIdForItem(item): () => routineId|null — wraps
 *     Items.findRoutineForItem; script.js supplies definedHabits/
 *     definedRoutines accessors.
 *   - renderHeroesAtBase(routinesOverride?): script.js's existing wrapper,
 *     extended this session to accept an optional routines array so the
 *     SAME HeroesView render path draws projected health during a scrub —
 *     no new rendering code, no change to HeroesView itself.
 *   - heroBaseZoneEl: DOM handle, ghosted as a single container (opacity
 *     visually applies to all its chip children with no per-chip CSS
 *     needed).
 */
const TimeSliderView = (() => {
    let deps = null;
    let canvasEl = null; // #gameCanvas, carries .time-previewing while scrubbing

    // ---- Scrub-coupled animation (2026-10-27, Jeremy) -------------------------------------------
    // While the slider is dragged, every LOOPING animation on the zombie sprites, the visible hero and
    // the cloud drift is frozen (playbackRate 0) and its currentTime is moved by the slider delta x
    // CONFIG.SCRUB_ANIM_MS_PER_MINUTE: drag right plays forward, drag left plays in reverse, a still
    // finger holds the frame. Release restores playbackRate 1 so CSS playback carries on from there.
    // playbackRate/currentTime (NOT pause()/play()) on purpose: pause()/play() would permanently
    // override CSS `animation-play-state` (the day pager's `.enemy.time-preview-ghost` pause rule).
    // One-shot (finite) animations - hero attack/hurt/level-up, zombie death - are left alone.
    // The ground + hills no longer move with the slider (css/gameCanvas.css).
    const SCRUB_TARGETS = '#gameCanvas .enemy-sprite-sheet, #heroSpotlight .hero-sprite-sheet, #graveyardScene .scene-clouds-drift';
    const scrubbedAnims = new Set();
    let lastScrubMinutes = null;

    function scrubMsPerMinute() {
        const v = (typeof CONFIG !== 'undefined' && CONFIG) ? Number(CONFIG.SCRUB_ANIM_MS_PER_MINUTE) : NaN;
        return Number.isFinite(v) ? v : 20;
    }

    function scrubAnimations(deltaMinutes) {
        if (typeof document === 'undefined') return;
        const shift = deltaMinutes * scrubMsPerMinute();
        document.querySelectorAll(SCRUB_TARGETS).forEach((el) => {
            if (typeof el.getAnimations !== 'function') return;
            el.getAnimations().forEach((anim) => {
                const timing = (anim.effect && typeof anim.effect.getComputedTiming === 'function')
                    ? anim.effect.getComputedTiming() : null;
                if (!timing || timing.iterations !== Infinity) return;
                const dur = Number(timing.duration);
                if (!(dur > 0)) return;
                if (!scrubbedAnims.has(anim)) {
                    anim.playbackRate = 0;
                    scrubbedAnims.add(anim);
                }
                const delay = Number(timing.delay) || 0;
                const local = (Number(anim.currentTime) || 0) - delay + shift;
                anim.currentTime = delay + (((local % dur) + dur) % dur); // wrap, phase kept
            });
        });
    }

    // Rows of zombies that have REACHED the base at the previewed time get the
    // same red highlight as live attackers (2026-10-27, Jeremy: "which task to
    // focus on first" at a glance). Same rule as the damage projection: due at
    // or before the previewed time and not non-threatening. Live overdue rows
    // keep their own `.overdue-list-item` and stay red either way; release
    // (ghost=false) strips the preview class from every row.
    function markPreviewAttackers(time, ghost) {
        const previewMs = time.getTime();
        deps.getActiveItems().forEach((item) => {
            const row = item.listItemElement;
            if (!row || !row.classList) return;
            const due = item.dueDateTime ? new Date(item.dueDateTime).getTime() : NaN;
            const threat = !(typeof deps.isNonThreatening === 'function' && deps.isNonThreatening(item));
            const attacking = ghost && !item.isOverdue && threat && Number.isFinite(due) && due <= previewMs;
            row.classList.toggle('preview-attack-list-item', attacking);
        });
    }

    function releaseAnimations() {
        scrubbedAnims.forEach((anim) => { anim.playbackRate = 1; });
        scrubbedAnims.clear();
    }

    // Graveyard scene parallax (V1, 2026-07-21 — docs/VISUAL_DESIGN_PLAN.md).
    // Deliberately NOT threaded through the deps contract like the rest of
    // this module: it's a purely decorative, non-game-state DOM query
    // (matches the direct document.getElementById precedent already used
    // throughout js/ui/*.js), so a missing element (jsdom tests, or a stale
    // index.html) just no-ops rather than needing a fake collaborator in
    // every existing test's makeDeps(). Cached once in init() rather than
    // re-queried on every tick/scrub event.
    let sceneEl = null;

    // --scene-progress drives css/gameCanvas.css's .scene-clouds/.scene-
    // silhouettes translateX (ground is deliberately left unmoved — "ground
    // fixed" per the 2026-07-21 art-direction decision). Fed the SAME
    // minutes-of-day value the slider itself shows, whether that came from
    // a live tick (syncHandle) or an active scrub (handleScrubInput), so the
    // scene always reflects whatever time is currently on screen.
    function updateParallax(minutesOfDay) {
        if (!sceneEl) return;
        const progress = minutesOfDay / TimeSlider.MINUTES_PER_DAY;
        sceneEl.style.setProperty('--scene-progress', progress);
    }

    // Base/routine HP projection at `time` — optional collaborator GROUP
    // (see header). At time === now the projected delta is mathematically
    // zero (see js/timeSlider.js), so calling this on release with "now"
    // naturally restores the exact live values with no separate restore
    // path needed.
    function applyDamagePreview(time) {
        if (typeof deps.getBaseHealth !== 'function') return;

        const nowMs = Date.now();
        const previewMs = time.getTime();
        const items = deps.getActiveItems().filter((item) => !deps.isNonThreatening(item));
        const regenAnchor = deps.getLastRegenTickMs ? deps.getLastRegenTickMs() : null;

        const projectedHealth = TimeSlider.projectBaseHealth(items, deps.getBaseHealth(), previewMs, nowMs, regenAnchor);
        if (deps.baseHealthDisplayEl) deps.baseHealthDisplayEl.textContent = Math.round(projectedHealth);
        if (deps.baseElement && deps.applyBaseArt) {
            deps.applyBaseArt(deps.baseElement, projectedHealth); // static png + idle-loop key
        } else if (deps.baseElement && deps.resolveBaseImage) {
            deps.baseElement.style.backgroundImage = 'url("' + deps.resolveBaseImage(projectedHealth) + '")';
        }

        if (deps.getDefinedRoutines && deps.getRoutineIdForItem && deps.renderHeroesAtBase) {
            const deltas = TimeSlider.projectRoutineHealthDeltas(items, previewMs, nowMs, deps.getRoutineIdForItem);
            const routines = deps.getDefinedRoutines();
            const projectedRoutines = Object.keys(deltas).length === 0
                ? routines // no owning-routine items overdue in this window — identical to the real array
                : routines.map((routine) => {
                    const delta = deltas[routine.id];
                    // No more damage accrues once KO'd — matches items.js's
                    // damageRoutineForItem guard (`if (routine.koState) return`).
                    if (!delta || routine.koState) return routine;
                    const currentHealth = (typeof routine.health === 'number') ? routine.health : CONFIG.ROUTINE_MAX_HEALTH;
                    const projectedHealthForRoutine = Math.max(0, Math.min(CONFIG.ROUTINE_MAX_HEALTH, currentHealth - delta));
                    return Object.assign({}, routine, { health: projectedHealthForRoutine });
                });
            deps.renderHeroesAtBase(projectedRoutines);
        }
    }

    // Applies (or clears) preview positions + damage/HP projection for `time`.
    // `ghost` toggles the `.time-preview-ghost` styling class — true while
    // scrubbing, false for the instant snap-back on release.
    function applyPreview(time, ghost) {
        const dims = deps.dims();
        deps.getActiveItems().forEach((item) => {
            if (!item.element) return;
            const x = deps.calculateTimelineXWithClustering(item, time);
            item.element.style.left = Math.max(dims.baseWidth, x) + 'px';
            item.element.classList.toggle('time-preview-ghost', ghost);
        });
        markPreviewAttackers(time, ghost);
        deps.updateMidnightLine(time);

        if (deps.baseElement) deps.baseElement.classList.toggle('time-preview-ghost', ghost);
        if (deps.baseHealthDisplayEl) deps.baseHealthDisplayEl.classList.toggle('time-preview-ghost', ghost);
        if (deps.heroBaseZoneEl) deps.heroBaseZoneEl.classList.toggle('time-preview-ghost', ghost);
        // Hero spotlight (2026-10-27): ghosted via a class on #gameCanvas, NOT on
        // #heroSpotlight itself, because HeroSpotlight.renderInto() rewrites the
        // hero's className on every re-render and would drop the ghost mid-scrub.
        // css/timeSlider.css dims `.time-previewing .hero-spotlight.active`.
        if (canvasEl) canvasEl.classList.toggle('time-previewing', ghost);
        applyDamagePreview(time);
    }

    // Live-tick hook (js/loop.js, optional collaborator) — only ever called
    // when NOT previewing (loop.js's isTimePreviewActive() guard runs
    // first), so this never fights a scrub in progress.
    function syncHandle(time) {
        if (!deps || !deps.sliderEl) return;
        const dayStart = TimeSlider.getDayBounds(time).start;
        const minutes = TimeSlider.timeToMinutesOfDay(time, dayStart);
        deps.sliderEl.value = minutes;
        lastScrubMinutes = minutes; // rest position: the next drag's delta starts here
        if (deps.labelEl) deps.labelEl.textContent = TimeSlider.formatLabel(time);
        updateParallax(minutes);
    }

    function handleScrubInput() {
        const now = new Date();
        const dayStart = TimeSlider.getDayBounds(now).start;
        const minutes = Number(deps.sliderEl.value);
        const previewTime = TimeSlider.minutesOfDayToTime(minutes, dayStart);
        deps.setTimePreviewActive(true);
        if (deps.labelEl) deps.labelEl.textContent = TimeSlider.formatLabel(previewTime);
        applyPreview(previewTime, true);
        scrubAnimations(lastScrubMinutes == null ? 0 : minutes - lastScrubMinutes);
        lastScrubMinutes = minutes;
        // .parallax-scrubbing marks #graveyardScene for the duration of the scrub
        // (the clouds' drift is now driven by scrubAnimations, see above).
        if (sceneEl) sceneEl.classList.add('parallax-scrubbing');
        updateParallax(minutes);
    }

    // Idempotent by design — 'change'/'pointerup'/'touchend'/'blur' can fire
    // more than once per release (e.g. a browser sending both 'change' and
    // 'pointerup' for the same drag-end), and re-snapping to "now" a second
    // time is harmless (same values, maybe a few ms later). Simpler and more
    // robust than tracking which listener "owns" the release.
    function handleRelease() {
        deps.setTimePreviewActive(false);
        const now = new Date();
        applyPreview(now, false);
        releaseAnimations();
        if (sceneEl) sceneEl.classList.remove('parallax-scrubbing');
        syncHandle(now);
    }

    function init(injectedDeps) {
        deps = injectedDeps;
        sceneEl = (typeof document !== 'undefined') ? document.getElementById('graveyardScene') : null;
        canvasEl = (typeof document !== 'undefined') ? document.getElementById('gameCanvas') : null;
        if (!deps.sliderEl) return; // markup missing (e.g. a stale index.html) — degrade silently

        deps.sliderEl.min = 0;
        deps.sliderEl.max = TimeSlider.MINUTES_PER_DAY;
        deps.sliderEl.step = 1;
        syncHandle(new Date());

        // 'input' fires continuously while dragging/scrubbing (mouse, touch,
        // and arrow keys alike) — this is the live preview.
        deps.sliderEl.addEventListener('input', handleScrubInput);
        // 'change' covers mouse/touch release and committing a keyboard
        // value; pointerup/touchend/blur are belt-and-suspenders for the
        // rare case a browser fires release without a trailing 'change'
        // (mirrors popups.js's multi-listener release-safety precedent).
        ['change', 'pointerup', 'touchend', 'blur'].forEach((evt) => {
            deps.sliderEl.addEventListener(evt, handleRelease);
        });
    }

    return {
        init,
        syncHandle,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeSliderView;
}

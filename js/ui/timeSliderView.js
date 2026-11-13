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

    // Parked handle (2026-11-04, Jeremy: "make the slider not snap back to current time when not being used ... click
    // something that will make it snap back"). Releasing the handle on Today now LEAVES the preview on screen
    // (`parkedDayStartMs` = the start of the day it was parked on, null while live). The Now button (`nowBtnEl`, optional
    // dep `nowButtonEl`) returns to the current time; it shows whenever the slider is away from now: parked on Today
    // or another day on screen. While parked the live board waits (same preview flag the day pager uses), and the
    // loop's overdue hits catch up after Now.
    let parkedDayStartMs = null;
    let nowBtnEl = null;

    // Idle auto-return (2026-11-04, Jeremy): any tap, click, key or scroll on the page counts as activity; once the
    // slider has been away from now for CONFIG.TIME_PREVIEW_IDLE_RETURN_MS with none, checkIdleReturn (every tick)
    // does what the Now button does. Coming back to the app after a while therefore lands on the live board.
    let lastActivityMs = Date.now();
    const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    function noteActivity() { lastActivityMs = Date.now(); }

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

    // ---- Everything holds still while the slider is away from now (2026-11-12, Jeremy: "when you slide the animation to
    // any position other than now and let go, all animations on the canvas need to stop until the user hits the reset
    // button or the user starts using the slider again") ----------------------------------------------------------------
    // "Away" = the same test as the Now button: parked on Today, or another day on screen. While away, EVERY looping
    // animation under #gameCanvas (zombie sprites, the hero, clouds, stars, fog, glows, the church idle, weather layers,
    // ...) is held at playbackRate 0 -- not just the scrub targets. Finite one-shots (a zombie's death, the hero's attack
    // after a completion, an ice form) are left to finish so a tap made while parked never freezes half way. Uses
    // playbackRate for the same reason as the scrub (it leaves CSS animation-play-state alone). The tick hook below
    // (`holdAnimations`) also catches animations that start while away (a new zombie sprite, a sky change) and lets go of
    // everything once the slider is back on now. Dragging again still steps the frames (scrubAnimations); release holds.
    function isAway() {
        return isParked() || viewedOffset() !== 0;
    }

    function freezeLoopingAnimations() {
        if (typeof document === 'undefined') return;
        const root = canvasEl || document.getElementById('gameCanvas');
        if (!root || typeof root.getAnimations !== 'function') return;
        scrubbedAnims.forEach((anim) => { if (anim.playState === 'idle') scrubbedAnims.delete(anim); }); // finished / removed
        root.getAnimations({ subtree: true }).forEach((anim) => {
            if (scrubbedAnims.has(anim)) return;
            const timing = (anim.effect && typeof anim.effect.getComputedTiming === 'function')
                ? anim.effect.getComputedTiming() : null;
            if (!timing || timing.iterations !== Infinity) return; // one-shots finish on their own
            anim.playbackRate = 0;
            scrubbedAnims.add(anim);
        });
    }

    // Called on a release and every tick (script.js's checkDayPagerRollover): freeze while away, let go once back on now.
    function holdAnimations() {
        if (!deps) return;
        if (isAway()) freezeLoopingAnimations();
        else if (scrubbedAnims.size > 0) releaseAnimations();
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
        refreshNowButton();
    }

    // The day on screen when it is a ghosted future day (offsets 1..6 of the day pager), else null. While one is
    // showing, the slider belongs to THAT day: dragging slides its ghosts and never touches the real board, the
    // damage preview or the preview flag (the pager holds it on), and releasing leaves the handle where it is.
    function viewedOtherDayStart() {
        return (deps && typeof deps.getViewedDayStart === 'function') ? deps.getViewedDayStart() : null;
    }

    function isParked() {
        return parkedDayStartMs !== null;
    }

    function viewedOffset() {
        return (deps && typeof deps.getViewedDayOffset === 'function') ? deps.getViewedDayOffset() : 0;
    }

    // Now button: shown while the slider is away from the current time (parked on Today, or another day on screen).
    function refreshNowButton() {
        if (!nowBtnEl) return;
        const away = isParked() || viewedOffset() !== 0;
        if (nowBtnEl.hidden === away) nowBtnEl.hidden = !away;
        // "Preview only" note (2026-11-13), optional: shown on exactly the same test as the Now button.
        const note = (typeof document !== 'undefined') ? document.getElementById('timeSliderNote') : null;
        if (note && note.hidden === away) note.hidden = !away;
    }

    // Back to the live board at the current time: preview off, real positions + HP restored, handle on now.
    function returnToNow() {
        if (!deps) return;
        parkedDayStartMs = null;
        deps.setTimePreviewActive(false);
        const now = new Date();
        if (deps.sliderEl) applyPreview(now, false);
        releaseAnimations();
        if (sceneEl) sceneEl.classList.remove('parallax-scrubbing');
        syncHandle(now);
    }

    // The Now button. On another day it goes back to Today first (the day pager's Today render calls onTodayShown,
    // which returns here); on Today it just un-parks.
    function handleNowClick(e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        if (viewedOffset() !== 0 && typeof deps.goToToday === 'function') {
            deps.goToToday();
            if (isParked() || viewedOffset() !== 0) returnToNow(); // the pager's hook was missing: do it here
            return;
        }
        returnToNow();
    }

    // DayPagerView tells us Today is on screen. Coming back from another day always returns to now; a re-render of
    // Today itself (resize, list refresh) leaves a parked handle where the player put it.
    function onTodayShown(fromOtherDay) {
        if (!deps) return;
        if (isParked() && !fromOtherDay) { refreshNowButton(); return; }
        returnToNow();
    }

    function idleReturnMs() {
        const v = (typeof CONFIG !== 'undefined' && CONFIG) ? Number(CONFIG.TIME_PREVIEW_IDLE_RETURN_MS) : NaN;
        return Number.isFinite(v) ? v : 3 * 60 * 1000;
    }

    // Called every tick (script.js's checkDayPagerRollover). Returns true when it brought the slider back.
    function checkIdleReturn(nowMs) {
        if (!deps || !deps.sliderEl) return false;
        const limit = idleReturnMs();
        if (!(limit > 0)) return false;
        if (!isParked() && viewedOffset() === 0) return false;
        const t = Number.isFinite(nowMs) ? nowMs : Date.now();
        if (t - lastActivityMs < limit) return false;
        lastActivityMs = t;
        handleNowClick();
        return true;
    }

    // Called every tick (script.js's checkDayPagerRollover): a handle parked on Today returns to now once real time
    // crosses midnight, so the board never keeps previewing a day that is over.
    function checkParkedRollover(now) {
        if (!isParked()) return;
        const t = now || new Date();
        if (TimeSlider.getDayBounds(t).start.getTime() !== parkedDayStartMs) returnToNow();
    }

    function handleScrubInput() {
        noteActivity();
        const otherDayStart = viewedOtherDayStart();
        if (otherDayStart) {
            const otherMinutes = Number(deps.sliderEl.value);
            const otherTime = TimeSlider.minutesOfDayToTime(otherMinutes, otherDayStart);
            if (deps.labelEl) deps.labelEl.textContent = TimeSlider.formatLabel(otherTime);
            if (typeof deps.onOtherDayScrub === 'function') deps.onOtherDayScrub(otherTime);
            lastScrubMinutes = otherMinutes;
            updateParallax(otherMinutes);
            return;
        }
        const now = new Date();
        const dayStart = TimeSlider.getDayBounds(now).start;
        const minutes = Number(deps.sliderEl.value);
        const previewTime = TimeSlider.minutesOfDayToTime(minutes, dayStart);
        deps.setTimePreviewActive(true);
        parkedDayStartMs = dayStart.getTime();
        refreshNowButton();
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
    // 'pointerup' for the same drag-end). Since 2026-11-04 a release no longer
    // snaps back to now on ANY day: the preview stays where the player left it
    // and the Now button brings it back. Since 2026-11-12 a release also HOLDS every looping animation on the canvas
    // (holdAnimations) until Now or the next drag; it no longer hands them back to CSS.
    function handleRelease() {
        noteActivity();
        if (viewedOtherDayStart()) { holdAnimations(); return; }
        holdAnimations();
        if (sceneEl) sceneEl.classList.remove('parallax-scrubbing');
        refreshNowButton();
    }

    function init(injectedDeps) {
        deps = injectedDeps;
        sceneEl = (typeof document !== 'undefined') ? document.getElementById('graveyardScene') : null;
        canvasEl = (typeof document !== 'undefined') ? document.getElementById('gameCanvas') : null;
        if (!deps.sliderEl) return; // markup missing (e.g. a stale index.html) — degrade silently
        parkedDayStartMs = null;
        noteActivity();
        if (typeof document !== 'undefined') {
            ACTIVITY_EVENTS.forEach((evt) => document.addEventListener(evt, noteActivity, { capture: true, passive: true }));
        }
        nowBtnEl = deps.nowButtonEl || null;
        if (nowBtnEl) {
            nowBtnEl.hidden = true;
            nowBtnEl.addEventListener('click', handleNowClick);
        }

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
        returnToNow,
        onTodayShown,
        checkParkedRollover,
        checkIdleReturn,
        isParked,
        isAway,
        holdAnimations,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeSliderView;
}

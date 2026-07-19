/**
 * Damage — base health, damage ticks, game over, and both catch-up paths
 * (Milestone 2 extraction #3, 2026-07-18).
 *
 * Extracted from script.js. Absorbs, per the ROADMAP scope note:
 *   - damageBase / gameOver / updateBaseVisuals / computeDaysSurvived
 *   - the offline catch-up code deliberately deferred from the clock.js
 *     extraction (computeOfflineOverdueDamage, applyOfflineDamage,
 *     runOfflineCatchUp)
 *   - runLiveGapCatchUp (the suspended-loop path added 2026-07-18)
 *
 * Follows the clock.js / movement.js / spawning.js pattern: collaborators and
 * state arrive in an explicit `deps` object rather than via closure, CONFIG
 * stays a global, and script.js keeps thin wrappers so every call site is
 * unchanged. Behavior-identical extraction — no balance numbers changed.
 *
 * ONE DIFFERENCE from the earlier extractions: this module WRITES state that
 * script.js owns (`baseHealth`, `gameIsOver`), where clock/movement/spawning
 * only read. Rather than move ownership of those `let`s into the module — which
 * would touch all 68 of their references across script.js and stop this being a
 * behavior-identical extraction — state is reached through accessor deps,
 * extending the `isGameOver()` precedent spawning.js already set. Ownership can
 * move later once more of script.js is modularized.
 *
 * deps = {
 *   // --- state accessors ---
 *   getBaseHealth,        // () -> number
 *   setBaseHealth,        // (n) -> void
 *   isGameOver,           // () -> boolean
 *   setGameOver,          // () -> void
 *   getActiveItems,       // () -> item[]
 *   getRunStartedAtMs,    // () -> number|null
 *   setDaysSurvived,      // (n) -> void
 *   setOfflineCatchUpActive, // (bool) -> void
 *   getGameLoopInterval,  // () -> intervalId
 *   baseWidth,            // BASE_WIDTH (px)
 *   gameScreenWidth,      // GAME_SCREEN_WIDTH (px) — [P1-DATA-005] session 29,
 *                         //   the negative-habit lurker's fixed x anchor
 *
 *   // --- DOM handles (may be null; every use is guarded) ---
 *   baseElement, baseHealthDisplay, gameOverMessage, restartButton,
 *
 *   // --- collaborators ---
 *   markAsOverdue,               // (item, nowDate) -> void   (stays in script.js:
 *                                //   it also resets habit streaks, so it belongs
 *                                //   with the future habits extraction)
 *   getSubTaskClusterOffset,     // (item) -> px
 *   calculateTimelineXWithClustering, // (item, nowDate) -> px
 *   enableFormControls,          // (bool) -> void
 *   saveGame,                    // () -> void
 *   isNonThreatening             // (item) -> bool  ([P1-DATA-005] session 27,
 *                                //   Items.isNonThreatening — optional; the
 *                                //   pure catch-up functions fall back to an
 *                                //   inline equivalent if omitted)
 * }
 */
const Damage = (() => {

    // ---------------------------------------------------------------------
    // Pure cores — no DOM, no state. These are what the unit tests target.
    // ---------------------------------------------------------------------

    // Real calendar days elapsed since the run started. Replaces the old
    // accelerated 60s-per-"day" interval, which both over-counted short waking
    // sessions and stopped entirely while the machine slept (see DECISIONS.md
    // 2026-07-18).
    function computeDaysSurvived(runStartedAtMs, nowMs, msPerRealDay) {
        if (!runStartedAtMs) return 0;
        const perDay = msPerRealDay || CONFIG.MS_PER_REAL_DAY;
        return Math.max(0, Math.floor((nowMs - runStartedAtMs) / perDay));
    }

    // Which base sprite corresponds to a given health value.
    function resolveBaseImage(baseHealth) {
        if (baseHealth > 75) return 'base_100.png';
        if (baseHealth > 50) return 'base_075.png';
        if (baseHealth > 25) return 'base_050.png';
        if (baseHealth > 0) return 'base_025.png';
        return 'base_000.png';
    }

    // Back-charged damage for ONE item across an offline window.
    //
    // alreadyCharged is the item's LIFETIME offline total (not per-restore), so
    // re-closing/reopening the same still-overdue item across many days can
    // never charge more than the cap in total — duration of neglect shouldn't
    // matter more than once it's already been "paid"; only breadth across
    // multiple items should be able to add up to real base damage. Items
    // already overdue before the save were charged live while the game was
    // open, so the window starts at the LATER of (due time, start of offline
    // window) — no double-charging with the live tick loop either.
    function computeOfflineOverdueDamage(dueMs, nowMs, offlineMs, alreadyCharged) {
        const remaining = CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM - (alreadyCharged || 0);
        if (offlineMs <= 0 || dueMs >= nowMs || remaining <= 0) return 0;
        const overdueStartMs = Math.max(dueMs, nowMs - offlineMs);
        const ticks = Math.floor((nowMs - overdueStartMs) / CONFIG.DAMAGE_INTERVAL_MS);
        return Math.min(ticks * CONFIG.OVERDUE_DAMAGE, remaining);
    }

    // The decision half of runLiveGapCatchUp, separated so it can be tested on
    // plain objects with no DOM and no markAsOverdue side effects.
    //
    // Returns { hits: [{item, dmg}], newlyOverdue: [item] }. Items in
    // newlyOverdue fell due DURING the gap and have not been marked yet; the
    // caller marks them (which parks lastDamageTickTime at the due time —
    // exactly the window being charged) before the returned hits are applied.
    //
    // Pending ticks come from lastDamageTickTime and the clock is advanced by
    // WHOLE intervals only, keeping the sub-interval remainder. Computing from
    // the gap window instead would floor() each window to zero for a background
    // tab ticking once a minute, making backgrounding a damage-evasion loophole.
    //
    // isNonThreatening (optional, [P1-DATA-005] session 27): a negative-habit
    // lurker must never be charged catch-up damage or marked overdue for a
    // gap it spent lurking. Defaults to the same check Items.isNonThreatening
    // makes (kept inline so this pure function stays dependency-free — see
    // items.js's header comment for why the two can't just share one
    // reference across the script-load boundary).
    function computeGapCatchUpHits(activeItems, nowMs, markFn, isNonThreatening) {
        const isLurker = isNonThreatening || ((item) => item.type === 'habit' && item.isNegative === true);
        const hits = [];
        const newlyOverdue = [];

        activeItems.forEach(item => {
            if (isLurker(item)) return; // never overdue, never damaged
            if (item.dueDateTime.getTime() > nowMs) return; // not due yet

            if (!item.isOverdue) {
                newlyOverdue.push(item);
                if (markFn) markFn(item);
            }

            const pendingTicks = Math.floor((nowMs - item.lastDamageTickTime) / CONFIG.DAMAGE_INTERVAL_MS);
            if (pendingTicks <= 0) return;
            item.lastDamageTickTime += pendingTicks * CONFIG.DAMAGE_INTERVAL_MS;

            const remaining = CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM - (item.offlineDamageCharged || 0);
            const dmg = Math.min(pendingTicks * CONFIG.OVERDUE_DAMAGE, Math.max(0, remaining));
            if (dmg > 0) hits.push({ item, dmg });
        });

        return { hits, newlyOverdue };
    }

    // Duration of the offline catch-up animation for N moving sprites.
    function computeCatchUpDuration(animatableCount) {
        return Math.max(
            CONFIG.OFFLINE_CATCHUP_MIN_MS,
            Math.min(CONFIG.OFFLINE_CATCHUP_MAX_MS, animatableCount * CONFIG.OFFLINE_CATCHUP_MS_PER_ITEM)
        );
    }

    // ---------------------------------------------------------------------
    // Stateful / DOM-side-effecting operations
    // ---------------------------------------------------------------------

    // Whole-interval regen ticks elapsed in a span of time (mirrors the
    // damage-tick shape). Negative/zero elapsedMs yields 0 — never regens
    // backwards.
    function computeRegenTicks(elapsedMs, intervalMs) {
        if (elapsedMs <= 0) return 0;
        return Math.floor(elapsedMs / intervalMs);
    }

    function updateBaseVisuals(deps) {
        const { baseElement, getBaseHealth } = deps;
        if (!baseElement) return;

        const newBaseImage = resolveBaseImage(getBaseHealth());
        const currentBgImage = baseElement.style.backgroundImage;
        const targetBgImage = `url("${newBaseImage}")`;

        if (newBaseImage && currentBgImage !== targetBgImage) {
            baseElement.style.backgroundImage = targetBgImage;
        }
    }

    function damageBase(amount, deps) {
        const { getBaseHealth, setBaseHealth, isGameOver, baseElement, baseHealthDisplay, saveGame } = deps;
        if (isGameOver()) return;

        let baseHealth = getBaseHealth() - amount;
        if (baseHealth < 0) baseHealth = 0;
        setBaseHealth(baseHealth);

        if (baseHealthDisplay) baseHealthDisplay.textContent = baseHealth;

        // Visual feedback
        if (baseElement) {
            baseElement.classList.add('base-hit-flash');
            setTimeout(() => {
                baseElement.classList.remove('base-hit-flash');
            }, 300);
        }

        updateBaseVisuals(deps);
        saveGame();

        if (baseHealth <= 0) {
            gameOver(deps);
        }
    }

    // Gradual regen ([P2-GAME-012], decided 2026-07-18 Fable session). No
    // hit-flash (that's damage-specific feedback) — otherwise mirrors
    // damageBase's shape: clamp, display, visuals, save. No-ops on 0/negative
    // amounts and once the run is over.
    function healBase(amount, deps) {
        const { getBaseHealth, setBaseHealth, isGameOver, baseHealthDisplay, saveGame } = deps;
        if (isGameOver()) return;
        if (!amount || amount <= 0) return;

        let baseHealth = getBaseHealth() + amount;
        if (baseHealth > CONFIG.MAX_BASE_HEALTH) baseHealth = CONFIG.MAX_BASE_HEALTH;
        setBaseHealth(baseHealth);

        if (baseHealthDisplay) baseHealthDisplay.textContent = baseHealth;

        updateBaseVisuals(deps);
        saveGame();
    }

    // Applies regen for a span of elapsed time (offline window, or the gap
    // since the live loop's last regen tick), then resets the regen clock to
    // now. Used by both the offline-catch-up (reload) and live-gap-catch-up
    // (suspended loop) paths — deliberately loses any sub-interval remainder
    // at the reset point rather than carrying it forward, matching the
    // "quiet base recovers overnight" design intent rather than damage's
    // stricter remainder-preserving tick (see MECHANICS.md Offline Catch-up).
    // Guards on deps.setLastRegenTickMs being present so callers/tests that
    // don't thread it through (script.js not yet wired, or a deps stub) are
    // unaffected.
    function applyElapsedRegen(elapsedMs, deps) {
        const ticks = computeRegenTicks(elapsedMs, CONFIG.BASE_REGEN_INTERVAL_MS);
        if (ticks > 0) healBase(ticks * CONFIG.BASE_REGEN_HP, deps);
        if (deps.setLastRegenTickMs) deps.setLastRegenTickMs(Date.now());
    }

    function gameOver(deps) {
        const {
            setGameOver, getGameLoopInterval, getRunStartedAtMs, setDaysSurvived,
            gameOverMessage, restartButton, baseElement, enableFormControls, saveGame
        } = deps;

        setGameOver();
        clearInterval(getGameLoopInterval());

        // Freeze the real-time day count at the moment of death, so the
        // message and the saved run history agree afterwards.
        const daysSurvived = computeDaysSurvived(getRunStartedAtMs(), Date.now(), CONFIG.MS_PER_REAL_DAY);
        setDaysSurvived(daysSurvived);

        if (gameOverMessage) {
            const dayLabel = daysSurvived === 1 ? 'Day' : 'Days';
            gameOverMessage.textContent = `GAME OVER! Your Base Survived ${daysSurvived} ${dayLabel}.`;
            gameOverMessage.classList.remove('hidden');
        }

        if (restartButton) restartButton.classList.remove('hidden');
        if (baseElement) baseElement.style.backgroundImage = "url('base_000.png')";

        enableFormControls(false);
        saveGame();
    }

    function applyOfflineDamage(hits, deps) {
        for (const hit of hits) {
            if (deps.isGameOver()) break;
            hit.item.offlineDamageCharged = (hit.item.offlineDamageCharged || 0) + hit.dmg;
            damageBase(hit.dmg, deps);
        }
    }

    // The page stayed open but the game loop stopped running for a while
    // (laptop sleep, throttled background tab). There was no reload, so
    // restoreGameState()/runOfflineCatchUp() never ran — yet updateActiveItems()
    // would happily replay the entire gap at one DAMAGE_INTERVAL_MS per 50ms
    // tick (~120 damage in 6s after a 10-hour sleep, flattening the base).
    //
    // Treat the gap as time the player was away: charge the same per-item,
    // LIFETIME-capped damage a reload would (shared offlineDamageCharged
    // budget), then park each overdue item's damage clock at the caught-up
    // time so the live loop resumes normally from here.
    function runLiveGapCatchUp(deps) {
        const {
            isGameOver, getActiveItems, markAsOverdue,
            getSubTaskClusterOffset, baseWidth, isNonThreatening
        } = deps;

        if (isGameOver()) return;
        const nowMs = Date.now();
        const now = new Date();

        const { hits } = computeGapCatchUpHits(getActiveItems(), nowMs, item => {
            item.x = baseWidth + getSubTaskClusterOffset(item);
            markAsOverdue(item, now);
            if (item.element) item.element.style.left = item.x + 'px';
        }, isNonThreatening);

        applyOfflineDamage(hits, deps); // increments offlineDamageCharged + saves via damageBase

        // Regen for the same suspended span, AFTER damage — mirrors the
        // reload path's order (see MECHANICS.md Base). Uses the gap since the
        // live loop's own last regen tick, not this function's local nowMs
        // window, so a long string of short suspensions can't each restart
        // the clock and lose the remainder repeatedly.
        if (deps.getLastRegenTickMs) {
            const lastRegen = deps.getLastRegenTickMs();
            const elapsed = lastRegen !== null ? nowMs - lastRegen : 0;
            applyElapsedRegen(elapsed, deps);
        }
    }

    // Spec (PROJECT_SPEC §3.5): on app resume, zombies animate from their saved
    // positions to their current-time positions in ≤5s, then offline consequences
    // apply. entries = [{ item, savedX }] in saved order (parents before sub-tasks,
    // so cluster targets resolve against updated parent positions).
    function runOfflineCatchUp(entries, offlineMs, deps) {
        const {
            isGameOver, getActiveItems, calculateTimelineXWithClustering,
            baseWidth, gameScreenWidth, setOfflineCatchUpActive, isNonThreatening
        } = deps;

        if (isGameOver()) return;
        const nowMs = Date.now();
        const now = new Date();
        const isLurker = isNonThreatening || ((item) => item.type === 'habit' && item.isNegative === true);

        const hits = [];
        getActiveItems().forEach(item => {
            if (isLurker(item)) return; // [P1-DATA-005] session 27 — no offline damage for lurkers
            const dmg = computeOfflineOverdueDamage(
                item.dueDateTime.getTime(), nowMs, offlineMs, item.offlineDamageCharged
            );
            if (dmg > 0) hits.push({ item, dmg });
        });

        // Compute target positions in order, updating item.x as we go so
        // sub-task clustering sees its parent's target, not its saved x. A
        // lurker's target is its fixed lurk position — anchored to the far
        // right of the canvas since session 29, never a timeline calc.
        // Overdue items already had x set to the base by addItemToGame.
        entries.forEach(e => {
            if (isLurker(e.item)) {
                e.targetX = gameScreenWidth - CONFIG.HABIT_ENEMY_WIDTH - CONFIG.NEGATIVE_LURK_RIGHT_MARGIN_PX;
            } else {
                e.targetX = e.item.isOverdue
                    ? e.item.x
                    : calculateTimelineXWithClustering(e.item, now);
            }
            e.item.x = e.targetX;
        });

        const animatable = entries.filter(e =>
            e.savedX !== null && e.item.element &&
            Math.abs(e.targetX - e.savedX) > 2
        );

        // Brief absence or nothing moved: apply consequences instantly.
        if (offlineMs < CONFIG.OFFLINE_ANIMATION_THRESHOLD_MS || animatable.length === 0) {
            entries.forEach(e => {
                if (e.item.element) e.item.element.style.left = Math.max(baseWidth, e.targetX) + 'px';
            });
            applyOfflineDamage(hits, deps);
            applyElapsedRegen(offlineMs, deps); // AFTER damage — see MECHANICS.md Base
            return;
        }

        setOfflineCatchUpActive(true);
        const duration = computeCatchUpDuration(animatable.length);
        animatable.forEach(e => {
            e.item.element.style.left = Math.max(baseWidth, e.savedX) + 'px';
            e.item.element.classList.add('catching-up');
        });

        const startTime = performance.now();
        function frame(t) {
            const p = Math.min(1, (t - startTime) / duration);
            const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
            animatable.forEach(e => {
                const x = e.savedX + (e.targetX - e.savedX) * eased;
                e.item.element.style.left = Math.max(baseWidth, x) + 'px';
            });
            if (p < 1) {
                requestAnimationFrame(frame);
                return;
            }
            animatable.forEach(e => e.item.element.classList.remove('catching-up'));
            setOfflineCatchUpActive(false);
            applyOfflineDamage(hits, deps);
            applyElapsedRegen(offlineMs, deps); // AFTER damage — see MECHANICS.md Base
        }
        requestAnimationFrame(frame);
    }

    return {
        // pure
        computeDaysSurvived,
        resolveBaseImage,
        computeOfflineOverdueDamage,
        computeGapCatchUpHits,
        computeCatchUpDuration,
        computeRegenTicks,
        // stateful
        updateBaseVisuals,
        damageBase,
        healBase,
        applyElapsedRegen,
        gameOver,
        applyOfflineDamage,
        runLiveGapCatchUp,
        runOfflineCatchUp,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Damage;
}

/**
 * FrozenNotice — the one-time modal shown the moment a routine freezes
 * (Milestone 3, "Frozen routine slots + recovery" ticket, sub-session 3,
 * 2026-07-19, docs/FROZEN_SLOTS_PLAN.md).
 *
 * Fires from js/items.js's maybeFreezeRoutine, exactly on the transition
 * from unfrozen -> frozen (never again while it stays frozen — see
 * items.js's own guard against re-notifying an already-frozen routine).
 * DOM-only, same shared-module pattern as popups.js/checkIn.js: Modal is
 * called as a bare stable global (fully extracted, loaded first).
 *
 * TONE: PROJECT_SPEC.md ~2696 asks for a "non-judgmental tooltip or modal,
 * focusing on the path to recovery" — this copy deliberately avoids blame
 * language ("you failed") in favor of a plain statement of what happened and
 * what to do about it. Both recovery paths (ROUTINES.md) are listed so the
 * player isn't left guessing.
 *
 * THE setTimeout(0) HAZARD (found live-verifying this session — same class
 * of bug as session 21's shop bug / session 34's Cheat Day popup rebuild):
 * the trigger site is the "I indulged" button inside popups.js's enemy-click
 * popup, whose handler calls `deps.indulgeHabit(item.id)` (which fires this
 * notice SYNCHRONOUSLY via items.js's onRoutineFrozen callback) and THEN
 * `Modal.closeModal()` — which removes ALL `.modal-overlay` elements, not
 * just the popup that opened it. Inserting this notice synchronously meant
 * closeModal() deleted it in the same tick, before it ever painted. Fix:
 * defer the insertion one tick via setTimeout(0), so it lands AFTER the
 * click handler's closeModal() call has already run.
 */
const FrozenNotice = (() => {
    function showFrozenRoutineNotice(routineName, habitName) {
        setTimeout(() => {
            // Don't stack a second notice (e.g. two habits in the same
            // routine both crossing their freeze threshold in the same tick
            // — the routine can only be frozen by one of them, but
            // belt-and-suspenders matches checkIn.js's precedent).
            if (document.querySelector('.frozen-notice-overlay')) return;

            const modalHtml = `
                <div class="modal-overlay frozen-notice-overlay">
                    <div class="modal-content frozen-notice-modal">
                        <h3>🥶 ${routineName} is frozen</h3>
                        <p>"${habitName}" has been indulged 3 days in a row, so ${routineName} is
                           taking a break — its other habits and tasks won't spawn until it recovers.
                           This isn't a punishment, just a signal that something about this habit
                           might be worth adjusting.</p>
                        <p><strong>Two ways to unfreeze it:</strong></p>
                        <ul class="frozen-notice-recovery-list">
                            <li>Successfully avoid "${habitName}" for 3 days in a row, or</li>
                            <li>Edit "${habitName}"'s details — any real change counts</li>
                        </ul>
                        <div class="modal-buttons">
                            <button class="primary-button" onclick="closeModal()">Got it</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }, 0);
    }

    // Recovery path 1 (sub-session 4, 2026-07-19, docs/FROZEN_SLOTS_PLAN.md):
    // fires from Routines.editHabitInRoutine's onRoutineUnfrozen callback the
    // moment a REAL edit to the offending habit clears its routine's
    // frozenState. Same setTimeout(0) defensive pattern as
    // showFrozenRoutineNotice — the edit-habit modal's save handler
    // (RoutineViews.saveEditedHabit) calls Modal.closeModal() right after
    // triggering this, which would otherwise delete the notice before it
    // painted (the recurring session 21/34/37 DOM-race hazard).
    function showRoutineUnfrozenNotice(routineName, habitName) {
        setTimeout(() => {
            if (document.querySelector('.frozen-notice-overlay')) return;

            const modalHtml = `
                <div class="modal-overlay frozen-notice-overlay">
                    <div class="modal-content frozen-notice-modal">
                        <h3>🎉 ${routineName} is unfrozen</h3>
                        <p>Editing "${habitName}" counted as a real change, so ${routineName} is back
                           to normal — its habits and tasks will spawn again.</p>
                        <div class="modal-buttons">
                            <button class="primary-button" onclick="closeModal()">Got it</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }, 0);
    }

    // KO notice ([P1-UI-006] sub-session 2, 2026-07-19, docs/HEROES_PLAN.md
    // fork 2): fires from js/items.js's damageRoutineForItem the moment a
    // routine's health hits 0 and it auto-deactivates. Same setTimeout(0)
    // defensive pattern as the other two notices, even though this trigger
    // site (a damage tick, not a modal-closing button click) doesn't share
    // their specific closeModal() race — consistency with the precedent
    // costs nothing and guards against a future trigger site that does.
    function showRoutineKoNotice(routineName) {
        setTimeout(() => {
            if (document.querySelector('.frozen-notice-overlay')) return;

            const modalHtml = `
                <div class="modal-overlay frozen-notice-overlay">
                    <div class="modal-content frozen-notice-modal">
                        <h3>💤 ${routineName} was knocked out</h3>
                        <p>${routineName}'s health ran out from overdue habits/tasks, so it's been
                           deactivated — its members are off the board for now, no completion credit
                           lost. You can revive it starting tomorrow, at half health.</p>
                        <div class="modal-buttons">
                            <button class="primary-button" onclick="closeModal()">Got it</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }, 0);
    }

    // Star-threshold-crossed notice ([P1-UI-006] sub-session 3, 2026-07-19,
    // PROJECT_SPEC ~84): fires from js/ui/heroes.js's renderHeroesAtBase the
    // first time a routine's live star rating actually increases (tracked in
    // an ephemeral, non-persisted per-session memory — see heroes.js's header
    // for why). Trigger site is a render call inside a 50ms game-loop tick,
    // not a modal-closing click, but the setTimeout(0) defensive pattern
    // costs nothing and matches every other notice here.
    function showHeroStarUpNotice(routineName, stars) {
        setTimeout(() => {
            if (document.querySelector('.frozen-notice-overlay')) return;

            const modalHtml = `
                <div class="modal-overlay frozen-notice-overlay">
                    <div class="modal-content frozen-notice-modal">
                        <h3>${'★'.repeat(stars)} ${routineName} leveled up its rating</h3>
                        <p>${routineName} is now rated ${stars} star${stars === 1 ? '' : 's'} — keep it up!</p>
                        <div class="modal-buttons">
                            <button class="primary-button" onclick="closeModal()">Nice</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }, 0);
    }

    // Streak milestone notice ([P2-UI-009], Milestone 4, session 59,
    // 2026-07-19): fires from js/items.js's notifyStreakMilestone the moment
    // a habit's streak crosses one of the two visual tiers (config.js
    // HABIT_STREAK_BONUS_THRESHOLD = "fire", HABIT_STREAK_STRONG_THRESHOLD =
    // "blazing") via a LIVE player action — never on the silent restore-time
    // auto-resolve path (see items.js's notifyStreakMilestone comment). Same
    // setTimeout(0) + `.frozen-notice-overlay` dedupe pattern as every other
    // notice in this module.
    function showStreakMilestoneNotice(habitName, streak, tier) {
        setTimeout(() => {
            if (document.querySelector('.frozen-notice-overlay')) return;

            const isBlazing = tier === 'blazing';
            const emoji = isBlazing ? '🔥🔥' : '🔥';
            const headline = isBlazing
                ? `${habitName} is blazing!`
                : `${habitName} is on fire!`;
            const body = isBlazing
                ? `${streak}-day streak — that's serious consistency. Keep it going!`
                : `${streak}-day streak — this habit is heating up.`;

            const modalHtml = `
                <div class="modal-overlay frozen-notice-overlay">
                    <div class="modal-content frozen-notice-modal">
                        <h3>${emoji} ${headline}</h3>
                        <p>${body}</p>
                        <div class="modal-buttons">
                            <button class="primary-button" onclick="closeModal()">Nice</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }, 0);
    }

    // Achievement unlock notice (Milestone 4 achievements sub-session 2,
    // session 65, docs/ACHIEVEMENTS_PLAN.md). Two deliberate departures from
    // the plain pattern above, both driven by the plan's toast-stacking
    // hazard:
    //
    // 1. QUEUE, don't dedupe-and-drop. Every other notice here treats an
    //    existing `.frozen-notice-overlay` as "skip me" — fine for them
    //    (their trigger re-fires or is cosmetic), but an unlock notice is
    //    ONE-TIME (the unlock is already persisted; a dropped toast never
    //    returns). A 7-day streak completion fires the streak milestone
    //    notice AND an On Fire unlock from the same click: the streak
    //    notice's setTimeout(0) is registered first (items.js calls
    //    notifyStreakMilestone before recordLifetime), so it paints first,
    //    and this notice POLLS until the player dismisses it — the plan's
    //    "queue, streak notice first" ordering.
    // 2. BATCH. All unlocks arriving before the queue drains (same
    //    synchronous turn or while waiting behind another overlay) render as
    //    ONE modal — a task completion crossing two families' tiers at once
    //    shows a single celebration, not two stacked ones.
    //
    // The initial setTimeout(0) also keeps the standard defensive deferral
    // (the sessions 21/34/37 closeModal-same-tick hazard).
    //
    // Sub-session 4 polish (session 68): the 🏆 icon wraps in
    // .achievement-unlock-icon for a CSS-only pop animation
    // (css/frozenNotice.css), gated by the fx-off/fx-reduced <body> classes
    // js/settings.js applies + prefers-reduced-motion — same convention as
    // session 59's streak fire effect.
    let pendingUnlocks = [];
    let unlockWaiterId = null;

    function showAchievementUnlockNotice(newlyCrossed) {
        if (!Array.isArray(newlyCrossed) || !newlyCrossed.length) return;
        pendingUnlocks.push(...newlyCrossed);
        if (unlockWaiterId !== null) return; // a waiter is already draining

        const tryShow = () => {
            if (document.querySelector('.frozen-notice-overlay')) {
                unlockWaiterId = setTimeout(tryShow, 400);
                return;
            }
            const unlocks = pendingUnlocks;
            pendingUnlocks = [];
            unlockWaiterId = null;
            if (!unlocks.length) return;

            // label is null for single-badge families (back_in_black — the
            // catalog convention for a family with one unnamed tier), so it
            // only renders when present. Found live in session 65's playtest:
            // the first Back in Black unlock toasted as "Back in Black (null)".
            const rows = unlocks.map(u =>
                `<li><strong>${u.familyName}</strong>${u.label ? ` — ${u.label}` : ''}</li>`
            ).join('');
            const headline = unlocks.length === 1
                ? `Achievement unlocked: ${unlocks[0].familyName}${unlocks[0].label ? ` (${unlocks[0].label})` : ''}`
                : `${unlocks.length} achievements unlocked`;

            const modalHtml = `
                <div class="modal-overlay frozen-notice-overlay">
                    <div class="modal-content frozen-notice-modal achievement-unlock-modal">
                        <h3><span class="achievement-unlock-icon">🏆</span> ${headline}</h3>
                        <ul class="frozen-notice-recovery-list">${rows}</ul>
                        <div class="modal-buttons">
                            <button class="primary-button" onclick="closeModal()">Nice</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        };

        unlockWaiterId = setTimeout(tryShow, 0);
    }

    return {
        showFrozenRoutineNotice,
        showRoutineUnfrozenNotice,
        showRoutineKoNotice,
        showHeroStarUpNotice,
        showStreakMilestoneNotice,
        showAchievementUnlockNotice,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FrozenNotice;
}

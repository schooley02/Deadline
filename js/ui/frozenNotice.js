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

    return {
        showFrozenRoutineNotice,
        showRoutineUnfrozenNotice,
        showRoutineKoNotice,
        showHeroStarUpNotice,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FrozenNotice;
}

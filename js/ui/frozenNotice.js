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

    return {
        showFrozenRoutineNotice,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FrozenNotice;
}

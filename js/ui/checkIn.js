/**
 * CheckIn — the daily check-in prompt (Milestone 3, sub-session 4,
 * [P1-DATA-005], 2026-07-19, NEGATIVE_HABITS_PLAN.md).
 *
 * The day-advance mechanism (session 32) and state.js's rollover routing
 * (this session) route the SINGLE most-recent prior day's unresolved
 * negative-habit lurker into a `pendingCheckIn` marker on the habit
 * definition instead of silently auto-resolving it. This module is the
 * surface that asks the player about each one: one card per pending habit,
 * binary "Successfully avoided" / "I indulged", plus the spec's subtle
 * "I'll check this later" snooze (PROJECT_SPEC.md ~646, 4-hour re-prompt).
 * Days OLDER than the previous day still auto-resolve as avoided
 * (session 26's generous default) — this surface never sees those.
 *
 * SCOPE: check-in surface only — NOT frozen routine slots (a separate later
 * ticket that eventually consumes this validation surface).
 *
 * Same shared-module pattern as popups.js: Modal is called as a bare stable
 * global (fully extracted, loaded first — index.html ~231). Actual
 * resolution logic (points/xp/streak) lives in js/items.js's
 * resolvePendingCheckIn; this module is DOM-only.
 *
 * Snooze is a plain in-page setTimeout, NOT persisted across reload — a
 * reload before the 4 hours elapse just re-prompts immediately next restore.
 * That's a deliberate simplification: this ticket builds the check-in
 * SURFACE, not a scheduling system (LIVE mid-session day-advance is its own
 * separate, deferred ticket — see ROADMAP.md).
 */
const CheckIn = (() => {

    // Every definedHabits entry carrying a pendingCheckIn marker (additive
    // field — absent on any habit that's never had a stale prior-day lurker;
    // see items.js's markPendingCheckIn).
    function collectPendingCheckIns(definedHabits) {
        return (definedHabits || []).filter(habitDef => !!habitDef.pendingCheckIn);
    }

    function buildCardHtml(habitDef) {
        return `
            <div class="check-in-card" data-habit-id="${habitDef.id}">
                <p class="check-in-question">Did you successfully avoid <strong>${habitDef.name}</strong> yesterday?</p>
                <div class="check-in-actions">
                    <button type="button" class="check-in-button avoid-btn negative-habit-button" data-outcome="avoided">Successfully avoided</button>
                    <button type="button" class="check-in-button indulge-btn" data-outcome="indulged">I indulged</button>
                </div>
            </div>
        `;
    }

    /**
     * deps: { getDefinedHabits (getter), resolvePendingCheckIn(habitDefId, outcome) }
     * No-ops if nothing is pending (safe to call unconditionally on boot).
     */
    function showCheckInModal(deps) {
        const pending = collectPendingCheckIns(deps.getDefinedHabits());
        if (pending.length === 0) return;

        const cardsHtml = pending.map(buildCardHtml).join('');
        const modalHtml = `
            <div class="modal-overlay check-in-overlay">
                <div class="modal-content check-in-modal">
                    <h3>Yesterday's check-in</h3>
                    ${cardsHtml}
                    <p class="check-in-snooze"><a href="#" id="checkInSnoozeLink">I'll check this later</a></p>
                </div>
            </div>
        `;
        // Modal.open's dedupeSelector replaces the old hand-written "don't
        // stack a second check-in overlay" guard (e.g. a snooze timer firing
        // while one is somehow already open) — [P2-UI-011] Stage 2 sub-session 1.
        const overlay = Modal.open(modalHtml, { dedupeSelector: '.check-in-overlay' });
        if (!overlay) return;

        overlay.querySelectorAll('.check-in-card').forEach(card => {
            const habitDefId = card.getAttribute('data-habit-id');
            card.querySelectorAll('.check-in-button').forEach(button => {
                button.addEventListener('click', () => {
                    deps.resolvePendingCheckIn(habitDefId, button.getAttribute('data-outcome'));
                    card.remove();
                    if (!overlay.querySelector('.check-in-card')) {
                        overlay.remove();
                    }
                });
            });
        });

        const snoozeLink = overlay.querySelector('#checkInSnoozeLink');
        if (snoozeLink) {
            snoozeLink.addEventListener('click', (e) => {
                e.preventDefault();
                overlay.remove();
                setTimeout(() => {
                    showCheckInModal(deps);
                }, CONFIG.CHECK_IN_SNOOZE_MS);
            });
        }
    }

    return {
        collectPendingCheckIns,
        showCheckInModal,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CheckIn;
}

/**
 * Work timer notices (Build 3, 2026-10-25). Modal-only (never native dialogs).
 * No game logic: script.js owns start/stop/prompt decisions and passes callbacks.
 * Globals read at call time: Modal.
 */
const TimerView = (() => {
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // "Still working on X?" -- Yes keeps the timer going (restarts the 60 min window),
    // Stop banks the time. Left unanswered it auto-stops (script.js).
    function showStillWorking(item, handlers) {
        if (document.getElementById('stillWorkingOverlay')) return null;
        const overlay = Modal.open(`
            <div class="modal-overlay" id="stillWorkingOverlay">
                <div class="modal-content frozen-notice-modal">
                    <h3>⏱ Still working on "${esc(item.name)}"?</h3>
                    <p>Your timer has been running for an hour. If you don't answer, it stops by itself in 10 minutes.</p>
                    <div class="modal-buttons">
                        <button type="button" id="stillWorkingYes" class="primary-button">Yes, keep going</button>
                        <button type="button" id="stillWorkingStop" class="secondary-button">Stop timer</button>
                    </div>
                </div>
            </div>`);
        const yes = document.getElementById('stillWorkingYes');
        const stop = document.getElementById('stillWorkingStop');
        if (yes) yes.addEventListener('click', () => { Modal.closeModal(); if (handlers && handlers.onContinue) handlers.onContinue(); });
        if (stop) stop.addEventListener('click', () => { Modal.closeModal(); if (handlers && handlers.onStop) handlers.onStop(); });
        return overlay;
    }

    function closeStillWorking() {
        const el = document.getElementById('stillWorkingOverlay');
        if (el) el.remove();
    }

    function notice(headline, body) {
        Modal.open(`
            <div class="modal-overlay frozen-notice-overlay">
                <div class="modal-content frozen-notice-modal">
                    <h3>${headline}</h3>
                    <p>${body}</p>
                    <div class="modal-buttons"><button type="button" class="primary-button" onclick="closeModal()">OK</button></div>
                </div>
            </div>`, { defer: true });
    }

    function showTargetReached(item, minutes, completed) {
        notice(`⏱ ${minutes} min done`,
            completed
                ? `"${esc(item.name)}" is complete.`
                : `You reached your ${minutes}-minute target on "${esc(item.name)}", but it still has open sub-tasks, so it isn't complete yet.`);
    }

    function showAutoStopped(item) {
        notice('⏱ Timer stopped',
            `No answer to "Still working?", so the timer on "${esc(item.name)}" stopped. Time up to the check was kept.`);
    }

    return { showStillWorking, closeStillWorking, showTargetReached, showAutoStopped };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimerView;
}

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

    // "X min logged" for the goal popup: whole minutes, hours past 60.
    function formatMinutes(min) {
        const m = Math.max(0, Math.floor(min));
        if (m < 60) return `${m} min`;
        const h = Math.floor(m / 60), r = m % 60;
        return r ? `${h} hr ${r} min` : `${h} hr`;
    }

    // Goal reached (Habit Goals Build 2, 2026-11-01): nothing auto-completes. The player decides.
    // Mark done / Keep going (timer runs on) / Stop, not done yet (time stays logged) / Started by
    // mistake (this session's time is thrown away). `info` = { goalMinutes, loggedMinutes }.
    function showGoalReached(item, info, handlers) {
        if (document.getElementById('goalReachedOverlay')) return null;
        const goal = formatMinutes(info.goalMinutes);
        const logged = formatMinutes(info.loggedMinutes);
        const line = Math.floor(info.loggedMinutes) === Math.floor(info.goalMinutes)
            ? `${logged} logged \u2014 your goal.`
            : `${logged} logged \u2014 your goal was ${goal}.`;
        const overlay = Modal.open(`
            <div class="modal-overlay" id="goalReachedOverlay">
                <div class="modal-content frozen-notice-modal">
                    <h3>\u23F1 ${esc(item.name)}</h3>
                    <p>${line}</p>
                    <div class="modal-buttons goal-reached-buttons">
                        <button type="button" id="goalMarkDone" class="primary-button">Mark done</button>
                        <button type="button" id="goalKeepGoing" class="secondary-button">Keep going</button>
                        <button type="button" id="goalStopNotDone" class="secondary-button">Stop, not done yet</button>
                        <button type="button" id="goalMistake" class="secondary-button">Started by mistake</button>
                    </div>
                </div>
            </div>`);
        if (!overlay) return null;
        const wire = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => { Modal.closeModal(); if (handlers && handlers[fn]) handlers[fn](); });
        };
        wire('goalMarkDone', 'onMarkDone');
        wire('goalKeepGoing', 'onKeepGoing');
        wire('goalStopNotDone', 'onStopNotDone');
        wire('goalMistake', 'onMistake');
        return overlay;
    }

    // "Mark done" on a task that still has open sub-tasks: it stays open, the timer is stopped.
    function showGoalBlocked(item) {
        notice('\u23F1 Goal reached',
            `You reached your goal on "${esc(item.name)}", but it still has open sub-tasks, so it isn't complete yet.`);
    }

    function showAutoStopped(item) {
        notice('⏱ Timer stopped',
            `No answer to "Still working?", so the timer on "${esc(item.name)}" stopped. Time up to the check was kept.`);
    }

    return { showStillWorking, closeStillWorking, showGoalReached, showGoalBlocked, formatMinutes, showAutoStopped };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimerView;
}

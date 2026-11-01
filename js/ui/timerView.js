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
    // Mark done / Keep going (timer runs on) / Pause (time stays logged, the stopwatch resumes it) / Started by
    // mistake (this session's time is thrown away). Each button carries a one-line explanation of what it does.
    // `info` = { goalMinutes, loggedMinutes, hasOpenSubTasks }.
    function showGoalReached(item, info, handlers) {
        if (document.getElementById('goalReachedOverlay')) return null;
        const goal = formatMinutes(info.goalMinutes);
        const logged = formatMinutes(info.loggedMinutes);
        const line = Math.floor(info.loggedMinutes) === Math.floor(info.goalMinutes)
            ? `${logged} logged \u2014 your goal.`
            : `${logged} logged \u2014 your goal was ${goal}.`;
        const doneDesc = info.hasOpenSubTasks
            ? 'Stops the timer. Open sub-tasks keep it from completing.'
            : 'Completes it and stops the timer.';
        const opt = (id, cls, label, desc) =>
            `<button type="button" id="${id}" class="${cls}"><span class="goal-opt-label">${label}</span>` +
            `<span class="goal-opt-desc">${desc}</span></button>`;
        const overlay = Modal.open(`
            <div class="modal-overlay" id="goalReachedOverlay">
                <div class="modal-content frozen-notice-modal">
                    <h3>\u23F1 ${esc(item.name)}</h3>
                    <p>${line}</p>
                    <div class="modal-buttons goal-reached-buttons">
                        ${opt('goalMarkDone', 'primary-button', 'Mark done', doneDesc)}
                        ${opt('goalKeepGoing', 'secondary-button', 'Keep going', 'The timer keeps running. It won\u2019t ask again.')}
                        ${opt('goalPause', 'secondary-button', 'Pause', 'Pauses the timer and keeps the time logged. Tap the stopwatch to resume.')}
                        ${opt('goalMistake', 'secondary-button', 'Started by mistake', 'Stops the timer and throws away this session\u2019s time.')}
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
        wire('goalPause', 'onPause');
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

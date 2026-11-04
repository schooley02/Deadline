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

    // Break limit passed (Habit Goals Build 2b, 2026-11-01): the timer is running and the logged time is over the
    // limit. Passing it answers nothing by itself; the player says what happened. `info` = { limitMinutes, loggedMinutes }.
    // Handlers: onSlipped / onWithin / onMistake / onKeepGoing.
    function showLimitPassed(item, info, handlers) {
        if (document.getElementById('limitPassedOverlay')) return null;
        const limit = formatMinutes(info.limitMinutes);
        const logged = formatMinutes(info.loggedMinutes);
        const opt = (id, cls, label, desc) =>
            `<button type="button" id="${id}" class="${cls}"><span class="goal-opt-label">${label}</span>` +
            `<span class="goal-opt-desc">${desc}</span></button>`;
        const overlay = Modal.open(`
            <div class="modal-overlay" id="limitPassedOverlay">
                <div class="modal-content frozen-notice-modal">
                    <h3>\u23F1 ${esc(item.name)}</h3>
                    <p>${logged} logged \u2014 past your limit of ${limit}.</p>
                    <div class="modal-buttons goal-reached-buttons">
                        ${opt('limitSlipped', 'primary-button', 'I slipped', 'Counts as Slipped for today. The timer stops and the time stays logged.')}
                        ${opt('limitWithin', 'secondary-button', 'I stayed within it', 'Counts as Resisted and stops the timer. Use this if you forgot to stop it.')}
                        ${opt('limitMistake', 'secondary-button', 'Started by mistake', 'Stops the timer and throws away this session\u2019s time.')}
                        ${opt('limitKeepGoing', 'secondary-button', 'Keep going', 'The timer keeps running. It won\u2019t ask again.')}
                    </div>
                </div>
            </div>`);
        if (!overlay) return null;
        const wire = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => { Modal.closeModal(); if (handlers && handlers[fn]) handlers[fn](); });
        };
        wire('limitSlipped', 'onSlipped');
        wire('limitWithin', 'onWithin');
        wire('limitMistake', 'onMistake');
        wire('limitKeepGoing', 'onKeepGoing');
        return overlay;
    }

    // Logged-time prompt (Habit Goals Build 2c, 2026-11-01): "How much time did you actually spend?" after the player says
    // they stayed within a Break limit (the timer was left running, so its total is wrong). `info` = { loggedMinutes,
    // prefillMs, message? }; the field starts at prefillMs (the limit). Save time -> handlers.onSave(ms); Keep as logged ->
    // handlers.onSkip(). Dismissing (outside tap / Esc) is the same as keeping the logged time. Needs the Forms global.
    function showLoggedTimeEditor(item, info, handlers) {
        if (document.getElementById('loggedTimeOverlay')) return null;
        const logged = formatMinutes(info.loggedMinutes || 0);
        const message = info.message || `The timer logged ${logged}. How much time did you actually spend?`;
        const overlay = Modal.open(`
            <div class="modal-overlay" id="loggedTimeOverlay">
                <div class="modal-content frozen-notice-modal">
                    <h3>\u23F1 ${esc(item.name)}</h3>
                    <p>${message}</p>
                    ${Forms.loggedTimeHtml({ idPrefix: 'editorLogged', ms: info.prefillMs })}
                    <p class="logged-time-error" id="editorLoggedError" role="alert"></p>
                    <div class="modal-buttons">
                        <button type="button" id="loggedTimeSave" class="primary-button">Save time</button>
                        <button type="button" id="loggedTimeSkip" class="secondary-button">Keep ${logged} logged</button>
                    </div>
                </div>
            </div>`);
        if (!overlay) return null;
        const save = document.getElementById('loggedTimeSave');
        const skip = document.getElementById('loggedTimeSkip');
        if (save) save.addEventListener('click', () => {
            const r = Forms.readLoggedTime('editorLogged');
            if (r.error) { const e = document.getElementById('editorLoggedError'); if (e) e.textContent = r.error; return; }
            Modal.closeModal();
            if (handlers && handlers.onSave) handlers.onSave(r.ms);
        });
        if (skip) skip.addEventListener('click', () => { Modal.closeModal(); if (handlers && handlers.onSkip) handlers.onSkip(); });
        return overlay;
    }

    // "Mark done" on a task that still has open sub-tasks: it stays open, the timer is stopped.
    function showGoalBlocked(item) {
        notice('\u23F1 Goal reached',
            `You reached your goal on "${esc(item.name)}", but it still has open sub-tasks, so it isn't complete yet.`);
    }

    // Auto-stop notice (2026-11-04): the "Still working?" check went unanswered, so the timer stopped itself and banked
    // time only up to the check. `info` = { sessionMs (what THIS run banked), totalMs (the item's whole logged time now) }.
    // Edit This Session (Build C; was Edit Total Time Logged) -> handlers.onEdit(); Keep New Time Logged -> handlers.onKeep(); Delete New Time Logged ->
    // handlers.onDelete(). Dismissing (outside tap / Esc) leaves the time as banked, the same as Keep. The handler
    // runs AFTER the modal closes; open anything new from it one tick later (this click is still bubbling).
    function showAutoStopped(item, info, handlers) {
        if (document.getElementById('autoStopOverlay')) return null;
        const i = info || {};
        const session = formatMinutes((i.sessionMs || 0) / 60000);
        const total = formatMinutes((i.totalMs || 0) / 60000);
        const overlay = Modal.open(`
            <div class="modal-overlay frozen-notice-overlay" id="autoStopOverlay">
                <div class="modal-content frozen-notice-modal auto-stop-modal">
                    <h3>⏱ Timer stopped</h3>
                    <p>It looks like you may have left your timer running on "${esc(item.name)}". There was no answer to the "Still working?" check.</p>
                    <p>The timer stopped with <strong>${session}</strong> logged. The total time logged for this task is <strong>${total}</strong>.</p>
                    <p>Please fix when this run really started and stopped, or delete it.</p>
                    <div class="modal-buttons">
                        <button type="button" id="autoStopEdit" class="primary-button">Edit This Session</button>
                        <button type="button" id="autoStopKeep" class="secondary-button">Keep New Time Logged</button>
                        <button type="button" id="autoStopDelete" class="danger-button">Delete New Time Logged</button>
                    </div>
                </div>
            </div>`);
        if (!overlay) return null;
        const wire = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => { Modal.closeModal(); if (handlers && handlers[fn]) handlers[fn](); });
        };
        wire('autoStopEdit', 'onEdit');
        wire('autoStopKeep', 'onKeep');
        wire('autoStopDelete', 'onDelete');
        return overlay;
    }

    // Timer sessions Build C (2026-11-04): the auto-stop notice's "Edit This Session" opens this: the item's Sessions list with
    // the run that just ended already open in its editor (start / stop / Delete). `info` = { index (into item.timerSessions),
    // sessionMs }; handlers = { changeSession(id, change), getBaseHealth?, onChange(res)? }. Done (or tapping outside) closes it;
    // every change has already been saved by changeSession. Needs the SessionsView global.
    function showSessionEditor(item, info, handlers) {
        if (document.getElementById('sessionEditOverlay')) return null;
        if (typeof SessionsView === 'undefined') return null;
        const i = info || {};
        const h = handlers || {};
        const overlay = Modal.open(`
            <div class="modal-overlay" id="sessionEditOverlay">
                <div class="modal-content frozen-notice-modal auto-stop-modal">
                    <h3>\u23F1 ${esc(item.name)}</h3>
                    <p>The timer stopped with <strong>${formatMinutes((i.sessionMs || 0) / 60000)}</strong> logged. Change when this run started or stopped, or delete it.</p>
                    ${SessionsView.html(item, { idPrefix: 'autoSes', running: false })}
                    <div class="modal-buttons">
                        <button type="button" id="sessionEditDone" class="primary-button">Done</button>
                    </div>
                </div>
            </div>`);
        if (!overlay) return null;
        const ctl = SessionsView.wire({ idPrefix: 'autoSes', getItem: () => item, deps: { changeSession: h.changeSession, getBaseHealth: h.getBaseHealth }, onChange: h.onChange });
        if (ctl && typeof i.index === 'number') ctl.open(i.index);
        const done = document.getElementById('sessionEditDone');
        if (done) done.addEventListener('click', () => Modal.closeModal());
        return overlay;
    }

    return { showStillWorking, closeStillWorking, showGoalReached, showLimitPassed, showLoggedTimeEditor, showGoalBlocked, formatMinutes, showAutoStopped, showSessionEditor };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimerView;
}

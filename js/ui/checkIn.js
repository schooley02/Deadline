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

    // --- Habit Goals Build 3 (2026-11-01): goal line + optional "How much?" on every Break-habit answer card ------------
    // An Amount goal asks for a number (stored on the entry as goalActual); a Time goal asks for minutes, which IS the logged
    // time (plan Decision 14). Note / none goals show no box. Always optional: a blank box records nothing.
    function goalLineHtml(goal, isNegative) {
        const text = (typeof Habits !== 'undefined' && Habits.formatGoal) ? Habits.formatGoal(goal, isNegative) : '';
        return text ? `<p class="check-in-goal">${escapeHtml(text)}</p>` : '';
    }

    function howMuchHtml(goal, entry) {
        const kind = (typeof GoalCheck !== 'undefined') ? GoalCheck.howMuchKind(goal) : null;
        if (!kind) return '';
        if (kind === 'amount') {
            const unit = goal.unit ? ` <span class="how-much-unit">(${escapeHtml(goal.unit)})</span>` : '';
            return `<label class="how-much"><span class="how-much-label">How much?${unit}</span>` +
                `<input type="number" class="how-much-input" data-kind="amount" inputmode="decimal" min="0" step="any" placeholder="optional"></label>`;
        }
        const logged = GoalCheck.loggedMinutes(entry);
        return `<label class="how-much"><span class="how-much-label">How many minutes?</span>` +
            `<input type="number" class="how-much-input" data-kind="time" data-logged="${logged === null ? '' : logged}" inputmode="numeric" min="0" max="1440" step="1" ` +
            `placeholder="optional"${logged === null ? '' : ` value="${logged}"`}></label>`;
    }

    // Reads the card's How much? box -> { actual?, loggedMinutes? }. Blank / invalid = nothing recorded. A Time goal reports its
    // minutes only when they differ from the prefilled logged time, so an untouched box never rewrites a precise value.
    function readHowMuch(card) {
        const out = {};
        const input = card && card.querySelector ? card.querySelector('.how-much-input') : null;
        if (!input || typeof GoalCheck === 'undefined') return out;
        const kind = input.getAttribute('data-kind');
        const n = GoalCheck.parseHowMuch(input.value, kind);
        if (n === null) return out;
        if (kind === 'amount') out.actual = n;
        else if (String(n) !== input.getAttribute('data-logged')) out.loggedMinutes = n;
        return out;
    }

    function timerHintHtml(item) {
        if (typeof Timer === 'undefined' || !Timer.hasLogged(item)) return '';
        return `<p class="check-in-hint">${escapeHtml(Timer.loggedText(item).replace(/^Logged:\s*/, 'Timer logged '))}</p>`;
    }

    function buildCardHtml(habitDef) {
        // The goal and logged time come from the snapshot taken when the lurker was cleared at rollover; older markers fall
        // back to the habit definition's own goal.
        const snap = habitDef.pendingCheckIn && habitDef.pendingCheckIn.entry;
        const goal = (typeof Habits !== 'undefined' && Habits.goalOf) ? Habits.goalOf(snap && snap.goal ? snap : habitDef) : null;
        return `
            <div class="check-in-card" data-habit-id="${habitDef.id}">
                <p class="check-in-question">Did you resist <strong>${habitDef.name}</strong> yesterday?</p>
                ${goalLineHtml(goal, true)}${snap ? timerHintHtml(snap) : ''}${howMuchHtml(goal, snap || habitDef)}
                <div class="check-in-actions">
                    <button type="button" class="check-in-button avoid-btn negative-habit-button" data-outcome="avoided">Resisted</button>
                    <button type="button" class="check-in-button indulge-btn" data-outcome="indulged">Slipped</button>
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
                    deps.resolvePendingCheckIn(habitDefId, button.getAttribute('data-outcome'), readHowMuch(card));
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

    // --- Same-day "time has arrived" prompt (2026-10-21, Jeremy) ----------------
    // A negative habit's time passed while the game is open: ask indulged/avoided right
    // away instead of waiting for tomorrow's check-in. Several habits arriving together
    // stack as cards in ONE popup. Resolution reuses the lurker popup's own actions
    // (deps.completeItem = avoided, deps.indulgeHabit = indulged), so the economics are
    // identical. "Later" just closes it; tomorrow's check-in still settles the day.
    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function buildArrivalCardHtml(item) {
        const question = 'its time has arrived. Did you resist it?';
        return `
            <div class="check-in-card arrival-card" data-item-id="${item.id}">
                <p class="check-in-question"><strong>${escapeHtml(item.name)}</strong>: ${question}</p>
                <div class="check-in-actions">
                    <button type="button" class="check-in-button avoid-btn negative-habit-button" data-outcome="avoided">Resisted</button>
                    <button type="button" class="check-in-button indulge-btn" data-outcome="indulged">Slipped</button>
                </div>
            </div>
        `;
    }

    function wireArrivalCard(card, overlay, item, deps) {
        card.querySelectorAll('.check-in-button').forEach(button => {
            button.addEventListener('click', () => {
                if (button.getAttribute('data-outcome') === 'avoided') deps.completeItem(item.id);
                else deps.indulgeHabit(item.id);
                card.remove();
                if (!overlay.querySelector('.arrival-card')) overlay.remove();
            });
        });
    }

    function queueArrivalPrompt(item, deps) {
        const existing = document.querySelector('.arrival-overlay');
        if (existing) {
            if (existing.querySelector('.arrival-card[data-item-id="' + item.id + '"]')) return;
            const tmp = document.createElement('div');
            tmp.innerHTML = buildArrivalCardHtml(item);
            const card = tmp.firstElementChild;
            existing.querySelector('.arrival-cards').appendChild(card);
            wireArrivalCard(card, existing, item, deps);
            return;
        }
        const overlay = Modal.open(`
            <div class="modal-overlay arrival-overlay">
                <div class="modal-content check-in-modal">
                    <h3>Time's up</h3>
                    <div class="arrival-cards">${buildArrivalCardHtml(item)}</div>
                    <p class="check-in-snooze"><a href="#" class="arrival-later-link">Later</a></p>
                </div>
            </div>
        `, { dedupeSelector: '.arrival-overlay' });
        if (!overlay) return;
        wireArrivalCard(overlay.querySelector('.arrival-card'), overlay, item, deps);
        overlay.querySelector('.arrival-later-link').addEventListener('click', (e) => {
            e.preventDefault();
            overlay.remove();
        });
    }

    // --- Evening check (Habit Goals Build 3, plan Decision 7) -------------------------------------------------------------
    // One modal, one card per Break habit still unanswered today (and whose time has arrived): the goal line, a timer hint,
    // an optional How much?, and Resisted / Slipped / Later. "Later" leaves that habit unanswered (the arrival prompt and
    // the next-morning card still apply); closing the modal with cards left hides it until the next app open.
    // Anytime tasks (Anytime Build 2, 2026-11-02): the same modal also lists open "Anytime today" tasks, one card each, with
    // Done / Tomorrow / Leave it. "Leave it" ANSWERS the card for tonight (no re-ask); closing the modal with cards left hides
    // it until the next app open, like the Break-habit cards. All task deps are optional, so older callers keep working.
    // deps: { getCandidates() -> active items, completeItem(id, opts), indulgeHabit(id, opts), setLoggedMinutes(id, min),
    //         onDismiss(),
    //         getTaskCandidates() -> anytime tasks, completeTask(id), leaveTask(id),
    //         describeTomorrow(item) -> { text, blocked }  (what moving it to tomorrow costs),
    //         moveTaskToTomorrow(id) -> { ok } }.
    //         Returns the overlay, or null when there is nothing to ask / one is already open.
    function buildEveningCardHtml(item) {
        const goal = (typeof Habits !== 'undefined' && Habits.goalOf) ? Habits.goalOf(item) : null;
        return `
            <div class="check-in-card evening-card" data-item-id="${item.id}">
                <p class="check-in-question">Did you resist <strong>${escapeHtml(item.name)}</strong> today?</p>
                ${goalLineHtml(goal, true)}${timerHintHtml(item)}${howMuchHtml(goal, item)}
                <div class="check-in-actions">
                    <button type="button" class="check-in-button avoid-btn negative-habit-button" data-outcome="avoided">Resisted</button>
                    <button type="button" class="check-in-button indulge-btn" data-outcome="indulged">Slipped</button>
                    <button type="button" class="check-in-button check-in-later" data-outcome="later">Later</button>
                </div>
            </div>
        `;
    }

    // One card for an open anytime task. `tomorrow` = { text, blocked } from deps.describeTomorrow (blank when unknown).
    function buildEveningTaskCardHtml(item, tomorrow) {
        const t = tomorrow || { text: '', blocked: false };
        const openSubs = Array.isArray(item.subTasks) && item.subTasks.length > 0;
        const done = openSubs
            ? `<button type="button" class="check-in-button avoid-btn" data-outcome="done" disabled title="Finish the sub-tasks first">Finish the sub-tasks first</button>`
            : `<button type="button" class="check-in-button avoid-btn" data-outcome="done">Done</button>`;
        return `
            <div class="check-in-card evening-card evening-task-card" data-card-kind="task" data-item-id="${item.id}">
                <p class="check-in-question">Did you finish <strong>${escapeHtml(item.name)}</strong> today?</p>
                <p class="check-in-goal">Due by midnight.${t.text ? ` Moving it to tomorrow: <span class="evening-task-cost${t.blocked ? ' evening-task-cost--blocked' : ''}">${escapeHtml(t.text)}</span>` : ''}</p>
                <div class="check-in-actions">
                    ${done}
                    <button type="button" class="check-in-button" data-outcome="tomorrow"${t.blocked ? ' disabled' : ''}>Tomorrow</button>
                    <button type="button" class="check-in-button check-in-later" data-outcome="leave">Leave it</button>
                </div>
            </div>
        `;
    }

    function showEveningModal(deps) {
        const items = deps.getCandidates() || [];
        const tasks = typeof deps.getTaskCandidates === 'function' ? (deps.getTaskCandidates() || []) : [];
        if (items.length === 0 && tasks.length === 0) return null;
        const describe = typeof deps.describeTomorrow === 'function' ? deps.describeTomorrow : () => null;

        const overlay = Modal.open(`
            <div class="modal-overlay evening-overlay">
                <div class="modal-content check-in-modal">
                    <h3>Tonight's check-in</h3>
                    <p class="check-in-intro">Before the day ends: how did these go?</p>
                    <div class="evening-cards">${tasks.map(t => buildEveningTaskCardHtml(t, describe(t))).join('')}${items.map(buildEveningCardHtml).join('')}</div>
                    <p class="check-in-snooze"><a href="#" class="evening-later-link">I'll check this later</a></p>
                </div>
            </div>
        `, { dedupeSelector: '.evening-overlay' });
        if (!overlay) return null;

        let skipped = false;
        overlay.querySelectorAll('.evening-card').forEach((card) => {
            const itemId = Number(card.getAttribute('data-item-id'));
            const isTaskCard = card.getAttribute('data-card-kind') === 'task';
            card.querySelectorAll('.check-in-button').forEach((button) => {
                button.addEventListener('click', () => {
                    const outcome = button.getAttribute('data-outcome');
                    if (isTaskCard) {
                        // Anytime task: Done completes it on time; Tomorrow pays through the pushback rules (a refused
                        // move leaves the card open and disables the button); Leave it just records tonight's answer.
                        if (outcome === 'done') {
                            if (typeof deps.completeTask === 'function') deps.completeTask(itemId);
                        } else if (outcome === 'tomorrow') {
                            const res = typeof deps.moveTaskToTomorrow === 'function' ? deps.moveTaskToTomorrow(itemId) : null;
                            if (!res || res.ok === false) { button.disabled = true; return; }
                        } else if (typeof deps.leaveTask === 'function') {
                            deps.leaveTask(itemId);
                        }
                    } else if (outcome === 'later') {
                        skipped = true;
                    } else {
                        const how = readHowMuch(card);
                        const opts = how.actual !== undefined ? { actual: how.actual } : undefined;
                        if (outcome === 'avoided') deps.completeItem(itemId, opts);
                        else deps.indulgeHabit(itemId, opts);
                        // A Time goal's How much? is the logged time: applied AFTER the answer (which stops a running timer).
                        if (how.loggedMinutes !== undefined && typeof deps.setLoggedMinutes === 'function') {
                            deps.setLoggedMinutes(itemId, how.loggedMinutes);
                        }
                    }
                    card.remove();
                    if (!overlay.querySelector('.evening-card')) overlay.remove();
                });
            });
        });

        const later = overlay.querySelector('.evening-later-link');
        if (later) later.addEventListener('click', (e) => { e.preventDefault(); overlay.remove(); });

        // However it closes (answered, Later, the link, an outside tap or Esc): if any habit was left unanswered, tell the
        // caller so tonight's check stays quiet until the next app open.
        if (typeof MutationObserver !== 'undefined' && typeof deps.onDismiss === 'function') {
            const observer = new MutationObserver(() => {
                if (overlay.isConnected) return;
                observer.disconnect();
                if (skipped || overlay.querySelector('.evening-card')) deps.onDismiss();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
        return overlay;
    }

    return {
        collectPendingCheckIns,
        showCheckInModal,
        queueArrivalPrompt,
        showEveningModal,
        howMuchHtml,
        readHowMuch,
        goalLineHtml,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CheckIn;
}

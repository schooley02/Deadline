/**
 * Popups — enemy click, task details, edit task, and sub-task creation
 * modals (Milestone 2 UI extraction, session 5, 2026-07-18).
 *
 * Extracted from script.js per docs/UI_EXTRACTION_PLAN.md cluster D:
 * handleEnemyClick, showTaskDetailsPopup, showEditTaskModal,
 * createSubTaskPrompt, showCreateSubTaskModal.
 *
 * Same dependency approach as forms.js (session 4): Modal is called as a
 * bare stable global (fully extracted module, guaranteed loaded first). The
 * pushback section (session 4) also calls Shop as a bare global — it loads
 * at index.html line ~202, well before this module (~213), same as Modal.
 * Everything else — script.js closure state/functions (activeItems,
 * gameIsOver, completeItem, createListItem, sortAndRenderActiveList,
 * saveGame, recomputeOverdueStateAfterEdit, createTaskItemData,
 * addItemToGame) plus the pushback deps (pushbackOptionsFor, onPushback,
 * reschedulePricingFor, commitReschedule) — arrives via an explicit deps object. The functions in this
 * cluster call each other directly (module-internal), not through deps,
 * since they're all defined in this same file.
 *
 * DELIBERATE CARVE-OUT: showCreateSubTaskModal's debug console.log lines
 * (🎯/❌/✅/🔥-prefixed) are LEFT AS-IS, unlike the debug-log cleanup done in
 * fabMenu.js (session 3) and forms.js (session 4). This exact function is
 * the one at the center of the historic sub-task duplication bug
 * (root-caused and fixed in an earlier session — see
 * SUBTASK_BUG_REPRODUCTION_REPORT.md, which this session did not open per
 * the project's guardrail against opening that file). Second-guessing
 * diagnostic logging left behind from that bug hunt is a separate decision
 * from moving the code, not made here.
 *
 * [P2-UI-011] Stage 2 sub-session 3 (2026-07-20, docs/MODAL_STAGE2_PLAN.md):
 * all three overlay-creation call sites (showTaskDetailsPopup,
 * showEditTaskModal, showCreateSubTaskModal) now insert via `Modal.open()`
 * instead of a raw `document.body.insertAdjacentHTML` + follow-up
 * `document.querySelector('.modal-overlay')` pair — no `dedupeSelector`/
 * `defer` needed at any of the three (none dedupe against a same-class
 * sibling the way checkIn.js/frozenNotice.js do, and all three insert
 * synchronously in direct response to a click, not a callback that might
 * race a `closeModal()`). The Cheat Day rebuild-in-place dance in
 * showTaskDetailsPopup (its own `setTimeout(0)`, a DIFFERENT hazard than
 * Modal.open's `defer` guards — the click handler's own event is still
 * bubbling when it fires, not a closeModal()-then-insert race) is
 * UNCHANGED: it wraps the whole close+reopen pair, and reopening still
 * calls the (now Modal.open-based) showTaskDetailsPopup internally.
 */
const Popups = (() => {

    // -----------------------------------------------------------------------
    // Local-time formatters for <input type="date"> / <input type="time">
    // pre-fill. These MUST use local getters, never toISOString(): the save
    // path parses `${date}T${time}` as LOCAL time (no Z suffix), so pre-filling
    // from UTC meant opening Edit Task and pressing Save without touching
    // anything shifted the due time forward by the UTC offset (and rolled the
    // DATE for evening tasks). Found during session 6 live verification; see
    // DECISIONS.md 2026-07-18.
    // -----------------------------------------------------------------------

    // The inline (i) that opens "How Deadline works" on one topic (2026-11-03). '' when that module is not loaded.
    function howItWorksButton(topicId, label) {
        return (typeof HowItWorks !== 'undefined' && HowItWorks.buttonHtml) ? HowItWorks.buttonHtml(topicId, label) : '';
    }

    function formatDateInputValue(date) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function formatTimeInputValue(date) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    // deps: { gameIsOver, activeItems }
    function handleEnemyClick(itemId, deps) {
        if (deps.gameIsOver) return;
        const itemData = deps.activeItems.find(i => i.id === itemId);
        if (!itemData) return;
        showTaskDetailsPopup(itemData, deps);
    }

    // Builds the "Push back this deadline" section HTML for the enemy popup
    // (session 4; rebuilt for pushback charges in Build B). Empty string when
    // pushback isn't wired (no deps.onPushback / pushbackOptionsFor) so the
    // popup degrades cleanly. Pushback applies to tasks, sub-tasks and habits
    // (Jeremy's call 2026-07-19); habits are offered Short/Medium only.
    // Pushback charges (Build B, 2026-11-02): the buttons come from deps.pushbackOptionsFor(item), one per size the
    // item may use, each { sizeId, label ('+30 min'), kind ('free'|'charge'|'token'|'points'|'blocked'), left, cost }.
    // 'free' = the zombie is still more than 4 hours away (planning ahead), 'charge' = a free charge of that size is
    // used (left = how many are available), 'token' = a held token is used, 'points' = the price is paid in points,
    // 'blocked' = points can't cover it (disabled).
    function pushbackOptionsOf(item, deps) {
        if (!deps.onPushback || typeof deps.pushbackOptionsFor !== 'function') return [];
        const opts = deps.pushbackOptionsFor(item);
        return Array.isArray(opts) ? opts : [];
    }

    function pushbackButtonText(o) {
        if (o.kind === 'free') return `${o.label} — free`;
        if (o.kind === 'charge') return `${o.label} — free (${o.left} left)`;
        if (o.kind === 'token') return `${o.label} — uses a token`;
        return `${o.label} — ${o.cost} pts`;
    }

    // Button inner HTML: the label plus the charge dots (filled = free charges left, hollow = will use a token or
    // points). A free-because-calm move (kind 'free') has no limit, so no dots. Needs PushbackHelp (loaded first).
    function pushbackButtonHtml(o) {
        const dots = (o.kind !== 'free' && typeof PushbackHelp !== 'undefined' && o.total > 0)
            ? ' ' + PushbackHelp.dotsHtml(o.kind === 'charge' ? o.left : 0, o.total) : '';
        return pushbackButtonText(o) + dots; // static labels and numbers only, nothing user-typed
    }

    // The (i) panel's live context, from the optional dep. Null when not wired.
    function pushbackHelpCtx(deps) {
        return (deps && typeof deps.pushbackHelpCtx === 'function') ? deps.pushbackHelpCtx() : null;
    }

    // The edit form's (i): "How rescheduling works" under the live note. Only when both the pricing and the help ctx are wired.
    function editPushbackHelpHtml(deps) {
        const ctx = pushbackHelpCtx(deps);
        if (!ctx || typeof deps.reschedulePricingFor !== 'function' || typeof PushbackHelp === 'undefined') return '';
        return `<div class="pushback-help">${PushbackHelp.hintBlockHtml('editPushbackHint', ctx, 'How rescheduling works', 'How rescheduling works')}</div>`;
    }

    // The edit form's live line under Due Date/Time (Pushback charges Build B). `r` is Pushback.quote()'s result
    // (script.js reschedulePricingFor). Returns { text, blocked }: blocked = the move can't be paid (Save disabled).
    // Free moves say why; a paid-zone move says which size it uses and how it is paid.
    const PB_NAMES = { short: 'Short', medium: 'Medium', long: 'Long' };
    function pushbackNoteText(r, points) {
        if (!r || !r.later) return { text: '', blocked: false };
        if (r.kind === 'free') {
            return { text: r.reason === 'grace' ? 'Free: just created' : 'Free: more than 4 hours away', blocked: false };
        }
        if (!r.ok) return { text: `Costs ${r.cost} pts \u2014 you have ${points}`, blocked: true };
        const name = PB_NAMES[r.size] || r.size;
        const when = r.size === 'long' ? 'this week' : 'today';
        if (r.count === 1) {
            if (r.kind === 'charge') {
                const left = Math.max(0, ((r.left && r.left[r.size]) || 0) - 1);
                return { text: `Uses 1 ${name} pushback (${left} left ${when})`, blocked: false };
            }
            if (r.kind === 'token') return { text: `Uses a held ${name} token`, blocked: false };
            return { text: `Costs ${r.cost} pts`, blocked: false };
        }
        const parts = [];
        if (r.charges) parts.push(`${r.charges} free`);
        if (r.tokens) parts.push(`${r.tokens} held`);
        if (r.pointUnits) parts.push(`${r.pointUnits} for ${r.cost} pts`);
        return { text: `Uses ${r.count} ${name} pushbacks: ${parts.join(' + ')}`, blocked: false };
    }

    function buildPushbackSectionHtml(item, deps) {
        const options = pushbackOptionsOf(item, deps);
        if (options.length === 0) return '';
        const points = typeof deps.getPlayerPoints === 'function' ? deps.getPlayerPoints() : 0;

        const buttons = options.map(o =>
            `<button type="button" class="pushback-btn" data-size-id="${o.sizeId}"${o.kind === 'blocked' ? ' disabled' : ''}>
                        ${pushbackButtonHtml(o)}
                    </button>`
        ).join('');

        // Affordability feedback (parity with the shop's "Not enough points"
        // Buy-button text): a disabled button with no explanation reads as
        // broken, and a title= tooltip is invisible on mobile (this app's
        // primary target). Showing the live balance makes the disabled state
        // self-explanatory; refreshPushbackUI keeps it current after a push.
        const anyUnaffordable = options.some(o => o.kind === 'blocked');
        const balanceNote = anyUnaffordable
            ? ` <span class="pushback-balance-note">(you have ${points} pts)</span>`
            : ` <span class="pushback-balance-note"></span>`;

        const ctx = pushbackHelpCtx(deps);
        const hint = (ctx && typeof PushbackHelp !== 'undefined') ? PushbackHelp.hintBlockHtml('popupPushbackHint', ctx) : '';

        return `
            <div class="pushback-section">
                <p class="pushback-label"><strong>Push back this deadline:</strong>${balanceNote}${hint}</p>
                <div class="pushback-options">${buttons}</div>
            </div>
        `;
    }

    // A negative-habit lurker (session 29) gets the indulge/avoid binary
    // instead of the ordinary complete checkbox — see buildActionsHtml.
    function isNegativeHabitInstance(item) {
        return item.type === 'habit' && item.isNegative === true;
    }

    // deps: { completeItem, indulgeHabit, pushbackOptionsFor?, getPlayerPoints?,
    //         onPushback?, getCheatDayHeldCount?, isCheatDayActiveForItem?, onUseCheatDay?,
    //         getSkipDayHeldCount?, onUseSkipDay? }
    //
    // Sub-session 2b ([P1-DATA-005], NEGATIVE_HABITS_PLAN.md): for a
    // negative-habit lurker, the "Mark as Complete" checkbox + pushback
    // section are REPLACED with the spec's binary — "Successfully avoided"
    // (routes through the normal completeItem/applyHabitCompletion path:
    // success occurrence + points + defeat exit) and "I indulged" (routes
    // through the new indulgeHabit/applyHabitIndulgence path: points debit +
    // streak zero + exit, no occurrence success). Pushback doesn't apply to
    // a lurker — it never advances, so there's no deadline to push back.
    //
    // Sub-session 5 (Cheat Day token, 2026-07-19): a third row targets THIS
    // lurker with a held Cheat Day token (reuses pushback's tap-a-zombie
    // targeting shape). Three states: an ACTIVE cheat day for this lurker's
    // day shows a note (indulging is free — items.js's indulgeHabit already
    // enforces this); zero held shows nothing (nothing to use); one-or-more
    // held shows the "Use Cheat Day" button.
    // Skip Day (frozen-slots sub-session 5, 2026-07-19): targets ANY habit
    // instance — positive or negative, unlike Cheat Day's negative-only
    // reach — via its popup, reusing the tap-a-zombie targeting shape.
    // "Clear immediately" model (Jeremy's call, 2026-07-19): using it
    // removes THIS instance from the board right away, so unlike Cheat Day
    // there's no "active" note state to render — the button either offers
    // itself (held > 0) or the row is simply empty. Tasks never show it
    // (fork 4, docs/FROZEN_SLOTS_PLAN.md: Skip Day is habits-only).
    function buildSkipDaySectionHtml(item, deps) {
        if (item.type !== 'habit') return '';
        const heldSkipDays = typeof deps.getSkipDayHeldCount === 'function' ? deps.getSkipDayHeldCount() : 0;
        if (heldSkipDays <= 0) return '';
        return `<button type="button" id="useSkipDayBtn" class="negative-habit-button skipday-btn">Use Skip Day (${heldSkipDays} held)</button>`;
    }

    function buildActionsHtml(item, deps) {
        // KO ghost (2026-10-25): completable, but no edit / pushback / cheat day /
        // skip day while the routine is down.
        if (item.koGhost) {
            if (isNegativeHabitInstance(item)) {
                return `
                    <div class="task-actions negative-habit-actions" style="display: flex; justify-content: flex-end; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <button type="button" id="avoidHabitBtn" class="negative-habit-button avoid-btn">Resisted</button>
                        <button type="button" id="indulgeHabitBtn" class="negative-habit-button indulge-btn">Slipped</button>
                    </div>`;
            }
            const openSubs = (item.type === 'task' && item.subTasks) ? item.subTasks.length : 0;
            return `
                <div class="task-actions" style="display: flex; justify-content: flex-end; gap: 10px; align-items: center;">
                    <label class="completion-checkbox"${openSubs ? ` title="${openSubs} sub-task${openSubs === 1 ? '' : 's'} remaining" style="cursor: not-allowed; opacity: 0.6;"` : ''}>
                        <input type="checkbox" id="completeTaskCheck" class="completion-checkbox-input" aria-label="Mark as complete"${openSubs ? ' disabled' : ''} />
                        ${openSubs ? `<span class="completion-remaining">(${openSubs} remaining)</span>` : ''}
                    </label>
                </div>`;
        }
        if (isNegativeHabitInstance(item)) {
            const cheatDayActive = typeof deps.isCheatDayActiveForItem === 'function' && deps.isCheatDayActiveForItem(item);
            const heldCheatDays = typeof deps.getCheatDayHeldCount === 'function' ? deps.getCheatDayHeldCount() : 0;
            const cheatDayRow = cheatDayActive
                ? `<p class="cheat-day-active-note">🎟️ Cheat Day active — slipping today is free.</p>`
                : (heldCheatDays > 0
                    ? `<button type="button" id="useCheatDayBtn" class="negative-habit-button cheatday-btn">Use Cheat Day (${heldCheatDays} held)</button>`
                    : '');
            const limitOk = typeof deps.toggleWorkTimer === 'function' && typeof Timer !== 'undefined' && Timer.canLimitTimer(item);
            const limitHtml = limitOk
                ? `<div class="timer-stack"><div class="timer-row"><button type="button" id="workTimerBtn" class="work-timer-btn${Timer.isRunning(item) ? ' running' : ''}${Timer.isOverLimit(item, Date.now()) ? ' over-limit' : ''}">${Timer.popupHtml(item)}</button>${Timer.stopButtonHtml(item, 'workTimerStopBtn')}</div>${Timer.limitCaptionHtml(item, Date.now(), 'workTimerCaption')}</div>`
                : '';
            return `
                <div class="task-actions negative-habit-actions" style="display: flex; justify-content: flex-end; gap: 10px; align-items: center; flex-wrap: wrap;">
                    ${limitHtml}
                    <button id="editTaskBtn" class="edit-icon-btn" title="Edit Task" aria-label="Edit task"></button>
                    <button type="button" id="avoidHabitBtn" class="negative-habit-button avoid-btn">Resisted</button>
                    <button type="button" id="indulgeHabitBtn" class="negative-habit-button indulge-btn">Slipped</button>
                </div>
                ${cheatDayRow}
                ${buildSkipDaySectionHtml(item, deps)}
            `;
        }
        // [P1-DATA-004] sub-session 1 (2026-07-19): mirrors agendaList.js's
        // disabled-checkbox treatment — see its comment for the rationale
        // (Items.completeItem is the real backstop; this is the proactive
        // half + a visible reason).
        const openSubTaskCount = (item.type === 'task' && item.subTasks) ? item.subTasks.length : 0;
        const hasOpenSubTasks = openSubTaskCount > 0;
        const remainingSuffix = openSubTaskCount === 1 ? '' : 's';
        const timerOk = typeof deps.toggleWorkTimer === 'function' && typeof Timer !== 'undefined' && Timer.canTimer(item);
        const timerRunning = timerOk && Timer.isRunning(item);
        const timerHtml = timerOk
            ? `<button type="button" id="workTimerBtn" class="work-timer-btn${timerRunning ? ' running' : ''}${Timer.shouldNudge(item) ? ' attacking' : ''}${Timer.shouldPrompt(item) ? ' planned' : ''}"${Timer.shouldNudge(item) ? ` title="${Timer.NUDGE_TITLE}"` : Timer.shouldPrompt(item) ? ` title="${Timer.PROMPT_TITLE}"` : ''}>${Timer.popupHtml(item)}</button>${Timer.stopButtonHtml(item, 'workTimerStopBtn')}`
            : '';
        return `
            <div class="task-actions" style="display: flex; justify-content: flex-end; gap: 10px; align-items: center;">
                ${timerHtml}
                <button id="editTaskBtn" class="edit-icon-btn" title="Edit Task" aria-label="Edit task"></button>
                <label class="completion-checkbox"${hasOpenSubTasks ? ` title="${openSubTaskCount} sub-task${remainingSuffix} remaining" style="cursor: not-allowed; opacity: 0.6;"` : ''}>
                    <input type="checkbox" id="completeTaskCheck" class="completion-checkbox-input" aria-label="Mark as complete"${hasOpenSubTasks ? ' disabled' : ''} />
                    ${hasOpenSubTasks ? `<span class="completion-remaining">(${openSubTaskCount} remaining)</span>` : ''}
                </label>
            </div>
            ${timerOk ? nudgeNoteHtml(item, deps) : ''}
            ${buildPushbackSectionHtml(item, deps)}
            ${buildSkipDaySectionHtml(item, deps)}
        `;
    }

    // The words behind the red timer pulse (2026-11-02, Jeremy). Always rendered for a timer item (hidden when
    // there is nothing to say) so a timer click can refresh it in place; see refreshNudgeNote.
    function escapeNoteText(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function nudgeNoteHtml(item, deps) {
        const note = Timer.nudgeNote(item, deps.activeItems);
        return `<p id="timerNudgeNote" class="timer-nudge-note${note ? ' timer-nudge-' + note.kind : ''}" role="status"${note ? '' : ' hidden'}>${note ? escapeNoteText(note.text) : ''}</p>`;
    }
    function refreshNudgeNote(item, deps) {
        const el = document.getElementById('timerNudgeNote');
        if (!el) return;
        const note = Timer.nudgeNote(item, deps.activeItems);
        el.hidden = !note;
        el.className = 'timer-nudge-note' + (note ? ' timer-nudge-' + note.kind : '');
        el.textContent = note ? note.text : '';
    }

    // Logged time (Habit Goals Build 2c): an hours + minutes field with its own Save, shown for any item that has (or can
    // have) a timer. Disabled while the timer runs (pause first). An edit never changes the answer.
    function hasLoggedTimeField(item, deps) {
        return typeof deps.setLoggedTime === 'function' && typeof Timer !== 'undefined' && typeof Forms !== 'undefined'
            && (Timer.canTimer(item) || Timer.hasLogged(item));
    }
    const LOGGED_RUNNING_NOTE = 'Pause the timer to edit the logged time.';
    function buildLoggedTimeSectionHtml(item, deps) {
        if (!hasLoggedTimeField(item, deps)) return '';
        const running = Timer.isRunning(item);
        return `<div class="logged-time-section">${Forms.loggedTimeHtml({ idPrefix: 'popupLogged', ms: item.timerMsBanked, disabled: running, note: running ? LOGGED_RUNNING_NOTE : '' })}` +
            `<div class="logged-time-actions"><button type="button" id="popupLoggedSave" class="secondary-button"${running ? ' disabled' : ''}>Save time</button>` +
            `<span id="popupLoggedMsg" class="logged-time-msg" role="status" aria-live="polite"></span></div></div>`;
    }

    // How much? (Habit Goals Build 3): an Amount-goal habit's popup offers an optional number when it is answered here. A Time goal
    // has no second box: the Logged time field above IS its How much? (plan Decision 14). The row checkbox never asks.
    function buildHowMuchSectionHtml(item) {
        if (item.type !== 'habit' || typeof GoalCheck === 'undefined' || typeof CheckIn === 'undefined' || typeof Habits === 'undefined') return '';
        const goal = Habits.goalOf(item);
        if (GoalCheck.howMuchKind(goal) !== 'amount') return '';
        return `<div id="popupHowMuch" class="popup-how-much">${CheckIn.howMuchHtml(goal, item)}</div>`;
    }
    function readPopupHowMuch() {
        const box = document.getElementById('popupHowMuch');
        if (!box || typeof CheckIn === 'undefined') return undefined;
        const how = CheckIn.readHowMuch(box);
        return how.actual !== undefined ? { actual: how.actual } : undefined;
    }

    // "Pays x2 . 19 of last 22 done . x3 at 22/22" (2026-11-02, Jeremy). Display only: the numbers come from
    // PointsInfo, which reads the same history Habits.pointsMultiplier awards from. '' if anything is missing.
    function buildHabitPointsLineHtml(item, deps) {
        if (!item || item.type !== 'habit' || typeof PointsInfo === 'undefined') return '';
        if (!deps || typeof deps.definedHabits !== 'function') return '';
        const def = (deps.definedHabits() || []).find(h => h.id === item.definitionId);
        if (!def) return '';
        const cfg = typeof CONFIG !== 'undefined' ? CONFIG : null;
        if (!cfg) return '';
        const line = PointsInfo.habitBonusInfo(def, cfg).line;
        const ghost = item.koGhost ? ' (no points while knocked out)' : '';
        return `<p class="habit-points-line"><strong>Points:</strong> ${line}${ghost}</p>`;
    }

    // The popup's "Due:" value. An anytime task (2026-11-02) reads "<date> \u00B7 Midnight" instead of 11:59 PM (same word as the list row), but only
    // while its due time is still 23:59 (a stale flag falls back to the real time).
    function taskDueDisplayText(item) {
        const d = item.dueDateTime;
        if (item.type === 'task' && item.anytime === true && d.getHours() === 23 && d.getMinutes() === 59) {
            return d.toLocaleDateString() + ' \u00B7 Midnight';
        }
        return d.toLocaleString();
    }

    function showTaskDetailsPopup(item, deps) {
        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content task-details-modal">
                    <button class="close-modal-x" onclick="closeModal()">&times;</button>
                    <h3>${item.name}</h3>
                    ${item.koGhost ? '<p class="ko-ghost-note">\u{1F4A4} Knocked out \u2014 revives tomorrow. Finishing this still counts (XP and streak, no points); skipping it is excused.</p>' : ''}
                    <div class="task-details">
                        <p><strong>Category:</strong> ${item.category}</p>
                        ${isNegativeHabitInstance(item)
                            ? `<p><strong>Tempting around:</strong> <span class="task-due-display">${item.dueDateTime.toLocaleTimeString([], { timeStyle: 'short' })}</span></p>`
                            : `<p><strong>Due:</strong> <span class="task-due-display">${taskDueDisplayText(item)}</span></p>`}
                        <p><strong>Priority:</strong> ${item.isHighPriority ? 'High' : 'Normal'}</p>
                        ${item.type === 'habit' ? `<p><strong>Streak:</strong> ${item.streak}${howItWorksButton('streaks', 'How streaks work')}</p>` : ''}
                        ${buildHabitPointsLineHtml(item, deps)}
                        ${(item.type === 'habit' && typeof Habits !== 'undefined' && Habits.formatGoal && Habits.formatGoal(item.goal, item.isNegative))
                            ? `<p class="habit-goal-line"><strong>${item.isNegative ? 'Limit' : 'Goal'}:</strong> ${Habits.formatGoal(item.goal, item.isNegative).replace(/^(Goal|Limit): /, '').replace(/</g, '&lt;')}</p>` : ''}
                        ${buildLoggedTimeSectionHtml(item, deps)}
                        ${buildHowMuchSectionHtml(item)}
                        ${buildActionsHtml(item, deps)}
                    </div>
                </div>
            </div>
        `;

        const overlay = Modal.open(modalHtml);

        // Add event listeners
        const completeCheckbox = document.getElementById('completeTaskCheck');
        const editButton = document.getElementById('editTaskBtn');
        const avoidButton = document.getElementById('avoidHabitBtn');
        const indulgeButton = document.getElementById('indulgeHabitBtn');

        if (completeCheckbox) {
            completeCheckbox.addEventListener('change', () => {
                if (completeCheckbox.checked) {
                    deps.completeItem(item.id, readPopupHowMuch());
                    Modal.closeModal();
                }
            });
        }

        if (avoidButton) {
            avoidButton.addEventListener('click', () => {
                deps.completeItem(item.id, readPopupHowMuch());
                Modal.closeModal();
            });
        }

        if (indulgeButton) {
            indulgeButton.addEventListener('click', () => {
                deps.indulgeHabit(item.id, readPopupHowMuch());
                Modal.closeModal();
            });
        }

        // Use Cheat Day button (sub-session 5, 2026-07-19). Unlike pushback's
        // in-place refresh, this REPLACES the button with an "active" note —
        // rebuilding the popup while its own click is still bubbling is
        // exactly the hazard that bit the shop's Buy/Use buttons (session 21,
        // see SHOP_PLAN.md hazards / DECISIONS.md), so the rebuild is
        // deferred via setTimeout(0). Simplest correct rebuild: close and
        // reopen the SAME popup, which re-evaluates cheatDayActive/held
        // fresh from deps.
        const useCheatDayButton = document.getElementById('useCheatDayBtn');
        if (useCheatDayButton) {
            useCheatDayButton.addEventListener('click', () => {
                const result = deps.onUseCheatDay ? deps.onUseCheatDay('cheat_day', item) : { ok: false };
                if (result && result.ok) {
                    setTimeout(() => {
                        Modal.closeModal();
                        showTaskDetailsPopup(item, deps);
                    }, 0);
                }
            });
        }

        // Use Skip Day button (frozen-slots sub-session 5, 2026-07-19).
        // Unlike Cheat Day's rebuild-in-place, using Skip Day removes THIS
        // item from the board immediately ("clear immediately" model), so
        // there's nothing left for the popup to show — just close it. No
        // setTimeout(0) needed: closeModal() alone (no rebuild racing it) is
        // the same safe shape as the avoid/indulge buttons above.
        const useSkipDayButton = document.getElementById('useSkipDayBtn');
        if (useSkipDayButton) {
            useSkipDayButton.addEventListener('click', () => {
                const result = deps.onUseSkipDay ? deps.onUseSkipDay('skip_day', item) : { ok: false };
                if (result && result.ok) {
                    Modal.closeModal();
                }
            });
        }

        const workTimerButton = document.getElementById('workTimerBtn');
        const workTimerStopButton = document.getElementById('workTimerStopBtn');
        const loggedSave = document.getElementById('popupLoggedSave');
        const loggedMsg = document.getElementById('popupLoggedMsg');
        if (workTimerButton) {
            // Main button: start / resume when idle, pause when running; the Stop icon beside it (shown while running)
            // ends the session. Time is kept either way.
            const timerClick = (action) => {
                const r = deps.toggleWorkTimer(item.id, action);
                if (r && r.ok) {
                    if (r.completed) { Modal.closeModal(); return; }
                    workTimerButton.classList.toggle('running', r.running);
                    workTimerButton.classList.toggle('attacking', Timer.shouldNudge(item));
                    workTimerButton.classList.toggle('planned', Timer.shouldPrompt(item));
                    refreshNudgeNote(item, deps);
                    workTimerButton.innerHTML = Timer.popupHtml(item);
                    const over = Timer.isOverLimit(item, Date.now());
                    workTimerButton.classList.toggle('over-limit', over);
                    if (workTimerStopButton) workTimerStopButton.classList.toggle('over-limit', over);
                    const caption = document.getElementById('workTimerCaption');
                    if (caption) caption.classList.toggle('over', over);
                    if (workTimerStopButton) workTimerStopButton.hidden = !Timer.controlState(item).stop;
                    // Logged-time field: locked while the timer runs, refreshed from the banked total otherwise.
                    const running = Timer.isRunning(item);
                    const lh = document.getElementById('popupLoggedHours');
                    const lm = document.getElementById('popupLoggedMinutes');
                    if (lh && lm) {
                        lh.disabled = running; lm.disabled = running;
                        if (loggedSave) loggedSave.disabled = running;
                        if (!running) {
                            const total = Forms.loggedTimeMinutes(item.timerMsBanked);
                            lh.value = String(Math.floor(total / 60)); lm.value = String(total % 60);
                            const g = document.getElementById('popupLoggedGroup');
                            if (g) g.setAttribute('data-initial-min', String(total));
                        }
                        if (loggedMsg) loggedMsg.textContent = running ? LOGGED_RUNNING_NOTE : '';
                    }
                }
            };
            workTimerButton.addEventListener('click', () => timerClick());
            if (workTimerStopButton) workTimerStopButton.addEventListener('click', () => timerClick('stop'));
        }

        // Logged-time field: Save time sets it through deps.setLoggedTime (daily record corrected by the difference).
        if (loggedSave) {
            loggedSave.addEventListener('click', () => {
                const say = (t) => { if (loggedMsg) loggedMsg.textContent = t; };
                const r = Forms.readLoggedTime('popupLogged');
                if (r.error) { say(r.error); return; }
                if (r.absent || !r.changed) { say('No change.'); return; }
                const res = deps.setLoggedTime(item.id, r.ms);
                if (!res || !res.ok) { say(res && res.reason === 'running' ? LOGGED_RUNNING_NOTE : 'Couldn\u2019t save the time.'); return; }
                const group = document.getElementById('popupLoggedGroup');
                if (group) group.setAttribute('data-initial-min', String(Forms.loggedTimeMinutes(r.ms)));
                if (workTimerButton) workTimerButton.innerHTML = Timer.popupHtml(item);
                say('Saved.');
            });
        }

        if (editButton) {
            editButton.addEventListener('click', () => {
                Modal.closeModal();
                showEditTaskModal(item, deps);
            });
        }

        // Pushback tier buttons (session 4). Each applies its tier to THIS
        // item via deps.onPushback, which pays + shifts the due date + saves
        // and returns { ok }. On success we refresh the popup IN PLACE — update
        // the shown due time and re-evaluate every tier's affordability against
        // the now-lower points — rather than rebuilding the section's innerHTML.
        // In-place updates never detach the just-clicked button, so this
        // sidesteps the click-event-bubbling hazard that bit the shop Buy/Use
        // buttons (see SHOP_PLAN.md hazards / DECISIONS.md session 21); no
        // setTimeout(0) needed here. Stacking multiple pushbacks in one popup
        // session is supported (ECONOMY.md "stacking allowed"). `overlay` is
        // the element Modal.open() returned above, not a fresh query.

        function refreshPushbackUI() {
            const dueDisplay = overlay.querySelector('.task-due-display');
            if (dueDisplay) dueDisplay.textContent = taskDueDisplayText(item);

            const points = typeof deps.getPlayerPoints === 'function' ? deps.getPlayerPoints() : 0;
            const options = pushbackOptionsOf(item, deps);
            let anyUnaffordable = false;
            overlay.querySelectorAll('.pushback-btn').forEach(btn => {
                const o = options.find(x => x.sizeId === btn.dataset.sizeId);
                if (o) {
                    btn.disabled = o.kind === 'blocked';
                    btn.innerHTML = pushbackButtonHtml(o);
                    if (btn.disabled) anyUnaffordable = true;
                }
            });

            // Keep the balance note in sync (appears once a tier becomes
            // unaffordable, updates as points drop across stacked pushes).
            const note = overlay.querySelector('.pushback-balance-note');
            if (note) note.textContent = anyUnaffordable ? `(you have ${points} pts)` : '';

            // The (i) panel's "Right now" numbers follow the charges just spent.
            const pop = overlay.querySelector('#popupPushbackHint');
            const ctx = pushbackHelpCtx(deps);
            if (pop && ctx && typeof PushbackHelp !== 'undefined') pop.innerHTML = PushbackHelp.hintHtml(ctx);
        }
        if (typeof PushbackHelp !== 'undefined') PushbackHelp.wireHint(overlay);

        overlay.querySelectorAll('.pushback-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const result = deps.onPushback(btn.dataset.sizeId, item);
                if (result && result.ok) refreshPushbackUI();
            });
        });

        // Backdrop-click dismissal is handled centrally by
        // Modal.initDismissHandlers ([P2-UI-011] Stage 1, session 61) —
        // the per-popup listener that lived here was redundant with the
        // document-level handler and used nuke-all closeModal().
    }

    // deps: { activeItems, recomputeOverdueStateAfterEdit, createListItem,
    //         sortAndRenderActiveList, saveGame, clampSubTaskDueDates? }
    // "When is this due now?" — shown by Items.uncompleteItemWithDuePrompt
    // when undoing a completed task/sub-task whose due time has passed
    // (DECISIONS.md 2026-10-12). cb({dueDateTime: Date}) for a new future time,
    // cb({dueDateTime: null}) to keep the original (clean-slate clock),
    // cb({cancel: true}) to abort the undo. Sub-tasks can't pass the parent's
    // deadline (same rule as the edit form). deps: { activeItems }.
    // opts.remaining (Build 2): how many more pickers are queued AFTER this one
    // (revive flow). When >= 1 a "Keep original for all remaining" button shows;
    // it calls cb({dueDateTime: null, skipAll: true}).
    function promptNewDueTime(item, deps, cb, opts) {
        const remaining = (opts && opts.remaining) || 0;
        const parent = item.parentId
            ? (deps.activeItems || []).find(i => i.id === item.parentId && i.type === 'task')
            : null;
        const maxAttr = parent ? ` max="${formatDateInputValue(parent.dueDateTime)}"` : '';
        // A sub-task can never be due after its parent: suggest the sooner of
        // now+1h and the parent's deadline, and if the parent itself is already
        // past due there is no valid future time, so only "Keep original" and
        // "Cancel" are offered.
        const parentHasRoom = !parent || parent.dueDateTime.getTime() > Date.now();
        const oneHour = new Date(Date.now() + 60 * 60 * 1000);
        const suggested = (parent && parentHasRoom && parent.dueDateTime < oneHour) ? parent.dueDateTime : oneHour;
        const html = `
            <div class="modal-overlay" id="uncompleteDueOverlay">
                <div class="modal-content">
                    <h3>When is this due now?</h3>
                    <p>"${String(item.name).replace(/</g, '&lt;')}" is past its original due time. Pick a new one, or keep the original and it comes back overdue.</p>
                    <div class="form-row-group">
                        <div class="form-row">
                            <label for="uncompleteDueDate">Due Date:</label>
                            <input type="date" id="uncompleteDueDate" value="${formatDateInputValue(suggested)}"${maxAttr} required>
                        </div>
                        <div class="form-row">
                            <label for="uncompleteDueTime">Due Time:</label>
                            <input type="time" id="uncompleteDueTime" value="${formatTimeInputValue(suggested)}">
                        </div>
                    </div>
                    ${parentHasRoom ? '' : '<p class="form-note">The parent task is already past due, so this sub-task can\'t be given a later time. Keep the original, or cancel.</p>'}
                    <p id="uncompleteDueError" class="form-error" style="display:none;"></p>
                    <div class="modal-buttons">
                        <button id="uncompleteSetDue" class="primary-button"${parentHasRoom ? '' : ' disabled'}>Set new due time</button>
                        <button id="uncompleteKeepDue" class="secondary-button">Keep original (overdue)</button>
                        ${remaining >= 1 ? `<button id="uncompleteKeepAll" class="secondary-button">Keep original for all remaining (${remaining + 1})</button>` : ''}
                        <button id="uncompleteCancel" class="secondary-button">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        Modal.open(html);
        const finish = (result) => { Modal.closeModal(); cb(result); };
        const showError = (msg) => {
            const el = document.getElementById('uncompleteDueError');
            if (el) { el.textContent = msg; el.style.display = 'block'; }
        };
        const on = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', handler);
        };
        on('uncompleteSetDue', () => {
            const d = document.getElementById('uncompleteDueDate').value;
            const t = document.getElementById('uncompleteDueTime').value || '00:00';
            if (!d) { showError('Pick a due date.'); return; }
            const next = new Date(`${d}T${t}`);
            if (isNaN(next.getTime()) || next.getTime() <= Date.now()) {
                showError('Pick a time in the future, or keep the original.');
                return;
            }
            if (parent && next > parent.dueDateTime) {
                showError(`A sub-task can't be due after its parent (${formatDateInputValue(parent.dueDateTime)} ${formatTimeInputValue(parent.dueDateTime)}).`);
                return;
            }
            finish({ dueDateTime: next });
        });
        on('uncompleteKeepDue', () => finish({ dueDateTime: null }));
        on('uncompleteKeepAll', () => finish({ dueDateTime: null, skipAll: true }));
        on('uncompleteCancel', () => finish({ cancel: true }));
    }

    function showEditTaskModal(item, deps) {
        const dueDate = formatDateInputValue(item.dueDateTime);
        const dueTime = formatTimeInputValue(item.dueDateTime);
        // Optional planned start (2026-11-01): blank when none, or when it no longer sits before the due time.
        const startTime = Clock.hasWorkWindow(item) ? formatTimeInputValue(item.startDateTime) : '';

        // Dependent due dates ([P1-DATA-004] sub-session 2): editing a SUB
        // caps its date at the parent's deadline (max attr + loud save-time
        // validation below — reject, don't silently clamp, on manual entry).
        const editParentTask = item.parentId
            ? deps.activeItems.find(i => i.id === item.parentId && i.type === 'task')
            : null;
        const maxDateAttr = editParentTask
            ? ` max="${formatDateInputValue(editParentTask.dueDateTime)}"`
            : '';

        // "Anytime" (2026-11-02): top-level, non-routine tasks only (sub-tasks follow their parent; routine tasks keep their template time).
        const showAnytimeRow = !item.parentId && item.definitionId == null;

        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>Edit Task</h3>
                    <div class="form-row">
                        <label for="editTaskName">Task Name:</label>
                        <input type="text" id="editTaskName" value="${item.name}" required>
                    </div>
                    <div class="form-row">
                        <label for="editTaskCategory">Category:</label>
                        <select id="editTaskCategory">
                            <option value="other" ${item.category === 'other' ? 'selected' : ''}>Other (Generic)</option>
                            <option value="career" ${item.category === 'career' ? 'selected' : ''}>Career</option>
                            <option value="creativity" ${item.category === 'creativity' ? 'selected' : ''}>Creativity</option>
                            <option value="financial" ${item.category === 'financial' ? 'selected' : ''}>Financial</option>
                            <option value="health" ${item.category === 'health' ? 'selected' : ''}>Health</option>
                            <option value="lifestyle" ${item.category === 'lifestyle' ? 'selected' : ''}>Lifestyle</option>
                            <option value="relationships" ${item.category === 'relationships' ? 'selected' : ''}>Relationships</option>
                            <option value="spirituality" ${item.category === 'spirituality' ? 'selected' : ''}>Spirituality</option>
                        </select>
                    </div>
                    <div class="form-row priority-row">
                        <input type="checkbox" id="editTaskHighPriority" ${item.isHighPriority ? 'checked' : ''}>
                        <label for="editTaskHighPriority">High Priority</label>
                    </div>
                    <div class="form-row">
                        <label for="editDueDate">Due Date:</label>
                        <input type="date" id="editDueDate" value="${dueDate}"${maxDateAttr} required>
                    </div>
                    ${showAnytimeRow ? Forms.anytimeRowHtml({ id: 'editTaskAnytime', checked: item.anytime === true }) : ''}
                    ${Forms.startDueTimeGroupHtml({ startId: 'editStartTime', dueId: 'editDueTime', startValue: startTime, dueValue: dueTime })}
                    <p id="editRescheduleNote" class="reschedule-note" aria-live="polite"></p>
                    ${editPushbackHelpHtml(deps)}
                    ${hasLoggedTimeField(item, deps) ? Forms.loggedTimeHtml({ idPrefix: 'editLogged', ms: item.timerMsBanked, disabled: Timer.isRunning(item), note: Timer.isRunning(item) ? LOGGED_RUNNING_NOTE : '' }) : ''}
                    <div class="modal-buttons">
                        <button id="saveTaskChanges" class="primary-button">Save Changes</button>
                        <button class="secondary-button" onclick="closeModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        Modal.open(modalHtml);
        if (showAnytimeRow) Forms.applyAnytimeToggle('editTaskAnytime');
        if (typeof PushbackHelp !== 'undefined') PushbackHelp.wireHint(document.getElementById('editRescheduleNote') ? document.getElementById('editRescheduleNote').parentElement : document);

        // Pushback charges (Build B): moving the due time LATER while the zombie is close uses a
        // pushback (free charge, held token, then points). Live line under the date/time says
        // which; Save is blocked when it can't be paid (never debt). Optional dep — older callers
        // without it keep the old free behavior.
        const saveButton = document.getElementById('saveTaskChanges');
        const priceNote = document.getElementById('editRescheduleNote');
        const readNewDue = () => {
            const d = document.getElementById('editDueDate').value;
            const anyBox = document.getElementById('editTaskAnytime');
            const t = (anyBox && anyBox.checked) ? Forms.ANYTIME_DUE_TIME : document.getElementById('editDueTime').value;
            if (!d) return null;
            const dt = new Date(`${d}T${t || '00:00'}`);
            return isNaN(dt.getTime()) ? null : dt;
        };
        const refreshPrice = () => {
            if (!priceNote || typeof deps.reschedulePricingFor !== 'function') return null;
            const nd = readNewDue();
            if (!nd) { priceNote.textContent = ''; return null; }
            const r = deps.reschedulePricingFor(item, nd);
            const note = pushbackNoteText(r, typeof deps.getPlayerPoints === 'function' ? deps.getPlayerPoints() : 0);
            const text = note.text;
            const blocked = note.blocked;
            priceNote.textContent = text;
            priceNote.classList.toggle('reschedule-note-blocked', blocked);
            if (saveButton) saveButton.disabled = blocked;
            return r;
        };
        ['editDueDate', 'editDueTime', 'editTaskAnytime'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.addEventListener('input', refreshPrice); el.addEventListener('change', refreshPrice); }
        });
        refreshPrice();

        // Add save functionality
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                const name = document.getElementById('editTaskName').value.trim();
                const category = document.getElementById('editTaskCategory').value;
                const isHighPriority = document.getElementById('editTaskHighPriority').checked;
                const newDueDate = document.getElementById('editDueDate').value;
                const anytimeBox = document.getElementById('editTaskAnytime');
                const isAnytime = !!(anytimeBox && anytimeBox.checked);
                const newDueTime = isAnytime ? Forms.ANYTIME_DUE_TIME : document.getElementById('editDueTime').value;

                if (!name || !newDueDate) {
                    Forms.showFormError('Task Name and Due Date are required.', !name ? 'editTaskName' : 'editDueDate');
                    return;
                }

                const newDueDateTime = new Date(`${newDueDate}T${newDueTime}`);

                // Optional Start time: a time of day ON THE DUE DATE being saved, so a filled box is always re-read
                // on that date (an untouched box used to keep its stored Date and its old calendar day, which broke
                // a task pushed to tomorrow and moved back -- 2026-11-04); blank clears it. Must be strictly earlier than due.
                const startInput = document.getElementById('editStartTime');
                const startValue = startInput ? startInput.value : '';
                let newStartDateTime = Forms.startDateTimeFor(newDueDate, startValue);
                if (isAnytime) newStartDateTime = null; // an anytime task has no work window
                if (startValue && newStartDateTime instanceof Date && !isNaN(newStartDateTime.getTime())
                    && newStartDateTime.getTime() >= newDueDateTime.getTime()) {
                    Forms.showFormError('Start time must be earlier than the due time.', startInput);
                    return;
                }

                // Clamp model ([P1-DATA-004] sub-session 2): a sub-task may
                // not be saved with a due date later than its parent's
                // deadline. Loud rejection on manual entry (form validation),
                // NOT a silent clamp — the data-layer clamp in items.js only
                // backstops programmatic paths.
                if (editParentTask && newDueDateTime > editParentTask.dueDateTime) {
                    Forms.showFormError(`Sub-task due date can't be later than the parent's deadline (${formatDateInputValue(editParentTask.dueDateTime)} ${formatTimeInputValue(editParentTask.dueDateTime)}).`, 'editDueDate');
                    return;
                }

                // Logged time (Habit Goals Build 2c): validated with the other fields, applied after they save.
                const loggedEdit = Forms.readLoggedTime('editLogged');
                if (loggedEdit.error) {
                    Forms.showFormError(loggedEdit.error);
                    return;
                }

                // Price against the CURRENT due (before it's overwritten) and
                // re-check affordability at click time.
                const reschedule = (typeof deps.reschedulePricingFor === 'function')
                    ? deps.reschedulePricingFor(item, newDueDateTime) : null;
                if (reschedule && reschedule.later && !reschedule.canAfford) {
                    refreshPrice();
                    return;
                }

                // Update the item data
                item.name = name;
                item.category = category;
                item.isHighPriority = isHighPriority;
                item.dueDateTime = newDueDateTime;
                item.startDateTime = (newStartDateTime instanceof Date && !isNaN(newStartDateTime.getTime())) ? newStartDateTime : null;
                if (isAnytime) item.anytime = true; else delete item.anytime;
                if (reschedule && typeof deps.commitReschedule === 'function') deps.commitReschedule(item, reschedule);

                // Re-derive overdue state from the NEW due date. Without this,
                // pushing an overdue task's deadline into the future left
                // isOverdue: true (it's only ever set by markAsOverdue/
                // updateActiveItems, never re-checked against dueDateTime), so
                // the zombie stayed camped at the base still ticking damage
                // every DAMAGE_INTERVAL_MS even though it was no longer due.
                // That defeated the whole point of letting someone fix an
                // overly-aggressive deadline. See DECISIONS.md 2026-07-17.
                deps.recomputeOverdueStateAfterEdit(item);

                // Clamp model, parent half ([P1-DATA-004] sub-session 2): if
                // this edit pulled a PARENT's deadline earlier, re-clamp any
                // children now due later than it (each routed through
                // recomputeOverdueStateAfterEdit inside items.js). Pushing
                // later is a no-op inside the clamp function. Runs BEFORE the
                // list-item rebuild below so the parent row's nested sub
                // rendering reflects the clamped child dates. Optional dep —
                // older callers without it keep working unchanged.
                if (!item.parentId && typeof deps.clampSubTaskDueDates === 'function') {
                    deps.clampSubTaskDueDates(item);
                }

                // Update visual elements
                if (item.element) {
                    item.element.classList.toggle('high-priority', isHighPriority);
                    SpriteAnim.setEnemyCategory(item.element, category);
                }

                // Recreate list item with updated data
                if (item.listItemElement) {
                    item.listItemElement.remove();
                    // Only create list item if it's a top-level task (not a sub-task)
                    if (!item.parentId) {
                        deps.createListItem(item);
                    }
                }

                // A sub-task renders NESTED inside its parent's row, so rebuild the
                // parent row too -- otherwise the nested zombie icon + "| category"
                // label keep the old category (2026-10-27), same pattern as
                // showCreateSubTaskModal.
                if (item.parentId) {
                    const editedParent = (deps.activeItems || []).find(i => i.id === item.parentId && i.type === 'task');
                    if (editedParent && editedParent.listItemElement) {
                        editedParent.listItemElement.remove();
                        deps.createListItem(editedParent);
                    }
                }

                deps.sortAndRenderActiveList();
                // Week strip (2026-11-02): a changed due date moves this task to another day's count. Optional dep.
                if (typeof deps.updateTaskCountDisplay === 'function') deps.updateTaskCountDisplay();
                // The logged time is an entry-level edit; it never changes the answer (done / Resisted / Slipped).
                if (loggedEdit.changed && typeof deps.setLoggedTime === 'function') deps.setLoggedTime(item.id, loggedEdit.ms);
                deps.saveGame();
                Modal.closeModal();
            });
        }

        // Backdrop-click dismissal handled centrally by
        // Modal.initDismissHandlers ([P2-UI-011] Stage 1, session 61).
    }

    // deps: passed straight through to showCreateSubTaskModal
    function createSubTaskPrompt(parentId, deps) {
        showCreateSubTaskModal(parentId, deps);
    }

    // deps: { activeItems, createTaskItemData, addItemToGame, createListItem, sortAndRenderActiveList }
    //
    // Debug console.log lines below are DELIBERATELY UNCHANGED — see file
    // header. This function is the historic sub-task-duplication bug site.
    function showCreateSubTaskModal(parentId, deps) {
        console.log('🎯 showCreateSubTaskModal called with parentId:', parentId, 'type:', typeof parentId);

        const parentTask = deps.activeItems.find(item => item.id === parentId && item.type === 'task');
        if (!parentTask) {
            console.log('❌ Parent task not found for parentId:', parentId);
            console.log('Available active items:', deps.activeItems.map(item => ({ id: item.id, name: item.name, type: item.type })));
            Dialog.notice('Parent task not found.', { title: 'Can\'t add a sub-task' });
            return;
        }

        console.log('✅ Found parent task:', { id: parentTask.id, name: parentTask.name, type: parentTask.type });

        const parentDueDate = formatDateInputValue(parentTask.dueDateTime);
        const parentDueTime = formatTimeInputValue(parentTask.dueDateTime);

        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>Create Sub-task for "${parentTask.name}"</h3>
                    <div class="form-row">
                        <label for="subTaskName">Sub-task Name:</label>
                        <input type="text" id="subTaskName" required>
                    </div>
                    <div class="form-row">
                        <label for="subTaskCategory">Category:</label>
                        <select id="subTaskCategory">
                            <option value="other" ${parentTask.category === 'other' ? 'selected' : ''}>Other (Generic)</option>
                            <option value="career" ${parentTask.category === 'career' ? 'selected' : ''}>Career</option>
                            <option value="creativity" ${parentTask.category === 'creativity' ? 'selected' : ''}>Creativity</option>
                            <option value="financial" ${parentTask.category === 'financial' ? 'selected' : ''}>Financial</option>
                            <option value="health" ${parentTask.category === 'health' ? 'selected' : ''}>Health</option>
                            <option value="lifestyle" ${parentTask.category === 'lifestyle' ? 'selected' : ''}>Lifestyle</option>
                            <option value="relationships" ${parentTask.category === 'relationships' ? 'selected' : ''}>Relationships</option>
                            <option value="spirituality" ${parentTask.category === 'spirituality' ? 'selected' : ''}>Spirituality</option>
                        </select>
                    </div>
                    <div class="form-row priority-row">
                        <input type="checkbox" id="subTaskHighPriority" ${parentTask.isHighPriority ? 'checked' : ''}>
                        <label for="subTaskHighPriority">High Priority</label>
                    </div>
                    <div class="form-row">
                        <label for="subTaskDueDate">Due Date:</label>
                        <input type="date" id="subTaskDueDate" value="${parentDueDate}" max="${parentDueDate}" required>
                    </div>
                    ${Forms.startDueTimeGroupHtml({ startId: 'subTaskStartTime', dueId: 'subTaskDueTime', startValue: '', dueValue: parentDueTime })}
                    <div class="modal-buttons">
                        <button id="createSubTaskBtn" class="primary-button">Create Sub-task</button>
                        <button class="secondary-button" onclick="closeModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        Modal.open(modalHtml);

        // Add create functionality
        const createButton = document.getElementById('createSubTaskBtn');
        if (createButton) {
            createButton.addEventListener('click', (event) => {
                console.log('🔥 SUBTASK CREATE BUTTON CLICKED - DEBUG INFO:');
                console.log('Event object:', event);
                console.log('Modal open:', document.querySelector('.modal-overlay') !== null);
                console.log('Preventing default and stopping propagation');

                // Prevent any event bubbling or default actions
                event.preventDefault();
                event.stopPropagation();

                const name = document.getElementById('subTaskName').value.trim();
                const category = document.getElementById('subTaskCategory').value;
                const isHighPriority = document.getElementById('subTaskHighPriority').checked;
                const dueDate = document.getElementById('subTaskDueDate').value;
                const dueTime = document.getElementById('subTaskDueTime').value;

                console.log('Subtask form values:', { name, category, isHighPriority, dueDate, dueTime });

                if (!name || !dueDate) {
                    console.log('⚠️ Subtask creation stopped - missing name or date');
                    Forms.showFormError('Sub-task Name and Due Date are required.', !name ? 'subTaskName' : 'subTaskDueDate');
                    return;
                }

                // Optional Start time (2026-11-01): must be earlier than the due time.
                const subStartInput = document.getElementById('subTaskStartTime');
                const subStartTime = subStartInput ? subStartInput.value : '';
                const subStartError = Forms.startBeforeDueError(subStartTime, dueTime);
                if (subStartError) {
                    Forms.showFormError(subStartError, subStartInput);
                    return;
                }

                // Clamp model ([P1-DATA-004] sub-session 2): reject a due
                // date later than the parent's deadline. Mirrors
                // createTaskItemData's parse rules (date-only → 23:59:59.999)
                // so the value validated here is the value that would be
                // stored. Loud rejection, not a silent clamp — items.js's
                // data-layer clamp only backstops programmatic paths.
                let candidateDue;
                if (dueDate && dueTime) {
                    candidateDue = new Date(`${dueDate}T${dueTime}`);
                } else {
                    candidateDue = new Date(dueDate);
                    candidateDue.setHours(23, 59, 59, 999);
                }
                if (!isNaN(candidateDue.getTime()) && candidateDue > parentTask.dueDateTime) {
                    console.log('⚠️ Subtask creation stopped - due date later than parent deadline');
                    Forms.showFormError(`Sub-task due date can't be later than the parent's deadline (${parentDueDate} ${parentDueTime}).`, 'subTaskDueDate');
                    return;
                }

                console.log('✅ Creating SUBTASK:', { name, category, isHighPriority, dueDate, dueTime, parentId });

                // Create sub-task with specified fields
                const subTaskData = deps.createTaskItemData(
                    name,
                    category,
                    isHighPriority,
                    dueDate,
                    dueTime,
                    parentId,
                    subStartTime || undefined
                );

                // Add to parent's subTasks array
                parentTask.subTasks.push(subTaskData.id);
                parentTask.totalSubTasks = parentTask.subTasks.length;

                // Use centralized addItemToGame function which handles subtask logic
                deps.addItemToGame(subTaskData);

                // Refresh the parent task's list item to show the new sub-task
                if (parentTask.listItemElement) {
                    parentTask.listItemElement.remove();
                    deps.createListItem(parentTask);
                    deps.sortAndRenderActiveList();
                }

                console.log('🏁 Subtask creation complete, closing modal');
                Modal.closeModal();
            });
        }

        // Backdrop-click dismissal handled centrally by
        // Modal.initDismissHandlers ([P2-UI-011] Stage 1, session 61).
    }

    return {
        handleEnemyClick,
        showTaskDetailsPopup,
        showEditTaskModal,
        promptNewDueTime,
        createSubTaskPrompt,
        showCreateSubTaskModal,
        // Exposed for tests (test/popups-prefill.test.js)
        formatDateInputValue,
        formatTimeInputValue,
        pushbackNoteText,
        pushbackButtonText,
        pushbackButtonHtml,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Popups;
}

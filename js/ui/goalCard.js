/**
 * GoalCard -- the window that opens when a goal's cell is tapped (Goals Build B1, 2026-11-05; docs/GOALS_PLAN.md "Screens").
 *
 * Shows the goal's name, kind line, art, progress, the pace in words, each target with its controls (a number: - / + and a type-in;
 * a yes/no: a check; tasks-and-habits and your-days targets: read-only lines, they count by themselves), the streak strip of a
 * recurring goal, and Retire (recurring only: it moves to the finished list) / Delete, each behind an inline confirm (no native
 * dialogs). Adding and editing goals is Build B2.
 *
 * Baseline rule (CLAUDE.md): engine words only; theme words come from Theme.strings.goals at call time. Helpers from GoalsPane
 * (pure) and Modal are read as stable globals.
 *
 * PURE / DOM split: stepFor, targetText, targetNote, streakLine, html are pure and unit-tested (test/goalCard.test.js); open is DOM.
 */
const GoalCard = (() => {
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ESC[c]);
    }
    const themeStrings = () => (typeof Theme !== 'undefined' && Theme.strings && Theme.strings.goals) ? Theme.strings.goals : {};

    // ---- pure -----------------------------------------------------------------------------------------------------------------

    /** How far the - / + buttons move a number target: 1 for small ranges, 5 or 10 for big ones. */
    function stepFor(target) {
        const span = Math.abs((target.end || 0) - (target.start || 0));
        if (span >= 200) return 10;
        if (span >= 50) return 5;
        return 1;
    }

    /** +1 when the target counts up, -1 when it counts down (end below start). */
    function directionOf(target) {
        return (target.end || 0) >= (target.start || 0) ? 1 : -1;
    }

    /** "6 of 10 steps" / "186 lb (from 200 to 180)" / "Done" for the line under a target's label. */
    function targetText(entry) {
        const d = entry.detail;
        const f = GoalsPane.fmtNum;
        const noun = d.noun ? ' ' + d.noun : '';
        switch (d.kind) {
            case 'number':
                return d.start ? `${f(d.have)}${noun} (from ${f(d.start)} to ${f(d.need)})` : `${f(d.have)} of ${f(d.need)}${noun}`;
            case 'bool':
                return d.have ? 'Done' : 'Not yet';
            case 'linked':
                return d.need > 0 ? `${f(d.have)} of ${f(d.need)} done` : 'Nothing linked yet';
            case 'aggregate':
                if (d.noun === 'days') return `${f(d.have)} of ${f(d.need)} days so far`;
                if (d.mode === 'limit') return `${f(d.have)}${noun} so far (keep it to ${f(d.need)}${noun} or less)`;
                return `${f(d.have)} of ${f(d.need)}${noun} so far`;
            default:
                return '';
        }
    }

    /** A short note under a target that counts by itself, so the player knows there is nothing to tap. */
    function targetNote(entry) {
        const t = entry.target;
        if (t.type === 'linked') return 'Counted as you finish the linked tasks and habits.';
        if (t.type === 'aggregate') return 'Counted from your days. Nothing to enter.';
        return '';
    }

    function streakLine(goal) {
        if (goal.kind !== 'recurring') return '';
        const parts = [`Streak ${goal.streak}`, `Best ${goal.bestStreak}`, `${goal.periodsMet} ${goal.periodsMet === 1 ? 'period' : 'periods'} met`];
        return parts.join(' · ');
    }

    function targetHtml(entry) {
        const t = entry.target;
        const pct = GoalsPane.percent(entry.progress);
        const head = `<div class="goal-target-head"><span class="goal-target-label">${esc(t.label || 'Target')}</span><span class="goal-target-text">${esc(targetText(entry))}</span></div>`;
        const bar = `<div class="goal-target-bar" aria-hidden="true"><span class="goal-target-fill" style="width:${pct}%"></span></div>`;
        let controls = '';
        if (t.type === 'number') {
            const label = esc(t.label || 'Value');
            controls = `<div class="goal-target-controls">`
                + `<button type="button" class="goal-step-btn" data-action="num-step" data-target="${esc(t.id)}" data-dir="-1" data-key="dec-${esc(t.id)}" aria-label="Take progress off ${label}">−</button>`
                + `<input type="number" inputmode="decimal" class="goal-num-input" data-action="num-set" data-target="${esc(t.id)}" data-key="set-${esc(t.id)}" value="${esc(GoalsPane.fmtNum(t.current))}" aria-label="${label}, current value">`
                + `<button type="button" class="goal-step-btn" data-action="num-step" data-target="${esc(t.id)}" data-dir="1" data-key="inc-${esc(t.id)}" aria-label="Add progress to ${label}">+</button>`
                + `</div>`;
        } else if (t.type === 'bool') {
            controls = `<label class="goal-bool"><input type="checkbox" data-action="bool" data-target="${esc(t.id)}" data-key="bool-${esc(t.id)}"${t.done ? ' checked' : ''}> <span>${t.done ? 'Done' : 'Mark as done'}</span></label>`;
        } else {
            const note = targetNote(entry);
            controls = note ? `<p class="goal-target-note">${esc(note)}</p>` : '';
        }
        return `<li class="goal-target goal-target--${esc(t.type)}">${head}${bar}${controls}</li>`;
    }

    function historyHtml(goal) {
        if (goal.kind !== 'recurring') return '';
        const recent = goal.history.slice(-8);
        const strip = recent.length
            ? `<span class="goal-history" aria-label="Last ${recent.length} periods">${recent.map(h => `<i class="goal-pip${h.met ? ' goal-pip--met' : ''}" title="${esc(h.key)}: ${h.met ? 'met' : 'missed'}"></i>`).join('')}</span>`
            : '<span class="goal-history-empty">No finished periods yet.</span>';
        return `<div class="goal-streak"><span>${esc(streakLine(goal))}</span>${strip}</div>`;
    }

    function footerHtml(view, confirm) {
        const ts = themeStrings();
        const g = view.goal;
        if (confirm === 'retire') {
            const note = ts.retireNote || 'moves to your finished list with its streak';
            return `<div class="goal-confirm" role="group" aria-label="Confirm retire"><p>Retire this goal? It ${esc(note)}.</p>`
                + `<div class="modal-buttons"><button type="button" class="secondary-button" data-action="cancel-confirm" data-key="cancel">Keep it</button>`
                + `<button type="button" class="primary-button" data-action="retire-yes" data-key="retire-yes">Retire</button></div></div>`;
        }
        if (confirm === 'delete') {
            return `<div class="goal-confirm" role="group" aria-label="Confirm delete"><p>Delete this goal? This can't be undone.</p>`
                + `<div class="modal-buttons"><button type="button" class="secondary-button" data-action="cancel-confirm" data-key="cancel">Keep it</button>`
                + `<button type="button" class="danger-button goal-danger" data-action="delete-yes" data-key="delete-yes">Delete</button></div></div>`;
        }
        const retire = g.kind === 'recurring'
            ? `<button type="button" class="secondary-button" data-action="retire" data-key="retire">Retire goal</button>` : '';
        return `<div class="modal-buttons goal-card-buttons">${retire}`
            + `<button type="button" class="secondary-button goal-delete-btn" data-action="delete" data-key="delete">Delete goal</button>`
            + `<button type="button" class="primary-button" data-action="close" data-key="close">Close</button></div>`;
    }

    /** The inside of the card (the .modal-content body) for a view. confirm = null | 'retire' | 'delete'. */
    function html(view, ctx) {
        const g = view.goal;
        const c = ctx || {};
        const chip = GoalsPane.cellChip(view);
        const pace = GoalsPane.paceText(view, c.nowMs || Date.now(), c.weekStartsOn);
        return `<div class="goal-card-top">`
            + `<div class="goal-card-art">${GoalsPane.artHtml('stage', view.stage)}</div>`
            + `<div class="goal-card-head"><h3 class="goal-card-title">${esc(g.name)}${chip && chip.kind === 'example' ? ` <span class="goal-chip goal-chip--example">${esc(chip.text)}</span>` : ''}</h3>`
            + `<p class="goal-card-kind">${esc(GoalsPane.kindLine(g))}</p>`
            + `<p class="goal-card-progress">${GoalsPane.percent(view.progress)}% · stage ${view.stage} of 5</p>`
            + (pace ? `<p class="goal-card-pace goal-pace--${esc(view.pace)}"><i class="goal-pace-dot" aria-hidden="true"></i>${esc(pace)}</p>` : '')
            + (chip && chip.kind !== 'example' ? `<p class="goal-card-recent"><span class="goal-chip goal-chip--${esc(chip.kind)}">${esc(chip.text)}</span></p>` : '')
            + `</div></div>`
            + `<ul class="goal-targets">${view.targets.map(targetHtml).join('')}</ul>`
            + historyHtml(g)
            + footerHtml(view, c.confirm || null);
    }

    // ---- DOM ------------------------------------------------------------------------------------------------------------------

    /**
     * Opens the card for a goal id.
     * d: { getView(goalId) -> view | null, nowMs(), weekStartsOn,
     *      updateTarget(goalId, targetId, patch) -> { changed, completed }, retire(goalId), remove(goalId), afterChange() }
     * Returns the overlay element (null when the goal is not there or a card is already open).
     */
    function open(goalId, d) {
        if (typeof Modal === 'undefined') return null;
        const first = d.getView(goalId);
        if (!first) return null;
        let confirm = null;
        let focusKey = null;
        const wrapper = (inner) => `<div class="modal-overlay goal-card-overlay"><div class="modal-content goal-card-modal" role="dialog" aria-label="Goal">${inner}</div></div>`;
        const overlay = Modal.open(wrapper(html(first, { nowMs: d.nowMs(), weekStartsOn: d.weekStartsOn, confirm })), { dedupeSelector: '.goal-card-overlay' });
        if (!overlay) return null;
        const content = overlay.querySelector('.goal-card-modal');

        function close() { overlay.remove(); }
        function render() {
            const view = d.getView(goalId);
            if (!view) { close(); return; }
            content.innerHTML = html(view, { nowMs: d.nowMs(), weekStartsOn: d.weekStartsOn, confirm });
            if (focusKey) {
                const again = content.querySelector(`[data-key="${focusKey}"]`);
                if (again && again.focus) again.focus();
            }
        }
        function applyPatch(targetId, patch) {
            const result = d.updateTarget(goalId, targetId, patch);
            if (result.completed && result.completed.length) {
                close();
                d.afterChange();
                return;
            }
            if (result.changed) d.afterChange();
            render();
        }
        function currentTarget(targetId) {
            const view = d.getView(goalId);
            if (!view) return null;
            const entry = view.targets.find(t => String(t.target.id) === String(targetId));
            return entry ? entry.target : null;
        }
        overlay.addEventListener('click', (e) => {
            const el = e.target.closest ? e.target.closest('[data-action]') : null;
            if (!el || el.tagName === 'INPUT') return;
            const action = el.dataset.action;
            focusKey = el.dataset.key || null;
            if (action === 'close') { close(); return; }
            if (action === 'num-step') {
                const t = currentTarget(el.dataset.target);
                if (t) applyPatch(t.id, { current: t.current + Number(el.dataset.dir) * directionOf(t) * stepFor(t) });
                return;
            }
            if (action === 'retire') { confirm = 'retire'; focusKey = 'cancel'; render(); return; }
            if (action === 'delete') { confirm = 'delete'; focusKey = 'cancel'; render(); return; }
            if (action === 'cancel-confirm') { confirm = null; focusKey = 'close'; render(); return; }
            if (action === 'retire-yes') { d.retire(goalId); close(); d.afterChange(); return; }
            if (action === 'delete-yes') { d.remove(goalId); close(); d.afterChange(); return; }
        });
        overlay.addEventListener('change', (e) => {
            const el = e.target;
            if (!el || !el.dataset) return;
            focusKey = el.dataset.key || null;
            if (el.dataset.action === 'num-set') {
                const value = Number(el.value);
                if (el.value === '' || !isFinite(value)) { render(); return; }
                applyPatch(el.dataset.target, { current: value });
            } else if (el.dataset.action === 'bool') {
                applyPatch(el.dataset.target, { done: !!el.checked });
            }
        });
        const closeBtn = content.querySelector('[data-action="close"]');
        if (closeBtn && closeBtn.focus) closeBtn.focus();
        return overlay;
    }

    return { stepFor, directionOf, targetText, targetNote, streakLine, targetHtml, historyHtml, footerHtml, html, open };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoalCard;
}

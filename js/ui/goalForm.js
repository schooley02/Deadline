/**
 * GoalForm -- the Add / Edit goal window (Goals Build B2, 2026-11-05; docs/GOALS_PLAN.md "Screens" and "Build B2 as built").
 *
 * One form for both. Add: a name, a kind (Repeats every day / week / month, or One-time with a deadline or "No deadline") and one to four
 * targets (A number, Yes or no, Tasks and habits, Your days). Edit: the name, the deadline and the targets; the kind and period are shown
 * but fixed (a streak belongs to its period, so a different period is a new goal). A repeating goal links Build Habits and routines only
 * (a one-off task would count once, which a period cannot use); a one-time goal may also link open one-off tasks.
 *
 * Baseline rule (CLAUDE.md): engine words only; theme words come from Theme.strings.goals at call time. No native dialogs: a failed Save
 * writes one inline line (Forms.showFormError when it is loaded, else the same markup).
 *
 * PURE / DOM split: blankDraft, newTargetDraft, draftFromGoal, validate, toSubmission, html are pure and unit-tested
 * (test/goalForm.test.js); open is DOM. The draft keeps number inputs as the player's text; toSubmission parses them.
 */
const GoalForm = (() => {
    const MAX_TARGETS = 4;
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ESC[c]);
    }
    const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
    const TYPE_WORDS = { number: 'A number', bool: 'Yes or no', linked: 'Tasks and habits', aggregate: 'Your days' };
    const PERIOD_WORDS = { day: 'Every day', week: 'Every week', month: 'Every month' };
    const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
    const parseNum = (text) => {
        const t = String(text == null ? '' : text).trim();
        if (t === '') return NaN;
        const n = Number(t);
        return Number.isFinite(n) ? n : NaN;
    };
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    const plural = (n, one, many) => (n === 1 ? one : many);
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);

    // ---- pure: drafts ---------------------------------------------------------------------------------------------------------

    function newTargetDraft(type, ctx) {
        const base = { id: null, type, label: '' };
        if (type === 'number') return Object.assign(base, { start: '0', end: '10', unit: '' });
        if (type === 'linked') return Object.assign(base, { count: '1', habitDefIds: [], routineIds: [], itemIds: [] });
        if (type === 'aggregate') {
            const metrics = (ctx && ctx.metrics) || [];
            return Object.assign(base, { metric: metrics[0] ? metrics[0].id : '', op: 'sum', compare: 'gte', threshold: '1', count: '1' });
        }
        return base; // bool
    }

    function blankDraft(ctx) {
        return {
            mode: 'add', goalId: null, name: '', kind: 'recurring', period: 'week',
            noDeadline: true, deadline: '', originalDeadline: null,
            targets: [newTargetDraft('number', ctx)],
        };
    }

    /** The Edit form's starting point: the goal's fields as text, its target ids kept, its linked open tasks (linkedIds: { targetId: [ids] }). */
    function draftFromGoal(goal, linkedIds) {
        const li = linkedIds || {};
        return {
            mode: 'edit', goalId: goal.id, name: goal.name, kind: goal.kind, period: goal.period || null,
            noDeadline: !goal.deadline, deadline: goal.deadline || '', originalDeadline: goal.deadline || null,
            targets: goal.targets.map((t) => {
                const base = { id: t.id, type: t.type, label: t.label || '' };
                if (t.type === 'number') return Object.assign(base, { start: String(t.start), end: String(t.end), unit: t.unit || '' });
                if (t.type === 'linked') {
                    return Object.assign(base, {
                        count: String(t.count || 1),
                        habitDefIds: (t.habitDefIds || []).slice(),
                        routineIds: (t.routineIds || []).slice(),
                        itemIds: (li[t.id] || []).slice(),
                    });
                }
                if (t.type === 'aggregate') {
                    return Object.assign(base, {
                        metric: t.metric || '', op: t.op === 'days' ? 'days' : 'sum', compare: t.compare === 'lte' ? 'lte' : 'gte',
                        threshold: String(t.threshold), count: String(t.count || 1),
                    });
                }
                return base;
            }),
        };
    }

    // ---- pure: validation and submission --------------------------------------------------------------------------------------

    function validDayKey(text) {
        const m = DAY_KEY.exec(String(text || ''));
        if (!m) return false;
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
    }

    function metricById(ctx, id) {
        return ((ctx && ctx.metrics) || []).find(m => m.id === id) || null;
    }

    /** The first problem with a draft as { message, field } (field = an element id, or null), or null when it can be saved. */
    function validate(draft, ctx) {
        if (!String(draft.name || '').trim()) return { message: 'Give the goal a name.', field: 'gfName' };
        if (draft.kind === 'milestone' && !draft.noDeadline) {
            if (!validDayKey(draft.deadline)) return { message: 'Pick a deadline date, or tick No deadline.', field: 'gfDeadline' };
            const keptAsIs = draft.mode === 'edit' && draft.deadline === draft.originalDeadline;
            if (!keptAsIs && ctx && ctx.todayKey && draft.deadline < ctx.todayKey) {
                return { message: 'That deadline is already past. Pick today or later.', field: 'gfDeadline' };
            }
        }
        if (!draft.targets || draft.targets.length === 0) return { message: 'Add at least one target.', field: null };
        for (let i = 0; i < draft.targets.length; i++) {
            const t = draft.targets[i];
            const f = (suffix) => `gfT${i}${suffix}`;
            if (t.type === 'number') {
                const start = parseNum(t.start);
                const end = parseNum(t.end);
                if (!isNum(start)) return { message: 'Enter a start number.', field: f('Start') };
                if (!isNum(end)) return { message: 'Enter an end number.', field: f('End') };
                if (start === end) return { message: "The start and end can't be the same number.", field: f('End') };
            } else if (t.type === 'linked') {
                const habits = (t.habitDefIds || []).length + (t.routineIds || []).length;
                const tasks = draft.kind === 'milestone' ? (t.itemIds || []).length : 0;
                if (habits + tasks === 0) {
                    return {
                        message: draft.kind === 'milestone' ? 'Pick at least one task, Build Habit or routine.' : 'Pick at least one Build Habit or routine.',
                        field: null,
                    };
                }
                const count = parseNum(t.count);
                if (!isNum(count) || count < 1 || Math.floor(count) !== count) return { message: 'How many times must be a whole number, 1 or more.', field: f('Count') };
            } else if (t.type === 'aggregate') {
                if (!metricById(ctx, t.metric)) return { message: 'Pick what to count.', field: f('Metric') };
                const threshold = parseNum(t.threshold);
                if (!isNum(threshold) || threshold < 0) return { message: 'Enter an amount of 0 or more.', field: f('Threshold') };
                if (t.op === 'days') {
                    const count = parseNum(t.count);
                    if (!isNum(count) || count < 1 || Math.floor(count) !== count) return { message: 'How many days must be a whole number, 1 or more.', field: f('Count') };
                }
            }
        }
        return null;
    }

    /** What a target says about itself when the player left its label blank. */
    function autoLabel(t, ctx, kind) {
        if (t.type === 'number') return `${cap(String(t.unit || '').trim() || 'Progress')}: ${t.start} to ${t.end}`;
        if (t.type === 'bool') return 'Done';
        if (t.type === 'linked') {
            const parts = [];
            const tasks = kind === 'milestone' ? (t.itemIds || []).length : 0;
            if (tasks) parts.push(`${tasks} ${plural(tasks, 'task', 'tasks')}`);
            const h = (t.habitDefIds || []).length;
            if (h) parts.push(`${h} Build ${plural(h, 'Habit', 'Habits')}`);
            const r = (t.routineIds || []).length;
            if (r) parts.push(`${r} ${plural(r, 'routine', 'routines')}`);
            return parts.join(', ') || 'Linked';
        }
        const m = metricById(ctx, t.metric);
        const name = m ? m.label : 'Your days';
        const how = t.compare === 'lte' ? 'at most' : 'at least';
        if (t.op === 'days') return `${name}: ${how} ${t.threshold} on ${t.count} ${plural(Number(t.count), 'day', 'days')}`;
        return `${name}: ${how} ${t.threshold}${m && m.unit ? ' ' + m.unit : ''}`;
    }

    /**
     * The draft as the two things State takes: fields (name, kind, period, deadline, targets with their ids on Edit) and links
     * ([{ targetIndex, itemIds }], one-time goals only, one per linked target -- an empty list unlinks).
     */
    function toSubmission(draft, ctx) {
        const links = [];
        const targets = draft.targets.map((t, index) => {
            const label = String(t.label || '').trim() || autoLabel(t, ctx, draft.kind);
            const out = { type: t.type, label };
            if (t.id != null) out.id = t.id;
            if (t.type === 'number') Object.assign(out, { start: parseNum(t.start), end: parseNum(t.end), unit: String(t.unit || '').trim() });
            if (t.type === 'linked') {
                Object.assign(out, { count: parseNum(t.count), habitDefIds: (t.habitDefIds || []).slice(), routineIds: (t.routineIds || []).slice() });
                if (draft.kind === 'milestone') links.push({ targetIndex: index, itemIds: (t.itemIds || []).slice() });
            }
            if (t.type === 'aggregate') {
                Object.assign(out, {
                    metric: t.metric, op: t.op === 'days' ? 'days' : 'sum', compare: t.compare === 'lte' ? 'lte' : 'gte',
                    threshold: parseNum(t.threshold), count: t.op === 'days' ? parseNum(t.count) : 1,
                });
            }
            return out;
        });
        return {
            fields: {
                name: String(draft.name).trim(),
                kind: draft.kind,
                period: draft.kind === 'recurring' ? draft.period : null,
                deadline: draft.kind === 'milestone' && !draft.noDeadline ? draft.deadline : null,
                targets,
            },
            links,
        };
    }

    // ---- pure: markup ---------------------------------------------------------------------------------------------------------

    const opt = (value, text, selected) => `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(text)}</option>`;
    const row = (label, forId, control) => `<div class="form-row"><label for="${esc(forId)}">${esc(label)}</label>${control}</div>`;

    function pickList(kind, items, chosen, emptyText) {
        if (!items.length) return `<p class="goal-form-hint">${esc(emptyText)}</p>`;
        return `<ul class="goal-form-picks">${items.map((it) => {
            const on = chosen.some(id => sameId(id, it.id));
            const note = kind === 'task' && it.goalId != null ? ' <span class="goal-form-pick-note">in another goal</span>' : '';
            return `<li><label class="goal-form-pick"><input type="checkbox" data-pick="${kind}" value="${esc(it.id)}"${on ? ' checked' : ''}> <span>${esc(it.name)}${note}</span></label></li>`;
        }).join('')}</ul>`;
    }

    function targetHtml(t, i, draft, ctx, canRemove) {
        const p = (suffix) => `gfT${i}${suffix}`;
        let body = '';
        if (t.type === 'number') {
            body = row('Label (optional)', p('Label'), `<input type="text" id="${p('Label')}" maxlength="80" value="${esc(t.label)}" placeholder="What are you counting?">`)
                + `<div class="goal-form-pair">`
                + row('Start', p('Start'), `<input type="number" inputmode="decimal" id="${p('Start')}" value="${esc(t.start)}">`)
                + row('End', p('End'), `<input type="number" inputmode="decimal" id="${p('End')}" value="${esc(t.end)}">`)
                + row('Unit (optional)', p('Unit'), `<input type="text" id="${p('Unit')}" maxlength="24" value="${esc(t.unit)}" placeholder="pages, laps, lb...">`)
                + `</div>`
                + `<p class="goal-form-hint">An end below the start counts down.</p>`;
        } else if (t.type === 'bool') {
            body = row('Label', p('Label'), `<input type="text" id="${p('Label')}" maxlength="80" value="${esc(t.label)}" placeholder="What is it? (optional)">`);
        } else if (t.type === 'linked') {
            const o = (ctx && ctx.options) || { tasks: [], habits: [], routines: [] };
            const oneTime = draft.kind === 'milestone';
            body = row('Label (optional)', p('Label'), `<input type="text" id="${p('Label')}" maxlength="80" value="${esc(t.label)}" placeholder="Finish the launch list">`)
                + (oneTime
                    ? `<div class="goal-form-group"><p class="goal-form-group-title">Open tasks</p>${pickList('task', o.tasks || [], t.itemIds || [], 'No open one-off tasks to link right now.')}</div>`
                    : `<p class="goal-form-hint">A repeating goal counts Build Habits and routines. A one-off task would count only once.</p>`)
                + `<div class="goal-form-group"><p class="goal-form-group-title">Build Habits</p>${pickList('habit', o.habits || [], t.habitDefIds || [], 'No Build Habits yet.')}</div>`
                + `<div class="goal-form-group"><p class="goal-form-group-title">Routines</p>${pickList('routine', o.routines || [], t.routineIds || [], 'No routines yet.')}</div>`
                + row(oneTime ? 'Times to do the habits and routines' : 'Times each period', p('Count'), `<input type="number" inputmode="numeric" min="1" step="1" id="${p('Count')}" value="${esc(t.count)}">`);
        } else {
            const metrics = (ctx && ctx.metrics) || [];
            body = row('Count', p('Metric'), `<select id="${p('Metric')}">${metrics.map(m => opt(m.id, m.label, m.id === t.metric)).join('')}</select>`)
                + row('Add it up or count days', p('Op'), `<select id="${p('Op')}" data-rerender="1">${opt('sum', 'Total over the whole goal period', t.op !== 'days')}${opt('days', 'Number of days that reach the amount', t.op === 'days')}</select>`)
                + `<div class="goal-form-pair">`
                + row('At least or at most', p('Compare'), `<select id="${p('Compare')}">${opt('gte', 'At least', t.compare !== 'lte')}${opt('lte', 'At most', t.compare === 'lte')}</select>`)
                + row('Amount', p('Threshold'), `<input type="number" inputmode="decimal" min="0" id="${p('Threshold')}" value="${esc(t.threshold)}">`)
                + (t.op === 'days' ? row('On how many days', p('Count'), `<input type="number" inputmode="numeric" min="1" step="1" id="${p('Count')}" value="${esc(t.count)}">`) : '')
                + `</div>`
                + row('Label (optional)', p('Label'), `<input type="text" id="${p('Label')}" maxlength="80" value="${esc(t.label)}">`);
        }
        const remove = canRemove ? `<button type="button" class="secondary-button goal-form-remove" data-action="remove-target" data-index="${i}">Remove</button>` : '';
        return `<fieldset class="goal-form-target goal-form-target--${esc(t.type)}" data-index="${i}">`
            + `<legend>${esc(TYPE_WORDS[t.type] || 'Target')}</legend>${body}${remove}</fieldset>`;
    }

    /** The form's inside (the .modal-content body). `error` = a line to show on open, normally null. */
    function html(draft, ctx) {
        const edit = draft.mode === 'edit';
        let kindRows;
        if (edit) {
            const kindText = draft.kind === 'recurring' ? `Repeats: ${PERIOD_WORDS[draft.period] || 'every period'}` : 'One-time goal';
            kindRows = `<p class="goal-form-kind">${esc(kindText)}</p><p class="goal-form-hint">The kind and period can't be changed. To switch, make a new goal.</p>`;
        } else {
            kindRows = row('Kind', 'gfKind', `<select id="gfKind" data-rerender="1">${opt('recurring', 'Repeats (every day, week or month)', draft.kind === 'recurring')}${opt('milestone', 'One-time (finish it once)', draft.kind === 'milestone')}</select>`);
        }
        let when = '';
        if (draft.kind === 'recurring') {
            when = edit ? '' : row('Repeats', 'gfPeriod', `<select id="gfPeriod">${Object.keys(PERIOD_WORDS).map(k => opt(k, PERIOD_WORDS[k], draft.period === k)).join('')}</select>`);
        } else {
            when = `<div class="form-row goal-form-deadline"><label class="goal-form-check"><input type="checkbox" id="gfNoDeadline" data-rerender="1"${draft.noDeadline ? ' checked' : ''}> <span>No deadline</span></label></div>`
                + (draft.noDeadline ? '' : row('Deadline', 'gfDeadline', `<input type="date" id="gfDeadline" value="${esc(draft.deadline)}">`));
        }
        const canRemove = draft.targets.length > 1;
        const adds = draft.targets.length >= MAX_TARGETS ? ''
            : `<div class="goal-form-adds" role="group" aria-label="Add a target">${['number', 'bool', 'linked', 'aggregate'].map(type => `<button type="button" class="secondary-button goal-form-add" data-action="add-target" data-type="${type}">+ ${esc(TYPE_WORDS[type])}</button>`).join('')}</div>`;
        return `<h3>${edit ? 'Edit goal' : 'New goal'}</h3>`
            + row('Name', 'gfName', `<input type="text" id="gfName" maxlength="80" value="${esc(draft.name)}" placeholder="What do you want to reach?">`)
            + kindRows + when
            + `<div class="goal-form-targets"><p class="goal-form-section">Targets</p>`
            + draft.targets.map((t, i) => targetHtml(t, i, draft, ctx, canRemove)).join('')
            + adds + `</div>`
            + `<div class="modal-buttons"><button type="button" class="secondary-button" data-action="cancel">Cancel</button>`
            + `<button type="button" class="primary-button" data-action="save">Save goal</button></div>`;
    }

    // ---- DOM ------------------------------------------------------------------------------------------------------------------

    function showError(root, message, fieldId) {
        const field = fieldId ? document.getElementById(fieldId) : null;
        if (typeof Forms !== 'undefined' && Forms && typeof Forms.showFormError === 'function') {
            Forms.showFormError(message, field);
            return;
        }
        root.querySelectorAll('.form-error[data-inline-error]').forEach(el => el.remove());
        const el = document.createElement('div');
        el.className = 'form-error';
        el.setAttribute('data-inline-error', '');
        el.setAttribute('role', 'alert');
        el.textContent = message;
        const buttons = root.querySelector('.modal-buttons');
        if (buttons && buttons.parentNode) buttons.parentNode.insertBefore(el, buttons); else root.appendChild(el);
        if (field) { field.setAttribute('aria-invalid', 'true'); if (field.focus) field.focus(); }
    }

    /**
     * Opens the form. d: { goal?, linkedIds?, getContext() -> { metrics, options, todayKey },
     *   save(fields, links) -> { ok, goal? , reason? }, onDone(goal), onCancel() }. `goal` present = Edit.
     * Returns the overlay (null when a form is already open).
     */
    function open(d) {
        if (typeof Modal === 'undefined') return null;
        const ctx = d.getContext();
        const draft = d.goal ? draftFromGoal(d.goal, d.linkedIds || {}) : blankDraft(ctx);
        const wrapper = (inner) => `<div class="modal-overlay goal-form-overlay"><div class="modal-content goal-form-modal" role="dialog" aria-label="${draft.mode === 'edit' ? 'Edit goal' : 'New goal'}">${inner}</div></div>`;
        const overlay = Modal.open(wrapper(html(draft, ctx)), { dedupeSelector: '.goal-form-overlay' });
        if (!overlay) return null;
        const content = overlay.querySelector('.goal-form-modal');
        let focusId = 'gfName';

        const val = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
        function pickedIds(box, kind, options) {
            const out = [];
            box.querySelectorAll(`input[data-pick="${kind}"]`).forEach((el) => {
                if (!el.checked) return;
                const match = options.find(o => String(o.id) === el.value);
                if (match) out.push(match.id);
            });
            return out;
        }
        // Copies what the player typed back into the draft, so a redraw (a kind change, a new target) never loses it.
        function readDom() {
            const name = val('gfName');
            if (name !== null) draft.name = name;
            if (draft.mode === 'add') {
                const kind = val('gfKind');
                if (kind && kind !== draft.kind) {
                    draft.kind = kind;
                    draft.period = kind === 'recurring' ? (draft.period || 'week') : null;
                }
            }
            const period = val('gfPeriod');
            if (period && draft.kind === 'recurring' && draft.mode === 'add') draft.period = period;
            const nd = document.getElementById('gfNoDeadline');
            if (nd) draft.noDeadline = !!nd.checked;
            const dl = val('gfDeadline');
            if (dl !== null) draft.deadline = dl;
            const o = ctx.options || { tasks: [], habits: [], routines: [] };
            draft.targets.forEach((t, i) => {
                const g = (suffix) => val(`gfT${i}${suffix}`);
                const box = content.querySelector(`.goal-form-target[data-index="${i}"]`);
                if (!box) return;
                const label = g('Label');
                if (label !== null) t.label = label;
                if (t.type === 'number') {
                    if (g('Start') !== null) t.start = g('Start');
                    if (g('End') !== null) t.end = g('End');
                    if (g('Unit') !== null) t.unit = g('Unit');
                } else if (t.type === 'linked') {
                    t.itemIds = pickedIds(box, 'task', o.tasks || []);
                    t.habitDefIds = pickedIds(box, 'habit', o.habits || []);
                    t.routineIds = pickedIds(box, 'routine', o.routines || []);
                    if (g('Count') !== null) t.count = g('Count');
                } else if (t.type === 'aggregate') {
                    if (g('Metric') !== null) t.metric = g('Metric');
                    if (g('Op') !== null) t.op = g('Op');
                    if (g('Compare') !== null) t.compare = g('Compare');
                    if (g('Threshold') !== null) t.threshold = g('Threshold');
                    if (g('Count') !== null) t.count = g('Count');
                }
            });
        }
        function render() {
            content.innerHTML = html(draft, ctx);
            const again = focusId ? document.getElementById(focusId) : null;
            if (again && again.focus) again.focus();
        }
        function close() { overlay.remove(); }

        function save() {
            readDom();
            const problem = validate(draft, ctx);
            if (problem) { showError(overlay, problem.message, problem.field); return; }
            const s = toSubmission(draft, ctx);
            const result = draft.mode === 'edit' ? d.save(s.fields, s.links) : d.save(s.fields, s.links);
            if (!result || !result.ok) {
                const full = result && result.reason === 'full';
                showError(overlay, full ? 'All your goal slots are in use. Finish or delete a goal first.' : "That goal couldn't be saved. Check the fields and try again.", null);
                return;
            }
            close();
            if (d.onDone) d.onDone(result.goal);
        }

        overlay.addEventListener('click', (e) => {
            const el = e.target.closest ? e.target.closest('[data-action]') : null;
            if (!el || el.tagName === 'INPUT') return;
            const action = el.dataset.action;
            if (action === 'cancel') { close(); if (d.onCancel) d.onCancel(); return; }
            if (action === 'save') { save(); return; }
            if (action === 'add-target') {
                readDom();
                if (draft.targets.length < MAX_TARGETS) draft.targets.push(newTargetDraft(el.dataset.type, ctx));
                focusId = `gfT${draft.targets.length - 1}${el.dataset.type === 'number' ? 'Start' : el.dataset.type === 'aggregate' ? 'Metric' : 'Label'}`;
                render();
                return;
            }
            if (action === 'remove-target') {
                readDom();
                if (draft.targets.length > 1) draft.targets.splice(Number(el.dataset.index), 1);
                focusId = null;
                render();
            }
        });
        overlay.addEventListener('change', (e) => {
            const el = e.target;
            if (el && el.dataset && el.dataset.rerender) {
                readDom();
                focusId = el.id || null;
                render();
            }
        });
        const nameEl = document.getElementById('gfName');
        if (nameEl && nameEl.focus) nameEl.focus();
        return overlay;
    }

    return {
        MAX_TARGETS, TYPE_WORDS, PERIOD_WORDS,
        blankDraft, newTargetDraft, draftFromGoal, validate, autoLabel, toSubmission, html, open,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoalForm;
}

/**
 * PrioritySlotsView -- everything the player SEES of the three daily priority slots (Build B, 2026-11-04;
 * docs/PRIORITY_SLOTS_PLAN.md, DECISIONS 2026-11-04 (priority slots)).
 *
 * Three jobs, one place so the wording cannot drift between them:
 *   1. WORDS (pure): "Priority: 2 of 3 left today", the full-day text, the "doesn't carry over" line. Player-facing text says "Priority", never "High Priority".
 *   2. PIPS (pure markup + one DOM write): the at-a-glance row in the list header. hollow = free, filled = used (open),
 *      check = done. `PrioritySlotsView.render(el, slots, opts)` fills `#prioritySlots`. On TODAY only it also carries the
 *      momentum mark (hollow ring = not secured yet, check = secured, dash = Sick Day); a tap opens the Barricade window.
 *      The mark moved here from the week strip (2026-11-13): it describes today only, so it sits beside the priorities
 *      that can secure it, never on a day cell that reads as a per-day marker.
 *   3. THE FORM ROW (DOM): `bindRow` drives a "Priority" checkbox in Add Task / Edit Task / the sub-task form -- the live
 *      "N of 3 left" label, disabled at 0, re-read when the due date changes, and the "Remove priority?" confirm.
 *
 * The numbers come from Items.prioritySlotsFor (deps.prioritySlotsFor(dueDateTime) -> { key, marks, done, left });
 * this file never reads State or CONFIG, so every function takes `perDay` as an argument.
 */
const PrioritySlotsView = (() => {
    const DEFAULT_PER_DAY = 3;

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function per(perDay) {
        const n = Number(perDay);
        return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_PER_DAY;
    }

    // ---- words (pure) ---------------------------------------------------------------------------------------------

    /** "today" / "tomorrow" / "yesterday" / "on Mon, Nov 9" for a 'YYYY-MM-DD' key relative to today's key. */
    function dayWord(key, todayKey) {
        if (!key || !todayKey) return 'that day';
        if (key === todayKey) return 'today';
        const a = new Date(todayKey + 'T12:00:00');
        const b = new Date(key + 'T12:00:00');
        if (isNaN(a.getTime()) || isNaN(b.getTime())) return 'that day';
        const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
        if (diff === 1) return 'tomorrow';
        if (diff === -1) return 'yesterday';
        return 'on ' + b.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    function leftText(left, perDay) {
        return Math.max(0, Math.floor(Number(left) || 0)) + ' of ' + per(perDay) + ' left';
    }

    /** The checkbox label: "Priority: 2 of 3 left today". */
    function labelText(left, perDay, word) {
        return 'Priority: ' + leftText(left, perDay) + ' ' + (word || 'today');
    }

    /** Shown under the box when nothing is left on that day. */
    function fullText(perDay, word) {
        return 'No priority slots left ' + (word || 'today') + '.';
    }

    const CARRY_TEXT = "Priority doesn't carry over. Mark it again on the new day.";
    const COVERED_TEXT = "The parent's priority covers this sub-task.";
    const KEEP_TEXT = 'The slot stays used.';

    // ---- pips (pure) ----------------------------------------------------------------------------------------------

    /**
     * One state per slot of the day: 'done' first, then 'used' (marked, still open -- or thrown away by an unmark), then
     * 'free'. `slots` = { marks, done, left }. Always `perDay` entries (the day's slots are a hard cap; no refill).
     */
    function pipStates(slots, perDay) {
        const n = per(perDay);
        const s = slots || {};
        const done = Math.max(0, Math.floor(Number(s.done) || 0));
        const left = Math.max(0, Math.floor(Number(s.left) || 0));
        const doneInDay = Math.min(done, n);
        const free = Math.min(left, n - doneInDay);
        const used = Math.max(0, n - doneInDay - free);
        const out = [];
        for (let i = 0; i < doneInDay; i++) out.push('done');
        for (let i = 0; i < used; i++) out.push('used');
        for (let i = 0; i < free; i++) out.push('free');
        return out;
    }

    function pipsTitle(slots, perDay, word) {
        const left = slots ? slots.left : per(perDay);
        return 'Priorities ' + word + ': ' + leftText(left, perDay) + '.';
    }

    /** The pips markup (inside `#prioritySlots`). `opts.compact` drops the text (Yesterday, read-only). */
    function pipsHtml(slots, perDay, opts) {
        const o = opts || {};
        const word = o.word || 'today';
        const states = pipStates(slots, perDay);
        const label = o.readOnly
            ? 'Priorities ' + word + ': ' + Math.min(states.filter((s) => s !== 'free').length, per(perDay)) + ' of ' + per(perDay) + ' used.'
            : pipsTitle(slots, perDay, word);
        const pips = states.map((st) => '<span class="priority-pip priority-pip-' + st + '" aria-hidden="true"></span>').join('');
        const text = o.readOnly ? '' : '<span class="priority-slots-text">' + esc(leftText(slots ? slots.left : per(perDay), perDay)) + '</span>';
        return '<button type="button" class="priority-slots-btn' + (o.readOnly ? ' priority-slots-readonly' : '') + '" aria-label="' + esc(label) + '">' +
            '<span class="priority-slots-title">Priority</span>' +
            '<span class="priority-pips" aria-hidden="true">' + pips + '</span>' + text + '</button>';
    }

    /**
     * The momentum mark for TODAY (Momentum Build B, moved off the week strip 2026-11-13). `info` = Momentum.momentum()
     * ({ today: 'secured' | 'excused' | else not yet }). '' when there is no info. A sibling of the pips button, not a
     * child (no button inside a button), so its tap never opens the priority explainer.
     */
    function momentumMarkHtml(info) {
        if (!info) return '';
        const t = info.today === 'secured' || info.today === 'excused' ? info.today : 'open';
        const label = t === 'secured' ? "Today's momentum is secured. Open the Barricade."
            : t === 'excused' ? 'Sick Day. Open the Barricade.'
            : "Today's momentum is not secured yet. Open the Barricade.";
        const glyph = t === 'secured' ? '&#10003;' : (t === 'excused' ? '&ndash;' : '');
        return '<span class="priority-momentum priority-momentum--' + t + '" role="button" tabindex="0" aria-label="' + esc(label) + '">' + glyph + '</span>';
    }

    /** The one-line explainer the pips open on a tap (phone shows only the pips). */
    function explainerText(slots, perDay, word) {
        const n = per(perDay);
        const left = slots ? slots.left : n;
        return 'You get ' + n + ' priority slots a day. A priority task pays double. Marking one uses a slot for good, even if ' +
            'you unmark it. ' + leftText(left, n) + ' ' + (word || 'today') + '. ' +
            "Finish 1 priority or 1 routine to secure today's momentum.";
    }

    /**
     * Fill the list-header element. `slots` = { key, marks, done, left } for the viewed day; `opts` = { perDay, word,
     * readOnly, onTap, momentum, onMomentumTap }. Hides the element when `slots` is null (nothing to show). `momentum`
     * is passed for TODAY only; any other day gets no mark.
     */
    function render(el, slots, opts) {
        if (!el) return;
        const o = opts || {};
        if (!slots) {
            el.innerHTML = '';
            el.classList.add('hidden');
            return;
        }
        el.classList.remove('hidden');
        el.innerHTML = pipsHtml(slots, o.perDay, o) + momentumMarkHtml(o.momentum);
        const btn = el.querySelector('.priority-slots-btn');
        if (btn && typeof o.onTap === 'function') btn.onclick = () => o.onTap(slots);
        const mark = el.querySelector('.priority-momentum');
        if (mark && typeof o.onMomentumTap === 'function') {
            mark.onclick = (e) => { e.stopPropagation(); o.onMomentumTap(); };
            mark.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.onMomentumTap(); }
            };
        }
    }

    // ---- the form row (DOM) ---------------------------------------------------------------------------------------

    /**
     * The form row markup shared by Add Task / Edit Task / the sub-task form. Ids: `<id>` (checkbox), `<id>Label` (the
     * text span bindRow rewrites), `<id>Hint` (the line under the row). The (i) button opens How Deadline works on
     * the `priorities` topic when HowItWorks is loaded.
     */
    function rowHtml(id, opts) {
        const o = opts || {};
        const info = typeof HowItWorks !== 'undefined' ? HowItWorks.buttonHtml('priorities') : '';
        return '<div class="form-row priority-row">' +
            '<input type="checkbox" id="' + esc(id) + '"' + (o.checked ? ' checked' : '') + '>' +
            '<label for="' + esc(id) + '"><span id="' + esc(id) + 'Label">Priority</span></label>' + info +
            '</div><p class="priority-hint" id="' + esc(id) + 'Hint" aria-live="polite"></p>';
    }

    /** "2026-11-09" from a date input value -> a local noon Date string prioritySlotsFor can read. */
    function dueFromDateValue(dateValue) {
        return dateValue ? dateValue + 'T12:00:00' : null;
    }

    /**
     * Drive a Priority checkbox row. opts:
     *   checkbox, label (the <label> text span or element), hint (a <p>/<div> under the row), dateInput
     *   deps: { prioritySlotsFor(due) -> {key,left,...}, perDay?, todayKey? }
     *   originalKey / originalChecked: Edit Task -- the task's current due day and whether it is priority NOW. Moving to
     *     another day drops it (priority doesn't carry over), so on a different day the box starts unticked and costs a slot.
     *   confirm: (message, options) -> Promise<boolean>  (Dialog.confirm)
     *   covered: true -> a sub-task under a priority parent: the box is hidden and shows COVERED_TEXT instead.
     * Returns { refresh(), wantsPriority(), movedDay() }.
     */
    function bindRow(opts) {
        const o = opts || {};
        const cb = o.checkbox;
        const deps = o.deps || {};
        const perDay = per(deps.perDay);
        let asked = false; // the unmark confirm is up

        function currentSlots() {
            const due = o.dateInput ? dueFromDateValue(o.dateInput.value) : null;
            return typeof deps.prioritySlotsFor === 'function' && due ? deps.prioritySlotsFor(due) : null;
        }
        function movedDay(slots) {
            const s = slots || currentSlots();
            return !!(o.originalKey && s && s.key && s.key !== o.originalKey);
        }
        function setText(el, text) { if (el) el.textContent = text; }

        function refresh() {
            if (!cb) return;
            const slots = currentSlots();
            const row = cb.closest('.priority-row');
            if (o.covered) {
                cb.checked = true;
                cb.disabled = true;
                if (row) row.classList.add('priority-covered');
                setText(o.label, 'Priority');
                setText(o.hint, COVERED_TEXT);
                return;
            }
            if (!slots) { setText(o.label, 'Priority'); return; }
            const word = dayWord(slots.key, deps.todayKey);
            const moved = movedDay(slots);
            // Edit Task: back on the original day the priority is still there and costs nothing; on another day it is gone.
            if (o.originalChecked && o.originalKey && cb.dataset.dayMemo !== slots.key) {
                cb.checked = !moved;
                cb.dataset.dayMemo = slots.key;
            }
            const free = o.originalChecked && !moved; // the task already owns a slot of this day
            const full = slots.left <= 0 && !free;
            if (full && !cb.checked) cb.disabled = true; else cb.disabled = false;
            if (full && cb.checked && !free) cb.checked = false;
            setText(o.label, labelText(slots.left, perDay, word));
            let hint = '';
            if (o.originalChecked && moved) hint = full ? CARRY_TEXT + ' ' + fullText(perDay, word) : CARRY_TEXT;
            else if (full) hint = fullText(perDay, word);
            setText(o.hint, hint);
        }

        if (cb && !o.covered) {
            cb.addEventListener('change', async () => {
                const slots = currentSlots();
                const owns = o.originalChecked && !movedDay(slots);
                // Unticking a priority the task already holds spends nothing back: ask first.
                if (owns && !cb.checked && !asked && typeof o.confirm === 'function') {
                    cb.checked = true;
                    asked = true;
                    let ok = false;
                    try {
                        ok = await o.confirm(KEEP_TEXT,
                            { title: 'Remove priority?', confirmLabel: 'Remove', cancelLabel: 'Keep it' });
                    } catch (e) { ok = false; }
                    asked = false;
                    cb.checked = !ok;
                }
                refresh();
            });
        }
        if (o.dateInput) o.dateInput.addEventListener('change', refresh);
        refresh();

        return {
            refresh,
            wantsPriority: () => !!(cb && cb.checked),
            movedDay: () => movedDay(),
        };
    }

    return {
        dayWord, leftText, labelText, fullText, pipStates, pipsHtml, momentumMarkHtml, explainerText, render,
        bindRow, rowHtml, dueFromDateValue, CARRY_TEXT, COVERED_TEXT, KEEP_TEXT, esc,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PrioritySlotsView;
}

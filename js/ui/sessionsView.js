/**
 * Sessions list (Timer sessions Build B, 2026-11-04; docs/TIMER_SESSIONS_PLAN.md).
 *
 * One list of an item's recorded timer sessions, drawn under the Time Logged field on the task card, the Edit Task form and
 * the completed Build / Break Habit editor. Each session shows its day, start and stop; Edit opens the row in place (Date,
 * Start, Stop, "Stop is the next day"), with a live line saying what saving would cost; + Add session adds one by hand.
 * Time with no start / stop (old time, a typed total) is ONE read-only row: it changes through the Time Logged total.
 *
 * `html` / `innerHtml` are pure markup builders; `wire` attaches the behaviour. All maths lives in js/timerSessions.js and the
 * change itself goes through `deps.changeSession(itemId, change)` (script.js -> Items.changeSession), so this file never
 * touches an item. Buttons here re-draw their own container, so every click is stopped at the container (Modal's outside-click
 * dismiss would otherwise see a detached target and close the window).
 */
const SessionsView = (() => {
    const MIN = 60000;

    function esc(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function pad(n) { return String(n).padStart(2, '0'); }
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function fmtTime(ms) {
        const d = new Date(ms);
        const h = d.getHours();
        return `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
    }
    function fmtDay(ms) {
        const d = new Date(ms);
        return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
    }
    function sameDay(a, b) {
        const x = new Date(a), y = new Date(b);
        return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
    }
    function fmtDuration(ms) {
        const m = Math.max(1, Math.round(ms / MIN));
        if (m < 60) return `${m} min`;
        const h = Math.floor(m / 60), r = m % 60;
        return r ? `${h} hr ${r} min` : `${h} hr`;
    }
    // "Tue Nov 3, 2:05 PM - 3:10 PM" (the stop gets its own day when the session crosses midnight).
    function rangeText(s) {
        const end = sameDay(s.start, s.end) ? fmtTime(s.end) : `${fmtDay(s.end)}, ${fmtTime(s.end)}`;
        return `${fmtDay(s.start)}, ${fmtTime(s.start)} – ${end}`;
    }
    function dateValue(ms) {
        const d = new Date(ms);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    function timeValue(ms) {
        const d = new Date(ms);
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // Plain-words reasons from TimerSessions.validate / Items.changeSession.
    const REASON_TEXT = {
        invalid: 'Enter a date and both times.',
        order: 'Stop must be after start.',
        future: 'A session can’t end in the future.',
        'too-long': 'A session can’t be longer than 24 hours.',
        overlap: 'That overlaps another session.',
        'total-cap': 'Time Logged can’t be more than 24 hours.',
        running: 'Stop the timer first.',
        missing: 'That session is gone.',
        unavailable: 'Couldn’t save the session.',
    };
    function reasonText(reason) { return REASON_TEXT[reason] || 'Couldn’t save the session.'; }

    // What saving would cost, in words ('' when nothing). `hp` = what is actually taken (after the 1 HP floor), `chargeHp` = before it.
    function chargeText(verb, chargeHp, hp) {
        if (!(chargeHp > 0)) return '';
        if (hp > 0) return `${verb} takes back ${hp} HP of halved damage.`;
        return `The church is at its last HP, so ${verb.toLowerCase()} takes nothing back.`;
    }

    // ---- markup --------------------------------------------------------------------------------------------------
    function rowHtml(s, running) {
        return `<li class="sessions-row" data-session="${s.index}">` +
            `<span class="sessions-when">${esc(rangeText(s))}</span>` +
            `<span class="sessions-dur">${esc(fmtDuration(s.end - s.start))}</span>` +
            (running ? '' : `<button type="button" class="text-link-btn sessions-edit" data-act="edit" data-index="${s.index}">Edit</button>`) +
            `</li>`;
    }
    function editorHtml(p, mode, s, nowMs) {
        const startMs = s ? s.start : nowMs;
        const nextDay = s ? !sameDay(s.start, s.end) : false;
        return `<li class="sessions-editor" data-mode="${mode}"${s ? ` data-index="${s.index}"` : ''}>` +
            `<div class="sessions-fields">` +
            `<label class="sessions-field">Date<input type="date" id="${p}SesDate" value="${dateValue(startMs)}" max="${dateValue(nowMs)}"></label>` +
            `<label class="sessions-field">Start<input type="time" id="${p}SesStart" value="${s ? timeValue(s.start) : ''}"></label>` +
            `<label class="sessions-field">Stop<input type="time" id="${p}SesStop" value="${s ? timeValue(s.end) : ''}"></label>` +
            `</div>` +
            `<label class="sessions-next"><input type="checkbox" id="${p}SesNext"${nextDay ? ' checked' : ''}> Stop is the next day</label>` +
            `<p class="sessions-charge" id="${p}SesCharge" role="status" aria-live="polite"></p>` +
            `<p class="sessions-error" id="${p}SesError" role="alert"></p>` +
            `<div class="sessions-buttons">` +
            `<button type="button" class="secondary-button" data-act="save">${mode === 'add' ? 'Add session' : 'Save session'}</button>` +
            (mode === 'edit' ? `<button type="button" class="danger-button sessions-delete" data-act="delete">Delete</button>` : '') +
            `<button type="button" class="text-link-btn" data-act="cancel">Cancel</button>` +
            `</div></li>`;
    }
    /**
     * The inside of the container. state: { editing: null | { mode: 'edit', index } | { mode: 'add' } }.
     * o: { idPrefix, running, now }. A running timer shows its own read-only row and no Edit / Add.
     */
    function innerHtml(item, o, state) {
        const p = o.idPrefix || 'sess';
        const now = typeof o.now === 'number' ? o.now : Date.now();
        const running = !!(o.running || (typeof Timer !== 'undefined' && Timer.isRunning(item)));
        const v = TimerSessions.view(item);
        const editing = state && state.editing;
        const rows = [];
        if (running && item.timer && typeof item.timer.startedAt === 'number') {
            rows.push(`<li class="sessions-row sessions-running"><span class="sessions-when">Running since ${esc(fmtTime(item.timer.startedAt))}</span></li>`);
        }
        // Newest first: the session you just stopped is the one you most often fix.
        v.sessions.slice().reverse().forEach((s) => {
            if (editing && editing.mode === 'edit' && editing.index === s.index) rows.push(editorHtml(p, 'edit', s, now));
            else rows.push(rowHtml(s, running));
        });
        if (v.untimedMs > 0) {
            rows.push(`<li class="sessions-row sessions-untimed"><span class="sessions-when">No start/stop recorded</span>` +
                `<span class="sessions-dur">${esc(fmtDuration(v.untimedMs))}</span></li>`);
        }
        if (editing && editing.mode === 'add') rows.push(editorHtml(p, 'add', null, now));
        if (!rows.length) rows.push('<li class="sessions-empty">No timer sessions yet.</li>');
        return `<h4 class="sessions-title">Sessions</h4><ul class="sessions-list">${rows.join('')}</ul>` +
            (running || (editing && editing.mode === 'add') ? '' : `<button type="button" class="text-link-btn sessions-add" data-act="add">+ Add session</button>`) +
            `<span class="sessions-msg" id="${p}SesMsg" role="status" aria-live="polite"></span>`;
    }
    function html(item, o) {
        const p = (o && o.idPrefix) || 'sess';
        return `<div class="sessions" id="${p}Sessions">${innerHtml(item, o || {}, { editing: null })}</div>`;
    }

    // ---- behaviour -----------------------------------------------------------------------------------------------
    // Reads the open editor: { start, end } in ms, or null when a field is blank / unreadable.
    function readEditor(root, p) {
        const q = (suffix) => root.querySelector('#' + p + suffix);
        const date = q('SesDate'), start = q('SesStart'), stop = q('SesStop'), next = q('SesNext');
        if (!date || !start || !stop) return null;
        const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.value || '');
        const sm = /^(\d{2}):(\d{2})$/.exec(start.value || '');
        const em = /^(\d{2}):(\d{2})$/.exec(stop.value || '');
        if (!dm || !sm || !em) return null;
        const y = Number(dm[1]), mo = Number(dm[2]) - 1, d = Number(dm[3]);
        const s = new Date(y, mo, d, Number(sm[1]), Number(sm[2])).getTime();
        const e = new Date(y, mo, d + (next && next.checked ? 1 : 0), Number(em[1]), Number(em[2])).getTime();
        return { start: s, end: e };
    }

    /**
     * Attach the list to `#${idPrefix}Sessions`. o: { idPrefix, getItem(), deps: { changeSession(id, change), getBaseHealth? },
     * onChange(res) }. Returns { render() } -- call render() after the item's running state changes.
     */
    function wire(o) {
        const p = o.idPrefix || 'sess';
        const root = document.getElementById(p + 'Sessions');
        if (!root) return null;
        const state = { editing: null, confirmDelete: false };
        const item = () => o.getItem();
        const hpNow = () => (o.deps && typeof o.deps.getBaseHealth === 'function') ? o.deps.getBaseHealth() : Infinity;

        function render(msg) {
            root.innerHTML = innerHtml(item(), { idPrefix: p }, state);
            const m = root.querySelector('#' + p + 'SesMsg');
            if (m && msg) m.textContent = msg;
            if (state.editing) refreshPreview();
        }
        function changeFor(span) {
            const e = state.editing;
            if (!e || !span) return null;
            return e.mode === 'add' ? { type: 'add', start: span.start, end: span.end } : { type: 'edit', index: e.index, start: span.start, end: span.end };
        }
        // Live line under the fields: the reason it can't be saved, or what saving costs.
        function refreshPreview() {
            const charge = root.querySelector('#' + p + 'SesCharge');
            const err = root.querySelector('#' + p + 'SesError');
            const save = root.querySelector('[data-act="save"]');
            if (!charge || !err) return;
            state.confirmDelete = false;
            const del = root.querySelector('[data-act="delete"]');
            if (del) del.textContent = 'Delete';
            const span = readEditor(root, p);
            charge.textContent = ''; err.textContent = '';
            if (!span) { if (save) save.disabled = true; return; }
            const r = TimerSessions.preview(item(), changeFor(span), { now: Date.now() });
            if (!r.ok) { err.textContent = reasonText(r.reason); if (save) save.disabled = true; return; }
            if (save) save.disabled = false;
            charge.textContent = chargeText('Saving', r.chargeHp, TimerSessions.capCharge(r.chargeHp, hpNow()));
        }
        function done(res, text) {
            state.editing = null; state.confirmDelete = false;
            let msg = text;
            if (res && res.chargedHp > 0) msg = `${text} Took back ${res.chargedHp} HP of halved damage.`;
            render(msg);
            if (typeof o.onChange === 'function') o.onChange(res);
        }
        function save() {
            const span = readEditor(root, p);
            const err = root.querySelector('#' + p + 'SesError');
            if (!span) { if (err) err.textContent = reasonText('invalid'); return; }
            const adding = state.editing && state.editing.mode === 'add';
            const res = o.deps.changeSession(item().id, changeFor(span));
            if (!res || !res.ok) { if (err) err.textContent = reasonText(res && res.reason); return; }
            done(res, adding ? 'Session added.' : 'Session saved.');
        }
        function remove() {
            const del = root.querySelector('[data-act="delete"]');
            const charge = root.querySelector('#' + p + 'SesCharge');
            const e = state.editing;
            if (!e || e.mode !== 'edit') return;
            if (!state.confirmDelete) {
                // First tap: say what it costs; the second tap does it (no native confirm box).
                const r = TimerSessions.preview(item(), { type: 'delete', index: e.index }, { now: Date.now() });
                state.confirmDelete = true;
                if (del) del.textContent = 'Tap again to delete';
                if (charge && r.ok) charge.textContent = chargeText('Deleting', r.chargeHp, TimerSessions.capCharge(r.chargeHp, hpNow())) || 'This removes the session and its time.';
                return;
            }
            const res = o.deps.changeSession(item().id, { type: 'delete', index: e.index });
            if (!res || !res.ok) { const err = root.querySelector('#' + p + 'SesError'); if (err) err.textContent = reasonText(res && res.reason); return; }
            done(res, 'Session deleted.');
        }

        root.addEventListener('click', (ev) => {
            const btn = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
            if (!btn || !root.contains(btn)) return;
            ev.preventDefault();
            ev.stopPropagation(); // the buttons re-draw this container: the dismiss handler must not see a detached target
            const act = btn.getAttribute('data-act');
            if (act === 'edit') { state.editing = { mode: 'edit', index: Number(btn.getAttribute('data-index')) }; state.confirmDelete = false; render(); }
            else if (act === 'add') { state.editing = { mode: 'add' }; state.confirmDelete = false; render(); }
            else if (act === 'cancel') { state.editing = null; state.confirmDelete = false; render(); }
            else if (act === 'save') save();
            else if (act === 'delete') remove();
        });
        const onInput = () => { if (state.editing) refreshPreview(); };
        root.addEventListener('input', onInput);
        root.addEventListener('change', onInput);

        return { render, state };
    }

    const api = { html, innerHtml, wire, readEditor, reasonText, chargeText, fmtTime, fmtDay, fmtDuration, rangeText };
    return api;
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionsView;
}

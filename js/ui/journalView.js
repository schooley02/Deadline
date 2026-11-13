/**
 * JournalView -- the note window and the small "Notes" block on an item / routine window (Journal Build A, 2026-11-13;
 * docs/JOURNAL_PLAN.md "Where a note can be written").
 *
 * One component writes every note: a title that says what the note is about, an optional context line ("Time Logged: 45 min"), the
 * day's mood face when there is one (read-only), a text box with a character count, and Save / Skip. It is ALWAYS optional: Skip,
 * an empty box, Esc or a tap outside all just close it. A typed draft is protected: a tap on the backdrop or Esc does nothing while
 * the box has text (only Save or Skip closes it), so a stray tap never throws a note away.
 *
 * Build B adds the Journal window (renderWindow), the day-end card (openDayEnd) and their pure markup.
 *
 * DOM only. Modal / Mood / Journal / Dialog are bare globals (loaded first). All saving is script.js's: onSave(text) returns true when the note was
 * stored; false keeps the window open with an inline message (storage full, say).
 */
const JournalView = (() => {
    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** "Nov 13" for an older day, "Today" / "Yesterday" for the last two. `at` / `nowMs` in ms. */
    function whenText(at, nowMs) {
        const d = new Date(at);
        const now = new Date(typeof nowMs === 'number' ? nowMs : Date.now());
        const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
        const diff = Math.round((day(now) - day(d)) / 86400000);
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Yesterday';
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    /** The emoji + label of a mood snapshot [level, feelingBits, contextBits], or null. */
    function moodFace(mood) {
        if (!Array.isArray(mood) || typeof Mood === 'undefined') return null;
        const lv = (Mood.LEVELS || []).find((l) => l.level === mood[0]);
        return lv ? { emoji: lv.emoji, label: lv.label } : null;
    }

    /** The one-line "Recent notes" text: collapsed whitespace, cut at `max` characters. */
    function snippet(text, max) {
        const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
        const cap = typeof max === 'number' && max > 3 ? max : 140;
        return t.length > cap ? t.slice(0, cap - 1).trimEnd() + '…' : t;
    }

    // ---- The note window ----------------------------------------------------------------------------------------------------

    /** opts: { title, context?, mood?: [level, fBits, cBits] | null, maxChars?, initialText?, saveLabel? }. Pure markup. */
    function noteWindowHtml(opts) {
        const o = opts || {};
        const face = moodFace(o.mood);
        const max = typeof o.maxChars === 'number' && o.maxChars > 0 ? Math.floor(o.maxChars) : 2000;
        return `
            <div class="modal-overlay journal-note-overlay">
                <div class="modal-content journal-note-modal" role="dialog" aria-label="${esc(o.title || 'Add a note')}">
                    <h3 class="journal-note-title">${esc(o.title || 'Add a note')}</h3>
                    ${o.context ? `<p class="journal-note-context">${esc(o.context)}</p>` : ''}
                    ${o.extraHtml || ''}
                    ${face ? `<p class="journal-note-mood" data-journal-mood><span class="journal-note-mood-face" aria-hidden="true">${face.emoji}</span> Mood today: ${esc(face.label)}</p>` : ''}
                    <textarea class="journal-note-text" rows="5" maxlength="${max}" data-journal-text
                        placeholder="${esc(o.placeholder || 'What worked? What got in the way? Anything you want to remember.')}">${esc(o.initialText || '')}</textarea>
                    <p class="journal-note-count" data-journal-count aria-live="polite"></p>
                    <p class="journal-note-error" data-journal-error role="alert" hidden></p>
                    <p class="journal-note-hint">Optional. Notes stay on this device and earn nothing; they are for you to look back on.</p>
                    <div class="modal-buttons journal-note-actions">
                        <button type="button" class="primary-button" data-journal-save>${esc(o.saveLabel || 'Save note')}</button>
                        <button type="button" class="secondary-button" data-journal-skip>Skip</button>
                    </div>
                </div>
            </div>`;
    }

    /**
     * Open the note window. opts as noteWindowHtml plus { onSave(text) -> boolean, onClose?() }.
     * Returns the overlay, or null when one is already open / Modal is missing. Never throws.
     */
    function openNote(opts) {
        const o = opts || {};
        if (typeof Modal === 'undefined') return null;
        const overlay = Modal.open(noteWindowHtml(o), { dedupeSelector: '.journal-note-overlay' });
        if (!overlay) return null;
        const max = typeof o.maxChars === 'number' && o.maxChars > 0 ? Math.floor(o.maxChars) : 2000;
        const ta = overlay.querySelector('[data-journal-text]');
        const count = overlay.querySelector('[data-journal-count]');
        const errorEl = overlay.querySelector('[data-journal-error]');
        const saveBtn = overlay.querySelector('[data-journal-save]');
        const skipBtn = overlay.querySelector('[data-journal-skip]');
        let closed = false;
        const close = () => {
            if (closed) return;
            closed = true;
            if (overlay.parentNode) overlay.remove();
            if (typeof o.onClose === 'function') { try { o.onClose(); } catch (e) { /* never break the window */ } }
        };
        const hasDraft = () => !!(ta && ta.value.trim());
        const refreshCount = () => { if (count) count.textContent = ta ? `${ta.value.length} / ${max}` : ''; };
        refreshCount();
        if (ta) {
            ta.addEventListener('input', () => { refreshCount(); if (errorEl) errorEl.hidden = true; });
            // Esc with a draft does nothing (Modal's document handler never sees it); an empty box lets Esc close as usual.
            ta.addEventListener('keydown', (e) => { if (e.key === 'Escape' && hasDraft()) e.stopPropagation(); });
        }
        // A tap on the backdrop must not throw a typed note away.
        overlay.addEventListener('click', (e) => { if (e.target === overlay && hasDraft()) e.stopPropagation(); });
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = ta ? ta.value : '';
                if (!text.trim()) { close(); return; } // Save with nothing typed is Skip
                let ok = false;
                try { ok = typeof o.onSave === 'function' ? o.onSave(text) !== false : true; } catch (err) { ok = false; }
                if (ok) { close(); return; }
                if (errorEl) { errorEl.textContent = 'Couldn’t save the note (the device storage may be full). Your text is still here.'; errorEl.hidden = false; }
            });
        }
        if (skipBtn) skipBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
        // Closed any other way (Esc on an empty box, tap outside an empty box) counts as Skip.
        const observer = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => {
            if (!document.body.contains(overlay)) { observer.disconnect(); close(); }
        }) : null;
        if (observer) observer.observe(document.body, { childList: true });
        if (typeof o.onOpen === 'function') { try { o.onOpen(overlay); } catch (e) { /* a broken extra never blocks the note */ } }
        if (ta && typeof ta.focus === 'function') setTimeout(() => { try { ta.focus(); } catch (e) { /* ignore */ } }, 0);
        return overlay;
    }

    // ---- The "Notes" block on an item / routine window ----------------------------------------------------------------------

    /** entries: newest-first journal entries (Journal.forRef). Pure markup: the heading row with the Add note button, then the recent list. */
    function itemNotesHtml(entries, opts) {
        const o = opts || {};
        const max = typeof o.limit === 'number' && o.limit > 0 ? o.limit : 3;
        const list = Array.isArray(entries) ? entries.slice(0, max) : [];
        // Build B: `entries.total` (set by the host) = how many notes exist about this thing; more than shown -> an "All notes" button.
        const total = Array.isArray(entries) && typeof entries.total === 'number' ? entries.total : list.length;
        const rows = list.map((e) => {
            const face = moodFace(e.mood);
            return `<li class="journal-recent-row">
                <span class="journal-recent-when">${esc(whenText(e.at, o.now))}</span>${face ? `<span class="journal-recent-mood" title="${esc(face.label)}" aria-label="${esc(face.label)}">${face.emoji}</span>` : ''}
                <span class="journal-recent-text">${esc(snippet(e.text, 140))}</span></li>`;
        }).join('');
        return `
            <div class="journal-item-notes" data-journal-notes>
                <div class="journal-item-notes-head">
                    <strong>Notes</strong>
                    <button type="button" class="secondary-button journal-add-btn" data-journal-add>Add note</button>
                </div>
                ${rows ? `<ul class="journal-recent">${rows}</ul>` : '<p class="journal-recent-empty">No notes yet.</p>'}
                ${total > list.length ? `<button type="button" class="secondary-button journal-all-btn" data-journal-all>All notes (${total})</button>` : ''}
            </div>`;
    }

    /**
     * Wire the block inside `root`. deps: { getNotes() -> newest-first entries, onAdd(afterSave) } where onAdd opens the note window and
     * calls afterSave() once a note was stored (the list is redrawn then). Taps stopPropagation (Modal's outside-click must not see them).
     */
    function wireItemNotes(root, deps) {
        if (!root || !deps) return null;
        const block = root.querySelector('[data-journal-notes]');
        if (!block) return null;
        const redraw = () => {
            const fresh = document.createElement('div');
            fresh.innerHTML = itemNotesHtml(typeof deps.getNotes === 'function' ? deps.getNotes() : [], { now: Date.now() });
            const next = fresh.firstElementChild;
            if (next && block.parentNode) { block.replaceWith(next); wireItemNotes(root, deps); }
        };
        const all = block.querySelector('[data-journal-all]');
        if (all) {
            all.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const entries = typeof deps.getNotes === 'function' ? deps.getNotes() : [];
                const ref = entries && entries[0] ? entries[0].ref : null;
                if (!ref || typeof deps.onAll !== 'function') return;
                // The item / routine window closes first: the Journal opens as its own window, one tick later (this click is still bubbling).
                if (root.classList && root.classList.contains('modal-overlay') && root.parentNode) root.remove();
                setTimeout(() => deps.onAll(ref), 0);
            });
        }
        const add = block.querySelector('[data-journal-add]');
        if (add) {
            add.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // One tick later: this click is still bubbling and Modal's dismiss handler must not see the new overlay.
                setTimeout(() => { if (typeof deps.onAdd === 'function') deps.onAdd(redraw); }, 0);
            });
        }
        return { redraw };
    }

    // ---- The Journal window (Build B) -------------------------------------------------------------------------------------

    const DAYS_PER_PAGE = 30;

    /** "Today" / "Yesterday" / "Fri, Nov 13" for a YYYY-MM-DD day key. */
    function dayHeading(dayKey, nowMs) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey));
        if (!m) return String(dayKey || '');
        const d = new Date(+m[1], +m[2] - 1, +m[3]);
        const rel = whenText(d.getTime(), nowMs);
        return rel === 'Today' || rel === 'Yesterday' ? rel : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    }

    function timeText(at) {
        try { return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; }
    }

    /** What an entry is about, in words: the item / routine name (a snapshot), "The day", or the game's name. */
    function aboutLabel(e, gameName, words) {
        if (e.about === 'item' || e.about === 'routine') return (e.ref && e.ref.name) || (e.about === 'routine' ? 'A routine' : 'An item');
        if (e.about === 'general') return (words && words.tag) || gameName || 'The game';
        return 'The day';
    }

    /** One entry row. Pure markup; `idx` is the entry's position in the window's current list (the tap target finds it again by id). */
    function entryHtml(e, o) {
        const opts = o || {};
        const face = moodFace(e.mood);
        const canFilter = (e.about === 'item' || e.about === 'routine') && e.ref;
        const label = esc(aboutLabel(e, opts.gameName, opts.words));
        const about = canFilter
            ? `<button type="button" class="journal-entry-about journal-entry-about--link" data-journal-ref="${esc(e.id)}" title="Show every note about this">${label}</button>`
            : `<span class="journal-entry-about">${label}</span>`;
        return `<li class="journal-entry" data-entry-id="${esc(e.id)}">
            <div class="journal-entry-head">
                <span class="journal-entry-time">${esc(timeText(e.at))}</span>
                ${face ? `<span class="journal-entry-mood" title="${esc(face.label)}" role="img" aria-label="${esc('Mood: ' + face.label)}">${face.emoji}</span>` : ''}
                ${about}
                ${e.late ? '<span class="journal-entry-tag">written the next morning</span>' : ''}
                ${e.edited ? '<span class="journal-entry-tag">edited</span>' : ''}
            </div>
            <p class="journal-entry-text">${esc(e.text)}</p>
            <div class="journal-entry-actions">
                <button type="button" class="secondary-button journal-entry-btn" data-journal-edit="${esc(e.id)}">Edit</button>
                <button type="button" class="secondary-button journal-entry-btn" data-journal-delete="${esc(e.id)}">Delete</button>
            </div>
        </li>`;
    }

    /** One day's block: the heading (date, run, the day's mood faces) then its entries. group = { day, entries }. */
    function dayHtml(group, o) {
        const opts = o || {};
        const run = group.entries.length && group.entries[0].run > 0 ? ` · Run #${group.entries[0].run}` : '';
        let glyph = '';
        if (typeof opts.moodFor === 'function' && typeof Mood !== 'undefined' && typeof Mood.dayGlyph === 'function') {
            const g = Mood.dayGlyph(opts.moodFor(group.day));
            if (g) glyph = ` <span class="journal-day-mood" title="${esc(g.title)}" role="img" aria-label="${esc('Mood: ' + g.title)}">${esc(g.text)}</span>`;
        }
        return `<section class="journal-day" data-journal-day="${esc(group.day)}">
            <h4 class="journal-day-head">${esc(dayHeading(group.day, opts.now))}${esc(run)}${glyph}</h4>
            <ul class="journal-entries">${group.entries.map((e) => entryHtml(e, opts)).join('')}</ul>
        </section>`;
    }

    const RUNS_PER_PAGE = 10;

    /** One run's block (the By run view): a header (Run N, its dates, the note count, Open), then the run-level notes, then its days. */
    function runHtml(g, o) {
        const opts = o || {};
        const title = g.run > 0 ? `Run #${g.run}` : 'No run recorded';
        const dates = g.first === g.last ? dayHeading(g.first, opts.now) : `${dayHeading(g.first, opts.now)} to ${dayHeading(g.last, opts.now)}`;
        const notesHead = (opts.words && opts.words.title) || 'Notes about this run';
        const notes = g.notes.length
            ? `<section class="journal-run-notes"><h5 class="journal-run-notes-head">${esc(notesHead)}</h5><ul class="journal-entries">${g.notes.map((e) => entryHtml(e, opts)).join('')}</ul></section>`
            : '';
        return `<section class="journal-run" data-journal-run-block="${g.run}">
            <h4 class="journal-run-head"><span>${esc(title)}</span> <span class="journal-run-meta">${esc(dates)} · ${g.count} note${g.count === 1 ? '' : 's'}</span>
                ${g.run > 0 ? `<button type="button" class="secondary-button journal-run-open" data-journal-run="${g.run}">Open</button>` : ''}</h4>
            ${notes}${g.days.map((d) => dayHtml(d, opts)).join('')}
        </section>`;
    }

    function filterLabel(f, gameName) {
        if (!f) return '';
        if (f.kind === 'ref' && f.ref) return f.ref.name ? `Notes about ${f.ref.name}` : 'Notes about one thing';
        if (f.kind === 'run') return `Notes from run #${f.run}`;
        return '';
    }

    /**
     * The whole window body. model: { filter: {kind,...}, groups: [{day, entries}], hasMore, total, shown, sizeChars, gameName, moodFor, now }.
     * Pure markup (the DOM wiring is renderWindow).
     */
    function windowHtml(model) {
        const m = model || {};
        const f = m.filter || { kind: 'all' };
        const chip = (kind, label) => `<button type="button" class="journal-chip${f.kind === kind ? ' journal-chip--on' : ''}" data-journal-filter="${kind}" aria-pressed="${f.kind === kind ? 'true' : 'false'}">${label}</button>`;
        const special = filterLabel(f, m.gameName);
        const kb = Math.max(1, Math.round((m.sizeChars || 0) / 1024));
        const byRun = m.view === 'run';
        const view = (id, label) => `<button type="button" class="journal-chip${(byRun ? 'run' : 'day') === id ? ' journal-chip--on' : ''}" data-journal-view="${id}" aria-pressed="${(byRun ? 'run' : 'day') === id ? 'true' : 'false'}">${label}</button>`;
        const body = byRun && m.runGroups && m.runGroups.length
            ? m.runGroups.map((g) => runHtml(g, m)).join('')
            : (!byRun && m.groups && m.groups.length)
            ? m.groups.map((g) => dayHtml(g, m)).join('')
            : `<p class="journal-empty">${m.total ? 'Nothing matches this filter.' : 'No notes yet. Add one from the buttons above, after you stop a timer, or on any task, habit or routine.'}</p>`;
        return `<div class="journal-window" data-journal-root>
            <div class="journal-top-actions">
                <button type="button" class="primary-button journal-write-btn" data-journal-write="day">Note about today</button>
                <button type="button" class="secondary-button journal-write-btn" data-journal-write="general">${esc((m.words && m.words.button) || `Note about ${m.gameName || 'the game'}`)}</button>
            </div>
            <div class="journal-filters" role="group" aria-label="Filter notes">${chip('all', 'All')}${chip('days', 'Days')}${chip('game', esc((m.words && m.words.filter) || m.gameName || 'Game'))}</div>
            <div class="journal-views" role="group" aria-label="Group notes">${view('day', 'By day')}${view('run', 'By run')}</div>
            ${special ? `<p class="journal-filter-note"><span>${esc(special)}</span> <button type="button" class="secondary-button journal-clear-btn" data-journal-filter="all">Show all</button></p>` : ''}
            <div class="journal-list">${body}</div>
            ${m.hasMore ? `<button type="button" class="secondary-button journal-more-btn" data-journal-more>${byRun ? 'Show older runs' : 'Show older days'}</button>` : ''}
            <p class="journal-size">${m.total || 0} note${m.total === 1 ? '' : 's'} on this device · about ${kb} KB. Notes are never sent anywhere and earn nothing.</p>
        </div>`;
    }

    /**
     * Build the model from a store (needs the Journal module, a bare global like Mood). state: { filter, days } (days = how many day blocks to show).
     */
    function buildModel(store, state, extra) {
        const st = state || {};
        const entries = Journal.filter(store, st.filter);
        const groups = Journal.groupByDay(entries);
        const limit = typeof st.days === 'number' && st.days > 0 ? st.days : DAYS_PER_PAGE;
        const byRun = st.view === 'run';
        const runs = byRun ? Journal.groupByRun(entries) : [];
        const runLimit = typeof st.runs === 'number' && st.runs > 0 ? st.runs : RUNS_PER_PAGE;
        return Object.assign({
            filter: st.filter || { kind: 'all' },
            view: byRun ? 'run' : 'day',
            groups: groups.slice(0, limit),
            runGroups: runs.slice(0, runLimit),
            hasMore: byRun ? runs.length > runLimit : groups.length > limit,
            total: Journal.count(store),
            sizeChars: Journal.sizeChars(store),
        }, extra || {});
    }

    /**
     * Draw the Journal window into `container` and wire it (taps are delegated and ASSIGNED, so a re-open replaces the handler).
     * deps: { getStore(), moodFor(dayKey), gameName?, filter?, maxChars?, onWrite(about, afterSave), onEdit(id, text) -> boolean,
     *         onDelete(id) -> boolean, confirmDelete?(entry) -> Promise<boolean> }.
     * Returns { render, getState } or null.
     */
    function renderWindow(container, deps) {
        if (!container || !deps || typeof deps.getStore !== 'function' || typeof Journal === 'undefined') return null;
        const state = { filter: deps.filter && deps.filter.kind ? deps.filter : { kind: 'all' }, days: DAYS_PER_PAGE, view: 'day', runs: RUNS_PER_PAGE };
        const render = () => {
            container.innerHTML = windowHtml(buildModel(deps.getStore(), state, { gameName: deps.gameName, words: deps.words, moodFor: deps.moodFor, now: Date.now() }));
        };
        const later = (fn) => setTimeout(fn, 0); // the tap is still bubbling: open the new window one tick later
        container.onclick = (e) => {
            const t = e.target && e.target.closest ? e.target.closest('button') : null;
            if (!t || !container.contains(t)) return;
            e.stopPropagation();
            if (t.hasAttribute('data-journal-filter')) {
                state.filter = { kind: t.getAttribute('data-journal-filter') }; state.days = DAYS_PER_PAGE; render(); return;
            }
            if (t.hasAttribute('data-journal-view')) { state.view = t.getAttribute('data-journal-view') === 'run' ? 'run' : 'day'; state.days = DAYS_PER_PAGE; state.runs = RUNS_PER_PAGE; render(); return; }
            if (t.hasAttribute('data-journal-run')) { state.filter = { kind: 'run', run: Number(t.getAttribute('data-journal-run')) }; state.days = DAYS_PER_PAGE; state.runs = RUNS_PER_PAGE; render(); return; }
            if (t.hasAttribute('data-journal-more')) { if (state.view === 'run') state.runs += RUNS_PER_PAGE; else state.days += DAYS_PER_PAGE; render(); return; }
            if (t.hasAttribute('data-journal-write')) {
                const about = t.getAttribute('data-journal-write') === 'general' ? 'general' : 'day';
                later(() => { if (typeof deps.onWrite === 'function') deps.onWrite(about, render); });
                return;
            }
            if (t.hasAttribute('data-journal-ref')) {
                const hit = Journal.find(deps.getStore(), t.getAttribute('data-journal-ref'));
                if (hit && hit.entry.ref) { state.filter = { kind: 'ref', ref: { kind: hit.entry.ref.kind, id: hit.entry.ref.id, name: hit.entry.ref.name } }; state.days = DAYS_PER_PAGE; render(); }
                return;
            }
            if (t.hasAttribute('data-journal-edit')) {
                const hit = Journal.find(deps.getStore(), t.getAttribute('data-journal-edit'));
                if (!hit) return;
                later(() => openNote({
                    title: 'Edit note', initialText: hit.entry.text, saveLabel: 'Save changes', maxChars: deps.maxChars,
                    context: `${dayHeading(hit.dayKey)} · ${aboutLabel(hit.entry, deps.gameName, deps.words)}`,
                    onSave: (text) => {
                        const ok = typeof deps.onEdit === 'function' ? deps.onEdit(hit.entry.id, text) : false;
                        if (ok) render();
                        return ok;
                    },
                }));
                return;
            }
            if (t.hasAttribute('data-journal-delete')) {
                const hit = Journal.find(deps.getStore(), t.getAttribute('data-journal-delete'));
                if (!hit) return;
                const ask = typeof deps.confirmDelete === 'function'
                    ? deps.confirmDelete(hit.entry)
                    : (typeof Dialog !== 'undefined'
                        ? Dialog.confirm('This note will be removed from this device. This cannot be undone.', { title: 'Delete this note?', confirmLabel: 'Delete', cancelLabel: 'Keep', danger: true })
                        : Promise.resolve(false));
                Promise.resolve(ask).then((yes) => {
                    if (yes && typeof deps.onDelete === 'function' && deps.onDelete(hit.entry.id)) render();
                });
            }
        };
        render();
        return { render, getState: () => state };
    }

    // ---- The completion chip (Build C) ---------------------------------------------------------------------------------------

    const CHIP_MS = 7000;
    const CHIP_FADE_MS = 400;
    // The chip ignores touches for this long after it appears: the tap that finished the task (often at the bottom-left, where the chip
    // lands) can deliver a late click to whatever is under the finger, and that must not open the note window by accident.
    const CHIP_ARM_MS = 700;

    /**
     * A small "Add a note" button that appears at the bottom-left when a task is finished with its timer running, then fades away by itself.
     * Never a window and never blocking: tapping it opens the note window (one tick later), ignoring it costs nothing. One chip at a time.
     * opts: { text, onTap(), ms? }. Returns the element, or null without a document.
     */
    function showChip(opts) {
        if (typeof document === 'undefined' || !document.body) return null;
        const o = opts || {};
        document.querySelectorAll('.journal-chip-toast').forEach((el) => el.remove());
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'journal-chip-toast';
        el.textContent = o.text || 'Add a note';
        let gone = false;
        const shownAt = Date.now();
        const armTimer = setTimeout(() => el.classList.add('journal-chip-toast--armed'), CHIP_ARM_MS);
        const remove = () => { if (gone) return; gone = true; clearTimeout(armTimer); if (el.parentNode) el.remove(); };
        const ms = typeof o.ms === 'number' && o.ms >= 0 ? o.ms : CHIP_MS;
        const fadeTimer = setTimeout(() => {
            el.classList.add('journal-chip-toast--out');
            setTimeout(remove, CHIP_FADE_MS);
        }, ms);
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (Date.now() - shownAt < CHIP_ARM_MS) return; // a late click from the completing tap: ignore it
            clearTimeout(fadeTimer);
            remove();
            setTimeout(() => { if (typeof o.onTap === 'function') o.onTap(); }, 0);
        });
        document.body.appendChild(el);
        return el;
    }

    // ---- The day-end card: "How did today go?" (Build B) -------------------------------------------------------------------

    /**
     * "How did today go?" (the evening) or "How did yesterday go?" (the next morning). One window: a face row, an optional note, Save / Skip.
     * opts: { late?: boolean, maxChars?, mountMood?(container) -> draws the host's real mood picker (today's card; a face tap is an ordinary
     * check-in), onSave(text, level|null) -> boolean, onClose?() }. A late card has no real picker: its own five faces fill `level`, which the
     * host stores on the ENTRY only (a closed day's record is never edited). Returns the overlay or null.
     */
    function openDayEnd(opts) {
        const o = opts || {};
        const late = o.late === true;
        let level = null;
        const mountHtml = `<div class="journal-dayend-faces" data-journal-faces>${late ? `<div class="journal-level-row" role="group" aria-label="How yesterday felt">${(typeof Mood !== 'undefined' && Mood.LEVELS ? Mood.LEVELS : []).map((l) => `<button type="button" class="journal-level-btn" data-journal-level="${l.level}" aria-pressed="false" title="${esc(l.label)}"><span aria-hidden="true">${l.emoji}</span><span class="journal-level-label">${esc(l.label)}</span></button>`).join('')}</div>` : ''}</div>`;
        return openNote({
            title: late ? 'How did yesterday go?' : 'How did today go?',
            context: 'One tap on a face, and a few words if you like. Optional: nothing is earned or lost either way.',
            extraHtml: mountHtml,
            placeholder: late ? 'Anything you want to remember about yesterday.' : 'What went well? What got in the way? Anything you want to remember.',
            maxChars: o.maxChars,
            mood: null,
            onSave: (text) => (typeof o.onSave === 'function' ? o.onSave(text, level) : true),
            onClose: o.onClose,
            onOpen: (overlay) => {
                const holder = overlay.querySelector('[data-journal-faces]');
                if (!holder) return;
                if (!late) {
                    if (typeof o.mountMood === 'function') o.mountMood(holder);
                    return;
                }
                holder.addEventListener('click', (e) => {
                    const b = e.target.closest ? e.target.closest('[data-journal-level]') : null;
                    if (!b) return;
                    e.stopPropagation();
                    level = Number(b.getAttribute('data-journal-level'));
                    holder.querySelectorAll('[data-journal-level]').forEach((x) => {
                        const on = x === b;
                        x.setAttribute('aria-pressed', on ? 'true' : 'false');
                        x.classList.toggle('journal-level-btn--on', on);
                    });
                });
            },
        });
    }

    return {
        noteWindowHtml, openNote, itemNotesHtml, wireItemNotes, whenText, moodFace, snippet, esc,
        dayHeading, aboutLabel, entryHtml, dayHtml, windowHtml, runHtml, buildModel, renderWindow, openDayEnd, showChip, CHIP_MS, CHIP_ARM_MS, DAYS_PER_PAGE, RUNS_PER_PAGE,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = JournalView;
}

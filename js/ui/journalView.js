/**
 * JournalView -- the note window and the small "Notes" block on an item / routine window (Journal Build A, 2026-11-13;
 * docs/JOURNAL_PLAN.md "Where a note can be written").
 *
 * One component writes every note: a title that says what the note is about, an optional context line ("Time Logged: 45 min"), the
 * day's mood face when there is one (read-only), a text box with a character count, and Save / Skip. It is ALWAYS optional: Skip,
 * an empty box, Esc or a tap outside all just close it. A typed draft is protected: a tap on the backdrop or Esc does nothing while
 * the box has text (only Save or Skip closes it), so a stray tap never throws a note away.
 *
 * DOM only. Modal / Mood are bare globals (loaded first). All saving is script.js's: onSave(text) returns true when the note was
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
        if (ta && typeof ta.focus === 'function') setTimeout(() => { try { ta.focus(); } catch (e) { /* ignore */ } }, 0);
        return overlay;
    }

    // ---- The "Notes" block on an item / routine window ----------------------------------------------------------------------

    /** entries: newest-first journal entries (Journal.forRef). Pure markup: the heading row with the Add note button, then the recent list. */
    function itemNotesHtml(entries, opts) {
        const o = opts || {};
        const max = typeof o.limit === 'number' && o.limit > 0 ? o.limit : 3;
        const list = Array.isArray(entries) ? entries.slice(0, max) : [];
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

    return { noteWindowHtml, openNote, itemNotesHtml, wireItemNotes, whenText, moodFace, snippet, esc };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = JournalView;
}

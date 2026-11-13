/**
 * MoodView -- the mood check-in's screens (W1b Build A, 2026-11-13; docs/WORLD_FEEDBACK_PLAN.md "W1b Mood check-in").
 *
 *   - The AVATAR FACE on the HUD level button (`renderAvatarFace`): the player's avatar showing today's latest mood. Emoji for now;
 *     the level button swaps to the PixelLab art the day `CONFIG.MOOD.AVATAR_ART_READY` flips (js/mood.js `faceFor` builds the path).
 *   - The MOOD PICKER (`mount`): five faces (one tap = a complete check-in), then that level's suggested feeling words (up to
 *     Mood.MAX_FEELINGS) with a "More" list of every other word, then the context words. Every tap saves at once (the same local
 *     hour replaces that hour's entry), so there is no Save button. Used inside the Level panel and in the morning card.
 *   - The AVATAR PICKER (`openAvatarPicker`): "Who's playing?", asked once.
 *   - The MORNING CARD (`openMoodCard`): "How are you starting?" with the picker and Skip / Done.
 *
 * PURE / DOM split like the other UI modules: the state helpers and `pickerHtml` are pure and unit-tested; `mount`, the two modals
 * and `renderAvatarFace` are DOM and live-checked. Globals read at call time: Mood, Modal.
 *
 * Every tap inside a picker stops propagation: the picker re-renders its own HTML, so the tapped button is detached by the time
 * Modal's document click handler looks at it, and that handler would read the tap as "outside" and close the window.
 */
const MoodView = (() => {
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESC[c]);
    }

    // ---- pure ------------------------------------------------------------------------------------------------------------

    /** The picker's state from the day's saved entries: the latest entry's level + words, or nothing chosen yet. */
    function initialState(entries) {
        const e = Mood.latest(entries);
        const parts = e ? Mood.entryParts(e) : null;
        return {
            level: parts ? parts.level : null,
            feelings: parts ? parts.feelings : [],
            context: parts ? parts.context : [],
            hour: parts ? parts.hour : null,
            expanded: false,
        };
    }

    /**
     * A face was tapped. In the hour of the latest entry it EDITS that entry (the words stay); in a later hour it is a new check-in
     * with no words yet.
     */
    function pickLevel(state, level, hour) {
        if (!Mood.isLevel(level)) return state;
        const same = state.hour === hour;
        return Object.assign({}, state, { level, hour, feelings: same ? state.feelings : [], context: same ? state.context : [] });
    }

    /** A feeling word was tapped: off if on; on if there is room (the cap); a third word does nothing. Needs a level first. */
    function toggleFeeling(state, id, cap) {
        if (!state.level || !Mood.feelingInfo(id)) return state;
        const max = cap == null ? Mood.MAX_FEELINGS : cap;
        if (state.feelings.indexOf(id) >= 0) return Object.assign({}, state, { feelings: state.feelings.filter((f) => f !== id) });
        if (state.feelings.length >= max) return state;
        return Object.assign({}, state, { feelings: state.feelings.concat([id]) });
    }

    /** A context word was tapped: on / off, no limit. Needs a level first. */
    function toggleContext(state, id) {
        if (!state.level || !Mood.contextInfo(id)) return state;
        const on = state.context.indexOf(id) >= 0;
        return Object.assign({}, state, { context: on ? state.context.filter((c) => c !== id) : state.context.concat([id]) });
    }

    function toggleMore(state) { return Object.assign({}, state, { expanded: !state.expanded }); }

    /** The avatar face for the level button from today's entries (see Mood.faceFor). */
    function faceModel(avatar, entries, artReady) {
        const e = Mood.latest(entries);
        return Mood.faceFor(avatar, e ? e[1] : null, { artReady: artReady === true });
    }

    function chipHtml(attr, id, label, on, disabled) {
        return `<button type="button" class="mood-chip${on ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}" ${attr}="${esc(id)}" aria-pressed="${on ? 'true' : 'false'}"${disabled ? ' aria-disabled="true"' : ''}>${esc(label)}</button>`;
    }

    /** The picker's markup for a state. */
    function pickerHtml(state) {
        const faces = Mood.LEVELS.map((l) => {
            const on = state.level === l.level;
            return `<button type="button" class="mood-face${on ? ' is-selected' : ''}" data-mood-level="${l.level}" aria-pressed="${on ? 'true' : 'false'}" aria-label="${esc(l.label)}"><span class="mood-face-emoji" aria-hidden="true">${l.emoji}</span><span class="mood-face-label">${esc(l.label)}</span></button>`;
        }).join('');
        let words = '';
        if (state.level) {
            const suggested = Mood.suggestionsFor(state.level);
            const others = Mood.moreFor(state.level);
            // A word picked from another level's list stays on screen even while "More" is closed, so it can be taken back off.
            const shown = state.expanded ? suggested.concat(others) : suggested.concat(others.filter((f) => state.feelings.indexOf(f.id) >= 0));
            const full = state.feelings.length >= Mood.MAX_FEELINGS;
            const feelingChips = shown.map((f) => {
                const on = state.feelings.indexOf(f.id) >= 0;
                return chipHtml('data-mood-feeling', f.id, f.label, on, full && !on);
            }).join('');
            const more = others.length
                ? `<button type="button" class="mood-more" data-mood-more aria-expanded="${state.expanded ? 'true' : 'false'}">${state.expanded ? 'Fewer words' : 'More words'}</button>`
                : '';
            const contextChips = Mood.CONTEXT.map((c) => chipHtml('data-mood-context', c.id, c.label, state.context.indexOf(c.id) >= 0, false)).join('');
            words = `
                <p class="mood-hint">Any of these? Pick up to ${Mood.MAX_FEELINGS}, or none.</p>
                <div class="mood-chips" data-mood-feelings>${feelingChips}${more}</div>
                <p class="mood-hint">Anything going on?</p>
                <div class="mood-chips" data-mood-contexts>${contextChips}</div>`;
        }
        return `<div class="mood-picker"><div class="mood-faces" role="group" aria-label="How are you?">${faces}</div>${words}</div>`;
    }

    function avatarPickerHtml() {
        const choices = Mood.AVATARS.map((a) => `<button type="button" class="avatar-choice" data-avatar="${esc(a.id)}" aria-label="${esc(a.label)}"><span class="avatar-choice-emoji" aria-hidden="true">${a.emoji}</span><span class="avatar-choice-label">${esc(a.label)}</span></button>`).join('');
        return `
            <div class="modal-overlay avatar-picker-overlay">
                <div class="modal-content avatar-picker" role="dialog" aria-label="Choose your avatar">
                    <h3>Who's playing?</h3>
                    <p class="avatar-picker-hint">Pick your avatar. Its face on the level button shows how you said you feel today. You can change it later in Settings.</p>
                    <div class="avatar-choices">${choices}</div>
                </div>
            </div>`;
    }

    /** The help card (W1b Build B2): one line + buttons. `added` = the 10-minute task was already added this time. Pure. */
    function helpHtml(model, added) {
        if (!model) return '';
        const buttons = model.actions.map((a) => {
            if (a.id === 'add10' && added) return '<span class="mood-help-added">Added to your list.</span>';
            return `<button type="button" class="secondary-button" data-mood-help="${esc(a.id)}">${esc(a.label)}</button>`;
        }).join('');
        return `<div class="mood-help" role="note"><p class="mood-help-line">${esc(model.line)}</p>
            <div class="mood-help-actions">${buttons}<button type="button" class="mood-more" data-mood-help="dismiss">Not now</button></div></div>`;
    }

    /** The run-of-lows line (a plain paragraph). Pure. */
    // Journal Build A (2026-11-13): once a face is picked, one quiet "Add a note" line (only when the host gave deps.onAddNote).
    function noteRowHtml(state, deps) {
        if (!state || !state.level || !deps || typeof deps.onAddNote !== 'function') return '';
        return '<div class="mood-note-row"><button type="button" class="secondary-button mood-note-btn" data-mood-note>Add a note</button></div>';
    }

    function lowsHtml(line) {
        return line ? `<p class="mood-lows" role="note">${esc(line)}</p>` : '';
    }

    function moodCardHtml(title) {
        return `
            <div class="modal-overlay mood-card-overlay">
                <div class="modal-content mood-card" role="dialog" aria-label="${esc(title)}">
                    <h3>${esc(title)}</h3>
                    <p class="mood-card-hint">One tap is enough. Nothing is earned or lost for how you answer; it only helps you see your own patterns.</p>
                    <div class="mood-card-lows" data-mood-lows></div>
                    <div class="mood-card-mount" data-mood-mount></div>
                    <div class="mood-card-yesterday" data-mood-yesterday></div>
                    <div class="mood-card-actions"><button type="button" class="secondary-button" data-mood-done>Skip</button></div>
                </div>
            </div>`;
    }

    // ---- DOM -------------------------------------------------------------------------------------------------------------

    /**
     * Draw the picker into `container` and wire it. deps: { getEntries(), onLog({ level, feelings: [ids], context: [ids] }),
     * now()?: ms, onChange(state)? }. Returns { getState() }, or null without a container.
     */
    function mount(container, deps) {
        if (!container) return null;
        const now = typeof deps.now === 'function' ? deps.now : Date.now;
        let state = initialState(deps.getEntries());
        // The help card (Build B2): only after a TAP on a low face, once per day (deps.helpAllowed says whether today's card is still
        // unused; deps.onHelpShown stamps it). It stays for the rest of this open view, and "Not now" hides it.
        let tapped = false;
        let helpOn = false;
        let helpDismissed = false;
        let added = false;
        const helpNow = () => {
            if (!tapped || helpDismissed || typeof MoodHelp === 'undefined') return null;
            const m = MoodHelp.helpModel(state.level, state.feelings);
            if (!m) return null;
            if (!helpOn) {
                if (typeof deps.helpAllowed === 'function' && !deps.helpAllowed()) return null;
                helpOn = true;
                if (typeof deps.onHelpShown === 'function') deps.onHelpShown();
            }
            return m;
        };
        const render = () => { container.innerHTML = pickerHtml(state) + noteRowHtml(state, deps) + helpHtml(helpNow(), added); };
        const log = () => deps.onLog({ level: state.level, feelings: state.feelings.slice(), context: state.context.slice() });
        container.addEventListener('click', (e) => {
            const btn = e.target.closest ? e.target.closest('button') : null;
            if (!btn || !container.contains(btn)) return;
            e.stopPropagation();
            const d = btn.dataset;
            if (d.moodHelp) {
                if (d.moodHelp === 'dismiss') {
                    helpDismissed = true;
                } else if (d.moodHelp === 'add10') {
                    if (added) return;
                    added = true;
                    if (typeof deps.onHelpAction === 'function') deps.onHelpAction('add10');
                } else if (d.moodHelp === 'agenda') {
                    const host = container.closest ? container.closest('.modal-overlay') : null;
                    if (host) host.remove();
                    if (typeof deps.onHelpAction === 'function') deps.onHelpAction('agenda');
                    return;
                } else {
                    return;
                }
            } else if (d.moodLevel) {
                tapped = true;
                state = pickLevel(state, Number(d.moodLevel), new Date(now()).getHours());
                log();
            } else if (d.moodFeeling) {
                tapped = true;
                const next = toggleFeeling(state, d.moodFeeling);
                if (next !== state) { state = next; log(); }
            } else if (d.moodContext) {
                state = toggleContext(state, d.moodContext);
                log();
            } else if (btn.hasAttribute('data-mood-more')) {
                state = toggleMore(state);
            } else if (btn.hasAttribute('data-mood-note')) {
                // Journal Build A: a note on this check-in. The picker stays as it is; the note window opens on top.
                deps.onAddNote({ level: state.level, hour: new Date(now()).getHours() });
                return;
            } else {
                return;
            }
            render();
            if (typeof deps.onChange === 'function') deps.onChange(state);
        });
        render();
        return { getState: () => state };
    }

    /** "Who's playing?". onPick(avatarId) after a choice. Closing it without choosing just closes it (it asks again next open). */
    function openAvatarPicker(opts) {
        const o = opts || {};
        const overlay = Modal.open(avatarPickerHtml(), { dedupeSelector: '.avatar-picker-overlay' });
        if (!overlay) return null;
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest ? e.target.closest('[data-avatar]') : null;
            if (!btn) return;
            e.stopPropagation();
            overlay.remove();
            if (typeof o.onPick === 'function') o.onPick(btn.dataset.avatar);
        });
        return overlay;
    }

    /** The morning card. opts: { title?, deps } (deps as mount's). The button reads Skip until a face is tapped, then Done. */
    function openMoodCard(opts) {
        const o = opts || {};
        const overlay = Modal.open(moodCardHtml(o.title || 'How are you starting?'), { dedupeSelector: '.mood-card-overlay' });
        if (!overlay) return null;
        const done = overlay.querySelector('[data-mood-done]');
        const deps = Object.assign({}, o.deps, {
            onChange: (state) => { if (done && state.level) done.textContent = 'Done'; },
        });
        mount(overlay.querySelector('[data-mood-mount]'), deps);
        // Run-of-lows (Build B2): one gentle line above the faces when deps.getLows() has one (it stamps itself via onLowsShown).
        const lowsSlot = overlay.querySelector('[data-mood-lows]');
        const lowsLine = lowsSlot && typeof deps.getLows === 'function' ? deps.getLows() : null;
        if (lowsLine) {
            lowsSlot.innerHTML = lowsHtml(lowsLine);
            if (typeof deps.onLowsShown === 'function') deps.onLowsShown();
        }
        // Journal Build B (2026-11-13): "How did yesterday go?" when the evening card never got answered. deps.getYesterday() -> true when it is due
        // (it stamps itself via onYesterdayShown, so it appears one morning only); the button opens the late note window ON TOP of this card.
        const ySlot = overlay.querySelector('[data-mood-yesterday]');
        if (ySlot && typeof deps.getYesterday === 'function' && deps.getYesterday()) {
            ySlot.innerHTML = '<p class="mood-yesterday-row"><button type="button" class="secondary-button mood-yesterday-btn" data-mood-yesterday-btn>How did yesterday go?</button></p>';
            if (typeof deps.onYesterdayShown === 'function') deps.onYesterdayShown();
            const yb = ySlot.querySelector('[data-mood-yesterday-btn]');
            if (yb) {
                yb.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // One tick later: this click is still bubbling and Modal's dismiss handler must not see the new overlay.
                    setTimeout(() => { if (typeof deps.onYesterday === 'function') deps.onYesterday(); }, 0);
                });
            }
        }
        if (done) {
            done.addEventListener('click', (e) => {
                e.stopPropagation();
                overlay.remove();
            });
        }
        return overlay;
    }

    /** Put a face (from faceModel) on the level button's `.hud-avatar` span. Touches the DOM only when the face changed. */
    function renderAvatarFace(el, face) {
        if (!el || !face) return false;
        const sig = face.key + '|' + face.emoji + '|' + (face.art || '');
        if (el.dataset.face === sig) return false;
        el.dataset.face = sig;
        if (face.art) el.innerHTML = `<img class="hud-avatar-img" src="${esc(face.art)}" alt="" width="22" height="22">`;
        else el.textContent = face.emoji;
        return true;
    }

    return {
        initialState,
        pickLevel,
        toggleFeeling,
        toggleContext,
        toggleMore,
        faceModel,
        pickerHtml,
        avatarPickerHtml,
        moodCardHtml,
        helpHtml,
        lowsHtml,
        mount,
        openAvatarPicker,
        openMoodCard,
        renderAvatarFace,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MoodView;
}

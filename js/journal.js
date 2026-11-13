/**
 * Journal -- the pure core of the optional notes (Journal Build A, 2026-11-13; docs/JOURNAL_PLAN.md; DECISIONS 2026-11-13
 * "Journal: design").
 *
 * One store, one entry type. A note can be about an item (task / habit), a routine, the day, or the game in general. The store
 * lives in its OWN localStorage key (`deadline.journal`), never on the DailyRecord (which stays numbers-only), and is LIFETIME
 * data: Reset Game and a new run never touch it. Notes earn nothing.
 *
 * THE SAVED SHAPE IS A CONTRACT (docs/JOURNAL_PLAN.md "Data"):
 *   store = { v: 1, days: { "YYYY-MM-DD": [Entry, ...] } }   // the day a note is ABOUT, entries in time order
 *   Entry = { id, at, run, about, ref, src, text, mood, moodHour?, min?, late?, edited? }
 *     about: 'item' | 'routine' | 'day' | 'general'
 *     ref:   { kind: 'task'|'habit'|'routine', id, name, parentId? } | null   (name is a snapshot so a note survives a rename / delete)
 *     src:   'timer' | 'mood' | 'dayEnd' | 'manual' | 'complete'
 *     mood:  [level, feelingBits, contextBits] | null   (the day's latest check-in at the moment the note was saved)
 *
 * Theme-neutral (Baseline words). No DOM, no State, no CONFIG reads (the length cap is a parameter), so it unit-tests without a
 * browser. Every function that changes the store mutates it in place and returns the thing it made / the boolean it changed.
 */
const Journal = (() => {
    const V = 1;
    const DEFAULT_MAX_CHARS = 2000;
    const ABOUT = ['item', 'routine', 'day', 'general'];
    const SOURCES = ['timer', 'mood', 'dayEnd', 'manual', 'complete'];
    const REF_KINDS = ['task', 'habit', 'routine'];
    const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

    function fresh() { return { v: V, days: {} }; }

    function isDayKey(key) { return typeof key === 'string' && DAY_RE.test(key); }

    /** Trim and clamp. Returns '' for anything that is not a string or is only whitespace. */
    function cleanText(text, maxChars) {
        if (typeof text !== 'string') return '';
        const cap = (typeof maxChars === 'number' && maxChars > 0) ? Math.floor(maxChars) : DEFAULT_MAX_CHARS;
        const t = text.trim();
        return t.length > cap ? t.slice(0, cap).trim() : t;
    }

    function cleanRef(ref) {
        if (!ref || typeof ref !== 'object') return null;
        if (REF_KINDS.indexOf(ref.kind) === -1) return null;
        if (ref.id === undefined || ref.id === null || ref.id === '') return null;
        const out = { kind: ref.kind, id: ref.id, name: typeof ref.name === 'string' ? ref.name : '' };
        if (ref.parentId !== undefined && ref.parentId !== null && ref.parentId !== '') out.parentId = ref.parentId;
        return out;
    }

    function cleanMood(mood) {
        if (!Array.isArray(mood) || mood.length < 1) return null;
        const level = Number(mood[0]);
        if (!(level >= 1 && level <= 5) || Math.floor(level) !== level) return null;
        const bits = (v) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.floor(v) : 0);
        return [level, bits(mood[1]), bits(mood[2])];
    }

    /** [level, feelingBits, contextBits] of the day's LATEST check-in (highest hour), or null. `entries` = DailyRecord mood list. */
    function moodSnapshot(entries) {
        if (!Array.isArray(entries) || !entries.length) return null;
        let best = null;
        for (const e of entries) {
            if (!Array.isArray(e) || !(Number(e[1]) >= 1)) continue;
            if (!best || Number(e[0]) >= Number(best[0])) best = e;
        }
        return best ? cleanMood([best[1], best[2], best[3]]) : null;
    }

    function allIds(store) {
        const ids = new Set();
        for (const key of Object.keys(store.days)) for (const e of store.days[key]) ids.add(e.id);
        return ids;
    }

    function makeId(store, at) {
        const ids = allIds(store);
        let n = 1;
        while (ids.has(`j${at}-${n}`)) n++;
        return `j${at}-${n}`;
    }

    function byTime(a, b) { return (a.at - b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }

    /**
     * Add a note. input: { dayKey, text, about, ref?, src?, mood?, moodHour?, min?, late?, run? }; `now` = ms; `maxChars` optional.
     * Returns the new entry, or null when the text is empty or the day key is bad (nothing is stored).
     */
    function add(store, input, now, maxChars) {
        if (!store || !store.days || !input) return null;
        if (!isDayKey(input.dayKey)) return null;
        const text = cleanText(input.text, maxChars);
        if (!text) return null;
        const at = typeof now === 'number' && isFinite(now) ? Math.floor(now) : Date.now();
        const ref = cleanRef(input.ref);
        let about = ABOUT.indexOf(input.about) !== -1 ? input.about : (ref ? (ref.kind === 'routine' ? 'routine' : 'item') : 'general');
        if ((about === 'item' || about === 'routine') && !ref) about = 'general';
        const entry = {
            id: makeId(store, at),
            at,
            run: typeof input.run === 'number' && isFinite(input.run) ? Math.floor(input.run) : 0,
            about,
            ref: about === 'item' || about === 'routine' ? ref : null,
            src: SOURCES.indexOf(input.src) !== -1 ? input.src : 'manual',
            text,
            mood: cleanMood(input.mood),
        };
        if (typeof input.moodHour === 'number' && input.moodHour >= 0 && input.moodHour <= 23) entry.moodHour = Math.floor(input.moodHour);
        if (typeof input.min === 'number' && isFinite(input.min) && input.min >= 0) entry.min = Math.floor(input.min);
        if (input.late === true) entry.late = true;
        if (!Array.isArray(store.days[input.dayKey])) store.days[input.dayKey] = [];
        store.days[input.dayKey].push(entry);
        store.days[input.dayKey].sort(byTime);
        return entry;
    }

    /** Find an entry by id: { dayKey, index, entry } or null. */
    function find(store, id) {
        if (!store || !store.days) return null;
        for (const key of Object.keys(store.days)) {
            const list = store.days[key];
            for (let i = 0; i < list.length; i++) if (list[i].id === id) return { dayKey: key, index: i, entry: list[i] };
        }
        return null;
    }

    /** Change an entry's text. Empty text keeps the old text and returns false. Stamps `edited`. */
    function edit(store, id, text, now, maxChars) {
        const hit = find(store, id);
        const t = cleanText(text, maxChars);
        if (!hit || !t) return false;
        if (t === hit.entry.text) return false;
        hit.entry.text = t;
        hit.entry.edited = typeof now === 'number' && isFinite(now) ? Math.floor(now) : Date.now();
        return true;
    }

    /** Delete one entry (and its day when it was the last). Returns true when something went. */
    function remove(store, id) {
        const hit = find(store, id);
        if (!hit) return false;
        store.days[hit.dayKey].splice(hit.index, 1);
        if (!store.days[hit.dayKey].length) delete store.days[hit.dayKey];
        return true;
    }

    function withDay(dayKey, entry) { return Object.assign({ day: dayKey }, entry); }

    /** One day's entries, oldest first (copies with `day` added). */
    function forDay(store, dayKey) {
        const list = store && store.days && Array.isArray(store.days[dayKey]) ? store.days[dayKey] : [];
        return list.map((e) => withDay(dayKey, e));
    }

    function flat(store) {
        const out = [];
        if (!store || !store.days) return out;
        for (const key of Object.keys(store.days)) for (const e of store.days[key]) out.push(withDay(key, e));
        return out;
    }

    /** Newest first. */
    function newestFirst(list) { return list.slice().sort((a, b) => byTime(b, a)); }

    /** Every note about one task / habit / routine, newest first. Matches the ref id (and kind). */
    function forRef(store, kind, id) {
        return newestFirst(flat(store).filter((e) => e.ref && e.ref.kind === kind && String(e.ref.id) === String(id)));
    }

    /** Every note written during one run, newest first. */
    function forRun(store, run) { return newestFirst(flat(store).filter((e) => e.run === run)); }

    /** Notes whose about is 'general' (the game itself), newest first. */
    function forGame(store) { return newestFirst(flat(store).filter((e) => e.about === 'general')); }

    function count(store) {
        let n = 0;
        if (store && store.days) for (const key of Object.keys(store.days)) n += store.days[key].length;
        return n;
    }

    function countDay(store, dayKey) {
        return store && store.days && Array.isArray(store.days[dayKey]) ? store.days[dayKey].length : 0;
    }

    /**
     * Make a loaded / imported value safe: a fresh store when it is not one, only well-formed day keys, only entries with text,
     * text clamped, unknown `about` -> 'general', unknown `src` -> 'manual', ids unique, entries in time order. Unknown extra fields
     * on an entry are kept as they are. Never throws.
     */
    function sanitize(raw, maxChars) {
        const out = fresh();
        if (!raw || typeof raw !== 'object' || !raw.days || typeof raw.days !== 'object') return out;
        const seen = new Set();
        for (const key of Object.keys(raw.days)) {
            if (!isDayKey(key) || !Array.isArray(raw.days[key])) continue;
            const list = [];
            for (const e of raw.days[key]) {
                if (!e || typeof e !== 'object') continue;
                const text = cleanText(e.text, maxChars);
                if (!text) continue;
                const at = typeof e.at === 'number' && isFinite(e.at) ? Math.floor(e.at) : 0;
                const ref = cleanRef(e.ref);
                let about = ABOUT.indexOf(e.about) !== -1 ? e.about : 'general';
                if ((about === 'item' || about === 'routine') && !ref) about = 'general';
                let id = typeof e.id === 'string' && e.id ? e.id : '';
                if (!id || seen.has(id)) {
                    let n = 1;
                    while (seen.has(`j${at}-${n}`)) n++;
                    id = `j${at}-${n}`;
                }
                seen.add(id);
                const clean = Object.assign({}, e, {
                    id,
                    at,
                    run: typeof e.run === 'number' && isFinite(e.run) ? Math.floor(e.run) : 0,
                    about,
                    ref: about === 'item' || about === 'routine' ? ref : null,
                    src: SOURCES.indexOf(e.src) !== -1 ? e.src : 'manual',
                    text,
                    mood: cleanMood(e.mood),
                });
                list.push(clean);
            }
            if (list.length) { list.sort(byTime); out.days[key] = list; }
        }
        return out;
    }

    /** Merge `incoming` into `local` (both sanitized stores): union by day, then by entry id. An id already in `local` is NEVER overwritten. */
    function merge(local, incoming, maxChars) {
        const base = sanitize(local, maxChars);
        const extra = sanitize(incoming, maxChars);
        const ids = allIds(base);
        let added = 0;
        for (const key of Object.keys(extra.days)) {
            for (const e of extra.days[key]) {
                if (ids.has(e.id)) continue;
                if (!Array.isArray(base.days[key])) base.days[key] = [];
                base.days[key].push(e);
                ids.add(e.id);
                added++;
            }
            if (base.days[key]) base.days[key].sort(byTime);
        }
        return { store: base, added };
    }

    /** Approximate stored size in characters (for the Journal window's size line, Build B). */
    function sizeChars(store) { try { return JSON.stringify(store).length; } catch (e) { return 0; } }

    return {
        V, DEFAULT_MAX_CHARS, ABOUT, SOURCES, REF_KINDS,
        fresh, isDayKey, cleanText, moodSnapshot, add, find, edit, remove,
        forDay, forRef, forRun, forGame, count, countDay, sanitize, merge, sizeChars,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Journal;
}

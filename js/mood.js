/**
 * Mood -- the pure core of the mood check-in (W1b Build A, 2026-11-13; docs/WORLD_FEEDBACK_PLAN.md "W1b Mood check-in" + its
 * "as built" note; DECISIONS 2026-11-13 (mood check-in)).
 *
 * One check-in = ONE required tap (a level 1..5) plus up to MAX_FEELINGS optional feeling words plus any context words. Mood is
 * purely informational: it earns nothing and never changes the scene (the sky stays the run climate).
 *
 * THE SAVED SHAPE IS A CONTRACT. A day's record keeps `mood: [[hour, level, feelingBits, contextBits], ...]`
 * (js/dailyRecord.js v15):
 *   - level: 1..5 (Awful 1 ... Rad 5).
 *   - feelingBits / contextBits: bit i set = the i-th id of FEELINGS / CONTEXT below.
 *   The ORDER of FEELINGS and CONTEXT is the bit index and is APPEND-ONLY: add new words at the END, never reorder, never remove
 *   (test/mood.test.js pins the current lists). Which level a feeling is suggested under is display-only and may change freely.
 *
 * Theme-neutral (Baseline words): no zombie / church words here. A theme may rename the labels later; the ids are the contract.
 * No DOM, no State, no CONFIG reads (the feeling cap is a parameter), so it unit-tests without a browser.
 */
const Mood = (() => {
    // Level 5 is the best. Listed best-first: that is the order the picker shows them in.
    const LEVELS = [
        { level: 5, key: 'rad', label: 'Rad', emoji: '😄' },
        { level: 4, key: 'good', label: 'Good', emoji: '🙂' },
        { level: 3, key: 'meh', label: 'Meh', emoji: '😐' },
        { level: 2, key: 'bad', label: 'Bad', emoji: '🙁' },
        { level: 1, key: 'awful', label: 'Awful', emoji: '😫' },
    ];

    // Feeling words, in BIT ORDER (append-only). `level` = the face this word is suggested under; any word can be picked from any level.
    const FEELINGS = [
        { id: 'fired_up', label: 'Fired up', level: 5 },
        { id: 'focused', label: 'Focused', level: 5 },
        { id: 'excited', label: 'Excited', level: 5 },
        { id: 'proud', label: 'Proud', level: 5 },
        { id: 'motivated', label: 'Motivated', level: 4 },
        { id: 'calm', label: 'Calm', level: 4 },
        { id: 'content', label: 'Content', level: 4 },
        { id: 'hopeful', label: 'Hopeful', level: 4 },
        { id: 'blah', label: 'Blah', level: 3 },
        { id: 'distracted', label: 'Distracted', level: 3 },
        { id: 'tired', label: 'Tired', level: 3 },
        { id: 'unmotivated', label: 'Unmotivated', level: 2 },
        { id: 'anxious', label: 'Anxious', level: 2 },
        { id: 'stressed', label: 'Stressed', level: 2 },
        { id: 'sad', label: 'Sad', level: 2 },
        { id: 'frustrated', label: 'Frustrated', level: 2 },
        { id: 'overwhelmed', label: 'Overwhelmed', level: 1 },
        { id: 'exhausted', label: 'Exhausted', level: 1 },
        { id: 'down', label: 'Down', level: 1 },
        { id: 'angry', label: 'Angry', level: 1 },
    ];

    // What is going on around the feeling, in BIT ORDER (append-only). No limit on how many are picked.
    const CONTEXT = [
        { id: 'sick', label: 'Sick' },
        { id: 'slept_badly', label: 'Slept badly' },
        { id: 'busy_day', label: 'Busy day' },
        { id: 'traveling', label: 'Traveling' },
        { id: 'day_off', label: 'Day off' },
    ];

    const MAX_FEELINGS = 2;
    const FEELING_MASK = Math.pow(2, FEELINGS.length) - 1;
    const CONTEXT_MASK = Math.pow(2, CONTEXT.length) - 1;

    // Avatars the player can choose between at the start (the level button shows the avatar's face). `emoji` is the placeholder for
    // "no mood logged yet" until the PixelLab art lands; the level faces above are shared by both avatars until then.
    const AVATARS = [
        { id: 'male', label: 'Male', emoji: '👨' },
        { id: 'female', label: 'Female', emoji: '👩' },
    ];
    const NO_AVATAR_EMOJI = '🙂';
    const ART_DIR = 'Assets/Avatars/';

    // ---- lookups ---------------------------------------------------------------------------------------------------------

    function isLevel(n) { return Number.isInteger(n) && n >= 1 && n <= 5; }
    function levelInfo(level) { return LEVELS.find((l) => l.level === level) || null; }
    function isAvatar(id) { return AVATARS.some((a) => a.id === id); }
    function avatarInfo(id) { return AVATARS.find((a) => a.id === id) || null; }
    function feelingInfo(id) { return FEELINGS.find((f) => f.id === id) || null; }
    function contextInfo(id) { return CONTEXT.find((c) => c.id === id) || null; }

    /** Feelings suggested under a level, in list order. */
    function suggestionsFor(level) { return FEELINGS.filter((f) => f.level === level); }
    /** Every other feeling (the "More" list), in list order. */
    function moreFor(level) { return FEELINGS.filter((f) => f.level !== level); }

    // ---- bits ------------------------------------------------------------------------------------------------------------

    function cleanIds(list, table, cap) {
        const out = [];
        (Array.isArray(list) ? list : []).forEach((id) => {
            if (typeof id !== 'string' || out.indexOf(id) >= 0 || !table.some((t) => t.id === id)) return;
            if (cap == null || out.length < cap) out.push(id);
        });
        return out;
    }

    function cleanFeelings(ids, cap) { return cleanIds(ids, FEELINGS, cap == null ? MAX_FEELINGS : cap); }
    function cleanContext(ids) { return cleanIds(ids, CONTEXT, null); }

    function pack(ids, table) {
        let bits = 0;
        ids.forEach((id) => {
            const i = table.findIndex((t) => t.id === id);
            if (i >= 0) bits += Math.pow(2, i);
        });
        return bits;
    }

    function unpack(bits, table) {
        const out = [];
        let n = Number.isInteger(bits) && bits > 0 ? bits : 0;
        for (let i = 0; i < table.length; i++) {
            if (n % 2 === 1) out.push(table[i].id);
            n = Math.floor(n / 2);
        }
        return out;
    }

    function packFeelings(ids, cap) { return pack(cleanFeelings(ids, cap), FEELINGS); }
    function packContext(ids) { return pack(cleanContext(ids), CONTEXT); }
    /** Ids for saved bits, in list order. Bits past the known list (a later version's words) are ignored. */
    function unpackFeelings(bits) { return unpack(bits, FEELINGS); }
    function unpackContext(bits) { return unpack(bits, CONTEXT); }

    // ---- entries ---------------------------------------------------------------------------------------------------------

    /**
     * One saved entry: [hour, level, feelingBits, contextBits]. `parts` = { hour, level, feelings: [ids], context: [ids] }.
     * Returns null for a bad hour (not 0..23) or a bad level.
     */
    function makeEntry(parts) {
        const p = parts || {};
        if (!Number.isInteger(p.hour) || p.hour < 0 || p.hour > 23 || !isLevel(p.level)) return null;
        return [p.hour, p.level, packFeelings(p.feelings), packContext(p.context)];
    }

    function entryParts(entry) {
        if (!Array.isArray(entry)) return null;
        return { hour: entry[0], level: entry[1], feelings: unpackFeelings(entry[2]), context: unpackContext(entry[3]) };
    }

    function validEntry(e) {
        return Array.isArray(e) && Number.isInteger(e[0]) && e[0] >= 0 && e[0] <= 23 && isLevel(e[1]) &&
            Number.isInteger(e[2]) && e[2] >= 0 && e[2] <= FEELING_MASK && Number.isInteger(e[3]) && e[3] >= 0 && e[3] <= CONTEXT_MASK;
    }

    /**
     * Add an entry to a day's log. A new entry in the SAME local hour replaces that hour's entry (fiddling does not log six rows);
     * the log stays sorted by hour. Returns a new array; the input is not touched. A bad entry returns the log unchanged.
     */
    function mergeEntry(entries, entry) {
        const base = Array.isArray(entries) ? entries.filter(validEntry) : [];
        if (!validEntry(entry)) return base.slice();
        return base.filter((e) => e[0] !== entry[0]).concat([entry.slice(0, 4)]).sort((a, b) => a[0] - b[0]);
    }

    /** A log read from disk or an import: only well-formed entries, one per hour (the later one wins), sorted by hour. */
    function sanitizeEntries(raw) {
        const list = Array.isArray(raw) ? raw : [];
        return list.reduce((acc, e) => (validEntry(e) ? mergeEntry(acc, e) : acc), []);
    }

    /** The most recent entry of the day (the highest hour), or null. */
    function latest(entries) {
        const list = sanitizeEntries(entries);
        return list.length ? list[list.length - 1] : null;
    }

    /**
     * What a day's log says, derived at read and never stored: { count, first, last, min, max } (levels), or null for no entries.
     * `first` is the morning level, `last` the closing one.
     */
    function derive(entries) {
        const list = sanitizeEntries(entries);
        if (!list.length) return null;
        const levels = list.map((e) => e[1]);
        return { count: list.length, first: levels[0], last: levels[levels.length - 1], min: Math.min.apply(null, levels), max: Math.max.apply(null, levels) };
    }

    /** Entries per level as [Awful, Bad, Meh, Good, Rad] (index = level - 1): the shape the month roll-up keeps. */
    function histogram(entries) {
        const h = [0, 0, 0, 0, 0];
        sanitizeEntries(entries).forEach((e) => { h[e[1] - 1] += 1; });
        return h;
    }

    // ---- the face --------------------------------------------------------------------------------------------------------

    /**
     * The avatar's face for the level button: { key, emoji, art, label }.
     *   key   'neutral' (no mood logged today) or the level's key ('rad' ... 'awful'): the art file is `<avatar>_<key>.png`.
     *   emoji the placeholder shown until art exists. Before any mood it is the avatar's own person emoji (so the Male / Female
     *         choice is visible); after one it is that level's face (the same for both avatars until the PixelLab art lands).
     *   art   `Assets/Avatars/<avatar>_<key>.png` when opts.artReady and an avatar is chosen, else null.
     * `level` = today's latest level (1..5), or null / anything else for none.
     */
    function faceFor(avatar, level, opts) {
        const o = opts || {};
        const av = avatarInfo(avatar);
        const lv = isLevel(level) ? levelInfo(level) : null;
        const key = lv ? lv.key : 'neutral';
        return {
            key,
            emoji: lv ? lv.emoji : (av ? av.emoji : NO_AVATAR_EMOJI),
            art: o.artReady && av ? ART_DIR + av.id + '_' + key + '.png' : null,
            label: lv ? lv.label : 'No mood yet',
        };
    }

    return {
        LEVELS,
        FEELINGS,
        CONTEXT,
        AVATARS,
        MAX_FEELINGS,
        FEELING_MASK,
        CONTEXT_MASK,
        isLevel,
        levelInfo,
        isAvatar,
        avatarInfo,
        feelingInfo,
        contextInfo,
        suggestionsFor,
        moreFor,
        cleanFeelings,
        cleanContext,
        packFeelings,
        packContext,
        unpackFeelings,
        unpackContext,
        makeEntry,
        entryParts,
        validEntry,
        mergeEntry,
        sanitizeEntries,
        latest,
        derive,
        histogram,
        faceFor,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Mood;
}

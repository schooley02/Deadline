/**
 * Mood core (W1b Build A, 2026-11-13; docs/WORLD_FEEDBACK_PLAN.md "W1b Mood check-in"). Pure: levels, the append-only feeling /
 * context lists, the saved entry shape, merge-by-hour, derived first / last / min / max, the histogram, and the avatar face.
 */
const Mood = require('../js/mood.js');

describe('the word lists are a saved contract (append-only)', () => {
    test('feelings keep their bit order', () => {
        expect(Mood.FEELINGS.map((f) => f.id)).toEqual([
            'fired_up', 'focused', 'excited', 'proud',
            'motivated', 'calm', 'content', 'hopeful',
            'blah', 'distracted', 'tired',
            'unmotivated', 'anxious', 'stressed', 'sad', 'frustrated',
            'overwhelmed', 'exhausted', 'down', 'angry',
        ]);
    });
    test('context words keep their bit order', () => {
        expect(Mood.CONTEXT.map((c) => c.id)).toEqual(['sick', 'slept_badly', 'busy_day', 'traveling', 'day_off']);
    });
    test('five levels, best first, stored 5..1', () => {
        expect(Mood.LEVELS.map((l) => [l.level, l.label])).toEqual([[5, 'Rad'], [4, 'Good'], [3, 'Meh'], [2, 'Bad'], [1, 'Awful']]);
    });
    test('every feeling is suggested under a real level; each level has suggestions', () => {
        Mood.FEELINGS.forEach((f) => expect(Mood.isLevel(f.level)).toBe(true));
        Mood.LEVELS.forEach((l) => expect(Mood.suggestionsFor(l.level).length).toBeGreaterThan(0));
        expect(Mood.suggestionsFor(2).map((f) => f.id)).toEqual(['unmotivated', 'anxious', 'stressed', 'sad', 'frustrated']);
    });
    test('suggestions + the More list cover every feeling exactly once', () => {
        Mood.LEVELS.forEach((l) => {
            const ids = Mood.suggestionsFor(l.level).concat(Mood.moreFor(l.level)).map((f) => f.id).sort();
            expect(ids).toEqual(Mood.FEELINGS.map((f) => f.id).sort());
        });
    });
    test('ids are unique and the masks fit the lists', () => {
        expect(new Set(Mood.FEELINGS.map((f) => f.id)).size).toBe(Mood.FEELINGS.length);
        expect(Mood.FEELING_MASK).toBe(Math.pow(2, 20) - 1);
        expect(Mood.CONTEXT_MASK).toBe(31);
    });
});

describe('packing words into bits', () => {
    test('a word is its list position as a bit', () => {
        expect(Mood.packFeelings(['fired_up'])).toBe(1);
        expect(Mood.packFeelings(['focused'])).toBe(2);
        expect(Mood.packFeelings(['angry'])).toBe(Math.pow(2, 19));
        expect(Mood.packContext(['sick', 'day_off'])).toBe(1 + 16);
    });
    test('unpack returns list order whatever order they were picked in', () => {
        const bits = Mood.packFeelings(['tired', 'proud']);
        expect(Mood.unpackFeelings(bits)).toEqual(['proud', 'tired']);
        expect(Mood.unpackContext(Mood.packContext(['busy_day', 'sick']))).toEqual(['sick', 'busy_day']);
    });
    test('feelings are capped at two (the first two kept); context has no cap', () => {
        expect(Mood.cleanFeelings(['a', 'tired', 'tired', 'proud', 'angry'])).toEqual(['tired', 'proud']);
        expect(Mood.unpackFeelings(Mood.packFeelings(['tired', 'proud', 'angry']))).toEqual(['proud', 'tired']);
        expect(Mood.cleanContext(['sick', 'sick', 'traveling', 'nope', 'day_off', 'busy_day', 'slept_badly']).length).toBe(5);
    });
    test('junk packs to nothing and unpacks to nothing', () => {
        expect(Mood.packFeelings(null)).toBe(0);
        expect(Mood.packFeelings([1, {}, 'nope'])).toBe(0);
        expect(Mood.unpackFeelings(-3)).toEqual([]);
        expect(Mood.unpackFeelings('x')).toEqual([]);
        expect(Mood.unpackContext(1.5)).toEqual([]);
    });
    test('bits past the known list (a later version) are ignored, not thrown on', () => {
        expect(Mood.unpackContext(31 + 64)).toEqual(['sick', 'slept_badly', 'busy_day', 'traveling', 'day_off']);
    });
});

describe('entries', () => {
    test('an entry is [hour, level, feelingBits, contextBits]', () => {
        expect(Mood.makeEntry({ hour: 9, level: 4, feelings: ['calm'], context: ['sick'] })).toEqual([9, 4, 32, 1]);
        expect(Mood.entryParts([9, 4, 32, 1])).toEqual({ hour: 9, level: 4, feelings: ['calm'], context: ['sick'] });
    });
    test('a bad hour or level makes no entry', () => {
        [{ hour: 24, level: 3 }, { hour: -1, level: 3 }, { hour: 1.5, level: 3 }, { hour: 9, level: 0 }, { hour: 9, level: 6 }, { hour: 9 }, null, undefined]
            .forEach((p) => expect(Mood.makeEntry(p)).toBeNull());
        expect(Mood.entryParts('x')).toBeNull();
    });
    test('the same local hour REPLACES that hour; other hours are kept, in hour order', () => {
        let log = [];
        log = Mood.mergeEntry(log, [14, 3, 0, 0]);
        log = Mood.mergeEntry(log, [8, 5, 1, 0]);
        log = Mood.mergeEntry(log, [14, 2, 0, 0]);
        expect(log).toEqual([[8, 5, 1, 0], [14, 2, 0, 0]]);
    });
    test('merging never mutates the log it was given, and a bad entry changes nothing', () => {
        const log = [[8, 5, 1, 0]];
        const out = Mood.mergeEntry(log, [9, 4, 0, 0]);
        expect(log).toEqual([[8, 5, 1, 0]]);
        expect(out).toEqual([[8, 5, 1, 0], [9, 4, 0, 0]]);
        expect(Mood.mergeEntry(log, [9, 9, 0, 0])).toEqual([[8, 5, 1, 0]]);
        expect(Mood.mergeEntry(null, [9, 4, 0, 0])).toEqual([[9, 4, 0, 0]]);
    });
    test('sanitize keeps well-formed entries, one per hour (the later wins), sorted', () => {
        const raw = [[20, 2, 0, 0], 'x', [8, 4, 0, 0], [8, 3, 0, 0], [25, 3, 0, 0], [9, 7, 0, 0], [10, 3, -1, 0], [11, 3, 0, 99]];
        expect(Mood.sanitizeEntries(raw)).toEqual([[8, 3, 0, 0], [20, 2, 0, 0]]);
        expect(Mood.sanitizeEntries(null)).toEqual([]);
    });
});

describe('derived at read, never stored', () => {
    const log = [[7, 4, 0, 0], [12, 2, 0, 0], [21, 3, 0, 0]];
    test('first / last / min / max / count', () => {
        expect(Mood.derive(log)).toEqual({ count: 3, first: 4, last: 3, min: 2, max: 4 });
    });
    test('one entry is its own first and last; no entries = null', () => {
        expect(Mood.derive([[9, 5, 0, 0]])).toEqual({ count: 1, first: 5, last: 5, min: 5, max: 5 });
        expect(Mood.derive([])).toBeNull();
        expect(Mood.derive(undefined)).toBeNull();
    });
    test('latest is the highest hour', () => {
        expect(Mood.latest(log)).toEqual([21, 3, 0, 0]);
        expect(Mood.latest([])).toBeNull();
    });
    test('the histogram counts entries per level, index = level - 1', () => {
        expect(Mood.histogram(log)).toEqual([0, 1, 1, 1, 0]);
        expect(Mood.histogram([[1, 5, 0, 0], [2, 5, 0, 0]])).toEqual([0, 0, 0, 0, 2]);
        expect(Mood.histogram(null)).toEqual([0, 0, 0, 0, 0]);
    });
});

describe('the avatar face', () => {
    test('before any mood it is the avatar itself, so the Male / Female choice shows', () => {
        expect(Mood.faceFor('male', null)).toMatchObject({ key: 'neutral', emoji: '👨', art: null, label: 'No mood yet' });
        expect(Mood.faceFor('female', undefined).emoji).toBe('👩');
    });
    test('no avatar chosen yet shows a plain face', () => {
        expect(Mood.faceFor(null, null).emoji).toBe('🙂');
        expect(Mood.faceFor('robot', null).emoji).toBe('🙂');
    });
    test('with a mood it is that level\'s face', () => {
        expect(Mood.faceFor('male', 5)).toMatchObject({ key: 'rad', emoji: '😄', label: 'Rad' });
        expect(Mood.faceFor('female', 1)).toMatchObject({ key: 'awful', emoji: '😫' });
        expect(Mood.faceFor('female', 3).emoji).toBe('😐');
    });
    test('the art path is built only when the art is ready and an avatar is chosen', () => {
        expect(Mood.faceFor('male', 5, { artReady: true }).art).toBe('Assets/Avatars/male_rad.png');
        expect(Mood.faceFor('female', null, { artReady: true }).art).toBe('Assets/Avatars/female_neutral.png');
        expect(Mood.faceFor(null, 5, { artReady: true }).art).toBeNull();
        expect(Mood.faceFor('male', 5, { artReady: false }).art).toBeNull();
    });
    test('two avatars, both known', () => {
        expect(Mood.AVATARS.map((a) => a.id)).toEqual(['male', 'female']);
        expect(Mood.isAvatar('male')).toBe(true);
        expect(Mood.isAvatar('x')).toBe(false);
    });
});

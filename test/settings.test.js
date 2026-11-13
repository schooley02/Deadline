/**
 * Settings tests ([P2-UI-009] Milestone 4, session 59, 2026-07-19).
 *
 * testEnvironment is 'node' (jest.config.js), so there's no ambient
 * `localStorage` global the way a browser/jsdom provides one — per
 * test/setup.js's documented convention, each test file binds whatever
 * globals it needs itself. A tiny in-memory Map-backed stub is enough to
 * exercise Settings.load/save's real code paths (JSON parse/stringify,
 * validation, try/catch fallback) without needing jsdom for this file.
 */
function makeLocalStorageStub() {
    const store = new Map();
    return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
    };
}

// Fake DOM element exposing just enough of classList for
// applyEffectsIntensity — a Set-backed stand-in, no jsdom needed.
function makeFakeBodyEl() {
    const classes = new Set();
    return {
        classList: {
            add: (c) => classes.add(c),
            remove: (c) => classes.delete(c),
            contains: (c) => classes.has(c),
        },
        _classes: classes,
    };
}

let Settings;

beforeEach(() => {
    jest.resetModules();
    global.localStorage = makeLocalStorageStub();
    Settings = require('../js/settings.js');
});

afterEach(() => {
    delete global.localStorage;
});

describe('Settings.load', () => {
    test('returns the default (full) when nothing is stored', () => {
        expect(Settings.load()).toEqual({ effectsIntensity: 'full', eveningCheckTime: '21:00', timerHintSeen: false, devTools: false, screenBuzz: true, avatar: null, moodCardDay: null, noteOnTimerStop: true });
    });

    test('round-trips a saved value', () => {
        Settings.save({ effectsIntensity: 'reduced' });
        expect(Settings.load()).toEqual({ effectsIntensity: 'reduced', eveningCheckTime: '21:00', timerHintSeen: false, devTools: false, screenBuzz: true, avatar: null, moodCardDay: null, noteOnTimerStop: true });
    });

    test('falls back to full for an invalid stored value (defensive)', () => {
        global.localStorage.setItem('deadline.settings', JSON.stringify({ effectsIntensity: 'nonsense' }));
        expect(Settings.load()).toEqual({ effectsIntensity: 'full', eveningCheckTime: '21:00', timerHintSeen: false, devTools: false, screenBuzz: true, avatar: null, moodCardDay: null, noteOnTimerStop: true });
    });

    test('falls back to full for corrupt JSON (never breaks gameplay)', () => {
        global.localStorage.setItem('deadline.settings', '{not valid json');
        expect(Settings.load()).toEqual({ effectsIntensity: 'full', eveningCheckTime: '21:00', timerHintSeen: false, devTools: false, screenBuzz: true, avatar: null, moodCardDay: null, noteOnTimerStop: true });
    });
});

describe('Settings.save', () => {
    test('returns true on success', () => {
        expect(Settings.save({ effectsIntensity: 'off' })).toBe(true);
    });

    test('returns false (never throws) when localStorage.setItem fails', () => {
        global.localStorage.setItem = () => { throw new Error('quota exceeded'); };
        expect(Settings.save({ effectsIntensity: 'off' })).toBe(false);
    });
});

describe('Settings.bodyClassesForIntensity (pure)', () => {
    test('full adds nothing and clears both other classes', () => {
        expect(Settings.bodyClassesForIntensity('full')).toEqual({ add: [], remove: ['fx-off', 'fx-reduced'] });
    });

    test('reduced adds fx-reduced and clears fx-off', () => {
        expect(Settings.bodyClassesForIntensity('reduced')).toEqual({ add: ['fx-reduced'], remove: ['fx-off'] });
    });

    test('off adds fx-off and clears fx-reduced', () => {
        expect(Settings.bodyClassesForIntensity('off')).toEqual({ add: ['fx-off'], remove: ['fx-reduced'] });
    });
});

describe('Settings.applyEffectsIntensity (DOM wrapper)', () => {
    test('off adds fx-off, no fx-reduced', () => {
        const el = makeFakeBodyEl();
        Settings.applyEffectsIntensity('off', el);
        expect(el.classList.contains('fx-off')).toBe(true);
        expect(el.classList.contains('fx-reduced')).toBe(false);
    });

    test('switching from off to full removes fx-off again', () => {
        const el = makeFakeBodyEl();
        Settings.applyEffectsIntensity('off', el);
        Settings.applyEffectsIntensity('full', el);
        expect(el.classList.contains('fx-off')).toBe(false);
        expect(el.classList.contains('fx-reduced')).toBe(false);
    });

    test('a missing element is a safe no-op (no throw)', () => {
        expect(() => Settings.applyEffectsIntensity('off', null)).not.toThrow();
    });
});

describe('Settings timerHintSeen (2026-11-02)', () => {
    beforeEach(() => { localStorage.clear(); });

    test('defaults to false, saves true, and a later save of another field keeps it', () => {
        expect(Settings.load().timerHintSeen).toBe(false);
        Settings.save({ timerHintSeen: true });
        expect(Settings.load().timerHintSeen).toBe(true);
        Settings.save({ effectsIntensity: 'reduced' });
        expect(Settings.load().timerHintSeen).toBe(true);
    });

    test('anything but a real true is false', () => {
        localStorage.setItem(Settings.SETTINGS_KEY, JSON.stringify({ timerHintSeen: 'yes' }));
        expect(Settings.load().timerHintSeen).toBe(false);
    });
});

describe('Settings devTools (2026-11-03)', () => {
    beforeEach(() => { localStorage.clear(); });

    test('is off by default', () => {
        expect(Settings.DEFAULTS.devTools).toBe(false);
        expect(Settings.load().devTools).toBe(false);
    });

    test('saves true, survives a save of another field, and can be turned off again', () => {
        Settings.save({ devTools: true });
        expect(Settings.load().devTools).toBe(true);
        Settings.save({ effectsIntensity: 'reduced' });
        expect(Settings.load().devTools).toBe(true);
        Settings.save({ devTools: false, screenBuzz: true, avatar: null, moodCardDay: null });
        expect(Settings.load().devTools).toBe(false);
    });

    test('anything but a real true is false (a string, a number, a missing key)', () => {
        ['yes', 1, 'true', null].forEach((v) => {
            localStorage.setItem(Settings.SETTINGS_KEY, JSON.stringify({ devTools: v }));
            expect(Settings.load().devTools).toBe(false);
        });
        localStorage.setItem(Settings.SETTINGS_KEY, JSON.stringify({ effectsIntensity: 'off' }));
        expect(Settings.load().devTools).toBe(false);
    });

    test('an older stored settings object (no devTools key) loads with it off and keeps its other fields', () => {
        localStorage.setItem(Settings.SETTINGS_KEY, JSON.stringify({ effectsIntensity: 'reduced', eveningCheckTime: '20:30', timerHintSeen: true }));
        expect(Settings.load()).toEqual({ effectsIntensity: 'reduced', eveningCheckTime: '20:30', timerHintSeen: true, devTools: false, screenBuzz: true, avatar: null, moodCardDay: null, noteOnTimerStop: true });
    });

    test('what is WRITTEN is a real boolean even if a caller passes something else', () => {
        ['yes', 1, 'true', {}].forEach((v) => {
            Settings.save({ devTools: v });
            expect(JSON.parse(localStorage.getItem(Settings.SETTINGS_KEY)).devTools).toBe(false);
        });
        Settings.save({ devTools: true });
        expect(JSON.parse(localStorage.getItem(Settings.SETTINGS_KEY)).devTools).toBe(true);
    });

    test('a failed save never throws and reports false', () => {
        global.localStorage.setItem = () => { throw new Error('quota'); };
        expect(Settings.save({ devTools: true })).toBe(false);
    });
});

describe('Settings screenBuzz (2026-11-10)', () => {
    beforeEach(() => { localStorage.clear(); });

    test('is ON by default', () => {
        expect(Settings.DEFAULTS.screenBuzz).toBe(true);
        expect(Settings.load().screenBuzz).toBe(true);
    });

    test('only a real false turns it off; it survives a save of another field and can be turned on again', () => {
        Settings.save({ screenBuzz: false });
        expect(Settings.load().screenBuzz).toBe(false);
        Settings.save({ effectsIntensity: 'reduced' });
        expect(Settings.load().screenBuzz).toBe(false);
        Settings.save({ screenBuzz: true });
        expect(Settings.load().screenBuzz).toBe(true);
        localStorage.setItem(Settings.SETTINGS_KEY, JSON.stringify({ screenBuzz: 'no' }));
        expect(Settings.load().screenBuzz).toBe(true);
    });
});

describe('Settings avatar + moodCardDay (Mood Build A, 2026-11-13)', () => {
    test('both start empty (no avatar chosen yet, no card shown yet)', () => {
        expect(Settings.DEFAULTS.avatar).toBeNull();
        expect(Settings.DEFAULTS.moodCardDay).toBeNull();
        expect(Settings.load().avatar).toBeNull();
        expect(Settings.load().moodCardDay).toBeNull();
    });
    test('the valid avatars mirror Mood.AVATARS', () => {
        const Mood = require('../js/mood.js');
        expect(Settings.VALID_AVATARS).toEqual(Mood.AVATARS.map((a) => a.id));
    });
    test('an avatar and a day round-trip; saving one field keeps the other', () => {
        Settings.save({ avatar: 'female' });
        Settings.save({ moodCardDay: '2026-11-13' });
        expect(Settings.load().avatar).toBe('female');
        expect(Settings.load().moodCardDay).toBe('2026-11-13');
        Settings.save({ effectsIntensity: 'off' });
        expect(Settings.load().avatar).toBe('female');
        expect(Settings.load().moodCardDay).toBe('2026-11-13');
    });
    test('bad values read back as empty and a bad save never stores them', () => {
        localStorage.setItem(Settings.SETTINGS_KEY, JSON.stringify({ avatar: 'robot', moodCardDay: 'yesterday' }));
        expect(Settings.load().avatar).toBeNull();
        expect(Settings.load().moodCardDay).toBeNull();
        Settings.save({ avatar: 'robot', moodCardDay: 7 });
        expect(JSON.parse(localStorage.getItem(Settings.SETTINGS_KEY)).avatar).toBeNull();
        expect(JSON.parse(localStorage.getItem(Settings.SETTINGS_KEY)).moodCardDay).toBeNull();
        expect(Settings.cleanAvatar('male')).toBe('male');
        expect(Settings.cleanAvatar(null)).toBeNull();
    });
});

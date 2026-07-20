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
        expect(Settings.load()).toEqual({ effectsIntensity: 'full' });
    });

    test('round-trips a saved value', () => {
        Settings.save({ effectsIntensity: 'reduced' });
        expect(Settings.load()).toEqual({ effectsIntensity: 'reduced' });
    });

    test('falls back to full for an invalid stored value (defensive)', () => {
        global.localStorage.setItem('deadline.settings', JSON.stringify({ effectsIntensity: 'nonsense' }));
        expect(Settings.load()).toEqual({ effectsIntensity: 'full' });
    });

    test('falls back to full for corrupt JSON (never breaks gameplay)', () => {
        global.localStorage.setItem('deadline.settings', '{not valid json');
        expect(Settings.load()).toEqual({ effectsIntensity: 'full' });
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

/**
 * SettingsView.isDevMode (V3a, 2026-07-21) — gates the Settings window's
 * Reset Game section so it isn't unconditionally visible to every player
 * on the live GitHub Pages build. Pure/location-injected, so it's tested
 * directly here without jsdom (this suite runs under testEnvironment:
 * 'node' per jest.config.js — see test/settings.test.js's header note for
 * the same convention).
 */
const SettingsView = require('../js/ui/settingsView.js');

describe('SettingsView.isDevMode', () => {
    test('true on localhost (any port)', () => {
        expect(SettingsView.isDevMode({ hostname: 'localhost', search: '' })).toBe(true);
        expect(SettingsView.isDevMode({ hostname: 'localhost', search: '', port: '8000' })).toBe(true);
    });

    test('true on 127.0.0.1', () => {
        expect(SettingsView.isDevMode({ hostname: '127.0.0.1', search: '' })).toBe(true);
    });

    test('true on any origin with a ?dev query param', () => {
        expect(SettingsView.isDevMode({ hostname: 'schooley02.github.io', search: '?dev' })).toBe(true);
        expect(SettingsView.isDevMode({ hostname: 'schooley02.github.io', search: '?dev=1&foo=bar' })).toBe(true);
    });

    test('false on the live Pages origin with no ?dev param (the real-player case)', () => {
        expect(SettingsView.isDevMode({ hostname: 'schooley02.github.io', search: '' })).toBe(false);
    });

    test('false for an unrelated query param (not just "any query string")', () => {
        expect(SettingsView.isDevMode({ hostname: 'schooley02.github.io', search: '?foo=bar' })).toBe(false);
    });

    test('false/safe for a missing or empty location (never throws)', () => {
        expect(SettingsView.isDevMode(null)).toBe(false);
        expect(SettingsView.isDevMode(undefined)).toBe(false);
        expect(SettingsView.isDevMode({})).toBe(false);
    });
});

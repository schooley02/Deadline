/**
 * Settings.noteOnTimerStop (Journal Build A, 2026-11-13): ask for an optional note when a timer is stopped by hand. ON by default; a
 * preference like the avatar, so it is saved with the settings and rides along in Backup & Transfer.
 *
 * @jest-environment jsdom
 */
const Settings = require('../js/settings.js');

beforeEach(() => { localStorage.clear(); });

describe('noteOnTimerStop', () => {
    test('is ON by default, and in the defaults object', () => {
        expect(Settings.DEFAULTS.noteOnTimerStop).toBe(true);
        expect(Settings.load().noteOnTimerStop).toBe(true);
    });
    test('turning it off round-trips, and saving another field keeps it off', () => {
        Settings.save({ noteOnTimerStop: false });
        expect(Settings.load().noteOnTimerStop).toBe(false);
        Settings.save({ effectsIntensity: 'reduced' });
        expect(Settings.load().noteOnTimerStop).toBe(false);
        Settings.save({ noteOnTimerStop: true });
        expect(Settings.load().noteOnTimerStop).toBe(true);
    });
    test('an older stored object with no such key loads with it ON (nothing to migrate)', () => {
        localStorage.setItem(Settings.SETTINGS_KEY, JSON.stringify({ effectsIntensity: 'off', eveningCheckTime: '20:00' }));
        expect(Settings.load().noteOnTimerStop).toBe(true);
    });
    test('junk values mean ON; only a real false turns it off', () => {
        localStorage.setItem(Settings.SETTINGS_KEY, JSON.stringify({ noteOnTimerStop: 'no' }));
        expect(Settings.load().noteOnTimerStop).toBe(true);
        localStorage.setItem(Settings.SETTINGS_KEY, JSON.stringify({ noteOnTimerStop: false }));
        expect(Settings.load().noteOnTimerStop).toBe(false);
        Settings.save({ noteOnTimerStop: 'whatever' });
        expect(JSON.parse(localStorage.getItem(Settings.SETTINGS_KEY)).noteOnTimerStop).toBe(true);
    });
});

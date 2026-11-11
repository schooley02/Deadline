/**
 * @jest-environment jsdom
 *
 * App version line in the Settings window (2026-11-11, Jeremy: "I don't see any mention of which version of the app I'm seeing").
 * The service worker keeps one cache named deadline-shell-v<N>; Settings shows that N so a phone can be checked against the build.
 */
const fs = require('fs');
const path = require('path');
const SettingsView = require('../js/ui/settingsView.js');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => { delete global.caches; });

describe('appVersionFromKeys', () => {
    test('picks the highest deadline-shell-v number', () => {
        expect(SettingsView.appVersionFromKeys(['deadline-shell-v321'])).toBe('v321');
        expect(SettingsView.appVersionFromKeys(['deadline-shell-v9', 'deadline-shell-v322', 'deadline-shell-v100'])).toBe('v322');
    });
    test('ignores other caches; none / bad input = null', () => {
        expect(SettingsView.appVersionFromKeys(['workbox-precache', 'deadline-shell-vX', 'my-deadline-shell-v5'])).toBeNull();
        expect(SettingsView.appVersionFromKeys([])).toBeNull();
        expect(SettingsView.appVersionFromKeys()).toBeNull();
        expect(SettingsView.appVersionFromKeys('deadline-shell-v5')).toBeNull();
    });
});

describe('readAppVersion', () => {
    test('reads the cache names', async () => {
        global.caches = { keys: () => Promise.resolve(['deadline-shell-v322']) };
        expect(await SettingsView.readAppVersion()).toBe('v322');
    });
    test('no Cache API, a rejecting one or a throwing one = null, never a rejection', async () => {
        expect(await SettingsView.readAppVersion()).toBeNull();
        global.caches = { keys: () => Promise.reject(new Error('blocked')) };
        expect(await SettingsView.readAppVersion()).toBeNull();
        global.caches = { keys: () => { throw new Error('blocked'); } };
        expect(await SettingsView.readAppVersion()).toBeNull();
    });
});

describe('Settings window', () => {
    function open() {
        document.body.innerHTML = '<div id="settingsWindowContent"></div>';
        SettingsView.renderSettingsWindow({ currentIntensity: 'full' });
        return document.getElementById('appVersionLine');
    }
    test('shows the version once it is read', async () => {
        global.caches = { keys: () => Promise.resolve(['deadline-shell-v322']) };
        const line = open();
        expect(line).not.toBeNull();
        await flush();
        expect(line.textContent).toContain('v322');
    });
    test('without a cache it says there is no version yet instead of a blank or an error', async () => {
        const line = open();
        await flush();
        expect(line.textContent).toMatch(/no version number/i);
    });
    test('closing the window before the read finishes never throws', async () => {
        let resolve;
        global.caches = { keys: () => new Promise((r) => { resolve = r; }) };
        open();
        document.body.innerHTML = '';
        resolve(['deadline-shell-v1']);
        await flush();
    });
});

describe('sw.js keeps ONE deadline-shell cache (what the version line reads)', () => {
    test('the cache name matches the pattern and old ones are deleted on activate', () => {
        const sw = read('sw.js');
        expect(/CACHE_NAME = 'deadline-shell-v\d+'/.test(sw)).toBe(true);
        expect(sw).toContain('keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))');
    });
});

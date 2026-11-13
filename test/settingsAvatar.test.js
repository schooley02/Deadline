/**
 * @jest-environment jsdom
 *
 * Settings window: the Avatar choice (Mood Build A, 2026-11-13).
 */
global.Mood = require('../js/mood.js');
const SettingsView = require('../js/ui/settingsView.js');

function open(deps) {
    document.body.innerHTML = '<div id="settingsWindowContent"></div>';
    SettingsView.renderSettingsWindow(Object.assign({ currentIntensity: 'full' }, deps));
    return document.getElementById('settingsWindowContent');
}

afterEach(() => { document.body.innerHTML = ''; delete global.caches; });

describe('Avatar section', () => {
    test('offers both avatars and selects none until one is chosen', () => {
        const c = open({});
        const radios = Array.from(c.querySelectorAll('input[name="avatar"]'));
        expect(radios.map((r) => r.value)).toEqual(['male', 'female']);
        expect(radios.some((r) => r.checked)).toBe(false);
    });
    test('the saved avatar is the selected one', () => {
        const c = open({ currentAvatar: 'female' });
        expect(c.querySelector('input[name="avatar"][value="female"]').checked).toBe(true);
        expect(c.querySelector('input[name="avatar"][value="male"]').checked).toBe(false);
    });
    test('changing it reports the new avatar', () => {
        const picked = [];
        const c = open({ currentAvatar: 'male', onChangeAvatar: (v) => picked.push(v) });
        const female = c.querySelector('input[name="avatar"][value="female"]');
        female.checked = true;
        female.dispatchEvent(new Event('change', { bubbles: true }));
        expect(picked).toEqual(['female']);
    });
    test('a missing handler never throws', () => {
        const c = open({});
        const male = c.querySelector('input[name="avatar"][value="male"]');
        male.checked = true;
        expect(() => male.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
    });
});

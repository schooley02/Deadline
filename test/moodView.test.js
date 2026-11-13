/**
 * @jest-environment jsdom
 *
 * MoodView (W1b Build A, 2026-11-13): the picker's state helpers + markup (pure), the picker mounted in a container, the avatar
 * picker, the morning card and the avatar face on the level button (DOM, in jsdom).
 */
global.Mood = require('../js/mood.js');
global.Modal = require('../js/ui/modal.js');
const MoodView = require('../js/ui/moodView.js');

const at = (h) => new Date(2026, 10, 13, h, 5).getTime();
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

afterEach(() => { document.body.innerHTML = ''; });

describe('picker state', () => {
    test('nothing logged = nothing chosen', () => {
        expect(MoodView.initialState([])).toEqual({ level: null, feelings: [], context: [], hour: null, expanded: false });
    });
    test('it starts from the latest entry of the day', () => {
        const s = MoodView.initialState([[8, 5, 1, 0], [14, 2, 4096, 3]]);
        expect(s).toMatchObject({ level: 2, hour: 14, feelings: ['anxious'], context: ['sick', 'slept_badly'] });
    });
    test('a face tapped in the SAME hour edits that entry and keeps its words', () => {
        const s = MoodView.initialState([[14, 2, 4096, 1]]);
        expect(MoodView.pickLevel(s, 3, 14)).toMatchObject({ level: 3, hour: 14, feelings: ['anxious'], context: ['sick'] });
    });
    test('a face tapped in a LATER hour is a fresh check-in with no words', () => {
        const s = MoodView.initialState([[8, 5, 1, 1]]);
        expect(MoodView.pickLevel(s, 2, 14)).toMatchObject({ level: 2, hour: 14, feelings: [], context: [] });
    });
    test('a bad level changes nothing', () => {
        const s = MoodView.initialState([]);
        expect(MoodView.pickLevel(s, 9, 10)).toBe(s);
    });
    test('feelings toggle on and off, capped at two; a third does nothing', () => {
        let s = MoodView.pickLevel(MoodView.initialState([]), 2, 10);
        s = MoodView.toggleFeeling(s, 'anxious');
        s = MoodView.toggleFeeling(s, 'sad');
        expect(s.feelings).toEqual(['anxious', 'sad']);
        expect(MoodView.toggleFeeling(s, 'angry')).toBe(s);
        s = MoodView.toggleFeeling(s, 'anxious');
        expect(s.feelings).toEqual(['sad']);
        expect(MoodView.toggleFeeling(s, 'nope')).toBe(s);
    });
    test('words need a level first', () => {
        const s = MoodView.initialState([]);
        expect(MoodView.toggleFeeling(s, 'sad')).toBe(s);
        expect(MoodView.toggleContext(s, 'sick')).toBe(s);
    });
    test('context toggles with no limit', () => {
        let s = MoodView.pickLevel(MoodView.initialState([]), 3, 10);
        Mood.CONTEXT.forEach((c) => { s = MoodView.toggleContext(s, c.id); });
        expect(s.context.length).toBe(5);
        s = MoodView.toggleContext(s, 'sick');
        expect(s.context).not.toContain('sick');
    });
    test('the face for the level button follows the latest entry', () => {
        expect(MoodView.faceModel('male', [], false).emoji).toBe('👨');
        expect(MoodView.faceModel('male', [[8, 5, 0, 0], [20, 1, 0, 0]], false)).toMatchObject({ key: 'awful', emoji: '😫' });
        expect(MoodView.faceModel('female', [[8, 5, 0, 0]], true).art).toBe('Assets/Avatars/female_rad.png');
    });
});

describe('picker markup', () => {
    test('five faces, best first, none selected before a choice, and no words yet', () => {
        const html = MoodView.pickerHtml(MoodView.initialState([]));
        const faces = html.match(/data-mood-level="(\d)"/g).map((m) => m.match(/\d/)[0]);
        expect(faces).toEqual(['5', '4', '3', '2', '1']);
        expect(html).not.toContain('is-selected');
        expect(html).not.toContain('mood-chip');
    });
    test('a chosen level shows its suggested words, the context words and a More link', () => {
        const html = MoodView.pickerHtml(MoodView.pickLevel(MoodView.initialState([]), 2, 10));
        ['Unmotivated', 'Anxious', 'Stressed', 'Sad', 'Frustrated'].forEach((w) => expect(html).toContain('>' + w + '<'));
        expect(html).not.toContain('>Proud<');
        expect(html).toContain('>Slept badly<');
        expect(html).toContain('More words');
    });
    test('More shows every other word; a word picked from another level stays visible while More is closed', () => {
        let s = MoodView.pickLevel(MoodView.initialState([]), 2, 10);
        s = MoodView.toggleMore(s);
        expect(MoodView.pickerHtml(s)).toContain('>Proud<');
        s = MoodView.toggleFeeling(s, 'proud');
        s = MoodView.toggleMore(s);
        const html = MoodView.pickerHtml(s);
        expect(html).toContain('>Proud<');
        expect(html).not.toContain('>Excited<');
    });
    test('at the cap the unpicked words are marked disabled, the picked ones are not', () => {
        let s = MoodView.pickLevel(MoodView.initialState([]), 2, 10);
        s = MoodView.toggleFeeling(MoodView.toggleFeeling(s, 'anxious'), 'sad');
        const html = MoodView.pickerHtml(s);
        expect(html).toMatch(/is-on[^>]*data-mood-feeling="anxious"/);
        expect(html).toMatch(/is-disabled[^>]*data-mood-feeling="stressed"/);
        expect(html).not.toMatch(/is-disabled[^>]*data-mood-feeling="sad"/);
    });
    test('the avatar picker offers both avatars; the card has a Skip button', () => {
        const a = MoodView.avatarPickerHtml();
        expect(a).toContain('data-avatar="male"');
        expect(a).toContain('data-avatar="female"');
        expect(MoodView.moodCardHtml('How are you starting?')).toMatch(/data-mood-done>Skip</);
    });
});

describe('mount', () => {
    function setup(entries, now) {
        document.body.innerHTML = '<div id="host"></div>';
        const logs = [];
        const store = entries.slice();
        const host = document.getElementById('host');
        const view = MoodView.mount(host, { getEntries: () => store, onLog: (c) => logs.push(c), now: () => at(now == null ? 9 : now) });
        return { host, logs, view };
    }
    test('one tap on a face is a complete check-in', () => {
        const { host, logs } = setup([]);
        click(host.querySelector('[data-mood-level="4"]'));
        expect(logs).toEqual([{ level: 4, feelings: [], context: [] }]);
        expect(host.querySelector('[data-mood-level="4"]').classList.contains('is-selected')).toBe(true);
    });
    test('words are saved as they are picked, one entry each time (the record merges by hour)', () => {
        const { host, logs } = setup([]);
        click(host.querySelector('[data-mood-level="2"]'));
        click(host.querySelector('[data-mood-feeling="anxious"]'));
        click(host.querySelector('[data-mood-context="slept_badly"]'));
        expect(logs[logs.length - 1]).toEqual({ level: 2, feelings: ['anxious'], context: ['slept_badly'] });
        expect(logs.length).toBe(3);
    });
    test('a third feeling is ignored and logs nothing', () => {
        const { host, logs } = setup([]);
        click(host.querySelector('[data-mood-level="2"]'));
        click(host.querySelector('[data-mood-feeling="anxious"]'));
        click(host.querySelector('[data-mood-feeling="sad"]'));
        click(host.querySelector('[data-mood-feeling="stressed"]'));
        expect(logs.length).toBe(3);
        expect(logs[2].feelings).toEqual(['anxious', 'sad']);
    });
    test('More only reveals words; it logs nothing', () => {
        const { host, logs } = setup([]);
        click(host.querySelector('[data-mood-level="3"]'));
        click(host.querySelector('[data-mood-more]'));
        expect(logs.length).toBe(1);
        expect(host.querySelector('[data-mood-feeling="proud"]')).not.toBeNull();
    });
    test('it opens on today\'s latest entry', () => {
        const { host } = setup([[8, 5, 1, 0]]);
        expect(host.querySelector('[data-mood-level="5"]').classList.contains('is-selected')).toBe(true);
        expect(host.querySelector('[data-mood-feeling="fired_up"]').classList.contains('is-on')).toBe(true);
    });
    test('taps stop propagating, so Modal\'s outside-click handler never sees a detached button', () => {
        const { host } = setup([]);
        const seen = jest.fn();
        document.addEventListener('click', seen);
        click(host.querySelector('[data-mood-level="3"]'));
        document.removeEventListener('click', seen);
        expect(seen).not.toHaveBeenCalled();
    });
    test('no container = no picker', () => {
        expect(MoodView.mount(null, { getEntries: () => [], onLog: () => {} })).toBeNull();
    });
});

describe('avatar picker and morning card', () => {
    test('choosing an avatar closes the picker and reports the choice', () => {
        const picked = [];
        const overlay = MoodView.openAvatarPicker({ onPick: (id) => picked.push(id) });
        expect(document.querySelector('.avatar-picker-overlay')).not.toBeNull();
        click(overlay.querySelector('[data-avatar="female"]'));
        expect(picked).toEqual(['female']);
        expect(document.querySelector('.avatar-picker-overlay')).toBeNull();
    });
    test('the avatar picker never opens twice', () => {
        MoodView.openAvatarPicker({});
        expect(MoodView.openAvatarPicker({})).toBeNull();
        expect(document.querySelectorAll('.avatar-picker-overlay').length).toBe(1);
    });
    test('the morning card logs a tap, then Skip reads Done and closes it', () => {
        const logs = [];
        const overlay = MoodView.openMoodCard({ deps: { getEntries: () => [], onLog: (c) => logs.push(c), now: () => at(9) } });
        const done = overlay.querySelector('[data-mood-done]');
        expect(done.textContent).toBe('Skip');
        click(overlay.querySelector('[data-mood-level="5"]'));
        expect(logs).toEqual([{ level: 5, feelings: [], context: [] }]);
        expect(done.textContent).toBe('Done');
        click(done);
        expect(document.querySelector('.mood-card-overlay')).toBeNull();
    });
    test('Skip closes the card without logging anything', () => {
        const logs = [];
        const overlay = MoodView.openMoodCard({ deps: { getEntries: () => [], onLog: (c) => logs.push(c) } });
        click(overlay.querySelector('[data-mood-done]'));
        expect(logs).toEqual([]);
        expect(document.querySelector('.mood-card-overlay')).toBeNull();
    });
});

describe('avatar face on the level button', () => {
    test('draws the emoji, and touches the DOM only when the face changes', () => {
        document.body.innerHTML = '<span id="f" class="hud-avatar"></span>';
        const el = document.getElementById('f');
        expect(MoodView.renderAvatarFace(el, Mood.faceFor('male', null))).toBe(true);
        expect(el.textContent).toBe('👨');
        expect(MoodView.renderAvatarFace(el, Mood.faceFor('male', null))).toBe(false);
        expect(MoodView.renderAvatarFace(el, Mood.faceFor('male', 4))).toBe(true);
        expect(el.textContent).toBe('🙂');
    });
    test('with art ready it draws the picture instead', () => {
        document.body.innerHTML = '<span id="f" class="hud-avatar"></span>';
        const el = document.getElementById('f');
        MoodView.renderAvatarFace(el, Mood.faceFor('female', 5, { artReady: true }));
        expect(el.querySelector('img').getAttribute('src')).toBe('Assets/Avatars/female_rad.png');
    });
    test('a missing element or face is a no-op', () => {
        expect(MoodView.renderAvatarFace(null, Mood.faceFor('male', 1))).toBe(false);
        expect(MoodView.renderAvatarFace(document.body, null)).toBe(false);
    });
});

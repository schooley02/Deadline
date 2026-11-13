/**
 * Mood check-in wiring (W1b Build A, 2026-11-13). Jest never loads script.js, so this reads the source text and pins the seams a live
 * browser check would otherwise be the only guard for: the level button's avatar face, the script / style tags and the service worker
 * list, the Level panel's mood deps, the once-a-day card gate, and the per-device settings the export must leave out.
 */
const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const script = read('script.js');
const html = read('index.html');
const sw = read('sw.js');

describe('level button', () => {
    test('shows the avatar face instead of the old chevron icon', () => {
        const btn = html.slice(html.indexOf('id="levelButton"'), html.indexOf('</button>', html.indexOf('id="levelButton"')));
        expect(btn).toContain('id="playerAvatarFace"');
        expect(btn).toContain('class="hud-avatar"');
        expect(btn).not.toContain('hud-icon');
        expect(btn).toContain('id="playerLevelDisplay"');
        expect(btn).toContain('id="playerXpBar"');
    });
});

describe('files are loaded and cached', () => {
    test('index.html loads the style and both scripts, mood before the view and the view before the level panel', () => {
        expect(html).toContain('href="css/mood.css"');
        const a = html.indexOf('src="js/mood.js"');
        const b = html.indexOf('src="js/ui/moodView.js"');
        const c = html.indexOf('src="js/ui/levelPanel.js"');
        const d = html.indexOf('src="script.js"');
        expect(a).toBeGreaterThan(0);
        expect(a).toBeLessThan(b);
        expect(b).toBeLessThan(d);
        expect(c).toBeGreaterThan(0);
    });
    test('mood.js loads before settings is used and before the daily record', () => {
        expect(html.indexOf('src="js/mood.js"')).toBeLessThan(html.indexOf('src="js/state.js"'));
    });
    test('the service worker caches all three new files', () => {
        ["'css/mood.css'", "'js/mood.js'", "'js/ui/moodView.js'"].forEach((f) => expect(sw).toContain(f));
    });
    test('every shell file index.html loads for mood is in the cache list', () => {
        const tags = html.match(/(?:src|href)="((?:js|css)\/[^"]*mood[^"]*)"/gi) || [];
        tags.forEach((t) => expect(sw).toContain("'" + t.match(/"(.*)"/)[1] + "'"));
    });
});

describe('script.js wiring', () => {
    test('the Level panel is opened with the mood deps', () => {
        const open = script.slice(script.indexOf('function openLevelPanel()'), script.indexOf('if (levelButton) levelButton.addEventListener'));
        expect(open).toContain('mood: moodDeps()');
    });
    test('a check-in goes through the daily record, saves, and refreshes the face', () => {
        const deps = script.slice(script.indexOf('function moodDeps()'), script.indexOf('function refreshAvatarFace()'));
        expect(deps).toContain("State.bumpToday('mood'");
        expect(deps).toContain('Mood.packFeelings(c.feelings)');
        expect(deps).toContain('Mood.packContext(c.context)');
        expect(deps).toContain('saveGame()');
        expect(deps).toContain('refreshAvatarFace()');
    });
    test('the face is refreshed every tick and at boot', () => {
        const tick = script.slice(script.indexOf('function updateGame()'), script.indexOf('// Habit system functions'));
        expect(tick).toContain('refreshAvatarFace()');
        expect(script).toMatch(/refreshAvatarFace\(\);\n\s*maybeShowMoodCard\(\);/);
    });
    test('the morning card is polled, asked on foreground, and never stacks or runs during a preview', () => {
        const fn = script.slice(script.indexOf('function maybeShowMoodCard()'), script.indexOf('// True while the evening check'));
        expect(fn).toContain("document.querySelector('.modal-overlay')");
        expect(fn).toContain('timePreviewActive || offlineCatchUpActive');
        expect(fn).toContain('State.isGameOver()');
        expect(fn).toContain('moodCardShownFor === todayKey');
        expect(fn).toContain('moodCardDay');
        const poll = script.slice(script.indexOf('function pollEveningCheck'), script.indexOf('// Negative-habit "time has arrived" prompt'));
        expect(poll).toContain('maybeShowMoodCard()');
        const vis = script.slice(script.indexOf("document.addEventListener('visibilitychange'"), script.indexOf("window.addEventListener('beforeunload'"));
        expect(vis).toContain('maybeShowMoodCard()');
    });
    test('the card stamp is per device: left out of export and of import', () => {
        expect(script).toContain('delete st.moodCardDay');
        expect(script).toContain('delete importedSettings.moodCardDay');
        // a backup with no avatar must not wipe the one chosen here
        expect(script).toContain('if (!importedSettings.avatar) delete importedSettings.avatar');
    });
    test('the avatar is exported with the settings (it is not stripped)', () => {
        expect(script).not.toContain('delete st.avatar');
        expect(script).not.toMatch(/^\s*delete importedSettings\.avatar;/m);
    });
    test('Settings gets the avatar and its change handler', () => {
        expect(script).toContain('currentAvatar,');
        expect(script).toContain('onChangeAvatar: setAvatar');
    });
});

describe('theme and wording rules', () => {
    test('the mood modules use no theme words', () => {
        ['js/mood.js', 'js/ui/moodView.js', 'css/mood.css'].forEach((rel) => {
            expect(read(rel).replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\b(zombie|church|village|survivor)\b/i);
        });
    });
});

/**
 * Journal Build B wiring (2026-11-13; docs/JOURNAL_PLAN.md): the places index.html, script.js, managementWindows, the theme and sw.js
 * must stay in step. Source-text pins like journalWiring.test.js (script.js is CRLF on Jeremy's Windows checkout).
 */
const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const html = read('index.html');
const script = read('script.js');
const sw = read('sw.js');
const mw = read('js/ui/managementWindows.js');
const Theme = require('../js/theme.js');

describe('the plus menu and the window', () => {
    test('a Journal row sits between Stats and Settings, and there is no new HUD button', () => {
        const stats = html.indexOf('data-type="stats"');
        const journal = html.indexOf('data-type="journal"');
        const settings = html.indexOf('data-type="settings"');
        expect(stats).toBeGreaterThan(-1);
        expect(journal).toBeGreaterThan(stats);
        expect(settings).toBeGreaterThan(journal);
        expect(html).not.toMatch(/id="journalButton"/);
    });
    test('#journalWindow is a management window with a close button and the content mount', () => {
        expect(html).toContain('id="journalWindow" class="management-window hidden" role="dialog" aria-labelledby="journalWindowTitle" tabindex="-1"');
        expect(html).toContain('data-window="journalWindow"');
        expect(html).toContain('id="journalWindowContent"');
    });
    test('script.js registers the window and builds its deps only when it opens', () => {
        expect(script).toContain("journal: document.getElementById('journalWindow')");
        expect(script).toContain("journalWindow: type === 'journal' ? journalWindowDeps() : undefined");
    });
    test('managementWindows dispatches the journal branch to JournalView.renderWindow and passes the stats note deps', () => {
        expect(mw).toContain("type === 'journal'");
        expect(mw).toContain("JournalView.renderWindow(document.getElementById('journalWindowContent'), deps.journalWindow)");
        expect(mw).toContain('noteCountForRun: deps.noteCountForRun');
        expect(mw).toContain('onReadRunNotes: deps.onReadRunNotes');
    });
});

describe('the other doors and the evening prompt', () => {
    test('the Level panel gets the Journal section deps', () => {
        expect(script).toContain('journal: journalPanelSummary()');
        expect(script).toContain('onJournalOpen: () => openJournal()');
    });
    test('the item and routine windows pass an "All notes" opener', () => {
        expect(script.match(/onOpenJournalFor: \(ref\) => openJournal\(\{ kind: 'ref', ref \}\)/g)).toHaveLength(2);
    });
    test('Stats gets the note counts and a Read opener', () => {
        expect(script).toContain('noteCountForRun: (n) => Journal.forRun(journal(), n).length');
        expect(script).toContain("onReadRunNotes: (n) => openJournal({ kind: 'run', run: n })");
    });
    test('the day-end card comes before the evening check at all three call sites', () => {
        expect(script).toContain('function maybeShowEveningPrompts()');
        expect(script).toMatch(/function maybeShowEveningPrompts\(\) \{\n\s+if \(maybeShowDayEnd\(\)\) return;\n\s+maybeShowEveningCheck\(\);/);
        // pollEveningCheck, the boot call and the return-to-foreground call all go through it
        expect(script).toMatch(/lastEveningPollMs = nowMs;\n\s+maybeShowEveningPrompts\(\);/);
        expect(script.match(/maybeShowEveningPrompts\(\);/g).length).toBe(3);
    });
    test('the card is once a day, per device, and never stacks on another dialog', () => {
        expect(script).toContain("'deadline.journalStamps'");
        const fn = script.slice(script.indexOf('function maybeShowDayEnd()'), script.indexOf('function maybeShowEveningPrompts()'));
        expect(fn).toContain("journalStamps().dayEnd === key");
        expect(fn).toContain("setJournalStamp('dayEnd', key)");
        expect(fn).toContain("document.querySelector('.modal-overlay')");
        expect(fn).toContain('timePreviewActive || offlineCatchUpActive');
        expect(fn).toContain('GoalCheck.isEveningTime');
        expect(fn).toContain("src: 'dayEnd'");
    });
    test('the stamps are not part of the exported settings or save', () => {
        const exp = read('js/exportImport.js');
        expect(exp).not.toContain('journalStamps');
    });
    test('the morning fallback files the note under yesterday with the face on the entry only, and never edits a closed day', () => {
        const fn = script.slice(script.indexOf('function addLateDayNote'), script.indexOf('function morningYesterdayDeps'));
        expect(fn).toContain('dayKey: dayKeyDaysAgo(1)');
        expect(fn).toContain('late: true');
        expect(fn).toContain('mood: level >= 1 && level <= 5 ? [level, 0, 0] : null');
        expect(fn).not.toContain('bumpClosed');
        expect(script).toContain("MoodView.openMoodCard({ title: 'How are you starting?', deps: Object.assign(moodDeps(), typeof JournalView !== 'undefined' ? morningYesterdayDeps() : {}) })");
    });
    test('deleting a note written today takes one off the open day\'s count', () => {
        const fn = script.slice(script.indexOf('function deleteJournalNote'), script.indexOf('function journalWindowDeps'));
        expect(fn).toContain("State.bumpToday('note', { n: -1 })");
        expect(fn).toContain('DailyRecord.dateKey(hit.entry.at) === today.date');
    });
});

describe('words, shell and docs', () => {
    test('the game name comes from the theme, not a literal in script.js', () => {
        expect(Theme.strings.journal.gameName).toBe('Deadline');
        expect(script).toContain('Theme.strings.journal.gameName');
    });
    test('the cache name was bumped for Build B (v363 or later)', () => {
        expect(sw).toMatch(/const CACHE_NAME = 'deadline-shell-v3(6[3-9]|[7-9]\d)';/);
    });
});

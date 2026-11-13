/**
 * @jest-environment jsdom
 *
 * Journal Build A wiring (2026-11-13; docs/JOURNAL_PLAN.md): the saved key, the export / import path, and the places script.js, index.html
 * and sw.js must stay in step. Source-text pins like moodWiring.test.js (script.js is CRLF on Jeremy's Windows checkout).
 */
const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
global.Persistence = require('../js/persistence.js');
const ExportImport = require('../js/exportImport.js');
const Journal = require('../js/journal.js');
const CONFIG = require('../js/config.js');

const html = read('index.html');
const sw = read('sw.js');
const script = read('script.js');

beforeEach(() => { localStorage.clear(); });

describe('Persistence: the journal key', () => {
    test('is its own key, and Persistence.clear() (a fresh run) leaves it alone', () => {
        expect(Persistence.JOURNAL_KEY).toBe('deadline.journal');
        expect(Persistence.JOURNAL_KEY).not.toBe(Persistence.SAVE_KEY);
        const s = Journal.fresh();
        Journal.add(s, { dayKey: '2026-11-13', text: 'keep me', about: 'general' }, 1000);
        expect(Persistence.saveJournal(s)).toBe(true);
        Persistence.clear();
        expect(Persistence.loadJournal().days['2026-11-13'][0].text).toBe('keep me');
    });
    test('load is null when nothing is stored or the text is corrupt, never a throw', () => {
        expect(Persistence.loadJournal()).toBeNull();
        localStorage.setItem(Persistence.JOURNAL_KEY, '{nope');
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(Persistence.loadJournal()).toBeNull();
        spy.mockRestore();
    });
    test('a refused write returns false (the note is then rolled back by the caller)', () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const orig = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error('quota'); };
        expect(Persistence.saveJournal(Journal.fresh())).toBe(false);
        Storage.prototype.setItem = orig;
        spy.mockRestore();
    });
});

describe('Backup & Transfer', () => {
    const base = () => ({
        getPersistableState: () => ({ baseHealth: 80, playerXP: 1, playerLevel: 1, playerPoints: 0, activeItems: [], completedItems: [], definedHabits: [], definedRoutines: [], definedTasks: [] }),
        getSettings: () => ({}),
        now: new Date('2026-11-13T12:00:00.000Z'),
    });
    const store = () => { const s = Journal.fresh(); Journal.add(s, { dayKey: '2026-11-13', text: 'a note', about: 'general' }, 1000); return s; };

    test('the notes ride in the envelope only when asked, and the checksum covers them', () => {
        const withNotes = ExportImport.buildEnvelope(Object.assign(base(), { getJournal: () => store() }));
        expect(withNotes.journal.days['2026-11-13'][0].text).toBe('a note');
        const without = ExportImport.buildEnvelope(Object.assign(base(), { getJournal: () => null }));
        expect('journal' in without).toBe(false);
        expect('journal' in ExportImport.buildEnvelope(base())).toBe(false);
        expect(ExportImport.validateEnvelope(withNotes).valid).toBe(true);
        const tampered = JSON.parse(JSON.stringify(withNotes));
        tampered.journal.days['2026-11-13'][0].text = 'edited after export';
        expect(ExportImport.validateEnvelope(tampered)).toMatchObject({ valid: false, reason: 'checksum' });
    });
    test('validateEnvelope hands the journal back (null for an older export)', () => {
        const withNotes = ExportImport.buildEnvelope(Object.assign(base(), { getJournal: () => store() }));
        expect(ExportImport.validateEnvelope(withNotes).journal.days['2026-11-13']).toHaveLength(1);
        expect(ExportImport.validateEnvelope(ExportImport.buildEnvelope(base())).journal).toBeNull();
    });
    test('import merges by entry id and never overwrites a note already on the device', () => {
        const local = Journal.fresh();
        const mine = Journal.add(local, { dayKey: '2026-11-13', text: 'mine', about: 'general' }, 1000);
        const incoming = JSON.parse(JSON.stringify(local));
        incoming.days['2026-11-13'][0].text = 'THEIRS';
        Journal.add(incoming, { dayKey: '2026-11-12', text: 'from the other device', about: 'general' }, 500);
        const merged = Journal.merge(local, incoming, CONFIG.JOURNAL.MAX_CHARS);
        expect(merged.added).toBe(1);
        expect(merged.store.days['2026-11-13'][0].text).toBe('mine');
        expect(merged.store.days['2026-11-13'][0].id).toBe(mine.id);
        expect(merged.store.days['2026-11-12'][0].text).toBe('from the other device');
    });
});

describe('script.js hooks', () => {
    test('the timer is offered a note after a manual Stop, a paused Stop and "Still working?" > Stop, but NOT on Pause', () => {
        expect(script).toContain("if (action === 'stop') { const span = Timer.stop(item, now); offerTimerNote(item, span); } else Timer.pause(item, now);");
        expect(script).toMatch(/if \(!Timer\.endPaused\(item\)\) return \{ ok: false \};[\s\S]{0,120}offerTimerNote\(item, null\);/);
        expect(script).toMatch(/onStop: \(\) => \{ const span = Timer\.stop\(running, Date\.now\(\)\);[^\n]*offerTimerNote\(running, span\);/);
        const fn = script.slice(script.indexOf('function offerTimerNote'), script.indexOf('function offerTimerNote') + 1400);
        expect(fn).toContain("Settings.load().noteOnTimerStop === false");
        expect(fn).toContain('CONFIG.JOURNAL.TIMER_NOTE_MIN_MS');
        expect(fn).toContain('Time Logged: ');
        expect(fn).toContain("src: 'timer'");
    });
    test('a kept note bumps the day count once and a refused save is rolled back', () => {
        const fn = script.slice(script.indexOf('function addJournalNote'), script.indexOf('function addJournalNote') + 900);
        expect(fn).toContain('Persistence.saveJournal(store)');
        expect(fn).toContain('Journal.remove(store, entry.id)');
        expect(fn).toContain("State.bumpToday('note', { n: 1 })");
        expect(fn).toContain('journalMoodSnapshot()'); // every note copies the day's latest mood
    });
    test('the note hooks are handed to the task window, the routine window, the mood picker and Settings', () => {
        expect(script).toContain('journalNotes: journalNotesForItem,');
        expect(script).toContain('onAddNote: (item, done) => openItemNote(item, { done }),');
        expect(script).toContain('journalNotesForRoutine: journalNotesForRoutine,');
        expect(script).toContain('onAddNoteForRoutine: openRoutineNote,');
        expect(script).toContain("src: 'mood'");
        expect(script).toContain('onChangeNoteOnTimerStop');
    });
    test('refs: recurring things by definition, one-offs by item, with a prefix so the two never collide', () => {
        expect(script).toContain("'def:' + item.definitionId");
        expect(script).toContain("'item:' + item.id");
    });
    test('the export honours the "Include journal notes" box, and import merges the notes', () => {
        expect(script).toContain('buildExportEnvelope: (opts) => ExportImport.buildEnvelope({');
        expect(script).toContain('opts.includeJournal === false');
        expect(script).toContain('Journal.merge(Persistence.loadJournal(), envelope.journal, CONFIG.JOURNAL.MAX_CHARS)');
        expect(script).toContain('journal: localStorage.getItem(Persistence.JOURNAL_KEY)');
    });
    test('Reset Game does not touch the journal (lifetime data)', () => {
        const reset = script.slice(script.indexOf('function handleConfirmReset'), script.indexOf('function handleConfirmReset') + 3500);
        expect(reset).not.toMatch(/journal/i);
    });
});

describe('shell registration', () => {
    test('journal.css, journal.js and journalView.js load in index.html and are cached by the service worker', () => {
        expect(html).toContain('<link rel="stylesheet" href="css/journal.css">');
        expect(html).toContain('<script src="js/journal.js"></script>');
        expect(html).toContain('<script src="js/ui/journalView.js"></script>');
        expect(sw).toContain("'css/journal.css'");
        expect(sw).toContain("'js/journal.js'");
        expect(sw).toContain("'js/ui/journalView.js'");
        expect(html.indexOf('js/journal.js')).toBeLessThan(html.indexOf('script.js"></script>'));
        expect(html.indexOf('js/ui/modal.js')).toBeLessThan(html.indexOf('js/ui/journalView.js'));
    });
    test('the cache name was bumped for the new shell files', () => {
        const n = Number((sw.match(/const CACHE_NAME = 'deadline-shell-v(\d+)';/) || [])[1]);
        expect(n).toBeGreaterThanOrEqual(362); // v362 or later: every later shell change bumps it again
    });
    test('Settings has the switch and the export box', () => {
        const sv = read('js/ui/settingsView.js');
        expect(sv).toContain('id="noteOnTimerStopToggle"');
        expect(sv).toContain('Ask for a note when I stop a timer');
        expect(sv).toContain('id="exportJournalToggle"');
        expect(sv).toContain('Include journal notes');
    });
});

describe('config', () => {
    test('CONFIG.JOURNAL dials', () => {
        expect(CONFIG.JOURNAL).toEqual({ MAX_CHARS: 2000, TIMER_NOTE_MIN_MS: 60000, RECENT_ON_ITEM: 3 });
    });
});

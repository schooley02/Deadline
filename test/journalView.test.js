/**
 * @jest-environment jsdom
 *
 * JournalView (Journal Build A, 2026-11-13; docs/JOURNAL_PLAN.md): the note window, the "Notes" block, and where the note hooks sit in
 * the mood picker and the task / habit window.
 */
global.Mood = require('../js/mood.js');
global.Modal = require('../js/ui/modal.js');
// The real game installs these document-level dismiss handlers once at boot (Esc + tap on the backdrop); the draft guard has to hold against them.
Modal.initDismissHandlers({ closeAllManagementWindows: () => {}, closeFabMenu: () => {}, isAnyManagementWindowOpen: () => false });
global.Forms = require('../js/ui/forms.js');
global.Timer = require('../js/timer.js');
global.Habits = require('../js/habits.js');
global.Clock = require('../js/clock.js');
global.SpriteAnim = { setEnemyCategory: () => {} };
const JournalView = require('../js/ui/journalView.js');
global.JournalView = JournalView;
const MoodView = require('../js/ui/moodView.js');
const Popups = require('../js/ui/popups.js');

const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const tick = () => new Promise((r) => setTimeout(r, 5));
beforeEach(() => { document.body.innerHTML = ''; });

describe('noteWindowHtml', () => {
    test('shows the title, the Time Logged line, the mood face and an empty box with a limit', () => {
        const html = JournalView.noteWindowHtml({ title: 'Note about Write report', context: 'Time Logged: 45 min', mood: [2, 0, 0], maxChars: 500 });
        expect(html).toContain('Note about Write report');
        expect(html).toContain('Time Logged: 45 min');
        expect(html).toContain('Mood today: Bad');
        expect(html).toContain('maxlength="500"');
        expect(html).toContain('Save note');
        expect(html).toContain('Skip');
    });
    test('no mood and no context leaves those lines out', () => {
        const html = JournalView.noteWindowHtml({ title: 'Note' });
        expect(html).not.toContain('journal-note-mood');
        expect(html).not.toContain('journal-note-context');
    });
    test('escapes the title and context', () => {
        const html = JournalView.noteWindowHtml({ title: 'Note about <b>x</b>', context: '"q" & <i>' });
        expect(html).not.toContain('<b>x</b>');
        expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    });
    test('the button wording follows the rules (no native dialogs, explicit button classes)', () => {
        const html = JournalView.noteWindowHtml({ title: 'Note' });
        expect(html).toMatch(/class="primary-button" data-journal-save/);
        expect(html).toMatch(/class="secondary-button" data-journal-skip/);
    });
});

describe('openNote', () => {
    const open = (over) => JournalView.openNote(Object.assign({ title: 'Note', onSave: jest.fn(() => true), maxChars: 50 }, over));
    const ta = () => document.querySelector('[data-journal-text]');
    const save = () => click(document.querySelector('[data-journal-save]'));

    test('Save hands the typed text to onSave and closes the window', () => {
        const onSave = jest.fn(() => true);
        open({ onSave });
        ta().value = 'kept getting interrupted';
        save();
        expect(onSave).toHaveBeenCalledWith('kept getting interrupted');
        expect(document.querySelector('.journal-note-overlay')).toBeNull();
    });
    test('Save with nothing typed is Skip: onSave is not called', () => {
        const onSave = jest.fn();
        open({ onSave });
        ta().value = '   ';
        save();
        expect(onSave).not.toHaveBeenCalled();
        expect(document.querySelector('.journal-note-overlay')).toBeNull();
    });
    test('Skip closes without saving, and onClose runs once', () => {
        const onSave = jest.fn(); const onClose = jest.fn();
        open({ onSave, onClose });
        ta().value = 'a draft';
        click(document.querySelector('[data-journal-skip]'));
        expect(onSave).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(document.querySelector('.journal-note-overlay')).toBeNull();
    });
    test('a refused save keeps the window and the text, and says so', () => {
        const onSave = jest.fn(() => false);
        open({ onSave });
        ta().value = 'keep me';
        save();
        expect(document.querySelector('.journal-note-overlay')).not.toBeNull();
        expect(ta().value).toBe('keep me');
        const err = document.querySelector('[data-journal-error]');
        expect(err.hidden).toBe(false);
        expect(err.textContent).toMatch(/Couldn.t save the note/);
    });
    test('a throwing onSave is treated as a refused save (never breaks the window)', () => {
        open({ onSave: () => { throw new Error('boom'); } });
        ta().value = 'x';
        expect(() => save()).not.toThrow();
        expect(document.querySelector('.journal-note-overlay')).not.toBeNull();
    });
    test('a tap on the backdrop does NOT throw a typed draft away; an empty box closes as usual', () => {
        open();
        ta().value = 'long draft';
        click(document.querySelector('.journal-note-overlay'));
        expect(document.querySelector('.journal-note-overlay')).not.toBeNull();
        ta().value = '';
        click(document.querySelector('.journal-note-overlay'));
        expect(document.querySelector('.journal-note-overlay')).toBeNull();
    });
    test('Esc with a draft keeps the window; Esc on an empty box closes it', () => {
        open();
        ta().value = 'draft';
        ta().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.querySelector('.journal-note-overlay')).not.toBeNull();
        ta().value = '';
        ta().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.querySelector('.journal-note-overlay')).toBeNull();
    });
    test('a second window is not stacked on the first', () => {
        open();
        expect(open()).toBeNull();
        expect(document.querySelectorAll('.journal-note-overlay').length).toBe(1);
    });
    test('the character count follows the box', () => {
        open();
        ta().value = 'abcd';
        ta().dispatchEvent(new Event('input', { bubbles: true }));
        expect(document.querySelector('[data-journal-count]').textContent).toBe('4 / 50');
    });
});

describe('the Notes block', () => {
    const entry = (over) => Object.assign({ id: 'j1-1', at: Date.now(), text: 'hello', mood: [4, 0, 0] }, over);

    test('an empty list says so; a list shows when, the face and a short text', () => {
        expect(JournalView.itemNotesHtml([])).toContain('No notes yet.');
        const html = JournalView.itemNotesHtml([entry({ text: 'a'.repeat(300) })], { limit: 3 });
        expect(html).toContain('Today');
        expect(html).toContain('🙂');
        expect(html).toContain('…');
        expect(html).not.toContain('a'.repeat(200));
    });
    test('only the newest few are listed, and the text is escaped', () => {
        const list = [1, 2, 3, 4, 5].map((n) => entry({ id: 'j' + n, text: n === 1 ? '<script>x</script>' : 'note ' + n }));
        const html = JournalView.itemNotesHtml(list, { limit: 3 });
        expect(html.match(/journal-recent-row/g).length).toBe(3);
        expect(html).not.toContain('<script>');
    });
    test('whenText says Today, Yesterday, then the date', () => {
        const now = new Date(2026, 10, 13, 10).getTime();
        expect(JournalView.whenText(new Date(2026, 10, 13, 8).getTime(), now)).toBe('Today');
        expect(JournalView.whenText(new Date(2026, 10, 12, 23).getTime(), now)).toBe('Yesterday');
        expect(JournalView.whenText(new Date(2026, 10, 1, 9).getTime(), now)).not.toMatch(/Today|Yesterday/);
    });
    test('Add note calls onAdd (one tick later) and the list redraws once a note was saved', async () => {
        const host = document.createElement('div');
        let notes = [];
        host.innerHTML = JournalView.itemNotesHtml(notes);
        document.body.appendChild(host);
        const onAdd = jest.fn((done) => { notes = [entry({ text: 'fresh note' })]; done(); });
        JournalView.wireItemNotes(host, { getNotes: () => notes, onAdd });
        click(host.querySelector('[data-journal-add]'));
        expect(onAdd).not.toHaveBeenCalled(); // the click is still bubbling
        await tick();
        expect(onAdd).toHaveBeenCalledTimes(1);
        expect(host.textContent).toContain('fresh note');
        expect(host.textContent).not.toContain('No notes yet.');
        // the redrawn block is wired again
        click(host.querySelector('[data-journal-add]'));
        await tick();
        expect(onAdd).toHaveBeenCalledTimes(2);
    });
});

describe('the mood picker hook', () => {
    const mount = (deps) => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        MoodView.mount(host, Object.assign({ getEntries: () => [], onLog: jest.fn(), now: () => new Date(2026, 10, 13, 14, 5).getTime() }, deps));
        return host;
    };
    test('no "Add a note" until a face is picked, and not at all without deps.onAddNote', () => {
        const withHook = mount({ onAddNote: jest.fn() });
        expect(withHook.querySelector('[data-mood-note]')).toBeNull();
        click(withHook.querySelector('[data-mood-level="2"]'));
        expect(withHook.querySelector('[data-mood-note]')).not.toBeNull();
        const without = mount({});
        click(without.querySelector('[data-mood-level="2"]'));
        expect(without.querySelector('[data-mood-note]')).toBeNull();
    });
    test('tapping it passes the picked level and the hour, and leaves the picker as it was', () => {
        const onAddNote = jest.fn();
        const host = mount({ onAddNote });
        click(host.querySelector('[data-mood-level="2"]'));
        click(host.querySelector('[data-mood-note]'));
        expect(onAddNote).toHaveBeenCalledWith({ level: 2, hour: 14 });
        expect(host.querySelector('[data-mood-level="2"]')).not.toBeNull();
    });
});

describe('the task / habit window hook', () => {
    const task = () => ({ id: 3, type: 'task', name: 'Write report', category: 'career', isHighPriority: false, isOverdue: false,
        dueDateTime: new Date(2026, 10, 20, 20, 0), timer: null, timerMsBanked: 0, subTasks: [] });
    const deps = (over) => Object.assign({
        activeItems: [], completeItem: jest.fn(), toggleWorkTimer: jest.fn(), setLoggedTime: jest.fn(),
        recomputeOverdueStateAfterEdit: jest.fn(), sortAndRenderActiveList: jest.fn(), createListItem: jest.fn(), saveGame: jest.fn(),
        pushbackOptionsFor: () => [],
    }, over);

    test('without the journal deps there is no Notes block', () => {
        Popups.showTaskDetailsPopup(task(), deps());
        expect(document.querySelector('[data-journal-notes]')).toBeNull();
    });
    test('with them the block shows the earlier notes, and Add note opens the note flow for THIS item', async () => {
        const item = task();
        const onAddNote = jest.fn();
        Popups.showTaskDetailsPopup(item, deps({
            journalNotes: jest.fn(() => [{ id: 'j9', at: Date.now(), text: 'last time the printer jammed', mood: null }]),
            onAddNote,
        }));
        expect(document.querySelector('[data-journal-notes]').textContent).toContain('last time the printer jammed');
        click(document.querySelector('[data-journal-add]'));
        await tick();
        expect(onAddNote).toHaveBeenCalledTimes(1);
        expect(onAddNote.mock.calls[0][0]).toBe(item);
        expect(typeof onAddNote.mock.calls[0][1]).toBe('function');
    });
});

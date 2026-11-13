/**
 * @jest-environment jsdom
 *
 * Journal Build B (2026-11-13; docs/JOURNAL_PLAN.md): the Journal window (filters, edit, delete), the day-end card, the "All notes"
 * button, the player-panel section, the morning "How did yesterday go?" line and Stats "Notes: N".
 */
global.Mood = require('../js/mood.js');
global.Modal = require('../js/ui/modal.js');
Modal.initDismissHandlers({ closeAllManagementWindows: () => {}, closeFabMenu: () => {}, isAnyManagementWindowOpen: () => false });
global.Journal = require('../js/journal.js');
const JournalView = require('../js/ui/journalView.js');
global.JournalView = JournalView;
const MoodView = require('../js/ui/moodView.js');
global.Progression = require('../js/progression.js');
const LevelPanel = require('../js/ui/levelPanel.js');

const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 10));
beforeEach(() => { document.body.innerHTML = '<div id="host"></div>'; });

function store() {
    const s = Journal.fresh();
    Journal.add(s, { dayKey: '2026-11-10', text: 'First thing', about: 'item', ref: { kind: 'task', id: 'item:7', name: 'Write report' }, src: 'timer', run: 3, mood: [2, 0, 0] }, 1000);
    Journal.add(s, { dayKey: '2026-11-10', text: 'About the game', about: 'general', run: 3 }, 2000);
    Journal.add(s, { dayKey: '2026-11-11', text: 'End of day words', about: 'day', src: 'dayEnd', run: 4 }, 3000);
    return s;
}
function deps(s, extra) {
    return Object.assign({
        getStore: () => s, moodFor: () => [], gameName: 'Deadline', maxChars: 2000,
        onWrite: jest.fn(), onEdit: jest.fn(() => true), onDelete: jest.fn(() => true), confirmDelete: () => Promise.resolve(true),
    }, extra || {});
}
const host = () => document.getElementById('host');

describe('windowHtml / renderWindow', () => {
    test('newest day first with the run, entries, the about name, mood face and the size line', () => {
        JournalView.renderWindow(host(), deps(store()));
        const days = Array.from(host().querySelectorAll('[data-journal-day]')).map((d) => d.getAttribute('data-journal-day'));
        expect(days).toEqual(['2026-11-11', '2026-11-10']);
        expect(host().textContent).toContain('Run #3');
        expect(host().textContent).toContain('Write report');
        expect(host().textContent).toContain('3 notes on this device');
        expect(host().querySelector('.journal-entry-mood').getAttribute('title')).toBe('Bad');
        expect(host().querySelectorAll('.journal-entry')).toHaveLength(3);
    });
    test('an empty journal says so and offers the two Write buttons', () => {
        JournalView.renderWindow(host(), deps(Journal.fresh()));
        expect(host().textContent).toContain('No notes yet');
        expect(host().querySelector('[data-journal-write="day"]')).not.toBeNull();
        expect(host().querySelector('[data-journal-write="general"]').textContent).toContain('Deadline');
    });
    test('the Days and game chips filter; All clears', () => {
        JournalView.renderWindow(host(), deps(store()));
        click(host().querySelector('[data-journal-filter="days"]'));
        expect(host().querySelectorAll('.journal-entry')).toHaveLength(1);
        expect(host().textContent).toContain('End of day words');
        click(host().querySelector('[data-journal-filter="game"]'));
        expect(host().querySelectorAll('.journal-entry')).toHaveLength(1);
        expect(host().textContent).toContain('About the game');
        click(host().querySelector('[data-journal-filter="all"]'));
        expect(host().querySelectorAll('.journal-entry')).toHaveLength(3);
    });
    test('tapping an item name filters to that thing, with a Show all link', () => {
        JournalView.renderWindow(host(), deps(store()));
        click(host().querySelector('[data-journal-ref]'));
        expect(host().querySelectorAll('.journal-entry')).toHaveLength(1);
        expect(host().querySelector('.journal-filter-note').textContent).toContain('Notes about Write report');
        click(host().querySelector('.journal-clear-btn'));
        expect(host().querySelectorAll('.journal-entry')).toHaveLength(3);
    });
    test('opens already filtered (a run, or a thing)', () => {
        const w = JournalView.renderWindow(host(), deps(store(), { filter: { kind: 'run', run: 4 } }));
        expect(host().querySelectorAll('.journal-entry')).toHaveLength(1);
        expect(host().querySelector('.journal-filter-note').textContent).toContain('run #4');
        expect(w.getState().filter.kind).toBe('run');
    });
    test('a day header shows the day\'s mood faces when moodFor has entries', () => {
        JournalView.renderWindow(host(), deps(store(), { moodFor: (k) => (k === '2026-11-10' ? [[9, 4, 0, 0]] : []) }));
        expect(host().querySelector('[data-journal-day="2026-11-10"] .journal-day-mood')).not.toBeNull();
        expect(host().querySelector('[data-journal-day="2026-11-11"] .journal-day-mood')).toBeNull();
    });
    test('"Show older days" appears past one page and adds the next', () => {
        const s = Journal.fresh();
        for (let i = 0; i < 35; i++) Journal.add(s, { dayKey: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, text: `x${i}`, about: 'general' }, 1000 + i);
        for (let i = 0; i < 10; i++) Journal.add(s, { dayKey: `2026-09-${String(i + 1).padStart(2, '0')}`, text: `y${i}`, about: 'general' }, 5000 + i);
        JournalView.renderWindow(host(), deps(s));
        expect(host().querySelectorAll('.journal-day')).toHaveLength(JournalView.DAYS_PER_PAGE);
        click(host().querySelector('[data-journal-more]'));
        expect(host().querySelectorAll('.journal-day').length).toBeGreaterThan(JournalView.DAYS_PER_PAGE);
        expect(host().querySelector('[data-journal-more]')).toBeNull();
    });
    test('escapes entry text', () => {
        const s = Journal.fresh();
        Journal.add(s, { dayKey: '2026-11-10', text: '<img src=x onerror=alert(1)>', about: 'general' }, 1);
        JournalView.renderWindow(host(), deps(s));
        expect(host().querySelector('.journal-entry-text img')).toBeNull();
        expect(host().querySelector('.journal-entry-text').textContent).toContain('<img');
    });
});

describe('write / edit / delete', () => {
    test('Write a note about today / the game calls onWrite with the kind and a redraw callback (one tick later)', async () => {
        const d = deps(store());
        JournalView.renderWindow(host(), d);
        click(host().querySelector('[data-journal-write="day"]'));
        click(host().querySelector('[data-journal-write="general"]'));
        await tick();
        expect(d.onWrite.mock.calls.map((c) => c[0])).toEqual(['day', 'general']);
        expect(typeof d.onWrite.mock.calls[0][1]).toBe('function');
    });
    test('Edit opens the note window with the text; Save changes calls onEdit and redraws', async () => {
        const s = store();
        const d = deps(s, { onEdit: jest.fn((id, text) => Journal.edit(s, id, text, 9, 2000) || true) });
        JournalView.renderWindow(host(), d);
        click(host().querySelector('[data-journal-edit]'));
        await tick();
        const ta = document.querySelector('[data-journal-text]');
        expect(ta.value).toBe('End of day words');
        ta.value = 'Changed words';
        ta.dispatchEvent(new Event('input'));
        expect(document.querySelector('[data-journal-save]').textContent).toBe('Save changes');
        click(document.querySelector('[data-journal-save]'));
        expect(d.onEdit).toHaveBeenCalledTimes(1);
        expect(host().textContent).toContain('Changed words');
        expect(host().textContent).toContain('edited');
    });
    test('a refused edit keeps the window open with the message', async () => {
        const d = deps(store(), { onEdit: jest.fn(() => false) });
        JournalView.renderWindow(host(), d);
        click(host().querySelector('[data-journal-edit]'));
        await tick();
        document.querySelector('[data-journal-text]').value = 'x';
        click(document.querySelector('[data-journal-save]'));
        expect(document.querySelector('.journal-note-overlay')).not.toBeNull();
        expect(document.querySelector('[data-journal-error]').hidden).toBe(false);
    });
    test('Delete asks first: Keep leaves it, Delete removes it and redraws', async () => {
        const s = store();
        const d = deps(s, { onDelete: jest.fn((id) => Journal.remove(s, id)), confirmDelete: jest.fn(() => Promise.resolve(false)) });
        JournalView.renderWindow(host(), d);
        click(host().querySelector('[data-journal-delete]'));
        await tick();
        expect(d.onDelete).not.toHaveBeenCalled();
        expect(host().querySelectorAll('.journal-entry')).toHaveLength(3);
        d.confirmDelete.mockImplementation(() => Promise.resolve(true));
        click(host().querySelector('[data-journal-delete]'));
        await tick();
        expect(d.onDelete).toHaveBeenCalledTimes(1);
        expect(host().querySelectorAll('.journal-entry')).toHaveLength(2);
    });
    test('without a confirmDelete it uses the in-game Dialog (never a native confirm)', async () => {
        const s = store();
        global.Dialog = { confirm: jest.fn(() => Promise.resolve(true)) };
        const d = deps(s, { onDelete: jest.fn((id) => Journal.remove(s, id)), confirmDelete: undefined });
        JournalView.renderWindow(host(), d);
        click(host().querySelector('[data-journal-delete]'));
        await tick();
        expect(Dialog.confirm).toHaveBeenCalledTimes(1);
        expect(Dialog.confirm.mock.calls[0][1].danger).toBe(true);
        delete global.Dialog;
    });
});

describe('openDayEnd', () => {
    test('today: mounts the host picker, and Save passes the text', async () => {
        const onSave = jest.fn(() => true);
        const mountMood = jest.fn((holder) => { holder.innerHTML = '<p id="picker">faces</p>'; });
        JournalView.openDayEnd({ onSave, mountMood, maxChars: 2000 });
        expect(document.querySelector('.journal-note-title').textContent).toBe('How did today go?');
        expect(mountMood).toHaveBeenCalledTimes(1);
        expect(document.querySelector('#picker')).not.toBeNull();
        document.querySelector('[data-journal-text]').value = 'Decent';
        click(document.querySelector('[data-journal-save]'));
        expect(onSave).toHaveBeenCalledWith('Decent', null);
        expect(document.querySelector('.journal-note-overlay')).toBeNull();
    });
    test('late: five faces, one tap picks the level, Save passes (text, level)', () => {
        const onSave = jest.fn(() => true);
        JournalView.openDayEnd({ late: true, onSave });
        expect(document.querySelector('.journal-note-title').textContent).toBe('How did yesterday go?');
        const btns = document.querySelectorAll('[data-journal-level]');
        expect(btns).toHaveLength(5);
        click(btns[1]);
        expect(btns[1].getAttribute('aria-pressed')).toBe('true');
        click(btns[3]);
        expect(btns[1].getAttribute('aria-pressed')).toBe('false');
        document.querySelector('[data-journal-text]').value = 'Rough';
        click(document.querySelector('[data-journal-save]'));
        expect(onSave).toHaveBeenCalledWith('Rough', Number(btns[3].getAttribute('data-journal-level')));
    });
    test('Skip closes it and calls onClose; a face tap alone does not need text', () => {
        const onClose = jest.fn();
        JournalView.openDayEnd({ late: true, onSave: () => true, onClose });
        click(document.querySelector('[data-journal-level]'));
        click(document.querySelector('[data-journal-skip]'));
        expect(document.querySelector('.journal-note-overlay')).toBeNull();
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe('the "All notes" button', () => {
    const entry = (n) => ({ id: 'j' + n, at: n, text: 't' + n, ref: { kind: 'task', id: 'item:1', name: 'Thing' }, mood: null });
    test('shows only when more notes exist than the block lists', () => {
        const few = [entry(3), entry(2)]; few.total = 2;
        const many = [entry(3), entry(2), entry(1)]; many.total = 7;
        expect(JournalView.itemNotesHtml(few, {})).not.toContain('data-journal-all');
        expect(JournalView.itemNotesHtml(many, {})).toContain('All notes (7)');
        expect(JournalView.itemNotesHtml([entry(1)], {})).not.toContain('data-journal-all');
    });
    test('a tap closes the item window and hands the ref to onAll one tick later', async () => {
        const many = [entry(3), entry(2), entry(1)]; many.total = 7;
        document.body.innerHTML = `<div class="modal-overlay" id="ov">${JournalView.itemNotesHtml(many, {})}</div>`;
        const onAll = jest.fn();
        JournalView.wireItemNotes(document.getElementById('ov'), { getNotes: () => many, onAdd: () => {}, onAll });
        click(document.querySelector('[data-journal-all]'));
        expect(document.getElementById('ov')).toBeNull();
        await tick();
        expect(onAll).toHaveBeenCalledWith({ kind: 'task', id: 'item:1', name: 'Thing' });
    });
});

describe('player panel section', () => {
    const base = () => ({
        level: 2, xp: 10, thresholds: [0, 100, 300], slotsTable: [1, 2, 3], perksTable: [], goalSlotsTable: [2, 3, 4], routines: [], definedHabits: [],
        config: {}, runStartedAtMs: 0,
    });
    test('shows the newest note line and both buttons; Open journal only when there are notes', () => {
        LevelPanel.open(Object.assign(base(), { journal: { count: 2, latest: 'Today · hello there' } }));
        const panel = document.querySelector('.level-panel');
        expect(panel.querySelector('.lp-journal-latest').textContent).toBe('Today · hello there');
        expect(panel.querySelector('[data-action="journal-write"]')).not.toBeNull();
        expect(panel.querySelector('[data-action="journal-open"]')).not.toBeNull();
    });
    test('with no notes: "No notes yet." and no Open button; no ctx.journal = no section', () => {
        LevelPanel.open(Object.assign(base(), { journal: { count: 0, latest: null } }));
        expect(document.querySelector('.lp-journal-latest').textContent).toBe('No notes yet.');
        expect(document.querySelector('[data-action="journal-open"]')).toBeNull();
        document.body.innerHTML = '';
        LevelPanel.open(base());
        expect(document.querySelector('.lp-journal')).toBeNull();
    });
    test('"How did yesterday go?" shows only when the host says it is due, and opens the late window one tick later', async () => {
        const onJournalYesterday = jest.fn();
        LevelPanel.open(Object.assign(base(), { journal: { count: 0, latest: null, yesterday: false }, onJournalYesterday }));
        expect(document.querySelector('[data-action="journal-yesterday"]')).toBeNull();
        document.body.innerHTML = '';
        LevelPanel.open(Object.assign(base(), { journal: { count: 0, latest: null, yesterday: true }, onJournalYesterday }));
        click(document.querySelector('[data-action="journal-yesterday"]'));
        expect(document.querySelector('.level-panel')).toBeNull();
        await tick();
        expect(onJournalYesterday).toHaveBeenCalledTimes(1);
    });
    test('the buttons close the panel and call the host one tick later', async () => {
        const onJournalWrite = jest.fn(); const onJournalOpen = jest.fn();
        LevelPanel.open(Object.assign(base(), { journal: { count: 1, latest: 'x' }, onJournalWrite, onJournalOpen }));
        click(document.querySelector('[data-action="journal-write"]'));
        expect(document.querySelector('.level-panel')).toBeNull();
        await tick();
        expect(onJournalWrite).toHaveBeenCalledTimes(1);
        LevelPanel.open(Object.assign(base(), { journal: { count: 1, latest: 'x' }, onJournalWrite, onJournalOpen }));
        click(document.querySelector('[data-action="journal-open"]'));
        await tick();
        expect(onJournalOpen).toHaveBeenCalledTimes(1);
    });
});

describe('morning card: "How did yesterday go?"', () => {
    const deps0 = (extra) => Object.assign({ getEntries: () => [], onLog: () => {} }, extra || {});
    test('shows the line when getYesterday says so, stamps once via onYesterdayShown, and the button opens the late window', async () => {
        const onYesterdayShown = jest.fn(); const onYesterday = jest.fn();
        MoodView.openMoodCard({ title: 'How are you starting?', deps: deps0({ getYesterday: () => true, onYesterdayShown, onYesterday }) });
        const btn = document.querySelector('[data-mood-yesterday-btn]');
        expect(btn.textContent).toBe('How did yesterday go?');
        expect(onYesterdayShown).toHaveBeenCalledTimes(1);
        click(btn);
        expect(document.querySelector('.mood-card-overlay')).not.toBeNull(); // the card stays; the late window opens on top
        await tick();
        expect(onYesterday).toHaveBeenCalledTimes(1);
    });
    test('no line when not due, or when the host gave no getYesterday', () => {
        MoodView.openMoodCard({ title: 't', deps: deps0({ getYesterday: () => false, onYesterdayShown: jest.fn() }) });
        expect(document.querySelector('[data-mood-yesterday-btn]')).toBeNull();
        document.body.innerHTML = '';
        MoodView.openMoodCard({ title: 't', deps: deps0() });
        expect(document.querySelector('[data-mood-yesterday-btn]')).toBeNull();
    });
});

describe('ManagementWindows: the journal branch', () => {
    test('opening "journal" shows the window and draws the journal into its mount', () => {
        const ManagementWindows = require('../js/ui/managementWindows.js');
        document.body.innerHTML = '<div id="journalWindow" class="management-window hidden"><div id="journalWindowContent"></div></div>';
        const win = document.getElementById('journalWindow');
        const s = Journal.fresh();
        Journal.add(s, { dayKey: '2026-11-10', text: 'Hello journal', about: 'general' }, 1);
        ManagementWindows.openManagementWindow('journal', {
            managementWindows: { journal: win }, closeFabMenu: () => {},
            journalWindow: { getStore: () => s, moodFor: () => [], gameName: 'Deadline', maxChars: 2000 },
        });
        expect(win.classList.contains('hidden')).toBe(false);
        expect(document.getElementById('journalWindowContent').textContent).toContain('Hello journal');
    });
});

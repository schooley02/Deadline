/**
 * @jest-environment jsdom
 *
 * Journal "By run" view (2026-11-13, Jeremy: "add a per run grouping"): Journal.groupByRun and the window's By day / By run toggle,
 * the run header (Run N, dates, note count, Open), run-level notes first, paging by run.
 */
global.Mood = require('../js/mood.js');
global.Modal = require('../js/ui/modal.js');
Modal.initDismissHandlers({ closeAllManagementWindows: () => {}, closeFabMenu: () => {}, isAnyManagementWindowOpen: () => false });
const Journal = global.Journal = require('../js/journal.js');
const JournalView = require('../js/ui/journalView.js');
global.JournalView = JournalView;

const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
beforeEach(() => { document.body.innerHTML = '<div id="host"></div>'; });
const host = () => document.getElementById('host');

function store() {
    const s = Journal.fresh();
    Journal.add(s, { dayKey: '2026-11-01', text: 'r2 task note', about: 'item', ref: { kind: 'task', id: 'item:1', name: 'Alpha' }, run: 2 }, 1000);
    Journal.add(s, { dayKey: '2026-11-03', text: 'r2 run note', about: 'general', run: 2 }, 2000);
    Journal.add(s, { dayKey: '2026-11-05', text: 'r2 day note', about: 'day', run: 2 }, 3000);
    Journal.add(s, { dayKey: '2026-11-10', text: 'r3 day note', about: 'day', run: 3 }, 4000);
    Journal.add(s, { dayKey: '2026-10-20', text: 'old', about: 'day', run: 1 }, 500);
    Journal.add(s, { dayKey: '2026-10-01', text: 'no run', about: 'day', run: 0 }, 100);
    return s;
}
const entries = (s) => Journal.filter(s, { kind: 'all' });

describe('Journal.groupByRun', () => {
    test('newest run first, no-run last; dates, count, run-level notes apart from the day blocks', () => {
        const g = Journal.groupByRun(entries(store()));
        expect(g.map((x) => x.run)).toEqual([3, 2, 1, 0]);
        const r2 = g.find((x) => x.run === 2);
        expect([r2.first, r2.last, r2.count]).toEqual(['2026-11-01', '2026-11-05', 3]);
        expect(r2.notes.map((e) => e.text)).toEqual(['r2 run note']);
        expect(r2.days.map((d) => d.day)).toEqual(['2026-11-05', '2026-11-01']);
        expect(r2.days.every((d) => d.entries.every((e) => e.about !== 'general'))).toBe(true);
    });
    test('empty and junk input', () => {
        expect(Journal.groupByRun([])).toEqual([]);
        expect(Journal.groupByRun(null)).toEqual([]);
    });
});

describe('the window', () => {
    test('starts By day; the toggle switches to run blocks and back', () => {
        JournalView.renderWindow(host(), { getStore: store, moodFor: () => [], gameName: 'Deadline', maxChars: 2000 });
        expect(host().querySelector('[data-journal-run-block]')).toBeNull();
        expect(host().querySelector('[data-journal-view="day"]').getAttribute('aria-pressed')).toBe('true');
        click(host().querySelector('[data-journal-view="run"]'));
        const blocks = Array.from(host().querySelectorAll('[data-journal-run-block]')).map((b) => b.getAttribute('data-journal-run-block'));
        expect(blocks).toEqual(['3', '2', '1', '0']);
        expect(host().querySelector('[data-journal-view="run"]').getAttribute('aria-pressed')).toBe('true');
        click(host().querySelector('[data-journal-view="day"]'));
        expect(host().querySelector('[data-journal-run-block]')).toBeNull();
    });

    test('a run header shows Run #N, the note count and Open; the run-level notes come first', () => {
        JournalView.renderWindow(host(), { getStore: store, moodFor: () => [], gameName: 'Deadline', maxChars: 2000, words: { title: 'Notes about this run' } });
        click(host().querySelector('[data-journal-view="run"]'));
        const r2 = host().querySelector('[data-journal-run-block="2"]');
        expect(r2.querySelector('.journal-run-head').textContent).toMatch(/Run #2/);
        expect(r2.querySelector('.journal-run-head').textContent).toMatch(/3 notes/);
        expect(r2.querySelector('[data-journal-run="2"]')).toBeTruthy();
        const kids = Array.from(r2.children).map((c) => c.className.split(' ')[0]);
        expect(kids).toEqual(['journal-run-head', 'journal-run-notes', 'journal-day', 'journal-day']);
        expect(r2.querySelector('.journal-run-notes').textContent).toContain('r2 run note');
        expect(host().querySelector('[data-journal-run-block="0"] [data-journal-run]')).toBeNull(); // no run: nothing to open
    });

    test('Open filters to that one run (the existing run filter) and Show all clears it', () => {
        JournalView.renderWindow(host(), { getStore: store, moodFor: () => [], gameName: 'Deadline', maxChars: 2000 });
        click(host().querySelector('[data-journal-view="run"]'));
        click(host().querySelector('[data-journal-run="2"]'));
        expect(Array.from(host().querySelectorAll('[data-journal-run-block]')).map((b) => b.getAttribute('data-journal-run-block'))).toEqual(['2']);
        expect(host().textContent).toContain('Notes from run #2');
        click(host().querySelector('.journal-clear-btn'));
        expect(host().querySelectorAll('[data-journal-run-block]').length).toBe(4);
    });

    test('pages by run: ten at a time, "Show older runs"', () => {
        const big = () => { const s = Journal.fresh(); for (let r = 1; r <= 13; r++) Journal.add(s, { dayKey: `2026-10-${String(r).padStart(2, '0')}`, text: 'n' + r, about: 'day', run: r }, r); return s; };
        JournalView.renderWindow(host(), { getStore: big, moodFor: () => [], gameName: 'Deadline', maxChars: 2000 });
        click(host().querySelector('[data-journal-view="run"]'));
        expect(host().querySelectorAll('[data-journal-run-block]').length).toBe(JournalView.RUNS_PER_PAGE);
        const more = host().querySelector('[data-journal-more]');
        expect(more.textContent).toBe('Show older runs');
        click(more);
        expect(host().querySelectorAll('[data-journal-run-block]').length).toBe(13);
        expect(host().querySelector('[data-journal-more]')).toBeNull();
    });

    test('an empty store shows the empty message in both views', () => {
        JournalView.renderWindow(host(), { getStore: () => Journal.fresh(), moodFor: () => [], gameName: 'Deadline', maxChars: 2000 });
        click(host().querySelector('[data-journal-view="run"]'));
        expect(host().querySelector('.journal-empty')).toBeTruthy();
    });
});

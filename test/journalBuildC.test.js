/**
 * @jest-environment jsdom
 *
 * Journal Build C (2026-11-13; docs/JOURNAL_PLAN.md): the "Journal and notes" topic in How Deadline works, the "Add a note" link on the
 * auto-stop notice, and the fading "Add a note" chip after finishing a task with its timer running.
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
global.Habits = require('../js/habits.js');
global.Heroes = require('../js/heroes.js');
global.PointsInfo = require('../js/pointsInfo.js');
global.Pushback = require('../js/pushback.js');
global.PushbackHelp = require('../js/ui/pushbackHelp.js');
global.Modal = require('../js/ui/modal.js');
global.Timer = require('../js/timer.js');
global.Clock = require('../js/clock.js');
global.Mood = require('../js/mood.js');
global.Forms = require('../js/ui/forms.js');
const HowItWorks = require('../js/ui/howItWorks.js');
const JournalView = require('../js/ui/journalView.js');
const TimerView = require('../js/ui/timerView.js');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 5));
beforeEach(() => { document.body.innerHTML = ''; });

describe('the Journal topic', () => {
    const topic = (cfg) => HowItWorks.topics(cfg || CONFIG).find((t) => t.id === 'journal');
    const text = (cfg) => { const t = topic(cfg); return [].concat(t.what, t.why).join(' '); };

    test('is the last topic and is registered for the (i) buttons', () => {
        const ids = HowItWorks.topics(CONFIG).map((t) => t.id);
        expect(ids[ids.length - 1]).toBe('journal');
        expect(HowItWorks.TOPIC_IDS).toContain('journal');
    });

    test('says it is optional, earns nothing, and stays on the device', () => {
        expect(text()).toMatch(/always optional/);
        expect(text()).toMatch(/earn no points, XP or items/);
        expect(text()).toMatch(/stay on this device/);
        expect(text()).toMatch(/Backup & Transfer/);
        expect(topic().why).toBeTruthy();
    });

    test('its numbers come from CONFIG (a retuned value changes the page)', () => {
        const retuned = Object.assign({}, CONFIG, { JOURNAL: Object.assign({}, CONFIG.JOURNAL, { MAX_CHARS: 1234, TIMER_NOTE_MIN_MS: 90000 }) });
        expect(text(retuned)).toContain('1234 characters');
        expect(text(retuned)).toContain('at least 90 seconds');
        expect(text()).toContain(`${CONFIG.JOURNAL.MAX_CHARS} characters`);
        expect(text()).toContain(`at least ${Math.round(CONFIG.JOURNAL.TIMER_NOTE_MIN_MS / 1000)} seconds`);
    });

    test('the Journal window title carries the (i) button', () => {
        expect(read('index.html')).toMatch(/id="journalWindowTitle">Journal <button[^>]*data-hiw-topic="journal"/);
    });
});

describe('the auto-stop notice "Add a note" link', () => {
    const item = { id: 'i1', name: 'Write report', type: 'task' };
    test('shows only when the host passes onNote, and tapping it calls onNote without closing the notice', async () => {
        const onNote = jest.fn();
        TimerView.showAutoStopped(item, { sessionMs: 600000, totalMs: 600000 }, { onNote, onEdit: jest.fn(), onKeep: jest.fn(), onDelete: jest.fn() });
        const link = document.getElementById('autoStopNote');
        expect(link).toBeTruthy();
        click(link);
        expect(onNote).not.toHaveBeenCalled(); // one tick later, so the click finishes bubbling first
        await tick();
        expect(onNote).toHaveBeenCalledTimes(1);
        expect(document.getElementById('autoStopOverlay')).toBeTruthy(); // the notice is still there
        expect(document.getElementById('autoStopKeep')).toBeTruthy();
    });

    test('no link without a handler', () => {
        TimerView.showAutoStopped(item, { sessionMs: 600000, totalMs: 600000 }, { onEdit: jest.fn(), onKeep: jest.fn(), onDelete: jest.fn() });
        expect(document.getElementById('autoStopNote')).toBeNull();
    });
});

describe('the completion chip', () => {
    test('appears, opens the note on tap (one tick later) and is removed', async () => {
        const onTap = jest.fn();
        const chip = JournalView.showChip({ text: 'Add a note', onTap });
        expect(document.querySelectorAll('.journal-chip-toast').length).toBe(1);
        click(chip);
        expect(document.querySelector('.journal-chip-toast')).toBeNull();
        await tick();
        expect(onTap).toHaveBeenCalledTimes(1);
    });

    test('fades by itself and never calls onTap', async () => {
        const onTap = jest.fn();
        JournalView.showChip({ onTap, ms: 10 });
        await tick(20);
        expect(document.querySelector('.journal-chip-toast--out')).toBeTruthy();
        await tick(450);
        expect(document.querySelector('.journal-chip-toast')).toBeNull();
        expect(onTap).not.toHaveBeenCalled();
    });

    test('a new chip replaces the old one', () => {
        JournalView.showChip({ onTap: () => {} });
        JournalView.showChip({ onTap: () => {} });
        expect(document.querySelectorAll('.journal-chip-toast').length).toBe(1);
    });
});

describe('wiring pins', () => {
    const items = read('js/items.js');
    const script = read('script.js');
    test('completeItem keeps the stopped span and reports it through deps.onTimedCompletion', () => {
        expect(items).toMatch(/stoppedSpanMs = Timer\.stop\(item, Date\.now\(\)\)/);
        expect(items).toMatch(/deps\.onTimedCompletion\(item, stoppedSpanMs\)/);
    });
    test('script.js hooks the chip and the auto-stop link, both obeying the same Settings switch and minimum', () => {
        expect(script).toMatch(/onTimedCompletion: \(item, spanMs\) => offerCompletionNoteChip\(item, spanMs\)/);
        expect(script).toMatch(/onNote: \(\) => openItemNote\(item, \{ src: 'timer'/);
        const fn = script.slice(script.indexOf('function offerCompletionNoteChip'));
        expect(fn.slice(0, 700)).toMatch(/noteOnTimerStop === false/);
        expect(fn.slice(0, 700)).toMatch(/TIMER_NOTE_MIN_MS/);
        expect(fn.slice(0, 1200)).toMatch(/src: 'complete'/);
    });
    test('the service worker is bumped and the css has the chip', () => {
        expect(read('sw.js')).toMatch(/deadline-shell-v365/);
        expect(read('css/journal.css')).toMatch(/\.journal-chip-toast/);
    });
});

/**
 * @jest-environment jsdom
 *
 * MoodHelp + the help card / run-of-lows line (W1b Build B2, 2026-11-13).
 */
const fs = require('fs');
const path = require('path');
global.Mood = require('../js/mood.js');
global.Modal = require('../js/ui/modal.js');
const MoodHelp = require('../js/moodHelp.js');
global.MoodHelp = MoodHelp;
const MoodView = require('../js/ui/moodView.js');

const at = (h) => new Date(2026, 10, 13, h, 5).getTime();
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const e = (hour, level) => [hour, level, 0, 0];
afterEach(() => { document.body.innerHTML = ''; });

describe('helpModel', () => {
    test('only low levels (1, 2) get a card', () => {
        [3, 4, 5, 0, null, undefined, 2.5].forEach((l) => expect(MoodHelp.helpModel(l, [])).toBeNull());
        expect(MoodHelp.helpModel(2, [])).not.toBeNull();
        expect(MoodHelp.helpModel(1, [])).not.toBeNull();
    });
    test('no feeling word -> the general line; always the two buttons', () => {
        const m = MoodHelp.helpModel(1, []);
        expect(m.feeling).toBeNull();
        expect(m.line).toBe(MoodHelp.FALLBACK_LINE);
        expect(m.actions.map((a) => a.id)).toEqual(['agenda', 'add10']);
    });
    test('each feeling points at its lever', () => {
        expect(MoodHelp.helpModel(1, ['overwhelmed']).line).toMatch(/3 priorities.*sub-tasks/);
        expect(MoodHelp.helpModel(2, ['unmotivated']).line).toMatch(/first step.*timer/);
        expect(MoodHelp.helpModel(2, ['anxious']).line).toMatch(/priority.*smaller pieces/);
        expect(MoodHelp.helpModel(2, ['stressed']).line).toMatch(/priority.*smaller pieces/);
        expect(MoodHelp.helpModel(1, ['exhausted']).line).toMatch(/light day.*Sick Day/);
        expect(MoodHelp.helpModel(2, ['sad']).line).toBe('Cut yourself some slack today. A break is allowed.');
        expect(MoodHelp.helpModel(1, ['down']).line).toBe('Cut yourself some slack today. A break is allowed.');
    });
    test('with two words the higher-priority one wins, whatever the pick order', () => {
        expect(MoodHelp.helpModel(2, ['sad', 'overwhelmed']).feeling).toBe('overwhelmed');
        expect(MoodHelp.helpModel(2, ['overwhelmed', 'sad']).feeling).toBe('overwhelmed');
    });
    test('a word with no line (angry) falls back to the general line', () => {
        expect(MoodHelp.helpModel(1, ['angry']).line).toBe(MoodHelp.FALLBACK_LINE);
    });
});

describe('low days and the streak', () => {
    test('a day is low when its CLOSING entry is Bad / Awful', () => {
        expect(MoodHelp.isLowDay([e(8, 2)])).toBe(true);
        expect(MoodHelp.isLowDay([e(8, 5), e(20, 1)])).toBe(true);
        expect(MoodHelp.isLowDay([e(8, 1), e(20, 4)])).toBe(false);
        expect(MoodHelp.isLowDay([])).toBe(false);
        expect(MoodHelp.isLowDay(undefined)).toBe(false);
    });
    const days = (m) => (k) => m[k] || [];
    test('three low days in a row, counting back from today', () => {
        const f = days({ '2026-11-13': [e(9, 2)], '2026-11-12': [e(9, 1)], '2026-11-11': [e(9, 2)], '2026-11-10': [e(9, 4)] });
        expect(MoodHelp.lowStreak('2026-11-13', f)).toBe(3);
    });
    test('today with no check-in yet is skipped, not a break', () => {
        const f = days({ '2026-11-12': [e(9, 2)], '2026-11-11': [e(9, 1)], '2026-11-10': [e(9, 2)] });
        expect(MoodHelp.lowStreak('2026-11-13', f)).toBe(3);
    });
    test('a past day with no check-in ends the streak', () => {
        const f = days({ '2026-11-13': [e(9, 2)], '2026-11-12': [e(9, 2)], '2026-11-10': [e(9, 2)] });
        expect(MoodHelp.lowStreak('2026-11-13', f)).toBe(2);
    });
    test('a non-low day ends it; bad input gives 0', () => {
        expect(MoodHelp.lowStreak('2026-11-13', days({ '2026-11-13': [e(9, 3)] }))).toBe(0);
        expect(MoodHelp.lowStreak('nope', days({}))).toBe(0);
        expect(MoodHelp.lowStreak('2026-11-13', null)).toBe(0);
    });
    test('month boundaries are walked by calendar day', () => {
        const f = days({ '2026-12-01': [e(9, 2)], '2026-11-30': [e(9, 2)], '2026-11-29': [e(9, 2)] });
        expect(MoodHelp.lowStreak('2026-12-01', f)).toBe(3);
    });
});

describe('lowsCardDue', () => {
    test('needs 3 days', () => {
        expect(MoodHelp.lowsCardDue(2, null, '2026-11-13')).toBe(false);
        expect(MoodHelp.lowsCardDue(3, null, '2026-11-13')).toBe(true);
    });
    test('at most once every 7 days', () => {
        expect(MoodHelp.lowsCardDue(5, '2026-11-07', '2026-11-13')).toBe(false);
        expect(MoodHelp.lowsCardDue(5, '2026-11-06', '2026-11-13')).toBe(true);
        expect(MoodHelp.lowsCardDue(5, '2026-11-13', '2026-11-13')).toBe(false);
    });
    test('the line is gentle and names no hotline or number', () => {
        expect(MoodHelp.LOWS_LINE).toMatch(/talk to someone you trust/);
        expect(MoodHelp.LOWS_LINE).not.toMatch(/\d/);
    });
});

describe('the help card in the picker', () => {
    const mountIt = (extra) => {
        document.body.innerHTML = '<div id="m"></div>';
        const calls = { actions: [], shown: 0 };
        const deps = Object.assign({
            getEntries: () => [], onLog: () => {}, now: () => at(9),
            helpAllowed: () => true, onHelpShown: () => { calls.shown += 1; },
            onHelpAction: (id) => calls.actions.push(id),
        }, extra);
        MoodView.mount(document.getElementById('m'), deps);
        return { box: document.getElementById('m'), calls };
    };
    const face = (box, level) => click(box.querySelector(`[data-mood-level="${level}"]`));

    test('a high or meh face shows no card', () => {
        const { box } = mountIt();
        face(box, 5);
        face(box, 3);
        expect(box.querySelector('.mood-help')).toBeNull();
    });
    test('opening the picker on an already-low day shows no card until a tap', () => {
        const { box, calls } = mountIt({ getEntries: () => [[8, 2, 0, 0]] });
        expect(box.querySelector('.mood-help')).toBeNull();
        expect(calls.shown).toBe(0);
    });
    test('a Bad tap shows the card with both buttons and stamps the day once', () => {
        const { box, calls } = mountIt();
        face(box, 2);
        expect(box.querySelector('.mood-help')).not.toBeNull();
        expect(box.querySelector('[data-mood-help="agenda"]')).not.toBeNull();
        expect(box.querySelector('[data-mood-help="add10"]')).not.toBeNull();
        face(box, 1);
        expect(calls.shown).toBe(1);
    });
    test('the line follows the picked feeling word', () => {
        const { box } = mountIt();
        face(box, 1);
        click(box.querySelector('[data-mood-feeling="overwhelmed"]'));
        expect(box.querySelector('.mood-help-line').textContent).toMatch(/3 priorities/);
    });
    test('already used today (helpAllowed false) -> no card', () => {
        const { box, calls } = mountIt({ helpAllowed: () => false });
        face(box, 1);
        expect(box.querySelector('.mood-help')).toBeNull();
        expect(calls.shown).toBe(0);
    });
    test('a better face hides it; going low again in the same view brings it back without a second stamp', () => {
        const { box, calls } = mountIt();
        face(box, 2);
        face(box, 4);
        expect(box.querySelector('.mood-help')).toBeNull();
        face(box, 1);
        expect(box.querySelector('.mood-help')).not.toBeNull();
        expect(calls.shown).toBe(1);
    });
    test('"Not now" hides it for the rest of the view', () => {
        const { box } = mountIt();
        face(box, 2);
        click(box.querySelector('[data-mood-help="dismiss"]'));
        expect(box.querySelector('.mood-help')).toBeNull();
        face(box, 1);
        expect(box.querySelector('.mood-help')).toBeNull();
    });
    test('Add a 10-minute task fires once, then the button becomes a note', () => {
        const { box, calls } = mountIt();
        face(box, 2);
        click(box.querySelector('[data-mood-help="add10"]'));
        expect(calls.actions).toEqual(['add10']);
        expect(box.querySelector('[data-mood-help="add10"]')).toBeNull();
        expect(box.querySelector('.mood-help-added').textContent).toBe('Added to your list.');
        expect(box.querySelector('.mood-help')).not.toBeNull();
    });
    test('Open my agenda closes the window it is in and calls back', () => {
        document.body.innerHTML = '';
        const calls = [];
        const overlay = MoodView.openMoodCard({ deps: { getEntries: () => [], onLog: () => {}, helpAllowed: () => true, onHelpAction: (id) => calls.push(id) } });
        click(overlay.querySelector('[data-mood-level="2"]'));
        click(overlay.querySelector('[data-mood-help="agenda"]'));
        expect(calls).toEqual(['agenda']);
        expect(document.querySelector('.mood-card-overlay')).toBeNull();
    });
    test('taps on the help card do not close the host window (outside-click trap)', () => {
        const overlay = MoodView.openMoodCard({ deps: { getEntries: () => [], onLog: () => {}, helpAllowed: () => true, onHelpAction: () => {} } });
        click(overlay.querySelector('[data-mood-level="1"]'));
        click(overlay.querySelector('[data-mood-help="add10"]'));
        click(overlay.querySelector('[data-mood-help="dismiss"]'));
        expect(document.querySelector('.mood-card-overlay')).not.toBeNull();
    });
});

describe('the run-of-lows line on the morning card', () => {
    test('shown above the faces and stamped when getLows returns a line', () => {
        let stamped = 0;
        const overlay = MoodView.openMoodCard({ deps: { getEntries: () => [], onLog: () => {}, getLows: () => MoodHelp.LOWS_LINE, onLowsShown: () => { stamped += 1; } } });
        expect(overlay.querySelector('.mood-lows').textContent).toBe(MoodHelp.LOWS_LINE);
        expect(stamped).toBe(1);
    });
    test('nothing when getLows returns null', () => {
        let stamped = 0;
        const overlay = MoodView.openMoodCard({ deps: { getEntries: () => [], onLog: () => {}, getLows: () => null, onLowsShown: () => { stamped += 1; } } });
        expect(overlay.querySelector('.mood-lows')).toBeNull();
        expect(stamped).toBe(0);
    });
});

describe('wiring', () => {
    const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
    test('script.js feeds the help card and the lows line; the stamps are not in settings or the export', () => {
        const js = read('script.js');
        expect(js).toMatch(/helpAllowed: \(\) => moodStamps\(\)\.help/);
        expect(js).toContain('onHelpAction');
        expect(js).toContain('MoodHelp.lowStreak(key, moodForDay)');
        expect(js).toContain("'deadline.moodStamps'");
        expect(js).toMatch(/function addFigureItOutTask\(\)/);
    });
    test('the module is loaded and cached', () => {
        expect(read('index.html')).toContain('<script src="js/moodHelp.js"></script>');
        expect(read('sw.js')).toContain("'js/moodHelp.js'");
    });
    test('MoodHelp stays theme-neutral (no zombie / church / village / survivor words)', () => {
        const src = read('js/moodHelp.js').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(src).not.toMatch(/zombie|church|village|survivor/i);
    });
});

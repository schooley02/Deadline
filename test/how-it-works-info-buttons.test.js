/**
 * @jest-environment jsdom
 *
 * Inline (i) buttons for "How Deadline works" (2026-11-03). One shared helper (`HowItWorks.buttonHtml`) plus ONE
 * capture-phase document listener, used in four places: the habit popup and the streak notice (Streaks), the Heroes
 * popup and the Routines window (Hero ranking), Stats > Achievements (Achievements).
 *
 * The behaviour that matters: a tap on the button opens the window on that topic, and it must NOT also reach Modal's
 * bubbling outside-click dismiss (which would close the popup/window the button sits in) or a row's own tap handler.
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
global.Habits = require('../js/habits.js');
global.Heroes = require('../js/heroes.js');
global.PointsInfo = require('../js/pointsInfo.js');
global.Pushback = require('../js/pushback.js');
global.PushbackHelp = require('../js/ui/pushbackHelp.js');
// popups.js and frozenNotice.js look HowItWorks up as a bare global (a classic <script> const in the browser).
const HowItWorks = global.HowItWorks = require('../js/ui/howItWorks.js');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let opened;
beforeEach(() => {
    opened = [];
    document.body.innerHTML = '';
    // Modal.open is the only DOM dependency of HowItWorks.open; a stub records what was shown.
    global.Modal = {
        open: jest.fn((html, opts) => {
            opened.push({ html, opts });
            const el = document.createElement('div');
            el.innerHTML = html;
            document.body.appendChild(el);
            return el;
        }),
    };
});
afterEach(() => { delete global.Modal; });

describe('buttonHtml', () => {
    test('builds a labelled (i) button for every topic id the window has', () => {
        const ids = HowItWorks.topics(CONFIG).map(t => t.id);
        expect(HowItWorks.TOPIC_IDS).toEqual(ids);
        ids.forEach((id) => {
            const html = HowItWorks.buttonHtml(id, 'How ' + id + ' works');
            expect(html).toContain('class="hiw-info-btn"');
            expect(html).toContain(`data-hiw-topic="${id}"`);
            expect(html).toContain('type="button"');
            expect(html).toContain(`aria-label="How ${id} works"`);
        });
    });

    test('an unknown topic id gives no button, and the label is escaped', () => {
        expect(HowItWorks.buttonHtml('nope')).toBe('');
        expect(HowItWorks.buttonHtml('streaks', 'a "quoted" <b>')).not.toContain('<b>');
        expect(HowItWorks.buttonHtml('streaks')).toContain('aria-label="How this works"');
    });
});

describe('tapping an (i)', () => {
    const mount = (inner) => { document.body.innerHTML = inner; };

    test('opens the window with that topic expanded', () => {
        mount(`<p id="host">Streak: 3 ${HowItWorks.buttonHtml('streaks')}</p>`);
        document.querySelector('.hiw-info-btn').click();
        expect(Modal.open).toHaveBeenCalledTimes(1);
        const html = opened[0].html;
        expect(html).toMatch(/<details class="hiw-topic" data-topic="streaks" open>/);
        // only the asked-for topic starts open
        expect(html.match(/ open>/g)).toHaveLength(1);
        expect(opened[0].opts.dedupeSelector).toBe('.hiw-overlay');
    });

    test.each(HowItWorks.TOPIC_IDS)('topic %s opens expanded', (id) => {
        mount(HowItWorks.buttonHtml(id));
        document.querySelector('.hiw-info-btn').click();
        expect(opened[0].html).toContain(`data-topic="${id}" open>`);
    });

    test('Modal\'s bubbling outside-click dismiss never sees the tap (it would close the popup under it)', () => {
        const dismiss = jest.fn();
        document.addEventListener('click', dismiss); // stands in for Modal.initDismissHandlers
        mount(HowItWorks.buttonHtml('heroes'));
        document.querySelector('.hiw-info-btn').click();
        expect(Modal.open).toHaveBeenCalledTimes(1);
        expect(dismiss).not.toHaveBeenCalled();
        document.removeEventListener('click', dismiss);
    });

    test('a tap inside a tappable row does not also fire the row\'s own handler', () => {
        const rowTap = jest.fn();
        mount(`<div id="row">Hero ${HowItWorks.buttonHtml('heroes')}</div>`);
        document.getElementById('row').addEventListener('click', rowTap);
        document.querySelector('.hiw-info-btn').click();
        expect(Modal.open).toHaveBeenCalledTimes(1);
        expect(rowTap).not.toHaveBeenCalled();
    });

    test('other clicks are left alone', () => {
        const dismiss = jest.fn();
        document.addEventListener('click', dismiss);
        mount('<button id="plain">x</button><span class="hiw-info-btn">no topic</span>');
        document.getElementById('plain').click();
        document.querySelector('span.hiw-info-btn').click();
        expect(Modal.open).not.toHaveBeenCalled();
        expect(dismiss).toHaveBeenCalledTimes(2);
        document.removeEventListener('click', dismiss);
    });
});

describe('where the buttons are', () => {
    test('index.html: the Heroes popup and Routines window carry heroes, Stats > Achievements carries achievements, Stats > Goals carries goals', () => {
        const html = read('index.html');
        const found = [...html.matchAll(/data-hiw-topic="([a-z]+)"/g)].map(m => m[1]);
        expect(found.slice().sort()).toEqual(['achievements', 'goals', 'heroes', 'heroes']);
        found.forEach(id => expect(HowItWorks.TOPIC_IDS).toContain(id));
        // each one sits in its own header
        expect(html).toMatch(/<h3>Heroes <button[^>]*data-hiw-topic="heroes"/);
        expect(html).toMatch(/<h3 id="routinesWindowTitle">Routines<\/h3>\s*<button[^>]*hiw-info-btn--title[^>]*data-hiw-topic="heroes"/);
        expect(html).toMatch(/<h4 class="stats-history-heading">Achievements <button[^>]*data-hiw-topic="achievements"/);
        expect(html).toMatch(/<h4 class="stats-history-heading">Goals <button[^>]*data-hiw-topic="goals"/);
    });

    test('index.html keeps its CRLF line endings (the file on the device is CRLF)', () => {
        const html = read('index.html');
        expect(html.split('\n').length - 1).toBe(html.split('\r\n').length - 1);
    });

    test('the streak notice carries a Streaks button (both tiers)', () => {
        const FrozenNotice = require('../js/ui/frozenNotice.js');
        ['fire', 'blazing'].forEach((tier) => {
            opened.length = 0;
            FrozenNotice.showStreakMilestoneNotice('Run', tier === 'fire' ? 3 : 7, tier);
            expect(opened).toHaveLength(1);
            expect(opened[0].html).toContain('data-hiw-topic="streaks"');
            // inside the body paragraph, before the Nice button
            expect(opened[0].html).toMatch(/streak[^<]*<button[^>]*hiw-info-btn/);
        });
    });

    test('popups.js and the popup markup: a habit\'s Streak line gets the button, a task has none', () => {
        const Popups = require('../js/ui/popups.js');
        const base = {
            name: 'Thing', category: 'other', isHighPriority: false, streak: 3,
            dueDateTime: new Date(2026, 10, 3, 18, 0, 0), creationTime: new Date(2026, 10, 3, 9, 0, 0),
        };
        const deps = { definedHabits: () => [], categoryStyles: { other: { bgColor: '#ccc' } } };
        const render = (item) => {
            opened.length = 0;
            try { Popups.showTaskDetailsPopup(item, deps); } catch (e) { /* later DOM wiring; the markup is already captured */ }
            return opened[0] ? opened[0].html : '';
        };
        const habit = render({ ...base, id: 'h1', type: 'habit', definitionId: 'hd1' });
        expect(habit).toMatch(/<strong>Streak:<\/strong> 3<button[^>]*data-hiw-topic="streaks"/);
        const task = render({ ...base, id: 't1', type: 'task' });
        expect(task).not.toContain('data-hiw-topic');
    });

    test('the button is styled in css/howItWorks.css, which loads before responsive.css', () => {
        expect(read('css/howItWorks.css')).toMatch(/\.hiw-info-btn\s*\{/);
        const idx = read('index.html');
        const hiw = idx.indexOf('<link rel="stylesheet" href="css/howItWorks.css">');
        const responsive = idx.indexOf('<link rel="stylesheet" href="css/responsive.css">');
        expect(hiw).toBeGreaterThan(-1);
        expect(hiw).toBeLessThan(responsive);
    });
});

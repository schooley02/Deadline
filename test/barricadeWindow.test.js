/**
 * The Barricade window (Momentum Build B, 2026-11-11; js/ui/barricadeWindow.js, docs/MOMENTUM_PLAN.md). Pure words + markup, the week-strip
 * mark and the wiring. `open` is DOM and live-checked.
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
global.Momentum = require('../js/momentum.js');
global.HowItWorks = require('../js/ui/howItWorks.js');
global.PointsInfo = require('../js/pointsInfo.js');
global.Pushback = require('../js/pushback.js');
global.PushbackHelp = require('../js/ui/pushbackHelp.js');
const BarricadeWindow = require('../js/ui/barricadeWindow.js');
const PrioritySlotsView = require('../js/ui/prioritySlotsView.js');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const info = (over) => Object.assign({
    count: 4, max: 7, state: { id: 'partial', name: 'Partial', min: 3 }, today: 'pending', todayKey: '2026-11-11',
    nights: [{ date: '2026-11-09', status: 'defended' }, { date: '2026-11-10', status: 'missed' }],
}, over || {});

describe('the words', () => {
    test("the approved wording is used verbatim: Finish 1 priority or 1 routine to secure today's momentum.", () => {
        expect(BarricadeWindow.SECURE_TEXT).toBe("Finish 1 priority or 1 routine to secure today's momentum.");
        expect(BarricadeWindow.todayLine(info())).toBe("Today: not yet secured. Finish 1 priority or 1 routine to secure today's momentum.");
        expect(PrioritySlotsView.explainerText({ left: 2 }, 3, 'today')).toContain("Finish 1 priority or 1 routine to secure today's momentum.");
    });
    test('secured and Sick Day lines', () => {
        expect(BarricadeWindow.todayLine(info({ today: 'secured' }))).toContain('Today is secured');
        expect(BarricadeWindow.todayLine(info({ today: 'excused' }))).toContain('Sick Day');
    });
    test('the fallen line shows only when the barricade is None after a missed night, and never when today is secured', () => {
        const none = { id: 'none', name: 'None', min: 0 };
        expect(BarricadeWindow.hasFallen(info({ state: none, count: 0 }))).toBe(true);
        expect(BarricadeWindow.hasFallen(info({ state: none, count: 0, today: 'secured' }))).toBe(false);
        expect(BarricadeWindow.hasFallen(info())).toBe(false);
        expect(BarricadeWindow.FALLEN_TEXT).toBe('The barricade fell while you were away. Finish a priority or a routine to start building it again.');
    });
    test('night labels are local-calendar days', () => {
        expect(BarricadeWindow.nightLabel({ date: '2026-11-09' })).toBe('Mon 9');
        expect(BarricadeWindow.nightLabel({ date: 'nope' })).toBe('');
    });
});

describe('windowHtml', () => {
    test('shows N of 7, the state, today, the nights and the notes; has a dialog role and a close x', () => {
        const html = BarricadeWindow.windowHtml(info());
        expect(html).toContain('4 of 7');
        expect(html).toContain('Partial');
        expect(html).toContain('not yet secured');
        expect(html).toContain('barricade-night--defended');
        expect(html).toContain('barricade-night--missed');
        expect(html).toContain('whether you opened the game or not');
        expect(html).toContain('A Sick Day is skipped');
        expect(html).toContain('role="dialog"');
        expect(html).toContain('modal-close-x');
        expect(html).toContain('data-hiw-topic="momentum"');
    });
    test('no nights yet is a plain line, and bad input never throws', () => {
        expect(BarricadeWindow.windowHtml(info({ nights: [] }))).toContain('No nights yet');
        expect(() => BarricadeWindow.windowHtml(null)).not.toThrow();
    });
    test('text from the data is escaped', () => {
        const html = BarricadeWindow.windowHtml(info({ state: { id: 'x"y', name: '<b>' } }));
        expect(html).not.toContain('<b>');
        expect(html).toContain('&lt;b&gt;');
    });
});

describe('wiring', () => {
    test("Today's week-strip cell carries the mark; its tap opens the window and does not move the pager", () => {
        const src = read('js/ui/dayPagerView.js');
        expect(src).toContain("entry.offset === 0 ? momentumMarkHtml() : ''");
        expect(src).toContain('week-strip-momentum--${t}');
        expect(src).toMatch(/closest\('\.week-strip-momentum'\)[\s\S]{0,260}deps\.onMomentumTap\(\);\s*return;/);
        const script = read('script.js');
        expect(script).toContain('getMomentum: () => momentumNow(),');
        expect(script).toContain('onMomentumTap: openBarricadeWindow,');
        expect(script).toContain('Momentum.momentum({');
    });
    test('the script, stylesheet and service worker are wired', () => {
        expect(read('index.html')).toContain('<script src="js/ui/barricadeWindow.js"></script>');
        expect(read('index.html')).toContain('href="css/barricade.css"');
        const sw = read('sw.js');
        expect(sw).toContain("'js/ui/barricadeWindow.js'");
        expect(sw).toContain("'css/barricade.css'");
    });
});

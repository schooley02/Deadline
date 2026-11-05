/**
 * @jest-environment jsdom
 */
/**
 * Started marker (2026-11-04, Jeremy; DECISIONS 2026-11-04 (started marker)): the pure state / group rules in
 * js/startedMarker.js, the "Started (N)" group in AgendaList.sortAndRenderActiveList, and the wiring pins
 * (CSS fragment in the shared glow chain, index.html / sw.js entries, script.js hook + TDZ-safe state).
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
global.Timer = require('../js/timer.js');
global.ListOrder = require('../js/listOrder.js');
global.StartedMarker = require('../js/startedMarker.js');
const SM = global.StartedMarker;
const AgendaList = require('../js/ui/agendaList.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

const at = (h, m = 0) => new Date(2026, 10, 4, h, m, 0, 0); // Wed Nov 4 2026, local
const task = (o) => Object.assign({
    id: 1, type: 'task', name: 'Write Q4 report', parentId: null, subTasks: [],
    startDateTime: at(13), dueDateTime: at(21), isOverdue: false,
}, o);

describe('StartedMarker.isStarted / stateFor', () => {
    test('inside [start, due) is started; before start and at due are not', () => {
        expect(SM.isStarted(task(), at(12, 59).getTime())).toBe(false);
        expect(SM.isStarted(task(), at(13).getTime())).toBe(true);
        expect(SM.isStarted(task(), at(20, 59).getTime())).toBe(true);
        expect(SM.isStarted(task(), at(21).getTime())).toBe(false);
    });
    test('no start, start not before due, overdue, KO ghost and Break Habits never show it', () => {
        const now = at(14).getTime();
        expect(SM.isStarted(task({ startDateTime: null }), now)).toBe(false);
        expect(SM.isStarted(task({ startDateTime: at(21) }), now)).toBe(false);
        expect(SM.isStarted(task({ isOverdue: true }), now)).toBe(false);
        expect(SM.isStarted(task({ koGhost: true }), now)).toBe(false);
        expect(SM.isStarted(task({ type: 'habit', isNegative: true }), now)).toBe(false);
        expect(SM.isStarted(task({ type: 'habit', isNegative: false }), now)).toBe(true); // Build Habit, custom times
    });
    test('breathes for STARTED_BREATHE_MIN after start, then quiet; a running timer = working', () => {
        expect(CONFIG.STARTED_BREATHE_MIN).toBe(10);
        expect(SM.stateFor(task(), at(13, 9).getTime())).toBe('started');
        expect(SM.stateFor(task(), at(13, 10).getTime())).toBe('quiet');
        expect(SM.stateFor(task({ timer: { startedAt: at(13, 5).getTime() } }), at(13, 6).getTime())).toBe('working');
        expect(SM.stateFor(task(), at(12).getTime())).toBe('none');
        expect(SM.stateFor(task(), at(13, 2).getTime(), { isRunning: () => true })).toBe('working');
    });
});

describe('StartedMarker group rules', () => {
    test('in the group until due is within STARTED_GROUP_LEAVE_MIN', () => {
        expect(CONFIG.STARTED_GROUP_LEAVE_MIN).toBe(60);
        const t = task();
        expect(SM.inGroup(t, [t], at(19, 59).getTime())).toBe(true);
        expect(SM.inGroup(t, [t], at(20).getTime())).toBe(false);
    });
    test('a started sub-task lifts its parent row; sub-tasks never get their own row', () => {
        const parent = task({ id: 1, startDateTime: null, subTasks: [2] });
        const sub = task({ id: 2, parentId: 1, startDateTime: at(13), dueDateTime: at(18) });
        const items = [parent, sub];
        expect(SM.inGroup(parent, items, at(14).getTime())).toBe(true);
        expect(SM.inGroup(sub, items, at(14).getTime())).toBe(false);
        expect(SM.rowNote(parent, items, at(14).getTime(), { time: () => '1:00 PM' })).toBe('Sub-task started 1:00 PM');
    });
    test('split keeps list order inside each group', () => {
        const a = task({ id: 'a', startDateTime: null, dueDateTime: at(14) });
        const b = task({ id: 'b', startDateTime: null, dueDateTime: at(15) });
        const c = task({ id: 'c' });
        const out = SM.split([a, b, c], [a, b, c], at(13, 30).getTime());
        expect(out.started.map(i => i.id)).toEqual(['c']);
        expect(out.rest.map(i => i.id)).toEqual(['a', 'b']);
    });
    test('groupKey changes only when membership changes', () => {
        const items = [task({ id: 5 }), task({ id: 6, startDateTime: at(15) })];
        expect(SM.groupKey(items, at(13, 30).getTime())).toBe('5');
        expect(SM.groupKey(items, at(13, 40).getTime())).toBe('5');
        expect(SM.groupKey(items, at(15).getTime())).toBe('5,6');
    });
    test('row note: Started / Working', () => {
        const t = task();
        const fmt = { time: () => '1:00 PM', isRunning: () => false, elapsed: () => '0:42' };
        expect(SM.rowNote(t, [t], at(14).getTime(), fmt)).toBe('Started 1:00 PM');
        expect(SM.rowNote(t, [t], at(14).getTime(), Object.assign({}, fmt, { isRunning: () => true }))).toBe('Working 0:42');
        expect(SM.rowNote(t, [t], at(12).getTime(), fmt)).toBe('');
    });
    test('arrivals: nothing on a baseline pass, then only newly started ids', () => {
        expect(SM.arrivals(null, [1, 2])).toEqual([]);
        expect(SM.arrivals([1], [1, 2])).toEqual([2]);
        expect(SM.arrivals([1, 2], [2])).toEqual([]);
    });
});

describe('AgendaList "Started (N)" group', () => {
    const realNow = Date.now;
    afterEach(() => { Date.now = realNow; });
    function render(items) {
        const ul = document.createElement('ul');
        items.forEach(i => { i.listItemElement = document.createElement('li'); i.listItemElement.dataset.itemId = i.id; });
        AgendaList.sortAndRenderActiveList({
            activeItems: items, activeItemsListUL: ul,
            completedItems: () => [], definedHabits: () => [], definedRoutines: () => [],
        });
        return ul;
    }
    test('started rows render first under a heading, the rest under "By due time"', () => {
        Date.now = () => at(13, 30).getTime();
        const ul = render([
            task({ id: 'early', startDateTime: null, dueDateTime: at(14) }),
            task({ id: 'long' }),
            task({ id: 'later', startDateTime: null, dueDateTime: at(16) }),
        ]);
        const kids = Array.from(ul.children);
        expect(kids.map(k => k.classList.contains('list-group-heading') ? `[${k.textContent}]` : k.dataset.itemId))
            .toEqual(['[Started (1)]', 'long', '[By due time]', 'early', 'later']);
        expect(kids[1].classList.contains('started-group-row')).toBe(true);
        expect(kids[3].classList.contains('started-group-row')).toBe(false);
    });
    test('no started rows = no headings (the old single list)', () => {
        Date.now = () => at(12).getTime();
        const ul = render([task({ id: 'x' }), task({ id: 'y', startDateTime: null, dueDateTime: at(14) })]);
        expect(ul.querySelector('.list-group-heading')).toBeNull();
        expect(Array.from(ul.children).map(k => k.dataset.itemId)).toEqual(['y', 'x']);
    });
    test('every row started = Started heading only', () => {
        Date.now = () => at(13, 30).getTime();
        const ul = render([task({ id: 'x' })]);
        expect(Array.from(ul.querySelectorAll('.list-group-heading')).map(h => h.textContent)).toEqual(['Started (1)']);
    });
    test('createListItem gives top-level rows a hidden started-note chip', () => {
        const deps = { activeItems: [], categoryStyles: { other: { bgColor: '#ccc' } }, isGameOver: () => false, showEditTaskModal() {}, completeItem() {}, createSubTaskPrompt() {} };
        const item = task({ id: 9, category: 'work' });
        const ret = AgendaList.createListItem(item, deps);
        const li = ret || item.listItemElement;
        const note = li.querySelector('.started-note');
        expect(note).not.toBeNull();
        expect(note.hidden).toBe(true);
    });
});

describe('Started marker wiring', () => {
    test('the glow is a fragment of the shared filter chain with a 4th animation slot everywhere', () => {
        const css = read('css/enemyStatus.css');
        expect(css).toMatch(/var\(--g-overdue,\) var\(--g-started,\);/);
        expect(css).toMatch(/var\(--an-st, none\);/);
        expect(css).toMatch(/animation-duration: 1\.4s, 0\.8s, 1\.2s, 1s;/);
        expect(css).toMatch(/super-streak > \.enemy-sprite \{ animation-duration: 1\.4s, 0\.8s, 0\.9s, 1s; \}/);
        expect(css).toMatch(/@property --st-blur/);
    });
    test('motion in startedMarker.css only runs when motion is allowed', () => {
        const css = read('css/startedMarker.css');
        const motion = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
        ['started-tick', 'started-burst', 'started-row-flash'].forEach(name => {
            const uses = css.split(`animation: ${name}`).length - 1;
            const inMotion = motion.split(`animation: ${name}`).length - 1;
            expect(uses).toBe(1);
            expect(inMotion).toBe(1);
        });
    });
    test('index.html and sw.js load the new files; the CSS comes after enemyStatus.css', () => {
        const html = read('index.html');
        expect(html.indexOf('css/startedMarker.css')).toBeGreaterThan(html.indexOf('css/enemyStatus.css'));
        expect(html.indexOf('js/startedMarker.js')).toBeGreaterThan(html.indexOf('js/timer.js'));
        expect(html.indexOf('js/startedMarker.js')).toBeLessThan(html.indexOf('js/ui/agendaList.js'));
        const sw = read('sw.js');
        expect(sw).toContain("'css/startedMarker.css'");
        expect(sw).toContain("'js/startedMarker.js'");
    });
    test('script.js refreshes the marker with the timer labels and declares its state before boot code', () => {
        const s = read('script.js');
        const update = s.slice(s.indexOf('function updateTimerButtons('), s.indexOf('function refreshStartedMarkers('));
        expect(update).toContain('refreshStartedMarkers(nowMs);');
        const decl = s.indexOf('let startedPrevIds');
        expect(decl).toBeGreaterThan(-1);
        expect(decl).toBeLessThan(s.indexOf('function updateTimerButtons('));
        const fn = s.slice(s.indexOf('function refreshStartedMarkers('), s.indexOf('function applyStartedState('));
        expect(fn).toMatch(/if \(timePreviewActive \|\| offlineCatchUpActive\) \{ startedPrevIds = null; return; \}/);
    });
});

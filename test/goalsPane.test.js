/**
 * @jest-environment jsdom
 */
/** Goals pane (Build B1, 2026-11-05): the pure view-model helpers, the cell html and the DOM open/close/refresh/roster. */
global.CONFIG = require('../js/config.js');
global.Goals = require('../js/goals.js');
global.Theme = require('../js/theme.js');
const GoalsPane = require('../js/ui/goalsPane.js');

const NOW = new Date(2026, 10, 5, 12, 0, 0).getTime(); // Thu Nov 5 2026

function number(over) {
    return Object.assign({ id: 1, type: 'number', label: 'Steps', start: 0, end: 10, current: 3 }, over || {});
}
function view(over) {
    const base = {
        id: 7,
        goal: { id: 7, name: 'Read a book', kind: 'milestone', period: null, deadline: null, stage: 1, streak: 0, bestStreak: 0, periodsMet: 0, history: [], targets: [number()] },
        progress: 0.3,
        stage: 1,
        pace: 'ahead',
        targets: [{ target: number(), progress: 0.3, detail: { kind: 'number', have: 3, need: 10, mode: 'goal' } }],
        recent: null,
    };
    const goal = Object.assign({}, base.goal, (over && over.goal) || {});
    return Object.assign(base, over || {}, { goal });
}

describe('buttonModel / label', () => {
    test('counts goals on pace and caps the dots at six', () => {
        const views = ['ahead', 'behind', 'overdue', 'none', 'done', 'ahead', 'behind'].map(p => view({ pace: p }));
        const m = GoalsPane.buttonModel(views);
        expect(m.active).toBe(7);
        expect(m.onPace).toBe(4); // ahead x2, none, done
        expect(m.dots).toHaveLength(6);
        expect(m.more).toBe(1);
    });
    test('no goals: empty model and a plain label', () => {
        const m = GoalsPane.buttonModel([]);
        expect(m).toEqual({ active: 0, onPace: 0, dots: [], more: 0 });
        expect(GoalsPane.buttonLabel(m)).toBe('Goals: none yet. Open goals');
        expect(GoalsPane.buttonModel(null).active).toBe(0);
    });
    test('the label names the behind and overdue counts', () => {
        const m = GoalsPane.buttonModel([view({ pace: 'ahead' }), view({ pace: 'behind' }), view({ pace: 'overdue' })]);
        expect(GoalsPane.buttonLabel(m)).toBe('Goals: 1 of 3 goals on pace, 1 behind, 1 overdue. Open goals');
    });
    test('the signature changes when a pace changes', () => {
        const a = GoalsPane.buttonSignature(GoalsPane.buttonModel([view({ pace: 'ahead' })]));
        const b = GoalsPane.buttonSignature(GoalsPane.buttonModel([view({ pace: 'behind' })]));
        expect(a).not.toBe(b);
    });
});

describe('text helpers', () => {
    test('shortDate / fmtNum / percent', () => {
        expect(GoalsPane.shortDate('2026-12-31')).toBe('Dec 31');
        expect(GoalsPane.shortDate('nope')).toBe('');
        expect(GoalsPane.fmtNum(3)).toBe('3');
        expect(GoalsPane.fmtNum(3.14159)).toBe('3.1');
        expect(GoalsPane.fmtNum(NaN)).toBe('0');
        expect(GoalsPane.percent(0.456)).toBe(46);
        expect(GoalsPane.percent(5)).toBe(100);
        expect(GoalsPane.percent(-1)).toBe(0);
    });
    test('progressText: "3 of 10" for one counting target, a percent otherwise', () => {
        expect(GoalsPane.progressText(view())).toBe('3 of 10');
        expect(GoalsPane.progressText(view({ targets: [{ target: number(), progress: 0.5, detail: { kind: 'bool', have: 0, need: 1 } }], progress: 0.5 }))).toBe('50%');
        expect(GoalsPane.progressText(view({ targets: [{ target: number(), progress: 0.3, detail: { kind: 'number', have: 190, need: 180, start: 200 } }] }))).toBe('30%');
        expect(GoalsPane.progressText(view({ targets: [{ target: number(), progress: 1, detail: { kind: 'aggregate', have: 4, need: 6, mode: 'limit' } }] }))).toBe('4 so far');
    });
    test('cellLine: recurring, dated, undated and complete', () => {
        expect(GoalsPane.cellLine(view({ goal: { kind: 'recurring', period: 'week' } }))).toBe('Every week · 3 of 10');
        expect(GoalsPane.cellLine(view({ goal: { deadline: '2026-12-31' } }))).toBe('Due Dec 31 · 3 of 10');
        expect(GoalsPane.cellLine(view())).toBe('No deadline · 3 of 10');
        expect(GoalsPane.cellLine(view({ pace: 'done' }))).toBe('Complete');
    });
    test('cellChip: slipped (a stage or all the way), met, example, none', () => {
        expect(GoalsPane.cellChip(view({ recent: 'slipped', goal: { stage: 2 } }))).toEqual({ kind: 'slipped', text: 'Slipped a stage' });
        expect(GoalsPane.cellChip(view({ recent: 'slipped', goal: { stage: 0 } }))).toEqual({ kind: 'slipped', text: 'Missed last period' });
        expect(GoalsPane.cellChip(view({ recent: 'met' }))).toEqual({ kind: 'met', text: 'Period met' });
        expect(GoalsPane.cellChip(view({ goal: { suggested: true } }))).toEqual({ kind: 'example', text: 'Example' });
        expect(GoalsPane.cellChip(view())).toBeNull();
    });
    test('streakPips: last five periods of a recurring goal only', () => {
        const history = [1, 0, 1, 1, 0, 1, 1].map((m, i) => ({ key: 'k' + i, met: !!m }));
        expect(GoalsPane.streakPips({ kind: 'recurring', history })).toEqual([true, true, false, true, true]);
        expect(GoalsPane.streakPips({ kind: 'milestone', history })).toEqual([]);
        expect(GoalsPane.streakPips(null)).toEqual([]);
    });
    test('headerText and kindLine', () => {
        expect(GoalsPane.headerText({ slots: 4, used: 3 })).toBe('Goals · 3 of 4 slots');
        expect(GoalsPane.kindLine({ kind: 'recurring', period: 'month' })).toBe('Repeats every month');
        expect(GoalsPane.kindLine({ kind: 'milestone', deadline: '2026-12-31' })).toBe('One-time · Due Dec 31');
        expect(GoalsPane.kindLine({ kind: 'milestone' })).toBe('One-time · No deadline');
    });
});

describe('periodEndsText / paceText', () => {
    test('a day ends tonight, a week on its last weekday, a month on its last date', () => {
        expect(GoalsPane.periodEndsText({ period: 'day' }, NOW, 1)).toBe('tonight');
        expect(GoalsPane.periodEndsText({ period: 'week' }, NOW, 1)).toBe('Sunday');
        expect(GoalsPane.periodEndsText({ period: 'week' }, NOW, 0)).toBe('Saturday');
        expect(GoalsPane.periodEndsText({ period: 'month' }, NOW, 1)).toBe('Nov 30');
    });
    test('paceText covers every pace', () => {
        const rec = { kind: 'recurring', period: 'week' };
        expect(GoalsPane.paceText(view({ pace: 'ahead', goal: rec }), NOW, 1)).toBe('Ahead of pace · ends Sunday');
        expect(GoalsPane.paceText(view({ pace: 'behind', goal: rec }), NOW, 1)).toBe('Behind pace · ends Sunday');
        expect(GoalsPane.paceText(view({ pace: 'done' }), NOW, 1)).toBe('Complete');
        expect(GoalsPane.paceText(view({ pace: 'none' }), NOW, 1)).toBe('No deadline, no pressure');
        expect(GoalsPane.paceText(view({ pace: 'none', goal: rec }), NOW, 1)).toBe('');
        expect(GoalsPane.paceText(view({ pace: 'overdue', goal: { deadline: '2026-11-01' } }), NOW, 1)).toMatch(/^Overdue/);
    });
    test('a dated milestone counts the days to the deadline', () => {
        expect(GoalsPane.paceText(view({ pace: 'ahead', goal: { deadline: '2026-11-05' } }), NOW, 1)).toBe('Ahead of pace · due today');
        expect(GoalsPane.paceText(view({ pace: 'behind', goal: { deadline: '2026-11-06' } }), NOW, 1)).toBe('Behind pace · due in 1 day');
        expect(GoalsPane.paceText(view({ pace: 'ahead', goal: { deadline: '2026-11-15' } }), NOW, 1)).toBe('Ahead of pace · due in 10 days');
    });
});

describe('cellModels', () => {
    test('goals, then open slots, then ONE locked cell', () => {
        const cells = GoalsPane.cellModels([view(), view({ id: 8 })], { slots: 4, used: 2, next: { level: 6, slots: 5 } });
        expect(cells.map(c => c.kind)).toEqual(['goal', 'goal', 'open', 'open', 'locked']);
        expect(cells[4].level).toBe(6);
    });
    test('no locked cell once every slot is unlocked; no open cells when full', () => {
        expect(GoalsPane.cellModels([view()], { slots: 1, used: 1, next: null }).map(c => c.kind)).toEqual(['goal']);
    });
    test('signatures differ by cell content', () => {
        const a = GoalsPane.cellSignature({ kind: 'goal', view: view() });
        const b = GoalsPane.cellSignature({ kind: 'goal', view: view({ stage: 2, progress: 0.6 }) });
        expect(a).not.toBe(b);
        expect(GoalsPane.cellSignature({ kind: 'open' })).toBe('open');
        expect(GoalsPane.cellSignature({ kind: 'locked', level: 6 })).toBe('locked:6');
    });
});

describe('html', () => {
    test('a goal cell is a button carrying the goal id and escaping the name', () => {
        const html = GoalsPane.cellHtml({ kind: 'goal', view: view({ id: 9, goal: { name: '<b>Run</b> & rest' } }) });
        expect(html).toContain('<button');
        expect(html).toContain('data-goal-id="9"');
        expect(html).toContain('&lt;b&gt;Run&lt;/b&gt; &amp; rest');
        expect(html).not.toContain('<b>Run');
        expect(html).toContain('goal-pace--ahead');
    });
    test('the open cell is the "+ New goal" button (Build B2); the locked one is not a button and uses the theme line', () => {
        const open = GoalsPane.cellHtml({ kind: 'open' });
        expect(open).toContain('<button');
        expect(open).toContain('data-new-goal');
        expect(open).toContain('+ New goal');
        const locked = GoalsPane.cellHtml({ kind: 'locked', level: 6 });
        expect(locked).not.toContain('<button');
        expect(locked).toContain('Unlocks at Lv 6');
    });
    test('art: six stages differ, the last carries a star, open/locked have their own', () => {
        const arts = [0, 1, 2, 3, 4, 5].map(s => GoalsPane.artHtml('stage', s));
        expect(new Set(arts).size).toBe(6);
        expect(arts[5]).toContain('goal-art-star');
        expect(arts[0]).not.toContain('goal-art-star');
        expect(GoalsPane.artHtml('open')).toContain('goal-art--open');
        expect(GoalsPane.artHtml('locked')).toContain('goal-art--locked');
        expect(GoalsPane.artHtml('stage', 99)).toContain('goal-art--stage5');
    });
    test('roster rows and html', () => {
        const done = [{ id: 1, name: 'Run 5k', kind: 'milestone', deadline: null, finishedAt: new Date(2026, 10, 3, 9).getTime(), periodsMet: 0, bestStreak: 0 },
            { id: 2, name: 'Walk', kind: 'recurring', period: 'week', finishedAt: new Date(2026, 10, 4, 9).getTime(), periodsMet: 5, bestStreak: 3 }];
        const rows = GoalsPane.rosterRows(done);
        expect(rows[0]).toMatchObject({ name: 'Run 5k', finished: 'Nov 3', kindLine: 'One-time · No deadline' });
        const html = GoalsPane.rosterHtml(rows);
        expect(html).toContain('Run 5k');
        expect(html).toContain('5 met, best streak 3');
        expect(GoalsPane.rosterHtml([])).toContain('Nothing here yet');
    });
});

describe('DOM', () => {
    let views;
    let info;
    let roster;
    let opened;
    let newGoalAsks;

    function build() {
        document.body.innerHTML = `
            <button id="tab" aria-expanded="false"></button>
            <div id="backdrop"></div>
            <section id="pane" aria-hidden="true"><h3 id="title"></h3><p id="sub"></p>
              <button id="rosterBtn"></button><button id="closeBtn"></button><div id="body"></div></section>`;
        GoalsPane.init({
            tabEl: document.getElementById('tab'), paneEl: document.getElementById('pane'), backdropEl: document.getElementById('backdrop'),
            bodyEl: document.getElementById('body'), titleEl: document.getElementById('title'), subEl: document.getElementById('sub'),
            closeEl: document.getElementById('closeBtn'), rosterBtnEl: document.getElementById('rosterBtn'),
            getViews: () => views, getSlotInfo: () => info, getRoster: () => roster, onOpenGoal: (id) => opened.push(id), onNewGoal: () => { newGoalAsks += 1; },
        });
    }

    beforeEach(() => {
        views = [view({ id: 3 }), view({ id: 4, pace: 'behind' })];
        info = { slots: 3, used: 2, next: { level: 6, slots: 4 } };
        roster = [];
        opened = [];
        newGoalAsks = 0;
        GoalsPane.close(); // the module is a singleton: leave the previous test's pane closed before re-initialising
        build();
    });

    test('refresh paints the HUD button: count, dots, label', () => {
        GoalsPane.refresh();
        const tab = document.getElementById('tab');
        expect(tab.querySelector('.goals-button-count').textContent).toBe('1/2');
        expect(tab.querySelectorAll('.goals-dot')).toHaveLength(2);
        expect(tab.getAttribute('aria-label')).toContain('1 of 2 goals on pace');
    });

    test('no goals: no count and no dots', () => {
        views = [];
        info = { slots: 2, used: 0, next: null };
        GoalsPane.refresh();
        const tab = document.getElementById('tab');
        expect(tab.querySelector('.goals-button-count')).toBeNull();
        expect(tab.querySelector('.goals-button-dots')).toBeNull();
    });

    test('tapping the button opens the pane with the grid; tapping again closes it', () => {
        const tab = document.getElementById('tab');
        tab.click();
        const pane = document.getElementById('pane');
        expect(pane.classList.contains('open')).toBe(true);
        expect(document.getElementById('backdrop').classList.contains('open')).toBe(true);
        expect(pane.getAttribute('aria-hidden')).toBe('false');
        expect(tab.getAttribute('aria-expanded')).toBe('true');
        expect(document.getElementById('title').textContent).toBe('The Lab');
        expect(document.getElementById('sub').textContent).toBe('Goals · 2 of 3 slots');
        expect(document.querySelectorAll('#body .goal-slot--goal')).toHaveLength(2);
        expect(document.querySelectorAll('#body .goal-slot--open')).toHaveLength(1);
        expect(document.querySelectorAll('#body .goal-slot--locked')).toHaveLength(1);
        tab.click();
        expect(pane.classList.contains('open')).toBe(false);
        expect(pane.getAttribute('aria-hidden')).toBe('true');
    });

    test('the backdrop and the x close it; Esc closes it unless a window is on top', () => {
        const pane = document.getElementById('pane');
        const tab = document.getElementById('tab');
        tab.click();
        document.getElementById('backdrop').click();
        expect(pane.classList.contains('open')).toBe(false);
        tab.click();
        document.getElementById('closeBtn').click();
        expect(pane.classList.contains('open')).toBe(false);
        tab.click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(pane.classList.contains('open')).toBe(false);
        tab.click();
        const card = document.createElement('div');
        card.className = 'modal-overlay';
        document.body.appendChild(card);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(pane.classList.contains('open')).toBe(true); // the card on top gets that Esc
        card.remove();
    });

    test('tapping a goal cell reports its id and does not bubble to the document', () => {
        const seen = jest.fn();
        document.addEventListener('click', seen);
        document.getElementById('tab').click();
        seen.mockClear();
        document.querySelector('#body .goal-slot--goal[data-goal-id="4"]').click();
        expect(opened).toEqual(['4']);
        expect(seen).not.toHaveBeenCalled();
        document.removeEventListener('click', seen);
    });

    test('the open cell asks the owner for a new goal (Build B2); the locked cell does nothing', () => {
        document.getElementById('tab').click();
        const open = document.querySelector('#body .goal-slot--open');
        expect(open.tagName).toBe('BUTTON');
        expect(open.textContent).toContain('+ New goal');
        const seen = jest.fn();
        document.addEventListener('click', seen);
        open.click();
        document.querySelector('#body .goal-slot--locked').click();
        document.removeEventListener('click', seen);
        expect(newGoalAsks).toBe(1);
        expect(opened).toEqual([]);
        expect(seen).toHaveBeenCalledTimes(1); // only the locked cell's tap bubbled; the open cell's did not
    });

    test('refresh while open repaints the grid only when something changed', () => {
        document.getElementById('tab').click();
        const grid = document.querySelector('#body .goal-grid');
        GoalsPane.refresh();
        expect(document.querySelector('#body .goal-grid')).toBe(grid); // same signature: DOM untouched
        views = [view({ id: 3, stage: 3, progress: 0.7 }), view({ id: 4, pace: 'behind' })];
        GoalsPane.refresh();
        expect(document.querySelector('#body .goal-grid')).not.toBe(grid);
    });

    test('the roster button swaps the grid for the finished list and back', () => {
        roster = [{ id: 1, name: 'Run 5k', kind: 'milestone', finishedAt: new Date(2026, 10, 3, 9).getTime(), periodsMet: 0, bestStreak: 0 }];
        document.getElementById('tab').click();
        const btn = document.getElementById('rosterBtn');
        expect(btn.textContent).toBe('Survivors: 1');
        btn.click();
        expect(document.querySelector('#body .goal-roster')).not.toBeNull();
        expect(document.querySelector('#body .goal-grid')).toBeNull();
        expect(btn.textContent).toBe('Back to goals');
        btn.click();
        expect(document.querySelector('#body .goal-grid')).not.toBeNull();
    });

    test('reopening always starts on the grid', () => {
        roster = [];
        const tab = document.getElementById('tab');
        tab.click();
        document.getElementById('rosterBtn').click();
        tab.click(); // close
        tab.click(); // open
        expect(document.querySelector('#body .goal-grid')).not.toBeNull();
    });
});

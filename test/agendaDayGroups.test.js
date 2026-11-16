/**
 * @jest-environment jsdom
 */
/**
 * Day groups in the live list (2026-11-15, Jeremy: "when some task gets pushed to tomorrow, it needs to show in the list view
 * under a title that says Tomorrow's Deadlines, similar to Today's Deadlines"). Rows due after tonight's end of day split off
 * into one group per day under their own heading (js/ui/agendaList.js laterDayGroups / dayGroupLabel), a Started task due
 * tomorrow goes under Tomorrow's heading too, and the continuous list's later-day ghost sections no longer repeat real tasks
 * (js/ui/dayPagerView.js renderFutureSections).
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
global.Timer = require('../js/timer.js');
global.ListOrder = require('../js/listOrder.js');
global.StartedMarker = require('../js/startedMarker.js');
global.PriorityGroup = require('../js/priorityGroup.js');
global.TimeSlider = require('../js/timeSlider.js');
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.Routines = require('../js/routines.js');
global.DayPager = require('../js/dayPager.js');
const AgendaList = require('../js/ui/agendaList.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

const at = (h, m = 0, dayOffset = 0) => new Date(2026, 10, 10 + dayOffset, h, m, 0, 0); // Tue Nov 10 2026, local
const END_OF_TODAY = at(24).getTime();
const task = (o) => Object.assign({
    id: 1, type: 'task', name: 'Write report', parentId: null, subTasks: [],
    startDateTime: null, dueDateTime: at(17), isOverdue: false, isHighPriority: false,
}, o);

describe('AgendaList.laterDayGroups', () => {
    test('rows due today or earlier stay in Today; later rows group by day, in day order', () => {
        const rows = [
            task({ id: 'late', dueDateTime: at(8), isOverdue: true }),
            task({ id: 'a', dueDateTime: at(14) }),
            task({ id: 't1', dueDateTime: at(11, 59 , 1) }),
            task({ id: 't2', dueDateTime: at(23, 59, 1) }),
            task({ id: 'd3', dueDateTime: at(9, 0, 2) }),
        ];
        const out = AgendaList.laterDayGroups(rows, END_OF_TODAY);
        expect(out.today.map(r => r.id)).toEqual(['late', 'a']);
        expect(out.later.map(g => g.offset)).toEqual([1, 2]);
        expect(out.later[0].rows.map(r => r.id)).toEqual(['t1', 't2']);
        expect(out.later[1].rows.map(r => r.id)).toEqual(['d3']);
        expect(out.later[0].dayStart.getTime()).toBe(at(0, 0, 1).getTime());
    });
    test('a row due exactly at midnight is tomorrow\'s; 11:59 PM tonight is still today\'s', () => {
        const out = AgendaList.laterDayGroups([task({ id: 'edge', dueDateTime: at(24) }), task({ id: 'late', dueDateTime: at(23, 59) })], END_OF_TODAY);
        expect(out.today.map(r => r.id)).toEqual(['late']);
        expect(out.later[0].offset).toBe(1);
        expect(out.later[0].rows.map(r => r.id)).toEqual(['edge']);
    });
    test('no usable due time stays in Today; a missing boundary keeps everything in Today', () => {
        const noDue = task({ id: 'nodue', dueDateTime: null });
        expect(AgendaList.laterDayGroups([noDue], END_OF_TODAY).today).toEqual([noDue]);
        const far = task({ id: 'far', dueDateTime: at(9, 0, 3) });
        const out = AgendaList.laterDayGroups([far], NaN);
        expect(out.today).toEqual([far]);
        expect(out.later).toEqual([]);
        expect(AgendaList.laterDayGroups(undefined, END_OF_TODAY)).toEqual({ today: [], later: [] });
    });
});

describe('AgendaList.dayGroupLabel', () => {
    test('tomorrow reads "Tomorrow\'s Deadlines"; later days read like the header ("Thu · Nov 12\'s Deadlines")', () => {
        expect(AgendaList.dayGroupLabel(1, at(0, 0, 1))).toBe("Tomorrow's Deadlines");
        expect(AgendaList.dayGroupLabel(2, at(0, 0, 2))).toBe("Thu · Nov 12's Deadlines");
        expect(AgendaList.dayGroupLabel(6, at(0, 0, 6))).toBe("Mon · Nov 16's Deadlines");
    });
});

describe('the live list under day headings', () => {
    const realNow = Date.now;
    afterEach(() => { Date.now = realNow; });
    function render(items) {
        const ul = document.createElement('ul');
        items.forEach(i => {
            i.listItemElement = document.createElement('li');
            i.listItemElement.dataset.itemId = i.id;
            const wrap = document.createElement('div');
            wrap.className = 'reorder-controls';
            i.listItemElement.appendChild(wrap);
        });
        AgendaList.sortAndRenderActiveList({
            activeItems: items, activeItemsListUL: ul,
            completedItems: () => [], definedHabits: () => [], definedRoutines: () => [],
        });
        return ul;
    }
    const layout = (ul) => Array.from(ul.children).map(k => k.classList.contains('list-group-heading') ? `[${k.textContent}]` : k.dataset.itemId);

    test('a task due tomorrow sits under "Tomorrow\'s Deadlines", after everything due today', () => {
        Date.now = () => at(9).getTime();
        const ul = render([task({ id: 'tmrw', dueDateTime: at(23, 59, 1) }), task({ id: 'now', dueDateTime: at(14) })]);
        expect(layout(ul)).toEqual(['now', "[Tomorrow's Deadlines]", 'tmrw']);
        const heading = ul.querySelector('.day-group-heading');
        expect(heading.classList.contains('list-group-heading')).toBe(true);
        expect(heading.dataset.dayOffset).toBe('1');
    });
    test('each later day gets its own heading, in day order', () => {
        Date.now = () => at(9).getTime();
        const ul = render([
            task({ id: 'd2', dueDateTime: at(10, 0, 2) }),
            task({ id: 'now', dueDateTime: at(14) }),
            task({ id: 't1', dueDateTime: at(10, 0, 1) }),
            task({ id: 't1b', dueDateTime: at(18, 0, 1) }),
        ]);
        expect(layout(ul)).toEqual(['now', "[Tomorrow's Deadlines]", 't1', 't1b', "[Thu · Nov 12's Deadlines]", 'd2']);
    });
    test('a Started task due tomorrow goes under Tomorrow\'s Deadlines, not into the Started group', () => {
        Date.now = () => at(13, 30).getTime();
        const ul = render([
            task({ id: 'plain', dueDateTime: at(14) }),
            task({ id: 'startedTomorrow', startDateTime: at(8), dueDateTime: at(20, 0, 1) }),
        ]);
        expect(layout(ul)).toEqual(['plain', "[Tomorrow's Deadlines]", 'startedTomorrow']);
    });
    test('Priority, Started and By due time keep working for today, with the day groups after them', () => {
        Date.now = () => at(13, 30).getTime();
        const ul = render([
            task({ id: 'pri', isHighPriority: true, dueDateTime: at(15) }),
            task({ id: 'started', startDateTime: at(13), dueDateTime: at(22) }),
            task({ id: 'plain', dueDateTime: at(16) }),
            task({ id: 'tmrw', dueDateTime: at(9, 0, 1) }),
        ]);
        expect(layout(ul)).toEqual(['[★Priority (1)]', 'pri', '[Started (1)]', 'started', '[By due time]', 'plain', "[Tomorrow's Deadlines]", 'tmrw']);
    });
    test('with nothing due after tonight there are no day headings (the list is unchanged)', () => {
        Date.now = () => at(9).getTime();
        const ul = render([task({ id: 'x', dueDateTime: at(18) }), task({ id: 'y', dueDateTime: at(14) })]);
        expect(ul.querySelector('.day-group-heading')).toBeNull();
        expect(layout(ul)).toEqual(['y', 'x']);
    });
    test('only tomorrow rows: the Tomorrow heading is the first thing in the list', () => {
        Date.now = () => at(9).getTime();
        const ul = render([task({ id: 'only', dueDateTime: at(12, 0, 1) })]);
        expect(layout(ul)).toEqual(["[Tomorrow's Deadlines]", 'only']);
    });
    test('each row appears once, and a later-day row keeps its reorder arrows rule (hidden when it has no tie neighbour)', () => {
        Date.now = () => at(9).getTime();
        const items = [task({ id: 'a', dueDateTime: at(10, 0, 1) })];
        const ul = render(items);
        expect(ul.querySelectorAll('li[data-item-id="a"]')).toHaveLength(1);
        expect(items[0].listItemElement.querySelector('.reorder-controls').style.display).toBe('none');
    });
});

describe('continuous list: later-day ghost sections do not repeat real tasks', () => {
    const DayPagerView = require('../js/ui/dayPagerView.js');
    test('futureSectionsHtml uses a section\'s own empty message, else "Nothing scheduled"', () => {
        const html = DayPagerView.futureSectionsHtml([
            { offset: 1, label: 'Tomorrow · Wed Nov 11', ghosts: [], emptyMessage: 'Nothing else scheduled' },
            { offset: 2, label: 'Thu · Nov 12', ghosts: [] },
        ]);
        expect(html).toContain('Nothing else scheduled');
        expect(html).toContain('Nothing scheduled');
    });
    function futureHtml(items) {
        window.matchMedia = () => ({ matches: true, addEventListener() {} });
        document.body.innerHTML = '';
        const box = document.createElement('div');
        document.body.appendChild(box);
        const el = () => document.createElement('div');
        DayPagerView.init({
            listScrollEl: box, gameCanvasEl: el(), taskSectionTitleEl: el(), activeItemsListEl: document.createElement('ul'),
            completedTasksSectionEl: el(),
            getCurrentGameDate: () => at(21, 20), getDefinedHabits: () => [], getDefinedRoutines: () => [], getDefinedTasks: () => [],
            getCompletedItems: () => [], getActiveItems: () => items, getSickDayDate: () => null,
            dims: () => ({ gameScreenWidth: 800, baseWidth: 100, enemyWidth: 40, habitEnemyWidth: 40 }),
            setTimePreviewActive() {}, renderTodayAgenda() {}, renderCompletedItems() {}, updateTaskCountDisplay() {}, syncSlider() {},
        });
        return document.getElementById('dayListFuture').innerHTML;
    }
    const real = (o) => Object.assign({ type: 'task', definitionId: null, parentId: null, category: 'career' }, o);

    test('a real task due tomorrow is not repeated as a ghost card; the day keeps its section and says "Nothing else scheduled"', () => {
        const html = futureHtml([real({ id: 'r1', name: 'Proposal', dueDateTime: at(23, 59, 1) })]);
        expect(html).toContain('data-offset="1"');
        expect(html).not.toContain('Proposal');
        expect(html).not.toContain('existing:r1');
        expect(html).toContain('Nothing else scheduled');
        expect(html).toContain('Nothing scheduled'); // the other days
    });
    test('a day with no real tasks still says "Nothing scheduled" only', () => {
        const html = futureHtml([]);
        expect(html).not.toContain('Nothing else scheduled');
        expect(html).toContain('Nothing scheduled');
    });
    test('a sub-task due that day keeps its ghost row (only top-level rows are in the live list)', () => {
        const html = futureHtml([
            real({ id: 'r1', name: 'Proposal', dueDateTime: at(23, 59, 1) }),
            real({ id: 's1', name: 'Outline', parentId: 'r1', dueDateTime: at(12, 0, 1) }),
        ]);
        expect(html).not.toContain('Proposal');
        expect(html).toContain('Outline');
    });
});

describe('day group heading CSS', () => {
    test('css/startedMarker.css styles li.day-group-heading (a divider line, not the first row\'s)', () => {
        const css = read('css/startedMarker.css');
        expect(css).toContain('.task-list li.day-group-heading {');
        expect(css).toContain('.task-list li.day-group-heading:first-child');
        expect(css.indexOf('li.day-group-heading')).toBeGreaterThan(css.indexOf('.task-list li.list-group-heading {'));
    });
});

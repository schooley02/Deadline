/**
 * @jest-environment jsdom
 */
/**
 * Priority group (2026-11-10, Jeremy; DECISIONS 2026-11-10 (priority group)): the pure rule in js/priorityGroup.js,
 * the "Priority (N)" group in AgendaList.sortAndRenderActiveList (above "Started (N)" and "By due time"), and the
 * wiring pins (index.html / sw.js entries, heading CSS).
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
global.Timer = require('../js/timer.js');
global.ListOrder = require('../js/listOrder.js');
global.StartedMarker = require('../js/startedMarker.js');
global.PriorityGroup = require('../js/priorityGroup.js');
const PG = global.PriorityGroup;
const AgendaList = require('../js/ui/agendaList.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

const at = (h, m = 0, dayOffset = 0) => new Date(2026, 10, 10 + dayOffset, h, m, 0, 0); // Tue Nov 10 2026, local
const END_OF_TODAY = at(24).getTime();
const task = (o) => Object.assign({
    id: 1, type: 'task', name: 'Write report', parentId: null, subTasks: [],
    startDateTime: null, dueDateTime: at(17), isOverdue: false, isHighPriority: true,
}, o);

describe('PriorityGroup.inGroup / split', () => {
    test('a top-level priority task due today is in; a plain task is not', () => {
        expect(PG.inGroup(task(), END_OF_TODAY)).toBe(true);
        expect(PG.inGroup(task({ isHighPriority: false }), END_OF_TODAY)).toBe(false);
    });
    test('overdue priority tasks stay in; one due tomorrow (or at the boundary) is not today\'s', () => {
        expect(PG.inGroup(task({ dueDateTime: at(9, 0, -1), isOverdue: true }), END_OF_TODAY)).toBe(true);
        expect(PG.inGroup(task({ dueDateTime: at(23, 59) }), END_OF_TODAY)).toBe(true);
        expect(PG.inGroup(task({ dueDateTime: at(0, 0, 1) }), END_OF_TODAY)).toBe(false);
        expect(PG.inGroup(task({ dueDateTime: at(12, 0, 1) }), END_OF_TODAY)).toBe(false);
    });
    test('sub-tasks and habits never join, even if flagged', () => {
        expect(PG.inGroup(task({ parentId: 5 }), END_OF_TODAY)).toBe(false);
        expect(PG.inGroup(task({ type: 'habit' }), END_OF_TODAY)).toBe(false);
        expect(PG.inGroup(null, END_OF_TODAY)).toBe(false);
    });
    test('KO ghost priority tasks stay in (they are completable)', () => {
        expect(PG.inGroup(task({ koGhost: true }), END_OF_TODAY)).toBe(true);
    });
    test('split keeps list order inside each group', () => {
        const a = task({ id: 'a', dueDateTime: at(10) });
        const b = task({ id: 'b', isHighPriority: false, dueDateTime: at(11) });
        const c = task({ id: 'c', dueDateTime: at(12) });
        const d = task({ id: 'd', isHighPriority: false, dueDateTime: at(13) });
        const out = PG.split([a, b, c, d], END_OF_TODAY);
        expect(out.priority.map(i => i.id)).toEqual(['a', 'c']);
        expect(out.rest.map(i => i.id)).toEqual(['b', 'd']);
    });
    test('no usable due time counts as today\'s; a missing boundary lets every priority task in', () => {
        expect(PG.inGroup(task({ dueDateTime: null }), END_OF_TODAY)).toBe(true);
        expect(PG.inGroup(task({ dueDateTime: at(12, 0, 3) }), NaN)).toBe(true);
    });
});

describe('AgendaList "Priority (N)" group', () => {
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

    test('priority rows render first under a heading, the rest under "By due time"', () => {
        Date.now = () => at(9).getTime();
        const ul = render([
            task({ id: 'early', isHighPriority: false, dueDateTime: at(10) }),
            task({ id: 'pri', dueDateTime: at(15) }),
            task({ id: 'later', isHighPriority: false, dueDateTime: at(16) }),
        ]);
        expect(layout(ul)).toEqual(['[★Priority (1)]', 'pri', '[By due time]', 'early', 'later']);
        const rows = Array.from(ul.querySelectorAll('li[data-item-id]'));
        expect(rows[0].classList.contains('priority-group-row')).toBe(true);
        expect(rows[1].classList.contains('priority-group-row')).toBe(false);
    });
    test('no priority tasks = the old single list, no headings', () => {
        Date.now = () => at(9).getTime();
        const ul = render([task({ id: 'x', isHighPriority: false }), task({ id: 'y', isHighPriority: false, dueDateTime: at(14) })]);
        expect(ul.querySelector('.list-group-heading')).toBeNull();
        expect(layout(ul)).toEqual(['y', 'x']);
    });
    test('every row priority = Priority heading only, in due order', () => {
        Date.now = () => at(9).getTime();
        const ul = render([task({ id: 'b', dueDateTime: at(16) }), task({ id: 'a', dueDateTime: at(12) })]);
        expect(layout(ul)).toEqual(['[★Priority (2)]', 'a', 'b']);
    });
    test('priority due tomorrow stays in the normal order, not in Today\'s Priority group', () => {
        Date.now = () => at(9).getTime();
        const ul = render([task({ id: 'tmrw', dueDateTime: at(9, 0, 1) }), task({ id: 'now', dueDateTime: at(14) })]);
        expect(layout(ul)).toEqual(['[★Priority (1)]', 'now', '[By due time]', 'tmrw']);
    });
    test('order is Priority, then Started, then By due time; a priority + started task shows once, under Priority', () => {
        Date.now = () => at(13, 30).getTime();
        const ul = render([
            task({ id: 'plain', isHighPriority: false, startDateTime: null, dueDateTime: at(14) }),
            task({ id: 'both', startDateTime: at(13), dueDateTime: at(21) }),
            task({ id: 'started', isHighPriority: false, startDateTime: at(13), dueDateTime: at(22) }),
        ]);
        expect(layout(ul)).toEqual(['[★Priority (1)]', 'both', '[Started (1)]', 'started', '[By due time]', 'plain']);
        expect(ul.querySelectorAll('li[data-item-id="both"]')).toHaveLength(1);
    });
    test('an overdue priority task is in the group', () => {
        Date.now = () => at(9).getTime();
        const ul = render([task({ id: 'late', dueDateTime: at(8), isOverdue: true }), task({ id: 'x', isHighPriority: false, dueDateTime: at(10) })]);
        expect(layout(ul)).toEqual(['[★Priority (1)]', 'late', '[By due time]', 'x']);
    });
    test('reorder arrows are hidden on Priority rows', () => {
        Date.now = () => at(9).getTime();
        const items = [task({ id: 'a', dueDateTime: at(14) }), task({ id: 'b', dueDateTime: at(14) })];
        render(items);
        items.forEach(i => expect(i.listItemElement.querySelector('.reorder-controls').style.display).toBe('none'));
    });
});

describe('Priority group wiring', () => {
    test('index.html and sw.js load js/priorityGroup.js', () => {
        const html = read('index.html');
        const sw = read('sw.js');
        expect(html).toContain('<script src="js/priorityGroup.js"></script>');
        expect(sw).toContain("'js/priorityGroup.js'");
        expect(html.indexOf('js/priorityGroup.js')).toBeGreaterThan(html.indexOf('js/startedMarker.js'));
    });
    test('the heading has a style (prioritySlots.css)', () => {
        expect(read('css/prioritySlots.css')).toContain('.task-list li.priority-group-heading');
    });
});

/**
 * @jest-environment jsdom
 *
 * "Completed Today" shows only today's completions; Yesterday shows yesterday's (2026-11-03, Jeremy:
 * "we don't need to display all of the past completions, maybe just today's and pull up yesterday's when
 * they tap over to yesterday"). Part 1: the pure day filter + the renderer. Part 2: the day pager asking
 * for the right list when it changes page.
 */
global.Schedule = require('../js/schedule.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.Habits = require('../js/habits.js');
global.Routines = require('../js/routines.js');
global.TimeSlider = require('../js/timeSlider.js');
global.DayPager = require('../js/dayPager.js');
const fs = require('fs');
const path = require('path');
const AgendaList = require('../js/ui/agendaList.js');

const TODAY = new Date(2026, 10, 3, 15, 0, 0);       // Tue Nov 3, 3 PM
const at = (day, h, m = 0) => new Date(2026, 10, day, h, m, 0);
const styles = { work: { bgColor: '#123456' }, other: { bgColor: '#ccc' } };

function mountDom() {
    document.body.innerHTML =
        '<div id="completedTasksSection" class="completed-tasks-section hidden"><h3>Completed Today</h3>' +
        '<ul id="completedItemsList"></ul></div>';
    return {
        section: document.getElementById('completedTasksSection'),
        list: document.getElementById('completedItemsList'),
        heading: document.querySelector('#completedTasksSection h3'),
    };
}
const done = (id, completedAt, extra) => Object.assign({ id, name: 'Item ' + id, category: 'work', completedAt }, extra);
const names = (list) => [...list.querySelectorAll('.completed-item:not(.completed-sub-item) .item-name')].map(e => e.textContent);

function deps(items, extra) {
    return Object.assign({
        completedItems: () => items, categoryStyles: styles,
        showEditTaskModal: jest.fn(), uncompleteItem: jest.fn(),
        currentGameDate: () => TODAY,
    }, extra);
}

describe('AgendaList.completedOnDay', () => {
    test('keeps only entries finished on that calendar day', () => {
        const items = [done('a', at(3, 9)), done('b', at(2, 22)), done('c', at(3, 23, 59)), done('d', at(4, 0, 1))];
        expect(AgendaList.completedOnDay(items, TODAY).map(i => i.id)).toEqual(['a', 'c']);
        expect(AgendaList.completedOnDay(items, at(2, 12)).map(i => i.id)).toEqual(['b']);
    });

    test('midnight belongs to the new day', () => {
        const items = [done('late', at(2, 23, 59)), done('early', at(3, 0, 0))];
        expect(AgendaList.completedOnDay(items, TODAY).map(i => i.id)).toEqual(['early']);
    });

    test('sub-tasks, entries without a time and junk are left out', () => {
        const items = [done('p', at(3, 9)), done('s', at(3, 9), { parentId: 'p' }), done('n', undefined), null, done('x', 'nonsense')];
        expect(AgendaList.completedOnDay(items, TODAY).map(i => i.id)).toEqual(['p']);
    });

    test('accepts ISO strings (a save that was not revived)', () => {
        expect(AgendaList.completedOnDay([done('a', at(3, 9).toISOString())], TODAY).length).toBe(1);
    });
});

describe('renderCompletedItems: today only', () => {
    test('older completions are not drawn', () => {
        const { list, section } = mountDom();
        AgendaList.renderCompletedItems(deps([done('a', at(3, 9)), done('old', at(1, 9)), done('y', at(2, 20))]));
        expect(names(list)).toEqual(['Item a']);
        expect(section.classList.contains('hidden')).toBe(false);
    });

    test('newest first', () => {
        const { list } = mountDom();
        AgendaList.renderCompletedItems(deps([done('a', at(3, 8)), done('b', at(3, 12))]));
        expect(names(list)).toEqual(['Item b', 'Item a']);
    });

    test('nothing today and nothing older hides the section', () => {
        const { section } = mountDom();
        section.classList.remove('hidden');
        AgendaList.renderCompletedItems(deps([]));
        expect(section.classList.contains('hidden')).toBe(true);
    });

    test('the row shows just the time: no date and no "Completed:" label (the heading says it)', () => {
        const { list } = mountDom();
        AgendaList.renderCompletedItems(deps([done('a', at(3, 9, 5))]));
        const text = list.querySelector('.item-completed').textContent;
        expect(text).toBe(at(3, 9, 5).toLocaleTimeString([], { timeStyle: 'short' }));
        expect(text).not.toMatch(/\d+\/\d+/);
        expect(text).not.toMatch(/Completed/);
    });

    test('Yesterday\'s rows are time-only too', () => {
        const { list } = mountDom();
        AgendaList.renderCompletedItems(deps([done('y', at(2, 20, 15))]), { day: at(2, 12) });
        const text = list.querySelector('.item-completed').textContent;
        expect(text).toBe(at(2, 20, 15).toLocaleTimeString([], { timeStyle: 'short' }));
    });

    test('a sub-task finished today nests under its parent; one finished on another day still nests under a parent finished today', () => {
        const { list } = mountDom();
        const parent = done('p', at(3, 14));
        const subToday = done('s1', at(3, 13), { parentId: 'p' });
        const subEarlier = done('s2', at(2, 13), { parentId: 'p' });
        AgendaList.renderCompletedItems(deps([parent, subToday, subEarlier]));
        expect(list.querySelectorAll('.completed-sub-item').length).toBe(2);
        expect(names(list)).toEqual(['Item p']);
    });

    test('an orphan sub-task alone does not make the section appear', () => {
        const { section } = mountDom();
        AgendaList.renderCompletedItems(deps([done('s', at(3, 9), { parentId: 'gone' })]));
        expect(section.classList.contains('hidden')).toBe(true);
    });

    test('Break-habit answers filter the same way and keep their tag', () => {
        const { list } = mountDom();
        AgendaList.renderCompletedItems(deps([
            done('r', at(3, 20), { type: 'habit', outcome: 'avoided', name: 'Resisted one' }),
            done('r0', at(2, 20), { type: 'habit', outcome: 'indulged', name: 'Slipped yesterday' }),
        ]));
        expect(names(list)).toEqual(['Resisted one']);
        expect(list.querySelector('.outcome-tag.resisted')).not.toBeNull();
        expect(list.querySelector('.item-completed').textContent).toMatch(/^Answered: /);
    });

    test('the heading says Today', () => {
        const { heading } = mountDom();
        heading.textContent = 'Completed Yesterday';
        AgendaList.renderCompletedItems(deps([done('a', at(3, 9))]));
        expect(heading.textContent).toBe('Completed Today');
    });

    test('callers that name no day still get everything (old behaviour)', () => {
        const { list } = mountDom();
        const d = deps([done('a', at(3, 9)), done('old', at(1, 9))]);
        delete d.currentGameDate;
        AgendaList.renderCompletedItems(d);
        expect(names(list).sort()).toEqual(['Item a', 'Item old']);
    });
});

describe('renderCompletedItems: Older toggle', () => {
    const items = () => [done('t', at(3, 9)), done('y', at(2, 20)), done('w', at(1, 8)), done('sub', at(1, 8), { parentId: 'w' })];
    const btn = () => document.querySelector('.completed-show-older');

    test('a button offers the older entries and counts top-level ones only', () => {
        const { list } = mountDom();
        AgendaList.renderCompletedItems(deps(items()));
        expect(btn().hidden).toBe(false);
        expect(btn().textContent).toBe('Older (2)');
        expect(names(list)).toEqual(['Item t']);
    });

    test('tapping it adds the older entries below today\'s, with a full date on the older rows; tapping again hides them', () => {
        const { list } = mountDom();
        AgendaList.renderCompletedItems(deps(items()));
        btn().click();
        expect(names(list)).toEqual(['Item t', 'Item y', 'Item w']);
        expect(btn().textContent).toBe('Hide older');
        const stamps = [...list.querySelectorAll('.completed-item:not(.completed-sub-item) .item-completed')].map(e => e.textContent);
        expect(stamps[0]).toBe(at(3, 9).toLocaleTimeString([], { timeStyle: 'short' }));
        expect(stamps[1]).toMatch(/\d+\/\d+/);
        expect(stamps[1]).toMatch(/^Completed: /); // the Older rows keep their label with the full date
        btn().click();
        expect(names(list)).toEqual(['Item t']);
        expect(btn().textContent).toBe('Older (2)');
    });

    test('with nothing today the section still shows so the button can be reached', () => {
        const { section, list } = mountDom();
        AgendaList.renderCompletedItems(deps([done('y', at(2, 20))]));
        expect(section.classList.contains('hidden')).toBe(false);
        expect(list.children.length).toBe(0);
        expect(btn().textContent).toBe('Older (1)');
    });

    test('it sits in the heading row, right beside the title', () => {
        const { heading } = mountDom();
        AgendaList.renderCompletedItems(deps(items()));
        const row = heading.parentNode;
        expect(row.classList.contains('completed-heading-row')).toBe(true);
        expect(btn().parentNode).toBe(row);
        expect(row.parentNode.id).toBe('completedTasksSection');
        // a second render must not wrap the heading again
        AgendaList.renderCompletedItems(deps(items()));
        expect(document.querySelectorAll('.completed-heading-row').length).toBe(1);
        expect(heading.parentNode).toBe(row);
    });

    test('the title text still updates inside the row', () => {
        const { heading } = mountDom();
        AgendaList.renderCompletedItems(deps(items()));
        heading.textContent = 'stale';
        AgendaList.renderCompletedItems(deps(items()));
        expect(heading.textContent).toBe('Completed Today');
        expect(btn().textContent).toBe('Older (2)');
    });

    test('only the last 7 days are offered: 7 days back counts, 8 does not', () => {
        const { list } = mountDom();
        const day = (d, h) => new Date(2026, 10, 3 - d, h, 0, 0);
        const cap = [done('t', day(0, 9)), done('d7', day(7, 0)), done('d6', day(6, 12)), done('d8', day(8, 23)), done('d30', day(30, 9))];
        AgendaList.renderCompletedItems(deps(cap));
        expect(btn().textContent).toBe('Older (2)');
        btn().click();
        expect(names(list)).toEqual(['Item t', 'Item d6', 'Item d7']);
        btn().click();
    });

    test('everything older than 7 days: no button and a hidden block', () => {
        const { section } = mountDom();
        AgendaList.renderCompletedItems(deps([done('d30', new Date(2026, 9, 4, 9, 0, 0))]));
        expect(section.classList.contains('hidden')).toBe(true);
        expect(btn() === null || btn().hidden).toBe(true);
    });

    test('no older entries, no button', () => {
        mountDom();
        AgendaList.renderCompletedItems(deps([done('t', at(3, 9))]));
        expect(btn() === null || btn().hidden).toBe(true);
    });

    test('Yesterday\'s page has no Older button', () => {
        mountDom();
        AgendaList.renderCompletedItems(deps(items(), { completedView: () => ({ day: at(2, 12), readOnly: true, heading: 'Completed Yesterday' }) }));
        expect(btn() === null || btn().hidden).toBe(true);
    });
});

describe('renderCompletedItems: yesterday', () => {
    const yesterday = at(2, 12);
    const view = () => ({ day: yesterday, readOnly: true, heading: 'Completed Yesterday' });

    test('shows yesterday\'s completions under a Yesterday heading', () => {
        const { list, heading, section } = mountDom();
        AgendaList.renderCompletedItems(deps([done('t', at(3, 9)), done('y1', at(2, 8)), done('y2', at(2, 21)), done('old', at(1, 9))], { completedView: view }));
        expect(heading.textContent).toBe('Completed Yesterday');
        expect(names(list)).toEqual(['Item y2', 'Item y1']);
        expect(section.classList.contains('hidden')).toBe(false);
    });

    test('is read-only: the list is flagged so the undo checkbox and edit pencil are hidden', () => {
        const { list } = mountDom();
        AgendaList.renderCompletedItems(deps([done('y1', at(2, 8))], { completedView: view }));
        expect(list.classList.contains('completed-readonly')).toBe(true);
        AgendaList.renderCompletedItems(deps([done('y1', at(2, 8))]));
        expect(list.classList.contains('completed-readonly')).toBe(false);
    });

    test('opts passed straight to the renderer win over completedView', () => {
        const { list } = mountDom();
        AgendaList.renderCompletedItems(deps([done('y1', at(2, 8)), done('t', at(3, 9))], { completedView: () => null }), view());
        expect(names(list)).toEqual(['Item y1']);
    });

    test('nothing finished yesterday hides the section', () => {
        const { section } = mountDom();
        AgendaList.renderCompletedItems(deps([done('t', at(3, 9))], { completedView: view }));
        expect(section.classList.contains('hidden')).toBe(true);
    });

    test('the read-only css exists', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'css/dayPager.css'), 'utf8');
        expect(css).toMatch(/\.completed-readonly \.completion-checkbox,\s*\.completed-readonly \.edit-icon-btn\s*\{\s*display: none/);
    });
});

describe('day pager asks for the right completed list', () => {
    let view, deps2, continuous;

    function setup(isContinuous) {
        jest.resetModules();
        document.body.innerHTML = '';
        continuous = isContinuous;
        window.matchMedia = (q) => ({
            matches: q.includes('orientation: landscape') ? continuous : false,
            addEventListener: () => {}, removeEventListener: () => {},
        });
        const mk = (tag, id) => { const e = document.createElement(tag); if (id) e.id = id; document.body.appendChild(e); return e; };
        const box = mk('div'); box.className = 'task-list-container';
        const list = document.createElement('ul'); list.id = 'activeItemsList'; box.appendChild(list);
        const completed = document.createElement('div'); completed.id = 'completedTasksSection'; box.appendChild(completed);
        deps2 = {
            prevBtn: mk('button'), nextBtn: mk('button'), labelEl: mk('span'), taskSectionTitleEl: mk('h2'),
            gameCanvasEl: mk('div', 'gameCanvas'), activeItemsListEl: list, timeSliderEl: mk('input'),
            weekStripRowEl: mk('div'), taskCountDisplayEl: mk('span'), completedTasksSectionEl: completed, listScrollEl: box,
            updateTaskCountDisplay: jest.fn(), getCurrentGameDate: () => TODAY,
            getDefinedHabits: () => [], getDefinedRoutines: () => [], getDefinedTasks: () => [],
            getCompletedItems: () => [], getActiveItems: () => [], getSickDayDate: () => null,
            dims: () => ({ gameScreenWidth: 300, baseWidth: 40, enemyWidth: 32, habitEnemyWidth: 32 }),
            setTimePreviewActive: jest.fn(), renderTodayAgenda: jest.fn(), renderCompletedItems: jest.fn(),
        };
        view = require('../js/ui/dayPagerView.js');
        view.init(deps2);
        deps2.renderCompletedItems.mockClear();
    }
    const hidden = () => deps2.completedTasksSectionEl.classList.contains('day-pager-hidden');

    test.each([['pinned layout', true], ['phone landscape', false]])('Yesterday (%s): section visible and re-rendered', (_n, isContinuous) => {
        setup(isContinuous);
        view.goToOffset(-1);
        expect(view.getViewedDayOffset()).toBe(-1);
        expect(hidden()).toBe(false);
        expect(deps2.renderCompletedItems).toHaveBeenCalled();
    });

    test.each([['pinned layout', true], ['phone landscape', false]])('back to Today (%s): Today\'s list is drawn again', (_n, isContinuous) => {
        setup(isContinuous);
        view.goToOffset(-1);
        deps2.renderCompletedItems.mockClear();
        view.goToOffset(0);
        expect(hidden()).toBe(false);
        expect(deps2.renderCompletedItems).toHaveBeenCalled();
    });

    test('a later day in phone landscape still hides the completed list', () => {
        setup(false);
        view.goToOffset(2);
        expect(hidden()).toBe(true);
    });

    test('a later day in the pinned layout keeps Today\'s completed block in the list', () => {
        setup(true);
        view.goToOffset(2);
        expect(hidden()).toBe(false);
    });
});

describe('script.js wiring', () => {
    test('agendaListDeps hands over the game date and the pager-driven completedView; the pager gets a render dep', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
        expect(src).toMatch(/currentGameDate:\s*State\.getCurrentGameDate,/);
        expect(src).toMatch(/completedView:\s*\(\)\s*=>\s*\{[\s\S]{0,400}getViewedDayOffset\(\)\s*!==\s*-1/);
        expect(src).toMatch(/completedTasksSectionEl:[^\n]*\n(?:[^\n]*\n){0,4}?\s*renderCompletedItems:\s*\(\)\s*=>\s*AgendaList\.renderCompletedItems\(agendaListDeps\(\)\)/);
    });
});

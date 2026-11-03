/**
 * @jest-environment jsdom
 *
 * Continuous day list, DOM behaviour (2026-11-03). jsdom has no layout, so the list box, the day sections and
 * scrollTo are faked: section tops come from LAYOUT below, scroll events are dispatched by hand, timers are fake.
 * What this pins is the logic that is easy to get wrong:
 *   - scrolling moves the active day (week-strip button, header text, canvas, time-preview flag) at once;
 *   - a button tap scrolls the list and PAUSES scroll-driven switching until that scroll settles
 *     (otherwise the active day flickers through every day in between);
 *   - the pause always ends (hard cap);
 *   - the yesterday snapshot and phone landscape keep the old one-day-at-a-time pager.
 * Real layout (heights, pinned top, overflow) is checked in a browser, not here.
 */
global.Schedule = require('../js/schedule.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.Habits = require('../js/habits.js');
global.Routines = require('../js/routines.js');
global.TimeSlider = require('../js/timeSlider.js');
global.DayPager = require('../js/dayPager.js');

const TODAY = new Date(2026, 10, 3, 10, 0, 0); // Tue Nov 3 2026
const BOX_TOP = 100;
// content-space top of each later day's section (offset 0 = Today = 0)
const LAYOUT = { 1: 300, 2: 600, 3: 900, 4: 1200, 5: 1500, 6: 1800 };

let view, box, deps, matchesContinuous, realRect;

function makeBox() {
    const el = document.createElement('div');
    el.className = 'task-list-container';
    document.body.appendChild(el);
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => 500 });
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => 2300 });
    el.scrollTop = 0;
    // an arrived scroll: the box ends up at the requested position (the smooth animation itself is not simulated)
    el.scrollTo = jest.fn(({ top }) => { el.scrollTop = top; });
    return el;
}

function setup({ continuous = true, activeItems = [] } = {}) {
    jest.useFakeTimers();
    jest.resetModules();
    document.body.innerHTML = '';
    matchesContinuous = continuous;
    window.matchMedia = (q) => ({
        matches: q.includes('orientation: landscape') ? matchesContinuous : false,
        addEventListener: () => {}, removeEventListener: () => {},
    });

    realRect = window.HTMLElement.prototype.getBoundingClientRect;
    window.HTMLElement.prototype.getBoundingClientRect = function () {
        if (this === box) return { top: BOX_TOP, bottom: BOX_TOP + 500, left: 0, right: 300, width: 300, height: 500 };
        if (this.classList && this.classList.contains('day-list-section')) {
            const top = BOX_TOP - box.scrollTop + LAYOUT[Number(this.dataset.offset)];
            return { top, bottom: top + 300, left: 0, right: 300, width: 300, height: 300 };
        }
        return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
    };

    box = makeBox();
    const mk = (tag, id) => { const e = document.createElement(tag); if (id) e.id = id; document.body.appendChild(e); return e; };
    const activeList = document.createElement('ul');
    activeList.id = 'activeItemsList';
    box.appendChild(activeList);
    const completed = document.createElement('div');
    completed.id = 'completedTasksSection';
    box.appendChild(completed);

    deps = {
        prevBtn: mk('button'), nextBtn: mk('button'), labelEl: mk('span'), taskSectionTitleEl: mk('h2'),
        gameCanvasEl: mk('div', 'gameCanvas'), activeItemsListEl: activeList, timeSliderEl: mk('input'),
        weekStripRowEl: mk('div'), taskCountDisplayEl: mk('span'), completedTasksSectionEl: completed,
        listScrollEl: box,
        updateTaskCountDisplay: jest.fn(),
        getCurrentGameDate: () => TODAY,
        getDefinedHabits: () => [], getDefinedRoutines: () => [], getDefinedTasks: () => [],
        getCompletedItems: () => [], getActiveItems: () => activeItems, getSickDayDate: () => null,
        dims: () => ({ gameScreenWidth: 300, baseWidth: 40, enemyWidth: 32, habitEnemyWidth: 32 }),
        setTimePreviewActive: jest.fn(),
        renderTodayAgenda: jest.fn(),
    };
    view = require('../js/ui/dayPagerView.js');
    view.init(deps);
}

afterEach(() => {
    if (realRect) window.HTMLElement.prototype.getBoundingClientRect = realRect;
    jest.clearAllTimers();
    jest.useRealTimers();
});

// scroll the faked list box to y and let the rAF-throttled handler run
function scrollTo(y) {
    box.scrollTop = y;
    box.dispatchEvent(new window.Event('scroll'));
    jest.advanceTimersByTime(32);
}

const activeCell = () => {
    const cell = deps.weekStripRowEl.querySelector('.week-strip-active');
    return cell ? Number(cell.dataset.offset) : null;
};
const lastPreviewFlag = () => {
    const calls = deps.setTimePreviewActive.mock.calls;
    return calls.length ? calls[calls.length - 1][0] : undefined;
};

describe('continuous list: setup', () => {
    beforeEach(() => setup());

    test('builds one section per later day, after Today and Completed Today', () => {
        const future = document.getElementById('dayListFuture');
        expect(future).not.toBeNull();
        expect(future.classList.contains('day-pager-hidden')).toBe(false);
        expect([...future.querySelectorAll('.day-list-section')].map(s => s.dataset.offset)).toEqual(['1', '2', '3', '4', '5', '6']);
        expect(box.lastElementChild).toBe(future);
        expect(future.querySelector('.day-list-divider').textContent).toBe('Tomorrow · Wed Nov 4');
    });

    test('starts on Today with the canvas live', () => {
        expect(view.getViewedDayOffset()).toBe(0);
        expect(activeCell()).toBe(0);
        expect(lastPreviewFlag()).toBe(false);
        expect(deps.taskSectionTitleEl.textContent).toBe("Today's Deadlines");
    });
});

describe('continuous list: scrolling moves the active day', () => {
    beforeEach(() => setup());

    test('Tomorrow takes over when its divider reaches the top, and everything follows at once', () => {
        scrollTo(300);
        expect(view.getViewedDayOffset()).toBe(1);
        expect(activeCell()).toBe(1);
        expect(deps.labelEl.textContent).toBe('Tomorrow');
        expect(deps.taskSectionTitleEl.textContent).toBe("Tomorrow's Deadlines");
        expect(deps.gameCanvasEl.classList.contains('viewing-other-day')).toBe(true);
        expect(lastPreviewFlag()).toBe(true);
    });

    test('nothing changes while the next divider is still below the top', () => {
        scrollTo(250);
        expect(view.getViewedDayOffset()).toBe(0);
        expect(activeCell()).toBe(0);
    });

    test('scrolling several days in one go lands on the right day', () => {
        scrollTo(1230);
        expect(view.getViewedDayOffset()).toBe(4);
        expect(activeCell()).toBe(4);
        expect(deps.labelEl.textContent).toBe('Sat · Nov 7');
    });

    test('scrolling back to the top returns to Today: canvas live, real rows refreshed once', () => {
        scrollTo(650);
        deps.renderTodayAgenda.mockClear();
        scrollTo(0);
        expect(view.getViewedDayOffset()).toBe(0);
        expect(deps.gameCanvasEl.classList.contains('viewing-other-day')).toBe(false);
        expect(lastPreviewFlag()).toBe(false);
        expect(deps.renderTodayAgenda).toHaveBeenCalledTimes(1);
    });

    test('Today\'s real list is never replaced by ghost rows while scrolling', () => {
        deps.activeItemsListEl.innerHTML = '<li id="real-row">real</li>';
        scrollTo(650);
        scrollTo(1500);
        expect(document.getElementById('real-row')).not.toBeNull();
    });

    test('a scroll that stays on the same day does not redraw anything', () => {
        scrollTo(320);
        const calls = deps.setTimePreviewActive.mock.calls.length;
        scrollTo(340);
        scrollTo(560);
        expect(deps.setTimePreviewActive.mock.calls.length).toBe(calls);
    });
});

describe('continuous list: button taps scroll the list and pause the sync', () => {
    beforeEach(() => setup());

    test('tapping a day jumps the state there and smooth-scrolls to its divider', () => {
        view.goToOffset(3);
        expect(view.getViewedDayOffset()).toBe(3);
        expect(activeCell()).toBe(3);
        expect(box.scrollTo).toHaveBeenCalledWith({ top: 900, behavior: 'smooth' });
    });

    test('tapping Today scrolls back to the top', () => {
        scrollTo(900);
        box.scrollTo.mockClear();
        view.goToOffset(0);
        expect(box.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
        expect(view.getViewedDayOffset()).toBe(0);
    });

    test('scroll events during the smooth scroll do NOT flicker the active day through the days in between', () => {
        view.goToOffset(5);
        const seen = [];
        for (const y of [200, 450, 800, 1100, 1400, 1500]) {
            scrollTo(y);
            seen.push(view.getViewedDayOffset());
            jest.advanceTimersByTime(40);
        }
        expect(seen).toEqual([5, 5, 5, 5, 5, 5]);
        expect(activeCell()).toBe(5);
    });

    test('once the scroll goes quiet the sync is back on', () => {
        view.goToOffset(2);
        scrollTo(600);
        jest.advanceTimersByTime(400); // quiet: lock released, sync ran at 600 -> still day 2
        expect(view.getViewedDayOffset()).toBe(2);
        scrollTo(1230);
        expect(view.getViewedDayOffset()).toBe(4);
    });

    test('if the list settles somewhere else than the tapped day, the state follows where it really is', () => {
        view.goToOffset(6);
        scrollTo(100);               // the player grabbed the list and dragged back to the top
        jest.advanceTimersByTime(400);
        expect(view.getViewedDayOffset()).toBe(0);
    });

    test('the pause always ends, even if scroll events never stop (hard cap)', () => {
        view.goToOffset(1);
        for (let i = 0; i < 25; i++) {          // 25 x 100ms = 2.5 s of non-stop scrolling
            box.scrollTop = 40;                  // parked at the top, so day 0 is the truth
            box.dispatchEvent(new window.Event('scroll'));
            jest.advanceTimersByTime(100);
        }
        expect(view.getViewedDayOffset()).toBe(0);
    });

    test('tapping the already-active day (nothing to scroll) cannot leave the sync stuck off', () => {
        view.goToOffset(0);
        jest.advanceTimersByTime(400);
        scrollTo(650);
        expect(view.getViewedDayOffset()).toBe(2);
    });

    test('the pager arrows step one day and scroll to it', () => {
        view.stepDay(1);
        expect(view.getViewedDayOffset()).toBe(1);
        expect(box.scrollTo).toHaveBeenLastCalledWith({ top: 300, behavior: 'smooth' });
        jest.advanceTimersByTime(400);
        view.stepDay(1);
        expect(box.scrollTo).toHaveBeenLastCalledWith({ top: 600, behavior: 'smooth' });
    });

    test('reduced-motion players get an instant jump', () => {
        const base = window.matchMedia;
        window.matchMedia = (q) => (q.includes('prefers-reduced-motion') ? { matches: true } : base(q));
        view.goToOffset(2);
        expect(box.scrollTo).toHaveBeenCalledWith({ top: 600, behavior: 'auto' });
    });

    test('the midnight rollover while parked on a later day snaps back to Today and the top', () => {
        view.goToOffset(2);
        jest.advanceTimersByTime(400);
        deps.getCurrentGameDate = () => new Date(2026, 10, 4, 0, 5, 0);
        view.checkRolloverReset();
        expect(view.getViewedDayOffset()).toBe(0);
        expect(box.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });
    });
});

describe('continuous list: Yesterday keeps the static snapshot', () => {
    beforeEach(() => setup());

    test('the ‹ arrow from Today swaps the list for the snapshot and hides the later days', () => {
        view.stepDay(-1);
        expect(view.getViewedDayOffset()).toBe(-1);
        expect(deps.activeItemsListEl.innerHTML).toContain('Nothing was scheduled');
        expect(document.getElementById('dayListFuture').classList.contains('day-pager-hidden')).toBe(true);
        // Yesterday shows yesterday's completions now (2026-11-03), so the block stays; completed-by-day.test.js covers what it holds.
        expect(deps.completedTasksSectionEl.classList.contains('day-pager-hidden')).toBe(false);
        expect(deps.timeSliderEl.disabled).toBe(true);
    });

    test('scrolling does not change the day while Yesterday is showing', () => {
        view.stepDay(-1);
        scrollTo(650);
        expect(view.getViewedDayOffset()).toBe(-1);
    });

    test('tapping a later day from Yesterday puts Today\'s real rows back and jumps (instant) to that day', () => {
        view.stepDay(-1);
        deps.renderTodayAgenda.mockClear();
        view.goToOffset(2);
        expect(deps.renderTodayAgenda).toHaveBeenCalledTimes(1);
        expect(document.getElementById('dayListFuture').classList.contains('day-pager-hidden')).toBe(false);
        expect(deps.completedTasksSectionEl.classList.contains('day-pager-hidden')).toBe(false);
        expect(deps.timeSliderEl.disabled).toBe(false);
        expect(box.scrollTo).toHaveBeenLastCalledWith({ top: 600, behavior: 'auto' });
    });

    test('Today from Yesterday restores the real list and the real count', () => {
        view.stepDay(-1);
        deps.renderTodayAgenda.mockClear();
        deps.updateTaskCountDisplay.mockClear();
        view.goToOffset(0);
        expect(deps.renderTodayAgenda).toHaveBeenCalled();
        expect(deps.updateTaskCountDisplay).toHaveBeenCalled();
    });
});

describe('phone landscape keeps the old one-day-at-a-time pager', () => {
    beforeEach(() => setup({ continuous: false }));

    test('the later-day sections stay hidden', () => {
        expect(document.getElementById('dayListFuture').classList.contains('day-pager-hidden')).toBe(true);
    });

    test('going to a later day swaps the list for that day\'s ghost rows and does not scroll', () => {
        view.goToOffset(2);
        expect(view.getViewedDayOffset()).toBe(2);
        expect(deps.activeItemsListEl.innerHTML).toContain('Nothing scheduled');
        expect(deps.completedTasksSectionEl.classList.contains('day-pager-hidden')).toBe(true);
        expect(box.scrollTo).not.toHaveBeenCalled();
    });

    test('scrolling never changes the day', () => {
        view.goToOffset(1);
        scrollTo(900);
        expect(view.getViewedDayOffset()).toBe(1);
    });

    test('back to Today restores the real list', () => {
        view.goToOffset(2);
        deps.renderTodayAgenda.mockClear();
        view.goToOffset(0);
        expect(deps.renderTodayAgenda).toHaveBeenCalledTimes(1);
    });
});

describe('continuous list: stays in step with saves', () => {
    test('a task added for tomorrow shows up in the list at the next strip refresh, and an unchanged week is not rewritten', () => {
        const items = [];
        setup({ activeItems: items });
        const firstSectionBefore = document.querySelector('.day-list-section');
        view.refreshWeekStrip();
        expect(document.querySelector('.day-list-section')).toBe(firstSectionBefore); // same markup: DOM untouched

        items.push({ id: 7, type: 'task', definitionId: null, name: 'Dentist', category: 'other', dueDateTime: new Date(2026, 10, 4, 15, 0), isHighPriority: false });
        view.refreshWeekStrip();
        const tomorrow = document.querySelector('.day-list-section[data-offset="1"]');
        expect(tomorrow.textContent).toContain('Dentist');
        expect(document.querySelector('.day-list-section[data-offset="2"]').textContent).toContain('Nothing scheduled');
    });

    test('an Anytime task due tomorrow reads Midnight', () => {
        const items = [{ id: 9, type: 'task', definitionId: null, name: 'Call the bank', category: 'other', anytime: true, dueDateTime: new Date(2026, 10, 4, 23, 59), isHighPriority: false }];
        setup({ activeItems: items });
        expect(document.querySelector('.day-list-section[data-offset="1"]').textContent).toContain('Midnight');
    });
});

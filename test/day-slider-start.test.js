/**
 * @jest-environment jsdom
 *
 * The time slider belongs to the day on screen (2026-11-03, Jeremy: "when we scroll to a new day, the slider
 * should start at the very beginning of that day -- where the zombie ghosts are placed is confusing").
 *
 * Before: a future day's ghosts were placed as if it were NOON (every morning item camped at the base), while the
 * slider kept showing the current time. Now: moving to a future day sets the slider to 12:00 AM, places the ghosts
 * from the start of that day, and dragging the slider slides that day's ghosts. Today and Yesterday are unchanged.
 *
 * Part 1: DayPagerView (anchor, slider reset, scrub, back to Today).
 * Part 2: TimeSliderView (a drag on a viewed day never touches the real board or the preview flag).
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
global.Schedule = require('../js/schedule.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.Habits = require('../js/habits.js');
global.Routines = require('../js/routines.js');
global.TimeSlider = require('../js/timeSlider.js');
global.DayPager = require('../js/dayPager.js');
const fs = require('fs');
const path = require('path');

const TODAY = new Date(2026, 10, 3, 10, 0, 0); // Tue Nov 3 2026, 10 AM
const at = (day, h, m = 0) => new Date(2026, 10, day, h, m, 0);
const DIMS = { gameScreenWidth: 1000, baseWidth: 100, enemyWidth: 40, habitEnemyWidth: 40 };
const task = (id, due, extra) => Object.assign({ id, name: 'Task ' + id, category: 'work', type: 'task', definitionId: null, dueDateTime: due }, extra);

describe('day pager: the slider starts at the beginning of the viewed day', () => {
    let view, deps, continuous;

    function setup({ isContinuous = true, activeItems = [] } = {}) {
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
        const canvas = mk('div', 'gameCanvas');
        deps = {
            prevBtn: mk('button'), nextBtn: mk('button'), labelEl: mk('span'), taskSectionTitleEl: mk('h2'),
            gameCanvasEl: canvas, activeItemsListEl: list, timeSliderEl: mk('input'),
            weekStripRowEl: mk('div'), taskCountDisplayEl: mk('span'), completedTasksSectionEl: mk('div'), listScrollEl: box,
            updateTaskCountDisplay: jest.fn(), getCurrentGameDate: () => TODAY,
            getDefinedHabits: () => [], getDefinedRoutines: () => [], getDefinedTasks: () => [],
            getCompletedItems: () => [], getActiveItems: () => activeItems, getSickDayDate: () => null,
            dims: () => DIMS,
            setTimePreviewActive: jest.fn(), renderTodayAgenda: jest.fn(), renderCompletedItems: jest.fn(),
            syncSlider: jest.fn(),
        };
        view = require('../js/ui/dayPagerView.js');
        view.init(deps);
        deps.syncSlider.mockClear();
    }
    const ghostLefts = () => [...document.querySelectorAll('.day-pager-ghost')].map(e => parseFloat(e.style.left));

    test.each([['pinned layout', true], ['phone landscape', false]])('moving to a future day (%s) points the slider at 12:00 AM of that day', (_n, isContinuous) => {
        setup({ isContinuous });
        view.goToOffset(2);
        const last = deps.syncSlider.mock.calls.pop()[0];
        expect(last.getTime()).toBe(at(5, 0).getTime());
    });

    test('ghosts are placed from the start of the day: a 9 AM task is NOT camped at the base (the old noon anchor put it there)', () => {
        setup({ activeItems: [task('a', at(5, 9)), task('b', at(5, 22))] });
        view.goToOffset(2);
        const [a, b] = ghostLefts();
        expect(a).toBeGreaterThan(DIMS.baseWidth);
        expect(b).toBeGreaterThan(a);              // later task starts further from the base
    });

    test('an early-morning task sits closer to the base than a late one, all from the day start', () => {
        setup({ activeItems: [task('early', at(5, 1)), task('late', at(5, 23, 30))] });
        view.goToOffset(2);
        const [early, late] = ghostLefts();
        expect(early).toBeLessThan(late);
    });

    test('getViewedDayStart: null on Today, the day\'s first minute on any other day (Yesterday too since 2026-11-04)', () => {
        setup();
        expect(view.getViewedDayStart()).toBeNull();
        view.goToOffset(3);
        expect(view.getViewedDayStart().getTime()).toBe(at(6, 0).getTime());
        view.goToOffset(-1);
        expect(view.getViewedDayStart().getTime()).toBe(at(2, 0).getTime());
    });

    test('previewGhostsAt slides the ghosts: at 9 AM a 9 AM task is at the base, at midnight it is not', () => {
        setup({ activeItems: [task('a', at(5, 9))] });
        view.goToOffset(2);
        const [atMidnight] = ghostLefts();
        view.previewGhostsAt(at(5, 9));
        const [atNine] = ghostLefts();
        expect(atNine).toBe(DIMS.baseWidth);
        expect(atMidnight).toBeGreaterThan(atNine);
        view.previewGhostsAt(at(5, 7));
        expect(ghostLefts()[0]).toBeGreaterThan(DIMS.baseWidth);
    });

    test('previewGhostsAt does nothing on Today or when no future day is showing', () => {
        setup({ activeItems: [task('a', at(5, 9))] });
        expect(() => view.previewGhostsAt(at(3, 12))).not.toThrow();
        expect(ghostLefts()).toEqual([]);
    });

    test('moving to another future day resets the slider to that day\'s start again', () => {
        setup();
        view.goToOffset(2);
        deps.syncSlider.mockClear();
        view.goToOffset(4);
        expect(deps.syncSlider.mock.calls.pop()[0].getTime()).toBe(at(7, 0).getTime());
    });

    test.each([['pinned layout', true], ['phone landscape', false]])('back to Today (%s) points the slider at the current time', (_n, isContinuous) => {
        setup({ isContinuous });
        view.goToOffset(2);
        deps.syncSlider.mockClear();
        const before = Date.now();
        view.goToOffset(0);
        const t = deps.syncSlider.mock.calls.pop()[0];
        expect(t.getTime()).toBeGreaterThanOrEqual(before);
        expect(t.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('Yesterday follows the slider too (2026-11-04): enabled, reset to 12:00 AM of yesterday', () => {
        setup();
        view.goToOffset(-1);
        expect(deps.timeSliderEl.disabled).toBe(false);
        expect(deps.syncSlider.mock.calls.pop()[0].getTime()).toBe(at(2, 0).getTime());
    });

    test('works without the optional syncSlider dep', () => {
        setup();
        delete deps.syncSlider;
        expect(() => { view.goToOffset(2); view.goToOffset(0); }).not.toThrow();
    });
});

describe('time slider view: a drag on a viewed future day', () => {
    let TimeSliderView, deps, sliderEl, labelEl, real, calls;

    function make(viewedStart) {
        jest.resetModules();
        document.body.innerHTML = '';
        TimeSliderView = require('../js/ui/timeSliderView.js');
        sliderEl = document.createElement('input'); sliderEl.type = 'range'; document.body.appendChild(sliderEl);
        labelEl = document.createElement('div'); document.body.appendChild(labelEl);
        const el = document.createElement('div'); document.body.appendChild(el);
        real = { element: el };
        calls = { preview: [], scrub: [], midnight: [] };
        deps = {
            sliderEl, labelEl,
            getActiveItems: () => [real],
            isNonThreatening: () => false,
            calculateTimelineXWithClustering: () => 555,
            updateMidnightLine: (t) => calls.midnight.push(t),
            dims: () => DIMS,
            setTimePreviewActive: (v) => calls.preview.push(v),
            getViewedDayStart: () => viewedStart,
            onOtherDayScrub: (t) => calls.scrub.push(t),
        };
        TimeSliderView.init(deps);
        calls.preview.length = 0; calls.scrub.length = 0; calls.midnight.length = 0;
    }
    const drag = (minutes) => { sliderEl.value = String(minutes); sliderEl.dispatchEvent(new Event('input')); };

    test('the drag hands that day\'s time to the pager and updates the label', () => {
        make(at(5, 0));
        drag(14 * 60 + 30);
        expect(calls.scrub.length).toBe(1);
        expect(calls.scrub[0].getTime()).toBe(at(5, 14, 30).getTime());
        expect(labelEl.textContent).toBe(TimeSlider.formatLabel(at(5, 14, 30)));
    });

    test('it never moves the real board, the midnight line or the preview flag', () => {
        make(at(5, 0));
        drag(600);
        expect(real.element.style.left).toBe('');
        expect(real.element.classList.contains('time-preview-ghost')).toBe(false);
        expect(calls.midnight).toEqual([]);
        expect(calls.preview).toEqual([]);
    });

    test('releasing leaves the handle where it is and keeps the preview on (no snap back to now)', () => {
        make(at(5, 0));
        drag(600);
        sliderEl.dispatchEvent(new Event('change'));
        sliderEl.dispatchEvent(new Event('pointerup'));
        expect(sliderEl.value).toBe('600');
        expect(calls.preview).toEqual([]);                 // never set to false
        expect(labelEl.textContent).toBe(TimeSlider.formatLabel(at(5, 10)));
    });

    test('on Today (no viewed day) the drag moves the real board and sets the flag; release keeps it parked (2026-11-04)', () => {
        make(null);
        drag(600);
        expect(calls.preview).toEqual([true]);
        expect(real.element.style.left).toBe('555px');
        expect(calls.scrub).toEqual([]);
        sliderEl.dispatchEvent(new Event('change'));
        expect(calls.preview).toEqual([true]);
        TimeSliderView.returnToNow();
        expect(calls.preview).toEqual([true, false]);
    });

    test('without the optional deps it does not throw', () => {
        make(null);
        delete deps.getViewedDayStart; delete deps.onOtherDayScrub;
        expect(() => { drag(600); sliderEl.dispatchEvent(new Event('change')); TimeSliderView.returnToNow(); }).not.toThrow();
        expect(calls.preview).toEqual([true, false]);
    });
});

describe('script.js wiring', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
    test('the slider is told which day is on screen and how to slide its ghosts', () => {
        expect(src).toMatch(/getViewedDayStart:\s*\(\)\s*=>[^\n]*DayPagerView\.getViewedDayStart\(\)/);
        expect(src).toMatch(/onOtherDayScrub:\s*\(time\)\s*=>[^\n]*DayPagerView\.previewGhostsAt\(time\)/);
    });
    test('the pager can point the slider at a time', () => {
        expect(src).toMatch(/syncSlider:\s*\(time\)\s*=>\s*TimeSliderView\.syncHandle\(time\)/);
    });
});

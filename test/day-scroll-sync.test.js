/**
 * Continuous day list, pure parts (2026-11-03, Jeremy: "scroll the list, the day buttons follow").
 *
 * In the pinned layout the agenda is one scrolling list: Today's rows, then a divider + ghost rows per later day,
 * and the active day (week-strip button, header text, canvas) follows the scroll position.
 *
 * Part 1: DayPager.activeOffsetFromTops, the rule that says which day owns the top of the list.
 * Part 2: the markup builders in DayPagerView (dividers, ghost rows, escaping, "Midnight").
 * Part 3: source guards (the layout CSS and the JS media query must agree; script.js hands the list box over).
 * The DOM wiring (scroll lock, button taps) is covered in day-scroll-sync-dom.test.js.
 */
const fs = require('fs');
const path = require('path');

global.Schedule = require('../js/schedule.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.Habits = require('../js/habits.js');
global.Routines = require('../js/routines.js');
global.TimeSlider = require('../js/timeSlider.js');
const DayPager = require('../js/dayPager.js');
global.DayPager = DayPager;
const DayPagerView = require('../js/ui/dayPagerView.js');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// A week laid out like the real list: Today first, each later day 300px further down.
const WEEK = [0, 1, 2, 3, 4, 5, 6].map(offset => ({ offset, top: offset * 300 }));

describe('DayPager.activeOffsetFromTops', () => {
    test('at the very top it is Today', () => {
        expect(DayPager.activeOffsetFromTops(WEEK, 0)).toBe(0);
    });

    test('a day becomes active when its divider reaches the top edge', () => {
        expect(DayPager.activeOffsetFromTops(WEEK, 300)).toBe(1);
        expect(DayPager.activeOffsetFromTops(WEEK, 900)).toBe(3);
        expect(DayPager.activeOffsetFromTops(WEEK, 1800)).toBe(6);
    });

    test('a divider still below the top edge does not take over', () => {
        expect(DayPager.activeOffsetFromTops(WEEK, 250)).toBe(0);
        expect(DayPager.activeOffsetFromTops(WEEK, 291)).toBe(0);
    });

    test('a divider a hair short of the edge still counts (threshold)', () => {
        expect(DayPager.activeOffsetFromTops(WEEK, 300 - DayPager.SCROLL_ACTIVE_THRESHOLD_PX)).toBe(1);
        expect(DayPager.activeOffsetFromTops(WEEK, 300 - DayPager.SCROLL_ACTIVE_THRESHOLD_PX - 1)).toBe(0);
    });

    test('the last divider that has passed the top wins', () => {
        expect(DayPager.activeOffsetFromTops(WEEK, 1000)).toBe(3);
        expect(DayPager.activeOffsetFromTops(WEEK, 1191)).toBe(3);
        expect(DayPager.activeOffsetFromTops(WEEK, 1200)).toBe(4);
    });

    test('a custom threshold of 0 needs the divider exactly at the edge', () => {
        expect(DayPager.activeOffsetFromTops(WEEK, 299, 0)).toBe(0);
        expect(DayPager.activeOffsetFromTops(WEEK, 300, 0)).toBe(1);
    });

    test('input order does not matter', () => {
        const shuffled = [WEEK[3], WEEK[0], WEEK[6], WEEK[1], WEEK[5], WEEK[2], WEEK[4]];
        for (const y of [0, 299, 300, 1000, 1800]) {
            expect(DayPager.activeOffsetFromTops(shuffled, y)).toBe(DayPager.activeOffsetFromTops(WEEK, y));
        }
    });

    test('junk entries are ignored and an empty list means Today', () => {
        expect(DayPager.activeOffsetFromTops([], 500)).toBe(0);
        expect(DayPager.activeOffsetFromTops(null, 500)).toBe(0);
        const noisy = [null, { offset: NaN, top: 5 }, { offset: 2, top: undefined }, ...WEEK];
        expect(DayPager.activeOffsetFromTops(noisy, 650)).toBe(2);
    });

    test('a bad scroll position reads as the top', () => {
        expect(DayPager.activeOffsetFromTops(WEEK, NaN)).toBe(0);
        expect(DayPager.activeOffsetFromTops(WEEK, undefined)).toBe(0);
    });

    test('the final day can be reached: with a list-height spacer the max scroll lands exactly on its divider', () => {
        const viewport = 500;
        const lastTop = 1800;
        // last section is min-height = viewport, so content height = lastTop + viewport and max scrollTop = lastTop
        const maxScroll = (lastTop + viewport) - viewport;
        expect(DayPager.activeOffsetFromTops(WEEK, maxScroll)).toBe(6);
    });

    test('without that spacer a short last day could never be reached (why the CSS spacer exists)', () => {
        const viewport = 500;
        const shortLastDay = 120;
        const maxScroll = (1800 + shortLastDay) - viewport; // 1420: the day-6 divider (1800) never gets to the top
        expect(DayPager.activeOffsetFromTops(WEEK, maxScroll)).toBe(4);
    });

    test('an empty Today leaves room above the first divider, so a freshly loaded list reads as Today', () => {
        // css: #activeItemsList:empty { min-height: 44px }. The threshold must stay well under that band.
        expect(DayPager.SCROLL_ACTIVE_THRESHOLD_PX).toBeLessThan(44);
        const emptyToday = [{ offset: 0, top: 0 }, { offset: 1, top: 44 }, { offset: 2, top: 200 }];
        expect(DayPager.activeOffsetFromTops(emptyToday, 0)).toBe(0);
    });
});

describe('DayPagerView.formatDividerLabel', () => {
    test('Tomorrow spells out its date', () => {
        expect(DayPagerView.formatDividerLabel(1, { start: new Date(2026, 10, 4) })).toBe('Tomorrow · Wed Nov 4');
    });

    test('later days use the weekday and date label', () => {
        expect(DayPagerView.formatDividerLabel(2, { start: new Date(2026, 10, 5) })).toBe('Thu · Nov 5');
        expect(DayPagerView.formatDividerLabel(6, { start: new Date(2026, 10, 9) })).toBe('Mon · Nov 9');
    });
});

describe('DayPagerView.futureSectionsHtml / ghostRowsHtml', () => {
    const ghost = (name, extra = {}) => ({ name, category: 'work', isHabit: false, dueTime: new Date(2026, 10, 4, 14, 30), ...extra });

    test('one section per day, in the order given, each with its offset and divider', () => {
        const html = DayPagerView.futureSectionsHtml([
            { offset: 1, label: 'Tomorrow · Wed Nov 4', ghosts: [ghost('Pay rent')] },
            { offset: 2, label: 'Thu · Nov 5', ghosts: [] },
        ]);
        const offsets = [...html.matchAll(/data-offset="(\d+)"/g)].map(m => Number(m[1]));
        expect(offsets).toEqual([1, 2]);
        expect(html).toContain('<h3 class="day-list-divider">Tomorrow · Wed Nov 4</h3>');
        expect(html).toContain('<h3 class="day-list-divider">Thu · Nov 5</h3>');
        expect(html.indexOf('Tomorrow')).toBeLessThan(html.indexOf('Thu · Nov 5'));
    });

    test('a day with nothing keeps its section and says so', () => {
        const html = DayPagerView.futureSectionsHtml([{ offset: 3, label: 'Fri · Nov 6', ghosts: [] }]);
        expect(html).toContain('data-offset="3"');
        expect(html).toContain('<li class="ghost-agenda-empty">Nothing scheduled</li>');
    });

    test('rows keep the given (due-time) order and show the due time', () => {
        const html = DayPagerView.ghostRowsHtml([
            ghost('Early one', { dueTime: new Date(2026, 10, 4, 8, 0) }),
            ghost('Late one', { dueTime: new Date(2026, 10, 4, 21, 0) }),
        ], 'Nothing scheduled');
        expect(html.indexOf('Early one')).toBeLessThan(html.indexOf('Late one'));
        expect(html).toContain(TimeSlider.formatLabel(new Date(2026, 10, 4, 8, 0)));
        expect(html).toContain(TimeSlider.formatLabel(new Date(2026, 10, 4, 21, 0)));
    });

    test('an Anytime task reads "Midnight", not 11:59 PM', () => {
        const html = DayPagerView.ghostRowsHtml([ghost('Call the bank', { anytime: true, dueTime: new Date(2026, 10, 4, 23, 59) })], 'x');
        expect(html).toContain('<span class="ghost-agenda-time">Midnight</span>');
        expect(html).not.toContain(TimeSlider.formatLabel(new Date(2026, 10, 4, 23, 59)));
    });

    test('habits are tagged', () => {
        const html = DayPagerView.ghostRowsHtml([ghost('Stretch', { isHabit: true, category: 'health' })], 'x');
        expect(html).toContain('health · habit');
    });

    test('names and categories are escaped (the old markup dropped them in raw)', () => {
        const html = DayPagerView.ghostRowsHtml([ghost('<img src=x onerror=alert(1)>', { category: '"><b>' })], 'x');
        expect(html).not.toContain('<img');
        expect(html).not.toContain('<b>');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    test('the yesterday snapshot still shows outcome badges and its own empty message', () => {
        const rows = DayPagerView.ghostRowsHtml([ghost('Gym', { outcome: 'completed' })], 'Nothing was scheduled');
        expect(rows).toContain('day-pager-outcome-badge outcome-completed');
        expect(rows).toContain('Completed');
        expect(DayPagerView.ghostRowsHtml([], 'Nothing was scheduled')).toContain('Nothing was scheduled');
    });
});

describe('continuous list wiring guards', () => {
    test('the JS media query and the CSS layout block use the same condition', () => {
        const js = read('js/ui/dayPagerView.js');
        const css = read('css/dayPager.css');
        const query = js.match(/CONTINUOUS_QUERY = '([^']+)'/)[1];
        expect(css).toContain(`@media ${query} {`);
    });

    test('the pinned layout is not applied to phone landscape (the canvas fills that screen)', () => {
        const css = read('css/dayPager.css');
        expect(css).toMatch(/@media not all and \(orientation: landscape\) and \(max-height: 500px\)/);
        // phone landscape is described by exactly this pair in responsive.css
        expect(read('css/responsive.css')).toMatch(/@media \(orientation: landscape\) and \(max-height: 500px\)/);
    });

    test('dayPager.css loads before responsive.css (responsive.css must stay last)', () => {
        const html = read('index.html');
        const pager = html.indexOf('href="css/dayPager.css"');
        const responsive = html.indexOf('href="css/responsive.css"');
        expect(pager).toBeGreaterThan(-1);
        expect(pager).toBeLessThan(responsive);
    });

    test('script.js hands the list box to the day pager view', () => {
        const rows = read('script.js').split(/\r?\n/);
        const start = rows.findIndex(l => /^\s*function dayPagerViewDeps\(\)/.test(l));
        expect(start).toBeGreaterThan(-1);
        expect(rows.slice(start, start + 40).join('\n')).toMatch(/listScrollEl:\s*document\.querySelector\('\.task-list-container'\)/);
    });

    test('the later-day sections are built in JS, so index.html has no copy to drift', () => {
        expect(read('index.html')).not.toContain('dayListFuture');
    });
});

/**
 * @jest-environment jsdom
 *
 * Ghosts follow the slider on every day, ghosts are tappable, and the slider stays where it is released
 * (2026-11-04, Jeremy):
 *   "when i use the time scroller on other days, the ghost zombies need to move accordingly to the time of day for
 *    that day based on their due times ... They should also be clickable so the user can look at which zombie that is."
 *   Yesterday: a beaten ghost leaves once the slider passes the moment it was beaten (yes). A live one-off ghost's
 *   card has an "Open task" button (yes).
 *   "make the slider not snap back to current time when not being used ... click something that will make it snap
 *    back to current time" -> the Now button.
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

describe('DayPager.doneTimeForEntry: when a Yesterday ghost was beaten', () => {
    const y = at(2, 0);
    test('a one-off: its own completedAt', () => {
        const done = task('a', at(2, 9), { completedAt: at(2, 8, 30) });
        expect(DayPager.doneTimeForEntry({ itemId: 'a', outcome: 'completed' }, [done], y)).toBe(at(2, 8, 30).getTime());
    });
    test('a routine task / habit: matched by definitionId and the day it was due', () => {
        const wrongDay = { type: 'task', definitionId: 7, originalDueDate: at(1, 9), completedAt: at(1, 9) };
        const right = { type: 'task', definitionId: 7, originalDueDate: at(2, 9), completedAt: at(2, 7, 15) };
        expect(DayPager.doneTimeForEntry({ definitionId: 7, isHabit: false, outcome: 'completed' }, [wrongDay, right], y))
            .toBe(at(2, 7, 15).getTime());
        const resisted = { type: 'habit', definitionId: 3, originalDueDate: at(2, 21), completedAt: at(2, 21, 5), outcome: 'avoided' };
        expect(DayPager.doneTimeForEntry({ definitionId: 3, isHabit: true, outcome: 'avoided' }, [resisted], y))
            .toBe(at(2, 21, 5).getTime());
    });
    test('missed, Slipped or no record: null (it never leaves the field)', () => {
        const slipped = { type: 'habit', definitionId: 3, originalDueDate: at(2, 21), completedAt: at(2, 21, 5), outcome: 'indulged' };
        expect(DayPager.doneTimeForEntry({ definitionId: 3, isHabit: true, outcome: 'indulged' }, [slipped], y)).toBeNull();
        expect(DayPager.doneTimeForEntry({ itemId: 'a', outcome: 'missed' }, [], y)).toBeNull();
        expect(DayPager.doneTimeForEntry({ itemId: 'a', outcome: 'completed' }, [], y)).toBeNull();
    });
    test('the snapshot carries doneAt on each entry', () => {
        const done = task('a', at(2, 9), { completedAt: at(2, 8, 30) });
        const open = task('b', at(2, 11));
        const snap = DayPager.conjureYesterdaySnapshot({ activeItems: [open], completedItems: [done] }, TODAY);
        const byKey = Object.fromEntries(snap.map(e => [e.itemId, e]));
        expect(byKey.a.doneAt).toBe(at(2, 8, 30).getTime());
        expect(byKey.b.doneAt).toBeNull();
        expect(byKey.b.outcome).toBe('missed');
    });
});

describe('GhostCard.buildModel', () => {
    const GhostCard = require('../js/ui/ghostCard.js');
    const fmt = (d) => TimeSlider.formatLabel(d);
    const rows = (m) => Object.fromEntries(m.rows.map(r => [r.label, r.value]));

    test('type uses the Build Habit / Break Habit wording, plus Task and Sub-task', () => {
        expect(GhostCard.kindLabel({ isHabit: true })).toBe('Build Habit');
        expect(GhostCard.kindLabel({ isHabit: true, isNegative: true })).toBe('Break Habit');
        expect(GhostCard.kindLabel({})).toBe('Task');
        expect(GhostCard.kindLabel({ parentId: 4 })).toBe('Sub-task');
    });

    test('shows category, routine, day, start and due', () => {
        const m = GhostCard.buildModel({ name: 'Gym', category: 'health', isHabit: true, startTime: at(5, 7), dueTime: at(5, 9) },
            { routineName: 'Mornings', dayLabel: 'Thu · Nov 5', formatTime: fmt });
        expect(m.title).toBe('Gym');
        expect(rows(m)).toEqual({ Type: 'Build Habit', Category: 'Health', Routine: 'Mornings', Day: 'Thu · Nov 5', Start: fmt(at(5, 7)), Due: fmt(at(5, 9)) });
    });

    test('anytime reads Midnight; Yesterday shows the result with its time', () => {
        expect(rows(GhostCard.buildModel({ name: 'x', dueTime: at(5, 23, 59), anytime: true }, { formatTime: fmt })).Due).toBe('Midnight');
        const r = rows(GhostCard.buildModel({ name: 'x', dueTime: at(2, 9), outcome: 'completed', doneAt: at(2, 8, 30).getTime() }, { formatTime: fmt }));
        expect(r.Result).toBe('Completed at ' + fmt(at(2, 8, 30)));
        expect(rows(GhostCard.buildModel({ name: 'x', dueTime: at(2, 9), outcome: 'indulged' }, {})).Result).toBe('Slipped');
    });

    test('Open task only for a ghost with a real item that is still live', () => {
        expect(GhostCard.buildModel({ name: 'x', itemId: 'a' }, { canOpen: true }).canOpen).toBe(true);
        expect(GhostCard.buildModel({ name: 'x', itemId: 'a' }, { canOpen: false }).canOpen).toBe(false);
        expect(GhostCard.buildModel({ name: 'x' }, { canOpen: true }).canOpen).toBe(false);
        expect(GhostCard.cardHtml(GhostCard.buildModel({ name: 'x', itemId: 'a' }, { canOpen: true }))).toMatch(/data-action="open">Open task</);
    });

    test('player text is escaped', () => {
        expect(GhostCard.cardHtml(GhostCard.buildModel({ name: '<b>hi</b>' }, {}))).not.toMatch(/<b>hi/);
    });
});

describe('day pager: Yesterday follows the slider, ghosts are tappable', () => {
    let view, deps, active, completed;

    function setup({ isContinuous = true } = {}) {
        jest.resetModules();
        document.body.innerHTML = '';
        global.Modal = require('../js/ui/modal.js');
        global.GhostCard = require('../js/ui/ghostCard.js');
        window.matchMedia = (q) => ({
            matches: q.includes('orientation: landscape') ? isContinuous : false,
            addEventListener: () => {}, removeEventListener: () => {},
        });
        const mk = (tag, id) => { const e = document.createElement(tag); if (id) e.id = id; document.body.appendChild(e); return e; };
        const box = mk('div'); box.className = 'task-list-container';
        const list = document.createElement('ul'); list.id = 'activeItemsList'; box.appendChild(list);
        deps = {
            prevBtn: mk('button'), nextBtn: mk('button'), labelEl: mk('span'), taskSectionTitleEl: mk('h2'),
            gameCanvasEl: mk('div', 'gameCanvas'), activeItemsListEl: list, timeSliderEl: mk('input'),
            weekStripRowEl: mk('div'), taskCountDisplayEl: mk('span'), completedTasksSectionEl: mk('div'), listScrollEl: box,
            updateTaskCountDisplay: jest.fn(), getCurrentGameDate: () => TODAY,
            getDefinedHabits: () => [], getDefinedRoutines: () => [{ id: 'r1', name: 'Mornings' }], getDefinedTasks: () => [],
            getCompletedItems: () => completed, getActiveItems: () => active, getSickDayDate: () => null,
            dims: () => DIMS,
            setTimePreviewActive: jest.fn(), renderTodayAgenda: jest.fn(), renderCompletedItems: jest.fn(),
            syncSlider: jest.fn(), onTodayShown: jest.fn(), openItemCard: jest.fn(),
        };
        view = require('../js/ui/dayPagerView.js');
        view.init(deps);
    }
    const sprites = () => [...document.querySelectorAll('.day-pager-ghost')];
    const flush = () => new Promise(r => setTimeout(r, 0));

    beforeEach(() => {
        // Yesterday: 'done' beaten at 8:30 AM (due 9 AM), 'late' missed (due 11 AM, still open).
        completed = [task('done', at(2, 9), { completedAt: at(2, 8, 30) })];
        active = [task('late', at(2, 11)), task('fut', at(5, 15))];
    });

    test('Yesterday: ghosts slide by time; the beaten one leaves after 8:30 AM, the missed one stays at the church', () => {
        setup();
        view.goToOffset(-1);
        const [done, late] = sprites(); // sorted by due: 9 AM, 11 AM
        expect(parseFloat(done.style.left)).toBeGreaterThan(DIMS.baseWidth);
        view.previewGhostsAt(at(2, 8));
        expect(done.classList.contains('ghost-done')).toBe(false);
        view.previewGhostsAt(at(2, 8, 30));
        expect(done.classList.contains('ghost-done')).toBe(true);
        view.previewGhostsAt(at(2, 12));
        expect(late.classList.contains('ghost-done')).toBe(false);
        expect(parseFloat(late.style.left)).toBe(DIMS.baseWidth);
        view.previewGhostsAt(at(2, 7)); // dragging back brings it back
        expect(done.classList.contains('ghost-done')).toBe(false);
    });

    test('tapping a ghost opens its card and marks its row; closing clears the marks', async () => {
        setup({ isContinuous: false });
        view.goToOffset(-1);
        const [done] = sprites();
        done.click();
        await flush();
        const card = document.querySelector('.ghost-card-overlay');
        expect(card).not.toBeNull();
        expect(card.textContent).toMatch('Task done');
        expect(card.textContent).toMatch('Completed at ' + TimeSlider.formatLabel(at(2, 8, 30)));
        expect(card.querySelector('[data-action="open"]')).toBeNull(); // already completed: nothing live to open
        expect(done.classList.contains('ghost-selected')).toBe(true);
        expect(document.querySelectorAll('.ghost-agenda-row--selected').length).toBe(1);
        card.querySelector('[data-action="close"]').click();
        await flush();
        expect(document.querySelector('.ghost-card-overlay')).toBeNull();
        expect(document.querySelectorAll('.ghost-selected, .ghost-agenda-row--selected').length).toBe(0);
    });

    test('a live one-off ghost on a future day offers Open task, which opens the real card', async () => {
        setup();
        view.goToOffset(2);
        const [fut] = sprites();
        fut.click();
        await flush();
        const open = document.querySelector('.ghost-card-overlay [data-action="open"]');
        expect(open).not.toBeNull();
        open.click();
        expect(deps.openItemCard).toHaveBeenCalledWith('fut');
        expect(document.querySelector('.ghost-card-overlay')).toBeNull();
    });

    test('the ghost list rows carry the ghost key (so the tapped one can be marked)', () => {
        expect(require('../js/ui/dayPagerView.js').ghostRowsHtml([{ key: 'existing:x', name: 'n', category: 'work', dueTime: at(5, 9) }], ''))
            .toMatch(/data-ghost-key="existing:x"/);
    });

    test('Today tells the slider whether it came back from another day', () => {
        setup();
        deps.onTodayShown.mockClear();
        view.goToOffset(0); // Today re-rendered from Today
        expect(deps.onTodayShown).toHaveBeenLastCalledWith(false);
        view.goToOffset(3);
        view.goToOffset(0);
        expect(deps.onTodayShown).toHaveBeenLastCalledWith(true);
    });
});

describe('TimeSliderView: the handle stays put; the Now button returns it', () => {
    let TSV, deps, sliderEl, nowBtn, calls, offset, real;

    function make() {
        jest.resetModules();
        document.body.innerHTML = '';
        TSV = require('../js/ui/timeSliderView.js');
        sliderEl = document.createElement('input'); sliderEl.type = 'range'; document.body.appendChild(sliderEl);
        nowBtn = document.createElement('button'); document.body.appendChild(nowBtn);
        const el = document.createElement('div'); document.body.appendChild(el);
        real = { element: el };
        offset = 0;
        calls = { preview: [], today: 0 };
        deps = {
            sliderEl, labelEl: document.createElement('div'), nowButtonEl: nowBtn,
            getActiveItems: () => [real], isNonThreatening: () => false,
            calculateTimelineXWithClustering: () => 555, updateMidnightLine: () => {}, dims: () => DIMS,
            setTimePreviewActive: (v) => calls.preview.push(v),
            getViewedDayStart: () => (offset === 0 ? null : at(5, 0)),
            onOtherDayScrub: () => {},
            getViewedDayOffset: () => offset,
            goToToday: () => { calls.today++; offset = 0; TSV.onTodayShown(true); },
        };
        TSV.init(deps);
    }
    const drag = (minutes) => { sliderEl.value = String(minutes); sliderEl.dispatchEvent(new Event('input')); };

    test('hidden while live; shows once the handle is parked; Now returns to the current time and hides', () => {
        make();
        expect(nowBtn.hidden).toBe(true);
        drag(60);
        sliderEl.dispatchEvent(new Event('change'));
        expect(nowBtn.hidden).toBe(false);
        expect(real.element.classList.contains('time-preview-ghost')).toBe(true);
        nowBtn.click();
        expect(calls.preview).toEqual([true, false]);
        expect(real.element.classList.contains('time-preview-ghost')).toBe(false);
        expect(nowBtn.hidden).toBe(true);
        const nowMin = TimeSlider.timeToMinutesOfDay(new Date(), TimeSlider.getDayBounds(new Date()).start);
        expect(Math.abs(Number(sliderEl.value) - nowMin)).toBeLessThanOrEqual(1);
    });

    test('on another day it shows, and Now goes back to Today', () => {
        make();
        offset = 2;
        TSV.syncHandle(at(5, 0)); // the pager points the slider at that day
        expect(nowBtn.hidden).toBe(false);
        nowBtn.click();
        expect(calls.today).toBe(1);
        expect(nowBtn.hidden).toBe(true);
    });

    test('a re-render of Today keeps a parked handle; coming back from another day returns to now', () => {
        make();
        drag(60);
        TSV.onTodayShown(false);
        expect(TSV.isParked()).toBe(true);
        TSV.onTodayShown(true);
        expect(TSV.isParked()).toBe(false);
    });

    test('a parked handle returns to now when the real day changes (midnight)', () => {
        make();
        drag(60);
        TSV.checkParkedRollover(new Date());
        expect(TSV.isParked()).toBe(true);
        TSV.checkParkedRollover(new Date(Date.now() + 36 * 3600 * 1000));
        expect(TSV.isParked()).toBe(false);
    });
});

describe('wiring', () => {
    const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    test('script.js passes the Now button, Today hooks, the ghost Open task path and the midnight check', () => {
        const src = read('script.js');
        expect(src).toMatch(/nowButtonEl:\s*timeSliderNowBtn/);
        expect(src).toMatch(/getElementById\('timeSliderNow'\)/);
        expect(src).toMatch(/goToToday:[^\n]*DayPagerView\.goToOffset\(0\)/);
        expect(src).toMatch(/onTodayShown:\s*\(fromOtherDay\)\s*=>\s*TimeSliderView\.onTodayShown\(fromOtherDay\)/);
        expect(src).toMatch(/openItemCard:\s*\(itemId\)\s*=>\s*handleEnemyClick\(itemId\)/);
        expect(src).toMatch(/checkDayPagerRollover:[^\n]*TimeSliderView\.checkParkedRollover\(\)/);
    });
    test('index.html has the Now button and loads ghostCard.js; sw.js precaches it', () => {
        const html = read('index.html');
        expect(html).toMatch(/id="timeSliderNow"[^>]*hidden/);
        expect(html).toMatch(/<script src="js\/ui\/ghostCard\.js"><\/script>/);
        expect(read('sw.js')).toMatch(/'js\/ui\/ghostCard\.js'/);
    });
    test('ghost sprites are no longer pointer-events: none', () => {
        const css = read('css/dayPager.css');
        const rule = css.match(/\.day-pager-ghost \{[^}]*\}/)[0];
        expect(rule).not.toMatch(/pointer-events:\s*none/);
    });
});

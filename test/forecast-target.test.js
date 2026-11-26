/**
 * @jest-environment jsdom
 *
 * Planning ahead TARGET marker (2026-11-26, Jeremy; DECISIONS 2026-11-26; ROADMAP "Planning ahead" leaning 4):
 * on a LATER day's page (the forecast) a ghost that holds a priority slot of its own wears a pulsing red "TARGET" tag
 * and a red reticle on the ground. Never Today / Yesterday, never a habit, never a sub-task covered by its parent.
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

const TODAY = new Date(2026, 10, 3, 10, 0, 0);
const at = (day, h, m = 0) => new Date(2026, 10, day, h, m, 0);
const DIMS = { gameScreenWidth: 1000, baseWidth: 100, enemyWidth: 40, habitEnemyWidth: 40 };
const task = (id, due, extra) => Object.assign({ id, name: 'Task ' + id, category: 'work', type: 'task', definitionId: null, dueDateTime: due }, extra);

describe('DayPager.isForecastTarget', () => {
    test('only a later day, only a ghost that owns its priority, never a habit', () => {
        const own = { ownsPriority: true };
        expect(DayPager.isForecastTarget(own, 1)).toBe(true);
        expect(DayPager.isForecastTarget(own, 6)).toBe(true);
        expect(DayPager.isForecastTarget(own, 0)).toBe(false);
        expect(DayPager.isForecastTarget(own, -1)).toBe(false);
        expect(DayPager.isForecastTarget({ ownsPriority: false, isHighPriority: true }, 2)).toBe(false);
        expect(DayPager.isForecastTarget({ ownsPriority: true, isHabit: true }, 2)).toBe(false);
        expect(DayPager.isForecastTarget(null, 2)).toBe(false);
    });
    test('existingItemsForDay: ownsPriority is false for a sub-task riding on its parent', () => {
        const items = [
            task('p', at(5, 15), { isHighPriority: true }),
            task('s', at(5, 14), { isHighPriority: true, priorityInherited: true, parentId: 'p' }),
            task('n', at(5, 16)),
        ];
        const byId = Object.fromEntries(DayPager.existingItemsForDay(items, at(5, 0)).map(g => [g.itemId, g]));
        expect(byId.p.ownsPriority).toBe(true);
        expect(byId.s.ownsPriority).toBe(false);
        expect(byId.n.ownsPriority).toBe(false);
    });
});

describe('day pager: the TARGET marker on the canvas', () => {
    let view, active;
    function setup() {
        jest.resetModules();
        document.body.innerHTML = '';
        global.Modal = require('../js/ui/modal.js');
        global.GhostCard = require('../js/ui/ghostCard.js');
        window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
        const mk = (tag, id) => { const e = document.createElement(tag); if (id) e.id = id; document.body.appendChild(e); return e; };
        const box = mk('div'); box.className = 'task-list-container';
        const list = document.createElement('ul'); list.id = 'activeItemsList'; box.appendChild(list);
        const deps = {
            prevBtn: mk('button'), nextBtn: mk('button'), labelEl: mk('span'), taskSectionTitleEl: mk('h2'),
            gameCanvasEl: mk('div', 'gameCanvas'), activeItemsListEl: list, timeSliderEl: mk('input'),
            weekStripRowEl: mk('div'), taskCountDisplayEl: mk('span'), completedTasksSectionEl: mk('div'), listScrollEl: box,
            updateTaskCountDisplay: jest.fn(), getCurrentGameDate: () => TODAY,
            getDefinedHabits: () => [], getDefinedRoutines: () => [], getDefinedTasks: () => [],
            getCompletedItems: () => [], getActiveItems: () => active, getSickDayDate: () => null,
            dims: () => DIMS,
            setTimePreviewActive: jest.fn(), renderTodayAgenda: jest.fn(), renderCompletedItems: jest.fn(),
            syncSlider: jest.fn(), onTodayShown: jest.fn(), openItemCard: jest.fn(),
        };
        view = require('../js/ui/dayPagerView.js');
        view.init(deps);
    }
    const ghost = (id) => [...document.querySelectorAll('.day-pager-ghost')]
        .find(el => el.getAttribute('aria-label').startsWith('Task ' + id));

    beforeEach(() => {
        active = [
            task('p', at(5, 15), { isHighPriority: true }),
            task('s', at(5, 14), { isHighPriority: true, priorityInherited: true, parentId: 'p' }),
            task('n', at(5, 16)),
            task('y', at(2, 11), { isHighPriority: true }), // yesterday, still open
        ];
    });

    test('a later day: the priority ghost gets the tag + reticle; a plain task and a covered sub-task do not', () => {
        setup();
        view.goToOffset(2);
        const p = ghost('p');
        expect(p.classList.contains('forecast-target')).toBe(true);
        expect(p.querySelector('.target-label').textContent).toBe('TARGET');
        expect(p.querySelector('.target-reticle svg')).not.toBeNull();
        expect(p.getAttribute('aria-label')).toBe('Task p (priority target)');
        expect(ghost('n').classList.contains('forecast-target')).toBe(false);
        expect(ghost('s').classList.contains('forecast-target')).toBe(false);
        expect(document.querySelectorAll('.target-label').length).toBe(1);
    });

    test('Yesterday shows no target, and paging away clears it', () => {
        setup();
        view.goToOffset(-1);
        expect(document.querySelectorAll('.forecast-target').length).toBe(0);
        view.goToOffset(2);
        expect(document.querySelectorAll('.forecast-target').length).toBe(1);
        view.goToOffset(0);
        expect(document.querySelectorAll('.forecast-target').length).toBe(0);
    });

    test('a tap on a target ghost still opens its card', async () => {
        setup();
        view.goToOffset(2);
        ghost('p').click();
        await new Promise(r => setTimeout(r, 0));
        const card = document.querySelector('.ghost-card-overlay');
        expect(card).not.toBeNull();
        card.querySelector('[data-action="close"]').click();
        await new Promise(r => setTimeout(r, 0));
        expect(document.querySelector('.ghost-card-overlay')).toBeNull();
    });
});

describe('TARGET marker CSS pins', () => {
    const css = fs.readFileSync(path.join(__dirname, '../css/dayPager.css'), 'utf8');
    test('red, its own reticle (not the plain .enemy-ring), hidden in the portrait strip', () => {
        expect(css).toMatch(/\.forecast-target \{[^}]*--target-red: #ff3b30/);
        expect(css).not.toMatch(/forecast-target[^{]*\.enemy-ring/);
        expect(css).toMatch(/body\.glance-strip \.forecast-target \.target-label,\s*body\.glance-strip \.forecast-target \.target-reticle \{\s*display: none;/);
    });
    test('the pulse only runs with full effects and no reduced motion', () => {
        const block = css.slice(css.indexOf('@keyframes target-tag-pulse'));
        expect(block).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{\s*body:not\(\.fx-reduced\):not\(\.fx-off\) \.forecast-target \.target-label/);
    });
});

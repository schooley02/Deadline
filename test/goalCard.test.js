/**
 * @jest-environment jsdom
 */
/** Goal card (Build B1, 2026-11-05): pure html helpers and the DOM interactions (step, type in, tick, confirm retire / delete). */
global.CONFIG = require('../js/config.js');
global.Goals = require('../js/goals.js');
global.Theme = require('../js/theme.js');
global.GoalsPane = require('../js/ui/goalsPane.js');
global.Modal = require('../js/ui/modal.js');
const GoalCard = require('../js/ui/goalCard.js');

const NOW = new Date(2026, 10, 5, 12, 0, 0).getTime();

const numberTarget = (over) => Object.assign({ id: 'a', type: 'number', label: 'Steps', start: 0, end: 10, current: 3, done: false }, over || {});
function makeView(over) {
    const t = numberTarget();
    const base = {
        id: 7,
        goal: { id: 7, name: 'Read a book', kind: 'milestone', period: null, deadline: null, stage: 1, streak: 0, bestStreak: 0, periodsMet: 0, history: [], targets: [t] },
        progress: 0.3, stage: 1, pace: 'ahead', recent: null,
        targets: [{ target: t, progress: 0.3, detail: { kind: 'number', have: 3, need: 10, mode: 'goal' } }],
    };
    const goal = Object.assign({}, base.goal, (over && over.goal) || {});
    return Object.assign(base, over || {}, { goal });
}

describe('pure helpers', () => {
    test('stepFor grows with the range', () => {
        expect(GoalCard.stepFor({ start: 0, end: 10 })).toBe(1);
        expect(GoalCard.stepFor({ start: 0, end: 60 })).toBe(5);
        expect(GoalCard.stepFor({ start: 0, end: 500 })).toBe(10);
        expect(GoalCard.stepFor({ start: 200, end: 180 })).toBe(1);
    });
    test('directionOf: down when the end is below the start', () => {
        expect(GoalCard.directionOf({ start: 0, end: 5 })).toBe(1);
        expect(GoalCard.directionOf({ start: 200, end: 180 })).toBe(-1);
    });
    test('targetText per kind', () => {
        const e = (detail) => ({ detail });
        expect(GoalCard.targetText(e({ kind: 'number', have: 3, need: 10, noun: 'steps' }))).toBe('3 of 10 steps');
        expect(GoalCard.targetText(e({ kind: 'number', have: 190, need: 180, start: 200, noun: 'lb' }))).toBe('190 lb (from 200 to 180)');
        expect(GoalCard.targetText(e({ kind: 'bool', have: 1 }))).toBe('Done');
        expect(GoalCard.targetText(e({ kind: 'bool', have: 0 }))).toBe('Not yet');
        expect(GoalCard.targetText(e({ kind: 'linked', have: 2, need: 5 }))).toBe('2 of 5 done');
        expect(GoalCard.targetText(e({ kind: 'linked', have: 0, need: 0 }))).toBe('Nothing linked yet');
        expect(GoalCard.targetText(e({ kind: 'aggregate', noun: 'days', have: 2, need: 5 }))).toBe('2 of 5 days so far');
        expect(GoalCard.targetText(e({ kind: 'aggregate', mode: 'limit', noun: 'min', have: 20, need: 30 }))).toBe('20 min so far (keep it to 30 min or less)');
    });
    test('targetNote only for self-counting targets', () => {
        expect(GoalCard.targetNote({ target: { type: 'linked' } })).toMatch(/linked tasks and habits/);
        expect(GoalCard.targetNote({ target: { type: 'aggregate' } })).toMatch(/Nothing to enter/);
        expect(GoalCard.targetNote({ target: { type: 'number' } })).toBe('');
    });
    test('streakLine only for recurring goals', () => {
        expect(GoalCard.streakLine({ kind: 'milestone' })).toBe('');
        expect(GoalCard.streakLine({ kind: 'recurring', streak: 2, bestStreak: 4, periodsMet: 1 })).toBe('Streak 2 · Best 4 · 1 period met');
        expect(GoalCard.streakLine({ kind: 'recurring', streak: 0, bestStreak: 0, periodsMet: 3 })).toContain('3 periods met');
    });
});

describe('html', () => {
    test('a number target has - input + controls; a bool has a check; linked has only a note', () => {
        const view = makeView();
        view.targets.push({ target: { id: 'b', type: 'bool', label: 'Sign up', done: false }, progress: 0, detail: { kind: 'bool', have: 0, need: 1 } });
        view.targets.push({ target: { id: 'c', type: 'linked', label: 'Workouts' }, progress: 0.2, detail: { kind: 'linked', have: 1, need: 5 } });
        const html = GoalCard.html(view, { nowMs: NOW, weekStartsOn: 1 });
        expect(html.match(/data-action="num-step"/g)).toHaveLength(2);
        expect(html).toContain('data-action="num-set"');
        expect(html).toContain('type="checkbox"');
        expect(html).toContain('goal-target--linked');
        expect(html).toContain('Counted as you finish');
    });
    test('Retire is offered to recurring goals only; Delete to all', () => {
        const milestone = GoalCard.html(makeView(), { nowMs: NOW, weekStartsOn: 1 });
        expect(milestone).not.toContain('data-action="retire"');
        expect(milestone).toContain('data-action="delete"');
        const recurring = GoalCard.html(makeView({ goal: { kind: 'recurring', period: 'week' } }), { nowMs: NOW, weekStartsOn: 1 });
        expect(recurring).toContain('data-action="retire"');
    });
    test('the confirm replaces the buttons', () => {
        const retire = GoalCard.html(makeView({ goal: { kind: 'recurring', period: 'week' } }), { nowMs: NOW, weekStartsOn: 1, confirm: 'retire' });
        expect(retire).toContain('data-action="retire-yes"');
        expect(retire).toContain('moves to your survivors list with its streak');
        expect(retire).not.toContain('data-action="close"');
        const del = GoalCard.html(makeView(), { nowMs: NOW, weekStartsOn: 1, confirm: 'delete' });
        expect(del).toContain('data-action="delete-yes"');
    });
    test('names are escaped', () => {
        const html = GoalCard.html(makeView({ goal: { name: '<img src=x>' } }), { nowMs: NOW, weekStartsOn: 1 });
        expect(html).not.toContain('<img src=x>');
        expect(html).toContain('&lt;img src=x&gt;');
    });
    test('the streak strip shows for recurring goals', () => {
        const html = GoalCard.html(makeView({ goal: { kind: 'recurring', period: 'week', streak: 2, bestStreak: 2, periodsMet: 2, history: [{ key: 'w1', met: true }, { key: 'w2', met: false }] } }), { nowMs: NOW, weekStartsOn: 1 });
        expect(html).toContain('Streak 2');
        expect(html.match(/goal-pip/g).length).toBeGreaterThanOrEqual(2);
    });
});

describe('DOM', () => {
    let current;
    let calls;
    let deps;

    function open() {
        return GoalCard.open(7, deps);
    }

    beforeEach(() => {
        document.body.innerHTML = '';
        current = makeView();
        calls = { update: [], retire: [], remove: [], after: 0 };
        deps = {
            getView: () => current,
            nowMs: () => NOW,
            weekStartsOn: 1,
            updateTarget: (goalId, targetId, patch) => {
                calls.update.push([goalId, targetId, patch]);
                if (patch.current != null) current.targets[0].target.current = patch.current;
                return { changed: true, completed: calls.completeNext ? [{ id: 7 }] : [] };
            },
            retire: (id) => calls.retire.push(id),
            remove: (id) => calls.remove.push(id),
            afterChange: () => { calls.after += 1; },
        };
    });

    test('opens a card; a second open does not stack', () => {
        const overlay = open();
        expect(overlay).not.toBeNull();
        expect(document.querySelectorAll('.goal-card-overlay')).toHaveLength(1);
        expect(open()).toBeNull();
        expect(document.querySelectorAll('.goal-card-overlay')).toHaveLength(1);
    });

    test('returns null when the goal is gone', () => {
        current = null;
        expect(open()).toBeNull();
    });

    test('+ steps the number up by one and tells the owner', () => {
        open();
        document.querySelector('[data-action="num-step"][data-dir="1"]').click();
        expect(calls.update).toEqual([[7, 'a', { current: 4 }]]);
        expect(calls.after).toBe(1);
        expect(document.querySelector('.goal-num-input').value).toBe('4'); // re-rendered from the new value
    });

    test('- steps a count-down target the right way', () => {
        current.targets[0].target = numberTarget({ start: 200, end: 180, current: 190 });
        open();
        document.querySelector('[data-action="num-step"][data-dir="1"]').click(); // "+" = toward the goal
        expect(calls.update[0][2]).toEqual({ current: 189 });
    });

    test('typing a value commits on change; junk is ignored', () => {
        open();
        const input = document.querySelector('.goal-num-input');
        input.value = '7';
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(calls.update[0][2]).toEqual({ current: 7 });
        const again = document.querySelector('.goal-num-input');
        again.value = '';
        again.dispatchEvent(new Event('change', { bubbles: true }));
        expect(calls.update).toHaveLength(1);
    });

    test('ticking a yes/no target sends done', () => {
        current.targets[0] = { target: { id: 'b', type: 'bool', label: 'Sign up', done: false }, progress: 0, detail: { kind: 'bool', have: 0, need: 1 } };
        open();
        const box = document.querySelector('input[data-action="bool"]');
        box.checked = true;
        box.dispatchEvent(new Event('change', { bubbles: true }));
        expect(calls.update[0]).toEqual([7, 'b', { done: true }]);
    });

    test('a completing update closes the card', () => {
        calls.completeNext = true;
        open();
        document.querySelector('[data-action="num-step"][data-dir="1"]').click();
        expect(document.querySelector('.goal-card-overlay')).toBeNull();
        expect(calls.after).toBe(1);
    });

    test('Delete asks first, Keep it backs out, Delete confirms', () => {
        open();
        document.querySelector('[data-action="delete"]').click();
        expect(document.querySelector('[data-action="delete-yes"]')).not.toBeNull();
        document.querySelector('[data-action="cancel-confirm"]').click();
        expect(document.querySelector('[data-action="delete-yes"]')).toBeNull();
        expect(calls.remove).toEqual([]);
        document.querySelector('[data-action="delete"]').click();
        document.querySelector('[data-action="delete-yes"]').click();
        expect(calls.remove).toEqual([7]);
        expect(document.querySelector('.goal-card-overlay')).toBeNull();
        expect(calls.after).toBe(1);
    });

    test('Retire (recurring) asks first, then retires and closes', () => {
        current = makeView({ goal: { kind: 'recurring', period: 'week' } });
        open();
        document.querySelector('[data-action="retire"]').click();
        expect(calls.retire).toEqual([]);
        document.querySelector('[data-action="retire-yes"]').click();
        expect(calls.retire).toEqual([7]);
        expect(document.querySelector('.goal-card-overlay')).toBeNull();
    });

    test('Close closes without touching the goal', () => {
        open();
        document.querySelector('[data-action="close"]').click();
        expect(document.querySelector('.goal-card-overlay')).toBeNull();
        expect(calls.update).toEqual([]);
        expect(calls.after).toBe(0);
    });

    test('the card closes itself if its goal disappears while open', () => {
        open();
        deps.updateTarget = () => { current = null; return { changed: true, completed: [] }; };
        document.querySelector('[data-action="num-step"][data-dir="1"]').click();
        // getView is null at the next render: the card removes itself rather than throwing
        expect(document.querySelector('.goal-card-overlay')).toBeNull();
    });
});

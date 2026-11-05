/**
 * @jest-environment jsdom
 */
/**
 * Goal form (Build B2, 2026-11-05; docs/GOALS_PLAN.md "Screens" + "Build B2 as built"): the pure draft / validate / submit rules and the
 * DOM form (Add and Edit; inline errors; no native dialogs).
 */
global.CONFIG = require('../js/config.js');
global.Goals = require('../js/goals.js');
global.Theme = require('../js/theme.js');
global.Modal = require('../js/ui/modal.js');
const GoalForm = require('../js/ui/goalForm.js');

const METRICS = global.CONFIG.GOAL_METRICS;
const ctx = (over) => Object.assign({
    metrics: METRICS,
    todayKey: '2026-11-05',
    options: {
        tasks: [{ id: 11, name: 'Write chapter', goalId: null }, { id: 12, name: 'Send draft', goalId: 99 }],
        habits: [{ id: 'h1', name: 'Walk' }],
        routines: [{ id: 'r1', name: 'Morning' }],
    },
}, over || {});

describe('drafts', () => {
    test('a blank draft is a weekly recurring goal with one number target and no name', () => {
        const d = GoalForm.blankDraft(ctx());
        expect(d.mode).toBe('add');
        expect(d.name).toBe('');
        expect(d.kind).toBe('recurring');
        expect(d.period).toBe('week');
        expect(d.noDeadline).toBe(true);
        expect(d.targets).toHaveLength(1);
        expect(d.targets[0].type).toBe('number');
    });

    test('newTargetDraft gives each type its own fields', () => {
        const c = ctx();
        expect(GoalForm.newTargetDraft('number', c)).toMatchObject({ type: 'number', start: '0', end: '10' });
        expect(GoalForm.newTargetDraft('bool', c).type).toBe('bool');
        expect(GoalForm.newTargetDraft('linked', c)).toMatchObject({ type: 'linked', count: '1', habitDefIds: [], routineIds: [], itemIds: [] });
        expect(GoalForm.newTargetDraft('aggregate', c)).toMatchObject({ type: 'aggregate', metric: METRICS[0].id, op: 'sum', compare: 'gte' });
    });

    test('draftFromGoal carries the goal, its target ids and the linked open tasks', () => {
        const goal = Goals.newGoal({
            name: 'Ship', kind: 'milestone', deadline: '2026-12-31',
            targets: [{ type: 'linked', label: 'Tasks', count: 2, habitDefIds: ['h1'], routineIds: [] }, { type: 'number', label: 'Pages', start: 0, end: 50, current: 20, unit: 'pages' }],
        }, 0, 1, 4);
        const d = GoalForm.draftFromGoal(goal, { [goal.targets[0].id]: [11] });
        expect(d).toMatchObject({ mode: 'edit', goalId: 4, name: 'Ship', kind: 'milestone', noDeadline: false, deadline: '2026-12-31' });
        expect(d.targets[0]).toMatchObject({ id: goal.targets[0].id, type: 'linked', count: '2', habitDefIds: ['h1'], itemIds: [11] });
        expect(d.targets[1]).toMatchObject({ id: goal.targets[1].id, type: 'number', start: '0', end: '50', unit: 'pages' });
    });
});

describe('validate', () => {
    function draft(over) {
        return Object.assign(GoalForm.blankDraft(ctx()), { name: 'Run' }, over || {});
    }
    test('a good draft passes', () => {
        expect(GoalForm.validate(draft(), ctx())).toBeNull();
    });
    test('a name is required', () => {
        expect(GoalForm.validate(draft({ name: '   ' }), ctx())).toMatchObject({ field: 'gfName' });
    });
    test('at least one target', () => {
        expect(GoalForm.validate(draft({ targets: [] }), ctx()).message).toMatch(/at least one target/i);
    });
    test('a number target needs two different numbers', () => {
        const t = (s, e) => draft({ targets: [Object.assign(GoalForm.newTargetDraft('number', ctx()), { start: s, end: e })] });
        expect(GoalForm.validate(t('', '5'), ctx()).field).toBe('gfT0Start');
        expect(GoalForm.validate(t('3', 'x'), ctx()).field).toBe('gfT0End');
        expect(GoalForm.validate(t('4', '4'), ctx()).message).toMatch(/same/i);
        expect(GoalForm.validate(t('10', '0'), ctx())).toBeNull(); // counting down is fine
    });
    test('a one-time goal with a deadline needs a valid date that is not past (a kept past date passes on Edit)', () => {
        const base = { kind: 'milestone', period: null, noDeadline: false };
        expect(GoalForm.validate(draft(Object.assign({ deadline: '' }, base)), ctx()).field).toBe('gfDeadline');
        expect(GoalForm.validate(draft(Object.assign({ deadline: '2026-11-01' }, base)), ctx()).message).toMatch(/past/i);
        expect(GoalForm.validate(draft(Object.assign({ deadline: '2026-12-31' }, base)), ctx())).toBeNull();
        expect(GoalForm.validate(draft(Object.assign({ deadline: '2026-11-01', mode: 'edit', originalDeadline: '2026-11-01' }, base)), ctx())).toBeNull();
        expect(GoalForm.validate(draft(Object.assign({ noDeadline: true, deadline: '' }, { kind: 'milestone' })), ctx())).toBeNull();
    });
    test('a repeating goal cannot link one-off tasks, so it needs a Build Habit or a routine', () => {
        const linked = Object.assign(GoalForm.newTargetDraft('linked', ctx()), { itemIds: [11] });
        const r = GoalForm.validate(draft({ targets: [linked] }), ctx());
        expect(r.message).toMatch(/Build Habit or routine/);
        const ok = Object.assign({}, linked, { habitDefIds: ['h1'] });
        expect(GoalForm.validate(draft({ targets: [ok] }), ctx())).toBeNull();
    });
    test('a one-time goal may link tasks alone; a count below 1 is refused', () => {
        const linked = Object.assign(GoalForm.newTargetDraft('linked', ctx()), { itemIds: [11] });
        expect(GoalForm.validate(draft({ kind: 'milestone', period: null, targets: [linked] }), ctx())).toBeNull();
        const none = GoalForm.newTargetDraft('linked', ctx());
        expect(GoalForm.validate(draft({ kind: 'milestone', period: null, targets: [none] }), ctx()).message).toMatch(/task, Build Habit or routine/);
        const bad = Object.assign({}, linked, { habitDefIds: ['h1'], count: '0' });
        expect(GoalForm.validate(draft({ kind: 'milestone', period: null, targets: [bad] }), ctx()).field).toBe('gfT0Count');
    });
    test('an aggregate target needs a known metric, a non-negative amount, and a whole day count for "days"', () => {
        const agg = (over) => draft({ targets: [Object.assign(GoalForm.newTargetDraft('aggregate', ctx()), over)] });
        expect(GoalForm.validate(agg({}), ctx())).toBeNull();
        expect(GoalForm.validate(agg({ metric: 'nope' }), ctx()).field).toBe('gfT0Metric');
        expect(GoalForm.validate(agg({ threshold: '-1' }), ctx()).field).toBe('gfT0Threshold');
        expect(GoalForm.validate(agg({ threshold: 'x' }), ctx()).field).toBe('gfT0Threshold');
        expect(GoalForm.validate(agg({ op: 'days', count: '2.5' }), ctx()).field).toBe('gfT0Count');
        expect(GoalForm.validate(agg({ op: 'days', count: '3' }), ctx())).toBeNull();
    });
});

describe('toSubmission', () => {
    test('builds the fields the State call takes, keeps target ids on Edit, and auto-labels blank labels', () => {
        const c = ctx();
        const d = GoalForm.blankDraft(c);
        d.name = '  Read more ';
        d.targets = [
            Object.assign(GoalForm.newTargetDraft('number', c), { id: 3, start: '0', end: '12', unit: 'books', label: '' }),
            Object.assign(GoalForm.newTargetDraft('aggregate', c), { metric: 'tasksDone', op: 'days', threshold: '3', count: '5', compare: 'gte' }),
        ];
        const s = GoalForm.toSubmission(d, c);
        expect(s.fields.name).toBe('Read more');
        expect(s.fields).toMatchObject({ kind: 'recurring', period: 'week', deadline: null });
        expect(s.fields.targets[0]).toMatchObject({ id: 3, type: 'number', start: 0, end: 12, unit: 'books' });
        expect(s.fields.targets[0].label).toBe('Books: 0 to 12');
        expect(s.fields.targets[1]).toMatchObject({ type: 'aggregate', metric: 'tasksDone', op: 'days', threshold: 3, count: 5, compare: 'gte' });
        expect(s.fields.targets[1].label).toMatch(/Tasks done/);
        expect(s.links).toEqual([]);
    });
    test('a one-time goal sends its deadline (or null) and the picked tasks as links by target index', () => {
        const c = ctx();
        const d = GoalForm.blankDraft(c);
        d.name = 'Ship';
        d.kind = 'milestone';
        d.period = null;
        d.noDeadline = false;
        d.deadline = '2026-12-31';
        d.targets = [Object.assign(GoalForm.newTargetDraft('bool', c), { label: 'Signed' }), Object.assign(GoalForm.newTargetDraft('linked', c), { itemIds: [11, 12], habitDefIds: ['h1'], count: '3' })];
        const s = GoalForm.toSubmission(d, c);
        expect(s.fields.deadline).toBe('2026-12-31');
        expect(s.fields.targets[1]).toMatchObject({ type: 'linked', count: 3, habitDefIds: ['h1'], routineIds: [] });
        expect(s.links).toEqual([{ targetIndex: 1, itemIds: [11, 12] }]);
        d.noDeadline = true;
        expect(GoalForm.toSubmission(d, c).fields.deadline).toBeNull();
    });
    test('a repeating goal never sends task links', () => {
        const c = ctx();
        const d = GoalForm.blankDraft(c);
        d.name = 'Walk';
        d.targets = [Object.assign(GoalForm.newTargetDraft('linked', c), { itemIds: [11], habitDefIds: ['h1'] })];
        expect(GoalForm.toSubmission(d, c).links).toEqual([]);
    });
});

describe('html', () => {
    test('Add shows the kind picker; Edit shows the fixed kind line instead', () => {
        const c = ctx();
        const add = GoalForm.html(GoalForm.blankDraft(c), c);
        expect(add).toContain('id="gfName"');
        expect(add).toContain('id="gfKind"');
        expect(add).toContain('New goal');
        const goal = Goals.newGoal({ name: 'Ship', kind: 'milestone', targets: [{ type: 'bool', label: 'x' }] }, 0, 1, 2);
        const edit = GoalForm.html(GoalForm.draftFromGoal(goal, {}), c);
        expect(edit).not.toContain('id="gfKind"');
        expect(edit).toContain('Edit goal');
        expect(edit).toMatch(/can't be changed|cannot be changed/);
    });
    test('the task picker appears only for a one-time goal, and flags a task that is in another goal', () => {
        const c = ctx();
        const d = GoalForm.blankDraft(c);
        d.targets = [GoalForm.newTargetDraft('linked', c)];
        expect(GoalForm.html(d, c)).not.toContain('Write chapter');
        d.kind = 'milestone';
        d.period = null;
        const html = GoalForm.html(d, c);
        expect(html).toContain('Write chapter');
        expect(html).toMatch(/Send draft[\s\S]*in another goal/);
        expect(html).toContain('Walk');
        expect(html).toContain('Morning');
    });
    test('escapes the goal name', () => {
        const c = ctx();
        const d = GoalForm.blankDraft(c);
        d.name = '"><img src=x onerror=alert(1)>';
        const html = GoalForm.html(d, c);
        expect(html).not.toContain('<img src=x');
    });
});

describe('DOM form', () => {
    beforeEach(() => { document.body.innerHTML = ''; });
    afterEach(() => { document.querySelectorAll('.modal-overlay').forEach(el => el.remove()); });

    function deps(over) {
        return Object.assign({
            getContext: () => ctx(),
            save: jest.fn(() => ({ ok: true, goal: { id: 5 } })),
            onDone: jest.fn(),
            onCancel: jest.fn(),
        }, over || {});
    }
    const $ = (sel) => document.querySelector(sel);
    function type(id, value) {
        const el = document.getElementById(id);
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    test('opens once; a second open does not stack', () => {
        expect(GoalForm.open(deps())).not.toBeNull();
        expect(GoalForm.open(deps())).toBeNull();
        expect(document.querySelectorAll('.goal-form-overlay')).toHaveLength(1);
    });

    test('Save with an empty name shows an inline error, saves nothing, keeps the form open', () => {
        const d = deps();
        GoalForm.open(d);
        $('[data-action="save"]').click();
        expect(d.save).not.toHaveBeenCalled();
        expect($('.form-error')).not.toBeNull();
        expect($('.goal-form-overlay')).not.toBeNull();
    });

    test('a valid Add saves the typed goal, closes, and tells the owner', () => {
        const d = deps();
        GoalForm.open(d);
        type('gfName', 'Walk more');
        type('gfT0Start', '0');
        type('gfT0End', '5');
        $('[data-action="save"]').click();
        expect(d.save).toHaveBeenCalledTimes(1);
        const [fields, links] = d.save.mock.calls[0];
        expect(fields).toMatchObject({ name: 'Walk more', kind: 'recurring', period: 'week' });
        expect(fields.targets[0]).toMatchObject({ type: 'number', start: 0, end: 5 });
        expect(links).toEqual([]);
        expect($('.goal-form-overlay')).toBeNull();
        expect(d.onDone).toHaveBeenCalledWith({ id: 5 });
    });

    test('a refused save (slots full) shows a line and keeps the form', () => {
        const d = deps({ save: jest.fn(() => ({ ok: false, reason: 'full' })) });
        GoalForm.open(d);
        type('gfName', 'Walk more');
        $('[data-action="save"]').click();
        expect($('.form-error').textContent).toMatch(/slot/i);
        expect($('.goal-form-overlay')).not.toBeNull();
        expect(d.onDone).not.toHaveBeenCalled();
    });

    test('Cancel closes only the form and tells the owner', () => {
        const d = deps();
        GoalForm.open(d);
        $('[data-action="cancel"]').click();
        expect($('.goal-form-overlay')).toBeNull();
        expect(d.onCancel).toHaveBeenCalled();
        expect(d.save).not.toHaveBeenCalled();
    });

    test('switching to One-time shows "No deadline" (ticked); unticking it reveals the date; typing survives the redraws', () => {
        GoalForm.open(deps());
        type('gfName', 'Keep me');
        type('gfKind', 'milestone');
        expect(document.getElementById('gfName').value).toBe('Keep me');
        expect(document.getElementById('gfPeriod')).toBeNull();
        expect(document.getElementById('gfNoDeadline').checked).toBe(true);
        expect(document.getElementById('gfDeadline')).toBeNull();
        const box = document.getElementById('gfNoDeadline');
        box.checked = false;
        box.dispatchEvent(new Event('change', { bubbles: true }));
        expect(document.getElementById('gfDeadline')).not.toBeNull();
        expect(document.getElementById('gfName').value).toBe('Keep me');
    });

    test('a one-time goal with a typed deadline saves it', () => {
        const d = deps();
        GoalForm.open(d);
        type('gfName', 'Launch');
        type('gfKind', 'milestone');
        const box = document.getElementById('gfNoDeadline');
        box.checked = false;
        box.dispatchEvent(new Event('change', { bubbles: true }));
        type('gfDeadline', '2026-12-31');
        $('[data-action="save"]').click();
        expect(d.save.mock.calls[0][0]).toMatchObject({ kind: 'milestone', period: null, deadline: '2026-12-31' });
    });

    test('add and remove targets; the last target cannot be removed; the cap holds', () => {
        GoalForm.open(deps());
        expect(document.querySelectorAll('.goal-form-target')).toHaveLength(1);
        expect($('[data-action="remove-target"]')).toBeNull();
        $('[data-action="add-target"][data-type="bool"]').click();
        $('[data-action="add-target"][data-type="aggregate"]').click();
        $('[data-action="add-target"][data-type="linked"]').click();
        expect(document.querySelectorAll('.goal-form-target')).toHaveLength(4);
        expect($('[data-action="add-target"]')).toBeNull();
        $('[data-action="remove-target"][data-index="3"]').click();
        expect(document.querySelectorAll('.goal-form-target')).toHaveLength(3);
    });

    test('Edit opens filled in, keeps the target id, and saves through the same call', () => {
        const goal = Goals.newGoal({ name: 'Ship', kind: 'milestone', deadline: null, targets: [{ type: 'number', label: 'Pages', start: 0, end: 50, current: 20, unit: 'pages' }] }, 0, 1, 4);
        const d = deps({ goal, linkedIds: {} });
        GoalForm.open(d);
        expect(document.getElementById('gfName').value).toBe('Ship');
        type('gfName', 'Ship it');
        $('[data-action="save"]').click();
        const [fields] = d.save.mock.calls[0];
        expect(fields.name).toBe('Ship it');
        expect(fields.targets[0].id).toBe(goal.targets[0].id);
    });

    test('ticking a task in a one-time goal sends it as a link', () => {
        const d = deps();
        GoalForm.open(d);
        type('gfName', 'Ship');
        type('gfKind', 'milestone');
        $('[data-action="remove-target"]');
        $('[data-action="add-target"][data-type="linked"]').click();
        $('[data-action="remove-target"][data-index="0"]').click();
        const box = document.querySelector('input[data-pick="task"][value="11"]');
        box.checked = true;
        box.dispatchEvent(new Event('change', { bubbles: true }));
        $('[data-action="save"]').click();
        expect(d.save).toHaveBeenCalled();
        expect(d.save.mock.calls[0][1]).toEqual([{ targetIndex: 0, itemIds: [11] }]);
    });
});

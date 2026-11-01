/**
 * @jest-environment jsdom
 *
 * Habit Goals Build 1 (2026-11-01, Jeremy; plan docs/HABIT_GOALS_PLAN.md): None / Time / Amount / Custom note replace the
 * habit "Timer (minutes)" box. Data helpers, the form section, the card line, and the task timer-target field removal.
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
global.Schedule = require('../js/schedule.js');
global.FrozenSlots = require('../js/frozenSlots.js');
const Habits = global.Habits = require('../js/habits.js');
const Routines = require('../js/routines.js');
const Modal = require('../js/ui/modal.js');
const Forms = require('../js/ui/forms.js');

describe('Habits goal helpers (pure)', () => {
    test('normalizeGoal: valid goals pass, junk becomes none', () => {
        expect(Habits.normalizeGoal({ type: 'time', amount: 30 })).toEqual({ type: 'time', amount: 30, unit: 'min', note: null });
        expect(Habits.normalizeGoal({ type: 'time', amount: 0 }).type).toBe('none');
        expect(Habits.normalizeGoal({ type: 'time', amount: 5000 }).type).toBe('none');
        expect(Habits.normalizeGoal({ type: 'amount', amount: 8, unit: ' glasses ' })).toEqual({ type: 'amount', amount: 8, unit: 'glasses', note: null });
        expect(Habits.normalizeGoal({ type: 'amount', amount: -1, unit: 'x' }).type).toBe('none');
        expect(Habits.normalizeGoal({ type: 'amount', amount: 2 }).unit).toBeNull();
        expect(Habits.normalizeGoal({ type: 'note', note: '  Call Mom ' }).note).toBe('Call Mom');
        expect(Habits.normalizeGoal({ type: 'note', note: '  ' }).type).toBe('none');
        expect(Habits.normalizeGoal(null).type).toBe('none');
    });

    test('goalOf: own goal, else derived from an old timerMinutes, else none', () => {
        expect(Habits.goalOf({ goal: { type: 'amount', amount: 8, unit: 'glasses' } }).type).toBe('amount');
        expect(Habits.goalOf({ timerMinutes: 25 })).toEqual({ type: 'time', amount: 25, unit: 'min', note: null });
        expect(Habits.goalOf({ timerMinutes: null }).type).toBe('none');
        expect(Habits.goalOf({}).type).toBe('none');
    });

    test('formatGoal: Goal for Build, Limit for Break', () => {
        expect(Habits.formatGoal({ type: 'time', amount: 30 }, false)).toBe('Goal: 30 min');
        expect(Habits.formatGoal({ type: 'time', amount: 60 }, true)).toBe('Limit: 1 hr');
        expect(Habits.formatGoal({ type: 'time', amount: 90 }, true)).toBe('Limit: 1 hr 30 min');
        expect(Habits.formatGoal({ type: 'amount', amount: 8, unit: 'glasses' }, false)).toBe('Goal: 8 glasses');
        expect(Habits.formatGoal({ type: 'amount', amount: 2, unit: 'drinks' }, true)).toBe('Limit: 2 drinks');
        expect(Habits.formatGoal({ type: 'amount', amount: 10, unit: '$' }, false)).toBe('Goal: $10');
        expect(Habits.formatGoal({ type: 'note', note: 'No screens after 10 PM' }, true)).toBe('No screens after 10 PM');
        expect(Habits.formatGoal({ type: 'none' }, false)).toBe('');
    });

    test('applyGoalToDef keeps timerMinutes/timerMode in step: only a Time goal is a timer budget', () => {
        const build = { isNegative: false };
        Habits.applyGoalToDef(build, { type: 'time', amount: 30 });
        expect(build.timerMinutes).toBe(30); expect(build.timerMode).toBe('work');
        const brk = { isNegative: true };
        Habits.applyGoalToDef(brk, { type: 'time', amount: 60 });
        expect(brk.timerMode).toBe('limit');
        const amt = { isNegative: false };
        Habits.applyGoalToDef(amt, { type: 'amount', amount: 8, unit: 'glasses' });
        expect(amt.timerMinutes).toBeNull(); expect(amt.timerMode).toBeNull();
        const legacy = { isNegative: false };
        Habits.applyGoalToDef(legacy, null, 20); // old callers pass bare minutes
        expect(legacy.goal.type).toBe('time'); expect(legacy.timerMinutes).toBe(20);
    });

    test('instances carry the goal and a Time goal sets the timer budget', () => {
        const day = new Date(2026, 5, 15);
        const deps = { getNextId: () => 1, gameScreenWidth: 800, habitEnemyWidth: 60, negativeLurkRightMarginPx: 20, calculateTimelinePosition: () => 42 };
        const def = { id: 'h', name: 'Meditate', category: 'health', timeOfDay: 'anytime', streak: 0, isNegative: false, goal: { type: 'time', amount: 30 } };
        const inst = Habits.createHabitInstanceData(def, day, deps);
        expect(inst.goal.type).toBe('time');
        expect(inst.timerMinutes).toBe(30);
        const amt = Habits.createHabitInstanceData({ ...def, goal: { type: 'amount', amount: 8, unit: 'glasses' } }, day, deps);
        expect(amt.timerMinutes).toBeNull();
        expect(amt.goal.unit).toBe('glasses');
    });
});

describe('Routine habit definitions store the goal', () => {
    const routine = () => ({ id: 'r1', habitDefinitionIds: [] });
    test('create with a goal; edit changes it and a Time goal drives timerMode', () => {
        const defs = [];
        const h = Routines.createNewHabitInRoutine('r1', { name: 'H', category: 'health', timeOfDay: 'anytime', isNegative: false, goal: { type: 'amount', amount: 20, unit: 'pages' } }, [routine()], defs);
        expect(h.goal.unit).toBe('pages');
        expect(h.timerMinutes).toBeNull();
        Routines.editHabitInRoutine(h.id, { name: 'H', category: 'health', schedule: h.schedule, timeOfDay: 'anytime', isNegative: false, goal: { type: 'time', amount: 45 } }, defs, null);
        expect(h.timerMinutes).toBe(45); expect(h.timerMode).toBe('work');
        Routines.editHabitInRoutine(h.id, { name: 'H', category: 'health', schedule: h.schedule, timeOfDay: 'anytime', isNegative: false }, defs, null);
        expect(h.goal.type).toBe('none'); expect(h.timerMinutes).toBeNull();
    });
});

describe('Forms: Habit Goal section', () => {
    test('goalFromFields converts hours to minutes', () => {
        expect(Forms.goalFromFields({ type: 'time', timeValue: '2', timeUnit: 'hr' })).toEqual({ type: 'time', amount: 120 });
        expect(Forms.goalFromFields({ type: 'time', timeValue: '45', timeUnit: 'min' })).toEqual({ type: 'time', amount: 45 });
        expect(Forms.goalFromFields({ type: 'amount', amountValue: '8', amountUnit: 'glasses' })).toEqual({ type: 'amount', amount: 8, unit: 'glasses' });
        expect(Forms.goalFromFields({ type: 'none' })).toEqual({ type: 'none' });
    });
    test('habitGoalError: a chosen type needs a usable value', () => {
        expect(Forms.habitGoalError({ type: 'none' })).toBeNull();
        expect(Forms.habitGoalError({ type: 'time', timeValue: '', timeUnit: 'min' })).toMatch(/time goal/);
        expect(Forms.habitGoalError({ type: 'time', timeValue: '30', timeUnit: 'min' })).toBeNull();
        expect(Forms.habitGoalError({ type: 'amount', amountValue: '0', amountUnit: 'x' })).toMatch(/amount/);
        expect(Forms.habitGoalError({ type: 'note', note: ' ' })).toMatch(/note/);
    });
    test('habitGoalHtml prefills from a goal (hours when it divides evenly) and hides unused fields', () => {
        const html = Forms.habitGoalHtml('x', { type: 'time', amount: 120, unit: 'min' }, false);
        expect(html).toMatch(/id="xGoalTimeValue"[^>]*value="2"/);
        expect(html).toContain('<option value="hr" selected>');
        expect(html).toMatch(/id="xGoalAmountFields" hidden/);
        expect(html).toMatch(/id="xGoalNoteFields" hidden/);
        expect(html).not.toMatch(/id="xGoalTimeFields" hidden/);
        expect(Forms.habitGoalHtml('x', null, true)).toContain('Daily limit');
    });
    test('the old timer box is gone from the habit forms and the task forms', () => {
        expect(Forms.createHabitFormHtml(new Date(2026, 6, 20, 9, 0))).not.toContain('TimerMinutes');
        expect(Forms.createHabitFormHtml(new Date(2026, 6, 20, 9, 0))).toContain('id="modalHabitGoalType"');
        expect(Forms.createTaskFormHtml()).not.toContain('modalTimerMinutes');
    });

    function mount(negative) {
        document.body.innerHTML = `
            <input type="radio" name="gt" id="gp" value="positive" ${negative ? '' : 'checked'}>
            <input type="radio" name="gt" id="gn" value="negative" ${negative ? 'checked' : ''}>
            ${Forms.habitGoalHtml('g', null, negative)}`;
        Modal.wireHabitGoal('gt', 'g');
    }
    const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
    test('choosing a type shows only its fields; the wording flips with Build / Break', () => {
        mount(false);
        const sel = document.getElementById('gGoalType');
        expect(document.getElementById('gGoalTimeFields').hidden).toBe(true);
        sel.value = 'time'; fire(sel, 'change');
        expect(document.getElementById('gGoalTimeFields').hidden).toBe(false);
        expect(document.getElementById('gGoalAmountFields').hidden).toBe(true);
        expect(document.querySelector('label[for="gGoalTimeValue"]').textContent).toBe('At least:');
        sel.value = 'amount'; fire(sel, 'change');
        expect(document.getElementById('gGoalTimeFields').hidden).toBe(true);
        expect(document.getElementById('gGoalAmountFields').hidden).toBe(false);
        sel.value = 'note'; fire(sel, 'change');
        expect(document.getElementById('gGoalNoteFields').hidden).toBe(false);
        const neg = document.getElementById('gn'); neg.checked = true; fire(neg, 'change');
        expect(document.querySelector('[data-goal-label]').textContent).toBe('Daily limit (optional):');
    });
    test('the (i) button toggles the examples popover (Build vs Break lists)', () => {
        mount(false);
        const btn = document.querySelector('.form-hint-btn');
        const pop = document.getElementById('gGoalHint');
        expect(pop.hidden).toBe(true);
        btn.click();
        expect(pop.hidden).toBe(false);
        expect(btn.getAttribute('aria-expanded')).toBe('true');
        expect(pop.textContent).toContain('Meditate 10 min');
        const neg = document.getElementById('gn'); neg.checked = true; fire(neg, 'change');
        expect(pop.textContent).toContain('Social media 1 hr or less');
        btn.click();
        expect(pop.hidden).toBe(true);
    });
});

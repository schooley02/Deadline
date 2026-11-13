/**
 * @jest-environment jsdom
 */
/**
 * Priority slots Build B (2026-11-04; docs/PRIORITY_SLOTS_PLAN.md): the words, the pips and the form row.
 * The slot RULES are pinned in prioritySlots.test.js; this file pins what the player sees and the form wiring.
 */
global.Modal = { closeModal: jest.fn() };
const PrioritySlotsView = require('../js/ui/prioritySlotsView.js');
global.PrioritySlotsView = PrioritySlotsView;
const Forms = require('../js/ui/forms.js');
const CONFIG = require('../js/config.js');

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('words', () => {
    test('dayWord: today / tomorrow / yesterday / a dated day', () => {
        expect(PrioritySlotsView.dayWord('2026-11-04', '2026-11-04')).toBe('today');
        expect(PrioritySlotsView.dayWord('2026-11-05', '2026-11-04')).toBe('tomorrow');
        expect(PrioritySlotsView.dayWord('2026-11-03', '2026-11-04')).toBe('yesterday');
        expect(PrioritySlotsView.dayWord('2026-11-09', '2026-11-04')).toMatch(/^on \w{3}, Nov 9$/);
        expect(PrioritySlotsView.dayWord(null, '2026-11-04')).toBe('that day');
    });

    test('label and full text follow perDay; the full text no longer promises a refill', () => {
        expect(PrioritySlotsView.labelText(2, 3, 'today')).toBe('Priority: 2 of 3 left today');
        expect(PrioritySlotsView.fullText(3, 'tomorrow')).toBe('No priority slots left tomorrow.');
        expect(PrioritySlotsView.setCompleteText).toBeUndefined(); // no set-complete notice any more (2026-11-12)
        expect(PrioritySlotsView.labelText(1, 5, 'today')).toBe('Priority: 1 of 5 left today');
    });

    test('player text never says "High Priority"', () => {
        const all = [
            PrioritySlotsView.labelText(0, 3, 'today'), PrioritySlotsView.fullText(3, 'today'),
            PrioritySlotsView.explainerText({ left: 1 }, 3, 'today'),
            PrioritySlotsView.CARRY_TEXT, PrioritySlotsView.COVERED_TEXT, PrioritySlotsView.KEEP_TEXT,
        ].join(' ');
        expect(all).not.toMatch(/high.priority/i);
    });
});

describe('pips', () => {
    test('done first, then used, then free; always perDay of them', () => {
        expect(PrioritySlotsView.pipStates({ marks: 0, done: 0, left: 3 }, 3)).toEqual(['free', 'free', 'free']);
        expect(PrioritySlotsView.pipStates({ marks: 1, done: 0, left: 2 }, 3)).toEqual(['used', 'free', 'free']);
        expect(PrioritySlotsView.pipStates({ marks: 3, done: 1, left: 0 }, 3)).toEqual(['done', 'used', 'used']);
        expect(PrioritySlotsView.pipStates({ marks: 3, done: 2, left: 0 }, 3)).toEqual(['done', 'done', 'used']);
    });

    test('a finished day stays full: 3 done shows three check pips, never a refill', () => {
        expect(PrioritySlotsView.pipStates({ marks: 3, done: 3, left: 0 }, 3)).toEqual(['done', 'done', 'done']);
        expect(PrioritySlotsView.pipStates({ marks: 4, done: 4, left: 0 }, 3)).toEqual(['done', 'done', 'done']); // saved before the cap
    });

    test('free pips never exceed the room left in the day (done priorities that were never marked here)', () => {
        expect(PrioritySlotsView.pipStates({ marks: 0, done: 3, left: 3 }, 3)).toEqual(['done', 'done', 'done']);
        expect(PrioritySlotsView.pipStates({ marks: 0, done: 1, left: 3 }, 3)).toEqual(['done', 'free', 'free']);
    });

    test('an unmarked, thrown-away slot still shows as used; a negative left (undo after reset) shows no free pip', () => {
        expect(PrioritySlotsView.pipStates({ marks: 3, done: 2, left: 0 }, 3).filter((s) => s === 'free')).toHaveLength(0);
        expect(PrioritySlotsView.pipStates({ marks: 6, done: 2, left: 0 }, 3)).toHaveLength(3);
    });

    test('render fills the element, hides it with no slots, and a tap calls onTap', () => {
        document.body.innerHTML = '<div id="prioritySlots" class="hidden"></div>';
        const el = document.getElementById('prioritySlots');
        const onTap = jest.fn();
        const slots = { key: '2026-11-04', marks: 1, done: 0, left: 2 };
        PrioritySlotsView.render(el, slots, { perDay: 3, word: 'today', onTap });
        expect(el.classList.contains('hidden')).toBe(false);
        expect(el.querySelectorAll('.priority-pip')).toHaveLength(3);
        expect(el.querySelectorAll('.priority-pip-used')).toHaveLength(1);
        expect(el.querySelector('.priority-slots-text').textContent).toBe('2 of 3 left');
        expect(el.querySelector('.priority-slots-btn').getAttribute('aria-label')).toBe('Priorities today: 2 of 3 left.');
        el.querySelector('.priority-slots-btn').click();
        expect(onTap).toHaveBeenCalledWith(slots);
        PrioritySlotsView.render(el, null, {});
        expect(el.classList.contains('hidden')).toBe(true);
        expect(el.innerHTML).toBe('');
    });

    describe('the momentum mark (beside the pips, Today only)', () => {
        const slots = { key: '2026-11-13', marks: 1, done: 0, left: 2 };
        const mount = () => {
            document.body.innerHTML = '<div id="prioritySlots"></div>';
            return document.getElementById('prioritySlots');
        };

        test('markup: hollow ring when not secured, check when secured, dash on a Sick Day, nothing without info', () => {
            expect(PrioritySlotsView.momentumMarkHtml(null)).toBe('');
            expect(PrioritySlotsView.momentumMarkHtml({ today: 'open' })).toContain('priority-momentum--open');
            expect(PrioritySlotsView.momentumMarkHtml({ today: 'secured' })).toContain('&#10003;');
            expect(PrioritySlotsView.momentumMarkHtml({ today: 'secured' })).toContain('priority-momentum--secured');
            expect(PrioritySlotsView.momentumMarkHtml({ today: 'excused' })).toContain('priority-momentum--excused');
            expect(PrioritySlotsView.momentumMarkHtml({ today: 'secured' })).toContain('Today&#39;s momentum is secured.');
            expect(PrioritySlotsView.momentumMarkHtml({ today: 'open' })).toContain('Today&#39;s momentum is not secured yet.');
        });

        test('render puts the mark after the pips; it is not inside the pips button', () => {
            const el = mount();
            PrioritySlotsView.render(el, slots, { perDay: 3, word: 'today', momentum: { today: 'open' } });
            const mark = el.querySelector('.priority-momentum');
            expect(mark).not.toBeNull();
            expect(mark.closest('.priority-slots-btn')).toBeNull();
            expect(el.querySelector('.priority-slots-btn').nextElementSibling).toBe(mark);
        });

        test('no momentum passed (any day but Today) -> no mark, pips unchanged', () => {
            const el = mount();
            PrioritySlotsView.render(el, slots, { perDay: 3, word: 'tomorrow', momentum: null });
            expect(el.querySelector('.priority-momentum')).toBeNull();
            expect(el.querySelectorAll('.priority-pip')).toHaveLength(3);
        });

        test('a tap on the mark opens the Barricade and does NOT open the priority explainer; a tap on the pips does the reverse', () => {
            const el = mount();
            const onTap = jest.fn();
            const onMomentumTap = jest.fn();
            PrioritySlotsView.render(el, slots, { perDay: 3, word: 'today', momentum: { today: 'secured' }, onTap, onMomentumTap });
            el.querySelector('.priority-momentum').click();
            expect(onMomentumTap).toHaveBeenCalledTimes(1);
            expect(onTap).not.toHaveBeenCalled();
            el.querySelector('.priority-slots-btn').click();
            expect(onTap).toHaveBeenCalledTimes(1);
            expect(onMomentumTap).toHaveBeenCalledTimes(1);
        });

        test('Enter and Space on the mark open the Barricade too', () => {
            const el = mount();
            const onMomentumTap = jest.fn();
            PrioritySlotsView.render(el, slots, { perDay: 3, word: 'today', momentum: { today: 'open' }, onMomentumTap });
            const mark = el.querySelector('.priority-momentum');
            mark.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            mark.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
            mark.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
            expect(onMomentumTap).toHaveBeenCalledTimes(2);
        });
    });

    test('Yesterday is read-only: no text, no left count in the label', () => {
        document.body.innerHTML = '<div id="prioritySlots"></div>';
        const el = document.getElementById('prioritySlots');
        PrioritySlotsView.render(el, { key: '2026-11-03', marks: 3, done: 2, left: 0 }, { perDay: 3, word: 'yesterday', readOnly: true });
        expect(el.querySelector('.priority-slots-text')).toBeNull();
        expect(el.querySelector('.priority-slots-btn').getAttribute('aria-label')).toBe('Priorities yesterday: 3 of 3 used.');
        expect(el.querySelector('.priority-slots-readonly')).not.toBeNull();
    });
});

describe('bindRow', () => {
    // Slots by due day, like Items.prioritySlotsFor: { key, left }.
    let slotsByKey, confirm;
    const deps = () => ({
        perDay: 3,
        todayKey: '2026-11-04',
        prioritySlotsFor: (due) => {
            const key = String(due).slice(0, 10);
            return Object.assign({ key, marks: 0, done: 0, left: 3 }, slotsByKey[key] || {});
        },
    });
    function mount(checked) {
        document.body.innerHTML = PrioritySlotsView.rowHtml('pri', { checked }) +
            '<input type="date" id="due" value="2026-11-04">';
        return {
            cb: document.getElementById('pri'), label: document.getElementById('priLabel'),
            hint: document.getElementById('priHint'), dateInput: document.getElementById('due'),
        };
    }
    const setDate = (el, v) => { el.dateInput.value = v; el.dateInput.dispatchEvent(new Event('change')); };

    beforeEach(() => { slotsByKey = {}; confirm = jest.fn(() => Promise.resolve(true)); });

    test('Add Task: label shows the left count for the due day and re-reads when the date changes', () => {
        const el = mount(false);
        PrioritySlotsView.bindRow(Object.assign({ checkbox: el.cb, deps: deps(), confirm }, el));
        expect(el.label.textContent).toBe('Priority: 3 of 3 left today');
        slotsByKey['2026-11-05'] = { left: 1 };
        setDate(el, '2026-11-05');
        expect(el.label.textContent).toBe('Priority: 1 of 3 left tomorrow');
    });

    test('at 0 left the box is disabled with the full-day text; another day with slots re-enables it', () => {
        slotsByKey['2026-11-04'] = { marks: 3, left: 0 };
        const el = mount(false);
        PrioritySlotsView.bindRow(Object.assign({ checkbox: el.cb, deps: deps(), confirm }, el));
        expect(el.cb.disabled).toBe(true);
        expect(el.hint.textContent).toBe('No priority slots left today.');
        setDate(el, '2026-11-05');
        expect(el.cb.disabled).toBe(false);
        expect(el.hint.textContent).toBe('');
    });

    test('Edit Task on the original day: an owned priority stays ticked and enabled even at 0 left', () => {
        slotsByKey['2026-11-04'] = { marks: 3, left: 0 };
        const el = mount(true);
        const row = PrioritySlotsView.bindRow(Object.assign({
            checkbox: el.cb, deps: deps(), confirm, originalKey: '2026-11-04', originalChecked: true }, el));
        expect(el.cb.checked).toBe(true);
        expect(el.cb.disabled).toBe(false);
        expect(row.wantsPriority()).toBe(true);
    });

    test('Edit Task moved to another day: priority drops (box unticks), the carry text shows, and it costs that day a slot; back again restores it', () => {
        slotsByKey['2026-11-05'] = { marks: 3, left: 0 };
        const el = mount(true);
        const row = PrioritySlotsView.bindRow(Object.assign({
            checkbox: el.cb, deps: deps(), confirm, originalKey: '2026-11-04', originalChecked: true }, el));
        setDate(el, '2026-11-05');
        expect(row.movedDay()).toBe(true);
        expect(el.cb.checked).toBe(false);
        expect(el.cb.disabled).toBe(true); // tomorrow is full
        expect(el.hint.textContent).toContain("Priority doesn't carry over.");
        expect(el.hint.textContent).toContain('No priority slots left tomorrow.');
        setDate(el, '2026-11-06');
        expect(el.cb.disabled).toBe(false);
        expect(el.hint.textContent).toBe(PrioritySlotsView.CARRY_TEXT);
        setDate(el, '2026-11-04');
        expect(row.movedDay()).toBe(false);
        expect(el.cb.checked).toBe(true);
        expect(el.hint.textContent).toBe('');
    });

    test('unticking an owned priority asks first; Keep it puts the tick back, Remove clears it', async () => {
        const el = mount(true);
        PrioritySlotsView.bindRow(Object.assign({
            checkbox: el.cb, deps: deps(), confirm, originalKey: '2026-11-04', originalChecked: true }, el));
        confirm.mockResolvedValueOnce(false);
        el.cb.checked = false; el.cb.dispatchEvent(new Event('change'));
        await flush();
        expect(confirm).toHaveBeenCalledTimes(1);
        expect(confirm.mock.calls[0][0]).toBe('The slot stays used.');
        expect(confirm.mock.calls[0][1]).toEqual(expect.objectContaining({ title: 'Remove priority?', confirmLabel: 'Remove', cancelLabel: 'Keep it' }));
        expect(el.cb.checked).toBe(true);
        confirm.mockResolvedValueOnce(true);
        el.cb.checked = false; el.cb.dispatchEvent(new Event('change'));
        await flush();
        expect(el.cb.checked).toBe(false);
    });

    test('unticking a box that is only ticked in this form (Add Task) never asks', async () => {
        const el = mount(false);
        PrioritySlotsView.bindRow(Object.assign({ checkbox: el.cb, deps: deps(), confirm }, el));
        el.cb.checked = true; el.cb.dispatchEvent(new Event('change'));
        el.cb.checked = false; el.cb.dispatchEvent(new Event('change'));
        await flush();
        expect(confirm).not.toHaveBeenCalled();
        expect(el.cb.checked).toBe(false);
    });

    test('a sub-task under a priority parent is covered: ticked, disabled, with the parent line', () => {
        const el = mount(true);
        PrioritySlotsView.bindRow(Object.assign({ checkbox: el.cb, deps: deps(), confirm, covered: true }, el));
        expect(el.cb.checked).toBe(true);
        expect(el.cb.disabled).toBe(true);
        expect(el.label.textContent).toBe('Priority');
        expect(el.hint.textContent).toBe(PrioritySlotsView.COVERED_TEXT);
    });
});

describe('Add Task form', () => {
    function mountForm(depsOverride) {
        document.body.innerHTML = '<div id="taskFormModal">' + Forms.createTaskFormHtml() + '</div>';
        const calls = { create: [], add: [], setPriority: [] };
        const deps = Object.assign({
            createTaskItemData: (...args) => { calls.create.push(args); return { id: 41 }; },
            addItemToGame: (d) => { calls.add.push(d); },
            sortAndRenderActiveList: jest.fn(),
            updateTaskCountDisplay: jest.fn(),
            setPriority: (id, on) => { calls.setPriority.push([id, on]); return { ok: true }; },
            priorityRowDeps: () => ({
                perDay: 3, todayKey: '2026-11-04',
                prioritySlotsFor: () => ({ key: '2026-11-04', marks: 0, done: 0, left: 3 }),
            }),
            managementWindows: {},
        }, depsOverride || {});
        Forms.attachModalEventListeners('task', deps);
        document.getElementById('modalTaskName').value = 'Write report';
        document.getElementById('modalDueDate').value = '2099-01-01';
        document.getElementById('modalDueTime').value = '17:00';
        return { calls, deps };
    }

    test('the form says "Priority", never "High Priority"', () => {
        mountForm();
        expect(document.getElementById('taskFormModal').textContent).not.toMatch(/high priority/i);
        expect(document.getElementById('modalTaskHighPriorityLabel').textContent).toMatch(/^Priority: \d of 3 left/);
    });

    test('a ticked box creates the task WITHOUT the flag, then marks it through setPriority', () => {
        const { calls } = mountForm();
        document.getElementById('modalTaskHighPriority').checked = true;
        document.getElementById('modalAddTaskButton').click();
        expect(calls.create[0][2]).toBe(false); // isHighPriority arg
        expect(calls.add).toHaveLength(1);
        expect(calls.setPriority).toEqual([[41, true]]);
    });

    test('an unticked box never calls setPriority', () => {
        const { calls } = mountForm();
        document.getElementById('modalAddTaskButton').click();
        expect(calls.add).toHaveLength(1);
        expect(calls.setPriority).toEqual([]);
    });

    test('a full day disables the box, so a stale tick cannot spend a slot', () => {
        const { calls } = mountForm({
            priorityRowDeps: () => ({
                perDay: 3, todayKey: '2026-11-04',
                prioritySlotsFor: () => ({ key: '2026-11-04', marks: 3, done: 0, left: 0 }),
            }),
        });
        const box = document.getElementById('modalTaskHighPriority');
        expect(box.disabled).toBe(true);
        box.checked = true; // forced
        document.getElementById('modalAddTaskButton').click();
        expect(calls.setPriority).toEqual([]);
    });
});

describe('CONFIG', () => {
    test('three slots a day', () => {
        expect(CONFIG.PRIORITY_SLOTS_PER_DAY).toBe(3);
    });
});

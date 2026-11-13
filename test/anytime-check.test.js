/**
 * @jest-environment jsdom
 */
/**
 * Anytime tasks, Build 2 (2026-11-02, Jeremy; DECISIONS 2026-11-02 night): the evening check also asks about open
 * "Anytime today" tasks. Pure candidate / date helpers, the modal's task cards, the pushback pricing of "Tomorrow",
 * and the save round trip of the new fields. The next-morning card is Build 3 and is not covered here.
 */
global.CONFIG = require('../js/config.js');
global.Habits = require('../js/habits.js');
global.Timer = require('../js/timer.js');
global.GoalCheck = require('../js/goalCheck.js');
global.Modal = require('../js/ui/modal.js');
const AnytimeCheck = require('../js/anytimeCheck.js');
const Pushback = require('../js/pushback.js');
const Persistence = require('../js/persistence.js');
const CheckIn = require('../js/ui/checkIn.js');

const at = (d, h, m = 0) => new Date(2026, 10, d, h, m, 0, 0); // November 2026, local time
const NOW = at(2, 21, 0).getTime(); // Mon Nov 2, 9:00 PM
const task = (o) => Object.assign({
    id: 7, type: 'task', name: 'Pay bills', anytime: true, dueDateTime: at(2, 23, 59),
    isOverdue: false, parentId: null, subTasks: [],
}, o);

describe('AnytimeCheck.eveningCandidates', () => {
    test('an open anytime task due 11:59 PM tonight is asked about', () => {
        expect(AnytimeCheck.eveningCandidates([task()], NOW)).toHaveLength(1);
    });

    test('not asked: no flag, a timed task, a habit, a sub-task, a KO ghost', () => {
        const items = [
            task({ id: 1, anytime: undefined }),
            task({ id: 2, dueDateTime: at(2, 18, 0) }),
            task({ id: 3, type: 'habit' }),
            task({ id: 4, parentId: 9 }),
            task({ id: 5, koGhost: true }),
        ];
        expect(AnytimeCheck.eveningCandidates(items, NOW)).toEqual([]);
    });

    test('not asked: due tomorrow, or already overdue (the morning card handles those)', () => {
        expect(AnytimeCheck.eveningCandidates([task({ dueDateTime: at(3, 23, 59) })], NOW)).toEqual([]);
        expect(AnytimeCheck.eveningCandidates([task({ isOverdue: true })], NOW)).toEqual([]);
        expect(AnytimeCheck.eveningCandidates([task()], at(3, 0, 5).getTime())).toEqual([]);
    });

    test('a task stamped as answered tonight is left out; yesterday\'s stamp does not count', () => {
        const stamped = AnytimeCheck.stampEvening(task(), NOW);
        expect(stamped.anytimeAsked.evening).toBe('2026-11-02');
        expect(AnytimeCheck.askedTonight(stamped, NOW)).toBe(true);
        expect(AnytimeCheck.eveningCandidates([stamped], NOW)).toEqual([]);
        const old = task({ anytimeAsked: { evening: '2026-11-01' } });
        expect(AnytimeCheck.eveningCandidates([old], NOW)).toHaveLength(1);
    });

    test('stampEvening keeps other stamp fields and tolerates null', () => {
        const t = task({ anytimeAsked: { morning: true } });
        AnytimeCheck.stampEvening(t, NOW);
        expect(t.anytimeAsked).toEqual({ morning: true, evening: '2026-11-02' });
        expect(AnytimeCheck.stampEvening(null, NOW)).toBeNull();
    });

    test('bad input gives an empty list', () => {
        expect(AnytimeCheck.eveningCandidates(null, NOW)).toEqual([]);
        expect(AnytimeCheck.eveningCandidates([null, undefined, {}], NOW)).toEqual([]);
    });
});

describe('AnytimeCheck date helpers', () => {
    test('tomorrowDue is 23:59 on the next calendar day, including month and year ends', () => {
        expect(AnytimeCheck.tomorrowDue(NOW)).toEqual(at(3, 23, 59));
        expect(AnytimeCheck.tomorrowDue(new Date(2026, 10, 30, 21, 0).getTime())).toEqual(new Date(2026, 11, 1, 23, 59));
        expect(AnytimeCheck.tomorrowDue(new Date(2026, 11, 31, 21, 0).getTime())).toEqual(new Date(2027, 0, 1, 23, 59));
    });

    test('tomorrowDue is 23:59 even across a daylight-saving change (calendar math, not + 24 h)', () => {
        const night = new Date(2027, 2, 13, 21, 0).getTime(); // the evening before US spring-forward (Mar 14, 2027)
        const due = AnytimeCheck.tomorrowDue(night);
        expect(due.getDate()).toBe(14);
        expect(due.getHours()).toBe(23);
        expect(due.getMinutes()).toBe(59);
    });

    test('dateKey is the LOCAL date', () => {
        expect(AnytimeCheck.dateKey(new Date(2026, 10, 2, 23, 59))).toBe('2026-11-02');
        expect(AnytimeCheck.dateKey(new Date(2026, 10, 3, 0, 1))).toBe('2026-11-03');
    });

    test('hasOpenSubTasks and isOpenAnytimeTask', () => {
        expect(AnytimeCheck.hasOpenSubTasks(task({ subTasks: [{ id: 1 }] }))).toBe(true);
        expect(AnytimeCheck.hasOpenSubTasks(task())).toBe(false);
        expect(AnytimeCheck.isOpenAnytimeTask(task())).toBe(true);
        expect(AnytimeCheck.isOpenAnytimeTask(task({ dueDateTime: at(2, 18, 0) }))).toBe(false); // stale flag
    });
});

describe('what "Tomorrow" costs (the real pushback quote)', () => {
    const inputs = (nowDate) => ({
        now: nowDate, graceMs: CONFIG.RESCHEDULE_GRACE_MS, paidZoneMs: CONFIG.PUSHBACK_PAID_ZONE_MS,
        sizes: CONFIG.PUSHBACK_SIZES, allowance: { short: 3, medium: 2, long: 2 }, uses: {},
        dayStartMs: new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime(),
        held: { short: 0, medium: 0, long: 0 }, prices: { short: 5, medium: 10, long: 30 }, points: 100,
    });
    const quote = (nowDate, extra) => Pushback.quote(Object.assign(inputs(nowDate), {
        currentDue: at(2, 23, 59), newDue: AnytimeCheck.tomorrowDue(nowDate.getTime()), createdAt: null,
    }, extra));

    test('at 7 PM the task is more than 4 hours from due: free', () => {
        const q = quote(at(2, 19, 0));
        expect(q.kind).toBe('free');
        expect(q.ok).toBe(true);
    });

    test('at 9 PM it is inside the last 4 hours: one Long pushback, paid by a free charge', () => {
        const q = quote(at(2, 21, 0));
        expect(q.kind).toBe('charge');
        expect(q.size).toBe('long');
        expect(q.count).toBe(1);
    });

    test('out of Long charges and tokens it costs points; with too few points it is blocked', () => {
        const paid = quote(at(2, 21, 0), { allowance: { short: 3, medium: 2, long: 0 } });
        expect(paid.kind).toBe('points');
        expect(paid.cost).toBe(30);
        const blocked = quote(at(2, 21, 0), { allowance: { short: 3, medium: 2, long: 0 }, points: 5 });
        expect(blocked.ok).toBe(false);
        expect(blocked.kind).toBe('blocked');
    });
});

describe('the new fields survive a save and reload', () => {
    test('anytime and anytimeAsked round-trip, and dueDateTime comes back a Date', () => {
        const t = task({ anytimeAsked: { evening: '2026-11-02' } });
        const restored = Persistence.deserialize(Persistence.serialize({ schemaVersion: Persistence.SCHEMA_VERSION, activeItems: [t] }));
        const r = restored.activeItems[0];
        expect(r.anytime).toBe(true);
        expect(r.anytimeAsked).toEqual({ evening: '2026-11-02' });
        expect(r.dueDateTime).toBeInstanceOf(Date);
        expect(r.dueDateTime.getHours()).toBe(23);
        expect(r.dueDateTime.getMinutes()).toBe(59);
    });
});

describe('Evening modal: anytime task cards', () => {
    const flush = () => new Promise((r) => setTimeout(r, 0));
    const habit = (id, name) => ({ id, name, type: 'habit', isNegative: true, goal: { type: 'none' }, definitionId: 'd' + id, timerMsBanked: 0 });
    function makeDeps(tasks, over) {
        const calls = [];
        return Object.assign({
            calls,
            getCandidates: () => [],
            completeItem: (id) => calls.push(['avoid', id]),
            indulgeHabit: (id) => calls.push(['slip', id]),
            onDismiss: jest.fn(),
            getTaskCandidates: () => tasks,
            completeTask: (id) => calls.push(['done', id]),
            leaveTask: (id) => calls.push(['leave', id]),
            describeTomorrow: () => ({ text: 'Free: more than 4 hours away', blocked: false }),
            moveTaskToTomorrow: (id) => { calls.push(['tomorrow', id]); return { ok: true }; },
        }, over);
    }
    const card = (id) => document.querySelector(`.evening-card[data-item-id="${id}"]`);
    const click = (id, outcome) => card(id).querySelector(`[data-outcome="${outcome}"]`).click();
    beforeEach(() => { document.body.innerHTML = ''; });

    test('one card per task with an escaped name, Done / Tomorrow / Leave it, and what Tomorrow costs', () => {
        CheckIn.showEveningModal(makeDeps([task({ id: 1, name: 'Pay <b>bills</b>' })]));
        const c = card(1);
        expect(c.textContent).toContain('Pay <b>bills</b>');
        expect(c.querySelector('b')).toBeNull();
        ['done', 'tomorrow', 'leave'].forEach((o) => expect(c.querySelector(`[data-outcome="${o}"]`)).not.toBeNull());
        expect(c.querySelector('.evening-task-cost').textContent).toBe('Free: more than 4 hours away');
    });

    test('2026-11-12: the skip button reads "Not tonight" with its meaning in the intro and tooltip (was "Leave it")', () => {
        CheckIn.showEveningModal(makeDeps([task({ id: 1 })]));
        const btn = card(1).querySelector('[data-outcome="leave"]');
        expect(btn.textContent).toBe('Not tonight');
        expect(btn.getAttribute('title')).toBe("Don't ask about this task again tonight");
        expect(document.querySelector('.check-in-intro').textContent).toContain('Not tonight means no more questions about that task tonight.');
        expect(document.querySelector('.evening-later-link')).toBeNull();
    });

    test('2026-11-12: a parent with open sub-tasks has no Done button; a plain line says how many are open', () => {
        CheckIn.showEveningModal(makeDeps([task({ id: 1, subTasks: [11, 12, 13] }), task({ id: 2 })]));
        expect(card(1).querySelector('[data-outcome="done"]')).toBeNull();
        expect(card(1).querySelector('.evening-task-subs').textContent).toBe('3 sub-tasks are still open. Finish them to mark this done.');
        expect(card(1).querySelector('[data-outcome="tomorrow"]')).not.toBeNull();
        expect(card(1).querySelector('[data-outcome="leave"]')).not.toBeNull();
        expect(card(2).querySelector('[data-outcome="done"]')).not.toBeNull(); // a task with no sub-tasks keeps Done
        expect(card(2).querySelector('.evening-task-subs')).toBeNull();
    });

    test('no habits and no tasks: nothing opens', () => {
        expect(CheckIn.showEveningModal(makeDeps([]))).toBeNull();
    });

    test('tasks alone are enough to open the modal; a habit-only caller with no task deps still works', () => {
        expect(CheckIn.showEveningModal(makeDeps([task()]))).not.toBeNull();
        document.body.innerHTML = '';
        const legacy = { getCandidates: () => [habit(2, 'Soda')], completeItem: jest.fn(), indulgeHabit: jest.fn(), onDismiss: jest.fn() };
        expect(CheckIn.showEveningModal(legacy)).not.toBeNull();
        expect(card(2)).not.toBeNull();
    });

    test('tasks and Break habits share the modal', () => {
        CheckIn.showEveningModal(makeDeps([task({ id: 1 })], { getCandidates: () => [habit(2, 'Soda')] }));
        expect(document.querySelectorAll('.evening-card')).toHaveLength(2);
        expect(card(1).getAttribute('data-card-kind')).toBe('task');
        expect(card(2).getAttribute('data-card-kind')).toBeNull();
    });

    test('Done completes the task and removes its card; the last card closes the modal', () => {
        const deps = makeDeps([task({ id: 1 })]);
        CheckIn.showEveningModal(deps);
        click(1, 'done');
        expect(deps.calls).toEqual([['done', 1]]);
        expect(document.querySelector('.evening-overlay')).toBeNull();
    });

    test('Tomorrow moves the task; Leave it records the answer; neither completes anything', () => {
        const deps = makeDeps([task({ id: 1 }), task({ id: 2, name: 'Call' })]);
        CheckIn.showEveningModal(deps);
        click(1, 'tomorrow');
        click(2, 'leave');
        expect(deps.calls).toEqual([['tomorrow', 1], ['leave', 2]]);
        expect(document.querySelector('.evening-overlay')).toBeNull();
    });

    test('a Tomorrow that cannot be paid at click time keeps the card and disables the button', () => {
        const deps = makeDeps([task({ id: 1 })], { moveTaskToTomorrow: () => ({ ok: false }) });
        CheckIn.showEveningModal(deps);
        click(1, 'tomorrow');
        expect(card(1)).not.toBeNull();
        expect(card(1).querySelector('[data-outcome="tomorrow"]').disabled).toBe(true);
    });

    test('a blocked cost disables Tomorrow from the start and shows the price', () => {
        const deps = makeDeps([task({ id: 1 })], { describeTomorrow: () => ({ text: 'Costs 30 pts — you have 5', blocked: true }) });
        CheckIn.showEveningModal(deps);
        expect(card(1).querySelector('[data-outcome="tomorrow"]').disabled).toBe(true);
        expect(card(1).querySelector('.evening-task-cost--blocked').textContent).toContain('Costs 30 pts');
    });

    test('a parent with open sub-tasks cannot be marked Done from the card (no Done button at all, 2026-11-12)', () => {
        CheckIn.showEveningModal(makeDeps([task({ id: 1, subTasks: [{ id: 5 }] })]));
        expect(card(1).querySelector('[data-outcome="done"]')).toBeNull();
        expect(card(1).querySelector('.evening-task-subs').textContent).toBe('1 sub-task is still open. Finish it to mark this done.');
    });

    test('closing the modal with a task card left tells the caller (hidden until the next app open)', async () => {
        const deps = makeDeps([task({ id: 1 })]);
        const overlay = CheckIn.showEveningModal(deps);
        overlay.remove();
        await flush();
        expect(deps.onDismiss).toHaveBeenCalledTimes(1);
    });

    test('answering every card does NOT report a dismissal', async () => {
        const deps = makeDeps([task({ id: 1 })]);
        CheckIn.showEveningModal(deps);
        click(1, 'leave');
        await flush();
        expect(deps.onDismiss).not.toHaveBeenCalled();
    });
});

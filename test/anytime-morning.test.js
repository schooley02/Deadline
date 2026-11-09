/**
 * Anytime Build 3 (2026-11-02): the next-morning card for anytime tasks that already attacked overnight.
 * Covers the helpers, the "Done counts as on time" completion (real Items + DailyRecord), the morning modal, and the
 * persistence of the new `anytimeAsked.morning` stamp. 2026-11-09: widened to every open one-off task, asked once per morning
 * (the stamp is the date answered); only an anytime task due yesterday may count as on time. Harness for completeItem mirrors test/items-routine-attendance.test.js.
 * @jest-environment jsdom
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.RunStats = require('../js/runStats.js');
global.SpriteAnim = require('../js/spriteAnim.js');
global.Timer = require('../js/timer.js');
global.GoalCheck = require('../js/goalCheck.js');
global.Modal = require('../js/ui/modal.js');
const DailyRecord = require('../js/dailyRecord.js');
const Items = require('../js/items.js');
const AnytimeCheck = require('../js/anytimeCheck.js');
const Pushback = require('../js/pushback.js');
const CheckIn = require('../js/ui/checkIn.js');

const at = (d, h, m = 0) => new Date(2026, 10, d, h, m, 0, 0); // November 2026, local time
const NOW = at(3, 7, 30).getTime(); // Tue Nov 3, 7:30 AM: the morning after
const task = (o) => Object.assign({
    id: 7, type: 'task', name: 'Pay bills', anytime: true, dueDateTime: at(2, 23, 59),
    isOverdue: true, parentId: null, subTasks: [],
}, o);

describe('AnytimeCheck.morningCandidates', () => {
    test('an anytime task whose 11:59 PM passed on an earlier day is asked about', () => {
        expect(AnytimeCheck.morningCandidates([task()], NOW).map(t => t.id)).toEqual([7]);
    });

    test('no age limit: a task that attacked days ago is still asked about', () => {
        expect(AnytimeCheck.morningCandidates([task({ dueDateTime: at(1, 23, 59) })], NOW)).toHaveLength(1);
    });

    test('today\'s anytime task is the evening check\'s job, not the morning card\'s', () => {
        const todays = task({ dueDateTime: at(3, 23, 59), isOverdue: false });
        expect(AnytimeCheck.morningCandidates([todays], NOW)).toEqual([]);
    });

    test('skips sub-tasks, recurring instances, KO ghosts, habits and tasks already answered THIS morning', () => {
        const items = [
            task({ id: 3, parentId: 9 }),
            task({ id: 4, koGhost: true }),
            task({ id: 5, anytimeAsked: { morning: '2026-11-03' } }),
            task({ id: 6, type: 'habit' }),
            task({ id: 8, definitionId: 2 }),
        ];
        expect(AnytimeCheck.morningCandidates(items, NOW)).toEqual([]);
    });

    // 2026-11-09 (Jeremy): "if it never gets completed on any day, the user should still be presented with the pop up".
    test('timed tasks are asked about too: a plain task and a task with another due time', () => {
        const items = [task({ id: 1, anytime: undefined }), task({ id: 2, anytime: undefined, dueDateTime: at(2, 18, 0) })];
        expect(AnytimeCheck.morningCandidates(items, NOW).map(t => t.id)).toEqual([1, 2]);
    });

    test('Jeremy\'s zombie: anytime, given a time, pushed back, Leave it answered an earlier morning: asked again', () => {
        const t = task({ anytime: undefined, dueDateTime: at(1, 9, 15), anytimeAsked: { morning: '2026-11-01' } });
        expect(AnytimeCheck.morningCandidates([t], NOW)).toHaveLength(1);
    });

    test('an old permanent `true` stamp (before 2026-11-09) no longer silences the card', () => {
        expect(AnytimeCheck.morningCandidates([task({ anytimeAsked: { morning: true } })], NOW)).toHaveLength(1);
    });

    test('an answer this morning silences it until tomorrow morning, then it asks again', () => {
        const t = AnytimeCheck.stampMorning(task(), NOW);
        expect(AnytimeCheck.morningCandidates([t], NOW)).toEqual([]);
        expect(AnytimeCheck.morningCandidates([t], at(3, 22, 0).getTime())).toEqual([]);
        expect(AnytimeCheck.morningCandidates([t], at(4, 7, 0).getTime())).toHaveLength(1);
    });

    test('an evening stamp does not silence the morning card', () => {
        const t = task({ anytimeAsked: { evening: '2026-11-02' } });
        expect(AnytimeCheck.morningCandidates([t], NOW)).toHaveLength(1);
    });

    test('newest due first, at most MORNING_MAX per sitting', () => {
        const old = Array.from({ length: 8 }, (_, i) => task({ id: i + 1, dueDateTime: new Date(2026, 9, 20 + i, 23, 59) }));
        const got = AnytimeCheck.morningCandidates(old, NOW);
        expect(got).toHaveLength(AnytimeCheck.MORNING_MAX);
        expect(got[0].id).toBe(8); // Oct 27 is the newest
        expect(got[got.length - 1].id).toBe(8 - AnytimeCheck.MORNING_MAX + 1);
    });

    test('stampMorning sets the stamp and keeps the evening one', () => {
        const t = AnytimeCheck.stampMorning(task({ anytimeAsked: { evening: '2026-11-02' } }), NOW);
        expect(t.anytimeAsked).toEqual({ evening: '2026-11-02', morning: '2026-11-03' });
        expect(AnytimeCheck.askedMorning(t, NOW)).toBe(true);
        expect(AnytimeCheck.morningCandidates([t], NOW)).toEqual([]);
    });
});

describe('AnytimeCheck.onTimeEligible (who may use the on-time credit)', () => {
    test('an anytime task due 11:59 PM yesterday is eligible', () => {
        expect(AnytimeCheck.onTimeEligible(task(), NOW)).toBe(true);
    });
    test('an anytime task due two days ago is not', () => {
        expect(AnytimeCheck.onTimeEligible(task({ dueDateTime: at(1, 23, 59) }), NOW)).toBe(false);
    });
    test('a timed task due yesterday is not', () => {
        expect(AnytimeCheck.onTimeEligible(task({ anytime: undefined, dueDateTime: at(2, 18, 0) }), NOW)).toBe(false);
    });
    test('yesterdayKey is calendar based across a month edge', () => {
        expect(AnytimeCheck.yesterdayKey(new Date(2026, 11, 1, 7, 0).getTime())).toBe('2026-11-30');
    });
});

describe('AnytimeCheck.morningDue ("Today")', () => {
    test('is 11:59 PM today', () => {
        expect(AnytimeCheck.morningDue(NOW).getTime()).toBe(at(3, 23, 59).getTime());
    });
    test('in the last minute of the day it rolls to 11:59 PM tomorrow so the move is never in the past', () => {
        const lateNow = new Date(2026, 10, 3, 23, 59, 30).getTime();
        expect(AnytimeCheck.morningDue(lateNow).getTime()).toBe(at(4, 23, 59).getTime());
    });
});

describe('what "Today" costs (the real pushback quote, task already overdue)', () => {
    const quote = (extra) => Pushback.quote(Object.assign({
        now: new Date(NOW), graceMs: CONFIG.RESCHEDULE_GRACE_MS, paidZoneMs: CONFIG.PUSHBACK_PAID_ZONE_MS,
        sizes: CONFIG.PUSHBACK_SIZES, allowance: { short: 3, medium: 2, long: 2 }, uses: {},
        dayStartMs: new Date(2026, 10, 3).getTime(), held: { short: 0, medium: 0, long: 0 },
        prices: { short: 5, medium: 10, long: 30 }, points: 100,
        currentDue: at(2, 23, 59), newDue: AnytimeCheck.morningDue(NOW), createdAt: null,
    }, extra));

    test('an overdue task is in the paid zone, so moving it costs something', () => {
        const q = quote();
        expect(q.ok).toBe(true);
        expect(q.kind).not.toBe('free');
    });
    test('with no charges, tokens or points it is blocked', () => {
        const q = quote({ allowance: { short: 0, medium: 0, long: 0 }, points: 0 });
        expect(q.ok).toBe(false);
    });
});

describe('Items.completeItem with { onTime: true }', () => {
    function fakeEl() {
        const classes = new Set();
        return {
            style: {}, dataset: {}, textContent: '',
            classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
            addEventListener: () => {}, appendChild: () => {}, remove: () => {},
            querySelector: () => null, querySelectorAll: () => [], setAttribute: () => {}, removeAttribute: () => {},
            insertBefore: () => {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
        };
    }
    let savedDocument;
    beforeAll(() => { savedDocument = global.document; global.document = { createElement: () => fakeEl(), body: { classList: { contains: () => false } } }; });
    afterAll(() => { global.document = savedDocument; });
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    function makeDeps(activeItems, rec) {
        let xp = 0, points = 100;
        return {
            isGameOver: () => false, activeItems, definedHabits: () => [], definedRoutines: () => [],
            completedItems: () => [], getCurrentRunStats: () => RunStats.freshRunStats(), recordLifetime: () => {},
            recordDaily: (event, payload) => DailyRecord.bump(rec, event, payload),
            xpPerTaskDefeat: CONFIG.XP_PER_TASK_DEFEAT, xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
            pointsPerTask: CONFIG.POINTS_PER_TASK, pointsPerHabit: CONFIG.POINTS_PER_HABIT,
            habitStreakBonusThreshold: CONFIG.HABIT_STREAK_BONUS_THRESHOLD,
            getPlayerXP: () => xp, setPlayerXP: (n) => { xp = n; }, getPlayerPoints: () => points, setPlayerPoints: (n) => { points = n; },
            updatePlayerDisplays: () => {}, checkPlayerLevelUp: () => {}, createListItem: () => {}, sortAndRenderActiveList: () => {},
            renderCompletedItems: () => {}, updateTaskCountDisplay: () => {}, resetAllSubTaskCheckboxes: () => {}, saveGame: () => {},
            baseWidth: 120, enemyWidth: CONFIG.ENEMY_WIDTH, habitEnemyWidth: CONFIG.HABIT_ENEMY_WIDTH, gameCanvas: fakeEl(),
            calculateTimelineXWithClustering: () => 0, getSubTaskClusterOffset: () => 0, getItemTopPosition: () => 0, handleEnemyClick: () => {},
        };
    }
    const overdueTask = (id) => Object.assign(task({ id, category: 'other', isHighPriority: false, lastDamageTickTime: null,
        completedSubTasks: 0, totalSubTasks: 0, element: fakeEl(), listItemElement: null }));
    const fresh = () => DailyRecord.fresh({ date: '2026-11-03', run: 1 });

    test('without onTime an overdue completion counts as late (the Clock tower baseline)', () => {
        const rec = fresh();
        const t = overdueTask(1);
        Items.completeItem(1, makeDeps([t], rec));
        expect(rec.done.task).toBe(1);
        expect(rec.done.late).toBe(1);
    });

    test('with onTime the completion counts as done and NOT late', () => {
        const rec = fresh();
        const t = overdueTask(1);
        Items.completeItem(1, makeDeps([t], rec), { onTime: true });
        expect(rec.done.task).toBe(1);
        expect(rec.done.late).toBe(0);
    });

    test('onTime clears only the overdue state; a task pushed back late stays late', () => {
        const rec = fresh();
        const t = Object.assign(overdueTask(1), { pushedLate: true });
        Items.completeItem(1, makeDeps([t], rec), { onTime: true });
        expect(rec.done.late).toBe(1);
    });

    test('a parent with open sub-tasks is still refused and keeps its overdue state', () => {
        const rec = fresh();
        const t = Object.assign(overdueTask(1), { subTasks: [{ id: 5 }] });
        const res = Items.completeItem(1, makeDeps([t], rec), { onTime: true });
        expect(res && res.ok).toBe(false);
        expect(t.isOverdue).toBe(true);
    });
});

describe('Morning modal: anytime task cards', () => {
    const flush = () => new Promise((r) => setTimeout(r, 0));
    function makeDeps(tasks, over) {
        const calls = [];
        return Object.assign({
            calls,
            getTaskCandidates: () => tasks,
            completeTask: (id) => calls.push(['done', id]),
            leaveTask: (id) => calls.push(['leave', id]),
            describeMove: () => ({ text: 'Costs 1 Long charge', blocked: false }),
            moveTaskToToday: (id) => { calls.push(['today', id]); return { ok: true }; },
            onDismiss: jest.fn(),
        }, over);
    }
    const card = (id) => document.querySelector(`.morning-task-card[data-item-id="${id}"]`);
    const click = (id, outcome) => card(id).querySelector(`[data-outcome="${outcome}"]`).click();
    beforeEach(() => { document.body.innerHTML = ''; });

    test('nothing to ask: nothing opens', () => {
        expect(CheckIn.showMorningTaskModal(makeDeps([]))).toBeNull();
    });

    test('one card per task, escaped name, past-tense wording, Done / Today / Leave it, and the cost', () => {
        CheckIn.showMorningTaskModal(makeDeps([task({ name: 'Pay <b>bills</b>' })]));
        const c = card(7);
        expect(c.textContent).toContain('Pay <b>bills</b>');
        expect(c.querySelector('b')).toBeNull();
        expect(c.textContent).toContain('already attacked');
        expect(c.textContent).not.toContain('today?');
        ['done', 'today', 'leave'].forEach((o) => expect(c.querySelector(`[data-outcome="${o}"]`)).not.toBeNull());
        expect(c.querySelector('[data-outcome="tomorrow"]')).toBeNull();
        expect(c.querySelector('[data-outcome="today"]').textContent).toBe('Today');
        expect(c.querySelector('.evening-task-cost').textContent).toBe('Costs 1 Long charge');
    });

    test('the heading explains that Done counts as on time and the damage stays', () => {
        CheckIn.showMorningTaskModal(makeDeps([task()]));
        const overlay = document.querySelector('.morning-task-overlay');
        expect(overlay.textContent).toContain('Still unfinished');
        expect(overlay.textContent).toMatch(/counts as on time/);
        expect(overlay.textContent).toMatch(/damage stays/);
    });

    test('with no eligible task the heading drops the on-time sentence and Done says it counts late', () => {
        CheckIn.showMorningTaskModal(makeDeps([task()], {
            isOnTimeEligible: () => false, getCredit: () => ({ left: 2, text: 'On-time credit: 2 of 2 left.' }),
        }));
        const overlay = document.querySelector('.morning-task-overlay');
        expect(overlay.textContent).not.toMatch(/counts as on time/);
        expect(overlay.querySelector('.morning-credit')).toBeNull();
        expect(card(7).querySelector('[data-outcome="done"]').textContent).toBe('Done (counts late)');
    });

    test('the card says when it was due: a timed task days ago shows its day and time', () => {
        const due = new Date(2020, 0, 4, 15, 0);
        CheckIn.showMorningTaskModal(makeDeps([task({ anytime: undefined, dueDateTime: due })]));
        const text = card(7).textContent;
        expect(text).toContain(due.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
        expect(text).toContain(due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
        expect(text).toContain('already attacked');
    });

    test('Done completes the task and the last answered card closes the modal', () => {
        const deps = makeDeps([task()]);
        CheckIn.showMorningTaskModal(deps);
        click(7, 'done');
        expect(deps.calls).toEqual([['done', 7]]);
        expect(document.querySelector('.morning-task-overlay')).toBeNull();
    });

    test('Today moves the task; Leave it records the answer; neither completes anything', () => {
        const deps = makeDeps([task({ id: 1 }), task({ id: 2, name: 'Call' })]);
        CheckIn.showMorningTaskModal(deps);
        click(1, 'today');
        click(2, 'leave');
        expect(deps.calls).toEqual([['today', 1], ['leave', 2]]);
    });

    test('a Today that cannot be paid at click time keeps the card and disables the button', () => {
        const deps = makeDeps([task()], { moveTaskToToday: () => ({ ok: false }) });
        CheckIn.showMorningTaskModal(deps);
        click(7, 'today');
        expect(card(7)).not.toBeNull();
        expect(card(7).querySelector('[data-outcome="today"]').disabled).toBe(true);
    });

    test('a blocked cost disables Today from the start', () => {
        CheckIn.showMorningTaskModal(makeDeps([task()], { describeMove: () => ({ text: 'Costs 30 pts — you have 5', blocked: true }) }));
        expect(card(7).querySelector('[data-outcome="today"]').disabled).toBe(true);
        expect(card(7).querySelector('.evening-task-cost--blocked')).not.toBeNull();
    });

    test('a parent with open sub-tasks cannot be marked Done from the card', () => {
        CheckIn.showMorningTaskModal(makeDeps([task({ subTasks: [{ id: 5 }] })]));
        expect(card(7).querySelector('[data-outcome="done"]').disabled).toBe(true);
    });

    test('"I\'ll check this later" closes it and reports a dismissal while cards are left', async () => {
        const deps = makeDeps([task()]);
        CheckIn.showMorningTaskModal(deps);
        document.querySelector('.morning-later-link').click();
        await flush();
        expect(document.querySelector('.morning-task-overlay')).toBeNull();
        expect(deps.onDismiss).toHaveBeenCalledTimes(1);
    });

    test('answering every card does NOT report a dismissal', async () => {
        const deps = makeDeps([task()]);
        CheckIn.showMorningTaskModal(deps);
        click(7, 'leave');
        await flush();
        expect(deps.onDismiss).not.toHaveBeenCalled();
    });

    test('the evening card is unchanged: still "Tomorrow" and "today?"', () => {
        const html = CheckIn.showEveningModal({
            getCandidates: () => [], getTaskCandidates: () => [task({ isOverdue: false })],
            describeTomorrow: () => ({ text: '', blocked: false }), completeTask() {}, leaveTask() {}, moveTaskToTomorrow: () => ({ ok: true }),
            completeItem() {}, indulgeHabit() {}, onDismiss() {},
        });
        const c = html.querySelector('.evening-task-card');
        expect(c.classList.contains('morning-task-card')).toBe(false);
        expect(c.querySelector('[data-outcome="tomorrow"]').textContent).toBe('Tomorrow');
        expect(c.textContent).toContain('today?');
    });
});

describe('the morning stamp survives a save and reload', () => {
    test('anytimeAsked.morning round-trips through JSON like every other item field', () => {
        const t = AnytimeCheck.stampMorning(task(), NOW);
        const back = JSON.parse(JSON.stringify(t));
        expect(AnytimeCheck.askedMorning(back, NOW)).toBe(true);
        expect(AnytimeCheck.morningCandidates([back], NOW)).toEqual([]);
    });
});

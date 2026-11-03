/**
 * Anytime morning-card on-time CREDIT (2026-11-02, Jeremy): "Done counts as on time" is limited to
 * CONFIG.ANYTIME_MORNING_CREDITS (2) per rolling 7 days, one slot returning at a time. Covers the pure helpers, the saved
 * State list, the modal's credit line and Done labels, and the Clock tower card line. (script.js wiring is not loaded by Jest;
 * it was checked in a live browser.)
 * @jest-environment jsdom
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.CONFIG = require('../js/config.js');
global.Timer = require('../js/timer.js');
global.GoalCheck = require('../js/goalCheck.js');
global.Modal = require('../js/ui/modal.js');
global.DailyRecord = require('../js/dailyRecord.js');
global.DayRollover = require('../js/dayRollover.js');
global.Persistence = require('../js/persistence.js');
const AnytimeCheck = require('../js/anytimeCheck.js');
const CheckIn = require('../js/ui/checkIn.js');
const VillageCard = require('../js/ui/villageCard.js');
const VillageProgress = require('../js/villageProgress.js');
const State = require('../js/state.js');

const DAY = 24 * 60 * 60 * 1000;
const WIN = CONFIG.ANYTIME_MORNING_CREDIT_WINDOW_MS;
const MAX = CONFIG.ANYTIME_MORNING_CREDITS;
const NOW = new Date(2026, 10, 3, 7, 30).getTime(); // Tue Nov 3, 7:30 AM
const info = (uses, now = NOW) => AnytimeCheck.creditInfo(uses, now, MAX, WIN);

describe('the numbers', () => {
    test('starts at 2 credits per rolling 7 days', () => {
        expect(MAX).toBe(2);
        expect(WIN).toBe(7 * DAY);
    });
});

describe('AnytimeCheck.creditInfo / spendCredit (rolling slots)', () => {
    test('nothing spent: full, no next-back time', () => {
        expect(info([])).toEqual({ left: 2, max: 2, nextBackAt: null });
    });

    test('one spent: one left, and that slot returns exactly 7 days after it was used', () => {
        const t = NOW - 1 * DAY;
        expect(info([t])).toEqual({ left: 1, max: 2, nextBackAt: t + WIN });
    });

    test('both spent: none left, the NEXT one back is the OLDEST use + 7 days', () => {
        const a = NOW - 3 * DAY, b = NOW - 1 * DAY;
        expect(info([b, a])).toEqual({ left: 0, max: 2, nextBackAt: a + WIN });
    });

    test('slots return one at a time, not all at once', () => {
        const a = NOW - 3 * DAY, b = NOW - 1 * DAY;
        const later = a + WIN + 1; // just after the first slot expires
        expect(info([a, b], later).left).toBe(1);
        expect(info([a, b], later).nextBackAt).toBe(b + WIN);
        expect(info([a, b], b + WIN + 1).left).toBe(2);
    });

    test('a use exactly 7 days old has expired (the boundary is exclusive)', () => {
        expect(info([NOW - WIN]).left).toBe(2);
        expect(info([NOW - WIN + 1]).left).toBe(1);
    });

    test('junk stamps are ignored', () => {
        expect(info([NaN, 'x', null, undefined]).left).toBe(2);
        expect(AnytimeCheck.creditInfo(null, NOW, MAX, WIN).left).toBe(2);
    });

    test('spendCredit adds now and drops expired stamps', () => {
        const old = NOW - 9 * DAY, recent = NOW - DAY;
        expect(AnytimeCheck.spendCredit([old, recent], NOW, WIN)).toEqual([recent, NOW]);
    });

    test('more spent than the max (an old save or a changed setting) still reads as none left', () => {
        const r = info([NOW - 3 * DAY, NOW - 2 * DAY, NOW - DAY]);
        expect(r.left).toBe(0);
        expect(r.nextBackAt).toBe(NOW - 2 * DAY + WIN); // the 2nd oldest: the first to free a slot
    });
});

describe('AnytimeCheck.creditText', () => {
    test('full: no next-back clause', () => {
        expect(AnytimeCheck.creditText(info([]), 'en-US')).toBe('On-time credit: 2 of 2 left.');
    });
    test('spent: names the count and when the next one is back', () => {
        const text = AnytimeCheck.creditText(info([NOW - DAY]), 'en-US');
        expect(text).toMatch(/^On-time credit: 1 of 2 left\. Next back \w{3}, \w{3} \d{1,2}, \d{1,2}:\d{2}\s?[AP]M\.$/);
    });
    test('none left', () => {
        expect(AnytimeCheck.creditText(info([NOW - 2 * DAY, NOW - DAY]), 'en-US')).toMatch(/^On-time credit: 0 of 2 left\. Next back /);
    });
});

describe('State.anytimeCreditUses', () => {
    beforeAll(() => { global.window = { definedTasks: [] }; });
    afterAll(() => { delete global.window; });
    beforeEach(() => State.setAnytimeCreditUses(null));

    test('starts empty; the setter keeps only finite numbers; junk becomes empty', () => {
        expect(State.getAnytimeCreditUses()).toEqual([]);
        State.setAnytimeCreditUses([1, 'x', NaN, 3]);
        expect(State.getAnytimeCreditUses()).toEqual([1, 3]);
        State.setAnytimeCreditUses(42);
        expect(State.getAnytimeCreditUses()).toEqual([]);
    });

    test('it rides in getPersistableState (additive root field)', () => {
        State.setAnytimeCreditUses([10, 20]);
        expect(State.getPersistableState({}).anytimeCreditUses).toEqual([10, 20]);
    });
});

describe('Morning modal: credit line and Done labels', () => {
    const task = (id) => ({ id, type: 'task', name: 'T' + id, anytime: true, dueDateTime: new Date(2026, 10, 2, 23, 59), isOverdue: true, subTasks: [] });
    function makeDeps(tasks, startUses) {
        let uses = startUses || [];
        const calls = [];
        const getCredit = () => { const i = info(uses); return { left: i.left, text: AnytimeCheck.creditText(i, 'en-US') }; };
        return {
            calls, getCredit,
            getTaskCandidates: () => tasks,
            completeTask: (id) => { calls.push(['done', id]); if (getCredit().left > 0) uses = AnytimeCheck.spendCredit(uses, NOW, WIN); },
            leaveTask: (id) => calls.push(['leave', id]),
            describeMove: () => ({ text: 'Free', blocked: false }),
            moveTaskToToday: () => ({ ok: true }),
            onDismiss: jest.fn(),
        };
    }
    const doneBtn = (id) => document.querySelector(`.morning-task-card[data-item-id="${id}"] [data-outcome="done"]`);
    beforeEach(() => { document.body.innerHTML = ''; });

    test('shows the credit line and "Done (on time)" while a credit is left', () => {
        CheckIn.showMorningTaskModal(makeDeps([task(1)]));
        expect(document.querySelector('.morning-credit').textContent).toBe('On-time credit: 2 of 2 left.');
        expect(doneBtn(1).textContent).toBe('Done (on time)');
    });

    test('with none left Done says "Done (counts late)" but is still enabled', () => {
        CheckIn.showMorningTaskModal(makeDeps([task(1)], [NOW - 2 * DAY, NOW - DAY]));
        expect(document.querySelector('.morning-credit').textContent).toMatch(/0 of 2 left\. Next back/);
        expect(doneBtn(1).textContent).toBe('Done (counts late)');
        expect(doneBtn(1).disabled).toBe(false);
    });

    test('each Done refreshes the line and the other cards\' labels as the credit runs out', () => {
        CheckIn.showMorningTaskModal(makeDeps([task(1), task(2), task(3)], [NOW - DAY]));
        expect(doneBtn(2).textContent).toBe('Done (on time)');
        doneBtn(1).click(); // spends the last credit
        expect(document.querySelector('.morning-credit').textContent).toMatch(/0 of 2 left/);
        expect(doneBtn(2).textContent).toBe('Done (counts late)');
        expect(doneBtn(3).textContent).toBe('Done (counts late)');
    });

    test('a parent with open sub-tasks keeps its "Finish the sub-tasks first" button', () => {
        const parent = Object.assign(task(1), { subTasks: [{ id: 9 }] });
        CheckIn.showMorningTaskModal(makeDeps([parent, task(2)], [NOW - DAY]));
        doneBtn(2).click();
        expect(doneBtn(1).textContent).toBe('Finish the sub-tasks first');
    });

    test('a caller without getCredit (older deps) still works: plain "Done", no credit line', () => {
        const deps = makeDeps([task(1)]);
        delete deps.getCredit;
        CheckIn.showMorningTaskModal(deps);
        expect(doneBtn(1).textContent).toBe('Done');
        expect(document.querySelector('.morning-credit')).toBeNull();
    });
});

describe('Clock tower card line', () => {
    const progress = VillageProgress.tierFor(0, VillageProgress.DEFAULT_THRESHOLDS.punctuality);
    const reward = { current: 'Short 3 a day', next: null, maxed: false, credit: 'On-time credit: 1 of 2 left. Next back Tue, Nov 10, 7:30 AM.' };

    test('shows the credit line inside the reward block', () => {
        const html = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'punctuality', progress, reward }));
        expect(html).toContain('On-time credit: 1 of 2 left. Next back Tue, Nov 10, 7:30 AM.');
        expect(html.indexOf('Your reward')).toBeLessThan(html.indexOf('On-time credit'));
    });

    test('a reward without a credit string shows no extra line', () => {
        const html = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'punctuality', progress, reward: { current: 'x', next: null, maxed: true } }));
        expect(html).not.toContain('On-time credit');
    });
});

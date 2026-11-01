/**
 * Optional Start time (2026-11-01, Jeremy): a task / sub-task / routine task can carry a planned
 * start. The zombie walks toward the church by its START time, then waits there (idle, no attack,
 * no damage) until the due time arrives; the timer button invites a stopwatch start meanwhile.
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
global.Schedule = require('../js/schedule.js');
const Loop = require('../js/loop.js');
const Items = require('../js/items.js');
const Routines = require('../js/routines.js');
const Timer = require('../js/timer.js');
const Persistence = require('../js/persistence.js');

const MIN = 60000;
const HOUR = 60 * MIN;
const DIMS = { gameScreenWidth: 1200, baseWidth: 100, enemyWidth: 80, habitEnemyWidth: 60 };

// A fixed mid-day "now" keeps the walk zones away from midnight.
const NOW = new Date(2026, 5, 15, 9, 0, 0, 0);
const at = (h, m = 0) => new Date(2026, 5, 15, h, m, 0, 0);

describe('Clock work window', () => {
    test('hasWorkWindow needs a valid start strictly before due', () => {
        expect(Clock.hasWorkWindow({ dueDateTime: at(15), startDateTime: at(13) })).toBe(true);
        expect(Clock.hasWorkWindow({ dueDateTime: at(15), startDateTime: at(15) })).toBe(false);
        expect(Clock.hasWorkWindow({ dueDateTime: at(15), startDateTime: at(16) })).toBe(false);
        expect(Clock.hasWorkWindow({ dueDateTime: at(15), startDateTime: null })).toBe(false);
        expect(Clock.hasWorkWindow({ dueDateTime: at(15) })).toBe(false);
        expect(Clock.hasWorkWindow({ dueDateTime: at(15), startDateTime: new Date('nope') })).toBe(false);
    });

    test('isInWorkWindow is [start, due)', () => {
        const item = { dueDateTime: at(15), startDateTime: at(13) };
        expect(Clock.isInWorkWindow(item, at(12, 59))).toBe(false);
        expect(Clock.isInWorkWindow(item, at(13))).toBe(true);
        expect(Clock.isInWorkWindow(item, at(14, 59))).toBe(true);
        expect(Clock.isInWorkWindow(item, at(15))).toBe(false);
    });

    test('before start the zombie walks by the START time (same x as a task due at start)', () => {
        const withStart = { type: 'task', dueDateTime: at(15), startDateTime: at(11) };
        const dueAtStart = { type: 'task', dueDateTime: at(11) };
        expect(Clock.calculateTimelinePosition(withStart, NOW, DIMS))
            .toBe(Clock.calculateTimelinePosition(dueAtStart, NOW, DIMS));
    });

    test('inside the window it stands at the church; after due too', () => {
        const item = { type: 'task', dueDateTime: at(15), startDateTime: at(11) };
        expect(Clock.calculateTimelinePosition(item, at(11), DIMS)).toBe(DIMS.baseWidth);
        expect(Clock.calculateTimelinePosition(item, at(13), DIMS)).toBe(DIMS.baseWidth);
        expect(Clock.calculateTimelinePosition(item, at(15, 1), DIMS)).toBe(DIMS.baseWidth);
    });

    test('no start time: position is unchanged', () => {
        const plain = { type: 'task', dueDateTime: at(15) };
        const nullStart = { type: 'task', dueDateTime: at(15), startDateTime: null };
        expect(Clock.calculateTimelinePosition(nullStart, NOW, DIMS))
            .toBe(Clock.calculateTimelinePosition(plain, NOW, DIMS));
    });

    test('walk urgency follows the start time, and is null once waiting', () => {
        const item = { dueDateTime: at(15), startDateTime: at(10) };
        expect(Clock.getWalkUrgencyTier(item, NOW)).toBe('urgent'); // start in 1h
        expect(Clock.getWalkUrgencyTier(item, at(10, 30))).toBeNull(); // waiting
    });
});

describe('Items.resolveStartDateTime / createTaskItemData', () => {
    const deps = () => ({
        getNextId: () => 1, activeItems: [], gameScreenWidth: 1200, enemyWidth: 80,
        calculateTimelineXWithClustering: () => 500,
    });

    test('resolveStartDateTime: same date as due, must be before due', () => {
        const due = new Date('2099-03-04T17:00');
        expect(Items.resolveStartDateTime('2099-03-04', '15:30', due).getTime()).toBe(new Date('2099-03-04T15:30').getTime());
        expect(Items.resolveStartDateTime('2099-03-04', '17:00', due)).toBeNull();
        expect(Items.resolveStartDateTime('2099-03-04', '18:00', due)).toBeNull();
        expect(Items.resolveStartDateTime('2099-03-04', '', due)).toBeNull();
        expect(Items.resolveStartDateTime('2099-03-04', undefined, due)).toBeNull();
        expect(Items.resolveStartDateTime('', '10:00', due)).toBeNull();
    });

    test('a created task carries startDateTime, or null when none is given', () => {
        const withStart = Items.createTaskItemData('A', 'work', false, '2099-03-04', '17:00', undefined, deps(), '15:30');
        expect(withStart.startDateTime).toBeInstanceOf(Date);
        expect(withStart.startDateTime.getHours()).toBe(15);
        const without = Items.createTaskItemData('B', 'work', false, '2099-03-04', '17:00', undefined, deps());
        expect(without.startDateTime).toBeNull();
    });

    test('a sub-task can have a start time too', () => {
        const parent = { id: 9, type: 'task', dueDateTime: new Date('2099-03-04T18:00') };
        const d = deps();
        d.activeItems = [parent];
        const sub = Items.createTaskItemData('S', 'work', false, '2099-03-04', '17:00', 9, d, '16:00');
        expect(sub.startDateTime.getHours()).toBe(16);
    });

    test('start survives a save / load round trip as a Date', () => {
        const task = Items.createTaskItemData('A', 'work', false, '2099-03-04', '17:00', undefined, deps(), '15:30');
        const back = Persistence.deserialize(Persistence.serialize({ activeItems: [task] })).activeItems[0];
        expect(back.startDateTime).toBeInstanceOf(Date);
        expect(back.startDateTime.getTime()).toBe(task.startDateTime.getTime());
    });
});

describe('Routine task default start time', () => {
    const ref = new Date(2026, 5, 15, 0, 0, 0, 0);
    const due = Routines.getRoutineTaskInstanceDueTime('17:00', ref);

    test('getRoutineTaskInstanceStartTime builds the day\'s start or null', () => {
        expect(Routines.getRoutineTaskInstanceStartTime('15:00', ref, due).getHours()).toBe(15);
        expect(Routines.getRoutineTaskInstanceStartTime('17:00', ref, due)).toBeNull();
        expect(Routines.getRoutineTaskInstanceStartTime('18:30', ref, due)).toBeNull();
        expect(Routines.getRoutineTaskInstanceStartTime('', ref, due)).toBeNull();
        expect(Routines.getRoutineTaskInstanceStartTime(null, ref, due)).toBeNull();
        expect(Routines.getRoutineTaskInstanceStartTime('garbage', ref, due)).toBeNull();
    });

    test('a spawned instance copies the definition\'s default start', () => {
        const def = { id: 't1', name: 'Gym', category: 'health', defaultDueTime: '17:00', defaultStartTime: '15:00' };
        const inst = Routines.createRoutineTaskInstanceData(def, ref, {
            getNextId: () => 5, gameScreenWidth: 1200, enemyWidth: 80, calculateTimelineXWithClustering: () => 400,
        });
        expect(inst.startDateTime.getHours()).toBe(15);
        const plain = Routines.createRoutineTaskInstanceData({ ...def, defaultStartTime: undefined }, ref, {
            getNextId: () => 6, gameScreenWidth: 1200, enemyWidth: 80, calculateTimelineXWithClustering: () => 400,
        });
        expect(plain.startDateTime).toBeNull();
    });

    test('create / edit keep defaultStartTime on the definition', () => {
        const routine = { id: 'r1', taskDefinitionIds: [] };
        const defs = [];
        const created = Routines.createNewTaskInRoutine('r1', { name: 'T', category: 'work', defaultDueTime: '17:00', defaultStartTime: '15:00' }, [routine], defs);
        expect(created.defaultStartTime).toBe('15:00');
        Routines.editTaskInRoutine(created.id, { name: 'T', category: 'work', defaultDueTime: '17:00', defaultStartTime: '', isHighPriority: false }, defs);
        expect(defs[0].defaultStartTime).toBeNull();
    });
});

describe('Loop: waiting at the church between start and due', () => {
    function fakeEl() {
        const classes = new Set();
        return { style: {}, classList: {
            add: (...c) => c.forEach(x => classes.add(x)),
            remove: (...c) => c.forEach(x => classes.delete(x)),
            contains: (c) => classes.has(c),
            toggle: (c, on) => { on ? classes.add(c) : classes.delete(c); },
        } };
    }
    function setup(item) {
        const state = { damage: 0, overdue: [] };
        const deps = {
            isGameOver: () => false, isOfflineCatchUpActive: () => false, isTimePreviewActive: () => false,
            activeItems: [item], baseWidth: 100,
            getLastRegenTickMs: () => Date.now(), setLastRegenTickMs: () => {}, healBase: () => {},
            markAsOverdue: (it, t) => {
                it.isOverdue = true; it.lastDamageTickTime = t.getTime();
                it.element.classList.add('enemy-at-base');
                it.element.classList.remove('work-waiting', 'lurker-parked');
                state.overdue.push(it.id);
            },
            getSubTaskClusterOffset: () => 0,
            calculateTimelineXWithClustering: (it, t) => Clock.calculateTimelinePosition(it, t, DIMS),
            damageBase: (n) => { state.damage += n; },
            updateMidnightLine: () => {},
            isNonThreatening: () => false,
        };
        return { deps, state };
    }
    const task = (o) => ({
        id: 1, type: 'task', isOverdue: false, lastDamageTickTime: null, x: 900,
        element: fakeEl(), listItemElement: fakeEl(), ...o,
    });

    test('inside the window: idle classes, never overdue, no damage', () => {
        const now = Date.now();
        const item = task({ startDateTime: new Date(now - HOUR), dueDateTime: new Date(now + HOUR) });
        const { deps, state } = setup(item);
        Loop.updateActiveItems(deps);
        expect(item.isOverdue).toBe(false);
        expect(state.damage).toBe(0);
        expect(item.x).toBe(DIMS.baseWidth);
        expect(item.element.classList.contains('work-waiting')).toBe(true);
        expect(item.element.classList.contains('lurker-parked')).toBe(true);
        expect(item.element.classList.contains('enemy-at-base')).toBe(false);
    });

    test('before start: still walking, no waiting class', () => {
        const now = Date.now();
        const item = task({ startDateTime: new Date(now + HOUR), dueDateTime: new Date(now + 2 * HOUR) });
        const { deps } = setup(item);
        Loop.updateActiveItems(deps);
        expect(item.element.classList.contains('work-waiting')).toBe(false);
        expect(item.x).toBeGreaterThan(DIMS.baseWidth);
    });

    test('at the due time it goes overdue and attacks; waiting classes are cleared', () => {
        const now = Date.now();
        const item = task({ startDateTime: new Date(now - 2 * HOUR), dueDateTime: new Date(now - 1000) });
        item.element.classList.add('work-waiting', 'lurker-parked');
        const { deps, state } = setup(item);
        Loop.updateActiveItems(deps);
        expect(item.isOverdue).toBe(true);
        expect(state.overdue).toEqual([1]);
        expect(item.element.classList.contains('enemy-at-base')).toBe(true);
        expect(item.element.classList.contains('work-waiting')).toBe(false);
        expect(item.element.classList.contains('lurker-parked')).toBe(false);
    });

    test('clearing the start while waiting makes it walk again', () => {
        const now = Date.now();
        const item = task({ startDateTime: new Date(now - HOUR), dueDateTime: new Date(now + 3 * HOUR) });
        const { deps } = setup(item);
        Loop.updateActiveItems(deps);
        expect(item.element.classList.contains('work-waiting')).toBe(true);
        item.startDateTime = null;
        Loop.updateActiveItems(deps);
        expect(item.element.classList.contains('work-waiting')).toBe(false);
        expect(item.element.classList.contains('lurker-parked')).toBe(false);
        expect(item.x).toBeGreaterThan(DIMS.baseWidth);
    });

    test('no start time: behaves as before (no waiting class)', () => {
        const now = Date.now();
        const item = task({ dueDateTime: new Date(now + HOUR) });
        const { deps } = setup(item);
        Loop.updateActiveItems(deps);
        expect(item.element.classList.contains('work-waiting')).toBe(false);
    });
});

describe('Timer.shouldPrompt (planned work time)', () => {
    const t = (o) => Object.assign({ type: 'task', timer: null, timerMsBanked: 0, isOverdue: false }, o);
    const win = { startDateTime: at(13), dueDateTime: at(15) };

    test('prompts inside the window while no timer runs', () => {
        expect(Timer.shouldPrompt(t(win), at(14).getTime())).toBe(true);
    });
    test('not before start, not once overdue, not with a start-less task', () => {
        expect(Timer.shouldPrompt(t(win), at(12).getTime())).toBe(false);
        expect(Timer.shouldPrompt(t({ ...win, isOverdue: true }), at(14).getTime())).toBe(false);
        expect(Timer.shouldPrompt(t({ dueDateTime: at(15) }), at(14).getTime())).toBe(false);
    });
    test('not while the timer runs, nor for ghosts / break habits', () => {
        expect(Timer.shouldPrompt(t({ ...win, timer: { startedAt: 1 } }), at(14).getTime())).toBe(false);
        expect(Timer.shouldPrompt(t({ ...win, koGhost: true }), at(14).getTime())).toBe(false);
        expect(Timer.shouldPrompt(t({ ...win, type: 'habit', isNegative: true }), at(14).getTime())).toBe(false);
    });
    test('the red attack nudge and the planned prompt never overlap', () => {
        const overdue = t({ ...win, isOverdue: true });
        expect(Timer.shouldNudge(overdue)).toBe(true);
        expect(Timer.shouldPrompt(overdue, at(16).getTime())).toBe(false);
    });
});

describe('Forms start / due helpers', () => {
    const Forms = require('../js/ui/forms.js');

    test('startBeforeDueError', () => {
        expect(Forms.startBeforeDueError('', '17:00')).toBeNull();
        expect(Forms.startBeforeDueError('15:00', '17:00')).toBeNull();
        expect(Forms.startBeforeDueError('17:00', '17:00')).toMatch(/earlier/);
        expect(Forms.startBeforeDueError('18:00', '17:00')).toMatch(/earlier/);
    });

    test('the Start box sits to the LEFT of the Due box in the markup', () => {
        const html = Forms.startDueTimeGroupHtml({ startId: 'sx', dueId: 'dx', startValue: '', dueValue: '17:00' });
        expect(html.indexOf('id="sx"')).toBeGreaterThan(-1);
        expect(html.indexOf('id="sx"')).toBeLessThan(html.indexOf('id="dx"'));
        expect(html).toContain('time-pair');
        expect(html).toContain('value="17:00"');
    });

    test('the Add Task form carries the pair', () => {
        const html = Forms.createTaskFormHtml ? Forms.createTaskFormHtml(new Date(2026, 5, 15, 9, 0)) : '';
        expect(html).toContain('id="modalStartTime"');
        expect(html.indexOf('id="modalStartTime"')).toBeLessThan(html.indexOf('id="modalDueTime"'));
    });
});

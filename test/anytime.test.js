/**
 * @jest-environment jsdom
 */
/**
 * "Anytime" tasks, Build 1 (2026-11-02, Jeremy; DECISIONS 2026-11-02 night): a task can be due by 11:59 PM on its
 * date with no Start. `item.anytime === true`, absent = false, additive (no schema bump). The flag only lives while
 * the due time is exactly 23:59. Builds 2-3 (evening check, next-morning card) are not covered here.
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
global.Schedule = require('../js/schedule.js');
global.Modal = require('../js/ui/modal.js');
global.Forms = require('../js/ui/forms.js');
global.Timer = require('../js/timer.js');
global.Habits = require('../js/habits.js');
global.SpriteAnim = { setEnemyCategory: () => {} };
global.PushbackHelp = require('../js/ui/pushbackHelp.js');
const Items = require('../js/items.js');
const Popups = require('../js/ui/popups.js');
const AgendaList = require('../js/ui/agendaList.js');

const itemsDeps = () => ({
    getNextId: () => 7, activeItems: [], gameScreenWidth: 1200, enemyWidth: 80,
    calculateTimelineXWithClustering: () => 500,
});
const make = (...args) => Items.createTaskItemData(...args);

describe('Items.createTaskItemData with anytime', () => {
    test('due 23:59 on the date, flag set, Start dropped even when one is passed', () => {
        const t = make('Pay bills', 'financial', false, '2099-03-04', '10:00', undefined, itemsDeps(), '08:00', true);
        expect(t.anytime).toBe(true);
        expect(t.dueDateTime.getFullYear()).toBe(2099);
        expect(t.dueDateTime.getMonth()).toBe(2);
        expect(t.dueDateTime.getDate()).toBe(4);
        expect(t.dueDateTime.getHours()).toBe(23);
        expect(t.dueDateTime.getMinutes()).toBe(59);
        expect(t.startDateTime).toBeNull();
    });

    test('without the argument nothing changes: no `anytime` property at all, Start still works', () => {
        const t = make('Call', 'other', false, '2099-03-04', '10:00', undefined, itemsDeps(), '08:00');
        expect('anytime' in t).toBe(false);
        expect(t.dueDateTime.getHours()).toBe(10);
        expect(t.startDateTime).toEqual(new Date('2099-03-04T08:00'));
    });

    test('anytime: false / undefined also leave no property', () => {
        expect('anytime' in make('A', 'other', false, '2099-03-04', '10:00', undefined, itemsDeps(), undefined, false)).toBe(false);
        expect('anytime' in make('A', 'other', false, '2099-03-04', '10:00', undefined, itemsDeps(), undefined, undefined)).toBe(false);
    });

    test('a sub-task ignores it', () => {
        const parent = { id: 1, type: 'task', dueDateTime: new Date('2099-03-05T23:59') };
        const deps = Object.assign(itemsDeps(), { activeItems: [parent] });
        const sub = make('Step', 'other', false, '2099-03-04', '10:00', 1, deps, undefined, true);
        expect('anytime' in sub).toBe(false);
        expect(sub.dueDateTime.getHours()).toBe(10);
    });

    test('no due date: ignored (falls back to the usual default)', () => {
        const t = make('Loose', 'other', false, '', '', undefined, itemsDeps(), undefined, true);
        expect('anytime' in t).toBe(false);
    });
});

describe('anytime helpers', () => {
    const at = (h, m) => new Date(2099, 2, 4, h, m, 0, 0);

    test('isAnytimeTask needs type task and the flag exactly true', () => {
        expect(Items.isAnytimeTask({ type: 'task', anytime: true })).toBe(true);
        expect(Items.isAnytimeTask({ type: 'task' })).toBe(false);
        expect(Items.isAnytimeTask({ type: 'task', anytime: 1 })).toBe(false);
        expect(Items.isAnytimeTask({ type: 'habit', anytime: true })).toBe(false);
        expect(Items.isAnytimeTask(null)).toBe(false);
    });

    test('isAnytimeDueTime is exactly 23:59', () => {
        expect(Items.isAnytimeDueTime(at(23, 59))).toBe(true);
        expect(Items.isAnytimeDueTime(at(23, 58))).toBe(false);
        expect(Items.isAnytimeDueTime(at(0, 29))).toBe(false);
        expect(Items.isAnytimeDueTime(new Date('nope'))).toBe(false);
        expect(Items.isAnytimeDueTime(null)).toBe(false);
    });

    test('syncAnytimeFlag keeps the flag at 23:59 and drops it anywhere else', () => {
        const kept = { type: 'task', anytime: true, dueDateTime: at(23, 59) };
        expect(Items.syncAnytimeFlag(kept).anytime).toBe(true);
        const moved = { type: 'task', anytime: true, dueDateTime: at(0, 29) };
        expect('anytime' in Items.syncAnytimeFlag(moved)).toBe(false);
        const plain = { type: 'task', dueDateTime: at(10, 0) };
        expect('anytime' in Items.syncAnytimeFlag(plain)).toBe(false);
        expect(Items.syncAnytimeFlag(null)).toBeNull();
    });

    test('a Long pushback (+24 h) from 23:59 stays 23:59, a Short (+30 min) does not', () => {
        const due = at(23, 59);
        const long = { type: 'task', anytime: true, dueDateTime: new Date(due.getTime() + 24 * 3600000) };
        const short = { type: 'task', anytime: true, dueDateTime: new Date(due.getTime() + 30 * 60000) };
        // The +24 h result is 23:59 again except across a DST change, where the wall clock shifts an hour.
        const dstShift = long.dueDateTime.getHours() !== 23;
        Items.syncAnytimeFlag(long);
        Items.syncAnytimeFlag(short);
        expect(long.anytime === true).toBe(!dstShift);
        expect('anytime' in short).toBe(false);
    });
});

describe('Add Task form', () => {
    function open() {
        document.body.innerHTML = '';
        const created = [];
        const deps = {
            createTaskItemData: jest.fn((...a) => { created.push(a); return { id: 1 }; }),
            addItemToGame: jest.fn(), sortAndRenderActiveList: jest.fn(),
            managementWindows: {}, populateTasksWindow: jest.fn(),
        };
        Forms.showFormModal('task', deps);
        return { deps, created };
    }
    const $ = (id) => document.getElementById(id);

    test('the Anytime row is on the form, unchecked, Due editable, Start visible', () => {
        open();
        expect($('modalTaskAnytime')).not.toBeNull();
        expect($('modalTaskAnytime').checked).toBe(false);
        expect($('modalDueTime').disabled).toBe(false);
        expect($('modalStartTime').closest('.form-row').hidden).toBe(false);
    });

    test('checking it shows 23:59 greyed out and hides + empties Start; unchecking brings them back', () => {
        open();
        $('modalStartTime').value = '08:00';
        $('modalTaskAnytime').checked = true;
        $('modalTaskAnytime').dispatchEvent(new Event('change', { bubbles: true }));
        expect($('modalDueTime').value).toBe('23:59');
        expect($('modalDueTime').disabled).toBe(true);
        expect($('modalStartTime').value).toBe('');
        expect($('modalStartTime').closest('.form-row').hidden).toBe(true);

        $('modalTaskAnytime').checked = false;
        $('modalTaskAnytime').dispatchEvent(new Event('change', { bubbles: true }));
        expect($('modalDueTime').disabled).toBe(false);
        expect($('modalDueTime').value).toBe('23:59'); // no memory of the old time
        expect($('modalStartTime').closest('.form-row').hidden).toBe(false);
    });

    test('submitting with it checked sends 23:59, no Start, and anytime = true', () => {
        const { created } = open();
        $('modalTaskName').value = 'Pay bills';
        $('modalDueDate').value = '2099-03-04';
        $('modalTaskAnytime').checked = true;
        $('modalTaskAnytime').dispatchEvent(new Event('change', { bubbles: true }));
        $('modalAddTaskButton').click();
        expect(created).toHaveLength(1);
        const [name, , , dueDate, dueTime, parentId, start, anytime] = created[0];
        expect(name).toBe('Pay bills');
        expect(dueDate).toBe('2099-03-04');
        expect(dueTime).toBe('23:59');
        expect(parentId).toBeUndefined();
        expect(start).toBeUndefined();
        expect(anytime).toBe(true);
    });

    test('submitting with it unchecked sends no anytime flag (old behavior)', () => {
        const { created } = open();
        $('modalTaskName').value = 'Call';
        $('modalDueDate').value = '2099-03-04';
        $('modalDueTime').value = '10:00';
        $('modalAddTaskButton').click();
        expect(created).toHaveLength(1);
        expect(created[0][4]).toBe('10:00');
        expect(created[0][7]).toBeUndefined();
    });
});

describe('Edit Task form', () => {
    const $ = (id) => document.getElementById(id);
    const task = (o) => Object.assign({
        id: 3, type: 'task', name: 'Write report', category: 'career', isHighPriority: false,
        dueDateTime: new Date(2099, 2, 4, 15, 0), startDateTime: null, timer: null, timerMsBanked: 0, subTasks: [],
    }, o);
    function deps(over) {
        return Object.assign({
            activeItems: [], recomputeOverdueStateAfterEdit: jest.fn(), sortAndRenderActiveList: jest.fn(),
            createListItem: jest.fn(), saveGame: jest.fn(), updateTaskCountDisplay: jest.fn(),
            getPlayerPoints: () => 40,
        }, over);
    }
    beforeEach(() => { document.body.innerHTML = ''; });

    test('a normal task opens unchecked with Due editable', () => {
        Popups.showEditTaskModal(task(), deps());
        expect($('editTaskAnytime')).not.toBeNull();
        expect($('editTaskAnytime').checked).toBe(false);
        expect($('editDueTime').disabled).toBe(false);
        expect($('editDueTime').value).toBe('15:00');
    });

    test('an anytime task opens checked, Due greyed at 23:59, Start hidden', () => {
        Popups.showEditTaskModal(task({ anytime: true, dueDateTime: new Date(2099, 2, 4, 23, 59) }), deps());
        expect($('editTaskAnytime').checked).toBe(true);
        expect($('editDueTime').disabled).toBe(true);
        expect($('editDueTime').value).toBe('23:59');
        expect($('editStartTime').closest('.form-row').hidden).toBe(true);
    });

    test('sub-tasks and routine tasks get no Anytime row', () => {
        Popups.showEditTaskModal(task({ parentId: 1 }), deps({ activeItems: [task({ id: 1 })] }));
        expect($('editTaskAnytime')).toBeNull();
        document.body.innerHTML = '';
        Popups.showEditTaskModal(task({ definitionId: 'routine_task_1' }), deps());
        expect($('editTaskAnytime')).toBeNull();
    });

    test('saving with it checked makes the task anytime: 23:59, flag, Start cleared', () => {
        const item = task({ startDateTime: new Date(2099, 2, 4, 9, 0) });
        Popups.showEditTaskModal(item, deps());
        $('editTaskAnytime').checked = true;
        $('editTaskAnytime').dispatchEvent(new Event('change', { bubbles: true }));
        $('saveTaskChanges').click();
        expect(item.anytime).toBe(true);
        expect(item.dueDateTime.getHours()).toBe(23);
        expect(item.dueDateTime.getMinutes()).toBe(59);
        expect(item.startDateTime).toBeNull();
    });

    test('unchecking an anytime task saves an ordinary timed task and drops the flag', () => {
        const item = task({ anytime: true, dueDateTime: new Date(2099, 2, 4, 23, 59) });
        Popups.showEditTaskModal(item, deps());
        $('editTaskAnytime').checked = false;
        $('editTaskAnytime').dispatchEvent(new Event('change', { bubbles: true }));
        $('editDueTime').value = '18:30';
        $('saveTaskChanges').click();
        expect('anytime' in item).toBe(false);
        expect(item.dueDateTime.getHours()).toBe(18);
        expect(item.dueDateTime.getMinutes()).toBe(30);
    });

    test('the price line prices a checked box as 23:59 (a move out to that time), not the stale box value', () => {
        const reschedulePricingFor = jest.fn(() => ({ later: false, free: true, reason: 'not-later', canAfford: true, paidZone: false }));
        Popups.showEditTaskModal(task(), deps({ reschedulePricingFor }));
        reschedulePricingFor.mockClear();
        $('editTaskAnytime').checked = true;
        $('editTaskAnytime').dispatchEvent(new Event('change', { bubbles: true }));
        expect(reschedulePricingFor).toHaveBeenCalled();
        const asked = reschedulePricingFor.mock.calls[reschedulePricingFor.mock.calls.length - 1][1];
        expect(asked.getHours()).toBe(23);
        expect(asked.getMinutes()).toBe(59);
    });
});

describe('Agenda row text', () => {
    const rowDeps = () => ({
        activeItems: [], categoryStyles: { other: { bgColor: '#ccc' } }, completeItem: jest.fn(), isGameOver: () => false,
        showEditTaskModal: jest.fn(), showEditHabitInstanceModal: jest.fn(), createSubTaskPrompt: jest.fn(),
    });
    const details = (item) => { AgendaList.createListItem(item, rowDeps()); return item.listItemElement.querySelector('.item-details').textContent; };
    const row = (o) => Object.assign({
        id: 9, type: 'task', name: 'Pay bills', category: 'other', subTasks: [],
        dueDateTime: new Date(2099, 2, 4, 23, 59),
    }, o);

    test('an anytime task reads "Due: <date> \u00B7 Anytime", not 11:59 PM', () => {
        const text = details(row({ anytime: true }));
        expect(text).toMatch(/^Due: .+ \u00B7 Anytime$/);
        expect(text).not.toMatch(/11:59/);
    });

    test('the same time without the flag still prints the time', () => {
        expect(details(row())).toMatch(/11:59/);
    });

    test('a stale flag on a task no longer due at 23:59 prints the real time', () => {
        const text = details(row({ anytime: true, dueDateTime: new Date(2099, 2, 4, 18, 30) }));
        expect(text).not.toMatch(/Anytime/);
        expect(text).toMatch(/6:30|18:30/);
    });
});

describe('Task popup Due line', () => {
    const popupDeps = () => ({
        activeItems: [], completeItem: jest.fn(), indulgeHabit: jest.fn(), recomputeOverdueStateAfterEdit: jest.fn(),
        sortAndRenderActiveList: jest.fn(), createListItem: jest.fn(), saveGame: jest.fn(), getPlayerPoints: () => 40,
    });
    const item = (o) => Object.assign({
        id: 4, type: 'task', name: 'Pay bills', category: 'financial', isHighPriority: false, subTasks: [],
        dueDateTime: new Date(2099, 2, 4, 23, 59), timer: null, timerMsBanked: 0,
    }, o);
    const dueText = () => document.querySelector('.task-due-display').textContent;
    beforeEach(() => { document.body.innerHTML = ''; });

    test('an anytime task reads "\u00B7 Anytime", not the 11:59 PM time', () => {
        Popups.showTaskDetailsPopup(item({ anytime: true }), popupDeps());
        expect(dueText()).toMatch(/\u00B7 Anytime$/);
        expect(dueText()).not.toMatch(/11:59/);
    });

    test('without the flag, or with a stale flag at another time, it prints the time', () => {
        Popups.showTaskDetailsPopup(item(), popupDeps());
        expect(dueText()).toMatch(/11:59/);
        document.body.innerHTML = '';
        Popups.showTaskDetailsPopup(item({ anytime: true, dueDateTime: new Date(2099, 2, 4, 18, 30) }), popupDeps());
        expect(dueText()).not.toMatch(/Anytime/);
    });
});

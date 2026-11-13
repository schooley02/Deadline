/**
 * "Not needed" passes Build B (2026-11-13): the pure pieces behind the screens -- Yesterday outcome, popup buttons, panel line, plan extras.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.NotNeeded = require('../js/notNeeded.js');
global.PrioritySlots = require('../js/prioritySlots.js');
const Items = require('../js/items.js');
const DayPager = require('../js/dayPager.js');
const LevelPanel = require('../js/ui/levelPanel.js');
const Popups = require('../js/ui/popups.js');

const HOUR = 60 * 60 * 1000;
const day = new Date(2026, 10, 12, 12, 0, 0);

describe('Yesterday outcome', () => {
    test('a habit with skipDayDate on that day reads "notNeeded"; other days are untouched', () => {
        expect(DayPager.outcomeForHabitOnDay({ skipDayDate: '2026-11-12', occurrenceHistory: [] }, day)).toBe('notNeeded');
        expect(DayPager.outcomeForHabitOnDay({ skipDayDate: '2026-11-11', occurrenceHistory: [] }, day)).toBe('unknown');
        expect(DayPager.outcomeForHabitOnDay({ occurrenceHistory: [{ date: '2026-11-12', success: true }] }, day)).toBe('completed');
    });
    test('a routine task with skipDayDate on that day reads "notNeeded", otherwise missed', () => {
        expect(DayPager.outcomeForTaskOnDay({ id: 1, skipDayDate: '2026-11-12' }, [], day)).toBe('notNeeded');
        expect(DayPager.outcomeForTaskOnDay({ id: 1 }, [], day)).toBe('missed');
    });
});

describe('level panel passes line', () => {
    test('shows the count, and the reset day only at zero', () => {
        expect(LevelPanel.passesLineHtml({ left: 2, cap: 3, resets: 'Monday' })).toMatch(/2 of 3 left this week<\/p>/);
        expect(LevelPanel.passesLineHtml({ left: 0, cap: 3, resets: 'Monday' })).toMatch(/\(resets Monday\)/);
    });
});

function deps(items, uses = []) {
    let u = uses;
    return { activeItems: items, definedHabits: () => [], definedTasks: () => [], getNotNeededUses: () => u, setNotNeededUses: (x) => { u = x; },
        notNeededCap: 3, weekStartsOn: 1, isGameOver: () => false };
}
const el = () => ({ style: {}, remove() {}, classList: { add() {}, remove() {}, toggle() {} } });
const oneOff = (extra = {}) => ({ id: 1, type: 'task', name: 'Pay rent', dueDateTime: new Date(Date.now() + 5 * HOUR), isOverdue: false, subTasks: [], element: el(), listItemElement: el(), ...extra });

describe('planNotNeeded extras and the popup buttons', () => {
    test('passesNow is the count before the action; resetMs is a future Monday', () => {
        const d = deps([oneOff()]);
        const p = Items.planNotNeeded(1, 'notNeeded', d);
        expect(p).toMatchObject({ ok: true, left: 2, passesNow: 3 });
        expect(p.resetMs).toBeGreaterThan(Date.now());
        expect(new Date(p.resetMs).getDay()).toBe(1);
        expect(Items.notNeededPassesLeft(d)).toBe(3);
    });
    test('a one-off task not yet due shows both buttons, with the count on Not needed and a free delete', () => {
        const d = deps([oneOff()]);
        const html = Popups.buildNotNeededSectionHtml(d.activeItems[0], { planNotNeeded: (id, a) => Items.planNotNeeded(id, a, d) });
        expect(html).toContain('Not needed today · 3 left this week');
        expect(html).toContain('>Delete Task</button>');
        expect(html).not.toContain('disabled');
    });
    test('an overdue task: Not needed is greyed with the reason, delete says it uses a pass', () => {
        const t = oneOff({ isOverdue: true, dueDateTime: new Date(Date.now() - HOUR) });
        const d = deps([t]);
        const html = Popups.buildNotNeededSectionHtml(t, { planNotNeeded: (id, a) => Items.planNotNeeded(id, a, d) });
        expect(html).toContain('Only available before it is due.');
        expect(html).toContain('Delete Task · uses 1 pass');
    });
    test('no passes left: Not needed is greyed with the reset weekday; deleting a task that is not due stays free', () => {
        const d = deps([oneOff()], [Date.now(), Date.now(), Date.now()]);
        const html = Popups.buildNotNeededSectionHtml(d.activeItems[0], { planNotNeeded: (id, a) => Items.planNotNeeded(id, a, d) });
        expect(html).toMatch(/No passes left\. Resets \w+\./);
        expect((html.match(/disabled/g) || []).length).toBe(1);
        expect(html).toContain('id="deleteTaskBtn" class="not-needed-btn not-needed-btn--delete">Delete Task</button>');
    });
    test('nothing is drawn without the dep, and the Edit form row is only for deletable tasks', () => {
        const t = oneOff();
        expect(Popups.buildNotNeededSectionHtml(t, {})).toBe('');
        const d = deps([t]);
        expect(Popups.editDeleteHtml(t, { planNotNeeded: (id, a) => Items.planNotNeeded(id, a, d) })).toContain('deleteTaskEditBtn');
        expect(Popups.editDeleteHtml(t, {})).toBe('');
    });
});

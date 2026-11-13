/**
 * "Not needed today" for a routine task (2026-11-13): a task definition's `skipDayDate` keeps that day's instance from spawning
 * again (a same-day reload must not bring it back), and expires by itself on the next day. Habits already had this gate
 * (Habits.selectHabitDefsToSpawn); routine tasks get it in Routines.selectTaskDefsToSpawn.
 */
global.Schedule = require('../js/schedule.js');
global.FrozenSlots = require('../js/frozenSlots.js');
const Routines = require('../js/routines.js');

const DAY = new Date(2026, 10, 13, 9, 0, 0);
const NEXT_DAY = new Date(2026, 10, 14, 9, 0, 0);

function key(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function taskDef(id, extra = {}) { return { id, name: `Task ${id}`, category: 'other', ...extra }; }
function routine(taskIds) { return { id: 'r1', name: 'Morning', habitDefinitionIds: [], taskDefinitionIds: taskIds, isActive: true }; }
const select = (defs, day) => Routines.selectTaskDefsToSpawn(defs, [routine(defs.map(d => d.id))], [], [], day).map(d => d.id);

describe('selectTaskDefsToSpawn: skipDayDate', () => {
    test('a task with no skipDayDate spawns (unchanged behaviour)', () => {
        expect(select([taskDef('a')], DAY)).toEqual(['a']);
    });
    test('a task marked not needed for that day does not spawn', () => {
        expect(select([taskDef('a', { skipDayDate: key(DAY) }), taskDef('b')], DAY)).toEqual(['b']);
    });
    test('the gate expires by itself: the next day it spawns again', () => {
        expect(select([taskDef('a', { skipDayDate: key(DAY) })], NEXT_DAY)).toEqual(['a']);
    });
    test('a null or older skipDayDate does not block', () => {
        expect(select([taskDef('a', { skipDayDate: null }), taskDef('b', { skipDayDate: '2026-11-01' })], DAY)).toEqual(['a', 'b']);
    });
    test('a future day pager ghost for the skipped day is not conjured either', () => {
        expect(select([taskDef('a', { skipDayDate: key(NEXT_DAY) })], NEXT_DAY)).toEqual([]);
    });
});

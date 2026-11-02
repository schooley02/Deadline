/**
 * Week strip stays in step with saves (2026-11-02, Jeremy: "when I add a habit or tasks for some day, that day's
 * button doesn't update the number until I refresh").
 *
 * Root cause: every save path must go through script.js's ONE shared `updateTaskCountDisplay()` (HUD counter + week strip).
 * Five inline `() => Hud.updateTaskCountDisplay({...})` closures had bypassed it (so Add Task / sub-task / spawns never
 * recounted the strip), and createHabitDefinition + the routine create/edit wrappers never called it at all. The July
 * 2026 fix for the same symptom was undone by exactly this kind of copy-paste, so part 1 is a source guard.
 *
 * Part 1: guard on script.js source. Part 2: the view really recounts when refreshWeekStrip() runs after a save.
 */
const fs = require('fs');
const path = require('path');

global.Schedule = require('../js/schedule.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.Habits = require('../js/habits.js');
global.Routines = require('../js/routines.js');
global.TimeSlider = require('../js/timeSlider.js');
global.DayPager = require('../js/dayPager.js');
const DayPagerView = require('../js/ui/dayPagerView.js');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const codeLines = (src) => src.split(/\r?\n/).filter(l => { const t = l.trim(); return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')); });

describe('week strip refresh: script.js wiring guard', () => {
    const script = read('script.js');
    const lines = codeLines(script);

    test('Hud.updateTaskCountDisplay is called from exactly one place (the shared wrapper)', () => {
        const direct = lines.filter(l => l.includes('Hud.updateTaskCountDisplay('));
        expect(direct).toHaveLength(1);
        // ... and that one place also refreshes the week strip.
        const wrapper = script.split(/\r?\n/);
        const at = wrapper.findIndex(l => /^\s*function updateTaskCountDisplay\(\)/.test(l));
        expect(at).toBeGreaterThan(-1);
        const body = wrapper.slice(at, at + 4).join('\n');
        expect(body).toContain('Hud.updateTaskCountDisplay(');
        expect(body).toContain('DayPagerView.refreshWeekStrip()');
    });

    test('no deps object builds its own updateTaskCountDisplay closure', () => {
        const inline = lines.filter(l => /updateTaskCountDisplay\s*:\s*\(\s*\)\s*=>/.test(l));
        expect(inline).toEqual([]);
    });

    test.each([
        'createHabitDefinition',
        'createNewHabitInRoutine',
        'createNewTaskInRoutine',
        'editHabitInRoutine',
        'editTaskInRoutine',
    ])('%s refreshes the count/strip', (fn) => {
        const rows = script.split(/\r?\n/);
        const start = rows.findIndex(l => new RegExp(`^\\s*(async )?function ${fn}\\(`).test(l));
        expect(start).toBeGreaterThan(-1);
        // function bodies here end at the first line that is exactly 4 spaces + "}"
        let end = start + 1;
        while (end < rows.length && !/^ {4}\}\s*$/.test(rows[end])) end++;
        expect(rows.slice(start, end).join('\n')).toMatch(/updateTaskCountDisplay\(\)/);
    });

    test('popupsDeps hands the shared function to the Edit Task save', () => {
        const rows = script.split(/\r?\n/);
        const start = rows.findIndex(l => /^\s*function popupsDeps\(\)/.test(l));
        expect(start).toBeGreaterThan(-1);
        expect(rows.slice(start, start + 12).join('\n')).toMatch(/updateTaskCountDisplay,/);
        expect(read('js/ui/popups.js')).toMatch(/deps\.updateTaskCountDisplay\(\)/);
    });
});

describe('week strip refresh: the view recounts after a save', () => {
    const TODAY = new Date(2026, 10, 2); // Mon Nov 2 2026, local
    let row, habits, tasks, active;

    const cellCounts = () => {
        const counts = {};
        const re = /data-offset="(\d+)"[\s\S]*?<span class="week-strip-count">(\d+)<\/span>/g;
        let m;
        while ((m = re.exec(row.innerHTML))) counts[Number(m[1])] = Number(m[2]);
        return counts;
    };

    beforeEach(() => {
        row = { innerHTML: '', contains: () => true };
        habits = []; tasks = []; active = [];
        DayPagerView.init({
            weekStripRowEl: row,
            getCurrentGameDate: () => TODAY,
            getDefinedHabits: () => habits,
            getDefinedRoutines: () => [],
            getDefinedTasks: () => tasks,
            getCompletedItems: () => [],
            getActiveItems: () => active,
            getSickDayDate: () => null,
            setTimePreviewActive: () => {},
        });
    });

    test('starts empty', () => {
        expect(Object.values(cellCounts())).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    test('a new Wednesday-only habit raises Wednesday (offset 2) after refreshWeekStrip, and nothing else', () => {
        habits.push({
            id: 'h1', name: 'Stretch', category: 'health', timeOfDay: 'morning', isNegative: false, routineId: null, streak: 0,
            schedule: { frequency: 'weekly', daysOfWeek: [3] },
        });
        // the stale state Jeremy saw: nothing recounted yet
        expect(cellCounts()[2]).toBe(0);
        DayPagerView.refreshWeekStrip();
        const counts = cellCounts();
        expect(counts[2]).toBe(1);
        [0, 1, 3, 4, 5, 6].forEach(o => expect(counts[o]).toBe(0));
    });

    test('a new task already spawned for Thursday (offset 3) raises Thursday after refreshWeekStrip', () => {
        active.push({ id: 7, type: 'task', definitionId: null, parentId: null, dueDateTime: new Date(2026, 10, 5, 17, 0) });
        DayPagerView.refreshWeekStrip();
        expect(cellCounts()[3]).toBe(1);
    });

    test('a task moved to another day by an edit shifts the count between the two cells', () => {
        const t = { id: 8, type: 'task', definitionId: null, parentId: null, dueDateTime: new Date(2026, 10, 4, 17, 0) };
        active.push(t);
        DayPagerView.refreshWeekStrip();
        expect(cellCounts()[2]).toBe(1);
        t.dueDateTime = new Date(2026, 10, 6, 17, 0); // Edit Task: Wed -> Fri
        DayPagerView.refreshWeekStrip();
        const counts = cellCounts();
        expect(counts[2]).toBe(0);
        expect(counts[4]).toBe(1);
    });
});

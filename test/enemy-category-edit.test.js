/**
 * Editing an item's category must re-skin its on-screen zombie (2026-10-21).
 *
 * The bug: the sprite atlas is picked by the `zombie-<category>` class. Edit
 * Task removed only `category-*` (regex) and then ADDED the new zombie class,
 * leaving the old one behind; CSS order let the old atlas win. Routine-task
 * edits also never touched today's live instance at all.
 */

const SpriteAnim = require('../js/spriteAnim.js');

// Minimal classList stand-in (jest env is 'node', no DOM).
function fakeEl(classes) {
    const set = new Set(classes);
    return {
        classList: {
            add: (...c) => c.forEach(x => set.add(x)),
            remove: (...c) => c.forEach(x => set.delete(x)),
            contains: x => set.has(x),
            toggle: (x, force) => { (force ? set.add(x) : set.delete(x)); return set.has(x); }
        },
        has: x => set.has(x),
        all: () => [...set].sort()
    };
}

describe('SpriteAnim.setEnemyCategory', () => {
    test('swaps both category-* and zombie-* and keeps unrelated classes', () => {
        const el = fakeEl(['enemy', 'zombie-sprite', 'category-other', 'zombie-other', 'high-priority']);
        SpriteAnim.setEnemyCategory(el, 'career');
        expect(el.all()).toEqual(['category-career', 'enemy', 'high-priority', 'zombie-career', 'zombie-sprite']);
    });

    test('never strips zombie-sprite / zombie-subtask', () => {
        const el = fakeEl(['enemy', 'zombie-sprite', 'zombie-subtask', 'category-health', 'zombie-health']);
        SpriteAnim.setEnemyCategory(el, 'lifestyle');
        expect(el.has('zombie-sprite')).toBe(true);
        expect(el.has('zombie-subtask')).toBe(true);
        expect(el.has('zombie-health')).toBe(false);
        expect(el.has('zombie-lifestyle')).toBe(true);
    });

    test('cleans up even when several stale category classes are present', () => {
        const el = fakeEl(['category-other', 'zombie-other', 'category-career', 'zombie-career']);
        SpriteAnim.setEnemyCategory(el, 'financial');
        expect(el.all()).toEqual(['category-financial', 'zombie-financial']);
    });

    test('is a no-op for a missing element', () => {
        expect(() => SpriteAnim.setEnemyCategory(null, 'career')).not.toThrow();
    });
});

describe('RoutineViews.saveEditedTask syncs the live instance', () => {
    let RoutineViews, fields, deps, closed;

    beforeEach(() => {
        global.SpriteAnim = SpriteAnim;
        global.Schedule = require('../js/schedule.js');
        closed = false;
        global.Modal = { closeModal: () => { closed = true; } };
        fields = {
            editTaskName: { value: ' Pay rent ' },
            editTaskCategory: { value: 'financial' },
            editTaskDueTime: { value: '17:00' },
            editTaskHighPriority: { checked: true },
            editTaskFrequency: { value: 'daily' }
        };
        global.document = { getElementById: id => fields[id] || { checked: true, value: '' } };
        jest.resetModules();
        global.SpriteAnim = require('../js/spriteAnim.js');
        RoutineViews = require('../js/ui/routineViews.js');
    });

    afterEach(() => {
        delete global.document; delete global.Modal; delete global.Schedule; delete global.SpriteAnim;
    });

    function makeDeps(items) {
        return {
            editTaskInRoutine: jest.fn(),
            activeItems: items,
            createListItem: jest.fn(),
            sortAndRenderActiveList: jest.fn(),
            saveGame: jest.fn()
        };
    }

    test('updates name/category/priority, re-skins the zombie, rebuilds the row', () => {
        const el = fakeEl(['enemy', 'zombie-sprite', 'category-other', 'zombie-other']);
        const row = { remove: jest.fn() };
        const live = { type: 'task', definitionId: 't1', name: 'Old', category: 'other', isHighPriority: false, element: el, listItemElement: row };
        const sub = { type: 'task', definitionId: undefined, parentId: 5, category: 'other' };
        const otherTask = { type: 'task', definitionId: 't2', name: 'Keep', category: 'other' };
        deps = makeDeps([live, sub, otherTask]);

        RoutineViews.saveEditedTask('t1', deps);

        expect(live.name).toBe('Pay rent');
        expect(live.category).toBe('financial');
        expect(live.isHighPriority).toBe(true);
        expect(el.has('zombie-financial')).toBe(true);
        expect(el.has('zombie-other')).toBe(false);
        expect(el.has('high-priority')).toBe(true);
        expect(row.remove).toHaveBeenCalled();
        expect(deps.createListItem).toHaveBeenCalledWith(live);
        expect(deps.saveGame).toHaveBeenCalled();
        expect(otherTask.name).toBe('Keep');
        expect(sub.category).toBe('other');
        expect(closed).toBe(true);
    });

    test('with no live instance today it only saves the definition', () => {
        deps = makeDeps([]);
        RoutineViews.saveEditedTask('t1', deps);
        expect(deps.editTaskInRoutine).toHaveBeenCalled();
        expect(deps.createListItem).not.toHaveBeenCalled();
        expect(deps.saveGame).not.toHaveBeenCalled();
        expect(closed).toBe(true);
    });
});

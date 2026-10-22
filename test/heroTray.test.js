/**
 * HeroTray pure-core tests (docs/HERO_SPOTLIGHT_PLAN.md sub-session 3, 2026-10-21).
 * DOM functions (init/render/open/close) are live-checked in the browser, per this
 * suite's node-environment convention.
 */
global.Heroes = require('../js/heroes.js');
const CONFIG = require('../js/config.js');
global.HeroesView = require('../js/ui/heroes.js');
const HeroTray = require('../js/ui/heroTray.js');

const habitDefs = [
    { id: 'h1', routineId: 'r1', category: 'health' },
    { id: 'h2', routineId: 'r1', category: 'career', archivedAt: '2026-10-01' },
    { id: 'h3', routineId: null, category: 'health' },
];
const taskDefs = [{ id: 't1', category: 'financial' }, { id: 't2', category: 'career' }];
const baseRoutine = (extra) => Object.assign({
    id: 'r1', name: 'Study', level: 1, xp: 0, health: 100, isActive: true,
    frozenState: null, koState: null, boughtHabitSlots: 0, boughtTaskSlots: 0,
    habitDefinitionIds: ['h1', 'h2'], taskDefinitionIds: [], createdAt: 0,
}, extra);
const kinds = cells => cells.map(c => c.kind + (c.itemType ? ':' + c.itemType : ''));

describe('slotCells', () => {
    test('a level-1 routine with one habit: filled habit, open task slot, lock for Lv 2', () => {
        const cells = HeroTray.slotCells(baseRoutine(), habitDefs, taskDefs, CONFIG);
        expect(kinds(cells)).toEqual(['habit', 'empty:task', 'locked']);
        expect(cells[0]).toMatchObject({ category: 'health', frozen: false });
        expect(cells[2].level).toBe(2);
    });

    test('archived habits and other routines\' habits do not fill slots', () => {
        const defs = [
            { id: 'h2', routineId: 'r1', category: 'career', archivedAt: '2026-10-01' }, // archived: skipped
            { id: 'h9', routineId: 'rOther', category: 'health' },                       // someone else's: skipped
        ];
        const cells = HeroTray.slotCells(baseRoutine({ habitDefinitionIds: ['h2'] }), defs, taskDefs, CONFIG);
        expect(kinds(cells)).toEqual(['empty:habit', 'empty:task', 'locked']);
    });

    test('a habit listed in habitDefinitionIds counts even if its routineId is stale', () => {
        const defs = [{ id: 'h3', routineId: null, category: 'health' }];
        const cells = HeroTray.slotCells(baseRoutine({ habitDefinitionIds: ['h3'] }), defs, taskDefs, CONFIG);
        expect(kinds(cells)[0]).toBe('habit');
    });

    test('task members become filled task cells', () => {
        const cells = HeroTray.slotCells(baseRoutine({ taskDefinitionIds: ['t1'] }), habitDefs, taskDefs, CONFIG);
        expect(kinds(cells)).toEqual(['habit', 'task', 'locked']);
        expect(cells[1].category).toBe('financial');
    });

    test('unspent points show as dashed point cells and bought slots add capacity', () => {
        // level 4 = 3 points earned; 1 spent on a habit slot -> 2 unspent, habit capacity 2
        const r = baseRoutine({ level: 4, boughtHabitSlots: 1 });
        const cells = HeroTray.slotCells(r, habitDefs, taskDefs, CONFIG);
        expect(kinds(cells)).toEqual(['habit', 'empty:habit', 'empty:task', 'point', 'point', 'locked']);
        expect(cells[cells.length - 1].level).toBe(5);
    });

    test('a max-level routine has no lock preview', () => {
        const maxLevel = CONFIG.ROUTINE_MAX_SLOT_POINTS + 1;
        const cells = HeroTray.slotCells(baseRoutine({ level: maxLevel }), habitDefs, taskDefs, CONFIG);
        expect(kinds(cells)).not.toContain('locked');
    });

    test('the habit that froze the routine shows as a frozen cell', () => {
        const r = baseRoutine({ frozenState: { frozenBy: 'h1', frozenAt: 'x' } });
        expect(HeroTray.slotCells(r, habitDefs, taskDefs, CONFIG)[0]).toMatchObject({ kind: 'habit', frozen: true });
    });
});

describe('row view model, summary and tab model', () => {
    const ctx = { definedHabits: habitDefs, definedTasks: taskDefs, config: CONFIG, runStartedAtMs: 0 };
    const rowFor = (extra) => HeroTray.buildRowViewModel(baseRoutine(extra), ctx);

    test('buildRowViewModel wraps the chip view model with cells and points', () => {
        const row = rowFor({ level: 3, heroCategory: 'career' });
        expect(row.chip).toMatchObject({ id: 'r1', level: 3, heroCategory: 'career' });
        expect(row.points).toBe(2);
        expect(row.cells.length).toBeGreaterThan(0);
    });

    test('summarize: blue for unspent points, red for KO or health at/below the hurt threshold', () => {
        expect(HeroTray.summarize([rowFor({})], CONFIG)).toEqual({ hasOpenSlot: false, hasHurt: false });
        expect(HeroTray.summarize([rowFor({ level: 2 })], CONFIG).hasOpenSlot).toBe(true);
        expect(HeroTray.summarize([rowFor({ koState: { at: 1 }, health: 0 })], CONFIG).hasHurt).toBe(true);
        expect(HeroTray.summarize([rowFor({ health: CONFIG.ROUTINE_MAX_HEALTH * CONFIG.HERO_HURT_PCT })], CONFIG).hasHurt).toBe(true);
        expect(HeroTray.summarize([rowFor({ health: CONFIG.ROUTINE_MAX_HEALTH })], CONFIG).hasHurt).toBe(false);
    });

    test('tabModel: idle shows count + dots, a spotlit hero turns it into that hero\'s status', () => {
        const rows = [rowFor({ level: 2 })];
        expect(HeroTray.tabModel(rows, null, CONFIG)).toEqual({ mode: 'idle', count: 1, hasOpenSlot: true, hasHurt: false });
        const spot = HeroTray.tabModel(rows, 'r1', CONFIG);
        expect(spot).toMatchObject({ mode: 'spot', id: 'r1', name: 'Study', level: 2, health: 100, maxHealth: CONFIG.ROUTINE_MAX_HEALTH });
        // an id that no longer exists falls back to idle
        expect(HeroTray.tabModel(rows, 'gone', CONFIG).mode).toBe('idle');
    });

    test('signatures change only when something visible changes', () => {
        const a = rowFor({});
        expect(HeroTray.rowSignature(a)).toBe(HeroTray.rowSignature(rowFor({})));
        expect(HeroTray.rowSignature(a)).not.toBe(HeroTray.rowSignature(rowFor({ health: 90 })));
        expect(HeroTray.rowSignature(a)).not.toBe(HeroTray.rowSignature(rowFor({ level: 2 })));
        const t1 = HeroTray.tabModel([a], null, CONFIG);
        expect(HeroTray.tabSignature(t1)).toBe(HeroTray.tabSignature(HeroTray.tabModel([rowFor({})], null, CONFIG)));
        expect(HeroTray.tabSignature(t1)).not.toBe(HeroTray.tabSignature(HeroTray.tabModel([a], 'r1', CONFIG)));
    });
});

describe('shouldAutoOpenOnLevelUp', () => {
    test('first observation only seeds; a level rise with an unspent point opens once', () => {
        const memory = {};
        const r = { id: 'r1', level: 1 };
        expect(HeroTray.shouldAutoOpenOnLevelUp(memory, r, 0)).toBe(false);
        expect(HeroTray.shouldAutoOpenOnLevelUp(memory, { id: 'r1', level: 2 }, 1)).toBe(true);
        expect(HeroTray.shouldAutoOpenOnLevelUp(memory, { id: 'r1', level: 2 }, 1)).toBe(false);
    });

    test('a rise with no unspent point, or a drop, does not open', () => {
        const memory = { r1: 2 };
        expect(HeroTray.shouldAutoOpenOnLevelUp(memory, { id: 'r1', level: 3 }, 0)).toBe(false);
        expect(HeroTray.shouldAutoOpenOnLevelUp(memory, { id: 'r1', level: 2 }, 1)).toBe(false);
    });

    test('resetMemory exists for new runs', () => {
        expect(typeof HeroTray.resetMemory).toBe('function');
        expect(() => HeroTray.resetMemory()).not.toThrow();
    });
});

/**
 * Run-end carryover (2026-11-03, docs/RUN_CARRYOVER_PLAN.md): the pure rules in js/runCarryover.js,
 * State's best-slot high-water mark, the game-over card's "Next run" lists, the How-it-works topic,
 * and the script.js / shell wiring.
 */
const fs = require('fs');
const path = require('path');
const RunCarryover = require('../js/runCarryover.js');
const CONFIG = require('../js/config.js');

const task = (id, extra) => Object.assign({ id, type: 'task', definitionId: null, dueDateTime: new Date(2026, 10, 5, 9) }, extra);

describe('RunCarryover.isCarriedTask / openTasksToCarry', () => {
    test('keeps hand-typed tasks and their sub-tasks, in order', () => {
        const items = [task(1, { subTasks: [2] }), task(2, { parentId: 1 }), task(3)];
        expect(RunCarryover.openTasksToCarry(items).map(i => i.id)).toEqual([1, 2, 3]);
    });
    test('drops habit instances, routine task instances and KO ghosts', () => {
        const items = [
            { id: 1, type: 'habit', definitionId: 'h1' },
            { id: 2, type: 'task', definitionId: 'rt1' },      // routine task instance
            task(3, { koGhost: true }),
            task(4),
        ];
        expect(RunCarryover.openTasksToCarry(items).map(i => i.id)).toEqual([4]);
    });
    test('drops an orphan sub-task whose parent is not carried', () => {
        const items = [{ id: 7, type: 'task', definitionId: 'rt' }, task(8, { parentId: 7 }), task(9, { parentId: 99 })];
        expect(RunCarryover.openTasksToCarry(items)).toEqual([]);
    });
    test('tolerates junk input', () => {
        expect(RunCarryover.openTasksToCarry(null)).toEqual([]);
        expect(RunCarryover.isCarriedTask(null)).toBe(false);
        expect(RunCarryover.isCarriedTask({ type: 'task' })).toBe(true);
    });
});

describe('RunCarryover.detachForNewRun', () => {
    test('strips the old run\'s DOM refs and render cache, keeps the task itself', () => {
        const el = {}; const li = {};
        const t = task(1, { element: el, listItemElement: li, urgencyTier: 'urgent', isHighPriority: true, pushedLate: true });
        const out = RunCarryover.detachForNewRun(t);
        expect(out).toBe(t);
        expect(t.element).toBeNull();
        expect(t.listItemElement).toBeNull();
        expect(t.urgencyTier).toBeNull();
        expect(t.isHighPriority).toBe(true);
        expect(t.pushedLate).toBe(true);
        expect(t.dueDateTime).toEqual(new Date(2026, 10, 5, 9));
    });
    test('an overdue task loses its old damage clock (fresh clock in the new run)', () => {
        const t = task(1, { isOverdue: true, lastDamageTickTime: 123456 });
        RunCarryover.detachForNewRun(t);
        expect(t.lastDamageTickTime).toBeNull();
        expect(t.isOverdue).toBe(true);
        const u = task(2, { lastDamageTickTime: 5 });
        RunCarryover.detachForNewRun(u);
        expect(u.lastDamageTickTime).toBe(5);
    });
});

describe('RunCarryover.inventoryToKeep', () => {
    const catalog = [
        { id: 'repair_small', name: 'Repair Kit (Small)' },
        { id: 'relic', name: 'Relic', keptAcrossRuns: true },
    ];
    test('keeps only rows flagged keptAcrossRuns, with positive finite counts', () => {
        expect(RunCarryover.inventoryToKeep({ repair_small: 2, relic: 3, ghost: 1, bad: NaN }, catalog)).toEqual({ relic: 3 });
        expect(RunCarryover.inventoryToKeep({ relic: 0 }, catalog)).toEqual({});
    });
    test('with the real catalog nothing is kept today (no row has the flag)', () => {
        expect(CONFIG.SHOP_ITEMS.some(r => r.keptAcrossRuns)).toBe(false);
        const all = {}; CONFIG.SHOP_ITEMS.forEach(r => { all[r.id] = 2; });
        expect(RunCarryover.inventoryToKeep(all, CONFIG.SHOP_ITEMS)).toEqual({});
    });
    test('junk input is an empty inventory', () => {
        expect(RunCarryover.inventoryToKeep(null, catalog)).toEqual({});
        expect(RunCarryover.inventoryToKeep({ relic: 1 }, null)).toEqual({});
    });
});

describe('RunCarryover slots', () => {
    const table = CONFIG.ROUTINE_SLOTS_PER_LEVEL;
    test('sanitizeBestSlots: positive finite integers only', () => {
        expect(RunCarryover.sanitizeBestSlots(3)).toBe(3);
        expect(RunCarryover.sanitizeBestSlots(2.7)).toBe(2);
        expect(RunCarryover.sanitizeBestSlots(0)).toBe(0);
        expect(RunCarryover.sanitizeBestSlots(-1)).toBe(0);
        expect(RunCarryover.sanitizeBestSlots('4')).toBe(0);
        expect(RunCarryover.sanitizeBestSlots(undefined)).toBe(0);
    });
    test('slotsFor: the table value, never below the best ever held', () => {
        expect(RunCarryover.slotsFor(1, 0, table)).toBe(table[1]);
        expect(RunCarryover.slotsFor(1, 3, table)).toBe(3);
        expect(RunCarryover.slotsFor(7, 3, table)).toBe(table[7]); // 4 > 3
        expect(RunCarryover.slotsFor(5, 4, table)).toBe(4);        // best wins over Lv5's 3
        expect(RunCarryover.slotsFor(99, 0, table)).toBe(1);       // off the table = 1 (restore's old fallback)
        expect(RunCarryover.slotsFor(1, 'junk', table)).toBe(1);
    });
});

describe('RunCarryover.summary', () => {
    const catalog = [{ id: 'repair_small', name: 'Repair Kit (Small)' }, { id: 'relic', name: 'Relic', keptAcrossRuns: true }];
    test('counts open tasks and sub-tasks, kept items and the items that reset', () => {
        const s = RunCarryover.summary({
            activeItems: [task(1, { subTasks: [2] }), task(2, { parentId: 1 }), task(3), { id: 4, type: 'habit', definitionId: 'h' }],
            routineSlots: 3,
            inventory: { repair_small: 2, relic: 1, pushback_long: 1 },
            catalog,
        });
        expect(s).toEqual({
            openTasks: 2, openSubTasks: 1, routineSlots: 3,
            keptItems: [{ id: 'relic', name: 'Relic', count: 1 }],
            resetItems: 3,
            goals: 0,
        });
    });
    test('empty state is all zeros with at least one slot', () => {
        expect(RunCarryover.summary({})).toEqual({ openTasks: 0, openSubTasks: 0, routineSlots: 1, keptItems: [], resetItems: 0, goals: 0 });
    });
});

describe('State: bestRoutineSlots high-water mark', () => {
    let State;
    beforeAll(() => {
        global.CONFIG = CONFIG;
        global.RunCarryover = RunCarryover;
        global.DailyRecord = require('../js/dailyRecord.js');
        global.DayRollover = require('../js/dayRollover.js');
        global.Persistence = require('../js/persistence.js');
        global.RunStats = require('../js/runStats.js');
        State = require('../js/state.js');
        global.window = { definedTasks: [] };
    });
    afterAll(() => { delete global.window; delete global.CONFIG; delete global.RunCarryover; });
    beforeEach(() => { State.setBestRoutineSlots(0); State.setRoutineSlots(1); });

    test('setRoutineSlots raises the best, never lowers it', () => {
        State.setRoutineSlots(3);
        expect(State.getBestRoutineSlots()).toBe(3);
        State.setRoutineSlots(1);
        expect(State.getRoutineSlots()).toBe(1);
        expect(State.getBestRoutineSlots()).toBe(3);
    });
    test('setBestRoutineSlots sanitizes (restore of an old save without the field = 0)', () => {
        State.setBestRoutineSlots(undefined);
        expect(State.getBestRoutineSlots()).toBe(0);
        State.setBestRoutineSlots(2.5);
        expect(State.getBestRoutineSlots()).toBe(2);
    });
    test('slotsForLevel: a new run (level 1) starts at the best; a higher table value still wins', () => {
        expect(State.slotsForLevel(1)).toBe(CONFIG.ROUTINE_SLOTS_PER_LEVEL[1]);
        State.setBestRoutineSlots(3);
        expect(State.slotsForLevel(1)).toBe(3);
        expect(State.slotsForLevel(7)).toBe(CONFIG.ROUTINE_SLOTS_PER_LEVEL[7]);
    });
    test('it rides in getPersistableState as bestRoutineSlots (additive root field)', () => {
        State.setRoutineSlots(4);
        const saved = State.getPersistableState({});
        expect(saved.bestRoutineSlots).toBe(4);
        expect(saved.routineSlots).toBe(4);
    });
    test('state.js: initGame and restore both go through slotsForLevel; restore sets the best first', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'state.js'), 'utf8');
        expect(src).toContain('setRoutineSlots(slotsForLevel(1));');
        const best = src.indexOf('setBestRoutineSlots(save.bestRoutineSlots);');
        const live = src.indexOf('setRoutineSlots(slotsForLevel(restoredLevel));');
        expect(best).toBeGreaterThan(0);
        expect(live).toBeGreaterThan(best);
        expect(src).not.toContain('setRoutineSlots(CONFIG.ROUTINE_SLOTS_PER_LEVEL[');
    });
});

describe('GameOverView: the "Next run" lists', () => {
    let GameOverView;
    beforeAll(() => {
        global.StatsView = { buildBlameList: () => '<ul></ul>', buildTitleBadge: () => '' };
        GameOverView = require('../js/ui/gameOverView.js');
    });
    afterAll(() => { delete global.StatsView; });

    test('no carry summary = no section (older callers, damage tests)', () => {
        expect(GameOverView.buildCarryoverHtml(undefined)).toBe('');
        expect(GameOverView.buildReviewCardHtml(null, 3)).not.toContain('game-over-carry');
    });
    test('names the open tasks, the slots and the items that reset', () => {
        const html = GameOverView.buildCarryoverHtml({ openTasks: 2, openSubTasks: 1, routineSlots: 3, keptItems: [], resetItems: 4 });
        expect(html).toContain('You keep');
        expect(html).toContain('Starts over');
        expect(html).toContain('2 open tasks and 1 sub-task, with their due dates');
        expect(html).toContain('3 routine slots: you never start a run with fewer than your best');
        expect(html).toContain("4 held items from this run's points, level perks and village stars");
        expect(html).toContain('Church health, level, XP and points');
        expect(html).toContain('habits, routines and heroes');
        expect(html).toContain('Run history, achievements');
    });
    test('singulars, no tasks, no items, and a kept item', () => {
        const html = GameOverView.buildCarryoverHtml({ openTasks: 0, openSubTasks: 0, routineSlots: 1, keptItems: [{ id: 'relic', name: 'Relic <3', count: 2 }], resetItems: 0 });
        expect(html).toContain('Any open tasks you add before restarting');
        expect(html).toContain('1 routine slot:');
        expect(html).toContain('Items from points, level perks and village stars (you hold none)');
        expect(html).toContain('Relic &lt;3 x2 (kept until you use it)');
        const one = GameOverView.buildCarryoverHtml({ openTasks: 1, openSubTasks: 0, routineSlots: 2, keptItems: [], resetItems: 1 });
        expect(one).toContain('1 open task, with their due dates');
        expect(one).toContain('1 held item from');
    });
    test('renderReviewCard passes deps.carry through to the card', () => {
        const el = { innerHTML: '', classList: { add() {}, remove() {} } };
        GameOverView.renderReviewCard({ gameOverMessage: el, record: null, daysSurvived: 1, carry: { openTasks: 5, openSubTasks: 0, routineSlots: 2, keptItems: [], resetItems: 0 } });
        expect(el.innerHTML).toContain('5 open tasks');
        expect(el.innerHTML).toContain('game-over-carry');
    });
});

describe('wiring: script.js, shell and styles', () => {
    const root = path.join(__dirname, '..');
    const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

    test('the Restart button goes through startNextRun, which carries tasks, slots and kept items', () => {
        const script = read('script.js');
        expect(script).toContain("restartButton.addEventListener('click', startNextRun);");
        expect(script).toContain('RunCarryover.openTasksToCarry(State.getActiveItems()).map(RunCarryover.detachForNewRun)');
        expect(script).toContain('RunCarryover.inventoryToKeep(State.getPlayerInventory(), CONFIG.SHOP_ITEMS)');
        expect(script).toContain('State.setPlayerInventory(keptInventory);');
        expect(script).toContain('if (carried.length) State.setItemIdCounter(idCounter);');
        // the carried items are re-added AFTER initGame cleared the canvas
        const init = script.indexOf('        initGame();\n        if (carried.length)') >= 0
            ? script.indexOf('        initGame();\n        if (carried.length)')
            : script.indexOf('        initGame();\r\n        if (carried.length)');
        expect(init).toBeGreaterThan(0);
        expect(script.indexOf('deps.addItemToGame(item);', init)).toBeGreaterThan(init);
    });
    test('startNextRun re-sorts the agenda list after rebuilding parent rows (found live: the parent row went missing)', () => {
        const script = read('script.js').replace(/\r\n/g, '\n');
        const fn = script.slice(script.indexOf('function startNextRun()'));
        const rebuild = fn.indexOf('deps.createListItem(item);');
        const sort = fn.indexOf('deps.sortAndRenderActiveList();');
        expect(rebuild).toBeGreaterThan(0);
        expect(sort).toBeGreaterThan(rebuild);
        expect(sort).toBeLessThan(fn.indexOf('saveGame();'));
    });
    test('the game-over card gets the live carry summary; a dev Reset forgets the best slots', () => {
        const script = read('script.js');
        expect(script).toContain('carry: RunCarryover.summary({');
        expect(script).toContain('State.setBestRoutineSlots(0);');
    });
    test('js/runCarryover.js is a shell file, loaded before state.js, and the cache is bumped', () => {
        const html = read('index.html');
        const sw = read('sw.js');
        expect(html.indexOf('js/runCarryover.js')).toBeGreaterThan(html.indexOf('js/config.js'));
        expect(html.indexOf('js/runCarryover.js')).toBeLessThan(html.indexOf('js/state.js'));
        expect(sw).toContain("'js/runCarryover.js',");
        const v = parseInt((sw.match(/deadline-shell-v(\d+)/) || [])[1], 10);
        expect(v).toBeGreaterThanOrEqual(240);
    });
    test('runCarryover.js has no State / CONFIG / DOM reads (pure, like runStats.js)', () => {
        const src = read('js/runCarryover.js');
        expect(src).not.toMatch(/\bState\./);
        expect(src).not.toMatch(/\bCONFIG\./);
        expect(src).not.toMatch(/\bdocument\./);
    });
    test('the card styles ship in gameOverReview.css', () => {
        const css = read('css/gameOverReview.css');
        ['.game-over-carry', '.game-over-carry-label--kept', '.game-over-carry-list'].forEach(sel => expect(css).toContain(sel));
    });
});

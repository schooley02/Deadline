/**
 * LevelPanel pure-core tests (docs/LEVEL_PERKS_PLAN.md sub-session B, 2026-10-23).
 * open() is DOM and is live-checked in the browser, per this suite's node-environment convention.
 */
global.Heroes = require('../js/heroes.js');
const CONFIG = require('../js/config.js');
global.Progression = require('../js/progression.js');
global.HeroesView = require('../js/ui/heroes.js');
const LevelPanel = require('../js/ui/levelPanel.js');
const Hud = require('../js/ui/hud.js');

const routine = (extra) => Object.assign({
    id: 'r1', name: 'Study', level: 1, xp: 0, health: 100, isActive: true,
    frozenState: null, koState: null, habitDefinitionIds: [], taskDefinitionIds: [], createdAt: 0,
}, extra);
const ctxFor = (level, routines, extra) => Object.assign({
    level, xp: 0, thresholds: CONFIG.LEVEL_XP_THRESHOLDS, slotsTable: CONFIG.ROUTINE_SLOTS_PER_LEVEL,
    perksTable: CONFIG.LEVEL_PERKS, routines, definedHabits: [], config: CONFIG, runStartedAtMs: 0,
}, extra);
const kinds = (m) => m.pips.map(p => p.kind);

describe('xpModel', () => {
    test('shows XP into the current level over what the level needs', () => {
        // Lv2 spans 100..250 cumulative, so 190 XP is 90 / 150
        const m = LevelPanel.xpModel(190, CONFIG.LEVEL_XP_THRESHOLDS, 2);
        expect(m).toMatchObject({ into: 90, needed: 150, maxed: false, text: '90 / 150 XP' });
        expect(m.pct).toBeCloseTo(0.6);
    });
    test('max level reads "Max level" with the XP total and a full bar', () => {
        const m = LevelPanel.xpModel(3200, CONFIG.LEVEL_XP_THRESHOLDS, 9);
        expect(m).toMatchObject({ maxed: true, pct: 1, text: 'Max level · 3200 XP' });
    });
});

describe('slotsModel', () => {
    test('a fresh Lv-1 run: one open slot, then locked pips tagged with their unlock levels', () => {
        const m = LevelPanel.slotsModel(ctxFor(1, []));
        expect(kinds(m)).toEqual(['empty', 'locked', 'locked', 'locked']);
        expect(m.pips.filter(p => p.kind === 'locked').map(p => p.level)).toEqual([3, 5, 7]);
        expect(m).toMatchObject({ total: 1, used: 0, frozen: 0, ko: 0 });
        expect(m.next).toEqual({ level: 3, slots: 2 });
    });
    test('active routines fill slots; frozen keeps its slot and is its own state', () => {
        const m = LevelPanel.slotsModel(ctxFor(5, [routine({ id: 'a', name: 'A' }), routine({ id: 'b', name: 'B', frozenState: { frozenBy: 'h1' } })]));
        expect(kinds(m)).toEqual(['used', 'frozen', 'empty', 'locked']);
        expect(m).toMatchObject({ total: 3, used: 2, frozen: 1 });
        expect(m.pips[0]).toMatchObject({ routineId: 'a', name: 'A' });
    });
    test('a KO\'d routine shows as KO\'d in the free slot, not as empty, and does not count as used', () => {
        const m = LevelPanel.slotsModel(ctxFor(3, [routine({ id: 'a' }), routine({ id: 'k', isActive: false, koState: { at: 1 } })]));
        expect(kinds(m)).toEqual(['used', 'ko', 'locked', 'locked']);
        expect(m).toMatchObject({ total: 2, used: 1, ko: 1 });
    });
    test('an inactive (not KO\'d) routine does not occupy a slot', () => {
        const m = LevelPanel.slotsModel(ctxFor(3, [routine({ isActive: false })]));
        expect(kinds(m).slice(0, 2)).toEqual(['empty', 'empty']);
        expect(m.used).toBe(0);
    });
    test('max level: every slot unlocked, no locked pips, no next unlock', () => {
        const m = LevelPanel.slotsModel(ctxFor(9, [routine()]));
        expect(kinds(m)).toEqual(['used', 'empty', 'empty', 'empty']);
        expect(m.total).toBe(4);
        expect(m.next).toBeNull();
    });
    test('never shows more occupied pips than slots', () => {
        const m = LevelPanel.slotsModel(ctxFor(1, [routine({ id: 'a' }), routine({ id: 'b' })]));
        expect(m.pips.filter(p => p.kind === 'used').length).toBe(1);
    });
});

describe('slotsSummary', () => {
    test('"Routines 3/4 · 1 frozen"', () => {
        const m = LevelPanel.slotsModel(ctxFor(7, [routine({ id: 'a' }), routine({ id: 'b' }), routine({ id: 'c', frozenState: { frozenBy: 'x' } })]));
        expect(LevelPanel.slotsSummary(m)).toBe('Routines 3/4 · 1 frozen');
    });
    test('plain and with a KO\'d routine', () => {
        expect(LevelPanel.slotsSummary(LevelPanel.slotsModel(ctxFor(1, [])))).toBe('Routines 0/1');
        const ko = LevelPanel.slotsModel(ctxFor(3, [routine({ isActive: false, koState: { at: 1 } })]));
        expect(LevelPanel.slotsSummary(ko)).toBe("Routines 0/2 · 1 KO'd");
    });
});

describe('perksModel', () => {
    test('current = this level\'s perks; next = the following two levels', () => {
        const p = LevelPanel.perksModel(CONFIG.LEVEL_PERKS, 3, 2);
        expect(p.current.map(x => x.label)).toEqual(['2nd routine slot']);
        expect(p.next.map(x => x.level)).toEqual([4, 5]);
        expect(p.discount).toBe(0);
        expect(p.title).toBeNull();
    });
    test('an earlier discount stays reported as active with the level that granted it', () => {
        const p = LevelPanel.perksModel(CONFIG.LEVEL_PERKS, 6, 2);
        expect(p.discount).toBe(0.10);
        expect(p.discountLevel).toBe(4);
        const p8 = LevelPanel.perksModel(CONFIG.LEVEL_PERKS, 8, 2);
        expect(p8.discount).toBe(0.20);
        expect(p8.discountLevel).toBe(8);
    });
    test('max level: nothing coming up, Steward title earned', () => {
        const p = LevelPanel.perksModel(CONFIG.LEVEL_PERKS, 9, 2);
        expect(p.next).toEqual([]);
        expect(p.title).toMatchObject({ value: 'Steward of the Church', level: 9 });
        expect(p.current.map(x => x.type)).toEqual(['item', 'title']);
    });
});

describe('panelHtml', () => {
    test('renders level, XP text, slot pips (with "+" only on empty) and perk rows', () => {
        const html = LevelPanel.panelHtml(LevelPanel.buildModel(ctxFor(3, [routine({ id: 'a', name: 'Study' })], { xp: 300 })));
        expect(html).toContain('Level 3');
        expect(html).toContain('50 / 250 XP'); // Lv3 spans 250..500
        expect(html).toContain('data-action="manage"');
        expect(html).toContain('data-action="create"');
        expect(html).toContain('Lv 5');
        expect(html).toContain('Coming up');
        expect(html).not.toMatch(/level-button/);
    });
    test('escapes routine names', () => {
        const html = LevelPanel.panelHtml(LevelPanel.buildModel(ctxFor(1, [routine({ name: '<img src=x onerror=1>' })])));
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;img src=x');
    });
    test('KO\'d pip is not a button (nothing to open) and says it revives tomorrow', () => {
        const html = LevelPanel.panelHtml(LevelPanel.buildModel(ctxFor(3, [routine({ isActive: false, koState: { at: 1 } })])));
        expect(html).toContain('Revives tomorrow');
        expect(html).toMatch(/<span class="lp-pip lp-pip--ko"/);
    });
    test('max level shows the Steward title row and no "Coming up"', () => {
        const html = LevelPanel.panelHtml(LevelPanel.buildModel(ctxFor(9, [], { xp: 3100 })));
        expect(html).toContain('Steward of the Church');
        expect(html).toContain('Max level');
        expect(html).not.toContain('Coming up');
    });
});

describe('Hud.xpFraction / level button', () => {
    global.Progression = require('../js/progression.js');
    test('fraction through the current level; full at max; 0 without thresholds', () => {
        expect(Hud.xpFraction(175, CONFIG.LEVEL_XP_THRESHOLDS, 2)).toBeCloseTo(0.5);
        expect(Hud.xpFraction(5000, CONFIG.LEVEL_XP_THRESHOLDS, 9)).toBe(1);
        expect(Hud.xpFraction(10, null, 1)).toBe(0);
    });
    test('updatePlayerDisplays sets the bar width and the button aria-label', () => {
        const bar = { style: {} };
        const button = { _attrs: {}, setAttribute(k, v) { this._attrs[k] = v; } };
        Hud.updatePlayerDisplays({
            playerXP: 175, playerLevel: 2, playerPoints: 0, pointsPerTask: 5,
            playerLevelDisplay: { textContent: '' }, playerPointsDisplay: { textContent: '' },
            playerXpBar: bar, levelButton: button, xpThresholds: CONFIG.LEVEL_XP_THRESHOLDS,
        });
        expect(bar.style.width).toBe('50%');
        expect(button._attrs['aria-label']).toBe('Level 2, 175 XP. Open level panel');
    });
});

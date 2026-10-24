/**
 * Level perks tests — LEVEL_PERKS_PLAN.md sub-session A (2026-10-23).
 *
 * Covers: the pure Progression helpers (perksForLevels, shopDiscount,
 * titleForLevel, xpProgress, nextSlotUnlock), CONFIG.LEVEL_PERKS table
 * integrity (the balance red lines are pinned here on purpose), the
 * discounted Economy/Shop pricing, Shop.grant, peakPlayerLevel on run
 * records, the Steward title badge, the level-up toast, and the composed
 * level-up -> gifts flow (script.js's checkPlayerLevelUp isn't loaded by
 * Jest, so the pure pieces it composes are exercised together here).
 */
global.Economy = require('../js/economy.js');
const Progression = require('../js/progression.js');
const Shop = require('../js/shop.js');
const RunStats = require('../js/runStats.js');
const CONFIG = require('../js/config.js');
global.Progression = Progression;
global.CONFIG = CONFIG;
const StatsView = require('../js/ui/statsView.js');
global.StatsView = StatsView;
const GameOverView = require('../js/ui/gameOverView.js');
const Hud = require('../js/ui/hud.js');

const PERKS = CONFIG.LEVEL_PERKS;
const MAX_LEVEL = CONFIG.LEVEL_XP_THRESHOLDS.length;

describe('CONFIG.LEVEL_PERKS — table integrity and balance red lines', () => {
    test('every level 1..max grants at least one perk with a label', () => {
        for (let lv = 1; lv <= MAX_LEVEL; lv++) {
            expect(Array.isArray(PERKS[lv])).toBe(true);
            expect(PERKS[lv].length).toBeGreaterThan(0);
            PERKS[lv].forEach(p => expect(typeof p.label).toBe('string'));
        }
    });

    test('item perks name real HELD (consumable) shop items', () => {
        Object.values(PERKS).flat().filter(p => p.type === 'item').forEach(p => {
            const item = Shop.getItem(p.itemId, CONFIG.SHOP_ITEMS);
            expect(item).toBeDefined();
            expect(item.consumable).toBe(true);
            expect(p.count).toBeGreaterThan(0);
        });
    });

    test('RED LINE: no gifted item costs 200+ pts before max level; gifts below max are <= 50 pts', () => {
        for (let lv = 1; lv < MAX_LEVEL; lv++) {
            PERKS[lv].filter(p => p.type === 'item').forEach(p => {
                expect(Shop.getItem(p.itemId, CONFIG.SHOP_ITEMS).baseCost * p.count).toBeLessThanOrEqual(50);
            });
        }
    });

    test('slot perks agree with ROUTINE_SLOTS_PER_LEVEL (labels cannot drift from the real table)', () => {
        Object.keys(PERKS).forEach(k => {
            PERKS[k].filter(p => p.type === 'slot').forEach(p => {
                expect(CONFIG.ROUTINE_SLOTS_PER_LEVEL[k]).toBe(p.value);
            });
        });
    });

    test('discounts are fractions in (0,1) and only ever increase with level', () => {
        let last = 0;
        Object.keys(PERKS).map(Number).sort((a, b) => a - b).forEach(lv => {
            PERKS[lv].filter(p => p.type === 'discount').forEach(p => {
                expect(p.value).toBeGreaterThan(0);
                expect(p.value).toBeLessThan(1);
                expect(p.value).toBeGreaterThan(last);
                last = p.value;
            });
        });
    });

    test('BUG GUARD: ROUTINE_SLOTS_PER_LEVEL has an entry for EVERY level (restore uses table[level] || 1) and never decreases', () => {
        let last = 0;
        for (let lv = 1; lv <= MAX_LEVEL; lv++) {
            expect(CONFIG.ROUTINE_SLOTS_PER_LEVEL[lv]).toBeGreaterThanOrEqual(last || 1);
            last = CONFIG.ROUTINE_SLOTS_PER_LEVEL[lv];
        }
        expect(CONFIG.ROUTINE_SLOTS_PER_LEVEL[MAX_LEVEL]).toBe(4);
    });

    test('the max level carries the Steward title', () => {
        const title = PERKS[MAX_LEVEL].find(p => p.type === 'title');
        expect(title.value).toBe('Steward of the Church');
    });
});

describe('perksForLevels', () => {
    test('a single level-up returns that level\'s perks, tagged with the level', () => {
        const perks = Progression.perksForLevels(PERKS, 1, 2);
        expect(perks).toHaveLength(1);
        expect(perks[0]).toMatchObject({ type: 'item', itemId: 'repair_small', level: 2 });
    });

    test('a multi-level jump pays out EVERY level crossed, in order', () => {
        const perks = Progression.perksForLevels(PERKS, 1, 4);
        expect(perks.map(p => p.level)).toEqual([2, 3, 4]);
        expect(perks.map(p => p.type)).toEqual(['item', 'slot', 'discount']);
    });

    test('same level / lower level / missing table -> nothing', () => {
        expect(Progression.perksForLevels(PERKS, 3, 3)).toEqual([]);
        expect(Progression.perksForLevels(PERKS, 5, 2)).toEqual([]);
        expect(Progression.perksForLevels(null, 1, 9)).toEqual([]);
    });

    test('does not mutate the config table', () => {
        const before = JSON.stringify(PERKS);
        Progression.perksForLevels(PERKS, 1, MAX_LEVEL);
        expect(JSON.stringify(PERKS)).toBe(before);
    });

    test('max level pays the Sick Day token AND the title', () => {
        const perks = Progression.perksForLevels(PERKS, MAX_LEVEL - 1, MAX_LEVEL);
        expect(perks.map(p => p.type).sort()).toEqual(['item', 'title']);
        expect(perks.find(p => p.type === 'item').itemId).toBe('sick_day');
    });
});

describe('shopDiscount — derived from level, replaces (never stacks)', () => {
    test.each([
        [1, 0], [2, 0], [3, 0],
        [4, 0.10], [5, 0.10], [7, 0.10],
        [8, 0.20], [9, 0.20],
    ])('level %i -> %f', (level, expected) => {
        expect(Progression.shopDiscount(PERKS, level)).toBeCloseTo(expected, 10);
    });

    test('missing table -> 0', () => {
        expect(Progression.shopDiscount(null, 9)).toBe(0);
        expect(Progression.shopDiscount(undefined, 9)).toBe(0);
    });

    test('a higher-level discount wins even if listed after a lower one in key order', () => {
        const table = { 2: [{ type: 'discount', value: 0.5 }], 10: [{ type: 'discount', value: 0.1 }] };
        expect(Progression.shopDiscount(table, 10)).toBeCloseTo(0.1, 10);
        expect(Progression.shopDiscount(table, 5)).toBeCloseTo(0.5, 10);
    });
});

describe('titleForLevel', () => {
    test('null below the title level, Steward at max', () => {
        expect(Progression.titleForLevel(PERKS, MAX_LEVEL - 1)).toBeNull();
        const t = Progression.titleForLevel(PERKS, MAX_LEVEL);
        expect(t.value).toBe('Steward of the Church');
        expect(t.level).toBe(MAX_LEVEL);
    });

    test('non-number / missing table -> null (old run records have no peakPlayerLevel)', () => {
        expect(Progression.titleForLevel(PERKS, undefined)).toBeNull();
        expect(Progression.titleForLevel(PERKS, null)).toBeNull();
        expect(Progression.titleForLevel(null, 9)).toBeNull();
    });
});

describe('xpProgress', () => {
    const T = CONFIG.LEVEL_XP_THRESHOLDS; // [0,100,250,500,...]

    test('level 1: spans 0..100', () => {
        expect(Progression.xpProgress(40, T, 1)).toEqual({ into: 40, needed: 100, pct: 0.4, maxed: false });
    });

    test('level 2: spans 100..250 (cumulative thresholds)', () => {
        expect(Progression.xpProgress(175, T, 2)).toEqual({ into: 75, needed: 150, pct: 0.5, maxed: false });
    });

    test('exactly on the floor is 0%, never negative; overshoot clamps to 100%', () => {
        expect(Progression.xpProgress(100, T, 2).into).toBe(0);
        expect(Progression.xpProgress(50, T, 2).into).toBe(0);
        expect(Progression.xpProgress(9999, T, 2).pct).toBe(1);
    });

    test('max level -> full bar, nothing needed', () => {
        expect(Progression.xpProgress(5000, T, MAX_LEVEL)).toEqual({ into: 0, needed: 0, pct: 1, maxed: true });
    });
});

describe('nextSlotUnlock / slotsAtLevel', () => {
    const S = CONFIG.ROUTINE_SLOTS_PER_LEVEL;

    test('from level 1 the next slot is the 2nd, at level 3', () => {
        expect(Progression.nextSlotUnlock(S, 1)).toEqual({ level: 3, slots: 2 });
        expect(Progression.nextSlotUnlock(S, 2)).toEqual({ level: 3, slots: 2 });
    });

    test('skips levels that add nothing', () => {
        expect(Progression.nextSlotUnlock(S, 3)).toEqual({ level: 5, slots: 3 });
        expect(Progression.nextSlotUnlock(S, 5)).toEqual({ level: 7, slots: 4 });
    });

    test('no further unlock once the 4th slot is held', () => {
        expect(Progression.nextSlotUnlock(S, 7)).toBeNull();
        expect(Progression.nextSlotUnlock(S, MAX_LEVEL)).toBeNull();
    });

    test('slotsAtLevel carries the last value forward past the table end', () => {
        expect(Progression.slotsAtLevel({ 1: 1, 3: 2 }, 6)).toBe(2);
        expect(Progression.slotsAtLevel({}, 4)).toBe(1);
    });
});

describe('Economy.shopPrice / Shop.price with a discount', () => {
    test('no discount (omitted or 0) is byte-identical to the pre-perk formula', () => {
        expect(Economy.shopPrice(25, 1)).toBe(38);
        expect(Economy.shopPrice(25, 1, 0)).toBe(38);
        expect(Economy.shopPrice(25, 1, undefined)).toBe(38);
    });

    test('discount multiplies the price, rounded once at the end', () => {
        expect(Economy.shopPrice(200, 0, 0.2)).toBe(160);
        expect(Economy.shopPrice(25, 0, 0.1)).toBe(23);     // 22.5 -> 23
        expect(Economy.shopPrice(25, 1, 0.1)).toBe(34);     // 37.5 * 0.9 = 33.75 -> 34 (not 38 * 0.9)
        expect(Economy.shopPrice(300, 0, 0.2)).toBe(240);
    });

    test('a discounted item is never free', () => {
        expect(Economy.shopPrice(1, 0, 0.99)).toBe(1);
        expect(Economy.shopPrice(1, 0, 1)).toBe(1);
    });

    test('Shop.price / canAfford / purchase all honour the discount', () => {
        const kit = Shop.getItem('repair_small', CONFIG.SHOP_ITEMS); // base 25
        expect(Shop.price(kit, {}, 0.2)).toBe(20);
        expect(Shop.canAfford(kit, {}, 20, 0.2)).toBe(true);
        expect(Shop.canAfford(kit, {}, 20)).toBe(false);          // undiscounted: 25
        const bought = Shop.purchase('repair_small', CONFIG.SHOP_ITEMS, {}, 100, 0.2);
        expect(bought.ok).toBe(true);
        expect(bought.cost).toBe(20);
        expect(bought.newPoints).toBe(80);
    });

    test('pushback is discounted too (the popup uses Shop.price with {} inventory)', () => {
        const pb = Shop.getItem('pushback_1day', CONFIG.SHOP_ITEMS); // base 300
        expect(Shop.price(pb, {}, 0.2)).toBe(240);
        expect(Shop.price(pb, {})).toBe(300);
    });
});

describe('Shop.grant', () => {
    test('adds to the held count without mutating the input inventory', () => {
        const inv = { repair_small: 1 };
        const g = Shop.grant('repair_small', 2, CONFIG.SHOP_ITEMS, inv);
        expect(g.ok).toBe(true);
        expect(g.newInventory).toEqual({ repair_small: 3 });
        expect(inv).toEqual({ repair_small: 1 });
    });

    test('works from an empty inventory', () => {
        expect(Shop.grant('sick_day', 1, CONFIG.SHOP_ITEMS, {}).newInventory).toEqual({ sick_day: 1 });
    });

    test('refuses pushback (instant, can\'t be held), unknown ids and non-positive counts', () => {
        const inv = { repair_small: 1 };
        [['pushback_1hr', 1], ['nope', 1], ['repair_small', 0], ['repair_small', -3]].forEach(([id, n]) => {
            const g = Shop.grant(id, n, CONFIG.SHOP_ITEMS, inv);
            expect(g.ok).toBe(false);
            expect(g.newInventory).toBe(inv);
        });
    });

    test('a gifted item raises the NEXT purchase price like any held item (1.5^held)', () => {
        const g = Shop.grant('repair_small', 1, CONFIG.SHOP_ITEMS, {});
        const kit = Shop.getItem('repair_small', CONFIG.SHOP_ITEMS);
        expect(Shop.price(kit, g.newInventory)).toBe(38);
    });
});

describe('composed level-up flow (what script.js checkPlayerLevelUp does)', () => {
    function levelUp(level, xp, inventory) {
        const result = Progression.checkLevelUp(
            { level, xp, slots: CONFIG.ROUTINE_SLOTS_PER_LEVEL[level] },
            CONFIG.LEVEL_XP_THRESHOLDS, CONFIG.ROUTINE_SLOTS_PER_LEVEL, MAX_LEVEL
        );
        const labels = [];
        let inv = inventory;
        Progression.perksForLevels(PERKS, level, result.level).forEach(perk => {
            if (perk.type === 'item') {
                const g = Shop.grant(perk.itemId, perk.count, CONFIG.SHOP_ITEMS, inv);
                if (!g.ok) return;
                inv = g.newInventory;
            }
            if (perk.label) labels.push(perk.label);
        });
        return { result, labels, inv };
    }

    test('Lv1 -> Lv2: a small repair kit lands in inventory and is named', () => {
        const { result, labels, inv } = levelUp(1, 100, {});
        expect(result.level).toBe(2);
        expect(inv).toEqual({ repair_small: 1 });
        expect(labels).toEqual(['Repair Kit (Small) ×1']);
    });

    test('Lv1 -> Lv4 in one award pays Lv2 + Lv3 + Lv4 and the discount applies at once', () => {
        const { result, labels, inv } = levelUp(1, 500, {});
        expect(result.level).toBe(4);
        expect(inv).toEqual({ repair_small: 1 });
        expect(labels).toEqual(['Repair Kit (Small) ×1', '2nd routine slot', '10% off the shop']);
        expect(Progression.shopDiscount(PERKS, result.level)).toBeCloseTo(0.1, 10);
    });

    test('Lv8 -> Lv9: Sick Day token + title', () => {
        const { result, labels, inv } = levelUp(8, 3000, { repair_small: 1 });
        expect(result.level).toBe(9);
        expect(inv).toEqual({ repair_small: 1, sick_day: 1 });
        expect(labels).toEqual(['Sick Day token ×1', 'Title: Steward of the Church']);
    });

    test('no level crossed -> no perks (and re-crossing after an XP refund can\'t re-pay: level never drops)', () => {
        const first = levelUp(2, 120, {});
        expect(first.labels).toEqual([]);
        // Already at level 2: XP dipping under 100 then back over it crosses nothing.
        const again = levelUp(2, 105, {});
        expect(again.result.leveledUp).toBe(false);
        expect(again.inv).toEqual({});
    });
});

describe('gameOver wiring: damage deps expose the player level (found live 2026-10-23)', () => {
    // Jest never loads script.js, and Damage.gameOver gets its deps from
    // State.buildDamageDeps — NOT script.js's stateDeps. peakPlayerLevel was
    // silently undefined on real game overs until getPlayerLevel was added here.
    test('State.buildDamageDeps exposes a live getPlayerLevel', () => {
        global.DayRollover = require('../js/dayRollover.js');
        const State = require('../js/state.js');
        const deps = State.buildDamageDeps({});
        expect(typeof deps.getPlayerLevel).toBe('function');
        State.setPlayerLevel(7);
        expect(deps.getPlayerLevel()).toBe(7);
        State.setPlayerLevel(9);
        expect(deps.getPlayerLevel()).toBe(9);
    });
});

describe('peakPlayerLevel on run records', () => {
    const ctx = { runNumber: 1, startedAtMs: 1, endedAtMs: 2, daysSurvived: 3, definedRoutines: [], definedHabits: [] };

    test('recorded when the caller supplies the level', () => {
        expect(RunStats.finalizeRun(RunStats.freshRunStats(), { ...ctx, playerLevel: 9 }).peakPlayerLevel).toBe(9);
    });

    test('omitted (key absent) when no level is supplied — old call sites keep their exact shape', () => {
        const rec = RunStats.finalizeRun(RunStats.freshRunStats(), ctx);
        expect('peakPlayerLevel' in rec).toBe(false);
        const rec2 = RunStats.finalizeRun(RunStats.freshRunStats(), { ...ctx, playerLevel: undefined });
        expect('peakPlayerLevel' in rec2).toBe(false);
    });
});

describe('Steward title badge — past-run card and game-over card', () => {
    const base = {
        runNumber: 4, startedAtMs: 1750000000000, endedAtMs: 1750100000000, daysSurvived: 44,
        endReason: 'base_destroyed',
        totals: { tasksCompleted: 5, habitsCompleted: 6, habitsMissed: 1, pointsEarned: 7 },
        blame: [], routines: [],
    };

    test('max-level run shows the title on its past-run card', () => {
        const html = StatsView.buildRunCard({ ...base, peakPlayerLevel: 9 }, false);
        expect(html).toContain('stats-run-card-title-badge');
        expect(html).toContain('Steward of the Church');
    });

    test('below max level, or an old record without the field, shows no title', () => {
        expect(StatsView.buildRunCard({ ...base, peakPlayerLevel: 8 }, false)).not.toContain('Steward');
        expect(StatsView.buildRunCard(base, false)).not.toContain('Steward');
    });

    test('title sits beside the Best-run badge, not instead of it', () => {
        const html = StatsView.buildRunCard({ ...base, peakPlayerLevel: 9 }, true);
        expect(html).toContain('Best run');
        expect(html).toContain('Steward of the Church');
    });

    test('game-over review card shows the title line only for a max-level run', () => {
        expect(GameOverView.buildReviewCardHtml({ ...base, peakPlayerLevel: 9 }, 44)).toContain('game-over-title');
        expect(GameOverView.buildReviewCardHtml({ ...base, peakPlayerLevel: 5 }, 44)).not.toContain('game-over-title');
        expect(GameOverView.buildReviewCardHtml(null, 3)).not.toContain('game-over-title');
    });

    test('badge helper returns empty string without Progression/CONFIG globals (pure-module use)', () => {
        const savedP = global.Progression;
        delete global.Progression;
        expect(StatsView.buildTitleBadge({ peakPlayerLevel: 9 }, 'x')).toBe('');
        global.Progression = savedP;
    });
});

describe('Hud.showLevelUpMessage — toast names the perks', () => {
    function fakeEl() {
        const classes = new Set(['hidden']);
        return {
            textContent: '', innerHTML: '', style: {},
            classList: { add: c => classes.add(c), remove: c => classes.delete(c), has: c => classes.has(c) },
        };
    }

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('no perks: original "LEVEL N!" text and 2.5 s timing', () => {
        const el = fakeEl();
        Hud.showLevelUpMessage({ playerLevel: 3, levelUpMessage: el });
        expect(el.textContent).toBe('LEVEL 3!');
        expect(el.style.animationDuration).toBe('2500ms');
        expect(el.classList.has('hidden')).toBe(false);
        jest.advanceTimersByTime(2500);
        expect(el.classList.has('hidden')).toBe(true);
    });

    test('empty perkLabels array behaves like no perks', () => {
        const el = fakeEl();
        Hud.showLevelUpMessage({ playerLevel: 3, levelUpMessage: el, perkLabels: [] });
        expect(el.textContent).toBe('LEVEL 3!');
        expect(el.style.animationDuration).toBe('2500ms');
    });

    test('with perks: one line per perk, longer toast', () => {
        const el = fakeEl();
        Hud.showLevelUpMessage({ playerLevel: 2, levelUpMessage: el, perkLabels: ['Repair Kit (Small) ×1'] });
        expect(el.innerHTML).toContain('LEVEL 2!');
        expect(el.innerHTML).toContain('level-up-perk');
        expect(el.innerHTML).toContain('Repair Kit (Small) ×1');
        expect(el.style.animationDuration).toBe('5000ms');
        jest.advanceTimersByTime(2500);
        expect(el.classList.has('hidden')).toBe(false);
        jest.advanceTimersByTime(2500);
        expect(el.classList.has('hidden')).toBe(true);
    });

    test('labels are HTML-escaped', () => {
        const el = fakeEl();
        Hud.showLevelUpMessage({ playerLevel: 2, levelUpMessage: el, perkLabels: ['<b>x</b> & y'] });
        expect(el.innerHTML).not.toContain('<b>x</b>');
        expect(el.innerHTML).toContain('&lt;b&gt;x&lt;/b&gt; &amp; y');
    });

    test('missing element is a no-op', () => {
        expect(() => Hud.showLevelUpMessage({ playerLevel: 2, levelUpMessage: null, perkLabels: ['x'] })).not.toThrow();
    });
});

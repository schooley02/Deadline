/**
 * RoutineViews — banked slot points ([P1-UI-006] sub-session 4, 2026-07-19):
 * ensureRoutineSlotAvailable (the shared add-gating helper), buildStatusRowHtml
 * (KO-aware status row), and buildHeroStatsHtml (level/XP/stars/health/slot
 * usage block) in the "Manage Routine" modal. All three are pure enough to
 * unit-test without a DOM (no `document` calls) — same convention as
 * test/routine-views-frozen-banner.test.js's buildFrozenBannerHtml. Node binds
 * routineViews.js's bare-global collaborators (CONFIG, Heroes, HeroesView,
 * DayRollover) before requiring it, matching every other js/ui/* test file.
 */
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.HeroesView = require('../js/ui/heroes.js');
global.DayRollover = require('../js/dayRollover.js');
const CONFIG = require('../js/config.js');
const RoutineViews = require('../js/ui/routineViews.js');

function routine(overrides = {}) {
    return {
        id: 'r1',
        name: 'Morning Ritual',
        habitDefinitionIds: [],
        taskDefinitionIds: [],
        isActive: true,
        frozenState: null,
        koState: null,
        xp: 0,
        level: 1,
        health: CONFIG.ROUTINE_MAX_HEALTH,
        createdAt: Date.now(),
        boughtHabitSlots: 0,
        boughtTaskSlots: 0,
        ...overrides,
    };
}

describe('buildStatusRowHtml', () => {
    test('active routine shows the Active status and a Deactivate button', () => {
        const html = RoutineViews.buildStatusRowHtml(routine({ isActive: true }));
        expect(html).toContain('Active');
        expect(html).toContain('Deactivate');
        expect(html).not.toContain('disabled');
    });

    test('inactive, non-KO routine shows Inactive and an Activate button', () => {
        const html = RoutineViews.buildStatusRowHtml(routine({ isActive: false }));
        expect(html).toContain('Inactive');
        expect(html).toContain('Activate');
        expect(html).not.toContain('Deactivate');
    });

    test('a KO\'d routine not yet past the calendar day shows "revives tomorrow" and a disabled Revive button', () => {
        const r = routine({ isActive: false, koState: { koAt: Date.now() } });
        const html = RoutineViews.buildStatusRowHtml(r);
        expect(html).toContain('revives tomorrow');
        expect(html).toContain('Revive');
        expect(html).toContain('disabled');
    });

    test('a KO\'d routine past the calendar day shows "ready to revive" and an enabled Revive button', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const r = routine({ isActive: false, koState: { koAt: yesterday.getTime() } });
        const html = RoutineViews.buildStatusRowHtml(r);
        expect(html).toContain('ready to revive');
        expect(html).not.toContain('disabled');
    });

    test('a frozen (not KO\'d) routine mentions Frozen rather than Inactive', () => {
        const r = routine({ isActive: false, frozenState: { frozenBy: 'h1', frozenAt: 'x' } });
        const html = RoutineViews.buildStatusRowHtml(r);
        expect(html).toContain('Frozen');
        expect(html).not.toContain('⚪ Inactive');
    });
});

describe('buildHeroStatsHtml', () => {
    test('shows the current level and XP progress toward the next threshold', () => {
        const T = CONFIG.ROUTINE_LEVEL_XP_THRESHOLDS;
        const r = routine({ level: 2, xp: T[1] + 3 });
        const html = RoutineViews.buildHeroStatsHtml(r, [], 0);
        expect(html).toContain('Lv2');
        expect(html).toContain(`${T[1] + 3} / ${T[2]} XP`);
    });

    test('a max-level routine reports "max level" instead of a next threshold', () => {
        const T = CONFIG.ROUTINE_LEVEL_XP_THRESHOLDS;
        const r = routine({ level: T.length, xp: 999999 });
        const html = RoutineViews.buildHeroStatsHtml(r, [], 0);
        expect(html).toContain('max level');
    });

    test('shows habit/task slot usage against current capacity', () => {
        const r = routine({
            habitDefinitionIds: ['h1'],
            taskDefinitionIds: [],
            boughtHabitSlots: 1,
            boughtTaskSlots: 0,
        });
        const html = RoutineViews.buildHeroStatsHtml(r, [], 0);
        // 1 used / (baseline 1 + bought 1) = 2 habit slots
        expect(html).toContain(`Habit slots: 1/${CONFIG.ROUTINE_HABIT_SLOTS_BASE + 1}`);
        expect(html).toContain(`Task slots: 0/${CONFIG.ROUTINE_TASK_SLOTS_BASE}`);
    });

    test('mentions available slot points when the routine has any banked', () => {
        const r = routine({ level: 3, boughtHabitSlots: 0, boughtTaskSlots: 0 });
        const html = RoutineViews.buildHeroStatsHtml(r, [], 0);
        expect(html).toContain('2 slot points available');
    });

    test('omits the slot-points note when none are available', () => {
        const r = routine({ level: 1 });
        const html = RoutineViews.buildHeroStatsHtml(r, [], 0);
        expect(html).not.toContain('slot point');
    });

    // Sub-session 5: real-time completion % beside the star row.
    test('shows "(unrated)" beside the stars when no occurrences are recorded', () => {
        const r = routine();
        const html = RoutineViews.buildHeroStatsHtml(r, [], 0);
        expect(html).toContain('(unrated)');
    });

    // 2026-07-21: label also carries the distinct-days tenure count
    // (docs/DECISIONS.md) — the number now reads "(67% of 3 · 3 days
    // tracked)" so a low/zero star rating alongside a high % doesn't look
    // like a bug (it's the tenure gate, not a broken percentage).
    test('shows the live completion %, sample count, and tenure days once occurrences exist', () => {
        const r = routine({ habitDefinitionIds: ['h1'], createdAt: 0 });
        const habits = [{ id: 'h1', routineId: 'r1', category: 'health', occurrenceHistory: [
            { date: '2026-07-10', success: true },
            { date: '2026-07-11', success: true },
            { date: '2026-07-12', success: false },
        ] }];
        const html = RoutineViews.buildHeroStatsHtml(r, habits, 0);
        expect(html).toContain('(67% of 3 · 3 days tracked)');
    });
});

// Sub-session 5: the label builder itself (pure string helper).
describe('buildCompletionRateLabel', () => {
    test('null rate renders "unrated"', () => {
        expect(RoutineViews.buildCompletionRateLabel({ rate: null, rateSamples: 0 })).toContain('unrated');
    });

    test('a real rate renders a rounded percent with the sample count', () => {
        expect(RoutineViews.buildCompletionRateLabel({ rate: 0.856, rateSamples: 14 })).toContain('86% of 14');
    });

    test('0% is rendered as a rate, not mistaken for unrated', () => {
        const label = RoutineViews.buildCompletionRateLabel({ rate: 0, rateSamples: 2 });
        expect(label).toContain('0% of 2');
        expect(label).not.toContain('unrated');
    });
});

describe('ensureRoutineSlotAvailable', () => {
    let saveGame;
    let confirmSpy;
    let alertSpy;

    beforeEach(() => {
        saveGame = jest.fn();
        // Node has no confirm()/alert() globals (unlike the browser these
        // modules ship to) — define them fresh each test rather than
        // jest.spyOn, which requires the property to already exist.
        global.confirm = jest.fn(() => true);
        global.alert = jest.fn();
        confirmSpy = global.confirm;
        alertSpy = global.alert;
    });

    afterEach(() => {
        delete global.confirm;
        delete global.alert;
    });

    test('under capacity: proceeds without prompting', () => {
        const r = routine({ habitDefinitionIds: [] }); // capacity 1, used 0
        const ok = RoutineViews.ensureRoutineSlotAvailable(r, 'habit', { saveGame });
        expect(ok).toBe(true);
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(alertSpy).not.toHaveBeenCalled();
        expect(saveGame).not.toHaveBeenCalled();
    });

    test('at capacity with a point available and the player agrees: spends the point, saves, and proceeds', () => {
        const r = routine({ level: 2, habitDefinitionIds: ['h1'] }); // capacity 1, used 1, 1 point earned
        confirmSpy.mockReturnValue(true);
        const ok = RoutineViews.ensureRoutineSlotAvailable(r, 'habit', { saveGame });
        expect(ok).toBe(true);
        expect(r.boughtHabitSlots).toBe(1);
        expect(saveGame).toHaveBeenCalledTimes(1);
    });

    test('at capacity with a point available but the player declines: no mutation, no save', () => {
        const r = routine({ level: 2, habitDefinitionIds: ['h1'] });
        confirmSpy.mockReturnValue(false);
        const ok = RoutineViews.ensureRoutineSlotAvailable(r, 'habit', { saveGame });
        expect(ok).toBe(false);
        expect(r.boughtHabitSlots).toBe(0);
        expect(saveGame).not.toHaveBeenCalled();
    });

    test('at capacity with zero points available: alerts (not confirms) and blocks', () => {
        const r = routine({ level: 1, habitDefinitionIds: ['h1'] }); // capacity 1, used 1, 0 points earned
        const ok = RoutineViews.ensureRoutineSlotAvailable(r, 'habit', { saveGame });
        expect(ok).toBe(false);
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(alertSpy).toHaveBeenCalledTimes(1);
        expect(saveGame).not.toHaveBeenCalled();
    });

    test('spends into the correct pool for tasks, independent of habit slots', () => {
        const r = routine({ level: 2, taskDefinitionIds: ['t1'] }); // capacity 1, used 1
        confirmSpy.mockReturnValue(true);
        const ok = RoutineViews.ensureRoutineSlotAvailable(r, 'task', { saveGame });
        expect(ok).toBe(true);
        expect(r.boughtTaskSlots).toBe(1);
        expect(r.boughtHabitSlots).toBe(0);
    });
});

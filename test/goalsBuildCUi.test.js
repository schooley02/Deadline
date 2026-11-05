/**
 * @jest-environment jsdom
 */
/** Goals Build C screens (2026-11-05): the reward field, the card's reward / pending / Example buttons, the notices, the roster claim, goal-slot perk rows. */
global.CONFIG = require('../js/config.js');
global.Goals = require('../js/goals.js');
global.Theme = require('../js/theme.js');
global.GoalsPane = require('../js/ui/goalsPane.js');
global.Modal = require('../js/ui/modal.js');
global.Progression = require('../js/progression.js');
const GoalForm = require('../js/ui/goalForm.js');
const GoalCard = require('../js/ui/goalCard.js');
const FrozenNotice = require('../js/ui/frozenNotice.js');
const LevelPanel = require('../js/ui/levelPanel.js');

const ctx = { metrics: CONFIG.GOAL_METRICS, todayKey: '2026-11-05', options: { tasks: [], habits: [], routines: [] } };

describe('goal form reward field', () => {
    test('shows the right label per kind and submits the trimmed text', () => {
        const d = GoalForm.blankDraft(ctx);
        expect(GoalForm.html(d, ctx)).toContain('Each time I hit it');
        d.kind = 'milestone';
        expect(GoalForm.html(d, ctx)).toContain('When this is done');
        d.name = 'X'; d.reward = '  Dinner out ';
        d.targets = [{ type: 'bool', label: 'Done' }];
        expect(GoalForm.toSubmission(d, ctx).fields.reward).toBe('Dinner out');
    });
    test('editing a repeating goal with a waiting change shows the waiting targets and the next-period note', () => {
        const goal = { id: 1, name: 'W', kind: 'recurring', period: 'week', reward: 'Movie',
            targets: [{ id: 1, type: 'bool', label: 'Old' }], next: { targets: [{ id: 1, type: 'bool', label: 'New' }] } };
        const d = GoalForm.draftFromGoal(goal, {});
        expect(d.reward).toBe('Movie');
        expect(d.targets[0].label).toBe('New');
        expect(GoalForm.html(d, ctx)).toContain('starts with your next week');
    });
});

describe('goal card', () => {
    const view = (goal) => ({
        id: 1, goal: Object.assign({ id: 1, name: 'G', kind: 'recurring', period: 'week', stage: 1, streak: 0, bestStreak: 0, periodsMet: 0, history: [], targets: [] }, goal),
        progress: 0, stage: 1, pace: null, recent: null, targets: [],
    });
    test('shows the reward line per kind and the pending note', () => {
        let h = GoalCard.html(view({ reward: 'Pizza', next: { targets: [{}] } }), {});
        expect(h).toContain('Each time I hit it, I&#39;ll Pizza');
        expect(h).toContain('Your target changes start next week.');
        h = GoalCard.html(view({ kind: 'milestone', period: null, reward: 'Trip' }), {});
        expect(h).toContain('When this is done, I&#39;ll Trip');
        expect(h).not.toContain('start next');
    });
    test('an Example goal offers Keep / Change / Remove', () => {
        const h = GoalCard.html(view({ suggested: true }), {});
        expect(h).toContain('data-action="keep"');
        expect(h).toContain('>Change<');
        expect(h).toContain('>Remove<');
        expect(GoalCard.html(view({}), {})).not.toContain('data-action="keep"');
    });
});

describe('goal notices', () => {
    test('detail lines: bonus, item paid / owed / young, on time, reward', () => {
        const L = FrozenNotice.goalDetailLines;
        expect(L({ pts: 17, streak: 2, item: { name: 'Earned Sick Day' }, itemStatus: 'paid', reward: 'Spa' }))
            .toEqual(['Bonus: +17 points (streak 2).', 'You earned an Earned Sick Day.', 'Your reward: Spa']);
        expect(L({ itemStatus: 'owed' })[0]).toMatch(/on its way/);
        expect(L({ itemStatus: 'young' })[0]).toMatch(/too new/);
        expect(L({ onTime: true })).toEqual(['Finished by the deadline.']);
        expect(L({})).toEqual([]);
    });
});

describe('roster claim', () => {
    test('a reward row has a Claim button that flips to Claimed', () => {
        const rows = GoalsPane.rosterRows([{ id: 5, name: 'A', kind: 'milestone', finishedAt: 1, reward: 'Treat', claimed: false }, { id: 6, name: 'B', kind: 'milestone', finishedAt: 1, reward: 'Nap', claimed: true }, { id: 7, name: 'C', kind: 'milestone', finishedAt: 1 }]);
        const h = GoalsPane.rosterHtml(rows);
        expect(h).toContain('data-record="5"');
        expect(h).toContain('>Claim<');
        expect(h).toContain('Claimed');
        expect((h.match(/goal-claim-btn/g) || []).length).toBe(2);
    });
});

describe('level panel goal slot rows', () => {
    test('a level where the goal table grows gives a row; a flat level gives none', () => {
        const t = { 1: 2, 2: 3, 3: 3, 4: 4 };
        expect(LevelPanel.goalSlotPerks(t, 1, 2)).toEqual([{ type: 'goalSlot', level: 2, label: 'A new goal slot (3 in all)' }]);
        expect(LevelPanel.goalSlotPerks(t, 2, 3)).toEqual([]);
        expect(LevelPanel.goalSlotPerks(t, 0, 4).map(p => p.level)).toEqual([1, 2, 4]);
        expect(LevelPanel.goalSlotPerks(null, 0, 4)).toEqual([]);
    });
});

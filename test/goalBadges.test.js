/**
 * @jest-environment jsdom
 */
/**
 * Goal badges (Build B2, 2026-11-05; docs/GOALS_PLAN.md "Screens"): a task that counts toward a goal wears the goal's name on its agenda
 * row and in its details popup; tapping the badge opens the goal card. Pure model + DOM in js/ui/goalsPane.js; source-level checks for the seams.
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
global.Goals = require('../js/goals.js');
global.Theme = require('../js/theme.js');
const GoalsPane = require('../js/ui/goalsPane.js');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const goals = [{ id: 4, name: 'Launch the site' }, { id: 5, name: 'Run <fast>' }];

function row(id) {
    const li = document.createElement('li');
    li.innerHTML = `<div class="item-info"><div class="details-wrap"><span class="item-details">Due: soon</span></div></div>`;
    document.body.appendChild(li);
    return li;
}

describe('badgeFor', () => {
    test('is the goal when the task is linked to an active goal, else null', () => {
        expect(GoalsPane.badgeFor({ goalId: 4 }, goals)).toEqual({ goalId: 4, name: 'Launch the site' });
        expect(GoalsPane.badgeFor({ goalId: '4' }, goals)).toEqual({ goalId: 4, name: 'Launch the site' });
        expect(GoalsPane.badgeFor({ goalId: 9 }, goals)).toBeNull();
        expect(GoalsPane.badgeFor({ goalId: null }, goals)).toBeNull();
        expect(GoalsPane.badgeFor({}, goals)).toBeNull();
        expect(GoalsPane.badgeFor(null, goals)).toBeNull();
    });
});

describe('badgeSignature', () => {
    test('changes when a link, a goal name or the set of items changes, and only then', () => {
        const a = [{ id: 1, goalId: 4 }, { id: 2 }];
        const sig = GoalsPane.badgeSignature(a, goals);
        expect(GoalsPane.badgeSignature([{ id: 1, goalId: 4 }, { id: 2 }], goals)).toBe(sig);
        expect(GoalsPane.badgeSignature([{ id: 1, goalId: 5 }, { id: 2 }], goals)).not.toBe(sig);
        expect(GoalsPane.badgeSignature(a, [{ id: 4, name: 'Renamed' }, goals[1]])).not.toBe(sig);
        expect(GoalsPane.badgeSignature([{ id: 1, goalId: 4 }], goals)).not.toBe(sig);
    });
});

describe('badgeHtml', () => {
    test('escapes the goal name and carries the goal id', () => {
        const html = GoalsPane.badgeHtml({ goalId: 5, name: 'Run <fast>' });
        expect(html).toContain('data-goal-id="5"');
        expect(html).toContain('Run &lt;fast&gt;');
        expect(html).not.toContain('<fast>');
        expect(html).toContain('class="goal-badge"');
    });
});

describe('applyBadges', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    test('puts a badge beside the due line of each linked row, removes it when the link goes, never doubles it', () => {
        const li = row();
        const item = { id: 1, goalId: 4, listItemElement: li };
        const opened = [];
        GoalsPane.applyBadges([item], goals, (id) => opened.push(id));
        GoalsPane.applyBadges([item], goals, (id) => opened.push(id));
        expect(li.querySelectorAll('.goal-badge')).toHaveLength(1);
        expect(li.querySelector('.goal-badge').textContent).toBe('Launch the site');
        item.goalId = null;
        GoalsPane.applyBadges([item], goals, () => {});
        expect(li.querySelectorAll('.goal-badge')).toHaveLength(0);
    });

    test('a changed goal name updates the badge text in place', () => {
        const li = row();
        const item = { id: 1, goalId: 4, listItemElement: li };
        GoalsPane.applyBadges([item], goals, () => {});
        GoalsPane.applyBadges([item], [{ id: 4, name: 'Renamed' }], () => {});
        expect(li.querySelectorAll('.goal-badge')).toHaveLength(1);
        expect(li.querySelector('.goal-badge').textContent).toBe('Renamed');
    });

    test('tapping a badge opens that goal and does not reach the row or the document', () => {
        const li = row();
        const item = { id: 1, goalId: 5, listItemElement: li };
        const opened = [];
        const rowTap = jest.fn();
        li.addEventListener('click', rowTap);
        GoalsPane.applyBadges([item], goals, (id) => opened.push(id));
        li.querySelector('.goal-badge').click();
        expect(opened).toEqual(['5']);
        expect(rowTap).not.toHaveBeenCalled();
    });

    test('an item with no row yet is skipped without throwing', () => {
        expect(() => GoalsPane.applyBadges([{ id: 3, goalId: 4 }, { id: 4, goalId: 4, listItemElement: null }], goals, () => {})).not.toThrow();
    });
});

describe('seams (source level)', () => {
    test('script.js refreshes the badges from renderGoals only when the signature changes', () => {
        const src = read('script.js');
        expect(src).toContain('GoalsPane.applyBadges(');
        expect(src).toContain('GoalsPane.badgeSignature(');
    });
    test('the details popup shows the goal line through deps and opens the card on a tap', () => {
        const popups = read('js/ui/popups.js');
        expect(popups).toContain('deps.goalBadgeHtml');
        expect(popups).toContain('deps.onOpenGoal');
        const src = read('script.js');
        expect(src).toMatch(/goalBadgeHtml: /);
        expect(src).toMatch(/onOpenGoal: \(goalId\) => GoalCard\.open\(goalId, goalCardDeps\(\)\)/);
    });
});

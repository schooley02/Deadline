/**
 * Hud tests — negative-balance styling + agency nudge
 * ([P1-DATA-005] sub-session 3, 2026-07-19).
 *
 * js/ui/hud.js is a self-contained module (no bare globals) — required
 * directly. DOM elements are minimal fakes matching classList/textContent,
 * same style as items-lurker.test.js's fakeEl.
 */
const Hud = require('../js/ui/hud.js');

function fakeStatEl() {
    const classes = new Set();
    return {
        classList: {
            add: (c) => classes.add(c),
            remove: (c) => classes.delete(c),
            toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); },
            has: (c) => classes.has(c),
        },
        _classes: classes,
    };
}

function fakeTextEl() {
    return { textContent: '' };
}

function fakeNudgeEl() {
    const el = fakeStatEl();
    el.textContent = '';
    return el;
}

describe('Hud.tasksToBreakEven', () => {
    test('0 for a non-negative balance', () => {
        expect(Hud.tasksToBreakEven(0, 5)).toBe(0);
        expect(Hud.tasksToBreakEven(10, 5)).toBe(0);
    });

    test('rounds UP — a partial task still leaves debt', () => {
        expect(Hud.tasksToBreakEven(-12, 5)).toBe(3); // 2.4 -> 3
    });

    test('exact multiples divide evenly', () => {
        expect(Hud.tasksToBreakEven(-10, 5)).toBe(2);
    });

    test('0 for a non-positive pointsPerTask (defensive)', () => {
        expect(Hud.tasksToBreakEven(-10, 0)).toBe(0);
        expect(Hud.tasksToBreakEven(-10, -5)).toBe(0);
    });
});

describe('Hud.updatePlayerDisplays — negative balance styling', () => {
    function makeDeps(overrides = {}) {
        return {
            playerXP: 0, playerLevel: 1, playerPoints: 0, routineSlots: 1,
            pointsPerTask: 5,
            playerXpDisplay: fakeTextEl(),
            playerLevelDisplay: fakeTextEl(),
            playerPointsDisplay: fakeTextEl(),
            totalRoutineSlotsDisplay: fakeTextEl(),
            playerPointsStat: fakeStatEl(),
            playerPointsNudge: fakeNudgeEl(),
            ...overrides,
        };
    }

    test('positive balance: no negative class, nudge hidden and empty', () => {
        const deps = makeDeps({ playerPoints: 25 });
        Hud.updatePlayerDisplays(deps);
        expect(deps.playerPointsStat._classes.has('points-negative')).toBe(false);
        expect(deps.playerPointsNudge.textContent).toBe('');
        expect(deps.playerPointsNudge._classes.has('hidden')).toBe(true);
    });

    test('negative balance: adds points-negative class and shows a nudge with the right count', () => {
        const deps = makeDeps({ playerPoints: -12, pointsPerTask: 5 });

        Hud.updatePlayerDisplays(deps);

        expect(deps.playerPointsStat._classes.has('points-negative')).toBe(true);
        expect(deps.playerPointsNudge.textContent).toContain('3 tasks');
        expect(deps.playerPointsNudge._classes.has('hidden')).toBe(false);
    });

    test('going from negative back to non-negative removes the class and hides the nudge', () => {
        const statEl = fakeStatEl();
        statEl._classes.add('points-negative');
        const nudgeEl = fakeNudgeEl();
        nudgeEl.textContent = ' · complete 1 task to break even';

        const deps = makeDeps({
            playerPoints: 5,
            playerPointsStat: statEl,
            playerPointsNudge: nudgeEl,
        });

        Hud.updatePlayerDisplays(deps);

        expect(statEl._classes.has('points-negative')).toBe(false);
        expect(deps.playerPointsNudge.textContent).toBe('');
    });

    test('gracefully no-ops when playerPointsStat/playerPointsNudge are absent', () => {
        const deps = makeDeps({ playerPoints: -12 });
        delete deps.playerPointsStat;
        delete deps.playerPointsNudge;
        expect(() => Hud.updatePlayerDisplays(deps)).not.toThrow();
    });
});

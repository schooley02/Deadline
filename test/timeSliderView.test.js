/**
 * @jest-environment jsdom
 *
 * TimeSliderView tests (Milestone 4, "Time slider (Today, then Week/Month
 * scopes)", Today scope only this session, 2026-07-20).
 *
 * js/ui/timeSliderView.js reads TimeSlider as a bare global (movement.js/
 * clock.js precedent) — bind it (and its own Clock/CONFIG globals) before
 * requiring the view module. jsdom precedent: test/modal-behavior.test.js
 * (session 61) — first file to opt into the jsdom environment.
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
global.TimeSlider = require('../js/timeSlider.js');
const TimeSliderView = require('../js/ui/timeSliderView.js');

const DIMS = { gameScreenWidth: 1200, baseWidth: 100, habitEnemyWidth: 40 };

function makeItemEl() {
    const el = document.createElement('div');
    el.className = 'enemy';
    document.body.appendChild(el);
    return el;
}

function makeDeps(overrides = {}) {
    const sliderEl = document.createElement('input');
    sliderEl.type = 'range';
    document.body.appendChild(sliderEl);
    const labelEl = document.createElement('div');
    document.body.appendChild(labelEl);

    const calls = { midnightUpdates: [], previewActive: [] };
    const deps = {
        sliderEl,
        labelEl,
        getActiveItems: () => overrides.activeItems || [],
        isNonThreatening: (item) => !!item.isNegative,
        calculateTimelineXWithClustering: (item) => item.__x !== undefined ? item.__x : 300,
        updateMidnightLine: (t) => calls.midnightUpdates.push(t),
        dims: () => DIMS,
        setTimePreviewActive: (v) => calls.previewActive.push(v),
        ...overrides.deps,
    };
    return { deps, calls, sliderEl, labelEl };
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('TimeSliderView.init', () => {
    test('sets slider bounds and syncs the handle to now', () => {
        const { deps, sliderEl, labelEl } = makeDeps();
        TimeSliderView.init(deps);
        expect(Number(sliderEl.min)).toBe(0);
        expect(Number(sliderEl.max)).toBe(TimeSlider.MINUTES_PER_DAY);
        expect(labelEl.textContent).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    test('missing sliderEl degrades to a silent no-op', () => {
        const { deps } = makeDeps({ deps: { sliderEl: null } });
        expect(() => TimeSliderView.init(deps)).not.toThrow();
    });
});

describe('scrubbing (input event)', () => {
    test('activates preview, ghosts items, and repositions by the scrubbed time', () => {
        const el = makeItemEl();
        const item = { element: el, __x: 777 };
        const { deps, sliderEl, calls } = makeDeps({ activeItems: [item] });
        TimeSliderView.init(deps);

        sliderEl.value = '600'; // 10:00 AM
        sliderEl.dispatchEvent(new Event('input'));

        expect(calls.previewActive).toEqual([true]);
        expect(el.style.left).toBe('777px');
        expect(el.classList.contains('time-preview-ghost')).toBe(true);
        expect(calls.midnightUpdates.length).toBe(1);
    });

    test('a non-threatening (lurker) item uses TimeSlider.getLurkerPreviewX instead', () => {
        const el = makeItemEl();
        const item = { element: el, isNegative: true };
        const { deps, sliderEl } = makeDeps({ activeItems: [item] });
        TimeSliderView.init(deps);

        sliderEl.value = String(21 * 60); // 9:00 PM — midnight line is on-screen
        sliderEl.dispatchEvent(new Event('input'));

        const expectedX = TimeSlider.getLurkerPreviewX(new Date(new Date().setHours(21, 0, 0, 0)), DIMS);
        expect(el.style.left).toBe(Math.max(DIMS.baseWidth, expectedX) + 'px');
    });

    test('position is clamped to baseWidth', () => {
        const el = makeItemEl();
        const item = { element: el, __x: 10 }; // below baseWidth (100)
        const { deps, sliderEl } = makeDeps({ activeItems: [item] });
        TimeSliderView.init(deps);

        sliderEl.value = '600';
        sliderEl.dispatchEvent(new Event('input'));

        expect(el.style.left).toBe('100px');
    });

    test('an item with no element is skipped without throwing', () => {
        const { deps, sliderEl } = makeDeps({ activeItems: [{ element: null }] });
        TimeSliderView.init(deps);
        expect(() => {
            sliderEl.value = '600';
            sliderEl.dispatchEvent(new Event('input'));
        }).not.toThrow();
    });
});

describe('release (change/pointerup/touchend/blur)', () => {
    test('deactivates preview and strips the ghost class', () => {
        const el = makeItemEl();
        const item = { element: el, __x: 777 };
        const { deps, sliderEl, calls } = makeDeps({ activeItems: [item] });
        TimeSliderView.init(deps);

        sliderEl.value = '600';
        sliderEl.dispatchEvent(new Event('input'));
        expect(el.classList.contains('time-preview-ghost')).toBe(true);

        sliderEl.dispatchEvent(new Event('change'));
        expect(calls.previewActive).toEqual([true, false]);
        expect(el.classList.contains('time-preview-ghost')).toBe(false);
    });

    test('is idempotent across multiple release-style events', () => {
        const { deps, sliderEl, calls } = makeDeps();
        TimeSliderView.init(deps);
        sliderEl.dispatchEvent(new Event('change'));
        sliderEl.dispatchEvent(new Event('pointerup'));
        sliderEl.dispatchEvent(new Event('touchend'));
        sliderEl.dispatchEvent(new Event('blur'));
        expect(calls.previewActive.every((v) => v === false)).toBe(true);
    });
});

// Damage/routine-HP projection (2026-07-20, same session — "the preview
// also needs to show base damage and freezes"). One optional-collaborator
// group — omitted entirely by every test above, which must keep passing
// unchanged.
describe('damage/routine HP preview (optional collaborator group)', () => {
    function makeDamageDeps(overrides = {}) {
        const baseElement = document.createElement('div');
        const baseHealthDisplayEl = document.createElement('span');
        const heroBaseZoneEl = document.createElement('div');
        document.body.append(baseElement, baseHealthDisplayEl, heroBaseZoneEl);

        const heroRenders = [];
        const routines = overrides.routines || [];
        const deps = {
            getBaseHealth: () => overrides.baseHealth != null ? overrides.baseHealth : 80,
            getLastRegenTickMs: () => null,
            baseElement,
            baseHealthDisplayEl,
            resolveBaseImage: (h) => `base_${h}.png`,
            getDefinedRoutines: () => routines,
            getRoutineIdForItem: overrides.getRoutineIdForItem || (() => null),
            renderHeroesAtBase: (routinesArg) => heroRenders.push(routinesArg),
            heroBaseZoneEl,
        };
        return { deps, baseElement, baseHealthDisplayEl, heroBaseZoneEl, heroRenders };
    }

    test('omitting the whole group is a silent no-op (existing tests keep passing)', () => {
        const { deps, sliderEl } = makeDeps();
        TimeSliderView.init(deps);
        expect(() => {
            sliderEl.value = '600';
            sliderEl.dispatchEvent(new Event('input'));
        }).not.toThrow();
    });

    test('scrubbing forward past an overdue item projects lower base health and ghosts the HUD', () => {
        const due = new Date(new Date().setHours(0, 1, 0, 0)); // overdue since just after midnight
        const item = { element: makeItemEl(), dueDateTime: due, __x: 300 };
        const { deps: baseDeps, sliderEl } = makeDeps({ activeItems: [item] });
        const { deps: dmgDeps, baseElement, baseHealthDisplayEl, heroBaseZoneEl } = makeDamageDeps({ baseHealth: 80 });
        const deps = { ...baseDeps, ...dmgDeps };
        TimeSliderView.init(deps);

        sliderEl.value = String(23 * 60); // 11:00 PM — many damage ticks would have fired
        sliderEl.dispatchEvent(new Event('input'));

        expect(Number(baseHealthDisplayEl.textContent)).toBeLessThan(80);
        expect(baseElement.style.backgroundImage).toContain('base_');
        expect(baseElement.classList.contains('time-preview-ghost')).toBe(true);
        expect(baseHealthDisplayEl.classList.contains('time-preview-ghost')).toBe(true);
        expect(heroBaseZoneEl.classList.contains('time-preview-ghost')).toBe(true);
    });

    test('release restores the exact live base health and strips ghost classes', () => {
        const due = new Date(new Date().setHours(0, 1, 0, 0));
        const item = { element: makeItemEl(), dueDateTime: due, __x: 300 };
        const { deps: baseDeps, sliderEl } = makeDeps({ activeItems: [item] });
        const { deps: dmgDeps, baseElement, baseHealthDisplayEl } = makeDamageDeps({ baseHealth: 80 });
        const deps = { ...baseDeps, ...dmgDeps };
        TimeSliderView.init(deps);

        sliderEl.value = String(23 * 60);
        sliderEl.dispatchEvent(new Event('input'));
        sliderEl.dispatchEvent(new Event('change'));

        expect(Number(baseHealthDisplayEl.textContent)).toBe(80);
        expect(baseElement.classList.contains('time-preview-ghost')).toBe(false);
        expect(baseHealthDisplayEl.classList.contains('time-preview-ghost')).toBe(false);
    });

    test('projects routine health for routine-owned overdue items, leaving other routines untouched', () => {
        const due = new Date(new Date().setHours(0, 1, 0, 0));
        const item = { element: makeItemEl(), dueDateTime: due, __x: 300, routineId: 'r1' };
        const routines = [{ id: 'r1', health: 90 }, { id: 'r2', health: 70 }];
        const { deps: baseDeps, sliderEl } = makeDeps({ activeItems: [item] });
        const { deps: dmgDeps, heroRenders } = makeDamageDeps({
            routines,
            getRoutineIdForItem: (i) => i.routineId || null,
        });
        const deps = { ...baseDeps, ...dmgDeps };
        TimeSliderView.init(deps);

        sliderEl.value = String(23 * 60);
        sliderEl.dispatchEvent(new Event('input'));

        const lastRender = heroRenders[heroRenders.length - 1];
        const r1 = lastRender.find((r) => r.id === 'r1');
        const r2 = lastRender.find((r) => r.id === 'r2');
        expect(r1.health).toBeLessThan(90);
        expect(r2.health).toBe(70); // untouched — no owning item overdue
        expect(routines.find((r) => r.id === 'r1').health).toBe(90); // real array never mutated
    });

    test('a KO\'d routine is never damaged further by the projection (matches items.js guard)', () => {
        const due = new Date(new Date().setHours(0, 1, 0, 0));
        const item = { element: makeItemEl(), dueDateTime: due, __x: 300, routineId: 'r1' };
        const routines = [{ id: 'r1', health: 0, koState: { koAt: Date.now() } }];
        const { deps: baseDeps, sliderEl } = makeDeps({ activeItems: [item] });
        const { deps: dmgDeps, heroRenders } = makeDamageDeps({
            routines,
            getRoutineIdForItem: (i) => i.routineId || null,
        });
        const deps = { ...baseDeps, ...dmgDeps };
        TimeSliderView.init(deps);

        sliderEl.value = String(23 * 60);
        sliderEl.dispatchEvent(new Event('input'));

        const lastRender = heroRenders[heroRenders.length - 1];
        expect(lastRender.find((r) => r.id === 'r1').health).toBe(0);
    });
});

describe('TimeSliderView.syncHandle (live-tick hook)', () => {
    test('sets the slider value and label from a given time', () => {
        const { deps, sliderEl, labelEl } = makeDeps();
        TimeSliderView.init(deps);
        TimeSliderView.syncHandle(new Date(new Date().setHours(9, 5, 0, 0)));
        expect(Number(sliderEl.value)).toBe(9 * 60 + 5);
        expect(labelEl.textContent).toBe('9:05 AM');
    });
});

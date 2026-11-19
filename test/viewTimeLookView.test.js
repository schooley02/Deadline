/**
 * @jest-environment jsdom
 *
 * ViewTimeLookView (DOM side of the past / future canvas look, 2026-11-19; DECISIONS 2026-11-19 (view-time look)).
 */
global.ViewTimeLook = require('../js/viewTimeLook.js');
const ViewTimeLookView = require('../js/ui/viewTimeLookView.js');

const HOUR = 60 * 60 * 1000;
const canvas = () => document.getElementById('gameCanvas');
const stamp = () => canvas().querySelector('.view-look-stamp').textContent;

beforeEach(() => {
    ViewTimeLookView.reset();
    document.body.innerHTML = '<div id="gameCanvas"><div class="enemy"></div></div>';
});
afterEach(() => {
    ViewTimeLookView.reset();
    jest.useRealTimers();
});

test('past: tape class + PLAYBACK stamp', () => {
    ViewTimeLookView.show(new Date(Date.now() - 2 * HOUR), false);
    expect(canvas().classList.contains('view-look-past')).toBe(true);
    expect(canvas().classList.contains('view-look-future')).toBe(false);
    expect(stamp()).toContain('◀◀ PLAYBACK');
    expect(ViewTimeLookView.current()).toBe('past');
});

test('future: forecast class + FORECAST stamp', () => {
    ViewTimeLookView.show(new Date(Date.now() + 26 * HOUR), false);
    expect(canvas().classList.contains('view-look-future')).toBe(true);
    expect(canvas().classList.contains('view-look-past')).toBe(false);
    expect(stamp()).toContain('▶▶ FORECAST');
});

test('back to live clears the look and the stamp', () => {
    ViewTimeLookView.show(new Date(Date.now() - 2 * HOUR), false);
    ViewTimeLookView.show(new Date(), true);
    expect(canvas().classList.contains('view-look-past')).toBe(false);
    expect(canvas().classList.contains('view-look-future')).toBe(false);
    expect(stamp()).toBe('');
    expect(ViewTimeLookView.current()).toBeNull();
});

test('the live tick never adds layers to the canvas', () => {
    ViewTimeLookView.show(new Date(), true);
    ViewTimeLookView.show(new Date(), true);
    expect(canvas().querySelector('.view-look-tint')).toBeNull();
    expect(canvas().querySelector('.view-look-fx')).toBeNull();
});

test('both layers are added once, never block taps, and sit outside the zombies', () => {
    ViewTimeLookView.show(new Date(Date.now() - HOUR), false);
    ViewTimeLookView.show(new Date(Date.now() + HOUR * 30), false);
    ViewTimeLookView.show(new Date(Date.now() - HOUR * 3), false);
    expect(canvas().querySelectorAll(':scope > .view-look-tint')).toHaveLength(1);
    expect(canvas().querySelectorAll(':scope > .view-look-fx')).toHaveLength(1);
    expect(canvas().querySelector('.enemy .view-look-tint')).toBeNull();
    expect(canvas().querySelector('.view-look-fx').getAttribute('aria-hidden')).toBe('true');
});

test('the stamp follows the scrub', () => {
    const a = new Date(Date.now() - 5 * HOUR);
    const b = new Date(Date.now() - 2 * HOUR);
    ViewTimeLookView.show(a, false);
    const first = stamp();
    ViewTimeLookView.show(b, false);
    expect(stamp()).not.toBe(first);
    expect(stamp()).toContain(ViewTimeLook.stampParts(b, 'past').text);
});

test('a handle parked on now becomes the past as the clock moves on', () => {
    jest.useFakeTimers();
    const t0 = new Date(2026, 10, 19, 12, 0, 0);
    jest.setSystemTime(t0);
    ViewTimeLookView.show(new Date(t0), false); // parked on the current minute: present
    expect(ViewTimeLookView.current()).toBeNull();
    jest.setSystemTime(new Date(t0.getTime() + 5 * 60 * 1000));
    ViewTimeLookView.refresh();
    expect(ViewTimeLookView.current()).toBe('past');
    expect(canvas().classList.contains('view-look-past')).toBe(true);
});

test('the re-check timer runs only while the look is not live', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 19, 12, 0, 0));
    ViewTimeLookView.show(new Date(2026, 10, 19, 9, 0, 0), false);
    expect(jest.getTimerCount()).toBe(1);
    ViewTimeLookView.show(new Date(), true);
    expect(jest.getTimerCount()).toBe(0);
});

test('no #gameCanvas = no throw', () => {
    document.body.innerHTML = '';
    expect(() => ViewTimeLookView.show(new Date(Date.now() - HOUR), false)).not.toThrow();
});

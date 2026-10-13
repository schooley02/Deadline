/**
 * Negative-habit wording + lurker post (2026-10-13, Jeremy): a negative habit's
 * time of day is a TRIGGER time ("Tempting around 12 PM"), not a deadline, and
 * the lurker's fixed post uses the strip-aware habit width.
 */
global.CONFIG = require('../js/config.js');
const Habits = require('../js/habits.js');

describe('Habits.timeOfDayLabels / dueLineText', () => {
    test('negative: "around" wording and a Tempting Time field label', () => {
        const l = Habits.timeOfDayLabels(true);
        expect(l.fieldLabel).toBe('Tempting Time:');
        expect(l.options.afternoon).toBe('Afternoon (around 5 PM)');
        expect(l.options.anytime).toBe('Anytime Today');
    });
    test('positive keeps "by" wording and the form\'s own field label', () => {
        const l = Habits.timeOfDayLabels(false);
        expect(l.fieldLabel).toBeNull();
        expect(l.options.morning).toBe('Morning (by 12 PM)');
    });
    test('negative lurker row reads "Tempting around <time> · avoiding today", never "Due"', () => {
        const item = { type: 'habit', isNegative: true, dueDateTime: new Date(2026, 9, 13, 12, 0) };
        const text = Habits.dueLineText(item, 'en-US');
        expect(text).toMatch(/^Tempting around 12:00\s?PM · avoiding today$/);
        expect(text).not.toMatch(/Due/);
    });
    test('positive habits and tasks keep "Due: <date, time>"', () => {
        const d = new Date(2026, 9, 13, 12, 0);
        expect(Habits.dueLineText({ type: 'habit', isNegative: false, dueDateTime: d }, 'en-US')).toMatch(/^Due: 10\/13\/26, 12:00\s?PM$/);
        expect(Habits.dueLineText({ type: 'task', dueDateTime: d }, 'en-US')).toMatch(/^Due: /);
    });
});

/**
 * @jest-environment jsdom
 */
/**
 * Build / Break habit-type picker (2026-11-04, Jeremy): one shared helper for Add Habit and the routine Create / Edit
 * Habit forms, SVG icons (hammer / broken chain) instead of emoji, icon + title ABOVE the description, and radios that
 * stay in the page (keyboard reachable) while every reader keeps using `input[name=...]:checked`.
 */
const fs = require('fs');
const path = require('path');
global.Schedule = require('../js/schedule.js'); // forms.js reads Schedule as a bare global (Add Habit's schedule fields)
const Forms = require('../js/ui/forms.js');

const mount = (o) => { document.body.innerHTML = Forms.habitTypeToggleHtml(o); };
const opts = (isNegative) => ({ name: 'grp', positiveId: 'p1', negativeId: 'n1', isNegative });

describe('Forms.habitTypeToggleHtml', () => {
    test('renders two radios in one group: Build (positive) and Break (negative)', () => {
        mount(opts(false));
        const radios = document.querySelectorAll('input[type="radio"][name="grp"]');
        expect(radios).toHaveLength(2);
        expect(radios[0].value).toBe('positive');
        expect(radios[1].value).toBe('negative');
        expect(document.querySelector('label[for="p1"] .habit-label').textContent).toBe('Build');
        expect(document.querySelector('label[for="n1"] .habit-label').textContent).toBe('Break');
    });

    test('isNegative false checks Build; true checks Break; readers still find the choice by name', () => {
        mount(opts(false));
        expect(document.querySelector('input[name="grp"]:checked').value).toBe('positive');
        mount(opts(true));
        expect(document.querySelector('input[name="grp"]:checked').value).toBe('negative');
        mount({ name: 'grp', positiveId: 'p1', negativeId: 'n1' });
        expect(document.querySelector('input[name="grp"]:checked').value).toBe('positive');
    });

    test('icon and title share one row that comes BEFORE the description', () => {
        mount(opts(false));
        document.querySelectorAll('.habit-type-label').forEach((label) => {
            const kids = Array.from(label.children);
            expect(kids.map((k) => k.className)).toEqual(['habit-title-row', 'habit-description']);
            expect(kids[0].querySelector('svg.habit-type-icon')).not.toBeNull();
            expect(kids[0].querySelector('.habit-label')).not.toBeNull();
        });
    });

    test('keeps the approved wording', () => {
        mount(opts(false));
        const text = (id) => document.querySelector(`label[for="${id}"] .habit-description`).textContent;
        expect(text('p1')).toBe('Do it to earn points');
        expect(text('n1')).toBe('Resist it to earn points');
    });

    test('no emoji and no old .habit-icon span (UI icons are SVG, CLAUDE.md 2026-10-31)', () => {
        mount(opts(true));
        const html = document.body.innerHTML;
        expect(html).not.toMatch(/✅|🚫/);
        expect(html).not.toContain('habit-icon');
    });

    test('Build and Break draw different icons, both decorative (aria-hidden)', () => {
        const build = Forms.habitTypeIconHtml(false);
        const brk = Forms.habitTypeIconHtml(true);
        expect(build).not.toBe(brk);
        [build, brk].forEach((svg) => {
            expect(svg).toContain('aria-hidden="true"');
            expect(svg).toContain('stroke-width="2.3"');
            expect(svg).toContain('stroke="currentColor"');
        });
    });

    test('icon size defaults to 22 and can be 16 for list rows', () => {
        expect(Forms.habitTypeIconHtml(false)).toContain('width="22" height="22"');
        expect(Forms.habitTypeIconHtml(true, 16)).toContain('width="16" height="16"');
    });

    test('the Add Habit form uses the shared picker with its original ids and group name', () => {
        document.body.innerHTML = Forms.createHabitFormHtml(new Date(2026, 10, 4, 9, 0));
        expect(document.getElementById('modalPositiveHabit').name).toBe('modalHabitType');
        expect(document.getElementById('modalNegativeHabit').name).toBe('modalHabitType');
        expect(document.querySelector('input[name="modalHabitType"]:checked').value).toBe('positive');
        expect(document.querySelectorAll('.habit-type-toggle')).toHaveLength(1);
    });
});

describe('css/modal.css habit-type picker', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'modal.css'), 'utf8');

    test('one row on every device: no one-column phone rule for the toggle', () => {
        expect(css).toMatch(/\.habit-type-toggle\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
        const phone = css.split('@media (max-width: 768px)').slice(1).join('');
        expect(phone).not.toMatch(/habit-type-toggle\s*\{[^}]*grid-template-columns:\s*1fr\s*;/);
    });

    test('the radios are visually hidden, not display:none, so the keyboard still reaches them', () => {
        const rule = css.match(/\.habit-type-toggle input\[type="radio"\]\s*\{([^}]*)\}/)[1];
        expect(rule).not.toMatch(/display:\s*none/);
        expect(rule).toMatch(/position:\s*absolute/);
        expect(css).toMatch(/input\[type="radio"\]:focus-visible \+ \.habit-type-label/);
    });
});

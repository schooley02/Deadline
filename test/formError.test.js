/**
 * @jest-environment jsdom
 */
/**
 * Inline form errors (Dialog Build 2, 2026-11-01, docs/DIALOG_PLAN.md): Forms.showFormError replaces alert() for validation.
 */
global.Modal = require('../js/ui/modal.js');
const Forms = require('../js/ui/forms.js');

function openForm() {
    document.body.innerHTML = `
        <div class="modal-overlay" id="f1"><div class="modal-content">
            <div class="form-row"><input id="nameIn"><select id="pick"><option value="">-</option><option value="a">A</option></select></div>
            <div class="modal-buttons"><button id="save" class="primary-button">Save</button></div>
        </div></div>`;
    return { name: document.getElementById('nameIn'), save: document.getElementById('save') };
}

describe('Forms.showFormError', () => {
    test('writes one error line right under the bad field\'s row and focuses the field', () => {
        const { name } = openForm();
        const el = Forms.showFormError('Name is required.', name);
        expect(el.textContent).toBe('Name is required.');
        expect(el.previousElementSibling).toBe(name.closest('.form-row'));
        expect(document.activeElement).toBe(name);
        expect(name.getAttribute('aria-invalid')).toBe('true');
        expect(el.getAttribute('role')).toBe('alert');
    });

    test('a second error replaces the first, never stacks', () => {
        const { name } = openForm();
        Forms.showFormError('one', name);
        Forms.showFormError('two', name);
        const all = document.querySelectorAll('.form-error');
        expect(all).toHaveLength(1);
        expect(all[0].textContent).toBe('two');
    });

    test('clears on the next edit and drops the invalid mark', () => {
        const { name } = openForm();
        Forms.showFormError('Name is required.', name);
        name.dispatchEvent(new Event('input', { bubbles: true }));
        expect(document.querySelector('.form-error')).toBeNull();
        expect(name.hasAttribute('aria-invalid')).toBe(false);
    });

    test('accepts a field id, and works with no field at all', () => {
        openForm();
        Forms.showFormError('Pick one.', 'pick');
        expect(document.activeElement.id).toBe('pick');
        const el = Forms.showFormError('Please select at least one day.');
        expect(document.querySelectorAll('.form-error')).toHaveLength(1);
        expect(el.nextElementSibling.classList.contains('modal-buttons')).toBe(true);   // no field: above the button row
    });

    test('opts.after / opts.before place the line next to a control', () => {
        const { name } = openForm();
        const row = name.parentNode;
        Forms.showFormError('after', name, { after: row });
        expect(row.nextElementSibling.classList.contains('form-error')).toBe(true);
        Forms.showFormError('before', name, { before: row });
        expect(row.previousElementSibling.classList.contains('form-error')).toBe(true);
        expect(document.querySelectorAll('.form-error')).toHaveLength(1);
    });

    test('falls back to the page when no form is open (inline management-window form)', () => {
        document.body.innerHTML = '<div class="management-window"><input id="routineName"><button id="go">Create</button></div>';
        const go = document.getElementById('go');
        const el = Forms.showFormError('Please enter a routine name.', 'routineName', { before: go });
        expect(go.previousElementSibling).toBe(el);
        expect(document.activeElement.id).toBe('routineName');
    });
});

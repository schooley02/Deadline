/**
 * @jest-environment jsdom
 */
// Dialog (2026-11-01, docs/DIALOG_PLAN.md): in-game replacement for alert()/confirm().
global.Modal = require('../js/ui/modal.js');
const Dialog = require('../js/ui/dialog.js');

const tick = () => new Promise(r => setTimeout(r, 5));
beforeEach(() => { document.body.innerHTML = ''; });

describe('Dialog.confirm', () => {
    test('OK resolves true and removes only the dialog (a modal underneath survives)', async () => {
        document.body.insertAdjacentHTML('beforeend', '<div class="modal-overlay" id="under"><div class="modal-content">x</div></div>');
        const p = Dialog.confirm('Spend a point?', { title: 'Unlock?', confirmLabel: 'Spend', cancelLabel: 'No' });
        await tick();
        const overlay = document.querySelector('.dialog-overlay');
        expect(overlay.textContent).toContain('Spend a point?');
        expect(overlay.querySelector('.dialog-ok').textContent).toBe('Spend');
        overlay.querySelector('.dialog-ok').click();
        expect(await p).toBe(true);
        expect(document.querySelector('.dialog-overlay')).toBeNull();
        expect(document.getElementById('under')).not.toBeNull();
    });

    test('Cancel resolves false', async () => {
        const p = Dialog.confirm('Delete?');
        await tick();
        document.querySelector('.dialog-cancel').click();
        expect(await p).toBe(false);
    });

    test('dismissing from outside (Esc / backdrop / Modal.closeModal) resolves false, never hangs', async () => {
        const p = Dialog.confirm('Delete?');
        await tick();
        Modal.closeModal();
        expect(await p).toBe(false);
    });

    test('danger styles the confirm button red; message text is escaped', async () => {
        const p = Dialog.confirm('Delete <b>"Floss"</b>?', { danger: true });
        await tick();
        const ok = document.querySelector('.dialog-ok');
        expect(ok.classList.contains('danger-button')).toBe(true);
        expect(document.querySelector('.dialog-message').innerHTML).not.toContain('<b>');
        ok.click();
        await p;
    });

    test('does not open synchronously (the click that asked for it cannot dismiss it)', async () => {
        const p = Dialog.confirm('x');
        expect(document.querySelector('.dialog-overlay')).toBeNull();
        await tick();
        expect(document.querySelector('.dialog-overlay')).not.toBeNull();
        document.querySelector('.dialog-ok').click();
        await p;
    });
});

describe('Dialog.notice', () => {
    test('has a single OK button and resolves when closed', async () => {
        const p = Dialog.notice('Nothing to move.', { title: 'Heads up' });
        await tick();
        expect(document.querySelector('.dialog-cancel')).toBeNull();
        expect(document.querySelector('.dialog-title').textContent).toBe('Heads up');
        document.querySelector('.dialog-ok').click();
        await expect(p).resolves.toBeUndefined();
    });

    test('dialogs queue: the second shows only after the first closes', async () => {
        const a = Dialog.notice('first');
        const b = Dialog.notice('second');
        await tick();
        expect(document.querySelectorAll('.dialog-overlay')).toHaveLength(1);
        expect(document.querySelector('.dialog-message').textContent).toBe('first');
        document.querySelector('.dialog-ok').click();
        await a; await tick();
        expect(document.querySelector('.dialog-message').textContent).toBe('second');
        document.querySelector('.dialog-ok').click();
        await b;
    });
});

/**
 * Dialog -- in-game replacements for the browser's alert() / confirm() (DECIDED 2026-11-01, Jeremy;
 * docs/DIALOG_PLAN.md). The browser's box says "localhost:8000 says ...", breaks the game's look and freezes
 * browser automation, so new code never uses it (CLAUDE.md Guardrails; test/no-native-dialogs.test.js).
 *
 *   Dialog.notice(message, { title, okLabel })                      -> Promise<void>   resolves when closed
 *   Dialog.confirm(message, { title, confirmLabel, cancelLabel, danger }) -> Promise<boolean>
 *
 * Built on Modal.open (Esc, tap-outside, focus return come from modal.js). Dismissing any way (Esc, backdrop, Modal.closeModal)
 * counts as Cancel / closed: a MutationObserver watches the overlay, so a promise can never hang. Dialogs queue and show one at a
 * time. The overlay is inserted one tick later so the click that asked for it cannot dismiss it (the same trap as the logged-time
 * prompt). Only this dialog is removed on a button press -- never Modal.closeModal(), which would nuke the modal underneath.
 * Modal is a bare global (loaded first).
 */
const Dialog = (() => {
    let queue = Promise.resolve();

    function esc(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function buildHtml(opts) {
        const title = opts.title ? `<h3 class="dialog-title">${esc(opts.title)}</h3>` : '';
        const cancel = opts.cancelLabel
            ? `<button type="button" class="secondary-button dialog-cancel">${esc(opts.cancelLabel)}</button>` : '';
        const okClass = opts.danger ? 'danger-button' : 'primary-button';
        return `
            <div class="modal-overlay dialog-overlay" role="alertdialog" aria-modal="true">
                <div class="modal-content dialog-content">
                    ${title}
                    <p class="dialog-message">${esc(opts.message)}</p>
                    <div class="modal-buttons">
                        <button type="button" class="${okClass} dialog-ok">${esc(opts.okLabel)}</button>
                        ${cancel}
                    </div>
                </div>
            </div>`;
    }

    // Shows one dialog; resolves true (OK) or false (cancel / dismissed).
    function openOne(opts) {
        return new Promise(resolve => {
            setTimeout(() => {
                const overlay = Modal.open(buildHtml(opts));
                if (!overlay) { resolve(false); return; }
                let done = false;
                const observer = new MutationObserver(() => {
                    if (!document.body.contains(overlay)) finish(false);
                });
                function finish(value) {
                    if (done) return;
                    done = true;
                    observer.disconnect();
                    if (overlay.parentNode) overlay.remove();
                    resolve(value);
                }
                observer.observe(document.body, { childList: true });
                const ok = overlay.querySelector('.dialog-ok');
                const cancel = overlay.querySelector('.dialog-cancel');
                if (ok) ok.addEventListener('click', () => finish(true));
                if (cancel) cancel.addEventListener('click', () => finish(false));
                if (ok) ok.focus();
            }, 0);
        });
    }

    function enqueue(opts) {
        const result = queue.then(() => openOne(opts));
        queue = result.catch(() => {});
        return result;
    }

    function notice(message, options = {}) {
        return enqueue({ message, title: options.title || '', okLabel: options.okLabel || 'OK', cancelLabel: '', danger: false })
            .then(() => undefined);
    }

    function confirm(message, options = {}) {
        return enqueue({
            message,
            title: options.title || '',
            okLabel: options.confirmLabel || 'OK',
            cancelLabel: options.cancelLabel || 'Cancel',
            danger: options.danger === true,
        });
    }

    return { notice, confirm };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Dialog;
}

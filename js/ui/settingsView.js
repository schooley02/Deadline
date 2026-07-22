/**
 * SettingsView — the Settings window opened from the FAB menu's 6th item
 * ([P2-UI-009], Milestone 4, session 59, 2026-07-19).
 *
 * Streak-fire intensity control (original content) plus, as of Milestone 5's
 * first item (2026-07-20), an Export/Import section — Jeremy's cross-device
 * / cross-build-version save portability request. DOM-only, no script.js
 * state closed over, same deps-object pattern as shopView.js/statsView.js —
 * but this module DOES call `ExportImport` and `Modal` directly as bare
 * globals (same convention as checkIn.js/popups.js calling Modal directly):
 * building/validating the envelope and rendering the confirm dialog are both
 * squarely "view" concerns, while script.js still owns the one truly
 * stateful step (writing localStorage + reloading) via `onConfirmImport`.
 *
 * deps: {
 *   currentIntensity, onChangeIntensity(intensity),
 *   buildExportEnvelope(): envelope,       — script.js: ExportImport.buildEnvelope(...)
 *   currentSummary: ExportImport summary shape (this device's live state, for the confirm compare),
 *   onConfirmImport(envelope)              — script.js: backup + localStorage write + reload
 *   onConfirmReset()                       — script.js: handleConfirmReset (wipe + re-init), see below
 * }
 *
 * Reset Game (moved here from a floating bottom-left corner button,
 * 2026-07-21 — it was one accidental tap away from wiping a real save on
 * the main game screen; Settings is a deliberate two-taps-deep destination).
 * Same in-app Modal.open confirm pattern as Import's replace-confirm below,
 * not the browser's native confirm() the old button used — consistent look,
 * and native confirm()/alert() are known to freeze Claude-in-Chrome CDP
 * automation mid-playtest (CLAUDE.md), so this also makes the flow testable
 * without the navigate-away recovery trick.
 */
const SettingsView = (() => {

    const OPTIONS = [
        { value: 'full', label: 'Full', hint: 'Animated fire effects for high-streak habits' },
        { value: 'reduced', label: 'Reduced', hint: 'Static glow, no animation' },
        { value: 'off', label: 'Off', hint: 'No streak fire effects' },
    ];

    const SUMMARY_LABELS = [
        { key: 'daysSurvived', label: 'Days survived' },
        { key: 'playerLevel', label: 'Level' },
        { key: 'playerXP', label: 'XP' },
        { key: 'playerPoints', label: 'Points' },
        { key: 'activeItemCount', label: 'Active tasks/habits' },
        { key: 'habitCount', label: 'Habits defined' },
        { key: 'routineCount', label: 'Routines defined' },
    ];

    function renderSettingsWindow(deps) {
        const container = document.getElementById('settingsWindowContent');
        if (!container) return;

        const optionsHtml = OPTIONS.map((opt) => `
            <label class="settings-radio-row">
                <input type="radio" name="effectsIntensity" value="${opt.value}"
                    ${deps.currentIntensity === opt.value ? 'checked' : ''}>
                <span class="settings-radio-label">${opt.label}</span>
                <span class="settings-radio-hint">${opt.hint}</span>
            </label>
        `).join('');

        container.innerHTML = `
            <div class="settings-section">
                <h4>Streak Fire Effects</h4>
                <p class="settings-section-hint">Controls the on-fire/blazing visual for high-streak habits.</p>
                <div class="settings-radio-group">${optionsHtml}</div>
            </div>
            <div class="settings-section settings-data-section">
                <h4>Backup &amp; Transfer</h4>
                <p class="settings-section-hint">Move your full game (tasks, habits, routines, stats, tokens) between devices, or back it up before testing a new build.</p>

                <div class="settings-data-subsection">
                    <h5>Export</h5>
                    <div class="settings-data-actions">
                        <button type="button" id="exportDownloadBtn" class="secondary-button">Download file</button>
                        <button type="button" id="exportCopyBtn" class="secondary-button">Copy to clipboard</button>
                    </div>
                    <p id="exportStatus" class="settings-data-status" aria-live="polite"></p>
                </div>

                <div class="settings-data-subsection">
                    <h5>Import</h5>
                    <div class="settings-data-actions">
                        <label class="secondary-button settings-file-label">
                            Choose file…
                            <input type="file" id="importFileInput" accept="application/json,.json" hidden>
                        </label>
                    </div>
                    <textarea id="importPasteArea" class="settings-import-textarea" rows="4" placeholder="…or paste an exported save here"></textarea>
                    <div class="settings-data-actions">
                        <button type="button" id="importPasteBtn" class="secondary-button">Import pasted text</button>
                    </div>
                    <p id="importStatus" class="settings-data-status" aria-live="polite"></p>
                </div>
            </div>
            <div class="settings-section settings-danger-section">
                <h4>Reset Game</h4>
                <p class="settings-section-hint">Wipes all tasks, habits, routines, run history, and achievements, and starts a fresh game. This cannot be undone — use Export above first if you want a backup.</p>
                <button type="button" id="resetGameBtn" class="danger-button">Reset Game</button>
            </div>
        `;

        container.querySelectorAll('input[name="effectsIntensity"]').forEach((input) => {
            input.addEventListener('change', (e) => {
                if (typeof deps.onChangeIntensity === 'function') {
                    deps.onChangeIntensity(e.target.value);
                }
            });
        });

        wireExportControls(container, deps);
        wireImportControls(container, deps);
        wireResetControl(container, deps);
    }

    // -----------------------------------------------------------------
    // Export
    // -----------------------------------------------------------------

    function setStatus(el, message, isError) {
        if (!el) return;
        el.textContent = message;
        el.className = 'settings-data-status' + (isError ? ' settings-data-status-error' : ' settings-data-status-ok');
    }

    function downloadEnvelope(envelope) {
        const json = JSON.stringify(envelope, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = (envelope.exportedAt || new Date().toISOString()).slice(0, 10);
        a.href = url;
        a.download = `deadline-save-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function wireExportControls(container, deps) {
        const statusEl = container.querySelector('#exportStatus');
        const downloadBtn = container.querySelector('#exportDownloadBtn');
        const copyBtn = container.querySelector('#exportCopyBtn');

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                try {
                    downloadEnvelope(deps.buildExportEnvelope());
                    setStatus(statusEl, 'Downloaded.', false);
                } catch (e) {
                    console.error('Deadline: export download failed', e);
                    setStatus(statusEl, 'Download failed — see console.', true);
                }
            });
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                let text;
                try {
                    text = JSON.stringify(deps.buildExportEnvelope());
                } catch (e) {
                    console.error('Deadline: export build failed', e);
                    setStatus(statusEl, 'Export failed — see console.', true);
                    return;
                }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text)
                        .then(() => setStatus(statusEl, 'Copied to clipboard.', false))
                        .catch(() => setStatus(statusEl, 'Copy failed — try Download instead.', true));
                } else {
                    setStatus(statusEl, 'Clipboard unavailable — use Download instead.', true);
                }
            });
        }
    }

    // -----------------------------------------------------------------
    // Import
    // -----------------------------------------------------------------

    function buildSummaryListHtml(summary) {
        return SUMMARY_LABELS.map(({ key, label }) => `
            <li><span class="import-compare-label">${label}</span><span class="import-compare-value">${summary[key]}</span></li>
        `).join('');
    }

    function showImportConfirmModal(result, deps) {
        const html = `
            <div class="modal-overlay import-confirm-overlay">
                <div class="modal-content import-confirm-modal">
                    <h3>Replace your current game?</h3>
                    <p>Importing REPLACES everything on this device with the imported save. Your current game is backed up automatically first and can be recovered if this was a mistake.</p>
                    <div class="import-confirm-compare">
                        <div class="import-confirm-column">
                            <h4>Current (this device)</h4>
                            <ul>${buildSummaryListHtml(deps.currentSummary || {})}</ul>
                        </div>
                        <div class="import-confirm-column">
                            <h4>Incoming (import)</h4>
                            <ul>${buildSummaryListHtml(result.summary || {})}</ul>
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button type="button" id="confirmImportBtn" class="primary-button">Replace &amp; Reload</button>
                        <button type="button" id="cancelImportBtn" class="secondary-button">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        const overlay = Modal.open(html, { dedupeSelector: '.import-confirm-overlay' });
        if (!overlay) return;

        overlay.querySelector('#confirmImportBtn').addEventListener('click', () => {
            if (typeof deps.onConfirmImport === 'function') {
                deps.onConfirmImport(result.envelope);
            }
        });
        overlay.querySelector('#cancelImportBtn').addEventListener('click', () => {
            Modal.closeTopmost();
        });
    }

    function processImportText(text, deps, statusEl) {
        const result = ExportImport.validateEnvelope(text);
        if (!result.valid) {
            setStatus(statusEl, result.message, true);
            return;
        }
        setStatus(statusEl, '', false);
        showImportConfirmModal(result, deps);
    }

    function wireImportControls(container, deps) {
        const statusEl = container.querySelector('#importStatus');
        const fileInput = container.querySelector('#importFileInput');
        const pasteArea = container.querySelector('#importPasteArea');
        const pasteBtn = container.querySelector('#importPasteBtn');

        if (fileInput) {
            fileInput.addEventListener('change', () => {
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => processImportText(String(reader.result), deps, statusEl);
                reader.onerror = () => setStatus(statusEl, 'Could not read that file.', true);
                reader.readAsText(file);
                fileInput.value = ''; // allow re-choosing the same file later
            });
        }

        if (pasteBtn) {
            pasteBtn.addEventListener('click', () => {
                processImportText(pasteArea ? pasteArea.value : '', deps, statusEl);
            });
        }
    }

    // -----------------------------------------------------------------
    // Reset (moved here from a floating corner button, 2026-07-21 — see
    // header comment above)
    // -----------------------------------------------------------------

    function showResetConfirmModal(deps) {
        const html = `
            <div class="modal-overlay reset-confirm-overlay">
                <div class="modal-content reset-confirm-modal">
                    <h3>Reset the game?</h3>
                    <p>This clears all tasks, habits, routines, run history, and achievements, and starts a fresh game. This cannot be undone.</p>
                    <div class="modal-buttons">
                        <button type="button" id="confirmResetBtn" class="danger-button">Reset Game</button>
                        <button type="button" id="cancelResetBtn" class="secondary-button">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        const overlay = Modal.open(html, { dedupeSelector: '.reset-confirm-overlay' });
        if (!overlay) return;

        overlay.querySelector('#confirmResetBtn').addEventListener('click', () => {
            Modal.closeTopmost();
            if (typeof deps.onConfirmReset === 'function') {
                deps.onConfirmReset();
            }
        });
        overlay.querySelector('#cancelResetBtn').addEventListener('click', () => {
            Modal.closeTopmost();
        });
    }

    function wireResetControl(container, deps) {
        const resetBtn = container.querySelector('#resetGameBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                showResetConfirmModal(deps);
            });
        }
    }

    return {
        renderSettingsWindow,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsView;
}

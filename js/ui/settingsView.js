/**
 * SettingsView — the Settings window opened from the FAB menu's 6th item
 * ([P2-UI-009], Milestone 4, session 59, 2026-07-19).
 *
 * First real content in what's meant to grow into a general settings
 * surface — today just the streak-fire "visual effects intensity" control
 * (full / reduced / off), backed by js/settings.js's separate
 * `deadline.settings` localStorage key. DOM-only, no script.js state closed
 * over, same deps-object pattern as shopView.js/statsView.js.
 *
 * deps: { currentIntensity, onChangeIntensity(intensity) }
 * onChangeIntensity is called with the newly-selected value; the caller
 * (script.js) owns actually persisting it (Settings.save) and applying it
 * to the live DOM (Settings.applyEffectsIntensity) — this module only
 * renders the control and reports the user's choice, matching
 * ShopView.renderShopWindow's onBuy/onUse callback shape.
 */
const SettingsView = (() => {

    const OPTIONS = [
        { value: 'full', label: 'Full', hint: 'Animated fire effects for high-streak habits' },
        { value: 'reduced', label: 'Reduced', hint: 'Static glow, no animation' },
        { value: 'off', label: 'Off', hint: 'No streak fire effects' },
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
        `;

        container.querySelectorAll('input[name="effectsIntensity"]').forEach((input) => {
            input.addEventListener('change', (e) => {
                if (typeof deps.onChangeIntensity === 'function') {
                    deps.onChangeIntensity(e.target.value);
                }
            });
        });
    }

    return {
        renderSettingsWindow,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsView;
}

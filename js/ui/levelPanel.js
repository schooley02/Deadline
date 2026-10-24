/**
 * LevelPanel — the player-level panel (docs/LEVEL_PERKS_PLAN.md sub-session B,
 * 2026-10-23). Opened from the HUD level button and from the Hero tray's
 * "Routines 3/4" summary line; both go through `open()` so there is one renderer.
 *
 * Shows, top to bottom:
 *   - Level and XP into the current level ("140 / 200 XP"; "Max level" at the cap).
 *   - ROUTINE SLOTS (the player's cap on active routines -- NOT a routine's own
 *     habit/task slots, which the Hero tray shows): one pip per slot.
 *       used   = an active routine (hero avatar; tap -> Manage Routine)
 *       frozen = an active routine that is frozen (keeps its slot; ice tint)
 *       ko     = a knocked-out routine (auto-deactivated, so its slot is free until
 *                it revives; shown as its own state, never as plain "empty")
 *       empty  = an open slot (dashed, "+"; tap -> Routines window to create one)
 *       locked = a slot a higher level unlocks ("Lv N")
 *   - Perks: this level's perks, the active shop discount, the next two levels'
 *     perks, and the title row at max level.
 *
 * PURE / DOM split like the other UI modules: slotsModel, slotsSummary,
 * xpModel, perksModel, buildModel are pure and unit-tested; open() is DOM and
 * live-checked. Globals read at call time: Progression, HeroesView, Modal.
 */
const LevelPanel = (() => {
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ESC[c]);
    }

    // ---- pure ---------------------------------------------------------------

    /** XP block: { into, needed, pct, maxed, text }. */
    function xpModel(xp, thresholds, level) {
        const p = Progression.xpProgress(xp, thresholds, level);
        return Object.assign({}, p, {
            text: p.maxed ? `Max level · ${xp} XP` : `${p.into} / ${p.needed} XP`,
        });
    }

    /** The level at which the Nth slot is first granted (null if never). */
    function levelForSlotCount(slotsTable, n) {
        const levels = Object.keys(slotsTable || {}).map(Number).sort((a, b) => a - b);
        for (const lv of levels) {
            if (slotsTable[lv] >= n) return lv;
        }
        return null;
    }

    /**
     * Routine-slot pips. `total` = slots the player has at `level`. Active
     * routines (frozen included) fill slots; knocked-out routines are shown in
     * the free slots as 'ko'; the rest are 'empty'. Locked pips continue up to
     * the most slots the table ever grants, each tagged with its unlock level.
     * ctx: { level, slotsTable, routines, definedHabits, config, runStartedAtMs }
     */
    function slotsModel(ctx) {
        const total = Progression.slotsAtLevel(ctx.slotsTable, ctx.level);
        const routines = ctx.routines || [];
        const describe = (routine) => {
            const chip = HeroesView.buildChipViewModel(routine, ctx.definedHabits || [], ctx.config, ctx.runStartedAtMs);
            return { routineId: routine.id, name: chip.name, emoji: chip.emoji, level: chip.level };
        };
        const occupying = routines.filter(r => r.isActive && !r.koState);
        const knockedOut = routines.filter(r => r.koState);

        const pips = [];
        occupying.slice(0, total).forEach(r => {
            pips.push(Object.assign({ kind: r.frozenState ? 'frozen' : 'used' }, describe(r)));
        });
        const free = Math.max(0, total - pips.length);
        const koShown = Math.min(knockedOut.length, free);
        knockedOut.slice(0, koShown).forEach(r => pips.push(Object.assign({ kind: 'ko' }, describe(r))));
        for (let i = 0; i < free - koShown; i++) pips.push({ kind: 'empty' });

        const maxSlots = Object.keys(ctx.slotsTable || {}).reduce((m, k) => Math.max(m, ctx.slotsTable[k]), total);
        for (let n = total + 1; n <= maxSlots; n++) {
            pips.push({ kind: 'locked', level: levelForSlotCount(ctx.slotsTable, n) });
        }

        const used = pips.filter(p => p.kind === 'used' || p.kind === 'frozen').length;
        const frozen = pips.filter(p => p.kind === 'frozen').length;
        const ko = pips.filter(p => p.kind === 'ko').length;
        const next = Progression.nextSlotUnlock(ctx.slotsTable, ctx.level);
        return { total, used, frozen, ko, pips, next };
    }

    /** "Routines 3/4 · 1 frozen" -- shared by the panel and the Hero tray header. */
    function slotsSummary(slots) {
        let text = `Routines ${slots.used}/${slots.total}`;
        if (slots.frozen > 0) text += ` · ${slots.frozen} frozen`;
        if (slots.ko > 0) text += ` · ${slots.ko} KO'd`;
        return text;
    }

    /**
     * Perks block. current = perks granted AT this level; discount = the shop
     * discount in force (0..1) with the level that granted it; next = perks of
     * the next `lookahead` levels that have any; title = earned title (or null).
     */
    function perksModel(perksTable, level, lookahead) {
        const take = typeof lookahead === 'number' ? lookahead : 2;
        const current = Progression.perksForLevels(perksTable, level - 1, level);
        const discount = Progression.shopDiscount(perksTable, level);
        let discountLevel = null;
        if (discount > 0) {
            for (let lv = level; lv >= 1; lv--) {
                const perks = perksTable[lv];
                if (Array.isArray(perks) && perks.some(p => p && p.type === 'discount')) { discountLevel = lv; break; }
            }
        }
        const levels = Object.keys(perksTable || {}).map(Number).filter(lv => lv > level && Array.isArray(perksTable[lv])).sort((a, b) => a - b);
        const next = [];
        levels.slice(0, take).forEach(lv => perksTable[lv].forEach(p => next.push(Object.assign({}, p, { level: lv }))));
        return { current, discount, discountLevel, next, title: Progression.titleForLevel(perksTable, level) };
    }

    /** Everything the panel (and the tray summary) renders. */
    function buildModel(ctx) {
        const xp = xpModel(ctx.xp, ctx.thresholds, ctx.level);
        const slots = slotsModel(ctx);
        const perks = perksModel(ctx.perksTable, ctx.level, 2);
        return { level: ctx.level, maxed: xp.maxed, xp, slots, summary: slotsSummary(slots), perks };
    }

    // ---- DOM ----------------------------------------------------------------

    const PIP_NOTE = { used: '', frozen: 'Frozen', ko: 'Revives tomorrow', empty: 'Open', locked: '' };

    function pipHtml(pip) {
        if (pip.kind === 'locked') {
            return `<span class="lp-pip lp-pip--locked" title="Unlocks at level ${pip.level}"><span class="lp-pip-icon" aria-hidden="true">🔒</span><span class="lp-pip-label">Lv ${pip.level}</span></span>`;
        }
        if (pip.kind === 'empty') {
            return `<button type="button" class="lp-pip lp-pip--empty" data-action="create" aria-label="Open routine slot. Create a routine"><span class="lp-pip-icon" aria-hidden="true">+</span><span class="lp-pip-label">Open</span></button>`;
        }
        const note = PIP_NOTE[pip.kind];
        const label = `${pip.name}${note ? ', ' + note.toLowerCase() : ''}`;
        const action = pip.kind === 'ko' ? '' : ' data-action="manage"';
        const tag = pip.kind === 'ko' ? 'span' : 'button';
        const type = pip.kind === 'ko' ? '' : ' type="button"';
        return `<${tag}${type} class="lp-pip lp-pip--${pip.kind}"${action} data-routine-id="${esc(pip.routineId)}" aria-label="${esc(label)}"><span class="lp-pip-icon" aria-hidden="true">${pip.kind === 'frozen' ? '🥶' : pip.emoji}</span><span class="lp-pip-label">${esc(pip.name)}</span>${note ? `<span class="lp-pip-note">${note}</span>` : ''}</${tag}>`;
    }

    function perkRowHtml(perk) {
        return `<li class="lp-perk"><span class="lp-perk-lv">Lv ${perk.level}</span><span class="lp-perk-text">${esc(perk.label || '')}</span></li>`;
    }

    function panelHtml(model) {
        const slots = model.slots;
        const notes = [];
        if (slots.next) notes.push(`Next slot at Lv ${slots.next.level}`);
        else notes.push('All routine slots unlocked');
        if (slots.frozen > 0) notes.push('Frozen routines keep their slot until they recover');
        if (slots.ko > 0) notes.push('A knocked-out routine is paused and revives tomorrow');
        const p = model.perks;
        const currentRows = p.current.map(perkRowHtml).join('');
        const discountRow = (p.discount > 0 && !p.current.some(x => x.type === 'discount'))
            ? `<li class="lp-perk lp-perk--active"><span class="lp-perk-lv">Lv ${p.discountLevel}</span><span class="lp-perk-text">${Math.round(p.discount * 100)}% off the shop (active)</span></li>` : '';
        const nextRows = p.next.map(perkRowHtml).join('');
        const titleRow = p.title && p.title.value
            ? `<div class="lp-title" title="Reached level ${p.title.level}">🏅 ${esc(p.title.value)}</div>` : '';
        return `
            <div class="modal-overlay level-panel-overlay">
                <div class="modal-content level-panel" role="dialog" aria-label="Level ${model.level}">
                    <div class="lp-head">
                        <h3>Level ${model.level}</h3>
                        <span class="lp-xp-text">${esc(model.xp.text)}</span>
                    </div>
                    <div class="lp-xp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(model.xp.pct * 100)}"><span class="lp-xp-fill" style="width:${Math.round(model.xp.pct * 100)}%"></span></div>
                    ${titleRow}
                    <h4 class="lp-section">Routine slots <span class="lp-section-count">${esc(model.summary.replace('Routines ', ''))}</span></h4>
                    <div class="lp-pips">${slots.pips.map(pipHtml).join('')}</div>
                    <p class="lp-note">${notes.map(esc).join('. ')}.</p>
                    <h4 class="lp-section">Perks</h4>
                    <ul class="lp-perks">${currentRows}${discountRow}</ul>
                    ${nextRows ? `<h4 class="lp-section lp-section--next">Coming up</h4><ul class="lp-perks lp-perks--next">${nextRows}</ul>` : ''}
                    <div class="modal-buttons"><button type="button" class="primary-button" data-action="close">Close</button></div>
                </div>
            </div>`;
    }

    /**
     * ctx: buildModel's ctx, plus onManage(routineId) and onCreate().
     * Opens the panel (one at a time) and wires its buttons. Buttons that open
     * another window stopPropagation (Modal's document click handler would
     * otherwise close the window the same click just opened) and close the
     * panel first.
     */
    function open(ctx) {
        const model = buildModel(ctx);
        const overlay = Modal.open(panelHtml(model), { dedupeSelector: '.level-panel-overlay' });
        if (!overlay) return;
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest ? e.target.closest('[data-action]') : null;
            if (!btn) return;
            e.stopPropagation();
            const action = btn.dataset.action;
            if (action === 'close') { overlay.remove(); return; }
            overlay.remove();
            if (action === 'manage' && ctx.onManage) ctx.onManage(btn.dataset.routineId);
            if (action === 'create' && ctx.onCreate) ctx.onCreate();
        });
    }

    return {
        xpModel,
        levelForSlotCount,
        slotsModel,
        slotsSummary,
        perksModel,
        buildModel,
        panelHtml,
        open,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LevelPanel;
}

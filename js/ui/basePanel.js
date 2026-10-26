/**
 * BasePanel -- the Base Health panel (docs/BASE_PANEL_PLAN.md step 2, 2026-10-26).
 * Opened (step 4) from the HUD health number. Answers: when is +1 HP, when does the
 * church art improve, how fast is it being damaged, when does it fall, what do my
 * items buy. All numbers come from BaseModel.build (pure, js/baseModel.js).
 *
 * PURE / DOM split like levelPanel.js: buildViewModel, panelHtml, structureSignature
 * are pure and unit-tested (test/basePanel.test.js); open() is DOM and live-checked.
 * Globals read at call time: BaseModel, Modal.
 *
 * open(deps):
 *   getContext()          -> BaseModel.build ctx { health, nowMs, lastRegenTickMs, attackers,
 *                            inventory, shopItems, config } PLUS { points, pushbackPrice,
 *                            pushbackLabel?, nextDue?: { name, dueMs } }. Called every second.
 *   onPushback(attackerId) -> { ok }   buys the 1 hr tier for that attacker
 *   onUseKit(kitId)        -> any      uses a held repair kit
 * Live refresh: text that ticks lives in <span data-bind="key"> and is patched in place;
 * the markup is rebuilt only when its structure changes (an HP step, a button state), so
 * a tap is never swallowed by a re-render. Interval and listeners stop when the overlay
 * leaves the DOM (checked on each tick).
 */
const BasePanel = (() => {
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ESC[c]);
    }

    const MAX_ATTACKERS_SHOWN = 3;
    const REFRESH_MS = 1000;
    const STATE_LABELS = { healing: 'Healing', attacked: 'Under attack', full: 'Full strength' };
    const STATE_ICONS = { healing: '✚', attacked: '⚠', full: '✔' };
    const FOOTNOTE = 'The base heals while you are away, and pauses only while a zombie is attacking.';

    // ---- pure ---------------------------------------------------------------

    function kitShortName(name) {
        const m = /\(([^)]+)\)/.exec(name || '');
        return m ? m[1] : (name || 'Repair');
    }

    function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }

    /** Info-popover notes for the kits: wasted HP and "lands 1 HP short of the next look". */
    function kitNotes(kits, max) {
        const notes = [];
        kits.forEach(k => {
            const short = kitShortName(k.name);
            if (k.effectiveHeal <= 0) return;
            if (k.wasted > 0) notes.push(`${short} kit heals ${k.heal} but only ${k.effectiveHeal} would fit, so ${k.wasted} HP would be wasted.`);
            if (k.landsAt > 0 && k.landsAt < max && BaseModel.STAGE_FLOORS.indexOf(k.landsAt) !== -1) {
                notes.push(`${short} kit lands at ${k.landsAt} HP, 1 HP short of the next church look.`);
            }
        });
        return notes;
    }

    /**
     * Everything the panel renders. `ui` = { showAll, info } (local panel state; info is
     * null | 'attackers' | 'kits'). `binds` holds every ticking string keyed by name.
     */
    function buildViewModel(ctx, ui) {
        ui = ui || {};
        const m = BaseModel.build(ctx);
        const fmt = BaseModel.formatApprox, cd = BaseModel.formatCountdown;
        const points = Math.max(0, Math.floor(ctx.points || 0));
        const binds = {};
        const vm = {
            state: m.state, stateLabel: STATE_LABELS[m.state], stateIcon: STATE_ICONS[m.state],
            color: m.color, health: m.health, max: m.max, points,
            pct: m.max > 0 ? (m.health / m.max) * 100 : 0,
            ticks: BaseModel.STAGE_FLOORS.filter(t => t > 0).map(t => ({ at: t, pct: (t / m.max) * 100 })),
            lossPct: 0, timer: null, strip: null, attackers: null, kits: [], kitNotes: [],
            warning: null, footnote: FOOTNOTE, ui: { showAll: !!ui.showAll, info: ui.info || null }, binds,
        };

        if (m.state === 'attacked') {
            vm.lossPct = m.max > 0 ? (m.lossNext15 / m.max) * 100 : 0;
            binds.timer = m.worsenMs == null ? '—' : fmt(m.worsenMs);
            binds.timerSub = `Next hit in ${cd(m.nextHitMs)}`;
            vm.timer = { label: 'Church looks worse in', sub: null };
            vm.warning = { key: 'falls' };
            binds.falls = m.fallsMs == null ? '' : fmt(m.fallsMs);
        } else if (m.state === 'healing') {
            if (m.nextStageMs != null) {
                binds.timer = fmt(m.nextStageMs);
                vm.timer = { label: 'Church looks better in', sub: `at ${m.nextStageHp} HP · ${plural(m.healsToStage, 'heal')} to go`, subBind: null };
            } else {
                binds.timer = fmt(m.fullMs);
                vm.timer = { label: 'Back to full strength in', sub: `${m.max - m.health} HP to go`, subBind: null };
            }
            binds.nextHeal = cd(m.nextHealMs);
            binds.fullIn = fmt(m.fullMs);
            vm.strip = { nextHealLabel: '+1 HP in', fullLabel: 'Full in' };
        } else {
            binds.timer = 'All clear';
            const nd = ctx.nextDue;
            binds.timerSub = nd && typeof nd.dueMs === 'number'
                ? `Next due: ${nd.name || 'a task'} in ${fmt(Math.max(0, nd.dueMs - ctx.nowMs))}` : 'Nothing due soon';
            vm.timer = { label: 'No zombies at the walls', sub: null };
        }

        if (m.state === 'attacked') {
            const price = (typeof ctx.pushbackPrice === 'number') ? ctx.pushbackPrice : null;
            const label = ctx.pushbackLabel || '1 hr';
            const rows = m.attackers.map(a => {
                binds['over_' + a.id] = `overdue ${fmt(a.overdueMs)}`;
                binds['hit_' + a.id] = cd(a.nextHitMs);
                const row = { id: a.id, name: a.name || 'Zombie', price, label, canBuy: false, need: 0, ariaLabel: '' };
                if (price !== null) {
                    row.need = Math.max(0, price - points);
                    row.canBuy = row.need === 0;
                    row.ariaLabel = `Push back ${row.name} by ${label}, costs ${price} points.` +
                        (row.canBuy ? '' : ` Disabled, you need ${row.need} more points.`);
                }
                return row;
            });
            const shown = ui.showAll ? rows : rows.slice(0, MAX_ATTACKERS_SHOWN);
            vm.attackers = { rows: shown, total: rows.length, more: rows.length - shown.length, expanded: !!ui.showAll && rows.length > MAX_ATTACKERS_SHOWN };
        }

        vm.kits = m.kits.map(k => {
            const short = kitShortName(k.name);
            let note, ariaLabel;
            const bought = (m.state === 'healing' && k.savesMs != null) ? `saves ${fmt(k.savesMs)}`
                : (m.state === 'attacked' && k.buysMs != null) ? `buys ${fmt(k.buysMs)}` : '';
            if (m.state === 'full') { note = 'not needed'; ariaLabel = `${short} repair kit, not needed, the base is at full health.`; }
            else if (m.health <= 0) { note = 'too late'; ariaLabel = `${short} repair kit unavailable, the base has fallen.`; }
            else if (k.held <= 0) { note = 'none held'; ariaLabel = `${short} repair kit, none held. Buy one in the shop.`; }
            else { note = `+${k.effectiveHeal} HP${bought ? ' · ' + bought : ''}`; ariaLabel = `Use ${short} repair kit, ${k.held} held, heals ${k.effectiveHeal} HP${bought ? ', ' + bought : ''}.`; }
            return { id: k.id, short, held: k.held, heal: k.heal, usable: k.usable, note, ariaLabel };
        });
        vm.kitNotes = kitNotes(m.kits, m.max);
        return vm;
    }

    /**
     * HUD chip next to the health number (step 3). Same ctx as buildViewModel.
     * -> { state, color, pct, text, aria }  text: "+1 in 3m" while healing, "−N / 5m" while
     * attacked (N = HP lost per DAMAGE_INTERVAL_MS across all attackers, a work timer
     * slows its zombie so N can be fractional), "Full" at full strength, "Fallen" at 0 HP.
     */
    function chipModel(ctx) {
        const m = BaseModel.build(ctx);
        const c = ctx.config;
        const mins = Math.round(c.DAMAGE_INTERVAL_MS / 60000);
        let text;
        if (m.health <= 0) text = 'Fallen';
        else if (m.state === 'attacked') {
            const per = (ctx.attackers || []).reduce((s, a) =>
                s + c.OVERDUE_DAMAGE * c.DAMAGE_INTERVAL_MS / (a.tickMs > 0 ? a.tickMs : c.DAMAGE_INTERVAL_MS), 0);
            const n = Math.round(per * 10) / 10;
            text = `\u2212${n} / ${mins}m`;
        } else if (m.state === 'healing') {
            text = `+${c.BASE_REGEN_HP} in ${Math.max(1, Math.ceil(m.nextHealMs / 60000))}m`;
        } else text = 'Full';
        return {
            state: m.state, color: m.color, pct: m.max > 0 ? (m.health / m.max) * 100 : 0, text,
            aria: `Base health ${Math.round(m.health)} of ${m.max}, ${STATE_LABELS[m.state].toLowerCase()}.${m.state === 'full' ? '' : ' ' + text + '.'} Open base health panel`,
        };
    }

    // Replaces every ticking text with nothing so two renders of the same structure compare equal.
    function structureSignature(html) {
        return html.replace(/(<span data-bind="[^"]*">)[^<]*(<\/span>)/g, '$1$2');
    }

    // ---- markup -------------------------------------------------------------

    function bind(vm, key) {
        return `<span data-bind="${esc(key)}">${esc(vm.binds[key])}</span>`;
    }

    function infoButton(which, label, vm) {
        const open = vm.ui.info === which;
        return `<button type="button" class="bp-info-btn" data-action="info" data-info="${which}" data-key="info-${which}" aria-label="${esc(label)}" aria-expanded="${open}">i</button>`;
    }

    function attackersHtml(vm) {
        const a = vm.attackers;
        if (!a) return '';
        const rows = a.rows.map(r => {
            const btn = r.price === null ? '' :
                `<button type="button" class="bp-push" data-action="pushback" data-attacker-id="${esc(r.id)}" data-key="push-${esc(r.id)}"${r.canBuy ? '' : ' disabled'} aria-label="${esc(r.ariaLabel)}">` +
                `<span class="bp-push-main">Push back ${esc(r.label)}</span>` +
                `<span class="bp-push-sub">${r.canBuy ? `${r.price} pts` : `Need ${r.need} more pts`}</span></button>`;
            return `<li class="bp-attacker"><div class="bp-attacker-info"><span class="bp-attacker-name">${esc(r.name)}</span>` +
                `<span class="bp-attacker-meta">${bind(vm, 'over_' + r.id)} · hits in ${bind(vm, 'hit_' + r.id)}</span></div>${btn}</li>`;
        }).join('');
        const more = a.more > 0
            ? `<button type="button" class="bp-link" data-action="showall" data-key="showall">${plural(a.more, 'more attacker')} · Show all</button>`
            : (a.expanded ? `<button type="button" class="bp-link" data-action="showfew" data-key="showall">Show fewer</button>` : '');
        const pop = vm.ui.info === 'attackers'
            ? `<div class="bp-popover" role="note">Each zombie past its due time hits the church for 1 HP every 5 minutes (slower while you run a work timer on it). Pushing one back moves its due time to 1 hour from now, which stops its hits. Healing resumes once no zombie is attacking.</div>` : '';
        return `<section class="bp-card bp-attackers" aria-label="Attackers">` +
            `<div class="bp-card-head"><h4>Attackers <span class="bp-count">${a.total}</span></h4>${infoButton('attackers', 'How attackers work', vm)}</div>${pop}` +
            `<ul class="bp-attacker-list">${rows}</ul>${more}</section>`;
    }

    function kitsHtml(vm) {
        const buttons = vm.kits.map(k => {
            const dis = k.usable ? '' : ' disabled';
            return `<button type="button" class="bp-kit" data-action="kit" data-kit-id="${esc(k.id)}" data-key="kit-${esc(k.id)}"${dis} aria-label="${esc(k.ariaLabel)}">` +
                `<span class="bp-kit-main">Use ${esc(k.short)} kit${k.held > 0 ? ` ×${k.held}` : ''}</span><span class="bp-kit-sub">${esc(k.note)}</span></button>`;
        }).join('');
        const pop = vm.ui.info === 'kits'
            ? `<div class="bp-popover" role="note">${vm.kitNotes.length ? vm.kitNotes.map(esc).join(' ') : 'Repair kits restore HP at once. Kits that heal more than the base is missing waste the extra.'}</div>` : '';
        return `<section class="bp-card bp-kits" aria-label="Repair kits">` +
            `<div class="bp-card-head"><h4>Repair kits</h4>${infoButton('kits', 'About repair kits', vm)}</div>${pop}` +
            `<div class="bp-kit-row">${buttons}</div></section>`;
    }

    function innerHtml(vm) {
        const ticks = vm.ticks.map(t => `<span class="bp-tick" style="left:${t.pct}%"></span>`).join('');
        const lossLeft = Math.max(0, vm.pct - vm.lossPct);
        const loss = vm.lossPct > 0 ? `<span class="bp-loss" style="left:${lossLeft}%;width:${vm.pct - lossLeft}%"></span>` : '';
        const t = vm.timer;
        const sub = t.sub != null ? `<span class="bp-timer-sub">${esc(t.sub)}</span>` : `<span class="bp-timer-sub">${bind(vm, 'timerSub')}</span>`;
        const strip = vm.strip
            ? `<div class="bp-strip"><span>${esc(vm.strip.nextHealLabel)} ${bind(vm, 'nextHeal')}</span><span>${esc(vm.strip.fullLabel)} ${bind(vm, 'fullIn')}</span></div>` : '';
        const warning = vm.warning
            ? `<p class="bp-warning" role="status">At this rate the church falls in ${bind(vm, 'falls')}.</p>` : '';
        return `
            <div class="bp-head">
                <span class="bp-chip bp-chip--${vm.color}" role="img" aria-label="${vm.health} of ${vm.max} health">${Math.round(vm.health)}</span>
                <h3>Base Health</h3>
                <span class="bp-points" aria-label="${vm.points} points">${vm.points} pts</span>
            </div>
            <div class="bp-status bp-status--${vm.state}"><span aria-hidden="true">${vm.stateIcon}</span> ${esc(vm.stateLabel)}</div>
            <div class="bp-timer"><span class="bp-timer-label">${esc(t.label)}</span><span class="bp-timer-value">${bind(vm, 'timer')}</span>${sub}</div>
            <div class="bp-bar bp-bar--${vm.color}" role="progressbar" aria-valuemin="0" aria-valuemax="${vm.max}" aria-valuenow="${Math.round(vm.health)}">
                <span class="bp-fill" style="width:${vm.pct}%"></span>${loss}${ticks}
            </div>
            ${strip}
            ${warning}
            ${attackersHtml(vm)}
            ${kitsHtml(vm)}
            <p class="bp-foot">${esc(vm.footnote)}</p>
            <div class="modal-buttons"><button type="button" class="primary-button" data-action="close" data-key="close">Close</button></div>`;
    }

    function panelHtml(vm) {
        return `<div class="modal-overlay base-panel-overlay"><div class="modal-content base-panel" role="dialog" aria-label="Base Health">${innerHtml(vm)}</div></div>`;
    }

    // ---- DOM ----------------------------------------------------------------

    function open(deps) {
        const ui = { showAll: false, info: null };
        let vm = buildViewModel(deps.getContext(), ui);
        const overlay = Modal.open(panelHtml(vm), { dedupeSelector: '.base-panel-overlay' });
        if (!overlay) return;
        const panel = overlay.querySelector('.base-panel');
        let lastSig = structureSignature(innerHtml(vm));
        let timerId = null;

        function stop() {
            if (timerId !== null) { clearInterval(timerId); timerId = null; }
            window.removeEventListener('keydown', onKey, true);
            document.removeEventListener('click', onOutside, true);
        }

        function render() {
            if (!overlay.isConnected) { stop(); return; }
            vm = buildViewModel(deps.getContext(), ui);
            const html = innerHtml(vm);
            const sig = structureSignature(html);
            if (sig === lastSig) {
                panel.querySelectorAll('[data-bind]').forEach(el => {
                    const v = vm.binds[el.dataset.bind];
                    const text = v == null ? '' : String(v);
                    if (el.textContent !== text) el.textContent = text;
                });
                return;
            }
            const active = document.activeElement;
            const key = active && panel.contains(active) ? active.dataset.key : null;
            panel.innerHTML = html;
            lastSig = sig;
            if (key) {
                const again = panel.querySelector(`[data-key="${key}"]`);
                if (again && !again.disabled) again.focus();
            }
        }

        // ESC closes an open info popover first; a second ESC reaches Modal and closes the panel.
        function onKey(e) {
            if (e.key === 'Escape' && ui.info) { e.stopPropagation(); e.preventDefault(); ui.info = null; render(); }
        }
        function onOutside(e) {
            if (!ui.info || !overlay.isConnected) return;
            if (e.target.closest && (e.target.closest('.bp-popover') || e.target.closest('.bp-info-btn'))) return;
            ui.info = null;
            render();
        }
        window.addEventListener('keydown', onKey, true);
        document.addEventListener('click', onOutside, true);

        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest ? e.target.closest('[data-action]') : null;
            if (!btn || btn.disabled) return;
            e.stopPropagation();
            const action = btn.dataset.action;
            if (action === 'close') { stop(); overlay.remove(); return; }
            if (action === 'info') { ui.info = (ui.info === btn.dataset.info) ? null : btn.dataset.info; }
            else if (action === 'showall') ui.showAll = true;
            else if (action === 'showfew') ui.showAll = false;
            else if (action === 'pushback' && deps.onPushback) deps.onPushback(btn.dataset.attackerId);
            else if (action === 'kit' && deps.onUseKit) deps.onUseKit(btn.dataset.kitId);
            render();
        });

        timerId = setInterval(render, REFRESH_MS);
    }

    return { kitShortName, kitNotes, chipModel, buildViewModel, structureSignature, innerHtml, panelHtml, open, STATE_LABELS };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BasePanel;
}

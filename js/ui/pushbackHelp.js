/**
 * PushbackHelp -- the words and little pictures for pushback charges (Build C, 2026-11-02; plan
 * docs/PUSHBACK_CHARGES_PLAN.md "Copy"). ONE copy builder, so the zombie popup, the edit form and the Shop all
 * tell the same story and the live numbers (allowance, charges left, held tokens) come from the same place.
 *
 * PURE (no DOM, no globals): every function takes plain data and returns a string / object. Callers:
 *   - hintHtml(ctx)         the inside of the (i) panel (`.form-hint-pop`) in the popup, edit form and Shop
 *   - dotsHtml(left, total) the charge dots on a popup button (filled = free charge left, hollow = used)
 *   - rewardModel(...)      data for the Clock tower card's "Your reward" block (VillageCard renders it)
 *   - starUpText(...)       the Clock tower star-up toast ("Clock tower ★2: +1 Short pushback a day")
 *   - wireHint(root)        (DOM, tiny) makes every `.form-hint-btn[data-hint-for]` under `root` toggle its panel
 *
 * ctx for hintHtml: {
 *   allowance?: { short, medium, long }   free charges per window at the current Clock tower star
 *   left?:      { short, medium, long }   free charges left right now
 *   held?:      { short, medium, long }   tokens held
 *   star?:      number                    current Clock tower star (1..5)
 * }  All optional: without them the panel shows the rules only.
 */
const PushbackHelp = (() => {
    const NAMES = { short: 'Short', medium: 'Medium', long: 'Long' };
    const SPANS = { short: 'up to 30 min', medium: 'up to 2 hr', long: 'up to 1 day' };
    const PERIOD = { short: 'a day', medium: 'a day', long: 'a week' };
    const IDS = ['short', 'medium', 'long'];

    function num(v) {
        const n = Math.floor(Number(v));
        return Number.isFinite(n) && n > 0 ? n : 0;
    }

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // "Short 3 a day · Medium 2 a day · Long 2 a week"
    function allowanceText(allowance) {
        const a = allowance || {};
        return IDS.map(id => `${NAMES[id]} ${num(a[id])} ${PERIOD[id]}`).join(' · ');
    }

    // The free-allowance line with the spans. The numbers come from the caller's allowance (config, never hardcoded
    // here); without one the line names the sizes only.
    function rulesLine(allowance) {
        return IDS.map(id => `${NAMES[id]} (${SPANS[id]})` + (allowance ? `: ${num(allowance[id])} ${PERIOD[id]}` : '')).join(' \u00B7 ');
    }

    /**
     * The (i) panel's inner HTML. The rules (plan copy, Jeremy-approved wording in Build C) never change with the
     * player's progress except the numbers: the base allowance is quoted as-is, then "Right now" shows the live state.
     */
    function hintHtml(ctx) {
        const c = ctx || {};
        const allowance = c.allowance || null;
        const left = c.left || null;
        const held = c.held || null;

        let live = '';
        if (allowance && left) {
            const rows = IDS.map(id => `${NAMES[id]} ${Math.min(num(left[id]), num(allowance[id]))} of ${num(allowance[id])} left ${id === 'long' ? 'this week' : 'today'}`);
            live += `<p class="pb-live"><strong>Right now${c.star ? ` (Clock tower ★${num(c.star) || 1})` : ''}:</strong> ${rows.join(' · ')}</p>`;
        }
        if (held) {
            const parts = IDS.filter(id => num(held[id]) > 0).map(id => `${num(held[id])} ${NAMES[id]}`);
            live += `<p class="pb-live"><strong>Tokens held:</strong> ${parts.length ? parts.join(' · ') : 'none'}</p>`;
        }

        return `<strong>Rescheduling is free when:</strong>` +
            `<ul>` +
            `<li>you move it earlier</li>` +
            `<li>it’s more than 4 hours away</li>` +
            `<li>you fix the time within 10 minutes of creating it (this never counts as pushed back)</li>` +
            `</ul>` +
            `<strong>Inside 4 hours, moving it later uses a pushback:</strong>` +
            `<p>${esc(rulesLine(allowance))}</p>` +
            `<p>Daily pushbacks refill each new day; Long ones refill over the week.</p>` +
            `<p>Out of pushbacks? A held token is used, then points.</p>` +
            live +
            `<p>Clock tower stars give you more. A task pushed inside its last 4 hours won’t count as on time at the Clock tower.</p>`;
    }

    // Charge dots: `total` dots, the first `left` filled. Nothing when total is 0.
    function dotsHtml(left, total) {
        const t = Math.min(8, num(total));
        if (t === 0) return '';
        const l = Math.min(t, num(left));
        let out = '';
        for (let i = 0; i < t; i++) out += `<span class="pb-dot${i < l ? ' pb-dot--on' : ''}"></span>`;
        return `<span class="pb-dots" role="img" aria-label="${l} of ${t} free pushbacks left">${out}</span>`;
    }

    // What going from star-1 to `star` adds: { size, n, text } or null (no change / star 1 / bad input).
    function starGain(star, table) {
        const s = num(star);
        if (s < 2 || !table) return null;
        const now = table[s];
        const before = table[s - 1];
        if (!now || !before) return null;
        for (const id of IDS) {
            const d = num(now[id]) - num(before[id]);
            if (d > 0) return { size: id, n: d, text: `+${d} ${NAMES[id]} pushback${d === 1 ? '' : 's'} ${PERIOD[id]}` };
        }
        return null;
    }

    // Toast / notice text when the Clock tower reaches `star`. Null when that star adds nothing.
    function starUpText(star, table) {
        const g = starGain(star, table);
        return g ? `Clock tower ★${num(star)}: ${g.text}` : null;
    }

    /**
     * The Clock tower card's "Your reward" block: what the free allowance is now and what the next star adds.
     * { current: 'Short 3 a day · ...', next: '★ 2 adds +1 Short pushback a day' | null (maxed), grace }
     */
    function rewardModel(opts) {
        const o = opts || {};
        const table = o.table || {};
        const star = Math.max(1, num(o.star) || 1);
        const keys = Object.keys(table).map(Number).filter(Number.isFinite);
        const top = keys.length ? Math.max.apply(null, keys) : 1;
        const cur = table[Math.min(star, top)] || {};
        let next = null;
        if (star < top) {
            const g = starGain(star + 1, table);
            next = g ? `Star ${star + 1} adds ${g.text}` : null;
        }
        return {
            current: allowanceText(cur),
            next,
            maxed: star >= top,
        };
    }

    // The one-line Shop section header text.
    const SHOP_LINE = 'Used automatically when your free pushbacks run out.';

    // The shared (i) button and panel (same classes as the habit-goal hint). `id` must be unique on the page.
    function hintButtonHtml(id, label) {
        return `<button type="button" class="form-hint-btn" data-hint-for="${esc(id)}" aria-label="${esc(label || 'How pushbacks work')}" aria-expanded="false">&#9432;</button>`;
    }
    function hintPopHtml(id, ctx) {
        return `<div class="form-hint-pop pushback-hint-pop" id="${esc(id)}" hidden>${hintHtml(ctx)}</div>`;
    }
    // Button + (optional small caption) + panel in one string. `caption` e.g. "How rescheduling works".
    function hintBlockHtml(id, ctx, label, caption) {
        return hintButtonHtml(id, label) +
            (caption ? `<span class="pushback-help-caption">${esc(caption)}</span>` : '') +
            hintPopHtml(id, ctx);
    }

    // DOM: toggle every (i) button under `root`. Stops the tap so Modal's outside-click dismiss doesn't see it.
    // Idempotent per button (flag), so a re-render can call it again.
    function wireHint(root) {
        if (!root || !root.querySelectorAll) return;
        root.querySelectorAll('.form-hint-btn[data-hint-for]').forEach((btn) => {
            if (btn.dataset.pbWired === '1') return;
            // Look inside `root` first so a detached fragment (the Shop header is wired before it is attached) works.
            const id = btn.dataset.hintFor;
            const pop = Array.prototype.find.call(root.querySelectorAll('.form-hint-pop'), el => el.id === id)
                || (btn.ownerDocument || document).getElementById(id);
            if (!pop) return;
            btn.dataset.pbWired = '1';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                pop.hidden = !pop.hidden;
                btn.setAttribute('aria-expanded', String(!pop.hidden));
            });
        });
    }

    return {
        NAMES, SPANS, PERIOD, SHOP_LINE,
        allowanceText, hintHtml, hintButtonHtml, hintPopHtml, hintBlockHtml, dotsHtml, starGain, starUpText, rewardModel, wireHint,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PushbackHelp;
}

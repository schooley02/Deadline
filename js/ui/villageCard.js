/**
 * VillageCard -- the building card (V7 W2 village, Build 2, 2026-10-30; plan docs/WORLD_FEEDBACK_PLAN.md
 * "Village tiers + building cards"). Tapping a village building opens it through `Modal`, like the level panel.
 *
 * Shows: the sprite at 3x/2x when that fits, else fitted to the column height (3x for the 128px canvases, 1.5x for the Clock tower), the building's name, five tier STARS (filled = earned, in the header),
 * a progress bar "N / M <unit> to earn star <n+1>" ("Fully rebuilt" at T5), the flavour lines that never
 * drive a tier (school = attendance streak, windmill = comeback days), then "What we measure" and "Why it helps" (KINDS[kind].measures / .why). Two empty states: the gym with no bad
 * habit to resist, the school with no routine.
 *
 * PURE / DOM split like the other UI modules: `buildModel` and `cardHtml` are pure and unit-tested
 * (test/villageCard.test.js); `open` is DOM and live-checked. Global read at call time: Modal.
 *
 * buildModel(ctx): ctx = {
 *   kind,           'nights' | 'slain' | 'punctuality' | 'habits' | 'lurkers' | 'defense' | 'heroes' | 'bestdays'
 *   progress,       VillageProgress.compute(...)[kind] -> { tier, value, prevAt, nextAt, toNext, maxed, fraction }
 *   extras?,        VillageProgress.extras(...) -> { attendanceStreak, comebackDays }
 *   hasBadHabit?,   true when at least one active (non-archived) negative habit exists (gym empty state)
 *   hasRoutine?,    true when at least one routine exists (school empty state)
 *   spriteUrl?, spriteW?, spriteH?, spriteFlip?   the building's current sprite (mirrored like the scene when spriteFlip)
 * }
 */
const VillageCard = (() => {
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ESC[c]);
    }

    const MAX_TIER = 5;

    // One entry per building kind: its name, one line on what it measures, and the unit used in the bar.
    const KINDS = {
        nights: {
            name: 'Radio tower', unit: 'nights',
            measures: 'Nights your base has survived in this run: every midnight that passes with the church still standing.',
            why: 'Surviving night after night is the whole game. It rewards steady, everyday follow-through over one big push, so a long streak of small wins beats a single heroic day.',
        },
        slain: {
            name: 'Armory', unit: 'done',
            measures: 'Tasks, sub-tasks and habits you have completed in this run.',
            why: 'Finishing things is what turns plans into progress. Breaking a big job into sub-tasks gives you more small wins to count, and every win keeps your momentum going.',
        },
        punctuality: {
            name: 'Clock tower', unit: 'on time',
            measures: 'Things you completed before their due time. Finishing late still counts as done, just not here.',
            why: 'Done on time beats done late: it keeps the base safe and builds trust in your own schedule. Getting ahead of the clock, not just across the line, is what lowers stress.',
        },
        habits: {
            name: 'Hospital', unit: 'check-ins',
            measures: 'Habit check-ins in this run. Every habit you check off counts once.',
            why: 'Habits grow through repetition. Every check-in is one more rep, and a long unbroken run of reps is how a routine starts to feel automatic instead of like effort.',
        },
        lurkers: {
            name: 'Boxing gym', unit: 'clean days',
            measures: 'Days you had a bad habit due and did not slip. Days with nothing to resist do not count.',
            why: 'Resisting something you are trying to quit is a skill that gets stronger with practice. Counting clean days shows how often you win the fight, not how rarely you lose it.',
        },
        defense: {
            name: 'Jailhouse', unit: 'nights',
            measures: 'Nights the church ended the day at 75% health or better.',
            why: 'A healthy base means you are not letting deadlines pile up. Ending your days strong keeps you out of the hole, where catching up costs the most.',
        },
        heroes: {
            name: 'High school', unit: 'perfect days',
            measures: 'Days every active routine was fully done, with nothing skipped.',
            why: 'Routines are the habits that hold your day together. Finishing the whole set, not just part of it, is what makes a routine stick.',
        },
        bestdays: {
            name: 'Windmill', unit: 'heavy days',
            measures: 'Heavy days (busier than your recent average) that you got through with nothing missed.',
            why: 'Anyone can keep up on a light day. Getting through a heavy one cleanly shows you can handle pressure, and that is how your capacity grows.',
        },
    };

    const EMPTY_TEXT = {
        lurkers: 'Add a habit to resist to start rebuilding.',
        heroes: 'Start a routine to open the school.',
    };

    function count(n) { return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; }

    function plural(n, one, many) { return n === 1 ? one : many; }

    /** The five pips: done (below the current tier), current, or locked (above it). */
    function pipsFor(tier) {
        const t = Math.min(MAX_TIER, Math.max(1, Math.round(tier) || 1));
        const out = [];
        for (let n = 1; n <= MAX_TIER; n++) {
            out.push({ n, state: n < t ? 'done' : (n === t ? 'current' : 'locked') });
        }
        return out;
    }

    // Two-column card (art left, text right). Whole-number scales keep the pixels perfectly even, so the sprite uses 3x
    // (then 2x) when that fits the art column: 3x for the 128px-tall canvases. A canvas too tall for 2x (the Clock tower,
    // 128x256) is instead fitted to the column height (FIT_H), so its height matches the 3x buildings: 1.5x, a
    // non-whole scale that image-rendering: pixelated keeps crisp (some pixels come out a hair wider than others).
    const MAX_ART_W = 384;
    const MAX_ART_H = 400;
    const FIT_H = 384;
    function spriteScale(w, h) {
        for (let k = 3; k >= 2; k--) {
            if (w * k <= MAX_ART_W && h * k <= MAX_ART_H) return k;
        }
        if (!(w > 0) || !(h > 0)) return 1;
        return Math.round(Math.min(FIT_H / h, MAX_ART_W / w) * 100) / 100;
    }

    function buildModel(ctx) {
        const c = ctx || {};
        const meta = KINDS[c.kind] || { name: 'Building', measures: '', why: '', unit: '' };
        const p = c.progress || {};
        const tier = Math.min(MAX_TIER, Math.max(1, Math.round(p.tier) || 1));
        const value = count(p.value);
        const maxed = !!p.maxed || tier >= MAX_TIER;
        const nextAt = (!maxed && Number.isFinite(p.nextAt)) ? p.nextAt : null;
        const fraction = maxed ? 1 : Math.min(1, Math.max(0, Number.isFinite(p.fraction) ? p.fraction : 0));

        let barText;
        if (maxed) barText = 'Fully rebuilt';
        else if (nextAt === null) barText = value + ' ' + meta.unit;
        else barText = value + ' / ' + nextAt + ' ' + meta.unit + ' to earn star ' + (tier + 1);

        const lines = [];
        const ex = c.extras || {};
        if (c.kind === 'heroes') {
            const streak = count(ex.attendanceStreak);
            if (streak > 0) lines.push('Perfect-attendance streak: ' + streak + ' ' + plural(streak, 'day', 'days') + '.');
        }
        if (c.kind === 'bestdays') {
            const back = count(ex.comebackDays);
            if (back > 0) lines.push('Comeback days this run: ' + back + '. A clean day right after a rough one.');
        }

        let empty = null;
        if (c.kind === 'lurkers' && c.hasBadHabit === false) empty = EMPTY_TEXT.lurkers;
        if (c.kind === 'heroes' && c.hasRoutine === false) empty = EMPTY_TEXT.heroes;

        return {
            kind: c.kind,
            name: meta.name,
            measures: meta.measures,
            why: meta.why || '',
            unit: meta.unit,
            tier,
            maxed,
            value,
            nextAt,
            toNext: maxed ? 0 : count(p.toNext),
            fraction,
            pips: pipsFor(tier),
            barText,
            lines,
            empty,
            spriteUrl: c.spriteUrl || null,
            spriteW: count(c.spriteW),
            spriteH: count(c.spriteH),
            spriteScale: spriteScale(count(c.spriteW), count(c.spriteH)),
            spriteFlip: !!c.spriteFlip,
        };
    }

    // Tier as five stars (2026-10-30, Jeremy): filled = earned (the current tier counts), empty = still to earn. One
    // shared builder: the card header, the village panel rows. `size` is the star's px width/height.
    const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
    function starsHtml(tier, size) {
        const t = Math.min(MAX_TIER, Math.max(1, Math.round(tier) || 1));
        const px = Number.isFinite(size) && size > 0 ? size : 18;
        let out = '';
        for (let n = 1; n <= MAX_TIER; n++) {
            out += `<svg class="vc-star${n <= t ? ' vc-star--on' : ''}" viewBox="0 0 24 24" width="${px}" height="${px}" aria-hidden="true" focusable="false"><path d="${STAR_PATH}"/></svg>`;
        }
        return `<span class="vc-stars" role="img" aria-label="Tier ${t} of ${MAX_TIER}" title="Tier ${t} of ${MAX_TIER}">${out}</span>`;
    }

    function cardHtml(model) {
        const m = model;
        const pct = Math.round(m.fraction * 100);
        const sprite = m.spriteUrl
            ? `<img class="vc-sprite" src="${esc(m.spriteUrl)}" alt="" draggable="false"${(m.spriteW || m.spriteFlip) ? ` style="${m.spriteW ? `width:${Math.round(m.spriteW * m.spriteScale)}px;` : ''}${m.spriteFlip ? 'transform:scaleX(-1);' : ''}"` : ''}>`
            : '';
        const emptyHtml = m.empty ? `<p class="vc-empty">${esc(m.empty)}</p>` : '';
        const linesHtml = m.lines.map(l => `<p class="vc-line">${esc(l)}</p>`).join('');
        return `
            <div class="modal-overlay village-card-overlay">
                <div class="modal-content village-card" role="dialog" aria-label="${esc(m.name)}, tier ${m.tier}">
                    <div class="vc-body">
                        <div class="vc-art">${sprite}</div>
                        <div class="vc-info">
                            <div class="vc-head">
                                <h3>${esc(m.name)}</h3>
                                ${starsHtml(m.tier, 18)}
                            </div>
                            <div class="vc-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span class="vc-fill" style="width:${pct}%"></span></div>
                            <p class="vc-bar-text${m.maxed ? ' vc-bar-text--maxed' : ''}">${esc(m.barText)}</p>
                            ${emptyHtml}${linesHtml}
                            ${m.measures ? `<p class="vc-label">What we measure</p><p class="vc-measures">${esc(m.measures)}</p>` : ''}
                            ${m.why ? `<p class="vc-label">Why it helps</p><p class="vc-why">${esc(m.why)}</p>` : ''}
                        </div>
                    </div>
                    <button type="button" class="modal-close-x" data-action="close" aria-label="Close">
                        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2 2 L10 10 M10 2 L2 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </div>`;
    }

    /**
     * ctx: buildModel's ctx. Opens the card (one at a time). Whatever tap opens it MUST stopPropagation, or
     * Modal's document click handler closes the card in the same click. Closing: the small corner x, a tap on the
     * backdrop (Modal's document handler removes the overlay when the click lands on it), or Esc.
     */
    function open(ctx) {
        const model = buildModel(ctx);
        const overlay = Modal.open(cardHtml(model), { dedupeSelector: '.village-card-overlay' });
        if (!overlay) return;
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest ? e.target.closest('[data-action]') : null;
            if (!btn) return;
            e.stopPropagation();
            if (btn.dataset.action === 'close') overlay.remove();
        });
    }

    return { KINDS, MAX_TIER, EMPTY_TEXT, pipsFor, starsHtml, spriteScale, buildModel, cardHtml, open };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VillageCard;
}

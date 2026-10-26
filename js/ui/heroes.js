/**
 * HeroesView — pure hero view-model helpers plus the agenda-row hero chip
 * ([P1-UI-006] sub-session 3, 2026-07-19; see docs/HEROES_PLAN.md).
 *
 * `buildChipViewModel` and its helpers are pure (no DOM, unit-testable);
 * `buildChipElement` / `buildRoutineChip` build the small avatar + health +
 * stars chip shown beside a routine-owned item in the agenda list (tap ->
 * hero spotlight). The tray (js/ui/heroTray.js) reuses the view model,
 * ranking, star-crossing and avatar helpers. The old base-zone render loop,
 * chip tap plumbing and flinch/celebrate FX were deleted in hero
 * sub-session 5 (2026-10-25) — the spotlight's hurt / level-up rows replaced
 * the FX.
 *
 * STAR-THRESHOLD-CROSSED NOTIFICATION (PROJECT_SPEC ~84): fires the FIRST time
 * a routine's star rating actually INCREASES, tracked by `trackStarCrossing`
 * in a plain object keyed by routine id (NOT persisted; the first observation
 * only seeds the memory, a reload resets it).
 */
const HeroesView = (() => {
    const FALLBACK_EMOJI = '⭐';

    function categoryEmoji(category, config) {
        const map = (config && config.CATEGORY_EMOJI) || {};
        return map[category] || FALLBACK_EMOJI;
    }

    // Hero art (sub-session 4, 2026-10-25): categories in CONFIG.HERO_ART_CATEGORIES have a 32x32
    // head crop that replaces the emoji in every small avatar (list chip, tray row, Heroes tab).
    // Others return null and keep the emoji.
    function headSrcFor(category, config) {
        const arts = (config && config.HERO_ART_CATEGORIES) || [];
        return arts.indexOf(category) !== -1 ? `Assets/Heroes/${category}-head.png` : null;
    }

    // Avatar markup for a chip view model (or tab model): head crop when it has one, else emoji.
    // KO / inactive fading is plain CSS on the container (grayscale + opacity), so it applies to
    // the <img> and the emoji alike.
    function avatarHtml(vm) {
        if (vm && vm.headSrc) return `<img class="hero-head" src="${vm.headSrc}" alt="" draggable="false">`;
        return (vm && vm.emoji) || '';
    }

    // Dominant category among the routine's HABIT members (routine tasks
    // aren't counted — same habit-only scope as Heroes.completionRate, for
    // the same reason: task categories aren't tied to any honest per-routine
    // record the way habit membership is). Ties broken by first-to-reach-max
    // in definedHabits' iteration order (deterministic given a stable array).
    // Falls back to the routine name's first letter (spec's "category
    // emoji/initial") when the routine has no habit members yet.
    function dominantCategoryOrInitial(routine, definedHabits) {
        const counts = {};
        (definedHabits || []).forEach(def => {
            if (def.routineId !== routine.id) return;
            if (!def.category) return;
            counts[def.category] = (counts[def.category] || 0) + 1;
        });

        let best = null;
        let bestCount = 0;
        Object.keys(counts).forEach(cat => {
            if (counts[cat] > bestCount) {
                best = cat;
                bestCount = counts[cat];
            }
        });

        if (best) return { category: best, initial: null };
        const name = (routine.name || '').trim();
        return { category: null, initial: name ? name[0].toUpperCase() : '?' };
    }

    // State priority mirrors managementWindows.js's compact routine-card
    // precedent (KO'd > frozen > inactive > active) — the base chip extends
    // the same "distinct status, not just off" treatment.
    function deriveState(routine) {
        if (routine.koState) return 'ko';
        if (routine.frozenState) return 'frozen';
        if (!routine.isActive) return 'inactive';
        return 'active';
    }

    // XP progress toward the next level threshold (display only — leveling
    // itself is Heroes.levelForXp/applyXpDelta, not reimplemented here).
    // Thresholds[level] = XP needed to reach level+1 (js/heroes.js's table
    // semantics). Maxed-level routines report xpForNext: null, pct: 1.
    function xpProgress(routine, thresholds) {
        const level = routine.level || 1;
        const xp = routine.xp || 0;
        const maxLevel = (thresholds || []).length;

        if (maxLevel === 0 || level >= maxLevel) {
            return { xp, xpForNext: null, pct: 1 };
        }

        const prevThreshold = thresholds[level - 1] || 0;
        const nextThreshold = thresholds[level];
        const span = nextThreshold - prevThreshold;
        const pct = span > 0 ? Math.min(1, Math.max(0, (xp - prevThreshold) / span)) : 1;
        return { xp, xpForNext: nextThreshold, pct };
    }

    // Pure per-routine view model — no DOM, fully unit-testable.
    function buildChipViewModel(routine, definedHabits, config, runStartedAtMs) {
        const windowStartMs = Math.max(routine.createdAt || 0, runStartedAtMs || 0);
        const rate = Heroes.completionRate(routine, definedHabits, windowStartMs, config.HERO_STAR_RATE_WINDOW);
        const stars = Heroes.starRating(rate.rate, rate.distinctDays, config.HERO_STAR_TIERS);
        const maxHealth = config.ROUTINE_MAX_HEALTH || 0;
        const health = (typeof routine.health === 'number') ? routine.health : maxHealth;
        const healthPct = maxHealth > 0 ? Math.max(0, Math.min(1, health / maxHealth)) : 0;
        const heroCategory = Heroes.heroCategoryFor(routine, config.HERO_CATEGORIES);
        const progress = xpProgress(routine, config.ROUTINE_LEVEL_XP_THRESHOLDS);

        return {
            id: routine.id,
            name: routine.name,
            level: routine.level || 1,
            xp: progress.xp,
            xpForNext: progress.xpForNext,
            xpPct: progress.pct,
            stars,
            rate: rate.rate,
            rateSamples: rate.samples,
            rateDistinctDays: rate.distinctDays,
            health,
            healthPct,
            state: deriveState(routine),
            heroCategory,
            emoji: categoryEmoji(heroCategory, config),
            headSrc: headSrcFor(heroCategory, config),
            initial: null,
        };
    }

    // <option> list for the hero-category pickers (Create Routine + Manage
    // Routine). Labels are the capitalised category keys, same as the habit/
    // task category selects.
    function heroCategoryOptionsHtml(selected, config) {
        return (config.HERO_CATEGORIES || []).map(cat => {
            const label = cat.charAt(0).toUpperCase() + cat.slice(1);
            return `<option value="${cat}"${cat === selected ? ' selected' : ''}>${label}</option>`;
        }).join('');
    }

    function starsHtml(stars) {
        const filled = '★'.repeat(Math.max(0, stars));
        const empty = '☆'.repeat(Math.max(0, 5 - stars));
        return filled + empty;
    }

    // Health-bar color tier, mirroring Damage.resolveBaseImage's thresholds
    // (>75/>50/>25/>0) so the visual language matches the base's own health
    // states instead of inventing a new one.
    function healthColorVar(healthPct) {
        if (healthPct > 0.75) return 'var(--color-base-health-full)';
        if (healthPct > 0.50) return 'var(--color-base-health-moderate)';
        if (healthPct > 0.25) return 'var(--color-base-health-low)';
        return 'var(--color-base-health-critical)';
    }

    const NEUTRAL_AVATAR = '🛡️';
    const STATE_ICON = { ko: '💤', frozen: '🥶', inactive: '⚪' };
    const STATE_LABEL = { ko: 'Knocked out', frozen: 'Frozen', inactive: 'Inactive', active: 'Active' };

    function buildChipElement(vm) {
        const chip = document.createElement('div');
        chip.className = `hero-chip hero-chip--${vm.state}`;
        chip.dataset.routineId = vm.id;
        chip.title = `${vm.name} — ${STATE_LABEL[vm.state] || 'Active'} (tap to manage)`;

        const statusIcon = STATE_ICON[vm.state]
            ? `<span class="hero-chip-status-icon">${STATE_ICON[vm.state]}</span>`
            : '';
        // V3c-1 (2026-10-14): the avatar slot is the seam for the pixel hero
        // sprites (DECISIONS 2026-10-14). Until they exist it shows the
        // category emoji (or a neutral shield for a routine with no habits
        // yet) -- the routine-name initial and the Lv badge are gone.
        const identity = avatarHtml(vm) || NEUTRAL_AVATAR;

        chip.innerHTML = `
            ${statusIcon}
            <div class="hero-chip-avatar">${identity}</div>
            <div class="hero-chip-stars">${starsHtml(vm.stars)}</div>
            <div class="hero-chip-health-track">
                <div class="hero-chip-health-fill" style="width:${Math.round(vm.healthPct * 100)}%; background:${healthColorVar(vm.healthPct)};"></div>
            </div>
        `;
        return chip;
    }

    // Display ranking for routine lists (ROUTINES.md "Routine View ranks
    // routines by level (top performers first)"): level desc, then
    // completion rate desc (null/unrated is treated as -1, so within a level
    // band even a 0%-rated routine with real recorded failures sorts above a
    // brand-new unrated one — a record beats no record), then name asc for a
    // deterministic total order. Returns a sorted COPY — never mutates the
    // caller's array (definedRoutines is live state).
    function rankRoutines(routines, definedHabits, config, runStartedAtMs) {
        return (routines || []).slice().sort((a, b) => {
            const levelDiff = (b.level || 1) - (a.level || 1);
            if (levelDiff !== 0) return levelDiff;

            const rateOf = (r) => {
                const windowStartMs = Math.max(r.createdAt || 0, runStartedAtMs || 0);
                const rate = Heroes.completionRate(r, definedHabits, windowStartMs, config.HERO_STAR_RATE_WINDOW).rate;
                return rate === null ? -1 : rate;
            };
            const rateDiff = rateOf(b) - rateOf(a);
            if (rateDiff !== 0) return rateDiff;

            return (a.name || '').localeCompare(b.name || '');
        });
    }

    // Mutates `memory` in place (upsert-by-id, same discipline as
    // Habits.recordOccurrence) and reports whether THIS observation is a real
    // increase over the last one recorded. First-ever observation of a
    // routine id seeds the memory and reports no crossing.
    function trackStarCrossing(memory, routineId, stars) {
        const previous = memory[routineId];
        memory[routineId] = stars;
        if (previous === undefined) return false;
        return stars > previous;
    }

    // The SAME chip the base shows (avatar, stars, health, state styling),
    // sized for an agenda row (V3c-2, 2026-10-14): `.hero-chip--inline`.
    // Not rebuilt per tick -- the list re-renders on state changes, so the
    // chip is a snapshot of the routine at render time. `onTap(routine)`
    // (optional) wires the tap to the routine's management window.
    function buildRoutineChip(routine, deps) {
        const config = deps.config || CONFIG;
        const vm = buildChipViewModel(routine, deps.definedHabits, config, deps.runStartedAtMs);
        const chip = buildChipElement(vm);
        chip.classList.add('hero-chip--inline');
        chip.title = `${vm.name} — ${STATE_LABEL[vm.state] || 'Active'} (tap to show hero)`;
        if (deps.onTap) {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                deps.onTap(routine);
            });
        }
        return chip;
    }

    return {
        // pure
        categoryEmoji,
        headSrcFor,
        avatarHtml,
        dominantCategoryOrInitial,
        heroCategoryOptionsHtml,
        deriveState,
        xpProgress,
        buildChipViewModel,
        starsHtml,
        healthColorVar,
        trackStarCrossing,
        rankRoutines,
        // DOM
        buildChipElement,
        buildRoutineChip,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeroesView;
}

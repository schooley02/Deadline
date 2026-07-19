/**
 * HeroesView — hero rendering at the Base Zone ([P1-UI-006] sub-session 3,
 * 2026-07-19; see docs/HEROES_PLAN.md).
 *
 * The ticket's visible payoff: one avatar chip per routine, rendered in/around
 * the Base Zone (index.html's `#heroBaseZone`, positioned over `#base`'s
 * leftmost-120px per PROJECT_SPEC ~88). No hero sprite assets exist yet
 * (docs/ART_STYLE.md — only zombies + base states), so v1 is a CSS/emoji
 * placeholder chip (fork 1, HEROES_PLAN.md): category emoji/initial, star
 * row (live completion rate), level badge, health bar, and state styling
 * (active / frozen 🥶 / KO'd 💤 / inactive greyed — same status vocabulary as
 * managementWindows.js's compact routine card).
 *
 * PURE / DOM split, same discipline as js/heroes.js: `buildChipViewModel` and
 * its helpers are pure (no DOM, unit-testable); `buildChipElement`/
 * `renderHeroesAtBase` build/mutate the DOM from a view model. This module
 * renders from state ONLY — no new mechanics (all math delegates to the real
 * `Heroes` pure core, js/heroes.js).
 *
 * WIRING (script.js): a new `heroStarMemory` object + `heroBaseZoneEl` DOM
 * ref, and a `renderHeroesAtBase()` wrapper called (a) immediately after
 * init/restore/level-up alongside the existing `updateRoutineDisplay()`
 * wrapper, for instant first paint, and (b) every game-loop tick (`updateGame()`,
 * CONFIG.GAME_TICK_MS = 50ms) so the chips stay live across ALL the events the
 * plan's live-verify checklist calls out (complete/damage/freeze/KO/deactivate)
 * without threading a new UI dependency through items.js/routines.js/damage.js
 * — those modules stay DOM-free. A full-rebuild render of a handful of small
 * chips every 50ms is negligible next to updateActiveItems' per-item DOM work
 * already running on the same tick.
 *
 * STAR-THRESHOLD-CROSSED NOTIFICATION (PROJECT_SPEC ~84): fires the FIRST time
 * a routine's star rating actually INCREASES. Tracked via `heroStarMemory`, a
 * plain object keyed by routine id — deliberately NOT persisted (sub-session 3
 * lands no schema change, per HEROES_PLAN.md's "migration-free by design").
 * The first observation of a routine just seeds its memory (no notice); only a
 * later render that sees a HIGHER star count than the last one recorded
 * counts as a crossing. A page reload resets the memory, which is fine — a
 * reload can't fabricate a star increase that didn't already happen live.
 */
const HeroesView = (() => {
    const FALLBACK_EMOJI = '⭐';

    function categoryEmoji(category, config) {
        const map = (config && config.CATEGORY_EMOJI) || {};
        return map[category] || FALLBACK_EMOJI;
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
        const rate = Heroes.completionRate(routine, definedHabits, windowStartMs);
        const stars = Heroes.starRating(rate.rate, config.HERO_STAR_TIERS);
        const maxHealth = config.ROUTINE_MAX_HEALTH || 0;
        const health = (typeof routine.health === 'number') ? routine.health : maxHealth;
        const healthPct = maxHealth > 0 ? Math.max(0, Math.min(1, health / maxHealth)) : 0;
        const identity = dominantCategoryOrInitial(routine, definedHabits);
        const progress = xpProgress(routine, config.ROUTINE_LEVEL_XP_THRESHOLDS);

        return {
            id: routine.id,
            name: routine.name,
            level: routine.level || 1,
            xp: progress.xp,
            xpForNext: progress.xpForNext,
            xpPct: progress.pct,
            stars,
            rateSamples: rate.samples,
            health,
            healthPct,
            state: deriveState(routine),
            emoji: identity.category ? categoryEmoji(identity.category, config) : null,
            initial: identity.initial,
        };
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

    const STATE_ICON = { ko: '💤', frozen: '🥶', inactive: '⚪' };
    const STATE_LABEL = { ko: 'Knocked out', frozen: 'Frozen', inactive: 'Inactive', active: 'Active' };

    function buildChipElement(vm) {
        const chip = document.createElement('div');
        chip.className = `hero-chip hero-chip--${vm.state}`;
        chip.dataset.routineId = vm.id;
        chip.title = `${vm.name} — Lv${vm.level} — ${STATE_LABEL[vm.state] || 'Active'}`;

        const statusIcon = STATE_ICON[vm.state]
            ? `<span class="hero-chip-status-icon">${STATE_ICON[vm.state]}</span>`
            : '';
        const identity = vm.emoji || vm.initial || '?';

        chip.innerHTML = `
            ${statusIcon}
            <div class="hero-chip-avatar">${identity}</div>
            <div class="hero-chip-level">Lv${vm.level}</div>
            <div class="hero-chip-stars">${starsHtml(vm.stars)}</div>
            <div class="hero-chip-health-track">
                <div class="hero-chip-health-fill" style="width:${Math.round(vm.healthPct * 100)}%; background:${healthColorVar(vm.healthPct)};"></div>
            </div>
        `;
        return chip;
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

    function buildOverflowChip(overflowCount) {
        const chip = document.createElement('div');
        chip.className = 'hero-chip hero-chip-overflow';
        chip.textContent = `+${overflowCount}`;
        chip.title = `${overflowCount} more routine${overflowCount === 1 ? '' : 's'}`;
        return chip;
    }

    // deps = {
    //   containerEl, definedRoutines, definedHabits, config (defaults to
    //   bare-global CONFIG), runStartedAtMs,
    //   starMemory (optional — plain object; omit to skip crossing detection),
    //   onStarThresholdCrossed (optional — (routine, stars) => void)
    // }
    function renderHeroesAtBase(deps) {
        const containerEl = deps.containerEl;
        if (!containerEl) return;

        const config = deps.config || CONFIG;
        const routines = deps.definedRoutines || [];
        const maxDisplay = config.HERO_CHIP_MAX_DISPLAY || routines.length;
        const visible = routines.slice(0, maxDisplay);
        const overflow = routines.length - visible.length;

        containerEl.innerHTML = '';

        visible.forEach(routine => {
            const vm = buildChipViewModel(routine, deps.definedHabits, config, deps.runStartedAtMs);
            containerEl.appendChild(buildChipElement(vm));

            if (deps.starMemory && deps.onStarThresholdCrossed) {
                const crossed = trackStarCrossing(deps.starMemory, routine.id, vm.stars);
                if (crossed) deps.onStarThresholdCrossed(routine, vm.stars);
            }
        });

        if (overflow > 0) {
            containerEl.appendChild(buildOverflowChip(overflow));
        }
    }

    return {
        // pure
        categoryEmoji,
        dominantCategoryOrInitial,
        deriveState,
        xpProgress,
        buildChipViewModel,
        starsHtml,
        healthColorVar,
        trackStarCrossing,
        // DOM
        buildChipElement,
        buildOverflowChip,
        renderHeroesAtBase,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeroesView;
}

/**
 * Gameplay constants — single source of truth for balance numbers.
 * Never hardcode a balance number in script.js; add it here instead.
 * Changes to these values follow the balance-tuning protocol (see
 * .claude/skills/balance-tuning/SKILL.md) and get logged in docs/DECISIONS.md.
 */
const CONFIG = {
    // --- Timing ---
    GAME_TICK_MS: 50,
    DAMAGE_INTERVAL_MS: 5 * 60 * 1000,
    // "Days survived" is derived from REAL elapsed time since the run started
    // (2026-07-18). It used to be an accelerated demo timer incrementing every
    // DAY_DURATION_MS (60s), so an overnight run reported "22 days" — see
    // DECISIONS.md. Accelerated time, if ever reintroduced, goes behind a flag.
    MS_PER_REAL_DAY: 24 * 60 * 60 * 1000,
    PERSISTENCE_AUTOSAVE_MS: 5000, // safety-net save cadence (mutations also save directly, debounced)
    // Daily check-in "I'll check this later" snooze (sub-session 4,
    // [P1-DATA-005], 2026-07-19; spec PROJECT_SPEC.md ~646). Re-prompts within
    // THIS session only — not persisted across reload (see js/ui/checkIn.js).
    CHECK_IN_SNOOZE_MS: 4 * 60 * 60 * 1000,

    // --- Base ---
    MAX_BASE_HEALTH: 100,
    OVERDUE_DAMAGE: 1,
    // Gradual regen (decided 2026-07-18 Fable session, built [P2-GAME-012]):
    // the base heals BASE_REGEN_HP every BASE_REGEN_INTERVAL_MS while the run
    // is alive, and at the same rate for offline/suspended-loop time — applied
    // AFTER offline overdue damage is back-charged. Clamped at MAX_BASE_HEALTH.
    // Same values as OVERDUE_DAMAGE/DAMAGE_INTERVAL_MS by design (symmetric
    // heal/damage rate); balance-protocol tunable independently of damage.
    BASE_REGEN_HP: 1,
    BASE_REGEN_INTERVAL_MS: 5 * 60 * 1000,

    // --- Offline catch-up (decided 2026-07-17, see DECISIONS.md) ---
    // Per-item cap on back-charged overdue damage for time spent offline.
    // 12 HP ≈ 1 hour's worth at OVERDUE_DAMAGE per DAMAGE_INTERVAL_MS.
    // Principle: punish the COUNT of neglected items, not hours away.
    OFFLINE_DAMAGE_CAP_PER_ITEM: 12,
    OFFLINE_MAX_MS: 3 * 24 * 60 * 60 * 1000, // spec: max 3 days of offline progression
    OFFLINE_CATCHUP_MAX_MS: 5000,            // spec: catch-up animation never exceeds 5s
    OFFLINE_CATCHUP_MS_PER_ITEM: 400,        // animation duration scales with item count…
    OFFLINE_CATCHUP_MIN_MS: 1200,            // …but never shorter than this
    OFFLINE_ANIMATION_THRESHOLD_MS: 30 * 1000, // skip the animation for briefer absences
    // A gap this large between game-loop ticks means the loop was SUSPENDED
    // (laptop sleep, throttled background tab) rather than merely running slow.
    // The page never reloaded, so restoreGameState()/runOfflineCatchUp() never
    // ran and the live loop would otherwise replay the whole gap at one 5-min
    // interval per 50ms tick — ~120 damage in 6s after a 10-hour sleep. Gaps at
    // or above this route through the same capped path a reload uses.
    LIVE_GAP_THRESHOLD_MS: 30 * 1000,

    // --- XP & Points ---
    XP_PER_TASK_DEFEAT: 10,
    XP_PER_HABIT_COMPLETE: 5,
    POINTS_PER_TASK: 10,
    POINTS_PER_HABIT: 5,
    // Streak is now a VISUAL-only concept (decided 2026-07-18, session 13; built
    // session 16). This threshold is the "on-fire" high-streak sprite/badge
    // trigger (spawning.js, items.js) — it NO LONGER awards points. The old flat
    // HABIT_STREAK_BONUS_POINTS was removed when the rate-based bonus below
    // replaced it. See DECISIONS.md.
    HABIT_STREAK_BONUS_THRESHOLD: 3,

    // --- Frozen routine slots ("Frozen routine slots + recovery" ticket,
    // sub-session 1, 2026-07-19; docs/ROUTINES.md + docs/FROZEN_SLOTS_PLAN.md
    // session 35 Fable). Both thresholds are 3 per the canonical spec
    // (PROJECT_SPEC.md ~56-58) — freeze after 3 consecutive indulged days on
    // a routine-owned negative habit; recover via 3 consecutive avoided days
    // while it stays active (recovery path 2; path 1 is a real habit edit —
    // see js/frozenSlots.js). Balance-tuning protocol applies if these ever
    // move off the spec's 3.
    FREEZE_THRESHOLD_DAYS: 3,
    RECOVERY_AVOIDED_DAYS: 3,

    // --- Habit rate-based points bonus (decided session 13, built session 16;
    // see DECISIONS.md + docs/MECHANICS.md). A habit's points award is
    // multiplied by a factor derived from its rolling success rate over its last
    // HABIT_RATE_WINDOW scheduled occurrences. Points only, never XP. 1× until at
    // least HABIT_RATE_MIN_SAMPLE occurrences are recorded, so a new habit can't
    // instantly max out. Tiers are checked high-to-low; first matching minRate
    // wins; below the lowest tier the multiplier is 1×.
    // Multipliers TUNED 2026-07-19 (session 24 theory pass, Fable — see
    // DECISIONS.md): the ≥90% tier is anchored to TASK PARITY — a habit kept at
    // 90%+ pays round(5 × 2.0) = 10 pts, same as POINTS_PER_TASK. "A habit you
    // keep excellently is worth a task." ≥70% pays round(5 × 1.5) = 8. ---
    HABIT_RATE_WINDOW: 14,
    HABIT_RATE_MIN_SAMPLE: 7,
    HABIT_RATE_TIERS: [
        { minRate: 0.9, multiplier: 2.0 },
        { minRate: 0.7, multiplier: 1.5 },
    ],

    // --- Progression ---
    LEVEL_XP_THRESHOLDS: [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000],
    ROUTINE_SLOTS_PER_LEVEL: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4 },

    // --- Hero/routine progression ([P1-UI-006] sub-session 1, 2026-07-19
    // session 41; docs/HEROES_PLAN.md + docs/ROUTINES.md). NOT to be confused
    // with ROUTINE_SLOTS_PER_LEVEL above, which maps PLAYER level -> number of
    // concurrent routines; these govern each routine's OWN leveling.
    // A routine earns XP when its member items complete (mirrors the player's
    // 10/5 task/habit values — a routine levels alongside the player who feeds
    // it); a frozen or inactive routine earns nothing (items.js gates on
    // FrozenSlots.isRoutineSuspended). Thresholds are the player curve halved
    // (a routine only ever sees its own members' completions). Same table
    // semantics: thresholds[level] = XP to advance FROM level TO level+1.
    ROUTINE_XP_PER_TASK: 10,
    ROUTINE_XP_PER_HABIT: 5,
    ROUTINE_LEVEL_XP_THRESHOLDS: [0, 50, 125, 250, 400, 600, 850, 1150, 1500],
    // Member slots — BANKED SLOT POINTS model (sub-session 4, 2026-07-19;
    // forks resolved post-session-43, see DECISIONS.md/HEROES_PLAN.md).
    // Baseline at level 1: 1 habit + 1 task slot. Each level-up from 2-9
    // deposits ONE point into a shared pool (js/heroes.js's
    // totalSlotPointsEarned, DERIVED from level rather than stored —
    // prevents farming points by oscillating level up/down), spent on
    // EITHER a habit or a task slot at add-time. Max 8 points (levels 2-9),
    // so per-type ceiling is 1+8 = 9, total slots max out at 10 — HALF the
    // old symmetric model's 9+9 = 18 budget (Jeremy's original "pick one per
    // level" intent). Superseded the old ROUTINE_SLOTS_PER_LEVEL_GAIN
    // (automatic +1/+1 per level, js/heroes.js's retired slotsForLevel).
    ROUTINE_HABIT_SLOTS_BASE: 1,
    ROUTINE_TASK_SLOTS_BASE: 1,
    ROUTINE_MAX_SLOT_POINTS: 8,
    // Routine health (sub-session 2 wires damage/KO; the max seeds the v8
    // migration NOW so the field exists). KO at 0 -> auto-deactivate, manual
    // revive next calendar day at HERO_REVIVE_HEALTH (fork 2, session 41).
    ROUTINE_MAX_HEALTH: 100,
    HERO_REVIVE_HEALTH: 50,
    // Star tiers (PROJECT_SPEC ~78-83, fixed spec values): completion rate ->
    // stars, checked high-to-low, first match wins; below 60% (or unrated) = 0.
    HERO_STAR_TIERS: [
        { minRate: 0.95, stars: 5 },
        { minRate: 0.90, stars: 4 },
        { minRate: 0.80, stars: 3 },
        { minRate: 0.70, stars: 2 },
        { minRate: 0.60, stars: 1 },
    ],

    // --- Hero rendering ([P1-UI-006] sub-session 3, 2026-07-19; js/ui/heroes.js) ---
    // Display-only constants, not gameplay balance (no balance-tuning protocol
    // needed) — layout/identity concerns, same category as ENEMY_WIDTH etc.
    // Per-category emoji for a hero's avatar chip (docs/ART_STYLE.md's 8 life
    // domains). A routine with no habit members yet has no dominant category —
    // HeroesView falls back to the routine name's initial letter instead.
    CATEGORY_EMOJI: {
        other: '⭐',
        career: '💼',
        creativity: '🎨',
        financial: '💰',
        health: '💪',
        lifestyle: '🌿',
        relationships: '❤️',
        spirituality: '🧘',
    },
    // Base Zone is small (120px wide) — cap simultaneous chips and show a
    // "+N" overflow chip past this count rather than crowding/overflowing.
    HERO_CHIP_MAX_DISPLAY: 6,

    // --- Shop catalog ([P1-UI-008], SHOP_PLAN.md session 1, 2026-07-18) ---
    // Base costs + effects transcribed from docs/ECONOMY.md (canonical). Live
    // price at the shop is Economy.shopPrice(baseCost, owned) = round(base ×
    // 1.5^owned) where owned = currently-held count (Jeremy's call session 19).
    // v1 ships repair kits + pushback only; day-tokens (cheat/sick/skip) are
    // deferred until negative habits [P1-DATA-005] exist (see SHOP_PLAN.md).
    // BALANCE: VALIDATED by the session-24 theory pass (2026-07-19, Fable —
    // see DECISIONS.md): repair HP-per-point improves with tier (0.60/0.70/
    // 0.75); heals ≈ undo 1/3/6 offline-neglected items (12 HP cap each);
    // pushback stays FLAT-priced (the closed points economy is self-limiting)
    // with a 6-hour stacking break-even against the 1-day tier. Re-check
    // against REAL play data once Jeremy has some (scheduled in ROADMAP).
    //
    // Shape per item:
    //   id        stable key (persisted inventory is keyed by this)
    //   name      display label
    //   category  'repair' | 'pushback' | 'cheatDay' (drives UI grouping + effect dispatch)
    //   baseCost  points, before the exponential owned-multiplier
    //   consumable true = held in inventory then used later (repair kits,
    //             Cheat Day); false = applied instantly on purchase (pushback)
    //   effect    category-specific params:
    //             repair   -> { healAmount }  HP restored per use
    //             pushback -> { pushbackMs }   ms the target's due date shifts later
    //             cheatDay -> {} (no numeric effect — applying it just sets
    //                         the target habit's cheatDayDate; see items.js)
    SHOP_ITEMS: [
        { id: 'repair_small',  name: 'Repair Kit (Small)',  category: 'repair',   baseCost: 25,  consumable: true,  effect: { healAmount: 15 } },
        { id: 'repair_medium', name: 'Repair Kit (Medium)', category: 'repair',   baseCost: 50,  consumable: true,  effect: { healAmount: 35 } },
        { id: 'repair_large',  name: 'Repair Kit (Large)',  category: 'repair',   baseCost: 100, consumable: true,  effect: { healAmount: 75 } },
        { id: 'pushback_1hr',  name: 'Enemy Pushback (1 hr)',  category: 'pushback', baseCost: 50,  consumable: false, effect: { pushbackMs: 1 * 60 * 60 * 1000 } },
        { id: 'pushback_2hr',  name: 'Enemy Pushback (2 hr)',  category: 'pushback', baseCost: 100, consumable: false, effect: { pushbackMs: 2 * 60 * 60 * 1000 } },
        { id: 'pushback_1day', name: 'Enemy Pushback (1 day)', category: 'pushback', baseCost: 300, consumable: false, effect: { pushbackMs: 24 * 60 * 60 * 1000 } },
        // [P1-DATA-005] sub-session 5 (2026-07-19): 200 pts is the unchanged
        // ECONOMY.md/spec face value (Fable session 26). Held-inventory
        // exponential pricing like repair kits — "using" one targets a
        // specific negative habit from its lurker popup (js/ui/popups.js),
        // not a shop-card button (see js/ui/shopView.js's hint).
        { id: 'cheat_day', name: 'Habit Cheat Day', category: 'cheatDay', baseCost: 200, consumable: true, effect: {} },
        // Frozen-slots sub-session 5 (2026-07-19): 200 pts is the unchanged
        // ECONOMY.md/spec face value (same as Cheat Day, PROJECT_SPEC.md
        // ~113-114). Held-inventory exponential pricing like Cheat Day.
        // Sick Day is GLOBAL and untargeted — "used" via a Use button on its
        // OWN shop card (js/ui/shopView.js), applying to every habit at once.
        // Skip Day is PER-HABIT and targeted — "used" by tapping a specific
        // habit instance's popup (js/ui/popups.js), same shape as Cheat Day's
        // targeting but available for ANY habit (not just negative ones).
        // Both are Fable fork 4, session 35 (docs/FROZEN_SLOTS_PLAN.md).
        { id: 'sick_day', name: 'Sick Day', category: 'sickDay', baseCost: 200, consumable: true, effect: {} },
        { id: 'skip_day', name: 'Skip Day', category: 'skipDay', baseCost: 200, consumable: true, effect: {} },
    ],

    // --- Sprites ---
    ENEMY_WIDTH: 128,
    HABIT_ENEMY_WIDTH: 128,
    SUBTASK_ENEMY_WIDTH: 64,

    // --- Sub-task clustering ---
    SUBTASK_CLUSTER_GAP_PX: 8, // visual gap between clustered sprites' VISIBLE graphics (not their boxes)
    SUBTASK_AHEAD_THRESHOLD_PX: 150, // how much closer to the base a sub-task's own due date must put it before it breaks from the cluster

    // [P1-DATA-005] session 27/28, repositioned session 29 (Jeremy's call) —
    // negative-habit "lurker" model (see docs/NEGATIVE_HABITS_PLAN.md,
    // DECISIONS.md session 26). A negative-habit instance never advances on
    // the timeline; it sits at a fixed x instead: gameScreenWidth -
    // habitEnemyWidth - this margin, i.e. anchored to the FAR RIGHT of the
    // visible canvas (the same edge tasks due tomorrow-or-later initially
    // park at), not near the base. Rationale: since it never moves, parking
    // it near the base like an imminent threat was misleading — the base
    // area should stay reserved for genuinely urgent, damage-dealing enemies
    // so the player gets honest visual triage at a glance.
    NEGATIVE_LURK_RIGHT_MARGIN_PX: 20,

    // Measured visible-pixel margins of each zombie sprite, as fractions of the
    // sprite box width (alpha-channel bounding box, measured 2026-07-17 from
    // Assets/Zombies/*.png — 128 and 64 variants have near-identical fractions).
    // left = transparent margin on the left, right = transparent margin on the right.
    // Used so cluster offsets butt the actual graphics together instead of the boxes.
    ZOMBIE_VISIBLE_MARGINS: {
        career:        { left: 0.250, right: 0.219 },
        creativity:    { left: 0.141, right: 0.109 },
        financial:     { left: 0.109, right: 0.250 },
        health:        { left: 0.250, right: 0.312 },
        lifestyle:     { left: 0.172, right: 0.047 },
        relationships: { left: 0.047, right: 0.047 },
        spirituality:  { left: 0.203, right: 0.234 },
        other:         { left: 0.234, right: 0.250 },
    },
    ZOMBIE_VISIBLE_MARGIN_FALLBACK: { left: 0.2, right: 0.2 },
};

// Export for Jest/Node; browser picks up the global `CONFIG` via <script> tag.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

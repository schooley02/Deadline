/**
 * Gameplay constants — single source of truth for balance numbers.
 * Never hardcode a balance number in script.js; add it here instead.
 * Changes to these values follow the balance-tuning protocol (see
 * .claude/skills/balance-tuning/SKILL.md) and get logged in docs/DECISIONS.md.
 */
const CONFIG = {
    // --- Timing ---
    GAME_TICK_MS: 50,
    DAY_DURATION_MS: 60000,
    DAMAGE_INTERVAL_MS: 5 * 60 * 1000,
    PERSISTENCE_AUTOSAVE_MS: 5000, // safety-net save cadence (mutations also save directly, debounced)

    // --- Base ---
    MAX_BASE_HEALTH: 100,
    OVERDUE_DAMAGE: 1,

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

    // --- XP & Points ---
    XP_PER_TASK_DEFEAT: 10,
    XP_PER_HABIT_COMPLETE: 5,
    POINTS_PER_TASK: 10,
    POINTS_PER_HABIT: 5,
    HABIT_STREAK_BONUS_THRESHOLD: 3,
    HABIT_STREAK_BONUS_POINTS: 5,

    // --- Progression ---
    LEVEL_XP_THRESHOLDS: [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000],
    ROUTINE_SLOTS_PER_LEVEL: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4 },

    // --- Sprites ---
    ENEMY_WIDTH: 128,
    HABIT_ENEMY_WIDTH: 128,
    SUBTASK_ENEMY_WIDTH: 64,

    // --- Sub-task clustering ---
    SUBTASK_CLUSTER_GAP_PX: 8, // visual gap between clustered sprites' VISIBLE graphics (not their boxes)
    SUBTASK_AHEAD_THRESHOLD_PX: 150, // how much closer to the base a sub-task's own due date must put it before it breaks from the cluster

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

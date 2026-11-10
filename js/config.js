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

    // Evening check (Habit Goals Build 3, 2026-11-01): the default time ("HH:MM", 24 h) the game asks about every Break habit
    // still unanswered today. The player's own time lives in `deadline.settings` (Settings.eveningCheckTime); this is only the
    // default. "Later" hides it until the next app open; the next-morning check-in card stays as the backstop.
    EVENING_CHECK_DEFAULT: '21:00',

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
    // Hit shake (visual only, not balance; 2026-10-20 Jeremy): the church
    // shakes at most once per cooldown; the flash still fires on every hit.
    BASE_SHAKE_COOLDOWN_MS: 3000,
    BASE_SHAKE_DURATION_MS: 300,
    // Screen thump (visual only, not balance; 2026-11-09 Jeremy): when a task / habit is completed the whole canvas (#gameCanvas) gives a
    // small downward jolt, as if it took the hero's hit. js/ui/canvasThump.js decides when; the motion is css/gameCanvas.css
    // `.canvas-thump` (KEEP CANVAS_THUMP_DURATION_MS in sync with that animation's 0.22s). DELAY lines it up with the hero's strike
    // (the attack row is 9 frames at HERO_ONESHOT_FPS; the hit lands around the middle: a dial to tune by eye). COOLDOWN stops a pile
    // of quick completions from rattling the screen.
    CANVAS_THUMP_DELAY_MS: 150,
    CANVAS_THUMP_DURATION_MS: 220,
    CANVAS_THUMP_COOLDOWN_MS: 500,
    // Buzz (2026-11-09, Jeremy): the phone also gives one short vibration with each thump (navigator.vibrate; Android Chrome, not iOS).
    // 0 = no buzz. Follows the thump: none under Effects Off / reduce-motion.
    CANVAS_THUMP_VIBRATE_MS: 20,
    BASE_HEAL_FLOAT_MS: 1400, // the floating "+N" over the church when the base heals (2026-11-02, Jeremy); js/damage.js showHealFloat

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
    // Points (currency) re-tuned 2026-07-21 (balance-tuning protocol, Jeremy's
    // call — see DECISIONS.md): 10/5 → 1/1. Rationale: shop prices (25-300
    // pts) were sized against the OLD ~75-85 pts/day earn rate: a full day's
    // grinding covered a repair kit with room to spare. Jeremy wants tokens
    // (freezes, pushbacks, cheat days) to cost real sustained effort, not a
    // day's play — so the earn rate drops ~10x while shop prices stay put.
    // XP is DELIBERATELY untouched (still 10/5 above) — this is a
    // currency/shop-pressure change, not a leveling-pace change.
    POINTS_PER_TASK: 1,
    POINTS_PER_HABIT: 1,
    // Sub-task economy ([P1-DATA-004] sub-session 3, 2026-07-19; points
    // re-tuned 2026-07-21). Originally "half of POINTS_PER_TASK" — with the
    // base at 1, half has no clean value, so Jeremy's call: a sub-task pays
    // the SAME base as a standalone task (1 pt), but a parent task that ever
    // had sub-tasks now pays 0 of its own on final completion — all the
    // points for a sub-tasked task come from completing its subs, not from
    // checking off the parent (items.js's completeItem/uncompleteItem gate
    // this on `completedSubTasks > 0`; XP is unaffected, parent still earns
    // its own XP_PER_TASK_DEFEAT). The high-priority ×2 rule
    // (Economy.taskPoints) still applies to a SUB's own priority flag on top
    // of this base, so a high-priority sub can pay up to 2, same ceiling
    // logic as a standalone high-priority task. See DECISIONS.md.
    SUBTASK_XP: 5,
    SUBTASK_POINTS: 1,
    // Growing/shrinking parent visuals ([P1-DATA-004] sub-session 4,
    // 2026-07-19; plan values, docs/SUBTASKS_PLAN.md). A parent task's
    // rendered box grows 15% per OPEN sub-task (js/movement.js's
    // getParentGrowthScale), capped at 4 subs (a +60% box at the cap). Not a
    // balance number in the points/XP sense but follows the same
    // never-hardcode + log-to-DECISIONS discipline since it's a tunable
    // gameplay-feel constant.
    PARENT_GROWTH_PER_SUB: 0.075, // was 0.15 until 2026-10-12 (animated sprites scale uniformly, so +60% read too large; Jeremy's call)
    PARENT_GROWTH_MAX_SUBS: 4,
    // [P2-GAME-010] Stage 2a (2026-10-12): optionally snap the parent's rendered
    // size to a whole-number multiple (crisper pixel art). OFF by default —
    // with a 128px parent, the next whole step is 256px, far too big (Jeremy's
    // call, same day). See Movement.getParentSpriteScale. false = smooth.
    PARENT_GROWTH_SNAP_TO_INTEGER: false,
    // Streak is now a VISUAL-only concept (decided 2026-07-18, session 13; built
    // session 16). This threshold is the "on-fire" high-streak sprite/badge
    // trigger (spawning.js, items.js) — it NO LONGER awards points. The old flat
    // HABIT_STREAK_BONUS_POINTS was removed when the rate-based bonus below
    // replaced it. See DECISIONS.md.
    HABIT_STREAK_BONUS_THRESHOLD: 3,
    // Second, stronger visual tier for [P2-UI-009] (Milestone 4, session 59,
    // 2026-07-19) — a "blazing" effect layered on top of the base on-fire
    // look at a much higher streak. Purely visual, same as the threshold
    // above (no points/XP impact), so this is a net-new tunable rather than
    // a change to an existing balance number — no balance-tuning protocol
    // invocation needed, but logged in DECISIONS.md per the "new balance
    // numbers" rule anyway. 7 chosen as roughly a full week of a daily habit.
    HABIT_STREAK_STRONG_THRESHOLD: 7,

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
    // RE-DESIGNED 2026-07-21, Jeremy's call — see DECISIONS.md). A habit's
    // points award is multiplied by a factor derived from its success rate
    // over its last HABIT_RATE_WINDOW scheduled occurrences. Points only,
    // never XP. Below HABIT_RATE_MIN_SAMPLE occurrences recorded, the
    // multiplier is a flat 1× — no tier can fire on a partial window.
    // Tiers are checked high-to-low; first matching minRate wins.
    //
    // Window widened 10→14→22: 22 is the oft-cited "it takes ~22 repetitions
    // to form a habit" figure Jeremy wants the mechanic to literally track.
    // MIN_SAMPLE is set equal to the window (not a fraction of it, unlike the
    // old 7-of-14) — deliberate: "100% of the last 22" / "80% of the last 22"
    // are only meaningful once a full 22-occurrence window actually exists;
    // a habit stays at 1× until then, full stop. No task-parity anchor
    // anymore (task itself is 1 pt now, so "parity" would mean no bonus at
    // all) — tiers are their own reward scale: perfect 22/22 record → 3×,
    // ≥80% (some room to slip and still keep the run) → 2×, else 1×.
    HABIT_RATE_WINDOW: 22,
    HABIT_RATE_MIN_SAMPLE: 22,
    HABIT_RATE_TIERS: [
        { minRate: 1.0, multiplier: 3.0 },
        { minRate: 0.8, multiplier: 2.0 },
    ],

    // --- Progression ---
    LEVEL_XP_THRESHOLDS: [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000],
    // Level 9 (max) added 2026-10-23 as a BUG FIX, not a balance change: the
    // table stopped at 8, so state.js's restore (`ROUTINE_SLOTS_PER_LEVEL[level] || 1`)
    // dropped a reloaded Lv-9 player to 1 slot. 9: 4 keeps the intended cap of 4.
    ROUTINE_SLOTS_PER_LEVEL: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 4 },

    // --- Level perks (DESIGNED 2026-10-23, Fable, balance-tuning protocol —
    // docs/LEVEL_PERKS_PLAN.md + ECONOMY.md "Level perks" + DECISIONS.md).
    // Fills the player levels that previously granted nothing (2, 4, 6, 8, 9).
    // Pattern: routine slots on the odd levels (ROUTINE_SLOTS_PER_LEVEL above
    // stays the source of truth for those; the 'slot' rows here are labels
    // for the level panel only), convenience on the even levels, a capstone
    // at max level. Everything resets with the run, like level and XP.
    // Perk types: 'slot' (display only), 'item' (adds `count` of a SHOP_ITEMS
    // id to the held inventory — HELD (consumable) items only; pushback
    // tokens are held items since 2026-11-02 and can be gifted too), 'discount' (shop price multiplier = 1 - value; the
    // highest reached level's discount applies, derived from level, not
    // persisted), 'title' (cosmetic; `skin` is a hook for V4+ church art).
    // Red-line kept on purpose: no 200-pt token before max level, nothing
    // that softens damage, freezes or the earn rate. WIRED 2026-10-23
    // (LEVEL_PERKS_PLAN.md sub-session A): script.js checkPlayerLevelUp pays
    // item perks via Shop.grant and names every perk in the level-up toast;
    // Progression.shopDiscount feeds Shop.price (shop window, pushback popup);
    // Progression.titleForLevel + run records' peakPlayerLevel drive the
    // Steward badge. The level PANEL (sub-session B) is still to come.
    LEVEL_PERKS: {
        1: [{ type: 'slot', value: 1, label: '1 routine slot' }],
        2: [{ type: 'item', itemId: 'repair_small', count: 1, label: 'Repair Kit (Small) ×1' }],
        3: [{ type: 'slot', value: 2, label: '2nd routine slot' }],
        // Lv 4 also unlocks the sky picker (W1c, designed 2026-11-07; docs/WORLD_FEEDBACK_PLAN.md "W1c Sky picker"): a cosmetic perk,
        // no economy number. Its player-facing name lives in js/theme.js only (Theme.perkLabel), so the label here stays ''.
        4: [
            { type: 'discount', value: 0.10, label: '10% off the shop' },
            { type: 'unlock', unlock: 'skyPicker', label: '' },
        ],
        5: [{ type: 'slot', value: 3, label: '3rd routine slot' }],
        6: [{ type: 'item', itemId: 'repair_medium', count: 1, label: 'Repair Kit (Medium) ×1' }],
        7: [{ type: 'slot', value: 4, label: '4th routine slot' }],
        8: [{ type: 'discount', value: 0.20, label: '20% off the shop' }],
        9: [
            { type: 'item', itemId: 'sick_day', count: 1, label: 'Sick Day token ×1' },
            { type: 'title', value: 'Steward of the Church', skin: 'steward', label: 'Title: Steward of the Church' },
        ],
    },

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
    // Rolling occurrence window for the star-rating RATE (2026-07-21 redesign,
    // see docs/DECISIONS.md and docs/ROUTINES.md). 22 since 2026-11-03: the SAME
    // window as HABIT_RATE_WINDOW (the habit points multiplier), because 22 is the
    // "it takes ~22 repetitions to form a habit" figure the game tracks. It was 28
    // (double the habit window when that was 14); the habit window moved to 22
    // the same day and this one never followed. A routine's rate is "how am I
    // doing over my last 22 recorded occurrences," not an all-time average that
    // stops moving once a routine has months of history behind it. Note: the
    // occurrences are merged across ALL of the routine's habits and tasks, so a
    // routine with several items covers fewer days than a single-habit one.
    HERO_STAR_RATE_WINDOW: 22,
    // Star tiers (PROJECT_SPEC ~78-83 sets the rate cutoffs; minDays is the
    // 2026-07-21 addition, see DECISIONS.md). BOTH minRate (over the rolling
    // window above) AND minDays (distinct calendar days with at least one
    // recorded occurrence, since routine creation — NOT limited to the
    // rate window) must be satisfied; checked high-to-low, first match wins;
    // below the lowest tier (or unrated) = 0. minDays is what fixes the
    // reported bug: completing one habit once produced a 100% rate that
    // instantly cleared the 95% tier with zero track record behind it.
    HERO_STAR_TIERS: [
        { minRate: 0.95, minDays: 21, stars: 5 },
        { minRate: 0.90, minDays: 14, stars: 4 },
        { minRate: 0.80, minDays: 7, stars: 3 },
        { minRate: 0.70, minDays: 4, stars: 2 },
        { minRate: 0.60, minDays: 2, stars: 1 },
    ],
    HERO_HONOR_ROLL_STARS: 3, // report card: a routine at this many stars or more is on the honor roll (report-card label; also the Honor Roll badge counter, via Achievements.dayDeltas)

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
    // Hero art categories (HERO_SPOTLIGHT_PLAN.md, 2026-10-21): the 8 life
    // domains a routine's hero can be. `routine.heroCategory` is one of these;
    // missing/unknown reads as 'other' (Heroes.heroCategoryFor).
    HERO_CATEGORIES: ['other', 'career', 'creativity', 'financial', 'health', 'lifestyle', 'relationships', 'spirituality'],
    // Hero spotlight (docs/HERO_SPOTLIGHT_PLAN.md, 2026-10-21): display timing /
    // look constants, not gameplay balance (no balance-tuning protocol needed).
    // How long the hero stays in front of the church after a tap.
    HERO_SPOTLIGHT_MS: 5000,
    // Darkness of the scrim over the base area while a hero shows. 0 = OFF
    // (2026-10-26, Jeremy: no dark overlay behind the hero for now; the invisible
    // scrim still takes the tap-to-dismiss). Raise it to bring the overlay back:
    // ~0.4 the church still reads; below ~0.3 it wins over the hero, above ~0.5
    // its damage state disappears.
    HERO_SCRIM_OPACITY: 0,
    // KO'd hero look, built both ways to compare live (plan answer 3):
    // 'faded' = desaturated hero; 'zombie' = the category zombie grey-tinted.
    HERO_KO_LOOK: 'faded',
    // Hero ART (HERO_SPOTLIGHT_PLAN sub-session 4, 2026-10-25): categories that have a PixelLab
    // atlas (Assets/Heroes/anim/<category>.png + .json) and head crop (Assets/Heroes/<category>-head.png).
    // Those heroes skip the emoji block and the HERO_KO_LOOK treatment: the KO ANIMATION plays
    // unfaded (Jeremy, 2026-10-25) while the small avatars (tray / tab / list chips) still fade.
    // Categories not listed keep the emoji placeholder until their art lands.
    HERO_ART_CATEGORIES: ['other', 'spirituality', 'relationships', 'lifestyle', 'health', 'financial', 'creativity', 'career'],
    // KO animation timing (display only). The KO row (9 frames) plays ONCE at HERO_KO_FPS, then
    // holds its last frame for HERO_KO_HOLD_MS, then restarts. KEEP IN SYNC with the `hero-ko`
    // keyframes in css/heroSpotlight.css (test/heroArt.test.js checks they agree).
    HERO_KO_FPS: 10,
    HERO_KO_HOLD_MS: 3000,
    // One-shot reaction rows (sub-session 5, 2026-10-25): `hurt` plays when the routine takes damage,
    // `levelup` when it levels. Both play ONCE at HERO_ONESHOT_FPS, then the hero returns to idle (or
    // KO if that was the hit). Display only. Frame counts come from the atlas JSON (9 unless listed in
    // HERO_ONESHOT_FRAME_OVERRIDES); KEEP IN SYNC with the `hero-oneshot` rules in css/heroSpotlight.css
    // (test/heroArt.test.js checks both against the JSON files).
    HERO_ONESHOT_FPS: 10,
    // EVERY hurt animation runs slower than the other one-shots so it does not flicker (2026-10-26): the one-shot
    // `hurt` when the routine takes damage AND the `hurtloop` while a zombie attacks. Lower = slower. KEEP IN SYNC
    // with `--hero-oneshot-fps` on `[data-anim="hurt"]` and `[data-anim="hurtloop"]` in css/heroSpotlight.css.
    HERO_HURT_FPS: 7,
    // Time-slider scrub (2026-10-27, Jeremy): while the slider is dragged, the looping zombie sprites, the
    // visible hero and the cloud drift are stepped forward/backward by this many ms of animation per slider
    // minute moved (drag right = forward, left = reverse, finger still = frozen). 20 => a full 24h drag plays
    // ~29 s of animation. Higher = faster. Display only. js/ui/timeSliderView.js.
    SCRUB_ANIM_MS_PER_MINUTE: 20,
    // Time slider auto-return (2026-11-04, Jeremy: "auto return after a few idle minutes"). While the slider is away
    // from now (parked on Today, or another day on screen) the live board waits; after this long with no tap, click,
    // key or scroll anywhere on the page it returns to now (same as the Now button). 0 = never. UI timing, not a
    // balance number. js/ui/timeSliderView.js checkIdleReturn.
    TIME_PREVIEW_IDLE_RETURN_MS: 3 * 60 * 1000,
    // Started marker (2026-11-04, Jeremy; js/startedMarker.js): inside an item's Start -> Due window its row sits in a
    // "Started (N)" group above the due-time rows until it is due within STARTED_GROUP_LEAVE_MIN minutes (then it drops
    // back into due order, near the top anyway); its zombie's amber glow breathes for STARTED_BREATHE_MIN minutes after
    // the Start time unless a timer is started, then holds still; STARTED_ARRIVAL_MS = how long the one-time ring burst
    // and row flash play when a Start time passes live (must cover the 3 x 0.9 s CSS burst in css/startedMarker.css).
    // UI timing, not balance numbers.
    STARTED_GROUP_LEAVE_MIN: 60,
    STARTED_BREATHE_MIN: 10,
    STARTED_ARRIVAL_MS: 2800,
    // Stats best/worst day per run (D2 step 5, 2026-10-27): score = done*done - missed*missed - damage*damage
    // (done = tasks + sub-tasks + habits; damage = base HP lost that day). Display only -- not a balance number.
    DAILY_SCORE_WEIGHTS: { done: 1, missed: 1, damage: 1 },
    // Run climate = the sky's weather (2026-11-03, Jeremy + Opus; js/runClimate.js, docs/WORLD_FEEDBACK_PLAN.md "W1 Run climate").
    // How the CURRENT run has been going over its last `windowDays` closed days, as five bands: Clear / Hazy / Overcast / Fog / Storm.
    // Display only (it never changes damage, points or anything you earn), but THEORY-PASS numbers: re-check with real play data.
    //   weights        a day's score: on time 0.5 (a late finish earns `lateCredit` of an on-time one), habits kept 0.25 (good habits
    //                  done + bad habits avoided, over every habit answered or missed), church held 0.25 (1 - damage / damageCap HP).
    //   decay          each day further back counts this much less than the one after it (yesterday = 1).
    //   startScore / startWeightDays   a new run starts at Hazy: a 0.75 prior worth 6 days that fades out over the first week, so
    //                  ~5 days of strong play (90% on time and habits kept, little damage) clears the sky; perfect play takes 4.
    //   thresholds     a score at or above the line is that band (below `fog` = Storm); `hysteresis` = how far past a line the score
    //                  must go before the sky actually changes, so it does not flicker.
    //   trendDays / trendDelta   improving / worsening = the climate vs trendDays closed days ago, by at least trendDelta.
    // Sky unlocks (W1d, designed 2026-11-09, docs/WORLD_FEEDBACK_PLAN.md "W1d Sky unlocks"): each sky is its own LIFETIME unlock on a
    // different track, so a new run keeps every sky you earned. `level` = the best player level ever reached; `kind` + `tier` = that
    // village building's best star ever (`bestVillageTiers`; star N = tier N). Hazy is the starter and rides the Lv 4 perk (a test keeps
    // the two numbers equal). Nothing new is measured: every number reuses an existing level or village threshold.
    SKY_UNLOCKS: {
        hazy:     { level: 4 },
        overcast: { kind: 'nights',   tier: 3 }, // Radio tower
        fog:      { kind: 'defense',  tier: 3 }, // Jailhouse
        storm:    { kind: 'bestdays', tier: 3 }, // Windmill
        clear:    { kind: 'nights',   tier: 4 }, // Radio tower
    },
    CLIMATE: {
        windowDays: 7,
        decay: 0.85,
        weights: { onTime: 0.5, habits: 0.25, church: 0.25 },
        lateCredit: 0.5,
        damageCap: 25,
        startScore: 0.75,
        startWeightDays: 6,
        thresholds: { clear: 0.85, hazy: 0.70, overcast: 0.55, fog: 0.40 },
        hysteresis: 0.03,
        trendDays: 3,
        trendDelta: 0.05,
    },
    HERO_ONESHOT_FRAMES: 9,
    HERO_ONESHOT_FRAME_OVERRIDES: { hurt: { financial: 7, health: 7 } },
    // A routine level-up opens the spotlight on that hero (it plays `levelup`) when no hero is showing.
    // Hurt never opens it (damage ticks are frequent): it only plays on a hero that is already up.
    HERO_LEVELUP_AUTO_SHOW: true,
    // Completing a task / habit plays the `attack` row ONCE on that item's hero (2026-10-26): the hero
    // opens (or replaces the one showing) for HERO_SPOTLIGHT_MS, standing in the completed zombie's lane.
    // Same fps / 9 frames as the other one-shots. false = no completion attack.
    HERO_ATTACK_ON_COMPLETE: true,
    // Hero tray (plan sub-session 3): a hero counts as "hurt" (red dot on the Heroes tab) at or
    // below this fraction of max health. Display threshold, not balance.
    HERO_HURT_PCT: 0.5,
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
    // NOTE: that theory pass assumed the OLD ~75-85 pts/day earn rate. Prices
    // below are DELIBERATELY left unchanged by the 2026-07-21 points re-tune
    // (POINTS_PER_TASK/HABIT above dropped ~10x) — Jeremy's explicit intent
    // was to make tokens cost real sustained effort against these same
    // prices, not to preserve the old day-to-buy ratios. The HP-per-point/
    // break-even math itself still holds (it's ratios between shop items,
    // unaffected by the earn-rate change); only "how many real days of play
    // to afford X" changed, on purpose. Re-check against real play data still
    // applies once Jeremy has some.
    //
    // Shape per item:
    //   id        stable key (persisted inventory is keyed by this)
    //   name      display label
    //   category  'repair' | 'pushback' | 'cheatDay' (drives UI grouping + effect dispatch)
    //   baseCost  points, before the exponential owned-multiplier
    //   consumable true = held in inventory then used later (repair kits,
    //             Cheat Day, pushback tokens); false = applied instantly on purchase
    //   effect    category-specific params:
    //             repair   -> { healAmount }  HP restored per use
    //             pushback -> { pushbackSize }  a PUSHBACK_SIZES id: a held token of that size is used
    //                         automatically when the free charges of the size run out (Build B, 2026-11-02)
    //             cheatDay -> {} (no numeric effect — applying it just sets
    //                         the target habit's cheatDayDate; see items.js)
    //   keptAcrossRuns (optional, default false; run-end carryover 2026-11-03, js/runCarryover.js):
    //             true = a held item of this row SURVIVES a new run (kept until used). Reserved for
    //             items that cannot be re-earned by playing (a paid or one-time item). NO row sets
    //             it today: everything below is bought with run points or gifted by a level perk /
    //             village star the next run pays again, so the whole inventory resets with the run.
    SHOP_ITEMS: [
        { id: 'repair_small',  name: 'Repair Kit (Small)',  category: 'repair',   baseCost: 25,  consumable: true,  effect: { healAmount: 15 } },
        { id: 'repair_medium', name: 'Repair Kit (Medium)', category: 'repair',   baseCost: 50,  consumable: true,  effect: { healAmount: 35 } },
        { id: 'repair_large',  name: 'Repair Kit (Large)',  category: 'repair',   baseCost: 100, consumable: true,  effect: { healAmount: 75 } },
        // Pushback tokens (Build B, 2026-11-02; docs/PUSHBACK_CHARGES_PLAN.md). Held like repair kits (1.5^held
        // price); used AUTOMATICALLY when a move needs a pushback and the free charges of that size are spent.
        // baseCost mirrors PUSHBACK_SIZES (test/pushback.test.js checks they match).
        { id: 'pushback_short',  name: 'Short Pushback (30 min)', category: 'pushback', baseCost: 5,  consumable: true, effect: { pushbackSize: 'short' } },
        { id: 'pushback_medium', name: 'Medium Pushback (2 hr)',  category: 'pushback', baseCost: 10, consumable: true, effect: { pushbackSize: 'medium' } },
        { id: 'pushback_long',   name: 'Long Pushback (1 day)',   category: 'pushback', baseCost: 30, consumable: true, effect: { pushbackSize: 'long' } },
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
        // Goals Build C (2026-11-05): paid by a finished one-time goal or a monthly goal met (GOAL_REWARDS). Same effect as a Sick Day; never
        // listed for sale (`notForSale`), and it SURVIVES a new run (`keptAcrossRuns`): the first row that uses that flag, because a goal
        // that took months cannot be re-earned by playing a run. baseCost is only its shop value for the daily record.
        { id: 'earned_sick_day', name: 'Earned Sick Day', category: 'sickDay', baseCost: 200, consumable: true, notForSale: true, keptAcrossRuns: true, effect: {} },
        { id: 'skip_day', name: 'Skip Day', category: 'skipDay', baseCost: 200, consumable: true, effect: {} },
    ],

    // --- Sprites ---
    ENEMY_WIDTH: 128,
    HABIT_ENEMY_WIDTH: 128,
    SUBTASK_ENEMY_WIDTH: 96, // was 64 (2026-10-13: too small on phone landscape, Jeremy)
    // Portrait glance strip (V3b-1, 2026-10-13): markers are small dots, so the
    // timeline math uses this as the "enemy width" while body.glance-strip is on
    // (script.js refreshLayoutDims). Keep in sync with the 32px marker width in
    // css/glanceStrip.css.
    STRIP_MARKER_WIDTH: 32,
    // Glance-strip lanes (V3b-2, 2026-10-13). Strip = SKY band + a fixed-pixel
    // FLOOR band. Markers are STRIP_MARKER_HEIGHT x STRIP_MARKER_WIDTH white-filled
    // circles with a category-colored ring and a STRIP_ICON_SIZE icon (Jeremy,
    // 11:54: bigger + white fill so icons and state rings read; custom PixelLab
    // icons will replace the emoji SVGs — author them at STRIP_ICON_SIZE px,
    // transparent). Lanes OVERLAP vertically on purpose: each steps down only
    // STRIP_LANE_PITCH px but a marker is STRIP_MARKER_HEIGHT tall, so markers
    // behind keep their top part visible and tappable. 2026-10-13 (Jeremy: too tall):
    // tighter lanes, FEET-aligned to the floor: lane 0's feet (marker bottom) sit
    // STRIP_FLOOR_FEET_INSET px BELOW the floor tile's top edge, lane 1 a pitch lower, lane 2 at
    // the bottom minus STRIP_FLOOR_PAD_BOTTOM. 2026-10-13 evening (Jeremy: the back-lane nurse
    // floated): the tile's opaque ground only starts ~6 rows down (rows 0-5 are sky/grass
    // fringe), so feet ON the top edge hung in the air; inset 8 puts them 2-3px into the dirt
    // (sky 24->32, pitch 14->10, canvas still 92px).
    // Floor = INSET + (LANE_COUNT-1)*PITCH + PAD = 8 + 2*10 + 8 = 36px; strip = SKY + MARKER +
    // (LANE_COUNT-1)*PITCH + PAD = 32 + 32 + 20 + 8 = 92px.
    // Same-lane markers closer than STRIP_MARKER_WIDTH collapse into a "+N" badge.
    // PixelLab floor art must match (36px tall, tileable in x: Assets/scene/strip-floor.png). Keep in sync with
    // --strip-sky / --strip-marker / --strip-pitch / --strip-icon / #gameCanvas
    // height in css/glanceStrip.css (test/layout.test.js checks).
    STRIP_SKY_HEIGHT: 32, // headroom: parked lurker sprite (64px box at bottom:20px) needs 84px of canvas above the floor's bottom edge, priority star sits 11px above a marker; the canvas clips overflow
    STRIP_MARKER_HEIGHT: 32,
    STRIP_ICON_SIZE: 24,
    STRIP_LANE_PITCH: 10,
    STRIP_FLOOR_FEET_INSET: 8, // back lane's feet sit this far below the floor tile's top edge (2026-10-13)
    STRIP_FLOOR_PAD_BOTTOM: 8, // gap under the front lane's feet (2026-10-13)
    STRIP_LANE_COUNT: 3,
    // Portrait strip sub-task spread (2026-10-13, Jeremy: subs stacked on their parent
    // read as one item). The first STRIP_SUBTASK_SPREAD_COUNT open subs (by id) step
    // STRIP_SUBTASK_GAP_PX px TOWARD THE CHURCH per slot (a sub can never be due later
    // than its parent, so left-only never reads as 'later'; the midnight-line bug can't
    // return) and take a lane different from the parent's. Further subs still stack on
    // the parent with the +N badge.
    STRIP_SUBTASK_GAP_PX: 14,
    STRIP_SUBTASK_SPREAD_COUNT: 2,

    // List-order layering + tie-group reorder (Jeremy, 2026-10-13; DECISIONS.md).
    // Active tasks whose due times are within LIST_TIE_WINDOW_MIN of their
    // NEIGHBOR form a chained tie group; manual order (item.listRank) applies
    // only inside a group. Canvas z-index follows the agenda row: the top row
    // gets LIST_Z_MAX and each lower row 2 less (floor LIST_Z_MIN); a sub-task
    // sits one step behind its parent (portrait strip; in front of it on desktop/landscape since 2026-10-13, css/enemySprites.css). The band sits above the old per-enemy
    // z-values (10-16) and below the overdue pile (80), hover (85) and the
    // stats/heroes overlays (90) -- see css/enemySprites.css, glanceStrip.css.
    LIST_TIE_WINDOW_MIN: 30,
    LIST_Z_MIN: 30,
    LIST_Z_MAX: 79,

    // Lane layering + overlap avoidance (Jeremy, 2026-10-13 evening phone check; DECISIONS.md
    // "Lane z-order + lane switching"). Z now follows the LANE first (front lane over middle over
    // back), list order only breaks ties inside a lane: lane L owns the z slice
    // LIST_Z_MIN + L*LIST_Z_LANE_STRIDE .. +STRIDE-1 (3 lanes x 16 = 30-77, still under the 80/85/90
    // overlay layers). Two top-level zombies whose x positions are closer than
    // LANE_CONFLICT_FRAC x the narrower sprite width may not share a lane: the lower-priority one
    // (lower in the list) moves to the nearest free lane. Only when ALL lanes are blocked at that
    // spot does the portrait strip fold the extra one into a "+N" badge (landscape just stacks it).
    LANE_CONFLICT_FRAC: 0.6,
    STRIP_OVERFLOW_MAX: 4, // portrait strip: at most this many overdue attackers fan out right of a full spot (x LANE_OVERFLOW_OFFSET_PX); more fold into the "+N" badge
    LANE_OVERFLOW_OFFSET_PX: 24, // landscape: the 4th+ zombie stacked on three others fans RIGHT (away from the church) by rank x this
    LIST_Z_LANE_STRIDE: 16,
    STRIP_ATTACKER_WIDTH: 64, // overdue sprite box at the base in the strip (css/glanceStrip.css .enemy-at-base)

    // --- Ground band placement (2026-07-21) ---
    // Top-level enemies stand on the graveyard ground band (css/gameCanvas.css
    // `.scene-ground`, the bottom ~24% of #gameCanvas, with the fence
    // silhouette drawn near its top). Their feet — the sprite box BOTTOM edge,
    // the same alignment line sub-tasks bottom-align to — land at a random
    // fraction of canvas height between these two values, so they read as a
    // staggered crowd walking in front of the fence rather than floating at
    // random full-canvas heights (the pre-2026-07-21 behavior). TOP_FRAC is
    // roughly the fence line; BOTTOM_FRAC is near the canvas floor. The gap
    // between them is the vertical jitter that gives depth and keeps
    // same-timeline enemies from fully overlapping. Tunable (layout, not
    // economy balance).
    GROUND_BAND_FEET_TOP_FRAC: 0.85,
    GROUND_BAND_FEET_BOTTOM_FRAC: 0.99,

    // Landscape / desktop GROUND LANES (2026-10-13, Jeremy: "all the zombies are in
    // the same lane"). The random band above is only ~14% of a ~250px phone-landscape
    // canvas (~35px of spread for 128px sprites), so it read as ONE lane. Top-level
    // items are now dealt onto STRIP_LANE_COUNT lanes by agenda LIST order (top row =
    // front/lowest lane -- same rule as the portrait strip; Layout.applyGroundLanes).
    // Lane feet run from TOP_FRAC (back lane) to BOTTOM_FRAC (front lane) of canvas
    // height. Layout constants, not balance. Sub-tasks still bottom-align to parent.
    // 2026-10-13 (floor art on desktop/landscape): the ground is now a fixed-height band of
    // Assets/scene/floor-tile.png (.scene-ground in css/gameCanvas.css: GROUND_FLOOR_HEIGHT px,
    // bottom-anchored). Lane feet are measured against THAT band, not canvas fractions: back
    // lane feet = floor top + TOP_PAD, front lane feet = canvas bottom - BOTTOM_PAD (so
    // nothing floats above the floor or touches the canvas edge); middle lane in between.
    // The *_FRAC pair is the fallback (and what tests pass explicitly).
    GROUND_FLOOR_HEIGHT: 72,
    GROUND_FLOOR_FEET_TOP_PAD: 24, // tile rows 0-~10 are sky/grass tufts; the walkable dirt band is ~rows 10-45, so back-lane feet go mid-dirt (2026-10-13, Jeremy: top lane floated)
    GROUND_FLOOR_FEET_BOTTOM_PAD: 8,
    GROUND_LANE_FEET_TOP_FRAC: 0.72,
    GROUND_LANE_FEET_BOTTOM_FRAC: 0.99,

    // --- Graveyard zone (V7 W0, 2026-10-28; docs/WORLD_FEEDBACK_PLAN.md) ---
    // Landscape + desktop only (hidden in the portrait glance strip). A fixed-width hill on the
    // RIGHT of #gameCanvas holds one headstone per achievement family in staggered lanes; the
    // zombie field ends where the hill starts (script.js refreshLayoutDims subtracts the zone's
    // measured width, so parked/spawning zombies stand just left of it). The tree is its own
    // graphic pushed partly off the right edge. Layout constants, not balance.
    GRAVEYARD_HILL_WIDTH_PX: 140,
    // Height of the hill's flat top above the canvas bottom = the visible rows of Assets/scene/graveyard-hill.png (192x128, 2026-11-08;
    // the art is 192 wide so its low left slope runs 52px past the 140px zone, drawn BEHIND the zombies; the zone/tap width stays 140).
    GRAVEYARD_HILL_HEIGHT_PX: 101,
    GRAVEYARD_LANES: 3,
    GRAVEYARD_LANE_RISE_PX: 28, // each back lane sits this much higher up the hill
    GRAVEYARD_STONE_PITCH_PX: 44, // = tap-target width; odd lanes shift by half a pitch into the gaps
    GRAVEYARD_STONE_HIT_PX: 44, // minimum tap box (visual art can be smaller)
    GRAVEYARD_PAD_PX: 6,
    GRAVEYARD_TRUNK_PX: 24, // old placeholder tree's visible trunk strip (unused since the PixelLab tree, 2026-11-08)
    // Growing tree (2026-11-08; Assets/scene/graveyard-tree-1..3.png, js/treeGrowth.js, docs/ART_STYLE "Growing tree"): sapling / young / giant by
    // LIFETIME nights survived. The three PNGs are 192x128, drawn 1:1, and share ONE trunk base: art column TRUNK_COL stands BASE_X_PX in from the
    // zone's left edge, and the art's bottom edge sinks SINK_PX below the hill's flat top (roots on the slope). The tree sits in a clipper that is cut
    // at the zone's right edge (#gameCanvas is overflow:visible). The giant's canopy reaches up to the Nights Survived label (the label has its own
    // dark backing for that) and spreads left over the Armory's tower. TREE_STAGE_NIGHTS = [young at, giant at]: first values (Jeremy, 2026-11-08).
    GRAVEYARD_TREE_ART_W_PX: 192,
    GRAVEYARD_TREE_ART_H_PX: 128,
    GRAVEYARD_TREE_TRUNK_COL: 146,
    GRAVEYARD_TREE_BASE_X_PX: 110,
    GRAVEYARD_TREE_SINK_PX: 5, // was 15; raised 10px 2026-11-08 (Jeremy: more ground above it)
    GRAVEYARD_TREE_CLIP_LEFT_PX: 80, // how far the clipper reaches left of the zone (the canopy overhangs the field)
    // The tree's one tap box (opens the Tree window, js/ui/treePanel.js): the 44px strip of zone to the right of the Memorial's tap box (which spans
    // x 24-96), so the two never overlap. It stands on the trunk's base (bottom = hill height - sink) and rises hitH (2026-11-08).
    GRAVEYARD_TREE_HIT_LEFT_PX: 96,
    GRAVEYARD_TREE_HIT_W_PX: 44,
    GRAVEYARD_TREE_HIT_H_PX: 110,
    TREE_STAGE_NIGHTS: [30, 100],
    // Milestone markers (2026-11-08; Assets/scene/headstone-0..4.png, js/milestoneMarkers.js, js/ui/markerPanel.js, docs/ART_STYLE "Milestone markers"):
    // one small marker per all-time achievement family standing on the hill's face, showing how far that family has come (no badge yet = a
    // wooden cross, then Bronze / Silver / Gold / Platinum, one picture each). Jeremy's picks: the seven families that have tiers to climb, in slot
    // order (Back in Black is a single badge, so it has none). MARKER_SLOTS: x = the picture's centre column in px from the zone's left edge,
    // feet = its bottom row in px above the canvas bottom. The five PNGs are 32x32, drawn scaled to MARKER_ART_PX square (48 = 1.5x, pixelated; 2026-11-08 Jeremy: bigger, easier to tap), every stone centred on column 16
    // with the same dirt lip on its bottom three rows. The layer is clipped at the zone's right edge and 52px past its left, so keep x between -30 and 118 (the stone itself is ~44px wide at
    // 48px; the left reach is the hill's low slope, which runs 52px past the zone, and css/graveyard.css clips the layer at -52). Every marker opens ONE window listing all of them; the tap box is MARKER_HIT_PX square (>= 44), so neighbours
    // overlap and the one drawn in front takes the tap (they all go to the same window).
    MARKER_FAMILIES: ['task_slayer', 'habit_hero', 'survivor', 'clean_sweep', 'on_fire', 'iron_will', 'honor_roll'],
    MARKER_SLOTS: [
        { x: 10, feet: 48 },
        { x: 94, feet: 44 },
        { x: 118, feet: 62 },
        { x: 46, feet: 38 },
        { x: 70, feet: 24 },
        { x: 118, feet: 22 },
        { x: 22, feet: 18 },
    ],
    MARKER_ART_PX: 48,
    MARKER_HIT_PX: 48,
    MARKER_Z_BASE: 21, // above the Memorial's 20 and the tree's tap box (10): a marker standing over the obelisk's base takes its own tap
    // Memorial obelisk (2026-11-08; Assets/Village/memorial_t1..t5.png, js/memorial.js, docs/ART_STYLE "Memorial obelisk T1-T5"). It replaced the six
    // placeholder headstones: ONE sprite on the hill's flat top, drawn in front of the tree. Placement decided with Jeremy on mocks of the real
    // layers: the plinth's bottom row stands FEET_PX above the canvas bottom (the hill rim is 101, so ~14px of plinth sits down in the lighter top
    // band) and the sprite's centre column is CENTER_X_PX in from the zone's left edge. Do not make a stage taller or raise the feet (the tip
    // touches the moon's bottom at 1280x720). The PNGs are 128x192, drawn 1:1, bottom-aligned; PLINTH_ROW is the last plinth row (0-based).
    GRAVEYARD_MEMORIAL_ART_W_PX: 128,
    GRAVEYARD_MEMORIAL_ART_H_PX: 192,
    GRAVEYARD_MEMORIAL_PLINTH_ROW: 181,
    GRAVEYARD_MEMORIAL_FEET_PX: 74, // was 86 / 92: moved down-left on 2026-11-08 so the growing tree's trunk shows beside it (Jeremy)
    GRAVEYARD_MEMORIAL_CENTER_X_PX: 60,
    GRAVEYARD_MEMORIAL_HIT_W_PX: 72, // the one tap box (>= 44), centred on the obelisk
    GRAVEYARD_MEMORIAL_HIT_H_PX: 132, // from the plinth up = the obelisk's height
    // Past-run graves creep out of the hill across the field: newest next to the hill, oldest
    // furthest left, on the same 3 lanes as the zombies, drawn just behind each lane's zombies.
    // Spacing starts wide and tightens as runs pile up; the oldest fade out near the church.
    RUN_GRAVE_MAX_SPACING_PX: 110,
    RUN_GRAVE_MIN_SPACING_PX: 22,
    RUN_GRAVE_JITTER_FRAC: 0.35, // +/- fraction of the spacing a grave may wander
    RUN_GRAVE_HEIGHT_PX: 26, // shorter than a zombie (128px box) on purpose
    RUN_GRAVE_HEIGHT_VARIANCE_PX: 8,
    RUN_GRAVE_TILT_DEG: 6, // +/- tilt
    RUN_GRAVE_OPACITY: 0.7, // low contrast so zombies read first
    RUN_GRAVE_FADE_PX: 90, // oldest fade out over the last N px before the church
    RUN_GRAVE_GAP_PX: 22, // newest grave sits this far left of the hill edge
    // --- V7 W2 village, first slice (2026-10-29; docs/ART_STYLE.md "Achievement village art") ---
    // Layout constants, not balance. One building so far: the Clock tower (kind `punctuality`).
    // Sprites are authored 128 wide and drawn 1:1 (same pixel scale as the animated zombies).
    VILLAGE_ENABLED: true, // false hides the whole layer
    VILLAGE_SPRITE_W_PX: 128, // Clock tower canvas width
    VILLAGE_SPRITE_H_PX: 256, // Clock tower canvas height (regenerated 2026-10-29, T1-T5 all 128x256); bottom-anchored
    VILLAGE_FEET_ABOVE_FLOOR_PX: 4, // feet sit this far above the floor band's top edge (the horizon)
    // The 1.3x STOPGAP stretch (2026-10-29 early) is OVER: the regenerated 128x256 Clock tower art has a door the same
    // size as the Jailhouse's, so the tower is drawn 1:1 like every other building. Kept as a lever (it is a MAXIMUM
    // scale in VillageLayout.clockScaleFor); leave it at 1 -- a non-whole scale breaks the ART_STYLE pixel rule.
    VILLAGE_CLOCK_SCALE: 1, // 1 = clean 1:1 pixels
    VILLAGE_CLOCK_ART_H_PX: 246, // tallest tier's visible art height (T5 = 246, T1 = 245), used to decide how far to lower the feet; must fit a 298px canvas (feet drop 24)
    VILLAGE_FEET_MAX_DROP_PX: 24, // the tower's feet may sink this far below the horizon on short canvases
    VILLAGE_MIN_FIELD_PX: 220, // a narrower walking field hides the village
    VILLAGE_TIERS: 5,
    VILLAGE_DEV_CLOCK_TIER: 3, // DEV: no punctuality tier data yet. `?villageTier=1..5` in the URL overrides, `off` hides; null = hidden
    // Jailhouse / sheriff's office (kind `defense` = Church Defense; re-keyed from `lurkers` 2026-10-29): 128x128 canvas, fieldstone, left of the tower.
    VILLAGE_JAIL_W_PX: 128,
    VILLAGE_JAIL_H_PX: 128,
    VILLAGE_DEV_JAIL_TIER: 3, // DEV: no defense tier data yet. `?jailTier=1..5` overrides, `off` hides; null = hidden
    // Command Post (kind `slain`, built as the Armory 2026-10-29, re-aimed at priorities 2026-11-09): survivor army camp (tent + guard tower), 128x128, RIGHT of the tower.
    VILLAGE_ARMORY_W_PX: 128,
    VILLAGE_ARMORY_H_PX: 128,
    VILLAGE_DEV_ARMORY_TIER: 3, // DEV: no slain tier data yet. `?armoryTier=1..5` overrides, `off` hides; null = hidden
    // Radio tower (kind `nights` = Nights Survived, added 2026-10-29): steel mast + radio shack, 128x160, a BACK-ROW building
    // between the Jailhouse and the tower. Raised on the ridge, darker, painted first (the front row covers it).
    VILLAGE_RADIO_W_PX: 128,
    VILLAGE_RADIO_H_PX: 160,
    VILLAGE_DEV_RADIO_TIER: 3, // DEV: no nights tier data yet. `?radioTier=1..5` overrides, `off` hides; null = hidden
    VILLAGE_BACK_ROW_RAISE_PX: 30, // back-row feet stand this far above the front row's feet (depth by ridge position, same sprite size; 2026-10-30: 14 -> 30, Jeremy: the village sits on a hill sloping down to the church and lanes)
    VILLAGE_BACK_ROW_BRIGHTNESS: 0.8, // back-row sprites are drawn at this brightness (CSS filter) so they recede behind the front row
    // Boxing gym (kind `lurkers` = willpower, added 2026-10-30): old grey clapboard gym, 128x128, FRONT row between the tower and the Armory.
    VILLAGE_GYM_W_PX: 128,
    VILLAGE_GYM_H_PX: 128,
    VILLAGE_DEV_GYM_TIER: 3, // DEV: no lurkers tier data yet. `?gymTier=1..5` overrides, `off` hides; null = hidden
    // High school (kind `heroes`, 2026-10-30): a BACK-ROW building; position in VILLAGE_PLACEMENT.
    VILLAGE_SCHOOL_W_PX: 128,
    VILLAGE_SCHOOL_H_PX: 128,
    VILLAGE_DEV_SCHOOL_TIER: 3, // DEV: no heroes tier data yet. `?schoolTier=1..5` overrides, `off` hides; null = hidden
    // Hospital (kind `habits`, 2026-10-30): sage stucco hospital + ER wing, 128x160, a BACK-ROW building in the gap between the gym
    // and the Armory. PLACEHOLDER ART: habits_t1..t5 are all the locked T3 until the other tiers are generated (PixelLab, Nov 7).
    VILLAGE_HOSPITAL_W_PX: 128,
    VILLAGE_HOSPITAL_H_PX: 160,
    VILLAGE_DEV_HOSPITAL_TIER: 3, // DEV: no habits tier data yet. `?hospitalTier=1..5` overrides, `off` hides; null = hidden
    // Windmill (kind `bestdays`, 2026-10-30, PLACEHOLDER art until PixelLab credits return Nov 7): farm water-pumping windmill on a
    // timber tower + barn-red pump house, 128x160, the first FAR-ROW building: one ridge further back than the back row (feet
    // VILLAGE_FAR_ROW_RAISE_PX above the back row's), darker, painted first, so mostly its wheel shows, between the school and
    // the hospital. The back row was full at 844 wide. A far-row building may hide behind any front/back building; it is
    // dropped only if its art would reach the church or the hill, or overlap the Clock tower's art (the landmark stays clear).
    VILLAGE_WINDMILL_W_PX: 128,
    VILLAGE_WINDMILL_H_PX: 160,
    VILLAGE_DEV_WINDMILL_TIER: 3, // DEV: no bestdays tier data yet. `?windmillTier=1..5` overrides, `off` hides; null = hidden
    VILLAGE_FAR_ROW_RAISE_PX: 30, // far-row feet stand this far above the BACK row's feet
    VILLAGE_FAR_ROW_BRIGHTNESS: 0.65, // darker than the back row (0.8) so it reads as further away
    // Visible-art extent [left, right) inside each kind's 128px canvas, the UNION over its five tiers (measured from the shipped sprites, 2026-10-30).
    // Collision, the church/hill edges and the back-row overlap use THESE, not the 128px boxes (most of a box is empty air), so five buildings fit.
    // ---- Village ARRANGEMENT (2026-10-30 night, Jeremy + Claude; DECISIONS "Village arrangement"). Designed for a landscape
    // phone (817px wide = a 517px walking field) and anchored to the graveyard hill. `right` = px from the field's right edge
    // (the hill) to the building's visible-art right edge (> 0 = tucked behind the hill); narrower fields scale it by
    // field / VILLAGE_DESIGN_FIELD_PX; wider ones keep the same cluster and CENTRE it in the field (Jeremy 2026-10-30). Rows by DOOR SIZE: front doors ~26-31px, back ~16-21, far ~17-18.
    // Only short buildings may stand in the ~90px under the moon + "NIGHTS SURVIVED" label. `flip` mirrors the sprite.
    VILLAGE_DESIGN_FIELD_PX: 517,
    VILLAGE_PLACEMENT: {
        lurkers: { row: 'front', right: -401 },          // Boxing gym, by the church
        punctuality: { row: 'front', right: -224 },      // Clock tower, centre
        defense: { row: 'front', right: -24 },           // Jailhouse, under the moon (short)
        habits: { row: 'back', right: -305 },            // Hospital, behind the gym / tower gap
        heroes: { row: 'back', right: -118 },            // High school, between the tower and the jail
        slain: { row: 'back', right: 40 },               // Armory: nudged 26px left on 2026-11-08 (was 66; first 44 left, then 18 back right after Jeremy's phone check) so the grown tree's canopy leaves most of its tower clear; 16px over the High school at 640 wide only
        bestdays: { row: 'far', right: -406, flip: true }, // Windmill, wheel over the gym + hospital (mirrored)
        nights: { row: 'far', right: -119, flip: true },   // Radio mast, right of the HUD Points button (mirrored)
    },
    VILLAGE_ART_X: { punctuality: [20, 113], defense: [14, 122], slain: [5, 125], nights: [12, 115], lurkers: [11, 122], heroes: [6, 125], habits: [9, 119], bestdays: [13, 116] },

    // ---- Village tiers (DECIDED 2026-10-30 night, DECISIONS "Village tiers"; docs/WORLD_FEEDBACK_PLAN.md "Village tiers + building cards") ----
    // BALANCE numbers, approved by Jeremy as a THEORY pass (rates are estimates; re-check against real play, like the shop prices).
    // Tier = progress in the CURRENT run only: it never goes down and every new run starts at T1. [T2, T3, T4, T5] = the per-run
    // counter value that reaches each tier. Counters live in js/villageProgress.js. Target pacing for a player doing reasonably
    // well: T2 ~4 days, T3 ~2.5 weeks, T4 ~7 weeks, T5 3+ months.
    VILLAGE_TIER_THRESHOLDS: {
        nights: [4, 18, 50, 100],         // Radio tower: nights survived (~1/day)
        slain: [8, 36, 100, 200],         // Command Post (was the Armory): priority tasks finished, max PRIORITY_SLOTS_PER_DAY a day (~2/day; Radio tower ladder x2). THEORY, 2026-11-09, docs/COMMAND_POST_PLAN.md
        punctuality: [25, 120, 350, 750], // Clock tower: completed on time (~8/day)
        habits: [20, 80, 250, 500],       // Hospital: habit check-ins (~5/day)
        lurkers: [3, 14, 40, 80],         // Boxing gym: days with no slips (>= 1 bad habit resolved, none slipped)
        defense: [3, 14, 40, 80],         // Jailhouse: nights the church ended at >= VILLAGE_DEFENSE_HELD_FRAC of max health
        // High school: hero stars banked (each closed day adds every routine's star rating, 0-5 each; High school v2, Jeremy 2026-10-31).
        // THEORY PASS: ~85% completion, routines added as slots unlock (1 routine at the start, max 4 at Lv3/5/7) -> T2 about the end
        // of week 1, T3 ~3 weeks, T4 ~7 weeks, T5 ~100 days (the Radio tower's pace). Re-check with real play data.
        heroes: [10, 75, 300, 750],
        bestdays: [2, 5, 15, 30],         // Windmill: heavy days handled (more due than the recent average, nothing missed)
    },
    VILLAGE_DEFENSE_HELD_FRAC: 0.75, // a night counts for the Jailhouse when the church ends the day at >= this fraction of MAX_BASE_HEALTH
    VILLAGE_HEAVY_DAY_WINDOW: 14, // the Windmill's "recent average" = this run's last N closed days
    VILLAGE_HEAVY_DAY_MIN_DAYS: 3, // ...and needs at least this many closed days of history before any day can be heavy
    VILLAGE_HEAVY_DAY_FACTOR: 1.25, // a day is HEAVY only when more than this x the recent average was due (Jeremy 2026-10-30, option 2: a permanent step up stops scoring once the average catches up)
    VILLAGE_HEAVY_DAY_MIN_EXTRA: 1, // ...and at least this many items above that average (keeps a tiny average from making every +1 "heavy")

    // ---- Village tier DROPS (DECIDED 2026-11-03, Jeremy + Claude; DECISIONS "Village tier drops"; docs/ECONOMY.md "Village tier drops") ----
    // Reaching star N of a building (N = 2..5; every building starts at star 1, which pays nothing) adds ONE fixed item to the HELD
    // inventory, once per star per run (js/villageDrops.js, ledger `currentRunStats.villageDropsPaid`). The harder stars pay more: the
    // thresholds above are tuned to the same pace for every building (about 4 days / 2.5 weeks / 7 weeks / 3+ months), so ONE shared ladder
    // by star. `default` = the ladder; any other key is a building kind whose rows REPLACE the ladder's for those stars (the star-5 prizes
    // are themed to what the building measures: the gym counts Break habits resisted -> Cheat Day, the hospital counts good habits ->
    // Skip Day, the radio tower counts nights survived -> Sick Day). Every itemId must be a held (`consumable`) SHOP_ITEMS id
    // (test/villageDrops.test.js checks). Theory-pass value per star: 10 / 25 / 50 / 100 pts (200 at the themed star-5 prizes);
    // Jeremy's leaner alternative (Short Pushback at star 2, Medium Pushback at star 3, 5 / 10 pts) is kept for a future difficulty
    // setting or a post-playtest retune. Retune through the balance-tuning protocol; never hardcode in js/.
    // Red line relaxed on purpose (Jeremy, 2026-11-03): LEVEL_PERKS keeps "no 200-pt token before max level", but a village star 5 is a
    // 3+ month feat, about when Lv 9 lands, so it may pay a 200-pt token.
    VILLAGE_TIER_DROPS: {
        default: {
            2: { itemId: 'pushback_medium', count: 1 }, // Medium Pushback (2 hr), 10 pts
            3: { itemId: 'repair_small',    count: 1 }, // Repair Kit (Small), 25 pts
            4: { itemId: 'repair_medium',   count: 1 }, // Repair Kit (Medium), 50 pts
            5: { itemId: 'repair_large',    count: 1 }, // Repair Kit (Large), 100 pts
        },
        lurkers: { 5: { itemId: 'cheat_day', count: 1 } }, // Boxing gym: Habit Cheat Day (Break habits only, like the gym)
        habits:  { 5: { itemId: 'skip_day',  count: 1 } }, // Hospital: Skip Day (one habit)
        nights:  { 5: { itemId: 'sick_day',  count: 1 } }, // Radio tower: Sick Day (every habit)
    },

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
    // sprite box width. RE-MEASURED 2026-10-12 for the animated sprites ([P2-GAME-010]
    // Stage 2a) from each atlas JSON's bodyBox (walk+idle union), relative to the
    // 128px character region centred in the cell: pad = (frameWidth-128)/2,
    // left = (bodyBox.left-pad)/128, right = (128-(bodyBox.right+1-pad))/128.
    // (Previously measured 2026-07-17 from the static Assets/Zombies/*.png.)
    // left = transparent margin on the left, right = transparent margin on the right.
    // Used so cluster offsets butt the actual graphics together instead of the boxes.
    ZOMBIE_VISIBLE_MARGINS: {
        career:        { left: 0.188, right: 0.141 },
        creativity:    { left: 0.078, right: 0.070 },
        financial:     { left: 0.109, right: 0.141 }, // bank robber 2026-10-19
        health:        { left: 0.172, right: 0.234 },
        lifestyle:     { left: 0.031, right: 0.023 },
        relationships: { left: 0.047, right: 0.039 },
        spirituality:  { left: 0.141, right: 0.195 },
        other:         { left: 0.125, right: 0.195 },
    },
    ZOMBIE_VISIBLE_MARGIN_FALLBACK: { left: 0.2, right: 0.2 },

    // Run history (Milestone 3 "Run history + run review", sub-session 1,
    // session 52 — docs/RUN_HISTORY_PLAN.md). Oldest records drop past the
    // cap (RunStats.appendToHistory). Tunable via the balance protocol.
    RUN_HISTORY_MAX: 50,
    // Per-routine rollup (sub-session 4, session 55): how many past-run rows
    // to show per routine in the Stats window's "Routine Performance"
    // section (RunStats.rollupRoutinePerformance). Display cap, not gameplay
    // balance — same category as the other display-only HERO_* constants above.
    ROUTINE_ROLLUP_MAX_RUNS: 5,

    // Achievements & badges (Milestone 4, session 64 — docs/ACHIEVEMENTS_PLAN.md).
    // Badge-only v1 (fork 1): no point payouts, so these thresholds carry no
    // economy risk the way shop pricing does — but still logged in
    // DECISIONS.md per the "never change balance numbers silently" guardrail,
    // and still DATA (not hardcoded), so they're easy to retune once real
    // play data exists. `metric` keys index into `lifetimeStats`
    // (Achievements.freshLifetimeStats shape, js/achievements.js). Tiers are
    // authored ascending; `id` is the persisted key in the unlocked-tier map.
    ACHIEVEMENTS: [
        {
            id: 'survivor', name: 'Survivor', metric: 'bestRunDaysSurvived', nearMissUnit: 'night', // nights (local midnights) since 2026-10-27
            tiers: [
                { id: 'survivor_1', label: 'Bronze', threshold: 3 },
                { id: 'survivor_2', label: 'Silver', threshold: 7 },
                { id: 'survivor_3', label: 'Gold', threshold: 14 },
                { id: 'survivor_4', label: 'Platinum', threshold: 30 },
            ],
        },
        {
            id: 'task_slayer', name: 'Task Slayer', metric: 'tasksCompleted', nearMissUnit: 'task',
            tiers: [
                { id: 'task_slayer_1', label: 'Bronze', threshold: 10 },
                { id: 'task_slayer_2', label: 'Silver', threshold: 50 },
                { id: 'task_slayer_3', label: 'Gold', threshold: 250 },
                { id: 'task_slayer_4', label: 'Platinum', threshold: 1000 },
            ],
        },
        {
            id: 'habit_hero', name: 'Habit Hero', metric: 'habitsCompleted', nearMissUnit: 'habit',
            tiers: [
                { id: 'habit_hero_1', label: 'Bronze', threshold: 10 },
                { id: 'habit_hero_2', label: 'Silver', threshold: 50 },
                { id: 'habit_hero_3', label: 'Gold', threshold: 250 },
                { id: 'habit_hero_4', label: 'Platinum', threshold: 1000 },
            ],
        },
        {
            id: 'on_fire', name: 'On Fire', metric: 'bestHabitStreak', nearMissUnit: 'day',
            tiers: [
                { id: 'on_fire_1', label: 'Bronze', threshold: 7 },
                { id: 'on_fire_2', label: 'Silver', threshold: 14 },
                { id: 'on_fire_3', label: 'Gold', threshold: 30 },
            ],
        },
        // Achievements swap (2026-11-03, Jeremy; DECISIONS 2026-11-03): Steady Hands is RETIRED (it only counted at
        // game over and stopped growing in long runs) and replaced by three LIFETIME day/resist counters. Tiers:
        // Clean Sweep and Iron Will 7/30/100/365 (a week, a month, 100 days, a year of one-a-day), Honor Roll
        // 30/150/500/1500 (hero-days: three honor-roll routines reach Bronze in 10 days). Retune via balance-tuning.
        {
            id: 'honor_roll', name: 'Honor Roll', metric: 'heroHonorDays', nearMissUnit: 'hero-day',
            tiers: [
                { id: 'honor_roll_1', label: 'Bronze', threshold: 30 },
                { id: 'honor_roll_2', label: 'Silver', threshold: 150 },
                { id: 'honor_roll_3', label: 'Gold', threshold: 500 },
                { id: 'honor_roll_4', label: 'Platinum', threshold: 1500 },
            ],
        },
        {
            id: 'clean_sweep', name: 'Clean Sweep', metric: 'cleanDays', nearMissUnit: 'day',
            tiers: [
                { id: 'clean_sweep_1', label: 'Bronze', threshold: 7 },
                { id: 'clean_sweep_2', label: 'Silver', threshold: 30 },
                { id: 'clean_sweep_3', label: 'Gold', threshold: 100 },
                { id: 'clean_sweep_4', label: 'Platinum', threshold: 365 },
            ],
        },
        {
            id: 'iron_will', name: 'Iron Will', metric: 'breaksResisted', nearMissUnit: 'time',
            tiers: [
                { id: 'iron_will_1', label: 'Bronze', threshold: 7 },
                { id: 'iron_will_2', label: 'Silver', threshold: 30 },
                { id: 'iron_will_3', label: 'Gold', threshold: 100 },
                { id: 'iron_will_4', label: 'Platinum', threshold: 365 },
            ],
        },
        {
            id: 'back_in_black', name: 'Back in Black', metric: 'pointsRecoveries', nearMissUnit: null,
            tiers: [
                { id: 'back_in_black_1', label: null, threshold: 1 },
            ],
        },
    ],
    // Achievements sub-session 4 (polish, 2026-07-20 session 68): how close
    // (as a fraction of a locked tier's threshold) a family's next tier has
    // to be before the Stats current-run panel nudges it. UI-only constant
    // (no economy/balance effect), not gated by the balance-tuning skill.
    NEAR_MISS_THRESHOLD_PCT: 0.8,

    // ---- Design batch 2026-10-25 (Fable; docs/DESIGN_QUESTIONS_KO_EDIT_TIMER.md,
    // DECISIONS 2026-10-25). DATA ONLY — nothing reads these yet; the build
    // sessions wire them. Balance numbers: change only via the balance-tuning
    // protocol.
    //
    // KO ghosts: a KO'd routine's habits/tasks stay as completable ghosts.
    // Completing one pays XP + a habit success occurrence but points × this
    // factor (0 = the routine's economy is down while KO'd). Leaving one
    // undone is excused (no miss, no streak reset, no damage).
    KO_GHOST_POINTS_FACTOR: 0,
    // Any due-time edit this soon after the item's creation is free (typo fix). Grace moves are never
    // flagged `pushedLate` and never use a charge.
    RESCHEDULE_GRACE_MS: 10 * 60 * 1000,
    // ---- Pushback charges (docs/PUSHBACK_CHARGES_PLAN.md; DECIDED 2026-11-02,
    // Fable balance pass; Build A 2026-11-02). Pure logic in js/pushback.js; wired
    // in Build B (2026-11-02): the zombie popup, edit form and Base Health panel
    // all go through it. It replaced the distance-priced rescheduling (zone factors,
    // 1 free paid-zone edit a week) and the 50/100/300 pushback shop rows.
    // Sizes, ascending: a move uses the SMALLEST size that covers its distance
    // (measured from the later of the current due and now); beyond the largest,
    // ceil(distance / largest.ms) of the largest. baseCost = points to pay
    // instead of a charge or held token (level discount applies; the 1.5^held
    // curve applies only when BUYING a held token). window: 'day' charges refill
    // at day rollover, 'week' charges are a rolling 7-day window of use timestamps.
    PUSHBACK_SIZES: [
        { id: 'short',  ms: 30 * 60 * 1000,      baseCost: 5,  window: 'day' },
        { id: 'medium', ms: 2 * 60 * 60 * 1000,  baseCost: 10, window: 'day' },
        { id: 'long',   ms: 24 * 60 * 60 * 1000, baseCost: 30, window: 'week' },
    ],
    // Free charges by Clock tower star (1-5): per day for short/medium, per
    // rolling 7 days for long. Stars are per run, so they reset at game over.
    // Each star adds one charge: 2 = +1 Short, 3 = +1 Medium, 4 = +1 Long, 5 = +1 Long.
    PUSHBACK_ALLOWANCE: {
        1: { short: 3, medium: 2, long: 2 },
        2: { short: 4, medium: 2, long: 2 },
        3: { short: 4, medium: 3, long: 2 },
        4: { short: 4, medium: 3, long: 3 },
        5: { short: 4, medium: 3, long: 4 },
    },
    // Inside this much time to the CURRENT due (or overdue) a later move uses a
    // pushback (and, from Build B, flags the item so the Clock tower skips it).
    // More than this far out, moving later is free planning.
    PUSHBACK_PAID_ZONE_MS: 4 * 60 * 60 * 1000,
    // Anytime next-morning card (2026-11-02, Jeremy; DECISIONS 2026-11-02 night, credit cap): "Done" there counts as ON TIME only
    // while the player has credits. ANYTIME_MORNING_CREDITS per rolling ANYTIME_MORNING_CREDIT_WINDOW_MS (7 days), one slot coming
    // back at a time (the same rolling shape as the Long pushback). Out of credits, Done still completes the task but counts late.
    // Starting number: 2. Balance numbers change only through the balance-tuning process.
    ANYTIME_MORNING_CREDITS: 2,
    ANYTIME_MORNING_CREDIT_WINDOW_MS: 7 * 24 * 60 * 60 * 1000,

    // --- Priority slots (DESIGNED 2026-11-04, Jeremy; docs/PRIORITY_SLOTS_PLAN.md; DECISIONS 2026-11-04 (priority slots)).
    // A task's "Priority" box is a SLOT: this many per local due day. A slot is spent when a task is marked (unmarking never
    // gives it back); finishing a full set of this many priorities on a day opens this many fresh slots for that day. The same
    // number is the set size and the reset size. A balance number: change it only via the balance-tuning process (DECISIONS).
    PRIORITY_SLOTS_PER_DAY: 3,

    // --- Goals (DESIGNED 2026-11-04, Jeremy; docs/GOALS_PLAN.md; DECISIONS 2026-11-04 (goals)). Build A data + rules; nothing on screen yet.
    // Goal SLOTS by player level. Slots unlock by in-run level and are kept forever as a high-water mark (`goals.bestSlots`, the
    // `bestRoutineSlots` precedent), so a lost run never takes a slot back. Even levels only: a goal slot never lands on the same
    // level-up as a routine slot (odd levels). Every level has an entry and the table never decreases (a test checks).
    // A balance number: change it only via the balance-tuning process (DECISIONS).
    GOAL_SLOTS_PER_LEVEL: { 1: 2, 2: 3, 3: 3, 4: 4, 5: 4, 6: 5, 7: 5, 8: 6, 9: 6 },
    // First day of a "Every week" goal's week: 0 = Sunday, 1 = Monday. (A Settings row later, if asked.)
    GOAL_WEEK_STARTS_ON: 1,
    // A goal stays "ahead" while its progress is within this share of the elapsed line, so the pace dot does not flicker.
    GOAL_PACE_SLACK: 0.1,
    // How many closed periods a recurring goal remembers (the history strip), and how many finished goals the roster keeps.
    GOAL_HISTORY_KEEP: 26,
    GOAL_ROSTER_KEEP: 500,
    // The daily-record numbers a "Your days" (aggregate) target may watch. `path` = a dotted path into a DailyRecord (js/goalMetrics.js);
    // `special` = a derived number (prioritySets, perfectDay). Add a row to offer a new metric; the id is saved in the player's goals, so
    // never rename or reuse one.
    GOAL_METRICS: [
        { id: 'tasksDone', label: 'Tasks done', unit: 'tasks', path: 'done.task' },
        { id: 'buildHabitsDone', label: 'Build Habits done', unit: 'habits', path: 'done.habit' },
        { id: 'breakHabitsResisted', label: 'Break Habits resisted', unit: 'times', path: 'lurk.avoided' },
        { id: 'timeLoggedMin', label: 'Time Logged', unit: 'min', path: 'timer.workMin' },
        { id: 'baseDamageTaken', label: 'Base damage taken', unit: 'HP', path: 'dmg.taken' },
        { id: 'prioritySets', label: 'Full sets of 3 priorities done', unit: 'sets', special: 'prioritySets' },
        { id: 'perfectDay', label: 'Perfect routine attendance', unit: 'days', special: 'perfectDay' },
        { id: 'pointsEarned', label: 'Points earned', unit: 'pts', path: 'pts.earned' },
    ],
    // Goal rewards (Goals Build C; design: Jeremy + Claude 2026-11-05, DECISIONS "goals Build C"). THEORY numbers: tune with play data.
    //   periodBonusPct  a recurring goal met pays this share of the points the player EARNED in that period (the closed daily records'
    //                   pts.earned), never a flat sum: a trivially easy goal on a quiet day pays about nothing, so it cannot be farmed.
    //   streakBonusPer / streakBonusCap  +10% of that bonus per consecutive period met, capped at +50% (the 5th in a row).
    //   item            what a finished one-time goal and a monthly period met pay: one Earned Sick Day (SHOP_ITEMS, keptAcrossRuns).
    //   itemMinAgeDays  a goal must be this old before it pays an item (a yes/no made and ticked in one sitting pays nothing).
    //   itemCooldownDays  at most one goal item per this many days; extra ones are OWED and paid when the cooldown ends.
    //   No XP: levels cap and reset with the run; no flat points for typed numbers (the player's own word). Nothing here softens damage.
    GOAL_REWARDS: {
        periodBonusPct: { day: 0.10, week: 0.15, month: 0.20 },
        streakBonusPer: 0.10,
        streakBonusCap: 0.50,
        item: { itemId: 'earned_sick_day', count: 1 },
        itemMinAgeDays: 7,
        itemCooldownDays: 7,
    },
    GOAL_REWARD_MAX: 80, // longest "my own reward" text (characters)
    // The two suggested goals every fresh save starts with (the player keeps, changes or removes them). Theme-neutral copy.
    GOAL_STARTERS: [
        {
            name: 'A productive week', kind: 'recurring', period: 'week',
            targets: [{ type: 'aggregate', label: 'Finish 3 tasks on 5 days', metric: 'tasksDone', op: 'days', threshold: 3, compare: 'gte', count: 5 }],
        },
        {
            name: 'One big thing', kind: 'milestone', deadline: null,
            targets: [{ type: 'number', label: 'Steps', start: 0, end: 10, current: 0, unit: 'steps' }],
        },
    ],
    // Work timer: overdue base + routine damage is multiplied by this while a
    // timer runs on the item (never 0 — a running timer is not a free pass).
    WORK_TIMER_DAMAGE_FACTOR: 0.5,
    // After this much continuous running the game asks "Still working?";
    // with no answer for WORK_TIMER_AUTO_STOP_MS the timer stops itself and
    // banks time only up to the prompt.
    WORK_TIMER_CHECK_MS: 60 * 60 * 1000,
    WORK_TIMER_AUTO_STOP_MS: 10 * 60 * 1000,
    // Ice (docs/ICE_PLAN.md; numbers approved by Jeremy 2026-11-10): a zombie at the church can't attack while the work timer
    // runs on ITS task, for up to ICE_MAX_MS of ice per task in total (across sessions; when it is spent the zombie attacks
    // again at the timer's usual half rate). Pausing leaves it iced for ICE_GRACE_MS. ICE_MAX_MS matches WORK_TIMER_CHECK_MS,
    // so "Still working?" and the ice cracking are one moment. Balance numbers: change only through the balance process.
    ICE_MAX_MS: 60 * 60 * 1000,
    ICE_GRACE_MS: 5 * 60 * 1000,
};

// Export for Jest/Node; browser picks up the global `CONFIG` via <script> tag.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

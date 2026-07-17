# Mechanics — Enemies, Base, Damage, Progression

## Enemies (Tasks & Habits)

- Enemies spawn on the right and advance left toward the base. Position/speed is tied to real due date/time: closer due = closer to base and more menacing (faster animation, even if actual speed is unchanged).
- Max 20 enemies on screen; overflow waits offscreen right, scrollable.
- Appearance by category — see ART_STYLE.md for the 8 zombie skins.
- High-priority task: glowing/bright outline.
- Task with sub-tasks: appears LARGER; shrinks toward normal size as sub-tasks are completed. Completing sub-tasks weakens the parent.
- Habits render smaller than tasks. Habits with high streaks appear ON FIRE.

## Defeating Enemies

- Defeat = user marks the task/habit complete (Attack button then tap enemy, or Complete/Defeat in the agenda list).
- On defeat: explosion animation, player earns points/currency + XP; the routine it belongs to earns XP.
- UNDO required: accidental completes must be reversible — keep a "recently defeated" view to restore from.

## Base

- A country church overlooking an eerie graveyard. 100 HP. **Healing/recovery is an OPEN QUESTION — not implemented, and the docs disagree with each other** (this line's "replenishes to full each day" vs. PROJECT_SPEC's gradual 1 HP/5min regen + repair-kit-gated recovery after destruction — see DECISIONS.md 2026-07-17). Do not build against either description until it's decided.
- Visual damage states (see ART_STYLE.md): shakes on each hit; progressively destroyed; smoking; fully engulfed in flames right before destruction.
- Base HP reaching 0 ends the run. Game-over screen: "Your Base survived X days. What adjustments can you make to have a stronger Base in your life?" + New Base button.
- Run history log: routines used, active date range, and which tasks/habits took the base out. New run starts with the same active tasks/habits/routines.

## Overdue Damage

- When an enemy reaches the base (item is due/overdue): base takes 1 HP damage every 5 minutes until the item is completed.
- If still incomplete after 1 hour, the enemy gets INSIDE the base and starts damaging the health of the Routine it belongs to.

## Habits: Positive & Negative

- Positive habit completed, or negative habit avoided → earn points.
- Negative habit indulged, or positive habit missed → lose points. Points CAN go negative.
- Time-of-day matters: track when habits are due/completed to surface behavior patterns (help break negative patterns, reinforce hard positive ones).
- Streaks: missing a habit (overdue) resets its streak to 0. High streaks give a higher chance of double points on completion, plus the on-fire visual.
- **Editing a live habit instance** (agenda row edit pencil, implemented 2026-07-17): opens the habit-definition editor (name/category/frequency/time-of-day/type), pre-filled from `definedHabits`. Saving updates the definition AND syncs any already-spawned instance's name/category/isNegative + re-renders its agenda row immediately. Frequency/time-of-day changes do NOT retroactively move today's due time — they take effect starting the next day's instance. (Tasks and habits render via distinct branches in `createListItem`, each with their own edit target — see docs/ARCHITECTURE.md.)

## XP & Leveling

- Prototype values (all live in `src/config.js`): 10 XP per task defeat, 5 XP per habit completion.
- Player XP/levels track progress within the current run; leveling unlocks routine slots and base upgrades.
- Routines gain XP when their tasks/habits are completed (see ROUTINES.md).

## Sub-tasks

- Sub-tasks render as their own smaller (`CONFIG.SUBTASK_ENEMY_WIDTH` = 64×64) enemy sprites, bottom-aligned with their parent (feet on the same ground line — not top-aligned) and fan out beside it, alternating right/left by creation order: 1st right of the parent, 2nd left, 3rd further right (clearing the 1st), 4th further left, etc.
- **Offsets are computed from the sprites' VISIBLE graphic edges, not their box edges.** The zombie PNGs have large transparent margins (visible graphic is ~44%–92% of the box width depending on category, and not centered — e.g. lifestyle leans right). Per-category margins were measured from the PNGs' alpha channels on 2026-07-17 and live in `CONFIG.ZOMBIE_VISIBLE_MARGINS`; `getSubTaskClusterOffset` chains each sibling's visible edge `CONFIG.SUBTASK_CLUSTER_GAP_PX` (8px) from the previous one's, handling mixed sibling categories. If sprite art is ever redrawn, re-measure and update the margin table (alpha-bbox script in DECISIONS.md 2026-07-17 entry). The parent sprite always renders above any overlapping sub-task sprite (z-index: parent 10, sub-task 5).
- Sub-tasks track the PARENT's timeline position (plus the cluster offset above) rather than their own due date, so a sub-task due only a little earlier/later than its parent stays visually clustered with it instead of drifting away. A sub-task only breaks from the cluster and shows further ahead (closer to the base) on its own timeline if its own due date is due *significantly* earlier than the parent's (currently: its own timeline x would be 150px+ closer to the base — `CONFIG.SUBTASK_AHEAD_THRESHOLD_PX`).
- Sub-tasks do NOT get their own entry in the main agenda list — only nested inside their parent's list item.
- **Open tension, not yet resolved:** the original spec (PROJECT_SPEC.md) describes the PARENT growing larger with more sub-tasks and shrinking as they're completed, rather than sub-tasks appearing as separate visible sprites at all. The current implementation (separate clustered sub-task sprites) is what's actually built and was confirmed by Jeremy on 2026-07-17; the "growing/shrinking parent" idea is not implemented and is a candidate for Milestone 3 ([P1-DATA-004] sub-task hierarchy) — worth a deliberate decision on whether both effects happen together or the shrinking-parent idea is dropped.

## Offline Catch-up (implemented 2026-07-17)

- On restore, zombies animate (ease-out, capped at `CONFIG.OFFLINE_CATCHUP_MAX_MS` = 5s) from their last-saved positions to their current-time positions. Skipped for very brief absences (`CONFIG.OFFLINE_ANIMATION_THRESHOLD_MS` = 30s) — positions just update instantly.
- **Offline overdue damage policy** (decided with Jeremy, see DECISIONS.md 2026-07-17): each item that spent offline time overdue is back-charged its real elapsed damage (same 1 HP/`DAMAGE_INTERVAL_MS` rate as live play), but capped at `CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM` = 12 HP **for that item's entire lifetime**, not per restore. Design principle: punish the COUNT of neglected items, not the DURATION you were away — sleeping/being busy shouldn't be able to kill the base by itself, but enough neglected items still can (8+ at the current cap). Time already charged live (before the item was saved) is never double-charged; the chargeable window starts at whichever is later, the item's due time or the start of the offline period. Offline progression itself is capped at 3 days (`CONFIG.OFFLINE_MAX_MS`, per PROJECT_SPEC).
- **Editing a task's due date re-evaluates overdue state** (`recomputeOverdueStateAfterEdit`, companion fix to the above): pushing an overdue task's deadline into the future clears its overdue flag/visuals and stops further damage — the intended escape hatch if a deadline was set too aggressively. Pulling a not-yet-due task's deadline into the past marks it overdue immediately. Not yet wired into the habit-instance editor (frequency/time-of-day changes there still don't retroactively move today's instance — pre-existing gap, see ROUTINES.md/DECISIONS.md).
- Offline HEALING (gradual recovery while away) is NOT implemented — belongs to Milestone 4's base-healing system ([P2-GAME-012]); it isn't live yet either.

## Open Questions (ask Jeremy before implementing)

- Exact HP/damage numbers for enemies inside the base damaging routine health.
- Double-points probability curve for streaks ("higher chance" per spec; exact % TBD).
- Note: negative-habit avoidance IS spec'd — validated via daily check-in prompts (see ROUTINES.md).
- **Base healing: daily full reset vs. gradual regen + repair kits.** MECHANICS.md and PROJECT_SPEC.md describe two different, currently-unimplemented recovery systems (see DECISIONS.md 2026-07-17). Must be decided before [P2-GAME-012] (Milestone 4).

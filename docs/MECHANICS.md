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

- A country church overlooking an eerie graveyard. 100 HP, replenishes to full each day.
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

## XP & Leveling

- Prototype values (all live in `src/config.js`): 10 XP per task defeat, 5 XP per habit completion.
- Player XP/levels track progress within the current run; leveling unlocks routine slots and base upgrades.
- Routines gain XP when their tasks/habits are completed (see ROUTINES.md).

## Sub-tasks

- Parent tasks with sub-tasks are larger enemies (more steps = bigger threat).
- Completing sub-tasks shrinks/weakens the parent enemy.

## Offline Catch-up
On app reopen, paused zombies animate quickly (max 5 seconds) to their current time positions.

## Open Questions (ask Jeremy before implementing)

- Exact HP/damage numbers for enemies inside the base damaging routine health.
- Double-points probability curve for streaks ("higher chance" per spec; exact % TBD).
- Note: negative-habit avoidance IS spec'd — validated via daily check-in prompts (see ROUTINES.md).

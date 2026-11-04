# Run-end carryover plan (BUILT 2026-11-03)

Jeremy, 2026-11-03: "make sure the users don't lose items when a current run ends. Make sure they don't lose routine slots. When a run ends explain to the user what carries over to the next run and what they lose." Forks resolved the same night (Fable 5.1, then Sonnet build). Code: `js/runCarryover.js` (pure), `State` (`bestRoutineSlots`), script.js `startNextRun`, `js/ui/gameOverView.js`, `js/ui/howItWorks.js` topic `runs`. Tests: `test/runCarryover.test.js`. sw v240.

## The rule
A player never loses what they built or paid for because the church fell. Narrowed from the 2026-07-19 (session 52) full-reset decision, which stands for everything not listed here.

| Carries into the next run | Starts over |
|---|---|
| Habits, routines, heroes (level / XP / slots inside each hero) | Church health |
| **Open one-off tasks + their sub-tasks**, with due dates, priority, pushedLate | Player level, XP, points |
| **Routine slots**: never below the best ever held (`bestRoutineSlots`) | Level perks, the Lv2/4/6/8/9 gifts (earned again next run) |
| **Held items flagged `keptAcrossRuns`** (none today) | Held items bought with run points or gifted by a perk / village star |
| Run history, achievements, lifetime stats, daily records, settings | Pushback charges, anytime credits, Sick Day, village tiers + drops ledger, the sky |

## Decisions (Jeremy's answers)
1. **Items: "anything that cannot be re-earned by playing is kept until used, whatever run it is."** Today every item is re-earnable (bought with run points, or gifted by a level perk / village star that the next run pays again; achievements are badge-only; no real-money shop), so nothing is kept TODAY. The rule is built as a hook: a `CONFIG.SHOP_ITEMS` row with `keptAcrossRuns: true` survives; `RunCarryover.inventoryToKeep` filters on it. Not built yet (no item needs it): spending the "this run" copy before the kept copy, and excluding kept items from the 1.5^held price curve. Do both the day the first kept item exists.
2. **Open one-off tasks carry over.** Restart used to wipe the player's real to-do list (MECHANICS said it should not). Habit instances, routine task instances and KO ghosts are regenerated from definitions, so they are not carried. A carried overdue task re-enters at the church with a FRESH damage clock (no catch-up for the dead run's time), exactly as a reload does.
3. **Slots: option A, keep the most earned.** Level, XP, points and perks still reset; slots are `max(table[level], bestRoutineSlots)`. Cost: the Lv3/5/7 unlocks give nothing until the player passes their best. Rejected B (keep player level): resurrects the level-oscillation exploit the banked-slot-points design closed, makes the Lv4/8 shop discounts permanent, and needs a paid-once perk ledger + economy rebalance.
4. **Explained in two places:** the game-over card ("Next run": You keep / Starts over, live counts) and a "When a run ends" topic in How Deadline works.

## Mechanics
- `State.setRoutineSlots` keeps the high-water mark; the mark is saved at the root (`bestRoutineSlots`, additive, NO schema bump; absent = 0) and restored BEFORE the live count. `initGame` and restore both use `State.slotsForLevel`. A dev Reset zeroes it.
- `startNextRun` (Restart button): collect carried tasks + kept inventory, remember `itemIdCounter` (carried ids must not be reused), clear the save, `initGame()`, restore the counter + inventory, re-add each task through `addItemToGame`, re-mark overdue, rebuild parent list rows, `sortAndRenderActiveList`, save.
- The game-over card summary is computed when the run ends (the items are still on the canvas then).
- Edge: a carried task's `dueDateTime` may be in the past (it was overdue) - it comes back overdue, damage resumes on the next tick. Edge: Restart with the game never over (dev) is the same path.

## Not done / later
- Kept-item spend order + price-curve exclusion (see decision 1).
- If the odd levels feel empty above the best slot count, give them another reward (Jeremy's call).
- Phone check of the Restart flow and the card on a real device.

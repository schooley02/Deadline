# Priority slots (3 a day) -- plan

_Designed 2026-11-04 (Claude app session, Fable; Jeremy). **Build A BUILT 2026-11-04 (Sonnet; sw v255, schema 17, DailyRecord v9). Build B BUILT 2026-11-04 (Sonnet; sw v256, Jest 172 suites / 3,951); phone-checked by Jeremy 2026-11-04 ("it works").** DECISIONS 2026-11-04 (priority slots). ROADMAP M5 "Priority slots"._

_Build A notes (differences from the text below): the marks map is `State.priorityMarks` (`getPriorityMarks / setPriorityMarks`); sub-tasks that inherit a parent's priority carry `item.priorityInherited`; `Items.prioritySlotsFor(dueDateTime, deps)` returns `{ key, marks, done, left }` for the forms; Edit Task's own due-date change and the routine task forms' checkbox are Build B (until then the forms still write the flag directly). The move-stripping hook `Items.syncPriorityOnMove` is wired into five paths (see CLAUDE.md)._

_2026-11-10: priority tasks due today or earlier now render in their own "Priority (N)" group at the top of Today's list (DECISIONS 2026-11-10 (priority group)). Also: the week-strip star (`★N/3`) described below was REMOVED from the day tabs (Jeremy: not useful to the player); `weekStripSummary` no longer has `highPriorityCount`. Priority use is still recorded in DailyRecord `pri`. See DECISIONS 2026-11-10 (week strip)._

_Build B notes (differences from the text below): the wording uses a colon, not "--" ("Priority: 2 of 3 left today"); on phones the pips take their own row under the title (beside it they squeezed "Today's Deadlines" onto two lines); Edit Task on another day starts unticked and costs that day a slot, moving back restores the tick; the zombie card is read-only ("Priority: Yes / No") and marking happens in the forms; the week strip's Today tally ignores priority tasks due later. See UI_UX "Priority slots" and DECISIONS 2026-11-04 (priority slots)._

_Follow-up 2026-11-09: priorities finished now also build the village's Command Post (the Armory re-aimed; max 3 a day counts, from `pri.d`). See `docs/COMMAND_POST_PLAN.md`. The parked RARE "Extra Priority" token belongs on its star 5 if ever built._

## Goal

Turn the unlimited "High Priority" checkbox into **three priority slots per day**, so the player picks the few big things that matter for a day instead of flagging everything. The constraint is the mechanic: it trains "pick three, finish three" (the rule of three), and finishing all three is rewarded with three more.

Jeremy: "we want to encourage the user to try not to focus on too many big items for each day and cap it at 3 anyways, unless they use the last one to reset it."

## What Jeremy decided (2026-11-04)

1. **Three slots a day, fixed.** Not a level perk, not for sale. A perk ladder (1 -> 2 -> 3 by level) was rejected: perks reset with the run, so every game over would drop the player to one slot right when the reset should re-motivate, and it would shrink early x2 income. Buying extra slots was rejected: scarcity is the whole value, and a shop row is a standing invitation to overload yourself. (Parked: if play data says people want a release valve, a RARE held token -- e.g. a village star drop "Extra Priority x1" -- fits the drop system without ever being purchasable.)
2. **A slot is spent when you mark it.** Unchecking an open priority removes the glow and the x2 but does NOT give the slot back. Replanning midday is allowed; it costs the slot. (Free re-marking was rejected: the three priorities would collapse into "whatever I'm about to finish", and the x2 would always land on the easiest wins.)
3. **Finish all three, get three more.** Completing a full set of three priorities on a day opens three fresh slots for that day; nothing else does.
4. **Slots belong to the task's DUE day.** Today has three; each later day has its own three, so tomorrow's three can be chosen tonight (Edit Task on a one-off task due tomorrow).
5. **Tasks only.** Standalone tasks, routine-task instances and sub-tasks. Habits have no priority (unchanged).
6. **Routine task definitions lose the checkbox.** A routine's saved task template no longer carries High Priority; every priority is a deliberate tap on the day's instance. (Option "the def takes a slot at spawn if one is free" was rejected: under rule 2 a routine would spend the player's slots at midnight before they looked at the day -- a choice made for them, the opposite of the point.)
7. **Sub-tasks:** a priority PARENT covers its sub-tasks for ONE slot (they inherit the glow and the x2; their own checkbox is hidden while the parent is priority). A sub-task CAN be marked alone, without the parent, for its own slot ("only step 2 of this project matters today").
8. **A move to another day strips priority.** Pushback across midnight, an Edit Task due-date change, "Tomorrow" on the evening check: the task arrives on the new day as a normal task (the old day's slot stays spent). A plan for a day is for that day; mark it again there if it is still a big rock (uses one of that day's slots).

## Rules in one place

- `marks[day]` = how many priority marks were spent on that day (stored, see Data). A mark is spent the moment a task due on `day` is set to priority (Add Task with the box ticked, Edit Task, the sub-task form, the zombie card). Unmarking never lowers it.
- `done[day]` = priority tasks due on `day` that are completed (derived from `completedItems` + `activeItems` as today: `isHighPriority && completedAt`, counting a priority parent once and a priority sub only when its parent is not priority). Undo lowers it.
- **`available(day) = 3 + 3 * floor(done[day] / 3) - marks[day]`**, shown as `max(0, available)`. Marking is allowed only while `available > 0`.
  - Mark 3 -> 0 left. Finish all 3 -> 3 fresh. Mark 1 more and finish it -> done 4 -> 2 left.
  - Unmark one open priority, finish the other two -> done 2, still 0 left, no reset (one slot thrown away).
  - Undo a completion after the reset -> can go negative -> shows 0, marking blocked until it is done again.
- "Priority" on a task = `item.isHighPriority` exactly as today (gold glow, strip star, x2 points via `Economy.taskPoints`; `koGhost` priority tasks keep their slot until done -- they are completable). A sub-task whose parent is priority is treated as priority for look + points but takes no slot of its own; its stored flag is irrelevant while the parent is priority (set it to match on parent mark so existing code paths keep working).
- `CONFIG.PRIORITY_SLOTS_PER_DAY = 3` (balance number: changes only via the balance-tuning protocol + DECISIONS). The reset size is the same number.

## Data

- **State root `priorityMarks`: `{ 'YYYY-MM-DD': n }`** (local day string, same formatter as `State.today.date`). New key on the save (schema 16 -> 17: seed `{}`; no migration pass over items). Carried by Backup & Transfer like `pushbackUses` / `anytimeCreditUses`. **Pruned at `performDayRollover`** to days >= yesterday (future days keep their counts; nothing reads older ones). **Reset Game clears it** (like the inventory); a new run after game over clears it too (a plan for a day that killed you is moot). NOT in `keptAcrossRuns`.
- **Routine task defs:** the `isHighPriority` field is dropped from `routine.tasks[]` on load (the same schema 17 migration sets it `false` / deletes it) and from `createNewTaskInRoutine` / `editTaskInRoutine`. Existing instances already on the board today keep whatever flag they have (their mark was never counted; they just use up today's slots for free, once).
- **`DailyRecord` v9: `pri = { m, d, s }`** -- marks spent today, priority completions today, sets completed (resets earned). `m` bumps at mark time, `d` at complete (+1) / uncomplete (-1), `s` = `floor(d / 3)` recomputed at close. DATA_SCHEMA.md note. (Guardrail: counter added in the same session as the mechanic.)

## Display (the "at a glance" part)

1. **Slot pips above the agenda list** for the viewed day (`#prioritySlots`, inside the list header row, left of "Started (N)" / "By due time" headings): three gold pips -- hollow = free, filled = used (open), check = done -- plus the text "Priorities 1 of 3 left" (phone: pips only, the text is the `aria-label` + a tap opens a one-line explainer via `Dialog.notice`). After a reset the pips refill. On a later day on the pager the pips show THAT day's slots (so planning tomorrow is visible). Yesterday: pips show what happened (filled / done), no text.
2. **Week strip:** `★N` becomes `★N/3` only for days with marks (`DayPager.weekStripSummary` `highPriorityCount` already exists; add `priorityMarks` per entry). Unchanged when 0.
3. **Add Task / Edit Task / sub-task form:** the checkbox label reads **"Priority -- 2 of 3 left today"** (for the task's due day); at 0 the box is disabled with "No priority slots left today. Finish your 3 to unlock 3 more." Changing the due date in the form re-reads the count for the new day. The label gets `HowItWorks.buttonHtml('priorities')`.
4. **Unchecking an open priority:** `Dialog.confirm` -- "Remove priority? The slot stays used today." Confirm / Keep it.
5. **Set complete notice:** when `done[today]` crosses a multiple of 3, one `FrozenNotice`-style notice: "All 3 priorities done -- 3 more unlocked." (Queues behind an open notice like the achievement toast.)
6. **Moves that strip priority** (rule 8): the existing pushback / evening-check / edit paths show their normal result; the edit form and pushback popup add one line when the item is priority and the move crosses midnight: "Priority doesn't carry over -- mark it again on the new day."
7. **How Deadline works:** new topic `priorities` ("Three priorities a day": the slot rule, spent on mark, three more after three done, sub-task rule, moves strip it). `PointsInfo.rulesLines` line becomes "Priority tasks pay double (3 priority slots a day)." Manage Routine's "Bonus: N tasks x2" part goes away (habits' x2 / x3 stays).

Wording: player-facing text says **Priority** / **priority slot(s)**, never "High Priority" (rename the checkbox everywhere: Add / Edit Task, sub-task form, zombie card "Priority: Yes / No"). Code keeps `isHighPriority`, `.high-priority`, `.priority-row`.

## Build order (Sonnet; one commit each)

**Build A -- pure core + persistence + DailyRecord (no UI change).**
- `js/prioritySlots.js` (pure): `dayKey(date)`, `available({ marks, done, perDay })`, `countDone(items, completedItems, dayKey)` (parent-once / sub-only-when-parent-not rule), `canMark(...)`, `markOwner(item, parentItem)` (which item's flag a mark lands on), `stripsOnMove(fromDay, toDay)`, `setsCompleted(done, perDay)`.
- `CONFIG.PRIORITY_SLOTS_PER_DAY = 3` (comment + ECONOMY.md "Priority slots").
- State: `priorityMarks` get / set / `spendPriorityMark(dayKey)`; persist / restore / export / import; schema 17 (seed `{}`, drop the flag from routine task defs); prune in `performDayRollover`; cleared by Reset Game and `initGame` (new run).
- `Items`: `setPriority(itemId, on, deps)` -- the ONLY way the flag changes from now on (forms call it): checks `canMark`, spends the mark, syncs the sub-tasks' flags when a parent is marked, returns `{ ok, reason }`; completion / uncompletion bump `recordDaily('pri.d')`; `DailyRecord` v9 `pri`.
- Moves: `Items` due-date change path, `Pushback.apply` wiring in script.js `handlePushback`, `moveAnytimeTaskToTomorrow` / `moveAnytimeTaskToToday`: call `Items.syncPriorityOnMove(item, oldDue, newDue)` (strips when the local day changes).
- Routine defs: `createNewTaskInRoutine` / `editTaskInRoutine` ignore `isHighPriority`; the spawn copy in routines.js:145 spawns `false`.
- Tests: `test/prioritySlots.test.js` (available / reset / negative / parent-sub / move strip), persistence 16 -> 17, DailyRecord v9, items setPriority (blocked at 0, spent on unmark), routine spawn never priority.

**Build B -- UI: forms, pips, week strip, notices, How it works.**
- Forms (Add Task, Edit Task, sub-task form, routine task forms minus the box): label with the live count, disabled at 0, re-read on due-date change; save paths go through `Items.setPriority`; unmark confirm.
- `#prioritySlots` pips + text (`js/ui/prioritySlotsView.js`, `css/prioritySlots.css`); rendered from script.js with the list (`sortAndRenderActiveList` caller) and on day-pager offset change; `refreshPrioritySlots` after complete / uncomplete / mark.
- Week strip `★N/3`; set-complete notice; the move line in the pushback popup + edit form; zombie card "Priority: Yes / No"; `HowItWorks` topic `priorities` (+ `test/howItWorks.test.js` pin); `PointsInfo` line; Manage Routine bonus line without tasks.
- sw bump; wording-rule scan (no "High Priority" left in player-facing text except what Jeremy keeps).
- Phone check: pips at 390 / 360 / 844x390 landscape (the landscape pager's Tomorrow page shows tomorrow's pips), the form label at 0 left, unmark confirm, the reset notice.

## Open questions (none block Build A)

- Pip placement in phone LANDSCAPE (the one-day pager): list header row vs. the HUD. Default: list header row, same as portrait.
- Whether Yesterday's pips are worth drawing at all. Default: yes, read-only.

# Goals plan -- the Goals pane, two kinds of goal, slots that unlock and never regress, and the first Baseline theme seam

DESIGNED 2026-11-04 (Claude app session; Fable 5.1, high effort; Jeremy). Decisions in `docs/DECISIONS.md` 2026-11-04 (goals). NOT BUILT. This is the V7 "D1 -- Goals + Targets" design session the roadmap reserved for Fable; it SUPERSEDES `docs/WORLD_FEEDBACK_PLAN.md` Region 3 (distant-city strongholds) and Region 4 (horizon threat) -- goals live in their own pane, the skyline gets nothing for now (Jeremy).

Read this before touching: `State.initGame` / `startNextRun` (goals carry across runs), `performDayRollover` (period close), `CONFIG.LEVEL_PERKS` / `ROUTINE_SLOTS_PER_LEVEL` (the goal-slot ladder sits beside them), `Items.completeItem` / `uncompleteItem` (linked-item progress), `DailyRecord` (v10 `pg`), `test/wording-rule.test.js` (the theme-word guard), `index.html` HUD buttons.

## Why (Jeremy's notes, 2026-11-04)

"Goal slots unlock as player levels up. Goals could potentially be for daily, weekly, monthly, yearly, and lifetime goals. There should be goal related rewards, especially the harder ones. [ClickUp Goals + Targets] is interesting. Goals are a very important part of the game for motivation reasons. I need to figure out the best way to thematically include them and keep our at-a-glance rule in place." His lab idea: a separate screen where each goal is a zombie in a vat that becomes a healthy human as progress is made; reaching the goal cures them. His worry: the game must stay re-themeable (swap the assets for a fantasy theme, say), and a vat-to-human morph has no obvious fantasy equivalent.

## Decisions (Jeremy, 2026-11-04; alternatives in DECISIONS)

1. **Goals get their own PANE, not the graveyard and not the horizon.** Graveyard = all time and finished things (headstones cannot show 40%; the 140px hill holds 6 stones; "your goal is a grave" is the wrong tone). Horizon strongholds (the old Region 3) would need N buildings that are either identical (breaks the AT-A-GLANCE DISTINCTNESS RULE) or N distinct designs per theme, and cannot hold a form or a variable slot count. **Nothing on the skyline for now.** The at-a-glance job on the phone is done by the HUD Goals button's status dots.
2. **The pane is built from the game's existing grammar: one object, N stage sprites, the state picks the sprite** (the church's five damage states, the village's five tiers). The vat is not the problem, the MORPH is: make the subject a six-stage ladder and any theme can supply its own ladder (petrified statue -> living knight; cryo-pod sleeper -> crew member). The goals code never draws a transformation; it draws `subject_T<stage>`.
3. **Two kinds of goal, not five cadences.** (a) **Milestone** = one-time, optional deadline; the subject only climbs (yearly = milestone due Dec 31; lifetime = milestone with no deadline). (b) **Recurring** = daily / weekly / monthly period; the subject climbs one stage per period met and **drops one stage per period missed** (the church-damage ladder: up and down). Jeremy: the relapse is motivating.
4. **Daily and weekly recurring goals are AGGREGATES, never "do X".** "Do X every day" is a habit with worse tooling. Recurring targets earn their place as things a habit cannot say: "any 3 tasks done", "90 min Time Logged", "no base damage today", "all 3 priorities done" -- computed from the daily record, not self-reported.
5. **The full transformation belongs to milestone goals.** A recurring goal's period win is a stage climb and a streak notch, not a cured survivor walking out; curing one a day would cheapen it.
6. **Goals PERSIST ACROSS RUNS and slots never regress.** Player level and perks are per-run (`docs/LEVEL_PERKS_PLAN.md`); a yearly goal at 60% cannot vanish because the church fell on a Tuesday. Slots unlock by in-run level and are kept forever as a high-water mark (`goals.bestSlots`), the `bestRoutineSlots` precedent from `docs/RUN_CARRYOVER_PLAN.md` decision 3. Game over resets the in-run things, never goals, streaks or the roster. (Consistent with the 2026-11-04 priority-slots decision that rejected per-run level unlocks for something the player relies on.)
7. **Slot ladder (first picks, Jeremy agreed; `CONFIG.GOAL_SLOTS_PER_LEVEL`, balance protocol for changes):** Lv1 = 2, Lv2 = 3, Lv4 = 4, Lv6 = 5, Lv8 = 6 (cap). Even levels, so a goal slot never lands on the same level-up as a routine slot (odd levels): every level-up gives one clear thing. **One shared pool**, any mix of kinds. A fresh save pre-fills the two starting slots with SUGGESTED goals (one recurring aggregate, one milestone) the player keeps, changes or removes; an empty shelf teaches nothing.
8. **Baseline / Deadline.** Jeremy: the engine of this task/habit game is **Baseline**; **Deadline** is the first game/theme built on it; polishing Baseline into an engine comes after Deadline has tested it. Goals is the proving ground: save data, record keys, CONFIG keys, module names and CSS classes speak Baseline (goal, slot, stage, subject, container); Deadline words (lab, vat, patient, cure, survivor, zombie, church) live ONLY in `js/theme.js` strings and asset file names. Existing code is NOT renamed now (own Fable session after pre-alpha). Details in "Baseline seam" below.
9. **Pinned by Claude, Jeremy did not object:** relapse = ONE stage down per missed period, never to zero; "on pace" = progress >= elapsed fraction of the deadline / period, grey when there is no deadline; milestone stage = `floor(progress * 5)` with stage 5 reserved for complete; rewards scale with kind and period, numbers via CONFIG and the balance protocol.

## Vocabulary (player-facing; wording rule applies)

- **Goal** -- the thing in a slot. **Goal slot** -- "2 of 4 slots used", "Unlocks at Lv 4".
- **Repeats** (recurring) -- "Every day / Every week / Every month". **One-time** (milestone) -- "Due Dec 31" or "No deadline".
- **Target** -- a goal has one or more: **A number** (Number), **Yes or no** (Bool), **Tasks and habits** (Linked), **Your days** (Aggregate).
- **Streak** -- consecutive periods met. **Slipped a stage** -- the relapse line.
- Theme words come from `Theme.strings.goals` (Deadline: pane title "The Lab", subject "Patient", finished "Survivor" / "Survivors", verb "Cure", completion line "Cured."). The new feature is "Goals"; the existing per-habit target stays "Habit Goal" (`habitDef.goal`, `js/goalCheck.js`) -- unrelated code, rename to `habitGoalCheck.js` only in the Baseline extraction.

## Data (schema 18; `docs/DATA_SCHEMA.md` gets the section)

Root save `goals` (carried across runs; `initGame` / `startNextRun` never touch it; dev Reset wipes it; export/import carries it whole):

```js
goals: {
  bestSlots: 2,                 // high-water mark, like bestRoutineSlots; effective slots = max(GOAL_SLOTS_PER_LEVEL[level], bestSlots)
  active: [Goal],               // one per occupied slot, in slot order (index = slot)
  done: [GoalRecord],           // the roster: completed milestones + retired recurring goals, newest first
  nextId: 1
}
Goal {
  id, name, createdAt,
  kind: 'milestone' | 'recurring',
  period: null | 'day' | 'week' | 'month',   // recurring only
  deadline: null | 'YYYY-MM-DD',             // milestone only (local date)
  targets: [Target],
  stage: 0..5,                 // the sprite index; milestone: derived each tick; recurring: stored ladder (up/down at period close)
  streak: 0,                   // recurring: consecutive periods met
  periodKey: 'YYYY-MM-DD' | 'YYYY-Www' | 'YYYY-MM',  // recurring: the period being worked on (its close settles it)
  history: [{ key, met, progress }],         // recurring: last N periods (CONFIG.GOAL_HISTORY_KEEP, 26)
  suggested: true | undefined,               // the fresh-save examples until the player keeps or edits them
  completedAt: null
}
Target {
  id, type: 'number' | 'bool' | 'linked' | 'aggregate', label,
  // number:    { start, end, current, unit }            progress = clamp((current - start) / (end - start)); end < start counts down
  // bool:      { done }                                 progress = done ? 1 : 0
  // linked:    { itemIds: [], habitDefIds: [], routineIds: [], count }
  //            milestone: progress = completed linked one-offs / linked one-offs (habits/routines count their occurrences toward `count`)
  //            recurring: progress = completions inside the period / `count`
  // aggregate: { metric, op: 'sum' | 'days', threshold, compare: 'gte' | 'lte' }
  //            metric = a key of CONFIG.GOAL_METRICS (a DailyRecord path + label), summed over the period (open day included)
  //            op 'days' counts the days in the period where the metric meets `threshold` (e.g. damage-free days >= 5)
}
GoalRecord { id, name, kind, period, targets: [labels], startedAt, finishedAt, periodsMet, bestStreak, runNights }  // the roster card
```

- `goal.progress` = mean of the targets' progress (each clamped 0..1), recomputed on demand (never stored). A goal with no targets has progress 0 and cannot be saved.
- **Linked items:** a one-off task / sub-task may be linked to ONE goal (`item.goalId`, additive on the item; shown as a badge on the zombie card and the row). Habit defs and routines link by id inside the target only (no field on them). Deleting a linked task or archiving a habit drops it from the target. Carried-over tasks keep `goalId`.
- **DailyRecord v10 `pg`** = `{ climb, drop, met, done }` -- stages climbed today, stages dropped at a period close today, recurring periods met today, milestones completed today. Bumped by the `goal` event (`State.bumpToday`). Month roll-up sums it. (`goals` is TAKEN by the Habit Goals tally since v5; `pg` is the player-goals key.)
- Migration v17 -> v18: seeds `goals` with `bestSlots` = `GOAL_SLOTS_PER_LEVEL[1]` and the two suggested goals; nothing else changes.

## Mechanics (pure `js/goals.js`; numbers in CONFIG)

- **Slots:** `slotsAtLevel(level, best)`; `State.setGoalBestSlots` raises the mark on every level-up (script.js `checkPlayerLevelUp`) and on restore; the ladder is `CONFIG.GOAL_SLOTS_PER_LEVEL` = `{ 1: 2, 2: 3, 3: 3, 4: 4, 5: 4, 6: 5, 7: 5, 8: 6, 9: 6 }` (every level has an entry, never decreasing -- same guard test as the routine ladder). The level-up toast names "Goal slot" as the perk (`LEVEL_PERKS` gets `{ type: 'goalSlot' }` rows on 2 / 4 / 6 / 8, display only, like `'slot'`).
- **Periods** (recurring): day = local day (the existing rollover); week = Monday-Sunday (`CONFIG.GOAL_WEEK_STARTS_ON` = 1; a Settings row later if asked); month = calendar month. `periodKeyFor(period, date)`.
- **Period close** runs inside `performDayRollover`, after `State.closeDailyRecord` (so the closed day's record is in the store): for every recurring goal whose `periodKey` just ended -- met (progress >= 1) -> `stage = min(5, stage + 1)`, `streak += 1`, `pg.met`, reward; not met -> `stage = max(0, stage - 1)`, `streak = 0`, `pg.drop`, the cell shows "Slipped a stage" for the next day (no popup: notice fatigue; the next-morning card is NOT extended). Then `periodKey` moves on and the per-period progress starts from the new period's data. Offline catch-up closes every missed period in order (same loop the daily record uses). A goal created mid-period starts with that period.
- **Milestone stage** = `floor(progress * 5)` capped at 4 while open; follows progress both ways (an unchecked linked task lowers it -- honest, like a village tier that falls when a completion is undone). **Complete** when every target reaches 1 (ClickUp's rule): `completedAt` set, stage 5, completion notice with the exit one-shot, `pg.done`, reward, the goal moves to `done` and the slot empties. Not auto-completed by the deadline passing: a late milestone just shows "Overdue" (amber -> red dot) and keeps climbing; no cost beyond the look (reflection over punishment).
- **On pace** (`paceFor(goal, now)` -> 'ahead' | 'behind' | 'none' | 'done'): deadline or period -> `progress >= elapsedFraction` is ahead; no deadline -> none; complete -> done. `CONFIG.GOAL_PACE_SLACK` (0.1) keeps a goal "ahead" when within a tenth of the line, so the dot does not flicker.
- **Retire** a recurring goal (player's choice) -> a roster record; **Delete** a milestone -> gone (confirm). Editing targets on a recurring goal applies from the current period.
- **Rewards (`CONFIG.GOAL_REWARDS`, THEORY -- first numbers via the balance protocol before Build C, logged in DECISIONS):** period met -> points + XP, with a streak multiplier (`streakBonus` per consecutive period, capped); a monthly period met -> one held item from the village-drops ladder (`Shop.grant`); milestone complete -> a points + XP bundle, bigger with a deadline that was met, plus the roster card; a milestone with no deadline (lifetime) is the biggest bundle. Nothing softens damage, freezes or earn rate (the LEVEL_PERKS principles hold). Missing a period or a deadline costs nothing in points.
- **Suggested goals** (`CONFIG.GOAL_STARTERS`, Theme-neutral copy): slot 1 recurring weekly aggregate "A productive week" = `done.task` op 'days' threshold 3, count 5 ("Finish 3 tasks on 5 days"); slot 2 milestone "One big thing" with a single number target 0 -> 10 "steps", no deadline, and the card's first line "Rename this to the one thing you want done this year." First open of a suggested goal offers Keep / Change / Remove; `suggested` clears on Keep or any edit.

## Screens (`js/ui/goalsPane.js`, `js/ui/goalForm.js`, `js/ui/goalCard.js`, `css/goalsPane.css`)

- **HUD button** `#goalsButton` after `#heroesButton` (reuses `.village-button`; add to `HudButtons.WINDOWS`): icon = a FLAGPOLE outline (Jeremy, 2026-11-05; the target ring / reticle stays reserved for something else), 22px, raised look like the other HUD buttons; theme-neutral, so it belongs to the engine, not `js/theme.js`, text "N/M" = goals on pace / active, then one status dot per active goal (green ahead, amber behind, red overdue milestone, grey none; capped at 6). Opens the pane. Must `stopPropagation`.
- **The pane:** header = Theme pane title + "Goals · 3 of 4 slots" + the finished count ("Survivors: 7" in Deadline) that opens the roster; body = a grid of SLOT CELLS, 2 columns in phone landscape / portrait, 3 on desktop. **Desktop (>= 1100px):** docked as a column to the right of `#gameCanvas` (Jeremy: the room exists now that the village is condensed), the button collapses / expands it, state remembered in Settings. **Phone landscape:** a centred popup like `#heroTray` (closes on a tap outside / Esc / corner x). **Portrait:** a Modal window (the plan's Global rule 4).
- **Slot cell** (`.goal-slot`): container sprite (Theme) + subject sprite `subject_T<stage>` + name (one line, ellipsis) + a thin progress fill + the pace dot + one line: "Every week · 3 of 5" / "Due Dec 31 · 60%" / "No deadline · 60%" + streak pips (recurring, last 5 periods). **Locked cell:** `container_locked` + "Unlocks at Lv N". **Empty cell:** dashed container + "+ New goal". A suggested goal wears a small "Example" chip. Tap -> goal card.
- **Goal card** (`Modal`): name, kind line, deadline / period, the pace line in words ("Ahead", "Behind -- 2 to go by Sunday"), targets with their controls (number: - / + and a type-in; bool: a check; linked: the linked rows with done marks and "+ Link a task or habit"; aggregate: "4 of 5 days so far"), streak + history strip (recurring), Edit, Retire / Delete (confirm). Linked zombie cards and rows get a `.goal-badge` with the goal's name; tapping it opens the goal card.
- **Goal form** (`Forms` pattern; Add and Edit): name; kind picker (Repeats: Every day / Every week / Every month | One-time: deadline date or "No deadline"); targets builder: "+ Add a target" -> A number (start, end, unit) / Yes or no / Tasks and habits (a picker over open one-off tasks, habit defs, routines, with a count for the recurring case) / Your days (metric picker from `GOAL_METRICS` labels, op, threshold); at least one target; inline `Forms.showFormError`. No native dialogs.
- **Notices:** `FrozenNotice.showGoalCompleteNotice` (completion one-shot art + the Theme completion line + the reward line); period met rides the existing level-up / reward toast style; "Slipped a stage" is a cell chip only. Level-up toast names the goal slot.
- **How Deadline works** topic `goals` (10th; `topics()` + `TOPIC_IDS`): kinds, slots, pace dots, relapse, rewards (numbers flow from CONFIG), "goals and their streaks are yours, not the church's -- a lost run never touches them". `PointsInfo` line for the goal rewards. **Stats:** a Goals row (periods met, milestones done, best streak) and the roster in the Stats window too.
- **At-a-glance rule:** nothing new on the canvas. The button dots + the pane are the glance.

## Baseline seam (built WITH Goals; the rest of the engine migrates in its own session after pre-alpha)

- `js/theme.js` -- `Theme.strings.goals` (paneTitle, subject, subjectPlural, finished, finishedPlural, verb, completeLine, lockedLine) and `Theme.assets.goals` (root, container, containerLocked, containerEmpty, subjectStages[0..5], exitStrip + its frame count / fps). Deadline values live here and nowhere else. The goals modules read EVERY player-facing theme word and sprite path through `Theme`.
- **Vocabulary rule (CLAUDE.md):** new identifiers -- module names, CONFIG keys, DailyRecord keys, save fields, CSS classes, test names -- use engine words (goal, slot, stage, subject, container, period, target, pace). Theme words appear only in `js/theme.js` and asset file names. Existing identifiers (zombie, church, village, hero, graveyard) stay as they are until the Baseline extraction.
- **Guard:** `test/wording-rule.test.js` gets a second scan, scoped to `js/goals*.js` and `js/ui/goal*.js`: fails on `/\b(zombie|undead|cure[ds]?|survivors?|vat|lab|church|patient)\b/i` outside `js/theme.js`. CSS classes in `css/goalsPane.css` are checked for the same words by a small test.
- **Assets:** `Assets/Goals/` (one folder per theme later; the path comes from `Theme.assets.goals.root`, so the move is a one-line change plus the sw.js list).
- Later (the extraction session, Fable): alias map for the old identifiers, `Assets/themes/<name>/` + `theme.json` loader, per-theme sw caching, build-time pack vs runtime switch, `goalCheck.js` -> `habitGoalCheck.js`.

## Art contract (ART_STYLE gets this section; draw after the Nov 7 PixelLab reset; placeholders until then)

- **One footprint, six stages, same anchor.** Container canvas 96x128 at 1x (drawn 1:1 in the grid; 2x on desktop if the column allows), subject window 48x80 inside it, feet on one fixed row. `subject_T0..T5.png` + `subject_exit_anim.png` (horizontal strip, any frame count; PixelLab 3-wide grids converted the church way). `container.png`, `container_locked.png`, `container_empty.png` (the empty one is the container with no subject; the dashed "+ New goal" is CSS).
- **Deadline ladder (PROPOSED for the art session):** T0 full zombie slumped in the vat -> T1 skin tone returning, still hunched -> T2 standing straighter, hands unclenched -> T3 eyes clear, calm face -> T4 human in a hospital gown, hand on the glass -> T5 cured, upright, gown, small smile; exit = the vat opens and the survivor steps out. Night palette and value rules from the village; the vat's liquid glow is the one bright element so the subject reads at 1x with zombies nowhere near it (the pane is its own surface, so the "never compete with the zombies" rule does not bind here, but the shared palette does).
- **Other themes prove the contract:** fantasy = pedestal + petrified statue -> living knight; sci-fi = cryo pod + frozen sleeper -> crew member; cozy = planter + seed -> flowering tree. Each is six sprites in one box, nothing else.
- **Placeholders (Build B):** a CSS-drawn container + six plain shapes keyed by stage (no borrowed zombie or hero art: that would put theme words in the goals code), so Build B is testable before any art lands.

## Build order (one session each; tests first; commit each)

- **Build A -- core + data (BUILT 2026-11-05, Sonnet, medium; see "Build A as built" below):** `js/theme.js` seam; pure `js/goals.js` (`slotsAtLevel`, `periodKeyFor`, `progress`, `stageFor`, `paceFor`, `closePeriods`, `completeIfDone`, `startersFor`); `js/goalMetrics.js` (aggregate evaluation over `save.today` + `deadline.days`; `CONFIG.GOAL_METRICS` allowlist with labels); `State.goals` (get / set / sanitize / `setGoalBestSlots`), schema 18 + migration, `startNextRun` / `initGame` leave `goals` alone (`RunCarryover` table row), export/import; `item.goalId`; `Items.completeItem / uncompleteItem` call the optional `onGoalProgress` dep; `performDayRollover` period close; `checkPlayerLevelUp` raises the mark + toast perk; DailyRecord v10 `pg`; the wording-rule second scan; tests (`test/goals.test.js`, `test/goalMetrics.test.js`, `test/goalsCarryover.test.js`, version pins 17 -> 18 / 9 -> 10). Nothing visible.
- **Build B -- pane + forms + card + button (Sonnet, medium-high):** `js/ui/goalsPane.js` (+ docked desktop column, popup, Modal), `js/ui/goalForm.js`, `js/ui/goalCard.js`, `css/goalsPane.css`, `#goalsButton` + `HudButtons.WINDOWS`, slot cells with CSS placeholders, linked badges on cards / rows, completion notice, "Slipped a stage" chip, How Deadline works topic + PointsInfo line, Stats row + roster, sw bump, index.html (CRLF) + sw.js lists. Headless check at 390x844 / 360x780 / 844x390 / 1280x800, then Jeremy's phone check.
- **Build C -- rewards + starters + polish (Sonnet, low-medium, AFTER a balance pass on `GOAL_REWARDS` logged in DECISIONS):** reward payout at period close / completion (`Shop.grant` for the monthly item), streak multiplier, the two suggested goals on a fresh save + Keep / Change / Remove, level-up perk rows, docs (DATA_SCHEMA, ECONOMY "Goal rewards", MECHANICS "Goals", UI_UX "Goals pane").
- **Art session (Jeremy + PixelLab, after Nov 7):** the Deadline ladder per the contract; swap the placeholders; ART_STYLE "Goals art" as built.

## Build A as built (2026-11-05; where the code differs from, or settles, the plan above)
- **Files:** `js/theme.js`, `js/goals.js` (pure), `js/goalMetrics.js` (pure), `State` (`getGoals / setGoals / goalSlotCount / syncGoalSlots / ensureGoalsSeeded / settleGoals / applyGoalCompletion / closeGoalPeriods`), `Items` (`goalProgress` -> optional `deps.onGoalProgress`), `script.js` (hook, `checkPlayerLevelUp` -> `State.syncGoalSlots()`, dev Reset -> `State.setGoals(null)`). Tests: `test/goals.test.js`, `test/goalMetrics.test.js`, `test/goalsState.test.js` (replaces the planned `goalsCarryover.test.js`), the wording-rule second scan.
- **Week key** = the `YYYY-MM-DD` of the week's first day (`CONFIG.GOAL_WEEK_STARTS_ON`, 1 = Monday); month = `YYYY-MM`; day = `YYYY-MM-DD`.
- **Aggregate targets** carry `op: 'sum' | 'days'`, `threshold`, `compare: 'gte' | 'lte'` and, for `days`, `count` (how many days must pass: "3 tasks on 5 days"). A `lte` day that is still open never counts as passed (damage can still come).
- **Linked targets are event-driven counters, not a live read of the items**, so a goal survives a run reset and an id collision: a linked one-off keeps `itemTotal` / `itemDone` (moved by `item.goalId` + `item.goalTargetId`), a linked habit or routine keeps `occ` (completions counted) against `count`. Un-checking subtracts, so a milestone stage can fall honestly. Creating goal-linked one-off tasks is Build B (the form); the hook is live now.
- **Closing a period:** the first closed period reads the counters the player built up; any later one in an offline catch-up starts from reset counters, so it can only be met by its daily records. Runs after `closeDailyRecord` inside `performDayRollover`, then the open milestones are settled. Both are wrapped so they can never break a rollover.
- **Starters** are added by `State.ensureGoalsSeeded` (in `initGame` and after a restore), not by the migration: a brand-new save and a migrated one get them the same way, once, into free slots only; `seeded` stays true after the player removes them.
- **`pg`** (DailyRecord v10) is bumped by the `pgoal` event: climb = stages gained (a completion counts the stages up to 5), drop = stages lost, met = periods met, done = milestones completed.
- **Not in Build A (deliberately invisible):** the `checkPlayerLevelUp` perk toast, the game-over "You keep" goals line (`RunCarryover.summary` now returns `goals`, the count), `CONFIG.GOAL_REWARDS` (balance pass before Build C), any notice for a completed goal or a slipped stage (`closeGoalPeriods` / `settleGoals` return the outcomes for Build B to show).

## Build B1 as built (2026-11-05; "see and use" goals; Build B was split in two -- B2 = form, linked picker / badges, topic, PointsInfo, Stats row)
- **Files:** `js/ui/goalsPane.js` (button model, slot cells, placeholder SVG art, roster; pure helpers + DOM), `js/ui/goalCard.js` (the card, a `Modal`), `css/goalsPane.css`, `FrozenNotice.showGoalCompleteNotice`, `HudButtons.WINDOWS.goalsButton`, `State.getGoalViews / getGoalSlotInfo / updateGoalTarget / retireGoal / deleteGoal / takeGoalEvents`, pure `Goals.targetDetail / viewFor / updateTarget / nextUnlockLevel`, script.js `ensureGoalsPane / renderGoals / goalCardDeps` (per tick from `updateGame`, and at once from `onGoalProgress`), index.html markup, sw v259.
- **HUD:** the flagpole `#goalsButton` is the LAST HUD button (after Points). Shows "on pace / active" + up to six pace dots. **One row on phones (follow-up, sw v260, Jeremy: "try shrinking and reordering a little"):** a `max-width: 430px` block at the end of `css/responsive.css` tightens the six buttons (6px side padding, 4px gaps, 20px icons, XP bar 22px, 5px goal dots) and drops two text bits on phones: the health state word ("Full" / "Attacked" / "Healing"; the ring colour, the number and the aria-label still carry it, and the Base Health panel spells it out) and the goals "1/2" count (the dots + aria-label carry it). Measured: all six on one row at 390, 360, 375, 412 and down to 340 px (right edge 341 at the 390 / 360 rows). With six goals (Lv 8) the dots widen the button and it may wrap below ~375 px; `glanceStrip.css` still wraps as the safety net. Wider screens and landscape keep the full buttons (one row already).
- **Pane:** a centred popup in EVERY layout (the docked desktop column from the plan is deferred: it would change the canvas width and the zombie layout math). 2 columns (3 when 1100px+ wide), goal cells, open slots, ONE locked cell showing the next unlock; header "The Lab" (theme) + "Goals - N of M slots" + the finished list ("Survivors: N").
- **Card:** target controls (number: - / + / type-in; yes/no: check; tasks-and-habits and your-days targets are read-only with a note), pace in words, streak strip, Retire (RECURRING goals only; it moves to the finished list with its streak) and Delete, each behind an inline confirm. Reaching 100% closes the card and the completion notice follows.
- **Chips** ("Example", "Slipped a stage" / "Missed last period", "Period met") are derived from `history` + `suggested`, no new saved state. Notices come from a session-only event queue (`State.takeGoalEvents`) that script.js drains each tick; only 'complete' events show a notice in B1 (period events are available for later).
- **Perf:** `State.getGoalViews` caches the closed daily records per open day (`closedDaysCache`, cleared by `setToday`), so the per-tick view build never re-reads the days store.
- **Known gaps until B2:** the open "+ New goal" slot is inert (no form yet), so deleting a starter cannot be undone except by dev Reset (which re-seeds); no edit; no linked picker. Art is CSS/SVG placeholders in `GoalsPane.artHtml` (the swap point for `Theme.goalAsset`).
- **Headless check (Chromium, 2026-11-05; HUD fit re-measured after the sw v260 follow-up):** 390x844, 360x780, 844x390, 1280x800: no page overflow (`scrollWidth == clientWidth` on the HUD panel, pane body and card), pane + card fit the viewport (card 338px tall in landscape), no console errors. Phone check by Jeremy pending.

## Open (decide during the builds or with play data)

- Week start (Monday) and whether it needs a Settings row.
- Whether a linked habit on a MILESTONE goal counts occurrences (as planned) or should be refused (habits are recurring by nature).
- The exact `GOAL_METRICS` allowlist (first list: tasks done, Build Habits done, Break Habits resisted, Time Logged minutes, base-damage-free day, all priorities done, perfect routine attendance day, points earned).
- Desktop docked column vs popup only, once the condensed village layout is on screen.
- Whether a recurring goal at stage 5 with a long streak should earn anything extra (a "stable" state) -- parked, play data first.
- Rewards numbers (THEORY until the Build C balance pass).

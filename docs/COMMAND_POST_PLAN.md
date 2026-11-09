# Command Post (the Armory re-aimed at priorities) -- plan

_Designed 2026-11-09 (Claude app session, Opus 5.5 framing -> Fable 5.1 design; Jeremy). Thresholds, Memorial mark (kept) and wording APPROVED 2026-11-09. BUILT 2026-11-09 (Sonnet 5.5; sw v301). DECISIONS 2026-11-09 (Command Post). ROADMAP M5 "Command Post"._

## Goal

Reinforce the priority-slot habit (docs/PRIORITY_SLOTS_PLAN.md: pick three, finish three) with a standing reward in the world, without adding a ninth building or an eighth headstone. The Armory (kind `slain`, "zombies killed") is re-aimed: it becomes the **Command Post** and counts **priority tasks finished, up to three a day**. Same sprite (tent + watchtower), same spot on the hill, new name, new counter, new card text, new thresholds.

Jeremy: "we want to encourage and reinforce the user for using priorities ... maybe we should swap it out with something we are tracking that is the weakest in terms of importance for the users success."

## Why the Armory, and why not a stone

- Ranked by what each building tells the player about succeeding, the Armory is the weakest: a raw count of everything finished. It is already covered three times (Task Slayer + Habit Hero on the hill count the same things for all time; the Hospital counts the habit half), and it rewards volume over importance -- its own card told players to split work into sub-tasks for more kills, the opposite of "pick the three that matter".
- Every other building rewards one specific good behaviour nothing else covers (on time, base kept healthy, Build Habits, clean days, routines, nights, heavy days handled).
- Priorities are the quality version of the same idea: not "how many did you kill" but "did you take down the ones that mattered". The camp-with-a-watchtower art already reads as the place you plan the day's targets from.
- The headstones stay as they are. Task Slayer is the plain lifetime number a new player understands first, and a priorities stone next to a priorities building would say the same thing twice. (The hill holds 7 markers and is full.)

## What Jeremy decided (2026-11-09)

1. **Re-aim the Armory, add nothing.** No ninth building, no eighth stone.
2. **Name: Command Post.** (Jeremy: "I like command post better".)
3. **Counter: priority tasks finished, counting at most three per day** (the slot count, `CONFIG.PRIORITY_SLOTS_PER_DAY`). Chosen over "full sets of three" (finishing 2 of 3 on a hard day would count for nothing) and over "days you finished every priority you marked" (one trivial priority would count the day). Capping at three closes the farming hole: finishing three opens three more slots, so an uncapped count would reward marking easy tasks all day.
4. **Headstones unchanged.** Task Slayer keeps counting everything finished, for all time.

## Rules in one place

- **Counter (this run):** `sum over this run's CLOSED daily records of min(rec.pri.d, SLOTS) + min(today.pri.d, SLOTS)`, SLOTS = `CONFIG.PRIORITY_SLOTS_PER_DAY` (3). Same shape as the Clock tower: closed days plus the open day.
  - `rec.pri.d` already exists (DailyRecord v9): priority tasks finished THAT DAY that spent a slot; an undo takes one back. So a sub-task covered by a priority parent counts with the parent (one slot, one count); a sub-task marked alone counts on its own; unmarking never changes it; undoing a completion lowers it, and the tier can drop with it, exactly like every other counter.
  - Counts by **completion day**, not due day: a priority finished a day late was still the big rock you finished. Being late is the Clock tower's business.
  - Only days with `rec.run === runNumber` count (every building). Days recorded before v9 have no `pri` and count 0.
- **Tier ladder:** `[T2, T3, T4, T5]` thresholds below. Tier only ever goes up within a run except through undo; a new run starts at T1 (unchanged village rule).
- **Nothing new is saved.** No schema bump, no new save field, no DailyRecord version change. The counter is derived from records that already exist.

## Thresholds (THEORY pass; balance-tuning protocol; DECISIONS)

`VILLAGE_TIER_THRESHOLDS.slain: [30, 150, 450, 1000]` -> **`[8, 36, 100, 200]`** = the Radio tower's ladder x2: "two priorities a night".

| Finish rate | Star 2 | Star 3 | Star 4 | Star 5 |
|---|---|---|---|---|
| 2 a day (realistic) | day 4 | day 18 | day 50 | day 100 |
| 3 a day (the cap) | day 3 | day 12 | day 34 | day 67 |
| 1 a day | day 8 | day 36 | day 100 | day 200 |

At two a day it lands exactly on the shared village pace (star 2 about 4 days, star 3 about 2.5 weeks, star 4 about 7 weeks, star 5 3+ months), which is what the star drops were priced against. Re-check with real play data.

## Rewards

- **Star drops: unchanged**, the default ladder (star 2 Medium Pushback, 3 Small kit, 4 Medium kit, 5 Large kit). The star number already measures "how hard it was", and the ladder's pacing holds at two a day.
- **Parked, a natural fit later:** PRIORITY_SLOTS_PLAN decision 1 parked a RARE held token ("Extra Priority x1", never purchasable) as a possible village star drop. If play data ever asks for that release valve, the Command Post's star 5 is where it belongs (the themed star-5 pattern of the Gym / Hospital / Radio tower). Not built now; the token does not exist.

## The Memorial and the current run

- **`bestVillageTiers.slain` is KEPT, not zeroed.** Jeremy's call pending (see Open). Recommendation: keep. Zeroing it needs a schema bump, and it could LOWER the Memorial's stage (the average of the eight best tiers), breaking "the Memorial never goes down" (DECISIONS 2026-11-08). The Memorial row's pips already separate best-ever (green) from this run (gold ring), so a best of 3 beside a current 1 reads fine. Pre-alpha: one player, one mark.
- **`currentRunStats.villageDropsPaid.slain` is kept.** The ledger was built for exactly this: tiers that drop and climb back never pay twice and nothing is taken back. The current run's Command Post tier will likely fall under the new counter; it pays again only once it passes the highest star already paid. That is the designed behaviour, not a bug.
- The current run's Command Post counter starts from whatever `pri.d` the run's closed days already hold (the slots shipped 2026-11-04), so it is not zero on day one.

## Internal ids: keep `slain`

The kind id `slain` stays. It is a SAVED key (`bestVillageTiers.slain`, `villageDropsPaid.slain`), sits in `VILLAGE_PLACEMENT`, `VILLAGE_ART_X`, `villageLayout`, `memorial`, `villageDrops`, `villageView`, script.js and ten test files. The game's own rule for saved ids (GOAL_METRICS: "never rename or reuse one") applies, and the Baseline decision (DECISIONS 2026-11-04 goals) batches identifier renames behind an alias map in a later session. Dev-only names stay too: `getArmoryTier`, `?armoryTier=`, `VILLAGE_DEV_ARMORY_TIER`, `armoryWidthPx`. Leave a one-line note at each KINDS list: `slain = Command Post (priorities finished, capped 3/day; was the Armory's kill count until 2026-11-09)`.

## Card text (`js/ui/villageCard.js` KINDS.slain)

- `name: 'Command Post', unit: 'priorities'`
- **What we measure:** "Priority tasks you finished, up to three a day. Pick the three that matter most, then take them down. Finishing more than three still pays the points; the extras just don't count here. A sub-task covered by a Priority parent counts with the parent, not on its own."
- **Why it helps:** "Busy is not the same as winning. Three real targets a day, taken out, moves the line further than a dozen small kills. Decide in the morning, finish by night, and the day was yours whatever else happened."
- **Empty line** (counter 0, no priority ever marked this run): "Tick Priority on a task to start building." No link (the Priority box lives in the Add / Edit Task forms; opening Add Task from a village card is a new path -- not worth it for this).
- Every other label that shows the building's name reads `VillageCard.KINDS[kind].name` (Memorial panel does; check the DEV panel chips), so one edit renames it everywhere.

## Build (Sonnet; one session)

1. `js/villageProgress.js`: the `slain` counter becomes the capped priority sum (closed days + the open day; `ctx.today`; cap passed in via `ctx` with a default mirroring CONFIG, like `defenseFrac`). Update the header comment table.
2. `js/config.js`: `VILLAGE_TIER_THRESHOLDS.slain` -> `[8, 36, 100, 200]` with the pace comment; rename the Armory comments; `VILLAGE_DEV_ARMORY_TIER` comment.
3. `js/ui/villageCard.js`: KINDS.slain text above; empty state.
4. Tests: `villageProgress` (new counter: cap, undo, open day, pre-v9 days, other runs ignored; thresholds match CONFIG), `villageCard` (name, text, next-item thresholds 30/150 -> 8/36), `villageDrops` (ladder unchanged at new thresholds), anything asserting "Armory".
5. Docs, same session: WORLD_FEEDBACK_PLAN "Village tiers" table, UI_UX village section, MECHANICS village counters, ART_STYLE (sprite name), PRIORITY_SLOTS_PLAN (a pointer here), CLAUDE.md line listing the kinds if it does, DATA_SCHEMA (a note that the counter is derived, nothing saved). `sw.js` version bump.
6. Headless check: seed a run with `pri.d` 3, 5, 0, 2 over four closed days + 1 today -> counter 3+3+0+2+1 = 9 -> star 2; undo today's -> 8, still star 2; the card shows "Command Post", the Memorial row says Command Post; no Armory string left anywhere player-facing (`grep -rn Armory js/ css/ index.html`).

## Open (Jeremy's word before the build)

1. **Thresholds `[8, 36, 100, 200]`** -- OK as the theory pass?
2. **Memorial mark `bestVillageTiers.slain`: keep (recommended) or zero it once (schema 19)?**
3. **Card wording** -- edit freely; the rules above are the only part the build depends on.

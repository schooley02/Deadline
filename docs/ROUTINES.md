# Routines — Heroes, Slots, Leveling, Frozen Recovery

## Concept
Routines are "Heroes" living in the Base, with health, XP, and levels. They organize habits (and tasks) into meaningful groups.

## Creation & Membership
- Create a routine from existing habits or by creating new habits inside it.
- Routine habits are tagged with the routine name; the Habits tab still lists ALL habits.
- Routine habits are created/managed under the Routine tab.

## Slots & Leveling
- Routine starts at level 1 with 1 habit slot + 1 task slot; each level-up (2-9) deposits ONE
  **banked slot point** into a pool SHARED across habit and task types (not a symmetric +1/+1 per
  level — see "Slot Enforcement — Banked Slot Points" below).
- Routines earn XP when their tasks/habits are completed.
- PLAYER level-ups unlock additional routine slots (more concurrent routines); base visuals upgrade to house more heroes.

**Mechanics BUILT 2026-07-19 (session 41, [P1-UI-006] sub-session 1 — see docs/HEROES_PLAN.md):**
`routine.xp/level/health/createdAt/koState` (schemaVersion 8), `js/heroes.js` pure core. XP:
10/task, 5/habit (`CONFIG.ROUTINE_XP_PER_*`), awarded at ALL completion sites (completeItem,
check-in 'avoided', rollover auto-avoid) AFTER the recovery check — so the avoid that unfreezes a
routine still earns; a frozen or inactive routine earns nothing (`FrozenSlots.isRoutineSuspended` —
the session-36 "no XP while frozen" no-op is now real). Uncompletion refunds EXACTLY off an
`item.routineXpAwarded` stamp, and level is DERIVED from xp (can de-level on refund — perfect
round-trip by construction). Star ratings (`completionRate`/`starRating`, spec tiers 60-95% → 1-5★,
HABIT members only in v1 — routine-task misses are recorded nowhere, so no honest task denominator
exists) built in this sub-session; rendered in sub-session 3. Routine health damage/KO is
sub-session 2. Slot capacity/enforcement (originally sketched here as a symmetric +1/+1 model) was
SUPERSEDED by banked slot points in sub-session 4 before it ever shipped — see below.

## Slot Enforcement — Banked Slot Points ([P1-UI-006] sub-session 4, built 2026-07-19)
Forks resolved post-session-43 (Jeremy, logged in DECISIONS.md): grandfathering is moot (fresh-run
reset, no pre-enforcement routines exist), and the slot model is **banked points**, not the
sub-session-1 sketch's symmetric +1 habit/+1 task per level. Baseline at level 1: 1 habit slot + 1
task slot. Each level-up from 2 to 9 deposits **one point** into a pool **shared** across both slot
types (`CONFIG.ROUTINE_MAX_SLOT_POINTS = 8`, so per-type ceiling is 1+8 = 9 and total slots max out
at 10 — HALF the old symmetric model's 9+9 = 18 budget, matching Jeremy's original "pick one per
level" intent). A point is spent — on a habit slot OR a task slot, player's choice at the moment —
when adding past the routine's current limit: the add flow (existing-item "Add Selected", Create New
Habit, Create New Task — all three routed through `js/ui/routineViews.js`'s shared
`ensureRoutineSlotAvailable`) prompts "spend a point to unlock this slot?" instead of a flat refusal.
Declining, or having zero points, blocks the add (an `alert()` when zero points are available, no
`confirm()` shown at all — verified live in Chrome via a scripted DOM/console pass, since real
`confirm()`/`alert()` are BLOCKING native dialogs that freeze Claude-in-Chrome's automation; the
fully-manual click-through path is untested by this session but the underlying handlers are identical
to any other button click).

**Available points are DERIVED from `routine.level`, never stored or incremented**
(`Heroes.totalSlotPointsEarned`/`availableSlotPoints`) — the only persisted state is what's actually
been SPENT (`routine.boughtHabitSlots`/`boughtTaskSlots`, schemaVersion 9). This is a deliberate
deviation from the original plan text's "needs `routine.slotPoints` (int)" schema note: a stored,
incrementally-updated pool would let a player farm extra points by oscillating level up/down
(complete → level up → deposit; uncomplete → de-level; re-complete → level back up → a SECOND deposit
for the same level). Deriving from the current level closes that hole for free — revisiting a level
never re-mints a point. A de-level never claws back an already-spent point or evicts a member from an
unlocked slot ("strand harmlessly," per the plan's recommendation) — `slotCapacity` is baseline +
whatever has actually been bought, independent of the routine's current level.

## Health
Enemies that get inside the base (item overdue > 1 hour) damage the health of the routine they belong to.

## Spawning (implemented 2026-07-18)
Both routine habits and routine tasks spawn DAILY. Habits use their `timeOfDay` bucket (morning/afternoon/evening/anytime); tasks use the definition's `HH:MM` `defaultDueTime`. Instances are ordinary `type: 'habit'`/`type: 'task'` items carrying a `definitionId`, so damage, completion and sorting treat them like any manually-created item. Each generator dedupes per day against `activeItems` (already spawned) and completion (habits via `lastCompletionDate`, tasks via `completedItems`).

## Activation & Deactivation (implemented 2026-07-18)
Routines can be deactivated (vacation/seasonal) and reactivated. Deactivating a routine does two things immediately, via `toggleRoutineActive`:
- **Stops future spawning** — `generateDailyRoutineTaskInstances` only spawns task definitions belonging to a currently-active routine. For habits, gating applies only to habits a routine actually OWNS (`habitDef.routineId`, or membership in `habitDefinitionIds`): a STANDALONE habit — created outside any routine — always spawns daily and is unaffected by routine state. Removing a habit from a routine (`removeHabitFromRoutine`) RELEASES it to standalone, keeping its streak and resuming daily spawns; it does not go inert. (Revised 2026-07-18 — the earlier "orphaned definitions are inert" rule also silently blocked every standalone habit. See DECISIONS.md.) Orphaned routine TASK definitions are still inert, since there's no standalone task-definition concept.
- **Recalls active enemies** — any of the routine's habit/task instances currently on the board are removed immediately (`clearActiveInstancesForRoutine`), including any sub-tasks of a recalled routine task. This is a pure removal: no completion credit, no XP/points, no streak change, no damage penalty — the routine "went on vacation," it didn't get finished. Uses the same `removeItem()` path as any other removal.

**Reactivating a routine spawns today's due instances immediately** (fixed 2026-07-18, same day as the gating fix above — the first version of this made activation spawn nothing until the next daily pass/reload, which Jeremy hit live: create a routine, add a task, activate it, nothing appeared). `toggleRoutineActive` calls both daily generators on the inactive→active transition, the direct counterpart to the immediate recall on active→inactive.

## Deletion & Orphaned Habits (fixed 2026-07-19)
Deleting a routine (`Routines.deleteRoutine`) releases its member habits to standalone (`habitDef.routineId = null`) via `Routines.releaseOrphanedHabits`, the same "removal = standalone" behavior single-habit removal already had (see above). This was a gap before 2026-07-19: `selectHabitDefsToSpawn`'s gating already treated a dangling `routineId` as standalone at spawn time, but the underlying data was never actually corrected, so deleted routines left behind habits that still pointed at a dead routine id. `state.js`'s `restoreGameState` also runs `releaseOrphanedHabits` as a sweep on every load, healing any save written before this fix (or any other edge case). Routine TASK definitions have no back-reference (`routineId`) to orphan — they're only referenced via the routine's own `taskDefinitionIds`, so a deleted routine simply drops them with it (unchanged).

## Hero Health, KO, and Revive ([P1-UI-006] sub-session 2, built 2026-07-19)
Every routine ("hero") has `health` (0-`CONFIG.ROUTINE_MAX_HEALTH`, seeded 100 by the schemaVersion 8
migration). The base-damage tick path — live loop (`js/loop.js`) AND both catch-up paths (offline
reload + suspended-loop gap, both funneling through `js/damage.js`'s `applyOfflineDamage`) — also
damages the breaching item's owning routine, one health point per base-damage point, via
`Items.damageRoutineForItem` (`js/heroes.js`'s pure `applyRoutineDamage`/`shouldKo` do the math).
Standalone items (no owning routine) are unaffected. **Decided in-session:** offline/live-gap catch-up
damage CAN KO a routine, same as it can damage the base — the existing per-item lifetime damage cap
already bounds how much any single item can contribute, so there's no unbounded-punishment risk from
being away a long time.

**KO (health hits 0):** the routine is knocked out — `koState: { koAt }` is set, it auto-deactivates
(`isActive: false` + `clearActiveInstancesForRoutine`, the same recall machinery deactivation already
uses — a pure removal, no completion/XP/points penalty beyond the KO itself), and a one-time notice
fires (`FrozenNotice.showRoutineKoNotice`). The `koState` guard makes this idempotent — an already-KO'd
routine can't be damaged or re-KO'd again.

**Revive:** a KO'd routine can't be manually reactivated (`Routines.toggleRoutineActive`) until the
calendar day AFTER the KO (`DayRollover.hasDayRolledOver`, the same local-midnight check the day-advance
mechanism uses) — attempting sooner shows an alert and no-ops, both in the backend gate and in the
Routines popup UI (`js/ui/managementWindows.js` disables the button and relabels it "Revive" while
KO'd, showing "revives tomorrow" vs. "ready to revive"). Once the gate clears, reactivating clears
`koState` and restores health to `CONFIG.HERO_REVIVE_HEALTH` (50) — half, not full — before spawning
today's due instances as normal.

## Hero Rendering ([P1-UI-006] sub-session 3, built 2026-07-19)
One avatar chip per routine, rendered at the Base Zone (over `#base`'s leftmost 120px). No hero
sprite assets exist yet (docs/ART_STYLE.md), so v1 is a CSS/emoji placeholder chip (fork 1,
HEROES_PLAN.md): category emoji (dominant category among the routine's HABIT members — routine
tasks aren't counted, same habit-only scope as the star-rating math below; falls back to the
routine name's first letter when it has no habit members yet), a `Lv N` level badge, a star row
(★☆ from the live completion rate, `Heroes.starRating`), and a health bar (colored by the same
75/50/25% tiers `Damage.resolveBaseImage` uses for the base sprite itself). State styling matches
`managementWindows.js`'s compact routine card: KO'd 💤 > frozen 🥶 > inactive ⚪ (greyed) > active
(normal) — checked in that priority order. The Base Zone caps simultaneous chips at
`CONFIG.HERO_CHIP_MAX_DISPLAY` (6) and shows a `+N` overflow chip past that.

Pure view-model math (`js/ui/heroes.js`'s `buildChipViewModel` and friends) is unit-tested;
DOM-building (`buildChipElement`/`renderHeroesAtBase`) is live-playtest-verified only, per
ARCHITECTURE.md's established convention for DOM-orchestration code. Renders from state ONLY — no
new mechanics, no schema change (sub-session 3 lands no migration, as planned).

**Wiring:** `renderHeroesAtBase()` (script.js) runs once immediately after init/restore/level-up
(alongside the existing `updateRoutineDisplay()`) for instant first paint, and once every
game-loop tick (`CONFIG.GAME_TICK_MS` = 50ms) so the chips stay live across every event that can
change a routine's health/XP/level/star-rate/frozen/KO/active state — without threading a new UI
dependency through items.js/routines.js/damage.js, which stay DOM-free.

**Star-threshold-crossed notice** (PROJECT_SPEC ~84): fires the first time a routine's live star
rating actually increases, via an ephemeral, NON-persisted per-session memory
(`heroStarMemory` in script.js, reset on new game/reset) — a routine's first observation just
seeds the memory (no notice); a later render seeing a higher star count than last recorded is a
real crossing. `FrozenNotice.showHeroStarUpNotice` reuses the existing one-time-notice module/CSS
class.

## Frozen Routine Slots (canonical spec — from PROJECT_SPEC.md)

**Planning + design forks (2026-07-19, session 35, Fable):** see
`docs/FROZEN_SLOTS_PLAN.md` for the full sub-session sequence. Four forks
resolved: (1) freezing is ROUTINE-scoped only (never a bare task, never a
standalone negative habit with no routine) and a freeze SUSPENDS the routine
— its other habits/tasks stop spawning and it earns no XP, but the OFFENDING
negative habit keeps spawning its lurker so recovery path 2 stays possible
(non-destructive: no recall of already-spawned instances); (2) a Cheat/Sick/
Skip-Day-excused day is TRANSPARENT to both the freeze-trigger count and the
avoidance-recovery count (an excused day records no occurrence at all, so
it's simply absent from the trailing run rather than breaking it — tokens
can't be used to dodge a freeze); (3) recovery path 1 (edit-to-unfreeze) logs
minimal change tracking (`{ timestamp, changedFields }`) — old/new values and
notes are deferred; (4) Sick Day is GLOBAL (excuses ALL habits for a day),
Skip Day is PER-HABIT (mirrors Cheat Day's targeting) — both ride with this
ticket, both transparent to freeze/recovery counts.

**Sub-session 1 BUILT 2026-07-19:** the pure freeze/recovery core
(`js/frozenSlots.js`: `shouldFreeze`/`shouldRecoverByAvoidance` read trailing
runs off `habitDef.occurrenceHistory`; `buildFrozenState`) is wired into the
five occurrence-recording sites in `js/items.js` — `indulgeHabit` and
`resolvePendingCheckIn`'s indulged branch check the freeze trigger;
`completeItem`, `settleStaleRecurringInstance`, and `resolvePendingCheckIn`'s
avoided branch check avoidance-recovery. `routine.frozenState = { frozenBy,
frozenAt } | null` (schemaVersion 6).

**Sub-session 2 BUILT 2026-07-19:** spawn gating. `Habits.selectHabitDefsToSpawn` and
`Routines.selectTaskDefsToSpawn` now consult `js/frozenSlots.js`'s
`isRoutineUsableForHabit`/`isRoutineSuspended` instead of a bare `isActive` check — a frozen
routine's OTHER habits/tasks stop spawning (same as an inactive routine would), while the
negative habit that caused the freeze keeps spawning its lurker through its own frozen routine
(recovery path 2 needs it active). Freezing is non-destructive — nothing already on the board
gets recalled; this only gates FUTURE spawns. Routine XP/leveling doesn't exist in code yet
(P1-UI-006), so "a frozen routine earns no XP" has nothing to suspend today.

**Sub-session 3 BUILT 2026-07-19:** the frozen-state UI, across three surfaces. The compact routine
card (Routines list) greys out (`.routine-frozen`) with a 🥶 icon and a generic "Frozen — see Manage
for recovery options" subtitle. The "Manage Routine" modal shows a detailed, non-judgmental banner
naming the offending habit and LIVE recovery progress ("Recovery progress: N/3 days successfully
avoided"), recomputed fresh from `occurrenceHistory` on every render — nothing new is persisted for
it. A one-time notice modal (`js/ui/frozenNotice.js`) fires exactly once at the moment of freezing,
explaining what happened and both recovery paths. Frozen routines remain fully manageable — habits/
tasks can still be added/edited/removed while frozen, they just won't spawn (per sub-session 2).

**Sub-session 4 BUILT 2026-07-19:** recovery path 1 (edit-to-unfreeze). `Routines.editHabitInRoutine`
diffs the incoming edit against the habit's current `name`/`category`/`schedule`/`timeOfDay`/
`isNegative` and appends `{ timestamp, changedFields }` to `habitDef.modificationHistory` whenever
something real changed (a no-op Save writes nothing). If the edited habit is the one holding its
routine's `frozenState`, a real edit clears it immediately — no need to wait out the 3-day avoidance
window — and a new one-time `FrozenNotice.showRoutineUnfrozenNotice` fires. There's only one save
path in the UI (the agenda-row "edit" shortcut and the Manage Routine editor both funnel through
`saveEditedHabit` → `editHabitInRoutine`), so this covers both entry points.

**Sub-session 5 BUILT 2026-07-19 (session 39) — TICKET CLOSED.** Sick Day (global) + Skip Day
(per-habit) tokens, schemaVersion 6→7. Both are Buy-to-hold shop consumables (200 pts, same
exponential pricing as Cheat Day): Sick Day applies from its own shop card (untargeted, excuses
EVERY habit for today); Skip Day targets ONE habit instance via its popup (Cheat-Day-style tap
targeting, but reaches any habit type, not just negative). "Clear immediately" model (Jeremy's
call): using either token removes the matching already-spawned instance(s) from the board right
away — no occurrence recorded, streak/points untouched, transparent to freeze/recovery counts by the
same construction as Cheat Day. `habitDef.skipDayDate` / top-level `sickDayDate` double as a
same-day spawn-gate (`Habits.selectHabitDefsToSpawn`) so a same-day reload can't respawn what was
just cleared. See docs/ECONOMY.md + docs/DATA_SCHEMA.md schemaVersion 7 + DECISIONS.md. The "Frozen
routine slots + recovery" ticket (5 sub-sessions, 2 schema bumps) is now fully CLOSED.

- A NEGATIVE habit streak of 3+ days (indulging 3 days running) FREEZES the associated routine slot.
- Frozen slots appear greyed out, with a notification explaining the freeze and recovery options. Frozen routines remain viewable so the user can identify needed adjustments.
- **Recovery, two paths:**
  1. Edit the habit's details (any change counts; change tracking records what was modified), OR
  2. Successfully avoid the negative habit for 3 consecutive days while it stays active.
- Daily check-in prompt (morning or first login) asks individual confirmation for each incomplete negative habit, validating avoidance streaks.
  **BUILT 2026-07-19 (sub-session 4, [P1-DATA-005]):** the check-in SURFACE only
  (frozen slots themselves remain unbuilt — separate ticket above). At restore-path
  rollover, the negative habit's lurker instance for the SINGLE most recent prior
  day is no longer silently auto-resolved — `js/dayRollover.js`'s
  `isFromPreviousDay` + `state.js`'s rollover routing instead route it to
  `Items.markPendingCheckIn`, which records an additive `pendingCheckIn:
  { originalDueDate }` marker on the habit definition (no schema bump — absent on
  every pre-existing habit/save, same precedent as `definedTasks`) and removes the
  lurker so today's fresh one spawns without a duplicate. On next page load,
  `js/ui/checkIn.js`'s `showCheckInModal` renders one card per pending habit:
  "Did you successfully avoid [name] yesterday?" with **Successfully avoided** /
  **I indulged** buttons (`Items.resolvePendingCheckIn`, mirroring
  `settleStaleRecurringInstance`'s avoid path / `indulgeHabit`'s debit path
  respectively) plus the spec's "I'll check this later" snooze — a plain
  in-session `setTimeout` (`CONFIG.CHECK_IN_SNOOZE_MS`, 4 hours), NOT persisted
  across reload (a reload before 4 hours just re-prompts immediately; this ticket
  built the surface, not a scheduling system). Days OLDER than the previous day
  still auto-resolve as avoided via the existing `settleStaleRecurringInstance`
  path (session 26's generous default) — this surface never sees those.

## Routine A/B Testing
Run one routine variant for 6 weeks, another for the next 6; compare streaks/performance. Routine View ranks routines by level (top performers first).

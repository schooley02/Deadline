# Hero/Routine Visual System Plan — [P1-UI-006] (Milestone 3)

Planning session 2026-07-19 (session 41). Sequences the "hero/routine visual system" roadmap item
into one-system-per-session steps, mirroring `NEGATIVE_HABITS_PLAN.md` / `FROZEN_SLOTS_PLAN.md`.
Source of truth: `docs/ROUTINES.md` (XP/levels/slots/health), PROJECT_SPEC.md ~64-89 (heroes are
purely visual, star tiers, positioning), ~128-132 (Base Zone = leftmost 120px),
ACTIONABLE_TICKETS.md [P1-UI-006].

**Line numbers WILL drift — always re-Grep before trusting them.**

---

## Design forks — RESOLVED 2026-07-19 session 41 (Jeremy's verdicts)

1. **Hero art = CSS/emoji placeholders for v1.** No hero sprite assets exist (`Assets/` has only
   zombies + base states; the spec's `assets/sprites/heroes/` was never created). v1 renders each
   hero as a styled avatar chip (category emoji/initial + star row + level badge + health bar)
   behind a single rendering seam (`js/ui/heroes.js`), so real sprites can swap in later without
   touching mechanics. AI-generating sprites and recoloring zombie sprites both rejected (art-
   direction risk / hero-enemy visual confusion).
2. **Routine health 0 = KO: auto-deactivate.** When a routine's health hits 0, the hero is "knocked
   out": the routine deactivates via the EXISTING `toggleRoutineActive` machinery (stops future
   spawns + recalls its active instances — the vacation semantics, no completion credit, no
   penalty beyond the KO itself). Revival: the routine can be manually reactivated the NEXT
   calendar day (a KO'd routine's Activate control is disabled until then), reviving at
   `CONFIG.HERO_REVIVE_HEALTH` (50). Visual-only floor and freeze-style suspension rejected
   (no teeth / conceptual overlap with frozen slots, which mean "your BEHAVIOR froze it" — KO
   means "the zombies got it").
3. **Mechanics first, visuals second.** Sub-session 1 builds the invisible layer (XP/level/health
   state + star math + schema bump) so the visual layer renders real data, not placeholder
   semantics.

**Scope guards (stated assumptions):**
- Heroes are PURELY VISUAL (PROJECT_SPEC ~77) — no active defense, no combat AI. "Hero-enemy
  interaction visualization" (ticket criterion) means reactive flourishes (hero reacts when its
  routine takes damage), not gameplay.
- Standalone habits/tasks (routineId null) have no hero and no routine health — unchanged.
- Outfit changes (spec) are OUT of v1 scope — placeholder chips can't wear outfits; the star row +
  health bar + level badge carry the progression signal until real art exists.
- Routine transfer system stays [P2-UI-013]. Run-reset of completion rates lands here only as far
  as the rate WINDOW START (see sub-session 1); full run lifecycle is the "Run history" item.

---

## What this builds on (already exists)

| Need | Where |
|---|---|
| Routine defs + activation/recall | `definedRoutines`, `Routines.toggleRoutineActive` + `clearActiveInstancesForRoutine` (KO reuses these) |
| Frozen-state suspension ("no XP while frozen") | `routine.frozenState`, `FrozenSlots.isRoutineSuspended` — sub-session 1 finally gives the session-36 no-op something to suspend |
| Completion-rate raw data | `habitDef.occurrenceHistory` (`{date, success}` per scheduled day, excused days absent) — the star-rate numerator/denominator for habits; routine TASKS need completion counting (see sub-session 1) |
| XP award pattern to mirror | `js/progression.js` (player XP: pure `checkLevelUp` walking thresholds) — routine leveling mirrors it |
| Completion/uncompletion sites to wire | `js/items.js` `completeItem`/`uncompleteItem` (already branch on routine-owned items for occurrence recording) |
| Base damage tick (breach detection) | `js/damage.js` + `js/loop.js` — overdue >1hr items damaging the base are the SAME events that damage the owning routine |
| Base Zone rendering | index.html's base area (church, 120px), `Damage.updateBaseVisuals` precedent for state-driven visuals |
| Routine cards / Manage modal UI | `js/ui/managementWindows.js` (`populateRoutinesWindow`), `js/ui/routineViews.js` (frozen banner precedent for new status surfaces) |
| Config + balance protocol | `js/config.js`; all new numbers go through balance-tuning + DECISIONS.md |
| Persistence | current `SCHEMA_VERSION` = **7**. This ticket lands ONE bump: 7→8 (sub-session 1: `routine.xp/level/health/createdAt/koState`) — later sub-sessions are migration-free by design |

---

## Proposed balance numbers (config, finalize via balance-tuning in the sub-session that lands each)

- `ROUTINE_XP_PER_TASK = 10`, `ROUTINE_XP_PER_HABIT = 5` (mirrors player XP values — a routine
  levels alongside the player who feeds it)
- `ROUTINE_LEVEL_XP_THRESHOLDS` — reuse the player curve shape, scaled down (a routine sees only
  its own members' completions)
- Slots per routine level: L1 = 1 habit + 1 task; +1 of EACH per level (spec says "each level
  unlocks more slots" without numbers — cheapest symmetric reading; revisit with play data)
- `ROUTINE_MAX_HEALTH = 100`, breach damage to routine = same per-tick amount the breaching item
  deals the base (one event, two health pools — no new timing rules)
- `HERO_REVIVE_HEALTH = 50`; routine health regen = none in v1 (base regen exists; hero healing is
  a natural future repair-kit variant — deliberately deferred)
- Star tiers (spec, fixed): 60/70/80/90/95% → 1-5★; below 60% = 0★. Rate window starts at
  `max(routine.createdAt, runStartedAtMs)`.

---

## Session sequence (each ends green + committed; ONE sub-session per session)

### Sub-session 1 — pure hero core + 7→8 migration (Sonnet) — ✅ BUILT 2026-07-19 session 41 (same session as this plan)
**Goal:** routine XP/level/health/star state, fully unit-tested, wired to real completion sites —
NO damage wiring, NO UI (state is console/save-observable).
- New `js/heroes.js` (pure): `awardRoutineXp(routine, itemType, config)` → `{xp, level, leveledUp}`
  (mirrors `Progression.checkLevelUp`); `completionRate(routine, habitDefs, taskCompletions,
  windowStartMs)`; `starRating(rate, config)`; `slotsForLevel(level, config)`; `applyRoutineDamage`
  / `shouldKo` (pure math only — nothing calls them until sub-session 2).
- Schema 7→8: routines seed `xp: 0`, `level: 1`, `health: CONFIG.ROUTINE_MAX_HEALTH`,
  `createdAt` (migration seeds `runStartedAtMs` as the best available birthday), `koState: null`.
- Wire XP at `completeItem`/`uncompleteItem` for routine-owned items (symmetric refund, same
  recompute-then-pop discipline as habit rate bonuses); `FrozenSlots.isRoutineSuspended` gates
  earning (the session-36 no-op becomes real). Routine-task completions need a countable record
  for the rate denominator — reuse `completedItems` filtering by `definitionId` (no new store).
- Tests: leveling walk (multi-threshold single completion), XP refund symmetry, frozen = no XP,
  rate/star math incl. window start + zero-denominator day-one case, migration cases.
- **Live-verify (Chrome):** v7 save migrates clean; complete a routine habit → `routine.xp` in the
  save; uncomplete → refunded; star rate recomputes.

**BUILT as specified, with three implementation calls beyond the plan text (all logged in
DECISIONS.md session 41):** (1) refund symmetry is enforced by an `item.routineXpAwarded` STAMP —
completeItem records exactly what it awarded on the item (persists wholesale like every item
field), uncompleteItem refunds off the stamp unconditionally — so a freeze/deactivation between
complete and uncomplete can't produce the streak-bonus-asymmetry bug class; a routine's `level` is
DERIVED from xp (`Heroes.levelForXp`), deliberately non-monotonic unlike the player's, making the
round-trip exact. (2) XP wiring covers ALL completion sites, not just completeItem/uncompleteItem —
`resolvePendingCheckIn`'s 'avoided' branch and `settleStaleRecurringInstance`'s auto-avoid also
award (habit-def-only helper, no stamp — those paths can never be undone); ordering is award AFTER
`maybeRecoverRoutine`, so the avoid that unfreezes a routine earns for the unfreezing completion.
(3) `completionRate` samples HABIT members' occurrenceHistory only (plan's completedItems-based
task counting dropped: routine-task misses are recorded nowhere, so any task denominator would be
reconstructed guesswork — revisit with run history). Tests: 32 suites, 635/635 (+50: new
`test/heroes.test.js` + `test/items-routine-xp.test.js`, v7→v8 cases in
persistence-migration.test.js, hero-field seeding case in routines.test.js; `global.Heroes` bound
in the 7 items-*.test.js files). `node --check` clean. **Live-verified in Chrome:** real v7 dev
save migrated to v8 (xp 0/level 1/health 100/koState null/createdAt = runStartedAtMs); completing
the routine-owned habit put `xp: 5` + `routineXpAwarded: 5` stamp in the save (player XP/points
+5 as before); uncompleting refunded to exactly 0/0 with the stamp deleted and the occurrence
popped. Zero app console errors (only the recurring extension messaging noise).

### Sub-session 2 — routine health damage + KO/revive (Sonnet) — ✅ BUILT 2026-07-19 session 42
**Goal:** fork 2's teeth. The base-damage tick path (live loop + offline catch-up + live-gap
catch-up in `js/damage.js`/`js/loop.js`) also damages the breaching item's owning routine (items
with `routineId`/`definitionId` → routine only; standalone items unchanged). At 0: set
`koState: { koAt }`, auto-deactivate via existing `toggleRoutineActive` path (recall included),
fire a one-time KO notice (`FrozenNotice` precedent). Reactivation guard: disabled until next
calendar day (dayRollover.js precedent), revive at `HERO_REVIVE_HEALTH`, clear `koState`.
- Decide in-session: whether offline catch-up damage can KO (recommend yes — capped damage already
  bounds it) — log either way.
- Tests: damage routing, KO exactly at 0, no double-KO, revive-gating by calendar day, offline
  path parity. **Live-verify:** let a routine task go overdue >1hr, watch routine health fall;
  force a KO; confirm recall + disabled Activate + next-day revive (backdate trick).

### Sub-session 3 — hero rendering at the base (Sonnet) — ✅ BUILT 2026-07-19 session 43
**Goal:** the ticket's visible payoff. New `js/ui/heroes.js` + `css/heroes.css`: one avatar chip
per routine in/around the Base Zone (integrated + perimeter per spec ~88 — CSS positioning,
capped display with overflow "+N" if slots exceed space), showing category emoji/initial, star
row (live rate), level badge, health bar, state styling (active / frozen 🥶 / KO'd 💤 / inactive
greyed). Renders from state only — no new mechanics. Star-threshold-crossed notification (spec
~84) via the FrozenNotice one-time pattern.
- **Live-verify:** heroes appear/update on complete/damage/freeze/KO/deactivate; no layout break
  on mobile width (Chrome device emulation).

**BUILT as specified, with implementation calls beyond the plan text (all logged in DECISIONS.md
session 43):** (1) category emoji is the DOMINANT category among the routine's HABIT members
(routine tasks excluded, same scope as `Heroes.completionRate`), falling back to the routine
name's initial with no members — new `CONFIG.CATEGORY_EMOJI` (8 entries), a display-only constant
added without the balance-tuning protocol (not gameplay balance). (2) live-updating chips across
complete/damage/freeze/KO/deactivate is done via a per-tick render call in `updateGame()`
(`CONFIG.GAME_TICK_MS` = 50ms) rather than threading a new callback through items.js/routines.js/
damage.js/loop.js, keeping those modules DOM-free. (3) the star-threshold notice's crossing memory
(`heroStarMemory`) is a plain, non-persisted script.js object — no schema bump, as planned. Tests:
34 suites, 683/683 (+29, `test/heroes-view.test.js`, pure helpers only — DOM functions are
live-playtest-verified per the established `testEnvironment: 'node'` / no-jsdom convention).
`node --check` clean. **Live-verified in Chrome:** chip renders on load, a real habit completion
awarded routine XP and (as the routine's first recorded occurrence) crossed into 5 stars, firing
the real notice end-to-end; deactivating/reactivating updated the chip's state styling live within
one game-loop tick, no reload needed. Mobile breakpoint verified by reading the loaded stylesheet
(sandbox couldn't actually resize the remote browser viewport) — see DECISIONS.md session 43.

### Sub-session 4 — hero management UI + slot enforcement, BANKED SLOT POINTS (Sonnet) — forks RESOLVED 2026-07-19 session 43 (Jeremy)
**Design forks resolved (post-session-43 discussion, logged in DECISIONS.md):**
1. **Grandfathering is MOOT — Jeremy reset to a fresh run.** Single-player prototype; no
   pre-enforcement routines exist. Enforcement ships clean: no grandfather logic, no migration of
   legacy over-limit routines. (A shipped game couldn't do this; a prototype can.)
2. **Slot model = BANKED SLOT POINTS**, replacing sub-session 1's symmetric auto +1/+1
   (`Heroes.slotsForLevel` becomes the derivation over spent points, or is superseded — session's
   call, keep the pure-core discipline either way). Level 1 baseline: 1 habit + 1 task slot. Each
   level-up (levels 2-9) deposits **1 slot point** into `routine.slotPoints`. Points are spent —
   on a habit slot OR a task slot — at the moment the player tries to ADD past their current
   limit: the "+ Add Habit/Task" flow prompts "spend a point to unlock this slot?" instead of a
   flat refusal. Unspent points accumulate. Chosen over pick-at-level-up (decision forced before
   the need is known, interrupts the level-up moment) and over pure symmetric (no engagement pull).
3. **Cap:** natural only — 8 points max (levels 2-9), so per-type ceiling is 1+8 = 9 and total
   slots max out at 10. No artificial 5/5 cap (considered, dropped). NOTE the budget difference
   vs the old symmetric model (which reached 9+9 = 18 total): banked points HALVE the total slot
   budget — this matches Jeremy's original "pick one per level" intent, but re-check against play
   data once routines actually level.
**Schema:** needs `routine.slotPoints` (int) + spent-slot tracking (e.g. `routine.boughtHabitSlots`/
`boughtTaskSlots` ints — cheapest honest shape; level stays derived from xp). SchemaVersion 8→9.
This BREAKS the "single schema bump in sub-session 1" plan note below — deliberate, logged; the
fresh-run reset means the migration only needs to seed fields (no legacy reconstruction).
**Also still in scope (unchanged from original plan):** routine cards + Manage modal show
level/XP-progress/stars/health; Activate control explains KO gating (sub-session 2's disabled
state gets its explanation here).
- Tests: slot-point math (deposit on level-up incl. multi-level single completion, spend, refund
  behavior on de-level — decide + log whether a de-level can strand spent slots; recommend: yes,
  strand harmlessly, never evict members), add-gating, migration seeding. **Live-verify:** full
  card/modal pass; add-past-limit prompts spend; spend unlocks and persists; out-of-points add
  shows "level up to earn a slot point."

### Sub-session 5 — polish: interaction visuals + ranking (Sonnet) — OPTIONAL, cut if play data says otherwise
**Goal:** the ticket's remaining criteria. Hero reacts when its routine takes damage (flinch/flash)
and on member completion (brief celebrate) — CSS animation classes toggled from the sub-session-2
damage hook and completion sites, no new state. Routines view ranks by level then star rate
(ROUTINES.md's A/B-testing ranking). Real-time completion % on the Manage modal.

---

## Guardrails reminder
- ONE sub-session per session; the single schema bump is sub-session 1, never combined with later
  work.
- Update ROUTINES.md / DATA_SCHEMA.md / MECHANICS.md / UI_UX.md in the same session as the
  behavior they describe; log to DECISIONS.md.
- All numbers in `js/config.js` via the balance-tuning protocol — never hardcoded.
- Never read script.js or PROJECT_SPEC.md whole — Grep.

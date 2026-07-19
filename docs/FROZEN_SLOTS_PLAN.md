# Frozen Routine Slots Plan (Milestone 3)

Planning session 2026-07-19 (session 35, Fable). Sequences the "frozen routine slots + recovery"
roadmap item into one-system-per-session steps, mirroring `NEGATIVE_HABITS_PLAN.md`. Source of truth:
`docs/ROUTINES.md` (canonical spec), PROJECT_SPEC.md ~56-58/~424-435/~669-672, and the session-26
channel-separation principle (HP = deadline failures, points = behavior costs, frozen slots =
sustained patterns). Sick/Skip Day tokens ride with this ticket (deferred here from [P1-UI-008] and
[P1-DATA-005] — see ECONOMY.md).

**Line numbers WILL drift — always re-Grep before trusting them.**

---

## Design forks — ALL RESOLVED 2026-07-19 session 35 (Fable, Jeremy's verdicts)

1. **Freeze effect = suspend routine, lurker stays.** A frozen routine stops spawning its OTHER
   habits/tasks (treated like `isActive: false` for spawn gating) and earns no XP; the OFFENDING
   negative habit keeps spawning its lurker so recovery path 2 ("3 avoided days while it stays
   active") remains possible. The slot stays occupied. Visual-only and full-deactivation models
   rejected (cosmetic teeth / breaks recovery path 2, respectively).
2. **Cheat-Day-excused days are TRANSPARENT to both 3-day counts** (the indulged run that triggers a
   freeze AND the avoided run that recovers). Falls out of the data model for free: excused days
   record NO occurrence (session 34), and both counts read consecutive RECORDED occurrences — an
   absent day neither counts nor breaks. 2 indulged + cheat + 1 indulged = 3 consecutive → freeze.
   Tokens can't be used to dodge a freeze.
3. **Change tracking = minimal history.** New `habitDef.modificationHistory:
   [{ timestamp, changedFields }]` appended on real edits (any edit path). Unfreezing via recovery
   path 1 requires a REAL change (≥1 field actually differs). Old/new values, user notes, impact
   analysis deferred to future analytics work.
4. **Sick Day = GLOBAL, Skip Day = PER-HABIT.** Sick Day: one token excuses ALL habits for one day
   (no spawns, no misses; streaks/counts pause — transparent, same principle as fork 2). Skip Day:
   pauses ONE chosen habit for one day (Cheat-Day-style targeting). Both transparent to
   freeze/recovery counts.

**Scope guard (assumption, stated to Jeremy):** freezing is routine-scoped by definition. A
STANDALONE negative habit (routineId null) never freezes anything — debt + streak already punish it;
there's no hero to knock out. Tasks never freeze anything.

---

## What this builds on (already exists)

| Need | Where |
|---|---|
| Indulged/avoided occurrence recording | `Habits.recordOccurrence` / `occurrenceSuccess` — entries are `{ date: 'YYYY-MM-DD', success: bool }`; for a NEGATIVE habit, `success: false` ⇔ indulged (lurkers never go overdue per 2a) |
| The three failure-recording sites | `Items.indulgeHabit` (live), `Items.resolvePendingCheckIn` indulged branch, — plus success sites: `completeItem` avoid, check-in avoided, `settleStaleRecurringInstance` auto-avoid |
| Excused-day predicate | `Items.isCheatDayExcused` + `habitDef.cheatDayDate` (session 34) — excused days record nothing, giving fork-2 transparency for free |
| Routine ownership + spawn gating | `habitDef.routineId`; `Routines`/`Habits` spawn selection already gates on `routine.isActive` — the freeze gate composes with the same mechanism |
| Deactivation recall precedent | `clearActiveInstancesForRoutine` (freeze does NOT recall — it only stops FUTURE spawns of non-offending defs; decided to keep freeze non-destructive, unlike vacation-deactivation) |
| Check-in surface | `js/ui/checkIn.js` (session 33) — the spec's avoidance-validation surface; recovery path 2 counts the same occurrences it writes |
| Shop plumbing for tokens | `js/shop.js` / `js/ui/shopView.js` / `CONFIG.SHOP_ITEMS`; Cheat Day (session 34) is the per-habit-token template |
| Persistence | current `SCHEMA_VERSION` = **5**. This ticket lands TWO bumps, one per session: 5→6 (freeze state + modificationHistory, sub-session 1), 6→7 (sick/skip state, sub-session 5) |

Routine XP/leveling ("earns no XP") — believed UNBUILT (P1-UI-006 territory). Sub-session 2 must
verify: if routine XP doesn't exist yet, the freeze XP-suspension is a no-op to note for P1-UI-006,
not code to write.

---

## Session sequence (each ends green + committed; ONE sub-session per session)

### Sub-session 1 — pure freeze/recovery core + 5→6 migration (Sonnet)
**Goal:** the freeze state machine, fully unit-tested, wired to real trigger sites — NO spawn gating,
NO UI yet (state is console/save-observable).
- New `js/frozenSlots.js` (pure): `consecutiveFailures(history, n)` / `consecutiveSuccesses(history,
  n)` reading the LAST n recorded occurrences (fork-2 transparency is inherent — excused days have no
  entry); `shouldFreeze(habitDef, routine, config)`; `buildFrozenState(habitDefId, now)`;
  `shouldRecoverByAvoidance(habitDef, config)`.
- `routine.frozenState = { frozenBy, frozenAt, avoidedProgress } | null` (avoidedProgress derived,
  not stored, if cheap — decide in implementation; prefer derived).
- Persistence `SCHEMA_VERSION` 5→6: seed `frozenState: null` on routines, `modificationHistory: []`
  on habit defs (landing the field now so sub-session 4 is migration-free).
- Wire trigger checks at the failure-recording sites (indulgeHabit, resolvePendingCheckIn-indulged)
  and recovery-by-avoidance checks at the success sites (completeItem-avoid, check-in-avoided,
  auto-avoid) — routine-owned negative habits only. `CONFIG.FREEZE_THRESHOLD_DAYS = 3`,
  `CONFIG.RECOVERY_AVOIDED_DAYS = 3` (config, never hardcoded).
- Tests: run-counting incl. transparency (gap days), freeze at exactly 3, recovery at exactly 3,
  standalone-habit never freezes, migration cases.
- **Live-verify (Chrome):** v5 save migrates clean; backdate 3 indulged occurrences → indulge →
  `routine.frozenState` set in the save; 3 avoided → null again.

### Sub-session 2 — spawn gating + non-destructive suspension (Sonnet) — ✅ BUILT 2026-07-19 session 36
**Goal:** fork 1's teeth. Frozen routine's non-offending habit/task defs excluded from both daily
generators (compose with the existing isActive gate — likely one shared predicate `isRoutineSuspended
= !isActive || frozenState`); the offending habit def still spawns. NO recall of already-spawned
instances at freeze time (non-destructive). Verify routine-XP question (see above). Regression:
deactivation behavior unchanged.

**BUILT as specified, with two predicates instead of one** (the plan's single `isRoutineSuspended`
turned out to need a habit-aware sibling): `js/frozenSlots.js` gained `isRoutineUsableForHabit(routine,
habitDefId)` — active AND (not frozen OR frozen BY this exact habit) — used by
`Habits.selectHabitDefsToSpawn`'s owning-routine check (replaces the old bare `r.isActive` test), so
the offending negative habit keeps spawning through its own frozen routine. `isRoutineSuspended(routine)`
— active AND not frozen, no exception — is used by `Routines.selectTaskDefsToSpawn`'s active-routine-task
collection, since a routine TASK can never be the def that caused a freeze. Both are pure, unit-tested,
and default to today's exact behavior when `frozenState` is absent (undefined), so no existing test
needed touching beyond adding `global.FrozenSlots` to the 4 test files that exercise these two
generators. No recall logic needed — freezing never removes anything; this session's gate simply stops
FUTURE spawns. **Routine-XP question resolved: true no-op** — confirmed by Grep that no
`routine.xp`/level code exists anywhere yet (P1-UI-006, unbuilt), so "earns no XP while frozen" has
nothing to suspend; noted for whoever builds routine XP later.

28 suites, 547/547 (+15: `test/frozen-slots.test.js` gained 2 new describe blocks for the two
predicates; `test/habits.test.js` +4 frozen-gating cases incl. the multi-owner "usable via a different
routine" edge case; `test/routines.test.js` +1 frozen-task case). `node --check` clean. **Live-verified
in Chrome:** froze a real routine (via the save, skipping re-earning it since sub-session 1 already
proved the trigger), added a new POSITIVE habit to it through the real "+ Add Habit" UI flow — the
definition was created and linked, but ZERO active instance spawned (confirmed via the save's
`activeItems`, and visually — no new sprite/agenda row). Then cleared `frozenState` and reloaded — the
same habit spawned immediately on the next boot pass (`restoreGameState`'s unconditional generator
call), with no console errors either direction.

### Sub-session 3 — frozen UI (Sonnet)
**Goal:** spec's visibility requirements. Greyed routine card (`.routine-frozen`), freeze
notification/modal on trigger (non-judgmental tone per PROJECT_SPEC ~2696), recovery-options
explanation with live progress ("2/3 days avoided") on the card, frozen routines remain fully
viewable. Check-in cards unchanged (they already validate avoidance).

### Sub-session 4 — recovery path 1: edit-to-unfreeze + modificationHistory (Sonnet)
**Goal:** append `{ timestamp, changedFields }` on every real habit edit (standalone editor + routine
editor paths — diff the fields, skip no-op saves); if the routine is frozen BY that habit and the
edit is real → unfreeze + notification. Field landed in sub-session 1's migration, so no schema
change here.

### Sub-session 5 — Sick Day (global) + Skip Day (per-habit) tokens + 6→7 migration (Sonnet)
**Goal:** shop entries (200 pts each, held-inventory exponential pricing, `consumable: true`).
Skip Day: mirrors Cheat Day end-to-end (`habitDef.skipDayDate`, targeted via habit popup) but pauses
ANY habit (positive or negative) for that day — no spawn, no occurrence, streak preserved. Sick Day:
GLOBAL `sickDayDate` (new top-level persisted field, 6→7 with `habitDef.skipDayDate`) — applied from
the shop card directly (no targeting); that day NO habits spawn/record. Both transparent to
freeze/recovery counts (inherent — no occurrences). Balance numbers via balance-tuning skill if they
move off 200.

---

## Guardrails reminder
- ONE sub-session per session; the two schema bumps are sessions 1 and 5, never combined.
- Update ROUTINES.md / ECONOMY.md / DATA_SCHEMA.md / MECHANICS.md in the same session as the
  behavior they describe; log to DECISIONS.md.
- Never read script.js or PROJECT_SPEC.md whole — Grep.

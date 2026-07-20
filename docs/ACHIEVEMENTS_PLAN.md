# Achievements & Badges Plan — Milestone 4

Planning session 2026-07-20 (session 64, Cowork, Fable). Sequences the "Achievements & badges"
roadmap item into one-system-per-session steps, mirroring `NEGATIVE_HABITS_PLAN.md` /
`FROZEN_SLOTS_PLAN.md` / `HEROES_PLAN.md` / `SUBTASKS_PLAN.md` / `RUN_HISTORY_PLAN.md`.
Sources of truth: `docs/ECONOMY.md` "Achievements & Badges" (2 lines: run length, routine
completion rates, streak rates; milestone celebrations), PROJECT_SPEC.md ~495-501 + ~799-804
(the big-dream version — browser, hint system, social sharing, reward claims; v1 deliberately
ships a subset), `docs/GAME_DESIGN.md` design principle 2 (reflection over punishment).

**Line numbers WILL drift — always re-Grep before trusting them.**

---

## Recon findings (session 64) — what exists vs what's missing

Exists today (achievements can be almost entirely derived/hooked, no new event plumbing):
- `currentRunStats` counters (tasks/habits completed, habits missed, points earned) + blame map,
  bumped at the recording sites in `js/items.js`; `finalizeRun` at `Damage.gameOver` (js/runStats.js).
- `runHistory` (schemaVersion 10, capped `CONFIG.RUN_HISTORY_MAX` = 50) — days survived per run,
  totals, per-routine rollup. Survives restart via the carry-through-`Persistence.clear()` pattern.
- Habit `currentStreak` + `occurrenceHistory`; the streak milestone crossing site already exists
  (session 59, fires `FrozenNotice.showStreakMilestoneNotice`).
- Routine hero level/stars/completionRate (js/heroes.js).
- One-time toast pattern (`js/ui/frozenNotice.js` family) and the Stats window
  (`js/ui/statsView.js` + `css/stats.css`) to host a badge grid.

Missing (drives the sub-sessions): any achievement definition/unlock state, lifetime counters
(currentRunStats resets per run; runHistory is capped at 50 so lifetime totals can't be derived
from it losslessly), unlock detection, badge UI, unlock celebration.

---

## Design forks — RESOLVED 2026-07-20 session 64 (Jeremy's verdicts)

1. **Reward model = BADGE-ONLY v1.** No point payouts. Session 24's balance theory pass tuned
   shop pricing against an earn rate with no achievement income; a new income stream would
   silently undercut it. Revisit points rewards (spec's "Reward Claims") only after the
   real-play balance re-check. Celebration = one-time toast + gallery entry.
2. **Scope = LIFETIME + `lifetimeStats`.** Unlocks survive game-over/restart (runHistory
   precedent: carried through `Persistence.clear()`); dev-Reset wipes both (parity with
   runHistory). New small `lifetimeStats` counter object (schemaVersion 10→11) bumped at the
   SAME recording seams that bump `currentRunStats` — not derived from capped runHistory.
3. **UI surface = Stats window section.** Badge grid (locked/unlocked + progress) appended to
   the existing Stats window; `FrozenNotice`-style one-time toast on unlock. No 7th FAB item,
   no social sharing, no hint system in v1.
4. **Detection = EVENT-DRIVEN + one-time RETRO SWEEP.** Checks fire at the existing recording
   sites (items.js completion/streak paths, `finalizeRun` at gameOver). The 10→11 migration
   sweeps runHistory + current streaks + occurrenceHistory ONCE so Jeremy's real save isn't
   zeroed. No per-tick scanning.

**Scope guards (stated assumptions):**
- v1 ships NO achievement browser window, NO hint system, NO social sharing, NO reward claims,
  NO prestige/leaderboards (PROJECT_SPEC dreams). The definition shape is config-driven so more
  achievements are DATA, not code.
- Unlocks are never revoked. Uncompletion decrements `lifetimeStats` symmetrically (same
  recompute-then-pop spirit as the rate-bonus refund), but an already-fired unlock stays —
  standard game convention, and symmetric decrement means complete→uncomplete can't farm
  progress anyway.
- Balance numbers: none change. Thresholds below are NOT gameplay balance (no economy effect,
  badge-only) but still get logged in DECISIONS.md.

---

## v1 catalog — DRAFT, Jeremy edits freely (thresholds are data in `CONFIG.ACHIEVEMENTS`)

Tiered families (Bronze/Silver/Gold/…, one badge per tier crossed):

| id | Family | Metric (source) | Tiers |
|---|---|---|---|
| `survivor` | Survivor | days survived in a single run (`finalizeRun` / live `computeDaysSurvived`) | 3 / 7 / 14 / 30 |
| `task_slayer` | Task Slayer | lifetime tasks completed (`lifetimeStats.tasksCompleted`) | 10 / 50 / 250 / 1000 |
| `habit_hero` | Habit Hero | lifetime habit completions (`lifetimeStats.habitsCompleted`) | 10 / 50 / 250 / 1000 |
| `on_fire` | On Fire | best single-habit streak (existing streak crossing site) | 7 / 14 / 30 |
| `steady_hands` | Steady Hands | a routine ends a run ≥90% completion rate, ≥7 days survived (per-routine rollup at `finalizeRun`) | 1 / 5 / 25 runs |
| `back_in_black` | Back in Black | recover from a negative balance to ≥0 (economy seam) | single badge |

Progress display derives at render time from `lifetimeStats` + live state — only unlock
timestamps and `lifetimeStats` persist.

---

## Sub-sessions (one per session, tests green before/after, commit each — all Sonnet)

1. **Pure core + schema 10→11 + retro sweep.** `js/achievements.js`: catalog reader
   (`CONFIG.ACHIEVEMENTS`), pure `evaluate(metric, value)` → newly-crossed tiers,
   `unlockedMap` state shape `{ [tierId]: unlockedAtISO }`. `lifetimeStats` shape + accessor
   deps + persist/restore; migration seeds both, retro sweep populates from runHistory (days
   survived, routine rollups) + current/best streaks + occurrenceHistory counts. Restart
   carry-through alongside runHistory; dev-Reset wipes. NOT wired to live events yet.
2. **Wiring + unlock toast.** Bump `lifetimeStats` at the items.js recording seams (complete/
   uncomplete symmetric), streak site, economy negative→positive crossing, and `finalizeRun`
   (gate by the session-55 `alreadyOver` flag — a dead-save reload must NOT re-fire unlock
   checks). One-time unlock toast (frozenNotice pattern); coordinate with the existing streak
   milestone toast so a 7-streak doesn't double-toast (queue, streak notice first). Live
   playtest in Chrome.
3. **Stats window badge grid.** Locked (greyed + progress bar "184/250") / unlocked (badge +
   date) cards in a new Achievements section of `js/ui/statsView.js` + `css/stats.css`.
   Read-only — no setTimeout(0) rebuild hazard (shopView precedent doesn't apply). Live
   playtest in Chrome.
4. **Polish (optional, cut-if-time-says-so).** Near-miss nudges ("2 days to Survivor II") on
   the current-run Stats panel; small unlock animation per the fx-intensity setting
   (session 59 — respect fx-off/reduced + prefers-reduced-motion).

## Hazards
- **Restart flow:** `achievements` + `lifetimeStats` must ride the SAME carry-through as
  runHistory in the restart button path; session 52 found dev-Reset gaps here once already —
  re-verify both paths live.
- **Retro sweep runs ONCE** (inside the 10→11 migration), never on ordinary restores — or
  re-derived badges resurrect after any hand-edit/wipe.
- **`alreadyOver` gating at gameOver** (session 55's duplicate-finalize bug is the exact same
  trap for unlock checks).
- **Toast stacking:** streak milestone + achievement unlock can fire from the same completion;
  modal.js's `closeModal` same-tick deletion hazard (sessions 21/34/37) applies to any notice
  inserted from a popup action.

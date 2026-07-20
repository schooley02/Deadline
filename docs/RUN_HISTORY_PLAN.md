# Run History + Run Review Plan — Milestone 3 (final unchecked feature item)

Planning session 2026-07-19 (session 52, Cowork, Fable). Sequences the "Run history + run review
screen" roadmap item into one-system-per-session steps, mirroring `NEGATIVE_HABITS_PLAN.md` /
`FROZEN_SLOTS_PLAN.md` / `HEROES_PLAN.md` / `SUBTASKS_PLAN.md`. Sources of truth:
`docs/GAME_DESIGN.md` "The Run" + design principle 2 (reflection over punishment),
`docs/MECHANICS.md` Base (lines ~22-23: game-over message, run history log sketch),
PROJECT_SPEC.md ~115-127 (Run-Based Gameplay user stories) and ~824-855 (Run Summary Interface /
Run End State / Run History State — the big-dream version; v1 deliberately ships a subset).

**Line numbers WILL drift — always re-Grep before trusting them.**

---

## Recon findings (session 52) — what exists vs what's missing

Exists today:
- `gameOver()` (js/damage.js ~242) freezes `daysSurvived` from `runStartedAtMs`, shows a one-line
  text message + "Start New Base (Restart)" button, disables forms, saves.
- Restart button (script.js ~1609) calls `Persistence.clear()` → `initGame()` → `saveGame()`.
  Definitions (habits/routines/tasks defs) survive in memory and get re-saved; everything else
  resets. **Run history therefore cannot exist today — the dead run is erased.**
- `State.initGame` resets player XP/level/points/inventory/base/board; routine defs (and their
  hero xp/level/health) are NOT touched by initGame.
- Damage funnels through exactly ONE seam: `Damage.damageBase(amount, deps)` — called by the live
  loop (js/loop.js ~106, `CONFIG.OVERDUE_DAMAGE` per `DAMAGE_INTERVAL_MS` = 1 dmg / 5 min per
  camped item) and by `applyOfflineDamage` (both reload catch-up and live-gap catch-up funnel
  through it, js/damage.js ~282). BUT the loop call site passes only the amount — **no item
  identity reaches damageBase today**, so attribution must be captured AT the call sites, not
  inside damageBase.
- Heroes already compute `completionRate`/`starRating` (js/heroes.js) — the per-routine rollup
  can reuse these, windowed to the run.
- Save is schemaVersion 9 (js/persistence.js).

Missing (drives the sub-sessions): any run record, any damage attribution, any counters
(tasks/habits completed this run, points earned this run), any review UI, and a restart flow that
PRESERVES history across `Persistence.clear()`.

---

## Design forks — RESOLVED 2026-07-19 session 52 (Jeremy's verdicts)

1. **Carry-over on new run = FULL RESET (codifies current behavior; spec line overridden).**
   PROJECT_SPEC ~125 says "XP and routine slots carry over between runs" — overridden: player
   XP/level/points/inventory reset each run (the session-44 banked-slot-points economy depends on
   level resetting; runs read as self-contained seasons). Routine definitions and their hero
   xp/level/health PERSIST across runs (heroes are long-lived companions) — unchanged, already
   true. `runHistory` also persists across runs (that's the feature). Logged in DECISIONS.md.
2. **Run record = LEAN + PER-ROUTINE ROLLUP.** Totals (days survived, start/end, end reason,
   tasks completed, habits completed/missed, points earned, blame list) plus a snapshot per
   routine active during the run: {name, level, stars, completionRate for the run window, damage
   attributed to its members, frozen/KO'd days}. Directly enables Jeremy's stated goal: comparing
   new runs AND new routines against past ones. No raw event log (deferred — see scope guards).
3. **Review UI = a Stats tab (management-window/FAB pattern), current run + history together.**
   Jeremy: "a tab that a player can click to review past stats on runs / routine performance,
   along with the current run / performance." 5th FAB item → Stats window with a live
   current-run section on top and past-run cards below. The game-over moment ALSO surfaces the
   just-finalized record as a review card (GAME_DESIGN tone: encouraging, "what adjustments...").
4. **Blame capture = aggregate map + first/last timestamps.** One row per offending item in
   `currentRunStats.blame`: `{name, category, isHabit, routineId|null, totalDamage,
   firstDamageAt, lastDamageAt}`, upserted at every damage call site (live loop + offline/gap
   catch-up). Bounded size, survives item completion/removal. Timestamped per-tick event log
   REJECTED for v1 (only payoff is time-of-day analytics, not in v1; growth ~288 rows/day per
   camped item). Correction from the session: damage is 1/5min, NOT 1/30s.

**Scope guards (stated assumptions):**
- v1 ships NO charts, NO trend graphs, NO AI insights, NO export, NO side-by-side comparison
  tools (PROJECT_SPEC's Run History State dreams) — past-run cards + current-run panel only.
  The record SHAPE is chosen so those can be built later without re-capture.
- No raw event log anywhere. If time-of-day analytics get prioritized, that's a new design
  session (capture + compaction policy).
- Offline/gap catch-up damage attributes exactly like live damage (same blame map, hit.item is
  in hand at both call sites).
- Runs that end via the dev Reset button are ABANDONED, not recorded (dev tool, not gameplay).
- History length: cap `runHistory` at `CONFIG.RUN_HISTORY_MAX` (50, tunable) — oldest dropped.

---

## Data shapes (target — DATA_SCHEMA.md gets the canonical copy in sub-session 1)

```js
// live, run-scoped (persisted so a mid-run reload keeps accruing; reset by initGame)
currentRunStats = {
  tasksCompleted: 0, habitsCompleted: 0, habitsMissed: 0,
  pointsEarned: 0,               // gross earnings (Economy.addPoints seam)
  blame: { [itemKey]: { name, category, isHabit, routineId, totalDamage,
                        firstDamageAt, lastDamageAt } }
}

// finalized at gameOver(); appended to runHistory (persisted; SURVIVES initGame/restart)
runRecord = {
  runNumber, startedAtMs, endedAtMs, daysSurvived,
  endReason: 'base_destroyed',   // enum-ready for future end types
  totals: { ...currentRunStats minus blame },
  blame: [ top blame rows, sorted by totalDamage desc ],
  routines: [ { routineId, name, level, stars, completionRate, memberDamage,
                wasFrozenAtEnd, wasKOdAtEnd } ]  // end-state flags, not day
                // counts — day-accrual would need new per-run tracking with
                // no v1 consumer (decided during sub-session 1 build)
}
```

Schema bump **9→10**: migration seeds `runHistory: []` + `currentRunStats: <fresh>` on older
saves. `initGame` resets `currentRunStats` but must NOT touch `runHistory`; the restart button's
`Persistence.clear()` flow must carry `runHistory` (and the just-finalized record) through in
memory so the immediate `saveGame()` writes it back.

---

## Sub-sessions (one per session, Sonnet unless noted)

1. **Pure core + state + schema 9→10.** New `js/runStats.js`: `freshRunStats()`,
   `recordDamage(stats, item, dmg, nowMs)` (blame upsert), `recordCompletion`/`recordMiss`/
   `recordPointsEarned`, `finalizeRun(stats, ctx)` → runRecord (incl. per-routine rollup via
   injected Heroes helpers), `appendToHistory(history, record, max)`. State plumbing:
   `currentRunStats` + `runHistory` accessors, persist/restore, 9→10 migration, initGame
   semantics (reset stats, PRESERVE history). Jest for all pure paths + migration.
2. **Wiring: attribution + counters + finalize + restart flow.** Accrue at both damage call-site
   families (loop.js live tick; damage.js applyOfflineDamage — hit.item in hand at both);
   completion/miss/points seams in items.js/economy.js; `Damage.gameOver` finalizes + appends;
   restart button reworked to preserve history through clear(). Live-verify in Chrome (kill a
   base for real, inspect the saved record; reload mid-run and confirm stats keep accruing).
3. **Stats window UI.** 5th FAB item ("Stats" 📊) → `js/ui/statsView.js` + `css/stats.css` via
   the `ManagementWindows.openManagementWindow` pattern (mind the session-21 `setTimeout(0)`
   rebuild hazard). Top: live current-run panel (days so far, counters, top-3 blame so far).
   Below: past-run cards, newest first (days survived, end date, headline stats, blame top-3).
   Live-verify in Chrome.
4. **Game-over review card + routine performance.** Replace the one-line game-over text with a
   review card rendering the just-finalized record (blame list + encouraging GAME_DESIGN framing
   + "Start New Base" CTA). Add the per-routine rollup view to the Stats window (routine rows
   across runs — the A/B comparison surface). Live-verify in Chrome (real base death).
5. **Polish (optional — cut if play data says otherwise).** Best-run highlight/personal record
   badge, expandable run cards, "vs last run" deltas on the current-run panel.

Testing per established convention: pure helpers get Jest (sandbox $HOME method); DOM/UI paths
get live Chrome verification against the real server. Every sub-session ends with the full suite
green + `node --check` on touched files.

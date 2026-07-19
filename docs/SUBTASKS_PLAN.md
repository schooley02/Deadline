# Sub-task Hierarchy Plan — [P1-DATA-004] (Milestone 3)

Planning session 2026-07-19 (session 46, Cowork, Fable). Sequences the "sub-task hierarchy system"
roadmap item into one-system-per-session steps, mirroring `NEGATIVE_HABITS_PLAN.md` /
`FROZEN_SLOTS_PLAN.md` / `HEROES_PLAN.md`. Source of truth: `docs/MECHANICS.md` "Sub-tasks"
(incl. the now-RESOLVED open tension at its end), PROJECT_SPEC.md ~39-41 (growing/shrinking parent,
dependent due dates), ~594-620 (sub-task management UI states), ACTIONABLE_TICKETS.md [P1-DATA-004].

**Line numbers WILL drift — always re-Grep before trusting them.**

---

## Live playtest findings (session 46, real server, Chrome) — what's ALREADY built vs broken

Already built and working: "+ SUB-TASK" button on top-level agenda rows → creation modal
pre-filled with the parent's due date/time; `parentId`/`subTasks[]`/`completedSubTasks`/
`totalSubTasks` persisted (current save schemaVersion 9); nested-only agenda rendering
(MECHANICS.md); 64px clustered sprites fanning right/left off the parent's visible edges;
sub-completion updates parent counters; `if (parentTask)` guards mean orphan operations don't
throw.

Broken/missing (drives the sub-sessions below):
1. **Orphan hole:** completing a parent with open sub-tasks is allowed, pays full reward, and
   leaves each child as a battlefield-only zombie — no agenda row exists for it (nested-only
   rendering), it still damages the base, and only a sprite click can reach it. `removeItem` has
   the same gap on the delete path (no cascade).
2. **Economy:** each sub-task pays a FULL task reward (10 XP / 10 pts) — a 3-sub task is worth 4×
   a standalone task.
3. **Due dates:** inherited at creation only; nothing stops a sub due AFTER its parent, and parent
   deadline edits never touch children.
4. **No parent sizing:** parent renders at fixed `CONFIG.ENEMY_WIDTH` (128) regardless of sub count.
5. (Minor, polish) Sub-tasks never appear in the "Completed Today" list; a left-fanning sub sprite
   can hide behind the base zone when the cluster sits at the base edge.

---

## Design forks — RESOLVED 2026-07-19 session 46 (Jeremy's verdicts)

1. **Parent sizing = BOTH: scale the parent AND keep clustered sub-sprites.** Parent grows per
   open sub-task and shrinks back toward 128px as subs complete ("completing sub-tasks weakens the
   parent"); the session-2026-07-17 visible-edge clustering stays. This resolves the MECHANICS.md
   open tension: both effects together, nothing dropped.
2. **Parent completion is BLOCKED while sub-tasks remain open.** Parent checkbox disabled with an
   "N sub-tasks remaining" affordance. Closes the orphan hole at the source: children can no
   longer be stranded by completion. (Deletion cascade — ticket acceptance criterion, no fork —
   closes the other strand.)
3. **Due dates: default AND latest = parent's deadline; earlier is allowed, later is not.**
   (Jeremy's own wording.) Clamp enforced at sub creation and sub edit. Corollary decided with it:
   if a parent's deadline is pulled EARLIER than a child's date, the child re-clamps down to the
   new parent deadline; pushing the parent later leaves children where they are (they're now
   "earlier", which is legal). NOT the delta-shift model.
4. **Sub-task economy = half value: 5 XP / 5 pts per sub.** Parent keeps the full 10 (+ the
   high-priority ×2 rule on its own flag; a sub's ×2 applies to the SUB's own priority flag).
   New CONFIG numbers, landed via the balance protocol + DECISIONS.md.

**Scope guards (stated assumptions):**
- **Depth stays 1.** The schema tolerates grandchildren (`subTasks[]` exists on every task) but
  the UI only offers "+ SUB-TASK" on top-level rows — deliberate, unchanged. Document, don't build.
- Sub-tasks are TASK-type only. Habits and routine-owned tasks don't get sub-tasks — unchanged.
- **No schema bump.** All persisted fields already exist (schemaVersion stays 9); parent size is
  DERIVED from open-sub count, never stored. Pre-existing orphans in old saves are repaired by a
  restore-time sanitizer (sub-session 1), which changes no shapes.
- Spec's drag-and-drop reordering, connecting lines, and "dependency mapping" stay P2 — not this
  ticket.

---

## What this builds on (already exists)

| Need | Where |
|---|---|
| Creation + counters + guards | `js/items.js` `createTaskItemData` (parentId param, creation-time inheritance), `completeItem`/`uncompleteItem` (counter sync + relink) |
| Deletion path to cascade | `js/items.js` `removeItem` |
| Due-date edit machinery | `js/items.js` `recomputeOverdueStateAfterEdit` (~980) — re-clamped children route through it per child, same as a manual edit |
| Sub creation UI | `js/ui/popups.js` `createSubTaskPrompt`/`showCreateSubTaskModal` (form gets max/default = parent deadline) |
| Cluster offset math | `js/movement.js` `getSubTaskClusterOffset` (+ `CONFIG.ZOMBIE_VISIBLE_MARGINS` — parent scaling multiplies the parent's visible-edge margins; re-measure nothing, just scale) |
| Points seam | `js/economy.js` `taskPoints(isHighPriority, pointsPerTask)` — pass the sub rate in, ×2 rule comes free |
| Agenda nested rendering | `js/ui/agendaList.js` (nested-only rule, parent row progress label lands here) |
| Config + balance protocol | `js/config.js` `SUBTASK_ENEMY_WIDTH`/`SUBTASK_CLUSTER_GAP_PX`/`SUBTASK_AHEAD_THRESHOLD_PX`; new numbers below |
| Restore path (sanitizer hook) | `js/state.js` `restoreGameState` (same place day-rollover settlement runs) |

---

## Proposed balance/config numbers (finalize via balance-tuning in the landing sub-session)

- `SUBTASK_XP = 5`, `SUBTASK_POINTS = 5` (half of `xpPerTask`/`pointsPerTask` 10; high-priority ×2
  applies to the sub's own flag → max 10, still ≤ a standalone task)
- `PARENT_GROWTH_PER_SUB = 0.15` (parent width = `ENEMY_WIDTH × (1 + 0.15 × openSubs)`, so 1 sub
  → 147px, 3 subs → 186px), `PARENT_GROWTH_MAX_SUBS = 4` (cap ~1.6× = 205px — keeps the sprite
  inside the lane; >4 open subs adds no further size)
- Shrink/grow animates via CSS transition (~300ms) — display constant, not balance

---

## Session sequence (each ends green + committed; ONE sub-session per session)

### Sub-session 1 — completion/deletion rules core + orphan sanitizer (Sonnet) — ✅ BUILT 2026-07-19 session 47
**Goal:** no path can create an orphan, and old saves are repaired. Pure logic + tests, no visuals.
- `completeItem`: refuse (result-object style, shop.js pattern) when `item.subTasks.length > 0`;
  agenda checkbox + popup checkbox render disabled with "N sub-tasks remaining" tooltip/label.
- `removeItem`: cascade — deleting a parent removes its children (sprites, list rows, activeItems);
  deleting a SUB updates parent counters (`totalSubTasks`/`subTasks`) without marking it completed.
- Restore-time orphan sanitizer in `restoreGameState`: any active item whose `parentId` doesn't
  resolve to an active item is PROMOTED to standalone (`parentId = null`) so it regains an agenda
  row. Runs before rendering; no schema change.
- Tests: block/allow matrix (0 subs, open subs, subs-then-completed), cascade both directions,
  counter sync on sub-delete, sanitizer promote + idempotence, uncomplete-parent relink unchanged.
- **Live-verify (Chrome):** parent checkbox disabled until both subs done then completes normally;
  deleting a parent sweeps child sprites; a hand-crafted orphan save promotes on reload.

**BUILT as specified.** `Items.completeItem` refuses (`{ ok: false, reason: 'subtasks_remaining',
remaining: N }`) when a task has open `subTasks`; `Items.removeItem` now cascades recursively in
both directions (parent delete sweeps children via a live `parentId` lookup, not just the parent's
own `subTasks` array — so a desynced array can't leave a dangling sprite; sub delete syncs
`subTasks`/`totalSubTasks` without touching `completedSubTasks`) and gained two new OPTIONAL deps
(`createListItem`/`sortAndRenderActiveList`) so older call sites (day-token settlement, rollover,
routine-clearing) keep working unchanged with their smaller deps shape. `State.sanitizeOrphanedSubTasks`
(new pure function) runs in `restoreGameState` right after every saved item re-enters `activeItems`
and before the existing parent-list-item rebuild — promotes any item whose `parentId` doesn't
resolve to a live parent TASK to standalone and returns it for `createListItem` (which
`Spawning.addItemToGame` skipped while `parentId` was still set). **state.js had no
`module.exports` before this session** — added one (guarded, matching every other `js/*.js`
module) purely so the sanitizer is unit-testable; safe for Node `require` since the file's only
`window.`/`document.` reference lives inside `restoreGameState`'s body, not at load time. UI:
agendaList.js's and popups.js's "Mark as Complete" checkboxes are disabled with a
"N sub-tasks remaining" title/label when a parent has open subs (proactive half; completeItem's
guard is the backstop). 36 suites, 761/761 (+17: new `test/subtask-lifecycle.test.js`). `node
--check` clean on all four touched files. **Live-verified in Chrome against the real running
server:** created a real parent + 2 subs — parent checkbox showed disabled "(2 remaining)" in both
the agenda row and the popup at every open-sub count; completed both subs, parent auto-enabled with
no reason label, completed normally (30 XP/30 pts total — sub-session 3's half-value economy isn't
built yet, so subs still pay full value); the deletion cascade itself has no live UI trigger (no
"Delete Task" affordance exists anywhere in the app — confirmed by grep, ticket's cascade
criterion is scoped to internal `removeItem` correctness) so it's covered by the Jest suite only;
the orphan sanitizer was live-verified end-to-end by editing `localStorage`'s save to sever a
sub-task's `parentId` (simulating a pre-cascade-era orphan) and reloading — the sub-task came back
as a normal top-level agenda row with its own checkbox and "+ SUB-TASK" button, `parentId: null`
confirmed in the reloaded save. Zero app console errors (only the recurring extension messaging
noise). Dev save reset clean afterward.

### Sub-session 2 — dependent due dates (Sonnet)
**Goal:** Jeremy's clamp model, end to end.
- Sub creation/edit forms: date/time inputs get `max` = parent deadline, default stays parent
  deadline (already the case at creation); reject later values on save (form validation, not
  silent clamping, on manual entry).
- Parent deadline edit: if pulled earlier, each child later than the new deadline re-clamps to it,
  routed through `recomputeOverdueStateAfterEdit` per child (overdue flags/damage state stay
  correct for free); pushed later → children untouched.
- Tests: creation clamp, edit clamp, parent-pull re-clamp (incl. overdue transitions both ways),
  parent-push no-op, sub already earlier than new deadline untouched.
- **Live-verify (Chrome):** form refuses a later date; pulling parent's deadline earlier visibly
  re-clamps the child (agenda + save), zombie positions/overdue state correct.

### Sub-session 3 — sub-task economy (Sonnet)
**Goal:** half-value subs through the existing seam.
- `completeItem` awards `SUBTASK_XP`/`Economy.taskPoints(item.isHighPriority, SUBTASK_POINTS)` for
  items with `parentId`; uncomplete refunds symmetrically (stamp pattern from heroes if needed —
  a sub's parentId can't change, so the simple branch may suffice; decide in-session).
- Balance-tuning protocol + DECISIONS.md entry for the new numbers.
- Tests: award/refund symmetry for subs, high-priority sub ×2, parent unchanged at 10, standalone
  unchanged.
- **Live-verify (Chrome):** completing a sub pays 5/5, uncomplete refunds exactly; parent still 10.

### Sub-session 4 — growing/shrinking parent visuals (Sonnet)
**Goal:** the resolved fork's visual half.
- Parent render width derived per frame from open-sub count (`PARENT_GROWTH_PER_SUB`, capped);
  CSS transition for smooth shrink on each sub completion; z-index rules unchanged.
- `getSubTaskClusterOffset`: scale the PARENT's visible-margin contribution by the same factor so
  the fan stays attached to the visible graphic edge at any size (sub margins unchanged).
- Timeline x / bottom-alignment math re-checked at scaled sizes (feet stay on the ground line).
- Tests: pure width-derivation math (growth, cap, shrink-on-complete); offset math at scale.
- **Live-verify (Chrome):** add 3 subs → parent visibly larger with attached fan; complete subs →
  smooth shrink to 128px; no sprite drift at either extreme.

### Sub-session 5 — polish (Sonnet, OPTIONAL — cut if play data says stop)
- Parent agenda row progress label ("2/3 sub-tasks", live).
- Completed subs render (nested, greyed) under the parent's Completed Today entry.
- Left-fan off-field guard: when the cluster sits at the base edge, flip left-fan subs right (or
  clamp x ≥ base width) so no sub hides behind the church.

---

## Doc updates owed when sub-sessions land (same-session rule)
- MECHANICS.md "Sub-tasks": replace the "Open tension" paragraph with the resolved both-effects
  model; add completion-block, clamp model, economy numbers as they land.
- ECONOMY.md: sub-task point values (sub-session 3).
- UI_UX.md: progress label + Completed Today nesting (sub-session 5, if built).

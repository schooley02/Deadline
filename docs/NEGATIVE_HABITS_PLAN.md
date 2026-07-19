# Negative Habits Plan ([P1-DATA-005] — Milestone 3)

Planning session 2026-07-19 (session 25, Opus). Sequences the 5-point "positive/negative habit
distinction" ticket into small, one-system-per-session steps, mirroring `SHOP_PLAN.md` /
`UI_EXTRACTION_PLAN.md`. Source of truth for behavior is `docs/MECHANICS.md` (Habits: Positive &
Negative), `docs/ECONOMY.md` (points can go negative), and `docs/ROUTINES.md` (daily check-in +
frozen-slot recovery). The polarity seam already exists — `Habits.occurrenceSuccess(isNegative,
event)` — and this ticket fills it in.

**Line numbers below WILL drift — always re-Grep before trusting them.**

---

## Key recon finding (2026-07-19): this ticket is NOT greenfield

The handoff framed P1-DATA-005 as the 3-week-scale ticket. A Chrome + code recon shows a large
share of the *scaffolding* is already in place from earlier sessions (mostly session 16's rate-based
rework, which deliberately built the seam). What is missing is the **differentiated behavior**, not
the plumbing. Concretely:

**Already built (verified this session):**

| Piece | Where | State |
|---|---|---|
| Positive/Negative toggle in Add-New-Habit form | habit create form (`js/ui/forms.js`) | Live — renders "Positive: complete to earn points" / "Negative: avoid to earn points" |
| Same toggle in the edit-habit editor | edit path; syncs instance `isNegative` on save | Live (MECHANICS.md line ~44) |
| `isNegative` on the habit definition + instance | `Habits.createHabitInstanceData` sets `isNegative: habitDef.isNegative` (`js/habits.js` ~288) | Threaded end-to-end |
| CSS hook for negative enemies | `itemElement.classList.add('negative-habit')` (`js/items.js` ~292) | Class applied; styling may be stub |
| The polarity routing seam | `Habits.occurrenceSuccess(isNegative, event)` (`js/habits.js` ~144) | **Polarity-agnostic today** — both polarities map completed→success, overdue→miss |
| Negative-balance reservation | `Economy.subtractPoints` clamps at 0; header NOTE reserves a non-clamping "indulgence" path (`js/economy.js` ~19-23, 39) | Documented, unbuilt |
| Doc alignment | MECHANICS / ECONOMY / ROUTINES all already describe intended negative behavior | Consistent |

**What actually remains (the ticket):**

1. An **"indulged" event + player action** — a way to record "I lapsed on this negative habit
   today," routed through `occurrenceSuccess`, that records a miss AND loses points.
2. **Inverted enemy/overdue semantics for negative habits** (the crux — see Fork A). Today a habit
   going overdue records a miss and damages the base. For a negative habit, *running out the day
   without indulging = SUCCESS* (earn points, no base damage). The enemy behavior itself has to
   invert.
3. **Negative balance** — a non-clamping indulgence path in `Economy`, plus debt-state
   visualization + recovery-suggestion UX (MECHANICS/GAME_DESIGN both promise this).
4. **Daily check-in prompt** — morning/first-login confirmation of avoidance for each active negative
   habit (ROUTINES.md line ~35). Note: this is the validation surface the frozen-slot ticket later
   builds on, but frozen slots themselves are a SEPARATE later ticket — build only the check-in here.
5. **Day-tokens** (Cheat / Sick / Skip Day, 200 pts each) — deferred out of the shop ([P1-UI-008])
   *specifically to ride with this ticket*, because Cheat Day = "1 day negative-habit indulgence
   without penalty" and needs the indulgence mechanic to exist first (ECONOMY.md lines ~26-28).
6. Tests for all of the above.

---

## Design forks — resolve on Fable BEFORE the sub-session that needs them

Per the model strategy, batch these into ONE Fable session (they interact) rather than deciding them
piecemeal. They are expensive to get wrong and reshape architecture. Recommended: hold the Fork
session right before Sub-session 2.

> **ALL THREE FORKS RESOLVED — 2026-07-19 session 26 (Fable, Jeremy's verdicts; full rationale +
> rejected alternatives in DECISIONS.md session 26):**
> - **A = A2 with an idle "lurker" zombie.** Never advances, no base damage, no overdue path. Tap →
>   "I indulged" → immediate points loss + streak zero. Unresolved days settle at next morning's
>   check-in (spec's binary avoided/indulged cards); days older than the previous day default to
>   avoided. A1 rejected as semantically broken (game can't observe indulgence; time expiring =
>   success for a negative habit).
> - **B = unbounded debt, fully orthogonal to base health, no clearing deadline.** Debt's function is
>   keeping indulgence costly at 0 balance, not punishment. Red HUD + agency-framed nudge ("−12 ·
>   complete 2 tasks to break even"). Shop self-gates via canAfford. Recovery-plan UI deferred to run
>   review. Channel separation principle: HP = deadline failures, points = behavior costs, frozen
>   slots = sustained patterns.
> - **C = Cheat Day only.** 200 pts, held-inventory exponential pricing. Active cheat day ⇒
>   indulgence costs nothing and NO occurrence is recorded (day excused — not success, not miss);
>   streak preserved, not incremented. Sick/Skip deferred to the frozen-slots ticket (spec ambiguity
>   on per-habit vs global + interaction with recovery streaks).
>
> The original fork descriptions below are retained for context. Sub-sessions 2–5 are UNBLOCKED and
> updated with these decisions.

**Fork A — the core interaction & enemy model for a negative habit (the expensive one).**
A negative habit is a temptation to resist. Two coherent models:
  - *(A1) Advancing temptation:* the negative-habit zombie advances toward the base like a positive
    one; reaching the base = you caved = auto-indulge (lose points + base damage). Player can also
    press "I indulged" early. Surviving to end-of-window = avoided = success. Pro: reuses movement +
    overdue timing wholesale; the zombie's approach is real pressure. Con: "reaching base = failure"
    is the *opposite* meaning from positive habits, and base damage on a lapse may be too punishing
    on top of point loss.
  - *(A2) Idle temptation + explicit lapse:* the negative-habit enemy sits/idles (no base-damage
    timer); avoidance auto-succeeds at day rollover; the ONLY negative event is the player pressing
    "I indulged," which costs points and records a miss but does NOT damage the base. Pro: cleaner
    semantics, decouples debt from base HP. Con: less visual tension; needs a rollover-success path
    distinct from the overdue path.
  This decision determines whether base-damage code is reused or bypassed for negative habits and is
  the single most architecture-shaping call in the ticket. **Needs Fable.**

**Fork B — negative-balance depth & recovery UX.**
How far can debt go (floor, or unbounded)? What does the debt state look like (MECHANICS promises
"clear visualization + recovery plan suggestions")? Does debt gate anything (e.g., shop purchases)?
Design + light balance. **Fable, batched with A.**

**Fork C — day-token scope for this ticket.**
All three tokens (Cheat/Sick/Skip) now, or just Cheat Day (the one the indulgence mechanic strictly
needs) with Sick/Skip deferred? Each token also needs a "1 day" application model (how a token
suspends/pauses a habit for a day — new persisted per-habit state + likely a schema migration).
**Fable, batched with A.** Balance numbers (all 200 pts today) go through the balance-tuning skill if
touched.

Until these are resolved, sub-sessions 2+ are not safe to execute. Sub-session 1 (below) is
fork-independent and can proceed on Sonnet immediately.

---

## What this ticket builds on (already exists)

| Need | Where it already is |
|---|---|
| Polarity seam | `Habits.occurrenceSuccess(isNegative, event)` — add an `'indulged'` case here; nothing else in the rate math changes (`js/habits.js` ~144) |
| Completion / overdue / uncompletion appliers | `Habits.applyHabitCompletion/Overdue/Uncompletion` already take `isNegative` (`js/habits.js` ~199/221/241); called from `js/items.js` ~156/365/405 |
| Occurrence recording | `recordOccurrence` / `removeOccurrence` / `successRate` / `pointsMultiplier` — pure, tested (`js/habits.js`) |
| Points spend/refund | `Economy.addPoints` / `subtractPoints` (0-floor today) — `js/economy.js`; needs a sibling non-clamping path for indulgence |
| `isNegative` state | on `definedHabits[]` and each spawned instance; persisted; synced on habit edit |
| Negative enemy CSS hook | `.negative-habit` class already applied in `js/items.js` ~292 |
| Habit config | `CONFIG.HABIT_RATE_*`, `pointsPerHabit`, `xpPerHabitComplete` — `js/config.js`; new negative-habit numbers go here, never hardcoded |
| Persistence + migration | current `SCHEMA_VERSION` = **4** (save confirms `schemaVersion: 4`); day-tokens/per-habit token state likely needs 4→5 |
| Shop plumbing (for day-tokens) | `js/shop.js`, `js/ui/shopView.js`, `CONFIG.SHOP_ITEMS` — day-token entries can slot into the existing shop card pattern |
| Daily check-in surface | none yet — new; ROUTINES.md ~35 is the spec |

---

## Session sequence (each ends green + committed; ONE per session for anything touching persistence/balance)

### Sub-session 1 — `'indulged'` event in the pure seam (Sonnet, fork-independent) — ✅ DONE 2026-07-19 session 25
**Goal:** add the polarity-aware `'indulged'` outcome to `Habits.occurrenceSuccess` and a pure
appliers path for an indulgence, WITHOUT wiring any UI or economy side effects yet. Pure-core only,
so it's safe to land before the forks are resolved.
- `js/habits.js`: extended `occurrenceSuccess(isNegative, 'indulged')` — returns `false` (a miss) for
  either polarity; added a pure `applyHabitIndulgence(currentStreak, occurrenceHistory, isNegative,
  originalDueDate, config)` — no-ops (streak/history unchanged, `pointsLost: 0`, `noOp: true`) for a
  positive habit; for a negative habit records the miss, zeroes the visual streak, and computes
  `pointsLost` from the POST-record rate multiplier (same convention `applyHabitCompletion` uses for
  `pointsGained`, so a future "undo indulge" could mirror `applyHabitUncompletion`'s
  recompute-then-pop symmetry).
- `test/habits.test.js`: 6 new cases — `occurrenceSuccess` indulged routing (both polarities), the
  positive no-op, negative miss-recording + streak zeroing, 1x/1.5x multiplier scaling, and the
  same-day upsert-over-a-completion case.
- No `items.js`/UI/economy changes. No schema change. **19 suites, 413/413** (was 407 — +6). `node
  --check js/habits.js` clean. Run via the sandbox-copy method (`package.json`/`jest.config.js`/`js`/
  `test` copied to scratch, `npm install` + `npx jest` there — never in the mounted folder).
**Why first:** it's the one piece that's purely internal, fully unit-testable, and every later
sub-session depends on it. Good cheap Sonnet win that de-risks the seam.

### — FABLE FORK SESSION (resolve A + B + C, log all to DECISIONS.md) —
Batch the three forks. Output: the chosen negative-habit interaction model, the debt model, and the
day-token scope — enough to make sub-sessions 2-5 execution work. Update this plan doc with the
decisions.

### Sub-session 2 — lurker zombie + indulge action wired end-to-end (Opus plan → Sonnet)
**Goal:** implement the A2 lurker model. Negative-habit instances spawn a NON-advancing zombie at a
fixed lurk position near the fence (`.negative-habit` tint already applied); they are excluded from
the overdue/base-damage path entirely (`markAsOverdue` must skip negative instances — this is the
main items.js surgery). Enemy-click popup for a negative habit shows "I indulged" instead of the
task actions → wires `Habits.applyHabitIndulgence` (session 25) into `items.js` + points debit +
agenda re-render + save. End-of-day: negative instances do NOT resolve at rollover — they carry as
"unresolved" for the check-in (sub-session 4); until 4 lands, an interim decision is needed on what
the rollover does with them (recommend: hold the instance, no occurrence recorded — check-in will
settle it). Live-verify in Chrome (create negative habit → lurker spawns, never moves, no damage
ticks; indulge → points drop, streak zeroes, zombie exits). Depends on Sub-session 1. **Note:** the
points debit here still goes through the 0-floored `Economy.subtractPoints` until sub-session 3
lands the non-clamping path — acceptable interim (debt just can't go below 0 for a few sessions).

### Sub-session 3 — unbounded debt + encouraging debt UX (Opus plan → Sonnet)
**Goal:** add `Economy.applyIndulgenceCost` (or similar) — the non-clamping sibling reserved by the
economy.js header NOTE; switch sub-session 2's debit to it. Uncompletion refunds KEEP the 0 floor.
Points HUD renders negative balances in red with the agency-framed nudge ("−12 · complete 2 tasks to
break even" — derive N from pointsPerTask, no new tunables). No shop gating changes (canAfford
already handles it). NO recovery-plan UI (deferred to run review — see DECISIONS.md session 26).
Tests: indulgence subtracts below 0; refunds still floor; nudge math. Persistence: playerPoints
already persists as a plain number — verify a negative value round-trips (should be free, but test
it).

### Sub-session 4 — daily check-in prompt (Opus plan → Sonnet)
**Goal:** first-open-of-a-new-day prompt: one card per UNRESOLVED negative habit from the previous
day, binary "Successfully avoided" (→ success occurrence + points + defeat explosion for a still-
lurking zombie) / "I indulged" (→ retroactive miss via applyHabitIndulgence). Days older than the
previous day auto-resolve as avoided (generous default, session 26). Spec details worth honoring
cheaply: PROJECT_SPEC.md ~640 (snooze link "I'll check this later"; skip = re-prompt later, not
auto-resolve). Build ONLY the check-in surface — NOT frozen slots (separate ticket). Depends on
Sub-session 2.

### Sub-session 5 — Cheat Day token (Sonnet; 4→5 schema migration lands here)
**Goal:** add Cheat Day to `CONFIG.SHOP_ITEMS` (200 pts base — spec face value, unchanged; held-
inventory exponential pricing like repair kits, `consumable: true`). "Use" targets a negative habit
(reuse the pushback tap-a-zombie targeting pattern from shop sessions 3–4, incl. the shopView hint
card + the setTimeout(0) hazard check). Active cheat day = persisted per-habit-per-day state (the
4→5 migration — its own session per the one-persistence-change-per-session guardrail): while
active, "I indulged" costs nothing and records NO occurrence (day excused; streak preserved, not
incremented) — and the check-in card for that day auto-resolves as excused. Sick/Skip: NOT in this
ticket (session 26 — deferred to frozen slots). Depends on Sub-sessions 2+3 (needs the indulge
action + the real debit path).

---

## Guardrails reminder
- ONE roadmap task (here: one sub-session) per session for persistence/architecture/balance work.
- Update MECHANICS.md / ECONOMY.md / ROUTINES.md / DATA_SCHEMA.md in the SAME session as any
  mechanic/schema change; log design calls to DECISIONS.md.
- Balance numbers (token prices, indulgence point loss, debt floor) go through the balance-tuning
  skill and `js/config.js` — never hardcoded, never changed silently.
- Never read `script.js` or `PROJECT_SPEC.md` whole — Grep the ranges each sub-session names.

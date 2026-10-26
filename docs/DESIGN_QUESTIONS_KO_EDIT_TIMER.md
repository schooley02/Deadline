# KO ghosts, distance-priced rescheduling, work & limit timers — decisions + build plan

Raised by Jeremy 2026-10-25 while integrating the Other Hero art. **DECIDED 2026-10-25 (Claude app session, Fable, balance-tuning protocol; DECISIONS.md 2026-10-25 "Design batch").** Numbers live in `js/config.js` (added as data this session; NOTHING reads them yet). Nothing below is built; the build order is at the bottom.

## Already decided 2026-10-25 (earlier that day)
- Hero KO ANIMATION is not faded: plays as drawn, once, holds its last frame 3 s, restarts.
- KO'd state IS faded on the small things: tray/tab/list avatars (head crops).
- A KO'd routine's habits and tasks stay visible as faded ghosts on the canvas AND in the list ("at-a-glance" principle). Today KO removes them (`clearActiveInstancesForRoutine`, ROUTINES.md "pure removal"). Reuse the day-pager ghost sprites/rows (`js/ui/dayPagerView.js`, `css/dayPager.css`).

---

## Q1 — KO ghosts vs streaks → **C, narrowed**

**Decision.** While a routine is KO'd its habits and tasks are real, inert, *completable* ghosts:
- **Completing a ghost** pays normal XP and, for habits, a normal SUCCESS occurrence (streak++, rate window intact). It pays **0 points** (`CONFIG.KO_GHOST_POINTS_FACTOR = 0`): the routine's economy is down; that is the KO's cost. No hero-health restore from ghost completions (revive stays a calendar gate, session 41).
- **Leaving a ghost undone** is EXCUSED, exactly like a Sick/Skip Day: no miss occurrence, no streak reset, no base damage, no routine damage. The day simply isn't scored.
- **Ghosts never attack.** They are parked at their due-time position and marked inert (`isNonThreatening`-style flag, see sub-fork "position"); `markAsOverdue` is a no-op for them, the overdue loop skips them, offline catch-up skips them.
- **Items already overdue at KO** keep the misses they already recorded (that damage caused the KO); from the KO moment they become ghosts like the rest.
- **Exploit check:** a deliberate KO is strictly worse than staying up — slots lost (auto-deactivation), zero points for the day, half health on revive — while the only "gain" (no misses) is also available by just doing the habits.

**Rejected.** A (visual only, uncompletable): throws away real-life follow-through, contradicts "do the thing" as the core loop. B (ghosts record misses): double-punishes a routine the game already benched; "what-the-hell" effect.

**Sub-forks.**
- *Position:* ghosts keep the normal timeline position by due time (same math as live items) but never get `enemy-at-base`; after the due time they park beside the base like lurkers (`lurker-parked` look, reuse that CSS hook).
- *Visual:* reuse `.time-preview-ghost` (opacity + `grayscale(.85)`), plus a 💤 badge (NOT on `::before`/`::after` — those are claimed; add a tiny sibling element like the stack "+N" badge).
- *Tap (canvas):* popup header "Knocked out — revives tomorrow", body = the normal item popup with a working **Complete** button; no pushback / cheat-day buttons.
- *List row:* greyed row, checkbox ENABLED (completion path), due-time text replaced by "KO'd · excused today"; no edit pencil while KO'd.
- *Duration:* until revive. At day rollover a ghost positive habit is dropped with NO miss (new branch next to the "positive habit → dropped" rule in MECHANICS.md "Day Rollover"); ghost one-off tasks survive rollover as ghosts (they are not per-day) and become live threats again only on revive.
- *Revive:* reactivation spawns today's instances as today (ROUTINES.md); any surviving ghosts are converted back to live items with a clean-slate damage clock (`lastDamageTickTime = now`, the edit/undo precedent) — no back-charge for the KO'd days.
- *Negative habits in a KO'd routine:* lurkers are already non-threatening; they ghost like the rest (faded), the arrival popup still fires (self-report is the only signal), indulged still records a miss (a lapse is a lapse).

---

## Q2 — Reschedule limits → **distance-priced rescheduling, no Edit token**

**Decision.** Editing a one-off task's (or sub-task's) due time LATER costs points when it happens close to the deadline. The price is the existing pushback tier for the distance moved (1 h → 50, 2 h → 100, 1 day → 300, rounded UP to the next tier; the level discount applies) × a zone factor read from the time-to-current-due *at the moment of saving*, using the same urgency zones as the walk animation (`Clock.getWalkUrgencyTier`):

| Zone (time to current due) | Factor (`CONFIG.RESCHEDULE_ZONE_FACTORS`) | 1 h slip costs |
|---|---|---|
| calm, > 4 h | 0 (free) | 0 |
| approaching, 2–4 h | 0.5 | 25 |
| urgent, < 2 h | 1 | 50 |
| overdue | 1 | 50 |

- **Always free:** moving earlier; any edit within `RESCHEDULE_GRACE_MS` (10 min) of the item's creation (typo fix); the first paid-zone reschedule in each rolling 7-day window (`RESCHEDULE_FREE_PER_WEEK = 1`, per player, tracked by a timestamp list on the save); habit time-of-day edits (they are definition edits — MECHANICS.md 2026-10-21 rule stands).
- **Affordance:** the edit modal shows "This move costs N pts" (or "free") live as the date/time fields change; Save is BLOCKED with the shop's "not enough points" message if unaffordable. Rescheduling NEVER creates debt — negative balance stays reserved for indulgence.
- **Shop pushback stays** at the same price and effect: it is now the one-tap version of the same transaction, no longer dead content.
- **Reflection:** `item.rescheduleCount` (+1 on any later-move, paid or free) → "Rescheduled N times" on the game-over blame list and the Stats window; `RunStats.recordReschedule`.
- **Laundering check:** pricing by time-to-*current*-due means "move earlier, then later" only lands in a pricier zone. Setting far-out due dates at creation and pulling them in stays free — accepted (planning loosely is legitimate; the game prices failure, not caution).

**Rejected.** Edit token (new inventory item + price + UI for something pushback already is). Charging all later-edits (drives fake dates / quitting). Free weekly allowance > 1 (makes the paid zone rare enough to be noise).

**Numbers added to config (balance-tuning protocol):** `RESCHEDULE_ZONE_FACTORS { calm: 0, approaching: 0.5, urgent: 1, overdue: 1 }`, `RESCHEDULE_GRACE_MS 600000`, `RESCHEDULE_FREE_PER_WEEK 1`. Distances reuse `CONFIG.SHOP_ITEMS` pushback rows — no new prices.

---

## Q3 — Timers → **work timers (tasks + positive habits) and limit timers (negative habits)**

**Decision.** One running timer at a time, stored as a START TIMESTAMP (`item.timer = { startedAt }`), never as counted ticks (DECISIONS 2026-07-18 Decision 2: wall-clock, never tick counters); elapsed = now − startedAt (+ `item.timerMsBanked` from earlier stop/starts the same day). Survives reload. Schema 13 → 14.

**Work timer** (one-off tasks, routine tasks, positive habits):
- Start/Stop from the item popup and the list row. While running: the owning routine's hero (or the Other hero for standalone items) is spotlit in front of the church playing the **Attack** row (atlas row 2, already shipped) instead of idle; the scrim stays off so the board remains readable.
- **Overdue damage is HALVED while the timer runs** (`CONFIG.WORK_TIMER_DAMAGE_FACTOR = 0.5`) — never zero (a running timer must not be a free pass). Routine damage likewise halved. Offline/live-gap catch-up ignores the timer (you weren't working).
- **Anti-forget:** at `WORK_TIMER_CHECK_MS` (60 min) of continuous running the game asks "Still working on <item>?" (Modal, never native); no answer within `WORK_TIMER_AUTO_STOP_MS` (10 min) auto-stops the timer and banks the time up to the prompt.
- **Optional target:** `habitDef.timerMinutes` / `taskDef.timerMinutes` (and `item.timerMinutes` for one-offs). Reaching the target completes the item through the normal `completeItem` path (toast "30 min done"). Without a target the timer only logs time; completion stays manual.
- **Stats:** `item.timerMsBanked` is summed into `currentRunStats.workMsTotal` on completion (sub-session 3, not v1 UI).

**Limit timer** (negative habits, "social media ≤ 30 min"):
- `habitDef.timerMode = 'limit'` with a required `timerMinutes` budget. The lurker's popup gains **Start**; the budget counts DOWN. **Stop inside the budget → Avoided** (`Items.completeItem` → success occurrence, streak++, points as today). **Budget expires → the existing "Time's up" arrival popup** (`CheckIn.queueArrivalPrompt`) asks Avoided / I indulged / Later — "indulged" means you went over, same economics as today. Starting the limit timer counts as the day's arrival prompt (sets `arrivalPromptedFor`), so the time-of-day prompt doesn't ALSO fire.
- No damage interaction (lurkers never damage). One at a time shares the single-timer rule.

**Rejected.** Zero damage while working (obvious leave-it-running exploit). Pomodoro/break scheduling (scope). Habits excluded (Jeremy: limit habits are the clearest timer case).

**Numbers added to config:** `WORK_TIMER_DAMAGE_FACTOR 0.5`, `WORK_TIMER_CHECK_MS 3600000`, `WORK_TIMER_AUTO_STOP_MS 600000`.

---

## Schema 14 (planned, DATA_SCHEMA.md "Target" section)
- `item.timer: { startedAt: ISO } | null`, `item.timerMsBanked: number` (default 0), `item.timerMinutes: number | null` (one-offs), `item.rescheduleCount: number` (default 0), `item.koGhost: boolean` (true while the owning routine is KO'd; derived on KO/revive, persisted so a reload can't un-ghost).
- `habitDef.timerMode: 'work' | 'limit' | null`, `habitDef.timerMinutes: number | null`; same two fields on routine `taskDefinitions`.
- Save root: `rescheduleFreeUses: [ISO…]` (rolling 7-day window, pruned on write).
- Migration 13 → 14: fill defaults; `koGhost = false` everywhere (no routine is KO'd with live items under the old rule).

## Build order (each its own session; Sonnet unless noted)
1. **KO ghosts (first).** `js/routines.js` KO path stops recalling instances and flags them `koGhost`; spawn/loop/overdue/catch-up/rollover guards; completion path (0 pts, success occurrence); revive conversion with clean-slate clocks; canvas + list ghost rendering; popup variant; tests. Schema 14 lands here (all fields, defaults). sw.js bump. — Sonnet, medium (Opus if the loop guards get tangled).
2. **Distance-priced rescheduling.** Pure `Economy.reschedulePrice(now, currentDue, newDue, createdAt, discount, freeUsesLeft)`; wire `Popups.showEditTaskModal` / sub-task editor / `uncompleteItemWithDuePrompt` picker; live price line; block on unaffordable; `rescheduleCount` + stats line; tests. — Sonnet, medium.
3. **Work timer.** Timer core (`js/timer.js`, pure), popup + row controls, hero Attack spotlight variant, damage factor in `js/loop.js` + `Items.damageRoutineForItem`, still-working prompt, target auto-complete, tests. — Sonnet, medium.
4. **Limit timer.** `timerMode`/`timerMinutes` in the habit editor, lurker popup Start, countdown, expiry → arrival popup, tests. — Sonnet, low-medium.
5. Later: time-on-task stats surface; Steward church skin; V2 follow-up shape language.

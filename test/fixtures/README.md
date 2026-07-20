# Dev save fixtures

Real saves exported from the running app (or hand-built to match its exact
schema) rather than written from scratch — guaranteed schema-valid for
`schemaVersion: 11`. Built for reuse across future dev/test sessions instead
of re-creating state through the UI every time the game resets.

## dev-save.json (2026-07-20, day-advance live-rollover session)

**Contents:** 1 standalone positive habit (Drink Water), 1 standalone
negative habit (Skip Junk Food), 1 standalone task (Write weekly report),
and 1 active routine (Morning Routine) with one member habit (Stretch) —
covers the common item/routine/hero shapes in one save.

## dev-save-frozen-slots.json (2026-07-20, same session)

Three routines covering the [P1-DATA-005] frozen-slots system end to end —
pure-logic-checked against the real `js/frozenSlots.js` before being
live-verified in Chrome (Manage Routine banners, hero chip badges, and
suspended-member spawn gating all confirmed against the real app):

- **Late Night Habits** — FROZEN. `Doomscroll Before Bed` (negative) has 3
  trailing indulged days, tripping `FrozenSlots.shouldFreeze`. Its sibling
  habit `Read Before Bed` and task `Skincare Routine` are both suspended
  (defined, but no active board item — confirms spawn gating). The offending
  habit itself still spawns (recovery path 2 needs it active).
- **Morning Discipline** — NOT frozen, 2/3 trailing indulged days
  (`Snooze Alarm`). One more indulge away from tripping the freeze — load
  this to test the LIVE trigger path itself rather than an already-frozen
  state. `Morning Walk` (positive, streak 2) spawns normally alongside it.
- **Screen Time** — FROZEN but 2/3 of the way through avoidance recovery.
  `Phone in Bed`'s `occurrenceHistory` has the original 3-miss run that
  froze it, followed by 2 trailing avoided days — one more clean day clears
  `routine.frozenState` via `FrozenSlots.shouldRecoverByAvoidance`. Its
  sibling `No TV After Dinner` is suspended, same as above.

## dev-save-overdue-damage.json (2026-07-20, same session)

Four tasks demonstrating `js/damage.js`'s offline-catch-up cap
(`CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM` = 12 HP per item, LIFETIME not
per-restore) — verified against `Damage.computeOfflineOverdueDamage`
directly before touching Chrome, then confirmed live: loading it charged
each overdue item to exactly 12/12 regardless of starting point (`0→12`,
`10→12`, `12→12` unchanged), and `baseHealth` moved by the expected
damage-minus-regen delta.

- `Overdue Report` — fresh, `offlineDamageCharged: 0` → charges the full 12.
- `Almost Capped Task` — `offlineDamageCharged: 10` → charges only 2 more.
- `Fully Capped Task` — `offlineDamageCharged: 12` → charges 0 more (already
  maxed; proves the cap is a lifetime budget, not reset per load).
- `Upcoming Task` — not yet due, untouched; demonstrates the non-overdue
  contrast case.

**Extra staleness note (beyond the general one below):** the per-item damage
CAP behavior is robust to any load time (`CONFIG.OFFLINE_MAX_MS` caps the
offline window at 3 days regardless of how stale `savedAt` gets). The
visible **partial base HP** (`baseHealth: 58` at save time) is NOT robust
the same way — `js/damage.js`'s offline regen isn't capped
like damage is, so loading this fixture more than a few hours after
`savedAt` will likely show a healed-up base rather than the intended
"partially damaged" demo state. Trust the item-level `offlineDamageCharged`
values for the cap demo; don't rely on the base looking damaged.

## dev-save-heroes-run-history.json (2026-07-20, same session)

Three routines + two finalized `runHistory` records, covering
`js/heroes.js` (XP/level/star-rating) and `js/runStats.js`
(`finalizeRun`'s shape) end to end. Verified against the real
`Heroes.levelForXp`/`completionRate`/`starRating` pure functions (using the
SAME `windowStartMs = max(routine.createdAt, runStartedAtMs)` formula
`js/ui/heroes.js` actually uses — an earlier pass got this wrong by using
`createdAt` alone, which silently trimmed the sample window; worth
remembering if hand-authoring `occurrenceHistory` for a routine-scoped
fixture again) before touching Chrome, then live-verified the full Manage
Routine / Routines list / Stats screen:

- **Fitness Squad** — Lv4, 5★ (100% completion, 2 habit members).
- **Study Grind** — Lv2, 1★ (67% completion, 1 habit member).
- **Burned Out** — KO'd (`health: 0`, `koState` set to a date before
  "today," so it's immediately revivable), 0★, no active board item since
  it's both inactive and KO'd.
- **`runHistory`** — 2 past runs (3 days/145 pts and 2 days/78 pts), each
  with `blame` rows and a `routines` rollup — feeds the Stats modal's "Past
  Runs" list and "Routine Performance" table directly (both confirmed live,
  including the "Best run" badge on the higher-`daysSurvived` record and the
  KO'd badge on Burned Out's historical row).

## dev-save-economy-shop.json (2026-07-20, same session)

Solid points balance (350) + a pre-stocked inventory, for shop/pricing
testing and as a starting point for the still-open real-play balance
re-check ([P1-UI-008] follow-up in ROADMAP.md). Verified every displayed
price against `Economy.shopPrice(baseCost, held)` directly before touching
Chrome; all matched exactly live, including one item (`skip_day`, held 3 →
next price 675) deliberately priced OUT of reach of the 350-point balance,
to exercise the shop's "Not enough points" disabled state alongside the
affordable items. Also live-tested an actual repair-kit purchase/use cycle
(health +15, held count -1, next price recalculated 56→38) — fully
functional, not just visually plausible. Base HP starts damaged (40) so
repair kits have a visible effect; two tasks (one overdue, one not) give
something to target with pushback/kits.

## Loading a fixture into a running game

**Do this from a page that is NOT currently running the game's JS** — a
freshly-navigated 404 on the same origin works (`localhost:8000/anything`).
Setting `localStorage` directly from an ALREADY-LOADED game tab doesn't
touch that tab's live in-memory state, and its autosave (fires almost
immediately if `lastAutosaveMs` is stale) will re-serialize the OLD state
right back over your write within about a second — found live this session,
same root cause as CLAUDE.md's documented "verifying a hand-edited save"
gotcha, just via a different trigger (a live page + a direct localStorage
write racing, not a stub/flush timing issue). Sequence that works:

```js
// 1. Navigate to a URL on the same origin that 404s (kills any running game
//    loop/autosave in that tab — e.g. http://localhost:8000/__dead__).
// 2. From THAT page's console:
fetch('http://localhost:8000/test/fixtures/dev-save-frozen-slots.json')
    .then(r => r.text())
    .then(json => localStorage.setItem('deadline.save', json));
// 3. THEN navigate to http://localhost:8000 for a genuinely fresh restore.
```

(Swap the filename for whichever fixture you want.) If `fetch` 404s because
`test/` isn't served, paste the file's contents directly instead:
`localStorage.setItem('deadline.save', '<paste JSON here>')` — same
kill-the-live-tab-first rule applies.

## Known limitation — dates are absolute, not relative

`currentGameDate` and every item's `dueDateTime`/`originalDueDate` are frozen
at 2026-07-20 (Central time). Loading this fixture on a LATER real date is
still useful, but the app will treat it as walking in from the past:

- On restore, `State.performDayRollover` (the day-advance mechanism —
  `js/dayRollover.js`/`js/state.js`) will immediately settle the stale
  positive/negative habit instances and spawn fresh ones for today. This is
  actually handy if you specifically want to test the ROLLOVER path — see
  `test/state-day-rollover.test.js` for the unit-level version, or repeat
  this fixture's own live-Chrome verification (HANDOFF.md, session with the
  LIVE mid-session rollover build) for an end-to-end check.
- The standalone task (`Write weekly report`) will already read as overdue.

If you want a clean "everything due later today" baseline instead, load the
fixture, let the rollover settle, then re-save (`Persistence.flush()`) — or
just use the in-app dev Reset button and re-create fixtures fresh via the UI
for date-sensitive tests.

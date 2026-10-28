# Daily Record — per-day summary for future AI insights + Stats (D2)

**Status: DESIGNED 2026-10-27 (Claude app session, Fable). Build pending (one Sonnet session).**
Decisions logged in `docs/DECISIONS.md` 2026-10-27 "Daily record". Root shape in
`docs/DATA_SCHEMA.md` "Daily record".

## Why

Jeremy (2026-10-27): the reason to save a day's data is NOT paging the canvas back to a past
day. It is (1) a future in-game AI that tells the player what has worked for them — which
times of day go wrong, how seasons change things — and (2) best/worst days per run in Stats.
Every day that passes unrecorded is lost for good, so this ships before the V7 visuals.

Scaling check (2026-10-27): a fixed-shape numeric record is ~500-700 bytes/day; a year is
~250 KB uncompressed, well under the ~5 MB localStorage cap, and trivial per user if a backend
ever exists. The costly version is a per-tick event log (rejected 2026-07 for runs; still
rejected). The real scaling cost later is AI token spend per query, which a compact daily
summary REDUCES (aggregate before prompting).

## The rule that keeps it current (also in CLAUDE.md guardrails)

**Any mechanic that changes what can happen in a day adds its counter to the daily record in
the SAME session, bumps `DailyRecord.v`, and notes it in DATA_SCHEMA.md.** Fields are
additive only; readers treat a missing field as 0 / empty. Old days never need migrating.

## Record shape (v1) — numbers and category keys only, never free text

```js
DailyRecord {
  v: 1,
  date: "YYYY-MM-DD",          // local calendar day (key in the store)
  tz: -300,                    // minutes offset from UTC that day (DST / travel)
  run: 3, night: 12,           // run number + night index within the run
  lvl: 4,                      // player level at day end
  load: { habits: 5, routines: 2, tasksDue: 4 },   // live defs + one-off tasks due that day
  due:    { task: 4, habit: 5 },                   // denominators
  done:   { task: 3, subtask: 2, habit: 4, late: 1 }, // late = completed after going overdue
  missed: { task: 1, habit: 1 },                   // went overdue / habit miss recorded
  lurk:   { avoided: 2, slipped: 1 },              // negative habits
  byCat:  { health: [done, missed, dmg], career: [..], … },  // 8 keys, ints
  hoursDone:   [24 ints],      // completions by local hour
  hoursMissed: [24 ints],      // hour an item went overdue
  hoursDmg:    [24 ints],      // base damage landed, by hour
  active: { first: 7, last: 22, touches: 14 },     // interaction window + count
  dmg:    { taken: 9, hits: 9, offline: 4 },       // offline = back-charged on load
  base:   { endHp: 86, minHp: 71 },
  pts:    { earned: 120, spent: 40, end: 310 },
  tokens: { cheat: 0, sick: 0, skip: 0, pushback: 1, kit: 0 },
  resched: 1, ko: 0, revived: 0,
  timer:  { workMin: 45, limitMin: 20 },
  streak: { best: 9 },                              // highest live habit streak at day end
  app:    { opened: true }                          // false never written: absent day = not opened
}
```

What is deliberately NOT here: item names/notes (free text), per-habit outcomes (habit
`occurrenceHistory` already has `{date, success}` per definition — join on date), per-tick
events, device info.

## Storage

- **Today's accumulator:** `save.today` (DailyRecord in progress) inside `deadline.save`.
  Small, on the hot path already. Schema bump 14 → 15 seeds it.
- **Closed days:** separate key **`deadline.days`** = `{ v: 1, days: { "YYYY-MM-DD": DailyRecord },
  months: { "YYYY-MM": DailyRecord-shaped totals } }`. Written ONCE per day at rollover, never on
  the per-change save path.
- **Rollover:** `State.performDayRollover` (restore + live paths both route through it) closes
  `save.today` into `deadline.days[date]` and seeds a fresh accumulator. A multi-day gap writes
  only the day that was open; absent dates mean "app not opened" (a signal, not a bug).
- **Roll-up:** days older than 18 months collapse into `months["YYYY-MM"]` (same shape, summed;
  hour arrays summed; `active`/`base` averaged, `tz` dropped). Runs at rollover, cheap.
- **Backup & Transfer:** `deadline.days` joins the export envelope; import merges by date and
  never overwrites a day that already has data on the device.
- **Reset Game / new run:** days are LIFETIME data, untouched (like `lifetimeStats`).
- **Undo:** uncompleting decrements the matching counters (done, hoursDone, byCat[0], pts).

## Seams (where counters bump) — all exist today

| Event | Seam | Fields |
|---|---|---|
| completion | `Items.completeItem` (next to `recordLifetime`) | done.*, hoursDone, byCat[0], late, pts.earned |
| undo | `Items` uncomplete path (items.js ~1168) | reverse of completion |
| overdue | `Items.markAsOverdue` / settle paths | missed.*, hoursMissed, byCat[1] |
| lurker avoided/slipped | check-in + lurker arrival | lurk.* |
| base hit | `Damage` tick → `deps.recordRunDamage` | dmg.taken/hits, hoursDmg, byCat[2], base.minHp |
| offline back-charge | `runOfflineCatchUp` | dmg.offline |
| shop | `Shop.grant` / purchase + `handleShopUse` | pts.spent, tokens.* |
| reschedule | Economy reschedule price path | resched |
| KO / revive | Routines ghostify / revive pickers | ko, revived |
| timers | `Timer` stop/expire | timer.* |
| any UI interaction | script.js (pointerdown on #app, throttled) | active.* |
| rollover | `State.performDayRollover` | lvl, load, due, base.endHp, pts.end, streak, close |

Pure module **`js/dailyRecord.js`** (fresh(), bump(rec, event, payload), close(), rollUp(store,
now)) with Jest tests; wiring is thin deps, like `RunStats`.

## Stats surface (small, same build or next)
Best / worst day per run: score = done.total − missed.total − dmg.taken (CONFIG weights). Shown
on the run cards in Stats. Day Pager stays forward-only.

## Build steps (Sonnet, medium; one session)
1. `js/dailyRecord.js` + tests (shape, bump, undo, close, 18-month roll-up).
2. Schema 15 (`save.today`), `deadline.days` persistence helpers, export/import.
3. Wire the seams above (deps, no module reads State directly).
4. `active` tracking (throttled) + rollover close in `performDayRollover`.
5. Stats: best/worst day per run.
6. Docs: DATA_SCHEMA.md, MECHANICS.md note, CLAUDE.md codebase state; sw.js bump.

## Future — Daily Journal (Jeremy, 2026-10-27; not in the D2 build)

A few free-text notes per day ("what went well / what was hard"). Design intent, reserved now:
- **Separate key `deadline.journal`** keyed by the same `YYYY-MM-DD`; the `DailyRecord` stays
  numbers-only. AI joins the two on date (numbers = what happened, note = why, in the player's words).
- Alongside the text, a few structured fields: `feel` 1-5 and fixed tags (tired, sick, travel,
  busy, …) so insight can correlate without parsing prose.
- Entry point: a soft "Anything to note about today?" at rollover / game-over, skip by default.
- **Privacy:** the journal is the one store with personal free text. Any off-device AI call sends
  journal text only with explicit opt-in, separate from the numeric record; export includes it but
  should let the user leave it out.

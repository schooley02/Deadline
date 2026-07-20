# Dev save fixture

`dev-save.json` is a real save exported from the running app (2026-07-20,
Cowork session, day-advance live-rollover work) — captured via the app's own
UI rather than hand-written, so it's guaranteed schema-valid for
`schemaVersion: 11`. Built for reuse across future dev/test sessions instead
of starting from an empty save every time.

**Contents:** 1 standalone positive habit (Drink Water), 1 standalone
negative habit (Skip Junk Food), 1 standalone task (Write weekly report),
and 1 active routine (Morning Routine) with one member habit (Stretch) —
covers the common item/routine/hero shapes in one save.

## Loading it into a running game

Open the app (`node server.js` or `npx serve .`, then http://localhost:8000),
open devtools console, and run:

```js
fetch('/test/fixtures/dev-save.json').then(r => r.text()).then(json => {
    localStorage.setItem('deadline.save', json);
    location.reload();
});
```

(`fetch` works because `test/` is served as a static path off the same dev
server — no separate hosting needed.) If that 404s because `test/` isn't in
`server.js`'s served root, paste the file's contents directly:
`localStorage.setItem('deadline.save', '<paste JSON here>'); location.reload();`.

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

# Journal — optional notes on the day, on any item, and on the game

**Status: DESIGNED 2026-11-13 (Fable 5.2, Claude app; Jeremy approved the four forks). Build A BUILT 2026-11-13 (Sonnet 5.5; sw v362; DailyRecord v16; pushed). Build B BUILT 2026-11-13 (Sonnet 5.5; sw v363; NOT phone-checked). Build C BUILT 2026-11-13 (Sonnet 5.5; sw v364, follow-ups to v367; the chip phone-checked by Jeremy 2026-11-13).**

Build A as built: ref ids are namespaced (`def:<definitionId>` for habits / routine tasks / recurring tasks, `item:<itemId>` for one-off tasks and sub-tasks, the routine id string for routines). `Journal.sanitize` coerces an unknown `about` to `general` and an unknown `src` to `manual` rather than dropping the entry (deviation from "reject"; keeps imports lossless). The timer-stop window opens one tick late (setTimeout 0) so the Modal outside-click dismiss does not close it.
Build B as built: the Journal window is a normal management window (`#journalWindow`, `ManagementWindows` branch `journal`, deps built by `journalWindowDeps()` only when it opens so a pending filter is consumed once). Doors: the plus-menu row (📓, between Stats and Settings), the Level panel's Journal section (newest note's first words, "Write a note" = about today, "Open journal"), Stats "Notes: N" + Read (run filter), the "All notes (N)" button on the item / routine Notes block (thing filter), and an item name inside the window (thing filter). Filters: All / Days / the game's name (theme string `Theme.strings.journal.gameName`) + a Show all link for a thing or run filter; 30 day blocks per page with "Show older days". Edit = the note window with the text (Save changes; unchanged text is a no-op); Delete = `Dialog.confirm`, and a note WRITTEN today (a late "yesterday" note included) takes one off today's `notes` count. The day-end card ("How did today go?") is `JournalView.openDayEnd`: the real mood picker (a face tap is an ordinary check-in, no "Add a note" row) above a text box; due once per local day from the evening time on, BEFORE the evening check's cards (when it closes, the evening check follows one tick later; alone when the evening check has nothing to ask); stamp `deadline.journalStamps.dayEnd` is set when it is shown, so Skip / Close counts as shown; skipped if a `dayEnd` note already exists for the day. The morning fallback is a "How did yesterday go?" button on the morning mood card (not the whole card), due when a closed record for yesterday exists, no card was shown or answered for it and the late window was not closed before (`journalStamps.late`, set when that window is closed by Save or Skip; the day key moving on is what makes it one day only); it is ALSO a "How did yesterday go?" button in the player panel's Journal section, so a mood logged elsewhere cannot hide it (Jeremy, 2026-11-13); it opens a late window with its own five faces; the entry is filed under yesterday with `late: true`, `mood: [level, 0, 0]` on the entry only, and the closed day's record is never edited. Build C as built: a "Journal and notes" topic (`journal`, the 13th, last) in How Deadline works, its numbers read from `CONFIG.JOURNAL`, with an (i) button on the Journal window title; an "Add a note" link under the auto-stop notice's three buttons (`TimerView.showAutoStopped` `handlers.onNote`; the note window opens on top and the notice stays); a small bottom-left "Add a note" chip (`JournalView.showChip`, fades after 7 s, never a window, one at a time) when a task is finished with its timer running (`Items.completeItem` -> optional `deps.onTimedCompletion(item, spanMs)` -> `offerCompletionNoteChip`), obeying the same Settings switch and `TIMER_NOTE_MIN_MS` as the stop prompt. Notes from the chip carry `src: 'complete'`. Phone follow-ups (v365-v367): the note window's button column no longer stretches (`.modal-buttons.journal-note-actions`), the Goal reached "Mark done" path offers the chip itself (it stops the timer before `completeItem`), and the chip ignores touches for `CHIP_ARM_MS` (700 ms) because the tap that finished the task could land on it and open the window. Not built (not in the plan): the Journal window does not show a per-day "notes" count in the header.
Decisions logged in `docs/DECISIONS.md` 2026-11-13 "Journal". Supersedes the short
"Future — Daily Journal" section of `docs/DAILY_RECORD_PLAN.md` (that section stays as history).

## Why

Jeremy (2026-11-13): leave notes / a daily journal to review later, always optional. Tie mood into
the entries so a mood has context. When a timer stops, offer a note for that task. Allow a note on
any task, habit, routine, or the game in general. The notes are for (1) comparing against old runs
and (2) a future AI that reads them for what works, what doesn't, and what derails an effort.

The numbers (DailyRecord) say WHAT happened. The journal says WHY, in the player's words.

## Rules that do not bend

1. **Always optional.** Every prompt has Skip, never blocks play, never nags twice for the same thing.
2. **No rewards.** A note gives no points, XP, drops or progress of any kind. (Anti-cheat: paying
   for notes buys junk notes and ruins the data. Explained in How Deadline works.)
3. **Free text lives in ONE place.** `deadline.journal`. The DailyRecord stays numbers-only.
4. **Lifetime data.** Reset Game and a new run never touch the journal (like `deadline.days`).
5. **On-device.** Nothing is sent anywhere. Any future off-device AI call sends journal text only
   with an explicit opt-in that is separate from the numeric record.
6. **Baseline words.** Identifiers and saved keys are theme-free (note, entry, subject, item, day).
   Player-facing words that a theme could change go through `js/theme.js`.

## Data

Own localStorage key, written only when a note is added / edited / deleted (never on the hot save path):

```js
deadline.journal = {
  v: 1,
  days: { "YYYY-MM-DD": [Entry, ...] }   // local calendar day the note is ABOUT; entries in time order
}

Entry {
  id:   "j<ms>-<n>",        // unique; import merges on it
  at:   1794588000000,      // when it was written (ms)
  run:  3,                  // run number when written
  about: "item" | "routine" | "day" | "general",
  ref:  { kind: "task" | "habit" | "routine", id: "<stable id>", name: "<name when written>" } | null,
  src:  "timer" | "mood" | "dayEnd" | "manual" | "complete",
  text: "…",                // trimmed, 1..CONFIG.JOURNAL.MAX_CHARS (2000)
  mood: [level, feelingBits, contextBits] | null,   // snapshot, see "Mood tie-in"
  moodHour: 14,             // src "mood" only: which check-in this note belongs to
  min:  45,                 // src "timer" only: minutes of the session that just stopped
  late: true,               // only on a "How did yesterday go?" entry
  edited: 1794589000000     // only if edited
}
```

- **`ref.id` must survive the item leaving the list.** Habits and routine items: the definition id
  (`definitionId`). One-off tasks: the item id. Routines: the routine id. `ref.name` is a snapshot so
  a note still reads correctly after a rename or delete. (Builder: confirm the id fields with a grep
  of `js/items.js` before wiring; a sub-task's note refs the sub-task and also stores `parentId`.)
- **Sanitize on load and on import** (`Journal.sanitize`): drop entries with no text, clamp text
  length, drop unknown `about` / `src`, keep unknown extra fields untouched.
- **Size:** ~3 notes a day at ~200 characters is about 250 KB a year. No roll-up in v1. The Journal
  window shows the store size; revisit only if real use says so.

### DailyRecord v16 (the guardrail)
A note is something that can happen in a day, so the open day gains **`notes: n`** (count only).
Event `note { n: +1 | -1 }` via `State.bumpToday`. Month roll-up sums it. A late entry for yesterday
does NOT touch the closed day (closed days stay written-once). `V = 16`; older days read as 0.

## Mood tie-in

1. **Snapshot on every note.** When any note is saved, the day's latest mood check-in at that moment
   is copied onto the entry (`mood`). So a task note reads "Bad, overwhelmed: kept getting
   interrupted" with no extra taps. No check-in yet today = `null`.
2. **A note on a check-in.** The mood picker (Level / player panel and the morning card) gets one
   quiet line under the chips after a face is picked: "Add a note". It opens the note window; the
   entry is `src: "mood"`, `about: "day"`, with `moodHour` set.
3. **End of day (the prompt that was waiting on the journal).** "How did today go?" = the five faces
   + a text box + Save / Skip. A face tap is a normal mood check-in (same-hour-replaces rule); the
   text is `src: "dayEnd"`, `about: "day"`.
   - **When:** at the player's evening time (Settings, default 9 PM), as the FIRST card of the
     existing evening check. If the evening check has nothing else to ask, it shows alone as a small
     card (same style as the morning mood card). Once per local day; Skip / Close counts as shown.
   - **Fallback:** if it was never shown or answered, the next morning card adds one line, "How did
     yesterday go?", opening the same window for yesterday. That entry is `late: true`, filed under
     yesterday, and its face is stored on the ENTRY only (`mood: [level, 0, 0]`). It does not edit
     the closed DailyRecord, so it does not appear in the Mood column. One morning only, then gone.
   - Stamps live in a per-device key `deadline.journalStamps` (not in Settings, not exported), like
     `deadline.moodStamps`.

## Where a note can be written

| Place | Trigger | Entry |
|---|---|---|
| **Timer stop** | Manual Stop (running or paused) and "Still working?" > Stop. NOT Pause. Skipped if the session was under `CONFIG.JOURNAL.TIMER_NOTE_MIN_MS` (60 s) or the Settings switch is off. | `src: timer`, `about: item`, `min` |
| **Auto-stop notice** | An "Add a note" link beside its three buttons (no extra window). | same |
| **Completing with the timer running** | A small "Add a note" chip that fades after a few seconds; never a window. | `src: complete`, `about: item` |
| **Item window** (task / habit) | "Add note" button; the item's earlier notes list under it (newest 3, "All notes" opens the Journal filtered to it). | `src: manual`, `about: item` |
| **Routine view** | Same button and list for the routine. | `src: manual`, `about: routine` |
| **Mood picker / morning card** | "Add a note" after a face. | `src: mood`, `about: day` |
| **End of day** | Evening card / morning fallback. | `src: dayEnd`, `about: day` |
| **Journal window** | "Write a note": choose About today / About the game. | `src: manual`, `about: day` or `general` |

**The note window** (one component for all of the above): title says what the note is about (item
name, "Today", or the game's name from the theme), an optional context line (**"Time Logged: 45 min"**
for a timer stop; note the capitals, per the wording rule), a text area with a character count, the
current mood face if there is one (read-only; tap goes to the picker), Save and Skip. Save with empty
text = Skip. In-game modal only (`Modal.open`); no native dialogs; an explicit background class on
both buttons; every tap inside `stopPropagation`s (the Modal outside-click issue from the mood build).

**Settings:** "Ask for a note when I stop a timer" (default ON), in the Timers group. A new
`Settings` field breaks several `toEqual` pins; the builder updates them in the same build.

## Where notes are read

- **Journal window** (`js/ui/journalView.js`): newest day first. Day header = date, run number, the
  day's mood face(s) (same "first → last" form as the Weather table), then that day's entries: time,
  what it is about, the entry's own mood face, the text. Filters: All / Days / Game / one item or
  routine (tap its name). Each entry has Edit and Delete (Delete asks with `Dialog.confirm`). A
  "Write a note" button on top.
- **Two doors (Jeremy, 2026-11-13):**
  1. The **player panel** (Level panel): a "Journal" section under Mood with "Write a note", the
     latest entry's first line, and "Open journal".
  2. The **plus menu**: a new "Journal" row (`data-type="journal"`) between Stats and Settings.
  No new HUD button. (If it later becomes a HUD window, add it to `HudButtons.WINDOWS`.)
- **Stats:** each past-run card and the live-run panel show "Notes: N" with "Read", opening the
  Journal filtered to that run. Best / worst day rows show a small note mark when that day has notes.
- **Future AI (not in these builds):** joins `deadline.days` and `deadline.journal` on the date, and
  on `ref.id` for per-item patterns. Entries are already tagged with source, subject and mood so the
  prompt can be built from aggregates plus only the relevant notes.

## Backup & Transfer

- Export: the envelope gains `journal`. The export screen gets a checkbox, "Include journal notes"
  (default on), because this is the one store with personal free text.
- Import: merge by day, then by entry `id`. An id already on the device is never overwritten.
- Old backups with no `journal` import as before.

## Modules

| File | What |
|---|---|
| `js/journal.js` | Pure: `fresh`, `add`, `edit`, `remove`, `forDay`, `forRef`, `forRun`, `count`, `merge`, `sanitize`, `moodSnapshot`. Jest: `test/journal.test.js`. |
| `js/ui/journalView.js` | The note window, the Journal window, the item / routine note list, the player-panel section, the completion chip. |
| `css/journal.css` | Styles. Check 320px width with `scrollWidth > clientWidth`, not by eye. |
| `js/config.js` | `CONFIG.JOURNAL { MAX_CHARS: 2000, TIMER_NOTE_MIN_MS: 60000, RECENT_ON_ITEM: 3 }` (UX dials, not balance). |
| `script.js` | Thin wiring only: load / save of the key, deps for the views, the timer-stop hook at the manual-stop call sites (NOT inside `Timer.stop`, which also runs on completion and auto-stop). |

## Builds (Sonnet, medium; one per session)

- **Build A — store and writing.** `js/journal.js` + tests; the `deadline.journal` key (load,
  sanitize, save); export / import + the checkbox; DailyRecord v16 `notes`; the note window; timer
  stop hook + Settings switch; "Add note" + recent list in the item window and routine view; "Add a
  note" on the mood picker; docs (DATA_SCHEMA, CLAUDE.md codebase state); `sw.js` bump.
- **Build B — reading and end of day.** The Journal window (filters, edit, delete); the player-panel
  section; the plus-menu row; the end-of-day card in the evening check + the morning fallback +
  `deadline.journalStamps`; Stats "Notes: N" links and the note mark; `sw.js` bump.
- **Build C — finish.** A "Journal" topic in How Deadline works (what it is, that it is optional,
  that it earns nothing and why, that it stays on the device; add to `TOPIC_IDS` and the test's
  topic / `<details>` counts); the auto-stop notice link; the completion chip; phone-check fixes.

## Left for later (not designed)

- AI insights over notes (needs the opt-in and a backend decision).
- Search inside the journal; export notes as plain text.
- Guided prompts ("What went well? What was hard?") instead of one free box.
- A size roll-up, if real use ever needs one.

## Revisit later (Jeremy, 2026-11-13)
Once the Journal has real entries, review it as a whole. Open: the game-level note ("Note about Deadline", the "Deadline" filter chip, `Theme.strings.journal.gameName`) reads like a developer note, not something a player would write; its name and purpose need rethinking. Also the 60-second timer-note minimum.

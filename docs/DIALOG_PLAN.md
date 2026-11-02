# In-game dialogs instead of browser boxes (DECIDED 2026-11-01, Jeremy; Build 1 BUILT 2026-11-01, sw v193; Build 2 BUILT 2026-11-01, sw v201)

**Problem.** `alert()` / `confirm()` draw the BROWSER's box ("localhost:8000 says ..."), which breaks the look of the game, can behave
differently in an installed PWA, and freezes browser automation (see CLAUDE.md playtesting notes). Jeremy's rule: anything that is part of a
game mechanic stays in the game; only a genuine system alert may use the browser's box.

**Rule (also in CLAUDE.md Guardrails).** New code never calls `alert()`, `confirm()` or `prompt()` (bare, `window.`, or through a `deps.alert`
passthrough). Use the in-game helper (below). Exception: a real system-level failure the game cannot draw (storage blocked / quota, a crash
before the UI exists) -- and it must be listed in the allowlist in `test/no-native-dialogs.test.js` with a one-line reason.

## Inventory (audit 2026-11-01: 4 confirm() + 42 alert(), 0 prompt(); line numbers drift)
Already game-styled (good precedent): Settings > Reset Game and Import's replace-confirm use `Modal.open` (js/ui/settingsView.js).

**A. Form validation -> show INLINE in the form (not a dialog at all), 34 calls**
- js/ui/forms.js: 600 task name/due required, 610 start time, 648 habit name, 657 custom times, 661 pick a day, 668 goal error, 702 routine name empty/duplicate
- js/ui/popups.js: 636 name/due required, 653 start before due, 663 sub-task due after parent, 670 logged-time error, 840 sub-task name/due, 849 sub-task start, 868 sub-task due after parent
- js/ui/routineViews.js: 356 pick a habit, 941 pick an item, 1030 pick a routine, 1349-1368 and 1423-1447 create/edit habit (name, custom times, day, goal, logged time), 1388-1398 and 1544-1554 create/edit task (name, start, day)
- script.js: 1796 routine name empty/duplicate

**B. Game-rule messages -> styled in-game notice (OK button), 5 calls**
- js/ui/routineViews.js:827 "at its slot limit, level up to earn a slot point"; 983 "this habit froze the routine, can't be moved"; 994 "no other routines to move to"
- js/routines.js:793 "knocked out -- revive starting tomorrow"; 801 "only N active routines at your level" (via `deps.alert`)

**C. Decisions -> styled confirm (two buttons, labelled for the action), 4 calls**
- js/ui/routineViews.js:831 spend a slot point to unlock a slot (a mechanic); 1039 move an item between routines
- script.js:1810 delete a routine; 2323 delete a habit (destructive: red confirm button)

**D. Should-not-happen errors -> styled notice or small toast, 4 calls**
- js/ui/popups.js:768 parent task not found; js/TaskManager.js:404 error creating subtask; js/ui/routineViews.js:1052 move failed (message by reason); script.js:2011 routine/habit not found / habit already in routine

## Design
One small module `js/ui/dialog.js` on top of the existing `Modal.open` (Esc, tap-outside, focus return already handled there):
- `Dialog.notice(message, { title })` -> Promise resolved on OK.
- `Dialog.confirm(message, { title, confirmLabel, cancelLabel, danger })` -> Promise<boolean>; danger = red confirm button.
- Inline validation: `Forms.showFormError(container, message)` writes a `.form-error` line above the Save button and focuses the bad field; cleared on the next edit.
- Dialogs queue (one at a time) and never open inside a click that would instantly dismiss them (open on `setTimeout(0)`, the same trap as the logged-time prompt).
- `confirm()` was synchronous; callers now `await`. Each of the 4 call sites is handled by hand (the slot-point one sits in `ensureRoutineSlotAvailable`, which returns a boolean to its caller -> becomes async). Tests that stub `window.confirm/alert` are updated to stub `Dialog`.
- Styling: reuse modal CSS (css/modal.css); no new look beyond a `.form-error` line.

## Build order
1. **Build 1 (Sonnet, medium):** `js/ui/dialog.js` + CSS + tests; convert category C (4 confirms) and B (5 notices) -- the game-mechanic ones. Include the no-native-dialogs guard test with an allowlist of the remaining A/D calls so it stays green and shrinks.
2. **Build 2 (Sonnet, medium):** category A inline validation (34 calls, mostly mechanical; one helper) -- shrink the allowlist.
3. **Build 3 (Sonnet, low):** category D, then remove the allowlist (test fails on ANY native dialog) and the `deps.alert` passthrough.
Each build: bump sw, live-check at 390x844 (the Playwright run no longer needs dialog stubs -- a plus), phone-check.

## Build 1 -- built as (2026-11-01, Sonnet; Jest 116 suites / 2,586)
`js/ui/dialog.js` (`Dialog.notice` / `Dialog.confirm`, queued, promise-based; dismissing by Esc / backdrop / `Modal.closeModal` resolves false via a MutationObserver so nothing hangs; inserted one tick later; removes only itself); styles in css/modal.css (`.dialog-*`); loaded after modal.js in index.html and in sw.js. Converted: slot-point spend (`ensureRoutineSlotAvailable`, now ASYNC, so `saveNewHabit` / `saveNewTask` and the add / move click handlers `await` it), slot-limit notice, move-item confirm, frozen-habit and no-other-routine notices, delete routine (danger confirm; the Manage modal now closes only AFTER the confirmed delete -- the inline onclick used to close it first), delete habit (danger confirm), and `routines.js`'s two game-rule alerts (script.js passes `alert: msg => Dialog.notice(msg)`). Guard: `test/no-native-dialogs.test.js` (exact per-file allowlist of the 37 remaining: forms 7, popups 8, routineViews 19, TaskManager 1, script.js 2 -- it must shrink as Builds 2-3 land). Live check at 390x844: styled confirm, OK -> true, Esc -> false, 0 native dialogs, 0 console errors. Jeremy: no need to pause the game while a dialog is open.

## Build 2 -- built as (2026-11-01, Sonnet; Jest 118 suites / 2,596)
`Forms.showFormError(message, field?, opts?)` + `Forms.clearFormError` in js/ui/forms.js; styles `.form-error` / `[aria-invalid="true"]` in css/modal.css. Placement: under the field's `.form-row` (so it is on screen on a scrolling phone form), else above `.modal-buttons`, or beside `opts.before` / `opts.after` (used for the inline Add Habit/Task pickers and the routine-name form in script.js). Focuses the field, clears on the next input/change in the same form, replaces any earlier error (never stacks). Converted 33 calls (the audit said 34): forms.js 7, popups.js 7, routineViews.js 18, script.js 1. Guard allowlist now 4 (popups.js 1, routineViews.js 1, script.js 1, TaskManager.js 1 -- all category D). Tests: formError.test.js (6); popups-logged-time and routine-views-logged-time expect the inline line. Live check at 390x844: 0 native dialogs, 0 console errors; Jeremy phone-confirmed.

## Open
- Notice vs toast for category D (rare, so a notice is fine).
- Keep a real system alert at all? Nothing needs it today; the allowlist stays empty unless something appears.

# UI / UX — Screens, Navigation, Interactions

## Platform
Mobile-first web app; prioritize Chrome/Android. Must be responsive so it works in any browser. Game canvas in the top portion of the screen; task/habit agenda list stacked below it.

## Main Screen
- **Canvas (top):** base on the left, enemies advancing from the right. Defaults to showing the CURRENT DAY's tasks and habits. Only active (non-repeating-future) items render.
- **Base Zone heroes ([P1-UI-006] sub-session 3, built 2026-07-19):** one small avatar chip per routine renders over the base's leftmost 120px (`js/ui/heroes.js`) — category emoji, level badge, star row, health bar, state styling (active/frozen 🥶/KO'd 💤/inactive greyed). CSS/emoji placeholders for v1 (no hero sprite assets exist); capped display with a "+N" overflow chip. See docs/ROUTINES.md's "Hero Rendering" section for the full mechanic.
- **Agenda List (below):** today's tasks and habits ordered by closest-to-base (soonest due first). Edit icon next to each item. Complete/Defeat buttons per item. A parent task with any sub-task history shows a live "N/M sub-tasks" progress label next to its category badge (built 2026-07-19, session 51 — see MECHANICS.md "Sub-tasks").
- **Completed Today:** completed sub-tasks render nested and greyed directly under their parent's completed entry, indented, DISPLAY-ONLY (a static "✓ Completed" badge, no uncomplete checkbox — see MECHANICS.md "Sub-tasks" for why) (built 2026-07-19, session 51).
- **Time Slider:** sits ON the seam between canvas and list. Represents the 24-hour day; handle starts at the current time. Sliding forward/backward acts like fast-forward/rewind of the enemies (preview which tasks are on the horizon and which are moving fastest). Scope toggle: Today / This Week / This Month.
- **Plus Button (floating, bottom-left):** Add New Task, Add New Routine, switch to Routine View, open Inventory (tokens), open Store.
- **HUD:** base HP, player level/XP, days survived, active routines count.

## Routine View
Replaces the agenda list with routines ranked by level (top performers first). Manage habits within each routine here (add, activate/deactivate).

## Other Screens
- Add/Edit screens for tasks, habits, routines.
- Overview screens: all current tasks / all habits / all routines.
- Recently Defeated view (undo accidental completes).
- Run history / run review screen (post-game-over and on demand). On-demand half BUILT 2026-07-19 (session 54, RUN_HISTORY_PLAN.md sub-session 3): Stats window, 5th FAB item — live current-run panel (days survived, counters, top-3 blame) + past-run cards. Post-game-over half BUILT 2026-07-19/20 (session 55, sub-session 4): the game-over screen is now a review card (framing copy + totals + top-5 blame) instead of one line; the Stats window also gained a per-routine "Routine Performance" rollup across recent runs.

## Visual Feedback
- Urgent task: glow / bright border (enemy and list item).
- Base damage: shake on hit, progressive destruction visuals.
- Enemy defeat: explosion + points/XP popup.
- Game over: "Your Base survived X days. What adjustments can you make to have a stronger Base in your life?" + New Base button.

## Navigation
Plus icon / hamburger menu opens options. Keep taps-to-action minimal — completing a task should be 1-2 taps.

## Canonical Wireframes (image-only PDFs — do NOT open in Claude; ask Jeremy)
In `OneDrive\Documents\Baseline - Old\Deadline\`: `Tasks.pdf` (task input fields), `Habits.pdf` (habit input fields), `Routines.pdf` (routine screens), `Agenda-view.pdf` (main screen layout), `wireframe1.pdf`. Also `Deadline-Mockup-1.jpg` and `Base-View-Mockup-v1.png` there (safe to view), and `UI_Inspiration/` in this repo. Deep UI detail: Grep PROJECT_SPEC.md section 7 (UI Specifications).

## Accessibility
Keyboard operable, adequate contrast, tap targets ≥44px, works one-handed on a phone.

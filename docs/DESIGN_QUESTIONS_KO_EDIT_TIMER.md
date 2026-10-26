# Design Questions — KO ghosts, reschedule limits, work timer

Raised by Jeremy 2026-10-25 (Claude app session) while integrating the Other Hero art. NOT decided. Batch into one Fable (judgment-tier) session, run through the balance-tuning protocol, log outcomes in `docs/DECISIONS.md`. Nothing here is built.

## Already decided this session (Jeremy)
- Hero KO ANIMATION is not faded: it plays as drawn, once, then holds its last frame for 3 s, then loops.
- KO'd state IS faded on the small things: tray/tab/list avatars (head crops).
- A KO'd routine's habits and tasks must stay visible as faded ghosts on the canvas AND in the list ("at-a-glance" principle). Today KO removes them (`clearActiveInstancesForRoutine`, ROUTINES.md "pure removal"). Reuse the day-pager ghost sprites/rows (`js/ui/dayPagerView.js`, `css/dayPager.css`).

## Q1 — KO'd habits/tasks vs streaks (open)
Facts: a miss is recorded when a habit goes overdue / the day ends undone; it resets the streak, lowers the 28-occurrence completion rate (-> stars and the 2x/1.5x/1x habit points multiplier). Streak itself is visual-only. While a routine is KO'd nothing spawns, so no new misses are recorded: streaks freeze, stars hold. Items already overdue at KO had their misses recorded (that damage caused the KO).
Options:
- A. Visual-only ghosts, nothing recorded (today's behaviour). Forgiving; fits "reflection over punishment"; avoids the what-the-hell effect.
- B. Ghosts are real inert items that record misses. Harsher; double-punishes (KO already costs the routine); touches balance numbers.
- C. (Opus recommendation, to evaluate) Ghosts stay completable: completing one extends the streak (and maybe restores a little hero health toward revive); leaving one undone is "excused" like Skip/Sick Day (no success, no miss). Rewards real-life follow-through without free forgiveness. Needs: ghost completion path, points/XP rules while KO'd, revive-health interaction, exploit check (cannot be worth getting KO'd on purpose).
Sub-forks if ghosts are built: position (due-time vs parked), tap behaviour (read-only popup "KO'd, revives tomorrow"), list row style (greyed, no checkbox, sleep badge), duration (until revive; today's due items only).

## Q2 — Reschedule limits / Edit token (open)
Facts: Pushback costs 50/100/300 pts, but editing a due date later is free (DECISIONS 2026-07-21 "adds no loophole"), so pushback is pointless. Over-charging all edits risks players entering fake dates, leaving items overdue, or quitting.
Sketch to evaluate: free = moving earlier, edits shortly after creation, edits far from due; paid = moving later when close to due or overdue (pushback price or a limited Edit token, maybe a small free weekly allowance); stats line "rescheduled N times" (reflection pillar). Needs balance-tuning pass for price/allowance.

## Q3 — Work timer (open)
Idea: start/stop a timer on a task; while running the hero (routine hero, or a default hero for standalone tasks) plays the Attack animation; damage may not land while actively working past the deadline.
Decide: exploit control (auto-pause + "still working?" prompt, one timer at a time, or reduced damage instead of zero); standalone tasks (default hero?); habits too or tasks only; persistence (store start timestamp, never count ticks — see DECISIONS 2026-07-18); time-on-task stats; schema impact; Attack animation already exists in the Other Hero sheet (row 5).

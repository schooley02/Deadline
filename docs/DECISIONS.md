# Decision Log

Append-only. Newest at top. Format: date — decision — why — alternatives rejected.

---

## 2026-07-21 — Overdue-edit back-charge bug fixed: editing a due date into the past no longer replays missed damage intervals (Cowork session, root cause + design already resolved 2026-07-20, Sonnet execution)

**Decision:** Fixed the last unguarded entry of the 2026-07-18 far-past-clock bug family (see that date's DECISIONS entries for create-overdue/restore/suspended-loop-gap, all guarded then). Root cause: `Items.markAsOverdue(item, currentTime, deps)` has always ignored its own `currentTime` parameter — it unconditionally sets `item.lastDamageTickTime = item.dueDateTime.getTime()`. `spawning.js`'s created-already-overdue path already worked around this with a one-line override (`itemData.lastDamageTickTime = Date.now()`) immediately after calling `markAsOverdue`, with a comment explaining exactly why — but `recomputeOverdueStateAfterEdit`'s "pulled into the past" branch (fired when an edit moves a due date backward) never got the same treatment. Editing a task's due time from ~10 PM to 9 AM the same day dealt −92 HP in seconds (100→8 HP) — the live loop replays one damage interval per 50ms game tick until the pending-tick backlog clears, and a same-day edit can park ~157 pending 5-min intervals.

**Fix:** mirrored spawning.js's exact pattern — `item.lastDamageTickTime = now.getTime()` immediately after `markAsOverdue(item, now, deps)` in the pulled-into-the-past branch. This was a pure execution task; both design forks were already resolved 2026-07-20 (Jeremy, Fable, visual-audit session): (1) an edit-into-the-past back-charges NOTHING — an edit is a bookkeeping correction, not evidence of an attack the player dodged, so the clock starts clean at the edit landing; (2) live page-open overdue damage stays UNBOUNDED by design — the `OFFLINE_DAMAGE_CAP_PER_ITEM` (12 HP) cap is an anti-frustration guard for time the player wasn't at the keyboard (offline/suspended-loop paths only); it deliberately does NOT extend to live play, so this fix adds no cap of any kind — it only removes the retroactive back-charge.

**Found, not fixed — flagged for a future design call:** `uncompleteItem` (items.js:1043) calls `markAsOverdue(item, currentTime, deps)` the same way, with no clock override, when undoing a completion on an item whose due date is in the past. It would back-charge identically. This wasn't in the original bug report and — unlike an edit — "undoing a completion you knew was already overdue" might legitimately deserve different treatment than a bookkeeping correction; logged as an unchecked ROADMAP Known bugs entry rather than silently applying the same fix.

**Alternatives considered:** fixing the root cause generically (making `markAsOverdue` actually use its `currentTime` param everywhere) was considered and rejected for this session — it would change behavior at loop.js's and damage.js's call sites too, which are already correct today (their `currentTime` roughly equals the due time in normal live-tick/catch-up flow, so the dead parameter is harmless there), and touching more call sites than the one ticketed bug needs risks exactly the kind of blast-radius creep the one-task-per-session guardrail exists to prevent.

**Verification:** new `test/overdue-edit.test.js` (6 tests: no-back-charge clock landing, zero pending damage ticks immediately after the edit, DOM/position updates, a habit case, the unchanged future-push-clears-overdue regression, the unchanged negative-habit-lurker guard). 59 suites, 1264/1264 (+6). Live-verified in Chrome: created a task due in the future, edited its due time to 13 hours in the past, confirmed Health stayed at 100 immediately after landing (previously would have dropped ~30+ HP), then confirmed live damage resumed ticking normally afterward. Zero console errors.

## 2026-07-21 — Points earn-rate re-tuned 10x down (task/habit base → 1); sub-task-only points on sub-tasked parents; habit rate bonus re-anchored to a 22-occurrence window (Cowork session, Jeremy's call throughout, Sonnet execution)

**Decision:** Jeremy's call, balance-tuning protocol. `CONFIG.POINTS_PER_TASK`/`POINTS_PER_HABIT` 10/5 → **1/1**. Rationale: shop prices (25-300 pts) were sized against the old ~75-85 pts/day earn rate — a solid day's play comfortably covered a repair kit. Jeremy wants tokens (freezes, pushbacks, cheat days) to cost real sustained effort, so the earn rate drops ~10x while **shop prices stay unchanged** — that's the intended lever, not a bug. XP (`XP_PER_TASK_DEFEAT`/`XP_PER_HABIT_COMPLETE`, still 10/5) is deliberately untouched — this is a currency-only change, not a leveling-pace change.

**Sub-task points (Jeremy's follow-up call):** `SUBTASK_POINTS` 5 → 1 (can't cleanly halve a base of 1 anymore). Beyond the rounding fix, Jeremy asked for a real behavior change: when a task has sub-tasks, checking off the PARENT now earns **0 points** of its own — all the points for that task come from completing its subs, not from the parent's own completion. Implemented via a new `hadSubTasks = !isSub && item.completedSubTasks > 0` gate in `Items.completeItem`/`uncompleteItem` (symmetric award/refund); XP is unaffected either way (parent still earns its own `XP_PER_TASK_DEFEAT`). A plain standalone task (never had subs) is unaffected.

**Habit rate bonus re-anchored (Jeremy's call):** the old tiers were anchored to "task parity" (≥90% → 2× of the 5-pt base = 10 = a task's value), which stops meaning anything once tasks are worth 1 too. Jeremy's replacement, citing the "~22 reps to form a habit" research figure: `HABIT_RATE_WINDOW` 14 → **22**; `HABIT_RATE_MIN_SAMPLE` 7 → **22** (deliberately equal to the window — no tier can fire until a full 22-occurrence history exists; "100%/80% of the last 22" isn't meaningful on a partial window); `HABIT_RATE_TIERS` re-tuned to **100% → 3×, ≥80% → 2×** (was 90%/70% → 2×/1.5×). The 80% floor is deliberate wiggle room — a few slips over 22 tries still keep the bonus. At the new 1-pt base this yields 3/2/1 pts for great/good/poor consistency.

**Alternatives considered (all Jeremy's explicit choices, asked via clarifying questions before implementing):** sub-task points could have rounded to 0 instead of 1 (rejected — makes completing a sub feel worthless); the 80% habit tier could have used a lower/earlier minimum sample so strong starts pay off sooner (rejected — Jeremy chose "require the full 22 for both tiers," matching the "22 reps" framing literally rather than partially); the old 2×/1.5× multipliers could have been kept as-is despite both tiers rounding to the same 2-pt value at base 1 (rejected as illegible — see Habit tiers question).

**Verification:** updated 3 test files whose expectations hardcoded the old numbers/behavior (`test/subtask-economy.test.js` — rewritten around the new "0 pts for a subbed parent" rule, +2 new tests; `test/habits.test.js` — `pointsMultiplier`/`applyHabitCompletion`/`applyHabitIndulgence` tiers rebuilt around the 22-window; `test/items-indulge.test.js` — one fixture's starting balance adjusted so a 1-pt debit still crosses zero). 58 suites, 1258/1258 (+2) in the sandbox. Live Chrome playtest against Jeremy's real `node server.js` pending in this same session — see HANDOFF.md.

**Not touched:** shop prices/`CONFIG.SHOP_ITEMS` (unchanged, on purpose — see above); achievement thresholds (task/habit-count and streak-based, not points-denominated, so unaffected); the debt/break-even HUD messaging (already derives "complete N tasks to break even" from `pointsPerTask` dynamically — reads correctly at any value, no code change needed, numbers will just be larger now).

## 2026-07-21 — Reset button moved into Settings + in-app confirm modal; FAB menu restyled for contrast (Cowork session, Sonnet)

**Decision:** Jeremy's report — the FAB menu's white pop-out items were low contrast on the light game background, and separately the "↺ Reset" button lived as a floating bottom-left corner button on the main game screen, one accidental tap from wiping a real save. Two independent, small/UI-only fixes batched in one session per the revised guardrail (neither touches persistence schema, architecture, or balance).

**Reset button:** moved from `index.html`'s floating `#resetTestButton` into a new "Reset Game" section at the bottom of the Settings window (`js/ui/settingsView.js`), styled as destructive (red border/heading/button, warning copy pointing at Export first). Also swapped its confirmation from the browser's native `confirm()` to an in-app `Modal.open` confirm dialog, matching Import's existing replace-confirm pattern — consistent look, and native `confirm()`/`alert()` are documented (CLAUDE.md) to freeze Claude-in-Chrome CDP automation, so this removes the navigate-away workaround for testing this flow going forward. Wipe logic itself (`handleConfirmReset` in script.js) is unchanged from the retired handler — same fields cleared (definedHabits/definedRoutines/definedTasks/runHistory/lifetime achievements), same re-init/save. Wired through `managementWindows.js`'s existing settings-dispatch deps pass-through (`onConfirmReset`), same shape as `onConfirmImport`.

**FAB menu contrast:** `.fab-menu-item` (`css/fabMenu.css`) changed from a white card + pale-green border to the same dark-green gradient as the `.fab` button itself, white text/icons, stronger shadow — the six-item popout now reads as one clearly visible dark cluster instead of near-invisible white-on-light outlines.

**Alternatives considered:** kept the native `confirm()` and just moved the button — rejected since it doesn't fix the CDP-freeze testability problem and the in-app modal is one small addition reusing an existing pattern.

**Verification:** 58 suites / 1256/1256 in sandbox (unchanged — no test file touched, this is DOM/CSS wiring only). `node --check` clean on script.js/settingsView.js/managementWindows.js. Live-verified end-to-end in Chrome via a live `node server.js`: floating Reset button confirmed gone from the main screen; FAB menu screenshot confirms dark-green high-contrast items; Settings → Reset Game → confirm dialog opens without freezing automation; Cancel closes only the dialog (Settings stays open); a real task created through the UI, then Reset → Reset Game → confirm wiped it — board returned to the onboarding empty state and the persisted save's `activeItems` read back as `[]`. Zero console errors. Dev save left in its post-reset pristine state (harmless).

## 2026-07-21 — Habits render at regular (task) size; sub-tasks stay the only visually-smaller tier (Cowork session, Sonnet)

**Decision:** Jeremy's call — habit zombie sprites now render at the same 128px regular size as tasks, since sub-tasks already own the "visually smaller" treatment (a genuine 64px box, `CONFIG.SUBTASK_ENEMY_WIDTH`). Habits ALSO shrinking (to 70px, via a `zombie-small` CSS class) was redundant and made the size hierarchy confusing (task > habit > sub-task, when only two visual tiers — regular vs. sub-task — are meaningful). Retired the `zombie-small` class and its two duplicate CSS rule blocks (`enemySprites.css`'s `.zombie-sprite.zombie-small.zombie-*`, `enemyStatus.css`'s `.enemy.habit-enemy.category-*`) that both forced `background-size: 70px 70px !important`. `js/spawning.js`'s `resolveEnemyVisual` no longer pushes `zombie-small` for habits; two other places that hand-duplicate this DOM construction (`js/items.js`'s `uncompleteItem`, `js/ui/dayPagerView.js`'s ghost-sprite builder) were updated to match — the latter two were ALSO found to hardcode habit height as 70 while `spawning.js` itself already used 128, a pre-existing three-way inconsistency now reconciled to 128 everywhere.

**What stays:** the `habit-enemy` class is kept for its non-size hooks — dashed border (now the sole habit identity marker), negative-habit badge, high/super-streak flame effects. `.enemy.habit-enemy`'s CSS no longer sets width/height (previously 70px, dead code anyway since inline JS always won on layout size — cleaned up for clarity).

**Why layout-only, no schema/balance change:** purely visual/CSS — no persisted data, no balance number, `ENEMY_WIDTH`/`HABIT_ENEMY_WIDTH` were already both 128 in `CONFIG` (the shrink lived entirely in CSS `background-size` overrides, not the box dimensions), so no balance-tuning protocol needed (same category as other display-only constants per `config.js`'s existing note).

**Verification:** 58 suites / 1256/1256 (`test/spawning.test.js` updated: habit case now asserts `zombie-small` is absent). `node --check` clean. Live-verified in Chrome: created a task and a same-category ("Other") habit side by side — both rendered as identical 128×128 `other-zombie.png` sprites (confirmed via computed `backgroundSize`/`offsetWidth`/`offsetHeight`), habit distinguished only by its dashed border outline. Zero console errors. Dev save reset to pristine afterward.

## 2026-07-21 — Star-rating bug fix: rolling rate window + tenure gate replaces all-time average (Cowork session, bug reported live on Jeremy's phone; design discussed conversationally, executed Sonnet)

**Bug:** Jeremy created a morning routine with one habit ("brush my teeth") and completed it once; the routine instantly showed 5 stars. Root cause: `Heroes.completionRate` computed an all-time average with no minimum-sample floor, and `Heroes.starRating` checked that average against fixed rate cutoffs (PROJECT_SPEC ~78-83: 60/70/80/90/95% → 1-5★) with no other gate. One habit, one completion = 1/1 = 100%, which cleared the top tier immediately.

**Decision:** Deliberate deviation from PROJECT_SPEC's literal spec (which defines only the five rate cutoffs, no minimum-sample or tenure concept) — confirmed with Jeremy before building, per the "don't invent mechanics without asking" guardrail. Two changes:
1. **Rolling rate window** (`CONFIG.HERO_STAR_RATE_WINDOW = 28`): the rate is now computed over the most recent 28 recorded occurrences across ALL the routine's member habits (merged and sorted chronologically), not an all-time average. Mirrors `HABIT_RATE_WINDOW`'s existing 14-occurrence window for the habit points multiplier (doubled, since a star rating is a bigger commitment than a points multiplier).
2. **Tenure gate** (`minDays` added to each `CONFIG.HERO_STAR_TIERS` entry: 2/4/7/14/21 for 1★-5★): a star tier requires BOTH its rate cutoff AND a minimum count of distinct calendar days with a recorded occurrence (since routine creation, NOT limited to the 28-occurrence window — tenure is meant to span the routine's whole life, not just its recent rate sample). Modeled loosely on mobile-game prestige pacing: 1★ is reachable within a couple of days, 5★ is a ~3-week track record, not a first-day flex.

Both numbers are DERIVED from existing `occurrenceHistory` data, not new persisted fields — no schema bump, same "derive don't store" precedent as the banked-slot-points system (avoids any level-oscillation-style exploit).

**Why these specific numbers:** No canonical spec value exists for either (PROJECT_SPEC predates the idea of a minimum sample). 28/2-4-7-14-21 were proposed as a reasonable mobile-game-style pacing curve and confirmed with Jeremy in conversation before implementation; not a Fable-tuned balance pass. Revisit if real play data suggests the pacing feels off (per the standing balance-tuning protocol).

**Also fixed:** the Manage-modal completion-% label (`js/ui/routineViews.js` `buildCompletionRateLabel`) now appends the tenure count ("67% of 3 · 3 days tracked") so a routine sitting at a high % with a low/zero star rating reads as "not enough track record yet," not a display bug.

**Rejected:** a flat minimum-sample gate alone (e.g. unrated below 7 occurrences, otherwise unchanged) — considered as the smaller/quicker fix, but Jeremy chose the fuller redesign since the all-time-average also had a separate staleness problem (months of history could mask a recent bad stretch).

**Verification:** 58 suites / 1256/1256 (new heroes.js/heroes-view.js/routine-views-slots.js coverage for the rolling window, tenure gate, and the exact reported bug scenario: 1 occurrence/100% rate/1 day tenure → 0★). `node --check` clean on all touched files. **Live-verified in Chrome** against Jeremy's running `localhost:8000` dev server: created a real routine ("Morning Routine") with one habit ("Brush Teeth"), completed it once — reproduced the exact reported scenario. Hero chip and Manage-modal both correctly showed ☆☆☆☆☆ / "(100% of 1 · 1 day tracked)" instead of the bugged 5★. Zero console errors throughout. Dev save reset to pristine first-run state after verification.

## 2026-07-21 — Art direction locked: pixel art stays; slider-coupled parallax in; camera tilt out (Cowork session, Fable)

**Decision (three calls, made together):**
1. **Pixel art is the locked style.** The finished 64×64 zombies stay; all future assets (church damage states, hero sprites, props) match them. This resolves the V4 blocker: church art source = **AI-generate in pixel style** (Retro Diffusion for base generation — feed the current painterly renders as reference; PixelLab if animation/rotation frames are needed later). Same 5 filenames, zero code churn. Current AI tool landscape (researched this session): Retro Diffusion + PixelLab is the de facto pixel stack and pixel art's low resolution hides AI frame-consistency flaws — the animation problem that blocked Jeremy's 2025 attempt is now solved *for pixel art specifically*, weakest for high-detail styles.
2. **Slider-coupled parallax background layers join V1's scope.** Layered scene (sky/clouds/far silhouettes/ground) where each layer's `translateX` is driven off the time-slider value at a different rate (clouds fastest, ground fixed) — scrub direction becomes visually legible and the layers give depth. Idle ambient cloud drift gated behind fx-intensity + `prefers-reduced-motion`, like the fog.
3. **Camera tilt on slider movement: rejected.** Rotating pixel art breaks the pixel grid (shimmer/artifacting at even small angles), portrait's glance strip has no scene to tilt, and the parallax differential already delivers the "world responds to scrubbing" feel. Revisit only after V1 ships, and then only ≤1.5° on background layers, never sprites.

**Why:** Jeremy's instinct to abandon pixel art came from a visibility worry (sprites lost over a pixel background) — diagnosed as a contrast problem, not a style problem, and V1's dark low-detail silhouette background already solves it. Switching styles would mean regenerating 8 zombies + sub-task variants + 5 base states + future heroes while unblocking nothing.

**Rejected:** Non-pixel cartoon restyle (cost above; also AI animation consistency is weakest there); vector/SVG sprites (pipeline is raster PNG + DOM/CSS, AI tools output raster, pixel art is inherently raster — SVG stays scene-props-only per V1); camera tilt (above).

## 2026-07-20 — Visual design direction + VISUAL_DESIGN_PLAN.md (Cowork session, Fable)

**Decision:** Ran a live screenshot audit of the GitHub Pages build (desktop + real 390px mobile render via a same-origin iframe, seeded dev data across all state classes) against ART_STYLE.md's "pixel art, playful, slightly eerie graveyard" direction, and wrote `docs/VISUAL_DESIGN_PLAN.md` — audit findings, five direction calls, and execution sliced into Sonnet-sized sessions (V1 graveyard atmosphere → V2 sprite-hugging state indicators → V3a/b/c mobile → V4 pixel church → V5 token enforcement → V6 juice). Direction highlights: the graveyard gets built CSS/SVG-first (no new binary assets needed for the mood); every rectangle-border state indicator moves onto the sprite silhouettes via `drop-shadow` (V2 will formally supersede the session-73 "habit dashed border is intentional" note when it executes); app chrome enforces the EXISTING base.css token system rather than inventing a new one (two competing primary greens in live use — pick one); theming stays light because this is a daily-use productivity app.

**Why:** Jeremy is spending a week generating real daily-play data before scoping Milestone 6 functionality; visuals are the parallel track that never touches persistence/architecture/balance, so the sessions can interleave with the play week. The audit's core finding: the finished pixel zombie sprites carry the entire game feel alone — flat gradient battlefield, painterly church with a placeholder "CHURCH" label, debug-looking rectangle indicators, and a mobile canvas that becomes a sprite pileup.

**Rejected:** Doing a single big visual overhaul session (violates one-system-per-session spirit and can't interleave with playtesting); pixel-art asset production as the first step (CSS/SVG silhouettes deliver ~80% of the atmosphere with zero new assets and no art-source decision needed).

**Open (blocks V4 only):** church art source — commission / AI-generate / pixelate the existing renders. Jeremy's call, no rush.

## 2026-07-20 — Mobile design: portrait = glance strip, landscape = full scene (Jeremy's design, Cowork session, Fable)

**Decision (Jeremy's proposal, refined together):** Portrait phone stops trying to render the full battlefield. The canvas collapses to a thin (~64-80px) "threat strip": church icon at the left edge (reusing `Assets/icons/icon-192.png`), category-colored dot/icon markers positioned by the same `Clock.calculateTimelinePosition` math, cluster count badges, midnight line when on-screen — and anything OVERDUE renders as the actual small zombie sprite pulsing at the base edge (markers stay abstract until the threat is real). Below the strip: week strip + day pager stay prominent, hour slider slims to a thin scrubber; the agenda list owns the rest of the screen — portrait's focus IS the list. Rotating to landscape shows the full desktop scene (V1 graveyard) down to the slider, with tap-to-interact: hero chip → that routine's management window, enemy tap → the existing popup (complete/edit/pushback from the game view). Both tap behaviors also ship on desktop. Implementation rule: the strip is a CSS/render VARIANT of the same DOM and state — never a second component.

**Why:** The audit proved that at 390px no shrunken version of the desktop scene is both a readable tower-defense timeline and out of the list's way (church ate ~40% of canvas width; lurk post landed mid-canvas; two overdue clusters = total pileup). Redefining the modes matches real usage: on a phone during the day you're checking off tasks (glance + list); the game-watching mode is a rotation away.

**Rejected:** Capping desktop-scene proportions on mobile (the original V3 scope — splits the difference, wins neither); tiny scaled sprites for all portrait markers (pixel art degrades below ~32px and clusters go muddy again); pure abstract markers with no sprites ever (loses all personality on the most-used screen — hence the overdue-zombie exception); collapsing pager/slider behind a toggle (day-paging is too core to cost an extra tap).

## 2026-07-20 — Overdue-damage bug root-caused: edit-into-past back-charges uncapped; both design forks resolved (Cowork session, Fable)

**Context:** During the visual audit, editing a task's due time from ~10 PM back to 9 AM dealt −92 HP (100→8) in seconds. Jeremy confirmed intent: 1 HP per 5 min overdue, capped at 12 per item — so this is a bug, not balance.

**Root cause (confirmed in code, fix NOT implemented this session):** `recomputeOverdueStateAfterEdit`'s pulled-into-the-past branch calls `markAsOverdue` (items.js:1211), which parks `lastDamageTickTime = dueDateTime.getTime()` (line 1222) — ~13h in the past = ~157 pending `CONFIG.DAMAGE_INTERVAL_MS` intervals, and loop.js:148-173 pays one per game tick, uncapped, until caught up. This is the LAST unguarded entry of the 2026-07-18 far-past-clock bug family: create-already-overdue (spawning.js:145 → clock at spawn), restore (state.js:478 → Date.now() + capped offline path; its comment names this exact hazard), and suspended-loop gaps (`runLiveGapCatchUp`, capped) are all guarded. None of the 1237 green tests exercise the edit-into-past path — that's how it survived.

**Design forks resolved (Jeremy, via AskUserQuestion):**
1. **Edit-into-past back-charges NOTHING** — the damage clock starts at `Date.now()` when the edit lands, matching the created-already-overdue precedent. An edit is a bookkeeping correction, not evidence the base was under attack. (Rejected: capped-12 back-charge per the reload precedent — same player-facing rule everywhere was considered and declined in favor of no surprise spikes on an interactive action.)
2. **Live page-open overdue damage deliberately stays UNBOUNDED** — the 12 cap is an anti-frustration guard for time you weren't playing (offline/gap catch-up only); sustained pressure while actively playing is intended. The fix must NOT add a live cap. (Rejected: cap everywhere.)

**Follow-up:** Fix is queued in ROADMAP Known bugs — pure Sonnet execution now (guard the edit path, regression test covering edit-into-past directly). Until fixed, Jeremy should avoid editing due dates backwards on his real save; a big enough pull can insta-kill a run.

## 2026-07-20 — Phone deployment: GitHub Pages, public repo (Cowork session)

**Decision (Jeremy's call via AskUserQuestion):** Host beyond localhost via GitHub Pages (main branch, root) rather than Cloudflare Pages + private repo. Free-tier GitHub Pages requires the repo be public; Jeremy considered the exposure (full source, design docs, PROJECT_SPEC.md, session handoffs all become publicly fetchable) and decided to proceed as-is for now rather than trim a `gh-pages`-only branch or switch hosts. No secrets found in a repo-wide grep before this decision (`${{ secrets.GITHUB_TOKEN }}` in PROJECT_SPEC.md is a GH Actions placeholder, not a real credential).

**Implementation:** No code changes — a full repo audit (index.html, script.js, js/**, css/**, sw.js, manifest.json) found every asset/script/fetch reference already relative-path-safe for serving from a `/Deadline/` subpath (`sw.js` registers as `'sw.js'`, manifest `scope`/`start_url` are `./`, offline fallback is `caches.match('index.html')`). Jeremy enabled Pages in repo settings (Settings → Pages → Deploy from branch → main / root).

**Verification:** Live-tested in Chrome at `https://schooley02.github.io/Deadline/`: SW reaches `activated`, manifest.json fetches, real task create→spawn→complete round-trip (XP 0→10, Points 0→10) with week-strip live update, zero real app console errors. Hit the standing `confirm()`/CDP-freeze issue (CLAUDE.md) clicking the Reset button — recovered via navigate-away, then re-verified Reset works correctly by stubbing `window.confirm` first, confirming the save returns to a genuine pristine first-run state (onboarding empty-state from the prior session correctly reappears).

**Alternative considered:** Cloudflare Pages with a private GitHub repo — same free hosting, zero public exposure, no code changes needed either way. Declined for now; revisit if Jeremy decides the exposure matters more once the game is closer to a real launch.

## 2026-07-20 — First-run/onboarding pass shipped, scoped to "Empty-state + FAB hint" (Cowork session)

**Decision (scope, Jeremy's pick via AskUserQuestion before building):** Of four options offered — empty-state + FAB hint / + sample starter content / a guided step-by-step tutorial / something else — Jeremy chose the first, matching PROJECT_SPEC's existing "Empty State" spec (Dynamic Task List section) at MVP fidelity: real "no tasks yet" messaging + a primary CTA + a subtle FAB pointer, using only existing CSS/assets (no new illustrations, no particle animations from the fuller spec vision). Sample-content seeding and the guided tutorial were explicitly deferred, not built.

**Implementation:** `AgendaList.isFirstRunEmpty(state)` (`js/ui/agendaList.js`) — pure, true only when `activeItems`, `completedItems`, `definedHabits`, and `definedRoutines` are ALL empty, i.e. the player has never engaged with the app at all. Deliberately NOT a persisted flag/schema field: fully derived from state that already exists, so no migration is needed, it clears itself the instant the first task/habit/routine is created, and it can harmlessly reappear if a player deletes their way back to zero (treated as correct — still an empty board either way — not a bug to guard against). `sortAndRenderActiveList` renders the onboarding block (church emoji, "Welcome to Deadline!", one-line explainer, "+ Add Your First Task" CTA using the existing `.primary-button` style) in place of an empty list when true, and toggles a `.onboarding-hint` pulse class on `#fabButton` (CSS-only, `prefers-reduced-motion`-gated, deliberately NOT gated by the session-59 fx-intensity setting since it's a one-time UI affordance rather than a per-tick gameplay effect — a different concern). The CTA opens the Tasks window directly via a new `openManagementWindow` dep threaded through `agendaListDeps()` — one tap closer than routing through the FAB menu, reusing the exact same window the FAB→Tasks path opens.

**Real regression found + fixed live in Chrome:** the CTA button, live-tested against a genuinely cleared-localStorage first-run save, opened the Tasks window and then IMMEDIATELY closed it again on the same click. Root-caused via a `classList.remove`/`add` trace (not a guess): `ManagementWindows.openManagementWindow('tasks', deps)` was confirmed firing correctly every time, with the correct `deps.managementWindows.tasks` reference, and correctly called `win.classList.remove('hidden')` — but the SAME click event then bubbled to `document`, where `Modal.initDismissHandlers`'s global "click outside any open management window closes it" listener ran, saw the CTA button wasn't inside `.management-window` or `.fab-container` (the only two exemptions that listener checks), and called `closeAllManagementWindows()`, re-adding `hidden` within the same synchronous event. The FAB menu never hits this because FAB menu items live inside `.fab-container`, which Modal's dismiss check explicitly exempts — the onboarding CTA lives in `.task-section`, which isn't exempted anywhere. Fixed with `e.stopPropagation()` on the CTA's own click listener rather than adding a new exemption to Modal.js's shared dismiss contract — the CTA is a one-off trigger from outside the FAB, not a whole container of legitimate open-triggers, so a local fix was the better-scoped match (Modal.js's dismiss logic stays untouched for every other caller). The Jest fake-DOM helper's shared `fire(evt)` (`test/agenda-list.test.js`) previously called listeners with no arguments — updated to pass a minimal fake event (no-op `stopPropagation`/`preventDefault`) so the new handler is testable without changing behavior for the many existing handlers that never read their event arg.

**Testing:** 58 suites, 1237/1237 (+10 in `test/agenda-list.test.js`: 5 pure `isFirstRunEmpty` cases + 5 `sortAndRenderActiveList` render-branch cases covering onboarding-shown, CTA-click, habit-suppresses-onboarding, active-item-suppresses-onboarding, and FAB-hint-clears-on-transition). `node --check` clean on `script.js`/`js/ui/agendaList.js`. Live-verified in Chrome end-to-end via a genuine first-run save (localStorage cleared with `Persistence.requestSave`/`flush` neutered first, per the standing write-then-reload race precedent, then a real hard reload to rule out HTTP-cache staleness): onboarding block + FAB pulse rendered on a fresh Health 100/XP 0/Level 1/Points 0 save; CTA opened Tasks and, after the stopPropagation fix, STAYED open; created a real task through it, which replaced the onboarding block with the normal board and cleared the FAB hint; completed that task back down to an empty board and confirmed the PLAIN neutral empty state rendered instead of onboarding (since `completedItems` was no longer empty) — the "returning player, empty day" case correctly stays distinct from "true first-run." Zero real app console errors throughout (only the standing Chrome-extension message-channel noise). Dev save is now a genuinely fresh save containing one real task/completion cycle from this verification — left in place, harmless for a dev save (same precedent as prior sessions).

## 2026-07-20 — UX fixes batch shipped: all 4 playtest findings fixed in one Sonnet session (Cowork session)

**Decision:** Shipped all four items from the "UX fixes batch" ROADMAP entry in a single session (small/independent, per the revised batching guardrail — none touched persistence/architecture/balance):
1. **Week strip live-refresh.** Root cause: script.js had TWO separate inline closures (`stateDeps()`'s `updateTaskCountDisplay` and `spawningDeps()`'s copy) that each called `Hud.updateTaskCountDisplay` directly — no single choke point existed for `js/ui/dayPagerView.js`'s week strip to hook into. Unified both into one real `updateTaskCountDisplay()` function (matching the existing thin-wrapper convention at script.js's `sortAndRenderActiveList`/`renderCompletedItems` etc.) that also calls a new `DayPagerView.refreshWeekStrip()` (calls the existing `renderWeekStrip()` internal, guarded the same way, WITHOUT re-running the rest of `render()` — avoids touching the ghost canvas/agenda or the `.viewing-other-day` class on every routine task-count update). Every `deps.updateTaskCountDisplay()` call site across items.js/spawning.js/state.js gets the strip refresh for free since they all resolve to the same script.js function.
2. **Evening due-time default.** Implements the rule decided in the scoping session above: `js/ui/forms.js`'s new pure `computeDefaultDueTime(now)` = max(5:00 PM, now + 1h rounded UP to the next half-hour), capped at 11:59 PM same day. Rounds up (never down) so the default is always strictly in the future relative to "now + 1h"; the cap prevents a same-day task from getting a next-day-rolled, impossible-to-hit default. 9 new tests (`test/forms-due-time-default.test.js`) cover the daytime/evening/rounding-boundary/cap cases plus one HTML-embedding integration test.
3. **Day-scoped task count.** `dayPagerView.js`'s `render()` now calls a new `setDayScopedTaskCount(count)` on ghost/snapshot pages (Yesterday's snapshot length, or a future day's ghost count) and restores the real global count via `deps.updateTaskCountDisplay()` when returning to Today — matches the session-73 week-strip convention that Today must always count `activeItems` directly, never the ghost/conjure path (which under-counts Today since its spawn-check functions correctly exclude anything already spawned).
4. **Completed Today hidden off-Today.** New dedicated CSS class `.day-pager-hidden` (not the shared `.hidden` utility AgendaList's own `renderCompletedItems` toggles based on whether there are any real completions) — added/removed by the same `render()` branches as the count. Deliberately a SEPARATE class from `.hidden` so the two owners (dayPagerView's "which day am I viewing" concern vs AgendaList's "are there any completions" concern) can never fight over one flag depending on toggle order.

**Why no design forks needed:** all four were mechanical once finding #2's default-time rule was already decided in the prior scoping session (Fable). Straightforward Sonnet execution.

**Testing:** 58 suites, 1227/1227 (+9, all in the new forms-due-time-default suite — findings #1/#3/#4 are DOM-wiring changes with no pure core to unit-test, matching this cluster's existing test-coverage pattern where `dayPagerView.js`'s render() itself has no direct Jest coverage, only `formatDayLabel`). `node --check` clean on `script.js`/`js/ui/forms.js`/`js/ui/dayPagerView.js`. Live-verified in Chrome end-to-end (SW cache cleared first): created a real task and watched the week strip's Today count update from 2→3 with ZERO pager navigation; opened Add Task at a real 8:13:25 PM and confirmed the time input pre-filled exactly 9:30 PM (8:13 + 1h = 9:13, rounded up to the next half-hour); paged to Tomorrow and confirmed the header showed "1 task" matching the real single ghost row (previously showed the stale global "2 tasks") with Completed Today fully hidden; paged back to Today and confirmed both restored correctly (3 tasks, Completed Today visible again). Zero real app console errors (only the standing documented Chrome-extension message-channel noise).

## 2026-07-20 — Milestone 5 scoping via structured live playtest; UX-fixes batch queued first (Cowork session, Fable)

**Decision:** Milestone 5's next item is a **UX fixes batch** (one Sonnet session, per the revised small/independent-work batching guardrail) covering the four findings from this session's structured Claude-in-Chrome playtest:
1. **Week strip doesn't live-refresh** — `renderWeekStrip()` runs only on load/pager navigation, not on task/habit create/complete/uncomplete. Observed live: strip showed "Today 1" with 0 active items after a completion, and again "Today 1" with 2 active items after two creations.
2. **Evening instant-overdue footgun** — Add Task's due-time default is a hard 5:00 PM today; created at 7:35 PM untouched, the task spawns already overdue and starts damaging the base. **Design call (Fable, this session): default due time = max(5:00 PM, now + 1h rounded up to the next half-hour), capped at 11:59 PM same day.** Daytime keeps the familiar 5 PM anchor; evening creation can never spawn already-overdue. (The existing "already-overdue items start their damage clock at spawn" rule from 2026-07-18 caps the harm but the default is still wrong.)
3. **Task-count header ignores the viewed day** — "Tomorrow's Deadlines" showed "2 tasks" (global active count via `Hud.updateTaskCountDisplay`) while the page listed 1 ghost row.
4. **"Completed Today" section renders under non-Today pager views** — confusing under "Tomorrow's Deadlines".

**Why this item first:** all four were hit in ~20 minutes of ordinary play; they're small, independent, and testable, and polish friction is exactly Milestone 5's charter.

**Considered, not queued yet (revisit after the batch):** phone deployment (hosting beyond localhost so the PWA install + Export/Import combo enables real daily play — the milestone's data-generating premise) and a first-run/onboarding experience (fresh save drops the player on an empty board with zero guidance). Jeremy chose to queue only the UX batch for now.

**Playtest method note:** SW cache cleared before the trusted navigation; every core surface exercised (create/complete task, habit create + Tomorrow ghosting, day pager both directions, week strip, time slider snap-back, Shop/Stats/Settings windows); zero app console errors all session. One false alarm retracted: habit sprites' dashed border is intentional (`css/enemyStatus.css:63` `.enemy.habit-enemy { border-style: dashed }`), not day-pager ghost-class leakage.

## 2026-07-20 — Export/Import ("Backup & Transfer") shipped — Milestone 5 first item (Cowork session, Sonnet)

**Decision:** Built cross-device / cross-build-version save portability, Jeremy's explicit ask (plays/tests across desktop and phone, and across in-development builds). `js/exportImport.js` (pure build/validate of a portable JSON envelope wrapping both `deadline.save` and `deadline.settings`) + `js/ui/settingsView.js`'s new "Backup & Transfer" section (Download file / Copy to clipboard / file-picker-or-paste import) + script.js's `handleConfirmImport` (the one stateful step: backup, write, reload). Full contract in docs/DATA_SCHEMA.md's new Export/Import section; UI in docs/UI_UX.md.

**Forks resolved (with Jeremy before building):**
- **No cloud sync** — manual export/import only. Cloud would need a backend + accounts + conflict resolution and directly contradicts the session-74 PWA call ("packaging only, no sync"). QR code rejected too (save size, e.g. 50-run history, blows past QR capacity).
- **Full replace, no merge.** Merging two independent play histories (id collisions, conflicting streak/occurrence history) is a correctness tar pit with no payoff for either use case (pick up where you left off / test a different build).
- **A save from a different point in wall-clock time is NOT special-cased.** Import = write + reload, so normal offline catch-up runs exactly as it would after closing the app for that long (same per-item damage cap as always). Considered and rejected: skipping catch-up once on import — would add a special-case flag through the restore path for a dev-testing convenience that isn't worth the divergence from normal reload behavior.
- **Player-facing in Settings, not dev-only.** It's legitimately useful as manual backup for any player, and the Settings window (6th FAB item) already exists to house it.
- **A newer-schema (or newer-exportFormatVersion) import is rejected outright, never downgrade-mangled.** An older schema imports fine — the write is RAW (bypasses `Persistence.serialize`, which would re-stamp the current schemaVersion) so the normal migration chain runs on reload, same as any other page load.
- **checksum, not a rotated backup history.** FNV-1a over the envelope (minus the checksum field itself) — corruption/truncation detection only, not cryptographic. `deadline.backup.preImport` is ONE slot, overwritten by the next import; explicitly a "recover from a mistake" safety net, not a version log.

**Real regression found live in Chrome, fixed same session:** `handleConfirmImport` originally wrote the imported save to `localStorage` and immediately called `window.location.reload()` — but `reload()` is asynchronous, and script.js has a 5s autosave safety net (`CONFIG.PERSISTENCE_AUTOSAVE_MS`) plus debounced `Persistence.requestSave`/beforeunload-flush hooks. One of these fired in the async gap and re-serialized the LIVE (pre-import) in-memory state right back over the freshly-written import, so the "imported" save silently reverted to the old data every time — confirmed via a live round-trip test (built a synthetic envelope with distinctive values — Health 77/XP 999/Level 7/Points 12345 — via `ExportImport.buildEnvelope`, pasted it through the real Import UI, confirmed the replace, and found the HUD still showed the OLD values post-reload; `localStorage.getItem('deadline.save')` confirmed it matched the pre-import backup exactly). Same class of hazard as the session-52 "stub flush/requestSave before a direct localStorage edit" trick already documented in CLAUDE.md's Cowork section — applied here too: `Persistence.requestSave`/`Persistence.flush` are neutered to no-ops immediately before the write (module state is thrown away by the reload regardless, so this is safe). Re-verified after the fix: exact byte-for-byte restore (Health 77/XP 999/Level 7/Points 12345, settings `effectsIntensity: 'off'`), zero console errors, backup key correctly held the pre-import values (Points 0).

**Also found a wiring gap the day-1 pass missed:** script.js's `openManagementWindow` deps object gained `buildExportEnvelope`/`currentSummary`/`onConfirmImport`, but `js/ui/managementWindows.js`'s `'settings'` dispatch branch only forwarded `currentIntensity`/`onChangeIntensity` to `SettingsView.renderSettingsWindow` — the three new fields never reached the view, throwing `TypeError: deps.buildExportEnvelope is not a function` on the Export buttons. Caught immediately via live Chrome console reading (not Jest — this cross-module pass-through has no unit coverage, same class of gap as script.js itself). Fixed by adding the three fields to managementWindows.js's settings dispatch.

**State:** 57 suites, 1218/1218 (+13 new `test/exportImport.test.js`, unchanged elsewhere). `node --check` clean on all 5 touched/added files (script.js, js/exportImport.js, js/settings.js, js/ui/settingsView.js, js/ui/managementWindows.js). Live-verified in Chrome end-to-end: clean boot, Settings window renders the new section, Copy-to-clipboard succeeds, a full paste→validate→confirm-modal (current-vs-incoming compare rendered correctly)→confirm→reload→exact-restore round trip, and all three rejection paths (truncated/garbage JSON, tampered checksum — Jest only, newer-schemaVersion, newer-exportFormatVersion) render the correct inline error with no modal opened. Zero console errors throughout every pass. See docs/DATA_SCHEMA.md/UI_UX.md/ROADMAP.md.

---

## 2026-07-20 — State-ownership migration sub-session 3: wrapper retirement, real regression found + fixed, migration CLOSED (Cowork session)

**Decision:** Executed sub-session 3 (wrapper retirement pass) and sub-session 4 (docs close-out, folded in) of `docs/STATE_OWNERSHIP_PLAN.md`, closing the whole state-ownership migration. Inlined ~15 true one-liner delegation wrappers (functions whose entire body was a single delegating call, with no other logic) at their call sites in script.js — `computeDaysSurvived`, `updatePlayerDisplays`, `updateTaskCountDisplay`, `restoreGameState`, `showLevelUpMessage`, `addItemToGame`, `createSubTaskPrompt`, `uncompleteItem`, `markAsOverdue`, `recomputeOverdueStateAfterEdit`, `renderDefinedRoutines`, `showEditHabitForm`, `toggleFabMenu`, `closeAllManagementWindows`, `closeManagementWindow`, `showFormModal`, `getPersistableState`, `damageBase`, `healBase`, `runLiveGapCatchUp` — while leaving every deps builder (13), real-logic orchestrator (routine management, shop/token handlers, management-window population), and `window.*`-exposed name (the inline-onclick contract) untouched. script.js: 1,995 → 1,838 lines net (was 1,981 after sub-session 1's pure ownership move).

**Regression found and fixed the same session:** the wrapper-retirement pass ALSO deleted 6 wrappers — `sortAndRenderActiveList`, `createListItem`, `handleEnemyClick`, `removeItem`, `renderCompletedItems`, `resetAllSubTaskCheckboxes` — while missing some of their call sites. Specifically, these are referenced as bare object-shorthand identifiers inside deps builders (e.g. `{ createListItem }`, which requires an identically-named binding in scope — not just "the function is called somewhere"), and several such sites were left dangling after the definitions were removed. This produced real `ReferenceError`s that crashed `initGame()` partway through boot. **Jest's 56-suite baseline stayed green throughout** — script.js is never `require()`'d by any test file (it's browser-only), so the automated suite gave false confidence. The bug only surfaced live in Chrome, and even then not obviously: a crashed `initGame()` left the game showing a plausible-looking blank fresh-boot state (Health 100, 0 tasks) rather than an overt crash screen — reading the actual console error output, not just eyeballing the rendered UI, is what caught it.

**How it was found (systematically, not reactively):** rather than patching each `ReferenceError` as it surfaced one reload at a time, a Python script cross-referenced every name mentioned in a "wrapper inlined at its call sites" comment against the real file — checking each was either genuinely undefined-with-zero-references (a clean deletion) or undefined-with-lingering-references (broken). Found all 6 broken wrappers in one pass instead of fixing them one crash at a time. All 6 were restored as real functions (not re-inlined a second time) since each has 2+ bare-reference call sites — the same reasoning `saveGame` was already deliberately left as a real wrapper for (10+ bare-reference sites; inlining would increase line count, not shrink it).

**Also hit and resolved:** the live server (`node server.js`, on Jeremy's own machine) appeared to serve a stale cached copy of script.js for an extended stretch of the debugging session, surviving what looked like genuine restarts. Root cause was the PWA service worker's `deadline-shell-v1` cache-first strategy re-intercepting fetches on every fresh navigation — critically, this overrides even `fetch(url, {cache: 'no-store'})`, since a service worker's fetch handler operates below the HTTP cache layer entirely once it controls the page, and `index.html`'s own SW-registration script re-registers a worker on every load. The file on disk was correct the entire time (confirmed directly via `Select-String` in Jeremy's own PowerShell). Not a real second copy of the repo, not a genuine server-restart failure — purely a client-side caching layer that has to be explicitly cleared (unregister + `caches.delete`) before EVERY fresh navigation used for verification, not just once per session.

**Why the wrapper-retirement conservatism principle held up despite the regression:** the executing subagent's OWN classification rules (deps builders / real-logic orchestrators / `window.*` names — never touch) were sound and correctly applied to everything except these 6 edge cases. The failure mode wasn't misclassifying what to inline; it was an incomplete grep sweep when deleting a correctly-identified wrapper — missing 1-2 of N call sites for a function referenced many places. Lesson for future similar passes: after deleting any function, grep its bare name ACROSS THE WHOLE FILE one more time as a final check, not just at the call sites already found during the initial sweep.

**Process lesson, standing rule going forward:** a Jest-green result is NOT sufficient signal that a script.js edit is safe. Every session that edits script.js MUST live-verify in Chrome before being called done, reading actual console output (not a visual glance at the rendered page) — a silently-swallowed `initGame()` exception can look identical to a normal empty fresh-boot state. Also: SW cache must be cleared before every fresh navigation used for verification within a debugging session, not just once at session start, since a torn-down/recreated browser tab re-triggers `index.html`'s own registration script.

**Verification (post-fix):** 56 suites, 1205/1205 (unchanged), `node --check script.js` clean, both re-confirmed after the restore. Live-verified in Chrome end-to-end: clean boot with zero console errors, task creation (real zombie spawn + agenda row via `createListItem`/`addItemToGame`/`sortAndRenderActiveList`), completion (XP 0→10, Points 0→10, moved to Completed Today), uncompletion (round-tripped exactly back to 0/0 with a fresh DOM row per the session-58 fix), Routines and Tasks FAB management windows opened cleanly (exercising `routineViewsDeps`'s `createListItem` bare-reference site, the second one that broke).

**State-ownership migration is now fully CLOSED** (sub-session 2 descoped per its own entry below, not abandoned; sub-sessions 1/3/4 shipped).

## 2026-07-20 — State-ownership migration sub-session 2 descoped (Cowork session)

**Decision:** Descoped sub-session 2 (plain-reference `activeItems` deps → true getters) rather than executing it, Jeremy's call after recon surfaced the real risk/value tradeoff.

**Why:** Every deps builder already passes `State.getActiveItems()` as the SAME live array reference (not a snapshot copy) — sub-session 1 left this intact. `js/items.js` relies on exactly that reference identity: it does `deps.activeItems.push(...)`/`.splice(...)` to mutate the real array in place. The staleness class sub-session 2 was designed to close only bites if a deps object is HELD across a `setActiveItems()` reassignment, and that reassignment only ever happens inside state.js's own `initGame`/`restoreGameState` — no external deps object crosses that boundary today (every builder in script.js is rebuilt fresh per call, the established convention since session 10). So converting to true getter-function calls (`deps.getActiveItems()`) would touch roughly 10 consumer files (items.js, loop.js, agendaList.js, hud.js, managementWindows.js, popups.js, routineViews.js, routines.js, habits.js, dayPager.js) purely for forward-looking architectural correctness — not to fix anything currently broken.

**Rejected:** Doing it anyway "since the plan called for it." Rejected because the plan was written before this recon; a plan step that turns out to guard against a risk that doesn't exist yet isn't worth the session/review cost, especially given items.js's mutation-dependent sites would need careful individual handling (not a mechanical find/replace) to convert safely.

**Status:** Deferred indefinitely, not abandoned — revisit if a future feature holds a deps object across an async boundary that spans an activeItems reassignment (the one scenario that would make this a real bug). No code changed this entry.

## 2026-07-20 — State-ownership migration sub-session 1: state.js now owns the 21 persisted/lifecycle fields (Cowork session, Fable plan / Sonnet execute)

**Decision:** Sequenced the deferred state-ownership migration (deferred since session 11, 2026-07-18) into `docs/STATE_OWNERSHIP_PLAN.md`, 4 sub-sessions. Sub-session 1 moved storage of the 21 persisted/game-lifecycle fields — `baseHealth`, `playerXP`, `playerLevel`, `playerPoints`, `routineSlots`, `playerInventory`, `sickDayDate`, `currentRunStats`, `runHistory`, `lifetimeStats`, `achievements`, `activeItems`, `completedItems`, `definedHabits`, `definedRoutines`, `itemIdCounter`, `gameIsOver`, `daysSurvived`, `currentGameDate`, `runStartedAtMs`, `lastLoopTickMs`, `lastRegenTickMs` — out of script.js's DOMContentLoaded closure `let`s and into `js/state.js` as its own module-scoped `let`s, with exported `State.getX`/`State.setX` accessor pairs matching the exact names every deps builder (stateDeps, itemsDeps, agendaListDeps, popupsDeps, checkInDeps, loopDeps, timeSliderDeps, dayPagerViewDeps, habitInstanceDeps, routineTaskInstanceDeps, routineViewsDeps, formsDeps) already used as keys.

**Forks resolved (Fable):**
1. Accessor-pair storage in state.js — not a bag object (`State.vars.playerXP`) — so the external contract every other module already holds (accessor functions, never raw bindings) needed zero changes.
2. `window.definedTasks` explicitly OUT OF SCOPE — it's genuinely window-owned (no closure `let` ever existed for it), works today, has 15+ read sites across 3+ files. Its own future session.
3. UI/wiring-local vars stay in script.js, not game state: `GAME_SCREEN_WIDTH`/`BASE_WIDTH`/`ENEMY_WIDTH`/`HABIT_ENEMY_WIDTH`, `gameLoopInterval`, `attackMode`, `offlineCatchUpActive`, `timePreviewActive`, `heroStarMemory`, `heroFxMemory`, `lastAutosaveMs`, `effectsIntensity`.
4. Wrapper retirement extent scoped to sub-session 3 only — this sub-session moves storage, not call sites; every `window.*`-exposed name (inline-onclick contract: `deleteRoutine`, `saveNewHabit/Task`, `saveEditedHabit/Task`, `closeModal`, `closeTopmost`) stays untouched.

**Deliberate deviation found during execution:** `performDayRollover`/`checkLiveDayRollover` in state.js kept taking `getCurrentGameDate`/`setCurrentGameDate`/`getActiveItems`/`isGameOver` through their `deps` parameter rather than reading the new module `let`s directly — converting them would have broken `test/state-day-rollover.test.js`'s synthetic-deps coverage. Behaviorally identical in production (script.js's `stateDeps()` passes `State.getCurrentGameDate` etc. as those same deps keys either way). Also: the plain-reference `activeItems` deps entries (`itemsDeps()`/`agendaListDeps()`/`loopDeps()`) were converted to `State.getActiveItems()` value snapshots rather than true getter-function values — same timing/behavior as before since these deps builders already rebuild fresh per call, but making them genuine getters (closing the restore-staleness class for good) is explicitly sub-session 2's job.

**Why:** Closes the Milestone-2 `<300 lines` boot/wiring goal, deferred at session 11/12 specifically to avoid stacking a storage-ownership change onto the same session that first extracted state.js's functions (persistence-critical, one risky change at a time).

**Verification:** 56 suites, 1205/1205, verified independently outside the executing agent (Jest doesn't load script.js at all — browser-only file, so this alone couldn't have caught a live-wiring regression). Live-verified in Chrome against the real running app: real save restored correctly (Health 47, XP 180, Points 0, 3 tasks), completed a task (XP 180→190, Points 0→10, spawn/render correct), uncompleted it (round-tripped exactly back to 180/0 with a fresh DOM row per the session-58 uncomplete-checkbox fix), `Persistence.flush()` + full page reload confirmed the save/restore round-trip byte-for-byte, zero console errors at any step. `node --check` clean on both `script.js` (1,981 lines, was 1,995) and `js/state.js` (709 lines, was 619).

**No bugs found or fixed this session** (ownership-move only, per CLAUDE.md's "don't invent mechanics" / stay scoped rule) — the pre-existing `window.deleteRoutine` scope quirk (documented in script.js's own comment) is untouched.

**Process note:** the executing agent ran `git diff --stat` against the mounted repo path from the sandbox mid-verification — explicitly forbidden by CLAUDE.md's Cowork git rule (index-lock risk). Checked immediately after: no `.git/index.lock` or other lock artifact was left behind, confirmed harmless this time, but flagging per the standing "trust but verify" convention. No further git commands were run this session.

**Next:** sub-session 2 (plain-reference-deps retirement — `activeItems` etc. become true getters), sub-session 3 (wrapper retirement — the actual line-count win), sub-session 4 (docs close-out, can fold into 3).

## 2026-07-20 — [P2-UI-011] Stage 2 sub-session 5 shipped: routineViews.js migrated — Stage 2 CLOSED (Cowork session, Sonnet)

**Decision:** Migrated all 7 `js/ui/routineViews.js` overlay-creation sites
(`routineManagementModal`, `addItemModal`, `transferItemModal`, `habitFormModal`, `taskFormModal`,
`editHabitFormModal`, `editTaskFormModal`) from `document.body.insertAdjacentHTML('beforeend',
...)` onto `Modal.open(...)`, closing out the `Modal.open()` migration begun in sub-session 1. This
was deliberately the LAST sub-session because it's both the largest cluster and the only one with
stacked overlays (`addItemModal`/`transferItemModal` opening on top of `routineManagementModal`),
so `closeTopmost()` had nothing left to surprise it by the time it got here.

**What changed:** Every site was a mechanical swap — no `dedupeSelector` or `defer` option needed
anywhere in this cluster, matching popups.js's pattern (all synchronous, click-triggered inserts,
no sibling-dedupe requirement). The three "rebuild-in-place" `setTimeout(100)` call sites (habit
add / item transfer / routine-status-toggle each calling `Modal.closeModal()` then reopening
`showRoutineManagement` a tick later) were left untouched — that's the same "refresh the window
underneath after a modal action" pattern already confirmed out-of-scope in forms.js and popups.js,
a different hazard class than what `Modal.open()`'s `defer` option guards against.

**Verification:** 56 suites, 1205/1205 (unchanged — routineViews.js has no dedicated unit
coverage). `node --check` clean. Live-verified in Chrome against the real running app: built a
3-deep overlay stack (Manage Routine → Add Habit → Create New Habit) and confirmed `closeTopmost()`
(via ESC) closes exactly one overlay per press while the ones underneath stay in the DOM, dimmed,
and interactive; created a real habit through that stack and confirmed `showRoutineManagement`
correctly rebuilds in place; opened Edit Habit stacked on Manage Routine and closed it via ESC
without disturbing the modal underneath; created a second routine and moved a habit between them
via the stacked `transferItemModal` (real `transferHabitBetweenRoutines` call, not a mock). Hit the
documented native-`confirm()`/`alert()` CDP-freeze gotcha once (clicked Move while only one routine
existed, triggering the "no other routines" `alert()`) — recovered by navigating the tab away, then
re-ran with `window.confirm`/`window.alert` stubbed via `javascript_tool` before triggering Move
again, per the established workaround. Zero new console errors (only the pre-existing Chrome-
extension message-channel noise).

**Rejected:** Nothing new here — every fork this plan needed was already resolved in earlier
sub-sessions (Fork 1/2 in sub-session 1-2, Fork 3 in sub-session 4). This session was pure
mechanical migration validating the pattern held under the hardest case (stacking) rather than a
decision point.

---

## 2026-07-20 — [P2-UI-011] Stage 2 sub-session 4 shipped: forms.js migrated, 50ms delay dropped (Cowork session, Sonnet)

**Decision:** Migrated `js/ui/forms.js`'s single overlay site (`showFormModal`, the FAB task/habit/
routine creation modal) onto `Modal.open()` and removed the `setTimeout(50)` that previously
deferred `attachModalEventListeners`/`wireScheduleFieldsToggle` after insertion. This was the one
sub-session in the whole Stage 2 plan with a real behavior change (every other sub-session was a
pure refactor) — Fork 3 in `docs/MODAL_STAGE2_PLAN.md` had already found no technical reason for
the delay (both `createElement`+`appendChild` and `insertAdjacentHTML` are synchronous; the CSS
slide-in animation has no JS coordination requirement) but flagged that finding as a read-through,
not a live-tested claim, so this session existed specifically to test it in isolation.

**What changed:** `showFormModal` now builds one `.modal-overlay` HTML string (previously built via
`document.createElement('div')` + manual `className`/`id`/`innerHTML` + `appendChild`) and calls
`Modal.open(html)`, then calls `attachModalEventListeners(formType, deps)` and (for habits)
`wireScheduleFieldsToggle('modalHabit')` immediately on the same tick — no `setTimeout` at all.

**Verification:** 56 suites, 1205/1205 (unchanged — this module has never had dedicated unit
coverage). `node --check` clean. Live-verified in Chrome against the real running app (`node
server.js` on :8000): opened the FAB's Task/Habit/Routine creation modals, confirmed each opens
instantly with no visible delay; created a real task (spawned a real zombie sprite, appeared in
Today's Deadlines); toggled the habit form's Frequency select to `monthly` and confirmed
`wireScheduleFieldsToggle` still correctly swaps "Repeat on" days for "Day of Month" with no delay;
created a real routine (appeared correctly in the Routines management window, 0/1 active). Zero
new console errors (only the pre-existing Chrome-extension message-channel noise already
documented in prior sessions).

**Rejected:** Keeping the delay "just in case" — the plan doc gave this sub-session its own
dedicated slot precisely so a real timing bug, if one existed, would surface in isolation; none
did, across all three form types.

---

## 2026-07-20 — [P2-UI-011] Stage 2 sequenced + sub-session 1 shipped: `Modal.open()` core + checkIn.js pilot (Cowork session, Opus plan / Sonnet-tier execute)

**Decision:** Rather than diving straight into migrating all 17 overlay-creation call sites in one sitting (the literal ask — "work on Modal.open() Stage 2" — with no existing plan doc, unlike every other comparably-sized ticket in this repo), scoped it first: surveyed every `.modal-overlay` insertion site (17 across 5 active files + 1 dead/excluded site in `js/TaskManager.js`), designed `Modal.open(html, options)`'s API against that survey, and wrote `docs/MODAL_STAGE2_PLAN.md` sequencing the migration into 5 sub-sessions (checkIn.js pilot → frozenNotice.js → popups.js → forms.js → routineViews.js), mirroring NEGATIVE_HABITS_PLAN.md/FROZEN_SLOTS_PLAN.md/HEROES_PLAN.md's format. Jeremy confirmed this scope (plan-first, recommended option) via the session's clarifying question and switched to Opus for it.

**API shipped this session:** `Modal.open(html, { dedupeSelector, defer })` in `js/ui/modal.js`. Inserts a caller-built `.modal-overlay` HTML string as the last child of `document.body` and returns it synchronously — matching the fact that 100% of surveyed call sites already do `document.querySelector('.modal-overlay')` on the very next line, so migrating each cluster is mechanical. `dedupeSelector`: no-ops and returns `null` if a match already exists (replaces hand-written `if (document.querySelector('.foo-overlay')) return;` guards at several sites). `defer: true`: schedules the insert via `setTimeout(0)` and returns `undefined` — for the `frozenNotice.js`-style sites whose trigger fires `Modal.closeModal()` (nuke-all) synchronously right after, which would otherwise delete a same-tick-inserted overlay before it painted (the sessions 21/34/37 hazard). Deliberately does NOT absorb the achievement-notice queue/batch/poll logic (`frozenNotice.js`'s `showAchievementUnlockNotice`) — that stays caller-side as a layer on top of `open()`, keeping the primitive small (ARCHITECTURE.md's "max ~300 lines/file" convention).

**Pilot:** `js/ui/checkIn.js`'s single overlay site migrated onto `Modal.open(modalHtml, { dedupeSelector: '.check-in-overlay' })`, replacing its old hand-written dedupe guard. Chosen as the pilot because it's the smallest cluster (1 site) and already 100% synchronous listener-wiring — lowest possible blast radius to validate the non-deferred + dedupeSelector path before committing the other 4 clusters to the same API.

**Why plan first:** every comparably-sized ticket in this repo (negative habits, frozen slots, heroes, time-slider week) got a dedicated sequenced plan doc before code was touched — CLAUDE.md's "ONE roadmap task per session for anything touching... architecture" guardrail exists exactly to prevent an unscoped 17-site migration from sprawling across an unplanned single session. This one skipped that step for over a day (Stage 2 sat "unscheduled" since session 61) purely because nobody had scoped it yet, not because it doesn't need scoping — the survey immediately surfaced real complexity (achievement-notice queueing, the stacked-overlay case in routineViews.js, the setTimeout(50) in forms.js actually being the one real behavior change in the whole plan) that a same-session full migration would have discovered mid-flight instead of up front.

**Rejected:** Full 17-site migration in one session (Jeremy's non-chosen option — explicitly breaks the one-architecture-task-per-session guardrail, and the survey's findings above show why that guardrail earns its keep here); design-only with no pilot (would leave the API unvalidated against real DOM/listener-timing behavior).

**Verification:** 56 suites, 1205/1205 (+7, all in `test/modal-behavior.test.js`'s new `Modal.open` describe block: insertion + return value, `getTopmostOverlay` agreement, `dedupeSelector` hit/miss, `defer` timing, and a `defer`+`dedupeSelector` race case). `node --check` clean on both changed files. Live-verified in Chrome: loaded `dev-save.json` with two hand-set `pendingCheckIn` markers (one positive, one negative habit), confirmed both check-in cards render through `Modal.open()`, resolved each (points/XP awarded correctly), confirmed the overlay auto-closes once the last card resolves, and confirmed the dedupe guard live via a direct second `CheckIn.showCheckInModal` call (no duplicate overlay). Zero app console errors (only the pre-existing, already-documented Chrome-extension message-channel noise).

**Follow-up:** sub-sessions 2-5 (frozenNotice.js, popups.js, forms.js, routineViews.js) remain — see `docs/MODAL_STAGE2_PLAN.md` for the full order/reasoning. ROADMAP.md's Stage 2 line updated to a `[~]` in-progress marker with the sub-session checklist.

## 2026-07-20 — [P2-UI-011] Stage 2 sub-session 2: frozenNotice.js migrated onto `Modal.open()` — first `defer` production validation (Cowork session, continued)

**Decision:** Migrated all 6 `js/ui/frozenNotice.js` functions (`showFrozenRoutineNotice`, `showRoutineUnfrozenNotice`, `showRoutineKoNotice`, `showHeroStarUpNotice`, `showStreakMilestoneNotice`, `showAchievementUnlockNotice`) from their hand-rolled `setTimeout(fn, 0)` + manual `if (document.querySelector('.frozen-notice-overlay')) return;` pattern onto `Modal.open(html, { dedupeSelector: '.frozen-notice-overlay', defer: true })`, per sub-session 2 of `docs/MODAL_STAGE2_PLAN.md`. Pure refactor — behavior unchanged, just centralized. `showAchievementUnlockNotice` keeps its own queue/batch/poll wrapper (`pendingUnlocks`/`unlockWaiterId`) exactly as designed in the plan's Fork 2 — that logic is a genuinely different concern (batching multiple pending unlocks into one modal) layered on top of `Modal.open()`, not absorbed into it; only its final insert now calls `Modal.open(modalHtml)` (no options needed — `tryShow`'s own poll loop already confirmed no overlay exists at that point) instead of a raw `insertAdjacentHTML`.

**Why this sub-session mattered beyond the mechanical migration:** it's the first PRODUCTION exercise of `Modal.open()`'s `defer: true` path — sub-session 1's checkIn.js pilot only used the synchronous path live (its own unit tests covered `defer` in isolation, but not against a real trigger site). This sub-session specifically reproduces the sessions-21/34/37 closeModal-same-tick hazard for real: `popups.js`'s "I indulged" button calls `deps.indulgeHabit(item.id)` (which fires `showFrozenRoutineNotice` synchronously via `items.js`'s `onRoutineFrozen` callback) immediately followed by `Modal.closeModal()` (nuke-all). Live-verified this exact path in Chrome: loaded `dev-save-frozen-slots.json`, clicked the real "Snooze Alarm" negative-habit sprite (2/3 already indulged), clicked "I indulged" through the real popup, and confirmed the frozen-routine notice survived the same-tick `closeModal()` race and painted correctly — the hazard the `defer` option exists to guard against is still guarded, post-refactor.

**Verification:** 56 suites, 1205/1205 (unchanged — `frozenNotice.js` has never had dedicated unit tests, DOM-heavy and live-verified in Chrome instead, matching the pre-existing precedent noted in its own module docblock). `node --check` clean. Live-verified in Chrome: (1) the real closeModal-race scenario above via the actual UI, (2) dedupe — firing `showRoutineUnfrozenNotice` then `showHeroStarUpNotice` back-to-back via console left exactly one overlay (the first winner's title), (3) achievement batching — two `showAchievementUnlockNotice` calls before the queue drains rendered as ONE modal containing both families, matching the pre-refactor contract. Zero app console errors across all checks (only the pre-existing, already-documented Chrome-extension message-channel noise).

**Rejected:** Nothing new to reject here — this sub-session's forks were all resolved in the plan doc already (Fork 2: achievement queue stays caller-side).

**Follow-up:** sub-sessions 3-5 (popups.js, forms.js, routineViews.js) remain. See `docs/MODAL_STAGE2_PLAN.md`.

## 2026-07-20 — [P2-UI-011] Stage 2 sub-session 3: popups.js migrated onto `Modal.open()` — pushback/Cheat Day hazards re-verified unaffected (Cowork session, continued)

**Decision:** Migrated all 3 `js/ui/popups.js` overlay-creation sites (`showTaskDetailsPopup`, `showEditTaskModal`, `showCreateSubTaskModal`) from `document.body.insertAdjacentHTML` + a follow-up `document.querySelector('.modal-overlay')` onto `Modal.open(html)` — no options needed at any of the three, since none dedupe against a same-class sibling and all three insert synchronously in direct response to a click (no callback/timer gap for a `defer`-style race to open up). Per sub-session 3 of `docs/MODAL_STAGE2_PLAN.md`. `showCreateSubTaskModal`'s debug `console.log` lines (the historic sub-task-duplication bug site) were left completely untouched, per the file's own standing carve-out — only the insertion mechanism changed.

**Two pre-existing hazards specifically re-verified, not just carried over blind:** `showTaskDetailsPopup`'s pushback-tier in-place refresh (updates due-time/afford-ability against the SAME overlay element across multiple stacked pushes, no rebuild) and its Cheat Day "Use" button rebuild-in-place dance (its own `setTimeout(0)`, wrapping a `Modal.closeModal()` + reopen pair). Both are a DIFFERENT hazard class than `Modal.open()`'s `defer` option guards against — pushback's is a click-event-bubbling concern (SHOP_PLAN.md session 21), Cheat Day's is "don't rebuild while your own click is still bubbling," not a closeModal-same-tick-as-insert race — so neither needed to change, and both stayed hand-written exactly as before, just now built on top of `Modal.open()`'s returned element instead of a fresh query. Confirmed both still function correctly post-migration (see Verification).

**Rejected:** Nothing new — sub-session 3's scope and non-options-needed conclusion were already implied by the plan doc's survey; this session confirmed the prediction held rather than discovering a new fork.

**Verification:** 56 suites, 1205/1205 (unchanged — the existing `test/popups-prefill.test.js` suite, covering these three functions' local-time date/time formatters, passed with zero changes needed). `node --check` clean. Live-verified in Chrome: (1) real pushback popup on a real task via the actual UI — stacked two tiers, confirmed the due-time display and per-tier afford-ability updated in place across both, confirmed the "you have N pts" balance note appeared and all three tiers correctly disabled once points hit 0; (2) Cheat Day rebuild-in-place — a live negative-habit spawn repro proved flaky this session (a hand-injected `activeItems`/`definedHabits` entry didn't spawn a sprite on restore, root cause not chased down since it's a fixture-authoring problem, not a Modal.open() one), so instead called `Popups.showTaskDetailsPopup` directly against a synthetic negative-habit item + deps (still the real exported module function, not a mock) — confirmed clicking "Use Cheat Day" produces exactly one overlay afterward showing the "active" note; (3) `showEditTaskModal` and `showCreateSubTaskModal` also verified by direct real-function calls — edit-and-save correctly mutated the item and closed to zero overlays, sub-task creation correctly pushed onto the parent's `subTasks` array and closed. Hit and recovered from the documented native-`alert()`-freezes-CDP gotcha once (a synthetic item was missing `type: 'task'`, tripping `showCreateSubTaskModal`'s "Parent task not found" alert) — recovered via navigate-away, then re-ran with `window.alert`/`confirm` stubbed per CLAUDE.md's existing playbook. Zero app console errors throughout (only the pre-existing Chrome-extension noise).

**Follow-up:** sub-sessions 4-5 (forms.js, routineViews.js) remain. See `docs/MODAL_STAGE2_PLAN.md`.

## 2026-07-20 — Shop/economy balance re-check RESOLVED as empirical live-playtest validation (Cowork session, Fable) — no retune

**Decision:** The [P1-UI-008] follow-up ("re-check session-24 balance numbers against REAL play data") is resolved and checked off. Jeremy confirmed no real long-term save exists — he hasn't accumulated organic play history — so the follow-up's precondition can never be satisfied as written. Instead, every economy seam was measured empirically through the REAL UI in Chrome (not unit mocks): loaded `dev-save-heroes-run-history.json`, hand-extended two habits' `occurrenceHistory` (13 backfilled pre-today days each, dated before today so the session-56 spawn-dedupe guard isn't tripped) to land one habit in the ≥90% tier and one in the 70–89% tier after today's completion, then played a full realistic day: completed both fixture habits, created + completed a task, a sub-tasked task (sub then parent), a high-priority task, and a fresh 1×-tier habit, and indulged a newly created negative habit.

**Measured (all EXACT vs config, zero implementation drift):** habit ≥90% → +10 (2×, task parity); habit 70–89% → +8 (1.5×); habit below min-sample → +5 (1×); task → +10; high-priority task → +20 points but +10 XP (points-only multiplier confirmed); sub-task → +5; parent after subs → full +10; indulge → −5. Zero console errors across the whole run; save round-tripped through a reload with all values intact.

**Judgment:** a solid established-player day (5 tasks + 4 well-kept habits) pays 82–90 pts — at/just above the session-24 yardstick of 75–85, which that pass computed with mid-tier habits. A first-week player (all habits below min-sample) earns ~70/day, making the 200-pt day tokens a ~3-day save-up and the 300-pt 1-day pushback ~4 days — both match the intended "emergency parachute, not subscription" cadence. Nothing in the empirical pass contradicts any session-24 number. **No prices, tiers, or point values changed.**

**Rejected:** Leaving the follow-up open indefinitely (its precondition is unfalsifiable given Jeremy's stated play pattern — an eternally-open item is noise); retuning based on simulated-day arithmetic alone (the theory pass already did that math; today's session adds implementation verification, not new evidence of mispricing).

**Reopen trigger:** if Jeremy ever accumulates real multi-day play history, compare actual pts/day earn rate against 75–85 and revisit — the original yardstick logic in ECONOMY.md still applies.

**Session hygiene note:** the dev environment's localStorage now holds the heroes fixture plus this session's playtest residue (extra completed tasks/habits, an indulged negative habit "Impulse Snacking", extended occurrenceHistory on Gym Session / Read 30 Min). Use the dev Reset button or reload a clean fixture before any test that needs pristine state.

## 2026-07-20 — Day-advance LIVE mid-session rollover CLOSED (Cowork session) — shared core, not a parallel implementation

**Decision:** Rather than write a second, live-tick copy of the day-rollover settle logic, extracted the existing restore-path fork (cheat-day-excused → check-in-eligible → auto-avoid, `js/state.js`'s `restoreGameState`) into a standalone `State.performDayRollover(deps, now)`. Both `restoreGameState` (unchanged behavior — same call, now delegating) and a new `State.checkLiveDayRollover(deps)` (called every tick from `js/loop.js`'s `updateGame`, optional collaborator, same "omitted = no-op" pattern as the existing `checkDayPagerRollover`) now run the identical fork. `checkLiveDayRollover` additionally spawns today's generators, refreshes the same displays the restore path feeds, and saves immediately (doesn't wait for the 5s autosave window — a rollover right before a crash/close shouldn't be lost).

**Why:** The two paths answering "did the day roll over, and how do we settle it" would inevitably drift apart if written twice — restore-path already had 5 sub-sessions of careful fork logic (Cheat Day excusal, check-in eligibility, auto-avoid) that the live path has zero reason to reimplement differently. One function, two callers, is the same pattern items.js/loop.js already use for other cross-cutting collaborators.

**Rejected:** A parallel live-only implementation (rejected — drift risk); polling `setInterval` separately from the main game loop for the day check (rejected — the game loop already ticks every 50ms, no need for a second timer).

**Verification:** 14 new tests (`test/state-day-rollover.test.js` covers `performDayRollover`/`checkLiveDayRollover` directly against the real `js/state.js`; `test/loop.test.js` gained 4 cases for the new optional collaborator's wiring/ordering). 56 suites, 1198/1198 (up from 55/1184). `node --check` clean on script.js/state.js/loop.js.

**Live-verified in Chrome, end-to-end through the real app** (not just the deps-mocked unit tests): created a real habit via the UI, then faked "tomorrow" by patching `window.Date` with a `Proxy` wrapping the real `Date` constructor (`construct`/`apply`/`get` traps shift `now()` by +24h) rather than a naive `class FakeDate extends Date` subclass — the subclass approach was tried first and silently broke `hasDayRolledOver`'s `savedGameDate instanceof Date` guard, since a pre-existing real `Date` instance is never `instanceof` a subclass assigned to the global `Date` after the fact; the Proxy preserves the original prototype chain so `instanceof` still resolves correctly against both old and new "now" values. With the patch live, the game's own 50ms tick loop settled the stale habit instance, advanced `currentGameDate`, spawned a fresh instance for the new day, and saved — all observed via the real localStorage save and the live agenda UI, zero console errors, restored real `Date` afterward.

**Gotcha hit mid-verification:** the app's PWA service worker (`sw.js`, cache-first, from the Mobile UX/PWA session) was serving a STALE cached copy of `js/state.js`/`js/loop.js` — `State.checkLiveDayRollover` read as `undefined` on the live page despite the source files being current on disk. This is the same class of issue HANDOFF.md's session-74 addendum already flagged ("a service worker's cache-first behavior can mask a server-side fix even after a server restart"), just hitting a *file* change instead of a server restart. Fix: `navigator.serviceWorker.getRegistrations()` → `unregister()` each, `caches.keys()` → `caches.delete()` each, then a fresh navigate. Worth remembering for any future live-Chrome verification session touching `js/`/`script.js` — check `typeof <ExpectedNewThing>` early rather than assuming a reload always picks up source changes.

**Byproduct:** built `test/fixtures/dev-save.json` + `test/fixtures/README.md` (Jeremy asked for a reusable save mid-session) — a real save exported from the app's own UI (1 positive habit, 1 negative habit, 1 task, 1 active routine with a member habit), with a documented `fetch()`-based console loader and a called-out limitation: the fixture's dates are absolute (frozen at 2026-07-20), so loading it on a later real date will immediately trigger the day-rollover path on restore — arguably a feature for testing that specific flow, documented as such rather than treated as a bug.

## 2026-07-20 — Three more dev-save fixtures (overdue-damage, heroes/run-history, economy/shop) — same verify-before-Chrome discipline

**Decision:** Completed the scenario-fixture menu Jeremy picked from earlier in the session: `dev-save-overdue-damage.json`, `dev-save-heroes-run-history.json`, `dev-save-economy-shop.json`. Same process as the frozen-slots fixture — check the target pure function(s) via a throwaway `node -e` script BEFORE writing JSON by hand, then live-verify the rendered UI in Chrome — applied consistently across all three, catching one real mistake before it shipped (below).

**Caught before shipping:** the heroes fixture's first draft verified `Heroes.completionRate` against `windowStartMs = routine.createdAt` alone. The real call site (`js/ui/heroes.js`) uses `windowStartMs = Math.max(routine.createdAt, runStartedAtMs)` — since the fixture's `runStartedAtMs` (current run start) was LATER than most of the hand-authored `occurrenceHistory` dates, the live app would have silently excluded most samples, giving different star ratings than the verification script predicted. Caught by re-running the check with the correct formula before touching Chrome at all, then confirmed the corrected version matches live exactly (Fitness Squad 5★, Study Grind 1★, Burned Out 0★, all as designed). Worth remembering: "check against the pure function" isn't enough on its own — the CALL SITE's exact argument derivation matters too, and is easy to get subtly wrong when a fixture's dates don't obviously imply which window a live formula will pick.

**Fixture-specific notes:**
- Overdue-damage: robust to any load time (the 3-day `OFFLINE_MAX_MS` cap plus each item's 12 HP lifetime cap both hold regardless of `savedAt` staleness) — but the visually "damaged base" HP value is NOT robust (offline regen isn't capped the same way), documented as a caveat rather than treated as a bug.
- Heroes/run-history: also exercises a genuinely revivable KO'd routine (`koState.koAt` dated before "today," satisfying `DayRollover.hasDayRolledOver`'s revive gate) and the Stats modal's Past Runs / Routine Performance table end to end via 2 hand-shaped `finalizeRun`-format records.
- Economy/shop: live-tested an actual purchase (not just a static price readout) — repair kit Use button, health delta, held-count decrement, and the next exponential price recompute all confirmed against the real `Economy.shopPrice` formula in one pass.

## 2026-07-20 — Frozen-slots dev-save fixture + the real cause of the "phantom tab" localStorage overwrite

**Decision:** Extended the reusable-save idea (previous entry) with `test/fixtures/dev-save-frozen-slots.json` — three routines (frozen/near-freeze/near-recovery) covering the [P1-DATA-005] system, chosen by Jeremy from a short menu of candidate scenario fixtures (the others — overdue/offline damage, heroes+run history, economy/shop — deferred, not rejected).

**Why hand-built rather than played through the UI:** the freeze/recovery triggers need 3+ real consecutive days of `occurrenceHistory`, which isn't practical to generate live in one session (the rollover session's `Date`-Proxy trick advances ONE day at a time and would need repeating 3-5x per scenario). Instead: verified the target `occurrenceHistory` arrays against the real `js/frozenSlots.js` pure functions (`shouldFreeze`/`avoidanceProgress`) via a throwaway `node -e` script BEFORE writing the fixture, so the hand-authored history is provably correct against the same logic the app uses, not just visually plausible. Then live-verified the full UI surface (Manage Routine banners, hero chip frozen badges, suspended-sibling spawn gating) in Chrome to confirm the hand-authored shapes actually drive the real rendering/gating code correctly, not just the pure functions in isolation.

**Root-caused a real gotcha along the way:** loading either fixture by running `localStorage.setItem` from the ALREADY-LOADED game tab silently fails to take effect on the next reload — that tab's own in-memory state (from whatever was loaded before) is untouched by the direct write, and its autosave (fires almost immediately if `lastAutosaveMs` is stale, which it is right after a reload) re-serializes the OLD state back over the fixture within about a second. This looked exactly like a second, uncontrollable Chrome tab racing — logged as such in HANDOFF's first pass, and Jeremy was asked to close a tab that didn't need closing. Correct fix (documented in `test/fixtures/README.md`): navigate to a same-origin 404 first (kills the running game loop/autosave in that tab entirely), set `localStorage` from THAT page's console, then navigate to the real app fresh. Same underlying class of issue as CLAUDE.md's documented "verifying a hand-edited save round-trips" gotcha (session 52) — a live page's state and a direct `localStorage` write can diverge — but a different trigger (no `Persistence.flush()`/`requestSave()` stub needed here; the fix is killing the live context entirely, not timing a debounce).

## 2026-07-20 — Session 74 (continued): Mobile UX sub-session 2 BUILT — accessibility pass

Audit run on Opus (per model strategy — first-pass a11y audit is judgment work), fixes executed
same session. **Key finding: the plan over-estimated the gaps.** The recon plan assumed the day
pager `‹ ›` buttons, week-strip cells, and time slider needed keyboard/ARIA work — but they were
ALREADY real `<button>`/`<input>` elements carrying `aria-label`s (checked index.html +
dayPagerView.js's renderWeekStrip, which emits `<button type="button" aria-label="…">` cells) with
browser-default focus rings, and form inputs already swap their removed outline for a
border+box-shadow focus ring (managementWindows.css). So the pass came down to three real gaps:

1. **Contrast (WCAG AA):** `--color-neutral` was #9E9E9E ≈ 2.85:1 on white — fails AA for text, and
   it's the color for a lot of secondary text (ghost-agenda meta/time/empty rows, week-strip
   weekday labels, etc.). Darkened to #757575 (≈4.6:1, passes AA). Verified safe for its only three
   NON-text uses first (grepped): `.shop-buy-button:disabled`, `.stats-routine-badge-frozen`,
   `.stats-badge-progress-fill` — all backgrounds with no dark text on them, so a darker value only
   helps or is cosmetically neutral. Changed the TOKEN rather than adding targeted overrides — the
   whole point of the token is one accessible value everywhere; blast radius is purely visual (no
   logic), appropriate for an a11y pass. Rejected micro-tuning `--color-error` for the small red
   `.week-strip-priority ★N` badge (~4.0:1, just under AA-normal): it's supplementary info also
   encoded in the cell's aria-label, and `--color-error` is a brand red used app-wide including as
   a background under white text, so a global shift there carries real regression risk for a
   non-color-only-dependent detail.
2. **Day-pager changes silent to AT:** `#dayPagerLabel` had its text swapped by dayPagerView.js
   with no announcement. Added `role="status"` + `aria-live="polite"` + `aria-atomic="true"`
   (index.html) so pressing `‹ ›` announces "Tomorrow" / "Wed · Jul 22" / etc.
3. **Week-strip selection CSS-only:** the viewed day was marked only by `.week-strip-active`.
   Added `aria-current="true"` to the matching cell in renderWeekStrip.

Verification: 55 suites, 1184/1184 (day-pager-view.test.js only covers the pure `formatDayLabel`,
so the renderWeekStrip HTML change needed no test update); `node --check` clean on dayPagerView.js.
Live-verified in Chrome on the real page (not the iframe this time — no viewport-width dependence):
computed `--color-neutral` = #757575, `#dayPagerLabel` role/aria-live present and text cycled
Today→Tomorrow→Today via the buttons, `aria-current` moved to offset 1 when stepped forward and
back to offset 0 on return.

**Next:** MOBILE_PWA_PLAN.md sub-session 3 (PWA installable shell — manifest, service worker,
theme-color). Pure additive/mechanical, Sonnet-appropriate.

## 2026-07-20 — Session 74 (continued): Mobile UX sub-session 3 BUILT — PWA installable shell; ticket fully CLOSED

Built on Sonnet (Jeremy switched down after the a11y audit, per plan). `manifest.json`
(standalone display, theme/background colors matching the app's actual palette —
`--color-primary-dark-green` #0A5F55 / `--color-bg-light` #F5F7F9) + icons cropped from the
existing `Assets/Base/base_100.png` church sprite via ImageMagick (600×600 crop of the
steeple/body, resized to 192/512). `sw.js`: cache-first service worker with an EXPLICIT 88-URL
app-shell list (every `<link>`/`<script>` in index.html, plus the Zombies/Base sprites + the two
new icons) rather than globbing `Assets/*` — that folder also holds `.psd`/reference files
CLAUDE.md already says never to open, and there's no reason to ship them to every install.
Registration is feature-detected and swallows its own failure (`console.warn`, not throw) so a
browser without SW support degrades to the plain always-worked online experience — nothing about
the base game depends on this file.

**Real bug found and fixed along the way:** `server.js` had no `.json` MIME mapping, so
`manifest.json` fell back to `application/octet-stream` — some browsers' install-prompt logic
rejects that for the Web App Manifest. Added `'.json': 'application/manifest+json'` (verified no
other runtime `.json` fetch exists in `js/`, so this is a safe blanket mapping, not just a
manifest-specific hack).

**Verification hazard (worth remembering for future sw.js work):** after fixing the MIME
mapping and asking Jeremy to restart `node server.js`, the browser kept reporting the OLD
`application/octet-stream` content-type even post-restart. Root cause: the service worker's own
cache-first fetch handler had already cached `manifest.json` (with the stale content-type) during
its first install, BEFORE the fix — so it kept serving that stale cached response regardless of
what the server now returned. Not a real bug in the shipped fix; an artifact of testing a
cache-first SW against a server that changed underneath it mid-session. Resolved by unregistering
the SW + clearing all caches + a fresh fresh reload. Lesson for next time: verify server-side
fixes via a fetch BEFORE the SW is installed/wired in (which is what sub-session 3 actually did
first, catching zero 404s across all 88 URLs pre-registration — the MIME issue only surfaced
because of the coincidental mid-session server-restart timing, not the shell-list verification
step itself).

**Verification:** all 88 shell URLs fetched 200 before wiring (via the real page's `fetch`, not
sandbox `curl` — the sandbox can't reach Jeremy's `localhost:8000` directly, only the
Claude-in-Chrome extension can). Post-fix: `manifest.json` serves as `application/manifest+json`,
SW registers and reaches `activated`, cache holds all 90 real entries (88 explicit + 2
browser-added, e.g. favicon), and `caches.match('index.html')` returns the byte-current real
shell (confirmed it contains `day-pager-row` — today's actual markup, not a stale snapshot). No
tool was available to flip real network offline, so the offline PATH itself was verified by
directly exercising the same `caches.match` fallback `sw.js`'s fetch listener uses on a failed
request, rather than by an actual airplane-mode reload — worth a manual phone test if Jeremy
wants belt-and-suspenders confidence beyond this. 55 suites, 1184/1184 (unchanged — no
test-covered `.js` touched); `node --check` clean on `sw.js`/`server.js`; `manifest.json`
validated as JSON.

**Leftover, not cleaned up:** `Assets/icons/icon-crop.png` (the intermediate crop before the
192/512 resizes) — harmless, unreferenced anywhere, but couldn't be deleted from the Cowork
sandbox (the mounted folder allows writes but not deletes/renames for the sandbox user, same
class of restriction as the git-index-lock/npm-ENOTEMPTY issues in CLAUDE.md). Safe for Jeremy to
delete from his own filesystem whenever convenient.

**[Mobile UX + accessibility pass; PWA] ticket now fully CLOSED** — all 3 sub-sessions
(layout, accessibility, PWA) built same day.

---

## 2026-07-20 — Session 74: Mobile UX + accessibility + PWA — sequenced, not built

Sequenced the last open Milestone 4 line into `docs/MOBILE_PWA_PLAN.md` (3 sub-sessions), same
pattern as TIME_SLIDER_WEEK_PLAN.md/RUN_HISTORY_PLAN.md/ACHIEVEMENTS_PLAN.md/HEROES_PLAN.md. No
code changed this session — planning + a live recon audit only.

**PWA scope: installable shell only** (Jeremy) — manifest + icons + a cache-first service worker
for the app shell. No background sync, no offline-write reconciliation. The game is already
localStorage-only client-side, so this is packaging, not new architecture. Rejected: deeper
offline-aware UX (online/offline banner, save-safety hardening) — descoped to keep this ticket
additive and independent of the rest of the app.

**Sequencing: layout → accessibility → PWA** (Jeremy) — layout fixes are quick/low-risk and give
a real device to test the rest against; accessibility touches more surface (extends session-61's
Modal.js focus/ARIA layer); PWA last since nothing else depends on it.

**Accessibility depth: practical pass, not full WCAG 2.1 AA** (Jeremy) — fix what the audit found
plus extend the existing focus/ARIA layer to day pager/week strip/agenda checkboxes. Full audit
descoped unless the app goes public.

**Tooling note:** `resize_window` on the Claude-in-Chrome MCP reported success but never changed
the real page's `innerWidth` in this session (stayed desktop-sized through multiple resize
attempts and Jeremy manually narrowing/re-narrowing the window). Worked around by injecting a
same-origin `<iframe>` (390×844) into the live page and driving/screenshotting inside that — real
rendering, real media queries, just scoped to the iframe. Worth trying `resize_window` again fresh
next time in case it was session-specific, but the iframe trick is a reliable fallback.

## 2026-07-20 — Session 74 (continued): Mobile UX sub-session 1 BUILT — layout fixes

Same session, continued after Jeremy said "continue." Built MOBILE_PWA_PLAN.md sub-session 1
(Sonnet-tier execution, plan already resolved). Bumped every tap target the recon audit flagged
to ≥44×44px: `.edit-icon-btn` (32→44), `.completion-checkbox` label (32→44 tall; the checkbox
glyph itself only went 24→28, since the whole label — checkbox + "Mark as Complete" text — is
the real click target), `.day-pager-btn` (32→44), `.week-strip-cell` (42→44 min-height, width
left at ~47px). Also found and fixed one MORE instance of the same bug live-testing, not in the
original plan doc: the management-window `.close-window` button was 32px at its base rule with a
more-specific `.window-header .close-window` override shrinking it further to 28px — removed the
override entirely (same size-drift pattern as the responsive.css breakpoint swap this session
already found) rather than bumping both declarations.

**`css/responsive.css` breakpoint fix:** moved `.fab`/`.fab-container`/`.management-window`/
`.fab-menu-item`/`.window-content`/`.negative-habit-button` out of the `min-width:1024px` query
into `max-width:768px`. Verified each was mobile-appropriate by checking its base (unscoped) rule
first — e.g. `.management-window`'s base is `width:90%; max-height:80vh`; a `min-width:1024px`
override to 95%/85vh is a no-op on any real desktop screen (already capped at
`max-width:500px`), so it could only ever have mattered on a NARROW screen, confirming the swap.
Left `.task-section`/`.controls-section`/`.routine-section` under the desktop query — no base-rule
evidence they were misplaced (scrollable side panels are a plausible genuine wide-screen
enhancement).

**Verification:** 55 suites, 1184/1184 (unchanged — CSS-only session, no `.js` touched, so no
`node --check` needed either). Live-verified every changed selector's real computed size in
Chrome at 390×844 via the iframe-injection workaround (`.fab` 48×48, `.day-pager-btn` 44×44,
`.week-strip-cell` 47×44, `.close-window` 44×44, `.edit-icon-btn` 44×44,
`.completion-checkbox-input` 28×28 inside a 140×44 label). One real-world hazard hit and
recovered from: a scripted `input`/`click` sequence via `javascript_tool` froze the Chrome tab
(CDP timeout) — matches the documented native-dialog-freeze failure mode in CLAUDE.md, though no
dialog was intentionally triggered; navigating the tab to a fresh URL recovered it cleanly with
no partial mutation, same as the documented recovery. Switched to real `computer` clicks/typing
for the rest of the verification and had no further issues.

**Next:** MOBILE_PWA_PLAN.md sub-session 2 (accessibility pass — day pager/week strip
keyboard+ARIA, contrast check), then sub-session 3 (PWA installable shell).

## 2026-07-20 — Session 73: Time Slider Week scope sub-session 4 BUILT — Week strip; ticket fully CLOSED

**Jeremy's brief (asked at build time, per the plan's own note that placement/heavy-day-marker needed his
call):** strip goes above the day pager (always visible — "shape of my week" before drilling into a day);
highlight high-priority items with a COUNT, not just a dot; and only flag a day as heavy when it's more
loaded than the player's OWN average for the week being shown, not a fixed number ("what counts as a lot
depends on how busy this week already is").

**Real bug caught before it shipped, not by inspection but by writing the tests:** the natural instinct was
to reuse `conjureGhostsForDay` for every one of the 7 cells including Today. That's wrong — `Habits.
selectHabitDefsToSpawn`/`Routines.selectTaskDefsToSpawn` (which `conjureGhostsForDay` calls) deliberately
EXCLUDE anything that already has a live instance for that day, so counting Today via conjuring would show
0 for every recurring habit/task actually sitting on the real board. Today's cell counts `activeItems`
directly instead — matching `Hud.updateTaskCountDisplay`'s own established convention (which, in turn,
surfaced a second real finding: that counter has ALWAYS counted "everything currently active," not "items
due today" — a one-off task due three days out is a real `activeItems` entry sitting off-screen today and
counts toward BOTH days. Not a new bug, just a pre-existing, previously-undocumented app behavior the week
strip's tests happened to make visible for the first time.)

**`isHeavy` is relative, computed after all 7 counts are known** (mean of the 7, strictly-greater-than so a
perfectly even week flags nothing) — sub-tasks are excluded from every count (parent+subs reads as one item,
same Hud convention) and `isHighPriority` only exists on tasks (habits have no priority concept, so they
never contribute to the badge).

**Live-verified in Chrome:** 2 daily habits + 1 high-priority routine task (all spawning every day) + 3
one-off tasks piled onto a single future day. Strip rendered 6/3/3/6/3/3/3 with BOTH the loaded day and
Today itself correctly flagged heavy (Today's count includes the future one-off tasks too, per the
convention above — the relative-average math handled this correctly without any special-casing), ★1 on
every cell, and the real "Submit report" item showed its own ★ marker in the live Today agenda. Tap-to-jump
landed exactly on the tapped day. Save confirmed byte-for-byte unchanged throughout. 55 suites, 1184/1184
(+11, `test/day-pager-week-strip.test.js`).

**Observed but not investigated further:** one reload during this session's hand-edit testing logged a
"load failed — starting fresh" (JSON.parse on the literal string `"undefined"`) in `persistence.js` — the
save was healthy immediately before and after, and this code path is pre-existing defensive error handling,
not anything the day-pager/week-strip feature touches. Treated as a one-time test-harness flake (likely a
save-write/navigate race in the manual verification steps, not a code defect) rather than a bug — logged
here in case it recurs.

**Milestone status:** the "Time Slider Week/Month scope" ROADMAP item is now fully CLOSED (Month was cut at
the design-fork stage, session 70). All 4 sub-sessions built sessions 71-73.

## 2026-07-20 — Session 72: Time Slider Week scope sub-session 3 BUILT — Yesterday static snapshot

Lifted the day pager's floor from 0 to -1 (`DayPager.MIN_OFFSET` already allowed it since sub-session 1 —
only the VIEW's own `Math.max(0, ...)` clamp was tightening it further, exactly so this sub-session could
lift a floor rather than touch the pure module).

**Design realization while building:** the future-day ghost conjurers (`conjureHabitGhosts`/
`conjureTaskGhosts`) can't be reused as-is for yesterday, because they call `selectHabitDefsToSpawn`/
`selectTaskDefsToSpawn`, which deliberately EXCLUDE anything already resolved for that day — exactly the
opposite of what a snapshot needs (a resolved day is the whole point). So sub-session 3 duplicates just the
SCHEDULING half of that gating logic (`isHabitScheduledAndUsable`/`isTaskScheduledAndActive` — same
recurrence + routine-usability checks, no dedup) rather than reusing the spawn-selection functions directly.

**Outcome sourcing differs by item type, which the plan didn't fully anticipate:** habits carry
`occurrenceHistory` (a `{date, success}` array) so their outcome is a direct lookup. Routine tasks and
one-off tasks have NO such field — their outcome is INFERRED from `completedItems` membership (found there
= completed, still elsewhere/absent = missed). This is weaker evidence than a habit's explicit record (a
one-off task still sitting in `activeItems` past its due day reads identically whether it was "missed
yesterday" or "still actively overdue today" — no separate state exists to tell those apart), which the
plan's scope guards already flagged as an accepted limit for one-off tasks specifically.

**`occurrenceSuccess`'s existing lapsed-vs-indulged collapse (habits.js, session 16) surfaces here as a
real, accepted gap:** a negative habit's stored occurrence is a single boolean — there's no way to tell
after the fact whether a `false` entry means "the day passed with no action" (lapsed) or "explicitly tapped
I indulged." Both render as 'indulged' in the snapshot. Not fixed this session (would need a schema change
to store which event produced the entry) — logged as a known limitation, not a bug.

**Non-mutating contract needed no new work:** offset -1 already falls under "any non-Today offset" in
`dayPagerView.js`'s `render()`, so it reuses the same `isTimePreviewActive` freeze sub-session 2 wired. The
only offset-specific UI change is disabling the hour slider (`deps.timeSliderEl.disabled`) — yesterday has no
preview-time concept at all (completion TIMES were never recorded, only which day), so scrubbing it would be
pure fiction rather than a simplification.

**Live-verified in Chrome:** hand-crafted `occurrenceHistory` for a positive habit (`success: true` →
"Completed") and a negative habit (`success: false` → "Indulged") via the session-52 save-edit protocol
(edit while Persistence is stubbed, reload, re-stub for the excursion). Both badges rendered correctly on
the ghost sprite (small icon, colored border) and the agenda row (text pill). `‹` correctly disabled at the
floor, hour slider disabled ONLY at Yesterday, round-trip back to Today restored the real board with zero
drift, and the on-disk save was confirmed unchanged throughout the whole excursion. 54 suites, 1173/1173
(+18: `test/day-pager-yesterday.test.js`, plus one `formatDayLabel` case).

## 2026-07-20 — Session 71: Time Slider Week scope sub-sessions 1-2 BUILT — ghost conjuring + day pager UI

**Sub-session 1 (pure core, `js/dayPager.js`).** Confirmed the plan's prediction that ghost-conjuring is
"mostly assembly": `conjureHabitGhosts`/`conjureTaskGhosts` are thin wrappers over `Habits.
selectHabitDefsToSpawn`/`Routines.selectTaskDefsToSpawn` — calling them with a future date instead of today
gets frozen/suspended-routine gating and Sick/Skip/Cheat-day exclusion for free (sessions 36/39 built those
checks for spawn gating, not knowing they'd be reused here). **Real finding while building:** one-off tasks
and sub-tasks need NO conjuring at all — they aren't respawned daily from a definition (`items.js`'s
`createTaskItemData`), so a task due 3 days out already exists in `activeItems` today, just far off in the
timeline (the same insight session 63 used for Today scope: "already spawned, just far away"). `existingItemsForDay`
just filters the real array by due-date-in-range. 52 suites, 1147/1147 (+26).

**Sub-session 2 (pager UI, `js/ui/dayPagerView.js` + `css/dayPager.css`).** Floored the pager interaction at
0..+6 this session (yesterday/-1 is sub-session 3, though `DayPager.clampDayOffset` already supports it — the
VIEW clamps tighter than the pure core on purpose, so sub-session 3 only has to lift a floor, not touch the
pure module). Two design calls made while building, not pre-planned:
1. **Reused the existing `isTimePreviewActive` flag for the non-mutating contract** instead of adding a
   parallel guard. Paging off Today sets the SAME flag the hour-scrub slider sets, so `js/loop.js`'s
   `updateActiveItems` early-return already covers the day pager with zero changes to that guard.
2. **`checkDayPagerRollover` had to be a NEW hook, unconditional, at the very top of `Loop.updateGame`** —
   not inside `updateActiveItems`. Reusing `isTimePreviewActive` (decision 1) means a session parked on a
   future-day page IS "previewing" by the existing guard's definition, so any rollover-detection hook placed
   after that guard would never fire while parked there — exactly the case it needs to catch. One-line,
   optional-collaborator, backward-compatible addition to loop.js.
3. **HP projection suppression needed no explicit guard** — it falls out naturally, since `dayPagerView.js`
   never calls `TimeSliderView`'s damage-preview path at all; only the hour-scrub slider does, and it isn't
   wired to reinterpret its minutes against a non-Today day yet (known simplification, see below).

**Known v1 simplifications (logged, not blocking):** ghost sprites use plain `Clock.calculateTimelinePosition`
rather than the sub-task clustering math (which needs live siblings already positioned in `activeItems` —
ghosts aren't part of that array), so a future day's sub-task ghosts don't fan next to their parent ghost.
Each future-day page previews a single fixed anchor (noon) rather than full hour-by-hour scrubbing — the
existing `#timeSlider` input isn't yet rebound to interpret its minutes against the viewed day; that
integration was scoped out to avoid destabilizing the well-tested Today-scope scrub/release contract in the
same session that changed the guard it depends on.

**Live-verified in Chrome:** created a real "Stretch" habit, paged Today → Tomorrow → Day+6 (button correctly
disables at the ceiling), confirmed ghost-only rendering via computed classlist (`viewing-other-day` hides
real sprites, `.day-pager-ghost` renders instead, base/hero HUD untouched), confirmed BYTE-FOR-BYTE that
`localStorage` never changed while parked off Today across the whole excursion, and confirmed full
restoration on return (real sprite/agenda back, zero leftover ghost classes). Save restored to pristine
after. 53 suites, 1151/1151 (+4 pure `formatDayLabel` tests — DOM rendering stays live-verified per the
statsView.js/shopView.js precedent this codebase already established for UI modules).

## 2026-07-20 — Session 70: Time Slider Week scope SEQUENCED (Fable fork session) — day pager + week strip; Month cut

**Context:** Jeremy's stated use cases: evening review of tomorrow; seeing big items later in the week; light
review of the recent past. He suspected Month was too far out and floated day-toggling as an alternative to
stretching the slider. Full sequencing in `docs/TIME_SLIDER_WEEK_PLAN.md`; summary of the four verdicts:

**1. Day pager + week strip (phased), NOT a week-scale slider.** ‹ › pages between days; the existing 24h
slider stays a within-day scrubber for the viewed day. 7-day overview strip (counts + big-deadline flags,
tap-to-jump) lands as phase 2 — it's the only surface that answers "shape of my week" at a glance, while the
pager owns "walk through tomorrow." REJECTED: 7-day slider range (thumb-pixel ≈ 3.5h on mobile kills
precision; a week of enemies on one canvas destroys distance-=-urgency).

**2. Month scope CUT.** No mechanic operates at month scale; the spec's Today/Week/Month triple treated as
big-dream boilerplate. A month planner is a calendar's job.

**3. Yesterday = static "battlefield aftermath" snapshot, one page back only (range −1..+6).** Scheduled set
re-derived from defs (same pure selection functions as future ghosts), outcomes overlaid from
occurrenceHistory. NOT hour-scrubbable — completion times aren't stored; animating yesterday would be
fiction. Accepted fidelity limit: one-off tasks have weaker post-rollover records. Older days stay in the
Stats window's list-based review.

**4. HP projection stays today-only.** Future pages show scheduled ghosts, no multi-day "base dies Thursday"
forecast (GAME_DESIGN principle 2 — a doom-meter scolds rather than informs). Deferred idea: a gentle
"heavy day" flag on the week strip.

**Implementation insight that shaped the plan:** `selectHabitDefsToSpawn`/`selectTaskDefsToSpawn` already
take a target day and respect frozen/suspended routines + Sick/Skip/Cheat markers (built sessions 36/39) —
ghost conjuring is calling existing pure code with a future date, so the feature is mostly assembly. NO
schema bump; viewed-day offset is session-only, resets to today on reload and on midnight rollover.

## 2026-07-20 — Session 69: Run History sub-session 5 (polish) — best-run badge, expandable cards, vs-last-run deltas; ticket CLOSED (Cowork)

**Scope:** the last unchecked item on "Run history + run review screen" (`docs/RUN_HISTORY_PLAN.md` sub-session
5, optional polish) — built rather than cut, closing the ticket. Milestone 3 is now complete except the
low-priority live day-rollover item.

**Best-run detection.** New pure `RunStats.bestRunNumber(runHistory)`: most days survived wins; ties broken by
`totals.pointsEarned`, then by EARLIEST runNumber — **decision: the first run to set a record keeps the 🏆
badge; a later run that merely ties doesn't steal it** (personal-record convention). Exactly one badge, or none
for empty history. Computed once in `renderStatsWindow`, passed per-card.

**Vs-last-run deltas.** New pure `RunStats.deltasVsLastRun(stats, daysSurvivedSoFar, lastRecord)` — plain
current−last arithmetic across days/tasks/habits/missed/points; returns null with no prior run (panel renders
no deltas at all). Direction semantics live in the VIEW: `StatsView.formatDeltaBadge(delta, goodWhenUp)` — 
habitsMissed passes `goodWhenUp: false` so FEWER misses reads as improvement. **Decision: improvements render
green, everything else neutral grey — never red** (GAME_DESIGN principle 2, reflection over punishment: deltas
inform, don't scold).

**Expandable run cards — the session-21 setTimeout(0) hazard was designed AROUND, not deferred around.** The
statsView.js header had a standing warning to re-check that hazard before adding in-window buttons. Resolution:
expanded details (started date + end reason, full offender list top-10, per-run routine snapshot rows) are
ALWAYS in the DOM; a click toggles `.stats-run-card-expanded` only, so the event target never detaches
mid-bubble and the "click outside closes window" listener can't misfire. Listeners attach by ASSIGNMENT
(`historyList.onclick = ...`) so re-opening the window replaces rather than stacks handlers. Collapsed top-3
blame summary and expanded "All offenders" list are CSS-swapped (never both). Cards are `role="button"
tabindex="0"` with Enter/Space toggling + live `aria-expanded`, extending the session-61 a11y groundwork.
Expansion state deliberately resets on window re-open (render rebuilds cards).

**Tests:** +19 in `test/run-history-polish.test.js` (51 suites, 1121/1121). Live-verified in Chrome via the
session-52 hand-edit protocol (3 crafted runs incl. tie-relevant fixtures): badge landed on the correct
non-newest run, all 4 counter deltas + days delta rendered with correct inversion (missed −2 = green),
click/keyboard expand-collapse with aria flips, zero console errors, save restored pristine.

## 2026-07-20 — Session 68: Achievements sub-session 4 (polish) — near-miss nudges + unlock animation, ticket CLOSED (Cowork)

**Scope:** the last unchecked item on Achievements & badges (`docs/ACHIEVEMENTS_PLAN.md`'s "optional, cut-if-
time-says-so" sub-session 4). Jeremy picked it directly (over Run History polish / Time Slider Week-Month /
Mobile UX) from an AskUserQuestion menu at session start; built rather than cut, closing the ticket.

**Near-miss nudges.** New pure `Achievements.nextLockedTier(family, unlocked)` + `Achievements.nearMissNudges
(catalog, lifetimeStats, unlocked, thresholdPct)` in js/achievements.js — for each family, looks only at its
NEXT locked tier (one nudge per family, matching the badge grid's "next milestone" framing, not every
qualifying tier) and includes it once progress crosses `thresholdPct` (default 0.8; caller-supplied, module
never reads CONFIG itself — same rule the rest of the file follows). Added `CONFIG.NEAR_MISS_THRESHOLD_PCT`
(0.8) and a `nearMissUnit` string per catalog family (`'day'`/`'task'`/`'habit'`/`'run'`, `null` for Back in
Black). **Decision: these are UI/presentation constants, not balance numbers** — they don't touch XP/points/
economy, so they're NOT gated by the balance-tuning skill (unlike ACHIEVEMENTS thresholds themselves, which
are balance and were already logged as such in session 64). Rendered via `StatsView.buildNearMissSection` as
an "Almost there" block on the Stats window's **current-run panel only** — past-run cards are frozen history,
nothing to nudge toward.

**Float-boundary hazard found while writing tests:** `progress >= pct` at an exact 80% boundary (e.g. `4/5`)
can land on either side of the literal `0.8` depending on how the division rounds vs. the literal's own
rounding to the nearest representable double — occasionally opposite sides even for "clean" fractions.
Fixed with a `1e-9` epsilon (`progress >= pct - 1e-9`) rather than picking test fixtures that dodge the issue,
since real lifetimeStats/threshold pairs will hit the same boundary in play. Cosmetic-only value (a nudge
firing/not-firing one tick early), so the slack costs nothing.

**Unlock animation.** `FrozenNotice.showAchievementUnlockNotice`'s 🏆 now wraps in `.achievement-unlock-icon`
for a CSS-only pop/glow (`@keyframes achievement-unlock-pop`, css/frozenNotice.css) — no particle system,
matching session 59's mobile-perf precedent. Gated by the SAME `fx-off`/`fx-reduced` `<body>` classes
js/settings.js already applies for the streak-fire effect, plus `prefers-reduced-motion` unconditionally
(copied both patterns from css/enemyStatus.css rather than inventing a new convention).

**Live verification (Chrome, localhost:8000):** hand-edited Jeremy's save via the session-52/67 protocol
(monkeypatch `localStorage.setItem` to no-op the `deadline.save` key, write directly via
`Object.getPrototypeOf(localStorage).setItem`, reload) to `lifetimeStats.tasksCompleted: 8` (exactly 80% of
Task Slayer Bronze's threshold of 10) and `bestRunDaysSurvived: 3` (crosses Survivor Bronze). Reload showed
the restore-time silent sweep (session 64's documented "no toast on restore" behavior) had already unlocked
Survivor Bronze, and the Stats current-run panel showed "Almost there — 🎯 2 tasks to Task Slayer — Bronze"
exactly as designed. Created 2 real tasks via the UI and completed both live (8→9→10): the 10th completion
fired the REAL unlock toast ("🏆 Achievement unlocked: Task Slayer (Bronze)") with the animated trophy
visible, zero console errors. Confirmed the fx-gating via a computed-style check
(`getComputedStyle(icon).animationName`): `'achievement-unlock-pop'` under the default fx-full body, `'none'`
under both `fx-off` and `fx-reduced`. **Hit the documented `confirm()`/`alert()` CDP-freeze hazard** clicking
the dev Reset button (native `confirm()` on click) — recovered via the documented fix (navigate the tab to
discard the frozen dialog state), then restored the save to pristine via the SAME no-op-stub protocol used to
set it up (`localStorage.removeItem('deadline.save')` through the stub, then reload) rather than fighting the
Reset button a second time. Confirmed pristine: `lifetimeStats` all-zero, `achievements: {}`, `playerXP`/
`playerPoints` both 0.

**Tests:** 50 suites, 1102/1102 (+27: `test/achievements.test.js` `nextLockedTier`/`nearMissNudges` describe
blocks, new `test/stats-near-miss.test.js` for `StatsView.buildNearMissSection`). `node --check` clean on
config.js/achievements.js/statsView.js/frozenNotice.js.

**[Achievements & badges] ticket now fully CLOSED** (all 4 sub-sessions built, none cut). See ECONOMY.md/
ROADMAP.md.

---

## 2026-07-20 — Session 67: Fix finalizeRun stars/completionRate {rate,samples} bug (Cowork)

**The bug (flagged sessions 64/65/66, deferred each time as "its own session"):** the Stats window's
"Routine Performance" section had silently shown "0★" for stars and "—" for completion on EVERY past run
since it shipped (session 55). Root cause was a shape mismatch at two sites, both diverging from the canonical
`HeroesView.buildChipViewModel` convention (which does `Heroes.starRating(rate.rate, tiers)`):

1. **`RunStats.finalizeRun` (js/runStats.js)** passed `Heroes.completionRate`'s raw `{ rate, samples }` OBJECT
   straight into `ctx.starRating(rate)` instead of `rate.rate`. `Heroes.starRating` then did `object >= minRate`
   → NaN → returned 0 for every tier, so every finalized routine stored `stars: 0` regardless of real play.
2. **`StatsView.formatCompletionRate` (js/ui/statsView.js)** did `typeof rate === 'number'` on the record's
   `completionRate` field — but that field is deliberately the raw `{ rate, samples }` object (documented in
   persistence.js's 10→11 note; the Steady Hands live path and the migration retro-sweep both correctly read
   `.rate` off it). So it always fell through to "—".

**Fix — keep the stored object shape, unwrap at the two defect sites.** The `{ rate, samples }` record shape is
intentional and depended-on (persistence + achievements), so it stays. finalizeRun now unwraps `cr.rate` for
starRating; formatCompletionRate unwraps `.rate` for display. **Additional refinement:** an unrated routine
(`cr.rate === null`, no scored habit occurrences) now stores `stars: null` → renders "—", NOT a misleading
"0★" — matching statsView's documented "unrated → em dash" convention. (Live hero chips show 0 stars for
unrated, but a past-run summary reads better as "—" = "no data" than "0★" = "performed terribly".)

**Why it went uncaught for 12 sessions:** BOTH tests that exercised this path (`run-stats.test.js` finalizeRun,
`damage.test.js` gameOver rollup) mocked `completionRate` as returning a BARE NUMBER (`0.92`), not the real
object. The bare-number mock made the old buggy `starRating(number)` call look correct. Fixed both mocks to be
faithful to the real `Heroes.completionRate` contract, and added `test/stats-routine-performance.test.js`
(8 tests) pinning the object-shape unwrap on the real StatsView module — including a negative control that a
bare number is now REJECTED (renders "—"), so a regression to the old shape fails loudly.

**Scope note:** only NEW finalizations get correct `stars`. Run records already in a save carry the baked-in
`stars: 0` (can't recompute — the historical occurrence data is gone). But `completionRate` was always stored
as the object, so the formatCompletionRate fix DOES retroactively show real percentages for old records; only
old records' stars stay 0. Acceptable — no migration warranted.

**Tests:** 49 suites, 1083/1083 (+8 net). Live-verified in Chrome (localhost:8000): injected a run record with
one rated routine (`{rate:0.92,samples:10}`, stars 4) and one unrated (`{rate:null,samples:0}`, stars null) via
the session-52 hand-edit protocol; Stats → Routine Performance rendered "Lv4 4★ 92%" and "Lv1 — —" exactly,
zero console errors. Save restored to pristine (empty runHistory, schemaVersion 11). NOT committed — git
commands in chat.

**Cowork sandbox note:** the session-52 "stub Persistence.flush before reload" trick was unavailable —
`Persistence`/`saveGame`/`requestSave` are all closure-scoped, none exposed on `window`. Worked around the
pagehide/beforeunload flush (which re-serializes live in-memory state over a hand-edit) by monkeypatching
`localStorage.setItem` to no-op writes to the `deadline.save` key, THEN reloading: the fresh page restores the
patched-in value, and the old page's unload-flush is blocked. Same guard used to restore pristine afterward.

---

## 2026-07-20 — Session 66: Achievements sub-session 3 — Stats window badge grid (Cowork)

**Placement: Achievements section renders LAST in the Stats window (below Routine Performance), not above the
run panels.** The Stats window's existing order is run-scoped → routine-scoped; achievements are lifetime-scoped
and read-least-often, so they anchor the bottom. New `#statsAchievements` container follows the exact
`#statsRoutineRollup` pattern (null-guarded in renderStatsWindow, so old markup can't crash the render).
Rejected: a separate FAB item (fork 3 of the plan already rejected it) and inserting above Past Runs (pushes the
live run panel's blame list below the fold for zero benefit).

**Card grouping: one block per family with a heading, one card per tier — not one flat grid of 19 cards.**
Family blocks read as progressions (Bronze → Platinum left to right); a flat grid interleaves families once
card heights wrap. Locked cards show a progress bar + "value/threshold" (the plan's "184/250") computed from
the family's `lifetimeStats` metric, floored to whole percent and CLAMPED at 100 (a hand-edited save can hold
value > threshold with the unlock map wiped — the bar must not overflow). Non-numeric/missing metric renders
as 0 progress, not a crash. Unlocked cards show 🏅 + "Unlocked <date>" from the persisted ISO in the
unlocked-tier map (formatDate reused). Falsy tier labels omitted via `badgeTitle` (session-65 null-label rule,
now covered by tests: "Back in Black", never "Back in Black — null").

**Deps: catalog/lifetimeStats/achievements flow through the existing `openManagementWindow` pass-through**
(script.js reads the closure vars at call time, so a dev-Reset or restore mid-session shows fresh values on
next open — same freshness argument as the other five windows). No new globals, no new event wiring; builders
never read CONFIG inside (mirrors js/achievements.js's rule) so the test file exercises the REAL module with a
fixture catalog.

**Tests: 12 new (test/stats-achievements.test.js) against the real StatsView** — locked progress math (floor,
clamp, 0-default), unlocked date rendering, null-label negative control, family ordering, empty-catalog
placeholder. 48 suites, 1075/1075. DOM wiring live-verified in Chrome instead (statsView convention,
sessions 54/55): pristine save → all 19 tiers locked at 0/N; hand-edited lifetimeStats (184 tasks, 4 best days,
session-52 stub-wait-edit-reload protocol) → the restore-time evaluateAll pass REALLY unlocked
survivor_1/task_slayer_1/task_slayer_2 with today's date and the grid showed 184/250 + 4/7 bars exactly as
predicted; zero app console errors; save restored to pristine and re-verified over a natural reload.

**Deliberately untouched:** the finalizeRun `{rate,samples}` bug (HANDOFF 65's do-not-driveby rule — this
session touched statsView.js and did NOT fix it; it stays its own session). Sub-session 4 (near-miss nudges,
unlock animation) remains optional.

**Sandbox note (adds to the session-43 npm rule):** the mounted repo's `node_modules` can be COPIED to `$HOME`
in the sandbox instead of npm-installing there — much faster when the registry path is slow — but jest 30's
resolver (`unrs-resolver`) ships a PLATFORM-NATIVE binding, so Jeremy's Windows install dies in the Linux
sandbox with a misleading "Module <rootDir>/test/setup.js was not found" validation error. Fix: after copying,
`npm install @unrs/resolver-binding-linux-x64-gnu@<version-matching-unrs-resolver> --no-save` (13s). The error
looks like a missing file; it's a missing native binding.

## 2026-07-20 — Session 65: Achievements sub-session 2 — live wiring + unlock toast (Cowork, Sonnet)

**Dispatch shape: ONE optional `recordLifetime(event, value)` collaborator, not four named deps.** items.js
dispatches events ('taskCompleted'/'habitCompleted' ±1, 'streakReached' value = new streak, 'pointsRecovered');
script.js's `recordLifetime` switch owns the semantics, and `applyLifetimeProgress` is the single owner-side
seam (mutate → evaluate → recordUnlocks → toast, in that order so an unlock can never persist without its
one-time notice). Rejected: four separate collaborators (deps-surface noise for one feature), and letting
items.js mutate lifetimeStats directly through a getter (evaluation/toast policy belongs to the owner —
same reasoning that keeps currentRunStats mutation behind RunStats helpers).

**Seam choices (all mirror ACHIEVEMENTS_PLAN.md's fork verdicts):**
- Task/habit counters bump at the SAME completeItem seam as currentRunStats (sub-tasks count as tasks), but
  UNLIKE currentRunStats they reverse on uncompletion (plan's symmetric-decrement scope guard, clamped at 0).
  An already-fired unlock stays — never revoked.
- `bestHabitStreak` high-water-marks at BOTH live streak-update sites (completeItem habit branch, check-in
  'avoided'). The silent restore-time settle path (settleStaleRecurringInstance) got NO wiring — it already
  skips notifyStreakMilestone to stay quiet, and a streak it advances self-heals into the high-water mark at
  the next live completion. 'avoided' does NOT bump habitsCompleted (currentRunStats doesn't either; the
  lifetime counters mirror its seams exactly).
- Back in Black: crossing detected as (old < 0 && new >= 0) around the two LIVE `Economy.addPoints` sites.
  `pointsRecoveries` is never decremented — a later dip negative is a new economy event, not an undo, and the
  family is single-tier so the counter can't be farmed into more badges. Rejected: central detection in the
  shared setPlayerPoints setter (initGame's reset-to-0 after a negative-balance death would false-positive).
- Run-end (`bestRunDaysSurvived` max, Steady Hands qualifying count) fires via `recordLifetimeRunEnd` from
  damage.js's gameOver INSIDE the `!alreadyOver` finalize branch — a reloaded dead save re-renders the UI but
  never re-fires unlock checks (the session-55 duplicate-finalize trap, pre-empted as the plan predicted).
  Steady Hands reads `CONFIG.STEADY_HANDS_MIN_RATE`/`_MIN_DAYS` (added session 64; the v10→v11 migration
  inlines the same values as literals per Persistence's no-module-deps rule — change both or neither). The
  routine-rollup `completionRate` unwrap handles the raw `{rate, samples}` shape — the session-64 finalizeRun
  bug is still unfixed (own session), so the reader stays defensive.

**Toast: queue + batch, deliberately unlike the other FrozenNotice notices.** Every other notice drops itself
if an overlay is already up (fine — their triggers re-fire). An unlock notice is one-time, so
`showAchievementUnlockNotice` QUEUES (400ms poll until the overlay clears) and BATCHES everything pending into
one modal. Ordering with the streak-milestone toast comes free: items.js calls notifyStreakMilestone before
recordLifetime, so the streak notice's setTimeout(0) always registers (and paints) first — plan's "streak
notice first" with no explicit coordination code.

**Live playtest found 1 real bug, fixed same session:** single-badge families have `label: null` in the
catalog (back_in_black), and the toast rendered "Back in Black (null)". Fixed to omit the label when falsy;
re-verified live with a re-armed save. Also verified live: exact-threshold firing (10th completion), streak
toast → batched 2-family modal sequencing, symmetric decrement keeping the badge, zero re-fires on reload,
pristine save restored after testing. 47 suites, 1063/1063 (+17 wiring tests in test/achievements-wiring.test.js).

**No balance numbers changed.** Achievement thresholds untouched; STEADY_HANDS_* keys were session 64's values,
now merely referenced instead of duplicated.

---

## 2026-07-20 — Session 64: Achievements & badges — scoped (Fable) + sub-session 1 BUILT (Sonnet execute)

**Forks resolved before building (AskUserQuestion, Jeremy's picks), full plan in `docs/ACHIEVEMENTS_PLAN.md`:**
1. **Badge-only v1 — no point payouts.** Session 24's balance theory pass tuned shop pricing against an earn rate
   with zero achievement income; a new income stream would silently undercut it before real-play data exists to
   re-tune against. Reward = one-time toast + gallery entry only. Revisit if/when the balance re-check happens.
2. **Lifetime scope, new `lifetimeStats` object.** Unlocks and their backing counters survive game-over/restart —
   same lifecycle as `runHistory` (deliberately NOT touched by `initGame`, wiped only by dev-Reset). Rejected
   per-run-only: badges like "1000 lifetime tasks" would be structurally impossible, and every death would erase
   real progress toward them — feels punishing, contrary to GAME_DESIGN's "reflection over punishment" principle.
   `currentRunStats` (resets per run) and the capped 50-entry `runHistory` both make poor lifetime-counter sources
   on their own, hence a dedicated object rather than deriving one at read time.
3. **UI = Stats window section, not a new FAB item/window.** Badge grid appended to the existing Stats window
   (session 54's `js/ui/statsView.js`) — no new navigation surface to build/maintain. Cut from v1: achievement
   browser, hint system, social sharing, reward-claim UI (PROJECT_SPEC's "big dream" version).
4. **Detection = event-driven at existing recording seams + ONE-TIME retro sweep on migration.** Matches
   ECONOMY.md's existing "Achievements & Badges" line and this codebase's existing architecture (no new polling).
   The retro sweep exists so Jeremy's real save — which already has weeks of history — isn't unfairly credited
   zero lifetime progress the day this feature ships.

**Sub-session 1 (pure core + schema 10→11 + retro sweep) built same session.** `js/achievements.js`: pure
`evaluateFamily`/`evaluateAll`/`recordUnlocks`, catalog passed as an explicit param (never reads a global CONFIG
inside the module — matches heroes.js/runStats.js convention). `evaluateAll` is idempotent by construction (filters
out tiers already in the unlocked map), which let the retro-sweep evaluation and the ongoing per-load safety-net
check be THE SAME call site in `state.js`'s `restoreGameState` — no separate "have I swept already" flag needed.
`CONFIG.ACHIEVEMENTS`: 6 tiered families (Survivor/Task Slayer/Habit Hero/On Fire/Steady Hands/Back in Black),
thresholds are DATA (not gameplay balance in the shop-pricing sense — badge-only, zero economy impact — but still
logged here per the "never change balance numbers silently" guardrail, and easy to retune later).

**Migration constraint discovered/respected:** `js/persistence.js` has a standing "no module dependencies" rule
(v9→v10 already established this, inlining `RunStats.freshRunStats()`'s shape rather than calling it). The v10→v11
migration's retro-derivation is therefore LITERAL inline math over `save.runHistory`/`save.currentRunStats`/
`save.definedHabits` — it cannot call `Achievements.*` or read `CONFIG.ACHIEVEMENTS`. The actual badge-unlock
EVALUATION against the catalog happens once in `state.js`'s `restoreGameState` instead, which already has module
access. Existence-guarded (`if (!save.lifetimeStats...)`) matching the v9→v10 idempotence convention exactly —
covered by a "re-running migrate doesn't clobber real data" test, mirroring the existing runHistory test.

**Found, NOT fixed (out of scope for this session — logged for a future bug-fix session):** while building the
retro sweep's `steadyRoutineRuns` derivation, found that `RunStats.finalizeRun` (session 55) assigns
`ctx.completionRate(...)`'s raw return value — `Heroes.completionRate` returns `{ rate, samples }`, NOT a bare
number — directly into both `stars` (fed into `Heroes.starRating`, which expects a number) and `completionRate` on
every frozen run record. Every real UI caller of `Heroes.completionRate` elsewhere in the codebase (js/ui/heroes.js)
correctly unwraps `.rate` first; `finalizeRun` does not. Consequence: `statsView.js`'s `formatStars`/
`formatCompletionRate` both guard on `typeof x === 'number'`, which is never true against the real shape — the
Stats window's "Routine Performance" section (built session 55, "live-verified") has likely been silently showing
"—" for both fields on every real entry since it shipped. This session's own migration code correctly unwraps
`routine.completionRate.rate` (with a null-safety check) so it doesn't propagate the same mistake, but the
underlying `finalizeRun`/`statsView.js` bug itself was left untouched — unplanned scope, its own session. Added to
ROADMAP's Achievements sub-session 1 entry.

---

## 2026-07-20 — Session 63: Time slider (Today scope) BUILT + damage/routine-HP preview follow-up (Cowork session, Sonnet execute — plan pre-approved; two design forks resolved mid-session via AskUserQuestion, no Fable/Opus needed)

**Forks resolved before building (AskUserQuestion, Jeremy's picks):** (1) preview moves the REAL sprites forward/back
(not ghost overlays) — one render path, matches spec's "preview which tasks are on the horizon and which are moving
fastest"; negative-habit lurkers (fixed lurk-post live, A2 model) ride the midnight line once it's on-screen instead,
per Jeremy's explicit call ("the lurkers will need to move with the midnight line"). (2) Today-scope future spawns
need NO new ghost category — every one of today's habit/routine-task instances is already active at day start, just
positioned off-screen right; re-running the existing pure position math at `previewTime` reveals them naturally.
Week/Month scope (unbuilt) will need real cross-day ghost-conjuring — this session's `TimeSlider.getDayBounds` is
written to extend to that later without a rewrite. (3) Release snaps back to "now" instantly (not "stay until
dismissed") — simplest, matches "preview only, no actual time manipulation" (PROJECT_SPEC), and avoids a whole class
of "is the live loop suppressed correctly" bugs a persistent scrubbed state would risk.

**Architecture:** `js/loop.js` gained a THIRD guard (`isTimePreviewActive()`, same "one owner at a time" contract as
the existing `isOfflineCatchUpActive()`) — `updateActiveItems` early-returns while scrubbing, so no damage/regen/
position writes happen live during a preview of any length; `updateGame`'s `lastLoopTickMs` keeps advancing
regardless (unconditional, before the guard), so a long scrub is never mistaken for a suspended-loop gap on release.
`js/timeSlider.js` (pure) + `js/ui/timeSliderView.js` (DOM) follow the clock.js/movement.js split precedent exactly.

**Mid-session follow-up (Jeremy, unplanned): "the preview also needs to show base damage and freezes."** Two
sub-questions resolved via AskUserQuestion before building:
- **Freezes:** ROUTINES.md confirms freeze triggers on 3+ consecutive INDULGE days, evaluated at occurrence-resolution
  time (avoid/indulge button, check-in, rollover) — a day-level fact that literally cannot change from scrubbing to a
  different time of TODAY. Jeremy confirmed: no new code needed. Verified true — `renderHeroesAtBase()` was already
  called unconditionally every live tick (from `updateGame()`, not gated by any preview guard), so frozen/KO'd hero
  chip badges stay correctly current through a scrub with zero changes.
- **Base + routine HP:** Jeremy confirmed a full projection — simulate what base HP (and each owning-routine's HP)
  WOULD be at the scrubbed time. Rejected a from-scratch simulation (would need to replay every item ever active,
  including completed/removed ones, to be accurate) in favor of a DELTA anchored at the current known-correct HP:
  `TimeSlider.projectBaseHealth`/`projectRoutineHealthDeltas` compute ticks-elapsed-since-due at `previewTime` minus
  ticks-elapsed-at-`now`, using the SAME `CONFIG.DAMAGE_INTERVAL_MS`/`OVERDUE_DAMAGE`/`BASE_REGEN_INTERVAL_MS`/
  `BASE_REGEN_HP` constants the live loop/regen tick read, so the projection can never disagree with what would
  actually happen. Symmetric for rewind (negative delta undoes not-yet-applied damage/regen). Routine HP has no regen
  term (routines only revive-on-KO next day, not a gradual tick) and respects the SAME `routine.koState` guard
  `items.js`'s real `damageRoutineForItem` uses (no further damage accrues once KO'd).
- **Rendering:** `script.js`'s `renderHeroesAtBase()` gained an optional `routinesOverride` param — the view passes a
  shallow-cloned routines array with `health` patched to the projected value; `HeroesView` itself is completely
  unchanged, it just renders whatever array it's given. Real `definedRoutines`/`routine.health` are never mutated.
  At `previewTime === now` the delta is mathematically zero, so calling the SAME code path on release naturally
  restores the exact live values — no separate restore branch needed anywhere in the projection code.
- **Playtest finding (not a bug, initially looked like one):** live-verifying with a single overdue task showed only
  a 1-point HP drop scrubbing 14 hours forward — looked wrong until hand-computing revealed `BASE_REGEN_HP`/
  `BASE_REGEN_INTERVAL_MS` are IDENTICAL to `OVERDUE_DAMAGE`/`DAMAGE_INTERVAL_MS` by design (config.js's own comment),
  so one overdue item's damage is almost fully offset by the base's own flat regen trickle over a long window — the
  projection was correct, my expectation wasn't. Adding a SECOND overdue item (one routine-owned) made the effect
  unambiguous in the live demo (base HP → 0, hero chip health bar → empty) — see session write-up.

**Also this session (Jeremy, mechanical):** time label moved from the right side of the slider to the left
(`index.html`/`css/timeSlider.css`, `.time-slider-label`'s `text-align` flipped left → matches).

**Alternatives rejected:** ghost OVERLAYS instead of moving real sprites (rejected — doubles the DOM, spec explicitly
says "preview" implies the real enemies move); simulating routine FREEZE forward in time (rejected — not a coherent
concept within a single day, confirmed via ROUTINES.md before even asking Jeremy, to avoid inventing a mechanic);
gating the HP projection's `.time-preview-ghost` opacity behind `fx-off`/`prefers-reduced-motion` like the streak-fire/
walk-bob effects (rejected — this is a functional "projected, not real" state indicator, not decorative motion; no
new CSS animation was introduced for it to gate in the first place).

**Tests:** 45 suites, 1019/1019 (+52 over session 62's 967: 33 timeSlider.js pure-function tests, 17
timeSliderView.js DOM-wiring tests incl. the damage/routine-HP optional-collaborator group, 2 loop.js guard tests).
`node --check` clean on script.js/js/timeSlider.js/js/loop.js/js/ui/timeSliderView.js. Live-verified end-to-end in
Chrome: scrub forward/back repositions real sprites + lurker rides the midnight line + rewinds to the lurk post
before 8pm; base HP/sprite tier + hero chip health bar project correctly (verified against hand-computed expected
values, including the regen-offset case above); release snaps everything back to live values instantly with zero
drift; two-overdue-item scenario visually confirmed a fully-drained projected base + routine. Zero console errors
from game code (only pre-existing, unrelated Chrome-extension messaging noise). Save reset to pristine before
ending. NOT committed — git commands in chat. See UI_UX.md (Time Slider section, expanded)/ARCHITECTURE.md/ROADMAP.md.

---

## 2026-07-19 — Session 62: [P2-UI-013] Routine transfer BUILT — habits + tasks, ticket closed (Cowork session, Fable scoping → execution)

**Scope decision (Fable, three forks resolved by Jeremy):** the ticket's AC (drag-and-drop, bulk
ops, "optimization suggestions", undo history — a 3-week estimate from the old audit) was inflated;
v1 is a Move button + stacked destination picker composing existing primitives. Forks: (1)
**frozen-offender block** — the habit holding `frozenState` can't transfer while frozen (prevents
dodging the penalty; consistent with "tokens can't dodge a freeze"); rejected: freeze-follows-habit
(punishes an innocent routine), transfer-counts-as-edit-unfreeze (cheap escape hatch). (2) Scope
initially habits-only, widened by Jeremy mid-session to **habits + tasks** — task side is simpler
by construction (no back-reference, no offender arm). (3) **Destination capacity reuses the
banked-point prompt** (`ensureRoutineSlotAvailable`), not a flat block — consistency with all add
flows. Transfer deliberately does NOT run the edit-to-unfreeze recovery check and logs
`changedFields: ['routineId']` to modificationHistory.

**In-session judgment calls (logged, not user-forked):** (a) board reconciliation = recall live
instances iff the DESTINATION wouldn't spawn the definition (inactive/frozen/KO'd), then run both
daily generators unconditionally (they dedupe) so transfer-into-active spawns today's instance
immediately — mirrors deactivation-recall + reactivation-spawn precedents exactly. (b) Found and
fixed a latent refund asymmetry the transfer feature would have exposed: `refundRoutineXpForItem`
re-resolves ownership at refund time, so uncompleting after a transfer would debit the NEW owner;
`completeItem` now stamps `item.routineXpRoutineId` and the refund prefers it (additive field, no
schema bump, fallback for old saves) — same stamp-beats-re-checking philosophy as
`routineXpAwarded` itself.

**Re-scope decision (Fable):** the ticket as written ("standardize Root vs MPE variants") is STALE —
Deadline-MPE is the dead May 2025 prototype (reference-only per CLAUDE.md). Modern reading adopted:
unify the CURRENT app's two parallel window systems — the FAB-opened `.management-window` panels
(backdrop-click close, no ESC-per-se, no focus mgmt) and the ad-hoc `.modal-overlay` form/popup
clusters (18 inline HTML-string builders, `closeModal()` nukes ALL overlays, per-popup backdrop
listeners in popups.js, zero ARIA/focus). Two stages: Stage 1 (this session) = shared behavior
layer, form markup untouched; Stage 2 (unscheduled) = central `Modal.open()` builder + cluster
migration. Alternative rejected: implementing the ticket's literal MPE acceptance criteria
(pointless — MPE is never shipping).

**Built (execution):** js/ui/modal.js grew `closeTopmost` (closeModal KEEPS close-all semantics —
flows like "Add Selected"→reopen depend on it; the two functions are deliberately distinct),
`initDismissHandlers` (ESC closes topmost overlay first, ONE per press, then falls through to
windows+FAB; backdrop click closes only the clicked overlay; replaces two inline script.js handlers
+ 3 redundant per-popup listeners in popups.js), `initFocusManagement` (MutationObserver on body
childList — leans on the verified invariant that every overlay is inserted as a DIRECT child of
body; auto-ARIA + focus content on open, restore focus to recorded opener on close; chained
same-tick close+reopen degrades gracefully to fallback focus — perfect chained return is a Stage 2
property), `trapTab`. addItemModal's Cancel switched to `closeTopmost()` — it stacks on the routine
management modal and previously killed BOTH (real UX bug, fixed). Management windows: static
role="dialog"/aria-labelledby/tabindex="-1" in index.html, win.focus() on open,
restore-focus-to-FAB-when-stranded on last close (never steals focus the user placed elsewhere).

**Testing decision:** added `jest-environment-jsdom` (^30.4.1 — 30.4.2 doesn't exist for the env
package even though jest core has it) as a devDependency; test/modal-behavior.test.js is the suite's
FIRST jsdom file (per-file `@jest-environment jsdom` docblock; global testEnvironment stays 'node').
19 tests. Two jsdom gotchas worth remembering: (1) MutationObserver callbacks queued by a test's
last DOM mutation fire during environment teardown and crash jsdom's error reporter — drain with an
afterEach macrotask flush, plus a cheap `!document.body` guard in the handler itself; (2) init the
document-level listeners ONCE per file, not per test, or ESC handlers stack and close two overlays
per press.

**Live-verified in Chrome end-to-end:** stacked ESC unwind (Add Habit modal closes, Manage modal
survives, focus returns inside it), Cancel topmost-only, backdrop topmost-only, Tab trap wraps both
directions, window focus in/out (fabButton), full create-task flow still works (enemy spawned), no
new console errors. Pre-existing non-bug noted: forms.js wires modal listeners on a 50ms setTimeout —
closing within that window logs "Modal not found" harmlessly (automation-speed only; candidate for
removal in Stage 2). Save reset to pristine before ending.

---

## 2026-07-19 — Session 60 (part 2): [P2-GAME-010] Stage 1 BUILT — CSS walk-speed-up (Cowork session, Sonnet — plan pre-approved as part of the scoping pass earlier this session)

**Built:** `Clock.getWalkUrgencyTier(item, currentTime)` (js/clock.js) — pure, reuses the existing
TWO_HOURS_MS/FOUR_HOURS_MS zone boundaries `calculateTimelinePosition` already uses, returns
`'calm'|'approaching'|'urgent'|null` (null once overdue). `js/loop.js`'s `updateActiveItems` sets one
`urgency-*` class per tick on an actual tier CHANGE only (same perf discipline as session 59's streak
classes — no per-tick classList churn). CSS (`css/enemyStatus.css`): a single `@keyframes
enemy-walk-bob` (translateY + rotate) with three classes differing only in `animation-duration`
(1.4s/0.9s/0.5s) — deliberately no color/glow/box-shadow, motion-only per Jeremy's explicit call
this session. `css/enemySprites.css`: `.enemy:hover` gets `animation-play-state: paused` so the
bob's continuous `transform` doesn't fight the existing hover-scale transition (desktop-only
concern — no real `:hover` on touch, so mobile is unaffected either way).

**Two real bugs found live in Chrome and fixed before merge (not caught by unit tests written
first — both are integration-shaped, DOM-element-identity bugs):**

1. **Edit-triggered overdue transition left a stale urgency class.** `recomputeOverdueStateAfterEdit`
   (js/items.js) calls `markAsOverdue` directly when an edit pulls a due date into the past — a
   SEPARATE call site from loop.js's own tick-transition branch, which is where the clear was
   originally (and only) written. Fix: moved the clear INTO `markAsOverdue` itself, so both call
   sites get it for free. Repro'd live: edited "Approaching Test"'s due time into the past, watched
   `urgency-approaching` incorrectly persist alongside the new `enemy-at-base` pulse; confirmed fixed
   post-patch with the same edit.
2. **A restored item never got its class applied to the rebuilt DOM element.** `persistence.js` only
   strips `element`/`listItemElement` from the save (the only genuinely unserializable fields); a
   plain string field like `urgencyTier` survives the round trip. `state.js`'s restore loop rebuilds
   the DOM element fresh (`addItemToGame`) but left the OLD cached `urgencyTier` value on the item —
   so if the freshly-computed tier happened to match the stale cached one (the common case: nothing
   about the due date changed across a reload), loop.js's change-diff optimization concluded "no
   change" and never applied the class to the new element at all. Fix: `state.js`'s restore loop now
   resets `item.urgencyTier = null` alongside the existing `element = null` / `listItemElement = null`
   resets, right where that DOM-rebuild invariant is already being established. Repro'd live: reloaded
   a live 3-task test board, confirmed 2 of 3 non-overdue items had NO urgency class despite visibly
   still advancing on the timeline; fixed, reloaded again, confirmed all three tiers correctly present.

**Not unit-tested: `restoreGameState` itself** (bug #2's actual call site) — per state.js's own header
comment, no current test exercises it directly (too DOM-heavy; the established precedent here is live
Chrome verification instead, which is exactly how this bug was caught). Bug #1 IS covered by new
tests in `test/items-lurker.test.js` (`Items.markAsOverdue` / `Items.recomputeOverdueStateAfterEdit`
describe blocks) against the real module.

**Tests:** 41 suites, 926/926 (900 prior-session + 8 clock.test.js + 5 loop.test.js + 4 new + 1
adjusted in items-lurker.test.js; loop.test.js's own "clears on overdue" test was rewritten to assert
loop.js does NOT touch the field itself, since that responsibility moved to items.js). `node --check`
clean on every touched file (clock.js, loop.js, items.js, state.js).

**Unrelated tangent investigated same session, NOT a bug:** Jeremy noticed the base wasn't taking
damage from an overdue test task over a few minutes of live observation. Traced to
`CONFIG.BASE_REGEN_HP`/`BASE_REGEN_INTERVAL_MS` being numerically IDENTICAL to
`OVERDUE_DAMAGE`/`DAMAGE_INTERVAL_MS` (both 1 HP / 5 min, "symmetric heal/damage rate by design" per
config.js's own comment) — both clocks (`getLastRegenTickMs`, an item's `lastDamageTickTime`) get
freshly seeded to "now" at/near the same reload moment during this session's live testing, so they
crossed their respective 5-minute thresholds within the same tick and canceled out (+1 heal, -1
damage, net 0), reading as "nothing happened." Confirmed the damage-tick code path itself is
untouched by this session's changes (loop.js's damage block, below the position/tier section this
session edited, is unmodified). Not investigated further — a coincidental clock-alignment artifact of
THIS session's specific test sequence (multiple reloads in quick succession), not a general gameplay
bug; worth a dedicated live-play sanity check outside a testing session if Jeremy wants full
confidence in the regen/damage interaction.

## 2026-07-19 — Session 60 (part 1): [P2-GAME-010] Enemy acceleration — design + sprite-effort scoping (Cowork session, Fable — design calls only, no code)

**Decision:** Urgency mechanism is **walk-animation speed-up at the existing urgency thresholds**
(the 4h/2h timeline zones in `Clock.calculateTimelinePosition`) — Jeremy explicitly likes sped-up
walking as urgency rises. `Assets/Zombies/` has one static PNG per category (no walk-cycle frames),
so the effort was scoped into a **two-stage plan** (Jeremy picked both):

- **Stage 1 — CSS-only "fake walk" now:** bob/sway transform keyframes on the existing static
  sprites, urgency-tier classes driving `animation-duration`, CONFIG-tunable thresholds, gated by
  the session-59 effects-intensity setting. Zero new art; unblocks the ticket immediately.
- **Stage 2 — real art later, 4-frame walk cycles** (Jeremy's choice over 2 or 6–8 frames) × 8
  categories, delivered as horizontal sprite sheets; code swaps the bob keyframes for `steps(4)`
  `background-position` cycles. The tier/speed wiring from Stage 1 carries over unchanged, so the
  art is a drop-in upgrade on Jeremy's own timeline (production route open — hand-drawn Aseprite,
  AI-gen, or asset pack; deliberately not committed yet).

**Rejected:** waiting on real frames before shipping any acceleration (blocks a P2 on an
unscheduled art task for no mechanical gain — the speed-tier mechanism is identical either way).

**Glow/color-shift urgency indicators → REJECTED** (spec's "glowing, faster animations" and
color-temperature-shift language notwithstanding): the streak fire effect (session 59) already owns
glow on enemies, and stacking a second glow vocabulary would muddy what glow means. Urgency will be
communicated by motion (walk speed), not light.

**Position math stays untouched.** The ticket was written for velocity-based movement, but position
is a pure function of time-to-deadline; the piecewise mapping (>4h = 75–100% of screen, 2–4h =
50–75%, <2h = 0–50%) already accelerates screen-space movement near the deadline. No curve change
now or when the ticket is picked back up.

**"Consistent across both variants" criterion is moot** — Deadline-MPE is frozen reference; when
built, "both" means tasks + habits.

## 2026-07-19 — Session 59: [P2-UI-009] Streak visual effects — Milestone 4 opener (Cowork session, Sonnet — plan approved by Jeremy up front, no mid-session design fork)

**Scope, confirmed with Jeremy before building:** two-tier fire effect (existing 3+ "on fire" tier
plus a new stronger 7+ "blazing" tier, additive not exclusive), a one-time streak-crossing
notification, and an effects-intensity preference toggle (full/reduced/off) per the ticket's
acceptance criteria (ACTIONABLE_TICKETS.md [P2-UI-009]).

**Particle system → rejected in favor of layered CSS.** The ticket asks for a "particle system" and
explicit "performance optimization for multiple concurrent effects" / "mobile devices" — read
together, those are in tension: a real DOM/canvas particle system is the thing MOST likely to hurt
on mobile with several habits on screen at once. Built instead as a pure box-shadow/filter/transform
animation on the existing enemy element (`css/enemyStatus.css`'s `flame-flicker`/
`flame-flicker-strong` keyframes) — no extra DOM nodes, GPU-composited. Deliberately avoids
`::before`/`::after` too: both are already claimed on `.enemy.habit-enemy` (`::before` = category
icon, `enemySprites.css`; `::after` = the negative-habit 🚫 badge, which CAN coexist with high-streak
on the same element for a negative habit being successfully avoided repeatedly).

**Stronger tier threshold: 7, chosen as roughly a week of a daily habit.** New `CONFIG.
HABIT_STREAK_STRONG_THRESHOLD`. Net-new tunable, not a change to an existing balance number
(`HABIT_STREAK_BONUS_THRESHOLD` untouched) — both are purely visual (streak has awarded zero points/
XP since session 16's rate-based bonus replaced the old flat streak bonus), so no economy impact and
no balance-tuning protocol invocation, logged here per config.js's "new balance numbers" convention
anyway.

**Notification fires on crossing, from LIVE player actions only.** New pure `Habits.
crossedStreakThreshold(oldStreak, newStreak, thresholds)` returns the highest threshold newly
crossed (or null) — kept separate from `applyHabitCompletion` so the points/XP math stays untouched
by a purely-visual concern. Wired into `Items.completeItem` and `resolvePendingCheckIn`'s 'avoided'
branch (both real player actions) via a new optional `deps.onStreakMilestone` collaborator —
`FrozenNotice.showStreakMilestoneNotice`, same shared-module/setTimeout(0) pattern as every other
notice in that file. Deliberately NOT wired into `settleStaleRecurringInstance` (the silent
restore-time auto-resolve for negative habits) — same reasoning as every prior notice in
frozenNotice.js: a silent/automatic path re-fires on every reload/restore, which is exactly the
session-55 duplicate-run-history class of bug. Live-verified this doesn't re-fire on reload (see
ROADMAP.md entry).

**Settings window is new — first content in a UI surface that's existed only as a forward-declared
schema note ("`deadline.settings` — not yet implemented", DATA_SCHEMA.md since Milestone 1).** Built
as a 6th FAB item / management-window type, following the exact shop/stats precedent
(`ManagementWindows.openManagementWindow`'s dispatch, deps-object-only, no closures) —
`js/settings.js` (load/save/validate against a SEPARATE `deadline.settings` localStorage key, not a
schemaVersion-bumped field on the main save — preferences aren't run state, shouldn't be wiped by a
dev Reset or a fresh run) + `js/ui/settingsView.js` (DOM-only render). Applied to the live DOM as a
`<body>` class (`fx-reduced`/`fx-off`) that `enemyStatus.css` keys off; `prefers-reduced-motion` is
honored unconditionally regardless of the in-app setting.

**Verification:** +24 tests (41 suites, 910/910) — `spawning.test.js` (super-streak additive-tier
cases), `habits.test.js` (`crossedStreakThreshold`, incl. no-op on decrease/re-completion-at-high-
streak/empty-thresholds), new `settings.test.js` (load/save/validation/fallback + the pure
`bodyClassesForIntensity` mapping + the DOM wrapper, using an in-memory `localStorage` stub since
`testEnvironment: 'node'` has no ambient one — per test/setup.js's documented per-file-binds-its-own-
globals convention). `node --check` clean on every touched file. **Live-verified in Chrome** (server
already running, session per CLAUDE.md's Cowork playtesting note): Settings window renders and
persists the toggle across reload (`fx-off` survived a full page navigate); manually toggling both
CSS classes on a live enemy element confirmed the base tier (bright orange glow) and stronger tier
(visibly hotter/bigger/faster) both render, and `fx-off` correctly suppresses the glow entirely; a
REAL habit completion (hand-set `habitDef.streak` to 2 via the documented hand-edit-save protocol,
then clicked "Mark as Complete" for real) crossed 2→3 and produced the exact expected toast — "🔥
Streak Test is on fire! 3-day streak — this habit is heating up." — with correct XP/points award and
no console errors; reloading afterward confirmed the toast does NOT re-fire (no duplicate-notice
bug). Save restored to pristine (dev Reset + cleared `deadline.settings`) before ending. NOT
committed — git commands in chat.

**Known gap, not a regression:** hand-editing an EXISTING active item instance's own `streak` field
in `deadline.save` and reloading did not visually apply high-streak (the instance's `.streak` reverted
to its original value across the reload in this manual test) — pre-existing behavior around how/when
habit instances get regenerated at boot, unrelated to anything touched this session (grep-confirmed:
no code anywhere sets `item.streak` after instance creation; only `habitDef.streak` is ever mutated,
and `Spawning.addItemToGame` pushes the restored item object as-is). Not investigated further —
out of scope for this ticket; the class-assignment logic itself (`Spawning.resolveEnemyVisual`) is
unit-tested and was separately confirmed live by toggling the classes directly on a real DOM element.
Worth a look if a future session touches habit-instance restore/regeneration.

---

## 2026-07-19 — Session 58: Stale "Mark as Complete" checkbox bug fixed (Cowork session, Sonnet — fully root-caused going in, no design fork)

**The session-7 Known bug**, closed exactly as originally sketched in ROADMAP.md. `uncompleteItem`
(js/items.js) has always rebuilt the OWNING PARENT's row when un-completing a sub-task (`if
(item.parentId) { ... parentTask.listItemElement.remove(); deps.createListItem(parentTask); ...
}`), but had no corresponding branch for a TOP-LEVEL item's own row — `sortAndRenderActiveList`
simply re-appended whatever `item.listItemElement` already pointed at. That node is the exact DOM
element built (unchecked) back when the item was first created; nothing in code ever sets its
checkbox to `checked = true` — that happens only via the native browser click that originally
completed it. Since the node is never discarded (just detached from the DOM while the item lives
in `completedItems`), reusing it on uncomplete re-inserted a pre-checked "Mark as Complete" box for
an item that was, in every other respect, freshly active again.

**Fix:** a new `else` branch, structurally identical to the existing parent-rebuild branch:
`if (item.listItemElement) item.listItemElement.remove(); deps.createListItem(item);` for any item
with no `parentId`. No design call needed — `createListItem` already existed as exactly the right
tool (it's in `uncompleteItem`'s own deps list already, used one branch above), and the fix is a
straight application of a pattern the file already uses for the identical reason. Sub-tasks
deliberately get NO such branch — per the pre-existing comment just below ("sub-tasks should never
get their own main list item"), they render nested inside their parent's row, so there is no
top-level node of their own to rebuild.

**Verification:** +3 tests in `test/subtask-lifecycle.test.js`'s new "stale-checkbox fix (session
58)" describe: (1) a top-level item's old element gets `.remove()`d and `createListItem` is called
with it; (2) a sub-task's own element is left untouched (only the parent's is rebuilt — regression
guard against ever "fixing" this the wrong way for subs); (3) a defensive null-`listItemElement`
case doesn't throw. 40 suites, 886/886 (883 + 3). `node --check` clean. **Live-verified in Chrome
end-to-end:** created a real task via the Add Task form, completed it (XP 0→10, points 0→10,
correct), unchecked it from the Completed Today card, and confirmed via
`document.querySelector('.completion-checkbox-input').checked === false` — the DOM's actual
checkbox state, not just a visual read — that the re-inserted row is a genuinely fresh, unchecked
element; XP/points refunded back to 0 exactly (unaffected by this session, confirming the
underlying economy was never the bug, only the stale DOM node). No app console errors (only the
standard Chrome-extension "message channel closed" noise, unrelated to the app). Save restored to
pristine afterward.

**No open design questions; nothing deferred.** This closes the last item in ROADMAP's "Known
bugs" section that had a plan — Milestone 3 is now fully closed (both respawn bugs from sessions
56–57, and this cosmetic bug) except the two optional polish sub-sessions (run-history, heroes)
still cut pending real play data.

---

## 2026-07-19 — Session 57: Cheat-day-excused respawn variant — design fork resolved (Fable) + fix built: "the marker lives all day"

**The session-56 follow-up bug.** An excused indulge records NO occurrence (session 26: excused ≠
success/miss — must not touch the rate history) and, per session 34, nulled `cheatDayDate` ("one
use per token"). Net effect: after the excused instance was removed, no state the spawn dedupe
consults marked the day resolved, so a same-day reload respawned the lurker — with its cheat cover
gone, meaning a second "I indulged" click debited for real. The player pays 200 points for a token
and can still eat the full punishment. Quiet variant: leave the respawned lurker alone and the
next morning's check-in asks about a day that was excused (answer "avoided" = undeserved reward,
"indulged" = real debit — wrong both ways).

**Decision (Fable fork, this session) — Option A, "marker lives all day":** `indulgeHabit`'s
excused branch keeps `cheatDayDate` set; `selectHabitDefsToSpawn` gains a
`cheatDayDate === spawn-day` gate parallel to `skipDayDate`. Why: (1) the marker is already
date-scoped, so it self-expires next calendar day by comparison — no clearing logic needed for
correctness, a stale past-date marker is inert everywhere (all consumers date-compare) and the
next token use overwrites it; (2) "one use per token" survives structurally — the gate guarantees
at most one instance per day, hence at most one excused indulge per token, so eager nulling was
never load-bearing; (3) defense in depth — if an instance ever appears through a future hole, its
popup still shows cheat-active and indulges free instead of silently debiting; (4) each token's
state stays in its own field. Rollover (`settleExcusedCheatDay`) and check-in
(`resolvePendingCheckIn`) still clear the marker — by then the day is over, and those paths cover
the un-indulged case. **Rejected — Option B, write `skipDayDate` on excuse:** identical player
outcome and no new gate condition, but records a Cheat event in Skip Day's field — fine while only
the spawn gate reads it, misleading the moment any UI/stats/migration treats `skipDayDate` as "a
Skip Day was used." **Rejected — an 'excused' occurrence type:** reverses session 26, and
`success` is a boolean feeding `successRate` — a third state ripples through the rate math.

**Changes:** `js/items.js` (excused branch keeps marker; header comment), `js/habits.js` (gate +
comment). Tests: `items-cheatday.test.js` live-indulge test flipped from `toBeNull` to
marker-kept + a new end-to-end regression (indulge → instance gone → selectHabitDefsToSpawn
returns nothing); `routine-active-gating.test.js` +3 pure gate cases (matches-day blocks,
spent-yesterday marker doesn't, null unaffected). **40 suites, 883/883** (879 + 4). `node --check`
clean. **Live-verified in Chrome through the real flow end-to-end:** points hand-set to 500
(bare-`Persistence` stub protocol per session 56's lesson — worked first try this time), real shop
purchase (→300 pts, `inventory.cheat_day: 1`), token applied via the lurker popup ("🎟️ Cheat Day active" note rendered), free indulge (points unchanged at 300, `occurrenceHistory`
still `[]`, streak untouched, marker KEPT at `2026-07-19`), two same-day reloads → zero respawn,
zero console errors; negative control hand-nulled the marker → lurker correctly respawned. Save
restored to pristine afterward.

**Residual (accepted, by design):** a marker applied but never indulged still blocks a re-spawn
only via the restored live instance (unchanged behavior); and after rollover the OLD marker is
cleared by settlement paths as before. The only new lingering state is a spent marker on a habit
whose excused day ended without a rollover settlement (indulged live, then never reloaded until
days later) — it's a past date, inert by comparison, overwritten by the next token. No migration
needed; no schema bump.

---

## 2026-07-19 — Session 56: Same-day lurker-respawn-after-indulge bug fixed via occurrenceHistory dedupe (Cowork session; planned on Fable, mechanical fix)

**The scheduled Known bug from session 30, root cause exactly as sketched there.** `indulgeHabit`
records an `'indulged'` occurrence and removes the instance, but deliberately never sets
`lastCompletionDate` (a lapse isn't a completion) — and `Habits.selectHabitDefsToSpawn`'s dedupe
consulted only `lastCompletionDate` + a live-instance scan, so a same-day reload spawned a fresh
lurker.

**Decision — third dedupe condition, not a new marker field:** any `occurrenceHistory` entry for
the spawn day (`o.date === toOccurrenceDate(forWhichGameDay)`) means the day is RESOLVED
(completed / overdue / indulged — polarity-agnostic) and blocks the spawn. Why this over
alternatives: (a) the entry is ALREADY recorded by every resolution path, so no new state, no
schema bump, no new write sites; (b) it's self-healing — `applyHabitUncompletion` pops the day's
entry via `removeOccurrence`, so a complete→uncomplete round-trip can't leave a habit wrongly
blocked; (c) a positive habit's overdue-recorded miss coexists with its still-active camping
instance, which the instance-scan already blocks, so the new condition changes nothing for
positive habits in practice. Rejected: a dedicated `indulgedDate` marker field (new state
duplicating information the history already holds — the same shape as `skipDayDate`, but with no
reason to exist). Cap-displacement is impossible same-day: occurrence entries are one-per-date and
the window (14) only drops OLDER dates.

**Verification:** +5 tests in `test/routine-active-gating.test.js` (new "occurrenceHistory gating"
describe): indulged-blocks, different-day-doesn't, success-blocks-too, empty-history back-compat,
and the uncompletion round-trip. 40 suites, 879/879 (874 baseline + 5; note session 55's handoff
said "41 suites" — the repo has exactly 40 `*.test.js` files, so that was a miscount, the TEST
count matched exactly). Live in Chrome: created a real negative habit via the Add Habit form,
indulged via the lurker popup (occurrence `{2026-07-19, success:false}` recorded, points → -5),
then THREE same-day reloads → zero respawn, zero console errors; negative control hand-popped the
occurrence entry (session-52 stub protocol) → lurker correctly respawned. Save restored to its
pristine pre-session state afterward.

**Found, logged, NOT fixed (needs a small design call): the cheat-day-excused variant.** The
excused branch of `indulgeHabit` records no occurrence by design (session 26: excused ≠
success/miss) AND nulls `cheatDayDate` (one use per token) — so after its instance is removed,
nothing the dedupe consults marks the day resolved and a same-day reload respawns the lurker WITH
ITS CHEAT COVER GONE (a second indulge debits for real). Candidate fixes (keep `cheatDayDate` set
until rollover vs. write `skipDayDate` on excuse) both touch session-34 token semantics — logged
under ROADMAP Known bugs for its own session. Code-only finding, not live-reproduced.

**Tooling gotcha for future Chrome sessions (cost one confused negative-control round):**
`persistence.js` declares `const Persistence = ...` at top level — a top-level `const` creates NO
`window` property, so `if (window.Persistence) Persistence.flush()`-style guards SILENTLY no-op.
Every stub/flush in the session-40/44/52 protocols must use the BARE lexical name (`typeof
Persistence !== 'undefined'` if a guard is needed). My first guarded stub attempt didn't apply,
and the 5s autosave (which routes through the un-stubbed `Persistence.requestSave`) overwrote the
hand-edited save before the reload. Same trap applies to every other `const`-declared module
global in js/ (all of them). Also observed once, unverified: the dev Reset button appeared to
leave `definedHabits` + the active instance in place (only points visibly reset) — could equally
have been a missed click; worth a deliberate check next time it's used.

---

## 2026-07-19/20 — Session 55: Run history sub-session 4 — game-over review card + routine rollup; a real duplicate-history bug found + fixed (Cowork session, Sonnet)

RUN_HISTORY_PLAN.md's last two pieces: the game-over review card (`js/ui/gameOverView.js`) and the
Stats window's "Routine Performance" rollup (`RunStats.rollupRoutinePerformance`). Both built per
plan with no open design questions — logged here mainly for the bug found live.

**Found + fixed a real bug live in Chrome (not caught by Jest — no existing test reloaded an
already-dead save more than once).** `State.restoreGameState` has always had `if
(save.gameIsOver) deps.gameOver();` (predates this session, likely present since early gameOver
existed) — its job is to re-show the game-over screen when the player reloads a save that already
ended. Nothing distinguished this "re-display" call from a genuine new death, so `gameOver()`'s
finalize-and-append block (added session 53) ran again on EVERY such reload, silently appending a
duplicate `runHistory` record for the same death each time. Confirmed live: reloaded a crafted dead
save (baseHealth 5, one real overdue task, offline catch-up) twice before the fix and watched
`runHistory.length` grow from 2 to 3 with two byte-identical "Sub-session 4 Death Test, -12 dmg"
entries; after the fix, three more reloads left it at 3.

**Decision — `gameOver(deps, alreadyOver)`: a new second parameter, threaded through the script.js
wrapper and state.js's restore call site (`deps.gameOver(true)`).** When `alreadyOver` is true, the
function skips `RunStats.finalizeRun`/`appendToHistory` entirely and instead reads back
`runHistory[0]` (the record the REAL death already appended) to feed the review-card render; it
also reads `getDaysSurvived()` (the value already frozen and persisted at the real death) instead
of recomputing `computeDaysSurvived(runStartedAtMs, Date.now(), ...)`, which would otherwise DRIFT
upward the longer the save sits before being reloaded (e.g. a week-old dead save would start
reporting "7 Days" for a run that actually died on day 0). Required adding `getDaysSurvived` to
`buildDamageDeps`'s passthrough (script.js's `stateDeps()` already had the accessor; damage.js's
deps bag just never received it since nothing needed it before). Rejected: (a) have
`restoreGameState` build its own separate lightweight re-display path instead of reusing
`gameOver()` — more code, and would need to duplicate the review-card-vs-plain-text fallback logic
gameOver() already has; (b) de-dupe `runHistory` by content/timestamp on append instead of
preventing the double-call — treats the symptom, and a legitimate scenario (identical stats on two
genuinely different runs) could theoretically collide.

**Also found + fixed: a CSS bug, not a logic bug.** The game-over card's own background is
`var(--color-error)` (a red); `StatsView.buildBlameList`'s damage text is ALSO styled
`var(--color-error)` — reused verbatim on the review card, this rendered the "-12 dmg" text
invisible (red-on-red). Fixed with a `.game-over-review-active .stats-blame-damage { color: white;
}` override in the new `css/gameOverReview.css`. Caught only by actually looking at the live
screenshot, not by any test (no Jest coverage exists or is planned for CSS color contrast).

**Resolves:** RUN_HISTORY_PLAN.md now fully CLOSED except optional sub-session 5 polish
(best-run highlight, vs-last-run deltas) — cut unless play data says otherwise.

---

## 2026-07-19 — Session 52: Run history + run review SEQUENCED — 4 design forks resolved (Cowork session, Fable)

Design/sequencing session for Milestone 3's last unchecked feature item, producing
`docs/RUN_HISTORY_PLAN.md` (5 sub-sessions, schema 9→10). Recon first (gameOver/restart/damage
call-site reading), forks resolved with Jeremy on Fable. Key recon fact anchoring everything:
the restart button calls `Persistence.clear()`, so today the dead run is ERASED — run history
requires reworking that flow, not just adding a record.

**Decision — carry-over on new run = FULL RESET; PROJECT_SPEC's "XP and routine slots carry
over between runs" (~line 125) is OVERRIDDEN.** Codifies what `State.initGame` already does
(player XP/level/points/inventory reset). Why: the session-44 banked-slot-points economy derives
available slot points from level — a persisting level would resurrect the level-oscillation
farming exploit that design closed; and self-contained runs keep the roguelike "fresh start"
framing GAME_DESIGN.md wants. Routine defs + hero xp/level/health persist across runs (already
true — heroes are long-lived companions), and `runHistory` persists (that's the feature).
Rejected: spec-faithful carry-over (would force a slot-economy redesign for no play benefit).

**Decision — run record = lean totals + PER-ROUTINE ROLLUP; no raw event log.** Jeremy's goal is
comparing new runs and new routines against past ones, so each record snapshots per-routine
{level, stars, run-window completion rate, member damage, frozen/KO days} alongside run totals +
blame list. Rejected: lean-only (can't A/B routines); timestamped per-tick event log (only payoff
is time-of-day analytics, not in v1; ~288 rows/day per camped item; needs compaction policy —
deferred to its own design session if ever prioritized). Correction made mid-session: damage rate
is 1 dmg/5min per camped item (CONFIG.DAMAGE_INTERVAL_MS), not 1/30s as first stated — Jeremy
caught it; the fork was re-presented with honest numbers before he resolved it.

**Decision — review UI = Stats FAB tab (current run + past-run cards together) AND a game-over
review card.** Jeremy's wording: a tab to "review past stats on runs / routine performance, along
with the current run / performance." Follows the established management-window pattern (5th FAB
item). Game-over keeps a reflection moment per GAME_DESIGN principle 2, rendering the
just-finalized record with encouraging framing. Rejected: game-over-only (no mid-run visibility).

**Decision — blame capture = aggregate per-item map `{name, category, isHabit, routineId,
totalDamage, firstDamageAt, lastDamageAt}` upserted at the damage CALL SITES (loop.js live tick +
damage.js applyOfflineDamage), not inside `damageBase`.** The loop call site passes only an
amount — item identity never reaches damageBase, so attribution must happen where `hit.item`/the
overdue item is in hand. Bounded size regardless of camp duration; survives item completion/
removal; first/last timestamps still answer "when did it start going wrong." Rejected: event log
(above); hybrid events-then-compact (complexity without a v1 consumer).

Scope guards logged in the plan: no charts/trends/AI insights/export in v1 (record shape chosen
so they're buildable later without re-capture); dev-Reset runs are abandoned, not recorded;
`runHistory` capped at `CONFIG.RUN_HISTORY_MAX` (50, tunable).

## 2026-07-19 — Session 53: [Run history] sub-session 2 BUILT — wired to live gameplay (Cowork session, Sonnet)

**Built per RUN_HISTORY_PLAN.md sub-session 2, one real bug found+fixed and one planned step turned out unnecessary.**
`Items.recordRunDamageForItem` (new, mirrors `damageRoutineForItem`'s shape exactly, reuses
`findRoutineForItem` for blame routineId), wired into `js/loop.js`'s live overdue-damage tick and
`js/damage.js`'s `applyOfflineDamage` (shared by reload + live-gap catch-up) via an optional
`recordRunDamage` collaborator. `Items.completeItem` records `tasksCompleted`/`habitsCompleted`/
`pointsEarned`; `Items.markAsOverdue` records `habitsMissed` (positive habits only — negative
habits never reach that branch). `Damage.gameOver` finalizes via `RunStats.finalizeRun` +
`RunStats.appendToHistory`. 40 suites, 859/859 (+18: `test/items-run-stats.test.js` new,
`test/damage.test.js` extended).

**Decision — counters are "what occurred," never corrected/reversed.** A habit that goes overdue
(recording a miss) and is later completed anyway shows BOTH the miss and the completion — no
decrement logic. Considered and rejected a "correct habitsMissed on late completion" approach
(mirroring `Habits.recordOccurrence`'s date-keyed overwrite semantics) mid-session, then reverted
it: `js/runStats.js`'s `recordPointsEarned` already established this philosophy for uncompletion
refunds ("counters describe what occurred, not the net ledger"), and a habit needing a second
chance is arguably MORE informative for Jeremy's stated routine-comparison goal than silently
erasing the miss. Consistency with the already-shipped philosophy won over precision.

**Found + fixed a real ordering bug live in Chrome (not caught by Jest — the mocked deps in
`damage.test.js` didn't previously exercise a same-call fatal hit).** Both `loop.js`'s tick and
`damage.js`'s `applyOfflineDamage` called `deps.recordRunDamage` AFTER `deps.damageBase`.
`damageBase` can synchronously call `gameOver()` at 0 HP, which calls `RunStats.finalizeRun` —
so a base-killing hit's own damage was recorded into `currentRunStats.blame` one line too late,
landing in history AFTER the snapshot finalizeRun had already taken. Confirmed live: killing the
base via a crafted offline-catch-up scenario produced a `runRecord` with an empty `blame: []`
despite the killing task clearly existing. Fixed by reordering `recordRunDamage` before
`damageBase` at both call sites; re-verified live afterward — the same scenario now produces
`blame: [{ name: 'Overdue Test Task 2', totalDamage: 12, ... }]` correctly. Added
`test/damage.test.js` coverage for `gameOver`'s finalize step (existing tests never passed the
new optional deps, so they only proved the no-op path).

**Decision — no restart-button code change needed, despite the plan explicitly calling for one.**
RUN_HISTORY_PLAN.md (written before sub-session 1 existed) assumed `Persistence.clear()` erases
the run and that `runHistory` would need threading through the restart flow like
`definedHabits`/`definedRoutines`. Once sub-session 1 actually built `runHistory` as script.js
in-memory state that `initGame` deliberately excludes from its reset (the same pattern those two
arrays already use), the flow works correctly by construction: `gameOver` appends to the
in-memory `runHistory` before the player can ever click restart; `Persistence.clear()` only
removes the localStorage key, never touching the live variable; the final `saveGame()` in the
restart handler reserializes the untouched `runHistory` value. Live-verified: real base death →
restart → `runHistory` still has 1 entry, `currentRunStats` freshly reset, base/points reset to
100/0. The plan's assumption was reasonable pre-implementation but became moot once sub-session 1
landed — logged here rather than silently deviating from a written plan without explanation.

**Decision — `js/runStats.js`'s `<script>` tag moved to load right after `config.js`**, well
before `js/damage.js` (previously positioned after `economy.js`, i.e., after damage.js). Damage.js
needs to call `RunStats.finalizeRun`/`appendToHistory` as a bare global at `gameOver()` time, but
loads early (5th script tag) — before Heroes/Economy/Items, all of which already solve this same
"loads before its collaborator" problem via injected deps instead. `runStats.js` has zero external
dependencies (confirmed before moving it — no bare-global refs at load time), making it safe to
hoist rather than needing yet another injected-collaborator threading (which was still necessary
for `Heroes.completionRate`/`starRating`, pre-bound in script.js as `heroesCompletionRate`/
`heroesStarRating` since Heroes itself does have load-order dependencies and can't be hoisted the
same way).

## 2026-07-19 — Session 52: [Run history] sub-session 1 BUILT — pure core + schema 9→10 (Cowork session, Sonnet)

**Built per RUN_HISTORY_PLAN.md sub-session 1, no deviations from the approved shapes.**
`js/runStats.js` (fresh stats, blame identity/upsert, counters, `finalizeRun`, capped
`appendToHistory`), `CONFIG.RUN_HISTORY_MAX` (50), schemaVersion 9→10 migration seeding
`runHistory: []` / fresh `currentRunStats`, full state.js/script.js accessor-deps plumbing
(`getRunHistory`/`setRunHistory`/`getCurrentRunStats`/`setCurrentRunStats`), `initGame` resets
`currentRunStats` but explicitly does NOT touch `runHistory`. 39 suites, 841/841 (+26,
`test/run-stats.test.js` + 3 new migration cases). `node --check` clean on all touched files.

**Decision — blame identity aggregates by recurring definitionId, not per-instance.** A habit
missed on 3 different days is one blame row, not three (mirrors the plan's "Gym missed across 3
days = one row" example). One-off tasks (no `definitionId`) key by their own instance id. Habit
defs and task defs sharing a coincidental id string don't collide — the key is prefixed with
`item.type`.

**Found + fixed a real gap live in Chrome (not in the original plan): the dev-only Reset Test
button wiped `definedHabits`/`definedRoutines`/`definedTasks` but NOT the new `runHistory`,
leaving stale run records behind a fresh empty game.** The restart button (real gameplay path)
deliberately preserves `runHistory` per the plan — but Reset Test's stated contract in its own
code comment is "wipes EVERYTHING", so a dev full-wipe silently keeping history was a real
inconsistency, caught by hand-editing a save, dev-resetting, and finding the fake run still in
`localStorage`. Fixed: `resetTestButton`'s handler now also sets `runHistory = []`. Re-ran the
full suite after the fix (still 39/39, 841/841) and repeated the live Chrome check clean before
closing the session.

**Playtest note for future sessions — flush-timing trap distinct from the two already documented
in CLAUDE.md.** Editing `localStorage` directly, calling `Persistence.flush()` to "confirm" the
edit, then navigating away is NOT a valid same-session round-trip check: `flush()` immediately
re-serializes the LIVE in-memory state (which still holds the pre-edit values) and overwrites the
hand-edit before the page ever reloads. The correct sequence to verify a hand-edited save
actually restores: stub `Persistence.requestSave`/`Persistence.flush` to no-ops FIRST, wait out
any in-flight debounce (>500ms), edit `localStorage` directly, THEN navigate/reload (a real
`Persistence.load()` on a fresh page has no live-state conflict to clobber it) — confirmed working
this session. This is the missing piece connecting the two existing CLAUDE.md flush notes (the
session-40/42 "stub before a direct EDIT" trick and the session-44 "flush before a READBACK"
trick) — the trap is calling `flush()` AFTER the edit, on the same still-live page.

## 2026-07-19 — Session 51: [P1-DATA-004] sub-session 5 BUILT — polish, ticket CLOSED (Cowork session, Sonnet)

**Decision — nested completed sub-task rows are DISPLAY-ONLY, deviating from the plan's assumed
interactive checkbox.** SUBTASKS_PLAN.md's sub-session 5 spec ("Completed subs render nested,
greyed, under the parent's Completed Today entry") didn't specify interactivity either way; the
first implementation mirrored the top-level completed-item builder exactly, including its
uncomplete checkbox. Live-Chrome testing immediately surfaced a real bug: unchecking a nested sub
called `Items.uncompleteItem`, which re-links a sub to its parent's `subTasks`/`completedSubTasks`
counters by looking the parent up in the live `activeItems` array — but the parent that's shown in
Completed Today has, BY DEFINITION, already completed and left `activeItems`. The lookup silently
no-ops, the sub still gets pushed back into `activeItems` as a live item with a dangling `parentId`,
and because nested-only rendering excludes anything with a `parentId` from the top-level agenda
list, it becomes an agenda-invisible, base-damaging orphan — confirmed live (health ticked down
with zero visible zombie, `document.querySelectorAll('.task-list li')` returned 0 while the sprite
was on screen). This is the same CLASS of bug sub-session 1 closed for completion/deletion
(SUBTASKS_PLAN.md session 46/47), but through a path that was structurally UNREACHABLE before this
session — nothing ever rendered a completed sub to un-check, so the gap in `uncompleteItem` never
mattered. **Chosen fix: don't render the affordance that reaches it** — the nested row shows a
static "✓ Completed" badge instead of a checkbox, and `deps.uncompleteItem` is simply never called
for a nested sub. Alternative rejected: fix `uncompleteItem` itself to guard against or handle a
missing/already-completed parent — correct in principle, but a mechanics change to items.js's
completion/undo logic is outside a UI-polish session's scope per CLAUDE.md's refactor rules, and
would need its own design pass (does un-completing a sub also un-complete/reopen the parent? does it
restore the parent to `activeItems`? that's a real product question, not a one-line fix). Revisit if
Jeremy wants sub-level undo from Completed Today — flagged as a follow-up, not filed as a ticket.

**Decision — left-fan off-field guard: clamp, not flip-to-right.** SUBTASKS_PLAN.md offered either
as acceptable ("flip left-fan subs right ... or clamp x ≥ base width"). Clamp was chosen:
`Movement.calculateTimelineXWithClustering` floors a sub's final resolved x at `dims.baseWidth`
(the base's right edge — see `Clock.calculateTimelinePosition`, which already treats `baseWidth` as
the universal minimum x for any item). This is a one-line floor with no fan-order/index side
effects and no risk of colliding with a same-side sibling; a sub sitting flush against the base's
edge instead of its "natural" further-left offset is a fully acceptable visual at that extreme.
Flip-to-right was rejected as more invasive: it would need to renumber the sibling's fan index
(changing which "side" it's on mid-approach as the parent nears the base), risking a visible
side-swap jump and interaction with the alternating right/left assignment that every OTHER sibling's
offset depends on.

**Decision — progress label total = `completedSubTasks` + live `subTasks.length`, not a separate
persisted "ever had N subs" counter.** `totalSubTasks` already exists on the schema but (per
`items.js`/`popups.js`) is kept in sync with the OPEN count, not a lifetime total — a naming
mismatch that predates this session. Rather than touch schema or reinterpret an existing field
(out of scope for a polish session, and `totalSubTasks` isn't read anywhere else, so redefining it
risks nothing currently but would still be a silent semantic change worth its own decision), the
label derives its own "M" locally as `completedSubTasks + subTasks.length` at render time — correct
today given how those two fields are actually maintained, and it costs nothing to keep deriving it
this way going forward.

38 suites (unchanged), 803 → 815 tests. `node --check` clean. Live-verified in Chrome end-to-end:
2-sub parent grew with progress label tracking 0/1 → 0/2 → 1/2 → 2/2 live through both sub
completions and back to a 128px box; parent completion moved both subs into Completed Today nested
and greyed under it with the static badge; a left-fanned sub at the base edge sat flush against the
church, confirmed via zoomed screenshot, never behind it. Zero app console errors (only
extension-channel noise, unrelated to the app). **[P1-DATA-004] sub-task hierarchy ticket now fully
CLOSED** — all 5 sub-sessions built (sessions 47–51).

## 2026-07-19 — Session 50: [P1-DATA-004] sub-session 4 BUILT — growing/shrinking parent visuals (Cowork session, Sonnet)

**Decision — derive the render width fresh every tick from the live `subTasks` array, instead of
wiring width updates into every mutation site.** Sub-task count changes at several discrete call
sites (creation, completion, uncompletion/refund, cascade-delete), and hooking all of them would
mean touching items.js in several places for a purely visual effect. Following the [P1-UI-006]
hero-chip precedent (session 43 — "renders per-tick so chips stay live across complete/damage/
freeze/KO/deactivate without new UI hooks"), the new `Movement.getParentGrowthScale`/
`getParentRenderWidth` are pure functions of `item.subTasks.length` called from
`Loop.updateActiveItems` every 50ms tick, via a new optional `deps.getParentRenderWidth`
collaborator (omitted = no-op, matching the existing optional-collaborator tolerance pattern).
Alternative rejected: hook width recalculation into `completeItem`/`uncompleteItem`/
`removeItem`/sub-task creation directly — more call sites to keep in sync, more surface area for a
future sub-session to forget one.

**Decision — growth runs regardless of overdue state.** The position-update branch in
`updateActiveItems` only touches `item.x`/`style.left` for NON-overdue items (an overdue item is
camped at the base and its position is frozen by design). Width is a different concern — a camped
parent can still gain or lose sub-tasks — so the new width-update block sits outside that branch
and runs for every top-level task every tick, independent of `isOverdue`.

**Decision — scale the background sprite WITH the box, not just the box.** The plan required the
sub-task fan to "stay attached to the visible graphic edge at any size." `getSubTaskClusterOffset`
computes edges as fractions of box width (`CONFIG.ZOMBIE_VISIBLE_MARGINS`), which only stays
correct if the rendered graphic actually scales with the box — the legacy CSS held every category's
background fixed at 128×128 regardless of container size, which would have left a growing box with
a static-size sprite adrift inside it and detached the fan. Added a `parent-scaled` class (applied
only to top-level tasks in `resolveEnemyVisual`, js/spawning.js) plus one new CSS rule
(`.enemy.parent-scaled { background-size: 100% 100% !important; }`) placed AFTER the legacy
`.enemy.category-X` blocks in enemySprites.css so it wins the specificity tie-break (both are
two-class `!important` selectors; equal specificity resolves by source order) — rather than editing
the 8 existing per-category blocks directly, which would have changed rendering for every enemy
type (habits, sub-tasks, non-parent tasks) globally instead of just growing parents. No-op at 0
open subs: 100% of a 128px box == the old fixed 128px, pixel-identical — confirmed live (see below).

**Decision — height never changes, only width.** The plan's bottom-alignment concern
("feet stay on the ground line") is satisfied for free by only touching width: `getItemTopPosition`
derives a sub-task's top from the parent's rendered `height`, which is untouched, so no
bottom-alignment math needed changing.

**Balance-tuning protocol:** `PARENT_GROWTH_PER_SUB` (0.15) / `PARENT_GROWTH_MAX_SUBS` (4) are the
plan's proposed values (docs/SUBTASKS_PLAN.md, session 46 Fable sequencing) — this session executed
them, not decided them. Logged in js/config.js with a comment cross-reference.

**Testing:** 27 new tests across `test/movement.test.js` (growth-scale math, cap, shrink-on-array-
mutation, offset-at-scale), `test/loop.test.js` (per-tick width wiring, optional-collaborator
omission, sub-task/habit exclusion), `test/spawning.test.js` (parent-scaled class presence/absence)
— run in the sandbox `$HOME` scratchpad per the Cowork npm rule. 38 suites, 803/803 (+18 net —
27 added tests, some counted across files; see suite totals). `node --check` clean on config.js,
movement.js, loop.js, spawning.js, script.js.

**Live-verified in Chrome against the real running server:** created a parent, added 3 sub-tasks one
at a time — box visibly grew with the fan staying attached at every step (no gap, no overlap, no
drift), zoomed screenshots confirmed pixel-accurate attachment. Completed all 3 subs one at a time —
box shrank back smoothly, final `style.width` read via devtools == exactly `"128px"`, and a zoomed
screenshot was pixel-identical to the pre-growth baseline. Zero app console errors (three
`[EXCEPTION]` console entries during the session were the known Claude-in-Chrome extension
message-channel noise, unrelated to the app). Hit the documented `confirm()`-freeze on the dev Reset
button (CLAUDE.md's known gotcha) — recovered by navigating away (no partial mutation), then
completed the reset cleanly by stubbing `window.confirm` before the click, per the same doc's
established workaround.

**Process note (not a design decision):** the first ROADMAP.md edit attempt matched the wrong
`- [ ] 5. Polish...` line (the [P1-UI-006] Hero sub-session 5 entry, not [P1-DATA-004]'s) because
both sections use the same "5. Polish... (Sonnet, optional)" boilerplate text — caught before commit
by re-reading the surrounding lines, moved to the correct section. Worth a search-before-edit habit
when a ROADMAP string is generic/repeated across milestones.

---

## 2026-07-19 — Session 49: [P1-DATA-004] sub-session 3 BUILT — sub-task economy (Cowork session, Sonnet, balance-tuning protocol)

**Decision — half-value subs applied via the SAME `Economy.taskPoints` seam parents use, not a
new function.** `completeItem`/`uncompleteItem`'s task branches now pick a base
(`CONFIG.SUBTASK_XP`/`SUBTASK_POINTS` if `item.parentId`, else the standalone `xpPerTaskDefeat`/
`pointsPerTask`) and pass it through the existing `Economy.taskPoints(isHighPriority, base)` call —
so the high-priority ×2 rule "comes free" for subs exactly as the plan specified, with zero new
economy.js code. A high-priority sub therefore tops out at `SUBTASK_POINTS × 2` = 10, matching but
never exceeding a standalone task's own base — the plan's explicit ceiling.

**Decision — award/refund symmetry needs no stamp, unlike routine XP.** `uncompleteItem`'s refund
branch duplicates the identical `isSub`/base-selection logic rather than reading a value stamped at
award time (the pattern `awardRoutineXpForItem`/`refundRoutineXpForItem` uses, because routine XP
can cross a level-up boundary between award and refund). A sub-task's `parentId` cannot change
while it's active, so re-deriving the same branch at refund time is guaranteed to match the award —
simpler code, same guarantee, confirmed by the round-trip-to-zero tests.

**Balance-tuning protocol followed:** value (5 XP/5 pts) was already deliberated and logged in
session 46's Fork 4 (SUBTASKS_PLAN.md "Design forks") — this session's job was execution, not a new
number decision. `js/config.js` comment cross-references the fork; ECONOMY.md and MECHANICS.md
updated same-session per protocol step 3. **Gap:** `.claude/skills/balance-tuning/SKILL.md`'s own
canonical-values list (protocol step 3 also names this file) is a protected path from this Cowork
session and could not be edited here — it still reads "XP: 10 per task defeat, 5 per habit
completion" with no sub-task line. Needs a Claude Code session or Jeremy's own edit to close the
protocol's paper trail completely.

**Finding — XP has no priority multiplier anywhere in the codebase**, sub-task or standalone; only
points get the ×2. Confirmed by reading both branches before writing the tests, not assumed — the
live Chrome verification's 5→15 XP jump (5 for the high-priority sub, 10 for the parent) would have
been 20 total if XP multiplied, and it wasn't.

Tests: 38 suites, 785/785 (+9, `test/subtask-economy.test.js`). Live-verified in Chrome; details in
SUBTASKS_PLAN.md sub-session 3.

## 2026-07-19 — Session 48: [P1-DATA-004] sub-session 2 BUILT — dependent due dates (Cowork session, Sonnet)

**Decision — loud rejection at the forms, silent clamp at the data layer.** The plan specified
"form validation, not silent clamping, on manual entry" — implemented exactly that (alert + modal
stays open in both the sub creation and sub edit modals, with the date input additionally capped
via the HTML `max` attribute so the picker can't even offer a later day). But
`Items.createTaskItemData` ALSO gained a silent clamp as its LAST step: its own fallback branches
(no-date → +10min, invalid → +5min) can produce a date past an already-near-deadline parent with
no user input to reject, and programmatic callers never see a form. Loud where a human typed it,
silent where no human is present. The clamp runs last so it wins over the validation fallback.

**Decision (scope judgment) — pushback on a SUB-task clamps to the parent's deadline.** Not in
the plan's bullet list, but `handlePushback` shifts `dueDateTime` later — the exact operation the
clamp model forbids exceeding the parent — so leaving it unguarded would have shipped a
rule-violating side door in the same session that built the rule. Pure
`Items.clampedSubTaskDueDate` applied post-push; a pushed sub caps at the parent deadline (points
are still spent — the tier button doesn't know about the cap). Flagged for the sub-session 5
polish pass if Jeremy would rather grey out pushback tiers that would fully clamp. Pushing a
PARENT later deliberately does NOT touch children (fork 3: they become "earlier", which is legal).

**Decision — `clampSubTasksToParentDeadline` only accepts a top-level TASK parent** (`type ===
'task' && !parentId`) and only clamps TASK children. Depth stays 1 (plan scope guard), habits
can't own subs, and a defensive no-op beats a surprising cascade if a future caller hands it
something odd. Wired into the edit-save path as an OPTIONAL dep (`deps.clampSubTaskDueDates`),
matching removeItem's session-47 optional-deps precedent — older/test callers keep working.

**Finding — `window.Persistence` is undefined; `Persistence` is a bare global.** A CDP probe of
`window.Persistence && Persistence.flush()` silently skipped the flush, making the first
localStorage readback look stale (the session-44 debounce note in CLAUDE.md, but with a new
failure shape: the flush GUARD failed, not the flush). The module objects are declared with
`const` at top level, which does NOT create window properties. Devtools/CDP probes should call
bare `Persistence.flush()` (throws if truly absent — which is the signal you want) rather than
window-prefixed guards.

**Finding (cosmetic, pre-existing, not fixed) — a nested sub row never carries its own
`overdue-list-item` styling.** When the parent-pull clamp drove both items overdue, the parent's
rebuilt card correctly showed the red overdue treatment (session-6 fix: derived in
`createListItem`) and the nested sub row sits inside that red card, but the sub's own nested row
has no independent overdue styling — same behavior before this session for any overdue sub after
a parent-row rebuild. Visually fine (the card is red); logged for the sub-session 5 polish list,
not scheduled.

Tests: 37 suites, 776/776 (+15, `test/subtask-due-dates.test.js` — pure clamp rule, creation
backstop, re-clamp matrix incl. both overdue directions reachable by a clamp). Live-verified in
Chrome end to end; details in SUBTASKS_PLAN.md sub-session 2.

## 2026-07-19 — Session 47: [P1-DATA-004] sub-session 1 BUILT — completion block + deletion cascade + orphan sanitizer (Cowork session, Sonnet)

**Decision — block at the source (parent checkbox disabled), not cascade the completion onto
children.** Matches session 46's Fork 2 exactly as specified: `Items.completeItem` now checks
`item.subTasks.length > 0` before any XP/points/relink logic runs and returns
`{ ok: false, reason: 'subtasks_remaining', remaining: N }` (shop.js's result-object convention) —
existing callers that ignore the return value are unaffected since nothing below the check executes
when blocked, same as the pre-existing `isGameOver`/not-found early returns. UI (agendaList.js,
popups.js) disables the checkbox proactively with a "N sub-tasks remaining" title/label; the
items.js guard is the backstop for any path that bypasses the row.

**Decision — `removeItem` cascades via a LIVE `parentId` lookup, not the parent's own `subTasks`
array.** Deleting a parent now recursively removes every item whose `parentId` currently points at
it (snapshotting ids before recursing — same live-splice hazard `useSickDayGlobally` already
guards against). Reading live relationships instead of trusting `subTasks` to be in sync means a
desynced array (however it happened) can't leave a dangling sprite behind. Deleting a sub instead
syncs the parent's `subTasks`/`totalSubTasks` — deliberately NOT `completedSubTasks`, since a
delete is not a completion. `removeItem` gained two OPTIONAL deps (`createListItem`,
`sortAndRenderActiveList`) guarded with `if (deps.x)` so the many existing smaller-deps callers in
items.js (day-token settlement, rollover, routine-clearing) — none of which touch sub-tasked items
in practice — keep working with zero changes.

**Finding — there is no "Delete Task" UI anywhere in the app.** Grepped for it before writing the
cascade; `removeItem` is only ever invoked internally (completion's fade-out, routine-clearing,
Cheat/Skip/Sick Day settlement, rollover). The ticket's "deletion cascade" acceptance criterion is
therefore a data-integrity guarantee on the internal function, not a new user-facing feature — sub-
session 1 delivers exactly that scope. Consequence: the cascade has no live-UI path to exercise in
Chrome; it's covered by `test/subtask-lifecycle.test.js` only (recursive-depth case included,
defensively, even though the UI caps real depth at 1).

**Decision — `State.sanitizeOrphanedSubTasks` is a new pure function, and state.js now has
`module.exports`.** Placed in `restoreGameState` right after every saved item re-enters
`activeItems` (so parent lookups see everyone) and before the pre-existing parent-list-item rebuild
block (so a promoted item is treated as an ordinary top-level task from that point on — it needs
`createListItem` called for it, since `Spawning.addItemToGame` skipped that while `parentId` was
still set). state.js had NEVER had a `module.exports` before this session — nothing in it was
unit-testable. Added the standard guarded footer (matching every other `js/*.js` module) rather
than leaving the sanitizer untested or duplicating its logic into a test-only copy (the
`test/subtask-creation.test.js` legacy pattern this session deliberately did NOT repeat — see
Watch out in HANDOFF.md). Confirmed safe: the only `window.`/`document.` reference in the whole
file lives inside `restoreGameState`'s function body, not at module-load time, so `require`-ing it
in Jest's `node` testEnvironment never touches DOM globals unless `restoreGameState` itself is
called (it isn't, by any current test — only the pure sanitizer is exercised).

**Finding — the orphan hole was confirmed live, and the sanitizer closes it end-to-end.**
Live-verified in Chrome by creating a real parent+sub, flushing the save, editing `localStorage` to
delete the parent from the saved `activeItems` (simulating a pre-cascade-era orphan) while
suppressing the page's `beforeunload`/`visibilitychange` autosave hook (which would otherwise
re-write the live, still-has-the-parent state over the edit before the reload actually took it) via
a `Storage.prototype.setItem` monkey-patch — a new hazard, distinct from CLAUDE.md's documented
`confirm()`/`alert()` CDP freeze and debounced-save-readback notes, logged here for future
sessions doing similar `localStorage` surgery-then-reload tests. After reload, the orphaned
sub-task appeared as a normal top-level agenda row with its own checkbox — `parentId: null`
confirmed in the reloaded save.

---

## 2026-07-19 — Session 46: [P1-DATA-004] sub-task hierarchy SEQUENCED — 4 forks resolved (Cowork session, Fable)

Planning session only, no code. Output: `docs/SUBTASKS_PLAN.md` (5 sub-sessions, no schema bump).
Grounded by a live Chrome playtest against the real server (parent + 2 subs through the real UI),
which found the **orphan hole**: completing a parent with open subs is allowed, pays full reward,
and strands each child as a battlefield-only zombie with NO agenda row (nested-only rendering) —
still damaging the base, reachable only by sprite click. `removeItem` has the same gap (no cascade).
Also confirmed: subs pay FULL task value (10/10 — a 3-sub task is worth 4× a standalone), creation
inherits the parent deadline but nothing clamps or follows it afterward, parent stays 128px.

**Fork 1 — Parent sizing: BOTH.** Parent scales up per open sub (proposed `PARENT_GROWTH_PER_SUB`
0.15, capped at 4 subs) and shrinks back as they complete, AND the 2026-07-17 visible-edge
clustered sub-sprites stay. Resolves MECHANICS.md's long-standing "open tension" by combining the
spec's growing/shrinking parent with what's actually built. Rejected: keep-as-is (drops a spec
promise the ticket exists to deliver), shrinking-parent-only (throws away working clustering).

**Fork 2 — Parent completion BLOCKED while subs open** ("N sub-tasks remaining" disabled state).
Closes the orphan hole at the source; matches the weaken-then-finish fiction. Rejected:
auto-complete-children-with-rewards (one-click farming of a whole cluster), complete-and-remove-
unrewarded (silently eats listed work). Deletion cascade (parent delete sweeps children; sub delete
fixes counters) is a ticket acceptance criterion, not a fork. Pre-existing orphans in old saves:
restore-time sanitizer PROMOTES unresolvable parentId to standalone — repair, no schema change.

**Fork 3 — Due dates (Jeremy's own wording): default AND latest = parent's deadline; earlier
allowed, later never.** Clamp at sub creation/edit (form validation, not silent clamping); pulling
the parent's deadline earlier re-clamps any now-later children down to it via
`recomputeOverdueStateAfterEdit` per child; pushing later leaves children alone. Rejected:
delta-shift-with-parent (moves subs the player deliberately set earlier), inherit-at-creation-only
(deviates from PROJECT_SPEC ~41).

**Fork 4 — Sub economy: half value, `SUBTASK_XP`/`SUBTASK_POINTS` = 5/5.** Parent keeps 10;
high-priority ×2 applies to each item's own flag (max sub payout 10, still ≤ a standalone task).
Rejected: keep-full-value (4× multiplier invites decomposition farming; conflicts with the
session-24 ~75–85 pts/day yardstick), pool-split (punishes breaking work down — the exact behavior
the game wants to encourage). Numbers land via balance protocol in sub-session 3.

**Scope guards:** depth stays 1 (schema tolerates grandchildren, UI never offers it — documented,
not built); sub-tasks remain task-type only; drag-reorder/connecting-lines/dependency-mapping stay
P2. schemaVersion stays 9 across the whole ticket.

---

## 2026-07-19 — Session 45: HEROES_PLAN sub-session 5 BUILT — interaction FX + ranking, [P1-UI-006] CLOSED (Cowork session, Sonnet)

**Decision — ranking wired into BOTH routine-list surfaces, not just the Manage modal.** The plan
text only mentioned "Routines view ranks by level then star rate," and the sub-session-4 precedent
only ever touched the Manage-modal list. Session's call: `HeroesView.rankRoutines` is also wired into
`managementWindows.js`'s `populateRoutinesWindow` (the compact Routines-window card list) — ROUTINES.md's
existing "Routine A/B Testing" line already promised this ranking behavior at the list level, not just
inside a modal, so leaving the compact list in raw creation order would have left that promise half
kept. Both call sites use the same pure `rankRoutines` (level desc → completion rate desc, null/unrated
treated as -1 → name asc) and both render a sorted COPY — `definedRoutines`'s array order (and its
persistence order) is untouched by either.

**Decision — FX state is ephemeral timestamps replayed via negative `animation-delay`, not a
class-toggle-and-forget.** `renderHeroesAtBase()` fully rebuilds every chip each 50ms tick (sub-session
3's design). A naive `classList.add('flinch')` on the damage hook would get wiped and restarted every
single tick for as long as the class was "on," never actually completing a natural-looking animation.
Instead `Items.damageRoutineForItem`/`awardRoutineXpForItem`/`awardRoutineXpForHabitDef` stamp a
wall-clock timestamp (via new optional `deps.onRoutineDamaged`/`onRoutineCelebrate` hooks, same
"omitted → no-op" tolerance as every other optional items.js collaborator) into a new ephemeral,
non-persisted `heroFxMemory` map in script.js (sibling to `heroStarMemory`, same reset-on-new-game
treatment — no schema bump). `HeroesView.deriveFx` reads elapsed-time-since-stamp each render and the
DOM builder sets a **negative** `animation-delay` equal to that elapsed time, so the rebuilt chip
resumes the CSS animation mid-flight instead of restarting it — visually continuous across rebuilds,
and naturally expires once elapsed passes `CONFIG.HERO_FLINCH_MS`/`HERO_CELEBRATE_MS`. A same-instant
tie favors flinch (damage feedback should never be silently masked by a celebrate).

**Finding — apparent "damage isn't firing" was expected symmetric regen, not a bug.** Mid-verification,
after several real minutes of wall-clock time elapsed during the session (a tool-call pause), a
routine's health and the base's health both stayed unchanged despite `item.lastDamageTickTime`
visibly advancing by a full `DAMAGE_INTERVAL_MS` — looked exactly like the damage hook silently
failing. It wasn't: `CONFIG.BASE_REGEN_INTERVAL_MS` equals `CONFIG.DAMAGE_INTERVAL_MS` (5 min) and
`BASE_REGEN_HP` equals `OVERDUE_DAMAGE` (1), deliberately symmetric per [P2-GAME-012]'s own config
comment — over an idle span that's a whole number of 5-minute intervals, a damage tick and a regen
tick net to zero BASE health change. (Routine health has no regen at all — only base health nets to
zero; a routine's own health genuinely dropped once verified in isolation.) Confirmed the hook fires
correctly by using a runtime-only `CONFIG.DAMAGE_INTERVAL_MS` override (not persisted, discarded on
reload) to accelerate past the real interval — `hero-chip--fx-flinch` fired with correct
duration/delay and both healths dropped by exactly 1 per tick, matching the unaccelerated math.
Flagging for the next session that touches damage/regen/base-health: a short live-verify window that
happens to span whole 5-minute multiples will show no NET base-health change and that is correct,
not evidence the wiring broke.

**Also decided (mechanical, not a design fork):** the Manage modal's completion-% label
(`buildCompletionRateLabel`) is a pure, separately-exported string builder off the existing
`buildChipViewModel`'s `rate`/`rateSamples` fields (newly exposed on the view model this session) —
same "one source of truth, thin presentation wrapper" discipline as sub-session 4's hero-stats block.

Tests: 35 suites, 744/744 (+27: fx-hook gating — fires/doesn't-fire branches — added to
`test/items-routine-damage.test.js` and `test/items-routine-xp.test.js`; `deriveFx` (8 cases) and
`rankRoutines` (7 cases) plus the view model's newly-exposed raw `rate` field in
`test/heroes-view.test.js`; `buildCompletionRateLabel` plus `buildHeroStatsHtml`'s new label in
`test/routine-views-slots.test.js`). `node --check` clean on every touched file. Live-verified
end-to-end in Chrome against a real running server (localhost:8000) — see HEROES_PLAN.md sub-session 5
for the full live-verify writeup, including the regen finding above. [P1-UI-006] (hero/routine visual
system) is now fully CLOSED — sub-session 5 was scoped optional/cut-if-play-data-said-otherwise and
shipped instead, since it was small and the plan was fully specified.

---

## 2026-07-19 — Session 44: HEROES_PLAN sub-session 4 BUILT — hero management UI + banked slot points (Cowork session, Sonnet)

**Decision — available slot points DERIVED from level, not stored (deviates from session 43's
`routine.slotPoints` schema note).** Session 43's design discussion assumed a stored, incrementally
deposited `slotPoints` field. Building it turned up a farming exploit a stored pool allows: level up
(deposit 1 point) → spend it → uncomplete the item that awarded the XP (de-level, refund) → complete
it again (level back UP through the SAME threshold) → a stored pool deposits a SECOND point for a
level the routine already banked one for, since the deposit fires on every level-UP event regardless
of whether that level was visited before. Deriving available points purely from the routine's
CURRENT level (`Heroes.totalSlotPointsEarned(level, config)` = clamp(level-1, 0, 8)) closes this for
free — revisiting a level via de-level/re-level never re-mints a point, because the function only
ever looks at where the routine is NOW, not how it got there. Only the SPENT counts persist
(`routine.boughtHabitSlots`/`boughtTaskSlots`, schemaVersion 8→9) — mirrors this module's existing
"level derived from xp" discipline (sub-session 1) rather than introducing a second, riskier
stateful-pool pattern. A de-level never claws back an already-spent point or evicts a member
(`slotCapacity` = baseline + bought, independent of current level) — matches session 43's "strand
harmlessly" recommendation. `Heroes.slotsForLevel` (sub-session 1's symmetric-model placeholder,
never wired to anything) is retired outright rather than kept alongside the new functions —
superseded, not deprecated-in-place, since nothing in the codebase called it.

**Finding — native `confirm()`/`alert()` dialogs block Claude-in-Chrome automation.** Triggering the
real "spend a point?" `confirm()` via a UI click froze the tab: CDP mouse/screenshot calls timed out
("renderer may be frozen or unresponsive") until the tab was navigated away, which discards whatever
JS was paused mid-execution at the dialog (confirmed via localStorage: no partial mutation, clean
state). Live-verify worked around this by stubbing `window.confirm`/`window.alert` via
`javascript_tool` BEFORE driving the exposed `window.saveNewHabit`/`window.saveNewTask` handlers
directly (not synthetic unit calls — the real page-global functions, real DOM reads, real
`Routines`/`Heroes` calls) — this is a legitimate verification technique for THIS session's own
code, distinct from and not a substitute for a manual click-through pass. Flagging for future
Cowork sessions that need to live-verify any future `confirm()`/`alert()`-gated flow: expect the
same freeze, and either avoid triggering the real dialog (stub first) or budget for a navigate-away
recovery. Also confirmed (same technique) that `Persistence.requestSave()` is debounced, not
synchronous — a bare `localStorage.getItem` immediately after a mutating call can read stale data;
`Persistence.flush()` first is required for a same-turn readback (distinct from the existing
session-40/42 "stub flush/requestSave before a DIRECT localStorage EDIT" precedent, which is the
opposite direction — this is about reading the app's OWN writes promptly, not injecting an edit).

**Also decided (mechanical, not a design fork):** the Manage-modal hero stats block
(`RoutineViews.buildHeroStatsHtml`) and the compact routine card's new level+star line both reuse
`HeroesView.buildChipViewModel` (the base chip's existing view model) rather than recomputing
level/XP/star/health math a third time — one source of truth for "what does this routine's hero
state look like." The Manage modal's status row gained KO-awareness (icon/label/disabled-button
parity with `managementWindows.js`'s existing compact-card treatment) since sub-session 2 left it
un-explained there — the toggle button already enforced the KO gate server-side, this only makes the
UI agree with what a click would do, no new mechanic.

Tests: 35 suites, 717/717 (+34: `test/routine-views-slots.test.js` new — 15 cases covering
`ensureRoutineSlotAvailable`'s accept/decline/zero-point branches and the two new HTML builders;
`test/heroes.test.js`'s retired `slotsForLevel` block replaced with banked-points coverage;
`test/persistence-migration.test.js` v8→v9 cases; `test/routines.test.js` +1 seeding case).
`node --check` clean on every touched file. Live-verified end-to-end in Chrome per the finding above
— see HEROES_PLAN.md sub-session 4 for the full live-verify writeup.

---

## 2026-07-19 — Session 43 (cont'd): Sub-session 4 forks RESOLVED — banked slot points, no grandfathering (design discussion, no code)

**Decision 1 — grandfathering is moot: fresh run.** Jeremy reset the game, so no pre-enforcement
routines exist to grandfather. Slot enforcement ships clean in sub-session 4 with zero legacy
logic. Why available: single-player prototype — the entire "installed base" is one dev save.
Alternatives rejected: grandfather-existing (now pointless), forced compliance (was never
seriously considered — destructive).

**Decision 2 — slot model = banked slot points (Jeremy's call).** Level 1 = 1 habit + 1 task
slot; each level-up deposits 1 slot point (`routine.slotPoints`); the player spends a point on a
habit-or-task slot AT THE MOMENT they try to add past their limit ("spend a point to unlock this
slot?"), not at level-up time. Unspent points bank. Rationale: keeps leveling a draw (Jeremy's
stated goal), puts the choice where it's informed (when you actually need the slot) instead of
interrupting the level-up moment with a decision made blind. Alternatives rejected: symmetric
auto +1/+1 (already built in sub-session 1's `slotsForLevel` — no engagement pull; will be
superseded/re-derived in sub-session 4), pick-at-level-up modal (uninformed forced choice, worse
UX for the same budget).

**Decision 3 — cap: natural 9-per-type only, no artificial cap.** 8 earnable points (levels 2-9)
→ max 9 of one type, 10 total slots. The 5/5 artificial cap was considered and dropped. Noted for
balance review: banked points HALVE the total budget vs symmetric (10 vs 18 total at max level) —
matches the "pick one per level" intent, but re-check with play data.

**Cost acknowledged:** sub-session 4 now needs schemaVersion 8→9 (`slotPoints` + spent-slot
fields), breaking HEROES_PLAN's "single schema bump" note — accepted; the fresh run makes the
migration seed-only. Sub-tasks on routine tasks (confirmed working, no routineId guard anywhere
in the sub-task path) remain the outlier valve for "needs more than 9 tasks" routines.

HEROES_PLAN.md sub-session 4 rewritten accordingly. No code this session-segment.

---

## 2026-07-19 — Session 43: HEROES_PLAN sub-session 3 BUILT — hero rendering at the base (Cowork session, Sonnet)

**Built:** `js/ui/heroes.js` (`HeroesView`) + `css/heroes.css`. One avatar chip per routine renders
into a new `#heroBaseZone` container positioned over `#base`'s leftmost 120px. Pure view-model math
(`buildChipViewModel`, `dominantCategoryOrInitial`, `deriveState`, `xpProgress`, `starsHtml`,
`healthColorVar`, `trackStarCrossing`) is separated from DOM-building (`buildChipElement`,
`buildOverflowChip`, `renderHeroesAtBase`) — same split discipline as `js/heroes.js`.

**Category identity (new, not previously specified):** a routine's chip emoji is the DOMINANT
category among its HABIT members (routine tasks excluded — same habit-only scope
`Heroes.completionRate` already established, for the same reason: task misses aren't recorded
anywhere honest). No emoji-per-category mapping existed in the codebase before this session (only
hex colors, in script.js's `categoryStyles` / `js/config.js`'s `CATEGORY_POSITION_OFFSETS`) — added
`CONFIG.CATEGORY_EMOJI` (8 entries, one per docs/ART_STYLE.md life domain) as a new display-only
config constant (not gameplay balance, so no balance-tuning protocol invoked — same precedent as
`ENEMY_WIDTH`/layout constants). A routine with no habit members yet falls back to its name's first
letter, matching the plan's "category emoji/initial" phrasing literally.

**Live-update wiring — decided in-session:** the plan's live-verify checklist requires chips to
update on complete/damage/freeze/KO/deactivate. Rather than threading a new UI callback through
items.js/routines.js/damage.js/loop.js (which would break their DOM-free purity, unlike the
existing `onRoutineFrozen`/`onRoutineKo` notice callbacks that already live in script.js's
`itemsDeps()`), `renderHeroesAtBase()` is called once every game-loop tick
(`CONFIG.GAME_TICK_MS` = 50ms, `updateGame()`'s wrapper) in addition to once immediately after
init/restore/level-up (`updateRoutineDisplay()`'s wrapper, for instant first paint with no
50ms-tick lag). A full-rebuild render of a handful of small chips every 50ms is negligible next to
`updateActiveItems`' per-item DOM work already running on the same tick — simpler and lower-risk
than scattering new render hooks through four already-complex pure/deps-injected modules.

**Star-threshold-crossed notice (PROJECT_SPEC ~84):** tracked via `heroStarMemory`, a plain object
in script.js keyed by routine id, deliberately NOT persisted (sub-session 3 lands no schema
change, per HEROES_PLAN's "migration-free by design"). First observation of a routine seeds the
memory without notifying; a later render seeing a HIGHER star count than the last one recorded
fires `FrozenNotice.showHeroStarUpNotice` (added to the existing `FrozenNotice` module — it's
already the de facto "one-time routine notice" module, having grown past its original frozen-only
name to cover KO too). Reset on new game/reset (`initGame`'s `heroStarMemory = {}`) so a fresh run
starts clean.

**Testing:** only the pure helpers are unit-tested (`test/heroes-view.test.js`, 29 cases) — DOM
functions (`buildChipElement`/`renderHeroesAtBase`) are live-playtest-verified only, per
ARCHITECTURE.md's established convention (`Spawning.addItemToGame` precedent: this suite's
`testEnvironment` is `'node'`, no jsdom dependency exists in the repo). 34 suites, 683/683 (+29).
`node --check` clean on all touched files.

**Live-verified in Chrome (real dev save, Session40 Test Routine):** chip renders correctly at the
base on page load — confirmed the chip was actually there via `getBoundingClientRect`/DOM query
even before I could see it clearly in a screenshot (small chip against the church art at normal
zoom; a `zoom` screenshot of the base-zone region made it clearly visible: category-mix avatar,
"Lv1" badge, empty star row, health bar colored by tier). Completing a routine-owned habit
(real click, not synthetic) awarded XP=5 into the routine, and — since this was the routine's
first-ever recorded occurrence this session — pushed its completion rate to 100%, crossing the top
star tier and firing `showHeroStarUpNotice` for real ("★★★★★ Session40 Test Routine leveled up its
rating") end-to-end through the real completion→render→crossing-detection pipeline, not a seeded
call. Chip updated to 5 stars + the health bar's tier color matched the routine's actual health
(50/100 → "low" orange, per the same tiers as the base sprite). Deactivating the routine
immediately greyed the chip (`.hero-chip--inactive`, no reload needed — confirms the 50ms-tick
live-update wiring); reactivating restored it. Zero real app console errors (only the recurring
documented Chrome-extension messaging noise). `resize_window` could not actually shrink this
sandbox's remote browser viewport (window stayed 1926×1297 regardless of the requested size — a
Chrome-in-Cowork environment limitation, not a code issue), so the mobile breakpoint was verified
by reading the loaded stylesheet directly instead: confirmed the `@media (max-width: 768px)` rule
shrinking `.hero-chip`/`.hero-chip-avatar`/`.hero-chip-overflow` is present and correctly scoped.
Jeremy: worth a manual phone/DevTools-device-toolbar check next time you're at the game, since this
session couldn't get a real narrow viewport.

**Sandbox gotcha found this session:** `mcp__workspace__bash`'s mounted folders (`mnt/outputs`,
`mnt/Deadline`) are on a FUSE mount that allows file WRITES but not DELETES/RENAMES for this
sandbox user — `npm install`'s temp-directory rename step fails there with `ENOTEMPTY`/`EPERM`
(same underlying class of restriction as the git-index-lock issue already documented in
CLAUDE.md's Cowork section, just surfacing through npm instead of git). Workaround: run `npm
install`/Jest from `$HOME` (`/sessions/<session-id>`, OUTSIDE the `mnt/` mounts) instead of
`mnt/outputs`, copying `js/`/`test/`/`package.json`/`jest.config.js` there first. Worth folding
into CLAUDE.md's Cowork npm/Jest guidance if it recurs.

Docs updated: docs/ROUTINES.md ("Hero Rendering" section), docs/UI_UX.md (Base Zone heroes line),
docs/HEROES_PLAN.md (sub-session 3 marked built), docs/ROADMAP.md.

---

## 2026-07-19 — Session 42 (cont'd): HEROES_PLAN sub-session 2 BUILT — routine health damage + KO/revive (Cowork session, Sonnet)

**Built:** the base-damage tick path (live loop in `js/loop.js`, both catch-up paths sharing
`js/damage.js`'s `applyOfflineDamage`) now also damages the breaching item's owning routine, via a
new `Items.damageRoutineForItem(item, amount, deps)` built on `js/heroes.js`'s existing pure
`applyRoutineDamage`/`shouldKo` (already landed sub-session 1, unused until now). Injected into
damage.js/loop.js as an OPTIONAL `damageRoutineForItem` collaborator (the `isNonThreatening`
precedent — those two modules load before items.js and can't reference it as a bare global);
loop.js itself loads after items.js so it could have referenced `Items` directly, but was kept
consistent with damage.js's injection shape to minimize script.js wiring surface.

**Decided in-session (per HEROES_PLAN's explicit ask):** offline/live-gap catch-up damage CAN KO a
routine. Rationale: the per-item LIFETIME damage cap (`OFFLINE_DAMAGE_CAP_PER_ITEM`, 12) already
bounds how much any single item's neglect can contribute regardless of how long the gap was, so
there's no unbounded-punishment risk from being away a long time — same reasoning that already
justifies letting the same paths damage the base.

**KO orchestration — decided in-session:** reuses `Routines.clearActiveInstancesForRoutine`
directly (the actual recall mechanic) rather than routing an automatic KO through
`Routines.toggleRoutineActive` — the toggle wrapper's slot-limit alert and spawn-generation
concerns don't apply to an automatic event, and the recall function IS the "existing machinery"
the plan asked to reuse. `routine.koState` doubles as the idempotency guard (an already-KO'd
routine can't be damaged or notified again).

**Revive gating:** `Routines.toggleRoutineActive` gates manual reactivation of a KO'd routine on
`DayRollover.hasDayRolledOver(koAt, now)` (the same local-midnight check the day-advance mechanism
already uses) — blocks with an alert same-day, clears `koState` + revives at
`CONFIG.HERO_REVIVE_HEALTH` (50, half not full) once the gate passes. `js/ui/managementWindows.js`
mirrors the gate client-side (💤 icon, disabled "Revive" button until revivable) as a UX nicety —
the backend gate is authoritative and was verified independently (bypassing the disabled button via
console still hits the same alert).

**Tests:** 33 suites, 654/654 (+15: `test/items-routine-damage.test.js` new — damage routing, KO
exactly at 0, no double-KO, standalone no-op, optional-collaborator no-op; `test/routines.test.js`
+4 — same-day block, next-day revive + health reset, never-KO'd unaffected, healthy-routine
deactivation unaffected; `test/loop.test.js` +2, `test/damage.test.js` +2 — both catch-up paths'
shared `applyOfflineDamage` call site, optional-collaborator omission). `node --check` clean on
every touched file.

**Live-verified in Chrome, full cycle, against Jeremy's real dev save:** seeded a routine at health 5
with a real overdue habit instance (regular save-mutation + reload hit a known race — the page's own
`beforeunload`/autosave flush clobbers a raw `localStorage` edit before the reload's restore reads it;
worked around with the session-40-documented neutering trick, temporarily stubbing
`Persistence.flush`/`requestSave`). The REAL offline catch-up path (not a synthetic direct call) ran
the capped damage, floored health at 0, set `koState`, deactivated the routine, recalled its instance,
and fired the exact KO notice copy — all through actual gameplay code, confirmed via the save. Routines
popup showed the 💤 card with a disabled "Revive" button and "revives tomorrow"; clicking it did
nothing (state unchanged). Bypassing the disabled attribute via console still hit the backend gate's
alert verbatim. Backdating `koState.koAt` to yesterday flipped the button to enabled/"ready to
revive"; clicking it reactivated the routine, cleared `koState`, set health to 50, and respawned
today's instances. Zero real app console errors throughout (only the documented extension-messaging
noise). Test artifacts cleaned from the dev save afterward. See `docs/ROUTINES.md`'s new "Hero
Health, KO, and Revive" section and `docs/HEROES_PLAN.md`/`docs/ROADMAP.md` (checked off).

## 2026-07-19 — Session 42: Orphaned-habit spawn bug FIXED (Cowork session, Sonnet)

**Decision:** orphaned habits (`routineId` pointing at a deleted routine) migrate to standalone
(`routineId: null`) rather than staying inert — Jeremy's call. Rationale: this exactly mirrors the
existing "removed from a routine → standalone" precedent (`removeHabitFromRoutine`, session 18/
2026-07-18 — see the entry above). Treating orphans as inert instead would leave the habit
permanently dormant with no UI path to un-orphan it (nothing lets Jeremy reassign or clear
`routineId` directly), i.e. dead data sitting in the save forever. Alternative (leave inert)
rejected for that reason.

**Root cause:** `selectHabitDefsToSpawn`'s gating already treated a dangling `routineId` as
standalone at SPAWN time (by design, per its own header comment) — but nothing ever corrected the
underlying DATA, and `deleteRoutine` never released its member habits at all (unlike
`removeHabitFromRoutine`, which already nulls `routineId` on single-habit removal). So a deleted
routine left its former habits pointing at a dead id indefinitely; runtime behavior looked right
(habit spawned) but the data was still orphaned.

**Fix:** new pure `Routines.releaseOrphanedHabits(definedHabits, definedRoutines)` nulls
`routineId` for any habit whose routine no longer exists. Two call sites: (1) `deleteRoutine` now
calls it for the routine just removed (`deps.definedHabits` is OPTIONAL, same "collaborator
omitted → no-op" precedent as elsewhere, so existing callers/tests without it still work); (2)
`state.js`'s `restoreGameState` runs it as a sweep on every load, healing Jeremy's existing
pre-fix orphan ("Mindful Scrolling Check-in") and any other pre-existing/edge-case orphan. No
schema bump — data shape unchanged, just a stale value corrected.

**Tests:** 32 suites, 639/639 (+4: `deleteRoutine` releases habits / backward-compat no-op /
`releaseOrphanedHabits` releases+no-op). `node --check` clean on script.js, routines.js, state.js.
Not yet live-verified in Chrome (next step). See `docs/ROUTINES.md`'s new "Deletion & Orphaned
Habits" section and `docs/ROADMAP.md`'s Known bugs (checked off).

## 2026-07-19 — Session 41: Spawn "bug" resolved (not a bug) + [P1-UI-006] SEQUENCED (HEROES_PLAN.md) + sub-session 1 BUILT (Cowork session; planning on premium model, execution offered to Sonnet)

**Session-40 spawn mystery RESOLVED — not a regression, closed in ~15 minutes:** the dev save had
`sickDayDate: "2026-07-19"` (set by session 39's OWN live-test of the Sick Day token) plus
`skipDayDate` = same day on the one standalone habit — the global/per-habit same-day spawn gates were
doing exactly what session 39 built them to do for the rest of that calendar day. Cleared both dates
(documented neutering trick) → all 3 habits spawned immediately, zero app console errors. Two side
findings: (1) `window.activeItems`/`window.definedHabits` are STALE MIRRORS — the live state is
closure-scoped and unreachable from devtools/extension probes, which is exactly what made session
40's `activeItems: []` probe (and this session's first probe) so alarming; the reliable dev checks
are the DOM (`document.querySelectorAll('.enemy').length`) and the SAVE, not window globals. (2) The
orphaned habit (routineId → deleted routine) DID spawn — the "orphans are inert" intent from the
isActive-gating session doesn't hold after the standalone-habit fix rescoped the gate; logged as its
own Known-bugs entry (decide: inert, or migrate orphans to routineId null).

**[P1-UI-006] sequenced into docs/HEROES_PLAN.md (5 sub-sessions, ONE schema bump 7→8), three forks
resolved (Jeremy):** (1) hero art = CSS/emoji placeholder chips behind a rendering seam — NO hero
sprite assets exist anywhere (Assets/ has only zombies + base states); AI-generating sprites and
recoloring zombies rejected (art-direction risk / hero-enemy confusion). (2) Routine health 0 = KO:
auto-deactivate via the EXISTING toggleRoutineActive machinery (vacation semantics, recall included),
disabled reactivation until the next calendar day, revive at `HERO_REVIVE_HEALTH` (50). Visual-only
floor rejected (no teeth); freeze-style suspension rejected (frozen slots mean "your BEHAVIOR froze
it," KO means "the zombies got it" — different channels, session-26 principle). (3) Mechanics before
visuals — sub-session 1 is the invisible layer so sub-session 3 renders real data.

**Sub-session 1 BUILT same session (Jeremy's call to continue past the planning session precedent).
Implementation decisions:**
- **Routine `level` is DERIVED from xp (`Heroes.levelForXp`), deliberately diverging from the
  player's monotonic level.** Why: with a derived level, complete→uncomplete round-trips EXACTLY by
  construction. The player-precedent (never de-level) was rejected for routines because the refund
  asymmetry it creates is the same bug class as the old streak-bonus refund bug.
- **Refunds mirror awards via an `item.routineXpAwarded` STAMP, not by re-checking award
  conditions.** completeItem stamps the exact amount on the item (persists wholesale like every item
  field); uncompleteItem refunds off the stamp unconditionally and deletes it. A routine that
  freezes/deactivates between complete and uncomplete can neither block the refund (stamp present)
  nor suffer a wrongful deduction (no stamp = nothing was awarded). Unit-tested both directions.
- **XP awarded at ALL completion sites, not just the plan's completeItem/uncompleteItem:**
  `resolvePendingCheckIn`-'avoided' and `settleStaleRecurringInstance` also call
  `Habits.applyHabitCompletion` and award player XP, so skipping them would undercount routines
  inconsistently. Habit-def-only helper there (no stamp — those paths can never be undone).
  **Ordering: award AFTER `maybeRecoverRoutine`** — the avoid that completes recovery path 2 and
  unfreezes the routine earns XP for that very completion (friendlier reading of "no XP while
  frozen"; the alternative — award-before-recovery-check — silently zeroes the unfreezing day).
- **"No XP while frozen" gates on `FrozenSlots.isRoutineSuspended`** (covers frozen AND inactive) —
  the session-36 "true no-op, noted for whoever builds routine XP" note is now real code.
- **Star-rating `completionRate` samples HABIT members only (v1).** The plan's suggestion to count
  routine-task completions via completedItems was DROPPED: completions are recorded but MISSES are
  not (rollover drops routine tasks without a trace), so any task denominator would be reconstructed
  guesswork that drifts across reloads. Habits' occurrenceHistory is the one honest complete record.
  Revisit when run history lands. A rate with zero samples is null → 0 stars ("unrated", not "0%").
- **Balance numbers (config, new):** `ROUTINE_XP_PER_TASK/HABIT` = 10/5 (mirrors player values);
  `ROUTINE_LEVEL_XP_THRESHOLDS` = player curve halved ([0,50,125,250,400,600,850,1150,1500] — a
  routine only sees its own members' completions); slots = 1 habit + 1 task at L1, +1 each per level
  (spec gives no numbers; cheapest symmetric reading); `ROUTINE_MAX_HEALTH` 100,
  `HERO_REVIVE_HEALTH` 50; star tiers 60/70/80/90/95% → 1-5★ (fixed spec values, PROJECT_SPEC
  ~78-83). All flagged for re-tune with play data.
- **Migration v7→v8** seeds xp 0 / level 1 / health 100 (literal, stable-transform precedent) /
  `createdAt` = `runStartedAtMs` (best available birthday for a pre-v8 routine, falls back to now) /
  `koState` null; idempotent (existing values never overwritten).

**Tests:** 32 suites, 635/635 (+50). New `test/heroes.test.js` (pure core) +
`test/items-routine-xp.test.js` (wiring incl. the froze-between-complete-and-uncomplete stamp case
and the recovery-then-award ordering case); v7→v8 cases in persistence-migration.test.js; hero-field
seeding case in routines.test.js; `global.Heroes` bound in the 7 items-*.test.js files (bare-global
convention). Sandbox note for future sessions: jest 30's resolver needs its NATIVE optional dep —
`npm install --omit=optional` silently breaks ALL module resolution ("setup.js not found"); install
with optionals + `PUPPETEER_SKIP_DOWNLOAD=1` instead, and remember backgrounded processes die when a
Cowork bash call returns (run npm foreground; it resumes from cache across timeout slices).

**Live-verified in Chrome:** v7→v8 migration on the real dev save; award/refund round-trip exact
(xp 5→0, stamp created then deleted, player XP/points 5/605 → 0/600, occurrence popped). Zero app
console errors.

## 2026-07-19 — Session 40: FIXED — FAB→Routines popup staleness after habit edit (Cowork session, Sonnet execute — small pre-scoped bug fix, Jeremy's pick from session 39's punch list)

**Fix:** `editHabitInRoutine` (script.js wrapper) now mirrors `deleteRoutine`'s existing pattern —
after a real edit mutates state, it checks whether `managementWindows.routines` (the FAB→Routines
popup) is open and, if so, calls `populateRoutinesWindow()` via a 100ms `setTimeout` to refresh it.
Previously the wrapper only called `renderDefinedRoutines()` (the older inline list), which never
touched this separate windowing system — so a routine unfrozen via recovery path 1 (session 38) mid-
edit stayed visually stale (greyed/🥶) until the popup was closed and reopened. No design question
here — `deleteRoutine` already had the exact right pattern sitting a few lines above; this just copies
it to the other stale call site flagged in session 38's HANDOFF entry.

**Live-verified in Chrome:** created a fresh routine + negative habit, seeded 2 backdated indulged
occurrence days (localStorage edit + neutered `Persistence.flush`/`requestSave`/`localStorage.setItem`
+ reload — the documented trick, this time needing ALL THREE neutered, not just `setItem`, since a
plain reload without neutering `Persistence.flush` let the stale in-memory state clobber the direct
edit on unload; noted below), then directly set `routine.frozenState` (same trick) to reach the frozen
state without needing the full spawn pipeline (a pre-existing, unrelated local dev-environment quirk —
see Watch out below — meant real habit instances weren't spawning in this session's browser, so the
freeze was seeded directly rather than earned via 3 real indulge clicks). Opened FAB→Routines (showed
🥶 "Frozen — see Manage for recovery options"), drilled into Manage, edited the habit's name (a real
change), which correctly fired the "routine is unfrozen" notice — and the Routines popup underneath,
left open the whole time, immediately showed the routine back to normal (green dot, no frozen
subtitle) without being closed/reopened. Confirmed `frozenState: null` in the save, not just visually.
Zero app console errors (only the recurring unrelated Chrome-extension messaging noise).

**Tests:** 30 suites, 585/585 (unchanged — UI wiring only, no new pure-core logic to cover).

**Watch out (new gotcha found this session):** the documented backdating trick ("neuter
`localStorage.setItem`, then reload") is NOT sufficient on its own if you're editing localStorage
directly and NOT going through the app's own save call — you must also neuter `Persistence.flush` and
`Persistence.requestSave` (both are bare lexical globals in the page, e.g. `Persistence.flush =
function(){}`, not `window.Persistence`) before reloading. Otherwise the unload handler's
`Persistence.flush()` still runs, reads the OLD in-memory state (which never saw your direct edit), and
its call to `localStorage.setItem` — even the real, un-neutered one — overwrites your edit. Confirmed
by reproducing the data loss twice: once neutering `setItem` alone lost an entire routine+habit created
minutes earlier, and once more it silently reset a freshly-set `frozenState` back to `null`. Only
neutering all three together survived a reload reliably.

**Found, NOT fixed (pre-existing, unrelated, out of scope):** in this session's Cowork Chrome
playtest environment, no habit or task — including a positive standalone habit already in the dev
save before this session started — ever spawned a live instance after a fresh page load (`0 tasks`
always, `activeItems: []` in the save even right after `generateDailyHabitInstances`/
`generateDailyRoutineTaskInstances` run in `restoreGameState`). No console errors accompany it. Not
investigated further — this session's fix and verification didn't require live spawning (verified via
direct `frozenState` seeding instead), but this is worth a look before the next session that depends on
real spawn behavior. Possibly specific to this dev save's accumulated state (it already had one
orphaned habit referencing a deleted routine before this session touched anything) rather than a code
regression — not confirmed either way.

Dev save has a `Session40 Test Routine` + `Test Vice (renamed)` test habit (unfrozen, from this
session's live verification) plus pre-existing session-39 leftovers. Recommend Reset before real play.

---

## 2026-07-19 — Session 39: Sub-session 5 BUILT — Sick Day + Skip Day tokens, schemaVersion 6→7 (Cowork session, Sonnet execute — plan already approved in session 35, one mechanic gap resolved live with Jeremy)

**Ticket now CLOSED:** [P1-DATA-005]-adjacent "Frozen routine slots + recovery" ticket, all 5
sub-sessions built across sessions 35–39.

**Decision (Jeremy, asked live this session):** FROZEN_SLOTS_PLAN.md's sub-session 5 goal said "no
spawn, no occurrence" but didn't pin down what happens when a token is applied to a habit that
ALREADY spawned today (e.g. buying Sick Day mid-afternoon, after the morning's habits are already
lurking/on the board). Two options were presented — "clear immediately" (remove the already-spawned
instance(s) right away, no action needed) vs. "leave it, excuse the miss" (mirror Cheat Day exactly:
leave the instance on the board, only excuse an eventual miss at rollover). **Jeremy chose "clear
immediately."** This wasn't invented — the plan's own "Cheat-Day-style targeting" phrase for Skip
Day pointed at SOME shared shape with Cheat Day, but Cheat Day's mechanic (excuse a still-live
lurker's eventual indulge) doesn't by itself explain "no spawn." Asking rather than guessing here
avoided committing code to the wrong shape.

**Why "clear immediately" ended up SIMPLER than Cheat Day, not just different:** since the instance
is gone the moment the token lands, there's no later indulge/complete/rollover moment left to excuse
— unlike Cheat Day's `isCheatDayExcused`, checked in 3 places (indulgeHabit, resolvePendingCheckIn,
a dedicated rollover-fork branch), Sick/Skip Day need ZERO such predicates. `Items.useSkipDayOnItem`/
`useSickDayGlobally` just set the date marker and call the existing `removeItem` — nothing in
indulgeHabit, completeItem, resolvePendingCheckIn, or state.js's rollover fork needed to change at
all. The date marker's only remaining job is a same-day spawn-gate
(`Habits.selectHabitDefsToSpawn`'s new optional `sickDayDate` param + a `habitDef.skipDayDate`
check) — guarding the same "same-day reload respawns a cleared item" hazard class as the documented
indulge same-day-respawn bug (ROADMAP.md Known bugs). This self-expires the next calendar day by
construction (the marker is a date string compared against THAT day's occurrence date) — no
explicit clearing code needed anywhere, unlike Cheat Day's clear-on-consumption.

**Structure:** `js/persistence.js` SCHEMA_VERSION 6→7 (top-level `sickDayDate`, `habitDef.
skipDayDate`, both seed null). `CONFIG.SHOP_ITEMS` gained `sick_day`/`skip_day` (200 pts each,
unchanged spec value — no balance-tuning needed). `js/items.js`'s two new functions (above).
`js/habits.js`'s `selectHabitDefsToSpawn` gained the optional 5th param — every pre-existing 4-arg
test call keeps passing unmodified (collaborator-omitted no-op precedent, same as
`deps.onRoutineFrozen` etc.). `js/ui/popups.js` gained `buildSkipDaySectionHtml` (shown for ANY
habit instance, not gated to negative — Skip Day reaches positive habits too, unlike Cheat Day) and
a `useSkipDayBtn` handler that just calls `Modal.closeModal()` (no setTimeout(0) rebuild needed,
since — unlike Cheat Day's rebuild-to-show-"active" — there's nothing left to show once the item's
gone). `js/ui/shopView.js`'s `canUse`/`useRow` extended beyond repair kits' `healAmount` check to
also cover `category === 'sickDay'` (a real card Use button, not a targeting hint like Cheat/Skip
Day's).

**Piggybacked fix (not a design change, logged for transparency):** while touching
`js/routines.js`'s `createNewHabitInRoutine` object literal to add `skipDayDate`, found and
backfilled a pre-existing gap — `cheatDayDate` (session 34) was never added to that same literal, so
a routine-owned habit created fresh in-session had no such field until its next save/reload ran the
v4→v5 migration. Latent, not a crash (`isCheatDayExcused`'s `!!habitDef.cheatDayDate` check degrades
safely to false meanwhile) — fixed inline rather than left to rediscover.

**Alternative rejected:** keeping Sick/Skip Day mechanically identical to Cheat Day (leave the
instance, excuse only the eventual miss) — this was the SECOND option Jeremy was offered and did not
choose. Noted here so a future session doesn't "simplify toward Cheat Day" without realizing that's
reversing a deliberate choice.

30 suites, 585/585 (+25: persistence-migration v6→v7, `routine-active-gating.test.js` spawn-gate
cases, new `test/items-skipday-sickday.test.js`, `shop.test.js` catalog cases — including a fix to a
hardcoded category allowlist there that would've failed on the two new categories). `node --check`
clean on all touched files.

**Live-verified in Chrome:** granted points via the documented localStorage-edit +
neutered-`setItem` + reload trick, bought Sick Day + Skip Day (300 pts on the 2nd unit, confirming
exponential pricing), tapped Skip Day from a POSITIVE habit's popup (not just negative — confirming
the not-negative-only reach) — it vanished from the board immediately, save confirmed the marker set
and streak/occurrenceHistory untouched. Reload same-day confirmed no respawn. Sick Day's shop-card
Use then swept the one remaining habit instance the same way; reload again confirmed the global gate
too. Zero app console errors (only the recurring unrelated Chrome-extension noise).

---

## 2026-07-19 — Session 38: Sub-session 4 BUILT — recovery path 1, edit-to-unfreeze + modificationHistory (Cowork session, Sonnet execute — plan already approved in session 35)

**Decision:** instrumented the ONE existing save path (`Routines.editHabitInRoutine`, called by both
the agenda-row "edit" shortcut and the Manage Routine editor via the shared `saveEditedHabit` chain)
rather than building a separate "standalone editor" path. FROZEN_SLOTS_PLAN.md's sub-session 4 goal
said "standalone editor + routine editor paths," which read as two save functions to instrument —
tracing the actual call graph (`agendaList.js`'s `showEditHabitInstanceModal` → `showEditHabitForm` →
`saveEditedHabit` → `editHabitInRoutine`) showed there's only one, since habits have no per-instance
editor today (a pre-existing comment in `agendaList.js` already noted this). No design fork needed —
just confirms the plan's two "paths" are two UI entry points into the same function, not two
functions.

**Why a real edit unfreezes immediately (no 3-day wait, unlike recovery path 2):** matches
`FrozenNotice`'s sub-session-3 copy, which already told players "Edit [habit]'s details — any real
change counts" as an alternative to the 3-day avoidance streak. Diffing against current values (not
just checking the form was submitted) exists specifically so re-saving unchanged data can't be used
to cheese an instant unfreeze — `changedFields` must be non-empty.

**Why `definedRoutines` and the notify callback are optional params, not required:** matches the
`items.js` `findOwningRoutine`/`onRoutineFrozen` precedent — every pre-existing 3-arg call to
`editHabitInRoutine` (routines.test.js's older cases) keeps working unchanged, just without the
unfreeze check, rather than forcing every test/call site to be touched for a feature only the
UI-wired call site needs.

**Alternative rejected:** recording old/new field VALUES in `modificationHistory` (not just field
NAMES) — FROZEN_SLOTS_PLAN.md's fork 3 (session 35, Fable) already deferred this ("old/new values and
notes are deferred"); this session didn't revisit that call, just implemented the minimal shape it
specified.

29 suites, 560/560 (+8). `node --check` clean on `js/routines.js`, `js/ui/frozenNotice.js`,
`script.js`.

**Live-verified in Chrome:** seeded a frozen routine via the documented localStorage-edit +
neutered-`setItem` + reload trick (3 backdated indulged days) instead of re-earning it through 3
real "I indulged" clicks. No-op Save left `frozenState`/`modificationHistory` untouched, no notice.
A real rename appended `{ timestamp, changedFields: ["name"] }`, cleared `frozenState`, and fired
the new unfreeze notice — no setTimeout(0) race despite `Modal.closeModal()` running first in
`saveEditedHabit`. A freshly opened Manage Routine modal showed "Status: Active," no frozen banner.
Zero app console errors.

**Found, not fixed (pre-existing, out of scope):** the FAB→Routines popup
(`ManagementWindows.populateRoutinesWindow`, a separate windowing system from `Modal`'s
`.modal-overlay`s) doesn't live-refresh if left open under a stacked Manage Routine edit —
`editHabitInRoutine`'s `renderDefinedRoutines()` call only updates the older inline list, not this
popup's DOM. Closing and reopening it always shows correct data. Would affect any habit edit made
this way, predates this session. Logged in ROADMAP.md's Known bugs for future scheduling.

---

## 2026-07-19 — Session 37: Sub-session 3 BUILT — frozen routine UI (Cowork session, Sonnet execute — plan already approved in session 35)

**Problem:** sub-sessions 1-2 made freezing real (state + spawn suspension) but entirely invisible —
nothing in the UI told the player a routine was frozen, why, or what to do about it. This session
builds PROJECT_SPEC.md ~2696's "non-judgmental tooltip or modal, focusing on the path to recovery."

**Design (no new forks — session 35 already settled tone/content; this was execution + one small
structural call):** split across three surfaces rather than one:
1. **Compact card** (Routines list, `managementWindows.js`) — cheap, generic: grey styling + 🥶 icon
   + "see Manage for recovery options." No habit lookup needed at this level.
2. **Detailed banner** (Manage Routine modal, `routineViews.js`) — this is where `deps.definedHabits()`
   is already available, so it's the natural place to name the offending habit and show LIVE
   recovery progress. New pure `buildFrozenBannerHtml(routine, definedHabits)` returns `''` when
   unfrozen; unit-tested directly (new `test/routine-views-frozen-banner.test.js`, 5 cases) since
   it's a pure string builder despite living in a DOM-heavy file.
3. **One-time trigger notice** — the "something just happened" moment needs its own surface,
   separate from the other two (which are both pull, not push — the player has to go open Routines).
   Structural call: rather than adding this to `routineViews.js` (already 1000+ lines, the
   biggest UI file in the codebase), it's a new small dedicated module (`js/ui/frozenNotice.js`),
   matching `checkIn.js`'s precedent for a focused, single-purpose UI surface. Wired via a new
   OPTIONAL `deps.onRoutineFrozen(routine, habitDef)` collaborator in `items.js`'s
   `maybeFreezeRoutine`, fired exactly once on the unfrozen→frozen transition (the pre-existing
   "already frozen" guard prevents any re-fire).

**Found and fixed live (real bug, not a design question) — the setTimeout(0) hazard strikes again:**
this is the third time this exact bug class has appeared in this codebase (session 21's shop
purchase self-closing the window; session 34's Cheat Day popup rebuild). The trigger site is
popups.js's "I indulged" button handler: `deps.indulgeHabit(item.id)` runs synchronously (which now
fires the frozen notice via `onRoutineFrozen`), and the VERY NEXT LINE is `Modal.closeModal()` —
which does `document.querySelectorAll('.modal-overlay').forEach(m => m.remove())`, indiscriminately
removing every open modal overlay, including the notice that was just inserted a microtask earlier
in the same synchronous call stack. The notice was being deleted before the browser ever painted it
— invisible in normal play, only caught by actually screenshotting immediately after the click and
finding nothing there. Fixed with the established pattern: `FrozenNotice.showFrozenRoutineNotice`
now wraps its `insertAdjacentHTML` in `setTimeout(0)`, so it executes as a new task AFTER the click
handler (including its `closeModal()` call) has fully finished. Cross-checked the OTHER site that
can trigger a freeze — `checkIn.js`'s card resolution — and confirmed it removes its OWN overlay by
direct reference (`overlay.remove()`), never a blanket `closeModal()`, so it was never at risk; the
setTimeout(0) fix is harmless there regardless (just means the notice would render a tick later,
imperceptible).

**Structure:** new `js/ui/frozenNotice.js`, new `css/frozenNotice.css`, `js/items.js` (+
`onRoutineFrozen` optional callback in `maybeFreezeRoutine`), `script.js` (+ wiring in `itemsDeps()`),
`js/ui/managementWindows.js` (`populateRoutinesWindow` frozen styling), `js/ui/routineViews.js`
(new `buildFrozenBannerHtml` + banner wired into `showRoutineManagement`), `index.html` (+script/link
tags), new `test/routine-views-frozen-banner.test.js`.

**Tests:** 29 suites, 552/552 (+5). `node --check` clean on all touched files.

**Live-verified in Chrome, the full cycle in one pass:** 3 real "I indulged" clicks (2 backdated)
correctly triggered — the notice modal appeared with the right routine/habit names and both
recovery-path bullets; the Routines card immediately showed 🥶 + greyed styling; the Manage modal's
banner read "Recovery progress: 0/3 days successfully avoided." Backdated 2 avoided days and
reopened Manage — banner correctly read "2/3." One real "Successfully avoided" click for the 3rd day
cleared `frozenState`, and the Routines card returned to its normal active/ungreyed state. Zero app
console errors throughout (only the same recurring, unrelated Chrome-extension "message channel
closed" noise every session has logged).

---

## 2026-07-19 — Session 36: Sub-session 2 BUILT — frozen-slot spawn gating (Cowork session, Sonnet execute — plan already approved in session 35)

**Problem:** sub-session 1 made `routine.frozenState` real and observable, but nothing in the game
actually reacted to it yet — a frozen routine's habits/tasks spawned exactly as if nothing had
happened. This session gives fork 1 ("a freeze suspends the routine") its teeth.

**Design (no new forks — session 35 already settled the "suspend, offending habit exempt"
semantics; this was execution against the plan doc):**
- `js/frozenSlots.js` gained two pure predicates rather than the plan's single sketched
  `isRoutineSuspended`: `isRoutineUsableForHabit(routine, habitDefId)` (active AND (not frozen OR
  frozen BY this exact habit id)) and `isRoutineSuspended(routine)` (active AND not frozen, no
  exception). Two were needed because ONLY a negative habit can be "the offending def" — a routine
  TASK can never hold a freeze, so it has no analogous exception to check.
- `Habits.selectHabitDefsToSpawn`'s owning-routine check replaced a bare `r.isActive` test with
  `FrozenSlots.isRoutineUsableForHabit(r, habitDef.id)` — composes cleanly with the existing
  many-to-many "at least one owning routine must be usable" logic; a habit shared by a frozen
  routine and a separate active/non-frozen routine still spawns via the second owner, same
  precedent the old active/inactive check already set.
- `Routines.selectTaskDefsToSpawn`'s active-routine-task collector replaced its bare
  `!routine.isActive` skip with `FrozenSlots.isRoutineSuspended(routine)`.
- **Non-destructive, confirmed:** freezing only gates FUTURE daily-generator passes; nothing
  already spawned gets recalled (unlike routine deactivation's `clearActiveInstancesForRoutine`).
  No code needed for this — it falls out of not calling any recall function.
- **Routine-XP verification (per sub-session 1's flagged open question):** Grepped the whole repo
  for `routine.xp`/`routineXP`/`addRoutineXP` — none exist. Routine leveling is DATA_SCHEMA.md
  target-schema-only, unbuilt (P1-UI-006). "A frozen routine earns no XP" is therefore a TRUE no-op
  today — there's nothing to suspend. Left as a note for whoever builds routine XP, not code.
- **Backward compatibility:** both predicates treat a missing `frozenState` field as "not frozen"
  (`!undefined` is truthy), so every existing routine fixture across the test suite needed zero
  changes — only `global.FrozenSlots` had to be added to the 4 test files whose fixtures actually
  execute `selectHabitDefsToSpawn`/`selectTaskDefsToSpawn` (`habits.test.js`, `routines.test.js`,
  `routine-active-gating.test.js`, `routine-task-instances.test.js`), since FrozenSlots is now a
  bare-global dependency of both functions the same way Schedule already is.

**Structure:** `js/frozenSlots.js` (+2 predicates), `js/habits.js` (+1 line, owning-routine check),
`js/routines.js` (+1 line, active-routine-task collector), 4 test files (+`global.FrozenSlots`
binding), `test/frozen-slots.test.js` (+2 describe blocks), `test/habits.test.js` (+4 cases),
`test/routines.test.js` (+1 case).

**Tests:** 28 suites, 547/547 (+15). `node --check` clean on all touched files.

**Live-verified in Chrome:** froze the same test routine from session 35 directly via the save
(skipping re-earning it — sub-session 1 already proved the real trigger path), then added a NEW
positive habit to the frozen routine through the actual "+ Add Habit" UI flow: the definition was
created and correctly linked to the routine, but the daily generator that fires immediately after
creation admitted ZERO active instances for it (verified via the save's `activeItems` array and
visually — no new sprite or agenda row appeared), with no console errors. Cleared `frozenState` and
reloaded — the SAME habit spawned normally on the very next boot pass, confirming the gate reacts
live to both directions of the freeze/unfreeze transition, not just at creation time.

**Found and worked around (not a code bug, a testing gotcha):** editing `localStorage['deadline.save']`
directly from the console and then reloading is NOT reliable — the page's flush-on-hide/unload
handler saves the STALE in-memory state over the edit during the reload's teardown, silently
undoing it. `Persistence`/`Habits`/`Items`/etc. are module-scope `const`s in script.js/js/*, not
`window` properties (only `var`/function-style globals and a few explicit `window.foo = foo`
exposures attach), so `Persistence.flush` can't be neutered directly from console either. Reliable
fix: write the edit with the real `localStorage.setItem`, THEN overwrite `localStorage.setItem` with
a no-op BEFORE calling `location.reload()`, so the unload-flush's write becomes inert and the edit
survives into the fresh load. Logged here (and in HANDOFF.md) since this will recur for any future
backdating-style live verification.

---

## 2026-07-19 — Session 35: Frozen routine slots planned (Fable fork) + Sub-session 1 BUILT (Cowork session, Fable plan → Sonnet execute)

**Problem:** the "Frozen routine slots + recovery" roadmap item (Milestone 3, spec'd but never sequenced) was picked as this session's task, chosen over P1-UI-006/P1-DATA-004/run history. The spec (PROJECT_SPEC.md ~56-58, ~424-435, ~669-672; docs/ROUTINES.md) needed four design forks resolved before any code could land — resolved live with Jeremy, batched into one Fable session per the model-strategy protocol, then written up as `docs/FROZEN_SLOTS_PLAN.md` (mirrors NEGATIVE_HABITS_PLAN.md's sub-session structure).

**Fork decisions (Jeremy, session 35):**
1. **What freezes, and what does it DO:** freezing is ROUTINE-scoped only (never a bare task; a standalone negative habit with no routine has no hero to knock out — debt + streak already punish it alone). A freeze SUSPENDS the routine — its OTHER habits/tasks stop spawning and it earns no XP (hero is down) — but the OFFENDING negative habit keeps spawning its lurker, because recovery path 2 ("avoid it for 3 days while it stays active") requires that. Non-destructive: no recall of already-spawned instances (unlike routine deactivation). Rejected: visual-only freeze (no teeth — "frozen" becomes cosmetic) and full deactivation (breaks recovery path 2 outright). This composes with the channel-separation principle set in the [P1-DATA-005] session-26 Fable fork: base HP = deadline failures, points/debt = per-lapse behavior cost, frozen slots = SUSTAINED pattern.
2. **Cheat-Day-excused-day transparency:** an excused day (session 34 — no occurrence recorded at all) is TRANSPARENT to both the freeze-trigger count (3 consecutive indulged) and the avoidance-recovery count (3 consecutive avoided) — it's simply absent from the trailing run, neither breaking nor advancing it. Falls out of the data model for free (both counts read `occurrenceHistory` directly). Rejected: "breaks both runs" (makes Cheat Day a pay-to-dodge-a-freeze mechanic at 200 pts — an exploit) and "counts as avoided" (contradicts the "not a success" semantics session 26 already established).
3. **Change-tracking depth for recovery path 1 (edit-to-unfreeze):** MINIMAL — `habitDef.modificationHistory: [{ timestamp, changedFields }]`, appended on any real edit; unfreezing requires an actual field change (a no-op Save doesn't count). Old/new values, a notes field, and impact-measurement UI (PROJECT_SPEC's fuller vision) are deferred — that's Milestone-4-scale analytics, not needed for the freeze/unfreeze mechanic itself.
4. **Sick/Skip Day token scope** (deferred here from both [P1-UI-008] and [P1-DATA-005] per session 26): Sick Day is GLOBAL — one token excuses ALL habits for a day (you're sick, not lapsing). Skip Day is PER-HABIT — mirrors Cheat Day's targeting (pause one chosen habit for a day). Both transparent to freeze/recovery counts, same reasoning as fork 2. Rejected: both per-habit (Sick and Skip become near-duplicates differing only in name).

**Sub-session 1 (this session, Sonnet execute) — pure core + trigger wiring + 5→6 migration:**
- `js/frozenSlots.js` (new, pure, no CONFIG/DOM): `trailingRun(occurrenceHistory, wantSuccess)` counts a trailing run of matching entries from the array's end (the mechanism that makes fork 2's transparency free — an absent excused-day entry simply isn't there to break or extend a run); `shouldFreeze`/`shouldRecoverByAvoidance` wrap it against `CONFIG.FREEZE_THRESHOLD_DAYS`/`RECOVERY_AVOIDED_DAYS` (both 3, per spec); `avoidanceProgress` (derived, for sub-session 3's UI); `buildFrozenState(habitDefId, now)`.
- `CONFIG.FREEZE_THRESHOLD_DAYS = 3`, `CONFIG.RECOVERY_AVOIDED_DAYS = 3` — balance-tuning protocol applies if these ever move off the spec's 3.
- Schema: `routine.frozenState: { frozenBy, frozenAt } | null` and `habitDef.modificationHistory: []` — schemaVersion 5→6, additive migration seeding both (mirrors the v4→v5 precedent). Seeded on creation too: `createRoutineDefinition` (routines.js) and `createHabitDefinition` (script.js)/`createNewHabitInRoutine` (routines.js).
- Wiring in `js/items.js`: two new internal helpers, `maybeFreezeRoutine` (called after a FAILURE occurrence — `indulgeHabit`'s live debit branch, `resolvePendingCheckIn`'s indulged branch) and `maybeRecoverRoutine` (called after a SUCCESS occurrence — `completeItem`'s habit branch, `settleStaleRecurringInstance`, `resolvePendingCheckIn`'s avoided branch). Both no-op for a standalone habit (routineId null) or a positive habit; recovery only clears a freeze the SAME habit caused (`frozenState.frozenBy` match) — a routine frozen by a different negative habit it owns is untouched. `FrozenSlots` called as a bare stable global inside items.js, same convention as Habits/Economy/CONFIG.
- **Backward-compat choice:** `deps.definedRoutines` is OPTIONAL in items.js (falls back to `[]` if the collaborator is omitted) — same "collaborator omitted → inline equivalent" precedent damage.js set in session 28. This meant zero existing test files needed touching to add the new `definedRoutines` getter to `itemsDeps()`.
- **NOT built this session:** spawn gating (a frozen routine's other definitions still spawn today — that's sub-session 2), the frozen-state UI (sub-session 3), recovery path 1's actual edit-diffing (sub-session 4 — modificationHistory the FIELD exists, but nothing appends to it yet), and Sick/Skip Day tokens (sub-session 5). State is fully observable/testable via the save file and unit tests, just not yet visible or complete in the live game.

**Structure:** `js/frozenSlots.js` (new), `js/config.js` (+2 constants), `js/persistence.js` (SCHEMA_VERSION 6 + migration), `js/routines.js` (+frozenState/modificationHistory seeding), `script.js` (+modificationHistory seeding, +definedRoutines getter in itemsDeps()), `js/items.js` (+maybeFreezeRoutine/maybeRecoverRoutine + 5 call sites), `index.html` (+frozenSlots.js script tag, loaded after shop.js/before habits.js).

**Tests:** 28 suites (+2: `test/frozen-slots.test.js` pure-core, `test/items-freeze.test.js` wiring across all 4 trigger functions), plus new cases folded into `test/persistence-migration.test.js` (v5→v6) and 2 assertions added to `test/routines.test.js` for the new seeded fields. `node --check` clean on all touched files. Exact suite/case totals: see HANDOFF.md.

**Docs updated same session:** `docs/FROZEN_SLOTS_PLAN.md` (new, full sub-session sequence), `docs/ROUTINES.md` (fork decisions + sub-session 1 status), `docs/DATA_SCHEMA.md` (schemaVersion 6 entry + Habit/Routine target shapes), `docs/ARCHITECTURE.md` (frozenSlots.js module entry + routines.js seeding note), `docs/ROADMAP.md`.

---

## 2026-07-19 — Session 34: Sub-session 5 BUILT — Cheat Day token, [P1-DATA-005] CLOSED (Cowork session, Opus plan → Sonnet execute)

**Problem:** the last piece of the negative-habits ticket — a shop-purchasable "free pass" for one negative habit's indulgence on one day, per the session-26 Fable fork (200 pts, excused not success/miss, streak preserved). Also the ticket's one deferred schema migration (4→5).

**Design (no open forks — session 26 already settled semantics; this was execution + concrete technical mapping):**
- Schema: `habitDef.cheatDayDate` ('YYYY-MM-DD' or null), schemaVersion 4→5, additive migration seeding null on every existing habit def (mirrors the v3→v4 inventory precedent).
- Catalog: `CONFIG.SHOP_ITEMS` gains `cheat_day` (200 pts — spec/ECONOMY.md face value, unchanged; `consumable: true`, category `cheatDay`). `js/shop.js` needed NO changes — `purchase`/`consume` are already generic over any consumable id.
- **Targeting decision:** Cheat Day is Buy-to-hold like a repair kit (shop card: Buy button + held count), but unlike a repair kit its "Use" isn't a shop-card button — it targets a SPECIFIC negative habit, so it's applied from that habit's lurker popup instead (reusing pushback's tap-a-zombie targeting shape, per the plan doc). `js/ui/shopView.js`'s card shows a "Tap a negative habit to use" hint once held > 0 (mirrors pushback's hint); `js/ui/popups.js`'s negative-habit-lurker actions gain a third row — "Use Cheat Day (N held)" when held > 0, or an "active" note when already applied to this lurker's day.
- **The setTimeout(0) hazard, again:** using a token REPLACES the button with an "active" note — rebuilding DOM mid-click-bubble is exactly the session-21 shop hazard. Simplest correct fix: defer via `setTimeout(0)`, then close + reopen the SAME popup (reuses the existing render path rather than a bespoke in-place patch like pushback's).
- **Where the excused check lives:** one predicate, `Items.isCheatDayExcused(habitDef, originalDueDate)`, checked in three places — `indulgeHabit` (live: skips the debit/streak/occurrence entirely), `resolvePendingCheckIn`'s indulged branch (defensive/belt-and-suspenders; in practice never reached because of the next point), and a NEW `Items.settleExcusedCheatDay` in state.js's rollover fork, checked FIRST — ahead of both the check-in-eligible split (sub-session 4) and the older-day auto-avoid default. This directly implements the plan doc's "the check-in card for that day auto-resolves as excused": a cheat-day-covered stale lurker never becomes a pendingCheckIn at all.

**Structure:** `js/persistence.js` (SCHEMA_VERSION 5 + migration), `js/config.js` (+cheat_day catalog entry), `js/items.js` (+isCheatDayExcused, +settleExcusedCheatDay, indulgeHabit/resolvePendingCheckIn branches), `js/ui/shopView.js` (+cheatDay hint), `js/ui/popups.js` (+Use Cheat Day button/note), `css/popups.css` (+.cheat-day-active-note), `js/state.js` (three-way rollover fork), `script.js` (handleUseCheatDay mirroring handlePushback + popupsDeps/stateDeps wiring), `script.js`'s createHabitDefinition (seeds cheatDayDate: null on new habits).

**Tests:** 26 suites, 498/498 (+16: 4 new persistence-migration v4→v5 cases, 4 new shop.test.js Cheat Day catalog/pricing cases, 8 new `test/items-cheatday.test.js` covering isCheatDayExcused/settleExcusedCheatDay/both excused-indulge branches). Also fixed a test made stale by the version bump (`persistence-migration.test.js`'s "bumps schemaVersion to 4" now asserts the v3→v4 STEP ran, not the final version, since migrate() chains all the way to 5 in one call) and widened `shop.test.js`'s category assertion to include `cheatDay`. `node --check` clean on all touched files.

**Live-verified in Chrome:** created a negative habit, bought a Cheat Day (200→300 price climb confirmed, held: 1), tapped the lurker and used it — popup rebuilt in place showing "Cheat Day active — indulging today is free"; clicked "I indulged" — points unchanged, streak/occurrenceHistory/cheatDayDate all correctly untouched-then-cleared, no app-code console errors. Separately verified the rollover path: bought + applied a second token to today's fresh lurker, then backdated `currentGameDate` + the lurker's `originalDueDate` + the habit's `cheatDayDate` to match (session 32's neutered-flush trick) and reloaded — the stale lurker was silently excused (no check-in card, no duplicate spawn, `currentGameDate` advanced, occurrenceHistory/streak/points all unaffected).

**[P1-DATA-005] is now fully CLOSED** — all 5 sub-sessions plus the session-26 Fable fork are built. Frozen routine slots (docs/ROUTINES.md) is the next related ticket and now has a real check-in surface + Cheat Day mechanic to build on.

---

## 2026-07-19 — Session 33: Sub-session 4 BUILT — daily check-in prompt (Cowork session, Opus plan → Sonnet execute)

**Problem:** session 30/32 left the previous day's negative-habit lurker silently auto-resolving as "avoided" at rollover — generous but never actually asked the player. NEGATIVE_HABITS_PLAN.md sub-session 4 (now unblocked by session 32's day-advance mechanism) specs a binary confirmation card instead, for the SINGLE most recent prior day only; older days keep the silent auto-avoid default (session 26).

**Design (no open forks — session 26 already settled the semantics; this was pure execution):**
- `js/dayRollover.js` gains `isFromPreviousDay(date, now)` — pure date classification, same shape as the file's existing helpers.
- `js/state.js`'s rollover routing forks per stale item: a negative-habit lurker where `isFromPreviousDay(item.originalDueDate, now)` is true goes to the NEW `Items.markPendingCheckIn`; everything else (older negative lurkers, positive habits, routine tasks) still goes to the existing `Items.settleStaleRecurringInstance`, unchanged.
- `Items.markPendingCheckIn` records `habitDef.pendingCheckIn = { originalDueDate }` — a plain additive field, no schema/version bump. Precedent: state.js's `definedTasks` handling already establishes "additive field, absent on old saves, no migration needed" for this exact codebase. Also avoids colliding with sub-session 5's planned 4→5 migration. The lurker itself is removed (mirrors the double-spawn reasoning from session 32/30) so today's fresh lurker spawns clean.
- `Items.resolvePendingCheckIn(habitDefId, outcome, deps)` — `'avoided'` mirrors `settleStaleRecurringInstance`'s avoid branch (`Habits.applyHabitCompletion`, keyed to the marker's `originalDueDate`); `'indulged'` mirrors `indulgeHabit`'s debit branch (`Habits.applyHabitIndulgence` + non-clamping `Economy.applyIndulgenceCost`). Defensive no-op if the habit has no pending marker.
- `js/ui/checkIn.js` (new, DOM-only, same shared-global pattern as popups.js) — one card per pending habit, binary buttons, plus the spec's "I'll check this later" snooze (PROJECT_SPEC.md ~646).
- **Snooze is a plain in-session `setTimeout` (`CONFIG.CHECK_IN_SNOOZE_MS`, 4 hours), deliberately NOT persisted across reload** (Jeremy's call via the approved plan): a reload before 4 hours just re-prompts immediately on next restore. Simpler than a scheduling system, and honest — this ticket builds the check-in SURFACE only, not frozen slots or a notification/scheduling layer.

**Structure:** `js/dayRollover.js` (+isFromPreviousDay), `js/items.js` (+markPendingCheckIn, +resolvePendingCheckIn), `js/state.js` (rollover fork), `js/ui/checkIn.js` (new), `css/checkIn.css` (new), `js/config.js` (+CHECK_IN_SNOOZE_MS), `script.js` (thin wrappers + checkInDeps() + boot-time `showCheckInIfPending()` call after restoreGameState), `index.html` (new script/link tags).

**Tests:** 25 suites, 482/482 (+9: 3 new `DayRollover.isFromPreviousDay` cases in `test/dayRollover.test.js`; 6 new in `test/items-checkin.test.js` covering markPendingCheckIn + resolvePendingCheckIn avoided/indulged/no-op-if-missing-marker/no-op-if-habit-not-found). `node --check` clean on all touched files.

**Live-verified in Chrome** (backdated the dev save's `currentGameDate` + the negative habit lurker's `originalDueDate` one day back, per session 32's documented `Persistence.flush`/`requestSave` no-op trick): check-in card appeared for DebtTest-Snacking only (the positive habit PosTest-Water correctly auto-resolved silently, unaffected); snooze closed the modal without resolving, `pendingCheckIn` marker persisted, and reloading before the 4-hour timer re-prompted immediately as designed; "Successfully avoided" awarded XP+points, incremented streak, recorded a success occurrence, cleared the marker; re-backdating and choosing "I indulged" debited points (5→0), zeroed the streak, recorded a miss occurrence, cleared the marker. No duplicate lurkers, no app-code console errors across any of the three runs.

---

## 2026-07-19 — Session 32: Day-advance mechanism BUILT — restore-path day rollover (Cowork session, Opus plan → Sonnet execute)

**Problem (recon from session 30):** `currentGameDate` was set once at initGame() and restored as-is; nothing advanced it. A session spanning midnight left the game on the old day — daily generators ran with a stale date, today's habit/routine-task instances never spawned, prior-day instances lingered. Base HP / offline damage / regen / days-survived derive from real elapsed time and were never affected — only the game-DAY concept.

**Design (settlement follows from prior decisions, so NOT a Fable-tier fork):** on restore, if `DayRollover.hasDayRolledOver(savedGameDate, now)`, close out the prior day's RECURRING instances (identified by `definitionId` — habits + routine tasks; one-off tasks/sub-tasks have none and are untouched), then advance `currentGameDate` to today. Per-item settlement:
- Negative lurker → auto-avoided (session-26's "prior days default to avoided"): full avoid reward, occurrence keyed to yesterday so today still spawns a fresh lurker. NOT added to "Completed Today" (that's the sub-session-4 check-in's surface).
- Positive habit → dropped (miss already recorded by markAsOverdue on re-add).
- Routine task → dropped.

**Decisions made this session:**
- **Routine tasks settle like habits, not like one-off tasks** (Jeremy, via AskUserQuestion): a daily routine task is a per-day check, so yesterday's uncompleted instance is removed and today's spawns — rather than accumulating as a persistent overdue threat. One-off tasks keep the deadline model (persist, keep threatening the base).
- **Scope = restore-path only; LIVE mid-session midnight crossing deferred** (Jeremy): a tab left running past midnight stays stale but self-corrects on next reload, never corrupts. Live rollover would add day-mutation logic to the per-tick loop hot path + a visible mid-session event — not worth it before the restore path is proven. Logged as a later-version item in ROADMAP.
- **Multi-day gaps fabricate no retroactive misses:** only instances actually on the board settle (the away days never generated instances). Matches the offline "punish count, not duration" philosophy and avoids nuking a player's rate history for a vacation.
- **Auto-avoid awards the FULL reward (XP + points + occurrence), mirroring the manual "Successfully avoided"** — consistent, and `checkPlayerLevelUp` handles any threshold crossing on restore. Only difference from manual avoid: no "Completed Today" entry (wrong day) and no fade animation (synchronous).
- **Closed-out recurring instances charge NO offline base damage** (removed before runOfflineCatchUp): recurring-habit consequences are behavioral (points/rate), base HP is for one-off deadline failures. A minor behavior change from the old "overdue habit keeps damaging on restore," and the correct channel separation.

**Structure:** new pure `js/dayRollover.js` (startOfDay / hasDayRolledOver / selectStaleRecurringInstances — tested), `Items.settleStaleRecurringInstance` (the per-item avoid-vs-drop branch — tested), orchestration in state.js's restoreGameState (untested DOM glue, verified by live playtest, per project norm). Guarded by `!save.gameIsOver`. `restoredEntries` pruned of settled items so the offline catch-up animation doesn't process detached ghosts.

**Tests:** 24 suites, 473/473 (+18: `test/dayRollover.test.js` detection/selection incl. one-off-task + sub-task + no-originalDueDate exclusion, same-day no-op, clock-skew, multi-day; `test/items-rollover.test.js` avoid-awards-points / keys-lastCompletionDate-to-yesterday / positive-drops / routine-task-drops). `node --check` clean on dayRollover.js/items.js/state.js/script.js.

**Live-verified in Chrome** (backdated the save one day + reloaded): points −5→0, XP 25→30 (negative lurker auto-avoided), a fresh lurker spawned for today, the positive habit's miss recorded + instance dropped + fresh spawned, the one-off task untouched, `currentGameDate` advanced, no duplicates, no app-code console errors. **Testing note for the future:** the page's unload flush (`Persistence.flush` on beforeunload/visibilitychange) will clobber a hand-backdated localStorage save on reload — neuter `Persistence.flush`/`requestSave` in the console BEFORE reloading to simulate a rollover. (This cost a real debugging detour this session; the rollover code was correct all along.)

---

## 2026-07-19 — Session 31: [P1-DATA-005] sub-session 3 BUILT — non-clamping debt + red HUD nudge (Cowork session, Sonnet)

**Built:** `Economy.applyIndulgenceCost(current, amount)` — a deliberately separate, non-clamping
sibling to `subtractPoints`, per the header NOTE `js/economy.js` reserved back in session 19.
`indulgeHabit` (session 30) now debits through it instead of the 0-floored `subtractPoints`, so a
negative-habit indulgence can push the balance below 0 — matching docs/ECONOMY.md's "balances CAN go
negative" rule, which was previously unbuilt. Uncompletion refunds deliberately still use
`subtractPoints` — only indulgence goes negative, refunds never do.

`js/ui/hud.js`'s `updatePlayerDisplays` renders the negative balance in red (`.points-negative` on the
points stat-item) with an agency-framed nudge: "−N · complete X tasks to break even", X computed by a
new pure `tasksToBreakEven(points, pointsPerTask)` (rounds UP — a partial task still leaves debt; no
new tunable, derived from the existing `pointsPerTask`). Chose a plain text nudge over a progress bar
or icon — matches the existing stat-item's minimal style and needed no new CSS component.

**Explicitly NOT built this session (per the sub-session 3 spec, unchanged):** no shop-gating changes
(`canAfford` already refuses purchases a negative balance can't cover) and no recovery-plan UI
(deferred to run review — see session 26).

**Tests:** 22 suites, 455/455 (+15: `Economy.applyIndulgenceCost` cases in `test/economy.test.js`;
new `test/hud.test.js` covering `tasksToBreakEven` math + the DOM class/nudge toggle including the
negative→non-negative transition and a graceful no-op when the optional DOM refs are absent; an
`items-indulge.test.js` case proving a real indulgence crosses 0; a `persistence-migration.test.js`
case proving a negative `playerPoints` survives `serialize`/`deserialize` and the full migration chain
unchanged). `node --check` clean on `js/economy.js`, `js/items.js`, `js/ui/hud.js`, `script.js`.

**Live-verified in Chrome:** the first indulge from a 5-point balance landed exactly at 0 (5−5=0,
which doesn't distinguish clamping from non-clamping by itself) — a second indulge from that 0
balance produced "−5 · complete 1 task to break even" in red, confirming the non-clamping path is
actually live. Reload persisted the negative balance and the red nudge correctly. No console errors
from app code.

**Docs updated same session:** `docs/ECONOMY.md` (negative-balance rule now marked built, not just
reserved), `docs/NEGATIVE_HABITS_PLAN.md` (sub-session 3 marked done), `docs/ROADMAP.md` (checked).

---

## 2026-07-19 — Session 30: [P1-DATA-005] sub-session 2b BUILT — indulge/avoid actions; rollover guard DESCOPED (Cowork session, Sonnet)

**Built:** the two-button binary on the negative-habit lurker popup — "Successfully avoided" (routes
through the existing `completeItem`/`applyHabitCompletion` path unchanged: success occurrence +
points + XP + lands in Completed Today) and "I indulged" (new `Items.indulgeHabit`, wiring
`Habits.applyHabitIndulgence`: points debit via the 0-floored `Economy.subtractPoints` — interim,
`TODO(sub-session 3)` marker left in place — streak zero, fade-and-remove exit, deliberately does
NOT push into completedItems since a lapse isn't an accomplishment). `js/ui/popups.js`'s
`showTaskDetailsPopup` now branches on `isNegativeHabitInstance` to swap the checkbox+pushback
section for the two buttons; pushback doesn't apply to a lurker (never advances, no deadline to push).

**Descoped, not built:** the rollover-hold guard (auto-resolve a prior-day lurker as avoided before
today's spawn). Recon found there is currently NO live day-advance mechanism anywhere in the
codebase — `currentGameDate` is set once at `initGame()` boot and, on reload, is restored to
whatever value was saved; nothing ever advances it to the real current date. Every
`generateDailyHabitInstances`/`generateDailyRoutineTaskInstances` call site (habit/routine creation,
`restoreGameState`) passes that same stale `currentGameDate`, never `new Date()`. So a session
spanning midnight doesn't currently spawn new daily instances for the new day at all — the game
doesn't yet know a day has passed. This is bigger than 2b's UI-wiring scope (it's an architecture
gap, not a rollover-guard wiring task) and the rollover guard has nothing real to hook into yet.
**Jeremy's call:** stop 2b here (ship the indulge/avoid actions as-is), and schedule the day-advance
mechanism as its own future ROADMAP item — see ROADMAP.md "Known bugs" / Milestone 3 addition.
Sub-session 4 (daily check-in) is blocked on that future session, not on 2b.

**Also found live-verifying (not fixed, noted for the future day-advance session):** `indulgeHabit`
deliberately does NOT set `habitDef.lastCompletionDate` (a lapse isn't a completion) — but
`selectHabitDefsToSpawn`'s dedupe checks ONLY `lastCompletionDate` + an existing active instance for
today. Confirmed live: indulge a lurker, reload same day → a FRESH lurker instance spawns
immediately (no waiting for a day boundary). This is a same-day variant of the double-spawn class of
bug, distinct from the prior-day rollover case 2b's guard was meant to cover, and needs its own
resolution (most likely: indulging should record something dedupe can see, mirroring how completion
does via `lastCompletionDate` — a design call, not obvious which state field is right, given
`applyHabitIndulgence` already records an `occurrenceHistory` entry for today that dedupe doesn't
currently consult). Flagging for whoever picks up the day-advance / dedupe work.

**Tests:** 21 suites, 440/440 (+6 new `test/items-indulge.test.js`: valid indulge debits points +
zeroes streak; no-ops for game-over, unknown item id, non-habit item, positive-habit misroute, and
missing habit definition). `node --check` clean on `js/items.js` and `js/ui/popups.js`.
**Live-verified in Chrome:** "I indulged" → points held at floor (already 0), streak zeroed, zombie
faded out, did NOT appear in Completed Today, no console errors. "Successfully avoided" (fresh
lurker) → XP 20→25, points 0→5, zombie exited, correctly appeared in Completed Today. Reload
persisted both stat changes and the resolved (no-respawn) state correctly for the avoided case.

**Docs updated same session:** NEGATIVE_HABITS_PLAN.md (2b marked done + descope note), ROADMAP.md
(2b checked, new day-advance item added), this entry.

---

## 2026-07-19 — Session 29: [P1-DATA-005] lurker styling + position refinement (Cowork session, Sonnet)

Jeremy's feedback after live-verifying session 28's lurker: (1) the solid orange fill on
`.negative-habit` made it look like an active/urgent enemy rather than a passive, stationary
temptation — changed to border-only (transparent background, 3px solid orange border), matching the
task/habit sprite convention elsewhere (color communicated via border, not a filled block). (2) the
lurk position (near the base, `baseWidth + offset`) undersold the game's own visual-triage value:
since a lurker never moves, parking it in the base-adjacent zone — reserved for genuinely urgent,
damage-dealing enemies — gave it false visual weight and cluttered the area the player most needs to
scan at a glance. Moved the anchor to the FAR RIGHT of the canvas (`gameScreenWidth - habitEnemyWidth
- margin`), the same edge used elsewhere for "not due today" items, so a lurker reads as "on the
radar, not urgent" rather than "imminent."

**Implementation:** `CONFIG.NEGATIVE_LURK_OFFSET_PX` renamed to `NEGATIVE_LURK_RIGHT_MARGIN_PX`
(value 20 — a small margin off the true right edge, not a balance number, no protocol needed).
Required threading `gameScreenWidth` through three deps builders that didn't carry it before:
`loopDeps()`, `stateDeps()` (feeding `State.buildDamageDeps`), and `habitInstanceDeps()` — all three
already carried `baseWidth` for the old formula, so this follows the same accessor-passthrough
pattern rather than introducing a new one. `habits.js` still deliberately has no bare `CONFIG`
global (session 27's constraint stands), so the margin crosses in via `deps.negativeLurkRightMarginPx`
same as before.

**State:** 20 suites, 434/434 (same test count as session 28 — existing lurker-position tests updated
to the new formula/values rather than adding new ones, since the behavior under test didn't change
in kind, only in value). Live-verified in Chrome: border-only rendering confirmed visually; a fresh
negative habit spawns at the far-right edge; reloading a save with a lurker still positioned at the
OLD near-base spot correctly animates it to the new far-right position via the existing offline
catch-up animation, with no damage or other side effects during the transition.

---

## 2026-07-19 — Session 28: [P1-DATA-005] sub-session 2a built — lurker core-loop surgery (Cowork session, Sonnet)

Executed the session-27 surgery plan (NEGATIVE_HABITS_PLAN.md sub-session 2a) essentially as
specified, with one implementation-time refinement worth logging: the load-order constraint. `js/
loop.js` and `js/damage.js` both load BEFORE `js/items.js` in `index.html`, so neither can reference
`Items.isNonThreatening` as a bare global at call time in the way `Habits`/`CONFIG` are referenced by
later-loading modules — script.js already threads collaborators through explicit deps objects for
both modules, so `isNonThreatening` was added the same way (`loopDeps()`/`buildDamageDeps()`), rather
than introducing a new cross-module global-reference pattern. `damage.js`'s two PURE catch-up
functions (`computeGapCatchUpHits`, and the target-position calc inside `runOfflineCatchUp`) default
to an inline equivalent of the predicate when the collaborator isn't passed, preserving their
existing "pure core, no dependencies" testing philosophy (direct unit tests don't need to wire the
collaborator through).

Second implementation-time catch: `Items.recomputeOverdueStateAfterEdit` (called after any edit to
an item's due date) would have overwritten a lurker's fixed lurk x with a timeline/base position if
left unguarded — the surgery plan's 4 named exclusion points didn't originally list this path
explicitly (only `markAsOverdue`, which it calls internally). Added as a 5th guard, found by
reading the function rather than by a live bug.

**Lurk position:** `CONFIG.NEGATIVE_LURK_OFFSET_PX = 220` (px past `baseWidth`) — chosen to exceed
`SUBTASK_AHEAD_THRESHOLD_PX` (150) so lurkers render clear of the overdue-task cluster that camps at
the base. Not a balance number (no gameplay/economy effect, purely a layout constant), so the
balance-tuning protocol doesn't apply.

**State:** 20 suites, 434/434 (+21 new tests across loop.test.js, damage.test.js, habits.test.js, and
a new items-lurker.test.js — items.js had no direct unit-test file before this session). Live-verified
in Chrome: a negative habit spawns as a stationary lurker, takes no damage and doesn't move past its
due time, survives a reload at the same position, and doesn't affect an unrelated overdue task.

---

## 2026-07-19 — Session 26: [P1-DATA-005] FORK SESSION — negative-habit design resolved (Cowork session, Fable; all three verdicts Jeremy's)

The three interacting design forks from `docs/NEGATIVE_HABITS_PLAN.md`, batched into one Fable session per the model strategy. Decisive spec evidence found during analysis: PROJECT_SPEC.md's Daily Check-in Flow (~line 640) specifies retrospective SELF-REPORT resolution — one card per incomplete negative habit from the previous day, binary "Successfully avoided" / "I indulged" buttons.

**Fork A — interaction model: A2, idle "lurker" zombie (no base damage, self-report resolution).**
- Negative habit spawns a zombie that lurks at a fixed position near the fence and NEVER advances (`.negative-habit` red tint, hook already in items.js). No damage timer, no overdue path.
- Any time during the day: tap → "I indulged" → immediate points loss via `Habits.applyHabitIndulgence` (session 25), streak zeroed, zombie exits victorious.
- Undecided days resolve at the NEXT MORNING's check-in (per spec): "Successfully avoided" → success occurrence + points + defeat explosion; "I indulged" → retroactive miss.
- Generous default: unresolved days older than the previous day resolve as avoided (never-punishing tone; spec only asks about "the previous day").
- **Why A1 (advancing temptation, reach-base = auto-indulge) was rejected — not just riskier, semantically broken:** the game cannot observe an indulgence; only the player can report it. A timer expiring means *the player got through the day* — success for a negative habit — so A1 punishes exactly the behavior the mechanic rewards. The overdue/base-damage machinery's trigger (time ran out) means the OPPOSITE thing for negative habits and cannot be reused. Also rejected: A2 list-only (no field zombie) — cheaper, but forfeits the visual-temptation metaphor on the habits that most need pressure.

**Fork B — debt: unbounded, fully orthogonal to base health, no clearing deadline, encouraging UX.**
- Jeremy probed whether debt should tie to base health or require clearing before day's end (run ends otherwise). Rejected on three grounds, all logged for future re-litigation:
  1. **Punishment stacking** — an indulgence already costs points (immediate), streak (reset), rate multiplier (compounding, up to 14 days), and soon frozen slots; adding run-death makes five consequences, contra "reflection over punishment" and hostile to the ADHD audience.
  2. **The honesty problem (the decisive one)** — the system runs on self-report; every consequence attached to "I indulged" raises the incentive to lie, and one lie corrupts streaks/rate-data/run-reviews — the whole reflection layer. Honesty must stay cheap.
  3. **Illegible death** — a run ending at midnight over an invisible number breaks "game pressure mirrors real-life urgency"; church-wrecking zombies are legible, debt isn't.
- **What negative balance is FOR (the design function, worth preserving in future debates):** keeping the cost of indulgence real at zero balance. A 0-floor makes indulgence FREE for the player at 0 points — the player most in trouble faces the least pressure. Debt preserves the incentive gradient; it is an accounting-honesty feature, not a punishment feature.
- Channel separation principle affirmed: base HP = deadline failures (game-observable), points/debt = behavior costs (self-reported, always recoverable), frozen slots = sustained-pattern consequence. One channel per failure mode.
- Debt UX: red HUD number + agency-framed nudge ("−12 · complete 2 tasks to break even"), NOT a shame counter. Shop needs no new gating (`canAfford` already requires balance ≥ price). Fuller "recovery plan suggestions" (MECHANICS.md promise) deferred to the run-review screen. Rejected: floored debt (zero-floor problem returns at the floor); added teeth (honesty problem).

**Fork C — day-tokens: Cheat Day only in this ticket; Sick/Skip deferred to the frozen-slots ticket.**
- Cheat Day (200 pts base, held-inventory exponential pricing like repair kits): while active on a negative habit's day, indulgence costs nothing and **no occurrence is recorded at all** — the day is excused: not a success (you didn't avoid it), not a miss (you paid for grace). Streak preserved, not incremented.
- Sick/Skip rejected for now: the spec is ambiguous on per-habit vs global application (guardrail: don't invent mechanics), and both interact with frozen-slot recovery streaks — a ticket that doesn't exist yet. They ride with frozen slots.

**Plan impact:** sub-sessions 2–5 in NEGATIVE_HABITS_PLAN.md are now unblocked and updated with these decisions. No balance numbers changed this session (Cheat Day's 200 pts is the spec/ECONOMY.md face value, unchanged; the debt nudge introduces no new tunables yet).

---

## 2026-07-19 — Session 25: [P1-DATA-005] sequenced + sub-session 1 built (Cowork session, Opus plan → Sonnet execution)

**Sequencing decision (Opus):** recon before planning changed the scope materially — most of the polarity plumbing (form toggle, `isNegative` on defs/instances, `.negative-habit` CSS, the `occurrenceSuccess` seam) was already built in session 16 as an explicit extension point. What remains is differentiated behavior, sequenced into `docs/NEGATIVE_HABITS_PLAN.md` as 5 sub-sessions plus one batched Fable fork session (interaction model / debt depth / day-token scope — these three interact and are architecture-shaping, so they're deliberately NOT split across sessions). Sub-session 1 was carved out as fork-independent: it only touches the pure seam, so it didn't need to wait on the Fable session.

**Sub-session 1 implementation (Sonnet):** added `'indulged'` to `Habits.occurrenceSuccess(isNegative, event)` (always resolves to a miss — meaningful only for negative habits) and a new pure `Habits.applyHabitIndulgence(currentStreak, occurrenceHistory, isNegative, originalDueDate, config)`. Design choices: (1) **no-op guard for positive habits** — returns `{ streak, occurrenceHistory, pointsLost: 0, multiplier: 0, noOp: true }` unchanged rather than throwing, so a misrouted call is inert; there's no "indulge" concept for a positive habit (that's just not completing it). (2) **pointsLost computed from the POST-record multiplier**, mirroring `applyHabitCompletion`'s convention for `pointsGained` (not the pre-record convention `applyHabitUncompletion` uses for refunds) — chosen so a future "undo indulge" op could cleanly mirror `applyHabitUncompletion`'s recompute-then-pop symmetry the same way completion/uncompletion already do. (3) **streak zeroes on indulgence**, same as overdue — a lapse breaks the visual streak regardless of whether it was caught by the automatic overdue timer or admitted explicitly.

**Deliberately NOT done this sub-session** (scope discipline per the plan): no `items.js` wiring, no UI, no economy/persistence changes — `playerPoints` is not actually debited by anything yet. The function is unreachable from gameplay until a later sub-session wires it in, which is intentional: pure-core-first lets this land before the Fable fork session resolves the interaction model, since the fork changes HOW indulgence gets triggered (button vs. base-damage-on-arrival) but not the pure math this sub-session built.

**State:** 19 suites, 413/413 (+6 new tests in `test/habits.test.js`). `node --check js/habits.js` clean. No live Chrome verification needed/possible — pure function, no UI surface exists yet to click.

---

## 2026-07-19 — Session 24: Shop session 5 — balance re-tune, THEORY pass ([P1-UI-008] CLOSED) (Cowork session, Fable)

**Mode decision (Jeremy):** theory pass now, real-play re-check later — every point in his save so far was injected or earned from seconds-old test tasks, so there was no real earn-rate data to tune against. The balance-tuning skill (Claude Code) isn't available in Cowork; its protocol was followed manually: all numbers in config.js, every number + rationale logged here, tests updated in the same session.

**The yardstick:** a solid day ≈ **75–85 pts** (5 tasks incl. one high-priority = 60, + 4 habits at mid-tier ≈ 24). Every price below is judged against that.

**Verdict 1 — repair kits VALIDATED, no changes (25/50/100 pts → 15/35/75 HP).** HP-per-point improves with tier (0.60/0.70/0.75) — a mild bulk reward that the exponential held-pricing pushes back against if you stockpile. Each tier's heal ≈ undoes 1/3/6 offline-neglected items (12 HP lifetime cap each). Costs ≈ ⅓ / ⅔ / 1.3 days of earnings. Free regen (12 HP/hr) keeps kits an emergency top-up rather than a subscription; even the large kit heals less than full, so kits never trivialize death. Rejected: re-anchoring heals to 12/36/72 (exact neglected-item multiples) — the mapping is invisible in-game and the numbers players see get uglier.

**Verdict 2 — pushback stays FLAT at 50/100/300, no per-run inflation.** The session-23 interim call is now the tuned decision. Core argument: the points economy is CLOSED — points only come from completions, so pushing one item 1hr costs 5 completed tasks' earnings; pushback dependency is self-bankrupting without any added mechanism. Structure documented: stacking 1hr tokens breaks even with the 1-day token at exactly 6 hours, so hourlies serve small slips and the day token (~4 days of earnings) is the emergency parachute. Rejected: discounting the 2hr tier to 90 to give the middle tier a distinct role — diverges from ECONOMY.md's canonical face values for marginal gain. Revisit trigger: real play showing a large-bank player push-spamming a dreaded task daily.

**Verdict 3 — habit rate tiers RE-TUNED (the one change): ≥90% 1.5×→2.0×, ≥70% 1.25×→1.5×.** Payouts move from 8/6/5 to **10/8/5**. Rationale: the old excellence bonus (+3 pts/habit/day) was weak against shop prices (a week of 90%+ on four habits barely bought a large kit), and the new top tier buys a legible anchor — **task parity: "a habit you keep at 90%+ pays like a task" (10 = POINTS_PER_TASK)**. Inflation is modest (+8 pts/day for a 4-habit excellent day). Changed: `CONFIG.HABIT_RATE_TIERS`, pinned values in `test/habits.test.js` (the multiplier tests deliberately pin config values so silent changes fail loudly — updated to pin the NEW values), ECONOMY.md, MECHANICS.md. `HABIT_RATE_WINDOW`/`MIN_SAMPLE` (14/7) unchanged.

**Tests:** 19 suites, **407/407** after the tier/test updates. No live Chrome verification — the change is a pure config multiplier already covered by unit tests end-to-end (`pointsMultiplier` → `applyHabitCompletion` → refund symmetry), and no habit in the dev save has ≥7 recorded occurrences to exercise it live anyway.

**[P1-UI-008] is CLOSED.** Shipped across sessions 20–24: pure core + persistence (v4), UI frame, repair-kit use, pushback targeting, balance pass. Day-tokens ride with [P1-DATA-005]. **Standing follow-up (in ROADMAP):** re-check all session-24 numbers against Jeremy's REAL earn rate after he's played some days — if reality differs much from the 75–85 pts/day yardstick, prices need another look.

---

## 2026-07-19 — Session 23 addendum: pushback affordability feedback (Jeremy's catch, post-commit)

Jeremy noticed the pushback tiers had no "not enough points" feedback — they just grayed out, unlike the shop Buy button's explicit disabled text. Fix: the "Push back this deadline:" label now carries a live "(you have N pts)" note whenever at least one tier is unaffordable, updated by `refreshPushbackUI` as points drop across stacked pushes. Chose a visible balance note over (a) a `title=` tooltip — invisible on mobile, the primary target — and (b) per-button "need N more" text — too cramped in three side-by-side buttons. Live-verified in Chrome at 0 points: note renders, all tiers disabled. `js/ui/popups.js` + `css/popups.css` only; no logic/pricing change; 407/407 unaffected.

---

## 2026-07-19 — Session 23: Shop session 4 — pushback items + enemy targeting ([P1-UI-008]) (Cowork session, Opus plan → Sonnet execution)

**Two design calls resolved up front (Jeremy, on Opus):**
1. **Pushback pricing = FLAT** (base cost every time: 50/100/300). This is exactly what `Shop.price` already returns for non-consumables (`held` is always 0 → `base × 1.5^0`), so it needed zero pricing-code change. Rejected: per-run purchase-count inflation — it would require a new persisted counter + a v4→v5 schema migration + reset logic, stacking a persistence change onto the targeting work against the one-persistence-change-per-session guardrail. If the session-5 balance pass (Fable) decides pushback should inflate, that's the deliberate place to add the counter. Anti-abuse until then: the flat cost is non-trivial and pushback only DELAYS — the task still has to be done. (SHOP_PLAN.md's "pushback pricing wrinkle" section updated from open → resolved.)
2. **Pushback applies to ALL enemies** (task / sub-task / habit) — uniform mechanic (shift `dueDateTime`), simplest v1. A habit due 11:59pm pushed 1hr lands 12:59am next day; slightly odd since habits recur, but not broken. Rejected: tasks-only (needs a type check + hiding the action for habits, for marginal semantic cleanliness).

**Built (per SHOP_PLAN.md session 4):**
- `js/shop.js`: new pure `pushedBackDueDate(currentDueDate, pushbackMs)` — returns a NEW Date shifted later, never mutates its arg; missing/zero ms is a no-op shift. Exported + unit-tested.
- `js/ui/popups.js`: `showTaskDetailsPopup` grows a "Push back this deadline" section (`buildPushbackSectionHtml`) — one button per pushback tier with its live price (via `Shop`, a bare global here like `Modal` — loads before popups.js), disabled when unaffordable. On click → `deps.onPushback(itemId, item)` → on `{ok}` a local `refreshPushbackUI()` updates the shown Due time + re-evaluates every tier's affordability against the now-lower points, IN PLACE. Stacking (ECONOMY.md "stacking allowed") works within one popup session.
- `js/ui/shopView.js`: pushback (non-consumable) cards now render a "Tap a zombie to push it back" hint instead of a Buy button — buying a non-holdable item would have spent points for nothing (a latent dead-end left by sessions 2–3).
- `script.js`: `popupsDeps()` gains `pushbackCatalog` (filtered `CONFIG.SHOP_ITEMS`), a `getPlayerPoints` getter (popup re-checks affordability live), and `onPushback: handlePushback`. New `handlePushback(itemId, targetItem)` — pays via `Shop.purchase` (non-consumable → inventory unchanged; reuses the affordability + point-math path), shifts the target's due date via `Shop.pushedBackDueDate`, `recomputeOverdueStateAfterEdit`s it (same function the Edit-Task save uses — un-camps + repositions a pushed-back overdue zombie; a still-future item is repositioned by the next 50ms loop tick), re-renders the agenda row, `updatePlayerDisplays` + `saveGame`, returns `{ ok }` so the popup refreshes.

**No `setTimeout(0)` needed here** (unlike the shop Buy/Use buttons, sessions 2–3). The popup refresh updates the Due text + button `disabled` states in place rather than rebuilding the section's innerHTML, so the just-clicked button is never detached mid-bubble — the event-target-detachment hazard simply doesn't arise. Verified the enemy-popup context has no document-level listener that would close it on a detached child anyway (the modal-close listeners only fire on a click of the overlay backdrop itself).

**Tests:** `test/shop.test.js` +4 `pushedBackDueDate` cases (shift amount, catalog 1hr/1day amounts, no-mutation, zero/undefined no-op). 19 suites, **407/407** (was 403). `node --check` clean on shop.js / shopView.js / popups.js / script.js. **Live-verified in Chrome** (fresh task-zombie + injected points): 1hr push shifted 5:00→6:00pm in popup AND agenda row, −50 pts, popup stayed open, zombie repositioned; 1-day push stacked to 7/20, −300 pts, and the in-place affordability refresh correctly disabled the 100/300 tiers once points hit 50; made the task overdue via Edit then pushed it 1hr into the future → the zombie left the base, the row cleared its overdue styling, and base damage stopped (recompute path); pushed-back due time persisted across reload; shop pushback cards showed the hint; console clean of app errors throughout.

---

## 2026-07-19 — Session 22: Shop session 3 — repair kit inventory + USE ([P1-UI-008]) (Cowork session, Sonnet)

**Built (per SHOP_PLAN.md session 3):** Each repair-kit card in `js/ui/shopView.js` now grows a "Use (+N HP)" button whenever `held > 0` (repair kits only — pushback items are `consumable: false` and never get one). Clicking it calls the new `handleShopUse(itemId)` in script.js: `Shop.consume(itemId, playerInventory)` (pure, session 1) decrements the held count, then the existing `healBase(amount)` wrapper (script.js ~line 569, built session 17 for base regen, reused unchanged) applies `item.effect.healAmount`, clamped at `CONFIG.MAX_BASE_HEALTH`, updates the health display/base sprite, and calls `saveGame()` internally — `playerInventory` is reassigned BEFORE that call so the internal save already captures the decremented count (no separate `saveGame()` needed in `handleShopUse`). The Use button is disabled with "Base at full health" once `baseHealth >= CONFIG.MAX_BASE_HEALTH`, so a kit can't be spent for zero effect — `baseHealth` threaded through as a new `populateShopWindow`/`openManagementWindow` dep the same way `playerPoints` already was.

**Applied the session-2 hazard from the start.** `handleShopUse` wraps its `populateShopWindow()` rebuild in `setTimeout(fn, 0)`, same as `handleShopPurchase` — the same event-target-detachment bug (see session 21) would otherwise recur, since Use is also a click handler that rebuilds its own container. No repeat bug found this session; SHOP_PLAN.md's hazards list (updated session 21) paid off.

**Tests:** no new pure-core logic — `Shop.consume` was already covered by `test/shop.test.js` since session 1, and this session only wired existing tested pieces (`Shop.consume`, `healBase`) together through new UI. 19 suites, 403/403 unchanged. `node --check` clean on `js/ui/shopView.js`, `js/ui/managementWindows.js`, `script.js`. **Live-verified in Chrome:** with 1 held Repair Kit (Small) and base health at 60 (set via a `localStorage` injection + `Persistence.flush`/`requestSave` no-op patch to safely test mid-range health without waiting for real damage — see Watch out below), clicking Use healed 60→75, decremented held 1→0, the price card reset to base cost (38→25 pts, since `owned` dropped back to 0), the window stayed open post-click, and `playerInventory`/`baseHealth` both round-tripped correctly across a real reload. Separately verified the full-health guard: injected `baseHealth: 100` + 1 held kit, confirmed the button rendered disabled with "Base at full health" text. Console clean of app errors throughout (only the same unrelated browser-extension message-channel noise seen since session 21). Restored the save to its real post-test values (75 HP, empty inventory, 15 points) before ending the session.

**Testing-methodology note (reusable):** to set up a specific mid-range `baseHealth` for UI testing without waiting out the real 5-minute damage tick interval, patch `Persistence.flush = () => {}` and `Persistence.requestSave = () => {}` on the LIVE page (both are reachable as bare globals in the page's script scope, not just `window` properties) BEFORE editing `localStorage.deadline.save` and navigating — otherwise the outgoing page's `beforeunload`/`visibilitychange` flush (or a stray debounced `requestSave`) overwrites the injected value with whatever was already in memory before the new page even loads. This generalizes the "flush-neutralize trick" mentioned in earlier sessions' HANDOFF entries; now spelled out here since it wasn't previously written down as a repeatable recipe.

---

## 2026-07-19 — Session 21: Shop session 2 — UI frame ([P1-UI-008]) (Cowork session, Sonnet)

**Built (per SHOP_PLAN.md session 2):** 4th FAB menu item (`data-type="shop"`, 🛒) + `#shopWindow` markup in `index.html`, reusing the existing `management-window`/backdrop pattern — no new nav plumbing needed since `ManagementWindows.openManagementWindow`/the generic `.fab-menu-item`/`.close-window` listeners all dispatch on `data-*` attributes already. `js/ui/shopView.js` (new module, same no-DOM-closure pattern as `managementWindows.js`): `renderShopWindow(deps)` builds one card per `CONFIG.SHOP_ITEMS` entry with a live price (`Shop.price`), held count for consumables, a disabled/enabled Buy button (`Shop.canAfford`), and the "price rises ×1.5 per one you hold" feedback line once held > 0 (ECONOMY.md's UI requirement). `css/shop.css` added before `responsive.css`. `ManagementWindows.openManagementWindow` gained a `type === 'shop'` branch calling `ShopView.renderShopWindow` — the same one-function cross-module coupling pattern as its existing FabMenu/RoutineViews dependencies. script.js: `managementWindows.shop`, `openManagementWindow`'s deps gained `shopCatalog`/`playerInventory`/`playerPoints`/`onShopBuy`, and two new wrappers — `populateShopWindow()` (re-render) and `handleShopPurchase(itemId)` (calls `Shop.purchase`, applies the result to `playerPoints`/`playerInventory`, `updatePlayerDisplays()`, `saveGame()`).

**Bug found and fixed live in Chrome — window closed itself after every purchase.** Root cause: `handleShopPurchase` originally called `populateShopWindow()` (which does `#shopWindowList.innerHTML = ''` then rebuilds) SYNCHRONOUSLY inside the Buy button's click handler. That detaches the clicked button from the DOM before the click event finishes bubbling up to script.js's existing document-level "click outside a management window closes it" listener (~line 1086, predates this session). That listener does `e.target.closest('.management-window')` — on an already-detached node this returns `null`, so every purchase looked like a click outside the window and closed it immediately. **Fix:** wrapped the `populateShopWindow()` call in `setTimeout(fn, 0)` so the click finishes bubbling (with the original target still attached) before the rebuild runs. This is a general hazard for any future click handler in this codebase that both (a) triggers a DOM rebuild of its own container and (b) relies on the same click continuing to bubble — worth a callout for sub-session 3 (repair-kit USE button) and session 4 (pushback targeting), which have the same shape. Not yet added to SHOP_PLAN.md's hazards list — worth doing before session 3.

**Scope check:** confirmed with Jeremy before resetting his dev save (full of `Session*-Test*` debris from prior sessions, base was already GAME OVER at 0 health) to get a clean state for live purchase testing — he approved the Reset. Left 2 new test tasks (`ShopTest-PointsSource`, `ShopTest-Points2`, both completed) and 1 held `repair_small` in inventory from testing; flagged in HANDOFF as cleanup debris, same pattern as prior sessions' test artifacts.

**Tests:** no new pure-core logic this session (UI-only, per SHOP_PLAN.md's own hazard note that UI leans on `node --check` + live Chrome smoke test rather than Jest) — 19 suites, 403/403 unchanged. `node --check` clean on `index.html`'s scripts, `js/ui/shopView.js`, `js/ui/managementWindows.js`, `script.js`. **Live-verified in Chrome:** FAB shop item opens the window with correct catalog (6 cards, correct base prices/icons); repair-kit-small purchase deducted 25 points (40→15), incremented held to 1, and — after the fix — left the window open with the live-updated price (25→38, `round(25×1.5)`) and the held-count feedback note; `playerInventory`/`playerPoints` both persisted correctly across a full page reload; console clean of app errors (the only console entries were unrelated browser-extension message-channel noise).

---

## 2026-07-18 — Session 20: Shop plan written + Shop session 1 ([P1-UI-008] state/config/pure core) (Cowork session, Opus)

**Planned then built.** Wrote `docs/SHOP_PLAN.md` sequencing the 13-pt shop ticket into 5 sub-sessions (state+core → UI frame → repair-kit use → pushback → balance re-tune). Scope calls (Jeremy, session 19): **v1 = repair kits + pushback** (day-tokens deferred until negative habits [P1-DATA-005] exist — Cheat Day depends on them); **entry = 4th FAB menu item**; **exponential pricing uses `owned = currently-held`** (using an item makes the next cheaper). Then executed sub-session 1.

**Built (sub-session 1 — pure core + persistence only, no UI):**
- `CONFIG.SHOP_ITEMS` catalog (6 items: 3 repair kits, 3 pushback) transcribed from ECONOMY.md. Shape: `{ id, name, category, baseCost, consumable, effect }`.
- `js/shop.js` — pure `getItem`/`heldCount`/`price`/`canAfford`/`purchase`/`consume`. No DOM, no state ownership. `price`/`purchase` delegate to `Economy.shopPrice`/`Economy.subtractPoints` so pricing + the points floor stay single-sourced. `purchase`/`consume` return NEW inventory objects (never mutate args).
- Inventory state: `playerInventory = {}` owned in script.js; `getPlayerInventory`/`setPlayerInventory` accessor deps through `stateDeps()`. `getPersistableState` persists it, `restoreGameState` restores it (guards non-object), `initGame` resets to `{}`.
- Persistence `SCHEMA_VERSION` 3→4 with a v3→v4 migration seeding `inventory: {}` on older saves.

**Decision — `consumable` flag drives inventory vs instant-consume.** Repair kits (`consumable: true`) are held then used; pushback (`consumable: false`) applies instantly on purchase and is NOT added to inventory. Consequence flagged for sub-session 4: with `owned = held`, pushback's held count is always 0, so its exponential price never climbs — the pricing basis for pushback is an open sub-decision (proposed: per-run purchase count, or flat), to resolve when building pushback or in the session-5 tuning pass. Logged in SHOP_PLAN.md.

**Balance note (balance-tuning):** repair-kit `healAmount` values (15/35/75) are NEW placeholders — ECONOMY.md specifies base costs but not heal amounts. Base costs (25/50/100 repair, 50/100/300 pushback) are ECONOMY.md's canonical numbers. All flagged for the session-5 re-tune against real play (alongside the `HABIT_RATE_TIERS` placeholders pending since session 16).

**Tests:** `test/shop.test.js` (new suite — catalog integrity, held/price/afford/purchase/consume incl. the owned=held price climb and the non-consumable no-inventory case) + 5 v3→v4 cases in `persistence-migration.test.js`. Updated the existing migration tests that asserted the chain endpoint `=== 3` to `=== Persistence.SCHEMA_VERSION` (endpoint moved to 4), and the v3-passthrough test to a v4-passthrough. **19 suites, 403/403.** `node --check` clean on all touched files. **Live-verified in Chrome:** disk save migrated v3→v4 with `inventory` seeded; `Shop.purchase` dry-run correct; a full inject→reload→re-persist round-trip proved `restoreGameState` reads inventory back into memory (used the session-17 flush-neutralize workaround — a plain reload clobbers the injected save via the outgoing page's unload flush). Reset Jeremy's inventory to `{}` after (no UI to use phantom kits yet). Console clean; points untouched (40).

---

## 2026-07-18 — Session 19: Milestone 3 opened; ordering decided; [P1-DATA-007] done via js/economy.js (Cowork session, Fable plan → Sonnet execution)

**Milestone 3 ordering decided (Fable):** P1-DATA-007 points standardization → P1-UI-008 shop → P1-DATA-005 negative habits (+ frozen slots) → P1-UI-006 heroes / P1-DATA-004 sub-task hierarchy / run history. Why: 007 is smallest and explicitly gates the shop; the shop unblocks repair kits AND the habit-rate-tier re-tune; negative habits already have their seam (`occurrenceSuccess`, session 16) and lead into frozen slots. Rejected: starting with P1-DATA-005 (3-week ticket, blocks nothing else); starting with the shop directly (its ticket names 007 as a dependency).

**P1-DATA-007 rescoped:** the ticket's acceptance criteria are ~half moot — they target the MPE variant, which is reference-only since Milestone 0. The Root variant's points system was already consistent (earning in items.js/habits.js, display in hud.js, persistence in state.js, values in config.js). What was actually missing: `js/economy.js` (ARCHITECTURE.md target module; progression.js deliberately left `playerPoints` behind for it), a single home for the high-priority ×2 rule (was duplicated inline in items.js's complete + uncomplete paths), and the shop's exponential-pricing formula.

**Built:** `js/economy.js` — pure `taskPoints(isHighPriority, pointsPerTask)`, `addPoints`, `subtractPoints` (0-floor), `shopPrice(baseCost, owned)` = `round(base × 1.5^owned)` per ECONOMY.md. items.js's four points call sites now route through it; behavior-identical (same numbers). `playerPoints` OWNERSHIP stays in script.js accessor-deps, consistent with every other module.

**Decision — zero floor kept for refunds:** ECONOMY.md says balances CAN go negative, but only via negative-habit indulgence ([P1-DATA-005], unbuilt). `Economy.subtractPoints` keeps the 0-floor and carries a comment: when indulgence lands it gets a dedicated non-clamping path; uncompletion refunds keep the floor. Rejected: allowing negative now (nothing can legitimately produce it; would mask refund bugs).

**Tests:** `test/economy.test.js` (10 cases incl. pinned shopPrice values so a silent formula change fails loudly). 18 suites, 380/380. Live-verified in Chrome: normal task +10/−10 round-trip exact; high-priority task +20 points/+10 XP (the ×2 applies to points only); persistence through reload; console clean. Re-observed the known cosmetic uncomplete-checkbox bug (ROADMAP known-bugs) — unchanged, not a regression.

---

## 2026-07-18 — Session 18: style.css split by component (Cowork session) — Milestone 2 CLOSED

**Context:** last open Milestone 2 item (`docs/ARCHITECTURE.md`: "`style.css` splits per component after JS is done"). Mechanical split, no design judgment — grouped by the natural `js/ui/*.js` cluster boundaries the JS extraction already established, plus 4 pre-UI-extraction files (`base`, `gameCanvas`, `enemySprites`, `enemyStatus`) and one cross-cutting `responsive.css`.

**Built:** 12 files under `css/` (see ARCHITECTURE.md for the full list + mapping). `index.html`'s single `<link rel="stylesheet" href="style.css">` replaced with 12 links in a specific order. Old root `style.css` (2,095 lines) deleted (Jeremy's call, asked via AskUserQuestion — verified working first, recoverable from git history).

**Two real hazards found and fixed before this could ship correctly — both are the kind of bug that produces no error, just silently-wrong rendering:**

1. **Relative `url()` asset paths.** `background-image: url('Assets/Zombies/...')` and `url('icons/...')` are resolved by the browser relative to the CSS file that declares them, not the HTML page that links it. These worked at the repo root (`style.css` next to `Assets/`); moved into `css/`, the same relative paths pointed at `css/Assets/...`, which doesn't exist — every sprite/icon using a relative `url()` (zombie art, category icons, the base/church image) silently disappeared, confirmed live in Chrome (enemies rendered as empty bordered boxes). Fixed by rewriting every `url('Assets/...')`/`url('icons/...')` to `url('../Assets/...')`/`url('../icons/...')` (found via `grep -rn "url(" css/*.css`, 40 occurrences across `enemySprites.css`, `agendaList.css`, `gameCanvas.css`). **Lesson: any time CSS moves to a new directory depth, grep for `url(` and check every relative path, not just eyeball the rule content.**

2. **`@media` block ordering.** The original `style.css` had one "Responsive Design" section (`@media (max-width:768px)` / `@media (min-width:1024px)`) positioned near the end of the file, after the base rules it overrides (`.game-canvas`, `.fab`, `.management-window`, `.task-section`, etc. — 15 selectors total). Before writing any file, checked (via targeted grep of each moved block's selectors against the whole original file) whether any block being relocated shared a selector with another block, since CSS at equal specificity resolves by *source order*, and splitting into multiple linked stylesheets doesn't change that — the browser treats N linked stylesheets as one continuous cascade in link order. Confirmed the responsive block's 15 target selectors are all defined earlier in the file with no other later redefinition, EXCEPT the split itself would have moved several component rules to *load after* the responsive overrides if grouped naively (e.g. if `.hidden`+responsive had gone into `base.css`, loaded first). Fixed by giving the `@media` rules their own `responsive.css`, linked explicitly LAST — after every other component file, an even safer position than the original (which was merely after *most* other rules, not all). `responsive.css`'s own header comment flags this explicitly for future editors. **Verified live:** at desktop width, `.game-canvas`'s computed `min-height` read `300px` (the `min-width:1024px` override) rather than `250px` (the unconditional `gameCanvas.css` base value) — proof the override is winning the cascade from its new position.

**Verification:** `node --check` N/A (no JS changed). Jest suite unaffected (no CSS test coverage — 17 suites, 370/370, unchanged from session 17). **Live-verified in Chrome:** screenshotted the main agenda view, FAB menu, and Tasks management modal before and after the split — pixel-identical. Confirmed `document.styleSheets` load order matches the intended 12-file sequence. Confirmed zero console errors on a fresh load with `style.css` deleted.

**Rejected:** keeping `Assets`/`icons` `url()` paths as-is and instead moving the `css/` files to the repo root with distinct names (rejected — defeats the purpose of a tidy `css/` directory, and every future CSS file would need the same root-relative-path awareness anyway); bundling `responsive.css` into `base.css` for simplicity (rejected — the ordering hazard above makes that actively wrong, not just untidy).

**Resolves:** Milestone 2's last open item ("Split style.css by component"). **Milestone 2 (Modularize script.js) is now fully CLOSED** — both the JS monolith and the CSS monolith are extracted.

## 2026-07-18 — Session 17: [P2-GAME-012] gradual base regen BUILT (Cowork session)

**Context:** design fully decided in session 13's Fable session (1 HP per `BASE_REGEN_INTERVAL_MS` while alive + same rate for offline/suspended-loop time, applied AFTER offline overdue damage, clamped at `MAX_BASE_HEALTH`, no daily reset). This session is implementation only.

**Built:** `js/config.js` — added `BASE_REGEN_HP: 1`, `BASE_REGEN_INTERVAL_MS: 5*60*1000` (same values as `OVERDUE_DAMAGE`/`DAMAGE_INTERVAL_MS` by design — symmetric heal/damage rate, independently tunable). `js/damage.js` — pure `computeRegenTicks(elapsedMs, intervalMs)`; stateful `healBase(amount, deps)` (mirrors `damageBase`'s clamp/display/visuals/save shape, no hit-flash, no-ops on game-over or non-positive amounts); `applyElapsedRegen(elapsedMs, deps)` (computes+applies whole-interval regen, then resets the regen clock to now — deliberately loses the sub-interval remainder at that reset point, unlike the damage tick's remainder-preserving style, matching the "quiet base recovers, doesn't need to be exact" design intent). Wired into both offline-catch-up branches (instant + post-animation) in `runOfflineCatchUp`, AFTER `applyOfflineDamage`, and into `runLiveGapCatchUp` (using the gap since the live loop's own last regen tick, guarded so deps bags that omit `getLastRegenTickMs` — i.e. existing tests — are unaffected). `js/loop.js`'s `updateActiveItems` gained the live per-tick regen check (same remainder-preserving single-tick-per-call shape as the existing damage tick, but base-wide not per-item); first call after a fresh game/restore just plants the clock rather than granting a free heal. `js/state.js`'s `buildDamageDeps` and script.js's `stateDeps()`/`loopDeps()` thread `getLastRegenTickMs`/`setLastRegenTickMs` through (new `lastRegenTickMs` script.js-owned `let`, same accessor-pair pattern as `lastLoopTickMs`); script.js gained a thin `healBase` wrapper.

**Key design decision (implementation-level, not asked — logged):** the live regen clock (`lastRegenTickMs`) resets to "now" immediately after any offline/gap regen is applied, rather than carrying forward the pre-catch-up clock. This means a long-neglected base gets exactly `floor(offlineMs / interval)` HP for the offline window and then resumes ticking fresh — it can't accumulate a fractional head start into the live loop's cadence. Consistent with how `runOfflineCatchUp`'s damage side already treats the offline window as a sealed accounting period.

**Tests:** `test/damage.test.js` +15 cases (`computeRegenTicks`, `healBase` clamp/no-op/game-over/save, `applyElapsedRegen`-driven interactions in both `runOfflineCatchUp` and `runLiveGapCatchUp`, incl. one existing test's expected value updated now that offline regen legitimately changes the outcome). `test/loop.test.js` +3 cases (clock-planting, remainder-preserving tick, no-tick-before-interval) plus `healBase`/regen fields added to the shared `makeDeps` fixture. **17 suites, 370/370** (was 355).

**Live-verified in Chrome** (see HANDOFF.md for the full narrative): live ticking confirmed by temporarily speeding up `CONFIG.BASE_REGEN_INTERVAL_MS` at runtime and watching HP climb tick-by-tick. Offline regen confirmed by aging a save's `savedAt` by 25 minutes and reloading — base took 8 HP of legitimate offline damage then healed 5 HP of regen after it, landing exactly at the predicted value with `offlineDamageCharged` updated correctly per item. **Methodology note for future sessions:** naively editing `localStorage`'s `savedAt` and reloading does NOT simulate offline time — `Persistence`'s flush-on-hide/beforeunload handler re-serializes the CURRENT in-memory state (with a fresh `savedAt`) before the page actually unloads, clobbering the injected value every time, regardless of how the reload is triggered. To test offline catch-up from Cowork/DevTools, temporarily no-op `Persistence.flush` and `Persistence.requestSave` in the live console BEFORE editing `savedAt` and reloading, then let the fresh page load run normally (patch doesn't survive the reload, so no cleanup needed beyond confirming no stray debug logging is left in source — none was, this session's temporary `console.log` instrumentation was fully removed before commit).

**Rejected:** none — single design already fully specified in session 13, no open questions surfaced during implementation.

**Resolves:** [P2-GAME-012] gradual base healing — ROADMAP Milestone 4 item now BUILT. Docs (MECHANICS.md Base + Offline Catch-up sections) updated same session.

## 2026-07-18 — Session 16: rate-based habit bonus BUILT (step c) — streak now visual-only; polarity-ready

**Context:** final piece of the session-13 design batch, on top of session 14-15's scheduling. Streak stops driving points; a rolling success-rate multiplier replaces the old flat +5-at-streak-3 bonus.

**Built (all in `js/habits.js`, pure):** `toOccurrenceDate` (local YYYY-MM-DD), `occurrenceSuccess(isNegative, event)` (the polarity seam), `recordOccurrence` (upsert-by-date + trim to window), `removeOccurrence`, `successRate`, `pointsMultiplier`. `applyHabitCompletion`/`applyHabitUncompletion` rewritten and new `applyHabitOverdue` added — each now takes `(streak, occurrenceHistory, isNegative, originalDueDate, config)` and returns the new `occurrenceHistory` alongside the streak/points. `items.js` `completeItem`/`uncompleteItem`/`markAsOverdue` updated to pass `habitDef.occurrenceHistory`/`isNegative` and store the returned history. `resetStreakOnOverdue` retained (streak-only) for any caller that just needs the visual decision.

**Balance change (balance-tuning protocol):** `js/config.js` — ADDED `HABIT_RATE_WINDOW: 14`, `HABIT_RATE_MIN_SAMPLE: 7`, `HABIT_RATE_TIERS: [{minRate:0.9,multiplier:1.5},{minRate:0.7,multiplier:1.25}]` (else 1×). REMOVED `HABIT_STREAK_BONUS_POINTS: 5`. KEPT `HABIT_STREAK_BONUS_THRESHOLD: 3` — repurposed as the visual on-fire/high-streak threshold only (still read by spawning.js/items.js for the sprite class), no longer touches points. `pointsGained = Math.round(POINTS_PER_HABIT × multiplier)` (round: 5×1.25→6, 5×1.5→8; a minor rounding call made here, logged not asked — tunable). Thresholds are legibility placeholders, to be re-tuned against real shop prices once Milestone 3's shop exists.

**Key design decisions:**
- **Occurrence recording points:** success on completion, miss on overdue, upsert-by-date so a late same-day completion overwrites that day's earlier miss ("completed late still counts"). Verified live + unit-tested.
- **Symmetric refund by construction (recompute-then-pop):** uncompletion computes the multiplier from the CURRENT history (which still holds today's success entry that completion added), refunds that, THEN pops the entry — the exact inverse of completion's "append then compute." This is why the old refund-asymmetry bug can't recur; no need to store the awarded points on the item. Live-verified a complete→uncomplete round-trip nets exactly 0 points and restores the prior history.
- **`occurrenceHistory` recording deferred from session 14 lands here** (as planned) — the field was seeded empty in the 2→3 migration; this session fills it.
- **Polarity-ready, not polarity-complete (Jeremy's call):** Jeremy first chose "model negative-habit inversion now," but on surfacing that the real inversion (an "indulged" action, the daily check-in prompt, frozen-slot ties) is the unbuilt ~3-week [P1-DATA-005], and that under today's single-checkbox UI the rate recording is identical for both polarities, he chose "rate bonus now, polarity-ready." So occurrence success routes through the single `occurrenceSuccess(isNegative, event)` seam; P1-DATA-005 later only adds an 'indulged' event there, no rate-math rework. See the two AskUserQuestion exchanges this session.

**Tests:** `test/habits.test.js` — replaced the old streak-bonus blocks (which asserted the removed flat +5 and the now-dissolved asymmetry) with 17 new cases: the pure helpers (record/remove/rate/multiplier incl. below-min-sample and tier boundaries), completion/uncompletion/overdue occurrence recording, and an explicit symmetric-round-trip test. **17 suites, 355/355** (was 338).

**Rejected:** storing the awarded points on the item for exact refund (recompute-then-pop is exact without persisting extra state); recording occurrences inside items.js rather than returning new history from the pure functions (keeps the logic testable in one place); building the negative-habit inversion now (that's P1-DATA-005, multi-session with its own UI).

**Resolves:** the standalone "streak-bonus refund asymmetry" ROADMAP bugfix (dissolved, not patched). **Completes the session-13 design batch** (rate bonus + scheduling both fully built; gradual base regen [P2-GAME-012] remains design-decided/unbuilt).

## 2026-07-18 — Session 15: scheduling step (b) — day-of-week/day-of-month UI BUILT

**Context:** second implementation session off the session-13 design batch, following step (a)'s migration/generators (session 14). Scoped to the UI only — forms and their save handlers, no persistence/generator changes.

**Scope decision (asked Jeremy up front):** all 5 recurring-definition forms in one session (standalone habit create; routine habit create/edit; routine task create/edit) rather than splitting standalone-first — same widget reused across all 5, avoided leaving routine-created items stuck daily-only for another session.

**Field-layout decision (asked Jeremy up front):** Daily and Weekly share ONE day-of-week checkbox row rather than Daily hiding it entirely. Selecting "Daily" auto-checks all 7 boxes (still editable — hand-unchecking one is functionally identical to Weekly with that subset, since `Schedule.isScheduledForDay` doesn't branch on the frequency label for daily/weekly, only for monthly). Selecting "Weekly" clears the boxes ONLY if all 7 were still checked (i.e., coming from the untouched Daily default) — an explicit pick already in progress, or a Weekly↔Monthly toggle, never gets silently wiped.

**Built:**
- **Shared widget, duplicated per file (established convention, not shared across files):** `scheduleFieldsHtml(prefix, schedule)` (builds the Frequency dropdown + day-of-week checkbox row + day-of-month input), `wireScheduleFieldsToggle(prefix)` (show/hide + auto-check/clear on frequency change), `readScheduleFromFields(prefix)` (reads the widget back into a normalized Schedule on submit). One copy in `js/ui/forms.js`, one in `js/ui/routineViews.js` — same "each cluster inlines its own markup" precedent the rest of `js/ui/` already follows. `js/schedule.js` itself stays pure/DOM-free; these are the DOM glue layered on top.
- **5 forms updated:** `createHabitFormHtml` (forms.js); `showCreateHabitForm`/`showEditHabitForm`/`showCreateTaskForm`/`showEditTaskForm` (routineViews.js). Each replaced its old single-option `<select><option value="daily">Daily</option></select>` stub with the shared widget.
- **4 save handlers updated** to read `readScheduleFromFields(...)` instead of a bare frequency string, with client-side "select at least one day" validation for daily/weekly (monthly needs no such check — day-of-month always has a value).
- **Data-layer signature changes:** `createHabitDefinition` (script.js) now takes `scheduleOrFrequency` and calls `Schedule.normalize()` (already handled both shapes) instead of `Schedule.fromLegacyFrequency()`. `createNewHabitInRoutine` (routines.js) now prefers `habitData.schedule`, falling back to `fromLegacyFrequency(habitData.frequency)` for any older caller. `editTaskInRoutine` (routines.js) **gained schedule support it never had** — writes `Schedule.normalize(updatedData.schedule)` if provided, else **preserves the task's existing schedule** rather than resetting to daily (deliberately asymmetric with `editHabitInRoutine`'s frequency-fallback, since routine tasks have no legacy frequency field to fall back to — an absent schedule on an edit call is far more likely to mean "caller doesn't care" than "reset to daily").
- **CSS:** `.days-of-week-checkboxes`/`.day-checkbox` added to style.css, matching the existing `.form-row`/`.priority-row` conventions.

**Tests:** DOM-touching widget functions are NOT unit tested — this repo's Jest config is `testEnvironment: 'node'` (no jsdom), matching the established convention that DOM orchestration is verified by live playtest, not unit tests (see `Spawning.addItemToGame`, ARCHITECTURE.md). Added 9 data-layer cases to `test/routines.test.js` instead: `createNewHabitInRoutine` schedule-preferred-over-frequency (daily, weekly, monthly), `editHabitInRoutine` schedule-preferred, `editTaskInRoutine` writes/preserves/defaults its schedule, `createNewTaskInRoutine` schedule default/override. **17 suites, 338/338** (was 329).

**Live-verified in Chrome:** created a standalone Weekly habit (Mon/Wed/Fri) — dropdown-to-checkbox auto-clear worked, saved schedule matched exactly, correctly did NOT spawn on today (Saturday); created a routine Monthly task (day 18, today's date) via Manage Routine → + Add Task → Create New Task — correctly spawned same-day; edited a session-14-migrated habit (ADSFA, daily-all-7) to Monthly day 5 via its agenda-row pencil — edit form correctly pre-filled the migrated schedule, save persisted the new one, survived a reload. Console clean apart from the pre-existing extension noise throughout.

**Rejected:** sharing the widget helpers across forms.js/routineViews.js via a common module (breaks the "each cluster inlines its own markup" convention for a 3-function helper, adds a load-order dependency for marginal DRY benefit); locking the Daily checkboxes to uneditable (forecloses the "hand-pick a subset while still labeled Daily" case for no real benefit, since the label is cosmetic for daily/weekly generation anyway); resetting `editTaskInRoutine`'s schedule to daily when absent (would silently clobber a custom weekly/monthly pick on any edit that doesn't touch scheduling, since routine tasks have no frequency fallback to reach for).

**Next:** step (c), the rate-based bonus — record into `occurrenceHistory` on completion/overdue (items.js/habits.js), compute the rolling-rate multiplier (habits.js), surface it wherever points are awarded. The scheduling foundation (a+b) is now fully built and live-verified for all three frequency types.

## 2026-07-18 — Session 14: scheduling step (a) — schemaVersion 3 migration + schedule-aware generators BUILT

**Context:** first implementation session off the session-13 design batch. Scope held deliberately to step (a) of the scheduling stack (migration + generators) — persistence-touching, so strict one-system-per-session. UI (b) and rate bonus (c) explicitly out of scope.

**Built:**
- **`js/schedule.js`** (new pure module, loaded after config.js): `defaultSchedule`, `fromLegacyFrequency`, `normalize` (tolerates a bare legacy `frequency` string or partial object), `isScheduledForDay`. Daily & weekly share one day-of-week filter; monthly clamps `dayOfMonth` to the month's last day (31 → Feb 28/29). Matches the DATA_SCHEMA.md `Schedule` design.
- **`persistence.js` `SCHEMA_VERSION = 3`** + v2→v3 migration: habit defs' bare `frequency` string → `schedule` object (+ `frequency` deleted), habit defs seed `occurrenceHistory: []`, routine task defs gain a default daily `schedule`. **Migration written with literal shapes, not by calling schedule.js** — a migration is a historical transform and shouldn't change if the module's logic later evolves.
- **Data layer writes `schedule`:** `createHabitDefinition` (script.js), `createNewHabitInRoutine`/`createNewTaskInRoutine`/`editHabitInRoutine` (routines.js) build it from the form's still-`'daily'` frequency via `Schedule.fromLegacyFrequency`/`normalize`. `editHabitInRoutine` already accepts a full `schedule` object if a future form provides one.
- **Generators gate on schedule:** `Habits.selectHabitDefsToSpawn` (replaced `frequency !== 'daily'`) and `Routines.selectTaskDefsToSpawn` (had no recurrence check — routine tasks previously spawned every active day) now call `Schedule.isScheduledForDay(def.schedule || def.frequency, day)`. The `|| frequency` fallback + `normalize` means an unmigrated in-memory def still gates correctly.
- **One UI read touch-up:** routineViews.js edit-habit form's frequency `<option selected>` state now reads `habitDef.schedule.frequency` (was `.frequency`), so the edit form doesn't break before step (b).

**occurrenceHistory recording DEFERRED to step (c)** (Jeremy's call this session): the field is seeded empty now; the completion/overdue recording that fills it lands with the rate-bonus work, keeping this session's blast radius to persistence+generators and out of items.js/habits.js completion paths. Cost: the multiplier is 1× for the first ~7 occurrences after (c) ships. Accepted.

**Tests:** new `test/schedule.test.js` (daily/weekly/monthly incl. leap-year + short-month clamping); expanded `test/persistence-migration.test.js` with a v2→v3 block + a v1→v3 full-chain case (two old tests that asserted the chain stops at v2 updated to v3 — v2 is no longer terminal); new schedule-gate cases in `test/routine-active-gating.test.js`; `global.Schedule` bound in the four test files whose modules read it. **17 suites, 329/329** (was 302). Live-verified in Chrome against Jeremy's real save: v2→v3 migration ran on load (all 5 habits and the one task def migrated correctly, `frequency` removed, `occurrenceHistory` seeded, schemaVersion 3 re-persisted), daily habits still spawned (5 agenda rows), console clean.

**Rejected:** calling schedule.js from inside the migration (couples a historical transform to evolving logic); doing recording now (over-scopes a persistence session).

## 2026-07-18 — Session 13 (Fable design session): rate-based habit bonus + gradual base regen DECIDED

**Context:** the batched design session recommended in the habits-extraction entry — two open design questions settled with Jeremy in one Fable sitting instead of separate turns. No code written; docs are the deliverable.

**Decision 1 — habit bonus is RATE-BASED; streak becomes visual-only.**
- `streak` keeps its legibility jobs (agenda badge, on-fire sprite at high streak) and loses all economy effect.
- Points bonus = multiplier from rolling success rate over the habit's last **14 scheduled occurrences** (per its `schedule`; success = completed for positive habits, avoided for negative): **≥90% → 1.5×, ≥70% → 1.25×, else 1×**. All numbers config-tunable via the balance protocol; capped at 1.5× by construction. **1× until ≥7 occurrences recorded** (`HABIT_RATE_MIN_SAMPLE`) so a new habit can't instantly max out. **Points only, never XP** — prices into the Milestone 3 shop without accelerating levels.
- Uncompleting flips today's `occurrenceHistory` entry and recomputes — refunds symmetric by construction, which **structurally obsoletes the flat-bonus refund-asymmetry bug** (its ROADMAP fix item is folded into this implementation; the flat +5 goes away entirely).
- Data: `occurrenceHistory: {date, success}[]` on habit definitions, trimmed to the window — ships in the **same schemaVersion 2→3 migration as `Schedule`** (one bump). Implementation order: (a) migration + generators, (b) scheduling UI, (c) rate bonus.
- **Rejected:** keeping the flat streak-≥3 +5 (unbounded-feeling, one miss zeroes it — abandonment driver); MECHANICS.md's never-built probabilistic double points (random rewards tune badly and feel unfair in a productivity tool).
- Multiplier curve gets re-examined against real shop prices once Milestone 3's shop exists — the thresholds are placeholders chosen for legibility (90/70), not tuned economy values.

**Decision 2 — base healing is GRADUAL REGEN (resolves the 2026-07-17 open question).**
- 1 HP per 5 min (`BASE_REGEN_HP`/`BASE_REGEN_INTERVAL_MS`) continuously while the run is alive, clamped at 100. Offline time heals at the same rate, applied on restore **after** offline overdue damage is back-charged (net: quiet base recovers overnight, neglected base doesn't). Repair kits stay as spec'd — instant mid-run heals, the paid "now" lever over the free slow climb.
- **0 HP remains run-over** (`gameOver()`, already live). PROJECT_SPEC's "healing disabled at 0 until repair kit" clause is thereby moot — 0 is death, not a state. New Base = new run at full HP, unchanged.
- **Rejected:** daily full reset (MECHANICS.md's old line) — wipes the meaning of overnight damage every midnight, gutting the offline lifetime-cap design (2026-07-17 Fable decision), and makes all three repair-kit tiers pointless free-alternative purchases; hybrid regen+partial-reset — two overlapping forgiveness systems to tune for no added design expression.
- Regen interacts with live overdue damage as opposing rates (net -0 with one overdue item at current numbers — worth watching in playtest once built; tunable).

**Docs updated this session:** MECHANICS.md (Base, Habits/streaks, offline-healing note, Open Questions pruned), ECONOMY.md (points bonus line, repair-kit note), DATA_SCHEMA.md (Habit.occurrenceHistory + streak annotation), ROADMAP.md (design item checked; scheduling item extended; asymmetry bugfix superseded; P2-GAME-012 annotated).

## 2026-07-18 — Session 12: `js/loop.js` extracted + final cleanup; the `<300 lines` goal revised, not met

**Decision 1 — extract the game loop.** `updateGame` (the setInterval callback) and `updateActiveItems` (position/overdue/damage sweep) moved to `js/loop.js` behind a single `loopDeps()` — they were the last real game logic in script.js. `lastLoopTickMs`/`lastAutosaveMs` cross as get/set pairs (damage.js precedent); `activeItems` as a plain reference (safe because loopDeps() is rebuilt every tick). `test/loop.test.js` (13 cases) runs the real module — suite now **16 suites, 302/302**.

**Decision 2 — revise the `<300 lines` goal instead of chasing it.** Fresh inventory: script.js (1,244 → **1,141** lines) is now ~90 thin wrappers + the deps builders, plus DOM consts and event wiring — which IS the "boot/wiring only" target state. The wrappers exist by design (every extraction's "call sites unchanged" rule); retiring them is the already-deferred state-ownership migration (see session 11 entry), not a cleanup. Sub-300 was written before the deps pattern existed. ARCHITECTURE.md and UI_EXTRACTION_PLAN.md updated; the migration remains its own future session (good early-Milestone-3 candidate).
**Rejected:** starting the ownership migration in the same session (stacks a persistence-risk change onto a cleanup pass; violates one-system-per-session for exactly the category it exists for).

**Cleanup performed:** deleted the 53-line "SUBTASK CREATION CALL CHAIN MAP" comment (every line number stale; superseded by ARCHITECTURE.md); deleted `getTodayAt5PM` (dead — zero callers repo-wide); removed the FAB debug console.log block (listener kept, now one line); removed three now-unused CONFIG aliases (GAME_TICK_MS/OVERDUE_DAMAGE/DAMAGE_INTERVAL_MS — loop.js reads CONFIG directly; state.js already did).

**UI_EXTRACTION_PLAN.md formally CLOSED** (closure note added at top, including the session-10 rescope history its own rows never reflected).

## 2026-07-18 — Session 11: `js/state.js` extracted (game lifecycle/persistence orchestration); ownership migration deliberately deferred

**Context:** session 11 of the items/state split (see the entry below). Extracted `initGame`, `restoreGameState`, `getPersistableState`, `saveGame`, and `damageDeps` (renamed `buildDamageDeps` in the module) into `js/state.js`, via a single `stateDeps()` in script.js — the same accessor-injection pattern every prior module uses. script.js down to **1,244 lines** (was 1,346).

**Design fork surfaced and resolved before coding:** `docs/ARCHITECTURE.md`'s target layout describes `state.js` as *"central state + mutation functions (only place state changes)"* — i.e. this module OWNING the state variables (`baseHealth`, `playerXP`, `activeItems`, etc.), not just the functions that mutate them. Every prior extraction instead left ownership in script.js and reached in via accessor deps (established by damage.js, extended by items.js). `initGame`/`restoreGameState` touch nearly every state variable in the game, so this was the first session where the two visions genuinely collided.

**Decision (Jeremy's call, after discussion): hybrid — extract the functions now via the deps pattern; explicitly defer the ownership migration, logged here rather than silently dropped.** Reasoning:
- Combining "extract the functions" with "migrate where state physically lives" in one session stacks two risky changes onto the exact module that guards a real player's save data — the module the session 10 handoff flagged as needing extra care.
- The ownership migration turned out to be lower-risk than it first looked, which is WHY it's safe to defer confidently rather than being pressured into doing it now: every other module (damage.js, items.js, spawning.js, etc.) already receives **accessor functions** (`getPlayerXP: () => playerXP`), never the raw `let` bindings directly. So relocating the actual storage into a `State` object later only touches script.js's own reads/writes and its `*Deps()` builders — it does NOT ripple into any other module. That makes it a clean, contained, single future session (candidate: session 12, or early Milestone 3) rather than a big-bang rewrite.
- Discussed and reaffirmed the "one system per session" guardrail itself in this conversation — conclusion: still worth keeping as the default, especially for anything touching persistence or architecture (this session is the textbook case for why), but fair to relax for batches of genuinely small/independent work (e.g. a few doc/test cleanups) where the original context-window concern doesn't really apply with current model capability. **Update, same session:** Jeremy confirmed — CLAUDE.md's Guardrails section now says so explicitly: strict one-per-session stays mandatory for persistence/architecture/balance work (blast radius + human playtest bandwidth, not a model-capability problem), but small independent batches no longer need their own session.

**State:** ✅ 15 suites, 289/289 passing in the sandbox (no count change — orchestration code, same as items.js). `node --check` clean on script.js and state.js. **Live-verified in Chrome** against Jeremy's real save via the Claude in Chrome extension: page load correctly ran `initGame()` → `restoreGameState()` through the new module (Health/XP/Level/Points matched the exact values session 10 left them at); completed "ZZTest Standalone Habit" (XP/Points 15→20, removed from active list); reloaded the page and confirmed the completion persisted exactly (5 tasks, XP/Points still 20, sprite positions rebuilt correctly, no duplicate/missing items) — the full save → reload → restore cycle this session was flagged as needing extra verification on. Console showed only the pre-existing extension "message channel closed" noise, same timestamp before and after reload (nothing new).

**Alternatives rejected:** full ownership migration in this session (rejected — too much change stacked on the persistence-critical module, violates one-system-per-session for no urgent reason); doing nothing about the ARCHITECTURE.md mismatch (rejected — would leave a documented target silently unmet with no record of why or how to close the gap).

---

## 2026-07-18 — Session 10 rescoped mid-session; `js/items.js` extracted (item/task/habit completion lifecycle)

**Context:** session 10 was supposed to be the UI plan's final line — "script.js reduced to boot/wiring (<300 lines)." A fresh Grep at session start (per the Session Protocol) found ~700-800 lines of core game logic still directly in script.js that the 11-session UI plan (docs/UI_EXTRACTION_PLAN.md, clusters A-G, all DOM-rendering) never touched: item/task/habit completion lifecycle (`completeItem`, `removeItem`, `uncompleteItem`, `markAsOverdue`, `recomputeOverdueStateAfterEdit`, `createTaskItemData`) and game init/persistence orchestration (`initGame`, `restoreGameState`, `getPersistableState`/`saveGame`). This is `state.js`/item-lifecycle scope from `docs/ARCHITECTURE.md`'s target layout — planned in the target architecture from the start, just never scheduled into a session.

**Decision (Jeremy's call): extract it now rather than defer** — "we might as well extract core logic now if we are going to need to do it later." Split across three sessions to preserve the one-system-per-session rule that's held for all nine prior sessions:
- Session 10 (this one): `js/items.js` — item/task/habit completion lifecycle. Most self-contained (touches `activeItems`/`completedItems`/player stats only, no game-loop timing), highest value (never delegated anywhere before now).
- Session 11 (planned): `state.js` — game lifecycle/persistence orchestration. Sequenced after items.js deliberately since it's higher-risk (everything else depends on it).
- Session 12 (planned): final wiring cleanup, re-verify the `<300` line goal, formally close `docs/UI_EXTRACTION_PLAN.md`.

ROADMAP.md and ARCHITECTURE.md updated same session to reflect the rescoped plan (see ROADMAP.md's Milestone 2 UI-extraction section).

**`js/items.js` extraction itself:** moved `completeItem`, `removeItem`, `uncompleteItem`, `markAsOverdue`, `recomputeOverdueStateAfterEdit`, `createTaskItemData` behind a single `itemsDeps()` (script.js), following the same deps-injection pattern as every prior extraction. Notable dependency choices: `playerXP`/`playerPoints` get get/set accessor pairs (`getPlayerXP`/`setPlayerXP`, `getPlayerPoints`/`setPlayerPoints`) — this is only the second module (after `js/damage.js`'s `baseHealth`/`gameIsOver`) to WRITE script.js-owned numeric state, same reasoning: ownership stays in script.js, the module just gets read/write access via accessors rather than the state moving. `activeItems` stays a plain reference (agendaListDeps() "stable binding" precedent); `completedItems`/`definedHabits`/`gameIsOver` are getters (reassigned elsewhere / handlers outlive the call, matching established precedent). `Habits` and `CONFIG` are called as bare stable globals inside `js/items.js` itself, matching the CONFIG/Clock/Modal/Routines convention.

**FLAGGED, NOT FIXED:** `uncompleteItem` hand-builds the enemy sprite DOM element (classes, dimensions, click handler) from scratch instead of reusing `Spawning.addItemToGame`/`resolveEnemyVisual`, which already do this correctly and are the only other place this construction happens. This is pre-existing duplication (not introduced by this extraction — verified by diffing against the pre-session code), extracted verbatim. Consolidating the two is a real, separate refactor: `addItemToGame` pushes into `activeItems` itself, which `uncompleteItem` also does manually, so reconciling them needs its own careful session, not a drive-by fix bundled into this code-motion session.

**Result:** script.js down to **1,346 lines** (was 1,608). 15 suites, 289/289 passing (no new tests — same as most non-pure-math extractions; the moved code is DOM+state orchestration, not isolated pure logic). `node --check` clean on both files. Live-verified in Chrome: habit complete/uncomplete round-tripped XP/points exactly; editing an overdue task's due date into the future correctly un-overdue'd it (sprite moved off the base, agenda row lost its red border); a newly-created task spawned correctly end-to-end through `createTaskItemData` → `addItemToGame`.

**Alternatives rejected:** doing all three sessions' worth of extraction in one giant session, since Jeremy's answer conditionally endorsed doing it "now" — rejected because the one-system-per-session guardrail has prevented exactly the kind of context-window failure this project's memory system was built to avoid (see CLAUDE.md's Guardrails), and this rescoped work is large enough that folding it into one session would recreate that risk.

---

## 2026-07-18 — UI extraction session 9: `routineViews.js` complete; `window.save*` handlers kept as window-scoped wrappers

**Context:** session 9 of `docs/UI_EXTRACTION_PLAN.md` — the form half of cluster F, completing `js/ui/routineViews.js` (part 2 of 2). Fresh Grep against script.js confirmed the plan's function inventory was still accurate for this row (unlike sessions 3 and 8, no stale lines found this time) — line numbers had simply drifted, membership hadn't.

**Moved:** `showCreateHabitForm`/`showCreateTaskForm`/`showEditHabitForm`/`showEditTaskForm` (pure HTML-string builders, take no deps), `showAddItemToRoutineModal`, `attachRoutineManagementListeners`, `populateHabitSelectDropdown`, and `saveNewHabit`/`saveNewTask`/`saveEditedHabit`/`saveEditedTask`.

**Decision: the four `save*` handlers stay `window.*` in script.js, not plain-function thin wrappers.** Every other session's UI-extraction wrapper is a plain function (`function showX() { Module.showX(deps); }`), but the create/edit habit and task forms this same session builds contain inline `onclick="saveNewHabit('${routineId}')"` etc. — those strings execute in global scope, so the handler must resolve via `window.saveNewHabit`. Kept the existing `window.saveNewHabit = function(routineId) { RoutineViews.saveNewHabit(routineId, routineViewsDeps()); }` pattern already established for `window.closeModal`/`window.deleteRoutine`/`window.toggleFabMenu`, etc. — the underlying implementation still lives in `js/ui/routineViews.js`; only the script.js-side exposure differs from a bare function.

**Also this session — part 1's six plain-function deps became module-internal calls.** Now that `showEditHabitForm`, `populateHabitSelectDropdown`, `showCreateHabitForm`, `showEditTaskForm`, `showCreateTaskForm`, and `attachRoutineManagementListeners` all live in `js/ui/routineViews.js`, `renderDefinedRoutines` and `showRoutineManagement` (session 8) call them directly instead of via `deps.*`. `routineViewsDeps()` in script.js dropped those six keys and gained: `managementWindows`/`populateRoutinesWindow` (the routine-status-toggle refresh, needed by `attachRoutineManagementListeners`), `saveGame`, `createNewHabitInRoutine`/`createNewTaskInRoutine`/`editHabitInRoutine`/`editTaskInRoutine` (the four save handlers' actual mutation logic — still script.js/routines.js-scoped, unaffected by this session), and `activeItems`/`createListItem`/`sortAndRenderActiveList` (only `saveEditedHabit` needs these, for its live-instance-sync side effect).

**`activeItems` passed as a plain reference, not a getter**, despite the module's header note that `definedRoutines`/`definedHabits` need getters because they're reassigned elsewhere. Followed `agendaListDeps()`'s existing precedent instead (session 6-7's DECISIONS.md entry): `activeItems` is documented there as a "stable binding" even though it IS reassigned on new-game reset, and that precedent is now depended on by multiple modules (agendaList.js, and now routineViews.js) — revisiting whether it should actually be a getter is a cross-cutting question bigger than this one extraction, not something to silently diverge on here.

**`Modal.closeModal()` called as a bare stable global** throughout the newly-moved code (replacing the closure's bare `closeModal()` identifier), matching popups.js/forms.js's established convention for calling a fully-extracted module directly rather than threading it through deps.

**Result:** `js/ui/routineViews.js` is now complete (979 lines) and script.js is down to **1,608 lines** (was 2,038) — under half its pre-Milestone-2 peak. `node --check` clean on both files. 15 suites, 289/289 passing in the sandbox (no count change — pure code motion, same as most UI-cluster sessions, matching session 8's precedent).

**Alternatives rejected:** converting the inline `onclick="saveNewHabit(...)"` strings to real `addEventListener` calls while already touching this code (which would let the four handlers become plain functions like everything else) — rejected as scope creep; the standing hazard note in `docs/UI_EXTRACTION_PLAN.md` explicitly allows this "when a session is already rewriting the markup," but this session didn't need to touch the markup, only move existing logic, so converting it would be an unrelated behavior-preserving refactor bundled into an extraction session.

---

## 2026-07-18 — UI extraction session 8: `renderDefinedRoutines` is dead code; plan's `populateRoutinesWindow` line was stale

**Context:** session 8 of `docs/UI_EXTRACTION_PLAN.md` targets cluster F's rendering half. Two discoveries while executing it, neither fixed (out of session scope):

**1. The plan's session-8 row lists `populateRoutinesWindow` as part of this extraction, but it was already moved into `js/ui/managementWindows.js` during session 3 (cluster E) — script.js's copy is already a thin wrapper over `ManagementWindows.populateRoutinesWindow`.** The plan's per-session function inventory was written before session 3 ran and never updated afterward. Nothing to do here except note the correction; not a bug, just stale planning-doc bookkeeping.

**2. `renderDefinedRoutines` is dead code.** It targets `document.getElementById('definedRoutinesList')`, and no element with that id exists anywhere in current `index.html` — confirmed by Grep (case-insensitive, zero matches) and by live Chrome verification (called it via 8 script.js call sites during normal routine CRUD, zero visible effect, zero console errors — it always hits its own `if (!definedRoutinesListUL) return` guard and no-ops). The id is a holdover from the pre-modal routine UI; the live game exclusively uses the modal-based `routinesWindowList` (`ManagementWindows.populateRoutinesWindow`) and the `Manage Routine` modal (`RoutineViews.showRoutineManagement`, this same session), neither of which touches `#definedRoutinesList`.

**Decision:** extracted `renderDefinedRoutines` into `js/ui/routineViews.js` verbatim (same dead-on-arrival guard clause) rather than deleting it or its 8 call sites — a behavior-identical move, consistent with every other session's rule not to fix unrelated things mid-extraction. Logged as a cleanup candidate rather than scheduled, since deleting dead code found incidentally during an unrelated extraction risks scope creep the guardrails specifically warn against (see session 0's `showForm` precedent, which WAS scheduled as its own session rather than folded in).

**Also this session:** `definedRoutines`/`definedHabits` cross into `js/ui/routineViews.js` as getters (same reassignment-elsewhere rule as agendaList.js part 2, session 7's DECISIONS.md entry). `definedTasks` needed no getter at all — Grep confirmed it has no local script.js declaration whatsoever (every reference, including script.js's own, is the bare `window.definedTasks` global), so the module reads it directly with zero staleness risk, matching how CONFIG/Clock/Modal/Routines are already treated as bare globals elsewhere in `js/ui/`.

**Alternatives rejected:** deleting `renderDefinedRoutines` and its call sites now, since it's provably inert — rejected because "provably inert" still needs its own verification pass across all 8 call sites' surrounding logic (some may have side effects beyond the render call itself), which is exactly the kind of scope creep this project's one-task-per-session guardrail exists to prevent.

---

## 2026-07-18 — UI extraction session 7: mirror test retired (Jeremy's call); agendaList.js complete

**Context:** session 6 deliberately left `test/create-list-item-branching.test.js` (the hand-maintained mirror of `createListItem`'s branch structure) in place, flagging the retire/keep decision for session 7 since `test/agenda-list.test.js` now requires and executes the real module. Jeremy's call this session: retire it if it has no unique coverage left.

**Decision:** confirmed no unique coverage — every case the mirror guarded (task/habit/unknown-type branching, editor wiring, overdue-class derivation including the REBUILD case, high-priority+overdue coexistence) is covered by `test/agenda-list.test.js` against the real module, which is strictly stronger evidence. Deleted `test/create-list-item-branching.test.js`. Suite went from 16 suites/298 tests to 15 suites/289 tests (the 9 retired tests, all superseded).

**Session 7 scope:** extracted the rest of `js/ui/agendaList.js` — `sortAndRenderActiveList`, `resetAllSubTaskCheckboxes`, `renderCompletedItems`, `showEditHabitInstanceModal` — completing the cluster. `completedItems` and `definedHabits` cross into the module as GETTERS (`deps.completedItems()`, `deps.definedHabits()`), extending session 6's getter-for-outliving-handlers rule to a related but distinct case: both are variables REASSIGNED elsewhere in script.js (new-game reset, restoreGameState), so a plain reference captured at deps-build time could go stale after either happens, even though `agendaListDeps()` is rebuilt fresh on every call (the getter guards against a future caller that doesn't rebuild fresh, and is consistent with the existing `isGameOver`/`activeItems` split). No new tests added this session — matches sessions 1-5's precedent for pure code-motion with no new behavioral decision (session 6 was the exception, because the getter behavior itself was new).

**Bug found during live verification, NOT fixed here (pre-existing, not a regression from this extraction):** uncompleting an item (`uncompleteItem`) reuses the item's stale `listItemElement` object rather than rebuilding it, so if that row's "Mark as Complete" checkbox was left checked (which it always is — checking it is literally what triggers completion), the row re-enters the active list still visually checked until the next full rebuild (page reload, or any edit that removes+recreates the row). Confirmed cosmetic only: the underlying save data round-trips correctly (XP/points/task-count all returned to baseline exactly after complete → uncomplete in this session's live check). Not scheduled — logged in ROADMAP's Known bugs.

**Alternatives rejected:** keeping the mirror "just in case" — rejected per the same reasoning as session 6's write-up: a regression test for a copy, not the shipped code, isn't worth maintaining once real coverage exists, and keeping dead test infrastructure around adds exactly the kind of context weight this project's docs system exists to avoid.

---

## 2026-07-18 — Date/time input pre-fill must use local getters, never toISOString (UTC pre-fill bugfix)

**Context:** session 6's live verification found that `showEditTaskModal` and `createSubTaskPrompt` (`js/ui/popups.js`) pre-filled their date/time `<input>`s from `dueDateTime.toISOString()` (UTC wall-clock), while the Save handler parses `` new Date(`${date}T${time}`) `` — which is LOCAL time. In CDT that displayed a 12:00 PM task as 05:00 PM, and an untouched Save shifted the stored due time forward by the UTC offset (rolling the DATE for evening tasks). Silent data corruption, trivially triggerable; jumped the queue ahead of UI-extraction session 7 (Jeremy's call, 2026-07-18).

**Decision:** anything that round-trips a Date through an `<input type="date">`/`<input type="time">` value must format from local getters. Added `formatDateInputValue` (YYYY-MM-DD) and `formatTimeInputValue` (HH:MM) inside popups.js, exposed on the module return for tests. The invariant, pinned by `test/popups-prefill.test.js` (12 tests): format-then-reparse reproduces the original instant exactly in every timezone (the old code only satisfied this at UTC offset 0 — which is why the sandbox's UTC test environment could never have caught it; the suite includes a negative control asserting the old approach's drift equals `getTimezoneOffset()`).

**Scope note (flagged, same family):** `js/ui/forms.js` `createTaskFormHtml` had the same pattern for the create-task default date — latent for Jeremy (correct in all negative-offset TZs), wrong (yesterday's date) in positive-offset TZs. Fixed with the same one-liner in this session rather than left as a scheduled bug, since it is the identical root cause and two lines. NOT touched: `js/TaskManager.js` ~317-318 (same stale pattern, but that file is the abandoned parallel extraction — popups.js is the live sub-task path; fixing dead code invites divergence questions better handled when TaskManager.js is retired) and `script.js:456`'s UTC date-string comparison in due-date validation (validation-only, no corruption; needs its own look).

**Alternatives rejected:** (a) *Parse the save-side string as UTC instead* — would "fix" the round-trip while making every displayed and entered time UTC, diverging from the agenda row's `toLocaleString()` and from user intent. (b) *A shared js/ui/dateInputs.js module* — two 3-line formatters don't justify a new file plus load-order wiring; revisit if a third consumer appears.

## 2026-07-18 — UI extraction session 6: live state reaches extracted UI modules as getters when handlers outlive the call

**Context:** UI extraction sessions 3, 4 and 5 all used the same dependency shape — a `<module>Deps()` helper in script.js returning a plain object, snapshotted at call time and read immediately inside the same tick. That is correct for those clusters: `handleEnemyClick` reads `deps.gameIsOver` and returns; `showFormModal` builds a modal and returns. Nothing survives the call.

`createListItem` (session 6) is the first UI extraction where that assumption breaks. It ATTACHES EVENT HANDLERS THAT OUTLIVE THE CALL: the "+ Sub-task" button's click handler reads the game-over flag whenever the user eventually clicks it, which may be minutes after the row was built. `gameIsOver` is a mutable `let` in script.js's closure, flipped by `setGameOver()`. Captured as a flat boolean in a deps snapshot, the handler would read the value as of RENDER time forever — so every row rendered before game-over would keep accepting new sub-tasks after the base fell, while rows rendered afterward would correctly refuse. A silent, state-dependent inconsistency, and precisely the shape of the three prior "createListItem family" bugs (row renders against stale state rather than current state).

**Decision:** live, mutable script.js state crosses into an extracted UI module as a GETTER (`isGameOver: () => gameIsOver`) whenever the module attaches handlers that outlive the call. Applied here to `gameIsOver`. Stable bindings — `activeItems` (mutated in place, never reassigned) and `categoryStyles` (a `const` object) — stay plain references, since a captured reference always observes current data.

This is not a new convention so much as a consistently-applied one: `js/spawning.js` already passes `isGameOver: () => gameIsOver` for the same reason. Sessions 3-5's flat booleans remain correct for their clusters and are NOT being retrofitted — the rule is about handler lifetime, not about the flag.

**Verified, not assumed:** `test/agenda-list.test.js` pins this down with a test that builds a row while the game is live, fires the button, flips the flag, and fires again. Temporarily reverting the module to a flat boolean fails that test and only that test (checked during the session), so the test genuinely has teeth rather than passing vacuously.

**Alternatives rejected:** (a) *Flat boolean, accept the staleness* — a real behavior regression against the original inline code, which read the live closure variable. (b) *Re-call `agendaListDeps()` inside each handler* — rebuilds the whole deps object on every click to refresh one field; more allocation and more indirection for less clarity. (c) *Pass the whole script.js state object through* — recreates the closure across files, which ARCHITECTURE.md's refactor rules explicitly forbid.

---

## 2026-07-18 — UI extraction session 6: extracted UI modules get real unit tests, not hand-maintained mirrors

**Context:** `test/create-list-item-branching.test.js` (2026-07-18) is a hand-written MIRROR of `createListItem`'s branch structure rather than a test of the function itself. Its own header explains why: script.js has no `module.exports`, everything lives in one `DOMContentLoaded` closure, so the real function could not be `require`d. The same convention was followed in `test/subtask-creation.test.js`. Mirrors catch structural regressions in the copy, not in the shipped code — they can pass while the real function is broken.

**Decision:** now that `createListItem` lives in `js/ui/agendaList.js` with a real `module.exports`, the reason for mirroring is gone, and session 6 added `test/agenda-list.test.js` (16 tests) which `require`s and EXECUTES the actual module against a minimal `document` stub — including firing the registered click/change listeners. Going forward, extracted UI modules get tests against the real module; new mirrors should not be written.

**Not done — deliberately:** the existing mirror file was NOT deleted or rewritten. It still guards the branch structure, and removing a regression test for the project's most bug-prone function should be its own considered decision, not a side effect of an extraction session. Flagged in HANDOFF for session 7, which owns the rest of agendaList.js.

**Why this matters beyond tidiness:** the UI extraction plan's standing hazards note says UI clusters are "less unit-testable than logic extractions" and that sessions should "expect to lean on `node --check` plus Jeremy's live smoke test more than on Jest." Sessions 1-5 each added zero tests on that basis. Extraction turns out to be what MAKES these testable — the untestability was a property of the monolith, not of UI code.

---

## 2026-07-18 — UI extraction session 4: reconciled the routine-creation inline duplicate; routine creation now saves immediately

**Context:** flagged back in the routines.js extraction (2026-07-18) and again in the UI extraction planning session: `createRoutineFormHtml`'s modal handler (inside `attachModalEventListeners`'s `case 'routine':` branch) built a new routine object inline — same id format and fields as `Routines.createRoutineDefinition`, but duplicated rather than calling it, and missing that function's implicit reliance on the caller adding `saveGame()`. The other call site (`script.js`'s standalone `createRoutineDefinition()` wrapper, tied to the dead `routineNameInput`/`createRoutineButton` legacy inputs deleted in session 0) already called `saveGame()` correctly but is itself unreachable dead code — confirmed by Grep (`document.getElementById('routineName')` returns null; no listener ever fires it).

**Decision:** during session 4's extraction into `js/ui/forms.js`, replaced the inline object construction with a direct call to `Routines.createRoutineDefinition(name, definedRoutines)` — same validation order, identical alert copy for both failure reasons ('empty' → "Please enter a routine name.", 'duplicate' → "Routine name already exists."), identical routine shape. Added `deps.saveGame()` right after the push, before `closeModal()`.

**This is a real, if minor, behavior change, not a pure code-move:** routine creation via the FAB modal previously relied on the 5-second autosave timer to persist a newly created routine; now it saves immediately on creation, matching how every other creation path in the game already behaves (tasks, habits, and routine-scoped habits/tasks all call `saveGame()` at their creation call sites). Flagging explicitly per the "never change behavior silently" guardrail, even though the change is a bugfix-shaped improvement rather than a balance change.

**Alternatives rejected:** (a) *Leave the duplicate as-is, extract verbatim* — would have carried the known duplication and missing-save bug into `js/ui/forms.js` unchanged, contradicting the plan's explicit call to reconcile it in this session. (b) *Fix the OTHER (dead) `createRoutineDefinition()` wrapper instead* — pointless, that code path is unreachable; the modal system is the only way routines are actually created in the live game.

**Not touched:** the dead `routineNameInput`/`createRoutineButton`/script.js `createRoutineDefinition()` trio remains in script.js, unreachable, exactly as session 0 left it. Removing dead code is a separate decision from this session's reconciliation — noted, not acted on.

---

## 2026-07-18 — UI extraction planned as 11 sessions, not one; and the dead legacy inline form system will be deleted

**Context:** the last unchecked Milestone 2 extraction was a single ROADMAP line, "Extract UI: forms, agenda list, popups, FAB menu". Mapping it (Grep only — script.js never read whole) found it covers **~2,500 lines across seven clusters**, including two functions over 260 lines each (`createListItem` 268, `attachModalEventListeners` 366) and a routine-UI cluster of ~854 lines. That is many times the size of any prior extraction and exactly the kind of scope that caused the July 2025 context failures.

**Decision 1 — sequence it into 11 single-system sessions.** Full map, line ranges, per-session scope and hazards live in the new `docs/UI_EXTRACTION_PLAN.md`; ROADMAP.md now lists the sub-items in order. Order is foundation-first, then smallest/lowest-risk, then the two monsters (`createListItem`, routine UI) last.

**Decision 2 — `js/ui/modal.js` comes first, before any feature cluster.** `closeModal` is currently defined as `window.closeModal` at script.js ~2671, buried inside the routine edit-form code, yet **all 18 inline `onclick="closeModal()"` sites** span five different clusters. Extracting any cluster before it would make that cluster depend on routine code. The same session adds a helper for the `window.*` exposure that inline `onclick=` requires — making systematic what the `deleteRoutine` bug earlier today showed is currently ad-hoc and easy to forget.

**Decision 3 — delete the legacy inline form system (Jeremy's call).** The `showForm` duplicate/shadowing bug flagged 2026-07-17 turns out to be bigger than a shadowing bug: it's masking an entire dead second UI.
- Both `showForm` declarations sit in the same `DOMContentLoaded` scope; declarations hoist, so the 5-line legacy stub (~3541) shadows the real 28-line implementation (~423). `showForm('task')`/`showForm('habit')` are silent no-ops, including `initGame`'s call at line 172.
- The real `showForm`'s button logic was inert regardless — `showTaskFormButton`/`showHabitFormButton`/`showRoutineFormButton` **do not exist in index.html** at all.
- The only reachable creation path is the modal system (FAB → `showFormModal` → `attachModalEventListeners`).
- The inline form markup nevertheless still exists in index.html (151, 191, 249), and the `addTaskButton`/`addHabitButton` listeners (~3419/~3451) still run and still call `clearFormInputs()` — a half-connected second way to create items.

So ~150 lines of script.js plus ~100 lines of index.html markup get removed as session 0, **before** extraction starts, so dead code isn't carried into `js/ui/`.

**Why delete rather than revive:** the modal system is complete, wired to the FAB, and is what Jeremy actually plays with; the inline system is missing its own toggle buttons and has been unreachable for an unknown length of time (confirmed pre-existing in `git show HEAD:script.js` back on 2026-07-17). Reviving it would mean *adding* markup to resurrect a UI nobody has used, then maintaining two paths.

**Alternatives rejected:** (a) *Revive the inline forms and demote the modals* — much larger change, would require adding the missing toggle buttons to index.html, and inverts the system Jeremy has been playtesting. (b) *Leave the legacy code and extract around it* — keeps this planning session smaller but guarantees dead code lands in `js/ui/` and blocks the `<300 line script.js` goal. (c) *Four coarse sessions instead of eleven fine ones* — fewer commits, but each session would be large enough to risk the context blowups the one-system-per-session rule exists to prevent.

**Not done this session:** no code was changed. This was planning only.

## 2026-07-18 — bugfix: standalone habits never spawned; habits gain `routineId`; schemaVersion 1→2

**Bug (reported live by Jeremy):** a habit created outside a routine — the FAB → "Add New Habit" path — produced no sprite and no agenda row. Nothing about it appeared in the game.

**Root cause (pre-existing, unrelated to the same-day session 0 deletion):** `Habits.selectHabitDefsToSpawn` opened with `if (!activeRoutineHabitIds.has(habitDef.id)) return false;`, where the set was built only from habits belonging to a currently-`isActive` routine. A standalone habit is in no routine, so it failed unconditionally. This came from the 2026-07-18 isActive-gating session, whose DECISIONS entry states the intent was to make *orphaned* definitions inert — standalone habits were never considered, and a standalone habit is indistinguishable from an orphaned one in the v1 data (neither is referenced by any routine).

**Fix:** habit definitions now carry `routineId` (null = standalone), which `docs/DATA_SCHEMA.md`'s target `Habit` shape **already specified** — the live schema just never got the field. Gating is now: a habit with no owning routine spawns on its own; a habit with one spawns only while that routine is active.

Ownership is resolved from BOTH `routine.habitDefinitionIds` and `habitDef.routineId`, deliberately:
- The two representations can't silently disagree.
- Membership is many-to-many today (`addHabitToRoutine` permits a habit in several routines) while `routineId` names a single owner — checking both preserves the existing "shared by an active and an inactive routine still spawns" behavior that a `routineId`-only check would have quietly broken. This was caught by an existing test, not by inspection.
- A dangling `routineId` (its routine was deleted) resolves to standalone rather than leaving a habit that's listed in the Habits window but can never spawn.

**Write paths updated:** `createHabitDefinition` (standalone, null), `Routines.createNewHabitInRoutine` (stamps the owning routine), `Routines.addHabitToRoutine` (adoption transfers ownership), `Routines.removeHabitFromRoutine` (releases to standalone — signature gained `definedHabits`), and the inline duplicate of add-to-routine inside `showAddItemToRoutineModal`, which bypasses `Routines.addHabitToRoutine` entirely (flagged again for session 4 of UI_EXTRACTION_PLAN.md, which reconciles these duplicates). `removeHabitFromRoutine`'s script.js wrapper also gained a missing `saveGame()`.

**Decision — removing a habit from a routine releases it to STANDALONE (Jeremy's call):** it keeps its streak and resumes spawning daily. This deliberately supersedes the isActive-gating session's "orphaned definitions stay inert" decision, which predates standalone habits being distinguishable at all. Rationale: the Habits window lists every habit, so an inert-but-listed habit is exactly the invisible-yet-present state that produced this bug report. **Rejected:** keeping orphans inert via a third state (most faithful to the prior decision, but preserves the confusing UX); deleting the definition outright on removal (cleanest data model, but destroys the streak and overloads what the Remove button means).

**Migration (schemaVersion 1 → 2, Jeremy's call):** infers `routineId` from existing routine membership rather than defaulting everything to standalone — a habit listed in some routine's `habitDefinitionIds` is owned by it, anything unreferenced is standalone. Defaulting all to standalone would have detached genuinely routine-owned habits and made them spawn regardless of routine state. The migration is idempotent (never overwrites a `routineId` that's already set, including an explicit `null`, so it won't re-link a deliberate orphan). `Persistence.migrate` is now exported for tests, matching the existing `serialize`/`deserialize` convention.

**Tests:** 26 new cases — 9 gating cases in `test/routine-active-gating.test.js` (standalone spawns with routines inactive / absent / legacy-shaped; orphaned and dangling-routineId cases; membership-only and routineId-only gating), 6 ownership-transfer cases in `test/routines.test.js`, and a new `test/persistence-migration.test.js` (11 cases). One existing test was intentionally reversed — it asserted "a habit not attached to any routine is inert", which is precisely the bug; its replacement documents why.

**Verified live in Chrome against Jeremy's real save:** migration ran (v1→v2), his two standalone habits (`ADSFA`, `njgsgj`) correctly inferred to `routineId: null` and now render, his routine habit (`dfaSDF`) correctly linked to its routine. A newly created standalone habit spawned with 1 active instance, an agenda row, and a sprite. Gating re-checked both ways on the real data: standalone habits spawn whether routines are active or not; the routine habit spawns only while its routine is active.

**Incidental finding worth remembering:** mid-verification the save flip-flopped between v2/4-habits and v1/3-habits. Cause was a SECOND Deadline tab open on the old cached code, whose 5s autosave repeatedly clobbered the migrated save. Not a code bug — but a real hazard for this app generally: two tabs share one localStorage key with no coordination, and the older tab wins whenever it autosaves last. Worth considering a tab-coordination or save-generation guard if it recurs.

**Full suite:** 270 passing, 0 failing (244 prior + 26 new). Run under a minimal Jest-compatible harness (`describe`/`test`/`expect`/`jest.fn`/`spyOn`/`test.each`/asymmetric matchers) because `npm install` could not be made to complete in the Cowork sandbox across six attempts — the mounted filesystem also produced a `Bus error` running Jest directly. The harness runs the repo's real, unmodified test files. **Jeremy should still run `npm test` locally** to confirm under real Jest.

## 2026-07-18 — session 0 executed: legacy inline form system deleted

**Did:** removed the dead legacy inline form system per the plan above and Jeremy's "delete it" call.
- script.js: removed the real `showForm(formType)` implementation (~28 lines), the shadowing legacy `showForm` stub, `clearFormInputs()`, and the DOM consts that only those touched (`showTaskFormButton`/`showHabitFormButton`/`showRoutineFormButton`, `taskForm`/`habitForm`, all task-form and habit-form input consts). Removed the dead `addTaskButton`/`addHabitButton` click listeners and the keypress/default-due-date block that referenced the same removed consts. Fixed `initGame`'s calls into the dead functions (`showForm('task')`, `enableFormControls(true)`, `clearFormInputs()` at boot) by deleting those lines — they were no-ops already (shadowed).
- index.html: removed the `taskForm`/`habitForm` markup from the `hidden-forms` block (they were permanently `display: none` and used different element IDs than the live modal system's `modalTaskName`/`modalHabitName`/etc. — confirmed zero overlap before deleting).

**Found mid-session, handled without expanding scope:**
1. **`js/damage.js`'s `gameOver()` calls `deps.enableFormControls(false)` unconditionally.** Deleting the function outright would have broken the game-over flow (a live, working feature) with a `ReferenceError`. Its effect was already invisible in practice — it only ever disabled the dead inline-form inputs, never the live FAB/modal buttons — so `enableFormControls` was kept as a documented no-op stub in script.js rather than touching `damage.js`. Real behavior (should creation be blocked on game over at all?) is deferred to the UI extraction, not decided here.
2. **`routineNameInput`/`createRoutineButton`/script.js's `createRoutineDefinition()` wrapper turned out to be unreachable too** — same dead-code pattern, but tangled with the already-flagged inline routine-creation duplicate in the modal's `attachModalEventListeners` (`case 'routine':`). **Jeremy's call: leave for session 4**, where that duplicate gets reconciled, rather than splitting the story across two sessions. The `routineForm` markup and its consts/function are untouched.

**Verification:** `node --check script.js` clean before and after every edit. Confirmed via Grep that zero references remain to any removed identifier (`showForm`, `clearFormInputs`, `taskForm`, `habitForm`, `taskNameInput`, etc.) anywhere in script.js, index.html, or js/*.js except the intentional `enableFormControls` no-op stub and the intentionally-untouched routine cluster.

**Not verified this session — sandbox limitation, not a code issue:** could not get a full Jest run to complete. `npm install` repeatedly stalled or left `node_modules` in an inconsistent state across four attempts in the Cowork sandbox (the optional `puppeteer` dependency pulls a large, slow tree through the sandbox's network proxy, and each attempt hit the tool's per-call timeout mid-install). No test files or test-relevant code were touched — the deletions were entirely in script.js's DOM-wiring section and index.html markup, nothing `test/*.test.js` exercises — so risk is low, but this is a gap. **Needs Jeremy to run `npm test` locally to confirm 244/244 still holds**, and to live-playtest that FAB-based task/habit/routine creation still works (the only creation path, unchanged by this session, but worth confirming after any deletion this close to it).

**Alternatives rejected:** re-attempting `npm install` further (tried 4 times across ~10 minutes of wall time with degrading results — third attempt actually corrupted node_modules further, from 258 packages down to 213 — continuing would risk more sandbox mess for uncertain payoff); claiming tests passed without seeing them run (would violate the "report results honestly" rule).

## 2026-07-18 — bugfix (not a roadmap item): deleting a routine left its active sprites/agenda rows stranded on the board

**Bug (reported live by Jeremy, right after the window-exposure fix below got Delete Routine clickable at all):** deleting a routine removed it from the routine list, but any of its habits/tasks that were currently active (spawned sprite + agenda row) stayed on the board — now pointing at a routine that no longer exists.

**Root cause:** pre-existing, predates the routines extraction — the original `deleteRoutine` only ever did `definedRoutines.splice(...)`. Deactivating a routine already solves exactly this problem (`clearActiveInstancesForRoutine`, added 2026-07-18 in the isActive-gating session), but deleting one never called it.

**Fix (judgment call, not escalated — reusing an established mechanic, not inventing one):** delete now performs the same recall as deactivate before removing the routine. Reasoning: deleting a routine is a superset of deactivating it (the routine doesn't just go inactive, it stops existing), so it should get at least the same cleanup. Implemented inside `Routines.deleteRoutine` itself (not the script.js wrapper) so it's unit-tested and composes the same way `toggleRoutineActive` already composes `clearActiveInstancesForRoutine` — `deleteRoutine(routineId, deps)`'s signature changed from `(routineId, definedRoutines)` to `(routineId, deps)` where `deps = { definedRoutines, activeItems, removeItem }`, matching `clearActiveInstancesForRoutine`'s deps shape. It calls the recall BEFORE splicing the routine out, since the recall needs to read the routine's `habitDefinitionIds`/`taskDefinitionIds` to know what to select. No XP/points/streak/damage side effects — same pure-removal semantics as the deactivation recall.

**Not touched:** the underlying habit/task DEFINITIONS (`definedHabits`/`definedTasks`) are left in place, orphaned, same as `removeHabitFromRoutine`/`removeTaskFromRoutine` already leave them — they're simply inert (no routine references them, so neither daily generator will ever spawn them again). Only ACTIVE instances already on the board are recalled. If Jeremy wants deleting a routine to also purge its orphaned definitions, that's a separate, larger decision (definitions might be intentionally reused elsewhere) and should be its own conversation, not folded into this bugfix.

**Tests:** `test/routines.test.js`'s `deleteRoutine` suite extended with the recall case (cross-routine isolation covered too) — updated deps-based signature throughout.

## 2026-07-18 — bugfix (not a roadmap item): Delete Routine button was calling a non-global function

**Bug (reported live by Jeremy right after the routines extraction):** the Delete Routine button in the routine management modal (`showRoutineManagement`) did nothing.

**Root cause:** pre-existing, not introduced by the routines.js extraction. That modal's buttons are built as an HTML string with inline `onclick="deleteRoutine('${routine.id}'); closeModal();"`, which executes in GLOBAL scope when clicked. `closeModal` works because it's explicitly assigned as `window.closeModal = function() {...}` (same pattern as `window.saveNewHabit`/`saveNewTask`/`saveEditedHabit`/`saveEditedTask`), but `deleteRoutine` was only ever a closure-scoped function declared inside the top-level `document.addEventListener('DOMContentLoaded', ...)` wrapper — never attached to `window`. The inline `onclick` silently found nothing to call.

**Fix:** added `window.deleteRoutine = deleteRoutine;` right after the function declaration in script.js, matching the existing pattern for the other inline-onclick functions. No logic changed — `Routines.deleteRoutine` (the extracted data-layer function) and the wrapper's confirm/save/refresh behavior are untouched.

**Checked for siblings:** grepped every `onclick="..."` in script.js — `closeModal`, `saveNewHabit`, `saveNewTask`, `saveEditedHabit`, `saveEditedTask` are all already exposed on `window`. `deleteRoutine` was the only one missing.

## 2026-07-18 — routines extraction: scope split between js/routines.js (data) and script.js (DOM), left untouched

**Context:** extracting the next Milestone 2 item, "Extract routines." ARCHITECTURE.md's target layout described `routines.js` as "heroes, slots, frozen recovery," but the actual routine-related code in script.js turned out to be a large mix of genuine logic (spawn selection, definition CRUD, activation/recall) and pure DOM rendering (list/window population, form HTML, event-listener wiring) — much more DOM-heavy than the habits.js extraction it otherwise mirrors.

**Decision:** extracted only the logic layer into `js/routines.js`: `getRoutineTaskInstanceDueTime`, `selectTaskDefsToSpawn` (new — the selection half of `generateDailyRoutineTaskInstances`, split out the same way `selectHabitDefsToSpawn` was for habits.js), `createRoutineTaskInstanceData`, `generateDailyRoutineTaskInstances`, `createRoutineDefinition`, `deleteRoutine`, `removeHabitFromRoutine`, `removeTaskFromRoutine`, `createNewHabitInRoutine`, `createNewTaskInRoutine`, `editHabitInRoutine`, `editTaskInRoutine`, `addHabitToRoutine`, `selectActiveItemIdsToClearForRoutine`, `clearActiveInstancesForRoutine`, `toggleRoutineActive`. Left `renderDefinedRoutines`, `populateRoutinesWindow`, `showRoutineManagement`, `populateRoutineHabits`/`populateRoutineTasks`, `createRoutineFormHtml`, `attachRoutineManagementListeners`, `showAddItemToRoutineModal`, and `updateRoutineDisplay` in script.js — they're pure DOM construction with no logic worth testing in isolation, and belong to the still-open "Extract UI: forms, agenda list, popups, FAB menu" ROADMAP item instead. "Frozen recovery" is a Milestone 3 feature that doesn't exist in code yet, so there was nothing to extract for it.

**Pattern for functions that mix data mutation with light DOM (alert/confirm):** where the original function both validated/mutated state AND called `alert()`/`confirm()`, the routines.js function returns a result object (`{ ok: false, reason }` / `{ ok: true, routine }` / the removed item / a boolean) and the script.js wrapper owns the actual `alert`/`confirm` call plus any render/save/refresh calls — same shape as habits.js's split, just made explicit here since more of these functions had it. `toggleRoutineActive` is the one exception: `alert` for the slot-cap message is passed in via `deps.alert` rather than left in the wrapper, because the alert is itself gating logic (whether the toggle proceeds at all), not a side effect after a decision already made.

**Not touched (out of scope, flagged only):** `createRoutineFormHtml`'s modal handler (around script.js's routine-modal `case 'routine':` branch) has its own INLINE copy of the same name-validation + object-construction logic as `createRoutineDefinition` — a duplicate/shadowing pattern already known from the 2026-07-17 "showForm duplicate/shadowing" bug (documented, not fixed, then either). It was NOT changed to call `Routines.createRoutineDefinition` this session — that inline handler is also missing the `saveGame()` call `createRoutineDefinition` has, and reconciling the two belongs with the future UI extraction (or its own bugfix session), not folded silently into this one.

**Tests:** `test/routines.test.js` (33 cases) covers everything above. `test/routine-active-gating.test.js` and `test/routine-task-instances.test.js` (both pre-existing hand-maintained mirrors of this logic, written before it was extractable) now `require('../js/routines.js')` directly instead of keeping a second copy that could drift — same dedup habits.js did for `test/routine-active-gating.test.js`'s habit-selection mirror.

## 2026-07-18 — habits + streaks extraction: two divergences found and deliberately NOT fixed this session

**Context:** while mapping script.js for the habits/streaks extraction (js/habits.js), found two pre-existing divergences between the code and either itself or the docs. Both surfaced to Jeremy directly rather than guessed at; decided to keep this extraction behavior-identical and handle both separately.

**1. Streak-bonus asymmetry (bug, preserved as-is + flagged):** `completeItem` increments the habit streak THEN computes bonus points from the NEW streak; `uncompleteItem` decrements THEN computes the refund from the LOWERED streak. Net effect: completing a habit that crosses `HABIT_STREAK_BONUS_THRESHOLD` (3) and then uncompleting it refunds based on the streak one below the threshold — the player nets +`HABIT_STREAK_BONUS_POINTS` (5) points they shouldn't keep. **Decision: preserve as-is in the extraction** (Jeremy's call — "preserve, flag it" over fixing inline or ignoring silently). `js/habits.js`'s `applyHabitCompletion`/`applyHabitUncompletion` reproduce the asymmetry exactly, documented in the file header and covered by an explicit test in `test/habits.test.js` (`applyHabitUncompletion` — "refund is computed from the NEW (post-decrement) streak"). New ROADMAP item added under Milestone 2 to fix it in its own session (refund should mirror the award, computed from the pre-decrement streak).

**2. Habit bonus model vs. MECHANICS.md (design gap, NOT resolved — routed to a future Fable session):** MECHANICS.md says high streaks give "a higher CHANCE of double points" (probabilistic); the actual code (`HABIT_STREAK_BONUS_THRESHOLD`/`HABIT_STREAK_BONUS_POINTS`) awards a flat, deterministic +5 the moment streak hits 3. Jeremy asked for a recommendation rather than picking doc-vs-code. Recommendation given: separate the two jobs currently conflated under "streak" — keep `streak` as the visual/legible layer (agenda badge, on-fire sprite per ART_STYLE), and drive the *economy* bonus off a bounded rolling **success rate** (last ~14 scheduled occurrences; for negative habits, success = avoided, matching ROUTINES.md's existing avoidance/check-in model) mapped to a capped multiplier (e.g. ≥90% → 1.5×) rather than an unbounded streak-linear bonus — bounded by construction, forgiving of a single missed day (streak resets to 0 today on any miss, which is a known driver of habit-app abandonment), and works for negative habits without a separate inverted system. **Also noted: today's flat bonus can't actually accelerate leveling/unlocks** — XP is flat per completion (`XP_PER_HABIT_COMPLETE`, untouched by streak), and the bonus only inflates `playerPoints`, which has no sink yet (shop is unbuilt Milestone 3) — so the original worry (fast-tracking levels/unlocks) doesn't apply to the current code, only to future shop pricing.

**Not implemented — deliberately deferred.** Needs per-occurrence history on habit definitions (rolling `{date, success}[]`), which needs a schemaVersion bump, and needs "how many occurrences were scheduled" — exactly what the unbuilt day-of-week/monthly `schedule` item (2026-07-18, above) defines. Building this before that item would mean a second, separate migration. Recommendation: fold into the scheduling item's migration, tune the multiplier curve against real shop prices once Milestone 3 exists, and decide it in one batched Fable session alongside the still-open base-healing question (daily reset vs. gradual regen + repair kits, MECHANICS.md/PROJECT_SPEC.md conflict, DECISIONS.md 2026-07-17) rather than three separate Fable turns. MECHANICS.md's "higher chance of double points" line and Open Questions entry are left as-is for now — not yet corrected either direction.

## 2026-07-18 — day-of-week / monthly scheduling DESIGNED with Jeremy (not yet built)

**Request:** some routines need certain habits/tasks active only on specific days (weekdays vs. weekends), and the frequency dropdown (currently just "Daily") needs "Weekly" and "Monthly" options — for both routine habits/tasks and standalone (non-routine) habits.

**Grounding:** this isn't a new invention — docs/DATA_SCHEMA.md's target schema already had `frequency: "daily"|"weekly"|{ days: number[] }`, and PROJECT_SPEC.md's original `Habit.schedule` object (`{ frequency: 'daily'|'weekly'|'custom', daysOfWeek: [0-6], timesPerWeek, timeWindows }`) designed this years ago; it was just never built (the live dropdown only ever had one option).

**Decision (with Jeremy, three questions asked directly rather than guessed):**
1. **Monthly short-month edge case:** clamp `dayOfMonth` to the month's last day (e.g. 31 → Feb 28/29) rather than skipping that month entirely.
2. **Scope:** the schedule applies to habits and routine task definitions only (both already recur). Standalone one-off tasks do NOT get a recurrence schedule — that would be a new capability, not an extension of one.
3. **Migration:** old saves migrate automatically — a `schemaVersion` bump rewrites `frequency: 'daily'` into `schedule: { frequency: 'daily', daysOfWeek: [0,1,2,3,4,5,6] }` on load, so nothing breaks for existing habits/tasks.

**Design (full detail in docs/DATA_SCHEMA.md `Schedule` + docs/MECHANICS.md):** a single `schedule: { frequency, daysOfWeek, dayOfMonth }` object replaces the bare `frequency` string. Daily and weekly deliberately share ONE generator mechanism (a day-of-week checkbox filter) rather than getting separate streak/dedupe semantics — "weekly" is really "daily, but you pick which days," not a distinct weekly-streak concept. Monthly is the one genuinely different case, needing a day-of-month field instead of checkboxes.

**Rejected:** giving "weekly" its own streak-per-week accounting distinct from daily's streak-per-day (would be new, unrequested balance/mechanics design layered onto a scheduling request); adding recurrence to standalone tasks (bigger scope than asked for, and standalone tasks have no recurrence concept today to extend).

**Not yet implemented.** This was a design/planning conversation (recommended switching to Fable/Opus for it, since it's a schema-shaping decision — stayed on Sonnet at Jeremy's pace). Next session that picks this up needs: the `schemaVersion` bump + migration in `js/persistence.js`, the day-of-week/day-of-month UI (habit form + routine task form, both standalone and in-routine), and updating `generateDailyHabitInstances`/`generateDailyRoutineTaskInstances` (and the not-yet-built routine-task monthly path) to read `schedule` instead of `frequency`. Should probably be its own ROADMAP item under Milestone 2 or 3 — touches the same generators the pending "extract habits + streaks" extraction does, so worth sequencing deliberately rather than doing both blind.

## 2026-07-18 — bugfix (not a roadmap item): activating a routine now spawns today's instances immediately

**Bug (reported live by Jeremy, same day as the isActive-gating fix below):** create a routine, add a task to it, hit Activate — the task never appeared in the game area or the agenda list.

**Root cause:** a gap in the isActive-gating fix itself. The daily generators (`generateDailyHabitInstances`/`generateDailyRoutineTaskInstances`) only run from three places: `initGame`, `restoreGameState`, and at creation time inside `createNewHabitInRoutine`/`createNewTaskInRoutine`. A routine starts `isActive: false` (`createRoutineDefinition`), so adding a task to it calls `generateDailyRoutineTaskInstances` while the routine is still inactive — the new gating correctly no-ops. `toggleRoutineActive` then flips `isActive` to `true` but never itself calls either generator, so nothing spawned until the next full reload or day-rollover.

**Fix:** `toggleRoutineActive` now calls both daily generators on the inactive→active transition, spawning any of the routine's habits/tasks that are due today and not already active/completed. This is the direct symmetric counterpart to `clearActiveInstancesForRoutine`'s immediate recall on the active→inactive transition (added in the entry below) — deactivate removes today's instances immediately, activate adds them back immediately, rather than either edge waiting for a reload.

**Superseded text:** docs/ROUTINES.md previously said reactivating "does NOT retroactively spawn today's instances... they appear on the next daily generation pass" — that was this session's original (wrong) design intent, corrected here after hitting it live.

**Not unit-tested directly:** the call site change is DOM orchestration (spawning ultimately calls `addItemToGame`), same category as `Spawning.addItemToGame` per ARCHITECTURE.md — the selection logic it calls into was already covered by `test/routine-active-gating.test.js` / `test/routine-task-instances.test.js` from the entry below. Verify by playtest: create/activate a routine with a habit and a task, confirm both appear immediately.

## 2026-07-18 — routine `isActive` now gates spawning AND recalls active enemies on deactivation

**Roadmap item (found the same day as the routine-tasks fix above):** `isActive` was inert — both daily generators iterated every definition regardless of routine membership or active state, and `toggleRoutineActive` only flipped the flag (no save, no re-render). docs/ROUTINES.md said deactivated routines "spawn no enemies," which wasn't true.

**Fix, part 1 (spawning):** `generateDailyHabitInstances` and `generateDailyRoutineTaskInstances` now build a set of definition ids belonging to a currently-`isActive` routine and skip anything not in that set — this also makes an orphaned definition (removed from its routine via `removeHabitFromRoutine`/`removeTaskFromRoutine` but never deleted from `definedHabits`/`definedTasks`) inert, matching the already-inert behavior tasks had for orphaning.

**Fix, part 2 (recall) — asked Jeremy directly since the docs didn't specify it:** should deactivating a routine also remove its already-spawned, currently-active enemies from the board, or just stop new ones from spawning? **Jeremy chose: also clear active enemies.** Implemented as `clearActiveInstancesForRoutine` (routineId) → `selectActiveItemIdsToClearForRoutine` (pure selection: matches active items by `definitionId` against the routine's `habitDefinitionIds`/`taskDefinitionIds`, cascades any sub-tasks of a matched routine task ahead of their parent) → each id run through the existing `removeItem()`. Recall is a pure removal: no XP/points, no habit streak change, no damage penalty, not recorded in `completedItems` — the routine "went on vacation," it wasn't finished. Reactivating a routine does NOT retroactively spawn today's instances; they appear on the next daily generation pass, same as a brand-new routine habit/task.

**`toggleRoutineActive` also gained the missing `saveGame()` call** (previously relied on the 5s autosave net, like the two routine-creation functions fixed in the entry above).

**Rejected:** leaving already-active enemies to run their course after deactivation (the literal ROUTINES.md wording and the smaller diff) — Jeremy explicitly wanted immediate recall instead.

**Deliberately NOT touched this session:** `generateDailyHabitInstances` still only handles `frequency === 'daily'`. Still safe today because the create-habit form's frequency dropdown has exactly one option (`daily`) — noted again in case that changes.

## 2026-07-18 — routine tasks spawn DAILY, like routine habits; definedTasks is now persisted

**Bug (reported by Jeremy):** a task created inside a routine never appeared on the board or in the agenda list.

**Root cause:** not a rendering bug — the spawn path was never built. `createNewTaskInRoutine` created a task *definition*, pushed it to `definedTasks`, and called only `renderDefinedRoutines()`. Nothing anywhere converted a task definition into a live item; there was no task equivalent of `createHabitInstanceData` / `generateDailyHabitInstances`. The task correctly appeared inside the routine management window, which is why it looked like a display problem.

**Decision (with Jeremy): routine tasks recur DAILY**, matching routine habits. Added `getRoutineTaskInstanceDueTime` (parses the definition's `HH:MM` `defaultDueTime`, unlike habits' coarse `timeOfDay` buckets), `createRoutineTaskInstanceData`, and `generateDailyRoutineTaskInstances`, called everywhere `generateDailyHabitInstances` is called (initGame, restoreGameState, and at creation time in `createNewTaskInRoutine`). Instances are normal `type: 'task'` items carrying a `definitionId`, so every downstream system (damage, completion, sub-tasks, sorting) treats them identically to a manually-created task.

**Dedupe differs from habits by necessity:** habits track "done today" on the definition (`lastCompletionDate`), but task definitions have no such field, so completion is read from `completedItems` by `definitionId` + `originalDueDate` day match. Only definitions actually referenced by some routine's `taskDefinitionIds` spawn — one orphaned by `removeTaskFromRoutine` stays in `definedTasks` but is inert.

**Rejected:** spawn-once-on-activation (would have given `isActive` real meaning, but makes routine tasks one-shot and leaves `defaultDueTime` odd), and spawn-once-immediately-on-creation (reduces routines to a grouping tag for tasks).

**Also fixed alongside: `definedTasks` was never persisted.** It's a bare `window.definedTasks`, and `getPersistableState()` saved `definedRoutines` (including `taskDefinitionIds`) but not the definitions themselves — so a refresh left those ids dangling against nothing. Added to save/restore as an additive field (no schemaVersion bump; older saves restore an empty array) and cleared by the dev reset button. `createNewTaskInRoutine`/`createNewHabitInRoutine` also gained the `saveGame()` calls they were missing (they previously relied on the 5s autosave net).

**Known gap deliberately NOT fixed here (own roadmap item):** `isActive` is inert. `generateDailyHabitInstances` iterates ALL of `definedHabits` ignoring routine membership, so a habit in a deactivated routine still spawns — and `toggleRoutineActive` only flips the flag (no save, no re-render). docs/ROUTINES.md says "deactivated routines spawn no enemies." The new task generator deliberately mirrors the habit generator's behavior rather than gating on `isActive`, so the two don't diverge; both get fixed together. Also latent: `generateDailyHabitInstances` only handles `frequency === 'daily'`, which is safe only because the create-habit form offers no other option.

## 2026-07-18 — progression.js extraction leaves playerPoints in script.js (economy.js's future scope, not built yet)

Milestone 2 extraction: `js/progression.js` pulls the level-up math (`checkPlayerLevelUp`'s threshold-crossing loop) out of script.js as a pure `Progression.checkLevelUp(state, thresholds, slotsPerLevel, maxLevel)` — no DOM, no CONFIG global dependency, takes everything as explicit arguments. A single big XP award can cross more than one level threshold at once; the original code handled this with a recursive self-call, the extracted version walks a `while` loop instead (same effective behavior — level, xp, slots all update before either DOM side effect fires).

**Decision:** `playerPoints` stays in script.js, even though it's earned/lost in the exact same `completeItem`/`uncompleteItem` code paths as XP. docs/ARCHITECTURE.md's target layout puts points under the future `economy.js` (points, shop, exponential pricing), not `progression.js` (XP, levels, slots) — and the shop itself is an unbuilt Milestone 3 item (docs/ECONOMY.md). Extracting points now would mean building `economy.js` ahead of the shop it exists to support, off the strength of one counter variable.

**What moved vs what stayed:** `Progression.checkLevelUp` (pure) → js/progression.js. `checkPlayerLevelUp()` stays in script.js as a thin wrapper applying the result to `playerLevel`/`routineSlots` and driving `updatePlayerDisplays()`/`showLevelUpMessage()`/`updateRoutineDisplay()`. `playerXP`, `playerPoints`, and `updatePlayerDisplays()` itself all stay in script.js — the display function writes 4 HUD fields (xp, level, points, slots) together and splitting it now would separate two numbers that render side by side for no behavioral gain.

**Rejected:** pulling `playerPoints` into progression.js alongside XP (mixes economy's future scope into progression's, and the ARCHITECTURE.md layout already draws this line); pulling `updatePlayerDisplays()` into progression.js (it's the same "one module writes DOM it doesn't fully own" shape damage.js's `updateBaseVisuals` avoided by owning ALL of base's visual state — points aren't progression's to own).

## 2026-07-18 — overdue row styling is DERIVED from state in createListItem, not applied only on transition

**Bug (found by Jeremy playtesting extraction #3):** an overdue task's agenda row rendered with no red highlight while its sprite correctly kept the red box. Reproduced live: editing an already-overdue task's due date drops `overdue-list-item` from its row.

**Root cause:** `createListItem` built the row's classes from `category` and `isHighPriority` but never from `isOverdue`. The class was added in exactly one place — `markAsOverdue` — which opens with `if (item.isOverdue) return;`. So it styles the row only on the TRANSITION into overdue, and any path that REBUILDS the row of an item that is *already* overdue produces an unstyled row. At least three paths do that: the edit-task save handler, adding a sub-task to an overdue parent, and `restoreGameState` (which re-applies the class at its line ~360 and then rebuilds the element for sub-tasked parents immediately after, discarding it). The sprite was unaffected because `item.element` is never rebuilt — which is exactly why the two disagreed.

**Decision:** derive it in `createListItem` (`if (itemData.isOverdue) listItem.classList.add('overdue-list-item')`), making row construction idempotent and fixing every rebuild path at once. `markAsOverdue` keeps its own `classList.add` for the live transition, where no rebuild happens.

**Rejected:** re-applying the class at each of the three rebuild call sites (same defect re-introduced by the next rebuild path anyone adds — this is the third bug in this family after the 2026-07-17 habit-unsafe `createListItem` issues), and dropping the early return in `markAsOverdue` (it also resets habit streaks and parks the damage clock; making it re-entrant would risk double side effects).

**Same family as the 2026-07-17 `createListItem` hardening:** the row builder keeps being written as "render a fresh task" rather than "render this item's current state." Worth watching for on the remaining Milestone 2 UI extraction.

## 2026-07-18 — damage.js reaches script.js state through accessor deps instead of taking ownership

Milestone 2 extraction #3 moved base health, damage ticks, game over, and both catch-up paths into `js/damage.js`. Unlike clock.js / movement.js / spawning.js, which only ever READ script.js state, this module must WRITE it: `baseHealth` and `gameIsOver` are module-scoped `let`s in script.js with ~68 references between them.

**Decision:** pass a `damageDeps()` bag containing accessors (`getBaseHealth`/`setBaseHealth`/`isGameOver`/`setGameOver`/`setDaysSurvived`/`setOfflineCatchUpActive`) rather than moving those variables into damage.js. This extends the `isGameOver()` precedent spawning.js already set, and keeps the extraction behavior-identical — every call site in script.js is an unchanged thin wrapper.

**Why:** moving ownership would have required touching all 68 references in one session, turning a mechanical extraction into a semantic change to the game's central state, with no test coverage over most of the touched call sites. The refactor rules call for incremental extraction with tests green before and after; this satisfies that. State ownership can move once enough of script.js is modularized that the remaining readers are few.

**Rejected:** (a) damage.js owns `baseHealth`/`gameIsOver` with script.js reading through getters — right end state, wrong session, too large a blast radius today; (b) a shared mutable `GameState` object passed everywhere — a bigger architectural commitment than this milestone has decided on, and it would front-run the DATA_SCHEMA reconciliation still pending from Milestone 1.

**`markAsOverdue` deliberately stayed in script.js** and arrives as a dep, even though it sets the damage clock. It also resets habit streaks and touches `definedHabits`, so it belongs with the future habits extraction; pulling it into damage.js would drag the habit system in early.

**Balance numbers unchanged** — this is a pure extraction. `computeOfflineOverdueDamage` now reads `CONFIG.DAMAGE_INTERVAL_MS`/`CONFIG.OVERDUE_DAMAGE` directly instead of via script.js's local `const` aliases of the same values.

**Two cleanups folded in** (both carried on the handoff's watch-out list for several sessions):
- The `🛠️ createTaskItemData` / `🔧 …returning` / `📍 addItemToGame` debug logs were removed from script.js, js/spawning.js, and the mirrored copies in `test/subtask-creation.test.js`. They were added while chasing the sub-task duplication bug, which was fixed 2026-07-17; they fired hundreds of times per test run and buried the assertions (that suite's output dropped from 858 lines to 26). Chosen over silencing `console.log` globally in `test/setup.js`, which would have hidden future real logs too.
- **puppeteer bumped `^21.0.0` → `^24.0.0`**, clearing the 9 npm-audit findings (1 critical, 5 high) that all traced to the unsupported 21.x line. This required a source change: puppeteer removed `page.waitForTimeout` in v22, so `test/visual-tests.js` now uses a local `sleep(ms)` helper (4 call sites). **Unverified** — the visual suite needs Chromium and can't run from the Cowork sandbox. Note `reproduce_subtask_bug.js` (a stale root-level debug script for the long-fixed sub-task bug, not wired into any npm script) still calls `waitForTimeout` and would break under v24; deleting it is probably the right call.

## 2026-07-18 — Jest setup fixed; the "missing babel deps" diagnosis was wrong

Four sessions in a row worked around a broken Jest setup in a sandbox copy instead of fixing the repo, each logging "add jest + babel-jest + @babel/core + @babel/preset-env to devDependencies." **That diagnosis was wrong.** Installing `jest` alone pulls in `babel-jest` (30.4.1) and `@babel/core` transitively — verified empirically by installing only `jest` and inspecting `node_modules`. No babel packages and no `babel.config.js` are needed: everything here is plain CommonJS (`require`/`module.exports`) on modern Node, with no JSX, TypeScript, or ESM anywhere in `test/`.

Four distinct defects, all fixed:

1. **`npm test` never ran Jest at all.** The script was `node test/visual-tests.js` — the puppeteer visual-regression suite. Every handoff that said "run `npm test`" to check the unit suite was running something else entirely. Now `test` = `jest`; the visual tests moved to `test:visual` / `test:visual:baseline`.
2. **`devDependencies` was empty** — Jest was never declared, so a fresh clone had no way to run the suite. Added `jest: ^30.4.2` (the version npm currently resolves).
3. **`test/setup.js` didn't exist** although `jest.config.js` has referenced it via `setupFilesAfterEach` since July 2025 — so Jest failed before running a single test. Created as a real, documented, near-empty file (it only guards unhandled rejections; per-test global wiring deliberately stays in the test files).
4. **Coverage was on by default with 80% global thresholds**, which would fail `npm test` even with every assertion green — some extracted code is deliberately not unit-tested (`Spawning.addItemToGame` is DOM orchestration verified by live playtest). Coverage is now opt-in via `npm run test:coverage`, with the hard thresholds removed until Milestone 2 has pulled enough logic out of script.js to meet them honestly.

**Also removed the `transform: {'^.+\\.js$': 'babel-jest'}` override.** babel-jest is already Jest's default transform, so the line was redundant — and it was almost certainly the thing that made every previous session conclude babel packages were a missing dependency.

**Dependency layout:** the game itself has NO runtime dependencies (vanilla JS, no build step), so `dependencies` is now empty. `puppeteer`/`pixelmatch`/`pngjs` moved to `optionalDependencies` — they exist solely for the visual tests and pull a full Chromium download, which is what made `npm install` unusable from the Cowork sandbox (installs were repeatedly killed mid-download). **`npm install --omit=optional` now gives a fast, jest-only setup** — that's the command to use from Cowork/CI. A normal `npm install` still installs everything. **Rejected:** leaving them in `dependencies` (wrong semantically — they're test tooling, not runtime) and putting them in `devDependencies` (`--omit=dev` would then also skip Jest, defeating the purpose).

**Not verified in-sandbox:** a green `jest` run. The Cowork sandbox could not complete `npm install` (network-throttled; the mounted outputs dir also refuses unlinks, so partially-extracted packages can't be repaired). Config files are validated — `package.json` parses, `jest.config.js`/`test/setup.js` pass `node --check`, no ESM in any test file — and the new-logic assertions were separately verified with Node's built-in runner. **Jeremy must run `npm install` + `npm test` locally to confirm.**

## 2026-07-18 — Suspended-loop (sleep/background) damage catch-up, and "days survived" from real time

Both came out of an overnight playtest: Jeremy left the tab open with one overdue task, came back at 7:47 AM to a base at 0 HP and "GAME OVER! Your Base Survived 22 Days."

**Decision 1 — a suspended game loop is treated as time the player was away, with the same capped damage a reload gets.** Root cause of the dead base: the offline cap only ever guarded the RELOAD path (`restoreGameState` → `runOfflineCatchUp`). With the page left open and the machine asleep there is no reload, so nothing guarded `updateActiveItems`, which advances `lastDamageTickTime` by exactly one `DAMAGE_INTERVAL_MS` per 50ms game tick — replaying a ~10-hour gap as ~120 damage in ~6 seconds and flattening a 100 HP base within seconds of wake. Only ONE item was overdue; the intended maximum was 12. Fix: `updateGame` records `lastLoopTickMs` each tick and, when the wall-clock gap since the previous tick is ≥ `CONFIG.LIVE_GAP_THRESHOLD_MS` (30s), calls new `runLiveGapCatchUp()` BEFORE `updateActiveItems()`. That charges each due item its pending whole intervals, capped at the remaining `OFFLINE_DAMAGE_CAP_PER_ITEM` budget **shared with the reload path** via the same `offlineDamageCharged` lifetime counter, marks anything that fell due during the gap, and parks each damage clock at the caught-up time so the live loop resumes normally. **Why:** it's the same situation as being offline — the only difference is the absence of a reload — so it should obey the already-decided principle (punish the COUNT of neglected items, not the DURATION away). Sharing one lifetime budget also means alternating sleep and reload can't launder extra damage out of the same item. **Rejected:** (a) clamping the clock to now and charging nothing — makes a sleeping laptop a free pass and contradicts the reload path, which does charge; (b) rate-limiting the per-tick payout — preserves duration-scaled damage, which is exactly the model we rejected on 2026-07-17.

**Implementation note (deliberate):** pending damage is computed from `lastDamageTickTime` and the clock advances by whole intervals, keeping the sub-interval remainder — NOT from the gap window. Computing per-window would `floor()` a throttled background tab's ~60s wakeups to zero damage every time, making "background the tab" a total damage-evasion loophole. Regression test covers this (`test/live-gap-catchup.test.js`, "no damage-evasion loophole").

**Decision 2 — "days survived" is derived from real elapsed time; the accelerated day timer is removed (BALANCE CHANGE).** `CONFIG.DAY_DURATION_MS` (60000) drove a `setInterval` that incremented `daysSurvived` every real MINUTE, so 22 minutes of awake runtime displayed as "22 Days" — and because a timer only advances while the tab is awake, it simultaneously under-counted the ~10 hours actually survived. Removed `DAY_DURATION_MS` and the `dayTimerInterval` entirely; added `CONFIG.MS_PER_REAL_DAY` and `computeDaysSurvived()` = `floor((now - runStartedAtMs) / MS_PER_REAL_DAY)`. `gameOver()` freezes the value at death. **Why:** CLAUDE.md's convention is real timestamps in logic, accelerated demo time only behind a config flag — this was accelerated time with no flag. Deriving from wall-clock is also immune to sleep, throttling, and reloads, which a tick counter never can be. **Rejected:** keeping the fast timer behind a demo flag — no current need for accelerated days, and a second time model is a standing source of exactly this class of bug; reintroduce behind a flag if a demo mode is ever wanted.

**Decision 3 — an item that is ALREADY overdue when it enters the game starts its damage clock at spawn, not at its due time.** Found live while verifying Decision 1: creating a task backdated 3 hours instantly drained 36 HP (verified in-browser: 100 → 64), because `markAsOverdue` parks `lastDamageTickTime` at the due time and the live loop then replays every missed interval at one per 50ms tick. Same root cause as Decision 1, but reached through a third path with no loop gap at all — just `addItemToGame` on a backdated item. Fix in `js/spawning.js`: after `markAsOverdue`, set `lastDamageTickTime = Date.now()`. **Why:** the item did not exist during that window, so nothing is owed for it; you shouldn't be punished for logging a deadline you already missed. It still takes normal live damage from spawn onward. Restore is unaffected — `restoreGameState` already resets the same clock immediately after and back-charges its capped offline damage separately. **Rejected:** back-charging the pre-creation window (punishes honest bookkeeping and would make "add the task late" strictly worse than never adding it).

**Schema note:** `runStartedAtMs` is a new persisted scalar. Following the `offlineDamageCharged` precedent (2026-07-17), schemaVersion was NOT bumped — it's an additive plain property, and `restoreGameState` falls back to the save's own `savedAt` (then `Date.now()`) for pre-existing saves, so old saves restore without a bogus day count.

## 2026-07-17 — Milestone 2 extraction #1: clock.js (timeline positioning + midnight line), and two Milestone 2 process decisions made on Fable

**Decision 1 — skip the "convert to ES modules first" step in ARCHITECTURE.md.** ARCHITECTURE.md's refactor strategy said to convert script.js to ES modules early in Milestone 2, as its own session, before incremental extraction. Decided with Jeremy to skip this permanently and keep the existing global + `module.exports` pattern already proven by `js/config.js` and `js/persistence.js` (script.js loads modules via `<script>` tags in `index.html`; test files `require()` them directly in Node). **Why:** no build step exists today and the project wants to keep it that way; ES modules would force Jest ESM config churn (this repo's Jest setup is already fragile — see Follow-up below) for zero player-facing benefit. **Rejected:** converting to ES modules as originally planned — pure process overhead given the working alternative. ARCHITECTURE.md's "Refactor Strategy" step 3 should be read as superseded by this entry.

**Decision 2 — clock.js's scope excludes offline catch-up, contrary to ARCHITECTURE.md's target layout.** The target layout comment lists clock.js as owning "real time, timeline positions, midnight line, offline catch-up." Decided to leave offline catch-up (computeOfflineOverdueDamage, runOfflineCatchUp, the `.catching-up` animation, `offlineCatchUpActive` guard) in script.js for now. **Why:** that code is freshly implemented and live-verified (2026-07-17 offline catch-up entry above) and is tightly tangled with damage application and DOM animation state — pulling it into a brand-new first extraction risked destabilizing just-tested code for no immediate gain. It's a better fit alongside the future damage/base-health extraction (Milestone 2 order, item 3), which already owns `damageBase`/`applyOfflineDamage`'s sibling `markAsOverdue`/`recomputeOverdueStateAfterEdit`. Revisit at that session.

**Extraction itself:** Moved `calculateTimelinePosition` and `updateMidnightLine` (plus the midnight-line math split out for testability as `calculateMidnightLinePosition`/`shouldShowMidnightLine`) from script.js into new `js/clock.js`. Both functions previously closed over module-scoped `let GAME_SCREEN_WIDTH, BASE_WIDTH, ENEMY_WIDTH, HABIT_ENEMY_WIDTH` (computed from the DOM in `initGame()`); the extracted versions take these as an explicit `dims` object parameter instead, matching persistence.js's pattern of explicit inputs over shared closures. script.js keeps `calculateTimelinePosition(item, currentTime)`/`updateMidnightLine(currentTime)` as thin wrappers that build `dims` from the closure and delegate to `Clock.*` — every existing call site (script.js lines ~1752, ~1862, ~2044) is unchanged. Wired `js/clock.js` into `index.html`'s load order, after `js/persistence.js` and before `js/IdCounter.js`.

**Verified:** `node --check` passes on script.js and js/clock.js. New `test/clock.test.js` (16 cases) requires the real module directly (not a hand-maintained mirror, unlike offline-catchup.test.js — clock.js has real `module.exports` so there's no need to duplicate logic). Covers overdue/exactly-due/near-term/far-future timeline positions, the habit-vs-task width difference, the midnight-line visibility threshold (8pm) and position math, and the DOM wrapper's no-op-when-missing behavior. Found and documented (not fixed) a pre-existing dead branch: `calculateTimelinePosition`'s "due next day or later → return gameScreenWidth" `else if` can never trigger for a real `Date`, because `nextMidnight` is derived from the item's own due date (due date + 1 day, truncated to 00:00) and is therefore always strictly after the due date itself — a far-future item instead falls through to the `>4h` linear band using its own time-of-day. Not in scope to fix (extraction preserves existing behavior byte-for-byte); worth a look if it ever produces a visible artifact for multi-day-out items. Full suite: 46/46 passing (30 pre-existing + 16 new).

**Follow-up confirmed, not fixed (pre-existing, logged 2026-07-17 in an earlier HANDOFF entry):** this repo's `package.json` is actually the puppeteer visual-test manifest and doesn't list `jest`/`babel-jest`/`@babel/core`/`@babel/preset-env` as dependencies, and `test/setup.js` (referenced by `jest.config.js`'s `setupFilesAfterEnv`) doesn't exist. Worked around in the sandbox again this session (installed jest+babel there, touched an empty `test/setup.js`) to run the suite. Still worth a small dedicated session to fix properly in the repo.

---

## 2026-07-17 — OPEN QUESTION: base healing — daily full reset vs. gradual regen conflict
**Not decided — logging for Milestone 4 ([P2-GAME-012] Base healing system) before any implementation starts.** Found while answering Jeremy's question about how the base recovers HP: the docs disagree with each other, and neither describes what's actually live.
- docs/MECHANICS.md currently says the base is "100 HP, replenishes to full each day" — a full daily reset.
- PROJECT_SPEC.md (~line 95-100) instead specs GRADUAL healing: 1 HP every 5 minutes at a constant rate, which stops once the base hits 0 HP, and can only be re-enabled after total destruction via a manual repair kit purchase (minimum 25 HP). No full daily reset is mentioned there — a bad day's damage would otherwise just be gradually undone over ~8 hours, not wiped at midnight.
- **Neither is implemented in script.js today.** The base currently only ever loses HP; nothing resets or regenerates it outside of the "New Base"/restart flow (which starts a whole new run at full HP, not a same-run heal).
- docs/ECONOMY.md's three repair-kit tiers (25/50/100 pts, instant restore) are consistent with the gradual-healing spec (they're the "how to recover if healing got disabled" lever) but make little sense if the base already fully resets every day for free.
**Why this matters before Milestone 4:** these are two different design philosophies, not a wording gap — "you're forgiven at midnight" vs. "you slowly climb back on your own, and losing everything costs real points to reverse" produce very different play feel and interact differently with the offline-catch-up damage cap decided today (a full daily reset would make the offline-damage lifetime-cap moot every 24h; gradual regen would not). Needs a deliberate decision with Jeremy, not an assumption, before [P2-GAME-012] is built.
**Next step:** raise with Jeremy when Milestone 4 planning starts (or sooner if he wants to settle it early); update MECHANICS.md's "Base" and "Overdue Damage" sections and this entry once decided.

## 2026-07-17 — Offline overdue damage: per-item capped back-charge (decided with Jeremy on Fable)
**Decision:** When the game loads a save, each item that spent offline time overdue is back-charged its REAL elapsed overdue damage (1 HP per `DAMAGE_INTERVAL_MS`, same as live), but capped per item at `CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM = 12` HP (≈1 hour's worth; tunable via the balance protocol). Elapsed time counts from `max(item went overdue, last save)` to load time, and the 3-day max offline progression from PROJECT_SPEC applies. This resolves the decision deferred by the persistence session (see 2026-07-17 persistence entry, "deliberately NOT charged on load").
**Why:** Design principle chosen: punish the COUNT of neglected commitments, not the DURATION of absence (duration is dominated by sleep/work/life; count reflects planning quality). A per-item cap makes each neglected item cost a predictable, teachable amount — one slip stings (≤12), a bad day with 3-4 overdue items hurts (36-48 of 100 HP), and base death remains possible only through breadth of neglect (8+ items), never through merely sleeping. Charging real elapsed damage below the cap keeps "a little late hurts a little."
**Rejected:** (a) No back-charge — makes not-opening-the-app the optimal strategy: punishes engagement, rewards avoidance, backwards for a productivity game. (b) Full back-charge — one task overdue overnight (8h ≈ 96 HP) near-guarantees a dead base every morning; guaranteed total failure carries no information and drives abandonment; punishes sleep, not planning. (c) Reduced flat rate (e.g. 25%) — still duration-scaled (overnight ≈ 24 HP/item, so 2-3 items still near-death), converges to full back-charge over longer absences, and tunes badly because rate × duration interact.
**Out of scope:** Offline HEALING (PROJECT_SPEC ~line 95: gradual 1 HP/5min, disabled at 0 HP, repair kits to re-enable) belongs to P2-GAME-012 (Milestone 4) since gradual healing isn't implemented live yet; when it lands, offline healing should join it so a quiet base recovers overnight.
**Revision (same day, prompted by Jeremy asking "is this capped per day?"):** Caught that the initial implementation capped per OFFLINE WINDOW (time since last save), not per item's whole life — so a task left overdue across several separate open/close cycles over multiple days could be charged close to the 12 HP cap EACH time it was reopened, which drifts back toward "duration of absence matters," the exact thing the cap was designed to prevent. Fixed: added `item.offlineDamageCharged` (persisted, defaults 0 for old saves), a running lifetime total per item. `computeOfflineOverdueDamage` now takes `alreadyCharged` and only allows damage up to the item's REMAINING budget (`cap - alreadyCharged`); `applyOfflineDamage` increments the item's total after each hit. Once an item has been charged its full 12 HP ever, no further offline time against that same item charges anything — only breadth (more neglected items) can add up to more damage, never duration on one item. Test added: 5 simulated same-item restores across separate days sum to exactly the cap, not 5×cap.
**Companion fix — editing an overdue task's due date didn't stop the damage:** Jeremy asked whether users can adjust an over-aggressive due date; `showEditTaskModal` already let you change it, but `isOverdue` was only ever set forward (by `markAsOverdue`/`updateActiveItems`) and never re-derived from the due date on edit — so pushing a deadline into the future left the zombie camped at the base still ticking live damage every `DAMAGE_INTERVAL_MS`, defeating the escape hatch entirely. Added `recomputeOverdueStateAfterEdit(item)` (script.js, near `markAsOverdue`): re-checks `dueDateTime` against now and either un-marks overdue (clears classes, resets timeline position, clears `lastDamageTickTime`) or marks it overdue starting now if the edit pulled the date into the past. Wired into the task edit modal's save handler; also added the `saveGame()` call that handler was missing (previously relied solely on the 5s autosave safety net).
**Verified:** `node --check script.js` passes. `test/offline-catchup.test.js` (mirror-style, matches the file's existing convention) covers: single-window cap behavior, no-double-charge with the live tick loop, and three new lifetime-cap cases (already-fully-charged charges 0 more, partial headroom is respected, 5 simulated cross-day restores on one item sum to exactly the cap). Not yet live-playtested by Jeremy — pending his next session.

## 2026-07-17 — `createListItem` refactored into task/habit branches; habit rows now get a real edit path
**Decision:** Followed up the habit-modal bug fix (below) by addressing its root cause more broadly: `createListItem` was written task-first, so habit-unsafe assumptions kept hiding in it (two were found and fixed reactively). Restructured the function into a shared shell (sprite, name, complete-checkbox, due-date, category badge — identical for every type) plus explicit branches:
- **task branch:** high-priority list class, edit pencil → `showEditTaskModal`, the "+ Sub-task" button, and the sub-task render loop. None of this is built at all for non-tasks now (previously the sub-task DOM was still constructed, just empty, for every type).
- **habit branch:** streak/avoided badge, edit pencil → new `showEditHabitInstanceModal(itemData)`, which resolves the instance's `definitionId` back to `definedHabits` and opens the existing habit-definition editor (`showEditHabitForm`). There was no habit-instance editor before this — the pencil on a habit row previously opened `showEditTaskModal`, a task-shaped editor with no habit fields, which would have silently clobbered a habit's shape if ever saved (never reached in practice, since habit rows never rendered until the modal-bug fix).
- **default branch:** any unrecognized `itemData.type` renders the shared shell only and `console.warn`s, so a future new item type degrades instead of throwing.
**Also changed:** `window.saveEditedHabit` (the habit-definition editor's save handler) now also syncs any already-spawned active instance of that habit (name/category/isNegative, sprite classes, list item, `saveGame()`) after updating the definition — previously it only updated `definedHabits` and left today's live row stale until the next day's instance regenerated. Frequency/timeOfDay are deliberately NOT back-applied to an existing instance (recomputing today's due time retroactively is more involved and not needed for this fix).
**Why:** The habit-modal bug happened because habit-unsafe code could sit unexercised in a task-shaped function indefinitely. Explicit branches make "does this apply to habits?" a visible question at each call site instead of an implicit one, and the default-branch warning gives any future item type a safe landing instead of a silent throw. Confirmed with Jeremy this was worth doing now rather than deferring to Milestone 2's UI extraction, given how cheap the fix was once the shell/branch split was drawn.
**Verified:** `node --check script.js` passes. Added `test/create-list-item-branching.test.js` — a hand-maintained mirror of the branch structure (script.js has no module.exports; see below), asserting a task renders with the task editor + sub-task section and no streak badge, a habit renders with the habit editor + streak badge and no sub-task section (using a habit object that omits `subTasks` entirely, the exact shape that used to throw), and an unrecognized type warns without throwing. Full suite: 17/17 passing. Live-verified in Jeremy's browser via Cowork's Chrome control: created one task + one habit, confirmed only the task shows "+ SUB-TASK" and only the habit shows "Streak: 0", clicked the task pencil → "Edit Task" modal with task fields, clicked the habit pencil → "Edit Habit" modal pre-filled from the definition, edited the habit name and saved → the agenda row updated immediately (no reload) to the new name, confirmed both `definedHabits` and the live `activeItems` entry show the new name in the persisted save. Zero console exceptions from script.js (six unrelated "message channel closed" exceptions are Chrome-extension messaging noise, not app code). Test habits/tasks cleared from localStorage afterward.
**Rejected:** Deferring this entirely to the Milestone 2 UI extraction — reasonable, but the branch split cost little once the bug was already being root-caused, and leaving the mis-wired task-editor pencil live on habit rows (now that habits actually render) would have been a real data-shape hazard the first time someone clicked it.
**Follow-up (not done):** `showEditTaskModal`'s own sub-task edit path (script.js ~730) still points every sub-task's pencil at the task editor, which is correct today (sub-tasks are tasks) but should be re-checked if sub-tasks ever gain their own type. Frequency/timeOfDay changes not retroactively applied to a live habit instance — same category as the deferred offline-catch-up decision, revisit if it becomes a real complaint.

## 2026-07-17 — Habit-modal-doesn't-close bug: two habit-unsafe references in `createListItem` (root-caused live via Cowork's Chrome control)
**Decision:** Fixed the "create-habit modal doesn't close on Save, re-click duplicates the habit + sprite" bug (logged as a NEW bug in the persistence session's playtest). Root cause was NOT in the modal/Save handler at all — it was two latent bugs in `createListItem(itemData)` that throw for any `type: 'habit'` item, aborting `createHabitDefinition` before its trailing `closeModal()` ran:
1. `script.js:687` — `itemData.subTasks.forEach(...)` was unconditional, but only tasks get `subTasks: []` (createTaskItemData); habit instances never set the field, so it's `undefined`. Fixed to `(itemData.subTasks || []).forEach(...)`, matching the existing defensive pattern at line 300.
2. `script.js:791` — the habit-only streak badge block did `itemNameContainer.appendChild(streakSpan)`, but `itemNameContainer` is never declared anywhere in the function (phantom variable → ReferenceError). Fixed to `itemDetailsContainer.appendChild(streakSpan)` — places the "Streak: N" badge next to the category badge the code appends two lines earlier, which is the coherent spot.
**Why it presented as a "modal" bug:** `addItemToGame` draws the board sprite BEFORE calling `createListItem`, so the sprite appeared (making it look like creation succeeded) but the list-item build then threw, so `createHabitDefinition` → `attachModalEventListeners`' habit handler never reached `closeModal()`. Modal stayed open; each re-click pushed another `definedHabits` entry + drew another sprite. Bug #2 was masked by bug #1 — habits died at line 687 first, so line 791 had never executed until #1 was fixed (classic layered failure; found #2 only by re-testing after #1). Both also fired on the boot restore path (`restoreGameState` → `generateDailyHabitInstances` → `createListItem`), which is why restored habits rendered sprites but no agenda rows.
**How verified:** Cowork drove Jeremy's actual browser (Claude-in-Chrome extension) against his local `node server.js`. Reproduced the exact stack twice from the live console (`TypeError: Cannot read properties of undefined (reading 'forEach')` at createListItem:687, then after fix #1, `ReferenceError: itemNameContainer is not defined` at createListItem:791). After both fixes + hard reload (cache-bust needed — Chrome had cached script.js): created a habit → modal closed (`modalsOpen: 0`), exactly one `definedHabits` entry, one sprite, one agenda row with the Streak badge, zero console exceptions; existing habits also render as agenda rows on reload for the first time. Test habits cleaned out of localStorage afterward. `node --check script.js` passes.
**Follow-up (NOT done this session):** the underlying fragility is that `createListItem` was written task-first and only ever exercised on tasks; a Milestone 2 extraction of the UI/list code should give habits their own tested render path (or a shared one with explicit type branches) rather than relying on truthy/defined-by-accident fields. Same falsy/undefined-field family as the itemIdCounter start-at-1 and parentId truthy-check landmines already logged.

## 2026-07-17 — localStorage persistence: schemaVersion 1 saves the CURRENT in-memory shapes, not the target schema
**Decision:** Implemented Milestone 1 persistence (`js/persistence.js` + wiring in script.js/index.html). schemaVersion 1 serializes the monolith's existing state exactly as it is in memory — numeric item ids, `activeItems`/`completedItems` arrays, `definedHabits`/`definedRoutines`, player scalars, `currentGameDate`, `itemIdCounter` — rather than reshaping to the target schema in docs/DATA_SCHEMA.md (string ids, `status` fields, `Run`/`TokenInventory` objects). Shape reconciliation happens during Milestone 2 extractions via schemaVersion bumps + a migration chain already scaffolded in `js/persistence.js`.
**Why:** Reconciling shapes now would drag the whole Milestone 2 refactor (and the falsy-id cleanup) into a "persistence" session, violating the one-task rule. Persisting what exists is the smallest correct step; migrations are the designed path for shape changes (DATA_SCHEMA.md "Rules"). Confirmed with Jeremy 2026-07-17.
**Rejected:** Writing saves in the target schema immediately — would require converting between disk and memory shapes on every save/load (two representations to keep in sync during the refactor) or reshaping all runtime code now (a rewrite, not a persistence task).
**Implementation notes:**
- `Persistence` module (IIFE, global + module.exports like CONFIG): `requestSave(getState)` debounced 500ms, `flush()` on `visibilitychange:hidden` + `beforeunload` (visibilitychange because beforeunload is unreliable on mobile Chrome — this is a mobile-first app), `load()` with a strict ISO-datetime reviver that restores Date objects, `clear()` on restart-after-game-over. DOM refs (`element`, `listItemElement`) stripped by the serializer, rebuilt on load.
- Restore path (`restoreGameState()`, called once after `initGame()` on boot): restores scalars/definitions, re-adds active items through `addItemToGame()` (rebuilds sprites/list items), re-applies overdue visual classes (markAsOverdue early-returns for already-overdue items), rebuilds parent list items after all sub-tasks exist in `activeItems` (createListItem looks siblings up there), then `generateDailyHabitInstances()` for any instances the save predates.
- **Offline overdue damage is deliberately NOT charged on load:** restored overdue items get `lastDamageTickTime = Date.now()`. Otherwise `updateActiveItems()` would hammer the base with one damage tick per game tick until "caught up" (hours offline ≈ instant base death on morning load). Elapsed-time behavior is exactly the scope of the separate "offline catch-up" Milestone 1 task — decide it there.
- Save triggers: explicit `saveGame()` at 13 mutation sites (add/complete/uncomplete/remove item, markAsOverdue, damageBase, gameOver, habit/routine create+delete, restart) plus a `CONFIG.PERSISTENCE_AUTOSAVE_MS` (5s) safety-net save in `updateGame()` for edit paths not yet individually hooked (routine editors, task edit modal). Follow-up: hook those directly and drop the safety net once Milestone 2 extracts the UI code.
- Date revival uses a strict full ISO-datetime regex, so strings that merely contain a date (task names, `habitDef_…` ids, `timeOfDay` values) can never be converted — verified in a sandbox round-trip test.

## 2026-07-17 — Fifth same-day follow-up: cluster offsets now use measured VISIBLE sprite edges, not box edges
**Decision:** Jeremy spotted the next layer of the spacing problem himself: the zombie PNGs have large transparent margins, so even box-edge-correct offsets leave visually inconsistent gaps (the visible zombie is much narrower than its 128px box). He suggested using "the middle third" of the parent box as the reference — actual measurement turned out even better: I analyzed all 16 PNGs' alpha channels (Pillow/numpy, alpha>25 bounding box) and the visible graphic ranges from 44% of the box width (health) to 92% (relationships), and is NOT centered (e.g. lifestyle: 17% left margin, 5% right; financial: 11% left, 25% right) — so a flat "middle third" rule would still be off by up to ~20px per side depending on category.
**Fix:** Added `CONFIG.ZOMBIE_VISIBLE_MARGINS` — per-category measured left/right transparent-margin fractions (plus a 0.2/0.2 fallback for unknown categories) — and a `getVisibleEdges(category, boxWidth)` helper in script.js. `getSubTaskClusterOffset` now walks the sibling chain and places each sub-task so its VISIBLE graphic edge sits `SUBTASK_CLUSTER_GAP_PX` (8px) from the previous cluster member's visible edge (parent's visible edge for each side's first sub-task), correctly handling siblings of different categories. Verified with a Node simulation using the real CONFIG values: for Jeremy's exact test case (3 "other" sub-tasks) and a worst-case mix (widest+narrowest sprites), every visible span lands exactly 8px from its neighbor with zero overlaps.
**Why:** Jeremy's own diagnosis, confirmed and refined by measurement. Box-edge math was geometrically correct but visually wrong because the boxes lie about where the art is.
**Rejected:** The "middle third" approximation (Jeremy's fallback suggestion) — real margins vary 5%–31% per side by category, so measured per-category values are strictly better and cost nothing at runtime. Cropping/re-exporting the PNGs to tight bounding boxes — would fix the margin problem at the art level but touches 16 asset files, risks breaking other size/positioning assumptions (habit sprites, list-item sprites reuse the same PNGs), and the art pipeline is Jeremy's domain.
**Re-measurement note:** if sprite art is ever redrawn, re-run: alpha-channel bbox per PNG (`np.where(alpha>25)`), record left/right margins as fractions of width, update `CONFIG.ZOMBIE_VISIBLE_MARGINS`. The 128px and 64px variants measured near-identical fractions, so one entry per category suffices.

## 2026-07-17 — Fourth same-day follow-up: cluster offset math was geometrically wrong (flat ±45/±90 vs. actual 128px/64px sprite sizes)
**Decision:** After the missed-overdue-site fix, Jeremy tested with 3 sub-tasks (two due the same time as the parent, one due later) and still saw the 1st sub-task rendering directly behind the parent and the 2nd "too far ahead." Root cause, finally: the offset step (±45px for the first sibling on each side, ±90px for the second, ...) was an arbitrary guess that never accounted for actual sprite sizes. The parent sprite is 128px wide; a sub-task offset by only 45px from the parent's left edge still overlaps it almost entirely (45+64=109 < 128) — so the "1st sub-task" was never going to look separated no matter how consistently the offset was applied elsewhere. This is a pure geometry bug, not a due-date/threshold logic bug (those were already correct).
**Fix:** Rewrote `getSubTaskClusterOffset` in script.js to compute offsets from real widths instead of a flat guess: right-side sub-tasks start at `ENEMY_WIDTH + gap` (clearing the parent's right edge) and each further right-side sibling adds `SUBTASK_ENEMY_WIDTH + gap`; left-side sub-tasks start at `-(SUBTASK_ENEMY_WIDTH + gap)` (clearing the parent's left edge) and each further left-side sibling steps out by the same amount. With `ENEMY_WIDTH=128`, `SUBTASK_ENEMY_WIDTH=64`, `gap=8`: offsets come out to +136, -72, +208, -144, +280, ... — verified by hand (and a throwaway Node script) that none of these spans overlap the parent's [0,128] span or an earlier same-side sibling's span. Added `SUBTASK_ENEMY_WIDTH` (64), `SUBTASK_CLUSTER_GAP_PX` (8), and moved `SUBTASK_AHEAD_THRESHOLD_PX` (150, previously a local script.js const) into `js/config.js` — these are exactly the kind of "gameplay/visual constants" `CONFIG` is meant to hold, and having the real sub-task width in one place means the offset math can't drift out of sync with the size actually used to render the sprite (`addItemToGame`'s `itemSpriteWidth`/`itemSpriteHeight` for sub-tasks now also reference `CONFIG.SUBTASK_ENEMY_WIDTH` instead of a separate hardcoded `64`).
**Why:** Three rounds of "still not right" pointed at the offset MAGNITUDE, not the branching logic (parent-tracking vs. own-timeline, overdue handling) — all of which checked out correct on inspection. Actually computing the spans by hand made the overlap obvious immediately; should have done this arithmetic check before picking 45/90 in the first place.
**Rejected:** Continuing to guess-and-check offset constants without doing the span math — already cost multiple round trips; verifying the actual geometry (parent half-width + sub-task half-width + gap) is the more reliable approach going forward for any further tuning.
**Follow-up:** If Jeremy still wants tighter/looser spacing after this, `SUBTASK_CLUSTER_GAP_PX` in `js/config.js` is the one number to adjust — the rest of the formula derives from actual sprite widths and shouldn't need to change.

---

## 2026-07-17 — Third same-day follow-up: a fourth overdue-positioning site was missed, still bypassing clustering
**Decision:** After the `calculateTimelineXWithClustering` fix, Jeremy playtested again and reported it looked "almost the exact same as before" — one sub-task still nearly overlapping the parent, another still far away. Root cause: `addItemToGame()` — the function that actually runs at creation time for every new item — has its OWN separate "already overdue at creation" check (script.js ~line 465: `if (itemData.dueDateTime < new Date()) { markAsOverdue(...); itemData.x = BASE_WIDTH; ... }`), distinct from the two overdue checks already fixed today (`uncompleteItem`, `updateActiveItems`). This one was missed — it still set `x = BASE_WIDTH` with no cluster offset at all. Given the test tasks were due "5:00 PM" on the current date and testing happened after 5pm, both the parent and its sub-tasks were very likely already overdue *at the moment of creation*, so this exact unfixed branch fired every time — which is why the clustering fix appeared to have no effect.
**Fix:** `itemData.x = BASE_WIDTH;` → `itemData.x = BASE_WIDTH + getSubTaskClusterOffset(itemData);` at script.js line 467. All three places script.js can assign an overdue item's x (`addItemToGame` creation-time check, `uncompleteItem` restore, `updateActiveItems` per-tick) now consistently include the offset. Confirmed via `grep '\.x = BASE_WIDTH'` that these are the only three assignment sites in the file.
**Why:** Directly caused by an incomplete sweep during the earlier clustering fix — should have grepped for all `BASE_WIDTH` assignments up front rather than fixing the two sites found by reading through the tick loop and uncomplete-restore functions.
**Follow-up:** None — this closes out the "why doesn't clustering ever seem to apply" thread. If Jeremy still sees inconsistent spacing after this, the next thing to check is whether the items are being marked overdue in the first place (test with due times a few hours in the future rather than already-past) versus a genuinely new bug.

---

## 2026-07-17 — Sub-task sprites: fixed cropping (CSS `!important` conflict) + added parent-clustering positioning
**Decision:** After the id-0 duplication fix, Jeremy playtested again and found two more issues with sub-task rendering: (1) the sub-task sprite was visibly cropped rather than scaled down, and (2) sub-tasks should render at the same vertical level as their parent, offset left/right, so they visually cluster near it — his explicit request, since neither the current code nor docs/MECHANICS.md described this.

**(1) Cropping root cause:** `.enemy.category-<X>` ("Legacy classes (maintaining backward compatibility)", style.css ~line 311) sets `background-image`/`background-size: 128px 128px` with `!important`. Every enemy sprite — including 64px sub-tasks and 70px habits — gets both this legacy class AND its size-specific class (`zombie-subtask`/`zombie-small`) from script.js's `addItemToGame`. The size-specific rules (style.css ~line 423 habits, ~471 sub-tasks) set the correct smaller size but without `!important`, so the legacy `!important` rule won regardless of selector specificity — forcing the full 128px image into a 64px (or 70px) container, which clips instead of scales. **Fix:** added `!important` to the size-specific rules' `background-image`/`background-size` too; since both sides now have `!important`, the more specific selector (3 classes vs. 2) wins as expected. This fixes sub-task sprites (report's Assets/Zombies/*-64.png) and habit sprites (same root cause, same fix, not separately reported but would have hit the same bug).
**(2) Clustering:** Added two helpers in script.js (`getSubTaskClusterOffset`, `getItemTopPosition`, next to `calculateTimelinePosition`). Sub-tasks now render at their parent's exact vertical position (read from `parentTask.element.style.top`) instead of a random height, and get a horizontal offset from the timeline-calculated x: alternating right/left per sibling, stepping outward (+45, -45, +90, -90, ...), ordered by id (creation order) so the arrangement stays stable as older siblings complete. Applied at all 4 places script.js computes an item's `x` (creation, uncomplete-restore, and the per-tick timeline update) and both places it sets `top` (creation, uncomplete-restore) — sub-tasks still track their own due-date timeline position, just nudged to cluster near the parent rather than floating independently.
**Why:** Directly reported/requested by Jeremy from live playtesting — this is the first time sub-task rendering has been visually exercised at all (script.js couldn't parse before today).
**Rejected:** Removing `!important` from the legacy `.enemy.category-<X>` rules instead of adding it to the size-specific ones — riskier, since other consumers of that legacy class might depend on it winning elsewhere; matching specificity+importance on the more-specific rules was more surgical.
**Follow-up:** `docs/MECHANICS.md` "Sub-tasks" section updated to describe this behavior and flag that it doesn't match the original PROJECT_SPEC.md idea of a growing/shrinking parent sprite — that's an open design question for Milestone 3, not resolved today. Also noticed (not fixed): `uncompleteItem()` doesn't re-add the `subtask-enemy`/`zombie-subtask` classes or 64px sizing when restoring a completed sub-task — it would come back full-size. Separate, lower-priority bug; logged here for a future session.

**Same-day follow-up — bottom alignment + stacking order:** Jeremy refined the clustering request further: sub-tasks should bottom-align with the parent ("shoes lined up on the same level") rather than top-align, and the parent sprite should always render above any overlapping sub-task. Top-aligning was what `getItemTopPosition` actually did (returned the parent's `top` directly) — since sub-tasks are shorter (64px vs. the parent's 128px), that lines up their heads, not their feet. **Fix:** `getItemTopPosition` now returns `parentTop + (parentHeight - itemHeight)`, reading the parent's actual rendered height off its element rather than assuming 128, so this still works if a future shrinking-parent visual (see above) changes parent height dynamically. For stacking: added `z-index: 10` to the base `.enemy` rule (style.css) and `z-index: 5` to `.zombie-subtask` — sub-task sprites previously had no explicit z-index and, being added to the DOM after their parent, were winning the default stacking order and could render on top of it. The existing higher z-index values (`.enemy:hover` = 20, `.enemy.high-priority` = 15) are unaffected and still take precedence over the new baseline.

**Second same-day follow-up — clustering was still driven by each sub-task's own due date, causing wildly inconsistent spacing:** Jeremy playtested again and found one sub-task rendering almost exactly behind the parent (barely offset) and another rendering far away — even though the ±45/±90px cluster offset should have kept both visually close. Root cause: the offset was being added on top of `calculateTimelinePosition(item, ...)`, which computes a sub-task's x purely from *its own* due date — and the timeline formula maps hours-until-due nonlinearly across the full screen width, so even a small difference between a sub-task's due time and its parent's (e.g. inherited-but-then-edited, or just created a few minutes later) can produce a base x tens or hundreds of pixels away from the parent's. The ±45px cluster offset is negligible next to that. Jeremy's clarified intent: sub-tasks should track the *parent's* timeline position by default (clustered, offset only growing with sibling count) and only break away to show their own due-date position when that position is due *significantly* earlier than the parent's (i.e., meaningfully more urgent, further toward the base) — otherwise differences in due time shouldn't visually separate them from the parent at all.
**Fix:** added `calculateTimelineXWithClustering(item, currentTime)` in script.js (next to `getSubTaskClusterOffset`), replacing the `calculateTimelinePosition(item, ...) + getSubTaskClusterOffset(item)` pattern at all 3 non-overdue call sites (creation, uncomplete-restore, per-tick update). For a sub-task it computes both its own timeline x and its parent's current x; if the sub-task's own position isn't at least `SUBTASK_AHEAD_THRESHOLD_PX` (150px, a starting guess — easy to retune, not a balance number) closer to the base than the parent's, it uses `parentTask.x + getSubTaskClusterOffset(item)` (clustered) instead of its own due-date-driven position. Only when the gap exceeds that threshold does it fall through to its own real timeline position. The overdue branches (both parent and sub-task at `BASE_WIDTH + offset`) were left unchanged — overdue is already the correct "maximally ahead" case.
**Why:** Directly reported/requested by Jeremy from live playtesting; clarifies that clustering should be the default and due-date-driven independence the exception, not the reverse.
**Rejected:** Snapping the sub-task's due date itself to the parent's (would misrepresent the actual due time elsewhere in the UI, e.g. the agenda list) — the fix is purely visual/positional, due date data is untouched.
**Follow-up:** `SUBTASK_AHEAD_THRESHOLD_PX` (150) is a first guess at "significantly earlier" — if it feels off in practice (triggers too easily/rarely), it's a one-line constant to retune, not a structural change.

## 2026-07-17 — Sub-task duplication bug, take 2: task id 0 is falsy (found via Jeremy's live playtest)
**Decision:** Jeremy loaded the game in a browser for the first time after today's parse fixes and immediately reproduced sub-task duplication: a sub-task ("little test") of his first-ever task ("test") rendered both correctly nested under its parent AND as its own standalone top-level task with its own "+ Sub-task" button. Root cause: `itemIdCounter` starts at 0 (script.js `initGame()`), so the first task created gets `id: 0`. Every sub-task/parent check in script.js is written as a truthy test — `if (itemData.parentId)`, `if (!item.parentId)`, etc. (10+ call sites: lines ~223, 345, 414, 461, 604, 854, 901, 1150, 1223, 1284, 2646) — and `0` is falsy in JavaScript, so a sub-task whose `parentId` is `0` fails every one of those checks and gets treated as if it had no parent at all. The `38409ca` guard clauses (verified "fixed" earlier today) are real and correct in spirit, but nobody had hit id 0 in a live browser before — script.js couldn't even parse until today's session, and the existing Jest test is a self-contained mirror that doesn't hit this edge case either. **Fix:** changed `itemIdCounter = 0` to `itemIdCounter = 1` in `initGame()` — the minimal, lowest-risk change that guarantees no task/sub-task can ever have the falsy id, without touching the ~10 truthy-check call sites.
**Why:** Directly reported by Jeremy from his first real playtest; root cause was unambiguous (single shared cause explains the exact symptom across every affected call site).
**Rejected:** Rewriting all ~10 `parentId` truthy checks to explicit `!= null` comparisons — more technically correct long-term (worth doing eventually, since "falsy id" is a fragile pattern that could resurface elsewhere), but higher risk/diff size for an unplanned mid-session fix. Logged here as a good Milestone 2 cleanup candidate rather than done now.
**Follow-up:** Consider auditing script.js for other places that may assume ids are non-zero/truthy (e.g., `definedHabits`/`definedRoutines` id counters, if separate) during the Milestone 2 extraction pass.

## 2026-07-17 — Created `js/config.js`; migrated gameplay constants; found pre-existing fatal syntax bug in script.js
**Decision:** Created `js/config.js` (a `CONFIG` object, browser global via `<script>` tag, CommonJS-exported for Node/Jest — same pattern as `IdCounter.js`). Moved the entire "Game Settings" block out of script.js (~line 129) into `CONFIG`: `GAME_TICK_MS`, `DAY_DURATION_MS`, `DAMAGE_INTERVAL_MS`, `OVERDUE_DAMAGE`, `XP_PER_TASK_DEFEAT`, `XP_PER_HABIT_COMPLETE`, `POINTS_PER_TASK`, `POINTS_PER_HABIT`, `HABIT_STREAK_BONUS_THRESHOLD`, `LEVEL_XP_THRESHOLDS`, `ROUTINE_SLOTS_PER_LEVEL`. Also pulled in three hardcoded magic numbers that were clearly balance/gameplay constants sitting elsewhere in script.js: `ENEMY_WIDTH`/`HABIT_ENEMY_WIDTH` (128, in `initGame()`), the initial `baseHealth` value (100, renamed `MAX_BASE_HEALTH`), and the habit streak-bonus point bump (previously a bare `5` at two call sites, named `HABIT_STREAK_BONUS_POINTS`). script.js keeps its local `const NAME = CONFIG.NAME` declarations so every existing call site works unchanged — no values were altered, only relocated. Wired `js/config.js` into `index.html`'s script load order, before `IdCounter.js`/`TaskManager.js`/`script.js`. Verified via a standalone Node `require('./js/config.js')` check that every value matches the original hardcoded numbers exactly, and via `grep` that all 13 `CONFIG.*` references in script.js resolve to keys that exist in the object.
**Why:** Milestone 1 roadmap item (docs/ARCHITECTURE.md target layout — `js/config.js` is meant to hold "ALL gameplay numbers").

## 2026-07-17 — script.js was not parseable JS; fixed 4 pre-existing structural defects (full sweep, approved by Jeremy)
**Decision:** While verifying the config.js migration, `node --check script.js` failed with a fatal `SyntaxError`. Investigating turned up four separate, pre-existing defects — confirmed via `git log -p`/`git show HEAD:script.js` to all predate this session (none introduced by the config.js work):

1. **Duplicate `itemIdCounter`/`gameIsOver` declarations** (script.js ~line 50/119 vs ~125). Root cause: dead code — `const itemIdCounter = new IdCounter(); const taskManager = new TaskManager(...)` (line 50-51) constructed a `TaskManager`/`IdCounter` pairing that is never referenced again anywhere in the file (confirmed via `grep taskManager\.` — zero matches; the real game logic uses the `activeItems` array and a plain incrementing `let itemIdCounter` directly instead). Likewise `const { gameIsOver } = window;` (line 119) destructured a `window.gameIsOver` that's never set anywhere (confirmed via repo-wide grep) — dead leftover, while the real `gameIsOver` the whole game reads/writes (`gameIsOver = false`/`= true` at multiple call sites) is the `let` version a few lines below. **Fix:** deleted both dead-code lines/declarations; left the live `let itemIdCounter`/`gameIsOver` untouched.
2. **Missing `function completeItem(itemId) {` header.** The function body (xp/points award, sub-task removal, fade-out animation) existed and is called from 3 sites (all `completeItem(x.id)`), but its declaration line was missing, leaving the body as orphaned top-level statements directly inside the `DOMContentLoaded` closure — this is what `node --check` was actually pointing at (a `missing ) after argument list` error several hundred lines later, where the parser finally gave up). **Fix:** re-inserted the header immediately after the preceding function's closing brace, matching the single-`itemId`-argument shape used at all 3 call sites.
3. **Missing `function uncompleteItem(itemId) {` header.** Same pattern — body (restore from completedItems, recreate enemy element, reverse XP/points) present and called once (`uncompleteItem(item.id)`), header missing. **Fix:** re-inserted, same approach.
4. **Missing `function showCreateSubTaskModal(parentId) {` header.** Same pattern again — `createSubTaskPrompt(parentId)` calls `showCreateSubTaskModal(parentId)`, and a large modal-rendering body clearly written for that function existed right after, but with no declaration line; a docstring comment near the top of the file even references it by name/line number as if it used to be a real function. **Fix:** re-inserted, matching the single-`parentId`-argument call site.

After all four fixes, `node --check script.js` and `node --check js/config.js` both exit clean (no errors). Every fix was restoring/removing structure only — no logic, values, or behavior were changed; each was cross-checked against actual call sites before editing so the re-inserted signatures aren't guesses.
**Also found, NOT fixed (flagged for a future session):** `showForm(formType)` is declared twice (script.js line ~229, full implementation switching between task/habit/routine forms; and again at line ~3368, commented "Legacy form function for routine management", handling only the `'routine'` case). Because later `function` declarations in the same scope override earlier ones, the second, narrower stub silently shadows the real one — meaning `showForm('task')`/`showForm('habit')` currently do nothing when called, a real functional bug (not a parse error, so `node --check` doesn't catch it). Confirmed pre-existing via `grep` on `git show HEAD:script.js`. Left alone this session — deciding whether to delete the stub, rename it, or merge its routine-specific behavior into the real `showForm` is a judgment call, not a mechanical restore.
**Why:** Once `node --check` is broken, it's broken for the *whole file at once* — the parser stops at the first error, so each fix only reveals the *next* one. Jeremy approved a full sweep rather than stopping after the first fix or reverting, given that script.js may not have been loadable in a browser at all in its current committed state. This also means the "Monolith runs" note in previous HANDOFF/CLAUDE.md entries was never actually re-verified — it was carried forward from July 2025 assumptions.
**Rejected:** Reverting the syntax fixes to ship only the config.js change (considered, but Jeremy explicitly chose the full sweep over this); stopping after the first fix and leaving script.js still broken (same reasoning).
**Follow-up:** The `showForm` duplicate/shadowing bug above is a good candidate for a dedicated small session (root-cause already identified, so Sonnet-level once scoped).

## 2026-07-17 — Project home moved: OneDrive → `C:\Users\jscho\Projects\Deadline`
**Decision:** Moved the repo out of `OneDrive\Documents\Claude\Projects\Deadline` to a plain local path, `C:\Users\jscho\Projects\Deadline`. Also discovered and fixed two unrelated blockers hit while merging branches: (1) Windows Git Credential Manager had no `credential.helper` configured, so every `git push` re-triggered a fresh browser OAuth flow instead of caching it — fixed with `git config --global credential.helper manager`. (2) The GitHub remote `schooley02/Deadline` had been deleted/lost at some point after the July 2025 push (404, and the account showed 0 repos) — recreated as a fresh empty repo and re-pushed `main` and `feature/sprite-system-cleanup` with `git push -u`.
**Why:** OneDrive's background sync repeatedly left a stale `.git/index.lock` behind, blocking `git checkout`/`merge` on Jeremy's machine. It wasn't OneDrive alone — moving the folder confirmed the *same* lock file just carried over via `Move-Item` until it was manually deleted (`Remove-Item .git\index.lock -Force`) at the new location, after which checkout/merge/push worked immediately. Separately, Cowork's own device-bridge git reads (even plain `git status`) can leave an unremovable lock behind because that tool cannot delete files on the mounted folder — Claude should read `.git/HEAD` and `.git/refs/**` directly as plain text instead of running `git` at all when checking repo state from Cowork.
**Rejected:** OneDrive selective-sync exclusion (Option A) — untested/uncertain whether the client version supports excluding a nested subfolder; moving out entirely is simpler and permanent. GitHub already provides real backup/version history for this folder, so losing OneDrive sync on it costs nothing.
**Follow-up:** CLAUDE.md and the `deadline-session` Cowork skill both updated to reference the new path and drop the now-stale OneDrive-specific guidance.

## 2026-07-17 — Branches merged: `feature/sprite-system-cleanup` → `main`
**Decision:** Fast-forward merged (`main` was an exact ancestor of the feature branch — 10 commits ahead, 0 behind, no conflicts possible) and pushed both branches to GitHub. `main` now has the full doc/memory system, the sprite/mobile-CSS work, and the verified sub-task-duplication fix.
**Why:** Milestone 1 roadmap item; the branches had diverged since July 2025 with no risk of conflict, so there was no reason to keep working off a feature branch.

## 2026-07-17 — Sub-task duplication bug: already fixed, no new code change needed
**Decision:** Verified (not re-fixed) — the fix described as "Next Steps" in SUBTASK_BUG_REPRODUCTION_REPORT.md was already implemented in commit `38409ca` ("Fix: prevent duplicate regular task when adding subtask", Jul 29 2025), the same commit that added the repro report itself. `addItemToGame()` only calls `createListItem()` when `!itemData.parentId` (script.js ~line 465), and `sortAndRenderActiveList()` only appends items to the DOM list when `!item.parentId` (script.js ~line 1224). Ran `test/subtask-creation.test.js` (14 tests) in the sandbox scratchpad — all pass.
**Why:** HANDOFF.md and ROADMAP.md (written 2026-07-16 during the repo move) described this as an open bug because the repro report reads that way, but they predate a check against the actual code/git history. Confirmed via `git show 38409ca -- script.js` that the guard clauses are already present in the current script.js.
**Note:** `test/subtask-creation.test.js` tests a self-contained copy of the fixed logic (mirrors script.js, doesn't `require` it directly) — matches current script.js line-for-line for the relevant functions, but a future session should consider making the test import the real functions to prevent silent drift.

## 2026-07-16 — Permanent home: OneDrive\Documents\Claude\Projects\Deadline
**Decision:** July 2025 repo copied here (history verified); scaffolding merged in. Jeremy to delete the original C:\Users\jscho\Deadline after verifying; the OneDrive "Baseline - Old\Deadline" folder stays (art sources).
**Why:** Jeremy's choice for project organization. Caveat accepted: OneDrive + git can conflict — folder should be set to "Always keep on this device"; pause sync if git misbehaves.

## 2026-07-16 — Bug-first, then incremental modularization
**Decision:** Milestone 1 fixes the known sub-task duplication bug + adds localStorage + config.js. Milestone 2 extracts one system per session out of script.js, tests green at every step.
**Why:** The monolith works; a big-bang rewrite risks a long broken stretch. The bug is already root-caused with tests written — cheapest possible win first.
**Rejected:** Full port before fixes; staying in the monolith permanently.

## 2026-07-16 — July 2025 codebase supersedes the May MPE
**Decision:** This repo's script.js (3,420 lines, category sprites, timeline movement, routines CRUD) is the canonical code. The May `Deadline-MPE/` (and the copy in Baseline - Old) is frozen reference.
**Why:** Two months of additional work; P0 tickets completed; sprites done.

## 2026-07-16 — "Lost" specs recovered from PROJECT_SPEC.md
**Decision:** Exponential token pricing (base × 1.5^quantity; kits 25/50/100, pushbacks 50/100/300, day-tokens 200) and frozen routine recovery (3+ day negative streak freezes slot; recover via habit edit or 3-day avoidance; daily check-ins) are canonical, documented in ECONOMY.md / ROUTINES.md.
**Why:** They were never lost — PROJECT_SPEC.md (July 2025) contains full definitions.

## 2026-07-16 — Vanilla JS, no framework, no build step
**Decision:** Keep native JS; convert to ES modules early in Milestone 2.
**Why:** Zero toolchain to break; the codebase is already vanilla; context stays simple.
**Rejected:** React/Vite migration.

## 2026-07-16 — DOM rendering stays; canvas only if perf demands
**Why:** Works today; ≤20 enemies on screen; easier to debug/style.

## 2026-07-16 — All balance numbers to live in js/config.js
**Decision:** Created in Milestone 1; constants migrate out of script.js; `balance-tuning` skill governs changes.
**Why:** Scattered constants caused silent drift between code and design intent.

## 2026-07-16 — node_modules untracked
**Decision:** Added .gitignore; `git rm -r --cached node_modules`. Regenerate with `npm install`.
**Why:** It was committed to the repo (thousands of files bloating diffs and status).

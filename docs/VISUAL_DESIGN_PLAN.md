# Visual Design Plan — audit + sequenced polish sessions

Created 2026-07-20 (Cowork session, Fable) from a live screenshot audit of the GitHub Pages
build (desktop 1372px + real 390px mobile render via same-origin iframe), seeded with test
data across categories: 4 tasks (one high-priority, one overdue camper), 2 positive habits,
1 negative-habit lurker, 1 sub-task. Audited against docs/ART_STYLE.md's stated direction:
**pixel art / cartoonish, playful, slightly eerie graveyard — never grim.**

Companion track to Jeremy's week of real daily play (Milestone 6 scoping input). Every
session below is CSS/asset-only or UI-rendering-only — none touches persistence, balance,
or architecture, so they can safely interleave with the play week.

## Audit — what the build looks like today

**The single biggest gap: there is no graveyard.** The battlefield is a flat teal→green CSS
gradient. No ground plane, no horizon, no tombstones, no fog, no night sky — zombies float
at arbitrary heights over what reads as a default-styled div. The base column is a
painterly/illustrated church (style clash with the pixel zombies) with a placeholder
"CHURCH" text overlay and raw brown backdrop strips above/below it that end in a hard edge.
The finished 64×64 pixel zombie sprites are genuinely good — they're the strongest visual
asset in the build and currently carry the entire game feel alone.

**Every game-state indicator is a colored rectangle.** High priority = yellow box + floating
star; overdue = red box glow; negative-habit lurker = solid orange box + 🚫 emoji;
habits = literal dashed border (css/enemyStatus.css:63, intentional per session-73 note —
revisited by this plan as a deliberate decision, V2 below); time-preview ghosts = dashed
yellow boxes; sub-tasks = thin blue box. Individually defensible, together they read as
debug wireframes drawn over the sprites rather than game art.

**Scale/placement inconsistencies:** sprites render at visibly different heights (guitar
zombie ≈ 1.5× the nurse) with no shared ground baseline; overdue campers pile onto the
HUD chip zone; the midnight boundary is a 1px red hairline with a tiny rotated label.

**Mobile (390px) findings — the priority platform is the roughest:**
- Agenda rows overflow and CLIP off the right viewport edge ("Mark as Complete (1 rem…",
  "+ SUB-" truncated). Functional bug territory, not just polish.
- The church column consumes ~40% of canvas width, leaving a sliver of walkable timeline;
  the lurk post lands mid-canvas; with two overdue clusters the canvas is a total sprite
  pileup. Desktop proportions were clearly the design target; mobile got the leftovers.
- Dev Reset button overlaps content bottom-left (ships to prod on Pages).
- FAB menu, management windows, and forms all render fine at 390px — app chrome scales;
  the game canvas doesn't.

**App chrome:** competent generic Material — white cards, system sans, mixed accent colors
(dark-green primary buttons vs teal Backup & Transfer buttons vs mint sub-task chips).
Nothing broken; zero game identity. Category chips already use ART_STYLE.md's palette
(good), though yellow/lime chips put white text on light fills (contrast).

**Side observations logged, deliberately NOT acted on here:**
- ~~Balance: a single overdue camper took the base 100→8 in ~2-3 minutes~~ **Reclassified
  same session: a real BUG, root-caused** (Jeremy confirmed intent is 1 HP/5min capped at
  12; observed −92). Editing a due date into the past parks the damage clock at the old
  due time and loop.js back-pays uncapped at game-tick speed — the last unguarded entry
  of the 2026-07-18 far-past-clock bug family. Full detail + design fork in ROADMAP.md
  Known bugs (2026-07-20 entry).
- Possible bug: Day Pager on Tomorrow showed 3 scheduled habits in the agenda but NO ghost
  sprites on the canvas (expected per UI_UX.md's Day Pager entry). Worth a root-cause look
  in a normal session (ghost position math vs. visibility, maybe rendering off-screen).

## Direction (the design calls this plan bakes in)

1. **The graveyard IS the game's identity — build it in CSS/SVG first, assets later.**
   Layered night-sky→ground gradient, a defined ground band the zombies stand on, SVG
   silhouette props (tombstones, fence, bare tree, moon), optional slow fog drift gated by
   the existing fx-intensity setting + `prefers-reduced-motion`. No new binary assets
   required to get 80% of the mood; pixel-art props can replace silhouettes later.
   **Parallax (added 2026-07-21, decided):** the layers are slider-coupled — each layer's
   `translateX` driven off the time-slider value at a different rate (clouds fastest, far
   silhouettes slower, ground fixed — SUPERSEDED 2026-07-21: ground now moves fastest, see ART_STYLE.md) so scrub direction reads visually and the scene gains
   depth. Idle cloud drift fx-gated like the fog. Camera TILT on scrub was considered and
   REJECTED (rotation breaks the pixel grid; parallax alone delivers the feel — see
   DECISIONS.md 2026-07-21); don't add rotate transforms to the scene.
2. **State indicators move onto the sprites.** The zombie PNGs have transparent backgrounds,
   so CSS `filter: drop-shadow()` produces silhouette-hugging glows for free. Rectangles
   retire: priority = gold silhouette glow + corner badge; overdue = red glow + existing
   shake; habit = soft spectral tint (replaces the dashed border — supersedes the
   session-73 "intentional" note, log in DECISIONS.md); lurker = purple/orange glow +
   lurk-post prop (a signpost/grave it waits at); preview ghost = opacity + desaturate
   (replaces dashed yellow).
3. **Pixel-art church replaces the painterly one; text label dies.** All 5 damage states
   exist as assets but in the wrong style. One art task (commission, AI-gen, or a
   pixelation pass over the current renders) regenerates the set; CSS work integrates the
   base into the scene (no backdrop strips, church sits on the same ground band).
4. **Mobile portrait is a GLANCE STRIP, not a shrunken battlefield (Jeremy's design,
   2026-07-20, this session — supersedes the original "cap the proportions" scope).**
   Portrait: the canvas collapses to a thin (~64-80px) threat strip — church icon at the
   left edge (reuse `Assets/icons/icon-192.png`, already a church crop), category-colored
   dot/icon markers positioned by the SAME `Clock.calculateTimelinePosition` math, cluster
   count badges instead of overlap, midnight line when on-screen, base-edge deadline
   marker — and anything OVERDUE renders as the actual small zombie sprite, pulsing at the
   base edge (the threat materializes exactly when it matters). Below the strip: week
   strip + day pager stay prominent, hour slider slims to a thin scrubber track; the list
   owns the rest of the screen. Landscape: the full desktop scene (V1's graveyard), canvas
   down to the slider, list scrollable beneath — plus tap-to-interact: hero chip opens
   that routine's management window, enemy tap opens the existing popup (complete/edit/
   pushback from the game view). Both tap behaviors ship on desktop too. Implementation
   rule: the strip is a CSS/render VARIANT of the same DOM and state (media query swaps
   sprite classes for marker classes), never a second component — one source of truth.
5. **App chrome unifies on the EXISTING token system, then gets a light theming pass.**
   base.css already defines the palette + Inter; the gap is enforcement (hardcoded colors
   and two competing primary greens in live use). Add one display font for headers/HUD
   (pixel-adjacent, e.g. a chunky rounded face — NOT body text), consistent button
   hierarchy. Theming stays light: this is a productivity
   app you live in daily; parchment-and-bones kitsch would wear thin fast.

## Execution sessions (all Sonnet unless noted; one per session, commit each)

- [x] **V1 — Graveyard atmosphere** (2026-07-21, Cowork session, Sonnet) (`css/gameCanvas.css`,
  `index.html` — inline SVG props, no new `Assets/scene/` file needed): sky/ground layers, ground
  band, silhouette props (hill, 3 bare trees, fence, 3 tombstones, moon), midnight line restyled
  as a gate/fence break, slider-coupled parallax (clouds fastest, silhouettes slower, ground
  fixed — `--scene-progress` set by `js/ui/timeSliderView.js`), idle cloud drift + fog gated
  behind fx-intensity + reduced-motion. **Found + fixed live in Chrome:** the negative-z-index
  scene layers were invisible until `#gameCanvas` got `z-index: 0` to establish its own stacking
  context — see `docs/UI_UX.md`'s new section for the full mechanism (general gotcha for any
  future negative-z decorative layer). **Zombies bottom-aligned to the ground band: NOT done —
  split off per this task's own stop condition.** `Movement.getItemTopPosition` randomizes a
  top-level item's vertical position across the FULL canvas height, not a band; narrowing that
  range is real lane-math (affects multi-item overlap), which is exactly what this task said to
  stop and split rather than change unilaterally. The visual ground band is ready; next session
  needs a small `movement.js` change to actually put zombies on it — logged in ROADMAP.
  Live-verified in Chrome against Jeremy's real `node server.js`: desktop + 390×844 (no page
  overflow), parallax transform confirmed across the full 0–1439 minute range, fx-off/fx-reduced
  correctly stop idle animations, hero-chip zone unchanged, zero console errors.
- [x] **V2 — State-indicator redesign (BUILT 2026-10-12, Claude app session; CSS only — `enemyStatus.css`, `enemySprites.css`, `enemyAnim.css`, `timeSlider.css`; sw.js v12; mechanism in docs/UI_UX.md "Enemy state glows"; supersession logged in DECISIONS.md). Live-checked in the built-in browser with real class combos (all states, stacked states, fx modes). STILL OPEN: phone perf check with 10+ sprites; Jeremy wants a stronger differentiator set planned later. Original spec follows.** — (`css/enemyStatus.css`, `css/enemySprites.css`):
  drop-shadow glows replace all rectangle borders (priority/overdue/lurker/habit/sub-task/
  preview-ghost). Requires a DECISIONS.md entry superseding the intentional-dashed-border
  note. Check `.time-preview-ghost` styling on base/HUD/hero-chips still reads once enemy
  dashes are gone. Verify glow perf with 10+ sprites on a phone (drop-shadow is per-frame;
  fall back to outline-style box-shadow under `fx-reduced` if Jeremy sees jank).
- [x] **V3a — Mobile agenda overflow + dev chrome** (2026-07-21, Cowork session, Sonnet)
  (`css/responsive.css`, `css/agendaList.css`, `js/ui/settingsView.js`): agenda row flex fixes
  (rows were CLIPPING off the right edge at 390px — two separate nowrap flex chains, one inside
  `.item-info`, one in the sibling `.sub-tasks-section`; see docs/UI_UX.md and DECISIONS.md for
  the full root cause) and Reset Game gated behind `isDevMode()` (localhost/127.0.0.1 or `?dev`).
  `test/settings-view-devmode.test.js` (+6). 60 suites, 1270/1270. Live-verified in Chrome via a
  same-origin 390×844 iframe against Jeremy's real `node server.js` — no overflow on any agenda
  row (checked via `scrollWidth`/`getBoundingClientRect`, not just visually), Reset correctly
  shown on localhost and correctly computed `false` for a simulated production hostname with no
  `?dev` param.
- [x] **V3b-1 — Portrait glance strip, core (BUILT 2026-10-13, Claude app session; `js/layout.js`, `css/glanceStrip.css`, sw.js v13; mechanism in docs/UI_UX.md "Portrait glance strip"; DECISIONS.md 2026-10-13). Live-checked at 390x844 in the built-in browser. STILL OPEN: Jeremy's real-phone check. V3b-2 (lanes + overlap/pile badges) BUILT 2026-10-13 — see ROADMAP. Original spec follows.**
- [ ] **V3b — Portrait glance strip** (NOTE 2026-10-12, Jeremy's phone report: on a ~370px canvas a parent due soon sits with its right edge at the midnight line, and its right-fanned sub-task (`getSubTaskClusterOffset`) lands PAST the line, reading as "due after midnight" though only the cluster offset puts it there. Reproduced at 390px: parent box 130-268, line 263, sub 241-305. The strip's markers-at-own-timeline-position + cluster badges are the intended fix — don't patch movement.js separately.) (Direction #4; `css/responsive.css`,
  `css/gameCanvas.css`, likely a small marker-rendering hook in the sprite/DOM path —
  if it grows beyond CSS + a render branch, split it): strip layout, marker variant
  classes, cluster badges, overdue-sprite exception, slim slider, week strip/pager kept.
  Live-verify portrait at 390px (iframe trick, HANDOFF 2026-07-20) AND on Jeremy's phone.
- [x] **V3c — Landscape scene + tap-to-interact (DONE 2026-10-14, phone-confirmed; V3c-1 tappable chips + V3c-2 list chips; pixel avatars + chip layout deferred to after V4 — ROADMAP). RE-SCOPED 2026-10-14, Fable; see DECISIONS.md
  2026-10-14.** Landscape already gets the full scene (strip is portrait-only, `Layout.GLANCE_QUERY`),
  `manifest.json` orientation is `any` — nothing to build there. Remaining:
  - **V3c-1 — tap-to-interact + chip trim:** hero chip tap → `showRoutineManagement(routineId)`
    (drop `pointer-events: none` on `#heroBaseZone`, hit area ≥44px without changing the visual
    size), "+N" chip → Routines window; chip loses the emoji/initial identity text and the `Lv N`
    badge (keeps stars + health; avatar slot shows the category emoji as a placeholder until the
    pixel avatars exist). Verify enemy taps in a crowded landscape pile (fan-out + lanes) hit the
    intended sprite. Check rotating mid-scrub / mid-pager-preview: preview should END cleanly
    (snap to now) rather than strand ghosts. Desktop gets the same taps.
  - **V3c-2 — list-row hero badges:** routine-owned agenda rows (habit via `habitDef.routineId`,
    routine-task instances) show a small hero avatar badge; tap → that routine's management
    window. Portrait's only hero entry point. Time order untouched.
  - **Deferred until after V4 (church redesign):** pixel hero avatars (8 category sprites + neutral
    default, PixelLab; brief must give heroes a distinct palette / right-facing pose / chip frame so
    they never read as zombies), chip size + placement in landscape, portrait chip placement.
- [ ] **V4 — Pixel church + base integration** (art task + `css/gameCanvas.css`): regenerate
  `Assets/Base/base_000..100.png` in pixel style (5 damage states, same filenames — zero
  code churn), remove the CHURCH label, blend base into the V1 ground band. **UNBLOCKED
  2026-07-21: art source = AI-generate** (Retro Diffusion, current renders as style
  reference; PixelLab for any animation frames). See DECISIONS.md 2026-07-21.
- [ ] **V5 — Design tokens + app chrome** (`css/base.css` already defines a full `:root`
  palette + Inter — this session ENFORCES it, not builds it): decide one primary action
  color (`--color-primary-dark-green` vs `--color-accent-teal` are both in live use as
  button fills — pick one, demote the other), sweep hardcoded colors in the other 20 css
  files onto the variables, fix light-chip contrast (dark text on yellow/lime), display
  font for headers + HUD chips, HUD chips restyled (consistent, slightly game-y, legible).
- [ ] **V6 — Juice pass** (last, after Jeremy's play week — his playtest notes should pick
  the moments): defeat explosion, spawn, hit feedback, XP/points popups, all fx-gated.
  Coordinate with whatever Milestone 6 scoping decides; don't pre-build.

Suggested order: V3a (functional bug) can go first or batch with V1; then V1 → V2 → V3b →
V3c (V3c wants V1's scene done); V4 anytime (art call made 2026-07-21: AI-generate pixel);
V5 anytime; V6 waits for play data. V1's graveyard primarily serves desktop/landscape — the portrait strip
gets at most a minimal sky/ground backdrop, no props.

## Hazards (audit-discovered, for the executing sessions)

- ~~Habit dashed border is currently INTENTIONAL~~ — superseded and logged by V2 (2026-10-12).
  (Original note: V2 must log the supersession, not silently restyle.) Ghost-vs-habit dashes are separate rules; kill both.
- `.time-preview-ghost` applies opacity-dim to base/HUD/hero chips too — V2's enemy changes
  must not orphan those.
- Hero chips render over the base's leftmost 120px (heroes.js) — V1/V3/V4 layout changes
  must keep that zone (test with an active routine; the audit save has none).
- sw.js CACHE_NAME must bump any session that adds/removes a shell file (new font, SVG
  scene file, css) or returning installs serve stale shells (UI_UX.md PWA note).
- Google-font additions affect offline PWA: self-host the font file into Assets/ and add
  it to the SW file list instead of a `<link>` to fonts.googleapis.com.
- The Cowork Chrome profile's Pages-origin localStorage now holds this audit's seeded dev
  save (7 items, base at ~9HP) — fine to keep for V1-V3 live-verification, reset freely.
  Jeremy's phone save is untouched (localStorage is per-device).

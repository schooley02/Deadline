# Deadline — Tower Defense Productivity Game

Deadline turns your to-do lists, habits, and routines into a tower defense game: tasks and habits are zombies advancing toward a church base, defeated by completing them in real life. Mobile-first web app (Chrome/Android priority). This repo is the July 2025 Claude Code prototype plus a documentation/memory system added 2026-07-16 to keep sessions context-safe.

## Session Protocol (do this at the start of EVERY session)

1. Read `sessions/HANDOFF.md` — only the topmost (latest) entry.
2. Read the current milestone in `docs/ROADMAP.md`.
3. Read ONLY the docs relevant to today's task (Doc Map below). Do NOT read everything.
4. Check repo state: in a terminal (Claude Code) run `git status` and `git log --oneline -5`; from the Claude app/device bridge, follow the git rule in "Working from the Claude app" below instead.
5. State a short plan before writing code.

At the end of every session, run `/end-session` (append HANDOFF entry, log decisions, update ROADMAP, run tests, commit).

## Doc Map — read only what the task needs

| Doc | Read when working on |
|---|---|
| `docs/GAME_DESIGN.md` | Vision, core loop, tone |
| `docs/MECHANICS.md` | Enemies, base, damage, XP, streaks, runs, sub-tasks |
| `docs/ROUTINES.md` | Routines/heroes, slots, frozen-slot recovery |
| `docs/ECONOMY.md` | Points, shop, token pricing, achievements |
| `docs/UI_UX.md` | Screens, time slider, agenda list, navigation |
| `docs/ART_STYLE.md` | Sprites, zombie categories, base damage states |
| `docs/DATA_SCHEMA.md` | Target state shapes + localStorage design |
| `docs/ARCHITECTURE.md` | Any code change (current vs target structure, refactor rules) |
| `docs/DECISIONS.md` | Before proposing to change a past decision — ~3,700 lines, newest first: GREP it, never read whole |
| `PROJECT_SPEC.md` | DEEP detail lookups only — it's 115KB/2700 lines. NEVER read it whole; Grep for the section you need. The docs/ files summarize it. |
| `ACTIONABLE_TICKETS.md` | Ticket details when a ROADMAP item references a ticket ID (P0/P1/P2-xxx) |
| `docs/VISUAL_DESIGN_PLAN.md` | Visual track V1–V6 (scene, glow, layouts, church, tokens, juice) |

## Codebase State (refreshed 2026-10-14 — last code change 2026-10-14, V4: pixel church art at 160px/2x, front-lane line, paths unified on Assets/Base/)

- **Modular vanilla JS, no build step.** `index.html` + ~27 core modules in `js/` (new: `listOrder.js`, 2026-10-13) + 17 UI modules in `js/ui/` + 21 CSS files in `css/` (`responsive.css` loads last — order-sensitive). `script.js` (~1,900 lines) is boot/wiring only: deps builders + `window.*` names for inline onclicks. Game state is owned by `js/state.js` (`State.getX`/`State.setX`). Target layout: `docs/ARCHITECTURE.md`.
- **Persistence:** localStorage `deadline.save`, `SCHEMA_VERSION = 12` (migrations in `js/persistence.js`); settings in `deadline.settings`; Backup & Transfer via `js/exportImport.js`.
- **PWA:** `manifest.json` + cache-first `sw.js`. BUMP `CACHE_NAME` (currently `deadline-shell-v66`) on ANY shell-file change, and add new assets to its `APP_SHELL` list. Deployed via GitHub Pages from `main`.
- **Tests:** Jest, ~69 suites / ~1,445 tests in `test/` (`npm test`). Jest never loads `script.js` — boot/wiring regressions only show up in a live browser check.
- **Progress:** Milestones 0–4 closed; Milestone 5 (live-play polish + visual track V1–V6, see `docs/VISUAL_DESIGN_PLAN.md`) in progress. Next queued items are in the top `sessions/HANDOFF.md` entry.
- **Category edits (2026-10-21):** use `SpriteAnim.setEnemyCategory(el, cat)` to re-skin an existing zombie (never hand-edit `zombie-*` classes; stale ones win by CSS order). See DECISIONS 2026-10-21.
- **Delete Habit (2026-10-16):** red button in the Edit Habit modal -> `Routines.archiveHabit` sets `habitDef.archivedAt` (no schema bump). Archived defs stay in `definedHabits` and MUST be filtered (`!archivedAt`) by any new code that lists, spawns or counts habits. See DECISIONS 2026-10-16.
- **Animated church (2026-10-20, +075/050 on 2026-10-21):** `base_100`, `base_075` (8 frames) and `base_050` (7 frames) have idle strips (`Assets/Base/base_<state>_anim.png`, CSS `steps()` loop on `#base`, `Damage.BASE_ANIM_STATES` / `applyBaseArt`); a shared 2px hit shake fires at most once per 3 s. `base_025`/`000` still static until Jeremy makes the 025 sheet; recipe in `docs/ART_STYLE.md`. Not yet live-checked. sw.js `deadline-shell-v64`.
- **Church art (2026-10-14, V4):** `Assets/Base/base_*.png` are 80x200 pixel art (front of the church, gable + cross, no steeple), drawn at 2x in `#base` (160px column) and 1:1 in the portrait strip; all five damage states are real PixelLab art (2026-10-14). The old repo-root `base_*.png` are unused. See `docs/ART_STYLE.md`.
- **Floor art (2026-10-13):** `Assets/scene/floor-tile.png` (127x72, desktop/landscape `.scene-ground`) + `strip-floor.png` (64x36, portrait strip floor); lane feet are anchored to the floor (`CONFIG.GROUND_FLOOR_*`, `STRIP_*`). Alternates in `Assets/scene/_source/` (strip-floor2/3.png) unused. See `docs/ART_STYLE.md`.
- **Art:** animated PixelLab atlases in `Assets/Zombies/anim/` drive walk/idle/attack (P2-GAME-010 Stage 2a, `js/spriteAnim.js` + `css/enemyAnim.css`, built 2026-10-12, pending live check); death animation on completion + scrub pause built in Stage 2b (2026-10-12, live-verified). Static 64×64 PNGs in `Assets/Zombies/` remain as the fallback.
- **Git:** `main` is current; remote github.com/schooley02/Deadline. `Deadline-MPE/` is the old May 2025 prototype — reference only, never touch. One-off 2025 analysis/debug files live in `archive/` — don't read them.
- Project home: `C:\Users\jscho\Projects\Deadline`.

## Refactor Rules (Milestone 2+; strategy decided 2026-07-16)

- Incremental extraction, NOT a big-bang rewrite. One system per session, out of script.js into a module under `js/` per the target layout in `docs/ARCHITECTURE.md`.
- Tests must pass before AND after each extraction. Commit after each.
- NEVER read all of script.js. Grep for the function(s) the task touches and read only those ranges.
- New balance numbers go in `js/config.js` (create it in Milestone 1) — never hardcode.

## Guardrails (these prevent the July 2025 context failures)

- ONE roadmap task per session for anything touching persistence, architecture, or balance — finish and commit before starting another. (Revisited 2026-07-18, session 11: the original rule was written for a weaker model losing track of a 3,400-line file; today's models hold context better, so small/independent work — a few doc fixes, minor test cleanup — can be batched into one session without violating the spirit of the rule. Persistence/architecture/balance changes stay strict one-per-session regardless of model: the risk there is blast radius and human playtest bandwidth, not context capacity. See DECISIONS.md 2026-07-18 for the full discussion.)
- Never rewrite a whole file when an Edit will do.
- If a design question isn't answered in `docs/` — Grep PROJECT_SPEC.md; if still unclear, ASK Jeremy. Don't invent mechanics.
- Never change balance numbers silently — use the `balance-tuning` skill and log to DECISIONS.
- Update the relevant `docs/*.md` in the SAME session as any mechanic/schema change.
- Never open `.pdf`, `.psd`, `.xd`, `.ase`, `.eps` files, or anything in `archive/`.
- Mobile-width flex-overflow fixes don't generalize automatically (found 2026-07-21, V3a). A nowrap flex row's automatic minimum width is the SUM of its children's minimum widths — any unclassed row inside `.item-info` (or a new sibling section next to it, like `.sub-tasks-section`) can silently overflow at narrow widths even if a similar row elsewhere was already fixed. Before assuming a CSS-only row is safe on mobile, check it directly. And a screenshot alone is NOT sufficient verification for this bug class — V3a's first pass looked visually clean but still measured 49px of real overflow; confirm with `el.scrollWidth > el.clientWidth` (or `getBoundingClientRect` against the parent), not just eyeballing a render.

## Model Strategy — actively manage Jeremy's usage limits

Recommend by TIER, not version number — model names change; the tiers don't. Current lineup (Oct 2026): Fable 5.1 / Opus 5.5 / Sonnet 5.5 / Haiku 5.5. If a newer lineup exists, map it onto these tiers.

Claude can't switch models itself. At session start (after the plan) and at natural task boundaries, tell Jeremy in ONE line which tier + effort level fits, e.g. "Sonnet, low effort — planned CSS execution" or "Fable, high effort — changes the schema, hard to reverse." Don't nag, don't block; if he doesn't switch, carry on. Always pair the model with an effort level — token use is a product of both. Default to the lowest effort that's honest about the task.

| Tier | Use for | Examples |
|---|---|---|
| **Judgment (Fable — scarcest)** | Expensive-to-reverse decisions: architecture, core game design/balance philosophy, spec conflicts, milestone planning, bugs that survived a fix attempt. Batch several design questions into one session. | Sprite-animation architecture, a new mechanic's design forks |
| **Reasoning (Opus)** | Session planning, first-pass root-causing, reviewing complex diffs, tricky logic, tasks not yet fully specified | Planning an extraction, diagnosing a new rendering glitch |
| **Execution (Sonnet — default)** | Anything already planned/specified: root-caused fixes, planned extractions, tests, CSS, wiring | Implementing an approved plan |
| **Trivial (Haiku)** | Pure doc/handoff/STATUS updates, file moves, renames | End-of-session paperwork |

Switch DOWN the moment a plan is approved and the rest is execution; switch UP when something unplanned needs diagnosis or a decision shapes future milestones. Never suggest a switch mid-thought. In Claude Code, the agents are pinned (game-designer → opus, code-reviewer/playtester → sonnet), so delegate review/testing rather than doing it in the main session.

## Commands & Agents (Claude Code)

- `/start-session` / `/end-session` — session lifecycle
- `game-designer` agent — evaluate mechanics/balance vs design docs
- `code-reviewer` agent — review diffs for convention violations
- `playtester` agent — run Jest + syntax checks before handoff

## Working from the Claude app instead of Claude Code

(Formerly "Cowork" — its capabilities are now part of the Claude app. Sessions run in a cloud workspace and reach this folder through the desktop app's device bridge: folder access, a Linux shell over the mounted folder, and file staging.) The claude.ai **Deadline project instructions** bootstrap this file; the old `deadline-session` skill is now just a pointer here.

- **Git — UNTIL RE-TESTED: no `git` commands from the bridge shell, not even read-only.** Root cause (July 2026): the mounted folder blocked deletes, so git's `.git/index.lock` couldn't be cleaned up and blocked Jeremy's own terminal. Read `.git/HEAD` and `.git/refs/heads/*` as plain text instead, and give Jeremy the exact `git add/commit/push` commands to paste. **Since then the app can grant per-session delete permission**, which may make git safe here — re-test deliberately (ask for delete permission, run one read-only command, confirm no lock remains) before relaxing this rule, and log the result in DECISIONS.md. If a corrupt index ever appears in Jeremy's terminal (`bad signature 0x00000000`), he runs `rm .git/index` then `git reset` — history is safe. (2026-10-12: one `git status`/`git log` ran from the bridge without delete permission and left no lock — encouraging, not yet proof.)
- **npm/Jest:** don't `npm install` inside this folder from the bridge (Linux binaries into a Windows folder; delete/rename restrictions break npm's temp dirs). Copy `package.json`, `jest.config.js`, `js/`, `test/` to `$HOME` (outside `mnt/`) and run `npm install` + `npx jest` there. The cloud workspace (`Bash`) also works if the files are staged across.
- **Playtesting:** if Jeremy has `node server.js` (or `npx serve .`) running, the built-in browser (Jeremy's preferred) or Claude in Chrome can open `http://localhost:8000` and drive the real game — check for a live server first; otherwise ask him to start it.
  - **Native `confirm()`/`alert()` dialogs FREEZE browser automation.** Recovery: navigate the tab to any URL. To exercise a dialog-gated flow, stub `window.confirm`/`window.alert` via JS first, then call the real handler directly (found session 44).
  - **Service-worker cache:** a plain reload serves stale shell files. Unregister the SW + clear Cache Storage, then navigate, before trusting any visual check after an edit.
  - **Hand-editing the save:** `Persistence`/`State` are closure-scoped, NOT on `window`, so stubbing `Persistence.flush` no-ops. Instead override `localStorage.setItem` to drop writes to `deadline.save`, edit, THEN navigate — the unload flush gets swallowed and the edit survives (2026-07-21; supersedes the session 44/52 stub recipes).

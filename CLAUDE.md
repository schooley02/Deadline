# Deadline — Tower Defense Productivity Game

Deadline turns your to-do lists, habits, and routines into a tower defense game: tasks and habits are zombies advancing toward a church base, defeated by completing them in real life. Mobile-first web app (Chrome/Android priority). This repo is the July 2025 Claude Code prototype plus a documentation/memory system added 2026-07-16 to keep sessions context-safe.

## Session Protocol (do this at the start of EVERY session)

1. Read `sessions/HANDOFF.md` — only the topmost (latest) entry.
2. Read the current milestone in `docs/ROADMAP.md`.
3. Read ONLY the docs relevant to today's task (Doc Map below). Do NOT read everything.
4. Run `git status` and `git log --oneline -5`.
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
| `docs/DECISIONS.md` | Before proposing to change a past decision |
| `PROJECT_SPEC.md` | DEEP detail lookups only — it's 115KB/2700 lines. NEVER read it whole; Grep for the section you need. The docs/ files summarize it. |
| `ACTIONABLE_TICKETS.md` | Ticket details when a ROADMAP item references a ticket ID (P0/P1/P2-xxx) |
| `SUBTASK_BUG_REPRODUCTION_REPORT.md` | The known sub-task duplication bug (root cause identified) |

## Codebase State (2026-07-16)

- `script.js` (~3,400 lines) + `style.css` (~2,000 lines) + `index.html` — the WORKING monolith. It runs (`node server.js` or `npx serve .`, then http://localhost:8000). This is the file that destroyed context windows; see Refactor Rules.
- `js/TaskManager.js`, `js/IdCounter.js` — beginnings of extraction.
- `test/` — Jest tests for sub-task creation (`npm test`). Run `npm install` first if node_modules is missing.
- `Assets/Zombies/` — finished 64×64 sprites for all 8 categories. `Assets/Base/` — base damage states.
- **No persistence yet** — refresh loses everything. localStorage is a top roadmap item.
- **Known bug**: sub-task creation duplicates a standalone task (root-caused in SUBTASK_BUG_REPRODUCTION_REPORT.md; fix is Milestone 1).
- Git: `main` and `feature/sprite-system-cleanup` are both at the same commit (fast-forward merged 2026-07-17); `main` is now current. Remote: github.com/schooley02/Deadline (repo was recreated 2026-07-17 after the original was found deleted — see DECISIONS.md). `Deadline-MPE/` is the old May 2025 prototype — reference only, never touch.
- Project home: `C:\Users\jscho\Projects\Deadline` (moved out of OneDrive 2026-07-17 — see DECISIONS.md).

## Refactor Rules (Milestone 2+; strategy decided 2026-07-16)

- Incremental extraction, NOT a big-bang rewrite. One system per session, out of script.js into a module under `js/` per the target layout in `docs/ARCHITECTURE.md`.
- Tests must pass before AND after each extraction. Commit after each.
- NEVER read all of script.js. Grep for the function(s) the task touches and read only those ranges.
- New balance numbers go in `js/config.js` (create it in Milestone 1) — never hardcode.

## Guardrails (these prevent the July 2025 context failures)

- ONE roadmap task per session. Finish and commit before starting another.
- Never rewrite a whole file when an Edit will do.
- If a design question isn't answered in `docs/` — Grep PROJECT_SPEC.md; if still unclear, ASK Jeremy. Don't invent mechanics.
- Never change balance numbers silently — use the `balance-tuning` skill and log to DECISIONS.
- Update the relevant `docs/*.md` in the SAME session as any mechanic/schema change.
- Never open `.pdf`, `.psd`, `.xd`, `.ase`, `.eps` files, or the CSV analysis dumps (`detailed_evidence.csv`, `requirement_alignment_matrix.csv`).

## Model Strategy — actively manage Jeremy's usage limits

Claude cannot change the top-level model itself, but MUST proactively prompt Jeremy to switch (one line, e.g. "This next step is mechanical — switch me to Sonnet in the model picker to save your Fable limit") at these moments: at session start after stating the plan, and MID-SESSION whenever the work type shifts tiers. Don't wait to be asked, and don't block on it — if Jeremy doesn't switch, continue working.

| Model | Use for | Examples in this project |
|---|---|---|
| **Fable 5** (scarcest — spend on judgment calls) | Decisions that are expensive to get wrong or hard to reverse: architecture/refactor strategy, game design & balance philosophy, resolving spec conflicts or gaps, planning a whole milestone, debugging that has RESISTED a first attempt | "Should routines own tasks or reference them?", designing the frozen-routine recovery UX, deciding the Milestone 2 extraction order, a bug that survived one fix attempt |
| **Opus 4.8** (strong reasoning, less scarce) | Everyday hard thinking: session planning, first-pass root-causing of new bugs, reviewing complex diffs, evaluating a mechanic against the design docs, writing tricky logic (pricing curve, streak validation, offline catch-up math) | Planning today's extraction session, root-causing a new rendering glitch, reviewing the persistence module |
| **Sonnet 5** (workhorse — default) | Execution of anything already planned or well-specified: implementing a root-caused fix, module extractions per the approved plan, writing tests, doc/handoff updates, CSS, form wiring | Fixing the sub-task duplication bug (root cause documented), extracting clock.js per plan, writing Jest tests for damage ticks |

Switching triggers — prompt Jeremy at these moments:
- **Down to Sonnet:** the moment a plan is approved and the rest is execution; or the session is doc/test/cleanup work.
- **Up to Opus:** something unplanned needs diagnosis or a non-trivial judgment; the start of a session whose task isn't fully specified.
- **Up to Fable:** the decision shapes future milestones, changes the architecture or core game design, or Opus-level attempts have failed. Also fine: batch several pending design questions and spend one Fable session on all of them.
- **Never mid-thought:** finish the current reasoning before suggesting a switch; suggest at natural task boundaries.

Plan expensive, execute cheap. If a "mechanical" task surprises you with a design question, recommend switching UP before deciding. In Claude Code, delegation switches models automatically — the agents are pinned (game-designer → opus, code-reviewer/playtester → sonnet), so prefer delegating review/testing rather than doing it in the main (expensive) session.

## Commands & Agents (Claude Code)

- `/start-session` / `/end-session` — session lifecycle
- `game-designer` agent — evaluate mechanics/balance vs design docs
- `code-reviewer` agent — review diffs for convention violations
- `playtester` agent — run Jest + syntax checks before handoff

## Working in Cowork instead of Claude Code

The `deadline-session` Cowork skill (installed in Jeremy's Cowork) mirrors /start-session and /end-session. If it isn't loaded, follow the Session Protocol above manually. Cowork-specific rules:

- **Git**: NEVER run `git` commands at all from the Cowork sandbox/device-bridge against this repo — not even read-only ones like `git status`. The device-bridge tooling can create a temporary `.git/index.lock` during a read but can't delete it afterward (no unlink permission on the mounted folder), leaving a stale lock that blocks Jeremy's real `git` commands in his own terminal. To check repo state from Cowork, read `.git/HEAD` and `.git/refs/heads/*` / `.git/refs/remotes/origin/*` directly as plain text files instead (each just contains a branch ref or a 40-char commit SHA — no `git` process involved, so no lock). For all actual git writes (`add`, `commit`, `merge`, `push`), give Jeremy the exact commands to paste into his own terminal.
- **npm/Jest**: never `npm install` in this folder from the sandbox — copy `package.json`, `jest.config.js`, `js/`, `test/` + code under test to the sandbox scratchpad and run tests there.
- **Playtesting**: Jeremy runs `node server.js` locally and reports what he sees; Claude can't view the running game.

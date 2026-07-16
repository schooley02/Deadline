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
- Git: branch `feature/sprite-system-cleanup`, remote github.com/schooley02/Deadline. `Deadline-MPE/` is the old May 2025 prototype — reference only, never touch.

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
- This folder is OneDrive-synced: if git acts strangely (locks, phantom changes), pause OneDrive sync and retry.

## Commands & Agents (Claude Code)

- `/start-session` / `/end-session` — session lifecycle
- `game-designer` agent — evaluate mechanics/balance vs design docs
- `code-reviewer` agent — review diffs for convention violations
- `playtester` agent — run Jest + syntax checks before handoff

## Working in Cowork instead of Claude Code

The `deadline-session` Cowork skill (installed in Jeremy's Cowork) mirrors /start-session and /end-session. If it isn't loaded, follow the Session Protocol above manually. Cowork-specific rules:

- **Git**: NEVER run git write commands (`add`, `commit`, `rm --cached`) from the Cowork sandbox — its index writes corrupt on this OneDrive folder (`bad signature 0x00000000`). Read-only git is fine. At session end, give Jeremy the commands to paste into his own terminal. Recovery if the index corrupts: `rm .git/index` then `git reset` (history is unaffected).
- **npm/Jest**: never `npm install` in this folder from the sandbox — copy `package.json`, `jest.config.js`, `js/`, `test/` + code under test to the sandbox scratchpad and run tests there.
- **Playtesting**: Jeremy runs `node server.js` locally and reports what he sees; Claude can't view the running game.

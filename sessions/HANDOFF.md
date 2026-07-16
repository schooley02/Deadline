# Session Handoffs

Newest entry at TOP. Every session appends one entry before ending (use `/end-session`).

## Entry Template
```
## YYYY-MM-DD — <short title>
**Did:** what was completed (files touched, roadmap items checked)
**State:** does it run? tests green? any known breakage?
**Next:** the single next task, with any context the next session needs
**Watch out:** gotchas discovered this session
```

---

## 2026-07-16 — Repo moved to permanent home + memory system merged (Cowork session)
**Did:** Audited both old folders (May MPE in OneDrive "Baseline - Old", July 2025 Claude Code repo in C:\Users\jscho\Deadline). Copied the July repo here (Claude\Projects\Deadline) — git history verified intact (fsck clean, checksums match). Merged in the docs system, CLAUDE.md, commands, agents, balance-tuning skill — all updated to reflect THIS codebase. Recovered the "lost" July specs from PROJECT_SPEC.md (exponential pricing = base × 1.5^qty; frozen routine recovery rules) into docs/ECONOMY.md and docs/ROUTINES.md. Added .gitignore, untracked node_modules.
**State:** Monolith runs (`node server.js`). node_modules NOT copied — run `npm install` before `npm test`. Branch: feature/sprite-system-cleanup (synced with origin at last July push). Known bug: sub-task duplication (see SUBTASK_BUG_REPRODUCTION_REPORT.md — root cause already identified at script.js ~line 1005-1011: addItemToGame adds subtask to activeItems AND the parent list refresh re-creates it).
**Next:** STEP 0 (one-time, on Jeremy's machine — the Cowork sandbox couldn't write the git index through OneDrive): `git rm -r --cached node_modules` then `git add .gitignore CLAUDE.md docs sessions .claude` then `git commit -m "M0: add memory system; untrack node_modules"`. THEN Milestone 1, task 1: fix the sub-task duplication bug. Read SUBTASK_BUG_REPRODUCTION_REPORT.md, grep script.js for `addItemToGame` and `createSubTaskPrompt`, fix, `npm test`, commit.
**Watch out:**
- NEVER read script.js (3,420 lines) or PROJECT_SPEC.md (2,700 lines) in full — Grep for what you need.
- This folder is OneDrive-synced. If git shows lock errors or phantom modified files, pause OneDrive sync. Recommend right-click folder → "Always keep on this device".
- `git status` may show many files modified due to the 2026-07-16 move (line endings/mode bits) — diff before assuming real changes; consider `git config core.fileMode false`.
- Old copies of this project exist at C:\Users\jscho\Deadline (original — Jeremy to delete after verifying this one) and OneDrive\...\Baseline - Old\Deadline (May-era design assets — KEEP, art sources live there).

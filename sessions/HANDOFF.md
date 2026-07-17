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

## 2026-07-17 — Verified sub-task duplication bug already fixed (Cowork session)
**Did:** Started Milestone 1 task 1 (fix sub-task duplication bug). Read SUBTASK_BUG_REPRODUCTION_REPORT.md and grepped script.js for `addItemToGame`, `showCreateSubTaskModal`, `sortAndRenderActiveList`, `createListItem`. Found the guard clauses described in the report's "Next Steps for Fix" already present in current script.js. `git show 38409ca -- script.js` confirmed the fix landed in commit `38409ca` ("Fix: prevent duplicate regular task when adding subtask", Jul 29 2025) — the SAME commit that added the repro report, so the report's "Next Steps" section is stale. Copied package.json/jest.config.js/js/test to the sandbox scratchpad, added a missing `test/setup.js` stub + babel config (repo didn't have them; jest.config.js references `test/setup.js` and babel-jest but neither `jest` nor `babel-jest` are in package.json devDependencies), ran `npx jest test/subtask-creation.test.js` — 14/14 tests pass. Checked off the ROADMAP item and logged the finding in DECISIONS.md.
**State:** Bug considered fixed and verified; no code changed this session. Monolith presumably still runs (not launched this session — Cowork can't view the running game).
**Next:** Milestone 1 task 2 — decide branch state with Jeremy (merge `feature/sprite-system-cleanup` → `main`, push to GitHub). After that: create `js/config.js` and migrate gameplay constants out of script.js.
**Watch out:**
- `package.json` in this repo is actually the visual-regression-test manifest (puppeteer/pixelmatch/pngjs) — it does NOT list `jest`/`babel-jest` as devDependencies even though `jest.config.js` and `test/*.test.js` exist and expect them. Also missing: `test/setup.js` (referenced by `jest.config.js`'s `setupFilesAfterEnv`) and a babel config. Whoever runs `npm test` for real needs these added properly (not just sandbox-scratchpad stubs) — worth a small follow-up task.
- `test/subtask-creation.test.js` doesn't `require` script.js — it contains its own copy-pasted mirror of `createTaskItemData`/`addItemToGame`. It currently matches script.js, but it can silently drift out of sync since nothing enforces that. Consider refactoring so the test imports the real functions once Milestone 2 extracts them into `js/` modules.
- Puppeteer's postinstall tries to download Chrome and fails in the sandbox (403) — installing with `PUPPETEER_SKIP_DOWNLOAD=true` avoids it.

## 2026-07-16 — Repo moved to permanent home + memory system merged (Cowork session)
**Did:** Audited both old folders (May MPE in OneDrive "Baseline - Old", July 2025 Claude Code repo in C:\Users\jscho\Deadline). Copied the July repo here (Claude\Projects\Deadline) — git history verified intact (fsck clean, checksums match). Merged in the docs system, CLAUDE.md, commands, agents, balance-tuning skill — all updated to reflect THIS codebase. Recovered the "lost" July specs from PROJECT_SPEC.md (exponential pricing = base × 1.5^qty; frozen routine recovery rules) into docs/ECONOMY.md and docs/ROUTINES.md. Added .gitignore, untracked node_modules.
**State:** Monolith runs (`node server.js`). node_modules NOT copied — run `npm install` before `npm test`. Branch: feature/sprite-system-cleanup (synced with origin at last July push). Known bug: sub-task duplication (see SUBTASK_BUG_REPRODUCTION_REPORT.md — root cause already identified at script.js ~line 1005-1011: addItemToGame adds subtask to activeItems AND the parent list refresh re-creates it).
**Next:** STEP 0 (one-time, on Jeremy's machine — the Cowork sandbox couldn't write the git index through OneDrive): `git rm -r --cached node_modules` then `git add .gitignore CLAUDE.md docs sessions .claude` then `git commit -m "M0: add memory system; untrack node_modules"`. THEN Milestone 1, task 1: fix the sub-task duplication bug. Read SUBTASK_BUG_REPRODUCTION_REPORT.md, grep script.js for `addItemToGame` and `createSubTaskPrompt`, fix, `npm test`, commit.
**Watch out:**
- NEVER read script.js (3,420 lines) or PROJECT_SPEC.md (2,700 lines) in full — Grep for what you need.
- This folder is OneDrive-synced. If git shows lock errors or phantom modified files, pause OneDrive sync. Recommend right-click folder → "Always keep on this device".
- `git status` may show many files modified due to the 2026-07-16 move (line endings/mode bits) — diff before assuming real changes; consider `git config core.fileMode false`.
- Old copies of this project exist at C:\Users\jscho\Deadline (original — Jeremy to delete after verifying this one) and OneDrive\...\Baseline - Old\Deadline (May-era design assets — KEEP, art sources live there).

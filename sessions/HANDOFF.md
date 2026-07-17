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

## 2026-07-17 — Verified sub-task bug fix + merged branches + moved off OneDrive (Cowork session)
**Did:** Two Milestone 1 tasks this session.

Task 1 — sub-task duplication bug: Read SUBTASK_BUG_REPRODUCTION_REPORT.md and grepped script.js for `addItemToGame`, `showCreateSubTaskModal`, `sortAndRenderActiveList`, `createListItem`. Found the guard clauses described in the report's "Next Steps for Fix" already present in current script.js. `git show 38409ca -- script.js` confirmed the fix landed in commit `38409ca` ("Fix: prevent duplicate regular task when adding subtask", Jul 29 2025) — the SAME commit that added the repro report, so the report's "Next Steps" section is stale. Ran `test/subtask-creation.test.js` in a sandbox scratchpad (copied package.json/jest.config.js/js/test, added a missing `test/setup.js` stub + babel config) — 14/14 tests pass. No code changed.

Task 2 — branch merge: `main` was an exact ancestor of `feature/sprite-system-cleanup` (10 commits ahead, 0 behind) — a clean fast-forward. Actually getting the merge pushed took most of the session: hit a recurring stale `.git/index.lock` on the OneDrive-synced folder (root cause: any git operation, including Cowork's own read-only checks, can leave a lock behind that OneDrive's/the bridge's process can't clean up); then a GitHub push auth loop (Windows Git Credential Manager had no `credential.helper` set, so every push re-triggered a fresh browser login instead of caching it — fixed with `git config --global credential.helper manager`); then discovered the GitHub remote `schooley02/Deadline` had been deleted at some point since July 2025 (404, 0 repos on the account) — recreated it fresh and re-pushed both branches with `git push -u`. Finally moved the whole project out of OneDrive to `C:\Users\jscho\Projects\Deadline` to eliminate the lock issue permanently, at which point `git checkout main && git merge feature/sprite-system-cleanup && git push origin main` completed cleanly (Fast-forward, `3042c4b..7af6ccb`). Verified via `git branch -vv`: both `main` and `feature/sprite-system-cleanup` at `7af6ccb`, both tracking origin, both clean.

Updated CLAUDE.md (new project path, dropped stale OneDrive guardrails, added the "never run git via the device bridge" rule), docs/ROADMAP.md, docs/DECISIONS.md.
**State:** `main` is now the current branch and has everything (doc/memory system, sprite/mobile-CSS work, verified sub-task fix). Both `main` and `feature/sprite-system-cleanup` pushed to GitHub. Repo lives at `C:\Users\jscho\Projects\Deadline` now, not OneDrive. Not launched/played this session.
**Next:** Milestone 1 task 3 — create `js/config.js` and migrate gameplay constants out of script.js.
**Watch out:**
- **Project moved.** Any future Cowork session needs to request folder access to `C:\Users\jscho\Projects\Deadline`, NOT the old OneDrive path.
- **Never run `git` via the Cowork device bridge against this repo**, even read-only commands — it can leave a stale `.git/index.lock` that blocks Jeremy's own terminal. Read `.git/HEAD` and `.git/refs/**` directly as plain text instead when you need to check branch/commit state from Cowork.
- `package.json` in this repo is actually the visual-regression-test manifest (puppeteer/pixelmatch/pngjs) — it does NOT list `jest`/`babel-jest` as devDependencies even though `jest.config.js` and `test/*.test.js` exist and expect them. Also missing: `test/setup.js` (referenced by `jest.config.js`'s `setupFilesAfterEnv`) and a babel config. Worth a small follow-up task to fix this properly (not just sandbox-scratchpad stubs).
- `test/subtask-creation.test.js` doesn't `require` script.js — it contains its own copy-pasted mirror of `createTaskItemData`/`addItemToGame`. Currently matches script.js, but can silently drift. Consider refactoring so the test imports the real functions once Milestone 2 extracts them into `js/` modules.
- Puppeteer's postinstall tries to download Chrome and fails in the sandbox (403) — installing with `PUPPETEER_SKIP_DOWNLOAD=true` avoids it.
- `feature/sprite-system-cleanup` still exists on GitHub, now identical to `main` — fine to delete whenever, not urgent.

## 2026-07-16 — Repo moved to permanent home + memory system merged (Cowork session)
**Did:** Audited both old folders (May MPE in OneDrive "Baseline - Old", July 2025 Claude Code repo in C:\Users\jscho\Deadline). Copied the July repo here (Claude\Projects\Deadline) — git history verified intact (fsck clean, checksums match). Merged in the docs system, CLAUDE.md, commands, agents, balance-tuning skill — all updated to reflect THIS codebase. Recovered the "lost" July specs from PROJECT_SPEC.md (exponential pricing = base × 1.5^qty; frozen routine recovery rules) into docs/ECONOMY.md and docs/ROUTINES.md. Added .gitignore, untracked node_modules.
**State:** Monolith runs (`node server.js`). node_modules NOT copied — run `npm install` before `npm test`. Branch: feature/sprite-system-cleanup (synced with origin at last July push). Known bug: sub-task duplication (see SUBTASK_BUG_REPRODUCTION_REPORT.md — root cause already identified at script.js ~line 1005-1011: addItemToGame adds subtask to activeItems AND the parent list refresh re-creates it).
**Next:** STEP 0 (one-time, on Jeremy's machine — the Cowork sandbox couldn't write the git index through OneDrive): `git rm -r --cached node_modules` then `git add .gitignore CLAUDE.md docs sessions .claude` then `git commit -m "M0: add memory system; untrack node_modules"`. THEN Milestone 1, task 1: fix the sub-task duplication bug. Read SUBTASK_BUG_REPRODUCTION_REPORT.md, grep script.js for `addItemToGame` and `createSubTaskPrompt`, fix, `npm test`, commit.
**Watch out:**
- NEVER read script.js (3,420 lines) or PROJECT_SPEC.md (2,700 lines) in full — Grep for what you need.
- This folder is OneDrive-synced. If git shows lock errors or phantom modified files, pause OneDrive sync. Recommend right-click folder → "Always keep on this device".
- `git status` may show many files modified due to the 2026-07-16 move (line endings/mode bits) — diff before assuming real changes; consider `git config core.fileMode false`.
- Old copies of this project exist at C:\Users\jscho\Deadline (original — Jeremy to delete after verifying this one) and OneDrive\...\Baseline - Old\Deadline (May-era design assets — KEEP, art sources live there).

# Decision Log

Append-only. Newest at top. Format: date — decision — why — alternatives rejected.

---

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

---
name: playtester
description: Smoke-tests Deadline game logic before handoff. Use at the end of any session that changed src/ code, or when something seems broken.
tools: Read, Grep, Glob, Bash
---

You verify the Deadline game actually works before a session ends.

1. Run existing tests: `npx jest` (if `test/` exists). Report pass/fail per test.
2. Syntax-check every changed JS file: `node --check <file>` for each file in `git diff --name-only -- '*.js'`.
3. Trace the core loop by READING the code (no browser available): add task → enemy spawns → movement positions it by due time → completion awards XP/points and removes it → overdue path damages base 1HP/5min → base 0 = run over. Flag any break in that chain.
4. Check persistence round-trip: does every field written by `state mutations survive save/load per `js/persistence.js`? Compare against `docs/DATA_SCHEMA.md` (target schema).
5. Check the demo clock: DEMO_MODE should compress time without changing logic paths.

If logic is testable in pure Node (movement math, damage ticks, pricing, streaks), write/extend a test in `test/` rather than just eyeballing.

Output: PASS/FAIL per check, exact reproduction of any failure, and whether the session is safe to hand off.

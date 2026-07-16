---
description: Load Deadline project context and plan this session's single task
---

Start a Deadline work session. Follow these steps IN ORDER, reading only what's listed:

1. Read `sessions/HANDOFF.md` — only the topmost (latest) entry.
2. Read `docs/ROADMAP.md` — find the current milestone and the first unchecked task (or the task named in HANDOFF "Next").
3. Run `git status` and `git log --oneline -5`.
4. Based on the task, read ONLY the relevant docs per the Doc Map in CLAUDE.md (usually 1-2 files, plus DATA_SCHEMA.md if touching state).
5. Report back: (a) latest handoff summary, (b) the ONE task for this session, (c) which files you'll touch, (d) which model tier fits this task per CLAUDE.md Model Strategy — tell Jeremy to switch if the current model is mismatched, (e) any open questions for Jeremy from the docs' "Open Questions" sections that block this task.

Do NOT start coding until Jeremy confirms the plan. Do NOT read script.js in full — Grep it for the functions the task touches and read only those line ranges. Never read .pdf/.psd/.xd/.ase files.

---
description: Wrap up the session — handoff note, decisions, roadmap, commit
---

End the Deadline work session properly. Do ALL of these:

1. If any mechanic, balance number, or data shape changed this session, update the matching `docs/*.md` NOW (Doc Map in CLAUDE.md). Stale docs are how this project went wrong before.
2. Append a new entry at the TOP of `sessions/HANDOFF.md` using the template in that file (Did / State / Next / Watch out). Be specific in "Next" — the next session starts cold from that line.
3. If any decisions were made (or reversed), append them to `docs/DECISIONS.md` (newest at top).
4. Check off completed items in `docs/ROADMAP.md` with the date.
5. Run the smoke tests if they exist (`npx jest`). Report failures honestly in HANDOFF instead of hiding them.
6. `git add -A && git commit` with a clear message: `M<milestone>: <what changed>`.
7. Give Jeremy a 3-line summary: what was done, what's next, any question needing his answer.

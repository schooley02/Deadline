# Hero Spotlight + Hero Tray — Design Plan

_Written 2026-10-21 (Claude app session, Opus). Replaces the canvas half of the ROADMAP item "Hero pixel avatars + chip layout". Decisions: DECISIONS.md 2026-10-21 "Heroes leave the base". Brainstorm mockups were in chat, not in the repo._

## Why
The canvas hero chips (`#heroBaseZone`, base's leftmost 160px) have been hidden since 2026-10-15 because they covered the church, and no placement worked. A wider base doesn't fit the 92px portrait strip either. So heroes **leave the base** and come in two ways: a **spotlight** (on demand, in front of the church) and a **tray** (pull-out roster with slots).

## Decisions (Jeremy, 2026-10-21)
1. **No permanent hero art at the base.** The base keeps its current width in every layout (160px landscape/desktop, 56px strip window in portrait).
2. **Spotlight:** tapping a routine-owned zombie on the canvas, or the hero avatar on a list row, shows that routine's hero **on the layer in front of the church**. It overlaps the church, feet on the front-lane line, and is NOT placed beside it.
3. **Scrim:** while a hero is showing, a translucent dark layer covers the base area so the hero reads clearly. It's only active while the hero is showing.
4. **Hero tray:** avatars, stars, health and slots (filled, open, frozen, locked) live in a pull-out tray behind a small tab. Open slots (unspent banked slot points) show as a dashed "+" and only appear in the tray. A dot on the tab flags them.
5. **List stays sorted by urgency (option B).** No routine group headers. Routine-owned rows keep a small hero avatar (today's `.hero-chip--inline`).
6. **Hero art = healthy, non-zombie twins of the category zombies.** Same outfit and silhouette idea, alive (see Art brief).

## Layer order (canvas)
`scene layers (negative z)` → `#base` → **`#baseScrim`** → **`#heroSpotlight`** → `.enemy` (list z band 30–79) → overdue pile (80) → UI/overlays (90+).
- Zombies stay ABOVE the scrim, so a zombie at the door is never dimmed. The threat must not look smaller while you're checking a hero.
- The church's damage art, idle loop and under-attack flash keep running under the scrim, muted. The **hero** is exempt from the church's hit shake and flash.
- Check `#base`'s current z-index when building: scrim and hero must sit between it and 30.

## Spotlight behaviour
- **Who:** `Items.findRoutineForItem(item)` (habit via `habitDef.routineId`, routine task via `taskDefinitionIds`). Standalone tasks and sub-tasks have no hero, so the tap behaves exactly as today. Sub-task -> its parent task's routine hero (Answers 4).
- **Triggers:** (a) canvas tap on a routine-owned zombie, which also opens the existing enemy popup (both together, Answers 1); (b) tap on a list-row hero avatar. This one **changes** from "open the management window" to "spotlight", and management stays reachable from the tray.
- **Lifetime:** fades in about 200 ms, auto-dismisses after `CONFIG.HERO_SPOTLIGHT_MS` (proposed 5000; display timing, not balance). A tap on the scrim or the hero dismisses early. A new trigger replaces the current hero (no stacking).
- **Scrim:** about 40% dark (`CONFIG.HERO_SCRIM_OPACITY`, proposed 0.4), soft or rounded edge around the base box, fades with the hero. Below roughly 30% the church art wins; above roughly 50% the damage state disappears.
- **Tray tab while spotlit:** the tab text becomes that hero's status (`Study · Lv 4`, mini health bar, HP). Tapping it opens the tray with that routine's row highlighted.
- **Preview modes:** allowed during a time-slider scrub or a non-Today day-pager page. It shows the hero's projected health like the old chips did (`renderHeroesAtBase(routinesOverride)` path). It doesn't change game state (purely visual), so the loop guard is unaffected.
- **Reduced motion:** no slide, just an opacity swap; idle loop paused like zombie anims.
- **States:** active = idle loop; frozen = idle + ice tint/badge; KO'd = `CONFIG.HERO_KO_LOOK` (Answers 3); inactive = greyed still.

## Sizing
- **Landscape/desktop:** church is 160x400 at 2x, door ≈ 144px. Hero ≈ zombie height (~124px on screen at 1x atlas), horizontally centred on the door, feet on `GROUND_FLOOR_FEET_BOTTOM_PAD` (8px). It must not cover the whole church: the damage state should stay readable around it.
- **Portrait strip:** church window is 56x92 at 1:1. Hero at 0.5x (~60–75px tall) standing on the strip floor line. **Verify live**: it may need its own scale constant (`CONFIG.HERO_SPOTLIGHT_STRIP_SCALE`).

## Hero tray
- **Tab:** small pill on the canvas bottom edge (landscape/desktop) or the strip's bottom edge (portrait). It shows "Heroes" plus status dots: blue = some hero has an open slot, red = some hero hurt (below the health threshold) or KO'd. It reconciles in place and is never rebuilt per tick (DECISIONS 2026-10-14 rule).
- **Sheet:** landscape/desktop slides UP over the battlefield; portrait ALSO rises up, over the battlefield strip (Answers 2). One row per routine, ordered by `HeroesView.rankRoutines`: head avatar with health ring, name, stars, Lv, then slot cells:
  - filled habit or task slot → member's category icon
  - frozen → ice cell
  - **open** (`Heroes.availableSlotPoints` > 0) → dashed "+"; tap → Manage Routine (add flow already prompts to spend the point)
  - locked → next level's slot preview (greyed lock), max level shows none
- **Taps:** row → that routine's management window (the old chip tap); tab → toggle; tap outside → close. Long rosters scroll inside the sheet (max height ~60% of the canvas or list).
- **Level-up:** when a routine levels up and earns a slot point, the tray opens once on its own with that row's new "+" pulsing (session memory, not saved).
- **Retire:** `#heroBaseZone` and its hidden CSS. Reuse `buildChipViewModel`, `deriveState`, `starsHtml`, `healthColorVar`, `rankRoutines`, `trackStarCrossing` for the tray rows; `renderHeroesAtBase` per-tick rendering goes away. The tab dots and an open tray refresh on the live tick only via signature compare.

## List rows
Keep `.hero-chip--inline` beside the category label, avatar swapped from emoji to the hero head crop when the art lands. Tap → spotlight (decision 2). Sorting, tie groups and `--list-z` are unchanged.

## Art brief (PixelLab, Jeremy)
- **8 heroes:** one per category (career, creativity, financial, health, lifestyle, relationships, spirituality, other). "Other" is the default; the player picks the routine's hero category (see Answers 5).
- **Healthy twins:** feed each category zombie in as the reference. Keep the outfit (suit + briefcase, artist, rich, nurse, stylish, nice clothes + present, nun, generic) and proportions, but make them alive: warm skin, clean saturated clothes, upright stance, alert idle (breathing, small tool shift). They should read as **not a zombie** at a glance, even without the scrim.
- **Facing:** right, toward the zombies.
- **Animations v1:** idle loop only (8–9 frames, same cell conventions as zombies). Later: celebrate (completion), hurt (damage), KO, level-up.
- **Files:** `Assets/Heroes/anim/<category>.png` + `.json`, same atlas/JSON shape as `Assets/Zombies/anim/` (rows, `frameWidth/Height`, `feetY`, `bodyBox`). Static fallback `Assets/Heroes/<category>-hero.png`. **Head crop** `Assets/Heroes/<category>-head.png` (32x32) for the tray and list avatars.
- **Feet:** extend `test/spriteFeet.test.js` to the hero atlases so the per-category `--dy-idle` is measured, not eyeballed.
- Add every new file to `sw.js` APP_SHELL and bump `CACHE_NAME`.

## Sub-sessions (one per session; one schema bump 12 -> 13 for `routine.heroCategory`)
1. **DONE 2026-10-21 -- `routine.heroCategory`: 12 -> 13 migration (seed) + picker + `heroCategoryFor` resolver.** Persistence change, so its own session per CLAUDE.md. Jest 73 suites / 1,504; live-checked. _Sonnet, medium._
2. **DONE 2026-10-21 -- Spotlight + scrim with placeholder art.** Jest 74 suites / 1,520; live-checked portrait strip + 844x390 landscape. Original scope: `js/ui/heroSpotlight.js` (pure: resolve routine from item, show/replace/dismiss state machine, timer) + `css/heroSpotlight.css` + `#baseScrim`/`#heroSpotlight` in `index.html`. Placeholder = emoji/CSS block. Wire canvas zombie tap + list avatar tap. Jest for the pure parts; live-check layer order (zombie above scrim) in landscape + portrait. _Sonnet, medium._
3. **DONE 2026-10-21 -- Hero tray + tab, `#heroBaseZone` retired.** Jest 75 suites / 1,534; live-checked portrait strip + 844x390 landscape; tray is a viewport-fixed sheet (not over the strip). Original scope: `js/ui/heroTray.js` + `css/heroTray.css`; retire `#heroBaseZone`; status dots; level-up auto-open; spotlit tab status. Live-check 320–430px portrait and 844x390 landscape for overflow (`scrollWidth`, not screenshots). _Sonnet, medium._
4. **Art integration** (after Jeremy's PixelLab pass): hero atlases into `spriteAnim.js` (or a sibling), feet test, head crops into tray + list avatars, sw.js. _Sonnet, low–medium._ **FIRST HERO DONE 2026-10-25 (Other):** `Assets/Heroes/anim/other.png|json` + `other-head.png`, `CONFIG.HERO_ART_CATEGORIES`, spotlight kind `atlas` (idle; KO plays once, holds 3 s, restarts, unfaded), head-crop avatars in tray / tab / list chips (faded when KO'd), `test/heroArt.test.js`, sw.js v81. **SPIRITUALITY added 2026-10-25 (sw.js v82) using a NORMALIZE-to-Other-format step (see DECISIONS).** **RELATIONSHIPS (v83) and LIFESTYLE (v84, 7-frame idle via `--hero-idle-frames`) added 2026-10-25.** **HEALTH (v85) and FINANCIAL (v86) added 2026-10-25.** **CREATIVITY (v87) and CAREER (v88) added 2026-10-25: SUB-SESSION 4 COMPLETE, all 8 hero categories have art.** **Not yet wired from the atlases: hurt / attack / level-up rows. Next plan step is sub-session 5 (polish) and deleting the dead `HeroesView` chip code to `HERO_ART_CATEGORIES` as their atlases arrive (copy the Other recipe: reorder rows idle, attack, hurt, levelup, ko; drop the rotation row; 32x32 head crop; add a `.hero-spotlight[data-category=...] .hero-sprite-sheet` background rule + sw.js entries).** Hurt / attack / level-up rows are in the atlas but not wired yet.
5. **Optional polish:** hurt/celebrate/KO anims, level gear (e.g. helmet at Lv 3), spotlight on routine completion. _Cut if play says so._ **DONE 2026-10-25 (partial):** hurt + level-up rows wired, dead chip code deleted (DECISIONS 2026-10-25). Not done: level gear. **Attack row / celebrate-on-completion BUILT 2026-10-26** (the hero plays `attack` once when its item is completed, then the normal 5 s spotlight; `CONFIG.HERO_ATTACK_ON_COMPLETE`; sw.js v108). The work timer hero still uses idle.

Art (step 0) can happen in parallel with 1–3, which run on placeholders.

## Answers (Jeremy, 2026-10-21 21:51)
1. **Canvas zombie tap: popup AND spotlight together** to start; revisit if the popup hides the hero on small screens.
2. **Portrait tray rises UP over the battlefield strip** (not down over the list). Landscape/desktop also rise up, so one direction everywhere.
3. **KO look: build both** (faded/desaturated twin, and the zombie sprite grey-tinted) behind `CONFIG.HERO_KO_LOOK` (`'faded'` | `'zombie'`) so Jeremy can compare live, then pick one. Grey-zombie KO only ever appears in the spotlight and tray.
4. **Sub-task zombie -> its parent task's routine hero** (no hero if the parent is standalone).
5. **Hero category = "Other" by default; the player can pick another category for the routine** (tasks have categories too, so "dominant habit category" is no longer the rule). This is the per-routine picker the 2026-10-14 decision parked:
   - new `routine.heroCategory` (one of the 8 category keys); readers still default a missing value to `'other'`.
   - picker: a category select in Create Routine + Manage Routine (reuse the task/habit category options).
   - the neutral default hero is dropped: **8 heroes, not 9**; "Other" is the default.
   - **Existing routines on upgrade (Jeremy, 21:53): seeded ONCE from their current dominant category across habit AND task members** (`habitDef.routineId` + the routine's `taskDefinitionIds`; archived habits excluded, `!archivedAt`). Tie-break: first category to reach the top count, same as today's `dominantCategoryOrInitial`. No categorised members -> `'other'`. After seeding the value is the player's to change; NEW routines start as Other.
   - Because the seed writes a value once, do it as a proper **schema 12 -> 13 migration** in `js/persistence.js` (the established pattern; inline math, no module deps), not a load-time sweep. Update `docs/DATA_SCHEMA.md`.
   - Adds a small step to sub-session 1 (field + picker + resolver `heroCategoryFor(routine)` replacing `dominantCategoryOrInitial` for hero art; the list/zombie category logic is untouched).

## Original open questions (resolved above)
1. Canvas zombie tap: popup **and** spotlight together (proposed; the popup may cover the hero on small screens), or spotlight first with the popup a second tap?
2. Portrait tray: drop down over the list (proposed) or rise over the strip?
3. KO'd hero look: desaturated twin, or literally the zombie sprite grey-tinted (no extra art, but must never be confused with a live zombie, so only in the spotlight and tray)?
4. Sub-task zombies: spotlight the parent's routine hero, or nothing?
5. Neutral default hero: reuse the "other" hero, or a distinct look (e.g. a watchman)?

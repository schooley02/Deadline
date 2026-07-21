# Art Style — Sprites, Categories, Base States

## Style
Pixel art / cartoonish. Playful, slightly eerie (graveyard setting) but never grim. Suitable for a younger audience.

**LOCKED 2026-07-21** (DECISIONS.md): pixel art is confirmed as the permanent style — all future assets match the existing 64×64 zombies. Sprite visibility over the background is handled by contrast (dark, low-detail silhouette background layers; bright saturated sprites — see VISUAL_DESIGN_PLAN.md V1), not by changing sprite style.

## AI Asset Pipeline (decided 2026-07-21)
- **Base sprite generation:** Retro Diffusion (true grid-aligned pixel art; use existing assets/renders as style reference).
- **Animation / rotations:** PixelLab (text-prompted cycles, 4/8-direction rotations, Aseprite extension).
- **Format:** raster PNG only — the pipeline is PNG sprites positioned by DOM/CSS; no vector sprites. SVG is used only for scene silhouette props (V1).
- Background is layered with slider-coupled parallax (clouds fastest → ground fixed); camera tilt rejected — never rotate pixel sprites.

## Canvas & Sprite Dimensions (from base view notes)
- Game canvas reference: **720 × 368**
- Character sprite sizing reference: **1290 × 720** scene basis (confirm exact per-sprite dimensions with Jeremy)

## The Base
A country church overlooking a vast eerie graveyard.
Damage states (assets exist in `prototype/`):
| Asset | Base HP |
|---|---|
| `base_100.png` | 76–100% (pristine) |
| `base_075.png` | 51–75% |
| `base_050.png` | 26–50% (smoking) |
| `base_025.png` | 1–25% (flames) |
| `base_000.png` | 0% (destroyed) |
Shake animation on every hit. Smoke → full flames right before destruction.

## Zombie Skins by Category (8 life domains)
| Category | Zombie look |
|---|---|
| Career | Business suit + briefcase |
| Creativity | Dressed as an artist |
| Financial | Rich-looking |
| Health | Dressed like a nurse |
| Lifestyle | Generic stylish zombie |
| Relationships | Dressed nice, holding a present |
| Spirituality | Nun |
| Other | Generic zombie |

## Enemy Visual Modifiers
- Closer to due: more menacing, faster animation.
- High priority: glow / bright outline.
- Parent task w/ sub-tasks: larger; shrinks as sub-tasks complete.
- Habit: smaller than task; high streak = on fire.

## Category Colors (from prototype, for UI accents)
other #90ee90 · career #4a90e2 · creativity #f5a623 · financial #50e3c2 · health #e91e63 · lifestyle #bd10e0 · relationships #f8e71c · spirituality #7ed321

## Asset Sources
- **FINISHED sprites: `Assets/Zombies/<category>-zombie.png` + `-64.png` (64×64) for all 8 categories** — use these.
- Base damage states: `Assets/Base/base_000..100.png`.
- Sub-task sprite convention: `subtask-[category]-[variant].png`, 64×64, CSS class `.zombie-subtask`, falls back to parent-category asset (see README.md sprite section).
- Concept art / PSD / XD sources live in `OneDrive\Documents\Baseline - Old\Deadline\` — binary files, never open in Claude.

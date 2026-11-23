# Graveyard v3 (2026-11-23) -- flat fenced plot, ART DONE (code version), NOT wired

Decided with Jeremy on mocks of the real scene (previews in this folder). The game still shows the old hill, tree and layout.

## Decisions
- Flat ground, no hill. Zone 140 -> **120px** wide (the zombie field ends at its left edge); the art reaches 48px further left, behind the zombies.
- **Tree removed from the game** (and with it the lifetime-nights growth display: dropped, not moved elsewhere).
- Wrought-iron fence, one continuous run, **no gate**; posts solid black; ordinary bars keep small grey tips.
- Headstones stay 48px (easier to tap); the fence is drawn over the front row and must not take taps (`pointer-events: none`).
- Full graveyard on every screen size for now (a Memorial-only phone version was mocked and shelved; a compact picture was rejected).
- Code version chosen over the PixelLab redraw (`pixellab/pixellab_redraw_not_used_256x128.png`: fence too heavy, hid the front stones).

## Layers (art px, shown at 2x like the church and lane; all three share one origin)
Origin: art x 0 = 48 screen px LEFT of the zone's left edge; bottom row = the canvas bottom. Paint order, back to front:
1. `graveyard_ground_84x40.png`   grass (lane-grass recipe), ragged left edge on the lane diagonal (88 right per 72 up); 4 rows of fringe above the 72px band
2. `graveyard_fence_back_84x52.png`  left side run + back run, fading with distance
3. Memorial, then the seven headstones (back row first)
4. `graveyard_fence_front_84x24.png` front run, IN FRONT of the stones

## Positions (screen px; x from the zone's left edge, feet above the canvas bottom)
- Memorial: centre x **75**, plinth feet **54** (was 60 / 74).
- Headstones (art centre x, feet): (6, 8) (52, 8) (98, 8) / (29, 26) (75, 26) / (52, 44) (98, 44). Even staggered grid: 46px apart in a row, rows 18px apart.
- Fence: front-left corner 40px left of the zone, feet 2px up; back run stands on the lane band's top edge (72px).

## Headstones v2 (2026-11-23, ART DONE; Jeremy picked a MIX of the two PixelLab redraws; NOT wired)
`headstones/headstone-0..4_24x24.png`: **24x24 art, shown at exactly 2x** (48px on screen, the size the old 32px files had at 1.5x). Centred on columns 11/12, foot on row 22, row 23 = grass contact shadow (no purple dirt strip). Each stage is a different form AND material so the step up shows:
0 plain wooden cross (two bare planks, like the original) - 1 rough fieldstone marker lying FLAT (about 12px tall on screen: the front fence hides most of it in the front row) - 2 small rough-hewn upright stone, chipped, mossy - 3 polished blue-grey granite, engraved cross, base, jar of flowers - 4 tall white marble, carved cross on top, gold lettering, stepped grey base, wreath.
**Final set (Jeremy 2026-11-23):** stage 0 (cross) and stage 1 (flat marker) from PixelLab redraw 1 ("B"), stages 2-4 from PixelLab redraw 2 ("C"), each cut out of its take and given the code version's grass foot. The all-code set he first approved is kept in `headstones/code_version/`. He may clean one up in the PixelLab editor: his downloaded version then replaces the file here (the API cannot read a gallery image back).
Wiring: swap `Assets/scene/headstone-0..4.png` for these, `MARKER_ART_PX` stays 48 (now an exact 2x), re-derive the per-stage mouse hit insets in `css/graveyard.css` from the new shapes. The two PixelLab takes are in `headstones/pixellab/` (file names say "not_used": they ARE the source of the final set). The Memorial was left as it is (judge it in the running game first).

## Still open
- Storm (wet) version of the ground layer: not made; the lane has `storm-` files with a wet tone.
- Portrait strip: graveyard stays hidden there (unchanged).

## PixelLab gallery (2026-11-23)
combined preview `17800d5a-fae7-495a-89d7-e176b1e5233b`, ground `0a168a57-4b99-4412-9c81-7d72efc3742c`, fence back `a1014917-6c27-474e-a755-ea99b87e45b0`, fence front `8742c677-cc46-45e6-835a-fef79c8f4f9e`.

Headstones gallery: stage0 `8063e8af-9fa8-4149-b259-09b6051a2d9e`, stage1 `edf67976-2201-47fe-9861-68aa7e01c1d8`, stage2 `ef802bc6-90b0-4839-a2ac-961fd72909d7`, stage3 `22873c18-5b06-40af-b66c-67d52da124cb`, stage4 `586a70ef-e6df-46ea-8ca0-51bd2075f07a`, sheet `bde76b5e-ff7e-4fb3-9283-6fcbf33ba604`.

## Rebuild
`python3 -I headstones/scripts/headstones.py <outDir>` draws the five headstones. `python3 -I scripts/graveyard_art.py <outDir> 7` draws the three layers. `scripts/mock_scene.py <projectRoot> <outDir>` (needs `scripts/slots.js` beside it and node) builds the scene mocks. `gy_ctx.py` / `gy_run.py` are the PixelLab pass (they need `pl.py` from `Assets/Barricade/_source/v2/scripts/` and a local `.key`; the key is never saved).

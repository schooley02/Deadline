"""The PixelLab calls behind the 25% smoke layer (record of 2026-11-21/22; see smoke25_layer.py for the build).
Needs pl.py (key in ~/.pl/key, never in the repo) and, for step 1 only, Jeremy's reference picture of smoke plumes
(NOT in the repo: he pastes it; pass its path). Seeds are given, but PixelLab does not promise identical results on a re-run:
the results that were actually used are saved in d25/ (smoke_layer_draft2_pixellab.png, smoke_layer_pl_left_41f.png,
smoke_layer_pl_right_41f.png), and smoke25_layer.py builds from those.

  python3 smoke25_layer_pl.py still <reference.png>     step 1: the plume drawing ("Draft 2"), 360x200
  python3 smoke25_layer_pl.py layout                    step 2: place the drawing -> d25/smoke_layer_still_unlit.png (code only)
  python3 smoke25_layer_pl.py animate left|right        step 3: PixelLab animates one window of that still (40 frames)

What did NOT work (do not retry without a new idea): inpaint-v3 for the plume (it fills the whole mask, so the smoke ends in
the mask's straight edge); a PixelLab-drawn end on the plume (finger-like lobes; rounder retries gave a straight cut or three
round balls); generate-image-v2 for a finer still with a layout guide (it ignores the layout; round balls); animating at 1x
(animate-with-text-v3 or pixminimax: the inside detail is dropped -> big flat "chunky" lobes); pixminimax seeds that reshape
the plume into a rope of round discs (seed 3) or draw red squiggles (seed 8); Scale2x for "smaller pixels" (no visible gain).
Generations used in the session: 450 (most of them on the tries above)."""
import os, sys
import numpy as np
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here); sys.path.insert(0, here)
CW, CH = 360, 200
STILL_COLOURS = ["#1c191d", "#251c23", "#322d33", "#3b3037", "#433135", "#523631", "#5b403a", "#4a261d"]      # smoke colours of Assets/Base/base_025.png
PLUM = {(91, 64, 58): (59, 48, 55), (82, 54, 49): (59, 48, 55), (74, 38, 29): (37, 28, 35), (62, 38, 33): (37, 28, 35)}   # PixelLab used the fire-lit browns as highlights: back to plum (firelight is added near the flames only)
BACK = {(28, 25, 29): (22, 20, 24), (37, 28, 35): (28, 25, 29), (50, 45, 51): (37, 28, 35), (59, 48, 55): (44, 38, 44), (67, 49, 53): (50, 45, 51)}   # the darker copy behind
SMOKE = ("a thick, heavy plume of dark fire smoke from a burning building at night. ONE continuous irregular mass of rolling "
         "billows with lumpy, scalloped edges, leaning and drifting to the RIGHT with the wind and leaving through the top edge "
         "of the picture. Flat tones with hard edges, only 3 or 4 dark smoke tones: near-black charcoal in the shadows and "
         "undersides, dark plum-grey on the lit upper sides, light and shadow shaped across the WHOLE mass (not each lump shaded "
         "as its own ball). A dull warm brown glow on the underside where the smoke is closest to the fire. Muted, gritty, "
         "realistic, not cartoonish. No straight edges, no triangles, no separate round balls.")
MOVE = ("Thick heavy smoke billowing and rolling slowly at a steady, even pace. The billows swell, roll over one another and curl as the smoke "
        "streams steadily from the lower left up to the upper right and out of the top of the frame. New billows keep welling up from the lower "
        "left. Slow, heavy, continuous motion at constant speed; the plume keeps its overall shape, size and position and never leaves the frame "
        "on the right. The edges stay full rounded billows: no thin tendrils, hooks, fingers or wisps. Smooth clean shapes, no speckles or grain.")
def still(ref_path):
    import pl
    ref = Image.open(ref_path).convert('RGBA')
    # the layout guide was a grey wedge above the roof line with the church as a black shape; PixelLab followed it only loosely
    body = {"description": "Pixel art, side view: " + SMOKE + " Smoke only: no building, no flames, no chimney, no sky, transparent background. The mass is thickest at the lower left and thins toward the upper right.",
            "image_size": {"width": CW, "height": CH}, "seed": 27, "no_background": True,
            "reference_images": [{"image": pl.img_obj(ref), "size": {"width": ref.width, "height": ref.height},
                                  "usage_description": "How the smoke is drawn: big rolling billows as irregular masses with scalloped edges, flat tones, hard edges, light and shadow shaped across the whole mass. Copy the drawing of the billows only, not the chimneys, the sky or the bright yellow."}],
            "target_palette": {"colors": STILL_COLOURS, "name": "dark fire smoke"}, "style_options": {"color_palette": False, "outline": True, "detail": True, "shading": True}}
    out = pl.wait(pl.req("POST", "/generate-image-v2", body))[0]; out.save(os.path.join(root, 'd25', 'smoke_layer_draft2_pixellab_rerun.png')); return out
def place(art, dx, dy, remap):
    out = np.zeros((CH + 20, CW, 4), np.uint8); a = np.array(art); ys, xs = np.where(a[..., 3] > 0)
    for y, x in zip(ys, xs):
        X, Y = x + dx, y + dy
        if 0 <= X < CW and 0 <= Y < CH + 20:
            c = tuple(int(v) for v in a[y, x, :3]); c = PLUM.get(c, c); out[Y, X] = remap.get(c, c) + (255,)
    return out
def layout():
    """The approved layout, drawn 20 px LOWER than it sits on screen (rows 0..19 of this picture are above the screen):
    front copy at (-74, -84) on screen, the darker copy behind at (-170, -120)."""
    art = Image.open(os.path.join(root, 'd25', 'smoke_layer_draft2_pixellab.png')).convert('RGBA')
    back = place(art, -170, -120 + 20, BACK); front = place(art, -74, -84 + 20, {})
    m = front[..., 3] > 0; back[m] = front[m]
    Image.fromarray(back, 'RGBA').save(os.path.join(root, 'd25', 'smoke_layer_still_unlit.png')); return back
def animate(which):
    import pl
    x0 = 0 if which == "left" else 126                         # window = canvas x x0..x0+170, rows -20..150, sent at 1.5x (256x256)
    ext = Image.fromarray(layout(), 'RGBA'); first = ext.crop((x0, 0, x0 + 170, 170)).resize((256, 256), Image.NEAREST)
    body = {"first_frame": pl.img_obj(first), "last_frame": pl.img_obj(first), "description": MOVE, "frame_count": 40, "seed": 14, "no_background": True, "view": "side",
            "subject_description": "a thick plume of dark fire smoke made of many rounded rolling billows", "initial_pose": "a wide plume of smoke rising from the lower left to the upper right"}
    outs = pl.wait(pl.req("POST", "/animate-pixminimax", body))    # 41 frames: index 0 = the input, 1..40 = the animation
    st = Image.new('RGBA', (len(outs) * 256, 256), (0, 0, 0, 0))
    for i, o in enumerate(outs): st.paste(o.convert('RGBA'), (i * 256, 0))
    st.save(os.path.join(root, 'd25', f'smoke_layer_pl_{which}_41f_rerun.png')); return st
if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "still": still(sys.argv[2])
    elif cmd == "layout": layout(); print("wrote d25/smoke_layer_still_unlit.png")
    elif cmd == "animate": animate(sys.argv[2])
    else: print(__doc__)

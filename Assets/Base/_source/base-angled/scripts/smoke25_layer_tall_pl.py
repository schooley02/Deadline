"""The PixelLab calls behind the TALLER 25% smoke layer (record of 2026-11-22; see smoke25_layer_tall.py for the build).
Needs pl.py (key in ~/.pl/key, never in the repo). Seeds are given, but PixelLab does not promise identical results on a
re-run: the results that were actually used are saved in d25/ and smoke25_layer_tall.py builds from those.

  python3 smoke25_layer_tall_pl.py still1      step 1: continue the placed Draft 2 drawing upward (inpaint-v3, seed 11, result 0)
                                               -> d25/smoke_layer_tall_still_v1_pixellab.png (448 x 384: x 0..447, rows -214..169)
  python3 smoke25_layer_tall_pl.py still2      step 2: open sky on the upper left. Step 1's drawing is kept, everything left of a new
                                               upper-left edge is removed and PixelLab redraws only a band along that edge
                                               (inpaint-v3, seed 11, result 0; its reddish tone is set to the lit plum in that band)
                                               -> d25/smoke_layer_tall_still_pixellab.png
  python3 smoke25_layer_tall_pl.py animate u1|u2|u3   step 3: PixelLab animates one 170x170 window, rows -170..0, sent at 1.5x
                                               (animate-pixminimax, 40 frames, guided back to its first frame, transparent background,
                                               PixelLab removes the background). u1 = x 0..170, seed 14, from the step-2 drawing;
                                               u2 = x 126..296, seed 14, and u3 = x 252..422, seed 21 (both drawings are the same there)
                                               -> d25/smoke_layer_tall_pl_u1/u2/u3_41f.png

What did NOT work (do not retry without a new idea):
  - A solid mass at the top-left (step 1 alone). The approved animation shows open sky at its top-left corner in 26 of 40 frames;
    with smoke above it, that sky became a flat-topped notch at the left edge.
  - Asking for the whole band in one inpaint (both edges new): the new part came out reddish and lighter than the kept drawing,
    with the kept rectangle faintly visible.
  - Animating on an opaque flat background colour with no background removal: PixelLab then keeps the inside of the smoke almost
    still (540 edge pixels in u1 that never move; the approved windows have none), and a window full of smoke shrinks to a blob.
  - Other seeds: u1 seed 5 has one frame with a large hole; u3 seed 14 has light squiggles and moments with a straight edge;
    u3 seed 5 has more squiggles than seed 21.
  - inpaint-v3 follows the mask's outline where the mask ends in open sky, so both edges of the band are lumpy outlines made here
    (irregular ellipses of different sizes) that PixelLab then shades and animates. Left to itself it only drew its own edge once
    (the upper-left corner of step 1).
Generations: 141 for the taller plume (8,150 -> 8,009).
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here); sys.path.insert(0, here)
import smoke25_layer as L, smoke25_layer_pl as P
W, H, UP = 448, 384, 214                                  # picture = art px, x 0..447, rows -214..169 (row 0 = the church frame's top)
D25 = os.path.join(root, 'd25')
RIGHT = [(286, 2), (318, -34), (346, -78), (370, -124), (392, -170), (408, -214)]                   # the plume's right-hand edge above the approved frame
LEFT = [(-4, 12), (22, -16), (44, -52), (66, -94), (90, -138), (112, -180), (128, -214)]            # its upper-left edge (open sky to the left of it)
D1 = ("Pixel art. The upper part of the same thick, heavy plume of dark fire smoke, rising and drifting up and to the right: ONE continuous "
      "mass of big rolling billows that continue the billows below without a break, in exactly the same flat dark tones (near-black charcoal, "
      "dark plum-grey), hard edges, same size of billows, light and shadow shaped across the whole mass. The right-hand edge is lumpy, "
      "scalloped rolling billows. Muted, gritty. No straight edges, no separate round balls, no thin wisps, no fire, no glow.")
D2 = ("Pixel art. The left-hand EDGE of the same thick plume of dark fire smoke: lumpy, irregular, scalloped rolling billows of different sizes "
      "that belong to the mass on their right and continue its billows without a break, in exactly the same flat dark tones (near-black "
      "charcoal, dark plum-grey), hard edges. Muted, gritty. No straight edges, no row of equal round balls, no thin wisps, no fire, no glow.")
def base_layout():
    """the approved layout (front copy of Draft 2 at -74,-84; the darker copy behind at -170,-120) on the taller picture"""
    A = np.array(Image.open(os.path.join(D25, 'smoke_layer_draft2_pixellab.png')).convert('RGBA')); cv = np.zeros((H, W, 4), np.uint8)
    for dx, dy, remap in ((-170, -120, P.BACK), (-74, -84, {})):
        ys, xs = np.where(A[..., 3] > 0)
        for y, x in zip(ys, xs):
            X, Y = x + dx, y + dy + UP
            if 0 <= X < W and 0 <= Y < H:
                c = tuple(int(v) for v in A[y, x, :3]); c = P.PLUM.get(c, c); cv[Y, X] = remap.get(c, c) + (255,)
    return cv
def still1_inputs(seed=5):
    """kept: the placed drawing in rows >= -76, x <= 278. Generated: the rest of the region left of the lumpy RIGHT edge, above row 12."""
    cv = base_layout(); yy, xx = np.mgrid[0:H, 0:W]
    keep = (cv[..., 3] > 0) & (yy - UP >= -76) & (xx <= 278)
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    d.polygon([(0, -214 + UP)] + [(x, y + UP) for x, y in reversed(RIGHT)] + [(286, 30 + UP), (0, 30 + UP)], fill=255)
    rng = np.random.default_rng(seed)
    for i in range(len(RIGHT) - 1):
        (x0, y0), (x1, y1) = RIGHT[i], RIGHT[i + 1]; n = 4
        for k in range(n):
            t = (k + rng.uniform(0.1, 0.9)) / n; r = rng.uniform(7, 19); off = rng.uniform(-6, 5)
            cx, cy = x0 + (x1 - x0) * t + off, y0 + (y1 - y0) * t + UP + rng.uniform(-4, 4)
            d.ellipse([cx - r, cy - r * rng.uniform(0.7, 1.0), cx + r, cy + r * rng.uniform(0.7, 1.0)], fill=255)
    gen = (np.array(m) > 0) & ~keep & (yy - UP < 12)
    src = cv.copy(); src[~keep] = 0
    return Image.fromarray(src, 'RGBA'), Image.fromarray(np.where(gen, 255, 0).astype(np.uint8), 'L')
def leftx(row):
    return np.interp(-row, [-y for _, y in LEFT], [x for x, _ in LEFT])
def still2_inputs(seed=4):
    """step 1's drawing stays where x > left edge + 16 (and everywhere from row 14 down); the band between is generated"""
    a = np.array(Image.open(os.path.join(D25, 'smoke_layer_tall_still_v1_pixellab.png')).convert('RGBA')); yy, xx = np.mgrid[0:H, 0:W]; row = yy - UP
    lx = leftx(row.astype(float))
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m); rng = np.random.default_rng(seed)
    for i in range(len(LEFT) - 1):
        (x0, y0), (x1, y1) = LEFT[i], LEFT[i + 1]; t = rng.uniform(0.0, 0.25)
        while t < 1.0:
            r = rng.uniform(6, 22); cx = x0 + (x1 - x0) * t - rng.uniform(-3, 7); cy = y0 + (y1 - y0) * t + UP + rng.uniform(-5, 5)
            d.ellipse([cx - r, cy - r * rng.uniform(0.6, 1.0), cx + r, cy + r * rng.uniform(0.6, 1.0)], fill=255); t += rng.uniform(0.12, 0.5)
    lump = np.array(m) > 0
    inner = (xx > lx + 16) | (row >= 14)
    band = ((xx > lx - 2) | lump) & ~inner & (row < 14) & (row > -212)
    src = a.copy(); src[~inner] = 0
    return Image.fromarray(src, 'RGBA'), Image.fromarray(np.where(band, 255, 0).astype(np.uint8), 'L')
def inpaint(src, mask, desc, seed, pick=0):
    import pl
    m = Image.merge("RGBA", (mask, mask, mask, Image.new("L", mask.size, 255)))
    return pl.inpaint(src, m, desc, seed=seed, no_bg=True)[pick]
def still1():
    src, mask = still1_inputs(); out = inpaint(src, mask, D1, 11); out.save(os.path.join(D25, 'smoke_layer_tall_still_v1_pixellab_rerun.png')); return out
def still2():
    src, mask = still2_inputs(); a = np.array(inpaint(src, mask, D2, 11).convert('RGBA'))
    warm = (np.array(mask) > 0) & (L.to_idx(a) == 6); a[warm, :3] = (59, 48, 55)                 # PixelLab's reddish highlight in the new band -> the lit plum
    out = Image.fromarray(a, 'RGBA'); out.save(os.path.join(D25, 'smoke_layer_tall_still_pixellab_rerun.png')); return out
WIN = {"u1": (0, 14, 'smoke_layer_tall_still_pixellab.png'), "u2": (126, 14, 'smoke_layer_tall_still_v1_pixellab.png'), "u3": (252, 21, 'smoke_layer_tall_still_pixellab.png')}
def animate(which):
    import pl
    x0, seed, still = WIN[which]; ext = Image.open(os.path.join(D25, still)).convert('RGBA')
    first = ext.crop((x0, UP - 170, x0 + 170, UP)).resize((256, 256), Image.NEAREST)
    body = {"first_frame": pl.img_obj(first), "last_frame": pl.img_obj(first), "description": P.MOVE, "frame_count": 40, "seed": seed, "no_background": True, "view": "side",
            "subject_description": "a thick plume of dark fire smoke made of many rounded rolling billows", "initial_pose": "a wide plume of smoke rising from the lower left to the upper right"}
    outs = pl.wait(pl.req("POST", "/animate-pixminimax", body))    # 41 frames: index 0 = the input, 1..40 = the animation
    st = Image.new('RGBA', (len(outs) * 256, 256), (0, 0, 0, 0))
    for i, o in enumerate(outs): st.paste(o.convert('RGBA'), (i * 256, 0))
    st.save(os.path.join(D25, f'smoke_layer_tall_pl_{which}_41f_rerun.png')); return st
if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "still1": still1()
    elif cmd == "still2": still2()
    elif cmd == "animate": animate(sys.argv[2])
    else: print(__doc__)

"""Step 1 of the upward extension: extend the placed Draft 2 plume above the current frame with PixelLab inpainting.
Image = art px, x 0..448, rows -214..170 (UP = 214). Kept: the placed drawing in rows >= -76, x <= 278. Generated: the rest of the plume region."""
import sys, os
sys.path.insert(0, '/home/claude/work/ba/scripts')
import numpy as np
from PIL import Image, ImageDraw
import smoke25_layer_pl as P
W, H, UP = 448, 384, 214
art = Image.open('/home/claude/work/ba/d25/smoke_layer_draft2_pixellab.png').convert('RGBA'); A = np.array(art)
def place(canvas, dx, dy, remap):
    ys, xs = np.where(A[..., 3] > 0)
    for y, x in zip(ys, xs):
        X, Y = x + dx, y + dy + UP
        if 0 <= X < W and 0 <= Y < H:
            c = tuple(int(v) for v in A[y, x, :3]); c = P.PLUM.get(c, c); canvas[Y, X] = remap.get(c, c) + (255,)
def base_layout():
    cv = np.zeros((H, W, 4), np.uint8); place(cv, -170, -120, P.BACK); place(cv, -74, -84, {}); return cv
def region(variant, seed=5):
    """the plume's region above the frame: everything left of a lumpy right-hand boundary"""
    pts = {"steep": [(286, 2), (318, -34), (346, -78), (370, -124), (392, -170), (408, -214)],
           "lean":  [(286, 2), (330, -24), (372, -56), (404, -96), (424, -150), (436, -214)]}[variant]
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    poly = [(0, -214 + UP)] + [(x, y + UP) for x, y in reversed(pts)] + [(286, 30 + UP), (0, 30 + UP)]
    d.polygon(poly, fill=255)
    rng = np.random.default_rng(seed)
    for i in range(len(pts) - 1):                    # irregular lumps along the boundary so it is not a straight line
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]; n = 4
        for k in range(n):
            t = (k + rng.uniform(0.1, 0.9)) / n; r = rng.uniform(7, 19); off = rng.uniform(-6, 5)
            cx, cy = x0 + (x1 - x0) * t + off, y0 + (y1 - y0) * t + UP + rng.uniform(-4, 4)
            d.ellipse([cx - r, cy - r * rng.uniform(0.7, 1.0), cx + r, cy + r * rng.uniform(0.7, 1.0)], fill=255)
    return np.array(m) > 0
def build_inputs(variant):
    cv = base_layout(); yy, xx = np.mgrid[0:H, 0:W]
    keep = (cv[..., 3] > 0) & (yy - UP >= -76) & (xx <= 278)
    reg = region(variant)
    gen = reg & ~keep & (yy - UP < 12)               # generate only above / beside the kept drawing, never inside the visible frame's kept art
    src = cv.copy(); src[~keep] = 0
    mask = np.where(gen, 255, 0).astype(np.uint8)
    return Image.fromarray(src, 'RGBA'), Image.fromarray(mask, 'L'), keep, gen
D = ("Pixel art. The upper part of the same thick, heavy plume of dark fire smoke, rising and drifting up and to the right: ONE continuous "
     "mass of big rolling billows that continue the billows below without a break, in exactly the same flat dark tones (near-black charcoal, "
     "dark plum-grey), hard edges, same size of billows, light and shadow shaped across the whole mass. The right-hand edge is lumpy, "
     "scalloped rolling billows. Muted, gritty. No straight edges, no separate round balls, no thin wisps, no fire, no glow.")
if __name__ == "__main__":
    import pl
    variant = sys.argv[1]; seeds = [int(s) for s in sys.argv[2:]]
    src, mask, keep, gen = build_inputs(variant); src.save(f'in_{variant}_src.png'); mask.save(f'in_{variant}_mask.png')
    m = Image.merge("RGBA", (mask, mask, mask, Image.new("L", mask.size, 255)))
    b0 = pl.balance()
    for s in seeds:
        outs = pl.inpaint(src, m, D, seed=s, no_bg=True)
        for i, o in enumerate(outs): o.save(f'out_{variant}_s{s}_{i}.png')
        print(variant, s, len(outs), outs[0].size, flush=True)
    b1 = pl.balance(); print('generations used', b0 - b1, 'left', b1)
"""Taller plume, second layout: open sky at the top-left, because the APPROVED animation shows the plume's upper-left edge
(open sky at the left of its top rows) in 26 of its 40 frames. The plume is a band rising to the right between two edges."""
import sys, os
sys.path.insert(0, '/home/claude/work/ba/scripts'); sys.path.insert(0, '/home/claude/work/p3')
import numpy as np
from PIL import Image, ImageDraw
import ext_still as E
W, H, UP = E.W, E.H, E.UP
LEFT = [(-4, 12), (22, -16), (44, -52), (66, -94), (90, -138), (112, -180), (128, -214)]
RIGHT = [(286, 2), (318, -34), (346, -78), (370, -124), (392, -170), (408, -214)]
def lumpy(d, pts, rng, side):
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]; t = rng.uniform(0.0, 0.25)
        while t < 1.0:
            r = rng.uniform(6, 22); cx = x0 + (x1 - x0) * t + side * rng.uniform(-3, 7); cy = y0 + (y1 - y0) * t + UP + rng.uniform(-5, 5)
            d.ellipse([cx - r, cy - r * rng.uniform(0.6, 1.0), cx + r, cy + r * rng.uniform(0.6, 1.0)], fill=255); t += rng.uniform(0.12, 0.5)
def region(seed=9):
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    poly = [(x, y + UP) for x, y in LEFT] + [(x, y + UP) for x, y in reversed(RIGHT)] + [(286, 30 + UP), (-4, 30 + UP)]
    d.polygon(poly, fill=255); rng = np.random.default_rng(seed); lumpy(d, RIGHT, rng, +1); lumpy(d, LEFT, rng, -1)
    return np.array(m) > 0
def leftx(row):
    xs = [p[0] for p in LEFT]; ys = [p[1] for p in LEFT]; return np.interp(-row, [-y for y in ys], xs)
def build_inputs():
    cv = E.base_layout(); yy, xx = np.mgrid[0:H, 0:W]; row = yy - UP
    lx = leftx(row.astype(float))
    keep = (cv[..., 3] > 0) & (row >= -76) & (xx <= 278) & ((row >= 14) | (xx > lx + 14))
    reg = region(); gen = reg & ~keep & (row < 14)
    src = cv.copy(); src[~keep] = 0
    return Image.fromarray(src, 'RGBA'), Image.fromarray(np.where(gen, 255, 0).astype(np.uint8), 'L')
D = ("Pixel art. The upper part of the same thick, heavy plume of dark fire smoke, rising and drifting up and to the right as a broad band with "
     "open sky on both sides: ONE continuous mass of big rolling billows that continue the billows below without a break, in exactly the same "
     "flat dark tones (near-black charcoal, dark plum-grey), hard edges, same size of billows, light and shadow shaped across the whole mass. "
     "Both edges of the band are lumpy, irregular, scalloped rolling billows of different sizes. Muted, gritty. No straight edges, no row of "
     "equal round balls, no thin wisps, no fire, no glow.")
if __name__ == "__main__":
    src, mask = build_inputs(); src.save('in2_src.png'); mask.save('in2_mask.png')
    bg = Image.new('RGBA', src.size, (88, 88, 113, 255)); red = Image.new('RGBA', src.size, (200, 60, 60, 255)); bg.paste(red, (0, 0), mask); bg.alpha_composite(src); bg.resize((896, 768), Image.NEAREST).save('in2_preview.png')
    if len(sys.argv) > 1:
        import pl
        m = Image.merge("RGBA", (mask, mask, mask, Image.new("L", mask.size, 255))); b0 = pl.balance()
        for s in [int(v) for v in sys.argv[1:]]:
            outs = pl.inpaint(src, m, D, seed=s, no_bg=True)
            for i, o in enumerate(outs): o.save(f'out2_s{s}_{i}.png')
            print('seed', s, len(outs), outs[0].size, flush=True)
        print('generations used', b0 - pl.balance(), 'left', pl.balance())
"""Taller plume, layout 3 = version 1 with open sky at the top-left: version 1's drawing is kept, everything left of a new
upper-left edge is removed, and PixelLab redraws only a band along that edge."""
import sys
sys.path.insert(0, '/home/claude/work/ba/scripts'); sys.path.insert(0, '/home/claude/work/p3')
import numpy as np
from PIL import Image, ImageDraw
import ext_still as E, ext_still2 as E2
W, H, UP = E.W, E.H, E.UP
def build_inputs(seed=4):
    a = np.array(Image.open('out_steep_s11_0.png').convert('RGBA')); yy, xx = np.mgrid[0:H, 0:W]; row = yy - UP
    lx = E2.leftx(row.astype(float))
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m); rng = np.random.default_rng(seed)
    E2.lumpy(d, E2.LEFT, rng, -1); lump = np.array(m) > 0
    inner = (xx > lx + 16) | (row >= 14)                      # version 1's drawing stays here
    band = ((xx > lx - 2) | lump) & ~inner & (row < 14) & (row > -212)
    src = a.copy(); src[~inner] = 0
    return Image.fromarray(src, 'RGBA'), Image.fromarray(np.where(band, 255, 0).astype(np.uint8), 'L')
D = ("Pixel art. The left-hand EDGE of the same thick plume of dark fire smoke: lumpy, irregular, scalloped rolling billows of different sizes "
     "that belong to the mass on their right and continue its billows without a break, in exactly the same flat dark tones (near-black "
     "charcoal, dark plum-grey), hard edges. Muted, gritty. No straight edges, no row of equal round balls, no thin wisps, no fire, no glow.")
if __name__ == "__main__":
    src, mask = build_inputs(); src.save('in3_src.png'); mask.save('in3_mask.png')
    bg = Image.new('RGBA', src.size, (88, 88, 113, 255)); red = Image.new('RGBA', src.size, (200, 60, 60, 255)); bg.alpha_composite(src); bg.paste(red, (0, 0), mask); bg.resize((896, 768), Image.NEAREST).save('in3_preview.png')
    if len(sys.argv) > 1:
        import pl
        m = Image.merge("RGBA", (mask, mask, mask, Image.new("L", mask.size, 255))); b0 = pl.balance()
        for s in [int(v) for v in sys.argv[1:]]:
            outs = pl.inpaint(src, m, D, seed=s, no_bg=True)
            for i, o in enumerate(outs): o.save(f'out3_s{s}_{i}.png')
            print('seed', s, len(outs), flush=True)
        print('generations used', b0 - pl.balance(), 'left', pl.balance())
"""Upper windows the way the approved lower windows were made: transparent background, PixelLab removes the background."""
import sys
sys.path.insert(0, '/home/claude/work/ba/scripts')
from PIL import Image
import pl, smoke25_layer_pl as P
UP = 214; X0 = {"u1": 0, "u2": 126, "u3": 252}
which, seed, src, tag = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
ext = Image.open(src).convert('RGBA'); x0 = X0[which]
first = ext.crop((x0, UP - 170, x0 + 170, UP)).resize((256, 256), Image.NEAREST)
body = {"first_frame": pl.img_obj(first), "last_frame": pl.img_obj(first), "description": P.MOVE, "frame_count": 40, "seed": seed, "no_background": True, "view": "side",
        "subject_description": "a thick plume of dark fire smoke made of many rounded rolling billows", "initial_pose": "a wide plume of smoke rising from the lower left to the upper right"}
outs = pl.wait(pl.req("POST", "/animate-pixminimax", body))
st = Image.new('RGBA', (len(outs) * 256, 256), (0, 0, 0, 0))
for i, o in enumerate(outs): st.paste(o.convert('RGBA'), (i * 256, 0))
st.save(f'up{tag}_{which}_s{seed}_{len(outs)}f.png'); print(which, 'seed', seed, 'frames', len(outs), flush=True)
o = Image.new('RGB', (256 * 7 + 6 * 4, 256 * 2 + 4), (104, 132, 168))
for k, i in enumerate([0, 1, 4, 8, 12, 16, 20, 24, 28, 32, 36, 38, 39, 40]): o.paste(st.crop((i * 256, 0, i * 256 + 256, 256)), ((k % 7) * 260, (k // 7) * 260), st.crop((i * 256, 0, i * 256 + 256, 256)))
o.save(f'up{tag}_{which}_s{seed}_contact.png')

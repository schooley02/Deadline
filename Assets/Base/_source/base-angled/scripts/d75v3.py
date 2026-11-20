"""75% v3 from base_100_final: everything that was a pasted rectangle is now drawn in code on top of the
original art (boards over the original windows, mud/scratches/grime with no box edges, shingles in the roof's
own grid). Kept from PixelLab: door scratches (inside the door only) and the torn sandbag."""
import math, random, colorsys
from PIL import Image, ImageDraw
base = Image.open("base_100_final.png").convert("RGBA")
im = base.copy(); px = im.load(); W, H = im.size
random.seed(11)
def lum(p): return .3 * p[0] + .59 * p[1] + .11 * p[2]
def hls(p): return colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)

# --- 0. PixelLab bits that sit inside their own objects (door leaf, torn bag)
door = Image.open("d75b_door_111_0.png").convert("RGBA").load()
for y in range(112, 171):
    for x in range(121, 139):                  # inside the door leaves only, frame untouched
        px[x, y] = door[x, y]
bag = Image.open("d75_bags_102_0.png").convert("RGBA"); bm = Image.open("d75_mask_bags.png").convert("L")
im = Image.composite(bag, im, bm); px = im.load()

# --- 1. statue silhouette (kept clean of grime / mud)
statue = Image.new("L", im.size, 0)
ImageDraw.Draw(statue).polygon([(30, 116), (38, 116), (41, 123), (42, 134), (44, 148), (44, 162), (47, 164), (47, 191),
                                (21, 191), (21, 164), (25, 162), (26, 148), (27, 134), (28, 123)], fill=255)
sp = statue.load()
def painted(x, y):
    p = px[x, y]
    if p[3] < 255 or sp[x, y]: return False
    h, l, s = hls(p); return s < 0.22 and l > 0.28

# --- 2. grime everywhere on the white paint (value noise + dirt rising from the ground + drips), no edges
G = {}
def noise(x, y, s):
    gx, gy = x / s, y / s; x0, y0 = int(gx), int(gy); fx, fy = gx - x0, gy - y0
    def r(i, j):
        if (i, j, s) not in G: G[(i, j, s)] = random.random()
        return G[(i, j, s)]
    a = r(x0, y0) * (1 - fx) + r(x0 + 1, y0) * fx; c = r(x0, y0 + 1) * (1 - fx) + r(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + c * fy
def ground(x):                                  # bottom of the painted wall at column x (just above foundation/sandbags)
    return 172 if x >= 97 else round(168 - 0.08 * (97 - x))
drips = [(5, 158), (12, 158), (55, 163), (67, 163), (101, 163), (110, 162), (148, 156), (157, 154)]
for y in range(H):
    for x in range(W):
        if not painted(x, y): continue
        g = 0.17 * noise(x, y, 9) + 0.09 * noise(x, y, 4)
        g += 0.30 * max(0.0, (y - (ground(x) - 38)) / 38) ** 1.4
        for dx, sy in drips:
            if abs(x - dx) <= 1 and sy < y < sy + 14: g += 0.10 * (1 - (y - sy) / 14) * (1 - abs(x - dx) * .4)
        f = 1 - min(0.45, g); p = px[x, y]
        px[x, y] = (int(p[0] * f * 0.99), int(p[1] * f * 0.97), int(p[2] * f * 0.93), 255)

# --- 3. mud band + splatter + claw scratches along the bottom of every wall (left wall, both sides of the door)
MUD = (58, 46, 36)
for x in range(W):
    gy = ground(x)
    for y in range(gy - 16, gy + 1):
        if not (0 <= y < H) or not painted(x, y): continue
        t = (y - (gy - 16)) / 16
        a = min(1, max(0, t * 1.2 - 0.25 + 0.5 * (noise(x, y, 3) - .5)))
        p = px[x, y]; px[x, y] = tuple(int(p[c] * (1 - a * .75) + MUD[c] * a * .75) for c in range(3)) + (255,)
for _ in range(240):                              # splatter dots
    x = random.randrange(0, 162); gy = ground(x); y = gy - int(random.random() ** 2 * 26)
    if 0 <= y < H and painted(x, y): px[x, y] = (70, 56, 44, 255) if random.random() < .6 else (48, 38, 30, 255)
SCR, SCRL = (44, 38, 36, 255), (150, 146, 140, 255)
spots = [(6, 160), (22, 158), (62, 162), (84, 160), (101, 164), (113, 160), (144, 162), (155, 158)]
for sx, sy in spots:                              # 3 parallel claw strokes, down-left, with a pale gouged edge
    for k in range(3):
        for i in range(6):
            x, y = sx + k * 2 - i // 2, sy + i
            if 0 <= x < W and painted(x, y): px[x, y] = SCR
            if 0 <= x + 1 < W and painted(x + 1, y) and i % 2 == 0: px[x + 1, y] = SCRL

# --- 4. boards drawn ON TOP of the original windows (light still shows between them)
WOOD = [(132, 104, 76), (110, 86, 62), (92, 72, 52)]  # top highlight, body, bottom shade
OUTL = (38, 30, 24, 255)
def plank(x0, x1, y0, slope, thick=3):
    pts = {}
    for x in range(x0, x1 + 1):
        yt = round(y0 + slope * (x - x0))
        for j in range(thick): pts[(x, yt + j)] = WOOD[min(j, 2)] + (255,)
    ring = {(x + dx, y + dy) for (x, y) in pts for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - set(pts)
    for q in ring:
        if 0 <= q[0] < W and 0 <= q[1] < H: px[q] = OUTL
    for (x, y), c in pts.items():
        if 0 <= x < W and 0 <= y < H:
            if (x * 5 + y * 3) % 13 == 0: c = WOOD[2] + (255,)            # grain
            px[x, y] = c
    for xn in (x0 + 1, x1 - 1):                                          # nail heads
        yn = round(y0 + slope * (xn - x0)) + 1
        if 0 <= xn < W: px[xn, yn] = (40, 40, 44, 255)
# side wall windows (wall runs nearly level), planks a little crooked
for (x0, x1, y0, s) in [(-1, 19, 121, 0.10), (-1, 19, 135, -0.08), (-1, 19, 148, 0.06),
                        (47, 75, 124, -0.10), (47, 75, 138, 0.07), (47, 75, 151, -0.05)]:
    plank(max(0, x0), x1, y0 if x0 >= 0 else round(y0 + s), s)
# front lancets: the wall rises 0.2 px per px to the right; planks follow it, slightly crooked
for (x0, x1, y0, s) in [(97, 114, 128, -0.28), (97, 114, 141, -0.14), (97, 114, 153, -0.22),
                        (145, 161, 119, -0.12), (145, 161, 133, -0.28), (145, 161, 146, -0.18)]:
    plank(x0, x1, y0, s)

# --- 5. roof: missing shingles + a repair, drawn in the roof's own grid (rows every 4 px, shingles ~10 px wide)
def gap(x0, x1, ytop, slope=-0.09):
    for x in range(x0, x1 + 1):
        yt = round(ytop + slope * (x - x0))
        cols = [(14, 13, 16), (22, 19, 20), (58, 45, 34), (24, 20, 20)]   # hole, hole, dim batten, hole
        for j, c in enumerate(cols): px[x, yt + j] = c + (255,)
    # the shingle edge below the hole catches a little light
    for x in range(x0, x1 + 1):
        yb = round(ytop + slope * (x - x0)) + 4
        p = px[x, yb]; px[x, yb] = (min(255, p[0] + 18), min(255, p[1] + 18), min(255, p[2] + 22), 255)
gap(58, 66, 71); gap(62, 70, 75); gap(84, 91, 63)
def patch(x0, x1, ytop, slope=-0.09):                    # newer, slightly lighter replacement shingles
    for x in range(x0, x1 + 1):
        yt = round(ytop + slope * (x - x0))
        for j in range(3):
            p = px[x, yt + j]; px[x, yt + j] = (min(255, p[0] + 14), min(255, p[1] + 14), min(255, p[2] + 10), 255)
patch(38, 47, 68); patch(44, 53, 72); patch(36, 45, 76)

im.save("base_075_v3.png")
bg = Image.new("RGBA", im.size, (60, 56, 80, 255)); bg.alpha_composite(im)
o2 = Image.new("RGBA", im.size, (60, 56, 80, 255)); o2.alpha_composite(base)
S = Image.new("RGBA", (W * 2 + 8, H), (20, 20, 28, 255)); S.alpha_composite(o2, (0, 0)); S.alpha_composite(bg, (W + 8, 0))
S.resize((S.width * 3, S.height * 3), Image.NEAREST).save("/tmp/d75v3.png")
bg.resize((W * 4, H * 4), Image.NEAREST).save("/tmp/d75v3z.png")

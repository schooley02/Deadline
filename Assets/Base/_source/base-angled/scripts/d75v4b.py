"""75% v4: PixelLab mud blended in with soft, uneven top edges; muddy zombie handprints all the way around;
boards on every window drawn on top of the original glass, each window boarded DIFFERENTLY; roof holes from stage A."""
import math, random, colorsys
from PIL import Image, ImageDraw
random.seed(23)
A = Image.open("d75v4_stageA.png").convert("RGBA")
im = A.copy(); px = im.load(); ap = A.load(); W, H = im.size
def hls(p): return colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)
G = {}
def noise(x, y, s, salt=0):
    gx, gy = x / s, y / s; x0, y0 = int(gx), int(gy); fx, fy = gx - x0, gy - y0
    def r(i, j):
        k = (i, j, s, salt)
        if k not in G: G[k] = random.random()
        return G[k]
    a = r(x0, y0) * (1 - fx) + r(x0 + 1, y0) * fx; c = r(x0, y0 + 1) * (1 - fx) + r(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + c * fy

# 1. mud: soft blend, strongest at the bottom of each band, ragged fading top, feathered sides
picks = {"s1": "121_0", "s2": "122_0", "s3": "122_0", "s4": "121_0", "s5": "122_0"}
rects = {"s1": (0, 148, 20, 172), "s2": (18, 150, 50, 194), "s3": (48, 154, 97, 172), "s4": (97, 150, 118, 174), "s5": (140, 146, 162, 174)}
for n, k in picks.items():
    src = Image.open(f"d75v4_{n}_{k}.png").convert("RGBA").load()
    x0, y0, x1, y1 = rects[n]
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if ap[x, y][3] < 255 or src[x, y][3] < 255: continue
            t = (y - y0) / max(1, y1 - y0)                     # 0 top .. 1 bottom
            edge = 0.35 + 0.45 * noise(x, y0, 4, 1)            # ragged top edge per column
            a = max(0.0, min(1.0, (t - edge * 0.55) / 0.35))
            side = min(x - x0, x1 - x) / 4.0                   # feather the sides into the neighbours
            if n != "s1" or x > x0 + 2: a *= min(1.0, side)
            if a <= 0: continue
            p, q = px[x, y], src[x, y]
            px[x, y] = tuple(int(p[c] * (1 - a) + q[c] * a) for c in range(3)) + (255,)

# 2. muddy handprints all the way around (zombie hands slapping the wall above the mud)
statue = Image.new("L", im.size, 0)
ImageDraw.Draw(statue).polygon([(30, 116), (38, 116), (41, 123), (42, 134), (44, 148), (44, 162), (47, 164), (47, 191),
                                (21, 191), (21, 164), (25, 162), (26, 148), (27, 134), (28, 123)], fill=255)
sp = statue.load()
def painted(x, y):
    p = px[x, y]
    if not (0 <= x < W and 0 <= y < H) or p[3] < 255 or sp[x, y]: return False
    h, l, s = hls(p); return s < 0.25 and l > 0.22
HAND = ["#.#.#..",           # 4 spread fingers + palm + thumb, 7x8, upright
        "#.#.#.#",
        "#.#.#.#",
        "######.",
        "#######",
        "######.",
        ".####..",
        ".###..."]
THUMB = [(6, 4)]
def stamp(cx, cy, flip=False, tilt=0, smear=0, dark=0.8):
    pts = []
    for j, row in enumerate(HAND):
        for i, ch in enumerate(row):
            if ch == "#": pts.append((i, j))
    pts += THUMB
    for (i, j) in pts:
        if flip: i = 6 - i
        x = cx + i + round(tilt * (j - 3)); y = cy + j
        if painted(x, y):
            p = px[x, y]; k = dark * (0.85 + 0.3 * random.random())
            mud = (48, 36, 28)
            px[x, y] = tuple(int(p[c] * (1 - k) + mud[c] * k) for c in range(3)) + (255,)
    for s in range(smear):                         # a drag mark sliding down from the palm
        x = cx + 2 + (1 if flip else 0); y = cy + 7 + s
        for dx in (0, 1):
            if painted(x + dx, y):
                p = px[x + dx, y]; k = dark * 0.55 * (1 - s / (smear + 1))
                px[x + dx, y] = tuple(int(p[c] * (1 - k) + (62, 48, 36)[c] * k) for c in range(3)) + (255,)
prints = [(3, 140, 0, .3, 4), (21, 146, 1, -.2, 0), (46, 141, 0, .4, 6), (60, 136, 1, 0, 0), (76, 146, 0, -.3, 3),
          (88, 138, 1, .2, 0), (99, 140, 0, -.25, 5), (109, 146, 1, .3, 0), (142, 134, 0, .2, 0), (151, 141, 1, -.3, 4),
          (156, 128, 0, 0, 0), (84, 150, 0, .5, 0)]
for (x, y, f, t, sm) in prints: stamp(x, y, bool(f), t, sm, dark=0.82 + 0.15 * random.random())

# 3. boards: every window different (count, angles, spacing, thickness, tone)
TONES = [[(134, 106, 78), (112, 88, 64), (92, 72, 52)], [(122, 102, 80), (100, 82, 62), (80, 64, 48)],
         [(140, 112, 82), (118, 92, 66), (96, 74, 54)], [(116, 96, 74), (96, 78, 58), (76, 60, 44)]]
OUTL = (38, 30, 24, 255)
def board(xa, ya, xb, yb, thick=3, tone=0, nails=2, broken=False):
    pal = TONES[tone % len(TONES)]
    pts = {}
    n = max(abs(xb - xa), abs(yb - ya), 1)
    for s in range(n + 1):
        x = round(xa + (xb - xa) * s / n); y = round(ya + (yb - ya) * s / n)
        for j in range(thick):
            pts[(x, y + j)] = pal[0] if j == 0 else (pal[2] if j == thick - 1 else pal[1])
    if broken:                                     # splintered end: drop a few pixels at the far end
        for j in range(thick):
            if j % 2: pts.pop((xb, yb + j), None)
    ring = {(x + dx, y + dy) for (x, y) in pts for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - set(pts)
    for q in ring:
        if 0 <= q[0] < W and 0 <= q[1] < H and px[q][3]: px[q] = OUTL
    for (x, y), c in pts.items():
        if 0 <= x < W and 0 <= y < H:
            if (x * 5 + y * 3) % 11 == 0: c = pal[2]
            px[x, y] = c + (255,)
    for k in range(nails):
        s = 1 if k == 0 else n - 1
        x = round(xa + (xb - xa) * s / n); y = round(ya + (yb - ya) * s / n) + thick // 2
        if 0 <= x < W and 0 <= y < H: px[x, y] = (36, 36, 40, 255)
# far-left side window: two boards, one steep diagonal, one low and nearly level
board(0, 116, 18, 140, 3, 1); board(0, 149, 19, 147, 4, 2, nails=1)
# side window: an X plus a single short board high up, uneven thickness
board(47, 120, 75, 152, 3, 0); board(48, 150, 74, 122, 2, 3, broken=True); board(52, 116, 70, 118, 3, 2, nails=1)
# front left lancet: two boards tilted opposite ways, wide gap between them
board(96, 126, 115, 121, 3, 2); board(97, 150, 114, 155, 4, 1, broken=True)
# front right lancet: one long diagonal and two short boards bunched near the bottom
board(144, 110, 161, 128, 3, 3); board(145, 138, 161, 134, 2, 0, nails=1); board(146, 145, 160, 144, 3, 1)

im.save("base_075_v4.png")
bg = Image.new("RGBA", im.size, (60, 56, 80, 255)); bg.alpha_composite(im)
bg.resize((W * 4, H * 4), Image.NEAREST).save("/tmp/d75v4z.png")

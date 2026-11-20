"""50% v4: the lantern post was knocked over toward the church; the lantern broke on the threshold, shoved the door
open, and started the fire. Removes the standing post + lantern + its glow, lays the post across the steps, puts the
broken lantern at the door gap with flames licking up the door, scorch above."""
import math, random
from PIL import Image
random.seed(9)
im = Image.open("base_050_v3.png").convert("RGBA"); px = im.load(); W, H = im.size
src = im.copy().load()
def lum(p): return .3 * p[0] + .59 * p[1] + .11 * p[2]
G = {}
def noise(x, y, s, salt=0):
    gx, gy = x / s, y / s; x0, y0 = math.floor(gx), math.floor(gy); fx, fy = gx - x0, gy - y0
    def r(i, j):
        k = (i, j, s, salt)
        if k not in G: G[k] = random.random()
        return G[k]
    a = r(x0, y0) * (1 - fx) + r(x0 + 1, y0) * fx; c = r(x0, y0 + 1) * (1 - fx) + r(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + c * fy

# 1. lift the lantern sprite (before erasing), then erase lantern, arm, glow and the post
lantern = {(x, y): src[x, y] for y in range(134, 148) for x in range(163, 173) if src[x, y][3] == 255}
for y in range(120, 158):
    for x in range(163, 180): px[x, y] = (0, 0, 0, 0)
for y in range(156, 192):                     # post through the sandbags: patch with the bags beside it
    for x in (170, 171):
        a, b = src[x - 2, y], src[x + 2, y]
        px[x, y] = (a if x == 170 else b) if (a[3] or b[3]) else (0, 0, 0, 0)
# the lantern's warm spill on the corner sandbags fades (the light is gone from there)
for y in range(150, 176):
    for x in range(148, 184):
        p = px[x, y]
        if p[3] == 255 and p[0] > 190 and p[1] > 140:
            px[x, y] = (int(p[0] * .66), int(p[1] * .64), int(p[2] * .7), 255)

# 2. the fallen post: base still at its spot, lying across the bottom step toward the door
IRON, IRONL, OUT = (26, 26, 32, 255), (80, 82, 92, 255), (16, 16, 20, 255)
x0, y0, x1, y1 = 172, 191, 140, 175
n = max(abs(x1 - x0), abs(y1 - y0))
for s in range(n + 1):
    x = round(x0 + (x1 - x0) * s / n); y = round(y0 + (y1 - y0) * s / n)
    px[x, y - 1] = IRONL; px[x, y] = IRON; px[x, y + 1] = OUT
for (x, y) in [(171, 191), (172, 192), (173, 192), (174, 191)]: px[x, y] = IRON      # bent base plate

# 4. flames from the spilled oil: along the threshold and licking up the door edge into the gap
FL = [(255, 238, 170), (255, 196, 92), (246, 132, 44), (186, 66, 28)]
for y in range(150, 175):
    for x in range(122, 146):
        if px[x, y][3] < 255: continue
        h = (174 - y) / 22                                  # 0 at the floor .. 1 high
        cx = 134 - 3 * h                               # flames lean in through the gap
        reach = 1 - abs(x - cx) / (9 - 4 * h)
        tongue = 0.5 * (noise(x * 1.7, 0, 1.4, 93) - .5) * h
        f = reach - h * 1.1 + tongue + 0.4 * (noise(x, y, 2.2, 90) - .5) + 0.25 * (noise(x * 2, y, 3, 91) - .5)
        if f > 0.55: c = FL[0]
        elif f > 0.38: c = FL[1]
        elif f > 0.22: c = FL[2]
        elif f > 0.10: c = FL[3]
        else: continue
        px[x, y] = c + (255,)
# 3. the lantern lying on its side at the end of the post, frame bent, glass smashed, flame inside
L = ["..##....",
     ".#..#...",
     "########",
     "#yoyyo.#",
     "#oyFyoo#",
     "#.oyo..#",
     "########"]
CL = {"#": (24, 24, 30), "y": (255, 214, 120), "o": (246, 140, 50), "F": (255, 244, 200), ".": (60, 40, 30)}
LX, LY = 137, 168
for j, row in enumerate(L):
    for i, ch in enumerate(row):
        if ch in CL: px[LX + i, LY + j] = CL[ch] + (255,)
px[(LX + 7, LY + 3)] = (0, 0, 0, 0) if px[(LX + 7, LY + 3)][3] == 0 else px[(LX + 7, LY + 3)]
# 5. scorch climbing the door above the flames (dark, soft)
for y in range(128, 158):
    for x in range(118, 142):
        p = px[x, y]
        if p[3] < 255 or (p[0] > 200 and p[1] > 120): continue
        k = max(0.0, 1 - math.hypot((x - 133) / 8, (y - 156) / 26)) * 0.6 * (0.6 + 0.4 * noise(x, y, 3, 92))
        if k > 0.02: px[x, y] = tuple(int(p[c] * (1 - k) + 20 * k) for c in range(3)) + (255,)
im.save("base_050_v4.png")
bg = Image.new("RGBA", im.size, (24, 26, 40, 255)); bg.alpha_composite(im)
bg.crop((100, 100, 184, 200)).resize((84 * 6, 100 * 6), Image.NEAREST).save("/tmp/lf.png")

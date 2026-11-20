"""75% v5 (code on top of v4): sagging roof around the missing shingles, extra boards (each different), more mud
under the middle side window, handprints on the statue's lower half and on the far-left window's low board."""
import math, random, colorsys
from PIL import Image
random.seed(31)
im = Image.open("base_075_v4.png").convert("RGBA"); px = im.load(); W, H = im.size
src = im.copy().load()

# 1. sunken roof: rows bend down toward a centre and darken (it will become the 50% hole)
CX, CY, RX, RY, DEPTH = 64, 75, 18, 10, 4.2
for y in range(CY - RY - 4, CY + RY + 5):
    for x in range(CX - RX, CX + RX + 1):
        r2 = ((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2
        if r2 >= 1 or src[x, y][3] < 255: continue
        k = (1 - r2)
        sy = y - round(DEPTH * k)                         # rows sag: sample from above
        p = src[x, sy] if src[x, sy][3] == 255 else src[x, y]
        f = 1 - 0.5 * k ** 1.1                           # deeper = darker
        px[x, y] = (int(p[0] * f), int(p[1] * f), int(p[2] * f * 1.02), 255)
# a soft shadow lip along the upper rim of the dip
for x in range(CX - RX + 3, CX + RX - 2):
    t = (x - CX) / RX; y = round(CY - RY * math.sqrt(max(0, 1 - t * t)) * 0.55)
    p = px[x, y]; px[x, y] = (int(p[0] * .7), int(p[1] * .7), int(p[2] * .75), 255)

# 2. extra boards, each unlike the others (thickness / angle / direction / tone / nails)
TONES = [[(134, 106, 78), (112, 88, 64), (92, 72, 52)], [(122, 102, 80), (100, 82, 62), (80, 64, 48)],
         [(140, 112, 82), (118, 92, 66), (96, 74, 54)], [(116, 96, 74), (96, 78, 58), (76, 60, 44)],
         [(128, 98, 70), (104, 80, 58), (84, 64, 46)]]
OUTL = (38, 30, 24, 255)
def board(xa, ya, xb, yb, thick=3, tone=0, nails=2):
    pal = TONES[tone % len(TONES)]; pts = {}
    n = max(abs(xb - xa), abs(yb - ya), 1); steep = abs(yb - ya) > abs(xb - xa)
    for s in range(n + 1):
        x = round(xa + (xb - xa) * s / n); y = round(ya + (yb - ya) * s / n)
        for j in range(thick):
            q = (x + j, y) if steep else (x, y + j)
            pts[q] = pal[0] if j == 0 else (pal[2] if j == thick - 1 else pal[1])
    ring = {(x + dx, y + dy) for (x, y) in pts for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - set(pts)
    for q in ring:
        if 0 <= q[0] < W and 0 <= q[1] < H and px[q][3]: px[q] = OUTL
    for (x, y), c in pts.items():
        if 0 <= x < W and 0 <= y < H:
            if (x * 5 + y * 3) % 11 == 0: c = pal[2]
            px[x, y] = c + (255,)
    for k in range(nails):
        s = 1 if k == 0 else n - 1
        x = round(xa + (xb - xa) * s / n); y = round(ya + (yb - ya) * s / n)
        x, y = (x + thick // 2, y) if steep else (x, y + thick // 2)
        if 0 <= x < W and 0 <= y < H: px[x, y] = (36, 36, 40, 255)
board(98, 139, 112, 134, 2, 4, nails=1)          # front-left lancet: a thin board in the wide gap, steeper tilt
board(45, 157, 76, 155, 4, 2, nails=2)            # middle side window: a heavy, nearly level board across the bottom
board(14, 112, 16, 146, 3, 3, nails=2)            # far-left window: one board nailed upright, unlike any other

# 3. more mud splatter under the middle side window (dots of 1-2 px, denser near the bottom, a few drips)
def painted(x, y):
    p = px[x, y]
    if p[3] < 255: return False
    h, l, s = colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255); return s < 0.25 and l > 0.2
MUDS = [(58, 46, 36), (48, 38, 30), (70, 56, 42)]
for _ in range(110):
    x = random.randint(42, 80); y = 172 - int(random.random() ** 1.8 * 14)
    c = random.choice(MUDS); size = 2 if random.random() < .25 else 1
    for dx in range(size):
        for dy in range(size):
            if painted(x + dx, y + dy): px[x + dx, y + dy] = c + (255,)
for dx in (50, 57, 63, 71):                         # drips running down from the sill
    for i in range(random.randint(3, 7)):
        y = 163 + i
        if painted(dx, y): p = px[dx, y]; k = .6 * (1 - i / 8); px[dx, y] = tuple(int(p[c] * (1 - k) + MUDS[0][c] * k) for c in range(3)) + (255,)

# 4. handprints: on the statue's lower half and on the far-left window's low board
HAND = ["#.#.#..", "#.#.#.#", "#.#.#.#", "######.", "#######", "######.", ".####..", ".###..."]
def stamp(cx, cy, flip=False, tilt=0.0, dark=0.85, rect=None, mud=(48, 36, 28)):
    for j, row in enumerate(HAND):
        for i, ch in enumerate(row):
            if ch != "#": continue
            ii = 6 - i if flip else i
            x = cx + ii + round(tilt * (j - 3)); y = cy + j
            if not (0 <= x < W and 0 <= y < H) or px[x, y][3] < 255: continue
            if rect and not (rect[0] <= x <= rect[2] and rect[1] <= y <= rect[3]): continue
            p = px[x, y]; k = min(1, dark * (0.9 + 0.2 * random.random()))
            px[x, y] = tuple(int(p[c] * (1 - k) + mud[c] * k) for c in range(3)) + (255,)
stamp(31, 150, flip=True, tilt=0.2, dark=0.95, rect=(26, 140, 44, 162), mud=(44, 33, 26))      # statue robe, lower half
stamp(4, 143, flip=False, tilt=-0.15, dark=0.95, rect=(0, 142, 19, 153), mud=(30, 22, 18))     # the low board on the far-left window

im.save("base_075_v5.png")
bg = Image.new("RGBA", im.size, (60, 56, 80, 255)); bg.alpha_composite(im)
bg.resize((W * 4, H * 4), Image.NEAREST).save("/tmp/d75v5z.png")

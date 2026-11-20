"""Damage state 25% (the fire has taken hold), on top of the approved unlit 50% picture."""
import math, random, colorsys
from PIL import Image
random.seed(25)
B = Image.open("base_050_touched_fixed.png").convert("RGBA"); src = B.load()
O75 = Image.open("base_075_final.png").convert("RGBA").load()
im = B.copy(); px = im.load(); W, H = im.size
def lum(p): return .3 * p[0] + .59 * p[1] + .11 * p[2]
def hls(p): return colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)
G = {}
def noise(x, y, s, salt=0):
    gx, gy = x / s, y / s; x0, y0 = math.floor(gx), math.floor(gy); fx, fy = gx - x0, gy - y0
    def r(i, j):
        k = (i, j, s, salt)
        if k not in G: G[k] = random.Random(hash(k)).random()
        return G[k]
    a = r(x0, y0) * (1 - fx) + r(x0 + 1, y0) * fx; c = r(x0, y0 + 1) * (1 - fx) + r(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + c * fy
FL = [(255, 240, 180), (255, 200, 96), (248, 140, 48), (196, 72, 30), (120, 40, 24)]
FLAME = set()
SOURCES = []
def flames(cx, by, height, half, salt, lean=0.0, only_open=False):
    """flame tongues rising from (cx, by): jagged top edge, hot core at the base."""
    for y in range(by - height, by + 2):
        t = max(0.0, min(1.0, (by - y) / height))                  # 0 base .. 1 tips
        w = half * (1 - t ** 0.9) + 0.6
        c0 = cx + lean * (by - y)
        for x in range(int(c0 - half - 2), int(c0 + half + 3)):
            if not (0 <= x < W and 0 <= y < H): continue
            if only_open and px[x, y][3] == 255 and lum(px[x, y]) > 45: continue   # stay behind things (the bell)
            d = abs(x - c0) / max(w, .4)
            tongue = noise(x * 1.2, y * .25, 1.6, salt) * .8 + noise(x, y, 2.4, salt + 1) * .5
            v = (1 - d * d) * 1.05 - t * 1.0 + (tongue - .6) * 1.1
            if v <= 0: continue
            c = FL[0] if v > .85 else FL[1] if v > .6 else FL[2] if v > .35 else FL[3] if v > .15 else FL[4]
            px[x, y] = c + (255,); FLAME.add((x, y))
    SOURCES.append((cx, by - height * .35, height))

def cluster(cx, by, height, width, salt, lean=0.08, n=4, only_open=False):
    rnd = random.Random(salt)
    for i in range(n):
        ox = (i - (n - 1) / 2) * width / max(1, n - 1) + rnd.uniform(-1, 1)
        h = height * rnd.uniform(.45, 1.0)
        flames(cx + ox, by + rnd.randint(-1, 1), max(4, int(h)), width / n + 1.6, salt * 10 + i, lean + rnd.uniform(-.06, .06), only_open)

# ---------- 1. the cross has fallen: wall where it hung (clean ghost shape fully visible), cross on the sandbags
orig_cross = set()
for y in range(62, 100):
    for x in range(118, 142):
        p = O75[x, y]
        if p[3] == 255 and p[0] > p[2] + 25 and hls(p)[2] > 0.22: orig_cross.add((x, y))
orig_cross |= {(x + dx, y + dy) for (x, y) in orig_cross for dx in (-1, 0, 1) for dy in (-1, 0, 1) if lum(O75[x + dx, y + dy]) < 60}
SL, PITCH = 0.2, 7
wall = [(x, y) for y in range(58, 112) for x in range(98, 160)
        if src[x, y][3] == 255 and not (114 <= x <= 146 and 60 <= y <= 102) and hls(src[x, y])[2] < 0.25 and lum(src[x, y]) > 50]
bucket = {}
for (x, y) in wall: bucket.setdefault(round(y + SL * x) % PITCH, []).append((x, y))
CLEAN = (182, 180, 172)
for y in range(60, 102):
    for x in range(114, 147):
        p = src[x, y]
        if p[3] < 255: continue
        hanging = p[0] > p[2] + 25 and hls(p)[2] > 0.22 or (lum(p) < 55 and (x, y) not in orig_cross and
                  any(src[x + dx, y + dy][0] > src[x + dx, y + dy][2] + 25 for dx in (-1, 0, 1) for dy in (-1, 0, 1)))
        if hanging or (x, y) in orig_cross:
            ph = round(y + SL * x) % PITCH
            sx, sy = min(bucket[ph], key=lambda s: (s[0] - x) ** 2 + 2.5 * (s[1] - y) ** 2)
            q = src[sx, sy]
            px[x, y] = tuple(int(q[c] * .2 + CLEAN[c] * .8) for c in range(3)) + (255,) if (x, y) in orig_cross else q
for q in {(x + dx, y + dy) for (x, y) in orig_cross for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - orig_cross:
    p = px[q]; px[q] = (int(p[0] * .78), int(p[1] * .78), int(p[2] * .8), 255)
xs = [x for x, _ in orig_cross]; ys = [y for _, y in orig_cross]
for q in [(129, min(ys) + 2), (min(xs) + 2, 75), (max(xs) - 2, 75), (129, max(ys) - 2)]: px[q] = (40, 34, 34, 255)
# the fallen cross: lying across the front-left sandbags, nearly flat, one arm end charred
spr = {(x, y): O75[x, y] for (x, y) in orig_cross}
cx0, cy0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
ANG = math.radians(-78); ca, sa = math.cos(ANG), math.sin(ANG)
TX, TY = 146, 184
placed = {}
for y in range(TY - 20, TY + 20):
    for x in range(TX - 24, TX + 24):
        dx, dy = x - TX, y - TY
        sx = round(cx0 + dx * ca + dy * sa); sy = round(cy0 - dx * sa + dy * ca)
        if (sx, sy) in spr and 0 <= x < W and 0 <= y < H: placed[(x, y)] = spr[(sx, sy)]
for (x, y), p in placed.items():
    if x < TX - 7:                                                   # the end toward the doorway: charred
        k = .55; p = (int(p[0] * k), int(p[1] * k * .9), int(p[2] * k * .9), 255)
        if random.random() < .12: p = (255, 120, 40, 255)
    px[x, y] = p
for (x, y) in placed:                                                # a soft shadow under it on the steps
    q = (x + 1, y + 1)
    if q not in placed and 0 <= q[0] < W and q[1] < H and px[q][3] == 255:
        r_ = px[q]; px[q] = (int(r_[0] * .7), int(r_[1] * .7), int(r_[2] * .7), 255)

cxs = [x for x, _ in placed]; cys = [y for _, y in placed]
CROSS_FIRE = (min(cxs) + 2, max(cys))
# ---------- 2. heavy scorch above every opening (windows + door)
OPENINGS = [(8, 106, 9), (60, 110, 13), (105, 114, 7), (153, 104, 7), (129, 101, 11)]   # (centre x, top y, half width)
for (cx, ty, hw) in OPENINGS:
    for y in range(ty - 34, ty + 4):
        t = (ty + 4 - y) / 38                                        # 0 at the opening .. 1 high
        spread = hw * (0.8 + 0.9 * t)
        for x in range(int(cx - spread - 2), int(cx + spread + 3)):
            if not (0 <= x < W and 0 <= y < H) or px[x, y][3] < 255: continue
            p = px[x, y]
            if hls(p)[2] > .35 and lum(p) > 120: continue           # lit glass / flames stay
            d = abs(x - cx) / max(spread, 1)
            k = max(0.0, (1 - t) ** 1.1 * (1 - d * d)) * (0.55 + 0.45 * noise(x, y, 3, 40 + cx))
            k = min(.9, k * 1.15)
            if k > .02: px[x, y] = tuple(int(p[c] * (1 - k) + 14 * k) for c in range(3)) + (255,)

# ---------- 3. char every board near the fire (blackened wood, a few embers)
WOODISH = lambda p: p[3] == 255 and p[0] > p[2] + 18 and 0.12 < hls(p)[1] < 0.6 and hls(p)[2] < 0.5
for y in range(100, 170):
    for x in range(0, 165):
        p = px[x, y]
        if not WOODISH(p): continue
        near = min(math.hypot(x - ox, y - (oy + 22)) for (ox, oy, _) in OPENINGS)
        k = max(0.0, 1 - near / 34) * 0.7
        if k <= 0.05: continue
        n = noise(x, y, 2, 41)
        p2 = (int(p[0] * (1 - k)), int(p[1] * (1 - k * 1.05)), int(p[2] * (1 - k * 1.05)), 255)
        if k > .35 and n > .82: p2 = (255, 128, 44, 255) if n > .9 else (190, 70, 30, 255)   # embers in the char
        px[x, y] = p2

# ---------- 3b. both door leaves swung in; the doorway is full of fire
LEFT = (119, 103, 129, 171)
leafL = {(x, y): src[x, y] for y in range(LEFT[1], LEFT[3] + 1) for x in range(LEFT[0], LEFT[2] + 1)}
for y in range(LEFT[1], LEFT[3] + 1):
    for x in range(LEFT[0], LEFT[0] + 5):                         # squeezed toward its hinge on the left, darker
        sx = LEFT[0] + round((x - LEFT[0]) * (LEFT[2] - LEFT[0]) / 4)
        p = leafL[(sx, y)]
        if p[3] == 255: px[x, y] = (int(p[0] * .6), int(p[1] * .58), int(p[2] * .6), 255)
    if px[LEFT[0] + 5, y][3] == 255: px[LEFT[0] + 5, y] = (150, 80, 40, 255)   # its edge, lit by the fire
    for x in range(LEFT[0] + 6, 134):                              # the doorway: fire inside the church
        if src[x, y][3] < 255: continue
        t = (y - LEFT[1]) / (LEFT[3] - LEFT[1])
        v = t * 1.25 + 0.55 * (noise(x * 1.5, y, 2.2, 95) - .5) + 0.3 * (noise(x, y, 4, 96) - .5)
        c = FL[0] if v > 1.0 else FL[1] if v > .8 else FL[2] if v > .55 else FL[3] if v > .35 else (60, 22, 16)
        px[x, y] = c + (255,); FLAME.add((x, y))
SOURCES.append((128, 150, 40))
# ---------- 4. flames: out of each window's top hole, climbing the door, bursting through the roof
for (hx, hy, h, wd, s, lean) in [(6, 114, 22, 9, 51, -.05), (56, 133, 26, 14, 52, -.05), (106, 121, 18, 7, 53, .05), (154, 117, 18, 7, 54, .05)]:
    cluster(hx, hy + 2, h, wd, s, lean, n=3)                           # fire pouring out of every window
cluster(128, 172, 50, 18, 60, 0.0, n=5)                            # the doorway: big fire pouring out and up


# ---------- 5. roof: the hole widens and caves; charred rim; fire breaks through
CX, CY = 63, 76
hole = set()
for y in range(CY - 11, CY + 12):
    for x in range(CX - 20, CX + 21):
        ang = math.atan2(y - CY, x - CX)
        rx = 15 * (0.78 + 0.35 * noise(ang * 3 + 9, 0, 1, 70)); ry = 7 * (0.78 + 0.35 * noise(ang * 3 + 9, 0, 1, 71))
        if ((x - CX) / rx) ** 2 + ((y - CY) / ry) ** 2 <= 1 and src[x, y][3] == 255: hole.add((x, y))
old = im.copy().load()
for y in range(CY - 18, CY + 18):                                    # cave: shingles around the hole slump toward it
    for x in range(CX - 28, CX + 29):
        if (x, y) in hole or old[x, y][3] < 255: continue
        r2 = ((x - CX) / 26) ** 2 + ((y - CY) / 15) ** 2
        if r2 >= 1: continue
        k = 1 - r2; sy = y - round(3 * k)
        p = old[x, sy] if old[x, sy][3] == 255 else old[x, y]
        f = 1 - 0.55 * k
        px[x, y] = (int(p[0] * f), int(p[1] * f), int(p[2] * f), 255)
for (x, y) in hole:
    depth = (y - (CY - 7)) / 14; n = noise(x, y, 2, 72)
    c = (255, 190, 90) if depth > .5 and n > .5 else (226, 100, 40) if depth > .3 and n > .4 else (90, 30, 20) if n > .5 else (16, 10, 10)
    px[x, y] = c + (255,)
for q in {(x + dx, y + dy) for (x, y) in hole for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - hole:
    if px[q][3] == 255:
        px[q] = (20, 16, 16, 255) if random.random() < .75 else (230, 110, 40, 255)          # charred, glowing edge
for (x0, y0, x1, y1) in ((CX - 14, CY - 2, CX - 3, CY + 3), (CX + 4, CY - 4, CX + 13, CY + 1), (CX - 6, CY + 4, CX + 6, CY + 2)):
    n_ = max(abs(x1 - x0), abs(y1 - y0))                             # charred rafters across the hole
    for s in range(n_ + 1):
        x = round(x0 + (x1 - x0) * s / n_); y = round(y0 + (y1 - y0) * s / n_)
        px[x, y] = (44, 30, 22, 255); px[x, y + 1] = (22, 14, 12, 255)
cluster(CX + 2, CY + 2, 40, 30, 80, .1, n=6)                         # the roof hole: a wall of fire
for (fx, fy, h, wd, salt) in [(20, 94, 20, 12, 83), (88, 66, 18, 10, 85), (8, 104, 14, 8, 86)]:
    cluster(fx, fy, h, wd, salt, .08, n=3)                            # the roof is catching in patches

# ---------- 6. the belfry leans forward (toward the front / right), more railing gone
old = im.copy().load()
for y in range(0, 50):
    sh = round(7 * (50 - y) / 50)
    if sh == 0: continue
    for x in range(W - 1, 69, -1):
        if 70 <= x - sh and x <= 150:
            px[x, y] = old[x - sh, y]
    for x in range(70, 70 + sh):
        if old[x, y][3] and y < 46: px[x, y] = (0, 0, 0, 0)
for y in range(40, 49):
    for x in range(98, 104):
        if px[x, y][3] and lum(px[x, y]) > 120: px[x, y] = (0, 0, 0, 0)

cluster(CROSS_FIRE[0], CROSS_FIRE[1], 9, 5, 92, 0, n=2)          # the fallen cross catching fire
# belfry: flames rising from the hole in its floor, around and behind the bell
cluster(107, 47, 22, 14, 90, .1, n=4, only_open=True)
# the flag burns: its trailing half becomes fire and char
for y in range(54, 80):
    for x in range(164, 184):
        p = px[x, y]
        if p[3] == 255 and p[0] > p[2] + 30:
            if x > 172 or noise(x, y, 2, 97) > .6:
                c = FL[1] if noise(x, y, 1.5, 98) > .6 else FL[2] if x < 178 else FL[3]
                px[x, y] = c + (255,); FLAME.add((x, y))
            elif x > 168: px[x, y] = (40, 24, 20, 255)
flames(176, 64, 12, 3, 99, .2)
# the statue: heavy soot, darkest at the top
for y in range(112, 194):
    for x in range(18, 50):
        p = px[x, y]
        if p[3] < 255 or (x, y) in FLAME: continue
        inside = 26 <= x <= 46 and (y > 160 or 28 <= x <= 44)
        if not inside: continue
        k = 0.65 - 0.3 * (y - 112) / 82 + 0.15 * (noise(x, y, 2.5, 100) - .5)
        px[x, y] = tuple(int(p[c] * (1 - k) + 16 * k) for c in range(3)) + (255,)
im.save("base_025_unlit.png")
# ---------- dramatic light: everything drops into dark char, then the flames light it hard (screen blend)
dark = im.copy(); dp = dark.load()
for y in range(H):
    for x in range(W):
        p = dp[x, y]
        if p[3] == 0 or (x, y) in FLAME: continue
        L = lum(p)
        dp[x, y] = (int((p[0] * .7 + L * .3) * .36), int((p[1] * .7 + L * .3) * .35), int((p[2] * .7 + L * .3) * .42), p[3])
lit = dark.copy(); lp = lit.load()
for y in range(H):
    for x in range(W):
        p = dp[x, y]
        if p[3] == 0 or (x, y) in FLAME: continue
        k = 0.0
        for (sx, sy, h) in SOURCES:
            R = 10 + h * 1.05
            d = math.hypot(x - sx, (y - sy) * 1.15)
            if d < R: k = max(k, (1 - d / R) ** 2.0 * (0.45 + h / 110))
        k = min(0.8, k)
        if k <= 0.01: continue
        L = (235 * k, 120 * k, 40 * k)
        r = 255 - (255 - p[0]) * (255 - L[0] * .9) / 255
        g = 255 - (255 - p[1]) * (255 - L[1] * .8) / 255
        b = p[2] * (1 - .3 * min(1, k))
        lp[x, y] = (min(255, int(r)), min(255, int(g)), max(0, int(b)), p[3])
dark.save("base_025_dark_unlit.png"); lit.save("base_025_v2.png")
im = lit; px = lit.load()
bg = Image.new("RGBA", im.size, (24, 26, 40, 255)); bg.alpha_composite(im)
bg.resize((W * 4, H * 4), Image.NEAREST).save("/tmp/d25z2.png")

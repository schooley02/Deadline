"""Damage state 50% (a small fire has started inside), drawn on top of the approved 75% picture:
roof sag broken open with firelight + smoke; each window's highest broken pane trickles smoke (lower holes keep
their light beams); soot above the smoking panes; warmer firelit glass; crooked cross; door brace; torn flag."""
import math, random, colorsys
from PIL import Image
random.seed(50)
B = Image.open("base_075_final.png").convert("RGBA")
V6 = Image.open("base_075_v6.png").convert("RGBA").load(); V7 = Image.open("base_075_v7.png").convert("RGBA").load()
im = B.copy(); px = im.load(); src = B.load(); W, H = im.size
def lum(p): return .3 * p[0] + .59 * p[1] + .11 * p[2]
def hls(p): return colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)
G = {}
def noise(x, y, s, salt=0):
    gx, gy = x / s, y / s; x0, y0 = math.floor(gx), math.floor(gy); fx, fy = gx - x0, gy - y0
    def r(i, j):
        k = (i, j, s, salt)
        if k not in G: G[k] = random.random()
        return G[k]
    a = r(x0, y0) * (1 - fx) + r(x0 + 1, y0) * fx; c = r(x0, y0 + 1) * (1 - fx) + r(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + c * fy

# ---------- 1. crooked cross: lift it, fill its spot with siding, put it back rotated about its top nail
CR = (119, 64, 140, 99)
wood = set()
for y in range(CR[1], CR[3]):
    for x in range(CR[0], CR[2]):
        p = src[x, y]
        if p[3] == 255 and p[0] > p[2] + 25 and hls(p)[2] > 0.22: wood.add((x, y))
ring = {(x + dx, y + dy) for (x, y) in wood for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
cross = {q: src[q] for q in ring if q in wood or lum(src[q]) < 60}
shadow = {(x - 1, y + 1) for (x, y) in cross} - set(cross)
SL, PITCH = 0.2, 7
wall = [(x, y) for y in range(60, 112) for x in range(98, 160)
        if src[x, y][3] == 255 and (x, y) not in cross and (x, y) not in shadow and not (CR[0] - 2 <= x <= CR[2] + 2 and CR[1] <= y <= CR[3])
        and hls(src[x, y])[2] < 0.25 and lum(src[x, y]) > 50]
bucket = {}
for (x, y) in wall: bucket.setdefault(round(y + SL * x) % PITCH, []).append((x, y))
for q in set(cross) | shadow:
    x, y = q; ph = round(y + SL * x) % PITCH
    sx, sy = min(bucket[ph], key=lambda s: (s[0] - x) ** 2 + 2.5 * (s[1] - y) ** 2)
    px[x, y] = src[sx, sy]
# ghost: the siding that was covered stays cleaner than the grimy wall around it
CLEAN = (182, 180, 172)                            # unweathered paint that the cross kept covered
for (x, y) in cross:
    p = px[x, y]
    px[x, y] = tuple(int(p[c] * .2 + CLEAN[c] * .8) for c in range(3)) + (255,)
wx0 = min(x for x, _ in wood); wx1 = max(x for x, _ in wood); wy0 = min(y for _, y in wood); wy1 = max(y for _, y in wood)
ucx = round(sum(x for x, y in wood if y > wy1 - 4) / max(1, sum(1 for x, y in wood if y > wy1 - 4)))
armY = round(sum(y for x, y in wood if x == wx0) / max(1, sum(1 for x, y in wood if x == wx0)))
ghost_ring = {(x + dx, y + dy) for (x, y) in cross for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - set(cross)
for q in ghost_ring:                                 # grime line around the clean shape -> crisp silhouette
    p = px[q]; px[q] = (int(p[0] * .78), int(p[1] * .78), int(p[2] * .8), 255)
for q in [(ucx, wy0 + 1), (wx0 + 1, armY), (wx1 - 1, armY)]:   # empty nail holes where it used to be fixed
    px[q] = (40, 34, 34, 255)
PIV, ANG = (ucx, wy1 - 1), math.radians(38)       # only the bottom nail holds; the top is sliding off to the right
ca, sa = math.cos(ANG), math.sin(ANG)
xs = [x for x, _ in cross]; ys = [y for _, y in cross]
placed = {}
for y in range(min(ys) - 6, max(ys) + 6):
    for x in range(min(xs) - 10, max(xs) + 10):
        dx, dy = x - PIV[0], y - PIV[1]
        sx = round(PIV[0] + dx * ca + dy * sa); sy = round(PIV[1] - dx * sa + dy * ca)
        if (sx, sy) in cross: placed[(x, y)] = cross[(sx, sy)]
for (x, y) in placed:
    q = (x - 1, y + 1)
    if q not in placed and px[q][3] == 255: p = px[q]; px[q] = (int(p[0] * .72), int(p[1] * .72), int(p[2] * .78), 255)
for q, c in placed.items(): px[q] = c
px[PIV] = (40, 40, 44, 255); px[(PIV[0] + 1, PIV[1])] = (120, 120, 126, 255)   # the last nail, still holding

# ---------- 2. warmer, firelit glass in every window (bright warm glass shifts toward orange)
for y in range(100, 170):
    for x in range(0, 165):
        p = px[x, y]
        if p[3] == 255 and p[0] > 170 and p[0] > p[2] + 60 and lum(p) > 120:
            px[x, y] = (min(255, p[0] + 6), int(p[1] * 0.86), int(p[2] * 0.7), 255)

# ---------- 3. second (higher) broken pane in each front window (they only had one)
def is_glass(x, y):
    p = px[x, y]
    if p[3] < 255: return False
    h, l, s = hls(p)
    woodish = p[0] > p[2] + 20 and 0.25 < l < 0.6 and s < 0.45
    return s > 0.3 and 0.12 < l < 0.85 and not woodish
def best_glass(r):
    c = [(x, y) for y in range(r[1], r[3]) for x in range(r[0], r[2])
         if all(is_glass(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1))]
    return min(c, key=lambda q: q[1]) if c else None
FIRE_LIGHT = [(255, 228, 170), (255, 186, 104), (232, 132, 60)]
def hole(cx, cy, r=2.0):
    inside = set()
    for y in range(cy - 4, cy + 5):
        for x in range(cx - 4, cx + 5):
            ang = math.atan2(y - cy, x - cx); rr = r * (0.7 + 0.6 * abs(math.sin(ang * 2.5 + cx)))
            d = math.hypot(x - cx, y - cy)
            if (d <= rr and is_glass(x, y)) or d <= .8:
                inside.add((x, y)); t = d / max(rr, .1)
                px[x, y] = (FIRE_LIGHT[0] if t < .4 else FIRE_LIGHT[1] if t < .8 else FIRE_LIGHT[2]) + (255,)
    for (x, y) in list(inside):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in inside and is_glass(*q): px[q] = (22, 18, 22, 255)
fl, fr = (106, 121), (154, 117)            # topmost visible glass in each narrow lancet (checked by hand)
print("new high holes", fl, fr)
for h in (fl, fr): hole(h[0], h[1], 1.6)

# ---------- 4. take the light beams off the TOP hole of the side windows (smoke comes out there instead)
TOP = {"farleft": (6, 114), "side": (54, 135), "frontL": fl, "frontR": fr}
for key in ("farleft", "side"):
    cx, cy = TOP[key]
    for y in range(cy - 8, cy + 9):
        for x in range(max(0, cx - 18), cx + 1):
            if src[x, y] == V7[x, y] and V7[x, y] != V6[x, y]: px[x, y] = V6[x, y]

# ---------- 5. soot stains on the siding above each smoking pane
def painted(x, y):
    if not (0 <= x < W and 0 <= y < H): return False
    p = px[x, y]
    if p[3] < 255: return False
    h, l, s = hls(p); return s < 0.25 and l > 0.2
for key, (cx, cy) in TOP.items():
    for y in range(cy - 22, cy - 1):
        for x in range(cx - 6, cx + 7):
            t = (cy - y) / 22; spread = 2 + 4 * t
            if abs(x - cx - 1.5 * t * (1 if key.startswith("front") else -1)) > spread or not painted(x, y): continue
            k = 0.75 * (1 - t) * (0.6 + 0.4 * noise(x, y, 3, 2))
            p = px[x, y]; px[x, y] = tuple(int(p[c] * (1 - k) + 26 * k) for c in range(3)) + (255,)

# ---------- 6. roof: the sag breaks open; firelight inside; snapped battens across the hole
CX, CY = 63, 76
holepx = set()
for y in range(CY - 8, CY + 9):
    for x in range(CX - 14, CX + 15):
        ang = math.atan2(y - CY, x - CX)
        rx = 10 * (0.75 + 0.35 * noise(ang * 3 + 9, 0, 1, 7)); ry = 4.6 * (0.75 + 0.35 * noise(ang * 3 + 9, 0, 1, 8))
        if ((x - CX) / rx) ** 2 + ((y - CY) / ry) ** 2 <= 1 and px[x, y][3] == 255: holepx.add((x, y))
for (x, y) in holepx:
    depth = (y - (CY - 5)) / 10                       # deeper rows show more fire glow
    n = noise(x, y, 2, 3)
    if depth > 0.55 and n > 0.45: c = (255, 172, 70) if n > 0.7 else (214, 96, 40)
    elif depth > 0.3 and n > 0.6: c = (150, 60, 30)
    else: c = (20, 14, 14)
    px[x, y] = c + (255,)
rim = {(x + dx, y + dy) for (x, y) in holepx for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - holepx
for q in rim:
    if px[q][3] == 255:
        p = px[q]
        px[q] = (int(p[0] * .5), int(p[1] * .5), int(p[2] * .55), 255) if q[1] <= CY else (min(255, p[0] + 30), min(255, p[1] + 16), p[2], 255)
for (x0, y0, x1, y1) in ((CX - 9, CY - 1, CX + 2, CY - 3), (CX - 2, CY + 2, CX + 9, CY - 1)):   # snapped battens
    n = max(abs(x1 - x0), abs(y1 - y0))
    for s in range(n + 1):
        x = round(x0 + (x1 - x0) * s / n); y = round(y0 + (y1 - y0) * s / n)
        px[x, y] = (96, 72, 50, 255); px[x, y + 1] = (58, 42, 30, 255)

# ---------- 8. door brace board + torn flag
for y in range(58, 78):                               # flag: ragged, torn trailing edge
    for x in range(171, 184):
        p = px[x, y]
        if p[3] and p[0] > p[2] + 30:
            cut = 176 + 3 * noise(0, y, 2, 31) + (2 if y % 5 == 0 else 0)
            if x > cut or (x > 173 and noise(x, y, 1.5, 32) > 0.78): px[x, y] = (0, 0, 0, 0)

# ---------- 9. door: right leaf swung inward a little; firelight inside through the gap; light on the steps
LEAF = (130, 103, 139, 171)          # right leaf box (hinge on the right edge)
leaf = {(x, y): src[x, y] for y in range(LEAF[1], LEAF[3] + 1) for x in range(LEAF[0], LEAF[2] + 1)}
GAP = 4                               # how far the free edge moved toward the hinge (px)
for y in range(LEAF[1], LEAF[3] + 1):
    # leaf columns 130..139 squeeze into 130+GAP..139 (foreshortened as it turns in), darker (turned from the moon)
    for x in range(LEAF[0] + GAP, LEAF[2] + 1):
        sx = LEAF[0] + round((x - (LEAF[0] + GAP)) * (LEAF[2] - LEAF[0]) / (LEAF[2] - LEAF[0] - GAP))
        p = leaf[(sx, y)]
        if p[3] == 255 and not (p[0] > 180 and p[1] > 160 and p[2] < 150 and x >= 138):   # keep the stone frame pixels
            px[x, y] = (int(p[0] * .72), int(p[1] * .72), int(p[2] * .76), 255)
    # the free edge catches the fire (door thickness)
    if px[LEAF[0] + GAP, y][3] == 255: px[LEAF[0] + GAP, y] = (176, 104, 54, 255)
    # the gap: the fire inside, seen through the opening (flames rising from the floor, hot core, dark smoky top)
    for x in range(LEAF[0], LEAF[0] + GAP):
        if src[x, y][3] < 255: continue
        t = (y - LEAF[1]) / (LEAF[3] - LEAF[1])          # 0 top .. 1 floor
        flame = t + 0.35 * (noise(x, y, 2.5, 77) - .5) + 0.25 * (noise(x * 3, y, 4, 78) - .5)
        if flame > 0.92: c = (255, 236, 168)                # white-hot base
        elif flame > 0.78: c = (255, 196, 92)               # yellow
        elif flame > 0.62: c = (246, 132, 44)               # orange tongues
        elif flame > 0.48: c = (186, 66, 28)                # red edges
        elif flame > 0.32: c = (96, 34, 22)                 # glow on the smoke
        else: c = (30, 18, 18)                              # smoky dark top
        px[x, y] = c + (255,)
for y in range(171, 186):                               # warm spill on the steps in front of the gap
    for x in range(124, 142):
        p = px[x, y]
        if p[3] < 255: continue
        k = max(0.0, 1 - math.hypot((x - 132) / 9, (y - 171) / 12)) * 0.45
        if k > 0: px[x, y] = (min(255, int(p[0] + (255 - p[0]) * k)), min(255, int(p[1] + (150 - p[1]) * k * .8)), int(p[2] * (1 - k * .5)), 255)

# ---------- 10. belfry: cracked front-right post, a chunk broken out of the front railing
for i, (x, y) in enumerate([(132, 27), (132, 28), (133, 29), (132, 30), (132, 31), (133, 32), (133, 33), (132, 34), (132, 35), (133, 36)]):
    px[x, y] = (30, 28, 32, 255)
    if i % 3 == 0: px[x + 1, y] = (70, 70, 76, 255)
px[(134, 31)] = (0, 0, 0, 0); px[(134, 32)] = (0, 0, 0, 0)       # a splinter missing from its outer edge
for y in range(41, 48):                                           # broken railing section: see-through, jagged ends
    for x in range(120, 128):
        jag = (x == 120 and y in (43, 46)) or (x == 127 and y in (42, 45))
        if not jag: px[x, y] = (0, 0, 0, 0)
for (x, y) in [(119, 44), (128, 43), (128, 46)]: px[x, y] = (150, 152, 160, 255)   # broken stubs
for (x, y) in [(121, 48), (122, 49), (123, 49)]:                                    # a dangling piece
    px[x, y] = (178, 180, 188, 255)

for i, (x, y) in enumerate([(115, 28), (116, 29), (115, 30), (115, 31), (116, 32), (116, 33), (115, 34), (116, 35)]):
    px[x, y] = (30, 28, 32, 255)                                  # crack down the front-left post too
px[(117, 30)] = (0, 0, 0, 0)
old = im.copy().load()
for x in range(96, 146):
    d = round(4 * max(0.0, min(1.0, (x - 100) / 38)))            # sinks more toward the front
    if d == 0: continue
    for y in range(26, -1, -1):
        px[x, y + d] = old[x, y] if old[x, y][3] else (px[x, y + d] if y + d > 26 else (0, 0, 0, 0))
    for y in range(0, d): px[x, y] = (0, 0, 0, 0)
# ---------- 11. second burst sandbag (front-left pile): tear, slumped bag, sand pouring into a heap
SAND = [(196, 170, 118), (170, 146, 100), (142, 120, 82), (118, 98, 66)]
# torn opening: dark ragged lip with sand showing inside it
for (x, y) in [(4, 181), (5, 182), (6, 181), (7, 182), (8, 181), (9, 182), (10, 181), (11, 182), (12, 181), (13, 182), (5, 183), (12, 183)]:
    px[x, y] = (34, 26, 20, 255)
for (x, y) in [(6, 183), (7, 184), (8, 183), (9, 184), (10, 183), (11, 184)]:
    px[x, y] = SAND[0] + (255,)
for y in range(184, 187):
    for x in range(4, 14):
        p = px[x, y]
        if p[3] == 255: px[x, y] = (int(p[0] * .78), int(p[1] * .78), int(p[2] * .78), 255)   # the bag sags
for y in range(185, 190):                                         # the pour: short, uneven
    for x in (9, 10):
        if noise(x, y, 1.5, 61) > .25: px[x, y] = SAND[(x + y) % 3] + (255,)
for x in range(2, 23):                                            # the heap: whole mound on the canvas
    u = (x - 11) / 10
    if abs(u) >= 1: continue
    h = 7 * (1 - u * u) ** 0.8 * (1.1 if x < 11 else .9) + 1.0 * (noise(x, 0, 2, 62) - .5)
    ybot = 195 + (1 if noise(x, 5, 2.5, 65) > .55 else 0) - (1 if abs(u) > .75 else 0)
    for y in range(round(ybot - h), ybot + 1):
        top = y <= ybot - h + 1
        c = SAND[0] if top and abs(u) < .55 else SAND[1] if y < ybot - 2 else SAND[2]
        if abs(u) > .8: c = SAND[3]
        n = noise(x, y, 1.3, 64)
        if n > .72: c = SAND[min(3, SAND.index(c) + 1)]
        elif n < .2 and SAND.index(c) > 0: c = SAND[SAND.index(c) - 1]
        px[x, y] = c + (255,)
im.save("base_050_v3.png")
bg = Image.new("RGBA", im.size, (24, 26, 40, 255)); bg.alpha_composite(im)
bg.resize((W * 4, H * 4), Image.NEAREST).save("/tmp/d50z2.png")

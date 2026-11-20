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
PIV, ANG = (129, 70), math.radians(16)            # hangs off its top nail, swung clockwise
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
px[PIV] = (40, 40, 44, 255)                        # the nail it hangs from

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

# ---------- 7. smoke (see-through past the building, blended over it): roof plume + a thin trickle per window
SMOKE = [(118, 116, 122), (96, 94, 100), (140, 138, 142)]
def smoke(sx, sy, length, w0, grow, drift, amp, a0, salt, dark=False):
    for t in range(length):
        cx = sx + drift * t + amp * math.sin(t / 6.0 + salt); cy = sy - t
        w = w0 + grow * t
        for x in range(int(cx - w - 1), int(cx + w + 2)):
            if not (0 <= x < W and 0 <= cy < H): continue
            d = abs(x - cx) / max(w, .5)
            if d > 1: continue
            n = noise(x, cy, 3, salt) * .6 + noise(x, cy, 7, salt + 1) * .4
            a = a0 * (1 - t / length) ** 0.9 * (1 - d * d) * (0.35 + 0.9 * n)
            if a < 0.04: continue
            c = SMOKE[0] if n > .55 else SMOKE[1] if n < .35 else SMOKE[2]
            if dark and t < length * .6: c = (62, 60, 66) if n < .5 else (84, 82, 88)
            p = px[x, int(cy)]
            if p[3] == 255:
                k = min(.85, a * 1.25)
                px[x, int(cy)] = tuple(int(p[i] * (1 - k) + c[i] * k) for i in range(3)) + (255,)
            else:
                na = max(p[3], int(min(.85, a) * 255))
                px[x, int(cy)] = c + (na,)
smoke(CX + 1, CY - 3, 72, 2.6, 0.12, 0.22, 2.4, 0.95, 11)          # roof plume, leans with the wind
for i, (key, h) in enumerate(TOP.items()):
    if not h: continue
    cx, cy = h
    smoke(cx, cy - 1, 38 if key.startswith("front") else 52, 1.8, 0.13, 0.12 if key.startswith("front") else -0.08, 1.2, 0.95, 20 + i, dark=True)

# ---------- 8. door brace board + torn flag
OUTL = (38, 30, 24, 255); PAL = [(128, 100, 72), (106, 82, 60), (86, 66, 48)]
pts = {}
for s in range(0, 23):
    x = 119 + s; y = round(160 - s * 0.55)
    for j in range(3): pts[(x, y + j)] = PAL[j]
for q in {(x + dx, y + dy) for (x, y) in pts for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - set(pts):
    if px[q][3] == 255: px[q] = OUTL
for q, c in pts.items(): px[q] = c + (255,)
px[(120, 160)] = (36, 36, 40, 255); px[(139, 150)] = (36, 36, 40, 255)
for y in range(58, 78):                               # flag: ragged, torn trailing edge
    for x in range(171, 184):
        p = px[x, y]
        if p[3] and p[0] > p[2] + 30:
            cut = 176 + 3 * noise(0, y, 2, 31) + (2 if y % 5 == 0 else 0)
            if x > cut or (x > 173 and noise(x, y, 1.5, 32) > 0.78): px[x, y] = (0, 0, 0, 0)

im.save("base_050_v1.png")
bg = Image.new("RGBA", im.size, (24, 26, 40, 255)); bg.alpha_composite(im)
bg.resize((W * 4, H * 4), Image.NEAREST).save("/tmp/d50z.png")

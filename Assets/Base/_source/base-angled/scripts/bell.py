"""Ringing bell for the 'under attack' strips (100 / 75 / 50 / 25; not 0).
Each pose is REDRAWN cleanly from the drawn bell, not just resampled:
  1. silhouette = the drawn bell's shape turned about the top centre of its crown (coverage test + spur/notch cleanup)
  2. body = the drawn bell's interior pixels (lightened), sampled at the matching spot
  3. a 1 px dark outline on every edge
  4. the lip redrawn as lines: dark groove, bright rim (curling up at its left end), dim underside
The drawn bell sits against the corner post, so the swing runs mostly LEFT of the drawn pose; nothing shows past the post."""
import math
from collections import Counter

BX0, BX1, BY0, BY1 = 101, 113, 27, 42
PIV = (108.5, 27.5)           # top centre of the crown
AXIS = 108.5                  # the bell is symmetric about this line
RAIL = (0x31, 0x3a, 0x47)
LIGHT = 1.3
MEAN, POST_X = 0.0, 114         # even swing about straight down; the corner post stays in front
SHIFT = 2                     # the roof point (tower centre) is at x 110: hang the bell directly under it
HANGER = [(110, 26)]
OUTLINE = (12, 10, 11, 255)
# lip, in the drawn bell's pixel coordinates (pixel centres)
RIM = [(103.5, 39.5), (105.5, 40.5), (106.5, 41.5), (110.5, 41.5), (111.5, 40.5), (113.5, 39.5)]   # curls up at BOTH ends
RIM_COL = [(70, 69, 61), (84, 84, 78), (104, 105, 106), (92, 95, 90), (112, 114, 110), (136, 137, 139), (122, 123, 124), (110, 111, 113), (84, 86, 77)]
GROOVE = [(107.5, 40.5), (109.5, 40.5)]; GROOVE_COL = (36, 32, 28, 255)
UNDER = [(105.5, 42.5), (111.5, 42.5)]; UNDER_COL = (52, 52, 45, 255)

def bell_mask(B):
    m = {}
    for y in range(BY0, BY1 + 1):
        for x in range(BX0, BX1 + 1):
            p = B[x, y]
            if p[3] == 0 or p[:3] == RAIL or (y == 42 and x < 103): continue
            m[(x, y)] = p
    return m

def lighten(p):
    return (min(255, round(p[0] * LIGHT + 3)), min(255, round(p[1] * LIGHT + 3)), min(255, round(p[2] * LIGHT + 2)), 255)

N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
def edge_of(s): return {k for k in s if any((k[0] + a, k[1] + b) not in s for a, b in N4)}

def fwd(p, ang):
    r = math.radians(-ang); ca, sa = math.cos(r), math.sin(r); ux, uy = p[0] - PIV[0], p[1] - PIV[1]
    return ux * ca + uy * sa + PIV[0], -ux * sa + uy * ca + PIV[1]
def inv(x, y, ang):
    r = math.radians(-ang); ca, sa = math.cos(r), math.sin(r); dx, dy = x - PIV[0], y - PIV[1]
    return dx * ca - dy * sa + PIV[0], dx * sa + dy * ca + PIV[1]

def line(pts, ang):
    out = []
    q = [tuple(math.floor(c) for c in fwd(p, ang)) for p in pts]
    for (x0, y0), (x1, y1) in zip(q, q[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            k = (round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n))
            if k not in out: out.append(k)
    return out

def extents(m):
    E = {}
    for (x, y) in m:
        l, r = E.get(y, (x, x + 1)); E[y] = (min(l, x), max(r, x + 1))
    return E
def in_shape(E, sx, sy):
    """symmetric bell: the drawn LEFT profile mirrored onto the right, with straight (interpolated) sides"""
    if sy < BY0 or sy > BY1 + 1: return False
    t = sy - .5; y0 = max(BY0, min(BY1, math.floor(t))); y1 = min(BY1, y0 + 1); f = max(0.0, min(1.0, t - y0))
    w = AXIS - (E[y0][0] * (1 - f) + E[y1][0] * f)
    if sy < BY0 + 1.5: w -= 1.2 * (1 - (sy - BY0) / 1.5)             # rounded crown corners
    return abs(sx - AXIS) <= w

def smooth_interior(interior):
    """3x3 mean inside the bell, then snapped to 6 of its own colours: clean shading bands instead of noise"""
    from PIL import Image
    ks = list(interior); bl = {}
    for (x, y) in ks:
        ns = [interior[(x + a, y + b)] for a in (-1, 0, 1) for b in (-1, 0, 1) if (x + a, y + b) in interior]
        bl[(x, y)] = tuple(sum(p[i] for p in ns) / len(ns) for i in range(3))
    im = Image.new("RGB", (len(ks), 1)); im.putdata([tuple(round(c) for c in bl[k]) for k in ks])
    q = im.quantize(6, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    return {k: q.getpixel((i, 0)) + (255,) for i, k in enumerate(ks)}

def pose(m, ang, S=6):
    """ang deg, + = bottom swings left. 0 = the drawn pose."""
    interior = {k: p for k, p in m.items() if k not in edge_of(set(m)) and k[1] <= 39}
    E = extents(m)
    ikeys = list(interior)
    sil = set()
    for y in range(BY0 - 5, BY1 + 6):
        for x in range(BX0 - 13, BX1 + 8):
            c = sum(in_shape(E, a, b) for a, b in
                    (inv(x + (i + .5) / S, y + (j + .5) / S, ang) for i in range(S) for j in range(S)))
            if c * 2 >= S * S: sil.add((x, y))
    rim, groove, under = line(RIM, ang), line(GROOVE, ang), line(UNDER, ang)
    sil |= set(rim) | set(under)
    for _ in range(3):                                                # clean spurs and notches
        sil -= {k for k in sil if sum((k[0] + a, k[1] + b) in sil for a, b in N4) <= 1 and k not in rim}
        box = {(k[0] + a, k[1] + b) for k in sil for a, b in N4} - sil
        sil |= {k for k in box if sum((k[0] + a, k[1] + b) in sil for a, b in N4) >= 3}
    out = {}
    for (x, y) in sil:
        sx, sy = inv(x + .5, y + .5, ang)
        k = (math.floor(min(sx, 112.9)), math.floor(sy))
        if k not in interior: k = min(ikeys, key=lambda q: (q[0] + .5 - sx) ** 2 + (q[1] + .5 - sy) ** 2)
        out[(x, y)] = lighten(interior[k])
    for k in edge_of(sil): out[k] = OUTLINE
    for k in groove:
        if k in sil and k not in edge_of(sil): out[k] = GROOVE_COL
    for k in under: out[k] = UNDER_COL
    for i, k in enumerate(rim):
        out[k] = RIM_COL[min(len(RIM_COL) - 1, round(i * (len(RIM_COL) - 1) / max(1, len(rim) - 1)))] + (255,)
    return out

def front_mask(B, m):
    f = set()
    for y in range(0, 200):
        for x in range(80, 140):
            if B[x, y][3] and (x, y) not in m and (y <= 26 or y >= 43 or x >= POST_X or B[x, y][:3] == RAIL): f.add((x, y))
    return f

def angle_at(f, N, amp, swings):
    s = math.sin(f / N * math.tau * swings)
    return MEAN + amp * math.copysign(abs(s) ** 0.8, s)

def ring(frames, base, N, amp=20.0, swings=1):
    B = base.load(); m = bell_mask(B); front = front_mask(B, m); cache = {}
    for f, im in enumerate(frames):
        px = im.load(); a = round(angle_at(f, N, amp, swings), 2)
        if a not in cache: cache[a] = {(k[0] + SHIFT, k[1]): v for k, v in pose(m, a).items()}
        saved = {k: px[k] for k in front}
        for k in m: px[k] = (0, 0, 0, 0)
        for k, v in cache[a].items():
            if k not in front: px[k] = v                              # the post stays in front; the bell may show past it
        for k in HANGER: px[k] = (24, 21, 19, 255)
        for k, v in saved.items(): px[k] = v
    return frames

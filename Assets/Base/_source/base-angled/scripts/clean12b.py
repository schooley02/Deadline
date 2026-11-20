"""v12 clean rebuild:
 1. from v8: close the old bell opening with phase-matched siding; move each lancet window out 3 px as ONE whole
    shape (per-row span between its outer frame pixels), refill what it leaves with matching siding
 2. tower = PixelLab's own belfry (t3_91_0) inside the tower silhouette, untouched (no re-cut, no pasted bell)
 3. one hand-drawn wooden cross on the gable (pixel by pixel, sloped with the wall)"""
import colorsys
from PIL import Image, ImageFilter
v8 = Image.open("base_100_v8.png").convert("RGBA"); src = v8.load()
im = v8.copy(); px = im.load(); W, H = im.size
def lum(p): return .3 * p[0] + .59 * p[1] + .11 * p[2]
def sat(p): return colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)[2]
SL = 0.2
DOOR = (116, 101, 142, 172)
LWIN, RWIN, HOLE = (102, 110, 118, 165), (139, 104, 156, 160), (116, 69, 141, 101)
EXCL = [DOOR, LWIN, RWIN, HOLE, (160, 120, 184, 200), (96, 160, 160, 200)]
def inr(r, x, y): return r[0] <= x <= r[2] and r[1] <= y <= r[3]
def is_wall(x, y):
    p = src[x, y]
    return p[3] == 255 and 97 <= x <= 159 and not any(inr(r, x, y) for r in EXCL) and sat(p) < 0.25 and lum(p) > 40
samples = [(x, y) for y in range(55, 170) for x in range(97, 160) if is_wall(x, y)]
PITCH = 7
bucket = {}
for (x, y) in samples: bucket.setdefault(round(y + SL * x) % PITCH, []).append((x, y))
def siding(x, y):
    ph = round(y + SL * x) % PITCH
    sx, sy = min(bucket[ph], key=lambda q: (q[0] - x) ** 2 + 2.5 * (q[1] - y) ** 2)
    return src[sx, sy]

# clear the bell opening
for y in range(HOLE[1], HOLE[3] + 1):
    for x in range(HOLE[0], HOLE[2] + 1):
        if src[x, y][3]: px[x, y] = siding(x, y)
# move each window as a whole rectangle (window + a little wall), 5 px out and 1 px along the slope:
# 5 x 0.2 = 1, so the board lines line up exactly with the wall around it
LR, RR = (101, 108, 115, 166), (142, 102, 156, 161)
def grab(r): return {(x, y): src[x, y] for y in range(r[1], r[3] + 1) for x in range(r[0], r[2] + 1)}
lw, rw = grab(LR), grab(RR)
for r in (LR, RR):                             # vacate: siding everywhere in the old rect (door untouched)
    for y in range(r[1], r[3] + 1):
        for x in range(r[0], r[2] + 1):
            if src[x, y][3] and not inr((118, 101, 140, 172), x, y): px[x, y] = siding(x, y)
for (x, y), p in lw.items():
    if p[3]: px[x - 5, y + 1] = p
for (x, y), p in rw.items():
    if p[3]: px[x + 5, y - 1] = p
# the door frame must stay on top
DF = (118, 101, 140, 172)                       # the door + its stone arch only
for y in range(DF[1], DF[3] + 1):
    for x in range(DF[0], DF[2] + 1): px[x, y] = src[x, y]
im.save("v12_front.png")

# 2. PixelLab belfry, untouched, inside the tower silhouette
tower = Image.open("t3_91_0.png").convert("RGBA")
sil = Image.open("tower3_sil.png").convert("L").filter(ImageFilter.MaxFilter(3))
# the cross area of that render belongs to the old code cross: never take pixels below the gable peak row from it
sp = sil.load()
for y in range(64, H):
    for x in range(W): sp[x, y] = 0 if y > 66 else sp[x, y]
im = Image.composite(tower, im, sil); px = im.load()
import math, statistics as st
YAW, ELEV, SC, X0, Y0 = math.radians(35), math.radians(8), 9.6, 96, 193
def P(x, y, z):
    u = x * math.cos(YAW) + z * math.sin(YAW); v = -x * math.sin(YAW) + z * math.cos(YAW)
    return (X0 + SC * u, Y0 - SC * (y * math.cos(ELEV) + v * math.sin(ELEV)))
corner_x = P(-0.7, 15, 4.3)[0]                 # tower front-left corner on screen
side_ref = [src[x, y] for y in range(110, 170) for x in range(20, 95) if src[x, y][3] and sat(src[x, y]) < .2 and lum(src[x, y]) > 60]
front_ref = [im.getpixel((x, y)) for y in range(108, 150) for x in range(146, 158) if is_wall(x, y)]
def match(pixels, ref):
    stats = []
    for c in range(3):
        a = [p[c] for p in pixels]; b = [p[c] for p in ref]
        stats.append((st.mean(a), st.pstdev(a) or 1, st.mean(b), st.pstdev(b) or 1))
    return stats
base_rows = range(44, 68)                      # tower clapboard base (below the belfry rail, above the roof)
tb = Image.open("tower3_sil.png").convert("L").load()
side_px = [(x, y) for y in base_rows for x in range(78, 145) if tb[x, y] and px[x, y][3] == 255 and x < corner_x - 1 and sat(px[x, y]) < .3 and lum(px[x, y]) > 50]
front_px = [(x, y) for y in base_rows for x in range(78, 145) if tb[x, y] and px[x, y][3] == 255 and x > corner_x + 1 and sat(px[x, y]) < .3 and lum(px[x, y]) > 50]
for group, ref in ((side_px, side_ref), (front_px, front_ref)):
    if not group: continue
    S = match([px[q] for q in group], ref)
    new = {}
    for q in group:
        p = px[q]
        new[q] = tuple(max(0, min(255, int((p[c] - S[c][0]) / S[c][1] * S[c][3] + S[c][2]))) for c in range(3)) + (255,)
    for q, v in new.items(): px[q] = v
print("tower corner x", round(corner_x), "side", len(side_px), "front", len(front_px))

# 3. hand-drawn wooden cross, centred on the gable, arm and ends follow the wall slope (rises 1 px per 5)
OUT, D1, D2, M, L1 = (38, 26, 20, 255), (78, 54, 38, 255), (98, 70, 48, 255), (118, 86, 58, 255), (148, 112, 78, 255)
cx, top, bot, arm_y = 129, 70, 93, 75          # upright centre column, top/bottom rows, arm top row (at cx)
UW, AH, AL, AR = 3, 3, 5, 5                    # upright width, arm height, arm reach left/right of the upright
cross = {}
for y in range(top, bot + 1):                  # upright: x cx-1 .. cx+1 (3 px, centred on cx)
    for i, x in enumerate(range(cx - 1, cx + 2)):
        cross[(x, y)] = [L1, M, D2][i]
for x in range(cx - 1 - AL, cx + 2 + AR):      # arm: AH rows, sloping with the wall
    off = round(-SL * (x - cx))
    for j in range(AH):
        cross[(x, arm_y + off + j)] = [L1, M, D2][j]
# grain specks
for (x, y) in list(cross):
    if (x * 7 + y * 3) % 11 == 0 and cross[(x, y)] in (M, L1): cross[(x, y)] = D2
# outline = 1 px around the shape
outline = {(x + dx, y + dy) for (x, y) in cross for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - set(cross)
for q in outline: px[q] = OUT
for q, c in cross.items(): px[q] = c
# a small shadow down-right on the wall (wall faces right/moonlight from the right: shadow falls left-down 1 px)
for (x, y) in outline:
    q = (x - 1, y + 1)
    if q not in cross and q not in outline and px[q][3] == 255 and lum(px[q]) > 90:
        p = px[q]; px[q] = (int(p[0] * .72), int(p[1] * .72), int(p[2] * .78), 255)
# bell: remove the iron yoke legs either side, keep the bell, its crown and the posts/rail
from PIL import Image as _I
bronze = [(x, y) for y in range(24, 44) for x in range(92, 126) if px[x, y][3] and px[x, y][0] > px[x, y][2] + 6 and sum(px[x, y][:3]) < 450]
core0 = {(x, y) for (x, y) in bronze if 26 <= y <= 41}
# largest connected bronze blob = the bell (drops warm specks on the yoke)
best = set()
for q in core0:
    if any(q in b for b in [best]): continue
    blob, st_ = set(), [q]
    while st_:
        c = st_.pop()
        if c in blob or c not in core0: continue
        blob.add(c); x, y = c
        st_ += [(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
    if len(blob) > len(best): best = blob
core = list(best)
bx0 = min(x for x, _ in core); bx1 = max(x for x, _ in core); by0 = min(y for _, y in core); by1 = max(y for _, y in core)
bcx = (bx0 + bx1) // 2
def near_white(x, y):
    return any(px[x + dx, y + dy][3] and sum(px[x + dx, y + dy][:3]) > 450 for dx in (-1, 0, 1) for dy in (-1, 0, 1))
for y in range(26, 42):
    for x in range(94, 125):
        p = px[x, y]
        if not p[3] or sum(p[:3]) > 450: continue
        in_bell = bx0 - 1 <= x <= bx1 + 1 and by0 - 1 <= y <= by1 + 1
        crown = abs(x - bcx) <= 1 and y < by0
        if not in_bell and not crown and not near_white(x, y):
            px[x, y] = (0, 0, 0, 0)
print("bell box", bx0, by0, bx1, by1)
im.save("base_100_v12.png")
bg = Image.new("RGBA", im.size, (24, 26, 40, 255)); bg.alpha_composite(im)
bg.resize((W * 4, H * 4), Image.NEAREST).save("v12_zoom4x.png")
bg.crop((76, 0, 166, 175)).resize((90 * 6, 175 * 6), Image.NEAREST).save("/tmp/v12c.png")

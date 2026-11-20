"""Move the lancet windows out from the door and close the old bell opening, filling with siding sampled from
the same board line on the clean front wall nearby (phase-matched along the 0.2 px/px board slope)."""
import colorsys, math
from PIL import Image
im = Image.open("base_100_v8.png").convert("RGBA"); px = im.load(); W, H = im.size
src = im.copy().load()
def lum(p): return .3 * p[0] + .59 * p[1] + .11 * p[2]
def sat(p): return colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)[2]
SL = 0.2
# front wall polygon (x = 0 plane) from the projection used for the layout
FACE_X0, FACE_X1 = 97, 159
DOOR = (116, 101, 142, 172)
LWIN, RWIN, HOLE = (103, 112, 117, 163), (140, 106, 155, 158), (116, 69, 141, 101)
EXCL = [DOOR, LWIN, RWIN, HOLE, (160, 120, 184, 200), (96, 160, 160, 200)]
def inr(r, x, y): return r[0] <= x <= r[2] and r[1] <= y <= r[3]
def is_wall(x, y):
    p = src[x, y]
    return p[3] == 255 and FACE_X0 <= x <= FACE_X1 and not any(inr(r, x, y) for r in EXCL) and sat(p) < 0.25 and lum(p) > 40
samples = [(x, y) for y in range(55, 170) for x in range(FACE_X0, FACE_X1 + 1) if is_wall(x, y)]
# board pitch: most concentrated phase of the dark gap lines
dark = [(x, y) for (x, y) in samples if lum(src[x, y]) < 105]
best = max(range(3, 8), key=lambda p: max(sum(1 for (x, y) in dark if round(y + SL * x) % p == k) for k in range(p)) / max(1, len(dark)) * p)
PITCH = best
print("pitch", PITCH, "samples", len(samples))
bucket = {}
for (x, y) in samples: bucket.setdefault(round(y + SL * x) % PITCH, []).append((x, y))
def fill(x, y):
    ph = round(y + SL * x) % PITCH
    cand = bucket.get(ph, [])
    sx, sy = min(cand, key=lambda q: (q[0] - x) ** 2 + 2.5 * (q[1] - y) ** 2)
    return src[sx, sy]

# 1. window pixels (frame, glass, outline) of each lancet, then fill their rects with siding and paste shifted
def window_pixels(r):
    return {(x, y): src[x, y] for y in range(r[1], r[3] + 1) for x in range(r[0], r[2] + 1)
            if src[x, y][3] and (sat(src[x, y]) > 0.2 or lum(src[x, y]) < 48)}
lw, rw = window_pixels(LWIN), window_pixels(RWIN)
for r in (LWIN, RWIN, HOLE):
    for y in range(r[1], r[3] + 1):
        for x in range(r[0], r[2] + 1):
            if src[x, y][3] and FACE_X0 <= x and not inr(DOOR, x, y): px[x, y] = fill(x, y)
for (x, y), p in lw.items(): px[x - 3, y + 1] = p      # left window 3 px left (wall falls 0.6 px)
for (x, y), p in rw.items(): px[x + 3, y - 1] = p      # right window 3 px right (wall rises 0.6 px)
# the door's own dark outline may have been grabbed as "window": restore the door rect untouched
for y in range(DOOR[1], DOOR[3] + 1):
    for x in range(DOOR[0], DOOR[2] + 1):
        if not (lw.get((x + 3, y - 1)) or rw.get((x - 3, y + 1))): px[x, y] = src[x, y]
im.save("base_100_v8s.png")
bg = Image.new("RGBA", im.size, (24, 26, 40, 255)); bg.alpha_composite(im)
bg.crop((90, 55, 165, 175)).resize((75 * 6, 120 * 6), Image.NEAREST).save("/tmp/sid.png")

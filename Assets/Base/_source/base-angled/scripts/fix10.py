"""v8: clean rebuild. base_100_low_final + white door + statue (42_0) + corner sandbags (fix9r_52_0),
clear PixelLab's fill boxes (transparent where the original was empty), thin perspective trim on the bell
opening drawn in code, feathered lamplight calm-down."""
from PIL import Image
import colorsys, math

orig = Image.open("base_100_low_final.png").convert("RGBA")
im = orig.copy()
def comp(src, mask):
    global im
    im = Image.composite(Image.open(src).convert("RGBA"), im, Image.open(mask).convert("L"))
comp("fix8_door_41_0.png", "fix8_mask_door.png")
comp("fix8_statue_42_0.png", "fix8_mask_statue.png")
comp("fix9r_52_0.png", "fix9_mask.png")
px, op = im.load(), orig.load()
W, H = im.size
def lum(p): return .3 * p[0] + .59 * p[1] + .11 * p[2]

# 1. clear fill boxes: inside the two inpaint rects, a pixel that was empty before and is now a flat dark
#    navy/ground-fill pixel goes back to transparent. Statue/pedestal/bags are lighter or warmer and stay.
for (x0, y0, x1, y1) in [(17, 118, 46, 194), (150, 158, 183, 195)]:
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            p = px[x, y]
            if op[x, y][3] == 0 and p[3]:
                h, l, s = colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)
                dark_fill = lum(p) < 48 and p[2] >= p[0] - 4
                grass = p[1] > p[0] + 6 and p[1] > p[2]
                if dark_fill or grass:
                    px[x, y] = (0, 0, 0, 0)
for y in range(150, 200):
    for x in range(14, 50):
        p = px[x, y]
        if p[3] and p[1] > p[0] + 6 and p[1] > p[2]:
            Lm = int(lum(p)); px[x, y] = (Lm + 8, int(Lm * .9), int(Lm * .76), p[3])
# a ground pixel row below the pedestal where it now floats over empty space: soft dirt under the pedestal only
# (left for review; pedestal base row is opaque stone)

# 2. thin trim around the bell opening, following the facade (front wall recedes right: left jamb wider)
opening = set()
for y in range(74, 99):
    for x in range(120, 139):
        if op[x, y][3] and lum(op[x, y]) < 45: opening.add((x, y))
# keep only the main blob (connected to the bell area), then fill each row's span so the bell is inside it
seed = (124, 88); blob = set(); stack = [seed]
while stack:
    q = stack.pop()
    if q in blob or q not in opening: continue
    blob.add(q); x, y = q
    stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
rows = {}
for x, y in blob: rows.setdefault(y, []).append(x)
blob = {(x, y) for y, xs in rows.items() for x in range(min(xs), max(xs) + 1)}
cx = sum(x for x, _ in blob) / len(blob)
LIGHT, MID, DARK = (214, 216, 222, 255), (162, 166, 178, 255), (34, 34, 44, 255)
def ring(n):
    out = set()
    for (x, y) in blob:
        for dx in range(-n, n + 1):
            for dy in range(-n, n + 1):
                if max(abs(dx), abs(dy)) == n: out.add((x + dx, y + dy))
    return {q for q in out if q not in blob}
r1, r2, r3 = ring(1), ring(2), ring(3)
bottom = max(y for _, y in blob)
for (x, y) in r3 - r2 - r1:
    if x < cx - 1 and y <= bottom: px[x, y] = DARK                    # outer edge, left + arch only
for (x, y) in r2 - r1:
    if y > bottom: continue
    px[x, y] = MID if x < cx - 1 else DARK                            # right jamb: just an outline (foreshortened)
for (x, y) in r1:
    if y > bottom: continue
    px[x, y] = LIGHT if x < cx + 2 else MID
# small sill under the opening, rising 0.2 px per px to the right like the facade
xs = [x for x, _ in blob]; L, R = min(xs) - 3, max(xs) + 2
for x in range(L, R + 1):
    yb = round(bottom + 1 - 0.2 * (x - L) * 0)  # base row of the opening already follows the wall
    yy = bottom + 1 - round(0.2 * (x - L) / 2)
    px[x, yy] = LIGHT; px[x, yy + 1] = MID; px[x, yy + 2] = DARK

# 3. feathered calm-down of the round lamplight patch right of the door (no box edges)
CX, CY, RAD = 157, 142, 16
for y in range(CY - RAD, CY + RAD + 1):
    for x in range(CX - RAD, min(W, CX + RAD + 1)):
        p = px[x, y]
        if p[3] < 255: continue
        h, l, s = colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)
        if not (l > 0.35 and p[0] > p[2] + 10 and s < 0.55): continue
        if 141 <= x <= 152 and 108 <= y <= 156: continue          # the lancet window glass
        k = max(0.0, 1 - math.hypot(x - CX, (y - CY) * 0.8) / RAD) ** 0.8 * 0.7
        Lm = lum(p)
        px[x, y] = (int(p[0] * (1 - k) + (Lm - 4) * k), int(p[1] * (1 - k) + Lm * k), int(p[2] * (1 - k) + (Lm + 8) * k), 255)

im.save("base_100_v8.png")
bg = Image.new("RGBA", im.size, (24, 26, 40, 255)); bg.alpha_composite(im)
bg.resize((W * 4, H * 4), Image.NEAREST).save("v8_zoom4x.png")
for name, box in [("bell", (108, 62, 150, 106)), ("statue", (8, 150, 56, 199)), ("corner", (140, 140, 184, 199))]:
    bg.crop(box).resize(((box[2] - box[0]) * 8, (box[3] - box[1]) * 8), Image.NEAREST).save(f"/tmp/v8_{name}.png")

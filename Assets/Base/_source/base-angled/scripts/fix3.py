"""Step 3 (code): flag to the right corner, lantern post by the steps (lit + see-through glow), lighter steps."""
from PIL import Image, ImageFilter
import math

src = Image.open("g3_gen_82_0.png").convert("RGBA")
im = Image.open("fix2_comp.png").convert("RGBA")
W, H = im.size
px = im.load()


def lum(p): return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]


# ---- 1. lighter steps (tone pass: only the steps' dark blue-grey stone, outlines kept)
for y in range(146, 190):
    for x in range(112, 156):
        p = px[x, y]
        if p[3] == 0: continue
        L = lum(p)
        if 24 <= L < 95 and p[2] >= p[0] - 2 and not (p[0] > p[2] + 10):
            px[x, y] = (min(255, int(p[0] * 1.55 + 14)), min(255, int(p[1] * 1.55 + 12)),
                        min(255, int(p[2] * 1.35 + 4)), 255)

# ---- 2. flag: lift cloth (+ its dark outline) from the source, mirror so it flies right, put on the right corner
sp = src.load()
F = set()
for y in range(74, 94):
    for x in range(76, 94):
        p = sp[x, y]
        if p[3] and ((p[0] > p[2] + 30) or (p[0] > 180 and p[1] > 170 and abs(p[0] - p[2]) < 25)):
            F.add((x, y))
edge = set()
for (x, y) in F:
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            q = (x + dx, y + dy)
            if q not in F and lum(sp[q]) < 45 and q[0] < 91:
                edge.add(q)
cloth = F | edge
fx0 = min(x for x, _ in cloth); fx1 = max(x for x, _ in cloth); fy0 = min(y for _, y in cloth)
POLE_X, POLE_TOP, POLE_BOT = 160, 52, 96
for (x, y) in cloth:
    nx = POLE_X + 1 + (fx1 - x)          # mirrored, attached at the pole
    ny = POLE_TOP + 2 + (y - fy0)
    if 0 <= nx < W: px[nx, ny] = sp[x, y]
for y in range(POLE_TOP, POLE_BOT + 1):
    px[POLE_X, y] = (112, 114, 124, 255)
    px[POLE_X - 1, y] = (30, 30, 38, 255)
px[POLE_X, POLE_TOP - 1] = (170, 172, 180, 255); px[POLE_X - 1, POLE_TOP - 1] = (30, 30, 38, 255)  # finial
for y in (POLE_BOT - 8, POLE_BOT - 2):            # lashing to the corner board
    px[POLE_X - 1, y] = (110, 90, 64, 255); px[POLE_X + 1, y] = (110, 90, 64, 255)

# ---- 3. lantern on an iron post right of the steps, lit
PX, PBOT, PTOP = 156, 176, 140
IRON, IRONL = (26, 26, 32, 255), (78, 80, 90, 255)
for y in range(PTOP, PBOT + 1):
    px[PX, y] = IRON; px[PX + 1, y] = IRONL if y % 4 else IRON
for x in range(PX, PX + 6): px[x, PTOP] = IRON          # arm
px[PX + 4, PTOP + 1] = IRON
LX, LY = PX + 2, PTOP + 2                              # lantern box 5x7 at (LX..LX+4, LY..LY+6)
lant = ["..II..",
        ".IIII.",
        "IFYYFI",
        "IYWWYI",
        "IYWWYI",
        "IFYYFI",
        "IIIIII",
        "..II.."]
COL = {"I": IRON, "F": (232, 150, 64, 255), "Y": (252, 206, 110, 255), "W": (255, 244, 200, 255)}
for j, row in enumerate(lant):
    for i, ch in enumerate(row):
        if ch in COL: px[LX + i, LY + j] = COL[ch]
cx, cy = LX + 2, LY + 4
# warm light spill on nearby opaque pixels (opaque tint, falls off)
for y in range(cy - 22, cy + 30):
    for x in range(cx - 26, min(W, cx + 12)):
        if not (0 <= x < W and 0 <= y < H): continue
        p = px[x, y]
        if p[3] == 0 or COL.get("I") == p: continue
        dd = math.hypot((x - cx) * 0.9, y - cy)
        k = max(0.0, 1 - dd / 24) ** 1.6 * 0.55
        if k > 0.01 and not (LX <= x <= LX + 4 and LY <= y <= LY + 6):
            px[x, y] = (min(255, int(p[0] + (255 - p[0]) * k * 0.55 + 40 * k)),
                        min(255, int(p[1] + (200 - p[1]) * k * 0.45)),
                        max(0, int(p[2] * (1 - k * 0.45))), 255)
# see-through glow halo on transparent pixels around the lantern (the only light fixture)
for y in range(cy - 10, cy + 11):
    for x in range(cx - 10, min(W, cx + 11)):
        if not (0 <= x < W and 0 <= y < H): continue
        p = px[x, y]
        if p[3]: continue
        dd = math.hypot(x - cx, y - cy)
        a = int(max(0.0, 1 - dd / 10) ** 2 * 110)
        if a > 6: px[x, y] = (255, 196, 110, a)

im.save("fix3_out.png")
print(im.getbbox())

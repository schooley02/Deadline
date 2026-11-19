"""Hospital layout guide, 176x144, flat colours + outlines (back row ~0.85)."""
from PIL import Image, ImageDraw
import random

W, H = 176, 144
im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
px = im.load()
d = ImageDraw.Draw(im)

OUT = (30, 31, 34, 255)
ST = (120, 130, 114, 255)      # stucco lit
ST2 = (108, 117, 103, 255)     # stucco darker tone
SIDE = (74, 82, 76, 255)       # side wall shade
SIDE2 = (64, 71, 66, 255)
BONE = (172, 164, 142, 255)
BONE2 = (138, 131, 113, 255)
BONE3 = (104, 99, 86, 255)
FR = (60, 47, 39, 255)         # window frame
LIT = (226, 178, 104, 255)
LIT2 = (196, 144, 78, 255)
DARKG = (38, 46, 56, 255)
DARKG2 = (52, 62, 72, 255)
CAP = (58, 60, 60, 255)
GRN = (112, 196, 138, 255)
BOARD = (30, 40, 36, 255)
RED = (150, 52, 44, 255)
IRON = (26, 26, 29, 255)
STEP = (104, 104, 100, 255)
STEP2 = (84, 84, 82, 255)
SHR = (50, 64, 46, 255)
SHR2 = (66, 82, 56, 255)
SHR3 = (38, 48, 36, 255)


def rect(x0, y0, x1, y1, c):
    d.rectangle([x0, y0, x1, y1], fill=c)


def box(x0, y0, x1, y1, fill, out=OUT):
    rect(x0, y0, x1, y1, out)
    if x1 - x0 >= 2 and y1 - y0 >= 2:
        rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)

# ---- left side wall (recedes: front-left corner x=28 top 32/bottom 143; back x=10 top 37/bottom 139)
FX0, FX1 = 28, 111
for x in range(10, FX0):
    t = (FX0 - x) / (FX0 - 10)
    top = round(32 + 5 * t); bot = round(143 - 4 * t)
    for y in range(top, bot + 1):
        px[x, y] = SIDE if (x + y // 3) % 7 else SIDE2
    # side cornice
    for y in range(top, top + 6):
        px[x, y] = BONE3 if y > top + 1 else CAP
    px[x, top] = OUT; px[x, bot] = OUT
    # side floor band
    yb = round(87 + 2.5 * t)
    for y in range(yb, yb + 4):
        px[x, y] = BONE3
for y in range(37, 140):
    px[10, y] = OUT
# side windows (dark, skewed by perspective: narrow)
for (wy, wx) in [(55, 15), (55, 22), (101, 15), (101, 22)]:
    t = (FX0 - wx) / (FX0 - 10)
    off = round(4 * t)
    for x in range(wx, wx + 4):
        for y in range(wy + off, wy + off + 16):
            px[x, y] = DARKG if x > wx else OUT

# ---- main front
rect(FX0, 32, FX1, 143, ST)
# subtle tone variation
random.seed(3)
for _ in range(300):
    x = random.randint(FX0 + 1, FX1 - 1); y = random.randint(40, 142)
    px[x, y] = ST2
d.line([FX0, 32, FX0, 143], fill=OUT); d.line([FX1, 32, FX1, 143], fill=OUT)
# cornice
rect(FX0 - 2, 29, FX1 + 2, 30, CAP); d.line([FX0 - 2, 28, FX1 + 2, 28], fill=OUT)
rect(FX0 - 1, 31, FX1 + 1, 35, BONE); rect(FX0 - 1, 36, FX1 + 1, 37, BONE2)
d.line([FX0 - 1, 38, FX1 + 1, 38], fill=BONE3); d.line([FX0, 39, FX1, 39], fill=OUT)
for x in range(FX0 + 1, FX1, 4):   # dentils
    px[x, 36] = BONE3
# quoins
y = 40; k = 0
while y < 142:
    h = 6
    wq = 6 if k % 2 == 0 else 4
    y1 = min(y + h - 1, 142)
    rect(FX0 + 1, y, FX0 + wq, y1, BONE); d.line([FX0 + 1, y1, FX0 + wq, y1], fill=BONE3)
    d.line([FX0 + wq, y, FX0 + wq, y1], fill=BONE3)
    rect(FX1 - wq, y, FX1 - 1, y1, BONE); d.line([FX1 - wq, y1, FX1 - 1, y1], fill=BONE3)
    d.line([FX1 - wq, y, FX1 - wq, y1], fill=BONE2)
    y += h; k += 1
# floor band
rect(FX0, 87, FX1, 90, BONE); d.line([FX0, 91, FX1, 91], fill=BONE3); d.line([FX0, 86, FX1, 86], fill=BONE2)


def window(cx, y0, lit, w=14, h=20):
    x0 = cx - w // 2; x1 = x0 + w - 1; y1 = y0 + h - 1
    rect(x0 - 1, y0 - 2, x1 + 1, y0 - 1, BONE2)            # lintel
    box(x0, y0, x1, y1, FR)
    g = LIT if lit else DARKG
    g2 = LIT2 if lit else DARKG2
    rect(x0 + 2, y0 + 2, x1 - 2, y1 - 2, g)
    # recess shadow: left + top inner edge
    d.line([x0 + 2, y0 + 2, x1 - 2, y0 + 2], fill=g2); d.line([x0 + 2, y0 + 2, x0 + 2, y1 - 2], fill=g2)
    # sash bar + muntins
    my = (y0 + y1) // 2
    d.line([x0 + 2, my, x1 - 2, my], fill=FR)
    d.line([cx, y0 + 2, cx, y1 - 2], fill=FR)
    rect(x0 - 1, y1 + 1, x1 + 1, y1 + 2, BONE); d.line([x0 - 1, y1 + 3, x1 + 1, y1 + 3], fill=BONE3)

# upper windows: left dark, middle + right lit (T3: 3 lit + lobby; old T3 had upstairs-left dark)
window(47, 52, False)
window(70, 52, True)
window(93, 52, True)
# ground windows
window(44, 106, True)
window(96, 106, True)

# entrance bay (projects: shaded left face 3 px)
BX0, BX1 = 60, 83
rect(BX0 - 3, 92, BX0 - 1, 139, SIDE); d.line([BX0 - 4, 92, BX0 - 4, 139], fill=OUT)
rect(BX0, 92, BX1, 139, ST); d.line([BX1 + 1, 92, BX1 + 1, 139], fill=OUT)
rect(BX0 - 4, 92, BX1 + 2, 95, BONE); d.line([BX0 - 4, 96, BX1 + 2, 96], fill=BONE3); d.line([BX0 - 4, 91, BX1 + 2, 91], fill=OUT)
rect(BX0 - 3, 93, BX0 - 1, 95, BONE3)
# pilasters
rect(BX0, 97, BX0 + 2, 139, BONE2); rect(BX1 - 2, 97, BX1, 139, BONE2)
# arched transom + door
DX0, DX1 = 62, 81
cx = (DX0 + DX1) / 2
for x in range(DX0, DX1 + 1):
    dx = (x - cx) / ((DX1 - DX0) / 2)
    top = round(106 - 7 * (1 - dx * dx) ** 0.5)
    for y in range(top, 107):
        px[x, y] = LIT if y > top else OUT
    px[x, top - 1] = BONE
d.line([DX0, 107, DX1, 107], fill=FR)
for x in range(DX0 + 3, DX1, 4):
    d.line([x, 101, x, 106], fill=FR)
box(DX0, 108, DX1, 139, FR)
rect(DX0 + 2, 110, DX1 - 2, 139, (218, 190, 136, 255))
d.line([71, 110, 71, 139], fill=FR); d.line([72, 110, 72, 139], fill=FR)
# lobby hints (counter + floor)
rect(DX0 + 2, 128, DX1 - 2, 139, (196, 170, 120, 255))
rect(DX0 + 3, 126, DX0 + 8, 133, (150, 120, 90, 255))
px[69, 124] = FR; px[74, 124] = FR
d.line([69, 124, 69, 125], fill=FR)
# steps
rect(BX0 - 3, 140, BX1 + 3, 141, STEP); d.line([BX0 - 3, 140, BX1 + 3, 140], fill=BONE2)
rect(BX0 - 5, 142, BX1 + 5, 143, STEP2); d.line([BX0 - 5, 142, BX1 + 5, 142], fill=STEP)

# ---- ER wing
EX0, EX1 = 112, 173
rect(EX0, 92, EX1, 143, ST)
for _ in range(120):
    x = random.randint(EX0 + 1, EX1 - 1); y = random.randint(104, 142)
    px[x, y] = ST2
d.line([EX1, 88, EX1, 143], fill=OUT)
rect(EX0, 88, EX1, 89, CAP); d.line([EX0, 87, EX1, 87], fill=OUT)
# sign band (roof face)
box(EX0 + 1, 91, EX1 - 1, 103, BONE)
d.line([EX0 + 2, 102, EX1 - 2, 102], fill=BONE2)
# ER letters 5x7, centered at x ~142
E = ["#####", "#....", "#....", "####.", "#....", "#....", "#####"]
R = ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"]
lx = 136
for gi, g in enumerate([E, R]):
    for yy, row in enumerate(g):
        for xx, ch in enumerate(row):
            if ch == "#":
                px[lx + gi * 7 + xx, 94 + yy] = RED
# shadow under band onto wall
d.line([EX0 + 1, 104, EX1 - 1, 104], fill=SIDE)
# ER door (dark-framed glass double door), left of wing
QX0, QX1 = 113, 128
rect(QX0 - 1, 106, QX1 + 1, 107, BONE2)
box(QX0, 108, QX1, 139, OUT)
rect(QX0 + 2, 110, QX1 - 2, 139, (200, 172, 120, 255))
d.line([120, 110, 120, 139], fill=OUT); d.line([121, 110, 121, 139], fill=OUT)
d.line([QX0 + 2, 124, QX1 - 2, 124], fill=(60, 60, 62, 255))
rect(QX0 - 2, 140, QX1 + 2, 143, STEP2); d.line([QX0 - 2, 140, QX1 + 2, 140], fill=STEP)
# lamp above door (gooseneck)
d.line([121, 104, 121, 105], fill=IRON); rect(119, 105, 124, 106, IRON); d.line([120, 107, 123, 107], fill=(250, 226, 170, 255))

# ---- cross sign on roof
SX0, SX1, SY0, SY1 = 59, 82, 7, 26
d.line([61, SY1 + 1, 61, 28], fill=IRON); d.line([80, SY1 + 1, 80, 28], fill=IRON)
box(SX0, SY0, SX1, SY1, BOARD)
rect(SX0 + 1, SY0 + 1, SX1 - 1, SY0 + 1, (52, 62, 56, 255))
ccx, ccy = (SX0 + SX1) // 2, (SY0 + SY1) // 2
rect(ccx - 2, SY0 + 3, ccx + 3, SY1 - 3, GRN)
rect(ccx - 7, ccy - 2, ccx + 8, ccy + 3, GRN)

# ---- fire escape on the side wall
for (ry, py) in [(68, 80), (110, 122)]:
    d.line([2, ry, 25, ry], fill=IRON)
    for x in range(2, 26, 3):
        d.line([x, ry, x, py], fill=IRON)
    rect(1, py, 26, py + 1, IRON)
    d.line([2, py + 2, 26, py + 2], fill=(46, 46, 50, 255))
# stairs between landings
for i in range(0, 30):
    x = 6 + i * 16 // 30; y = 82 + i
    px[x, y] = IRON; px[x + 1, y] = IRON
    if i % 3 == 0:
        d.line([x - 3, y, x + 4, y], fill=IRON)
# drop ladder
d.line([20, 124, 20, 131], fill=IRON); d.line([24, 124, 24, 131], fill=IRON)
for y in range(125, 132, 2):
    d.line([20, y, 24, y], fill=IRON)

# ---- dumpster (front-left, in front of the side wall)
DGX0, DGX1 = 3, 25
box(DGX0, 126, DGX1, 141, (52, 72, 58, 255))
rect(DGX0 - 1, 124, DGX1 + 1, 126, (40, 56, 46, 255)); d.line([DGX0 - 1, 123, DGX1 + 1, 123], fill=OUT)
for x in range(DGX0 + 3, DGX1 - 1, 4):
    d.line([x, 128, x, 139], fill=(44, 62, 50, 255))
rect(DGX0 + 1, 142, DGX0 + 3, 143, OUT); rect(DGX1 - 3, 142, DGX1 - 1, 143, OUT)

# ---- bench under the left ground window
rect(34, 133, 54, 134, (78, 58, 42, 255)); d.line([34, 132, 54, 132], fill=OUT)
rect(34, 128, 54, 129, (78, 58, 42, 255)); d.line([34, 127, 54, 127], fill=OUT)
for x in (36, 52):
    d.line([x, 135, x, 143], fill=IRON); d.line([x, 129, x, 132], fill=IRON)


def shrub(x0, x1, ytop, seed):
    rnd = random.Random(seed)
    cxs = (x0 + x1) / 2; half = (x1 - x0) / 2
    tops = []
    for x in range(x0, x1 + 1):
        t = abs(x - cxs) / half
        base = ytop + round(8 * t * t)
        tops.append(base + rnd.choice([0, 0, 1, 2, -1]))
    for i, x in enumerate(range(x0, x1 + 1)):
        for y in range(tops[i], 144):
            r = rnd.random()
            px[x, y] = SHR3 if (y - tops[i] > 6 and r < 0.5) else (SHR2 if r < 0.25 and y - tops[i] < 4 else SHR)
        px[x, tops[i]] = OUT
    # ragged holes / twigs
    for _ in range(6):
        x = rnd.randint(x0 + 1, x1 - 1); y = rnd.randint(ytop + 2, 140)
        px[x, y] = SHR3

shrub(28, 38, 130, 11)
shrub(86, 97, 129, 23)
shrub(98, 108, 132, 37)

# ---- ambulance (enlarged from the old art)
amb = Image.open("amb_up.png").convert("RGBA")
bb = amb.getbbox()
amb = amb.crop(bb)
im.alpha_composite(amb, (EX1 - amb.width - 1, 143 - amb.height + 1))

im.save("hospital_layout_guide_176x144.png")
wb = Image.new("RGBA", (W, H), (255, 255, 255, 255)); wb.alpha_composite(im)
wb.save("hospital_layout_guide_176x144_whitebg.png")
im.resize((W * 4, H * 4), Image.NEAREST).save("guide_4x.png")
print(im.getbbox(), amb.size)

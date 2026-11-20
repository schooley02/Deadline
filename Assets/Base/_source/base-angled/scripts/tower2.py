"""Front tower (flush with the gable), bell moved into its belfry, old bell opening closed with siding,
big weathered wooden cross on the gable. Code layout first; PixelLab refines inside the silhouettes."""
import math
from PIL import Image, ImageDraw
YAW, ELEV, SC, X0, Y0 = math.radians(35), math.radians(8), 9.6, 96, 193
EAVE, RISE, WID = 9.6, 4.4, 12.0
def P(x, y, z):
    u = x * math.cos(YAW) + z * math.sin(YAW); v = -x * math.sin(YAW) + z * math.cos(YAW)
    return (X0 + SC * u, Y0 - SC * (y * math.cos(ELEV) + v * math.sin(ELEV)))
def roof_h(z): return EAVE + RISE * (1 - abs(z - WID / 2) / (WID / 2))

base = Image.open("base_100_v8.png").convert("RGBA")
im = base.copy(); px = im.load(); d = ImageDraw.Draw(im)
def lum(p): return .3 * p[0] + .59 * p[1] + .11 * p[2]

# --- 1. close the old bell opening (opening + its code trim) with siding cloned from the wall beside it
bx0, by0, bx1, by1 = 117, 70, 140, 101
src = base.load()
for y in range(by0, by1 + 1):
    for x in range(bx0, bx1 + 1):
        if not src[x, y][3]: continue
        # same row of clapboard, 14 px to the right on the gable (the facade rises 0.2 px per px)
        sx, sy = x + 14, y - 3
        if sx < 160 and src[sx, sy][3] and lum(src[sx, sy]) > 90:
            px[x, y] = src[sx, sy]
        else:
            sx, sy = x - 12, y + 2
            if src[sx, sy][3]: px[x, y] = src[sx, sy]
patch = Image.new("L", im.size, 0); ImageDraw.Draw(patch).rectangle([bx0 - 2, by0 - 2, bx1 + 2, by1 + 2], fill=255)

# --- 2. tower flush with the front: front face continues the gable wall, side face above the roof
Z0, Z1, XB = 3.6, 8.4, -4.6
TOP, CORN, APEX = 15.9, 16.3, 18.1
FRONT, FRONT2 = (176, 182, 196, 255), (148, 154, 170, 255)
SIDE, SIDE2 = (120, 128, 148, 255), (98, 106, 126, 255)
ROOF, ROOFL = (50, 56, 70, 255), (74, 82, 100, 255)
TRIM, OUT, DARK, SLAT = (204, 208, 218, 255), (26, 26, 36, 255), (22, 22, 30, 255), (66, 70, 84, 255)
sil = Image.new("L", im.size, 0); ds = ImageDraw.Draw(sil)
def face(pts, fill, out=OUT):
    q = [P(*p) for p in pts]; d.polygon(q, fill=fill, outline=out); ds.polygon(q, fill=255, outline=255)
yb = roof_h(Z0)
face([(0, yb, Z0), (0, TOP, Z0), (XB, TOP, Z0), (XB, yb, Z0)], SIDE)                    # side (shaded)
face([(0.05, yb - 0.6, Z0), (0.05, TOP, Z0), (0.05, TOP, Z1), (0.05, yb - 0.6, Z1)], FRONT)  # front (lit)
y = yb + 0.45
while y < TOP - 0.3:
    d.line([P(0, y, Z0), P(XB, y, Z0)], fill=SIDE2); d.line([P(0.05, y, Z0), P(0.05, y, Z1)], fill=FRONT2); y += 0.55
# belfry openings: front one shows the bell, side one louvered
B0, B1 = 13.9, 15.4
fz0, fz1, fm = Z0 + 1.0, Z1 - 1.0, (Z0 + Z1) / 2
q = [P(0.06, B0, fz0), P(0.06, B1, fz0), P(0.06, B1 + .7, fm), P(0.06, B1, fz1), P(0.06, B0, fz1)]
d.polygon(q, fill=DARK, outline=TRIM)
sx0, sx1, sm = -0.9, XB + 0.9, XB / 2
q2 = [P(sx0, B0, Z0), P(sx0, B1, Z0), P(sm, B1 + .7, Z0), P(sx1, B1, Z0), P(sx1, B0, Z0)]
d.polygon(q2, fill=DARK, outline=TRIM)
for k in range(4):
    yy = B0 + .3 + k * (B1 - B0) / 4
    d.line([P(sx0 - .15, yy, Z0), P(sx1 + .15, yy, Z0)], fill=SLAT)
# bell: lift the old bell's pixels (warm metal) and drop them in the front opening
bell = [(x, y, src[x, y]) for y in range(76, 98) for x in range(122, 136)
        if src[x, y][3] and src[x, y][0] > src[x, y][2] + 15 and lum(src[x, y]) > 40]
if bell:
    bxs = [x for x, _, _ in bell]; bys = [y for _, y, _ in bell]
    tx, ty = P(0.06, (B0 + B1) / 2 + .25, fm)
    ox, oy = round(tx - (min(bxs) + max(bxs)) / 2), round(ty - (min(bys) + max(bys)) / 2)
    for x, y, p in bell: px[x + ox, y + oy] = p
# sill under the front opening
d.line([P(0.08, B0 - .05, fz0 - .2), P(0.08, B0 - .05, fz1 + .2)], fill=TRIM)
# cornice + pyramid roof + finial
face([(0.3, TOP, Z0 - .3), (0.3, CORN, Z0 - .3), (XB - .3, CORN, Z0 - .3), (XB - .3, TOP, Z0 - .3)], TRIM)
face([(0.3, TOP, Z0 - .3), (0.3, CORN, Z0 - .3), (0.3, CORN, Z1 + .3), (0.3, TOP, Z1 + .3)], TRIM)
cx, cz = XB / 2, (Z0 + Z1) / 2
face([(0.4, CORN, Z0 - .4), (cx, APEX, cz), (XB - .4, CORN, Z0 - .4)], ROOF)
face([(0.4, CORN, Z0 - .4), (cx, APEX, cz), (0.4, CORN, Z1 + .4)], ROOFL)
ax, ay = P(cx, APEX, cz); d.line([(ax, ay), (ax, ay - 4)], fill=OUT); ds.line([(ax, ay), (ax, ay - 4)], fill=255)

# --- 3. big weathered wooden cross on the gable (in the wall plane: foreshortened, bar follows the wall slope)
WOOD, WOODL, WOODD = (112, 82, 56, 255), (146, 112, 78, 255), (70, 50, 36, 255)
cz0 = (Z0 + Z1) / 2
cross = Image.new("L", im.size, 0); dc = ImageDraw.Draw(cross)
def beam(pts, fill):
    q = [P(*p) for p in pts]; d.polygon(q, fill=fill, outline=OUT); dc.polygon(q, fill=255, outline=255)
CB, CT, AY = 9.5, 12.9, 12.0          # bottom, top, arm height (feet)
HW, AW = 0.32, 1.25                   # half widths: upright, arm reach
beam([(0.1, CB, cz0 - HW), (0.1, CT, cz0 - HW), (0.1, CT, cz0 + HW), (0.1, CB, cz0 + HW)], WOOD)
beam([(0.1, AY - .3, cz0 - AW), (0.1, AY + .3, cz0 - AW), (0.1, AY + .3, cz0 + AW), (0.1, AY - .3, cz0 + AW)], WOOD)
d.line([P(0.12, CB + .1, cz0 - HW + .1), P(0.12, CT - .1, cz0 - HW + .1)], fill=WOODL)      # lit edge
d.line([P(0.12, AY + .2, cz0 - AW + .1), P(0.12, AY + .2, cz0 + AW - .1)], fill=WOODL)
d.line([P(0.12, CB + .1, cz0 + HW - .08), P(0.12, CT - .1, cz0 + HW - .08)], fill=WOODD)

im.save("tower2_code.png"); sil.save("tower2_sil.png"); patch.save("tower2_patch.png"); cross.save("tower2_cross.png")
print("tower", sil.getbbox(), "cross", cross.getbbox())

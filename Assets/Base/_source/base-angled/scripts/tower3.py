"""v11: gable restored to a full triangle (old bell window closed with matching siding, peak cross removed),
one clean wooden cross on the gable, tower set just behind the peak: short clapboard base + OPEN belfry on
corner posts (see-through = transparent), bell centred, pyramid roof."""
import math
from PIL import Image, ImageDraw
YAW, ELEV, SC, X0, Y0 = math.radians(35), math.radians(8), 9.6, 96, 193
EAVE, RISE, WID = 9.6, 4.4, 12.0
def P(x, y, z):
    u = x * math.cos(YAW) + z * math.sin(YAW); v = -x * math.sin(YAW) + z * math.cos(YAW)
    return (X0 + SC * u, Y0 - SC * (y * math.cos(ELEV) + v * math.sin(ELEV)))
def roof_h(z): return EAVE + RISE * (1 - abs(z - WID / 2) / (WID / 2))
def lum(p): return .3 * p[0] + .59 * p[1] + .11 * p[2]

base = Image.open("base_100_v8s.png").convert("RGBA")
src = base.load()
bell_src = Image.open("base_100_v8.png").convert("RGBA").load()
im = base.copy(); px = im.load(); d = ImageDraw.Draw(im)
W, H = im.size

# ---- 1. close the old bell window + trim with siding sampled along the clapboard slope
HOLE = (116, 69, 141, 101)
def in_hole(x, y): return HOLE[0] <= x <= HOLE[2] and HOLE[1] <= y <= HOLE[3]
def wall_ok(p): return p[3] == 255 and lum(p) > 95 and abs(p[0] - p[2]) < 40
# ---- 2. remove the old cross above the peak (everything above the gable's roof line in that column band)
apx, apy = P(0, roof_h(6), 6)
for y in range(0, round(apy) - 1):
    for x in range(round(apx) - 8, round(apx) + 9):
        px[x, y] = (0, 0, 0, 0)

# ---- 3. one wooden cross on the gable, in the wall plane
WOOD, WOODL, WOODD, OUT = (110, 80, 54, 255), (146, 110, 76, 255), (72, 52, 38, 255), (30, 24, 22, 255)
cz = 6.0
def quad(pts, fill, outline=OUT): d.polygon([P(*p) for p in pts], fill=fill, outline=outline)
CB, CT, AY, HW, AW = 9.75, 13.05, 12.15, 0.3, 1.15
quad([(0.08, CB, cz - HW), (0.08, CT, cz - HW), (0.08, CT, cz + HW), (0.08, CB, cz + HW)], WOOD)
quad([(0.08, AY - .28, cz - AW), (0.08, AY + .28, cz - AW), (0.08, AY + .28, cz + AW), (0.08, AY - .28, cz + AW)], WOOD)
d.line([P(0.1, CB + .12, cz - HW + .12), P(0.1, AY - .3, cz - HW + .12)], fill=WOODL)
d.line([P(0.1, AY + .32, cz - HW + .12), P(0.1, CT - .12, cz - HW + .12)], fill=WOODL)
d.line([P(0.1, AY + .16, cz - AW + .12), P(0.1, AY + .16, cz - HW)], fill=WOODL)
d.line([P(0.1, AY + .16, cz + HW), P(0.1, AY + .16, cz + AW - .12)], fill=WOODL)
d.line([P(0.1, CB + .12, cz + HW - .1), P(0.1, AY - .3, cz + HW - .1)], fill=WOODD)

# ---- 4. tower just behind the peak
XF, XB, Z0, Z1 = -0.7, -4.1, 4.3, 7.7
BASE_TOP, BELL_TOP, CORN, APEX = 15.0, 16.9, 17.25, 18.7
SIDE, SIDE2 = (120, 128, 148, 255), (100, 108, 128, 255)
FRONT, FRONT2 = (178, 184, 198, 255), (150, 156, 172, 255)
ROOF, ROOFL, TRIM, POST, POSTL = (50, 56, 70, 255), (74, 82, 100, 255), (204, 208, 218, 255), (176, 180, 192, 255), (214, 218, 226, 255)
sil = Image.new("L", im.size, 0); ds = ImageDraw.Draw(sil)
holes = Image.new("L", im.size, 0); dh = ImageDraw.Draw(holes)
def face(pts, fill, outline=OUT):
    q = [P(*p) for p in pts]; d.polygon(q, fill=fill, outline=outline); ds.polygon(q, fill=255, outline=255)
# closed clapboard base (visible above the roof behind the peak)
face([(XF, roof_h(Z0), Z0), (XF, BASE_TOP, Z0), (XB, BASE_TOP, Z0), (XB, roof_h(Z0), Z0)], SIDE)
face([(XF, roof_h(Z0), Z0), (XF, roof_h(6), 6), (XF, roof_h(Z1), Z1), (XF, BASE_TOP, Z1), (XF, BASE_TOP, Z0)], FRONT)
for yy in (BASE_TOP - .45,):
    d.line([P(XF, yy, Z0), P(XB, yy, Z0)], fill=SIDE2); d.line([P(XF, yy, Z0), P(XF, yy, Z1)], fill=FRONT2)
# belt trim
face([(XF + .15, BASE_TOP, Z0 - .15), (XF + .15, BASE_TOP + .3, Z0 - .15), (XB - .15, BASE_TOP + .3, Z0 - .15), (XB - .15, BASE_TOP, Z0 - .15)], TRIM)
face([(XF + .15, BASE_TOP, Z0 - .15), (XF + .15, BASE_TOP + .3, Z0 - .15), (XF + .15, BASE_TOP + .3, Z1 + .15), (XF + .15, BASE_TOP, Z1 + .15)], TRIM)
# open belfry: the volume between belt and cornice is see-through, except posts, rail and bell
b0, b1 = BASE_TOP + .3, BELL_TOP
q_side = [P(XF, b0, Z0), P(XF, b1, Z0), P(XB, b1, Z0), P(XB, b0, Z0)]
q_front = [P(XF, b0, Z0), P(XF, b1, Z0), P(XF, b1, Z1), P(XF, b0, Z1)]
for q in (q_side, q_front):
    d.polygon(q, fill=(0, 0, 0, 0)); ds.polygon(q, fill=255); dh.polygon(q, fill=255)
# bell, centred in the belfry volume, hanging from a yoke under the cornice
warm = {(x, y) for y in range(76, 98) for x in range(121, 137)
        if bell_src[x, y][3] and bell_src[x, y][0] > bell_src[x, y][2] + 12 and lum(bell_src[x, y]) > 35}
ring = {(x + dx, y + dy) for (x, y) in warm for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
bell = [(x, y, bell_src[x, y]) for (x, y) in ring if bell_src[x, y][3] and ((x, y) in warm or lum(bell_src[x, y]) < 60)]
cx_, cz_ = (XF + XB) / 2, (Z0 + Z1) / 2
fl, fr = P(XF, 0, Z0)[0], P(XF, 0, Z1)[0]
bx, by = (fl + fr) / 2, P(XF, (b0 + b1) / 2 - .05, cz_)[1]
xs = [x for x, _, _ in bell]; ys = [y for _, y, _ in bell]
ox, oy = round(bx - (min(xs) + max(xs)) / 2), round(by - (min(ys) + max(ys)) / 2)
for x, y, p in bell:
    px[x + ox, y + oy] = p; holes.putpixel((x + ox, y + oy), 0)
yk0, yk1 = (round(bx), round(P(XF, b1 - .05, cz_)[1])), (round(bx), min(ys) + oy - 1)
d.line([yk0, yk1], fill=OUT)
for yy in range(round(yk0[1]), yk1[1] + 1): holes.putpixel((round(bx), yy), 0)
# rail along the bottom of each opening + corner posts (visible corners: front-left, front-right, back-left)
def thick(a, b, c, wpx=2):
    d.line([a, b], fill=c, width=wpx); ds.line([a, b], fill=255, width=wpx); dh.line([a, b], fill=0, width=wpx)
thick(P(XF, b0 + .45, Z0), P(XB, b0 + .45, Z0), POST, 1)
thick(P(XF, b0 + .45, Z0), P(XF, b0 + .45, Z1), POSTL, 1)
for (xx, zz, c) in ((XF, Z0, POSTL), (XF, Z1, POSTL), (XB, Z0, POST)):
    thick(P(xx, b0, zz), P(xx, b1, zz), c, 2)
for (xx, zz) in ((XF, Z0), (XF, Z1), (XB, Z0)):
    a, b = P(xx, b0, zz), P(xx, b1, zz)
    d.line([(a[0] - 1, a[1]), (b[0] - 1, b[1])], fill=OUT)
# cornice + pyramid roof (flared eave a little wider than the posts)
face([(XF + .35, b1, Z0 - .35), (XF + .35, CORN, Z0 - .35), (XB - .35, CORN, Z0 - .35), (XB - .35, b1, Z0 - .35)], TRIM)
face([(XF + .35, b1, Z0 - .35), (XF + .35, CORN, Z0 - .35), (XF + .35, CORN, Z1 + .35), (XF + .35, b1, Z1 + .35)], TRIM)
face([(XF + .55, CORN, Z0 - .55), (cx_, APEX, cz_), (XB - .55, CORN, Z0 - .55)], ROOF)
face([(XF + .55, CORN, Z0 - .55), (cx_, APEX, cz_), (XF + .55, CORN, Z1 + .55)], ROOFL)
ax, ay = P(cx_, APEX, cz_); d.line([(ax, ay), (ax, ay - 3)], fill=OUT); ds.line([(ax, ay), (ax, ay - 3)], fill=255)
# the gable's front roof edges run in front of the tower base all the way to the peak: redraw them on top
for x in range(W):
    for y in range(H):
        if sil.getpixel((x, y)) and src[x, y][3] and y >= P(0, roof_h(6), 6)[1] - 1:
            # pixel of the original roof/gable that is in front of the tower base
            gx0, gy0 = P(0, EAVE, 0); gx1, gy1 = P(0, roof_h(6), 6); gx2, gy2 = P(0, EAVE, WID)
            pass
im.save("tower3_code.png"); import json; json.dump(bell and [[x+ox,y+oy,list(p)] for x,y,p in bell], open("tower3_bell.json","w")); sil.save("tower3_sil.png"); holes.save("tower3_holes.png")
print("tower bbox", sil.getbbox(), "apex y", round(ay))

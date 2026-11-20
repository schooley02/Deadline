"""v3: layout guide from a real 3D model (feet) projected orthographically, so proportions are consistent.
Front gable faces +x (toward the lanes); building runs to -x (off-screen left). Near corner = (0,0,0)."""
import math
from PIL import Image, ImageDraw

YAW, ELEV = math.radians(30), math.radians(25)
SC = 10.4                         # px per foot
X0, Y0 = 92, 193                  # screen pos of the near corner (ground)
W_, H_ = 160, 200

# model, feet
WID = 12.0       # front width (z)
LEN = 40.0       # long side (x, toward -x), runs off-screen
EAVE = 9.6
RISE = 3.6       # roof rise at the ridge (6/12-ish pitch)
FOUND = 1.0
SILL = 1.8       # door sill on the steps
DOOR_W, DOOR_H = 3.4, 7.0
CROSS = 1.5


def P(x, y, z):
    u = x * math.cos(YAW) + z * math.sin(YAW)
    v = -x * math.sin(YAW) + z * math.cos(YAW)
    return (X0 + SC * u, Y0 - SC * (y * math.cos(ELEV) + v * math.sin(ELEV)))


im = Image.new("RGBA", (W_, H_), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
OUT = (24, 24, 32, 255)
FAC, FAC2 = (198, 200, 206, 255), (172, 174, 184, 255)
SID, SID2 = (132, 136, 152, 255), (114, 118, 134, 255)
ROOF, ROOF2 = (58, 58, 66, 255), (46, 46, 54, 255)
STONE, STONE2 = (98, 96, 102, 255), (80, 78, 84, 255)
DOOR, DOOR2 = (120, 54, 46, 255), (84, 36, 34, 255)
BOARD, BOARD2 = (112, 90, 66, 255), (84, 66, 48, 255)
SLIT = (12, 12, 18, 255)
SAND, SAND2 = (146, 134, 104, 255), (116, 106, 82, 255)
BELL = (150, 118, 60, 255)
LAMP = (238, 188, 104, 255)
STEP = (136, 134, 138, 255)
FLAG, STAR = (134, 54, 46, 255), (214, 208, 196, 255)
CROSSC = (205, 205, 210, 255)


def poly(pts3, fill, out=OUT):
    d.polygon([P(*p) for p in pts3], fill=fill, outline=out)


def line(a, b, c):
    d.line([P(*a), P(*b)], fill=c)


# roof: south slope from eave (z=0) to ridge (z=WID/2), x from 0.6 (overhang) to -LEN
OV = 0.6
poly([(OV, EAVE, -OV), (OV, EAVE + RISE, WID / 2), (-LEN, EAVE + RISE, WID / 2), (-LEN, EAVE, -OV)], ROOF)
for k in range(1, 6):
    t = k / 6
    line((OV, EAVE + RISE * t, -OV + (WID / 2 + OV) * t), (-LEN, EAVE + RISE * t, -OV + (WID / 2 + OV) * t), ROOF2)
# side wall (z=0), shaded white clapboard
poly([(0, 0, 0), (0, EAVE, 0), (-LEN, EAVE, 0), (-LEN, 0, 0)], SID)
y = FOUND + 0.7
while y < EAVE - 0.2:
    line((0, y, 0), (-LEN, y, 0), SID2); y += 0.7
poly([(0, 0, 0), (0, FOUND, 0), (-LEN, FOUND, 0), (-LEN, 0, 0)], STONE)
for wx in (-4.5, -11.5, -18.5):   # tall pointed windows, boarded, gun slit
    w0, w1 = wx - 1.4, wx + 1.4
    poly([(w1, 3.0, 0), (w1, 7.0, 0), (wx, 8.0, 0), (w0, 7.0, 0), (w0, 3.0, 0)], BOARD)
    for yy in (3.8, 4.8, 5.8, 6.8):
        line((w1, yy, 0), (w0, yy, 0), BOARD2)
    poly([(wx + .5, 5.2, 0), (wx - .5, 5.2, 0), (wx - .5, 5.5, 0), (wx + .5, 5.5, 0)], SLIT, SLIT)
# re-draw roof eave edge over the wall top
line((OV, EAVE, -OV), (-LEN, EAVE, -OV), OUT)
# front gable wall (x=0), lit
poly([(0, 0, 0), (0, EAVE, 0), (0, EAVE + RISE, WID / 2), (0, EAVE, WID), (0, 0, WID)], FAC)
y = FOUND + 0.7
while y < EAVE + RISE - 0.4:
    zc = (y - EAVE) / RISE * (WID / 2) if y > EAVE else 0
    line((0, y, max(zc, 0) + 0.1), (0, y, WID - max(zc, 0) - 0.1), FAC2); y += 0.7
poly([(0, 0, 0), (0, FOUND, 0), (0, FOUND, WID), (0, 0, WID)], STONE)
# gable fascia
line((0.3, EAVE, -OV), (0.3, EAVE + RISE + .2, WID / 2), OUT)
line((0.3, EAVE + RISE + .2, WID / 2), (0.3, EAVE, WID + OV), OUT)
# bell in an arched opening in the gable, cross on the apex
zc = WID / 2
poly([(0, EAVE - .2, zc - 1.1), (0, EAVE + 1.6, zc - 1.1), (0, EAVE + 2.3, zc), (0, EAVE + 1.6, zc + 1.1), (0, EAVE - .2, zc + 1.1)], SLIT)
poly([(0.1, EAVE + .1, zc - .7), (0.1, EAVE + 1.1, zc - .5), (0.1, EAVE + 1.5, zc), (0.1, EAVE + 1.1, zc + .5), (0.1, EAVE + .1, zc + .7)], BELL)
line((0.2, EAVE + RISE + .2, zc), (0.2, EAVE + RISE + .2 + CROSS, zc), CROSSC)
line((0.2, EAVE + RISE + .2 + CROSS * .65, zc - .5), (0.2, EAVE + RISE + .2 + CROSS * .65, zc + .5), CROSSC)
# door (pointed arch), centred
z0, z1 = zc - DOOR_W / 2, zc + DOOR_W / 2
poly([(0, SILL, z0), (0, SILL + DOOR_H - .9, z0), (0, SILL + DOOR_H, zc), (0, SILL + DOOR_H - .9, z1), (0, SILL, z1)], DOOR)
line((0.05, SILL, zc), (0.05, SILL + DOOR_H - .05, zc), DOOR2)
line((0.1, SILL + 3.0, z0 - .3), (0.1, SILL + 3.6, z0 + .6), BOARD)
line((0.1, SILL + 3.0, z1 + .3), (0.1, SILL + 3.6, z1 - .6), BOARD)
# lantern beside the door
poly([(0.1, SILL + 4.0, z0 - 1.4), (0.1, SILL + 4.7, z0 - 1.4), (0.1, SILL + 4.7, z0 - .9), (0.1, SILL + 4.0, z0 - .9)], LAMP)
# steps toward the lanes
for i in range(3):
    top = SILL - i * 0.6
    depth = 0.9 * (i + 1)
    sz0, sz1 = z0 - 0.8, z1 + 0.8
    poly([(0, top, sz0), (depth, top, sz0), (depth, top, sz1), (0, top, sz1)], STEP)       # tread
    poly([(depth, top, sz0), (depth, top - .6, sz0), (depth, top - .6, sz1), (depth, top, sz1)], STONE)  # riser
    poly([(depth, top, sz0), (depth, top - .6, sz0), (0, top - .6, sz0), (0, top, sz0)], STONE2)
# sandbags along the side wall foot and by the steps
def bag(x, z, c):
    cx, cy = P(x, 0.45, z)
    d.ellipse([cx - 3.5, cy - 3, cx + 3.5, cy + 3], fill=c, outline=OUT)
for i, x in enumerate([-6 + k * 0.85 for k in range(8)]):
    bag(x, -0.6, SAND if i % 2 else SAND2)
for i, z in enumerate([z0 - 2.6, z0 - 1.8, z1 + 1.8, z1 + 2.6]):
    bag(0.9, z, SAND2 if i % 2 else SAND)
# flag on a pole at the front-right corner
fb = P(0.3, EAVE, -0.3)
d.line([fb, (fb[0], fb[1] - 26)], fill=OUT)
fx, fyy = fb[0] + 1, fb[1] - 26
d.polygon([(fx - 1, fyy), (fx - 13, fyy + 2), (fx - 13, fyy + 10), (fx - 1, fyy + 8)], fill=FLAG, outline=OUT)
for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
    im.putpixel((int(fx - 7 + dx), int(fyy + 5 + dy)), STAR)

im.save("guide3_160x200.png")
print("bbox", im.getbbox(), "facade x", P(0, 0, 0)[0], P(0, 0, WID)[0], "door h rows", P(0, SILL, zc)[1] - P(0, SILL + DOOR_H, zc)[1])

rev = Image.new("RGBA", (220, H_), (30, 32, 44, 255))
rev.paste(im, (0, 0), im)
bar = Image.open("/mnt/user-data/uploads/Deadline/Assets/Barricade/barricade_reinforced.png").convert("RGBA").resize((40, 76), Image.NEAREST)
rev.paste(bar, (155, H_ - 79), bar)
zm = Image.open("/mnt/user-data/uploads/Deadline/Assets/Zombies/health-zombie-64.png").convert("RGBA")
rev.paste(zm, (176, H_ - 67), zm)
rd = ImageDraw.Draw(rev)
for yy in range(0, H_, 6):
    rd.line([(88, yy), (88, yy + 3)], fill=(230, 60, 60, 255))
for xx in range(0, 220, 6):
    rd.line([(xx, 29), (xx + 3, 29)], fill=(80, 200, 255, 255))
rev.resize((rev.width * 3, rev.height * 3), Image.NEAREST).save("guide3_review.png")

"""v2 layout guide, 160x200 art px (2x in game). White country church turned survivor base.
Front faces right, receding at ~the barricade's slope (0.8 px up per px right); long side runs left.
Bell sits low in the tower (just above the roof), short spire + cross on top. Cross tip >= row 30."""
from PIL import Image, ImageDraw

W, H = 160, 200
S = 0.8                     # facade slope (barricade is ~1.0)
NX, NY = 104, 193           # near corner, ground
im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
px = im.load()

OUT = (24, 24, 32, 255)
FAC = (196, 198, 204, 255); FAC2 = (168, 170, 180, 255)       # lit white clapboard
SID = (128, 132, 148, 255); SID2 = (110, 114, 130, 255)       # shaded white side
ROOF = (54, 54, 62, 255); ROOF2 = (44, 44, 52, 255)
TRIM = (90, 92, 104, 255)
STONE = (96, 94, 100, 255); STONE2 = (76, 74, 80, 255)
DOOR = (118, 52, 44, 255); DOOR2 = (84, 36, 34, 255)
BOARD = (112, 90, 66, 255); BOARD2 = (84, 66, 48, 255)
SLIT = (12, 12, 18, 255)
SAND = (146, 134, 104, 255); SAND2 = (116, 106, 82, 255)
TIN = (104, 100, 96, 255); TIN2 = (78, 74, 72, 255)
CRATE = (110, 84, 58, 255); BARREL = (72, 82, 74, 255)
BELL = (150, 118, 60, 255); BELL2 = (104, 78, 40, 255)
FLAG = (134, 54, 46, 255); STAR = (214, 208, 196, 255)
LAMP = (238, 188, 104, 255)
STEP = (130, 128, 132, 255)


def poly(pts, fill, out=OUT):
    d.polygon(pts, fill=fill, outline=out)


def fy(x, y_at_near):           # point on a facade-parallel line
    return y_at_near - S * (x - NX)


def sy(x, y_at_near, drop=0.08):  # point on a side-parallel line (recedes slightly up-left)
    return y_at_near - drop * (NX - x)


# ---- roof (side plane)
APX, APY = 124, round(fy(124, 112) - 22)
poly([(NX, 112), (APX, APY), (8, APY + 6), (0, 113 - 4), (0, 116)], ROOF)
for k in range(1, 7):
    t = k / 7
    y0 = 109 + (APY - 109) * t; x0 = NX + (APX - NX) * t
    d.line([(x0, y0), (0, 113 + (APY + 6 - 113) * t)], fill=ROOF2)
# ---- long side wall (shaded white clapboard)
poly([(NX, 112), (NX, NY), (0, round(sy(0, NY))), (0, round(sy(0, 112)))], SID)
for y in range(112, NY - 10, 3):
    d.line([(1, sy(0, y)), (NX - 1, y)], fill=SID2)
poly([(NX, NY - 10), (NX, NY), (0, round(sy(0, NY))), (0, round(sy(0, NY - 10)))], STONE)
for wx in (14, 40, 66):          # tall arched windows, boarded, gun slit
    t0 = sy(wx, 124)
    poly([(wx, t0 + 6), (wx + 5, t0), (wx + 10, t0 + 6), (wx + 10, t0 + 44), (wx, t0 + 44)], BOARD)
    for yy in range(int(t0 + 9), int(t0 + 44), 6):
        d.line([(wx + 1, yy), (wx + 9, yy)], fill=BOARD2)
    d.rectangle([wx + 3, t0 + 20, wx + 7, t0 + 22], fill=SLIT)
# ---- front gable wall (lit white clapboard)
FX1 = 144
poly([(NX, 112), (APX, APY), (FX1, round(fy(FX1, 112))), (FX1, round(fy(FX1, NY))), (NX, NY)], FAC)
for y in range(APY + 4, NY - 8, 3):
    for x in range(NX + 1, FX1):
        yy = round(fy(x, y))
        if px[x, yy] == FAC:
            px[x, yy] = FAC2
poly([(NX, NY - 9), (FX1, round(fy(FX1, NY - 9))), (FX1, round(fy(FX1, NY))), (NX, NY)], STONE)
# corner boards
d.line([(NX, 109), (NX, NY)], fill=TRIM)
# lantern left of the door (the only light fixture)
d.rectangle([109, 132, 112, 137], fill=LAMP, outline=OUT)
# ---- door: tall pointed arch on the facade plane, raised on steps
DL, DR = 117, 131
SILL = 176
poly([(DL, round(fy(DL, SILL))), (DL, round(fy(DL, SILL - 66))), (124, round(fy(124, SILL - 74))),
      (DR, round(fy(DR, SILL - 66))), (DR, round(fy(DR, SILL)))], DOOR)
d.line([(124, fy(124, SILL - 73)), (124, fy(124, SILL))], fill=DOOR2)
for x in (DL, DR):   # planks nailed across the door edges
    d.line([(x - 2, fy(x, SILL - 30) + 2), (x + 3, fy(x, SILL - 34))], fill=BOARD)
# steps out toward the lanes (down-right)
for i in range(3):
    ox, oy = 4 + i * 4, 4 + i * 5
    poly([(DL - 3 + ox, fy(DL - 3, SILL + 2) + oy - 4), (DR + 3 + ox, fy(DR + 3, SILL + 2) + oy - 4),
          (DR + 3 + ox, fy(DR + 3, SILL + 2) + oy), (DL - 3 + ox, fy(DL - 3, SILL + 2) + oy)], STEP)
# sandbags flanking the steps + along the near corner
for x in range(66, 112, 6):
    y = sy(x, NY) + 1
    d.ellipse([x, y - 7, x + 7, y], fill=SAND if (x // 6) % 2 else SAND2, outline=OUT)
for x in (136, 142):
    y = fy(x, NY) + 2
    d.ellipse([x, y - 7, x + 7, y], fill=SAND2, outline=OUT)
# ---- tower on the front, bell low (just above the roof line), spire + cross on top
TL, TR = 117, 131
TB = 90                                   # tower bottom (left edge y)
BEL0, BEL1 = 88, 72                       # belfry opening
CORN = 68
poly([(TL - 6, TB + 3), (TL, TB), (TL, CORN - 2), (TL - 6, CORN + 1)], SID)          # tower side
poly([(TL, TB), (TR, round(TB - S * (TR - TL))), (TR, round(CORN - S * (TR - TL))), (TL, CORN)], FAC)
# belfry opening with the bell
poly([(TL + 3, BEL0), (TR - 3, round(BEL0 - S * 11)), (TR - 3, round(BEL1 - S * 11 + 4)),
      (124, round(BEL1 - S * 7)), (TL + 3, BEL1 + 2)], SLIT)
bx, by = 124, round(BEL0 - S * 7) - 12
poly([(bx - 4, by + 8), (bx - 3, by + 1), (bx, by - 1), (bx + 3, by + 1), (bx + 4, by + 8)], BELL)
d.line([(bx - 4, by + 8), (bx + 4, by + 8)], fill=BELL2)
# sandbags on the belfry sill (lookout)
for x in range(TL + 2, TR - 2, 5):
    y = BEL0 - S * (x - TL) + 1
    d.ellipse([x, y - 4, x + 5, y], fill=SAND, outline=OUT)
# cornice
poly([(TL - 7, CORN + 1), (TR + 1, round(CORN - S * (TR - TL)) - 1), (TR + 1, round(CORN - S * (TR - TL)) - 4),
      (TL - 7, CORN - 2)], TRIM)
# spire
mid = round(CORN - S * 7) - 3
TIP = mid - 12
poly([(TL - 7, CORN - 2), (124, TIP), (TR + 1, round(CORN - S * (TR - TL)) - 4)], ROOF)
d.line([(124, TIP), (124, mid + 2)], fill=ROOF2)
# cross
d.line([(124, TIP - 9), (124, TIP)], fill=(200, 200, 206, 255), width=1)
d.line([(121, TIP - 6), (127, TIP - 6)], fill=(200, 200, 206, 255))
# flag on a short pole lashed to the belfry corner
d.line([(TR + 2, round(BEL0 - S * 16)), (TR + 2, round(BEL1 - S * 16) - 6)], fill=OUT)
poly([(TR + 3, round(BEL1 - S * 16) - 6), (TR + 15, round(BEL1 - S * 16) - 8), (TR + 15, round(BEL1 - S * 16)),
      (TR + 3, round(BEL1 - S * 16) + 2)], FLAG)
fx, fyy = TR + 9, round(BEL1 - S * 16) - 3
for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
    px[fx + dx, fyy + dy] = STAR
# gable fascia (shows the angle)
d.line([(NX, 112), (APX, APY)], fill=TRIM)
d.line([(APX, APY), (FX1, round(fy(FX1, 112)))], fill=TRIM)
d.line([(FX1, round(fy(FX1, 112))), (FX1, round(fy(FX1, NY)))], fill=OUT)
# ---- tin lean-to + supplies on the side wall (croppable)
poly([(2, 152), (58, 147), (60, 151), (4, 156)], TIN)
for x in range(8, 58, 6):
    d.line([(x, 153 - x * 0.09), (x + 1, 156 - x * 0.09)], fill=TIN2)
d.line([(6, 156), (6, 186)], fill=OUT); d.line([(56, 150), (56, 188)], fill=OUT)
d.rectangle([12, 170, 26, 187], fill=CRATE, outline=OUT)
d.rectangle([14, 158, 24, 170], fill=CRATE, outline=OUT)
d.rectangle([30, 166, 40, 188], fill=BARREL, outline=OUT)
d.rectangle([42, 166, 52, 189], fill=BARREL, outline=OUT)

im.save("guide2_160x200.png")
print("top opaque row", im.getbbox())

rev = Image.new("RGBA", (220, H), (30, 32, 44, 255))
rev.paste(im, (0, 0), im)
bar = Image.open("/mnt/user-data/uploads/Deadline/Assets/Barricade/barricade_reinforced.png").convert("RGBA").resize((40, 76), Image.NEAREST)
rev.paste(bar, (155, H - 79), bar)
z = Image.open("/mnt/user-data/uploads/Deadline/Assets/Zombies/health-zombie-64.png").convert("RGBA")
rev.paste(z, (176, H - 67), z)
rd = ImageDraw.Draw(rev)
for y in range(0, H, 6):
    rd.line([(88, y), (88, y + 3)], fill=(230, 60, 60, 255))
for x in range(0, 220, 6):
    rd.line([(x, 29), (x + 3, 29)], fill=(80, 200, 255, 255))   # small-phone landscape top
rev.resize((rev.width * 3, rev.height * 3), Image.NEAREST).save("guide2_review.png")

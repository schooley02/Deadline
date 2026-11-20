"""Angled survivor-church layout guide, 160x200 art px (drawn 2x in game).
Front (door) faces right toward the lanes, foreshortened at the barricade's slope;
the long side wall runs left and can be cropped off-screen. Core = x >= 88."""
from PIL import Image, ImageDraw

W, H = 160, 200
im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(im)

OUT = (10, 10, 24, 255)
WALL = (111, 95, 108, 255)     # facade (lit, faces the lanes)
SIDE = (74, 68, 86, 255)       # long side wall (shade)
ROOF = (34, 36, 53, 255)
ROOF2 = (40, 43, 62, 255)
TOWER = (99, 89, 109, 255)
TOWERS = (65, 60, 74, 255)
DOOR = (125, 67, 55, 255)
DOORD = (86, 34, 38, 255)
STONE = (81, 76, 97, 255)
STEP = (91, 81, 102, 255)
BOARD = (105, 82, 60, 255)
BOARD2 = (80, 62, 46, 255)
SLIT = (5, 6, 14, 255)
GLASS = (60, 90, 140, 255)
GLASS2 = (150, 60, 50, 255)
SAND = (150, 138, 104, 255)
SAND2 = (118, 108, 82, 255)
TIN = (96, 92, 88, 255)
TIN2 = (70, 66, 64, 255)
CRATE = (112, 84, 56, 255)
BARREL = (70, 80, 72, 255)
FLAG = (138, 52, 44, 255)
WHITE = (220, 214, 200, 255)
LAMP = (240, 190, 100, 255)


def poly(pts, fill, out=OUT):
    d.polygon(pts, fill=fill, outline=out)


def facade_y(x, y0):
    """y on a line that rises 0.4 px per px to the right (the barricade slope)."""
    return y0 - 0.4 * (x - 100)


# ---- roof over the long side (ridge recedes left)
poly([(100, 104), (125, 64), (20, 72), (0, 76), (0, 110)], ROOF)
for i in range(6):  # shingle rows
    d.line([(100 - i * 0, 104 - i * 7), (0, 110 - i * 6)], fill=ROOF2)
# ---- long side wall (shade), recedes left
poly([(100, 104), (100, 192), (0, 186), (0, 110)], SIDE)
d.line([(100, 180), (0, 176)], fill=STONE)  # stone footing line
poly([(100, 180), (100, 192), (0, 186), (0, 176)], STONE)
# boarded side windows with gun slits
for wx in (12, 38, 64):
    top = 122 + (100 - wx) * 0.05
    poly([(wx, top + 6), (wx + 5, top), (wx + 10, top + 6), (wx + 10, top + 40), (wx, top + 40)], BOARD)
    for yy in range(int(top + 10), int(top + 40), 6):
        d.line([(wx + 1, yy), (wx + 9, yy)], fill=BOARD2)
    d.rectangle([wx + 3, top + 18, wx + 7, top + 20], fill=SLIT)
# ---- front gable + facade (foreshortened, faces the lanes)
poly([(100, 104), (125, 64), (150, 84), (150, 172), (100, 192)], WALL)
poly([(100, 182), (150, 162), (150, 172), (100, 192)], STONE)
# narrow lancet window left of the door, lower half boarded
poly([(104, 128), (107, 122), (110, 126), (110, 150), (104, 152)], GLASS)
poly([(104, 140), (110, 138), (110, 150), (104, 152)], BOARD)
# lantern by the door
d.rectangle([111, 128, 113, 132], fill=LAMP, outline=OUT)
# ---- bell tower converted to a lookout, on the front, over the door
poly([(106, 32), (113, 28), (113, 92), (106, 96)], TOWERS)       # tower side
poly([(113, 28), (137, 18), (137, 82), (113, 92)], TOWER)        # tower front
poly([(117, 36), (125, 30), (133, 30), (133, 50), (117, 56)], SLIT)  # open belfry
# sandbag parapet on the tower top
for i, x in enumerate(range(106, 138, 5)):
    y = (32 - (x - 106) * 0.25) if x < 113 else (28 - 0.4 * (x - 113))
    d.ellipse([x, y - 5, x + 5, y], fill=SAND if i % 2 else SAND2, outline=OUT)
# flag (rust red, white star) on a short pole at the right corner
d.line([(137, 18), (137, 8)], fill=OUT)
poly([(138, 8), (152, 6), (152, 14), (138, 16)], FLAG)
d.point((145, 10), fill=WHITE); d.point((144, 11), fill=WHITE); d.point((146, 11), fill=WHITE)
# ---- door (tall, pointed arch, on the facade slope) + steps
poly([(118, 175), (118, 105), (125, 96), (132, 100), (132, 169)], DOOR)
d.line([(125, 97), (125, 172)], fill=DOORD)
poly([(112, 186), (112, 180), (140, 169), (150, 173), (150, 180), (122, 193)], STEP)
d.line([(114, 184), (146, 172)], fill=STONE)
d.line([(117, 188), (149, 176)], fill=STONE)
# ---- sandbag walls flanking the steps and along the near corner
for x in range(70, 112, 6):
    y = 190 - (x - 70) * 0.05
    d.ellipse([x, y - 7, x + 7, y], fill=SAND if (x // 6) % 2 else SAND2, outline=OUT)
for x in range(74, 108, 6):
    y = 184 - (x - 74) * 0.05
    d.ellipse([x, y - 7, x + 7, y], fill=SAND2 if (x // 6) % 2 else SAND, outline=OUT)
# ---- lean-to + supplies against the side wall (croppable)
poly([(2, 150), (58, 142), (60, 146), (4, 154)], TIN)
for x in range(6, 58, 6):
    d.line([(x, 151 - x * 0.14), (x + 1, 154 - x * 0.14)], fill=TIN2)
d.line([(6, 154), (6, 186)], fill=OUT); d.line([(56, 146), (56, 186)], fill=OUT)
d.rectangle([12, 168, 26, 186], fill=CRATE, outline=OUT)
d.rectangle([14, 156, 24, 168], fill=CRATE, outline=OUT)
d.rectangle([30, 164, 40, 186], fill=BARREL, outline=OUT)
d.rectangle([42, 164, 52, 186], fill=BARREL, outline=OUT)

im.save("guide_160x200.png")

# review sheet: crop line, barricade + zombie in place, 3x
rev = Image.new("RGBA", (220, H), (30, 32, 44, 255))
rev.paste(im, (0, 0), im)
bar = Image.open("/mnt/user-data/uploads/Deadline/Assets/Barricade/barricade_reinforced.png").convert("RGBA")
bar = bar.resize((40, 76), Image.NEAREST)  # barricade is drawn 1:1 on screen = half size in church art px
rev.paste(bar, (155, 200 - 76 - 3), bar)
z = Image.open("/mnt/user-data/uploads/Deadline/Assets/Zombies/health-zombie-64.png").convert("RGBA")
z = z.transpose(Image.FLIP_LEFT_RIGHT) if False else z
rev.paste(z, (176, 200 - 64 - 3), z)
rd = ImageDraw.Draw(rev)
for y in range(0, H, 6):
    rd.line([(88, y), (88, y + 3)], fill=(230, 60, 60, 255))
rev = rev.resize((rev.width * 3, rev.height * 3), Image.NEAREST)
rev.save("guide_review.png")

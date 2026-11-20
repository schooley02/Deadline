"""Re-tone the church's white paint from moonlit light-blue to an aged warm white like the village's whites
(Clock tower trim median 205,200,186 -> ratio R1.03 G1.00 B0.93), a step darker than the tower so it isn't too bright.
Front faces (lit) warm white; side faces (shade) neutral white in shadow. Roofs, stone, glass, wood untouched."""
import colorsys, math, sys
from PIL import Image, ImageDraw
src_name, out_name, k_front, k_side = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
im = Image.open(src_name).convert("RGBA"); px = im.load(); W, H = im.size
YAW, ELEV, SC, X0, Y0 = math.radians(35), math.radians(8), 9.6, 96, 193
def P(x, y, z):
    u = x * math.cos(YAW) + z * math.sin(YAW); v = -x * math.sin(YAW) + z * math.cos(YAW)
    return (X0 + SC * u, Y0 - SC * (y * math.cos(ELEV) + v * math.sin(ELEV)))
keep = Image.new("L", im.size, 0); d = ImageDraw.Draw(keep)
d.polygon([P(0.7, 9.4, -0.7), P(0.7, 14.2, 6), P(-45, 14.2, 6), P(-45, 9.4, -0.7)], fill=255)   # main roof
d.rectangle([60, 0, 150, 30], fill=255)                                                         # tower roof + cornice band
pass  # statue skipped by colour (warm stone)
d.rectangle([108, 166, 160, 199], fill=255)                                                     # stone steps
sil = Image.open('tower3_sil.png').convert('L')
from PIL import ImageChops, ImageFilter
belfry_roof = Image.new('L', im.size, 0); ImageDraw.Draw(belfry_roof).rectangle([60, 0, 150, 30], fill=255)
keep = ImageChops.subtract(keep, ImageChops.subtract(sil, belfry_roof))
kp = keep.load()
def lum(p): return .3 * p[0] + .59 * p[1] + .11 * p[2]
FRONT = tuple(map(float, sys.argv[5].split(','))); SIDE = tuple(map(float, sys.argv[6].split(',')))
for y in range(H):
    for x in range(W):
        p = px[x, y]
        if p[3] == 0 or kp[x, y]: continue
        h, l, s = colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)
        if s > 0.3 or l < 0.24 or p[2] < p[0] - 2: continue      # only the blue-cast paint (sandbags, wood, stone stay)
        L = lum(p)
        front = (x >= 97 and y > 60) or (x > 114 and y <= 70)
        r, k = (FRONT, k_front) if front else (SIDE, k_side)
        px[x, y] = tuple(max(0, min(255, int(L * k * c))) for c in r) + (p[3],)
im.save(out_name)

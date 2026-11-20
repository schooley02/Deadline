"""Firelight from the burning threshold onto the steps, sandbags, boards, door and front wall (opaque warm light,
falls off with distance; the side wall around the corner only catches a little)."""
import math, colorsys
from PIL import Image
im = Image.open("base_050_v4.png").convert("RGBA"); px = im.load(); W, H = im.size
src = im.copy().load()
FX, FY = 134, 167                       # heart of the fire at the threshold
FIRE = (255, 150, 64)
def lum(p): return .3 * p[0] + .59 * p[1] + .11 * p[2]
for y in range(90, H):
    for x in range(40, W):
        p = src[x, y]
        if p[3] < 255: continue
        h, l, s = colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)
        if p[0] > 200 and p[1] > 110 and s > .45: continue              # the flames / lit glass themselves
        dx, dy = x - FX, (y - FY) * (1.25 if y < FY else 0.9)           # light spreads wider along the ground
        d = math.hypot(dx, dy)
        k = max(0.0, 1 - d / 46) ** 1.6
        if x < 97: k *= 0.35                                            # side wall is around the corner
        if y > FY + 2 and abs(dx) < 30: k *= 1.15                       # steps/ground right under it get more
        if k <= 0.01: continue
        # warm light: lift toward the fire colour, more on lighter surfaces, keep shadows dark-ish
        lift = k * (0.55 + 0.45 * (lum(p) / 255))
        r = p[0] + (FIRE[0] - p[0]) * lift * .85 + 30 * k
        g = p[1] + (FIRE[1] - p[1]) * lift * .75 + 10 * k
        b = p[2] * (1 - lift * .45)
        px[x, y] = (min(255, int(r)), min(255, int(g)), max(0, int(b)), 255)
im.save("base_050_v5.png")
bg = Image.new("RGBA", im.size, (24, 26, 40, 255)); bg.alpha_composite(im)
bg.crop((60, 95, 184, 200)).resize((124 * 5, 105 * 5), Image.NEAREST).save("/tmp/fl.png")

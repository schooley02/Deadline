"""50% idle strip: flickering fire (flames re-coloured each frame, rising) + firelight that varies in strength and
position, with the open door leaf blocking the light toward the wall on its right (a shadow wedge that moves)."""
import math, random, colorsys
from PIL import Image
base = Image.open("base_050_touched_fixed.png").convert("RGBA"); B = base.load(); W, H = base.size
N = 8
def lum(p): return .3 * p[0] + .59 * p[1] + .11 * p[2]
def hls(p): return colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)
G = {}
def noise(x, y, s, salt=0):
    gx, gy = x / s, y / s; x0, y0 = math.floor(gx), math.floor(gy); fx, fy = gx - x0, gy - y0
    def r(i, j):
        k = (i, j, s, salt)
        if k not in G: G[k] = random.Random(hash(k)).random()
        return G[k]
    a = r(x0, y0) * (1 - fx) + r(x0 + 1, y0) * fx; c = r(x0, y0 + 1) * (1 - fx) + r(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + c * fy
# flame pixels in the touched base (door gap + threshold + lantern glass)
def in_fire_zone(x, y):
    if 134 <= x <= 141 and y < 168: return False          # the open leaf's edge + the frame: never fire
    return (130 <= x <= 133 and 100 <= y <= 172) or (122 <= x <= 147 and 150 <= y <= 178)
flame = {(x, y) for y in range(98, 182) for x in range(116, 150) if in_fire_zone(x, y)
         and B[x, y][3] == 255 and B[x, y][0] > 170 and hls(B[x, y])[2] > 0.6 and B[x, y][0] > B[x, y][2] + 90}
GLASS_RECTS = [(97, 110, 115, 166), (143, 100, 163, 160), (0, 104, 22, 160), (44, 106, 78, 166)]
def is_glass(x, y, p):
    return any(r[0] <= x <= r[2] and r[1] <= y <= r[3] for r in GLASS_RECTS) and hls(p)[2] > 0.35 and not (p[0] > p[2] + 20 and hls(p)[1] < .55 and hls(p)[2] < .5)
FL = [(255, 240, 180), (255, 200, 96), (248, 140, 48), (196, 72, 30), (120, 40, 24)]
LEAF_X, LEAF_Y0, LEAF_Y1 = 136, 103, 171
frames = []
for f in range(N):
    im = base.copy(); px = im.load()
    ph = f / N * math.tau
    I = 1.0 + 0.12 * math.sin(ph) + 0.05 * math.sin(ph * 3 + 1)      # flicker strength
    FX = 134 + round(math.sin(ph * 2 + .5)); FY = 167 + round(math.cos(ph * 2))
    R = 45 + 3 * math.sin(ph + 2)
    # 1. flames: same silhouette, colours re-rolled with a rising noise field
    for (x, y) in flame:
        h = (y - 100) / 75                                             # 0 top .. 1 floor
        v = h + 0.55 * (noise(x, y + f * 3, 2.3, 70) - .5) + 0.3 * (noise(x * 2, y + f * 5, 3.5, 71) - .5)
        v *= I
        c = FL[0] if v > .95 else FL[1] if v > .78 else FL[2] if v > .58 else FL[3] if v > .4 else FL[4]
        px[x, y] = c + (255,)
    # 2. firelight: a warm multiplicative tint (keeps every texture's own contrast -> no shimmer), warmer and stronger
    #    near the flames, soft-edged shadow from the open door leaf
    for y in range(90, H):
        for x in range(10, W):
            p = B[x, y]
            if p[3] < 255 or (x, y) in flame: continue
            dx, dy = x - FX, (y - FY) * (1.25 if y < FY else 0.9)
            d = math.hypot(dx, dy)
            k = max(0.0, 1 - d / R) ** 1.6 * I
            far = 0.16 * max(0.0, 1 - d / 120) ** 2 * I                 # faint warm spill that reaches further
            if x < 97: k *= 0.5 if x >= 38 else 0.3
            if 38 <= x <= 47 and 112 <= y <= 192: far *= 2.2             # the statue's right edge, facing the fire
            k = max(k, far)
            if y > FY + 2 and abs(dx) < 30: k *= 1.1
            if k <= 0.008: continue
            warm = min(1.0, k * 1.4)                                    # hue shifts warmer close to the fire
            L = (255 * min(1, .95 * k), 150 * min(1, .95 * k), 60 * min(1, .95 * k))   # light colour x strength
            r = 255 - (255 - p[0]) * (255 - L[0] * .85) / 255                       # screen blend: no flat clipping
            g = 255 - (255 - p[1]) * (255 - L[1] * .7) / 255
            b = p[2] * (1 - 0.35 * warm)
            px[x, y] = (min(255, round(r)), min(255, round(g)), max(0, round(b)), 255)
    frames.append(im)
strip = Image.new("RGBA", (W * N, H), (0, 0, 0, 0))
for i, fr in enumerate(frames): strip.paste(fr, (i * W, 0))
strip.save("base_050_anim.png"); frames[0].save("base_050_still.png")
gif = []
for fr in frames:
    bg = Image.new("RGBA", (W, H), (24, 26, 40, 255)); bg.alpha_composite(fr)
    gif.append(bg.convert("RGB").resize((W * 3, H * 3), Image.NEAREST))
gif[0].save("base_050_anim_preview.gif", save_all=True, append_images=gif[1:], duration=1000 // 6, loop=0)
crop = [g.crop((60 * 3, 95 * 3, 184 * 3, 200 * 3)) for g in gif]
crop[0].save("base_050_anim_door.gif", save_all=True, append_images=crop[1:], duration=1000 // 6, loop=0)
print("flame px", len(flame), "frames", N)

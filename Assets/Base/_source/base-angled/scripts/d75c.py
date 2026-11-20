import math, random, colorsys
from PIL import Image
orig = Image.open("base_075_v1.png").convert("RGBA")
b = orig.copy()
picks = {"winA": "111_0", "lanL": "111_0", "lanR": "112_0", "door": "111_0", "sidF": "111_0", "sidS": "111_1",
         "roofP": "111_0", "shing": "112_0"}
for n, k in picks.items():
    b = Image.composite(Image.open(f"d75b_{n}_{k}.png").convert("RGBA"), b, Image.open(f"d75b_mask_{n}.png").convert("L"))
bp, op = b.load(), orig.load(); W, H = b.size
for y in range(H):
    for x in range(W):
        if op[x, y][3] == 0: bp[x, y] = op[x, y]            # silhouette unchanged
        elif 0 < op[x, y][3] < 255: bp[x, y] = op[x, y]     # lantern glow unchanged
# tone the roof patch + missing shingles down so they sit in the dark roof (no bright boxes)
for n in ("roofP", "shing"):
    m = Image.open(f"d75b_mask_{n}.png").convert("L").load()
    for y in range(H):
        for x in range(W):
            if not m[x, y] or bp[x, y][3] < 255: continue
            p = bp[x, y]; L = .3 * p[0] + .59 * p[1] + .11 * p[2]
            if L > 70:
                k = 70 / L * 0.9 + 0.1
                warm = p[0] > p[2]
                bp[x, y] = (int(p[0] * k * (1.05 if warm else 1)), int(p[1] * k), int(p[2] * k * (0.9 if warm else 1.05)), 255)
# grime (code, last): smooth value-noise darkening + dirt rising from the ground + drips under window sills,
# only on the painted white (wall, trim, door, tower base); never a hard edge
random.seed(7)
G = {}
def noise(x, y, s):
    gx, gy = x / s, y / s; x0, y0 = int(gx), int(gy); fx, fy = gx - x0, gy - y0
    def r(i, j):
        if (i, j, s) not in G: G[(i, j, s)] = random.random()
        return G[(i, j, s)]
    a = r(x0, y0) * (1 - fx) + r(x0 + 1, y0) * fx; c = r(x0, y0 + 1) * (1 - fx) + r(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + c * fy
drips = [(5, 158), (12, 158), (56, 162), (66, 162), (100, 160), (108, 160), (149, 154), (156, 154)]   # (x, sill row)
for y in range(H):
    for x in range(W):
        p = bp[x, y]
        if p[3] < 255: continue
        h, l, s = colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)
        if s > 0.22 or l < 0.3: continue                 # painted white surfaces only
        if 14 <= x <= 48 and 112 <= y <= 199: continue   # statue
        g = 0.17 * noise(x, y, 9) + 0.09 * noise(x, y, 4)  # blotchy grime
        g += 0.26 * max(0.0, (y - 135) / 60) ** 1.4      # dirt climbing up from the ground
        for dx, sy in drips:                             # streaks running down from the sills
            if abs(x - dx) <= 1 and sy < y < sy + 14: g += 0.10 * (1 - (y - sy) / 14) * (1 - abs(x - dx) * .4)
        f = 1 - min(0.42, g)
        bp[x, y] = (int(p[0] * f * 0.99), int(p[1] * f * 0.97), int(p[2] * f * 0.93), 255)   # slightly brown dirt
b.save("base_075_v2.png")
bg = Image.new("RGBA", b.size, (60, 56, 80, 255)); bg.alpha_composite(b)
o2 = Image.new("RGBA", b.size, (60, 56, 80, 255)); o2.alpha_composite(Image.open("base_100_final.png").convert("RGBA"))
S = Image.new("RGBA", (W * 2 + 8, H), (20, 20, 28, 255)); S.alpha_composite(o2, (0, 0)); S.alpha_composite(bg, (W + 8, 0))
S.resize((S.width * 3, S.height * 3), Image.NEAREST).save("/tmp/d75v2.png")

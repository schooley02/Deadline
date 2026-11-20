"""75% v6: break the glass in every window (only on glass still visible between the boards): jagged holes with warm
interior light, crack lines across the neighbouring panes, a faint warm rim on wood/frame right next to each hole."""
import random, colorsys, math
from PIL import Image
random.seed(41)
im = Image.open("base_075_v5.png").convert("RGBA"); px = im.load(); W, H = im.size
TONES = [(134, 106, 78), (112, 88, 64), (92, 72, 52), (122, 102, 80), (100, 82, 62), (80, 64, 48), (140, 112, 82),
         (118, 92, 66), (96, 74, 54), (116, 96, 74), (96, 78, 58), (76, 60, 44), (128, 98, 70), (104, 80, 58), (84, 64, 46), (38, 30, 24)]
def is_wood(p): return any(abs(p[0] - t[0]) + abs(p[1] - t[1]) + abs(p[2] - t[2]) < 24 for t in TONES)
def is_glass(x, y):
    p = px[x, y]
    if p[3] < 255 or is_wood(p): return False
    h, l, s = colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)
    return s > 0.3 and 0.12 < l < 0.85
WINDOWS = {"farleft": (0, 104, 20, 160), "side": (46, 108, 76, 164), "frontL": (97, 112, 113, 164), "frontR": (144, 102, 161, 158)}
LIGHT = [(255, 240, 198), (255, 214, 140), (238, 170, 82)]       # centre -> rim
CRACK = (28, 24, 30, 255)
def spots(r, n):
    cand = [(x, y) for y in range(r[1] + 2, r[3] - 2) for x in range(r[0] + 1, r[2] - 1)
            if all(is_glass(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1))]
    random.shuffle(cand); out = []
    for c in cand:
        if all(abs(c[0] - o[0]) + abs(c[1] - o[1]) > 9 for o in out): out.append(c)
        if len(out) == n: break
    return out
def hole(cx, cy, r=2.2):
    # jagged hole: radius wobbles per angle; centre brightest
    pts = []
    for y in range(cy - 4, cy + 5):
        for x in range(cx - 4, cx + 5):
            ang = math.atan2(y - cy, x - cx); rr = r * (0.7 + 0.6 * abs(math.sin(ang * 2.5 + cx)))
            d = math.hypot(x - cx, y - cy)
            if d <= rr and is_glass(x, y) or (d <= 0.8): pts.append((x, y, d / max(rr, .1)))
    inside = {(x, y) for x, y, _ in pts}
    for x, y, t in pts:
        c = LIGHT[0] if t < .4 else (LIGHT[1] if t < .8 else LIGHT[2]); px[x, y] = c + (255,)
    # broken edge: dark jagged ring with a couple of shards poking into the hole, pale glint on the glass
    for (x, y) in list(inside):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in inside and 0 <= q[0] < W and 0 <= q[1] < H and is_glass(*q):
                px[q] = (22, 18, 22, 255)
    sh = sorted(inside, key=lambda q: -math.hypot(q[0] - cx, q[1] - cy))[:3]
    for q in sh[:2]: px[q] = (34, 28, 30, 255)
    g = (cx - round(r) - 2, cy - 1)
    if 0 <= g[0] < W and is_glass(*g): px[g] = (196, 198, 208, 255)
    # cracks: 3-4 short jagged lines leaving the hole across the glass
    for k in range(random.randint(3, 4)):
        ang = random.random() * math.tau; x, y = cx + math.cos(ang) * (r + 1.6), cy + math.sin(ang) * (r + 1.6)
        for s in range(random.randint(4, 7)):
            ix, iy = round(x), round(y)
            if 0 <= ix < W and 0 <= iy < H and is_glass(ix, iy): px[ix, iy] = CRACK
            ang += random.uniform(-.6, .6); x += math.cos(ang); y += math.sin(ang)
    # light catching the edge of whatever is right next to the hole (wood / frame), opaque
    for y in range(cy - 4, cy + 5):
        for x in range(cx - 4, cx + 5):
            if not (0 <= x < W and 0 <= y < H): continue
            p = px[x, y]
            if p[3] == 255 and is_wood(p) and math.hypot(x - cx, y - cy) < 4:
                px[x, y] = (min(255, p[0] + 26), min(255, p[1] + 16), p[2], 255)
for name, r in WINDOWS.items():
    n = 2 if name in ("side", "farleft") else 1 + (name == "frontR")
    found = spots(r, n)
    print(name, found)
    for (x, y) in found: hole(x, y, 2.1 if name.startswith("front") else 2.6)
im.save("base_075_v6.png")
bg = Image.new("RGBA", im.size, (60, 56, 80, 255)); bg.alpha_composite(im)
bg.crop((0, 100, 166, 168)).resize((166 * 5, 68 * 5), Image.NEAREST).save("/tmp/glass.png")

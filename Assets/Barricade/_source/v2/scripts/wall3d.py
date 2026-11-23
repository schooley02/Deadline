"""Barricade guide, drawn in code with real depth (art px; shown 2x in the game).
The wall is drawn straight in (u, v) with an oblique depth offset (things further toward the church sit up-left), then every
column is lifted along the lane diagonal (posts stay vertical). Layers back to front: sandbag stack (front face, lit top face,
near end cap) -> posts standing on the ground IN FRONT of the bags (front face, darker side face, top) -> boards nailed across
the posts (each pair of posts joined by one or two) -> barbed wire."""
import random, math
import numpy as np
from PIL import Image, ImageDraw
SLOPE = 40 / 88.0
OUT = (8, 8, 18, 255)        # the church's navy-black outline
BAG = dict(top=(193, 174, 135), lit=(156, 138, 107), mid=(134, 118, 90), sh=(104, 95, 79), dk=(86, 76, 57), deep=(64, 55, 44))
WOOD = dict(top=(134, 118, 90), lit=(114, 104, 83), mid=(93, 84, 70), sh=(70, 63, 50), dk=(54, 49, 37))   # weathered timber, in the church's own browns
TIRE = dict(top=(85, 86, 87), lit=(60, 61, 62), mid=(37, 37, 33), dk=(22, 24, 28))
RUST = [(116, 72, 48), (150, 98, 66), (84, 52, 38)]
def build(L=62, courses=4, posts=5, post_h=29, seed=3, boards=True, wire=True, bag_h=5, bag_w=15, depth=4, tires=(3, 2), board_t=3):
    r = random.Random(seed)
    PADL, PADT, PADB = depth + 4 + (12 if tires[0] else 0), 8, 5
    W = L + PADL + 4 + (10 if tires[1] else 0); H = PADT + post_h + PADB + 2
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); px = im.load()
    def P(x, y, c):
        if 0 <= x < W and 0 <= y < H: px[x, y] = c if len(c) == 4 else c + (255,)
    base = H - PADB - 2                      # v of the bag wall's front base line
    u0 = PADL
    wall_h = courses * bag_h
    # --- sandbags: front face, course by course, running bond
    def bag(x0, y0, w, h, tone=0):
        for yy in range(h):
            for xx in range(w):
                edge = (xx in (0, w - 1) and yy in (0, h - 1))
                if edge: continue
                if yy == h - 1 or xx == w - 1: c = OUT
                elif yy == 0: c = BAG['lit'] if tone == 0 else BAG['mid']
                elif yy == h - 2: c = BAG['dk']
                elif xx == 0: c = BAG['lit']
                elif xx == w - 2: c = BAG['sh']
                else: c = BAG['mid'] if (xx + yy * 2 + tone) % 7 else BAG['sh']
                P(x0 + xx, y0 + yy, c)
        if w > 6 and r.random() < 0.5: P(x0 + w // 2, y0 + 1, BAG['sh']); P(x0 + w // 2 + 1, y0 + 2, BAG['dk'])     # crease
    for yy in range(wall_h):
        for x in range(u0, u0 + L): P(x, base - yy, BAG['deep'])
    for k in range(courses):
        y = base - (k + 1) * bag_h + 1
        x = u0 - (bag_w // 2 if k % 2 else 0) + r.randint(-1, 1)
        while x < u0 + L:
            w = bag_w + r.randint(-2, 1)
            x_a = max(x, u0); x_b = min(x + w, u0 + L)
            if x_b - x_a >= 2: bag(x_a, y, x_b - x_a, bag_h, tone=k % 2)
            x += w
    # --- top face of the stack (lit, going back up-left) and the near end cap (bag ends, in shade)
    ty = base - wall_h + 1
    for d in range(1, depth + 1):
        for x in range(u0, u0 + L):
            c = BAG['top'] if d < depth else OUT
            if d < depth and (x + d * 3) % 9 == 0: c = BAG['lit']
            P(x - d, ty - d, c)
    for d in range(1, depth + 1):
        for yy in range(wall_h):
            c = BAG['dk'] if d < depth else OUT
            if d < depth and yy % bag_h == bag_h - 1: c = OUT
            elif d < depth and yy % bag_h == 0: c = BAG['sh']
            P(u0 - d, ty + yy - d + 1, c)
    for x in range(u0, u0 + L): P(x, base + 1, OUT)
    # --- posts: on the ground in FRONT of the bags (2 px nearer = down-right), far posts a little shorter
    gap = (L - 6) / (posts - 1)
    pu = [u0 + 2 + round(i * gap) for i in range(posts)]
    ph = [post_h - round(i * 3 / (posts - 1)) + r.randint(-1, 1) for i in range(posts)]
    def post(u, h):
        yb = base + 3                               # foot: lower than the bag base, so it reads as standing in front
        for yy in range(h):
            y = yb - yy
            P(u - 1, y, OUT)
            P(u, y, WOOD['sh'] if yy % 6 else WOOD['dk'])           # side face (left, in shade)
            P(u + 1, y, WOOD['lit']); P(u + 2, y, WOOD['mid'] if (yy * 3 + u) % 5 else WOOD['lit']); P(u + 3, y, WOOD['mid'])
            P(u + 4, y, OUT)
        for xx in range(-1, 5): P(u + xx, yb + 1, OUT)
        for xx in range(0, 4): P(u + xx - 1, yb - h, WOOD['top'])     # top face (cut end)
        for xx in range(-1, 4): P(u + xx - 1, yb - h - 1, OUT)
        P(u + 4, yb - h, OUT)
        for yy in range(2, min(h, wall_h + 2)):                      # the post's shadow on the bags behind it
            if px[u - 2, yb - yy][3] and px[u - 2, yb - yy] != OUT: P(u - 2, yb - yy, BAG['deep'])
        return yb
    # --- boards: drawn after the posts' bodies but they sit ON the posts' front faces
    yb = [post(u, h) for u, h in zip(pu, ph)]
    def board(ua, ub, ya, yb_, t=board_t):
        n = ub - ua
        for i in range(n + 1):
            y = round(ya + (yb_ - ya) * i / max(1, n)); x = ua + i
            P(x, y - 1, OUT); P(x, y, WOOD['top'])
            for k in range(1, t): P(x, y + k, WOOD['lit'] if (k == 1 or (x * 2 + k) % 9) else WOOD['mid'])
            P(x, y + t, WOOD['sh']); P(x, y + t + 1, OUT)
            if px[x, min(H - 1, y + t + 2)][3] and px[x, y + t + 2] != OUT and (x not in sum(([u, u + 1, u + 2, u + 3] for u in pu), [])): P(x, y + t + 2, BAG['deep'])   # board's shadow on the bags
        for yy in range(-1, t + 2): P(ua - 1, round(ya) + yy, OUT); P(ub + 1, round(yb_) + yy, OUT)
        for x in (ua + 2, ub - 2):                    # nail heads
            y = round(ya + (yb_ - ya) * (x - ua) / max(1, n)); P(x, y + 2, WOOD['dk'])
    if boards:
        for i in range(posts - 1):
            ua, ub = pu[i] - 1, pu[i + 1] + 4
            top = base - wall_h + 5 + r.randint(-1, 1)
            board(ua, ub, top, top + r.choice((-1, 0, 0, 1)))
            if i % 2 == 0 or r.random() < 0.6:
                low = base - 7 + r.randint(-1, 1); board(ua, ub, low, low + r.choice((-1, 0, 1)))
    if wire:
        for i in range(posts - 1):
            xa, xb = pu[i] + 3, pu[i + 1]; ya, yb2 = yb[i] - ph[i] + 3, yb[i + 1] - ph[i + 1] + 3
            for s in (0, 4):
                for x in range(xa, xb + 1):
                    t = (x - xa) / max(1, xb - xa); y = round(ya + s + (yb2 - ya) * t + 2.2 * math.sin(math.pi * t))
                    P(x, y, RUST[0] if x % 4 else RUST[1])
                    if x % 5 == 2: P(x, y - 1, RUST[1]); P(x, y + 1, RUST[2])
    # --- tire stacks at the ends (lying flat, a little askew), standing in front like the posts
    def tire(cx, cy, w=12, h=5):
        for yy in range(-h, h + 1):
            for xx in range(-w, w + 1):
                e = (xx / (w / 2 + .5)) ** 2 + (yy / (h / 2 + .5)) ** 2
                if e <= 1:
                    hole = (xx / (w / 4)) ** 2 + ((yy + 1) / (h / 4 + .2)) ** 2 <= 1
                    c = OUT if e > 0.72 else (TIRE['dk'] if hole else (TIRE['top'] if yy < -1 else (TIRE['lit'] if yy < 1 else TIRE['mid'])))
                    P(cx + xx, cy + yy, c)
        for xx in range(-w // 2 + 1, w // 2):                       # tread wall under the top ring
            for k in (1, 2, 3):
                if abs(xx) < w // 2 - (1 if k == 3 else 0): P(cx + xx, cy + h // 2 + k - 1, OUT if k == 3 else (TIRE['mid'] if (xx + k) % 3 else TIRE['dk']))
    if tires[0]:
        for k in range(tires[0]): tire(u0 - depth - 5 + (k % 2), base + 2 - k * 4)
    if tires[1]:
        for k in range(tires[1]): tire(u0 + L + 6 - (k % 2), base + 1 - k * 4, w=10, h=4)
    return im
def shear(im, slope=SLOPE):
    a = np.array(im); h, w = a.shape[:2]; rise = int(round((w - 1) * slope))
    out = np.zeros((h + rise, w, 4), np.uint8)
    for x in range(w):
        d = int(round(x * slope)); out[rise - d:rise - d + h, x] = a[:, x]
    return Image.fromarray(out, 'RGBA')
if __name__ == '__main__':
    g = build(); s = shear(g); g.save('guide_straight.png'); s.save('guide_solid.png'); print(g.size, s.size)
    bg = Image.new('RGBA', (g.size[0] + s.size[0] + 12, max(g.size[1], s.size[1]) + 8), (40, 44, 70, 255)); bg.alpha_composite(g, (4, 4)); bg.alpha_composite(s, (g.size[0] + 8, 4))
    bg.resize((bg.size[0] * 6, bg.size[1] * 6), Image.NEAREST).save('guide_6x.png')

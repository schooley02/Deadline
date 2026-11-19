import numpy as np, random

def glow_cone(out, sx, sy, R, half_angle_w, color, k0=0.35, down=True, cap=150):
    """Cone from (sx,sy) opening downward. half width at distance d = 1 + d*half_angle_w."""
    H, W = out.shape[:2]; col = np.array(color, float)
    for y in range(H):
        for x in range(W):
            dy = (y - sy) if down else (sy - y)
            if dy < 0: continue
            dist = (dy * dy + (x - sx) ** 2) ** 0.5
            if dist > R: continue
            half = 1 + dy * half_angle_w
            u = abs(x - sx) / half
            if u >= 1: continue
            k = k0 * (1 - dist / R) ** 1.5 * (1 - u * u)
            apply(out, x, y, k, col, cap)

def glow_round(out, cx, cy, R, color, k0=0.3, cap=120, box=None, skip_inside=False):
    H, W = out.shape[:2]; col = np.array(color, float)
    if box:
        ys = range(max(0, box[1] - R), min(H, box[3] + R + 1)); xs = range(max(0, box[0] - R), min(W, box[2] + R + 1))
    else:
        ys = range(max(0, int(cy - R)), min(H, int(cy + R) + 1)); xs = range(max(0, int(cx - R)), min(W, int(cx + R) + 1))
    for y in ys:
        for x in xs:
            if box:  # distance to a rectangle instead of a point
                bx0, by0, bx1, by1 = box
                dx = max(bx0 - x, 0, x - bx1); dy = max(by0 - y, 0, y - by1)
                dist = (dx * dx + dy * dy) ** 0.5
                if skip_inside and dist == 0: continue
            else:
                dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if dist > R: continue
            k = k0 * (1 - dist / R) ** 1.5
            apply(out, x, y, k, col, cap)

def apply(out, x, y, k, col, cap):
    if k <= 0: return
    a = out[y, x, 3]
    if a > 200:
        out[y, x, :3] = out[y, x, :3] * (1 - k) + col * k
    else:
        na = min(255 * k * 0.9, cap)
        if na < 7: return
        if a > 0:  # existing glow: add
            out[y, x, 3] = min(max(a, na) + na * 0.3, cap)
        else:
            out[y, x, :3] = col; out[y, x, 3] = na

def shrub(out, x0, x1, ytop, seed, ybot=143, base=(50, 66, 46), hi=(78, 96, 62), dark=(32, 42, 32), outline=(24, 28, 24)):
    rnd = random.Random(seed)
    cx = (x0 + x1) / 2; half = (x1 - x0) / 2
    tops = []
    lumps = [(rnd.uniform(x0 + 1, x1 - 1), rnd.uniform(ytop, ytop + 5), rnd.uniform(2.5, 4.5)) for _ in range(5)]
    for x in range(x0, x1 + 1):
        t = abs(x - cx) / half
        top = ytop + 9 * t ** 1.6
        for (lx, ly, lr) in lumps:
            if abs(x - lx) < lr:
                top = min(top, ly + 3 * (abs(x - lx) / lr) ** 2)
        top = int(round(top + rnd.choice([0, 0, 0, 1, -1])))
        tops.append(top)
    for i, x in enumerate(range(x0, x1 + 1)):
        bot = ybot - (1 if (x in (x0, x1)) else 0)
        for y in range(tops[i], bot + 1):
            depth = y - tops[i]
            r = rnd.random()
            if depth == 0: c = outline
            elif depth <= 2 and r < 0.55: c = hi
            elif depth > 5 and r < 0.6: c = dark
            else: c = base if r < 0.8 else dark
            out[y, x, :3] = c; out[y, x, 3] = 255
        if x in (x0, x1): out[bot, x, :3] = outline
    # a few twigs poking out
    for _ in range(3):
        x = rnd.randint(x0 + 2, x1 - 2); y = tops[x - x0] - 1
        if y > 0: out[y, x, :3] = outline; out[y, x, 3] = 255

def glow_beam(out, sx, sy, dx, dy, R, spread, color, k0=0.35, cap=150, protect=None):
    """Beam from (sx,sy) along (dx,dy) (normalised inside). spread = half-width growth per px."""
    import numpy as np
    H, W = out.shape[:2]; col = np.array(color, float)
    n = (dx * dx + dy * dy) ** 0.5; dx /= n; dy /= n
    for y in range(H):
        for x in range(W):
            vx, vy = x - sx, y - sy
            along = vx * dx + vy * dy
            if along <= 0 or along > R: continue
            across = abs(-vx * dy + vy * dx)
            half = 1 + along * spread
            u = across / half
            if u >= 1: continue
            if protect is not None and protect[y, x]: continue
            k = k0 * (1 - along / R) ** 1.2 * (1 - u * u)
            apply(out, x, y, k, col, cap)

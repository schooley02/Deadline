"""Code props for the 176x144 Hospital: bigger ambulance, turned dumpster, shrub beds."""
import numpy as np, random

OUT = (28, 29, 32)


def ambulance(lights_on=False, seed=4, back_open=False):
    """47x32 RGBA box ambulance facing right, bus scale (cab window ~9 px)."""
    W, H = 47, 32
    a = np.zeros((H, W, 4), float)
    rnd = np.random.default_rng(seed)
    WH = np.array([186, 186, 178.]); WH2 = np.array([158, 158, 152.]); WH3 = np.array([128, 128, 124.])
    RED = np.array([140, 44, 40.]); BLUE = np.array([46, 70, 128.])
    GL = np.array([44, 56, 66.]); GL2 = np.array([70, 86, 96.])

    def px(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            a[y, x, :3] = c; a[y, x, 3] = 255

    # patient box x 0..30, rows 1..25
    for y in range(1, 26):
        for x in range(0, 31):
            c = WH if y < 20 else WH2
            px(x, y, c + rnd.normal(0, 4, 3))
    for x in range(0, 31): px(x, 1, OUT); px(x, 25, OUT)
    for y in range(1, 26): px(0, y, OUT); px(30, y, OUT)
    for x in range(1, 30): px(x, 2, WH2)            # roof edge shade
    # stripe
    for x in range(1, 47):
        for y in (16, 17, 18): px(x, y, RED)
        px(x, 19, BLUE)
    # rear door seam (left), side door
    for y in range(3, 24): px(3, y, WH3)
    for y in range(4, 24): px(19, y, WH3); px(27, y, WH3)
    for x in range(19, 28): px(x, 4, WH3)
    px(25, 13, OUT); px(25, 14, OUT)                 # handle
    # small side window in the side door
    for y in range(6, 11):
        for x in range(21, 26): px(x, y, GL)
    # star of life (blue) at x 7..13, rows 6..12
    sx, sy = 10, 9
    for d in range(-3, 4):
        px(sx + d, sy, BLUE); px(sx, sy + d, BLUE)
        px(sx + d, sy + d, BLUE); px(sx + d, sy - d, BLUE)
    px(sx, sy, WH)
    # roof light bar corners
    lc_r = np.array([230, 60, 50.]) if lights_on else np.array([110, 36, 34.])
    lc_b = np.array([70, 110, 230.]) if lights_on else np.array([40, 52, 92.])
    for x in (2, 3, 4): px(x, 0, lc_r)
    for x in (26, 27, 28): px(x, 0, lc_b)
    # cab x 30..46: roof row 8, windshield slant
    for y in range(8, 26):
        for x in range(30, 47):
            front = 39 + (y - 8)                      # slant line of windshield/hood
            if y < 16 and x > front: continue
            if y >= 16 and x > 46: continue
            px(x, y, (WH if y < 20 else WH2) + rnd.normal(0, 4, 3))
    for x in range(30, 40): px(x, 8, OUT)
    for y in range(8, 16): px(min(39 + (y - 8), 46), y, OUT)
    for y in range(15, 26): px(46, y, OUT)
    # cab side window (9 tall) + windshield glimpse
    for y in range(9, 16):
        for x in range(32, 39):
            if x <= 38 + (y - 9):
                px(x, y, GL if (x + y) % 7 else GL2)
    for y in range(9, 16): px(31, y, OUT)
    for x in range(31, 39): px(x, 16 - 1, OUT) if False else None
    for y in range(10, 15):
        xs = 39 + (y - 8) - 1
        px(xs, y, GL2)
    # cab door seam + mirror
    for y in range(9, 24): px(40, y, WH3) if y > 16 else None
    px(30, 11, OUT); px(29, 11, OUT); px(29, 12, OUT)
    # cab light bar
    for x in (33, 34, 35): px(x, 7, lc_r)
    for x in (36, 37): px(x, 7, lc_b)
    for x in range(32, 39): px(x, 6, OUT) if x in (32, 38) else None
    # headlight + grille + bumper
    px(45, 20, np.array([236, 224, 180.]) if lights_on else np.array([150, 146, 128.])); px(45, 21, np.array([200, 190, 150.]) if lights_on else np.array([120, 116, 104.]))
    for y in range(22, 25): px(46, y, OUT)
    for x in range(36, 47): px(x, 25, (60, 60, 62))
    # chassis + wheels
    for x in range(1, 46):
        for y in (26, 27): px(x, y, (36, 36, 38))
    for cx in (8, 38):
        for y in range(22, 32):
            for x in range(cx - 5, cx + 6):
                d = ((x - cx) ** 2 + (y - 27) ** 2) ** 0.5
                if d <= 4.7: px(x, y, (24, 24, 26) if d > 2 else (92, 92, 96))
                if 4.7 < d <= 5.6 and y < 27: px(x, y, (36, 36, 38))
    # grime: dirt along the bottom, streaks
    for y in range(12, 26):
        for x in range(1, 46):
            if a[y, x, 3] and a[y, x, :3].mean() > 120 and rnd.random() < 0.10 + 0.03 * (y - 12):
                a[y, x, :3] *= 0.82
    if back_open:
        # rear doors swung open (seen edge-on at the left), dark inside
        for y in range(3, 24):
            for x in range(1, 4): px(x, y, (40, 44, 46))
    return a


def paste(out, spr, x0, y0):
    h, w = spr.shape[:2]
    m = spr[..., 3] > 0
    reg = out[y0:y0 + h, x0:x0 + w]
    reg[m] = spr[m]


def dumpster(out, seed=8):
    """Turned dumpster: front face x 9..26, receding left face x 3..8."""
    rnd = np.random.default_rng(seed)
    G = np.array([50, 68, 52.]); G2 = np.array([40, 55, 43.]); GS = np.array([40, 50, 42.])
    LID = np.array([34, 40, 36.])
    FX0, FX1, TOP, BOT = 9, 26, 126, 141
    # clear old footprint left of the side wall
    for y in range(121, 144):
        for x in range(0, 28):
            if x < 10: out[y, x, 3] = 0
    # side face (recedes: top drops, bottom rises)
    for x in range(3, FX0):
        t = (FX0 - x) / (FX0 - 3)
        top = round(TOP + 2 * t); bot = round(BOT - 1 * t)
        for y in range(top, bot + 1):
            out[y, x, :3] = GS + rnd.normal(0, 3, 3); out[y, x, 3] = 255
        out[top, x, :3] = OUT; out[bot, x, :3] = OUT
        # side lid edge
        out[top - 1, x, :3] = (46, 54, 48); out[top - 1, x, 3] = 255
        out[top - 2, x, :3] = (62, 72, 64); out[top - 2, x, 3] = 255
        out[top - 3, x, :3] = OUT; out[top - 3, x, 3] = 255
    for y in range(TOP + 2, BOT): out[y, 3, :3] = OUT
    # front face
    for y in range(TOP, BOT + 1):
        for x in range(FX0, FX1 + 1):
            c = G if (x - FX0) % 4 else G2
            out[y, x, :3] = c + rnd.normal(0, 3, 3); out[y, x, 3] = 255
    for x in range(FX0, FX1 + 1): out[TOP, x, :3] = OUT; out[BOT, x, :3] = OUT
    for y in range(TOP, BOT + 1): out[y, FX0, :3] = OUT; out[y, FX1, :3] = OUT
    # lid (slightly open, tilted up at the back)
    for x in range(FX0 - 1, FX1 + 2):
        out[TOP - 1, x, :3] = LID; out[TOP - 2, x, :3] = (70, 80, 72); out[TOP - 1, x, 3] = 255; out[TOP - 2, x, 3] = 255
        out[TOP - 3, x, :3] = OUT; out[TOP - 3, x, 3] = 255
    # corner edge highlight where the front meets the side (lit from front-right)
    for y in range(TOP + 1, BOT): out[y, FX0 + 1, :3] = G * 1.15
    # top rim band
    for x in range(FX0 + 1, FX1): out[TOP + 2, x, :3] = G2 * 0.9
    # grime + rust
    for _ in range(12):
        x = rnd.integers(FX0 + 1, FX1); y = rnd.integers(TOP + 3, BOT)
        out[y, x, :3] = [62, 50, 38] if rnd.random() < 0.3 else G2 * 0.8
    # casters
    for x in (FX0 + 1, FX0 + 2, FX1 - 2, FX1 - 1, 4, 5):
        out[BOT + 1, x, :3] = OUT; out[BOT + 1, x, 3] = 255
        out[BOT + 2, x, :3] = (60, 60, 62); out[BOT + 2, x, 3] = 255


def bed(out, x0, x1, seed=1):
    """Low uneven dirt mound the shrub grows out of (rows ~139..143), wider than the shrub, no hard top line."""
    rnd = np.random.default_rng(seed)
    xa, xb = x0 - 2, x1 + 2
    cx = (xa + xb) / 2; half = (xb - xa) / 2
    for x in range(xa, xb + 1):
        t = abs(x - cx) / half
        top = 143 - round(3.2 * (1 - t * t) + rnd.choice([0, 0, 1]))
        for y in range(top, 144):
            d = y - top
            c = np.array([62, 52, 40.]) if d == 0 else (np.array([50, 42, 33.]) if d < 2 else np.array([38, 33, 27.]))
            out[y, x, :3] = c + rnd.normal(0, 4, 3); out[y, x, 3] = 255
        out[143, x, :3] = (30, 27, 24)


GC = (52, 78, 140); GC2 = (36, 56, 106)

def green_cross(out, cx, cy, arm, th):
    """Plus sign centred on (cx, cy): half-length arm, thickness th (px)."""
    lo = -(th // 2); hi = lo + th - 1
    for y in range(cy - arm, cy + arm + 1):
        for x in range(cx + lo, cx + hi + 1):
            out[y, x, :3] = GC2 if x == cx + hi else GC
    for x in range(cx - arm, cx + arm + 1):
        for y in range(cy + lo, cy + hi + 1):
            out[y, x, :3] = GC2 if y == cy + hi else GC


def ambulance_cross(out, dirt=0.0, seed=7):
    """Replace the blue star of life on the ambulance box with a green cross."""
    reg = out[121:131, 132:143, :3]
    blue = (reg[..., 2] > reg[..., 0] + 24) & (reg[..., 2] > reg[..., 1] + 6)
    whites = out[121:131, 128:153, :3].reshape(-1, 3)
    whites = whites[whites.min(1) > 120]
    wc = np.median(whites, axis=0) if len(whites) else np.array([170, 170, 164.])
    reg[blue] = wc
    green_cross(out, 137, 126, 3, 3)
    if dirt > 0:
        r = np.random.default_rng(seed)
        for y in range(122, 131):
            for x in range(133, 142):
                c = out[y, x, :3]
                if c[2] > c[0] + 20:                       # cross pixel
                    m = c.mean()
                    c2 = c + (m - c) * (0.5 * dirt)        # faded
                    if r.random() < dirt: c2 = c2 * r.uniform(0.6, 0.85) + np.array([14, 8, 0]) * dirt   # grime
                    out[y, x, :3] = c2
                elif c.min() > 110 and r.random() < dirt * 0.5:
                    out[y, x, :3] = c * r.uniform(0.75, 0.9)   # dirt around it

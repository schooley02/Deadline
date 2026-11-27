"""Village signs at FULL resolution, 1 art px = 1 screen px like the buildings and the tree line (Jeremy 2026-11-26: "The building art has less chunky
pixel art ... the trees have smaller pixels as well"). Code-drawn. usage: python3 signs.py <outdir>"""
import sys, math, random
import numpy as np
from PIL import Image
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
def canvas(w, h): return np.zeros((h, w, 4), np.uint8)
def put(o, x, y, c, a=255):
    if 0 <= y < o.shape[0] and 0 <= x < o.shape[1]: o[y, x, :3] = c; o[y, x, 3] = a
def blend(o, x, y, c, a):
    if 0 <= y < o.shape[0] and 0 <= x < o.shape[1]:
        if o[y, x, 3] == 0: o[y, x, :3] = c; o[y, x, 3] = a
        else: o[y, x, :3] = (o[y, x, :3].astype(int) * (255 - a) + np.array(c) * a) // 255
def shadow(o, x0, y0, n=12):
    """short contact shadow falling left from the foot (x0, y0): 2 rows, fading in four flat steps"""
    for k in range(n):
        a = (150, 150, 150, 118, 118, 118, 84, 84, 84, 50, 50, 50)[min(k, 11)]
        for dy in (0, 1):
            if dy == 1 and k < 2: continue
            x, y = x0 - k, y0 + dy
            if 0 <= y < o.shape[0] and 0 <= x < o.shape[1] and o[y, x, 3] == 0: put(o, x, y, (5, 10, 12), a)

FONT = {'S': ["###", "#  ", "###", "  #", "###"], 'T': ["###", " # ", " # ", " # ", " # "], 'O': ["###", "# #", "# #", "# #", "###"], 'P': ["###", "# #", "###", "#  ", "#  "]}
def stop_sign():
    W, S, H = 20, 20, 42                        # 20 px octagon, post to row 39, 2 rows for the shadow
    o = canvas(W, H); rnd = random.Random(4)
    cut = 6
    def inside(x, y, inset):
        if not (inset <= x < S - inset and inset <= y < S - inset): return False
        for cx, cy in ((x, y), (S - 1 - x, y), (x, S - 1 - y), (S - 1 - x, S - 1 - y)):
            if cx + cy < cut - 1 + inset + (inset + 1) // 2: return False
        return True
    post_l, post_r = (62, 66, 72), (104, 108, 112)
    for y in range(S - 2, 40):                  # U-channel post: lit right edge, a punched hole every 4 rows, rust near the ground
        put(o, 9, y, post_l); put(o, 10, y, post_r)
        if y % 4 == 1: put(o, 10, y, (58, 60, 64))
    for y, x, c in ((33, 9, (92, 64, 46)), (36, 10, (98, 68, 48)), (38, 9, (84, 58, 42)), (27, 10, (96, 86, 78))): put(o, x, y, c)
    put(o, 8, 39, (44, 46, 48)); put(o, 11, 39, (44, 46, 48))
    for y in range(S):
        for x in range(S):
            if not inside(x, y, 0): continue
            if not inside(x, y, 1): c = (34, 18, 20)                                   # dark rim
            elif not inside(x, y, 2): c = (172, 166, 156) if rnd.random() > 0.14 else (128, 112, 104)   # worn white border
            else:
                t = (x - y + S) / (2 * S)                                             # moon top right: lighter toward the upper right
                c = (146, 54, 46) if t > 0.62 else ((132, 46, 40) if t > 0.36 else (112, 38, 37))
            put(o, x, y, c)
    tx = 3; ty = 8
    for ch in 'STOP':
        for j, row in enumerate(FONT[ch]):
            for i, p in enumerate(row):
                if p == '#': put(o, tx + i, ty + j, (198, 190, 178) if rnd.random() > 0.10 else (150, 120, 112))
        tx += 4
    put(o, 2, 7, (170, 164, 154))
    for x, y in ((9, 3), (10, 3), (9, 16), (10, 16)): put(o, x, y, (88, 84, 82))       # bolts
    for (x, y, n) in ((9, 4, 3), (10, 17, 1), (14, 14, 2)):                           # rust runs under the bolts and a chip
        for k in range(n): put(o, x, y + k, (96, 58, 40))
    for k in range(4): put(o, 13 + k, 5 + k // 2, (160, 76, 64))                      # a light scratch
    shadow(o, 10, 40)
    return o

def traffic_light():
    W, H = 38, 78                               # 4 px left margin for the lamp glow; pole foot on row 75; 2 rows for the shadow
    o = canvas(W, H); rnd = random.Random(7)
    # pole: 4 px at the foot, 3 px above the middle; dark left, lit right (the moon is on the right)
    PX = 30
    for y in range(13, 73):
        cols = [(50, 54, 60), (76, 80, 86), (94, 98, 102), (116, 120, 122)] if y > 44 else [(50, 54, 60), (80, 84, 90), (114, 118, 120)]
        x0 = PX if y > 44 else PX + 1
        for i, c in enumerate(cols): put(o, x0 + i, y, c)
    for (x, y, n) in ((PX + 1, 52, 4), (PX + 2, 30, 3), (PX + 3, 63, 5), (PX + 1, 68, 3), (PX + 2, 20, 2)):
        for k in range(n): put(o, x, y + k, (96, 68, 48) if k % 2 == 0 else (82, 60, 46))        # rust runs
    for y in (44, 45): [put(o, PX + i, y, (58, 60, 64)) for i in range(4)]                       # collar where the pole steps in
    for x in range(PX - 2, PX + 6): put(o, x, 73, (58, 60, 64)); put(o, x, 74, (44, 46, 50)); put(o, x, 75, (36, 38, 42))   # base flange
    for x in (PX - 1, PX + 4): put(o, x, 73, (104, 106, 108))                                   # anchor bolts
    put(o, PX + 1, 12, (96, 100, 104)); put(o, PX + 2, 12, (120, 122, 124)); put(o, PX + 3, 12, (86, 90, 94))   # cap
    # mast arm: rises to the upper left (the scene's depth direction), so it reaches back over the road; 3 px thick at the pole, 2 at the tip
    TIPX, TIPY, JX, JY = 9, 3, PX + 1, 15
    for x in range(TIPX, JX + 1):
        t = (x - TIPX) / (JX - TIPX); y = int(round(TIPY + t * (JY - TIPY)))
        put(o, x, y - 1, (122, 124, 120) if rnd.random() > 0.12 else (104, 100, 92))
        put(o, x, y, (84, 88, 90))
        if t > 0.45: put(o, x, y + 1, (52, 54, 56))
        if x in (15, 22): put(o, x, y, (96, 68, 48))
    for (x, y) in ((JX - 4, JY + 2), (JX - 3, JY + 3), (JX - 2, JY + 4), (JX - 1, JY + 5)): put(o, x, y, (60, 62, 66))  # brace under the joint
    for y in range(JY - 2, JY + 3): put(o, JX - 1, y, (46, 48, 52))                                                    # clamp
    # signal head: dark housing with a lit right edge, three round lenses under hoods; red is lit
    HX, HY, HW, HH = 5, 7, 10, 27
    put(o, 9, 5, (60, 62, 66)); put(o, 10, 5, (86, 88, 90)); put(o, 9, 6, (46, 48, 52)); put(o, 10, 6, (46, 48, 52))  # hanger
    for y in range(HY, HY + HH):
        for x in range(HX, HX + HW):
            edge = x in (HX, HX + HW - 1) or y in (HY, HY + HH - 1)
            corner = (x in (HX, HX + HW - 1)) and (y in (HY, HY + HH - 1))
            if corner: continue
            c = (18, 20, 24) if edge else (34, 37, 42)
            if x == HX + HW - 2 and not edge: c = (60, 64, 70)                         # moonlit right side
            if y == HY + 1 and not edge: c = (48, 52, 58)
            put(o, x, y, c)
    LENS = [" #### ", "######", "######", "######", "######", " #### "]
    def lens(cy, body, low, hi, hot=None):
        for j, row in enumerate(LENS):
            for i, p in enumerate(row):
                if p != '#': continue
                c = low if (j >= 4 or (j == 3 and i >= 4)) else body
                put(o, HX + 2 + i, cy + j, c)
        put(o, HX + 3, cy + 1, hi)
        if hot: put(o, HX + 4, cy + 2, hot); put(o, HX + 5, cy + 2, hot); put(o, HX + 4, cy + 3, hot)
        for x in range(HX - 1, HX + 8): put(o, x, cy - 1, (12, 13, 16))                # hood: a dark brow that sticks out to the left
        put(o, HX - 1, cy, (12, 13, 16)); put(o, HX - 1, cy + 1, (18, 20, 24))
    lens(HY + 3, (206, 72, 54), (160, 50, 42), (244, 150, 120), hot=(232, 104, 78))
    lens(HY + 11, (128, 100, 42), (96, 76, 36), (164, 134, 62))
    lens(HY + 19, (44, 98, 70), (32, 74, 54), (70, 132, 96))
    # soft glow around the lit lens (a real light fixture), baked in
    gx, gy = HX + 4.5, HY + 5.5
    for y in range(H):
        for x in range(W):
            d = math.hypot(x - gx, y - gy) / 10.0
            if d < 1:
                a = int(86 * (1 - d) ** 1.7)
                if a > 3 and o[y, x, 3] == 0: put(o, x, y, (214, 72, 52), a)
                elif a > 3 and not (HX + 2 <= x < HX + 8 and HY + 3 <= y < HY + 9): blend(o, x, y, (214, 72, 52), a // 3)
    shadow(o, PX + 1, 76, 12)
    return o
if __name__ == '__main__':
    s = stop_sign(); t = traffic_light()
    Image.fromarray(s, 'RGBA').save(f'{OUT}/village-stop-sign.png', optimize=True); Image.fromarray(t, 'RGBA').save(f'{OUT}/village-traffic-light.png', optimize=True)
    print(s.shape, t.shape)

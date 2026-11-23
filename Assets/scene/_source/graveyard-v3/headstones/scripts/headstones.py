"""Milestone markers v2 (2026-11-23): the shared five-picture headstone set redrawn for the flat fenced graveyard.
24x24 ART px each, shown at exactly 2x (48px on screen, the size they had before at 1.5x), in the church's look:
dark outline, flat tones, moonlit from the upper right, grass at the foot instead of the old purple dirt strip.

Each stage is a clear step up in FORM and MATERIAL (Jeremy 2026-11-23: the first draft's stones looked too alike):
  0 plain wooden cross (as basic as the original)
  1 rough fieldstone marker lying flat on the ground
  2 small rough-hewn upright stone, chipped and mossy
  3 cut and polished blue-grey granite on a base, engraved cross, a jar of flowers
  4 tall white marble stone with a carved cross on top, gold lettering, a grey granite stepped base, a wreath

Every picture is centred on columns 11/12; the foot is row 22 and row 23 is the grass contact shadow.
usage: python3 -I headstones.py <outDir>
"""
import sys
import numpy as np
from PIL import Image

OUT = sys.argv[1]
S = 24
NAVY = (20, 22, 34)
BROWN = (27, 14, 8)
D0, D1, GM, GL, GT = (12, 26, 24), (21, 38, 34), (30, 50, 42), (41, 61, 53), (51, 73, 62)   # lane / graveyard grass
MOSS, MOSS_D = (58, 78, 54), (40, 58, 44)
GOLD, GOLD_D = (196, 162, 92), (146, 116, 66)

# (shadow, mid, light, engraving)
WOOD = ((99, 72, 53), (124, 91, 67), (144, 106, 78), (73, 53, 39))
FIELD = ((62, 62, 60), (88, 88, 82), (112, 111, 102), (44, 46, 48))        # rough fieldstone, a little warm and dark
HEWN = ((82, 86, 90), (116, 119, 118), (146, 148, 142), (56, 60, 66))      # rough-hewn grey
GRANITE = ((78, 88, 108), (116, 128, 148), (168, 178, 194), (48, 56, 76))  # polished blue-grey granite
BASE = ((70, 74, 84), (100, 104, 112), (130, 134, 138), (50, 54, 62))      # plain grey granite for bases
MARBLE = ((142, 148, 164), (196, 200, 204), (236, 236, 228), (108, 114, 132))


def blank():
    return np.zeros((S, S), bool)


def rect(m, x0, y0, x1, y1):
    m[y0:y1 + 1, x0:x1 + 1] = True


def put(a, x, y, c):
    if 0 <= x < S and 0 <= y < S:
        a[y, x] = tuple(c) + (255,)


def shade(a, mask, tones, outline=NAVY, open_foot=True):
    """Paint `mask` into `a`: outline on the mask's own edge pixels, light on the top face and the side turned to the moon
    (right), shadow on the side turned away. open_foot: no outline along the bottom row, where the stone meets the grass."""
    sh, mid, lt, _ = tones
    pad = np.pad(mask, 1)
    up, dn, lf, rt = pad[:-2, 1:-1], pad[2:, 1:-1], pad[1:-1, :-2], pad[1:-1, 2:]
    edge = mask & ~(up & dn & lf & rt)
    inner = mask & ~edge
    e_up = np.pad(edge, 1)[:-2, 1:-1]
    for y in range(S):
        xs = np.nonzero(inner[y])[0]
        for x in range(S):
            if edge[y, x]:
                put(a, x, y, outline)
            elif inner[y, x]:
                c = mid
                if e_up[y, x] or x >= xs.max() - (1 if len(xs) >= 5 else 0):
                    c = lt
                if x == xs.min() and not e_up[y, x]:
                    c = sh
                put(a, x, y, c)
    if open_foot:
        ys = np.nonzero(mask.any(axis=1))[0]
        yb = ys.max()
        for x in range(1, S - 1):
            if edge[yb, x] and mask[yb, x - 1] and mask[yb, x + 1]:
                put(a, x, yb, sh)


def foot(a, x0, x1, seed, front=2):
    """grass at the foot: a dark contact row under the base and blades standing in front of its corners."""
    r = np.random.RandomState(seed)
    for x in range(x0 - 1, x1 + 2):
        put(a, x, 23, D0)
    for side_xs in ((x0 - 2, x0 - 1, x0), (x1, x1 + 1, x1 + 2)):
        for x in side_xs:
            h = int(r.randint(1, 4))
            for k in range(h):
                put(a, x, 22 - k, GT if k == h - 1 else GL)
    for _ in range(front):
        x = int(r.randint(x0 + 1, x1))
        put(a, x, 22, GL); put(a, x, 21, GT if r.rand() < 0.5 else GL)


def new():
    return np.zeros((S, S, 4), np.uint8)


def cross():
    """two plain planks, nothing else: the same simple cross as the original, in its own warm browns."""
    a = new()
    m = blank()
    rect(m, 10, 8, 13, 22)          # upright
    rect(m, 6, 12, 17, 15)          # arm
    shade(a, m, WOOD, outline=BROWN)
    sh, mid, lt, dk = WOOD
    for x in range(7, 17):          # the arm: one lighter top row, one darker under row
        put(a, x, 13, lt); put(a, x, 14, mid)
    put(a, 7, 14, sh)
    for y in range(9, 22):          # the upright: lit right side, shaded left
        if y in (13, 14):
            continue
        put(a, 11, y, mid); put(a, 12, y, lt)
    put(a, 11, 16, sh)              # the arm's shadow on the upright
    put(a, 11, 21, sh); put(a, 12, 21, mid)
    foot(a, 10, 13, 1, front=0)
    return a


def flat():
    """a rough fieldstone marker lying flat: a thin top face and a low front face, sunk into the grass."""
    a = new()
    top = blank(); rect(top, 6, 17, 17, 17); rect(top, 5, 18, 18, 19)
    front = blank(); rect(front, 5, 19, 18, 22)
    sh, mid, lt, en = FIELD
    shade(a, front, (sh, sh, mid, en))
    shade(a, top, (mid, lt, lt, en), open_foot=False)
    for x in range(6, 18):                                  # the edge between the two faces
        put(a, x, 19, mid if x % 5 else sh)
    for x, y in ((8, 18), (9, 18), (10, 18), (13, 18), (14, 18), (15, 18)):   # worn marks where a name was
        put(a, x, y, mid)
    for x, y in ((15, 17), (16, 18)):                                         # a chipped corner
        put(a, x, y, mid)
    put(a, 12, 20, en); put(a, 12, 21, en)                                    # a short crack in the front edge
    for x, y in ((6, 20), (6, 21), (7, 21), (16, 21), (17, 20), (17, 21), (5, 21)):
        put(a, x, y, MOSS_D)
    put(a, 6, 19, MOSS); put(a, 17, 19, MOSS)
    foot(a, 5, 18, 2, front=4)
    return a


def hewn():
    """a small upright stone, rough-hewn: uneven top, a chip out of one shoulder, a crack, moss, no base."""
    a = new()
    m = blank()
    rect(m, 7, 13, 16, 22)
    rect(m, 8, 11, 16, 12)
    rect(m, 10, 10, 15, 10)
    rect(m, 12, 9, 14, 9)
    m[11, 8] = False; m[13, 7] = False                      # the chipped shoulder
    shade(a, m, HEWN)
    sh, mid, lt, en = HEWN
    for x, y in ((12, 11), (12, 12), (13, 13), (13, 14), (12, 15), (12, 16)):
        put(a, x, y, en)
    for x, y in ((9, 15), (10, 15), (9, 17), (10, 17), (11, 17), (14, 16), (15, 18)):
        put(a, x, y, sh)
    for x, y in ((8, 20), (8, 21), (9, 21), (8, 19), (9, 20), (14, 21), (15, 21)):
        put(a, x, y, MOSS_D)
    put(a, 8, 18, MOSS); put(a, 10, 21, MOSS)
    foot(a, 7, 16, 3)
    return a


def granite():
    """cut and polished blue-grey granite: clean arched top with shoulders, a sheen across the face, an engraved cross, a base, flowers."""
    a = new()
    base = blank(); rect(base, 4, 20, 19, 22)
    shade(a, base, BASE)
    for x in range(5, 19):
        put(a, x, 20, BASE[2] if x > 11 else BASE[1])
    m = blank()
    rect(m, 6, 10, 17, 20)
    rect(m, 7, 8, 16, 9)
    rect(m, 8, 7, 15, 7)
    rect(m, 10, 6, 13, 6)
    shade(a, m, GRANITE, open_foot=False)
    sh, mid, lt, en = GRANITE
    for i in range(9):                                      # polished sheen: a diagonal streak of light
        x, y = 8 + i // 2, 17 - i
        for dx in (0, 1):
            if m[y, x + dx] and tuple(a[y, x + dx, :3]) == mid:
                put(a, x + dx, y, lt if dx == 0 else (140, 152, 170))
    for y in range(10, 17):                                 # engraved cross
        put(a, 12, y, en); put(a, 13, y, en)
    for x in range(10, 16):
        put(a, x, 12, en)
    put(a, 13, 10, sh); put(a, 13, 16, sh)
    for x in range(7, 17):
        put(a, x, 19, sh)                                   # where the stone sits on its base
    # a jar of flowers at the right foot
    for x, y, c in ((20, 20, NAVY), (21, 20, NAVY), (19, 21, NAVY), (19, 22, NAVY), (22, 21, NAVY), (22, 22, NAVY),
                    (20, 21, (110, 114, 124)), (20, 22, (110, 114, 124)), (21, 21, (150, 154, 158)), (21, 22, (150, 154, 158)),
                    (20, 19, GT), (21, 19, GT), (21, 18, GT), (20, 18, GT),
                    (20, 17, (188, 168, 124)), (22, 17, (164, 136, 140)), (21, 16, (188, 168, 124)), (21, 17, GT)):
        put(a, x, y, c)
    foot(a, 4, 19, 4)
    put(a, 20, 23, D0); put(a, 21, 23, D0); put(a, 22, 23, D0)
    return a


def marble():
    """tall white marble with a carved cross on top and gold lettering, on a two-step grey granite base, a wreath at its foot."""
    a = new()
    lower = blank(); rect(lower, 3, 21, 20, 22)
    upper = blank(); rect(upper, 5, 19, 18, 21)
    shade(a, lower, BASE)
    shade(a, upper, BASE, open_foot=False)
    for x in range(4, 20):
        put(a, x, 21, BASE[2] if x > 11 else BASE[1])
    for x in range(6, 18):
        put(a, x, 19, BASE[2] if x > 11 else BASE[1])
    put(a, 5, 21, BASE[1]); put(a, 18, 21, BASE[2])
    m = blank()
    rect(m, 7, 9, 16, 19)                                   # body
    rect(m, 8, 8, 15, 8)                                    # shoulders
    rect(m, 10, 1, 13, 8)                                   # the cross's upright
    rect(m, 8, 3, 15, 5)                                    # the cross's arm
    shade(a, m, MARBLE, open_foot=False)
    sh, mid, lt, en = MARBLE
    put(a, 11, 4, mid); put(a, 12, 4, lt)                   # keep the crossing clean
    for x, y in ((9, 15), (10, 16), (14, 11), (13, 10)):    # faint veins
        put(a, x, y, (168, 174, 188))
    for y in (11, 13, 15):                                  # gold lettering
        for x in range(9, 15):
            put(a, x, y, GOLD if (x + y) % 5 else GOLD_D)
    put(a, 14, 15, mid); put(a, 13, 15, mid)                # a short last line
    for x in range(8, 16):
        put(a, x, 18, sh)
    # a small wreath leaning on the left of the base
    for x, y in ((1, 20), (2, 19), (3, 19), (4, 20), (4, 21), (3, 22), (2, 22), (1, 21)):
        put(a, x, y, (46, 70, 48))
    put(a, 2, 19, (64, 92, 60)); put(a, 4, 20, (64, 92, 60)); put(a, 3, 22, (128, 62, 50)); put(a, 2, 22, (128, 62, 50))
    foot(a, 3, 20, 5, front=1)
    return a


if __name__ == '__main__':
    arts = [cross(), flat(), hewn(), granite(), marble()]
    for i, a in enumerate(arts):
        Image.fromarray(a, 'RGBA').save(f'{OUT}/headstone-{i}_24x24.png')
    sheet = Image.new('RGBA', (S * 5 + 24, S + 8), GM + (255,))
    for i, a in enumerate(arts):
        sheet.alpha_composite(Image.fromarray(a, 'RGBA'), (4 + i * (S + 4), 4))
    sheet.resize((sheet.width * 8, sheet.height * 8), Image.NEAREST).convert('RGB').save(f'{OUT}/headstones_lineup_8x.png')

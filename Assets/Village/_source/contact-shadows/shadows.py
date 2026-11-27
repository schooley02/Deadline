"""Contact shadows for the village buildings (2026-11-26). One small shadow PNG per building kind per tier, drawn from the sprite's base outline.
Same footing logic as the ground-v2 mocks (ground2.py shadows()): the shadow hugs the lowest edge of what stands on the ground (the base + the
receding side wall), 2 art px wide chunks (the sprites are chunky 2x), a little ragged, falls LEFT (the moon is top right), with a short run
past the building's left end. Semi-transparent near-black so ONE image reads on both the asphalt pad and the grass.
The shipped set is the "cast" version: the shadow also falls LEFT and a little toward the viewer (Jeremy 2026-11-26: "the moon is on the right so the
shadows should fall to the left"). Every PNG is (sprite width + 16) x 48 and hangs 8 px below the sprite bottom (VillageLayout.SHADOW).
Re-run after ANY change to a building sprite base: python3 shadows.py <Assets/Village> <Assets/Village/shadows> cast   (then delete _meta.json)"""
import sys, os, zlib
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
CAST = len(sys.argv) > 3 and sys.argv[3] == 'cast'   # 'cast': the shadow also falls left and a little toward the viewer (moon top right, behind the scene)
CAST_LEN = 7          # art px the cast reaches left
CAST_A = [150, 138, 124, 108, 90, 70, 48, 30]
KINDS = ['lurkers', 'defense', 'slain', 'goals', 'habits', 'punctuality', 'heroes', 'nights', 'bestdays']
TIERS = range(1, 6)
SH = (6, 12, 14)          # main contact line
SH2 = (4, 9, 10)          # ragged second row
A_MAIN, A_RAG = 178, 124
A_RUN = [150, 108, 66]    # the run past the left end, fading out
PAD_L = 16                # px the image reaches left of the sprite (the run is 3 art px = 6 px)
CANVAS_H, BELOW = 48, 8   # every shadow PNG is (sprite width + PAD_L) x 48 and hangs 8 px below the sprite's bottom edge: the game needs no per-file numbers
KEEP = 30                 # only columns whose lowest pixel is within this many px of the lowest one stand on the ground

def low_edge(al):
    return np.array([np.where(al[:, c])[0].max() if al[:, c].any() else -1 for c in range(al.shape[1])])

def make(kind, tier):
    im = Image.open(f'{SRC}/{kind}_t{tier}.png').convert('RGBA')
    al = np.array(im)[:, :, 3] > 0
    h, w = al.shape
    low = low_edge(al); mb = low.max()
    cols = {}
    for c in range(w):
        if low[c] < mb - KEEP: continue
        ax = c // 2; ay = (low[c] + 2) // 2
        cols[ax] = max(cols.get(ax, -1), ay)
    xs = sorted(cols)
    y0 = min(cols.values()) ; y1 = max(cols.values()) + (1 + CAST_LEN // 3 if CAST else 1)       # art rows (half res), second row included
    aw = (w + PAD_L) // 2; ah = y1 - y0 + 1
    o = np.zeros((ah, aw, 4), np.uint8)
    off = PAD_L // 2
    rs = np.random.RandomState(zlib.crc32(f'{kind}{tier}'.encode()) & 0xffffffff)
    nz = rs.rand(ah, aw)
    def put(y, x, c, a):
        if 0 <= y < ah and 0 <= x < aw: o[y, x, :3] = c; o[y, x, 3] = max(o[y, x, 3], a)
    for ax in xs:
        ay = cols[ax] - y0
        put(ay, ax + off, SH, A_MAIN); put(ay, ax + off - 1, SH, A_MAIN)
        if nz[ay, ax + off] > 0.45: put(ay + 1, ax + off - 1, SH2, A_RAG)
    if CAST:
        for ax in xs:
            ay = cols[ax] - y0
            for k in range(1, CAST_LEN + 1):
                for dy in range(0, k // 3 + 1):
                    if k == CAST_LEN and nz[(ay + dy) % ah, (ax + off - k) % aw] > 0.5: continue   # ragged far edge
                    put(ay + dy, ax + off - k, SH2, CAST_A[k])
            put(ay + 1, ax + off, SH2, CAST_A[3]); put(ay + 1, ax + off - 1, SH2, CAST_A[3])
    first = xs[0]; fy = cols[first] - y0
    for k in range(1, 4 if not CAST else 1): put(fy, first + off - k, SH2, A_RUN[k - 1])
    small = Image.fromarray(o, 'RGBA').resize((aw * 2, ah * 2), Image.NEAREST)
    out = Image.new('RGBA', (w + PAD_L, CANVAS_H), (0, 0, 0, 0))
    ty = int(y0) * 2 - (h + BELOW - CANVAS_H)
    assert ty >= 0 and ty + small.height <= CANVAS_H, (kind, tier, ty, small.height)
    out.paste(small, (0, ty))
    # offsets in sprite px: left = -PAD_L, top = y0 * 2
    return out, {'dx': -PAD_L, 'dy': int(y0) * 2, 'w': int(aw) * 2, 'h': int(ah) * 2}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for k in KINDS:
        for t in TIERS:
            im, m = make(k, t)
            im.save(f'{OUT}/{k}_t{t}.png', optimize=True)
            meta[f'{k}_t{t}'] = m
    import json
    json.dump(meta, open(f'{OUT}/_meta.json', 'w'), indent=1)
    print(len(meta), 'shadows')
    for k in KINDS: print(k, [ (meta[f"{k}_t{t}"]["dx"], meta[f"{k}_t{t}"]["dy"], meta[f"{k}_t{t}"]["w"], meta[f"{k}_t{t}"]["h"]) for t in TIERS])

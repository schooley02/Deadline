"""Contact shadows for the village buildings, FULL resolution (2026-11-26, later the same night: Jeremy asked for the ground set at the buildings' pixel
size; the first version was drawn in 2x chunky pixels). One PNG per building per star from the sprite's own base outline: a dark line hugging the
lowest edge of what stands on the ground, and a cast that falls LEFT and a little toward the viewer (the moon is on the right), fading in four flat
steps. Semi-transparent near-black so one image reads on the asphalt pad and on the grass. Every PNG is (sprite width + 16) x 48 and hangs 8 px below
the sprite's bottom edge (VillageLayout.SHADOW). Re-run after ANY change to a building's base:
usage: python3 shadows.py <Assets/Village> <Assets/Village/shadows>"""
import sys, os, zlib
import numpy as np
from PIL import Image
SRC, OUT = sys.argv[1], sys.argv[2]
KINDS = ['lurkers', 'defense', 'slain', 'goals', 'habits', 'punctuality', 'heroes', 'nights', 'bestdays']
SH, SH2 = (6, 12, 14), (4, 9, 10)
PAD_L, CANVAS_H, BELOW, KEEP = 16, 48, 8, 30
CAST = 14                                             # px the cast reaches left
STEPS = [(3, 150), (7, 116), (11, 82), (14, 48)]      # (up to k px, alpha)
def step_alpha(k):
    for lim, a in STEPS:
        if k <= lim: return a
    return 0
def make(kind, tier):
    al = np.array(Image.open(f'{SRC}/{kind}_t{tier}.png').convert('RGBA'))[:, :, 3] > 0
    h, w = al.shape
    low = np.array([np.where(al[:, c])[0].max() if al[:, c].any() else -1 for c in range(w)]); mb = low.max()
    oy = h + BELOW - CANVAS_H                          # canvas row 0 = sprite row oy
    o = np.zeros((CANVAS_H, w + PAD_L, 4), np.uint8)
    rs = np.random.RandomState(zlib.crc32(f'{kind}{tier}'.encode()) & 0xffffffff)
    reach = np.clip(np.round(CAST - 2 + np.convolve(rs.rand(w + 8) * 4, np.ones(5) / 5, 'same')[:w]), CAST - 3, CAST).astype(int)   # a softly ragged far edge
    def put(y, x, c, a):
        y -= oy; x += PAD_L
        if 0 <= y < CANVAS_H and 0 <= x < w + PAD_L and a > o[y, x, 3]: o[y, x, :3] = c; o[y, x, 3] = a
    for c in range(w):
        if low[c] < 0 or low[c] < mb - KEEP: continue
        b = low[c] + 1
        put(b, c, SH, 178); put(b + 1, c, SH, 178)     # the contact line right under the base
        for k in range(1, reach[c] + 1):
            a = step_alpha(k)
            for dy in range(0, 2 + k // 4): put(b + dy, c - k, SH2, a)
        put(b + 2, c, SH2, 116); put(b + 2, c - 1, SH2, 116)
    return Image.fromarray(o, 'RGBA')
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for k in KINDS:
        for t in range(1, 6): make(k, t).save(f'{OUT}/{k}_t{t}.png', optimize=True)
    print('45 shadows')

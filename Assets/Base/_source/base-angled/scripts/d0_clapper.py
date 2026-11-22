"""0% still: move the fallen bell's clapper to the right (Jeremy 2026-11-22: the bell is no longer upright -- it leans
with its crown to the right -- so the clapper must hang straight down from the crown, right of the mouth's middle).
Usage: python3 d0_clapper.py <d0/base_000_v5.png> <out.png>      (v5 = the still as approved on 2026-11-20)
The drawn clapper (ball x117-119 y131-133, stem above it) is moved DX px right unchanged; its old place is closed
with the mouth's own dark inside colours and the lower lip is carried through. Nothing else is touched."""
import sys, os
import numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
DX = int(os.environ.get("DX", 8))
a = np.array(Image.open(src).convert("RGBA")); o = a.copy()
CLAPPER = [(119, 129), (118, 130), (119, 130)] + [(x, y) for y in (131, 132, 133) for x in (117, 118, 119)]
# close the old place: inside-of-the-mouth darks taken from the same rows just right of it, the lip carried through
FILL = {(119, 129): (19, 20, 22), (118, 130): (16, 17, 19), (119, 130): (18, 19, 21),
        (117, 131): (21, 21, 21), (118, 131): (23, 23, 22), (119, 131): (22, 22, 20),
        (117, 132): (28, 28, 25), (118, 132): (24, 24, 25), (119, 132): (20, 20, 19),
        (117, 133): (46, 43, 36), (118, 133): (31, 30, 26), (119, 133): (26, 25, 23)}
for (x, y), c in FILL.items(): o[y, x, :3] = c
for x, y in CLAPPER: o[y, x + DX] = a[y, x]
Image.fromarray(o).save(dst)
d = (o != a).any(axis=2); ys, xs = np.nonzero(d)
print("px changed", int(d.sum()), "x", xs.min(), xs.max(), "y", ys.min(), ys.max())

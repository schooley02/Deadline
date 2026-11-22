"""Previews for the 0% idle strip.  Usage: python3 preview0.py <strip_16f.png> <still.png> <out_prefix>
Writes <out>_full.gif (2x), <out>_closeup.gif (4x of the rubble) and checks that every pixel the animation changes
is shown in the GIFs in exactly the strip's colour (no palette greying)."""
import sys, os
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gifkit
strip_p, still_p, out = sys.argv[1:4]
W, H, N, BG = 184, 200, 16, (30, 34, 48)
S = Image.open(strip_p).convert("RGBA"); base = np.array(Image.open(still_p).convert("RGBA"))
def over(fr):
    bg = Image.new("RGBA", fr.size, BG + (255,)); bg.alpha_composite(fr); return bg.convert("RGB")
frames = [S.crop((i * W, 0, (i + 1) * W, H)) for i in range(N)]
changed = [(np.array(f) != base).any(axis=2) for f in frames]
exact = sorted({tuple(int(v) for v in np.array(f)[y, x, :3]) for f, c in zip(frames, changed) for y, x in zip(*np.nonzero(c))})
BOX = (14, 88, 174, 196)
full = [over(f).resize((W * 2, H * 2), Image.NEAREST) for f in frames]
close = [over(f).crop(BOX).resize(((BOX[2] - BOX[0]) * 4, (BOX[3] - BOX[1]) * 4), Image.NEAREST) for f in frames]
gifkit.save_gif(full, out + "_full.gif", 8, exact=exact); gifkit.save_gif(close, out + "_closeup.gif", 8, exact=exact)
bad = 0; tot = 0
g = Image.open(out + "_full.gif")
for i in range(N):
    g.seek(i); G = np.array(g.convert("RGB"))[::2, ::2]; T = np.array(over(frames[i]))
    tot += int(changed[i].sum()); bad += int((changed[i] & (G != T).any(axis=2)).sum())
g = Image.open(out + "_closeup.gif")
for i in range(N):
    g.seek(i); G = np.array(g.convert("RGB"))[::4, ::4]; T = np.array(over(frames[i]).crop(BOX)); c = changed[i][BOX[1]:BOX[3], BOX[0]:BOX[2]]
    bad += int((c & (G != T).any(axis=2)).sum())
print("animated colours kept exact:", len(exact), "| animated px:", tot, "| shown in a wrong colour in the GIFs (must be 0):", bad)

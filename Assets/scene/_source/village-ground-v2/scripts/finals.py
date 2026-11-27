"""Final village ground assets (2026-11-26): the grass strip (option B) and the worn-asphalt pad (PixelLab redraw B surface inside the code-drawn shape)."""
import json, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage
import ground as G, ground2 as G2, plpass as PP
W, H, BW = PP.W, PP.H, PP.BW
slots = json.loads(subprocess.check_output(['node', 'slots.js', G.CODE, json.dumps({"W": W, "H": H, "baseW": BW})]))
# 1. grass strip: 640x78 art, shown at 2x (1280x156), top edge at horizon - 90px
field = Image.fromarray(G.field('rises'), 'RGBA'); field.save('final/village-field_640x78.png')
# 2. pad
pl = np.array(Image.open('pl/out_4102_0.png').convert('RGBA')).astype(int)
box = pl[10:26, 236:272, :3]; med = np.median(box.reshape(-1, 3), axis=0); lum = box.sum(-1)
n = 0
for y, x in zip(*np.nonzero(lum > np.median(lum) + 25)):                 # the teal puddle-looking patch: take the clean asphalt 6 rows below
    pl[10 + y, 236 + x, :3] = pl[10 + y + 6, 236 + x, :3]; n += 1
print('puddle pixels repainted', n)
p, mask = G2.pad(slots, W, H, 'asphalt')
art = np.array(p.resize((W // 2, H // 2), Image.NEAREST))
inner = ndimage.binary_erosion(mask)
for y, x in zip(*np.nonzero(inner)):
    py, px = y - PP.Y0, x - PP.X0
    if 0 <= py < PP.CH and 0 <= px < PP.CW: art[y, x] = np.clip(pl[py, px], 0, 255)
ys, xs = np.nonzero(art[..., 3]); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
pad = Image.fromarray(art.astype(np.uint8), 'RGBA').crop((x0, y0, x1, y1)); pad.save('final/village-pad.png')
gym = next(s for s in slots if s['kind'] == 'lurkers'); hz = H - 76
anchor = dict(size=pad.size, shown=(pad.width * 2, pad.height * 2),
              left_from_gym_artLeft_px=int(x0 * 2 - gym['artLeft']), top_from_front_feet_px=int(y0 * 2 - hz), bottom_from_front_feet_px=int(y1 * 2 - hz))
json.dump(anchor, open('final/anchor.json', 'w'), indent=1); print(anchor)

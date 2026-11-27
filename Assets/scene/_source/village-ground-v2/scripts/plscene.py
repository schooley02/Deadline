import json, subprocess, sys
import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage
import ground as G, ground2 as G2, plpass as PP
from ground import img, tile
def scene(W, H, baseW, field_img, pl_img=None, bare=False):
    slots = json.loads(subprocess.check_output(['node', 'slots.js', G.CODE, json.dumps({"W": W, "H": H, "baseW": baseW})]))
    hz = H - 76
    c = Image.new('RGBA', (W, H), (11, 11, 36, 255))
    from PIL import ImageDraw; dr = ImageDraw.Draw(c)
    for y in range(H):
        t = y / H; dr.line([(0, y), (W, y)], fill=(int(11 + 18 * t), int(11 + 20 * t), int(36 + 34 * t), 255))
    c.alpha_composite(img('scene/moon.png'), (W - 30 - 58, 12))
    tile(c, img('scene/mountains.png'), max(-44, hz - 280), 640 - ((W - (30 + 29 - 370)) % 640))
    tile(c, img('scene/treeline.png'), max(-8, hz - 230), 404 - ((W - (30 + 29 - 274)) % 404))
    tile(c, field_img, hz - 90, 0)
    sprites = {s['kind']: img(f"Village/{s['kind']}_t3.png") for s in slots}
    p, mask = G2.pad(slots, W, H, 'asphalt')
    if pl_img is not None:
        # the PixelLab surface inside the pad; the code-drawn crumbled edge, shoulder and weeds stay
        art = np.array(p.resize((W // 2, H // 2), Image.NEAREST)); pl = np.array(pl_img.convert('RGBA'))
        inner = ndimage.binary_erosion(mask)
        # the pad's place in this scene relative to the laptop canvas the PixelLab picture was made on: same cluster, shifted
        ref = json.loads(subprocess.check_output(['node', 'slots.js', G.CODE, json.dumps({"W": PP.W, "H": PP.H, "baseW": PP.BW})]))
        gx = lambda ss: next(s['artLeft'] for s in ss if s['kind'] == 'lurkers')
        dx = (gx(slots) - gx(ref)) // 2; dy = (H - 76) // 2 - PP.HZ
        for y, x in zip(*np.nonzero(inner)):
            py, px = y - dy - PP.Y0, x - dx - PP.X0
            if 0 <= py < PP.CH and 0 <= px < PP.CW: art[y, x] = pl[py, px]
        p = Image.fromarray(art, 'RGBA').resize((W // 2 * 2, H // 2 * 2), Image.NEAREST)
    c.alpha_composite(p)
    c.alpha_composite(G2.shadows(slots, sprites, W, H, mask, 'asphalt'))
    for s in ([] if bare else slots):
        im = sprites[s['kind']]
        if s.get('brightness'):
            al = im.split()[3]; im = ImageEnhance.Brightness(im.convert('RGB')).enhance(s['brightness']).convert('RGBA'); im.putalpha(al)
        x, y = s['left'], s['top']
        c.alpha_composite(im.crop((max(0, -x), max(0, -y), im.size[0], im.size[1])), (max(0, x), max(0, y)))
    lane = img('scene/lane-2track.png').resize((1280, 72), Image.NEAREST); tile(c, lane, H - 72, -(baseW - 235))
    yard = img('scene/lane-yard.png').resize((560, 72), Image.NEAREST); yx = baseW - 384
    c.alpha_composite(yard.crop((max(0, -yx), 0, 560, 72)), (max(0, yx), H - 72))
    gxx = W - 120 - 48
    for f, h in (('graveyard-ground', 80), ('graveyard-fence-back', 104), ('graveyard-fence-front', 48)):
        c.alpha_composite(img(f'scene/{f}.png').resize((168, h), Image.NEAREST), (gxx, H - h))
    b = img('Base/base_100.png').resize((368, 400), Image.NEAREST); bx = baseW - 372; by = H - 398
    c.alpha_composite(b.crop((max(0, -bx), max(0, -by), min(368, baseW - bx), 400)), (max(0, bx), max(0, by)))
    return c
if __name__ == '__main__':
    fb = Image.fromarray(G.field('rises'), 'RGBA').resize((G.AW * 2, G.AH * 2), Image.NEAREST)
    for name, f in (('code', None), ('pl1', 'pl/out_4101_0.png'), ('pl2', 'pl/out_4102_0.png')):
        pl = Image.open(f) if f else None
        for tag, W, H, bw in (('laptop', 1366, 480, 368), ('phone', 800, 306, 188)):
            scene(W, H, bw, fb, pl).convert('RGB').save(f'pl/scene_{name}_{tag}.png')
        scene(1366, 480, 368, fb, pl, bare=True).convert('RGB').save(f'pl/bare_{name}_laptop.png')
    print('ok')

import json, subprocess, sys
from PIL import Image, ImageDraw, ImageEnhance, ImageFont
import numpy as np
P = sys.argv[1] if len(sys.argv) > 1 else "/mnt/user-data/uploads/Deadline"
def img(p): return Image.open(f'{P}/Assets/{p}').convert('RGBA')
FEET = {'career':0.383,'creativity':0.273,'financial':0.359,'health':0.32,'lifestyle':0.219,'relationships':0.047}
def font(sz):
    for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
        try: return ImageFont.truetype(f, sz)
        except Exception: pass
    return ImageFont.load_default()

def tile(dst, src, x0, y0, w, h, sx=0):
    # paint src repeated in x inside box
    sw, sh = src.size
    x = x0 - (sx % sw)
    while x < x0 + w:
        dst.alpha_composite(src, (int(x), int(y0))) if x >= 0 else dst.alpha_composite(src.crop((int(-x),0,sw,sh)), (0,int(y0)))
        x += sw

def lane_feet(lane, H, floorH, topPad, botPad):
    back = H - floorH + topPad; front = H - botPad
    return back + (lane/2.0)*(front-back)

def render(W, H, baseW, floorH=72, topPad=24, botPad=8, slant=30, zs=1.0, floor_img=None, label=''):
    cases = [{"name":"c","W":W,"H":H,"baseW":baseW,"floorH":floorH}]
    d = json.loads(subprocess.check_output(['node','slots.js',P,json.dumps(cases)]))
    slots = d['slots']['c']
    front_feet = max([s['feetY'] for s in slots if s['row']=='front'] or [H-floorH-4])
    c = Image.new('RGBA', (W,H), (11,11,36,255))
    dr = ImageDraw.Draw(c)
    for y in range(H):
        t=y/H; dr.line([(0,y),(W,y)], fill=(int(11+18*t),int(11+20*t),int(36+34*t),255))
    hz = front_feet
    m = img('scene/mountains.png').resize((640,240), Image.NEAREST); tile(c, m, 0, max(-44, hz-280), W, 240, 100)
    t = img('scene/treeline.png').resize((404,168), Image.NEAREST); tile(c, t, 0, max(-8, hz-230), W, 168, 60)
    f = img('scene/village-field.png').resize((505,156), Image.NEAREST); tile(c, f, 0, hz-90, W, 156, 0)
    # floor
    fl = floor_img or img('scene/floor-tile.png')
    tile(c, fl, 0, H-fl.size[1], W, fl.size[1], int(0.15*W))
    # hill
    hill = img('scene/graveyard-hill.png'); c.alpha_composite(hill, (W-192, H-128))
    # village
    for s in slots:
        im = img(f"Village/{s['kind']}_t{s['tier']}.png")
        if im.size != (s['width'], s['height']): im = im.resize((s['width'], s['height']), Image.NEAREST)
        if s.get('flip'): im = im.transpose(Image.FLIP_LEFT_RIGHT)
        if s.get('brightness'):
            a = im.split()[3]; im = ImageEnhance.Brightness(im.convert('RGB')).enhance(s['brightness']).convert('RGBA'); im.putalpha(a)
        x, y = s['left'], s['top']
        box = (max(0,-x), max(0,-y), im.size[0], im.size[1])
        c.alpha_composite(im.crop(box), (max(0,x), max(0,y)))
    # hill again partly in front? (kept simple: hill drawn behind village as in game order unknown)
    # church 2x, right-aligned in base box, 4px bleed
    b = img('Base/base_100.png').resize((368,400), Image.NEAREST)
    bx = baseW - 368 - 4; by = H - 400 + 2
    crop = b.crop((max(0,-bx), max(0,-by), min(368, baseW - bx), 400))
    c.alpha_composite(crop, (max(0,bx), max(0,by)))
    # barricade
    bar = img('Barricade/barricade_solid.png'); c.alpha_composite(bar, (baseW-10-4, H-152))
    # zombies
    zs_list = []
    front_line = baseW + 40
    def add(cat, lane, x):
        z = img(f'Zombies/{cat}-zombie.png')
        if zs != 1.0: z = z.resize((int(128*zs), int(128*zs)), Image.NEAREST)
        w = z.size[0]
        dx = round(slant*(1-lane/2.0)) + round(4 - FEET[cat]*w)
        feet = lane_feet(lane, H, floorH, topPad, botPad)
        zs_list.append((lane, z, int(x+dx), int(round(feet - z.size[1]))))
    for cat, lane in [('health',0),('financial',1),('career',2)]: add(cat, lane, front_line)
    fieldR = W - 140
    for cat, lane in [('creativity',0),('lifestyle',1),('relationships',2)]: add(cat, lane, fieldR - 100)
    add('career',1, front_line + (fieldR-front_line)*0.42); add('health',2, front_line + (fieldR-front_line)*0.60)
    for lane, z, x, y in sorted(zs_list, key=lambda v: v[0]):
        c.alpha_composite(z, (x, y))
    return c, dict(front_feet=front_feet, floor_top=H-floorH, slots=slots)

if __name__ == '__main__':
    out = sys.argv[2]
    for name, W, H, bw in [('phone_800x306', 800, 306, 188), ('tablet_1024x400', 1024, 400, 300)]:
        c, info = render(W, H, bw)
        c2 = c.resize((W*2, H*2), Image.NEAREST)
        c2.save(f'{out}/current_{name}.png')
        print(name, info['front_feet'], info['floor_top'])

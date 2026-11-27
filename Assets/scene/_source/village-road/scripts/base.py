import json, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance
P='/home/claude/jest/proj'; A=P+'/Assets'
def img(p): return Image.open(f'{A}/{p}').convert('RGBA')
def tile(c, im, y, x0):
    x = -x0 % im.width - im.width if x0 else 0
    x = -(x0 % im.width)
    while x < c.width:
        t=Image.new('RGBA',c.size,(0,0,0,0)); t.paste(im,(x,y)); c.alpha_composite(t); x += im.width
def layout(W,H,baseW,tier=3):
    tiers={k:tier for k in ['punctuality','defense','slain','nights','lurkers','heroes','habits','bestdays','goals']}
    js="const C=require('%s/js/config.js');global.CONFIG=C;const V=require('%s/js/villageLayout.js');const s=V.villageSlots(%d,%d,%d,120,%s,V.fromConfig(C));console.log(JSON.stringify({s,p:V.padRect(s),sh:s.map(V.shadowRect)}))"%(P,P,W,H,baseW,json.dumps(tiers))
    return json.loads(subprocess.check_output(['node','-e',js]))
def paste(c, im, x, y):
    t=Image.new('RGBA',c.size,(0,0,0,0)); t.paste(im,(x,y)); c.alpha_composite(t)
def scene(W,H,baseW,ground=None,props=None,tier=3):
    """ground(c, d, hz): draws on the ground layer after the field and before the pad. props(c, d, hz): after the pad, before the buildings."""
    d=layout(W,H,baseW,tier); slots=d['s']; hz=H-76
    c=Image.new('RGBA',(W,H),(11,11,36,255)); dr=ImageDraw.Draw(c)
    for y in range(H):
        t=y/H; dr.line([(0,y),(W,y)],fill=(int(11+18*t),int(11+20*t),int(36+34*t),255))
    paste(c,img('scene/moon.png'),W-30-58,12)
    tile(c,img('scene/mountains.png'),max(-44,hz-280),640-((W-(30+29-370))%640))
    tile(c,img('scene/treeline.png'),max(-8,hz-230),404-((W-(30+29-274))%404))
    f=img('scene/village-field.png'); f=f.resize((f.width*2,f.height*2),Image.NEAREST); tile(c,f,hz-90,0)
    if ground: ground(c,d,hz)
    p=img('scene/village-pad.png').resize((d['p']['width'],d['p']['height']),Image.NEAREST); paste(c,p,d['p']['left'],d['p']['top'])
    if props: props(c,d,hz)
    rows={}
    for i,s in enumerate(slots): rows.setdefault(s['row'],[]).append(i)
    for row in ('far','back','front'):
        for i in rows.get(row,[]):
            r=d['sh'][i]; sh=Image.open(P+'/'+r['url']).convert('RGBA'); sh.putalpha(sh.split()[3].point(lambda v:int(v*r['opacity']))); paste(c,sh,r['left'],r['top'])
        for i in rows.get(row,[]):
            s=slots[i]; im=img('Village/%s_t%d.png'%(s['kind'],tier))
            if s.get('brightness') and s['brightness']<1:
                al=im.split()[3]; im=ImageEnhance.Brightness(im.convert('RGB')).enhance(s['brightness']).convert('RGBA'); im.putalpha(al)
            paste(c,im,s['left'],s['top'])
    lane=img('scene/lane-2track.png').resize((1280,72),Image.NEAREST); tile(c,lane,H-72,(baseW-235))
    yard=img('scene/lane-yard.png').resize((560,72),Image.NEAREST); paste(c,yard,baseW-384,H-72)
    gx=W-120-48
    for fn,h in (('graveyard-ground',80),('graveyard-fence-back',104),('graveyard-fence-front',48)):
        paste(c,img(f'scene/{fn}.png').resize((168,h),Image.NEAREST),gx,H-h)
    b=img('Base/base_100.png').resize((368,400),Image.NEAREST); paste(c,b.crop((0,0,368+min(0,baseW-368)+4,400)),baseW-372,H-398)
    return c,d
if __name__=='__main__':
    c,d=scene(1366,480,368); c.convert('RGB').save('base_laptop.png')
    print(d['p'], [(s['kind'],s['artLeft'],s['artRight'],s['feetY']) for s in d['s']])
    print(img('scene/lane-2track.png').size, img('Base/base_100.png').size, img('scene/graveyard-ground.png').size)

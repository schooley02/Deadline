import sys, json, subprocess, random
sys.path.insert(0,'/home/claude/audit')
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
import mock
P='/mnt/user-data/uploads/Deadline'; mock.P=P
img=mock.img
def pl_band(name, W=1280):
    src=Image.open(f'pl_out/{name}.png').convert('RGBA')
    sky=src.getpixel((128,20))
    b=src.crop((0,56,256,128)); px=b.load()
    for y in range(0,9):
        for x in range(256):
            p=px[x,y]
            if sum(abs(p[i]-sky[i]) for i in range(3))<26: px[x,y]=(0,0,0,0)
    t=Image.new('RGBA',(W,72),(0,0,0,0)); x=0; flip=False
    while x<W:
        t.alpha_composite(b.transpose(Image.FLIP_LEFT_RIGHT) if flip else b,(x,0)); x+=256; flip=not flip
    return t
def scene(W,H,baseW,floor,slant_cluster,barricade,shadows=False,sx=None):
    slots=json.loads(subprocess.check_output(['node','slots.js',P,json.dumps([{"name":"c","W":W,"H":H,"baseW":baseW,"floorH":72}])]))['slots']['c']
    hz=max(s['feetY'] for s in slots if s['row']=='front')
    c=Image.new('RGBA',(W,H),(11,11,36,255)); dr=ImageDraw.Draw(c)
    for y in range(H):
        t=y/H; dr.line([(0,y),(W,y)],fill=(int(11+18*t),int(11+20*t),int(36+34*t),255))
    mock.tile(c,img('scene/mountains.png').resize((640,240),Image.NEAREST),0,max(-44,hz-280),W,240,100)
    mock.tile(c,img('scene/treeline.png').resize((404,168),Image.NEAREST),0,max(-8,hz-230),W,168,60)
    mock.tile(c,img('scene/village-field.png').resize((505,156),Image.NEAREST),0,hz-90,W,156,0)
    mock.tile(c,floor,0,H-72,W,72,(int(0.15*W) if floor.size[0]>=1280 else 0) if sx is None else sx)
    c.alpha_composite(img('scene/graveyard-hill.png'),(W-192,H-128))
    for s in slots:
        im=img(f"Village/{s['kind']}_t{s['tier']}.png")
        if s.get('flip'): im=im.transpose(Image.FLIP_LEFT_RIGHT)
        if s.get('brightness'):
            a=im.split()[3]; im=ImageEnhance.Brightness(im.convert('RGB')).enhance(s['brightness']).convert('RGBA'); im.putalpha(a)
        x,y=s['left'],s['top']; c.alpha_composite(im.crop((max(0,-x),max(0,-y),im.size[0],im.size[1])),(max(0,x),max(0,y)))
    b=img('Base/base_100.png').resize((368,400),Image.NEAREST); bx=baseW-372; by=H-398
    c.alpha_composite(b.crop((max(0,-bx),max(0,-by),min(368,baseW-bx),400)),(max(0,bx),max(0,by)))
    if barricade: c.alpha_composite(img('Barricade/barricade_solid.png'),(baseW-14,H-152))
    zl=[]; fl=baseW+40; fr=W-140
    def add(cat,lane,x,slant):
        z=img(f'Zombies/{cat}-zombie.png'); dx=round(slant*(1-lane/2.0))+round(4-mock.FEET[cat]*128)
        zl.append((lane,z,int(x+dx),int(round(mock.lane_feet(lane,H,72,24,8)-128))))
    for cat,lane in [('health',0),('financial',1),('career',2)]: add(cat,lane,fl,slant_cluster)
    for cat,lane in [('creativity',0),('lifestyle',1),('relationships',2)]: add(cat,lane,fr-100-slant_cluster,slant_cluster)
    add('career',1,fl+(fr-fl)*0.45,30)
    for lane,z,x,y in sorted(zl,key=lambda v:v[0]):
        if shadows:
            bb=z.getbbox(); sh=Image.new('RGBA',c.size,(0,0,0,0)); sd=ImageDraw.Draw(sh)
            cx=x+(bb[0]+bb[2])//2; fy=y+bb[3]-2; hw=(bb[2]-bb[0])//2+4
            sd.ellipse([cx-hw,fy-4,cx+hw,fy+4],fill=(8,8,18,110)); c.alpha_composite(sh)
        c.alpha_composite(z,(x,y))
    return c

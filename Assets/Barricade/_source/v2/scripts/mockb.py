import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
U='/mnt/user-data/uploads/Deadline/Assets/'; O='/mnt/user-data/outputs/Assets/scene/'
FEET={'career':0.383,'financial':0.359,'health':0.32}
def img(p): return Image.open(p).convert('RGBA')
def scene(W,H,baseW,barricade=None,bpos=None,slant=88,zombies=True,guide=False,storm=False,layered=False,lane_img=None,yard_img=None):
    c=Image.new('RGBA',(W,H),(11,11,36,255)); d=ImageDraw.Draw(c)
    for y in range(H):
        t=y/H; d.line([(0,y),(W,y)],fill=(int(11+18*t),int(11+20*t),int(36+34*t),255))
    pre='storm-' if storm else ''
    lane=lane_img if lane_img is not None else img(O+pre+'lane-2track.png'); x=baseW-235
    while x>0: x-=1280
    while x<W:
        c.alpha_composite(lane.crop((max(0,-x),0,1280,72)),(max(0,x),H-72)); x+=1280
    yard=yard_img if yard_img is not None else img(O+pre+'lane-yard.png'); yx=baseW-384; c.alpha_composite(yard.crop((max(0,-yx),0,560,72)),(max(0,yx),H-72))
    b=img(U+'Base/base_100.png').resize((368,400),Image.NEAREST); bx=baseW-368-4; by=H-400+2
    c.alpha_composite(b.crop((max(0,-bx),max(0,-by),368,400)),(max(0,bx),max(0,by)))
    fl=baseW+40
    zs=[]
    if zombies:
        for cat,lane_i in (('health',0),('financial',1),('career',2)):
            z=img(U+f'Zombies/{cat}-zombie.png'); dx=round(slant*(1-lane_i/2))+round(4-FEET[cat]*128)
            feet=(H-72+24)+(lane_i/2)*((H-8)-(H-72+24))
            zs.append((lane_i,z,int(fl+dx),int(feet),fl+4+round(slant*(1-lane_i/2))))
    def drawz(t):
        lane_i,z,x,feet,fx=t
        sh=Image.new('RGBA',c.size,(0,0,0,0)); ImageDraw.Draw(sh).ellipse([x+34,feet-4,x+94,feet+4],fill=(0,0,0,110)); c.alpha_composite(sh)
        c.alpha_composite(z,(x,feet-128))
    if barricade is not None:
        px,py=bpos if bpos else (baseW-10-4,H-barricade.size[1])
        if layered and zs:
            # wall columns left of a zombie's front foot are nearer the camera than that zombie; columns right of it are farther
            cuts=[W]+[t[4] for t in zs]+[-10**6]          # back foot x, mid, front
            for i,t in enumerate(zs):                      # back lane first
                lo,hi=cuts[i+1],cuts[i]
                sl=barricade.crop((max(0,lo-px),0,max(0,min(barricade.size[0],hi-px)),barricade.size[1])) if hi-px>0 and lo-px<barricade.size[0] else None
                if sl is not None and sl.size[0]>0: c.alpha_composite(sl,(px+max(0,lo-px),py))
                drawz(t)
            lo=cuts[-2]; sl=barricade.crop((0,0,max(0,min(barricade.size[0],lo-px)),barricade.size[1]))
            if sl.size[0]>0: c.alpha_composite(sl,(px,py))
        else:
            c.alpha_composite(barricade,(px,py))
            for t in zs: drawz(t)
    else:
        for t in zs: drawz(t)
    if guide:
        d=ImageDraw.Draw(c); d.line([(fl+4,H-8),(fl+4+slant,H-48)],fill=(255,80,80,255))
    return c
if __name__=='__main__':
    f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',16)
    W,H,bw=420,250,188
    tiers=['none','partial','solid','reinforced']
    sh=Image.new('RGB',(W*2*2+8,(H*2+26)*2),(18,18,28)); d=ImageDraw.Draw(sh)
    for i,t in enumerate(tiers):
        im=scene(W,H,bw,img(U+f'Barricade/barricade_{t}.png'),guide=True)
        x=(i%2)*(W*2+8); y=(i//2)*(H*2+26)
        d.text((x+6,y+4),f'current "{t}" art on the new ground, zombies on the new 88px diagonal (red line)',font=f,fill=(255,255,255))
        sh.paste(im.resize((W*2,H*2),Image.NEAREST).convert('RGB'),(x,y+26))
    sh.save('current_mismatch.png'); print(sh.size)

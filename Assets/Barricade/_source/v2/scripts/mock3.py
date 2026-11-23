import sys; sys.path.insert(0,'.')
from PIL import Image, ImageDraw, ImageFont
import mockb as M, prep
G='/home/claude/work/grass/k2/'
def x2(im): return im.resize((im.size[0]*2,im.size[1]*2),Image.NEAREST)
CL=x2(Image.open(G+'lane_two_track_640x36.png').convert('RGBA')); CY=x2(Image.open(G+'base_yard_280x36.png').convert('RGBA'))
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',16)
def scene_gap(W,H,baseW,art,gap,cut=14,off=10,zombies=True,shift=0):
    """art: trimmed barricade art px. gap: zombie front line = church width + gap. The ground (yard edge, lane) moves with the gap."""
    a0,b,_,_=prep.baseline(art); wall=x2(art)
    xb=baseW+gap-14-off; px=round(xb-2.2*cut); py=round(H+cut-2*a0)
    # ground anchored to the gap: built for gap 40
    M_scene=M.scene
    import mockb
    old=mockb.scene
    c=_scene(W,H,baseW,wall,(px,py),gap,zombies)
    return c
def _scene(W,H,baseW,wall,pos,gap,zombies,ground_dx=None):
    import numpy as np
    U=M.U
    c=Image.new('RGBA',(W,H),(11,11,36,255)); d=ImageDraw.Draw(c)
    for y in range(H):
        t=y/H; d.line([(0,y),(W,y)],fill=(int(11+18*t),int(11+20*t),int(36+34*t),255))
    dx=gap-40 if ground_dx is None else ground_dx
    x=baseW-235+dx
    while x>0: x-=1280
    while x<W:
        c.alpha_composite(CL.crop((max(0,-x),0,1280,72)),(max(0,x),H-72)); x+=1280
    yx=baseW-384+dx; c.alpha_composite(CY.crop((max(0,-yx),0,560,72)),(max(0,yx),H-72))
    b=M.img(U+'Base/base_100.png').resize((368,400),Image.NEAREST); bx=baseW-368-4; by=H-400+2
    c.alpha_composite(b.crop((max(0,-bx),max(0,-by),368,400)),(max(0,bx),max(0,by)))
    px,py=pos; box=(max(0,-px),max(0,-py),min(wall.size[0],W-px),min(wall.size[1],H-py)); c.alpha_composite(wall.crop(box),(max(0,px),max(0,py)))
    fl=baseW+gap
    if zombies:
        for cat,lane_i in (('health',0),('financial',1),('career',2)):
            z=M.img(U+f'Zombies/{cat}-zombie.png'); zx=round(88*(1-lane_i/2))+round(4-M.FEET[cat]*128)
            feet=int((H-48)+(lane_i/2)*40)
            sh=Image.new('RGBA',c.size,(0,0,0,0)); ImageDraw.Draw(sh).ellipse([fl+zx+34,feet-4,fl+zx+94,feet+4],fill=(0,0,0,110)); c.alpha_composite(sh)
            c.alpha_composite(z,(int(fl+zx),feet-128))
    return c
def sheet(art,gaps,out,W=420,H=250,bw=188,cut=14):
    sh=Image.new('RGB',((W*2+8)*len(gaps),(H*2+26)*2),(18,18,28)); d=ImageDraw.Draw(sh)
    for i,g in enumerate(gaps):
        for j,z in enumerate((False,True)):
            im=scene_gap(W,H,bw,art,g,cut=cut,zombies=z); x=i*(W*2+8); y=j*(H*2+26)
            d.text((x+6,y+4),f'zombies stop {g}px from the church' + (' (today)' if g==40 else f' ({40-g}px more lane)'),font=f,fill=(255,255,255)); sh.paste(x2(im).convert('RGB'),(x,y+26))
    sh.save(out)
if __name__=='__main__':
    art=Image.open('prep_edit_s201_0.png').convert('RGBA')
    sheet(art,(40,24,12),'mock_gap.png')

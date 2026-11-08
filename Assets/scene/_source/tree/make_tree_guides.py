from PIL import Image, ImageDraw
import math, random
W,H=192,128; TX=146  # trunk base column; art bottom row = 127
BARK=(38,32,58); LEAF=(30,44,66); RIM=(120,118,160)
def trunk(d, top_y, lean, base_w, top_w):
    # tapered trunk from (TX,127) curving left to (TX-lean, top_y)
    pts_l=[];pts_r=[]
    n=40
    for i in range(n+1):
        t=i/n; y=127-(127-top_y)*t
        x=TX-lean*(t**1.6)
        w=base_w+(top_w-base_w)*t
        if t<0.12: w+= (0.12-t)*40  # root flare
        pts_l.append((x-w/2,y)); pts_r.append((x+w/2,y))
    d.polygon(pts_l+pts_r[::-1],fill=BARK)
    return TX-lean, top_y
def branch(d,x0,y0,x1,y1,w):
    d.line([(x0,y0),(x1,y1)],fill=BARK,width=w)
def clump(d,cx,cy,rx,ry,seed):
    r=random.Random(seed)
    for k in range(9):
        a=r.uniform(0,2*math.pi); dx=math.cos(a)*rx*0.5; dy=math.sin(a)*ry*0.4
        rr=r.uniform(0.45,0.7)
        d.ellipse([cx+dx-rx*rr,cy+dy-ry*rr,cx+dx+rx*rr,cy+dy+ry*rr],fill=LEAF)
def make(stage):
    im=Image.new('RGB',(W,H),(255,255,255)); d=ImageDraw.Draw(im)
    if stage==1:   # sapling ~45px
        tx,ty=trunk(d,90,6,5,2)
        branch(d,tx,ty+10,tx-10,ty+2,2); branch(d,tx+1,ty+16,tx+8,ty+8,2)
        clump(d,tx-4,ty-2,14,9,1); clump(d,tx-12,ty+4,8,6,2); clump(d,tx+7,ty+6,7,5,3)
    elif stage==2: # young ~80px
        tx,ty=trunk(d,62,22,10,5)
        branch(d,tx+6,ty+24,tx-24,ty+4,4); branch(d,tx,ty+6,tx-36,ty-2,3); branch(d,tx+10,ty+30,tx+18,ty+12,3)
        clump(d,tx-8,ty-6,30,14,4); clump(d,tx-36,ty+2,18,10,5); clump(d,tx+12,ty+6,14,9,6)
    else:          # giant ~110px, leaning left, canopy sweeping left past the obelisk
        tx,ty=trunk(d,50,40,18,8)
        branch(d,tx+14,ty+40,tx-40,ty+16,6); branch(d,tx+4,ty+14,tx-80,ty+2,5)
        branch(d,tx-40,ty+16,tx-70,ty+30,3); branch(d,tx+18,ty+50,tx+30,ty+26,4)
        clump(d,tx-14,ty-10,44,16,7); clump(d,tx-64,ty-2,30,12,8); clump(d,tx-92,ty+8,18,9,9)
        clump(d,tx+26,ty+12,18,10,10); clump(d,tx-70,ty+28,14,7,11)
    im.save(f'tree/tree_guide_s{stage}_192x128_whitebg.png')
    # transparent version for the scene mock
    t=im.convert('RGBA'); px=t.load()
    for y in range(H):
        for x in range(W):
            if px[x,y][:3]==(255,255,255): px[x,y]=(0,0,0,0)
    t.save(f'tree/tree_guide_s{stage}.png')
    bb=t.getbbox(); print(stage,'bbox',bb,'height',bb[3]-bb[1])
for s in (1,2,3): make(s)

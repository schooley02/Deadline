"""Treeline rework, round 1: three code-drawn directions (A mixed woods, B ragged pines, C late-autumn bare).
404x168 tile, 1 art px = 1 screen px, tiles in x, low gap kept at column 130 (sits under the moon). Moon on the RIGHT."""
import math, random
import numpy as np
from PIL import Image, ImageDraw
W,H=404,168
# index buffers: 0 empty, 1 dark, 2 mid, 3 light, 4 trunk-dark, 5 trunk-light
PAL={
 'far':  {1:(40,39,70),  2:(46,46,78),  3:(53,54,87),  4:(36,35,64),  5:(46,46,78)},
 'mid':  {1:(27,28,52),  2:(34,37,62),  3:(44,50,74),  4:(24,24,46),  5:(36,37,60)},
 'near': {1:(15,17,33),  2:(23,28,44),  3:(36,45,60),  4:(14,14,28),  5:(30,29,44)},
}
def blank(w,h): return np.zeros((h,w),np.uint8)
def poly(buf,pts,v):
    im=Image.fromarray(buf); ImageDraw.Draw(im).polygon([(round(x),round(y)) for x,y in pts],fill=v); buf[:]=np.array(im)
def line(buf,p0,p1,v,width=1):
    im=Image.fromarray(buf); ImageDraw.Draw(im).line([tuple(map(round,p0)),tuple(map(round,p1))],fill=v,width=width); buf[:]=np.array(im)
def shade_top_right(mask,cx,soft=True):
    """Flat three-tone shading for a foliage mask lit from the upper right: top surfaces right of the trunk catch the light."""
    h,w=mask.shape; out=blank(w,h)
    run=np.zeros((h,w),np.int32)
    for y in range(h):
        run[y]=np.where(mask[y], (run[y-1]+1 if y else 0), 0)
    xs=np.arange(w)[None,:].repeat(h,0)
    right=xs>=cx-1
    out[mask]=1
    out[mask&right&(run<=3)]=2
    out[mask&~right&(run<=1)]=2
    out[mask&right&(run<=1)]=3
    # an exposed right-hand edge (empty to the right) also catches a little light
    er=mask.copy(); er[:,:-1]&=~mask[:,1:]; er[:,-1]=False
    out[er&right&(run<=5)]=np.maximum(out[er&right&(run<=5)],2)
    return out
def conifer(rng,h,w,ragged=0.0,bare=0.18,dead=False):
    """A pine / spruce. h tall, w = half-width at the lowest boughs. ragged 0..1 = missing and uneven boughs. Returns (buf, cx, basey)."""
    pad=4; bw=int(2*w+2*pad+8); bh=h+6; cx=bw//2; buf=blank(bw,bh); m=np.zeros((bh,bw),bool)
    lean=rng.uniform(-0.04,0.04)*(1+ragged)
    def tx(y): return cx+lean*(bh-y)
    top=2; y=top+rng.randint(4,8); bare_y=top+h*(1-bare*rng.uniform(0.6,1.4))
    tiers=[]
    while y<bare_y:
        t=(y-top)/h
        tiers.append((y,t)); y+=2.2+5.0*t+rng.uniform(-0.6,1.2)
    fm=blank(bw,bh)
    for (y,t) in tiers:
        for side in (-1,1):
            if rng.random()<0.10+0.30*ragged*(0.4+t): continue
            L=w*(0.10+0.90*t**0.85)*rng.uniform(0.62-0.25*ragged,1.12+0.12*ragged)
            if L<1.5: L=1.5
            droop=L*rng.uniform(0.30,0.60); th=1.6+L*rng.uniform(0.16,0.26)
            x0=tx(y)
            pts=[(x0,y-1),(x0+side*L*0.55,y+droop*0.30-1),(x0+side*L,y+droop),(x0+side*L*0.62,y+droop*0.62+th*0.55),(x0+side*L*0.25,y+th+droop*0.2),(x0,y+th)]
            poly(fm,pts,1)
            for _ in range(int(L//4)):                       # hanging tufts along the underside
                u=rng.uniform(0.3,0.95); px=x0+side*L*u; py=y+droop*u+th*(1-u)*0.5
                line(fm,(px,py),(px,py+rng.randint(1,3)),1)
    line(fm,(tx(top),top),(tx(top+10),top+10),1)             # leader
    m=fm>0
    if dead: m[:]=False
    out=shade_top_right(m,cx)
    # trunk: shows below the boughs and through gaps
    tw=1 if h<70 else 2
    tr=blank(bw,bh)
    for yy in range(top+3 if dead else int(top+h*0.25),bh):
        x=int(round(tx(yy)))
        tr[yy,x:x+tw]=4
        if tw>1: tr[yy,x+tw-1]=5
    if dead or ragged>0.3:                                   # dead stubs on the bare length
        y0=top+6 if dead else int(bare_y)-int(h*0.2)
        for _ in range(rng.randint(3,6) if dead else rng.randint(1,3)):
            yy=rng.randint(y0,bh-12); s=rng.choice((-1,1)); L=rng.randint(3,8 if dead else 6)
            line(tr,(tx(yy),yy),(tx(yy)+s*L,yy-rng.randint(0,2)),4)
    res=np.where(out>0,out,tr)
    if dead:                                                 # broken top
        res[:top+3]=0
    return res,cx,bh
def clump(rng,rx,ry,n=14,rough=0.28):
    pts=[]; ph=rng.uniform(0,6.28)
    for i in range(n):
        a=6.2832*i/n; r=1+rough*math.sin(3*a+ph)*rng.uniform(0.3,1)+rng.uniform(-rough,rough)*0.6
        pts.append((math.cos(a)*rx*r, math.sin(a)*ry*r))
    return pts
def skeleton(rng,buf,x,y,ang,ln,wd,depth,ends,spread=0.55,shrink=(0.62,0.80),up=0.12):
    x2=x+math.sin(ang)*ln; y2=y-math.cos(ang)*ln
    line(buf,(x,y),(x2,y2),4,max(1,int(round(wd))))
    if wd>=2.4: line(buf,(x+wd/2-0.5,y),(x2+wd/2-0.5,y2),5,1)          # moonlit right edge of thick limbs
    if depth==0 or ln<3: ends.append((x2,y2)); return
    n=2 if rng.random()<0.7 else 3
    for i in range(n):
        da=rng.uniform(0.18,spread)*(1 if i%2 else -1)
        if n==3 and i==2: da=rng.uniform(-0.15,0.15)
        na=(ang+da)*(1-up)
        skeleton(rng,buf,x2,y2,na,ln*rng.uniform(*shrink),wd*0.62,depth-1,ends,spread,shrink,up)
def broadleaf(rng,h,cw,cover=1.0):
    """A leafy tree (oak / maple build): tall uneven crown made of many overlapping flat pads, with gaps and limbs showing. cover<1 thins the leaves."""
    bw=int(cw*1.5)+30; bh=int(h*1.12)+6; cx=bw//2; sk=blank(bw,bh); ends=[]
    skeleton(rng,sk,cx,bh-1,rng.uniform(-0.05,0.05),h*rng.uniform(0.30,0.38),max(2,h/24),3,ends,spread=0.48,shrink=(0.60,0.78),up=0.18)
    top=bh-h; ccy=top+h*0.36; ry0=h*0.36; rx0=cw*0.5
    lop=rng.uniform(-0.25,0.25)                              # lopsided crowns: no two alike
    pads=[]
    n=int(26*cover*(cw/50)*(h/90))+6
    for _ in range(n):
        a=rng.uniform(0,6.2832); r=rng.random()**0.6
        x=cx+math.cos(a)*rx0*r*(1+lop*math.sin(a))+lop*rx0*0.3; y=ccy+math.sin(a)*ry0*r
        pads.append((x,y))
    for (x,y) in ends:
        if rng.random()<cover: pads.append((x,y))
    pads.sort(key=lambda p:-p[1])
    lay=blank(bw,bh)
    for (x,y) in pads:
        rx=rng.uniform(4.5,9.5)*(cw/56); ry=rx*rng.uniform(0.50,0.80)
        pm=blank(bw,bh); poly(pm,[(x+px,y+py) for px,py in clump(rng,rx,ry)],1); pm=pm>0
        sh=shade_top_right(pm,int(x-rx*0.3))
        lay=np.where(pm,sh,lay)
    return np.where(lay>0,lay,sk),cx,bh
def bare(rng,h,spread=0.46,twigs=5):
    bw=int(h*1.5)+24; bh=int(h*1.2)+6; cx=bw//2; sk=blank(bw,bh); ends=[]
    skeleton(rng,sk,cx,bh-1,rng.uniform(-0.07,0.07),h*rng.uniform(0.27,0.33),max(2,h/22),twigs,ends,spread=spread,shrink=(0.62,0.82),up=0.14)
    return sk,cx,bh
def put(canvas,buf,cx,bh,x,basey,layer):
    """Composite an index buffer onto the RGBA canvas with x wrap-around so the strip tiles."""
    pal=PAL[layer]; h,w=buf.shape
    for dx in (-W,0,W):
        x0=int(x-cx+dx); y0=int(basey-bh)
        for yy in range(h):
            Y=y0+yy
            if Y<0 or Y>=H: continue
            row=buf[yy]
            for xx in np.nonzero(row)[0]:
                X=x0+xx
                if 0<=X<W: canvas[Y,X]=(*pal[row[xx]],255)
def gapk(x):
    """0 at the low gap (column 130), 1 away from it (wraps)."""
    d=min(abs(x-130),W-abs(x-130)); return min(1,max(0,(d-10)/26))
def understory(rng,canvas,layer,top,amp,tone=1,bumps=1):
    """Brush along the foot of a layer: a row of uneven shrubs (lit from the upper right like the trees) over a solid fill."""
    pal=PAL[layer]; ph=[rng.uniform(0,6.28) for _ in range(4)]
    def edge(x):
        a=6.2832*(x%W)/W
        return top+amp*(0.5*math.sin(2*a+ph[0])+0.3*math.sin(5*a+ph[1])+0.2*math.sin(11*a+ph[2]))
    for x in range(W):
        canvas[int(edge(x))+2:,x]=(*pal[tone],255)
    x=rng.uniform(0,8)
    while x<W:
        rx=rng.uniform(4,10); ry=rx*rng.uniform(0.45,0.8)
        bw=int(rx*2+10); bh=int(ry*2+8); pm=blank(bw,bh); poly(pm,[(bw/2+px,bh/2+py) for px,py in clump(rng,rx,ry,12,0.35)],1); pm=pm>0
        put(canvas,shade_top_right(pm,bw//2-2),bw//2,bh,x,int(edge(x))+bh//2+2+rng.randint(0,2),layer)
        x+=rx*rng.uniform(0.9,1.9)
def brush(rng,canvas,layer,top,n,size=(5,11)):
    """Taller undergrowth: a second pass of shrubs and saplings poking above the brush line."""
    for _ in range(n):
        x=rng.uniform(0,W); rx=rng.uniform(*size); ry=rx*rng.uniform(0.6,1.0)
        bw=int(rx*2+10); bh=int(ry*2+8); pm=blank(bw,bh); poly(pm,[(bw/2+px,bh/2+py) for px,py in clump(rng,rx,ry,12,0.40)],1); pm=pm>0
        put(canvas,shade_top_right(pm,bw//2-2),bw//2,bh,x,top+bh//2+rng.randint(-2,3),layer)
def build(kind,seed):
    rng=random.Random(seed); c=np.zeros((H,W,4),np.uint8)
    ph=[rng.uniform(0,6.28) for _ in range(3)]
    def dens(x,layer):
        a=6.2832*(x%W)/W; off={'far':0,'mid':1.7,'near':3.3}[layer]
        return 0.5+0.5*(0.6*math.sin(3*a+ph[0]+off)+0.4*math.sin(7*a+ph[1]+off*0.6))
    def row(layer,n,base,hrange,maker,jit=0.35,gapcut=0.45,open_=0.0):
        step=W/n; xs=[(i+0.5+rng.uniform(-jit,jit))*step for i in range(n)]; rng.shuffle(xs)
        for x in xs:
            if open_ and dens(x,layer)<open_: continue
            k=gapk(x%W); h=int(rng.uniform(*hrange)*(1-gapcut*(1-k)))
            buf,cx,bh=maker(rng,h,layer)
            put(c,buf,cx,bh,x,base+rng.randint(-2,2),layer)
    if kind=='A':      # mixed woods
        def far(r,h,l): return conifer(r,h,h*r.uniform(0.13,0.17),0.15)
        def mid(r,h,l):
            if r.random()<0.55: return broadleaf(r,int(h*0.88),int(h*0.56))
            return conifer(r,h,h*r.uniform(0.14,0.18),0.25)
        def near(r,h,l):
            q=r.random()
            if q<0.42: return broadleaf(r,int(h*0.88),int(h*0.58))
            if q<0.52: return bare(r,int(h*0.72))
            if q<0.58: return conifer(r,int(h*0.7),h*0.1,0.5,dead=True)
            return conifer(r,h,h*r.uniform(0.15,0.19),0.30)
        row('far',28,142,(72,104),far); understory(rng,c,'far',116,4)
        row('mid',17,148,(92,128),mid); understory(rng,c,'mid',125,4)
        row('near',12,156,(110,150),near); understory(rng,c,'near',134,3)
    elif kind=='A2':   # mixed woods with stands and openings, more undergrowth
        def far(r,h,l): return conifer(r,h,h*r.uniform(0.13,0.17),0.12)
        def mid(r,h,l):
            if r.random()<0.5: return broadleaf(r,int(h*0.88),int(h*0.56))
            return conifer(r,h,h*r.uniform(0.14,0.18),0.15)
        def near(r,h,l):
            q=r.random()
            if q<0.45: return broadleaf(r,int(h*0.88),int(h*0.58))
            if q<0.52: return bare(r,int(h*0.72))
            if q<0.56: return conifer(r,int(h*0.7),h*0.1,0.5,dead=True)
            return conifer(r,h,h*r.uniform(0.15,0.19),0.18)
        row('far',30,142,(72,104),far); understory(rng,c,'far',116,4)
        row('mid',19,148,(92,128),mid,open_=0.22); understory(rng,c,'mid',125,4); brush(rng,c,'mid',124,10)
        row('near',14,156,(110,150),near,open_=0.30); understory(rng,c,'near',134,3); brush(rng,c,'near',133,14,(5,12))
    elif kind=='B2':   # fuller pines: mostly healthy, a few ragged / dead, stands and openings, undergrowth
        def far(r,h,l): return conifer(r,h,h*r.uniform(0.14,0.18),0.08,bare=0.14)
        def mid(r,h,l):
            if r.random()<0.18: return conifer(r,h,h*r.uniform(0.12,0.16),0.45,bare=0.24)
            return conifer(r,h,h*r.uniform(0.15,0.20),0.10,bare=0.15)
        def near(r,h,l):
            q=r.random()
            if q<0.07: return conifer(r,int(h*0.75),h*0.1,0.6,dead=True)
            if q<0.22: return conifer(r,h,h*r.uniform(0.13,0.17),0.50,bare=0.28)
            if q<0.32: return broadleaf(r,int(h*0.78),int(h*0.52))
            return conifer(r,h,h*r.uniform(0.17,0.22),0.10,bare=0.14)
        row('far',38,142,(72,106),far); understory(rng,c,'far',117,4)
        row('mid',25,148,(92,128),mid,open_=0.20); understory(rng,c,'mid',126,4); brush(rng,c,'mid',125,10)
        row('near',17,156,(110,150),near,open_=0.30); understory(rng,c,'near',134,3); brush(rng,c,'near',133,16,(4,10))
    elif kind=='B':    # ragged pines
        def far(r,h,l): return conifer(r,h,h*r.uniform(0.11,0.15),0.25)
        def mid(r,h,l): return conifer(r,h,h*r.uniform(0.13,0.17),0.35,bare=0.24)
        def near(r,h,l):
            if r.random()<0.12: return conifer(r,int(h*0.75),h*0.1,0.6,dead=True)
            return conifer(r,h,h*r.uniform(0.13,0.18),0.50,bare=0.30)
        row('far',36,142,(72,106),far); understory(rng,c,'far',117,4)
        row('mid',23,148,(92,128),mid); understory(rng,c,'mid',126,4)
        row('near',15,156,(110,150),near); understory(rng,c,'near',134,3)
    else:              # C late autumn: mostly bare, a few pines, thin leaf cover
        def far(r,h,l):
            return bare(r,int(h*0.9),twigs=4) if r.random()<0.6 else conifer(r,h,h*0.13,0.3)
        def mid(r,h,l):
            q=r.random()
            if q<0.55: return bare(r,h)
            if q<0.80: return broadleaf(r,int(h*0.78),int(h*0.5),cover=0.22)
            return conifer(r,h,h*0.15,0.4)
        def near(r,h,l):
            q=r.random()
            if q<0.60: return bare(r,h,twigs=6)
            if q<0.80: return broadleaf(r,int(h*0.78),int(h*0.5),cover=0.20)
            return conifer(r,h,h*0.16,0.45,bare=0.3)
        row('far',30,142,(66,94),far); understory(rng,c,'far',117,4)
        row('mid',18,148,(84,114),mid); understory(rng,c,'mid',126,4)
        row('near',12,156,(98,132),near); understory(rng,c,'near',134,3)
    return Image.fromarray(c,'RGBA')
if __name__=='__main__':
    import sys
    seeds={'A':11,'B':22,'C':33,'A2':int(sys.argv[1]) if len(sys.argv)>1 else 11,'B2':int(sys.argv[2]) if len(sys.argv)>2 else 22}
    sheet=Image.new('RGB',(W*2*2+12,(H*2+8)*5),(66,62,100))
    for i,k in enumerate(['A','B','C','A2','B2']):
        im=build(k,seeds[k]); im.save(f'out/treeline_{k}.png')
        t=Image.new('RGBA',(W*2,H),(66,62,100,255)); t.alpha_composite(im,(0,0)); t.alpha_composite(im,(W,0))
        sheet.paste(t.convert('RGB').resize((W*4,H*2),Image.NEAREST),(0,i*(H*2+8)))
    sheet.save('out/sheet_ABC.png')

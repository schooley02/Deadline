"""Road mocks (2026-11-26): a road into town from the left and the right of the village pad, a stop sign on the left, a traffic light on the right.
Mock only: laptop / desktop scenes. usage: python3 road.py"""
import math, random
import numpy as np
from PIL import Image
from scipy import ndimage
import base as B

HAZE=(54,56,88)
def mix(c,t,to=HAZE): return tuple(int(round(c[i]*(1-t)+to[i]*t)) for i in range(3))
PADA=np.array(B.img('scene/village-pad.png'))          # 356x46 art
GR_D0,GR_D1,GR_L,GR_T=(12,26,24),(21,38,34),(41,61,53),(51,73,62)
SHOULDER=(58,58,56)

def vnoise(cw,ch,seed,W,H):
    r=np.random.RandomState(seed); gw,gh=W//cw+2,H//ch+2; g=r.rand(gh,gw)
    ys=np.arange(H)/ch; xs=np.arange(W)/cw; y0=ys.astype(int); x0=xs.astype(int)
    fy=(ys-y0)[:,None]; fx=(xs-x0)[None,:]
    a=g[y0][:,x0]; b=g[y0][:,x0+1]; c=g[y0+1][:,x0]; d=g[y0+1][:,x0+1]
    return a*(1-fx)*(1-fy)+b*fx*(1-fy)+c*(1-fx)*fy+d*fx*fy

def bez(P,t):
    (x0,y0),(x1,y1),(x2,y2)=P; u=1-t
    return u*u*x0+2*u*t*x1+t*t*x2, u*u*y0+2*u*t*y1+t*t*y2

def road_layer(W,H,d,paths,line=False,seed=5):
    """paths: list of dict(P=bezier in shown px, a0,b0 = half-width / half-thickness (shown px) at full scale). Returns RGBA W x H."""
    aw,ah=W//2,H//2; hz=H-76; pad=d['p']; ptop=pad['top']//2
    mask=np.zeros((ah,aw),bool); centre=[]
    yy,xx=np.mgrid[0:ah,0:aw]
    def scale(y): return max(0.10,min(1.0,(y-(hz-86))/86.0))
    for p in paths:
        pts=[]
        for i in range(0,241):
            t=i/240; x,y=bez(p['P'],t); s=scale(y)
            a=max(2.0,p['a0']*s)/2; b=max(1.2,p['b0']*s+1.5)/2
            mask|=(((xx-x/2)/a)**2+((yy-y/2)/b)**2)<=1
            pts.append((x/2,y/2,s))
        centre.append(pts)
    mask[:(hz-82)//2,:]=False
    nz=vnoise(6,3,seed+1,aw,ah)
    for _ in range(2):
        inner=ndimage.binary_erosion(mask); edge=mask&~inner
        mask[edge&(nz<0.40)]=False
        outer=ndimage.binary_dilation(mask)&~mask
        mask[outer&(nz>0.72)]=True
    mask=ndimage.binary_opening(mask,structure=np.ones((1,3),bool))|ndimage.binary_erosion(mask)
    o=np.zeros((ah,aw,4),np.uint8)
    # surface: the pad's own PixelLab asphalt, row for row (so the haze steps match), from its fully opaque middle columns, mirrored so it never seams
    X0,X1=150,268; span=X1-X0
    for y,x in zip(*np.nonzero(mask)):
        r=min(42,max(7,y-ptop)); k=x%(2*span); k=k if k<span else 2*span-1-k
        o[y,x,:3]=PADA[r,X0+k,:3]; o[y,x,3]=255
    def put(y,x,c):
        if 0<=y<ah and 0<=x<aw: o[y,x,:3]=c; o[y,x,3]=255
    def hz_t(y): return max(0.0,min(0.34,(1-(y-ptop)/46.0)*0.40-0.06))
    rnd=random.Random(seed)
    if line:
        for pts in centre:
            run=0.0; prev=None
            for (x,y,s) in pts:
                if prev: run+=math.hypot(x-prev[0],(y-prev[1])*2.5)/max(0.25,s)
                prev=(x,y)
                if int(run/7)%2==0 and rnd.random()>0.22:
                    xi,yi=int(round(x)),int(round(y))
                    if 0<=yi<ah and 0<=xi<aw and mask[yi,xi]:
                        basec=tuple(int(v) for v in o[yi,xi,:3]); put(yi,xi,mix(mix((142,128,78),0.45,basec),hz_t(yi)))
    inner=ndimage.binary_erosion(mask); edge=mask&~inner
    below_out=~np.roll(mask,-1,axis=0)
    for y,x in zip(*np.nonzero(edge)):
        if y<=(hz-72)//2: continue
        if below_out[y,x] and nz[y,x]>0.30: put(y,x,mix(SHOULDER,hz_t(y)))
        elif not below_out[y,x] and nz[y,x]>0.25: put(y,x,mix((31,34,42),hz_t(y)*0.8))
    for y,x in zip(*np.nonzero(edge)):
        if y>(hz-72)//2 and rnd.random()<0.16:
            t=hz_t(y); h=rnd.randint(1,2 if t>0.1 else 3); put(y,x,mix(GR_D1,t))
            for k in range(1,h+1): put(y-k,x,mix(GR_T if k==h and h>1 else GR_L,t))
    return Image.fromarray(o,'RGBA').resize((aw*2,ah*2),Image.NEAREST)

# ---- signs (art px, drawn at 2x) ----
def spr(rows,pal):
    h=len(rows); w=max(len(r) for r in rows); o=np.zeros((h,w,4),np.uint8)
    for y,r in enumerate(rows):
        for x,ch in enumerate(r):
            if ch in pal: o[y,x,:3]=pal[ch]; o[y,x,3]=255
    return Image.fromarray(o,'RGBA').resize((w*2,h*2),Image.NEAREST)
STOP_PAL={'k':(34,18,20),'r':(118,42,38),'R':(138,54,46),'d':(92,32,32),'w':(176,168,158),'p':(72,76,82),'P':(100,104,110),'q':(48,52,58),'u':(88,62,44)}
STOP=spr([
"  kkkkk  ",
" kRRRRRk ",
"kRRRRRrrk",
"kRwRwwRrk",
"krwwRwrdk",
"krurrrddk",
" krrrddk ",
"  kkkkk  ",
"    pP   ","    pP   ","    pP   ","    pP   ","    pP   ","    pP   ","    pP   ","    pP   ","    pP   ","    qp   ","    qp   ",
],STOP_PAL)
LIGHT_PAL={'k':(22,24,28),'h':(40,43,48),'H':(54,58,64),'p':(70,74,80),'P':(100,104,110),'q':(46,50,56),'r':(204,70,52),'o':(46,40,32),'g':(30,44,38),'u':(96,70,50),'b':(60,64,70)}
def light_sprite():
    rows=[]
    rows+= ["                    pP "]
    rows+= ["  kkkkkkkkkkkkkkkkkkpP "]
    rows+= ["  kPPPPPPPPPPPPPPPPPpP "]
    rows+= [" kkkk             bbpP "]
    rows+= [" khHk               pP "]
    rows+= [" krrk               pP "]
    rows+= [" khHk               pP "]
    rows+= [" kook               pP "]
    rows+= [" khHk               pP "]
    rows+= [" kggk               pP "]
    rows+= [" kkkk               pP "]
    rows+= ["                    pP "]*19
    rows+= ["                    pu "]*2
    rows+= ["                    qp "]*6
    rows+= ["                   qqpp"]
    return spr(rows,LIGHT_PAL)
LIGHT=light_sprite()
def glow(c,x,y,rad,col,a):
    g=Image.new('RGBA',c.size,(0,0,0,0)); px=g.load()
    for yy in range(y-rad,y+rad+1,2):
        for xx in range(x-rad,x+rad+1,2):
            dd=math.hypot(xx-x,yy-y)/rad
            if dd<1 and 0<=xx<c.width-1 and 0<=yy<c.height-1:
                al=int(a*(1-dd)**1.6)
                for dx in (0,1):
                    for dy in (0,1): px[xx+dx,yy+dy]=col+(al,)
    c.alpha_composite(g)
def ground_shadow(c,x,y,n=6):
    """a short contact shadow falling left from (x, y) = the post's foot (shown px)"""
    s=Image.new('RGBA',c.size,(0,0,0,0)); px=s.load()
    for k in range(0,n):
        al=int(150*(1-k/n))
        for dx in (0,1):
            for dy in (0,1):
                X=x-2*k+dx; Y=y+(2 if k>2 else 0)+dy
                if 0<=X<c.width and 0<=Y<c.height: px[X,Y]=(5,10,12,al)
    c.alpha_composite(s)

def build(W,H,baseW,opt,out):
    hz=H-76
    def geom(d):
        pad=d['p']; L=pad['left']; R=pad['left']+pad['width']
        return L,R
    def ground(c,d,hz_):
        L,R=geom(d)
        if opt in ('A','B'):
            paths=[dict(P=[(L+40,hz-28),(L-80,hz-20),(L-104,hz-88)],a0=84,b0=26),
                   dict(P=[(R-44,hz-30),(R+62,hz-22),(R+88,hz-88)],a0=84,b0=26)]
        else:
            paths=[dict(P=[(L+60,hz-52),(L-120,hz-52),(-40,hz-52)],a0=40,b0=40),
                   dict(P=[(R-60,hz-52),(R+80,hz-52),(W+40,hz-52)],a0=40,b0=40)]
        c.alpha_composite(road_layer(W,H,d,paths,line=(opt in ('B','C'))))
    def props(c,d,hz_):
        L,R=geom(d)
        if opt in ('A','B'): sx,sy=L-10,hz-8; lx,ly=R-18,hz-8
        else: sx,sy=L-12,hz-34; lx,ly=R-22,hz-34
        ground_shadow(c,sx+10,sy-2); B.paste(c,STOP,sx,sy-STOP.height)
        ground_shadow(c,lx+41,ly-2,8); B.paste(c,LIGHT,lx,ly-LIGHT.height); glow(c,lx+5,ly-LIGHT.height+11,9,(214,72,52),120)
    c,d=B.scene(W,H,baseW,ground,props)
    c.convert('RGB').save(out); return c
if __name__=='__main__':
    for o in 'ABC':
        build(1366,480,368,o,f'road_{o}_laptop.png'); build(1920,640,368,o,f'road_{o}_desktop.png')

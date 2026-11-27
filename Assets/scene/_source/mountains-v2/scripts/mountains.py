"""Mountain layer rework (v2 generator): code-drawn ranges built peak by peak. 640x240 tile, 1 art px = 1 screen px, tiles in x.
Each peak has a wiggly crest line from its summit down; right of the crest is the lit face (moon on the RIGHT), left is shadow.
Spur ridges branch down-right off the crest and cast a narrow shadow wedge into the lit face. Farther = lighter, bluer, flatter.
The low valley stays at column 270 (it sits under the moon)."""
import math, random
import numpy as np
from PIL import Image
W,H=640,240
VX=270
def wrapd(x,c): d=(x-c+W/2)%W-W/2; return d
def fbm(rng,n,octs=5,amp=1.0):
    """Periodic 1D fractal noise of length n."""
    x=np.arange(n)/n*2*np.pi; y=np.zeros(n); a=amp; f=2
    for _ in range(octs):
        y+=a*np.sin(f*x+rng.uniform(0,6.28)); y+=a*0.6*np.sin((f+1)*x+rng.uniform(0,6.28)); a*=0.5; f*=2
    return y
class Peak:
    def __init__(s,rng,x,top,sl,sr,rough):
        s.x=x; s.top=top; s.sl=sl; s.sr=sr; s.rough=rough
        s.n=fbm(rng,W,7,1.0)
        st=0; s.j=np.zeros(W)
        for i in range(W):
            if rng.random()<0.3: st=rng.choice((-2,-1,0,0,1,2))
            s.j[i]=st*0.6
        # crest line: x offset per depth below the summit, drifting left-ish (the lit face is the broad right side)
        s.crest=np.cumsum([rng.choice((-1,0,0,1))*0.5 - 0.25*sr/max(sl,1e-3)*0.5 for _ in range(H)])
        s.litd=rng.uniform(22,48)
        s.spurs=[]
        for _ in range(rng.randint(1,3)):
            d0=rng.uniform(6,40); s.spurs.append((d0,rng.uniform(0.9,1.8),rng.uniform(2,5),rng.uniform(20,70)))
    def prof(s,X):
        d=wrapd(X,s.x); sl=np.where(d<0,s.sl,s.sr)
        j=s.j[np.asarray(X,int)%W]
        return s.top+np.abs(d)*sl+(s.n*s.rough+j)*np.minimum(1,np.abs(d)/14)
def build_range(rng,peaks,base_y,valley=0.0,vw=60):
    """Highest peaks first, lower ones drawn after so they sit IN FRONT (overlapping massifs, no vertical seams)."""
    X=np.arange(W,dtype=float); d=np.abs(wrapd(X,VX)); vshift=valley*np.exp(-(d/vw)**2)
    order=sorted(range(len(peaks)),key=lambda i:peaks[i].top)
    own=np.full((H,W),-1,np.int16); top=np.full(W,float(H))
    Y=np.arange(H)[:,None]
    for i in order:
        pr=peaks[i].prof(X)+vshift
        m=Y>=pr[None,:]; own[m]=i; top=np.minimum(top,pr)
    base=base_y+fbm(rng,W,4,2.0)+vshift
    m=(Y>=base[None,:])&(own<0); own[m]=len(peaks)   # filler under everything
    top=np.minimum(top,base)
    return top,own,None
def shade(top,own,peaks,rng):
    """0 shadow, 1 mid, 2 lit. Lit face = right of the peak's crest; it falls to mid further down (noisy band), spurs cut shadow wedges."""
    f=np.full((H,W),-1,np.int8); band=fbm(rng,W,5,1.0)
    for x in range(W):
        for y in range(int(math.ceil(top[x])),H):
            i=own[y,x]
            if i<0: continue
            if i>=len(peaks): f[y,x]=1; continue
            p=peaks[i]; dy=max(0,y-p.top); cx=p.x+p.crest[min(H-1,int(dy))]; dx=wrapd(x,cx)
            if dx>0:
                v=2 if dy<p.litd+band[x]*p.litd*0.3 else 1
                for (d0,sl,wd,ln) in p.spurs:
                    sx=dx-(dy-d0)*sl
                    if d0<dy<d0+ln and -wd<sx<0: v=min(v,1) if v==2 else 0
            else:
                v=0
            f[y,x]=v
    return f
def paint(c,top,fmap,pal,snow=None):
    for x in range(W):
        for y in range(max(0,int(math.ceil(top[x]))),H):
            if fmap[y,x]>=0: c[y,x]=(*pal[fmap[y,x]],255)
    if snow is not None:
        m,col=snow; c[m]=(*col,255)
def snowmask(top,fmap,peaks,own,rng,depth,thresh):
    """Snow only high on the tallest peaks and only on their lit faces, with a ragged lower edge."""
    m=np.zeros((H,W),bool); n=fbm(rng,W,5,1.0)
    for x in range(W):
        for y in range(int(math.ceil(top[x])),H):
            i=own[y,x]
            if i<0 or i>=len(peaks): continue
            p=peaks[i]
            if p.top>thresh: continue
            dy=y-p.top; lim=depth+n[x]*depth*0.45
            if dy<lim and fmap[y,x]==2: m[y,x]=True
    return m
def haze(c,y0,col,k_max=0.55,span=60):
    for y in range(y0,H):
        k=min(1,(y-y0)/span)*k_max; m=c[y,:,3]>0
        c[y,m,:3]=np.round(c[y,m,:3]*(1-k)+np.array(col)*k).astype(np.uint8)
def peaks_for(rng,n,top_rng,sl_rng,rough,avoid=VX,avoid_w=40,shoulders=True):
    """n main peaks spread around the tile, each with 0-2 lower shoulder peaks, all with uneven slopes and rough edges."""
    out=[]; xs=np.linspace(0,W,n,endpoint=False)+rng.uniform(0,W/n)
    for x in xs:
        x=(x+rng.uniform(-W/n*0.35,W/n*0.35))%W
        t=rng.uniform(*top_rng)
        if abs(wrapd(x,avoid))<avoid_w: t+=40
        sl=rng.uniform(*sl_rng); sr=rng.uniform(*sl_rng)*rng.uniform(0.6,1.1)
        out.append(Peak(rng,x,t,sl,sr,rough*rng.uniform(0.7,1.3)))
        if shoulders:
            for _ in range(rng.choice((0,1,1,2))):
                side=rng.choice((-1,1)); off=rng.uniform(12,34)*side
                out.append(Peak(rng,(x+off)%W,t+rng.uniform(8,26),sl*rng.uniform(0.8,1.3),sr*rng.uniform(0.8,1.3),rough*rng.uniform(0.6,1.1)))
    return out
def build(kind,seed=1):
    rng=random.Random(seed); c=np.zeros((H,W,4),np.uint8)
    if kind=='A':     # rugged range with muted snow on the lit faces
        pf=peaks_for(rng,6,(10,46),(0.6,1.2),6.0); tf,of,_=build_range(rng,pf,118,30,70); ff=shade(tf,of,pf,rng)
        paint(c,tf,ff,{0:(70,68,104),1:(77,76,112),2:(90,89,126)},(snowmask(tf,ff,pf,of,rng,16,40),(116,116,150)))
        pn=peaks_for(rng,7,(58,98),(0.55,1.1),4.5); tn,on,_=build_range(rng,pn,150,26,55); fn=shade(tn,on,pn,rng)
        paint(c,tn,fn,{0:(59,58,93),1:(64,64,99),2:(75,76,110)},(snowmask(tn,fn,pn,on,rng,7,72),(94,95,128)))
        haze(c,150,(62,62,97))
    elif kind=='B':   # Appalachian: long, low, rolling ridgelines in three hazy bands (no snow)
        for i,(n,tr,sl,base,val,pal) in enumerate([
            (5,(58,72),(0.28,0.42),104,18,{0:(80,79,114),1:(84,84,118),2:(91,91,125)}),
            (6,(88,104),(0.30,0.46),132,16,{0:(69,69,103),1:(73,73,107),2:(81,82,115)}),
            (7,(118,132),(0.32,0.50),160,12,{0:(59,60,93),1:(63,64,97),2:(70,72,104)})]):
            p=peaks_for(rng,n,tr,sl,3.0,shoulders=False); t,o,_=build_range(rng,p,base,val,80); f=shade(t,o,p,rng); paint(c,t,f,pal)
    else:             # C: distant snowy massif behind darker, rounded foothills
        pf=peaks_for(rng,5,(6,40),(0.6,1.2),6.5); tf,of,_=build_range(rng,pf,110,34,80); ff=shade(tf,of,pf,rng)
        paint(c,tf,ff,{0:(76,75,110),1:(83,83,118),2:(97,97,132)},(snowmask(tf,ff,pf,of,rng,26,36),(124,125,156)))
        haze(c,110,(80,80,115),0.35,80)
        pm=peaks_for(rng,7,(100,126),(0.30,0.55),3.0,shoulders=False); tm,om,_=build_range(rng,pm,150,18,60); fm=shade(tm,om,pm,rng)
        paint(c,tm,fm,{0:(58,58,92),1:(62,63,96),2:(70,72,104)})
    return c
if __name__=='__main__':
    import sys
    seeds={'A':3,'B':5,'C':7}
    for a in sys.argv[1:]: k,v=a.split('='); seeds[k]=int(v)
    for k in 'ABC': Image.fromarray(build(k,seeds[k]),'RGBA').save(f'mt/mountains_{k}.png')

"""Village road, option C (Jeremy 2026-11-26: "i like c"): a level two-lane road running behind the church and the graveyard, through the pad.
Builds the tileable code strip (320x18 art, shown 640x36), the two signs, the PixelLab canvas, and scene mocks."""
import math, random, sys
import numpy as np
from PIL import Image
import base as B
from road import mix, spr, glow, ground_shadow, LIGHT_PAL

PADA=np.array(B.img('scene/village-pad.png'))
SW,SH,TOPM,BODY=320,18,3,13            # art px: strip size, transparent rows above the road, road thickness
ROW0=14                                # pad art row the road's first row is sampled from (so the haze matches the pad at that depth)
TOP_FROM_FEET=-66                      # shown px: strip top above the front row's feet (body = feet-60 .. feet-34)
GR_D1,GR_L,GR_T=(21,38,34),(41,61,53),(51,73,62)

def pnoise(seed,n,cell):
    r=np.random.RandomState(seed); k=n//cell; g=r.rand(k); x=np.arange(n)/cell; i=x.astype(int)%k; f=x-x.astype(int)
    return g[i]*(1-f)+g[(i+1)%k]*f

def code_strip(seed=3, surface=None, line=True):
    rnd=random.Random(seed); o=np.zeros((SH,SW,4),np.uint8)
    top=np.round(TOPM+(pnoise(seed,SW,8)-0.5)*1.6).astype(int); bot=np.round(TOPM+BODY-1+(pnoise(seed+1,SW,10)-0.5)*1.8).astype(int)
    X0,span=60,160
    for x in range(SW):
        k=x%(2*span); k=k if k<span else 2*span-1-k
        for y in range(top[x],bot[x]+1):
            if surface is not None: o[y,x,:3]=surface[y,x]
            else: o[y,x,:3]=PADA[ROW0+(y-TOPM),X0+k,:3]
            o[y,x,3]=255
    def hz(y): return max(0.0,0.20-0.014*(y-TOPM))
    def put(y,x,c):
        x%=SW
        if 0<=y<SH: o[y,x,:3]=c; o[y,x,3]=255
    def base_at(y,x): return tuple(int(v) for v in o[y,x%SW,:3])
    if surface is None:
        # long shallow cracks and two tar patches (wrap around)
        for _ in range(7):
            x=rnd.randrange(SW); y=rnd.randint(TOPM+2,TOPM+BODY-3); n=rnd.randint(9,26)
            for i in range(n):
                if top[x%SW]<y<bot[x%SW]: put(y,x,mix((25,27,33),hz(y)))
                x+=1
                if rnd.random()<0.18: y+=rnd.choice((-1,1))
        for _ in range(3):
            x=rnd.randrange(SW); y=rnd.randint(TOPM+2,TOPM+BODY-5); w=rnd.randint(8,14)
            for dy in range(2):
                for dx in range(w): put(y+dy,x+dx+dy,mix((37,39,46),hz(y)))
    if line:
        yc=TOPM+BODY//2
        for x in range(SW):
            if (x//8)%2==0 and rnd.random()>0.20:
                put(yc,x,mix(mix((150,134,80),0.42,base_at(yc,x)),hz(yc)))
    # edges: a dark upper lip, loose shoulder gravel along the lower edge, grass growing over both
    n1=pnoise(seed+2,SW,3); n2=pnoise(seed+3,SW,2)
    for x in range(SW):
        if n1[x]>0.22: put(top[x],x,mix((31,34,42),hz(top[x])))
        if n2[x]>0.30: put(bot[x],x,mix((58,58,56),hz(bot[x])*0.5))
        elif n2[x]<0.12: put(bot[x]+1,x,mix((52,52,50),0.05))
    for x in range(SW):
        if rnd.random()<0.10:
            y=bot[x]+rnd.choice((0,1)); h=rnd.randint(1,2); put(y,x,GR_D1)
            for k in range(1,h+1): put(y-k,x,GR_T if k==h and h>1 else GR_L)
        if rnd.random()<0.07:
            y=top[x]; put(y,x,mix(GR_D1,0.2)); put(y-1,x,mix(GR_L,0.2))
    return o,top,bot

STOP_PAL={'k':(30,18,20),'w':(150,144,136),'R':(126,46,40),'r':(104,36,36),'s':(170,128,118),'p':(72,76,82),'P':(100,104,110),'q':(48,52,58),'u':(92,66,48)}
STOP=spr([
"  kkkkk  ",
" kwwwwwk ",
"kwRRRRRwk",
"kwRRRRrwk",
"kwsRsRswk",
"kwRRRrrwk",
"kwrrrrrwk",
" kwwwwwk ",
"  kkkkk  ",
"    pP   ","    pP   ","    pP   ","    pP   ","    pP   ","    pu   ","    pP   ","    pP   ","    pP   ","    qp   ","    qp   ",
],STOP_PAL)
def light(on=True):
    pal=dict(LIGHT_PAL); 
    if not on: pal['r']=(58,34,34)
    rows=["                    pP ","  kkkkkkkkkkkkkkkkkkpP ","  kPPPPPPPPPPPPPPPPPpP "," kkkk             bbpP "," khHk              bpP "," krrk               pP "," khHk               pP "," kook               pP "," khHk               pP "," kggk               pP "," kkkk               pP "]
    rows+=["                    pP "]*17+["                    pu "]*2+["                    qp "]*5+["                   qqpp"]
    return spr(rows,pal)

def build(W,H,baseW,strip_art,out=None,stop=STOP,lightspr=None,lit=True):
    lightspr=lightspr or light(lit)
    st=Image.fromarray(strip_art,'RGBA').resize((SW*2,SH*2),Image.NEAREST)
    def ground(c,d,hz):
        B.tile(c,st,hz+TOP_FROM_FEET,0)
    def props(c,d,hz):
        L=d['p']['left']; R=L+d['p']['width']
        sx,sy=L-16,hz-36; lx,ly=R-26,hz-36
        ground_shadow(c,sx+10,sy-2); B.paste(c,stop,sx,sy-stop.height)
        ground_shadow(c,lx+41,ly-2,8); B.paste(c,lightspr,lx,ly-lightspr.height)
        if lit: glow(c,lx+5,ly-lightspr.height+11,9,(214,72,52),110)
    c,d=B.scene(W,H,baseW,ground,props)
    if out: c.convert('RGB').save(out)
    return c
if __name__=='__main__':
    o,_,_=code_strip(); Image.fromarray(o,'RGBA').save('road_strip_code_320x18.png')
    c=build(1366,480,368,o,'C_code_laptop.png')
    c.crop((330,300,1366,430)).resize((2072,260),Image.NEAREST).crop((0,0,1100,260)).save('C_code_zoomL.png')
    c.crop((330,300,1366,430)).resize((2072,260),Image.NEAREST).crop((972,0,2072,260)).save('C_code_zoomR.png')

import sys, random
sys.path.insert(0,'/home/claude/audit')
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import mock, scene2_lib as S, combo as C
random.seed(101); rng=np.random.default_rng(101)
def lum(a): return 0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2]
# ---- 1. tile -> 1280 strip (column walk; every join is a mirror, the end wraps onto the start)
tile=S.pl_band('twotrack_s701_0', W=256)            # 256x72, sky keyed out above the grass
SEG=[(0,215),(214,60),(61,255),(254,110),(111,240),(239,150),(151,250),(249,1)]
cols=[]
for a,b in SEG: cols += list(range(a,b+1)) if b>=a else list(range(a,b-1,-1))
assert len(cols)==1280, len(cols)
ta=np.array(tile); strip=Image.fromarray(ta[:,cols,:],'RGBA')
# ---- 2. tone 3 (gravel 35% darker + cooler)
strip=C.tone(strip,0.35,cool=True)
yard=C.yard_tone(C.yard_band(1280),0.92,(0.97,1.0,1.06))
# ---- 3. bare dirt patches in the tracks, in the yard's dirt (blobby, not repeating)
def vnoise(w,h,cell):
    g=rng.random((h//cell+2,w//cell+2)); ys=np.arange(h)/cell; xs=np.arange(w)/cell
    y0=ys.astype(int); x0=xs.astype(int); fy=(ys-y0)[:,None]; fx=(xs-x0)[None,:]
    a=g[y0][:,x0]; b=g[y0][:,x0+1]; c=g[y0+1][:,x0]; d=g[y0+1][:,x0+1]
    return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy
sa=np.array(strip); ya=np.array(yard); L=lum(sa.astype(float))
n=vnoise(1280,72,5)
x=40
while x<1240:
    cy=random.choice([random.randint(19,29),random.randint(53,63)]); rw=random.randint(12,30); rh=random.randint(2,4)
    for yy in range(cy-rh-1,cy+rh+2):
        for xx in range(x-rw-2,x+rw+3):
            if 0<=xx<1280 and 9<=yy<72:
                r=((xx-x)/rw)**2+((yy-cy)/rh)**2
                if r < 0.75+0.7*n[yy,xx] and L[yy,xx]>60: sa[yy,xx]=ya[yy,xx]   # only replaces gravel, never grass
    x+=random.randint(60,150)
# ragged grass tips along the top edge instead of a straight line (blades 1-7px, in clumps)
h=3
for xx in range(1280):
    if random.random()<.35: h+=random.choice([-1,1])
    h=max(1,min(5,h)); hh=h+(random.choice([2,3]) if random.random()<.12 else 0)-(2 if random.random()<.18 else 0)
    cut=max(0,7-max(1,hh))
    sa[:cut,xx,3]=0
strip=Image.fromarray(sa,'RGBA'); strip.save('final/lane_two_track_1280x72.png')
# ---- 4. churchyard piece 560x72: dirt, ragged blobby fade along the barricade diagonal
YW=560; ypc=np.array(yard.crop((0,0,YW,72))); alpha=np.zeros((72,YW),float)
nz=vnoise(YW,72,6)*0.65+vnoise(YW,72,2)*0.35
for yy in range(9,72):
    e=414+(64-yy)*2.2
    xs=np.arange(YW); p=np.clip((e+24-xs)/48.0,0,1)       # 1 = all dirt, 0 = all lane
    alpha[yy]=(p>nz[yy]).astype(float)
ypc[...,3]=(alpha*255).astype('uint8'); yimg=Image.fromarray(ypc,'RGBA'); yimg.save('final/base_yard_560x72.png')
# ---- 5. previews
def band_for(W,baseW,sx):
    b=Image.new('RGBA',(W,72),(0,0,0,0)); x=-sx
    while x<W:
        if x+1280>0: b.alpha_composite(strip.crop((max(0,-x),0,1280,72)),(max(0,x),0))
        x+=1280
    yx=baseW+176-YW
    b.alpha_composite(yimg.crop((max(0,-yx),0,YW,72)),(max(0,yx),0)); return b
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',20)
for name,W,H,bw,lab in [('phone_800x306',800,306,188,'Phone, landscape (800 x 306)'),('laptop_1366x400',1366,400,368,'Laptop (1366 x 400), whole church showing')]:
    sx=int(0.15*W); im=S.scene(W,H,bw,band_for(W,bw,sx),88,False,shadows=True,sx=0)
    sc=2 if W<=800 else 1
    sh=Image.new('RGB',(W*sc,H*sc+40),(20,20,30)); ImageDraw.Draw(sh).text((10,8),lab,font=f,fill=(255,255,255))
    sh.paste(im.resize((W*sc,H*sc),Image.NEAREST).convert('RGB'),(0,40)); sh.save(f'out/final_preview_{name}.png')
# ---- 6. checks
sa=np.array(strip).astype(float); L=lum(sa); A=sa[...,3]
print('strip',strip.size,'yard',yimg.size)
print('wrap seam: mean abs diff col1279 vs col0 = %.1f ; typical neighbour diff = %.1f'%(np.abs(sa[:,1279,:3]-sa[:,0,:3]).mean(), np.abs(sa[:,600,:3]-sa[:,601,:3]).mean()))
print('rows 0-8 transparent share: %.0f%%'%(100*(A[:9]<10).mean()), '| rows 9+ opaque: %.1f%%'%(100*(A[9:]>250).mean()))
for nm,r in [('back feet row 24',24),('middle feet row 44',44),('front feet row 64',64)]:
    print(nm,'-> mean lum %.0f'%L[r-2:r+3].mean(), '(gravel share %.0f%%)'%(100*(L[r-2:r+3]>62).mean()))
g=L[9:][(L[9:]>62)]; gr=L[9:][(L[9:]<=62)]
print('gravel mean lum %.0f | grass+dirt mean lum %.0f | yard dirt mean lum %.0f'%(g.mean(),gr.mean(),lum(np.array(yimg).astype(float))[np.array(yimg)[...,3]>0].mean()))

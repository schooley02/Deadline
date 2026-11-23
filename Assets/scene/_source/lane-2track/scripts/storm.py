import sys, random, concurrent.futures as cf
sys.path.insert(0,'/home/claude/audit')
import numpy as np
from PIL import Image, ImageFilter
import pl
random.seed(77); rng=np.random.default_rng(77)
def lum(a): return 0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2]
dry=np.array(Image.open('final/lane_two_track_1280x72.png').convert('RGBA'))
yard=np.array(Image.open('final/base_yard_560x72.png').convert('RGBA'))
def wet(a):
    a=a.astype(float); L=lum(a); w=np.clip((L-52)/25.0,0,1)          # gravel and dirt get darker and bluer when wet, grass barely changes
    f=1-0.15*w-0.04
    a[...,0]*=f*0.97; a[...,1]*=f; a[...,2]*=np.minimum(f*1.05,1.2)
    return np.clip(a,0,255).astype('uint8')
wl=wet(dry); wy=wet(yard); wy[...,3]=yard[...,3]
def blob(mask, cx, cy, rw, rh):
    H,W=mask.shape
    for yy in range(cy-rh-2,cy+rh+3):
        for xx in range(cx-rw-3,cx+rw+4):
            if 0<=xx<W and 0<=yy<H:
                r=((xx-cx)/rw)**2+((yy-cy)/rh)**2
                if r<1+0.35*np.sin(xx*0.45+cy)+0.2*np.sin(xx*0.17): mask[yy,xx]=True
# puddles lie in the tyre tracks: (x centre, band row, half length, half height)
PUD=[(70,24,26,4),(182,58,34,5),(330,60,22,4),(420,23,30,4),(590,57,28,5),(700,25,20,3),(850,59,36,5),(960,24,24,4),(1100,56,24,4),(1200,25,28,4)]
m=np.zeros((72,1280),bool)
for cx,cy,rw,rh in PUD: blob(m,cx,cy,rw,rh)
m &= (lum(dry.astype(float))>55)                                      # never over the grass
m=np.array(Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)))>0
ym=np.zeros((72,560),bool)
for cx,cy,rw,rh in [(430,44,22,4),(500,62,18,3)]: blob(ym,cx,cy,rw,rh)
ym &= yard[...,3]>0
SKY=(24,28,40,255); WATER=(30,36,54,255)
DESC=("Pixel art, night, heavy rain. A wet gravel country lane with two tyre tracks seen from a slightly raised side angle. In the masked areas: long "
      "shallow rain puddles of dark still water lying in the tyre tracks, irregular ragged edges, the water reflecting the dark blue night sky with a "
      "few faint pale highlights, wet muddy rims, small stones poking out of the water. Muted, dark, realistic, not cartoonish. No glow, no bright white, "
      "no ripples rings, no objects.")
def canvas(band): 
    c=Image.new('RGBA',(256,128),SKY); c.alpha_composite(Image.fromarray(band,'RGBA'),(0,56)); return c
def job(name, band, mask, seed):
    if not mask.any(): return name, None
    b=band.copy(); b[...,3]=255; b[mask]=WATER
    im=canvas(b); mk=np.zeros((128,256),np.uint8); mk[56:]=mask*255
    mi=Image.fromarray(mk).filter(ImageFilter.MaxFilter(3)); mrgba=Image.merge('RGBA',(mi,mi,mi,Image.new('L',mi.size,255)))
    outs=pl.inpaint(im,mrgba,DESC,seed=seed,no_bg=False)
    outs[0].save(f'pl_out/storm_{name}.png'); return name, np.array(outs[0].convert('RGBA'))[56:,:,:]
jobs=[(f'l{i}', wl[:,i*256:(i+1)*256].copy(), m[:,i*256:(i+1)*256], 900+i) for i in range(5)]
jobs.append(('yard', wy[:,304:560].copy(), ym[:,304:560], 950))
b0=pl.balance(); res={}
with cf.ThreadPoolExecutor(6) as ex:
    for f in [ex.submit(job,*j) for j in jobs]:
        try:
            n,a=f.result(); res[n]=a; print(n,'ok' if a is not None else 'skip',flush=True)
        except Exception as e: print('ERR',e,flush=True)
print('used',b0-pl.balance(),'left',pl.balance())
out=wl.copy()
for i in range(5):
    a=res.get(f'l{i}')
    if a is not None:
        mm=m[:,i*256:(i+1)*256]; sec=out[:,i*256:(i+1)*256]; sec[mm]=a[mm]; sec[...,3]=wl[:,i*256:(i+1)*256,3]
Image.fromarray(out,'RGBA').save('final/storm_lane_two_track_1280x72.png')
oy=wy.copy(); a=res.get('yard')
if a is not None:
    mm=ym[:,304:560]; sec=oy[:,304:560]; al=sec[...,3].copy(); sec[mm]=a[mm]; sec[...,3]=al
Image.fromarray(oy,'RGBA').save('final/storm_base_yard_560x72.png')
np.save('final/puddle_mask.npy',m)
# close-up sheet: dry vs storm
s=Image.new('RGBA',(1280,72*2+12),(40,36,70,255)); s.alpha_composite(Image.fromarray(dry,'RGBA'),(0,0)); s.alpha_composite(Image.fromarray(out,'RGBA'),(0,84))
s.resize((2560,(72*2+12)*2),Image.NEAREST).convert('RGB').save('out/storm_vs_dry_strip_2x.png')

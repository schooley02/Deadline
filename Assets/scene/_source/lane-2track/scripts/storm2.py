import sys, random, concurrent.futures as cf
sys.path.insert(0,'/home/claude/audit')
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
import pl
random.seed(78)
def lum(a): return 0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2]
dry=np.array(Image.open('final/lane_two_track_1280x72.png').convert('RGBA'))
f=dry.astype(float); L=lum(f)
# the bare dirt patches: brownish (red >= green), mid-dark, inside the two tracks
cand=(f[...,0]>=f[...,1]-2)&(L>34)&(L<70)&(dry[...,3]>0)
cand[:12]=False
cand=ndimage.binary_closing(cand,iterations=2); cand=ndimage.binary_opening(cand,iterations=1)
lab,n=ndimage.label(cand); sizes=ndimage.sum(cand,lab,range(1,n+1))
keep=np.isin(lab,[i+1 for i,s in enumerate(sizes) if s>=45])
m=ndimage.binary_dilation(keep,iterations=2)&(L>30)          # water covers the whole patch plus a thin edge
m&=~((f[...,1]>f[...,0]+6)&(L<60))                          # never over grass
m=ndimage.binary_fill_holes(ndimage.binary_closing(m,iterations=1))
l0,n0=ndimage.label(m); sz=ndimage.sum(m,l0,range(1,n0+1)); m=np.isin(l0,[i+1 for i,v in enumerate(sz) if v>=40])
raw=(f[...,0]>=f[...,1]-2)&(L>30)&(L<70); raw[:12]=False
m|=raw&ndimage.binary_dilation(m,structure=np.ones((3,25),bool))
m=ndimage.binary_fill_holes(ndimage.binary_closing(m,iterations=1))
lab2,n2=ndimage.label(m); print('dirt patches found:',n2,'| puddle px share %.1f%%'%(100*m.mean()))
for i in range(1,n2+1):
    ys,xs=np.where(lab2==i); print('  patch at x %d-%d, rows %d-%d'%(xs.min(),xs.max(),ys.min(),ys.max()))
np.save('final/puddle_mask.npy',m)
Image.fromarray((m*255).astype('uint8')).resize((2560,144),Image.NEAREST).save('pl_out/puddle_mask_v2.png')
if '--mask-only' in sys.argv: sys.exit()
def wet(a):
    a=a.astype(float); Lw=lum(a); w=np.clip((Lw-52)/25.0,0,1); ff=1-0.15*w-0.04
    a[...,0]*=ff*0.97; a[...,1]*=ff; a[...,2]*=np.minimum(ff*1.05,1.2)
    return np.clip(a,0,255).astype('uint8')
wl=wet(dry); wl[...,3]=dry[...,3]
SKY=(24,28,40,255); WATER=(30,36,54,255)
DESC=("Pixel art, night, heavy rain. A wet gravel country lane with two tyre tracks seen from a slightly raised side angle. In the masked areas: "
      "shallow rain puddles of dark still water filling the low bare spots in the tyre tracks, irregular ragged edges, the water reflecting the dark "
      "blue night sky with a few faint pale highlights, wet muddy rims, small stones poking out of the water. Muted, dark, realistic, not cartoonish. "
      "No glow, no bright white, no ripple rings, no objects.")
def job(i):
    mask=m[:,i*256:(i+1)*256]
    if not mask.any(): return i,None
    b=wl[:,i*256:(i+1)*256].copy(); b[...,3]=255; b[mask]=WATER
    c=Image.new('RGBA',(256,128),SKY); c.alpha_composite(Image.fromarray(b,'RGBA'),(0,56))
    mk=np.zeros((128,256),np.uint8); mk[56:]=mask*255; mi=Image.fromarray(mk).filter(ImageFilter.MaxFilter(3))
    outs=pl.inpaint(c,Image.merge('RGBA',(mi,mi,mi,Image.new('L',mi.size,255))),DESC,seed=920+i,no_bg=False)
    outs[0].save(f'pl_out/storm2_l{i}.png'); return i,np.array(outs[0].convert('RGBA'))[56:,:,:]
b0=pl.balance(); out=wl.copy()
with cf.ThreadPoolExecutor(5) as ex:
    for fu in [ex.submit(job,i) for i in range(5)]:
        try:
            i,a=fu.result()
            if a is not None:
                mm=m[:,i*256:(i+1)*256]; sec=out[:,i*256:(i+1)*256]; al=sec[...,3].copy(); sec[mm]=a[mm]; sec[...,3]=al
            print('section',i,'ok' if a is not None else 'no patch',flush=True)
        except Exception as e: print('ERR',e,flush=True)
print('used',b0-pl.balance(),'left',pl.balance())
# faint sky reflections
for i in range(1,n2+1):
    ys,xs=np.where(lab2==i)
    for _ in range(random.randint(2,4)):
        k=random.randrange(len(xs)); y=ys[k]; x=xs[k]; nn=random.randint(3,8)
        for t in range(nn):
            xx=x+t
            if xx<1280 and 0<y<71 and m[y,xx] and m[y-1,xx] and m[y+1,xx]: out[y,xx,:3]=(96,108,138) if t not in (0,nn-1) else (66,76,104)
Image.fromarray(out,'RGBA').save('final/storm_lane_two_track_1280x72.png')
# check: does any dirt patch remain without water?
left=keep&~m; print('dirt-patch pixels left without water:',int(left.sum()))
print('same alpha as dry:',bool((out[...,3]==dry[...,3]).all()))

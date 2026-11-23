import sys, concurrent.futures as cf
sys.path.insert(0,'/home/claude/work/pl'); sys.path.insert(0,'.'); import pl
import numpy as np
from PIL import Image
from scipy import ndimage
import tiers as T, wall3d, ext
PAD=T.PAD; solid=T.solid; a=np.array(solid)
# keep the approved tire stacks exactly; everything between them is redrawn lower
keep=np.zeros(a.shape[:2],bool)
keep[44:,0:25]=a[44:,0:25,3]>0                      # near stack (rows 44+, columns 0-24)
far=np.zeros_like(keep); far[14:38,78:]=a[14:38,78:,3]>0; keep|=far
c=T.canvas(); k=a.copy(); k[~keep]=0; c.alpha_composite(Image.fromarray(k,'RGBA'),(PAD,PAD))
g=wall3d.shear(wall3d.build(L=50,courses=3,posts=5,post_h=23,wire=False,tires=(0,0),seed=9))
ga0,gb=ext.baseline_mid(g,0.3,0.8)
gx=20; gy=int(round(T.yb(gx+8)-(ga0+gb*8)))
layer=Image.new('RGBA',c.size,(0,0,0,0)); layer.alpha_composite(g,(gx+PAD,gy+PAD)); layer.alpha_composite(c)       # stacks stay in front at the ends
body=(a[...,3]>0)&~keep; m=np.zeros((c.size[1],c.size[0]),bool); m[PAD:PAD+a.shape[0],PAD:PAD+a.shape[1]]=body
m|=np.array(layer)[...,3]>0; kk=np.zeros_like(m); kk[PAD:PAD+a.shape[0],PAD:PAD+a.shape[1]]=keep
m=ndimage.binary_dilation(m,iterations=3)&~ndimage.binary_erosion(kk,iterations=1)
desc=("The same barricade but only PARTLY built and lower: a wall three rows of sandbags high, about waist height, with the top row showing "
      "its upper surface; rough timber posts stand in front, short and at uneven heights, some only just above the bags; planks are nailed "
      "across the posts but one bay has a plank missing or hanging loose, leaving a gap; no barbed wire. It runs along the same diagonal line "
      "between the two tire stacks at its ends, which stay as they are."+T.STYLE)
if __name__=='__main__':
    ctx,mk=T.context(layer,Image.fromarray((m*255).astype('uint8'))); ctx.save('ctx_partial.png'); Image.fromarray((mk*255).astype('uint8')).save('ctx_partial_mask.png')
    def run(seed):
        outs,j=pl.inpaint(ctx,Image.fromarray((mk*255).astype('uint8')),desc,seed); outs[0].save(f'gen/partial_s{seed}.png'); return seed,j.get('status')
    with cf.ThreadPoolExecutor(3) as ex:
        for f in [ex.submit(run,s) for s in (420,421,422)]:
            try: print(f.result(),flush=True)
            except Exception as x: print('ERR',repr(x)[:300],flush=True)

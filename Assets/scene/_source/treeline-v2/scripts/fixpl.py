"""Make a PixelLab treeline redraw tile and fill its bottom: fill rows the background removal cleared (they sit behind the grass) and dither the left edge into the right edge's columns so the 404 px tile repeats without a hard seam."""
import random, sys
import numpy as np
from PIL import Image
def fix(src,dst,band=18,seed=5):
    a=np.array(Image.open(src).convert('RGBA'))
    full=np.where((a[:,:,3]>0).all(1))[0]; last=full.max()
    for y in range(last+1,a.shape[0]): a[y]=a[last]
    rnd=random.Random(seed); o=a.copy(); W=a.shape[1]
    for x in range(band):
        for y in range(a.shape[0]):
            if rnd.random()>x/band: o[y,x]=a[y,W-1-x] if False else a[y,(W-band+x)%W] if False else a[y,W-1-(band-1-x)-band+band] if False else a[y,W-1-x]
    Image.fromarray(o,'RGBA').save(dst); return o
if __name__=='__main__':
    for s in sys.argv[1:]: fix(f'pl/b2_{s}.png',f'pl/b2_{s}_tile.png')

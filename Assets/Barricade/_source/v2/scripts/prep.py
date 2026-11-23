import numpy as np
from PIL import Image
from scipy import ndimage
def key_white(im, thr=236):
    a=np.array(im.convert('RGBA')); white=(a[...,:3].min(-1)>=thr)|(a[...,3]<20)
    lab,n=ndimage.label(white); border=set(lab[0,:])|set(lab[-1,:])|set(lab[:,0])|set(lab[:,-1]); border.discard(0)
    bg=np.isin(lab,list(border)); a[bg]=0
    # enclosed white holes (between posts / wire): also background
    for i in range(1,n+1):
        if i in border: continue
        if (lab==i).sum()>=3: a[lab==i]=0
    return Image.fromarray(a,'RGBA')
def trim(im):
    a=np.array(im); ys,xs=np.nonzero(a[...,3]>20); return im.crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1))
def baseline(im):
    """lowest opaque pixel per column -> least-squares line y = a + b*x (art px)"""
    a=np.array(im)[...,3]>20; xs=[];ys=[]
    for x in range(a.shape[1]):
        col=np.nonzero(a[:,x])[0]
        if len(col): xs.append(x); ys.append(col.max())
    b,a0=np.polyfit(xs,ys,1); return a0,b,xs,ys
if __name__=='__main__':
    for n in ['gen/edit_s201_0.png','gen/ref_s202_0.png','gen/ref_s202_1.png']:
        im=trim(key_white(Image.open(n))); a0,b,xs,ys=baseline(im); print(n,im.size,'base line y=%.1f%+.3f*x'%(a0,b),'slope target -0.4545')
        im.save(n.replace('gen/','prep_'))

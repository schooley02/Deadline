import sys; sys.path.insert(0,'.')
import numpy as np
from PIL import Image
from scipy import ndimage
import prep
def extract(result_p, mask_p='ctx_mask.png'):
    r=np.array(Image.open(result_p).convert('RGBA')); m=np.array(Image.open(mask_p))>0
    a=r.copy(); a[~m]=(255,255,255,255); a[a[...,3]<20]=(255,255,255,255)
    im=prep.key_white(Image.fromarray(a,'RGBA'),thr=232)
    b=np.array(im); lab,n=ndimage.label(b[...,3]>20)                 # drop specks
    for i,s in enumerate(ndimage.sum(b[...,3]>20,lab,range(1,n+1)),1):
        if s<12: b[lab==i]=0
    return prep.trim(Image.fromarray(b,'RGBA'))
def baseline_mid(im,lo=0.25,hi=0.85):
    a=np.array(im)[...,3]>20; w=a.shape[1]; xs=[];ys=[]
    for x in range(int(w*lo),int(w*hi)):
        col=np.nonzero(a[:,x])[0]
        if len(col): xs.append(x); ys.append(col.max())
    b,a0=np.polyfit(xs,ys,1); return a0,b
if __name__=='__main__':
    for n in ('inp_s301_0','inp_s302_0','inp_s302_1'):
        im=extract(f'gen/{n}.png'); im.save(f'wall_{n}.png'); print(n,im.size,'base y=%.1f%+.3f x'%baseline_mid(im))
    ims=[Image.open(f'wall_{n}.png') for n in ('inp_s301_0','inp_s302_0','inp_s302_1')]
    sh=Image.new('RGBA',(sum(i.size[0] for i in ims)+16,max(i.size[1] for i in ims)+8),(40,44,70,255)); x=4
    for i in ims: sh.alpha_composite(i,(x,4)); x+=i.size[0]+4
    sh.resize((sh.size[0]*5,sh.size[1]*5),Image.NEAREST).save('walls_5x.png')

"""Mountain option B2: low rolling ridges in three hazy bands + ONE taller peak toward the left (Jeremy 2026-11-26).
Tile 1920x240 (no repeat on laptop / desktop); meant to be anchored to the CHURCH (left), not the moon:
the tall peak's summit is at tile column PEAK_X, shown at --base-w + PEAK_OFF on screen."""
import random, numpy as np
from PIL import Image
import mountains as M
TW=1920; PEAK_X=420; PEAK_OFF=96
M.W=TW
def build(seed=5):
    rng=random.Random(seed); c=np.zeros((M.H,TW,4),np.uint8)
    # far band + the tall peak (farthest, lightest)
    p1=M.peaks_for(rng,14,(58,72),(0.28,0.42),3.0,avoid=-9999,shoulders=False)
    big=M.Peak(rng,PEAK_X,10,0.62,0.50,5.5); big.litd=60; big.spurs=[(14,1.3,3,40),(30,1.1,3,50),(46,1.5,2,40)]
    sh=M.Peak(rng,PEAK_X-46,40,0.7,0.6,4.0); sh2=M.Peak(rng,PEAK_X+58,48,0.6,0.7,4.0)
    p1+= [big,sh,sh2]
    t,o,_=M.build_range(rng,p1,104,0,80); f=M.shade(t,o,p1,rng)
    M.paint(c,t,f,{0:(80,79,114),1:(84,84,118),2:(91,91,125)})
    for (n,tr,sl,base,pal) in [(16,(88,104),(0.30,0.46),132,{0:(69,69,103),1:(73,73,107),2:(81,82,115)}),
                               (19,(118,132),(0.32,0.50),160,{0:(59,60,93),1:(63,64,97),2:(70,72,104)})]:
        p=M.peaks_for(rng,n,tr,sl,3.0,avoid=-9999,shoulders=False)
        t,o,_=M.build_range(rng,p,base,0,80); f=M.shade(t,o,p,rng); M.paint(c,t,f,pal)
    return c
if __name__=='__main__':
    a=build(); Image.fromarray(a,'RGBA').save('mt/mountains_B2_violet.png')
    import colorsys
    def recolor(a,hue_to,sat_k):
        o=a.copy(); m=a[:,:,3]>0
        for col in np.unique(a[m][:,:3],axis=0):
            h,l,s=colorsys.rgb_to_hls(*(col/255)); r=colorsys.hls_to_rgb(hue_to/360,l,min(1,s*sat_k))
            sel=m&(a[:,:,:3]==col).all(2); o[sel,:3]=np.round(np.array(r)*255)
        return o
    Image.fromarray(recolor(a,236,1.15),'RGBA').save('mt/mountains_B2_bluviolet.png')
    Image.fromarray(recolor(a,226,1.35),'RGBA').save('mt/mountains_B2_moonblue.png')

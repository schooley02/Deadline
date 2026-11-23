import sys
sys.path.insert(0,'/home/claude/audit')
import numpy as np
from PIL import Image
import scene2_lib as S, combo as C
def lum(a): return 0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2]
old=np.array(Image.open('final/lane_two_track_1280x72.png').convert('RGBA'))
storm_old=np.array(Image.open('final/storm_lane_two_track_1280x72.png').convert('RGBA'))
m=np.load('final/puddle_mask.npy')
# the strip exactly as before the dirt patches were added: same tile walk, same tone, same ragged top edge
tile=np.array(S.pl_band('twotrack_s701_0', W=256))
SEG=[(0,215),(214,60),(61,255),(254,110),(111,240),(239,150),(151,250),(249,1)]
cols=[]
for a,b in SEG: cols += list(range(a,b+1)) if b>=a else list(range(a,b-1,-1))
base=np.array(C.tone(Image.fromarray(tile[:,cols,:],'RGBA'),0.35,cool=True))
new=base.copy(); new[...,3]=old[...,3]
changed=(new[...,:3]!=old[...,:3]).any(-1)&(old[...,3]>0)
print('pixels changed (the patches): %d | outside the patch areas: %d'%(changed.sum(), (changed&~m).sum()))
Image.fromarray(new,'RGBA').save('final/lane_two_track_1280x72.png')
def wet(a):
    a=a.astype(float); L=lum(a); w=np.clip((L-52)/25.0,0,1); f=1-0.15*w-0.04
    a[...,0]*=f*0.97; a[...,1]*=f; a[...,2]*=np.minimum(f*1.05,1.2)
    return np.clip(a,0,255).astype('uint8')
st=wet(new); st[...,3]=new[...,3]; st[m,:3]=storm_old[m,:3]          # keep the painted puddles where they are
Image.fromarray(st,'RGBA').save('final/storm_lane_two_track_1280x72.png')
L=lum(new.astype(float)); tr=(L[9:]>62)
brown=(new[...,0].astype(int)>=new[...,1].astype(int)-2)&(L>34)&(L<70); brown[:12]=False
from scipy import ndimage
lab,n=ndimage.label(ndimage.binary_opening(ndimage.binary_closing(brown,iterations=2))); sz=ndimage.sum(brown,lab,range(1,n+1)) if n else []
print('dirt patches left in the dry strip:', int(sum(1 for s in sz if s>=45)), '| gravel brightness %.0f'%L[9:][tr].mean(), '| storm alpha same as dry:', bool((st[...,3]==new[...,3]).all()))

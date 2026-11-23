"""Partial tier, made from the approved solid tier itself so the boards, posts and bags are the same drawing: the wire is taken off and a
14-row slice (the lower plank and the bag row above it) is cut out of the middle of the wall, so it stands about half as high."""
import sys; sys.path.insert(0,'.')
import numpy as np
from PIL import Image
import ext
v5=np.array(Image.open('solid_v5.png').convert('RGBA')); H,W=v5.shape[:2]
A0,B=ext.baseline_mid(Image.open('solid_v6.png'),0.45,0.8)
far=np.zeros_like(v5); far[20:46,78:]=v5[20:46,78:]
far_s=np.zeros_like(v5); ys,xs=np.nonzero(far[...,3]>0)
for y,x in zip(ys,xs): far_s[y-7,x-5]=far[y,x]
near=np.zeros_like(v5); nm=np.zeros((H,W),bool); nm[48:,:25]=True; near[nm]=v5[nm]
wall=v5.copy(); wall[20:46,78:]=0; wall[nm]=0
r,g,b_=wall[...,0].astype(int),wall[...,1].astype(int),wall[...,2].astype(int)
LO,HI=8,21; CUT=HI-LO+1
out=np.zeros_like(v5)
for x in range(W):
    yb=A0+B*x
    for y in range(H):
        if wall[y,x,3]<20: continue
        rel=yb-y
        if rel>27 and (r[y,x]-b_[y,x]>30) and g[y,x]<105: continue          # barbed wire: off
        if rel>31 and not any(p0<=x<=p1 for p0,p1 in ((21,28),(33,40),(45,52),(57,64),(71,78))): continue   # wire stubs between the posts
        if rel<LO: out[y,x]=wall[y,x]
        elif rel>HI and y+CUT<H: out[y+CUT,x]=wall[y,x]
res=far_s.copy(); m=out[...,3]>0; res[m]=out[m]; m=near[...,3]>0; res[m]=near[m]
im=Image.fromarray(res,'RGBA'); im.save('partial_v2.png')
bg=Image.new('RGBA',im.size,(40,44,70,255)); bg.alpha_composite(im); bg.resize((W*8,H*8),Image.NEAREST).save('partial_v2_8x.png')

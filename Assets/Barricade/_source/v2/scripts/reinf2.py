"""Reinforced tier fixes (Jeremy 2026-11-22): no lantern; the metal sheets must not blend into the end posts."""
import sys; sys.path.insert(0,'.')
import numpy as np
from PIL import Image
import ext, clean
PAD=12; OUT=(8,8,18,255)
r=np.array(Image.open('tier_reinforced.png').convert('RGBA')); s=np.array(Image.open('tier_solid.png').convert('RGBA'))
A0,B=ext.baseline_mid(Image.open('solid_v6.png'),0.45,0.8)
def yb(xc): return A0+B*(xc-PAD)+PAD            # base line in canvas coordinates
# 1. lantern off: the middle post's top and the wire come back from the solid tier
r[4:27,52:69]=s[4:27,52:69]
# 2. end posts come back from the solid tier (above the stakes), and each sheet gets a dark edge beside them
def rusty(p): return p[3]>20 and (int(p[0])-int(p[2])>18 or (abs(int(p[0])-int(p[2]))<14 and 70<p[0]<150))
for (c0,c1,edge,step) in ((33,40,41,1),(83,90,82,-1)):
    for x in range(c0,c1+1):
        y1=int(yb(x))-4
        r[:y1,x]=s[:y1,x]
    ys=[y for y in range(r.shape[0]) if r[y,edge+step,3]>20 and y<int(yb(edge))-3 and y>int(yb(edge))-33]
    for y in ys: r[y,edge]=OUT
im,_,_=clean.clean(Image.fromarray(r,'RGBA')); im.save('final_reinforced.png')
bg=Image.new('RGBA',im.size,(40,44,70,255)); bg.alpha_composite(im); bg.resize((im.size[0]*8,im.size[1]*8),Image.NEAREST).save('reinf2_8x.png')

import sys; sys.path.insert(0,'.')
import numpy as np
from PIL import Image
import ext
im=Image.open('s341_raw.png').convert('RGBA'); a=np.array(im)
a0,b=ext.baseline_mid(im,0.45,0.8)
for x in range(29,42):                       # leftovers of the patched corner hanging under the wall
    yb=int(round(a0+b*x)); a[yb+1:,x]=0
im=Image.fromarray(a,'RGBA').copy(); px=im.load()
OUT=(8,8,18,255); TOP=(84,85,86,255); LIT=(62,63,64,255); MID=(42,42,40,255); HOLE=(14,15,22,255)
# near stack: give the top tire a full, visible top ring (it was cut flat)
cx,cy,rx,ry=17.5,52.0,10.0,3.6
for y in range(47,58):
    for x in range(5,30):
        e=((x-cx)/rx)**2+((y-cy)/ry)**2
        if e<=1.0:
            h=((x-cx)/(rx*0.5))**2+((y-cy-0.3)/(ry*0.45))**2
            if e>0.80: c=OUT
            elif h<=1.0: c=HOLE
            elif h<=1.9 and y<cy: c=MID                        # inner lip, in shade
            else: c=TOP if (y<=cy-0.5 and x<cx+3) else LIT
            px[x,y]=c
# side wall of the top tire just under the ring keeps the stack's own pixels; one dark seam line under the ring
for x in range(8,28):
    y=int(round(cy+ry*(1-((x-cx)/rx)**2)**0.5))+1
    if px[x,y][3] and px[x,y]!=OUT: px[x,y]=(26,27,30,255)
bb=(5,0,100,max(74,im.getbbox()[3])); out=im.crop(bb); out.save('solid_v5.png'); print(out.size,im.getbbox())
bg=Image.new('RGBA',out.size,(40,44,70,255)); bg.alpha_composite(out); bg.resize((out.size[0]*7,out.size[1]*7),Image.NEAREST).save('solid_v5_7x.png')

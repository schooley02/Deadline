from PIL import Image
import math, sys
src,dst=sys.argv[1],sys.argv[2]
im=Image.open(src).convert('RGBA'); p=im.load()
CX,CY=101.7,25.0
COL=(255,244,214)
for x in range(160):
    for y in range(0,70):
        d=math.hypot(x-CX,(y-CY)*1.05)
        q=p[x,y]
        if d<8.5: continue                      # leave the lens itself alone
        if q[3]==0:
            if d<26:
                a=int(255*0.62*(1-d/26)**1.7)
                if a>6: p[x,y]=COL+(min(160,a),)
        elif d<22:
            k=0.42*(1-d/22)**1.8
            p[x,y]=(min(255,int(q[0]+(COL[0]-q[0])*k)),min(255,int(q[1]+(COL[1]-q[1])*k)),min(255,int(q[2]+(COL[2]-q[2])*k)),q[3])
im.save(dst)

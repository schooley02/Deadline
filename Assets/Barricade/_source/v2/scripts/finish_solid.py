import sys, math; sys.path.insert(0,'.')
import numpy as np
from PIL import Image
import clean
im,_,_=clean.clean(Image.open('wall5_s323.png'),erase=[(4,63,11,69)])
im=im.copy(); px=im.load(); W,H=im.size
posts=[(9,14,21),(21,26,17),(33,38,12),(45,50,6),(59,64,1)]
R0,R1,R2=(70,44,34,255),(104,66,46,255),(134,92,64,255)
for (a0,a1,ta),(b0,b1,tb) in zip(posts,posts[1:]):
    xa,xb=a1+1,b0-1
    for s,(da,db) in enumerate(((2,2),(6,6))):
        for x in range(xa,xb+1):
            t=(x-xa)/max(1,xb-xa); y=round(ta+da+(tb+db-ta-da)*t+1.6*math.sin(math.pi*t))
            if 0<=y<H:
                px[x,y]=R1 if (x+s)%3 else R0
                if (x+s*2)%4==1 and y-1>=0 and px[x,y-1][3]==0: px[x,y-1]=R2
                if (x+s*2)%4==3 and y+1<H and px[x,y+1][3]==0: px[x,y+1]=R0
im.save('solid_final.png')
bg=Image.new('RGBA',(W+8,H+8),(40,44,70,255)); bg.alpha_composite(im,(4,4)); bg.resize(((W+8)*8,(H+8)*8),Image.NEAREST).save('solid_final_8x.png')

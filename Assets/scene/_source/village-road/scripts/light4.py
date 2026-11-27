"""Traffic light, chunky version with a THICKER pole (Jeremy 2026-11-26: after trying the full-resolution signs, "i think i like this version better
but make this part of the pole thicker"). 2x chunky art like the rest of the village ground set. The mast arm rises to the upper left (the scene's
depth direction), so it reads as reaching back over the road; three-lens head with hoods, red lit. Art px, shown at 2x."""
import random
import numpy as np
from PIL import Image
from road import glow, ground_shadow
AW,AH=20,38; o=np.zeros((AH,AW,4),np.uint8); rnd=random.Random(3)
def put(y,x,c):
    if 0<=y<AH and 0<=x<AW: o[y,x,:3]=c; o[y,x,3]=255
PX=16                                                                    # pole columns 16,17,18: 3 art px = 6 px on screen (was 2, and its dark column vanished into the night)
L,M,R=(58,62,66),(86,90,92),(112,114,114)
for y in range(5,37):
    put(y,PX,L); put(y,PX+1,M); put(y,PX+2,R)
for (y,x,c) in ((9,PX+1,(96,100,100)),(14,PX+2,(96,68,48)),(15,PX+2,(86,62,46)),(21,PX+1,(74,78,80)),(26,PX+1,(96,68,48)),(27,PX+1,(84,60,46)),(30,PX+2,(98,100,100)),(33,PX,(70,56,46)),(34,PX+1,(92,66,48))): put(y,x,c)
for x in (PX,PX+1,PX+2): put(22,x,(50,52,56))                             # a clamp band half way up
for x in range(PX-1,PX+4): put(37,x,(40,42,44))                           # base plate
put(36,PX-1,(52,54,56)); put(36,PX+3,(52,54,56))
put(4,PX+1,(104,106,106)); put(4,PX+2,(84,86,88))                         # cap
TIPX,TIPY=5,1
for x in range(TIPX,PX):
    y=TIPY+(x-TIPX)//2
    put(y,x,(97,97,92) if (x%5) else (89,95,95)); put(y+1,x,(69,67,64) if (x%7) else (86,62,46))
put(TIPY+(PX-1-TIPX)//2+2,PX-1,(56,54,50)); put(TIPY+(PX-1-TIPX)//2+2,PX-2,(56,54,50))
put(TIPY+2,TIPX,(56,54,50))
PAL={'k':(20,22,26),'v':(12,13,16),'H':(66,70,76),'R':(210,76,56),'r':(164,52,42),'Y':(138,110,46),'y':(104,84,38),'G':(52,110,78),'g':(40,86,62)}
HEAD=[" kkkk ","vvvvkH"," kRRkH"," kRrkH","vvvvkH"," kYYkH"," kYykH","vvvvkH"," kGGkH"," kGgkH"," kkkk "]
for j,row in enumerate(HEAD):
    for i,ch in enumerate(row):
        if ch in PAL: put(TIPY+3+j,2+i,PAL[ch])
art=Image.fromarray(o,'RGBA'); big=art.resize((AW*2,AH*2),Image.NEAREST); big.save('light4_40x76.png')
c=Image.new('RGBA',(AW*2,AH*2+2),(0,0,0,0)); ground_shadow(c,PX*2+1,AH*2-2,8); c.alpha_composite(big,(0,0)); glow(c,2*(2+2)+2,2*(TIPY+3+2)+2,8,(214,72,52),100)
c.save('light4_ship_40x78.png'); print(c.size)

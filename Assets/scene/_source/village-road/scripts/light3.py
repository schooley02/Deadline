"""Traffic light v3 (Jeremy 2026-11-26: "angle it like it is extending over the road and make the light look more realistic").
PixelLab's weathered pole is kept; the mast arm is redrawn rising to the upper left (the scene's depth direction: side walls recede up-left),
so it reads as reaching back over the road; the head is a three-lens signal with hoods. Art px, shown at 2x."""
import numpy as np
from PIL import Image
from road import glow, ground_shadow
pl=np.array(Image.open('light_pl.png').convert('RGBA'))[::2,::2]          # 21x36 art
AW,AH=19,38; o=np.zeros((AH,AW,4),np.uint8)
def put(y,x,c):
    if 0<=y<AH and 0<=x<AW: o[y,x,:3]=c; o[y,x,3]=255
PX=16                                                                    # pole columns 16,17
for i,r in enumerate(range(3,34)):                                       # PixelLab pole rows 3..33 -> y 6..36
    for k in (0,1):
        if pl[r,18+k,3]>0: put(6+i,PX+k,tuple(int(v) for v in pl[r,18+k,:3]))
put(5,PX,(97,97,92)); put(5,PX+1,(69,67,64))                             # pole cap
for x in range(PX-1,PX+3): put(37,x,(40,42,44))                          # base plate
put(36,PX-1,(48,49,47)); put(36,PX+2,(48,49,47))
# mast arm: from the joint on the pole up to the tip over the road, 1 up per 2 across, a lit top edge and a dark underside
TIPX,TIPY=5,1
for x in range(TIPX,PX):
    y=TIPY+(x-TIPX)//2
    put(y,x,(97,97,92) if (x%5) else (89,95,95)); put(y+1,x,(69,67,64) if (x%7) else (86,62,46))
put(TIPY+(PX-1-TIPX)//2+2,PX-1,(56,54,50)); put(TIPY+(PX-1-TIPX)//2+2,PX-2,(56,54,50))   # short gusset under the joint
put(TIPY+2,TIPX,(56,54,50))                                               # hanger
PAL={'k':(20,22,26),'v':(12,13,16),'H':(66,70,76),'R':(210,76,56),'r':(164,52,42),'Y':(138,110,46),'y':(104,84,38),'G':(52,110,78),'g':(40,86,62)}
HEAD=[" kkkk ","vvvvkH"," kRRkH"," kRrkH","vvvvkH"," kYYkH"," kYykH","vvvvkH"," kGGkH"," kGgkH"," kkkk "]
for j,row in enumerate(HEAD):
    for i,ch in enumerate(row):
        if ch in PAL: put(TIPY+3+j,2+i,PAL[ch])
art=Image.fromarray(o,'RGBA'); art.save('light3_art_19x38.png')
big=art.resize((AW*2,AH*2),Image.NEAREST); big.save('light3_38x76.png')
c=Image.new('RGBA',(AW*2,AH*2+2),(0,0,0,0)); ground_shadow(c,PX*2+1,AH*2-2,8); c.alpha_composite(big,(0,0)); glow(c,2*(2+2)+2,2*(TIPY+3+2)+2,8,(214,72,52),100)
c.save('light3_ship_38x78.png'); print(c.size)
bg=Image.new('RGBA',c.size,(34,44,58,255)); bg.alpha_composite(c); bg.resize((c.width*8,c.height*8),Image.NEAREST).crop((0,0,c.width*8,360)).save('light3_zoom.png')

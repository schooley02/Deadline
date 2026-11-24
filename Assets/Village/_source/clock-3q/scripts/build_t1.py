from PIL import Image, ImageDraw, ImageEnhance
import random, math, sys
sys.path.insert(0,'/home/claude/pl')
from lamps import lamp
random.seed(21)
im=Image.open('clock_t3_final_no_lamps.png' if False else 'clock_t3_nolamps_src.png').convert('RGBA'); px=im.load(); d=ImageDraw.Draw(im); W,H=im.size
O=(14,12,16,255); BLK=(14,13,17,255); GL=(22,20,26,255); SHARD=(128,136,138,255); CLR=(0,0,0,0)
# ---- 1. clock: dead. dull dark glass, the front face smashed in, one hand hanging
DEAD={(252,245,161):(104,102,90),(217,210,144):(90,88,78),(222,212,140):(80,78,70),(196,186,122):(68,66,60)}
for y in range(58,96):
    for x in range(28,84):
        if px[x,y][:3] in DEAD: px[x,y]=DEAD[px[x,y][:3]]+(255,)
hole=[(61,73),(64,70),(68,69),(72,72),(74,77),(73,82),(69,85),(64,84),(60,80),(62,77)]
d.polygon(hole,fill=BLK)
for (a,b) in (((61,73),(57,69)),((72,72),(75,68)),((74,77),(77,79)),((64,84),(62,87)),((69,85),(70,88)),((60,80),(56,82))):
    d.line([a,b],fill=(30,28,32,255))
d.line([66,74,65,83],fill=(74,70,62,255)); px[66,73]=(96,92,80,255)                 # the minute hand, hanging
for (x,y) in ((63,71),(71,74),(72,81),(62,82)): px[x,y]=SHARD
d.line([36,74,40,84],fill=(30,28,32,255)); d.line([40,84,37,88],fill=(30,28,32,255))  # crack across the side face
# ---- 2. every window smashed and dark
def smashed(x0,x1,y0,y1,shards):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1): px[x,y]=GL
    for s in shards: px[s[0],s[1]]=SHARD
smashed(65,66,107,116,[(65,107),(66,116),(65,115)]); smashed(65,66,134,143,[(66,134),(65,143),(66,142)])
for y in range(104,148):
    for x in range(34,45):
        r,g,b,a_=px[x,y]
        if a_>20 and r>90 and r>g+25 and g>b: px[x,y]=GL
px[39,113]=SHARD; px[39,142]=SHARD
d.line([62,140,69,146],fill=(96,72,46,255),width=2); px[62,140]=(40,30,22,255)        # one plank left, hanging off the lower window
# ---- 3. belfry: louvres torn out, a few slats left hanging
for (x0,x1) in ((55,62),(67,74)):
    for y in range(38,50):
        for x in range(x0,x1+1):
            if px[x,y][:3]!=(25,23,27): px[x,y]=(18,17,21,255)
d.line([56,40,61,41],fill=(116,112,100,255)); d.line([55,46,60,48],fill=(100,96,86,255)); d.line([68,43,73,42],fill=(110,106,96,255)); d.line([70,45,74,49],fill=(96,92,84,255))
for y in (42,45,48):
    for x in range(34,44):
        p=px[x,y]
        if p[3]>20 and sum(p[:3])>200 and random.random()<0.5: px[x,y]=(26,24,28,255)
# ---- 4. roof: a hole with bare rafters, slates gone, the finial snapped off
AP=(59,5); CL=(48,28); CR=(85,28)
def in_front(x,y):
    if not (5<=y<=27): return False
    t=(y-AP[1])/(CR[1]-AP[1]); return AP[0]+(CL[0]-AP[0])*t+1 <= x <= AP[0]+(CR[0]-AP[0])*t-1
rh=[(63,14),(68,13),(73,17),(77,22),(75,26),(68,27),(63,24),(61,19)]
d.polygon(rh,fill=(10,10,14,255))
# roof frame seen through the hole, following the roof's own geometry: rafters run up the slope, parallel to the
# line from the middle of the eave to the peak (they lean left going up, like the face itself); battens run level, parallel to the eave
hm=Image.new('L',im.size,0); ImageDraw.Draw(hm).polygon(rh,fill=255); hmp=hm.load()
SLOPE=(AP[0]-(CL[0]+CR[0])/2)/(AP[1]-CR[1])          # x shift per row going up the face's centre line
for by in (17,22):                                    # battens first (they sit behind the rafters from this side)
    for x in range(58,80):
        if hmp[x,by]: px[x,by]=(52,40,30,255)
for x0 in (65,70,75,80):                              # rafters, 5 px apart at the eave
    for y in range(10,29):
        x=int(round(x0+SLOPE*(y-28)))
        if 0<=x<W and hmp[x,y]:
            px[x,y]=(92,68,44,255)
            if hmp[x+1,y]: px[x+1,y]=(64,48,32,255)
for (x,y) in ((62,16),(70,12),(76,20),(66,27),(61,22),(74,26)): px[x,y]=(30,30,36,255)
for (x,y,w) in ((55,14,3),(52,22,3),(57,9,2),(54,25,2),(80,25,2)):
    for i in range(w):
        if in_front(x+i,y): px[x+i,y]=(16,16,20,255); px[x+i,y+1]=(28,28,34,255)
for y in range(0,5):
    for x in range(54,66): px[x,y]=CLR
px[59,4]=O; px[60,4]=O; px[59,3]=(60,60,64,255)
# ---- 5. masonry broken away: the clock stage's top ledge at the right end, a bite out of the eave, a chipped base ledge
def bite(points):
    d.polygon(points,fill=CLR)
bite([(83,53),(92,53),(92,62),(88,61),(87,58),(84,57)])
bite([(82,27),(90,27),(90,34),(86,33),(85,31),(83,30)])
bite([(24,161),(31,161),(30,166),(28,170),(24,170)])
for (a,b) in (((84,57),(81,63)),((81,63),(82,70)),((82,70),(79,76)),                 # cracks running down from the breaks
              ((52,100),(55,108)),((55,108),(53,118)),((53,118),(57,127)),
              ((78,150),(74,158)),((74,158),(76,164)),((50,170),(53,178)),((53,178),(50,186)),
              ((36,120),(34,130)),((34,130),(37,138))):
    d.line([a,b],fill=(34,32,34,255))
# ---- 6. the door: one leaf gone (black doorway), the other hanging open, a board on the steps
for y in range(170,200):
    for x in range(62,68): px[x,y]=(10,10,13,255)
d.polygon([(68,170),(73,172),(73,199),(68,199)],fill=(40,30,24,255)); d.line([68,170,68,199],fill=(22,18,16,255)); d.line([73,172,73,199],fill=(22,18,16,255))
d.line([69,185,72,186],fill=(22,18,16,255))
d.line([57,203,70,200],fill=(92,70,46,255),width=2)
im.save('t1/clock_t1_nolamp.png')
# ---- 7. street lamps: the left one snapped, its lantern on the ground; the right one dark with broken glass
for y in range(193,207): px[37,y]=(26,26,30,255); px[38,y]=(44,44,50,255)
px[37,192]=(26,26,30,255); px[38,191]=(44,44,50,255); d.rectangle([36,204,39,207],fill=(30,30,34,255))
d.line([41,206,50,205],fill=(34,34,38,255),width=2)
d.rectangle([49,201,54,206],fill=(18,18,22,255)); d.rectangle([49,201,54,206],outline=(30,30,34,255)); px[51,203]=SHARD; px[53,205]=SHARD
lamp(im,94,'broken'); px=im.load(); d=ImageDraw.Draw(im)
im.save('t1/clock_t1_code_precolour.png')

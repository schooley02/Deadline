from PIL import Image, ImageDraw
im=Image.open('clock_t3_final_112x208.png').convert('RGBA'); px=im.load(); d=ImageDraw.Draw(im)
O=(14,12,16,255)
# ---- 1. sniper in the LEFT belfry opening: louvres taken out, dark interior, helmeted figure, rifle on the sill
for y in range(37,50):
    for x in range(55,63):
        if px[x,y][:3]!=(25,23,27) and not (y<=37 and x in (55,62)):
            k=max(0,1-((x-59.5)**2/30+(y-41)**2/60))           # a lamp hung high inside, light falling off to the edges
            px[x,y]=(int(96+96*k),int(62+66*k),int(34+30*k),255)
for y in range(38,50): px[55,y]=(70,46,28,255)            # inner jamb in shadow
HEL=(40,44,32,255); HELL=(66,70,50,255); SK=(132,94,66,255); SKS=(84,58,42,255); UNI=(44,48,34,255); UNID=(30,32,24,255)
for x,y in [(58,40),(59,40),(60,40),(57,41),(58,41),(59,41),(60,41),(61,41)]: px[x,y]=HELL if y==40 else HEL
for x in range(57,62): px[x,42]=(40,42,32,255)             # helmet rim
for x,y,c in [(58,43,SK),(59,43,SKS),(60,43,SK),(58,44,SKS),(59,44,SK),(60,44,SKS)]: px[x,y]=c
for y in range(45,50):
    for x in range(56,62): px[x,y]=UNI if x>57 else UNID
GUN=(28,28,30,255); GUNL=(70,70,72,255)
for i,(x,y) in enumerate([(61,46),(60,46),(59,47),(58,47),(57,47),(56,48),(55,48),(54,48),(53,49),(52,49)]): px[x,y]=GUN if i%3 else GUNL
px[58,46]=(60,48,34,255); px[57,46]=(60,48,34,255)          # stock against the shoulder
for x in range(55,63): px[x,50]=(25,23,27,255)
# ---- 2. searchlight on the right end of the clock-stage cornice, tilted 45 degrees down to the right
import math
def poly(cx,cy,L0,L1,W,col):
    u=(math.sqrt(.5),math.sqrt(.5)); v=(-math.sqrt(.5),math.sqrt(.5))
    pts=[(cx+u[0]*a+v[0]*b, cy+u[1]*a+v[1]*b) for a,b in ((L0,-W),(L1,-W),(L1,W),(L0,W))]
    d.polygon(pts,fill=col)
cx,cy=81,49
poly(cx,cy,-4.5,4.5,3.4,O)
poly(cx,cy,-3.5,3.5,2.4,(66,70,78,255))
poly(cx,cy,-3.5,3.5,0.6,(96,100,108,255))
poly(cx,cy,3.5,4.6,2.6,(250,246,226,255))
d.rectangle([79,52,80,54],fill=O); px[81,53]=(66,70,78,255)       # yoke down to the ledge
# ---- 3. two cast-iron street lamps at the foot
def lamp(x):
    for y in range(176,207): px[x,y]=(26,26,30,255); px[x+1,y]=(44,44,50,255)
    d.rectangle([x-1,204,x+2,207],fill=(30,30,34,255))
    d.rectangle([x-2,168,x+3,175],fill=(250,214,150,255)); d.rectangle([x-2,168,x+3,175],outline=(24,24,28,255))
    d.line([x-1,172,x+2,172],fill=(24,24,28,255))
    d.polygon([(x-3,168),(x+4,168),(x+0,165),(x+1,165)],fill=(30,30,34,255)); px[x,164]=O; px[x+1,164]=O
    d.line([x-1,176,x+2,176],fill=(30,30,34,255))
lamp(37); lamp(94)
# ---- 4. sandbag stacks: the Gym's own sandbag art (T5 stacks), brought to back-row size with PixelLab resize
lamp(37); lamp(94)                                   # lamps first: the bags are stacked in front of their feet
def stack(path,left,rows=None):
    sp=Image.open(path).convert('RGBA')
    if rows: sp=sp.crop((0,rows[0],sp.width,rows[1]+1))
    bb=sp.getbbox(); sp=sp.crop(bb)
    im.alpha_composite(sp,(left,208-sp.height)); return sp.size
print(stack('bags/gymL_r2.png',34), stack('bags/gymR_r1.png',81,rows=(2,23)))
im.save('t4/clock_t4_code.png')

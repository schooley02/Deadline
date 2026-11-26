import sys; sys.path.insert(0,'/home/claude/lib')
from collections import deque
from PIL import Image
from lab_fx import glow, lum, ALL
v=Image.open('lab_t1_base_v1.png').convert('RGBA'); P=v.load()
PICK={'cage':'t1_cage_201_0.png','roof':'t1_roof_201_0.png','low':'t1_low_201_0.png','door':'t1_door_201_0.png','roofR':'t1_roofR_211_0.png','foot':'t1_foot_211_0.png'}
for name,fn in PICK.items():
    o=Image.open(fn).convert('RGBA'); O=o.load(); M=Image.open(f'mask_t1_{name}.png').convert('L').load()
    for x in range(160):
        for y in range(160):
            if not M[x,y]: continue
            if name=='door' and y>146: continue
            if name=='roof' and x>110: continue                      # right-hand part redone as 'roofR'
            if name=='low' and y>100: continue                       # footing part redone as 'foot'
            if name=='foot' and y<138 and 72<=x<=118:                 # over the glass keep only the growth itself, so the new glass shows behind it
                gp=O[x,y]; isg=gp[1]>=gp[0] and gp[1]>gp[2]+4 and lum(gp)>60
                nb=any(M[x+dx,y+dy] and (lambda q: q[1]>=q[0] and q[1]>q[2]+4 and lum(q)>60)(O[x+dx,y+dy]) for dx in (-1,0,1) for dy in (-1,0,1))
                if not (isg or (nb and lum(gp)<50)): continue                      # no new step below the footing: the ground line stays the same on every star
            P[x,y]=O[x,y]
# the roof option came back with white where the sky was: clear it (flood from the open air, so pale caps are never touched)
white=lambda p: p[3]==255 and min(p[:3])>232
q=deque((x,y) for x in range(160) for y in range(160) if P[x,y][3]==0); seen=set(q)
for x in range(160):
    for y in range(160):
        if white(P[x,y]) and (x in (0,159) or y in (0,159)): q.append((x,y)); seen.add((x,y)); P[x,y]=(0,0,0,0)
while q:
    x,y=q.popleft()
    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
        a,b=x+dx,y+dy
        if 0<=a<160 and 0<=b<160 and (a,b) not in seen and white(P[a,b]): seen.add((a,b)); P[a,b]=(0,0,0,0); q.append((a,b))
B0=Image.open('lab_t1_base_v1.png').convert('RGBA').load()
green=lambda p: p[3]==255 and p[1]>=p[0] and p[1]>p[2]+4 and lum(p)>60
for x in range(160):
    for y in range(160):
        if white(P[x,y]): P[x,y]=B0[x,y]                                   # enclosed white pockets: back to what was there
for x in range(112,139):                                               # the sign must still read LAB: growth only over its far right end
    for y in range(48,65): P[x,y]=B0[x,y]
# the same faint green light inside shows in the doorway: up the gap beside the open door, on the floor behind it, and low in its broken window
for x in range(122,141):
    for y in range(97,141):
        p=P[x,y]
        if p[3]!=255 or lum(p)>=14: continue
        if 129<=x<=138 and 103<=y<=115: k=max(0.0,(y-104)/11.0)*0.16                       # door window
        elif y>=137: k=0.40*max(0.0,1-abs(x-128)/13.0)+0.10                              # floor just inside
        elif x<=126: k=0.06+0.24*max(0.0,(y-100)/37.0)**2                                # the gap
        else: continue
        P[x,y]=(int(p[0]+(70-p[0])*k),int(p[1]+(140-p[1])*k),int(p[2]+(84-p[2])*k),255)
for (cx,cy) in ((127,139),(131,140)):                                                    # two small caps on the floor behind the door
    if lum(P[cx,cy])<80: P[cx,cy]=(98,130,94,255)
    if lum(P[cx+1,cy])<80: P[cx+1,cy]=(78,108,78,255)
print('white left:',sum(1 for x in range(160) for y in range(160) if white(P[x,y])))
v.save('lab_t1_draft_v10_noglow.png')
f=glow(v,ALL,excl=False); f.save('lab_t1_draft_v10.png'); print(f.getbbox())
bg=Image.new('RGBA',(1600,1600),(20,24,38,255)); bg.alpha_composite(f.resize((1600,1600),Image.NEAREST)); bg.save('lab_t1_draft_v10_10x.png')

import sys, colorsys
from PIL import Image
base,ip,mask,out,top_k,bot_k=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4],float(sys.argv[5]),float(sys.argv[6])
im=Image.open(base).convert('RGBA'); p=im.load()
q=Image.open(ip).convert('RGBA').load(); m=Image.open(mask).convert('L').load()
def tan(c):
    h,s,v=colorsys.rgb_to_hsv(*[k/255 for k in c[:3]]); return 0.03<h<0.2 and s>0.12 and v>0.18
bag=set()
for x in range(192):
    for y in range(160):
        if m[x,y]>128 and q[x,y][3] and tan(q[x,y]): bag.add((x,y))
# dark outline pixels that touch a bag pixel belong to the bag too
edge=set()
for x in range(192):
    for y in range(160):
        if m[x,y]>128 and (x,y) not in bag and q[x,y][3] and max(q[x,y][:3])<90:
            if any((x+dx,y+dy) in bag for dx in(-1,0,1) for dy in(-1,0,1)): edge.add((x,y))
# piles = connected groups; light each by height inside its own pile
cols={}
for (x,y) in bag|edge: cols.setdefault(x,[]).append(y)
import collections
groups=[]; seen=set()
for s_ in bag:
    if s_ in seen: continue
    st=[s_]; g=[]
    while st:
        a=st.pop()
        if a in seen or a not in bag|edge: continue
        seen.add(a); g.append(a)
        for dx,dy in((1,0),(-1,0),(0,1),(0,-1)): st.append((a[0]+dx,a[1]+dy))
    if len(g)>30: groups.append(g)
for g in groups:
    ys=[y for x,y in g]; t,b=min(ys),max(ys)
    for (x,y) in g:
        c=q[x,y]; f=top_k+(bot_k-top_k)*((y-t)/max(1,b-t))**1.2
        p[x,y]=(min(255,int(c[0]*f)),min(255,int(c[1]*f)),min(255,int(c[2]*f)),255)
im.save(out)
print(len(groups),'piles')

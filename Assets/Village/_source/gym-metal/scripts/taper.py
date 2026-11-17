import sys
from PIL import Image
src,base,dst=sys.argv[1],sys.argv[2],sys.argv[3]
im=Image.open(src).convert('RGBA'); p=im.load(); b=Image.open(base).convert('RGBA').load()
OUT=(36,28,20,255)
for (x0,x1,top,bot) in ((53,80,112,158),(88,115,112,158),(139,164,120,158)):
    # pile pixels = differ from the bag-less base
    pix={(x,y) for x in range(x0,x1+1) for y in range(top,bot+1) if p[x,y]!=b[x,y]}
    if not pix: continue
    L=min(x for x,y in pix); R=max(x for x,y in pix); T=min(y for x,y in pix); B=max(y for x,y in pix)
    for (x,y) in list(pix):
        inset=int((B-y)*0.16)          # ~1 px every 6 rows (one bag row)
        if x<L+inset or x>R-inset:
            p[x,y]=b[x,y]; pix.discard((x,y))
    for (x,y) in pix:                  # outline the new side edges
        if p[x-1,y]==b[x-1,y] and (x-1,y) not in pix and x<=L+int((B-y)*0.16)+1: p[x,y]=OUT
        if (x+1,y) not in pix and x>=R-int((B-y)*0.16)-1: p[x,y]=OUT
im.save(dst)

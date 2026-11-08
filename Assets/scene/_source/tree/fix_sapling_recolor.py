from PIL import Image
im=Image.open('tree/sapling_pixellab_1.png').convert('RGBA'); px=im.load(); W,H=im.size
lum=lambda c: c[0]+c[1]+c[2]
out=im.copy(); po=out.load()
LEAFPAL=[(23,26,58),(34,32,71),(51,58,97),(71,79,141)]
def is_clump(x,y): return (y<58) or (129<=x<=145 and 60<=y<=70)
for y in range(H):
    xs=[x for x in range(W) if px[x,y][3]>0 and not is_clump(x,y)]
    runs=[];cur=[]
    for x in xs:
        if cur and x!=cur[-1]+1: runs.append(cur);cur=[]
        cur.append(x)
    if cur: runs.append(cur)
    for r in runs:
        n=len(r)
        for i,x in enumerate(r):
            if n==1: c=(34,29,60)
            elif n==2: c=(0,0,29) if i==0 else (52,37,72)
            elif i==0 or i==n-1: c=(0,0,29)
            elif i==n-2 and n>=4: c=(119,103,157)
            elif i==n-2: c=(84,70,111)
            else: c=(52,37,72) if (x+y)%4 else (60,44,81)
            po[x,y]=c+(255,)
# clumps: lift leaves to the young tree's leaf colours, keep near-black outlines
for y in range(H):
    for x in range(W):
        if px[x,y][3]>0 and is_clump(x,y):
            l=lum(px[x,y])
            if l>=45: po[x,y]=LEAFPAL[0 if l<90 else 1 if l<130 else 2 if l<190 else 3]+(255,)
            else: po[x,y]=(0,0,29,255) if l<25 else (13,11,42,255)
out.save('tree/sapling_recol.png')
al=Image.new('RGBA',(192,128),(0,0,0,0)); al.paste(out,(30,36),out); al.save('tree/sapling_aligned.png'); al.save('repo/tree_sapling.png')
y=Image.open('tree/young_aligned.png')
tiles=[]
for t in (Image.open('tree/sapling_pixellab_1.png').convert('RGBA').crop((90,30,150,96)), out.crop((90,30,150,96)), y.crop((100,20,192,128))):
    bg=Image.new('RGBA',t.size,(120,116,150,255)); bg.alpha_composite(t); tiles.append(bg.resize((t.width*5,t.height*5),Image.NEAREST))
Wt=sum(t.width for t in tiles)+40; o=Image.new('RGB',(Wt,max(t.height for t in tiles)),(255,255,255)); x=0
for t in tiles: o.paste(t,(x,0)); x+=t.width+20
o.save('sapling_cmp.png')

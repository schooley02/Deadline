import random
OUT=(40,30,22)
TAN=[(228,198,146),(206,172,120),(182,148,100),(152,120,80),(124,96,62)]
SHAPE=[(2,7),(1,8),(0,9),(0,9),(1,8),(2,7)]     # rows of a 10x6 pillow-shaped bag (inclusive x)
def _bag(p,x0,y0,shade,rng):
    for r,(a,b) in enumerate(SHAPE):
        for dx in range(a,b+1):
            x,y=x0+dx,y0+r
            edge = dx in(a,b) or r in(0,5)
            if edge: c=OUT
            else:
                i={1:0,2:1,3:2,4:3}[r]
                if dx in(7,8) and r in(2,3,4): i=min(4,i+1)     # tied end in shade
                if dx==3 and r==1: c=tuple(min(255,v+14) for v in TAN[0])
                else: c=TAN[i]
                c=tuple(max(0,min(255,int(v*shade)+rng.randint(-5,5))) for v in c)
            p[x,y]=c+(255,)
def pile(img,left,bottom,cols,layers,top_light=1.0,low=0.62,seed=1,contact=0.7):
    rng=random.Random(seed); p=img.load()
    for L in range(layers):
        n=cols
        xs=left+(0 if L%2==0 else 4)+rng.choice((0,0,1))
        y0=bottom-5-L*4
        shade=low+(top_light-low)*(L/max(1,layers-1))
        for b in range(n):
            _bag(p,xs+b*9,y0+rng.choice((0,0,0,1)),shade,rng)
        if L>0:      # contact shadow cast on the bags below
            for x in range(xs+1,xs+n*9):
                for y in (y0+6,y0+7):
                    if 0<=y<img.height:
                        q=p[x,y]
                        if q[3] and q[:3]!=OUT and q[0]>q[2]+25: p[x,y]=(int(q[0]*contact),int(q[1]*contact*0.98),int(q[2]*contact*0.95),255)
def width(cols): return cols*9+1

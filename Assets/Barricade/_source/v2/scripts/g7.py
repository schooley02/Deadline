import sys, concurrent.futures as cf
sys.path.insert(0,'/home/claude/work/pl'); sys.path.insert(0,'.'); import pl
import numpy as np
from PIL import Image
from scipy import ndimage
import g5
src=Image.open('solid_final.png').convert('RGBA'); a=np.array(src)
PADL,PADB=18,10
W,H=a.shape[1]+PADL,a.shape[0]+PADB
c=np.zeros((H,W,4),np.uint8); c[:a.shape[0],PADL:]=a
hole=np.zeros((H,W),bool)
for y in range(46,69):
    for x in range(5,23):
        sx,sy=x+12,y-5
        if 18<=sx<=22: sx,sy=x+24,y-10
        hole[y,x+PADL]=True
        c[y,x+PADL]=a[sy,sx] if (0<=sy<a.shape[0] and sx<a.shape[1]) else 0
g=Image.fromarray(c,'RGBA')
tm=Image.new('RGBA',(W,H),(0,0,0,0))
for k in range(3): g5.tire(tm,PADL-4+(k%2),66-k*5)
g.alpha_composite(tm)
m=hole|(np.array(tm)[...,3]>0); m=ndimage.binary_dilation(m,iterations=3)
g.save('guide7.png'); Image.fromarray((m*255).astype('uint8')).save('guide7_mask.png')
# context with the church
CW,CH,GB=224,136,105
church=Image.open('/mnt/user-data/uploads/Deadline/Assets/Base/base_100.png').convert('RGBA').crop((60,96,184,200))
ctx=Image.new('RGBA',(CW,CH),(0,0,0,0)); ctx.alpha_composite(church,(0,GB-104))
GX,GY=118,GB+6-(66+4)
ctx.alpha_composite(g,(GX,GY)); mk=np.zeros((CH,CW),bool); mk[GY:GY+H,GX:GX+W]=m[:CH-GY,:CW-GX]
ctx.save('ctx7.png'); Image.fromarray((mk*255).astype('uint8')).save('ctx7_mask.png')
DESC=("The near (lower left) end of a survivor barricade, in exactly the same pixel art style as the rest of the barricade and the church: "
      "the wall of timber posts, nailed planks and stacked olive-tan burlap sandbags simply continues down to its end with nothing in "
      "front of it, and the wall ENDS in a stack of three old black car tires lying flat on the ground, beside the last post and in line "
      "with the wall; every tire is a clear thick black rubber ring with a visible round hole and tread on its side. Same dark navy "
      "outline, same flat cel shading, muted, weathered. No white, no ground, no grass, no glow.")
if __name__=='__main__':
    def run(seed):
        outs,j=pl.inpaint(ctx,Image.fromarray((mk*255).astype('uint8')),DESC,seed); outs[0].save(f'gen/inp7_s{seed}.png'); return seed,len(outs),j.get('status')
    with cf.ThreadPoolExecutor(3) as ex:
        for f in [ex.submit(run,s) for s in (341,342,343)]:
            try: print(f.result(),flush=True)
            except Exception as x: print('ERR',repr(x)[:300],flush=True)
    # composite: original outside the mask, inpaint inside
    import ext, prep
    outs=[]
    for s in (341,342,343):
        r=np.array(Image.open(f'gen/inp7_s{s}.png').convert('RGBA')); base=np.array(ctx)
        full=base.copy(); full[mk]=r[mk]
        w=full[GY:GY+H,GX:GX+W].copy()
        wm=mk[GY:GY+H,GX:GX+W]
        white=(w[...,:3].min(-1)>=232)&wm; w[white]=0; w[(w[...,3]<20)]=0
        im=Image.fromarray(w,'RGBA'); im.save(f'wall7_{s}.png'); outs.append(im)
    sh=Image.new('RGBA',(sum(i.size[0] for i in outs)+g.size[0]+24,H+8),(40,44,70,255)); x=4
    for i in [g]+outs: sh.alpha_composite(i,(x,4)); x+=i.size[0]+4
    sh.resize((sh.size[0]*5,sh.size[1]*5),Image.NEAREST).save('walls7_5x.png')

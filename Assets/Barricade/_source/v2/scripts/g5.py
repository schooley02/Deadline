import sys, concurrent.futures as cf
sys.path.insert(0,'/home/claude/work/pl'); sys.path.insert(0,'.'); import pl
import numpy as np
from PIL import Image
from scipy import ndimage
import wall3d
T=wall3d.TIRE; OUT=wall3d.OUT
def tire(im,cx,cy,w=13,h=6):
    px=im.load(); W,H=im.size
    def P(x,y,c):
        if 0<=x<W and 0<=y<H: px[x,y]=c if len(c)==4 else c+(255,)
    for yy in range(-h,h+4):
        for xx in range(-w,w+1):
            e=(xx/(w/2+.5))**2+(yy/(h/2+.5))**2; e2=(xx/(w/2+.5))**2+((yy-3)/(h/2+.5))**2
            if e<=1:
                hole=(xx/(w/4))**2+((yy)/(h/4+.3))**2<=1
                P(cx+xx,cy+yy, OUT if e>0.78 else (T['dk'] if hole else (T['top'] if yy<0 else T['lit'])))
            elif e2<=1 and yy>0:
                P(cx+xx,cy+yy, OUT if e2>0.8 else (T['mid'] if (xx+yy)%3 else T['dk']))
def guide(L=54,courses=5,post_h=35,near=3,far=2):
    g=wall3d.shear(wall3d.build(L=L,courses=courses,post_h=post_h,tires=(0,0)))
    pad=(6,2,16,12)                                   # left, top, right, bottom
    c=Image.new('RGBA',(g.size[0]+pad[0]+pad[2],g.size[1]+pad[1]+pad[3]),(0,0,0,0)); c.alpha_composite(g,(pad[0],pad[1]))
    a=np.array(g)[...,3]>0; cols=np.nonzero(a.any(0))[0]
    xl=cols.min(); yl=np.nonzero(a[:,xl+4])[0].max(); xr=cols.max(); yr=np.nonzero(a[:,xr-2])[0].max()
    for k in range(far): tire(c,pad[0]+xr+8-(k%2),pad[1]+yr-2-k*5,w=11,h=5)
    for k in range(near): tire(c,pad[0]+xl+11+(k%2),pad[1]+yl+6-k*5)       # in FRONT of the near end (lower right of it), running off the screen
    return c,(pad[0]+xl,pad[1]+yl)
CW,CH,GB=224,136,105                               # GB = the game canvas bottom, in context rows (the church art ends there)
church=Image.open('/mnt/user-data/uploads/Deadline/Assets/Base/base_100.png').convert('RGBA').crop((60,96,184,200))
def context(g,near,gx=120,cut=6):
    c=Image.new('RGBA',(CW,CH),(0,0,0,0)); c.alpha_composite(church,(0,GB-104))
    gy=GB+cut-near[1]; gl=Image.new('RGBA',(CW,CH),(0,0,0,0)); gl.alpha_composite(g,(gx-near[0],gy))
    m=np.array(gl)[...,3]>20; m=ndimage.binary_fill_holes(ndimage.binary_dilation(m,iterations=4))
    c.alpha_composite(gl); return c,Image.fromarray((m*255).astype('uint8'))
DESC=("A survivor barricade that belongs to the church beside it, drawn in exactly the same pixel art style as the church and its sandbags: "
      "the same low, wide, flat burlap sandbags in the same muted olive-tan colours with the same dark navy outline and the same flat cel "
      "shading (no smooth gradients, no plump round bags), the same weathered grey-brown wood. The barricade runs diagonally from the lower "
      "left (near) up to the upper right (far) and has real depth: tall rough squared timber posts stand on the ground in front; one or two "
      "weathered planks are nailed across every pair of posts; behind the wood is a tall stack of sandbags five rows high, too high to climb, "
      "whose top row shows its upper surface; two strands of thin dark rusty barbed wire sag between the tall post tops, above the bags. "
      "A stack of three old black car tires lies flat on the ground in front of the near (lower left) end, and a stack of two at the far "
      "(upper right) end; every tire is a clear thick black rubber ring lying flat with a visible round hole and tread on its side. Posts and "
      "planks cast small shadows on the bags. Dim moonlight, muted, weathered, gritty, realistic, not cartoonish. No white, no highlights "
      "brighter than the sandbags, no ground, no grass, no people, no glow.")
if __name__=='__main__':
    g,near=guide(); ctx,mask=context(g,near); g.save('guide5.png'); ctx.save('ctx5.png'); mask.save('ctx5_mask.png'); print(g.size,near)
    def run(seed):
        outs,j=pl.inpaint(ctx,mask,DESC,seed); outs[0].save(f'gen/inp5_s{seed}.png'); return seed,len(outs),j.get('status')
    with cf.ThreadPoolExecutor(4) as ex:
        for f in [ex.submit(run,s) for s in (321,322,323,324)]:
            try: print(f.result(),flush=True)
            except Exception as x: print('ERR',repr(x)[:300],flush=True)

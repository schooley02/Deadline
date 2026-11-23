import sys, random, math, concurrent.futures as cf
sys.path.insert(0,'/home/claude/work/pl'); sys.path.insert(0,'.'); import pl
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
import g5, ext, wall3d
OUT=(8,8,18,255)
solid=Image.open('solid_v6.png').convert('RGBA'); SW,SH=solid.size
A0,B=ext.baseline_mid(solid,0.45,0.8)
def yb(x): return A0+B*x
CW,CH,GB=320,136,105
SX,SY=114,42                                   # where the solid tier sits in the context (= its place in the game)
church=Image.open('/mnt/user-data/uploads/Deadline/Assets/Base/base_100.png').convert('RGBA').crop((60,96,184,200))
def context(layer,mask):
    """layer / mask: SWxSH-or-larger art in the solid tier's own coordinates (may extend: pass offset image)"""
    c=Image.new('RGBA',(CW,CH),(0,0,0,0)); c.alpha_composite(church,(0,GB-104)); c.alpha_composite(solid,(222,24))   # the approved tier as a style reference
    c.alpha_composite(layer,(SX-PAD,SY-PAD)); m=np.zeros((CH,CW),bool); mm=np.array(mask)>0
    m[SY-PAD:SY-PAD+mm.shape[0],SX-PAD:SX-PAD+mm.shape[1]]=mm[:CH-(SY-PAD),:CW-(SX-PAD)]
    return c,m
PAD=12
def canvas(): return Image.new('RGBA',(SW+2*PAD,SH+2*PAD),(0,0,0,0))
STYLE=(" Drawn in exactly the same pixel art style as the barricade shown at the right and the church at the left: the same low, wide, flat "
       "olive-tan burlap sandbags, the same weathered grey-brown timber, the same dark navy outline and flat cel shading, muted and gritty. "
       "No white, no ground, no grass, no people, no glow except a lantern flame.")
# ---------- reinforced = the solid tier + metal sheets, stakes, a lantern
def reinforced():
    c=canvas(); c.alpha_composite(solid,(PAD,PAD)); d=ImageDraw.Draw(c); px=c.load(); add=Image.new('L',c.size,0); da=ImageDraw.Draw(add)
    R=[(70,44,34,255),(104,66,46,255),(134,92,64,255)]
    for (x0,x1) in ((28,45),(53,71)):
        for x in range(x0,x1+1):
            for rel in range(3,31):
                y=int(round(yb(x)))-rel; col=OUT if (x in (x0,x1) or rel in (3,30)) else R[(x//2)%2+ (1 if rel>24 else 0)]
                px[x+PAD,y+PAD]=col; add.putpixel((x+PAD,y+PAD),255)
    for x in (24,38,50,64,76):
        for k in range(11):
            xx=x+k; yy=int(round(yb(x)))+3-k
            for t in (0,1):
                px[xx+PAD,yy+t+PAD]=(134,118,90,255) if t==0 else (93,84,70,255); add.putpixel((xx+PAD,yy+t+PAD),255)
            px[xx+PAD,yy-1+PAD]=OUT; px[xx+PAD,yy+2+PAD]=OUT; add.putpixel((xx+PAD,yy-1+PAD),255); add.putpixel((xx+PAD,yy+2+PAD),255)
    lx,ly=48,3
    for yy in range(ly,ly+8):
        for xx in range(lx-2,lx+3):
            col=OUT if (xx in (lx-2,lx+2) or yy in (ly,ly+7)) else (244,184,105,255)
            px[xx+PAD,yy+PAD]=col; add.putpixel((xx+PAD,yy+PAD),255)
    m=ndimage.binary_dilation(np.array(add)>0,iterations=2)
    desc=("The same barricade, now REINFORCED: rusty corrugated sheet-metal panels are bolted across the front of the timber and sandbags, "
          "with visible vertical ridges, rust streaks and bolt heads; sharpened wooden stakes are driven into the ground along the front of "
          "the wall, angled outward and upward toward the attackers, with pale cut points; a small lit oil lantern with a warm orange flame "
          "sits on top of the middle post. The rest of the wall is unchanged."+STYLE)
    return c,m,desc
# ---------- none = the wall has fallen: wreckage along the same line
def fallen(seed=5):
    r=random.Random(seed); c=canvas(); px=c.load()
    def P(x,y,col):
        x+=PAD; y+=PAD
        if 0<=x<c.size[0] and 0<=y<c.size[1]: px[x,y]=col
    BAG=[(134,118,90,255),(114,104,83,255),(93,84,70,255)]; WOOD=[(114,104,83,255),(93,84,70,255),(70,63,50,255)]
    for x0 in (20,31,40,52,60,70):                     # spilled sandbags lying on the ground
        y0=int(round(yb(x0)))-r.randint(0,3); w=r.randint(9,13)
        for xx in range(w):
            for yy in range(5):
                if (xx in (0,w-1) and yy in (0,4)): continue
                P(x0+xx,y0-yy+int(round(B*xx)), OUT if (yy in (0,4) or xx in (0,w-1)) else BAG[min(2,yy-1)])
    for x0,h,lean in ((26,9,1),(47,13,-1),(66,7,2)):   # snapped post stumps
        for k in range(h):
            xx=x0+int(round(lean*k/5)); y=int(round(yb(x0)))+2-k
            P(xx-1,y,OUT); P(xx,y,WOOD[1]); P(xx+1,y,WOOD[0]); P(xx+2,y,WOOD[1]); P(xx+3,y,OUT)
        P(x0+int(round(lean*h/5)),int(round(yb(x0)))+2-h,(150,136,112,255)); P(x0+1+int(round(lean*h/5)),int(round(yb(x0)))+1-h,(150,136,112,255))
    for x0,L_,dy in ((30,22,3),(50,18,-2)):             # planks lying across the wreck
        for k in range(L_):
            y=int(round(yb(x0)+B*k))-6+int(round(dy*k/L_))
            P(x0+k,y-1,OUT); P(x0+k,y,WOOD[0]); P(x0+k,y+1,WOOD[1]); P(x0+k,y+2,WOOD[2]); P(x0+k,y+3,OUT)
    t=Image.new('RGBA',c.size,(0,0,0,0)); g5.tire(t,PAD+9,PAD+int(yb(9))+1); g5.tire(t,PAD+12,PAD+int(yb(9))-3)   # two tires, toppled
    g5.tire(t,PAD+80,PAD+int(yb(80))-1,w=11,h=5); c.alpha_composite(t)
    m=ndimage.binary_dilation(np.array(c)[...,3]>0,iterations=4); m=ndimage.binary_fill_holes(m)
    desc=("The barricade has FALLEN: only low wreckage is left, lying along the same diagonal line from the lower left up to the upper right. "
          "Two or three snapped timber post stumps with splintered tops still stand, short and leaning; broken planks lie on the ground "
          "across the debris; torn, slumped burlap sandbags are scattered in a single low row, some burst open; a couple of old black car "
          "tires have toppled at the ends, one lying flat, one leaning. Nothing stands higher than knee height except the tallest stump."+STYLE)
    return c,m,desc
JOBS={'reinforced':reinforced,'none':fallen}
if __name__=='__main__':
    todo=[]
    for name,fn in JOBS.items():
        layer,m,desc=fn(); ctx,mk=context(layer,Image.fromarray((m*255).astype('uint8')))
        ctx.save(f'ctx_{name}.png'); Image.fromarray((mk*255).astype('uint8')).save(f'ctx_{name}_mask.png'); layer.save(f'guide_{name}.png')
        for s in (0,1): todo.append((name,ctx,mk,desc,400+s+(10 if name=='none' else 0)))
    def run(t):
        name,ctx,mk,desc,seed=t; outs,j=pl.inpaint(ctx,Image.fromarray((mk*255).astype('uint8')),desc,seed); outs[0].save(f'gen/{name}_s{seed}.png'); return name,seed,j.get('status')
    with cf.ThreadPoolExecutor(4) as ex:
        for f in [ex.submit(run,t) for t in todo]:
            try: print(f.result(),flush=True)
            except Exception as x: print('ERR',repr(x)[:300],flush=True)

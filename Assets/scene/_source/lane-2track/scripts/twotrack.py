import sys, random, math, concurrent.futures as cf
sys.path.insert(0,'/home/claude/audit')
from PIL import Image, ImageDraw
import pl
random.seed(31)
W,H=256,128; SKY=(40,47,65,255)
im=Image.new('RGBA',(W,H),SKY); d=ImageDraw.Draw(im); px=im.load()
def sp(b,j): return tuple(max(0,min(255,c+random.randint(-j,j))) for c in b)+(255,)
def grass(): return sp(random.choice([(34,58,66),(40,66,70),(30,50,60)]),4)
def grav():
    r=random.random(); return sp((92,90,98),6) if r>.25 else (sp((116,114,120),6) if r>.08 else sp((64,62,70),5))
for x in range(0,W,9):
    for k in range(3): d.line([x+k*2+random.randint(0,4),58,x+k*2+random.randint(-2,3),51+random.randint(0,4)],fill=(34,58,66,255))
wave=lambda x,ph,a: int(round(a*math.sin(2*math.pi*(x/256.0)*2+ph)+ (a/2)*math.sin(2*math.pi*(x/256.0)*5+ph*2)))
for x in range(W):
    t1a=70+wave(x,0.3,2); t1b=91+wave(x,1.1,2); t2a=104+wave(x,2.0,2); t2b=125+wave(x,2.9,1)
    for y in range(56,H):
        if y<60 and random.random()<.45: continue
        if t1a<=y<t1b or t2a<=y<t2b:
            px[x,y]=grav() if random.random()>.06 else grass()
        else:
            px[x,y]=grass() if random.random()>.10 else grav()
for _ in range(26):
    x=random.randint(0,W); y=random.choice([random.randint(92,102),random.randint(62,69)])
    for k in range(2): d.line([x+k*2,y,x+k*2+random.randint(-1,1),y-random.randint(2,5)],fill=(46,74,74,255))
im.save('pl_out/guide_twotrack_256x128.png')
DESC=("Repaint this rough layout as finished, detailed pixel art, keeping the exact layout, proportions and flat side-on framing: plain dark night "
      "sky above, then rough roadside grass, then an old two-track gravel country lane running perfectly level from the left edge to the right edge, "
      "seen from a slightly raised angle: two wide worn tyre tracks of pale crushed gravel and packed dirt with loose stones, a strip of rough grass "
      "and weeds growing between the two tracks, ragged uneven grassy edges, gravel scattered into the grass, a few bare dirt patches. Rough grass "
      "along the very bottom edge. Moonlit night, muted desaturated colours, dark, gritty, weathered, realistic, not cartoonish. No people, no "
      "vehicles, no buildings, no fence, no flowers, no headstones, no puddles, no glow, no rim light.")
def run(seed):
    outs=pl.edit_text(im,DESC,seed=seed)
    for i,o in enumerate(outs): o.save(f'pl_out/twotrack_s{seed}_{i}.png')
    return seed,len(outs)
b0=pl.balance()
with cf.ThreadPoolExecutor(2) as ex:
    for f in [ex.submit(run,s) for s in (701,702)]:
        try: print(f.result(),flush=True)
        except Exception as e: print('ERR',e,flush=True)
print('used',b0-pl.balance(),'left',pl.balance())

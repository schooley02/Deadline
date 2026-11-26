import sys; sys.path.insert(0, "/home/claude/lib")
import json
from collections import deque
from PIL import Image, ImageDraw
import pl
from lab_fx import lum
SKY=(20,24,38,255)
v=Image.open('lab_t1_base_v1.png').convert('RGBA'); V=v.load()
fung=lambda p: p[3]>0 and p[1]>=p[0] and p[1]>p[2]+6 and lum(p)>95
flat=Image.new('RGBA',v.size,SKY); flat.alpha_composite(v); flat=flat.convert('RGB')
img=lambda im: {'image': {'type':'base64','base64':pl.b64(im),'format':'png'}, 'size': {'width':im.width,'height':im.height}}
def mask(rects,keep_fungus=False):
    m=Image.new('L',(160,160),0); d=ImageDraw.Draw(m)
    for r in rects: d.rectangle(r,fill=255)
    if keep_fungus:
        M=m.load()
        for x in range(160):
            for y in range(160):
                if M[x,y] and any(0<=x+dx<160 and 0<=y+dy<160 and fung(V[x+dx,y+dy]) for dx in (-1,0,1) for dy in (-1,0,1)): M[x,y]=0
    return m
STYLE=" Night scene, no lights on anywhere. Realistic gritty pixel art, muted colours, soft dark outlines."
JOBS={
 'cage': (mask([(3,107,44,150)],True),
   "A rusted steel cage standing against the dark shaded end wall of an abandoned shipping container, broken open from the inside: a shallow box of vertical bars seen at a three-quarter angle, its front receding to the left. "
   "Several bars in the middle are bent outward and snapped off leaving a ragged gap, one loose bar lies on the ground, the narrow barred door panel on the right hangs open and crooked on one hinge. The cage is empty and pitch dark inside. "
   "Flaking orange-brown rust on the bars and rails."+STYLE),
 'roof': (mask([(72,12,107,40),(135,6,158,72)]),
   "The roof edge of an abandoned steel shipping-container laboratory, overgrown by an infection fungus: clusters of pale grey-green bulbous puffball caps of different sizes, joined by thin pale green tendrils, "
   "spreading along the roofline, creeping up around the base of a rusty exhaust stack, and hanging down over the upper right corner post and the right end of a dark sign board. "
   "Dark night sky behind the roof. The grey ribbed steel wall, the black pipes and the yellow-black hazard-striped corner post stay visible between the growths."+STYLE),
 'low': (mask([(70,138,121,158),(84,70,150,94)]),
   "The front of an abandoned steel shipping-container laboratory overgrown by an infection fungus: clusters of pale grey-green bulbous puffball caps of different sizes with thin pale green tendrils, "
   "growing along the concrete footing below a large dark cracked glass window, and spreading across the rusty ribbed steel wall and the black horizontal pipes above the window. "
   "Small caps at the edges, bigger ones in the middle of each cluster, complete rounded shapes, nothing cut off. Below the footing plain dark night sky."+STYLE),
 'door': (mask([(122,98,148,149)]),
   "The steel entrance door of an abandoned shipping-container laboratory, seen straight on: a rusty grey door in a brown steel frame, hanging half open inward so a tall pitch-black gap shows on its left side, "
   "its small window smashed and dark, rust streaks and dents on the door, a few small pale grey-green fungus caps growing at the threshold on the concrete step."+STYLE),
}
ids={}
for name,(m,desc) in JOBS.items():
    m.save(f'mask_t1_{name}.png')
    for seed in ((201,) if name!='cage' else (201,202)):
        s,j=pl.call('POST','/inpaint-v3',{'description':desc,'inpainting_image':img(flat),'mask_image':img(m.convert('RGB')),'seed':seed,'no_background':False,'crop_to_mask':True})
        print(name,seed,s,{a:b for a,b in j.items() if a!='usage'},flush=True)
        if 'background_job_id' in j: ids[(name,seed)]=j['background_job_id']
near=lambda p: abs(p[0]-20)+abs(p[1]-24)+abs(p[2]-38)<22
out=[]
for (name,seed),job in ids.items():
    m=JOBS[name][0]; M=m.load()
    j=pl.wait(job); ims=pl.images_from(j); print(name,seed,j.get('status'),len(ims),flush=True)
    for i,im in enumerate(ims):
        im=im.convert('RGBA')
        if im.size!=(160,160): print('  size',im.size); continue
        o=v.copy(); o.paste(im,(0,0),m); Q=o.load()
        q=deque((x,y) for x in range(160) for y in range(160) if Q[x,y][3]==0); seen=set(q)
        while q:
            x,y=q.popleft()
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                a,b=x+dx,y+dy
                if 0<=a<160 and 0<=b<160 and (a,b) not in seen and M[a,b] and near(Q[a,b]): seen.add((a,b)); Q[a,b]=(0,0,0,0); q.append((a,b))
        fn=f't1_{name}_{seed}_{i}.png'; o.save(fn); out.append(fn)
s,b=pl.call('GET','/balance'); print('balance',b.get('subscription',{}).get('generations'))
Z=5; sh=Image.new('RGBA',(len(out)*(160*Z+6)+6,160*Z+12),(20,24,38,255))
for q,fn in enumerate(out): sh.alpha_composite(Image.open(fn).resize((160*Z,160*Z),Image.NEAREST),(6+q*(160*Z+6),6))
sh.save('t1_options.png'); print(sh.size,out)

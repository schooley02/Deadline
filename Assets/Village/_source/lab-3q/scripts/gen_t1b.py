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
 'roofR': (mask([(135,20,158,72)]),
   "The upper right corner of an abandoned steel shipping-container laboratory at night, overgrown by an infection fungus: a thick column of pale grey-green bulbous puffball caps of different sizes, each a complete round shape with a soft dark outline, "
   "joined by thin pale green tendrils, climbing the yellow-black hazard-striped corner post, hanging over the right end of a dark sign board, and piling up a little higher than the flat roof edge. "
   "Above the roof edge and to the right of the building there is nothing but plain dark navy night sky: no post, no wall, no white."+STYLE),
 'foot': (mask([(70,128,121,156)]),
   "The bottom of a large dark cracked glass window in the front of an abandoned steel shipping-container laboratory, its grey concrete footing below it, and plain dark navy night sky under the footing. "
   "An infection fungus grows along the footing: a low clump of pale grey-green bulbous puffball caps of different sizes, complete rounded shapes with soft dark outlines, overlapping the bottom edge of the glass, "
   "big caps in the middle, small ones at the ends, a few thin pale green tendrils creeping up the glass. Nothing hangs below the footing."+STYLE),
}
ids={}
for name,(m,desc) in JOBS.items():
    m.save(f'mask_t1_{name}.png')
    for seed in (211,):
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
sh.save('t1_options2.png'); print(sh.size,out)

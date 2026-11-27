import sys, concurrent.futures as cf
import numpy as np
from PIL import Image
import base as B, strip as S, plroad as P
# road, tighter frame: 320x32, the road is 13 of the 32 rows
f=B.img('scene/village-field.png'); c=Image.new('RGBA',(320,32),(26,24,48,255)); c.alpha_composite(f.crop((0,6,320,38)))
o,_,_=S.code_strip(); c.alpha_composite(Image.fromarray(o,'RGBA'),(0,6)); c.save('pl/road2_canvas_320x32.png')
DESC2=("Add fine pixel-art detail to this image WITHOUT changing its layout: a narrow strip of old worn dark asphalt road runs straight across the middle of a dark grassy field at night, "
       "seen from far away at a low side angle. Keep the road exactly the same thickness and in the same place, keep the grass above and below it exactly as it is. "
       "On the road only: keep the faded broken dashed dull-yellow centre line, add a few thin cracks, tar-sealed crack lines, one or two patched repairs in slightly different dark greys, "
       "a crumbling edge with a little loose gravel. Moonlit night, muted desaturated blue-grey asphalt matching the existing colours, dark, gritty, weathered, realistic, calm flat tones, no speckle noise. "
       "No vehicles, no people, no glow, no bright paint, no outline.")
# signs on one 64x64 canvas, flat dark grass behind them
g=Image.new('RGBA',(64,64),(21,38,34,255))
stop=S.STOP.resize((S.STOP.width//2,S.STOP.height//2),Image.NEAREST); li=S.light(True); li=li.resize((li.width//2,li.height//2),Image.NEAREST)
g.alpha_composite(stop,(8,60-stop.height)); g.alpha_composite(li,(30,60-li.height)); g.save('pl/signs_canvas_64x64.png')
DESC3=("Repaint as finished detailed pixel art, keeping the exact size, position and silhouette of both objects on the plain dark green background: on the left a small weathered, rusty "
       "octagonal red STOP sign with a worn white border on a thin grey metal post; on the right an old traffic light: a tall grey steel pole with a horizontal mast arm reaching left and a "
       "dark three-lamp signal head hanging from the arm's end, its top red lamp dimly lit. Moonlit night, light from the right, muted desaturated colours, gritty, weathered, realistic, not cartoonish. "
       "Keep the background plain. No glow halo, no extra objects.")
jobs=[('road2',s,c.convert('RGB'),DESC2,320,32) for s in (5201,5202)]+[('signs',s,g.convert('RGB'),DESC3,64,64) for s in (5301,5302)]
b0=P.balance()
def go(j):
    name,seed,im,desc,w,h=j; s,lr=P.run(seed,im,desc,w,h); return name,seed,lr
with cf.ThreadPoolExecutor(4) as ex:
    for name,seed,lr in ex.map(go,jobs):
        if isinstance(lr,str): print(name,seed,lr[:300]); continue
        ims=P.images(lr); print(name,seed,[i.size for i in ims])
        for k,i in enumerate(ims): i.save(f'pl/{name}_{seed}_{k}.png')
print('used',b0-P.balance(),'left',P.balance())

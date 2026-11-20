import pl, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from concurrent.futures import ThreadPoolExecutor
base=Image.open("base_025_v4_wip.png").convert("RGBA")
A=np.array(base)[...,3]>0
edge=np.array(Image.fromarray((~A*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)))>0  # sky + 2px into the building
def poly(pts):
    m=Image.new("L",base.size,0); ImageDraw.Draw(m).polygon(pts,255); return np.array(m)>0
# far-side roof: three tongues rising from behind the ridge
far = poly([(6,46),(24,46),(20,22),(12,20)]) | poly([(30,48),(50,48),(46,12),(36,10)]) | poly([(58,50),(78,51),(72,26),(64,28)])
# far-side wall near the flag: fire from behind the right wall and gable
far |= poly([(144,44),(156,30),(176,26),(184,34),(184,152),(166,152),(164,100),(152,84)])
flag = poly([(164,54),(184,52),(184,82),(164,82)]) & A
farm = far & edge & ~flag
Image.fromarray((farm*255).astype(np.uint8)).save("fire25_far_mask.png")
door = poly([(117,150),(146,150),(152,182),(114,182)])
Image.fromarray((door*255).astype(np.uint8)).save("fire25_door_mask.png")
D1=("a white wooden church burning at night seen from the front corner, tall realistic orange and yellow flames rising from behind "
    "the roof ridge and from behind the far wall, fire from the far side of the church licking up into the dark sky, gritty muted pixel art")
D2=("the threshold of an open church doorway on fire at night, flames burning on the charred floorboards inside the doorway and "
    "licking out over the sill onto the top wooden step, a fallen broken lantern, embers, warm firelight, gritty muted pixel art")
jobs=[("far",farm,D1,s) for s in (41,52,63)]+[("door",door,D2,s) for s in (7,19,28)]
def go(j):
    n,m,d,s=j; mk=Image.fromarray((m*255).astype(np.uint8)).convert("RGB")
    pl.inpaint(base,mk,d,seed=s,no_bg=True)[0].save(f"f25{n}_s{s}.png")
with ThreadPoolExecutor(6) as ex: list(ex.map(go,jobs))
bg=lambda im:(lambda b:(b.alpha_composite(im),b)[1])(Image.new("RGBA",im.size,(24,26,40,255)))
sheet=Image.new("RGBA",(184*3+8,200),(0,0,0,255))
for k,s in enumerate((41,52,63)): sheet.paste(bg(Image.open(f"f25far_s{s}.png").convert("RGBA")),(k*188,0))
sheet.resize((sheet.width*3,600),Image.NEAREST).save("/tmp/far.png")
sheet=Image.new("RGBA",(3*44,40),(0,0,0,255))
for k,s in enumerate((7,19,28)): sheet.paste(bg(Image.open(f"f25door_s{s}.png").convert("RGBA")).crop((110,146,154,186)),(k*44,0))
sheet.resize((sheet.width*6,240),Image.NEAREST).save("/tmp/door.png")

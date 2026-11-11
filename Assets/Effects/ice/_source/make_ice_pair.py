exec(open('boost.py').read().split("A=Image.open")[0])
from PIL import Image
A=Image.open('/mnt/user-data/uploads/11273b5a-image.png').convert('RGBA')
C=Image.open('/mnt/user-data/uploads/41a90930-image.png').convert('RGBA')
M=Image.open('/mnt/user-data/uploads/622799f6-image.png').convert('RGBA')
top,bot=A.getbbox()[1],A.getbbox()[3]; h=bot-top; drop=h-74
band=list(range(int(h*0.25),int(h*0.85))); step=len(band)/drop
kill={top+band[int(i*step)] for i in range(drop)}   # same as trim_rows on the intact crop
BASE=120  # intact base bottom row (feet line 118 + 2); leaves room for the melt puddle
def place(im):
    keep=[y for y in range(128) if y not in kill]
    t=Image.new('RGBA',(128,len(keep)))
    for ny,y in enumerate(keep): t.paste(im.crop((0,y,128,y+1)),(0,ny))
    newbot=bot-len([k for k in kill if k<bot])   # intact bottom row index after removal
    can=Image.new('RGBA',(128,128),(0,0,0,0)); can.alpha_composite(t,(0,BASE-newbot)); return can
outs={n:place(im) for n,im in (('intact',A),('cracked',C),('melting',M))}
for n,c in outs.items(): c.save(f'ice_hold_{n}_v2.png'); print(n,c.getbbox())
exec('def tile128'+open('boost.py').read().split('def tile128')[1].split('g=Image')[0].replace('fy-118','fy-118'))
g=Image.new('RGBA',(8*T,2*T),BG)
for k,z in enumerate(zs): g.paste(tile128(outs['intact'],z),(k*T,0)); g.paste(tile128(outs['melting'],z),(k*T,T))
g.save('melt_all8.png'); g.resize((g.width*2,g.height*2),Image.NEAREST).crop((0,0,4*T*2,2*T*2)).save('melt_2x.png')

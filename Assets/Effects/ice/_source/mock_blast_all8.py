import json, colorsys
from PIL import Image
exec('def tint'+open('mock2.py').read().split('def tint')[1].split('BG=')[0])
src=Image.open('/mnt/user-data/uploads/af4de11d-image.png').convert('RGBA')
cands=[]
for i,(x,y) in enumerate([(0,0),(128,0),(0,128),(128,128)]):
    c=src.crop((x,y,x+128,y+128)); bb=c.getbbox(); print(i+1,bb,'w',bb[2]-bb[0],'h',bb[3]-bb[1]); cands.append(c.crop(bb)); c.save(f'blast_cand{i+1}.png')
B='/mnt/user-data/uploads/Deadline/Assets/Zombies/anim/'
cats=['career','creativity','financial','health','lifestyle','other','relationships','spirituality']
zs=[]
for z in cats:
    j=json.load(open(B+z+'.json')); im=Image.open(B+z+'.png').convert('RGBA'); s=j['frameWidth']; r=j['animations']['attack']['row']
    zs.append((z,tint(im.crop((0,r*s,s,r*s+s))),s,j['feetY']))
T=172; BG=(28,30,40,255)
def tile(ov,z):
    name,fr,s,fy=z
    cv=Image.new('RGBA',(s,s),BG); cv.alpha_composite(fr)
    cv.alpha_composite(ov,(s//2-ov.width//2, fy+4-ov.height))
    out=Image.new('RGBA',(T,T),BG)
    if s>=T: out.alpha_composite(cv.crop(((s-T)//2,(s-T)//2,(s-T)//2+T,(s-T)//2+T)))
    else: out.alpha_composite(cv,((T-s)//2,(T-s)//2))
    return out
g=Image.new('RGBA',(8*T,4*T),BG)
for i,c in enumerate(cands):
    for k,z in enumerate(zs): g.paste(tile(c,z),(k*T,i*T))
g.save('blast_all8.png')

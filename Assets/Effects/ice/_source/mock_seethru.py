import json, colorsys
from PIL import Image, ImageDraw
src=Image.open('/mnt/user-data/uploads/05a3e8fc-image.png').convert('RGBA')
cands=[]
for i,(x,y) in enumerate([(0,0),(128,0),(0,128),(128,128)]):
    c=src.crop((x,y,x+128,y+128)); bb=c.getbbox(); print(i,bb,'w',bb[2]-bb[0],'h',bb[3]-bb[1])
    cands.append(c.crop(bb))
def lum(p): return 0.299*p[0]+0.587*p[1]+0.114*p[2]
def seethru(im, fill_a, mid_a):
    out=im.copy(); px=out.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=px[x,y]
            if a==0: continue
            L=lum((r,g,b))
            if L<70: continue                 # outline stays solid
            if L>=215: continue               # highlights / sparkles stay solid
            if L>=180: px[x,y]=(r,g,b,fill_a) # main pale fill
            else: px[x,y]=(r,g,b,mid_a)       # shaded faces a bit denser
    return out
modes=[('solid',None),('half',(130,175)),('glass',(85,130))]
def tint(fr):
    out=fr.copy(); po=out.load()
    for y in range(fr.height):
        for x in range(fr.width):
            r,g,b,a=po[x,y]
            if a==0: continue
            h,l,s=colorsys.rgb_to_hls(r/255,g/255,b/255)
            h=(h+160/360)%1; s*=0.45; l=min(1,l*1.12)
            rr,gg,bb=colorsys.hls_to_rgb(h,l,s); po[x,y]=(int(rr*255),int(gg*255),int(bb*255),a)
    return out
BG=(28,30,40,255); T=172
zs=[]
for z in ['career','spirituality','other']:
    j=json.load(open(f'/mnt/user-data/uploads/Deadline/Assets/Zombies/anim/{z}.json'))
    zs.append((z,tint(Image.open(f'{z}_atk0.png')),j['frameWidth'],j['feetY']))
def tile(ov,z):
    name,fr,s,fy=z
    cv=Image.new('RGBA',(s,s),BG); cv.alpha_composite(fr)
    ox=s//2-ov.width//2; oy=fy+4-ov.height
    cv.alpha_composite(ov,(ox,oy))
    out=Image.new('RGBA',(T,T),BG); out.alpha_composite(cv.crop(((s-T)//2,(s-T)//2,(s-T)//2+T,(s-T)//2+T)) if s>=T else cv,(0,0) if s>=T else ((T-s)//2,(T-s)//2))
    return out
# one sheet per candidate: rows = solid/half/glass, cols = 3 zombies
for i,c in enumerate(cands):
    g=Image.new('RGBA',(3*T,3*T+0),BG)
    for r,(mn,al) in enumerate(modes):
        ov=c if al is None else seethru(c,*al)
        for k,z in enumerate(zs): g.paste(tile(ov,z),(k*T,r*T))
    g.resize((g.width*2,g.height*2),Image.NEAREST).save(f'cand{i+1}_modes.png')
# overview: all 4 candidates, solid vs half, on career + nun
g=Image.new('RGBA',(4*T,4*T),BG)
for i,c in enumerate(cands):
    h=seethru(c,130,175)
    g.paste(tile(c,zs[0]),(i*T,0)); g.paste(tile(h,zs[0]),(i*T,T))
    g.paste(tile(c,zs[1]),(i*T,2*T)); g.paste(tile(h,zs[1]),(i*T,3*T))
d=ImageDraw.Draw(g)
g.resize((g.width*2,g.height*2),Image.NEAREST).save('overview_solid_vs_seethru.png')
for i,c in enumerate(cands): c.save(f'pl_cand{i+1}.png')

exec(open('mock2.py').read().split('# one sheet per candidate')[0])
def trim_rows(im, target_h):
    # delete whole rows evenly from the middle band (25%-85% of height): no resampling of pixels within a row
    h=im.height; drop=h-target_h
    band=list(range(int(h*0.25),int(h*0.85)))
    step=len(band)/drop
    kill=set(band[int(i*step)] for i in range(drop))
    keep=[y for y in range(h) if y not in kill]
    out=Image.new('RGBA',(im.width,len(keep)))
    for ny,y in enumerate(keep): out.paste(im.crop((0,y,im.width,y+1)),(0,ny))
    return out
GL=(75,115)
rows=[]
for i,c in enumerate(cands):
    t=trim_rows(c,64); t.save(f'pl_cand{i+1}_h64.png')
    rows.append([c, seethru(c,*GL), t, seethru(t,*GL)])
for zi in (0,1,2):
    g=Image.new('RGBA',(4*T,4*T),BG)
    for i,r in enumerate(rows):
        for k,ov in enumerate(r): g.paste(tile(ov,zs[zi]),(k*T,i*T))
    g.resize((g.width*2,g.height*2),Image.NEAREST).save(f'grid_{zs[zi][0]}.png')

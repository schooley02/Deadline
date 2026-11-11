exec(open('burstpl.py').read().split("st=Image.new")[0])
sheet=Image.new('RGBA',(128*n,128),(0,0,0,0))
for i,f in enumerate(trim): sheet.alpha_composite(f,(i*128,0))
sheet.save('ice_burst.png')
fs=Image.open('ice_form.png'); form=[fs.crop((i*128,0,i*128+128,128)) for i in range(8)]
iced=Image.open('ice_hold_intact_v2.png'); melt=Image.open('ice_hold_melting_v2.png')
def fade(im,a):
    o=im.copy(); al=o.split()[3].point(lambda v:int(v*a)); o.putalpha(al); return o
seq=[(f,60,0) for f in form]+[(iced,900,0)]+[(melt,150,(i%2)) for i in range(8)]+[(f,70,0) for f in trim[1:]]+[(fade(trim[-1],a),120,0) for a in (.66,.33)]+[(None,600,0)]
Z=[zs[0],zs[7],zs[2]]
def frame(ov,z,dx):
    name,fr,s,fy=z
    cv=Image.new('RGBA',(s,s),BG); cv.alpha_composite(fr)
    if ov: cv.alpha_composite(ov,(s//2-64+dx,fy-118))
    return cv.crop(((s-150)//2,(s-150)//2,(s-150)//2+150,(s-150)//2+150))
gif=[];dur=[]
for ov,d,dx in seq:
    g=Image.new('RGBA',(450,150),BG)
    for k,z in enumerate(Z): g.alpha_composite(frame(ov,z,dx),(k*150,0))
    gif.append(g.resize((900,300),Image.NEAREST).convert('P',palette=Image.ADAPTIVE)); dur.append(d)
gif[0].save('ice_full_sequence.gif',save_all=True,append_images=gif[1:],duration=dur,loop=0)

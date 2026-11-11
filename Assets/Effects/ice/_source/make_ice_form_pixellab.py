exec(open('pair.py').read().split("outs={")[0])
exec(open('boost.py').read().split("def lum")[0].split("A=Image.open")[0])
S=Image.open('/mnt/user-data/uploads/2f5892ff-image.png').convert('RGBA')
raw=[S.crop((i*128,0,i*128+128,128)) for i in range(8)]
pl=[place(f) for f in raw[:7]]+[Image.open('ice_hold_intact_v2.png')]   # last frame = the exact iced overlay
code=[]
sh=Image.open('ice_form_sheet_v2.png')
code=[sh.crop((i*128,0,i*128+128,128)) for i in range(8)]
for i,f in enumerate(pl): print(i+1,f.getbbox())
# side-by-side gif: left = PixelLab, right = code, on career + spirituality
def frame(ov,z):
    name,fr,s,fy=z
    cv=Image.new('RGBA',(s,s),BG); cv.alpha_composite(fr); cv.alpha_composite(ov,(s//2-64,fy-118))
    return cv.crop(((s-150)//2,(s-150)//2,(s-150)//2+150,(s-150)//2+150))
Z=[zs[0],zs[7]]
gif=[]
for i in list(range(8))+[7]*6:
    g=Image.new('RGBA',(150*4,150),BG)
    for k,z in enumerate(Z):
        g.alpha_composite(frame(pl[i],z),(k*150,0)); g.alpha_composite(frame(code[i],z),((k+2)*150,0))
    gif.append(g.resize((1200,300),Image.NEAREST).convert('P',palette=Image.ADAPTIVE))
gif[0].save('form_compare.gif',save_all=True,append_images=gif[1:],duration=[60]*8+[200]*6,loop=0)
sheet=Image.new('RGBA',(128*8,128),(0,0,0,0))
for i,f in enumerate(pl): sheet.alpha_composite(f,(i*128,0))
sheet.save('ice_form.png')
st=Image.new('RGBA',(128*8,128),BG); st.alpha_composite(sheet); st.resize((2048,256),Image.NEAREST).save('ice_form_strip.png')

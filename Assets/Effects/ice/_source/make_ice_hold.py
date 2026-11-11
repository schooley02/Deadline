exec(open('mock4.py').read().replace("g.save('blast_all8.png')","").replace("/mnt/user-data/uploads/af4de11d-image.png","/mnt/user-data/uploads/af4de11d-image.png"))
exec('def trim_rows'+open('mock3.py').read().split('def trim_rows')[1].split('GL=')[0])
src=Image.open('/mnt/user-data/uploads/11273b5a-image.png').convert('RGBA'); c=src.crop(src.getbbox())
out={}
for h in (None,80,74):
    ov=c if h is None else trim_rows(c,h)
    can=Image.new('RGBA',(128,128),(0,0,0,0)); can.alpha_composite(ov,(64-ov.width//2,122-ov.height)); out[h]=(ov,can)
out[74][1].save('ice_hold_clean.png'); out[80][1].save('ice_hold_clean_h80.png')
g=Image.new('RGBA',(8*T,3*T),BG)
for r,h in enumerate((None,80,74)):
    for k,z in enumerate(zs): g.paste(tile(out[h][0],z),(k*T,r*T))
g.save('clean_all8.png')
# zoomed check of final
bg=Image.new('RGBA',(128,128),(40,44,56,255)); bg.alpha_composite(out[74][1]); bg.resize((512,512),Image.NEAREST).save('clean_final_4x.png')

exec(open('mock4.py').read().replace("g.save('blast_all8.png')",""))
exec('def trim_rows'+open('mock3.py').read().split('def trim_rows')[1].split('GL=')[0])
A=Image.open('/mnt/user-data/uploads/11273b5a-image.png').convert('RGBA'); Bc=Image.open('/mnt/user-data/uploads/41a90930-image.png').convert('RGBA')
bb=A.getbbox()  # crop BOTH with the intact bbox so the same rows are removed
a=trim_rows(A.crop(bb),74); b=trim_rows(Bc.crop(bb),74)
for n,ov in (('intact',a),('cracked',b)):
    can=Image.new('RGBA',(128,128),(0,0,0,0)); can.alpha_composite(ov,(64-ov.width//2,122-ov.height)); can.save(f'ice_hold_{n}_final.png')
pick=[zs[i] for i in (0,2,5,7)]
g=Image.new('RGBA',(4*T,2*T),BG)
for k,z in enumerate(pick): g.paste(tile(a,z),(k*T,0)); g.paste(tile(b,z),(k*T,T))
g.save('crack_1x.png'); g.resize((g.width*2,g.height*2),Image.NEAREST).save('crack_2x.png')

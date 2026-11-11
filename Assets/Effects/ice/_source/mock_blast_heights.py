exec(open('mock4.py').read().replace("g.save('blast_all8.png')",""))
exec('def trim_rows'+open('mock3.py').read().split('def trim_rows')[1].split('GL=')[0])
sel=[0,1]; hs=[None,74,62]; pick=[zs[i] for i in (0,2,5,7)]
g=Image.new('RGBA',(len(pick)*T,len(sel)*len(hs)*T),BG); r=0
for ci in sel:
    for h in hs:
        ov=cands[ci] if h is None else trim_rows(cands[ci],h)
        if h: ov.save(f'blast_cand{ci+1}_h{h}.png')
        for k,z in enumerate(pick): g.paste(tile(ov,z),(k*T,r*T))
        r+=1
g.resize((g.width*2,g.height*2),Image.NEAREST).save('blast_heights.png')

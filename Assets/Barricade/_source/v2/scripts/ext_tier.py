import sys; sys.path.insert(0,'.')
import numpy as np
from PIL import Image
import tiers as T, clean
PAD=T.PAD
def get(name,seed,guide_p=None):
    ctx=np.array(Image.open(f'ctx_{name}.png').convert('RGBA')); mk=np.array(Image.open(f'ctx_{name}_mask.png'))>0
    r=np.array(Image.open(f'gen/{name}_s{seed}.png').convert('RGBA'))
    full=ctx.copy(); full[mk]=r[mk]
    x0,y0=T.SX-PAD,T.SY-PAD; w,h=T.SW+2*PAD,T.SH+2*PAD
    a=full[y0:y0+h,x0:x0+w].copy(); m=mk[y0:y0+h,x0:x0+w]
    # outside the mask only this tier's own layer counts (not the church)
    lay=np.array(Image.open(guide_p).convert('RGBA')) if guide_p else None
    if lay is not None: a[~m]=lay[:h,:w][~m]
    else: a[~m]=0
    white=(a[...,:3].min(-1)>=232)&m; a[white]=0; a[a[...,3]<20]=0
    im,wf,gf=clean.clean(Image.fromarray(a,'RGBA')); return im
if __name__=='__main__':
    out={}
    out['reinforced']=get('reinforced',400,'guide_reinforced.png'); out['reinforced_b']=get('reinforced',401,'guide_reinforced.png')
    out['none']=get('none',410); out['none_b']=get('none',411)
    import partial
    partial.layer.save('guide_partial.png')
    for s in (420,421,422): out[f'partial_{s}']=get('partial',s,None)
    # partial: outside the mask = the kept tire stacks
    keep=np.array(partial.c)
    for s in (420,421,422):
        a=np.array(out[f'partial_{s}']); k=keep[...,3]>0; m=np.array(Image.open('ctx_partial_mask.png'))[T.SY-PAD:T.SY-PAD+a.shape[0],T.SX-PAD:T.SX-PAD+a.shape[1]]>0
        a[k&~m]=keep[k&~m]; out[f'partial_{s}']=Image.fromarray(a,'RGBA')
    sol=T.canvas(); sol.alpha_composite(T.solid,(PAD,PAD)); out['solid']=sol
    for k,v in out.items(): v.save(f'tier_{k}.png')
    names=['none','none_b','partial_420','partial_421','partial_422','solid','reinforced','reinforced_b']
    w,h=out['solid'].size
    sh=Image.new('RGBA',(4*(w+4)+4,2*(h+4)+4),(40,44,70,255))
    for i,n in enumerate(names): sh.alpha_composite(out[n],(4+(i%4)*(w+4),4+(i//4)*(h+4)))
    sh.resize((sh.size[0]*4,sh.size[1]*4),Image.NEAREST).save('tiers_4x.png')

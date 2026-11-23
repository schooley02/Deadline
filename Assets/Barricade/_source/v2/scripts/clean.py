import sys; sys.path.insert(0,'.')
import numpy as np
from PIL import Image
from scipy import ndimage
def clean(im, erase=()):
    a=np.array(im.convert('RGBA')).astype(int)
    for (x0,y0,x1,y1) in erase: a[y0:y1,x0:x1]=0
    op=a[...,3]>20
    mx=a[...,:3].max(-1); mn=a[...,:3].min(-1)
    white=op&(mn>=170)&((mx-mn)<40)                      # white / pale grey specks (wire glints, leftovers of the white background)
    a[white,:3]=(124,88,62)                              # dull rust instead
    # pale grey fringe pixels on the silhouette edge (background leftovers): drop them
    edge=op&~ndimage.binary_erosion(op)
    grey=edge&(mn>=120)&((mx-mn)<22)
    a[grey]=0
    op=a[...,3]>20; lab,n=ndimage.label(op)
    for i,s in enumerate(ndimage.sum(op,lab,range(1,n+1)),1):
        if s<14: a[lab==i]=0
    a[a[...,3]<=20]=0; a[a[...,3]>20,3]=255
    return Image.fromarray(a.astype('uint8'),'RGBA'), int(white.sum()), int(grey.sum())
if __name__=='__main__':
    im=Image.open(sys.argv[1]); out,w,g=clean(im); out.save(sys.argv[2]); print('white px fixed',w,'grey fringe removed',g,out.size)
    bg=Image.new('RGBA',(out.size[0]*2+12,out.size[1]+8),(40,44,70,255)); bg.alpha_composite(im.convert('RGBA'),(4,4)); bg.alpha_composite(out,(out.size[0]+8,4))
    bg.resize((bg.size[0]*7,bg.size[1]*7),Image.NEAREST).save('clean_7x.png')

exec(open('pair.py').read().split("outs={")[0])
exec(open('boost.py').read().split("def lum")[0].split("A=Image.open")[0])
S=Image.open('/mnt/user-data/uploads/890caa84-image.png').convert('RGBA'); print(S.size)
n=S.width//128; raw=[S.crop((i*128,0,i*128+128,128)) for i in range(n)]
for i,f in enumerate(raw): print(i+1,f.getbbox())
trim=[Image.open('ice_hold_melting_v2.png')]+[place(f) for f in raw[1:]]
# untrimmed alt: only shift so base row matches (full-height shapes)
def shift(im):
    can=Image.new('RGBA',(128,128),(0,0,0,0)); can.alpha_composite(im,(0,BASE-bot)); return can
untr=[Image.open('ice_hold_melting_v2.png')]+[shift(f) for f in raw[1:]]
st=Image.new('RGBA',(128*n,256),BG)
for i in range(n): st.alpha_composite(trim[i],(i*128,0)); st.alpha_composite(untr[i],(i*128,128))
st.resize((st.width*2,st.height*2),Image.NEAREST).save('burst_compare_strip.png')
import pickle; pickle.dump(([f.tobytes() for f in trim],[f.tobytes() for f in untr]),open('burst.pkl','wb'))

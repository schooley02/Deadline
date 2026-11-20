import pl, numpy as np
from PIL import Image, ImageDraw
from concurrent.futures import ThreadPoolExecutor
base=Image.open("base025_noflame_st.png").convert("RGBA")
W,H=base.size
m=Image.new("L",(W,H),0); d=ImageDraw.Draw(m)
d.rectangle((0,0,W,174),255)                                   # the whole building above the foundation
d.polygon([(110,174),(150,174),(150,182),(110,182)],255)       # the threshold blends into the pile
st=Image.new("L",(W,H),0)
ImageDraw.Draw(st).polygon([(30,116),(38,116),(41,123),(42,134),(44,148),(44,162),(47,164),(47,191),
                            (21,191),(21,164),(25,162),(26,148),(27,134),(28,123)],255)
m=Image.fromarray(np.where(np.array(st)>0,0,np.array(m)).astype(np.uint8))
m.save("d0r_mask.png")
desc=("the site of a wooden church completely burned to the ground at night, a low heap of charred black timber, burnt beams, collapsed "
      "roof shingles and ash piled on the stone foundation, a large bronze church bell resting on top of the rubble pile, a weathered stone "
      "prayer statue still standing intact beside the ruins, thin wisps of ember glow in the ash, no flames, no walls standing, "
      "dark night sky, gritty muted realistic pixel art")
def go(s): pl.inpaint(base,m.convert("RGB"),desc,seed=s,no_bg=True)[0].save(f"d0r_s{s}.png")
with ThreadPoolExecutor(4) as ex: list(ex.map(go,[505,606,707,808]))
sheet=Image.new("RGBA",(4*188,H),(0,0,0,255))
for k,s in enumerate([505,606,707,808]):
    r=Image.open(f"d0r_s{s}.png").convert("RGBA"); b=Image.new("RGBA",r.size,(24,26,40,255)); b.alpha_composite(r); sheet.paste(b,(k*188,0))
sheet.resize((sheet.width*2,H*2),Image.NEAREST).save("/tmp/d0r.png")

import sys, pl
from PIL import Image, ImageDraw
from concurrent.futures import ThreadPoolExecutor
base = Image.open("base025_noflame.png").convert("RGBA")
W,H = base.size
m = Image.new("L",(W,H),0); d = ImageDraw.Draw(m)
def plume(x0,x1,ytop_open,ybot_open,up):   # opening rect plus a tapered plume rising from its top
    d.rectangle((x0,ytop_open,x1,ybot_open),255)
    cx=(x0+x1)/2; hw=(x1-x0)/2
    d.polygon([(x0-1,ytop_open+2),(x1+1,ytop_open+2),(cx+hw*.5,ytop_open-up),(cx-hw*.5,ytop_open-up)],255)
d.ellipse((46,68,82,86),255); d.polygon([(48,76),(80,76),(72,42),(56,42)],255)    # roof hole
for (x,y) in [(6,114),(54,135),(106,121),(154,117)]:  plume(x-7,x+7,y-6,y+6,16)     # upper window holes
for (x,y) in [(8,137),(63,147),(107,131),(151,125)]:  d.ellipse((x-5,y-4,x+5,y+4),255)
plume(119,141,104,166,14)                                                         # doorway, little on the ground
d.polygon([(96,40),(118,40),(114,24),(100,24)],255)                               # belfry under the bell
d.polygon([(164,58),(184,54),(184,80),(166,78)],255)                              # flag
d.ellipse((138,176,156,192),255)                                                  # cross on the steps
m.save("fire25_mask.png")
desc=("a white wooden country church burning at night, fire inside the church, realistic orange and yellow flames "
      "licking out from inside through the roof hole, the broken windows, the open doorway and under the bell, "
      "flames curling up the scorched wall, the flag on fire, gritty muted pixel art")
def go(seed):
    r = pl.inpaint(base, m.convert("RGB"), desc, seed=seed, no_bg=True)
    r[0].save(f"fire25_s{seed}.png"); return seed
with ThreadPoolExecutor(3) as ex: print(list(ex.map(go,[11,23,37])))

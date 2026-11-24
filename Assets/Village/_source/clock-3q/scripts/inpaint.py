import json, sys, os, base64, io
from PIL import Image, ImageDraw
from gen import api
def enc(im):
    buf=io.BytesIO(); im.save(buf,'PNG'); return {"image":{"type":"base64","base64":base64.b64encode(buf.getvalue()).decode(),"format":"png"},"size":{"width":im.width,"height":im.height}}
def submit(name, src, rects, desc, seed, nobg=True):
    im=Image.open(src).convert('RGBA'); m=Image.new('RGB',im.size,(0,0,0)); d=ImageDraw.Draw(m)
    for r in rects: d.rectangle(r,fill=(255,255,255))
    m.save(f't4/mask_{name}.png')
    r=api('POST','/inpaint-v3',{"description":desc,"inpainting_image":enc(im),"mask_image":enc(m.convert('RGBA')),"seed":seed,"no_background":nobg})
    print(name,json.dumps(r)[:200])
    jobs=json.load(open('jobs.json')) if os.path.exists('jobs.json') else {}
    if 'background_job_id' in r: jobs[name]=r['background_job_id']
    json.dump(jobs,open('jobs.json','w'))
STYLE=" Dark gritty realistic pixel art for an adult zombie survival game, muted weathered colours, moonlit night, crisp pixels, dark outlines, matching the stone clock tower around it."
if __name__=='__main__':
    src='t4/clock_t4_code.png'
    for s in (71,72):
        submit(f'T4snip_{s}',src,[(53,35,64,50)],"An open arched belfry window in an off-white clock tower, the louvres removed, dark interior; inside it a survivor sniper in an olive drab helmet and jacket, head and shoulders visible, aiming a long scoped rifle that rests on the window sill and pokes out to the left. Keep the arched window frame exactly the same shape."+STYLE,s)
        submit(f'T4foot_{s}',src,[(14,162,26,207),(89,162,101,207),(38,198,56,207),(80,198,92,207)],"Two old black cast-iron street lamps with lit warm glass lantern heads on slim posts, one on each side of the clock tower; low walls of stacked burlap sandbags on both sides of the stone entrance steps."+STYLE,s)

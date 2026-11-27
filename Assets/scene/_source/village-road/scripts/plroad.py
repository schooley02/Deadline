import sys, json, base64, io, time, urllib.request, concurrent.futures as cf
import numpy as np
from PIL import Image
import base as B, strip as S
KEY=open('/home/claude/.pixellab_key').read().strip(); API='https://api.pixellab.ai/v2'
def call(path, body=None):
    req=urllib.request.Request(API+path, data=json.dumps(body).encode() if body is not None else None, method='POST' if body is not None else 'GET', headers={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, {'error': e.read().decode()[:500]}
def b64(im):
    b=io.BytesIO(); im.save(b,'PNG'); return {'type':'base64','base64':base64.b64encode(b.getvalue()).decode(),'format':'png'}
def balance(): return call('/balance')[1]['subscription']['generations']
CW,CH,FROW=384,64,12
def canvas():
    f=B.img('scene/village-field.png'); c=Image.new('RGBA',(CW,CH),(26,24,48,255)); c.alpha_composite(f.crop((0,0,CW,CH)))
    o,_,_=S.code_strip(); st=Image.fromarray(o,'RGBA')
    for x in range(0,CW,S.SW): c.alpha_composite(st.crop((0,0,min(S.SW,CW-x),S.SH)),(x,FROW))
    return c
DESC=("Repaint this rough layout as finished, detailed pixel art, keeping the exact layout, shapes, proportions and framing: a dark grassy field at night, "
      "and running straight across it from the left edge to the right edge an old two-lane country road of worn, weathered dark asphalt seen from a low side angle, "
      "the road into a small abandoned American town. On the asphalt: a faded, worn, broken dashed centre line in dull muted yellow, a few long thin cracks, "
      "tar-sealed crack lines, a patched repair or two in a slightly different dark grey, faint worn tyre tracks, a little loose gravel along the near edge, small weeds "
      "at the crumbling edges where the grass grows over the pavement. Keep the grass, the dark bushes along the top and everything outside the road unchanged. "
      "Moonlit night, muted desaturated blue-grey asphalt, dark, gritty, weathered, realistic, not cartoonish, calm flat tones without speckle noise. "
      "No vehicles, no people, no buildings, no bright paint, no puddles, no glow, no rim light, no outline around the road.")
def run(seed, im, desc=DESC, w=CW, h=CH, nobg=False):
    st,r=call('/edit-images-v2',{'method':'edit_with_text','edit_images':[{'image':b64(im),'width':w,'height':h}],'image_size':{'width':w,'height':h},'description':desc,'seed':seed,'no_background':nobg})
    if st not in (200,202): return seed,'ERR %s %s'%(st,r)
    job=r['background_job_id']
    for _ in range(90):
        time.sleep(6); st,j=call('/background-jobs/'+job)
        if j.get('status')=='completed': return seed,j['last_response']
        if j.get('status')=='failed': return seed,'FAILED %s'%json.dumps(j)[:400]
    return seed,'TIMEOUT'
def images(lr):
    out=[]
    def walk(v):
        if isinstance(v,dict):
            if 'base64' in v and isinstance(v['base64'],str): out.append(Image.open(io.BytesIO(base64.b64decode(v['base64'].split(',')[-1]))).convert('RGBA'))
            else:
                for x in v.values(): walk(x)
        elif isinstance(v,list):
            for x in v: walk(x)
    walk(lr); return out
if __name__=='__main__':
    im=canvas(); im.save('pl/road_canvas_384x64.png')
    b0=balance(); seeds=[int(s) for s in sys.argv[1:]]
    with cf.ThreadPoolExecutor(len(seeds)) as ex:
        for seed,lr in ex.map(lambda s: run(s, im.convert('RGB')), seeds):
            if isinstance(lr,str): print(seed,lr); continue
            ims=images(lr); print(seed,'images',len(ims),[i.size for i in ims], list(lr.keys())[:6])
            for k,i in enumerate(ims): i.save(f'pl/road_{seed}_{k}.png')
    print('used',b0-balance(),'left',balance())

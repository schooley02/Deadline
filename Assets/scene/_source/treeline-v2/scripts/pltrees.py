import sys, json, base64, io, time, urllib.request, concurrent.futures as cf
from PIL import Image
KEY=open('/home/claude/.pixellab_key').read().strip(); API='https://api.pixellab.ai/v2'
def call(path, body=None):
    req=urllib.request.Request(API+path, data=json.dumps(body).encode() if body is not None else None, method='POST' if body is not None else 'GET', headers={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, {'error': e.read().decode()[:600]}
def b64(im):
    b=io.BytesIO(); im.save(b,'PNG'); return {'type':'base64','base64':base64.b64encode(b.getvalue()).decode(),'format':'png'}
def balance(): return call('/balance')[1]['subscription']['generations']
DESC=("Repaint this rough layout as finished, detailed pixel art, keeping the exact layout, tree positions, sizes, heights and framing: a dense forest edge at night "
 "seen from a distance, three depth rows. Mostly tall full spruce and pine trees with layered drooping boughs and uneven, natural silhouettes, a few ragged pines with missing boughs, "
 "two or three dead snags, a few leafy trees mixed in, stands of trees with small openings between them where the hazier rows behind show through, and low undergrowth "
 "(shrubs, saplings, brush) along the foot of each row. Moonlight from the upper right: only a soft, muted edge light on the right side of the boughs. "
 "Farther rows lighter, bluer and flatter; the front row darkest. Muted, desaturated night blues and blue-greys, dark, gritty, realistic, not cartoonish: "
 "no puffy round trees, no perfectly even triangles, no bright colours, no glow, no outlines, calm flat tones without speckle noise. Transparent sky above the trees.")
def run(seed, im, w, h):
    st,r=call('/edit-images-v2',{'method':'edit_with_text','edit_images':[{'image':b64(im),'width':w,'height':h}],'image_size':{'width':w,'height':h},'description':DESC,'seed':seed,'no_background':True})
    if st not in (200,202): return seed,'ERR %s %s'%(st,r)
    job=r['background_job_id']
    for _ in range(100):
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
    src=Image.open('out/treeline_B2.png').convert('RGBA'); w,h=src.size
    bg=Image.new('RGBA',(w,h),(66,62,100,255)); bg.alpha_composite(src); bg.save('pl/b2_canvas.png')
    b0=balance(); print('balance',b0); seeds=[int(s) for s in sys.argv[1:]]
    with cf.ThreadPoolExecutor(len(seeds)) as ex:
        for seed,lr in ex.map(lambda s: run(s, bg.convert('RGB'), w, h), seeds):
            if isinstance(lr,str): print(seed,lr); continue
            ims=images(lr); print(seed,'images',len(ims),[i.size for i in ims])
            for k,i in enumerate(ims): i.save(f'pl/b2_{seed}_{k}.png')
    print('used',b0-balance(),'left',balance())

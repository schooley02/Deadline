import base64, json, subprocess, sys, io, os, time
from PIL import Image
KEY=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'.key')).read().strip()
def enc(im):
    if isinstance(im,str): im=Image.open(im)
    im=im.convert('RGBA'); buf=io.BytesIO(); im.save(buf,'PNG')
    return {"image":{"type":"base64","base64":base64.b64encode(buf.getvalue()).decode(),"format":"png"},"width":im.width,"height":im.height}
def enc2(im):
    e=enc(im); return {"image":e["image"],"size":{"width":e["width"],"height":e["height"]}}
def api(method,path,body=None):
    cmd=['curl','-sS','-m','90','-X',method,'-H','Authorization: Bearer '+KEY,'-H','Content-Type: application/json','https://api.pixellab.ai/v2'+path]
    if body is not None:
        fn=f'/tmp/pl_body_{os.getpid()}.json'; open(fn,'w').write(json.dumps(body)); cmd+=['--data-binary','@'+fn]
    r=subprocess.run(cmd,capture_output=True,text=True)
    try: return json.loads(r.stdout)
    except Exception: return {'raw':r.stdout[:500],'err':r.stderr[:300]}
def jobs(): return json.load(open('jobs.json')) if os.path.exists('jobs.json') else {}
def add(name,r):
    print(name,json.dumps(r)[:240]); j=jobs()
    if 'background_job_id' in r: j[name]=r['background_job_id']; json.dump(j,open('jobs.json','w'))
def edit(name,src,desc,seed):
    im=Image.open(src); add(name,api('POST','/edit-images-v2',{"method":"edit_with_text","edit_images":[enc(im)],"image_size":{"width":im.width,"height":im.height},"description":desc,"seed":seed,"no_background":True}))
def poll(n=40):
    for _ in range(n):
        pend=0
        for name,jid in jobs().items():
            if any(f.startswith(name+'_') for f in os.listdir('out')): continue
            r=api('GET','/background-jobs/'+jid); st=r.get('status')
            if st=='completed':
                lr=r.get('last_response') or {}; imgs=lr.get('images') or ([lr['image']] if 'image' in lr else [])
                for i,im in enumerate(imgs):
                    b=im.get('base64') if isinstance(im,dict) else im
                    if b.startswith('data:'): b=b.split(',',1)[1]
                    open(f'out/{name}_{i}.png','wb').write(base64.b64decode(b))
                print(name,'saved',len(imgs),r.get('usage'))
                if not imgs: open(f'out/{name}_EMPTY.txt','w').write(json.dumps(lr)[:2000])
            elif st=='failed': print(name,'FAILED',json.dumps(r)[:300]); open(f'out/{name}_FAILED.txt','w').write(json.dumps(r)[:2000])
            else: pend+=1
        if not pend: break
        time.sleep(8)
    print('pending',pend, api('GET','/balance').get('subscription',{}).get('generations'))
STYLE=" Dark gritty realistic pixel art for an adult zombie survival game, muted weathered colours, moonlit night with light from the front-right, crisp pixels, dark outlines, no stray white pixels, nothing cartoonish, transparent background."
if __name__=='__main__':
    if sys.argv[1]=='poll': poll(int(sys.argv[2]) if len(sys.argv)>2 else 40)

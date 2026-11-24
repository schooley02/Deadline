import json, base64, os, time, sys
from gen import api
jobs=json.load(open('jobs.json')); done=set(os.listdir('out'))
for _ in range(int(sys.argv[1]) if len(sys.argv)>1 else 30):
    pend=0
    for spec,jid in jobs.items():
        name=spec.replace(':','_')
        if any(f.startswith(name) for f in os.listdir('out')): continue
        r=api('GET','/background-jobs/'+jid); st=r.get('status')
        if st=='completed':
            lr=r.get('last_response') or {}
            imgs=lr.get('images') or ([lr['image']] if 'image' in lr else [])
            if not imgs: print(spec,'completed, keys',list(lr.keys()), json.dumps(lr)[:300])
            for i,im in enumerate(imgs):
                b=im.get('base64') if isinstance(im,dict) else im
                if b.startswith('data:'): b=b.split(',',1)[1]
                open(f'out/{name}_{i}.png','wb').write(base64.b64decode(b))
            print(spec,'saved',len(imgs),'usage',r.get('usage'))
            if not imgs: open(f'out/{name}_EMPTY.txt','w').write(json.dumps(lr)[:2000])
        elif st=='failed': print(spec,'FAILED',json.dumps(r)[:400]); open(f'out/{name}_FAILED.txt','w').write(json.dumps(r)[:2000])
        else: pend+=1
    if not pend: break
    time.sleep(8)
print('pending',pend); print(api('GET','/balance'))

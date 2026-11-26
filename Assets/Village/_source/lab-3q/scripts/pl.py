import base64, io, json, os, sys, time, urllib.request
from PIL import Image
KEY = open('/home/claude/.secrets/pixellab_key').read().strip()
API = 'https://api.pixellab.ai/v2'
def b64(im):
    buf = io.BytesIO(); im.save(buf, 'PNG'); return base64.b64encode(buf.getvalue()).decode()
def ref(im, usage=None):
    r = {'image': {'type': 'base64', 'base64': b64(im), 'format': 'png'}, 'size': {'width': im.width, 'height': im.height}}
    if usage: r['usage_description'] = usage
    return r
def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=(json.dumps(body).encode() if body is not None else None),
                                 headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, {'error': e.read().decode()[:800]}
def wait(job, every=8, limit=540):
    t = time.time()
    while time.time() - t < limit:
        s, j = call('GET', '/background-jobs/' + job)
        if j.get('status') in ('completed', 'failed', 'error'): return j
        time.sleep(every)
    return {'status': 'timeout'}
def images_from(j):
    out = []
    def walk(o):
        if isinstance(o, dict):
            if 'base64' in o and isinstance(o['base64'], str) and len(o['base64']) > 200:
                s = o['base64'].split(',')[-1]; out.append(Image.open(io.BytesIO(base64.b64decode(s))).convert('RGBA'))
            else:
                for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(j); return out

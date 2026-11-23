import base64, io, json, os, time, urllib.request, urllib.error
from PIL import Image
KEY = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.key')).read().strip()
API = 'https://api.pixellab.ai/v2'
def _req(method, path, body=None, timeout=120):
    r = urllib.request.Request(API + path, method=method, data=(json.dumps(body).encode() if body is not None else None),
                               headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(r, timeout=timeout) as f: return json.loads(f.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError('%s %s -> %s %s' % (method, path, e.code, e.read()[:600].decode('utf8', 'replace')))
def b64(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return {'type': 'base64', 'base64': base64.b64encode(b.getvalue()).decode(), 'format': 'png'}
def balance(): return _req('GET', '/balance')
def wait(job, every=5, limit=600):
    t = time.time()
    while time.time() - t < limit:
        j = _req('GET', '/background-jobs/' + job)
        if j.get('status') in ('completed', 'failed', 'error', 'cancelled'): return j
        time.sleep(every)
    raise RuntimeError('timeout ' + job)
def images(j):
    out = []
    def walk(o):
        if isinstance(o, dict):
            if isinstance(o.get('base64'), str) and len(o['base64']) > 200:
                s = o['base64']; s = s.split(',', 1)[1] if s.startswith('data:') else s
                out.append(Image.open(io.BytesIO(base64.b64decode(s))).convert('RGBA'))
            else:
                for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(j); return out
def inpaint(im, mask, desc, seed=None):
    w, h = im.size
    body = {'description': desc, 'inpainting_image': {'image': b64(im.convert('RGBA')), 'size': {'width': w, 'height': h}},
            'mask_image': {'image': b64(mask.convert('RGB')), 'size': {'width': w, 'height': h}}, 'no_background': False, 'crop_to_mask': True}
    if seed is not None: body['seed'] = seed
    r = _req('POST', '/inpaint-v3', body); j = wait(r['background_job_id'])
    return images(j), j
def edit_text(im, desc, seed=None):
    w, h = im.size
    body = {'method': 'edit_with_text', 'edit_images': [{'image': b64(im.convert('RGBA')), 'width': w, 'height': h}], 'image_size': {'width': w, 'height': h}, 'description': desc}
    if seed is not None: body['seed'] = seed
    r = _req('POST', '/edit-images-v2', body); j = wait(r['background_job_id'])
    return images(j), j
def gen(desc, w, h, style=None, refs=None, seed=None, style_options=None, no_background=True):
    body = {'description': desc, 'image_size': {'width': w, 'height': h}, 'no_background': no_background}
    if style is not None: body['style_image'] = {'image': b64(style.convert('RGBA')), 'size': {'width': style.size[0], 'height': style.size[1]}}
    if style_options: body['style_options'] = style_options
    if refs: body['reference_images'] = [{'image': b64(im.convert('RGBA')), 'size': {'width': im.size[0], 'height': im.size[1]}, 'usage_description': u} for im, u in refs]
    if seed is not None: body['seed'] = seed
    r = _req('POST', '/generate-image-v2', body); j = wait(r['background_job_id'])
    return images(j), j

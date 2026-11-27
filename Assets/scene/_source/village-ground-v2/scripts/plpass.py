"""PixelLab pass on the worn-asphalt pad: builds the 384x64 art-resolution canvas (grass + pad, no buildings) and runs edit-images-v2."""
import sys, json, base64, io, time, subprocess, urllib.request, concurrent.futures as cf
import numpy as np
from PIL import Image
import ground as G, ground2 as G2
KEY = open('/home/claude/.secrets/pixellab_key').read().strip()
API = 'https://api.pixellab.ai/v2'
def call(path, body=None, method=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None, method=method or ('POST' if body is not None else 'GET'),
                                 headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, {'error': e.read().decode()[:500]}
def b64(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return {'type': 'base64', 'base64': base64.b64encode(b.getvalue()).decode(), 'format': 'png'}
def balance(): return call('/balance')[1]['subscription']['generations']

W, H, BW = 1366, 480, 368
X0, CW, CH = 235, 384, 64
HZ = (H - 76) // 2; Y0 = HZ - 50
def canvas():
    slots = json.loads(subprocess.check_output(['node', 'slots.js', G.CODE, json.dumps({"W": W, "H": H, "baseW": BW})]))
    field = Image.fromarray(G.field('rises'), 'RGBA')
    art = Image.new('RGBA', (W // 2, H // 2), (26, 24, 48, 255))
    G.tile(art, field, HZ - 45, 0)
    p, mask = G2.pad(slots, W, H, 'asphalt')
    grass = art.copy()
    art.alpha_composite(p.resize((W // 2, H // 2), Image.NEAREST))
    box = (X0, Y0, X0 + CW, Y0 + CH)
    return art.crop(box), grass.crop(box), mask[Y0:Y0 + CH, X0:X0 + CW], slots

DESC = ("Repaint this rough layout as finished, detailed pixel art, keeping the exact layout, shapes, proportions and framing: a dark grassy "
        "field at night with two gentle rises, and in the middle of it a large old paved lot of worn, weathered dark asphalt seen from a low "
        "angle, the ground of a small abandoned American town. On the asphalt: a few long thin cracks, tar-sealed crack lines, patched repairs in "
        "slightly different dark greys, faint worn tyre marks, a little loose gravel, small weeds growing through the cracks, and crumbling "
        "broken edges where the grass grows over the pavement. Keep the grass, the dark bushes along the top and everything outside the paved "
        "lot unchanged. Moonlit night, muted desaturated blue-grey asphalt, dark, gritty, weathered, realistic, not cartoonish, calm flat tones "
        "without speckle noise. No vehicles, no people, no buildings, no painted road markings, no puddles, no glow, no rim light, no outline "
        "around the lot.")
def run(seed, im):
    st, r = call('/edit-images-v2', {'method': 'edit_with_text', 'edit_images': [{'image': b64(im), 'width': CW, 'height': CH}],
                                    'image_size': {'width': CW, 'height': CH}, 'description': DESC, 'seed': seed, 'no_background': False})
    if st not in (200, 202): return seed, 'ERR %s %s' % (st, r)
    job = r['background_job_id']
    for _ in range(90):
        time.sleep(6); st, j = call('/background-jobs/' + job)
        if j.get('status') == 'completed':
            json.dump({k: (v if k != 'last_response' else '...') for k, v in j.items()}, open(f'pl/job_{seed}.json', 'w'))
            lr = j['last_response']; open(f'pl/resp_{seed}.json', 'w').write(json.dumps(lr)[:200000])
            return seed, lr
        if j.get('status') == 'failed': return seed, 'FAILED %s' % json.dumps(j)[:400]
    return seed, 'TIMEOUT'
if __name__ == '__main__':
    im, grass, mask, slots = canvas()
    im.save('pl/pad_canvas_384x64.png'); grass.save('pl/grass_canvas_384x64.png'); np.save('pl/mask.npy', mask)
    if len(sys.argv) > 1 and sys.argv[1] == 'run':
        b0 = balance(); seeds = [int(s) for s in sys.argv[2:]]
        with cf.ThreadPoolExecutor(len(seeds)) as ex:
            for seed, lr in ex.map(lambda s: run(s, im.convert('RGB')), seeds):
                if isinstance(lr, str): print(seed, lr); continue
                print(seed, 'keys', list(lr.keys())[:8])
        print('used', b0 - balance(), 'left', balance())

import base64, io, json, os, time, urllib.request
from PIL import Image

API = "https://api.pixellab.ai/v2"
KEY = open(os.path.expanduser("~/.pl/key")).read().strip()


def b64(im):
    buf = io.BytesIO(); im.save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


def img_obj(im):
    return {"type": "base64", "base64": b64(im), "format": "png"}


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method,
                               headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=300) as f:
            return json.loads(f.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{e.code} {e.read()[:800]}")


def balance():
    return req("GET", "/balance")["subscription"]["generations"]


def _find_images(o, out):
    if isinstance(o, dict):
        if "base64" in o and isinstance(o["base64"], str) and len(o["base64"]) > 100:
            out.append(o["base64"])
        for v in o.values():
            _find_images(v, out)
    elif isinstance(o, list):
        for v in o:
            _find_images(v, out)
    return out


def decode(s):
    if s.startswith("data:"):
        s = s.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(s))).convert("RGBA")


def wait(job):
    jid = job.get("background_job_id") or job.get("id")
    print("JOB", jid, flush=True)
    for _ in range(120):
        time.sleep(6)
        j = req("GET", f"/background-jobs/{jid}")
        st = j.get("status")
        if st == "completed":
            return [decode(s) for s in _find_images(j.get("last_response", j), [])]
        if st in ("failed", "error", "cancelled"):
            raise RuntimeError(json.dumps(j)[:800])
    raise RuntimeError("timeout")


def edit_text(im, desc, seed=None, no_bg=False):
    w, h = im.size
    body = {"method": "edit_with_text", "edit_images": [{"image": img_obj(im), "width": w, "height": h}],
            "image_size": {"width": w, "height": h}, "description": desc, "no_background": no_bg}
    if seed is not None: body["seed"] = seed
    return wait(req("POST", "/edit-images-v2", body))


def inpaint(im, mask, desc, seed=None, no_bg=False):
    w, h = im.size
    body = {"description": desc,
            "inpainting_image": {"image": img_obj(im), "size": {"width": w, "height": h}},
            "mask_image": {"image": img_obj(mask), "size": {"width": w, "height": h}},
            "no_background": no_bg}
    if seed is not None: body["seed"] = seed
    return wait(req("POST", "/inpaint-v3", body))


def resize(im, desc, tw, th, seed=None, color_image=True):
    w, h = im.size
    body = {"description": desc, "reference_image": img_obj(im),
            "reference_image_size": {"width": w, "height": h},
            "target_size": {"width": tw, "height": th}, "no_background": True}
    if color_image: body["color_image"] = img_obj(im)
    if seed is not None: body["seed"] = seed
    r = req("POST", "/resize", body)
    if "background_job_id" in r:
        return wait(r)
    return [decode(s) for s in _find_images(r, [])]


def save_gallery(im, name, desc, target="gallery:new"):
    body = {"target": target, "image": img_obj(im)}
    if target == "gallery:new":
        body["name"] = name; body["description"] = desc
    return req("POST", "/save-to-asset", body)

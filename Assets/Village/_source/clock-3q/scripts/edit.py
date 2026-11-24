import json, sys, os, base64, io
from PIL import Image
from gen import api
def enc(path):
    im=Image.open(path).convert('RGBA'); buf=io.BytesIO(); im.save(buf,'PNG')
    return {"image":{"type":"base64","base64":base64.b64encode(buf.getvalue()).decode(),"format":"png"},"width":im.width,"height":im.height}
KEEP="Keep the exact same tower: same silhouette, proportions, three-quarter camera, clock faces, lit amber stair windows, off-white louvered belfry, slate pyramid roof, door and pediment, all in the same positions. Change only the wall material. "
END=" Kept-up civic building, clean, no damage. Dark gritty realistic pixel art for an adult zombie survival game, muted weathered colours, moonlit night, crisp pixels, dark outlines, nothing cartoonish, transparent background."
D={'clean':"Keep this clock tower exactly as it is: the same silhouette, proportions, colours, materials and every detail in the same position. Keep the camera exactly: the front wall is a perfectly flat rectangle with every horizontal line level, and only the narrow left side wall is in perspective, its cornices and roof edge sloping down toward the left. Only redraw the pixels cleanly: crisp straight cornices and mouldings, clean even stone joints, a clean straight roof eave, tidy window frames, no ragged or broken lines, no stray pixels. Smooth dressed grey-buff limestone, off-white louvered belfry, dark slate pyramid roof, lit pale-yellow clock face, dark wooden double door with two stone steps. Dark gritty realistic pixel art, muted colours, moonlit night, dark outlines, transparent background.",'ashlar':KEEP+"Replace the rough cinder-block masonry with fine architectural stonework like a 1900s American county courthouse: smooth dressed limestone ashlar in large finely cut blocks with thin tight joints (only a few joints drawn, large calm wall surfaces), slim carved stone pilasters at the corners, moulded cornices with small dentils, a rusticated stone base with deep grooves, a carved stone door surround. Warm grey-buff limestone, slightly weathered with faint rain streaks under the cornices."+END,
   'brick':KEEP+"Replace the stone block masonry with muted dusty dark red-brown brick with fine mortar lines, as in a small American town, with dressed limestone corner quoins, limestone cornices and trim bands, and a rusticated limestone base and door surround."+END}
jobs=json.load(open('jobs.json')) if os.path.exists('jobs.json') else {}
for spec in sys.argv[1:]:
    src,mat,seed=spec.split(':')
    r=api('POST','/edit-images-v2',{"method":"edit_with_text","edit_images":[enc(src+'.png')],"image_size":{"width":112,"height":208},"description":D[mat],"seed":int(seed),"no_background":True})
    print(spec,json.dumps(r)[:300])
    if 'background_job_id' in r: jobs['E_'+os.path.basename(src)+'_'+mat+'_'+seed]=r['background_job_id']
json.dump(jobs,open('jobs.json','w'))

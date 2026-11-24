import base64, json, subprocess, sys, io, os
from PIL import Image
KEY=open(os.path.join(os.path.dirname(__file__),'.key')).read().strip()
V='/mnt/user-data/uploads/Deadline/Assets/Village/'
def b64(path):
    im=Image.open(path).convert('RGBA'); buf=io.BytesIO(); im.save(buf,'PNG')
    return {"image":{"type":"base64","base64":base64.b64encode(buf.getvalue()).decode(),"format":"png"},"size":{"width":im.width,"height":im.height}}
def api(method,path,body=None):
    cmd=['curl','-sS','-m','90','-X',method,'-H','Authorization: Bearer '+KEY,'-H','Content-Type: application/json','https://api.pixellab.ai/v2'+path]
    if body is not None:
        open('/tmp/pl_body.json','w').write(json.dumps(body)); cmd+=['--data-binary','@/tmp/pl_body.json']
    r=subprocess.run(cmd,capture_output=True,text=True)
    try: return json.loads(r.stdout)
    except Exception: return {'raw':r.stdout[:500],'err':r.stderr[:300]}
TOP={'A':"a stone cornice ledge under the clock stage, one large round clock face on the front wall at the very top of the tower, softly lit pale yellow with dark numerals and dark iron hands, a second clock face on the left side wall seen foreshortened as a narrow oval, a white louvered vent in the wall below the clock, and directly above the clock a steep dark slate pyramid roof with a small iron finial",
     'B':"a stone cornice ledge under the clock stage, one large round clock face on the front wall near the top of the tower, softly lit pale yellow with dark numerals and dark iron hands, a second clock face on the left side wall seen foreshortened as a narrow oval, above the clock a short narrower belfry of off-white painted wood with two closed louvered arched openings on the front, topped by a dark slate pyramid roof with a small iron finial"}
MATD={'brick':"muted dusty dark red-brown brick with visible mortar lines, weathered dirty limestone trim bands and corner quoins",
      'stone':"weathered grey-buff limestone blocks with visible joints and rain streaks, slightly lighter carved stone trim bands and corner quoins"}
def desc(v,m):
    return ("pixel art, small-town American county courthouse clock tower at night, three-quarter view: the front wall faces the viewer flat and the left side wall is visible, receding; low camera at street level. "
      "A tall narrow square tower of "+MATD[m]+", a slightly wider stone base with one dark wooden door under a small stone pediment, small narrow stair windows up the shaft glowing warm amber, "+TOP[v]+". "
      "A normal kept-up, lived-in civic building: clean, no damage, no boards, no people, no vehicles, no flags, no stars, no bunting, no street lamps. "
      "Dark gritty realistic style for an adult zombie survival game, muted weathered colours, nothing bright or saturated, nothing cartoonish, moonlit night, crisp pixels, dark outlines. "
      "The tower fills the full height of the canvas and its lowest row touches the bottom edge. Transparent background.")
def body(v,m,seed):
    g=b64(f'guide_{v}_{m}.png'); g['usage_description']="Layout guide in flat colours: copy this exact silhouette, proportions and camera angle, and the positions and sizes of the clock face, roof, trim bands, windows and door. Do not copy its flat colours; draw real materials."
    p=b64(V+'defense_t3.png'); p['usage_description']="Camera and rendering reference only: same three-quarter angle (flat front wall, receding left side wall), same brick and stone rendering, same night lighting. Do not copy this building."
    o=b64(V+'punctuality_t3.png'); o['usage_description']="The old front-view version of this clock tower: keep its character (courthouse tower, lit pale-yellow clock face, pale trim, slate roof) but redraw it in three-quarter view following the layout guide."
    st=b64(V+'habits_t3.png')
    return {"description":desc(v,m),"image_size":{"width":112,"height":208},"seed":seed,"no_background":True,
            "reference_images":[g,p,o],"style_image":st,"style_options":{"color_palette":False,"outline":True,"detail":True,"shading":True}}
if __name__=='__main__':
    jobs=json.load(open('jobs.json')) if os.path.exists('jobs.json') else {}
    for spec in sys.argv[1:]:
        v,m,seed=spec.split(':'); r=api('POST','/generate-image-v2',body(v,m,int(seed)))
        print(spec,json.dumps(r)[:300]); 
        if 'background_job_id' in r: jobs[spec]=r['background_job_id']
    json.dump(jobs,open('jobs.json','w'))

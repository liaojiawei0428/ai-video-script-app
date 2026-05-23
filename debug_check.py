import json, urllib.request
r = urllib.request.urlopen("http://localhost:6000/api/novels")
d = json.load(r)
novels = d.get("data", {}).get("novels", [])
print(f"Total novels: {len(novels)}")
for x in novels[:5]:
    print(f"  {x['id'][:8]} | {x.get('status','?')} | {x.get('title','')[:30]}")
    if x.get('status') == 'completed':
        try:
            ep = urllib.request.urlopen(f"http://localhost:6000/api/novels/{x['id']}/episodes")
            epd = json.load(ep)
            eps = epd.get("data", {}).get("episodes", [])
            print(f"    Episodes: {len(eps)}")
        except Exception as e:
            print(f"    Episodes error: {e}")

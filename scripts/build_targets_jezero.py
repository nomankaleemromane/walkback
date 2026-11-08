"""Science targets, Perseverance traverse and point-of-view images for Jezero.

Targets are real Perseverance sampling sites. The sample name, rock, campaign and
sealing sol come from NASA's "Mars Rock Samples" page
(https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/).
Coordinates are the rover's last localized waypoint on or before the sealing sol, from
NASA's official MMGIS waypoint file. That is close to, but not exactly, the sampled rock
(usually within tens of metres), so each target is marked approximate.

Usage: python scripts/build_targets_jezero.py [--no-images]
Needs raw/M20_waypoints.json and raw/M20_traverse.json (downloaded if missing).
"""
import json, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "sites", "jezero")
RAW = os.path.join(ROOT, "raw")
MMGIS = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/"
RAWAPI = "https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&sol={sol}&num=100&page=0"
UA = {"User-Agent": "Walkback-SpaceApps/1.0"}

# Mission science objectives for the Jezero Marswalk (Walkback framing of the
# Mars 2020 science goals: Farley et al. 2020, Space Sci. Rev. 216:142).
OBJECTIVES = [
    {"id": "A", "name": "Delta sediments", "goal": "Sample the western delta's layered fine-grained sediments, the rocks most likely to preserve organic matter and signs of ancient life."},
    {"id": "B", "name": "Margin carbonates", "goal": "Reach the carbonate-bearing margin unit to study how the lake shoreline and water chemistry changed."},
    {"id": "C", "name": "Crater-floor igneous rocks", "goal": "Examine the olivine-rich Seitah unit and the Maaz floor to date the crater floor and its alteration by water."},
]

# (id, display name, sample, sealing sol, rock/target, campaign, rock type, objective,
#  priority 1-10 [Walkback demo value, assumed], instruments/rationale)
TARGETS = [
    ("wildcat", "Wildcat Ridge", "Hazeltop", 509, "Wildcat Ridge", "Delta Front", "Sedimentary", "A", 10, "Fine-grained mudstone/sandstone; strongest organic signal of the delta-front campaign. SHERLOC/PIXL proximity science, core."),
    ("skinner", "Skinner Ridge", "Swift Run", 490, "Skinner Ridge", "Delta Front", "Sedimentary", "A", 7, "Delta-front sandstone; context for the delta stack."),
    ("amalik", "Amalik outcrop", "Shuyak", 575, "Amalik", "Delta Front", "Sedimentary", "A", 8, "Layered sedimentary outcrop at the delta front."),
    ("hidden_harbor", "Hidden Harbor", "Kukaklek", 631, "Hidden Harbor", "Delta Front", "Sedimentary", "A", 6, "Delta-front mudstone; complements Wildcat Ridge."),
    ("melyn", "Berea (upper fan)", "Melyn", 749, "Berea", "Upper Fan", "Sedimentary", "A", 6, "Upper-fan conglomerate/sandstone: what the river carried into the lake."),
    ("pelican", "Hans Amundsen Memorial Workspace", "Pelican Point", 923, "Hans Amundsen Memorial Workspace", "Margin Unit", "Sedimentary", "B", 7, "Margin-unit carbonate-bearing rock near the old shoreline."),
    ("lefroy", "Turquoise Bay", "Lefroy Bay", 949, "Turquoise Bay", "Margin Unit", "Sedimentary", "B", 8, "Margin-unit sedimentary rock near the old shoreline."),
    ("bunsen", "Bunsen Peak", "Comet Geyser", 1088, "Bunsen Peak", "Margin Unit", "Silica-cemented carbonate", "B", 9, "Silica-cemented carbonate: high biosignature-preservation potential."),
    ("cheyava", "Cheyava Falls", "Sapphire Canyon", 1215, "Cheyava Falls", "Neretva Vallis", "Sedimentary", "B", 10, "Mudstone with 'leopard spots', a potential biosignature reported by NASA (2025)."),
    ("seitah_brac", "South Seitah (Brac)", "Salette", 262, "Brac", "South Seitah", "Igneous", "C", 7, "Olivine-rich cumulate igneous rock altered by water."),
    ("seitah_issole", "South Seitah (Issole)", "Robine", 298, "Issole", "South Seitah", "Igneous", "C", 6, "Olivine-rich igneous rock, second Seitah site."),
    ("rochette", "Rochette (Artuby Ridge)", "Montdenier", 194, "Rochette", "Artuby Ridge", "Igneous", "C", 5, "Maaz crater-floor igneous rock; Montdenier was the first rock core sealed on Mars."),
    ("sid", "Sid (Ch'al outcrop)", "Ha'ahoni", 371, "Sid", "Octavia E. Butler landing / Ch'al", "Igneous", "C", 4, "Maaz floor rock close to the landing site."),
]


def get_json(url, path):
    if os.path.exists(path):
        return json.load(open(path, encoding="utf8"))
    req = urllib.request.Request(url, headers=UA)
    data = urllib.request.urlopen(req, timeout=60).read()
    open(path, "wb").write(data)
    return json.loads(data)


def main(images=True):
    site = json.load(open(os.path.join(OUT, "site.json")))
    W, E, S, N = site["west"], site["east"], site["south"], site["north"]
    wps = get_json(MMGIS + "M20_waypoints.json", os.path.join(RAW, "M20_waypoints.json"))["features"]
    trv = get_json(MMGIS + "M20_traverse.json", os.path.join(RAW, "M20_traverse.json"))["features"]
    P = sorted((f["properties"] for f in wps), key=lambda p: (p["sol"], p["site"], p["drive"]))

    # ---- traverse + waypoints, clipped to the grid and lightly simplified
    inb = lambda lon, lat: W <= lon <= E and S <= lat <= N
    feats = []
    for f in trv:
        cs = [c[:2] for c in f["geometry"]["coordinates"] if inb(c[0], c[1])]
        if len(cs) >= 2:
            cs = [[round(x, 6), round(y, 6)] for x, y in cs]
            feats.append({"type": "Feature", "properties": {"sol": f["properties"]["sol"], "length_m": f["properties"].get("length")},
                          "geometry": {"type": "LineString", "coordinates": cs}})
    wpf = [{"type": "Feature", "properties": {"sol": p["sol"], "rmc": p["RMC"], "elev_geoid": round(p["elev_geoid"], 1), "dist_total_m": p.get("dist_total_m")},
            "geometry": {"type": "Point", "coordinates": [round(p["lon"], 6), round(p["lat"], 6)]}} for p in P if inb(p["lon"], p["lat"])]
    trav = {"type": "FeatureCollection", "name": "Perseverance traverse (clipped)",
            "source": "NASA/JPL-Caltech MMGIS M20_traverse.json and M20_waypoints.json (official), fetched " + time.strftime("%Y-%m-%d"),
            "last_sol": max(p["sol"] for p in P), "features": feats + wpf}
    json.dump(trav, open(os.path.join(OUT, "traverse.geojson"), "w"), separators=(",", ":"))
    print(f"traverse: {len(feats)} segments, {len(wpf)} waypoints, last sol {trav['last_sol']}")

    # ---- targets
    os.makedirs(os.path.join(OUT, "pov"), exist_ok=True)
    out = []
    for tid, name, sample, sol, rock, camp, rtype, obj, prio, why in TARGETS:
        c = [p for p in P if p["sol"] <= sol]
        p = c[-1]
        t = {"id": tid, "name": name, "lat": round(p["lat"], 6), "lon": round(p["lon"], 6),
             "objective": obj, "priority": prio, "station_min": 20,
             "sample": sample, "sample_sol": sol, "rock": rock, "campaign": camp, "rock_type": rtype,
             "rationale": why,
             "position_source": f"Perseverance waypoint {p['RMC']} (sol {p['sol']}), last localization on or before the sealing sol; approximate (typically within tens of metres of the sampled rock).",
             "approximate": True, "pov": []}
        if images:
            try:
                for s2 in (sol, sol - 1, sol - 2, sol + 1):  # nearby sols if the sealing sol has no full frames
                    t["pov"] = fetch_pov(tid, s2)
                    if t["pov"]:
                        break
            except Exception as e:
                print("  pov failed", tid, e)
        out.append(t)
        print(f"{name:34s} sol {sol:5d} -> {p['RMC']:9s} {p['lat']:.5f} {p['lon']:.5f}  pov {len(t['pov'])}")
    meta = {"objectives": OBJECTIVES, "targets": out,
            "sources": {"samples": "NASA Mars Rock Samples page, science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/ (accessed 2026-11-09)",
                        "positions": "NASA/JPL-Caltech MMGIS M20_waypoints.json",
                        "images": "Mars 2020 raw images, NASA/JPL-Caltech (Mastcam-Z: NASA/JPL-Caltech/ASU). Raw, uncalibrated."},
            "priority_note": "Priority scores are Walkback demo values (an assumption). A real science team would set them.",
            "station_note": "Default 20 min on station per stop (assumption; editable)."}
    json.dump(meta, open(os.path.join(OUT, "targets.json"), "w"), indent=1, ensure_ascii=False)


def fetch_pov(tid, sol, want=3):
    d = json.loads(urllib.request.urlopen(urllib.request.Request(RAWAPI.format(sol=sol), headers=UA), timeout=60).read())
    imgs = d.get("images", [])
    pref = ["MCZ_LEFT", "NAVCAM_LEFT", "FRONT_HAZCAM_LEFT_A", "MCZ_RIGHT", "NAVCAM_RIGHT"]
    picked, seen = [], set()
    for inst in pref:
        for im in imgs:
            ins = im["camera"]["instrument"]
            if ins != inst or ins in seen:
                continue
            # skip thumbnails/subframes: want full frames
            dim = im.get("extended", {}).get("dimension", "")
            if dim and "(" in dim:
                wv = int(dim.strip("()").split(",")[0])
                if wv < 1000:
                    continue
            picked.append(im)
            seen.add(ins)
            break
        if len(picked) >= want:
            break
    res = []
    for k, im in enumerate(picked):
        url = im["image_files"].get("medium") or im["image_files"].get("large")
        fn = f"{tid}_{k}.jpg"
        path = os.path.join(OUT, "pov", fn)
        if not os.path.exists(path):
            data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
            open(path, "wb").write(data)
        res.append({"file": "pov/" + fn, "sol": im["sol"], "instrument": im["camera"]["instrument"],
                    "camera": im["camera"].get("full_name") or im["camera"]["instrument"],
                    "imageid": im.get("imageid"), "date_taken_utc": im.get("date_taken_utc"),
                    "credit": im.get("credit", "NASA/JPL-Caltech"), "source_url": url,
                    "page": im.get("link")})
    return res


if __name__ == "__main__":
    main(images="--no-images" not in sys.argv)

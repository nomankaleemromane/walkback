"""Science targets for the Gale proof-of-generality site pack.

Targets are Curiosity drill sites. Drill sols are from Walkback's reading of the MSL drill
campaign record and should be re-checked against NASA's list before relying on them
(marked "verify" in the output). Coordinates are Curiosity's last localized waypoint on or
before that sol, from NASA's official MMGIS file MSL_waypoints.json: approximate.
Usage: python scripts/build_targets_gale.py
"""
import json, os, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "sites", "gale")
RAW = os.path.join(ROOT, "raw", "MSL_waypoints.json")
if not os.path.exists(RAW):
    data = urllib.request.urlopen("https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json", timeout=60).read()
    open(RAW, "wb").write(data)

OBJ = [
    {"id": "A", "name": "Ancient lake mudstones", "goal": "Sample fine-grained lake sediments that recorded a habitable environment."},
    {"id": "B", "name": "Base of Mount Sharp", "goal": "Reach the Murray formation at the base of Mount Sharp to study how the climate changed."},
    {"id": "C", "name": "Sandstones and fluids", "goal": "Examine sandstones that record later groundwater."},
]
T = [  # id, name, drill target, drill sol (verify), objective, priority
    ("john_klein", "Yellowknife Bay", "John Klein", 182, "A", 9),
    ("cumberland", "Yellowknife Bay (Cumberland)", "Cumberland", 279, "A", 7),
    ("windjana", "The Kimberley", "Windjana", 621, "C", 7),
    ("confidence", "Pahrump Hills", "Confidence Hills", 759, "B", 9),
    ("mojave", "Pahrump Hills (Mojave)", "Mojave", 882, "B", 6),
    ("telegraph", "Telegraph Peak", "Telegraph Peak", 908, "B", 6),
    ("buckskin", "Marias Pass", "Buckskin", 1060, "B", 8),
]
site = json.load(open(os.path.join(OUT, "site.json")))
P = sorted((f["properties"] for f in json.load(open(RAW))["features"]), key=lambda p: (p["sol"], p["site"], p["drive"]))
out = []
for tid, name, drill, sol, obj, prio in T:
    p = [q for q in P if q["sol"] <= sol][-1]
    inside = site["west"] < p["lon"] < site["east"] and site["south"] < p["lat"] < site["north"]
    print(f"{name:30s} sol {sol:5d} -> {p['RMC']:8s} {p['lat']:.5f} {p['lon']:.5f} {'in' if inside else 'OUT'}")
    if not inside:
        continue
    out.append({"id": tid, "name": name, "lat": round(p["lat"], 6), "lon": round(p["lon"], 6), "objective": obj, "priority": prio, "station_min": 20,
                "sample": drill, "sample_sol": sol, "rationale": f"Curiosity drill target {drill}.", "approximate": True, "pov": [],
                "position_source": f"Curiosity waypoint {p['RMC']} (sol {p['sol']}), last localization on or before sol {sol} (drill sol to verify); approximate."})
json.dump({"objectives": OBJ, "targets": out, "sources": {"positions": "NASA/JPL-Caltech MMGIS MSL_waypoints.json"},
           "priority_note": "Demo priorities (assumed)."}, open(os.path.join(OUT, "targets.json"), "w"), indent=1)

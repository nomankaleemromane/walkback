"""Snapshot of NASA CCMC DONKI WSA-Enlil runs (last 30 days) for offline use.

The app tries the live feed first and falls back to this file, labelled with its age.
DONKI moved to CCMC on 2026-09-30: https://ccmc.gsfc.nasa.gov/DONKI-API/ (keyless).
Usage: python scripts/fetch_donki.py
"""
import json, os, datetime, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "donki_snapshot.json")
end = datetime.date.today()
start = end - datetime.timedelta(days=30)
url = f"https://ccmc.gsfc.nasa.gov/DONKI-API/get/WSAEnlilSimulations?startDate={start}&endDate={end}"
runs = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Walkback-SpaceApps/1.0"}), timeout=60).read())
mars = [i for r in runs for i in (r.get("impactList") or []) if "mars" in (i.get("location") or "").lower()]
json.dump({"fetched": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ"), "url": url, "runs": runs}, open(OUT, "w"))
print(f"{len(runs)} runs, {len(mars)} Mars impacts listed; wrote {OUT}")
for i in mars:
    print("  Mars arrival", i.get("arrivalTime"), "glancing" if i.get("isGlancingBlow") else "")

# Walkback: build plan

Walkback is a Mars EVA planner that always knows the way home. Built for the NASA Space Apps 2026 "Marswalk map" challenge (event Nov 14-15, 2026; plan started Nov 9).

## What I verified before building (Nov 9, 2026)

| Claim in the brief | Result | How checked |
|---|---|---|
| Trek tile URL pattern, zoom = WMTS level, x=col, y=row | OK | curl at Jezero for each layer |
| THEMIS IR Day layer is `.jpg` | **Wrong: it is `.png`** (the old app requested `.jpg`, so THEMIS never loaded) | curl |
| THEMIS IR Night layer exists | OK: `Mars_MO_THEMIS-IR-Night_mosaic_60N60S_100m_v14_clon0_ly` (.png) | curl |
| Jezero CTX layers (6 m ortho, max 13; block-adjusted, max 12) | OK, `.png` | curl |
| Trek tiles cannot be used in canvas/WebGL | **Wrong: tiles send `Access-Control-Allow-Origin: *`**, so they can be WebGL textures | curl with Origin header |
| api.nasa.gov tile/DONKI hosts | Not reachable from here; dropped | curl |
| CCMC DONKI WSA-Enlil endpoint, keyless, CORS | OK (`Access-Control-Allow-Origin: *`) | curl |
| USGS needs a browser User-Agent | Files now redirect to an S3 bucket (`asc-pds-services`), which works without one | curl |
| DEM bbox in `dem.json` | Matches the GeoTIFF; but `make_dem.py` mixed two Mars radii (3396190 / 3389500). Fixed to 3396190 (Mars 2000 sphere used by the file) | rasterio |
| Perseverance traverse | Official NASA MMGIS GeoJSON works (`mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json`, `M20_waypoints.json`, to sol 2022) | curl |
| NASA Perseverance weather feed | Last entry 2024-04-27: **not live**. Use MEDA climatology (Zenodo) instead and say so | curl |
| Raw image feed | OK, filter by `sol=` | curl |
| xEVA con-ops (EVA-EXP-0042 Rev B): 20 deg slope, ~2 km/h, <5 h (~10 km) walk-back, 8 h pressurized-rover walk-back, 12,000 m contingency walk-back | OK, pages 38-44 | PDF text |
| Surface EVA architectural drivers (2024): safe haven within emergency consumables | OK, page 4 | PDF text |
| arXiv 2502.02469: "current lack of a unified definition", >= 30 min lead time | OK. May 20, 2024 event: "just over 50 minutes" | PDF text |
| "Shelter assembly within 30 min", "<10 mSv over 2 h", "40/25/250 mSv" | **Not found** in the cited sources; not used | PDF text search |
| EVA Walkback Test tested Mars gravity | **Wrong: lunar (1/6 g) only**, 6 astronauts, 10 km, Mark III suit. Mars-gravity suited data not found | NTRS abstracts |
| Partial-gravity walking cost (Farley & McMahon 1992): 75% g reduction lowers walking cost ~33% | OK (with later criticism of the method) | abstract |
| Suited vs Earth shirtsleeve ratio | Norcross et al. 2010 (IST-2, NASA TP): ESSPI 1.0/0.8/0.6 at 10/20/30% grade (lunar) | NTRS PDF |
| MAVEN lost | OK: contact lost Dec 2025, declared lost June 3, 2026 | news search |
| May 2024 RAD ~8.1 mGy | OK (8,100 microgray) | news + JPL |
| Photogeologic map (Stack et al. 2020) GIS | OK: shapefile in the article's supplement (CC BY 4.0 article) | downloaded |
| THEMIS thermal inertia of Jezero (Edwards & Buz 2021) | OK: Zenodo 10.5281/zenodo.4931348, CC BY 4.0, 100 m | downloaded |
| MEDA temperatures | Zenodo 10.5281/zenodo.11198655 (Munguira et al. 2024), CC BY 4.0 | downloaded |

## Phases (commit after each) - status Nov 9: all phases done; see docs/CHECKLIST.md for open items

1. **Data pipeline** - `scripts/`: site-pack builder (DEM, slope/roughness at 20 m, CTX texture), trafficability (geology + TI), traverse, science targets from NASA sample sols + waypoints, POV images, MEDA climatology, DONKI snapshot. Policy config with sources.
2. **Core model as tested modules** - effort (low/central/high), router, walkback field, orienteering planner, alert logic, Mars sun/time. Node unit tests.
3. **App rebuild** - Plan / Go / Abort modes, layers that change the plan, timeline, verdict with binding constraint, sensitivity, demo scenario. Offline (service worker, vendored libs).
4. **3D** - three.js terrain, route, walkback zone, stops; astronaut fly-through with HUD.
5. **Perseverance backtest** - router vs real traverse, honest stats.
6. **Exports** - GeoJSON, GPX, printable EVA card.
7. **Docs** - PROBLEM, COMPLIANCE, VALIDATION, IMPLEMENTATION, PITCH, feedback kit, README.
8. **Second site** via the site-pack builder (proof it generalizes).

## Risks

- Dijkstra on 600k cells x (N+1) stops may be slow: restrict to a bounding box, run in a Web Worker.
- Geology map covers only part of the DEM: show "no geology data" on the map and lower confidence there.
- The effort model is not flight-valid: show it as a range, never a single number.
- Rover path != human path: frame backtest as "traversability agreement".
- Live feeds can fail: snapshots + "cached, N days old" labels.

## Changes to the brief made after checking sources

- Warning shelter limit 30 min (derived); Watch 90 min (assumed). The brief's 0.5/0.15 multipliers were dropped.
- The EVA Walkback Test was lunar-only; effort range uses Farley & McMahon 1992 + NASA IST-2 (Norcross et al. 2010) instead.
- SEXTANT already computes walk-back on the Moon, so the gap claim is the Mars combination (space weather + weather + geology/thermal + offline), phrased as "we did not find".
- A rover parked at the delta does NOT help under a Warning (the corridor is >30 min from both shelters); starting the EVA from the rover does. Demo and docs say this.
- Backtest: traversability agrees (98.5%); path choice is no better than a straight line. Reported as such.

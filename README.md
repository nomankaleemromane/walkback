# Walkback

**The Mars EVA planner that always knows the way home.** NASA Space Apps 2026, challenge "Marswalk map".

Walkback is a layered, integrated Marswalk map for Jezero crater. It plans a walking EVA from a habitat to real Perseverance sampling sites so that, **at every point of the route, the crew can walk back to a safe haven** before consumables, radiation shelter time or daylight run out. It shows which limit binds, re-plans when NASA forecasts a CME at Mars, and gives a one-tap abort route.

Research prototype on real NASA/USGS data. **Not flight software.**

## Run it

```
python -m http.server 8000
# open http://localhost:8000
```

- No build step and no API keys.
- Works offline after the first load (service worker).
- Second site: `http://localhost:8000/?site=gale`
- Deploy: push the folder to GitHub Pages (static files only).

| Key | Action |
|---|---|
| `1` / `2` / `3` | Plan / Go / Abort |
| `V` | 2D / 3D |
| ▶ Demo | Scripted Quiet → Watch → Warning → Abort → rover story (for the video) |

## What it does

- **Route:** least-effort walking path over the 20 m CTX terrain model. It avoids slopes over 20° and penalises boulders, talus, megaripples, rough ground and soft (low thermal inertia) ground.
- **Walk-back field:** walking time from every cell to the nearest safe haven (habitat, or optionally a pressurized rover).
- **Planner:** picks and orders science stops to maximise science value (exact branch-and-bound) within:
  - the planned EVA length
  - the walk-back criterion (elapsed + walk-back ≤ consumables − reserve, at every cell)
  - the radiation shelter-time limit
  - daylight
- **Verdict:** GO / CAUTION / NO-GO with every check, the binding constraint, and what a storm removed compared with quiet conditions.
- **Sensitivity:** the same plan re-checked with optimistic and pessimistic effort/pace.
- **Current conditions:**
  - Perseverance sol, local solar time, season (Mars24)
  - NASA CCMC DONKI CME alert, live or cached with age
  - MEDA climatology for this season: temperature, dust, sunset, best start time
- **Go / Abort:** tablet / visor view with big controls; time to shelter, allowed time and margin; one-tap walk-back route with ETA and buddy-assisted ETA.
- **3D:** three.js terrain with the route, stops and walk-back zone; astronaut eye-height fly-through with a HUD.
- **Point of view:** real Perseverance images from each sampling sol.
- **Exports:** GeoJSON, GPX, printable EVA card (PDF).
- **Backtest:** router vs Perseverance's real drives.

## Results (Jezero, central case, start 09:00 LTST; `node scripts/report.mjs`)

| Scenario | Stops | EVA | Verdict (binding) |
|---|---|---|---|
| Quiet | 5 (Skinner, Wildcat, Hidden Harbor, Amalik, Séítah) | 5.8 h | CAUTION (EVA length; fails pessimistic case) |
| Watch (90 min) | 5 | 5.8 h | CAUTION (radiation) |
| Warning (30 min) | 3 crater-floor stops | 2.5 h | NO-GO (policy) |
| Warning, EVA from a rover at the delta | 4 delta stops, ≤ 17 min from shelter | 2.7 h | NO-GO (policy); shows the option |

- 9 of 13 targets fit a single 6 h walking EVA.
- The margin-unit carbonates (round trip 7.8-10.8 h) need a rover.

Backtest: 98.5% of the ground Perseverance drove is walkable in our model. Route overlap with the rover's path is 80% vs 78% for a straight line, i.e. not better. Details: [docs/VALIDATION.md](docs/VALIDATION.md).

## Repository

```
index.html, css/, js/          app (ES modules; model code is DOM-free and unit-tested)
  js/model.js       effort (Minetti 2002 x literature range) and pace
  js/terrain.js     trafficability (geology + roughness + thermal inertia + slope)
  js/router.js      Dijkstra (Float64), walk-back field
  js/planner.js     orienteering solver, timeline, verdict
  js/spaceweather.js, js/marstime.js (Mars24)
config/policy.json  every limit with value, unit, basis and source
data/sites/<id>/    site packs (jezero, gale) + index.json; data/donki_snapshot.json
scripts/            data builders (see scripts/README.md), backtest, report
tests/              node unit tests (npm test), Playwright smoke test (tests/smoke.py)
docs/               PROBLEM, COMPLIANCE, VALIDATION, IMPLEMENTATION, PITCH, FEEDBACK, CHECKLIST
vendor/             Leaflet 1.9.4, three.js 0.160.0 (for offline use)
```

Tests:
- `npm test`: 24 unit tests
- `python tests/smoke.py`: browser smoke test with the server running

## Data sources and licences

| Data | Source | Licence / terms |
|---|---|---|
| Map tiles (CTX Jezero, Viking, MOLA, HRSC, THEMIS day/night) | NASA Mars Trek WMTS, trek.nasa.gov | NASA, public |
| Terrain | Fergason et al. 2020, CTX DTM mosaic for Mars 2020 TRN, USGS, doi:10.5066/P906QQT8 | US public domain, no use constraints |
| Orthoimage | Fergason et al. 2020, CTX orthomosaic for Mars 2020 TRN, USGS, doi:10.5066/P9GV1ND3 | US public domain |
| Geology | Stack et al. 2020, Space Sci. Rev. 216:127, doi:10.1007/s11214-020-00739-x (supplement ESM 3) | Article CC BY 4.0. The supplement README says "Copyright 2020. All rights reserved"; we ship only a derived raster with attribution, not the shapefile |
| Thermal inertia | Edwards & Buz 2021, Zenodo doi:10.5281/zenodo.4931348 | CC BY 4.0 |
| Weather climatology | Hueso et al. 2024, Zenodo doi:10.5281/zenodo.11198655 (Munguira et al. 2024, JGR Planets) | CC BY 4.0 |
| Space weather | NASA CCMC DONKI WSA-Enlil, ccmc.gsfc.nasa.gov/DONKI-API | NASA, public |
| Traverse, waypoints | NASA/JPL-Caltech MMGIS (M20 and MSL) | NASA/JPL |
| Images | Mars 2020 raw images, NASA/JPL-Caltech (Mastcam-Z: NASA/JPL-Caltech/ASU) | NASA/JPL image use policy; credited per image |
| Gale | USGS MSL Gale DEM 1 m v3 and HiRISE LRGB mosaic (HiRISE: NASA/JPL/UArizona) | USGS / NASA |
| Radiation baseline | Hassler et al. 2014, Science 343 (Curiosity RAD, 0.64 mSv/day) | citation |

EVA rules and literature are cited in [docs/PROBLEM.md](docs/PROBLEM.md) and `config/policy.json`.

## Honest limitations

- **Effort:** built from Earth treadmill data (Minetti 2002) with literature multipliers. It is an **index and a range**, not a flight value. No Mars-gravity suited walking data were found.
- **Terrain resolution:** the 38 m routing grid and 20 m DTM miss single boulders; geology units and thermal inertia are proxies. Geology covers 26% of the Jezero grid (hatched elsewhere).
- **Space weather:** the CME alert is a **proxy** for SEP risk; SEPs can arrive first. There has been no Mars SEP monitor since MAVEN's loss (June 2026).
- **Weather:** no live Jezero weather exists. MEDA climatology is used and labelled.
- **Placeholders:** shelter limits other than Warning, consumables, reserve, hazard scores, buddy pace, habitat location and science priorities are **assumptions** in `config/policy.json`.
- **Backtest:** shows traversability agreement, not path agreement.
- **Validation:** no expert has reviewed this yet ([docs/FEEDBACK.md](docs/FEEDBACK.md)).
- **Position in Go mode:** simulated.

See also [docs/CHECKLIST.md](docs/CHECKLIST.md) for everything unverified or approximate.

## AI-use disclosure

This project was built with substantial help from an AI coding assistant (Anthropic's Claude, via Claude Code). It:
- wrote most of the code and documentation
- researched and downloaded the datasets
- checked citations against the source PDFs where it could

The team directed the work, reviewed it, and is responsible for it. All data are from the cited NASA/USGS/published sources; no data were generated by AI. Space Apps rules: no NASA endorsement is implied.

## Licence

Code: MIT. Data: see the table above.

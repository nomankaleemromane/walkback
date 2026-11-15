# Walkback: complete project details

**Walkback — the Mars EVA planner that always knows the way home.**
NASA Space Apps Challenge 2026 · Challenge: **Interplanetary Survival Guide: Martian Map**

- Live app: https://walkback-nine.vercel.app (second site: https://walkback-nine.vercel.app/?site=gale)
- Source code: https://github.com/nomankaleemromane/walkback (public)

This document lists every part of the project, so nothing is missed when writing the submission. Numbers come from real runs of the app (`node scripts/report.mjs`, `node scripts/backtest.mjs`, `npm test`) and were checked on 15 Nov 2026.

---

## 1. One-paragraph summary

Walkback is a layered, integrated Marswalk map for Jezero crater, where NASA's Perseverance rover explores. It plans a walking spacewalk (EVA) from a habitat to real Perseverance sample sites, choosing which stops to visit and in what order, and finding the least-effort route over real terrain while avoiding steep slopes, boulder fields and soft sand. At every point of the route it checks that the crew can still **walk back to a safe haven** before their suit consumables, the daylight, or a radiation shelter limit runs out (NASA's "walk-back" rule). It gives a GO / CAUTION / NO-GO verdict, names the limit that decides the plan, and re-plans in under a second when NASA forecasts a solar storm heading to Mars. A tablet "Go" view supports the crew during the EVA and a one-tap Abort gives the route home. A 3D view shows a two-person crew walking the planned route on real Mars terrain and taking samples at each stop. It uses 10 datasets from 8 NASA missions and works offline.

## 2. The problem

- **The walk-back rule is real NASA practice.**
  - Apollo traverse planning limited how far astronauts went by the "walkback constraint": they had to be able to walk back to the lunar module on the consumables left in their life-support backpack.
  - NASA's Artemis xEVA Concept of Operations (EVA-EXP-0042 Rev B, 2020) says crews "will always stay within a range that allows them to get to a safe haven (lander, habitat, or pressurized rover)". It also says "smart traverse planning tools will be utilized to calculate the appropriate distance during any given day".
  - NASA's "Surface EVA Architectural Drivers" (2024) requires access to a pressurized safe haven within the limits of emergency consumables.
- **Mars is harder than the Moon.**
  - Earth is 4–24 minutes away by radio (one way), so mission control can't help in real time.
  - The terrain has boulder fields, sand ripples and cliffs.
  - Radiation from solar storms is a real risk.
- **Mars lost its solar-particle monitor.** NASA's MAVEN orbiter lost contact in December 2025 and was declared lost on 3 June 2026. Crews now depend on solar-storm forecasts made from Earth (NASA CCMC) plus surface radiation measurements (Curiosity's RAD).
- **There is no agreed rule for time to shelter on Mars.** A 2025 study (Löwe et al., arXiv:2502.02469) states that a unified definition is missing. It finds a radiation-detector "nowcast" can give astronauts at least 30 minutes' warning.
- **The gap.** EVA planning tools exist for the Moon and Earth analog sites (for example MIT's SEXTANT, which computes walk-back on the Moon; and Bickel & Kring 2024 for Artemis). **We did not find** a tool for Mars that combines all of the following:
  - terrain walk-back time
  - Mars space-weather alerts
  - Mars weather climatology
  - geology and thermal trafficability
  - offline use on a tablet

## 3. Who uses it and when

| Phase | Who | When | What Walkback gives them |
|---|---|---|---|
| **Plan** | EVA planner and science lead, in the habitat | The sol before, and the morning of the EVA | Ordered science stops, timeline in Mars local time, verdict with the binding limit, sensitivity check, printable EVA card, GeoJSON/GPX export |
| **Go** | The two-person EVA crew, on a tablet or visor | During the EVA | EVA clock, time to shelter now, time the limits allow now, margin, next activity |
| **Abort** | The crew, one tap | Suit or medical problem, or a storm warning | Least-effort route to the nearest safe haven, ETA, buddy-assisted ETA, heading, radiation dose |

## 4. Mission science objectives (Jezero)

| Objective | Goal | Example stops |
|---|---|---|
| **A · Delta sediments** | Sample the western delta's fine-grained layered sediments, the rocks most likely to preserve organic matter and signs of ancient life | Wildcat Ridge, Skinner Ridge, Amalik outcrop, Hidden Harbor, Berea |
| **B · Margin carbonates** | Reach the carbonate-bearing margin unit, the old lake shoreline | Hans Amundsen Memorial Workspace, Turquoise Bay, Bunsen Peak, Cheyava Falls |
| **C · Crater-floor igneous rocks** | Examine the olivine-rich Séítah unit and the Máaz crater floor, to date the crater floor and its alteration by water | South Séítah (Brac and Issole), Rochette, Sid |

**13 real science stops**, each a real Perseverance sampling site, with:
- the real sample name (e.g. "Hazeltop" at Wildcat Ridge) and the sol it was sealed;
- a position taken from NASA's official waypoint file (the rover's last localization before sealing; marked approximate, typically within tens of metres);
- a priority score and time on station (default 20 min), both editable;
- a science rationale;
- three real Perseverance images from the sampling sol (39 images in total).

## 5. Data used (10 datasets, 8 NASA missions)

| # | Dataset | Mission / source | What it changes in the plan |
|---|---|---|---|
| 1 | NASA Mars Trek map tiles: CTX Jezero 6 m, Viking colour, MOLA elevation, MOLA+HRSC relief, THEMIS IR day and night | NASA Mars Trek (JPL); the HRSC part is from **ESA's Mars Express** (ESA/DLR/FU Berlin), a 2026 Space Agency Partner | Base maps and context layers |
| 2 | Jezero 3D terrain model (20 m) and orthophoto (6 m), Fergason et al. 2020, USGS (doi:10.5066/P906QQT8, 10.5066/P9GV1ND3) | NASA Mars Reconnaissance Orbiter, CTX camera; the same maps used to land Perseverance | Slopes, walking effort, pace, walk-back times, 3D terrain and texture, offline base map |
| 3 | Mars 2020 Science Team photogeologic map, Stack et al. 2020 (Space Sci. Rev. 216:127) | NASA Mars 2020 team, mapped on HiRISE images | Boulder-shedding mesas, talus, megaripples and rough units raise terrain hazard; the router detours |
| 4 | THEMIS thermal inertia of Jezero, Edwards & Buz 2021 (Zenodo 10.5281/zenodo.4931348) | NASA Mars Odyssey, THEMIS | Low thermal inertia flags loose, soft ground |
| 5 | MEDA weather climatology, Hueso et al. 2024 (Zenodo 10.5281/zenodo.11198655) | NASA Perseverance, MEDA weather station; Mastcam-Z dust opacity | Sunset time (daylight limit), cold caution, best EVA start time, dust opacity |
| 6 | CCMC DONKI WSA-Enlil solar-storm forecasts | NASA Goddard Space Flight Center | Space-weather level, radiation shelter-time limit, dropped stops, NO-GO |
| 7 | Perseverance traverse and waypoints (MMGIS) | NASA/JPL Mars 2020 | Science stop positions; the route backtest |
| 8 | Perseverance raw images (Mastcam-Z, Navcam, Hazcam) | NASA/JPL Mars 2020 | Point-of-view photos at each destination |
| 9 | Curiosity RAD surface radiation (~0.64 mSv/day) | NASA Mars Science Laboratory | Background radiation dose along the route |
| 10 | Curiosity waypoints, plus USGS Gale 1 m terrain model and HiRISE colour mosaic | NASA Mars Science Laboratory; NASA MRO HiRISE | Second site (Gale crater) |

**Space Agency Partner data:** ESA (Mars Express HRSC, inside the MOLA+HRSC relief layer). **Partner inspiration:** JAXA and Toyota's pressurized Lunar Cruiser concept for the rover safe haven (a reference, not data).

Missions: Mars Reconnaissance Orbiter (CTX and HiRISE), Mars Odyssey (THEMIS), Mars Global Surveyor (MOLA), Viking, Perseverance, Curiosity, plus NASA's CCMC space-weather models. Every dataset is cited in the app (Sources tab) and in the README, with licences.

## 6. How it works

### 6.1 Terrain and trafficability
- The terrain model is resampled to a ~38 × 40 m routing grid (798 × 756 cells).
- Each cell keeps the **maximum slope** and the local relief from the original 20 m data, so steep features are not averaged away.
- **Terrain hazard (0–100)** combines four documented proxies:
  1. the geologic unit (from the Mars 2020 map);
  2. roughness from the terrain model;
  3. low thermal inertia (soft ground);
  4. slope between the caution (15°) and never-exceed (20°) limits.
- Ground steeper than **20°** (NASA's xEVA walking limit) or with hazard ≥ 85 is impassable.
- **Confidence per cell:** high (geology + thermal + terrain), medium (thermal + terrain) or low (terrain only). Areas the geology map doesn't cover (74% of the grid) are hatched on the map.

### 6.2 Walking effort and pace
- Walking energy uses the Minetti et al. (2002) metabolic cost of walking on slopes, multiplied by mass.
- Pace starts from NASA's ~2 km/h and slows on slopes (Tobler-style).
- **Uncertainty is shown as three cases:**
  - low (optimistic): Farley & McMahon 1992 reduced-gravity walking, scaled to Mars;
  - central: NASA IST-2 suited-walking data (Norcross et al. 2010);
  - high (pessimistic): full suit mass and slower pace.
- Effort is presented as an index and a range, never as a flight value.

### 6.3 Routing and the walk-back field
- Least-effort routing uses Dijkstra on an 8-neighbour grid, with 64-bit costs and a penalty for hazardous ground.
- A **walk-back field** gives the walking time from every cell back to the nearest safe haven: the habitat, plus a pressurized rover if one is parked. It takes about 0.3 s for the whole crater.

### 6.4 The planner (which stops, in what order)
- It solves an **orienteering problem** exactly, by branch and bound: maximise total science priority subject to all of these at once:
  1. planned EVA length (egress + walking + stations + ingress) ≤ 6 h;
  2. **walk-back criterion:** at every route cell, elapsed time + walk-back time ≤ consumables (8 h) − reserve (30 min);
  3. **radiation:** every point within the shelter-time limit for the current space-weather level (enforced by restricting the graph, so routes detour to stay inside);
  4. **daylight:** back inside before sunset minus a 45-minute margin (sunset from MEDA);
  5. slope and hazard limits.
- **Must-visit stops** can be pinned; custom stops added on the map are must-visit by default.
- Re-planning takes well under a second.

### 6.5 Verdict
- **GO** if every check is green, **CAUTION** if any is yellow, **NO-GO** if any is red.
- Checks: EVA length, walk-back criterion, radiation, daylight, steepest slope, peak terrain hazard, average walking effort, coldest air temperature, the space-weather policy, and whether the plan survives the pessimistic case.
- The **binding constraint** (the time limit with the smallest margin) is named and highlighted.
- The effective limit is min(consumables walk-back, radiation lead time, daylight).

### 6.6 Space weather
- **Live NASA CCMC DONKI WSA-Enlil** runs are filtered for predicted CME arrivals at Mars.
- **Quiet:** no arrival predicted within 72 h. No extra limit.
- **Watch:** arrival predicted in 24–72 h. Stay within 90 min of shelter (assumption, labelled).
- **Warning:** arrival within 24 h, or arrived in the past 12 h. Stay within **30 min** of shelter (from Löwe et al. 2025), and policy blocks starting a new EVA (NO-GO).
- **Labelled honestly** as "CME arrival alert (proxy for SEP risk)": the harmful solar particles can arrive before the CME shock. It shows the spread between model runs and notes MAVEN's loss.
- **Offline:** the app starts instantly from a saved snapshot, then switches to live data in the background. A badge shows "Live NASA feed" or "Cached · N days old".
- **Scenarios:** Quiet / Watch / Warning can be selected for what-if planning; they run the same logic as the live feed.

### 6.7 Mars time and conditions
- Mars24 algorithm (Allison & McEwen 2000; verified against NASA's worked example) gives:
  - local true solar time (LTST);
  - season (Ls);
  - the Perseverance mission sol (calibrated to the landing date);
  - solar declination, sun elevation and azimuth.
- Computed sunset agrees with MEDA-observed sunset within 25 minutes in all 12 seasons (unit test).
- **No live Jezero weather exists:** NASA's Perseverance weather feed ends in April 2024. MEDA climatology for the current season is used and clearly labelled "typical, not a forecast".

## 7. Features in the app

### 7.1 Plan mode (habitat planning display)
- Verdict box and space-weather selector, always visible at the top of the panel.
- **Six tabs:** Plan, Stops, Conditions, Layers, Evidence, Sources.
- **Checks list** with ✓ / ! / ✕ icons and a BINDING tag. A red box lists what a storm removed compared with quiet conditions.
- **Plan controls:** EVA start time (local solar time), effort/pace case, shelter-limit override.
- **Plan stats:** distance, EVA duration, farthest point from shelter, climb, walking effort, background radiation dose.
- **Walk-back margin chart:** time to shelter along the EVA against each limit (radiation, consumables, daylight, EVA end), with the binding limit drawn bold and the allowed region shaded.
- **Timeline** in local solar time: egress, each walk (distance, climb, max slope), each station, ingress, and the final margin.
- **Elevation profile** coloured by time to shelter.
- **Rover assistance:** park a pressurized rover as a second safe haven (anywhere on the map), and optionally start the EVA from it.
- **Sensitivity table:** does the same plan hold under low / central / high effort, and how many stops a re-plan would keep.
- **Export:** GeoJSON, GPX, printable EVA card (PDF).

### 7.2 Stops tab
- Stops are grouped by science objective.
- Each stop has an include tick, priority, minutes on station and a "must visit" tick. Custom stops also get a Remove button.
- A status chip on each stop says why it is in or out: "stop 2", "beyond 30-min shelter limit (84 min)", "too far for one EVA (round trip 9 h 18)", "not chosen: time used by higher-value stops".
- Click a stop to see its rationale, position source and Perseverance photos.
- **Add a custom stop:** click the map, choose "Add as science stop". The route re-plans through it, and a message confirms its place in the plan or explains why it can't fit.

### 7.3 Conditions tab
- Perseverance sol, UTC time, local solar time, sun elevation, season (Ls), sunset, typical air temperature, dust opacity (τ).
- Full space-weather explanation, with an expandable note on why a CME forecast is only a proxy.
- **Best EVA window chart:** MEDA air temperature through the day (mean and 10–90% range), night shading and the planned EVA window, plus the warmest 6-hour start time.

### 7.4 Layers tab: a layered, integrated view
- **Base maps:** NASA Trek CTX Jezero 6 m, CTX block-adjusted mosaic, offline CTX snapshot, Viking colour, MOLA+HRSC relief.
- **Overlays:** each is tagged with its data type and shows how it changes the plan on hover.
  - walk-back time to shelter
  - terrain hazard
  - max slope
  - photogeologic map
  - THEMIS thermal inertia
  - THEMIS IR day and night
  - MOLA elevation
  - Perseverance traverse
- **Walk-back overlay:**
  - inside the limit is clear, outside is dimmed;
  - 30-minute contour lines, with the limit edge in bright white;
  - **animated:** when the space-weather level changes, the safe zone smoothly shrinks or grows to the new limit.
- Collapsible legend; hover readout of coordinates, elevation, hazard and walk-back time; click any spot for a terrain explanation.

### 7.5 Evidence tab
- **What Walkback found:** a table of Quiet / Watch / Warning results (stops, value, EVA), and the walk-back time and hazard for every target.
- **Perseverance backtest** results, with an option to show the rover's real path and Walkback's routes on the map.

### 7.6 Sources tab
- Every limit from `config/policy.json` with its value, unit and source, marked **sourced**, **derived** or **assumed**.
- The three effort cases with their sources, the trafficability method, and what is not modelled.
- Full data credits.

### 7.7 Go mode (tablet / visor view)
- Full-screen map with a docked HUD (bottom sheet on tablets and phones).
- Big glove-friendly buttons (66 px) and large numbers.
- Shows: EVA clock in local solar time plus time elapsed; time to shelter now; time allowed now; margin (green / yellow / red); next activity; space-weather badge.
- A walk-back chart with a "now" line (on wide screens).
- A position slider (simulated), a ▶ Walk playback, and the map follows the crew marker.
- Go and Abort follow the plan committed when the EVA started, so a mid-EVA alert shows the crew's real position against the new, tighter limit.

### 7.8 Abort mode
- One tap. Shows the red dashed least-effort route to the nearest safe haven (habitat or rover).
- ETA, **buddy-assisted ETA** (one astronaut helping an injured partner, at 50% pace), distance, compass heading and radiation dose.
- If the position is beyond the current shelter limit, it says by how much.
- Click anywhere on the map to abort from another point.

### 7.9 3D view
- three.js terrain built from the DTM (2× height by default; 1× and 4× available), textured with the CTX image. It can also show the walk-back zone or hazard on the terrain.
- Sky colour and sun position from Mars24; daylight lighting with soft sun shadows.
- **Overview:** orbit camera with the route, stop markers and labels, habitat and rover.
- **Astronaut view:** a rehearsal of the plan at ground level.
  - **Two astronauts** (the buddy rule) in Artemis-style suits:
    - hard upper torso, bubble helmet, gold sun visor reflecting the sky, helmet lights and camera;
    - life-support backpack with vents and antenna, chest display and control module with dials;
    - bearing rings at the joints, gauntlet gloves, heavy boots;
    - crew colour stripes (orange leader, cyan buddy).
  - **Walking animation:** low-gravity springy gait, stiff suit arms, hip sway, stride rate matched to walking speed; they turn exactly at bends.
  - **Sampling scene at every stop:** the leader kneels and taps a rock hammer while the buddy turns to face them holding a sample bag. A survey flag in the objective's colour marks the stop.
  - **Pressurized rover model:**
    - crew cabin with windscreen and windows, six wheels;
    - two **suit ports** with docked suits;
    - roof solar panels, antenna dish, headlights.
  - **Cameras:** Follow (swings round to the side at stops so the sampling is visible), Front, First person.
  - **Playback speed:** real time, 10×, 60×, 150×. Stops and airlock time play faster than walking.
  - **HUD:** current activity ("Walking to…" / "On station: … N min left"), local time, EVA time, distance walked, effort, time to shelter vs allowed, slope, radiation dose, sun elevation, and suit/route warnings.
- Astronauts and the route line sit exactly on the rendered terrain; the route is smoothed so the crew walks curves instead of grid steps.

### 7.10 Demo mode
- **▶ Demo** runs a captioned story automatically: Quiet plan → Watch → Warning (stops drop, NO-GO) → Go at the farthest stop → Warning arrives mid-EVA → Abort with ETA → rover safe haven brings the delta stops back.
- It always uses the standard plan and restores the user's own settings afterwards.

### 7.11 Two sites
- **Jezero** (full pack): terrain, geology, thermal inertia, MEDA, traverse, backtest, photos.
- **Gale crater** (Curiosity), built with the same site-pack script:
  - streams a window of the 3.7 GB USGS 1 m HiRISE terrain model at 20 m in about 22 s, using its built-in overviews;
  - textured with the HiRISE colour mosaic;
  - 7 Curiosity drill sites from NASA's MSL waypoints (Yellowknife Bay, The Kimberley, Pahrump Hills, Marias Pass and more);
  - the app clearly labels what this terrain-only pack lacks.

### 7.12 Offline, formats and devices
- **Offline-first:** a service worker pre-caches the app, libraries (Leaflet, three.js; vendored, no CDN) and site data, and caches NASA tiles as they are viewed. A local imagery snapshot is the base map when offline.
- Data age is always shown.
- **Open formats:**
  - in: GeoTIFF/COG, shapefile/GeoJSON, JSON;
  - out: GeoJSON (route, stops with times, verdict and checks), GPX 1.1 (waypoints and track with elevation), and a printable A4 EVA card (map on the CTX image, timeline, checks, abort rule).
- **Responsive:** desktop, wide screen, tablet (1024 × 1366) and phone (390 px), with no horizontal scrolling.
- **Accessible:** keyboard shortcuts (1 / 2 / 3 for modes, V for 3D), visible focus outlines, reduced-motion support.
- Installable as an app (web manifest).

## 8. Key results (Jezero, central effort case, start 09:00 local solar time)

| Scenario | Stops | EVA | Verdict (binding limit) |
|---|---|---|---|
| Quiet | 5: Skinner Ridge, Wildcat Ridge, Hidden Harbor, Amalik outcrop, South Séítah | 5.8 h, 7.1 km | CAUTION (EVA length) |
| Watch (90 min) | 5 | 5.8 h | CAUTION (radiation) |
| Warning (30 min) | 3 crater-floor stops | 2.5 h, 1.9 km | NO-GO (radiation, policy) |
| Warning, EVA started from a pressurized rover at the delta | 4 delta stops, every point ≤ 17 min from a safe haven | 2.7 h, 1.6 km | NO-GO (policy); shows the solution |
| Quiet, from the rover | 6 stops | 5.7 h | CAUTION |
| Quiet, optimistic case | 7 stops | 5.9 h | CAUTION |
| Quiet, pessimistic case | 3 stops | 5.9 h | CAUTION |
| Quiet, late start (13:00) | 4 stops | 2.9 h | CAUTION (daylight) |

Other numbers:
- **9 of 13** targets fit a single 6-hour walking EVA. The 4 margin-carbonate targets need 7.8–10.8 h round trips, which makes the case for rover support.
- **Walk-back from the delta front:** 84–88 min to the habitat, but only 11–17 min with a rover parked at the delta.
- **Quiet → Warning removes** Skinner Ridge, Wildcat Ridge, Hidden Harbor and Amalik outcrop.

## 9. Validation and testing

### 9.1 Perseverance backtest
- **Data:** 26 real drive legs from Perseverance's traverse (sols 14–1947).
- **Traversability agrees:** 98.5% of the ground Perseverance actually drove is walkable in Walkback's model, and the rover's ground has the same median hazard as Walkback's routes (0.40).
- **Path choice:** route overlap with the rover's path is 80% within 100 m, vs 78% for a straight line, so it is **not better than a straight line**. Reported honestly: rovers and astronauts differ (wheels, rover hazard maps from 25 cm images, science detours).
- **Median steepest slope:** Walkback 11.1°, rover 11.7°, straight line 12.1°.

### 9.2 Automated tests
- **26 unit tests** (`npm test`):
  - effort model;
  - router: exact distances, walls, masks, hazard avoidance, walk-back direction, unreachable cells;
  - planner: limits enforced at every route cell, walk-back criterion, daylight, must-visit, verdict rules;
  - space-weather levels;
  - Mars24 against NASA's worked example, and sunset against MEDA.
- **Browser smoke test** (Playwright):
  - Jezero on desktop and tablet, and Gale;
  - verdicts, Warning → NO-GO with fewer stops and every route point within 30 min, exports, Go, Abort, 3D;
  - zero console errors.
- **Also checked:** the live Vercel deployment; demo captions never covering controls; and the astronauts measured at exactly 0.0 m above the rendered terrain.

### 9.3 Honesty and transparency
- **Every limit** in `config/policy.json` is marked sourced, derived or assumed, with its source.
- **Effort** is shown as a range.
- **The CME forecast** is labelled a proxy.
- **Positions** are marked approximate.
- **Weather** is climatology, labelled.
- **No endorsement** by NASA or experts is claimed.
- **Feedback kit:** `docs/FEEDBACK.md` has a request letter for experts and a log template.

## 10. Implementability

- **Site-pack builder:** `scripts/build_site_pack.py` builds any Mars site from a terrain GeoTIFF/COG, an orthoimage, a bounding box and a habitat point. It streams only the needed window of huge remote files. Proven with Gale.
- **Configurable policy:** one JSON file holds every limit (slope, pace, EVA length, consumables, reserve, airlock time, station time, sunset margin, cold limit, shelter limits per alert level, alert windows, buddy pace, hazard weights), so a mission sets its own flight rules.
- **Fits NASA's process:** Artemis con-ops explicitly calls for "smart traverse planning tools" to calculate daily walk-back distances.
- **Static site, no backend:** runs on any web host or offline on a tablet. Deployed on Vercel with auto-deploy from GitHub.
- **Honest readiness: about TRL 3** (research prototype on real data, not flight software). Real use would still need:
  - suit-specific consumables and Mars-gravity metabolic data;
  - 1 m HiRISE hazard maps;
  - an operational SEP nowcast;
  - live crew localization;
  - human-factors testing with analog crews (MDRS, HI-SEAS);
  - software assurance.

## 11. Technology

| Part | Technology |
|---|---|
| App | HTML, CSS, JavaScript (ES modules), no framework, no build step |
| 2D map | Leaflet 1.9.4 (EPSG:4326, NASA Trek WMTS) |
| 3D | three.js 0.160 (terrain mesh, PBR materials, soft shadows, environment reflections) |
| Planning engine | Custom JavaScript: Dijkstra router, walk-back field, branch-and-bound orienteering solver, Mars24 time; DOM-free and unit-tested |
| Offline | Service worker, web app manifest |
| Data pipeline | Python: rasterio/GDAL, numpy, pyshp, Pillow, openpyxl |
| Testing | Node test runner (26 tests), Playwright (browser smoke test) |
| Hosting | GitHub (public repo) + Vercel (static, auto-deploy) |

About 2,300 lines of app JavaScript in 15 modules, 9 data-builder and analysis scripts, 11 MB of processed site data.

## 12. Documentation in the repository

| File | Contents |
|---|---|
| `README.md` | What it is, how to run, data sources and licences, limitations, AI-use disclosure |
| `docs/PROBLEM.md` | User, decision, documented needs with sources, success measures, model reality check |
| `docs/COMPLIANCE.md` | Every challenge requirement mapped to a feature |
| `docs/VALIDATION.md` | Backtest, unit tests, assumptions table, known limits |
| `docs/IMPLEMENTATION.md` | Plan / Go / Abort workflow, formats, site packs, offline, readiness |
| `docs/PITCH.md` | One-page description and a video script |
| `docs/PRESENTATION_SCRIPT.md` | Click-by-click 3-minute script |
| `docs/CHEATSHEET.md` | Plain-language terms and likely questions |
| `docs/FEEDBACK.md` | Expert feedback request and log |
| `docs/CHECKLIST.md` | Everything unverified or approximate |
| `config/policy.json` | All limits with sources |
| `scripts/README.md` | How to rebuild every dataset |

## 13. Challenge requirements met (Interplanetary Survival Guide: Martian Map)

- **Explicit science objectives and site:** Jezero, three objectives, 13 real stops.
- **At least three data kinds, layered and used in decisions:** seven kinds (optical, topographic, geologic, thermal, atmospheric, radiation/space weather, rover ground truth).
- **Safety:** radiation, obstacles (rocks, sand, scarps), slope, consumables walk-back, daylight, cold, suit effort range.
- **Route map in 2D and 3D.**
- **Point-of-view images at destinations:** 39 real Perseverance images, plus a ground-level 3D walk.
- **Current conditions and time frame:** live NASA feed with age and fallback; now plus selectable scenarios and start time.
- **Formats:** habitat planning display, and a tablet "Go" view, tested at tablet size.
- **Optional considerations:** astronaut pairs (buddy rule, buddy-assisted ETA, two-person 3D crew) and rover assistance (pressurized rover safe haven, EVA from rover).
- **Challenge language** used in the app: "Marswalk", "layered, integrated view", "route", "current conditions".

## 14. Highlights for the submission

1. **A real NASA rule, built for Mars:** the walk-back constraint, checked at every point of the route.
2. **Instant re-planning on a real NASA storm forecast:** the animated safe zone shrinks, delta stops drop, the verdict turns NO-GO.
3. **The "why":** the binding limit is named, every dropped stop has a reason, every limit has a source.
4. **Real places and real images:** 13 Perseverance sample sites with 39 rover photos.
5. **Tested against reality:** 98.5% of Perseverance's driven ground is walkable in the model, and the limits of that test are stated openly.
6. **Rover solution:** a pressurized rover with suit ports brings the delta science back even during a storm warning.
7. **Ground-level rehearsal:** two suited astronauts walk the real route on real terrain and take samples at each stop.
8. **Works offline, on a tablet, in any browser;** open GeoJSON/GPX/PDF outputs.
9. **Works anywhere on Mars:** one script built Gale crater from a 3.7 GB NASA terrain model.
10. **Honest science:** assumptions labelled, uncertainty shown as ranges, no overclaiming.

## 15. Known limits

- **Terrain resolution:** the 20 m terrain model misses single boulders; the geology map covers 26% of the Jezero grid.
- **Effort:** based on Earth and lunar-gravity studies; no Mars-gravity suited data exist yet.
- **Assumptions:** the Watch limit (90 min), consumables (8 h), reserve, hazard scores and buddy pace.
- **Weather** is climatology, not a forecast. **Space weather** is a CME proxy for SEP risk.
- **Go-mode position** is simulated (no live crew tracking).
- **Not modelled:** suit thermal limits, terrain shadows, radio line of sight, and an unpressurized-rover mode.

## 16. AI-use disclosure

Built with substantial help from an AI coding assistant (Anthropic's Claude via Claude Code), which:
- wrote most of the code and documentation;
- found and processed the datasets;
- checked citations against source documents.

The team directed and reviewed the work and is responsible for it. All data are from the cited NASA, USGS and published sources; no data were generated by AI.

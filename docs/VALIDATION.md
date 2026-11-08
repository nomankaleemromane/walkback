# Validation

Everything here is reproducible: `npm test` (unit tests), `node scripts/backtest.mjs` (backtest), `node scripts/report.mjs` (case-study numbers), `python tests/smoke.py` (browser smoke test).

## 1. Perseverance backtest

**Question:** does Walkback's least-effort router send people over terrain that a real surface vehicle at Jezero found traversable, and does it pick similar paths?

**Data:** NASA/JPL MMGIS `M20_traverse.json` (official, sols 14-2022), clipped to the DEM.

**Method:**
1. Split the rover's real traverse into legs of at least 1,200 m driven, whose ends are at least 600 m apart.
2. Route Walkback between the leg ends (central case, terrain hazard on).
3. Compare the result with the real drive and with a naive straight line.

**Results**, default run: 26 legs, sols 14-1947.

| Metric | Walkback | Straight line | Rover |
|---|---|---|---|
| Share of the rover's path within 100 m of the route (median) | **80%** | 78% | - |
| Legs where Walkback overlaps more than the straight line | 42% | - | - |
| Median max slope on our 20 m DTM | 11.1° | 12.1° | 11.7° |
| Median mean terrain hazard | 0.40 | - | 0.40 |
| Rover-driven cells our model marks **impassable** | - | - | **1.5%** (5 of 26 legs touch one) |

Longer legs (≥ 3,000 m driven, ≥ 1,500 m apart, 9 legs) give the same picture: overlap 44% vs 45% for a straight line, rover cells blocked 1.5%.

**What this shows, honestly:**
- **Traversability agrees.** Walkback almost never forbids ground the rover actually drove (98.5% walkable), and it rates that ground at the same hazard level as its own routes.
- **Path choice does not agree better than a straight line.** Perseverance's route was set by science stops, by HiRISE-scale (25 cm) hazard maps and by wheel limits (it avoided sand). A 38 m energy-optimal walking route cannot reproduce that. Rovers and astronauts also differ: people step over rocks a rover cannot cross, and wheels handle long gentle grades better than legs.
- The rover's driven path is about 1.7× longer than Walkback's route (median length ratio 0.60): science detours and turnarounds.
- **What would validate path choice:** GPS tracks from suited analog EVAs (for example MDRS or BASALT-style campaigns) on a terrain model of the same resolution.

## 2. Model checks (unit tests, `npm test`, 24 passing)

| Area | Checks |
|---|---|
| Effort | Minetti flat cost 2.5 J/kg/m; clamped to valid range; low < central < high; 1 km flat = 30 min at 2 km/h |
| Router | Exact flat-line effort/time; Float64 costs; walls and masks respected; hazard steers the route; reverse (walk-back) field: downhill cheaper, next hop points home |
| Planner | All stops fit when they should; a 30-min limit drops far stops and **every route cell stays within 30 min**; walk-back criterion holds at every cell; late starts lose stops; NO-GO rules |
| Space weather | Mars-only impacts; UTC parsing; Quiet / Watch / Warning windows; shelter limits from policy; snapshot parses |
| Mars time | Mars24 worked example (Ls 277.19°, MST 23.997 h); Perseverance landing = sol 0; sun up at noon; **computed sunset within 25 min of MEDA-observed sunset in all 12 seasons** |

Browser smoke test (`tests/smoke.py`): Jezero at 1440×900 and tablet 1024×1366, plus Gale. It checks:
- verdicts, checks list, POV images and the backtest panel
- Warning → NO-GO with fewer stops, and the Warning plan stays within 30 min of shelter
- GeoJSON/GPX downloads, Go HUD, Abort ETA and 3D render
- no console errors

## 3. Assumptions table

| Parameter | Value | Basis | Source |
|---|---|---|---|
| Never-exceed slope | 20° | sourced | xEVA con-ops EVA-EXP-0042 Rev B p.38 |
| Caution slope | 15° | assumed | - |
| Walking pace | 2 km/h | sourced | EVA-EXP-0042 p.40 (lunar) |
| Planned EVA | 6 h | sourced | EVA-EXP-0042 p.89: 4-8 h (6±2) |
| Consumables capacity / reserve | 8 h / 30 min | assumed | upper end of 4-8 h; real suit values needed |
| Airlock egress + ingress | 30 min | assumed | - |
| Time on station | 20 min | assumed | - |
| Shelter limit, Warning | 30 min | derived | Löwe et al. 2025 (≥ 30 min nowcast lead time) |
| Shelter limit, Watch | 90 min | assumed | no agreed definition exists (Löwe et al. 2025) |
| Watch / Warning windows | 72 h / 24 h (+12 h after) | assumed | - |
| Back before sunset | 45 min margin | assumed | sunset from MEDA climatology |
| Cold caution | -60 °C | assumed | air temp from MEDA climatology |
| Effort reference | 469 W (1600 BTU/h) | assumed | carried over from the prototype; not verified |
| Effort low / central / high | k 0.73 / 1.0 / 1.0 × (body+suit) | sourced range | Farley & McMahon 1992; Norcross et al. 2010 (IST-2, NTRS 20110003409) |
| Pace low / high | +20% / -25% | assumed | - |
| Buddy-assisted pace | 50% | assumed | - |
| GCR dose rate | 0.64 mSv/day | sourced | Hassler et al. 2014 (Curiosity RAD) |
| Unit hazard scores | 0.0-0.9 per unit | assumed mapping | from Stack et al. 2020 unit descriptions |
| Soft-ground TI threshold | < 180 TIU | assumed | Jezero TI p5/p50/p95 = 170/234/315 (Edwards & Buz 2021) |
| Hazard route weight / block | 1.5 / 0.85 | assumed | - |
| Habitat location | Octavia E. Butler landing site | assumed | - |
| Science priorities | 4-10 | assumed demo values | a science team would set them |

## 4. Known limits

- **Terrain resolution.** The CTX DTM (20 m posts) resolves features of roughly 60-100 m. Single boulders and small scarps are invisible to it; the geology units and thermal inertia stand in for them as statistical proxies. A 1 m HiRISE DTM exists for parts of Jezero (USGS) and would be the next step.
- **Geology coverage.** The Mars 2020 photogeologic map covers 26% of the grid; elsewhere hazard comes from the DEM and thermal inertia only (hatched).
- **Effort.** Earth treadmill data with literature multipliers; Mars-gravity suited data were not found. Use as a relative index and as a range.
- **Space weather.** A CME arrival is a proxy for SEP risk; SEPs can precede the shock. No Mars SEP monitor since MAVEN's loss.
- **Weather.** No live Jezero weather exists. MEDA climatology is from past sols, not a forecast.
- **Not modelled:** suit thermal limits, terrain shadows and lighting, line-of-sight communications, dust-storm onset, medical events beyond a slowed walk-back.

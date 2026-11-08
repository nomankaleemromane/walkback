# From prototype to use

## Operational workflow: Plan → Go → Abort

| Phase | Who | When | Inputs that update | What Walkback gives |
|---|---|---|---|---|
| **Plan** | EVA planner + science lead, in the habitat | The sol before, then the morning of the EVA | Target list and priorities (science team); start time; space-weather outlook (DONKI, relayed); season (MEDA climatology); policy file | Ordered stops, timeline in local solar time, GO / CAUTION / NO-GO with the binding limit, sensitivity to the effort model, printable EVA card, GeoJSON/GPX |
| **Go** | EVA crew (2), tablet or visor; habitat IV crew follows | During the EVA | Position (simulated here; would come from rover/suit localization); alerts | EVA clock, time to shelter now, what the limits allow now, margin, next activity |
| **Abort** | Crew, one tap | Suit/medical problem or space-weather Warning | Current position | Least-effort walk-back route to the nearest safe haven, ETA, buddy-assisted ETA, heading, dose estimate |

How it would fit an Artemis-style process:
- The xEVA con-ops expects "smart traverse planning tools ... to calculate the appropriate distance during any given day" (EVA-EXP-0042 p.40). Walkback is that calculation for Mars, extended with space weather and season.
- Outputs are open files (GeoJSON, GPX, PDF card), so they can feed a mission's own timeline and GIS tools.
- The policy file is where flight rules would be set. Walkback does not decide rules; it applies them.

## Inputs and formats

| In | Format | Notes |
|---|---|---|
| Terrain | GeoTIFF / COG (equirectangular, Mars 2000 sphere) | Read with GDAL; remote COGs stream only the needed window |
| Imagery | GeoTIFF / COG or NASA Trek WMTS | Grey or RGB |
| Geology / hazard maps | Shapefile / GeoJSON polygons | Rasterized to the grid with a unit → hazard table |
| Thermal inertia | GeoTIFF | Averaged to the grid |
| Targets | JSON (lat, lon, objective, priority, station time, source) | Builder scripts make them from rover waypoints |
| Policy | `config/policy.json` | Every limit with value, unit, basis and source |
| Space weather | NASA CCMC DONKI JSON | Live, with a cached snapshot |

| Out | Format |
|---|---|
| Plan | GeoJSON (route, stops with times, verdict and checks in properties) |
| Plan | GPX 1.1 (waypoints + track with elevation) |
| EVA card | Print → PDF (route map on the local orthoimage, timeline, checks, abort rule) |

## Site packs: any site, one script

```
python scripts/build_site_pack.py scripts/sites/jezero.json
python scripts/build_site_pack.py scripts/sites/gale.json
```

A site config names a DEM, an optional orthoimage, a bounding box, a habitat point and a routing cell size. The builder produces:
- `dem.bin`
- `slope.bin` (max slope from the native-resolution DTM)
- `rough.bin`
- `texture.jpg`
- `site.json`

**Proof it generalises:** the Gale crater pack streams a window of the 3.7 GB MSL 1 m HiRISE DEM at 20 m in about 22 s, using its overviews, and textures it with the HiRISE colour mosaic. Seven Curiosity drill sites are added from NASA's MSL waypoints. Open it with `?site=gale` or the site menu. Gale has terrain only: no geology, thermal-inertia or MEDA layers yet, and the app says so.

## Offline-first

- Earth-Mars signal delay is minutes, so the crew tool must work with no link.
- A service worker pre-caches the app, libraries (Leaflet, three.js) and site data, and caches NASA Trek tiles as they are viewed (capped at 4,000).
- A local orthoimage snapshot is a base map that always works.
- The space-weather card shows "Live" or "Cached · N days old".

## Configurable policy

`config/policy.json` holds the following, each with value, unit, basis (sourced / derived / assumed) and source:
- slope limits
- pace
- EVA length
- consumables and reserve
- airlock overhead
- station time
- sunset margin
- cold limit
- effort reference
- masses
- shelter limits per alert level
- alert windows
- buddy-assisted pace
- hazard weights

The app reads it on start and lists it under "Assumptions, limits & sources".

## Readiness (honest)

**Technology readiness: about TRL 3** (analytical and experimental proof of concept): research prototype, real data, unit-tested model, no operational validation. **Not flight software.**

What adoption would still need:
1. **Suit-specific data:**
   - consumables (O2, CO2 scrubbing, power, cooling) as a function of metabolic rate
   - validated Mars-gravity suited walking cost and pace (the EVA Walkback Test was lunar 1/6 g only)
2. **Finer terrain:** 1 m HiRISE DTMs and rock-abundance maps where available (USGS has 1 m DTMs for Jezero), with uncertainty.
3. **Space weather:** an operational SEP nowcast (for example a RAD-like detector at the habitat) and a mission-approved time-to-shelter rule.
4. **Localization:** live crew/rover position instead of the simulated slider.
5. **Human factors:** testing of the Go/Abort UI with suited analog crews (gloves, visor, workload). Walkback's own validation is pending.
6. **Software assurance:** requirements, verification against independent tools (for example SEXTANT), configuration control of the policy file, and NASA software classification.
7. **Operations integration:** timeline tools, flight rules and comm windows.

## Known limits

- Effort is an index.
- Hazard scores per geologic unit are our mapping.
- A 38 m grid misses boulders.
- Rover path agreement is no better than a straight line (traversability agreement is good).
- No unpressurized-rover mode, no terrain shadowing, no comms line-of-sight, no suit thermal model.
- Shelter limits other than Warning are placeholders.

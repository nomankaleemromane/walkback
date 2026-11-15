# Challenge compliance: "Interplanetary Survival Guide: Martian Map"

Each item from the challenge brief, mapped to a visible feature. ✅ = built and tested; ◐ = partial; ✗ = not built (documented).

## Explicit science objectives and site

| Item | Status | Where |
|---|---|---|
| Site: Jezero crater, Perseverance field site | ✅ | header; `data/sites/jezero` |
| Objectives: (A) delta sediments, (B) margin carbonates, (C) crater-floor igneous rocks | ✅ | "Science objectives & stops" card |
| Every target tied to an objective; 13 real Perseverance sample sites with sample name, sol and position source | ✅ | target rows (click for rationale, source and images) |

## At least three kinds of data, layered and used in decisions

| Data kind | Dataset | How it changes the plan |
|---|---|---|
| Optical | MRO CTX 6 m (NASA Trek + USGS ortho), Viking, HiRISE colour (Gale) | base maps, 3D texture |
| Topographic | Mars 2020 TRN CTX DTM 20 m (USGS) | slope limit blocks cells; effort and pace; walk-back times |
| Geologic | Mars 2020 photogeologic map (Stack et al. 2020) | boulder, talus and megaripple units raise hazard; the router detours |
| Thermal | THEMIS thermal inertia (Edwards & Buz 2021); THEMIS day/night IR (Trek) | low TI flags soft ground (hazard) |
| Atmospheric | MEDA air temperature, Mastcam-Z dust opacity, sunset (Munguira/Hueso et al. 2024) | daylight limit; cold caution; best start time |
| Radiation / space weather | NASA CCMC DONKI WSA-Enlil (live + cached); RAD baseline | shelter-time limit; stops dropped; NO-GO |
| Rover ground truth | Perseverance traverse and raw images | backtest; point-of-view images |

Status: ✅ (7 kinds). All are in "Layered, integrated view"; the "kind" tag on each overlay names the data type.

## Safety first

| Hazard | Status | How |
|---|---|---|
| Radiation | ✅ | CME alert → shelter-time limit; routes kept inside it; RAD baseline dose shown |
| Obstacles: rocks, sand, scarps | ✅ | trafficability score; impassable cells; hazard check in the verdict |
| Suit mobility and load | ◐ | slope limit, effort range including suit mass; no suit joint model |
| Consumables walk-back | ✅ | walk-back criterion at every route cell |
| Thermal and daylight | ◐ | sunset limit, cold caution from climatology; no suit thermal model |

## Route map

| Item | Status | Where |
|---|---|---|
| Route that reaches the objectives and avoids obstacles | ✅ | cyan route; numbered stops |
| Route in 2D and 3D | ✅ | Leaflet map + three.js (toggle with **3D** or `V`) |

## Point-of-view images at destinations

| Item | Status | Where |
|---|---|---|
| Real Perseverance images, credited | ✅ | 39 raw Mastcam-Z/Navcam/Hazcam frames from the sampling sols, cached; click a target |
| POV in 3D | ✅ | Astronaut view: 1.7 m eye height walking the route, with HUD |

## Current conditions and time frame

| Item | Status | Where |
|---|---|---|
| Live feed with age and fallback | ✅ | DONKI live → cached snapshot; status pill shows "Live" or "Cached · N days old" |
| Clear time frame | ✅ | now (UTC, Perseverance sol, LTST, Ls, season) + scenarios (Quiet / Watch / Warning) + EVA start-time slider |
| Weather | ◐ | no live Jezero weather exists (NASA feed ends Apr 2024): MEDA climatology for this season, labelled |

## Format

| Item | Status | Where |
|---|---|---|
| Habitat planning display | ✅ | Plan mode |
| Tablet / HUD "Go" view, glove-friendly | ✅ | Go and Abort modes; 64 px buttons, 26 px numbers; tested at 1024×1366 |
| Offline | ✅ | service worker; vendored libraries; local imagery snapshot |

## Optional considerations

| Item | Status | Where |
|---|---|---|
| Astronaut pairs (buddy rule) | ✅ | buddy-assisted walk-back ETA in Abort |
| Rover assistance | ✅ | pressurized rover as second safe haven; EVA can start from the rover; Warning case keeps 4 delta stops |
| Unpressurized rover | ✗ | documented in IMPLEMENTATION.md |

## Challenge language

"Marswalk", "layered, integrated view", "route" and "current conditions" appear in the UI and in the pitch.

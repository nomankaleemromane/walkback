# Walkback: NASA Space Apps 2026 project submission (ready to paste)

Copy each section into the matching field on the Project page (My Team → Project → Edit).

- **Save progress often.**
- **Deadline:** Sunday 15 November 2026, 11:59 pm, your Local Event's time.

---

## Project Name

```
Walkback: the Mars EVA planner that always knows the way home
```

---

## High-Level Project Summary

```
Walkback is an interactive Martian map and planning tool that helps astronauts plan and carry out a safe Marswalk in Jezero crater, where NASA's Perseverance rover explores. It picks which real Perseverance sample sites to visit and in what order, and finds the least-effort walking route around steep slopes, boulder fields and soft sand. At every point of the route it checks that the crew can still walk back to shelter before their suit air, the daylight or a solar-storm shelter limit runs out, which is NASA's "walk-back" safety rule. It gives a clear GO, CAUTION or NO-GO verdict and names the limit that decides it.

When NASA's space-weather service forecasts a solar storm reaching Mars, Walkback re-plans in under a second: the safe zone shrinks, distant stops drop out and the verdict changes. A tablet view supports the crew during the walk, one tap gives the safest route home, and a 3D view lets the two-person crew rehearse the route on real terrain.

Walkback layers 10 datasets from 8 NASA missions into one decision: can we get home? This matters because the first astronauts on Mars will be minutes of radio delay from help, on rough ground, with no dedicated solar-particle monitor at Mars since MAVEN was lost.
```

---

## Link to Project Demo

7-slide presentation (PDF, public, no login):

```
https://github.com/nomankaleemromane/walkback/blob/main/presentation/Walkback_NASA_Space_Apps_2026.pdf
```

(PowerPoint version: https://raw.githubusercontent.com/nomankaleemromane/walkback/main/presentation/Walkback_NASA_Space_Apps_2026.pptx)

---

## Link to Final Project

```
https://walkback-nine.vercel.app
```

If the form allows only one link, use the one above. Source code: https://github.com/nomankaleemromane/walkback

---

## Detailed Project Description

```
WHAT IT DOES

Walkback is a layered, integrated Martian map for planning and carrying out a Marswalk (a spacewalk on the surface of Mars). It is built around one question every crew must answer at every moment: can we get home?

NASA's surface EVA rules (Apollo's "walkback constraint" and the Artemis xEVA Concept of Operations) require astronauts to always stay within walking reach of a safe haven, such as a habitat, lander or pressurized rover, before their suit consumables run out. Walkback turns that rule into a working plan for Mars, where help from Earth is 4 to 24 minutes away by radio and, since NASA's MAVEN orbiter was lost in 2026, crews depend on solar-storm forecasts made from Earth.

The mission: three science objectives in Jezero crater.
(A) Sample the delta's layered sediments, the best place to look for signs of ancient life.
(B) Reach the carbonate-bearing margin unit at the old lake shore.
(C) Examine the olivine-rich crater-floor rocks.
These are served by 13 real Perseverance sample sites (e.g. Wildcat Ridge, Amalik, Séítah, Bunsen Peak), each with its real sample name, NASA position and three real Perseverance photos from the day it was sampled.

HOW IT WORKS

1. Terrain and hazards. A 20 m terrain model of Jezero gives slope and roughness. Terrain hazard combines the Mars 2020 science team's geologic map (boulder-shedding rock, talus, sand-ripple fields), THEMIS thermal inertia (soft, loose ground), roughness and slope. Ground steeper than 20° (NASA's walking limit) is off-limits.

2. Effort and pace. Walking energy uses published metabolic-cost-of-walking data and slows on slopes. Because Mars-gravity suited data does not exist yet, effort is shown as a range (optimistic, central, pessimistic) and the plan is re-checked in the worst case.

3. Walk-back field. For every point of the crater, Walkback computes the walking time back to the nearest safe haven.

4. Planner. It chooses and orders science stops to maximise science value while checking, at every step of the route:
   - total EVA time against the 6-hour EVA;
   - elapsed time plus walk-back time against the suit consumables and reserve;
   - the radiation shelter-time limit;
   - getting back before sunset (Mars sunset from Perseverance's MEDA weather data);
   - slope and terrain limits.

5. Verdict. GO, CAUTION or NO-GO, with every check listed, the binding limit named, and a reason for every stop that was left out.

6. Space weather. Walkback reads NASA's CCMC DONKI forecasts (WSA-Enlil model) for solar storms (CMEs) arriving at Mars.
   - Quiet: no extra limit.
   - Watch: stay within 90 minutes of shelter.
   - Warning: stay within 30 minutes of shelter, based on a 2025 study of Mars radiation data showing a detector can give at least 30 minutes' warning; no new EVA starts.
   The tool clearly labels this as a proxy for solar particle risk.

THE APP

- Plan mode (habitat display): route map, numbered stops, timeline in Mars local time, walk-back margin chart, elevation profile, sensitivity table and current conditions (Perseverance sol, local solar time, season, sunset, typical temperature and dust from MEDA).
- Layers: optical, topographic, geologic, thermal, weather, radiation and rover data, each tagged with how it changes the plan.
- The walk-back safe zone animates when the space weather changes.
- Go mode (tablet / helmet-display view): large, glove-friendly numbers for time to shelter, time allowed and margin left, plus the next activity.
- Abort: one tap gives the safest route home, ETA, buddy-assisted ETA (helping an injured partner), heading and radiation dose.
- Rover assistance: a pressurized rover can be parked as a second safe haven. Starting the walk from it brings the delta science back even during a storm warning.
- 3D view: real Jezero terrain with the sun position and the route. Two astronauts in Artemis-style suits walk the route; at each stop one kneels to take a rock sample while the partner holds the sample bag (the buddy rule). Includes a pressurized rover with suit ports.
- Custom stops: click anywhere to add a science stop; the plan re-routes through it or explains why it cannot fit.
- Works offline. The crew tool must work without a link to Earth, so the app, data and the latest forecast are stored on the device, and data age is always shown.
- Open outputs: GeoJSON, GPX and a printable EVA card (PDF).
- Works on desktop, tablet and phone.
- Any site on Mars: one script builds a new site from NASA/USGS terrain data. A second site, Gale crater (Curiosity, home of the boxwork formations the brief mentions), was built from a 3.7 GB HiRISE terrain model.

RESULTS (Jezero, normal start at 09:00 local time)

- Quiet space weather: 5 stops, 5.8 h, 7.1 km, CAUTION (the walk uses almost the whole 6-hour EVA and crosses sand-ripple fields).
- Storm warning: 3 stops, NO-GO. The four delta-front stops drop out because they are 84 to 88 minutes from the habitat.
- Storm warning, walking from a rover parked at the delta: 4 delta stops, all within 17 minutes of shelter.
- 9 of 13 sites fit a single 6-hour walking EVA; the margin carbonates need rover support.

VALIDATION

- We tested the router against 26 real drives from Perseverance's path: 98.5% of the ground the rover actually drove is walkable in our model. Our routes do not match the rover's exact path better than a straight line, and we say so openly: rovers and humans choose paths differently.
- 26 automated tests check the planning maths, including the Mars clock against NASA's Mars24 reference example and computed sunset against Perseverance's measured sunsets.
- A browser test checks the full app on desktop, tablet and phone.
- Every limit is listed in one settings file with its source, marked as sourced, derived or assumed.

BENEFITS AND GOALS

Walkback gives mission planners and astronauts a single, explainable answer to a life-or-death question, instead of separate maps and spreadsheets. NASA's Artemis concept of operations itself calls for "smart traverse planning tools" to calculate safe walking distances each day; Walkback is that tool for Mars, with space weather and Mars weather built in. The same approach works for Artemis Moon walks and for training crews at Mars analog sites on Earth. It is an honest research prototype (about technology readiness level 3, not flight software). Next steps would be real suit consumables data, 1 m terrain hazard maps, a live solar-particle detector feed and field trials with analog crews.

TOOLS AND LANGUAGES

- JavaScript (ES modules), HTML and CSS; no framework.
- Leaflet for the 2D map (NASA Mars Trek tiles); three.js for 3D.
- A service worker for offline use.
- Python (rasterio/GDAL, numpy, pyshp, Pillow, openpyxl) to process the NASA and USGS data.
- Node test runner and Playwright for testing.
- Hosted on Vercel; code on GitHub.
```

---

## Use of Super Intelligence (SI)

Judges do not see this answer, but they do see any AI notes inside the project (the README has an AI-use section).

```
Yes. I used an AI coding assistant (Anthropic's Claude, through Claude Code) as a development tool. The project idea, concept and direction were mine: a Mars EVA planner built around NASA's walk-back safety rule, named Walkback, using Jezero crater, space weather and a crew view. I set the requirements and reviewed the work at each step.

The AI assistant helped me:
- write most of the code (planning engine, map, 3D view, tests) and the documentation;
- find, download and process the public NASA/USGS datasets;
- check scientific references and numbers against their source documents;
- design and build the slide deck from real screenshots of the app.

All data comes from the cited NASA, USGS and published scientific sources; no data was generated by AI. No AI-generated images, video or audio were used: every image in the app and slides is either real NASA/USGS imagery, a screenshot of the working app, or the project logo. The 3D astronauts and rover are built from simple shapes in code. The AI use is also disclosed in the project README.
```

---

## NASA Data

```
1. NASA Mars Trek (JPL) map tiles (WMTS): CTX Jezero 6 m orthomosaic, CTX Jezero block-adjusted mosaic, Viking MDIM 2.1 colour mosaic, MGS MOLA colour elevation, MOLA + HRSC shaded relief, Mars Odyssey THEMIS IR day and night mosaics. Used as base maps and context layers. https://trek.nasa.gov/mars

2. Mars 2020 Terrain Relative Navigation CTX Digital Terrain Model, 20 m, and CTX Orthomosaic, 6 m (Fergason et al. 2020, USGS Astrogeology; from NASA Mars Reconnaissance Orbiter CTX; doi:10.5066/P906QQT8, doi:10.5066/P9GV1ND3). Used for slopes, walking effort, walk-back times, the 3D terrain and the offline base map. These are the maps NASA used to land Perseverance.

3. Mars 2020 Science Team photogeologic map of the Perseverance field site (Stack et al. 2020, Space Science Reviews 216:127, doi:10.1007/s11214-020-00739-x; mapped on NASA MRO HiRISE images). Used to mark boulder fields, talus and sand ripples as terrain hazards.

4. THEMIS-derived thermal inertia of Jezero crater (Edwards & Buz 2021, doi:10.5281/zenodo.4931348; from NASA Mars Odyssey THEMIS). Used to flag soft, loose ground.

5. Perseverance MEDA weather station data (Hueso et al. 2024, doi:10.5281/zenodo.11198655; Munguira et al. 2024, JGR Planets), including Mastcam-Z dust opacity. Used for sunset times, typical temperatures, dust and the best EVA start time.

6. NASA CCMC DONKI space weather database, WSA-Enlil CME arrival forecasts (NASA Goddard Space Flight Center), live API https://ccmc.gsfc.nasa.gov/DONKI-API/ with a saved snapshot for offline use. Used to set the radiation shelter-time limit.

7. Perseverance (Mars 2020) official traverse and waypoint data (NASA/JPL-Caltech MMGIS). Used for science stop positions and to backtest the route planner against 26 real drives.

8. Perseverance raw images (Mastcam-Z, Navcam, Hazcam), NASA/JPL-Caltech (Mastcam-Z: NASA/JPL-Caltech/ASU), from the Mars Perseverance Raw Images gallery. 39 images used as point-of-view photos of each science stop.

9. Curiosity (Mars Science Laboratory) RAD surface radiation dose rate, about 0.64 mSv/day (Hassler et al. 2014, Science 343). Used for background radiation dose along the walk.

10. Curiosity (MSL) official waypoints (NASA/JPL-Caltech MMGIS), plus the USGS MSL Gale crater 1 m DEM mosaic and HiRISE colour mosaic (from NASA MRO HiRISE). Used for the second site, Gale crater.

NASA documents used for the safety rules: Exploration EVA System Concept of Operations (EVA-EXP-0042 Rev B, 2020): 20° walking slope, ~2 km/h pace, 4-8 h EVAs, walk-back to a safe haven. NASA "Surface EVA Architectural Drivers" (2024). NASA Apollo Lunar Surface Journal (Apollo 15 walkback constraint). NASA EVA Walkback Test (NASA/TP-2009-214796) and Integrated Suit Test 2 report (Norcross et al. 2010, NTRS 20110003409).
```

---

## Space Agency Partner Data and Other References

```
SPACE AGENCY PARTNER DATA
- ESA (European Space Agency): Mars Express HRSC (High Resolution Stereo Camera) data, part of the "MOLA + HRSC shaded relief" map layer served by NASA Mars Trek (credit ESA/DLR/FU Berlin).
- JAXA: the JAXA/Toyota pressurized "Lunar Cruiser" rover concept was a reference for the rover safe-haven idea (inspiration only, no data used).

SCIENTIFIC REFERENCES
- Löwe, J.L. et al. (2025) Nowcasting Solar Energetic Particle Events for Mars Missions. arXiv:2502.02469.
- Minetti, A.E. et al. (2002) Energy cost of walking and running at extreme uphill and downhill slopes. Journal of Applied Physiology 93:1039.
- Farley, C.T. & McMahon, T.A. (1992) Energetics of walking and running: insights from simulated reduced-gravity experiments. Journal of Applied Physiology 73:2709.
- Norcross, J.R. et al. (2010) Metabolic costs and biomechanics of inclined ambulation and exploration tasks in a planetary suit. NASA Technical Paper (NTRS 20110003409).
- Tobler, W. (1993) Three presentations on geographical analysis and modeling (hiking function).
- Allison, M. & McEwen, M. (2000) A post-Pathfinder evaluation of areocentric solar coordinates. Planetary and Space Science 48:215; NASA GISS Mars24 algorithm.
- Hassler, D.M. et al. (2014) Mars' surface radiation environment measured with the Mars Science Laboratory's Curiosity rover. Science 343.
- Stack, K.M. et al. (2020) Photogeologic Map of the Perseverance Rover Field Site in Jezero Crater. Space Science Reviews 216:127.
- Edwards, C.S. & Buz, J. (2021) THEMIS-derived Thermal Inertia of Jezero Crater, Mars. Zenodo.
- Hueso, R. et al. (2024) Derived environmental temperatures at Jezero crater (MEDA). Zenodo; Munguira, A. et al. (2024) JGR Planets.
- Fergason, R.L. et al. (2020) Mars 2020 Terrain Relative Navigation CTX DTM and orthomosaic. USGS Astrogeology.
- NASA (2020) Exploration EVA System Concept of Operations, EVA-EXP-0042 Rev B.
- NASA (2024) Surface EVA Architectural Drivers.
- Johnson, A.W. et al. (2011) SEXTANT, AIAA 2011-5181; Bickel, V.T. & Kring, D.A. (2024): existing lunar/analog EVA planning tools reviewed.
- NASA news on the loss of the MAVEN orbiter (contact lost December 2025, declared lost June 2026).

SOFTWARE AND TOOLS (all open source)
- Leaflet 1.9.4 (BSD-2-Clause): 2D map.
- three.js 0.160.0 (MIT): 3D view and OrbitControls.
- Python: rasterio and GDAL, numpy, pyshp, Pillow, openpyxl, SciPy (data processing).
- Node.js test runner and Playwright (testing).
- pptxgenjs, sharp, react-icons / Font Awesome icons (CC BY 4.0): slide deck.
- Vercel (hosting) and GitHub (source code): https://github.com/nomankaleemromane/walkback
- AI assistant: Anthropic Claude via Claude Code (see the SI section and the README).

IMAGES
- All maps and photos are NASA, NASA/JPL-Caltech, NASA/JPL-Caltech/ASU (Mastcam-Z), NASA/JPL/MSSS (CTX), NASA/JPL/University of Arizona (HiRISE), USGS Astrogeology, or ESA/DLR/FU Berlin (HRSC), credited in the app's Sources tab.
- Slide images are screenshots of the Walkback app.
- No copyrighted material is used without permission, and no images of people under 18.
```

---

## Images to upload on the Project page (optional, recommended)

The page accepts JPG/PNG/GIF up to 10 MB. Files are in `presentation/screenshots/`:

1. `1_plan_quiet.jpg`: the planned Marswalk under quiet space weather
2. `2_storm_warning.jpg`: the same plan after a solar-storm warning (safe zone shrinks)
3. `3_plan_screen.jpg`: the full planning screen with verdict and checks
4. `4_tablet_go_view.jpg`: the astronaut's tablet "Go" view
5. `5_3d_crew_sampling.jpg`: the 3D crew taking a sample
6. `6_rover_safe_haven.jpg`: the pressurized rover safe haven

---

## Final checklist before clicking "Submit for Judging"

1. Every required field is filled in, all in English.
2. Open the demo link and the project link in a **private/incognito window** to confirm they work without a login.
3. Tick **"I have read and understand the project submission requirements…"**.
4. Tick **"I confirm that the submitted project represents my team's original work…"**.
5. Click **Submit for Judging** and check for the green confirmation banner.
6. Optional but recommended: request a **FortiGuard Web Filter Classification** for walkback-nine.vercel.app, so judges' networks don't block it.
   - Category: "Web-based Applications" or "Education". Company name: "N/A".
   - Form: https://www.fortiguard.com/faq/wfratingsubmit
7. You can edit and resubmit until the deadline; only the last submission counts.

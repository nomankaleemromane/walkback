# Walkback presenter cheat sheet

Plain-language guide for presenting Walkback and answering judges' questions.

## Walkback in one sentence

A Mars spacewalk planner for Jezero crater that picks real science stops and the safest route, and checks at every step that the astronauts can still walk back to shelter, even when a solar storm is coming.

Tagline: **"Walkback: always know the way home."**

## The verdict box (GO / CAUTION / NO-GO)

Walkback's answer to "should this spacewalk go ahead as planned?". It comes from the **Checks** list in the Plan tab (green ✓, yellow !, red ✕).

| Verdict | Meaning | When it appears |
|---|---|---|
| **GO** (green) | Safe, with comfortable margins | Every check is green |
| **CAUTION** (yellow) | Allowed, but something is tight or uncertain | No red checks, at least one yellow |
| **NO-GO** (red) | Don't start this spacewalk | At least one red check |

**Why the normal plan says CAUTION:**
1. The walk uses 5.8 of the 6 planned hours (under 15 minutes spare).
2. Part of the route crosses rougher ground (hazard 60/100).
3. It would not fit if the astronauts walk slower than expected (pessimistic case).

**"Binding limit"** = the one limit closest to being broken, the one deciding how far the crew can go. Normally it's the planned EVA length; during a storm it's radiation shelter time.

## Space weather levels

The Sun sometimes throws out a huge cloud of charged particles (a **CME**). If one hits Mars, astronauts outside get extra radiation, so they must stay close to shelter.

| Level | What it means | What Walkback does |
|---|---|---|
| **QUIET** | No storm forecast to reach Mars in the next 3 days | No extra limit; only air, daylight and EVA length matter |
| **WATCH** | Storm forecast to reach Mars in 1–3 days | Stay within **90 min** of shelter (our assumption) |
| **WARNING** | Storm arriving within 24 h, or arrived in the last 12 h | Stay within **30 min** of shelter; no new spacewalk starts, so NO-GO |

The 30 minutes comes from a 2025 study (Löwe et al., arXiv:2502.02469): a radiation detector on Mars can give at least 30 minutes' warning before the worst of a storm.

## The space-weather dropdown

| Option | What it does |
|---|---|
| **Live NASA CCMC feed** | NASA's real current forecast |
| **Scenario: Quiet** | Pretend there's no storm (start your demo with this) |
| **Scenario: Watch** | Pretend a storm arrives in ~48 h |
| **Scenario: Warning** | Pretend a storm arrives in ~10 h |

Scenarios run exactly the same logic as the live feed; only the trigger is pretend.

**Shelter limit override** (Plan tab) forces a limit for what-if checks.

## The Conditions panel

| Item | Meaning |
|---|---|
| **Sol** | Day number of the Perseverance mission (a Mars day is 24 h 40 min) |
| **LTST** | Local solar time at Jezero (noon = Sun highest) |
| **Ls · season** | Where Mars is around the Sun, i.e. the season (0° = start of northern spring) |
| **Sunset** | Typical sunset time this season, from Perseverance's weather station |
| **Air temp** | Typical temperature now this season (not a live reading) |
| **τ (tau)** | Dust in the air: under 1 fairly clear, above 1 dusty |

## The 3D walk

It is **the plan itself, rehearsed at ground level**.

- **Route:** the two astronauts walk from the habitat (or the rover) to each real Perseverance sample site in order, then back home.
- **At each stop (20 min):** the leader (orange stripes) kneels and uses a rock hammer; the buddy (cyan stripes) holds the sample bag.
- **Two astronauts:** the buddy rule; NASA never sends one person out alone.
- **Panel at top left:** live time, distance, effort, time to shelter, slope and radiation dose along the plan.
- **Best settings for showing it:** 🧑‍🚀 Astronaut view → Front camera → 10× speed → ▶ Walk route.

## Terms to know

**Missions and places**
- **EVA (extravehicular activity):** a spacewalk; here, walking on Mars in suits.
- **Jezero crater:** the 45 km crater where Perseverance landed; once held a lake.
- **Delta:** where an ancient river dropped sediment into the lake; best place to look for signs of past life.
- **Séítah:** volcanic, olivine-rich rock on the crater floor.
- **Perseverance / Curiosity:** NASA rovers at Jezero / at Gale crater (our second site).
- **MAVEN:** NASA Mars orbiter that monitored solar particles; lost in 2026.

**Safety**
- **Walk-back:** NASA rule: always be able to walk back to shelter.
- **Safe haven:** any pressurized shelter: habitat, pressurized rover, lander.
- **Consumables:** what a suit runs out of: oxygen, battery, cooling water.
- **Buddy rule:** astronauts never go out alone.
- **Binding constraint:** the limit that decides the plan right now.
- **Margin:** spare time before a limit.

**Space weather**
- **CME (coronal mass ejection):** a huge burst of charged material from the Sun.
- **SEP (solar energetic particles):** the fast radiation particles that harm astronauts. They often arrive before the CME, so a CME forecast is a "proxy".
- **DONKI / CCMC:** NASA Goddard's space-weather forecast database and service.
- **RAD:** Curiosity's radiation detector; Mars background is about 0.64 mSv/day.
- **mSv (millisievert):** radiation dose unit. A chest X-ray is about 0.1 mSv.

**Data**
- **USGS:** US Geological Survey; makes planetary maps for NASA (including the maps used to land Perseverance).
- **CTX / HiRISE:** cameras on NASA's Mars Reconnaissance Orbiter; CTX made our terrain model.
- **DTM / DEM:** terrain height map; ours has a point every 20 m.
- **THEMIS:** heat camera on NASA's Mars Odyssey orbiter.
- **Thermal inertia:** how slowly ground heats and cools. Rock = high; loose sand = low (soft-ground risk).
- **MEDA:** Perseverance's weather station.
- **Geologic map:** rock-type map made by the Perseverance science team; marks boulder fields and sand ripples.

**Method**
- **Least-effort route:** path needing the least walking energy, avoiding steep and rough ground.
- **Effort case (low / central / high):** optimistic, expected and pessimistic estimates of suited walking effort on Mars.
- **Sensitivity:** checking the plan still works in the pessimistic case.
- **Backtest:** comparing our routes with where Perseverance actually drove.
- **Station / on station:** a 20-minute science stop.
- **Must visit:** a stop the planner is forced to include.

## Key numbers to remember

| Number | What it is |
|---|---|
| **10 datasets from 8 NASA missions** | Data layered in the app |
| **13** | Real Perseverance sample sites used as science stops |
| **5 stops → 3 stops** | Normal plan vs storm Warning |
| **30 min** | Storm Warning shelter limit (from the 2025 study) |
| **84 min** | Walk-back time from the delta stops to the habitat |
| **4 delta stops** | Kept during a Warning when the crew starts from a rover |
| **98.5%** | Ground Perseverance drove that our model rates walkable |
| **under 1 second** | Time to re-plan when conditions change |

## Likely judge questions

**"Why CAUTION and not GO?"**
The plan uses almost the full 6 hours, so the margin is small, and it wouldn't fit if the crew walks slower. We'd rather flag that honestly.

**"Is the storm real?"**
The feed is live NASA data. There's no storm heading to Mars today, so we demonstrate with a scenario that runs the same logic.

**"Where does 30 minutes come from?"**
A 2025 study on Mars radiation data: a detector can give at least 30 minutes' warning.

**"Is the 90-minute Watch limit real?"**
No, it's our assumption and labelled as such. There is no agreed NASA rule for Mars yet; that study says so too.

**"How accurate is the walking effort?"**
It's based on Earth walking studies, so we show a range and check the plan still works in the worst case.

**"Is this real data?"**
Yes: NASA and USGS, all listed in the app's Sources tab.

**"Does it work offline?"**
Yes. It uses the live forecast when connected, and the last saved forecast, labelled with its age, when not. On Mars you won't always have a link.

**"Does it work elsewhere on Mars?"**
Yes. One script builds a new site; we built Gale crater (Curiosity) the same way.

**"Who would use it?"**
The mission planner in the habitat the day before, and the astronauts on a tablet during the spacewalk.

**"What's missing?"**
Real suit data, finer terrain maps, and testing with analog crews. It's a research prototype, not flight software.

## Before you present

1. Run `python scripts/fetch_donki.py` (refreshes the saved forecast), then `python -m http.server 8000`.
2. Open http://localhost:8000 in Chrome, press Ctrl+Shift+R, then F11.
3. Warm up 3D: click **3D**, wait for the terrain, click **2D**. Then press F5.
4. Set the dropdown to **Scenario: Quiet**. Check it shows **CAUTION · 5 science stops · 5.8 h · 7.1 km**.
5. Have a recorded backup video ready.

# Pitch

## One-page project description (for the submission form)

**Walkback: the Mars EVA planner that always knows the way home.**

The first humans on Mars will walk out of a habitat to do science. NASA's surface-EVA rules say one thing above all: never go farther than you can get back from. Apollo called it the walkback constraint, and Artemis keeps crews within reach of a safe haven on emergency consumables. On Mars the question is harder:
- signal delay means no real-time help from Earth;
- the terrain is rough and sandy;
- since MAVEN was lost in 2026 there is no Mars solar-particle monitor, only CME forecasts from Earth.

Walkback is a layered, integrated Marswalk map for Jezero crater that turns that rule into a plan. It combines seven kinds of NASA and USGS data:
- CTX images and a 20 m terrain model
- the Mars 2020 science team's geologic map
- THEMIS thermal inertia (to spot soft sand and rocky ground)
- MEDA weather climatology
- live NASA CCMC space-weather forecasts
- Perseverance's real traverse and images

From these it:
1. Finds the least-effort walking route around boulders, megaripples and steep slopes.
2. Computes, for every metre of ground, how long it takes to walk back to shelter.
3. Picks and orders science stops (real Perseverance sampling sites) to maximise science while three limits hold at every point: consumables walk-back, radiation shelter time and daylight. It shows which limit binds.

When a CME is forecast, the plan re-solves in under a second. Under a Warning, the crew must stay within 30 min of shelter, the time a radiation nowcast can give. The delta stops drop out and the verdict turns NO-GO. In Go mode a tablet "visor" view shows time to shelter. One tap on Abort gives the walk-back route and ETA, including a slower ETA when helping an injured partner. Driving a pressurized rover to the delta brings the delta science back even under a Warning.

We are honest about the model:
- Every limit lives in a policy file marked sourced or assumed.
- Effort is shown as a range, not a flight value.
- We backtested the router against Perseverance's real drives: 98.5% of the ground the rover drove is walkable in our model, but our routes match the rover's path no better than a straight line, and we say so.

It runs offline as a web app, exports GeoJSON/GPX and a printable EVA card, and a one-script site-pack builder already produced a second site (Gale crater).

## 3-minute video script (uses the in-app ▶ Demo)

| Time | Shot | Voice-over |
|---|---|---|
| 0:00-0:15 | Title card over the 3D Jezero overview | "On Mars, the most important question on a spacewalk is: can we get home? Walkback answers it, metre by metre." |
| 0:15-0:35 | 2D map, layers panel: toggle geology, thermal inertia, hazard | "We layer seven kinds of NASA data: orbital images, a 20-metre terrain model, the Mars 2020 geologic map, THEMIS thermal inertia, MEDA weather, live space weather, and Perseverance's own traverse." |
| 0:35-0:55 | Walk-back zone overlay; hover readout | "From every point we compute the least-effort walk back to the habitat. Green is inside today's limit; the white line is the edge." |
| 0:55-1:20 | ▶ Demo step 1: Quiet plan, timeline, walk-back margin chart | "Walkback picks real Perseverance sample sites (Wildcat Ridge, Amalik, Séítah) and orders them so the walk-back rule holds every minute. The chart shows time to shelter against what consumables, radiation and daylight allow. Here the EVA length binds: CAUTION." |
| 1:20-1:40 | Demo steps 2-3: Watch → Warning; dropped stops listed | "A CME is forecast. Under a Warning the crew must stay within 30 minutes of shelter, the warning time a radiation nowcast can give. The delta drops out. Policy says NO-GO." |
| 1:40-2:05 | Demo steps 4-5: Go (tablet view) → Abort | "Mid-EVA at the delta, the alert comes in. One tap: the walk-back route, ETA one hour 24, two hours 48 if helping an injured partner." |
| 2:05-2:20 | Demo step 6: rover safe haven | "Drive a pressurized rover out and walk from it, and the delta science comes back, even under the Warning." |
| 2:20-2:40 | 3D astronaut view walking the route with HUD | "In 3D, walk the route at eye height with the clock, effort, dose and time to shelter." |
| 2:40-2:55 | Backtest panel, assumptions panel | "We test ourselves. 98.5% of the ground Perseverance drove is walkable in our model, but our routes don't match its path better than a straight line, and we say so. Every limit is sourced or labelled as assumed." |
| 2:55-3:00 | Logo | "Walkback. Always know the way home." |

Recording tips:
- Run `python -m http.server 8000` and use Chrome at 1440×900.
- Click ▶ Demo. Each caption stays 6-8 s; record the screen and narrate over it.
- For the Go/Abort shots, use device emulation at 1024×1366 (tablet).

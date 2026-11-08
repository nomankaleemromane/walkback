# The problem Walkback solves

## User and decision

**Who:** the EVA planner in the habitat (the day before and the morning of an EVA) and the two-person EVA crew (during it, on a tablet or visor display).

**The decision:** *Which science stops can we reach and return from safely, in what order, under today's conditions, and what do we do if conditions change?*

**Inputs they have:** a terrain model, orbital images and maps of the site, the science team's target list and priorities, suit and consumables limits, the season and time of day, and the space-weather outlook relayed from Earth (minutes of signal delay, sometimes no link).

**What changes because of Walkback:**

| Without | With Walkback |
|---|---|
| Separate tools for terrain, images, weather and space weather; limits checked by hand | One layered view; every limit checked at every point of the route |
| A plan made once and re-planned by hand when a CME alert comes in | Plan re-solves in under a second; dropped stops and the reason are listed |
| "How far are we from home?" answered by straight-line distance | Least-effort walk-back time over real terrain, from every point, to the nearest safe haven |
| Effort/pace treated as one number | A low/central/high range; the plan says whether it survives the pessimistic case |

## Documented needs (sources checked Nov 9, 2026)

1. **The walk-back criterion is an operational rule, not our invention.**
   - Apollo 15 traverse planning limited the return distance by "the walkback constraint (LRV failure)", defined by PLSS consumables remaining for a walking return to the LM (NASA Apollo Lunar Surface Journal document 19790073512).
   - NASA's xEVA System Concept of Operations (EVA-EXP-0042 Rev B, Oct 2020):
     - Crews "will always stay within a range that allows them to get to a safe haven (lander, habitat, or pressurized rover)" (p.40).
     - It assumes a ~2 km/h walking pace and an unpressurized rover kept within "a 5-hour walk back to the lander ... approximately 10 km" (p.40).
     - It calls for lighting and communications for "up to a 12,000 m contingency walk-back" (p.44, 46).
     - It sets walking on slopes "up to 20°" (p.38) and planned excursions of 4-8 h (6±2 h, p.89).
     - It notes that walk-back distances "do[es] not account for slope or obstacles (e.g., boulders)" and that "Smart traverse planning tools will be utilized to calculate the appropriate distance during any given day" (p.40).
   - NASA "Surface EVA Architectural Drivers" (2024, p.4): EVA ranges must "provide the crew access to a pressurized safe haven within the limits of emergency consumables in the event of a suit failure or medical event."
2. **Time-to-shelter for radiation on Mars is an open question.** Löwe et al. (2025, arXiv:2502.02469) note "the current lack of a unified definition for the time needed to reach safety once an SEP event has already impacted an astronaut". Their RAD-based nowcast can give astronauts "at least 30 minutes" to avoid the SEP peak and most of the dose, and "just over 50 minutes" for the largest surface event (20 May 2024).
3. **There is no dedicated Mars SEP monitor now.** MAVEN lost contact in December 2025 and NASA declared it lost on June 3, 2026. CME arrival predictions (NASA CCMC DONKI WSA-Enlil) and Curiosity RAD are what remain.
4. **Terrain beyond slope matters.** The xEVA con-ops warns that boulders reduce walk-back range. The Mars 2020 photogeologic map describes "boulder-shedding" delta mesas, rim units that "erode to boulders", talus of "m-scale boulders" and megaripple fields (Stack et al. 2020).
5. **Existing tools.**
   - SEXTANT (MIT) plans suited traverses, can compute the "walkback" home from any point, and was tested at MDRS and in the BASALT analog campaigns. At MDRS, actual traverse times were significantly longer than predicted (Johnson et al., AIAA 2011-5181; Norheim, MIT thesis).
   - Bickel & Kring (2024) compute minimum-metabolic-workload walking paths for Artemis from lunar LOLA data.
   - **We did not find** a tool that combines terrain walk-back with Mars space-weather alerts, Mars surface weather climatology, Mars geology and thermal-inertia trafficability, and offline use on a tablet. (The brief also named PersEIDS, AEGIS and NaviGATOR; we did not verify these.)

## Success measures, with results from real runs

Results: `node scripts/report.mjs` → [results.json](results.json). Jezero, central effort case, start 09:00 local solar time, season Ls ≈ 19°.

| Measure | Result |
|---|---|
| Science targets (13 real Perseverance sample sites) reachable on a single 6 h walking EVA from the landing-site habitat | 9 of 13. The 4 margin/Neretva targets need a 7.8 to 10.8 h round trip. |
| Stops planned: Quiet → Watch (90 min) → Warning (30 min) | 5 → 5 → 3 (value 38 → 38 → 17); Warning is NO-GO by policy |
| Walk-back time to the delta-front targets | 84 to 88 min from the habitat; 11 to 17 min with a pressurized rover at the delta |
| Warning, EVA started from a rover at the delta | 4 delta stops, every point ≤ 17 min from a safe haven |
| Plan robustness | The central quiet plan fails under the pessimistic effort/pace case, so the verdict is CAUTION, not GO |
| Agreement with Perseverance traverse (26 legs) | 98.5% of cells the rover drove are walkable in our model. Route overlap 80% vs 78% for a straight line, so path agreement is not better than naive. See [VALIDATION.md](VALIDATION.md). |
| Computed sunset vs MEDA-observed sunset | Within 25 min in all 12 seasons (unit test) |

## Reality check on our own model, and what we changed

| Gap in the prototype | What we did |
|---|---|
| Hazard was slope only | Trafficability now combines 4 proxies: (1) Mars 2020 photogeologic map units (boulder/talus/megaripple units score high), (2) THEMIS thermal inertia (low TI = soft ground), (3) 20 m DTM roughness, (4) slope. Where the geology map does not reach (74% of the grid), the map is hatched and confidence is lower. |
| Effort used Earth treadmill data and a fixed pace | Low/central/high range from Farley & McMahon 1992 (reduced gravity) and NASA IST-2 suited data (Norcross et al. 2010). The plan is re-checked under each case. The EVA Walkback Test was lunar gravity only; we found no Mars-gravity suited data and say so. |
| Storm response multiplied a baseline by 0.15 (9 min) | Warning = 30 min, from the published nowcast lead time; Watch = 90 min (labelled assumed). Effective limit = min(consumables walk-back, radiation, daylight), and the binding one is shown. |
| No consumables rule | Walk-back criterion: elapsed + walk-back ≤ consumables − reserve at every point |
| Pair of crew | Buddy-assisted walk-back ETA at 50% pace (assumed) in Abort mode |
| Glove-friendly, no connection | Go/Abort modes with 64 px buttons and large type; offline service worker; cached feeds labelled with age |

## Honest readiness

| | Status |
|---|---|
| Terrain (CTX DTM 20 m), imagery, geology map, thermal inertia, traverse, raw images, MEDA climatology | **Real data**, cited |
| Router, walk-back field, orienteering solver, Mars24 time, alert logic | **Implemented and unit-tested** (24 tests) |
| Shelter limits: Warning 30 min | **Derived** from a published nowcast study, not a NASA requirement |
| Watch 90 min, consumables 8 h, reserve, hazard scores per unit, buddy pace 50%, effort reference 469 W | **Assumed** placeholders in `config/policy.json` |
| Effort values | **Index only**, not flight values |
| Rover path agreement | **Not demonstrated** (no better than a straight line). Traversability agreement is good. |
| Adoption would still need | Suit-specific consumables and metabolic models; a HiRISE-scale (1 m) hazard layer; validation with analog crews; integration with a real space-weather/RAD nowcast; human-factors testing of the Go/Abort UI; software assurance |

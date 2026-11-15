# Unverified or approximate: final checklist

Check these before submission (Nov 14-15, 2026).

## Data and positions

- [ ] **Target positions are approximate.** Each is the rover's last localized waypoint on or before the sample's sealing sol, not the exact core location (typically tens of metres off).
- [ ] **Gale drill sols** (John Klein 182, Cumberland 279, Windjana 621, Confidence Hills 759, Mojave 882, Telegraph Peak 908, Buckskin 1060) were not checked against NASA's list.
- [ ] **Habitat location** (Octavia E. Butler landing site) is an assumption.
- [ ] **Target rationale lines** are short paraphrases. Check against NASA sample pages, especially:
  - Wildcat Ridge "strongest organic signal"
  - Cheyava Falls "potential biosignature reported by NASA (2025)"
- [ ] **Geology supplement licence.** The article is CC BY 4.0, but the ESM README says "All rights reserved". We ship only a derived raster; consider asking the authors.
- [ ] **Geology alignment.** The geology map was drawn on HiRISE; not checked against the CTX grid beyond visual overlay.
- [ ] **MEDA climatology** mixes rover locations over ~1,000 sols; Ls binning is 30°.

## Model and policy

- [ ] **Effort reference 469 W** (1600 BTU/h) has no verified source.
- [ ] **Shelter limit Watch = 90 min**, Watch/Warning windows (72/24/12 h), **consumables 8 h / reserve 30 min**, airlock 30 min, station 20 min, buddy pace 50%: all assumptions.
- [ ] **Low-effort multiplier 0.73** is our interpolation of Farley & McMahon (1992) to 0.38 g, and that method has been questioned (later studies found smaller reductions).
- [ ] **Central effort case** relies on lunar-gravity IST-2 inclined-walking data (Norcross et al. 2010), not Mars.
- [ ] **Hazard scores** per geologic unit and the soft-ground TI threshold (180) are our judgement.
- [ ] **Sun position:** the 3D sky uses the declination for "now" with the EVA's local time; the MEDA sunset is used for the daylight limit.

## Not found / not used (from the brief)

- [ ] "Shelter assembly within 30 min", "<10 mSv over 2 h", "40 / 25 / 250 mSv design SPE": not found in arXiv 2502.02469; not used.
- [ ] EVA Walkback Test (NASA/TP-2009-214796) is **lunar only**; the brief said lunar and Mars.
- [ ] PersEIDS, AEGIS, NaviGATOR were not verified; SEXTANT and Peña-Asensio et al. 2024 (with Bickel & Kring) were.
- [ ] No official CRISM mineral map layer was integrated; the photogeologic map is the geologic/compositional layer.

## Operations

- [ ] Re-run `python scripts/fetch_donki.py` before recording, so the cached snapshot is fresh.
- [ ] Run `python tests/smoke.py` and `npm test` on the final commit.
- [ ] Deploy to GitHub Pages and test offline (load once, go offline, reload).
- [ ] Expert feedback: none yet ([FEEDBACK.md](FEEDBACK.md)).

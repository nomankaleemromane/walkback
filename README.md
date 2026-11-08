# Marswalk Planner: Jezero Crater

Layered Marswalk route planner on live NASA Mars Trek tiles (Leaflet) plus a USGS CTX DEM for slope and hazard.

## Run (2 minutes)
1. `pip install rasterio numpy` then `python make_dem.py` (downloads a ~20 m Jezero DEM, writes `dem.json` + `dem.bin`). Use `python make_dem.py full` for the whole crater.
2. `python -m http.server 8000` in this folder, open http://localhost:8000
3. To host: upload the folder (index.html, dem.json, dem.bin) to GitHub Pages or Netlify.

## Data
- Imagery: NASA Mars Trek WMTS at `https://api.nasa.gov/mars-wmts/catalog/{layer}/1.0.0/default/default028mm/{level}/{row}/{col}.jpg` (Viking, MOLA, MOLA+HRSC, THEMIS). 
- Terrain: USGS/Mars 2020 CTX DEM (MRO CTX stereo, 20 m). Slope and hazard are computed in the browser.
- CTX/HiRISE Jezero mosaics: copy the layer ID from the Trek WMTS GetCapabilities (trek.nasa.gov/mars) into "Add Trek layer".

## Must verify before you submit
- Tile zoom limits are estimates; if a layer looks blurry or blank, change the max zoom number (Leaflet zoom = WMTS level + 1). The status line counts missing tiles.
- Check `make_dem.py` printed bounds against the USGS page.
- POI positions are approximate. Conditions are typical reference values, not live MEDA/RAD data. Walk speed, 15° limit and 6 h EVA are assumptions.
- I could not test the tile requests from my environment, so run it once and check the layers load.

## Pitch (30 s)
"A first Marswalk needs one view, not ten tabs. We layer Odyssey THEMIS, MGS MOLA, HRSC and MRO CTX data over Jezero, compute slope and hazard from a 20 m DEM, and score any route for distance, EVA time, steepness and science stops, so crews can choose a path that is both safe and worth walking."

If this is NASA Space Apps, disclose that AI assisted with the code.

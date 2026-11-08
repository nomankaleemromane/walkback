// Terrain grid + trafficability (hazard) model. Pure functions, no DOM.
//
// Hazard H in [0,1] per cell combines four documented proxies:
//   geo   - geologic unit score (Stack et al. 2020 photogeologic map; scores are our assumption)
//   rough - local relief at 20 m from the CTX DTM (|z - 3x3 mean|): scarps, rims, rough ground
//   soft  - low THEMIS thermal inertia (Edwards & Buz 2021): fine loose material, soft-ground risk
//   slope - footing difficulty between the caution slope and the never-exceed slope
// H = 1 - (1-geo)(1-0.8 rough)(1-soft)(1-slope). Cells steeper than the limit, or with
// H >= hazard_block, are impassable. Confidence: 3 = geology+TI+DEM, 2 = TI+DEM, 1 = DEM only.

export const KIND = { none: 0, rock: 1, soft: 2, steep: 3 };

export function buildTerrain(site, raw, traffic, policy) {
  const { w, h } = site, n = w * h, P = policy.params;
  const Z = raw.dem, slope = new Float32Array(n), rough = new Float32Array(n), H = new Float32Array(n);
  const pass = new Uint8Array(n), conf = new Uint8Array(n), kind = new Uint8Array(n);
  const cGeo = new Uint8Array(n), cRough = new Uint8Array(n), cSoft = new Uint8Array(n), cSlope = new Uint8Array(n);
  const bedHaz = new Float32Array(64), surfHaz = new Float32Array(64), bedKind = new Uint8Array(64), surfKind = new Uint8Array(64);
  if (traffic) {
    for (const u of traffic.bed_units) { bedHaz[u.id] = u.hazard; bedKind[u.id] = KIND[u.kind] || 0; }
    for (const u of traffic.surf_units) { surfHaz[u.id] = u.hazard; surfKind[u.id] = KIND[u.kind] || 0; }
  }
  const maxS = P.max_slope_deg.value, cauS = P.caution_slope_deg.value, block = P.hazard_block.value, softMax = P.soft_ti_max.value;
  for (let k = 0; k < n; k++) {
    if (Z[k] <= -32768 || raw.slope[k] === 255) { slope[k] = -1; H[k] = 1; continue; }
    const s = raw.slope[k] / 4, r = raw.rough[k] === 255 ? 0 : raw.rough[k] / 10;
    slope[k] = s; rough[k] = r;
    const b = raw.geo_bed ? raw.geo_bed[k] : 0, sf = raw.geo_surf ? raw.geo_surf[k] : 0;
    const geo = Math.max(bedHaz[b] || 0, surfHaz[sf] || 0);
    const rh = Math.min(1, Math.max(0, (r - 1) / 4));
    const ti = raw.ti ? raw.ti[k] : 0;
    const soft = ti > 0 && ti < softMax ? Math.min(1, (softMax - ti) / 60) * 0.6 : 0;
    const sh = Math.min(1, Math.max(0, (s - cauS) / (maxS - cauS))) * 0.5;
    const hz = 1 - (1 - geo) * (1 - 0.8 * rh) * (1 - soft) * (1 - sh);
    H[k] = hz;
    cGeo[k] = geo * 255; cRough[k] = rh * 255; cSoft[k] = soft * 255; cSlope[k] = sh * 255;
    pass[k] = s <= maxS && hz < block ? 1 : 0;
    conf[k] = b > 0 ? 3 : ti > 0 ? 2 : 1;
    // dominant hazard kind for the legend
    const kr = Math.max(bedKind[b] === 1 ? bedHaz[b] : 0, surfKind[sf] === 1 ? surfHaz[sf] : 0, 0.8 * rh);
    const ks = Math.max(surfKind[sf] === 2 ? surfHaz[sf] : 0, soft);
    kind[k] = s > maxS ? KIND.steep : Math.max(kr, ks) < 0.3 ? 0 : kr >= ks ? KIND.rock : KIND.soft;
  }
  return {
    w, h, n, site,
    cx: site.cell_x, cy: site.cell_y,
    Z, slope, rough, H, pass, conf, kind, ti: raw.ti || null,
    geoBed: raw.geo_bed || null, geoSurf: raw.geo_surf || null,
    comp: { geo: cGeo, rough: cRough, soft: cSoft, slope: cSlope },
  };
}

// ---- coordinates
export function llToCell(T, lat, lon) {
  const s = T.site;
  const i = Math.floor(((lon - s.west) / (s.east - s.west)) * T.w), j = Math.floor(((s.north - lat) / (s.north - s.south)) * T.h);
  return i < 0 || j < 0 || i >= T.w || j >= T.h ? -1 : j * T.w + i;
}
export function cellToLL(T, k) {
  const s = T.site, i = k % T.w, j = (k / T.w) | 0;
  return [s.north - ((j + 0.5) / T.h) * (s.north - s.south), s.west + ((i + 0.5) / T.w) * (s.east - s.west)];
}
// nearest passable cell within R cells (Euclidean), or -1
export function nearestPassable(T, k, R = 25, allow = null) {
  if (k < 0) return -1;
  const cx = k % T.w, cy = (k / T.w) | 0;
  let best = -1, bd = Infinity;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= T.w || y >= T.h) continue;
    const q = y * T.w + x, d = dx * dx + dy * dy;
    if (T.pass[q] && (!allow || allow[q]) && d < bd) { bd = d; best = q; }
  }
  return best;
}
export function cellDistM(T, a, b) {
  return Math.hypot(((b % T.w) - (a % T.w)) * T.cx, (((b / T.w) | 0) - ((a / T.w) | 0)) * T.cy);
}

// Describe why a cell is hazardous (for tooltips and the legend).
export function explainCell(T, k, traffic) {
  if (k < 0 || T.slope[k] < 0) return "No data";
  const parts = [];
  const name = (list, id) => (list && list.find((u) => u.id === id) || {}).name;
  if (T.geoBed && T.geoBed[k]) parts.push(name(traffic.bed_units, T.geoBed[k]));
  if (T.geoSurf && T.geoSurf[k]) parts.push(name(traffic.surf_units, T.geoSurf[k]));
  if (T.ti && T.ti[k]) parts.push(`TI ${T.ti[k]}`);
  parts.push(`max slope ${T.slope[k].toFixed(1)}°`, `relief ${T.rough[k].toFixed(1)} m`);
  return parts.filter(Boolean).join(" · ");
}

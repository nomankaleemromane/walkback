// 2D map: Leaflet (EPSG:4326, zoom = WMTS level) with NASA Mars Trek tiles and
// Walkback's computed overlays. Depends on the global L (vendored Leaflet).
import { cellToLL } from "./terrain.js";

const TREK = (id) => `https://trek.nasa.gov/tiles/Mars/EQ/${id}/1.0.0/default/default028mm/{z}/{y}/{x}`;
// [label, layer id, max native zoom, ext, data kind] - verified against trek.nasa.gov on 2026-11-09
export const TREK_LAYERS = {
  viking: ["Viking MDIM 2.1 colour, 232 m", "Mars_Viking_MDIM21_ClrMosaic_global_232m", 7, "jpg", "optical"],
  blend: ["MOLA + HRSC shaded relief, 200 m", "Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw", 7, "jpg", "topographic"],
  mola: ["MOLA colour elevation, 463 m", "Mars_MGS_MOLA_ClrShade_merge_global_463m", 6, "jpg", "topographic"],
  themisDay: ["THEMIS IR day, 100 m", "Mars_MO_THEMIS-IR-Day_mosaic_global_100m_v12_clon0_ly", 8, "png", "thermal"],
  themisNight: ["THEMIS IR night, 100 m", "Mars_MO_THEMIS-IR-Night_mosaic_60N60S_100m_v14_clon0_ly", 8, "png", "thermal"],
};

export function createMap(el, site, { onTileError } = {}) {
  const map = L.map(el, { crs: L.CRS.EPSG4326, center: site.center, zoom: 11, minZoom: 3, maxZoom: 17, zoomSnap: 0.5, attributionControl: true, preferCanvas: true });
  map.attributionControl.setPrefix(false);
  const trek = ([label, id, nz, ext], bounds = null) => {
    const l = L.tileLayer(`${TREK(id)}.${ext}`, { maxNativeZoom: nz, maxZoom: 17, noWrap: true, attribution: "NASA Mars Trek", ...(bounds ? { bounds } : {}) });
    l.on("tileerror", (e) => onTileError && onTileError(id, e));
    return l;
  };
  const bounds = [[site.south, site.west], [site.north, site.east]];
  const bases = {};
  for (const [k, v] of Object.entries(site.layers || {})) bases[k] = { label: v[0] + " (NASA Trek)", kind: v[4], make: () => trek(v, bounds) };
  bases.local = { label: "Offline image snapshot (site pack)", kind: "optical", make: () => L.imageOverlay(`data/sites/${site.id}/texture.jpg`, bounds, { attribution: (site.texture_source || "").split(",")[0] }) };
  bases.viking = { label: TREK_LAYERS.viking[0] + " (NASA Trek)", kind: "optical", make: () => trek(TREK_LAYERS.viking) };
  bases.blend = { label: TREK_LAYERS.blend[0] + " (NASA Trek)", kind: "topographic", make: () => trek(TREK_LAYERS.blend) };
  const context = trek(TREK_LAYERS.viking); // regional context under everything
  context.setZIndex(1).addTo(map);
  let base = null;
  const setBase = (k) => { if (base) map.removeLayer(base); base = bases[k].make(); base.addTo(map); if (base.setZIndex) base.setZIndex(2); };
  map.fitBounds(bounds);
  return { map, bases, setBase, bounds, trek };
}

// ---- raster overlays from per-cell values
export function rasterURL(T, colorFn) {
  const c = document.createElement("canvas");
  c.width = T.w; c.height = T.h;
  const g = c.getContext("2d"), im = g.createImageData(T.w, T.h), d = im.data;
  const px = [0, 0, 0, 0];
  for (let k = 0; k < T.n; k++) {
    if (!colorFn(k, px)) continue;
    d[k * 4] = px[0]; d[k * 4 + 1] = px[1]; d[k * 4 + 2] = px[2]; d[k * 4 + 3] = px[3];
  }
  g.putImageData(im, 0, 0);
  return c.toDataURL();
}
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
export function ramp(stops, t) {
  t = Math.max(0, Math.min(1, t));
  const n = stops.length - 1, i = Math.min(n - 1, Math.floor(t * n));
  return lerp(stops[i], stops[i + 1], t * n - i);
}
const GYR = [[40, 170, 70], [240, 210, 40], [220, 40, 40]];
const TI_RAMP = [[40, 60, 160], [60, 170, 200], [240, 220, 120], [250, 140, 60]];

export function hazardColor(T) {
  return (k, px) => {
    if (T.slope[k] < 0) return false;
    if (!T.pass[k]) { px[0] = 90; px[1] = 0; px[2] = 60; px[3] = 230; return true; }
    const [r, g, b] = ramp(GYR, T.H[k] / 0.85);
    px[0] = r; px[1] = g; px[2] = b; px[3] = 60 + 170 * Math.min(1, T.H[k] / 0.6);
    return true;
  };
}
export function slopeColor(T, maxS) {
  return (k, px) => {
    const s = T.slope[k];
    if (s < 0) return false;
    if (s > maxS) { px[0] = 150; px[1] = 30; px[2] = 200; px[3] = 235; return true; }
    const [r, g, b] = ramp(GYR, s / maxS);
    px[0] = r; px[1] = g; px[2] = b; px[3] = 40 + 180 * (s / maxS);
    return true;
  };
}
export function confidenceColor(T) { // hatch where geology is missing (DEM + TI only)
  return (k, px) => {
    if (T.conf[k] >= 3 || T.slope[k] < 0) return false;
    const i = k % T.w, j = (k / T.w) | 0;
    if ((i + j) % 6 > 1) return false;
    px[0] = 255; px[1] = 255; px[2] = 255; px[3] = T.conf[k] === 2 ? 70 : 140;
    return true;
  };
}
export function tiColor(T) {
  return (k, px) => {
    const v = T.ti && T.ti[k];
    if (!v) return false;
    const [r, g, b] = ramp(TI_RAMP, (v - 150) / 250);
    px[0] = r; px[1] = g; px[2] = b; px[3] = 200;
    return true;
  };
}
export const GEO_COLORS = {
  bed: { "Crater floor fractured 1": [120, 170, 220], "Crater floor fractured 2": [90, 130, 200], "Crater floor fractured rough": [70, 100, 170], "Margin fractured": [90, 190, 160], "Delta blocky": [220, 120, 60], "Delta truncated curvilinear layered": [240, 200, 120], "Delta thinly layered": [230, 180, 90], "Delta thickly layered": [210, 150, 70], "Delta layered rough": [200, 130, 80], "Crater rim blocky": [170, 60, 60], "Crater rim layered": [190, 110, 110], "Crater rim breccia": [140, 30, 40], "Crater rim rough": [160, 90, 90], "Nili Planum fractured": [150, 150, 150], "Neretva Vallis layered": [180, 160, 220] },
  surf: { "Aeolian bedforms, large": [255, 230, 80], "Aeolian bedforms, small": [255, 250, 160], "Talus": [255, 60, 200] },
};
export function geoColor(T, traffic) {
  const bed = [], surf = [];
  for (const u of traffic.bed_units) bed[u.id] = GEO_COLORS.bed[u.name] || [128, 128, 128];
  for (const u of traffic.surf_units) surf[u.id] = GEO_COLORS.surf[u.name] || null;
  return (k, px) => {
    const b = T.geoBed[k], s = T.geoSurf[k];
    if (!b && !s) return false;
    const c = (s && surf[s]) || bed[b];
    if (!c) return false;
    px[0] = c[0]; px[1] = c[1]; px[2] = c[2]; px[3] = s && surf[s] ? 230 : 190;
    return true;
  };
}
// walk-back isochrones (minutes) with the active limit boundary emphasised
export function walkbackColor(T, WB, v, limitS) {
  return (k, px) => {
    if (T.slope[k] < 0) return false;
    const t = WB.T[k] / v;
    if (!isFinite(t)) { px[0] = 10; px[1] = 10; px[2] = 10; px[3] = 170; return true; }
    const band = Math.floor(t / 1800); // 30-min bands
    const inside = t <= limitS;
    const edge = Math.abs(t - limitS) < 70; // ~ one cell at 2 km/h
    if (edge) { px[0] = 255; px[1] = 255; px[2] = 255; px[3] = 255; return true; }
    const [r, g, b] = inside ? ramp([[40, 200, 110], [160, 220, 90]], t / Math.max(1, limitS)) : ramp([[240, 150, 60], [200, 40, 40]], Math.min(1, (t - limitS) / 7200));
    px[0] = r; px[1] = g; px[2] = b; px[3] = (inside ? 70 : 120) + (band % 2) * 30;
    return true;
  };
}

export function legendHTML(kind, ctx) {
  const rampCss = (st) => `linear-gradient(90deg,${st.map((c) => `rgb(${c})`).join(",")})`;
  switch (kind) {
    case "hazard": return `<b>Terrain hazard</b><div class="ramp" style="background:${rampCss(GYR)}"></div><small>0 easy · 60 caution · 85+ blocked</small><br><span class="sw2" style="background:rgb(90,0,60)"></span>impassable (slope &gt; ${ctx.maxS}° or hazard ≥ 85)<br><span class="sw2" style="background:repeating-linear-gradient(45deg,#fff 0 2px,transparent 2px 6px)"></span>no geology map: DEM + thermal inertia only`;
    case "slope": return `<b>Max slope (20 m DEM)</b><div class="ramp" style="background:${rampCss(GYR)}"></div><small>0° … ${ctx.maxS}°</small><br><span class="sw2" style="background:rgb(150,30,200)"></span>steeper than ${ctx.maxS}° (never exceed)`;
    case "ti": return `<b>Thermal inertia</b> (TIU)<div class="ramp" style="background:${rampCss(TI_RAMP)}"></div><small>150 loose/fine … 400 rocky</small>`;
    case "geo": return `<b>Photogeologic units</b> (Stack et al. 2020)<br>` + Object.entries({ ...GEO_COLORS.surf, "Delta blocky": GEO_COLORS.bed["Delta blocky"], "Crater rim blocky": GEO_COLORS.bed["Crater rim blocky"], "Crater floor fractured rough": GEO_COLORS.bed["Crater floor fractured rough"], "Crater floor fractured 1": GEO_COLORS.bed["Crater floor fractured 1"], "Margin fractured": GEO_COLORS.bed["Margin fractured"] }).map(([n, c]) => `<span class="sw2" style="background:rgb(${c})"></span>${n}`).join("<br>");
    case "wb": return `<b>Walk-back time to shelter</b><br><span class="sw2" style="background:rgb(60,200,110)"></span>inside the limit · <span class="sw2" style="background:rgb(220,90,50)"></span>outside<br><span class="sw2" style="background:#fff"></span>limit boundary (${ctx.limitMin} min) · bands = 30 min`;
    default: return "";
  }
}

export function pathLatLngs(T, path) { return Array.from(path, (k) => cellToLL(T, k)); }

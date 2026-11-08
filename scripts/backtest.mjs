// Perseverance backtest: does Walkback's least-effort router pick terrain the rover
// actually found traversable? Usage: node scripts/backtest.mjs
// Input: raw/M20_traverse.json (official NASA MMGIS traverse). Output: data/sites/jezero/backtest.json
//
// Method: split the rover's real traverse into legs of >= LEG_M driven metres whose ends
// are >= MIN_SEP m apart. Route Walkback between the leg ends (central case, hazard on).
// Compare with the real drive and with a naive straight line:
//   overlap  = share of the rover's path within BUFFER_M of the predicted path
//   length ratio, max slope on our DTM along each path, share of the rover path that our
//   model marks impassable (a "false block").
// Rovers and astronauts differ (wheels vs feet, rover drives avoid sand and use HiRISE-scale
// hazard maps). So this tests terrain-traversability agreement, not "the same path".
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadAll, ROOT } from "../tests/helpers.js";
import { dijkstra, tracePath, pathStats, boxAround } from "../js/router.js";
import { llToCell, cellToLL, nearestPassable } from "../js/terrain.js";

const [LEG_M, MIN_SEP, BUFFER_M] = (process.argv[2] || "1200,600,100").split(",").map(Number);
const A = await loadAll();
const { T, policy, site } = A;
const trv = JSON.parse(await readFile(path.join(ROOT, "raw", "M20_traverse.json"), "utf8")).features;
const inb = ([lon, lat]) => lon > site.west && lon < site.east && lat > site.south && lat < site.north;

// legs
const legs = [];
let cur = [], len = 0, sol0 = null;
for (const f of trv) {
  const cs = f.geometry.coordinates.map((c) => c.slice(0, 2));
  if (!cs.every(inb)) { cur = []; len = 0; continue; }
  if (!cur.length) sol0 = f.properties.sol;
  cur.push(...cs); len += f.properties.length || 0;
  if (len >= LEG_M) {
    const a = cur[0], b = cur[cur.length - 1];
    const sep = Math.hypot((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]) * (Math.PI / 180) * site.mars_radius_m;
    if (sep >= MIN_SEP) legs.push({ coords: cur, driven: len, sep, sol0, sol1: f.properties.sol });
    cur = []; len = 0;
  }
}

// helpers: rasterize a lon/lat polyline to cells (densified)
function lineCells(coords) {
  const out = [];
  for (let i = 1; i < coords.length; i++) {
    const [x0, y0] = coords[i - 1], [x1, y1] = coords[i];
    const n = Math.max(1, Math.ceil(Math.hypot((x1 - x0) / (site.east - site.west) * T.w, (y1 - y0) / (site.north - site.south) * T.h) * 2));
    for (let s = 0; s <= n; s++) { const k = llToCell(T, y0 + (y1 - y0) * (s / n), x0 + (x1 - x0) * (s / n)); if (k >= 0 && out[out.length - 1] !== k) out.push(k); }
  }
  return out;
}
const bufCells = Math.ceil(BUFFER_M / Math.min(T.cx, T.cy));
function overlap(actual, pred) {
  const near = new Uint8Array(T.n);
  for (const k of pred) { const x = k % T.w, y = (k / T.w) | 0; for (let dy = -bufCells; dy <= bufCells; dy++) for (let dx = -bufCells; dx <= bufCells; dx++) { if (Math.hypot(dx * T.cx, dy * T.cy) > BUFFER_M) continue; const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < T.w && yy < T.h) near[yy * T.w + xx] = 1; } }
  return actual.filter((k) => near[k]).length / Math.max(1, actual.length);
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };

const res = [], gj = [];
for (const L of legs) {
  const act = lineCells(L.coords);
  const a = nearestPassable(T, act[0]), b = nearestPassable(T, act[act.length - 1]);
  if (a < 0 || b < 0) continue;
  const R = dijkstra(T, { sources: [a], hazW: policy.params.hazard_route_weight.value, box: boxAround(T, [a, b], 60), targets: [b] });
  if (!isFinite(R.C[b])) { res.push({ sol0: L.sol0, sol1: L.sol1, routed: false }); continue; }
  const pred = tracePath(R.P, b).reverse();
  const straight = lineCells([L.coords[0], L.coords[L.coords.length - 1]]);
  const sp = pathStats(T, pred), sa = pathStats(T, act), ss = pathStats(T, straight);
  const blocked = act.filter((k) => !T.pass[k]).length / act.length;
  res.push({ sol0: L.sol0, sol1: L.sol1, routed: true, driven_m: Math.round(L.driven), sep_m: Math.round(L.sep),
    overlap: +overlap(act, pred).toFixed(3), overlap_straight: +overlap(act, straight).toFixed(3),
    len_pred_m: Math.round(sp.lengthM), len_act_m: Math.round(sa.lengthM), maxslope_pred: +sp.maxSlope.toFixed(1), maxslope_act: +sa.maxSlope.toFixed(1), maxslope_straight: +ss.maxSlope.toFixed(1),
    hazard_mean_pred: +(pred.reduce((s, k) => s + T.H[k], 0) / pred.length).toFixed(3), hazard_mean_act: +(act.reduce((s, k) => s + T.H[k], 0) / act.length).toFixed(3),
    act_blocked_share: +blocked.toFixed(3) });
  gj.push({ type: "Feature", properties: { sol0: L.sol0, sol1: L.sol1 }, geometry: { type: "LineString", coordinates: pred.filter((_, i) => i % 2 === 0 || i === pred.length - 1).map((k) => cellToLL(T, k).reverse().map((v) => +v.toFixed(5))) } });
}
const ok = res.filter((r) => r.routed);
const summary = {
  n_pairs: ok.length, n_unroutable: res.length - ok.length, leg_driven_m: LEG_M, min_sep_m: MIN_SEP, max_sep_m: Math.max(...ok.map((r) => r.sep_m)), buffer_m: BUFFER_M,
  median_overlap: med(ok.map((r) => r.overlap)), median_overlap_straight: med(ok.map((r) => r.overlap_straight)),
  share_router_beats_straight: ok.filter((r) => r.overlap > r.overlap_straight).length / ok.length,
  median_length_ratio: med(ok.map((r) => r.len_pred_m / r.len_act_m)),
  median_maxslope_pred: med(ok.map((r) => r.maxslope_pred)), median_maxslope_act: med(ok.map((r) => r.maxslope_act)), median_maxslope_straight: med(ok.map((r) => r.maxslope_straight)),
  median_hazard_pred: med(ok.map((r) => r.hazard_mean_pred)), median_hazard_act: med(ok.map((r) => r.hazard_mean_act)),
  mean_act_blocked_share: ok.reduce((s, r) => s + r.act_blocked_share, 0) / ok.length,
  legs_with_any_blocked: ok.filter((r) => r.act_blocked_share > 0).length,
  sols: [Math.min(...ok.map((r) => r.sol0)), Math.max(...ok.map((r) => r.sol1))],
};
const interpretation = `Over ${ok.length} real drive legs (sols ${summary.sols[0]}-${summary.sols[1]}), a median ${(summary.median_overlap * 100).toFixed(0)}% of the rover's path lies within ${BUFFER_M} m of Walkback's route, vs ${(summary.median_overlap_straight * 100).toFixed(0)}% for a straight line; the router beats the straight line on ${(summary.share_router_beats_straight * 100).toFixed(0)}% of legs. ` +
  `${(summary.mean_act_blocked_share * 100).toFixed(1)}% of the rover's driven cells fall on ground our model calls impassable (${summary.legs_with_any_blocked} of ${ok.length} legs touch such a cell), so the model is rarely more restrictive than reality. ` +
  `Rovers and astronauts differ (wheels, rover hazard maps from HiRISE, science detours), so this checks terrain traversability, not identical paths.`;
await writeFile(path.join(ROOT, "data/sites/jezero/backtest.json"), JSON.stringify({ summary, interpretation, method: "scripts/backtest.mjs header", legs: res, geojson: { type: "FeatureCollection", features: gj } }));
console.log(JSON.stringify(summary, null, 1));
console.log(interpretation);

// Walkback app: wires data, model and UI together.
import { loadSite, fetchGet } from "./siteio.js";
import { buildTerrain, llToCell, cellToLL, nearestPassable, explainCell } from "./terrain.js";
import { dijkstra, tracePath } from "./router.js";
import { buildLegs, makeConstraints, solve, evaluate, verdict, checkOrder } from "./planner.js";
import { effortCase } from "./model.js";
import { marsArrivals, classify, shelterLimitMin } from "./spaceweather.js";
import { marsTime, m20Sol, sunriseSunset, sunElevation, fmtH } from "./marstime.js";
import { walkbackChart, profileChart, tempChart, tempRange, allowed } from "./charts.js";
import * as M2 from "./map2d.js";
import { exportGeoJSON, exportGPX, printCard } from "./export.js";

const $ = (id) => document.getElementById(id);
const SITE = (new URLSearchParams(location.search).get("site") || "jezero").replace(/[^a-z0-9_-]/gi, "");
const BASE = `data/sites/${SITE}`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const mins = (s) => `${Math.round(s / 60)} min`;
const hm = (s) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };
const SOL_H = 1.0275; // Earth hours per Mars "hour" of local solar time

export const S = {
  legendMin: window.innerWidth < 640,
  mode: "plan", view: "2d", caseName: "central", startLtst: 9, swMode: "live", radOverride: "",
  legsCache: new Map(), overlays: {}, goFrac: 0, abortCell: -1, rover: null, roverOn: false, fromRover: true,
};
window.WALKBACK = S; // for debugging and tests

// ------------------------------------------------------------------ boot
const loadMsg = (t) => { const el = $("loadMsg"); if (el) el.textContent = t; };
async function boot() {
  setNet("…", "");
  loadMsg("Loading mission policy and site data…");
  S.policy = await fetchGet("config/policy.json", "json");
  const P = await loadSite(BASE, fetchGet);
  loadMsg("Building terrain and walk-back field…");
  await new Promise((r) => setTimeout(r, 0));
  Object.assign(S, { site: P.site, traffic: P.traffic, meta: P.targets || { objectives: [], targets: [] }, meda: P.meda || { hours_ltst: [], bins: [] } });
  $("siteName").textContent = P.site.name.split(" (")[0];
  fetchGet("data/sites/index.json", "json").then((ix) => {
    const sel = $("siteSel");
    ix.sites.forEach((x) => sel.add(new Option(x.name, x.id)));
    sel.value = SITE; sel.onchange = () => { location.search = "?site=" + sel.value; };
  }).catch(() => {});
  S.targets = S.meta.targets.map((t) => ({ ...t, enabled: true }));
  S.T = buildTerrain(P.site, P.raw, P.traffic, S.policy);
  S.home = nearestPassable(S.T, llToCell(S.T, ...P.site.habitat));
  S.cells = S.targets.map((t) => nearestPassable(S.T, llToCell(S.T, t.lat, t.lon)));
  computeWB();
  setupMap();
  fitHome();
  setupUI();
  renderTargets();
  renderAssumptions();
  loadMsg("Planning the Marswalk…");
  await loadSpaceWeather(false); // cached snapshot first: plan immediately, even offline
  recompute(true);
  toggleOverlay("wb", true);
  $("loading").hidden = true;
  fitRoute();
  setTimeout(fitRoute, 300); // again once the layout has settled
  loadSpaceWeather(true); // then try the live feed in the background
  loadBacktest();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !/[?&]nosw/.test(location.search)) navigator.serviceWorker.register("sw.js").catch(() => {});
  setInterval(() => { renderNow(); }, 60000);
  setInterval(() => loadSpaceWeather(true), 30 * 60000);
  document.body.dataset.ready = "1";
}

function fitRoute() {
  S.M.map.invalidateSize();
  if (S.route.getLatLngs().length) S.M.map.fitBounds(S.route.getBounds().pad(0.3)); else fitHome();
}
function fitHome() {
  const pts = [S.site.habitat, ...S.targets.filter((t) => t.priority >= 6).map((t) => [t.lat, t.lon])];
  S.M.map.invalidateSize();
  S.M.map.fitBounds(L.latLngBounds(pts).pad(0.12));
}
function computeWB() {
  const src = [S.home];
  if (S.roverOn && S.rover >= 0) src.push(S.rover);
  S.WB = dijkstra(S.T, { sources: src, reverse: true, hazW: S.policy.params.hazard_route_weight.value });
  S.legsCache.clear();
}

// ------------------------------------------------------------------ space weather
async function loadSpaceWeather(tryLive = true) {
  const iso = (d) => d.toISOString().slice(0, 10), now = new Date(), st = new Date(now - 30 * 864e5);
  let runs = null, src = "", fetched = null, live = false;
  try {
    if (!tryLive) throw 0;
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(`https://ccmc.gsfc.nasa.gov/DONKI-API/get/WSAEnlilSimulations?startDate=${iso(st)}&endDate=${iso(now)}`, { signal: ctl.signal });
    clearTimeout(to);
    if (!r.ok) throw new Error(r.status);
    runs = await r.json(); src = "live NASA CCMC DONKI"; fetched = new Date(); live = true;
  } catch {
    try { const j = await fetchGet("data/donki_snapshot.json", "json"); runs = j.runs; fetched = new Date(j.fetched); src = "cached DONKI snapshot"; } catch {}
  }
  if (!runs && S.sw && S.sw.runs) return; // keep what we have
  S.sw = { runs, src, fetched, live, arrivals: runs ? marsArrivals(runs) : [] };
  const age = fetched ? (Date.now() - fetched) / 864e5 : null;
  setNet(live ? "Live NASA feed" : runs ? `Cached data · ${age < 1 ? Math.round(age * 24) + " h" : age.toFixed(1) + " days"} old` : "Offline · no feed", live ? "live" : runs ? "cached" : "off");
  if (S.policy && S.T && S.plan !== undefined) { const before = S.swNow && S.swNow.level; recompute(true); if (before !== S.swNow.level) computeFoundSoon(); }
}
function setNet(t, cls) { const n = $("net"); n.textContent = t; n.className = "pill " + cls; }

function swState() {
  const now = Date.now();
  if (S.swMode !== "live") {
    const fake = { quiet: null, watch: 48, warning: 10 }[S.swMode];
    return { level: S.swMode, sim: true, hours: fake, why: S.swMode === "quiet" ? "Scenario: no Mars-directed CME predicted." : `Scenario: Mars-directed CME predicted in about ${fake} h.` };
  }
  if (!S.sw || !S.sw.runs) return { level: "quiet", why: "No space-weather feed reachable and no cached snapshot. Treat as unknown; baseline shown." };
  const c = classify(S.sw.arrivals, now, S.policy);
  if (c.level === "quiet") {
    const last = S.sw.arrivals.filter((a) => a.t < now).pop();
    return { level: "quiet", why: `No Mars-directed CME arrival predicted in the next ${S.policy.params.watch_hours.value} h (${S.sw.src}).` + (last ? ` Last predicted Mars arrival: ${new Date(last.t).toISOString().slice(0, 16).replace("T", " ")} UTC.` : "") };
  }
  const h = c.hours;
  return { level: c.level, hours: h, why: `CME arrival at Mars ${h >= 0 ? "predicted in " + h.toFixed(0) + " h" : "predicted " + (-h).toFixed(0) + " h ago"}${c.arrival.glancing ? " (glancing blow)" : ""}; ${c.nRuns} model run(s) within ±24 h, spread ${c.spreadH.toFixed(0)} h (${S.sw.src}).` };
}

// ------------------------------------------------------------------ planning pipeline
function seasonBin() {
  const mt = marsTime(new Date(), S.site.habitat[1]);
  const b = S.meda && S.meda.bins.find((x) => mt.Ls >= x.ls0 && mt.Ls < x.ls1);
  return { mt, bin: b };
}
function radLimit(level) {
  if (S.radOverride === "none") return null;
  if (S.radOverride) return +S.radOverride;
  return shelterLimitMin(level, S.policy);
}
function legsFor(limitMin, ec) {
  const v = ec.paceKmh / 3.6, key = `${limitMin}|${ec.paceKmh}|${S.roverOn ? S.rover : -1}|${startCell()}`;
  if (!S.legsCache.has(key)) {
    const allow = limitMin == null ? null : Uint8Array.from(S.WB.T, (t) => (t / v <= limitMin * 60 ? 1 : 0));
    S.legsCache.set(key, buildLegs(S.T, S.WB, [startCell(), ...S.cells], { allow, hazW: S.policy.params.hazard_route_weight.value }).legs);
  }
  return S.legsCache.get(key);
}
function planFor({ level, caseName = S.caseName, start = S.startLtst, limit } = {}) {
  const ec = effortCase(S.policy, caseName);
  const lim = limit !== undefined ? limit : radLimit(level);
  const { mt, bin } = seasonBin();
  const sunset = bin && bin.sunset_ltst ? bin.sunset_ltst : sunriseSunset(S.site.habitat[0], mt.declDeg).set;
  const K = makeConstraints(S.policy, ec, { startLtst: start, sunsetLtst: sunset, radLimitMin: lim });
  const legs = legsFor(lim, ec);
  const best = solve(legs, S.targets, K);
  const plan = best.order.length ? evaluate(S.T, S.WB, legs, S.targets, best.order, K, S.policy) : null;
  return { plan, K, legs, ec, lim, sunset, best };
}

let recomputeTimer = 0;
export function recompute(now = false) {
  clearTimeout(recomputeTimer);
  if (!now) { recomputeTimer = setTimeout(() => recompute(true), 60); return; }
  const sw = swState();
  S.swNow = sw;
  const r = planFor({ level: sw.level });
  Object.assign(S, { plan: r.plan, K: r.K, legs: r.legs, ec: r.ec, lim: r.lim, sunset: r.sunset });
  // sensitivity: same order under the other cases
  const sens = {};
  for (const c of ["low", "central", "high"]) {
    const ec = effortCase(S.policy, c);
    const K = makeConstraints(S.policy, ec, { startLtst: S.startLtst, sunsetLtst: r.sunset, radLimitMin: r.lim });
    const chk = r.plan ? checkOrder(S.T, S.WB, legsFor(r.lim, ec), S.targets, r.plan.order, K, S.policy) : { ok: false };
    const re = planFor({ level: sw.level, caseName: c });
    sens[c] = { ok: chk.ok, plan: chk.plan, K, replanStops: re.plan ? re.plan.order.length : 0, replanValue: re.best.value };
  }
  S.sens = sens;
  const { bin } = seasonBin();
  const endL = S.startLtst + (r.plan ? r.plan.totalS / 3600 / SOL_H : 0);
  const tr = tempRange(bin, S.meda.hours_ltst, S.startLtst, endL);
  S.verdict = verdict(r.plan, r.K, { policy: S.policy, level: sw.level, sensitivity: sens, coldC: tr ? tr.lo : null });
  // quiet reference plan to explain what a storm removes
  S.quietPlan = planFor({ level: "quiet", limit: null }).plan;
  renderAll();
  computeFoundSoon();
}
let foundTimer = 0;
function computeFoundSoon() {
  S.foundDirty = true;
  clearTimeout(foundTimer);
  if (S.tab === "evidence") foundTimer = setTimeout(() => { computeFound(); S.foundDirty = false; }, 250);
}

// ------------------------------------------------------------------ map
function setupMap() {
  let miss = 0;
  S.M = M2.createMap($("map"), S.site, { onTileError: () => { miss++; if (miss === 8) $("layerNote").textContent = "Some NASA Trek tiles failed to load (offline?). Switch the base map to the offline CTX snapshot."; } });
  const map = S.M.map;
  for (const [k, b] of Object.entries(S.M.bases)) $("base").add(new Option(b.label, k));
  $("base").value = navigator.onLine && Object.keys(S.site.layers || {}).length ? Object.keys(S.site.layers)[0] : "local";
  S.M.setBase($("base").value);
  $("base").onchange = () => S.M.setBase($("base").value);
  // overlay registry: [label, kind, how it changes the plan, factory]
  const ov = (url) => L.imageOverlay(url, S.M.bounds, { opacity: $("ovOp").value / 100, interactive: false, className: "px" });
  const maxS = S.policy.params.max_slope_deg.value;
  S.ovDefs = {
    wb: ["Walk-back time to shelter", "derived", "Sets which stops are allowed; routes stay inside the limit", () => ov(M2.rasterURL(S.T, M2.walkbackColor(S.T, S.WB, S.ec.paceKmh / 3.6, wbLimitS()))), "wb"],
    hazard: ["Terrain hazard (geology + roughness + TI + slope)", "derived", "Router avoids/penalises; blocks above 85", () => L.layerGroup([ov(M2.rasterURL(S.T, M2.hazardColor(S.T))), ov(M2.rasterURL(S.T, M2.confidenceColor(S.T)))]), "hazard"],
    slope: ["Max slope from 20 m CTX DTM", "topographic", `Never-exceed ${maxS}° blocks cells; caution above ${S.policy.params.caution_slope_deg.value}°`, () => ov(M2.rasterURL(S.T, M2.slopeColor(S.T, maxS))), "slope"],
    geo: ["Photogeologic map (Mars 2020 team)", "geologic", "Boulder/sand units raise hazard", () => ov(M2.rasterURL(S.T, M2.geoColor(S.T, S.traffic))), "geo"],
    ti: ["THEMIS thermal inertia", "thermal", "Low TI flags soft, loose ground", () => ov(M2.rasterURL(S.T, M2.tiColor(S.T))), "ti"],
    themisNight: ["THEMIS IR night (NASA Trek)", "thermal", "Context: warm at night = rocky", () => S.M.trek(M2.TREK_LAYERS.themisNight), null],
    themisDay: ["THEMIS IR day (NASA Trek)", "thermal", "Context", () => S.M.trek(M2.TREK_LAYERS.themisDay), null],
    mola: ["MOLA colour elevation (NASA Trek)", "topographic", "Context", () => S.M.trek(M2.TREK_LAYERS.mola), null],
    traverse: ["Perseverance traverse (NASA, to sol 2022)", "rover", "Backtest of the router", () => traverseLayer(), null],
  };
  if (!S.traffic) { delete S.ovDefs.geo; }
  if (!S.T.ti) delete S.ovDefs.ti;
  if (!(S.site.extras || []).includes("traverse")) delete S.ovDefs.traverse;
  const box = $("overlays");
  for (const [k, [label, kind, use]] of Object.entries(S.ovDefs)) {
    const id = "ov-" + k;
    box.insertAdjacentHTML("beforeend", `<label title="${esc(use)}"><input type="checkbox" id="${id}" data-ov="${k}"> ${esc(label)} <span class="kind">${kind}</span></label>`);
  }
  box.addEventListener("change", (e) => { const k = e.target.dataset.ov; if (k) toggleOverlay(k, e.target.checked); });
  $("ovOp").oninput = () => Object.values(S.overlays).forEach((l) => setOpacity(l, $("ovOp").value / 100));
  // route and markers
  S.routeCase = L.polyline([], { color: "#000", weight: 8, opacity: 0.6 }).addTo(map);
  S.route = L.polyline([], { color: "#33d6ff", weight: 4 }).addTo(map);
  S.abortLine = L.polyline([], { color: "#ff5a4f", weight: 5, dashArray: "8 6" }).addTo(map);
  S.markers = L.layerGroup().addTo(map);
  S.me = L.marker([0, 0], { icon: L.divIcon({ className: "", html: '<div class="me-icon"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), zIndexOffset: 1000, keyboard: false });
  map.on("mousemove", (e) => {
    const k = llToCell(S.T, e.latlng.lat, e.latlng.lng);
    if (!S.ec) return;
    $("ro").textContent = `${e.latlng.lat.toFixed(4)}°N ${e.latlng.lng.toFixed(4)}°E` + (k >= 0 && S.T.slope[k] >= 0 ? ` · ${S.T.Z[k]} m · hazard ${(S.T.H[k] * 100).toFixed(0)} · walk-back ${isFinite(S.WB.T[k]) ? mins(S.WB.T[k] / (S.ec.paceKmh / 3.6)) : "none"}` : "");
  });
  map.on("click", (e) => onMapClick(e.latlng));
  $("ov-wb").checked = true;
}
function setOpacity(l, o) { if (l.setOpacity) l.setOpacity(o); else if (l.eachLayer) l.eachLayer((x) => x.setOpacity && x.setOpacity(o)); }
function wbLimitS() {
  if (S.K && isFinite(S.K.radS)) return S.K.radS;
  return S.K ? (S.K.capS - S.K.egressS) / 2 : 3 * 3600; // quiet: the out-and-back consumables reach
}
function toggleOverlay(k, on) {
  if (S.overlays[k]) { S.M.map.removeLayer(S.overlays[k]); delete S.overlays[k]; }
  if (on) {
    if (k === "wb") S.wbKey = wbKey();
    S.overlays[k] = S.ovDefs[k][3](); S.overlays[k].addTo(S.M.map); setOpacity(S.overlays[k], $("ovOp").value / 100);
  }
  renderLegend();
}
const wbKey = () => `${wbLimitS()}|${S.ec.paceKmh}|${S.roverOn ? S.rover : -1}`;
function refreshOverlay(k) {
  if (!S.overlays[k]) return;
  if (k === "wb" && wbKey() === S.wbKey) return; // the walk-back raster only changes with the limit, pace or shelters
  toggleOverlay(k, true);
}
function renderLegend() {
  const order = ["wb", "hazard", "slope", "geo", "ti"].filter((k) => S.overlays[k]);
  const objs = S.meta.objectives.map((o) => `<span><span class="dot" style="background:${objColor(o.id)}"></span>${esc(o.name)}</span>`).join("");
  $("legend").innerHTML = `<button class="lg-toggle" aria-expanded="${!S.legendMin}" title="Show or hide the legend">Legend ${S.legendMin ? "▴" : "▾"}</button>` +
    `<div class="lg-body"><div class="lrow">${objs}<span>⌂ habitat</span></div>` +
    order.slice(0, 2).map((k) => "<hr>" + M2.legendHTML(S.ovDefs[k][4], { maxS: S.policy.params.max_slope_deg.value, limitMin: Math.round(wbLimitS() / 60) })).join("") + "</div>";
  $("legend").classList.toggle("min", !!S.legendMin);
  $("legend").querySelector(".lg-toggle").onclick = () => { S.legendMin = !S.legendMin; renderLegend(); };
}
let travLayer = null;
function traverseLayer() {
  if (travLayer) return travLayer;
  travLayer = L.layerGroup();
  fetchGet(`${BASE}/traverse.geojson`, "json").then((g) => {
    L.geoJSON(g, { filter: (f) => f.geometry.type === "LineString", style: { color: "#fff", weight: 2, opacity: 0.85, dashArray: "4 3" } }).addTo(travLayer);
    if (S.backtest) L.geoJSON(S.backtest.geojson, { style: { color: "#ffd166", weight: 3 } }).addTo(travLayer);
  });
  return travLayer;
}
function onMapClick(ll) {
  const k = llToCell(S.T, ll.lat, ll.lng);
  if (k < 0) return;
  if (S.mode === "abort" || S.mode === "go") { S.abortCell = nearestPassable(S.T, k); if (S.mode === "abort") renderAbort(); return; }
  if (S.placingRover) { S.placingRover = false; placeRover(k); return; }
  const v = S.ec.paceKmh / 3.6, wb = S.WB.T[k];
  L.popup().setLatLng(ll).setContent(`<b>${ll.lat.toFixed(4)}°N ${ll.lng.toFixed(4)}°E</b><br>${esc(explainCell(S.T, k, S.traffic))}<br>Terrain hazard ${(S.T.H[k] * 100).toFixed(0)}/100 · ${S.T.pass[k] ? "walkable" : "<b>impassable</b>"} · confidence ${["", "low (DEM only)", "medium (DEM + TI)", "high (DEM + TI + geology)"][S.T.conf[k]]}<br>Walk-back to shelter: <b>${isFinite(wb) ? mins(wb / v) : "no route"}</b><br><button id="addStop">Add as science stop</button>`).openOn(S.M.map);
  setTimeout(() => { const b = $("addStop"); if (b) b.onclick = () => { addCustomStop(ll); S.M.map.closePopup(); }; });
}
function addCustomStop(ll) {
  const n = S.targets.filter((t) => t.custom).length + 1;
  S.targets.push({ id: "custom" + n, name: `Custom stop ${n}`, lat: ll.lat, lon: ll.lng, objective: "X", priority: 5, station_min: S.policy.params.station_min.value, rationale: "Added by the planner.", position_source: "Picked on the map.", approximate: false, pov: [], custom: true, enabled: true });
  S.cells.push(nearestPassable(S.T, llToCell(S.T, ll.lat, ll.lng)));
  S.legsCache.clear(); renderTargets(); recompute();
}
export const startCell = () => (S.roverOn && S.fromRover && S.rover >= 0 ? S.rover : S.home);
function defaultRover() { // halfway to the farthest target
  let far = S.home, best = -1;
  S.cells.forEach((c) => { if (c >= 0 && S.WB.T[c] > best && isFinite(S.WB.T[c])) { best = S.WB.T[c]; far = c; } });
  const p = tracePath(S.WB.P, far); return p[Math.floor(p.length / 2)] ?? S.home;
}
function placeRover(k) {
  S.rover = nearestPassable(S.T, k); S.roverOn = true; $("rover").checked = true;
  computeWB(); refreshOverlay("wb"); recompute(); computeFound();
}

// ------------------------------------------------------------------ UI wiring
function setupUI() {
  document.querySelectorAll(".modes button").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  $("start").oninput = () => { S.startLtst = +$("start").value; $("startV").textContent = fmtH(S.startLtst); recompute(); };
  $("case").onchange = () => { S.caseName = $("case").value; recompute(); };
  $("radlim").onchange = () => { S.radOverride = $("radlim").value; recompute(); };
  $("swm").onchange = () => { S.swMode = $("swm").value; recompute(); };
  $("goT").oninput = () => { S.goFrac = +$("goT").value / 1000; S.abortCell = -1; renderGo(); };
  $("goPlay").onclick = toggleWalk;

  $("goAbort").onclick = () => { S.abortCell = goPosition().cell; setMode("abort"); };
  $("abortResume").onclick = () => setMode("go");
  $("view3d").onclick = () => setView(S.view === "2d" ? "3d" : "2d");
  $("demo").onclick = () => import("./demo.js").then((m) => m.runDemo(S, { setMode, setView, recompute, setSw, setGo, renderAbort, goCell: () => goPosition().cell }));
  $("exGeo").onclick = () => exportGeoJSON(S);
  $("exGpx").onclick = () => exportGPX(S);
  $("exCard").onclick = () => printCard(S);
  // side-panel tabs
  document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
  const sum = $("summary"), setSumH = () => document.documentElement.style.setProperty("--sum-h", sum.offsetHeight + "px");
  new ResizeObserver(setSumH).observe(sum); setSumH();
  $("swb").onclick = () => setTab("conditions"); $("swb").style.cursor = "pointer"; $("swb").title = "Space-weather details";
  // rover safe haven (optional consideration: rover assistance)
  $("c-rover").insertAdjacentHTML("beforeend", `<h2>Rover assistance <small class="mut">optional</small></h2><div class="row"><label><input type="checkbox" id="rover"> Pressurized rover parked as a second safe haven</label><button id="roverPlace">Place on map</button></div><div class="row"><label><input type="checkbox" id="fromRover" checked> Crew drives out: EVA starts and ends at the rover</label></div><p class="mut small" id="roverNote">A pressurized rover counts as a safe haven (xEVA con-ops, EVA-EXP-0042 p.40). Walk-back times then go to the nearest shelter.</p>`);
  $("rover").onchange = () => { S.roverOn = $("rover").checked; if (S.roverOn && S.rover == null) S.rover = SITE === "jezero" ? nearestPassable(S.T, llToCell(S.T, 18.4545, 77.4105)) : defaultRover(); computeWB(); refreshOverlay("wb"); recompute(); computeFound(); };
  $("fromRover").onchange = () => { S.fromRover = $("fromRover").checked; S.legsCache.clear(); recompute(); computeFound(); };
  $("roverPlace").onclick = () => { S.placingRover = true; setMode("plan"); $("roverNote").textContent = "Click the map where the rover should park."; };
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, select, textarea")) return;
    if (e.key === "v" || e.key === "V") setView(S.view === "2d" ? "3d" : "2d");
    if (e.key === "1") setMode("plan"); if (e.key === "2") setMode("go"); if (e.key === "3") setMode("abort");
  });
  window.addEventListener("resize", () => { clearTimeout(S.rz); S.rz = setTimeout(drawCharts, 120); });
  window.addEventListener("online", () => loadSpaceWeather());
  window.addEventListener("offline", () => setNet("Offline · cached data", "off"));
}
export function setTab(t) {
  S.tab = t;
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === t));
  document.querySelectorAll(".tabpanel").forEach((p) => (p.hidden = p.dataset.tab !== t));
  if (t === "evidence" && S.foundDirty !== false) { computeFound(); S.foundDirty = false; }
  if (t === "plan" || t === "conditions") drawCharts();
  const side = $("side"); if (side.scrollTop > $("summary").offsetHeight) side.scrollTop = 0;
}
export function setSw(mode) { S.swMode = mode; $("swm").value = mode; recompute(true); }
export function setMode(m) {
  if ((m === "go" || m === "abort") && !S.committed && S.plan) { S.committed = S.plan; S.committedStart = startCell(); S.committedLevel = S.swNow.level; }
  if (m === "plan") { S.committed = null; S.committedStart = null; }
  const prevMode = S.mode;
  S.mode = m; document.body.dataset.mode = m;
  document.querySelectorAll(".modes button").forEach((b) => b.setAttribute("aria-selected", b.dataset.mode === m));
  $("hud").hidden = m !== "go"; $("abortCard").hidden = m !== "abort";
  if (m !== "abort") S.abortLine.setLatLngs([]);
  if (m === "plan") { S.M.map.removeLayer(S.me); stopWalk(); }
  setTimeout(() => { S.M.map.invalidateSize(); if (S.v3) S.v3.resize(); }, 50);
  if (m === "go" || m === "abort") setTimeout(fitForHud, 80);
  if (m === "plan" && prevMode !== "plan") setTimeout(fitRoute, 80);
  if (m === "go") renderGo();
  if (m === "abort") { if (S.abortCell < 0) S.abortCell = goPosition().cell; renderAbort(); }
  if (S.v3) S.v3.update(S);
}
function fitForHud() {
  const b = S.route.getLatLngs().length ? S.route.getBounds() : null;
  if (!b) return;
  const wide = window.innerWidth > 1080;
  S.M.map.invalidateSize();
  S.M.map.fitBounds(b.pad(0.1), wide ? { paddingTopLeft: [30, 30], paddingBottomRight: [440, 30] } : { paddingTopLeft: [20, 20], paddingBottomRight: [20, Math.round(window.innerHeight * 0.45)] });
}
function followMe(ll) {
  const m = S.M.map, pt = m.latLngToContainerPoint(ll), size = m.getSize();
  const wide = window.innerWidth > 1080, right = wide ? size.x - 430 : size.x, bottom = wide ? size.y : size.y * 0.5;
  if (pt.x < 40 || pt.y < 40 || pt.x > right - 40 || pt.y > bottom - 40) m.panTo(ll);
}
export async function setView(v) {
  S.view = v; document.body.dataset.view = v;
  $("view3d").textContent = v === "3d" ? "2D" : "3D";
  $("map").style.visibility = v === "3d" ? "hidden" : "visible";
  $("view3").hidden = v !== "3d";
  if (v === "3d") {
    if (!S.v3) { const m = await import("./view3d.js"); S.v3 = await m.create3D($("view3"), S); }
    S.v3.update(S); S.v3.resize();
  } else S.M.map.invalidateSize();
}

// ------------------------------------------------------------------ rendering
function renderAll() {
  renderNow();
  renderVerdict();
  renderPlanStats();
  renderTimeline();
  renderTargetStatus();
  drawRoute();
  drawCharts();
  renderSens();
  refreshOverlay("wb");
  if (S.mode === "go") renderGo();
  if (S.mode === "abort") renderAbort();
  if (S.v3) S.v3.update(S);
}

function renderNow() {
  if (!S.site) return;
  const now = new Date(), { mt, bin } = seasonBin(), lat = S.site.habitat[0];
  const sun = sunriseSunset(lat, mt.declDeg), el = sunElevation(mt.ltst, lat, mt.declDeg);
  const tr = bin ? tempRange(bin, S.meda.hours_ltst, mt.ltst - 0.25, mt.ltst + 0.25) : null;
  const medaNote = S.meda.bins.length ? "No live Jezero weather is published (NASA's Perseverance weather feed ends Apr 2024), so conditions are MEDA climatology for this season." : "No surface weather climatology in this site pack: sunset is computed (Mars24), temperatures unknown.";
  const sw = S.swNow || swState();
  $("nowKv").innerHTML = [
    SITE === "jezero" ? [`Sol ${m20Sol(now)}`, `Perseverance mission sol · ${now.toISOString().slice(0, 16).replace("T", " ")} UTC`] : [`MSD ${Math.floor(mt.msd)}`, `Mars sol date · ${now.toISOString().slice(0, 16).replace("T", " ")} UTC`],
    [`${fmtH(mt.ltst)} LTST`, `local solar time · sun ${el > 0 ? el.toFixed(0) + "° up" : "below horizon"}`],
    [`Ls ${mt.Ls.toFixed(0)}°`, seasonName(mt.Ls)],
    [`${fmtH(bin && bin.sunset_ltst || sun.set)}`, bin ? "sunset (MEDA climatology)" : "sunset (computed, Mars24)"],
    [tr ? `${tr.lo.toFixed(0)} to ${tr.hi.toFixed(0)} °C` : "–", "air temp now (MEDA, typical)"],
    [bin && bin.opacity_mean != null ? `τ ≈ ${bin.opacity_mean}` : "–", "dust opacity (Mastcam-Z, typical)"],
  ].map(([b, s]) => `<div><b>${b}</b><small>${s}</small></div>`).join("");
  $("swb").textContent = sw.level.toUpperCase(); $("swb").className = "badge " + sw.level;
  const lim = S.lim;
  const limTxt = lim == null ? "no extra radiation limit" : `stay within ${lim} min of shelter`;
  $("swLim").textContent = limTxt + (S.radOverride ? " (override)" : "");
  $("swt").innerHTML = `<b>CME arrival alert at Mars: ${sw.level.toUpperCase()}.</b> ${esc(sw.why)}<br>Shelter-time limit: <b>${lim == null ? "none beyond consumables" : lim + " min"}</b>${S.radOverride ? " (manual override)" : ""}.`;
  $("swMore").innerHTML = `A predicted CME arrival is a proxy for solar energetic particle (SEP) risk: SEPs can arrive before the CME shock. There has been no dedicated Mars SEP monitor since MAVEN was declared lost (June 2026); Curiosity's RAD is the surface reference (~0.64 mSv/day background; the 20 May 2024 event gave ≈ 8.1 mGy). A RAD-based nowcast can give ≥ 30 min warning (Löwe et al. 2025), which sets the 30-min Warning limit. ${medaNote}`;
}
const seasonName = (Ls) => (Ls < 90 ? "northern spring" : Ls < 180 ? "northern summer" : Ls < 270 ? "northern autumn (dusty season)" : "northern winter (dusty season)");

function renderVerdict() {
  const V = S.verdict, el = $("v");
  el.textContent = V.verdict; el.className = "verdict " + V.verdict;
  const p = S.plan;
  $("vTitle").textContent = p ? `${p.order.length} science stop${p.order.length > 1 ? "s" : ""} · ${(p.totalS / 3600).toFixed(1)} h · ${(p.lengthM / 1000).toFixed(1)} km` : "No feasible Marswalk";
  const bn = { eva: "planned EVA length", consumables: "consumables walk-back", radiation: "radiation shelter time", daylight: "daylight" }[V.binding];
  $("vBind").textContent = bn ? `Binding limit: ${bn}` : V.verdict === "NO-GO" ? "See checks below" : "";
  $("checks").innerHTML = V.checks.map((c) => `<li class="${c.level}${c.key === V.binding ? " binding" : ""}">${esc(c.text)}</li>`).join("");
  // what the storm removed vs quiet
  const q = S.quietPlan, now = new Set(p ? p.order : []);
  const lost = q ? q.order.filter((j) => !now.has(j)) : [];
  $("dropped").innerHTML = lost.length && (S.swNow.level !== "quiet" || S.radOverride) ? `Compared with quiet conditions, dropped: ${lost.map((j) => `<b>${esc(S.targets[j - 1].name)}</b> (walk-back ${mins(S.WB.T[S.cells[j - 1]] / (S.ec.paceKmh / 3.6))})`).join(", ")}.` : "";
}

function renderPlanStats() {
  const p = S.plan;
  $("planStats").innerHTML = p ? [
    [`${(p.lengthM / 1000).toFixed(1)} km`, "walked"], [hm(p.totalS), "EVA incl. airlock"], [mins(p.maxWBs), "farthest from shelter"],
    [`+${p.gainM.toFixed(0)} m`, "climb"], [`${(p.joules / 1e6).toFixed(1)} MJ`, `walking effort (${S.ec.name})`], [`${(0.64 * p.totalS / 86400).toFixed(3)} mSv`, "GCR dose (RAD baseline)"],
  ].map(([b, s]) => `<div><b>${b}</b><small>${s}</small></div>`).join("") : "";
}

const homeName = () => ((S.committedStart ?? startCell()) === S.home ? "habitat" : "rover");
function ltstAt(s) { return S.startLtst + s / 3600 / SOL_H; }
function renderTimeline() {
  const p = S.plan;
  if (!p) { $("timeline").innerHTML = "<li><span></span><span class='mut'>No feasible plan under the current limits.</span><span></span></li>"; return; }
  let n = 0;
  $("timeline").innerHTML = p.steps.map((s) => {
    const t = `<span class="t">${fmtH(ltstAt(s.t0))}</span>`;
    if (s.kind === "walk") {
      const to = s.to === 0 ? homeName() : S.targets[s.to - 1].name;
      return `<li class="walk">${t}<span>Walk to ${esc(to)} · ${(s.lengthM / 1000).toFixed(2)} km, +${s.gainM.toFixed(0)}/−${s.lossM.toFixed(0)} m, max ${s.maxSlope.toFixed(0)}°</span><span>${mins(s.t1 - s.t0)}</span></li>`;
    }
    if (s.kind === "station") return `<li class="st">${t}<span><span class="n" style="background:${objColor(S.targets[s.node - 1].objective)}">${++n}</span><b>${esc(s.label)}</b> · on station</span><span>${mins(s.t1 - s.t0)}</span></li>`;
    return `<li>${t}<span>${esc(s.label)}</span><span>${mins(s.t1 - s.t0)}</span></li>`;
  }).join("") + `<li>${`<span class="t">${fmtH(ltstAt(p.totalS))}</span>`}<span><b>Inside</b> · margin to EVA limit ${mins(S.K.evaS - p.totalS)}</span><span></span></li>`;
}

function drawCharts() {
  if (!S.K) return;
  walkbackChart($("wbChart"), S.plan, S.K, S.verdict.binding, S.mode === "go" ? goPosition().t : null);
  profileChart($("profChart"), S.T, S.plan, S.K);
  const { mt, bin } = seasonBin();
  const sun = sunriseSunset(S.site.habitat[0], mt.declDeg);
  if (bin && bin.sunset_ltst) sun.set = bin.sunset_ltst;
  const end = ltstAt(S.plan ? S.plan.totalS : 0);
  tempChart($("tempChart"), bin, S.meda.hours_ltst, S.startLtst, end, sun);
  if (!bin) { $("windowNote").textContent = "No MEDA climatology for this site."; return; }
  // best start: warmest feasible window
  let best = null;
  for (let h = 7; h <= 14; h += 0.5) { const r = tempRange(bin, S.meda.hours_ltst, h, h + 6 / SOL_H); if (r && (!best || r.lo > best.lo)) best = { h, lo: r.lo }; }
  const tr = tempRange(bin, S.meda.hours_ltst, S.startLtst, end);
  $("windowNote").innerHTML = `Season Ls ${bin.ls0}–${bin.ls1}° (${bin.n_sols} sols of MEDA data). Your EVA: ${tr ? `${tr.lo.toFixed(0)} to ${tr.hi.toFixed(0)} °C` : "–"}. ` +
    (best ? `Warmest 6-hour window starts ≈ <b>${fmtH(best.h)}</b> LTST (coldest point ${best.lo.toFixed(0)} °C). ` : "") + `Typical dust opacity τ ${bin.opacity_mean} (max ${bin.opacity_max}). Climatology, not a forecast.`;
}

function renderSens() {
  const rows = ["low", "central", "high"].map((c) => {
    const s = S.sens[c], ec = effortCase(S.policy, c), p = s.plan;
    return `<tr${c === S.caseName ? ' class="cur"' : ""}><td><b>${c}</b><br><small>${ec.paceKmh.toFixed(1)} km/h · k ${ec.k} · ${ec.massKg} kg</small></td><td>${p ? hm(p.totalS) : "–"}</td><td>${p ? (p.joules / 1e6).toFixed(1) + " MJ" : "–"}</td><td class="${s.ok ? "ok-t" : "fail-t"}">${S.plan ? (s.ok ? "plan holds" : "plan fails") : "–"}</td><td>${s.replanStops} stops</td></tr>`;
  });
  $("sens").innerHTML = `<tr><th>Case</th><th>EVA</th><th>Effort</th><th>This plan</th><th>Re-plan</th></tr>` + rows.join("");
}

function objColor(o) { return { A: "#ff9a5c", B: "#33d6ff", C: "#b38cff", X: "#ffd166" }[o] || "#ccc"; }
function renderTargets() {
  const objs = [...S.meta.objectives, { id: "X", name: "Custom stops", goal: "Stops you added on the map." }];
  $("objectives").innerHTML = objs.map((o) => {
    const list = S.targets.map((t, i) => [t, i]).filter(([t]) => t.objective === o.id);
    if (!list.length) return "";
    return `<div class="obj"><h4><span class="dot" style="background:${objColor(o.id)}"></span>Objective ${o.id}: ${esc(o.name)}</h4><p>${esc(o.goal)}</p>` + list.map(([t, i]) => `
      <div class="tg" id="tg-${i}">
        <input type="checkbox" ${t.enabled ? "checked" : ""} data-en="${i}" aria-label="Include ${esc(t.name)}">
        <div class="nm"><div class="nm1"><b data-open="${i}" tabindex="0" role="button">${esc(t.name)}</b><span class="chip" id="chip-${i}">–</span></div>
          <small>${t.sample ? `Perseverance sample “${esc(t.sample)}”, sol ${t.sample_sol}` : "custom"}</small>
          <div class="nm2"><label>priority <input class="prio" type="number" min="1" max="10" value="${t.priority}" data-pr="${i}"></label><label>on station <input class="prio" type="number" min="5" max="120" step="5" value="${t.station_min}" data-sm="${i}"> min</label></div></div>
        <div class="tg-detail">${esc(t.rationale)}<br><small>${esc(t.position_source)}</small>${t.pov && t.pov.length ? `<div class="pov">${t.pov.map((p) => `<figure><a href="${esc(p.page || p.source_url)}" target="_blank" rel="noopener"><img loading="lazy" src="${BASE}/${esc(p.file)}" alt="Perseverance ${esc(p.camera)} image, sol ${p.sol}"></a><figcaption>${esc(p.camera)} · sol ${p.sol} · ${esc(p.credit)}</figcaption></figure>`).join("")}</div><small>Raw Perseverance images near this stop (point-of-view at the destination).</small>` : ""}</div>
      </div>`).join("") + "</div>";
  }).join("");
  const box = $("objectives");
  box.onchange = (e) => {
    const d = e.target.dataset;
    if (d.en) S.targets[+d.en].enabled = e.target.checked;
    if (d.pr) S.targets[+d.pr].priority = Math.max(1, Math.min(10, +e.target.value || 1));
    if (d.sm) { S.targets[+d.sm].station_min = Math.max(5, +e.target.value || 20); }
    recompute();
  };
  box.onkeydown = (e) => { if (e.key === "Enter" && e.target.dataset.open) e.target.click(); };
  box.onclick = (e) => {
    const i = e.target.closest("[data-open]")?.dataset.open;
    if (i == null || e.target.tagName === "INPUT") return;
    const el = $("tg-" + i); el.classList.toggle("open");
    const t = S.targets[+i]; S.M.map.setView([t.lat, t.lon], Math.max(S.M.map.getZoom(), 13));
  };
}

function reasonFor(j) {
  const t = S.targets[j - 1], v = S.ec.paceKmh / 3.6, wb = S.WB.T[S.cells[j - 1]] / v;
  if (!t.enabled) return ["off", "excluded"];
  if (S.plan && S.plan.order.includes(j)) return ["in", `stop ${S.plan.order.indexOf(j) + 1}`];
  if (!isFinite(wb)) return ["out", "no walkable route"];
  if (S.lim != null && wb > S.lim * 60) return ["out", `beyond ${S.lim}-min shelter limit (${mins(wb)})`];
  const L = S.legs;
  if (!L[0][j] || !L[j][0]) return ["out", "no route inside limits"];
  const solo = S.K.egressS + L[0][j].unitT / S.K.v + t.station_min * 60 + L[j][0].unitT / S.K.v + S.K.ingressS;
  if (solo > Math.min(S.K.evaS, S.K.dayEndS)) return ["out", `too far for one EVA (round trip ${hm(solo)})`];
  if (S.K.egressS + L[0][j].maxTauWB / S.K.v > S.K.capS) return ["out", "fails walk-back criterion"];
  return ["", "not chosen: time used by higher-value stops"];
}
function renderTargetStatus() {
  S.targets.forEach((t, i) => {
    const c = $("chip-" + i);
    if (!c) return;
    const [cls, txt] = reasonFor(i + 1);
    c.className = "chip " + cls; c.textContent = txt;
  });
}

function drawRoute() {
  const p = S.mode === "plan" ? S.plan : goPlan();
  const ll = p ? M2.pathLatLngs(S.T, p.path) : [];
  S.route.setLatLngs(ll); S.routeCase.setLatLngs(ll);
  S.markers.clearLayers();
  const HAB = '<div class="hab-icon"><svg viewBox="0 0 24 24"><path d="M3 18a9 9 0 0 1 18 0z" fill="#1e1511"/><rect x="10" y="13" width="4" height="5" fill="#ff8c4a"/><path d="M2 19h20" stroke="#1e1511" stroke-width="2"/></svg></div>';
  L.marker(cellToLL(S.T, S.home), { icon: L.divIcon({ className: "", html: HAB, iconSize: [30, 30], iconAnchor: [15, 15] }), zIndexOffset: 500 })
    .bindTooltip("Habitat (assumed at the landing site)", { className: "stop-tip", direction: "top", offset: [0, -14] }).addTo(S.markers);
  if (S.roverOn && S.rover >= 0) L.marker(cellToLL(S.T, S.rover), { icon: L.divIcon({ className: "", html: '<div class="rover-icon">R</div>', iconSize: [28, 28], iconAnchor: [14, 14] }), zIndexOffset: 500 })
    .bindTooltip("Pressurized rover (safe haven)", { className: "stop-tip", direction: "top", offset: [0, -14] }).addTo(S.markers);
  // planned stops: one numbered badge per cluster of nearby stops (sites tens of metres apart)
  const groups = [];
  if (p) p.order.forEach((j, k) => {
    const t = S.targets[j - 1], g = groups.find((G) => G.some((x) => Math.hypot((x.t.lat - t.lat) * 59200, (x.t.lon - t.lon) * 56200) < 250));
    (g || groups[groups.push([]) - 1]).push({ t, k, i: j - 1 });
  });
  for (const g of groups) {
    const lat = g.reduce((a, x) => a + x.t.lat, 0) / g.length, lon = g.reduce((a, x) => a + x.t.lon, 0) / g.length;
    const nums = g.map((x) => x.k + 1), label = nums.length > 1 ? `${nums[0]}–${nums[nums.length - 1]}` : String(nums[0]);
    const cols = g.map((x) => objColor(x.t.objective)), bg = cols.every((c) => c === cols[0]) ? cols[0] : `linear-gradient(90deg,${cols.join(",")})`;
    const w = 28 + (label.length - 1) * 7;
    L.marker([lat, lon], { icon: L.divIcon({ className: "", html: `<div class="stop-badge" style="background:${bg};width:${w}px;border-radius:14px">${label}</div>`, iconSize: [w, 28], iconAnchor: [w / 2, 14] }), zIndexOffset: 300 })
      .addTo(S.markers).bindTooltip(g.map((x) => `${x.k + 1}. ${esc(x.t.name)}`).join("<br>"), { className: "stop-tip", direction: "top", offset: [0, -14] })
      .on("click", () => openStop(g[0].i));
  }
  S.targets.forEach((t, i) => {
    if (p && p.order.includes(i + 1)) return;
    L.circleMarker([t.lat, t.lon], { radius: 6, color: "#000", weight: 2, fillColor: objColor(t.objective), fillOpacity: t.enabled ? 0.6 : 0.2 })
      .addTo(S.markers).bindTooltip(`${esc(t.name)} · not in plan`, { className: "stop-tip", direction: "top", offset: [0, -6] })
      .on("click", () => openStop(i));
  });
}
function openStop(i) {
  if (S.mode !== "plan") return;
  setTab("stops");
  const el = $("tg-" + i);
  if (el) { el.classList.add("open"); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
}

// ------------------------------------------------------------------ Go / Abort
// Go/Abort follow the plan committed when Go was entered; limits ("allowed now") stay live.
const goPlan = () => (S.committed || S.plan);
function goPosition() {
  const p = goPlan();
  if (!p) return { t: 0, cell: startCell() };
  const t = S.goFrac * p.totalS, pr = p.profile;
  let lo = 0, hi = pr.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pr[m][0] <= t) lo = m; else hi = m - 1; }
  return { t, cell: t < p.K.egressS ? (S.committedStart ?? startCell()) : pr[lo][2] };
}
export function setGo(frac) { S.goFrac = frac; $("goT").value = Math.round(frac * 1000); renderGo(); }
function renderGo() {
  const p = goPlan();
  if (!p) { $("h-next").textContent = "No feasible plan"; return; }
  const { t, cell } = goPosition(), v = S.K.v;
  const wb = S.WB.T[cell] / v, al = allowed(t, S.K), mar = al - wb;
  $("h-clock").textContent = fmtH(ltstAt(t));
  $("h-clock2").textContent = `${hm(t)} elapsed` + (S.committed && S.swNow.level !== S.committedLevel ? " · limits changed" : "");
  $("h-wb").textContent = mins(wb);
  $("h-lim").textContent = mins(al);
  $("h-mar").textContent = mins(mar); $("h-mar").className = mar > 1800 ? "margin-ok" : mar > 0 ? "margin-low" : "margin-bad";
  const next = p.steps.find((s) => s.t1 > t && s.kind !== "egress");
  $("h-next").textContent = !next ? "Inside" : next.kind === "walk" ? `Walk to ${next.to ? S.targets[next.to - 1].name : homeName()} · ${mins(next.t1 - t)}` : next.kind === "station" ? `On station: ${next.label} · ${mins(next.t1 - t)} left` : next.label;
  const sw = S.swNow; $("h-sw").textContent = sw.level.toUpperCase(); $("h-sw").className = "badge " + sw.level;
  const ll = cellToLL(S.T, cell);
  S.me.setLatLng(ll).addTo(S.M.map);
  if (S.mode === "go") followMe(L.latLng(ll));
  const hc = $("hudChart");
  if (hc && hc.offsetParent) walkbackChart(hc, p, S.K, null, t);
  if (S.v3) S.v3.setWalker(cell, t);
}
let walkTimer = 0;
function toggleWalk() { if (walkTimer) return stopWalk(); $("goPlay").textContent = "❚❚ Pause"; walkTimer = setInterval(() => { S.goFrac = Math.min(1, S.goFrac + 0.002); $("goT").value = S.goFrac * 1000; renderGo(); if (S.goFrac >= 1) stopWalk(); }, 50); }
function stopWalk() { clearInterval(walkTimer); walkTimer = 0; $("goPlay").textContent = "▶ Walk"; }

export function renderAbort() {
  const c = S.abortCell >= 0 ? S.abortCell : goPosition().cell, v = S.ec.paceKmh / 3.6;
  const path = tracePath(S.WB.P, c), eta = S.WB.T[c] / v, f = S.policy.params.buddy_assist_pace_factor.value;
  S.abortLine.setLatLngs(M2.pathLatLngs(S.T, path));
  S.me.setLatLng(cellToLL(S.T, c)).addTo(S.M.map);
  let d = 0; for (let i = 1; i < path.length; i++) d += Math.hypot(((path[i] % S.T.w) - (path[i - 1] % S.T.w)) * S.T.cx, (((path[i] / S.T.w) | 0) - ((path[i - 1] / S.T.w) | 0)) * S.T.cy);
  const a = cellToLL(S.T, c), b = cellToLL(S.T, path[Math.min(path.length - 1, 8)]);
  const brg = ((Math.atan2((b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180), b[0] - a[0]) * 180) / Math.PI + 360) % 360;
  const dest = path[path.length - 1] === S.rover && S.roverOn ? "the pressurized rover" : "the habitat";
  $("a-eta").textContent = isFinite(eta) ? hm(eta) : "no route";
  $("a-eta2").textContent = isFinite(eta) ? hm(eta / f) : "–";
  $("a-dist").textContent = `${(d / 1000).toFixed(2)} km`;
  $("a-head").textContent = `${brg.toFixed(0)}° ${["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(brg / 45) % 8]}`;
  const lim = S.lim, sw = S.swNow;
  $("a-sw").textContent = sw.level.toUpperCase(); $("a-sw").className = "badge " + sw.level;
  $("a-note").innerHTML = `Follow the red dashed line: least-effort route to ${dest}. Background radiation during the walk ≈ ${(0.64 * eta / 86400).toFixed(3)} mSv (RAD baseline). ` +
    (sw.level !== "quiet" ? `<b>${sw.level.toUpperCase()}:</b> ` + (lim != null && eta > lim * 60 ? `this position is <b>${mins(eta - lim * 60)} beyond</b> the ${lim}-min shelter limit. Walkback keeps planned routes inside the limit so this does not happen; consider a closer safe haven (rover).` : `shelter reachable within the ${lim}-min limit.`) : "") +
    ` Buddy-assisted ETA assumes ${Math.round(f * 100)}% pace (assumption). Click the map to abort from another point.`;
  if (S.v3) S.v3.update(S);
}

// ------------------------------------------------------------------ evidence ("what the tool found")
export function computeFound() {
  const v = S.ec ? S.ec.paceKmh / 3.6 : 2 / 3.6;
  const lv = [["Quiet", null], ["Watch", shelterLimitMin("watch", S.policy)], ["Warning", shelterLimitMin("warning", S.policy)]];
  const res = lv.map(([n, lim]) => { const r = planFor({ level: n.toLowerCase(), caseName: "central", limit: lim }); return { n, lim, r }; });
  const nT = S.targets.length;
  const reach = (lim) => S.targets.filter((t, i) => { const wb = S.WB.T[S.cells[i]] / v; return isFinite(wb) && (lim == null || wb <= lim * 60) && wb * 2 + 3600 <= S.policy.params.eva_planned_h.value * 3600; }).length;
  $("found").innerHTML = `<table class="found-table"><tr><th>Alert</th><th>Shelter limit</th><th>Reachable*</th><th>Stops</th><th>Value</th><th>EVA</th></tr>` +
    res.map(({ n, lim, r }) => `<tr><td><span class="badge ${n.toLowerCase()}">${n.toUpperCase()}</span></td><td>${lim == null ? "none" : lim + " min"}</td><td>${reach(lim)} / ${nT}</td><td>${r.plan ? r.plan.order.length : 0}</td><td>${r.best.value}</td><td>${r.plan ? hm(r.plan.totalS) : "–"}</td></tr>`).join("") +
    `</table><small class="mut">*single out-and-back trip fits the ${S.policy.params.eva_planned_h.value} h EVA with 1 h for station and airlock. Central effort case, start ${fmtH(S.startLtst)} LTST${S.roverOn ? ", with rover safe haven" : ""}.</small>` +
    `<h3>Walk-back time from each target</h3><table class="found-table"><tr><th>Target</th><th>Walk-back</th><th>Terrain hazard</th></tr>${S.targets.map((t, i) => { const wb = S.WB.T[S.cells[i]] / v; return `<tr><td>${esc(t.name)}</td><td>${isFinite(wb) ? hm(wb) : "–"}</td><td>${((S.T.H[S.cells[i]] || 0) * 100).toFixed(0)} / 100</td></tr>`; }).join("")}</table>`;
  S.found = res.map(({ n, lim, r }) => ({ level: n, limit: lim, stops: r.plan ? r.plan.order.map((j) => S.targets[j - 1].id) : [], value: r.best.value, evaS: r.plan ? r.plan.totalS : 0 }));
}

// ------------------------------------------------------------------ backtest panel
async function loadBacktest() {
  try {
    if (!(S.site.extras || []).includes("traverse")) throw 0;
    const b = await fetchGet(`${BASE}/backtest.json`, "json");
    S.backtest = b;
    const s = b.summary;
    $("backtest").innerHTML = `<p>Walkback's router vs Perseverance's real drives (NASA traverse), ${s.n_pairs} waypoint pairs ${s.min_sep_m}–${s.max_sep_m} m apart inside the DEM.</p>
      <div class="stats"><div><b>${(s.median_overlap * 100).toFixed(0)}% vs ${(s.median_overlap_straight * 100).toFixed(0)}%</b><small>rover path within ${s.buffer_m} m of Walkback route vs straight line</small></div><div><b>${(100 - s.mean_act_blocked_share * 100).toFixed(1)}%</b><small>of ground the rover drove is walkable in our model</small></div><div><b>${s.median_maxslope_pred.toFixed(1)}° / ${s.median_maxslope_act.toFixed(1)}°</b><small>median max slope, predicted / driven</small></div></div>
      <p class="small mut">${esc(b.interpretation)}</p><label class="small"><input type="checkbox" id="btShow"> Show on map (white = rover, yellow = Walkback)</label>`;
    $("btShow").onchange = (e) => { $("ov-traverse").checked = e.target.checked; travLayer = null; toggleOverlay("traverse", e.target.checked); };
  } catch { $("backtest").innerHTML = `<small class="mut">No rover traverse backtest for this site pack (Jezero has one: <code>node scripts/backtest.mjs</code>).</small>`; }
}

// ------------------------------------------------------------------ assumptions & credits
function renderAssumptions() {
  const P = S.policy.params;
  $("assume").innerHTML = `<p class="small">Every limit lives in <code>config/policy.json</code> with its source. <span class="basis sourced">sourced</span> = published number, <span class="basis derived">derived</span> = computed from sources, <span class="basis assumed">assumed</span> = our placeholder.</p>` +
    Object.entries(P).map(([k, p]) => `<div class="assume-row"><b>${k.replace(/_/g, " ")}</b>: ${p.value == null ? "none" : p.value} ${p.unit} <span class="basis ${p.basis}">${p.basis}</span><br><small>${esc(p.source)}</small></div>`).join("") +
    `<h3>Effort model range</h3><p class="small">${esc(S.policy.effort_cases._about)}</p>` + ["low", "central", "high"].map((c) => `<div class="assume-row"><b>${c}</b>: <small>${esc(S.policy.effort_cases[c].source)}</small></div>`).join("") +
    (S.traffic ? `<h3>Trafficability</h3><p class="small">${esc(S.traffic.method)} Geology covers ${S.traffic.geology_coverage_pct}% of the grid; elsewhere hazard uses the DEM and thermal inertia only (hatched on the hazard map). The CTX DTM resolves features of roughly 60–100 m, so single boulders are not visible to it.</p>` : `<h3>Trafficability</h3><p class="small">This site pack has terrain only (slope + roughness). Geology and thermal-inertia layers are not built yet, so hazard confidence is low everywhere.</p>`) +
    `<h3>Not modelled</h3><p class="small">Suit thermal limits, lighting/shadows from terrain, dust storms beyond climatology, communications line of sight, and medical events other than a slowed (buddy-assisted) walk back. Rover/human path differences. These are listed in docs/IMPLEMENTATION.md.</p>`;
  $("credits").innerHTML = `Data: NASA Mars Trek (WMTS); ${esc(S.site.dem_source)}; ${esc(S.site.texture_source)}; ${S.traffic ? esc(S.traffic.sources.geology) + "; " + esc(S.traffic.sources.ti) + "; " : ""}${S.meda.source ? esc(S.meda.source) + "; " : ""}NASA CCMC DONKI (WSA-Enlil); Perseverance waypoints/traverse and raw images © NASA/JPL-Caltech (Mastcam-Z: NASA/JPL-Caltech/ASU). ` +
    `Walkback is a research prototype for NASA Space Apps 2026, not flight software. Built with AI assistance (see README).`;
}

boot().catch((e) => { console.error(e); document.body.insertAdjacentHTML("afterbegin", `<p style="background:#600;padding:8px">Walkback failed to start: ${esc(e.message)}</p>`); });

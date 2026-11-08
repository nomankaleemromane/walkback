// Plan export: GeoJSON, GPX and a printable EVA card (browser "Save as PDF").
import { cellToLL } from "./terrain.js";
import { fmtH } from "./marstime.js";

const SOL_H = 1.0275;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const ltst = (S, s) => fmtH(S.startLtst + s / 3600 / SOL_H);

function meta(S) {
  return {
    generator: "Walkback (NASA Space Apps 2026 prototype; not flight software)",
    generated_utc: new Date().toISOString(), site: S.site.name, verdict: S.verdict.verdict, binding: S.verdict.binding,
    space_weather: S.swNow.level, shelter_limit_min: S.lim, effort_case: S.caseName, start_ltst: fmtH(S.startLtst),
    policy_version: S.policy.version, checks: S.verdict.checks.map((c) => `${c.level}: ${c.text}`),
  };
}

export function exportGeoJSON(S) {
  const p = S.plan;
  const f = [];
  f.push({ type: "Feature", properties: { role: "habitat" }, geometry: { type: "Point", coordinates: cellToLL(S.T, S.home).reverse() } });
  if (p) {
    f.push({ type: "Feature", properties: { role: "route", length_m: Math.round(p.lengthM), eva_s: Math.round(p.totalS), max_slope_deg: +p.maxSlope.toFixed(1), max_walkback_s: Math.round(p.maxWBs) },
      geometry: { type: "LineString", coordinates: Array.from(p.path, (k) => cellToLL(S.T, k).reverse().map((v) => +v.toFixed(6))) } });
    p.steps.filter((s) => s.kind === "station").forEach((s, i) => {
      const t = S.targets[s.node - 1];
      f.push({ type: "Feature", properties: { role: "stop", seq: i + 1, id: t.id, name: t.name, objective: t.objective, priority: t.priority, arrive_ltst: ltst(S, s.t0), depart_ltst: ltst(S, s.t1), station_min: t.station_min, position_note: t.position_source },
        geometry: { type: "Point", coordinates: [t.lon, t.lat] } });
    });
  }
  download("walkback-plan.geojson", JSON.stringify({ type: "FeatureCollection", properties: meta(S), features: f }, null, 1), "application/geo+json");
}

export function exportGPX(S) {
  const p = S.plan, home = cellToLL(S.T, S.home);
  const wpt = (lat, lon, name, desc = "") => `<wpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><name>${esc(name)}</name><desc>${esc(desc)}</desc></wpt>`;
  let x = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Walkback" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>Walkback Marswalk plan</name><desc>${esc(JSON.stringify(meta(S)))}</desc></metadata>\n`;
  x += wpt(home[0], home[1], "Habitat") + "\n";
  if (p) {
    p.steps.filter((s) => s.kind === "station").forEach((s, i) => { const t = S.targets[s.node - 1]; x += wpt(t.lat, t.lon, `${i + 1}. ${t.name}`, `arrive ${ltst(S, s.t0)} LTST, ${t.station_min} min`) + "\n"; });
    x += `<trk><name>Planned route</name><trkseg>` + Array.from(p.path, (k) => { const [a, b] = cellToLL(S.T, k); return `<trkpt lat="${a.toFixed(6)}" lon="${b.toFixed(6)}"><ele>${S.T.Z[k]}</ele></trkpt>`; }).join("") + `</trkseg></trk>\n`;
  }
  download("walkback-plan.gpx", x + "</gpx>\n", "application/gpx+xml");
}

// Route map rendered on the local CTX texture (same origin, so the canvas stays exportable).
async function mapImage(S) {
  const img = new Image();
  img.src = `data/sites/${S.site.id}/texture.jpg`;
  await img.decode();
  const p = S.plan, T = S.T, cells = p ? [...p.path, S.home] : [S.home];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of cells) { const x = k % T.w, y = (k / T.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const m = 25; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(T.w, x1 + m); y1 = Math.min(T.h, y1 + m);
  const sx = img.width / T.w, sy = img.height / T.h, W = 1000, H = Math.round((W * (y1 - y0) * sy) / ((x1 - x0) * sx));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.drawImage(img, x0 * sx, y0 * sy, (x1 - x0) * sx, (y1 - y0) * sy, 0, 0, W, H);
  const X = (k) => (((k % T.w) + 0.5 - x0) / (x1 - x0)) * W, Y = (k) => ((((k / T.w) | 0) + 0.5 - y0) / (y1 - y0)) * H;
  if (p) {
    g.lineWidth = 6; g.strokeStyle = "#000"; g.beginPath(); p.path.forEach((k, i) => (i ? g.lineTo(X(k), Y(k)) : g.moveTo(X(k), Y(k)))); g.stroke();
    g.lineWidth = 3; g.strokeStyle = "#00b8e6"; g.stroke();
    g.font = "bold 20px sans-serif";
    p.order.forEach((j, i) => { const k = S.cells[j - 1]; g.fillStyle = "#ffd166"; g.beginPath(); g.arc(X(k), Y(k), 12, 0, 7); g.fill(); g.fillStyle = "#000"; g.fillText(String(i + 1), X(k) - 6, Y(k) + 7); });
  }
  g.fillStyle = "#fff"; g.font = "bold 26px sans-serif"; g.fillText("⌂", X(S.home) - 9, Y(S.home) + 9);
  const km = 1000 / (T.cx * (x1 - x0)) * W; g.fillStyle = "#fff"; g.fillRect(20, H - 30, km, 6); g.font = "14px sans-serif"; g.fillText("1 km", 20, H - 38);
  return c.toDataURL("image/jpeg", 0.85);
}

export async function printCard(S) {
  const p = S.plan, V = S.verdict, M = meta(S);
  const el = document.getElementById("printCard");
  const rows = p ? p.steps.map((s) => `<tr><td>${ltst(S, s.t0)}</td><td>${s.kind === "walk" ? `Walk to ${esc(s.to ? S.targets[s.to - 1].name : "habitat")} (${(s.lengthM / 1000).toFixed(2)} km, max ${s.maxSlope.toFixed(0)}°, ≤ ${Math.round(s.maxWBs / 60)} min from shelter)` : esc(s.label)}</td><td>${Math.round((s.t1 - s.t0) / 60)} min</td></tr>`).join("") : "";
  let img = "";
  try { img = await mapImage(S); } catch {}
  el.innerHTML = `<h1>Walkback EVA card · ${esc(S.site.name)}</h1>
    <p><b>${V.verdict}</b> · ${p ? `${p.order.length} stops, ${(p.lengthM / 1000).toFixed(1)} km, ${(p.totalS / 3600).toFixed(2)} h` : "no feasible plan"} · start ${M.start_ltst} LTST · space weather ${M.space_weather.toUpperCase()} · shelter limit ${M.shelter_limit_min == null ? "none beyond consumables" : M.shelter_limit_min + " min"} · effort case ${M.effort_case}</p>
    ${img ? `<img src="${img}" alt="Route map">` : ""}
    <h2>Timeline (local true solar time)</h2><table><tr><th>LTST</th><th>Activity</th><th>Duration</th></tr>${rows}</table>
    <h2>Checks</h2><ul>${V.checks.map((c) => `<li>${c.level.toUpperCase()}: ${esc(c.text)}</li>`).join("")}</ul>
    <h2>Abort rule</h2><p>If a space-weather WARNING arrives or a suit/medical problem occurs: stop, follow the walk-back route to the nearest shelter (Abort mode). Buddy-assisted walk-back pace assumed ${Math.round(S.policy.params.buddy_assist_pace_factor.value * 100)}%.</p>
    <p style="font-size:8pt">Generated ${M.generated_utc} by Walkback, a NASA Space Apps 2026 research prototype on real NASA/USGS data. Not flight software. Effort is an index from Earth data. Policy ${M.policy_version}.</p>`;
  el.hidden = false;
  setTimeout(() => { window.print(); el.hidden = true; }, 100);
}

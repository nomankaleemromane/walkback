// Canvas charts. Each takes a canvas and plain data; no global state.
import { fmtH } from "./marstime.js";

const C = { grid: "#3a2c25", text: "#b4a397", fg: "#f4ebe4", line: "#33d6ff", rad: "#e0453a", cap: "#ff9a5c", day: "#ffd166", eva: "#9b8cff", ok: "rgba(47,168,79,.16)" };

function setup(cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth || cv.width, h = Math.round(w * cv.height / cv.width);
  if (cv._w !== w || cv._dpr !== dpr) { cv.width = w * dpr; cv.height = h * dpr; cv._w = w; cv._dpr = dpr; cv._h = h; }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, cv._h);
  g.font = "11px system-ui, sans-serif";
  return { g, w, h: cv._h };
}

// Walk-back margin chart: x = EVA elapsed time, y = minutes to shelter.
// Limits: radiation (flat), consumables (cap - t), daylight (dayEnd - t), planned EVA end (vertical).
export function walkbackChart(cv, plan, K, binding, nowS = null) {
  const { g, w, h } = setup(cv);
  if (!plan) { g.fillStyle = C.text; g.fillText("No feasible plan.", 10, 20); return; }
  const L = 40, R = 10, T = 12, B = 22, PW = w - L - R, PH = h - T - B;
  const xMax = Math.max(K.evaS, plan.totalS) * 1.03;
  const pmax = Math.max(...plan.profile.map((p) => p[1] / 60));
  const yMaxC = Math.min(300, Math.max(60, pmax * 1.5, isFinite(K.radS) ? (K.radS / 60) * 1.2 : 0));
  const X = (s) => L + (s / xMax) * PW, Y = (m) => T + PH - (Math.min(m, yMaxC) / yMaxC) * PH;
  // allowed region
  g.fillStyle = C.ok; g.beginPath();
  for (let i = 0; i <= 60; i++) { const s = (i / 60) * xMax; g.lineTo(X(s), Y(Math.max(0, allowed(s, K)) / 60)); }
  g.lineTo(X(xMax), Y(0)); g.lineTo(X(0), Y(0)); g.fill();
  // grid
  g.strokeStyle = C.grid; g.fillStyle = C.text; g.lineWidth = 1;
  for (let m = 0; m <= yMaxC; m += yMaxC > 200 ? 60 : yMaxC > 90 ? 30 : 15) { g.beginPath(); g.moveTo(L, Y(m)); g.lineTo(L + PW, Y(m)); g.stroke(); g.fillText(m + "m", 4, Y(m) + 4); }
  for (let hh = 0; hh * 3600 <= xMax; hh++) { g.fillText(hh + "h", X(hh * 3600) - 6, h - 6); }
  const lim = (fn, col, key, label) => {
    g.strokeStyle = col; g.lineWidth = binding === key ? 3 : 1.5; g.setLineDash(binding === key ? [] : [5, 4]);
    g.beginPath(); let started = false;
    for (let i = 0; i <= 80; i++) { const s = (i / 80) * xMax, v = fn(s); if (!isFinite(v)) continue; const yy = Y(Math.max(0, v) / 60); started ? g.lineTo(X(s), yy) : g.moveTo(X(s), yy); started = true; }
    g.stroke(); g.setLineDash([]);
    return label;
  };
  const labels = [];
  if (isFinite(K.radS)) labels.push([lim(() => K.radS, C.rad, "radiation"), C.rad, "radiation"]);
  labels.push([lim((s) => K.capS - s, C.cap, "consumables"), C.cap, "consumables"]);
  if (isFinite(K.dayEndS)) labels.push([lim((s) => K.dayEndS - s, C.day, "daylight"), C.day, "daylight"]);
  // EVA end
  g.strokeStyle = C.eva; g.lineWidth = binding === "eva" ? 3 : 1.5; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(X(K.evaS), T); g.lineTo(X(K.evaS), T + PH); g.stroke(); g.setLineDash([]);
  // the plan's time-to-shelter
  g.strokeStyle = C.line; g.lineWidth = 2.5; g.beginPath();
  plan.profile.forEach(([t, wb], i) => (i ? g.lineTo(X(t), Y(wb / 60)) : g.moveTo(X(t), Y(wb / 60))));
  g.stroke();
  if (nowS != null) { g.strokeStyle = "#fff"; g.lineWidth = 1; g.beginPath(); g.moveTo(X(nowS), T); g.lineTo(X(nowS), T + PH); g.stroke(); }
  const leg = cv.nextElementSibling && cv.nextElementSibling.classList.contains("chart-legend") ? cv.nextElementSibling : null;
  if (leg) {
    const items = [["plan: time to shelter", C.line, "plan"], ...labels.map(([, c, k]) => [k === "radiation" ? "radiation limit" : k === "consumables" ? "consumables walk-back limit" : "back before sunset", c, k]), ["planned EVA end", C.eva, "eva"]];
    leg.innerHTML = items.map(([t, c, k]) => `<span class="${k === binding ? "bind" : ""}"><i style="background:${c}"></i>${t}${k === binding ? " (binding)" : ""}</span>`).join("") + `<span><i style="background:rgba(47,168,79,.5)"></i>allowed region</span>`;
  }
}
export function allowed(s, K) { return Math.min(K.radS, K.capS - s, K.dayEndS - s); }

// Elevation profile coloured by time to shelter.
export function profileChart(cv, T, plan, K) {
  const { g, w, h } = setup(cv);
  if (!plan || plan.path.length < 2) return;
  const p = plan.path, zs = Array.from(p, (k) => T.Z[k]);
  let d = 0; const cum = [0];
  for (let i = 1; i < p.length; i++) { d += Math.hypot(((p[i] % T.w) - (p[i - 1] % T.w)) * T.cx, (((p[i] / T.w) | 0) - ((p[i - 1] / T.w) | 0)) * T.cy); cum.push(d); }
  const z0 = Math.min(...zs) - 5, z1 = Math.max(...zs) + 5, L = 46, PW = w - L - 8, PH = h - 26;
  const X = (i) => L + (cum[i] / d) * PW, Y = (z) => 8 + PH - ((z - z0) / (z1 - z0)) * PH;
  const wbAt = new Map(plan.profile.map(([, wb, c]) => [c, wb]));
  const lim = isFinite(K.radS) ? K.radS : K.capS / 2;
  for (let i = 1; i < p.length; i++) {
    const f = Math.min(1, (wbAt.get(p[i]) || 0) / lim);
    g.strokeStyle = `hsl(${120 - 120 * f},75%,52%)`; g.lineWidth = 3;
    g.beginPath(); g.moveTo(X(i - 1), Y(zs[i - 1])); g.lineTo(X(i), Y(zs[i])); g.stroke();
  }
  g.fillStyle = C.text;
  g.fillText(`${z1.toFixed(0)} m`, 2, 14); g.fillText(`${z0.toFixed(0)} m`, 2, PH + 8);
  g.fillText(`${(d / 1000).toFixed(1)} km · colour = time to shelter (green near, red at the limit)`, L, h - 4);
}

// MEDA temperature by local solar time with daylight and the EVA window.
export function tempChart(cv, bin, hours, startH, endH, sun) {
  const { g, w, h } = setup(cv);
  if (!bin) { g.fillStyle = C.text; g.fillText("No MEDA climatology for this season.", 10, 20); return; }
  const L = 38, PW = w - L - 10, PH = h - 40, T0 = -100, T1 = 10;
  const X = (hh) => L + (hh / 24) * PW, Y = (t) => 10 + PH - ((t - T0) / (T1 - T0)) * PH;
  // night shading
  g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(X(0), 10, X(sun.rise) - X(0), PH); g.fillRect(X(sun.set), 10, X(24) - X(sun.set), PH);
  // EVA window
  g.fillStyle = "rgba(255,154,92,.18)"; g.fillRect(X(startH), 10, X(Math.min(24, endH)) - X(startH), PH);
  g.strokeStyle = C.grid; g.fillStyle = C.text;
  for (let t = -80; t <= 0; t += 20) { g.beginPath(); g.moveTo(L, Y(t)); g.lineTo(L + PW, Y(t)); g.stroke(); g.fillText(t + "°", 4, Y(t) + 4); }
  for (let hh = 0; hh <= 24; hh += 3) g.fillText(String(hh).padStart(2, "0"), Math.min(X(hh) - 6, w - 16), 10 + PH + 13);
  const pts = bin.temp_c_by_ltst.map((v, i) => [hours[i] + 0.25, v]).filter(([, v]) => v);
  g.fillStyle = "rgba(51,214,255,.18)"; g.beginPath();
  pts.forEach(([x, v], i) => (i ? g.lineTo(X(x), Y(v[2])) : g.moveTo(X(x), Y(v[2]))));
  [...pts].reverse().forEach(([x, v]) => g.lineTo(X(x), Y(v[1]))); g.fill();
  g.strokeStyle = C.line; g.lineWidth = 2; g.beginPath(); pts.forEach(([x, v], i) => (i ? g.lineTo(X(x), Y(v[0])) : g.moveTo(X(x), Y(v[0])))); g.stroke();
  g.fillStyle = C.fg;
  g.fillText(`air temp 1.45 m (mean, 10–90%) · EVA ${fmtH(startH)}–${fmtH(endH)} · sunset ≈ ${fmtH(sun.set)}`, L, h - 4);
}

export function tempRange(bin, hours, h0, h1) {
  if (!bin) return null;
  let lo = Infinity, hi = -Infinity;
  bin.temp_c_by_ltst.forEach((v, i) => { const hh = hours[i]; if (v && hh + 0.5 > h0 && hh < h1) { lo = Math.min(lo, v[1]); hi = Math.max(hi, v[2]); } });
  return isFinite(lo) ? { lo, hi } : null;
}

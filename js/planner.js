// Multi-stop science planner (orienteering problem) + timeline + verdict. Pure, no DOM.
//
// Choose and order science stops to maximise total priority subject to:
//   1. planned EVA time (egress + walking + stations + ingress) <= eva_planned_h
//   2. walk-back criterion: at EVERY point, elapsed time + walk-back time <= consumables - reserve
//   3. radiation: every point within the shelter-time limit for the space-weather level
//      (enforced by masking the graph, so routes detour to stay inside the zone)
//   4. daylight: back inside by sunset - margin
//   5. slope <= never-exceed limit and terrain hazard below the block level (graph)
// Exact branch-and-bound over orderings (fine for <= ~14 candidates, because time prunes hard).
import { dijkstra, tracePath, boxAround, pathStats } from "./router.js";
import { applyCase, avgPower } from "./model.js";

// ---- legs between all nodes (node 0 = habitat)
export function buildLegs(T, WB, nodeCells, { allow = null, hazW = 1.5, marginCells = 40 } = {}) {
  const box = boxAround(T, nodeCells, marginCells);
  const N = nodeCells.length, legs = Array.from({ length: N }, () => new Array(N).fill(null));
  for (let i = 0; i < N; i++) {
    if (nodeCells[i] < 0) continue;
    const others = nodeCells.filter((c, j) => j !== i && c >= 0);
    const R = dijkstra(T, { sources: [nodeCells[i]], allow, hazW, box, targets: others });
    for (let j = 0; j < N; j++) {
      if (i === j || nodeCells[j] < 0 || !isFinite(R.C[nodeCells[j]])) continue;
      const path = tracePath(R.P, nodeCells[j]).reverse();
      let maxTauWB = 0, maxWB = 0;
      const tau = new Float32Array(path.length);
      path.forEach((c, q) => { tau[q] = R.T[c]; maxTauWB = Math.max(maxTauWB, R.T[c] + WB.T[c]); maxWB = Math.max(maxWB, WB.T[c]); });
      legs[i][j] = { unitE: R.E[nodeCells[j]], unitT: R.T[nodeCells[j]], path: Int32Array.from(path), tau, maxTauWB, maxWB, ...pathStats(T, path) };
    }
  }
  return { legs, box };
}

// ---- constraints in real seconds for one effort case
export function makeConstraints(policy, ec, { startLtst, sunsetLtst, radLimitMin }) {
  const P = policy.params;
  const v = ec.paceKmh / 3.6; // m/s on the flat
  const half = (P.egress_ingress_min.value * 60) / 2;
  const dayEndS = sunsetLtst != null ? (sunsetLtst - startLtst) * 3600 * 1.0275 - P.sunset_margin_min.value * 60 : Infinity; // 1 sol-hour = 1.0275 h
  return {
    v, ec,
    egressS: half, ingressS: half,
    evaS: P.eva_planned_h.value * 3600,
    capS: P.consumables_h.value * 3600 - P.consumables_reserve_min.value * 60,
    dayEndS,
    radS: radLimitMin == null ? Infinity : radLimitMin * 60,
    effortRefW: P.effort_ref_w.value,
  };
}

// ---- exact orienteering by branch and bound
export function solve(legs, targets, K, { maxStops = 8, required = [] } = {}) {
  const N = legs.length; // node 0 = home, node j>=1 = targets[j-1]
  const val = (j) => targets[j - 1].priority;
  const st = (j) => (targets[j - 1].station_min ?? 20) * 60;
  const endLimit = Math.min(K.evaS, K.dayEndS);
  const cand = [];
  for (let j = 1; j < N; j++) if (legs[0][j] && legs[j][0] && targets[j - 1].enabled !== false) cand.push(j);
  const total = cand.reduce((s, j) => s + val(j), 0);
  let best = { value: 0, time: 0, order: [] };
  const order = [], used = new Uint8Array(N);
  const tryClose = (cur, t, value) => {
    const back = legs[cur][0];
    if (!back) return;
    const tEnd = t + back.unitT / K.v + K.ingressS;
    if (tEnd > endLimit) return;
    if (t + back.maxTauWB / K.v > K.capS) return;
    if (required.some((r) => !order.includes(r))) return;
    if (value > best.value + 1e-9 || (Math.abs(value - best.value) < 1e-9 && tEnd < best.time)) best = { value, time: tEnd, order: order.slice() };
  };
  const dfs = (cur, t, value, remaining) => {
    tryClose(cur, t, value);
    if (order.length >= maxStops || value + remaining < best.value - 1e-9) return;
    for (const j of cand) {
      if (used[j]) continue;
      const L = legs[cur][j];
      if (!L) continue;
      if (t + L.maxTauWB / K.v > K.capS) continue; // walk-back criterion along the leg
      const arrive = t + L.unitT / K.v, depart = arrive + st(j);
      const back = legs[j][0];
      if (depart + back.unitT / K.v + K.ingressS > endLimit) continue;
      if (depart + WBat(back) / K.v > K.capS) continue;
      used[j] = 1; order.push(j);
      dfs(j, depart, value + val(j), remaining - val(j));
      order.pop(); used[j] = 0;
    }
  };
  dfs(0, K.egressS, 0, total);
  return best;
}
const WBat = (backLeg) => backLeg.maxTauWB; // conservative: max over the return path of (tau + walk-back)

// ---- timeline, totals, checks for a given order under constraints K
export function evaluate(T, WB, legs, targets, order, K, policy) {
  const P = policy.params;
  const seq = [0, ...order, 0];
  let t = K.egressS, joules = 0, walkS = 0, lenM = 0, gain = 0, maxS = 0, maxH = 0, maxWB = 0, minCapMargin = Infinity;
  const steps = [{ kind: "egress", t0: 0, t1: K.egressS, label: "Egress (airlock)" }];
  const profile = []; // [elapsed s, walk-back s, cell] along the route
  const path = [];
  for (let q = 1; q < seq.length; q++) {
    const L = legs[seq[q - 1]][seq[q]];
    if (!L) return null;
    const { joules: J, seconds: S } = applyCase(L.unitE, L.unitT, K.ec);
    for (let c = 0; c < L.path.length; c++) profile.push([t + L.tau[c] / K.v, WB.T[L.path[c]] / K.v, L.path[c]]);
    minCapMargin = Math.min(minCapMargin, K.capS - (t + L.maxTauWB / K.v));
    steps.push({ kind: "walk", t0: t, t1: t + S, from: seq[q - 1], to: seq[q], lengthM: L.lengthM, joules: J, gainM: L.gainM, lossM: L.lossM, maxSlope: L.maxSlope, maxHazard: L.maxHazard, maxWBs: L.maxWB / K.v });
    t += S; joules += J; walkS += S; lenM += L.lengthM; gain += L.gainM;
    maxS = Math.max(maxS, L.maxSlope); maxH = Math.max(maxH, L.maxHazard); maxWB = Math.max(maxWB, L.maxWB / K.v);
    for (let c = q === 1 ? 0 : 1; c < L.path.length; c++) path.push(L.path[c]);
    if (q < seq.length - 1) {
      const tg = targets[seq[q] - 1], s = (tg.station_min ?? 20) * 60;
      steps.push({ kind: "station", t0: t, t1: t + s, node: seq[q], label: tg.name });
      const c = L.path[L.path.length - 1];
      profile.push([t, WB.T[c] / K.v, c], [t + s, WB.T[c] / K.v, c]);
      t += s;
    }
  }
  steps.push({ kind: "ingress", t0: t, t1: t + K.ingressS, label: "Ingress (airlock)" });
  const totalS = t + K.ingressS;
  // share of walked distance on rough/soft ground (each path step counted by its length)
  const hc = policy.params.hazard_caution ? policy.params.hazard_caution.value : 0.6;
  let roughM = 0, allM = 0; const kinds = {};
  for (let q = 1; q < path.length; q++) {
    const a = path[q - 1], b = path[q];
    const d = Math.hypot(((b % T.w) - (a % T.w)) * T.cx, (((b / T.w) | 0) - ((a / T.w) | 0)) * T.cy);
    allM += d;
    if (Math.max(T.H[a], T.H[b]) >= hc) { roughM += d; if (T.groundName) { const n = T.groundName(T.H[b] >= T.H[a] ? b : a); kinds[n] = (kinds[n] || 0) + d; } }
  }
  const roughShare = allM > 0 ? roughM / allM : 0;
  const roughKind = Object.entries(kinds).sort((x, y) => y[1] - x[1]).map((e) => e[0])[0] || null;
  return { order, steps, path, profile, totalS, roughShare, roughM, roughKind, walkS, joules, lengthM: lenM, gainM: gain, maxSlope: maxS, maxHazard: maxH, maxWBs: maxWB, minCapMarginS: minCapMargin, avgW: avgPower(joules, walkS), K };
}

// ---- verdict with the binding constraint
// Returns { verdict: 'GO'|'CAUTION'|'NO-GO', checks: [{ok, level, text, marginS}], binding }
export function verdict(plan, K, ctx) {
  const P = ctx.policy.params, checks = [];
  const add = (level, text, marginS = null, key = null) => checks.push({ level, text, marginS, key });
  if (!plan || !plan.order.length) {
    add("fail", "No science stop can be reached and returned from within the limits.", null, "none");
    return { verdict: "NO-GO", checks, binding: null };
  }
  const evaM = K.evaS - plan.totalS, capM = plan.minCapMarginS, dayM = K.dayEndS - plan.totalS, radM = K.radS - plan.maxWBs;
  const m = (s) => `${Math.round(s / 60)} min`;
  add(evaM >= 15 * 60 ? "ok" : evaM >= 0 ? "caution" : "fail", `EVA ${(plan.totalS / 3600).toFixed(2)} h of ${P.eva_planned_h.value} h planned (margin ${m(evaM)})`, evaM, "eva");
  add(capM >= 30 * 60 ? "ok" : capM >= 0 ? "caution" : "fail", `Walk-back criterion: elapsed + walk-back stays ${m(capM)} under the ${P.consumables_h.value} h consumables minus ${P.consumables_reserve_min.value} min reserve`, capM, "consumables");
  if (isFinite(K.radS)) add(radM >= 5 * 60 ? "ok" : radM >= 0 ? "caution" : "fail", `Radiation: farthest point ${m(plan.maxWBs)} from shelter (limit ${m(K.radS)})`, radM, "radiation");
  else add("ok", `Radiation: quiet; farthest point ${m(plan.maxWBs)} from shelter (no extra limit)`, null, "radiation");
  if (isFinite(K.dayEndS)) add(dayM >= 15 * 60 ? "ok" : dayM >= 0 ? "caution" : "fail", `Daylight: back ${m(dayM + P.sunset_margin_min.value * 60)} before sunset (needs ${P.sunset_margin_min.value} min)`, dayM, "daylight");
  add(plan.maxSlope <= P.caution_slope_deg.value ? "ok" : plan.maxSlope <= P.max_slope_deg.value ? "caution" : "fail", `Steepest ground ${plan.maxSlope.toFixed(1)}° (caution ${P.caution_slope_deg.value}°, limit ${P.max_slope_deg.value}°)`, null, "slope");
  const hShare = P.hazard_caution_share ? P.hazard_caution_share.value : 0.05, hHigh = P.hazard_high ? P.hazard_high.value : 0.7;
  const rs = plan.roughShare ?? (plan.maxHazard >= 0.6 ? 1 : 0), roughOk = rs <= hShare && plan.maxHazard < hHigh;
  add(roughOk ? "ok" : "caution", rs > 0
    ? `Crosses ${plan.roughKind || "rough or soft ground"} on ${(rs * 100).toFixed(0)}% of the route (${(plan.roughM / 1000).toFixed(1)} km; caution above ${Math.round(hShare * 100)}%)`
    : `No rough or soft ground on the route (peak hazard ${(plan.maxHazard * 100).toFixed(0)}/100)`, null, "hazard");
  add(plan.avgW <= K.effortRefW ? "ok" : "caution", `Average walking effort ${plan.avgW.toFixed(0)} W (${K.ec.name} case; reference ${K.effortRefW} W)`, null, "effort");
  if (ctx.coldC != null) add(ctx.coldC >= P.cold_limit_c.value ? "ok" : "caution", `Coldest air temperature during EVA ≈ ${ctx.coldC.toFixed(0)} °C (MEDA climatology; caution below ${P.cold_limit_c.value} °C)`, null, "cold");
  if (ctx.level === "warning" && P.warning_blocks_new_eva.value) add("fail", "Space-weather WARNING: policy blocks starting a new EVA. Reduced plan shown for reference.", null, "policy");
  if (ctx.sensitivity && ctx.sensitivity.high && !ctx.sensitivity.high.ok) add("caution", "Fails under the pessimistic effort/pace case (see sensitivity).", null, "sensitivity");
  // binding = the time constraint with the smallest margin
  const time = checks.filter((c) => ["eva", "consumables", "radiation", "daylight"].includes(c.key) && c.marginS != null);
  const binding = time.length ? time.reduce((a, b) => (b.marginS < a.marginS ? b : a)).key : null;
  const v = checks.some((c) => c.level === "fail") ? "NO-GO" : checks.some((c) => c.level === "caution") ? "CAUTION" : "GO";
  return { verdict: v, checks, binding };
}

// Does a fixed order still satisfy the hard limits under another effort case?
export function checkOrder(T, WB, legs, targets, order, K, policy) {
  const p = evaluate(T, WB, legs, targets, order, K, policy);
  if (!p) return { ok: false };
  const ok = p.totalS <= K.evaS && p.minCapMarginS >= 0 && p.totalS <= K.dayEndS && p.maxWBs <= K.radS;
  return { ok, plan: p };
}

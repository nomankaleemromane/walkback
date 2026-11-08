// Compute the Jezero case-study numbers quoted in the docs. Usage: node scripts/report.mjs
// Writes docs/results.json. Same model code as the app (js/).
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { loadAll, ROOT } from "../tests/helpers.js";
import { dijkstra } from "../js/router.js";
import { llToCell, nearestPassable } from "../js/terrain.js";
import { buildLegs, makeConstraints, solve, evaluate, verdict, checkOrder } from "../js/planner.js";
import { effortCase } from "../js/model.js";
import { shelterLimitMin } from "../js/spaceweather.js";
import { marsTime } from "../js/marstime.js";

const A = await loadAll("jezero");
const { T, policy, site, targets, meda } = A;
const tg = targets.targets;
const hazW = policy.params.hazard_route_weight.value;
const home = nearestPassable(T, llToCell(T, ...site.habitat));
const cells = tg.map((t) => nearestPassable(T, llToCell(T, t.lat, t.lon)));
const rover = nearestPassable(T, llToCell(T, 18.4545, 77.4105));
const START = 9;
const mt = marsTime(new Date(), site.habitat[1]);
const bin = meda.bins.find((b) => mt.Ls >= b.ls0 && mt.Ls < b.ls1);

function run({ level, limit, caseName = "central", withRover = false, fromRover = false, start = START, sunset = bin.sunset_ltst }) {
  const WB = dijkstra(T, { sources: withRover ? [home, rover] : [home], reverse: true, hazW });
  const ec = effortCase(policy, caseName), v = ec.paceKmh / 3.6;
  const allow = limit == null ? null : Uint8Array.from(WB.T, (t) => (t / v <= limit * 60 ? 1 : 0));
  const { legs } = buildLegs(T, WB, [fromRover ? rover : home, ...cells], { allow, hazW });
  const K = makeConstraints(policy, ec, { startLtst: start, sunsetLtst: sunset, radLimitMin: limit });
  const best = solve(legs, tg, K);
  const plan = best.order.length ? evaluate(T, WB, legs, tg, best.order, K, policy) : null;
  const sens = {};
  for (const c of ["low", "high"]) {
    const e2 = effortCase(policy, c);
    const K2 = makeConstraints(policy, e2, { startLtst: start, sunsetLtst: sunset, radLimitMin: limit });
    sens[c] = plan ? checkOrder(T, WB, legs, tg, plan.order, K2, policy).ok : false;
  }
  const vd = verdict(plan, K, { policy, level, sensitivity: { high: { ok: sens.high } } });
  return {
    level, limit_min: limit, case: caseName, rover: withRover, from_rover: fromRover, start_ltst: start,
    stops: plan ? plan.order.map((j) => tg[j - 1].name) : [], value: best.value,
    eva_h: plan ? +(plan.totalS / 3600).toFixed(2) : 0, km: plan ? +(plan.lengthM / 1000).toFixed(2) : 0,
    max_walkback_min: plan ? Math.round(plan.maxWBs / 60) : 0, verdict: vd.verdict, binding: vd.binding,
    holds_low: sens.low, holds_high: sens.high,
    walkback_min: Object.fromEntries(tg.map((t, i) => [t.name, Math.round(WB.T[cells[i]] / v / 60)])),
  };
}

const L = (l) => shelterLimitMin(l, policy);
const out = {
  generated: new Date().toISOString(), season_Ls: +mt.Ls.toFixed(1), sunset_ltst: bin.sunset_ltst, start_ltst: START,
  runs: [
    run({ level: "quiet", limit: L("quiet") }),
    run({ level: "watch", limit: L("watch") }),
    run({ level: "warning", limit: L("warning") }),
    run({ level: "warning", limit: L("warning"), withRover: true }),
    run({ level: "warning", limit: L("warning"), withRover: true, fromRover: true }),
    run({ level: "quiet", limit: L("quiet"), withRover: true, fromRover: true }),
    run({ level: "quiet", limit: L("quiet"), caseName: "low" }),
    run({ level: "quiet", limit: L("quiet"), caseName: "high" }),
    run({ level: "quiet", limit: L("quiet"), start: 13 }),
  ],
};
for (const r of out.runs) console.log(`${r.level.padEnd(8)} lim ${String(r.limit_min).padEnd(4)} ${r.case.padEnd(7)} rover ${r.rover ? (r.from_rover ? "start" : "parked") : "no"} start ${r.start_ltst}: ${r.stops.length} stops (value ${r.value}) ${r.eva_h} h ${r.km} km maxWB ${r.max_walkback_min} min -> ${r.verdict} [${r.binding}] low ${r.holds_low} high ${r.holds_high} | ${r.stops.join(", ")}`);
console.log("walk-back (central, habitat only):", out.runs[0].walkback_min);
console.log("walk-back with rover:", out.runs[3].walkback_min);
await writeFile(path.join(ROOT, "docs", "results.json"), JSON.stringify(out, null, 1));

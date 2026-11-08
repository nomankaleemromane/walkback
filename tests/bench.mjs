import { loadAll } from "./helpers.js";
import { dijkstra } from "../js/router.js";
import { llToCell, nearestPassable } from "../js/terrain.js";
import { buildLegs, makeConstraints, solve, evaluate, verdict } from "../js/planner.js";
import { effortCase } from "../js/model.js";
const t0 = performance.now();
const A = await loadAll();
const { T, policy, site, targets } = A;
console.log("load+terrain ms", (performance.now() - t0).toFixed(0), "passable %", (T.pass.reduce((a, b) => a + b, 0) / T.n * 100).toFixed(1));
const home = nearestPassable(T, llToCell(T, ...site.habitat));
let t1 = performance.now();
const WB = dijkstra(T, { sources: [home], reverse: true, hazW: policy.params.hazard_route_weight.value });
console.log("walkback field ms", (performance.now() - t1).toFixed(0));
const tg = targets.targets;
const cells = [home, ...tg.map((t) => nearestPassable(T, llToCell(T, t.lat, t.lon)))];
const ec = effortCase(policy, "central"), v = ec.paceKmh / 3.6;
tg.forEach((t, i) => console.log(t.name.padEnd(34), "walkback", (WB.T[cells[i + 1]] / v / 60).toFixed(0), "min"));
for (const lvl of [null, 90, 30]) {
  t1 = performance.now();
  const allow = lvl == null ? null : Uint8Array.from(WB.T, (x) => (x / v <= lvl * 60 ? 1 : 0));
  const { legs } = buildLegs(T, WB, cells, { allow, hazW: 1.5 });
  const tl = performance.now() - t1;
  const K = makeConstraints(policy, ec, { startLtst: 9, sunsetLtst: 17.6, radLimitMin: lvl });
  const best = solve(legs, tg, K);
  const plan = evaluate(T, WB, legs, tg, best.order, K, policy);
  const vd = verdict(plan, K, { policy, level: lvl == 30 ? "warning" : "x" });
  console.log(`limit ${lvl} min: legs ${tl.toFixed(0)} ms, solve+eval ${(performance.now() - t1 - tl).toFixed(0)} ms -> value ${best.value}, stops`, best.order.map((j) => tg[j - 1].id).join(","), plan && (plan.totalS / 3600).toFixed(2) + " h", vd.verdict, "binding", vd.binding);
}

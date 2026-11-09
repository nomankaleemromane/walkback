import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dijkstra } from "../js/router.js";
import { buildLegs, makeConstraints, solve, evaluate, verdict } from "../js/planner.js";
import { effortCase } from "../js/model.js";
const policy = JSON.parse(readFileSync(new URL("../config/policy.json", import.meta.url)));

function flat(w = 400, h = 60, cell = 25) {
  const n = w * h;
  return { w, h, n, Z: new Int16Array(n), slope: new Float32Array(n), H: new Float32Array(n), pass: new Uint8Array(n).fill(1), cx: cell, cy: cell };
}
// home at x=10; targets 1 km, 2 km and 4.5 km east (25 m cells)
const T = flat(), y = 30, cell = (x) => y * T.w + x;
const home = cell(10), cells = [home, cell(50), cell(90), cell(190)];
const targets = [{ id: "a", name: "A", priority: 3, station_min: 20 }, { id: "b", name: "B", priority: 5, station_min: 20 }, { id: "c", name: "C", priority: 9, station_min: 20 }];
const WB = dijkstra(T, { sources: [home], reverse: true, hazW: 0 });
const ec = effortCase(policy, "central");

test("quiet: all three stops fit in 6 h (4.5 km out at 2 km/h)", () => {
  const { legs } = buildLegs(T, WB, cells, { hazW: 0 });
  const K = makeConstraints(policy, ec, { startLtst: 9, sunsetLtst: 18, radLimitMin: null });
  const best = solve(legs, targets, K);
  assert.deepEqual([...best.order].sort(), [1, 2, 3]);
  const plan = evaluate(T, WB, legs, targets, best.order, K, policy);
  assert.ok(plan.totalS <= K.evaS);
  assert.ok(Math.abs(plan.lengthM - 9000) < 1);
});

test("a 30-min shelter limit drops stops beyond 1 km and the route stays inside the zone", () => {
  const v = ec.paceKmh / 3.6, lim = 30;
  const allow = Uint8Array.from(WB.T, (t) => (t / v <= lim * 60 ? 1 : 0));
  const { legs } = buildLegs(T, WB, cells, { allow, hazW: 0 });
  const K = makeConstraints(policy, ec, { startLtst: 9, sunsetLtst: 18, radLimitMin: lim });
  const best = solve(legs, targets, K);
  assert.deepEqual(best.order, [1]);
  const plan = evaluate(T, WB, legs, targets, best.order, K, policy);
  assert.ok(plan.maxWBs <= lim * 60 + 1e-6);
  assert.ok(plan.profile.every(([, wb]) => wb <= lim * 60 + 1e-6));
});

test("walk-back criterion: a short consumables capacity removes the far stop", () => {
  const p2 = structuredClone(policy);
  p2.params.consumables_h.value = 4;
  p2.params.consumables_reserve_min.value = 0;
  const { legs } = buildLegs(T, WB, cells, { hazW: 0 });
  const K = makeConstraints(p2, ec, { startLtst: 9, sunsetLtst: 18, radLimitMin: null });
  const best = solve(legs, targets, K);
  assert.ok(!best.order.includes(3));
  const plan = evaluate(T, WB, legs, targets, best.order, K, p2);
  assert.ok(plan.minCapMarginS >= 0);
  assert.ok(plan.profile.every(([t, wb]) => t + wb <= K.capS + 1e-6));
});

test("daylight: a late start loses the far stop", () => {
  const { legs } = buildLegs(T, WB, cells, { hazW: 0 });
  const K = makeConstraints(policy, ec, { startLtst: 14.5, sunsetLtst: 18, radLimitMin: null });
  const best = solve(legs, targets, K);
  const plan = evaluate(T, WB, legs, targets, best.order, K, policy);
  assert.ok(plan.totalS <= K.dayEndS);
  assert.ok(!best.order.includes(3));
});

test("verdict: warning policy -> NO-GO; empty plan -> NO-GO; quiet short plan is not NO-GO", () => {
  const { legs } = buildLegs(T, WB, cells, { hazW: 0 });
  const K = makeConstraints(policy, ec, { startLtst: 9, sunsetLtst: 18, radLimitMin: 30 });
  const plan = evaluate(T, WB, legs, targets, [1], K, policy);
  assert.equal(verdict(plan, K, { policy, level: "warning" }).verdict, "NO-GO");
  assert.equal(verdict(null, K, { policy, level: "quiet" }).verdict, "NO-GO");
  assert.notEqual(verdict(plan, K, { policy, level: "quiet" }).verdict, "NO-GO");
});

test("must-visit stops are always included when they fit, even with low priority", () => {
  const { legs } = buildLegs(T, WB, cells, { hazW: 0 });
  const K = makeConstraints(policy, ec, { startLtst: 14.5, sunsetLtst: 18, radLimitMin: null });
  const free = solve(legs, targets, K);
  const low = targets.map((t) => ({ ...t, priority: t.id === "a" ? 1 : t.priority }));
  const pinned = solve(legs, low, K, { required: [1] });
  assert.ok(pinned.order.includes(1));
  assert.ok(pinned.value <= free.value + 9);
});

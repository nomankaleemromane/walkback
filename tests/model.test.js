import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { minettiCw, paceFactor, effortCase, applyCase } from "../js/model.js";
const policy = JSON.parse(readFileSync(new URL("../config/policy.json", import.meta.url)));

test("Minetti cost on the flat is 2.5 J/kg/m", () => assert.equal(minettiCw(0), 2.5));

test("Minetti cost rises steeply uphill and is clamped to the valid range", () => {
  assert.ok(minettiCw(0.2) > 3 * minettiCw(0));
  assert.equal(minettiCw(0.9), minettiCw(0.45));
  assert.ok(minettiCw(-0.2) >= 0.8);
});

test("pace factor: 1 on the flat, fastest slightly downhill, slower on steep ground", () => {
  assert.ok(Math.abs(paceFactor(0) - 1) < 1e-12);
  assert.ok(paceFactor(-0.05) > paceFactor(0));
  assert.ok(paceFactor(0.3) < 0.5);
});

test("effort cases are ordered low < central < high", () => {
  const e = ["low", "central", "high"].map((c) => effortCase(policy, c));
  const J = e.map((c) => applyCase(1000, 1000, c));
  assert.ok(J[0].joules < J[1].joules && J[1].joules < J[2].joules);
  assert.ok(J[0].seconds < J[1].seconds && J[1].seconds < J[2].seconds);
  assert.equal(e[1].paceKmh, policy.params.pace_kmh.value);
});

test("1 km on the flat at the central case takes 30 min at 2 km/h", () => {
  const r = applyCase(2500, 1000, effortCase(policy, "central"));
  assert.ok(Math.abs(r.seconds - 1800) < 1e-9);
  assert.equal(r.joules, 2500 * 80);
});

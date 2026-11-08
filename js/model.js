// Walking effort and pace models. Pure functions, no DOM.
//
// Effort: Minetti et al. (2002, J Appl Physiol 93:1039) metabolic cost of walking on a
// gradient i (rise/run), J per kg per m, fitted on Earth treadmill data, valid |i| <= 0.45.
// We turn it into a range for a suited astronaut on Mars with the effort cases in
// config/policy.json (low / central / high). It is an index, not a flight value.
//
// Pace: Tobler-style hiking function, scaled so the flat pace equals the policy pace.

export const MINETTI_RANGE = 0.45;

export function minettiCw(i) {
  const x = Math.max(-MINETTI_RANGE, Math.min(MINETTI_RANGE, i));
  const c = ((((280.5 * x - 58.7) * x - 76.8) * x + 51.9) * x + 19.6) * x + 2.5;
  return Math.max(0.8, c); // floor: the fit dips near -0.2; walking never costs less than ~0.8 J/kg/m
}

// Relative pace factor for gradient i (1.0 on the flat). Tobler (1993) exp(-3.5|i+0.05|),
// normalised so f(0) = 1. Slightly downhill is fastest.
export function paceFactor(i) {
  return Math.exp(-3.5 * Math.abs(i + 0.05) + 0.175);
}

// Effort case -> multipliers used by the planner.
// cost [J] = k * massKg * Cw(i) * d ;  time [s] = d / (paceKmh/3.6 * paceFactor(i) * case.pace_factor)
export function effortCase(policy, name = "central") {
  const P = policy.params, c = policy.effort_cases[name];
  const body = P.body_mass_kg.value, suit = P.suit_mass_kg.value;
  return {
    name,
    k: c.k,
    massKg: c.mass === "body+suit" ? body + suit : body,
    paceFactor: c.pace_factor,
    paceKmh: P.pace_kmh.value * c.pace_factor,
    source: c.source,
  };
}

// Convert unit quantities from the router into a case:
// unitE = sum Cw(i)*d  [J/kg] ; unitT = sum d/paceFactor(i) [s at 1 m/s]
export function applyCase(unitE, unitT, ec) {
  return { joules: unitE * ec.k * ec.massKg, seconds: unitT / (ec.paceKmh / 3.6) };
}

// Average walking power [W] for a leg or a whole plan.
export const avgPower = (joules, seconds) => (seconds > 0 ? joules / seconds : 0);

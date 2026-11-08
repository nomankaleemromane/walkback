// Mars time and Sun position: Mars24 algorithm (Allison & McEwen 2000, Planet. Space Sci.
// 48:215; NASA GISS Mars24 "Algorithm and worked examples"). Pure functions.

const D2R = Math.PI / 180;
const TT_MINUS_UTC_S = 69.184; // 37 leap seconds + 32.184 s (valid since 2017)
const mod = (a, n) => ((a % n) + n) % n;

export function marsTime(date, lonEast) {
  const jdUT = date.getTime() / 86400000 + 2440587.5;
  const jdTT = jdUT + TT_MINUS_UTC_S / 86400;
  const dt = jdTT - 2451545.0;
  const M = 19.3871 + 0.52402073 * dt;
  const aFMS = 270.3871 + 0.524038496 * dt;
  const A = [0.0071, 0.0057, 0.0039, 0.0037, 0.0021, 0.002, 0.0018];
  const tau = [2.2353, 2.7543, 1.1177, 15.7866, 2.1354, 2.4694, 32.8493];
  const phi = [49.409, 168.173, 191.837, 21.736, 15.704, 95.528, 49.095];
  let pbs = 0;
  for (let i = 0; i < 7; i++) pbs += A[i] * Math.cos(D2R * ((0.985626 * dt) / tau[i] + phi[i]));
  const Mr = M * D2R;
  const vM = (10.691 + 3.0e-7 * dt) * Math.sin(Mr) + 0.623 * Math.sin(2 * Mr) + 0.05 * Math.sin(3 * Mr) +
    0.005 * Math.sin(4 * Mr) + 0.0005 * Math.sin(5 * Mr) + pbs;
  const Ls = mod(aFMS + vM, 360);
  const L = Ls * D2R;
  const eot = 2.861 * Math.sin(2 * L) - 0.071 * Math.sin(4 * L) + 0.002 * Math.sin(6 * L) - vM; // deg
  const msd = (jdTT - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626;
  const mst = mod(24 * msd, 24);
  const lmst = mod(mst + lonEast / 15, 24);
  const ltst = mod(lmst + eot / 15, 24);
  const decl = Math.asin(0.42565 * Math.sin(L)) / D2R + 0.25 * Math.sin(L); // deg
  return { jdTT, msd, Ls, eotDeg: eot, mst, lmst, ltst, declDeg: decl };
}

// Perseverance mission sol for a date (sol 0 = landing day, 2021-02-18). Calibrated so
// the raw-image record ZL0_0509 (2022-07-26T20:55:08Z) falls in sol 509.
export function m20Sol(date, lonEast = 77.4508) {
  const { msd } = marsTime(date, lonEast);
  return Math.floor(msd + lonEast / 360 - M20_SOL0_MSD);
}
export const M20_SOL0_MSD = (() => {
  const { msd } = marsTime(new Date("2022-07-26T20:55:08Z"), 77.4508);
  return Math.floor(msd + 77.4508 / 360) - 509;
})();

// Solar elevation (deg) at a local true solar time, latitude, solar declination.
export function sunElevation(ltstH, latDeg, declDeg) {
  const H = (ltstH - 12) * 15 * D2R, p = latDeg * D2R, d = declDeg * D2R;
  return Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H)) / D2R;
}
export function sunAzimuth(ltstH, latDeg, declDeg) {
  const H = (ltstH - 12) * 15 * D2R, p = latDeg * D2R, d = declDeg * D2R;
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(p) - Math.tan(d) * Math.cos(p));
  return mod(az / D2R + 180, 360); // from north, clockwise
}

// Geometric sunrise / sunset in LTST hours (no refraction or terrain).
export function sunriseSunset(latDeg, declDeg) {
  const x = -Math.tan(latDeg * D2R) * Math.tan(declDeg * D2R);
  if (x <= -1) return { rise: 0, set: 24 };
  if (x >= 1) return { rise: 12, set: 12 };
  const H0 = Math.acos(x) / D2R / 15;
  return { rise: 12 - H0, set: 12 + H0 };
}

export const fmtH = (h) => {
  h = mod(h, 24);
  let hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
};

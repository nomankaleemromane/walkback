// 3D view: three.js terrain from the DEM, CTX texture, route, stops, walk-back zone and an
// astronaut point-of-view fly-through with a HUD. Shares state with the 2D map (S).
import * as THREE from "three";
import { OrbitControls } from "../vendor/three/OrbitControls.js";
import { marsTime, sunElevation, sunAzimuth, fmtH } from "./marstime.js";
import { rasterURL, walkbackColor, hazardColor } from "./map2d.js";
import { allowed } from "./charts.js";
import { makeAstronaut } from "./astronaut.js";

const SOL_H = 1.0275;

export async function create3D(el, S) {
  const T = S.T, w = T.w, h = T.h;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 200000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49;

  // ---- UI inside the 3D view
  el.insertAdjacentHTML("beforeend", `
    <div class="v3-bar">
      <select id="v3tex" aria-label="3D surface layer"><option value="ctx">CTX image</option><option value="wb">CTX + walk-back zone</option><option value="hz">CTX + terrain hazard</option></select>
      <select id="v3ex" aria-label="Vertical exaggeration"><option value="1">1× height</option><option value="2" selected>2× height</option><option value="4">4× height</option></select>
      <button id="v3pov">🧑‍🚀 Astronaut view</button>
      <select id="v3cam" aria-label="Camera"><option value="follow">Follow camera</option><option value="eye">First person</option></select>
      <select id="v3speed" aria-label="Playback speed"><option value="1">Real time</option><option value="10">10× speed</option><option value="60" selected>60× speed</option><option value="150">150× speed</option></select>
      <button id="v3play">▶ Walk route</button><button id="v3over">Overview</button>
    </div>
    <div class="v3-hud" id="v3hud" hidden></div>
    <div class="v3-note">Terrain: 20 m CTX DTM (USGS), texture: 6 m CTX ortho resampled to ~12 m/px. Not photorealistic at eye level.</div>`);
  const st = document.createElement("style");
  st.textContent = `#view3 .v3-bar{position:absolute;top:10px;left:10px;z-index:5;display:flex;gap:6px;flex-wrap:wrap}
  #view3 .v3-hud{position:absolute;top:56px;left:10px;z-index:5;background:#000c;border:1px solid #ff9a5c;border-radius:10px;padding:8px 12px;font:15px/1.45 system-ui;min-width:250px}
  #view3 .v3-hud b{font-size:18px;color:#ffd166} #view3 .v3-hud .warn{color:#ff8a80;font-weight:700}
  #view3 .v3-hud .act{display:block;margin:-2px 0 6px;padding:5px 9px;border-radius:7px;background:#1e1511;border:1px solid #4a372c;font-size:15px}
  #view3 .v3-hud .act b{font-size:15px;color:#fff} #view3 .v3-hud .act.st{background:#3a2d12;border-color:#6b5520}
  #view3 .v3-note{position:absolute;right:10px;bottom:8px;z-index:5;font-size:11px;color:#ccc;background:#0008;padding:2px 6px;border-radius:4px;max-width:60%}`;
  el.appendChild(st);

  // ---- terrain geometry (one vertex per grid cell)
  let exag = 2;
  const X = (i) => (i - w / 2) * T.cx, Zc = (j) => (j - h / 2) * T.cy;
  const zAt = (k) => (T.Z[k] > -32768 ? T.Z[k] : -2600);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(w * h * 3), uv = new Float32Array(w * h * 2);
  let zmin = Infinity;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i; zmin = Math.min(zmin, zAt(k)); }
  const fillPos = () => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i; pos[k * 3] = X(i); pos[k * 3 + 1] = (zAt(k) - zmin) * exag; pos[k * 3 + 2] = Zc(j); }
  };
  fillPos();
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i; uv[k * 2] = (i + 0.5) / w; uv[k * 2 + 1] = 1 - (j + 0.5) / h; }
  const idx = new Uint32Array((w - 1) * (h - 1) * 6);
  let q = 0;
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) { const a = j * w + i, b = a + 1, c = a + w, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const texImg = new Image(); texImg.src = `data/sites/${T.site.id}/texture.jpg`; await texImg.decode();
  const texCanvas = document.createElement("canvas"); texCanvas.width = texImg.width; texCanvas.height = texImg.height;
  const tex = new THREE.CanvasTexture(texCanvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshLambertMaterial({ map: tex, color: 0xffd9b8 });
  const terrain = new THREE.Mesh(geo, mat);
  scene.add(terrain);
  let texMode = "ctx";
  const drawTex = async () => {
    const g = texCanvas.getContext("2d");
    g.drawImage(texImg, 0, 0);
    if (texMode !== "ctx") {
      const im = new Image();
      im.src = rasterURL(T, texMode === "wb" ? walkbackColor(T, S.WB, S.ec.paceKmh / 3.6, isFinite(S.K.radS) ? S.K.radS : (S.K.capS - S.K.egressS) / 2) : hazardColor(T));
      await im.decode();
      g.globalAlpha = 0.55; g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, texCanvas.width, texCanvas.height); g.globalAlpha = 1;
    }
    tex.needsUpdate = true;
  };
  await drawTex();

  // ---- sky + sun (Mars24 sun position for "now"; sky colour by sun elevation)
  const skyGeo = new THREE.SphereGeometry(150000, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { sunDir: { value: new THREE.Vector3(0, 1, 0) }, day: { value: 1 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 sunDir; uniform float day; varying vec3 vDir;
      void main(){ float up = clamp(vDir.y,0.0,1.0); float s = max(dot(normalize(vDir), normalize(sunDir)),0.0);
        vec3 butterscotch = mix(vec3(0.80,0.62,0.45), vec3(0.62,0.45,0.32), up);
        vec3 night = vec3(0.03,0.025,0.03);
        vec3 col = mix(night, butterscotch, day);
        col += vec3(0.35,0.5,0.75) * pow(s, 24.0) * (1.0 - 0.6*day) + vec3(0.25,0.22,0.2) * pow(s, 6.0) * day; // blue halo near the sun (Mars sunset)
        gl_FragColor = vec4(col,1.0); }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.2); scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xffd2a8, 0x3a2416, 0.75); scene.add(hemi);
  const setSun = (ltst) => {
    const mt = marsTime(new Date(), T.site.habitat[1]);
    const el = sunElevation(ltst, T.site.habitat[0], mt.declDeg), az = sunAzimuth(ltst, T.site.habitat[0], mt.declDeg);
    const e = (el * Math.PI) / 180, a = (az * Math.PI) / 180;
    const dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
    sun.position.copy(dir).multiplyScalar(50000); sun.intensity = el > 0 ? 2.2 : 0.05;
    hemi.intensity = el > 0 ? 0.75 : 0.15;
    skyMat.uniforms.sunDir.value.copy(dir); skyMat.uniforms.day.value = Math.max(0, Math.min(1, (el + 4) / 14));
    return { el, az };
  };
  setSun(S.startLtst + 1);

  // ---- route, abort path, stops
  // Height of the rendered terrain at world x,z: same vertex positions (vertex i sits at X(i))
  // and the same triangle split as the mesh (a,c,b) + (b,c,d), so objects sit exactly on it.
  const surfaceY = (x, z) => {
    const fi = x / T.cx + w / 2, fj = z / T.cy + h / 2;
    const i0 = Math.max(0, Math.min(w - 2, Math.floor(fi))), j0 = Math.max(0, Math.min(h - 2, Math.floor(fj)));
    const u = Math.max(0, Math.min(1, fi - i0)), v = Math.max(0, Math.min(1, fj - j0));
    const k = j0 * w + i0, z00 = zAt(k), z10 = zAt(k + 1), z01 = zAt(k + w), z11 = zAt(k + w + 1);
    const zz = u + v <= 1 ? z00 + u * (z10 - z00) + v * (z01 - z00) : z11 + (1 - u) * (z01 - z11) + (1 - v) * (z10 - z11);
    return (zz - zmin) * exag;
  };
  const cellXZ = (k) => [X(k % w), Zc((k / w) | 0)];
  const group = new THREE.Group(); scene.add(group);
  const tube = (cells, color, r, lift = 4) => (cells && cells.length > 1 ? tubeXZ(Array.from(cells, cellXZ), color, r, lift) : null);
  const tubeXZ = (xz, color, r, lift) => {
    if (!xz || xz.length < 2) return null;
    // sample the ground every few metres so the line follows every rise and dip
    const thin = r < 1, stepM = thin ? 3 : 15, pts = [];
    for (let i = 0; i < xz.length - 1; i++) {
      const [x0, z0] = xz[i], [x1, z1] = xz[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / stepM));
      for (let s = 0; s < n; s++) { const x = x0 + ((x1 - x0) * s) / n, z = z0 + ((z1 - z0) * s) / n; pts.push(new THREE.Vector3(x, surfaceY(x, z) + lift, z)); }
    }
    const [xe, ze] = xz[xz.length - 1]; pts.push(new THREE.Vector3(xe, surfaceY(xe, ze) + lift, ze));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(8000, pts.length * 2), r, 6, false), new THREE.MeshBasicMaterial({ color, transparent: thin, opacity: thin ? 0.75 : 1 }));
  };
  const label = (text, color = "#fff") => {
    const c = document.createElement("canvas"), g = c.getContext("2d"); g.font = "bold 44px system-ui";
    c.width = Math.ceil(g.measureText(text).width) + 24; c.height = 64;
    g.font = "bold 44px system-ui"; g.fillStyle = "rgba(0,0,0,.7)"; g.fillRect(0, 0, c.width, c.height); g.fillStyle = color; g.fillText(text, 12, 48);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    sp.scale.set(c.width * 4, c.height * 4, 1); sp.renderOrder = 10; return sp;
  };
  const objCol = { A: 0xff9a5c, B: 0x33d6ff, C: 0xb38cff, X: 0xffd166 };
  function rebuild() {
    group.clear();
    const p = S.plan, pv = mode === "pov";
    const r = pv && p ? tubeXZ(walkLine(), 0x33d6ff, 0.09, 0.2) : tube(p && p.path, 0x33d6ff, 7, 4); if (r) group.add(r);
    if (S.mode === "abort" && S.abortLine) {
      const c = S.abortCell >= 0 ? S.abortCell : null;
      if (c != null) { const path = []; for (let k = c, g2 = 0; k !== -1 && g2 < 1e5; k = S.WB.P[k], g2++) path.push(k); const a = tube(path, 0xff5a4f, pv ? 0.45 : 9, pv ? 0.5 : 4); if (a) group.add(a); }
    }
    S.targets.forEach((t, i) => {
      const k = S.cells[i]; if (k < 0) return;
      const [x, z] = cellXZ(k), y = surfaceY(x, z), inPlan = p && p.order.includes(i + 1);
      const col = objCol[t.objective] || 0xffffff;
      if (pv) { // astronaut view: a 2.5 m survey flag at the stop
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.5, 6), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
        pole.position.set(x, y + 1.25, z); group.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: !inPlan, opacity: inPlan ? 1 : 0.5 }));
        flag.position.set(x + 0.36, y + 2.25, z); group.add(flag);
      } else {
        const ph = inPlan ? 260 : 120;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, ph, 8), new THREE.MeshBasicMaterial({ color: col, transparent: !inPlan, opacity: inPlan ? 1 : 0.45 }));
        pole.position.set(x, y + ph / 2, z); group.add(pole);
      }
      if (inPlan) {
        const k = p.order.indexOf(i + 1);
        const near = p.order.map((j, q) => [S.targets[j - 1], q]).filter(([u]) => Math.hypot((u.lat - t.lat) * 59200, (u.lon - t.lon) * 56200) < 250);
        if (near[0][1] === k) { // first stop of its cluster carries the label
          const txt = near.length > 1 ? `${near[0][1] + 1}–${near[near.length - 1][1] + 1}. ${t.name} +${near.length - 1}` : `${k + 1}. ${t.name}`;
          const l = label(txt); l.position.set(x, y + (pv ? 30 : 330), z); if (pv) l.scale.multiplyScalar(0.012); group.add(l);
        }
      }
    });
    const [hx, hz] = cellXZ(S.home);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    dome.position.set(hx, surfaceY(hx, hz), hz); group.add(dome);
    const hl = label("Habitat", "#ffd166"); hl.position.set(hx, surfaceY(hx, hz) + (pv ? 60 : 220), hz); if (pv) hl.scale.multiplyScalar(0.12); group.add(hl);
    if (S.roverOn && S.rover >= 0) { const [rx, rz] = cellXZ(S.rover); const rv = new THREE.Mesh(new THREE.BoxGeometry(60, 30, 30), new THREE.MeshLambertMaterial({ color: 0x2fa84f })); rv.position.set(rx, surfaceY(rx, rz) + 15, rz); group.add(rv); const rl = label("Rover safe haven", "#9be7a9"); rl.position.set(rx, surfaceY(rx, rz) + (pv ? 50 : 200), rz); if (pv) rl.scale.multiplyScalar(0.12); group.add(rl); }
    if (!pv) group.add(walker);
  }
  const walker = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 60, 10), new THREE.MeshBasicMaterial({ color: 0xff9a5c }));

  // ---- camera modes
  let mode = "orbit";
  const overview = () => {
    mode = "orbit"; controls.enabled = true; document.getElementById("v3hud").hidden = true;
    const p = S.plan; let cx = 0, cz = 0;
    if (p) { const cs = [...p.path]; const xs = cs.map((k) => cellXZ(k)); cx = xs.reduce((a, b) => a + b[0], 0) / xs.length; cz = xs.reduce((a, b) => a + b[1], 0) / xs.length; }
    controls.target.set(cx, surfaceY(cx, cz), cz);
    camera.position.set(cx - 2500, surfaceY(cx, cz) + 4500, cz + 6500);
    camera.near = 5; camera.far = 300000; camera.updateProjectionMatrix();
  };
  overview();
  let playing = false, lastT = 0, yaw = null, camYaw = null, camMode = "follow", speed = 60;
  const stepAt = (p, t) => p.steps.find((s) => t >= s.t0 && t < s.t1) || p.steps[p.steps.length - 1];
  // the EVA pair (buddy rule): crew 1 orange band, crew 2 cyan band
  const crew = [makeAstronaut(0xff8c4a), makeAstronaut(0x3dd9ff)];
  crew.forEach((c) => { c.root.visible = false; scene.add(c.root); c.prev = null; c.yaw = null; });
  const BUDDY_LAG_S = 2, BUDDY_SIDE_M = 2.2; // buddy walks about 1 m behind and 2 m to the side, on the same path

  // ---- walking path: the planner's 40 m grid route, smoothed so people walk curves instead of a
  // staircase. Points where the crew stands still (science stops, leg joins) stay fixed.
  let smFor = null, SM = null;
  function smooth() {
    const p = S.plan;
    if (smFor === p && SM) return SM;
    const pr = p.profile, n = pr.length;
    let xs = new Float64Array(n), zs = new Float64Array(n);
    pr.forEach((q, i) => { const [x, z] = cellXZ(q[2]); xs[i] = x; zs[i] = z; });
    const fixed = new Uint8Array(n); fixed[0] = fixed[n - 1] = 1;
    for (let i = 1; i < n; i++) if (pr[i][2] === pr[i - 1][2]) fixed[i] = fixed[i - 1] = 1;
    for (let pass = 0; pass < 5; pass++) { // [1 2 1]/4 kernel, 5 passes ~ 1.6-cell Gaussian
      const nx = xs.slice(), nz = zs.slice();
      for (let i = 1; i < n - 1; i++) if (!fixed[i]) { nx[i] = (xs[i - 1] + 2 * xs[i] + xs[i + 1]) / 4; nz[i] = (zs[i - 1] + 2 * zs[i] + zs[i + 1]) / 4; }
      xs = nx; zs = nz;
    }
    // unit tangent at each point, from the nearest distinct neighbours on either side
    const tx = new Float64Array(n), tz = new Float64Array(n);
    const same = (a, b) => Math.abs(xs[a] - xs[b]) < 1e-6 && Math.abs(zs[a] - zs[b]) < 1e-6;
    for (let i = 0; i < n; i++) {
      let a = i - 1, b = i + 1;
      while (a > 0 && same(a, i)) a--;
      while (b < n - 1 && same(b, i)) b++;
      a = Math.max(0, a); b = Math.min(n - 1, b);
      const dx = xs[b] - xs[a], dz = zs[b] - zs[a], L = Math.hypot(dx, dz);
      if (L > 1e-6) { tx[i] = dx / L; tz[i] = dz / L; }
    }
    smFor = p; SM = { xs, zs, tx, tz };
    return SM;
  }
  const walkLine = () => { const { xs, zs } = smooth(), out = []; for (let i = 0; i < xs.length; i++) if (!out.length || Math.hypot(xs[i] - out[out.length - 1][0], zs[i] - out[out.length - 1][1]) > 0.5) out.push([xs[i], zs[i]]); return out; };
  // position and walking direction on the smoothed path at EVA time t
  const posAt = (t) => {
    const pr = S.plan.profile, { xs, zs, tx, tz } = smooth();
    t = Math.max(0, Math.min(t, pr[pr.length - 1][0]));
    let lo = 0, hi = pr.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pr[m][0] <= t) lo = m; else hi = m - 1; }
    const n1 = Math.min(pr.length - 1, lo + 1), f = pr[n1][0] > pr[lo][0] ? Math.min(1, (t - pr[lo][0]) / (pr[n1][0] - pr[lo][0])) : 0;
    const hx = tx[lo] + (tx[n1] - tx[lo]) * f, hz = tz[lo] + (tz[n1] - tz[lo]) * f; // heading turns gradually along each segment
    return { lo, k: pr[lo][2], px: xs[lo] + (xs[n1] - xs[lo]) * f, pz: zs[lo] + (zs[n1] - zs[lo]) * f, heading: Math.hypot(hx, hz) > 1e-3 ? Math.atan2(hx, hz) : null };
  };
  const ease = (cur, want, dt, rate) => (cur == null || dt == null ? want : cur + Math.atan2(Math.sin(want - cur), Math.cos(want - cur)) * (1 - Math.exp(-dt * rate)));
  // dtReal: seconds of animation since the last frame (ease turns); null = jump straight to the heading
  const povAt = (frac, dtReal = null) => {
    const p = S.plan; if (!p) return;
    const t = frac * p.totalS;
    const [a, b] = crew;
    // lead astronaut: faces the way the path goes right here (turns at the bend, not before it)
    const A = posAt(t), leadStation = stepAt(p, t).kind !== "walk";
    if (A.heading != null && !leadStation) yaw = ease(yaw, A.heading, dtReal, 14);
    if (yaw == null) yaw = A.heading ?? 0;
    const gy = surfaceY(A.px, A.pz);
    a.root.position.set(A.px, gy, A.pz); a.root.rotation.y = yaw;
    a.station = stepAt(p, t).kind === "station";
    // buddy: same path, a few seconds behind, offset to the side of the path
    const Bt = t - BUDDY_LAG_S, B = posAt(Bt), buddyStation = Bt <= 0 || stepAt(p, Bt).kind !== "walk";
    if (B.heading != null && !buddyStation) b.yaw = ease(b.yaw, B.heading, dtReal, 14);
    if (b.yaw == null) b.yaw = B.heading ?? yaw;
    const sx = Math.cos(b.yaw), sz = -Math.sin(b.yaw); // to the buddy's right
    const bx = B.px + sx * BUDDY_SIDE_M, bz = B.pz + sz * BUDDY_SIDE_M;
    b.root.position.set(bx, surfaceY(bx, bz), bz); b.root.rotation.y = b.yaw;
    b.station = Bt > 0 && stepAt(p, Bt).kind === "station";
    a.root.visible = camMode === "follow"; b.root.visible = true;
    // camera: eases towards the lead's heading, so it follows calmly instead of snapping
    camYaw = ease(camYaw, yaw, dtReal, 3);
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    if (camMode === "eye") {
      const eye = 1.7 * exag + 1.7; // 1.7 m eye height (scaled with the exaggeration so the horizon looks right)
      camera.position.set(A.px, gy + eye, A.pz);
      const lx = A.px + fx * 200, lz = A.pz + fz * 200;
      camera.lookAt(lx, surfaceY(lx, lz) + eye * 0.6, lz);
    } else { // follow camera: behind and above the lead astronaut, looking slightly ahead of them
      const cx = A.px - fx * 7.5, cz = A.pz - fz * 7.5;
      const cy = Math.max(gy + 3.2, surfaceY(cx, cz) + 1.6); // never below the ground on slopes
      camera.position.set(cx, cy, cz);
      camera.lookAt(A.px + fx * 5, gy + 1.3, A.pz + fz * 5);
    }
    camera.near = 0.3; camera.updateProjectionMatrix();
    walker.position.set(A.px, gy + 30, A.pz);
    hud(t, A.k);
  };
  function activity(t) {
    const p = S.plan, s = stepAt(p, t), left = Math.max(0, Math.round((s.t1 - t) / 60));
    if (s.kind === "station") return `<span class="act st">⏸ On station: <b>${s.label}</b> · ${left} min left</span>`;
    if (s.kind === "walk") return `<span class="act">🚶 Walking to <b>${s.to ? S.targets[s.to - 1].name : "shelter"}</b> · ${left} min</span>`;
    return `<span class="act st">⏸ ${s.label} · ${left} min left</span>`;
  }
  function hud(t, k) {
    const p = S.plan, K = S.K, v = K.v, el = document.getElementById("v3hud");
    let walked = 0, J = 0;
    for (const s of p.steps) { if (s.kind !== "walk") continue; const f = Math.max(0, Math.min(1, (t - s.t0) / (s.t1 - s.t0))); walked += s.lengthM * f; J += s.joules * f; }
    const wb = S.WB.T[k] / v, al = allowed(t, K), slope = T.slope[k];
    const ltst = S.startLtst + t / 3600 / SOL_H, sunE = setSun(ltst).el;
    const warn = [];
    if (slope > S.policy.params.caution_slope_deg.value) warn.push(`steep ground ${slope.toFixed(0)}°`);
    if (T.H[k] >= 0.6) warn.push(`rough/soft terrain (hazard ${(T.H[k] * 100).toFixed(0)})`);
    if (al - wb < 1800) warn.push(`walk-back margin ${Math.round((al - wb) / 60)} min`);
    if (sunE < 10) warn.push("low sun");
    el.hidden = false;
    el.innerHTML = `${activity(t)}<b>${fmtH(ltst)} LTST</b> · EVA ${Math.floor(t / 3600)} h ${String(Math.round((t % 3600) / 60)).padStart(2, "0")}<br>
      Walked <b>${(walked / 1000).toFixed(2)} km</b> · effort ${(J / 1e6).toFixed(2)} MJ (${S.ec.name})<br>
      To shelter <b>${Math.round(wb / 60)} min</b> · allowed ${Math.round(al / 60)} min<br>
      Slope ${slope.toFixed(0)}° · GCR dose ${(0.64 * t / 86400).toFixed(3)} mSv · sun ${sunE.toFixed(0)}°<br>
      ${warn.length ? `<span class="warn">⚠ ${warn.join(" · ")}</span>` : `<span style="color:#9be7a9">Suit & route OK</span>`}`;
  }
  const pov = () => { mode = "pov"; controls.enabled = false; rebuild(); povAt(S.goFrac || 0); };
  document.getElementById("v3cam").onchange = (e) => { camMode = e.target.value; if (mode !== "pov") pov(); else povAt(S.goFrac || 0); };
  document.getElementById("v3speed").onchange = (e) => { speed = +e.target.value; };
  document.getElementById("v3pov").onclick = pov;
  document.getElementById("v3over").onclick = () => { playing = false; document.getElementById("v3play").textContent = "▶ Walk route"; crew.forEach((c) => (c.root.visible = false)); overview(); rebuild(); };
  document.getElementById("v3play").onclick = () => { playing = !playing; document.getElementById("v3play").textContent = playing ? "❚❚ Pause" : "▶ Walk route"; if (playing) { if (mode !== "pov") pov(); if ((S.goFrac || 0) >= 1) S.goFrac = 0; lastT = performance.now(); } };
  document.getElementById("v3tex").onchange = (e) => { texMode = e.target.value; drawTex(); };
  document.getElementById("v3ex").onchange = (e) => { exag = +e.target.value; fillPos(); geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); rebuild(); mode === "pov" ? povAt(S.goFrac || 0) : overview(); };

  // ---- loop
  const resize = () => { const r = el.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%"; camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); };
  resize();
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (el.hidden) return;
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    const walkingNow = mode === "pov" && S.plan && stepAt(S.plan, (S.goFrac || 0) * S.plan.totalS).kind === "walk";
    if (playing && S.plan) {
      // walking at the chosen speed; on station / airlock the animation runs 6x faster (the EVA clock stays real)
      S.goFrac = Math.min(1, (S.goFrac || 0) + (dt * (walkingNow ? speed : speed * 6)) / S.plan.totalS);
      povAt(S.goFrac, dt);
      const r = document.getElementById("goT"); if (r) r.value = Math.round(S.goFrac * 1000);
      if (S.goFrac >= 1) { playing = false; document.getElementById("v3play").textContent = "▶ Walk route"; }
    }
    if (mode === "pov") { // limbs: one stride cycle per ~1.3 m covered, so feet match the ground at real time
      for (const c of crew) {
        const p = c.root.position, d = c.prev ? Math.hypot(p.x - c.prev.x, p.z - c.prev.z) : 0;
        c.prev = { x: p.x, z: p.z };
        const v = dt > 0 ? d / dt : 0, moving = playing && v > 0.05;
        c.update(dt, moving, Math.min(2.2, v / 1.3), !moving && !!c.station);
      }
    }
    if (mode === "orbit") controls.update();
    renderer.render(scene, camera);
  };
  requestAnimationFrame(loop);
  rebuild();

  return {
    resize,
    update(S2) { rebuild(); if (texMode === "wb") drawTex(); if (mode === "pov") povAt(S.goFrac || 0); },
    setWalker(cell, t) { if (mode === "pov" && !playing) povAt(S.goFrac || 0); },
    pov, overview, renderer, scene,
  };
}

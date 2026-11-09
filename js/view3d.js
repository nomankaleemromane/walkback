// 3D view: three.js terrain from the DEM, CTX texture, route, stops, walk-back zone and an
// astronaut point-of-view fly-through with a HUD. Shares state with the 2D map (S).
import * as THREE from "three";
import { OrbitControls } from "../vendor/three/OrbitControls.js";
import { marsTime, sunElevation, sunAzimuth, fmtH } from "./marstime.js";
import { rasterURL, walkbackColor, hazardColor } from "./map2d.js";
import { allowed } from "./charts.js";

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
      <button id="v3pov">👁 Astronaut view</button><button id="v3play">▶ Walk route</button><button id="v3over">Overview</button>
    </div>
    <div class="v3-hud" id="v3hud" hidden></div>
    <div class="v3-note">Terrain: 20 m CTX DTM (USGS), texture: 6 m CTX ortho resampled to ~12 m/px. Not photorealistic at eye level.</div>`);
  const st = document.createElement("style");
  st.textContent = `#view3 .v3-bar{position:absolute;top:10px;left:10px;z-index:5;display:flex;gap:6px;flex-wrap:wrap}
  #view3 .v3-hud{position:absolute;top:56px;left:10px;z-index:5;background:#000c;border:1px solid #ff9a5c;border-radius:10px;padding:8px 12px;font:15px/1.45 system-ui;min-width:250px}
  #view3 .v3-hud b{font-size:18px;color:#ffd166} #view3 .v3-hud .warn{color:#ff8a80;font-weight:700}
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
  const surfaceY = (x, z) => { // bilinear height at world x,z
    const fi = x / T.cx + w / 2 - 0.5, fj = z / T.cy + h / 2 - 0.5;
    const i0 = Math.max(0, Math.min(w - 2, Math.floor(fi))), j0 = Math.max(0, Math.min(h - 2, Math.floor(fj))), u = fi - i0, v = fj - j0;
    const k = j0 * w + i0, z00 = zAt(k), z10 = zAt(k + 1), z01 = zAt(k + w), z11 = zAt(k + w + 1);
    return ((z00 * (1 - u) + z10 * u) * (1 - v) + (z01 * (1 - u) + z11 * u) * v - zmin) * exag;
  };
  const cellXZ = (k) => [X(k % w), Zc((k / w) | 0)];
  const group = new THREE.Group(); scene.add(group);
  const tube = (cells, color, r, lift = 4) => {
    if (!cells || cells.length < 2) return null;
    const pts = [];
    for (let i = 0; i < cells.length; i++) { const [x, z] = cellXZ(cells[i]); pts.push(new THREE.Vector3(x, surfaceY(x, z) + lift, z)); }
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(2000, pts.length * 3), r, 6, false), new THREE.MeshBasicMaterial({ color }));
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
    const r = tube(p && p.path, 0x33d6ff, pv ? 0.35 : 7, pv ? 0.4 : 4); if (r) group.add(r);
    if (S.mode === "abort" && S.abortLine) {
      const c = S.abortCell >= 0 ? S.abortCell : null;
      if (c != null) { const path = []; for (let k = c, g2 = 0; k !== -1 && g2 < 1e5; k = S.WB.P[k], g2++) path.push(k); const a = tube(path, 0xff5a4f, pv ? 0.45 : 9, pv ? 0.5 : 4); if (a) group.add(a); }
    }
    S.targets.forEach((t, i) => {
      const k = S.cells[i]; if (k < 0) return;
      const [x, z] = cellXZ(k), y = surfaceY(x, z), inPlan = p && p.order.includes(i + 1);
      const ph = pv ? 25 : inPlan ? 260 : 120;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(pv ? 0.8 : 6, pv ? 0.8 : 6, ph, 8), new THREE.MeshBasicMaterial({ color: objCol[t.objective] || 0xffffff, transparent: !inPlan, opacity: inPlan ? 1 : 0.45 }));
      pole.position.set(x, y + ph / 2, z); group.add(pole);
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
  let playing = false, lastT = 0;
  const povAt = (frac) => {
    const p = S.plan; if (!p) return;
    const t = frac * p.totalS, pr = p.profile;
    let lo = 0, hi = pr.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pr[m][0] <= t) lo = m; else hi = m - 1; }
    const k = pr[lo][2], k2 = pr[Math.min(pr.length - 1, lo + 6)][2];
    const [x, z] = cellXZ(k), [x2, z2] = cellXZ(k2);
    // interpolate within the cell step for smooth motion
    const nxt = pr[Math.min(pr.length - 1, lo + 1)], f = nxt[0] > pr[lo][0] ? Math.min(1, (t - pr[lo][0]) / (nxt[0] - pr[lo][0])) : 0;
    const [xn, zn] = cellXZ(nxt[2]), px = x + (xn - x) * f, pz = z + (zn - z) * f;
    const eye = 1.7 * exag + 1.7; // 1.7 m eye height (scaled with the exaggeration so the horizon looks right)
    camera.position.set(px, surfaceY(px, pz) + eye, pz);
    const dx = x2 - px, dz = z2 - pz, L = Math.hypot(dx, dz) || 1;
    camera.lookAt(px + (dx / L) * 200, surfaceY(px + (dx / L) * 200, pz + (dz / L) * 200) + eye * 0.6, pz + (dz / L) * 200);
    camera.near = 0.5; camera.updateProjectionMatrix();
    walker.position.set(px, surfaceY(px, pz) + 30, pz);
    hud(t, k);
  };
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
    el.innerHTML = `<b>${fmtH(ltst)} LTST</b> · EVA ${Math.floor(t / 3600)} h ${String(Math.round((t % 3600) / 60)).padStart(2, "0")}<br>
      Walked <b>${(walked / 1000).toFixed(2)} km</b> · effort ${(J / 1e6).toFixed(2)} MJ (${S.ec.name})<br>
      To shelter <b>${Math.round(wb / 60)} min</b> · allowed ${Math.round(al / 60)} min<br>
      Slope ${slope.toFixed(0)}° · GCR dose ${(0.64 * t / 86400).toFixed(3)} mSv · sun ${sunE.toFixed(0)}°<br>
      ${warn.length ? `<span class="warn">⚠ ${warn.join(" · ")}</span>` : `<span style="color:#9be7a9">Suit & route OK</span>`}`;
  }
  const pov = () => { mode = "pov"; controls.enabled = false; rebuild(); povAt(S.goFrac || 0); };
  document.getElementById("v3pov").onclick = pov;
  document.getElementById("v3over").onclick = () => { playing = false; document.getElementById("v3play").textContent = "▶ Walk route"; overview(); rebuild(); };
  document.getElementById("v3play").onclick = () => { playing = !playing; document.getElementById("v3play").textContent = playing ? "❚❚ Pause" : "▶ Walk route"; if (playing) { if (mode !== "pov") pov(); if ((S.goFrac || 0) >= 1) S.goFrac = 0; lastT = performance.now(); } };
  document.getElementById("v3tex").onchange = (e) => { texMode = e.target.value; drawTex(); };
  document.getElementById("v3ex").onchange = (e) => { exag = +e.target.value; fillPos(); geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); rebuild(); mode === "pov" ? povAt(S.goFrac || 0) : overview(); };

  // ---- loop
  const resize = () => { const r = el.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%"; camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); };
  resize();
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (el.hidden) return;
    if (playing && S.plan) {
      const dt = (now - lastT) / 1000; lastT = now;
      S.goFrac = Math.min(1, (S.goFrac || 0) + (dt * 150) / S.plan.totalS); // 1 s = 2.5 min of EVA
      povAt(S.goFrac);
      const r = document.getElementById("goT"); if (r) r.value = Math.round(S.goFrac * 1000);
      if (S.goFrac >= 1) { playing = false; document.getElementById("v3play").textContent = "▶ Walk route"; }
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
    pov, overview, renderer,
  };
}

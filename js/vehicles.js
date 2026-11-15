// Pressurized rover for the 3D view, after NASA's small pressurized rover concepts (e.g. the
// Space Exploration Vehicle): crew cabin with a slanted windscreen, six wheels, two suit ports
// on the rear bulkhead (suits dock there so crew can get in without an airlock), roof solar
// array, antenna and lights. Built from three.js primitives; metres; front faces +Z.
import * as THREE from "three";

const M = (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const white = M(0xf2f1ec, 0.45, 0.05);
const grey = M(0x55585c, 0.7, 0.3);
const dark = M(0x26282b, 0.85, 0.1);
const glass = M(0x0c1820, 0.08, 0.6, { envMapIntensity: 1.4 });
const orange = M(0xff7a2f, 0.55, 0, { emissive: 0xff7a2f, emissiveIntensity: 0.08 });
const steel = M(0xb9bcc0, 0.3, 0.85);
const panel = M(0x1d2a4a, 0.25, 0.4);
const lamp = M(0xffffff, 0.3, 0, { emissive: 0xfff4d6, emissiveIntensity: 1.2 });

const put = (parent, mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
const box = (x, y, z, m) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), m);

export function makeRover() {
  const root = new THREE.Group();

  // cabin: side profile (length z, height y) extruded across the width, with rounded edges
  const W = 2.5; // cabin width
  const s = new THREE.Shape();
  s.moveTo(-2.4, 1.15); s.lineTo(-2.4, 3.0); s.lineTo(1.15, 3.0); s.lineTo(2.55, 2.0); s.lineTo(2.55, 1.15); s.lineTo(-2.4, 1.15);
  const g = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelSize: 0.16, bevelThickness: 0.16, bevelSegments: 3 });
  g.rotateY(-Math.PI / 2);  // shape x -> world z (length), extrusion -> world x (width)
  g.translate(W / 2, 0, 0);   // extrusion ran over x in [-W, 0]: centre it
  put(root, new THREE.Mesh(g, white));

  // windscreen on the slanted front face, side windows
  const ws = put(root, new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, 1.55), glass), 0, 2.5, 1.85);
  ws.rotation.x = -0.951; ws.position.add(new THREE.Vector3(0, 0.813, 0.581).multiplyScalar(0.18));
  for (const side of [1, -1]) {
    const sw = put(root, new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), glass), side * (W / 2 + 0.17), 2.45, 0.45);
    sw.rotation.y = side * Math.PI / 2;
    put(root, box(0.04, 0.12, 5.0, orange), side * (W / 2 + 0.17), 1.55, 0);          // side stripe
  }

  // chassis, wheels (6), fenders
  put(root, box(2.3, 0.45, 5.4, grey), 0, 0.95, 0);
  for (const z of [-1.75, 0, 1.75]) for (const side of [1, -1]) {
    const wheel = new THREE.Group();
    const tire = put(wheel, new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.42, 24), dark));
    const hub = put(wheel, new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.44, 12), steel));
    for (const m of [tire, hub]) m.rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) { // chevron tread blocks
      const t = put(wheel, box(0.44, 0.06, 0.14, grey), 0, Math.cos((i / 6) * Math.PI * 2) * 0.58, Math.sin((i / 6) * Math.PI * 2) * 0.58);
      t.rotation.x = -(i / 6) * Math.PI * 2;
    }
    put(root, wheel, side * 1.42, 0.58, z);
    put(root, box(0.5, 0.06, 1.25, white), side * 1.42, 1.25, z);                     // fender
  }

  // rear bulkhead: two suit ports with docked suits, a step to stand on
  for (const x of [-0.62, 0.62]) {
    const ring = put(root, new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 10, 24), steel), x, 2.05, -2.6);
    ring.rotation.y = 0;
    put(root, box(0.56, 0.72, 0.28, white), x, 2.05, -2.74);                              // docked suit backpack
    put(root, box(0.5, 0.64, 0.02, M(0xe4e0d8, 0.95)), x, 2.05, -2.89);
  }
  put(root, box(2.2, 0.08, 0.7, grey), 0, 1.05, -2.95);                                   // rear step
  put(root, box(1.8, 0.06, 0.04, orange), 0, 2.72, -2.58);

  // roof: solar arrays, antenna mast and dish, beacon
  for (const z of [-1.2, 0.2]) { const p = put(root, box(2.2, 0.05, 1.25, panel), 0, 3.3, z); p.rotation.x = 0.04; }
  put(root, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), steel), 0.85, 3.75, 0.9);
  const dish = put(root, new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), white), 0.85, 4.3, 0.9);
  dish.rotation.x = -Math.PI / 2.4;
  put(root, new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), orange), -0.8, 3.25, 1.0);

  // headlights and front bumper
  for (const x of [-0.85, 0.85]) put(root, box(0.32, 0.14, 0.05, lamp), x, 1.45, 2.74);
  put(root, box(2.3, 0.18, 0.2, grey), 0, 0.95, 2.75);

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}

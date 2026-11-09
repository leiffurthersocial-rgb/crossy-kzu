import * as THREE from 'three';
import { box, boxB, mat, Pool } from './voxel.js';
import { LOG_TOP, PAD_TOP, WATER_Y } from './config.js';
import { barkTexture, leafTexture, noiseTexture, texMat } from './textures.js';

const BARK = barkTexture();
const LEAF = leafTexture();
const NOISE = noiseTexture();
const leafMat = (c) => texMat('leaf', LEAF, 1, 1, c);
const noiseMat = (c) => texMat('noise', NOISE, 1, 1, c);

// ---------------------------------------------------------------------------
// Mesh factories. Vehicles are built pointing towards +X; lanes moving to -X
// rotate them by PI. All entities are pooled; `paint`/`shape` re-skin a pooled
// instance so reuse still looks varied.
// ---------------------------------------------------------------------------

export const CAR_COLORS = ['#e74c3c', '#f1c40f', '#3498db', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#ff6fa8'];
export const TRUCK_COLORS = ['#2e86de', '#27ae60', '#c0392b', '#8e44ad', '#f39c12'];

function makeCar() {
  const g = new THREE.Group();
  const body = boxB(1.4, 0.36, 0.78, '#e74c3c', 0, 0.12, 0);
  const roof = boxB(0.78, 0.06, 0.7, '#e74c3c', -0.1, 0.74, 0);
  const glass = boxB(0.74, 0.26, 0.68, '#2c3e50', -0.1, 0.48, 0);
  g.add(body, roof, glass);
  for (const [x, z] of [[0.42, 0.36], [-0.42, 0.36], [0.42, -0.36], [-0.42, -0.36]]) {
    g.add(box(0.3, 0.28, 0.14, '#222', x, 0.14, z));
  }
  g.add(box(0.04, 0.1, 0.16, '#fff6b0', 0.71, 0.36, 0.24, false));
  g.add(box(0.04, 0.1, 0.16, '#fff6b0', 0.71, 0.36, -0.24, false));
  g.add(box(0.04, 0.08, 0.16, '#a00', -0.71, 0.36, 0.26, false));
  g.add(box(0.04, 0.08, 0.16, '#a00', -0.71, 0.36, -0.26, false));
  g.add(box(0.08, 0.12, 0.8, '#9aa0a6', 0.72, 0.2, 0, false));
  g.add(box(0.08, 0.12, 0.8, '#9aa0a6', -0.72, 0.2, 0, false));
  g.userData.paint = [body, roof];
  return g;
}

function makeTruck() {
  const g = new THREE.Group();
  const cab = boxB(0.7, 0.72, 0.82, '#2e86de', 0.95, 0.14, 0);
  const win = boxB(0.06, 0.26, 0.7, '#2c3e50', 1.3, 0.5, 0);
  const cargo = boxB(1.85, 0.95, 0.88, '#ecf0f1', -0.35, 0.16, 0);
  const stripe = boxB(1.87, 0.12, 0.9, '#2e86de', -0.35, 0.5, 0);
  g.add(cab, win, cargo, stripe);
  for (const x of [0.95, -0.1, -0.9]) {
    g.add(box(0.32, 0.3, 0.14, '#222', x, 0.15, 0.4));
    g.add(box(0.32, 0.3, 0.14, '#222', x, 0.15, -0.4));
  }
  g.userData.paint = [cab, stripe];
  return g;
}

function makeLog() {
  const g = new THREE.Group();
  const trunk = box(1, 0.32, 0.72, texMat('bark', BARK, 3, 1), 0, LOG_TOP - 0.16, 0);
  trunk.receiveShadow = true;
  const ringA = box(0.04, 0.26, 0.6, '#c99a5e', 0.5, LOG_TOP - 0.16, 0, false);
  const ringB = box(0.04, 0.26, 0.6, '#c99a5e', -0.5, LOG_TOP - 0.16, 0, false);
  g.add(trunk, ringA, ringB);
  g.userData.parts = { trunk, ringA, ringB };
  return g;
}
export function shapeLog(g, len) {
  const { trunk, ringA, ringB } = g.userData.parts;
  trunk.scale.x = len - 0.06;
  trunk.material = texMat('bark', BARK, len, 1);
  ringA.position.x = (len - 0.06) / 2;
  ringB.position.x = -(len - 0.06) / 2;
}

function makePad() {
  const g = new THREE.Group();
  const leaf = box(0.82, 0.06, 0.82, '#3f9b3a', 0, PAD_TOP - 0.03, 0);
  leaf.receiveShadow = true;
  g.add(leaf);
  g.add(box(0.12, 0.08, 0.12, '#ff9ec7', -0.22, PAD_TOP + 0.02, -0.2, false)); // little flower
  return g;
}

function makeTrain() {
  const g = new THREE.Group();
  // Locomotive at +X end, two carriages behind it. Total length ~ 11.4.
  const loco = new THREE.Group();
  loco.add(boxB(3.4, 0.9, 0.9, '#c0392b', 0, 0.15, 0));
  loco.add(boxB(1.2, 0.5, 0.92, '#2c3e50', -0.9, 0.75, 0));
  loco.add(boxB(3.42, 0.12, 0.92, '#f1c40f', 0, 0.45, 0));
  loco.add(box(0.06, 0.18, 0.5, '#fff6b0', 1.72, 0.55, 0, false));
  loco.position.x = 4.0;
  g.add(loco);
  for (const x of [0.4, -3.2]) {
    const car = new THREE.Group();
    car.add(boxB(3.4, 0.95, 0.9, '#2f6fb0', 0, 0.15, 0));
    car.add(boxB(3.42, 0.2, 0.92, '#dfe6e9', 0, 0.68, 0));
    car.position.x = x;
    g.add(car);
  }
  for (const x of [4.9, 3.1, 1.3, -0.5, -2.3, -4.1]) {
    g.add(box(0.36, 0.3, 0.96, '#222', x, 0.15, 0));
  }
  g.userData.len = 11.4;
  return g;
}

function makeTree() {
  // round deciduous tree
  const g = new THREE.Group();
  const trunk = boxB(0.3, 0.3, 0.3, '#7a4b25', 0, 0, 0);
  const leaves = boxB(0.8, 0.6, 0.8, leafMat('#3a9d4a'), 0, 0.3, 0);
  const top = boxB(0.52, 0.25, 0.52, leafMat('#4cbb5c'), 0, 0.9, 0);
  const snow = boxB(0.84, 0.06, 0.84, '#ffffff', 0, 0.9, 0, false);
  g.add(trunk, leaves, top, snow);
  g.userData.parts = { leaves, top, snow };
  return g;
}

function makeTall() {
  // narrow two-tier tree
  const g = new THREE.Group();
  g.add(boxB(0.24, 0.35, 0.24, '#6e4320', 0, 0, 0));
  const a = boxB(0.62, 0.7, 0.62, leafMat('#3a9d4a'), 0, 0.35, 0);
  const b = boxB(0.44, 0.45, 0.44, leafMat('#3a9d4a'), 0, 1.05, 0);
  const snow = boxB(0.48, 0.06, 0.48, '#ffffff', 0, 1.5, 0, false);
  g.add(a, b, snow);
  g.userData.parts = { a, b, snow };
  return g;
}

function makePine() {
  const g = new THREE.Group();
  g.add(boxB(0.22, 0.3, 0.22, '#5e3a1c', 0, 0, 0));
  const tiers = [];
  const snows = [];
  [[0.88, 0.36, 0.28], [0.68, 0.36, 0.58], [0.48, 0.34, 0.88], [0.24, 0.28, 1.16]].forEach(([w, h, y], i) => {
    const t = boxB(w, h, w, leafMat('#2f6b4f'), 0, y, 0);
    const sn = boxB(w * 0.55, 0.05, w * 0.55, '#ffffff', i % 2 ? 0.05 : -0.05, y + h, 0, false);
    tiers.push(t);
    snows.push(sn);
    g.add(t, sn);
  });
  g.userData.parts = { tiers, snows };
  return g;
}

function makeCactus() {
  const g = new THREE.Group();
  const c = leafMat('#4f9a44');
  g.add(boxB(0.3, 1.0, 0.3, c, 0, 0, 0));
  g.add(boxB(0.18, 0.14, 0.18, c, 0.24, 0.35, 0));
  g.add(boxB(0.16, 0.36, 0.16, c, 0.32, 0.45, 0));
  g.add(boxB(0.16, 0.12, 0.16, c, -0.22, 0.5, 0));
  g.add(boxB(0.14, 0.3, 0.14, c, -0.3, 0.58, 0));
  g.add(boxB(0.1, 0.08, 0.1, '#ff6f91', 0, 1.0, 0, false));
  g.add(boxB(0.5, 0.06, 0.5, '#d9b36a', 0, 0, 0, false));
  return g;
}

function makePalm() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    g.add(boxB(0.2 - i * 0.015, 0.26, 0.2 - i * 0.015, i % 2 ? '#a0703a' : '#8a5a2c', i * 0.03, i * 0.26, 0));
  }
  const fronds = leafMat('#4f9a44');
  const top = 1.3;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const f = box(dx ? 0.7 : 0.22, 0.08, dz ? 0.7 : 0.22, fronds, 0.12 + dx * 0.35, top + 0.04, dz * 0.35);
    f.rotation.z = dx * -0.35;
    f.rotation.x = dz * 0.35;
    g.add(f);
  }
  g.add(boxB(0.3, 0.14, 0.3, fronds, 0.12, top, 0));
  g.add(box(0.1, 0.1, 0.1, '#6b4a2b', 0.05, top - 0.06, 0.1, false));
  return g;
}

/** Re-skin a pooled tree for its biome. `kind` matches the pool name. */
export function shapeTree(g, rng, biome, kind = 'tree') {
  const leaf = () => leafMat(rng.pick(biome.leaves));
  const snowy = !!biome.snowy;
  const p = g.userData.parts;
  if (kind === 'tree') {
    const h = rng.pick([0.5, 0.75, 1.05]);
    p.leaves.scale.y = h;
    p.leaves.position.y = 0.3 + h / 2;
    p.top.position.y = 0.3 + h + 0.12;
    p.top.visible = h > 0.6;
    p.leaves.material = leaf();
    p.top.material = p.leaves.material;
    p.snow.visible = snowy;
    p.snow.position.y = 0.3 + h + (p.top.visible ? 0.25 : 0) + 0.03;
    p.snow.scale.set(p.top.visible ? 0.56 : 0.84, 0.06, p.top.visible ? 0.56 : 0.84);
  } else if (kind === 'tall') {
    p.a.material = p.b.material = leaf();
    p.snow.visible = snowy;
  } else if (kind === 'pine') {
    const m = leaf();
    p.tiers.forEach((t) => (t.material = m));
    p.snows.forEach((s) => (s.visible = snowy));
  }
  g.rotation.y = rng.pick([0, Math.PI / 2]);
}

function makeRock() {
  const g = new THREE.Group();
  const a = boxB(0.72, 0.36, 0.64, noiseMat('#8d949b'), 0, 0, 0);
  const b = boxB(0.42, 0.14, 0.4, noiseMat('#a7aeb5'), 0.06, 0.36, -0.04);
  const snow = boxB(0.44, 0.05, 0.42, '#ffffff', 0.06, 0.5, -0.04, false);
  g.add(a, b, snow);
  g.userData.parts = { a, b, snow };
  return g;
}

export function shapeRock(g, biome) {
  const p = g.userData.parts;
  p.a.material = noiseMat(biome.rock);
  p.b.material = noiseMat(biome.rock);
  p.snow.visible = !!biome.snowy;
}

const COIN_MAT = new THREE.MeshLambertMaterial({ color: '#f5c518', emissive: '#6a4a00' });
const COIN_INNER = new THREE.MeshLambertMaterial({ color: '#ffe37a', emissive: '#7a5a10' });

function makeCoin() {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  spin.add(box(0.38, 0.38, 0.08, COIN_MAT));
  spin.add(box(0.22, 0.22, 0.1, COIN_INNER, 0, 0, 0, false));
  spin.add(box(0.06, 0.16, 0.11, COIN_MAT, 0, 0, 0, false));
  g.add(spin);
  g.userData.spin = spin;
  return g;
}

export const LIGHT_ON = new THREE.MeshBasicMaterial({ color: '#ff2b2b' });
export const LIGHT_OFF = new THREE.MeshLambertMaterial({ color: '#5a1a1a' });

export function makeSignal() {
  const g = new THREE.Group();
  g.add(boxB(0.1, 1.2, 0.1, '#555', 0, 0, 0));
  g.add(box(0.7, 0.24, 0.12, '#222', 0, 1.15, 0));
  const a = box(0.16, 0.16, 0.06, LIGHT_OFF, -0.2, 1.15, 0.08, false);
  const b = box(0.16, 0.16, 0.06, LIGHT_OFF, 0.2, 1.15, 0.08, false);
  g.add(a, b);
  // X-shaped crossing sign
  const x1 = box(0.6, 0.08, 0.04, '#f5f5f5', 0, 0.85, 0.06, false);
  x1.rotation.z = 0.6;
  const x2 = box(0.6, 0.08, 0.04, '#f5f5f5', 0, 0.85, 0.06, false);
  x2.rotation.z = -0.6;
  g.add(x1, x2);
  g.userData.lights = [a, b];
  return g;
}

function makeLamp() {
  const g = new THREE.Group();
  g.add(boxB(0.12, 1.5, 0.12, '#4a4f57', 0, 0, 0));
  g.add(boxB(0.5, 0.08, 0.1, '#4a4f57', 0.2, 1.42, 0));
  g.add(box(0.2, 0.08, 0.16, LAMP_GLOW, 0.4, 1.4, 0, false));
  g.add(boxB(0.24, 0.1, 0.24, '#3a3e45', 0, 0, 0));
  return g;
}
const LAMP_GLOW = new THREE.MeshBasicMaterial({ color: '#fff3b0' });

export const pools = {
  lamp: new Pool(makeLamp),
  car: new Pool(makeCar),
  truck: new Pool(makeTruck),
  log: new Pool(makeLog),
  pad: new Pool(makePad),
  train: new Pool(makeTrain),
  tree: new Pool(makeTree),
  tall: new Pool(makeTall),
  pine: new Pool(makePine),
  cactus: new Pool(makeCactus),
  palm: new Pool(makePalm),
  rock: new Pool(makeRock),
  coin: new Pool(makeCoin),
};

export function paint(g, color) {
  for (const m of g.userData.paint) m.material = mat(color);
}

export { WATER_Y };

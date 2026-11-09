import * as THREE from 'three';
import { box, boxB, mat, Pool } from './voxel.js';
import { LOG_TOP, PAD_TOP, WATER_Y } from './config.js';

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
  const trunk = box(1, 0.32, 0.72, '#8b5a2b', 0, LOG_TOP - 0.16, 0);
  trunk.receiveShadow = true;
  const ringA = box(0.04, 0.26, 0.6, '#c99a5e', 0.5, LOG_TOP - 0.16, 0, false);
  const ringB = box(0.04, 0.26, 0.6, '#c99a5e', -0.5, LOG_TOP - 0.16, 0, false);
  const bark = box(1, 0.04, 0.12, '#6e4420', 0, LOG_TOP + 0.005, 0.12, false);
  g.add(trunk, ringA, ringB, bark);
  g.userData.parts = { trunk, ringA, ringB, bark };
  return g;
}
export function shapeLog(g, len) {
  const { trunk, ringA, ringB, bark } = g.userData.parts;
  trunk.scale.x = len - 0.06;
  bark.scale.x = len * 0.6;
  ringA.position.x = (len - 0.06) / 2;
  ringB.position.x = -(len - 0.06) / 2;
}

function makePad() {
  const g = new THREE.Group();
  const leaf = box(0.82, 0.06, 0.82, '#3f9b3a', 0, PAD_TOP - 0.03, 0);
  leaf.receiveShadow = true;
  g.add(leaf);
  g.add(box(0.3, 0.07, 0.12, '#2f7a2b', 0.2, PAD_TOP - 0.025, 0.28, false)); // notch shade
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
  const g = new THREE.Group();
  const trunk = boxB(0.3, 0.3, 0.3, '#7a4b25', 0, 0, 0);
  const leaves = boxB(0.78, 0.6, 0.78, '#3a9d4a', 0, 0.3, 0);
  const top = boxB(0.5, 0.25, 0.5, '#4cbb5c', 0, 0.9, 0);
  g.add(trunk, leaves, top);
  g.userData.parts = { leaves, top };
  return g;
}
export function shapeTree(g, rng) {
  const { leaves, top } = g.userData.parts;
  const h = rng.pick([0.5, 0.75, 1.05]);
  leaves.scale.y = h;
  leaves.position.y = 0.3 + h / 2;
  top.position.y = 0.3 + h + 0.12;
  top.visible = h > 0.6;
  leaves.material = mat(rng.pick(['#3a9d4a', '#349245', '#43a852']));
}

function makeRock() {
  const g = new THREE.Group();
  g.add(boxB(0.72, 0.36, 0.64, '#8d949b', 0, 0, 0));
  g.add(boxB(0.42, 0.14, 0.4, '#a7aeb5', 0.06, 0.36, -0.04));
  return g;
}

function makeCoin() {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  spin.add(box(0.36, 0.36, 0.08, '#f5c518'));
  spin.add(box(0.2, 0.2, 0.1, '#ffe37a', 0, 0, 0, false));
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

export const pools = {
  car: new Pool(makeCar),
  truck: new Pool(makeTruck),
  log: new Pool(makeLog),
  pad: new Pool(makePad),
  train: new Pool(makeTrain),
  tree: new Pool(makeTree),
  rock: new Pool(makeRock),
  coin: new Pool(makeCoin),
};

export function paint(g, color) {
  for (const m of g.userData.paint) m.material = mat(color);
}

export { WATER_Y };

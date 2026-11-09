import * as THREE from 'three';
import { RNG } from './rng.js';
import { box, mat, BOX } from './voxel.js';
import {
  HALF_COLS, WRAP, LOOP, GROUND_WIDTH, LANES_AHEAD, LANES_BEHIND, FIRST_ROW,
  WATER_Y, difficulty,
} from './config.js';
import { asphaltTexture, gravelTexture, noiseTexture, waterTexture, texMat } from './textures.js';
import { biomeAt, biomeGroundTex } from './biomes.js';
import {
  pools, paint, shapeLog, shapeTree, shapeRock, makeSignal, CAR_COLORS, TRUCK_COLORS, LIGHT_ON, LIGHT_OFF,
} from './entities.js';

const CENTER_W = HALF_COLS * 2 + 1;
const SIDE_W = (GROUND_WIDTH - CENTER_W) / 2;
const SIDE_X = CENTER_W / 2 + SIDE_W / 2;

const THICK = 0.4;
const SIDE_TINT = '#a4a4a4'; // out-of-bounds strips are darker
const ASPHALT = asphaltTexture();
const GRAVEL = gravelTexture();
const NOISE = noiseTexture(17);
const WATER_TEX = [waterTexture(), waterTexture()];

// Ground boxes use a cube whose faces are regrouped into just two draw groups,
// sides (material 0) and top (material 1), so a textured top costs 2 draw calls, not 6.
const GROUND_BOX = (() => {
  const g = BOX.clone();
  const idx = Array.from(g.index.array);
  const face = (f) => idx.slice(f * 6, f * 6 + 6);
  const order = [0, 1, 3, 4, 5, 2]; // +x, -x, -y, +z, -z, then +y (top)
  g.setIndex(order.flatMap(face));
  g.clearGroups();
  g.addGroup(0, 30, 0);
  g.addGroup(30, 6, 1);
  return g;
})();
function boxMats(top, side) {
  return [side, top];
}
const groundCache = new Map();
function groundMats(key, makeTop, sideColor) {
  let m = groundCache.get(key);
  if (!m) {
    const c = makeTop(CENTER_W, '#ffffff');
    const sd = makeTop(SIDE_W, SIDE_TINT);
    const edge = mat(sideColor);
    m = { center: boxMats(c, edge), side: boxMats(sd, edge) };
    groundCache.set(key, m);
  }
  return m;
}

// Water textures scroll with the current; one set per flow direction.
const waterMats = [];
function waterMat(dir, rx, tint) {
  const k = `water${dir}|${rx}|${tint}`;
  let m = groundCache.get(k);
  if (!m) {
    const t = WATER_TEX[dir > 0 ? 0 : 1].clone();
    t.repeat.set(rx / 2, 1);
    t.needsUpdate = true;
    t.userData.dir = dir;
    m = new THREE.MeshLambertMaterial({ map: t, color: tint });
    waterMats.push(m);
    groundCache.set(k, m);
  }
  return m;
}
export function animateWater(dt) {
  for (const m of waterMats) m.map.offset.x -= m.map.userData.dir * dt * 0.18;
}

function wrapX(x) {
  return ((((x + WRAP) % LOOP) + LOOP) % LOOP) - WRAP;
}

// ---------------------------------------------------------------------------
// Lane: one row of the world. Lanes are pooled by type and re-initialised.
// ---------------------------------------------------------------------------
class Lane {
  constructor(type) {
    this.type = type;
    this.group = new THREE.Group();
    const y = type === 'river' ? WATER_Y : 0;
    this.center = box(CENTER_W, THICK, 1, '#ffffff', 0, y - THICK / 2, 0, false);
    this.left = box(SIDE_W, THICK, 1, '#ffffff', -SIDE_X, y - THICK / 2, 0, false);
    this.right = box(SIDE_W, THICK, 1, '#ffffff', SIDE_X, y - THICK / 2, 0, false);
    for (const m of [this.center, this.left, this.right]) {
      m.geometry = GROUND_BOX;
      m.material = [mat('#888888'), mat('#ffffff')];
      m.receiveShadow = true;
      this.group.add(m);
    }
    if (type === 'road') {
      const ms = groundMats('road', (w, c) => texMat('asphalt', ASPHALT, w, 1, c), '#3f3f44');
      this.center.material = ms.center;
      this.left.material = this.right.material = ms.side;
      // dashed separator toward the previous row (+Z) and solid edge lines
      this.dashes = new THREE.Group();
      for (let x = -WRAP - 4; x <= WRAP + 4; x += 2) {
        this.dashes.add(box(0.8, 0.02, 0.07, '#f2f2f2', x, 0.005, 0.5, false));
      }
      this.edgeBack = box(GROUND_WIDTH, 0.02, 0.06, '#e8e2c8', 0, 0.005, 0.44, false);
      this.edgeFront = box(GROUND_WIDTH, 0.02, 0.06, '#e8e2c8', 0, 0.005, -0.44, false);
      this.group.add(this.dashes, this.edgeBack, this.edgeFront);
    }
    if (type === 'river') {
      // sunken river bed + foam where the river meets land
      this.group.add(box(GROUND_WIDTH, 0.3, 1, '#2f6f9e', 0, WATER_Y - 0.55, 0, false));
      this.edgeBack = box(GROUND_WIDTH, 0.03, 0.09, '#e9f8ff', 0, WATER_Y + 0.005, 0.45, false);
      this.edgeFront = box(GROUND_WIDTH, 0.03, 0.09, '#e9f8ff', 0, WATER_Y + 0.005, -0.45, false);
      this.group.add(this.edgeBack, this.edgeFront);
    }
    if (type === 'rail') {
      const ms = groundMats('rail', (w, c) => texMat('gravel', GRAVEL, w, 1, c), '#6d645b');
      this.center.material = ms.center;
      this.left.material = this.right.material = ms.side;
      const n = GROUND_WIDTH;
      const sleepers = new THREE.InstancedMesh(BOX, texMat('noise', NOISE, 1, 1, '#7a5638'), n);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        m4.compose(
          new THREE.Vector3(-GROUND_WIDTH / 2 + i + 0.5, 0.03, 0),
          new THREE.Quaternion(),
          new THREE.Vector3(0.24, 0.07, 0.92),
        );
        sleepers.setMatrixAt(i, m4);
      }
      sleepers.receiveShadow = true;
      this.group.add(sleepers);
      for (const z of [0.26, -0.26]) {
        this.group.add(box(GROUND_WIDTH, 0.08, 0.09, '#8d949b', 0, 0.1, z, false));
        this.group.add(box(GROUND_WIDTH, 0.02, 0.05, '#e3e8ec', 0, 0.15, z, false)); // polished top
      }
      this.signal = makeSignal();
      this.signal.position.set(HALF_COLS + 1.2, 0, 0.42);
      this.group.add(this.signal);
    }
    this.entities = [];
    this.decor = [];
    this.blocked = new Set();
    this.coin = null;
  }

  setup(row, prev, biome) {
    this.row = row;
    this.biome = biome;
    this.group.position.set(0, 0, -row);
    const odd = row & 1;
    if (this.type === 'grass') {
      const ms = groundMats(`grass-${biome.id}-${odd}`, (w, c) => texMat(`g-${biome.id}-${odd}`, biomeGroundTex(biome, odd), w / 4, 1, c), biome.dirt);
      this.center.material = ms.center;
      this.left.material = this.right.material = ms.side;
    }
    if (this.dashes) this.dashes.visible = !!prev && prev.type === 'road';
    if (this.edgeBack) this.edgeBack.visible = !prev || prev.type !== this.type;
    if (this.edgeFront) this.edgeFront.visible = true; // updated when the next lane spawns
    this.speed = 0;
    this.blocked.clear();
    this.entities.length = 0;
    this.decor.length = 0;
    this.coin = null;
    this.state = 'idle';
    this.timer = 0;
    this.blink = 0;
    this.train = null;
  }

  setNext(next) {
    if (this.edgeFront) this.edgeFront.visible = next.type !== this.type;
  }

  applyWater() {
    const dir = this.speed >= 0 ? 1 : -1;
    const edge = mat('#3f86b8');
    this.center.material = [edge, waterMat(dir, CENTER_W, '#ffffff')];
    this.left.material = this.right.material = [edge, waterMat(dir, SIDE_W, '#b9c6d0')];
  }

  addEntity(kind, x, len) {
    const mesh = pools[kind].get();
    this.group.add(mesh);
    mesh.position.set(x, 0, 0);
    mesh.rotation.y = this.speed < 0 ? Math.PI : 0;
    const e = { kind, x, len, mesh };
    this.entities.push(e);
    return e;
  }

  addStatic(kind, col) {
    const mesh = pools[kind].get();
    this.group.add(mesh);
    mesh.position.set(col, 0, 0);
    mesh.rotation.y = 0;
    this.decor.push({ kind, mesh });
    return mesh;
  }

  update(dt, events) {
    if (this.type === 'road' || this.type === 'river') {
      const v = this.speed * dt;
      for (const e of this.entities) {
        e.x = wrapX(e.x + v);
        e.mesh.position.x = e.x;
      }
    } else if (this.type === 'rail') {
      this.updateRail(dt, events);
    }
    if (this.coin && !this.coin.taken) {
      const s = this.coin.mesh.userData.spin;
      s.rotation.y += dt * 3;
      this.coin.mesh.position.y = 0.42 + Math.sin(performance.now() / 300 + this.row) * 0.05;
    }
  }

  updateRail(dt, events) {
    this.timer -= dt;
    const lights = this.signal.userData.lights;
    if (this.state === 'idle') {
      if (this.timer <= 0) {
        this.state = 'warn';
        this.timer = 1.5;
        events.push({ type: 'bell', row: this.row });
      }
    } else if (this.state === 'warn') {
      if (this.timer <= 0) {
        this.state = 'pass';
        const dir = this.dir;
        const mesh = pools.train.get();
        mesh.rotation.y = dir > 0 ? 0 : Math.PI;
        this.group.add(mesh);
        const len = mesh.userData.len;
        this.train = { kind: 'train', len, mesh, x: -dir * (WRAP + len / 2) };
        mesh.position.set(this.train.x, 0, 0);
        events.push({ type: 'train', row: this.row });
      }
    } else if (this.state === 'pass') {
      const t = this.train;
      t.x += this.dir * this.trainSpeed * dt;
      t.mesh.position.x = t.x;
      if (Math.abs(t.x) > WRAP + t.len / 2 + 1) {
        pools.train.release(t.mesh);
        this.train = null;
        this.state = 'idle';
        this.timer = this.rng.range(2.5, 6.5);
      }
    }
    const active = this.state !== 'idle';
    this.blink += dt;
    const on = active && Math.floor(this.blink * 5) % 2 === 0;
    lights[0].material = on ? LIGHT_ON : LIGHT_OFF;
    lights[1].material = active && !on ? LIGHT_ON : LIGHT_OFF;
  }

  /** Returns the hazard overlapping [x-hw, x+hw], or null. */
  hitTest(x, hw) {
    if (this.type === 'road') {
      for (const e of this.entities) {
        if (Math.abs(e.x - x) < e.len / 2 + hw) return e;
      }
    } else if (this.type === 'rail' && this.train) {
      if (Math.abs(this.train.x - x) < this.train.len / 2 + hw) return this.train;
    }
    return null;
  }

  /** River: floating entity under x, with a little forgiveness. */
  floatAt(x) {
    let best = null;
    let bestD = Infinity;
    for (const e of this.entities) {
      const d = Math.abs(e.x - x) - e.len / 2;
      if (d < 0.22 && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  /** Road: distance to nearest vehicle driving toward x (for honks). */
  approachDistance(x) {
    let best = Infinity;
    for (const e of this.entities) {
      const dx = (x - e.x) * Math.sign(this.speed);
      if (dx > 0 && dx < best) best = dx - e.len / 2;
    }
    return best;
  }

  release() {
    for (const e of this.entities) pools[e.kind].release(e.mesh);
    for (const d of this.decor) pools[d.kind].release(d.mesh);
    if (this.train) pools.train.release(this.train.mesh);
    if (this.coin) pools.coin.release(this.coin.mesh);
    this.entities.length = 0;
    this.decor.length = 0;
    this.train = null;
    this.coin = null;
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}

// ---------------------------------------------------------------------------
// World: generates, updates and recycles lanes.
// ---------------------------------------------------------------------------
const MAX_STREAK = {
  grass: () => 3,
  road: (d) => 2 + Math.round(d * 2),
  river: (d) => (d > 0.35 ? 3 : 2),
  rail: () => 2,
};

export class World {
  constructor(scene) {
    this.scene = scene;
    this.lanes = new Map();
    this.lanePool = { grass: [], road: [], river: [], rail: [] };
    this.events = [];
  }

  reset(seed) {
    for (const lane of this.lanes.values()) this.recycle(lane);
    this.lanes.clear();
    this.rng = new RNG(seed);
    this.nextRow = FIRST_ROW;
    this.history = [];
    this.reach = null;
    this.lastRiverDir = 1;
    this.events.length = 0;
    this.ensure(0);
  }

  getLane(row) {
    return this.lanes.get(row);
  }

  ensure(camRow) {
    const ahead = Math.ceil(camRow) + LANES_AHEAD;
    while (this.nextRow <= ahead) this.spawn(this.nextRow++);
    const behind = Math.floor(camRow) - LANES_BEHIND;
    for (const [row, lane] of this.lanes) {
      if (row < behind) {
        this.recycle(lane);
        this.lanes.delete(row);
      }
    }
  }

  recycle(lane) {
    lane.release();
    this.lanePool[lane.type].push(lane);
  }

  update(dt) {
    animateWater(dt);
    for (const lane of this.lanes.values()) lane.update(dt, this.events);
  }

  pickType(row) {
    if (row <= 3) return 'grass';
    const d = difficulty(row);
    const w = {
      grass: 0.4 - 0.18 * d,
      road: 0.3 + 0.14 * d,
      river: 0.18 + 0.1 * d,
      rail: 0.09 + 0.05 * d,
    };
    const h = this.history;
    const last = h[h.length - 1];
    let streak = 0;
    for (let i = h.length - 1; i >= 0 && h[i] === last; i--) streak++;
    if (last && streak >= MAX_STREAK[last](d)) w[last] = 0;
    // a breather: never go more than 6 lanes without grass
    const recent = h.slice(-6);
    if (recent.length === 6 && !recent.includes('grass')) return 'grass';
    return this.rng.weighted(w);
  }

  spawn(row) {
    const type = this.pickType(row);
    const lane = this.lanePool[type].pop() || new Lane(type);
    const prev = this.lanes.get(row - 1);
    const biome = biomeAt(row);
    lane.setup(row, prev, biome);
    if (prev) prev.setNext(lane);
    lane.rng = this.rng;
    const d = difficulty(row);
    if (type === 'grass') this.genGrass(lane, row, d);
    else if (type === 'road') this.genRoad(lane, d);
    else if (type === 'river') this.genRiver(lane, d);
    else this.genRail(lane, d);
    if (type !== 'grass') this.reach = null; // any column is reachable after a moving lane
    this.genCoin(lane, row);
    this.history.push(type);
    if (this.history.length > 12) this.history.shift();
    this.lanes.set(row, lane);
    this.scene.add(lane.group);
  }

  genGrass(lane, row, d) {
    const rng = this.rng;
    const H = HALF_COLS;
    if (row <= -4) {
      for (let c = -H; c <= H; c++) lane.blocked.add(c);
    } else if (row <= 0) {
      if (row === -3) for (const c of [-H, H, -H + 1]) lane.blocked.add(c);
    } else {
      const density = row <= 3 ? 0.1 : 0.16 + 0.12 * d;
      for (let c = -H; c <= H; c++) if (rng.chance(density)) lane.blocked.add(c);
      if (row <= 3) lane.blocked.delete(0);
      this.ensurePassable(lane);
    }
    const biome = lane.biome;
    const place = (c, allowRock) => {
      if (allowRock && rng.chance(0.25)) {
        shapeRock(lane.addStatic('rock', c), biome);
      } else {
        const kind = rng.pick(biome.trees);
        const m = lane.addStatic(kind, c);
        shapeTree(m, rng, biome, kind);
      }
    };
    for (const c of lane.blocked) place(c, true);
    // scenery outside the playable strip
    for (let i = H + 1; i <= H + 7; i++) {
      for (const c of [i, -i]) {
        if (row <= -4 || rng.chance(i === H + 1 ? 0.7 : i <= H + 3 ? 0.35 : 0.22)) place(c, i > H + 2);
      }
    }
  }

  /** Guarantee a contiguous open run reachable from the previous lane. */
  ensurePassable(lane) {
    const H = HALF_COLS;
    const rng = this.rng;
    const prevReach = this.reach; // null means "all columns"
    const computeReach = () => {
      const result = new Set();
      let run = [];
      const flush = () => {
        if (run.some((c) => !prevReach || prevReach.has(c))) run.forEach((c) => result.add(c));
        run = [];
      };
      for (let c = -H; c <= H; c++) {
        if (lane.blocked.has(c)) flush();
        else run.push(c);
      }
      flush();
      return result;
    };
    let reach = computeReach();
    let guard = 0;
    while (reach.size < 3 && guard++ < 20) {
      const pool = prevReach ? [...prevReach] : [];
      const c = pool.length ? rng.pick(pool) : rng.int(-H, H);
      if (lane.blocked.has(c)) lane.blocked.delete(c);
      else {
        // widen the run around a reachable column
        const nb = c + (rng.chance(0.5) ? 1 : -1);
        lane.blocked.delete(Math.max(-H, Math.min(H, nb)));
      }
      reach = computeReach();
    }
    this.reach = reach;
  }

  /** Spread `lens` evenly around the loop, with bounded jitter. */
  layout(lane, kinds, lens, minGap, jitterMax) {
    const rng = this.rng;
    const total = lens.reduce((a, b) => a + b, 0);
    const n = lens.length;
    const base = (LOOP - total) / n;
    const j = Math.max(0, Math.min(jitterMax, (base - minGap) / 2));
    const shift = rng.range(0, LOOP);
    let s = 0;
    for (let i = 0; i < n; i++) {
      const x = wrapX(s + lens[i] / 2 + rng.range(-j, j) + shift);
      const e = lane.addEntity(kinds[i], x, lens[i]);
      s += lens[i] + base;
      if (e.kind === 'log') shapeLog(e.mesh, e.len);
    }
  }

  genRoad(lane, d) {
    const rng = this.rng;
    const dir = rng.chance(0.5) ? 1 : -1;
    const speed = rng.range(1.5, 2.8) + d * rng.range(1.2, 3.2);
    lane.speed = dir * speed;
    const truckLane = rng.chance(0.35);
    const minGap = 3.4 + speed * 0.22;
    const gap = Math.max(minGap, rng.range(5.5, 9) - d * 2.5);
    const kinds = [];
    const lens = [];
    let used = 0;
    while (true) {
      const kind = truckLane && rng.chance(0.75) ? 'truck' : 'car';
      const len = kind === 'truck' ? 2.7 : 1.4;
      if (used + len + gap > LOOP && kinds.length) break;
      kinds.push(kind);
      lens.push(len);
      used += len + gap;
    }
    this.layout(lane, kinds, lens, minGap, 1.5);
    if (rng.chance(0.4)) {
      const side = rng.chance(0.5) ? 1 : -1;
      const lamp = lane.addStatic('lamp', side * (HALF_COLS + 1.4));
      lamp.rotation.y = side > 0 ? Math.PI : 0;
    }
    const color = rng.pick(truckLane ? TRUCK_COLORS : CAR_COLORS);
    for (const e of lane.entities) {
      paint(e.mesh, rng.chance(0.6) ? color : rng.pick(e.kind === 'truck' ? TRUCK_COLORS : CAR_COLORS));
    }
  }

  genRiver(lane, d) {
    const rng = this.rng;
    const prevType = this.history[this.history.length - 1];
    const dir = prevType === 'river' ? -this.lastRiverDir : rng.chance(0.5) ? 1 : -1;
    this.lastRiverDir = dir;
    const pads = rng.chance(0.25);
    const kinds = [];
    const lens = [];
    if (pads) {
      lane.speed = dir * rng.range(0.4, 0.8);
      const gap = rng.range(1.2, 2.2);
      const n = Math.round(LOOP / (1 + gap));
      for (let i = 0; i < n; i++) {
        kinds.push('pad');
        lens.push(1);
      }
      this.layout(lane, kinds, lens, 0.6, 0.4);
    } else {
      lane.speed = dir * (rng.range(0.9, 1.7) + d * rng.range(0.4, 1.4));
      const gap = rng.range(1.6, 2.6) + d * 0.6;
      let used = 0;
      while (true) {
        const len = rng.pick([2, 3, 3, 4]);
        if (used + len + gap > LOOP && kinds.length >= 2) break;
        kinds.push('log');
        lens.push(len);
        used += len + gap;
      }
      this.layout(lane, kinds, lens, 1.0, 0.5);
    }
    for (const e of lane.entities) e.mesh.rotation.y = 0; // logs/pads are symmetric
    lane.applyWater();
  }

  genRail(lane, d) {
    const rng = this.rng;
    lane.dir = rng.chance(0.5) ? 1 : -1;
    lane.trainSpeed = 26 + d * 10;
    lane.timer = rng.range(1.5, 5);
  }

  genCoin(lane, row) {
    if (row < 3) return;
    const rng = this.rng;
    const p = lane.type === 'grass' ? 0.18 : lane.type === 'road' ? 0.12 : 0;
    if (!rng.chance(p)) return;
    const open = [];
    for (let c = -HALF_COLS; c <= HALF_COLS; c++) if (!lane.blocked.has(c)) open.push(c);
    if (!open.length) return;
    const col = rng.pick(open);
    const mesh = pools.coin.get();
    mesh.position.set(col, 0.42, 0);
    lane.group.add(mesh);
    lane.coin = { mesh, x: col, taken: false };
  }

  /** Collect a coin at (row, x). Returns true if collected. */
  takeCoin(row, x) {
    const lane = this.lanes.get(row);
    if (!lane || !lane.coin || lane.coin.taken) return false;
    if (Math.abs(lane.coin.x - x) > 0.5) return false;
    lane.coin.taken = true;
    pools.coin.release(lane.coin.mesh);
    lane.coin = null;
    return true;
  }
}

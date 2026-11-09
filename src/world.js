import * as THREE from 'three';
import { RNG } from './rng.js';
import { box, mat, BOX } from './voxel.js';
import {
  HALF_COLS, WRAP, LOOP, GROUND_WIDTH, LANES_AHEAD, LANES_BEHIND, FIRST_ROW,
  WATER_Y, difficulty,
} from './config.js';
import {
  pools, paint, shapeLog, shapeTree, makeSignal, CAR_COLORS, TRUCK_COLORS, LIGHT_ON, LIGHT_OFF,
} from './entities.js';

const CENTER_W = HALF_COLS * 2 + 1;
const SIDE_W = (GROUND_WIDTH - CENTER_W) / 2;
const SIDE_X = CENTER_W / 2 + SIDE_W / 2;

const GROUND = {
  grass: { a: '#9ad86a', b: '#8fcf60', sa: '#6d9f4a', sb: '#679846', y: 0 },
  road: { a: '#555861', b: '#555861', sa: '#383a40', sb: '#383a40', y: 0 },
  river: { a: '#5cc3f2', b: '#5cc3f2', sa: '#4294c4', sb: '#4294c4', y: WATER_Y },
  rail: { a: '#9c9085', b: '#968a7f', sa: '#6f665e', sb: '#6a625a', y: 0 },
};

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
    const g = GROUND[type];
    const thick = 0.4;
    this.center = box(CENTER_W, thick, 1, g.a, 0, g.y - thick / 2, 0, false);
    this.left = box(SIDE_W, thick, 1, g.sa, -SIDE_X, g.y - thick / 2, 0, false);
    this.right = box(SIDE_W, thick, 1, g.sa, SIDE_X, g.y - thick / 2, 0, false);
    for (const m of [this.center, this.left, this.right]) {
      m.receiveShadow = true;
      this.group.add(m);
    }
    if (type === 'river') {
      // dark bank strip under the water so the river reads as sunken
      this.group.add(box(GROUND_WIDTH, 0.3, 1, '#3a7fb0', 0, WATER_Y - 0.55, 0, false));
    }
    if (type === 'road') {
      // dashed lane separator on the boundary toward the previous row (+Z)
      this.dashes = new THREE.Group();
      for (let x = -WRAP - 4; x <= WRAP + 4; x += 2) {
        this.dashes.add(box(0.8, 0.02, 0.08, '#e8e8e8', x, 0.005, 0.5, false));
      }
      this.group.add(this.dashes);
    }
    if (type === 'rail') {
      const n = GROUND_WIDTH;
      const sleepers = new THREE.InstancedMesh(BOX, mat('#6e5138'), n);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        m4.compose(
          new THREE.Vector3(-GROUND_WIDTH / 2 + i + 0.5, 0.03, 0),
          new THREE.Quaternion(),
          new THREE.Vector3(0.22, 0.06, 0.9),
        );
        sleepers.setMatrixAt(i, m4);
      }
      sleepers.receiveShadow = true;
      this.group.add(sleepers);
      this.group.add(box(GROUND_WIDTH, 0.08, 0.08, '#b8bec5', 0, 0.1, 0.26, false));
      this.group.add(box(GROUND_WIDTH, 0.08, 0.08, '#b8bec5', 0, 0.1, -0.26, false));
      this.signal = makeSignal();
      this.signal.position.set(HALF_COLS + 1.2, 0, 0.42);
      this.group.add(this.signal);
    }
    this.entities = [];
    this.decor = [];
    this.blocked = new Set();
    this.coin = null;
  }

  setup(row, prev) {
    this.row = row;
    this.group.position.set(0, 0, -row);
    const g = GROUND[this.type];
    const odd = row & 1;
    this.center.material = mat(odd ? g.b : g.a);
    this.left.material = this.right.material = mat(odd ? g.sb : g.sa);
    if (this.dashes) this.dashes.visible = !!prev && prev.type === 'road';
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
    lane.setup(row, prev);
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
    for (const c of lane.blocked) {
      const kind = rng.chance(0.75) ? 'tree' : 'rock';
      const m = lane.addStatic(kind, c);
      if (kind === 'tree') shapeTree(m, rng);
    }
    // scenery outside the playable strip
    for (let i = H + 1; i <= H + 7; i++) {
      for (const c of [i, -i]) {
        if (row <= -4 || rng.chance(i === H + 1 ? 0.7 : 0.35)) {
          const m = lane.addStatic('tree', c);
          shapeTree(m, rng);
        }
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

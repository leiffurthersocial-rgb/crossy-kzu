import * as THREE from 'three';
import { buildCharacter } from './characterFactory.js';
import {
  HOP_TIME, HOP_HEIGHT, HALF_COLS, MAX_QUEUE, LOG_TOP, PAD_TOP, WATER_Y, PLAYER_HALF_WIDTH,
} from './config.js';

const DIRS = {
  up: { dr: 1, dx: 0, rot: Math.PI },
  down: { dr: -1, dx: 0, rot: 0 },
  left: { dr: 0, dx: -1, rot: -Math.PI / 2 },
  right: { dr: 0, dx: 1, rot: Math.PI / 2 },
};

function landingY(lane, ent) {
  if (!lane || lane.type !== 'river') return 0;
  if (ent) return ent.kind === 'pad' ? PAD_TOP : LOG_TOP;
  const k = lane.entities[0] && lane.entities[0].kind;
  return k === 'pad' ? PAD_TOP : LOG_TOP;
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Player {
  constructor(scene) {
    this.root = new THREE.Group(); // position in the world
    this.body = new THREE.Group(); // facing + squash
    this.root.add(this.body);
    scene.add(this.root);
    // simple blob shadow so the hop arc reads even on dark lanes
    this.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.6),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    this.blob.rotation.x = -Math.PI / 2;
    scene.add(this.blob);
    this.model = null;
    this.reset();
  }

  setCharacter(def) {
    if (this.model) this.body.remove(this.model.group);
    this.model = buildCharacter(def);
    this.model.group.scale.setScalar(1.3);
    this.body.add(this.model.group);
  }

  reset() {
    this.x = 0;
    this.row = 0;
    this.y = 0;
    this.maxRow = 0;
    this.hop = null;
    this.bump = 0;
    this.queue = [];
    this.ride = null;
    this.alive = true;
    this.deathType = null;
    this.deathT = 0;
    this.carrier = null;
    this.facing = Math.PI;
    this.idleT = 0;
    this.root.visible = true;
    this.blob.visible = true;
    this.body.scale.set(1, 1, 1);
    this.body.rotation.set(0, this.facing, 0);
    this.body.position.set(0, 0, 0);
    this.sync();
  }

  /** Row the player currently occupies for collision purposes. */
  get occupiedRow() {
    if (!this.hop) return this.row;
    return this.hop.t / HOP_TIME < 0.5 ? this.hop.fromRow : this.hop.toRow;
  }

  get visualRow() {
    return -this.root.position.z;
  }

  input(dir) {
    if (!this.alive) return;
    if (this.queue.length < MAX_QUEUE) this.queue.push(dir);
  }

  tryHop(dirName, world) {
    const d = DIRS[dirName];
    this.facing = d.rot;
    const toRow = this.row + d.dr;
    const fromLane = world.getLane(this.row);
    const toLane = world.getLane(toRow);
    if (!toLane) return false;
    const riverTarget = toLane.type === 'river';
    let tx = riverTarget ? this.x + d.dx : Math.round(this.x + d.dx);
    const col = Math.round(tx);
    if (Math.abs(col) > HALF_COLS) {
      this.bump = 0.1;
      return false;
    }
    if (toLane.type === 'grass' && toLane.blocked.has(col)) {
      this.bump = 0.1;
      return false;
    }
    const carry = this.ride && riverTarget && fromLane && fromLane.type === 'river' ? fromLane.speed : 0;
    this.hop = {
      t: 0,
      fromX: this.x,
      toX: tx,
      fromRow: this.row,
      toRow,
      fromY: this.y,
      toY: landingY(toLane),
      carry,
    };
    this.ride = null;
    return true;
  }

  /**
   * hooks: { onHop(), onLand(lane), onDeath(type, info) }
   */
  update(dt, world, hooks) {
    if (!this.alive) {
      this.updateDeath(dt);
      this.sync();
      return;
    }

    if (!this.hop && this.queue.length) {
      while (this.queue.length && !this.hop) {
        if (this.tryHop(this.queue.shift(), world)) hooks.onHop();
      }
    }

    if (this.hop) {
      const h = this.hop;
      h.t += dt;
      const e = Math.min(1, h.t / HOP_TIME);
      this.x = h.fromX + (h.toX - h.fromX) * e + h.carry * Math.min(h.t, HOP_TIME);
      const rowF = h.fromRow + (h.toRow - h.fromRow) * e;
      this.row = h.toRow;
      this.y = h.fromY + (h.toY - h.fromY) * e + Math.sin(Math.PI * e) * HOP_HEIGHT;
      this.root.position.z = -rowF;
      const s = Math.sin(Math.PI * e);
      this.body.scale.set(1 - s * 0.06, 1 + s * 0.1, 1 - s * 0.06);
      this.limbs(s);
      if (e >= 1) {
        this.x = h.toX + h.carry * HOP_TIME;
        this.hop = null;
        this.limbs(0);
        this.land(world, hooks);
        if (!this.alive) {
          this.sync();
          return;
        }
        // chain straight into the next buffered hop for responsiveness
        if (this.queue.length) {
          while (this.queue.length && !this.hop) {
            if (this.tryHop(this.queue.shift(), world)) hooks.onHop();
          }
        }
      }
    } else {
      this.root.position.z = -this.row;
      // idle bob & landing settle
      this.idleT += dt;
      const sq = this.bump > 0 ? Math.sin((this.bump / 0.1) * Math.PI) * 0.12 : 0;
      this.bump = Math.max(0, this.bump - dt);
      this.body.scale.set(1 + sq * 0.5, 1 - sq + Math.sin(this.idleT * 3) * 0.015, 1 + sq * 0.5);
    }

    // riding a log / lily pad
    if (this.ride && !this.hop) {
      const r = this.ride;
      r.cur += (r.offset - r.cur) * Math.min(1, dt * 18);
      this.x = r.ent.x + r.cur;
      if (Math.abs(this.x) > HALF_COLS + 0.6) {
        this.die('eagle');
        hooks.onDeath('edge');
      }
    }

    // vehicle / train collisions
    if (this.alive) {
      const lane = world.getLane(this.occupiedRow);
      if (lane && (lane.type === 'road' || lane.type === 'rail')) {
        const hit = lane.hitTest(this.x, PLAYER_HALF_WIDTH);
        if (hit) {
          this.die('squash', hit);
          hooks.onDeath(lane.type === 'rail' ? 'train' : 'squash', hit);
        }
      }
    }

    this.body.rotation.y = angleLerp(this.body.rotation.y, this.facing, Math.min(1, dt * 22));
    this.sync();
  }

  land(world, hooks) {
    const lane = world.getLane(this.row);
    if (lane.type === 'river') {
      const ent = lane.floatAt(this.x);
      if (!ent) {
        this.y = WATER_Y;
        this.die('drown');
        hooks.onDeath('drown');
        return;
      }
      // snap to the nearest cell of the log
      const rel = this.x - ent.x;
      const cells = Math.round(ent.len);
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < cells; i++) {
        const c = -ent.len / 2 + 0.5 + i;
        const d = Math.abs(c - rel);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      this.ride = { ent, offset: best, cur: rel };
      this.y = landingY(lane, ent);
    } else {
      this.x = Math.round(this.x);
      this.y = 0;
    }
    if (this.row > this.maxRow) this.maxRow = this.row;
    this.bump = 0.1;
    hooks.onLand(lane);
  }

  limbs(s) {
    if (!this.model) return;
    const p = this.model.parts;
    p.armL.rotation.x = -s * 1.1;
    p.armR.rotation.x = -s * 1.1;
    p.legL.rotation.x = -s * 0.6;
    p.legR.rotation.x = s * 0.6;
  }

  die(type) {
    if (!this.alive) return;
    this.alive = false;
    this.deathType = type;
    this.deathT = 0;
    this.queue.length = 0;
    this.ride = null;
    if (type === 'squash') {
      this.hop = null;
      this.y = 0.01;
    }
  }

  updateDeath(dt) {
    this.deathT += dt;
    const t = this.deathT;
    if (this.deathType === 'squash') {
      const k = Math.min(1, t / 0.08);
      this.body.scale.set(1 + 0.45 * k, 1 - 0.86 * k, 1 + 0.45 * k);
      this.limbs(0);
    } else if (this.deathType === 'drown') {
      this.y = WATER_Y - t * 1.4;
      this.body.rotation.z = Math.sin(t * 20) * 0.1;
      if (t > 0.7) this.root.visible = false;
      this.blob.visible = false;
    } else if (this.deathType === 'eagle') {
      if (this.carrier) {
        const c = this.carrier;
        this.x = c.position.x;
        this.y = c.position.y - 0.9;
        this.root.position.z = c.position.z;
        this.limbs(Math.sin(t * 25) * 0.6);
        this.blob.visible = false;
      }
    }
  }

  sync() {
    this.root.position.x = this.x;
    this.root.position.y = this.y;
    this.blob.position.set(this.x, (this.hop ? Math.min(this.hop.fromY, this.hop.toY) : this.y) + 0.012, this.root.position.z);
    const air = this.y - (this.hop ? Math.min(this.hop.fromY, this.hop.toY) : this.y);
    this.blob.scale.setScalar(1 - Math.min(0.4, air));
  }
}

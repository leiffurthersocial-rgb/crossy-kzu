import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { Effects } from './effects.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { storage } from './storage.js';
import { CHARACTERS, BUILD_LABEL, getCharacter } from './characters.js';
import { buildCharacter } from './characterFactory.js';
import { boxB } from './voxel.js';
import { WATER_Y, difficulty } from './config.js';

const CAM_OFFSET = new THREE.Vector3(2.4, 10, 6.2);
const SKY = '#7cc6f0';
const IDLE_LIMIT = 9; // seconds without forward progress before the eagle comes

class Game {
  constructor() {
    // --- renderer -----------------------------------------------------------
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({ antialias: dpr < 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('game').appendChild(this.renderer.domElement);

    // --- world scene ----------------------------------------------------------
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6a7a8a', 1.6));
    this.sun = new THREE.DirectionalLight('#fff4e0', 2.2);
    this.sun.castShadow = true;
    const isMobile = matchMedia('(pointer: coarse)').matches;
    this.sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -14; sc.right = 14; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 50;
    this.sun.shadow.bias = -0.0015;
    this.scene.add(this.sun, this.sun.target);

    this.world = new World(this.scene);
    this.player = new Player(this.scene);
    this.effects = new Effects(this.scene);

    // --- preview scene (character select) ------------------------------------
    this.preview = new THREE.Scene();
    this.preview.background = new THREE.Color('#5aa9e0');
    this.previewCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.previewCam.position.set(0, 1.5, 5.6);
    this.previewCam.lookAt(0, 0.35, 0);
    this.preview.add(new THREE.HemisphereLight('#ffffff', '#4a6a8a', 1.7));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(2, 4, 3);
    this.preview.add(key);
    this.pedestal = new THREE.Group();
    this.pedestal.add(boxB(1.4, 0.25, 1.4, '#9ad86a', 0, -0.25, 0, false));
    this.pedestal.add(boxB(1.5, 0.12, 1.5, '#7bb553', 0, -0.37, 0, false));
    this.preview.add(this.pedestal);
    this.previewModels = new Map();

    // --- state ------------------------------------------------------------------
    this.coins = storage.coins;
    this.best = storage.best;
    this.unlocked = new Set(storage.unlocked);
    this.selected = this.unlocked.has(storage.selected) ? storage.selected : 'robin';
    this.audio = new Sfx(storage.muted);
    this.state = 'title';
    this.shake = 0;
    this.hornCooldown = 0;

    this.ui = new UI({
      click: () => {
        this.audio.unlock();
        this.audio.click();
      },
      play: () => this.play(),
      retry: () => this.play(),
      menu: () => this.toMenu(),
      openSelect: () => this.openSelect(),
      closeSelect: () => this.closeSelect(),
      browse: (d) => this.browse(d),
      choose: () => this.choose(),
      pause: () => this.pause(),
      resume: () => this.resume(),
      toggleMute: () => this.toggleMute(),
    });
    this.ui.setCoins(this.coins);
    this.ui.setBest(this.best);
    this.ui.setMuted(this.audio.muted);

    this.input = new Input({
      onDir: (d) => this.onDir(d),
      onKey: (code) => this.onKey(code),
      onGesture: () => this.audio.unlock(),
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    window.addEventListener('resize', () => this.resize());

    this.player.setCharacter(getCharacter(this.selected));
    this.resetRun();
    this.resize();
    this.ui.show('title');

    this.last = performance.now();
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  // ---------------------------------------------------------------------------
  // flow
  // ---------------------------------------------------------------------------
  resetRun() {
    this.world.reset((Math.random() * 2 ** 31) | 0);
    this.player.reset();
    this.effects.reset();
    this.camRow = 0;
    this.camX = 0;
    this.started = false;
    this.score = 0;
    this.runCoins = 0;
    this.idleT = 0;
    this.deathT = 0;
    this.cause = null;
    this.ui.setScore(0, this.best);
  }

  play() {
    this.audio.unlock();
    if (this.state !== 'title') this.resetRun();
    this.state = 'playing';
    this.ui.show('hud');
  }

  toMenu() {
    this.resetRun();
    this.state = 'title';
    this.ui.setBest(this.best);
    this.ui.show('title');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.last = performance.now();
    this.ui.show('hud');
  }

  toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    storage.muted = this.audio.muted;
    this.ui.setMuted(this.audio.muted);
  }

  openSelect() {
    this.state = 'select';
    this.selectIndex = Math.max(0, CHARACTERS.findIndex((c) => c.id === this.selected));
    this.showPreview();
    this.ui.show('select');
  }

  closeSelect() {
    this.state = 'title';
    this.ui.show('title');
  }

  browse(d) {
    this.selectIndex = (this.selectIndex + d + CHARACTERS.length) % CHARACTERS.length;
    this.showPreview();
  }

  choose() {
    const c = CHARACTERS[this.selectIndex];
    if (!this.unlocked.has(c.id)) {
      if (this.coins < c.cost) {
        this.audio.bump();
        return;
      }
      this.coins -= c.cost;
      storage.coins = this.coins;
      this.unlocked.add(c.id);
      storage.unlocked = [...this.unlocked];
      this.ui.setCoins(this.coins);
      this.audio.fanfare();
      this.previewSpin = 0.6;
    }
    this.selected = c.id;
    storage.selected = c.id;
    this.player.setCharacter(c);
    this.showPreview();
  }

  showPreview() {
    const c = CHARACTERS[this.selectIndex];
    for (const m of this.previewModels.values()) m.visible = false;
    let model = this.previewModels.get(c.id);
    if (!model) {
      model = buildCharacter(c).group;
      model.scale.setScalar(1.25);
      this.preview.add(model);
      this.previewModels.set(c.id, model);
    }
    model.visible = true;
    model.rotation.y = 0.5;
    this.previewModel = model;
    this.ui.renderSelect(CHARACTERS, {
      index: this.selectIndex,
      unlocked: this.unlocked,
      selected: this.selected,
      coins: this.coins,
      buildLabel: BUILD_LABEL,
    });
  }

  onDir(dir) {
    this.audio.unlock();
    if (this.state === 'title') {
      this.play();
      this.player.input(dir);
      this.started = true;
    } else if (this.state === 'playing') {
      this.player.input(dir);
      this.started = true;
    } else if (this.state === 'select' && (dir === 'left' || dir === 'right')) {
      this.browse(dir === 'left' ? -1 : 1);
    }
  }

  onKey(code) {
    this.audio.unlock();
    if (code === 'Escape' || code === 'KeyP') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
      else if (this.state === 'select') this.closeSelect();
    } else if (code === 'Enter' || code === 'Space') {
      if (this.state === 'title' || this.state === 'over') this.play();
      else if (this.state === 'paused') this.resume();
      else if (this.state === 'select') this.choose();
    } else if (code === 'KeyM') {
      this.toggleMute();
    }
  }

  // ---------------------------------------------------------------------------
  // gameplay hooks
  // ---------------------------------------------------------------------------
  get hooks() {
    return (this._hooks ||= {
      onHop: () => this.audio.hop(),
      onLand: (lane) => this.onLand(lane),
      onDeath: (type) => this.onDeath(type),
    });
  }

  onLand(lane) {
    const p = this.player;
    if (p.maxRow > this.score) {
      this.score = p.maxRow;
      this.idleT = 0;
      this.ui.setScore(this.score, this.best);
    }
    if (this.world.takeCoin(p.row, p.x)) {
      this.coins++;
      this.runCoins++;
      storage.coins = this.coins;
      this.ui.setCoins(this.coins);
      this.audio.coin();
      this.effects.sparkle(p.root.position.clone().setY(0.5));
    }
    if (lane.type === 'road' && this.hornCooldown <= 0 && lane.approachDistance(p.x) < 2.2) {
      this.audio.horn();
      this.hornCooldown = 2.5;
    }
  }

  onDeath(type) {
    const p = this.player;
    this.cause = type;
    this.state = 'dying';
    this.deathT = 0;
    if (type === 'squash' || type === 'train') {
      this.audio.squash();
      if (type === 'squash') this.audio.horn();
      this.effects.dust(p.root.position.clone().setY(0.2), '#ffffff');
      this.shake = 0.35;
    } else if (type === 'drown') {
      this.audio.splash();
      this.effects.splash(new THREE.Vector3(p.x, WATER_Y + 0.05, p.root.position.z));
    } else {
      p.die('eagle');
      this.audio.eagle();
      this.effects.startEagle(p);
    }
  }

  gameOver() {
    const newBest = this.score > this.best;
    if (newBest) {
      this.best = this.score;
      storage.best = this.best;
    }
    this.state = 'over';
    this.audio.gameOver();
    this.ui.setBest(this.best);
    this.ui.showGameOver({ score: this.score, best: this.best, coins: this.runCoins, newBest, cause: this.cause });
  }

  // ---------------------------------------------------------------------------
  // loop
  // ---------------------------------------------------------------------------
  frame(now) {
    const raw = (now - this.last) / 1000;
    const dt = Math.min(0.05, raw);
    this.last = now;
    this.adaptQuality(raw);
    this.update(dt);
    if (this.state === 'select') {
      this.renderer.render(this.preview, this.previewCam);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /** Step quality down on slow devices: first pixel ratio, then shadows. */
  adaptQuality(raw) {
    if (this.state !== 'playing' || raw > 0.25) return; // ignore tab switches
    this.frameAvg = this.frameAvg ? this.frameAvg * 0.97 + raw * 0.03 : raw;
    this.qualityT = (this.qualityT || 0) + raw;
    if (this.qualityT < 3) return;
    this.qualityT = 0;
    if (this.frameAvg < 1 / 48) return;
    const r = this.renderer;
    if (r.getPixelRatio() > 1) {
      r.setPixelRatio(Math.max(1, r.getPixelRatio() - 0.5));
      this.resize();
    } else if (this.sun.castShadow) {
      this.sun.castShadow = false; // light-state change recompiles materials without shadows
    }
  }

  update(dt) {
    const s = this.state;
    if (s === 'paused') return;
    if (s === 'select') {
      if (this.previewModel) {
        this.previewSpin = Math.max(0, (this.previewSpin || 0) - dt);
        this.previewModel.rotation.y += dt * (0.9 + this.previewSpin * 12);
        this.previewModel.position.y = this.previewSpin > 0 ? Math.sin(this.previewSpin * 5) * 0.2 : 0;
      }
      return;
    }

    this.hornCooldown -= dt;
    this.world.update(dt);
    for (const ev of this.world.events) {
      const near = Math.abs(ev.row - this.player.row) < 8 && s !== 'title';
      if (ev.type === 'bell' && near) this.audio.bell();
      if (ev.type === 'train' && near) this.audio.train();
    }
    this.world.events.length = 0;

    this.player.update(dt, this.world, this.hooks);
    this.effects.update(dt);

    if (this.state === 'playing') {
      this.updateCamera(dt, true);
      const p = this.player;
      if (this.started) this.idleT += dt;
      const lingering = this.idleT > IDLE_LIMIT;
      if (p.alive && !p.hop && (lingering || p.visualRow < this.camRow - this.killRows)) {
        this.onDeath('eagle');
      }
    } else if (this.state === 'dying') {
      this.updateCamera(dt, false);
      this.deathT += dt;
      if (this.deathT > (this.cause === 'eagle' || this.cause === 'edge' ? 1.9 : 1.3)) this.gameOver();
    } else {
      this.updateCamera(dt, false);
    }
    this.world.ensure(this.camRow);
  }

  updateCamera(dt, follow) {
    const p = this.player;
    if (follow) {
      if (this.started) this.camRow += (0.42 + difficulty(this.score) * 0.45) * dt;
      const pr = p.visualRow;
      if (pr > this.camRow) this.camRow += (pr - this.camRow) * (1 - Math.exp(-dt * 3.5));
      const tx = Math.max(-2, Math.min(2, p.x));
      this.camX += (tx - this.camX) * (1 - Math.exp(-dt * 3));
    }
    this.shake = Math.max(0, this.shake - dt);
    const sh = this.shake * 0.5;
    const fx = this.camX - this.lead.x + (Math.random() - 0.5) * sh;
    const fz = -this.camRow - this.lead.z + (Math.random() - 0.5) * sh;
    this.camera.position.set(fx + CAM_OFFSET.x, CAM_OFFSET.y, fz + CAM_OFFSET.z);
    this.camera.lookAt(fx, 0, fz);
    this.sun.position.set(fx - 5, 14, fz + 6);
    this.sun.target.position.set(fx, 0, fz - 2);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    let halfW;
    let halfH;
    if (aspect < 1) {
      halfW = 5.6;
      halfH = halfW / aspect;
    } else {
      halfH = 6.6;
      halfW = halfH * aspect;
    }
    const cam = this.camera;
    cam.left = -halfW;
    cam.right = halfW;
    cam.top = halfH;
    cam.bottom = -halfH;
    cam.updateProjectionMatrix();

    // Work out where the player should sit on screen and where the bottom edge is.
    cam.position.copy(CAM_OFFSET);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ground = (ndcY) => {
      ray.setFromCamera(new THREE.Vector2(0, ndcY), cam);
      const v = new THREE.Vector3();
      ray.ray.intersectPlane(plane, v);
      return v;
    };
    const playerAt = ground(aspect < 1 ? -0.42 : -0.3);
    const bottom = ground(-1);
    this.lead = playerAt;
    this.killRows = bottom.z - playerAt.z - 0.7;

    this.previewCam.aspect = aspect;
    this.previewCam.position.z = aspect < 1 ? 5.6 / Math.max(0.5, aspect) : 5.6;
    this.previewCam.updateProjectionMatrix();
    this.updateCamera(0, false);
  }
}

window.game = new Game();

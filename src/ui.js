// DOM overlay: screens, HUD, toasts and buttons. Game logic lives in main.js;
// this module only renders state and forwards clicks.
const $ = (id) => document.getElementById(id);

const SOUND_ON = '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M15 8.5a5 5 0 0 1 0 7" stroke="#fff" stroke-width="2.2" fill="none"/><path d="M17.5 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2.2" fill="none"/></svg>';
const SOUND_OFF = '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M15 9l6 6M21 9l-6 6" stroke="#fff" stroke-width="2.4"/></svg>';

const LOGO_COLORS = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];
const LOGO_B_COLORS = ['#2b2b2b', '#e74c3c', '#2b2b2b'];

const DEATH = {
  squash: ['💥', 'SPLAT!'],
  train: ['🚂', 'TRAIN WRECK!'],
  drown: ['💦', 'SPLASH!'],
  eagle: ['🦅', 'SNATCHED!'],
  edge: ['🦅', 'SWEPT AWAY!'],
};

function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // reflow so the animation can replay
  el.classList.add(cls);
}

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.screens = ['title', 'select', 'pause', 'over'].reduce((o, k) => ((o[k] = $('screen-' + k)), o), {});
    this.buildLogo();
    this.current = null;

    const on = (id, fn) =>
      $(id).addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.click();
        fn();
      });
    on('btn-play', handlers.play);
    on('btn-chars', handlers.openSelect);
    on('btn-over-chars', handlers.openSelect);
    on('btn-back', handlers.closeSelect);
    on('btn-prev', () => handlers.browse(-1));
    on('btn-next', () => handlers.browse(1));
    on('btn-choose', handlers.choose);
    on('btn-pause', handlers.pause);
    on('btn-resume', handlers.resume);
    on('btn-pause-menu', handlers.menu);
    on('btn-retry', handlers.retry);
    on('btn-menu', handlers.menu);
    on('btn-mute', handlers.toggleMute);
  }

  buildLogo() {
    const fill = (el, text, colors, big) => {
      [...text].forEach((ch, i) => {
        const s = document.createElement('span');
        s.textContent = ch;
        s.style.setProperty('--c', colors[i % colors.length]);
        s.style.setProperty('--r', `${(i % 2 ? 1 : -1) * (big ? 4 : 3)}deg`);
        s.style.setProperty('--d', `${i * 0.12}s`);
        el.appendChild(s);
      });
    };
    fill($('logo-a'), 'CROSSY', LOGO_COLORS, false);
    fill($('logo-b'), 'KZU', LOGO_B_COLORS, true);
  }

  show(name) {
    for (const k in this.screens) {
      const on = k === name;
      const el = this.screens[k];
      if (on && el.classList.contains('hidden')) restartAnim(el, 'enter');
      el.classList.toggle('hidden', !on);
    }
    $('hud').classList.toggle('hidden', !(name === 'hud' || name === 'pause'));
    this.current = name;
  }

  setScore(score, best, pop = false) {
    const el = $('score');
    el.textContent = score;
    $('hud-best').textContent = `TOP ${Math.max(score, best)}`;
    $('pause-score').textContent = score;
    if (pop) restartAnim(el, 'pop');
  }

  setCoins(n, pop = false) {
    for (const id of ['hud-coins', 'title-coins', 'select-coins']) $(id).textContent = n;
    if (pop) restartAnim($('hud-coin-pill'), 'pop');
  }

  setBest(n) {
    $('title-best').textContent = n;
  }

  setCharName(name) {
    $('title-char').textContent = name;
  }

  setUnlockBadge(on) {
    $('title-badge').classList.toggle('hidden', !on);
  }

  setMuted(m) {
    $('btn-mute').innerHTML = m ? SOUND_OFF : SOUND_ON;
    $('btn-mute').setAttribute('aria-pressed', String(m));
  }

  /** Short banner at the top of the screen (biome names, new best...). */
  toast(text, kind = '') {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = text;
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  flash(color = '#fff') {
    const f = $('flash');
    f.style.background = color;
    restartAnim(f, 'on');
  }

  setDanger(level) {
    $('vignette').style.opacity = level.toFixed(2);
  }

  tutorial(show, touch) {
    const el = $('tutorial');
    el.classList.toggle('hidden', !show);
    el.classList.toggle('touch', !!touch);
  }

  showGameOver({ score, best, coins, newBest, cause, canUnlock }) {
    const [icon, title] = DEATH[cause] || ['💥', 'GAME OVER'];
    $('over-icon').textContent = icon;
    $('over-title').textContent = title;
    $('over-best').textContent = best;
    $('over-new').classList.toggle('hidden', !newBest);
    $('over-unlock').classList.toggle('hidden', !canUnlock);
    $('btn-over-chars').classList.toggle('glow', !!canUnlock);
    this.show('over');
    this.countUp($('over-score'), score, '');
    this.countUp($('over-coins'), coins, '+');
  }

  countUp(el, to, prefix) {
    const start = performance.now();
    const dur = Math.min(700, 120 + to * 25);
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      el.textContent = prefix + Math.round(to * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** chars: CHARACTERS array; info: {index, unlocked:Set, selected, coins, buildLabel} */
  renderSelect(chars, { index, unlocked, selected, coins, buildLabel }) {
    const c = chars[index];
    const isUnlocked = unlocked.has(c.id);
    $('char-name').textContent = c.name;
    restartAnim($('char-name'), 'pop');
    const extras = [];
    if (c.accessories.includes('glasses')) extras.push('glasses');
    if (c.accessories.includes('goatee')) extras.push('goatee');
    $('char-desc').textContent = `${buildLabel[c.build]} build${extras.length ? ' · ' + extras.join(' · ') : ''}`;
    $('char-lock').classList.toggle('hidden', isUnlocked);

    const prog = $('char-progress');
    prog.classList.toggle('hidden', isUnlocked || coins >= c.cost);
    if (!isUnlocked) {
      $('char-progress-fill').style.width = `${Math.min(100, (coins / c.cost) * 100)}%`;
      $('char-progress-text').textContent = `${coins} / ${c.cost}`;
    }

    const btn = $('btn-choose');
    btn.className = 'btn';
    if (isUnlocked) {
      const sel = selected === c.id;
      btn.textContent = sel ? 'SELECTED ✓' : 'SELECT';
      btn.classList.add(sel ? 'btn-secondary' : 'btn-play');
    } else if (coins >= c.cost) {
      btn.innerHTML = `UNLOCK · ${c.cost} <span class="coin-icon"></span>`;
      btn.classList.add('btn-locked', 'glow');
    } else {
      btn.innerHTML = `NEED ${c.cost - coins} MORE <span class="coin-icon"></span>`;
      btn.classList.add('btn-disabled');
    }
    const dots = $('char-dots');
    dots.innerHTML = '';
    chars.forEach((ch, i) => {
      const d = document.createElement('i');
      if (i === index) d.classList.add('on');
      if (!unlocked.has(ch.id)) d.classList.add('locked');
      dots.appendChild(d);
    });
  }
}

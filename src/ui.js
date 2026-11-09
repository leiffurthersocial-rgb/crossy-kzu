// DOM overlay: screens, HUD and buttons. Game logic lives in main.js;
// this module only renders state and forwards clicks.
const $ = (id) => document.getElementById(id);

const SOUND_ON = '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M15 8.5a5 5 0 0 1 0 7" stroke="#fff" stroke-width="2.2" fill="none"/><path d="M17.5 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2.2" fill="none"/></svg>';
const SOUND_OFF = '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M15 9l6 6M21 9l-6 6" stroke="#fff" stroke-width="2.4"/></svg>';

const LOGO_COLORS = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];
const LOGO_B_COLORS = ['#2b2b2b', '#e74c3c', '#2b2b2b'];

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.screens = ['title', 'select', 'pause', 'over'].reduce((o, k) => ((o[k] = $('screen-' + k)), o), {});
    this.buildLogo();

    const on = (id, fn) =>
      $(id).addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.click();
        fn();
      });
    on('btn-play', handlers.play);
    on('btn-chars', handlers.openSelect);
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
    for (const k in this.screens) this.screens[k].classList.toggle('hidden', k !== name);
    $('hud').classList.toggle('hidden', !(name === 'hud' || name === 'pause'));
  }

  setScore(score, best) {
    $('score').textContent = score;
    $('hud-best').textContent = `TOP ${Math.max(score, best)}`;
  }

  setCoins(n) {
    for (const id of ['hud-coins', 'title-coins', 'select-coins']) $(id).textContent = n;
  }

  setBest(n) {
    $('title-best').textContent = n;
  }

  setMuted(m) {
    $('btn-mute').innerHTML = m ? SOUND_OFF : SOUND_ON;
  }

  showGameOver({ score, best, coins, newBest, cause }) {
    $('over-score').textContent = score;
    $('over-best').textContent = best;
    $('over-coins').textContent = `+${coins}`;
    $('over-new').classList.toggle('hidden', !newBest);
    const titles = { squash: 'SPLAT!', train: 'TRAIN WRECK!', drown: 'SPLASH!', eagle: 'SNATCHED!', edge: 'SNATCHED!' };
    $('over-title').textContent = titles[cause] || 'GAME OVER';
    this.show('over');
  }

  /** chars: CHARACTERS array; info: {index, unlocked:Set, selected, coins, buildLabel} */
  renderSelect(chars, { index, unlocked, selected, coins, buildLabel }) {
    const c = chars[index];
    const isUnlocked = unlocked.has(c.id);
    $('char-name').textContent = c.name;
    const extras = [];
    if (c.accessories.includes('glasses')) extras.push('glasses');
    if (c.accessories.includes('goatee')) extras.push('goatee');
    $('char-desc').textContent = `${buildLabel[c.build]} build${extras.length ? ' · ' + extras.join(' · ') : ''}`;
    const btn = $('btn-choose');
    btn.className = 'btn';
    if (isUnlocked) {
      const sel = selected === c.id;
      btn.textContent = sel ? 'SELECTED ✓' : 'SELECT';
      btn.classList.add(sel ? 'btn-secondary' : 'btn-play');
    } else if (coins >= c.cost) {
      btn.innerHTML = `UNLOCK · ${c.cost} <span class="coin-icon"></span>`;
      btn.classList.add('btn-locked');
    } else {
      btn.innerHTML = `🔒 ${c.cost} <span class="coin-icon"></span> NEEDED`;
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

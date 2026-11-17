// The HUD: health and armour bars, cash, wanted stars, weapon and ammo,
// speed, the mission objective, a live minimap, toasts, prompts and menus.
import { WANTED_NAMES } from './config.js';
import { clamp } from './random.js';

export class Hud {
  constructor(city) {
    this.city = city;
    this.el = {};
    for (const id of ['hud', 'health-fill', 'armor-fill', 'armor-row', 'cash', 'wanted-stars',
      'weapon-name', 'ammo', 'speed', 'speed-row', 'objective', 'objective-title', 'message',
      'interact', 'crosshair', 'minimap', 'vignette', 'clock', 'title-screen', 'btn-new',
      'btn-continue', 'btn-howto', 'howto-panel', 'title-missions', 'pause-menu', 'btn-resume',
      'btn-save', 'btn-quit-title', 'btn-restart-mission', 'pause-stats', 'shop-panel',
      'shop-title', 'shop-items', 'btn-close-shop', 'overlay-wasted', 'overlay-busted',
      'banner', 'banner-title', 'banner-sub', 'save-note']) {
      this.el[id] = document.getElementById(id);
    }
    this.minimap = this.el['minimap'].getContext('2d');
    this.messageTimer = 0;
    this.bannerTimer = 0;
    this.roadCoords = [...new Set(city.intersections.map((n) => n.x))].sort((a, b) => a - b);
    // Callbacks the world wires up.
    this.onNewGame = null;
    this.onContinue = null;
    this.onResume = null;
    this.onSave = null;
    this.onQuitToTitle = null;
    this.onRestartMission = null;
    this.onShopBuy = null;
    this.onCloseShop = null;
    this.wireButtons();
  }

  wireButtons() {
    const click = (id, fn) => {
      const el = this.el[id];
      if (el) el.addEventListener('click', () => { if (fn) fn(); });
    };
    click('btn-new', () => this.onNewGame && this.onNewGame());
    click('btn-continue', () => this.onContinue && this.onContinue());
    click('btn-howto', () => {
      const panel = this.el['howto-panel'];
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    click('btn-resume', () => this.onResume && this.onResume());
    click('btn-save', () => this.onSave && this.onSave());
    click('btn-quit-title', () => this.onQuitToTitle && this.onQuitToTitle());
    click('btn-restart-mission', () => this.onRestartMission && this.onRestartMission());
    click('btn-close-shop', () => this.onCloseShop && this.onCloseShop());
  }

  showTitle(hasSave, missions, completedCount) {
    this.el['title-screen'].style.display = 'flex';
    this.el['hud'].style.display = 'none';
    this.el['btn-continue'].style.display = hasSave ? 'inline-block' : 'none';
    this.el['title-missions'].innerHTML = missions.map((m, i) => {
      const done = i < completedCount;
      const current = i === completedCount;
      const mark = done ? '✓' : current ? '▶' : '·';
      return `<div class="mission-row ${done ? 'done' : ''} ${current ? 'current' : ''}">${mark} ${i + 1}. ${m.name} — $${m.reward.toLocaleString()}</div>`;
    }).join('');
  }

  hideTitle() {
    this.el['title-screen'].style.display = 'none';
    this.el['hud'].style.display = 'block';
  }

  showPause(statsText) {
    this.el['pause-menu'].style.display = 'flex';
    this.el['pause-stats'].textContent = statsText;
  }

  hidePause() {
    this.el['pause-menu'].style.display = 'none';
  }

  showShop(shop, items) {
    this.el['shop-title'].textContent = shop.name;
    const container = this.el['shop-items'];
    container.innerHTML = '';
    for (const item of items) {
      const button = document.createElement('button');
      button.className = 'shop-item';
      button.innerHTML = `<span>${item.label}</span><span>$${item.price}</span>`;
      button.addEventListener('click', () => { if (this.onShopBuy) this.onShopBuy(item); });
      container.appendChild(button);
    }
    this.el['shop-panel'].style.display = 'flex';
  }

  hideShop() {
    this.el['shop-panel'].style.display = 'none';
  }

  showWasted() { this.el['overlay-wasted'].style.display = 'flex'; }
  hideWasted() { this.el['overlay-wasted'].style.display = 'none'; }
  showBusted() { this.el['overlay-busted'].style.display = 'flex'; }
  hideBusted() { this.el['overlay-busted'].style.display = 'none'; }

  showMessage(text, seconds) {
    this.el['message'].textContent = text;
    this.el['message'].style.opacity = '1';
    this.messageTimer = seconds || 4;
  }

  showBanner(title, sub, seconds) {
    this.el['banner-title'].textContent = title;
    this.el['banner-sub'].textContent = sub || '';
    this.el['banner'].style.display = 'block';
    this.bannerTimer = seconds || 3.5;
  }

  update(dt, state) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.el['message'].style.opacity = '0';
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el['banner'].style.display = 'none';
    }
    this.el['health-fill'].style.width = `${clamp(state.health, 0, 100)}%`;
    this.el['health-fill'].style.background = state.health < 30 ? '#e33' : '#5da85d';
    this.el['armor-row'].style.display = state.armor > 0 ? 'flex' : 'none';
    this.el['armor-fill'].style.width = `${clamp(state.armor, 0, 100)}%`;
    this.el['cash'].textContent = `$${Math.floor(state.cash).toLocaleString()}`;
    const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    this.el['wanted-stars'].textContent = stars;
    this.el['wanted-stars'].style.color = state.wanted > 0 ? '#ffd800' : 'rgba(255,255,255,0.35)';
    this.el['wanted-stars'].title = WANTED_NAMES[state.wanted] || '';
    this.el['weapon-name'].textContent = state.weaponName;
    this.el['ammo'].textContent = state.reloading ? 'RELOADING…' : `${state.magAmmo} / ∞`;
    this.el['speed-row'].style.display = state.inCar ? 'flex' : 'none';
    if (state.inCar) this.el['speed'].textContent = `${Math.round(Math.abs(state.speed) * 3.2)} km/h`;
    this.el['objective-title'].textContent = state.missionTitle || 'Free roam';
    this.el['objective'].textContent = state.objectiveText || 'Explore Solmar City. Press M for the mission list, E to interact.';
    this.el['interact'].style.display = state.interactText ? 'block' : 'none';
    this.el['interact'].textContent = state.interactText || '';
    this.el['crosshair'].style.display = state.showCrosshair ? 'block' : 'none';
    const lowHealth = state.health < 30;
    this.el['vignette'].style.opacity = lowHealth ? '0.55' : state.wanted >= 4 ? '0.25' : '0';
    const minutes = Math.floor(state.clockMinutes % 60);
    const hours = Math.floor(state.clockMinutes / 60) % 24;
    this.el['clock'].textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const ctx = this.minimap;
    const size = 180;
    const scale = size / 640; // world -320..320 maps onto the canvas
    const toMap = (x, z) => [(x + 320) * scale, (z + 320) * scale];
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(16, 28, 40, 0.85)';
    ctx.fillRect(0, 0, size, size);
    // Ocean strip on the west edge.
    ctx.fillStyle = 'rgba(42, 122, 158, 0.9)';
    const [ox] = toMap(-320, 0);
    ctx.fillRect(0, 0, toMap(-261, 0)[0], size);
    // Roads.
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.55)';
    ctx.lineWidth = 2;
    for (const c of this.roadCoords) {
      const [x1] = toMap(c, 0);
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, size);
      ctx.stroke();
      const [, z1] = toMap(0, c);
      ctx.beginPath();
      ctx.moveTo(0, z1);
      ctx.lineTo(size, z1);
      ctx.stroke();
    }
    // Shops.
    ctx.fillStyle = '#7ad0ff';
    for (const shop of state.shops || []) {
      const [sx, sy] = toMap(shop.pos[0], shop.pos[1]);
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
    }
    // Collectibles.
    ctx.fillStyle = '#2aff66';
    for (const spot of state.collectibles || []) {
      const [cx, cy] = toMap(spot.x, spot.z);
      ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
    // Traffic.
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (const car of state.traffic || []) {
      const [cx, cy] = toMap(car.x, car.z);
      ctx.fillRect(cx - 1, cy - 1, 2, 2);
    }
    // Police.
    ctx.fillStyle = '#ff4444';
    for (const car of state.policeCars || []) {
      const [cx, cy] = toMap(car.x, car.z);
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mission marker (pulsing).
    if (state.marker) {
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      const pulse = 5 + Math.sin(state.time * 5) * 2;
      ctx.fillStyle = '#ffd800';
      ctx.beginPath();
      ctx.arc(mx, my, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(state.playerHeading), -Math.cos(state.playerHeading)));
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // North marker.
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('N', size - 12, 13);
  }
}

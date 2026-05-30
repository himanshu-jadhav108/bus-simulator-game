// ui.js - HUD and dashboard UI management

export class UI {
  constructor() {
    this.elements = {};
    this.notifications = [];
    this.notifTimer = 0;
    this._cache();
  }

  _cache() {
    const ids = [
      'speed-val', 'fuel-bar', 'fuel-val', 'money-val',
      'passengers-val', 'stop-name', 'fps-val', 'gear-val',
      'weather-icon', 'route-strip', 'notification',
      'pause-screen', 'stop-indicator', 'rating-val',
      'garage-screen', 'engine-cost', 'brakes-cost'
    ];
    ids.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
  }

  update(state) {
    const { speed, fuel, money, passengers, currentStop, fps, gear, weather, paused } = state;

    if (this.elements['speed-val'])
      this.elements['speed-val'].textContent = Math.round(speed);

    if (this.elements['fuel-bar'])
      this.elements['fuel-bar'].style.width = fuel + '%';

    if (this.elements['fuel-val'])
      this.elements['fuel-val'].textContent = Math.round(fuel) + '%';

    if (this.elements['fuel-bar']) {
      const bar = this.elements['fuel-bar'];
      if (fuel < 20) {
        bar.style.background = 'linear-gradient(90deg, #ff2200, #ff6600)';
      } else if (fuel < 50) {
        bar.style.background = 'linear-gradient(90deg, #ff8800, #ffcc00)';
      } else {
        bar.style.background = 'linear-gradient(90deg, #00cc44, #44ff88)';
      }
    }

    if (this.elements['money-val'])
      this.elements['money-val'].textContent = '$' + money.toFixed(2);

    if (this.elements['passengers-val'])
      this.elements['passengers-val'].textContent = passengers;

    if (this.elements['rating-val'] && state.satisfaction !== undefined) {
      this.elements['rating-val'].textContent = Math.round(state.satisfaction) + '%';
      this.elements['rating-val'].style.color = state.satisfaction > 80 ? 'var(--green)' : (state.satisfaction > 50 ? 'var(--accent)' : 'var(--red)');
    }

    if (this.elements['stop-name'])
      this.elements['stop-name'].textContent = currentStop || 'En Route';

    if (this.elements['fps-val'])
      this.elements['fps-val'].textContent = fps;

    if (this.elements['gear-val'])
      this.elements['gear-val'].textContent = gear;

    if (this.elements['weather-icon']) {
      const icons = { sunny: '☀️', rain: '🌧️', fog: '🌫️', night: '🌙' };
      this.elements['weather-icon'].textContent = icons[weather] || '☀️';
    }

    if (this.elements['pause-screen']) {
      this.elements['pause-screen'].style.display = paused ? 'flex' : 'none';
    }
  }

  showNotification(msg, type = 'info', duration = 3000) {
    const el = this.elements['notification'];
    if (!el) return;

    const colors = {
      info: '#2266ff',
      success: '#22cc44',
      warning: '#ff8800',
      danger: '#ff2200',
      earn: '#ffcc00'
    };

    el.textContent = msg;
    el.style.background = colors[type] || colors.info;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';

    clearTimeout(this._notifTimeout);
    this._notifTimeout = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-20px)';
    }, duration);
  }

  showStopIndicator(stopName, distance) {
    const el = this.elements['stop-indicator'];
    if (!el) return;
    if (distance < 80) {
      el.style.display = 'block';
      el.innerHTML = `🚏 <strong>${stopName}</strong><br><span>${Math.round(distance)}m ahead</span>`;
    } else {
      el.style.display = 'none';
    }
  }

  setRouteInfo(text) {
    if (this.elements['route-strip'])
      this.elements['route-strip'].textContent = text;
  }
}

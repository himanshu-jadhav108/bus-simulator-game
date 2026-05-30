// save.js - Browser localStorage save system

export class SaveSystem {
  constructor() {
    this.key = 'city_bus_sim_save_v1';
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return this._defaults();
  }

  _defaults() {
    return {
      money: 50.00,
      fuel: 100,
      totalPassengers: 0,
      totalDistance: 0,
      stopsVisited: [],
      busUpgrades: {
        engine: 0,
        fuel: 0,
        capacity: 0
      },
      highScore: 0,
      playTime: 0,
      lastPlayed: Date.now()
    };
  }

  save(state) {
    this.data = {
      ...this.data,
      money: state.money,
      fuel: state.fuel,
      totalPassengers: state.totalPassengers,
      totalDistance: state.totalDistance,
      stopsVisited: state.stopsVisited,
      lastPlayed: Date.now(),
      playTime: this.data.playTime + (state.sessionTime || 0)
    };
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Save failed', e);
    }
  }

  get(key) {
    return this.data[key];
  }

  addMoney(amount) {
    this.data.money = Math.max(0, (this.data.money || 0) + amount);
  }

  spendMoney(amount) {
    if (this.data.money >= amount) {
      this.data.money -= amount;
      return true;
    }
    return false;
  }

  reset() {
    this.data = this._defaults();
    try { localStorage.removeItem(this.key); } catch (e) {}
  }
}

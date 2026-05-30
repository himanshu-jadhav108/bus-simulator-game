// events.js - Lightweight Pub/Sub event system

class EventBus {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(data));
  }
}

export const events = new EventBus();

// Global events reference for easy typing
export const EVENTS = {
  STOP_REACHED: 'stop_reached',
  PASSENGER_BOARDED: 'passenger_boarded',
  PASSENGER_ALIGHTED: 'passenger_alighted',
  COLLISION: 'collision',
  FUEL_LOW: 'fuel_low',
  WEATHER_CHANGED: 'weather_changed',
  DOORS_TOGGLED: 'doors_toggled',
  BAD_DRIVING: 'bad_driving',
  SATISFACTION_CHANGED: 'satisfaction_changed'
};

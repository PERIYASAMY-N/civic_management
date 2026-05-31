import { API_ORIGIN } from '../api';

const listeners = new Map();
const registeredEventTypes = new Set();

let eventSource = null;
let connectedToken = null;

const getEventUrl = (token) => {
  const url = new URL(`${API_ORIGIN}/api/events`);

  if (token) {
    url.searchParams.set('token', token);
  }

  return url.toString();
};

const dispatchEvent = (eventName, payload) => {
  const callbacks = listeners.get(eventName);

  if (!callbacks) {
    return;
  }

  callbacks.forEach((callback) => callback(payload));
};

const registerEventType = (eventName) => {
  if (!eventSource || registeredEventTypes.has(eventName)) {
    return;
  }

  registeredEventTypes.add(eventName);
  eventSource.addEventListener(eventName, (event) => {
    try {
      dispatchEvent(eventName, JSON.parse(event.data));
    } catch {
      dispatchEvent(eventName, event.data);
    }
  });
};

const connect = () => {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return;
  }

  const token = localStorage.getItem('token') || '';

  if (eventSource && connectedToken === token && eventSource.readyState !== EventSource.CLOSED) {
    return;
  }

  if (eventSource) {
    eventSource.close();
  }

  connectedToken = token;
  registeredEventTypes.clear();
  eventSource = new EventSource(getEventUrl(token));
  listeners.forEach((_, eventName) => registerEventType(eventName));
};

const socket = {
  on(eventName, callback) {
    const callbacks = listeners.get(eventName) || new Set();
    callbacks.add(callback);
    listeners.set(eventName, callbacks);
    connect();
    registerEventType(eventName);
  },

  off(eventName, callback) {
    const callbacks = listeners.get(eventName);

    if (!callbacks) {
      return;
    }

    callbacks.delete(callback);

    if (!callbacks.size) {
      listeners.delete(eventName);
    }
  },

  reconnect() {
    connectedToken = null;
    connect();
  },

  disconnect() {
    if (eventSource) {
      eventSource.close();
    }

    eventSource = null;
    connectedToken = null;
    registeredEventTypes.clear();
  }
};

export default socket;

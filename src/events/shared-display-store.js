import { normalizeEventDisplayCalendars } from './event-display-calendars.js';

const RETRY_DELAY_MS = 30000;

function readAssignments(response) {
  const assignments = response?.assignments;
  if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) {
    throw new Error('Invalid shared calendar storage response');
  }
  return normalizeEventDisplayCalendars(assignments);
}

// HA owns the authoritative state. Local preferences are only a display cache.
export function createSharedDisplayStore(onState) {
  let connection;
  let unsubscribe;
  let generation = 0;
  let retryAfter = 0;
  let failedConnection;
  let latestState;
  let available = false;
  let serverEpoch;
  let serverRevision = -1;

  function receive(state, message, fromSave = false) {
    if (typeof message?.epoch === 'string' && Number.isSafeInteger(message.revision) && message.revision >= 0) {
      if (fromSave && serverEpoch !== undefined && serverEpoch !== message.epoch) return;
      if (serverEpoch === message.epoch && message.revision < serverRevision) return;
      serverEpoch = message.epoch;
      serverRevision = message.revision;
    }

    available = true;
    latestState = state;
    onState(state);
  }

  return {
    get state() { return latestState; },
    get available() { return available; },

    async connect(nextConnection) {
      if (!nextConnection?.subscribeMessage || connection === nextConnection) return;
      if (nextConnection === failedConnection && Date.now() < retryAfter) return;
      this.disconnect();
      connection = nextConnection;
      const current = generation;
      try {
        const stop = await connection.subscribeMessage(message => {
          if (current !== generation) return;
          let state;
          try {
            state = readAssignments(message);
          } catch {
            // Keep the last valid state when a subscription message is malformed.
            return;
          }
          receive(state, message);
        }, { type: 'family_calendar_card/subscribe' });
        if (current !== generation) {
          stop();
        } else {
          unsubscribe = stop;
          failedConnection = null;
          retryAfter = 0;
        }
      } catch {
        if (current === generation) {
          available = false;
          connection = null;
          failedConnection = nextConnection;
          retryAfter = Date.now() + RETRY_DELAY_MS;
        }
        // Missing companion integration does not prevent normal calendar rendering.
      }
    },

    disconnect() {
      available = false;
      generation += 1;
      serverEpoch = undefined;
      serverRevision = -1;
      const stop = unsubscribe;
      unsubscribe = null;
      connection = null;
      stop?.();
    },

    async save(hass, keys, calendars, managedCalendars) {
      if (!hass?.callWS || !keys.length) throw new Error('Shared calendar storage unavailable');
      const current = generation;
      const message = {type:'family_calendar_card/set', keys, calendars};
      if (managedCalendars !== undefined) message.managed_calendars = managedCalendars;
      const response = await hass.callWS(message);
      const state = readAssignments(response);
      // A completed save still belongs to the old connection after a reconnect.
      if (current === generation) receive(state, response, true);
      return state;
    }
  };
}

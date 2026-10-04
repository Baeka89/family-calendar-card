// Pure helpers for controlling a card from outside the card (window events)
// and for the optional idle reset. These helpers receive explicit inputs and
// never touch card instance state.

export const RESET_EVENT_NAME = 'family-calendar-card-reset';
export const SET_CALENDARS_EVENT_NAME = 'family-calendar-card-set-calendars';

export const RESET_PARTS = Object.freeze(['date', 'view', 'calendars']);
const RESET_PART_ALIASES = Object.freeze({ today: 'date' });

export const IDLE_RESET_MIN_MINUTES = 0.1;
export const IDLE_RESET_MAX_MINUTES = 1440;

// Returns a positive number of minutes, or null when the idle reset is off.
export function normalizeIdleResetMinutes(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.min(IDLE_RESET_MAX_MINUTES, Math.max(IDLE_RESET_MIN_MINUTES, minutes));
}

// `only` may be a string or an array of 'date' | 'today' | 'view' | 'calendars'.
// Missing or empty input selects every part; unknown names are ignored.
export function normalizeResetParts(only) {
  const requested = Array.isArray(only) ? only : (only === undefined || only === null ? [] : [only]);
  const names = requested
    .filter((part) => typeof part === 'string')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (requested.length === 0 || (typeof only === 'string' && only.trim() === '')) {
    return new Set(RESET_PARTS);
  }
  return new Set(names
    .map((part) => RESET_PART_ALIASES[part] || part)
    .filter((part) => RESET_PARTS.includes(part)));
}

// A request without preference_storage_key addresses every card on the page.
export function matchesExternalControlTarget(detail, config = {}) {
  const target = typeof detail?.preference_storage_key === 'string' ? detail.preference_storage_key.trim() : '';
  if (!target) return true;
  return target === config?.preference_storage_key;
}

// Resolves 'all', a single id, or a list of ids (calendar entities or
// `virtual:<id>` badges) to configured calendar entity ids.
export function resolveCalendarSelection(value, { knownEntities = [], getVirtualBadgeEntities = () => [] } = {}) {
  const known = new Set(knownEntities);
  if (typeof value === 'string' && value.trim().toLowerCase() === 'all') {
    return Array.from(known);
  }

  const ids = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
  const resolved = new Set();
  ids.forEach((rawId) => {
    if (typeof rawId !== 'string') return;
    const id = rawId.trim();
    if (!id) return;
    const entities = id.startsWith('virtual:') ? getVirtualBadgeEntities(id.slice('virtual:'.length)) : [id];
    (entities || []).forEach((entityId) => {
      if (known.has(entityId)) resolved.add(entityId);
    });
  });
  return Array.from(resolved);
}

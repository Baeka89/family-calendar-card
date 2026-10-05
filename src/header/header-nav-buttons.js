import { normalizeDashboardPath } from '../utils/normalization-utils.js';

export const MAX_HEADER_NAV_BUTTONS = 4;
const CALENDAR_COLOR_PREFIX = 'calendar:';
const VIRTUAL_CALENDAR_COLOR_PREFIX = 'virtual:';
const TAP_ACTION_TYPES = ['navigate', 'url', 'call-service', 'fire-dom-event'];

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizePlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

// Accepts either an already-parsed plain object (YAML-authored configs) or a
// JSON string (what the visual editor's textarea stores while the person is
// still typing, so their in-progress text is never silently overwritten).
// Invalid JSON normalizes to {} rather than throwing.
function normalizeActionDataObject(value) {
  const plain = normalizePlainObject(value);
  if (plain) return plain;
  if (typeof value !== 'string') return {};
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    return normalizePlainObject(JSON.parse(trimmed)) || {};
  } catch {
    return {};
  }
}

// The raw, unresolved color value as stored in config: null, "calendar:<id>",
// or a literal CSS color. See resolveHeaderButtonColor() below for what each
// shape means once it is actually turned into a color at render time.
export function normalizeHeaderButtonColor(rawColor) {
  if (rawColor && typeof rawColor === 'object' && !Array.isArray(rawColor)) {
    if (rawColor.mode !== 'gradient') return null;
    const calendars = Array.isArray(rawColor.calendars)
      ? [...new Set(rawColor.calendars.filter(value => typeof value === 'string')
        .map(value => value.trim()).filter(value => /^calendar\.[\w]+$/.test(value) || /^virtual:[\w-]+$/.test(value)))]
      : [];
    return { mode: 'gradient', calendars };
  }
  return normalizeOptionalString(rawColor);
}

// A header button's `tap_action` follows the same shape Home Assistant uses
// everywhere else for tap actions (tile card, button card, ...), and reuses
// the exact field names this project's own day_badges `tap_action` already
// uses for fire-dom-event (`event_type` / `event_data`):
//   - { action: 'navigate', navigation_path: '/lovelace/kids' }
//   - { action: 'url', url_path: 'https://example.com' }
//   - { action: 'call-service', service: 'browser_mod.popup', service_data: {...} }
//   - { action: 'fire-dom-event', event_type: '...', event_data: {...} }
// Anything else (missing/invalid) normalizes to null, so callers fall back
// to the plain `path` field (a bare dashboard-navigation shorthand).
export function normalizeHeaderButtonTapAction(rawTapAction) {
  const raw = normalizePlainObject(rawTapAction);
  if (!raw) return null;
  const action = typeof raw.action === 'string' ? raw.action.trim().toLowerCase() : '';
  if (!TAP_ACTION_TYPES.includes(action)) return null;

  if (action === 'navigate') {
    const navigation_path = normalizeDashboardPath(raw.navigation_path);
    return navigation_path ? { action: 'navigate', navigation_path } : null;
  }

  if (action === 'url') {
    const url_path = normalizeOptionalString(raw.url_path);
    return url_path ? { action: 'url', url_path } : null;
  }

  if (action === 'call-service') {
    const service = normalizeOptionalString(raw.service);
    if (!service || !service.includes('.')) return null;
    return { action: 'call-service', service, service_data: normalizeActionDataObject(raw.service_data) };
  }

  const event_type = normalizeOptionalString(raw.event_type);
  if (!event_type) return null;
  return { action: 'fire-dom-event', event_type, event_data: normalizeActionDataObject(raw.event_data) };
}

// Same shape/behavior as the built-in dashboard ("Home") button, just repeated
// up to MAX_HEADER_NAV_BUTTONS times: an icon (mdi:...) or a text label, and
// either a dashboard `path` (shorthand for navigate) or a richer `tap_action`
// (url / call-service / fire-dom-event). Entries missing a destination
// (neither path nor tap_action), or missing both an icon and a label, are
// dropped since they would render as a dead button.
export function normalizeHeaderNavButtons(rawButtons) {
  if (!Array.isArray(rawButtons)) return [];

  return rawButtons
    .filter((button) => button && typeof button === 'object' && !Array.isArray(button))
    .map((button) => ({
      icon: normalizeOptionalString(button.icon),
      label: normalizeOptionalString(button.label ?? button.text),
      path: normalizeDashboardPath(button.path),
      color: normalizeHeaderButtonColor(button.color),
      tap_action: normalizeHeaderButtonTapAction(button.tap_action)
    }))
    .filter((button) => (button.path || button.tap_action) && (button.icon || button.label))
    .slice(0, MAX_HEADER_NAV_BUTTONS);
}

// Performs a header button's destination: `tapAction` (if valid) takes
// priority over the plain `path` shorthand. All side effects go through the
// injected context callbacks so this stays a pure, testable function.
export function activateHeaderButtonTarget({ path, tapAction } = {}, context = {}) {
  const { navigateToDashboardPath, callService, openUrl, dispatchDomEvent } = context;

  if (tapAction) {
    switch (tapAction.action) {
      case 'navigate':
        navigateToDashboardPath?.(tapAction.navigation_path);
        return;
      case 'url':
        openUrl?.(tapAction.url_path);
        return;
      case 'call-service': {
        const dotIndex = tapAction.service.indexOf('.');
        const domain = tapAction.service.slice(0, dotIndex);
        const service = tapAction.service.slice(dotIndex + 1);
        callService?.(domain, service, tapAction.service_data || {});
        return;
      }
      case 'fire-dom-event':
        dispatchDomEvent?.(tapAction.event_type, tapAction.event_data || {});
        return;
      default:
        return;
    }
  }

  if (path) navigateToDashboardPath?.(path);
}

// A header button's `color` (the Home button's `header_dashboard_button_color`,
// or one entry in `header_nav_buttons`) accepts three shapes:
//   - unset / empty            -> null, so the button keeps its default look
//   - "calendar:<entity_id>"   -> matches a configured calendar's own color
//   - "calendar:virtual:<id>"  -> matches a virtual calendar badge's own color
//   - anything else            -> a literal, freely chosen CSS color
// Resolution needs the card's live calendar-color lookup, so this stays a
// separate function from the pure normalizer above rather than folding into it.
export function resolveHeaderButtonColor(rawColor, {
  entities = [],
  getCalendarColor,
  getVirtualBadgeById,
  normalizeSingleColor = (value) => value
} = {}) {
  const raw = normalizeOptionalString(rawColor);
  if (!raw) return null;

  if (raw.toLowerCase().startsWith(CALENDAR_COLOR_PREFIX)) {
    const target = raw.slice(CALENDAR_COLOR_PREFIX.length).trim();
    if (!target) return null;

    if (target.startsWith(VIRTUAL_CALENDAR_COLOR_PREFIX)) {
      const virtualId = target.slice(VIRTUAL_CALENDAR_COLOR_PREFIX.length);
      const badge = getVirtualBadgeById?.(virtualId);
      if (!badge) return null;
      if (badge.color) return normalizeSingleColor(badge.color);
      const firstEntity = badge.entities?.[0];
      if (!firstEntity || typeof getCalendarColor !== 'function') return null;
      const index = entities.indexOf(firstEntity);
      return index === -1 ? null : getCalendarColor(firstEntity, index);
    }

    if (typeof getCalendarColor !== 'function') return null;
    const index = entities.indexOf(target);
    return index === -1 ? null : getCalendarColor(target, index);
  }

  return normalizeSingleColor(raw) || null;
}

// Resolve each stop through the same live lookup used by single-calendar buttons.
// Unknown/deleted calendars are omitted; callers fall back to the default style.
export function resolveHeaderButtonGradientColors(rawColor, context = {}) {
  const config = normalizeHeaderButtonColor(rawColor);
  if (!config || typeof config !== 'object') return [];
  return config.calendars.map(target => resolveHeaderButtonColor(`calendar:${target}`, context)).filter(Boolean);
}

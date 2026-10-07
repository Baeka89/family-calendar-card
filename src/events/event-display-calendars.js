import { getCustomEventColorKeys, getOccurrenceStartToken } from './custom-event-colors.js';

export function normalizeEventDisplayCalendars(value) {
  const result = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  Object.entries(value).forEach(([key, calendars]) => {
    if (!key || !Array.isArray(calendars)) return;
    const ids = [...new Set(calendars.filter(id => typeof id === 'string' && /^calendar\.[\w]+$/.test(id)))];
    if (ids.length) Object.defineProperty(result, key, {value:ids, enumerable:true, configurable:true, writable:true});
  });
  return result;
}

export function getEventDisplayKeys(event, context) {
  const original = event?.displayOriginalEvent || event;
  const sources = original?.sourceEvents?.length ? original.sourceEvents : [original];
  return [...new Set(sources.map(source => {
    const key = getCustomEventColorKeys(source, context)?.occurrenceKey;
    const start = getOccurrenceStartToken(source);
    // Some integrations expand series without returning recurrence metadata.
    // Include the occurrence start even when the UID appears non-recurring.
    return key && start ? JSON.stringify([key, start]) : null;
  }).filter(Boolean))];
}

export function getAssignedDisplayCalendars(event, state, context) {
  return [...new Set(getEventDisplayKeys(event, context).flatMap(key => state?.[key] || []))];
}

export function applyEventDisplayCalendars(event, state, {entities = [], getCalendarColor, ...context} = {}) {
  const original = event?.displayOriginalEvent || event;
  const selected = getAssignedDisplayCalendars(original, state, context).filter(id => entities.includes(id));
  if (!selected.length) return original;
  const sources = original.sourceEvents?.length ? original.sourceEvents : [original];
  const calendars = new Map((original.sourceCalendars || [{entityId:original.entityId,color:original.color}]).map(item => [item.entityId,item]));
  selected.forEach(entityId => {
    if (!calendars.has(entityId)) calendars.set(entityId, {entityId,color:getCalendarColor(entityId,entities.indexOf(entityId))});
  });
  return {...original, isCombinedCalendarEvent:true, isSyntheticFamilyEvent:true, isDisplayAssignedEvent:true,
    displayOriginalEvent:original, sourceCalendars:[...calendars.values()],
    sourceEntityIds:[...new Set(sources.map(source=>source.entityId))], sourceEvents:sources};
}

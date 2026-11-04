export const FAMILY_CALENDAR_CARD_VERSION = 'v0.1.7';

export function getFamilyCalendarCardVersion() {
  return FAMILY_CALENDAR_CARD_VERSION.includes('__')
    ? 'dev'
    : FAMILY_CALENDAR_CARD_VERSION;
}

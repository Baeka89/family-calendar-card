export const FAMILY_CALENDAR_CARD_VERSION = 'dev';

export function getFamilyCalendarCardVersion() {
  return FAMILY_CALENDAR_CARD_VERSION.includes('__')
    ? 'dev'
    : FAMILY_CALENDAR_CARD_VERSION;
}

import { escapeHtmlAttribute } from '../utils/string-utils.js';
import {
  COMBINE_BACKGROUND_MODE_OPTIONS,
  createDefaultStubConfig,
  DAY_BADGE_LAYOUT_WEEK_OPTIONS,
  DEFAULT_COMBINE_BACKGROUND,
  DEFAULT_DAY_BADGE_LAYOUT_WEEK,
  DEFAULT_EVENT_COLOR_BAR_WIDTH,
  DEFAULT_EVENT_MODAL_SIZE,
  DEFAULT_EVENT_NEUTRAL_BACKGROUND,
  DEFAULT_EVENT_TINT_OPACITY,
  DEFAULT_LANGUAGE,
  DEFAULT_PAST_EVENT_MODE,
  DEFAULT_THEME_MODE,
  DEFAULT_VIEW,
  EVENT_MODAL_SIZE_OPTIONS,
  PAST_EVENT_MODE_OPTIONS,
  THEME_MODE_OPTIONS
} from '../defaults.js';
import {
  getEditorDefaultValue as getEditorDefaultValueFromSchema,
  getEventCalendarBubbleMode as getEventCalendarBubbleModeFromConfig,
  normalizeDefaultViewForEditor as normalizeDefaultViewForEditorValue
} from './editor-schema.js';
import {
  renderEditorColorInputControl,
  renderEditorSection,
  renderEditorSubSection,
  renderEditorWeekdayCheckboxes
} from '../renderers/editor-renderer.js';
import { getEntityFriendlyName as getEntityFriendlyNameHelper } from '../ha/ha-state-helpers.js';
import { EDITOR_TRANSLATION_LOCALES, EDITOR_TRANSLATION_ROWS } from './editor-translations.js';
import { MAX_HEADER_NAV_BUTTONS } from '../header/header-nav-buttons.js';
import { getFamilyCalendarCardVersion } from '../version.js';
import { clearAllEventCacheSnapshots } from '../events/event-cache.js';
import { normalizeDashboardPath, normalizeEnumValue } from '../utils/normalization-utils.js';
import { detectStaleFamilyCalendarResource, STALE_RESOURCE_TROUBLESHOOTING_URL } from '../utils/stale-resource-utils.js';
import '../components/family-color-picker.js';
import {
  DEFAULT_ICON_POSITION,
  appendIconRule,
  countOtherRules,
  isCompleteIconFields,
  listIconRules,
  moveIconRule,
  parseIconRule,
  removeRuleAt,
  replaceIconRule
} from '../rules/icon-rules.js';

function normalizeDefaultDarkMode(value) {
  if (value === true) return 'dark';
  if (value === false || value === undefined || value === null || value === '') return DEFAULT_THEME_MODE;

  return normalizeEnumValue(value, {
    allowed: THEME_MODE_OPTIONS,
    fallback: DEFAULT_THEME_MODE
  });
}

function normalizePastEventMode(value) {
  return normalizeEnumValue(value, {
    allowed: PAST_EVENT_MODE_OPTIONS,
    fallback: DEFAULT_PAST_EVENT_MODE
  });
}

function normalizeDayBadgeLayoutWeek(value) {
  return normalizeEnumValue(value, {
    allowed: DAY_BADGE_LAYOUT_WEEK_OPTIONS,
    fallback: DEFAULT_DAY_BADGE_LAYOUT_WEEK
  });
}

function normalizeEventModalSize(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return EVENT_MODAL_SIZE_OPTIONS.includes(normalized) ? normalized : DEFAULT_EVENT_MODAL_SIZE;
}

function getDefaultColor(index) {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
  return colors[index % colors.length];
}

export class FamilyCalendarCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = createDefaultStubConfig();
    this._hass = null;
    this._rendered = false;
    this._eventCacheFlushStatus = '';
    this._lastCalendarEntitiesKey = '';
    this._colorPickerState = { field: null, mapKey: null, color: '#3f51b5' };
    this._combineBackgroundMode = DEFAULT_COMBINE_BACKGROUND;
    this._combineBackgroundHexDraft = '';
    this._openDisclosureKeys = new Set();
    this._dashboardOptions = [];
    // Icon-rule rows that are not complete yet (no keyword or no icon). They live only
    // here, never in the config: a rule with an empty keyword would match every event.
    this._eventIconDrafts = [];
    this._familyRuleDraftCount = 1;
    this._editorLanguage = null;
  }

  getEditorLanguage() {
    return String(this._hass?.locale?.language || this._hass?.language || this._config?.locale || this._config?.language || DEFAULT_LANGUAGE).trim().toLowerCase().split(/[-_]/)[0];
  }

  translateEditorLiteral(source, params = {}) {
    const localeIndex = EDITOR_TRANSLATION_LOCALES.indexOf(this.getEditorLanguage());
    const row = EDITOR_TRANSLATION_ROWS.find((entry) => Array.isArray(entry) && entry[0] === source);
    return (localeIndex > 0 ? row?.[localeIndex] || source : source).replace(/\{(\w+)\}/g, (_, key) => params[key] ?? '');
  }

  localizeEditorMarkup() {
    this._editorLanguage = this.getEditorLanguage();
    const localeIndex = EDITOR_TRANSLATION_LOCALES.indexOf(this.getEditorLanguage());
    if (localeIndex <= 0) return;
    const dictionary = new Map(EDITOR_TRANSLATION_ROWS.filter(Array.isArray).map((row) => [row[0], row[localeIndex]]));
    const walker = document.createTreeWalker(this, globalThis.NodeFilter?.SHOW_TEXT ?? 4);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement?.closest('style, script, textarea, input, [data-user-label]')) continue;
      const value = node.nodeValue || '';
      const leading = value.match(/^\s*/)?.[0] || '';
      const trailing = value.match(/\s*$/)?.[0] || '';
      const text = value.slice(leading.length, value.length - trailing.length || undefined);
      if (dictionary.has(text)) node.nodeValue = `${leading}${dictionary.get(text)}${trailing}`;
    }
    for (const element of this.querySelectorAll('[placeholder], [title], [aria-label]')) {
      for (const attribute of ['placeholder', 'title', 'aria-label']) {
        const value = element.getAttribute(attribute);
        if (value && dictionary.has(value)) element.setAttribute(attribute, dictionary.get(value));
      }
    }
  }

  normalizeHexColor(colorValue) {
    const normalizedColor = String(colorValue || '').trim();
    if (!normalizedColor) return null;

    const hex3Match = normalizedColor.match(/^#([\da-fA-F]{3})$/);
    if (hex3Match) {
      const [r, g, b] = hex3Match[1].split('');
      return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }

    const hex6Match = normalizedColor.match(/^#([\da-fA-F]{6})$/);
    if (hex6Match) {
      return `#${hex6Match[1].toUpperCase()}`;
    }

    return null;
  }

  normalizeBackgroundOpacity(opacityValue, fallback = 0) {
    const numericOpacity = Number(opacityValue);
    if (!Number.isFinite(numericOpacity)) {
      return fallback;
    }

    return Math.min(100, Math.max(0, numericOpacity));
  }

  syncCombineBackgroundEditorState(backgroundValue) {
    const rawValue = String(backgroundValue || '').trim();
    const normalizedLower = rawValue.toLowerCase();
    if (COMBINE_BACKGROUND_MODE_OPTIONS.includes(normalizedLower)) {
      this._combineBackgroundMode = normalizedLower;
      this._combineBackgroundHexDraft = '';
      return;
    }

    const normalizedHex = this.normalizeHexColor(rawValue);
    if (normalizedHex) {
      this._combineBackgroundMode = 'hex';
      this._combineBackgroundHexDraft = normalizedHex;
      return;
    }

    this._combineBackgroundMode = DEFAULT_COMBINE_BACKGROUND;
    this._combineBackgroundHexDraft = '';
  }

  setConfig(config) {
    const previousEditorLanguage = this.getEditorLanguage();
    const previousEntities = Array.isArray(this._config?.entities) ? this._config.entities : [];
    const getActiveFamilyRuleCount = (rules) => Array.isArray(rules) ? rules.filter((rule) => String(rule?.tag || '').trim()).length : 0;
    const previousFamilyRuleCount = getActiveFamilyRuleCount(this._config?.family_event_rules);
    const previousCombineCalendars = !!this._config?.combine_calendars;
    const previousWeekNumberPrefixMode = this.getWeekNumberPrefixMode();
    const previousWeekNumberPrefix = this._config?.week_number_prefix;
    const normalizedDefaultView = config.default_view === 'week'
      ? 'week-compact'
      : config.default_view === 'schedule'
        ? 'week-standard'
        : config.default_view;
    const normalizedPastEventMode = config.past_event_mode !== undefined && config.past_event_mode !== null && config.past_event_mode !== ''
      ? normalizePastEventMode(config.past_event_mode)
      : (config.hide_the_past ? 'hide' : createDefaultStubConfig().past_event_mode);

    this._config = {
      ...createDefaultStubConfig(),
      ...config,
      default_view: normalizedDefaultView || (createDefaultStubConfig().default_view || DEFAULT_VIEW),
      past_event_mode: normalizedPastEventMode,
      color_scheme: normalizeDefaultDarkMode(config.color_scheme),
      header_dashboard_path: normalizeDashboardPath(config.header_dashboard_path),
      event_modal_size: normalizeEventModalSize(config.event_modal_size),
      day_badge_layout_week: normalizeDayBadgeLayoutWeek(config.day_badge_layout_week)
    };
    this.syncCombineBackgroundEditorState(this._config.combine_background);

    if (!this._rendered || previousEditorLanguage !== this.getEditorLanguage()) {
      this.render();
      return;
    }

    const nextEntities = Array.isArray(this._config.entities) ? this._config.entities : [];
    const entitiesChanged = previousEntities.join('|') !== nextEntities.join('|');
    const familyRuleCountChanged = previousFamilyRuleCount !== getActiveFamilyRuleCount(this._config.family_event_rules);
    const combineCalendarsChanged = previousCombineCalendars !== !!this._config.combine_calendars;
    const nextWeekNumberPrefixMode = this.getWeekNumberPrefixMode();
    const weekNumberPrefixChanged = previousWeekNumberPrefixMode !== nextWeekNumberPrefixMode || (
      nextWeekNumberPrefixMode === 'custom' && previousWeekNumberPrefix !== this._config.week_number_prefix
    );

    if (entitiesChanged || familyRuleCountChanged || combineCalendarsChanged || weekNumberPrefixChanged) {
      this.render();
      return;
    }

    this.updateFieldValues();
  }

  set hass(hass) {
    const previousLanguage = this._editorLanguage;
    this._hass = hass;
    this._dashboardOptions = this.getDashboardOptionsForEditor();

    if (!this._rendered || (previousLanguage && previousLanguage !== this.getEditorLanguage())) {
      this.render();
      return;
    }

    this.refreshCalendarEntities();
    const weekdayColorSwatch = this.querySelector('[data-color-field="week_compact_weekday_color"]');
    weekdayColorSwatch?.style.setProperty('--selected-color', this.getWeekCompactWeekdayColorPreview());
  }

  get value() {
    return this._config || createDefaultStubConfig();
  }

  getCalendarEntities() {
    return Object.keys(this._hass?.states || {})
      .filter((entityId) => entityId.startsWith('calendar.'))
      .sort();
  }

  escapeHtml(text) {
    return escapeHtmlAttribute(text);
  }

  normalizeDefaultViewForEditor(value) {
    return normalizeDefaultViewForEditorValue(value);
  }

  getEventCalendarBubbleMode() {
    return getEventCalendarBubbleModeFromConfig(this._config);
  }

  getWeekNumberPrefixMode() {
    const prefix = this._config?.week_number_prefix;
    if (prefix == null) return 'default';
    if (prefix === '') return 'number_only';
    return typeof prefix === 'string' ? 'custom' : 'default';
  }

  getMapFieldValue(key) {
    const value = this._config[key];
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  getListFieldValue(key) {
    const value = this._config[key];
    return Array.isArray(value) ? value : [];
  }

  getListInputValue(key) {
    return this.getListFieldValue(key).join(', ');
  }

  getEditorDefaultValue(key) {
    return getEditorDefaultValueFromSchema(key);
  }

  getConfiguredEntitiesForEditor() {
    const entities = Array.isArray(this._config.entities) ? this._config.entities : [];
    return entities.filter((entityId) => typeof entityId === 'string' && entityId.startsWith('calendar.'));
  }

  getEntityFriendlyName(entityId) {
    return getEntityFriendlyNameHelper(this._hass, entityId);
  }

  getConfiguredEntityIndex(entityId) {
    return this.getConfiguredEntitiesForEditor().indexOf(entityId);
  }

  getEditorCalendarColor(entityId) {
    const entityIndex = this.getConfiguredEntityIndex(entityId);
    return this.normalizeHexColor(this.getMapFieldValue('colors')[entityId]) ||
      getDefaultColor(Math.max(entityIndex, 0));
  }

  getContrastingEditorColor(backgroundColor) {
    const hex = this.normalizeHexColor(backgroundColor);
    if (!hex) return '#FFFFFF';

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#000000' : '#FFFFFF';
  }

  getEditorEventFontColor(entityId) {
    return this.normalizeHexColor(this.getMapFieldValue('event_font_colors')[entityId]) ||
      this.getContrastingEditorColor(this.getEditorCalendarColor(entityId));
  }

  getVirtualCalendarsForEditor() {
    return Array.isArray(this._config.virtual_calendars) ? this._config.virtual_calendars : [];
  }

  getHeaderNavButtonsForEditor() {
    return Array.isArray(this._config.header_nav_buttons) ? this._config.header_nav_buttons : [];
  }

  getRenderableHeaderNavButtonsForEditor() {
    return this.getHeaderNavButtonsForEditor()
      .map((button, index) => ({ button, index }))
      .filter(({ button }) => button && typeof button === 'object' && !Array.isArray(button));
  }

  getRenderableVirtualCalendarsForEditor() {
    return this.getVirtualCalendarsForEditor()
      .map((virtualCalendar, index) => ({ virtualCalendar, index }))
      .filter(({ virtualCalendar }) => virtualCalendar && typeof virtualCalendar === 'object' && !Array.isArray(virtualCalendar));
  }

  getNextVirtualCalendarId() {
    const existingIds = new Set(this.getVirtualCalendarsForEditor()
      .filter((virtualCalendar) => virtualCalendar && typeof virtualCalendar === 'object')
      .map((virtualCalendar) => String(virtualCalendar.id || '').trim())
      .filter(Boolean));
    let index = 1;
    let candidate = `virtual_${index}`;
    while (existingIds.has(candidate)) {
      index += 1;
      candidate = `virtual_${index}`;
    }
    return candidate;
  }

  sanitizeVirtualCalendarForEditor(virtualCalendar) {
    const nextVirtualCalendar = {
      ...(virtualCalendar && typeof virtualCalendar === 'object' ? virtualCalendar : {})
    };

    nextVirtualCalendar.id = String(nextVirtualCalendar.id || '').trim();
    nextVirtualCalendar.name = String(nextVirtualCalendar.name || '').trim();

    const icon = String(nextVirtualCalendar.icon || '').trim();
    if (icon) nextVirtualCalendar.icon = icon;
    else nextVirtualCalendar.icon = null;

    const color = String(nextVirtualCalendar.color || '').trim();
    if (color) nextVirtualCalendar.color = color;
    else nextVirtualCalendar.color = null;

    nextVirtualCalendar.entities = Array.isArray(nextVirtualCalendar.entities)
      ? nextVirtualCalendar.entities.filter((entityId) => typeof entityId === 'string' && entityId.startsWith('calendar.'))
      : [];

    return nextVirtualCalendar;
  }

  getVirtualCalendarIdValidation(index) {
    const virtualCalendars = this.getVirtualCalendarsForEditor();
    const virtualCalendar = virtualCalendars[index];
    if (!virtualCalendar || typeof virtualCalendar !== 'object') return '';

    const id = String(virtualCalendar.id || '').trim();
    if (!id) return 'ID is required for runtime matching.';

    const duplicateIndex = virtualCalendars.findIndex((otherVirtualCalendar, otherIndex) => (
      otherIndex !== index &&
      otherVirtualCalendar &&
      typeof otherVirtualCalendar === 'object' &&
      String(otherVirtualCalendar.id || '').trim() === id
    ));

    return duplicateIndex === -1 ? '' : 'ID duplicates another virtual calendar.';
  }

  getEditorVirtualCalendarColor(index) {
    const virtualCalendar = this.getVirtualCalendarsForEditor()[index];
    return this.toColorInputValue(virtualCalendar?.color);
  }

  getEditorMapColorValue(field, entityId) {
    if (field === 'colors') {
      return this.getEditorCalendarColor(entityId);
    }

    if (field === 'event_font_colors') {
      return this.getEditorEventFontColor(entityId);
    }

    return this.toColorInputValue(this.getMapFieldValue(field)[entityId]);
  }

  getDashboardOptionsForEditor() {
    const panels = this._hass?.panels || {};
    const dashboards = Object.values(panels)
      .filter((panel) => panel?.component_name === 'lovelace' && typeof panel.url_path === 'string' && panel.url_path.trim())
      .map((panel) => {
        const path = panel.url_path.startsWith('/') ? panel.url_path : `/${panel.url_path}`;
        const title = panel.title || panel.config?.title || panel.url_path;
        return { path, title };
      });

    const uniqueByPath = new Map();
    dashboards.forEach((dashboard) => {
      uniqueByPath.set(dashboard.path, dashboard);
    });

    const configuredPath = normalizeDashboardPath(this._config.header_dashboard_path);
    if (configuredPath && !uniqueByPath.has(configuredPath)) {
      uniqueByPath.set(configuredPath, { path: configuredPath, title: configuredPath });
    }

    this.getHeaderNavButtonsForEditor().forEach((button) => {
      const buttonPath = normalizeDashboardPath(button?.path);
      if (buttonPath && !uniqueByPath.has(buttonPath)) {
        uniqueByPath.set(buttonPath, { path: buttonPath, title: buttonPath });
      }
    });

    return Array.from(uniqueByPath.values())
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  }

  toColorInputValue(value, fallback = '#3f51b5') {
    const normalized = String(value || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      return normalized;
    }
    return fallback;
  }

  getColorValue(field, mapKey = null) {
    if (field === 'virtual_calendar_color') {
      return this.getEditorVirtualCalendarColor(Number(mapKey));
    }
    if (field === 'header_button_color') {
      return this.getEditorHeaderButtonColor(mapKey);
    }
    if (field === 'event_icon_color') {
      return this.toColorInputValue(this.getEventIconFieldsForKey(mapKey)?.color);
    }
    if (field === 'week_compact_weekday_color') {
      return this.getWeekCompactWeekdayColorPreview();
    }
    if (mapKey) {
      return this.getEditorMapColorValue(field, mapKey);
    }
    return this.toColorInputValue(this._config[field]);
  }

  emitConfigChanged(nextConfig) {
    this._config = nextConfig;
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: nextConfig },
        bubbles: true,
        composed: true
      })
    );
  }

  openColorPicker(field, mapKey = null) {
    const initialColor = this.getColorValue(field, mapKey);
    this._colorPickerState = { field, mapKey, color: initialColor };
    const dialog = this.querySelector('.color-picker-dialog');
    const picker = this.querySelector('family-color-picker');
    if (picker) picker.value = initialColor;
    if (dialog) dialog.classList.add('show');
  }

  closeColorPicker() {
    const dialog = this.querySelector('.color-picker-dialog');
    if (dialog) dialog.classList.remove('show');
  }

  applyColorPickerColor(hexColor = null) {
    const { field, mapKey } = this._colorPickerState;
    const picker = this.querySelector('family-color-picker');
    const selectedColor = hexColor || picker?.value || this._colorPickerState.color;
    if (!field || !selectedColor) return;

    if (field === 'virtual_calendar_color') {
      this.updateVirtualCalendar(Number(mapKey), { color: selectedColor }, { render: true });
      this.closeColorPicker();
      return;
    }

    if (field === 'header_button_color') {
      this.setHeaderButtonColor(mapKey, selectedColor, { render: true });
      this.closeColorPicker();
      return;
    }

    if (field === 'event_icon_color') {
      this.closeColorPicker();
      this.applyEventIconPatch(mapKey, { color: selectedColor });
      return;
    }

    const nextConfig = { ...this.value };
    if (mapKey) {
      nextConfig[field] = {
        ...this.getMapFieldValue(field),
        [mapKey]: selectedColor
      };
    } else {
      nextConfig[field] = selectedColor;
    }

    this.emitConfigChanged(nextConfig);
    this.updateFieldValues();
    this.closeColorPicker();
  }

  renderColorPickerDialog() {
    return `
      <div class="color-picker-dialog">
        <div class="color-picker-overlay" data-close-color-picker="true"></div>
        <div class="color-picker-modal" role="dialog" aria-label="Select color">
          <family-color-picker title="${this.translateEditorLiteral('Select color')}" confirm-label="${this.translateEditorLiteral('Set')}" cancel-label="${this.translateEditorLiteral('Cancel')}"></family-color-picker>
        </div>
      </div>
    `;
  }

  renderColorInputControl({ id, field, mapKey = null, value }) {
    return renderEditorColorInputControl({
      id,
      field,
      mapKey,
      value,
      toColorInputValue: (colorValue) => this.toColorInputValue(colorValue)
    });
  }

  getWeekCompactWeekdayColorPreview() {
    if (this._config.week_compact_weekday_color) return this._config.week_compact_weekday_color;
    const darkMode = this._config.color_scheme === 'dark'
      || (this._config.color_scheme === DEFAULT_THEME_MODE && this._hass?.themes?.darkMode === true);
    return darkMode ? '#dde3ea' : '#6b7280';
  }

  renderMapRowInputs(mapKey, { label, inputType = 'text', placeholder = '' } = {}) {
    const mapValue = this.getMapFieldValue(mapKey);
    const entities = this.getConfiguredEntitiesForEditor();

    if (!entities.length) {
      return `<p class="helper">Select at least one calendar to configure ${label || mapKey}.</p>`;
    }

    return entities
      .map((entityId) => {
        const displayName = this.escapeHtml(this.getEntityFriendlyName(entityId));
        const value = inputType === 'color' ? this.getEditorMapColorValue(mapKey, entityId) : (mapValue[entityId] || '');
        if (inputType === 'color') {
          return `
            <div class="map-row">
              <label class="map-label" for="${mapKey}-${entityId}">${displayName}</label>
              ${this.renderColorInputControl({ id: `${mapKey}-${entityId}`, field: mapKey, mapKey: entityId, value })}
            </div>
          `;
        }

        return `
          <div class="map-row">
            <label class="map-label" for="${mapKey}-${entityId}">${displayName}</label>
            <input id="${mapKey}-${entityId}" type="text" data-map-field="${mapKey}" data-map-key="${entityId}" value="${this.escapeHtml(value)}" placeholder="${placeholder}">
          </div>
        `;
      })
      .join('');
  }

  renderCalendarListCheckboxes(field, { label }) {
    const entities = this.getConfiguredEntitiesForEditor();
    const selectedValues = new Set(this.getListFieldValue(field));

    if (!entities.length) {
      return `<p class="helper">Select at least one calendar to configure ${label || field}.</p>`;
    }

    return entities
      .map((entityId) => {
        const displayName = this.escapeHtml(this.getEntityFriendlyName(entityId));
        const checked = selectedValues.has(entityId) ? 'checked' : '';
        return `
          <label class="list-checkbox-row">
            <span>${displayName}</span>
            <input type="checkbox" data-list-field="${field}" value="${entityId}" ${checked}>
          </label>
        `;
      })
      .join('');
  }

  buildDisclosureKey(scope, title) {
    return `${scope}:${title}`;
  }

  captureOpenDisclosures() {
    const openKeys = new Set();
    this.querySelectorAll('details[data-disclosure-key][open]').forEach((detail) => {
      const key = detail.dataset.disclosureKey;
      if (key) openKeys.add(key);
    });
    this._openDisclosureKeys = openKeys;
  }

  renderSection(title, content) {
    const disclosureKey = this.buildDisclosureKey('section', title);
    return renderEditorSection({
      title,
      content,
      disclosureKey,
      open: this._openDisclosureKeys.has(disclosureKey)
    });
  }

  renderSubSection(title, content) {
    const disclosureKey = this.buildDisclosureKey('subsection', title);
    return renderEditorSubSection({
      title,
      content,
      disclosureKey,
      open: this._openDisclosureKeys.has(disclosureKey)
    });
  }

  getEventStylesForEditor() {
    return Array.isArray(this._config.event_styles) ? this._config.event_styles : [];
  }

  getEventIconFieldsForKey(rowKey) {
    const kind = rowKey[0];
    const index = Number(rowKey.slice(1));
    if (kind === 'd') return this._eventIconDrafts[index] || null;
    return parseIconRule(this.getEventStylesForEditor()[index]);
  }

  emitEventStyles(eventStyles) {
    this.emitConfigChanged({ ...this.value, event_styles: eventStyles });
  }

  // Applies an edit to one icon row. Rows only reach event_styles once they are
  // complete (keyword + icon); a committed row edited into an incomplete state
  // moves back to a draft, so the card never sees a match-everything rule.
  applyEventIconPatch(rowKey, patch) {
    const kind = rowKey[0];
    const index = Number(rowKey.slice(1));
    const current = this.getEventIconFieldsForKey(rowKey);
    if (!current) return;
    const next = { ...current, ...patch };
    const styles = this.getEventStylesForEditor();

    if (kind === 'd') {
      if (isCompleteIconFields(next)) {
        this._eventIconDrafts = this._eventIconDrafts.filter((_, draftIndex) => draftIndex !== index);
        this.emitEventStyles(appendIconRule(styles, next));
      } else {
        this._eventIconDrafts = this._eventIconDrafts.map((draft, draftIndex) => (draftIndex === index ? next : draft));
      }
    } else if (isCompleteIconFields(next)) {
      this.emitEventStyles(replaceIconRule(styles, index, next));
    } else {
      this._eventIconDrafts = [...this._eventIconDrafts, next];
      this.emitEventStyles(removeRuleAt(styles, index));
    }
    this.render();
  }

  addEventIconRow() {
    this._eventIconDrafts = [...this._eventIconDrafts, {
      keyword: '', icon: '', position: DEFAULT_ICON_POSITION, color: '', size: '', hideCalendarDot: false
    }];
    this.render();
  }

  removeEventIconRow(rowKey) {
    const kind = rowKey[0];
    const index = Number(rowKey.slice(1));
    if (kind === 'd') {
      this._eventIconDrafts = this._eventIconDrafts.filter((_, draftIndex) => draftIndex !== index);
      this.render();
      return;
    }
    this.emitEventStyles(removeRuleAt(this.getEventStylesForEditor(), index));
    this.render();
  }

  moveEventIconRow(rowKey, direction) {
    if (rowKey[0] !== 'r') return;
    const styles = this.getEventStylesForEditor();
    const moved = moveIconRule(styles, Number(rowKey.slice(1)), direction);
    if (moved === styles) return;
    this.emitEventStyles(moved);
    this.render();
  }

  renderEventIconsEditor() {
    const styles = this.getEventStylesForEditor();
    const rules = listIconRules(styles);
    const otherRuleCount = countOtherRules(styles);
    const rows = [
      ...rules.map((rule, position) => this.renderEventIconRow(rule, `r${rule.index}`, position, rules.length)),
      ...this._eventIconDrafts.map((draft, draftIndex) => this.renderEventIconRow(draft, `d${draftIndex}`, -1, 0))
    ];

    return `
      <div class="event-icons-editor">
        <p class="helper">${this.translateEditorLiteral('Put an icon before event titles by keyword. Enter multiple keywords separated by commas; any matching word uses the same icon.')}</p>
        ${rows.length ? rows.join('') : '<p class="helper">No event icons yet.</p>'}
        <button type="button" class="secondary-action" data-event-icon-action="add">Add event icon</button>
        ${otherRuleCount ? `<p class="helper">${this.translateEditorLiteral('Other event style rules are configured in YAML and remain unchanged ({count}).', { count: otherRuleCount })}</p>` : ''}
      </div>
    `;
  }

  getFamilyEventRulesForEditor() {
    return (Array.isArray(this._config?.family_event_rules) ? this._config.family_event_rules : []).slice(0, 5).map((rule) => ({
      tag: String(rule?.tag || '').trim(), calendars: Array.isArray(rule?.calendars) ? [...rule.calendars] : [],
      color_mode: ['calendar', 'solid', 'gradient'].includes(rule?.color_mode) ? rule.color_mode : 'calendar',
      color: this.normalizeHexColor(rule?.color) || '#3B82F6'
    }));
  }

  renderFamilyEventRulesEditor() {
    const rules = this.getFamilyEventRulesForEditor();
    const entities = this.getConfiguredEntitiesForEditor();
    const count = Math.max(1, Math.min(5, Math.max(rules.length, this._familyRuleDraftCount || 1)));
    this._familyRuleDraftCount = count;
    const rows = Array.from({ length: count }, (_, index) => {
      const rule = rules[index] || { tag: '', calendars: [], color_mode: 'calendar', color: '#3B82F6' };
      return `<section class="family-event-rule" data-family-event-rule="${index}">
        <div class="field-row"><strong>${this.translateEditorLiteral('Prefix {number}', { number: index + 1 })}</strong>${count > 1 ? `<button type="button" class="secondary-action" data-family-rule-action="remove" data-index="${index}">${this.translateEditorLiteral('Remove')}</button>` : ''}</div>
        <div class="field-row">
          <label class="field">${this.translateEditorLiteral('Prefix {number}', { number: index + 1 })}<input type="text" maxlength="10" data-family-rule-field="tag" data-index="${index}" value="${this.escapeHtml(rule.tag)}" placeholder="P"></label>
          <label class="field">${this.translateEditorLiteral('Combined event color')}<select data-family-rule-field="color_mode" data-index="${index}"><option value="calendar" ${rule.color_mode === 'calendar' ? 'selected' : ''}>${this.translateEditorLiteral('Calendar colors')}</option><option value="solid" ${rule.color_mode === 'solid' ? 'selected' : ''}>${this.translateEditorLiteral('Single color')}</option><option value="gradient" ${rule.color_mode === 'gradient' ? 'selected' : ''}>${this.translateEditorLiteral('Gradient from calendar colors')}</option></select></label>
          <label class="field" data-family-solid-wrap="${index}" ${rule.color_mode === 'solid' ? '' : 'hidden'}>${this.translateEditorLiteral('Color')}<input type="color" data-family-rule-field="color" data-index="${index}" value="${rule.color}"></label>
        </div>
        <div class="list-checkbox-grid"><span class="field-label">${this.translateEditorLiteral('Calendars that share this prefix')}</span>${entities.map((entityId) => `<label class="list-checkbox-row"><span>${this.escapeHtml(this.getEntityFriendlyName(entityId))}</span><input type="checkbox" data-family-rule-calendar="${index}" value="${this.escapeHtml(entityId)}" ${rule.calendars.includes(entityId) ? 'checked' : ''}></label>`).join('') || `<p class="helper">${this.translateEditorLiteral('Select at least one calendar in the card settings first.')}</p>`}</div>
      </section>`;
    }).join('');
    return `<div class="family-event-rules">${rows}<button type="button" class="secondary-action" data-family-rule-action="add" ${count >= 5 ? 'disabled' : ''}>${this.translateEditorLiteral('Add prefix')}</button></div>`;
  }

  handleFamilyRuleAction(event) {
    const action = event.currentTarget.dataset.familyRuleAction;
    const rules = this.getFamilyEventRulesForEditor();
    if (action === 'add' && this._familyRuleDraftCount < 5) {
      this._familyRuleDraftCount += 1;
      this.render();
    } else if (action === 'remove') {
      const index = Number(event.currentTarget.dataset.index);
      if (index >= 0 && index < rules.length) rules.splice(index, 1);
      this._familyRuleDraftCount = Math.max(1, this._familyRuleDraftCount - 1);
      this.emitConfigChanged({ ...this.value, family_event_rules: rules });
      this.render();
    }
  }

  handleFamilyRuleInput(event) {
    const index = Number(event.target.dataset.index ?? event.target.dataset.familyRuleCalendar);
    if (!Number.isInteger(index) || index < 0 || index >= 5) return;
    const rules = this.getFamilyEventRulesForEditor();
    while (rules.length <= index) rules.push({ tag: '', calendars: [], color_mode: 'calendar', color: '#3B82F6' });
    const field = event.target.dataset.familyRuleField;
    if (field === 'tag') rules[index].tag = String(event.target.value || '').trim().replace(/^\((.*)\)$/, '$1');
    else if (field === 'color_mode') {
      rules[index].color_mode = event.target.value;
      const color = this.querySelector(`[data-family-solid-wrap="${index}"]`);
      if (color) color.hidden = event.target.value !== 'solid';
    } else if (field === 'color') rules[index].color = event.target.value;
    else rules[index].calendars = Array.from(this.querySelectorAll(`[data-family-rule-calendar="${index}"]:checked`)).map((input) => input.value);
    this.emitConfigChanged({ ...this.value, family_event_rules: rules.slice(0, 5) });
  }

  renderEventIconRow(fields, rowKey, position, count) {
    const isDraft = rowKey[0] === 'd';
    const idPrefix = `event-icon-${rowKey}`;
    const keyAttr = `data-event-icon-key="${this.escapeHtml(rowKey)}"`;
    const title = fields.keyword || 'New event icon';
    const incomplete = isDraft
      ? '<p class="validation-message">Enter both a keyword and an icon to activate this row.</p>'
      : '';

    return `
      <div class="event-icon-card" data-event-icon-card="${this.escapeHtml(rowKey)}">
        <div class="event-icon-card-header">
          <strong>${fields.icon ? `<ha-icon icon="${this.escapeHtml(fields.icon)}"></ha-icon> ` : ''}${this.escapeHtml(title)}</strong>
          <div class="event-icon-card-actions">
            <button type="button" title="Move up" data-event-icon-action="move-up" ${keyAttr} ${isDraft || position === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" title="Move down" data-event-icon-action="move-down" ${keyAttr} ${isDraft || position === count - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" title="Remove" data-event-icon-action="remove" ${keyAttr}>Remove</button>
          </div>
        </div>
        ${incomplete}
        <div class="field-row">
          <div class="field">
            <label for="${idPrefix}-keyword">${this.translateEditorLiteral('Title contains (comma-separated keywords)')}</label>
            <input id="${idPrefix}-keyword" type="text" data-event-icon-field="keyword" ${keyAttr} value="${this.escapeHtml(fields.keyword)}" placeholder="Dentist, doctor">
          </div>
          <div class="field">
            <label for="${idPrefix}-icon">Icon</label>
            <input id="${idPrefix}-icon" type="text" data-event-icon-field="icon" ${keyAttr} value="${this.escapeHtml(fields.icon)}" placeholder="mdi:tooth">
          </div>
        </div>
        <div class="field-row">
          <div class="field field-inline">
            <label for="${idPrefix}-position">Position</label>
            <select id="${idPrefix}-position" data-event-icon-field="position" ${keyAttr}>
              <option value="before_title" ${fields.position !== 'corner' ? 'selected' : ''}>Before the title</option>
              <option value="corner" ${fields.position === 'corner' ? 'selected' : ''}>Corner of the event</option>
            </select>
          </div>
          <div class="field field-inline">
            <label for="${idPrefix}-size">Size (optional)</label>
            <input id="${idPrefix}-size" type="text" data-event-icon-field="size" ${keyAttr} value="${this.escapeHtml(fields.size)}" placeholder="20 or 1.4em">
          </div>
        </div>
        <div class="field-row">
          <div class="field field-inline">
            <label>Icon color</label>
            ${fields.color
              ? `${this.renderColorInputControl({ id: `${idPrefix}-color`, field: 'event_icon_color', mapKey: rowKey, value: fields.color })}
                 <button type="button" data-event-icon-action="clear-color" ${keyAttr}>Use default</button>`
              : `<button type="button" data-event-icon-action="set-color" ${keyAttr}>Choose color</button>`}
          </div>
        </div>
        <div class="boolean-list">
          <label><input type="checkbox" data-event-icon-field="hideCalendarDot" ${keyAttr} ${fields.hideCalendarDot ? 'checked' : ''}> Hide the small calendar dot on these events</label>
        </div>
      </div>
    `;
  }

  handleEventIconFieldChange(event) {
    const target = event.target;
    const rowKey = target.dataset.eventIconKey;
    const field = target.dataset.eventIconField;
    if (!rowKey || !field) return;
    const value = target.type === 'checkbox' ? target.checked : String(target.value ?? '').trim();
    this.applyEventIconPatch(rowKey, { [field]: value });
  }

  handleEventIconAction(event) {
    const button = event.currentTarget;
    const action = button.dataset.eventIconAction;
    const rowKey = button.dataset.eventIconKey;
    if (action === 'add') this.addEventIconRow();
    else if (action === 'remove') this.removeEventIconRow(rowKey);
    else if (action === 'move-up') this.moveEventIconRow(rowKey, -1);
    else if (action === 'move-down') this.moveEventIconRow(rowKey, 1);
    else if (action === 'set-color') this.applyEventIconPatch(rowKey, { color: '#3f51b5' });
    else if (action === 'clear-color') this.applyEventIconPatch(rowKey, { color: '' });
  }

  renderHeaderNavButtonsEditor() {
    const renderableButtons = this.getRenderableHeaderNavButtonsForEditor();
    const canAddMore = renderableButtons.length < MAX_HEADER_NAV_BUTTONS;

    return `
      <div class="header-nav-buttons-editor">
        <p class="helper">${this.translateEditorLiteral('Add extra header buttons that link to other dashboards. Set an icon or text and choose a destination.')}</p>
        ${renderableButtons.length ? renderableButtons
          .map(({ button, index }, renderIndex) => this.renderHeaderNavButtonRow(button, index, renderIndex, renderableButtons.length))
          .join('') : '<p class="helper">No header navigation buttons configured yet.</p>'}
        ${canAddMore
          ? '<button type="button" class="secondary-action" data-header-nav-button-action="add">Add header button</button>'
          : `<p class="helper">${this.translateEditorLiteral('Maximum of {count} header buttons reached.', { count: MAX_HEADER_NAV_BUTTONS })}</p>`}
      </div>
    `;
  }

  renderHeaderNavButtonRow(button, index, renderIndex = index, renderCount = this.getRenderableHeaderNavButtonsForEditor().length) {
    const icon = String(button.icon || '').trim();
    const label = String(button.label ?? button.text ?? '').trim();
    const isMissingIconAndLabel = !icon && !label;
    const isMissingDestination = !button.path && !button.tap_action;
    const validationMarkup = [
      isMissingIconAndLabel ? ['icon-label', 'Set an icon or a label so this button has something to show.'] : null,
      isMissingDestination ? ['destination', 'Set a dashboard, URL, service, or event so this button does something when tapped.'] : null
    ].filter(Boolean).map(([suffix, message]) => `<p class="validation-message" id="header-nav-button-error-${suffix}-${index}">${message}</p>`).join('');

    return `
      <div class="header-nav-button-card" data-header-nav-button-card="${index}">
        <div class="header-nav-button-card-header">
          <strong>${this.escapeHtml(label || icon || `Header button ${renderIndex + 1}`)}</strong>
          <div class="header-nav-button-actions">
            <button type="button" title="Move up" data-header-nav-button-action="move-up" data-header-nav-button-index="${index}" ${renderIndex === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" title="Move down" data-header-nav-button-action="move-down" data-header-nav-button-index="${index}" ${renderIndex === renderCount - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" title="Remove" data-header-nav-button-action="remove" data-header-nav-button-index="${index}">Remove</button>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="header-nav-button-icon-${index}">Icon (optional)</label>
            <input id="header-nav-button-icon-${index}" type="text" data-header-nav-button-field="icon" data-header-nav-button-index="${index}" value="${this.escapeHtml(icon)}" placeholder="mdi:home">
          </div>
          <div class="field">
            <label for="header-nav-button-label-${index}">Text label (used when no icon is set)</label>
            <input id="header-nav-button-label-${index}" type="text" data-header-nav-button-field="label" data-header-nav-button-index="${index}" value="${this.escapeHtml(label)}" placeholder="Kids">
          </div>
        </div>
        ${validationMarkup}
        <div class="field-row">
          ${this.renderHeaderButtonActionControl({
            idPrefix: `header-nav-button-${index}`,
            mapKey: String(index)
          })}
        </div>
        <div class="field-row">
          ${this.renderHeaderButtonColorControl({
            idPrefix: `header-nav-button-${index}`,
            mapKey: String(index),
            rawColor: button.color
          })}
        </div>
      </div>
    `;
  }

  updateHeaderNavButton(index, patch, { render = false } = {}) {
    const headerNavButtons = [...this.getHeaderNavButtonsForEditor()];
    if (index < 0 || index >= headerNavButtons.length) return;
    const currentButton = headerNavButtons[index];
    if (!currentButton || typeof currentButton !== 'object' || Array.isArray(currentButton)) return;

    headerNavButtons[index] = {
      ...currentButton,
      ...patch
    };

    this.emitConfigChanged({
      ...this.value,
      header_nav_buttons: headerNavButtons
    });

    if (render) this.render();
    else this.updateFieldValues();
  }

  addHeaderNavButton() {
    const headerNavButtons = [...this.getHeaderNavButtonsForEditor()];
    if (headerNavButtons.length >= MAX_HEADER_NAV_BUTTONS) return;
    headerNavButtons.push({ icon: null, label: null, path: null, color: null, tap_action: null });

    this.emitConfigChanged({
      ...this.value,
      header_nav_buttons: headerNavButtons
    });
    this.render();
  }

  removeHeaderNavButton(index) {
    const headerNavButtons = [...this.getHeaderNavButtonsForEditor()];
    if (index < 0 || index >= headerNavButtons.length) return;
    headerNavButtons.splice(index, 1);

    this.emitConfigChanged({
      ...this.value,
      header_nav_buttons: headerNavButtons
    });
    this.render();
  }

  moveHeaderNavButton(index, direction) {
    const headerNavButtons = [...this.getHeaderNavButtonsForEditor()];
    const targetIndex = index + direction;
    if (index < 0 || index >= headerNavButtons.length || targetIndex < 0 || targetIndex >= headerNavButtons.length) return;
    [headerNavButtons[index], headerNavButtons[targetIndex]] = [headerNavButtons[targetIndex], headerNavButtons[index]];

    this.emitConfigChanged({
      ...this.value,
      header_nav_buttons: headerNavButtons
    });
    this.render();
  }

  handleHeaderNavButtonAction(event) {
    const action = event.currentTarget.dataset.headerNavButtonAction;
    const index = Number(event.currentTarget.dataset.headerNavButtonIndex);
    if (action === 'add') this.addHeaderNavButton();
    else if (action === 'remove') this.removeHeaderNavButton(index);
    else if (action === 'move-up') this.moveHeaderNavButton(index, -1);
    else if (action === 'move-down') this.moveHeaderNavButton(index, 1);
  }

  handleHeaderNavButtonInput(event) {
    const index = Number(event.target.dataset.headerNavButtonIndex);
    const field = event.target.dataset.headerNavButtonField;
    if (!field) return;
    const value = String(event.target.value || '').trim();
    this.updateHeaderNavButton(index, { [field]: value || null }, { render: field === 'icon' || field === 'label' });
  }

  getHeaderButtonColorMode(rawColor) {
    if (rawColor?.mode === 'gradient') return 'gradient';
    const value = String(rawColor || '').trim();
    if (!value) return 'default';
    return value.toLowerCase().startsWith('calendar:') ? 'calendar' : 'custom';
  }

  renderHeaderButtonColorCalendarOptions(selectedTarget) {
    const entityOptions = this.getConfiguredEntitiesForEditor().map((entityId) => {
      const target = `calendar:${entityId}`;
      return `<option value="${this.escapeHtml(target)}" ${selectedTarget === target ? 'selected' : ''}>${this.escapeHtml(this.getEntityFriendlyName(entityId))}</option>`;
    }).join('');

    const virtualOptions = this.getVirtualCalendarsForEditor()
      .filter((virtualCalendar) => virtualCalendar && typeof virtualCalendar.id === 'string' && virtualCalendar.id.trim())
      .map((virtualCalendar) => {
        const target = `calendar:virtual:${virtualCalendar.id}`;
        return `<option value="${this.escapeHtml(target)}" ${selectedTarget === target ? 'selected' : ''}>${this.escapeHtml(virtualCalendar.name || virtualCalendar.id)}</option>`;
      }).join('');

    return entityOptions + virtualOptions;
  }

  getHeaderButtonPath(mapKey) {
    if (mapKey === 'dashboard') return String(this._config.header_dashboard_path || '').trim();
    return String(this.getHeaderNavButtonsForEditor()[Number(mapKey)]?.path || '').trim();
  }

  getHeaderButtonTapAction(mapKey) {
    if (mapKey === 'dashboard') return this._config.header_dashboard_tap_action || null;
    return this.getHeaderNavButtonsForEditor()[Number(mapKey)]?.tap_action || null;
  }

  setHeaderButtonPath(mapKey, value, { render = true } = {}) {
    if (mapKey === 'dashboard') {
      this.emitConfigChanged({ ...this.value, header_dashboard_path: value || null });
      if (render) this.render();
      else this.updateFieldValues();
      return;
    }
    this.updateHeaderNavButton(Number(mapKey), { path: value || null }, { render });
  }

  setHeaderButtonTapAction(mapKey, tapAction, { render = true } = {}) {
    if (mapKey === 'dashboard') {
      this.emitConfigChanged({ ...this.value, header_dashboard_tap_action: tapAction });
      if (render) this.render();
      else this.updateFieldValues();
      return;
    }
    this.updateHeaderNavButton(Number(mapKey), { tap_action: tapAction }, { render });
  }

  patchHeaderButtonTapAction(mapKey, patch, { render = false } = {}) {
    const current = this.getHeaderButtonTapAction(mapKey) || {};
    this.setHeaderButtonTapAction(mapKey, { ...current, ...patch }, { render });
  }

  getHeaderButtonActionMode(tapAction) {
    return ['url', 'call-service', 'fire-dom-event'].includes(tapAction?.action) ? tapAction.action : 'navigate';
  }

  // Shared "when tapped" control for the Home button and each header nav
  // button. "Open a dashboard" is the plain `path` shorthand (dropdown of
  // known dashboards, or a manually typed path); the other three modes write
  // a richer `tap_action` (the same shape Home Assistant tap actions use
  // everywhere else, and the exact fields this project's day_badges
  // fire-dom-event tap_action already uses). `mapKey` addresses which button
  // this is: 'dashboard' for the Home button, or the header_nav_buttons
  // index (as a string) for an extra button.
  renderHeaderButtonActionControl({ idPrefix, mapKey }) {
    const path = this.getHeaderButtonPath(mapKey);
    const tapAction = this.getHeaderButtonTapAction(mapKey);
    const mode = this.getHeaderButtonActionMode(tapAction);
    const scopeAttrs = `data-header-button-action-map-key="${this.escapeHtml(mapKey)}"`;
    const knownDashboardPaths = new Set(this._dashboardOptions.map((dashboard) => dashboard.path));
    const isCustomPath = mode === 'navigate' && !!path && !knownDashboardPaths.has(path);

    return `
      <div class="field">
        <label for="${idPrefix}-action-mode">When tapped</label>
        <select id="${idPrefix}-action-mode" data-header-button-action-mode="true" ${scopeAttrs}>
          <option value="navigate" ${mode === 'navigate' ? 'selected' : ''}>Open a dashboard</option>
          <option value="url" ${mode === 'url' ? 'selected' : ''}>Open a URL</option>
          <option value="call-service" ${mode === 'call-service' ? 'selected' : ''}>Call a service (e.g. open a popup)</option>
          <option value="fire-dom-event" ${mode === 'fire-dom-event' ? 'selected' : ''}>Fire a custom event</option>
        </select>
      </div>
      ${mode === 'navigate' ? `
      <div class="field field-inline">
        <label for="${idPrefix}-action-dashboard">Dashboard target</label>
        <select id="${idPrefix}-action-dashboard" data-header-button-action-dashboard="true" ${scopeAttrs}>
          <option value="">Select a dashboard</option>
          ${this._dashboardOptions.map((dashboard) => `
            <option value="${this.escapeHtml(dashboard.path)}" ${path === dashboard.path ? 'selected' : ''}>${this.escapeHtml(dashboard.title)}</option>
          `).join('')}
          <option value="__custom__" ${isCustomPath ? 'selected' : ''}>✏️ Custom path…</option>
        </select>
      </div>
      ${isCustomPath ? `
      <div class="field field-inline">
        <label for="${idPrefix}-action-path">Custom path</label>
        <input id="${idPrefix}-action-path" type="text" data-header-button-action-path="true" ${scopeAttrs} value="${this.escapeHtml(path)}" placeholder="/lovelace-kids">
      </div>
      ` : ''}
      ` : ''}
      ${mode === 'url' ? `
      <div class="field field-inline">
        <label for="${idPrefix}-action-url">URL</label>
        <input id="${idPrefix}-action-url" type="text" data-header-button-action-url="true" ${scopeAttrs} value="${this.escapeHtml(tapAction?.url_path || '')}" placeholder="https://example.com">
      </div>
      ` : ''}
      ${mode === 'call-service' ? `
      <div class="field field-inline">
        <label for="${idPrefix}-action-service">Service</label>
        <input id="${idPrefix}-action-service" type="text" data-header-button-action-service="true" ${scopeAttrs} value="${this.escapeHtml(tapAction?.service || '')}" placeholder="browser_mod.popup">
      </div>
      <div class="field">
        <label for="${idPrefix}-action-service-data">Service data (JSON, optional)</label>
        <textarea id="${idPrefix}-action-service-data" rows="4" data-header-button-action-service-data="true" ${scopeAttrs} placeholder='{"title": "Settings", "content": {"type": "custom:bubble-card", "card_type": "pop-up"}}'>${this.escapeHtml(typeof tapAction?.service_data === 'string' ? tapAction.service_data : JSON.stringify(tapAction?.service_data || {}, null, 2))}</textarea>
        <p class="helper">To open a popup card (e.g. Bubble Card), call <code>browser_mod.popup</code> with a <code>content</code> field holding that card's config.</p>
      </div>
      ` : ''}
      ${mode === 'fire-dom-event' ? `
      <div class="field field-inline">
        <label for="${idPrefix}-action-event-type">Event type</label>
        <input id="${idPrefix}-action-event-type" type="text" data-header-button-action-event-type="true" ${scopeAttrs} value="${this.escapeHtml(tapAction?.event_type || '')}" placeholder="my-popup-trigger">
      </div>
      <div class="field">
        <label for="${idPrefix}-action-event-data">Event data (JSON, optional)</label>
        <textarea id="${idPrefix}-action-event-data" rows="3" data-header-button-action-event-data="true" ${scopeAttrs} placeholder='{"key": "value"}'>${this.escapeHtml(typeof tapAction?.event_data === 'string' ? tapAction.event_data : JSON.stringify(tapAction?.event_data || {}, null, 2))}</textarea>
      </div>
      ` : ''}
    `;
  }

  handleHeaderButtonActionModeChange(event) {
    const mapKey = event.target.dataset.headerButtonActionMapKey;
    const mode = event.target.value;
    if (mode === 'navigate') {
      this.setHeaderButtonTapAction(mapKey, null, { render: true });
      return;
    }
    const current = this.getHeaderButtonTapAction(mapKey);
    const seeds = {
      url: { action: 'url', url_path: '' },
      'call-service': { action: 'call-service', service: '', service_data: {} },
      'fire-dom-event': { action: 'fire-dom-event', event_type: '', event_data: {} }
    };
    this.setHeaderButtonTapAction(mapKey, current?.action === mode ? current : seeds[mode], { render: true });
  }

  handleHeaderButtonActionDashboardChange(event) {
    const mapKey = event.target.dataset.headerButtonActionMapKey;
    const value = event.target.value;
    this.setHeaderButtonPath(mapKey, value === '__custom__' ? '/' : value, { render: true });
  }

  handleHeaderButtonActionPathChange(event) {
    const mapKey = event.target.dataset.headerButtonActionMapKey;
    this.setHeaderButtonPath(mapKey, event.target.value, { render: false });
  }

  handleHeaderButtonActionUrlChange(event) {
    const mapKey = event.target.dataset.headerButtonActionMapKey;
    this.patchHeaderButtonTapAction(mapKey, { action: 'url', url_path: event.target.value.trim() });
  }

  handleHeaderButtonActionServiceChange(event) {
    const mapKey = event.target.dataset.headerButtonActionMapKey;
    this.patchHeaderButtonTapAction(mapKey, { action: 'call-service', service: event.target.value.trim() });
  }

  handleHeaderButtonActionServiceDataChange(event) {
    const mapKey = event.target.dataset.headerButtonActionMapKey;
    this.patchHeaderButtonTapAction(mapKey, { action: 'call-service', service_data: event.target.value });
  }

  handleHeaderButtonActionEventTypeChange(event) {
    const mapKey = event.target.dataset.headerButtonActionMapKey;
    this.patchHeaderButtonTapAction(mapKey, { action: 'fire-dom-event', event_type: event.target.value.trim() });
  }

  handleHeaderButtonActionEventDataChange(event) {
    const mapKey = event.target.dataset.headerButtonActionMapKey;
    this.patchHeaderButtonTapAction(mapKey, { action: 'fire-dom-event', event_data: event.target.value });
  }

  // Shared "button color" control for the Home button and each header nav
  // button: default (no override), match a configured calendar's own color,
  // or a freely chosen custom color via the existing color-picker swatch.
  // `mapKey` addresses which button this is: 'dashboard' for the Home button,
  // or the header_nav_buttons index (as a string) for an extra button.
  renderHeaderButtonColorControl({ idPrefix, mapKey, rawColor }) {
    const mode = this.getHeaderButtonColorMode(rawColor);
    const scopeAttrs = `data-header-button-color-map-key="${this.escapeHtml(mapKey)}"`;

    return `
      <div class="field">
        <label for="${idPrefix}-color-mode">Button color</label>
        <select id="${idPrefix}-color-mode" data-header-button-color-mode="true" ${scopeAttrs}>
          <option value="default" ${mode === 'default' ? 'selected' : ''}>Default</option>
          <option value="calendar" ${mode === 'calendar' ? 'selected' : ''}>Match a calendar</option>
          <option value="custom" ${mode === 'custom' ? 'selected' : ''}>Custom color</option>
          ${mapKey !== 'dashboard' ? `<option value="gradient" ${mode === 'gradient' ? 'selected' : ''}>${this.translateEditorLiteral('Calendar gradient')}</option>` : ''}
        </select>
      </div>
      ${mode === 'calendar' ? `
      <div class="field">
        <label for="${idPrefix}-color-calendar">Matches</label>
        <select id="${idPrefix}-color-calendar" data-header-button-color-calendar="true" ${scopeAttrs}>
          ${this.renderHeaderButtonColorCalendarOptions(String(rawColor || '').trim())}
        </select>
      </div>
      ` : ''}
      ${mode === 'gradient' ? `
      <div class="field">
        <span>${this.translateEditorLiteral('Gradient calendars')}</span>
        <p class="helper">${this.translateEditorLiteral('Select at least two calendars. Colors follow the selection order from left to right.')}</p>
        ${this.renderHeaderButtonGradientCalendars(mapKey, rawColor)}
      </div>` : ''}
      ${mode === 'custom' ? this.renderColorInputControl({
        id: `${idPrefix}-color-custom`,
        field: 'header_button_color',
        mapKey,
        value: rawColor
      }) : ''}
    `;
  }

  renderHeaderButtonGradientCalendars(mapKey, rawColor) {
    const selected = Array.isArray(rawColor?.calendars) ? rawColor.calendars : [];
    const available = new Map(this.getConfiguredEntitiesForEditor().map(id => [id, this.getEntityFriendlyName(id)]));
    this.getVirtualCalendarsForEditor().forEach(calendar => {
      if (calendar?.id) available.set(`virtual:${calendar.id}`, calendar.name || calendar.id);
    });
    // Keep selected stops first so their left-to-right order survives editing.
    const targets = [...new Set([...selected, ...available.keys()])];
    return targets.map(target => `<label class="list-checkbox-row">
      <span>${this.escapeHtml(available.get(target) || target)}</span>
      <input type="checkbox" data-header-button-gradient-calendar="true"
        data-header-button-color-map-key="${this.escapeHtml(mapKey)}"
        value="${this.escapeHtml(target)}" ${selected.includes(target) ? 'checked' : ''}>
    </label>`).join('');
  }

  handleHeaderButtonGradientCalendarChange(event) {
    const mapKey = event.target.dataset.headerButtonColorMapKey;
    const current = this.getHeaderNavButtonsForEditor()[Number(mapKey)]?.color;
    const selected = Array.isArray(current?.calendars) ? [...current.calendars] : [];
    const target = event.target.value;
    const calendars = event.target.checked
      ? [...new Set([...selected, target])]
      : selected.filter(value => value !== target);
    this.setHeaderButtonColor(mapKey, { mode: 'gradient', calendars }, { render: true });
  }

  getEditorHeaderButtonColor(mapKey) {
    const raw = mapKey === 'dashboard'
      ? this._config.header_dashboard_button_color
      : this.getHeaderNavButtonsForEditor()[Number(mapKey)]?.color;
    return this.toColorInputValue(raw);
  }

  setHeaderButtonColor(mapKey, value, { render = true } = {}) {
    if (mapKey === 'dashboard') {
      this.emitConfigChanged({ ...this.value, header_dashboard_button_color: value || null });
      if (render) this.render();
      else this.updateFieldValues();
      return;
    }
    this.updateHeaderNavButton(Number(mapKey), { color: value || null }, { render });
  }

  handleHeaderButtonColorModeChange(event) {
    const mapKey = event.target.dataset.headerButtonColorMapKey;
    const mode = event.target.value;
    let nextValue = null;
    if (mode === 'calendar') {
      const firstOption = this.getConfiguredEntitiesForEditor()[0];
      nextValue = firstOption ? `calendar:${firstOption}` : '';
    } else if (mode === 'gradient' && mapKey !== 'dashboard') {
      nextValue = { mode: 'gradient', calendars: this.getConfiguredEntitiesForEditor().slice(0, 2) };
    } else if (mode === 'custom') {
      const current = this.getEditorHeaderButtonColor(mapKey);
      nextValue = current;
    }
    this.setHeaderButtonColor(mapKey, nextValue, { render: true });
  }

  handleHeaderButtonColorCalendarChange(event) {
    const mapKey = event.target.dataset.headerButtonColorMapKey;
    this.setHeaderButtonColor(mapKey, event.target.value, { render: false });
  }

  renderVirtualCalendarsEditor() {
    const renderableVirtualCalendars = this.getRenderableVirtualCalendarsForEditor();

    return `
      <div class="virtual-calendars-editor">
        <p class="helper">Create display-only calendar badges that group one or more configured real calendars.</p>
        ${renderableVirtualCalendars.length ? renderableVirtualCalendars
          .map(({ virtualCalendar, index }, renderIndex) => this.renderVirtualCalendarRow(virtualCalendar, index, renderIndex, renderableVirtualCalendars.length))
          .join('') : '<p class="helper">No virtual calendars configured yet.</p>'}
        <button type="button" class="secondary-action" data-virtual-calendar-action="add">Add virtual calendar</button>
      </div>
    `;
  }

  renderVirtualCalendarRow(virtualCalendar, index, renderIndex = index, renderCount = this.getRenderableVirtualCalendarsForEditor().length) {
    const configuredEntities = this.getConfiguredEntitiesForEditor();
    const configuredEntitySet = new Set(configuredEntities);
    const selectedEntityValues = Array.isArray(virtualCalendar.entities)
      ? virtualCalendar.entities.filter((entityId) => typeof entityId === 'string' && entityId.startsWith('calendar.'))
      : [];
    const selectedEntities = new Set(selectedEntityValues);
    const legacyEntities = selectedEntityValues.filter((entityId) => !configuredEntitySet.has(entityId));
    const virtualCalendarName = String(virtualCalendar.name || '').trim();
    const virtualCalendarId = String(virtualCalendar.id || '').trim();
    const virtualCalendarIcon = String(virtualCalendar.icon || '').trim();
    const virtualCalendarColor = String(virtualCalendar.color || '').trim();
    const idValidation = this.getVirtualCalendarIdValidation(index);
    const idValidationMarkup = idValidation
      ? `<p class="validation-message" id="virtual-calendar-id-error-${index}">${this.escapeHtml(idValidation)}</p>`
      : '';
    const colorStatusMarkup = virtualCalendarColor
      ? `<span class="virtual-calendar-color-status">Override: ${this.escapeHtml(virtualCalendarColor)}</span>`
      : '<span class="virtual-calendar-color-status no-override">No color override set</span>';
    const checkboxRows = configuredEntities.map((entityId) => {
      const displayName = this.escapeHtml(this.getEntityFriendlyName(entityId));
      const checked = selectedEntities.has(entityId) ? 'checked' : '';
      return `
        <label class="list-checkbox-row virtual-calendar-entity-row">
          <span>${displayName}</span>
          <input type="checkbox" data-virtual-calendar-entity="true" data-virtual-calendar-index="${index}" value="${this.escapeHtml(entityId)}" ${checked}>
        </label>
      `;
    });

    legacyEntities.forEach((entityId) => {
      checkboxRows.push(`
        <label class="list-checkbox-row virtual-calendar-entity-row legacy-entity-row">
          <span>${this.escapeHtml(entityId)} <em>(not in configured calendars)</em></span>
          <input type="checkbox" data-virtual-calendar-entity="true" data-virtual-calendar-index="${index}" value="${this.escapeHtml(entityId)}" checked disabled>
        </label>
      `);
    });

    const checkboxMarkup = checkboxRows.length
      ? checkboxRows.join('')
      : '<p class="helper">Select at least one real calendar above to include calendars here.</p>';

    return `
      <div class="virtual-calendar-card" data-virtual-calendar-card="${index}">
        <div class="virtual-calendar-card-header">
          <strong>${this.escapeHtml(virtualCalendarName || virtualCalendarId || `Virtual calendar ${renderIndex + 1}`)}</strong>
          <div class="virtual-calendar-actions">
            <button type="button" title="Move up" data-virtual-calendar-action="move-up" data-virtual-calendar-index="${index}" ${renderIndex === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" title="Move down" data-virtual-calendar-action="move-down" data-virtual-calendar-index="${index}" ${renderIndex === renderCount - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" title="Remove" data-virtual-calendar-action="remove" data-virtual-calendar-index="${index}">Remove</button>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="virtual-calendar-name-${index}">Name</label>
            <input id="virtual-calendar-name-${index}" type="text" data-virtual-calendar-field="name" data-virtual-calendar-index="${index}" value="${this.escapeHtml(virtualCalendarName)}" placeholder="Virtual Calendar">
          </div>
          <div class="field">
            <label for="virtual-calendar-id-${index}">ID</label>
            <input id="virtual-calendar-id-${index}" type="text" data-virtual-calendar-field="id" data-virtual-calendar-index="${index}" value="${this.escapeHtml(virtualCalendarId)}" placeholder="virtual_1" ${idValidation ? 'aria-invalid="true"' : ''} ${idValidation ? `aria-describedby="virtual-calendar-id-error-${index}"` : ''}>
            ${idValidationMarkup}
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="virtual-calendar-icon-${index}">Icon</label>
            <input id="virtual-calendar-icon-${index}" type="text" data-virtual-calendar-field="icon" data-virtual-calendar-index="${index}" value="${this.escapeHtml(virtualCalendarIcon)}" placeholder="mdi:calendar">
          </div>
          <div class="field virtual-calendar-color-field">
            <label for="virtual-calendar-color-${index}">Color override (optional)</label>
            <div class="virtual-calendar-color-row">
              ${this.renderColorInputControl({ id: `virtual-calendar-color-picker-${index}`, field: 'virtual_calendar_color', mapKey: String(index), value: virtualCalendarColor })}
              <input id="virtual-calendar-color-${index}" type="text" data-virtual-calendar-field="color" data-virtual-calendar-index="${index}" value="${this.escapeHtml(virtualCalendarColor)}" placeholder="#3f51b5">
              ${colorStatusMarkup}
            </div>
          </div>
        </div>
        <div class="field">
          <label>Included calendar entities</label>
          <div class="list-checkbox-grid virtual-calendar-entities">
            ${checkboxMarkup}
          </div>
        </div>
      </div>
    `;
  }

  updateVirtualCalendar(index, patch, { render = false } = {}) {
    const virtualCalendars = [...this.getVirtualCalendarsForEditor()];
    if (index < 0 || index >= virtualCalendars.length) return;
    const currentVirtualCalendar = virtualCalendars[index];
    if (!currentVirtualCalendar || typeof currentVirtualCalendar !== 'object' || Array.isArray(currentVirtualCalendar)) return;

    virtualCalendars[index] = this.sanitizeVirtualCalendarForEditor({
      ...currentVirtualCalendar,
      ...patch
    });

    this.emitConfigChanged({
      ...this.value,
      virtual_calendars: virtualCalendars
    });

    if (render) this.render();
    else this.updateFieldValues();
  }

  addVirtualCalendar() {
    const virtualCalendars = [...this.getVirtualCalendarsForEditor()];
    virtualCalendars.push({
      id: this.getNextVirtualCalendarId(),
      name: 'Virtual Calendar',
      icon: null,
      color: null,
      entities: []
    });

    this.emitConfigChanged({
      ...this.value,
      virtual_calendars: virtualCalendars
    });
    this.render();
  }

  removeVirtualCalendar(index) {
    const virtualCalendars = [...this.getVirtualCalendarsForEditor()];
    if (index < 0 || index >= virtualCalendars.length) return;
    virtualCalendars.splice(index, 1);

    this.emitConfigChanged({
      ...this.value,
      virtual_calendars: virtualCalendars
    });
    this.render();
  }

  moveVirtualCalendar(index, direction) {
    const renderableVirtualCalendars = this.getRenderableVirtualCalendarsForEditor();
    const renderIndex = renderableVirtualCalendars.findIndex((entry) => entry.index === index);
    const swapEntry = renderableVirtualCalendars[renderIndex + direction];
    const virtualCalendars = [...this.getVirtualCalendarsForEditor()];
    if (renderIndex === -1 || !swapEntry || index < 0 || index >= virtualCalendars.length) return;
    [virtualCalendars[index], virtualCalendars[swapEntry.index]] = [virtualCalendars[swapEntry.index], virtualCalendars[index]];

    this.emitConfigChanged({
      ...this.value,
      virtual_calendars: virtualCalendars
    });
    this.render();
  }

  handleVirtualCalendarAction(event) {
    const action = event.currentTarget.dataset.virtualCalendarAction;
    const index = Number(event.currentTarget.dataset.virtualCalendarIndex);
    if (action === 'add') this.addVirtualCalendar();
    else if (action === 'remove') this.removeVirtualCalendar(index);
    else if (action === 'move-up') this.moveVirtualCalendar(index, -1);
    else if (action === 'move-down') this.moveVirtualCalendar(index, 1);
  }

  handleVirtualCalendarInput(event) {
    const index = Number(event.target.dataset.virtualCalendarIndex);
    const field = event.target.dataset.virtualCalendarField;
    if (!field) return;
    const value = String(event.target.value || '').trim();
    this.updateVirtualCalendar(index, {
      [field]: field === 'icon' || field === 'color' ? (value || null) : value
    }, { render: field === 'id' || field === 'name' || field === 'color' });
  }

  handleVirtualCalendarEntityChange(event) {
    const index = Number(event.target.dataset.virtualCalendarIndex);
    const checkedEntities = Array.from(this.querySelectorAll(`input[data-virtual-calendar-entity][data-virtual-calendar-index="${index}"]:checked`))
      .map((input) => input.value)
      .filter((entityId) => typeof entityId === 'string' && entityId.startsWith('calendar.'));
    this.updateVirtualCalendar(index, { entities: checkedEntities });
  }

  renderWeekdayCheckboxes() {
    return renderEditorWeekdayCheckboxes({
      selectedWeekdays: new Set(this.getListFieldValue('week_days'))
    });
  }

  render() {
    this.captureOpenDisclosures();

    const displayLayoutSection = this.renderSection('Display & layout', `
      <div class="field-row">
        <div class="field field-inline">
          <label for="first_day_of_week">First day of week</label>
          <select id="first_day_of_week" data-field="first_day_of_week" data-type="number">
            <option value="0" ${Number(this._config.first_day_of_week) === 0 ? 'selected' : ''}>Sunday</option>
            <option value="1" ${Number(this._config.first_day_of_week) === 1 ? 'selected' : ''}>Monday</option>
            <option value="2" ${Number(this._config.first_day_of_week) === 2 ? 'selected' : ''}>Tuesday</option>
            <option value="3" ${Number(this._config.first_day_of_week) === 3 ? 'selected' : ''}>Wednesday</option>
            <option value="4" ${Number(this._config.first_day_of_week) === 4 ? 'selected' : ''}>Thursday</option>
            <option value="5" ${Number(this._config.first_day_of_week) === 5 ? 'selected' : ''}>Friday</option>
            <option value="6" ${Number(this._config.first_day_of_week) === 6 ? 'selected' : ''}>Saturday</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>Week days</label>
        ${this.renderWeekdayCheckboxes()}
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="week_start_hour">Week start hour</label>
          <input id="week_start_hour" data-field="week_start_hour" data-type="number" type="number" min="0" max="23" value="${Number(this._config.week_start_hour ?? this.getEditorDefaultValue('week_start_hour'))}">
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="week_end_hour">Week end hour</label>
          <input id="week_end_hour" data-field="week_end_hour" data-type="number" type="number" min="0" max="23" value="${Number(this._config.week_end_hour ?? this.getEditorDefaultValue('week_end_hour'))}">
        </div>
      </div>
      <div class="boolean-list">
        <label><input type="checkbox" data-field="lock_schedule_hours" ${this._config.lock_schedule_hours ? 'checked' : ''}> Schedule view: lock week start/end hours</label>
        <label class="field-inline">Past-ended events
          <select data-field="past_event_mode">
            <option value="none" ${this._config.past_event_mode === 'none' ? 'selected' : ''}>Show normally</option>
            <option value="hide" ${this._config.past_event_mode === 'hide' ? 'selected' : ''}>Hide</option>
            <option value="muted" ${this._config.past_event_mode === 'muted' ? 'selected' : ''}>Mute</option>
          </select>
        </label>
        <label><input type="checkbox" data-field="hide_empty_days" ${this._config.hide_empty_days ? 'checked' : ''}> Agenda view: hide empty days</label>
        <label class="field-inline">Agenda view: text alignment
          <select data-field="agenda_text_alignment">
            ${['auto','left','center','right'].map(value => `<option value="${value}" ${this._config.agenda_text_alignment === value ? 'selected' : ''}>${{auto:'Default',left:'Left',center:'Center',right:'Right'}[value]}</option>`).join('')}
          </select>
        </label>
        <label><input type="checkbox" data-field="agenda_compact_events" ${this._config.agenda_compact_events ? 'checked' : ''}> Agenda view: compact events</label>
        <label><input type="checkbox" data-field="disable_swipe_controls" ${this._config.disable_swipe_controls ? 'checked' : ''}> Disable swipe period controls</label>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="idle_reset_minutes">Idle reset (minutes)</label>
          <input id="idle_reset_minutes" data-field="idle_reset_minutes" data-type="nullable-number" type="number" min="0.1" step="any" value="${this._config.idle_reset_minutes ?? ''}" placeholder="Disabled">
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="rolling_days_week_compact">Rolling days (week view)</label>
          <input id="rolling_days_week_compact" data-field="rolling_days_week_compact" data-type="nullable-number" type="number" min="1" value="${this._config.rolling_days_week_compact ?? ''}" placeholder="Disabled">
        </div>
      </div>
      <div class="field-row week-compact-header-control-row">
        <div class="field field-inline week-compact-header-field">
          <label for="week_compact_weekday_font_size">Week Compact weekday font size (px)</label>
          <input id="week_compact_weekday_font_size" data-field="week_compact_weekday_font_size" data-type="number" type="number" min="1" value="${Number(this._config.week_compact_weekday_font_size ?? this.getEditorDefaultValue('week_compact_weekday_font_size'))}">
        </div>
      </div>
      <div class="field-row week-compact-header-control-row">
        <div class="field field-inline week-compact-header-field">
          <label for="week_compact_day_header_spacing">Week Compact day header spacing (px)</label>
          <input id="week_compact_day_header_spacing" data-field="week_compact_day_header_spacing" data-type="number" type="number" min="0" value="${Number(this._config.week_compact_day_header_spacing ?? this.getEditorDefaultValue('week_compact_day_header_spacing'))}">
        </div>
      </div>
      <div class="field-row week-compact-header-control-row">
        <div class="field field-inline week-compact-header-field week-compact-weekday-color-field">
          <label for="week_compact_weekday_color">Week Compact weekday color</label>
          <div class="week-compact-weekday-color-actions">
            ${this.renderColorInputControl({ id: 'week_compact_weekday_color', field: 'week_compact_weekday_color', value: this.getWeekCompactWeekdayColorPreview() })}
            <button type="button" class="secondary-action week-compact-theme-color-action" data-clear-config-field="week_compact_weekday_color" ${this._config.week_compact_weekday_color ? '' : 'disabled'}>Use theme color</button>
          </div>
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="rolling_days_schedule">Rolling days (schedule view)</label>
          <input id="rolling_days_schedule" data-field="rolling_days_schedule" data-type="nullable-number" type="number" min="1" value="${this._config.rolling_days_schedule ?? ''}" placeholder="Disabled">
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="rolling_days_agenda">Rolling days (agenda view)</label>
          <input id="rolling_days_agenda" data-field="rolling_days_agenda" data-type="nullable-number" type="number" min="1" value="${this._config.rolling_days_agenda ?? ''}" placeholder="Disabled">
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="rolling_weeks">Rolling weeks (month view)</label>
          <input id="rolling_weeks" data-field="rolling_weeks" data-type="nullable-number" type="number" min="1" value="${this._config.rolling_weeks ?? ''}" placeholder="Disabled">
        </div>
      </div>
      <div class="boolean-list">
        <label><input type="checkbox" data-field="compact_height" ${this._config.compact_height ? 'checked' : ''}> Compact height</label>
        <label><input type="checkbox" data-field="compact_width" ${this._config.compact_width ? 'checked' : ''}> Schedule view: compact width columns</label>
        <label><input type="checkbox" data-field="show_week_numbers_month" ${this._config.show_week_numbers_month ? 'checked' : ''}> Month view: show ISO week numbers</label>
        <label><input type="checkbox" data-field="show_all_events_month" ${this._config.show_all_events_month ? 'checked' : ''}> Month view: show all events (override compact height)</label>
        <label><input type="checkbox" data-field="show_all_details_month" ${this._config.show_all_details_month ? 'checked' : ''}> Month view: show all details (week-compact style + override compact height)</label>
        <label><input type="checkbox" data-field="compact_header" ${this._config.compact_header ? 'checked' : ''}> Compact header</label>
        <label><input type="checkbox" data-field="hide_year" ${this._config.hide_year ? 'checked' : ''}> Hide year in header period label</label>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="period_date_format">Header period label: month format</label>
          <select id="period_date_format" data-field="period_date_format">
            <option value="" ${!this._config.period_date_format ? 'selected' : ''}>Default (varies by view)</option>
            <option value="short" ${this._config.period_date_format === 'short' ? 'selected' : ''}>Abbreviated (Sept.)</option>
            <option value="long" ${this._config.period_date_format === 'long' ? 'selected' : ''}>Full text (September)</option>
            <option value="numeric" ${this._config.period_date_format === 'numeric' ? 'selected' : ''}>Numeric (09)</option>
          </select>
        </div>
      </div>
      <div class="boolean-list">
        <label><input type="checkbox" data-field="hide_calendars" ${this._config.hide_calendars ? 'checked' : ''}> Hide calendar badges</label>
        <label><input type="checkbox" data-field="hide_header" ${this._config.hide_header ? 'checked' : ''}> Hide entire header</label>
        <label><input type="checkbox" data-field="hide_calendar_names" ${this._config.hide_calendar_names ? 'checked' : ''}> Header badges: hide calendar names</label>
        <label><input type="checkbox" data-field="hide_controls" ${this._config.hide_controls ? 'checked' : ''}> Hide all header controls</label>
        <label><input type="checkbox" data-field="hide_navigation_buttons" ${this._config.hide_navigation_buttons ? 'checked' : ''}> Hide previous/next and today buttons</label>
        <label><input type="checkbox" data-field="hide_add_event_button" ${this._config.hide_add_event_button ? 'checked' : ''}> Hide add event button</label>
        <label><input type="checkbox" data-field="hide_view_selector" ${this._config.hide_view_selector ? 'checked' : ''}> Hide view selector</label>
        <label><input type="checkbox" data-field="show_dashboard_nav_button" ${this._config.show_dashboard_nav_button ? 'checked' : ''}> Show left dashboard navigation button</label>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="week_number_prefix_mode">Month week-number prefix</label>
          <select id="week_number_prefix_mode" data-field="week_number_prefix_mode">
            <option value="default" ${this.getWeekNumberPrefixMode() === 'default' ? 'selected' : ''}>Localized default</option>
            <option value="number_only" ${this.getWeekNumberPrefixMode() === 'number_only' ? 'selected' : ''}>Number only</option>
            <option value="custom" ${this.getWeekNumberPrefixMode() === 'custom' ? 'selected' : ''}>Custom prefix</option>
          </select>
          ${this.getWeekNumberPrefixMode() === 'custom' ? `
            <input data-field="week_number_prefix" type="text" value="${this.escapeHtml(this._config.week_number_prefix)}" placeholder="Week">
          ` : ''}
          <p class="helper">Choose the localized prefix, the week number alone, or enter a custom prefix.</p>
        </div>
      </div>
      ${this._config.show_dashboard_nav_button ? `
      <div class="field-row">
        ${this.renderHeaderButtonActionControl({
          idPrefix: 'header-dashboard-button',
          mapKey: 'dashboard'
        })}
      </div>
      <div class="field-row">
        ${this.renderHeaderButtonColorControl({
          idPrefix: 'header-dashboard-button',
          mapKey: 'dashboard',
          rawColor: this._config.header_dashboard_button_color
        })}
      </div>
      ` : ''}
      ${this.renderSubSection('Header navigation buttons', this.renderHeaderNavButtonsEditor())}
      ${this._config.compact_height ? '' : `
        <div class="field">
          <label for="height_scale">Height scale</label>
          <input id="height_scale" data-field="height_scale" data-type="number" type="number" min="0.1" step="0.1" value="${Number(this._config.height_scale ?? this.getEditorDefaultValue('height_scale'))}">
        </div>
      `}
    `);

    const colorStylingSection = this.renderSection('Colors & styling', `
      <div class="field">
        <label for="header_color">Header color</label>
        <div class="field-row">
          ${this.renderColorInputControl({ id: 'header_color', field: 'header_color', value: this._config.header_color })}
          <input data-field="header_color_text" data-type="color-text" type="text" value="${this.escapeHtml(this._config.header_color || '')}" placeholder="var(--primary-color) or match-card-background">
        </div>
      </div>
      <div class="field">
        <label for="header_text_color">Header text color</label>
        <div class="field-row">
          ${this.renderColorInputControl({ id: 'header_text_color', field: 'header_text_color', value: this._config.header_text_color })}
          <input data-field="header_text_color_text" data-type="header-text-color-text" type="text" value="${this.escapeHtml(this._config.header_text_color || '')}" placeholder="Auto contrast">
        </div>
      </div>
      <div class="field">
        <label for="grid_color">Grid and divider color</label>
        <div class="field-row">
          ${this.renderColorInputControl({ id: 'grid_color', field: 'grid_color', value: this._config.grid_color })}
          <input data-field="grid_color_text" data-type="grid-color-text" type="text" value="${this.escapeHtml(this._config.grid_color || '')}" placeholder="Theme default">
        </div>
      </div>
      ${this.renderSubSection('Calendar colors', `<div class="map-grid">${this.renderMapRowInputs('colors', { label: 'calendar colors', inputType: 'color' })}</div>`)}
      ${this.renderSubSection('Event font colors', `<div class="map-grid">${this.renderMapRowInputs('event_font_colors', { label: 'event font colors', inputType: 'color' })}</div>`)}
      ${this.renderSubSection('Calendar display names', `<div class="map-grid">${this.renderMapRowInputs('calendar_names', { label: 'calendar names', placeholder: 'Display name' })}</div>`)}
      ${this.renderSubSection('Calendar badge icons', `<div class="map-grid">${this.renderMapRowInputs('calendar_badge_icons', { label: 'badge icons', placeholder: 'mdi:icon or URL' })}</div>`)}
      ${this.renderSubSection('Calendar badge people', `<div class="map-grid">${this.renderMapRowInputs('calendar_person_entities', { label: 'badge people', placeholder: 'person.ian' })}</div>`)}
      <div class="boolean-list">
        <label><input type="checkbox" data-field="header_background_transparent" ${this.normalizeBackgroundOpacity(this._config.header_background_opacity, this._config.header_background_transparent ? 100 : 0) >= 100 ? 'checked' : ''}> Transparent header surfaces</label>
        <label><input type="checkbox" data-field="background_transparent" ${this.normalizeBackgroundOpacity(this._config.background_opacity, this._config.background_transparent ? 100 : 0) >= 100 ? 'checked' : ''}> Transparent background surfaces</label>
        <label><input type="checkbox" data-field="hide_dark_mode_toggle" ${this._config.hide_dark_mode_toggle ? 'checked' : ''}> Hide dark mode toggle</label>
      </div>
      <div class="field">
        <label for="color_scheme">Color scheme</label>
        <select id="color_scheme" data-field="color_scheme">
          <option value="auto">Auto (browser/app)</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
    `);

    const backgroundSection = this.renderSection('Background image', `
      <div class="field field-inline">
        <label for="header_background_opacity">Header opacity</label>
        <input id="header_background_opacity" data-field="header_background_opacity" data-type="number" type="number" min="0" max="100" step="1" value="${Number(this.normalizeBackgroundOpacity(this._config.header_background_opacity, this._config.header_background_transparent ? 100 : 0))}">
      </div>
      <div class="field field-inline">
        <label for="background_opacity">Background opacity</label>
        <input id="background_opacity" data-field="background_opacity" data-type="number" type="number" min="0" max="100" step="1" value="${Number(this.normalizeBackgroundOpacity(this._config.background_opacity, this._config.background_transparent ? 100 : 0))}">
      </div>
      <div class="field field-inline">
        <label for="background_image_url">Background image URL</label>
        <input id="background_image_url" data-field="background_image_url" type="text" value="${this.escapeHtml(this._config.background_image_url || '')}" placeholder="https://... or /media/local/...">
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="background_image_size">Image size</label>
          <input id="background_image_size" data-field="background_image_size" type="text" value="${this._config.background_image_size || 'cover'}" placeholder="cover">
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="background_image_position">Image position</label>
          <input id="background_image_position" data-field="background_image_position" type="text" value="${this._config.background_image_position || 'center'}" placeholder="center">
        </div>
      </div>
      <div class="field field-inline">
        <label for="background_image_repeat">Image repeat</label>
        <input id="background_image_repeat" data-field="background_image_repeat" type="text" value="${this._config.background_image_repeat || 'no-repeat'}" placeholder="no-repeat">
      </div>
    `);

    const eventSection = this.renderSection('Events & schedule', `
      <div class="field-row">
        <div class="field field-inline">
          <label for="month_day_tap_action">Month view: tapping a day</label>
          <select id="month_day_tap_action" data-field="month_day_tap_action">
            <option value="create" ${this._config.month_day_tap_action !== 'show_events' ? 'selected' : ''}>Opens new event (default)</option>
            <option value="show_events" ${this._config.month_day_tap_action === 'show_events' ? 'selected' : ''}>Shows that day's events</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="event_font_size">Event font size</label>
          <input id="event_font_size" data-field="event_font_size" data-type="number" type="number" min="8" max="32" value="${Number(this._config.event_font_size ?? this.getEditorDefaultValue('event_font_size'))}">
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="event_time_font_size">Event time font size</label>
          <input id="event_time_font_size" data-field="event_time_font_size" data-type="number" type="number" min="8" max="32" value="${Number(this._config.event_time_font_size ?? this.getEditorDefaultValue('event_time_font_size'))}">
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="event_location_font_size">Event location font size</label>
          <input id="event_location_font_size" data-field="event_location_font_size" data-type="number" type="number" min="8" max="32" value="${Number(this._config.event_location_font_size ?? this.getEditorDefaultValue('event_location_font_size'))}">
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="event_calendar_bubble_mode">Event calendar bubble</label>
          <select id="event_calendar_bubble_mode" data-field="event_calendar_bubble_mode">
            <option value="icon" ${this.getEventCalendarBubbleMode() === 'icon' ? 'selected' : ''}>Icon</option>
            <option value="friendly_name" ${this.getEventCalendarBubbleMode() === 'friendly_name' ? 'selected' : ''}>Friendly Name</option>
            <option value="none" ${this.getEventCalendarBubbleMode() === 'none' ? 'selected' : ''}>None</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="event_title_prefix">Event title prefix</label>
          <select id="event_title_prefix" data-field="event_title_prefix">
            <option value="none" ${this._config.event_title_prefix === 'none' || !this._config.event_title_prefix ? 'selected' : ''}>None</option>
            <option value="badge_icon" ${this._config.event_title_prefix === 'badge_icon' ? 'selected' : ''}>Calendar Badge Icon</option>
            <option value="friendly_name" ${this._config.event_title_prefix === 'friendly_name' ? 'selected' : ''}>Calendar Friendly Name</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="event_color_mode">Event color style</label>
          <select id="event_color_mode" data-field="event_color_mode">
            <option value="classic" ${this._config.event_color_mode === 'classic' ? 'selected' : ''}>Classic</option>
            <option value="left-neutral" ${this._config.event_color_mode === 'left-neutral' ? 'selected' : ''}>Bar + Neutral</option>
            <option value="left-tint" ${this._config.event_color_mode === 'left-tint' ? 'selected' : ''}>Bar + Tint</option>
          </select>
        </div>
      </div>
      ${this._config.event_color_mode === 'left-neutral' ? `
      <div class="field-row">
        <div class="field field-inline">
          <label for="event_neutral_background">Neutral event background color</label>
          ${this.renderColorInputControl({ id: 'event_neutral_background', field: 'event_neutral_background', value: this._config.event_neutral_background || DEFAULT_EVENT_NEUTRAL_BACKGROUND })}
        </div>
      </div>
      ` : ''}
      ${this._config.event_color_mode === 'left-tint' ? `
      <div class="field-row">
        <div class="field field-inline">
          <label for="event_tint_opacity">Tint opacity</label>
          <input id="event_tint_opacity" data-field="event_tint_opacity" data-type="number" type="number" min="0" max="100" step="1" value="${Number(this._config.event_tint_opacity ?? DEFAULT_EVENT_TINT_OPACITY)}">
        </div>
      </div>
      ` : ''}
      ${this._config.event_color_mode !== 'classic' ? `
      <div class="field-row">
        <div class="field field-inline">
          <label for="event_color_bar_width">Event color bar width (px)</label>
          <input id="event_color_bar_width" data-field="event_color_bar_width" data-type="number" type="number" min="1" value="${Number(this._config.event_color_bar_width ?? this._config.combine_calendars_width ?? DEFAULT_EVENT_COLOR_BAR_WIDTH)}">
        </div>
      </div>
      ` : ''}
      ${this.renderSubSection('Hide times for calendars', `<div class="list-checkbox-grid">${this.renderCalendarListCheckboxes('hide_times_for_calendars', { label: 'hidden times calendars' })}</div>`)}
      <div class="boolean-list">
        <label><input type="checkbox" data-field="show_current_time_bar" ${this._config.show_current_time_bar ? 'checked' : ''}> Show current time bar</label>
        <label><input type="checkbox" data-field="use_24hr_schedule" ${this._config.use_24hr_schedule ? 'checked' : ''}> Use 24-hour schedule time</label>
        <label><input type="checkbox" data-field="shorten_event_times" ${this._config.shorten_event_times ? 'checked' : ''}> Shorten event times</label>
        <label><input type="checkbox" data-field="display_full_weekday_names" ${this._config.display_full_weekday_names ? 'checked' : ''}> Display full weekday names</label>
        <label><input type="checkbox" data-field="show_event_location" ${this._config.show_event_location ? 'checked' : ''}> Show event location</label>
        <label><input type="checkbox" data-field="use_short_location" ${this._config.use_short_location ? 'checked' : ''}> Shorten event location in views</label>
        <label><input type="checkbox" data-field="combine_calendars" ${this._config.combine_calendars ? 'checked' : ''}> Combine duplicate events across calendars</label>
      </div>
      ${(this._config.combine_calendars || (this._config.family_event_rules || []).length > 0) ? `
      <div class="field-row">
        <div class="field field-inline">
          <label for="combine_style">Combined indicator style</label>
          <select id="combine_style" data-field="combine_style">
            <option value="stripes" ${this._config.combine_style === 'stripes' ? 'selected' : ''}>Stripes</option>
            <option value="bars" ${this._config.combine_style === 'bars' || !this._config.combine_style ? 'selected' : ''}>Bars</option>
            <option value="dots" ${this._config.combine_style === 'dots' ? 'selected' : ''}>Dots</option>
          </select>
        </div>
      </div>
      ${this._config.combine_style === 'bars' ? `<label class="checkbox-row"><input type="checkbox" data-field="combine_indicator_gradient" ${this._config.combine_indicator_gradient ? 'checked' : ''}>${this.translateEditorLiteral('Blend colors in the side bars')}</label>` : ''}
      <div class="field-row">
        <label class="field field-inline">${this.translateEditorLiteral('Combined event color')}
          <select data-field="combine_color_mode">
            <option value="calendar" ${this._config.combine_color_mode === 'calendar' ? 'selected' : ''}>${this.translateEditorLiteral('Calendar colors')}</option>
            <option value="solid" ${this._config.combine_color_mode === 'solid' ? 'selected' : ''}>${this.translateEditorLiteral('Single color')}</option>
            <option value="gradient" ${this._config.combine_color_mode === 'gradient' ? 'selected' : ''}>${this.translateEditorLiteral('Gradient from calendar colors')}</option>
          </select>
        </label>
        ${this._config.combine_color_mode === 'solid' ? `<label class="field field-inline">${this.translateEditorLiteral('Color')}<input data-field="combine_color" type="color" value="${this.normalizeHexColor(this._config.combine_color) || '#3B82F6'}"></label>` : ''}
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="combine_calendars_width">Combined indicator width (px)</label>
          <input id="combine_calendars_width" data-field="combine_calendars_width" data-type="number" type="number" min="1" value="${Number(this._config.combine_calendars_width ?? this.getEditorDefaultValue('combine_calendars_width'))}">
        </div>
      </div>
      ` : ''}
      <div class="boolean-list"><label><input type="checkbox" data-field="hide_family_event_prefixes" ${this._config.hide_family_event_prefixes ? 'checked' : ''}> ${this.translateEditorLiteral('Hide processed prefixes in event titles')}</label></div>
      <p class="helper">${this.translateEditorLiteral('Removes the matching marker, such as (P), from the displayed title. The calendar event itself is unchanged.')}</p>
      ${this.renderSubSection('Combined calendar prefix rules', this.renderFamilyEventRulesEditor())}
      ${this.renderSubSection('Event icons', this.renderEventIconsEditor())}
    `);

    const managementSection = this.renderSection('Event management', `
      <div class="boolean-list">
        <label><input type="checkbox" data-field="enable_event_management" ${this._config.enable_event_management !== false ? 'checked' : ''}> Enable event management</label>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="event_modal_size">Event modal size</label>
          <select id="event_modal_size" data-field="event_modal_size">
            <option value="narrow" ${this._config.event_modal_size === 'narrow' ? 'selected' : ''}>Narrow</option>
            <option value="medium" ${this._config.event_modal_size === DEFAULT_EVENT_MODAL_SIZE || !this._config.event_modal_size ? 'selected' : ''}>Medium</option>
            <option value="wide" ${this._config.event_modal_size === 'wide' ? 'selected' : ''}>Wide</option>
            <option value="full" ${this._config.event_modal_size === 'full' ? 'selected' : ''}>Full</option>
          </select>
        </div>
      </div>
      ${this.renderSubSection('Read-only calendars', `<div class="list-checkbox-grid">${this.renderCalendarListCheckboxes('readonly_calendars', { label: 'read-only calendars' })}</div>`)}
      ${this.renderSubSection('Hide calendar badges in all views', `<div class="list-checkbox-grid">${this.renderCalendarListCheckboxes('hide_badge_calendars', { label: 'calendars with hidden badges' })}</div>`)}
      ${this.renderSubSection('Calendars hidden by default', `<div class="list-checkbox-grid">${this.renderCalendarListCheckboxes('default_hidden_calendars', { label: 'calendars hidden by default' })}</div>`)}
      ${this.renderSubSection('Virtual calendars', this.renderVirtualCalendarsEditor())}
    `);

    const localeSection = this.renderSection('Localization & preferences', `
      <div class="field-row">
        <div class="field field-inline">
          <label for="language">Language code</label>
          <input id="language" data-field="language" type="text" value="${this._config.language || ''}" placeholder="en, fr, de...">
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="locale">Locale override</label>
          <input id="locale" data-field="locale" type="text" value="${this._config.locale || ''}" placeholder="en-US">
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="header_time_sensor">Header time sensor</label>
          <input id="header_time_sensor" data-field="header_time_sensor" type="text" value="${this._config.header_time_sensor || ''}" placeholder="sensor.current_time">
        </div>
      </div>
      <div class="field-row">
        <div class="field field-inline">
          <label for="header_weather_sensor">Header weather sensor</label>
          <input id="header_weather_sensor" data-field="header_weather_sensor" type="text" value="${this._config.header_weather_sensor || ''}" placeholder="weather.home">
        </div>
      </div>
      <label class="checkbox-row">
        <input type="checkbox" data-field="show_daily_weather_forecast" ${this._config.show_daily_weather_forecast !== false ? 'checked' : ''}>
        Show daily weather forecasts
      </label>
      <div class="field field-inline">
        <label for="preference_storage_key">Preference storage key</label>
        <input id="preference_storage_key" data-field="preference_storage_key" type="text" value="${this._config.preference_storage_key || ''}" placeholder="Optional custom key">
      </div>
    `);

    const staleResourceDetection = detectStaleFamilyCalendarResource();
    const staleResourceDiagnostics = staleResourceDetection.detected ? `
      <p class="helper"><strong>Old resource detected:</strong> ${this.escapeHtml(staleResourceDetection.staleUrl)}</p>
      <p class="helper">Remove the old resource from Settings → Dashboards → Resources and keep /hacsfiles/family-calendar-card/family-calendar-card.js. HACS showing the latest version confirms the file is installed, but not that this dashboard loaded the current frontend resource.</p>
      <p class="helper"><a href="${STALE_RESOURCE_TROUBLESHOOTING_URL}" target="_blank" rel="noreferrer">Troubleshooting guide</a></p>
    ` : '';

    const diagnosticsSection = this.renderSection('About / Diagnostics', `
      <p class="helper">Family Calendar Card</p>
      <p class="helper">${this.translateEditorLiteral('Loaded version: {version}', { version: this.escapeHtml(getFamilyCalendarCardVersion()) })}</p>
      <p class="helper">Resource file: family-calendar-card.js</p>
      <p class="helper">If this version does not match the version shown in HACS, Home Assistant may be loading a cached or stale resource.</p>
      <div class="diagnostic-action">
        <button type="button" data-event-cache-action="flush">Flush event cache</button>
        <p class="helper">Clears persistent calendar event snapshots only. Hidden calendars and custom event colors are not changed.</p>
        ${this._eventCacheFlushStatus ? `<p class="helper">${this.escapeHtml(this._eventCacheFlushStatus)}</p>` : ''}
      </div>
      ${staleResourceDiagnostics}
    `);

    this.innerHTML = `
      <style>
        .card-config {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 8px 0;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .field.field-inline {
          display: grid;
          grid-template-columns: minmax(180px, 260px) 1fr;
          align-items: center;
          gap: 8px;
        }

        .field-row {
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }

        .family-event-rule {
          display: flex;
          flex-direction: column;
          gap: 10px;
          border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.35));
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 10px;
        }

        .family-event-rule > .field-row:first-child {
          grid-template-columns: 1fr auto;
          align-items: center;
        }

        .field label {
          font-weight: 500;
          color: var(--primary-text-color);
        }

        .field input,
        .field select,
        .field textarea {
          padding: 8px;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          font: inherit;
          color: var(--primary-text-color);
          background: var(--card-background-color);
        }

        .field textarea {
          min-height: 70px;
          resize: vertical;
        }

        .weekday-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 6px;
          align-items: center;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          padding: 8px;
          background: var(--card-background-color);
        }

        .weekday-label {
          text-align: center;
          font-weight: 500;
          color: var(--secondary-text-color);
          font-size: 0.85rem;
        }

        .weekday-checkbox-wrap {
          display: flex;
          justify-content: center;
        }

        .map-grid {
          display: grid;
          gap: 8px;
        }

        .map-row {
          display: grid;
          grid-template-columns: minmax(160px, 220px) 1fr;
          gap: 8px;
          align-items: center;
        }

        .list-checkbox-grid {
          display: grid;
          gap: 8px;
        }

        .list-checkbox-row {
          display: grid;
          grid-template-columns: minmax(160px, 220px) 1fr;
          gap: 8px;
          align-items: center;
          font-weight: 400;
        }

        .list-checkbox-row input[type="checkbox"] {
          justify-self: end;
        }

        .virtual-calendars-editor {
          display: grid;
          gap: 10px;
        }

        .virtual-calendar-card {
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          padding: 10px;
          background: var(--card-background-color);
          display: grid;
          gap: 10px;
        }

        .virtual-calendar-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .virtual-calendar-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .virtual-calendar-actions button,
        .secondary-action {
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          border-radius: 6px;
          padding: 6px 10px;
          cursor: pointer;
          color: var(--primary-text-color);
          font: inherit;
        }

        .virtual-calendar-actions button:disabled {
          cursor: default;
          opacity: 0.45;
        }

        .event-icons-editor,
        .header-nav-buttons-editor {
          display: grid;
          gap: 10px;
        }

        .event-icon-card,
        .header-nav-button-card {
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          padding: 10px;
          background: var(--card-background-color);
          display: grid;
          gap: 10px;
        }

        .event-icon-card-header,
        .header-nav-button-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .event-icon-card-actions,
        .header-nav-button-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .event-icon-card-actions button,
        .header-nav-button-actions button {
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          border-radius: 6px;
          padding: 6px 10px;
          cursor: pointer;
          color: var(--primary-text-color);
          font: inherit;
        }

        .event-icon-card-actions button:disabled,
        .header-nav-button-actions button:disabled {
          cursor: default;
          opacity: 0.45;
        }

        .virtual-calendar-color-row {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 8px;
          align-items: center;
        }

        .virtual-calendar-color-status {
          grid-column: 1 / -1;
          color: var(--secondary-text-color);
          font-size: 0.85rem;
        }

        .virtual-calendar-color-status.no-override {
          font-style: italic;
        }

        .virtual-calendar-entities {
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          padding: 8px;
        }

        .legacy-entity-row {
          color: var(--secondary-text-color);
        }

        .legacy-entity-row em {
          font-size: 0.85rem;
        }

        .validation-message {
          color: var(--error-color, #db4437);
          font-size: 0.85rem;
          margin: 2px 0 0;
        }

        input[aria-invalid="true"] {
          border-color: var(--error-color, #db4437);
        }

        .color-picker-wrap {
          display: inline-flex;
          align-items: center;
        }

        .selected-color-swatch {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          border: 1px solid var(--divider-color);
          background: var(--selected-color);
          cursor: pointer;
          padding: 0;
          display: inline-block;
        }

        .week-compact-header-control-row,
        .week-compact-header-field {
          min-width: 0;
        }

        .field.field-inline.week-compact-header-field {
          grid-template-columns: minmax(0, 1fr) minmax(70px, 110px);
        }

        .week-compact-header-field > label {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .week-compact-header-field input {
          box-sizing: border-box;
          min-width: 0;
          width: 100%;
        }

        .field.field-inline.week-compact-weekday-color-field {
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .week-compact-weekday-color-actions {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          min-width: 0;
          white-space: nowrap;
        }

        .week-compact-theme-color-action {
          padding: 4px 7px;
          font-size: 0.8rem;
          white-space: nowrap;
        }

        .color-picker-dialog {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 1000;
        }

        .color-picker-dialog.show {
          display: block;
        }

        .color-picker-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
        }

        .color-picker-modal {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: min(460px, calc(100vw - 24px));
          background: var(--card-background-color);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 8px 26px rgba(0, 0, 0, 0.25);
          display: grid;
          gap: 12px;
        }

        .map-label {
          font-weight: 500;
          color: var(--primary-text-color);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .config-section {
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          background: color-mix(in srgb, var(--card-background-color) 96%, var(--primary-text-color) 4%);
        }

        .config-section summary {
          cursor: pointer;
          padding: 10px;
          font-weight: 600;
          list-style: none;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .config-section summary::before,
        .config-subsection summary::before {
          content: '›';
          font-size: 1.2rem;
          line-height: 1;
          transform: rotate(0deg);
          transition: transform 120ms ease;
          color: var(--secondary-text-color);
        }

        .config-section[open] > summary::before,
        .config-subsection[open] > summary::before {
          transform: rotate(90deg);
        }

        .config-section summary::-webkit-details-marker {
          display: none;
        }

        .section-content {
          border-top: 1px solid var(--divider-color);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .config-subsection {
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          background: var(--card-background-color);
        }

        .config-subsection summary {
          cursor: pointer;
          padding: 8px 10px;
          font-weight: 600;
          list-style: none;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .config-subsection summary::-webkit-details-marker {
          display: none;
        }

        .subsection-content {
          border-top: 1px solid var(--divider-color);
          padding: 10px;
        }

        .entity-list,
        .boolean-list {
          display: grid;
          gap: 4px;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          padding: 8px;
          background: var(--card-background-color);
        }

        .entity-list {
          max-height: 200px;
          overflow: auto;
        }

        .entity-list label,
        .boolean-list label {
          font-weight: 400;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .helper {
          margin: 0;
          color: var(--secondary-text-color);
          font-size: 0.85rem;
        }
      </style>
      <div class="card-config">
        <div class="field field-inline">
          <label for="title">Title</label>
          <input id="title" data-field="title" type="text" value="${this._config.title || ''}" placeholder="Family Calendar">
        </div>

        <div class="field">
          <label for="default_view">Default view</label>
          <select id="default_view" data-field="default_view">
            <option value="month" ${this.normalizeDefaultViewForEditor(this._config.default_view) === 'month' ? 'selected' : ''}>Month</option>
            <option value="week-compact" ${this.normalizeDefaultViewForEditor(this._config.default_view) === 'week-compact' ? 'selected' : ''}>Week</option>
            <option value="week-standard" ${this.normalizeDefaultViewForEditor(this._config.default_view) === 'week-standard' ? 'selected' : ''}>Schedule</option>
            <option value="agenda" ${this.normalizeDefaultViewForEditor(this._config.default_view) === 'agenda' ? 'selected' : ''}>Agenda</option>
          </select>
        </div>

        <div class="field">
          <label>Calendars</label>
          <div class="entity-list" id="entity-list"></div>
          <p class="helper">Select one or more calendar entities to display.</p>
        </div>

        ${displayLayoutSection}
        ${colorStylingSection}
        ${backgroundSection}
        ${eventSection}
        ${managementSection}
        ${localeSection}
        ${diagnosticsSection}
      </div>
      ${this.renderColorPickerDialog()}
    `;

    this.localizeEditorMarkup();

    this.refreshCalendarEntities();

    this.querySelectorAll('[data-field]:not([data-field="entity"])').forEach((input) => {
      const eventName = input.type === 'text' ? 'input' : 'change';
      input.addEventListener(eventName, (event) => this.handleChange(event));
    });

    this.querySelectorAll('[data-map-field]').forEach((input) => {
      input.addEventListener('change', (event) => this.handleChange(event));
    });

    this.querySelectorAll('[data-list-field]').forEach((input) => {
      input.addEventListener('change', (event) => this.handleChange(event));
    });

    this.querySelectorAll('[data-weekday]').forEach((input) => {
      input.addEventListener('change', (event) => this.handleChange(event));
    });

    this.querySelectorAll('[data-virtual-calendar-action]').forEach((button) => {
      button.addEventListener('click', (event) => this.handleVirtualCalendarAction(event));
    });

    this.querySelectorAll('[data-header-nav-button-action]').forEach((button) => {
      button.addEventListener('click', (event) => this.handleHeaderNavButtonAction(event));
    });

    this.querySelectorAll('[data-header-nav-button-field]').forEach((input) => {
      input.addEventListener('change', (event) => this.handleHeaderNavButtonInput(event));
    });

    this.querySelectorAll('[data-header-button-color-mode]').forEach((select) => {
      select.addEventListener('change', (event) => this.handleHeaderButtonColorModeChange(event));
    });

    this.querySelectorAll('[data-header-button-gradient-calendar]').forEach(input => {
      input.addEventListener('change', event => this.handleHeaderButtonGradientCalendarChange(event));
    });

    this.querySelectorAll('[data-header-button-color-calendar]').forEach((select) => {
      select.addEventListener('change', (event) => this.handleHeaderButtonColorCalendarChange(event));
    });

    this.querySelectorAll('[data-event-icon-action]').forEach((button) => {
      button.addEventListener('click', (event) => this.handleEventIconAction(event));
    });

    this.querySelectorAll('[data-event-icon-field]').forEach((input) => {
      input.addEventListener('change', (event) => this.handleEventIconFieldChange(event));
    });

    this.querySelectorAll('[data-family-rule-action]').forEach((button) => {
      button.addEventListener('click', (event) => this.handleFamilyRuleAction(event));
    });
    this.querySelectorAll('[data-family-rule-field]').forEach((input) => {
      const hasLiveInput = ['text', 'number', 'color'].includes(input.type);
      if (hasLiveInput) input.addEventListener('input', (event) => this.handleFamilyRuleInput(event));
      input.addEventListener('change', (event) => this.handleFamilyRuleInput(event));
    });
    this.querySelectorAll('[data-family-rule-calendar]').forEach((input) => {
      input.addEventListener('change', (event) => this.handleFamilyRuleInput(event));
    });

    this.querySelectorAll('[data-header-button-action-mode]').forEach((select) => {
      select.addEventListener('change', (event) => this.handleHeaderButtonActionModeChange(event));
    });

    this.querySelectorAll('[data-header-button-action-dashboard]').forEach((select) => {
      select.addEventListener('change', (event) => this.handleHeaderButtonActionDashboardChange(event));
    });

    this.querySelectorAll('[data-header-button-action-path]').forEach((input) => {
      input.addEventListener('change', (event) => this.handleHeaderButtonActionPathChange(event));
    });

    this.querySelectorAll('[data-header-button-action-url]').forEach((input) => {
      input.addEventListener('change', (event) => this.handleHeaderButtonActionUrlChange(event));
    });

    this.querySelectorAll('[data-header-button-action-service]').forEach((input) => {
      input.addEventListener('change', (event) => this.handleHeaderButtonActionServiceChange(event));
    });

    this.querySelectorAll('[data-header-button-action-service-data]').forEach((textarea) => {
      textarea.addEventListener('change', (event) => this.handleHeaderButtonActionServiceDataChange(event));
    });

    this.querySelectorAll('[data-header-button-action-event-type]').forEach((input) => {
      input.addEventListener('change', (event) => this.handleHeaderButtonActionEventTypeChange(event));
    });

    this.querySelectorAll('[data-header-button-action-event-data]').forEach((textarea) => {
      textarea.addEventListener('change', (event) => this.handleHeaderButtonActionEventDataChange(event));
    });

    this.querySelectorAll('[data-event-cache-action="flush"]').forEach((button) => {
      button.addEventListener('click', () => this.handleFlushEventCache());
    });

    this.querySelectorAll('[data-virtual-calendar-field]').forEach((input) => {
      input.addEventListener('change', (event) => this.handleVirtualCalendarInput(event));
    });

    this.querySelectorAll('[data-virtual-calendar-entity]').forEach((input) => {
      input.addEventListener('change', (event) => this.handleVirtualCalendarEntityChange(event));
    });

    this.querySelectorAll('[data-color-trigger]').forEach((trigger) => {
      trigger.addEventListener('click', () => this.openColorPicker(trigger.dataset.colorField, trigger.dataset.colorMapKey || null));
    });

    this.querySelectorAll('[data-clear-config-field]').forEach((button) => {
      button.addEventListener('click', () => this.clearConfigField(button.dataset.clearConfigField));
    });

    const picker = this.querySelector('family-color-picker');
    if (picker) {
      picker.addEventListener('color-change', (event) => {
        this._colorPickerState.color = event.detail.color;
      });
      picker.addEventListener('color-cancel', () => this.closeColorPicker());
      picker.addEventListener('color-confirm', (event) => this.applyColorPickerColor(event.detail.color));
    }

    this.querySelectorAll('[data-close-color-picker]').forEach((button) => {
      button.addEventListener('click', () => this.closeColorPicker());
    });

    this._rendered = true;
  }

  async handleFlushEventCache() {
    const cleared = await clearAllEventCacheSnapshots();
    this._eventCacheFlushStatus = cleared
      ? 'Event cache cleared. The card will load fresh calendar data.'
      : 'Event cache is unavailable or could not be cleared; normal loading is unaffected.';
    window.dispatchEvent(new CustomEvent('family-calendar-card-flush-event-cache'));
    this.render();
  }

  clearConfigField(field) {
    if (!field || !Object.hasOwn(this._config, field)) return;
    const nextConfig = { ...this.value };
    delete nextConfig[field];
    this.emitConfigChanged(nextConfig);
    this.render();
  }

  refreshCalendarEntities() {
    const entityListContainer = this.querySelector('#entity-list');
    if (!entityListContainer) return;

    const calendarEntities = this.getCalendarEntities();
    const nextKey = calendarEntities.join('|');

    if (this._lastCalendarEntitiesKey === nextKey && entityListContainer.childElementCount > 0) {
      const selectedEntities = new Set(this._config.entities || []);
      entityListContainer.querySelectorAll('input[data-field="entity"]').forEach((checkbox) => {
        checkbox.checked = selectedEntities.has(checkbox.value);
      });
      return;
    }

    this._lastCalendarEntitiesKey = nextKey;
    const selectedEntities = new Set(this._config.entities || []);

    if (calendarEntities.length === 0) {
      entityListContainer.innerHTML = '<p class="helper">No calendar entities found yet.</p>';
      return;
    }

    entityListContainer.innerHTML = calendarEntities
      .map((entityId) => {
        const friendlyName = this._hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
        const checked = selectedEntities.has(entityId) ? 'checked' : '';
        return `<label><input type="checkbox" data-field="entity" value="${entityId}" ${checked}> ${friendlyName}</label>`;
      })
      .join('');

    entityListContainer.querySelectorAll('input[data-field="entity"]').forEach((input) => {
      input.addEventListener('change', (event) => this.handleChange(event));
    });
  }

  updateFieldValues() {
    const titleInput = this.querySelector('input[data-field="title"]');
    if (titleInput && document.activeElement !== titleInput) {
      titleInput.value = this._config.title || '';
    }

    const defaultView = this.querySelector('select[data-field="default_view"]');
    if (defaultView && document.activeElement !== defaultView) {
      defaultView.value = this.normalizeDefaultViewForEditor(this._config.default_view);
    }

    const firstDayOfWeek = this.querySelector('select[data-field="first_day_of_week"]');
    if (firstDayOfWeek && document.activeElement !== firstDayOfWeek) {
      firstDayOfWeek.value = String(Number(this._config.first_day_of_week ?? 0));
    }

    this.querySelectorAll('input[type="checkbox"][data-field]').forEach((checkbox) => {
      if (checkbox.dataset.field === 'enable_event_management' || checkbox.dataset.field === 'show_daily_weather_forecast') {
        checkbox.checked = this._config[checkbox.dataset.field] !== false;
        return;
      }
      checkbox.checked = !!this._config[checkbox.dataset.field];
    });

    this.querySelectorAll('input[type="checkbox"][data-list-field]').forEach((checkbox) => {
      const listField = checkbox.dataset.listField;
      checkbox.checked = this.getListFieldValue(listField).includes(checkbox.value);
    });

    this.querySelectorAll('input[data-type="number"], input[data-type="nullable-number"], input[data-type="list"], input[data-field="language"], input[data-field="locale"], input[data-field="header_time_sensor"], input[data-field="header_weather_sensor"], input[data-field="preference_storage_key"], input[data-field="background_image_url"], input[data-field="background_image_size"], input[data-field="background_image_position"], input[data-field="background_image_repeat"]').forEach((input) => {
      if (document.activeElement === input) return;
      const field = input.dataset.field;
      const type = input.dataset.type;
      if (type === 'list') input.value = this.getListInputValue(field);
      else if (type === 'nullable-number') input.value = this._config[field] ?? '';
      else if (type === 'number') input.value = Number(this._config[field] ?? this.getEditorDefaultValue(field));
      else input.value = this._config[field] || '';
    });

    this.querySelectorAll('input[type="checkbox"][data-weekday]').forEach((checkbox) => {
      const weekday = Number(checkbox.dataset.weekday);
      checkbox.checked = this.getListFieldValue('week_days').includes(weekday);
    });

    this.querySelectorAll('select[data-field]').forEach((select) => {
      if (document.activeElement === select) return;
      const field = select.dataset.field;
      if (field === 'default_view') return;
      if (field === 'first_day_of_week') return;
      if (field === 'week_number_prefix_mode') {
        select.value = this.getWeekNumberPrefixMode();
        return;
      }
      if (field === 'event_calendar_bubble_mode') {
        select.value = this.getEventCalendarBubbleMode();
        return;
      }

      if (field === 'combine_background_mode') {
        select.value = this._combineBackgroundMode;
        return;
      }
      select.value = this._config[field] || '';
    });

    const combineBackgroundHexInput = this.querySelector('input[data-field="combine_background_hex"]');
    if (combineBackgroundHexInput && document.activeElement !== combineBackgroundHexInput) {
      combineBackgroundHexInput.value = this._combineBackgroundHexDraft || '#FFFFFF';
    }

    const headerColorTextInput = this.querySelector('input[data-field="header_color_text"]');
    if (headerColorTextInput && document.activeElement !== headerColorTextInput) {
      headerColorTextInput.value = this._config.header_color || '';
    }

    const headerTextColorTextInput = this.querySelector('input[data-field="header_text_color_text"]');
    if (headerTextColorTextInput && document.activeElement !== headerTextColorTextInput) {
      headerTextColorTextInput.value = this._config.header_text_color || '';
    }

    const gridColorTextInput = this.querySelector('input[data-field="grid_color_text"]');
    if (gridColorTextInput && document.activeElement !== gridColorTextInput) {
      gridColorTextInput.value = this._config.grid_color || '';
    }

    this.querySelectorAll('[data-map-field]').forEach((input) => {
      if (document.activeElement === input) return;
      const mapField = input.dataset.mapField;
      const mapKey = input.dataset.mapKey;
      const value = this.getMapFieldValue(mapField)[mapKey] || '';
      input.value = value;
    });

    this.querySelectorAll('[data-virtual-calendar-field]').forEach((input) => {
      if (document.activeElement === input) return;
      const index = Number(input.dataset.virtualCalendarIndex);
      const field = input.dataset.virtualCalendarField;
      const virtualCalendar = this.getVirtualCalendarsForEditor()[index] || {};
      input.value = virtualCalendar[field] || '';
    });

    this.querySelectorAll('[data-header-nav-button-field]').forEach((input) => {
      if (document.activeElement === input) return;
      const index = Number(input.dataset.headerNavButtonIndex);
      const field = input.dataset.headerNavButtonField;
      const headerNavButton = this.getHeaderNavButtonsForEditor()[index] || {};
      input.value = headerNavButton[field] || '';
    });

    this.querySelectorAll('[data-virtual-calendar-entity]').forEach((checkbox) => {
      const index = Number(checkbox.dataset.virtualCalendarIndex);
      const virtualCalendar = this.getVirtualCalendarsForEditor()[index] || {};
      const entities = Array.isArray(virtualCalendar.entities) ? virtualCalendar.entities : [];
      checkbox.checked = entities.includes(checkbox.value);
    });

    this.querySelectorAll('.selected-color-swatch').forEach((swatch) => {
      const field = swatch.dataset.colorField;
      const mapKey = swatch.dataset.colorMapKey || null;
      const nextColor = this.getColorValue(field, mapKey);
      swatch.style.setProperty('--selected-color', nextColor);
    });

    this.querySelectorAll('[data-clear-config-field]').forEach((button) => {
      button.disabled = !this._config[button.dataset.clearConfigField];
    });

    this.refreshCalendarEntities();
  }

  parseList(value, { asNumbers = false } = {}) {
    const parsed = String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!asNumbers) return parsed;
    return parsed
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }

  handleChange(event) {
    const field = event.target.dataset.field;
    const nextConfig = { ...this.value };

    if (field === 'week_number_prefix_mode') {
      if (event.target.value === 'default') delete nextConfig.week_number_prefix;
      else if (event.target.value === 'number_only') nextConfig.week_number_prefix = '';
      else nextConfig.week_number_prefix = typeof this._config.week_number_prefix === 'string' && this._config.week_number_prefix ? this._config.week_number_prefix : 'Week';
      this.emitConfigChanged(nextConfig);
      this.render();
      return;
    }

    if (field === 'event_calendar_bubble_mode') {
      const selectedMode = event.target.value;
      if (selectedMode === 'friendly_name') {
        nextConfig.event_calendar_friendly_name = true;
        nextConfig.hide_event_calendar_bubble = false;
      } else if (selectedMode === 'none') {
        nextConfig.event_calendar_friendly_name = false;
        nextConfig.hide_event_calendar_bubble = true;
      } else {
        nextConfig.event_calendar_friendly_name = false;
        nextConfig.hide_event_calendar_bubble = false;
      }

      this._config = nextConfig;
      this.dispatchEvent(
        new CustomEvent('config-changed', {
          detail: { config: nextConfig },
          bubbles: true,
          composed: true
        })
      );
      return;
    }

    if (field === 'combine_background_mode') {
      this._combineBackgroundMode = event.target.value;
      if (this._combineBackgroundMode === 'hex') {
        const currentHex = this.normalizeHexColor(this._config.combine_background) || this._combineBackgroundHexDraft || '#FFFFFF';
        this._combineBackgroundHexDraft = currentHex;
        nextConfig.combine_background = currentHex;
      } else {
        this._combineBackgroundHexDraft = '';
        nextConfig.combine_background = this._combineBackgroundMode;
      }

      this._config = nextConfig;
      this.render();
      this.dispatchEvent(
        new CustomEvent('config-changed', {
          detail: { config: nextConfig },
          bubbles: true,
          composed: true
        })
      );
      return;
    }

    if (field === 'combine_color_mode') {
      nextConfig.combine_color_mode = ['calendar', 'solid', 'gradient'].includes(event.target.value) ? event.target.value : 'calendar';
      this._config = nextConfig;
      this.render();
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: nextConfig }, bubbles: true, composed: true }));
      return;
    }

    if (field === 'combine_background_hex') {
      const normalizedHex = this.normalizeHexColor(event.target.value);
      if (normalizedHex) {
        this._combineBackgroundHexDraft = normalizedHex;
        nextConfig.combine_background = normalizedHex;
      } else {
        this._combineBackgroundHexDraft = event.target.value;
      }

      this._config = nextConfig;
      this.render();
      this.dispatchEvent(
        new CustomEvent('config-changed', {
          detail: { config: nextConfig },
          bubbles: true,
          composed: true
        })
      );
      return;
    }

    if (field === 'entity') {
      const selected = Array.from(this.querySelectorAll('input[data-field="entity"]:checked')).map((input) => input.value);
      nextConfig.entities = selected;
      this._config = nextConfig;
      this.render();
      this.dispatchEvent(
        new CustomEvent('config-changed', {
          detail: { config: nextConfig },
          bubbles: true,
          composed: true
        })
      );
      return;
    } else if (event.target.dataset.mapField) {
      const mapField = event.target.dataset.mapField;
      const mapKey = event.target.dataset.mapKey;
      const mapValue = { ...this.getMapFieldValue(mapField) };
      const nextValue = event.target.value;
      if (nextValue === '') delete mapValue[mapKey];
      else mapValue[mapKey] = nextValue;
      nextConfig[mapField] = mapValue;
    } else if (event.target.dataset.listField) {
      const listField = event.target.dataset.listField;
      const checkedValues = Array.from(this.querySelectorAll(`input[data-list-field="${listField}"]:checked`)).map((input) => input.value);
      nextConfig[listField] = checkedValues;
    } else if (event.target.dataset.weekday !== undefined) {
      const selectedWeekdays = Array.from(this.querySelectorAll('input[data-weekday]:checked'))
        .map((input) => Number(input.dataset.weekday))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);
      nextConfig.week_days = selectedWeekdays;
    } else if (event.target.type === 'checkbox') {
      nextConfig[field] = event.target.checked;
      if (field === 'background_transparent') {
        nextConfig.background_opacity = event.target.checked ? 100 : 0;
      } else if (field === 'header_background_transparent') {
        nextConfig.header_background_opacity = event.target.checked ? 100 : 0;
      }
      if (field === 'compact_height' || field === 'combine_calendars' || field === 'show_dashboard_nav_button') {
        this._config = nextConfig;
        this.render();
        this.dispatchEvent(
          new CustomEvent('config-changed', {
            detail: { config: nextConfig },
            bubbles: true,
            composed: true
          })
        );
        return;
      }
    } else if (event.target.dataset.type === 'color') {
      nextConfig[field] = event.target.value;
    } else if (event.target.dataset.type === 'color-text') {
      nextConfig.header_color = event.target.value;
    } else if (event.target.dataset.type === 'header-text-color-text') {
      nextConfig.header_text_color = event.target.value;
    } else if (event.target.dataset.type === 'grid-color-text') {
      nextConfig.grid_color = event.target.value;
    } else if (event.target.dataset.type === 'number') {
      if (event.target.value === '') {
        nextConfig[field] = this.getEditorDefaultValue(field);
        if (field === 'background_opacity') {
          nextConfig.background_transparent = false;
        }
        if (field === 'header_background_opacity') {
          nextConfig.header_background_transparent = false;
        }
      } else {
        const numericValue = Number(event.target.value);
        const parsedValue = Number.isFinite(numericValue) ? numericValue : this.getEditorDefaultValue(field);
        if (field === 'week_start_hour' || field === 'week_end_hour') {
          nextConfig[field] = Math.min(23, Math.max(0, parsedValue));
        } else if (field === 'header_background_opacity') {
          nextConfig.header_background_opacity = this.normalizeBackgroundOpacity(parsedValue, 0);
          nextConfig.header_background_transparent = nextConfig.header_background_opacity >= 100;
        } else if (field === 'background_opacity') {
          nextConfig.background_opacity = this.normalizeBackgroundOpacity(parsedValue, 0);
          nextConfig.background_transparent = nextConfig.background_opacity >= 100;
        } else if (field === 'event_tint_opacity') {
          nextConfig.event_tint_opacity = this.normalizeBackgroundOpacity(parsedValue, DEFAULT_EVENT_TINT_OPACITY);
        } else {
          nextConfig[field] = parsedValue;
        }
      }
    } else if (event.target.dataset.type === 'nullable-number') {
      if (event.target.value === '') {
        nextConfig[field] = null;
      } else {
        const numericValue = Number(event.target.value);
        nextConfig[field] = Number.isFinite(numericValue) ? numericValue : null;
      }
    } else if (event.target.dataset.type === 'list') {
      nextConfig[field] = this.parseList(event.target.value);
    } else {
      nextConfig[field] = event.target.value;
      if (field === 'event_color_mode' || field === 'past_event_mode') {
        this._config = nextConfig;
        this.render();
        this.dispatchEvent(
          new CustomEvent('config-changed', {
            detail: { config: nextConfig },
            bubbles: true,
            composed: true
          })
        );
        return;
      }
    }

    this._config = nextConfig;
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: nextConfig },
        bubbles: true,
        composed: true
      })
    );
  }
}

export class LegacyFamilyCalendarCardEditor extends FamilyCalendarCardEditor {}

export function registerFamilyCalendarCardEditor() {
  customElements.define('family-calendar-card-editor', FamilyCalendarCardEditor);
  customElements.define('family-calendar-card-legacy-editor', LegacyFamilyCalendarCardEditor);
}

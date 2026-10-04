// Helpers behind the visual editor's "Event icons" list.
//
// An "icon rule" is an ordinary event_styles entry of one specific, simple
// shape: match one or more keywords in the title, then attach an icon. The editor only
// ever reads, writes, reorders, or removes rules of exactly that shape;
// every other event_styles rule (colors, hide, complex matches, ...) is left
// completely untouched, in place, so YAML-authored rules survive editing.

export const ICON_POSITIONS = ['before_title', 'corner'];
export const DEFAULT_ICON_POSITION = 'before_title';

const ICON_STYLE_KEYS = ['icon', 'icon_position', 'icon_color', 'icon_size', 'hide_event_calendar_bubble'];
const PASSTHROUGH_RULE_KEYS = ['priority', 'id'];
const ALLOWED_RULE_KEYS = ['match', 'style', ...PASSTHROUGH_RULE_KEYS];

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasOnlyKeys = (object, allowedKeys) => Object.keys(object).every((key) => allowedKeys.includes(key));

// Returns the plain keyword a title condition stands for, or null when the
// condition is anything richer (exact match, regex, ...) that the simple list
// cannot represent without changing its meaning.
export function readTitleKeyword(titleCondition) {
  if (typeof titleCondition === 'string') {
    const trimmed = titleCondition.trim();
    if (!trimmed) return '';
    if (/^regex:/i.test(trimmed) || /^\/.+\/[dgimsuvy]*$/.test(trimmed) || /^exact:/i.test(trimmed)) return null;
    const contains = trimmed.match(/^(?:contains|substring):(.*)$/i);
    return contains ? contains[1].trim() : trimmed;
  }

  if (isPlainObject(titleCondition)) {
    const keys = Object.keys(titleCondition);
    if (keys.length !== 1 || (keys[0] !== 'contains' && keys[0] !== 'substring')) return null;
    return typeof titleCondition[keys[0]] === 'string' ? titleCondition[keys[0]].trim() : null;
  }

  return null;
}

// Parses one event_styles entry as an icon rule. Returns null when the rule is
// not of the simple shape (so the editor leaves it alone).
export function parseIconRule(rule) {
  if (!isPlainObject(rule) || !hasOnlyKeys(rule, ALLOWED_RULE_KEYS)) return null;
  if (!isPlainObject(rule.match) || !hasOnlyKeys(rule.match, ['title', 'any'])) return null;
  if (!isPlainObject(rule.style) || !hasOnlyKeys(rule.style, ICON_STYLE_KEYS)) return null;

  // An empty keyword would match every event, so such a rule is not a "simple" one either.
  let keywords;
  if (Array.isArray(rule.match.any) && !rule.match.title) {
    keywords = rule.match.any.map((condition) => {
      if (!isPlainObject(condition) || !hasOnlyKeys(condition, ['title'])) return null;
      const conditionValue = condition.title;
      if (!isPlainObject(conditionValue) || !hasOnlyKeys(conditionValue, ['contains'])) return null;
      return typeof conditionValue.contains === 'string' ? conditionValue.contains.trim() : null;
    });
    if (!keywords.length || keywords.some((keyword) => !keyword)) return null;
  } else {
    const keyword = readTitleKeyword(rule.match.title);
    if (!keyword) return null;
    keywords = [keyword];
  }

  const { icon, icon_position: position, icon_color: color, icon_size: size, hide_event_calendar_bubble: hideDot } = rule.style;
  if (typeof icon !== 'string' || !icon.trim()) return null;
  if (position !== undefined && !ICON_POSITIONS.includes(position)) return null;
  if (color !== undefined && typeof color !== 'string') return null;
  if (size !== undefined && typeof size !== 'number' && typeof size !== 'string') return null;
  if (hideDot !== undefined && typeof hideDot !== 'boolean') return null;

  return {
    keyword: keywords.join(', '),
    icon: icon.trim(),
    position: position || DEFAULT_ICON_POSITION,
    color: color ? color.trim() : '',
    size: size === undefined ? '' : String(size),
    hideCalendarDot: hideDot === true
  };
}

// An icon rule only takes effect once both parts exist. A rule with an empty
// keyword would match every event, so incomplete rows must never be written.
export function isCompleteIconFields(fields) {
  return !!String(fields?.keyword ?? '').trim() && !!String(fields?.icon ?? '').trim();
}

// Free-text size: plain numbers are stored as numbers (pixels), anything else
// (e.g. "1.1em") stays a CSS length string.
function normalizeSize(size) {
  const trimmed = String(size ?? '').trim();
  if (!trimmed) return undefined;
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed;
}

// Builds the event_styles entry for the given fields. `existingRule` (when
// editing) supplies pass-through keys such as priority and id.
export function buildIconRule(fields, existingRule = null) {
  const style = { icon: String(fields.icon).trim(), icon_position: ICON_POSITIONS.includes(fields.position) ? fields.position : DEFAULT_ICON_POSITION };
  const color = String(fields.color ?? '').trim();
  if (color) style.icon_color = color;
  const size = normalizeSize(fields.size);
  if (size !== undefined) style.icon_size = size;
  if (fields.hideCalendarDot) style.hide_event_calendar_bubble = true;

  const rule = {};
  PASSTHROUGH_RULE_KEYS.forEach((key) => {
    if (isPlainObject(existingRule) && existingRule[key] !== undefined) rule[key] = existingRule[key];
  });
  const keywords = String(fields.keyword).split(/[\n,;]+/).map((keyword) => keyword.trim()).filter(Boolean);
  rule.match = keywords.length > 1
    ? { any: keywords.map((keyword) => ({ title: { contains: keyword } })) }
    : { title: { contains: keywords[0] || '' } };
  rule.style = style;
  return rule;
}

// [{ index, ...fields }] for every simple icon rule, in event_styles order.
export function listIconRules(eventStyles) {
  if (!Array.isArray(eventStyles)) return [];
  return eventStyles
    .map((rule, index) => ({ index, fields: parseIconRule(rule) }))
    .filter((entry) => entry.fields)
    .map(({ index, fields }) => ({ index, ...fields }));
}

export function countOtherRules(eventStyles) {
  if (!Array.isArray(eventStyles)) return 0;
  return eventStyles.filter((rule) => !parseIconRule(rule)).length;
}

export function appendIconRule(eventStyles, fields) {
  return [...(Array.isArray(eventStyles) ? eventStyles : []), buildIconRule(fields)];
}

export function replaceIconRule(eventStyles, index, fields) {
  const next = [...eventStyles];
  next[index] = buildIconRule(fields, eventStyles[index]);
  return next;
}

export function removeRuleAt(eventStyles, index) {
  return eventStyles.filter((_, ruleIndex) => ruleIndex !== index);
}

// Swaps an icon rule with its neighbouring icon rule (order decides which icon
// wins when two rules match one event). Other rules keep their exact positions.
export function moveIconRule(eventStyles, index, direction) {
  const iconIndexes = listIconRules(eventStyles).map((entry) => entry.index);
  const position = iconIndexes.indexOf(index);
  const targetPosition = position + direction;
  if (position === -1 || targetPosition < 0 || targetPosition >= iconIndexes.length) return eventStyles;

  const next = [...eventStyles];
  const targetIndex = iconIndexes[targetPosition];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

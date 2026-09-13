export const SHARE_PREFIX = 'codex-theme-v1:';
export const CODE_THEME_ID = 'codex';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const VARIANTS = new Set(['light', 'dark']);
const CODE_THEME_IDS = new Set(['codex']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertColor(value, field) {
  assert(typeof value === 'string' && HEX_COLOR.test(value), `${field} must be a six-digit hex color`);
}

export function validateThemeDefinition(definition) {
  assert(definition && typeof definition === 'object', 'theme definition must be an object');
  for (const field of ['id', 'name', 'variant', 'accent', 'surface', 'ink', 'skill', 'diffAdded', 'diffRemoved']) {
    assert(typeof definition[field] === 'string' && definition[field].length > 0, `${field} is required`);
  }
  assert(VARIANTS.has(definition.variant), `variant must be light or dark`);
  for (const field of ['accent', 'surface', 'ink', 'skill', 'diffAdded', 'diffRemoved']) {
    assertColor(definition[field], field);
  }
  assert(Number.isInteger(definition.contrast) && definition.contrast >= 0 && definition.contrast <= 100, 'contrast must be an integer from 0 to 100');
  assert(definition.fonts && typeof definition.fonts === 'object', 'fonts is required');
  assert(definition.fonts.ui === 'Arial', 'fonts.ui must be Arial');
  assert(definition.fonts.content === 'Arial', 'fonts.content must be Arial');
  assert(definition.fonts.code === null, 'fonts.code must be null to keep the system code font');
  return definition;
}

export function toThemePayload(definition) {
  validateThemeDefinition(definition);
  return {
    codeThemeId: CODE_THEME_ID,
    theme: {
      accent: definition.accent,
      accentSource: 'custom',
      contrast: definition.contrast,
      fonts: {
        code: definition.fonts.code,
        content: definition.fonts.content,
        ui: definition.fonts.ui,
      },
      ink: definition.ink,
      opaqueWindows: true,
      semanticColors: {
        diffAdded: definition.diffAdded,
        diffRemoved: definition.diffRemoved,
        skill: definition.skill,
      },
      surface: definition.surface,
    },
    variant: definition.variant,
  };
}

export function serializeTheme(definition) {
  return `${SHARE_PREFIX}${JSON.stringify(toThemePayload(definition))}`;
}

export function parseShareString(value) {
  assert(typeof value === 'string' && value.startsWith(SHARE_PREFIX), 'theme share must use the codex-theme-v1: prefix');
  let payload;
  try {
    payload = JSON.parse(value.slice(SHARE_PREFIX.length));
  } catch (error) {
    throw new Error(`theme share contains invalid JSON: ${error.message}`);
  }
  assert(payload && typeof payload === 'object', 'theme share payload must be an object');
  assert(CODE_THEME_IDS.has(payload.codeThemeId), `unsupported codeThemeId: ${payload.codeThemeId}`);
  assert(VARIANTS.has(payload.variant), 'variant must be light or dark');
  const theme = payload.theme;
  assert(theme && typeof theme === 'object', 'theme payload is required');
  for (const field of ['accent', 'ink', 'surface']) assertColor(theme[field], `theme.${field}`);
  assert(theme.accentSource === 'custom', 'theme.accentSource must be custom');
  assert(Number.isInteger(theme.contrast) && theme.contrast >= 0 && theme.contrast <= 100, 'theme.contrast must be an integer from 0 to 100');
  assert(theme.opaqueWindows === true, 'theme.opaqueWindows must be true');
  assert(theme.fonts && theme.fonts.ui === 'Arial' && theme.fonts.content === 'Arial' && theme.fonts.code === null, 'theme.fonts must use Arial UI/content and the system code font');
  assert(theme.semanticColors && typeof theme.semanticColors === 'object', 'theme.semanticColors is required');
  for (const field of ['diffAdded', 'diffRemoved', 'skill']) assertColor(theme.semanticColors[field], `theme.semanticColors.${field}`);
  return payload;
}

function channelToLinear(channel) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex) {
  assertColor(hex, 'color');
  const red = channelToLinear(Number.parseInt(hex.slice(1, 3), 16));
  const green = channelToLinear(Number.parseInt(hex.slice(3, 5), 16));
  const blue = channelToLinear(Number.parseInt(hex.slice(5, 7), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first, second) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

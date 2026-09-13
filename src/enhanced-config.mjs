export const enhancedConfigSchemaVersion = 1;

export const DEFAULT_ENHANCED_CONFIG = Object.freeze({
  schemaVersion: enhancedConfigSchemaVersion,
  enabled: true,
  palette: 'valley-yellow',
  corner: 'square',
  interactions: true,
  contour: Object.freeze({
    enabled: true,
    animated: true,
    fps: 24,
    speed: 1,
    pauseOnScroll: true,
  }),
  watermark: Object.freeze({
    enabled: true,
    persistent: true,
  }),
  loader: Object.freeze({
    mode: 'first-launch',
  }),
  taskPlate: Object.freeze({
    start: false,
    complete: true,
    animation: true,
    durationMs: 3000,
  }),
});

const PALETTES = new Set(['valley-yellow', 'wuling-cyan']);
const CORNERS = new Set(['square', 'rounded']);
const LOADER_MODES = new Set(['off', 'first-launch', 'always']);

function boolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function enumValue(value, values, fallback) {
  return typeof value === 'string' && values.has(value) ? value : fallback;
}

function numberInRange(value, fallback, min, max) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

export function normalizeEnhancedConfig(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const contour = source.contour && typeof source.contour === 'object' ? source.contour : {};
  const watermark = source.watermark && typeof source.watermark === 'object' ? source.watermark : {};
  const loader = source.loader && typeof source.loader === 'object' ? source.loader : {};
  const taskPlate = source.taskPlate && typeof source.taskPlate === 'object' ? source.taskPlate : {};

  return {
    schemaVersion: enhancedConfigSchemaVersion,
    enabled: boolean(source.enabled, DEFAULT_ENHANCED_CONFIG.enabled),
    palette: enumValue(source.palette, PALETTES, DEFAULT_ENHANCED_CONFIG.palette),
    corner: enumValue(source.corner, CORNERS, DEFAULT_ENHANCED_CONFIG.corner),
    interactions: boolean(source.interactions, DEFAULT_ENHANCED_CONFIG.interactions),
    contour: {
      enabled: boolean(contour.enabled, DEFAULT_ENHANCED_CONFIG.contour.enabled),
      animated: boolean(contour.animated, DEFAULT_ENHANCED_CONFIG.contour.animated),
      fps: numberInRange(contour.fps, DEFAULT_ENHANCED_CONFIG.contour.fps, 1, 60),
      speed: numberInRange(contour.speed, DEFAULT_ENHANCED_CONFIG.contour.speed, 1, 4),
      pauseOnScroll: boolean(contour.pauseOnScroll, DEFAULT_ENHANCED_CONFIG.contour.pauseOnScroll),
    },
    watermark: {
      enabled: boolean(watermark.enabled, DEFAULT_ENHANCED_CONFIG.watermark.enabled),
      persistent: boolean(watermark.persistent, DEFAULT_ENHANCED_CONFIG.watermark.persistent),
    },
    loader: {
      mode: enumValue(loader.mode, LOADER_MODES, DEFAULT_ENHANCED_CONFIG.loader.mode),
    },
    taskPlate: {
      start: boolean(taskPlate.start, DEFAULT_ENHANCED_CONFIG.taskPlate.start),
      complete: boolean(taskPlate.complete, DEFAULT_ENHANCED_CONFIG.taskPlate.complete),
      animation: boolean(taskPlate.animation, DEFAULT_ENHANCED_CONFIG.taskPlate.animation),
      durationMs: numberInRange(taskPlate.durationMs, DEFAULT_ENHANCED_CONFIG.taskPlate.durationMs, 1000, 10000),
    },
  };
}

export function taskAnnouncement(status) {
  return {
    completed: '任务完成',
    failed: '任务失败',
    interrupted: '任务中止',
  }[status] ?? null;
}

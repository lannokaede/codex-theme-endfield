import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ENHANCED_CONFIG,
  enhancedConfigSchemaVersion,
  normalizeEnhancedConfig,
  taskAnnouncement,
} from '../src/enhanced-config.mjs';

test('default enhanced config is balanced and immutable by normalization', () => {
  const config = normalizeEnhancedConfig();

  assert.equal(config.schemaVersion, enhancedConfigSchemaVersion);
  assert.equal(config.palette, 'valley-yellow');
  assert.equal(config.corner, 'square');
  assert.equal(config.contour.enabled, true);
  assert.equal(config.contour.fps, 24);
  assert.equal(config.contour.speed, 1);
  assert.equal(config.watermark.persistent, true);
  assert.equal(config.loader.mode, 'first-launch');
  assert.equal(config.taskPlate.start, false);
  assert.equal(config.taskPlate.complete, true);
  assert.notEqual(config, DEFAULT_ENHANCED_CONFIG);
  assert.notEqual(config.contour, DEFAULT_ENHANCED_CONFIG.contour);
});

test('normalization clamps settings and ignores unknown values', () => {
  const config = normalizeEnhancedConfig({
    palette: 'unknown',
    corner: 'rounded',
    contour: { enabled: 'yes', fps: 1000, speed: 4, pauseOnScroll: false },
    loader: { mode: 'always' },
    taskPlate: { durationMs: 2, animation: false },
    extra: 'ignored',
  });

  assert.equal(config.palette, 'valley-yellow');
  assert.equal(config.corner, 'rounded');
  assert.equal(config.contour.enabled, true);
  assert.equal(config.contour.fps, 60);
  assert.equal(config.contour.speed, 4);
  assert.equal(config.contour.pauseOnScroll, false);
  assert.equal(config.loader.mode, 'always');
  assert.equal(config.taskPlate.durationMs, 1000);
  assert.equal(config.taskPlate.animation, false);
  assert.equal('extra' in config, false);
});

test('task announcements distinguish terminal states', () => {
  assert.equal(taskAnnouncement('completed'), '任务完成');
  assert.equal(taskAnnouncement('failed'), '任务失败');
  assert.equal(taskAnnouncement('interrupted'), '任务中止');
  assert.equal(taskAnnouncement('inProgress'), null);
  assert.equal(taskAnnouncement('unknown'), null);
});

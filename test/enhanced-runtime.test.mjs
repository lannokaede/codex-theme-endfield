import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const runtime = await fs.readFile(new URL('../runtime/enhanced-runtime.js', import.meta.url), 'utf8');

test('enhanced runtime exposes the expected safe visual surfaces', () => {
  for (const marker of ['codex-endfield-style', 'codex-endfield-canvas', 'codex-endfield-watermark', 'codexEndfieldSave', 'turn/completed', 'codex:notification', 'WebSocket', 'prefers-reduced-motion']) {
    assert.match(runtime, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(runtime, /localStorage/);
});

test('runtime embeds only fixed watermark and status copy', () => {
  assert.match(runtime, /ENDFIELD/);
  assert.match(runtime, /任务完成/);
  assert.match(runtime, /任务失败/);
  assert.match(runtime, /任务中止/);
});

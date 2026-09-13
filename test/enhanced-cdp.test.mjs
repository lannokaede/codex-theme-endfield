import test from 'node:test';
import assert from 'node:assert/strict';

import { cdpHttpUrl, isCodexTarget } from '../src/enhanced-cdp.mjs';

test('CDP endpoint is loopback-only and validates ports', () => {
  assert.equal(cdpHttpUrl(9222), 'http://127.0.0.1:9222/json/list');
  assert.equal(cdpHttpUrl(9222, '/json/version'), 'http://127.0.0.1:9222/json/version');
  assert.throws(() => cdpHttpUrl(80), /Invalid CDP port/);
  assert.throws(() => cdpHttpUrl(9222, 'json/list'), /absolute/);
});

test('Codex target filter rejects external browser targets', () => {
  const base = { type: 'page', webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/1' };
  assert.equal(isCodexTarget({ ...base, url: 'app://codex/webview/index.html' }), true);
  assert.equal(isCodexTarget({ ...base, url: 'file:///C:/Codex/index.html' }), true);
  assert.equal(isCodexTarget({ ...base, url: 'https://example.com' }), false);
  assert.equal(isCodexTarget({ ...base, url: 'http://127.0.0.1:8080/index.html' }), true);
});

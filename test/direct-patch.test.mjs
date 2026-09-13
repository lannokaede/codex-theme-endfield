import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DIRECT_MARKER,
  assertSafePackageRoot,
  buildDirectPreloadPatch,
  isSupportedDirectVersion,
} from '../src/direct-patch.mjs';

test('direct preload patch is deterministic and idempotent', () => {
  const first = buildDirectPreloadPatch('existing();', 'runtime();');
  const second = buildDirectPreloadPatch(first.source, 'different();');
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(second.source, first.source);
  assert.equal(first.source.split(DIRECT_MARKER).length - 1, 1);
});

test('direct version gate only enables the verified ChatGPT build', () => {
  assert.equal(isSupportedDirectVersion('26.903.9818.0'), true);
  assert.equal(isSupportedDirectVersion('26.904.0000.0'), false);
});

test('package path guard rejects arbitrary directories', () => {
  assert.throws(() => assertSafePackageRoot('C:\\Users\\Public\\ChatGPT'), /unexpected ChatGPT package location/i);
});

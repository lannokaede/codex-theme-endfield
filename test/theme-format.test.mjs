import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CODE_THEME_ID,
  SHARE_PREFIX,
  contrastRatio,
  parseShareString,
  serializeTheme,
  validateThemeDefinition,
} from '../src/theme-format.mjs';

const source = JSON.parse(
  readFileSync(new URL('../themes/source.json', import.meta.url), 'utf8'),
);

test('source contains four unique light/dark presets', () => {
  assert.equal(source.themes.length, 4);
  assert.equal(new Set(source.themes.map((theme) => theme.id)).size, 4);
  assert.deepEqual(
    source.themes.map((theme) => theme.variant),
    ['light', 'dark', 'light', 'dark'],
  );
});

test('each source definition validates and serializes with the Codex prefix', () => {
  for (const definition of source.themes) {
    assert.doesNotThrow(() => validateThemeDefinition(definition));
    const serialized = serializeTheme(definition);
    assert.ok(serialized.startsWith(SHARE_PREFIX));
    const payload = parseShareString(serialized);
    assert.equal(payload.codeThemeId, CODE_THEME_ID);
    assert.equal(payload.variant, definition.variant);
    assert.equal(payload.theme.accentSource, 'custom');
    assert.equal(payload.theme.opaqueWindows, true);
    assert.equal(payload.theme.fonts.ui, 'Arial');
    assert.equal(payload.theme.fonts.content, 'Arial');
    assert.equal(payload.theme.fonts.code, null);
  }
});

test('all normal-text colors meet 4.5:1 contrast against their surface', () => {
  for (const definition of source.themes) {
    for (const role of ['ink', 'skill', 'diffAdded', 'diffRemoved']) {
      assert.ok(
        contrastRatio(definition[role], definition.surface) >= 4.5,
        `${definition.id} ${role} has insufficient contrast`,
      );
    }
  }
});

test('serialization is deterministic', () => {
  const definition = source.themes[0];
  assert.equal(serializeTheme(definition), serializeTheme({ ...definition }));
  assert.equal(
    serializeTheme(definition),
    'codex-theme-v1:{"codeThemeId":"codex","theme":{"accent":"#fff500","accentSource":"custom","contrast":45,"fonts":{"code":null,"content":"Arial","ui":"Arial"},"ink":"#101110","opaqueWindows":true,"semanticColors":{"diffAdded":"#1f7431","diffRemoved":"#c62016","skill":"#6b5d00"},"surface":"#e8e8e2"},"variant":"light"}',
  );
});

test('checked-in import artifacts match their source definitions', () => {
  for (const definition of source.themes) {
    const artifact = readFileSync(new URL(`../dist/${definition.id}.txt`, import.meta.url), 'utf8');
    assert.equal(artifact, `${serializeTheme(definition)}\n`);
    assert.doesNotThrow(() => parseShareString(artifact.trimEnd()));
  }
});

test('parser rejects malformed or unsupported shares', () => {
  assert.throws(() => parseShareString('{}'), /prefix/i);
  assert.throws(() => parseShareString(`${SHARE_PREFIX}{"codeThemeId":"codex","theme":{},"variant":"sepia"}`), /variant/i);
  assert.throws(
    () => parseShareString(`${SHARE_PREFIX}{"codeThemeId":"unknown","theme":{},"variant":"light"}`),
    /codeThemeId/i,
  );
});
